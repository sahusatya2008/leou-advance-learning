import { DIRS, parseWorld, simulate, type BotLevel, type Direction, type ParsedWorld } from "./types";

/**
 * MAZE LAB — procedurally generated escape mazes.
 *
 * These levels are *generated* rather than hand-drawn, which is what lets the
 * arcade offer dozens of navigation puzzles without dozens of hand-drawn worlds.
 * Two properties keep that safe:
 *
 *   1. The generator carves a *perfect* maze (a spanning tree), so there is
 *      exactly one path between any two cells.
 *   2. After generating, the wall-following routine is replayed in-process; if
 *      it cannot reach the exit the maze is discarded and regenerated. So a
 *      level can never be shipped unsolvable.
 *
 * `par` is the wall-follower's own command count — the very solution the level
 * teaches — so a student who writes that routine earns three stars.
 */

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Small deterministic PRNG so "Maze 7" is the same maze on every machine. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Carve a perfect maze of `cols`×`rows` cells into a (2n+1)-wide char grid. */
function carve(seed: number, cols: number, rows: number): string[] {
  const W = cols * 2 + 1;
  const H = rows * 2 + 1;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill("#"));
  const seen: boolean[][] = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const rand = mulberry32(seed);

  const stack: Array<[number, number]> = [[0, 0]];
  seen[0][0] = true;
  g[1][1] = ".";
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options: Array<[number, number, number, number]> = [];
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny][nx]) options.push([nx, ny, dx, dy]);
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = options[Math.floor(rand() * options.length)];
    g[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = ".";
    g[ny * 2 + 1][nx * 2 + 1] = ".";
    seen[ny][nx] = true;
    stack.push([nx, ny]);
  }
  g[1][1] = "S";
  g[H - 2][W - 2] = "G";
  return g.map((r) => r.join(""));
}

const openAt = (world: ParsedWorld, x: number, y: number) =>
  x >= 0 && y >= 0 && x < world.width && y < world.height && !world.walls.has(`${x},${y}`);

/**
 * Left-hand rule as a token trace. This is byte-for-byte the routine the level
 * teaches, so the trace doubles as the reference solution (and its length is
 * the par).
 */
export function wallFollowTokens(world: ParsedWorld): string[] | null {
  if (!world.goal) return null;
  let x = world.start.x;
  let y = world.start.y;
  let dir = world.startDir;
  const tokens: string[] = [];
  for (let guard = 0; guard < 20000; guard++) {
    if (x === world.goal.x && y === world.goal.y) return tokens;
    const left = ((dir + 3) % 4) as Direction;
    const right = ((dir + 1) % 4) as Direction;
    if (openAt(world, x + DIRS[left][0], y + DIRS[left][1])) {
      tokens.push("L");
      dir = left;
    } else if (!openAt(world, x + DIRS[dir][0], y + DIRS[dir][1])) {
      if (openAt(world, x + DIRS[right][0], y + DIRS[right][1])) {
        tokens.push("R");
        dir = right;
      } else {
        tokens.push("L", "L");
        dir = ((dir + 2) % 4) as Direction;
      }
    }
    tokens.push("F");
    x += DIRS[dir][0];
    y += DIRS[dir][1];
  }
  return null;
}

/** Only trust a maze if the taught routine actually reaches the exit. */
function solveMaze(rows: string[]): number | null {
  const world = parseWorld({ rows });
  const tokens = wallFollowTokens(world);
  if (!tokens) return null;
  const sim = simulate(world, tokens);
  if (sim.crashed || sim.overrun || !world.goal) return null;
  if (sim.x !== world.goal.x || sim.y !== world.goal.y) return null;
  return tokens.length;
}

const COLS_SIZES = [3, 4, 5, 6, 7];
const PER_SIZE = 12; // 5 sizes × 12 = 60 mazes

function buildMazeLevels(): BotLevel[] {
  const levels: BotLevel[] = [];
  let made = 0;
  let seed = 1;
  for (let s = 0; s < COLS_SIZES.length; s++) {
    const cols = COLS_SIZES[s];
    const rows = COLS_SIZES[(s + 2) % COLS_SIZES.length];
    let count = 0;
    while (count < PER_SIZE && seed < 8000) {
      const candidate = carve(seed * 2654435761, cols, rows);
      seed++;
      const par = solveMaze(candidate);
      if (par === null) continue;
      count++;
      made++;
      const concept = s < 2 ? "LOOP" : s < 4 ? "SENSOR" : "ALGORITHM";
      levels.push({
        kind: "bot",
        id: `maze-${made}`,
        name: `Maze ${made}`,
        mission: "Escape the maze and reach the portal — no map, just your sensors.",
        concept,
        world: { rows: candidate },
        par: { two: par, three: par },
        hints:
          s < 2
            ? [
                "`bot.canMove()` is true when the tile directly ahead is open floor.",
                "Keep moving while you can: `while not bot.atGoal(): if bot.canMoveLeft(): bot.turnLeft(); bot.forward()`.",
              ]
            : [
                "Keep one hand on the wall: prefer left, then straight, then right, then turn around.",
                "`if bot.canMoveLeft(): turnLeft()` · `elif not bot.canMove(): if bot.canMoveRight(): turnRight() else: turnLeft(); turnLeft()` · then `forward()`.",
              ],
        api: ["forward", "turnLeft", "turnRight", "canMove", "canMoveLeft", "canMoveRight", "atGoal"],
      });
    }
  }
  return levels;
}

export const MAZE_LEVELS: BotLevel[] = buildMazeLevels();
