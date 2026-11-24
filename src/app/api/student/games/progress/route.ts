import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { prisma } from "@/lib/prisma";
import { getLevel } from "@/lib/games/catalog";
import { isOfferedLanguage } from "@/lib/games/types";

export const runtime = "nodejs";

/** Persists only the editor snapshot and language choice for a level.
 *
 *  Deliberately cannot touch `stars`, `bestMoves` or `completed`: those are
 *  decided by replaying a real run in `../run/route.ts`, so switching language
 *  or saving a draft here can never award a score. */
const MAX_SAVED_CODE = 20_000;

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  let body: { gameId?: string; levelId?: string; language?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const found = getLevel(String(body.gameId ?? ""), String(body.levelId ?? ""));
  if (!found) return NextResponse.json({ error: "Unknown level." }, { status: 404 });

  const language = String(body.language ?? "");
  if (!isOfferedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const code = typeof body.code === "string" ? body.code.slice(0, MAX_SAVED_CODE) : "";

  await prisma.gameProgress.upsert({
    where: {
      userId_gameId_levelId: { userId: user.id, gameId: found.game.id, levelId: found.level.id },
    },
    create: {
      userId: user.id,
      gameId: found.game.id,
      levelId: found.level.id,
      language,
      code,
    },
    update: { language, code },
  });

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
