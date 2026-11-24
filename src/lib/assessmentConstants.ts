import type { AssessmentKind, AssessmentStatus } from "@/generated/prisma/enums";

export const KINDS: AssessmentKind[] = ["ASSIGNMENT", "MOCK", "TEST"];
export const STATUSES: AssessmentStatus[] = ["DRAFT", "SCHEDULED", "RELEASED", "ACTIVE", "CLOSED", "EVALUATED", "RELEASED_TO_STUDENTS"];
export const TYPE_CHOICES = ["MCQ", "SHORT", "LONG", "CODING", "SQL", "ORAL", "UPLOAD"] as const;

export function kindBadge(kind: AssessmentKind) {
  return kind === "ASSIGNMENT" ? "Assignment" : kind === "MOCK" ? "Mock" : "Test";
}

export function statusStyle(status: AssessmentStatus) {
  const S: Record<string, string> = {
    DRAFT: "bg-secondary text-muted-foreground",
    SCHEDULED: "bg-sky-500/15 text-sky-300",
    RELEASED: "bg-emerald-500/15 text-emerald-300",
    ACTIVE: "bg-amber-500/15 text-amber-300",
    CLOSED: "bg-rose-500/15 text-rose-300",
    EVALUATED: "bg-violet-500/15 text-violet-300",
    RELEASED_TO_STUDENTS: "bg-emerald-500/15 text-emerald-300",
  };
  return S[status] ?? "bg-secondary";
}