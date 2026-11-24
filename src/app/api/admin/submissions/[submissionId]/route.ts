import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { saveManualGrades } from "@/services/gradingService";
import { logActivity } from "@/lib/log";
import { getRequestMeta } from "@/lib/requestMeta";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ submissionId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const { submissionId } = await ctx.params;
  const meta = getRequestMeta(req);

  let body: { answers?: { answerId: string; marksAwarded: number | null; feedback?: string }[]; feedback?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await saveManualGrades(admin.user.id, submissionId, body);
  if (!result.ok) {
    await logActivity({
      userId: admin.user.id,
      type: "ADMIN_EVALUATE",
      targetId: submissionId,
      metadata: { ok: false, error: result.errors[0] },
      ...meta,
    }).catch(() => null);
    return NextResponse.json({ error: result.errors[0] }, { status: 400 });
  }

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_EVALUATE",
    targetId: submissionId,
    metadata: { ok: true, allGraded: result.allGraded },
    ...meta,
  }).catch(() => null);

  return NextResponse.json(result);
}