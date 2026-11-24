/**
 * Leou Chess — the computer opponent.
 *
 * A negamax search with alpha-beta pruning, a quiescence pass so it does not
 * hang pieces to a capture it cannot see, and classic piece-square tables for
 * positional judgement. It is intentionally small and dependency-free so it can
 * run inside a request without a worker.
 *
 * Four difficulty presets trade depth and time for strength; the two easy ones
 * also add score noise and an occasional deliberate blunder so a beginner is not
 * simply crushed every game.
 */
import {
  BISHOP,
  FLAG_CAPTURE,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  generatePseudoMoves,
  inCheck,
  makeMove,
  moveFlags,
  moveFrom,
  movePromo,
  moveTo,
  moveToUci,
  undoMove,
  type Position,
} from "./engine";
import type { ChessGame } from "./game";

export type Difficulty = "easy" | "medium" | "hard" | "grandmaster";

type Preset = {
  maxDepth: number;
  timeMs: number;
  /** Centipawn noise added to each root move's score — higher is weaker. */
  noise: number;
  /** Chance of throwing the choice to a random legal move entirely. */
  blunder: number;
  label: string;
};

export const DIFFICULTIES: Record<Difficulty, Preset> = {
  easy: { maxDepth: 2, timeMs: 250, noise: 130, blunder: 0.14, label: "Rookie" },
  medium: { maxDepth: 3, timeMs: 500, noise: 45, blunder: 0.03, label: "Challenger" },
  hard: { maxDepth: 4, timeMs: 1100, noise: 12, blunder: 0, label: "Master" },
  grandmaster: { maxDepth: 5, timeMs: 1800, noise: 0, blunder: 0, label: "Grandmaster" },
};

export const MATE = 100_000;

export const DIFFICULTY_IDS: Difficulty[] = ["easy", "medium", "hard", "grandmaster"];

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTY_IDS as string[]).includes(value);
}

const VALUE: Record<number, number> = {
  [PAWN]: 100,
  [KNIGHT]: 320,
  [BISHOP]: 330,
  [ROOK]: 500,
  [QUEEN]: 900,
  [KING]: 20000,
};

// Piece-square tables, written bottom-left (a1) first so the array lines up
// directly with the engine's square indexing. Black reads the same table
// mirrored vertically (`sq ^ 56`).
const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, -20, -20, 10, 10, 5,
  5, -5, -10, 0, 0, -10, -5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, 5, 10, 25, 25, 10, 5, 5,
  10, 10, 20, 30, 30, 20, 10, 10,
  50, 50, 50, 50, 50, 50, 50, 50,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];
const PST_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];
const PST_ROOK = [
  0, 0, 0, 5, 5, 0, 0, 0,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  5, 10, 10, 10, 10, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -10, 5, 5, 5, 5, 5, 0, -10,
  0, 0, 5, 5, 5, 5, 0, -5,
  -5, 0, 5, 5, 5, 5, 0, -5,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];
const PST_KING_MG = [
  20, 30, 10, 0, 0, 10, 30, 20,
  20, 20, 0, 0, 0, 0, 20, 20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
];
const PST_KING_EG = [
  -50, -30, -30, -30, -30, -30, -30, -50,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -50, -40, -30, -20, -20, -30, -40, -50,
];

const PST: Record<number, number[]> = {
  [PAWN]: PST_PAWN,
  [KNIGHT]: PST_KNIGHT,
  [BISHOP]: PST_BISHOP,
  [ROOK]: PST_ROOK,
  [QUEEN]: PST_QUEEN,
};

/** Static evaluation in centipawns, from White's point of view. */
export function evaluate(pos: Position): number {
  const board = pos.board;
  let score = 0;
  let nonPawnMaterial = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  for (let sq = 0; sq < 64; sq++) {
    const code = board[sq];
    if (!code) continue;
    const type = Math.abs(code);
    if (type !== PAWN && type !== KING) nonPawnMaterial += VALUE[type];
    if (type === BISHOP) {
      if (code > 0) whiteBishops++;
      else blackBishops++;
    }
  }
  const endgame = nonPawnMaterial <= 2200 &&
    (countMaterial(pos, QUEEN) === 0 || nonPawnMaterial <= 1300);
  const kingTable = endgame ? PST_KING_EG : PST_KING_MG;

  for (let sq = 0; sq < 64; sq++) {
    const code = board[sq];
    if (!code) continue;
    const type = Math.abs(code);
    const white = code > 0;
    const table = type === KING ? kingTable : PST[type];
    const index = white ? sq : sq ^ 56;
    const pieceScore = VALUE[type] + table[index];
    score += white ? pieceScore : -pieceScore;
  }

  if (whiteBishops >= 2) score += 30;
  if (blackBishops >= 2) score -= 30;
  return score;
}

function countMaterial(pos: Position, type: number): number {
  let n = 0;
  for (let sq = 0; sq < 64; sq++) if (Math.abs(pos.board[sq]) === type) n++;
  return n;
}

// --- search ----------------------------------------------------------------

type Searcher = {
  nodes: number;
  deadline: number;
  stop: boolean;
};

function moveOrderScore(pos: Position, m: number): number {
  let score = 0;
  const victim = pos.board[moveTo(m)];
  const attacker = pos.board[moveFrom(m)];
  if (victim !== 0) score += 10 * VALUE[Math.abs(victim)] - VALUE[Math.abs(attacker)];
  if (movePromo(m)) score += 800 + movePromo(m);
  return score;
}

