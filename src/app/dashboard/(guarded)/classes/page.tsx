import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, ChevronRight, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyClassesPage() {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;
  if (!profId) {
    return (
      <Card className="glass">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          No profile found. Ask the admin to set up your account.
        </CardContent>
      </Card>
    );
  }

  const batches = await prisma.batch.findMany({
    where: { students: { some: { studentId: profId } }, isActive: true },
    include: {
      classRoom: true,
      subjects: { include: { subject: true } },
      _count: { select: { students: true, assessments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Classes</h1>
        <p className="text-sm text-muted-foreground">
          Batches you&apos;re enrolled in. Open a batch to see your assignments and tests.
        </p>
      </div>

      {batches.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
              <Layers className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              You&apos;re not assigned to any batch yet. Your admin will add you to a class section.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <Card key={batch.id} className="glass">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-lg">{batch.classRoom.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{batch.name}</p>
                </div>
                <Badge variant="outline">
                  <Users className="mr-1 h-3 w-3" /> {batch._count.students}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {batch.subjects.map((s) => (
                    <Badge key={s.subjectId} variant="secondary" className="text-xs">
                      {s.subject.name}
                    </Badge>
                  ))}
                </div>
                <Link href={`/dashboard/classes/${batch.id}`}>
                  <Button className="w-full">
                    Enter batch <ChevronRight className="h-4 w-4" />
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