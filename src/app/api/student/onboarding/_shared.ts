import type { OnboardingInput, TutorPlan } from "@/services/onboardingService";

function asPlan(v: unknown): TutorPlan | null {
  return v === "HOURLY" || v === "WEEKLY" || v === "MONTHLY" ? v : null;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asTopicValue(v: unknown): string | string[] | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(String);
  return undefined;
}

export function parseSubjectTopics(body: Record<string, unknown>): OnboardingInput["subjectTopics"] {
  const raw = body.subjectTopics;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: NonNullable<OnboardingInput["subjectTopics"]> = {};
  for (const [sid, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    out[sid] = {
      assignment: asTopicValue(e.assignment),
      mock: asTopicValue(e.mock),
      test: asTopicValue(e.test),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Shared parse of the wizard's POST body for the initial/additional/renewal
 * endpoints. Per-subject chapters are optional for compatibility but become the
 * authority when present. */
export function parseOnboardingBody(body: Record<string, unknown>) {
  const input: OnboardingInput = {
    boardId: asStr(body.boardId),
    classRoomId: asStr(body.classRoomId),
    subjectIds: Array.isArray(body.subjectIds) ? body.subjectIds.map(String) : [],
    wantAssignments: body.wantAssignments === true,
    assignmentTopics: asStr(body.assignmentTopics),
    wantMockTests: body.wantMockTests === true,
    mockTopics: asStr(body.mockTopics),
    wantRealTests: body.wantRealTests === true,
    testTopics: asStr(body.testTopics),
    sameTopicsForMockTests: body.sameTopicsForMockTests === true,
    subjectTopics: parseSubjectTopics(body),
    renewsActivationIds: Array.isArray(body.renewsActivationIds) ? body.renewsActivationIds.map(String) : undefined,
    wantTutoring: body.wantTutoring === true,
    tutorSubjects: Array.isArray(body.tutorSubjects) ? body.tutorSubjects.map(String) : [],
    tutorGoals: asStr(body.tutorGoals),
    tutorPlan: asPlan(body.tutorPlan),
    tutorHours: typeof body.tutorHours === "number" && body.tutorHours > 0 ? body.tutorHours : null,
  };
  const requestId = typeof body.requestId === "string" && body.requestId ? body.requestId : undefined;
  return { input, requestId };
}