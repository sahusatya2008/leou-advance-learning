"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError } from "@/lib/apiClient";
import type { DoubtView } from "@/services/practicalService";
import {
  CheckCircle2,
  HelpCircle,
  Mic,
  MonitorUp,
  Paperclip,
  Send,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";

type DoubtMessage = DoubtView["messages"][number];

async function callDoubts(method: "GET" | "POST" | "PUT", body?: unknown, query?: Record<string, string>) {
  const url = new URL("/api/student/practicals/doubts", window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "That did not work.");
  return json;
}

export function DoubtPanel({
  assignmentId,
  questionId,
  currentCode,
  lastOutput,
}: {
  assignmentId: string;
  questionId: string;
  currentCode: string;
  lastOutput: string;
}) {
  const [doubts, setDoubts] = useState<DoubtView[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await callDoubts("GET", undefined, { assignmentId, questionId });
      setDoubts(res.doubts as DoubtView[]);
    } catch (e) {
      toast.error(friendlyError(e, "Could not load your doubts."));
      setDoubts([]);
    }
  }, [assignmentId, questionId]);

  // Deferred by a tick so the fetch is not kicked off during the effect body.
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const live = (doubts ?? []).filter((d) => d.status !== "SATISFIED");
  const answered = live.filter((d) => d.status === "ANSWERED");

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <HelpCircle className="h-4 w-4 text-indigo-300" />
        <p className="text-sm font-medium">Stuck on this one?</p>
        {live.length > 0 && <Badge variant="secondary">{live.length} open</Badge>}
        {answered.length > 0 && <Badge>{answered.length} answered</Badge>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Ask a doubt"}
        </Button>
      </div>

      {doubts !== null && doubts.length === 0 && !open && (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          You have not asked anything about this question yet.
        </p>
      )}

      {open && (
        <AskForm
          assignmentId={assignmentId}
          questionId={questionId}
          currentCode={currentCode}
          lastOutput={lastOutput}
          onCancel={() => setOpen(false)}
          onDone={async () => {
            setOpen(false);
            await load();
          }}
        />
      )}

      {(doubts ?? []).map((d) => (
        <Thread
          key={d.id}
          doubt={d}
          onChanged={async () => {
            await load();
          }}
          onSatisfied={async (deleted) => {
            if (deleted > 0)
              toast.success("Thanks — your recordings have been deleted with this thread.");
            else toast.success("Thanks for letting us know.");
            await load();
          }}
        />
      ))}
    </div>
  );
}

