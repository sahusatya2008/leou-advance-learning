import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, ClipboardCheck, GraduationCap, Activity, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

const LOG_LABEL: Record<string, string> = {
  LOGIN_PASSWORD: "Signed in with password",
  LOGIN_FACE: "Face login",
  LOGIN_ACCESS_CODE: "Access-code login",
  LOGIN_SUCCESS: "Login",
  LOGIN_PASSWORD_FAIL: "Failed password login",
  LOGIN_FACE_FAIL: "Failed face login",
  LOGOUT: "Signed out",
  ADMIN_UPDATE_STUDENT: "Profile updated",
  FACE_ENROLL: "Face enrolled",
  ATTEMPT_START: "Started an assessment",
  ATTEMPT_SUBMIT: "Submitted an assessment",
  PRACTICAL_START: "Started practical work",
  PRACTICAL_SUBMIT: "Finished practical work",
  PRACTICAL_DOUBT: "Raised a practical doubt",
  PAYMENT_SUBMIT: "Submitted a payment",
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

export default async function ParentProgressPage() {
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
      const [submissions, practicals, logs] = await Promise.all([
        prisma.submission.findMany({
          where: { studentId: s.id, releasedAt: { not: null }, totalScore: { not: null } },
          include: {
            assessment: {
              select: {
                title: true,
                totalMarks: true,
                questions: {
                  select: { id: true, marks: true, question: { select: { subject: { select: { name: true } } } } },
                },
              },
            },
            answers: { select: { assessmentQuestionId: true, marksAwarded: true } },
          },
          orderBy: { releasedAt: "desc" },
          take: 60,
        }),
        prisma.practicalAttempt.findMany({
          where: { studentId: s.id },
          orderBy: { lastActivityAt: "desc" },
          take: 20,
          select: { status: true, language: true, lastActivityAt: true, startedAt: true },
        }),
        prisma.activityLog.findMany({
          where: { userId: s.user.id },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { id: true, type: true, createdAt: true },
        }),
      ]);

      const releasedMarks = submissions.reduce((n, x) => n + (x.totalScore ?? 0), 0);
      const releasedMax = submissions.reduce((n, x) => n + x.assessment.totalMarks, 0);
      const avgPct = releasedMax ? Math.round((releasedMarks / releasedMax) * 100) : 0;
      const bestPct = submissions.length
        ? Math.round(
            Math.max(...submissions.map((x) => (x.totalScore! / x.assessment.totalMarks) * 100 || 0)),
          )
        : 0;

      const bySubject = new Map<string, { got: number; max: number }>();
      for (const r of submissions) {
        const answerByAq = new Map(r.answers.map((a) => [a.assessmentQuestionId, a]));
        for (const aq of r.assessment.questions) {
          const name = aq.question.subject?.name ?? "Other";
          const entry = bySubject.get(name) ?? { got: 0, max: 0 };
          entry.max += aq.marks;
          entry.got += answerByAq.get(aq.id)?.marksAwarded ?? 0;
          bySubject.set(name, entry);
        }
      }

      return { s, submissions, practicals, logs, avgPct, bestPct, bySubject };
    }),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LineChart className="h-6 w-6 text-primary" /> Progress
        </h1>
        <p className="text-sm text-muted-foreground">
          Performance across released results, practical work tracking and a full activity trail for each child.
        </p>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No students linked yet.
          </CardContent>
        </Card>
      ) : (
        children.map(({ s, submissions, practicals, logs, avgPct, bestPct, bySubject }) => {
          const finished = practicals.filter((p) => p.status === "FINISHED").length;
          return (
            <section key={s.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="text-lg font-semibold">{s.fullName}</h2>
                  <p className="text-xs text-muted-foreground">
                    @{s.user.username} · {s.classRoom?.name ?? "No class"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Results released" value={String(submissions.length)} icon={<ClipboardCheck className="h-5 w-5" />} tone="indigo" />
                <Stat label="Average score" value={`${avgPct}%`} icon={<Trophy className="h-5 w-5" />} tone="emerald" />
                <Stat label="Best score" value={`${bestPct}%`} icon={<Trophy className="h-5 w-5" />} tone="cyan" />
              </div>

              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Performance by subject</CardTitle>
                </CardHeader>
                <CardContent>
                  {bySubject.size === 0 ? (
                    <p className="text-sm text-muted-foreground">No released results yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {[...bySubject.entries()].map(([name, sub]) => {
                        const pct = sub.max ? Math.round((sub.got / sub.max) * 100) : 0;
                        return (
                          <div key={name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{name}</span>
                              <span className="text-xs text-muted-foreground">
                                {sub.got} / {sub.max} · {pct}%
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-secondary">
                              <div
                                className={`h-full rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GraduationCap className="h-4 w-4 text-primary" /> Work tracking (practicals)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="secondary">{practicals.length} session{practicals.length === 1 ? "" : "s"}</Badge>
                      <Badge variant="secondary">{finished} finished</Badge>
                    </div>
                    {practicals.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No practical sessions yet.</p>
                    ) : (
                      <div className="divide-y rounded-md border">
                        {practicals.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span className="text-xs text-muted-foreground">{p.language ?? "—"} · {p.status}</span>
                            <span className="text-xs text-muted-foreground">Last {fmtDate(p.lastActivityAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-primary" /> Activity log
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {logs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
                    ) : (
                      <div className="divide-y rounded-md border">
                        {logs.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <span>{LOG_LABEL[a.type] ?? a.type}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(a.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "indigo" | "emerald" | "cyan";
}) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-500/20 text-indigo-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
    cyan: "bg-cyan-500/20 text-cyan-300",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}
