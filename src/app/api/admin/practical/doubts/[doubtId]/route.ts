import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getDoubtForAdmin, replyToDoubt } from "@/services/practicalService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ doubtId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { doubtId } = await ctx.params;

  const doubt = await getDoubtForAdmin(doubtId);
  if (!doubt) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  return NextResponse.json({ doubt });
}

/** An admin answer. This is what moves a thread from OPEN to ANSWERED. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { doubtId } = await ctx.params;

  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await replyToDoubt({
    userId: auth.current.user.id,
    role: "ADMIN",
    doubtId,
    body: String(body.body ?? ""),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ doubt: result.doubt });
}
