import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { kindBadge } from "@/lib/assessmentConstants";

export const dynamic = "force-dynamic";

export default async function ResultDetailPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;
  const { submissionId } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assessment: {
        include: {
          batch: { include: { classRoom: { select: { name: true } } } },
          questions: {
            include: {
              question: {
                include: {
                  options: { orderBy: { sortOrder: "asc" } },
                  subject: { select: { name: true } },
                },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      },
      answers: true,
    },
  });
  if (!submission || submission.studentId !== profId || submission.totalScore == null) notFound();

  const answerByAq = new Map(submission.answers.map((a) => [a.assessmentQuestionId, a]));
  const aq = submission.assessment.questions;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/results" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All results
        </Link>
        <Badge variant="outline">{kindBadge(submission.assessment.kind)}</Badge>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{submission.assessment.title}</h1>
          <p className="text-sm text-muted-foreground">
            {submission.assessment.batch.classRoom.name} · {submission.assessment.batch.name} · Released{" "}
            {submission.releasedAt?.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-300" />
          <span className="text-3xl font-bold">{submission.totalScore}</span>
          <span className="text-lg text-muted-foreground">/ {submission.assessment.totalMarks}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
        <MiniStat label="Auto-graded" value={submission.autoScore} />
        <MiniStat label="Manually graded" value={submission.manualScore} />
        <MiniStat label="Answered" value={`${submission.answers.length}/${aq.length}`} />
      </div>

      {submission.feedback && (
        <p className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">{submission.feedback}</p>
      )}

      <div className="space-y-4">
        {aq.map((item, i) => {
          const answer = answerByAq.get(item.id);
          const result = answer?.autoResult as { correct?: boolean; passed?: number; total?: number; detail?: string } | null;
          const awarded = answer?.marksAwarded;
          return (
            <Card key={item.id} className="glass">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">{i + 1}</span>
                  <Badge variant="outline">{item.question.type}</Badge>
                  <Badge variant="secondary">{item.question.subject.name}</Badge>
                  {awarded != null ? (
                    <Badge variant={awarded === item.marks ? "default" : "secondary"}>
                      {awarded} / {item.marks} pts
                    </Badge>
                  ) : (
                    <Badge variant="outline">{item.marks} pts</Badge>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-xs">
                    {awarded == null ? (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    ) : awarded >= item.marks ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-400" />
                    )}
                    {awarded == null ? "not answered" : `${Math.round((awarded / item.marks) * 100)}%`}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="whitespace-pre-wrap">{item.question.stem}</p>

                {item.question.type === "MCQ" && (
                  <ul className="space-y-1">
                    {item.question.options.map((o) => {
                      const chosen = ((answer?.payload as { optionIds?: string[] })?.optionIds ?? []).includes(o.id);
                      return (
                        <li key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${o.isCorrect ? "border-emerald-500/40 bg-emerald-500/10" : "border-border"}`}>
                          {o.isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : chosen ? <XCircle className="h-4 w-4 text-red-400" /> : <span className="h-4 w-4" />}
                          <span>{o.text}</span>
                          {chosen && <Badge variant="outline" className="ml-auto">your choice</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {(item.question.type === "SHORT" || item.question.type === "LONG") && (
                  <div className="rounded-lg border border-border bg-background/40 p-3">
                    <p className="whitespace-pre-wrap">{(answer?.payload as { text?: string })?.text ?? "No answer."}</p>
                  </div>
                )}

                {(item.question.type === "ORAL" || item.question.type === "UPLOAD") && (
                  <div className="space-y-2">
                    {((answer?.payload as { fileUrls?: string[] })?.fileUrls ?? []).map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="block truncate rounded-lg border border-border px-3 py-2 text-primary hover:underline">
                        {u.split("/").pop()}
                      </a>
                    ))}
                  </div>
                )}

                {item.question.type === "CODING" && (
                  <div className="space-y-2">
                    <Badge variant="secondary">{(answer?.payload as { language?: string })?.language ?? "—"}</Badge>
                    <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-[#0b0f14] p-3 font-mono text-xs text-green-200">
                      {(answer?.payload as { code?: string })?.code ?? "(no code)"}
                    </pre>
                    {result && (
                      <p className="text-xs text-muted-foreground">
                        {result.passed}/{result.total} test cases passed{result.detail ? ` · ${result.detail}` : ""}
                      </p>
                    )}
                  </div>
                )}

                {item.question.type === "SQL" && (
                  <div className="space-y-2">
                    <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-[#0b0f14] p-3 font-mono text-xs text-cyan-200">
                      {(answer?.payload as { query?: string })?.query ?? "(no query)"}
                    </pre>
                    {result && <p className="text-xs text-muted-foreground">{result.detail}</p>}
                  </div>
                )}

                {item.question.explanation && (
                  <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                    <span className="font-medium">Model answer:</span> {item.question.explanation}
                  </p>
                )}

                {answer?.feedback && <p className="rounded-lg border-border bg-secondary/40 px-3 py-2 text-xs italic border">{answer.feedback}</p>}

                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <span className="text-xs text-muted-foreground">
                    {answer == null ? "No answer recorded" : answer.isAutoCorrect ? "Auto-graded" : "Manually graded"}
                  </span>
                  <span className="text-xs font-semibold">{awarded != null ? `${awarded} / ${item.marks}` : "pending"} pts</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/dashboard/classes">Back to My Classes</Link>
        </Button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="glass">
      <CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}