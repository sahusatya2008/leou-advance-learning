import "server-only";
import { prisma } from "@/lib/prisma";
import type { PracticalEventType } from "@/generated/prisma/enums";
import { assessmentTopicAllowed, getActiveServices } from "@/services/onboardingService";

/**
 * Practical assignments.
 *
 * A practical set is scoped to exactly one (batch, subject, chapter). That
 * triple is the whole contract:
 *   - the chapter must be a real chapter of that subject in that batch
 *     (`SubjectPricingItem`), because that is the list students' entitlements
 *     are matched against;
 *   - every question in the set must belong to the batch's class + subject and
 *     carry that exact chapter tag, so a question cannot leak into a chapter the
 *     student never availed;
 *   - questions must be practical-tagged, which is what makes them show up in
 *     the builder's candidate list.
 */

export type PracticalCatalog = {
  classes: {
    id: string;
    name: string;
    batches: {
      id: string;
      name: string;
      subjects: { id: string; name: string; code: string; chapters: string[] }[];
    }[];
  }[];
};

/**
 * The cascade the admin builder page walks: class -> batch -> subject ->
 * chapter. Only subjects the batch actually takes, and only chapters that batch
 * has priced for that subject.
 *
 * `subjectCode` narrows to Computer Science for now, which is the only subject
 * with a practical workflow. Passing null returns every subject, so the page can
 * grow later without a new endpoint.
 */
export async function getPracticalCatalog(subjectCode: string | null = "CS"): Promise<PracticalCatalog> {
  const batches = await prisma.batch.findMany({
    where: { isActive: true, classRoom: { isActive: true } },
    orderBy: [{ classRoom: { sortOrder: "asc" } }, { name: "asc" }],
    include: {
      classRoom: { select: { id: true, name: true, sortOrder: true } },
      subjects: {
        where: subjectCode ? { subject: { code: subjectCode } } : {},
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
      },
      pricingItems: { select: { subjectId: true, name: true }, orderBy: { name: "asc" } },
    },
  });

  const classes = new Map<string, PracticalCatalog["classes"][number]>();
  for (const b of batches) {
    if (b.subjects.length === 0) continue;
    let cls = classes.get(b.classRoom.id);
    if (!cls) {
      cls = { id: b.classRoom.id, name: b.classRoom.name, batches: [] };
      classes.set(b.classRoom.id, cls);
    }
    const chaptersFor = (subjectId: string) =>
      b.pricingItems.filter((p) => p.subjectId === subjectId).map((p) => p.name);
    cls.batches.push({
      id: b.id,
      name: b.name,
      subjects: b.subjects.map((s) => ({
        id: s.subject.id,
        name: s.subject.name,
        code: s.subject.code,
        chapters: chaptersFor(s.subject.id),
      })),
    });
  }
  return { classes: [...classes.values()] };
}

export type PracticalAssignmentDetail = {
  id: string;
  batchId: string;
  subjectId: string;
  topic: string;
  title: string;
  instructions: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
  questions: {
    id: string;
    questionId: string;
    order: number;
    stem: string;
    type: string;
    difficulty: string;
    topic: string | null;
    isPractical: boolean;
    allowedLanguages: string[];
    starterCode: Record<string, string> | null;
  }[];
  /** Chapter questions that are practical-tagged but not yet in the set. */
  available: {
    id: string;
    stem: string;
    type: string;
    difficulty: string;
    isPractical: boolean;
  }[];
};

export async function getPracticalAssignment(input: {
  batchId: string;
  subjectId: string;
  topic: string;
}): Promise<PracticalAssignmentDetail | null> {
  const assignment = await prisma.practicalAssignment.findUnique({
    where: {
      batchId_subjectId_topic: {
        batchId: input.batchId,
        subjectId: input.subjectId,
        topic: input.topic,
      },
    },
    include: {
      questions: {
        orderBy: [{ order: "asc" }, { addedAt: "asc" }],
        include: {
          question: {
            select: {
              id: true,
              stem: true,
              type: true,
              difficulty: true,
              topic: true,
              tags: true,
              isPractical: true,
              allowedLanguages: true,
              starterCode: true,
            },
          },
        },
      },
    },
  });
  if (!assignment) return null;

  const batch = await prisma.batch.findUnique({
    where: { id: assignment.batchId },
    select: { classRoomId: true },
  });

  const chapterQuestions = await prisma.question.findMany({
    where: {
      classRoomId: batch?.classRoomId ?? "",
      subjectId: assignment.subjectId,
      topic: assignment.topic,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stem: true,
      type: true,
      difficulty: true,
      isPractical: true,
      tags: true,
    },
  });

  const inSet = new Set(assignment.questions.map((q) => q.questionId));
  return {
    id: assignment.id,
    batchId: assignment.batchId,
    subjectId: assignment.subjectId,
    topic: assignment.topic,
    title: assignment.title,
    instructions: assignment.instructions,
    status: assignment.status,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    questions: assignment.questions.map((q) => ({
      id: q.id,
      questionId: q.question.id,
      order: q.order,
      stem: q.question.stem,
      type: q.question.type,
      difficulty: q.question.difficulty,
      topic: q.question.topic,
      tags: (q.question.tags as string[] | null) ?? [],
      isPractical: q.question.isPractical,
      allowedLanguages: (q.question.allowedLanguages as string[]) ?? [],
      starterCode: (q.question.starterCode as Record<string, string> | null) ?? null,
    })),
    available: chapterQuestions.filter((q) => q.isPractical && !inSet.has(q.id)),
  };
}

