/**
 * SNSAI server service.
 *
 * Turns a submission into SNSAI reports, gathering the hard evidence the engine
 * cannot invent for itself:
 *
 *   - CODING answers are really executed against the sample test cases.
 *   - SQL answers are really executed against the practice database.
 *   - Everything else is judged from the admin's reference answer.
 *
 * Two rules shape this file.
 *
 * Check is advisory. Nothing here writes marks, verdicts or feedback to the
 * database. The authoritative grade is still produced by autoGradeAssessment at
 * submission, and a student who sees a Check result must not be able to
 * mistake it for their score.
 *
 * Never invent a mark. A question with no reference answer is reported as
 * skipped, not scored against nothing. Handing back a number derived from an
 * empty reference is worse than admitting the question cannot be checked.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { runnerRun, runnerSql } from "@/services/runner";
import { evaluateAnswer, SNSAI_VERSION, summariseReports } from "@/lib/snsai/evaluate";
import type { SnsaiInput, SnsaiReport } from "@/lib/snsai/types";

/** How many test cases a single Check will execute. Each one is a subprocess,
 *  so an unbounded run would make "Check" feel like it had hung. */
const MAX_EXECUTED_CASES = 6;

export type CheckedAnswer = {
  assessmentQuestionId: string;
  questionId: string;
  type: string;
  marks: number;
  maxMarks: number;
  status: "checked" | "skipped";
  /** Present when status is "skipped": why no judgement could be made. */
  skipReason?: string;
  report?: SnsaiReport;
};

export type CheckOutcome = {
  submissionId: string;
  version: string;
  answers: CheckedAnswer[];
  summary: ReturnType<typeof summariseReports> & {
    skipped: number;
    /** True when hidden test cases exist and were deliberately not run. */
    hiddenCasesDeferred: boolean;
  };
};

export type CheckFailure = { status: number; error: string };

type LoadedQuestion = {
  id: string;
  type: string;
  stem: string;
  explanation: string | null;
  maxMarks: number;
  options: { id: string; text: string; isCorrect: boolean }[];
  testCases: { input: string; expected: string; isHidden: boolean }[];
  sql: {
    dialect: string | null;
    schemaSql: string | null;
    seedSql: string | null;
    expectedResult: unknown;
    comparisonMode: string | null;
  };
  payload: unknown;
  transcript: string | undefined;
  hasAudio: boolean;
};

type Run = { stdout: string; stderr: string; exitCode: number; timedOut: boolean };

/**
 * Execute code against the sample test cases.
 *
 * Only cases the student can already see are run. A hidden case's expected
 * output is part of the answer key, and telling a student their program
 * printed the wrong thing for a case they have never seen hands them that
 * answer. Hidden cases still run at submission.
 */
async function runSampleCases(
  language: string,
  code: string,
  cases: { input: string; expected: string }[]
): Promise<{ runs: Run[]; ran: number; total: number; hidden: number }> {
  const runs: Run[] = [];
  const limit = Math.min(cases.length, MAX_EXECUTED_CASES);
  for (let i = 0; i < limit; i++) {
    const t = cases[i];
    try {
      const r = await runnerRun(language, code, t.input);
      runs.push({ stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, timedOut: r.timedOut });
    } catch (e) {
      // An unreachable runner must read as a failure of this case, never as a
      // pass, and must not abort the whole Check.
      runs.push({
        stdout: "",
        stderr: e instanceof Error ? e.message.slice(0, 200) : "Runner unavailable.",
        exitCode: -1,
        timedOut: false,
      });
    }
  }
  return { runs, ran: runs.length, total: cases.length, hidden: 0 };
}

