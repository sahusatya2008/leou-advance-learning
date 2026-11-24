/**
 * Leou Chess — a self-contained chess rules engine.
 *
 * This module is the single source of truth for legal chess: board state, FEN,
 * move generation (including castling, en passant and promotion), check /
 * checkmate / stalemate / draw detection, and UCI + SAN notation. It is pure and
 * dependency-free, so the *same* code runs on the server (which is authoritative
 * and scores the game) and on the client (which animates it). The two can never
 * disagree about what happened, because there is only one implementation.
 *
 * Representation
 * --------------
 * Squares are `0..63` in "little-endian rank-file" order:
 *
 *     index = rank * 8 + file      (file 0 = 'a', rank 0 = '1')
 *     a1 = 0, h1 = 7, a8 = 56, h8 = 63
 *
 * A piece is a signed small integer: the sign is the colour (+ white, − black)
 * and the magnitude is the type:
 *
 *     1 = pawn   2 = knight   3 = bishop   4 = rook   5 = queen   6 = king
 *
 * A move is packed into one integer so move lists stay cheap to copy:
 *
 *     bits  0..5   from square
 *     bits  6..11  to square
 *     bits 12..14  promotion piece (0 none, 1=N, 2=B, 3=R, 4=Q)
 *     bits 15..19  flags (CAPTURE, DOUBLE, EP, CASTLE)
 */

export type Color = 1 | -1;

export const WHITE: Color = 1;
export const BLACK: Color = -1;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const FLAG_CAPTURE = 1;
export const FLAG_DOUBLE = 2;
export const FLAG_EP = 4;
export const FLAG_CASTLE = 8;

export const CASTLE_WK = 1;
export const CASTLE_WQ = 2;
export const CASTLE_BK = 4;
export const CASTLE_BQ = 8;

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// --- geometry tables -------------------------------------------------------

const KNIGHT_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

const KING_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

const BISHOP_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const ROOK_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/**
 * A per-square bitwise-AND mask applied to the castling rights whenever a piece
 * leaves or lands on that square. Rook and king squares clear the relevant
 * rights; every other square keeps all four bits.
 */
const CASTLE_AND = new Int8Array(64).fill(0b1111);
{
  const clr = (sq: number, bits: number) => {
    CASTLE_AND[sq] &= ~bits & 0b1111;
  };
  clr(0, CASTLE_WQ); // a1 rook
  clr(7, CASTLE_WK); // h1 rook
  clr(4, CASTLE_WK | CASTLE_WQ); // e1 king
  clr(56, CASTLE_BQ); // a8 rook
  clr(63, CASTLE_BK); // h8 rook
  clr(60, CASTLE_BK | CASTLE_BQ); // e8 king
}

// --- square helpers --------------------------------------------------------

export function fileOf(sq: number): number {
  return sq & 7;
}
export function rankOf(sq: number): number {
  return sq >> 3;
}
export function square(file: number, rank: number): number {
  return rank * 8 + file;
}
export function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file <= 7 && rank >= 0 && rank <= 7;
}
export function squareName(sq: number): string {
  return String.fromCharCode(97 + fileOf(sq)) + String(rankOf(sq) + 1);
}
export function parseSquare(name: string): number {
  if (name.length < 2) return -1;
  const file = name.charCodeAt(0) - 97;
  const rank = name.charCodeAt(1) - 49;
  if (!onBoard(file, rank)) return -1;
  return square(file, rank);
}
/** FEN-style single-character name for a piece code, or "." for an empty square. */
export function pieceName(code: number): string {
  if (code === 0) return ".";
  const letter = " PNBRQK"[Math.abs(code)];
  return code < 0 ? letter.toLowerCase() : letter;
}

// --- move encoding ---------------------------------------------------------

export function encodeMove(from: number, to: number, promo = 0, flags = 0): number {
  return from | (to << 6) | (promo << 12) | (flags << 15);
}
export function moveFrom(m: number): number {
  return m & 63;
}
export function moveTo(m: number): number {
  return (m >> 6) & 63;
}
export function movePromo(m: number): number {
  return (m >> 12) & 7;
}
export function moveFlags(m: number): number {
  return (m >> 15) & 31;
}

