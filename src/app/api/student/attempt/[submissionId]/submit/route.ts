import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { deadlineFrom } from "@/lib/assessmentTime";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ submissionId: string }> };

/** An answer counts as "done by the student" when it carries real content. */
function hasAnswerContent(payload: unknown): boolean {
  if (payload == null) return false;
  if (Array.isArray(payload)) return payload.length > 0;
  if (typeof payload !== "object") return String(payload).trim().length > 0;
  const p = payload as {
    optionIds?: unknown[];
    text?: string;
    code?: string;
    query?: string;
    fileUrls?: string[];
  };
  if (Array.isArray(p.optionIds) && p.optionIds.length > 0) return true;
  if (typeof p.text === "string" && p.text.trim()) return true;
  if (typeof p.code === "string" && p.code.trim()) return true;
  if (typeof p.query === "string" && p.query.trim()) return true;
  if (Array.isArray(p.fileUrls) && p.fileUrls.length > 0) return true;
  return false;
}

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  const { submissionId } = await ctx.params;

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assessment: { select: { durationMinutes: true, startsAt: true, title: true } },
      answers: { select: { payload: true } },
    },
  });
  if (!submission || submission.studentId !== profId)
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  if (submission.status !== "IN_PROGRESS")
    return NextResponse.json({ error: "Submission is already closed." }, { status: 409 });

  // Work is only submitted for what the student actually did: an attempt with
  // no answered question can never be closed.
  const answered = submission.answers.filter((a) => hasAnswerContent(a.payload)).length;
  if (answered === 0) {
    return NextResponse.json(
      { error: "Nothing to submit yet — answer at least one question first." },
      { status: 400 }
    );
  }

  const deadline = deadlineFrom(submission.startedAt, submission.assessment.durationMinutes);
  const pastDeadline = deadline !== null && Date.now() > deadline.getTime();

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    answered,
    submittedAt: updated.submittedAt,
    pastDeadline,
    title: submission.assessment.title,
  });
}