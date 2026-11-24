import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, CalendarDays, CalendarRange } from "lucide-react";
import type { TutorPlan } from "@/services/onboardingService";

export const dynamic = "force-dynamic";

const PLANS: { plan: TutorPlan; title: string; desc: string; icon: typeof Clock }[] = [
  { plan: "HOURLY", title: "Per hour", desc: "Students who picked hourly tutoring.", icon: Clock },
  { plan: "WEEKLY", title: "Per week", desc: "Students who picked weekly tutoring.", icon: CalendarDays },
  { plan: "MONTHLY", title: "Per month", desc: "Students who picked monthly tutoring.", icon: CalendarRange },
];

type Row = {
  id: string;
  tutorPlan: string | null;
  tutorHours: number | null;
  tutorSubjects: unknown;
  status: string;
  user: {
    id: string;
    username: string;
    email: string;
    studentProfile: { fullName: string; classRoom: { name: string } } | null;
  };
};

export default async function LearningRequestsPage() {
  const requests = (await prisma.onboardingRequest.findMany({
    where: { wantTutoring: true },
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
    include: { user: { select: { id: true, username: true, email: true, studentProfile: { select: { fullName: true, classRoom: { select: { name: true } } } } } } },
  })) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students learning from a teacher</h1>
        <p className="text-sm text-muted-foreground">
          Every student who requested online learning-from-teacher, grouped by their chosen billing plan.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map(({ plan, title, desc, icon: Icon }) => {
          const rows = requests.filter((r) => r.tutorPlan === plan);
          return (
            <Card key={plan} className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" /> {title}
                </CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  rows.map((r) => (
                    <Link
                      key={r.id}
                      href={`/admin/students/${r.user.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-card"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.user.studentProfile?.fullName ?? r.user.username}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.user.studentProfile?.classRoom.name ?? ""} · {Array.isArray(r.tutorSubjects) ? (r.tutorSubjects as unknown[]).length : 0} subject(s)
                          {plan === "HOURLY" && r.tutorHours ? ` · ${r.tutorHours} h` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}