/**
 * Coding-games engine — the language-agnostic core.
 *
 * The arcade hosts several "cabinets", and a cabinet is a *kind* of puzzle:
 *
 *   - `bot`    — a robot moves around a grid world (BOTLAB, Maze Lab).
 *   - `paint`  — a turtle draws cells on a canvas (Pixel Painter).
 *   - `output` — no world at all; the program computes a value (Data Dojo).
 *   - `arena`  — the program rearranges an array through a counted API (ALGO ARENA).
 *
 * Every kind shares one contract: the student writes a `solve(...)` function,
 * the sandbox runs a generated harness that prints a compact result, and the app
 * replays that result to animate *and* judge. Nothing here runs student code.
 * The split is deliberate — the same pure replay runs on the server (to award
 * stars, which a client must not forge) and on the client (to animate).
 */

/** 0 = North (up), 1 = East (right), 2 = South (down), 3 = West (left). */
export type Direction = 0 | 1 | 2 | 3;

export type GameLanguage = "python" | "javascript" | "java" | "cpp";

/** Every language the engine can compile a harness for. */
export const GAME_LANGUAGES: GameLanguage[] = ["python", "javascript", "java", "cpp"];

/**
 * Languages offered in the UI. C++ compiles `#include <bits/stdc++.h>` under a
 * single sandboxed CPU, which on this host runs past the runner's 10s kill
 * budget (measured 36–58s vs 3.4s for Node and 4.6s for Java), so a C++ run
 * would surface to the student as a mysterious timeout. It stays in the engine
 * for when the runner's budget grows; it is simply not advertised yet.
 */
export const OFFERED_LANGUAGES: GameLanguage[] = ["python", "javascript", "java"];

export const LANGUAGE_LABELS: Record<GameLanguage, string> = {
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
  cpp: "C++",
};

export function isOfferedLanguage(v: string): v is GameLanguage {
  return (OFFERED_LANGUAGES as string[]).includes(v);
}

export type GameKind = "bot" | "paint" | "output" | "arena";

// ---------------------------------------------------------------------------
// Concepts — the idea a level teaches. Extended as the arcade grew.
// ---------------------------------------------------------------------------

export type Concept =
  | "SEQUENCE"
  | "LOOP"
  | "CONDITION"
  | "SENSOR"
  | "FUNCTION"
  | "STATE"
  | "RECURSION"
  | "ALGORITHM"
  | "SEARCH"
  | "SORT"
  | "ARRAYS"
  | "STRINGS"
  | "NUMBERS"
  | "MATH"
  | "LOGIC"
  | "DESIGN";

export const CONCEPT_LABELS: Record<Concept, string> = {
  SEQUENCE: "Sequencing",
  LOOP: "Loops",
  CONDITION: "Conditionals",
  SENSOR: "Sensors",
  FUNCTION: "Functions",
  STATE: "State & Variables",
  RECURSION: "Recursion",
  ALGORITHM: "Algorithms",
  SEARCH: "Searching",
  SORT: "Sorting",
  ARRAYS: "Lists & Arrays",
  STRINGS: "Strings",
  NUMBERS: "Numbers",
  MATH: "Math",
  LOGIC: "Logic",
  DESIGN: "Design",
};

// ---------------------------------------------------------------------------
// Shared level shape
// ---------------------------------------------------------------------------

/** How many commands earn a given star, or how many *steps of effort* a level
 *  should take. Bot/paint levels use it directly. */
export type Par = { two: number; three: number };

type BaseLevel = {
  id: string;
  /** Short name shown on the level map. */
  name: string;
  /** The one-line mission shown at the top of the stage. */
  mission: string;
  /** The idea this level is teaching; drives the badge and the hint copy. */
  concept: Concept;
  /** Graduated hints, revealed one at a time. */
  hints: string[];
  /** Optional per-language starter override; defaults to the level template. */
  starter?: Partial<Record<GameLanguage, string>>;
};

