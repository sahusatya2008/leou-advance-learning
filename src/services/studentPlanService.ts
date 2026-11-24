import { prisma } from "@/lib/prisma";
import { parseTopics, type Quotation, type TutorPlan } from "./onboardingService";
import type { OnboardingStatus, ServiceCodeStatus, UserStatus } from "@/generated/prisma/enums";

/** Everything the student was given: the facilities on their plan, the
 * activation window, the quoted/paid amounts and their fee records. Powers both
 * the dashboard summary card and /dashboard/plan. */
export type StudentPlanSummary = {
  account: {
    fullName: string;
    status: UserStatus;
    onboardingRequired: boolean;
    classRoom: string;
    stream: string | null;
    schoolName: string;
    schoolStatus: string;
    schoolClassHistory: string | null;
  };
  active: boolean;
  activation: { activatedAt: string; expiresAt: string; daysLeft: number } | null;
  request: {
    id: string;
    status: OnboardingStatus;
    createdAt: string;
    amount: number | null;
    board: string | null;
    classRoom: string | null;
    subjects: string[];
    facilities: {
      assignments: boolean;
      mockTests: boolean;
      realTests: boolean;
      tutoring: boolean;
    };
    topics: { assignments: string[]; mockTests: string[]; realTests: string[] };
    tutoring: {
      subjects: string[];
      goals: string;
      plan: TutorPlan | null;
      hours: number | null;
    } | null;
    breakdown: Quotation | null;
  } | null;
  history: { id: string; status: OnboardingStatus; createdAt: string; amount: number | null }[];
  activations: { activatedAt: string; expiresAt: string; current: boolean }[];
  /** One card per live subscription window (a renewal with a subgroup of
   * subjects leaves several running at once, each with its own request). */
  subscriptions: {
    activationId: string;
    requestId: string;
    activatedAt: string;
    expiresAt: string;
    daysLeft: number;
    serviceLabels: string[];
    subjects: string[];
    perSubjectTopics: { subjectId: string; subjectName: string; assignments: string[]; mockTests: string[]; realTests: string[] }[];
    tutoringSubjects: string[];
    tutoringPlan: TutorPlan | null;
  }[];
  latestCode: { status: ServiceCodeStatus; expiresAt: string; usedAt: string | null } | null;
  payments: {
    total: number;
    paid: number;
    pending: number;
    records: { id: string; title: string; amount: number; dueDate: string; status: string }[];
  };
};

function isQuotation(value: unknown): value is Quotation {
  if (!value || typeof value !== "object") return false;
  const q = value as { perSubject?: unknown; totals?: { grand?: unknown } };
  return Array.isArray(q.perSubject) && typeof q.totals?.grand === "number";
}

type RequestShape = {
  id: string;
  subjects: unknown;
  wantAssignments: boolean;
  wantMockTests: boolean;
  wantRealTests: boolean;
  wantTutoring: boolean;
  assignmentTopics: unknown;
  mockTopics: unknown;
  testTopics: unknown;
  sameTopicsForMockTests: boolean;
  subjectTopics: unknown;
  tutorSubjects: unknown;
  tutorPlan: unknown;
  tutorHours: number | null;
};

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : [];

/** Per-subject chapter lists from a request's subjectTopics JSON (the
 * entitlement authority), with the request's flat lists as a fallback so older
 * rows keep rendering. */
function subjectTopicsOf(r: RequestShape): { [sid: string]: { assignment: string[]; mock: string[]; test: string[] } } {
  const raw = r.subjectTopics;
  const out: { [sid: string]: { assignment: string[]; mock: string[]; test: string[] } } = {};
  if (raw && typeof raw === "object") {
    for (const [sid, v] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
      out[sid] = {
        assignment: arr(v?.assignment),
        mock: arr(v?.mock),
        test: arr(v?.test),
      };
    }
    return out;
  }
for (const sid of arr(r.subjects)) {
      out[sid] = {
        assignment: arr(r.assignmentTopics),
        mock: arr(r.sameTopicsForMockTests ? r.assignmentTopics : r.mockTopics),
        test: arr(r.sameTopicsForMockTests ? r.assignmentTopics : r.testTopics),
      };
    }
    return out;
  }