const PROMO_LETTER = ["", "n", "b", "r", "q"];
const PROMO_CHAR = ["", "N", "B", "R", "Q"];

export function moveToUci(m: number): string {
  const promo = movePromo(m);
  return squareName(moveFrom(m)) + squareName(moveTo(m)) + (promo ? PROMO_LETTER[promo] : "");
}

// --- position --------------------------------------------------------------

export type Position = {
  board: Int8Array;
  turn: Color;
  castling: number;
  ep: number; // -1 or destination square for an en-passant capture
  halfmove: number;
  fullmove: number;
  kingSq: Record<"1" | "-1", number>;
};

export function startPosition(): Position {
  return parseFen(START_FEN);
}

export function clonePosition(p: Position): Position {
  return {
    board: p.board.slice(),
    turn: p.turn,
    castling: p.castling,
    ep: p.ep,
    halfmove: p.halfmove,
    fullmove: p.fullmove,
    kingSq: { "1": p.kingSq["1"], "-1": p.kingSq["-1"] },
  };
}

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  const board = new Int8Array(64);
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error(`Bad FEN board: ${fen}`);
  for (let r = 0; r < 8; r++) {
    const row = rows[r];
    const rank = 7 - r; // first FEN row is rank 8
    let file = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        file += ch.charCodeAt(0) - 48;
      } else {
        const idx = " PNBRQK".indexOf(ch.toUpperCase());
        if (idx <= 0) throw new Error(`Bad FEN piece '${ch}' in ${fen}`);
        if (file > 7) throw new Error(`Bad FEN row overflow: ${fen}`);
        board[square(file, rank)] = ch === ch.toUpperCase() ? idx : -idx;
        file++;
      }
    }
  }
  const turn: Color = parts[1] === "b" ? BLACK : WHITE;
  let castling = 0;
  if (parts[2] && parts[2] !== "-") {
    if (parts[2].includes("K")) castling |= CASTLE_WK;
    if (parts[2].includes("Q")) castling |= CASTLE_WQ;
    if (parts[2].includes("k")) castling |= CASTLE_BK;
    if (parts[2].includes("q")) castling |= CASTLE_BQ;
  }
  const ep = parts[3] && parts[3] !== "-" ? parseSquare(parts[3]) : -1;
  const halfmove = parts[4] ? Number(parts[4]) : 0;
  const fullmove = parts[5] ? Number(parts[5]) : 1;

  const kingSq: Record<"1" | "-1", number> = { "1": -1, "-1": -1 };
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq] === KING) kingSq["1"] = sq;
    else if (board[sq] === -KING) kingSq["-1"] = sq;
  }
  return { board, turn, castling, ep, halfmove, fullmove, kingSq };
}

export function toFen(p: Position): string {
  let boardFen = "";
  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const code = p.board[square(file, rank)];
      if (code === 0) {
        empty++;
      } else {
        if (empty) {
          boardFen += String(empty);
          empty = 0;
        }
        const letter = " PNBRQK"[Math.abs(code)];
        boardFen += code < 0 ? letter.toLowerCase() : letter;
      }
    }
    if (empty) boardFen += String(empty);
    if (rank > 0) boardFen += "/";
  }
  let castling = "";
  if (p.castling & CASTLE_WK) castling += "K";
  if (p.castling & CASTLE_WQ) castling += "Q";
  if (p.castling & CASTLE_BK) castling += "k";
  if (p.castling & CASTLE_BQ) castling += "q";
  if (!castling) castling = "-";
  const ep = p.ep >= 0 ? squareName(p.ep) : "-";
  return `${boardFen} ${p.turn === WHITE ? "w" : "b"} ${castling} ${ep} ${p.halfmove} ${p.fullmove}`;
}

/** The position key used for threefold repetition: everything but the clocks. */
export function positionKey(p: Position): string {
  return toFen(p).split(" ").slice(0, 4).join(" ");
}

// --- attack detection ------------------------------------------------------

