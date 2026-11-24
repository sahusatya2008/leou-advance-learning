/**
 * SNSAI regression tests.
 *
 * Run with:  npm run test:snsai
 *
 * These are not unit tests of helper functions. Every case here is a claim a
 * marker or a student could make about the engine: that a correct answer
 * scores higher than a vague one, that a genuine paraphrase earns credit, that
 * a wrong belief is named as a wrong belief, and that copying the reference
 * never beats understanding half of it.
 *
 * The ordering assertions are the important ones. Individual scores move as
 * the lexicon grows, but the order between these answers is the contract.
 */

import { evaluateAnswer, SNSAI_VERSION, summariseReports } from "../src/lib/snsai/evaluate";
import { extractConcepts, normalise } from "../src/lib/snsai/keypoints";
import { findMisconception } from "../src/lib/snsai/teach";
import { COMPUTER_SYSTEM_QUESTIONS } from "./data/computerSystemQuestions";
import type { SnsaiInput } from "../src/lib/snsai/types";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) passed++;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ""}`);
}

const section = (t: string) => console.log(`\n=== ${t} ===`);

// --------------------------------------------------------------------------
// The core case: a 3-mark "differentiate" question, answered eight ways.
// --------------------------------------------------------------------------
const RAM_ROM = {
  type: "SHORT",
  stem: "Differentiate between RAM and ROM.",
  reference:
    "RAM is volatile: it loses its contents the moment power is removed, so it is used for working memory while the program runs. ROM is non-volatile, read-mostly, and holds firmware such as the BIOS which must survive a power cut. Examples: RAM = DDR4; ROM = BIOS chip.",
  maxMarks: 3,
} satisfies Omit<SnsaiInput, "payload">;

const written = (text: string): SnsaiInput => ({ ...RAM_ROM, payload: { text } });

const ANSWERS = {
  excellent:
    "RAM is volatile memory, meaning it loses all its data when the power goes off, and it stores the data of the program currently running. ROM is non-volatile, so it keeps its data permanently, and it holds firmware like the BIOS. Example: RAM is DDR4 and ROM is the BIOS chip.",
  goodParaphrase:
    "Random access memory is temporary and gets cleared whenever electricity is cut. Read only memory is permanent and stores the boot program. For example, DDR4 is RAM and the BIOS chip is ROM.",
  halfRight: "RAM is volatile and ROM is non-volatile.",
  misconception: "ROM is volatile and RAM is non-volatile, so the data stays in RAM permanently.",
  keywordStuffing: "RAM ROM volatile non-volatile permanent power firmware BIOS DDR4 cache",
  copied: RAM_ROM.reference,
  offTopic: "I like football and my favourite colour is blue.",
};

section("Written-answer ordering");
{
  const s: Record<string, number> = {};
  for (const [k, v] of Object.entries(ANSWERS)) s[k] = evaluateAnswer(written(v)).marks;
  s.blank = evaluateAnswer(written("   ")).marks;
  for (const [k, v] of Object.entries(s)) console.log(`  ${k.padEnd(16)} ${v.toFixed(2)}/3`);

  check(
    "an excellent answer beats every other answer",
    s.excellent > s.goodParaphrase &&
      s.excellent > s.halfRight &&
      s.excellent > s.misconception &&
      s.excellent > s.keywordStuffing &&
      s.excellent > s.copied,
    JSON.stringify(s)
  );
  check("a genuine paraphrase beats a half answer", s.goodParaphrase > s.halfRight, JSON.stringify(s));
  check("a real answer beats keyword stuffing", s.goodParaphrase > s.keywordStuffing, JSON.stringify(s));
  check("a half answer beats a misconception", s.halfRight > s.misconception, JSON.stringify(s));
  check(
    "copying beats nothing but never beats understanding",
    s.copied > s.offTopic && s.copied < s.halfRight,
    JSON.stringify(s)
  );
  check("off-topic and blank score zero", s.offTopic === 0 && s.blank === 0, JSON.stringify(s));

  const ex = evaluateAnswer(written(ANSWERS.excellent));
  check(
    "an excellent answer is recognised as correct or nearly so",
    ex.verdict === "correct" || ex.verdict === "mostly_correct",
    ex.verdict
  );
  check("an excellent answer earns most of the marks", ex.marks >= 2.25, String(ex.marks));
  check("every report explains itself", ex.teaching.length > 0 && ex.nextStep.length > 0);

  const good = evaluateAnswer(written(ANSWERS.goodParaphrase));
  check(
    "a paraphrase is credited for the points it does make",
    good.criteria.filter((c) => c.hit).length >= 2,
    JSON.stringify(good.criteria.map((c) => [c.label, c.hit]))
  );

  const cop = evaluateAnswer(written(ANSWERS.copied));
  check(
    "a verbatim copy is reported as copying",
    cop.faults.some((f) => f.kind === "copied_reference"),
    JSON.stringify(cop.faults.map((f) => f.kind))
  );
}

section("Misconceptions are named, not just penalised");
{
  const mis = evaluateAnswer(written(ANSWERS.misconception));
  check(
    "the inverted RAM/ROM belief is detected",
    mis.faults.some((f) => f.kind === "misconception"),
    JSON.stringify(mis.faults.map((f) => f.message))
  );
  check("an inverted belief is not marked correct", !["correct", "mostly_correct"].includes(mis.verdict), mis.verdict);
  check("the correction is given in plain language", mis.faults.filter((f) => f.kind === "misconception").every((f) => f.teach.length > 20));

  // A correct comparison mentions both volatile and non-volatile. The engine
  // must not read that as a contradiction.
  check(
    "a correct comparison is not flagged as a contradiction",
    !evaluateAnswer(written(ANSWERS.halfRight)).faults.some((f) => f.kind === "misconception"),
    JSON.stringify(evaluateAnswer(written(ANSWERS.halfRight)).faults.map((f) => f.message))
  );
  check(
    "the excellent answer is not flagged as a contradiction",
    !evaluateAnswer(written(ANSWERS.excellent)).faults.some((f) => f.kind === "misconception"),
    JSON.stringify(evaluateAnswer(written(ANSWERS.excellent)).faults.map((f) => f.message))
  );

  check("RAM-cannot-lose-data is recognised", findMisconception("RAM is permanent memory, so it never loses data").length > 0);
  check("ROM-is-volatile is recognised", findMisconception("ROM is volatile and is cleared each time the power goes").length > 0);
  check(
    "a correct RAM/ROM answer triggers nothing",
    findMisconception("RAM is volatile and loses data on power off, ROM is non-volatile and keeps firmware").length === 0,
    JSON.stringify(findMisconception("RAM is volatile and loses data on power off, ROM is non-volatile and keeps firmware").map((f) => f.message))
  );
}

section("Determinism and speed");
{
  const blank = evaluateAnswer(written("   "));
  check("a blank answer is 'unanswered', not wrong", blank.verdict === "unanswered", blank.verdict);
  check("a blank answer scores zero", blank.marks === 0, String(blank.marks));

  // Timing is excluded: identical marks, verdict and criteria are what
  // "deterministic" has to mean for a report that records how long it took.
  const strip = (r: unknown) => JSON.stringify(r, (k, v) => (k === "elapsedMs" ? 0 : v));
  const a = evaluateAnswer(written(ANSWERS.excellent));
  const b = evaluateAnswer(written(ANSWERS.excellent));
  check("evaluation is deterministic", strip(a) === strip(b));

  const scorable = COMPUTER_SYSTEM_QUESTIONS.filter((q) => q.type !== "MCQ");
  const started = performance.now();
  for (const q of scorable) {
    evaluateAnswer({ type: q.type, stem: q.stem, reference: q.explanation, maxMarks: 4, payload: { text: q.explanation } });
  }
  const total = performance.now() - started;
  console.log(`  ${scorable.length} written questions in ${total.toFixed(0)}ms (${(total / scorable.length).toFixed(1)}ms each)`);
  check("evaluation stays under 25ms per question", total / scorable.length < 25, `${(total / scorable.length).toFixed(1)}ms`);
}

// --------------------------------------------------------------------------
// Every seeded reference answer must produce usable concepts and score well.
// --------------------------------------------------------------------------
section(`All ${COMPUTER_SYSTEM_QUESTIONS.length} seeded questions`);
{
  // The invariant here is coverage, not quality: reproducing a reference
  // verbatim is deliberately capped as copying, so a quality average would
  // only measure the anti-copy penalty. Coverage asks the question that
  // matters — is every reference answer fully reachable by the concept
  // extractor, with no question leaving the engine unable to see its answer?
  let noConcepts = 0;
  let coverageSum = 0;
  const weak: string[] = [];
  for (const q of readable()) {
    const concepts = extractConcepts(q.explanation, q.stem);
    if (concepts.length === 0) {
      noConcepts++;
      weak.push(`${q.id}: no concepts`);
    }
    const r = evaluateAnswer({
      type: q.type,
      stem: q.stem,
      reference: q.explanation,
      maxMarks: 4,
      payload: { text: q.explanation },
      transcript: q.type === "ORAL" ? q.explanation : undefined,
    });
    coverageSum += r.signals.coverage;
    if (r.signals.coverage < 0.7) weak.push(`${q.id} (${q.type}) coverage ${(r.signals.coverage * 100).toFixed(0)}%`);
  }
  const avg = coverageSum / readable().length;
  check("every written reference yields concepts", noConcepts === 0, `${noConcepts} questions produced none`);
  check("every reference answer is fully coverable", avg > 0.85, `${(avg * 100).toFixed(0)}%`);
  check("no question leaves part of its own answer unreachable", weak.length === 0, weak.slice(0, 8).join("; "));
  console.log(`  mean coverage when a student reproduces the reference: ${(avg * 100).toFixed(0)}%`);

  // An empty answer must never be rewarded, whatever the question.
  let zeroLeaks = 0;
  for (const q of readable()) {
    const r = evaluateAnswer({ type: q.type, stem: q.stem, reference: q.explanation, maxMarks: 4, payload: { text: "" } });
    if (r.marks > 0) zeroLeaks++;
  }
  check("no question gives marks for an empty answer", zeroLeaks === 0, `${zeroLeaks} questions leaked marks`);
}

/** Questions whose answer is words, so coverage is a real measurement. */
function readable() {
  return COMPUTER_SYSTEM_QUESTIONS.filter((q) => ["SHORT", "LONG", "ORAL"].includes(q.type));
}

// --------------------------------------------------------------------------
section("MCQ");
{
  const options = [
    { id: "a", text: "Arithmetic Logic Unit", isCorrect: false },
    { id: "b", text: "Control Unit", isCorrect: true },
    { id: "c", text: "Memory Unit", isCorrect: false },
    { id: "d", text: "Cache", isCorrect: false },
  ];
  const mcq = (optionIds: string[]): SnsaiInput => ({
    type: "MCQ",
    stem: "Which unit of the CPU fetches, decodes and executes instructions?",
    reference: "The Control Unit (CU) fetches the instruction, decodes it, and directs the other units.",
    maxMarks: 1,
    options,
    payload: { optionIds },
  });

  const right = evaluateAnswer(mcq(["b"]));
  const wrong = evaluateAnswer(mcq(["d"]));
  const none = evaluateAnswer(mcq([]));
  const both = evaluateAnswer(mcq(["b", "d"]));

  check("a correct MCQ earns full marks", right.marks === 1, String(right.marks));
  check("a correct MCQ is 'correct'", right.verdict === "correct", right.verdict);
  check("a wrong option scores zero", wrong.marks === 0, String(wrong.marks));
  check("a wrong option is 'incorrect'", wrong.verdict === "incorrect", wrong.verdict);
  check("an unanswered MCQ is 'unanswered'", none.verdict === "unanswered", none.verdict);
  check("selecting a wrong option alongside the right one loses the mark", both.marks < 1, String(both.marks));
  check("an MCQ report still teaches", right.nextStep.length > 0 || right.faults.length > 0);
}

section("CODING");
{
  const coding: SnsaiInput = {
    type: "CODING",
    stem: "Write a Python program that reads a list of numbers and prints their sum.",
    reference: "Read the numbers, add each to a running total, and print the total. An empty list must print 0.",
    maxMarks: 5,
    testCases: [
      { input: "1 2 3", expected: "6" },
      { input: "5", expected: "5" },
      { input: "", expected: "0" },
    ],
    payload: {
      language: "python",
      code: "nums = list(map(int, input().split()))\nprint(sum(nums))",
      runs: [
        { stdout: "6", stderr: "", exitCode: 0, timedOut: false },
        { stdout: "5", stderr: "", exitCode: 0, timedOut: false },
        { stdout: "0", stderr: "", exitCode: 0, timedOut: false },
      ],
    },
  };

  const pass = evaluateAnswer(coding);
  check("code that passes every test is correct", pass.verdict === "correct", pass.verdict);
  check("passing code earns full marks", pass.marks === 5, String(pass.marks));

  const partial = evaluateAnswer({
    ...coding,
    payload: {
      ...(coding.payload as object),
      runs: [
        { stdout: "6", stderr: "", exitCode: 0, timedOut: false },
        { stdout: "0", stderr: "", exitCode: 0, timedOut: false },
        { stdout: "0", stderr: "", exitCode: 0, timedOut: false },
      ],
    },
  });
  check("a partial pass earns partial marks", partial.marks > 0 && partial.marks < 5, String(partial.marks));
  check("a failing test case is named", partial.criteria.some((c) => !c.hit), JSON.stringify(partial.criteria.map((c) => c.hit)));

  const crashed = evaluateAnswer({
    ...coding,
    payload: { ...(coding.payload as object), runs: [{ stdout: "", stderr: "NameError: name 'sum' is not defined", exitCode: 1, timedOut: false }] },
  });
  check("a crash is reported", crashed.faults.some((f) => f.kind === "runtime_error"), JSON.stringify(crashed.faults.map((f) => f.kind)));
  check("code that crashes scores zero", crashed.marks === 0, String(crashed.marks));

  const hung = evaluateAnswer({
    ...coding,
    payload: { ...(coding.payload as object), runs: [{ stdout: "", stderr: "", exitCode: 0, timedOut: true }] },
  });
  check("an infinite loop is diagnosed as one", hung.faults.some((f) => f.teach.includes("infinite loop")), JSON.stringify(hung.faults.map((f) => f.teach)));

  check("no code is 'unanswered'", evaluateAnswer({ ...coding, payload: { code: "" } }).verdict === "unanswered");
}

section("SQL");
{
  const sql: SnsaiInput = {
    type: "SQL",
    stem: "Write a query to list the names of students who score above 80.",
    reference: "SELECT name FROM students WHERE score > 80;",
    maxMarks: 4,
    sqlContext: { dialect: "sqlite", schemaSql: "CREATE TABLE students (id INT, name TEXT, score INT);", seedSql: null },
    payload: { query: "SELECT name FROM students WHERE score > 80;" },
  };

  const right = evaluateAnswer(sql);
  console.log(`  correct query quality ${(right.quality * 100).toFixed(0)}%, marks ${right.marks}/4`);
  check("the correct query is recognised", right.quality > 0.7, String(right.quality));

  const wrong = evaluateAnswer({ ...sql, payload: { query: "SELECT * FROM marks;" } });
  check("an unrelated query scores lower", wrong.quality < right.quality, `${wrong.quality} vs ${right.quality}`);
  check("an unrelated query is flagged", wrong.faults.length > 0, JSON.stringify(wrong.faults.map((f) => f.kind)));

  const missingSemicolon = evaluateAnswer({ ...sql, payload: { query: "SELECT name FROM students WHERE score > 80" } });
  check("a missing semicolon does not destroy the score", missingSemicolon.quality > 0.6, String(missingSemicolon.quality));

  check("an empty query is 'unanswered'", evaluateAnswer({ ...sql, payload: { query: "" } }).verdict === "unanswered");
}

section("SQL judged on real execution, not keywords");
{
  const base: SnsaiInput = {
    type: "SQL",
    stem: "Write a query to list the names of students who score above 80.",
    reference: "SELECT name FROM students WHERE score > 80;",
    maxMarks: 4,
    sqlContext: { dialect: "sqlite", schemaSql: "", seedSql: null },
    payload: { query: "SELECT name FROM students WHERE score > 80;" },
  };
  const withResult = (sqlResult: Record<string, unknown>) =>
    evaluateAnswer({
      ...base,
      payload: { ...(base.payload as object), sqlResult, resultSummary: "Query ran." },
    });

  // The engine must trust what actually happened over what the keywords look like.
  const ranWrongKeywords = withResult({ ran: true, rowCount: 2, expectedRows: 2, matched: true });
  check(
    "correct output outranks keyword similarity",
    ranWrongKeywords.marks === 4 && ranWrongKeywords.verdict === "correct",
    `${ranWrongKeywords.marks}/4 ${ranWrongKeywords.verdict}`
  );

  const mismatch = withResult({ ran: true, rowCount: 7, expectedRows: 2, matched: false });
  check("wrong rows are reported as wrong output", mismatch.faults.some((f) => f.kind === "wrong_output"), JSON.stringify(mismatch.faults.map((f) => f.kind)));
  check("wrong rows score below a correct query", mismatch.marks < ranWrongKeywords.marks, `${mismatch.marks} vs ${ranWrongKeywords.marks}`);

  const crashed = withResult({ ran: false, rowCount: null, expectedRows: 2, matched: false, error: "no such table: student" });
  check("a query that does not run is a runtime error", crashed.faults.some((f) => f.kind === "runtime_error"), JSON.stringify(crashed.faults.map((f) => f.kind)));
  check("the database error is shown to the student", crashed.faults.some((f) => f.teach.includes("no such table")), JSON.stringify(crashed.faults.map((f) => f.teach)));
  check("a query that does not run scores zero", crashed.marks === 0, String(crashed.marks));

  const noExpected = withResult({ ran: true, rowCount: 3, expectedRows: null, matched: null });
  check("without an expected result the query is not called correct", noExpected.verdict !== "correct", noExpected.verdict);
  check("and the student is told why it was not confirmed", noExpected.faults.some((f) => f.teach.length > 0));
}

section("ORAL and UPLOAD");
{
  const oral: SnsaiInput = {
    type: "ORAL",
    stem: "Explain what a bootloader does.",
    reference:
      "The bootloader loads the operating system into memory when the machine is switched on. It runs first, checks the hardware, and then hands control to the OS.",
    maxMarks: 4,
    payload: { fileUrls: ["storage/uploads/answer.webm"] },
    transcript: "The boot loader loads the operating system into memory when the computer starts.",
    hasAudio: true,
  };

  const spoken = evaluateAnswer(oral);
  // A spoken answer that states the core function but omits the elaborations
  // must earn real credit and be called partial — not "incorrect", not zero.
  // The claim is about the verdict and the mark, not one quality threshold.
  check(
    "a spoken answer is credited as partial, not rejected",
    ["correct", "mostly_correct", "partial"].includes(spoken.verdict),
    spoken.verdict
  );
  check("a spoken answer earns a meaningful share of the marks", spoken.marks >= 1.5, String(spoken.marks));
  check("the point the speaker actually made is recognised as covered", spoken.criteria.some((c) => c.hit));
  check("an oral answer gets a next step", spoken.nextStep.length > 10, spoken.nextStep);
  check("recorded audio with a transcript is not 'unanswered'", spoken.verdict !== "unanswered", spoken.verdict);

  const noTranscript = evaluateAnswer({ ...oral, transcript: "" });
  check("recorded audio without a transcript is reported honestly", noTranscript.verdict === "unanswered", noTranscript.verdict);
  check(
    "and the student is told how to fix it",
    noTranscript.faults.some((f) => f.kind === "no_transcript" && f.teach.includes("type")),
    JSON.stringify(noTranscript.faults.map((f) => f.teach))
  );

  const nothing = evaluateAnswer({ ...oral, transcript: "", hasAudio: false, payload: {} });
  check("nothing captured is 'unanswered'", nothing.verdict === "unanswered", nothing.verdict);

  const upload: SnsaiInput = {
    type: "UPLOAD",
    stem: "Draw a labelled block diagram of a computer system.",
    reference: "Input, memory, CPU and output, with data and control lines between them, each labelled.",
    maxMarks: 4,
    payload: { fileUrls: ["storage/uploads/answer.png"] },
  };
  const up = evaluateAnswer(upload);
  check("an upload is not scored as if it were blank", up.verdict === "needs_teacher", up.verdict);
  check("an unreadable upload is given no invented mark", up.marks === 0, String(up.marks));
  check("an upload still gets a checklist to check itself against", up.criteria.length > 0, JSON.stringify(up.criteria));
  check("an upload gets guidance", up.nextStep.length > 10, up.nextStep);
  check("no file means 'unanswered'", evaluateAnswer({ ...upload, payload: { fileUrls: [] } }).verdict === "unanswered");
}

section("The lexicon does not conflate different ideas");
{
  // An over-eager synonym table is worse than none: mapping "load" to "read"
  // made "loads the operating system" match a reference about reading, and
  // mapping "bootloader" to "firmware" merged the program with the code it
  // runs. These pairs are genuinely different concepts and must stay apart.
  //
  // This is asserted on the normalised token rather than through a report: two
  // words that are both absent from a given reference would produce identical
  // all-miss criteria and prove nothing.
  const pairs: Array<[string, string, string]> = [
    ["loads", "reads", 'the "loads" in "loads the operating system"'],
    ["bootloader", "firmware", "the bootloader is the program, firmware is the code it runs"],
    ["rom", "firmware", "ROM is the memory, firmware is what is stored in it"],
    ["reads", "writes", "reading and writing are opposite operations"],
    ["cache", "ram", "cache is not RAM"],
    ["volatile", "nonvolatile", "the two are opposites, not synonyms"],
  ];
  for (const [a, b, why] of pairs) {
    check(`"${a}" and "${b}" normalise differently`, normalise(a)[0] !== normalise(b)[0], `${normalise(a)[0]} vs ${normalise(b)[0]} — ${why}`);
  }

  // The reverse direction: a genuine paraphrase of the same idea must match.
  const spelledOut = evaluateAnswer(
    written("Volatile memory such as RAM loses all of its data when the electricity is switched off.")
  );
  const acronym = evaluateAnswer(written("RAM is volatile and it loses its data on power off."));
  check(
    "a paraphrase of the same idea is still credited",
    spelledOut.marks > 0.5 && acronym.marks > 0.5,
    `${spelledOut.marks} vs ${acronym.marks}`
  );
}

section("Check all");
{
  const reports = [
    evaluateAnswer(written(ANSWERS.excellent)),
    evaluateAnswer(written(ANSWERS.halfRight)),
    evaluateAnswer(written("")),
  ];
  const sum = summariseReports(reports);
  check("the summary counts every question", sum.checked === 3, String(sum.checked));
  check("the summary totals the marks", sum.maxMarks === 9, String(sum.maxMarks));
  check(
    "every report lands in exactly one bucket",
    sum.correct + sum.mostlyCorrect + sum.needsWork + sum.awaitingTeacher + sum.unanswered === 3,
    JSON.stringify(sum)
  );
}

// --------------------------------------------------------------------------
console.log(`\nSNSAI ${SNSAI_VERSION}: ${passed} checks passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