/** Execute a query and compare the rows with the admin's expected result. */
async function runQuery(
  q: LoadedQuestion["sql"],
  query: string
): Promise<{
  sqlResult: { ran: boolean; rowCount: number | null; expectedRows: number | null; matched: boolean | null; error?: string };
  resultSummary: string;
}> {
  const expected = Array.isArray(q.expectedResult) ? (q.expectedResult as unknown[][]) : null;
  if (!expected || expected.length === 0) {
    // Nothing to compare against. Report what the query did without judging it,
    // rather than guessing whether it was right.
    try {
      const r = await runnerSql(q.dialect ?? "PostgreSQL", q.schemaSql ?? "", q.seedSql ?? "", query);
      return {
        sqlResult: { ran: true, rowCount: r.rowCount, expectedRows: null, matched: null },
        resultSummary: `The query ran and returned ${r.rowCount} row(s). There is no expected result stored for this question, so SNSAI cannot confirm it is the right answer.`,
      };
    } catch (e) {
      return {
        sqlResult: { ran: false, rowCount: null, expectedRows: null, matched: null, error: e instanceof Error ? e.message.slice(0, 300) : "SQL error." },
        resultSummary: "The query did not run.",
      };
    }
  }
  try {
    const actual = await runnerSql(q.dialect ?? "PostgreSQL", q.schemaSql ?? "", q.seedSql ?? "", query);
    const exact = q.comparisonMode === "EXACT_ORDER";
    const key = (rows: unknown[][]) => JSON.stringify(rows.map((r) => r.map((v) => String(v ?? ""))));
    const sortedKey = (rows: unknown[][]) => key(rows.map((r) => [...r].sort()).sort());
    const matched = exact ? key(actual.rows) === key(expected) : sortedKey(actual.rows) === sortedKey(expected);
    return {
      sqlResult: { ran: true, rowCount: actual.rows.length, expectedRows: expected.length, matched },
      resultSummary: matched
        ? `The query ran and returned the expected ${actual.rowCount} row(s).`
        : `The query ran and returned ${actual.rowCount} row(s), but the expected answer has ${expected.length}.`,
    };
  } catch (e) {
    return {
      sqlResult: { ran: false, rowCount: null, expectedRows: expected.length, matched: false, error: e instanceof Error ? e.message.slice(0, 300) : "SQL error." },
      resultSummary: "The query did not run.",
    };
  }
}

function buildInput(q: LoadedQuestion, extra: Record<string, unknown> = {}): SnsaiInput {
  return {
    type: q.type as SnsaiInput["type"],
    stem: q.stem,
    reference: q.explanation ?? "",
    maxMarks: q.maxMarks,
    payload: q.payload,
    options: q.options.length > 0 ? q.options : undefined,
    testCases: q.testCases.length > 0 ? q.testCases.map((t) => ({ input: t.input, expected: t.expected })) : undefined,
    sqlContext: { dialect: q.sql.dialect, schemaSql: q.sql.schemaSql, seedSql: q.sql.seedSql },
    transcript: q.transcript,
    hasAudio: q.hasAudio,
    ...extra,
  };
}

/**
 * A reference answer is what makes a written answer checkable. Without one the
 * engine would score against an empty reference and invent a number, so the
 * question is reported as skipped and the reason travels with it.
 */
function canCheck(q: LoadedQuestion): boolean {
  switch (q.type) {
    case "MCQ":
    case "CODING":
      return true;
    case "SQL":
      return true;
    case "UPLOAD":
      return true;
    default:
      return !!q.explanation && q.explanation.trim().length > 0;
  }
}

function skipReason(q: LoadedQuestion): string | null {
  if (canCheck(q)) return null;
  return "No reference answer has been set for this question, so SNSAI has nothing to check it against. Your teacher will mark it.";
}

/**
 * Check one question or every question in the submission.
 *
 * `assessmentQuestionIds` omitted or empty means the whole submission.
 */
