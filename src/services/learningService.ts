/**
 * Entitlement and catalogue for the student 3D Courses section.
 *
 * Three courses live here:
 *   - General Organic Chemistry (GOC) is **free for every student**, including
 *     one who never availed Chemistry. It bypasses all entitlement checks.
 *   - Haloalkanes & Haloarenes is available only to a student who availed the
 *     chapter for Class 12 CBSE Chemistry.
 *   - Encoding Schemes & Conversions keeps its original Class 11 CBSE Computer
 *     Science gate, unchanged.
 *
 * Everything is read-only: no schema, no rows and no writes are involved, and
 * progress stays in the browser. The gates reuse the platform's own helpers
 * (`requireActiveService`, `getActiveServices`, `assessmentTopicAllowed`) so
 * they cannot drift from the rules that protect practicals and assessments.
 */
import { prisma } from "@/lib/prisma";
import { CONCEPTS, COURSE_CHAPTER, COURSE_ID, COURSE_TITLE } from "@/lib/learning3d/encodingCourse";
import {
  GOC_CONCEPTS,
  GOC_COURSE_ID,
  GOC_COURSE_TITLE,
} from "@/lib/learning3d/chemCourse";
import {
  HALO_CONCEPTS,
  HALO_COURSE_ID,
  HALO_COURSE_TITLE,
} from "@/lib/learning3d/haloCourse";
import {
  assessmentTopicAllowed,
  getActiveServices,
  requireActiveService,
  type ActiveServices,
} from "@/services/onboardingService";

// Stable ids in this deployment. Used only as fallbacks — live values are
// resolved by code/name so a re-seeded database cannot lock students out.
const CS_SUBJECT_ID = "cmue7ywgy00085irw76w1zbqx";
const CHEM_SUBJECT_ID = "cmue7ywgl00055irwfookymfb";
const CLASS_11_ID = "cmue7ywg500015irw4sofszke";
const CLASS_12_ID = "cmue7ywg800025irwkksoecee";
const CBSE_BOARD_ID = "af60d053-9ad1-4a4f-945b-6863eb9fe05d";

export type LearningChapter = {
  /** Route slug for a playable course; the lower-cased topic name otherwise. */
  id: string;
  name: string;
  /** Only courses the student may actually open. */
  available: boolean;
  /** Free courses bypass entitlement entirely. */
  free?: boolean;
  /** Why a locked course cannot be opened yet. */
  lockedReason?: string;
  /** Short copy for the hub card. */
  description?: string;
  kind?: "goc" | "halo" | "encoding" | "topic";
};

export type LearningAccess =
  | { ok: true; csSubjectId: string; chapters: LearningChapter[] }
  | { ok: false; status: number; error: string };

export type LearningCatalogue = {
  chapters: LearningChapter[];
  /** True when the student has at least one paid 3D-course entitlement. The
   *  free GOC course never affects this flag. */
  eligible: boolean;
};

export type LearningCourseResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      courseId: string;
      title: string;
      tagline: string;
      chapter: string;
      conceptCount: number;
      chapters: LearningChapter[];
    };

