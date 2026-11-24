import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, ArrowRight } from "lucide-react";
import type { OnboardingStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const now = new Date();

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "border-amber-400/50 bg-amber-500/10 text-amber-600",
  BILLED: "border-indigo-400/50 bg-indigo-500/10 text-indigo-500",
  ACTIVATED: "border-emerald-400/50 bg-emerald-500/10 text-emerald-600",
};

const inr = (n: number | null) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN"));

function topics(raw: string): string[] {
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

type BreakdownTotals = { assignment: number; mock: number; test: number; tutoring: number; grand: number };

export default async function NewlyRegisteredPage() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", onboardingRequired: true },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      studentProfile: { include: { classRoom: { select: { name: true } } } },
      onboardingRequests: { orderBy: { createdAt: "desc" }, take: 1 },
      activations: { orderBy: { activatedAt: "desc" }, take: 1 },
    },
  });

  const subjectIds = Array.from(
    new Set(students.flatMap((s) => ((s.onboardingRequests[0]?.subjects as unknown as string[]) ?? [])))
  );
  const subjects = subjectIds.length
    ? await prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
    : [];
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Newly Registered Students</h1>
        <p className="text-sm text-muted-foreground">
          Students who registered themselves. Review their service request & invoice, then issue the 15-digit payment
          access code so they can unlock their plan.
        </p>
      </div>

      <Card className="glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Request · subjects & services</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[180px]">Invoice breakdown</TableHead>
              <TableHead className="w-28 text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                  <UserPlus className="mx-auto mb-2 h-8 w-8" />
                  No self-registered students yet.
                </TableCell>
              </TableRow>
            )}
            {students.map((s) => {
              const req = s.onboardingRequests[0];
              const active = s.activations[0];
              const subjects = req
                ? ((req.subjects as unknown as string[]) ?? []).map((id) => subjectName.get(id) ?? id)
                : [];
              const breakdown = req?.breakdown as { totals?: BreakdownTotals } | null;
              const totals = breakdown?.totals;
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-medium">{s.studentProfile?.fullName ?? s.username}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </TableCell>
                  <TableCell>{s.studentProfile?.classRoom.name ?? "—"}</TableCell>
                  <TableCell>
                    {req ? (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {subjects.map((sub) => (
                            <Badge key={sub} variant="secondary" className="text-xs">{sub}</Badge>
                          ))}
                        </div>
                        {(
                          [
                            [req.wantAssignments, "Assignments", req.assignmentTopics],
                            [req.wantMockTests, "Mock", req.sameTopicsForMockTests ? req.assignmentTopics : req.mockTopics],
                            [req.wantRealTests, "Tests", req.sameTopicsForMockTests ? req.assignmentTopics : req.testTopics],
                          ] as const
                        )
                          .filter(([on]) => on)
                          .map(([, label, raw]) => (
                            <p key={label} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{label}</span>
                              {" · "}
                              {topics(raw).length ? `${topics(raw).length} chapter(s)/topic(s)` : "no chapters"}
                            </p>
                          ))}
                        {req.wantTutoring && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Tuition</span>{" · "}
                            {req.tutorPlan ? req.tutorPlan.toLowerCase() : "—"}
                            {req.tutorPlan === "HOURLY" && req.tutorHours ? ` · ${req.tutorHours} h` : ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not requested yet</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {req ? (
                      <Badge className={STATUS_STYLES[(req.status as OnboardingStatus) ?? ""] ?? ""}>
                        {req.status.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">No request</Badge>
                    )}
                    {active && active.expiresAt.getTime() > now.getTime() && (
                      <Badge variant="default" className="ml-1 text-xs">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {totals ? (
                      <div className="space-y-0.5 text-xs">
                        <p className="flex justify-between gap-3"><span className="text-muted-foreground">Assignments</span><span className="tabular-nums">{inr(totals.assignment)}</span></p>
                        <p className="flex justify-between gap-3"><span className="text-muted-foreground">Mock tests</span><span className="tabular-nums">{inr(totals.mock)}</span></p>
                        <p className="flex justify-between gap-3"><span className="text-muted-foreground">Real tests</span><span className="tabular-nums">{inr(totals.test)}</span></p>
                        <p className="flex justify-between gap-3"><span className="text-muted-foreground">Learning</span><span className="tabular-nums">{inr(totals.tutoring)}</span></p>
                        <p className="flex justify-between gap-3 border-t border-border pt-0.5 font-semibold">
                          <span>Total</span>
                          <span className="tabular-nums text-primary">{inr(req?.amount != null ? Number(req.amount) : totals.grand)}</span>
                        </p>
                      </div>
                    ) : (
                      <span className="tabular-nums text-sm">{inr(req?.amount != null ? Number(req.amount) : null)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/students/${s.id}`}>
                      <Button variant="outline" size="sm">
                        View <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
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