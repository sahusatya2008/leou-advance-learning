import type { AssessmentKind } from "@/generated/prisma/enums";

/**
 * An assessment with `durationMinutes <= 0` is untimed: no countdown, no deadline,
 * and the student submits whenever they are ready. Assignments created for chapter
 * practice use this, because a self-study assignment has no natural expiry.
 *
 * This is the only place that decides what "untimed" means. The start route, the
 * submit route, the attempt page and the attempt UI all ask here, so a timed paper
 * can never accidentally be treated as untimed (or the other way round).
 */
export function isUntimed(durationMinutes: number | null | undefined): boolean {
  return !durationMinutes || durationMinutes <= 0;
}

/** The moment an attempt must be submitted by, or null when it is untimed. */
export function deadlineFrom(startedAt: Date, durationMinutes: number | null | undefined): Date | null {
  if (isUntimed(durationMinutes)) return null;
  return new Date(startedAt.getTime() + (durationMinutes as number) * 60_000);
}

/**
 * Assignments are never auto-closed for the student: when the clock runs out the
 * paper stays open until they press Submit. Timed tests submit themselves at the
 * deadline the way an exam hall would, and untimed papers have no deadline at all.
 */
export function shouldAutoSubmit(kind: AssessmentKind, remainingSeconds: number): boolean {
  if (kind === "ASSIGNMENT") return false;
  return remainingSeconds <= 0;
}

/** Human label for the time budget, used by the student and admin screens. */
export function durationLabel(durationMinutes: number | null | undefined): string {
  return isUntimed(durationMinutes) ? "No time limit" : `${durationMinutes} min`;
}
