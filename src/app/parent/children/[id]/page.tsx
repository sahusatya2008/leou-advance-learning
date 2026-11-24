import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronRight,
  Wallet,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Activity,
  UserRound,
} from "lucide-react";

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

const LOGIN_LABEL: Record<string, string> = {
  LOGIN_PASSWORD: "Signed in with password",
  LOGIN_FACE: "Face login",
  LOGIN_ACCESS_CODE: "Access-code login",
  LOGIN_SUCCESS: "Login",
  LOGOUT: "Signed out",
  PARENT_LOGIN: "Parent signed in",
};

function fmtDate(v: Date | string) {
  return new Date(v).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtShortDate(v: Date | string) {
  return new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireRole("PARENT");
  const profile = user.parentProfile;
  if (!profile) notFound();
  const { id } = await params;

  const student = await prisma.studentProfile.findUnique({
    where: { userId: id },
    include: {
      user: { select: { id: true, username: true, email: true, status: true } },
      classRoom: { select: { name: true } },
      batches: { include: { batch: { select: { id: true, name: true } } } },
    },
  });

  if (!student || student.parentUserId !== profile.id) notFound();

  const [fees, requests, results, reports, practicals, recentActivity, finishedPracticals, batchNotices] =
    await Promise.all([
      prisma.paymentRecord.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } }),
      prisma.paymentRequest.findMany({
        where: { userId: student.user.id },
        orderBy: { submittedAt: "desc" },
        take: 50,
        select: {
          id: true,
          purpose: true,
          method: true,
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
      prisma.submission.findMany({
        where: { studentId: student.id, releasedAt: { not: null }, totalScore: { not: null } },
        include: { assessment: { select: { title: true, totalMarks: true } } },
        orderBy: { releasedAt: "desc" },
        take: 30,
      }),
      prisma.reportRecord.findMany({
        where: { studentId: student.id },
        orderBy: { releasedAt: "desc" },
        take: 30,
      }),
      prisma.practicalAttempt.findMany({
        where: { studentId: student.id },
        orderBy: { lastActivityAt: "desc" },
        take: 10,
        select: { status: true, language: true, lastActivityAt: true },
      }),
      prisma.activityLog.findMany({
        where: { userId: student.user.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, type: true, createdAt: true, ip: true },
      }),
      prisma.practicalAttempt.count({ where: { studentId: student.id, status: "FINISHED" } }),
      student.batches.length > 0
        ? prisma.notice.findMany({
            where: { batchId: { in: student.batches.map((b) => b.batch.id) } },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : [],
    ]);

  const paidTotal = fees.filter((f) => f.status === "PAID").reduce((n, f) => n + Number(f.amount), 0);
  const pendingTotal = fees.filter((f) => f.status !== "PAID").reduce((n, f) => n + Number(f.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/parent" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All students
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <UserRound className="h-6 w-6 text-primary" /> {student.fullName}
          </h1>
          <Badge
            variant={student.user.status === "ACTIVE" ? "success" : student.user.status === "SUSPENDED" ? "warning" : "destructive"}
          >
            {student.user.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          @{student.user.username} · {student.classRoom?.name ?? "No class"}
          {student.batches.length > 0 && ` · ${student.batches.map((b) => b.batch.name).join(", ")}`}
        </p>
      </div>

      {/* Fees */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" /> Fees
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Paid ₹{paidTotal.toLocaleString("en-IN")}</Badge>
            {pendingTotal > 0 && <Badge variant="warning">Due ₹{pendingTotal.toLocaleString("en-IN")}</Badge>}
            {fees.length === 0 && <span className="text-sm text-muted-foreground">No fee records on file.</span>}
          </div>
          {fees.length > 0 && (
            <div className="divide-y rounded-md border">
              {fees.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {fmtShortDate(f.dueDate)}
                      {f.paidAt ? ` · paid ${fmtShortDate(f.paidAt)}` : ""}
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
                      Submitted {fmtShortDate(r.submittedAt)}
                      {r.decidedAt ? ` · decided ${fmtShortDate(r.decidedAt)}` : ""}
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
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" /> Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No results released yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <div key={r.id} className="rounded-md border p-3">
                  <p className="truncate text-sm font-medium">{r.assessment.title}</p>
                  <p className="mt-2 text-xl font-bold">
                    {r.totalScore} <span className="text-sm font-normal text-muted-foreground">/ {r.assessment.totalMarks}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Released {fmtShortDate(r.releasedAt!)}{r.feedback ? ` · ${r.feedback}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{fmtShortDate(r.releasedAt)}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {JSON.stringify(r.summary).slice(0, 120)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Practicals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-primary" /> Practical work
          </CardTitle>
        </CardHeader>
        <CardContent>
          {practicals.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No practical sessions yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{practicals.length} session{practicals.length === 1 ? "" : "s"}</Badge>
                <Badge variant="secondary">{finishedPracticals} finished</Badge>
              </div>
              <div className="divide-y rounded-md border">
                {practicals.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground">{p.language ?? "—"} · {p.status}</span>
                    <span className="text-xs text-muted-foreground">Last {fmtShortDate(p.lastActivityAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {recentActivity.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>{LOGIN_LABEL[a.type] ?? a.type}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtDate(a.createdAt)}
                    {a.ip ? ` · ${a.ip}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch notices */}
      {batchNotices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Class notices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {batchNotices.map((n) => (
              <div key={n.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtShortDate(n.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Link href="/parent/activity" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          View all activity <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}