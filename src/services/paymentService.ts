import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/log";
import { SERVICE_PERIOD_MS } from "@/lib/constants";
import { newLeouPayRef } from "@/lib/leouPay";
import { saveImageDataUrl } from "@/lib/uploads";
import type { LogType, OnboardingStatus, PaymentRequestStatus } from "@/generated/prisma/enums";

/** UPI/PhonePe ids are long; anything wild is a fat finger, not a real id. */
export const TRANSACTION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{5,63}$/;

/**
 * Why this money is being collected, derived rather than taken from the client:
 * a student paying for the first time is registering, one whose month has
 * lapsed is renewing, and one who is still inside an active month is asking for
 * extra services.
 */
export async function paymentPurposeFor(
  userId: string,
  requestId: string
): Promise<"REGISTRATION" | "RENEWAL" | "ADDITIONAL_SERVICE"> {
  // What the student is actually doing is recorded on the request, so prefer it
  // over guessing. Renewing a month early still reads as a renewal; without
  // this it would be filed under additional services purely because the old
  // month had not run out yet.
  const request = await prisma.onboardingRequest.findUnique({
    where: { id: requestId },
    select: { kind: true },
  });
  if (request?.kind === "RENEWAL") return "RENEWAL";
  if (request?.kind === "ADDITIONAL") return "ADDITIONAL_SERVICE";

  const active = await prisma.serviceActivation.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });
  if (active) return "ADDITIONAL_SERVICE";

  const everActivated = await prisma.serviceActivation.findFirst({
    where: { userId },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });
  if (everActivated) return "RENEWAL";
  return "REGISTRATION";
}

/**
 * Admin decisions on a payment.
 *
 * Approving is the only thing in the whole flow that switches services on, so
 * it runs as a single transaction: either the payment is marked APPROVED, the
 * service month is created and the request goes live, or none of it happened.
 * There is deliberately no payment gateway callback - a student's claim is
 * never trusted, only the admin's decision is.
 *
 * Every approval opens its own 30-day window from now. This is the deliberate
 * rule for add-ons too: an add-on runs its own month, independent of whatever
 * is left on the primary, so a top-up approved mid-month does not ride out the
 * primary's tail end. A renewal additionally ends the live subscription
 * windows it was explicitly taking over (renewsActivationIds), which is what
 * lets a student renew the primary, an add-on, or several of them independently.
 */

export type Decision = "APPROVE" | "REJECT";

export async function decidePayment(input: {
  paymentId: string;
  adminUserId: string;
  decision: Decision;
  note?: string;
  attachments?: string[];
  meta?: Record<string, unknown>;
}) {
  const payment = await prisma.paymentRequest.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      status: true,
      requestId: true,
      userId: true,
      leouPayRef: true,
      method: true,
      transactionId: true,
      request: {
        select: {
          id: true,
          userId: true,
          status: true,
          classRoomId: true,
          kind: true,
          renewsActivationIds: true,
        },
      },
    },
  });

  if (!payment) return { ok: false as const, error: "That payment request was not found." };
  if (payment.status !== "SUBMITTED") {
    return {
      ok: false as const,
      error: `This payment was already ${payment.status.toLowerCase()}.`,
    };
  }
  // Guard against a payment being pointed at somebody else's service request.
  if (payment.request.userId !== payment.userId) {
    return { ok: false as const, error: "This payment does not match its service request." };
  }

  if (input.decision === "REJECT") {
    const note = (input.note ?? "").trim();
    if (!note) return { ok: false as const, error: "Tell the student why this was rejected." };

    const saved = (input.attachments ?? [])
      .filter((a) => typeof a === "string" && a.startsWith("data:image/"))
      .map((a) => saveImageDataUrl("payment-decision", a))
      .filter((r) => r.ok);

    await prisma.$transaction([
      prisma.paymentRequest.update({
        where: { id: payment.id },
        data: {
          status: "REJECTED" as PaymentRequestStatus,
          decisionNote: note,
          decidedAt: new Date(),
          decidedById: input.adminUserId,
        },
      }),
      // Rejecting is the explicit invitation to change the choices and try
      // again, so the payment lock opens here.
      prisma.onboardingRequest.update({
        where: { id: payment.requestId },
        data: { lockedAt: null },
      }),
      ...(saved.length
        ? [
            prisma.paymentRequestAttachment.createMany({
              data: saved.map((r) => ({ paymentId: payment.id, url: (r as { url: string }).url })),
            }),
          ]
        : []),
    ]);

    await logActivity({
      userId: input.adminUserId,
      type: "ADMIN_DECIDE_PAYMENT" as LogType,
      metadata: { paymentId: payment.id, decision: "REJECT", leouPayRef: payment.leouPayRef },
    });

    return { ok: true as const, status: "REJECTED" as const };
  }

  // ---- approval ----------------------------------------------------------
  // Every approval opens a fresh 30-day window from now, add-ons included: a
  // top-up runs its own month rather than riding out whatever is left of the
  // primary's. A renewal additionally ends the live subscription windows it
  // was created to take over (renewsActivationIds), which is how a student can
  // renew a subset of their subscriptions without the old periods overlapping.
  const isRenewal = payment.request.kind === "RENEWAL";
  const renewsActivationIds = (payment.request.renewsActivationIds as unknown as string[] | null) ?? [];

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.paymentRequest.update({
      where: { id: payment.id },
      data: {
        status: "APPROVED" as PaymentRequestStatus,
        decisionNote: (input.note ?? "").trim() || null,
        decidedAt: now,
        decidedById: input.adminUserId,
      },
    });

    if (isRenewal && renewsActivationIds.length > 0) {
      // The renewing subscription's previous window ends the moment the new
      // one starts, so a removed chapter cannot be resurrected by the old
      // activation and "days left" is never ambiguous.
      await tx.serviceActivation.updateMany({
        where: { id: { in: renewsActivationIds }, userId: payment.userId },
        data: { expiresAt: now },
      });
    }

    const expiresAt = new Date(now.getTime() + SERVICE_PERIOD_MS);
    await tx.serviceActivation.create({
      data: {
        userId: payment.userId,
        requestId: payment.requestId,
        activatedAt: now,
        expiresAt,
      },
    });

    await tx.onboardingRequest.update({
      where: { id: payment.requestId },
      data: { status: "ACTIVATED" as OnboardingStatus, lockedAt: null },
    });

    // Any other still-open attempt for the same request is now moot.
    await tx.paymentRequest.updateMany({
      where: { requestId: payment.requestId, status: "SUBMITTED", id: { not: payment.id } },
      data: { superseded: true, status: "SUPERSEDED" as PaymentRequestStatus },
    });
  });

  await logActivity({
    userId: input.adminUserId,
    type: "ADMIN_DECIDE_PAYMENT" as LogType,
    metadata: {
      paymentId: payment.id,
      decision: "APPROVE",
      leouPayRef: payment.leouPayRef,
      tookOverActivations: isRenewal ? renewsActivationIds.length : 0,
    },
  });

  return {
    ok: true as const,
    status: "APPROVED" as const,
    // A renewal/a top-up always starts its own window now; there is no
    // extended-existing-period flavour any more.
    extendedExistingPeriod: false,
  };
}