export function isAttacked(board: Int8Array, sq: number, by: Color): boolean {
  const f = fileOf(sq);
  const r = rankOf(sq);

  // Pawns. A white pawn on (f±1, r-1) attacks us; black mirrors downward.
  if (by === WHITE) {
    if (r - 1 >= 0) {
      if (f - 1 >= 0 && board[square(f - 1, r - 1)] === PAWN) return true;
      if (f + 1 <= 7 && board[square(f + 1, r - 1)] === PAWN) return true;
    }
  } else {
    if (r + 1 <= 7) {
      if (f - 1 >= 0 && board[square(f - 1, r + 1)] === -PAWN) return true;
      if (f + 1 <= 7 && board[square(f + 1, r + 1)] === -PAWN) return true;
    }
  }

  // Knights.
  const knight = KNIGHT * by;
  for (const [df, dr] of KNIGHT_DELTAS) {
    const nf = f + df;
    const nr = r + dr;
    if (onBoard(nf, nr) && board[square(nf, nr)] === knight) return true;
  }

  // King.
  const king = KING * by;
  for (const [df, dr] of KING_DELTAS) {
    const nf = f + df;
    const nr = r + dr;
    if (onBoard(nf, nr) && board[square(nf, nr)] === king) return true;
  }

  // Sliding pieces — walk outward until the first piece blocks the ray.
  const rook = ROOK * by;
  const queen = QUEEN * by;
  for (const [df, dr] of ROOK_DIRS) {
    let nf = f + df;
    let nr = r + dr;
    while (onBoard(nf, nr)) {
      const code = board[square(nf, nr)];
      if (code !== 0) {
        if (code === rook || code === queen) return true;
        break;
      }
      nf += df;
      nr += dr;
    }
  }
  const bishop = BISHOP * by;
  for (const [df, dr] of BISHOP_DIRS) {
    let nf = f + df;
    let nr = r + dr;
    while (onBoard(nf, nr)) {
      const code = board[square(nf, nr)];
      if (code !== 0) {
        if (code === bishop || code === queen) return true;
        break;
      }
      nf += df;
      nr += dr;
    }
  }
  return false;
}

export function inCheck(p: Position, color: Color = p.turn): boolean {
  const k = p.kingSq[String(color) as "1" | "-1"];
  if (k < 0) return false;
  return isAttacked(p.board, k, color === WHITE ? BLACK : WHITE);
}

// --- move generation -------------------------------------------------------

