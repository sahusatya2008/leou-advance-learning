import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, GraduationCap, HeartHandshake, Megaphone, ShieldCheck, Wallet, ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const LOGIN_TYPES = ["LOGIN_PASSWORD", "LOGIN_ACCESS_CODE", "LOGIN_FACE", "LOGIN_SUCCESS", "LOGOUT"] as const;

export default async function ParentHomePage() {
  const { user } = await requireRole("PARENT");
  const profile = user.parentProfile;

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HeartHandshake className="h-6 w-6 text-primary" /> Parent panel
        </h1>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Your parent profile is still being set up. Ask the admin to link your students.
          </CardContent>
        </Card>
      </div>
    );
  }

  const students = await prisma.studentProfile.findMany({
    where: { parentUserId: profile.id },
    include: {
      user: { select: { id: true, username: true, status: true } },
      classRoom: { select: { id: true, name: true } },
      batches: { include: { batch: { select: { id: true, name: true } } } },
    },
    orderBy: { fullName: "asc" },
  });

  const notices = await prisma.notice.findMany({
    where: { batchId: null },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const childCards = await Promise.all(
    students.map(async (s) => {
      const [fees, paid, pending, activations, results, practicals, lastLogin] = await Promise.all([
        prisma.paymentRecord.findMany({ where: { studentId: s.id }, orderBy: { dueDate: "asc" } }),
        prisma.paymentRecord.aggregate({ where: { studentId: s.id, status: "PAID" }, _sum: { amount: true } }),
        prisma.paymentRecord.aggregate({ where: { studentId: s.id, status: { in: ["PENDING", "OVERDUE"] } }, _sum: { amount: true } }),
        prisma.serviceActivation.count({ where: { userId: s.user.id, expiresAt: { gt: new Date() } } }),
        prisma.submission.count({ where: { studentId: s.id, releasedAt: { not: null }, totalScore: { not: null } } }),
        prisma.practicalAttempt.count({ where: { studentId: s.id } }),
        prisma.activityLog.findFirst({
          where: { userId: s.user.id, type: { in: [...LOGIN_TYPES] } },
          orderBy: { createdAt: "desc" },
          select: { type: true, createdAt: true },
        }),
      ]);
      return { s, fees, paid: Number(paid._sum.amount ?? 0), pending: Number(pending._sum.amount ?? 0), activations, results, practicals, lastLogin };
    }),
  );

  const totalOutstanding = childCards.reduce((n, c) => n + Number(c.pending), 0);
  const totalPaid = childCards.reduce((n, c) => n + Number(c.paid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HeartHandshake className="h-6 w-6 text-primary" /> {profile.fullName || user.username}
        </h1>
        <p className="text-sm text-muted-foreground">
          Progress, fees and activity for the {students.length} student{students.length === 1 ? "" : "s"} linked to you.
        </p>
      </div>

      {totalPaid > 0 || totalOutstanding > 0 ? (
        <div className="flex flex-wrap gap-3">
          <Badge variant="success" className="px-3 py-1.5 text-sm">
            <Wallet className="mr-1.5 h-3.5 w-3.5" /> Paid ₹{totalPaid.toLocaleString("en-IN")}
          </Badge>
          {totalOutstanding > 0 && (
            <Badge variant="warning" className="px-3 py-1.5 text-sm">
              Outstanding ₹{totalOutstanding.toLocaleString("en-IN")}
            </Badge>
          )}
        </div>
      ) : null}

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No students linked yet. Ask the admin to link your students.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {childCards.map(({ s, fees, paid, pending, activations, results, practicals, lastLogin }) => (
            <Card key={s.id} className="glass">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{s.fullName}</CardTitle>
                  <Badge
                    variant={s.user.status === "ACTIVE" ? "success" : s.user.status === "SUSPENDED" ? "warning" : "destructive"}
                  >
                    {s.user.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  @{s.user.username} · {s.classRoom?.name ?? "No class"}
                  {s.batches.length > 0 && ` · ${s.batches.map((b) => b.batch.name).join(", ")}`}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <b>{activations}</b> active service{activations === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ClipboardCheck className="h-4 w-4 text-cyan-300" />
                    <b>{results}</b> result{results === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-indigo-300" />
                    <b>{practicals}</b> practical{+practicals === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    {lastLogin
                      ? `Last login ${new Date(lastLogin.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                      : "No recent logins"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 border-t pt-3 text-xs">
                  <Badge variant="success">{fees.filter((f) => f.status === "PAID").length} paid · ₹{Number(paid).toLocaleString("en-IN")}</Badge>
                  {pending > 0 && (
                    <Badge variant="warning">
                      {pending} due · ₹{Number(pending).toLocaleString("en-IN")}
                    </Badge>
                  )}
                  {fees.length === 0 && <span className="text-muted-foreground">No fee records yet</span>}
                </div>

                <Link href={`/parent/children/${s.user.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Full details <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {notices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" /> Notices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notices.map((n) => (
              <div key={n.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}