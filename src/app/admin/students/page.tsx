import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { UserRound } from "lucide-react";
import StudentToolbar from "@/components/admin/students/StudentToolbar";
import CreateStudentDialog from "@/components/admin/students/CreateStudentDialog";
import type { StatusBadge } from "@/components/admin/students/StatusBadge";

const STATUS_VARIANTS: Record<StatusBadge["status"], "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  BLOCKED: "destructive",
};

type SearchParams = Promise<{ q?: string; status?: string; classId?: string }>;

export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, status, classId } = await searchParams;

  const where = {
    role: "STUDENT" as const,
    ...(status ? { status: status as never } : {}),
    ...(classId ? { studentProfile: { classRoomId: classId } } : {}),
    ...(q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { studentProfile: { fullName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [students, classes] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        studentProfile: {
          include: {
            classRoom: { select: { id: true, name: true } },
            batches: { include: { batch: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    prisma.classRoom.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Management</h1>
          <p className="text-sm text-muted-foreground">Create, monitor and manage student accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <StudentToolbar classes={classes} />
          <CreateStudentDialog />
        </div>
      </div>

      <Card className="glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Batches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                  No students match your filters.
                </TableCell>
              </TableRow>
            )}
            {students.map((student) => {
              const prof = student.studentProfile;
              const faceCount = Array.isArray(prof?.faceEmbeddings) ? prof.faceEmbeddings.length : 0;
              return (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{prof?.fullName ?? student.username}</p>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{student.username}</TableCell>
                  <TableCell>{prof?.classRoom.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {prof && prof.batches.length === 0 && <span className="text-xs text-muted-foreground">Unassigned</span>}
                      {prof?.batches.map((b) => (
                        <Badge key={b.batchId} variant="outline" className="text-xs">
                          {b.batch.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANTS[student.status as keyof typeof STATUS_VARIANTS] ?? "secondary"}>
                        {student.status}
                      </Badge>
                      {faceCount < 3 && (
                        <Badge variant="outline" className="text-xs">
                          Face: {faceCount}/5
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/students/${student.id}`}>
                      <Button variant="outline" size="sm">Manage</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}