/**
 * The "come back to the room you were invited to" cookie.
 *
 * A friend follows an invite link without an account. We cannot keep the token
 * in the URL across registration and login (both are plain navigations to fixed
 * paths), so visiting the room drops a short-lived cookie holding the invite
 * token. The login route then reads it and, once, sends the freshly signed-in
 * student to the room instead of the dashboard.
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { INVITE_COOKIE } from "@/lib/cookies";

const INVITE_TTL_MS = 6 * 60 * 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

function inviteCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

/** Remember an invite for a visitor who is not signed in yet. */
export async function setInviteCookie(token: string) {
  if (!TOKEN_RE.test(token)) return;
  (await cookies()).set(INVITE_COOKIE, token, inviteCookieOptions(Math.floor(INVITE_TTL_MS / 1000)));
}

export async function clearInviteCookie() {
  (await cookies()).set(INVITE_COOKIE, "", inviteCookieOptions(0));
}

export async function readInviteToken(): Promise<string | null> {
  const value = (await cookies()).get(INVITE_COOKIE)?.value;
  return value && TOKEN_RE.test(value) ? value : null;
}

/**
 * Resolve the pending invite to a room path, or null when there is nothing to
 * return to. A room qualifies when it is still open or when the student already
 * holds a seat in it; anything else (finished, expired token, not a room) is
 * ignored so a stale cookie can never hijack a normal login.
 */
export async function inviteRedirectPath(userId: string): Promise<string | null> {
  const token = await readInviteToken();
  if (!token) return null;

  const match = await prisma.chessMatch.findUnique({
    where: { inviteToken: token },
    select: { id: true, mode: true, status: true, whiteId: true, blackId: true },
  });
  if (!match || match.mode !== "MULTIPLAYER") return null;

  const seated = match.whiteId === userId || match.blackId === userId;
  const openSeat = (match.whiteId == null || match.blackId == null) && match.status === "ACTIVE";
  if (!seated && !openSeat) return null;

  return `/dashboard/chess/${match.id}`;
}
