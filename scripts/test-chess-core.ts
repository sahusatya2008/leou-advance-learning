/**
 * Validates the chess engine against the standard perft positions.
 *
 * Perft is the canonical move-generation test: it counts leaf nodes to a depth
 * and any error in castling, en passant, promotion or check evasion changes the
 * count. Matching the published numbers is strong evidence the rules are right.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-chess-core.ts
 */
import { parseFen, perft, generateLegalMoves, toFen, START_FEN } from "@/lib/chess/engine";
import { ChessGame } from "@/lib/chess/game";
import { chooseMove } from "@/lib/chess/ai";

const CASES: Array<{ name: string; fen: string; expected: number[] }> = [
  {
    name: "startpos",
    fen: START_FEN,
    expected: [20, 400, 8902, 197281, 4865609],
  },
  {
    name: "kiwipete",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    expected: [48, 2039, 97862],
  },
  {
    name: "position 3",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    expected: [14, 191, 2812, 43238],
  },
  {
    name: "position 4",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    expected: [6, 264, 9467],
  },
  {
    name: "position 5",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    expected: [44, 1486, 62379],
  },
  {
    name: "position 6",
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    expected: [46, 2079, 89890],
  },
];

let failures = 0;
let checks = 0;

function assert(cond: boolean, label: string) {
  checks++;
  if (!cond) {
    failures++;
    console.log(`  FAIL  ${label}`);
  }
}

for (const c of CASES) {
  console.log(`perft ${c.name}`);
  for (let depth = 1; depth <= c.expected.length; depth++) {
    const pos = parseFen(c.fen);
    const got = perft(pos, depth);
    const want = c.expected[depth - 1];
    const ok = got === want;
    console.log(`  d${depth}: ${got}${ok ? "" : ` (expected ${want})`}`);
    assert(ok, `${c.name} perft(${depth}) = ${got} expected ${want}`);
  }
}

// FEN round-trips.
for (const c of CASES) {
  const pos = parseFen(c.fen);
  assert(toFen(pos) === c.fen, `FEN round-trip: ${c.fen}`);
}

// A basic legality sanity check: the opening position has 20 legal moves.
assert(generateLegalMoves(parseFen(START_FEN)).length === 20, "startpos legal move count");

// --- ChessGame level checks ------------------------------------------------

function play(g: ChessGame, moves: string[]) {
  for (const uci of moves) {
    const ply = g.move(uci);
    if (!ply) throw new Error(`illegal move ${uci} in ${g.fen()}`);
  }
}

// Fool's mate: black delivers checkmate.
{
  const g = new ChessGame();
  play(g, ["f2f3", "e7e5", "g2g4", "d8h4"]);
  const s = g.status();
  assert(s.state === "checkmate", "fool's mate is checkmate");
  assert(s.over && s.winner === "black", "fool's mate winner is black");
}

// Scholar's mate: white delivers checkmate, and the last SAN is Qxf7#.
{
  const g = new ChessGame();
  play(g, ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"]);
  const s = g.status();
  assert(s.state === "checkmate" && s.winner === "white", "scholar's mate is checkmate for white");
  assert(g.history[g.history.length - 1].san === "Qxf7#", "mate SAN ends with #");
}

// Castling is legal once the path is clear; SAN is O-O.
{
  const g = new ChessGame();
  play(g, ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"]);
  assert(g.history[g.history.length - 1].san === "O-O", "kingside castling SAN is O-O");
  assert(g.pieces().some((p) => p.square === "g1" && p.code === "K"), "white king on g1 after O-O");
  assert(g.pieces().some((p) => p.square === "f1" && p.code === "R"), "white rook on f1 after O-O");
}

// En passant removes the passed pawn.
{
  const g = new ChessGame();
  play(g, ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
  assert(!g.pieces().some((p) => p.square === "d5"), "en passant captured the pawn on d5");
  assert(g.pieces().some((p) => p.square === "d6" && p.code === "P"), "capturing pawn now on d6");
}

// Promotion turns the pawn into a queen.
{
  const g = new ChessGame("k7/7P/8/8/8/8/8/K7 w - - 0 1");
  const ply = g.move("h7h8q");
  assert(!!ply, "promotion move is legal");
  assert(g.pieces().some((p) => p.square === "h8" && p.code === "Q"), "pawn promoted to queen");
}

// Threefold repetition is a draw.
{
  const g = new ChessGame();
  play(g, ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]);
  assert(g.status().state === "draw-repetition", "threefold repetition is a draw");
}

// An illegal move is rejected.
{
  const g = new ChessGame();
  assert(g.move("e2e5") === null, "illegal pawn move rejected");
  assert(g.move("e2e4") !== null, "legal pawn move accepted");
}

// --- AI checks -------------------------------------------------------------

// Back-rank mate in one: the engine must see Ra8#.
{
  const g = new ChessGame("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1");
  const choice = chooseMove(g, "hard");
  assert(choice?.uci === "a1a8", `AI finds mate in 1 (got ${choice?.uci})`);
}

// The AI only ever plays legal moves, and a self-play game terminates cleanly.
{
  const g = new ChessGame();
  let ok = true;
  let plies = 0;
  for (; plies < 60 && !g.status().over; plies++) {
    const choice = chooseMove(g, "medium");
    if (!choice) {
      ok = false;
      break;
    }
    if (!g.move(choice.uci)) {
      ok = false;
      break;
    }
  }
  assert(ok, "AI self-play only makes legal moves");
  console.log(`  self-play ran ${plies} plies, state=${g.status().state}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.log(`${failures} FAILURES`);
  process.exit(1);
}
console.log("chess core OK");
