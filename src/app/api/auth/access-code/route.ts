import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/validation";
import { getRequestMeta } from "@/lib/requestMeta";
import { rateLimit, registerFailure, clearFailures, blockedFor } from "@/lib/rateLimit";
import { logActivity } from "@/lib/log";
import { issueAccessCode } from "@/services/accessCodeService";
import { LOGIN_CONFIG } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Lets a student read their OWN access code after proving their password, so a
 * camera that will not cooperate can never leave them locked out.
 *
 * What this does and does not grant:
 *  - the password is still verified on every call;
 *  - the code is per-student, 60s long and single-use, and issuing a new one
 *    invalidates the previous one;
 *  - every issue is written to the activity log.
 *
 * What it means for the platform: face verification is no longer *required* to
 * sign in, only *available*. Anyone holding a student's password can obtain a
 * code without passing the face check. Set SELF_SERVICE_ACCESS_CODE=0 to turn
 * this off and go back to admin-issued codes.
 */
export async function POST(req: Request) {
  if (!LOGIN_CONFIG.SELF_SERVICE_ACCESS_CODE) {
    return NextResponse.json(
      { error: "Self-service access codes are disabled. Ask your admin for a code." },
      { status: 403 }
    );
  }

  const meta = getRequestMeta(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");
  if (!identifier || identifier.length > 120 || !password || password.length > 200) {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }

  // Throttle per account+IP so a working password cannot be turned into a code
  // factory, and reuse the progressive lockout so a wrong password here still
  // feeds the same counter as the login form.
  const pair = `${meta.ip}:${identifier.toLowerCase()}`;
  const blocked = blockedFor(`pw:${pair}`);
  if (blocked > 0) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${Math.ceil(blocked / 60_000) || 1} minute(s).` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(blocked / 1000)) } }
    );
  }

  const issued = rateLimit(`selfcode:${pair}`, {
    limit: LOGIN_CONFIG.SELF_SERVICE_CODES_PER_HOUR,
    windowMs: 60 * 60_000,
    blockMs: 5 * 60_000,
    maxBlockMs: 60 * 60_000,
  });
  if (!issued.ok) {
    return NextResponse.json(
      { error: "You have requested a lot of codes. Wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(issued.retryAfter) } }
    );
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
    select: { id: true, role: true, status: true, passwordHash: true, username: true },
  });

  // Same message and status for "no such user" and "wrong password" so this
  // endpoint cannot be used to enumerate accounts.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    const wait = registerFailure(`pw:${pair}`);
    await logActivity({
      userId: user?.id ?? undefined,
      type: "LOGIN_PASSWORD_FAIL",
      metadata: { identifier, source: "self_service_code", lockoutMs: wait },
      ...meta,
    });
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  clearFailures(`pw:${pair}`);

  if (user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Access codes are for student accounts only." },
      { status: 403 }
    );
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Your account is ${user.status.toLowerCase()}. Contact the admin.` },
      { status: 403 }
    );
  }

  const code = await issueAccessCode(user.id, undefined, { ...meta, source: "self_service" });

  return NextResponse.json({
    code: code.code,
    expiresAt: code.expiresAt,
    ttlMs: Math.max(0, new Date(code.expiresAt).getTime() - Date.now()),
  });
}
