"use client";

import "@/lib/monaco";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Check, CircleDot, Flag, Lightbulb, Loader2, Play, RotateCcw, Star, Terminal, Undo2, X } from "lucide-react";
import { InteractiveBoard } from "@/components/chess/InteractiveBoard";
import { TeachingPopup, teachingSeenKey } from "@/components/chess/TeachingPopup";
import { CodeTeachingPopup } from "@/components/chess/CodeTeachingPopup";
import { ChessGame } from "@/lib/chess/game";
import { WHITE } from "@/lib/chess/engine";
import { friendlyError } from "@/lib/apiClient";
import { judgeLesson, type TrainingLesson, type TrainingTrack } from "@/lib/chess/training";
import { cn } from "@/lib/utils";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-secondary/50" />,
});

const MONACO_LANG: Record<string, string> = { python: "python", javascript: "javascript", java: "java" };

const CHESS_API_DOCS: Array<{ call: string; doc: string; pythonOnly?: boolean }> = [
  { call: "game.legal_moves()", doc: 'Every move you may play, as text like "e2e4".' },
  { call: "game.turn()", doc: 'Whose turn it is — "white" or "black".' },
  { call: "game.in_check()", doc: "True if the side to move is in check." },
  { call: "game.piece_at(sq)", doc: 'The piece on a square, e.g. "P", "q" or "" if empty.' },
  { call: "game.pieces()", doc: "Every occupied square with its piece." },
  { call: "game.moves_from(sq)", doc: 'Legal moves that start on a square, e.g. "e2".' },
  { call: "game.fen()", doc: "The full position in Forsyth–Edwards notation." },
  { call: "game.apply(move)", doc: "The position after a move, or None if it is illegal.", pythonOnly: true },
  { call: "game.status()", doc: 'Check the result: {"over", "result", "winner"}.', pythonOnly: true },
  { call: "game.is_game_over()", doc: "True when the game has finished.", pythonOnly: true },
  { call: "game.attacked_squares(by_white)", doc: "Squares a side attacks — find checks and safety.", pythonOnly: true },
  { call: "game.king_square(by_white)", doc: "The square of a side's king.", pythonOnly: true },
];

type Snap = { fen: string; lastMove: { from: string; to: string } | null };

type ServerOutcome = { won: boolean; stars: number; message: string };
type RunResponse = {
  ok?: boolean;
  error?: string;
  outcome?: ServerOutcome;
  line?: string[];
  finalFen?: string;
  /** Programming track: student moves chosen so far — send back as `history`. */
  history?: string[];
  /** Programming track: the position the program ran against this turn. */
  liveFen?: string;
  /** Programming track: true once the goal is met or the game is over. */
  done?: boolean;
  best?: { stars: number; bestMoves: number | null; completed: boolean };
  stdout?: string;
  stderr?: string;
};

export type TrainingPlayerProps = {
  track: TrainingTrack;
  lesson: TrainingLesson;
  starters: Record<string, string>;
  savedCode: Record<string, string>;
  languages: string[];
  languageLabels: Record<string, string>;
  initialLanguage: string;
  initialStars: number;
  initialBestMoves: number | null;
  initialCompleted: boolean;
  nextLessonId: string | null;
};

/** Replay a full UCI line (already including replies) into snapshots. */
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

/** Step towards `target` one snapshot at a time so moves animate in order. */
function useAnimatedIndex(target: number, stepMs = 380) {
  const [idx, setIdx] = useState(target);
  useEffect(() => {
    if (idx >= target) return;
    const t = window.setTimeout(() => setIdx((i) => Math.min(i + 1, target)), stepMs);
    return () => window.clearTimeout(t);
  }, [idx, target, stepMs]);
  // Clamp for the frame after a shorter line replaces a longer one (undo/reset).
  return [Math.min(idx, target), setIdx] as const;
}