/** Pseudo-legal moves for the side to move (the king may be left in check). */
export function generatePseudoMoves(p: Position): number[] {
  const moves: number[] = [];
  const us = p.turn;
  const them: Color = us === WHITE ? BLACK : WHITE;
  const board = p.board;

  const push = (from: number, to: number, promo = 0, flags = 0) => {
    moves.push(encodeMove(from, to, promo, flags));
  };

  for (let from = 0; from < 64; from++) {
    const code = board[from];
    if (code === 0 || Math.sign(code) !== us) continue;
    const type = Math.abs(code);
    const f = fileOf(from);
    const r = rankOf(from);

    if (type === PAWN) {
      const forward = us === WHITE ? 8 : -8;
      const startRank = us === WHITE ? 1 : 6;
      const promoRank = us === WHITE ? 7 : 0;
      const one = from + forward;
      if (one >= 0 && one < 64 && board[one] === 0) {
        if (rankOf(one) === promoRank) {
          for (let promo = 1; promo <= 4; promo++) push(from, one, promo);
        } else {
          push(from, one);
          if (r === startRank) {
            const two = one + forward;
            if (board[two] === 0) push(from, two, 0, FLAG_DOUBLE);
          }
        }
      }
      // Captures. White captures to (f±1, r+1); black to (f±1, r-1).
      const capRank = r + (us === WHITE ? 1 : -1);
      if (capRank >= 0 && capRank <= 7) {
        for (const capFile of [f - 1, f + 1]) {
          if (capFile < 0 || capFile > 7) continue;
          const to = square(capFile, capRank);
          const target = board[to];
          if (target !== 0 && Math.sign(target) === them) {
            if (rankOf(to) === promoRank) {
              for (let promo = 1; promo <= 4; promo++) push(from, to, promo, FLAG_CAPTURE);
            } else {
              push(from, to, 0, FLAG_CAPTURE);
            }
          } else if (target === 0 && to === p.ep && p.ep >= 0) {
            push(from, to, 0, FLAG_CAPTURE | FLAG_EP);
          }
        }
      }
      continue;
    }

    if (type === KNIGHT) {
      for (const [df, dr] of KNIGHT_DELTAS) {
        const nf = f + df;
        const nr = r + dr;
        if (!onBoard(nf, nr)) continue;
        const to = square(nf, nr);
        const target = board[to];
        if (target === 0) push(from, to);
        else if (Math.sign(target) === them) push(from, to, 0, FLAG_CAPTURE);
      }
      continue;
    }

    if (type === KING) {
      for (const [df, dr] of KING_DELTAS) {
        const nf = f + df;
        const nr = r + dr;
        if (!onBoard(nf, nr)) continue;
        const to = square(nf, nr);
        const target = board[to];
        if (target === 0) push(from, to);
        else if (Math.sign(target) === them) push(from, to, 0, FLAG_CAPTURE);
      }
      // Castling: rights present, path empty, king not in / through / into check.
      const opp: Color = us === WHITE ? BLACK : WHITE;
      if (us === WHITE && from === 4) {
        if ((p.castling & CASTLE_WK) && board[5] === 0 && board[6] === 0 &&
            !isAttacked(board, 4, opp) && !isAttacked(board, 5, opp) && !isAttacked(board, 6, opp)) {
          push(4, 6, 0, FLAG_CASTLE);
        }
        if ((p.castling & CASTLE_WQ) && board[3] === 0 && board[2] === 0 && board[1] === 0 &&
            !isAttacked(board, 4, opp) && !isAttacked(board, 3, opp) && !isAttacked(board, 2, opp)) {
          push(4, 2, 0, FLAG_CASTLE);
        }
      } else if (us === BLACK && from === 60) {
        if ((p.castling & CASTLE_BK) && board[61] === 0 && board[62] === 0 &&
            !isAttacked(board, 60, opp) && !isAttacked(board, 61, opp) && !isAttacked(board, 62, opp)) {
          push(60, 62, 0, FLAG_CASTLE);
        }
        if ((p.castling & CASTLE_BQ) && board[59] === 0 && board[58] === 0 && board[57] === 0 &&
            !isAttacked(board, 60, opp) && !isAttacked(board, 59, opp) && !isAttacked(board, 58, opp)) {
          push(60, 58, 0, FLAG_CASTLE);
        }
      }
      continue;
    }

    // Sliding: bishop, rook, queen.
    const dirs: ReadonlyArray<readonly [number, number]> =
      type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
    for (const [df, dr] of dirs) {
      let nf = f + df;
      let nr = r + dr;
      while (onBoard(nf, nr)) {
        const to = square(nf, nr);
        const target = board[to];
        if (target === 0) {
          push(from, to);
        } else {
          if (Math.sign(target) === them) push(from, to, 0, FLAG_CAPTURE);
          break;
        }
        nf += df;
        nr += dr;
      }
    }
  }

  return moves;
}

type Undo = {
  captured: number;
  capturedSq: number;
  castling: number;
  ep: number;
  halfmove: number;
  moved: number;
  us: Color;
};

export function makeMove(p: Position, move: number): Undo {
  const from = moveFrom(move);
  const to = moveTo(move);
  const promo = movePromo(move);
  const flags = moveFlags(move);
  const us = p.turn;
  const moved = p.board[from];
  const undo: Undo = {
    captured: 0,
    capturedSq: -1,
    castling: p.castling,
    ep: p.ep,
    halfmove: p.halfmove,
    moved,
    us,
  };

  p.halfmove++;
  p.ep = -1;

  if (flags & FLAG_EP) {
    const capSq = us === WHITE ? to - 8 : to + 8;
    undo.captured = p.board[capSq];
    undo.capturedSq = capSq;
    p.board[capSq] = 0;
    p.halfmove = 0;
  } else if (p.board[to] !== 0) {
    undo.captured = p.board[to];
    undo.capturedSq = to;
    p.halfmove = 0;
  }

  p.board[to] = promo ? (promo + 1) * us : moved;
  p.board[from] = 0;
  if (Math.abs(moved) === KING) p.kingSq[us === WHITE ? "1" : "-1"] = to;

  if (flags & FLAG_DOUBLE) p.ep = us === WHITE ? from + 8 : from - 8;

  if (flags & FLAG_CASTLE) {
    if (to > from) {
      // king side: rook h->f
      p.board[from + 1] = p.board[from + 3];
      p.board[from + 3] = 0;
    } else {
      // queen side: rook a->d
      p.board[from - 1] = p.board[from - 4];
      p.board[from - 4] = 0;
    }
  }

  if (Math.abs(moved) === PAWN) p.halfmove = 0;

  p.castling &= CASTLE_AND[from] & CASTLE_AND[to];
  p.turn = (us === WHITE ? BLACK : WHITE) as Color;
  if (us === BLACK) p.fullmove++;
  return undo;
}