// ===========================================================================
// BOT kind
// ===========================================================================

/**
 * Grid characters. A level is written as readable ASCII so an author can see the
 * shape of the world in the source:
 *   `#` wall   `.` open   `*` energy core   `G` goal
 *   `k` key    `D` door (needs a key)      `1`/`2` teleporters (a pair)
 *   `S` start facing East, or `^ > v <` for an explicit facing.
 */
export type WorldSpec = {
  /** Row strings, top to bottom. All rows must be the same length. */
  rows: string[];
};

export type BotObjective = "reach" | "paint";

/** One callable the student's code may use, gated per level so new ideas are
 *  introduced one at a time instead of dumping the whole API on day one. */
export type BotApiName =
  | "forward"
  | "turnLeft"
  | "turnRight"
  | "pick"
  | "canMove"
  | "canMoveLeft"
  | "canMoveRight"
  | "canMoveBack"
  | "atGoal"
  | "onGem"
  | "hasKey";

/** Back-compat alias used across the bot harness/UI. */
export type ApiName = BotApiName;

export type BotLevel = BaseLevel & {
  kind: "bot";
  world: WorldSpec;
  par: Par;
  /** The subset of the API the level hands the student. */
  api: BotApiName[];
  /**
   * `reach` (default) — get to the portal, collecting every core.
   * `paint` — walk over every open floor tile (the "vacuum" puzzle).
   */
  objective?: BotObjective;
};

export type ParsedWorld = {
  width: number;
  height: number;
  walls: Set<string>;
  gems: Set<string>;
  keys: Set<string>;
  doors: Set<string>;
  teleports: Map<string, string>;
  goal: { x: number; y: number } | null;
  start: { x: number; y: number };
  startDir: Direction;
};

export type Point = { x: number; y: number };

const key = (x: number, y: number) => `${x},${y}`;

const START_DIRS: Record<string, Direction> = { "^": 0, ">": 1, v: 2, "<": 3 };

export function parseWorld(spec: WorldSpec): ParsedWorld {
  const rows = spec.rows;
  const height = rows.length;
  const width = height ? rows[0].length : 0;
  const walls = new Set<string>();
  const gems = new Set<string>();
  const keys = new Set<string>();
  const doors = new Set<string>();
  const teleports = new Map<string, string>();
  let goal: Point | null = null;
  let start: Point = { x: 0, y: 0 };
  let startDir: Direction = 1;

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      if (ch === "#") walls.add(key(x, y));
      else if (ch === "*") gems.add(key(x, y));
      else if (ch === "k") keys.add(key(x, y));
      else if (ch === "D") doors.add(key(x, y));
      else if (ch === "G") goal = { x, y };
      if (ch === "1" || ch === "2") teleports.set(key(x, y), ch);
      if (ch === "S") start = { x, y };
      else if (ch in START_DIRS) {
        start = { x, y };
        startDir = START_DIRS[ch];
      }
    }
  }
  return { width, height, walls, gems, keys, doors, teleports, goal, start, startDir };
}

// ---------------------------------------------------------------------------
// Trace protocol (bot + paint share one marker; tokens differ per kind)
// ---------------------------------------------------------------------------

/** Action tokens emitted by the per-language harness. Kept to one letter each
 *  because they are concatenated and parsed on every run. */
export const TOKEN = {
  forward: "F",
  turnLeft: "L",
  turnRight: "R",
  pick: "P",
  crash: "X",
} as const;

/** The marker the harness writes in front of its trace on stdout. Chosen to be
 *  something student `print` output will never contain. */
export const TRACE_MARKER = "@@BOT@@";

/** Marker for the output kind's per-case result lines. */
export const OUTPUT_MARKER = "@@OUT@@";

export const ACTION_LABELS: Record<string, string> = {
  F: "forward()",
  L: "turnLeft()",
  R: "turnRight()",
  P: "pick()",
  X: "crash",
};

