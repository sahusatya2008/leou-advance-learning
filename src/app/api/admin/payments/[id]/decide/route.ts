import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { decidePayment } from "@/services/paymentService";

export const runtime = "nodejs";

/** Approve (and switch the services on) or reject a student's payment proof. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const decision = body.decision === "APPROVE" ? "APPROVE" : body.decision === "REJECT" ? "REJECT" : null;
  if (!decision) {
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  }

  const result = await decidePayment({
    paymentId: id,
    adminUserId: admin.user.id,
    decision,
    note: typeof body.note === "string" ? body.note.slice(0, 2000) : "",
    attachments: Array.isArray(body.attachments) ? (body.attachments as string[]).slice(0, 4) : [],
    meta: meta as unknown as Record<string, unknown>,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
