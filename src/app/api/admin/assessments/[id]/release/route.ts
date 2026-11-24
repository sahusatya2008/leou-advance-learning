import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { releaseAssessment } from "@/services/gradingService";
import { logActivity } from "@/lib/log";
import { getRequestMeta } from "@/lib/requestMeta";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const { id } = await ctx.params;
  const meta = getRequestMeta(_req);

  const result = await releaseAssessment(admin.user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.errors[0] }, { status: 400 });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_RELEASE_RESULTS",
    targetId: id,
    metadata: { released: result.released },
    ...meta,
  }).catch(() => null);

  return NextResponse.json(result);
}