/**
 * Verifies the coding-games arcade end-to-end against the real sandbox.
 *
 * For every level it compiles the harness around a known-good reference
 * solution, runs it through the runner, and asserts the win + star rating. A
 * level that stops being solvable, or a harness that stops emitting a parseable
 * result, fails here rather than stumping a student in production.
 *
 * Three things are covered, matching the three level kinds:
 *   - bot   (BOTLAB, Maze Lab) — a trace is replayed and judged.
 *   - paint (Pixel Painter)    — a turtle trace is replayed and judged.
 *   - output (Data Dojo)       — reported values are compared to the expected.
 *
 * Maze Lab is generated: its 60 mazes are verified *in-process* (fast, the same
 * wall-follower the level teaches), plus one maze is run through the sandbox to
 * prove the Python harness agrees.
 *
 *   RUNNER_URL=http://localhost:4100 npx tsx --tsconfig scripts/tsconfig.json scripts/test-games.ts
 */
import "dotenv/config";
import { buildProgram } from "@/lib/games/harness";
import { getGame } from "@/lib/games/catalog";
import { BOTLAB_LEVELS } from "@/lib/games/catalog";
import { MAZE_LEVELS, wallFollowTokens } from "@/lib/games/maze";
import { ARENA_LEVELS } from "@/lib/games/arena";
import {
  extractArena,
  extractOutputResults,
  extractTrace,
  judge,
  judgeArena,
  judgeOutput,
  judgePaint,
  parseArenaOps,
  parseCanvas,
  parseWorld,
  simulate,
  simulateArena,
  simulatePaint,
  type GameLanguage,
  type OutputLevel,
  type Outcome,
} from "@/lib/games/types";
import { runnerRun } from "@/services/runner";

const RUNNER_LANG: Record<GameLanguage, string> = {
  python: "python",
  javascript: "node",
  java: "java",
  cpp: "cpp",
};

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function compileAndRun(language: GameLanguage, gameId: string, levelId: string, code: string) {
  const game = getGame(gameId)!;
  const level = game.levels.find((l) => l.id === levelId)!;
  const program = buildProgram(language, level, code);
  const res = await runnerRun(RUNNER_LANG[language], program, "");
  return { level, res };
}

async function runBot(language: GameLanguage, gameId: string, levelId: string, code: string): Promise<{ outcome: Outcome; stderr: string }> {
  const { level, res } = await compileAndRun(language, gameId, levelId, code);
  if (level.kind !== "bot") throw new Error("not a bot level");
  const sim = simulate(parseWorld(level.world), extractTrace(res.stdout));
  return { outcome: judge(level, sim), stderr: res.stderr };
}

async function runPaint(language: GameLanguage, gameId: string, levelId: string, code: string): Promise<{ outcome: Outcome; stderr: string }> {
  const { level, res } = await compileAndRun(language, gameId, levelId, code);
  if (level.kind !== "paint") throw new Error("not a paint level");
  const sim = simulatePaint(parseCanvas(level.target), extractTrace(res.stdout));
  return { outcome: judgePaint(level, sim), stderr: res.stderr };
}

async function runOutput(language: GameLanguage, gameId: string, levelId: string, code: string): Promise<{ outcome: Outcome; stderr: string }> {
  const { level, res } = await compileAndRun(language, gameId, levelId, code);
  if (level.kind !== "output") throw new Error("not an output level");
  const results = extractOutputResults(res.stdout, level as OutputLevel);
  return { outcome: judgeOutput(level, results), stderr: res.stderr };
}

async function runArena(language: GameLanguage, gameId: string, levelId: string, code: string): Promise<{ outcome: Outcome; stderr: string }> {
  const { level, res } = await compileAndRun(language, gameId, levelId, code);
  if (level.kind !== "arena") throw new Error("not an arena level");
  const { tokens, returned } = extractArena(res.stdout);
  const sim = simulateArena(level, parseArenaOps(tokens));
  return { outcome: judgeArena(level, sim, returned), stderr: res.stderr };
}

