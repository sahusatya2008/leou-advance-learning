"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Trash2, Wand2, Rocket, ClipboardCheck } from "lucide-react";
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
import type { AssessmentStatus } from "@/generated/prisma/enums";

const NEXT: Partial<Record<AssessmentStatus, AssessmentStatus>> = {
  DRAFT: "SCHEDULED",
  SCHEDULED: "RELEASED",
  RELEASED: "CLOSED",
  ACTIVE: "CLOSED",
};

const LABEL: Record<AssessmentStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Schedule",
  RELEASED: "Release / publish",
  ACTIVE: "Close",
  CLOSED: "Close",
  EVALUATED: "Evaluated",
  RELEASED_TO_STUDENTS: "Released",
};

export default function AssessmentStatusActions({
  assessmentId,
  status,
  submissionsCount,
  hasStartTime,
}: {
  assessmentId: string;
  status: AssessmentStatus;
  submissionsCount: number;
  hasStartTime: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<AssessmentStatus | "delete" | "evaluate" | "release" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const to = NEXT[status];

  const transition = async (next: AssessmentStatus) => {
    setBusy(next);
    const res = await fetch(`/api/admin/assessments/${assessmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? "Transition failed.");
    if (next === "SCHEDULED" && !hasStartTime) toast.info("Set a future start time to schedule; leaving as draft.");
    toast.success("Assessment updated.");
    router.refresh();
  };

  const runAction = async (action: "evaluate" | "release") => {
    setBusy(action);
    const res = await fetch(`/api/admin/assessments/${assessmentId}/${action}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? `${action} failed.`);
    toast.success(action === "evaluate" ? `Auto-graded ${body.submissionsTouched ?? 0} submission(s).` : `Released ${body.released ?? 0} result(s).`);
    router.refresh();
  };

  const doDelete = async () => {
    setBusy("delete");
    const res = await fetch(`/api/admin/assessments/${assessmentId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? "Delete failed.");
      return;
    }
    toast.success("Assessment deleted.");
    router.push("/admin/assessments");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {to && submissionsCount === 0 && (
        <Button size="sm" disabled={!!busy} onClick={() => void transition(to)}>
          {busy === to && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {status === "DRAFT" ? (hasStartTime ? "Schedule" : "Release as draft-open") : LABEL[to]}
        </Button>
      )}
      {to && status === "RELEASED" && submissionsCount > 0 && (
        <Button size="sm" disabled={!!busy} onClick={() => void transition(to)}>
          {busy === to && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Close
        </Button>
      )}
      {["CLOSED", "EVALUATED"].includes(status) && (
        <Button
          size="sm"
          variant={status === "CLOSED" ? "default" : "outline"}
          disabled={!!busy}
          onClick={() => void runAction("evaluate")}
        >
          {busy === "evaluate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Evaluate &amp; auto-grade
        </Button>
      )}
      {status === "EVALUATED" && (
        <Button size="sm" disabled={!!busy} onClick={() => void runAction("release")}>
          {busy === "release" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
          Release results
        </Button>
      )}
      {submissionsCount > 0 && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/admin/assessments/${assessmentId}/grading`}>
            <ClipboardCheck className="mr-2 h-4 w-4" /> Grading
          </Link>
        </Button>
      )}
      {(status === "DRAFT" || status === "SCHEDULED") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-destructive">
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the assessment and its question list. Submissions cannot exist yet.
                {error && <span className="mt-2 block text-sm font-medium text-destructive">{error}</span>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setError(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); void doDelete(); }} disabled={busy === "delete"}>
                {busy === "delete" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}