export function extractTrace(stdout: string): string[] {
  const line = stdout.split("\n").find((l) => l.includes(TRACE_MARKER));
  if (!line) return [];
  const rest = line.slice(line.indexOf(TRACE_MARKER) + TRACE_MARKER.length).trim();
  if (!rest) return [];
  return rest
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Bot replay
// ---------------------------------------------------------------------------

export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], // N
  [1, 0], // E
  [0, 1], // S
  [-1, 0], // W
];

/** One frame after applying one token — the animation plays these in order. */
export type Frame = {
  index: number;
  x: number;
  y: number;
  dir: Direction;
  token: string;
  /** Gem picked up on this frame, as an "x,y" key, if any. */
  picked?: string;
  /** Key picked up on this frame, as an "x,y" key, if any. */
  gotKey?: string;
  /** Where the bot teleported to on this frame, as an "x,y" key. */
  teleportedTo?: string;
  /** Whether this frame left the visited trail (paint objective). */
  visited?: string;
};

export type SimResult = {
  frames: Frame[];
  x: number;
  y: number;
  dir: Direction;
  collected: string[];
  keysHeld: number;
  crashed: boolean;
  overrun: boolean;
  commands: number;
  visited: Set<string>;
  reason: string;
};

/** Actions the sim will process before declaring a runaway. Matches the
 *  harness's own cap so a genuinely infinite loop is caught on both sides. */
export const MAX_STEPS = 20_000;

/**
 * Replay a trace against a world. Pure and total: any token the harness can
 * emit is handled, and a crash stops the frame list there (so the UI does not
 * animate the bot walking through a wall).
 */
export function simulate(world: ParsedWorld, tokens: string[]): SimResult {
  let x = world.start.x;
  let y = world.start.y;
  let dir = world.startDir;
  const collected = new Set<string>();
  const visited = new Set<string>();
  visited.add(key(x, y));
  let keysHeld = 0;
  const frames: Frame[] = [];
  let crashed = false;
  let overrun = false;
  let commands = 0;

  const blocked = (nx: number, ny: number) => {
    if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) return true;
    if (world.walls.has(key(nx, ny))) return true;
    if (world.doors.has(key(nx, ny)) && keysHeld <= 0) return true;
    return false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (commands >= MAX_STEPS) {
      overrun = true;
      break;
    }
    commands++;

    let picked: string | undefined;
    let gotKey: string | undefined;
    let teleportedTo: string | undefined;
    switch (token) {
      case "F": {
        const [dx, dy] = DIRS[dir];
        const nx = x + dx;
        const ny = y + dy;
        if (blocked(nx, ny)) {
          crashed = true;
        } else {
          x = nx;
          y = ny;
          visited.add(key(x, y));
          if (world.keys.has(key(x, y))) {
            gotKey = key(x, y);
            keysHeld++;
          }
          const tp = world.teleports.get(key(x, y));
          if (tp) {
            // Hop to the other end of the pair.
            for (const [k, v] of world.teleports) {
              if (v === tp && k !== key(x, y)) {
                const [tx, ty] = k.split(",").map(Number);
                x = tx;
                y = ty;
                teleportedTo = k;
                visited.add(k);
                break;
              }
            }
          }
        }
        break;
      }
      case "L":
        dir = ((dir + 3) % 4) as Direction;
        break;
      case "R":
        dir = ((dir + 1) % 4) as Direction;
        break;
      case "P": {
        const k = key(x, y);
        if (world.gems.has(k)) {
          collected.add(k);
          picked = k;
        }
        break;
      }
      case "X":
        crashed = true;
        break;
      default:
        // Unknown token: ignore rather than derail the replay.
        commands--;
        continue;
    }

    frames.push({ index: frames.length, x, y, dir, token, picked, gotKey, teleportedTo });
    if (crashed) break;
  }

  let reason = "";
  if (overrun) reason = "Your program kept going for too long — is something looping forever?";
  else if (crashed) reason = world.doors.size && keysHeld === 0 ? "A locked door blocked the bot." : "The bot hit a wall.";
  else if (!world.goal) reason = "This level has no goal.";

  return {
    frames,
    x,
    y,
    dir,
    collected: [...collected],
    keysHeld,
    crashed,
    overrun,
    commands,
    visited,
    reason,
  };
}