/** Reference solutions in Python — the level set's own proof of solvability. */
const PY_BOT: Record<string, string> = {
  "boot-line": `def solve(bot):\n    for _ in range(4):\n        bot.forward()\n`,
  "first-turn": `def solve(bot):\n    bot.forward()\n    bot.turnRight()\n    bot.forward()\n    bot.forward()\n`,
  "u-turn": `def solve(bot):\n    bot.forward()\n    bot.forward()\n    bot.turnRight()\n    bot.forward()\n    bot.forward()\n    bot.turnRight()\n    bot.forward()\n    bot.forward()\n`,
  "long-hall": `def solve(bot):\n    for _ in range(7):\n        bot.forward()\n`,
  harvest: `def solve(bot):\n    for _ in range(3):\n        bot.forward()\n        bot.pick()\n    bot.forward()\n`,
  cautious: `def solve(bot):\n    while not bot.atGoal():\n        bot.forward()\n        if bot.onGem():\n            bot.pick()\n`,
  crossroads: `def solve(bot):\n    while bot.canMove():\n        bot.forward()\n    bot.turnRight()\n    while bot.canMove():\n        bot.forward()\n    bot.turnRight()\n    while bot.canMove():\n        bot.forward()\n`,
  staircase: `def solve(bot):\n    def step():\n        bot.forward()\n        bot.turnRight()\n        bot.forward()\n        bot.turnLeft()\n    step()\n    step()\n    step()\n`,
  spiral: `def solve(bot):\n    while not bot.atGoal():\n        if bot.canMoveLeft():\n            bot.turnLeft()\n            bot.forward()\n        elif bot.canMove():\n            bot.forward()\n        elif bot.canMoveRight():\n            bot.turnRight()\n            bot.forward()\n        else:\n            bot.turnRight()\n            bot.turnRight()\n`,
  keycard: `def solve(bot):\n    for _ in range(6):\n        bot.forward()\n`,
  "locked-core": `def solve(bot):\n    for _ in range(5):\n        bot.forward()\n    bot.pick()\n    bot.forward()\n`,
  "key-gate": `def solve(bot):\n    for _ in range(7):\n        bot.forward()\n`,
  "side-passage": `def solve(bot):\n    bot.forward()\n    bot.forward()\n    bot.forward()\n    bot.turnRight()\n    bot.forward()\n    bot.forward()\n    bot.turnLeft()\n    bot.forward()\n    bot.forward()\n    bot.forward()\n`,
  "warp-gate": `def solve(bot):\n    for _ in range(5):\n        bot.forward()\n    bot.turnLeft()\n    bot.forward()\n`,
  sanitize: `def solve(bot):\n    for _ in range(2):\n        bot.forward()\n`,
  vacuum: `def solve(bot):\n    for _ in range(4):\n        bot.forward()\n`,
  sweep: `def solve(bot):\n    bot.forward()\n    bot.turnRight()\n    bot.forward()\n    bot.turnRight()\n    bot.forward()\n`,
};

const MAZE_SOLUTION = `def solve(bot):
    while not bot.atGoal():
        if bot.canMoveLeft():
            bot.turnLeft()
        elif not bot.canMove():
            if bot.canMoveRight():
                bot.turnRight()
            else:
                bot.turnLeft()
                bot.turnLeft()
        bot.forward()
`;

const PY_PAINT: Record<string, string> = {
  "pixel-line": `def solve(turtle):\n    turtle.forward(3)\n`,
  "pixel-long-run": `def solve(turtle):\n    turtle.forward(5)\n`,
  "pixel-corner": `def solve(turtle):\n    turtle.forward(2)\n    turtle.turnRight()\n    turtle.forward(2)\n`,
  "pixel-ring": `def solve(turtle):\n    turtle.forward(2)\n    turtle.turnRight()\n    turtle.forward(2)\n    turtle.turnRight()\n    turtle.forward(2)\n    turtle.turnRight()\n    turtle.forward(1)\n`,
  "pixel-frame": `def solve(turtle):\n    turtle.forward(1)\n    turtle.turnRight()\n    turtle.forward(1)\n    turtle.forward(2)\n    turtle.turnLeft()\n    turtle.forward(3)\n    turtle.turnLeft()\n    turtle.forward(2)\n    turtle.turnLeft()\n    turtle.forward(3)\n`,
  "pixel-c": `def solve(turtle):\n    turtle.turnRight()\n    turtle.forward(3)\n    turtle.turnLeft()\n    turtle.forward(2)\n    turtle.turnLeft()\n    turtle.forward(3)\n    turtle.turnLeft()\n    turtle.forward(1)\n`,
  "pixel-big-box": `def solve(turtle):\n    turtle.forward(1)\n    turtle.turnRight()\n    turtle.forward(1)\n    turtle.forward(3)\n    turtle.turnLeft()\n    turtle.forward(4)\n    turtle.turnLeft()\n    turtle.forward(3)\n    turtle.turnLeft()\n    turtle.forward(4)\n`,
  "pixel-dashes": `def solve(turtle):\n    turtle.forward(1)\n    turtle.penUp()\n    turtle.forward(1)\n    turtle.penDown()\n    turtle.forward(1)\n    turtle.penUp()\n    turtle.forward(1)\n    turtle.penDown()\n    turtle.forward(1)\n`,
};

