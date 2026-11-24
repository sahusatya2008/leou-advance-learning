import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { runnerRun } from "@/services/runner";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  if (!profId) return NextResponse.json({ error: "No student profile." }, { status: 403 });
  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  // This endpoint just runs code: like the Check route it spins the sandbox, so
  // it gets the same per-student budget. Without it a student could use the
  // runner as a free, unthrottled code-execution oracle.
  const limit = rateLimit(`runner:${profId}`, { limit: 12, windowMs: 10_000, blockMs: 30_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many runs. Try again in ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: { language?: string; code?: string; stdin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.code || body.code.length > 100_000)
    return NextResponse.json({ error: "No code provided." }, { status: 400 });
  try {
    const result = await runnerRun(String(body.language ?? ""), body.code, String(body.stdin ?? ""));
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}