import { prisma } from "@/lib/prisma";
import { QUESTION_TYPES, DIFFICULTIES, DIALECTS, CODING_LANGUAGES, COMPARISON_MODES } from "@/lib/questionConstants";
import type { QuestionType, QuestionDifficulty, SqlDialect } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

export type QuestionOptionInput = { text?: string | null; imageUrl?: string | null; isCorrect: boolean };
export type TestCaseInput = { input: string; expected: string; isHidden: boolean; weight: number };

export type QuestionInput = {
  type: QuestionType;
  classRoomId: string;
  subjectId: string;
  difficulty: QuestionDifficulty;
  topic?: string | null;
  // Marks the question as part of the guided practical set for its chapter.
  isPractical?: boolean;
  // Concept tags such as ["while-loop"], separate from the chapter in `topic`.
  tags?: string[] | null;
  stem: string;
  explanation?: string | null;
  imageUrl?: string | null;
  options?: QuestionOptionInput[];
  allowedLanguages?: string[];
  starterCode?: Record<string, string> | null;
  solutionCode?: string | null;
  testCases?: TestCaseInput[];
  sqlDialect?: SqlDialect | null;
  sqlSchemaSql?: string | null;
  sqlSeedSql?: string | null;
  sqlExpectedResult?: unknown;
  sqlComparisonMode?: string | null;
};

/** Tags are stored as a clean, lower-cased, de-duplicated list so a filter
 *  like "while-loop" matches however the admin typed it. */
