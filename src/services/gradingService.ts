import "server-only";
import { prisma } from "@/lib/prisma";
import { runnerRun, runnerSql } from "@/services/runner";
import { QuestionType } from "@/generated/prisma/enums";
import { outputsMatch } from "@/lib/outputMatch";

export type AutoGradeResult = {
  correct?: boolean;
  passed?: number;
  total?: number;
  detail?: string;
};

const AUTO_TYPES = new Set<QuestionType>(["MCQ", "CODING", "SQL"]);


function gradeMcq(selected: unknown, correctIds: string[]): AutoGradeResult {
  const sel = Array.isArray((selected as { optionIds?: string[] } | undefined)?.optionIds)
    ? ((selected as { optionIds?: string[] }).optionIds as string[])
    : [];
  const set = new Set(sel);
  const ok = correctIds.length > 0 && sel.length === correctIds.length && correctIds.every((c) => set.has(c));
  return { correct: ok, detail: `${sel.length}/${correctIds.length} selected` };
}

async function gradeCoding(payload: { language?: string; code?: string }, testCases: { input: string; expected: string }[]): Promise<AutoGradeResult> {
  const language = payload.language ?? "python";
  const code = payload.code ?? "";
  if (!code.trim() || testCases.length === 0) {
    return { correct: false, passed: 0, total: testCases.length, detail: "No code supplied or no test cases." };
  }
  let passed = 0;
  const failures: string[] = [];
  for (const t of testCases) {
    let actual = "";
    let okRun = false;
    try {
      const r = await runnerRun(language, code, t.input);
      if (r.exitCode === 0 && !r.timedOut) {
        actual = r.stdout;
        okRun = true;
      } else if (r.timedOut) {
        failures.push(`case timed out`);
      } else {
        failures.push(`exited ${r.exitCode}`);
      }
    } catch {
      failures.push("run failed");
    }
    if (okRun && outputsMatch(actual, t.expected)) passed++;
  }
  return { correct: passed === testCases.length, passed, total: testCases.length, detail: failures.slice(0, 2).join("; ") || `${passed}/${testCases.length} passed` };
}

async function gradeSql(
  payload: { query?: string },
  q: {
    sqlDialect?: string | null;
    sqlSchemaSql?: string | null;
    sqlSeedSql?: string | null;
    sqlExpectedResult?: unknown;
    sqlComparisonMode?: string | null;
  }
): Promise<AutoGradeResult> {
  const query = payload.query ?? "";
  const expectedRaw = q.sqlExpectedResult;
  const expected = Array.isArray(expectedRaw) ? (expectedRaw as unknown[][]) : null;
  if (!query.trim() || !expected || expected.length === 0) {
    return { correct: false, detail: "No query or no expected result set defined." };
  }
  const dialect = q.sqlDialect ?? "PostgreSQL";
  const mode = q.sqlComparisonMode === "EXACT_ORDER" ? "EXACT_ORDER" : "UNORDERED";
  const key = (rows: unknown[][]) => JSON.stringify(rows.map((r) => r.map((v) => String(v ?? ""))));
  const sortKey = (rows: unknown[][]) => key(rows.map((r) => [...r].sort()).sort());
  try {
    const actual = await runnerSql(dialect, q.sqlSchemaSql ?? "", q.sqlSeedSql ?? "", query);
    const ok = mode === "EXACT_ORDER" ? key(actual.rows) === key(expected) : sortKey(actual.rows) === sortKey(expected);
    return { correct: ok, detail: `matched ${actual.rows.length} rows` };
  } catch (err) {
    return { correct: false, detail: err instanceof Error ? err.message.slice(0, 120) : "sql error" };
  }
}

export async function autoGradeAssessment(adminUserId: string, assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      questions: {
        include: {
          question: { include: { options: { select: { id: true, isCorrect: true } }, testCases: { select: { input: true, expected: true }, orderBy: { sortOrder: "asc" } } } },
        },
        orderBy: { order: "asc" },
      },
      submissions: {
        where: { status: { in: ["SUBMITTED", "EVALUATED"] } },
        include: { answers: true },
      },
    },
  });
  if (!assessment) return { ok: false as const, errors: ["Assessment not found."] };
  if (!["CLOSED", "EVALUATED"].includes(assessment.status))
    return { ok: false as const, errors: ["Close the assessment before evaluating."] };

  const aqInfo = new Map<string, { marks: number; type: QuestionType; q: (typeof assessment.questions)[number]["question"] }>();
  for (const aq of assessment.questions) {
    aqInfo.set(aq.id, { marks: aq.marks, type: aq.question.type, q: aq.question });
  }

  let gradedAnswers = 0;
  let submissionsTouched = 0;

  for (const sub of assessment.submissions) {
    let autoScore = 0;
    let touched = false;
    for (const aq of assessment.questions) {
      const ans = sub.answers.find((a) => a.assessmentQuestionId === aq.id);
      if (!ans) {
        const zero: AutoGradeResult = { correct: false, detail: "Unanswered" };
        await prisma.answer.create({
          data: {
            submissionId: sub.id,
            assessmentQuestionId: aq.id,
            payload: (aq.question.type === "MCQ" ? { optionIds: [] } : aq.question.type === "CODING" ? { code: "", runs: [] } : aq.question.type === "SQL" ? { query: "" } : { text: "" }) as never,
            marksAwarded: 0,
            isAutoCorrect: AUTO_TYPES.has(aq.question.type),
            autoResult: (zero as unknown) as never,
            evaluatedBy: "auto",
            evaluatedAt: new Date(),
          },
        });
        touched = true;
        continue;
      }
      const info = aqInfo.get(ans.assessmentQuestionId);
      if (!info || !AUTO_TYPES.has(info.type)) continue;
      let result: AutoGradeResult;
      if (info.type === "MCQ") {
        const correctIds = info.q.options.filter((o) => o.isCorrect).map((o) => o.id);
        result = gradeMcq(ans.payload, correctIds);
      } else if (info.type === "CODING") {
        result = await gradeCoding(ans.payload as { language?: string; code?: string }, info.q.testCases);
      } else {
        result = await gradeSql(ans.payload as { query?: string }, info.q);
      }
      const awarded = Math.round(((result.correct ? 1 : 0) * (result.passed !== undefined ? result.passed / (result.total || 1) : 1)) * info.marks * 1000) / 1000;
      autoScore += awarded;
      await prisma.answer.update({
        where: { id: ans.id },
        data: {
          marksAwarded: awarded,
          isAutoCorrect: true,
          autoResult: (result as unknown) as never,
          evaluatedBy: "auto",
          evaluatedAt: new Date(),
          feedback: null,
        },
      });
      gradedAnswers++;
      touched = true;
    }
    if (touched) {
      await prisma.submission.update({ where: { id: sub.id }, data: { autoScore, status: "EVALUATED" } });
      submissionsTouched++;
    }
  }

  await prisma.assessment
    .update({ where: { id: assessmentId }, data: { status: "EVALUATED" } })
    .catch((e) => console.error("mark EVALUATED failed", e));

  return { ok: true as const, gradedAnswers, submissionsTouched, submissionsTotal: assessment.submissions.length };
}