/**
 * Record a payment the admin matched in their own UPI statement.
 *
 * The student's proof is the usual route, but it is not the only way money
 * arrives. A renewal or top-up is a real request the moment the student submits
 * it, and an admin who can already see its reference in the bank statement must
 * not be stuck waiting for a screenshot. This creates the same SUBMITTED row a
 * student would, so the ordinary verify screen - and the ordinary approval
 * transaction - remain the only place services are switched on.
 *
 * Nothing is approved here: the admin still has to open the payment and confirm
 * it, and the amount is copied from the request at this moment so a later price
 * change cannot rewrite what is being reconciled.
 */
export async function recordPaymentForRequest(input: {
  requestId: string;
  adminUserId: string;
  transactionId: string;
  note?: string;
  meta?: Record<string, unknown>;
}) {
  const request = await prisma.onboardingRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, userId: true, kind: true, status: true, amount: true, leouPayRef: true },
  });
  if (!request) return { ok: false as const, error: "That service request was not found." };
  if (request.status === "ACTIVATED")
    return { ok: false as const, error: "These services are already active - there is nothing to record." };
  // BILLED is allowed on purpose: a service code issued by hand does not record
  // the money, and that is exactly the state the missing renewal was stuck in.
  if (Number(request.amount ?? 0) <= 0)
    return { ok: false as const, error: "This request has no amount to record." };

  // Never shadow a proof the student already sent: that row is the one the
  // admin should be deciding on, and a second SUBMITTED row would just make the
  // queue ambiguous.
  const existing = await prisma.paymentRequest.findFirst({
    where: { requestId: request.id, status: { in: ["SUBMITTED", "APPROVED"] } },
    select: { id: true, status: true },
  });
  if (existing) {
    return {
      ok: false as const,
      error:
        existing.status === "APPROVED"
          ? "A payment for this request has already been approved."
          : "A payment proof for this request is already waiting - decide on that one.",
      paymentId: existing.id,
    };
  }

  // Same lazily-minted reference the student path uses, so the row always has
  // something the admin can quote back against the statement.
  let leouPayRef = request.leouPayRef;
  if (!leouPayRef) {
    leouPayRef = newLeouPayRef();
    await prisma.onboardingRequest.update({ where: { id: request.id }, data: { leouPayRef } });
  }

  const purpose = await paymentPurposeFor(request.userId, request.id);
  const payment = await prisma.paymentRequest.create({
    data: {
      userId: request.userId,
      requestId: request.id,
      purpose,
      leouPayRef,
      method: "TRANSACTION_ID",
      transactionId: input.transactionId,
      amountExpected: request.amount,
    },
  });

  // Submitting proof (or recording it) is the point of no return: the selection
  // and amount are frozen while the admin verifies what was actually paid.
  await prisma.onboardingRequest.updateMany({
    where: { id: request.id, lockedAt: null },
    data: { lockedAt: new Date() },
  });

  await logActivity({
    userId: input.adminUserId,
    type: "ADMIN_DECIDE_PAYMENT" as LogType,
    metadata: {
      action: "RECORD",
      paymentId: payment.id,
      requestId: request.id,
      purpose,
      leouPayRef,
      note: (input.note ?? "").trim() || null,
    },
    ...(input.meta ?? {}),
  });

  return { ok: true as const, paymentId: payment.id, purpose };
}