/**
 * Replay the lesson's own canonical solution on demand ("Show me"). The line is
 * judged with the same pure judge the grader uses, so the demo always matches
 * what a correct answer would look like — including any scripted replies.
 */
function useSolutionDemo(lesson: TrainingLesson) {
  const [active, setActive] = useState(false);
  const demoLine = useMemo(() => judgeLesson(lesson, lesson.solution).line, [lesson]);
  const demoSnapshots = useMemo(() => replayLine(lesson.fen, demoLine), [lesson.fen, demoLine]);
  const [demoTarget, setDemoTarget] = useState(0);
  const [demoIdx, setDemoIdx] = useAnimatedIndex(demoTarget, 520);

  const start = useCallback(() => {
    setDemoIdx(0);
    setDemoTarget(demoSnapshots.length);
    setActive(true);
  }, [demoSnapshots.length, setDemoIdx]);
  const stop = useCallback(() => {
    setActive(false);
    setDemoTarget(0);
    setDemoIdx(0);
  }, [setDemoIdx]);

  return { active, idx: demoIdx, snapshots: demoSnapshots, start, stop };
}

/** Teaching popup state: auto-open the first time a lesson is visited, and
 * re-open on demand from the header's "Learn" button. */
function useTeaching(lesson: TrainingLesson) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Deferred so the first render stays server-safe and the hook rule about
    // synchronous setState in effects is respected.
    const t = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(teachingSeenKey(lesson.track, lesson.id)) !== "1") setOpen(true);
      } catch {
        setOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [lesson.track, lesson.id]);
  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(teachingSeenKey(lesson.track, lesson.id), "1");
    } catch {
      /* storage unavailable — the intro will show again next visit */
    }
  }, [lesson.track, lesson.id]);
  const learn = useCallback(() => setOpen(true), []);
  return { open, close, learn };
}

