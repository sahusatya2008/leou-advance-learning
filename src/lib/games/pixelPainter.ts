import type { PaintLevel } from "./types";

/**
 * PIXEL PAINTER — turtle graphics (the `paint` kind).
 *
 * The student drives a turtle that inks the cells it passes over while its pen
 * is down. Targets are written as the finished picture:
 *   `#` must be painted   `@` must stay blank   `.`/space = don't care
 *   `S` start facing East, or `^ > v <` for an explicit facing (the start cell is
 *   never itself required).
 *
 * The turtle is *stateless*: it only ever emits a token trace, and the server
 * replays that trace to decide which cells were inked. So the picture a student
 * sees is exactly the picture the grader scored — there is no second
 * implementation to drift.
 */

export const PIXEL_LEVELS: PaintLevel[] = [
  {
    kind: "paint",
    id: "pixel-line",
    name: "The Line",
    mission: "Draw a straight line of three cells to the right.",
    concept: "SEQUENCE",
    target: [".....", ".S###", "....."],
    par: { two: 1, three: 1 },
    hints: ["The pen starts down, so moving paints.", "`turtle.forward(3)` paints three cells in one call."],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "paint",
    id: "pixel-long-run",
    name: "Long Run",
    mission: "Paint a five-cell line without five separate calls.",
    concept: "LOOP",
    target: [".......", ".S#####", "......."],
    par: { two: 1, three: 1 },
    hints: ["`forward(n)` moves — and paints — n cells at once.", "`turtle.forward(5)`."],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "paint",
    id: "pixel-corner",
    name: "The Corner",
    mission: "Draw forward, turn, and draw again.",
    concept: "SEQUENCE",
    target: ["....", ".S##", "...#", "...#"],
    par: { two: 3, three: 3 },
    hints: ["`turnRight()` rotates without painting.", "Forward two, right, forward two."],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "paint",
    id: "pixel-ring",
    name: "The Ring",
    mission: "Trace a hollow square, one side at a time.",
    concept: "LOOP",
    target: ["S##", "#.#", "###"],
    par: { two: 7, three: 7 },
    hints: ["Repeat “forward two, turn right” around the ring.", "Watch the last side — it only needs one step."],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "paint",
    id: "pixel-frame",
    name: "The Frame",
    mission: "Drive to the corner, then trace a picture frame.",
    concept: "ALGORITHM",
    target: ["S....", ".####", ".#..#", ".####"],
    par: { two: 10, three: 10 },
    hints: ["First get onto the frame: forward, turn, forward.", "Then go around: forward two, left, forward three, left, forward two, left, forward three."],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "paint",
    id: "pixel-c",
    name: "The C",
    mission: "Draw an open square — three sides, no top.",
    concept: "ALGORITHM",
    target: ["S##", "#.#", "#.#", "###"],
    par: { two: 8, three: 8 },
    hints: ["Turn to face down, then paint the left wall.", "Left turns take you around counter-clockwise."],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "paint",
    id: "pixel-big-box",
    name: "Big Box",
    mission: "Frame a larger rectangle.",
    concept: "ALGORITHM",
    target: ["S.....", ".#####", ".#...#", ".#...#", ".#####"],
    par: { two: 10, three: 10 },
    hints: ["Two cells shorter on the short sides.", "Drive to the corner, then loop left turns around the rectangle: down three, left, four, left, three, left, four."],
    api: ["forward", "turnLeft", "turnRight"],
  },
  {
    kind: "paint",
    id: "pixel-dashes",
    name: "Dashing",
    mission: "Paint three dashes with gaps between them.",
    concept: "STATE",
    target: ["........", ".S#.#.#.", "........"],
    par: { two: 9, three: 9 },
    hints: ["Lift the pen to move without painting.", "`penUp()`, move one, `penDown()`, paint, repeat."],
    api: ["forward", "penUp", "penDown", "turnLeft", "turnRight"],
  },
];
