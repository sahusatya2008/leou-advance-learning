"use client";

import "@/lib/monaco";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { friendlyError } from "@/lib/apiClient";
import { DoubtPanel } from "@/components/student/DoubtPanel";
import type { StudentPracticalDetail } from "@/services/practicalService";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Play,
  Square,
  Star,
  Terminal as TerminalIcon,
} from "lucide-react";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-secondary/50" />,
});

type AttemptState = {
  id: string;
  language: string;
  code: string;
  status: "IN_PROGRESS" | "FINISHED";
};

type Line = { kind: "in" | "out" | "err" | "sys"; text: string };

/** Reserved tag that marks a question as very important; rendered as a distinct
 *  star badge and filtered out of the plain tag chips. */
const VERY_IMPORTANT_TAG = "very-important";

/**
 * The chapter's practical set is one set holding two blocks of exercises (the
 * schema allows one set per batch/subject/chapter), so the sidebar groups the
 * questions by the block tag they carry instead of listing them flat. A block
 * keeps the order its questions have in the set, which is the order the sheets
 * are written in.
 */
const BLOCKS = [
  { tag: "while-loop", label: "While loop", hint: "condition-driven loops" },
  { tag: "for-loop", label: "For loop", hint: "range() and iteration" },
] as const;

type Block = { tag: string; label: string; hint: string };

/** Anything without one of the known block tags still gets a home. */
const OTHER_BLOCK: Block = { tag: "other", label: "Other questions", hint: "mixed practice" };

/** Block labels used on the tag chips, so a student reads "For loop" rather
 *  than the raw `for-loop` tag. */
const BLOCK_LABELS = new Map<string, string>([
  ...BLOCKS.map((b) => [b.tag, b.label] as const),
  ["loop", "Loop"],
]);

function blockOf(tags: string[]): Block {
  return BLOCKS.find((b) => tags.includes(b.tag)) ?? OTHER_BLOCK;
}

/**
 * A stem can carry a fixed picture (the star patterns) inside a fenced block.
 * Split it out so the picture can be printed verbatim: a paragraph would
 * collapse its runs of spaces and the shape would arrive as a wall of stars.
 */
type StemPart = { kind: "text" | "code"; text: string };

function splitFences(stem: string): StemPart[] {
  const parts: StemPart[] = [];
  const re = /```[^\n]*\n([\s\S]*?)```/g;
  let last = 0;
  for (const m of stem.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ kind: "text", text: stem.slice(last, start) });
    parts.push({ kind: "code", text: (m[1] ?? "").replace(/\n$/, "") });
    last = start + m[0].length;
  }
  if (last < stem.length) parts.push({ kind: "text", text: stem.slice(last) });
  return parts.length ? parts : [{ kind: "text", text: stem }];
}

