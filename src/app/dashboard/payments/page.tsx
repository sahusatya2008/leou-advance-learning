import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, CheckCircle2, Clock, AlertTriangle, ArrowRight, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const PURPOSE_LABEL: Record<string, string> = {
  REGISTRATION: "Registration fee",
  RENEWAL: "Renewal",
  ADDITIONAL_SERVICE: "Additional service",
};

const METHOD_LABEL: Record<string, string> = {
  TRANSACTION_ID: "UPI transaction id",
  SCREENSHOT: "Screenshot",
  CAMERA_SCAN: "Camera scan",
};

function statusBadge(status: string) {
  if (status === "APPROVED")
    return (
      <Badge className="bg-emerald-500/20 text-emerald-300">
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Verified
      </Badge>
    );
  if (status === "SUBMITTED")
    return (
      <Badge className="bg-amber-500/20 text-amber-300">
        <Clock className="mr-1 h-3.5 w-3.5" /> Awaiting verification
      </Badge>
    );
  if (status === "REJECTED")
    return (
      <Badge className="bg-red-500/20 text-red-300">
        <XCircle className="mr-1 h-3.5 w-3.5" /> Rejected
      </Badge>
    );
  return <Badge variant="secondary">Replaced</Badge>;
}

export default async function PaymentsPage() {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;

  const payments = profId
    ? await prisma.paymentRecord.findMany({
        where: { studentId: profId },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const pending = payments.filter((p) => p.status === "PENDING");
  const paid = payments.filter((p) => p.status === "PAID");

  // Everything handed over so far, whatever the outcome. A proof the admin has
  // not decided yet, one they refused, and an attempt replaced by a later
  // submission are all part of "what I have paid", so the history keeps them.
  const history = await prisma.paymentRequest.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
    take: 100,
    select: {
      id: true,
      purpose: true,
      method: true,
      transactionId: true,
      leouPayRef: true,
      status: true,
      decisionNote: true,
      decidedAt: true,
      amountExpected: true,
      submittedAt: true,
      request: { select: { amount: true, status: true } },
    },
  });
  const verifiedCount = history.filter((h) => h.status === "APPROVED").length;
  const awaitingCount = history.filter((h) => h.status === "SUBMITTED").length;
  const rejectedCount = history.filter((h) => h.status === "REJECTED").length;
  const verifiedTotal = history
    .filter((h) => h.status === "APPROVED")
    .reduce((sum, h) => sum + Number(h.amountExpected ?? h.request?.amount ?? 0), 0);

  // Service requests awaiting money. These are the ones with a "Pay Now" button -
  // the plain fee records above are a read-only list kept as they were.
  const payable = await prisma.onboardingRequest.findMany({
    where: {
      userId: user.id,
      status: { in: ["REQUESTED", "BILLED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      amount: true,
      status: true,
      leouPayRef: true,
      updatedAt: true,
      _count: { select: { paymentRequests: true } },
    },
  });
  const inFlight = new Set(
    (
      await prisma.paymentRequest.findMany({
        where: { userId: user.id, status: "SUBMITTED" },
        select: { requestId: true },
      })
    ).map((p) => p.requestId)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Your fee records, due dates and everything you have paid so far.
        </p>
      </div>

      {payable.length > 0 && (
        <Card className="glass border-primary/30">
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Service requests</h2>
              <p className="text-sm text-muted-foreground">
                Pay for these to switch on your services. Your services start automatically once the
                admin verifies the payment.
              </p>
            </div>
            <div className="space-y-3">
              {payable.map((r) => {
                const waiting = inFlight.has(r.id);
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="font-medium">Service request</p>
                      <p className="text-sm text-muted-foreground">
                        {waiting
                          ? "Payment sent - waiting for the admin to verify it."
                          : r.leouPayRef
                            ? `Reference ${r.leouPayRef}`
                            : "No payment reference yet."}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">
                        {"\u20b9"}
                        {Number(r.amount ?? 0).toFixed(2)}
                      </span>
                      {waiting ? (
                        <Badge className="bg-amber-500/20 text-amber-300">
                          <Clock className="mr-1 h-3.5 w-3.5" /> Verifying
                        </Badge>
                      ) : (
                        <Button asChild size="sm">
                          <Link href={`/dashboard/payments/${r.id}/pay`}>
                            Pay Now <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Payment history</h2>
              <p className="text-sm text-muted-foreground">
                Everything you have paid so far, with the verification result for each one.
              </p>
            </div>
            {history.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className="bg-emerald-500/20 text-emerald-300">Verified {verifiedCount}</Badge>
                {awaitingCount > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-300">Awaiting {awaitingCount}</Badge>
                )}
                {rejectedCount > 0 && (
                  <Badge className="bg-red-500/20 text-red-300">Rejected {rejectedCount}</Badge>
                )}
                <Badge variant="outline">Total verified ₹{verifiedTotal.toFixed(2)}</Badge>
              </div>
            )}
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payments yet. Anything you pay will be listed here with its verification status.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((p) => {
                const amount = Number(p.amountExpected ?? p.request?.amount ?? 0);
                return (
                  <div key={p.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {statusBadge(p.status)}
                          <span className="text-sm font-medium">{PURPOSE_LABEL[p.purpose] ?? p.purpose}</span>
                          {p.leouPayRef && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {p.leouPayRef}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Paid {p.submittedAt.toLocaleDateString()}
                          {p.decidedAt && ` · Decided ${p.decidedAt.toLocaleDateString()}`}
                          {" · "}
                          {METHOD_LABEL[p.method] ?? p.method}
                          {p.transactionId && ` · Txn ${p.transactionId}`}
                        </p>
                        {p.decisionNote && (
                          <p className="text-xs text-muted-foreground">Admin note: {p.decisionNote}</p>
                        )}
                        {p.status === "APPROVED" && p.request.status === "ACTIVATED" && (
                          <p className="text-xs text-emerald-300/80">Services activated</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">₹{amount.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {payments.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
              <Wallet className="h-6 w-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              No fee records yet. Your institution will add them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="glass">
              <CardContent className="flex items-center gap-3 p-6">
                <Clock className="h-6 w-6 text-amber-300" />
                <div>
                  <p className="text-2xl font-bold">{pending.length}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="flex items-center gap-3 p-6">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                <div>
                  <p className="text-2xl font-bold">{paid.length}</p>
                  <p className="text-xs text-muted-foreground">Paid</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {payments.map((p) => (
              <Card key={p.id} className="glass">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.status === "PAID" && p.paidAt
                        ? `Paid ${p.paidAt.toLocaleDateString()} · was due ${p.dueDate.toLocaleDateString()}`
                        : `Due ${p.dueDate.toLocaleDateString()}`}
                    </p>
                    {p.receiptUrl && (
                      <a
                        href={p.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline"
                      >
                        View receipt
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">₹{Number(p.amount).toFixed(2)}</span>
                    {p.status === "PAID" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Paid
                      </Badge>
                    ) : p.status === "OVERDUE" ? (
                      <Badge className="bg-red-500/20 text-red-300">
                        <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Overdue
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3.5 w-3.5" /> Pending
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}