import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SERVICE_CODE_LENGTH, SERVICE_CODE_TTL_MS, SERVICE_PERIOD_MS } from "@/lib/constants";
import { logActivity } from "@/lib/log";
import { newLeouPayRef } from "@/lib/leouPay";
import type {
  AssessmentKind,
  LogType,
  OnboardingKind,
  OnboardingStatus,
  ServiceCodeStatus,
} from "@/generated/prisma/enums";

export type TutorPlan = "HOURLY" | "WEEKLY" | "MONTHLY";

export type OnboardingInput = {
  boardId: string;
  classRoomId: string;
  subjectIds: string[];
  wantAssignments: boolean;
  assignmentTopics: string;
  wantMockTests: boolean;
  mockTopics: string;
  wantRealTests: boolean;
  testTopics: string;
  sameTopicsForMockTests: boolean;
  // Chapters per subject, e.g. { "<subjectId>": { assignment: "Trigonometry, ...",
  // mock: "...", test: "..." } }. When present this is the authority for what
  // the student picked for each subject; the flat *_Topics fields above become
  // the fallback (for a subject with no per-subject entry) and the union that is
  // persisted into the legacy flat columns. Arrays are also accepted so a
  // running plan can be fed straight back in for add-on delta pricing.
  subjectTopics?: Record<string, { assignment?: string | string[]; mock?: string | string[]; test?: string | string[] }>;
  // Renewal only: the ids of the live ServiceActivation rows this renewal takes
  // over when the admin approves it. Empty means a whole-plan renewal.
  renewsActivationIds?: string[];
  wantTutoring: boolean;
  tutorSubjects: string[];
  tutorGoals: string;
  tutorPlan: TutorPlan | null;
  tutorHours: number | null;
};

type KindQuote = {
  configured: boolean;
  items: { name: string; rate: number }[];
  total: number;
  residual: string[];
};

type SubjectQuote = {
  subjectId: string;
  subjectName: string;
  batchId: string | null;
  batchName: string | null;
  assignment: KindQuote;
  mock: KindQuote;
  test: KindQuote;
  tutoring: {
    configured: boolean;
    plan: TutorPlan;
    hours: number | null;
    rate: number;
    total: number;
    residual: string[];
  } | null;
};

export type Quotation = {
  perSubject: SubjectQuote[];
  totals: { assignment: number; mock: number; test: number; tutoring: number; grand: number };
  warnings: string[];
};

export function parseTopics(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

/**
 * CBSE publishes some Class 12 chapters as one unit while the wizard collects
 * them as separate topics. Admins price the published chapter once, so a student
 * who picks "alcohols" and "phenols and ethers" would otherwise be told nobody
 * priced them even though "Alcohols, Phenols and Ethers" has a rate.
 *
 * These aliases are for *matching only* — the student's own selection is still
 * stored exactly as they typed it. Both split topics map to the one configured
 * item, and `selected` is keyed by item id, so the chapter is charged once.
 */
const CHAPTER_ALIASES: Record<string, string> = {
  "alcohols": "alcohols phenols and ethers",
  "phenols and ethers": "alcohols phenols and ethers",
  "alcohols and phenols": "alcohols phenols and ethers",
  "aldehydes": "aldehydes ketones and carboxylic acids",
  "ketones and carboxylic acids": "aldehydes ketones and carboxylic acids",
  "aldehydes and ketones": "aldehydes ketones and carboxylic acids",
};

/** Normalised key shared by pricing lookup and the unpriced-chapter guard. */
export function canonicalTopicName(value: string): string {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return CHAPTER_ALIASES[key] ?? key;
}

/** Chapters a student picked for each subject: the entitlement authority.
 * Without per-subject input the legacy flat lists still apply to every selected
 * subject, which reproduces exactly what the old model did. */
export type SubjectTopicsMap = Record<string, { assignment: string[]; mock: string[]; test: string[] }>;

export function normalizeSubjectTopics(input: OnboardingInput): SubjectTopicsMap {
  const map: SubjectTopicsMap = {};
  if (!input.subjectTopics) {
    const assignment = parseTopics(input.assignmentTopics);
    const mock = parseTopics(input.sameTopicsForMockTests ? input.assignmentTopics : input.mockTopics);
    const test = parseTopics(input.sameTopicsForMockTests ? input.assignmentTopics : input.testTopics);
    for (const sid of input.subjectIds) map[sid] = { assignment, mock, test };
    return map;
  }
  for (const sid of input.subjectIds) {
    const entry = input.subjectTopics[sid];
    const baseAssignment = topicList(entry?.assignment ?? input.assignmentTopics);
    map[sid] = {
      assignment: baseAssignment,
      mock: topicList(
        input.sameTopicsForMockTests ? entry?.assignment ?? input.assignmentTopics : entry?.mock ?? input.mockTopics
      ),
      test: topicList(
        input.sameTopicsForMockTests ? entry?.assignment ?? input.assignmentTopics : entry?.test ?? input.testTopics
      ),
    };
  }
  return map;
}

/** Union of every subject's chapters, for the legacy flat columns that pricing,
 * the admin screens and fee records still read. */
export function unionFlatTopics(map: SubjectTopicsMap): { assignment: string; mock: string; test: string } {
  const assignment = new Set<string>();
  const mock = new Set<string>();
  const test = new Set<string>();
  for (const v of Object.values(map)) {
    for (const t of v.assignment) assignment.add(t);
    for (const t of v.mock) mock.add(t);
    for (const t of v.test) test.add(t);
  }
  const join = (s: Set<string>) => Array.from(s).join(", ");
  return { assignment: join(assignment), mock: join(mock), test: join(test) };
}

/** When per-subject chapters are supplied, keep them as the authority but
 * refresh the flat fields to the union so validation and legacy readers see
 * the whole selection. Idempotent: a flat-only input passes through. */
export function normalizeOnboardingInput(input: OnboardingInput): OnboardingInput {
  if (!input.subjectTopics) return input;
  const flat = unionFlatTopics(normalizeSubjectTopics(input));
  return { ...input, assignmentTopics: flat.assignment, mockTopics: flat.mock, testTopics: flat.test };
}

async function resolveBatchForSubject(classRoomId: string, subjectId: string) {
  const batches = await prisma.batch.findMany({
    where: { classRoomId, isActive: true, subjects: { some: { subjectId } } },
    orderBy: { createdAt: "asc" },
    include: {
      pricingItems: { where: { subjectId }, select: { id: true }, take: 1 },
      tutoringRates: { where: { subjectId }, select: { id: true }, take: 1 },
    },
  });
  if (!batches.length) return null;
  const withConfig = batches.filter((b) => b.pricingItems.length || b.tutoringRates.length);
  return withConfig[0] ?? batches[0];
}

/** Admin-configured chapters/topics + tuition rates for a class's subject.
 * Uses the same batch resolution as computeQuotation so the wizard shows
 * exactly what will be billed. */
export async function getSubjectPricing(classRoomId: string, subjectId: string) {
  const batch = await resolveBatchForSubject(classRoomId, subjectId);
  if (!batch) return { batchId: null as string | null, batchName: null as string | null, topics: [], tutoring: null as TutoringRateInfo | null };
  const [topics, tutoring] = await Promise.all([
    prisma.subjectPricingItem.findMany({ where: { batchId: batch.id, subjectId }, orderBy: { name: "asc" } }),
    prisma.tutoringRate.findUnique({ where: { batchId_subjectId: { batchId: batch.id, subjectId } } }),
  ]);
  return {
    batchId: batch.id,
    batchName: batch.name,
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      assignmentRate: Number(t.assignmentRate),
      mockRate: Number(t.mockRate),
      testRate: Number(t.testRate),
    })),
    tutoring: tutoring
      ? {
          hourlyRate: tutoring.hourlyRate != null ? Number(tutoring.hourlyRate) : null,
          weeklyClasses: tutoring.weeklyClasses,
          weeklyRate: tutoring.weeklyRate != null ? Number(tutoring.weeklyRate) : null,
          monthlyDaysPerWeek: tutoring.monthlyDaysPerWeek,
          monthlyRate: tutoring.monthlyRate != null ? Number(tutoring.monthlyRate) : null,
        }
      : null,
  };
}

