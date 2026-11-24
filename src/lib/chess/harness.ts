/**
 * The chess programming harness.
 *
 * The student writes one function — `move(game)` — that reads the current board
 * and returns a single move as text (`"e2e4"`, `"e7e8q"` for a promotion). The
 * game is turn-based and each turn is a fresh sandbox run, so the position is
 * embedded into the generated program: there is no long-lived process to keep in
 * sync, and the file on screen is exactly the strategy the student owns.
 *
 * The generated program prints the chosen move after `@@CHESS@@`; the server
 * validates it against the legal move list before applying it, so a program that
 * returns something illegal is a normal, reportable outcome rather than a crash.
 */
import type { GameLanguage } from "@/lib/games/types";

export const CHESS_MARKER = "@@CHESS@@";

export type ChessPrompt = {
  fen: string;
  /** "w" or "b". */
  turn: "w" | "b";
  /** Every legal move in UCI form. */
  legal: string[];
  /** Occupied squares and their FEN-style piece letters. */
  pieces: Array<{ square: string; piece: string }>;
  inCheck: boolean;
};

/** The move chosen by a student's program, extracted from its stdout. */
export function extractChessMove(stdout: string): string | null {
  for (const line of stdout.split("\n")) {
    const at = line.indexOf(CHESS_MARKER);
    if (at < 0) continue;
    const rest = line.slice(at + CHESS_MARKER.length).trim();
    return rest.split(/\s+/)[0] ?? "";
  }
  return null;
}

function jsArray(items: string[]): string {
  return "[" + items.map((s) => JSON.stringify(s)).join(", ") + "]";
}

function javaArray(items: string[]): string {
  return "{" + items.map((s) => JSON.stringify(s)).join(", ") + "}";
}