export type Outcome = {
  won: boolean;
  stars: number;
  commands: number;
  reason: string;
};

export type BotOutcome = Outcome & {
  crashed: boolean;
  overrun: boolean;
  collected: number;
  totalGems: number;
  reachedGoal: boolean;
};

/** Decide the result of a bot replay. Star rules are simple and stated to the
 *  student: 1 for solving it, 2 within the loose budget, 3 within the tight. */
export function judge(level: BotLevel, sim: SimResult): BotOutcome {
  const world = parseWorld(level.world);
  const totalGems = world.gems.size;
  const atGoal = !!world.goal && sim.x === world.goal.x && sim.y === world.goal.y;
  const paintedAll = sim.visited.size >= openFloorCount(world);

  let won = false;
  let reason = sim.reason;
  if (!sim.crashed && !sim.overrun) {
    if (level.objective === "paint") {
      won = paintedAll;
      reason = won ? "Every tile sanitised!" : "Some floor tiles were never reached.";
    } else {
      won = atGoal && sim.collected.length >= totalGems;
      if (won) reason = "Level complete!";
      else if (!world.goal) reason = "This level has no goal.";
      else if (!atGoal) reason = "The bot didn't reach the portal.";
      else if (sim.collected.length < totalGems) reason = "Some energy cores were left behind.";
    }
  }

  let stars = 0;
  if (won) {
    stars = 1;
    if (sim.commands <= level.par.two) stars = 2;
    if (sim.commands <= level.par.three) stars = 3;
  }
  return {
    won,
    stars,
    commands: sim.commands,
    reason,
    crashed: sim.crashed,
    overrun: sim.overrun,
    collected: sim.collected.length,
    totalGems,
    reachedGoal: atGoal,
  };
}

/** Number of open (non-wall) tiles — the denominator for a paint objective. */
export function openFloorCount(world: ParsedWorld): number {
  return world.width * world.height - world.walls.size;
}

// ===========================================================================
// PAINT kind — a turtle that inks cells
// ===========================================================================

export type PaintApiName = "forward" | "back" | "turnLeft" | "turnRight" | "penUp" | "penDown";

/**
 * A paint target is written as an ASCII sheet, exactly as it should look when
 * finished:
 *   `#` must be painted (inked)   `@` must NOT be painted   `.`/space = don't care
 *   `S` start facing East, or `^ > v <` for an explicit facing (the start cell
 *   is not itself a required paint).
 */
export type PaintLevel = BaseLevel & {
  kind: "paint";
  target: string[];
  par: Par;
  api: PaintApiName[];
};

export type ParsedCanvas = {
  width: number;
  height: number;
  required: Set<string>;
  forbidden: Set<string>;
  start: Point;
  startDir: Direction;
};

export function parseCanvas(target: string[]): ParsedCanvas {
  const height = target.length;
  const width = height ? target[0].length : 0;
  const required = new Set<string>();
  const forbidden = new Set<string>();
  let start: Point = { x: 0, y: 0 };
  let startDir: Direction = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = target[y][x];
      if (ch === "#") required.add(key(x, y));
      else if (ch === "@") forbidden.add(key(x, y));
      if (ch === "S") start = { x, y };
      else if (ch in START_DIRS) {
        start = { x, y };
        startDir = START_DIRS[ch];
      }
    }
  }
  return { width, height, required, forbidden, start, startDir };
}

export type PaintFrame = {
  index: number;
  x: number;
  y: number;
  dir: Direction;
  token: string;
  inked?: string;
};

