"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, RotateCcw, X } from "lucide-react";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";
import { ChessGame } from "@/lib/chess/game";
import { WHITE } from "@/lib/chess/engine";
import { judgeLesson, type TrainingLesson } from "@/lib/chess/training";
import { cn } from "@/lib/utils";

type Snap = { fen: string; lastMove: { from: string; to: string } | null };

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

/** localStorage key marking that a lesson's teaching popup has been seen. */
export function teachingSeenKey(track: string, lessonId: string): string {
  return `leou:teach:${track}:${lessonId}`;
}

const STEP_MS = 1050;

/**
 * Teaching animation for a lesson: the canonical solution plays out on a small
 * read-only board with per-ply captions, framed by an intro (mission and
 * objectives) and an outro ("your turn"). Opened automatically the first time a
 * lesson is visited, and on demand from the "Learn" button.
 */
export function TeachingPopup({
  lesson,
  onClose,
}: {
  lesson: TrainingLesson;
  onClose: () => void;
}) {
  const line = useMemo(() => judgeLesson(lesson, lesson.solution).line, [lesson]);
  const snapshots = useMemo(() => replayLine(lesson.fen, line), [lesson.fen, line]);

  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);

  const orientation = new ChessGame(lesson.fen).turn() === WHITE ? "white" : "black";
  const objectives = lesson.learningObjectives ?? [];
  const expand = lesson.expandKnowledge ?? [];

  // Auto-advance the animation while playing.
  useEffect(() => {
    if (phase !== "playing") return;
    if (idx >= snapshots.length) return;
    const isLast = idx + 1 >= snapshots.length;
    timer.current = window.setTimeout(
      () => {
        setIdx((i) => Math.min(i + 1, snapshots.length));
        if (isLast) setPhase("done");
      },
      STEP_MS
    );
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [phase, idx, snapshots.length]);

  // Escape closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const start = useCallback(() => {
    setIdx(0);
    setPhase(snapshots.length > 0 ? "playing" : "done");
  }, [snapshots.length]);
  const replay = useCallback(() => {
    setIdx(0);
    setPhase("playing");
  }, []);
  const advance = useCallback(() => {
    const next = Math.min(idx + 1, snapshots.length);
    setIdx(next);
    if (next >= snapshots.length) setPhase("done");
  }, [idx, snapshots.length]);

  const current = idx > 0 ? snapshots[Math.min(idx, snapshots.length) - 1] : null;
  const fen = current?.fen ?? lesson.fen;
  const lastMove = current?.lastMove ?? null;

  const caption = (() => {
    if (phase === "intro") return lesson.mission;
    if (phase === "done") return "That is the lesson — now it is your turn on the board.";
    const stepText = lesson.steps?.[idx];
    if (stepText) return stepText;
    const uci = line[idx];
    if (!uci) return "";
    const side = idx % 2 === 0 ? "White" : "Black";
    return `${side} plays ${uci.slice(0, 2)}–${uci.slice(2, 4)}.`;
  })();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Learn: ${lesson.name}`}>
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-accent" />
            {phase === "done" ? "Lesson complete" : "Lesson intro"}
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{lesson.concept}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:flex-row sm:items-start">
          <div className="mx-auto w-full shrink-0 sm:mx-0 sm:w-[46%]">
            <div className="overflow-hidden rounded-xl border border-border bg-background">
              <InteractiveBoard fen={fen} legalMoves={[]} turn={orientation} orientation={orientation} lastMove={lastMove} animateKey={idx} disabled />
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
                {lesson.visualHint?.caption && <p className="text-xs italic">{lesson.visualHint.caption}</p>}
              </div>
            )}

            {phase !== "intro" && (
              <div className="mt-2 min-h-[4.5rem] rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground">
                {caption}
              </div>
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
                <BookOpen className="h-3.5 w-3.5" /> Watch the lesson
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-secondary">
                I&apos;m ready — skip
              </button>
            </>
          )}
          {phase === "playing" && (
            <>
              <button
                type="button"
                onClick={advance}
                disabled={idx >= snapshots.length}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
              >
                Next move
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-secondary">
                Try it myself
              </button>
            </>
          )}
          {phase === "done" && (
            <>
              <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
                Your turn <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={replay} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-secondary">
                <RotateCcw className="h-3.5 w-3.5" /> Replay
              </button>
            </>
          )}
          <span className={cn("ml-auto text-xs text-muted-foreground", phase === "playing" && idx >= snapshots.length && "hidden")}>
            {phase === "playing" ? `Move ${Math.min(idx + 1, snapshots.length)} of ${snapshots.length}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
