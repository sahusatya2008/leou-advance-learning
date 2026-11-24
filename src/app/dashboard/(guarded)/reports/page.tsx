import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileText, TrendingUp, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;

  const [reports, released] = await Promise.all([
    profId ? prisma.reportRecord.findMany({ where: { studentId: profId }, orderBy: { releasedAt: "desc" }, take: 50 }) : [],
    profId
      ? prisma.submission.findMany({
          where: { studentId: profId, releasedAt: { not: null }, totalScore: { not: null } },
          include: {
            assessment: {
              include: { questions: { include: { question: { select: { subject: { select: { name: true } } } } } } },
            },
            answers: true,
          },
          orderBy: { releasedAt: "desc" },
        })
      : [],
  ]);

  const attempts = released.length;
  const avgPct = attempts
    ? Math.round((released.reduce((acc, r) => acc + (r.totalScore ?? 0), 0) / released.reduce((acc, r) => acc + r.assessment.totalMarks, 0)) * 100)
    : 0;
  const best = attempts ? Math.max(...released.map((r) => Math.round(((r.totalScore ?? 0) / r.assessment.totalMarks) * 100))) : 0;

  const bySubject = new Map<string, { got: number; max: number }>();
  for (const r of released) {
    const answerByAq = new Map(r.answers.map((a) => [a.assessmentQuestionId, a]));
    for (const aq of r.assessment.questions) {
      const ans = answerByAq.get(aq.id);
      const name = aq.question.subject?.name ?? "Other";
      const entry = bySubject.get(name) ?? { got: 0, max: 0 };
      entry.max += aq.marks;
      entry.got += ans?.marksAwarded ?? 0;
      bySubject.set(name, entry);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Your performance overview and report documents.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="glass">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assessments attempted</p>
              <p className="text-lg font-bold">{attempts}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Average score</p>
              <p className="text-lg font-bold">{avgPct}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Best score</p>
              <p className="text-lg font-bold">{best}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {bySubject.size > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" /> By subject
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...bySubject.entries()].map(([name, s]) => {
              const pct = s.max ? Math.round((s.got / s.max) * 100) : 0;
              return (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.got} / {s.max} · {pct}%
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
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Published reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No reports published yet. Progress reports are generated when teachers release results.
            </p>
          )}
          {reports.map((r) => {
            const s = r.summary as { totalScore?: number; totalMarks?: number; autoScore?: number; manualScore?: number; questionCount?: number; answeredCount?: number };
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{r.kind}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {s.totalScore != null && `${s.totalScore} / ${s.totalMarks ?? "—"} · auto ${s.autoScore ?? 0} + manual ${s.manualScore ?? 0}`}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Published {r.releasedAt.toLocaleDateString()}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}