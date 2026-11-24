import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { checkSubmission, isFailure } from "@/services/snsaiService";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ submissionId: string }> };

/**
 * Pre-submit Check.
 *
 * Body: `{ assessmentQuestionIds?: string[] }`. Omit the ids to check the whole
 * attempt.
 *
 * This is advisory only. It never writes marks, verdicts or feedback, so what
 * a student sees here can never become their grade. The authoritative grade is
 * produced by autoGradeAssessment when the attempt is submitted.
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  if (!profId) return NextResponse.json({ error: "No student profile." }, { status: 403 });

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  // "Check" is the most expensive thing a student can trigger, because it runs
  // their code. One check per question every 10s is far beyond real use and
  // stops a student using it as a code-execution oracle.
  const limit = rateLimit(`snsai:${profId}`, { limit: 12, windowMs: 10_000, blockMs: 30_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many checks. Try again in ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: { assessmentQuestionIds?: unknown } = {};
  try {
    const raw = await req.text();
    // An empty body is valid and means "check everything".
    if (raw.trim()) {
      const parsed = JSON.parse(raw) as { assessmentQuestionIds?: unknown };
      body = parsed ?? {};
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const ids = Array.isArray(body.assessmentQuestionIds)
    ? body.assessmentQuestionIds.filter((v): v is string => typeof v === "string" && v.length > 0)
    : undefined;
  if (ids && ids.length > 100) {
    return NextResponse.json({ error: "Too many questions in one check." }, { status: 400 });
  }

  const { submissionId } = await ctx.params;
  const result = await checkSubmission(submissionId, profId, ids);
  if (isFailure(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
