import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { claimSession } from "@/lib/runSessions";
import { runnerStartSession } from "@/services/runner";
import { gateStudentPractical, loadOwnAttempt } from "@/services/practicalService";

export const runtime = "nodejs";

/**
 * Starts an interactive session (a Python REPL, a shell) for one practical
 * question.
 *
 * The session is bound to the student's attempt, and the attempt is only reachable
 * through the same published-set + batch-membership + entitlement gate as the rest
 * of the practical surface, so this cannot be used as a generic code runner.
 */
export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const userId = auth.current.user.id;

  const guard = await requireActiveService(userId);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  let body: { attemptId?: string; language?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { attemptId, language, code } = body;
  if (!attemptId || !language || !String(code ?? "").trim())
    return NextResponse.json({ error: "Missing code data." }, { status: 400 });

  const own = await loadOwnAttempt({ userId, attemptId });
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  const gate = await gateStudentPractical({
    userId,
    assignmentId: own.attempt.assignmentId,
    expectedQuestionId: own.attempt.questionId,
  });
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const question = await prisma.question.findUnique({
    where: { id: own.attempt.questionId },
    select: { type: true, allowedLanguages: true },
  });
  if (!question || question.type !== "CODING")
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  const allowed = (question.allowedLanguages as string[]) ?? [];
  if (!allowed.includes(language))
    return NextResponse.json({ error: "Language not allowed." }, { status: 400 });

  try {
    // Interactive: after the student's code has run they get a prompt with their
    // own variables still in scope, which is the point of a practical REPL.
    const session = await runnerStartSession(language, String(code), { interactive: true });
    claimSession(session.id, {
      kind: "PRACTICAL",
      studentProfileId: gate.studentProfileId,
      practicalAttemptId: own.attempt.id,
      practicalQuestionId: own.attempt.questionId,
    });
    return NextResponse.json({ sessionId: session.id, language: session.language, cmd: session.cmd });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}