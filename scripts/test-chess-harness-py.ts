/**
 * Differential test: the Python engine embedded in the chess harness must
 * agree with the TypeScript engine exactly, for every position we teach.
 *
 * For each FEN: compare the legal-move set, then for EVERY legal move compare
 * the legal-move set and check status after applying it (this exercises
 * castling, en passant, promotion, pins and self-check).
 *
 *   RUNNER_URL=http://127.0.0.1:4100 npx tsx --tsconfig scripts/tsconfig.json scripts/test-chess-harness-py.ts
 */
import "dotenv/config";
import { ChessGame } from "@/lib/chess/game";
import { buildChess } from "@/lib/chess/harness";
import { promptFromFen } from "@/lib/chess/matchService";
import { runnerRun } from "@/services/runner";

const FENS: Array<{ name: string; fen: string }> = [
  { name: "start", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
  { name: "after-e4-e5", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2" },
  { name: "ep-position", fen: "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3" },
  { name: "scholars-before", fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1KN1R w KQkq - 4 4" },
  { name: "scholars-after", fen: "r1bqkbnr/pppp1Qpp/2n5/4p3/2B1P3/8/PPPP1PPP/RNB1KN1R b KQkq - 0 4" },
  { name: "castling-tension", fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1" },
  { name: "kq-position", fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1" },
  { name: "midgame", fen: "r1bq1rk1/pp2ppbp/2np1np1/2p5/2P1P3/2NP1N2/PP2BPPP/R1BQ1RK1 w - - 0 9" },
  { name: "promotion-race", fen: "8/1P6/8/8/8/8/k6p/7K w - - 0 1" },
  { name: "back-rank", fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1" },
  { name: "black-move", fen: "4k3/8/8/3pP3/8/8/8/4K3 b - e6 0 1" },
  { name: "pins", fen: "4k3/4n3/8/5N2/8/8/8/4R1K1 w - - 0 1" },
];

function tsLegalAfter(fen: string, uci: string) {
  const g = new ChessGame(fen);
  if (!g.move(uci)) return null;
  const s = g.status();
  const result =
    s.state === "playing"
      ? "active"
      : s.state === "checkmate"
        ? "checkmate"
        : s.state === "stalemate"
          ? "stalemate"
          : s.state === "draw-insufficient"
            ? "insufficient"
            : s.state;
  return {
    legal: [...g.legalUci()].sort().join(" "),
    check: g.inCheck() ? 1 : 0,
    over: s.over,
    result,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;
  const check = (label: string, cond: boolean, extra = "") => {
    if (cond) passed++;
    else {
      failed++;
      console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
    }
  };

  for (const { name, fen } of FENS) {
    const ts = new ChessGame(fen);
    const tsLegal = [...ts.legalUci()].sort();

    const probe = `
g = Game()
print("BASE", " ".join(sorted(g.legal_moves())))
print("CHECK", 1 if g.in_check() else 0)
for m in sorted(g.legal_moves()):
    g2 = g.apply(m)
    if g2 is None:
        print("AFTER", m, "ILLEGAL")
        continue
    st = g2.status()
    print("AFTER", m, " ".join(sorted(g2.legal_moves())) if st["result"] == "active" else "-", 1 if g2.in_check() else 0, st["result"])
`;
    const program = buildChess("python", promptFromFen(fen), probe);
    const res = await runnerRun("python", program, "");
    if (res.stderr.trim()) {
      check(`${name}: no python error`, false, res.stderr.trim().split("\n").slice(-3).join(" | "));
      continue;
    }
    const lines = res.stdout.split("\n").filter(Boolean);
    const base = lines.find((l) => l.startsWith("BASE "));
    const pyLegal = base ? base.slice(5).trim().split(/\s+/).filter(Boolean) : [];
    check(`${name}: legal move set`, pyLegal.join(" ") === tsLegal.join(" "), `py=${pyLegal.length} ts=${tsLegal.length}`);

    const tsCheck = ts.inCheck() ? 1 : 0;
    const pyCheckLine = lines.find((l) => l.startsWith("CHECK "));
    check(`${name}: base in_check`, Number(pyCheckLine?.slice(6)) === tsCheck);

    for (const m of tsLegal) {
      const after = lines.find((l) => l.startsWith(`AFTER ${m} `));
      const tsAfter = tsLegalAfter(fen, m);
      if (!after || !tsAfter) {
        check(`${name}: after ${m} present`, false);
        continue;
      }
      const parts = after.split(" ");
      const pyResult = parts[parts.length - 1];
      const pyCheckAfter = Number(parts[parts.length - 2]);
      const pyMoves = parts.slice(2, -2).join(" ");
      const tsMoves = tsAfter.over ? "-" : tsAfter.legal;
      check(`${name}: after ${m} result`, pyResult === tsAfter.result, `py=${pyResult} ts=${tsAfter.result}`);
      check(`${name}: after ${m} moves`, pyMoves === tsMoves, `py=${pyMoves.slice(0, 60)} ts=${tsMoves.slice(0, 60)}`);
      check(`${name}: after ${m} check`, pyCheckAfter === tsAfter.check);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
