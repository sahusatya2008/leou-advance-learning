/**
 * Server-side orchestration for a Leou Chess match.
 *
 * A turn is: run the student's `move(game)` in the sandbox, read the UCI move it
 * printed, apply it (only if it is legal), then — in a computer match — let the
 * built-in engine answer. Both plies are written to the log, so the match can be
 * replayed ply by ply later. The UI never decides anything; it renders whatever
 * this returns.
 */
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { runnerRun } from "@/services/runner";
import { CHESS_MARKER, buildChess, extractChessMove, type ChessPrompt } from "./harness";
import { ChessGame } from "./game";
import { chooseMove, isDifficulty, type Difficulty } from "./ai";
import { START_FEN, WHITE } from "./engine";
import type { GameLanguage } from "@/lib/games/types";
import type { ChessSide, PublicMatch, PublicMove } from "./protocol";

export const RUNNER_LANG: Record<GameLanguage, string> = {
  python: "python",
  javascript: "node",
  java: "java",
  cpp: "cpp",
};

const MAX_CODE = 60_000;
const MAX_SAVED_CODE = 20_000;

export type { ChessSide, PublicMatch, PublicMove } from "./protocol";

/** Build the harness prompt from a FEN — the whole board the student's code sees. */
export function promptFromFen(fen: string): ChessPrompt {
  const g = new ChessGame(fen);
  return {
    fen,
    turn: g.turn() === WHITE ? "w" : "b",
    legal: g.legalUci(),
    pieces: g.pieces().map((p) => ({ square: p.square, piece: p.code })),
    inCheck: g.inCheck(),
  };
}

export function serializeGame(g: ChessGame): { status: string; result: string | null; reason: string | null } {
  const s = g.status();
  if (!s.over) return { status: "ACTIVE", result: null, reason: null };
  const result = s.winner === "white" ? "WHITE" : s.winner === "black" ? "BLACK" : "DRAW";
  return { status: "FINISHED", result, reason: s.reason };
}

type MatchRow = Awaited<ReturnType<typeof loadParticipantMatch>>;

/**
 * A match is visible to its owner and to both seats. The inviter creates the
 * room, so they are always the creator; whoever claims the other seat is a
 * participant even though they never created anything.
 */
async function loadParticipantMatch(userId: string, matchId: string) {
  return prisma.chessMatch.findFirst({
    where: { id: matchId, OR: [{ createdById: userId }, { whiteId: userId }, { blackId: userId }] },
    include: { moves: { orderBy: { ply: "asc" } } },
  });
}

export function participantColor(
  match: { whiteId: string | null; blackId: string | null },
  userId: string
): ChessSide | null {
  if (match.whiteId === userId) return "white";
  if (match.blackId === userId) return "black";
  return null;
}

