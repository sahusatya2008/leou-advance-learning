import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Trophy, ChevronRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;

  const released = profId
    ? await prisma.submission.findMany({
        where: { studentId: profId, releasedAt: { not: null }, totalScore: { not: null } },
        include: { assessment: { include: { batch: { include: { classRoom: true } } } } },
        orderBy: { releasedAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results</h1>
        <p className="text-sm text-muted-foreground">
          Only evaluated and released scores appear here.
        </p>
      </div>

      {released.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
              <BarChart3 className="h-6 w-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              No results released yet. Scores appear here once your teacher evaluates and releases
              an assessment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {released.map((r) => (
            <Card key={r.id} className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{r.assessment.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {r.assessment.batch.classRoom.name} {r.assessment.batch.name}
                </p>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-300" />
                  <span className="text-xl font-bold">{r.totalScore ?? 0}</span>
                  <span className="text-sm text-muted-foreground">/ {r.assessment.totalMarks}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">Auto {r.autoScore}</Badge>
                  <Badge variant="secondary">Manual {r.manualScore}</Badge>
                </div>
                {r.feedback && <p className="text-xs text-muted-foreground">{r.feedback}</p>}
                <Link href={`/dashboard/results/${r.id}`}>
                  <Button size="sm" variant="outline" className="w-full">
                    View breakdown <ChevronRight className="h-4 w-4" />
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