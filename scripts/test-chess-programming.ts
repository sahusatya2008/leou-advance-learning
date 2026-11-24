/**
 * End-to-end runner test for the programming track.
 *
 * For every programming lesson, run its `solutionCode` through the REAL sandbox
 * runner, one turn at a time, exactly the way the API route does:
 *
 *   history = []                       // UCI moves played so far
 *   live    = lessonPositionAfter(lesson, history)
 *   program = buildChess("python", promptFromFen(live.fen), solutionCode)
 *   stdout  = runnerRun(...).stdout
 *   chosen  = extractChessMove(stdout)
 *   history = [...history, chosen]
 *   repeat until judgeLesson(lesson, history).won or the game is over
 *
 * Asserts: the program runs without a Python error, always emits a legal move,
 * and reaches the lesson goal within `maxPlayerMoves` (or 12 turns as a guard).
 *
 *   RUNNER_URL=http://127.0.0.1:4100 npx tsx --tsconfig scripts/tsconfig.json scripts/test-chess-programming.ts
 */
import "dotenv/config";
import { buildChess, extractChessMove } from "@/lib/chess/harness";
import { promptFromFen, RUNNER_LANG } from "@/lib/chess/matchService";
import { runnerRun } from "@/services/runner";
import { TRAINING_LESSONS, judgeLesson, lessonPositionAfter } from "@/lib/chess/training";

const HARD_CAP = 16;

async function main() {
  let passed = 0;
  let failed = 0;
  const fail = (label: string, extra = "") => {
    failed++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  };
  const ok = () => passed++;

  const lessons = TRAINING_LESSONS.filter((l) => l.track === "programming");

  for (const lesson of lessons) {
    const code = lesson.solutionCode;
    if (!code) {
      fail(`${lesson.id}: has solutionCode`, "missing");
      continue;
    }
    const maxTurns = Math.max(lesson.maxPlayerMoves ?? lesson.par ?? 1, 1);
    const history: string[] = [];
    let broke = false;

    for (let turn = 0; turn < Math.min(maxTurns, HARD_CAP); turn++) {
      const live = lessonPositionAfter(lesson, history);
      // Stop once the judge is satisfied or the board is decided.
      const judged = judgeLesson(lesson, history);
      if (judged.won) break;
      if (live.over && history.length > 0) break;

      const program = buildChess("python", promptFromFen(live.fen), code);
      const res = await runnerRun(RUNNER_LANG.python, program, "");
      if (res.stderr.trim()) {
        fail(`${lesson.id}: python error`, res.stderr.trim().split("\n").slice(-2).join(" | "));
        broke = true;
        break;
      }
      const chosen = (extractChessMove(res.stdout) ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (!chosen) {
        fail(`${lesson.id}: emitted a move`, `stdout=${res.stdout.trim().slice(0, 60)}`);
        broke = true;
        break;
      }
      const after = lessonPositionAfter(lesson, [...history, chosen]);
      if (after.invalid) {
        fail(`${lesson.id}: chosen move legal`, `${chosen} illegal at turn ${turn + 1} (fen=${live.fen})`);
        broke = true;
        break;
      }
      history.push(chosen);
    }

    if (broke) continue;

    const finalJudge = judgeLesson(lesson, history);
    if (finalJudge.won) {
      ok();
    } else {
      fail(`${lesson.id}: solved within ${maxTurns} turns`, `line=${history.join(" ")} — ${finalJudge.message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (of ${lessons.length} programming lessons)`);
  if (failed > 0) process.exit(1);
}

void main();
