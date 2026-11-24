import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { prisma } from "@/lib/prisma";
import { isOfferedLanguage, type GameLanguage } from "@/lib/games/types";
import { DIFFICULTY_IDS, isDifficulty } from "@/lib/chess/ai";
import { createComputerMatch, createMultiplayerMatch, toPublicMatch } from "@/lib/chess/matchService";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  const matches = await prisma.chessMatch.findMany({
    // Rooms they opened plus rooms they are seated in (friends' invites).
    where: { OR: [{ createdById: user.id }, { whiteId: user.id }, { blackId: user.id }] },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { moves: { orderBy: { ply: "asc" } } },
  });

  return NextResponse.json(
    { ok: true, matches: matches.map(toPublicMatch) },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  let body: { mode?: string; difficulty?: string; language?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const mode = String(body.mode ?? "COMPUTER").toUpperCase();
  if (mode !== "COMPUTER" && mode !== "MULTIPLAYER") {
    return NextResponse.json({ error: "Mode must be COMPUTER or MULTIPLAYER." }, { status: 400 });
  }

  const language = String(body.language ?? "python");
  if (!isOfferedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const color = String(body.color ?? "white");
  if (color !== "white" && color !== "black") {
    return NextResponse.json({ error: 'Color must be "white" or "black".' }, { status: 400 });
  }

  if (mode === "MULTIPLAYER") {
    // Opening a room (an invite you initiate) is a paid feature. Joining one
    // through a friend's link — and playing against the computer — stay free.
    const guard = await requireActiveService(user.id);
    if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

    const { id, inviteToken } = await createMultiplayerMatch(user.id, {
      language: language as GameLanguage,
      color: color as "white" | "black",
    });
    const match = await prisma.chessMatch.findUnique({ where: { id }, include: { moves: { orderBy: { ply: "asc" } } } });
    return NextResponse.json(
      { ok: true, match: toPublicMatch(match!), inviteToken },
      { headers: { "cache-control": "no-store" } }
    );
  }

  const difficulty = String(body.difficulty ?? "medium");
  if (!isDifficulty(difficulty)) {
    return NextResponse.json({ error: `Difficulty must be one of ${DIFFICULTY_IDS.join(", ")}.` }, { status: 400 });
  }

  const id = await createComputerMatch(user.id, { difficulty, language: language as GameLanguage, color: color as "white" | "black" });
  const match = await prisma.chessMatch.findUnique({ where: { id }, include: { moves: { orderBy: { ply: "asc" } } } });
  return NextResponse.json({ ok: true, match: toPublicMatch(match!) }, { headers: { "cache-control": "no-store" } });
}
