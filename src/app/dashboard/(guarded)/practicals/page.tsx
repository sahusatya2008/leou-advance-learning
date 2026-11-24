import Link from "next/link";
import { requireRole } from "@/lib/panels";
import { listStudentPracticals } from "@/services/practicalService";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Practicals" };

export default async function StudentPracticalsPage() {
  const { user } = await requireRole("STUDENT");
  const practicals = await listStudentPracticals(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FlaskConical className="h-6 w-6 text-indigo-300" />
          Practicals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chapter practice for Computer Science. Nothing here is graded — work through it, run it, and
          ask when you are stuck.
        </p>
      </div>

      {practicals.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No practicals are available for you yet. A set appears here once your admin publishes one for
            a chapter in your plan.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {practicals.map((p) => {
            const done = p.finishedCount >= p.questionCount && p.questionCount > 0;
            return (
              <Link key={p.id} href={`/dashboard/practicals/${p.id}`}>
                <Card className="glass h-full transition-colors hover:border-primary/50">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.subjectName} · {p.topic}
                        </p>
                      </div>
                      <Badge variant={done ? "default" : "secondary"}>
                        {p.finishedCount}/{p.questionCount}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.className} · {p.batchName}
                    </p>
                    <Button variant="outline" size="sm" className="w-full">
                      {done ? "Review" : p.finishedCount > 0 ? "Continue" : "Start"}{" "}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}