"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError } from "@/lib/apiClient";
import type { DoubtView } from "@/services/practicalService";
import { CheckCircle2, HelpCircle, Inbox, Paperclip, Send, X } from "lucide-react";

type Filter = "ALL" | "OPEN" | "ANSWERED" | "SATISFIED";

/** The doubt inbox: every student question, with the answer box inline. */
export function DoubtInbox() {
  const [doubts, setDoubts] = useState<DoubtView[] | null>(null);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const url = new URL("/api/admin/practical/doubts", window.location.origin);
      if (filter !== "ALL") url.searchParams.set("status", filter);
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load the inbox.");
      setDoubts(json.doubts as DoubtView[]);
    } catch (e) {
      toast.error(friendlyError(e, "Could not load the inbox."));
      setDoubts([]);
    }
  }, [filter]);

  // Deferred a tick so the fetch is not started from the effect body itself.
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const counts = useMemo(() => {
    const all = doubts ?? [];
    return {
      OPEN: all.filter((d) => d.status === "OPEN").length,
      ANSWERED: all.filter((d) => d.status === "ANSWERED").length,
      SATISFIED: all.filter((d) => d.status === "SATISFIED").length,
    };
  }, [doubts]);

  const active = (doubts ?? []).find((d) => d.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Inbox className="h-4 w-4 text-indigo-300" />
        <h2 className="text-lg font-semibold">Practical doubts</h2>
        <div className="ml-auto flex flex-wrap gap-1">
          {(["ALL", "OPEN", "ANSWERED", "SATISFIED"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "ALL" ? "All" : f === "ANSWERED" ? "Answered" : f.charAt(0) + f.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {filter !== "ALL" && doubts !== null && (
        <p className="text-xs text-muted-foreground">
          {counts.OPEN} waiting on you, {counts.ANSWERED} answered but not yet confirmed, {counts.SATISFIED} satisfied.
        </p>
      )}

      {doubts !== null && doubts.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nothing here right now.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {(doubts ?? []).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelected(d.id)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                d.id === selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <StatusBadge status={d.status} />
                <span className="truncate text-sm font-medium">{d.student?.fullName ?? "Student"}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {new Date(d.lastActivityAt).toLocaleDateString()}
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{d.assignment?.title ?? "Practical"}</p>
              <p className="line-clamp-2 text-sm">{d.question?.stem ?? firstBody(d)}</p>
            </button>
          ))}
        </div>

        {active ? (
          <AdminThread
            key={active.id}
            doubt={active}
            onChanged={async () => {
              await load();
            }}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-10 text-sm text-muted-foreground">
            Pick a doubt to read it and answer.
          </div>
        )}
      </div>
    </div>
  );
}

function firstBody(d: DoubtView) {
  return d.messages[0]?.body ?? "(no message)";
}

function StatusBadge({ status }: { status: DoubtView["status"] }) {
  if (status === "OPEN") return <Badge variant="destructive">Waiting</Badge>;
  if (status === "ANSWERED") return <Badge>Awaiting confirmation</Badge>;
  return <Badge variant="secondary">Satisfied</Badge>;
}

function AdminThread({ doubt, onChanged }: { doubt: DoubtView; onChanged: () => void | Promise<void> }) {
  const [body, setBody] = useState("");
  const [working, setWorking] = useState(false);
  const closed = doubt.status === "SATISFIED";

  const send = async () => {
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/practical/doubts/${doubt.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not send that.");
      setBody("");
      await onChanged();
      toast.success("Answer sent.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not send that."));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={doubt.status} />
        <p className="text-sm font-medium">{doubt.student?.fullName ?? "Student"}</p>
        <span className="text-xs text-muted-foreground">
          {doubt.assignment?.title} · {doubt.assignment?.topic}
        </span>
      </div>
      {doubt.question?.stem && (
        <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">{doubt.question.stem}</p>
      )}

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {doubt.messages.map((m) => {
          const mine = m.authorRole === "ADMIN";
          return (
            <div key={m.id} className={`rounded-lg border p-3 ${mine ? "border-primary/40 bg-primary/5" : "border-border"}`}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {mine ? "You" : doubt.student?.fullName ?? "Student"} · {new Date(m.createdAt).toLocaleString()}
              </p>
              {m.body && <p className="whitespace-pre-wrap text-sm">{m.body}</p>}
              {m.codeExcerpt && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    <Paperclip className="mr-1 inline h-3 w-3" />
                    Their code
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 font-mono text-xs">{m.codeExcerpt}</pre>
                </details>
              )}
              {m.terminalExcerpt && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Their output</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 font-mono text-xs">{m.terminalExcerpt}</pre>
                </details>
              )}
              {m.recordings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.recordings.map((r) =>
                    r.deletedAt ? (
                      <p key={r.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <X className="h-3 w-3" /> {r.kind === "SCREEN" ? "Screen" : "Voice"} recording deleted
                      </p>
                    ) : (
                      <AdminRecording key={r.id} id={r.id} kind={r.kind} mimeType={r.mimeType} />
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {closed ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          The student confirmed this helped, and their recordings were deleted.
        </p>
      ) : (
        <>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Answer the doubt. Plain language works better than a full solution."
            rows={3}
          />
          <Button size="sm" onClick={() => void send()} disabled={!body.trim() || working}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Send answer
          </Button>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The thread closes and its recordings are deleted once the student confirms your answer helped.
          </p>
        </>
      )}
    </div>
  );
}

function AdminRecording({ id, kind, mimeType }: { id: string; kind: "SCREEN" | "VOICE"; mimeType: string }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/admin/practical/doubts/recordings/${id}`;
  if (failed)
    return <p className="text-xs text-muted-foreground">{kind === "SCREEN" ? "Screen" : "Voice"} clip unavailable.</p>;
  return (
    <div className="flex items-center gap-2">
      {kind === "SCREEN" ? (
        <video
          controls
          preload="metadata"
          className="max-h-48 rounded border border-border"
          onError={() => setFailed(true)}
          src={src}
        />
      ) : (
        <audio controls preload="metadata" className="w-full max-w-xs" onError={() => setFailed(true)}>
          <source src={src} type={mimeType} />
        </audio>
      )}
    </div>
  );
}