export type PricedTopic = { id: string; name: string; assignmentRate: number; mockRate: number; testRate: number };
export type TutoringRateInfo = {
  hourlyRate: number | null;
  weeklyClasses: number | null;
  weeklyRate: number | null;
  monthlyDaysPerWeek: number | null;
  monthlyRate: number | null;
} | null;

async function buildKindQuote(batchId: string | null, subjectId: string, topics: string[]): Promise<KindQuote> {
  if (!batchId || topics.length === 0) {
    return { configured: false, items: [], total: 0, residual: topics };
  }
  const items = await prisma.subjectPricingItem.findMany({
    where: { batchId, subjectId },
    orderBy: { name: "asc" },
  });
  // Topics are free text typed by a student, so "computer system" and
  // "Computer System" have to land on the same pricing item. Matching on the raw
  // token silently priced real chapters at zero, which then looked like a
  // free service rather than a pricing miss.
  const byName = new Map(items.map((i) => [canonicalTopicName(i.name), i]));
  const selected = new Map<string, { name: string; rate: number }>();
  const residual: string[] = [];
  for (const token of topics) {
    const key = canonicalTopicName(token);
    if (!key) continue;
    const item = byName.get(key);
    if (item) selected.set(item.id, { name: item.name, rate: Number(item.assignmentRate) });
    else residual.push(token.trim());
  }
  const matched = selected.size > 0;
  return {
    configured: matched,
    items: Array.from(selected.values()),
    total: Array.from(selected.values()).reduce((s, i) => s + i.rate, 0),
    residual,
  };
}

