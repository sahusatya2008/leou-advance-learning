"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Circle,
  FlaskConical,
  Lightbulb,
  LockKeyhole,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Scene3D } from "@/components/learning/Scene3D";
import { buildChemScene, INITIAL_CHEM_STATE, type ChemControlKind, type ChemState } from "@/lib/learning3d/chemScenes";
import { GOC_COURSE, GOC_COURSE_ID, type ChemConcept, type ChemCourse, type ChemStoryBlock } from "@/lib/learning3d/chemCourse";
import { HALO_COURSE, HALO_COURSE_ID } from "@/lib/learning3d/haloCourse";
import { cn } from "@/lib/utils";

const PROGRESS_EVENT = "leou:learning3d:progress";

// The course data contains `live` functions, so it must be imported here rather
// than passed from the server page: RSC cannot serialise functions across the
// server/client boundary. The page only hands us this stable id.
const COURSES: Record<string, ChemCourse> = {
  [GOC_COURSE_ID]: GOC_COURSE,
  [HALO_COURSE_ID]: HALO_COURSE,
};

// Progress stays in this browser only. A separate key per course keeps GOC and
// Haloalkanes independent, and the shared event makes the rail update instantly.
function storageKey(courseId: string) {
  return `leou:learning3d:${courseId}:v1`;
}
function subscribeProgress(callback: () => void) {
  window.addEventListener(PROGRESS_EVENT, callback);
  return () => window.removeEventListener(PROGRESS_EVENT, callback);
}
function readProgress(key: string): string {
  try {
    return localStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
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
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
              : <span key={i}>{part}</span>,
          )}
        </span>
      ))}
    </>
  );
}

function Story({ block }: { block: ChemStoryBlock }) {
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
          <FlaskConical className="h-3.5 w-3.5" /> {block.title}
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-6 text-foreground/90">
          {block.lines.join("\n")}
        </pre>
      </div>
    );
  }
  if (block.kind === "note") {
    const Icon = block.tone === "watch" ? TriangleAlert : block.tone === "tip" ? Lightbulb : BadgeCheck;
    const tone = block.tone === "watch"
      ? "border-amber-400/30 bg-amber-400/[0.07] text-amber-200"
      : block.tone === "tip"
        ? "border-violet-400/30 bg-violet-400/[0.07] text-violet-200"
        : "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200";
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

function ChoiceRow<T extends string>({ options, value, onChange, label, format }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  format?: (v: T) => string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={`${label}: ${option}`}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              value === option
                ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.15)]"
                : "border-border bg-background/50 text-muted-foreground hover:border-primary/50",
            )}
          >
            {format ? format(option) : option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Controls({ controls, state, set }: {
  controls: ChemControlKind[];
  state: ChemState;
  set: (patch: Partial<ChemState>) => void;
}) {
  if (controls.length === 0) return null;
  const has = (kind: ChemControlKind) => controls.includes(kind);
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-primary"><FlaskConical className="h-3.5 w-3.5" /></span>
        Practical lab
        <span className="font-normal normal-case tracking-normal">— drag a control, watch the model rebuild</span>
      </div>

      {has("chain") && (
        <div className="space-y-2">
          <label htmlFor="chem-chain" className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Carbon chain length</span>
            <span className="font-mono text-foreground">{state.chain} C</span>
          </label>
          <input
            id="chem-chain"
            type="range"
            min={1}
            max={6}
            value={state.chain}
            onChange={(e) => set({ chain: Number(e.target.value) })}
            className="h-2 w-full cursor-pointer accent-cyan-400"
          />
        </div>
      )}

      {has("halogen") && (
        <ChoiceRow
          label="Halogen"
          options={["F", "Cl", "Br", "I"] as const}
          value={state.halogen}
          onChange={(halogen) => set({ halogen })}
        />
      )}

      {has("group") && (
        <ChoiceRow
          label="Substituent group"
          options={["H", "CH3", "C2H5", "NO2", "OH", "CN"] as const}
          value={state.group}
          onChange={(group) => set({ group })}
          format={(v) => `–${v}`}
        />
      )}

      {has("effect") && (
        <ChoiceRow
          label="Electronic effect"
          options={["I", "R", "H"] as const}
          value={state.effect}
          onChange={(effect) => set({ effect })}
          format={(v) => v === "I" ? "Inductive" : v === "R" ? "Resonance" : "Hyperconjugation"}
        />
      )}

      {has("hybrid") && (
        <ChoiceRow
          label="Hybridisation"
          options={["sp3", "sp2", "sp"] as const}
          value={state.hybrid}
          onChange={(hybrid) => set({ hybrid })}
          format={(v) => v.replace("p", "p")}
        />
      )}

      {has("mechanism") && (
        <ChoiceRow
          label="Mechanism"
          options={["SN1", "SN2", "E1", "E2"] as const}
          value={state.mechanism}
          onChange={(mechanism) => set({ mechanism })}
        />
      )}

      {has("solvent") && (
        <ChoiceRow
          label="Solvent"
          options={["protic", "aprotic"] as const}
          value={state.solvent}
          onChange={(solvent) => set({ solvent })}
          format={(v) => v === "protic" ? "Polar protic" : "Polar aprotic"}
        />
      )}

      {has("stereo") && (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Stereochemistry</p>
          <button
            type="button"
            aria-label="Chiral centre"
            aria-pressed={state.stereo}
            onClick={() => set({ stereo: !state.stereo })}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              state.stereo
                ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-200"
                : "border-border bg-background/50 text-muted-foreground hover:border-primary/50",
            )}
          >
            {state.stereo ? "Chiral centre ON" : "Chiral centre OFF"}
          </button>
        </div>
      )}

      {has("heat") && (
        <div className="space-y-2">
          <label htmlFor="chem-heat" className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Heat / energy</span>
            <span className="font-mono text-foreground">{state.heat} °C</span>
          </label>
          <input
            id="chem-heat"
            type="range"
            min={0}
            max={100}
            value={state.heat}
            onChange={(e) => set({ heat: Number(e.target.value) })}
            className="h-2 w-full cursor-pointer accent-amber-400"
          />
        </div>
      )}
    </div>
  );
}

