import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock, Unlock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PAYMENT_CONFIG } from "@/lib/constants";
import { RecordPaymentForm } from "@/components/admin/payments/RecordPaymentForm";
import type { Quotation } from "@/services/onboardingService";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  RENEWAL: "Renewal",
  ADDITIONAL: "Additional services",
  INITIAL: "New registration",
};

const TAB_FOR_KIND: Record<string, string> = {
  RENEWAL: "RENEWAL",
  ADDITIONAL: "ADDITIONAL_SERVICE",
};

const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatAge(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * A student's submitted service request, before any proof exists.
 *
 * The payment queue used to start only at the first proof-of-payment row, which
 * left a renewal (or top-up) invisible to the admin until the student uploaded
 * a screenshot. This page is where the request itself is worked on: the admin
 * can see the reference and the amount, and record the money they have already
 * matched in the UPI statement, which opens the ordinary verify screen.
 */
export default async function AdminPaymentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const request = await prisma.onboardingRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          studentProfile: { select: { fullName: true, classRoom: { select: { name: true } } } },
        },
      },
      paymentRequests: {
        orderBy: { submittedAt: "desc" },
        take: 10,
        select: { id: true, status: true, method: true, transactionId: true, decisionNote: true, submittedAt: true },
      },
    },
  });
  if (!request) notFound();

  const breakdown = request.breakdown as Quotation | null;
  const amount = Number(request.amount ?? breakdown?.totals.grand ?? 0);
  const open = request.paymentRequests.find((p) => p.status === "SUBMITTED" || p.status === "APPROVED");
  const tab = TAB_FOR_KIND[request.kind] ?? "REGISTRATION";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/admin/payments?tab=${tab}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to payments
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {request.user.studentProfile?.fullName ?? request.user.username}
          </h1>
          <p className="text-sm text-muted-foreground">
            {request.user.studentProfile?.classRoom?.name ?? "—"} · {KIND_LABEL[request.kind] ?? request.kind} ·
            requested {formatAge(request.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/20 text-amber-300">Awaiting payment</Badge>
          <Badge variant="outline">{request.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass border-primary/30">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-medium">Reconcile against your UPI statement</h2>
            <div>
              <p className="text-xs text-muted-foreground">LEOU payment id</p>
              <p className="font-mono text-lg font-bold tracking-wider">{request.leouPayRef ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paying to</p>
              <p className="text-sm">
                {PAYMENT_CONFIG.payeeName} · <code>{PAYMENT_CONFIG.upiId}</code>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amount expected</p>
              <p className="text-lg font-bold">{inr(amount)}</p>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {request.lockedAt ? (
                <>
                  <Lock className="h-3.5 w-3.5" /> Selection and amount are locked for payment
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5" /> The student can still edit this selection
                </>
              )}
            </p>
            {request.status === "BILLED" && (
              <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                A service code was issued by hand for this request, but no payment was ever recorded
                against it. If the money is in your statement, record it below so the request is
                verified properly; the student&apos;s unredeemed code stops being redeemable once
                these services activate.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-medium">What is being paid for</h2>
            {breakdown ? (
              <div className="space-y-2 text-sm">
                {breakdown.perSubject.map((s) => (
                  <div key={s.subjectId} className="rounded-lg border border-border bg-card/60 p-3">
                    <p className="font-medium">{s.subjectName}</p>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {s.assignment.total > 0 && (
                        <p className="flex justify-between gap-3"><span>Assignments</span><span>{inr(s.assignment.total)}</span></p>
                      )}
                      {s.mock.total > 0 && (
                        <p className="flex justify-between gap-3"><span>Mock tests</span><span>{inr(s.mock.total)}</span></p>
                      )}
                      {s.test.total > 0 && (
                        <p className="flex justify-between gap-3"><span>Real tests</span><span>{inr(s.test.total)}</span></p>
                      )}
                      {s.tutoring && s.tutoring.total > 0 && (
                        <p className="flex justify-between gap-3"><span>Tutoring</span><span>{inr(s.tutoring.total)}</span></p>
                      )}
                    </div>
                  </div>
                ))}
                <p className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="text-primary">{inr(breakdown.totals.grand)}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No itemised quotation was stored with this request.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {request.paymentRequests.length > 0 && (
        <Card className="glass">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-medium">Payment attempts on this request</h2>
            {request.paymentRequests.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="text-sm">
                  <Badge
                    className={
                      p.status === "APPROVED"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : p.status === "REJECTED"
                          ? "bg-red-500/20 text-red-300"
                          : p.status === "SUPERSEDED"
                            ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/20 text-amber-300"
                    }
                  >
                    {p.status}
                  </Badge>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.transactionId ?? p.method} · {formatAge(p.submittedAt)}
                    {p.decisionNote ? ` · ${p.decisionNote}` : ""}
                  </span>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/payments/${p.id}`}>
                    Open <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {request.status === "ACTIVATED" ? (
        <Card className="glass">
          <CardContent className="p-6 text-sm text-muted-foreground">
            These services are already active, so there is nothing left to record.
          </CardContent>
        </Card>
      ) : open ? (
        <Card className="glass border-primary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
            <p className="text-sm text-muted-foreground">
              {open.status === "SUBMITTED"
                ? "A payment is already waiting for your decision."
                : "A payment for this request has already been approved."}
            </p>
            <Button asChild>
              <Link href={`/admin/payments/${open.id}`}>
                Open payment <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <RecordPaymentForm requestId={request.id} amountLabel={inr(amount)} />
      )}
    </div>
  );
}
