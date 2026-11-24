"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen,
  FlaskConical,
  Target,
  BarChart3,
  FileText,
  Activity,
  Lock,
  CalendarClock,
  CheckCircle2,
  ArrowRight,
  Play,
  FileCheck2,
  Clock3,
} from "lucide-react";

const TABS = [
  { id: "assignments", label: "Assignments", icon: BookOpen },
  { id: "mock", label: "Mock Tests", icon: FlaskConical },
  { id: "tests", label: "Tests", icon: Target },
  { id: "results", label: "Results", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "activity", label: "Activity", icon: Activity },
];

export type BatchAssessment = {
  id: string;
  kind: "ASSIGNMENT" | "MOCK" | "TEST";
  status: string;
  title: string;
  topic?: string | null;
  attemptMode?: string;
  maxAttempts?: number | null;
  durationMinutes: number;
  totalMarks: number;
  startsAt: string | null;
  endsAt: string | null;
  submissions: { status: string; id: string; releasedAt: string | null }[];
};

export type BatchResult = {
  id: string;
  title: string;
  kind: string;
  totalScore: number;
  totalMarks: number;
  releasedAt: string | null;
};

type CardState = "open" | "upcoming" | "closed" | "draft" | "released" | "submitted" | "awaiting" | "inProgress";

function badgeFor(state: CardState): { label: string; variant: "default" | "secondary" | "outline" | "success" } {
  switch (state) {
    case "open":
      return { label: "open", variant: "default" };
    case "upcoming":
      return { label: "upcoming", variant: "outline" };
    case "closed":
      return { label: "closed", variant: "secondary" };
    case "draft":
      return { label: "not opened", variant: "secondary" };
    case "released":
      return { label: "result available", variant: "success" };
    case "submitted":
      return { label: "submitted", variant: "success" };
    case "awaiting":
      return { label: "under review", variant: "outline" };
    case "inProgress":
      return { label: "in progress", variant: "outline" };
  }
}

function stateFor(a: BatchAssessment, now: number): CardState {
  const s = a.submissions[0];
  if (s?.status === "SUBMITTED")
    return (a.status === "RELEASED_TO_STUDENTS" || s.releasedAt) ? "released" : "submitted";
  if (s?.status === "EVALUATED")
    return (a.status === "RELEASED_TO_STUDENTS" || s.releasedAt) ? "released" : "awaiting";
  if (s?.status === "IN_PROGRESS") return "inProgress";
  if (a.status === "DRAFT") return "draft";
  if (a.status === "RELEASED_TO_STUDENTS") return "released";
  const starts = a.startsAt ? new Date(a.startsAt).getTime() : null;
  const ends = a.endsAt ? new Date(a.endsAt).getTime() : null;
  if (starts && starts > now) return "upcoming";
  if (ends && ends < now) return "closed";
  if (a.status === "CLOSED" || a.status === "EVALUATED") return "closed";
  if ((a.status === "RELEASED" || a.status === "ACTIVE") || (a.status === "SCHEDULED" && starts && starts <= now))
    return "open";
  return "draft";
}

export default function BatchTabs({
  batch,
  assessments,
  results = [],
  services = { wantAssignments: true, wantMockTests: true, wantRealTests: true },
}: {
  batch: {
    id: string;
    name: string;
    classRoom: { name: string };
    subjects: { subject: { id: string; name: string } }[];
  };
  assessments: BatchAssessment[];
  results?: BatchResult[];
  services?: { wantAssignments: boolean; wantMockTests: boolean; wantRealTests: boolean; wantTutoring?: boolean };
}) {
  const [active, setActive] = useState<string | null>(null);
  const now = new Date().getTime();

  const passedTests = assessments.filter((a) => a.kind === "TEST" && a.submissions.some((s) => s.status !== "IN_PROGRESS"));

  const groups = {
    assignments: services.wantAssignments ? assessments.filter((a) => a.kind === "ASSIGNMENT") : [],
    mock: services.wantMockTests ? assessments.filter((a) => a.kind === "MOCK").concat(passedTests) : [],
    tests: services.wantRealTests ? assessments.filter((a) => a.kind === "TEST") : [],
  };

  const visibleTabs = TABS.filter((t) => {
    if (t.id === "assignments") return services.wantAssignments;
    if (t.id === "mock") return services.wantMockTests;
    if (t.id === "tests") return services.wantRealTests;
    return true;
  });

  const renderList = (items: BatchAssessment[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => {
        const state = stateFor(a, now);
        const badge = badgeFor(state);
        const s = a.submissions[0];
        const href = state === "released" && s ? `/dashboard/results/${s.id}` : `/dashboard/assessments/${a.id}`;
        const MetaIcon =
          state === "open" ? Play : state === "released" ? FileCheck2 : state === "closed" ? Clock3 : CalendarClock;
        const openOrClosed = a.endsAt
          ? `due ${new Date(a.endsAt).toLocaleString()}`
          : a.startsAt
            ? `opens ${new Date(a.startsAt).toLocaleString()}`
            : "no time limit";
        return (
          <Link key={a.id} href={href} className="group block">
            <Card className="glass transition-all group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  <Badge variant={badge.variant} className="gap-1">
                    {state === "open" && <Play className="h-3 w-3" />}
                    {state === "released" && <FileCheck2 className="h-3 w-3" />}
                    {state === "submitted" && <CheckCircle2 className="h-3 w-3" />}
                    {badge.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {a.topic && (
                  <Badge variant="outline" className="mb-1.5 text-[11px] font-normal">{a.topic}</Badge>
                )}
                <div className="flex items-center gap-1.5">
                  <MetaIcon className="h-3.5 w-3.5" />
                  {a.durationMinutes} min · {a.totalMarks} pts · {openOrClosed}
                </div>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  {state === "released" ? "View result" : state === "submitted" || state === "awaiting" || state === "inProgress" ? "Continue" : "Open"} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {batch.name} · {batch.classRoom.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {batch.subjects.map((s) => (
            <Badge key={s.subject.id} variant="secondary">{s.subject.name}</Badge>
          ))}
        </div>
      </div>

      <Tabs value={active ?? visibleTabs[0]?.id ?? "results"} onValueChange={setActive}>
        <TabsList className="flex-wrap h-auto">
          {visibleTabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-2">
              <t.icon className="h-4 w-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="assignments">
            {groups.assignments.length ? renderList(groups.assignments) : <EmptyState label="Assignments" />}
          </TabsContent>
          <TabsContent value="mock">
            {groups.mock.length ? renderList(groups.mock) : <EmptyState label="Mock tests" />}
          </TabsContent>
          <TabsContent value="tests">
            {groups.tests.length ? renderList(groups.tests) : <EmptyState label="Tests" />}
          </TabsContent>
          <TabsContent value="results">
            {results.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((r) => (
                  <Link key={r.id} href={`/dashboard/results/${r.id}`}>
                    <Card className="glass transition-all hover:border-primary/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{r.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between text-sm">
                        <Badge variant="outline">{r.kind.toLowerCase()}</Badge>
                        <span className="font-semibold">
                          {r.totalScore} <span className="font-normal text-muted-foreground">/ {r.totalMarks}</span>
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState label="Results" />
            )}
          </TabsContent>
          {(["reports", "activity"] as const).map((t) => (
            <TabsContent key={t} value={t}>
              <EmptyState label={TABS.find((x) => x.id === t)!.label} />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="glass">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
          <Lock className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium">{label} coming soon</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Your teacher will release assignments and tests here. Check back shortly.
        </p>
      </CardContent>
    </Card>
  );
}