import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";

export const runtime = "nodejs";

/**
 * Payment lock on a student's own quotation.
 *
 * Locking is the point of no return before money moves: while a quotation is
 * locked every edit endpoint refuses it, so the amount and selection a student
 * paid against can never silently change. Unlocking is allowed only when no
 * payment is under review - once a proof is in, the admin must reject it first
 * so nobody can edit a request an admin is mid-way through verifying. Approval
 * also clears the lock, but the request is ACTIVATED by then so nothing is
 * editable anyway.
 */
export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const requestId = String(body.requestId ?? "");
  const lock = body.lock === true;
  if (!requestId) return NextResponse.json({ error: "Missing request." }, { status: 400 });

  const request = await prisma.onboardingRequest.findFirst({
    where: { id: requestId, userId: user.id },
    select: { id: true, status: true, lockedAt: true },
  });
  if (!request) return NextResponse.json({ error: "That quotation was not found." }, { status: 404 });
  if (request.status !== "REQUESTED")
    return NextResponse.json(
      { error: "This request has already been processed and can no longer be locked." },
      { status: 400 }
    );

  if (lock) {
    // Idempotent: re-locking keeps the original lock time so the admin can see
    // how long the amount has been frozen.
    await prisma.onboardingRequest.updateMany({
      where: { id: request.id, lockedAt: null },
      data: { lockedAt: new Date() },
    });
  } else {
    const underReview = await prisma.paymentRequest.count({
      where: { requestId: request.id, status: "SUBMITTED" },
    });
    if (underReview > 0) {
      return NextResponse.json(
        {
          error:
            "A payment for this request is being verified. Wait for the admin to approve or reject it before editing your choices.",
        },
        { status: 400 }
      );
    }
    await prisma.onboardingRequest.update({
      where: { id: request.id },
      data: { lockedAt: null },
    });
  }

  const updated = await prisma.onboardingRequest.findUnique({
    where: { id: request.id },
    select: { lockedAt: true },
  });

  return NextResponse.json({ ok: true, locked: updated?.lockedAt != null });
}