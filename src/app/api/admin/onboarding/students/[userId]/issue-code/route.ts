import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { issueServiceCode } from "@/services/onboardingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const { userId } = await ctx.params;

  const result = await issueServiceCode(userId, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(
    { ok: true, code: result.code, expiresAt: result.expiresAt, requestId: result.requestId },
    { headers: { "cache-control": "no-store" } },
  );
}