export async function checkSubmission(
  submissionId: string,
  studentProfileId: string,
  assessmentQuestionIds?: string[]
): Promise<CheckOutcome | CheckFailure> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, studentId: true, status: true, assessmentId: true },
  });
  if (!submission || submission.studentId !== studentProfileId) {
    return { status: 404, error: "Submission not found." };
  }
  if (submission.status !== "IN_PROGRESS") {
    return { status: 409, error: "This attempt is already closed, so it can no longer be checked." };
  }

  const wanted = assessmentQuestionIds?.filter(Boolean) ?? [];
  const questions = await prisma.assessmentQuestion.findMany({
    where: {
      assessmentId: submission.assessmentId,
      ...(wanted.length > 0 ? { id: { in: wanted } } : {}),
    },
    orderBy: { order: "asc" },
    select: {
      id: true,
      marks: true,
      question: {
        select: {
          id: true,
          type: true,
          stem: true,
          explanation: true,
          sqlDialect: true,
          sqlSchemaSql: true,
          sqlSeedSql: true,
          sqlExpectedResult: true,
          sqlComparisonMode: true,
          options: { select: { id: true, text: true, isCorrect: true }, orderBy: { sortOrder: "asc" } },
          testCases: { select: { input: true, expected: true, isHidden: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (wanted.length > 0 && questions.length !== wanted.length) {
    return { status: 400, error: "One or more questions do not belong to this assessment." };
  }

  const answers = await prisma.answer.findMany({
    where: { submissionId, ...(wanted.length > 0 ? { assessmentQuestionId: { in: wanted } } : {}) },
    select: { assessmentQuestionId: true, payload: true },
  });
  const payloadBy = new Map(answers.map((a) => [a.assessmentQuestionId, a.payload]));

  const results: CheckedAnswer[] = [];
  const reports: SnsaiReport[] = [];
  let hiddenCasesDeferred = false;

  for (const aq of questions) {
    const q = aq.question;
    const payload = (payloadBy.get(aq.id) ?? {}) as {
      text?: string;
      transcript?: string;
      fileUrls?: string[];
      language?: string;
      code?: string;
      query?: string;
    };
    const loaded: LoadedQuestion = {
      id: q.id,
      type: q.type,
      stem: q.stem,
      explanation: q.explanation,
      maxMarks: aq.marks,
      options: q.options.map((o) => ({ id: o.id, text: o.text ?? "", isCorrect: o.isCorrect })),
      testCases: q.testCases.map((t) => ({ input: t.input, expected: t.expected, isHidden: t.isHidden })),
      sql: {
        dialect: q.sqlDialect,
        schemaSql: q.sqlSchemaSql,
        seedSql: q.sqlSeedSql,
        expectedResult: q.sqlExpectedResult,
        comparisonMode: q.sqlComparisonMode,
      },
      payload,
      transcript: typeof payload.transcript === "string" ? payload.transcript : undefined,
      hasAudio: Array.isArray(payload.fileUrls) && payload.fileUrls.length > 0,
    };

    const reason = skipReason(loaded);
    if (reason) {
      results.push({
        assessmentQuestionId: aq.id,
        questionId: q.id,
        type: q.type,
        marks: 0,
        maxMarks: aq.marks,
        status: "skipped",
        skipReason: reason,
      });
      continue;
    }

    let input = buildInput(loaded);

    // CODING: really run the program so the verdict rests on output, not on
    // how the code looks.
    if (q.type === "CODING" && typeof payload.code === "string" && payload.code.trim()) {
      const visible = loaded.testCases.filter((t) => !t.isHidden);
      const hidden = loaded.testCases.length - visible.length;
      if (hidden > 0) hiddenCasesDeferred = true;
      const usable = visible.length > 0 ? visible : loaded.testCases.slice(0, 1);
      const { runs } = await runSampleCases(payload.language ?? "python", payload.code, usable);
      input = buildInput(
        loaded,
        hidden > 0
          ? {
              payload: { ...payload, runs },
              testCases: usable.map((t) => ({ input: t.input, expected: t.expected })),
            }
          : { payload: { ...payload, runs } }
      );
    }

    // SQL: really run the query and compare the rows.
    if (q.type === "SQL" && typeof payload.query === "string" && payload.query.trim()) {
      const { sqlResult, resultSummary } = await runQuery(loaded.sql, payload.query);
      input = buildInput(loaded, { payload: { ...payload, sqlResult, resultSummary } });
    }

    const report = evaluateAnswer(input);
    reports.push(report);
    results.push({
      assessmentQuestionId: aq.id,
      questionId: q.id,
      type: q.type,
      marks: report.marks,
      maxMarks: report.maxMarks,
      status: "checked",
      report,
    });
  }

  return {
    submissionId,
    version: SNSAI_VERSION,
    answers: results,
    summary: {
      ...summariseReports(reports),
      skipped: results.filter((r) => r.status === "skipped").length,
      hiddenCasesDeferred,
    },
  };
}

export function isFailure(x: CheckOutcome | CheckFailure): x is CheckFailure {
  return "error" in x;
}