const PY_DOJO: Record<string, string> = {
  "dojo-double": `def solve(s):\n    return int(s) * 2\n`,
  "dojo-sumtwo": `def solve(s):\n    a, b = s.split()\n    return int(a) + int(b)\n`,
  "dojo-sumto": `def solve(s):\n    n = int(s)\n    return sum(range(1, n + 1))\n`,
  "dojo-fact": `def solve(s):\n    n = int(s)\n    r = 1\n    for i in range(2, n + 1):\n        r *= i\n    return r\n`,
  "dojo-reverse": `def solve(s):\n    return s[::-1]\n`,
  "dojo-vowels": `def solve(s):\n    return sum(1 for c in s.lower() if c in "aeiou")\n`,
  "dojo-max": `def solve(s):\n    return max(int(x) for x in s.split())\n`,
  "dojo-sumlist": `def solve(s):\n    return sum(int(x) for x in s.split())\n`,
  "dojo-parity": `def solve(s):\n    return "even" if int(s) % 2 == 0 else "odd"\n`,
  "dojo-celsius": `def solve(s):\n    return round(int(s) * 9 / 5 + 32)\n`,
  "dojo-fizz": `def solve(s):\n    n = int(s)\n    if n % 15 == 0:\n        return "FizzBuzz"\n    if n % 3 == 0:\n        return "Fizz"\n    if n % 5 == 0:\n        return "Buzz"\n    return n\n`,
  "dojo-wordcount": `def solve(s):\n    return len(s.split())\n`,
  "dojo-palindrome": `def solve(s):\n    return "yes" if s == s[::-1] else "no"\n`,
  "dojo-gcd": `def solve(s):\n    a, b = (int(x) for x in s.split())\n    while b:\n        a, b = b, a % b\n    return a\n`,
  "dojo-primecount": `def solve(s):\n    n = int(s)\n    c = 0\n    for k in range(2, n + 1):\n        if all(k % d for d in range(2, int(k ** 0.5) + 1)):\n            c += 1\n    return c\n`,
  "dojo-fib": `def solve(s):\n    n = int(s)\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n`,
  "dojo-average": `def solve(s):\n    nums = [int(x) for x in s.split()]\n    return round(sum(nums) / len(nums))\n`,
  "dojo-power": `def solve(s):\n    a, b = (int(x) for x in s.split())\n    return a ** b\n`,
  "dojo-sort": `def solve(s):\n    return " ".join(str(x) for x in sorted(int(v) for v in s.split()))\n`,
  "dojo-indexof": `def solve(s):\n    parts = s.split()\n    target = parts[0]\n    rest = parts[1:]\n    return rest.index(target) if target in rest else -1\n`,
  "dojo-min": `def solve(s):\n    return min(int(x) for x in s.split())\n`,
  "dojo-countchar": `def solve(s):\n    ch, word = s.split("|")\n    return word.count(ch)\n`,
  "dojo-digitsum": `def solve(s):\n    return sum(int(c) for c in s)\n`,
  "dojo-isprime": `def solve(s):\n    n = int(s)\n    if n < 2:\n        return "no"\n    for d in range(2, int(n ** 0.5) + 1):\n        if n % d == 0:\n            return "no"\n    return "yes"\n`,
  "dojo-title": `def solve(s):\n    return " ".join(w[:1].upper() + w[1:].lower() for w in s.split())\n`,
  "dojo-dedupe": `def solve(s):\n    out = []\n    for x in s.split():\n        if x not in out:\n            out.append(x)\n    return " ".join(out)\n`,
  "dojo-longest": `def solve(s):\n    best = ""\n    for w in s.split():\n        if len(w) > len(best):\n            best = w\n    return best\n`,
  "dojo-sumeven": `def solve(s):\n    return sum(int(x) for x in s.split() if int(x) % 2 == 0)\n`,
  "dojo-area": `def solve(s):\n    b, h = (int(x) for x in s.split())\n    return b * h // 2\n`,
  "dojo-shift": `def solve(s):\n    out = ""\n    for c in s:\n        out += "a" if c == "z" else chr(ord(c) + 1)\n    return out\n`,
};