export async function saveManualGrades(
  adminUserId: string,
  submissionId: string,
  input: { answers?: { answerId: string; marksAwarded: number | null; feedback?: string }[]; feedback?: string }
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assessment: { include: { questions: { select: { id: true, marks: true, questionId: true } } } },
      answers: true,
    },
  });
  if (!submission) return { ok: false as const, errors: ["Submission not found."] };
  if (submission.status === "IN_PROGRESS")
    return { ok: false as const, errors: ["Submission is still in progress."] };

  const marksByAq = new Map(submission.assessment.questions.map((q) => [q.id, q.marks]));
  const answerById = new Map(submission.answers.map((a) => [a.id, a]));
  for (const a of input.answers ?? []) {
    const answer = answerById.get(a.answerId);
    if (!answer) return { ok: false as const, errors: [`Unknown answer ${a.answerId}.`] };
    const cap = marksByAq.get(answer.assessmentQuestionId);
    if (typeof a.marksAwarded !== "number" || a.marksAwarded < 0 || a.marksAwarded > (cap ?? 0))
      return { ok: false as const, errors: [`Marks must be between 0 and ${cap ?? "?"} for ${a.answerId}.`] };
  }

  const txn = await prisma.$transaction(async (tx) => {
    for (const a of input.answers ?? []) {
      await tx.answer.update({
        where: { id: a.answerId },
        data: { marksAwarded: a.marksAwarded, feedback: a.feedback?.trim() || null, evaluatedBy: adminUserId, evaluatedAt: new Date() },
      });
    }
    const answers = await tx.answer.findMany({ where: { submissionId } });
    let autoScore = 0;
    let manualScore = 0;
    for (const an of answers) {
      if (an.marksAwarded == null) continue;
      autoScore += an.isAutoCorrect ? an.marksAwarded : 0;
      manualScore += an.isAutoCorrect ? 0 : an.marksAwarded;
    }
    const allGraded = submission.assessment.questions.every((q) => answers.some((an) => an.assessmentQuestionId === q.id && an.marksAwarded != null));
    const updated = await tx.submission.update({
      where: { id: submissionId },
      data: {
        autoScore,
        manualScore,
        feedback: input.feedback?.trim() || submission.feedback,
        ...(allGraded ? { status: "EVALUATED", evaluatedAt: new Date() } : {}),
      },
    });
    return { updated, allGraded };
  });

  return { ok: true as const, ...txn };
}

export async function releaseAssessment(adminUserId: string, assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      batch: { select: { id: true, name: true } },
      submissions: { include: { answers: true, student: { select: { id: true } } } },
      _count: { select: { questions: true } },
    },
  });
  if (!assessment) return { ok: false as const, errors: ["Assessment not found."] };
  if (assessment.status !== "EVALUATED")
    return { ok: false as const, errors: ["Assessment must be evaluated before releasing results."] };
  const pending = assessment.submissions.filter((s) => s.status !== "EVALUATED");
  if (pending.length > 0)
    return { ok: false as const, errors: [`${pending.length} submission(s) still need manual grading.`] };

  const now = new Date();
  const released: { submissionId: string; total: number }[] = [];
  for (const sub of assessment.submissions) {
    const total = sub.autoScore + sub.manualScore;
    await prisma.submission.update({
      where: { id: sub.id },
      data: { totalScore: total, releasedAt: now },
    });
    await prisma.reportRecord.create({
      data: {
        studentId: sub.student.id,
        batchId: assessment.batchId,
        assessmentId: assessment.id,
        kind: assessment.kind,
        title: assessment.title,
        summary: {
          totalScore: total,
          totalMarks: assessment.totalMarks,
          autoScore: sub.autoScore,
          manualScore: sub.manualScore,
          questionCount: assessment._count.questions,
          answeredCount: sub.answers.length,
        } as never,
        releasedAt: now,
      },
    });
    released.push({ submissionId: sub.id, total });
  }

  await prisma.assessment.update({ where: { id: assessmentId }, data: { status: "RELEASED_TO_STUDENTS" } });
  return { ok: true as const, released: released.length };
}

export { AUTO_TYPES };