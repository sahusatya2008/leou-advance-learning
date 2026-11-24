import { notFound } from "next/navigation";
import { requireRole } from "@/lib/panels";
import { prisma } from "@/lib/prisma";
import { getGame } from "@/lib/games/catalog";
import { starterCode } from "@/lib/games/harness";
import { LANGUAGE_LABELS, OFFERED_LANGUAGES, type GameLanguage } from "@/lib/games/types";
import { GamePlayer } from "@/components/student/games/GamePlayer";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ gameId: string }>; searchParams: Promise<{ level?: string }> };

export default async function GamePage({ params, searchParams }: Params) {
  const { user } = await requireRole("STUDENT");
  const { gameId } = await params;
  const { level: levelParam } = await searchParams;

  const game = getGame(gameId);
  if (!game) notFound();

  const rows = await prisma.gameProgress.findMany({
    where: { userId: user.id, gameId: game.id },
    select: { levelId: true, language: true, stars: true, bestMoves: true, completed: true, code: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // The language the student last played this game in, so the picker does not
  // snap back to Python every visit.
  const lastLanguage = (rows[0]?.language as GameLanguage | undefined) ?? "python";
  const language: GameLanguage = OFFERED_LANGUAGES.includes(lastLanguage) ? lastLanguage : "python";

  // Resume at an explicit ?level, else the first lab not yet finished, else the last.
  const byLevel = new Map(rows.map((r) => [r.levelId, r]));
  const requested = levelParam && game.levels.some((l) => l.id === levelParam) ? levelParam : undefined;
  const firstIncomplete = game.levels.find((l) => !byLevel.get(l.id)?.completed);
  const levelId = requested ?? firstIncomplete?.id ?? game.levels[0].id;

  // Starters are built server-side so the client never bundles the compiler.
  const starters: Record<string, Record<string, string>> = {};
  for (const l of game.levels) {
    starters[l.id] = {};
    for (const lang of OFFERED_LANGUAGES) starters[l.id][lang] = starterCode(lang, l);
  }

  // Any draft the student already saved, so switching labs restores it.
  const savedCode: Record<string, string> = {};
  for (const r of rows) if (r.code != null) savedCode[r.levelId] = r.code;

  const progress: Record<string, { stars: number; bestMoves: number | null; completed: boolean }> = {};
  for (const r of rows) progress[r.levelId] = { stars: r.stars, bestMoves: r.bestMoves, completed: r.completed };

  return (
    <GamePlayer
      game={{
        id: game.id,
        title: game.title,
        tagline: game.tagline,
        accent: game.accent,
        kind: game.kind,
        levels: game.levels,
      }}
      starters={starters}
      savedCode={savedCode}
      languages={OFFERED_LANGUAGES}
      languageLabels={LANGUAGE_LABELS}
      initial={{ levelId, language, progress }}
    />
  );
}