/** A shareable, unguessable slug for the invite link. */
export function newInviteToken(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export function toPublicMatch(match: NonNullable<MatchRow>): PublicMatch {
  const g = new ChessGame(match.fen);
  return {
    id: match.id,
    mode: match.mode,
    status: match.status,
    difficulty: match.difficulty,
    language: match.language,
    fen: match.fen,
    turn: g.turnName(),
    result: match.result,
    reason: match.reason,
    plyCount: match.plyCount,
    whiteCode: match.whiteCode,
    blackCode: match.blackCode,
    inviteToken: match.inviteToken,
    seatsFilled: { white: match.whiteId != null, black: match.blackId != null },
    finished: match.status !== "ACTIVE",
    moves: match.moves.map((m) => ({
      ply: m.ply,
      color: m.color === "b" ? "b" : "w",
      uci: m.uci,
      san: m.san,
      fen: m.fen,
      ai: m.language == null,
      thinkMs: m.thinkMs,
    })),
  };
}

type PersistMove = {
  ply: number;
  color: "w" | "b";
  uci: string;
  san: string;
  fen: string;
  code: string | null;
  language: string | null;
  thinkMs: number | null;
};

async function persist(matchId: string, fields: {
  fen: string;
  plyCount: number;
  status: string;
  result: string | null;
  reason: string | null;
  finishedAt: Date | null;
  whiteCode?: string | null;
  blackCode?: string | null;
}, moves: PersistMove[]) {
  await prisma.$transaction([
    prisma.chessMatch.update({ where: { id: matchId }, data: fields }),
    ...moves.map((m) => prisma.chessMove.create({ data: { matchId, ...m } })),
  ]);
}

/** Create a fresh vs-computer match. If the human plays black, the engine opens. */
export async function createComputerMatch(
  userId: string,
  opts: { difficulty: string; language: GameLanguage; color: ChessSide }
): Promise<string> {
  const difficulty: Difficulty = isDifficulty(opts.difficulty) ? opts.difficulty : "medium";
  const humanIsWhite = opts.color !== "black";
  const match = await prisma.chessMatch.create({
    data: {
      mode: "COMPUTER",
      status: "ACTIVE",
      difficulty,
      language: opts.language,
      createdById: userId,
      whiteId: humanIsWhite ? userId : null,
      blackId: humanIsWhite ? null : userId,
      fen: START_FEN,
      plyCount: 0,
    },
  });

  if (!humanIsWhite) {
    const g = new ChessGame(START_FEN);
    const started = Date.now();
    const best = chooseMove(g, difficulty);
    if (best?.uci) {
      const played = g.move(best.uci, Date.now() - started);
      if (played) {
        const after = serializeGame(g);
        await persist(
          match.id,
          {
            fen: g.fen(),
            plyCount: 1,
            status: after.status,
            result: after.result,
            reason: after.reason,
            finishedAt: after.status === "FINISHED" ? new Date() : null,
          },
          [{ ply: 1, color: "w", uci: played.uci, san: played.san, fen: played.fen, code: null, language: null, thinkMs: played.timeMs ?? null }]
        );
      }
    }
  }
  return match.id;
}

export type SubmitResult =
  | { ok: true; match: PublicMatch; humanMove: PublicMove; aiMove: PublicMove | null; stdout: string; stderr: string }
  | { ok: false; illegal: boolean; error: string; stdout: string; stderr: string };

/**
 * Open a room and issue the invitation. The inviter takes one color; the other
 * seat stays empty until a friend claims it through the invite link. Only the
 * shareable token is needed to claim it, so an invited friend never has to be
 * enrolled first — but opening rooms (an invite you initiate) is a paid feature,
 * which the route enforces.
 */
export async function createMultiplayerMatch(
  userId: string,
  opts: { language: GameLanguage; color: ChessSide }
): Promise<{ id: string; inviteToken: string }> {
  const hostIsWhite = opts.color === "white";
  const inviteToken = newInviteToken();
  const match = await prisma.chessMatch.create({
    data: {
      mode: "MULTIPLAYER",
      status: "ACTIVE",
      language: opts.language,
      createdById: userId,
      whiteId: hostIsWhite ? userId : null,
      blackId: hostIsWhite ? null : userId,
      fen: START_FEN,
      plyCount: 0,
      inviteToken,
    },
  });
  return { id: match.id, inviteToken };
}

export type ClaimResult =
  | { ok: true; matchId: string; color: ChessSide }
  | { ok: false; error: string };

/**
 * Take the open seat of an invited match. The conditional `updateMany` is what
 * makes this safe: two friends clicking the link at the same moment cannot both
 * claim the same color, because the second update matches zero rows.
 */
export async function claimInviteSeat(matchId: string, userId: string): Promise<ClaimResult> {
  const match = await prisma.chessMatch.findFirst({
    where: { id: matchId, mode: "MULTIPLAYER" },
    select: { id: true, status: true, whiteId: true, blackId: true },
  });
  if (!match) return { ok: false, error: "That invitation link is not valid." };
  if (match.status !== "ACTIVE") return { ok: false, error: "That game is already over." };

  const already = participantColor(match, userId);
  if (already) return { ok: true, matchId, color: already };

  const seatColumn = match.whiteId == null ? "whiteId" : match.blackId == null ? "blackId" : null;
  if (!seatColumn) return { ok: false, error: "Both seats are already taken — the game has started." };

  const claimed = await prisma.chessMatch.updateMany({
    where: { id: matchId, status: "ACTIVE", [seatColumn]: null },
    data: { [seatColumn]: userId },
  });
  if (claimed.count === 0) return { ok: false, error: "Someone claimed that seat a moment ago." };

  return { ok: true, matchId, color: seatColumn === "whiteId" ? "white" : "black" };
}

/** Run the student's program for the side to move and advance the match. */
export async function submitHumanMove(
  userId: string,
  matchId: string,
  code: string,
  language: GameLanguage
): Promise<SubmitResult> {
  const match = await loadParticipantMatch(userId, matchId);
  if (!match) return { ok: false, illegal: false, error: "Match not found.", stdout: "", stderr: "" };
  if (match.status !== "ACTIVE") return { ok: false, illegal: false, error: "This game is already over.", stdout: "", stderr: "" };
  if (code.length > MAX_CODE) return { ok: false, illegal: false, error: "That program is too large.", stdout: "", stderr: "" };

  const myColor = participantColor(match, userId);
  if (!myColor) return { ok: false, illegal: false, error: "You are not in this game.", stdout: "", stderr: "" };

  const g = new ChessGame(match.fen);
  const prompt = promptFromFen(match.fen);
  const turnColor: ChessSide = g.turn() === WHITE ? "white" : "black";
  if (turnColor !== myColor) {
    return { ok: false, illegal: false, error: "It is not your turn yet — wait for your opponent.", stdout: "", stderr: "" };
  }
  // Nobody may move into an empty room: the game starts with both seats filled,
  // so a waiting host cannot play the first move alone.
  if (match.mode === "MULTIPLAYER" && (match.whiteId == null || match.blackId == null)) {
    return { ok: false, illegal: false, error: "Your opponent has not joined yet. Share your invite link and wait.", stdout: "", stderr: "" };
  }
  const humanColor: "w" | "b" = myColor === "white" ? "w" : "b";

  let stdout = "";
  let stderr = "";
  let thinkMs = 0;
  try {
    const program = buildChess(language, prompt, code);
    const t0 = Date.now();
    const res = await runnerRun(RUNNER_LANG[language], program, "");
    thinkMs = Date.now() - t0;
    stdout = res.stdout;
    stderr = res.stderr;
  } catch (e) {
    const err = e as Error;
    return { ok: false, illegal: false, error: err.message, stdout, stderr };
  }

  const chosen = extractChessMove(stdout);
  const cleanChosen = (chosen ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const played = cleanChosen ? g.move(cleanChosen, thinkMs) : null;
  if (!played) {
    const shown = chosen && chosen.trim() ? `"${chosen.trim()}"` : "(nothing)";
    return {
      ok: false,
      illegal: true,
      error: `Your program returned ${shown}, which is not a legal move. Legal moves: ${prompt.legal.slice(0, 8).join(", ")}${prompt.legal.length > 8 ? " …" : ""}`,
      stdout,
      stderr,
    };
  }

  const newMoves: PersistMove[] = [
    { ply: match.plyCount + 1, color: humanColor, uci: played.uci, san: played.san, fen: played.fen, code: code.slice(0, MAX_SAVED_CODE), language, thinkMs },
  ];
  const humanPublic: PublicMove = { ply: match.plyCount + 1, color: humanColor, uci: played.uci, san: played.san, fen: played.fen, ai: false, thinkMs };

  let aiPublic: PublicMove | null = null;
  let after = serializeGame(g);

  // The engine answers only while the game is still live.
  if (after.status === "ACTIVE" && match.mode === "COMPUTER") {
    const difficulty: Difficulty = isDifficulty(match.difficulty ?? "") ? (match.difficulty as Difficulty) : "medium";
    const t0 = Date.now();
    const best = chooseMove(g, difficulty);
    if (best?.uci) {
      const reply = g.move(best.uci, Date.now() - t0);
      if (reply) {
        const ply = match.plyCount + 2;
        newMoves.push({ ply, color: humanColor === "w" ? "b" : "w", uci: reply.uci, san: reply.san, fen: reply.fen, code: null, language: null, thinkMs: reply.timeMs ?? null });
        aiPublic = { ply, color: humanColor === "w" ? "b" : "w", uci: reply.uci, san: reply.san, fen: reply.fen, ai: true, thinkMs: reply.timeMs ?? null };
        after = serializeGame(g);
      }
    }
  }

  const codeField = humanColor === "w" ? { whiteCode: code.slice(0, MAX_SAVED_CODE) } : { blackCode: code.slice(0, MAX_SAVED_CODE) };
  await persist(
    matchId,
    {
      fen: g.fen(),
      plyCount: match.plyCount + newMoves.length,
      status: after.status,
      result: after.result,
      reason: after.reason,
      finishedAt: after.status === "FINISHED" ? new Date() : null,
      ...codeField,
    },
    newMoves
  );

  const fresh = await loadParticipantMatch(userId, matchId);
  return { ok: true, match: toPublicMatch(fresh!), humanMove: humanPublic, aiMove: aiPublic, stdout, stderr };
}

export { CHESS_MARKER };
