import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BatchForm from "@/components/admin/classes/BatchForm";
import BatchActions from "@/components/admin/classes/BatchActions";
import { kindBadge, statusStyle } from "@/lib/assessmentConstants";
import {
  ArrowLeft,
  Users,
  Layers,
  ClipboardList,
  CalendarRange,
  UserRound,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ManageBatchPage({
  params,
}: {
  params: Promise<{ id: string; batchId: string }>;
}) {
  await requireRole("ADMIN");
  const { id: classId, batchId } = await params;

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      classRoom: {
        select: {
          id: true,
          name: true,
          subjects: { include: { subject: { select: { id: true, name: true } } } },
        },
      },
      subjects: { include: { subject: { select: { id: true, name: true } } } },
      _count: { select: { students: true, assessments: true } },
    },
  });
  if (!batch || batch.classRoomId !== classId) notFound();

  const students = await prisma.batchStudent.findMany({
    where: { batchId },
    include: {
      student: { include: { user: { select: { username: true, email: true, status: true } } } },
    },
    orderBy: { student: { fullName: "asc" } },
  });

  const assessments = await prisma.assessment.findMany({
    where: { batchId },
    orderBy: { startsAt: "desc" },
    take: 20,
    include: {
      subject: { select: { name: true } },
      _count: { select: { submissions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/admin/categories/${classId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{batch.name}</h1>
              <Badge variant={batch.isActive ? "default" : "secondary"}>
                {batch.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Batch of{" "}
              <Link href={`/admin/categories/${classId}`} className="text-accent hover:underline">
                {batch.classRoom.name}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BatchForm
            batch={{
              id: batch.id,
              name: batch.name,
              subjectIds: batch.subjects.map((s) => s.subjectId),
            }}
            classRoom={{
              id: batch.classRoomId,
              subjects: batch.classRoom.subjects.map((s) => s.subject),
            }}
            trigger={
              <Button size="sm">
                <Layers className="h-4 w-4" /> Edit batch
              </Button>
            }
          />
          <BatchActions
            batch={{
              id: batch.id,
              name: batch.name,
              active: batch.isActive,
              subjectIds: batch.subjects.map((s) => s.subjectId),
              classRoomId: batch.classRoomId,
            }}
            classSubjects={batch.classRoom.subjects.map((s) => s.subject)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="glass">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Students in batch</p>
              <p className="text-lg font-bold">{batch._count.students}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Subjects offered</p>
              <p className="text-lg font-bold">{batch.subjects.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assessments</p>
              <p className="text-lg font-bold">{batch._count.assessments}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subjects offered in this batch</CardTitle>
        </CardHeader>
        <CardContent>
          {batch.subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subjects yet. Edit the batch to allot subjects from {batch.classRoom.name}.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {batch.subjects.map((s) => (
                <Link
                  key={s.subjectId}
                  href={`/admin/categories/${classId}/batch/${batchId}/subjects/${s.subjectId}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <span className="text-sm font-medium">{s.subject.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    Chapters & rates <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4" /> Students ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No students assigned to this batch yet. Assign students from their profile under
                Student Management.
              </p>
              <Link href="/admin/students">
                <Button variant="outline" size="sm">
                  Go to Student Management
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {students.map(({ student }) => (
                <Link
                  key={student.id}
                  href={`/admin/students/${student.userId}`}
                  className="rounded-xl border border-border bg-card/40 p-3 transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold uppercase">
                      {student.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{student.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{student.user.username} · {student.user.email}
                      </p>
                    </div>
                    <Badge variant={student.user.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                      {student.user.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Assessments scheduled for this batch ({assessments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assessments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No assessments scheduled for this batch yet. Create one under Assessment Management.
              </p>
              <Link href="/admin/assessments">
                <Button variant="outline" size="sm">
                  Go to Assessment Management
                </Button>
              </Link>
            </div>
          ) : (
            assessments.map((a) => (
              <Link
                key={a.id}
                href={`/admin/assessments/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{a.title}</p>
                  <Badge variant="outline">{kindBadge(a.kind)}</Badge>
                  <Badge className={statusStyle(a.status)}>{a.status.replace(/_/g, " ")}</Badge>
                  {a.subject?.name && (
                    <Badge variant="secondary" className="text-xs">
                      {a.subject.name}{a.topic ? ` · ${a.topic}` : ""}
                    </Badge>
                  )}
                  {a.attemptMode === "FLEXIBLE" && (
                    <Badge variant="secondary" className="text-xs">
                      Flexible{a.maxAttempts ? ` ×${a.maxAttempts}` : ""}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarRange className="h-3.5 w-3.5" />
                    {a.startsAt
                      ? `${a.startsAt.toLocaleDateString()} – ${(a.endsAt ?? a.startsAt).toLocaleDateString()}`
                      : "Open"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {a._count.submissions} attempts
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}