export type PaintSimResult = {
  frames: PaintFrame[];
  x: number;
  y: number;
  dir: Direction;
  inked: Set<string>;
  crashed: boolean;
  overrun: boolean;
  commands: number;
  reason: string;
};

/** Replay a turtle trace. `forward(k)`/`back(k)` move k cells, painting the
 *  cells it passes through while the pen is down. Turning is always 90°. */
export function simulatePaint(canvas: ParsedCanvas, tokens: string[]): PaintSimResult {
  let x = canvas.start.x;
  let y = canvas.start.y;
  let dir = canvas.startDir;
  let penDown = true;
  const inked = new Set<string>();
  const frames: PaintFrame[] = [];
  let crashed = false;
  let overrun = false;
  let commands = 0;

  const paint = (cx: number, cy: number) => {
    const k = key(cx, cy);
    if (!inked.has(k)) inked.add(k);
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (commands >= MAX_STEPS) {
      overrun = true;
      break;
    }
    commands++;

    let inkedCell: string | undefined;
    if (token[0] === "F" || token[0] === "B") {
      const steps = Math.max(0, Number(token.slice(1)) || 0);
      const sign = token[0] === "F" ? 1 : -1;
      const [dx, dy] = DIRS[dir];
      for (let s = 0; s < steps; s++) {
        x += dx * sign;
        y += dy * sign;
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
          crashed = true;
          break;
        }
        if (penDown) paint(x, y);
      }
      if (penDown && !crashed) inkedCell = key(x, y);
    } else if (token === "L") {
      dir = ((dir + 3) % 4) as Direction;
    } else if (token === "R") {
      dir = ((dir + 1) % 4) as Direction;
    } else if (token === "U") {
      penDown = false;
    } else if (token === "D") {
      penDown = true;
    } else {
      commands--;
      continue;
    }

    frames.push({ index: frames.length, x, y, dir, token, inked: inkedCell });
    if (crashed) break;
  }

  let reason = "";
  if (overrun) reason = "Your drawing ran away — is something looping forever?";
  else if (crashed) reason = "The pen left the canvas.";

  return { frames, x, y, dir, inked, crashed, overrun, commands, reason };
}

export function judgePaint(level: PaintLevel, sim: PaintSimResult): Outcome {
  const canvas = parseCanvas(level.target);
  let won = !sim.crashed && !sim.overrun;
  let reason = sim.reason;
  if (won) {
    const missing = [...canvas.required].filter((k) => !sim.inked.has(k));
    const stray = [...canvas.forbidden].filter((k) => sim.inked.has(k));
    if (missing.length) {
      won = false;
      reason = `${missing.length} cell${missing.length === 1 ? "" : "s"} still unpainted.`;
    } else if (stray.length) {
      won = false;
      reason = `${stray.length} cell${stray.length === 1 ? "" : "s"} painted that shouldn't be.`;
    } else {
      reason = "Picture perfect!";
    }
  }
  let stars = 0;
  if (won) {
    stars = 1;
    if (sim.commands <= level.par.two) stars = 2;
    if (sim.commands <= level.par.three) stars = 3;
  }
  return { won, stars, commands: sim.commands, reason };
}

export function extractPaintTrace(stdout: string): string[] {
  return extractTrace(stdout);
}

// ===========================================================================
// OUTPUT kind — compute a value (no world)
// ===========================================================================

export type OutputTest = {
  /** The single string the student's `solve` receives. */
  input: string;
  /** What the return value (as a string) must equal, after trimming. */
  expected: string;
  /** Shown in the UI when a student is stuck ("n=5 → ..."). */
  note?: string;
};

export type OutputLevel = BaseLevel & {
  kind: "output";
  /** A longer statement of the problem, shown above the tests. */
  spec: string;
  tests: OutputTest[];
};

/** One test's grading result (server → client). */
export type TestResult = {
  input: string;
  expected: string;
  got: string;
  pass: boolean;
  note?: string;
  errored?: boolean;
};

