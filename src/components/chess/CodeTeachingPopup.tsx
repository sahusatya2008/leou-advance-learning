"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, Code2, RotateCcw, X } from "lucide-react";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";
import { ChessGame } from "@/lib/chess/game";
import { WHITE } from "@/lib/chess/engine";
import { judgeLesson, type TrainingLesson } from "@/lib/chess/training";
import { cn } from "@/lib/utils";

type Snap = { fen: string; lastMove: { from: string; to: string } | null };

/** Snapshots for the canonical line, used as the backdrop of the walkthrough. */
function replayLine(fen: string, line: string[]): Snap[] {
  const g = new ChessGame(fen);
  const snaps: Snap[] = [];
  for (const uci of line) {
    const p = g.move(uci);
    if (!p) break;
    snaps.push({ fen: g.fen(), lastMove: { from: p.uci.slice(0, 2), to: p.uci.slice(2, 4) } });
  }
  return snaps;
}

const STEP_MS = 2600;

/**
 * The programming-track teaching popup: an animated walkthrough of the working
 * program. Each `codeWalkthrough` step highlights one idea in the code and, when
 * it names a `playMove`, advances the read-only board so the student sees the
 * code and the board stay in lockstep. Falls back to a plain per-ply animation
 * for lessons that have no walkthrough.
 */