/** One line for the question list: the prose, without the picture block. */
function stemPreview(stem: string): string {
  return splitFences(stem)
    .filter((p) => p.kind === "text")
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function QuestionStem({ stem, className }: { stem: string; className?: string }) {
  return (
    <div className={className}>
      {splitFences(stem).map((part, i) =>
        part.kind === "code" ? (
          <pre
            key={i}
            data-stem="code"
            className="my-2 overflow-x-auto rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs leading-snug"
          >
            {part.text}
          </pre>
        ) : part.text.trim() ? (
          <p key={i} className="whitespace-pre-line">
            {part.text.trim()}
          </p>
        ) : null,
      )}
    </div>
  );
}

/** python writes its `>>>` prompt to stderr, so a stderr chunk is not necessarily
 * an error. Anything that is only a prompt renders as a neutral system line. */
function classifyStderr(chunk: string): Line {
  const text = chunk.replace(/\n$/, "");
  const promptsOnly = text
    .split("\n")
    .every((l) => l === "" || /^[\s]*>>>+[\s]*$/.test(l) || /^[\s]*\.\.\.[\s]*$/.test(l));
  return { kind: promptsOnly ? "sys" : "err", text };
}

async function callAttempt(body: Record<string, unknown>) {
  const res = await fetch("/api/student/practicals/attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "That did not work.");
  return json as Record<string, unknown>;
}

export function PracticalWorkspace({ practical }: { practical: StudentPracticalDetail }) {
  const [index, setIndex] = useState(0);
  // Blocks start expanded; collapsing one is how a student parks a finished
  // sheet while working through the other.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // The server prop is stable for the life of the page; naming it keeps the
  // grouping memo honest without listing the whole object as a dependency.
  const questions = practical.questions;

  // Seeded from what the server already knows, so reopening a tab lands on the
  // student's own code rather than the starter. `practical` is a server prop that
  // does not change under us, so a lazy initialiser is enough.
  const [attempts, setAttempts] = useState<Record<string, AttemptState>>(() => {
    const seeded: Record<string, AttemptState> = {};
    for (const q of practical.questions) {
      if (q.attempt)
        seeded[q.questionId] = {
          id: q.attempt.id,
          language: q.attempt.language ?? q.allowedLanguages[0] ?? "python",
          code: q.attempt.code ?? "",
          status: q.attempt.status,
        };
    }
    return seeded;
  });

  // Questions keep their global index so the panel and the block list stay in
  // step; blocks only slice the list, they never renumber it.
  const groups = useMemo(() => {
    const order = [...BLOCKS.map((b) => b.tag), OTHER_BLOCK.tag];
    const byTag = new Map<string, { block: Block; items: { item: (typeof questions)[number]; index: number }[] }>();
    questions.forEach((item, i) => {
      const block = blockOf(item.tags);
      const group = byTag.get(block.tag) ?? { block, items: [] };
      group.items.push({ item, index: i });
      byTag.set(block.tag, group);
    });
    return order
      .map((tag) => byTag.get(tag))
      .filter((g): g is NonNullable<typeof g> => Boolean(g && g.items.length));
  }, [questions]);

  const q = questions[index];

  if (!q) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        This practical has no questions yet.
      </div>
    );
  }

  const finished = practical.questions.filter(
    (x) => attempts[x.questionId]?.status === "FINISHED"
  ).length;
  const currentBlock = blockOf(q.tags);

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Questions · {finished}/{practical.questions.length} done
        </p>
        {groups.map(({ block, items }) => {
          const doneCount = items.filter(({ item }) => attempts[item.questionId]?.status === "FINISHED").length;
          const isCollapsed = collapsed[block.tag] ?? false;
          const holdsCurrent = items.some(({ index: i }) => i === index);
          return (
            <div key={block.tag} className="space-y-2">
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [block.tag]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                className="flex w-full items-baseline justify-between gap-2 border-b border-border/70 pb-1 text-left"
              >
                <span className="flex items-center gap-1">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
                    {block.label}
                  </span>
                  <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                    {block.hint}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {doneCount}/{items.length}
                </span>
              </button>
              {!isCollapsed &&
                items.map(({ item, index: i }, position) => {
                  const state = attempts[item.questionId];
                  const done = state?.status === "FINISHED";
                  const important = item.tags.includes(VERY_IMPORTANT_TAG);
                  return (
                    <button
                      key={item.questionId}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-current={i === index ? "true" : undefined}
                      className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                        i === index ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:border-primary/40"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="line-clamp-2">
                        <span className="mr-1 font-mono text-[11px] text-muted-foreground">{position + 1}.</span>
                        {important && <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                        {stemPreview(item.stem)}
                      </span>
                    </button>
                  );
                })}
              {isCollapsed && holdsCurrent && (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Working on question {index - items[0].index + 1} of {items.length}
                </p>
              )}
            </div>
          );
        })}
      </aside>

      <section className="min-w-0 space-y-4">
        <QuestionPanel
          key={q.questionId}
          practical={practical}
          question={q}
          attempt={attempts[q.questionId] ?? null}
          block={currentBlock}
          onAttempt={(next) =>
            setAttempts((prev) => ({ ...prev, [q.questionId]: next }))
          }
        />
      </section>
    </div>
  );
}