export function undoMove(p: Position, move: number, undo: Undo): void {
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const us = undo.us;

  p.board[from] = undo.moved;
  p.board[to] = 0;
  if (undo.captured) p.board[undo.capturedSq] = undo.captured;
  if (Math.abs(undo.moved) === KING) p.kingSq[us === WHITE ? "1" : "-1"] = from;

  if (flags & FLAG_CASTLE) {
    if (to > from) {
      p.board[from + 3] = p.board[from + 1];
      p.board[from + 1] = 0;
    } else {
      p.board[from - 4] = p.board[from - 1];
      p.board[from - 1] = 0;
    }
  }

  p.castling = undo.castling;
  p.ep = undo.ep;
  p.halfmove = undo.halfmove;
  p.turn = us;
  if (us === BLACK) p.fullmove--;
}

/** Fully legal moves for the side to move. */
export function generateLegalMoves(p: Position): number[] {
  const legal: number[] = [];
  const us = p.turn;
  for (const move of generatePseudoMoves(p)) {
    const undo = makeMove(p, move);
    if (!inCheck(p, us)) legal.push(move);
    undoMove(p, move, undo);
  }
  return legal;
}

export function perft(p: Position, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of generatePseudoMoves(p)) {
    const undo = makeMove(p, move);
    if (!inCheck(p, p.turn === WHITE ? BLACK : WHITE)) {
      nodes += perft(p, depth - 1);
    }
    undoMove(p, move, undo);
  }
  return nodes;
}

// --- SAN -------------------------------------------------------------------

/** Convert a legal move to Standard Algebraic Notation. Requires the position
 *  *before* the move is played. */
export function toSan(p: Position, move: number): string {
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const promo = movePromo(move);
  const piece = p.board[from];
  const type = Math.abs(piece);

  if (flags & FLAG_CASTLE) {
    const san = to > from ? "O-O" : "O-O-O";
    return san + checkSuffix(p, move);
  }

  let san = "";
  if (type === PAWN) {
    if (flags & FLAG_CAPTURE) san += String.fromCharCode(97 + fileOf(from)) + "x";
    san += squareName(to);
    if (promo) san += "=" + PROMO_CHAR[promo];
  } else {
    san += " PNBRQK"[type];
    // Disambiguate against other legal moves of the same piece type to `to`.
    const others = generateLegalMoves(p).filter(
      (m) => m !== move && moveTo(m) === to && Math.abs(p.board[moveFrom(m)]) === type
    );
    if (others.length) {
      const sameFile = others.some((m) => fileOf(moveFrom(m)) === fileOf(from));
      const sameRank = others.some((m) => rankOf(moveFrom(m)) === rankOf(from));
      if (!sameFile) san += String.fromCharCode(97 + fileOf(from));
      else if (!sameRank) san += String(rankOf(from) + 1);
      else san += squareName(from);
    }
    if (flags & FLAG_CAPTURE) san += "x";
    san += squareName(to);
  }
  return san + checkSuffix(p, move);
}

function checkSuffix(p: Position, move: number): string {
  const undo = makeMove(p, move);
  let suffix = "";
  if (inCheck(p, p.turn)) {
    suffix = generateLegalMoves(p).length === 0 ? "#" : "+";
  }
  undoMove(p, move, undo);
  return suffix;
}
