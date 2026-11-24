import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { kindBadge, statusStyle } from "@/lib/assessmentConstants";

export const dynamic = "force-dynamic";

export default async function GradingListPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      batch: { include: { classRoom: { select: { name: true } } } },
      questions: { select: { id: true, marks: true }, orderBy: { order: "asc" } },
      submissions: {
        include: {
          student: { select: { fullName: true } },
          _count: { select: { answers: true } },
        },
        orderBy: { submittedAt: "asc" },
      },
    },
  });
  if (!assessment) notFound();

  const totalAnswers = assessment.questions.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/assessments/${assessment.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {assessment.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{kindBadge(assessment.kind)}</Badge>
          <Badge className={statusStyle(assessment.status)}>{assessment.status.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <ClipboardCheck className="mr-2 inline h-6 w-6 text-primary" />
          Grading — {assessment.batch.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Open a submission to review answers, adjust auto-grades, and score descriptive questions.
        </p>
      </div>

      <Card className="glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Answered</TableHead>
              <TableHead className="w-24">Auto</TableHead>
              <TableHead className="w-24">Manual</TableHead>
              <TableHead className="w-24">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessment.submissions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No submissions yet.
                </TableCell>
              </TableRow>
            )}
            {assessment.submissions.map((s) => {
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/admin/assessments/${assessment.id}/grading/${s.id}`} className="font-medium hover:text-primary hover:underline">
                      {s.student.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "SUBMITTED" ? "secondary" : "default"}>{s.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {s._count.answers} / {totalAnswers}
                  </TableCell>
                  <TableCell className="text-sm">{s.autoScore || "—"}</TableCell>
                  <TableCell className="text-sm">{s.manualScore || "—"}</TableCell>
                  <TableCell className="text-sm font-semibold">{s.totalScore ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}