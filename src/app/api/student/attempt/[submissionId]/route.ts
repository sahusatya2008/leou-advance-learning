import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ submissionId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  const { submissionId } = await ctx.params;

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  let body: { assessmentQuestionId?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.assessmentQuestionId || body.payload === undefined)
    return NextResponse.json({ error: "Missing answer data." }, { status: 400 });

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, studentId: true, status: true },
  });
  if (!submission || submission.studentId !== profId)
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  if (submission.status !== "IN_PROGRESS")
    return NextResponse.json({ error: "Submission is already closed." }, { status: 409 });

  const aq = await prisma.assessmentQuestion.findUnique({
    where: { id: body.assessmentQuestionId },
    select: { assessmentId: true },
  });
  if (!aq || aq.assessmentId !== (await prisma.submission.findUnique({ where: { id: submissionId } }))?.assessmentId)
    return NextResponse.json({ error: "Question does not belong to this assessment." }, { status: 400 });

  await prisma.answer.upsert({
    where: { submissionId_assessmentQuestionId: { submissionId, assessmentQuestionId: body.assessmentQuestionId } },
    create: { submissionId, assessmentQuestionId: body.assessmentQuestionId, payload: body.payload as never },
    update: { payload: body.payload as never },
  });

  return NextResponse.json({ ok: true });
}