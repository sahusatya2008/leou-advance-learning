/**
 * SNSAI integration test against the real database and the real code runner.
 *
 * Run with:  npm run test:snsai:integration
 *
 * The unit suite proves the engine marks answers correctly. This proves the
 * parts around it are wired: that Check finds a student's submission, refuses
 * one belonging to somebody else, reads the admin's reference answer, really
 * executes submitted code, and never writes a mark.
 *
 * It creates its own submissions, checks them, and deletes them again.
 */

import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { checkSubmission, isFailure } from "@/services/snsaiService";
import type { Prisma } from "@/generated/prisma/client";

let passed = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) passed++;
  else failures.push(`${name}${detail ? `\n      ${detail}` : ""}`);
};
const section = (t: string) => console.log(`\n=== ${t} ===`);

let batchId = "";
let studentId = "";

const paperInclude = {
  questions: { include: { question: { include: { options: true, testCases: true } } }, orderBy: { order: "asc" as const } },
};

/** Fail loudly rather than crashing on a missing question. */
function need<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`This paper has no ${what} question.`);
  return v;
}

type SeededPaper = Prisma.AssessmentGetPayload<{ include: typeof paperInclude }>;
type SeededAQ = SeededPaper["questions"][number];

/** The first seeded paper containing a question of this type. */
async function paperWith(type: "MCQ" | "SHORT" | "LONG" | "CODING" | "ORAL" | "UPLOAD"): Promise<SeededPaper> {
  const papers = await prisma.assessment.findMany({
    where: { batchId, topic: "Computer System", kind: "ASSIGNMENT" },
    include: paperInclude,
    orderBy: { createdAt: "asc" },
  });
  const paper = papers.find((p) => p.questions.some((q) => q.question.type === type && q.question.explanation));
  if (!paper) throw new Error(`No seeded paper with a ${type} question that has a reference answer.`);
  return paper;
}

async function withSubmission<T>(
  paper: SeededPaper,
  fn: (submissionId: string, byType: Partial<Record<string, SeededAQ>>) => Promise<T>
): Promise<T> {
  const submission = await prisma.submission.create({
    data: { assessmentId: paper.id, studentId, status: "IN_PROGRESS" },
  });
  const byType = Object.fromEntries(paper.questions.map((q) => [q.question.type, q]));
  try {
    return await fn(submission.id, byType);
  } finally {
    await prisma.submission.delete({ where: { id: submission.id } }).catch(() => {});
  }
}

