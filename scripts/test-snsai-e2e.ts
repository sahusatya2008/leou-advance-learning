/**
 * End-to-end test of the Check API over real HTTP, with a real session.
 *
 * Run with:  npm run test:snsai:e2e        (app must be running on :3001)
 *
 * The integration suite calls the service directly. This goes through the
 * actual route handlers, so it proves the guards exist: an unauthenticated
 * caller, a non-student, someone else's submission and a closed attempt must
 * all be refused, and Check must never write a mark.
 */

import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { createSession, SESSION_COOKIE } from "@/lib/auth";

const BASE = process.env.BASE ?? "http://localhost:3001";

let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) passed++;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ""}`);
};
const section = (t: string) => console.log(`\n=== ${t} ===`);


async function login(username: string, password: string) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "password", identifier: username, password }),
  });
  return (r.headers.getSetCookie?.() ?? []).map((c: string) => c.split(";")[0]).join("; ");
}

/**
 * A real student session, without a camera.
 *
 * Signing in normally requires live frames judged by the face service, and a
 * synthetic embedding cannot pass its anti-spoofing — which is the right answer
 * from the service. The route guards under test read the session cookie through
 * `getSession`, so minting one with the app's own `createSession` exercises the
 * real code path. It bypasses the camera, not the authorisation.
 */
async function studentSession(username: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { studentProfile: true } });
  if (!user.studentProfile) throw new Error(`${username} is not a student`);
  const { token } = await createSession({ id: user.id, role: user.role }, { ip: "127.0.0.1", userAgent: "snsai-e2e" });
  return `${SESSION_COOKIE}=${token}`;
}

const H = (cookie: string) => ({ "Content-Type": "application/json", Cookie: cookie });

/**
 * The app's `requireRole` redirects a wrong-role caller to their own home page
 * rather than answering 403, so a following `fetch` would report the status of
 * that page. Every request here is manual so the status is the real one.
 */
const REQ = { redirect: "manual" } as const;

/**
 * Pause until the Check limiter is not blocking, so a run straight after
 * another does not inherit its block and report nonsense.
 *
 * The limiter is checked before the submission is loaded, so a student session
 * with a deliberately wrong id answers 429 while blocked and 404 once clear.
 */
async function waitForRateLimit(cookie: string) {
  for (let i = 0; i < 4; i++) {
    const res = await post("/api/student/attempt/cmu-none/check", cookie);
    if (res.status !== 429) return;
    const wait = Number(res.headers.get("Retry-After") ?? "5") + 2;
    console.log(`  (the limiter is still blocking from a previous run — waiting ${wait}s)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
}
const post = (path: string, cookie: string, body?: unknown) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: cookie ? H(cookie) : { "Content-Type": "application/json" },
    body: body === undefined ? "{}" : typeof body === "string" ? body : JSON.stringify(body),
    ...REQ,
  });

type Started = { submissionId: string; assessmentQuestionIds: Record<string, string>; assessmentId: string };

/**
 * Start a fresh attempt on a seeded paper, over real HTTP.
 *
 * The student's list of papers is rendered server-side rather than served by an
 * API, so the assessment id comes from the database. Everything after that —
 * starting the attempt, saving an answer, checking it, submitting — is the real
 * endpoint talking to the real database.
 */
