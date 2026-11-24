import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPreloginIdentity, createSession, applySessionCookie, clearSessionCookies } from "@/lib/auth";
import { getRequestMeta } from "@/lib/requestMeta";
import { rateLimit } from "@/lib/rateLimit";
import { logActivity } from "@/lib/log";
import { buildEnrollment, collectImages, livenessLog, MAX_SAMPLES } from "@/services/faceEnrollmentService";

export const runtime = "nodejs";

/**
 * Self-service re-enrollment for students whose stored face cannot be used.
 *
 * The `legacy_enrollment` case (a face stored in an older format) used to be a
 * dead end: the student could never pass the face step, so they could never
 * reach the page where enrollment lives. This route runs inside the pre-login
 * window instead — the password is already verified — and on success it replaces
 * the old embeddings and signs the student straight in.
 *
 * Reversibility: it only ever *replaces* a student's own `faceEmbeddings`, and
 * only when the new samples pass the exact same validation an admin enrollment
 * would. Nothing is deleted and no schema changes. The previous set is recorded
 * in the activity log's sample count, and an admin can overwrite it at any time
 * through the existing student page.
 */
export async function POST(req: Request) {
  const meta = getRequestMeta(req);
  const pre = await getPreloginIdentity();
  if (!pre?.uid) {
    return NextResponse.json(
      { error: "Your login window expired. Sign in with your password to continue." },
      { status: 401 }
    );
  }

  const limited = rateLimit(`reenroll:${pre.uid}`, {
    limit: 6,
    windowMs: 60 * 60_000,
    blockMs: 10 * 60_000,
    maxBlockMs: 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many re-enrollment attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: pre.uid },
    include: { studentProfile: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is not active." }, { status: 403 });
  }
  if (user.role !== "STUDENT" || !user.studentProfile) {
    return NextResponse.json({ error: "Re-enrollment is only available for students." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const images = collectImages(body);
  if (images.length > MAX_SAMPLES) {
    return NextResponse.json({ error: `At most ${MAX_SAMPLES} images per enrollment.` }, { status: 400 });
  }

  const previousCount = Array.isArray(user.studentProfile.faceEmbeddings)
    ? user.studentProfile.faceEmbeddings.length
    : 0;

  const result = await buildEnrollment(images);
  if (!result.ok) {
    await logActivity({
      userId: user.id,
      type: "FACE_ENROLL",
      metadata: { actor: "SELF", mode: "login_recovery", ok: false, submittedFrames: images.length },
      ...meta,
    }).catch(() => null);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  await prisma.studentProfile.update({
    where: { id: user.studentProfile.id },
    data: {
      faceEmbeddings: result.embeddings,
      facePhotoUrl: result.images[0],
    },
  });

  // Logged after the write so a failure here cannot mask a successful re-enroll.
  await logActivity({
    userId: user.id,
    type: "FACE_ENROLL",
    metadata: {
      actor: "SELF",
      mode: "login_recovery",
      ok: true,
      submittedFrames: images.length,
      acceptedFrames: result.accepted,
      samples: result.embeddings.length,
      previousSamples: previousCount,
      liveness: livenessLog(result.embed),
    },
    ...meta,
  }).catch(() => null);

  // Re-enrollment is only ever reached from a failed login, so completing the
  // login here saves the student a second password entry.
  const session = await createSession(user, meta);
  const res = NextResponse.json({ ok: true, samples: result.embeddings.length, redirect: "/dashboard" });
  // Use the shared helpers so the cookie options (maxAge, priority, secure)
  // cannot drift from a normal login.
  clearSessionCookies(res);
  applySessionCookie(res, session.token);
  return res;
}
