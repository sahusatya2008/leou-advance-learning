import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { updateAssessment, transitionStatus, type AssessmentInput, type AssessmentProctoring } from "@/services/assessmentService";
import type { AssessmentStatus, AssessmentKind } from "@/generated/prisma/enums";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      batch: { include: { classRoom: { select: { id: true, name: true } } } },
      questions: {
        include: {
          question: {
            include: {
              options: { orderBy: { sortOrder: "asc" } },
              testCases: { orderBy: { sortOrder: "asc" } },
              subject: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
      submissions: {
        include: {
          student: { select: { id: true, userId: true, fullName: true } },
          _count: { select: { answers: true } },
        },
        orderBy: { submittedAt: "asc" },
      },
    },
  });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  return NextResponse.json({ assessment });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body.status === "string") {
    const result = await transitionStatus(id, body.status as AssessmentStatus);
    if (!result.ok) return NextResponse.json({ error: result.errors.join(" · ") }, { status: 400 });
    await logActivity({
      userId: admin.user.id,
      type: "ADMIN_RELEASE_ASSESSMENT",
      targetId: id,
      metadata: { to: result.assessment.status },
      ...meta,
    }).catch(() => null);
    return NextResponse.json({ assessment: result.assessment });
  }

  const input: AssessmentInput = {
    batchId: String(body.batchId ?? ""),
    kind: String(body.kind ?? "") as AssessmentKind,
    subjectId: body.subjectId ? String(body.subjectId) : null,
    topic: body.topic ? String(body.topic) : null,
    attemptMode: String(body.attemptMode ?? "SCHEDULED") as AssessmentInput["attemptMode"],
    maxAttempts: body.maxAttempts != null && body.maxAttempts !== "" ? Number(body.maxAttempts) : null,
    title: String(body.title ?? ""),
    instructions: body.instructions ? String(body.instructions) : null,
    durationMinutes: Number(body.durationMinutes ?? 0),
    startsAt: body.startsAt ? new Date(String(body.startsAt)) : null,
    endsAt: body.endsAt ? new Date(String(body.endsAt)) : null,
    shuffleQuestions: Boolean(body.shuffleQuestions),
    proctoring: body.proctoring && typeof body.proctoring === "object" ? (body.proctoring as AssessmentProctoring) : null,
    questions: Array.isArray(body.questions) ? (body.questions as AssessmentInput["questions"]) : [],
  };

  const result = await updateAssessment(id, input);
  if (!result.ok) return NextResponse.json({ error: result.errors.join(" · ") }, { status: 400 });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_UPDATE_ASSESSMENT",
    targetId: id,
    metadata: { kind: result.assessment.kind },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ assessment: result.assessment });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const assessment = await prisma.assessment.findUnique({ where: { id }, include: { _count: { select: { submissions: true } } } });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  if (assessment._count.submissions > 0)
    return NextResponse.json({ error: "Cannot delete: students have already submitted." }, { status: 409 });

  await prisma.assessment.delete({ where: { id } });
  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_DELETE_ASSESSMENT",
    targetId: id,
    metadata: { title: assessment.title },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}