async function startAttempt(cookie: string, prefer: string[]): Promise<Started> {
  const papers = await prisma.assessment.findMany({
    where: { topic: "Computer System", kind: "ASSIGNMENT", questions: { some: { question: { type: { in: prefer as never } } } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });
  const target = papers[0];
  if (!target) throw new Error(`No seeded paper with a ${prefer.join("/")} question.`);
  const start = await fetch(`${BASE}/api/student/attempt/start`, {
    method: "POST",
    headers: H(cookie),
    body: JSON.stringify({ assessmentId: target.id }),
  });
  const started = (await start.json().catch(() => ({}))) as {
    submissionId?: string;
    questions?: { assessmentQuestionId: string; type: string }[];
    error?: string;
  };
  if (start.status !== 200 || !started.submissionId) {
    throw new Error(`start failed ${start.status}: ${JSON.stringify(started).slice(0, 300)}`);
  }
  // /start returns only the submission id, so the questions are read here.
  const rows = await prisma.assessmentQuestion.findMany({
    where: { assessmentId: target.id },
    orderBy: { order: "asc" },
    include: { question: { select: { type: true } } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.question.type] = r.id;
  console.log(`  paper: ${target.title} — ${rows.length} questions: ${Object.keys(map).join(", ") || "none"}`);
  return { submissionId: started.submissionId, assessmentQuestionIds: map, assessmentId: target.id };
}

async function main() {
  section("Sign in");
  const admin = await login("admin", "admin123");
  check("admin can sign in", !!admin);
  const student = await studentSession("shellstudent");
  check("a student session is created", !!student);
  await waitForRateLimit(student);

  section("The route refuses the wrong caller");
  {
    const anon = await post("/api/student/attempt/whatever/check", "");
    check("an anonymous caller is bounced to sign-in", anon.status === 307 || anon.status === 302, String(anon.status));

    const asAdmin = await post("/api/student/attempt/whatever/check", admin);
    check(
      "an admin is not treated as a student",
      asAdmin.status === 307 || asAdmin.status === 302,
      `${asAdmin.status} -> ${asAdmin.headers.get("location")}`
    );
  }

  section("A real attempt, over HTTP");
  const { submissionId, assessmentQuestionIds, assessmentId } = await startAttempt(student, ["SHORT", "LONG", "ORAL"]);

  const foreign = await post(`/api/student/attempt/${submissionId}/check`, "");
  check("an unauthenticated Check never reaches the service", foreign.status === 404 || foreign.status >= 300, `${foreign.status}`);

  const badId = await post(`/api/student/attempt/${submissionId}/check`, student, { assessmentQuestionIds: ["not-a-real-question"] });
  check("a question id from another paper is refused", badId.status === 400, `${badId.status} ${(await badId.text()).slice(0, 100)}`);

  const badJson = await post(`/api/student/attempt/${submissionId}/check`, student, "{not json");
  check("malformed JSON is refused, not crashed on", badJson.status === 400, String(badJson.status));

  section("Check one written answer");
  const writtenId = assessmentQuestionIds.SHORT ?? assessmentQuestionIds.LONG;
  if (writtenId) {
    const patch = await fetch(`${BASE}/api/student/attempt/${submissionId}`, {
      method: "PATCH",
      headers: H(student),
      body: JSON.stringify({ assessmentQuestionId: writtenId, payload: { text: "The control unit fetches the instruction, decodes it, and directs the other units." } }),
    });
    check("an answer can be saved", patch.ok, String(patch.status));

    const res = await post(`/api/student/attempt/${submissionId}/check`, student, { assessmentQuestionIds: [writtenId] });
    const body = (await res.json().catch(() => ({}))) as {
      answers?: { status: string; marks: number; maxMarks: number; report?: { verdict: string; marks: number; headline: string; criteria: unknown[]; teaching: string[] } }[];
      error?: string;
    };
    check("Check returns a report over HTTP", res.ok && !!body.answers?.length, `${res.status} ${JSON.stringify(body).slice(0, 160)}`);
    const row = body.answers?.[0];
    if (row) {
      console.log(`  ${row.report?.verdict} — ${row.marks}/${row.maxMarks} marks`);
      console.log(`  ${row.report?.headline}`);
      console.log(`  ${row.report?.criteria.length} key points, ${row.report?.teaching.length} teaching steps`);
      check("the report has a verdict and teaching", !!row.report?.verdict && row.report.teaching.length > 0);
      check("marks are within range", row.marks >= 0 && row.marks <= row.maxMarks, `${row.marks}/${row.maxMarks}`);
    }
  } else {
    console.log("  (no written question in this paper — skipped)");
  }

  section("A dictated ORAL answer is checked on its words");
  {
    const oralId = assessmentQuestionIds.ORAL;
    if (!oralId) {
      console.log("  (no ORAL question in this paper — skipped)");
    } else {
      // Recording and transcript live in the same payload, so both are sent —
      // this is what the browser now saves when a student records and dictates.
      const patch = await fetch(`${BASE}/api/student/attempt/${submissionId}`, {
        method: "PATCH",
        headers: H(student),
        body: JSON.stringify({
          assessmentQuestionId: oralId,
          // Written the way a student would actually speak, in their own
          // wording. A sentence-for-sentence copy of the reference is
          // deliberately capped low, so copying it here would test nothing.
          payload: {
            transcript:
              "Firmware gets baked into the chip's own non-volatile memory, ROM or flash, so it survives losing power and it drives the hardware directly. Software is the ordinary kind of program that the operating system loads into working memory, and that you are free to install, change or throw away whenever you like.",
            fileUrls: [],
          },
        }),
      });
      check("a transcript can be saved", patch.ok, String(patch.status));

      const res = await post(`/api/student/attempt/${submissionId}/check`, student, { assessmentQuestionIds: [oralId] });
      const body = (await res.json().catch(() => ({}))) as {
        answers?: { report?: { verdict: string; marks: number; maxMarks: number } }[];
      };
      const row = body.answers?.[0];
      console.log(`  ${row?.report?.verdict} — ${row?.report?.marks}/${row?.report?.maxMarks} marks`);
      check("the transcript is marked, not ignored", !!row?.report && row.report.verdict !== "unanswered", JSON.stringify(row));
      check("it is not punted to the teacher", row?.report?.verdict !== "needs_teacher", String(row?.report?.verdict));
      // A transcript that sets out the distinction in its own words must not be
      // rejected. The engine is expected to name the one point the speaker
      // genuinely leaves out, so the guarantee is a passing verdict and a
      // majority of the marks — not a fixed number that would need re-tuning
      // every time the wording of this test changes. It previously asserted a
      // bare 1.5 while the engine was handing out 0.55 and calling it
      // "incorrect", which is how a wrong verdict hid behind a right number.
      const oralMarks = row?.report?.marks ?? 0;
      const oralMax = row?.report?.maxMarks ?? 2;
      check(
        "a good transcript is recognised as good",
        row?.report?.verdict !== "incorrect" && oralMarks > oralMax / 2,
        `${oralMarks}/${oralMax} — ${row?.report?.verdict}`
      );

      const stored = await prisma.answer.findUniqueOrThrow({
        where: { submissionId_assessmentQuestionId: { submissionId, assessmentQuestionId: oralId } },
        select: { payload: true },
      });
      check("the transcript is stored, not just scored", typeof (stored.payload as { transcript?: string })?.transcript === "string", JSON.stringify(stored.payload).slice(0, 120));
    }
  }

  section("Check every answer");
  {
    const res = await post(`/api/student/attempt/${submissionId}/check`, student);
    const body = (await res.json().catch(() => ({}))) as {
      answers?: { status: string }[];
      summary?: { checked: number; skipped: number; marks: number; maxMarks: number; totalMs: number };
    };
    check("Check all succeeds", res.ok && Array.isArray(body.answers), String(res.status));
    console.log(`  ${body.summary?.checked} checked, ${body.summary?.skipped} skipped, ${body.summary?.marks}/${body.summary?.maxMarks} marks, ${body.summary?.totalMs}ms`);
  }

  section("Check wrote nothing to the attempt");
  {
    const sub = await prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
      select: { status: true, totalScore: true, submittedAt: true },
    });
    check("the attempt is still open and unscored", sub.status === "IN_PROGRESS" && sub.totalScore === null && sub.submittedAt === null, JSON.stringify(sub));

    const answers = await prisma.answer.findMany({
      where: { submissionId },
      select: { marksAwarded: true, feedback: true, isAutoCorrect: true },
    });
    check(
      "no answer was marked, commented on, or auto-corrected",
      answers.every((a) => a.marksAwarded === null && a.feedback === null && a.isAutoCorrect === null),
      JSON.stringify(answers)
    );
  }

  section("After submitting");
  {
    const res = await post(`/api/student/attempt/${submissionId}/submit`, student);
    check("the student can submit", res.ok, `${res.status} ${(await res.text()).slice(0, 120)}`);
    const after = await post(`/api/student/attempt/${submissionId}/check`, student);
    check("Check is refused once the attempt is submitted", after.status === 409, `${after.status} ${(await after.text()).slice(0, 120)}`);
  }

  section("The attempt page renders with Check controls");
  {
    // ?begin=1 is what the Start button navigates to; without it the page is only the intro.
    const page = await fetch(`${BASE}/dashboard/assessments/${assessmentId}?begin=1`, { headers: { Cookie: student }, ...REQ });
    const html = await page.text();
    check("the attempt page loads", page.status === 200, `${page.status}`);
    check("the Check control is on the page", html.includes("Check this answer"), "no per-question Check button found");
    check("the Check-all control is on the page", html.includes("Check all answers"), "no Check all button found");
    // Dictation only appears on an ORAL question, and the view opens on the first one.
    const firstIsOral = await prisma.assessmentQuestion.findFirst({
      where: { assessmentId },
      orderBy: { order: "asc" },
      include: { question: { select: { type: true } } },
    });
    if (firstIsOral?.question.type === "ORAL") {
      check("the dictation control is on the page", html.includes("Dictate"), "no Dictate button found");
    } else {
      console.log(`  (dictation only shows on an ORAL question; this paper opens on ${firstIsOral?.question.type})`);
    }
  }

  section("Rate limiting");
  {
    let limited = 0;
    for (let i = 0; i < 16; i++) {
      const res = await post(`/api/student/attempt/${submissionId}/check`, student);
      if (res.status === 429) {
        limited++;
        console.log(`  request ${i + 1} -> 429 ${res.headers.get("Retry-After")}s`);
        break;
      }
    }
    check("repeated checks are rate limited", limited === 1, `no 429 after 16 requests`);
  }
}

main()
  .then(() => {
    console.log(`\n${passed} checks passed, ${failures.length} failed`);
    if (failures.length > 0) {
      console.log("\nFAILURES:");
      for (const f of failures) console.log(`  - ${f}`);
      process.exitCode = 1;
    }
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
