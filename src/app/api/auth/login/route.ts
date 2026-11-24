import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applyPreloginCookie,
  applySessionCookie,
  clearSessionCookies,
  createSession,
  getPreloginIdentity,
  signToken,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/validation";
import { PRELOGIN_TTL } from "@/lib/constants";
import { FACE_CONFIG } from "@/lib/constants";
import { verifyFace, FaceServiceError } from "@/lib/faceService";
import { registerFailure, clearFailures, blockedFor } from "@/lib/rateLimit";
import { logActivity } from "@/lib/log";
import { getRequestMeta } from "@/lib/requestMeta";
import { consumeAccessCode } from "@/services/accessCodeService";
import { clearInviteCookie, inviteRedirectPath } from "@/lib/chess/invite";
import type { UserModel } from "@/generated/prisma/models";

export const runtime = "nodejs";

type UserWithProfile = UserModel & {
  studentProfile?: { fullName: string; faceEmbeddings: unknown; classRoomId: string } | null;
};

export async function POST(req: Request) {
  const meta = getRequestMeta(req);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode = String(body.mode ?? "");

  // ----------------------------------------------------------------- step 1: password
  if (mode === "password") {
    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");
    if (identifier.length > 120 || password.length > 200) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    // Progressive lockout: the more failures from this IP+identifier pair, the
    // longer the pair is parked. This is what stops password spraying.
    if (identifier.length > 0 && identifier.length <= 120 && password.length <= 200) {
      const wait = blockedFor(`pw:${meta.ip}:${identifier.toLowerCase()}`);
      if (wait > 0) {
        return NextResponse.json(
          {
            error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60_000) || 1} minute(s).`,
          },
          { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } },
        );
      }
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
      include: { studentProfile: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      const wait = registerFailure(`pw:${meta.ip}:${identifier.toLowerCase()}`);
      await logActivity({
        userId: (user as { id: string } | null)?.id,
        type: "LOGIN_PASSWORD_FAIL",
        metadata: { identifier, lockoutMs: wait },
        ...meta,
      });
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401, headers: wait > 5_000 ? { "Retry-After": String(Math.ceil(wait / 1000)) } : undefined },
      );
    }
    clearFailures(`pw:${meta.ip}:${identifier.toLowerCase()}`);

    if (user.status === "BLOCKED" || user.status === "SUSPENDED") {
      await logActivity({
        userId: user.id,
        type: "LOGIN_PASSWORD_FAIL",
        metadata: { reason: "account_" + user.status.toLowerCase() },
        ...meta,
      });
      return NextResponse.json(
        { error: `Your account is ${user.status.toLowerCase()}. Contact the admin.` },
        { status: 403 }
      );
    }

    if (user.role !== "STUDENT" && user.role !== "PARENT" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unsupported role." }, { status: 401 });
    }

    await logActivity({ userId: user.id, type: "LOGIN_PASSWORD", ...meta });

    if (user.role !== "STUDENT") {
      if (user.role === "PARENT") {
        await logActivity({ userId: user.id, type: "PARENT_LOGIN", ...meta });
      }
      const session = await createSession(user, meta);
      const res = jsonRes({ ok: true, step: "done", redirect: await redirectFor(user) });
      // Clear first, then set: the two Set-Cookie headers are applied in order,
      // so the fresh session replaces any stale credential the browser held.
      clearSessionCookies(res);
      applySessionCookie(res, session.token);
      return res;
    }

    const preToken = await signToken({ uid: user.id, role: user.role, u: user.username }, PRELOGIN_TTL);
    const res = jsonRes({
      ok: true,
      step: "face",
      name: user.username,
      displayName: (user as UserWithProfile).studentProfile?.fullName ?? user.username,
    });
    applyPreloginCookie(res, preToken);
    return res;
  }

  // ----------------------------------------------------------------- step 2: face match
  if (mode === "face") {
    const pre = await getPreloginIdentity();
    if (!pre?.uid) {
      // The pre-login window lapsed. Offer the access-code step instead of a
      // dead end: this branch used to leave the student on the face screen,
      // telling them to enter their password again, with no way back to it.
      return NextResponse.json(
        { error: "Your login window expired. Enter an access code to finish signing in.", allowAccessCode: true },
        { status: 401 }
      );
    }

    // The client uploads live camera frames; the Python service (InsightFace
    // ArcFace + DeepFace anti-spoofing) handles embedding, liveness and the
    // majority-vote match against the enrolled embeddings.
    const images = Array.isArray(body.images)
      ? (body.images as unknown[]).filter(
          (s): s is string => typeof s === "string" && s.startsWith("data:image/")
        )
      : [];
    if (images.length === 0) {
      return NextResponse.json(
        { error: "Camera frames are required. Please complete the on-camera check." },
        { status: 400 }
      );
    }
    // Bound the work: each frame is a full decode + ArcFace + MiniFASNet run, and
    // the Python service is single-process, so an oversized array would stall
    // every other user on the box.
    if (images.length > FACE_CONFIG.CAPTURE_FRAMES + 3) {
      return NextResponse.json({ error: "Too many frames submitted." }, { status: 400 });
    }
    if (images.some((s) => s.length > 4_000_000)) {
      return NextResponse.json({ error: "Camera frame is too large." }, { status: 413 });
    }

    const user = await prisma.user.findUnique({
      where: { id: pre.uid },
      include: { studentProfile: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Account is not active." }, { status: 403 });
    }
    if (!user.studentProfile) {
      return NextResponse.json({ error: "Face login is only available for students." }, { status: 403 });
    }

    const enrolled = user.studentProfile.faceEmbeddings as number[][];
    if (!Array.isArray(enrolled) || enrolled.length === 0) {
      await logActivity({
        userId: user.id,
        type: "LOGIN_FACE_FAIL",
        metadata: { distance: null, reason: "no_enrollment" },
        ...meta,
      });
      return NextResponse.json(
        { error: "No face is enrolled for this account. Contact the admin." },
        { status: 403 }
      );
    }

    const dim = enrolled[0]?.length;
    if (typeof dim !== "number" || dim !== FACE_CONFIG.EMBEDDING_DIM) {
      await logActivity({
        userId: user.id,
        type: "LOGIN_FACE_FAIL",
        metadata: { reason: "legacy_enrollment" },
        ...meta,
      });
      return NextResponse.json(
        {
          error: "This account is enrolled with an older face format. You can re-enroll your face now, or use an access code.",
          allowAccessCode: true,
          // The client turns this into a re-enrollment step. Without it the
          // student had no way forward: re-enrollment lived behind a login
          // that only re-enrollment could unblock.
          allowReEnroll: true,
        },
        { status: 403 }
      );
    }

    let verdict: Awaited<ReturnType<typeof verifyFace>>;
    try {
      verdict = await verifyFace(images, enrolled, {
        matchDistance: FACE_CONFIG.MATCH_DISTANCE,
        minFacePx: FACE_CONFIG.MIN_FACE_PX,
        requireLiveness: true,
      });
    } catch (e) {
      const msg = e instanceof FaceServiceError ? e.message : "Face service unavailable.";
      await logActivity({
        userId: user.id,
        type: "LOGIN_FACE_FAIL",
        metadata: { reason: "service_unavailable" },
        ...meta,
      });
      return NextResponse.json({ error: msg, allowAccessCode: true }, { status: 503 });
    }

    const match = verdict.pass;
    const distances = verdict.results
      .map((r) => r.distance)
      .filter((d): d is number => typeof d === "number");
    const report = distances.length ? Math.min(...distances) : 1;

    // Anti-spoof failing to reach a verdict fails the login closed rather than
    // waving a photo through. That is the right call for security, but it makes a
    // model outage look identical to a student being told their face is a
    // spoof, so separate the two: the student gets an honest message and the
    // activity log records an outage instead of an accusation.
    const livenessDown =
      !match && verdict.results.length > 0 &&
      verdict.results.every((r) => r.reason === "liveness_unavailable");

    await logActivity({
      userId: user.id,
      type: match ? "LOGIN_FACE" : "LOGIN_FACE_FAIL",
      metadata: {
        samples: verdict.samples,
        matched: verdict.valid,
        required: verdict.votes_required,
        distance: Number(Number.isFinite(report) ? report.toFixed(4) : 1),
        ...(livenessDown ? { reason: "liveness_unavailable" } : {}),
      },
      ...meta,
    });

    if (!match) {
      return NextResponse.json(
        {
          error: livenessDown
            ? "Face check is temporarily unavailable, so we could not verify you. Use your access code to sign in, or try again shortly."
            : "Face verification failed.",
          allowAccessCode: true,
          distance: Number(Number.isFinite(report) ? report.toFixed(4) : 1),
          matched: verdict.valid,
          required: verdict.votes_required,
        },
        { status: 403 }
      );
    }

    const session = await createSession(user, meta);
    const res = jsonRes({ ok: true, redirect: await redirectFor(user) });
    clearSessionCookies(res);
    applySessionCookie(res, session.token);
    return res;
  }

  // ----------------------------------------------------------------- step 3: access code fallback
  if (mode === "access-code") {
    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");
    const code = String(body.code ?? "").trim();

    // Same progressive lockout the password step uses. Without it this branch
    // was an unthrottled oracle: a 6-digit code is small enough to grind
    // through while other paths were locked down.
    if (identifier.length > 0 && identifier.length <= 120 && password.length > 0 && password.length <= 200) {
      const wait = blockedFor(`pw:${meta.ip}:${identifier.toLowerCase()}`);
      if (wait > 0) {
        return NextResponse.json(
          {
            error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60_000) || 1} minute(s).`,
          },
          { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } }
        );
      }
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      const lockoutMs =
        identifier.length > 0 && identifier.length <= 120 && password.length > 0 && password.length <= 200
          ? registerFailure(`pw:${meta.ip}:${identifier.toLowerCase()}`)
          : 0;
      await logActivity({
        userId: (user as { id: string } | null)?.id,
        type: "LOGIN_PASSWORD_FAIL",
        metadata: { identifier, source: "access_code_step", lockoutMs },
        ...meta,
      });
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }
    clearFailures(`pw:${meta.ip}:${identifier.toLowerCase()}`);

    if (user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Account is not active." }, { status: 403 });
    }

    const consumed = await consumeAccessCode(user.id, code, meta);
    if (!consumed.ok) {
      // Only genuine guessing counts against the lockout. "already_used" and
      // "expired" both mean the student held a real code — a response lost in
      // transit looks exactly like a replay, and parking them for a minute over
      // that would be a support call, not a defence.
      if (consumed.reasonCode === "not_found") {
        registerFailure(`pw:${meta.ip}:${identifier.toLowerCase()}`);
      }
      return NextResponse.json({ error: consumed.reason }, { status: 403 });
    }

    await logActivity({ userId: user.id, type: "LOGIN_ACCESS_CODE", metadata: { ok: true }, ...meta });
    const session = await createSession(user, meta);
    const res = jsonRes({ ok: true, redirect: await redirectFor(user) });
    clearSessionCookies(res);
    applySessionCookie(res, session.token);
    return res;
  }

  return NextResponse.json({ error: "Unknown login mode." }, { status: 400 });
}

function jsonRes(body: Record<string, unknown>) {
  return NextResponse.json(body);
}

/**
 * Where a just-authenticated user should land. Students who arrived through a
 * chess invite link get returned to that room (once — the cookie is cleared);
 * everyone else goes to their normal home.
 */
async function redirectFor(user: { id: string; role: string }): Promise<string> {
  if (user.role === "STUDENT") {
    const invite = await inviteRedirectPath(user.id);
    if (invite) {
      await clearInviteCookie();
      return invite;
    }
  }
  return dashboardFor(user.role);
}

function dashboardFor(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "PARENT") return "/parent";
  return "/dashboard";
}