async function buildMockTestQuote(batchId: string | null, subjectId: string, topics: string[], rateField: "mockRate" | "testRate") {
  if (!batchId || topics.length === 0) {
    return { configured: false, items: [], total: 0, residual: topics };
  }
  const items = await prisma.subjectPricingItem.findMany({
    where: { batchId, subjectId },
    orderBy: { name: "asc" },
  });
  const byName = new Map(items.map((i) => [canonicalTopicName(i.name), i]));
  const selected = new Map<string, { name: string; rate: number }>();
  const residual: string[] = [];
  for (const token of topics) {
    const key = canonicalTopicName(token);
    if (!key) continue;
    const item = byName.get(key);
    if (item) selected.set(item.id, { name: item.name, rate: Number(item[rateField]) });
    else residual.push(token.trim());
  }
  const matched = selected.size > 0;
  return {
    configured: matched,
    items: Array.from(selected.values()),
    total: Array.from(selected.values()).reduce((s, i) => s + i.rate, 0),
    residual,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function computeQuotation(input: OnboardingInput): Promise<Quotation> {
  const classRoom = await prisma.classRoom.findUnique({
    where: { id: input.classRoomId },
    include: { subjects: { include: { subject: true } } },
  });
  const warnings: string[] = [];
  const perSubject: SubjectQuote[] = [];
  let totals = { assignment: 0, mock: 0, test: 0, tutoring: 0, grand: 0 };

  // Per-subject chapters (falling back to the flat lists) so the bill is the
  // exact chapters the student tagged for each subject - previously a flat list
  // was applied to every subject, silently charging for chapters they never
  // intended in the other subjects.
  const bySubject = normalizeSubjectTopics(input);

  for (const subjectId of input.subjectIds) {
    const subjectClass = classRoom?.subjects.find((s) => s.subjectId === subjectId);
    const subjectName = subjectClass?.subject.name ?? "Unknown";
    const batch = await resolveBatchForSubject(input.classRoomId, subjectId);
    if (!batch) warnings.push(`No active batch configured for ${subjectName}.`);

    const chosen = bySubject[subjectId] ?? { assignment: [], mock: [], test: [] };
    const assignmentTopics = chosen.assignment;
    const mockTopics = chosen.mock;
    const testTopics = chosen.test;

    const assignment = input.wantAssignments
      ? await buildKindQuote(batch?.id ?? null, subjectId, assignmentTopics)
      : { configured: false, items: [] as { name: string; rate: number }[], total: 0, residual: [] as string[] };
    const mock = input.wantMockTests
      ? await buildMockTestQuote(batch?.id ?? null, subjectId, mockTopics, "mockRate")
      : { configured: false, items: [] as { name: string; rate: number }[], total: 0, residual: [] as string[] };
    const test = input.wantRealTests
      ? await buildMockTestQuote(batch?.id ?? null, subjectId, testTopics, "testRate")
      : { configured: false, items: [] as { name: string; rate: number }[], total: 0, residual: [] as string[] };

    let tutoringQuote: SubjectQuote["tutoring"] = null;
    if (input.wantTutoring && input.tutorSubjects.includes(subjectId)) {
      const plan = input.tutorPlan ?? "MONTHLY";
      const rate = batch
        ? await prisma.tutoringRate.findUnique({ where: { batchId_subjectId: { batchId: batch.id, subjectId } } })
        : null;
      const hours = plan === "HOURLY" ? input.tutorHours ?? 1 : null;
      const unit = rate?.[plan === "HOURLY" ? "hourlyRate" : plan === "WEEKLY" ? "weeklyRate" : "monthlyRate"];
      const total = unit != null ? Number(unit) * (plan === "HOURLY" ? (hours ?? 1) : 1) : 0;
      if (unit == null) warnings.push(`Tutoring rate for ${subjectName} not configured by admin.`);
      tutoringQuote = {
        configured: unit != null,
        plan,
        hours,
        rate: unit != null ? Number(unit) : 0,
        total,
        residual: unit == null ? ["rate not configured"] : [],
      };
    }

    for (const warnLabel of ["assignment", "mock", "test"] as const) {
      const kind = warnLabel === "assignment" ? assignment : warnLabel === "mock" ? mock : test;
      if (kind.residual.length)
        warnings.push(`${subjectName} ${warnLabel}: no admin rate for ${kind.residual.map((t) => `“${t}”`).join(", ")} — excluded from total.`);
    }

    totals = {
      assignment: totals.assignment + assignment.total,
      mock: totals.mock + mock.total,
      test: totals.test + test.total,
      tutoring: totals.tutoring + (tutoringQuote?.total ?? 0),
      grand: 0,
    };
    perSubject.push({
      subjectId,
      subjectName,
      batchId: batch?.id ?? null,
      batchName: batch?.name ?? null,
      assignment,
      mock,
      test,
      tutoring: tutoringQuote,
    });
  }
  totals.grand = totals.assignment + totals.mock + totals.test + totals.tutoring;
  return { perSubject, totals, warnings };
}

function toServiceCode(): string {
  let code = "";
  while (code.length < SERVICE_CODE_LENGTH) {
    code += crypto.randomInt(0, 1_000_000_000).toString();
  }
  return code.slice(0, SERVICE_CODE_LENGTH);
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Attempt guard: admin-created students are never gated; self-registered
 * students may only attempt while an activation is live. */
export async function requireActiveService(userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const state = await getServiceState(userId);
  if (!state) return { ok: false, reason: "Student account not found." };
  if (!state.onboardingRequired) return { ok: true };
  if (!state.active)
    return {
      ok: false,
      reason: state.harderRedirect
        ? "Your services are locked. Complete your onboarding first."
        : "Your service period has ended. Renew your plan to continue.",
    };
  return { ok: true };
}

export async function getServiceState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true },
  });
  if (!user || user.role !== "STUDENT") return null;

  const activation = await prisma.serviceActivation.findFirst({
    where: { userId },
    // A student may hold an add-on whose own month outlasts the primary's, so
    // "active" and the expiry shown are the farthest of the live windows, not
    // whichever one was created most recently.
    orderBy: { expiresAt: "desc" },
  });
  const activationCount = await prisma.serviceActivation.count({ where: { userId } });
  const latestRequest = await prisma.onboardingRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const active = !!activation && activation.expiresAt.getTime() > Date.now();

  return {
    onboardingRequired: user.onboardingRequired,
    active,
    activatedAt: activation?.activatedAt.toISOString() ?? null,
    expiresAt: activation?.expiresAt.toISOString() ?? null,
    harderRedirect: user.onboardingRequired && activationCount === 0,
    softLock: !active && activationCount > 0,
    profile: user.studentProfile
      ? { classRoomId: user.studentProfile.classRoomId, fullName: user.studentProfile.fullName }
      : null,
    latestRequest: latestRequest
      ? {
          id: latestRequest.id,
          status: latestRequest.status as OnboardingStatus,
          amount: latestRequest.amount != null ? Number(latestRequest.amount) : null,
          requestedAt: latestRequest.createdAt.toISOString(),
          // Whether the quotation is payment-locked: while true the request is
          // immutable on the server, so the UI must not offer editing.
          locked: latestRequest.lockedAt != null,
        }
      : null,
  };
}

function topicList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (typeof value === "string") return parseTopics(value);
  return [];
}

