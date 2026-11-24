import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileClock,
  Hourglass,
  Lock,
  Trophy,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { getServiceState, getActiveServices, assessmentTopicAllowed } from "@/services/onboardingService";
import { decideAttempt, attemptsRemaining } from "@/services/attemptService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { kindBadge } from "@/lib/assessmentConstants";
import AttemptView from "@/components/student/AttemptView";
import AttemptIntro from "@/components/student/AttemptIntro";
import { deadlineFrom } from "@/lib/assessmentTime";

export const dynamic = "force-dynamic";

function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    const j = h >>> 16;
    const pick = arr.length === 0 ? 0 : j % (i + 1);
    [arr[i], arr[pick]] = [arr[pick], arr[i]];
  }
  return arr;
}

function StateScreen({
  kind,
  title,
  batchId,
  icon,
  heading,
  children,
  backLabel = "Back to classes",
}: {
  kind?: string;
  title: string;
  batchId: string;
  icon: React.ReactNode;
  heading: string;
  children: React.ReactNode;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary/60 text-foreground">{icon}</div>
      {kind && <Badge variant="outline">{kindBadge(kind as never)}</Badge>}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <h1 className="-mt-2 text-2xl font-bold">{heading}</h1>
      {children}
      <div className="flex justify-center gap-2">
        <Button asChild variant="outline">
          <Link href={`/dashboard/classes/${batchId}`}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

function fmt(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleString() : null;
}

export default async function AttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ begin?: string }>;
}) {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;
  const { assessmentId } = await params;
  const sp = await searchParams;
  const begin = sp.begin === "1";

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      batch: {
        include: { students: { select: { studentId: true } }, classRoom: { select: { id: true, name: true } } },
      },
      subject: { select: { name: true } },
      questions: {
        include: {
          question: {
            include: {
              options: { orderBy: { sortOrder: "asc" } },
              testCases: { orderBy: { sortOrder: "asc" }, where: { isHidden: false } },
              subject: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
      submissions: { where: { studentId: profId ?? "" }, orderBy: { attemptNumber: "desc" } },
    },
  });

  if (!assessment || !profId) notFound();
  if (!assessment.batch.students.some((s) => s.studentId === profId)) notFound();

  const existing = assessment.submissions[0];
  const flexible = assessment.attemptMode === "FLEXIBLE";
  const now = new Date();
  const notYet = !flexible && !!assessment.startsAt && assessment.startsAt.getTime() > now.getTime();
  const windowClosed = !flexible && !!assessment.endsAt && assessment.endsAt.getTime() < now.getTime();
  const released = assessment.status === "RELEASED_TO_STUDENTS" || !!existing?.releasedAt;
  const back = { batchId: assessment.batchId };

  // Service gate: expired plan → results stay readable, attempts are blocked.
  const service = await getServiceState(user.id);
  if (service && !service.active && !released) {
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<Lock className="h-7 w-7 text-muted-foreground" />}
        heading="Plan locked"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          This couldn&apos;t be attempted because your service period has ended. Renew your plan to continue practising.
        </p>
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/onboarding">Go to My Plan</Link>
          </Button>
        </div>
      </StateScreen>
    );
  }

  // Entitlement gate: this assessment covers a topic/service the plan doesn't.
  const services = await getActiveServices(user.id);
  if (services && !assessmentTopicAllowed(services, assessment.kind, assessment.topic, assessment.subjectId)) {
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<Lock className="h-7 w-7 text-muted-foreground" />}
        heading="Not part of your plan"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          This {kindBadge(assessment.kind).toLowerCase()} covers a chapter or service your current plan doesn&apos;t include.
        </p>
      </StateScreen>
    );
  }

  if (released) {
    if (existing?.releasedAt) {
      return (
        <StateScreen
          {...back}
          kind={assessment.kind}
          title={assessment.title}
          icon={<Trophy className="h-7 w-7 text-amber-300" />}
          heading="Result is ready"
          backLabel={`Back to ${assessment.batch.name}`}
        >
          <p className="text-sm text-muted-foreground">
            Your result has been released.
          </p>
          <div className="flex justify-center py-2">
            <Button asChild>
              <Link href={`/dashboard/results/${existing.id}`}>View result</Link>
            </Button>
          </div>
        </StateScreen>
      );
    }
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<Trophy className="h-7 w-7 text-muted-foreground" />}
        heading="Results are out"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          This {kindBadge(assessment.kind).toLowerCase()} was released to your batch, but you didn&apos;t attempt it.
        </p>
      </StateScreen>
    );
  }

  // Flexible assessments: all attempts used up.
  const remainingAttempts = attemptsRemaining({ maxAttempts: assessment.maxAttempts }, assessment.submissions);
  if (flexible && remainingAttempts === 0) {
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<CheckCircle2 className="h-7 w-7 text-violet-300" />}
        heading="Attempts used up"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          You&apos;ve used all {assessment.maxAttempts} attempt{assessment.maxAttempts === 1 ? "" : "s"} for this flexible{" "}
          {kindBadge(assessment.kind).toLowerCase()}.
        </p>
      </StateScreen>
    );
  }

  if (!flexible && existing?.status === "SUBMITTED") {
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<CheckCircle2 className="h-7 w-7 text-emerald-300" />}
        heading="Already submitted"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          You already submitted this {kindBadge(assessment.kind).toLowerCase()}. Your result will appear once your
          teacher evaluates and releases it.
        </p>
      </StateScreen>
    );
  }

  if (!flexible && existing?.status === "EVALUATED") {
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<FileClock className="h-7 w-7 text-violet-300" />}
        heading="Under review"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          Your attempt has been submitted and evaluated. The result will appear once your teacher releases it — keep an
          eye on <span className="font-medium text-foreground">Results</span>.
        </p>
      </StateScreen>
    );
  }

  if (assessment.status === "DRAFT") {
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<Lock className="h-7 w-7 text-muted-foreground" />}
        heading="Not open yet"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          Your teacher hasn&apos;t opened this {kindBadge(assessment.kind).toLowerCase()} yet. It will be available here
          once it&apos;s released.
        </p>
      </StateScreen>
    );
  }

  if (notYet) {
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<Hourglass className="h-7 w-7 text-sky-300" />}
        heading="Opens soon"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          {assessment.status === "SCHEDULED" ? "This is scheduled. " : "This hasn't opened yet. "}It opens on{" "}
          <span className="font-medium text-foreground">{fmt(assessment.startsAt)}</span>.
        </p>
      </StateScreen>
    );
  }

  const attemptable = assessment.status === "RELEASED" || assessment.status === "ACTIVE";

  if (!attemptable || windowClosed) {
    return (
      <StateScreen
        {...back}
        kind={assessment.kind}
        title={assessment.title}
        icon={<Clock3 className="h-7 w-7 text-muted-foreground" />}
        heading="Submission window closed"
        backLabel={`Back to ${assessment.batch.name}`}
      >
        <p className="text-sm text-muted-foreground">
          {windowClosed && assessment.endsAt
            ? `The submission window closed at ${fmt(assessment.endsAt)}.`
            : "This assessment is no longer open for attempts."}
        </p>
      </StateScreen>
    );
  }

  const questions = assessment.questions.map((aq) => ({
    assessmentQuestionId: aq.id,
    order: aq.order,
    marks: aq.marks,
    stem: aq.question.stem,
    imageUrl: aq.question.imageUrl,
    type: aq.question.type,
    subjectName: aq.question.subject?.name ?? "",
    options: aq.question.options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl })),
    allowedLanguages: (aq.question.allowedLanguages as string[]) ?? [],
    starterCode: (aq.question.starterCode as Record<string, string> | null) ?? {},
    headerTemplate: aq.question.headerTemplate,
    testCases: aq.question.testCases.map((t) => ({ input: t.input, expected: t.expected })),
    sqlDialect: aq.question.sqlDialect,
    sqlSchemaSql: aq.question.sqlSchemaSql,
    sqlSeedSql: aq.question.sqlSeedSql,
  }));

  const breakdown = Array.from(
    questions.reduce((map, q) => map.set(q.type, (map.get(q.type) ?? 0) + 1), new Map<string, number>()).entries()
  ).map(([type, count]) => ({ type, count }));

  if (!begin) {
    const inProgress = existing?.status === "IN_PROGRESS" ? existing : null;
    const deadline = inProgress
      ? deadlineFrom(inProgress.startedAt, assessment.durationMinutes)?.toISOString() ?? null
      : null;
    const finishedCount = assessment.submissions.filter((s) => s.status !== "IN_PROGRESS").length;
    const attemptHint = flexible
      ? assessment.maxAttempts == null
        ? `Unlimited attempts${finishedCount ? ` · ${finishedCount} already` : ""}`
        : `${finishedCount} of ${assessment.maxAttempts} attempt${assessment.maxAttempts === 1 ? "" : "s"} used${finishedCount ? ` · ${remainingAttempts} left` : ""}`
      : undefined;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/dashboard/classes/${assessment.batchId}`}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {assessment.batch.name} · {assessment.batch.classRoom.name}
          </Link>
          {assessment.subject?.name && (
            <Badge variant="secondary" className="text-xs">
              {assessment.subject.name}{assessment.topic ? ` · ${assessment.topic}` : ""}
            </Badge>
          )}
          {flexible && <Badge variant="outline" className="text-xs">flexible</Badge>}
        </div>
        <AttemptIntro
          assessmentId={assessment.id}
          title={assessment.title}
          kind={assessment.kind}
          durationMinutes={assessment.durationMinutes}
          totalMarks={assessment.totalMarks}
          instructions={assessment.instructions}
          questionCount={questions.length}
          breakdown={breakdown}
          deadline={deadline}
          closesAt={assessment.endsAt ? assessment.endsAt.toISOString() : null}
          attemptHint={attemptHint}
        />
      </div>
    );
  }

  const decision = decideAttempt({
    assessment: {
      attemptMode: assessment.attemptMode,
      maxAttempts: assessment.maxAttempts,
      status: assessment.status,
      startsAt: assessment.startsAt,
      endsAt: assessment.endsAt,
    },
    submissions: assessment.submissions.map((s) => ({ status: s.status, attemptNumber: s.attemptNumber })),
  });
  const nextAttempt = decision.allow && !decision.resume ? decision.attemptNumber : 1;

  const submission =
    existing?.status === "IN_PROGRESS"
      ? existing
      : await prisma.submission
          .create({
            data: { assessmentId, studentId: profId, attemptNumber: nextAttempt },
            include: { assessment: { select: { durationMinutes: true } } },
          })
          .catch(async () => {
            const res = await prisma.submission.findFirst({
              where: { assessmentId, studentId: profId },
              include: { assessment: { select: { durationMinutes: true } } },
            });
            if (!res) notFound();
            return res;
          });

  const ordered = assessment.shuffleQuestions ? seededShuffle(questions, submission.id) : questions.sort((a, b) => a.order - b.order);

  const answers = await prisma.answer.findMany({
    where: { submissionId: submission.id },
    select: { assessmentQuestionId: true, payload: true },
  });
  const answersMap: Record<string, unknown> = {};
  for (const a of answers) answersMap[a.assessmentQuestionId] = a.payload;

  const deadline = deadlineFrom(submission.startedAt, assessment.durationMinutes)?.toISOString() ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/dashboard/classes/${assessment.batchId}`}
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {assessment.batch.name} · {assessment.batch.classRoom.name}
        </Link>
      </div>
      <AttemptView
        submissionId={submission.id}
        title={assessment.title}
        kind={assessment.kind}
        totalMarks={assessment.totalMarks}
        deadline={deadline}
        questions={ordered}
        answers={answersMap}
        instructions={assessment.instructions ?? undefined}
      />
    </div>
  );
}