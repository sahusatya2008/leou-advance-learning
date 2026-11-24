import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, CalendarRange, ListChecks, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AssessmentForm from "@/components/admin/assessments/AssessmentForm";
import AssessmentStatusActions from "@/components/admin/assessments/AssessmentStatusActions";
import { kindBadge, statusStyle } from "@/lib/assessmentConstants";
import { durationLabel } from "@/lib/assessmentTime";

export const dynamic = "force-dynamic";

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [assessment, classesWithBatches] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id },
      include: {
        batch: { include: { classRoom: { select: { id: true, name: true } } } },
        subject: { select: { id: true, name: true } },
        questions: {
          include: {
            question: {
              include: {
                options: { orderBy: { sortOrder: "asc" } },
                subject: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { order: "asc" },
        },
        submissions: {
          include: {
            student: { select: { id: true, userId: true, fullName: true } },
            _count: { select: { answers: true } },
          },
          orderBy: { submittedAt: "asc" },
        },
      },
    }),
    prisma.classRoom.findMany({
      include: {
        subjects: { include: { subject: { select: { id: true, name: true } } }, orderBy: { subject: { name: "asc" } } },
        batches: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          include: {
            subjects: { include: { subject: { select: { id: true, name: true } } } },
            pricingItems: { select: { subjectId: true, name: true, assignmentRate: true, mockRate: true, testRate: true } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!assessment) notFound();

  const formClasses = classesWithBatches.map((c) => ({
    id: c.id,
    name: c.name,
    subjects: c.subjects.map((s) => ({ id: s.subject.id, name: s.subject.name })),
  }));
  const batches = classesWithBatches.flatMap((c) =>
    c.batches.map((b) => ({
      id: b.id,
      name: b.name,
      classRoom: { id: c.id, name: c.name },
      subjects: b.subjects.map((bs) => ({
        id: bs.subjectId,
        name: bs.subject.name,
        topics: b.pricingItems
          .filter((p) => p.subjectId === bs.subjectId)
          .map((p) => ({
            name: p.name,
            assignmentRate: Number(p.assignmentRate),
            mockRate: Number(p.mockRate),
            testRate: Number(p.testRate),
          })),
      })),
    }))
  );

  const proctoring = assessment.proctoring as
    | { webcamOn?: boolean; fullscreenLock?: boolean; blockPaste?: boolean; maxTabSwitches?: number }
    | null
    | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/assessments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to assessments
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <AssessmentForm
            classes={formClasses}
            batches={batches}
            initial={{
              id: assessment.id,
              batchId: assessment.batchId,
              kind: assessment.kind,
              subjectId: assessment.subjectId ?? undefined,
              topic: assessment.topic ?? undefined,
              attemptMode: assessment.attemptMode,
              maxAttempts: assessment.maxAttempts,
              title: assessment.title,
              instructions: assessment.instructions ?? undefined,
              durationMinutes: assessment.durationMinutes,
              startsAt: assessment.startsAt?.toISOString().slice(0, 16) ?? undefined,
              endsAt: assessment.endsAt?.toISOString().slice(0, 16) ?? undefined,
              shuffleQuestions: assessment.shuffleQuestions,
              proctoring: proctoring ?? undefined,
              questions: assessment.questions.map((aq) => ({
                questionId: aq.questionId,
                marks: aq.marks,
                stem: aq.question.stem,
                type: aq.question.type,
                subject: aq.question.subject.name,
              })),
            }}
            trigger={
              ["DRAFT", "SCHEDULED"].includes(assessment.status) ||
              (assessment.attemptMode === "FLEXIBLE" && assessment.status === "RELEASED" && assessment.submissions.length === 0) ? (
                <Button size="sm" variant="outline">Edit</Button>
              ) : undefined
            }
          />
          <AssessmentStatusActions
            assessmentId={assessment.id}
            status={assessment.status}
            submissionsCount={assessment.submissions.length}
            hasStartTime={!!assessment.startsAt}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{assessment.title}</h1>
          <Badge variant="outline">{kindBadge(assessment.kind)}</Badge>
          <Badge className={statusStyle(assessment.status)}>{assessment.status.replace(/_/g, " ")}</Badge>
          <Badge variant={assessment.attemptMode === "FLEXIBLE" ? "default" : "outline"}>
            {assessment.attemptMode === "FLEXIBLE" ? `Flexible${assessment.maxAttempts ? ` · ${assessment.maxAttempts} tries` : " · unlimited tries"}` : "Scheduled · 1 attempt"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {assessment.batch.name} · {assessment.batch.classRoom.name}
          {assessment.subject?.name ? ` · ${assessment.subject.name}${assessment.topic ? ` — ${assessment.topic}` : ""}` : ""}
        </p>
        {assessment.instructions && (
          <p className="max-w-3xl text-sm text-muted-foreground">{assessment.instructions}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<ListChecks className="h-4 w-4" />} label="Questions / Total marks" value={`${assessment.questions.length} / ${assessment.totalMarks}`} />
        <Stat icon={<Clock className="h-4 w-4" />} label="Duration" value={durationLabel(assessment.durationMinutes)} />
        <Stat icon={<CalendarRange className="h-4 w-4" />} label="Window" value={assessment.startsAt ? `${fmt(assessment.startsAt)} → ${assessment.endsAt ? fmt(assessment.endsAt) : "open"}` : "Open on publish"} />
        <Stat icon={<Users className="h-4 w-4" />} label="Submissions" value={`${assessment.submissions.length}`} />
      </div>

      {assessment.kind === "TEST" && proctoring && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Proctoring</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            <Badge variant={proctoring.webcamOn ? "default" : "outline"}>Webcam {proctoring.webcamOn ? "on" : "off"}</Badge>
            <Badge variant={proctoring.fullscreenLock ? "default" : "outline"}>Fullscreen lock {proctoring.fullscreenLock ? "on" : "off"}</Badge>
            <Badge variant={proctoring.blockPaste ? "default" : "outline"}>Block paste {proctoring.blockPaste ? "on" : "off"}</Badge>
            <Badge variant="outline">Max tab switches: {proctoring.maxTabSwitches ?? 3}</Badge>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Questions</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-20">Marks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessment.questions.map((aq, i) => (
              <TableRow key={aq.id}>
                <TableCell className="text-sm text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="max-w-[420px]">
                  <p className="line-clamp-2 text-sm">{aq.question.stem}</p>
                  {aq.question.type === "MCQ" && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {aq.question.options.filter((o) => o.isCorrect).length} correct of {aq.question.options.length}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm">{aq.question.type}</TableCell>
                <TableCell className="text-sm">{aq.question.subject.name}</TableCell>
                <TableCell className="text-sm">{aq.marks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Submissions</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessment.submissions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No submissions yet.
                </TableCell>
              </TableRow>
            )}
            {assessment.submissions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-sm">
                  <Link href={`/admin/assessments/${assessment.id}/grading/${s.id}`} className="font-medium hover:text-primary hover:underline">
                    {s.student.fullName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === "IN_PROGRESS" ? "secondary" : "default"}>{s.status.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell className="text-sm">{s.startedAt.toISOString().slice(0, 16)}</TableCell>
                <TableCell className="text-sm">{s.submittedAt ? s.submittedAt.toISOString().slice(0, 16) : "—"}</TableCell>
                <TableCell className="text-sm">
                  {s.totalScore != null ? `${s.totalScore} / ${assessment.totalMarks}` : s.autoScore ? `${s.autoScore} auto` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="glass">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}