async function main() {
  const batch = await prisma.batch.findFirst({ where: { name: "B Code Brain" } });
  if (!batch) {
    console.log("No seeded batch — run the Computer System seeder first.");
    return;
  }
  const student = await prisma.batchStudent.findFirst({ where: { batchId: batch.id } });
  if (!student) {
    console.log("No student enrolled in the seeded batch — run the seeder first.");
    return;
  }
  batchId = batch.id;
  studentId = student.studentId;

  section("Access control");
  {
    const paper = await paperWith("SHORT");
    await withSubmission(paper, async (submissionId) => {
      const wrongOwner = await checkSubmission(submissionId, "cm-not-a-real-student");
      check("another student's submission is refused", isFailure(wrongOwner) && wrongOwner.status === 404, JSON.stringify(wrongOwner));

      const real = await checkSubmission(submissionId, studentId);
      check("the owner may check their own submission", !isFailure(real), JSON.stringify(real).slice(0, 160));

      const foreign = await checkSubmission(submissionId, studentId, ["cm-not-a-real-aq"]);
      check("a question that is not in this assessment is refused", isFailure(foreign) && foreign.status === 400, JSON.stringify(foreign));
    });
    console.log("  (test submission removed)");
  }

  section("A written answer is marked from the admin's reference");
  {
    const paper = await paperWith("SHORT");
    await withSubmission(paper, async (submissionId, byType) => {
      const short = need(byType.SHORT, "SHORT");
      const reference = short.question.explanation ?? "";
      check("the seeded question has a reference answer", reference.length > 20);
      await prisma.answer.create({
        data: { submissionId, assessmentQuestionId: short.id, payload: { text: reference } as never },
      });
      const out = await checkSubmission(submissionId, studentId, [short.id]);
      if (isFailure(out)) check("check succeeded", false, JSON.stringify(out));
      else {
        const row = out.answers[0];
        check("the question was checked", row.status === "checked", row.skipReason ?? row.status);
        check("reproducing the reference is heavily capped, not rewarded", row.marks <= short.marks * 0.35, `${row.marks}/${short.marks}`);
        check("the copy is explained", (row.report?.faults ?? []).some((f) => f.kind === "copied_reference"), JSON.stringify(row.report?.faults.map((f) => f.kind)));
        check("the report teaches something", (row.report?.teaching.length ?? 0) > 0);
        check("key points come from the real reference", (row.report?.criteria.length ?? 0) > 0, String(row.report?.criteria.length));
        check("the reference answer is shown", (row.report?.reference.length ?? 0) > 0);
        check("a next step is given", (row.report?.nextStep.length ?? 0) > 0);
      }
    });
  }

  section("Coding answers are really executed");
  {
    const paper = await paperWith("CODING");
    await withSubmission(paper, async (submissionId, byType) => {
      const coding = need(byType.CODING, "CODING");
      const visible = coding.question.testCases.filter((t: { isHidden: boolean }) => !t.isHidden);
      check("the coding question has visible test cases", visible.length > 0, String(coding.question.testCases.length));

      const answer = {
        submissionId,
        assessmentQuestionId: coding.id,
      };
      await prisma.answer.create({
        data: { ...answer, payload: { language: "python", code: "print('nonsense')" } as never },
      });
      const wrong = await checkSubmission(submissionId, studentId, [coding.id]);
      if (isFailure(wrong)) check("wrong code was checked", false, JSON.stringify(wrong));
      else {
        const row = wrong.answers[0];
        check("a wrong program does not pass", row.marks < coding.marks, `${row.marks}/${coding.marks}`);
        check(
          "the failing test case is reported",
          (row.report?.criteria ?? []).some((c) => !c.hit),
          JSON.stringify(row.report?.criteria.map((c) => [c.label, c.hit]))
        );
      }

      if (coding.question.solutionCode) {
        await prisma.answer.update({
          where: { submissionId_assessmentQuestionId: { submissionId, assessmentQuestionId: coding.id } },
          data: { payload: { language: "python", code: coding.question.solutionCode } as never },
        });
        const right = await checkSubmission(submissionId, studentId, [coding.id]);
        if (isFailure(right)) check("correct code was checked", false, JSON.stringify(right));
        else {
          const row = right.answers[0];
          check("the reference solution earns full marks", row.marks === coding.marks, `${row.marks}/${coding.marks} — ${JSON.stringify(row.report?.criteria)}`);
          check("and is reported as correct", row.report?.verdict === "correct", String(row.report?.verdict));
        }
      }
    });
  }

  section("MCQ");
  {
    const paper = await paperWith("MCQ");
    await withSubmission(paper, async (submissionId, byType) => {
      const mcq = need(byType.MCQ, "MCQ");
      const correct = mcq.question.options.find((o) => o.isCorrect);
      const wrong = mcq.question.options.find((o) => !o.isCorrect);
      if (!correct || !wrong) {
        check("the MCQ has a right and a wrong option", false);
        return;
      }
      await prisma.answer.create({
        data: { submissionId, assessmentQuestionId: mcq.id, payload: { optionIds: [correct.id] } as never },
      });
      const good = await checkSubmission(submissionId, studentId, [mcq.id]);
      if (!isFailure(good)) {
        check("the correct option earns full marks", good.answers[0].marks === mcq.marks, `${good.answers[0].marks}/${mcq.marks}`);
      }
      await prisma.answer.update({
        where: { submissionId_assessmentQuestionId: { submissionId, assessmentQuestionId: mcq.id } },
        data: { payload: { optionIds: [wrong.id] } as never },
      });
      const bad = await checkSubmission(submissionId, studentId, [mcq.id]);
      if (!isFailure(bad)) {
        check("a wrong option earns nothing", bad.answers[0].marks === 0, String(bad.answers[0].marks));
        check("and is reported as incorrect", bad.answers[0].report?.verdict === "incorrect", String(bad.answers[0].report?.verdict));
      }
    });
  }

  section("Check never writes a mark");
  {
    const paper = await paperWith("SHORT");
    await withSubmission(paper, async (submissionId, byType) => {
      const short = need(byType.SHORT, "SHORT");
      await prisma.answer.create({
        data: { submissionId, assessmentQuestionId: short.id, payload: { text: short.question.explanation ?? "" } as never },
      });
      await checkSubmission(submissionId, studentId);
      const after = await prisma.answer.findMany({
        where: { submissionId },
        select: { marksAwarded: true, feedback: true, isAutoCorrect: true },
      });
      check("no answer gained a mark", after.every((a) => a.marksAwarded === null), JSON.stringify(after));
      check("no answer gained official feedback", after.every((a) => a.feedback === null));
      check("no answer was flipped to auto-correct", after.every((a) => a.isAutoCorrect === null));
      const sub = await prisma.submission.findUnique({ where: { id: submissionId }, select: { totalScore: true, status: true } });
      check("the submission was not scored or closed", sub?.totalScore === null && sub?.status === "IN_PROGRESS", JSON.stringify(sub));

      await prisma.submission.update({ where: { id: submissionId }, data: { status: "SUBMITTED" } });
      const closed = await checkSubmission(submissionId, studentId);
      check("a submitted attempt is refused", isFailure(closed) && closed.status === 409, JSON.stringify(closed));
    });
  }

  section("Every question in a paper");
  {
    const paper = await paperWith("SHORT");
    await withSubmission(paper, async (submissionId) => {
      const all = await checkSubmission(submissionId, studentId);
      if (isFailure(all)) check("check-all succeeded", false, JSON.stringify(all));
      else {
        check("every question was returned", all.answers.length === paper.questions.length, `${all.answers.length}/${paper.questions.length}`);
        check("the summary adds up", all.summary.checked + all.summary.skipped === paper.questions.length, JSON.stringify(all.summary));
        check("no mark is negative", all.answers.every((a) => a.marks >= 0));
        check("no mark exceeds the maximum", all.answers.every((a) => a.marks <= a.maxMarks));
        check("unanswered questions are reported, not guessed", all.answers.filter((a) => a.report?.verdict === "unanswered").length > 0);
        console.log(`  ${all.summary.checked} checked, ${all.summary.skipped} skipped, ${all.summary.marks}/${all.summary.maxMarks} marks, ${all.summary.totalMs}ms engine time`);
      }
    });
  }

  section("Hidden test cases are never run");
  {
    const paper = await paperWith("CODING");
    await withSubmission(paper, async (submissionId, byType) => {
      const coding = need(byType.CODING, "CODING");
      const all = coding.question.testCases;
      const visible = all.filter((t: { isHidden: boolean }) => !t.isHidden);
      if (visible.length === 0) throw new Error("No visible case to copy.");

      // The seeded bank has no hidden cases, so add one for the duration of the
      // test. This is the case that must never be run or shown before submit.
      const hidden = await prisma.testCase.create({
        data: {
          questionId: coding.question.id,
          input: visible[0].input,
          expected: "SECRET-ANSWER-42",
          isHidden: true,
          sortOrder: 999,
        },
      });
      try {
        await prisma.answer.create({
          data: {
            submissionId,
            assessmentQuestionId: coding.id,
            payload: { language: "python", code: coding.question.solutionCode ?? "pass" } as never,
          },
        });
        const out = await checkSubmission(submissionId, studentId, [coding.id]);
        if (isFailure(out)) check("coding check succeeded", false, JSON.stringify(out));
        else {
          const row = out.answers[0];
          check(
            "only visible cases are reported",
            (row.report?.criteria.length ?? 0) === visible.length,
            `${row.report?.criteria.length} reported vs ${visible.length} visible`
          );
          check(
            "the hidden expected output never appears",
            !JSON.stringify(row.report).includes("SECRET-ANSWER-42")
          );
          check("the summary admits cases were held back", out.summary.hiddenCasesDeferred === true, String(out.summary.hiddenCasesDeferred));
        }
      } finally {
        await prisma.testCase.delete({ where: { id: hidden.id } }).catch(() => {});
      }
    });
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