export async function getStudentPlanSummary(userId: string): Promise<StudentPlanSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: { include: { classRoom: true } } },
  });
  if (!user || user.role !== "STUDENT") return null;

  const [requests, activations, code, payments, liveActivations] = await Promise.all([
    prisma.onboardingRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceActivation.findMany({
      where: { userId },
      orderBy: { activatedAt: "desc" },
    }),
    prisma.serviceCode.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.paymentRecord.findMany({
      where: { studentId: user.studentProfile?.id ?? "" },
      orderBy: { dueDate: "asc" },
    }),
    // Live windows with their generating request, to draw one card per running
    // subscription - a renewal of a subset leaves several alive side by side.
    prisma.serviceActivation.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { activatedAt: "desc" },
      include: {
        request: {
          select: {
            id: true,
            subjects: true,
            wantAssignments: true,
            wantMockTests: true,
            wantRealTests: true,
            wantTutoring: true,
            assignmentTopics: true,
            mockTopics: true,
            testTopics: true,
            sameTopicsForMockTests: true,
            subjectTopics: true,
            tutorSubjects: true,
            tutorPlan: true,
            tutorHours: true,
          },
        },
      },
    }),
  ]);

  const liveSubjectIds = Array.from(
    new Set(
      liveActivations.flatMap((a) =>
        a.request ? ((a.request.subjects as unknown as string[]) ?? [] as string[]) : []
      )
    )
  );
  const liveSubjects = liveSubjectIds.length
    ? await prisma.subject.findMany({ where: { id: { in: liveSubjectIds } }, select: { id: true, name: true } })
    : [];
  const subjectNameById = new Map(liveSubjects.map((s) => [s.id, s.name]));
  const serviceLabels = (r: RequestShape): string[] => {
    const labels: string[] = [];
    if (r.wantAssignments) labels.push("Assignments");
    if (r.wantMockTests) labels.push("Mock tests");
    if (r.wantRealTests) labels.push("Real tests");
    if (r.wantTutoring) labels.push("Tutoring");
    return labels;
  };

  const latest = requests[0] ?? null;
  const latestSubjectIds: string[] = latest ? ((latest.subjects as unknown as string[]) ?? []) : [];
  const [subjectNames, board, requestClass] = await Promise.all([
    latestSubjectIds.length
      ? prisma.subject.findMany({ where: { id: { in: latestSubjectIds } }, select: { name: true } })
      : Promise.resolve([]),
    latest?.boardId ? prisma.board.findUnique({ where: { id: latest.boardId }, select: { name: true } }) : Promise.resolve(null),
    latest?.classRoomId
      ? prisma.classRoom.findUnique({ where: { id: latest.classRoomId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  const now = Date.now();
  const live = activations.find((a) => a.expiresAt.getTime() > now) ?? null;
  const prof = user.studentProfile;

  const paymentRecords = payments.map((p) => ({
    id: p.id,
    title: p.title,
    amount: Number(p.amount),
    dueDate: p.dueDate.toISOString(),
    status: p.status as string,
  }));

  return {
    account: {
      fullName: prof?.fullName ?? user.username,
      status: user.status,
      onboardingRequired: user.onboardingRequired,
      classRoom: prof?.classRoom.name ?? "—",
      stream: prof?.stream ?? null,
      schoolName: prof?.schoolName ?? "—",
      schoolStatus: prof?.schoolStatus ?? "CURRENT",
      schoolClassHistory: prof?.schoolClassHistory ?? null,
    },
    active: !!live,
    activation: live
      ? {
          activatedAt: live.activatedAt.toISOString(),
          expiresAt: live.expiresAt.toISOString(),
          daysLeft: Math.max(0, Math.ceil((live.expiresAt.getTime() - now) / 86_400_000)),
        }
      : null,
    request: latest
      ? {
          id: latest.id,
          status: latest.status,
          createdAt: latest.createdAt.toISOString(),
          amount: latest.amount != null ? Number(latest.amount) : null,
          board: board?.name ?? null,
          classRoom: requestClass?.name ?? null,
          subjects: subjectNames.map((s) => s.name),
          facilities: {
            assignments: latest.wantAssignments,
            mockTests: latest.wantMockTests,
            realTests: latest.wantRealTests,
            tutoring: latest.wantTutoring,
          },
          topics: {
            assignments: parseTopics(latest.assignmentTopics),
            mockTests: parseTopics(latest.sameTopicsForMockTests ? latest.assignmentTopics : latest.mockTopics),
            realTests: parseTopics(latest.sameTopicsForMockTests ? latest.assignmentTopics : latest.testTopics),
          },
          tutoring: latest.wantTutoring
            ? {
                subjects: (latest.tutorSubjects as unknown as string[]) ?? [],
                goals: latest.tutorGoals,
                plan: (latest.tutorPlan as TutorPlan | null) ?? null,
                hours: latest.tutorHours,
              }
            : null,
          breakdown: isQuotation(latest.breakdown) ? latest.breakdown : null,
        }
      : null,
    history: requests.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      amount: r.amount != null ? Number(r.amount) : null,
    })),
    activations: activations.map((a) => ({
      activatedAt: a.activatedAt.toISOString(),
      expiresAt: a.expiresAt.toISOString(),
      current: a.expiresAt.getTime() > now,
    })),
    subscriptions: liveActivations.map((a) => {
      const r = a.request;
      const topicsBySubject = r ? subjectTopicsOf(r) : {};
      const perSubjectTopics = Object.entries(topicsBySubject).map(([sid, t]) => ({
        subjectId: sid,
        subjectName: subjectNameById.get(sid) ?? sid,
        assignments: t.assignment,
        mockTests: t.mock,
        realTests: t.test,
      }));
      return {
        activationId: a.id,
        requestId: r?.id ?? a.requestId ?? "",
        activatedAt: a.activatedAt.toISOString(),
        expiresAt: a.expiresAt.toISOString(),
        daysLeft: Math.max(0, Math.ceil((a.expiresAt.getTime() - now) / 86_400_000)),
        serviceLabels: r ? serviceLabels(r) : [],
        subjects: perSubjectTopics.map((s) => s.subjectName),
        perSubjectTopics,
        tutoringSubjects: r ? arr(r.tutorSubjects) : [],
        tutoringPlan: r ? ((r.tutorPlan as TutorPlan | null) ?? null) : null,
      };
    }),
    latestCode: code
      ? { status: code.status, expiresAt: code.expiresAt.toISOString(), usedAt: code.usedAt?.toISOString() ?? null }
      : null,
    payments: {
      total: paymentRecords.reduce((s, p) => s + p.amount, 0),
      paid: paymentRecords.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0),
      pending: paymentRecords.filter((p) => p.status !== "PAID").reduce((s, p) => s + p.amount, 0),
      records: paymentRecords,
    },
  };
}
