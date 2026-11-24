import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Layers,
  BookMarked,
  FileQuestion,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [students, classesN, subjectCount, questions] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.classRoom.count(),
    prisma.subject.count(),
    prisma.question.count(),
  ]);

  const stats = [
    { icon: Users, label: "Students", value: students },
    { icon: Layers, label: "Classes", value: classesN },
    { icon: BookMarked, label: "Subjects", value: subjectCount },
    { icon: FileQuestion, label: "Questions", value: questions },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform overview across all panels.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="glass">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Setup checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { done: classesN > 0, label: "Create classes in Category Management" },
            { done: subjectCount > 0, label: "Create subjects and allot them to classes" },
            { done: classesN > 0 && subjectCount > 0, label: "Create batches (sections) inside classes" },
            { done: students > 0, label: "Add students (they appear in Student Management)" },
            { done: questions > 0, label: "Build the question bank" },
          ].map((step) => (
            <div key={step.label} className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-4 py-3">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                  step.done ? "bg-emerald-500/20 text-emerald-300" : "bg-secondary text-muted-foreground"
                }`}
              >
                {step.done ? "✓" : "•"}
              </span>
              <span className="text-sm">{step.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}