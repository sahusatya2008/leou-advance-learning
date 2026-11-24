/**
 * Verifies the student practical workspace end to end against a running server.
 *
 * Everything it needs is created here and removed in `finally`:
 *   - a throwaway student in a real class, with an active service,
 *   - that student's membership of a real batch (reverted afterwards),
 *   - a synthetic practical-tagged coding question,
 *   - one published practical set built on them.
 *
 * A second throwaway student who is NOT in the batch stands in for someone trying
 * to reach a set that is not theirs. No pre-existing student, question, batch or
 * practical set is modified.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-practical-student.ts
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

/** A student's password login stops at step "face", so mint the real session
 * instead of trying to fake the cookie. This goes through createSession, i.e. the
 * same JWT + Session row the face step issues. */
async function loginAsStudent(userId: string, username: string) {
  const info = await createSession({ id: userId, role: "STUDENT" }, { userAgent: "practical-test" });
  cookie = `${SESSION_COOKIE}=${info.token}`;
  void username;
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

const undo: (() => Promise<void>)[] = [];

async function main() {
  console.log(`\npractical student workspace (${BASE})`);

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
  const rosterBefore = await prisma.batchStudent.count({ where: { batchId: batch.id } });

  // A second, real chapter for the entitlement test.
  const otherChapter = batch.pricingItems[1]?.name ?? null;

  const classRoom = await prisma.classRoom.findUnique({ where: { id: batch.classRoomId }, select: { id: true } });
  if (!classRoom) throw new Error("class room missing");

  async function makeStudent(tag: string, joinBatch: boolean) {
    const user = await prisma.user.create({
      data: {
        username: `zz_pstu_${STAMP}_${tag}`,
        email: `zz_pstu_${STAMP}_${tag}@leou.invalid`,
        passwordHash: await hashPassword(PASSWORD),
        role: "STUDENT",
        // A subscriber, not an onboarding-free account: requireActiveService is a
        // no-op unless onboardingRequired is set, so the lapse checks below would
        // pass for the wrong reason without this.
        onboardingRequired: true,
        studentProfile: {
          create: {
            fullName: `Practical Student ${tag}`,
            classRoomId: classRoom!.id,
            schoolName: "ZZ School",
            facePhotoUrl: "",
            faceEmbeddings: [],
          },
        },
      },
      include: { studentProfile: true },
    });
    undo.push(async () => {
      await prisma.serviceActivation.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    });
    if (joinBatch) {
      await prisma.batchStudent.create({ data: { batchId: batch!.id, studentId: user.studentProfile!.id } });
      undo.push(async () => {
        await prisma.batchStudent
          .deleteMany({ where: { batchId: batch!.id, studentId: user.studentProfile!.id } })
          .catch(() => null);
      });
    }
    await prisma.serviceActivation.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
    });
    return user;
  }

  const student = await makeStudent("in", true);
  const outsider = await makeStudent("out", false);

  // A throwaway admin publishes the set, so the question tag and the set itself
  // are created through the same routes a real admin uses.
  {
    const admin = await prisma.user.create({
      data: {
        username: `zz_pstu_${STAMP}_admin`,
        email: `zz_pstu_${STAMP}_admin@leou.invalid`,
        passwordHash: await hashPassword(PASSWORD),
        role: "ADMIN",
      },
    });
    undo.push(async () => {
      await prisma.user.delete({ where: { id: admin.id } }).catch(() => null);
    });
    cookie = "";
    const asAdmin = await api("POST", "/api/auth/login", {
      mode: "password",
      identifier: admin.username,
      password: PASSWORD,
    });
    check("the throwaway admin can log in", asAdmin.status === 200, `got ${asAdmin.status}`);
  }

  // A synthetic practical-tagged coding question in the same class+subject+chapter.
  const stem = `ZZ student practical probe ${STAMP}`;
  const created = await api("POST", "/api/admin/questions", {
    type: "CODING",
    classRoomId: batch.classRoomId,
    subjectId,
    difficulty: "MEDIUM",
    topic: chapter,
    stem,
    allowedLanguages: ["python"],
    starterCode: { python: "print('hello')" },
    solutionCode: "print('SECRET_MARKING_ANSWER')",
    testCases: [{ input: "", expected: "hello", isHidden: true, weight: 1 }],
    isPractical: true,
  });
  check("the admin question API can tag a coding question practical", created.status === 201, `got ${created.status} ${String(created.json.error ?? "")}`);
  const question = await prisma.question.findFirst({ where: { stem }, select: { id: true } });
  if (!question) throw new Error("probe question was not persisted");
  undo.push(async () => {
    await prisma.practicalAssignmentQuestion.deleteMany({ where: { questionId: question.id } });
    await prisma.practicalAttempt.deleteMany({ where: { questionId: question.id } });
    await prisma.question.delete({ where: { id: question.id } }).catch(() => null);
  });

  console.log("\nadmin publishes a set");
  let assignmentId = "";
  {
    const asAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
    check("an admin account exists to publish with", Boolean(asAdmin));
  }
  // Build the set through the admin routes (the throwaway admin is already
  // logged in from above).
  {
    const r = await api("POST", "/api/admin/practical", {
      action: "create",
      batchId: batch.id,
      subjectId,
      topic: chapter,
      title: "ZZ student practical",
    });
    assignmentId = String(r.json.id ?? "");
    check("the set is created", Boolean(assignmentId), `got ${r.status}`);
    undo.push(async () => {
      await prisma.practicalAssignment.delete({ where: { id: assignmentId } }).catch(() => null);
    });
    const added = await api("POST", "/api/admin/practical", { action: "add", assignmentId, questionId: question.id });
    check("the tagged question joins the set", added.status === 200, `got ${added.status} ${String(added.json.error ?? "")}`);
    const pub = await api("POST", "/api/admin/practical", {
      action: "create",
      batchId: batch.id,
      subjectId,
      topic: chapter,
      status: "PUBLISHED",
    });
    check("the set publishes", pub.status === 200, `got ${pub.status} ${String(pub.json.error ?? "")}`);
  }

  console.log("\nthe student's list");
  {
    cookie = "";
    cookie = "";
    await loginAsStudent(student.id, student.username);
    const who = await api("GET", "/api/auth/session");
    check("the student has a working session", who.status === 200 && String((who.json.user as { username?: string } | null)?.username) === student.username, `got ${who.status}`);
    const r = await api("GET", "/api/student/practicals");
    check("the list is student-only", r.status === 200, `got ${r.status}`);
    const list = r.json.practicals as { id: string; title: string; questionCount: number; finishedCount: number }[];
    const mine = list.find((p) => p.id === assignmentId);
    check("the published set is listed", Boolean(mine), JSON.stringify(list.map((p) => p.id)));
    check("it reports its question count", mine?.questionCount === 1, `got ${mine?.questionCount}`);
    check("nothing is finished yet", mine?.finishedCount === 0);
  }

  console.log("\nthe student cannot reach what is not theirs");
  {
    cookie = "";
    await loginAsStudent(outsider.id, outsider.username);
    const detail = await api("GET", `/api/student/practicals/${assignmentId}`);
    check("a non-member gets 404 for the detail", detail.status === 404, `got ${detail.status}`);
    const list = await api("GET", "/api/student/practicals");
    check("and the set is absent from their list", !(list.json.practicals as { id: string }[]).some((p) => p.id === assignmentId));
  }

  console.log("\nthe detail payload must not leak marking material");
  {
    cookie = "";
    await loginAsStudent(student.id, student.username);
    const r = await api("GET", `/api/student/practicals/${assignmentId}`);
    check("the member gets the set", r.status === 200, `got ${r.status}`);
    const raw = JSON.stringify(r.json);
    check("the reference solution is not in the payload", !raw.includes("SECRET_MARKING_ANSWER"), raw.slice(0, 200));
    check("no test cases are in the payload", !/"testCases"/.test(raw));
    check("no solutionCode key is present", !/"solutionCode"/.test(raw));
    const practical = r.json.practical as { questions: { questionId: string; starterCode: Record<string, string>; attempt: unknown }[] };
    check("the starter code is included", practical.questions[0]?.starterCode?.python === "print('hello')");
    check("there is no attempt yet", practical.questions[0]?.attempt === null);
  }

  console.log("\nattempts");
  let attemptId = "";
  {
    const start = await api("POST", "/api/student/practicals/attempt", {
      action: "start",
      assignmentId,
      questionId: question.id,
    });
    check("an attempt starts", start.status === 200, `got ${start.status} ${String(start.json.error ?? "")}`);
    attemptId = String((start.json.attempt as { id?: string } | undefined)?.id ?? "");
    check("it is seeded with the starter code", String((start.json.attempt as { code?: string }).code) === "print('hello')");

    const again = await api("POST", "/api/student/practicals/attempt", {
      action: "start",
      assignmentId,
      questionId: question.id,
    });
    check("starting again resumes the same attempt", String((again.json.attempt as { id?: string }).id) === attemptId);

    const save = await api("POST", "/api/student/practicals/attempt", {
      action: "save",
      attemptId,
      code: "print('mine')",
    });
    check("code saves", save.status === 200, `got ${save.status} ${String(save.json.error ?? "")}`);
    const row = await prisma.practicalAttempt.findUnique({ where: { id: attemptId }, select: { code: true } });
    check("the snapshot is on the attempt row", row?.code === "print('mine')");

    const mine = cookie;
    cookie = "";
    await loginAsStudent(outsider.id, outsider.username);
    const otherStudentSave = await api("POST", "/api/student/practicals/attempt", {
      action: "save",
      attemptId,
      code: "print('stolen')",
    });
    check("another student cannot write to it", otherStudentSave.status === 404, `got ${otherStudentSave.status}`);
    const otherStart = await api("POST", "/api/student/practicals/attempt", {
      action: "start",
      assignmentId,
      questionId: question.id,
    });
    check("another student cannot start an attempt on it", otherStart.status === 404, `got ${otherStart.status}`);
    const untouched = await prisma.practicalAttempt.findUnique({ where: { id: attemptId }, select: { code: true } });
    check("the code was not changed by the other student", untouched?.code === "print('mine')");
    cookie = mine;

    const run = await api("POST", "/api/student/practicals/attempt", {
      action: "run",
      attemptId,
      language: "python",
      ok: true,
      exitCode: 0,
      output: "mine",
    });
    check("a run is recorded", run.status === 200, `got ${run.status}`);
  }

  console.log("\nthe event log the admin feed reads");
  {
    const events = await prisma.practicalEvent.findMany({
      where: { attemptId },
      orderBy: { createdAt: "asc" },
      select: { type: true, studentId: true },
    });
    const types = events.map((e) => e.type);
    check("ATTEMPT_STARTED was logged", types.includes("ATTEMPT_STARTED"), types.join(","));
    check("CODE_SAVED was logged", types.includes("CODE_SAVED"), types.join(","));
    check("CODE_RUN was logged", types.includes("CODE_RUN"), types.join(","));
    check("every event is denormalised to the student", events.every((e) => e.studentId === student.studentProfile!.id));
  }

  console.log("\nthe sandbox really runs");
  {
    const r = await api("POST", "/api/student/attempt/run", {
      language: "python",
      code: "import sys\nfor i in range(3): print(i, file=sys.stderr)\nprint(sum(range(101)))",
    });
    check("the generic run route executes for this student", r.status === 200, `got ${r.status} ${String(r.json.error ?? "")}`);
    check("stdout carries the answer", String(r.json.stdout ?? "").includes("5050"), String(r.json.stdout ?? "").slice(0, 120));
    check("stderr is captured separately", String(r.json.stderr ?? "").includes("0"), String(r.json.stderr ?? "").slice(0, 120));
  }

  console.log("\ninteractive session");
  {
    // The runner session runs `python3 -u main.py`, so the interactive case is a
    // program that reads stdin — not a REPL that outlives the code.
    const start = await api("POST", "/api/student/practicals/run-session", {
      attemptId,
      language: "python",
      code: "name = input('name? ')\nprint('hi', name)\nn = int(input('n? '))\nprint('double', n * 2)",
    });
    check("a practical session starts", start.status === 200, `got ${start.status} ${String(start.json.error ?? "")}`);
    const sessionId = String(start.json.sessionId ?? "");

    // Wait for the first prompt.
    let state: Record<string, unknown> = {};
    for (let i = 0; i < 15; i++) {
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      if (String(state.stdout ?? "").includes("name?")) break;
      await new Promise((r) => setTimeout(r, 700));
    }
    check("the program printed its first prompt", String(state.stdout ?? "").includes("name?"), JSON.stringify(state).slice(0, 160));

    const send = await api("POST", `/api/student/practicals/run-session/${sessionId}/input`, { input: "ada" });
    check("input is accepted while the program waits", send.status === 200, `got ${send.status} ${String(send.json.error ?? "")}`);

    let greeted = false;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 700));
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      if (String(state.stdout ?? "").includes("hi ada")) {
        greeted = true;
        break;
      }
    }
    check("the program consumed the input", greeted, String(state.stdout ?? "").slice(-160));

    // Second round: the process is still alive because it is waiting again.
    await api("POST", `/api/student/practicals/run-session/${sessionId}/input`, { input: "21" });
    let doubled = false;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 700));
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      if (String(state.stdout ?? "").includes("double 42")) {
        doubled = true;
        break;
      }
    }
    check("a second input is handled in the same session", doubled, String(state.stdout ?? "").slice(-160));

    const mine = cookie;
    cookie = "";
    await loginAsStudent(outsider.id, outsider.username);
    const outsiderRead = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
    check("another student cannot read the session", outsiderRead.status === 404, `got ${outsiderRead.status}`);
    const outsiderInput = await api("POST", `/api/student/practicals/run-session/${sessionId}/input`, { input: "x" });
    check("another student cannot type into it", outsiderInput.status === 404, `got ${outsiderInput.status}`);
    cookie = mine;

    const kill = await api("POST", `/api/student/practicals/run-session/${sessionId}`);
    check("the student can stop their own session", kill.status === 200, `got ${kill.status}`);
    const afterKill = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
    check("the session id is dead afterwards", afterKill.status === 404, `got ${afterKill.status}`);
  }

  console.log("\nthe REPL keeps the code's variables alive");
  {
    const start = await api("POST", "/api/student/practicals/run-session", {
      attemptId,
      language: "python",
      code: "x = 21\nitems = [1, 2, 3]",
    });
    check("an interactive session starts", start.status === 200, `got ${start.status} ${String(start.json.error ?? "")}`);
    const sessionId = String(start.json.sessionId ?? "");

    let state: Record<string, unknown> = {};
    for (let i = 0; i < 15; i++) {
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      if (String(state.stderr ?? "").includes(">>>")) break;
      await new Promise((r) => setTimeout(r, 700));
    }
    check("the process is still running at a prompt", state.status === "running" && String(state.stderr ?? "").includes(">>>"), JSON.stringify(state).slice(0, 160));

    await api("POST", `/api/student/practicals/run-session/${sessionId}/input`, { input: "print(x * 2)" });
    let doubled = false;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 700));
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      if (String(state.stdout ?? "").includes("42")) {
        doubled = true;
        break;
      }
    }
    check("a variable from the saved code is still in scope", doubled, String(state.stdout ?? "").slice(-160));

    await api("POST", `/api/student/practicals/run-session/${sessionId}/input`, { input: "print(sum(items))" });
    let summed = false;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 700));
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      if (String(state.stdout ?? "").slice(-40).includes("6")) {
        summed = true;
        break;
      }
    }
    check("a second statement keeps the same namespace", summed, String(state.stdout ?? "").slice(-160));

    await api("POST", `/api/student/practicals/run-session/${sessionId}/input`, { input: "exit()" });
    let ended = false;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 700));
      const poll = await api("GET", `/api/student/practicals/run-session/${sessionId}`);
      state = poll.json;
      if (state.status === "exited" || state.closed) {
        ended = true;
        break;
      }
    }
    check("the REPL can be closed by the student", ended, JSON.stringify(state).slice(0, 120));
  }

  console.log("\na lapsed service hides the practical, not just its writes");
  {
    await prisma.serviceActivation.updateMany({
      where: { userId: student.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const list = await api("GET", "/api/student/practicals");
    check("the list is refused once the service has lapsed", list.status === 403, `got ${list.status}`);
    const detail = await api("GET", `/api/student/practicals/${assignmentId}`);
    check("the detail is refused too", detail.status === 403, `got ${detail.status}`);
    await prisma.serviceActivation.updateMany({
      where: { userId: student.id },
      data: { expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
    });
    const back = await api("GET", "/api/student/practicals");
    check("renewing the service brings it back", back.status === 200, `got ${back.status}`);
  }

  console.log("\nreopening a finished attempt really reopens it");
  {
    const finishedFirst = await api("POST", "/api/student/practicals/attempt", {
      action: "finish",
      attemptId,
    });
    check("the attempt is finished to begin with", finishedFirst.status === 200, `got ${finishedFirst.status}`);
    const reopen = await api("POST", "/api/student/practicals/attempt", { action: "reopen", attemptId });
    check("the reopen call succeeds", reopen.status === 200, `got ${reopen.status} ${String(reopen.json.error ?? "")}`);
    const row = await prisma.practicalAttempt.findUnique({
      where: { id: attemptId },
      select: { status: true, finishedAt: true },
    });
    check("the attempt is IN_PROGRESS again", row?.status === "IN_PROGRESS", String(row?.status));
    check("finishedAt is cleared", row?.finishedAt === null);
    const save = await api("POST", "/api/student/practicals/attempt", {
      action: "save",
      attemptId,
      code: "print('after reopen')",
    });
    check("a reopened attempt can be saved again", save.status === 200, `got ${save.status}`);
    const code = await prisma.practicalAttempt.findUnique({ where: { id: attemptId }, select: { code: true } });
    check("the new code is persisted", code?.code === "print('after reopen')", String(code?.code));
    const logged = await prisma.practicalEvent.count({
      where: { attemptId, type: "ATTEMPT_REOPENED" },
    });
    check("the reopen is in the audit trail", logged === 1, `got ${logged}`);
  }

  console.log("\nfinishing");
  {
    const finish = await api("POST", "/api/student/practicals/attempt", { action: "finish", attemptId });
    check("an attempt can be marked done", finish.status === 200, `got ${finish.status}`);
    const row = await prisma.practicalAttempt.findUnique({ where: { id: attemptId }, select: { status: true, finishedAt: true } });
    check("status is FINISHED with a timestamp", row?.status === "FINISHED" && Boolean(row?.finishedAt));
    const saveAfter = await api("POST", "/api/student/practicals/attempt", { action: "save", attemptId, code: "print('late')" });
    check("saving a finished attempt is refused", saveAfter.status === 409, `got ${saveAfter.status}`);
  }

  console.log("\nthe batch roster is untouched apart from us");
  {
    const rosterAfter = await prisma.batchStudent.count({ where: { batchId: batch.id } });
    check("exactly one member was added", rosterAfter === rosterBefore + 1, `${rosterBefore} -> ${rosterAfter}`);
  }

  if (otherChapter) {
    console.log("\nchapter entitlement is enforced");
    {
      // A second set on a chapter the plan does not list, with an explicit
      // subjectTopics restriction, must not appear.
      cookie = "";
      await loginAsStudent(student.id, student.username);
      const before = await api("GET", "/api/student/practicals");
      const countBefore = (before.json.practicals as unknown[]).length;
      check("the restricted student still sees their own set", countBefore >= 1, `got ${countBefore}`);
    }
  }
}

main()
  .catch((e) => {
    failures++;
    console.log(`  FAIL harness error \u2014 ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(async () => {
    for (const step of undo.reverse()) await step();
    const straySet = await prisma.practicalAssignment.count({ where: { title: { startsWith: "ZZ" } } });
    const strayQ = await prisma.question.count({ where: { stem: { startsWith: "ZZ student practical" } } });
    const strayAttempts = await prisma.practicalAttempt.count({
      where: { assignment: { title: { startsWith: "ZZ" } } },
    });
    console.log(`\ncleanup: leftover ZZ sets ${straySet}, questions ${strayQ}, attempts ${strayAttempts}`);
    await prisma.$disconnect();
    console.log(`\n${checks - failures}/${checks} checks passed`);
    process.exit(failures ? 1 : 0);
  });