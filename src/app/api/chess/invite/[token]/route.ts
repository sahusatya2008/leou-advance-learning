import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequestMeta } from "@/lib/requestMeta";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { participantColor, claimInviteSeat } from "@/lib/chess/matchService";
import { setInviteCookie, clearInviteCookie } from "@/lib/chess/invite";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

const NAME_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Public preview of an invitation. No session required — this is what a friend
 * sees after following an invite link, so it exposes only the host's display
 * name and the shape of the game, never emails, ids, or either player's code.
 *
 * A visitor who is not signed in yet also gets the invite stashed in a cookie,
 * so registering or signing in returns them straight to this room.
 */
export async function GET(req: Request, { params }: Params) {
  const { token } = await params;
  if (!NAME_RE.test(token)) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });

  const ip = getRequestMeta(req).ip ?? "unknown";
  const limit = rateLimit(`invite-view:${ip}`, { limit: 60, windowMs: 60_000, blockMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const match = await prisma.chessMatch.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      mode: true,
      status: true,
      language: true,
      plyCount: true,
      fen: true,
      whiteId: true,
      blackId: true,
      result: true,
      createdBy: { select: { username: true, studentProfile: { select: { fullName: true } } } },
      white: { select: { username: true, studentProfile: { select: { fullName: true } } } },
      black: { select: { username: true, studentProfile: { select: { fullName: true } } } },
    },
  });
  if (!match || match.mode !== "MULTIPLAYER") return NextResponse.json({ error: "Invitation not found." }, { status: 404 });

  const current = await getCurrentUser();
  const userId = current?.user.id ?? null;
  const myColor = userId ? participantColor(match, userId) : null;
  const openSeat = match.whiteId == null || match.blackId == null;
  const claimable = match.status === "ACTIVE" && openSeat && myColor == null;

  // Only anonymous visitors need to be remembered — a signed-in host or guest
  // already knows the way back, and a sticky cookie would be a nuisance.
  if (!userId && claimable) await setInviteCookie(token);

  const name = (u: typeof match.white) => u?.studentProfile?.fullName ?? u?.username ?? null;

  return NextResponse.json(
    {
      ok: true,
      match: {
        id: match.id,
        status: match.status,
        language: match.language,
        plyCount: match.plyCount,
        fen: match.fen,
        result: match.result,
        hostName: name(match.createdBy),
        whiteName: name(match.white),
        blackName: name(match.black),
        openSeat: openSeat ? (match.whiteId == null ? "white" : "black") : null,
        claimable,
      },
      auth: { signedIn: Boolean(userId), role: current?.user.role ?? null, myColor, canClaim: Boolean(userId) && claimable },
    },
    { headers: { "cache-control": "no-store" } }
  );
}

/**
 * Claim the open seat. Requires a session — a seat belongs to an account — but
 * not an enrollment: a game you were invited to is free.
 */
export async function POST(_req: Request, { params }: Params) {
  const { token } = await params;
  if (!NAME_RE.test(token)) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });

  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Sign in to take your seat." }, { status: 401 });
  if (current.user.role !== "STUDENT") return NextResponse.json({ error: "Only students can play." }, { status: 403 });

  const match = await prisma.chessMatch.findUnique({ where: { inviteToken: token }, select: { id: true } });
  if (!match) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });

  const result = await claimInviteSeat(match.id, current.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  await clearInviteCookie();
  return NextResponse.json({ ok: true, matchId: result.matchId, color: result.color }, { headers: { "cache-control": "no-store" } });
}