function orderMoves(pos: Position, moves: number[]): number[] {
  return moves
    .map((m) => ({ m, s: moveOrderScore(pos, m) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

function quiescence(s: Searcher, pos: Position, alpha: number, beta: number, ply: number): number {
  s.nodes++;
  if ((s.nodes & 1023) === 0 && Date.now() > s.deadline) s.stop = true;
  if (s.stop) return evaluate(pos) * (pos.turn === WHITE ? 1 : -1);

  const stand = evaluate(pos) * (pos.turn === WHITE ? 1 : -1);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;

  const caps = orderMoves(
    pos,
    generatePseudoMoves(pos).filter((m) => (moveFlags(m) & FLAG_CAPTURE) !== 0 || movePromo(m) !== 0)
  );
  for (const m of caps) {
    const us = pos.turn;
    const undo = makeMove(pos, m);
    if (inCheck(pos, us)) {
      undoMove(pos, m, undo);
      continue;
    }
    const score = -quiescence(s, pos, -beta, -alpha, ply + 1);
    undoMove(pos, m, undo);
    if (s.stop) return alpha;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(s: Searcher, pos: Position, depth: number, alpha: number, beta: number, ply: number): number {
  s.nodes++;
  if ((s.nodes & 1023) === 0 && Date.now() > s.deadline) s.stop = true;
  if (s.stop) return evaluate(pos) * (pos.turn === WHITE ? 1 : -1);

  if (depth <= 0) return quiescence(s, pos, alpha, beta, ply);

  const moves = orderMoves(pos, generatePseudoMoves(pos));
  let legalCount = 0;
  let best = -Infinity;
  for (const m of moves) {
    const us = pos.turn;
    const undo = makeMove(pos, m);
    if (inCheck(pos, us)) {
      undoMove(pos, m, undo);
      continue;
    }
    legalCount++;
    const score = -negamax(s, pos, depth - 1, -beta, -alpha, ply + 1);
    undoMove(pos, m, undo);
    if (s.stop) return best === -Infinity ? alpha : best;
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  if (legalCount === 0) return inCheck(pos, pos.turn) ? -MATE + ply : 0;
  return best;
}

export type MoveChoice = {
  move: number;
  uci: string;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
};

/**
 * Pick a move for the side to move. Uses iterative deepening under a time
 * budget so it always returns the best line it completed, even if the clock ran
 * out mid-search.
 */
export function chooseMove(game: ChessGame, difficulty: Difficulty = "medium"): MoveChoice | null {
  const preset = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;
  const pos = game.pos;
  const legalRoot = game.legalMoves();
  if (legalRoot.length === 0) return null;

  const started = Date.now();
  const s: Searcher = { nodes: 0, deadline: started + preset.timeMs, stop: false };

  // A beginner sometimes just plays something; keep it legal, not random-legal.
  if (preset.blunder > 0 && Math.random() < preset.blunder) {
    const move = legalRoot[Math.floor(Math.random() * legalRoot.length)];
    return { move, uci: moveToUci(move), score: 0, depth: 0, nodes: 0, timeMs: Date.now() - started };
  }

  let bestMove = legalRoot[0];
  let bestScore = -Infinity;
  let completedDepth = 0;

  for (let depth = 1; depth <= preset.maxDepth; depth++) {
    let localBest = -Infinity;
    let localBestMove = legalRoot[0];
    let aborted = false;
    // Every root move is searched with a full window so the score we compare is
    // exact — a narrowed window would return bounds, and a noisy comparison of
    // bounds can pick the wrong move. The pruning still happens inside negamax.
    const rootMoves = orderMoves(pos, legalRoot);

    for (const m of rootMoves) {
      const undo = makeMove(pos, m);
      const exact = -negamax(s, pos, depth - 1, -Infinity, Infinity, 1);
      undoMove(pos, m, undo);
      if (s.stop) {
        aborted = true;
        break;
      }
      const score = exact + (preset.noise > 0 ? (Math.random() * 2 - 1) * preset.noise : 0);
      if (score > localBest) {
        localBest = score;
        localBestMove = m;
      }
    }

    if (!aborted) {
      bestMove = localBestMove;
      bestScore = localBest;
      completedDepth = depth;
      if (Math.abs(bestScore) > MATE - 100) break; // found mate; stop early
    }
    if (Date.now() > s.deadline) break;
  }

  return {
    move: bestMove,
    uci: moveToUci(bestMove),
    score: bestScore,
    depth: completedDepth,
    nodes: s.nodes,
    timeMs: Date.now() - started,
  };
}

export function chooseMoveUci(game: ChessGame, difficulty: Difficulty = "medium"): string | null {
  return chooseMove(game, difficulty)?.uci ?? null;
}

/**
 * A deterministic move for the training opponent.
 *
 * The training board animates the opponent's reply in the browser while the
 * judge replays the very same line on the server, so the two must agree
 * exactly. `chooseMove` cannot be used for that: it samples noise and blunders
 * with `Math.random()` and cuts the search off on a wall-clock deadline. This
 * runs a fixed-depth search with no randomness and no clock, so the same
 * position always yields the same move.
 */
export function chooseMoveDeterministic(game: ChessGame, depth = 2): string | null {
  const pos = game.pos;
  const legal = game.legalMoves();
  if (legal.length === 0) return null;
  if (legal.length === 1) return moveToUci(legal[0]);

  const s: Searcher = { nodes: 0, deadline: Number.POSITIVE_INFINITY, stop: false };
  const ordered = orderMoves(pos, legal);
  let best = ordered[0];
  let bestScore = -Infinity;
  for (const m of ordered) {
    const undo = makeMove(pos, m);
    const score = -negamax(s, pos, depth - 1, -Infinity, Infinity, 1);
    undoMove(pos, m, undo);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return moveToUci(best);
}
