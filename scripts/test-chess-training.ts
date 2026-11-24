/**
 * Validates the Leou Chess training curriculum.
 *
 * Every lesson must (a) parse as a legal position, (b) have the student to move,
 * (c) be solvable — the lesson's own `solution` must satisfy its goal through the
 * real judge, and (d) not be trivially solved by doing nothing. This keeps the
 * curriculum honest: a lesson that drifts out of solvability fails here rather
 * than stumping a student in the app.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-chess-training.ts
 */
import { parseFen, WHITE, toFen } from "@/lib/chess/engine";
import { ChessGame } from "@/lib/chess/game";
import {
  TRAINING_LESSONS,
  TRAINING_TRACKS,
  lessonsForTrack,
  judgeLesson,
  physicalStages,
  programmingStages,
  PROGRAMMING_STAGE_ORDER,
  PROGRAMMER_RANK_LADDER,
  rankForProgrammingCompleted,
  rankForCompleted,
  RANK_LADDER,
  lessonPositionAfter,
  type TrainingLesson,
} from "@/lib/chess/training";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`);
  }
}

function testLesson(lesson: TrainingLesson) {
  const tag = `${lesson.track}/${lesson.id}`;

  // Position parses and it is the student's turn.
  let ok = true;
  try {
    parseFen(lesson.fen);
  } catch {
    ok = false;
  }
  check(`${tag}: FEN parses`, ok, lesson.fen);
  check(`${tag}: student is White to move`, parseFen(lesson.fen).turn === WHITE);

  // Doing nothing must not solve it (except the "any move" lesson, which still
  // requires a move and so is unsolved by an empty line).
  check(`${tag}: not solved by an empty line`, judgeLesson(lesson, []).won === false);

  // The canonical solution solves it.
  const solved = judgeLesson(lesson, lesson.solution);
  check(`${tag}: solution ${lesson.solution.join(" ")} solves it`, solved.won === true, solved.message);
  check(`${tag}: solution earns 3 stars`, solved.stars === 3, `stars=${solved.stars}`);

  // Every intermediate prefix of the solution is legal (no move is skipped).
  for (let i = 1; i < lesson.solution.length; i++) {
    const prefix = judgeLesson(lesson, lesson.solution.slice(0, i));
    check(`${tag}: prefix ${prefix.line.join(" ")} is legal`, !prefix.message.startsWith("That move is not legal"));
  }

  // A bogus move is reported, not thrown.
  const bogus = judgeLesson(lesson, ["z9z8"]);
  check(`${tag}: illegal move is reported`, bogus.won === false && bogus.message.includes("not legal"));

  // The line the judge applied is non-empty.
  check(`${tag}: a line was applied`, solved.line.length >= lesson.solution.length);
}

/**
 * The training opponent must always play back. A physical lesson with no
 * scripted replies used to hand the turn to an opponent that did not exist,
 * freezing the board. Now any legal, non-solving move gets a deterministic
 * engine reply and the turn returns to the student.
 */
function testOpponentReply() {
  let exercised = 0;
  for (const lesson of TRAINING_LESSONS) {
    if (lesson.track !== "physical") continue;
    const tag = `${lesson.track}/${lesson.id}`;

    // Find a legal move that neither solves the lesson nor ends the game.
    const probe = new ChessGame(lesson.fen).legalUci().find((m) => {
      const g = new ChessGame(lesson.fen);
      const ply = g.move(m);
      return !!ply && !g.status().over && !judgeLesson(lesson, [m]).won;
    });
    if (!probe) continue;

    const judged = judgeLesson(lesson, [probe]);
    check(`${tag}: non-solving move ${probe} gets an opponent reply`, judged.line.length === 2, judged.line.join(" "));
    check(`${tag}: student is to move again after the reply`, new ChessGame(judged.finalFen).turnName() === "white", judged.finalFen);

    const again = judgeLesson(lesson, [probe]);
    check(`${tag}: opponent reply is deterministic`, judged.line.join(" ") === again.line.join(" ") && judged.finalFen === again.finalFen);

    exercised++;
  }
  check("opponent-reply behaviour was exercised", exercised >= 5, `lessons=${exercised}`);

  // Scripted replies still win for a lesson that declares them.
  const pawnPush = TRAINING_LESSONS.find((l) => l.id === "pawn-push");
  if (pawnPush) {
    const j = judgeLesson(pawnPush, ["a5a6"]);
    check("scripted reply is used for pawn-push", j.line.join(" ") === "a5a6 h8g8", j.line.join(" "));
  }
}

/**
 * Programming lessons carry extra structure the UI depends on: a Python starter
 * (so the editor opens with something that runs), a canonical `solutionCode`
 * for the runner E2E test, and — where present — a code walkthrough whose
 * `playMove` steps are legal in the lesson's line.
 */
function testProgrammingLesson(lesson: TrainingLesson) {
  const tag = `${lesson.track}/${lesson.id}`;
  const starter = lesson.starterCode?.python;
  check(`${tag}: has python starterCode`, typeof starter === "string" && starter.includes("def move(game)"), starter ? "" : "missing");
  check(`${tag}: has solutionCode`, typeof lesson.solutionCode === "string" && lesson.solutionCode.includes("def move(game)"), lesson.solutionCode ? "" : "missing");

  if (lesson.codeWalkthrough) {
    check(`${tag}: codeWalkthrough has >= 1 step`, lesson.codeWalkthrough.length >= 1, `n=${lesson.codeWalkthrough.length}`);
    for (const step of lesson.codeWalkthrough) {
      check(`${tag}: walkthrough step has caption`, typeof step.caption === "string" && step.caption.length > 0);
      if (step.playMove) {
        const before = lessonPositionAfter(lesson, []).fen;
        const g = new ChessGame(before);
        check(`${tag}: walkthrough playMove ${step.playMove} is legal`, g.findMove(step.playMove) != null, step.playMove);
      }
    }
  }

  // `lineNotes` must be a non-empty string array when present.
  if (lesson.lineNotes) {
    check(`${tag}: lineNotes are non-empty strings`, lesson.lineNotes.every((n) => typeof n === "string" && n.length > 0));
  }
}

function main() {
  console.log("Leou Chess — training curriculum\n");

  check("two tracks exist", lessonsForTrack("physical").length > 0 && lessonsForTrack("programming").length > 0);
  check("at least 20 lessons total", TRAINING_LESSONS.length >= 20, `total=${TRAINING_LESSONS.length}`);
  check("physical track is sizeable", lessonsForTrack("physical").length >= 10, `n=${lessonsForTrack("physical").length}`);
  check("programming track is sizeable", lessonsForTrack("programming").length >= 10, `n=${lessonsForTrack("programming").length}`);

  // The physical track is locked at exactly 100 levels: the Grandmaster rank
  // (and the "100 levels" promise on the hub) depends on this number.
  const physical = lessonsForTrack("physical");
  check("physical track has exactly 100 levels", physical.length === 100, `n=${physical.length}`);
  check(
    "every physical lesson declares a stage",
    physical.every((l) => typeof l.stage === "string" && l.stage.length > 0),
    `missing=${physical.filter((l) => !l.stage).map((l) => l.id).join(",")}`,
  );
  const staged = physicalStages(physical);
  const stagedCount = staged.reduce((n, g) => n + g.lessons.length, 0);
  check("stage grouping covers every physical lesson", stagedCount === 100, `grouped=${stagedCount}`);
  check(
    "Grandmaster Trials is the final stage",
    staged[staged.length - 1]?.stage === "Grandmaster Trials",
    staged[staged.length - 1]?.stage,
  );
  check(
    "the Grandmaster rank requires all 100 levels",
    RANK_LADDER[RANK_LADDER.length - 1].minCompleted === 100 && rankForCompleted(100).name === "Grandmaster",
    rankForCompleted(100).name,
  );

  // The programming track mirrors the physical one: 100+ lessons, every one in
  // a stage, grouped in curriculum order, with a programmer rank ladder.
  const programming = lessonsForTrack("programming");
  check("programming track has at least 100 lessons", programming.length >= 100, `n=${programming.length}`);
  const progStages = programmingStages(programming);
  const progStaged = progStages.reduce((n, g) => n + g.lessons.length, 0);
  check("stage grouping covers every programming lesson", progStaged === programming.length, `grouped=${progStaged} of ${programming.length}`);
  check(
    "every programming stage is a known stage",
    progStages.every((g) => (PROGRAMMING_STAGE_ORDER as readonly string[]).includes(g.stage)),
    progStages.map((g) => g.stage).join(" | "),
  );
  check(
    "Code Grandmaster Trials is the final stage",
    progStages[progStages.length - 1]?.stage === "Code Grandmaster Trials",
    progStages[progStages.length - 1]?.stage,
  );
  check(
    "the Code Grandmaster rank requires all programming lessons",
    PROGRAMMER_RANK_LADDER[PROGRAMMER_RANK_LADDER.length - 1].minCompleted >= programming.length &&
      rankForProgrammingCompleted(programming.length).name === "Code Grandmaster",
    rankForProgrammingCompleted(programming.length).name,
  );

  // No duplicate ids within a track.
  for (const track of Object.values(TRAINING_TRACKS)) {
    const ids = lessonsForTrack(track.id).map((l) => l.id);
    check(`${track.id}: ids are unique`, new Set(ids).size === ids.length);
  }

  for (const lesson of TRAINING_LESSONS) testLesson(lesson);
  for (const lesson of programming) testProgrammingLesson(lesson);

  testOpponentReply();

  // The judge is pure: judging twice gives the same answer.
  const sample = TRAINING_LESSONS[0];
  const a = judgeLesson(sample, sample.solution);
  const b = judgeLesson(sample, sample.solution);
  check("judge is deterministic", a.won === b.won && a.finalFen === b.finalFen && a.finalFen === toFen(parseFen(a.finalFen)));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
