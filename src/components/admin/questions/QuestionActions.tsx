"use client";

import { useState } from "react";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import QuestionForm, { type QuestionInitial } from "@/components/admin/questions/QuestionForm";

export type QuestionRow = {
  id: string;
  type: string;
  stem: string;
  explanation: string | null;
  imageUrl: string | null;
  difficulty: string;
  classRoomId: string;
  subjectId: string;
  topic: string | null;
  isPractical?: boolean;
  tags?: unknown;
  allowedLanguages: unknown;
  starterCode: unknown;
  solutionCode: string | null;
  sqlDialect: string | null;
  sqlSchemaSql: string | null;
  sqlSeedSql: string | null;
  sqlExpectedResult: unknown;
  sqlComparisonMode: string | null;
  options: { id: string; text: string | null; imageUrl: string | null; isCorrect: boolean }[];
  testCases: { id: string; input: string; expected: string; isHidden: boolean; weight: number }[];
  _count: { inAssessments: number };
};

export default function QuestionActions({
  question,
  classes,
  topicsBySubject,
}: {
  question: QuestionRow;
  classes: { id: string; name: string; hasStreams: boolean; subjects: { id: string; name: string }[] }[];
  topicsBySubject?: { subjectId: string; topics: string[] }[];
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/questions/${question.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({ error: "Delete failed." }));
      if (!res.ok) {
        setError(body.error ?? "Delete failed.");
        setDeleting(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Delete failed.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <QuestionForm
        classes={classes}
        topicsBySubject={topicsBySubject}
        question={{
          id: question.id,
          type: question.type as QuestionInitial["type"],
          stem: question.stem,
          explanation: question.explanation ?? undefined,
          imageUrl: question.imageUrl ?? undefined,
          difficulty: question.difficulty as QuestionInitial["difficulty"],
          classRoomId: question.classRoomId,
          subjectId: question.subjectId,
          topic: question.topic ?? undefined,
          isPractical: question.isPractical ?? false,
          tags: Array.isArray(question.tags) ? (question.tags as string[]) : [],
          allowedLanguages: Array.isArray(question.allowedLanguages) ? (question.allowedLanguages as string[]) : [],
          starterCode:
            question.starterCode && typeof question.starterCode === "object"
              ? (question.starterCode as Record<string, string>)
              : {},
          solutionCode: question.solutionCode ?? undefined,
          sqlDialect: (question.sqlDialect as QuestionInitial["sqlDialect"]) ?? undefined,
          sqlSchemaSql: question.sqlSchemaSql ?? undefined,
          sqlSeedSql: question.sqlSeedSql ?? undefined,
          sqlExpectedResult:
            question.sqlExpectedResult && typeof question.sqlExpectedResult === "object"
              ? JSON.stringify(question.sqlExpectedResult, null, 2)
              : undefined,
          sqlComparisonMode: question.sqlComparisonMode ?? undefined,
          options: question.options.map((o) => ({
            text: o.text ?? "",
            imageUrl: o.imageUrl ?? undefined,
            isCorrect: o.isCorrect,
          })),
          testCases: question.testCases.map((t) => ({
            input: t.input,
            expected: t.expected,
            isHidden: t.isHidden,
            weight: t.weight,
          })),
        }}
        trigger={
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the question. Questions already used in an assessment cannot be deleted.
              {error && <span className="mt-2 block text-sm font-medium text-destructive">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setError(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}