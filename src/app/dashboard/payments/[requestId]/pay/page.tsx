import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PayNowPanel } from "@/components/student/PayNowPanel";
import { PAYMENT_CONFIG } from "@/lib/constants";
import { newLeouPayRef, upiDeepLink } from "@/lib/leouPay";
import type { Quotation } from "@/services/onboardingService";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/**
 * The Pay Now page.
 *
 * There is no gateway here. The student pays by UPI or PhonePe, then proves it
 * one of three ways. What this screen is really for is the *reference*: the
 * student is given a LeouPay id to note down before they pay so the admin can
 * match the entry later, and the UPI details are shown plainly so nobody has to
 * ask which ID to send to.
 */
export default async function PayNowPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const { user } = await requireRole("STUDENT");

  const request = await prisma.onboardingRequest.findFirst({
    where: { id: requestId, userId: user.id },
    select: {
      id: true,
      amount: true,
      breakdown: true,
      status: true,
      leouPayRef: true,
      createdAt: true,
    },
  });
  if (!request) notFound();

  // Every request should already carry a reference, but a request that predates
  // the column (or was written by something other than the wizard) would reach
  // the pay screen with a blank one. That matters more than it looks: the
  // reference is what makes a bank entry matchable, and a student paying with an
  // empty note cannot be reconciled at all. So mint one rather than render blank.
  let leouPayRef = request.leouPayRef;
  if (!leouPayRef) {
    leouPayRef = newLeouPayRef();
    await prisma.onboardingRequest.update({
      where: { id: request.id },
      data: { leouPayRef },
    });
  }

  if (request.status === "ACTIVATED") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-bold">Nothing to pay</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            These services are already active. If you want extra subjects, request them from your plan page.
          </p>
          <Link
            href="/onboarding"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to my plan
          </Link>
        </div>
      </div>
    );
  }

  const amount = request.amount ? Number(request.amount) : 0;
  const totals = (request.breakdown as Quotation | null)?.totals;
  const grandTotal = typeof totals?.grand === "number" ? totals.grand : amount;

  // The academy's own PhonePe artwork wins when it is configured, so a student can
  // scan exactly the code the academy publishes elsewhere. Otherwise the QR is
  // drawn from the UPI link rather than shipped as a checked-in image, so the code
  // and the id printed beside it can never drift apart.
  let qrSrc: string | null = null;
  let configuredQrMissing = false;

  if (PAYMENT_CONFIG.qrImage) {
    const file = path.join(process.cwd(), "public", PAYMENT_CONFIG.qrImage.replace(/^\//, ""));
    if (existsSync(file)) {
      qrSrc = PAYMENT_CONFIG.qrImage;
    } else {
      // A configured path that is not there would otherwise show a broken image
      // and a student would have no way to pay.
      configuredQrMissing = true;
    }
  }

  if (!qrSrc) {
    try {
      qrSrc = await QRCode.toDataURL(
        upiDeepLink({
          upiId: PAYMENT_CONFIG.upiId,
          payeeName: PAYMENT_CONFIG.payeeName,
          amount: grandTotal,
          note: `${PAYMENT_CONFIG.bankNote} ${leouPayRef}`.trim(),
        }),
        { width: 512, margin: 1, errorCorrectionLevel: "M" }
      );
    } catch {
      // A scannable id printed as text is still a usable fallback.
      qrSrc = null;
    }
  }
  const attempts = await prisma.paymentRequest.findMany({
    where: { requestId: request.id },
    orderBy: { submittedAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      method: true,
      transactionId: true,
      decisionNote: true,
      submittedAt: true,
      attachments: { select: { url: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/payments"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to payments
      </Link>

      {configuredQrMissing && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          The configured QR image ({PAYMENT_CONFIG.qrImage}) is missing, so a QR was
          generated from the UPI id below instead. The UPI id is correct - please
          pay using that.
        </div>
      )}

      <PayNowPanel
        requestId={request.id}
        leouPayRef={leouPayRef}
        amount={amount}
        grandTotal={grandTotal}
        status={request.status}
        upiId={PAYMENT_CONFIG.upiId}
        payeeName={PAYMENT_CONFIG.payeeName}
        qrImage={qrSrc}
        qrWarning={configuredQrMissing}
        helpline={PAYMENT_CONFIG.helpline}
        bankNote={PAYMENT_CONFIG.bankNote}
        attempts={attempts.map((a) => ({
          id: a.id,
          status: a.status,
          method: a.method,
          transactionId: a.transactionId,
          decisionNote: a.decisionNote,
          submittedAt: a.submittedAt.toISOString(),
          attachments: a.attachments.map((f) => f.url),
        }))}
      />
    </div>
  );
}
