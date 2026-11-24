/**
 * Verifies the admin "Show Practical Activity" surface and the terminal
 * activity recording behind it end to end against a running server.
 *
 * What it exercises:
 *   - a live practical session's typed input, transcript-on-kill, transcript on
 *     natural exit, and the dedupe between the kill route and the poll route;
 *   - the attempt lifecycle events (started, saved, run, finished) that feed the
 *     activity timeline;
 *   - the student details page option and the dedicated activity page itself,
 *     fetched as an admin.
 *
 * Everything it needs is created here and removed in `finally`: a throwaway
 * student in a real class with an active service, membership of a real batch
 * (reverted), two synthetic coding questions, one published practical set, and
 * a throwaway admin. No pre-existing student, question, batch or practical set
 * is modified.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-practical-activity.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/validation";
import { SESSION_COOKIE, createSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const PASSWORD = "Test-Passw0rd!";
const STAMP = Date.now().toString(36);

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = "") {
  checks++;
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}

let cookie = "";

/** Students stop at the face step on password login, so mint the real session. */
async function loginAsStudent(userId: string) {
  const info = await createSession({ id: userId, role: "STUDENT" }, { userAgent: "practical-activity-test" });
  cookie = `${SESSION_COOKIE}=${info.token}`;
}

async function loginAsAdmin(userId: string) {
  const info = await createSession({ id: userId, role: "ADMIN" }, { userAgent: "practical-activity-test" });
  cookie = `${SESSION_COOKIE}=${info.token}`;
}

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

async function getHtml(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, text: await res.text() };
}

const undo: (() => Promise<void>)[] = [];

type Json = Record<string, unknown>;