function normaliseTags(tags: string[] | null | undefined): string[] | null {
  const clean = [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  return clean.length > 0 ? clean : null;
}

export function validateQuestionInput(input: QuestionInput): string[] {
  const errors: string[] = [];
  if (!QUESTION_TYPES.includes(input.type)) errors.push("Invalid question type.");
  if (!input.classRoomId) errors.push("Class is required.");
  if (!input.subjectId) errors.push("Subject is required.");
  if (typeof input.stem !== "string" || input.stem.trim().length < 3)
    errors.push("Question text is required.");
  if (!DIFFICULTIES.includes(input.difficulty)) errors.push("Invalid difficulty.");

  if (input.type === "MCQ") {
    const opts = input.options ?? [];
    if (opts.length < 2 || opts.length > 10) errors.push("MCQ needs 2 to 10 options.");
    else if (!opts.some((o) => o.isCorrect)) errors.push("At least one option must be correct.");
    else if (!opts.every((o) => (o.text ?? "").trim().length > 0 || !!o.imageUrl))
      errors.push("Every option needs text or an image.");
  }

  if (input.topic && input.topic.trim().length > 120)
    errors.push("Chapter/topic name is too long.");

  if (input.type === "CODING") {
    const langs = input.allowedLanguages ?? [];
    if (langs.length === 0) errors.push("Select at least one language.");
    else if (langs.some((l) => !(CODING_LANGUAGES as readonly string[]).includes(l)))
      errors.push("Unknown language.");
    if (!input.starterCode || langs.some((l) => !(input.starterCode?.[l] ?? "").trim()))
      errors.push("Provide starter code for every selected language.");
    if (!input.solutionCode?.trim()) errors.push("A reference solution is required.");
    const tests = input.testCases ?? [];
    if (tests.length === 0) errors.push("At least one test case is required.");
    else if (tests.some((t) => t.expected.trim().length === 0))
      errors.push("Every test case needs an expected output.");
  }

  if (input.type === "SQL") {
    if (!input.sqlDialect || !DIALECTS.includes(input.sqlDialect))
      errors.push("Select a SQL dialect.");
    if (!input.sqlSchemaSql?.trim()) errors.push("Schema SQL (DDL) is required.");
    if (input.sqlComparisonMode && !COMPARISON_MODES.includes(input.sqlComparisonMode))
      errors.push("Invalid SQL comparison mode.");
  }

  return errors;
}

export async function createQuestion(input: QuestionInput) {
  const errors = validateQuestionInput(input);
  if (errors.length) return { ok: false as const, errors };

  const classRoom = await prisma.classRoom.findUnique({ where: { id: input.classRoomId } });
  if (!classRoom || !classRoom.isActive) return { ok: false as const, errors: ["Class is not available."] };

  const allotted = await prisma.subjectClass.findUnique({
    where: { subjectId_classRoomId: { subjectId: input.subjectId, classRoomId: input.classRoomId } },
  });
  if (!allotted) return { ok: false as const, errors: ["Subject is not allotted to this class."] };

  const question = await prisma.question.create({
    data: {
      type: input.type,
      classRoomId: input.classRoomId,
      subjectId: input.subjectId,
      difficulty: input.difficulty,
      topic: input.topic?.trim() || null,
      isPractical: input.isPractical ?? false,
      tags: (normaliseTags(input.tags) as never) ?? Prisma.DbNull,
      stem: input.stem.trim(),
      imageUrl: input.imageUrl || null,
      explanation: input.explanation?.trim() || null,
      allowedLanguages: (input.allowedLanguages ?? []) as never,
      starterCode: (input.starterCode ?? null) as never,
      solutionCode: input.solutionCode || null,
      sqlDialect: input.sqlDialect ?? null,
      sqlSchemaSql: input.sqlSchemaSql || null,
      sqlSeedSql: input.sqlSeedSql || null,
      sqlExpectedResult: (input.sqlExpectedResult ?? null) as never,
      sqlComparisonMode: input.sqlComparisonMode || null,
      ...(input.options
        ? {
            options: {
              create: input.options.map((o, i) => ({
                text: o.text?.trim() || null,
                imageUrl: o.imageUrl || null,
                isCorrect: o.isCorrect,
                sortOrder: i,
              })),
            },
          }
        : {}),
      ...(input.testCases
        ? {
            testCases: {
              create: input.testCases.map((t, i) => ({
                input: t.input,
                expected: t.expected,
                isHidden: t.isHidden,
                weight: t.weight || 1,
                sortOrder: i,
              })),
            },
          }
        : {}),
    },
    include: { options: true, testCases: true },
  });

  return { ok: true as const, question };
}

export async function updateQuestion(id: string, input: QuestionInput) {
  const errors = validateQuestionInput(input);
  if (errors.length) return { ok: false as const, errors };

  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, errors: ["Question not found."] };

  const classRoom = await prisma.classRoom.findUnique({ where: { id: input.classRoomId } });
  if (!classRoom || !classRoom.isActive) return { ok: false as const, errors: ["Class is not available."] };

  const allotted = await prisma.subjectClass.findUnique({
    where: { subjectId_classRoomId: { subjectId: input.subjectId, classRoomId: input.classRoomId } },
  });
  if (!allotted) return { ok: false as const, errors: ["Subject is not allotted to this class."] };

  const question = await prisma.$transaction(async (tx) => {
    await tx.questionOption.deleteMany({ where: { questionId: id } });
    await tx.testCase.deleteMany({ where: { questionId: id } });
    return tx.question.update({
      where: { id },
      data: {
        type: input.type,
        classRoomId: input.classRoomId,
        subjectId: input.subjectId,
        difficulty: input.difficulty,
        topic: input.topic?.trim() || null,
        isPractical: input.isPractical ?? false,
        tags: (normaliseTags(input.tags) as never) ?? Prisma.DbNull,
        stem: input.stem.trim(),
        imageUrl: input.imageUrl || null,
        explanation: input.explanation?.trim() || null,
        allowedLanguages: (input.allowedLanguages ?? []) as never,
        starterCode: (input.starterCode ?? null) as never,
        solutionCode: input.solutionCode || null,
        sqlDialect: input.sqlDialect ?? null,
        sqlSchemaSql: input.sqlSchemaSql || null,
        sqlSeedSql: input.sqlSeedSql || null,
        sqlExpectedResult: (input.sqlExpectedResult ?? null) as never,
        sqlComparisonMode: input.sqlComparisonMode || null,
        ...(input.options
          ? {
              options: { create: input.options.map((o, i) => ({ text: o.text?.trim() || null, imageUrl: o.imageUrl || null, isCorrect: o.isCorrect, sortOrder: i })) },
            }
          : {}),
        ...(input.testCases
          ? {
              testCases: { create: input.testCases.map((t, i) => ({ input: t.input, expected: t.expected, isHidden: t.isHidden, weight: t.weight || 1, sortOrder: i })) },
            }
          : {}),
      },
      include: { options: true, testCases: true },
    });
  });

  return { ok: true as const, question };
}