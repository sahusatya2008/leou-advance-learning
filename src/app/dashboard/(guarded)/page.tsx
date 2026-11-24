import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { getServiceState } from "@/services/onboardingService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanSummaryCard } from "@/components/student/PlanSummaryCard";
import {
  Layers,
  FlaskConical,
  Target,
  ChevronRight,
  Sparkles,
  ScrollText,
  CalendarClock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const { user } = await requireRole("STUDENT");
  const prof = user.studentProfile;

  const service = await getServiceState(user.id);

  const batches = prof
    ? await prisma.batch.findMany({
        where: { students: { some: { studentId: prof.id } } },
        include: {
          classRoom: true,
          subjects: { include: { subject: true } },
          _count: { select: { students: true } },
        },
      })
    : [];

  const [logs, payments, notices] = await Promise.all([
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.paymentRecord.findMany({
      where: { studentId: prof?.id ?? "" },
      orderBy: { dueDate: "asc" },
    }),
    prisma.notice.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const faceCount = Array.isArray(prof?.faceEmbeddings) ? prof.faceEmbeddings.length : 0;
  const enrolled = faceCount >= 3;

  const stats = [
    { icon: Layers, label: "Classes / batches", value: batches.length },
    { icon: FlaskConical, label: "Mock tests available", value: 0 },
    { icon: Target, label: "Pending payments", value: payments.filter((p) => p.status === "PENDING").length },
  ];

  return (
    <div className="space-y-8">
      {service && !service.active && !service.harderRedirect && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-amber-300" />
            <div>
              <p className="text-sm font-semibold">Your service period has lapsed</p>
              <p className="text-xs text-muted-foreground">
                Results and reports stay visible, but new attempts and class content are locked.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/onboarding">Renew my plan</Link>
          </Button>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-indigo-500/15 via-card to-cyan-500/15 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {prof?.fullName ?? user.username}, welcome back.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {prof?.classRoom?.name ?? "Class not set"} · {" "}
              {prof?.stream ?? "—"} stream · {prof?.schoolName ?? "School not set"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={enrolled ? "default" : "outline"}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Face {enrolled ? "enrolled" : `incomplete (${faceCount}/5)`}
            </Badge>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl bg-card/70 p-4">
              <s.icon className="h-5 w-5 text-indigo-300" />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">My classes</h2>
            <Link href="/dashboard/classes">
              <Button variant="ghost" size="sm">
                View all <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          {batches.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                You are not assigned to any batch yet. Ask your admin to add you to a batch.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {batches.map((batch) => (
                <Link key={batch.id} href={`/dashboard/classes/${batch.id}`}>
                  <Card className="glass h-full transition-colors hover:border-primary/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{batch.classRoom.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{batch.name}</span> · {" "}
                        {batch._count.students} students
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {batch.subjects.map((s) => (
                          <Badge key={s.subjectId} variant="secondary" className="text-xs">
                            {s.subject.name}
                          </Badge>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        Enter batch <ChevronRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <div>
            <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
            <Card className="glass">
              <CardContent className="space-y-2 p-5">
                {logs.length === 0 && (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                )}
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm">
                    <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Badge variant="secondary" className="font-mono text-xs">{log.type}</Badge>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {log.createdAt.toLocaleString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <PlanSummaryCard userId={user.id} />
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Notices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notices.length === 0 && (
                <p className="text-sm text-muted-foreground">No notices yet.</p>
              )}
              {notices.map((n) => (
                <div key={n.id} className="rounded-lg border border-border bg-card/60 px-4 py-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{n.createdAt.toLocaleDateString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}