export function CodeTeachingPopup({
  lesson,
  onClose,
}: {
  lesson: TrainingLesson;
  onClose: () => void;
}) {
  const line = useMemo(() => judgeLesson(lesson, lesson.solution).line, [lesson]);
  const snapshots = useMemo(() => replayLine(lesson.fen, line), [lesson.fen, line]);
  const steps = useMemo(() => lesson.codeWalkthrough ?? [], [lesson.codeWalkthrough]);
  const starter = lesson.starterCode?.python ?? lesson.solutionCode ?? "";

  const orientation = new ChessGame(lesson.fen).turn() === WHITE ? "white" : "black";
  const objectives = lesson.learningObjectives ?? [];
  const expand = lesson.expandKnowledge ?? [];

  const [phase, setPhase] = useState<"intro" | "walking" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const timer = useRef<number | null>(null);

  // How many board plies are visible at a given walkthrough step: count the
  // `playMove` steps up to and including the current one.
  const plyForStep = useMemo(() => {
    const counts: number[] = [];
    let n = 0;
    for (const s of steps) {
      if (s.playMove) n++;
      counts.push(n);
    }
    return counts;
  }, [steps]);

  const totalPly = plyForStep.length ? plyForStep[plyForStep.length - 1] : snapshots.length;

  // Auto-advance the walkthrough while in the walking phase.
  useEffect(() => {
    if (phase !== "walking" || !auto) return;
    const last = idx + 1 >= steps.length;
    timer.current = window.setTimeout(() => {
      setIdx((i) => Math.min(i + 1, steps.length));
      if (last) setPhase("done");
    }, STEP_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [phase, idx, auto, steps.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const next = useCallback(() => {
    const n = Math.max(0, Math.min(idx + 1, steps.length));
    setIdx(n);
    if (n >= steps.length) setPhase("done");
  }, [idx, steps.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(0, Math.min(i - 1, steps.length))), [steps.length]);
  const start = useCallback(() => {
    setIdx(0);
    setPhase(steps.length > 0 || snapshots.length > 0 ? "walking" : "done");
  }, [steps.length, snapshots.length]);
  const replay = useCallback(() => {
    setIdx(0);
    setAuto(true);
    setPhase("walking");
  }, []);

  // Board position: follow the current step's playMove count, or the raw ply
  // count when there is no walkthrough.
  const visiblePly = steps.length > 0 ? (idx > 0 ? plyForStep[idx - 1] : 0) : Math.min(idx, snapshots.length);
  const current = visiblePly > 0 ? snapshots[Math.min(visiblePly, snapshots.length) - 1] : null;
  const fen = current?.fen ?? lesson.fen;
  const lastMove = current?.lastMove ?? null;

  const activeStep = idx > 0 && idx <= steps.length ? steps[idx - 1] : null;
  const caption = (() => {
    if (phase === "intro") return lesson.mission;
    if (phase === "done") return "That is the whole program — now write it yourself and run it.";
    if (activeStep) return activeStep.caption;
    const uci = line[Math.min(visiblePly, line.length) - 1];
    if (!uci) return "";
    return `White plays ${uci.slice(0, 2)}–${uci.slice(2, 4)}.`;
  })();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Learn: ${lesson.name}`}>
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-accent" />
            {phase === "done" ? "Lesson complete" : "Code walkthrough"}
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{lesson.concept}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:flex-row sm:items-start">
          <div className="mx-auto w-full shrink-0 sm:mx-0 sm:w-[42%]">
            <div className="overflow-hidden rounded-xl border border-border bg-background">
              <InteractiveBoard fen={fen} legalMoves={[]} turn={orientation} orientation={orientation} lastMove={lastMove} animateKey={visiblePly} disabled />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold tracking-tight">{lesson.name}</h2>

            {phase === "intro" && (
              <div className="mt-2 space-y-3 text-sm text-muted-foreground">
                <p>{lesson.mission}</p>
                {objectives.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">You will learn</p>
                    <ul className="space-y-1">
                      {objectives.map((o, i) => (
                        <li key={i} className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {phase !== "intro" && steps.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-black/30">
                <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                  <Code2 className="h-3.5 w-3.5" /> move(game) · Python
                </div>
                <pre className="max-h-56 overflow-auto p-3 font-mono text-xs leading-relaxed text-foreground">
                  {steps.map((s, i) => {
                    const active = i + 1 === idx;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setAuto(false);
                          setIdx(i + 1);
                        }}
                        className={cn(
                          "block w-full whitespace-pre-wrap rounded px-1 text-left transition",
                          active ? "bg-accent/20 text-accent" : "text-muted-foreground/80 hover:bg-white/5"
                        )}
                      >
                        {s.code}
                      </button>
                    );
                  })}
                </pre>
              </div>
            )}

            {phase !== "intro" && steps.length === 0 && (
              <div className="mt-3 rounded-xl border border-border bg-black/30 p-3">
                <pre className="max-h-56 overflow-auto font-mono text-xs leading-relaxed text-muted-foreground">{starter}</pre>
              </div>
            )}

            {phase !== "intro" && (
              <div className="mt-3 min-h-[4.5rem] rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground">{caption}</div>
            )}

            {phase === "done" && expand.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Go further: </span>
                {expand.join(" ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
          {phase === "intro" && (
            <>
              <button type="button" onClick={start} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
                <BookOpen className="h-3.5 w-3.5" /> Walk me through it
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-secondary">
                I&apos;m ready — skip
              </button>
            </>
          )}
          {phase === "walking" && (
            <>
              <button type="button" onClick={prev} disabled={idx <= 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-secondary disabled:opacity-50">
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button type="button" onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
                {idx + 1 >= steps.length ? "Finish" : "Next"} <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setAuto((a) => !a)}
                className={cn("rounded-lg border border-border px-3 py-2 text-xs transition hover:bg-secondary", auto && "border-accent/60 bg-accent/15 text-accent")}
              >
                {auto ? "Pause" : "Auto-play"}
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-secondary">
                Try it myself
              </button>
            </>
          )}
          {phase === "done" && (
            <>
              <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
                Write it myself <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={replay} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-secondary">
                <RotateCcw className="h-3.5 w-3.5" /> Replay
              </button>
            </>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {phase === "walking" && steps.length > 0 ? `Step ${Math.min(idx + 1, steps.length)} of ${steps.length}` : phase === "walking" ? `Move ${Math.min(visiblePly, totalPly)} of ${totalPly}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
