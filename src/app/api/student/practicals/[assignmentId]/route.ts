import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getStudentPractical } from "@/services/practicalService";
import { requireActiveService } from "@/services/onboardingService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ assignmentId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const userId = auth.current.user.id;
  const { assignmentId } = await ctx.params;

  // Service status is part of visibility, not just permission to write: a lapsed
  // student should not be able to read the set either.
  const guard = await requireActiveService(userId);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  const result = await getStudentPractical({ userId, assignmentId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ practical: result.practical });
}