/**
 * Confirms the triple is real before we write anything, so we never end up with
 * a practical set pointing at a chapter the batch does not teach.
 */
export async function validateScope(input: {
  batchId: string;
  subjectId: string;
  topic: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: { id: true, classRoomId: true, subjects: { select: { subjectId: true } } },
  });
  if (!batch) return { ok: false, error: "Batch not found." };
  if (!batch.subjects.some((s) => s.subjectId === input.subjectId))
    return { ok: false, error: "That subject is not taken by this batch." };

  const chapter = await prisma.subjectPricingItem.findUnique({
    where: {
      batchId_subjectId_name: { batchId: input.batchId, subjectId: input.subjectId, name: input.topic },
    },
    select: { id: true },
  });
  if (!chapter) return { ok: false, error: "That chapter is not in this batch's chapter list." };
  return { ok: true };
}

export async function upsertPracticalAssignment(input: {
  batchId: string;
  subjectId: string;
  topic: string;
  title?: string;
  instructions?: string | null;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const scope = await validateScope(input);
  if (!scope.ok) return scope;

  const existing = await prisma.practicalAssignment.findUnique({
    where: {
      batchId_subjectId_topic: {
        batchId: input.batchId,
        subjectId: input.subjectId,
        topic: input.topic,
      },
    },
    select: { id: true, title: true, instructions: true, status: true },
  });

  // Publishing is enforced here rather than only in the UI: an empty set must
  // never be able to reach a student.
  const wantPublish = input.status === "PUBLISHED" || existing?.status === "PUBLISHED";
  if (wantPublish) {
    const targetId = existing?.id;
    const questionCount = targetId
      ? await prisma.practicalAssignmentQuestion.count({ where: { assignmentId: targetId } })
      : 0;
    if (questionCount === 0)
      return { ok: false, error: "Add at least one practical question before publishing." };
  }

  if (!existing) {
    const created = await prisma.practicalAssignment.create({
      data: {
        batchId: input.batchId,
        subjectId: input.subjectId,
        topic: input.topic,
        title: (input.title ?? "").trim() || `${input.topic} — Practical`,
        instructions: input.instructions ?? null,
        status: input.status ?? "DRAFT",
      },
      select: { id: true },
    });
    return { ok: true, id: created.id };
  }

  await prisma.practicalAssignment.update({
    where: { id: existing.id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() || existing.title } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  return { ok: true, id: existing.id };
}

/**
 * Adds a question to a practical set. The question must already be
 * practical-tagged and belong to the same class + subject + chapter, otherwise a
 * set could contain a question from a chapter the student never availed.
 */
export async function addQuestionToPractical(input: {
  assignmentId: string;
  questionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const assignment = await prisma.practicalAssignment.findUnique({
    where: { id: input.assignmentId },
    select: { id: true, batchId: true, subjectId: true, topic: true },
  });
  if (!assignment) return { ok: false, error: "Practical set not found." };

  const batch = await prisma.batch.findUnique({
    where: { id: assignment.batchId },
    select: { classRoomId: true },
  });
  const question = await prisma.question.findUnique({
    where: { id: input.questionId },
    select: { id: true, classRoomId: true, subjectId: true, topic: true, isPractical: true },
  });
  if (!question) return { ok: false, error: "Question not found." };
  if (question.classRoomId !== batch?.classRoomId)
    return { ok: false, error: "That question belongs to a different class." };
  if (question.subjectId !== assignment.subjectId)
    return { ok: false, error: "That question belongs to a different subject." };
  if (question.topic !== assignment.topic)
    return { ok: false, error: "That question is tagged to a different chapter." };
  if (!question.isPractical)
    return { ok: false, error: "Tick “Practical question” on the question first." };

  const last = await prisma.practicalAssignmentQuestion.findFirst({
    where: { assignmentId: input.assignmentId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.practicalAssignmentQuestion.create({
    data: {
      assignmentId: input.assignmentId,
      questionId: input.questionId,
      order: (last?.order ?? 0) + 1,
    },
  });
  return { ok: true };
}

export async function removeQuestionFromPractical(input: {
  assignmentId: string;
  questionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const membership = await prisma.practicalAssignmentQuestion.findFirst({
    where: { assignmentId: input.assignmentId, questionId: input.questionId },
    select: { id: true },
  });
  if (!membership) return { ok: false, error: "That question is not in this practical set." };

  // Taking the last question out of a live set would strand students on an
  // empty published practical, so archive it instead of leaving it published.
  const [remaining, assignment] = await Promise.all([
    prisma.practicalAssignmentQuestion.count({ where: { assignmentId: input.assignmentId } }),
    prisma.practicalAssignment.findUnique({
      where: { id: input.assignmentId },
      select: { status: true },
    }),
  ]);
  const empties = remaining - 1 <= 0;
  if (empties && assignment?.status === "PUBLISHED") {
    await prisma.$transaction([
      prisma.practicalAssignmentQuestion.delete({ where: { id: membership.id } }),
      prisma.practicalAssignment.update({
        where: { id: input.assignmentId },
        data: { status: "ARCHIVED" },
      }),
    ]);
    return { ok: true };
  }

  await prisma.practicalAssignmentQuestion.delete({ where: { id: membership.id } });
  return { ok: true };
}

/** Reorder helper: the caller sends the full ordered list of question ids. */
export async function reorderPracticalQuestions(input: {
  assignmentId: string;
  orderedQuestionIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await prisma.practicalAssignmentQuestion.findMany({
    where: { assignmentId: input.assignmentId },
    select: { id: true, questionId: true },
  });
  // The caller sends question ids, so the lookup must be keyed by questionId;
  // `id` is the membership row, which the client never sees.
  const membershipByQuestionId = new Map(rows.map((r) => [r.questionId, r.id]));
  if (input.orderedQuestionIds.length !== rows.length)
    return { ok: false, error: "Send every question in the set, in order." };

  const unknown = input.orderedQuestionIds.filter((id) => !membershipByQuestionId.has(id));
  if (unknown.length)
    return { ok: false, error: "Unknown question in reorder list." };

  await prisma.$transaction(
    input.orderedQuestionIds.map((questionId, index) =>
      prisma.practicalAssignmentQuestion.update({
        where: { id: membershipByQuestionId.get(questionId)! },
        data: { order: index + 1 },
      })
    )
  );
  return { ok: true };
}
/* ------------------------------------------------------------------ *
 * Student-facing reads
 *
 * Everything below re-derives permission from scratch instead of trusting
 * an id the client sent. A student may only reach a set that is
 *   - published (never a draft an admin is still assembling),
 *   - inside a batch they are a member of, and
 *   - inside a chapter their plan actually covers.
 * The projection deliberately omits `solutionCode` and `testCases`: those are
 * the marking material and must never reach the browser.
 * ------------------------------------------------------------------ */

export type StudentPracticalSummary = {
  id: string;
  title: string;
  topic: string;
  className: string;
  batchName: string;
  subjectName: string;
  questionCount: number;
  finishedCount: number;
  updatedAt: Date;
};

export type StudentPracticalQuestion = {
  questionId: string;
  order: number;
  stem: string;
  type: string;
  difficulty: string;
  tags: string[];
  allowedLanguages: string[];
  starterCode: Record<string, string> | null;
  attempt: {
    id: string;
    status: "IN_PROGRESS" | "FINISHED";
    language: string | null;
    code: string | null;
    startedAt: Date;
    lastActivityAt: Date;
    finishedAt: Date | null;
  } | null;
};

export type StudentPracticalDetail = {
  id: string;
  title: string;
  topic: string;
  instructions: string | null;
  className: string;
  batchName: string;
  subjectName: string;
  questions: StudentPracticalQuestion[];
};

export type StudentPracticalGate =
  | { ok: true; assignmentId: string; studentProfileId: string; subjectId: string; topic: string }
  | { ok: false; status: number; error: string };

/**
 * The one gate every student-facing practical route funnels through, so a set can
 * never be reached by guessing an id. `expectedQuestionId` additionally proves the
 * question really is in that set.
 */
export async function gateStudentPractical(input: {
  userId: string;
  assignmentId: string;
  expectedQuestionId?: string;
}): Promise<StudentPracticalGate> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { studentProfile: { select: { id: true } } },
  });
  const studentProfileId = user?.studentProfile?.id;
  if (!studentProfileId) return { ok: false, status: 403, error: "Not a student account." };

  const assignment = await prisma.practicalAssignment.findUnique({
    where: { id: input.assignmentId },
    select: {
      id: true,
      batchId: true,
      subjectId: true,
      topic: true,
      status: true,
      batch: {
        select: {
          isActive: true,
          classRoom: { select: { isActive: true } },
          students: { where: { studentId: studentProfileId }, select: { studentId: true } },
        },
      },
    },
  });
  // 404 (not 403) for "exists but is not yours": a wrong id and someone else's
  // id should be indistinguishable from the outside.
  if (!assignment || assignment.status !== "PUBLISHED") return { ok: false, status: 404, error: "Practical not found." };
  if (!assignment.batch.isActive || !assignment.batch.classRoom.isActive)
    return { ok: false, status: 404, error: "Practical not found." };
  if (assignment.batch.students.length === 0) return { ok: false, status: 404, error: "Practical not found." };

  // Entitlement: same rule as assessments, on the assignment bucket.
  const services = await getActiveServices(input.userId);
  if (!assessmentTopicAllowed(services, "ASSIGNMENT", assignment.topic, assignment.subjectId))
    return { ok: false, status: 403, error: "This chapter is not part of your plan." };

  if (input.expectedQuestionId) {
    const membership = await prisma.practicalAssignmentQuestion.findUnique({
      where: {
        assignmentId_questionId: {
          assignmentId: assignment.id,
          questionId: input.expectedQuestionId,
        },
      },
      select: { id: true },
    });
    if (!membership) return { ok: false, status: 404, error: "That question is not in this practical." };
  }

  return {
    ok: true,
    assignmentId: assignment.id,
    studentProfileId,
    subjectId: assignment.subjectId,
    topic: assignment.topic,
  };
}

export async function listStudentPracticals(userId: string): Promise<StudentPracticalSummary[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studentProfile: { select: { id: true } } },
  });
  const studentProfileId = user?.studentProfile?.id;
  if (!studentProfileId) return [];

  const assignments = await prisma.practicalAssignment.findMany({
    where: {
      status: "PUBLISHED",
      subject: { code: "CS" },
      batch: {
        isActive: true,
        classRoom: { isActive: true },
        students: { some: { studentId: studentProfileId } },
      },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      topic: true,
      subjectId: true,
      updatedAt: true,
      subject: { select: { name: true } },
      batch: { select: { name: true, classRoom: { select: { name: true } } } },
      _count: { select: { questions: true } },
      questions: {
        select: {
          questionId: true,
          question: {
            select: {
              practicalAttempts: {
                where: { studentId: studentProfileId, status: "FINISHED" },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const services = await getActiveServices(userId);

  return assignments
    .filter((a) => assessmentTopicAllowed(services, "ASSIGNMENT", a.topic, a.subjectId))
    .map((a) => ({
      id: a.id,
      title: a.title,
      topic: a.topic,
      className: a.batch.classRoom.name,
      batchName: a.batch.name,
      subjectName: a.subject.name,
      questionCount: a._count.questions,
      finishedCount: a.questions.filter((m) => m.question.practicalAttempts.length > 0).length,
      updatedAt: a.updatedAt,
    }));
}

export async function getStudentPractical(input: {
  userId: string;
  assignmentId: string;
}): Promise<{ ok: true; practical: StudentPracticalDetail } | { ok: false; status: number; error: string }> {
  const gate = await gateStudentPractical(input);
  if (!gate.ok) return gate;

  const assignment = await prisma.practicalAssignment.findUnique({
    where: { id: gate.assignmentId },
    select: {
      id: true,
      title: true,
      topic: true,
      instructions: true,
      subject: { select: { name: true } },
      batch: { select: { name: true, classRoom: { select: { name: true } } } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          questionId: true,
          order: true,
          question: {
            // Marking material is not in this select, so it cannot leak.
            select: {
              stem: true,
              type: true,
              difficulty: true,
              tags: true,
              allowedLanguages: true,
              starterCode: true,
              practicalAttempts: {
                where: { studentId: gate.studentProfileId },
                orderBy: { lastActivityAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  language: true,
                  code: true,
                  startedAt: true,
                  lastActivityAt: true,
                  finishedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!assignment) return { ok: false, status: 404, error: "Practical not found." };

  return {
    ok: true,
    practical: {
      id: assignment.id,
      title: assignment.title,
      topic: assignment.topic,
      instructions: assignment.instructions,
      className: assignment.batch.classRoom.name,
      batchName: assignment.batch.name,
      subjectName: assignment.subject.name,
      questions: assignment.questions.map((m) => ({
        questionId: m.questionId,
        order: m.order,
        stem: m.question.stem,
        type: m.question.type,
        difficulty: m.question.difficulty,
        tags: (m.question.tags as string[] | null) ?? [],
        allowedLanguages: (m.question.allowedLanguages as string[]) ?? [],
        starterCode: (m.question.starterCode as Record<string, string> | null) ?? null,
        attempt: (() => {
          // The newest attempt for this student; `take: 1` above ordered them.
          const a = m.question.practicalAttempts[0];
          if (!a) return null;
          return {
            id: a.id,
            status: a.status,
            language: a.language,
            code: a.code,
            startedAt: a.startedAt,
            lastActivityAt: a.lastActivityAt,
            finishedAt: a.finishedAt,
          };
        })(),
      })),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Attempt lifecycle
 *
 * One attempt row per (set, student, question). It is resumed rather than
 * recreated, so a student who closes the tab keeps their code. `code` on the
 * row is only the latest snapshot; every save also appends a PracticalEvent,
 * which is what the admin activity feed and the doubt threads read.
 * ------------------------------------------------------------------ */

const MAX_CODE = 100_000;

/** PracticalEvent.detail is Json; keep the shape narrow rather than importing the
 * whole Prisma namespace. */
type EventDetail = { [key: string]: string | number | boolean };

async function recordEvent(input: {
  attemptId: string;
  studentId: string;
  type: PracticalEventType;
  summary?: string;
  detail?: EventDetail;
}) {
  await prisma.practicalEvent.create({
    data: {
      attemptId: input.attemptId,
      studentId: input.studentId,
      type: input.type,
      summary: input.summary ?? null,
      detail: input.detail ?? undefined,
    },
  });
}

/* ------------------------------------------------------------------ *
 * Terminal activity trail.
 *
 * The admin's "Show Practical Activity" page reads this, so it follows the
 * same truncation discipline as the doubt excerpts: inputs are capped small,
 * each stream of a transcript keeps its tail, and one transcript is written
 * per session — deduped on the sessionId in detail, because the kill route
 * and the poll route can both notice the same session ending.
 * ------------------------------------------------------------------ */

const MAX_TERMINAL_EVENT_CHARS = 4_000;

/** One line the student typed into a live practical session. */
export async function recordTerminalInput(input: {
  attemptId: string;
  studentId: string;
  sessionId: string;
  text: string;
}): Promise<void> {
  const oneLine = input.text.replace(/\s+/g, " ").trim().slice(0, 120);
  await recordEvent({
    attemptId: input.attemptId,
    studentId: input.studentId,
    type: "TERMINAL_INPUT",
    summary: oneLine ? `Sent to terminal: ${oneLine}` : "Sent to terminal",
    detail: { sessionId: input.sessionId, input: input.text.slice(0, MAX_TERMINAL_EVENT_CHARS) },
  });
}

/** The full transcript of a session, written once when the session ends. */
export async function recordSessionTranscript(input: {
  attemptId: string;
  studentId: string;
  sessionId: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}): Promise<void> {
  const existing = await prisma.practicalEvent.findFirst({
    where: {
      attemptId: input.attemptId,
      type: "TERMINAL_OUTPUT",
      detail: { path: ["sessionId"], equals: input.sessionId },
    },
    select: { id: true },
  });
  if (existing) return;
  await recordEvent({
    attemptId: input.attemptId,
    studentId: input.studentId,
    type: "TERMINAL_OUTPUT",
    summary:
      input.exitCode === null
        ? "Session ended (killed)"
        : `Session ended (exit ${input.exitCode})`,
    detail: {
      sessionId: input.sessionId,
      stdout: input.stdout.slice(-MAX_TERMINAL_EVENT_CHARS),
      stderr: input.stderr.slice(-MAX_TERMINAL_EVENT_CHARS),
      exitCode: input.exitCode ?? -1,
    },
  });
}

export async function startOrResumeAttempt(input: {
  userId: string;
  assignmentId: string;
  questionId: string;
}): Promise<
  | { ok: true; attempt: { id: string; language: string; code: string; status: "IN_PROGRESS" | "FINISHED" } }
  | { ok: false; status: number; error: string }
> {
  const gate = await gateStudentPractical({ ...input, expectedQuestionId: input.questionId });
  if (!gate.ok) return gate;

  const question = await prisma.question.findUnique({
    where: { id: input.questionId },
    select: { type: true, allowedLanguages: true, starterCode: true },
  });
  if (!question || question.type !== "CODING")
    return { ok: false, status: 400, error: "Only coding questions can be attempted here." };
  const languages = (question.allowedLanguages as string[]) ?? [];
  if (languages.length === 0) return { ok: false, status: 400, error: "No language is configured." };

  const existing = await prisma.practicalAttempt.findFirst({
    where: { assignmentId: gate.assignmentId, studentId: gate.studentProfileId, questionId: input.questionId },
    orderBy: { lastActivityAt: "desc" },
  });
  if (existing)
    return {
      ok: true,
      attempt: {
        id: existing.id,
        language: existing.language ?? languages[0],
        code: existing.code ?? "",
        status: existing.status,
      },
    };

  const language = languages[0];
  const starter = ((question.starterCode as Record<string, string> | null) ?? {})[language] ?? "";
  const attempt = await prisma.practicalAttempt.create({
    data: {
      assignmentId: gate.assignmentId,
      studentId: gate.studentProfileId,
      questionId: input.questionId,
      language,
      code: starter,
    },
    select: { id: true, language: true, code: true, status: true },
  });
  await recordEvent({
    attemptId: attempt.id,
    studentId: gate.studentProfileId,
    type: "ATTEMPT_STARTED",
    summary: `Started on ${gate.topic}`,
  });
  return { ok: true, attempt: { id: attempt.id, language, code: starter, status: attempt.status } };
}

/** Loads an attempt only if it belongs to this student. */
export async function loadOwnAttempt(input: {
  userId: string;
  attemptId: string;
}): Promise<{ ok: true; attempt: { id: string; assignmentId: string; questionId: string; studentId: string; status: "IN_PROGRESS" | "FINISHED"; language: string | null; code: string | null } } | { ok: false; status: number; error: string }> {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { studentProfile: { select: { id: true } } } });
  const studentProfileId = user?.studentProfile?.id;
  if (!studentProfileId) return { ok: false, status: 403, error: "Not a student account." };

  const attempt = await prisma.practicalAttempt.findFirst({
    where: { id: input.attemptId, studentId: studentProfileId },
    select: {
      id: true,
      assignmentId: true,
      questionId: true,
      studentId: true,
      status: true,
      language: true,
      code: true,
    },
  });
  if (!attempt) return { ok: false, status: 404, error: "Attempt not found." };
  return { ok: true, attempt };
}

export async function saveAttemptCode(input: {
  userId: string;
  attemptId: string;
  code: string;
  language?: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const own = await loadOwnAttempt(input);
  if (!own.ok) return own;
  if (own.attempt.status === "FINISHED") return { ok: false, status: 409, error: "This attempt is already marked done." };
  if (input.code.length > MAX_CODE) return { ok: false, status: 400, error: "That code is too large to save." };

  const language = input.language ?? own.attempt.language ?? undefined;
  await prisma.practicalAttempt.update({
    where: { id: own.attempt.id },
    data: {
      code: input.code,
      lastActivityAt: new Date(),
      ...(language ? { language } : {}),
    },
  });
  await recordEvent({
    attemptId: own.attempt.id,
    studentId: own.attempt.studentId,
    type: "CODE_SAVED",
    summary: `Saved ${input.code.length} characters`,
    detail: { length: input.code.length },
  });
  return { ok: true };
}

export async function finishAttempt(input: {
  userId: string;
  attemptId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const own = await loadOwnAttempt(input);
  if (!own.ok) return own;
  if (own.attempt.status === "FINISHED") return { ok: true };

  await prisma.practicalAttempt.update({
    where: { id: own.attempt.id },
    data: { status: "FINISHED", finishedAt: new Date(), lastActivityAt: new Date() },
  });
  await recordEvent({
    attemptId: own.attempt.id,
    studentId: own.attempt.studentId,
    type: "ATTEMPT_FINISHED",
    summary: "Marked done",
  });
  return { ok: true };
}

/**
 * Reopens a finished attempt. This has to be a real state change rather than a
 * UI toggle: saves are rejected on a FINISHED attempt, so a client that only
 * forgot its local flag would come back to a 409 on the next keystroke.
 */
export async function reopenAttempt(input: {
  userId: string;
  attemptId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const own = await loadOwnAttempt(input);
  if (!own.ok) return own;
  if (own.attempt.status !== "FINISHED") return { ok: true };

  await prisma.practicalAttempt.update({
    where: { id: own.attempt.id },
    data: { status: "IN_PROGRESS", finishedAt: null, lastActivityAt: new Date() },
  });
  await recordEvent({
    attemptId: own.attempt.id,
    studentId: own.attempt.studentId,
    type: "ATTEMPT_REOPENED",
    summary: "Reopened after marking done",
  });
  return { ok: true };
}

/** Records a run and its output against the attempt, so the admin feed can show
 * what the student actually executed rather than only their final code. */
export async function recordRun(input: {
  userId: string;
  attemptId: string;
  language: string;
  ok: boolean;
  exitCode: number | null;
  outputPreview: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const own = await loadOwnAttempt(input);
  if (!own.ok) return own;

  await prisma.practicalAttempt.update({
    where: { id: own.attempt.id },
    data: { language: input.language, lastActivityAt: new Date() },
  });
  await recordEvent({
    attemptId: own.attempt.id,
    studentId: own.attempt.studentId,
    type: "CODE_RUN",
    summary: input.ok ? "Run finished" : "Run reported an error",
    detail: {
      language: input.language,
      exitCode: input.exitCode ?? -1,
      ok: input.ok,
      output: input.outputPreview.slice(0, 2000),
    },
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Doubts
 *
 * A doubt is a private thread between one student and the admin team,
 * scoped to one question of one practical set. Every entry point re-checks
 * ownership rather than trusting an id:
 *   - students may only touch threads they started, on a question they can
 *     actually reach (same published-set + batch + entitlement gate);
 *   - admins may read any thread and reply, and are the only role that can
 *     mark one answered.
 * Recordings are deleted the moment the student marks a thread satisfied, and
 * anything still unresolved is purged by `purgeStaleRecordings` after 30 days.
 * ------------------------------------------------------------------ */

const MAX_BODY = 4000;
const MAX_EXCERPT = 8000;
/** Unresolved threads lose their recordings after this long. */
export const RECORDING_RETENTION_DAYS = 30;

export type DoubtMessageView = {
  id: string;
  authorRole: "STUDENT" | "ADMIN";
  authorId: string;
  body: string | null;
  codeExcerpt: string | null;
  terminalExcerpt: string | null;
  createdAt: Date;
  recordings: { id: string; kind: "SCREEN" | "VOICE"; mimeType: string; sizeBytes: number; durationMs: number | null; deletedAt: Date | null }[];
};

export type DoubtView = {
  id: string;
  assignmentId: string;
  questionId: string;
  status: "OPEN" | "ANSWERED" | "SATISFIED";
  createdAt: Date;
  lastActivityAt: Date;
  answeredAt: Date | null;
  satisfiedAt: Date | null;
  messages: DoubtMessageView[];
  student?: { id: string; fullName: string };
  assignment?: { id: string; title: string; topic: string };
  question?: { id: string; stem: string };
};

function doubtInclude() {
  return {
    messages: {
      orderBy: { createdAt: "asc" as const },
      include: {
        recordings: {
          orderBy: { createdAt: "asc" as const },
          select: { id: true, kind: true, mimeType: true, sizeBytes: true, durationMs: true, deletedAt: true },
        },
      },
    },
  };
}

function toDoubtView(d: {
  id: string;
  assignmentId: string;
  questionId: string;
  status: "OPEN" | "ANSWERED" | "SATISFIED";
  createdAt: Date;
  lastActivityAt: Date;
  answeredAt: Date | null;
  satisfiedAt: Date | null;
  messages: {
    id: string; authorRole: "STUDENT" | "ADMIN"; authorId: string;
    body: string | null; codeExcerpt: string | null; terminalExcerpt: string | null; createdAt: Date;
    recordings: DoubtMessageView["recordings"];
  }[];
  student?: { id: string; fullName: string };
  assignment?: { id: string; title: string; topic: string };
  question?: { id: string; stem: string };
}): DoubtView {
  return {
    id: d.id,
    assignmentId: d.assignmentId,
    questionId: d.questionId,
    status: d.status,
    createdAt: d.createdAt,
    lastActivityAt: d.lastActivityAt,
    answeredAt: d.answeredAt,
    satisfiedAt: d.satisfiedAt,
    ...(d.student ? { student: d.student } : {}),
    ...(d.assignment ? { assignment: d.assignment } : {}),
    ...(d.question ? { question: d.question } : {}),
    messages: d.messages.map((m) => ({
      id: m.id,
      authorRole: m.authorRole,
      authorId: m.authorId,
      body: m.body,
      codeExcerpt: m.codeExcerpt,
      terminalExcerpt: m.terminalExcerpt,
      createdAt: m.createdAt,
      recordings: m.recordings,
    })),
  };
}

async function studentProfileIdOf(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studentProfile: { select: { id: true } } },
  });
  return user?.studentProfile?.id ?? null;
}

/** The student's own threads for one question, newest activity first. */
export async function listStudentDoubts(input: {
  userId: string;
  assignmentId: string;
  questionId: string;
}): Promise<{ ok: true; doubts: DoubtView[] } | { ok: false; status: number; error: string }> {
  const gate = await gateStudentPractical({ ...input, expectedQuestionId: input.questionId });
  if (!gate.ok) return gate;

  const rows = await prisma.practicalDoubt.findMany({
    where: { assignmentId: gate.assignmentId, questionId: input.questionId, studentId: gate.studentProfileId },
    orderBy: { lastActivityAt: "desc" },
    include: doubtInclude(),
  });
  return { ok: true, doubts: rows.map(toDoubtView) };
}

export async function createDoubt(input: {
  userId: string;
  assignmentId: string;
  questionId: string;
  body: string;
  codeExcerpt?: string | null;
  terminalExcerpt?: string | null;
}): Promise<{ ok: true; doubt: DoubtView } | { ok: false; status: number; error: string }> {
  const gate = await gateStudentPractical({ ...input, expectedQuestionId: input.questionId });
  if (!gate.ok) return gate;

  const body = input.body.trim();
  if (!body && !input.codeExcerpt?.trim() && !input.terminalExcerpt?.trim())
    return { ok: false, status: 400, error: "Say what you are stuck on, or attach what you were looking at." };
  if (body.length > MAX_BODY) return { ok: false, status: 400, error: "That message is too long." };

  const doubt = await prisma.practicalDoubt.create({
    data: {
      assignmentId: gate.assignmentId,
      questionId: input.questionId,
      studentId: gate.studentProfileId,
      messages: {
        create: {
          authorRole: "STUDENT",
          authorId: gate.studentProfileId,
          body: body || null,
          codeExcerpt: input.codeExcerpt?.slice(0, MAX_EXCERPT) ?? null,
          terminalExcerpt: input.terminalExcerpt?.slice(0, MAX_EXCERPT) ?? null,
        },
      },
    },
    include: doubtInclude(),
  });
  return { ok: true, doubt: toDoubtView(doubt) };
}

export async function replyToDoubt(input: {
  userId: string;
  role: "STUDENT" | "ADMIN";
  doubtId: string;
  body: string;
}): Promise<{ ok: true; doubt: DoubtView } | { ok: false; status: number; error: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, status: 400, error: "Write something first." };
  if (body.length > MAX_BODY) return { ok: false, status: 400, error: "That message is too long." };

  const doubt = await prisma.practicalDoubt.findUnique({
    where: { id: input.doubtId },
    select: { id: true, studentId: true, status: true },
  });
  if (!doubt) return { ok: false, status: 404, error: "That thread no longer exists." };

  if (input.role === "STUDENT") {
    const studentProfileId = await studentProfileIdOf(input.userId);
    if (!studentProfileId || doubt.studentId !== studentProfileId)
      return { ok: false, status: 404, error: "That thread no longer exists." };
    if (doubt.status === "SATISFIED")
      return { ok: false, status: 409, error: "This thread is closed." };
  }

  const updated = await prisma.practicalDoubt.update({
    where: { id: doubt.id },
    data: {
      lastActivityAt: new Date(),
      messages: {
        create: { authorRole: input.role, authorId: input.userId, body },
      },
    },
    include: doubtInclude(),
  });
  // An admin reply moves the thread to ANSWERED; a student follow-up leaves it
  // alone so the thread does not fall back to "nobody has replied".
  if (input.role === "ADMIN" && updated.status === "OPEN") {
    const marked = await prisma.practicalDoubt.update({
      where: { id: doubt.id },
      data: { status: "ANSWERED", answeredAt: new Date() },
      include: doubtInclude(),
    });
    return { ok: true, doubt: toDoubtView(marked) };
  }
  return { ok: true, doubt: toDoubtView(updated) };
}

/**
 * The student confirms the answer helped. This is the point the recordings are
 * deleted, as agreed: the row is kept so the thread can show that a recording
 * existed, but the bytes are gone.
 */
export async function markDoubtSatisfied(input: {
  userId: string;
  doubtId: string;
}): Promise<{ ok: true; doubt: DoubtView; recordingsDeleted: number } | { ok: false; status: number; error: string }> {
  const studentProfileId = await studentProfileIdOf(input.userId);
  if (!studentProfileId) return { ok: false, status: 403, error: "Not a student account." };

  const doubt = await prisma.practicalDoubt.findFirst({
    where: { id: input.doubtId, studentId: studentProfileId },
    select: { id: true, status: true },
  });
  if (!doubt) return { ok: false, status: 404, error: "That thread no longer exists." };
  if (doubt.status === "SATISFIED")
    return { ok: false, status: 409, error: "This thread is already closed." };

  const recordings = await prisma.practicalRecording.findMany({
    where: { doubtId: doubt.id, deletedAt: null },
    select: { id: true, storageName: true },
  });
  await prisma.$transaction([
    prisma.practicalDoubt.update({
      where: { id: doubt.id },
      data: { status: "SATISFIED", satisfiedAt: new Date(), lastActivityAt: new Date() },
    }),
    prisma.practicalRecording.updateMany({
      where: { doubtId: doubt.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
  ]);
  // Files last: if this throws the rows already say deletedAt, and the orphan
  // sweep will collect the bytes on its next run.
  const { deleteRecordingFile } = await import("@/lib/recordings");
  for (const r of recordings) deleteRecordingFile(r.storageName);

  const updated = await prisma.practicalDoubt.findUniqueOrThrow({
    where: { id: doubt.id },
    include: doubtInclude(),
  });
  return { ok: true, doubt: toDoubtView(updated), recordingsDeleted: recordings.length };
}

/** Admin inbox + thread read. Students are rejected before this is reached. */
export async function listDoubtsForAdmin(input: {
  status?: "OPEN" | "ANSWERED" | "SATISFIED";
}): Promise<DoubtView[]> {
  const rows = await prisma.practicalDoubt.findMany({
    where: input.status ? { status: input.status } : {},
    orderBy: { lastActivityAt: "desc" },
    take: 200,
    include: {
      ...doubtInclude(),
      student: { select: { id: true, fullName: true } },
      assignment: { select: { id: true, title: true, topic: true } },
      question: { select: { id: true, stem: true } },
    },
  });
  return rows.map((r) => toDoubtView(r));
}

export async function getDoubtForAdmin(doubtId: string): Promise<DoubtView | null> {
  const row = await prisma.practicalDoubt.findUnique({
    where: { id: doubtId },
    include: {
      ...doubtInclude(),
      student: { select: { id: true, fullName: true } },
      assignment: { select: { id: true, title: true, topic: true } },
      question: { select: { id: true, stem: true } },
    },
  });
  return row ? toDoubtView(row) : null;
}

/**
 * Deletes recordings on threads that are still unresolved after the retention
 * window. Satisfied threads were already cleared when the student confirmed.
 *
 * Returns what it removed so the caller can log it; safe to run repeatedly.
 */
export async function purgeStaleRecordings(now = new Date()): Promise<{ purged: number; bytesFreed: number }> {
  const cutoff = new Date(now.getTime() - RECORDING_RETENTION_DAYS * 24 * 3600 * 1000);
  const stale = await prisma.practicalRecording.findMany({
    where: {
      deletedAt: null,
      createdAt: { lt: cutoff },
      doubt: { status: { in: ["OPEN", "ANSWERED"] } },
    },
    select: { id: true, storageName: true, sizeBytes: true },
  });
  if (stale.length === 0) return { purged: 0, bytesFreed: 0 };

  await prisma.practicalRecording.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { deletedAt: now },
  });
  const { deleteRecordingFile } = await import("@/lib/recordings");
  for (const s of stale) deleteRecordingFile(s.storageName);
  return { purged: stale.length, bytesFreed: stale.reduce((n, s) => n + s.sizeBytes, 0) };
}

/**
 * Attaches a screen or voice recording to a thread.
 *
 * Consent is a required boolean, not a nicety: without it nothing is written. The
 * recording is private to the owning student and admins by construction, because
 * it is never given a URL — playback re-checks the caller every time.
 */
export async function attachDoubtRecording(input: {
  userId: string;
  doubtId: string;
  messageId?: string | null;
  kind: "SCREEN" | "VOICE";
  buffer: Buffer;
  durationMs?: number | null;
  consented: boolean;
}): Promise<{ ok: true; recording: { id: string; kind: "SCREEN" | "VOICE"; sizeBytes: number } } | { ok: false; status: number; error: string }> {
  if (!input.consented)
    return { ok: false, status: 400, error: "Tick the consent box before attaching a recording." };

  const studentProfileId = await studentProfileIdOf(input.userId);
  if (!studentProfileId) return { ok: false, status: 403, error: "Not a student account." };

  const doubt = await prisma.practicalDoubt.findFirst({
    where: { id: input.doubtId, studentId: studentProfileId },
    select: { id: true, status: true },
  });
  if (!doubt) return { ok: false, status: 404, error: "That thread no longer exists." };
  if (doubt.status === "SATISFIED")
    return { ok: false, status: 409, error: "This thread is closed." };

  // The message must belong to this thread, or a recording could be pinned onto
  // somebody else's message by id.
  if (input.messageId) {
    const message = await prisma.practicalDoubtMessage.findFirst({
      where: { id: input.messageId, doubtId: doubt.id },
      select: { id: true },
    });
    if (!message) return { ok: false, status: 400, error: "That message is not in this thread." };
  }

  const { saveRecording } = await import("@/lib/recordings");
  const saved = saveRecording(input.kind, input.buffer);
  if (!saved.ok) return { ok: false, status: 400, error: saved.error };

  const recording = await prisma.practicalRecording.create({
    data: {
      doubtId: doubt.id,
      messageId: input.messageId ?? null,
      studentId: studentProfileId,
      kind: input.kind,
      storageName: saved.storageName,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      durationMs: input.durationMs ?? null,
      consentedAt: new Date(),
    },
    select: { id: true, kind: true, sizeBytes: true },
  });
  await prisma.practicalDoubt.update({ where: { id: doubt.id }, data: { lastActivityAt: new Date() } });
  return { ok: true, recording };
}

/**
 * Resolves a recording for playback. Admins may open any; a student may only open
 * one on their own thread. Returns 404 for everything else so a wrong id and
 * someone else's id look the same from outside.
 */
export async function authorizeRecordingPlayback(
  userId: string,
  role: "STUDENT" | "ADMIN",
  recordingId: string
): Promise<
  | { ok: true; abs: string; mimeType: string }
  | { ok: false; status: number; error: string }
> {
  const recording = await prisma.practicalRecording.findUnique({
    where: { id: recordingId },
    select: { id: true, storageName: true, mimeType: true, deletedAt: true, doubt: { select: { studentId: true } } },
  });
  if (!recording || recording.deletedAt)
    return { ok: false, status: 404, error: "Recording not found." };

  if (role === "STUDENT") {
    const studentProfileId = await studentProfileIdOf(userId);
    if (!studentProfileId || recording.doubt.studentId !== studentProfileId)
      return { ok: false, status: 404, error: "Recording not found." };
  }

  const { resolveRecordingPath } = await import("@/lib/recordings");
  const resolved = resolveRecordingPath(recording.storageName);
  if (!resolved.ok) return { ok: false, status: 404, error: "Recording not found." };
  return { ok: true, abs: resolved.abs, mimeType: recording.mimeType };
}
