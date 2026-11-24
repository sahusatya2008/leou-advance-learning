import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { TRANSACTION_ID_RE, recordPaymentForRequest } from "@/services/paymentService";

export const runtime = "nodejs";

/**
 * Record a payment the admin has already seen in their UPI statement.
 *
 * This exists because a renewal or top-up is a real request the moment the
 * student submits it, and the money can arrive before - or without - a proof
 * upload. The row created here is exactly the row the student's own proof would
 * create: it lands as SUBMITTED, so approving it still goes through the ordinary
 * verify screen and the ordinary activation transaction. Nothing is approved by
 * this endpoint.
 */
export async function POST(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const requestId = String(body.requestId ?? "").trim();
  const transactionId = String(body.transactionId ?? "").trim();
  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : "";

  if (!requestId) return NextResponse.json({ error: "Missing service request." }, { status: 400 });
  if (!TRANSACTION_ID_RE.test(transactionId)) {
    return NextResponse.json(
      { error: "Enter the transaction id exactly as your UPI statement shows it." },
      { status: 400 }
    );
  }

  const result = await recordPaymentForRequest({
    requestId,
    adminUserId: admin.user.id,
    transactionId,
    note,
    meta: meta as unknown as Record<string, unknown>,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, paymentId: "paymentId" in result ? result.paymentId : undefined },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, paymentId: result.paymentId }, { status: 201 });
}