function storedSubjectTopics(r: {
  subjects: unknown;
  assignmentTopics: string;
  mockTopics: string;
  testTopics: string;
  sameTopicsForMockTests: boolean;
  subjectTopics: unknown;
}): SubjectTopicsMap {
  const raw = r.subjectTopics as Record<string, { assignment?: unknown; mock?: unknown; test?: unknown }> | null;
  if (raw && Object.keys(raw).length > 0) {
    const map: SubjectTopicsMap = {};
    for (const [sid, v] of Object.entries(raw)) {
      map[sid] = {
        assignment: topicList(v?.assignment),
        mock: topicList(v?.mock),
        test: topicList(v?.test),
      };
    }
    return map;
  }
  // Historical requests predate the per-subject column; mirror the backfill by
  // giving every selected subject the flat lists (mock/test already resolved
  // against sameTopicsForMockTests).
  const assignment = parseTopics(r.assignmentTopics);
  const mock = parseTopics(r.sameTopicsForMockTests ? r.assignmentTopics : r.mockTopics);
  const test = parseTopics(r.sameTopicsForMockTests ? r.assignmentTopics : r.testTopics);
  const map: SubjectTopicsMap = {};
  for (const sid of (r.subjects as unknown as string[]) ?? []) map[sid] = { assignment, mock, test };
  return map;
}

export async function getActiveServices(userId: string) {
  const state = await getServiceState(userId);
  if (!state || !state.active) return null;

  // A subscription is exactly the union of every live activation's request.
  //
  // Older code treated the newest RENEWAL as a reset point and silently dropped
  // anything before it; that was only safe because every request was one whole
  // plan. With per-subscription add-ons and subset renewals the plan is the
  // union instead: approving a renewal ends the old activation it takes over
  // (decidePayment), so nothing it removed is resurrected, and an add-on whose
  // own month outlasts the primary's keeps working on its own.
  const live = await prisma.onboardingRequest.findMany({
    where: { userId, activations: { some: { expiresAt: { gt: new Date() } } } },
    orderBy: { createdAt: "asc" },
  });
  if (live.length === 0) return null;

  const subjects = new Set<string>();
  const subjectTopics: SubjectTopicsMap = {};
  const assignmentTopics = new Set<string>();
  const mockTopics = new Set<string>();
  const testTopics = new Set<string>();
  let wantAssignments = false;
  let wantMockTests = false;
  let wantRealTests = false;
  let wantTutoring = false;

  for (const r of live) {
    for (const id of (r.subjects as unknown as string[]) ?? []) subjects.add(id);
    const map = storedSubjectTopics(r);
    for (const [sid, v] of Object.entries(map)) {
      const cur = subjectTopics[sid] ?? { assignment: [], mock: [], test: [] };
      subjectTopics[sid] = {
        assignment: Array.from(new Set([...cur.assignment, ...v.assignment])),
        mock: Array.from(new Set([...cur.mock, ...v.mock])),
        test: Array.from(new Set([...cur.test, ...v.test])),
      };
    }
    wantAssignments ||= r.wantAssignments;
    wantMockTests ||= r.wantMockTests;
    wantRealTests ||= r.wantRealTests;
    wantTutoring ||= r.wantTutoring;
  }

  // The flat lists stay in the payload for the consumers that still read them;
  // they are the union across every live request.
  const flat = unionFlatTopics(subjectTopics);
  for (const t of parseTopics(flat.assignment)) assignmentTopics.add(t);
  for (const t of parseTopics(flat.mock)) mockTopics.add(t);
  for (const t of parseTopics(flat.test)) testTopics.add(t);

  // The class and board the running plan was bought for. The top-up wizard
  // starts on its "pick board and class" step, so without these it cannot show
  // the current selection - the student would have to re-pick the class, and
  // that wipes the plan-derived subject prefill, leaving already-availed
  // subjects locked but unticked (unselectable) with no chapter editor.
  const planClass = live[0]?.classRoomId ?? null;
  const planBoard = live[0]?.boardId ?? null;

  return {
    wantAssignments,
    wantMockTests,
    wantRealTests,
    wantTutoring,
    subjects: [...subjects],
    assignmentTopics: [...assignmentTopics],
    mockTopics: [...mockTopics],
    testTopics: [...testTopics],
    subjectTopics,
    classRoomId: planClass,
    boardId: planBoard,
    expiresAt: state.expiresAt,
  };
}

export type ActiveServices = NonNullable<Awaited<ReturnType<typeof getActiveServices>>>;

/** Does an assessment belong to this student's current plan?
 *
 * Admin-created students without an active plan see everything (services ===
 * null). Subscribed students are filtered by service kind; then, when we know
 * which subject the assessment belongs to, they must have that subject in their
 * plan (otherwise a chapter that merely shares a name across subjects leaks the
 * other subject's work in), and when the assessment targets a chapter they must
 * have selected it for that subject. Without a subject we fall back to the flat
 * union, which is only ever used by code that has not joined the subject. */
export function assessmentTopicAllowed(
  services: ActiveServices | null,
  kind: AssessmentKind,
  topic: string | null,
  subjectId: string | null
): boolean {
  if (!services) return true;
  const entry = ((): { want: boolean; key: "assignment" | "mock" | "test"; topics: string[] } => {
    if (kind === "ASSIGNMENT") return { want: services.wantAssignments, key: "assignment", topics: services.assignmentTopics };
    if (kind === "MOCK") return { want: services.wantMockTests, key: "mock", topics: services.mockTopics };
    return { want: services.wantRealTests, key: "test", topics: services.testTopics };
  })();
  if (!entry.want) return false;

  if (subjectId) {
    // The subject must be part of the plan at all - the whole point of
    // per-subject selections is that another subject's chapter of the same name
    // does not count as this subject's.
    if (!services.subjects.includes(subjectId)) return false;
  }

  if (!topic) return true; // subject-wide assessment → subscribed to the subject+kind

  const perSubject = subjectId ? services.subjectTopics?.[subjectId] : undefined;
  const list = perSubject ? perSubject[entry.key] : entry.topics;
  if (list.length === 0) return true; // subscribed to the subject broadly, not by chapter
  return list.some((t) => t === topic.trim().toLowerCase());
}

