import { prisma } from "@/lib/prisma";
import { KINDS } from "@/lib/assessmentConstants";
import type {
  AssessmentAttemptMode,
  AssessmentKind,
  AssessmentStatus,
} from "@/generated/prisma/enums";

export type QuestionPick = { questionId: string; marks: number };
export type AssessmentProctoring = {
  webcamOn?: boolean;
  fullscreenLock?: boolean;
  blockPaste?: boolean;
  maxTabSwitches?: number;
};

export type AssessmentInput = {
  batchId: string;
  kind: AssessmentKind;
  subjectId?: string | null;
  topic?: string | null;
  attemptMode?: AssessmentAttemptMode;
  maxAttempts?: number | null;
  title: string;
  instructions?: string | null;
  durationMinutes: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  shuffleQuestions: boolean;
  proctoring?: AssessmentProctoring | null;
  questions: QuestionPick[];
};

function isKind(v: unknown): v is AssessmentKind {
  return typeof v === "string" && (KINDS as string[]).includes(v);
}

export function validateAssessmentInput(input: AssessmentInput): string[] {
  const errors: string[] = [];
  if (!isKind(input.kind)) errors.push("Invalid assessment kind.");
  if (!input.batchId) errors.push("Batch is required.");
  if (input.kind === "TEST" && input.attemptMode === "FLEXIBLE")
    errors.push("Real tests must be scheduled — they always run inside a fixed window.");
  if (input.attemptMode && !["SCHEDULED", "FLEXIBLE"].includes(input.attemptMode))
    errors.push("Invalid attempt mode.");
  if (
    input.attemptMode === "FLEXIBLE" &&
    input.maxAttempts != null &&
    (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 99)
  )
    errors.push("Max attempts must be between 1 and 99 when limiting flexible attempts.");
  if (input.subjectId && !input.topic)
    errors.push("Choose the chapter / topic for this subject (from the batch pricing list).");
  if (input.topic && !input.subjectId)
    errors.push("Pick the subject before choosing a chapter / topic.");
  if (!input.title || input.title.trim().length < 3) errors.push("Title is required.");
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 600)
    errors.push("Duration must be between 1 and 600 minutes.");
  if (!Array.isArray(input.questions) || input.questions.length === 0)
    errors.push("Add at least one question.");
  if (input.questions.some((q) => !q.questionId || !Number.isFinite(q.marks) || q.marks < 1))
    errors.push("Every question needs a positive mark value.");
  if (input.attemptMode !== "FLEXIBLE" && input.startsAt && input.endsAt && input.endsAt.getTime() <= input.startsAt.getTime())
    errors.push("End time must be after start time.");
  return errors;
}