export function ChemistryCoursePlayer({ courseId }: { courseId: string }) {
  const course = COURSES[courseId] ?? GOC_COURSE;
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<ChemState>(INITIAL_CHEM_STATE);
  const [answer, setAnswer] = useState<number | null>(null);
  const concept: ChemConcept = course.concepts[index]!;
  const scene = useMemo(() => buildChemScene(concept.scene, state), [concept.scene, state]);

  const key = storageKey(course.id);
  const raw = useSyncExternalStore(
    subscribeProgress,
    () => readProgress(key),
    () => "[]",
  );
  const done = useMemo(() => parseProgress(raw), [raw]);

  const markDone = (id: string) => {
    const current = parseProgress(readProgress(key));
    if (current.includes(id)) return;
    const next = [...current, id];
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(PROGRESS_EVENT));
    } catch {
      // Private browsing can deny localStorage; the lesson still works.
    }
  };

  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(course.concepts.length - 1, i)));
    setAnswer(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const patch = (p: Partial<ChemState>) => {
    setState((prev) => ({ ...prev, ...p }));
    setAnswer(null);
  };

  const pct = Math.round((done.length / course.concepts.length) * 100);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/learn" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> All 3D courses
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">{course.title}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{course.tagline} · {course.chapter}</p>
        </div>
        <div className="w-full max-w-[220px]">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Your journey</span><span>{done.length}/{course.concepts.length}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Concepts</p>
          <div className="space-y-1">
            {course.concepts.map((c, i) => (
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
                {done.includes(c.id)
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  : i === index
                    ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />}
                <span className="flex-1">
                  <span className="block font-medium leading-4">{c.title}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{c.minutes} min · {c.level}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl border border-border bg-card/60">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Concept {index + 1} of {course.concepts.length}</p>
                <h2 className="mt-0.5 text-lg font-bold tracking-tight">{concept.title}</h2>
                <p className="text-xs text-muted-foreground">{concept.tagline}</p>
              </div>
              <span className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground">
                {concept.level} · {concept.minutes} min read
              </span>
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

          <Controls controls={concept.controls} state={state} set={patch} />

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
                      answer === null
                        ? "border-border bg-background/50 hover:border-primary/50"
                        : correct
                          ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                          : chosen
                            ? "border-red-400/60 bg-red-400/10 text-red-200"
                            : "border-border bg-background/40 text-muted-foreground",
                    )}
                  >
                    <span className="mr-2 font-mono text-[11px] opacity-70">{String.fromCharCode(65 + i)}</span>{choice}
                  </button>
                );
              })}
            </div>
            {answer !== null && (
              <p className={cn(
                "mt-3 rounded-xl border px-3 py-2 text-xs leading-6",
                answer === concept.quiz.answer
                  ? "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200"
                  : "border-amber-400/30 bg-amber-400/[0.07] text-amber-200",
              )}>
                {answer === concept.quiz.answer ? "Correct. " : "Not quite. "}{concept.quiz.why}
              </p>
            )}
          </section>

          <div className="flex items-center justify-between gap-3 pb-4">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-xs text-muted-foreground">
              {done.includes(concept.id) ? "Marked as learned ✓" : "Answer the check to mark this learned"}
            </span>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === course.concepts.length - 1}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40"
            >
              Next concept <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
