import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookMarked, Users, Layers, ChevronLeft } from "lucide-react";
import ClassForm from "@/components/admin/classes/ClassForm";
import BatchForm from "@/components/admin/classes/BatchForm";
import BatchActions from "@/components/admin/classes/BatchActions";

export const dynamic = "force-dynamic";

export default async function ManageClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const classroom = await prisma.classRoom.findUnique({
    where: { id },
    include: {
      subjects: { include: { subject: true }, orderBy: { subject: { name: "asc" } } },
      batches: {
        include: {
          subjects: { include: { subject: true } },
          _count: { select: { students: true } },
        },
        orderBy: { name: "asc" },
      },
      _count: { select: { students: true } },
    },
  });

  if (!classroom) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/categories">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{classroom.name}</h1>
              <Badge variant={classroom.isActive ? "default" : "secondary"}>
                {classroom.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {classroom._count.students} students · {classroom.batches.length} batches
            </p>
          </div>
        </div>
        <ClassForm
          cls={{ id: classroom.id, name: classroom.name, hasStreams: classroom.hasStreams, sortOrder: classroom.sortOrder }}
        />
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-4 w-4" /> Allotted subjects
          </CardTitle>
        </CardHeader>
        <CardContent>
          {classroom.subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subjects allotted. Manage them under Subject Management.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classroom.subjects.map((s) => (
                <Badge key={s.subjectId} variant="outline" className="px-3 py-1">
                  {s.subject.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-5 w-5" /> Batches
        </h2>
        <BatchForm
          classRoom={{ id: classroom.id, subjects: classroom.subjects.map((s) => s.subject) }}
        />
      </div>

      {classroom.batches.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
              <Layers className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              No batches yet. Create a section (e.g. “Section A”) to group students.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classroom.batches.map((batch) => (
            <Card key={batch.id} className="glass">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-lg">{batch.name}</CardTitle>
                <BatchActions
                  batch={{
                    id: batch.id,
                    name: batch.name,
                    active: batch.isActive,
                    subjectIds: batch.subjects.map((s) => s.subjectId),
                    classRoomId: classroom.id,
                  }}
                  classSubjects={classroom.subjects.map((s) => s.subject)}
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> {batch._count.students} students
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {batch.subjects.map((s) => (
                    <Badge key={s.subjectId} variant="secondary" className="text-xs">
                      {s.subject.name}
                    </Badge>
                  ))}
                </div>
                <Link href={`/admin/categories/${classroom.id}/batch/${batch.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Manage batch
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}