const GOC_CHAPTER: LearningChapter = {
  id: GOC_COURSE_ID,
  name: GOC_COURSE_TITLE,
  available: true,
  free: true,
  kind: "goc",
  description: "Free for every student — bonding, effects, mechanisms, stereochemistry and JEE problem solving.",
};
const HALO_CHAPTER: LearningChapter = {
  id: HALO_COURSE_ID,
  name: HALO_COURSE_TITLE,
  available: false,
  kind: "halo",
  description: "Class 12 CBSE Chemistry + JEE — preparation, SN1/SN2, elimination and haloarenes.",
};
const ENCODING_CHAPTER: LearningChapter = {
  id: COURSE_ID,
  name: COURSE_TITLE,
  available: false,
  kind: "encoding",
  description: "From a single switch to binary arithmetic, fractions, floating point and every conversion route.",
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Tolerate the topic spellings admins actually use (including "haloarens"). */
export function normalizeTopic(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HALO_TOPIC_VARIANTS = [
  "haloalkanes and haloarenes",
  "haloalkanes and haloarens",
  "haloalkanes and halo arenes",
  "haloarenes and haloalkanes",
  "haloalkanes",
  "haloarenes",
  "haloarens",
];

/** Is this an availed chapter name for Haloalkanes & Haloarenes? */
export function isHaloChapterTopic(topic: string): boolean {
  const value = normalizeTopic(topic);
  return HALO_TOPIC_VARIANTS.some((variant) => value === variant || value.includes(variant));
}

type Ids = { csSubjectId: string; chemSubjectId: string; boardId: string };
type Plan = { services: ActiveServices | null; error: string | null };
type Room = { id: string; name: string } | null;

async function resolveIds(): Promise<Ids> {
  const [cs, chem, board] = await Promise.all([
    prisma.subject.findFirst({ where: { code: "CS" }, select: { id: true } }),
    prisma.subject.findFirst({ where: { code: "CHE" }, select: { id: true } }),
    prisma.board.findFirst({ where: { name: { equals: "CBSE", mode: "insensitive" } }, select: { id: true } }),
  ]);
  return {
    csSubjectId: cs?.id ?? CS_SUBJECT_ID,
    chemSubjectId: chem?.id ?? CHEM_SUBJECT_ID,
    boardId: board?.id ?? CBSE_BOARD_ID,
  };
}

async function loadPlan(userId: string): Promise<Plan> {
  const service = await requireActiveService(userId);
  if (!service.ok) return { services: null, error: service.reason };
  const services = await getActiveServices(userId);
  if (!services) return { services: null, error: "Your plan does not include 3D courses." };
  return { services, error: null };
}

async function studentRoom(userId: string): Promise<Room> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { classRoom: { select: { id: true, name: true } } },
  });
  return profile?.classRoom ?? null;
}

function isClass(room: Room, id: string, grade: number): boolean {
  return !!room && (room.id === id || new RegExp(`\\b${grade}\\b`).test(room.name));
}

/** Original Encoding gate — kept byte-for-byte equivalent in its decisions. */
function encodingError(plan: Plan, ids: Ids, room: Room): string | null {
  if (!plan.services) return plan.error!;
  const services = plan.services;
  if (!services.subjects.includes(ids.csSubjectId))
    return "3D courses are only for Computer Science students.";
  if (ids.boardId !== services.boardId)
    return "3D courses are available for CBSE Class 11 students only.";
  if (!isClass(room, CLASS_11_ID, 11))
    return "3D courses are available for CBSE Class 11 students only.";
  if (!assessmentTopicAllowed(services, "ASSIGNMENT", COURSE_CHAPTER, ids.csSubjectId))
    return "The Encoding Schemes chapter is not part of your plan.";
  return null;
}

/** New Haloalkanes gate: Class 12 CBSE Chemistry + the chapter itself. */
function haloError(plan: Plan, ids: Ids, room: Room): string | null {
  if (!plan.services) return plan.error!;
  const services = plan.services;
  if (!services.subjects.includes(ids.chemSubjectId))
    return "Haloalkanes & Haloarenes is for students who availed Class 12 CBSE Chemistry.";
  if (ids.boardId !== services.boardId)
    return "This course is available for Class 12 CBSE Chemistry students only.";
  if (!isClass(room, CLASS_12_ID, 12))
    return "This course is available for Class 12 CBSE Chemistry students only.";
  if (!services.wantAssignments)
    return "The Haloalkanes & Haloarenes chapter is not part of your plan.";
  const topics = services.subjectTopics[ids.chemSubjectId]?.assignment ?? services.assignmentTopics;
  // An empty list means the student subscribed to Chemistry broadly; that
  // includes this chapter, just as the Encoding gate treats a broad CS plan.
  if (topics.length > 0 && !topics.some(isHaloChapterTopic))
    return "The Haloalkanes & Haloarenes chapter is not part of your plan.";
  return null;
}