/** Parse the harness's `@@OUT@@<i>|<value>` lines into per-test results. Missing
 *  cases count as failures so a program that never reports is graded honestly. */
export function extractOutputResults(stdout: string, level: OutputLevel): TestResult[] {
  const seen = new Map<number, string>();
  for (const line of stdout.split("\n")) {
    const at = line.indexOf(OUTPUT_MARKER);
    if (at < 0) continue;
    const rest = line.slice(at + OUTPUT_MARKER.length);
    const bar = rest.indexOf("|");
    if (bar < 0) continue;
    const i = Number(rest.slice(0, bar).trim());
    if (!Number.isInteger(i)) continue;
    seen.set(i, rest.slice(bar + 1));
  }
  return level.tests.map((t, i) => {
    const raw = seen.get(i);
    const errored = raw != null && raw.startsWith("!!ERR!!");
    const got = errored ? raw!.slice("!!ERR!!".length) : (raw ?? "");
    const expected = t.expected.trim();
    const pass = !errored && got.trim() === expected;
    return { input: t.input, expected, got: got.trim(), pass, errored, note: t.note };
  });
}

export function judgeOutput(level: OutputLevel, results: TestResult[]): Outcome {
  const total = results.length || 1;
  const passed = results.filter((r) => r.pass).length;
  const won = passed === total;
  let stars = 0;
  if (won) stars = 3;
  else if (passed / total >= 0.7) stars = 2;
  else if (passed / total >= 0.3) stars = 1;
  const reason = won
    ? "All tests pass!"
    : `${passed}/${total} tests pass. Fix the rest to win the level.`;
  return { won, stars, commands: 0, reason };
}

// ===========================================================================
// ARENA kind — rearrange an array through a counted API (ALGO ARENA)
// ===========================================================================

/**
 * The learner is handed a `box` that wraps a hidden array. The only way to
 * touch it is through a small, gated API — `compare`, `swap`, `get`, `set` and
 * `size` — and every call is counted. The array is animated as it changes, and
 * the score is the number of operations it took, so a bubble sort *works* but a
 * quicksort *wins*. This is the only kind that grades efficiency, not just
 * correctness.
 */

/** Marker in front of the harness's operation trace. */
export const ARENA_MARKER = "@@AR@@";

/** Marker in front of `solve`'s return value (used by the `find` goal). */
export const RETURN_MARKER = "@@RET@@";

/** Operations the replay processes before declaring a runaway. */
export const ARENA_MAX_OPS = 20_000;

export type ArenaGoal =
  | "sort-asc"
  | "sort-desc"
  | "reverse"
  | "rotate-left"
  | "partition-even-odd"
  | "dutch-flag"
  | "find";

export type ArenaApiName = "compare" | "swap" | "get" | "set" | "size";

export type ArenaLevel = BaseLevel & {
  kind: "arena";
  /** The starting array the `box` wraps. */
  input: number[];
  goal: ArenaGoal;
  /** For `find`: the value whose index must be returned. */
  target?: number;
  /** For `dutch-flag`: the pivot value to partition around. */
  pivot?: number;
  /** For `rotate-left`: how far to rotate. */
  k?: number;
  /** `three` = the reference cost; `two` = a looser budget. */
  par: Par;
  /** The subset of the API the level hands the learner. */
  api: ArenaApiName[];
};

export type ArenaOp =
  | { op: "c"; i: number; j: number }
  | { op: "s"; i: number; j: number }
  | { op: "g"; i: number }
  | { op: "w"; i: number; v: number };

