"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Save, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GradeQ = {
  aqId: string;
  order: number;
  marks: number;
  type: string;
  stem: string;
  subject: string;
  options: { id: string; text: string | null; isCorrect: boolean }[];
  explanation: string | null;
  testCases: { input: string; expected: string }[];
  sqlExpectedResult: unknown;
  answer?: {
    id: string;
    payload: unknown;
    marksAwarded: number | null;
    feedback: string | null;
    isAutoCorrect: boolean | null;
    autoResult: { correct?: boolean; passed?: number; total?: number; detail?: string } | null;
  };
};

export default function GradingWorkbench({
  submissionId,
  studentName,
  submittedAt,
  feedback: overallFeedback,
  questions,
  totalMarks,
  autoScore,
  manualScore,
}: {
  submissionId: string;
  studentName: string;
  submittedAt: string | null;
  feedback: string | null;
  questions: GradeQ[];
  totalMarks: number;
  autoScore: number;
  manualScore: number;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      if (q.answer?.marksAwarded != null) init[q.answer.id] = String(q.answer.marksAwarded);
    }
    return init;
  });
  const [fb, setFb] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      if (q.answer?.feedback) init[q.answer.id] = q.answer.feedback;
    }
    return init;
  });
  const [overallFb, setOverallFb] = useState(overallFeedback ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const answers = questions.flatMap((q) => {
      if (!q.answer) return [];
      const val = Number(marks[q.answer.id]);
      if (!Number.isFinite(val) || val < 0) {
        toast.error(`Marks for Q${q.order} must be a number ≥ 0.`);
        return [];
      }
      if (val > q.marks) {
        toast.error(`Q${q.order} is worth ${q.marks} marks max.`);
        return [];
      }
      return [{ answerId: q.answer.id, marksAwarded: val, feedback: fb[q.answer.id]?.trim() || undefined }];
    });
    if (answers.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, feedback: overallFb || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(body.error ?? "Save failed.");
      toast.success("Grades saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const done = questions.every((q) => q.answer?.marksAwarded != null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{studentName}</p>
          <p className="text-xs text-muted-foreground">
            Submitted {submittedAt ? new Date(submittedAt).toLocaleString() : "—"} · {done ? "fully graded" : "manual marks remaining"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Auto {autoScore}</Badge>
          <Badge variant="secondary">Manual {manualScore}</Badge>
          <Badge variant="outline">{autoScore + manualScore} / {totalMarks}</Badge>
          <Button size="sm" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save grades
          </Button>
        </div>
      </div>

      {questions.map((q) => (
        <Card key={q.aqId} className="glass">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">{q.order}</span>
              <Badge variant="outline">{q.type}</Badge>
              <Badge variant="secondary">{q.subject}</Badge>
              <span className="ml-auto text-xs font-medium">{q.marks} pts</span>
              {q.answer?.isAutoCorrect === true && (
                <Badge className={q.answer.autoResult?.correct ? "gap-1 bg-emerald-500/20 text-emerald-200" : "gap-1 bg-red-500/20 text-red-200"}>
                  {q.answer.autoResult?.correct ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} auto
                </Badge>
              )}
              {q.answer && q.answer.isAutoCorrect !== true && (
                <Badge variant="secondary" className="gap-1"><MinusCircle className="h-3 w-3" /> manual</Badge>
              )}
            </div>
            <CardTitle className="pt-2 text-sm font-medium">Q{q.order}. {q.stem}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {q.type === "MCQ" && q.answer && (
              <ul className="space-y-1 text-sm">
                {(q.answer.payload as { optionIds?: string[] }).optionIds?.length === 0 && <li className="text-muted-foreground">No option selected.</li>}
                {q.options.map((o) => {
                  const chosen = ((q.answer?.payload as { optionIds?: string[] })?.optionIds ?? []).includes(o.id);
                  return (
                    <li key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${o.isCorrect ? "border-emerald-500/40 bg-emerald-500/10" : "border-border"}`}>
                      {o.isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-muted-foreground/50" />}
                      <span className={chosen ? "font-medium" : "text-muted-foreground"}>{o.text ?? "(image)"}</span>
                      {chosen && <Badge variant="outline" className="ml-auto">student chose</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}

            {(q.type === "SHORT" || q.type === "LONG") && (
              <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                <p className="whitespace-pre-wrap">{(q.answer?.payload as { text?: string })?.text || <span className="text-muted-foreground">No answer.</span>}</p>
              </div>
            )}

            {(q.type === "ORAL" || q.type === "UPLOAD") && (
              <div className="space-y-2">
                {((q.answer?.payload as { fileUrls?: string[] })?.fileUrls ?? []).length === 0 && <p className="text-sm text-muted-foreground">No files uploaded.</p>}
                {((q.answer?.payload as { fileUrls?: string[] })?.fileUrls ?? []).map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block truncate rounded-lg border border-border px-3 py-2 text-sm text-primary hover:underline">
                    {u.split("/").pop()}
                  </a>
                ))}
              </div>
            )}

            {q.type === "CODING" && q.answer && (
              <div className="space-y-2">
                <Badge variant="secondary">{(q.answer.payload as { language?: string })?.language ?? "—"}</Badge>
                <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-[#0b0f14] p-3 font-mono text-xs text-green-200">
                  {(q.answer.payload as { code?: string })?.code || "(no code)"}
                </pre>
                {q.answer.autoResult && (
                  <p className="text-xs text-muted-foreground">
                    Test cases: {q.answer.autoResult.passed}/{q.answer.autoResult.total} passed{q.answer.autoResult.detail ? ` · ${q.answer.autoResult.detail}` : ""}
                  </p>
                )}
              </div>
            )}

            {q.type === "SQL" && q.answer && (
              <div className="space-y-2">
                <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-[#0b0f14] p-3 font-mono text-xs text-cyan-200">
                  {(q.answer.payload as { query?: string })?.query || "(no query)"}
                </pre>
                {q.answer.autoResult && <p className="text-xs text-muted-foreground">{q.answer.autoResult.detail}</p>}
              </div>
            )}

            {q.explanation && (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                <span className="font-medium">Model answer:</span> {q.explanation}
              </p>
            )}

            {(() => {
              const ans = q.answer;
              if (!ans) return null;
              return (
              <div className="grid gap-3 pt-1 sm:grid-cols-[140px_1fr]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Awarded marks</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    max={q.marks}
                    value={marks[ans.id] ?? ""}
                    placeholder={ans.marksAwarded != null ? String(ans.marksAwarded) : ""}
                    onChange={(e) => setMarks((prev) => ({ ...prev, [ans.id]: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Feedback</Label>
                  <Input
                    value={fb[ans.id] ?? ""}
                    placeholder={ans.autoResult?.detail ?? "Optional note for the student"}
                    onChange={(e) => setFb((prev) => ({ ...prev, [ans.id]: e.target.value }))}
                  />
                </div>
              </div>
              );
            })()}
          </CardContent>
        </Card>
      ))}

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Overall feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={2} value={overallFb} onChange={(e) => setOverallFb(e.target.value)} placeholder="Summary note to the student…" />
          <div className="mt-3 flex justify-end">
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save grades
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}