// A topic must be one of the batch's admin-priced SubjectPricingItem names.
async function validateSubjectTopic(batchId: string, subjectId: string | null | undefined, topic: string | null | undefined) {
  if (!subjectId) return null;
  const subject = await prisma.batchSubject.findUnique({
    where: { batchId_subjectId: { batchId, subjectId } },
    select: { subject: { select: { name: true } } },
  });
  if (!subject) return "This subject is not part of the selected batch.";
  if (topic) {
    const item = await prisma.subjectPricingItem.findFirst({
      where: { batchId, subjectId, name: { equals: topic.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (!item) return `“${topic}” is not an admin-priced chapter/topic for this batch.`;
  }
  return null;
}

export async function createAssessment(input: AssessmentInput) {
  const errors = validateAssessmentInput(input);
  if (errors.length) return { ok: false as const, errors };

  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    include: { classRoom: { select: { id: true, isActive: true } } },
  });
  if (!batch || !batch.classRoom.isActive) return { ok: false as const, errors: ["Batch is not available."] };

  const topicError = await validateSubjectTopic(input.batchId, input.subjectId, input.topic);
  if (topicError) return { ok: false as const, errors: [topicError] };

  const ids = input.questions.map((q) => q.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (questions.length !== ids.length)
    return { ok: false as const, errors: ["One or more questions no longer exist."] };

  const totalMarks = input.questions.reduce((s, q) => s + q.marks, 0);
  const now = new Date();
  const attemptMode: AssessmentAttemptMode = input.kind === "TEST" ? "SCHEDULED" : (input.attemptMode ?? "SCHEDULED");
  // Flexible attempts are always live the moment they are created — no window.
  const isFlexible = attemptMode === "FLEXIBLE";
  const status: AssessmentStatus = isFlexible
    ? "RELEASED"
    : input.startsAt && input.startsAt.getTime() > now.getTime()
      ? "SCHEDULED"
      : "DRAFT";

  const assessment = await prisma.assessment.create({
    data: {
      batchId: input.batchId,
      kind: input.kind,
      subjectId: input.subjectId ?? null,
      topic: input.topic?.trim() || null,
      attemptMode,
      maxAttempts: isFlexible ? input.maxAttempts ?? null : null,
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      durationMinutes: input.durationMinutes,
      startsAt: isFlexible ? null : input.startsAt,
      endsAt: isFlexible ? null : input.endsAt,
      shuffleQuestions: input.shuffleQuestions,
      proctoring: (input.kind === "TEST" ? input.proctoring : null) as never,
      totalMarks,
      status,
      questions: {
        create: input.questions.map((q, i) => ({ questionId: q.questionId, marks: q.marks, order: i })),
      },
    },
    include: { batch: { include: { classRoom: { select: { id: true, name: true } } } }, _count: { select: { questions: true, submissions: true } } },
  });

  return { ok: true as const, assessment };
}

export async function updateAssessment(id: string, input: AssessmentInput) {
  const existing = await prisma.assessment.findUnique({
    where: { id },
    include: { _count: { select: { submissions: true } } },
  });
  if (!existing) return { ok: false as const, errors: ["Assessment not found."] };
  const editable =
    ["DRAFT", "SCHEDULED"].includes(existing.status) ||
    (existing.attemptMode === "FLEXIBLE" && existing.status === "RELEASED");
  if (!editable) {
    return { ok: false as const, errors: ["This assessment can no longer be edited."] };
  }
  if (existing._count.submissions > 0) {
    return { ok: false as const, errors: ["Students have already attempted this — editing is locked."] };
  }

  const errors = validateAssessmentInput(input);
  if (errors.length) return { ok: false as const, errors };

  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    include: { classRoom: { select: { id: true, isActive: true } } },
  });
  if (!batch || !batch.classRoom.isActive) return { ok: false as const, errors: ["Batch is not available."] };

  const topicError = await validateSubjectTopic(input.batchId, input.subjectId, input.topic);
  if (topicError) return { ok: false as const, errors: [topicError] };

  const ids = input.questions.map((q) => q.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (questions.length !== ids.length)
    return { ok: false as const, errors: ["One or more questions no longer exist."] };

  const totalMarks = input.questions.reduce((s, q) => s + q.marks, 0);
  const now = new Date();
  const attemptMode: AssessmentAttemptMode = input.kind === "TEST" ? "SCHEDULED" : (input.attemptMode ?? "SCHEDULED");
  const isFlexible = attemptMode === "FLEXIBLE";
  const status: AssessmentStatus = isFlexible
    ? "RELEASED"
    : input.startsAt && input.startsAt.getTime() > now.getTime() && existing.status === "DRAFT"
      ? "SCHEDULED"
      : existing.status;

  const assessment = await prisma.$transaction(async (tx) => {
    await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
    return tx.assessment.update({
      where: { id },
      data: {
        batchId: input.batchId,
        kind: input.kind,
        subjectId: input.subjectId ?? null,
        topic: input.topic?.trim() || null,
        attemptMode,
        maxAttempts: isFlexible ? input.maxAttempts ?? null : null,
        title: input.title.trim(),
        instructions: input.instructions?.trim() || null,
        durationMinutes: input.durationMinutes,
        startsAt: isFlexible ? null : input.startsAt,
        endsAt: isFlexible ? null : input.endsAt,
        shuffleQuestions: input.shuffleQuestions,
        proctoring: (input.kind === "TEST" ? input.proctoring : null) as never,
        totalMarks,
        status,
        questions: {
          create: input.questions.map((q, i) => ({ questionId: q.questionId, marks: q.marks, order: i })),
        },
      },
    });
  });

  return { ok: true as const, assessment };
}

export async function transitionStatus(id: string, to: AssessmentStatus) {
  const existing = await prisma.assessment.findUnique({
    where: { id },
    include: { _count: { select: { submissions: true } } },
  });
  if (!existing) return { ok: false as const, errors: ["Assessment not found."] };

  const now = new Date();
  const from = existing.status;
  const flexible = existing.attemptMode === "FLEXIBLE";

  if (to === "DRAFT") {
    if (!["DRAFT", "SCHEDULED", "RELEASED"].includes(from))
      return { ok: false as const, errors: ["Cannot move this assessment back to draft."] };
    if (from !== "DRAFT" && existing._count.submissions > 0)
      return { ok: false as const, errors: ["Students have already submitted — this assessment can't go back to draft."] };
  } else if (to === "SCHEDULED") {
    if (flexible)
      return { ok: false as const, errors: ["Flexible assessments can't be scheduled — remove the window or recreate as scheduled."] };
    if (from !== "DRAFT") return { ok: false as const, errors: ["Only drafts can be scheduled."] };
    if (!existing.startsAt || existing.startsAt.getTime() <= now.getTime())
      return { ok: false as const, errors: ["Set a future start time before scheduling."] };
  } else if (to === "RELEASED") {
    if (!["DRAFT", "SCHEDULED", "CLOSED"].includes(from) || (from === "CLOSED" && !flexible))
      return { ok: false as const, errors: ["Cannot release this assessment from its current state."] };
    if (flexible && from === "CLOSED" && existing._count.submissions > 0)
      return { ok: false as const, errors: ["This flexible assessment has attempts — close it permanently instead."] };
  } else if (to === "CLOSED") {
    if (!["RELEASED", "ACTIVE"].includes(from))
      return { ok: false as const, errors: ["Only released or active assessments can be closed."] };
  } else {
    return { ok: false as const, errors: ["Not a supported manual transition."] };
  }

  const assessment = await prisma.assessment.update({ where: { id }, data: { status: to } });
  return { ok: true as const, assessment };
}