/**
 * Verifies the seeded Class 11 "Getting Started with Python" while-loop set end
 * to end against a running server, read-only: nothing here creates, publishes or
 * deletes any question, set or student. The only rows written are the ones the
 * probe itself uses (a throwaway admin, attempts, one doubt thread) and those
 * are removed in `finally`.
 *
 * Four things are proved:
 *   1. the content — ${SEED_QUESTIONS.length} practical questions, tagged, in sheet order, with every
 *      reference solution reproducing its own hidden expected output;
 *   2. the set — published, containing exactly those ${SEED_QUESTIONS.length} in that order;
 *   3. entitlement — a student whose plan covers the chapter sees it and can work
 *      in it, while students who are not covered never get a 200;
 *   4. the workspace — starter code arrives, marking material never does, code
 *      persists per question, the sandbox runs the real solutions, and a doubt
 *      thread goes ask → answer → satisfied.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-practical-while-loop.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/validation";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";
import { SEED_QUESTIONS, WHILE_LOOP_TAGS, VERY_IMPORTANT_TAG, CHAPTER } from "./data/practicalWhileLoopQuestions";
import { SEED_QUESTIONS as FOR_QUESTIONS, FOR_LOOP_TAGS } from "./data/practicalForLoopQuestions";
import { verifySolutions } from "./check-while-loop-solutions";
import { verifySolutions as verifyForSolutions } from "./check-for-loop-solutions";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const PASSWORD = "Test-Passw0rd!";
const STAMP = Date.now().toString(36);

/**
 * The chapter now carries two blocks in one set (the schema allows one set per
 * batch/subject/chapter): the while-loop sheet, then the for-loop sheet. Three
 * exercises are shared - the textbook poses them as for loops, so they were
 * moved out of the while block into the for block instead of being duplicated.
 */
const FOR_STEMS = new Set(FOR_QUESTIONS.map((q) => q.stem));
const WHILE_ONLY = SEED_QUESTIONS.filter((s) => !FOR_STEMS.has(s.stem));
const NEW_FOR = FOR_QUESTIONS.filter((q) => !q.reuseExisting);
/** Every distinct question the chapter's set must hold, in set order. */
const SET_SEEDS = [...WHILE_ONLY, ...FOR_QUESTIONS];
const SET_TOTAL = SET_SEEDS.length;
const ALL_SEEDS = [...SEED_QUESTIONS, ...NEW_FOR];
const SEED_BY_STEM = new Map(ALL_SEEDS.map((s) => [s.stem, s]));

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = "") {
  checks++;
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

let cookie = "";

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0] ?? cookie;
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* keep empty */
  }
  return { status: res.status, json };
}

/** Normalises a run's stdout so a trailing newline difference is not a bug. */
const norm = (s: string) => s.replace(/\s+$/, "");

const undo: (() => Promise<void>)[] = [];
const sessionSids: string[] = [];