/** Parse the harness's op tokens: `c{i}:{j}`, `s{i}:{j}`, `g{i}`, `w{i}:{v}`. */
export function parseArenaOps(tokens: string[]): ArenaOp[] {
  const ops: ArenaOp[] = [];
  for (const tok of tokens) {
    const head = tok[0];
    const parts = tok.slice(1).split(":");
    if (head === "c" || head === "s") {
      const i = Number(parts[0]);
      const j = Number(parts[1]);
      if (Number.isInteger(i) && Number.isInteger(j)) ops.push({ op: head, i, j });
    } else if (head === "g") {
      const i = Number(parts[0]);
      if (Number.isInteger(i)) ops.push({ op: "g", i });
    } else if (head === "w") {
      const i = Number(parts[0]);
      const v = Number(parts[1]);
      if (Number.isInteger(i) && Number.isFinite(v)) ops.push({ op: "w", i, v });
    }
  }
  return ops;
}

/** Pull the op trace and the return value out of a program's stdout. */
export function extractArena(stdout: string): { tokens: string[]; returned: number | null } {
  let tokens: string[] = [];
  let returned: number | null = null;
  for (const line of stdout.split("\n")) {
    const oi = line.indexOf(ARENA_MARKER);
    if (oi >= 0) {
      const rest = line.slice(oi + ARENA_MARKER.length).trim();
      tokens = rest ? rest.split(";").map((t) => t.trim()).filter(Boolean) : [];
    }
    const ri = line.indexOf(RETURN_MARKER);
    if (ri >= 0) {
      const rest = line.slice(ri + RETURN_MARKER.length).trim();
      const n = Number(rest);
      if (Number.isFinite(n)) returned = n;
    }
  }
  return { tokens, returned };
}

/** One frame after applying one op — the animation plays these in order. */
export type ArenaFrame = {
  index: number;
  op: ArenaOp;
  /** The array after this operation was applied. */
  array: number[];
  compares: number;
  swaps: number;
};

export type ArenaSimResult = {
  frames: ArenaFrame[];
  final: number[];
  compares: number;
  swaps: number;
  reads: number;
  writes: number;
  cost: number;
  crashed: boolean;
  overrun: boolean;
  reason: string;
};

export function simulateArena(level: ArenaLevel, ops: ArenaOp[]): ArenaSimResult {
  const arr = [...level.input];
  const n = arr.length;
  const frames: ArenaFrame[] = [];
  let compares = 0;
  let swaps = 0;
  let reads = 0;
  let writes = 0;
  let crashed = false;
  let overrun = false;
  let reason = "";

  const inRange = (i: number) => i >= 0 && i < n;

  for (const op of ops) {
    if (frames.length >= ARENA_MAX_OPS) {
      overrun = true;
      break;
    }
    if (op.op === "c") {
      if (!inRange(op.i) || !inRange(op.j)) {
        crashed = true;
        break;
      }
      compares++;
    } else if (op.op === "s") {
      if (!inRange(op.i) || !inRange(op.j)) {
        crashed = true;
        break;
      }
      const t = arr[op.i];
      arr[op.i] = arr[op.j];
      arr[op.j] = t;
      swaps++;
    } else if (op.op === "g") {
      if (!inRange(op.i)) {
        crashed = true;
        break;
      }
      reads++;
    } else {
      if (!inRange(op.i)) {
        crashed = true;
        break;
      }
      arr[op.i] = op.v;
      writes++;
    }
    frames.push({ index: frames.length, op, array: [...arr], compares, swaps });
  }

  const cost = compares + swaps + reads + writes;
  if (overrun) reason = "Too many operations — is something looping forever?";
  else if (crashed) reason = "An operation used an index outside the array.";

  return { frames, final: arr, compares, swaps, reads, writes, cost, crashed, overrun, reason };
}

export type ArenaOutcome = Outcome & {
  crashed: boolean;
  overrun: boolean;
};

function isNonDecreasing(a: number[]): boolean {
  for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false;
  return true;
}

function isNonIncreasing(a: number[]): boolean {
  for (let i = 1; i < a.length; i++) if (a[i - 1] < a[i]) return false;
  return true;
}

function equalArrays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameMultiset(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.every((v, i) => v === y[i]);
}