/** Reference solvers for ALGO ARENA — one canonical algorithm per level,
 *  mirroring the TS references that computed each level's par. */
const ARENA_SELECTION = `def solve(box):
    n = box.size()
    for i in range(n - 1):
        m = i
        for j in range(i + 1, n):
            if box.compare(j, m) < 0:
                m = j
        if m != i:
            box.swap(i, m)
`;

const ARENA_SELECTION_DESC = `def solve(box):
    n = box.size()
    for i in range(n - 1):
        m = i
        for j in range(i + 1, n):
            if box.compare(j, m) > 0:
                m = j
        if m != i:
            box.swap(i, m)
`;

const ARENA_BUBBLE = `def solve(box):
    n = box.size()
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            if box.compare(j, j + 1) > 0:
                box.swap(j, j + 1)
                swapped = True
        if not swapped:
            break
`;

const ARENA_INSERTION = `def solve(box):
    n = box.size()
    for i in range(1, n):
        j = i
        while j > 0 and box.compare(j, j - 1) < 0:
            box.swap(j, j - 1)
            j -= 1
`;

const ARENA_QUICK = `def solve(box):
    def rec(lo, hi):
        if lo >= hi:
            return
        p = hi
        i = lo
        for j in range(lo, hi):
            if box.compare(j, p) < 0:
                box.swap(i, j)
                i += 1
        box.swap(i, p)
        rec(lo, i - 1)
        rec(i + 1, hi)
    rec(0, box.size() - 1)
`;

const ARENA_REVERSE = `def solve(box):
    n = box.size()
    for i in range(n // 2):
        box.swap(i, n - 1 - i)
`;

const ARENA_ROTATE = `def solve(box):
    n = box.size()
    src = [box.get(i) for i in range(n)]
    for i in range(n):
        box.set(i, src[(i + 2) % n])
`;

const ARENA_PARTITION = `def solve(box):
    i, j = 0, box.size() - 1
    while i < j:
        while i < j and box.get(i) % 2 == 0:
            i += 1
        while i < j and box.get(j) % 2 != 0:
            j -= 1
        if i < j:
            box.swap(i, j)
            i += 1
            j -= 1
`;

const ARENA_DUTCH = `def solve(box):
    n = box.size()
    low, mid, high = 0, 0, n - 1
    while mid <= high:
        v = box.get(mid)
        if v < 1:
            box.swap(low, mid)
            low += 1
            mid += 1
        elif v == 1:
            mid += 1
        else:
            box.swap(mid, high)
            high -= 1
`;

function arenaBinary(target: number): string {
  return `def solve(box):
    n = box.size()
    lo, hi = 0, n - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        v = box.get(mid)
        if v == ${target}:
            return mid
        if v < ${target}:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`;
}

const PY_ARENA: Record<string, string> = {
  "arena-fix": ARENA_SELECTION,
  "arena-swap3": ARENA_SELECTION,
  "arena-select": ARENA_SELECTION,
  "arena-bubble": ARENA_BUBBLE,
  "arena-insert": ARENA_INSERTION,
  "arena-desc": ARENA_SELECTION_DESC,
  "arena-reverse": ARENA_REVERSE,
  "arena-rotate": ARENA_ROTATE,
  "arena-even": ARENA_PARTITION,
  "arena-dutch": ARENA_DUTCH,
  "arena-find": arenaBinary(9),
  "arena-find-big": arenaBinary(15),
  "arena-quick": ARENA_QUICK,
  "arena-quick2": ARENA_QUICK,
  "arena-insert-big": ARENA_INSERTION,
  "arena-quick-big": ARENA_QUICK,
};