function buildChapters(plan: Plan, ids: Ids, encErr: string | null, haloErr: string | null): LearningChapter[] {
  const chapters: LearningChapter[] = [
    GOC_CHAPTER,
    haloErr ? { ...HALO_CHAPTER, lockedReason: haloErr } : { ...HALO_CHAPTER, available: true },
  ];

  if (encErr) {
    chapters.push({ ...ENCODING_CHAPTER, lockedReason: encErr });
    return chapters;
  }

  // The rest of the student's Computer Science catalogue. Available courses
  // are shown first; chapters whose 3D course is not built show as coming soon.
  const topics = plan.services!.subjectTopics[ids.csSubjectId]?.assignment
    ?? plan.services!.assignmentTopics
    ?? [];
  chapters.push({ ...ENCODING_CHAPTER, available: true });
  for (const topic of topics) {
    if (normalizeTopic(topic) === normalizeTopic(COURSE_CHAPTER)) continue;
    chapters.push({
      id: topic,
      name: titleCase(topic),
      available: false,
      kind: "topic",
      description: "This chapter is in your plan. Its 3D course is being built — check back soon.",
    });
  }
  return chapters;
}

type Evaluation = Awaited<ReturnType<typeof evaluate>>;

async function evaluate(userId: string) {
  const [plan, room, ids] = await Promise.all([loadPlan(userId), studentRoom(userId), resolveIds()]);
  const encErr = encodingError(plan, ids, room);
  const haloErr = haloError(plan, ids, room);
  return { plan, room, ids, encErr, haloErr, chapters: buildChapters(plan, ids, encErr, haloErr) };
}

/**
 * The free catalogue. Never fails: even a student with no subscription sees
 * GOC, with every other course clearly marked as locked and why.
 */
export async function getLearningCatalogue(userId: string): Promise<LearningCatalogue> {
  const e: Evaluation = await evaluate(userId);
  return { chapters: e.chapters, eligible: !e.encErr || !e.haloErr };
}

/** Kept for the original Encoding callers and tests. */
export async function getLearningAccess(userId: string): Promise<LearningAccess> {
  const e: Evaluation = await evaluate(userId);
  if (e.encErr) return { ok: false, status: 403, error: e.encErr };
  return { ok: true, csSubjectId: e.ids.csSubjectId, chapters: e.chapters };
}

function okCourse(courseId: string, title: string, tagline: string, chapter: string, count: number, chapters: LearningChapter[]): LearningCourseResult {
  return { ok: true, courseId, title, tagline, chapter, conceptCount: count, chapters };
}

/** Resolve one playable course with its own gate. */
export async function getLearningCourse(userId: string, courseId: string): Promise<LearningCourseResult> {
  const e: Evaluation = await evaluate(userId);

  // Free for every signed-in student — no plan, subject, board or class check.
  if (courseId === GOC_COURSE_ID)
    return okCourse(GOC_COURSE_ID, GOC_COURSE_TITLE, "Free for every student", "General Organic Chemistry", GOC_CONCEPTS.length, e.chapters);

  if (courseId === HALO_COURSE_ID) {
    if (e.haloErr) return { ok: false, status: 403, error: e.haloErr };
    return okCourse(HALO_COURSE_ID, HALO_COURSE_TITLE, "Class 12 CBSE Chemistry + JEE", "Haloalkanes and Haloarenes", HALO_CONCEPTS.length, e.chapters);
  }

  if (courseId === COURSE_ID) {
    if (e.encErr) return { ok: false, status: 403, error: e.encErr };
    return okCourse(COURSE_ID, COURSE_TITLE, "See bits become numbers, letters and colour.", COURSE_CHAPTER, CONCEPTS.length, e.chapters);
  }

  return { ok: false, status: 404, error: "Course not found." };
}