/** Everything that must be true before a request is worth persisting. Split out
 * so a top-up can be priced and rejected before it touches the database. */
async function validateOnboardingInput(userId: string, input: OnboardingInput) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { studentProfile: true } });
  if (!user || user.role !== "STUDENT") return { ok: false as const, error: "Student account not found." };
  if (!user.studentProfile) return { ok: false as const, error: "Student profile not found." };

  const classRoom = await prisma.classRoom.findUnique({
    where: { id: input.classRoomId },
    include: { subjects: true },
  });
  if (!classRoom || !classRoom.isActive) return { ok: false as const, error: "Selected class is not available." };

  const board = await prisma.board.findUnique({ where: { id: input.boardId } });
  if (!board || !board.isActive) return { ok: false as const, error: "Selected board is not available." };

  const validSubjects = input.subjectIds.filter((sid) => classRoom.subjects.some((s) => s.subjectId === sid));
  if (validSubjects.length !== input.subjectIds.length || validSubjects.length === 0)
    return { ok: false as const, error: "One or more subjects are not offered for this class." };

  const wants = [input.wantAssignments, input.wantMockTests, input.wantRealTests, input.wantTutoring];
  if (!wants.some(Boolean)) return { ok: false as const, error: "Select at least one service." };
  if (input.wantAssignments && !input.assignmentTopics.trim())
    return { ok: false as const, error: "List the chapters / topics for assignments." };
  if (input.wantMockTests && !input.sameTopicsForMockTests && !input.mockTopics.trim())
    return { ok: false as const, error: "List the chapters / topics for mock tests." };
  if (input.wantRealTests && !input.sameTopicsForMockTests && !input.testTopics.trim())
    return { ok: false as const, error: "List the chapters / topics for real tests." };
  if (input.wantTutoring) {
    if (!input.tutorSubjects.length) return { ok: false as const, error: "Select the subjects to learn from a teacher." };
    if (!input.tutorGoals.trim()) return { ok: false as const, error: "Tell us what you want to learn." };
    if (!input.tutorPlan) return { ok: false as const, error: "Choose a billing plan for tutoring." };
    if (input.tutorPlan === "HOURLY" && (!input.tutorHours || input.tutorHours < 1))
      return { ok: false as const, error: "Enter the number of tutoring hours." };
  }

  return { ok: true as const };
}

