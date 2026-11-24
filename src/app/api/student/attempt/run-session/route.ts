import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { runnerStartSession } from "@/services/runner";
import { claimSession } from "@/lib/runSessions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  if (!profId) return NextResponse.json({ error: "Not a student account." }, { status: 403 });

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  let body: { assessmentQuestionId?: string; language?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { assessmentQuestionId, language, code } = body;
  if (!assessmentQuestionId || !language || !String(code ?? "").trim())
    return NextResponse.json({ error: "Missing code data." }, { status: 400 });

  const aq = await prisma.assessmentQuestion.findUnique({
    where: { id: assessmentQuestionId },
    include: {
      question: { select: { type: true, allowedLanguages: true } },
      assessment: {
        include: {
          batch: { include: { students: { select: { studentId: true } } } },
          submissions: { where: { studentId: profId, status: "IN_PROGRESS" }, take: 1 },
        },
      },
    },
  });
  if (!aq || aq.question.type !== "CODING" || !profId)
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  if (!aq.assessment.batch.students.some((s) => s.studentId === profId))
    return NextResponse.json({ error: "Not a member of this batch." }, { status: 403 });

  const submission = aq.assessment.submissions[0];
  if (!submission || submission.status !== "IN_PROGRESS")
    return NextResponse.json({ error: "Submission is not open for attempts." }, { status: 409 });

  const allowed = (aq.question.allowedLanguages as string[]) ?? [];
  if (!allowed.includes(language)) return NextResponse.json({ error: "Language not allowed." }, { status: 400 });

  try {
    const session = await runnerStartSession(language, String(code));
    claimSession(session.id, {
      kind: "ASSESSMENT",
      studentProfileId: profId,
      submissionId: submission.id,
      assessmentQuestionId,
    });
    return NextResponse.json({ sessionId: session.id, language: session.language, cmd: session.cmd });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}