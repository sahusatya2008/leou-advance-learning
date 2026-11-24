"use client";

import "@/lib/monaco";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { BotGrid } from "@/components/student/games/BotGrid";
import { PaintGrid } from "@/components/student/games/PaintGrid";
import { OutputPanel } from "@/components/student/games/OutputPanel";
import { ArenaChart, arenaHighlight } from "@/components/student/games/ArenaChart";
import { friendlyError } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  judge,
  judgeArena,
  parseArenaOps,
  simulate,
  simulateArena,
  simulatePaint,
  parseCanvas,
  parseWorld,
  ACTION_LABELS,
  CONCEPT_LABELS,
  type ArenaApiName,
  type ArenaFrame,
  type ArenaOp,
  type BotApiName,
  type Direction,
  type GameKind,
  type GameLanguage,
  type Level,
  type Outcome,
  type PaintApiName,
  type TestResult,
} from "@/lib/games/types";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  Lock,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Star,
  Terminal,
  TriangleAlert,
} from "lucide-react";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-lg bg-secondary/50" /> });

/** One animation step, common to the bot and paint stages. */
type AnimFrame = { x: number; y: number; dir: Direction; token: string; picked?: string };

export type PlayerGame = {
  id: string;
  title: string;
  tagline: string;
  accent: [string, string];
  kind: GameKind;
  levels: Level[];
};

type Progress = Record<string, { stars: number; bestMoves: number | null; completed: boolean }>;

const BOT_DOCS: Record<BotApiName, { call: string; doc: string }> = {
  forward: { call: "bot.forward()", doc: "Move one tile in the direction the bot faces." },
  turnLeft: { call: "bot.turnLeft()", doc: "Rotate 90° left, in place." },
  turnRight: { call: "bot.turnRight()", doc: "Rotate 90° right, in place." },
  pick: { call: "bot.pick()", doc: "Collect the energy core on this tile, if there is one." },
  canMove: { call: "bot.canMove()", doc: "True if the tile ahead is open floor." },
  canMoveLeft: { call: "bot.canMoveLeft()", doc: "True if the tile to the left is open." },
  canMoveRight: { call: "bot.canMoveRight()", doc: "True if the tile to the right is open." },
  canMoveBack: { call: "bot.canMoveBack()", doc: "True if the tile behind is open." },
  atGoal: { call: "bot.atGoal()", doc: "True when the bot stands on the portal." },
  onGem: { call: "bot.onGem()", doc: "True when the bot stands on an energy core." },
  hasKey: { call: "bot.hasKey()", doc: "True when the bot is carrying at least one key." },
};

const PAINT_DOCS: Record<PaintApiName, { call: string; doc: string }> = {
  forward: { call: "turtle.forward(n)", doc: "Move forward n cells (default 1), painting the cells you pass." },
  back: { call: "turtle.back(n)", doc: "Move backward n cells, painting as you go." },
  turnLeft: { call: "turtle.turnLeft()", doc: "Rotate 90° left, in place." },
  turnRight: { call: "turtle.turnRight()", doc: "Rotate 90° right, in place." },
  penUp: { call: "turtle.penUp()", doc: "Lift the pen: movement no longer paints." },
  penDown: { call: "turtle.penDown()", doc: "Put the pen down: movement paints again." },
};

const ARENA_DOCS: Record<ArenaApiName, { call: string; doc: string }> = {
  compare: { call: "box.compare(i, j)", doc: "Returns -1, 0 or 1 as box[i] is less, equal or greater than box[j]. One operation." },
  swap: { call: "box.swap(i, j)", doc: "Swap the two values at indices i and j. One operation." },
  get: { call: "box.get(i)", doc: "Read the value at index i. One operation." },
  set: { call: "box.set(i, v)", doc: "Write value v at index i. One operation." },
  size: { call: "box.size()", doc: "How many values are in the array. Free to call." },
};

const MONACO_LANG: Record<GameLanguage, string> = {
  python: "python",
  javascript: "javascript",
  java: "java",
  cpp: "cpp",
};