export async function createOrUpdateOnboardingRequest(
  userId: string,
  input: OnboardingInput,
  opts?: { reuseKind?: OnboardingKind; requestId?: string }
) {
  // Per-subject chapters are the authority; the flat fields become the union so
  // validation and legacy readers describe the whole selection.
  const effective = normalizeOnboardingInput(input);
  const valid = await validateOnboardingInput(userId, effective);
  if (!valid.ok) return valid;

  const quotation = await computeQuotation(effective);

  // The request being (re)written. Either an exact id, when the student came
  // back to edit a specific quotation, or the newest pending request of the same
  // kind, which is the old behaviour - same-kind overwrite is safe, cross-kind
  // overwrite is not (starting a renewal must not eat an unpaid top-up).
  const previous = opts?.requestId
    ? await prisma.onboardingRequest.findFirst({ where: { id: opts.requestId, userId } })
    : await prisma.onboardingRequest.findFirst({
        where: {
          userId,
          status: "REQUESTED" as OnboardingStatus,
          ...(opts?.reuseKind ? { kind: opts.reuseKind } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

  if (opts?.requestId && !previous)
    return { ok: false as const, error: "That quotation was not found." };
  if (previous && previous.status !== "REQUESTED" && !opts?.requestId)
    return { ok: false as const, error: "That request has already been processed." };
  // The payment lock. Once a student has locked the quotation (or started a
  // payment attempt against a reference) the amount and selection are frozen:
  // changing them after money has moved would let a student quietly alter what
  // the admin actually approved. Clearing happens only when the attempt is
  // resolved - approval activates it, rejection explicitly invites an edit.
  if (previous?.lockedAt) {
    return {
      ok: false as const,
      error:
        "This quotation is locked because payment has started for it. If the admin rejected the payment, check the payment page and then edit your choices.",
    };
  }

  const bySubject = normalizeSubjectTopics(effective);
  const data = {
    boardId: effective.boardId,
    classRoomId: effective.classRoomId,
    subjects: effective.subjectIds,
    wantAssignments: effective.wantAssignments,
    assignmentTopics: effective.assignmentTopics.trim(),
    wantMockTests: effective.wantMockTests,
    mockTopics: effective.mockTopics.trim(),
    wantRealTests: effective.wantRealTests,
    testTopics: effective.testTopics.trim(),
    sameTopicsForMockTests: effective.sameTopicsForMockTests,
    subjectTopics: bySubject,
    wantTutoring: effective.wantTutoring,
    tutorSubjects: effective.wantTutoring ? effective.tutorSubjects : [],
    tutorGoals: effective.wantTutoring ? effective.tutorGoals.trim() : "",
    tutorPlan: effective.wantTutoring ? (effective.tutorPlan as string) : null,
    tutorHours: effective.tutorPlan === "HOURLY" ? effective.tutorHours : null,
    amount: quotation.totals.grand,
    breakdown: quotation,
  };

  // Minted with the quotation, not at payment time, so the student can be shown a
  // reference before any money moves. A re-save keeps the original one: if the
  // student has already paid and is correcting their selection, handing them a
  // second reference would break the match with the bank entry.
  const leouPayRef = previous?.leouPayRef || newLeouPayRef();

  const request = previous
    ? await prisma.onboardingRequest.update({ where: { id: previous.id }, data })
    : await prisma.onboardingRequest.create({ data: { userId, leouPayRef, ...data } });
  if (previous && !previous.leouPayRef) {
    await prisma.onboardingRequest.update({ where: { id: previous.id }, data: { leouPayRef } });
  }

  // Any student who requests services opts in to the onboarding lock,
  // even if the account was created by the admin before this feature ran.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingRequired: true },
  });
  if (user && !user.onboardingRequired)
    await prisma.user.update({ where: { id: userId }, data: { onboardingRequired: true } });

  await logActivity({
    userId,
    type: "ONBOARDING_REQUEST" as LogType,
    metadata: { requestId: request.id },
  });

  return { ok: true as const, request: { id: request.id }, quotation: toPlain(quotation) };
}

export async function issueServiceCode(studentUserId: string, adminUserId: string) {
  const latest = await prisma.onboardingRequest.findFirst({
    where: { userId: studentUserId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return { ok: false as const, error: "This student has not submitted any service request." };
  if (latest.status === "ACTIVATED" as OnboardingStatus)
    return { ok: false as const, error: "This student is already activated." };

  const request = await prisma.onboardingRequest.update({
    where: { id: latest.id },
    data: { status: "BILLED" as OnboardingStatus },
  });

  const codeRecord = await prisma.serviceCode.create({
    data: {
      userId: studentUserId,
      requestId: request.id,
      code: toServiceCode(),
      status: "ISSUED" as ServiceCodeStatus,
      expiresAt: new Date(Date.now() + SERVICE_CODE_TTL_MS),
      issuedBy: adminUserId,
    },
  });

  await logActivity({
    userId: studentUserId,
    type: "SERVICE_CODE_ISSUED" as LogType,
    metadata: { codeId: codeRecord.id, requestId: request.id },
  });

  return { ok: true as const, code: codeRecord.code, expiresAt: codeRecord.expiresAt.toISOString(), requestId: request.id };
}

export async function redeemServiceCode(studentUserId: string, code: string) {
  const active = await prisma.serviceActivation.findFirst({
    where: { userId: studentUserId, expiresAt: { gt: new Date() } },
  });
  if (active) return { ok: false as const, error: "Your services are already active." };

  const found = await prisma.serviceCode.findFirst({
    where: { userId: studentUserId, code, status: "ISSUED" as ServiceCodeStatus },
  });
  if (!found) return { ok: false as const, error: "Invalid payment code for this account." };
  if (found.expiresAt.getTime() < Date.now())
    return { ok: false as const, error: "This payment code has expired. Ask the admin for a fresh one." };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SERVICE_PERIOD_MS);

  await prisma.$transaction([
    prisma.serviceCode.update({ where: { id: found.id }, data: { status: "USED" as ServiceCodeStatus, usedAt: now } }),
    prisma.serviceActivation.create({
      data: { userId: studentUserId, requestId: found.requestId, codeId: found.id, activatedAt: now, expiresAt },
    }),
    ...(found.requestId
      ? [prisma.onboardingRequest.update({ where: { id: found.requestId }, data: { status: "ACTIVATED" as OnboardingStatus } })]
      : []),
  ]);

  await logActivity({
    userId: studentUserId,
    type: "SERVICE_CODE_REDEEMED" as LogType,
    metadata: { codeId: found.id, expiresAt: expiresAt.toISOString() },
  });

  return { ok: true as const, expiresAt: expiresAt.toISOString() };
}
type NewTopic = { subjectId: string; subjectName: string; kind: "assignment" | "mock" | "test"; topic: string };

const TOPIC_KINDS = ["assignment", "mock", "test"] as const;

/**
 * Chapters the incoming selection holds that the running plan does not, compared
 * token for token with the same normalisation pricing uses.
 *
 * This exists because money alone cannot answer "did this student pick
 * anything new?". A chapter with no admin rate - or a 0 rate for that kind -
 * contributes nothing, so an add-on made entirely of genuinely new chapters
 * still nets to a 0 delta. Pricing gives us the amount; this gives us the
 * intent, and intent is what decides whether a 0 delta means "you added
 * nothing" or "you added things nobody has priced yet". Only the kinds the
 * incoming plan actually subscribes to are considered.
 */
function newlyAddedTopics(
  currentTopics: SubjectTopicsMap,
  nextTopics: SubjectTopicsMap,
  next: OnboardingInput,
  nameOf: Map<string, string>
): NewTopic[] {
  const wants: Record<(typeof TOPIC_KINDS)[number], boolean> = {
    assignment: next.wantAssignments,
    mock: next.wantMockTests,
    test: next.wantRealTests,
  };
  const out: NewTopic[] = [];
  for (const sid of next.subjectIds) {
    for (const kind of TOPIC_KINDS) {
      if (!wants[kind]) continue;
      const have = new Set(currentTopics[sid]?.[kind] ?? []);
      for (const topic of nextTopics[sid]?.[kind] ?? []) {
        if (!have.has(topic)) out.push({ subjectId: sid, subjectName: nameOf.get(sid) ?? "This subject", kind, topic });
      }
    }
  }
  return out;
}

/**
 * The subset of `added` that the incoming quotation charges nothing for, either
 * because no admin rate matched (it lands in `residual`) or because the matched
 * rate for that kind is 0. Both mean the student selected a chapter and would
 * have received no service for it, so neither may pass silently.
 */
function unpricedOf(added: NewTopic[], quotation: Quotation): NewTopic[] {
  return added.filter((n) => {
    const subject = quotation.perSubject.find((p) => p.subjectId === n.subjectId);
    if (!subject) return true;
    const kind = subject[n.kind];
    const key = canonicalTopicName(n.topic);
    if (kind.residual.some((r) => canonicalTopicName(r) === key)) return true;
    const item = kind.items.find((i) => canonicalTopicName(i.name) === key);
    return !item || Number(item.rate) === 0;
  });
}

const describeNew = (list: NewTopic[]): string =>
  list
    .map((n) => `${n.subjectName} - ${n.topic} (${n.kind === "assignment" ? "assignments" : n.kind === "mock" ? "mock tests" : "real tests"})`)
    .join("; ");

/**
 * Adds services to a plan that is already running.
 *
 * The student picks a *whole* new selection (their current services plus the new
 * ones) because that is what they will hold from now on, but they are only
 * charged for the difference: the original request stays untouched and
 * untouched-priced, and this request records just the top-up. Billing the full
 * selection would quietly double-charge them for the base month.
 */
export async function createAdditionalServiceRequest(
  userId: string,
  input: OnboardingInput,
  opts?: { requestId?: string }
) {
  const active = await getActiveServices(userId);
  if (!active) return { ok: false as const, error: "You do not have an active service plan to add to." };

  const state = await getServiceState(userId);
  const previous = await prisma.onboardingRequest.findFirst({
    where: { userId, activations: { some: { expiresAt: { gt: new Date() } } } },
    orderBy: { createdAt: "desc" },
  });
  if (!previous) return { ok: false as const, error: "Your current service request was not found." };

  const boardId = input.boardId || previous.boardId;
  const classRoomId = input.classRoomId || previous.classRoomId;

  // Tutoring already on the plan is carried forward rather than demanded again.
  // The selection screens re-assert "yes, tutoring" from the current plan but
  // have no reason to make the student retype goals they gave last month, and
  // asking would make a top-up impossible for exactly those students.
  const effective: OnboardingInput = {
    ...input,
    boardId,
    classRoomId,
    wantTutoring: input.wantTutoring || active.wantTutoring,
    tutorSubjects: input.tutorSubjects.length > 0 ? input.tutorSubjects : (previous.tutorSubjects as unknown as string[]) ?? [],
    tutorGoals: input.tutorGoals.trim() || previous.tutorGoals,
    tutorPlan: input.tutorPlan ?? (previous.tutorPlan as TutorPlan | null),
    tutorHours: input.tutorHours ?? previous.tutorHours,
  };

  // Price the plan as it would be if bought whole, then take off what the
  // running plan already costs. Anything genuinely new is what remains.
  // The running plan is priced from its own per-subject chapters so subtracting
  // is exact; mock/test lists are already resolved per subject (sameTopics is
  // baked into the stored per-subject lists, so it is safe to turn it off).
  const currentInput: OnboardingInput = {
    boardId: previous.boardId,
    classRoomId: previous.classRoomId,
    subjectIds: active.subjects,
    wantAssignments: active.wantAssignments,
    assignmentTopics: active.assignmentTopics.join(", "),
    wantMockTests: active.wantMockTests,
    mockTopics: active.mockTopics.join(", "),
    wantRealTests: active.wantRealTests,
    testTopics: active.testTopics.join(", "),
    sameTopicsForMockTests: false,
    subjectTopics: active.subjectTopics,
    wantTutoring: active.wantTutoring,
    tutorSubjects: (previous.tutorSubjects as unknown as string[]) ?? [],
    tutorGoals: previous.tutorGoals,
    tutorPlan: previous.tutorPlan as TutorPlan | null,
    tutorHours: previous.tutorHours ?? 0,
  };
  const currentQuotation = await computeQuotation(currentInput);

  // Priced before anything is written, so a top-up that adds nothing is refused
  // without ever creating a request. Creating first and deleting afterwards would
  // take a pending top-up - and the payment proof attached to it - with it.
  const effectiveNorm = normalizeOnboardingInput(effective);
  const valid = await validateOnboardingInput(userId, effectiveNorm);
  if (!valid.ok) return valid;
  const nextQuotation = await computeQuotation(effectiveNorm);

  const delta = {
    assignment: round2(nextQuotation.totals.assignment - currentQuotation.totals.assignment),
    mock: round2(nextQuotation.totals.mock - currentQuotation.totals.mock),
    test: round2(nextQuotation.totals.test - currentQuotation.totals.test),
    tutoring: round2(nextQuotation.totals.tutoring - currentQuotation.totals.tutoring),
    grand: round2(nextQuotation.totals.grand - currentQuotation.totals.grand),
  };

  // What the student actually added, and which of those additions carry no
  // price. Computed once, before the branch, because both the refusal below and
  // the success path need it: the delta alone cannot tell "you picked nothing
  // new" apart from "you picked new chapters that nobody has priced".
  const added = newlyAddedTopics(
    normalizeSubjectTopics(currentInput),
    normalizeSubjectTopics(effectiveNorm),
    effectiveNorm,
    new Map(
      (
        await prisma.subject.findMany({ where: { id: { in: effectiveNorm.subjectIds } }, select: { id: true, name: true } })
      ).map((s) => [s.id, s.name])
    )
  );
  const addedUnpriced = unpricedOf(added, nextQuotation);

  // A zero or negative delta has two completely different causes and the
  // student must never be told the wrong one.
  if (delta.grand <= 0) {
    if (added.length === 0) {
      return {
        ok: false as const,
        error: "Everything you selected is already part of your current plan.",
      };
    }

    // They did pick something new; it just costs nothing. Say what and why,
    // otherwise the old message told them their pick was already owned when in
    // fact it is simply unpriced.
    const blocked = addedUnpriced.length > 0 ? addedUnpriced : added;
    return {
      ok: false as const,
      error:
        addedUnpriced.length > 0
          ? `No price has been set for ${describeNew(blocked)}, so it cannot be added yet. Ask an admin to configure rates for these chapters first. Your current plan is unchanged and you have not been charged.`
          : "Your selection only repeats or reduces what you already have, so there is nothing to charge. Your current plan is unchanged and you have not been charged.",
      unpriced: blocked,
      warnings: nextQuotation.warnings,
    };
  }

  // The add-on succeeded, but a priced chapter can sit in the same selection as
  // one nobody has priced. Reporting those keeps the bill honest: the student
  // is only charged for what was actually chargeable, and is told plainly which
  // of their picks are not covered yet.
  const result = await createOrUpdateOnboardingRequest(userId, effectiveNorm, {
    reuseKind: "ADDITIONAL",
    requestId: opts?.requestId,
  });
  if (!result.ok) return result;

  const marked = await prisma.onboardingRequest.update({
    where: { id: result.request.id },
    data: {
      kind: "ADDITIONAL" as OnboardingKind,
      parentRequestId: previous.id,
      amount: delta.grand,
      breakdown: { ...result.quotation, totals: delta, currentTotal: currentQuotation.totals.grand },
    },
  });

  await logActivity({
    userId,
    type: "ONBOARDING_REQUEST" as LogType,
    metadata: {
      requestId: marked.id,
      kind: "ADDITIONAL",
      topUp: delta.grand,
      baseTotal: currentQuotation.totals.grand,
      addedChapters: added.length,
      unpricedChapters: addedUnpriced.length,
    },
  });

  return {
    ok: true as const,
    request: { id: marked.id },
    quotation: { ...result.quotation, totals: delta, currentTotal: currentQuotation.totals.grand },
    unpriced: addedUnpriced,
    expiresAt: state?.expiresAt ?? null,
  };
}

/**
 * Renews a subscription (or subscriptions) into the next month, with edits.
 *
 * The student may add or drop subjects, chapters, assessments and tutoring from
 * whatever they hold today. Unlike a top-up this is billed in full at the
 * admin's current rates - a new month is a new purchase, and the rates may well
 * have changed since last time. The previous request is left completely alone so
 * the month already paid for still shows correctly on the plan page until the
 * approval replaces it.
 *
 * A renewal may target a subset of the live subscriptions (one add-on, or the
 * primary, or several): renewsActivationIds names the live activation windows it
 * takes over. When it is empty the renewal takes over every live activation,
 * which is the old whole-plan behaviour.
 */
export async function createRenewalRequest(
  userId: string,
  input: OnboardingInput,
  opts?: { requestId?: string }
) {
  const previous = await prisma.onboardingRequest.findFirst({
    where: { userId, activations: { some: { expiresAt: { gt: new Date() } } } },
    orderBy: { createdAt: "desc" },
  });
  if (!previous)
    return { ok: false as const, error: "You need an active plan before you can renew it." };

  const state = await getServiceState(userId);
  const effective: OnboardingInput = {
    ...input,
    boardId: input.boardId || previous.boardId,
    classRoomId: input.classRoomId || previous.classRoomId,
    // Tutoring carries forward unless the student unticked it, so switching the
    // plan on costs nothing they did not ask for.
    wantTutoring: input.wantTutoring,
    tutorSubjects: input.tutorSubjects.length > 0 ? input.tutorSubjects : (previous.tutorSubjects as unknown as string[]) ?? [],
    tutorGoals: input.wantTutoring ? input.tutorGoals.trim() || previous.tutorGoals : "",
    tutorPlan: input.wantTutoring ? (input.tutorPlan ?? (previous.tutorPlan as TutorPlan | null)) : null,
    tutorHours: input.wantTutoring ? (input.tutorHours ?? previous.tutorHours) : null,
  };

  const effectiveNorm = normalizeOnboardingInput(effective);
  const valid = await validateOnboardingInput(userId, effectiveNorm);
  if (!valid.ok) return valid;

  const result = await createOrUpdateOnboardingRequest(userId, effectiveNorm, {
    reuseKind: "RENEWAL",
    requestId: opts?.requestId,
  });
  if (!result.ok) return result;

  // Which live subscription lines this renewal replaces once it is approved.
  // Explicit subset (the student chose cards) wins over the whole-plan default
  // of taking over every live window.
  const liveActivations = await prisma.serviceActivation.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  // The body is student-supplied and only ever trusted for activations this
  // student actually owns. Without the intersection a student could name another
  // student's activation id and, on approval, have this renewal end that
  // stranger's paid subscription (the approval update was unscoped). The default
  // when nothing valid is named stays "take over every live window of my own".
  const liveIds = new Set(liveActivations.map((a) => a.id));
  const requested = (effective.renewsActivationIds ?? []).filter((id) => liveIds.has(id));
  const renewsActivationIds = requested.length > 0 ? requested : liveActivations.map((a) => a.id);

  const marked = await prisma.onboardingRequest.update({
    where: { id: result.request.id },
    data: {
      kind: "RENEWAL" as OnboardingKind,
      parentRequestId: previous.id,
      renewsActivationIds,
    },
  });

  await logActivity({
    userId,
    type: "ONBOARDING_REQUEST" as LogType,
    metadata: {
      requestId: marked.id,
      kind: "RENEWAL",
      previousRequestId: previous.id,
      total: marked.amount,
      renewsActivationIds,
    },
  });

  return {
    ok: true as const,
    request: { id: marked.id },
    quotation: result.quotation,
    expiresAt: state?.expiresAt ?? null,
  };
}
