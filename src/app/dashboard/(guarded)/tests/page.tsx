import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { getServiceState, getActiveServices, assessmentTopicAllowed } from "@/services/onboardingService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Target, Lock, CalendarClock, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;

  const service = await getServiceState(user.id);
  const services = await getActiveServices(user.id);

  if (service && !service.active) {
    return (
      <Card className="glass mx-auto mt-10 max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
            <Lock className="h-6 w-6" />
          </div>
          <p className="font-medium">Test service is locked</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Tests are part of your paid plan. Renew your services from My Plan to keep practising.
          </p>
          <Link href="/onboarding" className="text-sm font-medium text-primary hover:underline">
            Go to My Plan →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const assessments = profId
    ? await prisma.assessment.findMany({
        where: { batch: { students: { some: { studentId: profId } } }, status: { not: "DRAFT" } },
        include: {
          batch: { include: { classRoom: true } },
          submissions: { where: { studentId: profId }, select: { status: true }, orderBy: { attemptNumber: "desc" } },
        },
        orderBy: { startsAt: "asc" },
        take: 100,
      })
    : [];

  const now = new Date();

  // Kind + subscribed-chapter/topic entitlement. Drafts are excluded so
  // students never see “Not open yet” cards.
  const entitled = assessments.filter((a) => assessmentTopicAllowed(services, a.kind, a.topic, a.subjectId));
  const wantMock = services?.wantMockTests ?? true;
  const wantReal = services?.wantRealTests ?? true;
  const mocks = entitled.filter((a) => a.kind === "MOCK" || (a.kind === "TEST" && a.submissions.some((s) => s.status !== "IN_PROGRESS" && s.status !== "SUBMITTED")));
  const reals = entitled.filter((a) => a.kind === "TEST");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tests</h1>
        <p className="text-sm text-muted-foreground">Mock tests (unlimited practice) and real tests across your batches.</p>
      </div>

      <Tabs defaultValue="mock">
        <TabsList>
          {wantMock && <TabsTrigger value="mock" className="gap-2"><FlaskConical className="h-4 w-4" /> Mock tests</TabsTrigger>}
          {wantReal && <TabsTrigger value="real" className="gap-2"><Target className="h-4 w-4" /> Real tests</TabsTrigger>}
        </TabsList>
        {wantMock && (
          <TabsContent value="mock" className="mt-6">
            <List items={mocks} empty="No mock tests are available yet." now={now} />
          </TabsContent>
        )}
        {wantReal && (
          <TabsContent value="real" className="mt-6">
            <List items={reals} empty="No real tests have been scheduled for your batches yet." now={now} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function List({
  items,
  empty,
  now,
}: {
  items: {
    id: string;
    title: string;
    kind: string;
    status: string;
    topic: string | null;
    attemptMode: string;
    durationMinutes: number;
    startsAt: Date | null;
    endsAt: Date | null;
    batch: { id: string; name: string; classRoom: { name: string } };
    submissions: { status: string }[];
  }[];
  empty: string;
  now: Date;
}) {
  if (items.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
            <Lock className="h-6 w-6" />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">{empty}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => {
        const attemptable = (a.status === "RELEASED" || a.status === "ACTIVE") && !(a.startsAt && a.startsAt.getTime() > now.getTime()) && !(a.endsAt && a.endsAt.getTime() < now.getTime());
        const submitted = a.submissions[0]?.status === "SUBMITTED";
        const body = (
          <Card className="glass transition-all hover:border-primary/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{a.title}</CardTitle>
                {submitted ? (
                  <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> submitted</Badge>
                ) : attemptable ? (
                  <Badge className="gap-1"><CalendarClock className="h-3 w-3" /> open</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {a.topic && (
                <Badge variant="outline" className="mb-1.5 text-[11px] font-normal">{a.topic}</Badge>
              )}
              <div>
                {a.batch.classRoom.name} · {a.batch.name}
              </div>
              <div className="mt-1 text-xs">
                {a.durationMinutes} min · {a.kind.toLowerCase()}
                {a.attemptMode === "FLEXIBLE" ? " · flexible" : ""}
              </div>
            </CardContent>
          </Card>
        );
        return (
          <div key={a.id}>
            {submitted || attemptable ? (
              <Link href={`/dashboard/assessments/${a.id}`} className="block">{body}</Link>
            ) : (
              body
            )}
          </div>
        );
      })}
    </div>
  );
}