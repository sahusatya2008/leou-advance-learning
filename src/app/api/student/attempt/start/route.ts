import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService, getActiveServices, assessmentTopicAllowed } from "@/services/onboardingService";
import { decideAttempt } from "@/services/attemptService";
import { isUntimed } from "@/lib/assessmentTime";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  if (!profId) return NextResponse.json({ error: "Not a student account." }, { status: 403 });

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  let body: { assessmentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.assessmentId) return NextResponse.json({ error: "Missing assessment." }, { status: 400 });

  const assessment = await prisma.assessment.findUnique({
    where: { id: body.assessmentId },
    select: {
      id: true,
      kind: true,
      status: true,
      topic: true,
      subjectId: true,
      attemptMode: true,
      maxAttempts: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      batch: { include: { students: { select: { studentId: true } } } },
      submissions: {
        where: { studentId: profId },
        orderBy: { attemptNumber: "desc" },
        select: { id: true, status: true, attemptNumber: true, startedAt: true },
      },
    },
  });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  // Only assessments the student's activated services (kind + subscribed
  // chapters/topics) cover can be attempted — not every service assessment.
  const services = await getActiveServices(user.id);
  if (services && !assessmentTopicAllowed(services, assessment.kind, assessment.topic, assessment.subjectId))
    return NextResponse.json(
      { error: "This assessment covers a service or chapter that is not part of your current plan." },
      { status: 403 }
    );

  if (!assessment.batch.students.some((s) => s.studentId === profId))
    return NextResponse.json({ error: "Not a member of this batch." }, { status: 403 });

  const decision = decideAttempt({
    assessment: {
      attemptMode: assessment.attemptMode,
      maxAttempts: assessment.maxAttempts,
      status: assessment.status,
      startsAt: assessment.startsAt,
      endsAt: assessment.endsAt,
    },
    submissions: assessment.submissions.map((s) => ({ status: s.status, attemptNumber: s.attemptNumber })),
  });
  if (!decision.allow) return NextResponse.json({ error: decision.reason }, { status: decision.statusCode });

  const current = assessment.submissions.find((s) => s.status === "IN_PROGRESS");
  const submission =
    current ??
    (await prisma.submission.create({
      data: { assessmentId: assessment.id, studentId: profId, attemptNumber: decision.attemptNumber },
    }));

  // An untimed assignment (durationMinutes <= 0) reports a null deadline: the
  // student keeps the paper open until they press Submit, with no clock at all.
  if (isUntimed(assessment.durationMinutes)) {
    return NextResponse.json({ ok: true, submissionId: submission.id, deadline: null });
  }

  const duration = Math.max(1, assessment.durationMinutes);
  const started = submission.startedAt.getTime();
  const rawDeadline = new Date(started + duration * 60_000);
  const deadline = rawDeadline.getTime() > Date.now() ? rawDeadline : new Date(Date.now() + 60 * 60_000);

  return NextResponse.json({ ok: true, submissionId: submission.id, deadline: deadline.toISOString() });
}