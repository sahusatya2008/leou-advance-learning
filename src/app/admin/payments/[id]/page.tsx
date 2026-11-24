import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleHelp, ExternalLink, TriangleAlert, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PaymentCheckResult } from "@/lib/paymentVerification";
import { Badge } from "@/components/ui/badge";
import { PaymentDecision } from "@/components/admin/payments/PaymentDecision";
import { PAYMENT_CONFIG } from "@/lib/constants";
import type { Quotation } from "@/services/onboardingService";

export const dynamic = "force-dynamic";

/**
 * One payment, and the decision on it.
 *
 * The page leads with the two things needed to reconcile the payment by hand -
 * the LEOU reference and whatever the student entered - because that comparison
 * happens outside the app, against a bank statement.
 */
export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const payment = await prisma.paymentRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          username: true,
          studentProfile: { select: { fullName: true, classRoom: { select: { name: true } } } },
        },
      },
      request: {
        select: {
          id: true,
          amount: true,
          breakdown: true,
          subjects: true,
          status: true,
          createdAt: true,
          wantAssignments: true,
          wantMockTests: true,
          wantRealTests: true,
          wantTutoring: true,
        },
      },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!payment) notFound();

  const breakdown = payment.request.breakdown as Quotation | null;
  const check = (() => {
    if (!payment.checkResult) return null;
    try {
      return JSON.parse(payment.checkResult) as PaymentCheckResult;
    } catch {
      return null;
    }
  })();

  const decided = payment.status !== "SUBMITTED";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/payments"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All payments
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {payment.user.studentProfile?.fullName ?? payment.user.username}
          </h1>
          <p className="text-sm text-muted-foreground">
            {payment.user.studentProfile?.classRoom?.name ?? "—"} · paid{" "}
            {payment.submittedAt.toLocaleString()}
          </p>
        </div>
        <Badge
          className={
            payment.status === "APPROVED"
              ? "bg-emerald-500/20 text-emerald-300"
              : payment.status === "REJECTED"
                ? "bg-red-500/20 text-red-300"
                : payment.status === "SUPERSEDED"
                  ? "bg-muted text-muted-foreground"
                  : "bg-amber-500/20 text-amber-300"
          }
        >
          {payment.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass border-primary/30">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-medium">Reconcile against your UPI statement</h2>
            <div>
              <p className="text-xs text-muted-foreground">LEOU payment id</p>
              <p className="font-mono text-lg font-bold tracking-wider">{payment.leouPayRef}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paying to</p>
              <p className="text-sm">
                {PAYMENT_CONFIG.payeeName} · <code>{PAYMENT_CONFIG.upiId}</code>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amount expected</p>
              <p className="text-lg font-bold">
                ₹{Number(payment.amountExpected ?? payment.request.amount ?? 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">How the student proved it</p>
              <p className="text-sm">
                {payment.method === "TRANSACTION_ID"
                  ? "Entered the transaction id by hand"
                  : payment.method === "SCREENSHOT"
                    ? "Uploaded a screenshot"
                    : "Scanned the confirmation with the camera"}
              </p>
            </div>
            {payment.transactionId && (
              <div>
                <p className="text-xs text-muted-foreground">Transaction id given</p>
                <p className="font-mono text-sm">{payment.transactionId}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-medium">Services being paid for</h2>
            {breakdown?.totals && (
              <div className="space-y-1 text-sm">
                {breakdown.perSubject?.map((s) => {
                  const line =
                    s.assignment.total + s.mock.total + s.test.total + (s.tutoring?.total ?? 0);
                  return (
                    <div key={s.subjectId} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {s.subjectName}
                        {s.assignment.total > 0 ? " · assignments" : ""}
                        {s.mock.total > 0 ? " · mocks" : ""}
                        {s.test.total > 0 ? " · tests" : ""}
                        {(s.tutoring?.total ?? 0) > 0 ? " · tutoring" : ""}
                      </span>
                      <span>₹{line.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between border-t border-border pt-1 font-bold">
                  <span>Total</span>
                  <span>₹{Number(breakdown.totals.grand).toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {payment.request.wantAssignments && <Badge variant="secondary">Assignments</Badge>}
              {payment.request.wantMockTests && <Badge variant="secondary">Mock tests</Badge>}
              {payment.request.wantRealTests && <Badge variant="secondary">Real tests</Badge>}
              {payment.request.wantTutoring && <Badge variant="secondary">Tutoring</Badge>}
            </div>
            <Link
              href={`/admin/students`}
              className="inline-flex items-center gap-1 pt-2 text-xs text-primary underline"
            >
              Open the student <ExternalLink className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {(payment.screenshotUrl || payment.cameraProofUrl) && (
        <Card className="glass">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-medium">Proof supplied by the student</h2>

            {check && (
              <div className="space-y-2">
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    check.hasMismatch
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  }`}
                >
                  {check.hasMismatch ? (
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {check.hasMismatch
                      ? "The scanned screen does not match the quotation. Check the details below before approving."
                      : "The scanned screen matches the quotation."}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {check.checks.map((c) => {
                    const Icon =
                      c.state === "match" ? CheckCircle2 : c.state === "mismatch" ? XCircle : CircleHelp;
                    const tone =
                      c.state === "match"
                        ? "text-emerald-600"
                        : c.state === "mismatch"
                          ? "text-destructive"
                          : "text-muted-foreground";
                    return (
                      <li key={c.field} className="flex items-start gap-2 text-xs">
                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
                        <span>
                          <span className="font-medium text-foreground">{c.label}</span>
                          {c.found && (
                            <span className="text-muted-foreground">
                              {" "}
                              — read <span className="font-mono">{c.found}</span>
                              {c.expected ? ` (expected ${c.expected})` : ""}
                            </span>
                          )}
                          <span className="block text-muted-foreground">{c.detail}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              {payment.cameraProofUrl && (
                <Proof url={payment.cameraProofUrl} label="Device screen as captured" />
              )}
              {payment.screenshotUrl && <Proof url={payment.screenshotUrl} label="Screenshot" />}
            </div>
            {payment.ocrText && (
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Text the scanner read
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                  {payment.ocrText}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {decided ? (
        <Card className="glass">
          <CardContent className="space-y-2 p-6">
            <h2 className="text-sm font-medium">Decision</h2>
            <p className="text-sm">
              {payment.status === "APPROVED"
                ? "Approved. The student's services are live."
                : "Rejected."}
            </p>
            {payment.decisionNote && (
              <p className="text-sm text-muted-foreground">Note to the student: {payment.decisionNote}</p>
            )}
            {payment.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {payment.attachments.map((a) => (
                  <a key={a.id} href={a.url} className="text-xs text-primary underline" target="_blank" rel="noreferrer">
                    attachment
                  </a>
                ))}
              </div>
            )}
            {payment.decidedAt && (
              <p className="text-xs text-muted-foreground">{payment.decidedAt.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <PaymentDecision paymentId={payment.id} />
      )}
    </div>
  );
}

function Proof({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-56 rounded-lg border border-border object-contain" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </a>
  );
}
