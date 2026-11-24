import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { createAssessment, type AssessmentInput } from "@/services/assessmentService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  const batchId = url.searchParams.get("batchId") ?? undefined;
  const kind = url.searchParams.get("kind") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const assessments = await prisma.assessment.findMany({
    where: {
      ...(batchId ? { batchId } : {}),
      ...(kind ? { kind: kind as never } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      batch: { include: { classRoom: { select: { id: true, name: true } } } },
      _count: { select: { questions: true, submissions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ assessments });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const input: AssessmentInput = {
    batchId: String(body.batchId ?? ""),
    kind: String(body.kind ?? "") as AssessmentInput["kind"],
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
    proctoring: body.proctoring && typeof body.proctoring === "object" ? (body.proctoring as AssessmentInput["proctoring"]) : null,
    questions: Array.isArray(body.questions) ? (body.questions as AssessmentInput["questions"]) : [],
  };

  const result = await createAssessment(input);
  if (!result.ok) return NextResponse.json({ error: result.errors.join(" · ") }, { status: 400 });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_CREATE_ASSESSMENT",
    targetId: result.assessment.id,
    metadata: { kind: result.assessment.kind, batchId: result.assessment.batchId },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ assessment: result.assessment }, { status: 201 });
}