function AskForm({
  assignmentId,
  questionId,
  currentCode,
  lastOutput,
  onCancel,
  onDone,
}: {
  assignmentId: string;
  questionId: string;
  currentCode: string;
  lastOutput: string;
  onCancel: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [attachCode, setAttachCode] = useState(false);
  const [attachOutput, setAttachOutput] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorder = useRecording();

  const submit = async () => {
    setBusy(true);
    try {
      const res = await callDoubts("POST", {
        action: "create",
        assignmentId,
        questionId,
        body,
        codeExcerpt: attachCode ? currentCode : undefined,
        terminalExcerpt: attachOutput ? lastOutput : undefined,
      });
      const doubt = res.doubt as DoubtView;

      // Recordings can only be attached after the thread exists, so they are
      // uploaded second, one at a time.
      for (const clip of recorder.takePending()) {
        const form = new FormData();
        form.set("doubtId", doubt.id);
        form.set("kind", clip.kind);
        form.set("consent", "true");
        form.set("file", new File([clip.blob], clip.kind === "VOICE" ? "voice.webm" : "screen.webm", { type: clip.blob.type }));
        const up = await fetch("/api/student/practicals/doubts", { method: "PUT", body: form });
        if (!up.ok) {
          const json = await up.json().catch(() => ({}));
          toast.error(json.error ?? "That recording could not be attached.");
        }
      }
      setBody("");
      toast.success("Doubt sent. Your teacher will see it.");
      await onDone();
    } catch (e) {
      toast.error(friendlyError(e, "Could not send that."));
    } finally {
      setBusy(false);
    }
  };

  const canSend = body.trim().length > 0 || attachCode || attachOutput;

  return (
    <div className="space-y-3 border-b border-border px-4 py-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you expect to happen, and what happened instead?"
        rows={3}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={attachCode ? "default" : "outline"} onClick={() => setAttachCode((v) => !v)}>
          <Paperclip className="mr-1.5 h-3.5 w-3.5" />
          {attachCode ? "Code attached" : "Attach my code"}
        </Button>
        <Button size="sm" variant={attachOutput ? "default" : "outline"} onClick={() => setAttachOutput((v) => !v)}>
          <Paperclip className="mr-1.5 h-3.5 w-3.5" />
          {attachOutput ? "Output attached" : "Attach last output"}
        </Button>
        <RecorderControls recorder={recorder} />
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Only you and the teachers can see this thread. Anything you record is deleted as soon as
        you mark the answer as helping, or after 30 days if the thread is still open.
      </p>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => void submit()} disabled={!canSend || busy}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> Send
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

type PendingClip = { kind: "SCREEN" | "VOICE"; blob: Blob; durationMs: number };

/** MediaRecorder plumbing for voice and screen capture. */
function useRecording() {
  const [active, setActive] = useState<"SCREEN" | "VOICE" | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [pending, setPending] = useState<PendingClip[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  // getDisplayMedia is Chromium-only in practice; hide the control rather than
  // offering something that will fail. Read once during initial state instead of
  // probing in an effect, which would cost an extra render.
  const [screenSupported] = useState(
    () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia)
  );

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [active]);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const start = async (kind: "SCREEN" | "VOICE") => {
    try {
      const media =
        kind === "SCREEN"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
          : await navigator.mediaDevices.getUserMedia({ audio: true });

      stream.current = media;
      chunks.current = [];
      const mime = kind === "SCREEN" ? "video/webm" : "audio/webm";
      const rec = new MediaRecorder(media, mimeTypeSupported(mime) ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: mime });
        if (blob.size > 0)
          setPending((prev) => [
            ...prev,
            { kind, blob, durationMs: Math.max(0, Date.now() - startedAt.current) },
          ]);
        stopTracks();
        setActive(null);
        setSeconds(0);
      };
      // Screen sharing can be stopped from the browser's own bar.
      if (kind === "SCREEN") media.getVideoTracks()[0]?.addEventListener("ended", () => rec.stop());
      rec.start(250);
      recorder.current = rec;
      startedAt.current = Date.now();
      setActive(kind);
    } catch (e) {
      stopTracks();
      toast.error(friendlyError(e, "Recording did not start."));
    }
  };

  const stop = () => {
    recorder.current?.stop();
    recorder.current = null;
  };

  return {
    active,
    seconds,
    screenSupported,
    pendingCount: pending.length,
    start,
    stop,
    takePending: () => {
      const clips = pending;
      setPending([]);
      return clips;
    },
  };
}

function mimeTypeSupported(mime: string) {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime);
}

function RecorderControls({ recorder }: { recorder: ReturnType<typeof useRecording> }) {
  if (recorder.active === "VOICE" || recorder.active === "SCREEN") {
    return (
      <Button size="sm" variant="destructive" onClick={recorder.stop}>
        <Square className="mr-1.5 h-3.5 w-3.5" /> Stop ({recorder.seconds}s)
      </Button>
    );
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void recorder.start("VOICE")}>
        <Mic className="mr-1.5 h-3.5 w-3.5" /> Record voice
      </Button>
      {recorder.screenSupported && (
        <Button size="sm" variant="outline" onClick={() => void recorder.start("SCREEN")}>
          <MonitorUp className="mr-1.5 h-3.5 w-3.5" /> Record screen
        </Button>
      )}
      {recorder.pendingCount > 0 && (
        <Badge variant="secondary">{recorder.pendingCount} clip(s) ready to send</Badge>
      )}
    </>
  );
}