async function main() {
  console.log(`\nwhile-loop practical set (${BASE})`);

  // ------------------------------------------------------------------ scope
  const classRoom = await prisma.classRoom.findFirst({ where: { name: "Class 11", isActive: true } });
  if (!classRoom) throw new Error('no active class named "Class 11"');
  const subject = await prisma.subject.findFirst({ where: { code: "CS" } });
  if (!subject) throw new Error("no subject with code CS");
  const batch = await prisma.batch.findFirst({
    where: { classRoomId: classRoom.id, subjects: { some: { subjectId: subject.id } } },
    select: { id: true, name: true },
  });
  if (!batch) throw new Error("no Class 11 batch takes CS");

  const assignment = await prisma.practicalAssignment.findUnique({
    where: { batchId_subjectId_topic: { batchId: batch.id, subjectId: subject.id, topic: CHAPTER } },
    select: {
      id: true,
      status: true,
      title: true,
      questions: { orderBy: { order: "asc" }, select: { questionId: true, order: true } },
    },
  });

  console.log("\ncontent");
  const questions = await prisma.question.findMany({
    where: { classRoomId: classRoom.id, subjectId: subject.id, topic: CHAPTER, isPractical: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      stem: true,
      type: true,
      difficulty: true,
      tags: true,
      isPractical: true,
      topic: true,
      explanation: true,
      allowedLanguages: true,
      starterCode: true,
      solutionCode: true,
      testCases: { select: { input: true, expected: true, isHidden: true, weight: true, sortOrder: true } },
    },
  });
  check("all seed questions exist for the chapter", questions.length === SET_TOTAL, `got ${questions.length}`);

  const byStem = new Map(questions.map((q) => [q.stem, q]));
  const expectedOrder = SET_SEEDS.map((s) => byStem.get(s.stem)?.id).filter((id): id is string => Boolean(id));
  check("every question on both sheets is in the bank", expectedOrder.length === SET_TOTAL, `${expectedOrder.length}/${SET_TOTAL}`);
  check("no duplicate stems", byStem.size === questions.length, `${byStem.size} unique of ${questions.length}`);

  const shapeProblems: string[] = [];
  for (const seed of [...WHILE_ONLY, ...NEW_FOR]) {
    const q = byStem.get(seed.stem);
    if (!q) continue;
    const tags = Array.isArray(q.tags) ? (q.tags as string[]) : [];
    if (q.type !== "CODING") shapeProblems.push(`${seed.key}: type ${q.type}`);
    if (!q.isPractical) shapeProblems.push(`${seed.key}: not practical`);
    if (q.topic !== CHAPTER) shapeProblems.push(`${seed.key}: topic ${String(q.topic)}`);
    if (!FOR_LOOP_TAGS.every((t) => tags.includes(t)) && !WHILE_LOOP_TAGS.every((t) => tags.includes(t)))
      shapeProblems.push(`${seed.key}: tags ${tags.join(",")}`);
    if (JSON.stringify(q.allowedLanguages) !== JSON.stringify(["python"])) shapeProblems.push(`${seed.key}: languages ${JSON.stringify(q.allowedLanguages)}`);
    if (!(q.starterCode as Record<string, string>)?.python?.trim()) shapeProblems.push(`${seed.key}: no starter code`);
    if (!q.solutionCode?.trim()) shapeProblems.push(`${seed.key}: no reference solution`);
    if (!q.explanation?.trim()) shapeProblems.push(`${seed.key}: no model answer`);
    if (q.testCases.length === 0) shapeProblems.push(`${seed.key}: no test cases`);
    if (q.testCases.some((t) => !t.isHidden)) shapeProblems.push(`${seed.key}: a test case is visible`);
    // An empty expected stdout is legitimate in exactly one place - the
    // "print nothing" edge case of the exclusive-range question - so the while
    // block keeps the strict rule and the for block only needs one real case.
    if (FOR_STEMS.has(seed.stem)) {
      if (!q.testCases.some((t) => t.expected.trim())) shapeProblems.push(`${seed.key}: no case with expected output`);
    } else if (q.testCases.some((t) => !t.expected.trim())) {
      shapeProblems.push(`${seed.key}: empty expected output`);
    }
    if (q.difficulty !== seed.difficulty) shapeProblems.push(`${seed.key}: difficulty ${q.difficulty}`);
    if (seed.important && !tags.includes(VERY_IMPORTANT_TAG)) shapeProblems.push(`${seed.key}: missing ${VERY_IMPORTANT_TAG} tag`);
    if (!seed.important && tags.includes(VERY_IMPORTANT_TAG)) shapeProblems.push(`${seed.key}: unexpected ${VERY_IMPORTANT_TAG} tag`);
  }
  // The three shared exercises are only re-tagged by the for-loop seeder, so
  // their content is checked as it already stands; only the tags are asserted.
  for (const seed of FOR_QUESTIONS.filter((q) => q.reuseExisting)) {
    const q = byStem.get(seed.stem);
    if (!q) {
      shapeProblems.push(`${seed.key}: missing from the bank`);
      continue;
    }
    const tags = Array.isArray(q.tags) ? (q.tags as string[]) : [];
    if (!FOR_LOOP_TAGS.every((t) => tags.includes(t))) shapeProblems.push(`${seed.key}: tags ${tags.join(",")}`);
    if (tags.includes("while-loop")) shapeProblems.push(`${seed.key}: still tagged while-loop`);
    if (seed.important && !tags.includes(VERY_IMPORTANT_TAG)) shapeProblems.push(`${seed.key}: missing ${VERY_IMPORTANT_TAG} tag`);
  }
  check("every question is complete and tagged", shapeProblems.length === 0, shapeProblems.slice(0, 6).join(" | "));

  const tagged = questions.filter((q) => Array.isArray(q.tags) && (q.tags as string[]).includes("while-loop"));
  check('the while block carries the "while-loop" tag', tagged.length === WHILE_ONLY.length, `${tagged.length}/${WHILE_ONLY.length}`);
  const forTagged = questions.filter((q) => Array.isArray(q.tags) && (q.tags as string[]).includes("for-loop"));
  check('the for block carries the "for-loop" tag', forTagged.length === FOR_QUESTIONS.length, `${forTagged.length}/${FOR_QUESTIONS.length}`);

  const wantImportant = [...WHILE_ONLY, ...FOR_QUESTIONS].filter((s) => s.important).length;
  const important = questions.filter((q) => Array.isArray(q.tags) && (q.tags as string[]).includes(VERY_IMPORTANT_TAG));
  check(
    "every seed-flagged question carries very-important",
    important.length === wantImportant,
    `${important.length}/${wantImportant}`,
  );

  console.log("\nreference solutions");
  const solutionFailures = [...verifySolutions(), ...verifyForSolutions()];
  check("all solutions reproduce their hidden expected output", solutionFailures.length === 0, solutionFailures.slice(0, 3).join(" | "));

  // ------------------------------------------------------------ the set
  console.log("\nthe published set");
  check("the set exists for this chapter", Boolean(assignment), assignment ? "" : `no set for ${CHAPTER} in ${batch.name}`);
  if (assignment) {
    check("it is published", assignment.status === "PUBLISHED", `status ${assignment.status}`);
    check("it holds exactly the two sheets", assignment.questions.length === SET_TOTAL, `got ${assignment.questions.length}`);
    const order = assignment.questions.map((q) => q.questionId);
    check("in the order the sheet is written", JSON.stringify(order) === JSON.stringify(expectedOrder));
    check("orders are 1..N with no gaps", assignment.questions.every((q, i) => q.order === i + 1));
  }

  // ----------------------------------------------------- admin side reads
  const admin = await prisma.user.create({
    data: {
      username: `zz_wl_${STAMP}_admin`,
      email: `zz_wl_${STAMP}_admin@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role: "ADMIN",
    },
  });
  undo.push(async () => {
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => null);
  });

  cookie = "";
  const asAdmin = await api("POST", "/api/auth/login", { mode: "password", identifier: admin.username, password: PASSWORD });
  check("the probe admin can log in", asAdmin.status === 200, `got ${asAdmin.status}`);

  console.log("\nthe admin builder view");
  const picker = await api(
    "GET",
    `/api/admin/practical?batchId=${encodeURIComponent(batch.id)}&subjectId=${encodeURIComponent(subject.id)}&topic=${encodeURIComponent(CHAPTER)}`,
  );
  const picked = picker.json.assignment as { id: string; status: string; questions: { questionId: string; tags: string[]; starterCode: Record<string, string> }[]; available: unknown[] } | null;
  check("the builder loads the set", picker.status === 200 && Boolean(picked), `got ${picker.status}`);
  if (picked) {
    check("the builder shows both sheets in order", picked.questions.length === SET_TOTAL, `got ${picked.questions.length}`);
    check("nothing practical is left out of the set", picked.available.length === 0, `${picked.available.length} available`);
    check(
      "the builder carries the tags through",
      picked.questions.every((q) => {
        const tags = q.tags ?? [];
        return tags.includes("while-loop") || tags.includes("for-loop");
      }),
    );
    check("the builder shows starter code", picked.questions.every((q) => Boolean(q.starterCode?.python)));
  }

  const bank = await api("GET", `/api/admin/questions?classRoomId=${classRoom.id}&subjectId=${subject.id}&topic=${encodeURIComponent(CHAPTER)}&practical=1&light=1`);
  const bankList = (bank.json.questions ?? []) as { id: string; tags?: unknown }[];
  check("the bank filter finds all practical questions", bankList.length === SET_TOTAL, `got ${bankList.length}`);
  check(
    "the bank list shows the tags",
    bankList.every((q) => Array.isArray(q.tags) && ((q.tags as string[]).includes("while-loop") || (q.tags as string[]).includes("for-loop"))),
  );

  // ------------------------------------------------- who can actually see it
  console.log("\nentitlement");
  const assignmentId = assignment?.id ?? "";
  const members = await prisma.batchStudent.findMany({ where: { batchId: batch.id }, select: { studentId: true } });
  const memberProfileIds = new Set(members.map((m) => m.studentId));
  const everyone = await prisma.user.findMany({
    where: { role: "STUDENT", studentProfile: { isNot: null } },
    select: { id: true, username: true, studentProfile: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  // Members first: they are the ones who could show a 403, which is the
  // interesting failure (in the batch, but the chapter is not on their plan).
  const candidates = [
    ...everyone.filter((u) => u.studentProfile && memberProfileIds.has(u.studentProfile.id)),
    ...everyone.filter((u) => !u.studentProfile || !memberProfileIds.has(u.studentProfile.id)),
  ].slice(0, 12);

  let entitled: { id: string; username: string } | null = null;
  let outsiderVisible = 0;
  let sawForbidden = 0;
  let sawMissing = 0;

  for (const candidate of candidates) {
    const sid = await createSession({ id: candidate.id, role: "STUDENT" }, { userAgent: "while-loop-probe" });
    sessionSids.push(sid.sid);
    const saved = cookie;
    cookie = `${SESSION_COOKIE}=${sid.token}`;

    const list = await api("GET", "/api/student/practicals");
    const listed = ((list.json.practicals ?? []) as { id: string }[]).some((p) => p.id === assignmentId);
    const detail = await api("GET", `/api/student/practicals/${assignmentId}`);

    if (detail.status === 200) {
      if (listed && !entitled) entitled = { id: candidate.id, username: candidate.username };
      if (!listed) check(`listed and reachable disagree for ${candidate.username}`, false, "detail 200 but absent from the list");
    } else if (detail.status === 403) {
      sawForbidden++;
      if (listed) check(`${candidate.username} is covered in the list but refused`, false, "403 on detail");
    } else if (detail.status === 404) {
      sawMissing++;
      if (listed) check(`${candidate.username} is listed but 404s`, false, "404 on detail");
    } else {
      check(`unexpected status for ${candidate.username}`, false, `got ${detail.status}`);
    }
    if (detail.status === 200 && !listed) outsiderVisible++;

    cookie = saved;
  }

  check("a student whose plan covers the chapter can open it", Boolean(entitled), `none of ${candidates.length} candidates`);
  check("a student outside the plan gets 403, not content", sawForbidden > 0 || sawMissing > 0, "every candidate could see it");
  check("no uncovered student received the set", outsiderVisible === 0);
  console.log(`       (saw 403: ${sawForbidden}, saw 404: ${sawMissing}, entitled: ${entitled?.username ?? "none"})`);

  if (!entitled) throw new Error("no entitled student available, cannot probe the workspace");
  const studentUser = await prisma.user.findUnique({ where: { id: entitled.id }, select: { studentProfile: { select: { id: true } } } });
  const studentProfileId = studentUser?.studentProfile?.id;
  if (!studentProfileId) throw new Error("entitled student has no profile");

  // ---------------------------------------------------- the workspace view
  console.log("\nthe student workspace");
  const studentSession = await createSession({ id: entitled.id, role: "STUDENT" }, { userAgent: "while-loop-probe" });
  sessionSids.push(studentSession.sid);
  cookie = `${SESSION_COOKIE}=${studentSession.token}`;

  const detail = await api("GET", `/api/student/practicals/${assignmentId}`);
  check("the entitled student opens the set", detail.status === 200, `got ${detail.status}`);
  const raw = JSON.stringify(detail.json);
  const practical = detail.json.practical as {
    questions: { questionId: string; order: number; stem: string; difficulty: string; tags: string[]; starterCode: Record<string, string> | null; attempt: unknown }[];
  } | null;
  check("all questions are delivered", practical?.questions.length === SET_TOTAL, `got ${practical?.questions.length}`);
  check(
    "in sheet order",
    JSON.stringify(practical?.questions.map((q) => q.questionId)) === JSON.stringify(expectedOrder),
  );
  check(
    "every question carries its block tag",
    Boolean(practical?.questions.every((q) => (q.tags ?? []).includes("while-loop") || (q.tags ?? []).includes("for-loop"))),
  );
  const importantByQuestion = new Map(questions.map((q) => [q.id, (q.tags as string[]).includes(VERY_IMPORTANT_TAG)]));
  check(
    "very-important travels down to the student",
    Boolean(
      practical?.questions.every(
        (q) => (q.tags ?? []).includes(VERY_IMPORTANT_TAG) === importantByQuestion.get(q.questionId),
      ),
    ),
  );
  check("difficulty labels arrived", practical?.questions.every((q) => ["EASY", "MEDIUM", "HARD"].includes(q.difficulty)) ?? false);
  check("starter code is there for every question", practical?.questions.every((q) => Boolean(q.starterCode?.python)) ?? false);
  check('no "solutionCode" key reaches the browser', !raw.includes("solutionCode"), raw.slice(0, 200));
  check('no "testCases" key reaches the browser', !raw.includes("testCases"));
  // Checked question by question, because one question's starter legitimately
  // contains a line that another question's solution also uses. Only the lines a
  // solution has and its own starter does not can prove a leak.
  const leaked: string[] = [];
  (practical?.questions ?? []).forEach((delivered) => {
    const seed = SEED_BY_STEM.get(delivered.stem);
    if (!seed?.solutionCode || !seed.starterCode) return;
    const rawQuestion = JSON.stringify(delivered);
    for (const line of seed.solutionCode.split("\n").map((l) => l.trim())) {
      // Substring, not equality: a hint may quote the line inside a comment.
      if (line.length > 12 && !seed.starterCode.includes(line) && rawQuestion.includes(line))
        leaked.push(`${seed.key}: ${line}`);
    }
  });
  check("no reference solution text leaks", leaked.length === 0, leaked.slice(0, 3).join(" | "));

  // -------------------------------------------------- code persistence + run
  console.log("\nattempts and the sandbox");
  const attemptIds: string[] = [];
  undo.push(async () => {
    if (!attemptIds.length) return;
    await prisma.practicalEvent.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => null);
    await prisma.practicalAttempt.deleteMany({ where: { id: { in: attemptIds } } }).catch(() => null);
  });
  const first = SEED_QUESTIONS[0];
  const firstId = byStem.get(first.stem)!.id;
  const start = await api("POST", "/api/student/practicals/attempt", { action: "start", assignmentId, questionId: firstId });
  check("an attempt starts on question 1", start.status === 200, `got ${start.status} ${String(start.json.error ?? "")}`);
  const attemptId = String((start.json.attempt as { id?: string } | undefined)?.id ?? "");
  if (attemptId) attemptIds.push(attemptId);
  check("it is seeded with the starter code", String((start.json.attempt as { code?: string }).code) === first.starterCode);

  const again = await api("POST", "/api/student/practicals/attempt", { action: "start", assignmentId, questionId: firstId });
  check("starting again resumes the same attempt", String((again.json.attempt as { id?: string }).id) === attemptId);

  const save = await api("POST", "/api/student/practicals/attempt", { action: "save", attemptId, code: first.solutionCode });
  check("the student's code saves", save.status === 200, `got ${save.status}`);
  const snapshot = await prisma.practicalAttempt.findUnique({ where: { id: attemptId }, select: { code: true } });
  check("the code is on the attempt row", snapshot?.code === first.solutionCode);

  const reload = await api("GET", `/api/student/practicals/${assignmentId}`);
  const reloaded = ((reload.json.practical as { questions: { questionId: string; attempt: { code: string | null } | null }[] }).questions ?? []).find(
    (q) => q.questionId === firstId,
  );
  check("the saved code comes back in the payload", reloaded?.attempt?.code === first.solutionCode);

  // Every reference solution, run through the real sandbox with its own first
  // test case's stdin, must print exactly what the hidden case expects.
  // Every reference solution is proved locally by `verifySolutions` above. Here
  // the real sandbox route only needs a sample from each block: the endpoint
  // allows 12 runs per 10s per student and escalates the block on a breach, so a
  // long burst would both fail the check and lock the student out of the editor.
  const SANDBOX_SAMPLE = [
    SEED_QUESTIONS[0],
    SEED_QUESTIONS[7],
    FOR_QUESTIONS[0],
    FOR_QUESTIONS[8],
    FOR_QUESTIONS[19],
    FOR_QUESTIONS[28],
  ];
  let ran = 0;
  const runFailures: string[] = [];
  for (const [i, seed] of SANDBOX_SAMPLE.entries()) {
    // Stay far under the window: one run every ~2.5s is at most four per 10s.
    if (i > 0) await new Promise((r) => setTimeout(r, 2500));
    const testCase = seed.testCases?.[0];
    if (!testCase || !seed.solutionCode) {
      runFailures.push(`${seed.key}: seed is incomplete`);
      continue;
    }
    const res = await api("POST", "/api/student/attempt/run", {
      language: "python",
      code: seed.solutionCode,
      stdin: testCase.stdin,
    });
    if (res.status !== 200) {
      runFailures.push(`${seed.key}: route ${res.status} ${String(res.json.error ?? "")}`);
      continue;
    }
    const stdout = String(res.json.stdout ?? "");
    if (res.json.exitCode !== 0) runFailures.push(`${seed.key}: exit ${String(res.json.exitCode)}`);
    else if (norm(stdout) !== norm(testCase.expected)) runFailures.push(`${seed.key}: got ${JSON.stringify(norm(stdout).slice(0, 80))}`);
    else ran++;
  }
  check("the sandbox executes solutions from both blocks", ran === SANDBOX_SAMPLE.length, `${ran}/${SANDBOX_SAMPLE.length}; ${runFailures.slice(0, 3).join(" | ")}`);

  // The workspace reports the finished run back to the attempt, which is what
  // writes the entry the admin activity feed reads.
  const report = await api("POST", "/api/student/practicals/attempt", {
    action: "run",
    attemptId,
    language: "python",
    ok: true,
    exitCode: 0,
    output: SEED_QUESTIONS[0].testCases[0].expected.slice(0, 2000),
  });
  check("the workspace reports the run to the attempt", report.status === 200, `got ${report.status}`);
  const runEvent = await prisma.practicalEvent.findFirst({ where: { attemptId, type: "CODE_RUN" }, select: { id: true } });
  check("the run was logged to the attempt's event feed", Boolean(runEvent));

  console.log("\nthe interactive terminal");
  const second = SEED_QUESTIONS[7]; // the multiplication table: one input, then output
  const secondId = byStem.get(second.stem)!.id;
  const start2 = await api("POST", "/api/student/practicals/attempt", { action: "start", assignmentId, questionId: secondId });
  const attempt2Id = String((start2.json.attempt as { id?: string } | undefined)?.id ?? "");
  if (attempt2Id) attemptIds.push(attempt2Id);

  const session = await api("POST", "/api/student/practicals/run-session", {
    attemptId: attempt2Id,
    language: "python",
    code: second.solutionCode,
  });
  check("a session starts for a question that reads input", session.status === 200, `got ${session.status} ${String(session.json.error ?? "")}`);
  const sessionId = String(session.json.sessionId ?? "");
  if (sessionId) {
    let state: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) {
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      const out = String(state.stdout ?? "");
      if (out.includes("Enter a number") || out.includes("number")) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    await api("POST", `/api/student/practicals/run-session/${sessionId}/input`, { input: "7" });
    let table = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      if (String(state.stdout ?? "").includes("7 x 10 = 70")) {
        table = true;
        break;
      }
    }
    check("the program consumed stdin and printed the table", table, String(state.stdout ?? "").slice(-200));
    await api("POST", `/api/student/practicals/run-session/${sessionId}`);
  }

  // ------------------------------------------------------------ the doubt
  console.log("\nthe doubt thread");
  const doubtRes = await api("POST", "/api/student/practicals/doubts", {
    action: "create",
    assignmentId,
    questionId: firstId,
    body: "The loop runs once too many — the last even number printed is wrong.",
    codeExcerpt: first.solutionCode.slice(0, 400),
    terminalExcerpt: "2\n4\n6",
  });
  check("a doubt opens", doubtRes.status === 200, `got ${doubtRes.status} ${String(doubtRes.json.error ?? "")}`);
  const doubtId = String((doubtRes.json.doubt as { id?: string } | undefined)?.id ?? "");
  if (doubtId) undo.push(async () => { await prisma.practicalDoubt.deleteMany({ where: { id: doubtId } }); });
  check("it starts OPEN", String((doubtRes.json.doubt as { status?: string }).status) === "OPEN");

  const mine = await api("GET", `/api/student/practicals/doubts?assignmentId=${encodeURIComponent(assignmentId)}&questionId=${encodeURIComponent(firstId)}`);
  check("the student sees their own thread", ((mine.json.doubts ?? []) as { id: string }[]).some((d) => d.id === doubtId));

  const savedCookie = cookie;
  const adminSession = await createSession({ id: admin.id, role: "ADMIN" }, { userAgent: "while-loop-probe" });
  sessionSids.push(adminSession.sid);
  cookie = `${SESSION_COOKIE}=${adminSession.token}`;
  const inbox = await api("GET", "/api/admin/practical/doubts?status=OPEN");
  check("the admin inbox lists it", ((inbox.json.doubts ?? []) as { id: string }[]).some((d) => d.id === doubtId));
  const answer = await api("POST", `/api/admin/practical/doubts/${doubtId}`, {
    body: "Your counter starts at 0 and the loop condition uses <= — change it to < and the extra pass disappears.",
  });
  check("the admin answers", answer.status === 200, `got ${answer.status} ${String(answer.json.error ?? "")}`);
  check("that moves it to ANSWERED", String((answer.json.doubt as { status?: string }).status) === "ANSWERED");

  cookie = savedCookie;
  const satisfied = await api("POST", "/api/student/practicals/doubts", { action: "satisfied", doubtId });
  check("the student confirms it helped", satisfied.status === 200, `got ${satisfied.status} ${String(satisfied.json.error ?? "")}`);
  check("the thread closes as SATISFIED", String((satisfied.json.doubt as { status?: string }).status) === "SATISFIED");

  const inboxAfter = await api("GET", "/api/admin/practical/doubts?status=OPEN");
  check("it leaves the open inbox", !((inboxAfter.json.doubts ?? []) as { id: string }[]).some((d) => d.id === doubtId));
}

main()
  .then(async () => {
    console.log(`\n${checks} checks, ${failures} failure(s)\n`);
    for (const step of undo.reverse()) await step().catch(() => null);
    for (const sid of sessionSids) if (sid) await revokeSession(sid).catch(() => null);
    await prisma.$disconnect();
    process.exit(failures ? 1 : 0);
  })
  .catch(async (e) => {
    console.error(e);
    for (const step of undo.reverse()) await step().catch(() => null);
    for (const sid of sessionSids) if (sid) await revokeSession(sid).catch(() => null);
    await prisma.$disconnect();
    process.exit(1);
  });
