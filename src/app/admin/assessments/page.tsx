import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import AssessmentForm from "@/components/admin/assessments/AssessmentForm";
import { kindBadge, statusStyle } from "@/lib/assessmentConstants";
import type { AssessmentKind, AssessmentStatus } from "@/generated/prisma/enums";
import { durationLabel } from "@/lib/assessmentTime";

export const dynamic = "force-dynamic";

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string; batchId?: string }>;
}) {
  const { kind, status, batchId } = await searchParams;

  const [assessments, classesWithBatches] = await Promise.all([
    prisma.assessment.findMany({
      where: {
        ...(kind ? { kind: kind as AssessmentKind } : {}),
        ...(status ? { status: status as AssessmentStatus } : {}),
        ...(batchId ? { batchId } : {}),
      },
      include: {
        batch: { include: { classRoom: { select: { id: true, name: true } } } },
        subject: { select: { id: true, name: true } },
        _count: { select: { questions: true, submissions: true } },
      },
      orderBy: { createdAt: "desc" },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Assignments, mocks and tests for a batch — built from the question bank.
          </p>
        </div>
        <AssessmentForm classes={formClasses} batches={batches} />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <FilterSelect name="kind" defaultValue={kind}
          options={[
            { value: "", label: "All kinds" },
            { value: "ASSIGNMENT", label: "Assignment" },
            { value: "MOCK", label: "Mock" },
            { value: "TEST", label: "Test" },
          ]}
        />
        <FilterSelect name="status" defaultValue={status}
          options={[
            { value: "", label: "All statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "SCHEDULED", label: "Scheduled" },
            { value: "RELEASED", label: "Released" },
            { value: "ACTIVE", label: "Active" },
            { value: "CLOSED", label: "Closed" },
            { value: "EVALUATED", label: "Evaluated" },
            { value: "RELEASED_TO_STUDENTS", label: "Result released" },
          ]}
        />
        <FilterSelect name="batchId" defaultValue={batchId}
          options={[
            { value: "", label: "All batches" },
            ...batches.map((b) => ({ value: b.id, label: `${b.name} · ${b.classRoom.name}` })),
          ]}
        />
        <Button type="submit" size="sm">Filter</Button>
      </form>

      <Card className="glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Title</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Marks</TableHead>
              <TableHead>Q / Subs</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
                      <ClipboardList className="h-6 w-6" />
                    </div>
                    <p className="text-sm">No assessments yet. Create one for a batch.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {assessments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="min-w-[220px]">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{durationLabel(a.durationMinutes)}{a.instructions ? " · with instructions" : ""}</p>
                  {a.subject?.name && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.subject.name}{a.topic ? ` · ${a.topic}` : ""}
                      {a.attemptMode === "FLEXIBLE" ? ` · flexible${a.maxAttempts ? ` ×${a.maxAttempts}` : ""}` : ""}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{kindBadge(a.kind)}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {a.batch.name}
                  <span className="ml-1 text-xs text-muted-foreground">· {a.batch.classRoom.name}</span>
                </TableCell>
                <TableCell>
                  <Badge className={statusStyle(a.status)}>{a.status.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell className="text-sm">{a.totalMarks}</TableCell>
                <TableCell className="text-sm">
                  {a._count.questions} / {a._count.submissions}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/assessments/${a.id}`}>
                      <Eye className="mr-1.5 h-4 w-4" /> Open
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function FilterSelect({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary">
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}