function QuestionPanel({
  practical,
  question,
  attempt,
  block,
  onAttempt,
}: {
  practical: StudentPracticalDetail;
  question: StudentPracticalDetail["questions"][number];
  attempt: AttemptState | null;
  block: Block;
  onAttempt: (next: AttemptState) => void;
}) {
  const language = attempt?.language ?? question.allowedLanguages[0] ?? "python";
  // Without an attempt there is no saved code yet, so seed the editor with the
  // question's own starter. Starting an attempt would do the same thing server
  // side (attempt.code = starter), which only showed up after the first Run -
  // students opened a question to a blank box.
  const [code, setCode] = useState(attempt?.code ?? question.starterCode?.[language] ?? "");
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(attempt?.status === "FINISHED");
  const [lastOutput, setLastOutput] = useState("");

  const ensureAttempt = useCallback(async (): Promise<AttemptState> => {
    if (attempt) return attempt;
    setStarting(true);
    try {
      const res = await callAttempt({
        action: "start",
        assignmentId: practical.id,
        questionId: question.questionId,
      });
      const a = res.attempt as { id: string; language: string; code: string; status: "IN_PROGRESS" | "FINISHED" };
      const next: AttemptState = { id: a.id, language: a.language, code: a.code, status: a.status };
      onAttempt(next);
      setFinished(a.status === "FINISHED");
      if (a.code) setCode(a.code);
      return next;
    } finally {
      setStarting(false);
    }
  }, [attempt, practical.id, question.questionId, onAttempt]);

  const save = useCallback(
    async (nextCode: string) => {
      const current = await ensureAttempt();
      setSaving(true);
      try {
        await callAttempt({
          action: "save",
          attemptId: current.id,
          code: nextCode,
          language: current.language,
        });
        onAttempt({ ...current, code: nextCode });
      } catch (e) {
        toast.error(friendlyError(e, "Could not save your code."));
      } finally {
        setSaving(false);
      }
    },
    [ensureAttempt, onAttempt]
  );

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Autosave on pause rather than on every keystroke: the attempt row keeps the
  // latest snapshot, and the event log records each save.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (code !== (attempt?.code ?? "") && !finished) void saveRef.current(code);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [code, attempt?.code, finished]);

  const markDone = async () => {
    const current = await ensureAttempt();
    try {
      await saveRef.current(code);
      await callAttempt({ action: "finish", attemptId: current.id });
      setFinished(true);
      onAttempt({ ...current, code, status: "FINISHED" });
      toast.success("Marked done. You can still reopen it.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not mark this done."));
    }
  };

  const reopen = async () => {
    // The attempt row really goes back to IN_PROGRESS; a local-only toggle would
    // leave the next autosave rejected as a write to a finished attempt.
    try {
      const current = await ensureAttempt();
      await callAttempt({ action: "reopen", attemptId: current.id });
      setFinished(false);
      onAttempt({ ...current, status: "IN_PROGRESS" });
      toast("Reopened — keep going.");
    } catch (e) {
      toast.error(friendlyError(e, "Could not reopen that attempt."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <QuestionStem
          stem={question.stem}
          className="max-w-2xl space-y-1 text-sm leading-relaxed"
        />
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            {block.label}
          </Badge>
          <Badge variant="secondary">{question.difficulty}</Badge>
          {question.tags.includes(VERY_IMPORTANT_TAG) && (
            <Badge variant="warning" className="border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]">
              <Star className="mr-1 h-3 w-3 fill-amber-400 text-amber-400" />
              Very Important
            </Badge>
          )}
          {question.tags
            .filter((t) => t !== VERY_IMPORTANT_TAG && !BLOCKS.some((b) => b.tag === t))
            .map((t) => (
              <Badge key={t} variant="outline">
                {BLOCK_LABELS.get(t) ?? t}
              </Badge>
            ))}
          {finished && <Badge>Done</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {question.allowedLanguages.length > 1 && (
          <Select
            value={language}
            onValueChange={(l) => {
              const starter = question.starterCode?.[l] ?? "";
              setCode(starter);
              if (attempt) void save(starter);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {question.allowedLanguages.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={() => void save(code)} disabled={saving || starting}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {finished ? (
          <Button variant="outline" size="sm" onClick={() => void reopen()}>
            Reopen
          </Button>
        ) : (
          <Button size="sm" onClick={() => void markDone()} disabled={starting}>
            Mark done
          </Button>
        )}
      </div>

      <Editor
        height="320px"
        language={language === "python" ? "python" : language}
        theme="vs-dark"
        value={code}
        onChange={(v) => setCode(v ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          readOnly: finished,
        }}
      />

      <RunPanel
        question={question}
        code={code}
        language={language}
        ensureAttempt={ensureAttempt}
        disabled={finished}
        onOutput={setLastOutput}
      />

      <DoubtPanel
        assignmentId={practical.id}
        questionId={question.questionId}
        currentCode={code}
        lastOutput={lastOutput}
      />
    </div>
  );
}

/** Runs the code two ways: a one-shot run, and a live session for a REPL/shell. */
function RunPanel({
  onOutput,
  question,
  code,
  language,
  ensureAttempt,
  disabled,
}: {
  question: StudentPracticalDetail["questions"][number];
  code: string;
  language: string;
  ensureAttempt: () => Promise<AttemptState>;
  disabled: boolean;
  onOutput: (text: string) => void;
}) {
  const [mode, setMode] = useState<"once" | "session">("session");
  // `outTail`/`errTail` hold the trailing partial line of each stream so a
  // prompt written without a newline still shows up immediately, and is
  // completed in place by the next chunk instead of becoming a new line.
  const [view, setView] = useState<{ lines: Line[]; outTail: string; errTail: string }>({
    lines: [],
    outTail: "",
    errTail: "",
  });
  const [stdin, setStdin] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  // How much of the runner's cumulative buffer has already been displayed.
  const outLenRef = useRef(0);
  const errLenRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const push = useCallback((add: Line[]) => {
    setView((v) => ({ ...v, lines: [...v.lines, ...add].slice(-400) }));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /**
   * The runner hands back the *whole* session buffer on every poll. Appending
   * it as-is makes the transcript replay itself forever (that is the "output
   * running in a loop" bug), so only bytes past what we already showed may be
   * pushed, and the trailing partial line is parked in a tail.
   */
  const consume = useCallback((raw: unknown, kind: "out" | "err") => {
    const text = typeof raw === "string" ? raw : "";
    const lenRef = kind === "out" ? outLenRef : errLenRef;
    if (text.length <= lenRef.current) return; // nothing new since last poll
    const seg = text.slice(lenRef.current);
    lenRef.current = text.length;
    setView((v) => {
      const merged = (kind === "out" ? v.outTail : v.errTail) + seg;
      const parts = merged.split("\n");
      const rest = parts.pop() ?? "";
      const add: Line[] = [];
      for (const ln of parts) {
        if (ln === "") continue;
        add.push(kind === "out" ? { kind: "out", text: ln } : classifyStderr(ln));
      }
      const lines = add.length ? [...v.lines, ...add].slice(-400) : v.lines;
      return kind === "out"
        ? { lines, outTail: rest, errTail: v.errTail }
        : { lines, outTail: v.outTail, errTail: rest };
    });
  }, []);

  /** Turns the parked partial lines into real ones (session end, stop). */
  const flushTails = useCallback(() => {
    setView((v) => {
      if (!v.outTail && !v.errTail) return v;
      const add: Line[] = [];
      if (v.outTail) add.push({ kind: "out", text: v.outTail });
      if (v.errTail) add.push(classifyStderr(v.errTail));
      return { lines: [...v.lines, ...add].slice(-400), outTail: "", errTail: "" };
    });
  }, []);

  // Leaving the question or unmounting must not leave a container behind.
  useEffect(() => {
    return () => {
      stopPolling();
      const id = sessionRef.current;
      sessionRef.current = null;
      if (id) void fetch(`/api/student/practicals/run-session/${id}`, { method: "POST" }).catch(() => null);
    };
  }, [stopPolling]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [view]);

  // Keep the latest transcript available so a doubt can quote what the student
  // actually saw. Capped because a REPL can produce a lot of output.
  useEffect(() => {
    onOutput(
      view.lines
        .slice(-60)
        .map((l) => l.text)
        .join("\n")
        .slice(-8000)
    );
  }, [view, onOutput]);

  const runOnce = async () => {
    setBusy(true);
    push([{ kind: "sys", text: `$ run` }]);
    try {
      const res = await fetch("/api/student/attempt/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The run failed.");
      const out = String(data.stdout ?? "");
      const err = String(data.stderr ?? "");
      if (out.trim()) push([{ kind: "out", text: out.trimEnd() }]);
      if (err.trim()) push([{ kind: "err", text: err.trimEnd() }]);
      push([{ kind: "sys", text: `exit ${data.exitCode ?? 0}${data.timedOut ? " (timed out)" : ""}` }]);
      // Best-effort so the admin feed shows what was actually executed.
      const attempt = await ensureAttempt();
      void fetch("/api/student/practicals/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run",
          attemptId: attempt.id,
          language,
          ok: !err.trim(),
          exitCode: data.exitCode ?? 0,
          output: `${out}\n${err}`,
        }),
      }).catch(() => null);
    } catch (e) {
      push([{ kind: "err", text: friendlyError(e, "The run failed.") }]);
    } finally {
      setBusy(false);
    }
  };

  const startSession = async () => {
    if (busy || running) return;
    // Never leave an earlier interval running: it would keep pushing a dead
    // session's buffer alongside the new one.
    stopPolling();
    setBusy(true);
    push([{ kind: "sys", text: `$ start session (${language})` }]);
    try {
      const attempt = await ensureAttempt();
      const res = await fetch("/api/student/practicals/run-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id, language, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the session.");
      const sessionId = String(data.sessionId);
      sessionRef.current = sessionId;
      outLenRef.current = 0;
      errLenRef.current = 0;
      setView((v) => ({ ...v, outTail: "", errTail: "" }));
      setRunning(true);
      push([{ kind: "sys", text: "session ready — type below and press Enter" }]);

      pollRef.current = window.setInterval(() => {
        if (pollInFlightRef.current) return; // skip a tick while the GET is in flight
        const id = sessionRef.current;
        if (id !== sessionId) {
          stopPolling();
          return;
        }
        pollInFlightRef.current = true;
        void (async () => {
          try {
            const r = await fetch(`/api/student/practicals/run-session/${id}`);
            if (sessionRef.current !== sessionId) return; // superseded meanwhile
            const s = await r.json();
            if (!r.ok) {
              stopPolling();
              setRunning(false);
              sessionRef.current = null;
              flushTails();
              push([{ kind: "err", text: String(s.error ?? "Session lost.") }]);
              return;
            }
            consume(s.stdout, "out");
            consume(s.stderr, "err");
            if (s.closed || s.status === "exited") {
              stopPolling();
              setRunning(false);
              sessionRef.current = null;
              flushTails();
              push([{ kind: "sys", text: `session ended (exit ${s.exitCode ?? 0})` }]);
            }
          } catch {
            /* the runner may be restarting; the next tick retries */
          } finally {
            pollInFlightRef.current = false;
          }
        })();
      }, 900);
    } catch (e) {
      push([{ kind: "err", text: friendlyError(e, "Could not start the session.") }]);
    } finally {
      setBusy(false);
    }
  };

  const stopSession = async () => {
    stopPolling();
    setRunning(false);
    flushTails();
    const id = sessionRef.current;
    sessionRef.current = null;
    if (id) {
      await fetch(`/api/student/practicals/run-session/${id}`, { method: "POST" }).catch(() => null);
      push([{ kind: "sys", text: "session stopped" }]);
    }
  };

  // Switching to one-shot while a session is live would otherwise leave its
  // poller running with no Stop button left to kill it.
  const changeMode = (next: "once" | "session") => {
    if (next === mode) return;
    setMode(next);
    if (next === "once" && running) void stopSession();
  };

  const send = async () => {
    const id = sessionRef.current;
    if (!id || !stdin.trim()) return;
    const value = stdin;
    setStdin("");
    push([{ kind: "in", text: value }]);
    await fetch(`/api/student/practicals/run-session/${id}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: value }),
    }).catch(() => null);
  };

  const canRun = useMemo(() => !disabled && code.trim().length > 0, [disabled, code]);

  const rendered: Line[] = [
    ...view.lines,
    ...(view.outTail ? [{ kind: "out" as const, text: view.outTail }] : []),
    ...(view.errTail ? [classifyStderr(view.errTail)] : []),
  ];

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <TerminalIcon className="h-4 w-4 text-muted-foreground" />
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => changeMode("session")}
            className={`rounded-md px-2 py-1 ${mode === "session" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Session
          </button>
          <button
            type="button"
            onClick={() => changeMode("once")}
            className={`rounded-md px-2 py-1 ${mode === "once" ? "bg-primary text-primary-foreground" : ""}`}
          >
            One-shot
          </button>
        </div>
        {mode === "session" ? (
          running ? (
            <Button size="sm" variant="destructive" onClick={() => void stopSession()}>
              <Square className="mr-1.5 h-3.5 w-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={() => void startSession()} disabled={!canRun || busy}>
              <Play className="mr-1.5 h-3.5 w-3.5" /> Start
            </Button>
          )
        ) : (
          <Button size="sm" onClick={() => void runOnce()} disabled={!canRun || busy}>
            <Play className="mr-1.5 h-3.5 w-3.5" /> Run
          </Button>
        )}
        {mode === "once" && (
          <input
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="stdin (optional)"
            className="ml-auto w-48 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        )}
        {question.allowedLanguages.length === 1 && (
          <span className="ml-auto text-xs text-muted-foreground">{question.allowedLanguages[0]}</span>
        )}
      </div>

      <div ref={scrollRef} className="h-56 overflow-auto bg-black/30 p-3 font-mono text-xs leading-relaxed">
        {rendered.length === 0 && (
          <p className="text-muted-foreground">
            Output appears here. Everything runs inside an isolated sandbox on our server.
          </p>
        )}
        {rendered.map((l, i) => (
          <pre
            key={i}
            className={
              l.kind === "err"
                ? "whitespace-pre-wrap text-red-300"
                : l.kind === "in"
                  ? "whitespace-pre-wrap text-amber-200"
                  : l.kind === "sys"
                    ? "whitespace-pre-wrap text-muted-foreground"
                    : "whitespace-pre-wrap text-emerald-200"
            }
          >
            {l.text}
          </pre>
        ))}
      </div>

      {mode === "session" && running && (
        <div className="flex gap-2 border-t border-border px-3 py-2">
          <input
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder="Type an expression, then press Enter"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
          />
          <Button size="sm" variant="secondary" onClick={() => void send()} disabled={!stdin.trim()}>
            Send
          </Button>
        </div>
      )}
    </div>
  );
}