import type { BotLevel, Game, Level } from "./types";
import { MAZE_LEVELS } from "./maze";
import { DOJO_LEVELS } from "./dataDojo";
import { PIXEL_LEVELS } from "./pixelPainter";
import { ARENA_LEVELS } from "./arena";

/**
 * BOTLAB — the flagship cabinet.
 *
 * The student programs a small bot to escape a series of neon labs. Levels are
 * ordered as a real intro-to-programming arc: move a few times → notice the
 * repetition and loop it → branch on the world with sensors → pick up keys and
 * open doors → teleport → finally sweep whole rooms clean.
 *
 * Worlds are written as ASCII so a level's shape is legible in the source:
 *   `#` wall  `.` floor  `*` core  `G` portal  `k` key  `D` door (needs a key)
 *   `1`/`2` teleporter pair  `S`/`^>v<` start.  Every level is exercised by
 * `scripts/test-games.ts` through the real sandbox, so a level that drifts out
 * of solvability fails the build rather than stumping a student.
 */
export const BOTLAB_LEVELS: BotLevel[] = [
  {
    kind: "bot",
    id: "boot-line",
    name: "Boot Line",
    mission: "Move the bot across the lab floor into the portal.",
    concept: "SEQUENCE",
    world: { rows: ["#######", "#S...G#", "#######"] },
    par: { two: 4, three: 4 },
    hints: [
      "Each `forward()` moves the bot one tile in the direction it is facing.",
      "The bot starts facing the portal. Four `forward()` calls finish it.",
    ],
    api: ["forward"],
  },
  {
    kind: "bot",
    id: "first-turn",
    name: "First Turn",
    mission: "The exit is around the corner — turn, then move.",
    concept: "SEQUENCE",
    world: { rows: ["####", "#S.#", "##.#", "##G#", "####"] },
    par: { two: 4, three: 4 },
    hints: [
      "`turnRight()` rotates the bot in place — it does not move it.",
      "Go forward once, turn right, then forward twice into the portal.",
    ],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "bot",
    id: "u-turn",
    name: "Switchback",
    mission: "Follow the corridor all the way around.",
    concept: "SEQUENCE",
    world: { rows: ["#####", "#S..#", "#.#.#", "#G..#", "#####"] },
    par: { two: 8, three: 8 },
    hints: [
      "Read the corridor like a road — every turn is one `turnRight()`.",
      "Forward, forward, right, forward, forward, right, forward, forward.",
    ],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "bot",
    id: "long-hall",
    name: "The Long Hall",
    mission: "Seven tiles of floor. Do not type seven lines.",
    concept: "LOOP",
    world: { rows: ["##########", "#S......G#", "##########"] },
    par: { two: 7, three: 7 },
    hints: [
      "When you catch yourself writing the same line again, that is a loop.",
      "`for i in range(7):` … or `for (let i = 0; i < 7; i++)`.",
    ],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "bot",
    id: "harvest",
    name: "Harvest",
    mission: "Collect every energy core, then reach the portal.",
    concept: "LOOP",
    world: { rows: ["#######", "#S***G#", "#######"] },
    par: { two: 7, three: 7 },
    hints: [
      "`pick()` collects a core — but only on the tile you are standing on.",
      "Loop three times: move, then pick.",
    ],
    api: ["forward", "pick"],
  },
  {
    kind: "bot",
    id: "cautious",
    name: "Cautious",
    mission: "The cores are not evenly spaced. Only pick where one exists.",
    concept: "CONDITION",
    world: { rows: ["#########", "#S.*..*G#", "#########"] },
    par: { two: 8, three: 8 },
    hints: [
      "`onGem()` is true only when the bot stands on a core.",
      "Advance until `atGoal()`, and pick inside an `if bot.onGem():`.",
    ],
    api: ["forward", "pick", "onGem", "atGoal"],
  },
  {
    kind: "bot",
    id: "crossroads",
    name: "Crossroads",
    mission: "The corridor bends where you cannot see. Feel the walls.",
    concept: "SENSOR",
    world: { rows: ["#######", "#S....#", "#####.#", "#G....#", "#######"] },
    par: { two: 12, three: 12 },
    hints: [
      "`canMove()` tells you whether the next tile is floor or wall.",
      "Walk `while bot.canMove()`, then turn right — and repeat.",
    ],
    api: ["forward", "turnLeft", "turnRight", "canMove", "atGoal"],
  },
  {
    kind: "bot",
    id: "staircase",
    name: "Staircase",
    mission: "The same four-move step, three times. Name the step.",
    concept: "FUNCTION",
    world: { rows: ["######", "#S.###", "##..##", "###..#", "####G#", "######"] },
    par: { two: 12, three: 12 },
    hints: [
      "A function lets you give a repeated idea a name and reuse it.",
      "Define `step` as forward, right, forward, left — then call it three times.",
    ],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "bot",
    id: "spiral",
    name: "The Spiral",
    mission: "No maps. Keep one hand on the wall and let it lead you in.",
    concept: "RECURSION",
    world: {
      rows: [
        "#########",
        "#S......#",
        "#######.#",
        "#.....#.#",
        "#.###.#.#",
        "#.#G..#.#",
        "#.#####.#",
        "#.......#",
        "#########",
      ],
    },
    par: { two: 999, three: 999 },
    hints: [
      "A wall-following routine reaches the centre of any maze like this.",
      "Preferred order: if you can go left, go left; else forward; else right; else turn back.",
    ],
    api: ["forward", "turnLeft", "turnRight", "canMove", "canMoveLeft", "canMoveRight", "atGoal"],
  },
  {
    kind: "bot",
    id: "keycard",
    name: "Keycard",
    mission: "A locked door is ahead. Grab the key on the way.",
    concept: "LOGIC",
    world: { rows: ["#########", "#S.k.D.G#", "#########"] },
    par: { two: 6, three: 6 },
    hints: [
      "Walking over `k` picks up a key automatically; `hasKey()` then reports true.",
      "A `D` door is solid until you are carrying a key — then walk straight through.",
    ],
    api: ["forward", "turnLeft", "turnRight", "hasKey"],
  },
  {
    kind: "bot",
    id: "locked-core",
    name: "Locked Core",
    mission: "The key opens the door, but a core sits right behind it.",
    concept: "LOGIC",
    world: { rows: ["##########", "#S.k.D*G##", "##########"] },
    par: { two: 7, three: 7 },
    hints: [
      "Reaching a core is not enough — you must `pick()` while standing on it.",
      "Forward through the key and door, pick on the core, then forward into the portal.",
    ],
    api: ["forward", "pick", "hasKey"],
  },
  {
    kind: "bot",
    id: "key-gate",
    name: "Key Gate",
    mission: "The portal is sealed. Find the key, then pass.",
    concept: "LOGIC",
    world: { rows: ["##########", "#S..k..DG#", "##########"] },
    par: { two: 7, three: 7 },
    hints: [
      "The door stays shut until the bot is holding a key.",
      "Walk forward over the key, then keep going straight through the door.",
    ],
    api: ["forward", "turnLeft", "turnRight", "hasKey"],
  },
  {
    kind: "bot",
    id: "side-passage",
    name: "Side Passage",
    mission: "The only way down is locked. Detour for the key first, then turn back.",
    concept: "LOGIC",
    world: { rows: ["#########", "#Sk.....#", "####D####", "#......G#", "#########"] },
    par: { two: 10, three: 10 },
    hints: [
      "The key sits just to your right on the top row.",
      "Walk to the gap above the door, turn down, then turn toward the portal.",
    ],
    api: ["forward", "turnLeft", "turnRight", "hasKey"],
  },
  {
    kind: "bot",
    id: "warp-gate",
    name: "Warp Gate",
    mission: "The top row is walled off — use the teleporters.",
    concept: "ALGORITHM",
    world: { rows: ["##########", "#S.1##..G#", "#....1...#", "##########"] },
    par: { two: 7, three: 7 },
    hints: [
      "Stepping onto a `1` instantly warps you to the other `1`.",
      "Forward onto the warp pad, then wind around to the portal on the right.",
    ],
    api: ["forward", "turnLeft", "turnRight", "atGoal"],
  },
  {
    kind: "bot",
    id: "sanitize",
    name: "Sanitize",
    mission: "Sweep every open tile in the room — leave nothing untouched.",
    concept: "ALGORITHM",
    world: { rows: ["#####", "#S..#", "#####"] },
    objective: "paint",
    par: { two: 2, three: 2 },
    hints: [
      "This is a painting run: win by visiting every floor tile, portal or not.",
      "Two `forward()` calls cover the whole room.",
    ],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "bot",
    id: "vacuum",
    name: "Vacuum",
    mission: "Two rows of dust. Drive across them all.",
    concept: "LOOP",
    world: { rows: ["#######", "#S....#", "#######"] },
    objective: "paint",
    par: { two: 4, three: 4 },
    hints: [
      "Count the tiles ahead — the room is five wide.",
      "Loop four times, or call a loop over a `range(4)`.",
    ],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "bot",
    id: "sweep",
    name: "Sweep",
    mission: "A small square room. Cover every tile and come back around.",
    concept: "ALGORITHM",
    world: { rows: ["####", "#S.#", "#..#", "####"] },
    objective: "paint",
    par: { two: 5, three: 5 },
    hints: [
      "The room is two tiles by two tiles.",
      "Forward, right, forward, right, forward.",
    ],
    api: ["forward", "turnLeft", "turnRight"],
  },
];

