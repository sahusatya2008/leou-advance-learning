"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Circle,
  Lightbulb,
  LockKeyhole,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Scene3D } from "@/components/learning/Scene3D";
import { CONCEPTS, COURSE_CHAPTER, COURSE_ID, COURSE_TAGLINE, COURSE_TITLE, type Concept, type StoryBlock } from "@/lib/learning3d/encodingCourse";
import { buildScene, INITIAL_STATE, type LearningState } from "@/lib/learning3d/scenes";
import { cn } from "@/lib/utils";

const STORAGE_KEY = `leou:learning3d:${COURSE_ID}:v1`;
const PROGRESS_EVENT = "leou:learning3d:progress";

// Progress lives only in localStorage. `useSyncExternalStore` reads it without
// a setState-in-effect (and gives React a server snapshot, so hydration is
// stable), while writes dispatch an event so the UI updates in the same tab.
function subscribeProgress(callback: () => void) {
  window.addEventListener(PROGRESS_EVENT, callback);
  return () => window.removeEventListener(PROGRESS_EVENT, callback);
}
function readProgress(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function getProgressSnapshot() {
  return readProgress();
}
function getProgressServerSnapshot() {
  return "[]";
}
function parseProgress(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </span>
      ))}
    </>
  );
}

function Story({ block }: { block: StoryBlock }) {
  if (block.kind === "h") {
    return <h3 className="pt-2 text-base font-semibold text-foreground">{block.text}</h3>;
  }
  if (block.kind === "p") {
    return <p className="text-sm leading-7 text-muted-foreground"><Inline text={block.text} /></p>;
  }
  if (block.kind === "steps") {
    return (
      <ol className="space-y-2">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">{i + 1}</span>
            <span><Inline text={item} /></span>
          </li>
        ))}
      </ol>
    );
  }
  if (block.kind === "example") {
    return (
      <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.06] p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
          <Sparkles className="h-3.5 w-3.5" /> {block.title}
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-6 text-foreground/90">
          {block.lines.join("\n")}
        </pre>
      </div>
    );
  }
  if (block.kind === "note") {
    const Icon = block.tone === "watch" ? TriangleAlert : block.tone === "tip" ? Lightbulb : BadgeCheck;
    const tone = block.tone === "watch" ? "border-amber-400/30 bg-amber-400/[0.07] text-amber-200" : block.tone === "tip" ? "border-violet-400/30 bg-violet-400/[0.07] text-violet-200" : "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200";
    return (
      <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm leading-6", tone)}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <p><Inline text={block.text} /></p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead className="bg-secondary/60 text-muted-foreground">
          <tr>{block.head.map((cell) => <th key={cell} className="px-3 py-2 font-semibold">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-t border-border/60">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-foreground/80">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Controls({ concept, state, set }: {
  concept: Concept;
  state: LearningState;
  set: (patch: Partial<LearningState>) => void;
}) {
  if (concept.controls.length === 0) return null;
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-primary"><Sparkles className="h-3.5 w-3.5" /></span>
        Try it yourself
        <span className="font-normal normal-case tracking-normal">— the model changes as you do</span>
      </div>
      {concept.controls.includes("bits") && (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Flip a switch (each cube is a bit):</p>
          <div className="flex flex-wrap gap-2">
            {state.bits.map((on, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Bit ${state.bits.length - i}: ${on ? "on" : "off"}, weight ${2 ** (state.bits.length - 1 - i)}`}
                aria-pressed={on}
                onClick={() => set({ bits: state.bits.map((b, j) => (j === i ? !b : b)) })}
                className={cn(
                  "flex h-14 w-12 flex-col items-center justify-center rounded-xl border font-mono text-sm transition",
                  on ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.18)]" : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50",
                )}
              >
                <span className="font-bold">{on ? 1 : 0}</span>
                <span className="text-[9px] opacity-70">{2 ** (state.bits.length - 1 - i)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {concept.controls.includes("decimal") && (
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs text-muted-foreground" htmlFor="learning-decimal">
            <span>Choose a decimal number</span>
            <input
              id="learning-decimal"
              type="number"
              min={0}
              max={4095}
              value={state.decimal}
              onChange={(e) => set({ decimal: Math.min(4095, Math.max(0, Number(e.target.value) || 0)) })}
              className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-center font-mono text-sm text-foreground"
            />
          </label>
          <input
            type="range"
            min={0}
            max={255}
            value={Math.min(255, state.decimal)}
            onChange={(e) => set({ decimal: Number(e.target.value) })}
            aria-label="Decimal number slider"
            className="h-2 w-full cursor-pointer accent-cyan-400"
          />
        </div>
      )}
      {concept.controls.includes("base") && (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Target base:</p>
          <div className="inline-flex rounded-xl border border-border bg-background/60 p-1">
            {([8, 16] as const).map((base) => (
              <button
                key={base}
                type="button"
                aria-pressed={state.base === base}
                onClick={() => set({ base })}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors",
                  state.base === base ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {base === 8 ? "Octal (8)" : "Hex (16)"}
              </button>
            ))}
          </div>
        </div>
      )}
      {concept.controls.includes("text") && (
        <div>
          <label htmlFor="learning-text" className="mb-2 block text-xs text-muted-foreground">Type a short word (ASCII codes appear in the model):</label>
          <input
            id="learning-text"
            value={state.text}
            maxLength={6}
            onChange={(e) => set({ text: e.target.value })}
            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm uppercase text-foreground outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  );
}

export function EncodingCoursePlayer() {
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<LearningState>(INITIAL_STATE);
  const [answer, setAnswer] = useState<number | null>(null);
  const concept = CONCEPTS[index]!;
  const scene = useMemo(() => buildScene(concept.scene, state), [concept.scene, state]);

  const progressRaw = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressServerSnapshot);
  const done = useMemo(() => parseProgress(progressRaw), [progressRaw]);

  const markDone = (id: string) => {
    const current = parseProgress(readProgress());
    if (current.includes(id)) return;
    const next = [...current, id];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(PROGRESS_EVENT));
    } catch {
      // Private browsing can deny localStorage; the lesson still works.
    }
  };

  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(CONCEPTS.length - 1, i)));
    setAnswer(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const patch = (p: Partial<LearningState>) => {
    setState((prev) => ({ ...prev, ...p }));
    setAnswer(null);
  };

  const pct = Math.round((done.length / CONCEPTS.length) * 100);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/learn" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> All 3D courses
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">{COURSE_TITLE}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{COURSE_TAGLINE} · {COURSE_CHAPTER}</p>
        </div>
        <div className="w-full max-w-[220px]">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Your journey</span><span>{done.length}/{CONCEPTS.length}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Concepts</p>
          <div className="space-y-1">
            {CONCEPTS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => go(i)}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors",
                  i === index ? "border-primary/60 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60",
                )}
              >
                {done.includes(c.id) ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : i === index ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />}
                <span className="flex-1">
                  <span className="block font-medium leading-4">{c.title}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{c.minutes} min</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl border border-border bg-card/60">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Concept {index + 1} of {CONCEPTS.length}</p>
                <h2 className="mt-0.5 text-lg font-bold tracking-tight">{concept.title}</h2>
                <p className="text-xs text-muted-foreground">{concept.tagline}</p>
              </div>
              <span className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground">{concept.minutes} min read</span>
            </div>
            <Scene3D spec={scene} className="h-[340px] rounded-none border-0 sm:h-[430px]" />
            <div className="space-y-2 border-t border-border/70 px-4 py-3">
              <p className="text-xs text-muted-foreground">{scene.caption}</p>
              <div className="flex flex-wrap gap-2">
                {concept.live(state).map((line, i) => (
                  <code key={i} className="rounded-lg border border-border bg-background/60 px-2.5 py-1 font-mono text-[11px] text-cyan-200">{line}</code>
                ))}
              </div>
            </div>
          </section>

          <Controls concept={concept} state={state} set={patch} />

          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
            <div className="flex items-center gap-2 border-b border-border/70 pb-3">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">The explanation</h2>
            </div>
            {concept.story.map((block, i) => <Story key={i} block={block} />)}
          </section>

          <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <LockKeyhole className="h-4 w-4 text-amber-300" /> Quick check
            </p>
            <p className="mb-3 text-sm text-foreground/90">{concept.quiz.prompt}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {concept.quiz.choices.map((choice, i) => {
                const chosen = answer === i;
                const correct = i === concept.quiz.answer;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setAnswer(i);
                      if (correct) markDone(concept.id);
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      answer === null ? "border-border bg-background/50 hover:border-primary/50" : correct ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : chosen ? "border-red-400/60 bg-red-400/10 text-red-200" : "border-border bg-background/40 text-muted-foreground",
                    )}
                  >
                    <span className="mr-2 font-mono text-[11px] opacity-70">{String.fromCharCode(65 + i)}</span>{choice}
                  </button>
                );
              })}
            </div>
            {answer !== null && (
              <p className={cn("mt-3 rounded-xl border px-3 py-2 text-xs leading-6", answer === concept.quiz.answer ? "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200" : "border-amber-400/30 bg-amber-400/[0.07] text-amber-200")}>
                {answer === concept.quiz.answer ? "Correct. " : "Not quite. "}{concept.quiz.why}
              </p>
            )}
          </section>

          <div className="flex items-center justify-between gap-3 pb-4">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-xs text-muted-foreground">{done.includes(concept.id) ? "Marked as learned ✓" : "Answer the check to mark this learned"}</span>
            <button type="button" onClick={() => go(index + 1)} disabled={index === CONCEPTS.length - 1}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40">
              Next concept <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
