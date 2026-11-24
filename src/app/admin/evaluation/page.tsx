import Link from "next/link";
import { ClipboardCheck, ArrowRight, ListChecks, Users, Hourglass, Rocket, FolderOpen, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { kindBadge, statusStyle } from "@/lib/assessmentConstants";
import type { AssessmentKind } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const KIND_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "ASSIGNMENT", label: "Assignments" },
  { value: "MOCK", label: "Mock tests" },
  { value: "TEST", label: "Tests" },
];

export default async function EvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const selected = ["ASSIGNMENT", "MOCK", "TEST"].includes(kind ?? "") ? (kind as AssessmentKind) : undefined;

  const [classes, rawAssessments] = await Promise.all([
    prisma.classRoom.findMany({
      include: {
        batches: { where: { isActive: true }, include: { _count: { select: { students: true } } }, orderBy: { name: "asc" } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.assessment.findMany({
      where: selected ? { kind: selected } : {},
      include: {
        batch: { select: { id: true, name: true, classRoomId: true, isActive: true } },
        _count: { select: { questions: true } },
        submissions: { select: { status: true, totalScore: true, releasedAt: true }, orderBy: { startedAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const assessmentsByBatch = new Map<string, (typeof rawAssessments)[number][]>();
  for (const a of rawAssessments) {
    if (!a.batch.isActive) continue;
    const list = assessmentsByBatch.get(a.batch.id);
    if (list) list.push(a);
    else assessmentsByBatch.set(a.batch.id, [a]);
  }

  let totalAssessments = 0;
  let totalAttempts = 0;
  let totalPending = 0;
  let totalReleased = 0;
  for (const a of rawAssessments) {
    if (!a.batch.isActive) continue;
    totalAssessments += 1;
    totalAttempts += a.submissions.length;
    totalPending += a.submissions.filter((s) => s.status === "SUBMITTED").length;
    totalReleased += a.submissions.filter((s) => s.releasedAt != null).length;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="h-6 w-6 text-primary" /> Evaluation
          </h1>
          <p className="text-sm text-muted-foreground">
            Evaluate assignments, mocks and tests — grouped by class and batch, attempt by attempt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {KIND_FILTERS.map((f) => {
            const active = (f.value || undefined) === (selected || undefined);
            return (
              <Link
                key={f.value}
                href={f.value ? `/admin/evaluation?kind=${f.value}` : "/admin/evaluation"}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon={<ListChecks className="h-5 w-5" />} tone="indigo" label="Assessments" value={String(totalAssessments)} />
        <SummaryCard icon={<Users className="h-5 w-5" />} tone="cyan" label="Attempts" value={String(totalAttempts)} />
        <SummaryCard icon={<Hourglass className="h-5 w-5" />} tone="amber" label="Awaiting evaluation" value={String(totalPending)} />
        <SummaryCard icon={<Rocket className="h-5 w-5" />} tone="emerald" label="Results released" value={String(totalReleased)} />
      </div>

      {classes.length === 0 && (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Inbox className="h-10 w-10" />
            <p className="text-sm">
              {selected ? "No assessments of this kind yet." : "No assessments yet. Create one from the Assessments page."}
            </p>
          </CardContent>
        </Card>
      )}

      {classes.map((c) => {
        const batchesWithWork = c.batches.filter((b) => (assessmentsByBatch.get(b.id)?.length ?? 0) > 0);
        if (batchesWithWork.length === 0) return null;
        return (
          <section key={c.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{c.name}</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {batchesWithWork.map((b) => {
                const list = assessmentsByBatch.get(b.id) ?? [];
                return (
                  <Card key={b.id} className="glass">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>{b.name}</span>
                        <Badge variant="secondary" className="gap-1.5">
                          <Users className="h-3 w-3" /> {b._count.students} students
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {list.map((a) => {
                        const attempted = a.submissions.length;
                        const evaluated = a.submissions.filter((s) => s.totalScore != null).length;
                        const pending = attempted - evaluated;
                        const pct = attempted ? Math.round((evaluated / attempted) * 100) : 0;
                        return (
                          <div key={a.id} className="rounded-xl border border-border bg-card/40 p-3.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{kindBadge(a.kind)}</Badge>
                                  <Badge className={statusStyle(a.status)}>{a.status.replace(/_/g, " ")}</Badge>
                                </div>
                                <p className="mt-1.5 truncate text-sm font-semibold">{a.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {a._count.questions} questions · {attempted} attempt(s) · {pending} pending
                                </p>
                              </div>
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/admin/evaluation/assessments/${a.id}`}>
                                  See attempts <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </div>
                            {attempted > 0 && (
                              <div className="mt-3 space-y-1">
                                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                                  <div
                                    className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {evaluated} of {attempted} evaluated ({pct}%)
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "indigo" | "cyan" | "amber" | "emerald";
  label: string;
  value: string;
}) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-500/20 text-indigo-300",
    cyan: "bg-cyan-500/20 text-cyan-300",
    amber: "bg-amber-500/20 text-amber-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
  };
  return (
    <Card className="glass">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}