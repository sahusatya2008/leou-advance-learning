import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";

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

export default async function ParentPaymentsPage() {
  const { user } = await requireRole("PARENT");
  const profile = user.parentProfile;

  const students = profile
    ? await prisma.studentProfile.findMany({
        where: { parentUserId: profile.id },
        include: { user: { select: { id: true, username: true } }, classRoom: { select: { name: true } } },
        orderBy: { fullName: "asc" },
      })
    : [];

  const children = await Promise.all(
    students.map(async (s) => {
      const [payments, history, payable] = await Promise.all([
        prisma.paymentRecord.findMany({ where: { studentId: s.id }, orderBy: { dueDate: "asc" } }),
        prisma.paymentRequest.findMany({
          where: { userId: s.user.id },
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
        }),
        prisma.onboardingRequest.findMany({
          where: { userId: s.user.id, status: { in: ["REQUESTED", "BILLED"] } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, amount: true, leouPayRef: true, updatedAt: true },
        }),
      ]);
      return { s, payments, history, payable };
    }),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" /> Payments
        </h1>
        <p className="text-sm text-muted-foreground">
          Fee records, due dates and every payment your children have made, with its verification result.
        </p>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No students linked yet.
          </CardContent>
        </Card>
      ) : (
        children.map(({ s, payments, history, payable }) => {
          const paidTotal = payments.filter((p) => p.status === "PAID").reduce((n, p) => n + Number(p.amount), 0);
          const dueTotal = payments.filter((p) => p.status !== "PAID").reduce((n, p) => n + Number(p.amount), 0);
          const verifiedTotal = history
            .filter((h) => h.status === "APPROVED")
            .reduce((sum, h) => sum + Number(h.amountExpected ?? h.request?.amount ?? 0), 0);
          return (
            <section key={s.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="text-lg font-semibold">{s.fullName}</h2>
                  <p className="text-xs text-muted-foreground">
                    @{s.user.username} · {s.classRoom?.name ?? "No class"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">Paid ₹{paidTotal.toFixed(0)}</Badge>
                  {dueTotal > 0 && <Badge variant="warning">Due ₹{dueTotal.toFixed(0)}</Badge>}
                  <Badge variant="outline">Verified ₹{verifiedTotal.toFixed(2)}</Badge>
                </div>
              </div>

              {payable.length > 0 && (
                <Card className="glass border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Service requests awaiting payment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {payable.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                        <span className="text-muted-foreground">
                          {r.leouPayRef ? `Reference ${r.leouPayRef}` : "No payment reference yet."}
                        </span>
                        <span className="font-semibold">₹{Number(r.amount ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Your child pays for these from their own panel; the services activate once the admin verifies the payment.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="glass">
                  <CardContent className="flex items-center gap-3 p-5">
                    <Clock className="h-6 w-6 text-amber-300" />
                    <div>
                      <p className="text-2xl font-bold">{payments.filter((p) => p.status === "PENDING").length}</p>
                      <p className="text-xs text-muted-foreground">Pending fee records</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass">
                  <CardContent className="flex items-center gap-3 p-5">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    <div>
                      <p className="text-2xl font-bold">{payments.filter((p) => p.status === "PAID").length}</p>
                      <p className="text-xs text-muted-foreground">Paid fee records</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fee records yet.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <Card key={p.id} className="glass">
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
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
              )}

              {history.length > 0 && (
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Payment history</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {history.map((p) => {
                      const amount = Number(p.amountExpected ?? p.request?.amount ?? 0);
                      return (
                        <div key={p.id} className="rounded-lg border border-border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {statusBadge(p.status)}
                              <span className="text-sm font-medium">{PURPOSE_LABEL[p.purpose] ?? p.purpose}</span>
                              {p.leouPayRef && (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {p.leouPayRef}
                                </Badge>
                              )}
                            </div>
                            <span className="font-semibold">₹{amount.toFixed(2)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Paid {p.submittedAt.toLocaleDateString()}
                            {p.decidedAt && ` · Decided ${p.decidedAt.toLocaleDateString()}`}
                            {" · "}
                            {METHOD_LABEL[p.method] ?? p.method}
                            {p.transactionId && ` · Txn ${p.transactionId}`}
                          </p>
                          {p.decisionNote && <p className="text-xs text-muted-foreground">Admin note: {p.decisionNote}</p>}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