async function main() {
  console.log("# BOTLAB — reference solution per level (Python)");
  for (const level of BOTLAB_LEVELS) {
    const code = PY_BOT[level.id];
    check(`reference exists: ${level.id}`, !!code);
    if (!code) continue;
    const { outcome, stderr } = await runBot("python", "botlab", level.id, code);
    if (outcome.commands === 0 && stderr.trim()) {
      check(`${level.id}: runs clean`, false, stderr.split("\n")[0].slice(0, 120));
      continue;
    }
    check(`${level.id}: won in ${outcome.commands} cmd (${outcome.stars}★)`, outcome.won && outcome.stars >= 1, outcome.reason);
  }

  console.log("# PIXEL PAINTER — reference solution per level (Python)");
  for (const level of Object.keys(PY_PAINT)) {
    const { outcome, stderr } = await runPaint("python", "pixelpainter", level, PY_PAINT[level]);
    if (outcome.commands === 0 && stderr.trim()) {
      check(`${level}: runs clean`, false, stderr.split("\n")[0].slice(0, 120));
      continue;
    }
    check(`${level}: painted in ${outcome.commands} cmd (${outcome.stars}★)`, outcome.won, outcome.reason);
  }

  console.log("# DATA DOJO — reference solution per level (Python)");
  for (const level of Object.keys(PY_DOJO)) {
    const { outcome, stderr } = await runOutput("python", "datadojo", level, PY_DOJO[level]);
    if (stderr.trim() && !outcome.won) {
      check(`${level}: runs clean`, false, stderr.split("\n")[0].slice(0, 120));
      continue;
    }
    check(`${level}: all tests pass (${outcome.stars}★)`, outcome.won, outcome.reason);
  }

  console.log("# ALGO ARENA — reference solution per level (Python)");
  for (const level of ARENA_LEVELS) {
    const code = PY_ARENA[level.id];
    check(`reference exists: ${level.id}`, !!code);
    if (!code) continue;
    const { outcome } = await runArena("python", "algarena", level.id, code);
    check(`${level.id}: solved in ${outcome.commands} ops (${outcome.stars}★)`, outcome.won, outcome.reason);
  }

  console.log("# MAZE LAB — in-process solvability (all generated mazes)");
  for (const level of MAZE_LEVELS) {
    const world = parseWorld(level.world);
    const tokens = wallFollowTokens(world);
    const ok = !!tokens && !!world.goal;
    let reached = false;
    if (ok) {
      const sim = simulate(world, tokens!);
      reached = !sim.crashed && !sim.overrun && sim.x === world.goal!.x && sim.y === world.goal!.y;
    }
    if (!reached) check(`${level.id}: solvable`, false, `par=${level.kind === "bot" ? level.par.three : "?"}`);
  }
  const mazeSolvable = MAZE_LEVELS.every((level) => {
    const world = parseWorld(level.world);
    const tokens = wallFollowTokens(world);
    if (!tokens || !world.goal) return false;
    const sim = simulate(world, tokens);
    return !sim.crashed && !sim.overrun && sim.x === world.goal.x && sim.y === world.goal.y;
  });
  check(`all ${MAZE_LEVELS.length} mazes solvable in-process`, mazeSolvable);
  if (MAZE_LEVELS[0] && MAZE_LEVELS[MAZE_LEVELS.length - 1]) {
    const first = await runBot("python", "mazelab", MAZE_LEVELS[0].id, MAZE_SOLUTION);
    check(`maze sandbox (${MAZE_LEVELS[0].id}): Python wall-follower wins`, first.outcome.won, first.outcome.reason);
    const last = await runBot("python", "mazelab", MAZE_LEVELS[MAZE_LEVELS.length - 1].id, MAZE_SOLUTION);
    check(`maze sandbox (${MAZE_LEVELS[MAZE_LEVELS.length - 1].id}): Python wall-follower wins`, last.outcome.won, last.outcome.reason);
  }

  console.log("# cross-language harnesses");
  {
    const js = `function solve(bot) {\n  for (let i = 0; i < 4; i++) bot.forward();\n}\n`;
    const java = `  static void solve(Bot bot) {\n    for (int i = 0; i < 4; i++) bot.forward();\n  }\n`;
    for (const [lang, code] of [["javascript", js], ["java", java]] as [GameLanguage, string][]) {
      const { outcome } = await runBot(lang, "botlab", "boot-line", code);
      check(`bot/${lang}: wins`, outcome.won, outcome.reason);
    }
  }
  {
    const js = `function solve(turtle) {\n  turtle.forward(3);\n}\n`;
    const java = `  static void solve(Turtle turtle) {\n    turtle.forward(3);\n  }\n`;
    for (const [lang, code] of [["javascript", js], ["java", java]] as [GameLanguage, string][]) {
      const { outcome } = await runPaint(lang, "pixelpainter", "pixel-line", code);
      check(`paint/${lang}: wins`, outcome.won, outcome.reason);
    }
  }
  {
    const js = `function solve(s) {\n  return String(Number(s) * 2);\n}\n`;
    const java = `  static String solve(String s) {\n    return String.valueOf(Integer.parseInt(s) * 2);\n  }\n`;
    for (const [lang, code] of [["javascript", js], ["java", java]] as [GameLanguage, string][]) {
      const { outcome } = await runOutput(lang, "datadojo", "dojo-double", code);
      check(`output/${lang}: wins`, outcome.won, outcome.reason);
    }
  }
  {
    const js = `function solve(box) {\n  if (box.compare(0, 1) > 0) box.swap(0, 1);\n}\n`;
    const java = `  static int solve(Box box) {\n    if (box.compare(0, 1) > 0) box.swap(0, 1);\n    return -1;\n  }\n`;
    for (const [lang, code] of [["javascript", js], ["java", java]] as [GameLanguage, string][]) {
      const { outcome } = await runArena(lang, "algarena", "arena-fix", code);
      check(`arena/${lang}: wins`, outcome.won, outcome.reason);
    }
  }

  console.log("# failure paths");
  {
    const { outcome } = await runBot("python", "botlab", "boot-line", `def solve(bot):\n    for _ in range(9):\n        bot.forward()\n`);
    check("bot: wall crash is a loss", !outcome.won && (outcome as { crashed?: boolean }).crashed === true);
  }
  {
    const { outcome } = await runBot("python", "botlab", "boot-line", `def solve(bot):\n    while True:\n        bot.turnLeft()\n`);
    check("bot: infinite loop is caught (overrun)", !outcome.won && (outcome as { overrun?: boolean }).overrun === true);
  }
  {
    const { outcome } = await runBot("python", "botlab", "harvest", `def solve(bot):\n    for _ in range(4):\n        bot.forward()\n`);
    check("bot: missing cores is a loss", !outcome.won && outcome.reason.length > 0);
  }
  {
    const { outcome } = await runPaint("python", "pixelpainter", "pixel-line", `def solve(turtle):\n    turtle.forward(1)\n`);
    check("paint: short line is a loss", !outcome.won);
  }
  {
    const { outcome } = await runOutput("python", "datadojo", "dojo-double", `def solve(s):\n    return 0\n`);
    check("output: wrong answers lose", !outcome.won && outcome.stars === 0);
  }
  {
    const { outcome } = await runOutput(
      "python",
      "datadojo",
      "dojo-double",
      `def solve(s):\n    return int(s) * 2 if int(s) == 3 else 0\n`
    );
    check("output: partial credit earns some stars", !outcome.won && outcome.stars >= 1);
  }
  {
    const { outcome } = await runArena("python", "algarena", "arena-fix", `def solve(box):\n    pass\n`);
    check("arena: untouched array is a loss", !outcome.won);
  }
  {
    const { outcome } = await runArena("python", "algarena", "arena-select", `def solve(box):\n    box.swap(0, 99)\n`);
    check("arena: out-of-range index is a loss", !outcome.won && (outcome as { crashed?: boolean }).crashed === true);
  }
  {
    const { outcome } = await runArena("python", "algarena", "arena-find", ARENA_SELECTION);
    check("arena: sorting instead of searching is a loss", !outcome.won);
  }

  console.log(`\n${passed}/${passed + failed} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