const SPEEDS = { slow: 320, normal: 140, fast: 60 } as const;
type Speed = keyof typeof SPEEDS;

function tokenLabel(token: string): string {
  if (ACTION_LABELS[token]) return ACTION_LABELS[token];
  if (token[0] === "F") return `forward(${token.slice(1)})`;
  if (token[0] === "B") return `back(${token.slice(1)})`;
  if (token === "U") return "penUp()";
  if (token === "D") return "penDown()";
  return token;
}

function arenaOpLabel(op: ArenaOp): string {
  if (op.op === "c") return `compare(${op.i}, ${op.j})`;
  if (op.op === "s") return `swap(${op.i}, ${op.j})`;
  if (op.op === "g") return `get(${op.i})`;
  return `set(${op.i}, ${op.v})`;
}

export function GamePlayer({
  game,
  starters,
  savedCode,
  languages,
  languageLabels,
  initial,
}: {
  game: PlayerGame;
  starters: Record<string, Record<string, string>>;
  savedCode: Record<string, string>;
  languages: GameLanguage[];
  languageLabels: Record<GameLanguage, string>;
  initial: { levelId: string; language: GameLanguage; progress: Progress };
}) {
  const [levelIndex, setLevelIndex] = useState(() => Math.max(0, game.levels.findIndex((l) => l.id === initial.levelId)));
  const level = game.levels[levelIndex];
  const kind = game.kind;

  const [language, setLanguage] = useState<GameLanguage>(initial.language);
  const [progress, setProgress] = useState<Progress>(initial.progress);

  const [codeByLevel, setCodeByLevel] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const l of game.levels) map[l.id] = savedCode[l.id] ?? starters[l.id]?.[initial.language] ?? "";
    return map;
  });
  const code = codeByLevel[level.id] ?? "";

  const world = useMemo(() => (level.kind === "bot" ? parseWorld(level.world) : null), [level]);
  const canvas = useMemo(() => (level.kind === "paint" ? parseCanvas(level.target) : null), [level]);

  const [tokens, setTokens] = useState<string[]>([]);
  const [frames, setFrames] = useState<AnimFrame[]>([]);
  const [arenaFrames, setArenaFrames] = useState<ArenaFrame[]>([]);
  const [arenaReturned, setArenaReturned] = useState<number | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [phase, setPhase] = useState<"idle" | "running" | "playing" | "done">("idle");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [bump, setBump] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [error, setError] = useState("");

  // Bot/paint replay cell frames; arena replays operation frames. One counter
  // drives both so the play/pause/skip controls are shared.
  const totalFrames = level.kind === "arena" ? arenaFrames.length : frames.length;

  const resetStage = useCallback(() => {
    setTokens([]);
    setFrames([]);
    setArenaFrames([]);
    setArenaReturned(null);
    setFrameIndex(0);
    setPhase("idle");
    setOutcome(null);
    setResults(null);
    setStdout("");
    setStderr("");
    setError("");
    setHintsShown(0);
    setBump((b) => b + 1);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = window.setTimeout(() => {
      if (frameIndex + 1 >= totalFrames) {
        setFrameIndex(totalFrames);
        setPhase("done");
      } else {
        setFrameIndex(frameIndex + 1);
      }
    }, SPEEDS[speed]);
    return () => window.clearTimeout(t);
  }, [phase, frameIndex, totalFrames, speed]);

  const firstIncomplete = game.levels.findIndex((l) => !progress[l.id]?.completed);
  const unlockedUpTo = firstIncomplete === -1 ? game.levels.length - 1 : firstIncomplete;

  const setCode = useCallback(
    (next: string) => setCodeByLevel((m) => ({ ...m, [level.id]: next })),
    [level.id]
  );

  const persist = useCallback(
    (levelId: string, lang: GameLanguage, nextCode: string) => {
      void fetch("/api/student/games/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, levelId, language: lang, code: nextCode }),
      }).catch(() => null);
    },
    [game.id]
  );

  useEffect(() => {
    const t = window.setTimeout(() => persist(level.id, language, code), 1200);
    return () => window.clearTimeout(t);
  }, [code, language, level.id, persist]);

  const run = useCallback(async () => {
    if (phase === "running" || phase === "playing") return;
    if (!code.trim()) {
      toast.error("Write some code first.");
      return;
    }
    setPhase("running");
    setOutcome(null);
    setResults(null);
    setStdout("");
    setStderr("");
    setError("");
    try {
      const res = await fetch("/api/student/games/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, levelId: level.id, language, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The run failed.");

      setStdout(String(data.stdout ?? ""));
      setStderr(String(data.stderr ?? ""));
      const result: Outcome = data.outcome;
      setOutcome(result ?? null);

      if (kind === "output") {
        setResults(Array.isArray(data.results) ? data.results : []);
        setPhase("done");
      } else {
        const tk: string[] = Array.isArray(data.tokens) ? data.tokens : [];
        setTokens(tk);
        setFrameIndex(0);
        if (level.kind === "bot" && world) {
          const sim = simulate(world, tk);
          setFrames(sim.frames.map((f) => ({ x: f.x, y: f.y, dir: f.dir, token: f.token, picked: f.picked })));
          setOutcome(result ?? judge(level, sim));
          setPhase(tk.length ? "playing" : "done");
        } else if (level.kind === "paint" && canvas) {
          const sim = simulatePaint(canvas, tk);
          setFrames(sim.frames.map((f) => ({ x: f.x, y: f.y, dir: f.dir, token: f.token })));
          setPhase(tk.length ? "playing" : "done");
        } else if (level.kind === "arena") {
          const returned = typeof data.returned === "number" ? data.returned : null;
          const sim = simulateArena(level, parseArenaOps(tk));
          setArenaFrames(sim.frames);
          setArenaReturned(returned);
          setOutcome(result ?? judgeArena(level, sim, returned));
          setPhase(sim.frames.length ? "playing" : "done");
        } else {
          setPhase("done");
        }
      }

      if (result?.won) {
        setProgress((p) => {
          const prev = p[level.id];
          return {
            ...p,
            [level.id]: {
              stars: Math.max(prev?.stars ?? 0, result.stars),
              bestMoves: prev?.bestMoves == null ? result.commands : Math.min(prev.bestMoves, result.commands),
              completed: true,
            },
          };
        });
      }
    } catch (e) {
      setError(friendlyError(e, "The run failed."));
      setPhase("idle");
    }
  }, [phase, code, game.id, level, language, world, canvas, kind]);

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

  const reset = () => resetStage();

  const skip = () => {
    setFrameIndex(totalFrames);
    setPhase("done");
  };

  // Derived animation state.
  const shown = frames.slice(0, frameIndex);
  const last = shown[shown.length - 1];
  const startPose = world ? { x: world.start.x, y: world.start.y, dir: world.startDir } : { x: 0, y: 0, dir: 0 as Direction };
  const bot = last ? { x: last.x, y: last.y, dir: last.dir } : startPose;
  const collected = useMemo(() => new Set(shown.filter((f) => f.picked).map((f) => f.picked!)), [shown]);
  const trail = useMemo(() => shown.map((f) => `${f.x},${f.y}`), [shown]);
  const turtle = last ? { x: last.x, y: last.y, dir: last.dir } : canvas ? { x: canvas.start.x, y: canvas.start.y, dir: canvas.startDir } : startPose;
  const inked = useMemo(
    () => (canvas ? simulatePaint(canvas, tokens.slice(0, frameIndex)).inked : new Set<string>()),
    [canvas, tokens, frameIndex]
  );
  const arenaShown = arenaFrames.slice(0, frameIndex);
  const arenaLast = arenaShown[arenaShown.length - 1];
  const arenaValues = level.kind === "arena" ? (arenaLast ? arenaLast.array : level.input) : [];
  const arenaHighlighted = level.kind === "arena" && arenaLast ? arenaHighlight(arenaLast.op) : [];
  const playing = phase === "playing";
  const finishedRun = phase === "done" && outcome;

  const par = level.kind === "output" ? null : level.par;
  const unit = kind === "arena" ? "ops" : "moves";

  const changeLevel = (i: number) => {
    if (i > unlockedUpTo) {
      toast("Finish the previous lab to unlock this one.");
      return;
    }
    persist(level.id, language, code);
    resetStage();
    setLevelIndex(i);
  };

  const changeLanguage = (next: GameLanguage) => {
    if (next === language) return;
    setLanguage(next);
    const starter = starters[level.id]?.[next] ?? "";
    setCodeByLevel((m) => ({ ...m, [level.id]: starter }));
    persist(level.id, next, starter);
  };

  const apiDocs =
    level.kind === "bot"
      ? BOT_DOCS
      : level.kind === "paint"
        ? PAINT_DOCS
        : level.kind === "arena"
          ? ARENA_DOCS
          : null;
  const apiNames: string[] = level.kind === "output" ? [] : level.api;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: game.accent[1] }}>
            {game.title}
          </h1>
          <p className="text-sm text-muted-foreground">{game.tagline}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Lab {levelIndex + 1}/{game.levels.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {Object.values(progress).reduce((n, p) => n + p.stars, 0)}/{game.levels.length * 3}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card/60 p-2">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Labs</p>
            {game.levels.map((l, i) => {
              const p = progress[l.id];
              const locked = i > unlockedUpTo;
              const active = i === levelIndex;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => changeLevel(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition",
                    active ? "bg-primary/15 text-foreground" : "hover:bg-secondary/60",
                    locked && "opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                      active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {locked ? <Lock className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    {[0, 1, 2].map((s) => (
                      <Star
                        key={s}
                        className={cn("h-3 w-3", (p?.stars ?? 0) > s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          {apiDocs && <ApiPanel names={apiNames} docs={apiDocs} />}
          <HintsPanel hints={level.hints} shown={hintsShown} onShow={() => setHintsShown((n) => n + 1)} />
        </aside>

        <section className="min-w-0 space-y-4">
          {/* mission bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: game.accent[1] }}>
                  {CONCEPT_LABELS[level.concept]}
                </span>
                <h2 className="truncate text-lg font-semibold">{level.name}</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{level.mission}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {par ? (
                <>
                  <div>3★ within {par.three} {unit}</div>
                  <div>2★ within {par.two} {unit}</div>
                </>
              ) : (
                <div>Pass all tests for 3★</div>
              )}
            </div>
          </div>

          {/* stage */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-4">
            <div
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{ background: `radial-gradient(80% 80% at 50% 0%, ${game.accent[0]}33, transparent 70%)` }}
            />
            <div className="relative">
              {level.kind === "output" ? (
                <OutputPanel level={level} results={results} />
              ) : level.kind === "arena" ? (
                <div className="mx-auto w-full max-w-2xl">
                  <ArenaChart values={arenaValues} highlighted={arenaHighlighted} accent={game.accent} />
                </div>
              ) : (
                <div className="mx-auto max-w-md">
                  {level.kind === "bot" && world && (
                    <BotGrid world={world} bot={bot} collected={collected} trail={trail} accent={game.accent} bump={bump} />
                  )}
                  {level.kind === "paint" && canvas && (
                    <PaintGrid canvas={canvas} turtle={turtle} inked={inked} accent={game.accent} bump={bump} />
                  )}
                </div>
              )}
            </div>

            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void run()}
                disabled={playing || phase === "running"}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {phase === "running" ? "Building…" : "Run"}
              </button>
              <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-secondary">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              {playing && (
                <button type="button" onClick={skip} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-secondary">
                  <SkipForward className="h-4 w-4" /> Skip
                </button>
              )}
              {kind !== "output" && (
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {totalFrames > 0 && (
                    <span className="tabular-nums">
                      {Math.min(frameIndex, totalFrames)}/{totalFrames} {unit}
                    </span>
                  )}
                  <div className="flex overflow-hidden rounded-lg border border-border">
                    {(["slow", "normal", "fast"] as Speed[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeed(s)}
                        className={cn("px-2 py-1 capitalize", speed === s ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
                      >
                        {s[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* result banner */}
          {finishedRun && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm",
                outcome.won ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
              )}
            >
              {outcome.won ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <TriangleAlert className="h-5 w-5 text-red-400" />}
              <span className="font-medium">{outcome.reason}</span>
              {outcome.won && (
                <span className="flex items-center gap-1">
                  {[0, 1, 2].map((s) => (
                    <Star key={s} className={cn("h-5 w-5", outcome.stars > s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                  ))}
                </span>
              )}
              {outcome.won && par && outcome.stars < 3 && (
                <span className="text-xs text-muted-foreground">Solve it in {par.three} {unit} for 3★.</span>
              )}
              {outcome.won && levelIndex < game.levels.length - 1 && (
                <button
                  type="button"
                  onClick={() => changeLevel(levelIndex + 1)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Next lab <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* editor */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Language</span>
              <select
                value={language}
                onChange={(e) => changeLanguage(e.target.value as GameLanguage)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {languageLabels[l]}
                  </option>
                ))}
              </select>
              <span className="ml-auto text-xs text-muted-foreground">
                Write inside <code className="rounded bg-secondary px-1">solve</code> · ⌘/Ctrl+Enter to run
              </span>
            </div>
            <Editor
              height="300px"
              language={MONACO_LANG[language]}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                tabSize: 4,
                renderLineHighlight: "all",
              }}
            />
          </div>

          {/* console */}
          {(stdout.trim() || stderr.trim()) && (
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" /> Output
              </div>
              <pre className="max-h-48 overflow-auto bg-black/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {stdout.trim() && <span className="text-emerald-200">{stdout.trimEnd()}</span>}
                {stderr.trim() && <span className="text-red-300">{stderr.trimEnd()}</span>}
              </pre>
            </div>
          )}

          {/* last run sequence (helps debugging) */}
          {shown.length > 0 && (
            <details className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                {shown.length} recorded move{shown.length === 1 ? "" : "s"}
              </summary>
              <div className="mt-2 flex flex-wrap gap-1 font-mono text-[11px]">
                {shown.map((f, i) => (
                  <span key={i} className="rounded border border-border bg-background px-1.5 py-0.5">
                    {tokenLabel(f.token)}
                  </span>
                ))}
              </div>
            </details>
          )}

          {arenaShown.length > 0 && (
            <details className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                {arenaShown.length} recorded operation{arenaShown.length === 1 ? "" : "s"}
                {arenaReturned != null && <span className="ml-2">· returned {arenaReturned}</span>}
              </summary>
              <div className="mt-2 flex flex-wrap gap-1 font-mono text-[11px]">
                {arenaShown.map((f, i) => (
                  <span key={i} className="rounded border border-border bg-background px-1.5 py-0.5">
                    {arenaOpLabel(f.op)}
                  </span>
                ))}
              </div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

function ApiPanel({ names, docs }: { names: string[]; docs: Record<string, { call: string; doc: string }> }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" /> Toolkit
      </div>
      <ul className="space-y-2">
        {names.map((name) => (
          <li key={name}>
            <code className="block rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px]" style={{ color: "#22d3ee" }}>
              {docs[name].call}
            </code>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{docs[name].doc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HintsPanel({ hints, shown, onShow }: { hints: string[]; shown: number; onShow: () => void }) {
  if (!hints.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Lightbulb className="h-3.5 w-3.5" /> Hints
      </div>
      <ul className="space-y-2">
        {hints.slice(0, shown).map((h, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-snug text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      {shown < hints.length ? (
        <button type="button" onClick={onShow} className="mt-3 w-full rounded-lg border border-border px-3 py-1.5 text-xs transition hover:bg-secondary">
          Reveal hint {shown + 1} of {hints.length}
        </button>
      ) : (
        <p className="mt-3 text-[11px] text-muted-foreground/70">That&apos;s every hint for this lab.</p>
      )}
    </div>
  );
}