export function buildChessProgram(language: GameLanguage, prompt: ChessPrompt): string {
  const squares = prompt.pieces.map((p) => p.square);
  const codes = prompt.pieces.map((p) => p.piece);
  switch (language) {
    case "python":
      return `# --- Leou Chess harness (generated) ---
# A complete chess engine in Python is provided below. Your move(game) function
# can inspect the board AND play whole candidate games with game.apply(move),
# detect attacks with game.attacked_squares(), and test for mate with status().

_FILES = "abcdefgh"
_DELTAS = {
    "n": [(1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)],
    "b": [(1, 1), (1, -1), (-1, 1), (-1, -1)],
    "r": [(1, 0), (-1, 0), (0, 1), (0, -1)],
    "q": [(1, 1), (1, -1), (-1, 1), (-1, -1), (1, 0), (-1, 0), (0, 1), (0, -1)],
    "k": [(1, 1), (1, -1), (-1, 1), (-1, -1), (1, 0), (-1, 0), (0, 1), (0, -1)],
}

def _sq_rc(sq):
    return (int(sq[1]) - 1, _FILES.index(sq[0]))

def _rc_sq(r, c):
    return _FILES[c] + str(r + 1)

def _on(r, c):
    return 0 <= r < 8 and 0 <= c < 8

def _is_white(code):
    return code != "" and code.isupper()

def _is_black(code):
    return code != "" and code.islower()

class Game:
    def __init__(self, fen=None):
        if fen is None:
            fen = ${JSON.stringify(prompt.fen)}
        parts = fen.split()
        self._board = {}
        rank = 7
        file = 0
        for ch in parts[0]:
            if ch == "/":
                rank -= 1
                file = 0
            elif ch.isdigit():
                file += int(ch)
            else:
                self._board[_FILES[file] + str(rank + 1)] = ch
                file += 1
        self._turn = parts[1] if len(parts) > 1 else "w"
        self._castling = parts[2] if len(parts) > 2 and parts[2] != "-" else ""
        self._ep = parts[3] if len(parts) > 3 else "-"
        self._half = int(parts[4]) if len(parts) > 4 else 0
        self._full = int(parts[5]) if len(parts) > 5 else 1

    def fen(self):
        rows = []
        for r in range(7, -1, -1):
            empty = 0
            row = ""
            for c in range(8):
                code = self._board.get(_FILES[c] + str(r + 1), "")
                if code == "":
                    empty += 1
                else:
                    if empty:
                        row += str(empty)
                        empty = 0
                    row += code
            if empty:
                row += str(empty)
            rows.append(row)
        return "/".join(rows) + " " + self._turn + " " + (self._castling if self._castling else "-") + " " + (self._ep if self._ep else "-") + " " + str(self._half) + " " + str(self._full)

    def turn(self):
        return "white" if self._turn == "w" else "black"

    def in_check(self):
        return self._king_attacked(self._turn == "w")

    def piece_at(self, square):
        return self._board.get(square, "")

    def pieces(self):
        return [{"square": sq, "piece": code} for sq, code in sorted(self._board.items())]

    def legal_moves(self):
        return self._legal()

    def moves_from(self, square):
        return [m for m in self._legal() if m[:2] == square]

    def attacked_squares(self, by_white=None):
        if by_white is None:
            by_white = self._turn == "w"
        out = set()
        for sq in list(self._board):
            code = self._board[sq]
            if _is_white(code) == bool(by_white):
                for target in self._attacks_from(sq):
                    out.add(target)
        return sorted(out)

    def king_square(self, by_white=None):
        if by_white is None:
            by_white = self._turn == "w"
        want = "K" if by_white else "k"
        for sq in list(self._board):
            if self._board[sq] == want:
                return sq
        return ""

    def apply(self, move):
        g2 = Game(self.fen())
        if not g2._raw_play(move):
            return None
        return g2

    def is_game_over(self):
        return self.status()["over"]

    def status(self):
        legal = self._legal()
        if not legal:
            if self.in_check():
                winner = "black" if self._turn == "w" else "white"
                return {"over": True, "result": "checkmate", "winner": winner}
            return {"over": True, "result": "stalemate", "winner": None}
        pieces = list(self._board.values())
        if len(pieces) <= 3:
            minors = [p for p in pieces if p in "nNbB"]
            if all(p in "kK" for p in pieces) or (len(minors) == 1 and all(p in "kKnNbB" for p in pieces)):
                return {"over": True, "result": "insufficient", "winner": None}
        return {"over": False, "result": "active", "winner": None}

    def _attacks_from(self, sq):
        code = self._board.get(sq, "")
        if not code:
            return []
        t = code.lower()
        r, f = _sq_rc(sq)
        out = []
        if t == "p":
            d = 1 if _is_white(code) else -1
            for df in (-1, 1):
                nr, nf = r + d, f + df
                if _on(nr, nf):
                    out.append(_rc_sq(nr, nf))
            return out
        if t in "nk":
            for df, dr in _DELTAS[t]:
                nr, nf = r + dr, f + df
                if _on(nr, nf):
                    out.append(_rc_sq(nr, nf))
            return out
        for df, dr in _DELTAS[t]:
            nr, nf = r + dr, f + df
            while _on(nr, nf):
                out.append(_rc_sq(nr, nf))
                if self._board.get(_rc_sq(nr, nf), ""):
                    break
                nr += dr
                nf += df
        return out

    def _attacked(self, sq, by_white):
        for from_sq in list(self._board):
            code = self._board[from_sq]
            if _is_white(code) != bool(by_white):
                continue
            if sq in self._attacks_from(from_sq):
                return True
        return False

    def _king_attacked(self, white):
        ksq = self.king_square(white)
        if not ksq:
            return False
        return self._attacked(ksq, not white)

    def _pseudo(self):
        us_white = self._turn == "w"
        moves = []
        for sq in list(self._board):
            code = self._board[sq]
            if _is_white(code) != us_white:
                continue
            t = code.lower()
            r, f = _sq_rc(sq)
            if t == "p":
                d = 1 if us_white else -1
                start_rank = 1 if us_white else 6
                last_rank = 7 if us_white else 0
                if _on(r + d, f):
                    one = _rc_sq(r + d, f)
                    if one not in self._board:
                        if r + d == last_rank:
                            for promo in "qrbn":
                                moves.append(sq + one + promo)
                        else:
                            moves.append(sq + one)
                            two = _rc_sq(r + 2 * d, f)
                            if r == start_rank and two not in self._board:
                                moves.append(sq + two)
                for df in (-1, 1):
                    nr, nf = r + d, f + df
                    if not _on(nr, nf):
                        continue
                    tsq = _rc_sq(nr, nf)
                    target = self._board.get(tsq, "")
                    if target and _is_white(target) != us_white:
                        if nr == last_rank:
                            for promo in "qrbn":
                                moves.append(sq + tsq + promo)
                        else:
                            moves.append(sq + tsq)
                    elif not target and tsq == self._ep:
                        moves.append(sq + tsq)
            elif t in "nk":
                for df, dr in _DELTAS[t]:
                    nr, nf = r + dr, f + df
                    if not _on(nr, nf):
                        continue
                    tsq = _rc_sq(nr, nf)
                    target = self._board.get(tsq, "")
                    if not target or _is_white(target) != us_white:
                        moves.append(sq + tsq)
            else:
                for df, dr in _DELTAS[t]:
                    nr, nf = r + dr, f + df
                    while _on(nr, nf):
                        tsq = _rc_sq(nr, nf)
                        target = self._board.get(tsq, "")
                        if not target:
                            moves.append(sq + tsq)
                        else:
                            if _is_white(target) != us_white:
                                moves.append(sq + tsq)
                            break
                        nr += dr
                        nf += df
        if us_white and self._board.get("e1") == "K":
            if "K" in self._castling and self._board.get("f1", "") == "" and self._board.get("g1", "") == "" and self._board.get("h1") == "R" and not self._attacked("e1", False) and not self._attacked("f1", False) and not self._attacked("g1", False):
                moves.append("e1g1")
            if "Q" in self._castling and self._board.get("d1", "") == "" and self._board.get("c1", "") == "" and self._board.get("b1", "") == "" and self._board.get("a1") == "R" and not self._attacked("e1", False) and not self._attacked("d1", False) and not self._attacked("c1", False):
                moves.append("e1c1")
        elif not us_white and self._board.get("e8") == "k":
            if "k" in self._castling and self._board.get("f8", "") == "" and self._board.get("g8", "") == "" and self._board.get("h8") == "r" and not self._attacked("e8", True) and not self._attacked("f8", True) and not self._attacked("g8", True):
                moves.append("e8g8")
            if "q" in self._castling and self._board.get("d8", "") == "" and self._board.get("c8", "") == "" and self._board.get("b8", "") == "" and self._board.get("a8") == "r" and not self._attacked("e8", True) and not self._attacked("d8", True) and not self._attacked("c8", True):
                moves.append("e8c8")
        return moves

    def _legal(self):
        out = []
        for m in self._pseudo():
            g2 = Game(self.fen())
            if g2._raw_play(m) and not g2._king_attacked(g2._turn == "b"):
                out.append(m)
        return out

    def _raw_play(self, move):
        move = str(move).strip().lower()
        if move not in self._pseudo():
            return False
        frm, to = move[:2], move[2:4]
        promo = move[4] if len(move) > 4 else ""
        code = self._board.pop(frm)
        captured = self._board.get(to, "")
        is_ep = code.lower() == "p" and to == self._ep and not captured
        if is_ep:
            cap_sq = to[0] + str(int(to[1]) - (1 if self._turn == "w" else -1))
            self._board.pop(cap_sq, None)
        self._board[to] = promo.upper() if promo else code
        if code.lower() == "k" and abs(_FILES.index(to[0]) - _FILES.index(frm[0])) == 2:
            if to == "g1":
                self._board["f1"] = self._board.pop("h1", "")
            elif to == "c1":
                self._board["d1"] = self._board.pop("a1", "")
            elif to == "g8":
                self._board["f8"] = self._board.pop("h8", "")
            elif to == "c8":
                self._board["d8"] = self._board.pop("a8", "")
        self._ep = "-"
        if code.lower() == "p" and abs(int(to[1]) - int(frm[1])) == 2:
            self._ep = frm[0] + str(int(frm[1]) + (1 if self._turn == "w" else -1))
        rights = list(self._castling)
        def drop(ch):
            if ch in rights:
                rights.remove(ch)
        if code == "K":
            drop("K"); drop("Q")
        if code == "k":
            drop("k"); drop("q")
        if frm == "a1" or to == "a1":
            drop("Q")
        if frm == "h1" or to == "h1":
            drop("K")
        if frm == "a8" or to == "a8":
            drop("q")
        if frm == "h8" or to == "h8":
            drop("k")
        self._castling = "".join(rights)
        if code.lower() == "p" or captured or is_ep:
            self._half = 0
        else:
            self._half += 1
        if self._turn == "b":
            self._full += 1
        self._turn = "b" if self._turn == "w" else "w"
        return True

# --- your code (return a move like "e2e4") ---
`;
    case "javascript":
      return `// --- Leou Chess harness (generated) ---
const _fen = ${JSON.stringify(prompt.fen)};
const _turn = ${JSON.stringify(prompt.turn)};
const _legal = ${jsArray(prompt.legal)};
const _inCheck = ${prompt.inCheck ? "true" : "false"};
const _pieces = new Map();
{
  const _squares = ${jsArray(squares)};
  const _codes = ${jsArray(codes)};
  for (let _i = 0; _i < _squares.length; _i++) _pieces.set(_squares[_i], _codes[_i]);
}
class Game {
  fen() { return _fen; }
  turn() { return _turn === "w" ? "white" : "black"; }
  legalMoves() { return _legal.slice(); }
  inCheck() { return _inCheck; }
  pieceAt(square) { return _pieces.get(square) || ""; }
  pieces() { return [..._pieces.entries()].map(([square, piece]) => ({ square, piece })); }
  movesFrom(square) { return _legal.filter((m) => m.slice(0, 2) === square); }
}

// --- your code (return a move like "e2e4") ---
`;
    case "java":
      return `// --- Leou Chess harness (generated) ---
import java.util.*;

public class Main {
  static String FEN = ${JSON.stringify(prompt.fen)};
  static String TURN = ${JSON.stringify(prompt.turn)};
  static String[] LEGAL = ${javaArray(prompt.legal)};
  static boolean IN_CHECK = ${prompt.inCheck ? "true" : "false"};
  static String[] SQUARES = ${javaArray(squares)};
  static String[] CODES = ${javaArray(codes)};
  static Map<String, String> PIECES = new HashMap<>();

  static class Game {
    String fen() { return FEN; }
    String turn() { return TURN.equals("w") ? "white" : "black"; }
    List<String> legalMoves() { return new ArrayList<>(Arrays.asList(LEGAL)); }
    boolean inCheck() { return IN_CHECK; }
    String pieceAt(String square) { return PIECES.getOrDefault(square, ""); }
    List<String> movesFrom(String square) {
      List<String> out = new ArrayList<>();
      for (String m : LEGAL) if (m.startsWith(square)) out.add(m);
      return out;
    }
  }

  // --- your code (write: static String move(Game game) { ... }) ---
`;
    case "cpp":
      throw new Error("Chess is not offered in C++.");
  }
}

