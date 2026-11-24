import crypto from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/log";
import { PRELOGIN_TTL, SESSION_TTL } from "@/lib/constants";
import { SESSION_COOKIE, PRELOGIN_COOKIE } from "@/lib/cookies";
import type { ParsedDevice } from "@/lib/device";
import type { Role } from "@/generated/prisma/enums";

export { SESSION_COOKIE, PRELOGIN_COOKIE };

const DEV_FALLBACK = "dev-secret-change-me";

/**
 * The signing key for session and pre-login tokens.
 *
 * A known default here is the worst kind of silent failure: the app boots, looks
 * healthy, and every session token becomes forgeable (anyone can mint an ADMIN
 * token). So in production we refuse to operate without a real secret rather
 * than quietly fall back. Dev keeps the fallback so a fresh clone "just runs".
 */
const secret = () => {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw === DEV_FALLBACK) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is not set — refusing to sign or verify tokens with a known default.");
    }
    return new TextEncoder().encode(DEV_FALLBACK);
  }
  return new TextEncoder().encode(raw);
};

type TokenPayload = { uid: string; sid?: string; role?: Role; u?: string };

export async function signToken(payload: TokenPayload, expiresIn: string | number) {
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload, iat })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(iat + Math.floor((typeof expiresIn === "number" ? expiresIn : parseTtl(expiresIn)) / 1000))
    .sign(secret());
}

function parseTtl(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n * 1000 : SESSION_TTL;
}

export async function verifyToken<T extends TokenPayload>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as T;
  } catch {
    return null;
  }
}

function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

export type SessionInfo = {
  token: string;
  user: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
  sid: string;
};

export async function createSession(
  user: { id: string; role: Role },
  ctx: { ip?: string; userAgent?: string; deviceId?: string; device?: ParsedDevice }
): Promise<SessionInfo> {
  const token = crypto.randomBytes(48).toString("hex");
  const sid = crypto.randomUUID();

  const expiresAt = new Date(Date.now() + SESSION_TTL);
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      deviceId: ctx.deviceId ?? null,
      device: ctx.device as never,
      expiresAt,
      id: sid,
    },
  });

  const jwt = await signToken({ uid: user.id, sid, role: user.role, u: user.id }, SESSION_TTL);
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  await logActivity({
    userId: user.id,
    type: "LOGIN_SUCCESS",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    deviceId: ctx.deviceId,
    device: ctx.device as never,
  });

  return { token: jwt, user: full, sid };
}

export async function revokeSession(sid: string) {
  await prisma.session.updateMany({ where: { id: sid }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
}

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

/**
 * Sessions slide forward while they are being used.
 *
 * The three clocks that make a session last (the JWT `exp`, the
 * `Session.expiresAt` row and the cookie's `maxAge`) were all set once at login
 * and never touched again, so every session died exactly 7 days later even for
 * someone who used the site every single day. That is the "randomly logged out"
 * report.
 *
 * Once a session is past the halfway mark we push all three clocks forward
 * again, so what a user experiences is "logged out after 7 days of not using
 * it" rather than "logged out 7 days after logging in".
 */
const RENEW_AFTER_MS = SESSION_TTL / 2;

/**
 * Extend a live session and re-issue its cookie.
 *
 * The database update always happens. Re-issuing the cookie only works where
 * the framework allows a response to be mutated (route handlers and server
 * actions); inside a server component `cookies()` is read-only, so the write is
 * best-effort there. That is safe rather than lossy: the session row is the
 * authority for whether the login is still valid, so a missed cookie refresh
 * cannot end a session early, and the next route-handler request repairs it.
 */
async function renewSessionIfStale(session: { id: string; userId: string; expiresAt: Date }) {
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining > RENEW_AFTER_MS) return;

  const expiresAt = new Date(Date.now() + SESSION_TTL);
  await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { expiresAt },
  });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (!user) return;

  const jwt = await signToken({ uid: session.userId, sid: session.id, role: user.role, u: session.userId }, SESSION_TTL);
  try {
    (await cookies()).set(SESSION_COOKIE, jwt, sessionCookieOptions());
  } catch {
    /* Read-only context (server component). The row above is what matters. */
  }
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken<{ uid: string; sid: string; role: Role }>(token);
  if (!payload) return null;

  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    include: {
      studentProfile: { include: { classRoom: { select: { id: true, name: true } } } },
      parentProfile: true,
    },
  });
  if (!user) return null;

  // Do not keep refreshing a session for an account that has since been
  // suspended or blocked; it must read as logged out, not as a valid session.
  if (user.status !== "ACTIVE") return null;

  await renewSessionIfStale(session);

  return { user, sid: payload.sid };
}

export async function getPreloginIdentity() {
  const store = await cookies();
  const token = store.get(PRELOGIN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken<{ uid: string; u: string }>(token);
}

type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict";
  secure: boolean;
  path: string;
  maxAge: number;
  /** Keeps the browser from discarding the cookie under storage pressure. */
  priority: "high";
};

/**
 * One definition of the session cookie, shared by login and renewal, so the
 * two can never drift apart and strand a user with an unusable cookie.
 */
function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL / 1000),
    priority: "high",
  };
}

export function applySessionCookie(res: Pick<{ cookies: unknown }, "cookies">, token: string) {
  // NextResponse cookie API designed around (res as any).cookies.set; kept typed loosely here.
  type Res = { cookies: { set: (n: string, v: string, o?: Record<string, unknown>) => void } };
  (res as unknown as Res).cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function applyPreloginCookie(res: Pick<{ cookies: unknown }, "cookies">, token: string) {
  type Res = { cookies: { set: (n: string, v: string, o?: Record<string, unknown>) => void } };
  (res as unknown as Res).cookies.set(PRELOGIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(PRELOGIN_TTL / 1000),
    priority: "high",
  });
}

export function clearSessionCookies(res: Pick<{ cookies: unknown }, "cookies">) {
  type Res = { cookies: { delete: (n: string) => void } };
  (res as unknown as Res).cookies.delete(SESSION_COOKIE);
  (res as unknown as Res).cookies.delete(PRELOGIN_COOKIE);
}

export async function logout(sid: string) {
  await revokeSession(sid);
}