async function main() {
  console.log(`\npractical activity (${BASE})`);

  const batch = await prisma.batch.findFirst({
    where: { isActive: true, classRoom: { isActive: true }, subjects: { some: { subject: { code: "CS" } } } },
    select: {
      id: true,
      classRoomId: true,
      subjects: { where: { subject: { code: "CS" } }, select: { subjectId: true } },
      pricingItems: { where: { subject: { code: "CS" } }, select: { name: true }, orderBy: { name: "asc" } },
    },
  });
  if (!batch) throw new Error("no active batch takes CS");
  const chapter = batch.pricingItems[0]?.name;
  if (!chapter) throw new Error("that batch prices no CS chapter");
  const subjectId = batch.subjects[0]!.subjectId;

  const classRoom = await prisma.classRoom.findUnique({ where: { id: batch.classRoomId }, select: { id: true } });
  if (!classRoom) throw new Error("class room missing");

  // --- fixtures -------------------------------------------------------------
  const student = await prisma.user.create({
    data: {
      username: `zz_pact_${STAMP}`,
      email: `zz_pact_${STAMP}@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role: "STUDENT",
      onboardingRequired: true,
      studentProfile: {
        create: {
          fullName: "Practical Activity Student",
          classRoomId: classRoom.id,
          schoolName: "ZZ School",
          facePhotoUrl: "",
          faceEmbeddings: [],
        },
      },
    },
    include: { studentProfile: true },
  });
  const studentProfileId = student.studentProfile!.id;
  undo.push(async () => {
    await prisma.serviceActivation.deleteMany({ where: { userId: student.id } });
    await prisma.user.delete({ where: { id: student.id } }).catch(() => null);
  });
  await prisma.batchStudent.create({ data: { batchId: batch.id, studentId: studentProfileId } });
  undo.push(async () => {
    await prisma.batchStudent.deleteMany({ where: { batchId: batch.id, studentId: studentProfileId } }).catch(() => null);
  });
  await prisma.serviceActivation.create({
    data: { userId: student.id, expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
  });

  const admin = await prisma.user.create({
    data: {
      username: `zz_pact_${STAMP}_admin`,
      email: `zz_pact_${STAMP}_admin@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role: "ADMIN",
    },
  });
  undo.push(async () => {
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => null);
  });

  const stem = `ZZ practical activity probe ${STAMP}`;
  const question = await prisma.question.create({
    data: {
      type: "CODING",
      classRoomId: classRoom.id,
      subjectId,
      difficulty: "EASY",
      topic: chapter,
      stem,
      isPractical: true,
      allowedLanguages: ["python"],
      starterCode: { python: "print('starter')" },
      solutionCode: "print('starter')",
    },
  });
  const question2 = await prisma.question.create({
    data: {
      type: "CODING",
      classRoomId: classRoom.id,
      subjectId,
      difficulty: "EASY",
      topic: chapter,
      stem: `${stem} two`,
      isPractical: true,
      allowedLanguages: ["python"],
      starterCode: { python: "print('starter')" },
      solutionCode: "print('starter')",
    },
  });
  const assignmentTitle = `ZZ activity set ${STAMP}`;
  undo.push(async () => {
    await prisma.question.delete({ where: { id: question.id } }).catch(() => null);
    await prisma.question.delete({ where: { id: question2.id } }).catch(() => null);
  });

  const assignment = await prisma.practicalAssignment.create({
    data: {
      batchId: batch.id,
      subjectId,
      topic: chapter,
      title: assignmentTitle,
      status: "PUBLISHED",
      questions: { create: [{ questionId: question.id }, { questionId: question2.id }] },
    },
  });
  undo.push(async () => {
    await prisma.practicalAttempt.deleteMany({ where: { assignmentId: assignment.id } }).catch(() => null);
    await prisma.practicalAssignment.delete({ where: { id: assignment.id } }).catch(() => null);
  });

  try {
    // --- student: attempts, terminal sessions, lifecycle events --------------
    await loginAsStudent(student.id);

    const started = await api("POST", "/api/student/practicals/attempt", {
      action: "start",
      assignmentId: assignment.id,
      questionId: question.id,
    });
    check("the attempt starts", started.status === 200, JSON.stringify(started.json));
    const attemptId = String((started.json.attempt as Json | undefined)?.id ?? "");
    check("an attempt id comes back", Boolean(attemptId));

    const saved = await api("POST", "/api/student/practicals/attempt", {
      action: "save",
      attemptId,
      code: "print('saved')",
      language: "python",
    });
    check("code can be saved", saved.status === 200, JSON.stringify(saved.json));

    // Session A: typed input, natural exit (poll route records the transcript),
    // then an explicit kill that must NOT record it a second time.
    const startA = await api("POST", "/api/student/practicals/run-session", {
      attemptId,
      language: "python",
      code: "print('A')",
    });
    const sidA = String(startA.json.sessionId ?? "");
    check("session A starts", startA.status === 200 && Boolean(sidA), JSON.stringify(startA.json));

    const inputA = await api("POST", `/api/student/practicals/run-session/${sidA}/input`, { input: "exit()" });
    check("input A is accepted", inputA.status === 200, JSON.stringify(inputA.json));

    let stateA: Json = {};
    for (let i = 0; i < 25; i++) {
      const poll = await api("GET", `/api/student/practicals/run-session/${sidA}`);
      stateA = poll.json;
      if (stateA.status === "exited") break;
      await new Promise((r) => setTimeout(r, 400));
    }
    check("session A exits on its own", stateA.status === "exited", JSON.stringify(stateA).slice(0, 200));

    const killA = await api("POST", `/api/student/practicals/run-session/${sidA}`);
    check("killing the exited session still succeeds", killA.status === 200, JSON.stringify(killA.json));

    const run = await api("POST", "/api/student/practicals/attempt", {
      action: "run",
      attemptId,
      language: "python",
      ok: true,
      exitCode: 0,
      output: "A-output-line",
    });
    check("a run is recorded", run.status === 200, JSON.stringify(run.json));

    // Session B: typed input with visible output, killed while running, which
    // is the kill route's own transcript path.
    const startB = await api("POST", "/api/student/practicals/run-session", {
      attemptId,
      language: "python",
      code: "print('B-starter')",
    });
    const sidB = String(startB.json.sessionId ?? "");
    check("session B starts", startB.status === 200 && Boolean(sidB), JSON.stringify(startB.json));

    const inputB = await api("POST", `/api/student/practicals/run-session/${sidB}/input`, {
      input: "print('B-output')",
    });
    check("input B is accepted", inputB.status === 200, JSON.stringify(inputB.json));

    let sawBOutput = false;
    for (let i = 0; i < 15 && !sawBOutput; i++) {
      const poll = await api("GET", `/api/student/practicals/run-session/${sidB}`);
      sawBOutput = String(poll.json.stdout ?? "").includes("B-output");
      if (!sawBOutput) await new Promise((r) => setTimeout(r, 400));
    }
    check("B's output reaches the runner", sawBOutput);
    const killB = await api("POST", `/api/student/practicals/run-session/${sidB}`);
    check("session B can be killed while running", killB.status === 200, JSON.stringify(killB.json));

    // Session C: the attempt is finished underneath the live session, which is
    // the poll route's closed-branch transcript path.
    const startC = await api("POST", "/api/student/practicals/run-session", {
      attemptId,
      language: "python",
      code: "print('C')",
    });
    const sidC = String(startC.json.sessionId ?? "");
    check("session C starts", startC.status === 200 && Boolean(sidC), JSON.stringify(startC.json));

    const finish = await api("POST", "/api/student/practicals/attempt", { action: "finish", attemptId });
    check("the attempt can be finished", finish.status === 200, JSON.stringify(finish.json));

    const pollC = await api("GET", `/api/student/practicals/run-session/${sidC}`);
    check("the closed branch reports exited + closed", pollC.json.closed === true, JSON.stringify(pollC.json).slice(0, 200));

    // A second question, so the page actually renders more than one row.
    const started2 = await api("POST", "/api/student/practicals/attempt", {
      action: "start",
      assignmentId: assignment.id,
      questionId: question2.id,
    });
    check("the second attempt starts", started2.status === 200, JSON.stringify(started2.json));

    // --- database assertions ------------------------------------------------
    const events = await prisma.practicalEvent.findMany({
      where: { attemptId },
      orderBy: { createdAt: "asc" },
    });
    const ofType = (t: string) => events.filter((e) => e.type === t);
    const detailOf = (id: string) => (events.find((e) => e.id === id)?.detail ?? {}) as Json;

    check("attempt-started was recorded", ofType("ATTEMPT_STARTED").length === 1, `got ${ofType("ATTEMPT_STARTED").length}`);
    check("code-save was recorded", ofType("CODE_SAVED").length === 1, `got ${ofType("CODE_SAVED").length}`);
    check("code-run was recorded", ofType("CODE_RUN").length === 1, `got ${ofType("CODE_RUN").length}`);

    const inputs = ofType("TERMINAL_INPUT");
    check("both typed inputs were recorded", inputs.length === 2, `got ${inputs.length}`);
    const inputDetails = inputs.map((e) => detailOf(e.id));
    check(
      "input details carry the typed text",
      inputDetails.some((d) => d.input === "exit()") && inputDetails.some((d) => d.input === "print('B-output')"),
      JSON.stringify(inputDetails)
    );

    const transcripts = ofType("TERMINAL_OUTPUT");
    check("one transcript per session (A deduped, B, C)", transcripts.length === 3, `got ${transcripts.length}`);
    const tDetails = transcripts.map((e) => detailOf(e.id));
    const sessionsSeen = tDetails.map((d) => String(d.sessionId ?? ""));
    check(
      "transcripts are for the right sessions",
      new Set(sessionsSeen).size === 3 && [sidA, sidB, sidC].every((s) => sessionsSeen.includes(s)),
      JSON.stringify(sessionsSeen)
    );
    check(
      "A's transcript survived the natural-exit path exactly once",
      sessionsSeen.filter((s) => s === sidA).length === 1
    );
    check(
      "B's transcript contains its output",
      tDetails.some((d) => String(d.stdout ?? "").includes("B-output")),
      JSON.stringify(tDetails.map((d) => String(d.stdout ?? "").slice(0, 60)))
    );

    // --- admin surface ------------------------------------------------------
    await loginAsAdmin(admin.id);

    const details = await getHtml(`/admin/students/${student.id}`);
    check("the student details page renders", details.status === 200, `got ${details.status}`);
    check("it offers Show Practical Activity", details.text.includes("Show Practical Activity"));
    check(
      "the option links to the activity page",
      details.text.includes(`/admin/students/${student.id}/practical-activity`)
    );

    const page = await getHtml(`/admin/students/${student.id}/practical-activity`);
    check("the activity page renders", page.status === 200, `got ${page.status}`);
    check("it names the set", page.text.includes(assignmentTitle));
    check("it groups attempts by set", page.text.includes("Attempts by set"));
    check("it shows both questions", page.text.includes(stem) && page.text.includes(`${stem} two`));
    check("it shows the finished attempt as done", page.text.includes("FINISHED"));
    check("it shows the in-progress attempt", page.text.includes("IN PROGRESS"));
    check("it shows saved code", page.text.includes("Saved code"));
    check("it shows the typed input", page.text.includes("Typed") && page.text.includes("exit()"));
    check("it shows terminal transcripts", page.text.includes("Session ended") && page.text.includes("B-output"));
    check("it shows the run output", page.text.includes("A-output-line"));
    check("it labels terminal events", page.text.includes("TERMINAL INPUT") && page.text.includes("TERMINAL OUTPUT"));
    check("it labels the code run", page.text.includes("CODE RUN"));
    check("it shows the summary stats", page.text.includes("Terminal inputs"));
    check("it lists doubts", page.text.includes("Practical doubts"));
    check("it lists untouched sets", page.text.includes("Published sets not started"));
  } finally {
    for (const step of undo.reverse()) await step();
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
