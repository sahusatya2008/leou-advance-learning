import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { runnerRun } from "@/services/runner";
import { isOfferedLanguage, type GameLanguage } from "@/lib/games/types";
import { buildChess, extractChessMove } from "@/lib/chess/harness";
import { promptFromFen, RUNNER_LANG } from "@/lib/chess/matchService";
import { getTrainingLesson, isTrainingTrack, judgeLesson, lessonPositionAfter } from "@/lib/chess/training";
import type { TrainingLesson } from "@/lib/chess/training";

export const runtime = "nodejs";

const MAX_CODE = 60_000;
const MAX_SAVED_CODE = 20_000;
const MAX_HISTORY = 24;

type Body = {
  track?: string;
  lessonId?: string;
  language?: string;
  /** Programming lessons: the student's move(game) source. */
  code?: string;
  /** Physical lessons: the moves the student played on the board. */
  moves?: string[];
  /**
   * Programming lessons: moves played so far this session, in UCI — lets a
   * multi-move lesson run the program once per turn against the live position.
   */
  history?: string[];
};

type Live = ReturnType<typeof lessonPositionAfter>;

/** The position the program is asked about, plus whether the lesson is over. */
function liveContext(lesson: TrainingLesson, history: string[]): Live {
  if (history.length === 0) {
    return { fen: lesson.fen, studentMoves: 0, over: false, invalid: false };
  }
  return lessonPositionAfter(lesson, history);
}

/**
 * Grade one training submission.
 *
 * Training is enrolled-only, so this route is behind `requireActiveService` —
 * unlike a live match, which is free to play. The client may send either a move
 * list (physical track) or code (programming track); either way the judge replays
 * it with the real engine and stars are written here, never accepted from the
 * client.
 */
export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  const profId = user.studentProfile?.id ?? user.id;
  const limit = rateLimit(`chess-train:${profId}`, { limit: 20, windowMs: 10_000, blockMs: 15_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Easy there — too many attempts at once. Try again in ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const track = String(body.track ?? "");
  if (!isTrainingTrack(track)) return NextResponse.json({ error: "Unknown training track." }, { status: 400 });

  const lesson = getTrainingLesson(track, String(body.lessonId ?? ""));
  if (!lesson) return NextResponse.json({ error: "Unknown lesson." }, { status: 400 });

  let stdout = "";
  let stderr = "";
  let language: GameLanguage | null = null;
  let playerMoves: string[] = [];
  let savedCode: string | null = null;
  let liveFen = lesson.fen;
  let line: string[] = [];
  let movesPlayed = 0;
  let done = false;

  if (track === "programming") {
    const lang = String(body.language ?? "python");
    if (!isOfferedLanguage(lang)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
    language = lang;

    const code = typeof body.code === "string" ? body.code : "";
    if (!code.trim()) return NextResponse.json({ error: "Write some code first." }, { status: 400 });
    if (code.length > MAX_CODE) return NextResponse.json({ error: "That program is too large." }, { status: 400 });
    savedCode = code.slice(0, MAX_SAVED_CODE);

    // A programming lesson can span several turns. `history` is the UCI line
    // played so far; the program is asked about the resulting position, and the
    // judge verifies the whole line still ends in the goal.
    const rawHistory = Array.isArray(body.history) ? body.history.map((m) => String(m ?? "")) : [];
    const history = rawHistory.slice(-MAX_HISTORY).map((m) => m.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()).filter(Boolean);
    const live = liveContext(lesson, history);
    liveFen = live.fen;
    movesPlayed = live.studentMoves;
    done = live.over;

    // Even when the game is already decided we still replay the line so the
    // response carries the full animation and the graded outcome.
    try {
      const program = done ? "" : buildChess(lang, promptFromFen(live.fen), code);
      if (done) {
        stdout = "";
        stderr = "";
      } else {
        const res = await runnerRun(RUNNER_LANG[lang], program, "");
        stdout = res.stdout;
        stderr = res.stderr;
      }
    } catch (e) {
      const err = e as Error & { status?: number };
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }

    const chosen = done ? null : extractChessMove(stdout);
    const clean = (chosen ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const nextLine = clean ? [...history, clean] : history;
    playerMoves = nextLine;
    line = judgeLesson(lesson, nextLine).line;
  } else {
    playerMoves = Array.isArray(body.moves) ? body.moves.map((m) => String(m ?? "")) : [];
    if (playerMoves.length === 0) return NextResponse.json({ error: "Play a move first." }, { status: 400 });
    line = judgeLesson(lesson, playerMoves).line;
  }

  const result = judgeLesson(lesson, playerMoves);

  // For the programming track the lesson ends when the goal is met or the game
  // itself is over (a mate, stalemate or forced draw on the board). Note that
  // `liveFen` is the position *before* this player move, so compare against the
  // position the whole line now reaches — not the pre-move FEN.
  if (track === "programming") {
    movesPlayed = playerMoves.length;
    const nowLive = liveContext(lesson, playerMoves);
    liveFen = nowLive.fen;
    done = done || result.won || nowLive.over;
  }

  // Persist best-ever performance. Stars only ever go up; `bestMoves` only
  // tightens on a solve, so a failed retry cannot erase a good result.
  const existing = await prisma.chessTrainingProgress.findUnique({
    where: { userId_track_lessonId: { userId: user.id, track, lessonId: lesson.id } },
    select: { stars: true, bestMoves: true, completed: true, language: true },
  });
  const usedMoves = Math.max(1, result.won ? lesson.solution.length : movesPlayed || playerMoves.length);
  const stars = Math.max(existing?.stars ?? 0, result.stars);
  const prevBest = existing?.bestMoves ?? null;
  const bestMoves = result.won ? (prevBest == null ? usedMoves : Math.min(prevBest, usedMoves)) : prevBest;
  const completed = (existing?.completed ?? false) || result.won;
  const persistedLanguage = track === "programming" ? language ?? "python" : existing?.language ?? "python";

  await prisma.chessTrainingProgress.upsert({
    where: { userId_track_lessonId: { userId: user.id, track, lessonId: lesson.id } },
    create: {
      userId: user.id,
      track,
      lessonId: lesson.id,
      language: persistedLanguage,
      stars,
      bestMoves,
      completed,
      code: savedCode,
    },
    update: {
      language: persistedLanguage,
      stars,
      bestMoves,
      completed,
      ...(savedCode != null ? { code: savedCode } : {}),
    },
  });

  return NextResponse.json(
    {
      ok: true,
      outcome: { won: result.won, stars: result.stars, message: result.message },
      line,
      finalFen: result.finalFen,
      // For multi-turn programming lessons: the moves the student's program has
      // chosen so far (the `history` to send back next turn), the position the
      // program ran against, and whether the lesson is finished.
      history: track === "programming" ? playerMoves : [],
      liveFen,
      done: track === "programming" ? done : true,
      best: { stars, bestMoves, completed },
      stdout: stdout.slice(0, 4000),
      stderr: stderr.slice(0, 4000),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
