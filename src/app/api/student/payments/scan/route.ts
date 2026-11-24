import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { scanPaymentProof } from "@/lib/faceService";
import { verifyPaymentScreen } from "@/lib/paymentVerification";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Read a UPI transaction id off a photo of the payment confirmation.
 *
 * Authenticated students only, and rate limited hard: each call runs tesseract,
 * which is far more expensive than an embedding. The result is only a proposal -
 * it is shown to the student for confirmation and is never treated as proof.
 */
const recentHits = new Map<string, number[]>();
const MAX_PER_IP_PER_MIN = 12;

function rateOk(ip: string): boolean {
  const now = Date.now();
  const hits = (recentHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recentHits.set(ip, hits);
  return hits.length <= MAX_PER_IP_PER_MIN;
}

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const meta = getRequestMeta(req);

  if (!rateOk(meta.ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many scans in a row. Wait a minute, or type the transaction id." },
      { status: 429 }
    );
  }

  let body: { image?: unknown; requestId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  if (!image.startsWith("data:image/") || image.length < 200) {
    return NextResponse.json({ ok: false, error: "Capture the payment screen first." }, { status: 400 });
  }
  if (image.length > 12_000_000) {
    return NextResponse.json({ ok: false, error: "That frame is too large to scan." }, { status: 400 });
  }

  const result = await scanPaymentProof(image);

  // Compare what was read against the quotation the student is actually paying.
  // Without the requestId there is nothing to compare to, so the check is
  // reported as unreadable rather than quietly claiming a pass.
  let verification: ReturnType<typeof verifyPaymentScreen> | null = null;
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (requestId && result.ok) {
    const request = await prisma.onboardingRequest.findFirst({
      where: { id: requestId, userId: user.id },
      select: { amount: true },
    });
    verification = verifyPaymentScreen({
      amountFound: result.amount ?? null,
      // Stored as a Decimal; the comparison works in plain rupees.
      amountExpected: request ? Number(request.amount) : null,
      dateFound: result.date ?? null,
      timeFound: result.time ?? null,
      txnFound: result.transactionId || null,
    });
  }

  await logActivity({
    userId: user.id,
    type: "STUDENT_SUBMIT_PAYMENT",
    metadata: {
      scanned: true,
      found: Boolean(result.transactionId),
      amountRead: result.amount ?? null,
      dateRead: result.date ?? null,
      quoteMatched: verification ? verification.matches : null,
      quoteMismatch: verification ? verification.hasMismatch : null,
    },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ...result, verification });
}