export const GAMES: Game[] = [
  {
    id: "botlab",
    title: "BOTLAB",
    tagline: "Program a bot out of the neon labs",
    description:
      "Seventeen labs, one robot. Write real Python, JavaScript or Java to steer it — from your first `forward()` to picking up keys, warping through teleporters and vacuuming whole rooms clean.",
    accent: ["#6366f1", "#22d3ee"],
    kind: "bot",
    levels: BOTLAB_LEVELS,
  },
  {
    id: "mazelab",
    title: "Maze Lab",
    tagline: "Escape the generated mazes",
    description:
      "Sixty procedurally-built mazes, no two the same. There is no map and no coordinates — only sensors and a loop. Learn the wall-following trick and every maze falls.",
    accent: ["#8b5cf6", "#f472b6"],
    kind: "bot",
    levels: MAZE_LEVELS,
  },
  {
    id: "datadojo",
    title: "Data Dojo",
    tagline: "Level up your problem solving",
    description:
      "Thirty bite-sized challenges with no world at all: just a value to compute. Numbers, strings, lists, recursion, searching and sorting — each with tests that check your answer in Python, JavaScript or Java.",
    accent: ["#06b6d4", "#34d399"],
    kind: "output",
    levels: DOJO_LEVELS,
  },
  {
    id: "pixelpainter",
    title: "Pixel Painter",
    tagline: "Draw with code",
    description:
      "A turtle, a pen and a blank canvas. Move, turn and lift the pen to paint your target picture — and see it drawn stroke by stroke.",
    accent: ["#f59e0b", "#ef4444"],
    kind: "paint",
    levels: PIXEL_LEVELS,
  },
  {
    id: "algarena",
    title: "Algo Arena",
    tagline: "Sort, search and out-think the machine",
    description:
      "A hidden array and a counted toolkit. Rearrange the bars with compare, swap, get and set — then do it in as few operations as possible. Bubble sort finishes the level; only quicksort wins the stars.",
    accent: ["#22d3ee", "#a855f7"],
    kind: "arena",
    levels: ARENA_LEVELS,
  },
];

export function getGame(gameId: string): Game | undefined {
  return GAMES.find((g) => g.id === gameId);
}

export function getLevel(gameId: string, levelId: string): { game: Game; level: Level; index: number } | undefined {
  const game = getGame(gameId);
  if (!game) return undefined;
  const index = game.levels.findIndex((l) => l.id === levelId);
  if (index < 0) return undefined;
  return { game, level: game.levels[index], index };
}
