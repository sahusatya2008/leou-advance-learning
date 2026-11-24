import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Users, CheckCircle2, Hourglass, Rocket, Timer, ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AssessmentStatusActions from "@/components/admin/assessments/AssessmentStatusActions";
import { kindBadge, statusStyle } from "@/lib/assessmentConstants";

export const dynamic = "force-dynamic";

export default async function EvaluationAttemptsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      batch: {
        include: {
          classRoom: { select: { name: true } },
          subjects: { include: { subject: { select: { id: true, name: true } } }, orderBy: { subject: { name: "asc" } } },
        },
      },
      _count: { select: { questions: true, submissions: true } },
    },
  });
  if (!assessment) notFound();

  const [submissions, roster] = await Promise.all([
    prisma.submission.findMany({
      where: { assessmentId: id },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.batchStudent.findMany({
      where: { batchId: assessment.batchId },
      include: { student: { include: { user: { select: { phone: true } } } } },
      orderBy: { student: { fullName: "asc" } },
    }),
  ]);

  const byStudent = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) byStudent.set(s.studentId, s);
  const rows = roster
    .map((bs) => ({ student: bs.student, submission: byStudent.get(bs.student.id) ?? null }))
    .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));

  const attempts = submissions.length;
  const inProgressCount = submissions.filter((s) => s.status === "IN_PROGRESS").length;
  const awaitingCount = submissions.filter((s) => s.status === "SUBMITTED").length;
  const evaluatedCount = submissions.filter((s) => s.totalScore != null).length;
  const releasedCount = submissions.filter((s) => s.releasedAt != null).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/evaluation" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Evaluation dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <AssessmentStatusActions
            assessmentId={assessment.id}
            status={assessment.status}
            submissionsCount={attempts}
            hasStartTime={!!assessment.startsAt}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{assessment.title}</h1>
          <Badge variant="outline">{kindBadge(assessment.kind)}</Badge>
          <Badge className={statusStyle(assessment.status)}>{assessment.status.replace(/_/g, " ")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {assessment.batch.name} · {assessment.batch.classRoom.name}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {assessment.batch.subjects.map((s) => (
            <Badge key={s.subject.id} variant="secondary" className="text-xs">{s.subject.name}</Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} tone="cyan" label="Attempted by" value={`${attempts} / ${rows.length} students`} />
        <StatCard icon={<Hourglass className="h-5 w-5" />} tone="indigo" label="In progress" value={String(inProgressCount)} />
        <StatCard icon={<ListChecks className="h-5 w-5" />} tone="amber" label="Awaiting evaluation" value={String(awaitingCount)} />
        <StatCard icon={<Rocket className="h-5 w-5" />} tone="emerald" label="Evaluated · released" value={`${evaluatedCount} · ${releasedCount}`} />
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4" /> Students — {assessment.batch.name}
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Attempt</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-24">Score</TableHead>
              <TableHead className="w-28 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No students are assigned to this batch yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ student, submission }) => (
              <TableRow key={student.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {student.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{student.fullName}</p>
                      <p className="text-xs text-muted-foreground">{student.user?.phone ?? "—"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{attemptBadge(submission)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {submission ? submission.startedAt.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {submission?.submittedAt ? submission.submittedAt.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {submission ? (
                    submission.totalScore != null ? (
                      <span className="font-semibold">
                        {submission.totalScore} <span className="font-normal text-muted-foreground">/ {assessment.totalMarks}</span>
                      </span>
                    ) : submission.autoScore ? (
                      <span>{submission.autoScore} auto</span>
                    ) : (
                      "—"
                    )
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {submission && submission.status !== "IN_PROGRESS" ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/evaluation/assessments/${assessment.id}/evaluate/${submission.id}`}>
                        <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                        {submission.status === "SUBMITTED" ? "Evaluate" : "Review"}
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {submission ? (
                        <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" /> Awaiting submit</span>
                      ) : (
                        "Not attempted"
                      )}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function attemptBadge(submission: { status: string; releasedAt: Date | null } | null) {
  if (!submission) return <Badge variant="outline">Not attempted</Badge>;
  if (submission.status === "IN_PROGRESS") return <Badge className="bg-amber-500/15 text-amber-300">In progress</Badge>;
  if (submission.releasedAt) return <Badge className="bg-emerald-500/15 text-emerald-300">Released</Badge>;
  if (submission.status === "SUBMITTED") return <Badge className="bg-sky-500/15 text-sky-300">Submitted · pending</Badge>;
  if (submission.status === "EVALUATED") return <Badge className="bg-violet-500/15 text-violet-300">Evaluated</Badge>;
  return <Badge variant="secondary">{submission.status.replace(/_/g, " ")}</Badge>;
}

function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "cyan" | "indigo" | "amber" | "emerald";
  label: string;
  value: string;
}) {
  const tones: Record<string, string> = {
    cyan: "bg-cyan-500/20 text-cyan-300",
    indigo: "bg-indigo-500/20 text-indigo-300",
    amber: "bg-amber-500/20 text-amber-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
  };
  return (
    <Card className="glass">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}