export function TrainingPlayer(props: TrainingPlayerProps) {
  return props.track === "physical" ? <PhysicalTrainer {...props} /> : <ProgrammingTrainer {...props} />;
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function LessonHeader({
  lesson,
  stars,
  onNext,
  onLearn,
}: {
  lesson: TrainingLesson;
  stars: number;
  onNext?: () => void;
  onLearn?: () => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link href={`/dashboard/chess/training/${lesson.track}`} className="text-xs text-muted-foreground hover:text-foreground">
          ← {lesson.track === "physical" ? "Board Training" : "Programming Training"}
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          {lesson.name}
          <span className="rounded-full border border-border bg-card/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{lesson.concept}</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{lesson.mission}</p>
      </div>
      <div className="flex items-center gap-3">
        {onLearn && (
          <button
            type="button"
            onClick={onLearn}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-secondary"
          >
            <BookOpen className="h-3.5 w-3.5 text-accent" /> Learn
          </button>
        )}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <Star key={i} className={cn("h-5 w-5", i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
          ))}
        </div>
        {onNext && (
          <button type="button" onClick={onNext} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110">
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Feedback({ won, message }: { won: boolean; message: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
        won ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-100"
      )}
    >
      {won ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function Hints({ hints }: { hints: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground">
        <Lightbulb className="h-3.5 w-3.5 text-accent" /> {open ? "Hide hints" : "Need a hint?"}
      </button>
      {open && (
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {hints.map((h, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent">•</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Caption for the auto-drawn concept arrows, shown under the board. */
function AnnotationCaption({ caption }: { caption: string }) {
  return <p className="mt-3 text-center text-xs font-medium text-accent/90">{caption}</p>;
}

/** "Show me" / "Stop" toggle that replays the lesson's own solution. */
function ShowMeButton({ active, onStart, onStop }: { active: boolean; onStart: () => void; onStop: () => void }) {
  return (
    <button
      type="button"
      onClick={active ? onStop : onStart}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition",
        active ? "border-accent/60 bg-accent/15 text-accent" : "hover:bg-secondary"
      )}
    >
      <Play className="h-4 w-4" />
      {active ? "Stop demo" : "Show me"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Physical trainer — move the pieces yourself
// ---------------------------------------------------------------------------

function PhysicalTrainer({ lesson, initialStars, nextLessonId }: TrainingPlayerProps) {
  const router = useRouter();
  const studentWhite = new ChessGame(lesson.fen).turn() === WHITE;
  const studentTurn: "white" | "black" = studentWhite ? "white" : "black";
  const [playerMoves, setPlayerMoves] = useState<string[]>([]);
  const [result, setResult] = useState<ServerOutcome | null>(null);
  const [best, setBest] = useState({ stars: initialStars, bestMoves: null as number | null });
  const [checking, setChecking] = useState(false);
  const submittedFor = useRef<string>("");
  const teaching = useTeaching(lesson);

  // The judge owns the line (student moves + deterministic opponent replies), so
  // the animated board is exactly what the server will replay — no divergence
  // between what the student sees and what gets graded.
  const judged = useMemo(() => judgeLesson(lesson, playerMoves), [lesson, playerMoves]);
  const snapshots = useMemo(() => replayLine(lesson.fen, judged.line), [lesson, judged]);
  const [viewIdx, setViewIdx] = useAnimatedIndex(snapshots.length);
  const settled = viewIdx >= snapshots.length;
  const solved = result?.won === true;
  const done = solved || judged.won;

  const current = viewIdx > 0 ? snapshots[viewIdx - 1] : null;
  const fen = current?.fen ?? lesson.fen;
  const turn = new ChessGame(fen).turnName();
  const playerTurn = turn === studentTurn;
  const over = new ChessGame(fen).status().over;
  const legalMoves = settled && !done && playerTurn ? new ChessGame(fen).legalUci() : [];

  const demo = useSolutionDemo(lesson);
  const demoActive = demo.active;
  const demoSnap = demoActive && demo.idx > 0 ? demo.snapshots[Math.min(demo.idx, demo.snapshots.length) - 1] : null;
  const boardFen = demoActive ? (demoSnap?.fen ?? lesson.fen) : fen;
  const boardLastMove = demoActive ? (demoSnap?.lastMove ?? null) : (current?.lastMove ?? null);
  const boardKey = demoActive ? demo.idx : viewIdx;
  const boardDisabled = demoActive || !settled || done || !playerTurn;
  const showAnnotations = !demoActive && !done;

  const submit = useCallback(
    async (moves: string[]) => {
      setChecking(true);
      try {
        const res = await fetch("/api/student/chess/training/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track: "physical", lessonId: lesson.id, moves }),
        });
        const data: RunResponse = await res.json();
        if (!res.ok || !data.outcome) throw new Error(data.error ?? "The attempt failed.");
        setResult(data.outcome);
        if (data.best) setBest({ stars: data.best.stars, bestMoves: data.best.bestMoves });
      } catch (e) {
        toast.error(friendlyError(e, "The attempt failed."));
      } finally {
        setChecking(false);
      }
    },
    [lesson.id]
  );

  // When the board settles on a line the local judge accepts, ask the server to
  // grade it (and award stars). The server is still the authority.
  useEffect(() => {
    if (!settled || solved || checking) return;
    if (playerMoves.length === 0 || !judged.won) return;
    const key = playerMoves.join(" ");
    if (submittedFor.current === key) return;
    submittedFor.current = key;
    void submit(playerMoves);
  }, [settled, solved, checking, playerMoves, submit, judged.won]);

  const play = (uci: string) => {
    if (!settled || done || !playerTurn) return;
    setPlayerMoves((moves) => [...moves, uci]);
  };

  const undo = () => {
    demo.stop();
    if (playerMoves.length === 0) return;
    const next = playerMoves.slice(0, -1);
    const snaps = replayLine(lesson.fen, judgeLesson(lesson, next).line);
    setPlayerMoves(next);
    setViewIdx(snaps.length);
    setResult(null);
    submittedFor.current = "";
  };

  const reset = () => {
    demo.stop();
    setPlayerMoves([]);
    setViewIdx(0);
    setResult(null);
    submittedFor.current = "";
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <LessonHeader
        lesson={lesson}
        stars={Math.max(initialStars, best.stars)}
        onNext={nextLessonId ? () => router.push(`/dashboard/chess/training/physical/${nextLessonId}`) : undefined}
        onLearn={teaching.learn}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-4">
            <div className="mx-auto w-full max-w-[min(72vh,44rem)]">
              <InteractiveBoard
                fen={boardFen}
                legalMoves={demoActive ? [] : legalMoves}
                turn={turn}
                orientation={studentTurn}
                lastMove={boardLastMove}
                animateKey={boardKey}
                onMove={play}
                disabled={boardDisabled}
                annotations={showAnnotations ? lesson.visualHint : undefined}
              />
            </div>
            {showAnnotations && lesson.visualHint?.caption ? <AnnotationCaption caption={lesson.visualHint.caption} /> : null}
            <div className="mt-3 text-center text-xs text-muted-foreground">
              {demoActive
                ? "Watch the solution play out — press Stop demo to try it yourself."
                : done
                  ? "Solved!"
                  : !settled
                    ? "Playing…"
                    : playerTurn
                      ? "Your move — tap a piece, then a highlighted square."
                      : over
                        ? "The game is over — undo or reset to try again."
                        : "Waiting for the opponent…"}
            </div>
          </div>

          {result && !demoActive && <Feedback won={result.won} message={result.message} />}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void submit(playerMoves)} disabled={checking || playerMoves.length === 0 || done || demoActive} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              {checking ? "Checking…" : "Check answer"}
            </button>
            <ShowMeButton active={demoActive} onStart={demo.start} onStop={demo.stop} />
            <button type="button" onClick={undo} disabled={playerMoves.length === 0 || checking || demoActive} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition hover:bg-secondary disabled:opacity-50">
              <Undo2 className="h-4 w-4" /> Undo
            </button>
            <button type="button" onClick={reset} disabled={(playerMoves.length === 0 && !demoActive) || checking} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition hover:bg-secondary disabled:opacity-50">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <Hints hints={lesson.hints} />
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">How to move</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• Tap a piece to see where it can go.</li>
              <li>• Green dots are safe squares; rings are captures.</li>
              <li>• The goal is set in the mission above — no clock.</li>
            </ul>
          </div>
        </aside>
      </div>

      {teaching.open && <TeachingPopup lesson={lesson} onClose={teaching.close} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Programming trainer — solve it in code
// ---------------------------------------------------------------------------

function ProgrammingTrainer({ lesson, starters, savedCode, languages, languageLabels, initialLanguage, initialStars, initialCompleted, nextLessonId }: TrainingPlayerProps) {
  const router = useRouter();
  const [language, setLanguage] = useState(initialLanguage);
  const [codeByLang, setCodeByLang] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const l of languages) out[l] = savedCode[l] ?? starters[l] ?? "";
    return out;
  });
  const code = codeByLang[language] ?? "";
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ServerOutcome | null>(null);
  const [best, setBest] = useState({ stars: initialStars });
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [line, setLine] = useState<string[]>([]);
  // Multi-turn lessons: the student moves played so far (sent back as `history`),
  // the position the program runs against next, and whether the lesson is over.
  const [history, setHistory] = useState<string[]>([]);
  const [liveFen, setLiveFen] = useState(lesson.fen);
  const [done, setDone] = useState(false);

  // Guided lesson: optional numbered micro-steps checked in the editor before
  // the student finalises the real move(game). Purely a teaching scaffold.
  const guided = useMemo(() => lesson.guidedSteps ?? [], [lesson.guidedSteps]);
  const [stepIdx, setStepIdx] = useState(0);
  const [stepStatus, setStepStatus] = useState<"idle" | "checking" | "failed">("idle");
  const [stepMsg, setStepMsg] = useState("");
  const guidedActive = guided.length > 0 && stepIdx < guided.length;

  const snapshots = useMemo(() => (line.length ? replayLine(lesson.fen, line) : []), [lesson.fen, line]);
  const [viewIdx, setViewIdx] = useAnimatedIndex(snapshots.length);
  const current = viewIdx > 0 ? snapshots[viewIdx - 1] : null;

  const demo = useSolutionDemo(lesson);
  const demoActive = demo.active;
  const demoSnap = demoActive && demo.idx > 0 ? demo.snapshots[Math.min(demo.idx, demo.snapshots.length) - 1] : null;
  const teaching = useTeaching(lesson);

  // Draft autosave so the workspace resumes.
  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        await fetch("/api/student/chess/training/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ track: "programming", lessonId: lesson.id, language, code }),
        });
      } catch {
        /* a failed draft save is not worth interrupting the student */
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [code, language, lesson.id]);

  const run = useCallback(async () => {
    if (running) return;
    if (!code.trim()) {
      toast.error("Write some code first.");
      return;
    }
    demo.stop();
    setRunning(true);
    setResult(null);
    setStdout("");
    setStderr("");
    setViewIdx(0);
    try {
      const res = await fetch("/api/student/chess/training/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: "programming", lessonId: lesson.id, language, code, history }),
      });
      const data: RunResponse = await res.json();
      if (!res.ok || !data.outcome) {
        setStdout(String(data.stdout ?? ""));
        setStderr(String(data.stderr ?? ""));
        throw new Error(data.error ?? "The attempt failed.");
      }
      setStdout(String(data.stdout ?? ""));
      setStderr(String(data.stderr ?? ""));
      const judgedLine = data.line ?? [];
      setLine(judgedLine);
      setHistory(data.history ?? history);
      setLiveFen(data.liveFen ?? lesson.fen);
      setDone(data.done ?? false);
      setResult(data.outcome);
      if (data.best) setBest({ stars: data.best.stars });
    } catch (e) {
      toast.error(friendlyError(e, "The attempt failed."));
    } finally {
      setRunning(false);
    }
  }, [running, code, language, lesson.id, lesson.fen, history, setViewIdx, demo]);

  /** Restart a multi-turn lesson from the initial position. */
  const resetRun = useCallback(() => {
    demo.stop();
    setHistory([]);
    setLine([]);
    setLiveFen(lesson.fen);
    setDone(false);
    setResult(null);
    setStdout("");
    setStderr("");
    setViewIdx(0);
  }, [demo, lesson.fen, setViewIdx]);

  /** Load the canonical solution into the editor (Python only — the other
   * languages use the old static harness and are marked as such in the UI). */
  const showSolution = useCallback(() => {
    if (!lesson.solutionCode) return;
    setCodeByLang((m) => ({ ...m, python: lesson.solutionCode as string }));
    setLanguage("python");
    toast.message("Solution loaded — read it, then run it to confirm.");
  }, [lesson.solutionCode]);

  /**
   * Check the current guided step: verify the required API calls are present,
   * then run the code and (if the step expects output) confirm stdout contains
   * it. Deliberately ignores whether the code also solves the whole lesson —
   * a step is about learning one idea at a time.
   */
  const checkStep = useCallback(async () => {
    const step = guided[stepIdx];
    if (!step || stepStatus === "checking" || running) return;

    const missing = (step.codeMustInclude ?? []).filter((s) => !code.includes(s));
    if (missing.length) {
      setStepStatus("failed");
      setStepMsg(`Not yet — your code still needs: ${missing.join(", ")}`);
      return;
    }

    setStepStatus("checking");
    setStepMsg("");
    try {
      const res = await fetch("/api/student/chess/training/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: "programming", lessonId: lesson.id, language, code }),
      });
      const data: RunResponse = await res.json();
      const out = String(data.stdout ?? "");
      const err = String(data.stderr ?? "");
      if (!res.ok && !out) throw new Error(data.error ?? "Could not run the step.");

      const expected = step.expectedOutputIncludes ?? [];
      const lacking = expected.filter((s) => !out.includes(s));
      if (lacking.length) {
        setStepStatus("failed");
        const errTail = err
          .trim()
          .split("\n")
          .filter(Boolean)
          .slice(-3)
          .join("\n");
        setStepMsg(errTail || `Almost — print something containing: ${lacking.join(", ")}`);
        return;
      }

      setStepStatus("idle");
      setStepMsg("");
      setStepIdx((i) => i + 1);
    } catch (e) {
      setStepStatus("failed");
      setStepMsg(friendlyError(e, "Could not run the step."));
    }
  }, [guided, stepIdx, stepStatus, running, code, language, lesson.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const won = result?.won === true;
  // The board animates this turn's judged line; once it settles, a multi-turn
  // lesson hands the student the live position for the next turn of code.
  const animating = viewIdx > 0 && viewIdx < snapshots.length;
  const boardFen = demoActive
    ? (demoSnap?.fen ?? lesson.fen)
    : animating
      ? (current?.fen ?? lesson.fen)
      : done || won
        ? (snapshots[snapshots.length - 1]?.fen ?? liveFen)
        : line.length === 0
          ? lesson.fen
          : liveFen;
  const boardLastMove = demoActive ? (demoSnap?.lastMove ?? null) : (current?.lastMove ?? null);
  const boardKey = demoActive ? demo.idx : viewIdx;
  const showAnnotations = !demoActive && !won;
  // Per-ply narration: while the line animates, explain the ply the student just
  // watched; when idle, describe the turn they are coding.
  const narration = (() => {
    if (demoActive) return "Watch the solution — press Stop demo to try it yourself.";
    if (won) return result?.message ?? "Solved!";
    if (line.length === 0) return "The starting position. Run your program to see it move.";
    if (animating && lesson.lineNotes?.[viewIdx - 1]) return lesson.lineNotes[viewIdx - 1];
    if (history.length > 1 && lesson.lineNotes?.[history.length - 1]) return lesson.lineNotes[history.length - 1];
    return done ? (result?.message ?? "The line is complete.") : "Run your program again to play the next turn.";
  })();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <LessonHeader
        lesson={lesson}
        stars={Math.max(initialStars, best.stars)}
        onNext={won && nextLessonId ? () => router.push(`/dashboard/chess/training/programming/${nextLessonId}`) : undefined}
        onLearn={teaching.learn}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-4">
            <div className="mx-auto w-full max-w-[min(58vh,36rem)]">
              <InteractiveBoard fen={boardFen} legalMoves={[]} turn="white" orientation="white" lastMove={boardLastMove} animateKey={boardKey} disabled annotations={showAnnotations ? lesson.visualHint : undefined} />
            </div>
            {showAnnotations && lesson.visualHint?.caption ? <AnnotationCaption caption={lesson.visualHint.caption} /> : null}
            <div className="mt-3 text-center text-xs text-muted-foreground">{narration}</div>
          </div>

          {result && !demoActive && <Feedback won={result.won} message={result.message} />}

          {(lesson.maxPlayerMoves ?? 1) > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-background px-2 py-0.5 font-medium">
                Turn {Math.min(history.length + (done || won ? 0 : 1), lesson.maxPlayerMoves ?? 1)} of {lesson.maxPlayerMoves}
              </span>
              {history.length > 0 && !done && <span>Your program has played {history.length} move{history.length === 1 ? "" : "s"}.</span>}
            </div>
          )}

          {guided.length > 0 && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Flag className="h-3.5 w-3.5 text-accent" /> Guided lesson — step {Math.min(stepIdx + 1, guided.length)} of {guided.length}
              </div>
              {guidedActive ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{guided[stepIdx].title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{guided[stepIdx].instructions}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void checkStep()}
                      disabled={stepStatus === "checking"}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent/90 px-3.5 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
                    >
                      {stepStatus === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {stepStatus === "checking" ? "Checking…" : "Check my step"}
                    </button>
                    {stepMsg ? <span className={cn("text-xs", stepStatus === "failed" ? "text-amber-300" : "text-muted-foreground")}>{stepMsg}</span> : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-emerald-200">All steps done — finish your move(game) and press “Run my program” to solve the lesson.</p>
                </div>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-sm">
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {languageLabels[l]}
                  </option>
                ))}
              </select>
              <span className="ml-auto text-xs text-muted-foreground">
                Write <code className="rounded bg-secondary px-1">move(game)</code> · ⌘/Ctrl+Enter to run
              </span>
            </div>
            <Editor
              height="300px"
              language={MONACO_LANG[language] ?? "python"}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCodeByLang((m) => ({ ...m, [language]: v ?? "" }))}
              options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, tabSize: 4, renderLineHighlight: "all" }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void run()} disabled={running || demoActive || (done && !won)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running…" : done && !won ? "Line complete" : history.length > 0 && !done ? "Run next turn" : "Run my program"}
            </button>
            <ShowMeButton active={demoActive} onStart={demo.start} onStop={demo.stop} />
            {lesson.solutionCode && (
              <button type="button" onClick={showSolution} disabled={demoActive} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition hover:bg-secondary disabled:opacity-50">
                <Lightbulb className="h-4 w-4" /> Show solution
              </button>
            )}
            {history.length > 0 && (
              <button type="button" onClick={resetRun} disabled={running || demoActive} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition hover:bg-secondary disabled:opacity-50">
                <RotateCcw className="h-4 w-4" /> Restart
              </button>
            )}
          </div>

          {(stdout.trim() || stderr.trim()) && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" /> Output
              </div>
              <pre className="max-h-40 overflow-auto bg-black/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {stdout.trim() && <span className="text-emerald-200">{stdout.trimEnd()}</span>}
                {stderr.trim() && <span className="text-red-300">{stderr.trimEnd()}</span>}
              </pre>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CircleDot className="h-3.5 w-3.5" /> Your toolkit
            </div>
            <ul className="space-y-2">
              {CHESS_API_DOCS.map((d) => (
                <li key={d.call}>
                  <code className="block rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-accent">
                    {d.call}
                    {d.pythonOnly && <span className="ml-1 rounded bg-accent/20 px-1 text-[9px] font-semibold uppercase text-accent">py</span>}
                  </code>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{d.doc}</span>
                </li>
              ))}
            </ul>
          </div>
          {lesson.explanation && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" /> Concept explanation
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{lesson.explanation}</p>
            </div>
          )}
          {lesson.learningObjectives && lesson.learningObjectives.length > 0 && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Check className="h-3.5 w-3.5" /> Learning objectives
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {lesson.learningObjectives.map((obj, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lesson.steps && lesson.steps.length > 0 && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Flag className="h-3.5 w-3.5" /> Step-by-step
              </div>
              <ol className="space-y-1.5 text-sm text-muted-foreground">
                {lesson.steps.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-semibold text-accent">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {lesson.codeExplanation && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" /> How the code works
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{lesson.codeExplanation}</p>
            </div>
          )}
          {lesson.expandKnowledge && lesson.expandKnowledge.length > 0 && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ArrowRight className="h-3.5 w-3.5" /> Expand your knowledge
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {lesson.expandKnowledge.map((idea, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">•</span>
                    <span>{idea}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Hints hints={lesson.hints} />
          {initialCompleted && !won && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5" /> You solved this before — run it again to replay.
            </p>
          )}
        </aside>
      </div>

      {teaching.open && <CodeTeachingPopup lesson={lesson} onClose={teaching.close} />}
    </div>
  );
}
