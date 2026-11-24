import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookMarked, Plus } from "lucide-react";
import SubjectForm from "@/components/admin/subjects/SubjectForm";
import SubjectActions from "@/components/admin/subjects/SubjectActions";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const [subjects, classes] = await Promise.all([
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { classes: true, questions: true } },
        classes: { include: { classRoom: true } },
      },
    }),
    prisma.classRoom.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subject Management</h1>
          <p className="text-sm text-muted-foreground">Create subjects and allot them to specific classes.</p>
        </div>
        <SubjectForm classes={classes} />
      </div>

      {subjects.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
              <BookMarked className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">No subjects yet. Add subjects like Physics, Chemistry, Mathematics.</p>
            <SubjectForm classes={classes} trigger={<Button size="sm"><Plus className="h-4 w-4" /> Add subject</Button>} />
          </CardContent>
        </Card>
      ) : (
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Allotted to</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {subject.classes.length === 0 && (
                        <span className="text-xs text-muted-foreground">Not allotted</span>
                      )}
                      {subject.classes.map((c) => (
                        <Badge key={c.classRoomId} variant="secondary" className="text-xs">
                          {c.classRoom.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{subject._count.questions}</TableCell>
                  <TableCell>
                    <SubjectActions
                      subject={{
                        id: subject.id,
                        name: subject.name,
                        classIds: subject.classes.map((c) => c.classRoomId),
                      }}
                      classes={classes}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}