function rotateArray(a: number[], k: number): number[] {
  const n = a.length;
  if (!n) return [];
  const shift = ((k % n) + n) % n;
  return a.map((_, i) => a[(i + shift) % n]);
}

/** True when every even value precedes every odd one. */
export function isEvenOddPartitioned(a: number[]): boolean {
  let seenOdd = false;
  for (const v of a) {
    if (v % 2 === 0) {
      if (seenOdd) return false;
    } else seenOdd = true;
  }
  return true;
}

function isDutchPartitioned(a: number[], pivot: number): boolean {
  const rank = (v: number) => (v < pivot ? 0 : v === pivot ? 1 : 2);
  for (let i = 1; i < a.length; i++) if (rank(a[i - 1]) > rank(a[i])) return false;
  return true;
}

function arenaGoalMet(level: ArenaLevel, final: number[], returned: number | null): boolean {
  switch (level.goal) {
    case "sort-asc":
      return sameMultiset(final, level.input) && isNonDecreasing(final);
    case "sort-desc":
      return sameMultiset(final, level.input) && isNonIncreasing(final);
    case "reverse":
      return equalArrays(final, [...level.input].reverse());
    case "rotate-left":
      return equalArrays(final, rotateArray(level.input, level.k ?? 1));
    case "partition-even-odd":
      return sameMultiset(final, level.input) && isEvenOddPartitioned(final);
    case "dutch-flag":
      return sameMultiset(final, level.input) && isDutchPartitioned(final, level.pivot ?? 0);
    case "find":
      return sameMultiset(final, level.input) && returned === level.input.indexOf(level.target ?? 0);
  }
}

function arenaGoalReason(level: ArenaLevel): string {
  switch (level.goal) {
    case "sort-asc":
      return "The bars aren't in smallest-to-largest order yet.";
    case "sort-desc":
      return "The bars aren't in largest-to-smallest order yet.";
    case "reverse":
      return "The array isn't reversed yet.";
    case "rotate-left":
      return "The array isn't rotated the way the mission asks yet.";
    case "partition-even-odd":
      return "Not all the even values come before the odd ones.";
    case "dutch-flag":
      return "The values aren't grouped below, equal to, then above the pivot.";
    case "find":
      return "That isn't the index of the target value.";
  }
}

/** Decide an arena run. 1★ for solving it; 2★/3★ for doing it in fewer ops,
 *  with `commands` reporting the operation cost. */
export function judgeArena(level: ArenaLevel, sim: ArenaSimResult, returned: number | null): ArenaOutcome {
  let won = !sim.crashed && !sim.overrun;
  let reason = sim.reason;
  if (won) {
    won = arenaGoalMet(level, sim.final, returned);
    reason = won ? "Solved!" : arenaGoalReason(level);
  }
  let stars = 0;
  if (won) {
    stars = 1;
    if (sim.cost <= level.par.two) stars = 2;
    if (sim.cost <= level.par.three) stars = 3;
  }
  return { won, stars, commands: sim.cost, reason, crashed: sim.crashed, overrun: sim.overrun };
}

// ===========================================================================
// Level union + game
// ===========================================================================

export type Level = BotLevel | PaintLevel | OutputLevel | ArenaLevel;

export type Game = {
  id: string;
  title: string;
  tagline: string;
  /** Longer copy for the hub card. */
  description: string;
  /** Tailwind gradient stops for the card + stage glow. */
  accent: [string, string];
  kind: GameKind;
  levels: Level[];
};

export function isBotLevel(l: Level): l is BotLevel {
  return l.kind === "bot";
}
export function isPaintLevel(l: Level): l is PaintLevel {
  return l.kind === "paint";
}
export function isOutputLevel(l: Level): l is OutputLevel {
  return l.kind === "output";
}
export function isArenaLevel(l: Level): l is ArenaLevel {
  return l.kind === "arena";
}
