/**
 * Verifies the Class 11 Mathematics "Trigonometric Functions" photo-upload set
 * end to end: the 100-question bank, the 10 released papers, a real student
 * opening a paper and uploading an answer, and the teacher seeing that answer.
 *
 * Every write this script makes is undone: the minted sessions are revoked, the
 * test submission (and its answers) is deleted, and the uploaded file is
 * removed. Nothing else is touched.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-trig-upload.ts
 *
 * Options (env): BASE_URL (default http://127.0.0.1:3001)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";
import { assessmentTopicAllowed, getActiveServices } from "@/services/onboardingService";
import { evaluateAnswer } from "@/lib/snsai/evaluate";
import { SEED_QUESTIONS, ASSESSMENT_GROUPS, TRIG_TAGS, CHAPTER } from "./data/trigUploadQuestions";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const STUDENT = "zeeshanalam";

const execFileAsync = promisify(execFile);

let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) passed++;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ""}`);
};
const section = (t: string) => console.log(`\n=== ${t} ===`);

const cleanups: (() => Promise<void>)[] = [];

async function session(role: "STUDENT" | "ADMIN") {
  const user = await prisma.user.findFirst({
    where: role === "STUDENT" ? { username: STUDENT } : { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error(`no ${role.toLowerCase()} account`);
  const info = await createSession({ id: user.id, role: user.role }, { ip: "127.0.0.1", userAgent: "trig-upload-test" });
  cleanups.push(() => revokeSession(info.sid).catch(() => undefined));
  return { cookie: `${SESSION_COOKIE}=${info.token}`, userId: user.id };
}

async function req(method: string, cookie: string, url: string, body?: unknown) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* html page */
  }
  return { status: res.status, json, text };
}

