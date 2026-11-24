/**
 * A stateful chess game on top of the pure engine: move history, SAN/UCI
 * notation, draw detection and a single `status()` that both the rules layer and
 * the UI read from.
 */
import {
  BISHOP,
  BLACK,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  START_FEN,
  WHITE,
  clonePosition,
  encodeMove,
  generateLegalMoves,
  inCheck,
  makeMove,
  moveFrom,
  movePromo,
  moveTo,
  moveToUci,
  parseFen,
  parseSquare,
  pieceName,
  positionKey,
  squareName,
  toFen,
  toSan,
  undoMove,
  type Color,
  type Position,
} from "./engine";

export type GameState =
  | "playing"
  | "checkmate"
  | "stalemate"
  | "draw-insufficient"
  | "draw-fifty"
  | "draw-repetition";

export type GameStatus = {
  state: GameState;
  over: boolean;
  /** "white" | "black" | null (draw or still playing). */
  winner: "white" | "black" | null;
  /** A short human sentence for the UI. */
  reason: string;
  inCheck: boolean;
};

export type PlyRecord = {
  uci: string;
  san: string;
  /** FEN *after* the move. */
  fen: string;
  color: Color;
  /** Milliseconds spent choosing this move, when known. */
  timeMs?: number;
};

type UndoRecord = {
  move: number;
  undo: ReturnType<typeof makeMove>;
  keyBefore: string;
};

const PIECE_WORDS: Record<number, string> = {
  [PAWN]: "pawn",
  [KNIGHT]: "knight",
  [BISHOP]: "bishop",
  [ROOK]: "rook",
  [QUEEN]: "queen",
  [KING]: "king",
};

export class ChessGame {
  pos: Position;
  history: PlyRecord[] = [];
  private undoStack: UndoRecord[] = [];
  private keys: string[] = [];

  constructor(fen: string = START_FEN) {
    this.pos = parseFen(fen);
    this.keys = [positionKey(this.pos)];
  }

  clone(): ChessGame {
    const g = new ChessGame();
    g.pos = clonePosition(this.pos);
    g.history = this.history.map((h) => ({ ...h }));
    g.keys = [...this.keys];
    g.undoStack = this.undoStack.map((u) => ({ ...u }));
    return g;
  }

  /** Load a position, discarding any history. */
  load(fen: string): void {
    this.pos = parseFen(fen);
    this.history = [];
    this.undoStack = [];
    this.keys = [positionKey(this.pos)];
  }

  fen(): string {
    return toFen(this.pos);
  }

  turn(): Color {
    return this.pos.turn;
  }

  turnName(): "white" | "black" {
    return this.pos.turn === WHITE ? "white" : "black";
  }

  legalMoves(): number[] {
    return generateLegalMoves(this.pos);
  }

  legalUci(): string[] {
    return this.legalMoves().map(moveToUci);
  }

  inCheck(): boolean {
    return inCheck(this.pos, this.pos.turn);
  }

