import type { AssessmentAttemptMode } from "@/generated/prisma/enums";

export type AttemptCheck = {
  assessment: {
    attemptMode: AssessmentAttemptMode;
    maxAttempts: number | null;
    status: string;
    startsAt: Date | null;
    endsAt: Date | null;
  };
  submissions: { status: string; attemptNumber: number }[];
};

export type AttemptDecision =
  | { allow: true; resume: boolean; attemptNumber: number; reason?: never }
  | { allow: false; statusCode: 409; reason: string };

/**
 * Shared attempt policy for the start-route and the assessment page.
 *
 * SCHEDULED: single attempt, gated on the fixed window.
 * FLEXIBLE:  attempt any time (no window), up to maxAttempts (null = unlimited).
 * An IN_PROGRESS attempt is always resumed rather than re-created.
 */
export function decideAttempt(check: AttemptCheck): AttemptDecision {
  const now = new Date();
  const { assessment } = check;
  const flexible = assessment.attemptMode === "FLEXIBLE";

  if (!["RELEASED", "ACTIVE"].includes(assessment.status)) {
    return {
      allow: false,
      statusCode: 409,
      reason: flexible
        ? "This flexible assessment is no longer open."
        : "This assessment is not open for attempts.",
    };
  }

  if (!flexible) {
    if (assessment.startsAt && assessment.startsAt.getTime() > now.getTime())
      return { allow: false, statusCode: 409, reason: "This assessment has not opened yet." };
    if (assessment.endsAt && assessment.endsAt.getTime() < now.getTime())
      return { allow: false, statusCode: 409, reason: "The submission window has closed." };
  }

  const inProgress = check.submissions.find((s) => s.status === "IN_PROGRESS");
  if (inProgress) return { allow: true, resume: true, attemptNumber: inProgress.attemptNumber };

  const finishedCount = check.submissions.filter((s) => s.status !== "IN_PROGRESS").length;
  if (flexible) {
    const maxAtt = assessment.maxAttempts ?? Infinity;
    if (finishedCount >= maxAtt)
      return {
        allow: false,
        statusCode: 409,
        reason: `You have reached the maximum ${maxAtt} attempt${maxAtt === 1 ? "" : "s"} for this assessment.`,
      };
    return { allow: true, resume: false, attemptNumber: finishedCount + 1 };
  }

  // Scheduled assessments allow exactly one finished attempt.
  if (finishedCount >= 1)
    return {
      allow: false,
      statusCode: 409,
      reason: check.submissions.some((s) => s.status === "SUBMITTED")
        ? "Already submitted."
        : "This assessment allows a single attempt.",
    };
  return { allow: true, resume: false, attemptNumber: 1 };
}

/** Attempts remaining for a flexible assessment (for the attempt-intro copy). */
export function attemptsRemaining(assessment: { maxAttempts: number | null }, submissions: { status: string }[]): number | null {
  const finished = submissions.filter((s) => s.status !== "IN_PROGRESS").length;
  if (assessment.maxAttempts == null) return null; // unlimited
  return Math.max(0, assessment.maxAttempts - finished);
}