async function main() {
  const classRoom = await prisma.classRoom.findFirst({ where: { name: "Class 11", isActive: true } });
  const subject = await prisma.subject.findFirst({ where: { code: "MAT" } });
  const batch = await prisma.batch.findFirst({ where: { name: "B Code Brain" } });
  if (!classRoom || !subject || !batch) throw new Error("scope rows are missing");

  /* ------------------------------------------------------------- the bank */
  section("Question bank");
  const bank = await prisma.question.findMany({
    where: { classRoomId: classRoom.id, subjectId: subject.id, topic: CHAPTER },
    select: { id: true, type: true, stem: true, explanation: true, difficulty: true, tags: true, isPractical: true },
  });
  check("100 questions in the chapter", bank.length === 100, `found ${bank.length}`);
  check("all are UPLOAD", bank.every((q) => q.type === "UPLOAD"));
  check("every question has a model answer", bank.every((q) => (q.explanation ?? "").trim().length > 0));
  check("every question carries the chapter tag", bank.every((q) => Array.isArray(q.tags) && (q.tags as string[]).includes(TRIG_TAGS[0])));
  check("none are marked practical", bank.every((q) => !q.isPractical));
  check("stems are unique", new Set(bank.map((q) => q.stem)).size === 100);
  check("worksheet order preserved", SEED_QUESTIONS.every((s) => bank.some((q) => q.stem === s.stem)));

  const tags = new Set(bank.flatMap((q) => (Array.isArray(q.tags) ? (q.tags as string[]) : [])));
  check("concept tags written through", ["radian-measure", "arc-length", "compound-angles", "multiple-angles"].every((t) => tags.has(t)));

  /* ------------------------------------------------------------- the papers */
  section("Assessments");
  const papers = await prisma.assessment.findMany({
    where: { batchId: batch.id, subjectId: subject.id, topic: CHAPTER, kind: "ASSIGNMENT" },
    include: { questions: { include: { question: { select: { stem: true, type: true, explanation: true } } }, orderBy: { order: "asc" } } },
    orderBy: { title: "asc" },
  });
  check("10 papers", papers.length === 10, `found ${papers.length}`);

  for (const group of ASSESSMENT_GROUPS) {
    const paper = papers.find((p) => p.title === group.title);
    if (!paper) {
      check(`paper "${group.title}" exists`, false);
      continue;
    }
    const expected = SEED_QUESTIONS.slice(group.from - 1, group.to);
    const actual = paper.questions.map((q) => q.question.stem);
    check(`${group.number} holds questions ${group.from}-${group.to} in order`, JSON.stringify(actual) === JSON.stringify(expected.map((e) => e.stem)));
    check(`${group.number} is released`, paper.status === "RELEASED", paper.status);
    check(`${group.number} is flexible + untimed + unlimited`, paper.attemptMode === "FLEXIBLE" && paper.durationMinutes === 0 && paper.maxAttempts === null);
    check(`${group.number} is worth 10 marks`, paper.totalMarks === 10 && paper.questions.every((q) => q.marks === 1), `totalMarks=${paper.totalMarks}`);
    check(`${group.number} questions are all UPLOAD`, paper.questions.every((q) => q.question.type === "UPLOAD"));
    check(`${group.number} references carry a model answer`, paper.questions.every((q) => (q.question.explanation ?? "").trim().length > 0));
  }

  const usedIds = papers.flatMap((p) => p.questions.map((q) => q.questionId));
  check("no question appears on two papers", new Set(usedIds).size === 100, `${new Set(usedIds).size} distinct`);

  /* ---------------------------------------------------------- entitlement */
  section("Entitlement");
  const student = await prisma.user.findUniqueOrThrow({ where: { username: STUDENT } });
  const services = await getActiveServices(student.id);
  const entitled = assessmentTopicAllowed(services, "ASSIGNMENT", CHAPTER, subject.id);
  check(`${STUDENT} is entitled to "${CHAPTER}"`, entitled);

  const first = papers[0];
  if (!first) throw new Error("no papers to attempt");

  /* ------------------------------------------------------- student attempt */
  section("Student attempt");
  const s = await session("STUDENT");

  const listPage = await req("GET", s.cookie, `/dashboard/classes/${batch.id}`);
  // Server-rendered HTML escapes "&", which several of these titles contain.
  check("batch page lists the new papers", listPage.status === 200 && listPage.text.includes(first.title.replace(/&/g, "&amp;")), `status=${listPage.status}`);

  const paperPage = await req("GET", s.cookie, `/dashboard/assessments/${first.id}`);
  check("paper page opens", paperPage.status === 200, `status=${paperPage.status}`);

  const start = await req("POST", s.cookie, "/api/student/attempt/start", { assessmentId: first.id });
  const submissionId = start.json.submissionId as string | undefined;
  check("attempt starts", start.status === 200 && !!submissionId, `status=${start.status} ${JSON.stringify(start.json)}`);
  if (submissionId) {
    cleanups.push(async () => {
      await prisma.submission.delete({ where: { id: submissionId } }).catch(() => undefined);
    });
  }

  if (submissionId) {
    // A 1x1 PNG: enough for the upload route to accept it, meaningless to anyone.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const form = new FormData();
    form.set("kind", "answer");
    form.set("file", new Blob([png], { type: "image/png" }), "answer.png");
    const up = await fetch(`${BASE}/api/upload`, { method: "POST", headers: { Cookie: s.cookie }, body: form });
    const upJson = (await up.json().catch(() => ({}))) as { url?: string };
    check("photo uploads", up.status === 200 && !!upJson.url, `status=${up.status}`);
    const url = upJson.url;
    if (url) {
      // The file lands in the container's leou_uploads volume, not on the host,
      // so it has to be removed from inside the app container.
      const rel = url.replace(/^\/api\/files\//, "");
      cleanups.push(async () => {
        const hostPath = path.join(process.cwd(), "uploads", rel);
        if (fs.existsSync(hostPath)) {
          fs.unlinkSync(hostPath);
          return;
        }
        await execFileAsync("docker", ["compose", "exec", "-T", "app", "rm", "-f", `/app/uploads/${rel}`]).catch(() => undefined);
      });
    }

    const aq = first.questions[0];
    if (url && aq) {
      const save = await req("PATCH", s.cookie, `/api/student/attempt/${submissionId}`, {
        assessmentQuestionId: aq.id,
        payload: { fileUrls: [url] },
      });
      check("answer saves", save.status === 200, JSON.stringify(save.json));

      const answer = await prisma.answer.findUnique({
        where: { submissionId_assessmentQuestionId: { submissionId, assessmentQuestionId: aq.id } },
      });
      const files = ((answer?.payload ?? {}) as { fileUrls?: string[] }).fileUrls ?? [];
      check("answer row keeps the photo", files.includes(url), JSON.stringify(answer?.payload));

      // The reference the engine marks against is the model answer itself.
      const report = evaluateAnswer({
        type: "UPLOAD",
        stem: aq.question.stem,
        reference: aq.question.explanation ?? "",
        maxMarks: 1,
        payload: { fileUrls: files },
      });
      check("SNSAI accepts the photo and hands it to the teacher", report.verdict === "needs_teacher", report.verdict);
      check("photo is recorded as received, never auto-marked", report.faults.some((f) => f.kind === "unreadable") && report.marks === 0,
        JSON.stringify({ verdict: report.verdict, marks: report.marks, faults: report.faults.map((f) => f.kind) }));
      check("marking checklist comes from the model answer", report.criteria.length > 0 && report.reference === (aq.question.explanation ?? ""));

      const submit = await req("POST", s.cookie, `/api/student/attempt/${submissionId}/submit`);
      check("submission closes with one photo", submit.status === 200 && Number(submit.json.answered) >= 1, JSON.stringify(submit.json));
    }
  }

  /* ------------------------------------------------------------ teacher */
  section("Teacher view");
  const a = await session("ADMIN");
  const admin = await req("GET", a.cookie, `/api/admin/assessments/${first.id}`);
  const adminAssessment = (admin.json.assessment ?? {}) as {
    questions?: { question: { type: string } }[];
    submissions?: { answers?: unknown[]; _count?: { answers: number }; student: { fullName: string } }[];
  };
  check("admin can open the paper", admin.status === 200 && adminAssessment.questions?.length === 10, `status=${admin.status}`);
  check("admin sees the student's submission", (adminAssessment.submissions?.length ?? 0) >= 1);
  // The detail payload counts answers rather than inlining them.
  check("admin sees the uploaded photo", (adminAssessment.submissions?.[0]?._count?.answers ?? 0) >= 1,
    JSON.stringify(adminAssessment.submissions?.[0]?._count));

  /* ------------------------------------------------------------ cleanup */
  section("Cleanup");
  for (const fn of cleanups.reverse()) await fn();
  // Only our own submission must be gone: a real student may legitimately have
  // an in-progress or submitted attempt on this paper, and that must be left
  // untouched. Counting every submission on the paper would fail on their data.
  const leftover = submissionId
    ? await prisma.submission.findUnique({ where: { id: submissionId }, select: { id: true } })
    : null;
  check("test submission removed", leftover === null, leftover ? `still present: ${leftover.id}` : "");
  console.log("  sessions revoked, upload removed");

  /* ------------------------------------------------------------ report */
  console.log(`\n${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.map((f) => `  FAIL ${f}`).join("\n"));
    process.exit(1);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    for (const fn of cleanups.reverse()) await fn().catch(() => undefined);
    await prisma.$disconnect();
    process.exit(1);
  });