function Thread({
  doubt,
  onChanged,
  onSatisfied,
}: {
  doubt: DoubtView;
  onChanged: () => void | Promise<void>;
  onSatisfied: (deleted: number) => void | Promise<void>;
}) {
  const [reply, setReply] = useState("");
  const [working, setWorking] = useState(false);
  const closed = doubt.status === "SATISFIED";

  const send = async () => {
    setWorking(true);
    try {
      await callDoubts("POST", { action: "reply", doubtId: doubt.id, body: reply });
      setReply("");
      await onChanged();
    } catch (e) {
      toast.error(friendlyError(e, "Could not send that."));
    } finally {
      setWorking(false);
    }
  };

  const satisfy = async () => {
    setWorking(true);
    try {
      const res = await callDoubts("POST", { action: "satisfied", doubtId: doubt.id });
      await onSatisfied(Number(res.recordingsDeleted ?? 0));
    } catch (e) {
      toast.error(friendlyError(e, "Could not close that thread."));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3 border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex items-center gap-2">
        <Badge variant={doubt.status === "OPEN" ? "destructive" : doubt.status === "ANSWERED" ? "default" : "secondary"}>
          {doubt.status === "SATISFIED" ? "Satisfied" : doubt.status === "ANSWERED" ? "Answered" : "Waiting for a reply"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(doubt.createdAt).toLocaleString()}
        </span>
        {doubt.status === "ANSWERED" && !closed && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => void satisfy()} disabled={working}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> This helped
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {doubt.messages.map((m: DoubtMessage) => (
          <Message key={m.id} message={m} />
        ))}
      </div>

      {!closed && (
        <div className="flex gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add more detail…"
            rows={2}
          />
          <Button size="sm" onClick={() => void send()} disabled={!reply.trim() || working}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function Message({ message }: { message: DoubtMessage }) {
  const mine = message.authorRole === "STUDENT";
  return (
    <div className={`rounded-lg border p-3 ${mine ? "border-border bg-background/40" : "border-primary/40 bg-primary/5"}`}>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {mine ? "You" : "Teacher"} · {new Date(message.createdAt).toLocaleTimeString()}
      </p>
      {message.body && <p className="whitespace-pre-wrap text-sm">{message.body}</p>}

      {message.codeExcerpt && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">Code you attached</summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 font-mono text-xs">{message.codeExcerpt}</pre>
        </details>
      )}
      {message.terminalExcerpt && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">Output you attached</summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 font-mono text-xs">{message.terminalExcerpt}</pre>
        </details>
      )}

      {message.recordings.length > 0 && (
        <div className="mt-2 space-y-1">
          {message.recordings.map((r) =>
            r.deletedAt ? (
              <p key={r.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <X className="h-3 w-3" />
                {r.kind === "SCREEN" ? "Screen" : "Voice"} recording deleted
              </p>
            ) : (
              <Recording key={r.id} id={r.id} kind={r.kind} mimeType={r.mimeType} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function Recording({ id, kind, mimeType }: { id: string; kind: "SCREEN" | "VOICE"; mimeType: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <p className="text-xs text-muted-foreground">
        {kind === "SCREEN" ? "Screen" : "Voice"} recording could not be played here.
      </p>
    );
  return (
    <div className="flex items-center gap-2">
      {kind === "SCREEN" ? (
        <video
          controls
          preload="metadata"
          className="max-h-48 rounded border border-border"
          onError={() => setFailed(true)}
          src={`/api/student/practicals/doubts/recordings/${id}`}
        />
      ) : (
        <audio controls preload="metadata" className="w-full max-w-xs" onError={() => setFailed(true)}>
          <source src={`/api/student/practicals/doubts/recordings/${id}`} type={mimeType} />
        </audio>
      )}
    </div>
  );
}