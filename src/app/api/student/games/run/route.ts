import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { runnerRun } from "@/services/runner";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { buildProgram } from "@/lib/games/harness";
import { getLevel } from "@/lib/games/catalog";
import {
  extractArena,
  extractOutputResults,
  extractTrace,
  isOfferedLanguage,
  judge,
  judgeArena,
  judgeOutput,
  judgePaint,
  parseArenaOps,
  parseCanvas,
  parseWorld,
  simulate,
  simulateArena,
  simulatePaint,
  type GameLanguage,
  type Outcome,
} from "@/lib/games/types";

export const runtime = "nodejs";

const RUNNER_LANG: Record<GameLanguage, string> = {
  python: "python",
  javascript: "node",
  java: "java",
  cpp: "cpp",
};

/** How much of the editor we persist alongside a run. The run itself accepts
 *  more; this is only the resume snapshot. */
const MAX_SAVED_CODE = 20_000;

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  if (!profId) return NextResponse.json({ error: "No student profile." }, { status: 403 });

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  // The game run spends a real sandbox container, so it shares the code-exec
  // budget. A student retrying a level is bursty by nature, hence the window.
  const limit = rateLimit(`games-run:${profId}`, { limit: 15, windowMs: 10_000, blockMs: 20_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Whoa — too many runs. Try again in ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

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

  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) return NextResponse.json({ error: "Write some code first." }, { status: 400 });
  if (code.length > 60_000) return NextResponse.json({ error: "That program is too large." }, { status: 400 });

  const { game, level } = found;

  let stdout = "";
  let stderr = "";
  try {
    const program = buildProgram(language, level, code);
    const res = await runnerRun(RUNNER_LANG[language], program, "");
    stdout = res.stdout;
    stderr = res.stderr;
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }

  // Decide the outcome server-side. For the two world kinds that means replaying
  // the trace and judging the result; for the output kind it means comparing the
  // reported values against the expected list. Either way the client only ever
  // renders — it never scores.
  let outcome: Outcome;
  let payload: Record<string, unknown>;
  if (level.kind === "output") {
    const results = extractOutputResults(stdout, level);
    outcome = judgeOutput(level, results);
    payload = { kind: "output", results };
  } else if (level.kind === "paint") {
    const tokens = extractTrace(stdout);
    const sim = simulatePaint(parseCanvas(level.target), tokens);
    outcome = judgePaint(level, sim);
    payload = { kind: "paint", tokens };
  } else if (level.kind === "arena") {
    const { tokens, returned } = extractArena(stdout);
    const sim = simulateArena(level, parseArenaOps(tokens));
    outcome = judgeArena(level, sim, returned);
    payload = { kind: "arena", tokens, returned };
  } else {
    const tokens = extractTrace(stdout);
    const sim = simulate(parseWorld(level.world), tokens);
    outcome = judge(level, sim);
    payload = { kind: "bot", tokens };
  }

  // Stars are computed here and written here — a client can never POST its own
  // score. `bestMoves` only tightens on a win, and is null for output levels.
  const existing = await prisma.gameProgress.findUnique({
    where: { userId_gameId_levelId: { userId: user.id, gameId: game.id, levelId: level.id } },
    select: { stars: true, bestMoves: true, completed: true },
  });
  const stars = Math.max(existing?.stars ?? 0, outcome.stars);
  const bestMoves = outcome.won
    ? Math.min(existing?.bestMoves ?? Number.MAX_SAFE_INTEGER, outcome.commands)
    : (existing?.bestMoves ?? null);
  const completed = (existing?.completed ?? false) || outcome.won;

  await prisma.gameProgress.upsert({
    where: { userId_gameId_levelId: { userId: user.id, gameId: game.id, levelId: level.id } },
    create: {
      userId: user.id,
      gameId: game.id,
      levelId: level.id,
      language,
      stars,
      bestMoves,
      completed,
      code: code.slice(0, MAX_SAVED_CODE),
    },
    update: {
      language,
      stars,
      bestMoves,
      completed,
      code: code.slice(0, MAX_SAVED_CODE),
    },
  });

  // The trace is returned as tokens; the client replays the same pure simulator
  // to animate, so the two can never disagree about the run.
  return NextResponse.json(
    {
      ok: true,
      outcome,
      ...payload,
      // Student's own output (from `print`/`console.log`) and any compile/runtime
      // error, so a syntax error is not silent.
      stdout: stdout.slice(0, 4000),
      stderr: stderr.slice(0, 4000),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
