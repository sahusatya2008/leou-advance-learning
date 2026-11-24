"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Check, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { friendlyError } from "@/lib/apiClient";
import type { PracticalCatalog } from "@/services/practicalService";

type AssignmentDetail = {
  id: string;
  title: string;
  instructions: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  questions: {
    id: string;
    questionId: string;
    order: number;
    stem: string;
    type: string;
    difficulty: string;
  }[];
  available: { id: string; stem: string; type: string; difficulty: string }[];
};

const NONE = "__none__";
const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export default function PracticalBuilder({ catalog }: { catalog: PracticalCatalog }) {
  // Only the explicitly-chosen ids live in state. The effective class/batch/
  // subject/chapter is derived during render, so changing a parent select never
  // needs an effect to "push" a default down the cascade.
  const [classId, setClassId] = useState(catalog.classes[0]?.id ?? "");
  const [batchPick, setBatchPick] = useState("");
  const [subjectPick, setSubjectPick] = useState("");
  const [topicPick, setTopicPick] = useState("");

  const cls = catalog.classes.find((c) => c.id === classId);
  const batch = cls?.batches.find((b) => b.id === batchPick) ?? cls?.batches[0];
  const subject = batch?.subjects.find((s) => s.id === subjectPick) ?? batch?.subjects[0];
  const chapters = subject?.chapters ?? [];
  const topic = topicPick && chapters.includes(topicPick) ? topicPick : (chapters[0] ?? "");

  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");

  const key = batch?.id && subject?.id && topic ? `${batch.id}|${subject.id}|${topic}` : null;
  const loading = key !== null && settledKey !== key;

  // Every setState below happens after an await, so there is no synchronous
  // state update in the effect body and no cascading render.
  useEffect(() => {
    if (!key || !batch?.id || !subject?.id) return;
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ batchId: batch.id!, subjectId: subject.id!, topic });
      try {
        const res = await fetch(`/api/admin/practical?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load this practical.");
          setDetail(null);
        } else {
          setDetail(data.assignment ?? null);
          setTitle(data.assignment?.title ?? `${topic} — Practical`);
          setInstructions(data.assignment?.instructions ?? "");
        }
      } catch {
        if (!cancelled) setError("Could not load this practical.");
      } finally {
        // Only mark the key settled here: clearing the error would immediately
        // erase the message set above.
        if (!cancelled) setSettledKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, batch?.id, subject?.id, topic]);

  async function post(body: Record<string, unknown>, okMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/practical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That did not work.");
      setNotice(okMessage);
      // Re-read from the server so the set is never based on a stale guess.
      setSettledKey(null);
      return true;
    } catch (e) {
      setError(friendlyError(e, "That did not work. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const statusTone = useMemo(() => {
    if (detail?.status === "PUBLISHED") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    if (detail?.status === "ARCHIVED") return "bg-muted text-muted-foreground";
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }, [detail?.status]);

  if (catalog.classes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No batch takes Computer Science yet. Allot CS to a batch first &mdash; the builder follows the
        batch&apos;s own subject and chapter list.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">1. Class</span>
          <Select
            value={classId}
            onValueChange={(v) => {
              setClassId(v);
              setBatchPick("");
              setSubjectPick("");
              setTopicPick("");
              setSettledKey(null);
              setDetail(null);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {catalog.classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">2. Batch</span>
          <Select
            value={batch?.id ?? ""}
            onValueChange={(v) => {
              setBatchPick(v);
              setSubjectPick("");
              setTopicPick("");
              setSettledKey(null);
              setDetail(null);
            }}
            disabled={!cls}
          >
            <SelectTrigger><SelectValue placeholder="Pick a batch" /></SelectTrigger>
            <SelectContent>
              {cls?.batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">3. Subject</span>
          <Select
            value={subject?.id ?? ""}
            onValueChange={(v) => {
              setSubjectPick(v);
              setTopicPick("");
              setSettledKey(null);
              setDetail(null);
            }}
            disabled={!batch}
          >
            <SelectTrigger><SelectValue placeholder="Pick a subject" /></SelectTrigger>
            <SelectContent>
              {batch?.subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">4. Chapter</span>
          <Select
            value={topic || NONE}
            onValueChange={(v) => {
              setTopicPick(v === NONE ? "" : v);
              setSettledKey(null);
              setDetail(null);
            }}
            disabled={!subject}
          >
            <SelectTrigger><SelectValue placeholder="Pick a chapter" /></SelectTrigger>
            <SelectContent>
              {chapters.length === 0 ? (
                <SelectItem value={NONE} disabled>This batch has no chapters for this subject</SelectItem>
              ) : (
                chapters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)
              )}
            </SelectContent>
          </Select>
        </label>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {notice && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <Check className="h-4 w-4" /> {notice}
        </p>
      )}

      {!topic ? (
        <p className="text-sm text-muted-foreground">Pick a chapter to manage its practical set.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading&hellip;
        </p>
      ) : (
        <>
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{topic}</h2>
                {detail && <Badge className={statusTone}>{detail.status}</Badge>}
                <span className="text-xs text-muted-foreground">
                  {detail?.questions.length ?? 0} in set
                  {detail?.available.length ? ` \u00b7 ${detail.available.length} available` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {!detail ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      post({ action: "create", batchId: batch!.id, subjectId: subject!.id, topic, title, instructions }, "Practical set created.")
                    }
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Create practical set
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={busy || detail.questions.length === 0}
                      title={detail.questions.length === 0 ? "Add at least one question before publishing." : undefined}
                      onClick={() =>
                        post(
                          { action: "create", batchId: batch!.id, subjectId: subject!.id, topic, title, instructions, status: "PUBLISHED" },
                          "Published. Students in this batch can open it."
                        )
                      }
                    >
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || detail.status === "DRAFT"}
                      onClick={() =>
                        post(
                          { action: "create", batchId: batch!.id, subjectId: subject!.id, topic, title, instructions, status: "DRAFT" },
                          "Moved back to draft \u2014 students can no longer see it."
                        )
                      }
                    >
                      Unpublish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        post({ action: "create", batchId: batch!.id, subjectId: subject!.id, topic, title, instructions }, "Saved.")
                      }
                    >
                      Save details
                    </Button>
                  </>
                )}
              </div>
            </div>

            {detail && (
              <div className="grid gap-3">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Instructions shown to the student (optional)"
                  rows={2}
                />
              </div>
            )}
          </div>

          {detail && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Questions in this practical</h3>
                {detail.questions.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Nothing here yet. Add from the right, or{" "}
                    <a href="/admin/questions" className="underline">tag questions as practical</a> in the
                    question bank.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.questions.map((q, i) => (
                      <li key={q.id} className="flex items-start gap-2 rounded-lg border p-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm">{strip(q.stem)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{q.type} &middot; {q.difficulty}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Move up"
                            disabled={busy || i === 0}
                            onClick={() => {
                              const ids = detail.questions.map((x) => x.questionId);
                              [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                              void post({ action: "reorder", assignmentId: detail.id, orderedQuestionIds: ids }, "Reordered.");
                            }}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Move down"
                            disabled={busy || i === detail.questions.length - 1}
                            onClick={() => {
                              const ids = detail.questions.map((x) => x.questionId);
                              [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                              void post({ action: "reorder", assignmentId: detail.id, orderedQuestionIds: ids }, "Reordered.");
                            }}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove from practical"
                          disabled={busy}
                          onClick={() =>
                            post(
                              { action: "remove", assignmentId: detail.id, questionId: q.questionId },
                              "Removed from the practical."
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium">Practical questions in this chapter</h3>
                {detail.available.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No other practical-tagged questions for {topic}. Tick{" "}
                    <em>Practical question</em> when adding a question in the bank.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.available.map((q) => (
                      <li key={q.id} className="flex items-start gap-2 rounded-lg border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm">{strip(q.stem)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{q.type} &middot; {q.difficulty}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            post(
                              { action: "add", assignmentId: detail.id, questionId: q.id },
                              "Added to the practical."
                            )
                          }
                        >
                          <Plus className="mr-1 h-4 w-4" /> Add
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}