function chessEpilogue(language: GameLanguage): string {
  switch (language) {
    case "python":
      return `
# --- run ---
_result = ""
try:
    _result = move(Game())
except Exception:
    _result = ""
if _result is None:
    _result = ""
import sys
sys.stdout.write("${CHESS_MARKER}" + str(_result).strip() + "\\n")
`;
    case "javascript":
      return `
// --- run ---
let _result = "";
try {
  const _r = move(new Game());
  if (_r !== null && _r !== undefined) _result = String(_r);
} catch (_e) {}
console.log("${CHESS_MARKER}" + _result.trim());
`;
    case "java":
      return `
  public static void main(String[] args) {
    for (int i = 0; i < SQUARES.length; i++) PIECES.put(SQUARES[i], CODES[i]);
    String result = "";
    try {
      String r = move(new Game());
      if (r != null) result = r;
    } catch (Throwable t) {}
    System.out.println("${CHESS_MARKER}" + result.trim());
  }
}
`;
    case "cpp":
      throw new Error("Chess is not offered in C++.");
  }
}

export function buildChess(language: GameLanguage, prompt: ChessPrompt, studentCode: string): string {
  if (language === "cpp") throw new Error("Chess is not offered in C++.");
  return buildChessProgram(language, prompt) + "\n" + studentCode + "\n" + chessEpilogue(language);
}

const CHESS_STARTER: Record<GameLanguage, string> = {
  python: `def move(game):
    # game.legal_moves() lists every move you may play this turn.
    # Return one of them as text, e.g. "e2e4".
    moves = game.legal_moves()
    return moves[0]
`,
  javascript: `function move(game) {
  // game.legalMoves() lists every move you may play this turn.
  // Return one of them as text, e.g. "e2e4".
  const moves = game.legalMoves();
  return moves[0];
}
`,
  java: `  static String move(Game game) {
    // game.legalMoves() lists every move you may play this turn.
    // Return one of them as text, e.g. "e2e4".
    List<String> moves = game.legalMoves();
    return moves.get(0);
  }
`,
  cpp: `// Chess is not offered in C++.
`,
};

export function chessStarter(language: GameLanguage): string {
  return CHESS_STARTER[language];
}
