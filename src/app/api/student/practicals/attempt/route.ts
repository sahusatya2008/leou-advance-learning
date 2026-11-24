import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import {
  finishAttempt,
  reopenAttempt,
  recordRun,
  saveAttemptCode,
  startOrResumeAttempt,
} from "@/services/practicalService";

export const runtime = "nodejs";

/**
 * Attempt lifecycle for practical questions.
 *
 * Writing needs an active service (matching the assessment run route); the reads
 * that a student needs in order to see their own work do not, so an expired plan
 * never hides code the student already wrote.
 */
export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const userId = auth.current.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const action = String(body.action ?? "");

  const guard = await requireActiveService(userId);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  try {
    if (action === "start") {
      const result = await startOrResumeAttempt({
        userId,
        assignmentId: String(body.assignmentId ?? ""),
        questionId: String(body.questionId ?? ""),
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ attempt: result.attempt });
    }

    if (action === "save") {
      const result = await saveAttemptCode({
        userId,
        attemptId: String(body.attemptId ?? ""),
        code: String(body.code ?? ""),
        ...(body.language ? { language: String(body.language) } : {}),
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }

    if (action === "finish") {
      const result = await finishAttempt({ userId, attemptId: String(body.attemptId ?? "") });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }

    if (action === "reopen") {
      const result = await reopenAttempt({ userId, attemptId: String(body.attemptId ?? "") });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }

    if (action === "run") {
      const result = await recordRun({
        userId,
        attemptId: String(body.attemptId ?? ""),
        language: String(body.language ?? ""),
        ok: Boolean(body.ok),
        exitCode: body.exitCode === undefined || body.exitCode === null ? null : Number(body.exitCode),
        outputPreview: String(body.output ?? ""),
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: "Could not record that." }, { status: err.status ?? 500 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}