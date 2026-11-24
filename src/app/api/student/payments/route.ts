import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { newLeouPayRef } from "@/lib/leouPay";
import { scanPaymentProof } from "@/lib/faceService";
import { verifyPaymentScreen } from "@/lib/paymentVerification";
import { TRANSACTION_ID_RE, paymentPurposeFor } from "@/services/paymentService";
import { MAX_IMAGE_BYTES, saveImageDataUrl } from "@/lib/uploads";

export const runtime = "nodejs";

type Method = "TRANSACTION_ID" | "SCREENSHOT" | "CAMERA_SCAN";

const METHODS: Method[] = ["TRANSACTION_ID", "SCREENSHOT", "CAMERA_SCAN"];

/**
 * A student proves they paid.
 *
 * This records an *attempt*, never an approval: the row lands as SUBMITTED and
 * only the admin can move it to APPROVED. Anything the student sends here is
 * therefore treated as untrusted input - it is stored and shown, not acted on.
 */
export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const meta = getRequestMeta(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const requestId = String(body.requestId ?? "");
  const method = String(body.method ?? "") as Method;
  const transactionId = String(body.transactionId ?? "").trim();
  const screenshot = typeof body.screenshot === "string" ? body.screenshot : "";
  const cameraProof = typeof body.cameraProof === "string" ? body.cameraProof : "";

  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: "Choose how you want to verify the payment." }, { status: 400 });
  }

  // Ownership: a student may only pay against their own service request.
  const request = await prisma.onboardingRequest.findFirst({
    where: { id: requestId, userId: user.id },
    select: { id: true, amount: true, leouPayRef: true, status: true },
  });
  if (!request) {
    return NextResponse.json({ error: "That service request was not found." }, { status: 404 });
  }
  if (request.status === "ACTIVATED") {
    return NextResponse.json(
      { error: "These services are already active - there is nothing to pay." },
      { status: 400 }
    );
  }

  let screenshotUrl: string | undefined;
  let cameraProofUrl: string | undefined;

  if (method === "SCREENSHOT") {
    if (!screenshot) return NextResponse.json({ error: "Attach the payment screenshot." }, { status: 400 });
    const saved = saveImageDataUrl("payment", screenshot);
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
    if (screenshot.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Screenshot is too large." }, { status: 400 });
    }
    screenshotUrl = saved.url;
  }

  if (method === "CAMERA_SCAN") {
    if (!cameraProof) return NextResponse.json({ error: "Capture the payment proof first." }, { status: 400 });
    const saved = saveImageDataUrl("payment", cameraProof);
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
    cameraProofUrl = saved.url;
  }

  if (method === "TRANSACTION_ID" && !TRANSACTION_ID_RE.test(transactionId)) {
    return NextResponse.json(
      { error: "Enter the transaction id exactly as your UPI app shows it." },
      { status: 400 }
    );
  }

  // Historical requests predate the reference column; mint one lazily so the
  // student always has something to quote back to the admin. The local value has
  // to be updated too - reading the stale (null) field is what left an earlier
  // attempt filed against an empty reference.
  let leouPayRef = request.leouPayRef;
  if (!leouPayRef) {
    leouPayRef = newLeouPayRef();
    await prisma.onboardingRequest.update({
      where: { id: request.id },
      data: { leouPayRef },
    });
  }

  // Only one live attempt at a time; older ones are kept as history but marked
  // so the admin queue does not fill up with a student clicking twice.
  await prisma.paymentRequest.updateMany({
    where: { requestId: request.id, status: "SUBMITTED" },
    data: { superseded: true, status: "SUPERSEDED" },
  });

  // Submitting proof *is* the point of no return: the request is locked the
  // moment the first attempt lands so the selection and amount cannot change
  // while the admin verifies what was actually paid against. The lock endpoint
  // is the happy path that sets this earlier; this is the belt-and-braces path
  // for a student who deep-links straight to the pay page.
  await prisma.onboardingRequest.updateMany({
    where: { id: request.id, lockedAt: null },
    data: { lockedAt: new Date() },
  });

  // Read the screen again, here, on the image that is about to be stored.
  //
  // The browser already ran this scan and the client sends back everything it
  // "read", but nothing the client sends can be believed: a student can post
  // scannedAmount: 1315 and present a passed check without ever having paid.
  // So the values recorded here come only from this run, and a scan that fails
  // leaves the fields null rather than falling back to what the client claimed.
  const evidenceImage = method === "SCREENSHOT" ? screenshot : method === "CAMERA_SCAN" ? cameraProof : "";
  const scan = evidenceImage ? await scanPaymentProof(evidenceImage) : null;

  const scannedAmount = scan?.ok ? scan.amount ?? null : null;
  const scannedDate = scan?.ok ? scan.date ?? null : null;
  const scannedTime = scan?.ok ? scan.time ?? null : null;
  const scannedPayee = scan?.ok ? scan.payee ?? null : null;
  const ocrText = scan?.ok && scan.text ? scan.text.slice(0, 4000) : "";
  // A reference the student typed themselves still counts, but only the one on
  // the scanned image can be treated as read evidence.
  const scannedTxn = scan?.ok ? scan.transactionId || null : null;

  // Both image methods get the same quotation comparison. Previously only the
  // camera path was checked, which left an uploaded screenshot - the option most
  // students actually pick - unverified against the amount they owed.
  const verification = evidenceImage
    ? verifyPaymentScreen({
        amountFound: scannedAmount,
        // Stored as a Decimal; the comparison works in plain rupees.
        amountExpected: Number(request.amount),
        dateFound: scannedDate,
        timeFound: scannedTime,
        txnFound: scannedTxn || transactionId || null,
      })
    : null;

  const purpose = await paymentPurposeFor(user.id, requestId);

  const payment = await prisma.paymentRequest.create({
    data: {
      userId: user.id,
      requestId: request.id,
      purpose,
      leouPayRef,
      method,
      transactionId: method === "TRANSACTION_ID" ? transactionId : transactionId || null,
      screenshotUrl: screenshotUrl ?? null,
      cameraProofUrl: cameraProofUrl ?? null,
      ocrText: ocrText || null,
      scannedAmount: scannedAmount,
      scannedDate: scannedDate,
      scannedTime: scannedTime,
      scannedPayee: scannedPayee,
      checkResult: verification ? JSON.stringify(verification) : null,
      amountExpected: request.amount,
    },
  });

  await logActivity({
    userId: user.id,
    type: "STUDENT_SUBMIT_PAYMENT",
    metadata: {
      paymentId: payment.id,
      purpose: payment.purpose,
      method,
      leouPayRef: payment.leouPayRef,
      // Recorded from this run's OCR, not from the request body.
      amountRead: scannedAmount,
      dateRead: scannedDate,
      payeeRead: scannedPayee,
      scanError: scan && !scan.ok ? scan.error ?? "scan failed" : null,
      scanMatched: verification ? verification.matches : null,
      scanMismatch: verification ? verification.hasMismatch : null,
    },
    ...meta,
  }).catch(() => null);

  return NextResponse.json(
    {
      ok: true,
      paymentId: payment.id,
      verification,
      scanError: scan && !scan.ok ? (scan.error ?? "Could not read the screen.") : null,
    },
    { status: 201 }
  );
}
