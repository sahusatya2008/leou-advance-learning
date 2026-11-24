import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import GradingWorkbench from "@/components/admin/assessments/GradingWorkbench";

export const dynamic = "force-dynamic";

export default async function GradingSubmissionPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  await requireRole("ADMIN");
  const { id, submissionId } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assessment: {
        include: {
          questions: {
            include: {
              question: {
                include: { options: { orderBy: { sortOrder: "asc" } }, testCases: { orderBy: { sortOrder: "asc" } }, subject: { select: { name: true } } },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      },
      student: { select: { fullName: true } },
      answers: true,
    },
  });
  if (!submission || submission.assessmentId !== id) notFound();

  const answerByAq = new Map(submission.answers.map((a) => [a.assessmentQuestionId, a]));
  const questions = submission.assessment.questions.map((aq) => {
    const ans = answerByAq.get(aq.id);
    return {
      aqId: aq.id,
      order: aq.order,
      marks: aq.marks,
      type: aq.question.type,
      stem: aq.question.stem,
      subject: aq.question.subject?.name ?? "",
      options: aq.question.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      explanation: aq.question.explanation,
      testCases: aq.question.testCases.map((t) => ({ input: t.input, expected: t.expected })),
      sqlExpectedResult: aq.question.sqlExpectedResult as unknown,
      answer: ans
        ? {
            id: ans.id,
            payload: ans.payload as unknown,
            marksAwarded: ans.marksAwarded,
            feedback: ans.feedback,
            isAutoCorrect: ans.isAutoCorrect,
            autoResult: (ans.autoResult as { correct?: boolean; passed?: number; total?: number; detail?: string } | null) ?? null,
          }
        : undefined,
    };
  });

  return (
    <div className="space-y-4">
      <Link href={`/admin/assessments/${submission.assessmentId}/grading`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {submission.assessment.title} — all submissions
      </Link>
      <GradingWorkbench
        submissionId={submission.id}
        studentName={submission.student.fullName}
        submittedAt={submission.submittedAt?.toISOString() ?? null}
        feedback={submission.feedback}
        questions={questions}
        totalMarks={submission.assessment.totalMarks}
        autoScore={submission.autoScore}
        manualScore={submission.manualScore}
      />
    </div>
  );
}