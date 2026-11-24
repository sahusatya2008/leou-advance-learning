import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import BatchTabs from "@/components/student/BatchTabs";
import { getServiceState, getActiveServices, assessmentTopicAllowed } from "@/services/onboardingService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EnterBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;
  const { batchId } = await params;

  const service = await getServiceState(user.id);
  const services = await getActiveServices(user.id);

  // Soft lock: the student had a subscription but it lapsed. Allow reading past
  // results, but lock the service tabs until they renew.
  if (service && !service.active && !service.softLock) {
    return (
      <Card className="glass mx-auto mt-10 max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Your services haven&apos;t started yet
          </CardTitle>
          <CardDescription>Choose your services and pay to unlock your classes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/onboarding">Go to My Plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      classRoom: true,
      subjects: { include: { subject: true } },
      _count: { select: { students: true } },
    },
  });

  if (!batch || !profId) notFound();

  const member = await prisma.batchStudent.findUnique({
    where: { batchId_studentId: { batchId, studentId: profId } },
  });
  if (!member) notFound();

  const assessments = await prisma.assessment.findMany({
    where: { batchId, status: { not: "DRAFT" } },
    include: {
      submissions: {
        where: { studentId: profId },
        select: { status: true, id: true, releasedAt: true },
        orderBy: { attemptNumber: "desc" },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  // Only assessments the student's plan covers (kind + subscribed chapters/
  // topics). Drafts are already excluded so students never see “Not open yet”.
  const entitled = assessments.filter((a) => assessmentTopicAllowed(services, a.kind, a.topic, a.subjectId));

  const released = await prisma.submission.findMany({
    where: { studentId: profId, assessment: { batchId }, releasedAt: { not: null }, totalScore: { not: null } },
    include: { assessment: { select: { title: true, totalMarks: true, kind: true } } },
    orderBy: { releasedAt: "desc" },
  });

  return (
    <BatchTabs
      batch={batch}
      assessments={entitled.map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status,
        title: a.title,
        topic: a.topic,
        attemptMode: a.attemptMode,
        maxAttempts: a.maxAttempts,
        durationMinutes: a.durationMinutes,
        totalMarks: a.totalMarks,
        startsAt: a.startsAt?.toISOString() ?? null,
        endsAt: a.endsAt?.toISOString() ?? null,
        submissions: a.submissions.map((s) => ({ status: s.status, id: s.id, releasedAt: s.releasedAt?.toISOString() ?? null })),
      }))}
      results={released.map((r) => ({
        id: r.id,
        title: r.assessment.title,
        kind: r.assessment.kind,
        totalScore: r.totalScore ?? 0,
        totalMarks: r.assessment.totalMarks,
        releasedAt: r.releasedAt?.toISOString() ?? null,
      }))}
      services={
        services ?? { wantAssignments: true, wantMockTests: true, wantRealTests: true }
      }
    />
  );
}