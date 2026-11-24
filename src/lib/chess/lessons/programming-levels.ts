/**
 * The staged programming curriculum.
 *
 * Every lesson carries `starterCode` (the Python scaffold the student edits),
 * `solutionCode` (a real, tested Python program), a `codeWalkthrough` for the
 * animated popup, and `lineNotes` narrating each ply. The test suite runs
 * `solutionCode` through the real sandbox and proves each lesson is solvable.
 */
import type { TrainingLesson } from "../training";
import { FOUNDATION_LESSONS } from "./programming/py-foundations";
import { BOARD_API_LESSONS } from "./programming/board-api";
import { MOVEMENT_LESSONS } from "./programming/movement";
import { TACTICS_LESSONS } from "./programming/tactics";
import { DEFENCE_LESSONS } from "./programming/defence";
import { ENDGAME_LESSONS } from "./programming/endgame";
import { SEARCH_LESSONS } from "./programming/search";
import { GRANDMASTER_LESSONS } from "./programming/grandmaster";

export const PROGRAMMING_EXTRA_LESSONS: TrainingLesson[] = [
  ...FOUNDATION_LESSONS,
  ...BOARD_API_LESSONS,
  ...MOVEMENT_LESSONS,
  ...TACTICS_LESSONS,
  ...DEFENCE_LESSONS,
  ...ENDGAME_LESSONS,
  ...SEARCH_LESSONS,
  ...GRANDMASTER_LESSONS,
];

/**
 * The original programming lessons predate staging; this assigns each to a
 * stage so the track page can group every lesson consistently.
 */
export const PROGRAMMING_ORIG_STAGE: Record<string, string> = {
  "hello-move": "Python Foundations",
  "read-coordinates": "Python Foundations",
  "count-legal-moves": "The Board API",
  "find-your-pieces": "The Board API",
  "take-the-queen": "Movement & Attacks",
  "knight-takes-queen": "Movement & Attacks",
  "bishop-takes-pawn": "Movement & Attacks",
  "queen-takes-rook": "Movement & Attacks",
  "win-the-rook": "Movement & Attacks",
  "find-any-capture": "Movement & Attacks",
  "bishop-gives-check": "Movement & Attacks",
  "pawn-gives-check": "Movement & Attacks",
  "put-in-check": "Movement & Attacks",
  "scan-for-checks": "Movement & Attacks",
  "fork-the-king": "Tactics in Code",
  "knight-fork-code": "Tactics in Code",
  "discovered-check-code": "Tactics in Code",
  "pick-the-best": "Tactics in Code",
  "choose-best-capture": "Tactics in Code",
  "smothered-code": "Tactics in Code",
  "break-the-check": "Defence in Code",
  "king-takes-back": "Defence in Code",
  "make-a-queen": "Endgames in Code",
  "promote-and-win": "Endgames in Code",
  "capture-to-promote": "Endgames in Code",
  "underpromotion-check": "Endgames in Code",
  "create-stalemate-code": "Endgames in Code",
  "mate-in-one": "Code Grandmaster Trials",
  "corner-mate-code": "Code Grandmaster Trials",
};
