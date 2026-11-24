import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const REQUEST_STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  APPROVED: "success",
  SUBMITTED: "warning",
  REJECTED: "destructive",
  SUPERSEDED: "secondary",
};

const FEE_STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  PAID: "success",
  OVERDUE: "destructive",
  PENDING: "warning",
};

function fmtDate(v: Date | string) {
  return new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ParentFeesPage() {
  const { user } = await requireRole("PARENT");
  const profile = user.parentProfile;

  const students = profile
    ? await prisma.studentProfile.findMany({
        where: { parentUserId: profile.id },
        include: { user: { select: { id: true, username: true } } },
        orderBy: { fullName: "asc" },
      })
    : [];

  const rows = await Promise.all(
    students.map(async (s) => {
      const [fees, requests] = await Promise.all([
        prisma.paymentRecord.findMany({ where: { studentId: s.id }, orderBy: { dueDate: "asc" } }),
        prisma.paymentRequest.findMany({
          where: { userId: s.user.id },
          orderBy: { submittedAt: "desc" },
          take: 50,
          select: {
            id: true,
            purpose: true,
            leouPayRef: true,
            transactionId: true,
            status: true,
            decisionNote: true,
            decidedAt: true,
            amountExpected: true,
            submittedAt: true,
            request: { select: { amount: true } },
          },
        }),
      ]);
      return { s, fees, requests };
    }),
  );

  const totalPaid = rows.reduce(
    (n, r) => n + r.fees.filter((f) => f.status === "PAID").reduce((m, f) => m + Number(f.amount), 0),
    0,
  );
  const totalDue = rows.reduce(
    (n, r) => n + r.fees.filter((f) => f.status !== "PAID").reduce((m, f) => m + Number(f.amount), 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" /> Fees
        </h1>
        <p className="text-sm text-muted-foreground">Fee records and payment confirmations across all linked students.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="success" className="px-3 py-1.5 text-sm">
          Paid ₹{totalPaid.toLocaleString("en-IN")}
        </Badge>
        {totalDue > 0 && (
          <Badge variant="warning" className="px-3 py-1.5 text-sm">
            Due ₹{totalDue.toLocaleString("en-IN")}
          </Badge>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No students linked yet, so there are no fees to show.
          </CardContent>
        </Card>
      ) : (
        rows.map(({ s, fees, requests }) => {
          const paid = fees.filter((f) => f.status === "PAID").reduce((n, f) => n + Number(f.amount), 0);
          const due = fees.filter((f) => f.status !== "PAID").reduce((n, f) => n + Number(f.amount), 0);
          return (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg">{s.fullName}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="success">Paid ₹{paid.toLocaleString("en-IN")}</Badge>
                    {due > 0 && <Badge variant="warning">Due ₹{due.toLocaleString("en-IN")}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {fees.length === 0 && requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing on record.</p>
                ) : null}

                {fees.length > 0 && (
                  <div className="divide-y rounded-md border">
                    {fees.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{f.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Due {fmtDate(f.dueDate)}
                            {f.paidAt ? ` · paid ${fmtDate(f.paidAt)}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-semibold">₹{Number(f.amount).toLocaleString("en-IN")}</span>
                          <Badge variant={FEE_STATUS_VARIANT[f.status] ?? "secondary"}>{f.status}</Badge>
                          {f.receiptUrl && (
                            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                              <a href={f.receiptUrl} target="_blank" rel="noreferrer">
                                Receipt
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {requests.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Payment confirmations
                    </p>
                    <div className="divide-y rounded-md border">
                      {requests.map((r) => (
                        <div key={r.id} className="px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate font-medium">{r.purpose}</span>
                            <Badge variant={REQUEST_STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ₹{Number(r.amountExpected ?? r.request?.amount ?? 0).toLocaleString("en-IN")}
                            {r.leouPayRef ? ` · ${r.leouPayRef}` : ""}
                            {r.transactionId ? ` · ${r.transactionId}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Submitted {fmtDate(r.submittedAt)}
                            {r.decidedAt ? ` · decided ${fmtDate(r.decidedAt)}` : ""}
                          </p>
                          {r.decisionNote && (
                            <p className="mt-0.5 rounded bg-amber-500/10 px-2 py-1 text-xs text-muted-foreground">
                              Admin note: {r.decisionNote}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link href={`/parent/children/${s.user.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  Full details <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}