  /** Find the encoded legal move for a UCI string like "e2e4" / "e7e8q". */
  findMove(uci: string): number | null {
    const clean = uci.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean.length < 4) return null;
    const from = parseSquare(clean.slice(0, 2));
    const to = parseSquare(clean.slice(2, 4));
    const promoChar = clean[4];
    if (from < 0 || to < 0) return null;
    const promo = promoChar ? { n: 1, b: 2, r: 3, q: 4 }[promoChar as "n" | "b" | "r" | "q"] ?? 0 : 0;
    for (const m of this.legalMoves()) {
      if (moveFrom(m) === from && moveTo(m) === to && movePromo(m) === promo) return m;
    }
    return null;
  }

  /** Parse a move in UCI ("e2e4") or SAN ("Nf3") form. */
  parseMove(input: string): number | null {
    const direct = this.findMove(input);
    if (direct != null) return direct;
    const san = input.trim();
    for (const m of this.legalMoves()) {
      if (toSan(this.pos, m) === san || toSan(this.pos, m) === san.replace(/[+#]$/, "")) return m;
    }
    return null;
  }

  /** Apply a legal move. Returns the recorded ply, or null if illegal. */
  move(uci: string, timeMs?: number): PlyRecord | null {
    const m = typeof uci === "string" ? this.findMove(uci) : null;
    if (m == null) return null;
    return this.applyEncoded(m, timeMs);
  }

  applyEncoded(m: number, timeMs?: number): PlyRecord | null {
    const legal = this.legalMoves();
    if (!legal.includes(m)) return null;
    const color = this.pos.turn;
    const san = toSan(this.pos, m);
    const keyBefore = this.keys[this.keys.length - 1];
    const undo = makeMove(this.pos, m);
    this.undoStack.push({ move: m, undo, keyBefore });
    const fen = this.fen();
    this.keys.push(positionKey(this.pos));
    const ply: PlyRecord = { uci: moveToUci(m), san, fen, color, timeMs };
    this.history.push(ply);
    return ply;
  }

  /** Take back the last ply, if any. */
  undo(): PlyRecord | null {
    const last = this.undoStack.pop();
    if (!last) return null;
    undoMove(this.pos, last.move, last.undo);
    this.keys.pop();
    return this.history.pop() ?? null;
  }

  isRepetition(): boolean {
    const key = this.keys[this.keys.length - 1];
    let count = 0;
    for (const k of this.keys) if (k === key) count++;
    return count >= 3;
  }

  status(): GameStatus {
    const legal = this.legalMoves();
    const checked = this.inCheck();
    const side = this.turnName();

    if (legal.length === 0) {
      if (checked) {
        const winner = side === "white" ? "black" : "white";
        return { state: "checkmate", over: true, winner, reason: `Checkmate — ${winner} wins.`, inCheck: true };
      }
      return { state: "stalemate", over: true, winner: null, reason: "Stalemate — the game is a draw.", inCheck: false };
    }
    if (this.pos.halfmove >= 100) {
      return { state: "draw-fifty", over: true, winner: null, reason: "Draw — fifty moves without a capture or pawn move.", inCheck: checked };
    }
    if (this.isRepetition()) {
      return { state: "draw-repetition", over: true, winner: null, reason: "Draw — the same position occurred three times.", inCheck: checked };
    }
    if (this.insufficient()) {
      return { state: "draw-insufficient", over: true, winner: null, reason: "Draw — not enough material to checkmate.", inCheck: checked };
    }
    return {
      state: "playing",
      over: false,
      winner: null,
      reason: checked ? `${side} is in check.` : `${side} to move.`,
      inCheck: checked,
    };
  }

  private insufficient(): boolean {
    const board = this.pos.board;
    const counts = new Array(7).fill(0);
    const bishopColors: number[] = [];
    for (let sq = 0; sq < 64; sq++) {
      const code = board[sq];
      if (!code) continue;
      const type = Math.abs(code);
      counts[type]++;
      if (type === BISHOP) bishopColors.push((sq & 7) + (sq >> 3));
    }
    if (counts[PAWN] || counts[ROOK] || counts[QUEEN]) return false;
    const minors = counts[KNIGHT] + counts[BISHOP];
    if (minors <= 1) return true;
    if (counts[KNIGHT] === 0 && counts[BISHOP] >= 1) {
      const parity = bishopColors[0] & 1;
      return bishopColors.every((c) => (c & 1) === parity);
    }
    return false;
  }

  /** A flat description of every occupied square — the API the student's code reads. */
  pieces(): Array<{ square: string; color: "white" | "black"; type: string; code: string }> {
    const out: Array<{ square: string; color: "white" | "black"; type: string; code: string }> = [];
    for (let sq = 0; sq < 64; sq++) {
      const code = this.pos.board[sq];
      if (!code) continue;
      const type = Math.abs(code);
      out.push({
        square: squareName(sq),
        color: code > 0 ? "white" : "black",
        type: PIECE_WORDS[type],
        code: pieceName(code),
      });
    }
    return out;
  }

  /** Only the legal moves that start on a given square, as UCI strings. */
  movesFrom(squareNameOrIndex: string | number): string[] {
    const sq = typeof squareNameOrIndex === "number" ? squareNameOrIndex : parseSquare(squareNameOrIndex);
    if (sq < 0) return [];
    return this.legalMoves().filter((m) => moveFrom(m) === sq).map(moveToUci);
  }

  sanList(): string[] {
    return this.history.map((h) => h.san);
  }

  /** The starting material, for a captured-pieces tray. */
  static readonly PIECE_VALUES: Record<number, number> = {
    [PAWN]: 1,
    [KNIGHT]: 3,
    [BISHOP]: 3,
    [ROOK]: 5,
    [QUEEN]: 9,
    [KING]: 0,
  };
}

export { encodeMove, moveFrom, moveTo, movePromo, moveToUci, squareName, pieceName, WHITE, BLACK };
