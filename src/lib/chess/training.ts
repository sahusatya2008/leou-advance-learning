/**
 * Leou Chess — Training.
 *
 * A training track is a curriculum of short, self-contained lessons. There are
 * two of them:
 *
 *   - `physical`     — the student moves real pieces on the board (click a
 *                      piece, click a square). The lesson sets a goal the
 *                      student must reach: capture a piece, escape check,
 *                      deliver mate, promote a pawn, or trap the king.
 *   - `programming`  — the student writes the same `move(game)` function they
 *                      write in a real game, but the lesson only asks for the
 *                      one move that satisfies the goal. It runs in the same
 *                      sandbox as a live match.
 *
 * Both tracks share one judge. A lesson is a FEN (always the student to move),
 * an optional scripted opponent reply list, and a declarative goal. The judge
 * replays the submitted move line with the real engine and reports whether the
 * goal was met — the same code runs on the client (to give instant feedback)
 * and on the server (to award stars, which a client must never forge).
 */
import {
  BISHOP,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  START_FEN,
  WHITE,
  parseFen,
  parseSquare,
} from "./engine";
import { ChessGame } from "./game";
import { chooseMoveDeterministic } from "./ai";
import { PHYSICAL_EXTRA_LESSONS } from "./lessons/physical-levels";
import { PROGRAMMING_EXTRA_LESSONS, PROGRAMMING_ORIG_STAGE } from "./lessons/programming-levels";
import type { GameLanguage } from "@/lib/games/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrainingTrack = "physical" | "programming";

/** What the student must achieve to solve the lesson. */
export type TrainingGoal =
  /** Move a piece at all — the "hello world" of the board. */
  | { type: "any" }
  /** Capture an opponent piece (optionally of a specific type, `"q"` etc.). */
  | { type: "capture"; piece?: string }
  /** Get the playing side out of check. */
  | { type: "escape" }
  /** Give check to the opponent. */
  | { type: "check" }
  /** Deliver checkmate. */
  | { type: "mate" }
  /** Trap the opponent so they have no legal move and are not in check. */
  | { type: "stalemate" }
  /** Promote a pawn. */
  | { type: "promote" }
  /** Finish the line with at least `minGain` pawns of extra material. */
  | { type: "material"; minGain: number };

export type TrainingLesson = {
  id: string;
  track: TrainingTrack;
  /** Progression stage within the track (physical track levels are staged). */
  stage?: string;
  name: string;
  /** The idea the lesson teaches, e.g. "Knight" or "Back-rank mate". */
  concept: string;
  /** One sentence telling the student what to do. */
  mission: string;
  /** Position to solve. The side to move is always the student. */
  fen: string;
  goal: TrainingGoal;
  /** Opponent replies applied after the student's 1st, 2nd, … move. */
  replies?: string[];
  /** Fewest student moves that solve it — used to grade stars. */
  par: number;
  /** Student moves allowed before the lesson is lost. */
  maxPlayerMoves: number;
  hints: string[];
  /**
   * A canonical winning line (student moves, UCI). Used by the test suite to
   * prove every lesson is solvable; can also back a "show me" button.
   */
  solution: string[];
  /** Detailed explanation of the concept being taught. */
  explanation?: string;
  /** Learning objectives for this lesson. */
  learningObjectives?: string[];
  /** Step-by-step explanation of how to solve it. */
  steps?: string[];
  /** What the code does — explained for beginners. */
  codeExplanation?: string;
  /** Further exploration ideas to expand knowledge. */
  expandKnowledge?: string[];
  /** Difficulty level: beginner, intermediate, advanced. */
  difficulty?: "beginner" | "intermediate" | "advanced";
  /**
   * Auto-drawn arrows and square highlights that illustrate the lesson's idea
   * on the board before the student tries — a coach's marker, not freehand
   * doodling. Purely visual; never affects legality or grading.
   */
  visualHint?: BoardAnnotation;
  /**
   * Optional guided lesson: the student works through numbered micro-steps in
   * the editor (each checked for a required API call and/or printed output),
   * and only after every step passes do they finish the real `move(game)` and
   * press "Run my program". Purely a teaching scaffold — the final grade still
   * comes from the same judge as always.
   */
  guidedSteps?: GuidedStep[];
  /**
   * Programming lessons: per-language starter code shown in the editor. When
   * absent the generic harness starter is used. Python starters normally contain
   * a TODO scaffold the student fills in.
   */
  starterCode?: Partial<Record<GameLanguage, string>>;
  /**
   * Programming lessons: the canonical solution program in Python. Drives the
   * animated code walkthrough, the "show solution" button, and the runner-based
   * test suite that proves every programming lesson is solvable by real code.
   */
  solutionCode?: string;
  /**
   * Programming lessons: the animated walkthrough shown in the lesson popup —
   * each step highlights a fragment of the real solution program and narrates
   * what it does; steps with a `playMove` also play that move on the demo board.
   */
  codeWalkthrough?: CodeWalkStep[];
  /**
   * One narration sentence per student ply, used while animating a run: notes[0]
   * describes solution[0], and so on. Replies get a generic caption.
   */
  lineNotes?: string[];
};

/** One step of a programming lesson's animated code walkthrough. */
export type CodeWalkStep = {
  /** The code fragment shown at this step (appended to a growing listing). */
  code: string;
  /** What this code does, in plain language. */
  caption: string;
  /** Optional UCI move played on the demo board when this step is shown. */
  playMove?: string;
};

export type AnnotationTone = "primary" | "accent" | "success" | "danger" | "warning";

export type BoardAnnotation = {
  /** Short caption shown under the board while the hint is visible. */
  caption?: string;
  /** Arrows from one square to another (e.g. a knight's L-path). */
  arrows?: Array<{ from: string; to: string; tone?: AnnotationTone }>;
  /** Squares to tint (e.g. squares a piece attacks). */
  highlights?: Array<{ sq: string; tone?: AnnotationTone }>;
};

export type GuidedStep = {
  /** Short step title, e.g. "Find the bishop". */
  title: string;
  /** What to do in this step, in plain language. */
  instructions: string;
  /** Substrings the student's code must contain to pass this step. */
  codeMustInclude?: string[];
  /** Substrings the program's stdout must contain to pass this step. */
  expectedOutputIncludes?: string[];
};

// ---------------------------------------------------------------------------
// Track metadata
// ---------------------------------------------------------------------------

export type TrainingTrackMeta = {
  id: TrainingTrack;
  title: string;
  tagline: string;
  description: string;
  accent: [string, string];
};

export const TRAINING_TRACKS: Record<TrainingTrack, TrainingTrackMeta> = {
  physical: {
    id: "physical",
    title: "Board Training",
    tagline: "Learn the pieces by hand",
    description:
      "Move real pieces on the board. Learn how a knight, bishop, rook and queen travel, how to answer a check, how to promote a pawn, and how to finish with checkmate and stalemate — one small puzzle at a time.",
    accent: ["#22d3ee", "#6366f1"],
  },
  programming: {
    id: "programming",
    title: "Programming Training",
    tagline: "Teach your program to see",
    description:
      "The same ideas, but now your code decides. Write a move(game) function that returns the one move which wins the queen, breaks the check, promotes a pawn or mates the king — run on the real chess sandbox.",
    accent: ["#6366f1", "#a855f7"],
  },
};

export const TRAINING_TRACK_IDS: TrainingTrack[] = ["physical", "programming"];

export function isTrainingTrack(value: string): value is TrainingTrack {
  return (TRAINING_TRACK_IDS as string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Physical curriculum — move the pieces yourself
// ---------------------------------------------------------------------------

const PHYSICAL_LESSONS: TrainingLesson[] = [
  {
    id: "knight-jump",
    track: "physical",
    stage: "Foundations",
    name: "Knight Jump",
    concept: "Knight",
    mission: "Take the rook with your knight.",
    fen: "7k/8/8/8/8/5r2/8/6NK w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 1,
    maxPlayerMoves: 2,
    hints: [
      "A knight moves in an L: two squares one way, then one square across.",
      "Your knight on g1 can reach g1-f3 — and the rook is sitting there.",
    ],
    visualHint: {
      caption: "The knight's L-path: two up, one across — landing right on the rook.",
      arrows: [{ from: "g1", to: "f3", tone: "accent" }],
      highlights: [{ sq: "f3", tone: "danger" }],
    },
    solution: ["g1f3"],
    explanation: "The knight is the only piece that jumps: two squares one way, one across. It landed on f3 and took the rook without anything blocking its path.",
    learningObjectives: ["Move a knight in its L-shape", "Capture with a jumping piece"],
    difficulty: "beginner",
    expandKnowledge: ["Knights are strongest in the centre, where all eight jumps are available."],
  },
  {
    id: "bishop-glide",
    track: "physical",
    stage: "Foundations",
    name: "Bishop Glide",
    concept: "Bishop",
    mission: "Take the rook with your bishop.",
    fen: "7k/8/8/8/8/r7/8/2B2K2 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 1,
    maxPlayerMoves: 2,
    hints: [
      "A bishop slides any distance along its colour of diagonal.",
      "Your c1 bishop can travel c1-b2-a3, and the rook waits on a3.",
    ],
    solution: ["c1a3"],
    explanation: "Bishops glide any distance along a diagonal of their own colour. This one stayed on its light squares the whole way to a3.",
    learningObjectives: ["Slide a bishop along a diagonal", "Capture at long range"],
    difficulty: "beginner",
    expandKnowledge: ["Each bishop only ever sees one colour complex — that is why a pair is stronger than one."],
  },
  {
    id: "rook-rank",
    track: "physical",
    stage: "Foundations",
    name: "Rook Along the Rank",
    concept: "Rook",
    mission: "Take the rook with your rook.",
    fen: "7k/8/8/8/8/8/7K/R3r3 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 1,
    maxPlayerMoves: 2,
    hints: [
      "A rook slides any distance along a file or a rank.",
      "The two rooks share the first rank — slide right and take it.",
    ],
    solution: ["a1e1"],
    explanation: "Rooks travel along ranks and files, any distance. Here the rook simply slid right along the first rank and took its counterpart.",
    learningObjectives: ["Slide a rook along a rank or file", "Use a rook's long reach"],
    difficulty: "beginner",
    expandKnowledge: ["Open files are where rooks do their best work."],
  },
  {
    id: "queen-sweep",
    track: "physical",
    stage: "Foundations",
    name: "Queen Sweep",
    concept: "Queen",
    mission: "Take the black queen.",
    fen: "3q3k/8/8/8/8/8/8/3Q3K w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 2,
    hints: [
      "A queen moves like a rook and a bishop together.",
      "Both queens stand on the d-file — slide straight up and take.",
    ],
    solution: ["d1d8"],
    explanation: "The queen combines rook and bishop movement, so she can sweep the whole d-file in one move and take the enemy queen.",
    learningObjectives: ["Move the queen like a rook and bishop", "Trade or capture the enemy queen"],
    difficulty: "beginner",
    expandKnowledge: ["The queen is the most powerful piece — but an undefended one can still be taken."],
  },
  {
    id: "pawn-push",
    track: "physical",
    stage: "Foundations",
    name: "Pawn to the End",
    concept: "Pawn",
    mission: "Walk the pawn all the way and turn it into a queen.",
    fen: "7k/8/8/P7/8/8/8/6K1 w - - 0 1",
    goal: { type: "promote" },
    replies: ["h8g8", "g8h8"],
    par: 3,
    maxPlayerMoves: 3,
    hints: [
      "A pawn moves straight forward one square at a time.",
      "Three pushes — a5, a6, a7 — then the last step promotes it.",
    ],
    solution: ["a5a6", "a6a7", "a7a8q"],
    explanation: "Pawns march forward one square at a time and capture diagonally. Reaching the last rank forces a promotion — a queen is almost always the right choice.",
    learningObjectives: ["Push a pawn up the board", "Promote on the final rank"],
    difficulty: "beginner",
    expandKnowledge: ["A pawn's first step may be two squares — that is what opens almost every game."],
  },
  {
    id: "back-rank-mate",
    track: "physical",
    stage: "Checkmate",
    name: "Back-rank Mate",
    concept: "Checkmate",
    mission: "Checkmate the black king in one move.",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "The black king is boxed in by its own three pawns.",
      "A rook on the eighth rank checks along the whole row — and there is no escape.",
    ],
    solution: ["a1a8"],
    explanation: "The classic back-rank mate: the king's own pawns take away every flight square, and the rook delivers check along the eighth rank.",
    learningObjectives: ["Recognise the back-rank pattern", "Deliver mate with a rook"],
    difficulty: "beginner",
    expandKnowledge: ["One pawn move ('luft') gives the king air and prevents this forever."],
  },
  {
    id: "queen-mate",
    track: "physical",
    stage: "Checkmate",
    name: "Closing In",
    concept: "Checkmate",
    mission: "Checkmate the black king in one move.",
    fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Your king already guards the squares next to the enemy king.",
      "Bring the queen to g7 — the king protects her, and every square is covered.",
    ],
    solution: ["f7g7"],
    explanation: "The queen checks from g7, right in front of the king, and the white king protects her — nothing can capture and no square is free. The simplest king-and-queen mate.",
    learningObjectives: ["Checkmate with queen and king", "Use your king to defend the mating queen"],
    difficulty: "beginner",
    expandKnowledge: ["Keep the queen one square away from the enemy king and always protected."],
  },
  {
    id: "corner-mate",
    track: "physical",
    stage: "Checkmate",
    name: "Corner Trap",
    concept: "Checkmate",
    mission: "Checkmate the black king in the corner.",
    fen: "k7/8/1K6/8/8/8/8/7Q w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Your king on b6 covers a7 and b7 — the only two squares beside a8.",
      "Swing the queen to the eighth rank for a check with nowhere to run.",
    ],
    solution: ["h1h8"],
    explanation: "The queen sweeps to the back rank. The white king covers a7 and b7, the board edge covers the rest — mate in the corner.",
    learningObjectives: ["Mate a cornered king with a queen", "Use your king as a mating helper"],
    difficulty: "beginner",
    expandKnowledge: ["Edge and corner squares act as extra attackers in every mating pattern."],
  },
  {
    id: "knight-strike",
    track: "physical",
    stage: "Tactics",
    name: "Knight Strike",
    concept: "Tactics",
    mission: "Win the queen with your knight.",
    fen: "4k3/8/8/3q4/8/2N5/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 2,
    hints: [
      "Find the square your knight can jump to that holds the queen.",
      "From c3 the knight reaches d5 — right onto the black queen.",
    ],
    solution: ["c3d5"],
    explanation: "A knight fork in miniature: the jump to d5 lands on the queen while staying safe. Knights love to attack pieces that cannot touch them back.",
    learningObjectives: ["Find a knight's attacking jumps", "Win material with a knight"],
    difficulty: "beginner",
    expandKnowledge: ["Knights on the sixth rank are notorious for forking king, queen and rooks."],
  },
  {
    id: "capture-checker",
    track: "physical",
    stage: "Defence",
    name: "Take the Checker",
    concept: "Defence",
    mission: "Your king is in check — capture the piece giving it.",
    fen: "7k/8/8/8/8/8/6q1/6K1 w - - 0 1",
    goal: { type: "escape" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Sometimes the best answer to a check is to take the attacker.",
      "The queen on g2 is right next to your king — and nothing defends her.",
    ],
    solution: ["g1g2"],
    explanation: "There are three ways out of a check: move the king, block the line, or take the attacker. Here the attacker is simply captured.",
    learningObjectives: ["Respond to a check by capturing", "Know the three ways to escape check"],
    difficulty: "beginner",
    expandKnowledge: ["Capturing the checker is only legal when the capturer is not pinned elsewhere."],
  },
  {
    id: "escape-check",
    track: "physical",
    stage: "Defence",
    name: "Step Aside",
    concept: "Defence",
    mission: "Your king is in check — move him somewhere safe.",
    fen: "7k/8/8/8/8/8/6r1/6K1 w - - 0 1",
    goal: { type: "escape" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "The rook checks along the g-file — step off it.",
      "Kings may not step onto an attacked square, so check before you move.",
    ],
    solution: ["g1h1"],
    explanation: "The rook controls the whole g-file, so the king simply steps sideways off it. Moving the king is always an option when no capture or block exists.",
    learningObjectives: ["Escape a check with king movement", "Respect open files held by enemy rooks"],
    difficulty: "beginner",
    expandKnowledge: ["A king that keeps stepping off attacked files rarely gets mated in open positions."],
  },
  {
    id: "stalemate-trap",
    track: "physical",
    stage: "Endgames",
    name: "No Way Out",
    concept: "Stalemate",
    mission: "Trap the black king with no legal move — but do not check it.",
    fen: "k7/8/1K3N2/8/8/8/8/8 w - - 0 1",
    goal: { type: "stalemate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Stalemate is a draw: the king is safe from check but has no move at all.",
      "Your king covers a7 and b7 — the knight must take the last square, b8.",
    ],
    solution: ["f6d7"],
    explanation: "Nd7 takes away the last flight square without giving check. Black has no legal move and is not in check — stalemate, and a half point snatched from a lost game.",
    learningObjectives: ["Recognise stalemate", "Take away the final escape square without checking"],
    difficulty: "intermediate",
    expandKnowledge: ["Stalemate is a defender's best friend — always count the enemy king's squares before moving."],
  },
  {
    id: "promote-run",
    track: "physical",
    stage: "Foundations",
    name: "Promotion Run",
    concept: "Pawn",
    mission: "Promote your pawn to a queen.",
    fen: "k7/6P1/8/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "promote" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A pawn that reaches the last rank must become another piece.",
      "One push — g7 to g8 — and it becomes a queen.",
    ],
    solution: ["g7g8q"],
    explanation: "One step from glory: the pawn reaches g8 and is replaced by a queen — the most common promotion by far.",
    learningObjectives: ["Promote a pawn on the last rank", "Choose the queen when promoting"],
    difficulty: "beginner",
    expandKnowledge: ["Underpromoting to a knight or rook is occasionally right — watch for checks and stalemates."],
  },
  {
    id: "smothered-mate",
    track: "physical",
    stage: "Checkmate",
    name: "Smothered Mate",
    concept: "Tactics",
    mission: "Checkmate the black king — his own pieces get in the way.",
    fen: "6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A knight checks a king it does not stand next to — count the L.",
      "Which square does the knight on e5 reach that touches h8 and cannot be captured?",
    ],
    solution: ["e5f7"],
    explanation: "The knight checks from f7 — a square the king cannot capture from and no piece can reach. Surrounded by his own rook and pawns, the king is smothered.",
    learningObjectives: ["Deliver a smothered mate with a knight", "Use enemy pieces as walls"],
    difficulty: "intermediate",
    expandKnowledge: ["Philidor's Legacy adds a queen sacrifice to force this exact net."],
  },
  // The 86 staged levels: Foundations → Defence → Tactics → Checkmate →
  // Endgames → Grandmaster Trials (see lessons/physical-levels.ts). Array
  // order controls display order within a stage, so the original 14 always
  // lead their stage group.
  ...PHYSICAL_EXTRA_LESSONS,
];

// ---------------------------------------------------------------------------
// Programming curriculum — the same ideas, solved in code
// ---------------------------------------------------------------------------

// A tiny library of starter snippets shared by the original programming lessons.
// Each is a complete, legal, style-correct `move(game)` so the lesson opens with
// something that runs, and doubles as `solutionCode` for the runner E2E test.
const CODE_ANY = `def move(game):
    return game.legal_moves()[0]
`;

const CODE_CAPTURE_PIECE = (piece: string) => `def move(game):
    for m in game.legal_moves():
        target = game.piece_at(m[2:4])
        if target and target.islower() and target.lower() == ${JSON.stringify(piece)}:
            return m
    return game.legal_moves()[0]
`;

const CODE_CAPTURE_ANY = `def move(game):
    for m in game.legal_moves():
        target = game.piece_at(m[2:4])
        if target and target.islower():
            return m
    return game.legal_moves()[0]
`;

const CODE_FROM = (square: string) => `def move(game):
    return game.moves_from(${JSON.stringify(square)})[0]
`;

const CODE_ESCAPE = `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and not after.in_check():
            return m
    return game.legal_moves()[0]
`;

const CODE_CHECK = `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
    return game.legal_moves()[0]
`;

const CODE_MATE = `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
    return game.legal_moves()[0]
`;

const CODE_STALEMATE = `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "stalemate":
            return m
    return game.legal_moves()[0]
`;

const CODE_PROMOTE = `def move(game):
    for m in game.legal_moves():
        if len(m) == 5:
            return m
    return game.legal_moves()[0]
`;

const PROGRAMMING_LESSONS: TrainingLesson[] = [
  {
    id: "hello-move",
    track: "programming",
    name: "Hello, Move",
    concept: "The harness",
    mission: "Return any legal move — the very first thing your program does.",
    fen: START_FEN,
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "game.legal_moves() hands you every move you may play this turn.",
      "Return one of them as text, for example \"e2e4\".",
    ],
    solution: ["e2e4"],
    explanation: "Your program receives the game object and returns a move as text — that is the whole contract. Any legal move completes the lesson.",
    learningObjectives: ["Return a legal move from move(game)", "See the training harness run your code"],
    difficulty: "beginner",
    expandKnowledge: ["Every programming lesson uses this same harness — only the strategy changes."],
    starterCode: { python: CODE_ANY },
    solutionCode: CODE_ANY,
  },
  {
    id: "read-coordinates",
    track: "programming",
    name: "Read the Coordinates",
    concept: "Fundamentals",
    difficulty: "beginner",
    mission: "Learn to read squares and coordinates on the chessboard.",
    explanation:
      "Chess uses algebraic notation with files a-h (left to right) and ranks 1-8 (bottom to top for White). Understanding coordinates is essential for programming chess moves.",
    learningObjectives: [
      "Understand files a-h and ranks 1-8",
      "Read squares like e2, e4, h8",
      "Access board information programmatically",
    ],
    steps: [
      "Use game.fen() to see the full position",
      "Use game.piece_at(square) to see what's on a square",
      "Use game.pieces() to see all occupied squares",
    ],
    codeExplanation:
      "Your code reads the board state through the game object. Each square is named by file+rank (e.g. 'e2'). piece_at() returns the piece letter or an empty string.",
    expandKnowledge: [
      "FEN (Forsyth-Edwards Notation) encodes the entire position",
      "You can inspect any square programmatically",
    ],
    fen: START_FEN,
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Try: print(game.fen()) to see the position",
      "game.piece_at('e2') tells you what's on e2",
      "Just return any legal move to complete this lesson",
    ],
    solution: ["e2e4"],
    starterCode: { python: CODE_ANY },
    solutionCode: CODE_ANY,
  },
  {
    id: "count-legal-moves",
    track: "programming",
    name: "Count Your Options",
    concept: "Legal Moves",
    difficulty: "beginner",
    mission: "Return any legal move — learn how many moves White has from start.",
    explanation: "At the starting position, White has 20 legal moves total. Your program can see all of them.",
    learningObjectives: [
      "Understand the full set of legal moves",
      "Use game.legal_moves() effectively",
      "Select moves programmatically",
    ],
    steps: [
      "Get all legal moves with game.legal_moves()",
      "Count them to understand your options",
      "Pick and return one move",
    ],
    codeExplanation:
      "game.legal_moves() returns a list of all legal UCI moves from the current position. This is your complete set of valid choices.",
    expandKnowledge: [
      "As positions develop, the number of legal moves changes",
      "Chess programs analyze all legal moves to find the best one",
    ],
    fen: START_FEN,
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "len(game.legal_moves()) gives you the count",
      "Any legal move solves this — try 'e2e4' or 'd2d4'",
    ],
    solution: ["e2e4"],
    starterCode: { python: CODE_ANY },
    solutionCode: CODE_ANY,
  },
  {
    id: "find-your-pieces",
    track: "programming",
    name: "Find Your Pieces",
    concept: "Board State",
    difficulty: "beginner",
    mission: "Return a legal move by your knight from g1.",
    explanation:
      "Before choosing a move, you need to know where your pieces are. The game object gives you tools to explore the board.",
    learningObjectives: [
      "Find specific pieces on the board",
      "Filter legal moves starting from a square",
      "Use game.moves_from(square)",
    ],
    steps: [
      "Look at the starting position",
      "Find your knight on g1",
      "Get all legal moves from g1",
      "Return one of them",
    ],
    codeExplanation:
      "game.moves_from('g1') returns all legal moves starting from g1. For the starting position, the knight on g1 can go to f3 or h3.",
    expandKnowledge: [
      "You can build move selection logic by examining positions",
      "Filtering by source square is a powerful technique",
    ],
    fen: START_FEN,
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "game.moves_from('g1') returns ['g1f3', 'g1h3']",
      "Return either of those moves",
    ],
    solution: ["g1f3"],
    starterCode: { python: CODE_FROM("g1") },
    solutionCode: CODE_FROM("g1"),
  },
  {
    id: "take-the-queen",
    track: "programming",
    name: "Take the Queen",
    concept: "Capturing",
    mission: "Return the move that captures the black queen.",
    fen: "4k3/8/8/3q4/8/8/8/3R2K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A legal move that lands on an enemy piece is a capture.",
      "Your rook and the queen share the d-file — slide up to d5.",
    ],
    solution: ["d1d5"],
    starterCode: { python: CODE_CAPTURE_PIECE("q") },
    solutionCode: CODE_CAPTURE_PIECE("q"),
    explanation: "Any legal move landing on an enemy piece captures it. Your program scans legal_moves() for the move whose destination square holds the queen.",
    learningObjectives: ["Generate and filter legal moves", "Capture by returning the right UCI string"],
    difficulty: "beginner",
    expandKnowledge: ["In code, capturing is just a lookup: does piece_at(destination) belong to the enemy?"],
  },
  {
    id: "break-the-check",
    track: "programming",
    name: "Break the Check",
    concept: "Defence",
    mission: "Your program is in check — return a move that gets the king safe.",
    fen: "7k/8/8/8/8/8/6r1/6K1 w - - 0 1",
    goal: { type: "escape" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "game.in_check() tells you whether you are under attack.",
      "legal_moves() already excludes moves that leave your king in check.",
    ],
    solution: ["g1h1"],
    starterCode: { python: CODE_ESCAPE },
    solutionCode: CODE_ESCAPE,
    explanation: "legal_moves() never returns moves that leave your king in check, so any move it offers escapes the rook's file. The king simply steps aside.",
    learningObjectives: ["Detect check with game.in_check()", "Trust legal_moves() to exclude illegal escapes"],
    difficulty: "beginner",
    expandKnowledge: ["Encoding the check rules yourself is a great next exercise — the harness already proves your answer correct."],
  },
  {
    id: "put-in-check",
    track: "programming",
    name: "Put in Check",
    concept: "Attacking",
    mission: "Return a move that gives check to the black king.",
    fen: "7k/8/8/8/8/8/R7/5K2 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A move gives check when the enemy king comes under attack.",
      "Place your rook on the eighth rank and it stares straight at the king.",
    ],
    visualHint: {
      caption: "The rook slides up the a-file, then stares across the 8th rank at the king.",
      arrows: [
        { from: "a2", to: "a8", tone: "primary" },
        { from: "a8", to: "h8", tone: "danger" },
      ],
      highlights: [{ sq: "h8", tone: "danger" }],
    },
    solution: ["a2a8"],
    starterCode: { python: CODE_CHECK },
    solutionCode: CODE_CHECK,
    explanation: "Sliding the rook to a8 attacks the king along the eighth rank — check. Your program finds it by testing which moves attack the enemy king's square.",
    learningObjectives: ["Compute attacks on a square", "Give check programmatically"],
    difficulty: "beginner",
    expandKnowledge: ["Attack detection is the first real chess engine primitive — everything else builds on it."],
  },
  {
    id: "mate-in-one",
    track: "programming",
    name: "Mate in One",
    concept: "Checkmate",
    mission: "Return the move that checkmates the black king.",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Checkmate is check with no legal answer: no capture, no block, no escape.",
      "The black king is fenced in by its pawns — attack along the back rank.",
    ],
    solution: ["a1a8"],
    starterCode: { python: CODE_MATE },
    solutionCode: CODE_MATE,
    explanation: "Re8... here Ra1-a8 is checkmate: the king's own pawns take every flight square and the rook covers the whole back rank. Mate is check with zero legal replies.",
    learningObjectives: ["Identify a mate-in-one position in code", "Return the mating move"],
    difficulty: "intermediate",
    expandKnowledge: ["A real engine verifies mate by generating all enemy replies and finding the set empty."],
  },
  {
    id: "make-a-queen",
    track: "programming",
    name: "Make a Queen",
    concept: "Promotion",
    mission: "Return the move that promotes your pawn.",
    fen: "7k/6P1/8/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "promote" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A promotion move carries a fifth letter: the piece you choose.",
      "g7g8q means \"pawn to g8, promote to a queen\".",
    ],
    solution: ["g7g8q"],
    starterCode: { python: CODE_PROMOTE },
    solutionCode: CODE_PROMOTE,
    explanation: "Promotion moves carry a fifth character: the piece letter. \"g7g8q\" pushes the pawn to g8 and replaces it with a queen.",
    learningObjectives: ["Return a promotion move with the piece suffix", "Understand UCI move formatting"],
    difficulty: "beginner",
    expandKnowledge: ["UCI also allows n, r and b for underpromotion — try them once you can promote with a queen."],
  },
  {
    id: "knight-takes-queen",
    track: "programming",
    name: "Knight Takes Queen",
    concept: "Tactics",
    mission: "Return the knight move that captures the black queen.",
    fen: "4k3/8/8/3q4/8/2N5/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Filter the legal moves for one that starts on your knight's square.",
      "game.moves_from(\"c3\") shows where the knight can go.",
    ],
    solution: ["c3d5"],
    starterCode: { python: CODE_CAPTURE_PIECE("q") },
    solutionCode: CODE_CAPTURE_PIECE("q"),
    explanation: "game.moves_from(\"c3\") narrows the list to the knight's jumps; the one landing on d5 takes the queen.",
    learningObjectives: ["Filter moves by origin square", "Capture with a knight from code"],
    difficulty: "beginner",
    expandKnowledge: ["moves_from() works for every piece — it is the fastest way to find one piece's options."],
  },
  {
    id: "pick-the-best",
    track: "programming",
    name: "Pick the Best",
    concept: "Evaluation",
    mission: "Two pieces are capturable — take the more valuable one.",
    fen: "4k3/8/5p2/6q1/4N3/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Your knight can take a pawn or a queen — a program should know which is worth more.",
      "Look at the destination square of each capture and prefer the queen on g5.",
    ],
    solution: ["e4g5"],
    starterCode: { python: CODE_CAPTURE_PIECE("q") },
    solutionCode: CODE_CAPTURE_PIECE("q"),
    explanation: "Two captures, one choice. A program ranks targets by value — the queen on g5 is worth far more than the pawn on f6.",
    learningObjectives: ["Rank capture targets by material value", "Combine move generation with evaluation"],
    difficulty: "beginner",
    expandKnowledge: ["This is the seed of a minimax search: generate, then score."],
  },
  {
    id: "king-takes-back",
    track: "programming",
    name: "King Takes Back",
    concept: "Defence",
    mission: "Return the move that captures the piece checking your king.",
    fen: "7k/8/8/8/8/8/6q1/6K1 w - - 0 1",
    goal: { type: "escape" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "The checking queen sits right beside your king and is undefended.",
      "A king may capture a piece that is next to it, as long as it is not defended.",
    ],
    solution: ["g1g2"],
    starterCode: { python: CODE_ESCAPE },
    solutionCode: CODE_ESCAPE,
    explanation: "The checking queen stands next to the king and nothing defends her — capturing her is a legal escape. Your program finds it among legal_moves().",
    learningObjectives: ["Escape check by capturing", "Verify a capture is safe before returning it"],
    difficulty: "beginner",
    expandKnowledge: ["Always test whether the capturing piece is defended — here it is not."],
  },
  {
    id: "win-the-rook",
    track: "programming",
    name: "Win the Rook",
    concept: "Capturing",
    mission: "Return the move that captures the black rook.",
    fen: "4k3/8/8/3r4/8/8/8/3R2K1 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Same idea as taking the queen — find the capture on the d-file.",
      "Your rook slides from d1 to d5 and takes.",
    ],
    solution: ["d1d5"],
    starterCode: { python: CODE_CAPTURE_PIECE("r") },
    solutionCode: CODE_CAPTURE_PIECE("r"),
    explanation: "Same capture logic as taking the queen: scan legal_moves() for the move landing on d5, where the rook stands.",
    learningObjectives: ["Reuse capture-finding logic", "Capture a rook with a rook"],
    difficulty: "beginner",
    expandKnowledge: ["One capture function handles every piece — only the target square changes."],
  },
  {
    id: "fork-the-king",
    track: "programming",
    name: "Fork the King",
    concept: "Tactics",
    mission: "Return the knight move that puts the black king in check.",
    fen: "4k1q1/8/8/8/4N3/8/8/2K5 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A knight that checks the king often attacks a second piece too.",
      "From e4 your knight can land on f6, which touches both the king and the queen.",
    ],
    visualHint: {
      caption: "The knight lands on f6 and forks both the king and the queen at once.",
      arrows: [
        { from: "e4", to: "f6", tone: "accent" },
        { from: "f6", to: "e8", tone: "danger" },
        { from: "f6", to: "g8", tone: "danger" },
      ],
      highlights: [
        { sq: "e8", tone: "danger" },
        { sq: "g8", tone: "warning" },
      ],
    },
    solution: ["e4f6"],
    starterCode: { python: CODE_CHECK },
    solutionCode: CODE_CHECK,
    explanation: "Nf6+ checks the king and simultaneously attacks the queen on g8 — the knight fork. Your program returns the checking move.",
    learningObjectives: ["Find a checking knight jump", "Spot a fork in code"],
    difficulty: "intermediate",
    expandKnowledge: ["Fork detection: a move that attacks two or more enemy pieces at once."],
  },
  {
    id: "corner-mate-code",
    track: "programming",
    name: "Corner Mate",
    concept: "Checkmate",
    mission: "Return the move that mates the king in the corner.",
    fen: "k7/8/1K6/8/8/8/8/7Q w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Your king covers the king's only escape squares — the queen delivers the blow.",
      "Swing the queen to the far end of the h-file: h8.",
    ],
    solution: ["h1h8"],
    starterCode: { python: CODE_MATE },
    solutionCode: CODE_MATE,
    explanation: "Qh8 is checkmate: your king covers a7 and b7, and the queen takes the whole eighth rank. The program returns the mate and the harness verifies no reply exists.",
    learningObjectives: ["Return a checkmating move", "Combine king cover with queen attack"],
    difficulty: "intermediate",
    expandKnowledge: ["Mate detection in code = give check AND generate zero enemy replies."],
  },
  {
    id: "promote-and-win",
    track: "programming",
    name: "Promotion Push",
    concept: "Promotion",
    mission: "Return the move that promotes your pawn to a queen.",
    fen: "k7/6P1/8/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "promote" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Read the pawn's square and its destination, then add the promotion letter.",
      "g7 to g8 with a queen: \"g7g8q\".",
    ],
    solution: ["g7g8q"],
    starterCode: { python: CODE_PROMOTE },
    solutionCode: CODE_PROMOTE,
    explanation: "The pawn reaches g8; the move string carries the queen suffix. Your program builds \"g7\" + \"g8\" + \"q\" from the pawn's square.",
    learningObjectives: ["Construct a promotion move programmatically", "Append the promotion piece letter"],
    difficulty: "beginner",
    expandKnowledge: ["Building move strings from board state — rather than hard-coding them — is how real engines play."],
  },
  {
    id: "smothered-code",
    track: "programming",
    name: "Smothered in Code",
    concept: "Tactics",
    mission: "Return the knight move that checkmates the black king.",
    fen: "6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "The king is walled in by its own rook and pawns.",
      "The knight on e5 can reach f7, a square that gives check and cannot be taken.",
    ],
    solution: ["e5f7"],
    starterCode: { python: CODE_MATE },
    solutionCode: CODE_MATE,
    explanation: "Nf7# — the king is sealed in by its own rook and pawns, and the knight's check cannot be captured, blocked or stepped out of. The program returns the mate.",
    learningObjectives: ["Return a smothered mate from code", "Recognise when a king has zero replies"],
    difficulty: "intermediate",
    expandKnowledge: ["Detecting smothered mates is the same mate test — check plus an empty reply set."],
  },
  {
    id: "knight-fork-code",
    track: "programming",
    name: "Fork Detection",
    concept: "Tactics",
    difficulty: "intermediate",
    mission: "Return a move that gives check — look for tactical opportunities.",
    explanation:
      "A fork attacks multiple targets. Knights excel at this — learning to spot them is crucial.",
    learningObjectives: ["Recognize knight forks", "Find forcing moves"],
    steps: ["Get legal moves", "Check which move gives check", "Return it"],
    codeExplanation:
      "You can simulate moves mentally or just pick the move that results in check. The harness tests the result.",
    expandKnowledge: ["Forks, pins, skewers form the tactical foundation"],
    fen: "4k1q1/8/8/8/4N3/8/8/2K5 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Knight on e4 can move to f6", "f6 attacks the black king"],
    solution: ["e4f6"],
    starterCode: { python: CODE_CHECK },
    solutionCode: CODE_CHECK,
  },
  {
    id: "choose-best-capture",
    track: "programming",
    name: "Value Capture",
    concept: "Evaluation",
    difficulty: "intermediate",
    mission: "Capture the highest value piece available to you.",
    explanation:
      "When multiple captures exist, prefer capturing more valuable enemy pieces (Queen > Rook > Bishop/Knight > Pawn).",
    learningObjectives: ["Understand piece values", "Compare captures", "Make good tactical choices"],
    steps: ["Find all capture moves", "Determine what piece each capture takes", "Pick the highest value capture"],
    codeExplanation:
      "For each legal move, if it lands on an enemy piece, compare values. Return the move taking the most valuable piece.",
    expandKnowledge: [
      "Material is a key factor in chess evaluation",
      "Sometimes sacrifices are good, but for now capture the best!",
    ],
    fen: "4k3/8/5p2/6q1/4N3/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Your knight can capture on g5 (queen) or elsewhere (pawn)", "Queen is worth 9 pawns, pawn is worth 1"],
    solution: ["e4g5"],
    starterCode: { python: CODE_CAPTURE_PIECE("q") },
    solutionCode: CODE_CAPTURE_PIECE("q"),
  },
  // -------------------------------------------------------------------------
  // Beginner — one new piece/concept each, taught through code.
  // -------------------------------------------------------------------------
  {
    id: "bishop-takes-pawn",
    track: "programming",
    name: "Bishop Capture",
    concept: "Capturing",
    difficulty: "beginner",
    mission: "Return the move that captures the black pawn with your bishop.",
    explanation:
      "Bishops slide any number of squares diagonally. Unlike knights they cannot jump — the path must be clear all the way to the target.",
    learningObjectives: ["Understand diagonal movement", "Capture with a bishop", "Read a diagonal path in code"],
    steps: ["Find your bishop on b2", "Follow the diagonal toward f6", "Return the capture"],
    codeExplanation:
      "game.moves_from('b2') lists every legal move from b2. The one ending on f6 is the capture — the pawn is the only thing standing on that diagonal.",
    expandKnowledge: [
      "A bishop stays on one colour complex for the whole game",
      "Two bishops working together control almost every square",
    ],
    fen: "7k/8/5p2/8/8/8/1B6/6K1 w - - 0 1",
    goal: { type: "capture", piece: "p" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A bishop slides diagonally — it cannot jump over pieces.",
      "The black pawn on f6 sits on the same diagonal as your bishop: b2-c3-d4-e5-f6.",
    ],
    guidedSteps: [
      {
        title: "Find the bishop",
        instructions: "Print every legal move from b2 with print(game.moves_from('b2')) so you can see where the bishop can go.",
        codeMustInclude: ["game.moves_from('b2')"],
        expectedOutputIncludes: ["b2f6"],
      },
      {
        title: "Return the capture",
        instructions: "Return the one move from that list that lands on f6 — the black pawn.",
        codeMustInclude: ["return"],
      },
    ],
    visualHint: {
      caption: "The bishop slides down the diagonal b2-c3-d4-e5 and takes the pawn on f6.",
      arrows: [{ from: "b2", to: "f6", tone: "accent" }],
      highlights: [{ sq: "f6", tone: "danger" }],
    },
    solution: ["b2f6"],
    starterCode: { python: CODE_CAPTURE_PIECE("p") },
    solutionCode: CODE_CAPTURE_PIECE("p"),
  },
  {
    id: "bishop-gives-check",
    track: "programming",
    name: "Bishop Check",
    concept: "Attacking",
    difficulty: "beginner",
    mission: "Return the move that gives check to the black king with your bishop.",
    explanation:
      "A bishop gives check by sliding onto a diagonal that reaches the enemy king. Here the king sits on h4 — find the diagonal that hits it.",
    learningObjectives: ["Give check with a bishop", "See diagonals in code", "Use moves_from to filter options"],
    steps: ["Find your bishop on c1", "Look for a square that attacks h4", "Return that move"],
    codeExplanation:
      "game.moves_from('c1') returns every square the bishop can reach. Landing on g5 puts the king on h4 in check along the g5-h4 diagonal.",
    expandKnowledge: [
      "A check forces the opponent to respond immediately — it is a 'forcing move'",
      "Bishops are strongest when the board is open and diagonals are clear",
    ],
    fen: "8/8/8/8/7k/8/8/K1B5 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "The king is on h4. Which square, one diagonal step away, attacks it?",
      "Slide the bishop from c1 up to g5 — from there it stares straight at h4.",
    ],
    guidedSteps: [
      {
        title: "Look down the diagonal",
        instructions: "Print the legal moves from c1 with print(game.moves_from('c1')) to see every square the bishop can reach.",
        codeMustInclude: ["game.moves_from('c1')"],
        expectedOutputIncludes: ["c1g5"],
      },
      {
        title: "Give the check",
        instructions: "Return the move that lands on g5 — from there the bishop attacks the king on h4.",
        codeMustInclude: ["return"],
      },
    ],
    solution: ["c1g5"],
    starterCode: { python: CODE_CHECK },
    solutionCode: CODE_CHECK,
  },
  {
    id: "pawn-gives-check",
    track: "programming",
    name: "Pawn Check",
    concept: "Attacking",
    difficulty: "beginner",
    mission: "Return the move that pushes your pawn to give check to the black king.",
    explanation:
      "Pawns attack one square diagonally forward. Pushing a pawn to the right rank can put the enemy king in check — a check many beginners miss.",
    learningObjectives: ["Understand pawn pushes", "See that pawns attack diagonally", "Give check with a pawn"],
    steps: ["Find your pawn on d4", "Push it one square forward to d5", "The pawn now attacks e6"],
    codeExplanation:
      "game.moves_from('d4') shows the pawn's single legal push, d4d5. From d5 a pawn attacks c6 and e6 — and the black king is sitting on e6.",
    expandKnowledge: [
      "Pawns capture differently from how they move — diagonally forward only",
      "A pawn on the 5th rank can be a surprisingly strong attacking piece",
    ],
    fen: "8/8/4k3/8/3P4/8/8/6K1 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A pawn pushes straight forward but attacks diagonally.",
      "Push the pawn from d4 to d5 — from there it attacks the king on e6.",
    ],
    guidedSteps: [
      {
        title: "See the pawn's options",
        instructions: "Print game.moves_from('d4') to see where the pawn can move.",
        codeMustInclude: ["game.moves_from('d4')"],
        expectedOutputIncludes: ["d4d5"],
      },
      {
        title: "Push to check",
        instructions: "Return the move that pushes the pawn to d5 — from there it attacks the king on e6 diagonally.",
        codeMustInclude: ["return"],
      },
    ],
    solution: ["d4d5"],
    starterCode: { python: CODE_CHECK },
    solutionCode: CODE_CHECK,
  },
  {
    id: "queen-takes-rook",
    track: "programming",
    name: "Queen Capture",
    concept: "Capturing",
    difficulty: "beginner",
    mission: "Return the move that captures the black rook with your queen.",
    explanation:
      "The queen combines the rook's straight lines and the bishop's diagonals. Here the rook sits on a diagonal from your queen — slide down and take it.",
    learningObjectives: ["Move the queen in code", "Capture along a diagonal", "Combine rank, file and diagonal vision"],
    steps: ["Find your queen on c1", "Notice f4 sits on a diagonal from c1", "Return the capture"],
    codeExplanation:
      "game.moves_from('c1') lists every queen move. The move ending on f4 slides diagonally c1-d2-e3-f4 and captures the rook.",
    expandKnowledge: [
      "The queen is the most powerful piece — worth about nine pawns",
      "Because she is so valuable, only capture with her when the target is safe",
    ],
    fen: "7k/8/8/8/5r2/8/8/2Q3K1 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "The queen slides in eight directions — look for the rook on a diagonal.",
      "From c1 the diagonal c1-d2-e3-f4 leads straight to the rook.",
    ],
    guidedSteps: [
      {
        title: "Survey the queen's moves",
        instructions: "Print game.moves_from('c1') to list every square the queen can reach from c1.",
        codeMustInclude: ["game.moves_from('c1')"],
        expectedOutputIncludes: ["c1f4"],
      },
      {
        title: "Take the rook",
        instructions: "Return the move that lands on f4 — that captures the black rook.",
        codeMustInclude: ["return"],
      },
    ],
    solution: ["c1f4"],
    starterCode: { python: CODE_CAPTURE_PIECE("r") },
    solutionCode: CODE_CAPTURE_PIECE("r"),
  },
  // -------------------------------------------------------------------------
  // Intermediate — scan and filter moves in code, promote through a capture.
  // -------------------------------------------------------------------------
  {
    id: "find-any-capture",
    track: "programming",
    name: "Loop for Captures",
    concept: "Legal Moves",
    difficulty: "intermediate",
    mission: "Write a loop that scans every legal move and returns any capture.",
    explanation:
      "Not every legal move is a capture. To find captures in code, look at each move's destination square and check whether an enemy piece sits there.",
    learningObjectives: ["Iterate over legal moves", "Read a move's destination square", "Detect enemy pieces with piece_at"],
    steps: ["Get all legal moves", "For each move, read its destination (move[2:4])", "Check piece_at(destination) for an enemy piece", "Return the first capture you find"],
    codeExplanation:
      "Each legal move is a 4-letter string: the start square then the destination (e.g. 'e4f6'). move[2:4] is the destination. game.piece_at(dest) returns '' for empty, an uppercase letter for your own pieces, or a lowercase letter for the enemy's — so a lowercase letter means a capture.",
    expandKnowledge: [
      "This scanning technique generalises: look for checks, safe squares, or forks the same way",
      "Real engines score every move this way before searching deeper",
    ],
    fen: "7k/8/3p1p2/8/4N3/8/8/6K1 w - - 0 1",
    goal: { type: "capture" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Your knight on e4 can capture the pawns on d6 or f6.",
      "Loop over game.legal_moves() and check game.piece_at(move[2:4]) — a lowercase letter means an enemy piece.",
    ],
    guidedSteps: [
      {
        title: "List every move",
        instructions: "Print game.legal_moves() to see every move you could play this turn.",
        codeMustInclude: ["game.legal_moves()"],
        expectedOutputIncludes: ["e4f6"],
      },
      {
        title: "Find a capture in code",
        instructions:
          "Write a loop over game.legal_moves() that checks game.piece_at(move[2:4]) for each move's destination — return the first move whose destination holds an enemy piece (a lowercase letter).",
        codeMustInclude: ["game.piece_at"],
      },
    ],
    visualHint: {
      caption: "The knight on e4 can capture either pawn — d6 or f6. Your loop should find one of them.",
      arrows: [
        { from: "e4", to: "d6", tone: "accent" },
        { from: "e4", to: "f6", tone: "accent" },
      ],
      highlights: [
        { sq: "d6", tone: "danger" },
        { sq: "f6", tone: "danger" },
      ],
    },
    solution: ["e4f6"],
    starterCode: { python: CODE_CAPTURE_ANY },
    solutionCode: CODE_CAPTURE_ANY,
  },
  {
    id: "scan-for-checks",
    track: "programming",
    name: "Scan for Checks",
    concept: "Attacking",
    difficulty: "intermediate",
    mission: "Scan every legal move and return any one that gives check to the black king.",
    explanation:
      "A strong program doesn't just find captures — it can scan for every move that gives check, which is often the start of a winning combination.",
    learningObjectives: ["Scan moves for a tactical property", "Recognise check-giving moves", "Reuse the loop technique for a new goal"],
    steps: ["List all legal moves", "Imagine each move's destination attacking the black king", "Return any check you find"],
    codeExplanation:
      "Both the rook sliding to a8 and the queen sliding to d8 give check along the 8th rank. Pick either — the harness only needs one legal checking move.",
    expandKnowledge: [
      "Searching for all checks is the first step of many 'mate in N' puzzles",
      "Combining scans (checks + captures) is how tactical vision is built in code",
    ],
    fen: "6k1/8/8/8/8/8/8/R5QK w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "The black king is on g8. Sliding a rook or the queen to the 8th rank would attack it.",
      "Return a1a8 (rook) or d1d8 (queen) — both give check.",
    ],
    guidedSteps: [
      {
        title: "Scan all moves",
        instructions: "Print game.legal_moves() to list every move available this turn.",
        codeMustInclude: ["game.legal_moves()"],
        expectedOutputIncludes: ["a1a8"],
      },
      {
        title: "Return any check",
        instructions: "Pick and return any move that attacks the black king — for example sliding a rook or the queen to the 8th rank.",
        codeMustInclude: ["return"],
      },
    ],
    solution: ["a1a8"],
    starterCode: { python: CODE_CHECK },
    solutionCode: CODE_CHECK,
  },
  {
    id: "capture-to-promote",
    track: "programming",
    name: "Capture to Promote",
    concept: "Promotion",
    difficulty: "intermediate",
    mission: "Return the capture that promotes your pawn on the 7th rank.",
    explanation:
      "A pawn can promote by pushing OR by capturing onto the last rank. Here the only way forward is to capture the rook on d8 — and promote in the same move.",
    learningObjectives: ["Promote through a capture", "Read a promotion move's fifth letter", "Combine capture and promotion in one move"],
    steps: ["Find your pawn on c7", "Notice the black rook sits diagonally on d8", "Return the capture with a promotion letter"],
    codeExplanation:
      "game.moves_from('c7') returns both the plain push (c7c8) and the capture-promotions (c7d8q, c7d8r, ...). Any move ending in d8 with a fifth letter captures the rook AND promotes at once.",
    expandKnowledge: [
      "Promotion moves always carry a fifth UCI letter: the piece to place on the last rank",
      "Capturing to promote is common when the queening square is defended or occupied",
    ],
    fen: "3r4/2P5/8/7k/8/8/5K2/8 w - - 0 1",
    goal: { type: "promote" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A pawn captures one square diagonally forward — c7 takes d8.",
      "Promotion moves carry a fifth letter: 'c7d8q' means capture d8 and become a queen.",
    ],
    guidedSteps: [
      {
        title: "See the pawn's capture",
        instructions: "Print game.moves_from('c7') to see the pawn's options — notice the capture onto d8.",
        codeMustInclude: ["game.moves_from('c7')"],
        expectedOutputIncludes: ["c7d8"],
      },
      {
        title: "Promote with a letter",
        instructions: "Return the move with a fifth letter for the piece you want, e.g. 'c7d8q' to promote to a queen.",
        codeMustInclude: ["return"],
      },
    ],
    solution: ["c7d8q"],
    starterCode: { python: CODE_PROMOTE },
    solutionCode: CODE_PROMOTE,
  },
  // -------------------------------------------------------------------------
  // Advanced — discovered check, stalemate, and under-promotion.
  // -------------------------------------------------------------------------
  {
    id: "discovered-check-code",
    track: "programming",
    name: "Discovered Check",
    concept: "Tactics",
    difficulty: "advanced",
    mission: "Jump your knight off the e-file so the rook behind it checks the black king.",
    explanation:
      "A discovered check happens when one piece moves out of the way and reveals an attack from a piece behind it. The moving piece can go anywhere — the revealed check happens no matter what.",
    learningObjectives: ["Recognise a discovered check", "Move a blocking piece to reveal an attack", "Think about two pieces working together"],
    steps: ["Notice your own knight blocks your rook's line to the king", "Move the knight anywhere legal off the e-file", "The rook then checks the king"],
    codeExplanation:
      "Your rook on e1 already aims at the king on e8 — your own knight on e4 is just in the way. Any knight move (e.g. e4c5) clears the file and the rook's attack is revealed.",
    expandKnowledge: [
      "Discovered checks are powerful because the moving piece can create a second threat at the same time",
      "A 'double check' (both pieces give check) forces the king to move — it cannot be blocked or captured",
    ],
    fen: "4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Your own knight on e4 is standing in front of your rook.",
      "Move the knight off the e-file (e.g. to c5) — the rook behind it then checks the king.",
    ],
    guidedSteps: [
      {
        title: "Find the blocker",
        instructions: "Notice your own knight on e4 is standing in front of your rook. Print game.moves_from('e4') to see where it can jump.",
        codeMustInclude: ["game.moves_from('e4')"],
        expectedOutputIncludes: ["e4c5"],
      },
      {
        title: "Jump away to reveal check",
        instructions: "Return any knight move that leaves the e-file clear — the rook behind it will then check the king.",
        codeMustInclude: ["return"],
      },
    ],
    visualHint: {
      caption: "The knight jumps off the e-file (e4→c5), revealing the rook's line straight to the king on e8.",
      arrows: [
        { from: "e1", to: "e8", tone: "danger" },
        { from: "e4", to: "c5", tone: "accent" },
      ],
      highlights: [{ sq: "e8", tone: "danger" }],
    },
    solution: ["e4c5"],
    starterCode: { python: CODE_CHECK },
    solutionCode: CODE_CHECK,
  },
  {
    id: "create-stalemate-code",
    track: "programming",
    name: "Force Stalemate",
    concept: "Endgames",
    difficulty: "advanced",
    mission: "Return the move that leaves the black king with no legal move and no check — stalemate.",
    explanation:
      "Stalemate is a draw: the king is not in check but has no legal move. Sometimes that is the best result available — turning a lost game into a half-point.",
    learningObjectives: ["Understand stalemate", "Cover every escape square without giving check", "See the whole board, not just the king"],
    steps: ["Notice the white king already covers g8 and g7", "The only free square is h7", "Move the queen to cover h7 without attacking h8"],
    codeExplanation:
      "The queen on a6 must reach a square that attacks h7 but NOT h8. Sliding a6-d3 does exactly that: d3 attacks h7 along a diagonal, while the white king keeps g8 and g7 covered — the king is trapped, not checked.",
    expandKnowledge: [
      "In a lost endgame, stalemate tricks are a real defensive resource",
      "Giving stalemate 'by accident' is a common beginner heartbreak — always check the king has a move",
    ],
    fen: "7k/5K2/Q7/8/8/8/8/8 w - - 0 1",
    goal: { type: "stalemate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "Your king already covers g8 and g7 — only h7 is left open.",
      "The queen must attack h7 without attacking h8: slide it to d3.",
    ],
    guidedSteps: [
      {
        title: "Look at the king's escapes",
        instructions: "The black king on h8 wants to reach h7. Print game.moves_from('a6') to see where your queen can go.",
        codeMustInclude: ["game.moves_from('a6')"],
        expectedOutputIncludes: ["a6d3"],
      },
      {
        title: "Close the last door",
        instructions:
          "Return the move that lands on d3 — from there the queen takes away h7 without giving check, leaving the king with nowhere to go.",
        codeMustInclude: ["return"],
      },
    ],
    visualHint: {
      caption: "The queen slides a6→d3 to seal h7 — with the king covering g8 and g7, black is stalemated.",
      arrows: [{ from: "a6", to: "d3", tone: "accent" }],
      highlights: [
        { sq: "g8", tone: "danger" },
        { sq: "g7", tone: "danger" },
        { sq: "h7", tone: "warning" },
      ],
    },
    solution: ["a6d3"],
    starterCode: { python: CODE_STALEMATE },
    solutionCode: CODE_STALEMATE,
  },
  {
    id: "underpromotion-check",
    track: "programming",
    name: "Under-promote to Check",
    concept: "Endgames",
    difficulty: "advanced",
    mission: "Promote your pawn — but only a knight gives check from b8. A queen would miss the king.",
    explanation:
      "Sometimes the strongest promotion is NOT a queen. A knight moves differently from every other piece, and here only a knight promoted on b8 attacks the king on d7.",
    learningObjectives: ["Understand under-promotion", "Match the promoting piece to the position", "See why knight geometry matters"],
    steps: ["Look at the pawn on b7 and the king on d7", "A queen on b8 would not attack d7", "A knight on b8 WOULD — return the knight promotion"],
    codeExplanation:
      "Promotion moves are distinguished by their fifth letter. 'b7b8q' makes a queen (which misses d7); 'b7b8n' makes a knight, and a knight on b8 attacks a6, c6 and d7 — check.",
    expandKnowledge: [
      "Under-promotion to a knight is the only kind that can deliver a surprise check or fork",
      "Under-promoting to a rook is sometimes needed to avoid stalemate",
    ],
    fen: "8/1P1k4/8/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: [
      "A queen on b8 controls ranks, files and diagonals — but not d7.",
      "A knight on b8 attacks a6, c6 and d7 — return 'b7b8n'.",
    ],
    guidedSteps: [
      {
        title: "Try the obvious promotion",
        instructions: "Print game.moves_from('b7') to see all the promotion moves — notice they differ only by the final letter.",
        codeMustInclude: ["game.moves_from('b7')"],
        expectedOutputIncludes: ["b7b8"],
      },
      {
        title: "Under-promote to check",
        instructions: "Return 'b7b8n' — only a knight on b8 attacks the king on d7. A queen there would not.",
        codeMustInclude: ["return"],
      },
    ],
    visualHint: {
      caption: "Only a knight promoted on b8 attacks d7 — a queen would miss it entirely.",
      arrows: [{ from: "b8", to: "d7", tone: "danger" }],
      highlights: [{ sq: "d7", tone: "danger" }],
    },
    solution: ["b7b8n"],
    starterCode: { python: CODE_CHECK },
    solutionCode: CODE_CHECK,
  },
];

export const TRAINING_LESSONS: TrainingLesson[] = [
  ...PHYSICAL_LESSONS,
  ...PROGRAMMING_LESSONS,
  // The staged programming curriculum (lessons/programming/). Array order
  // controls display order within a stage, so the original lessons always
  // lead their stage group.
  ...PROGRAMMING_EXTRA_LESSONS,
];

export function lessonsForTrack(track: TrainingTrack): TrainingLesson[] {
  return TRAINING_LESSONS.filter((l) => l.track === track);
}

export function getTrainingLesson(track: string, lessonId: string): TrainingLesson | undefined {
  return TRAINING_LESSONS.find((l) => l.track === track && l.id === lessonId);
}

// ---------------------------------------------------------------------------
// The judge
// ---------------------------------------------------------------------------

const CODE_CHAR: Record<number, string> = {
  [PAWN]: "p",
  [KNIGHT]: "n",
  [BISHOP]: "b",
  [ROOK]: "r",
  [QUEEN]: "q",
  [KING]: "k",
};

const PIECE_VALUE: Record<number, number> = {
  [PAWN]: 1,
  [KNIGHT]: 3,
  [BISHOP]: 3,
  [ROOK]: 5,
  [QUEEN]: 9,
  [KING]: 0,
};

export type JudgeResult = {
  /** True once the goal is met. */
  won: boolean;
  /** 0–3, decided the same way the arcade decides stars. */
  stars: number;
  /** A short sentence for the student, met or not. */
  message: string;
  /** Every ply actually applied, player and reply, in order (UCI). */
  line: string[];
  /** The position after the whole line. */
  finalFen: string;
};

function material(board: Int8Array, white: boolean): number {
  let total = 0;
  for (let i = 0; i < 64; i++) {
    const code = board[i];
    if (!code) continue;
    if (code > 0 === white) total += PIECE_VALUE[Math.abs(code)];
  }
  return total;
}

function explain(goal: TrainingGoal, studentColor: "white" | "black"): string {
  switch (goal.type) {
    case "any":
      return "Return any legal move to finish the lesson.";
    case "capture":
      return goal.piece
        ? `Capture the black ${PIECE_NAME[goal.piece] ?? "piece"} — you have not won it yet.`
        : "Capture a piece — you have not taken anything yet.";
    case "escape":
      return "Your king is still in check. Get him to safety.";
    case "check":
      return "That did not give check. Attack the enemy king.";
    case "mate":
      return "That was not checkmate. Keep looking for the finish.";
    case "stalemate":
      return "Not stalemate yet — the king still has a move, or is in check.";
    case "promote":
      return "Your pawn has not reached the last rank yet.";
    case "material":
      return `You need at least ${goal.minGain} pawns of extra material.`;
    default:
      return `${studentColor === "white" ? "White" : "Black"} has not solved it yet.`;
  }
}

const PIECE_NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/**
 * The opponent's reply after the student's i-th move.
 *
 * A lesson may script its replies (`replies`) to force a deterministic teaching
 * line. Otherwise a physical lesson plays back with a deterministic engine move,
 * so the board always hands control back to the student instead of waiting on an
 * opponent that does not exist. The browser (for animation) and the judge (for
 * grading) both call this, so they replay an identical line.
 */
export function opponentReply(lesson: TrainingLesson, game: ChessGame, i: number): string | null {
  if (game.status().over) return null;
  const scripted = lesson.replies?.[i];
  if (scripted && game.findMove(scripted) != null) return scripted;
  if (lesson.track !== "physical") return null;
  return chooseMoveDeterministic(game);
}

type GoalCtx = {
  anyLegal: boolean;
  captures: string[];
  promoted: boolean;
  gaveCheck: boolean;
  mated: boolean;
  stalemated: boolean;
  escaped: boolean;
  gain: number;
};

/** Whether the lesson's goal has been reached by the moves played so far. */
function goalReached(goal: TrainingGoal, c: GoalCtx): boolean {
  switch (goal.type) {
    case "any":
      return c.anyLegal;
    case "capture":
      return goal.piece ? c.captures.includes(goal.piece) : c.captures.length > 0;
    case "escape":
      return c.escaped;
    case "check":
      return c.gaveCheck;
    case "mate":
      return c.mated;
    case "stalemate":
      return c.stalemated;
    case "promote":
      return c.promoted;
    case "material":
      return c.gain >= goal.minGain;
    default:
      return false;
  }
}

/**
 * Replay a submitted line and decide whether the lesson's goal was reached.
 * Pure: no database, no sandbox — safe to run on either side.
 */
export function judgeLesson(lesson: TrainingLesson, playerMoves: string[]): JudgeResult {
  const game = new ChessGame(lesson.fen);
  const studentWhite = parseFen(lesson.fen).turn === WHITE;
  const studentColor: "white" | "black" = studentWhite ? "white" : "black";
  const startMaterial = material(game.pos.board, studentWhite);

  const line: string[] = [];
  const captures: string[] = [];
  let promoted = false;
  let gaveCheck = false;
  let mated = false;
  let stalemated = false;
  let escaped = false;
  let anyLegal = false;
  let illegal = false;

  const moves = playerMoves.map((m) => String(m ?? "").trim().toLowerCase()).filter(Boolean);

  // A position can already read as a draw (e.g. king and knight versus king is
  // "insufficient material"). That must not stop the very first move — only a
  // decisive finish reached *during* the line ends it.
  let terminated = false;
  for (let i = 0; i < moves.length; i++) {
    if (terminated) break;
    const uci = moves[i];
    const toSq = parseSquare(uci.slice(2, 4));
    const target = toSq >= 0 ? game.pos.board[toSq] : 0;
    const before = game.pos.board.slice();
    const ply = game.move(uci);
    if (!ply) {
      illegal = true;
      break;
    }
    anyLegal = true;
    line.push(ply.uci);
    if (target !== 0) captures.push(CODE_CHAR[Math.abs(before[toSq])]);
    if (uci.length >= 5) promoted = true;

    const status = game.status();
    if (!game.inCheck()) escaped = true;
    if (game.inCheck()) gaveCheck = true;
    if (status.state === "checkmate" && status.winner === studentColor) mated = true;
    if (status.state === "stalemate") stalemated = true;

    // Stop as soon as the goal is reached: no need to hand a solved lesson to
    // the opponent, and the browser can then show exactly this line.
    const gainNow = material(game.pos.board, studentWhite) - startMaterial;
    if (goalReached(lesson.goal, { anyLegal, captures, promoted, gaveCheck, mated, stalemated, escaped, gain: gainNow })) {
      terminated = true;
      break;
    }
    if (status.over) {
      terminated = true;
      break;
    }

    const reply = opponentReply(lesson, game, i);
    if (reply) {
      const replyPly = game.move(reply);
      if (replyPly) line.push(replyPly.uci);
    }
  }

  const endMaterial = material(game.pos.board, studentWhite);
  const gain = endMaterial - startMaterial;
  const finalFen = game.fen();

  const met = goalReached(lesson.goal, { anyLegal, captures, promoted, gaveCheck, mated, stalemated, escaped, gain });

  if (!met) {
    const message = illegal
      ? "That move is not legal in this position."
      : moves.length === 0
        ? "Make a move to begin."
        : explain(lesson.goal, studentColor);
    return { won: false, stars: 0, message, line, finalFen };
  }

  // Solved. Grade by how direct the solution was.
  const used = Math.max(1, moves.length);
  const stars = used <= lesson.par ? 3 : used <= lesson.par + 2 ? 2 : 1;
  const message =
    stars === 3
      ? "Solved — perfectly to the point."
      : stars === 2
        ? "Solved — a little slow, but the goal is met."
        : "Solved. Try to do it in fewer moves for more stars.";
  return { won: true, stars, message, line, finalFen };
}

// ---------------------------------------------------------------------------
// Progression — stages and ranks for the physical track
// ---------------------------------------------------------------------------

/**
 * The physical track's stages, in curriculum order. Lessons are displayed
 * grouped by stage in this order; within a stage, the order of
 * `PHYSICAL_LESSONS` (original 14 first, then the staged levels) wins.
 */
export const PHYSICAL_STAGE_ORDER = [
  "Foundations",
  "Defence",
  "Tactics",
  "Checkmate",
  "Endgames",
  "Grandmaster Trials",
] as const;

export type PhysicalStage = (typeof PHYSICAL_STAGE_ORDER)[number];

/**
 * The rank ladder: completed physical lessons unlock titles. The final title
 * is only reachable by finishing all 100 levels.
 */
export const RANK_LADDER: ReadonlyArray<{
  /** Minimum completed physical lessons to hold this rank. */
  minCompleted: number;
  name: string;
  blurb: string;
}> = [
  { minCompleted: 0, name: "Novice", blurb: "Your journey starts here — 100 levels await." },
  { minCompleted: 10, name: "Club Player", blurb: "You know the pieces. The real lessons begin." },
  { minCompleted: 25, name: "Candidate Master", blurb: "Tactics and checks are becoming second nature." },
  { minCompleted: 50, name: "FIDE Master", blurb: "Halfway — you finish games now, not just start them." },
  { minCompleted: 75, name: "International Master", blurb: "Endgames and combinations are in your hands." },
  { minCompleted: 100, name: "Grandmaster", blurb: "All 100 levels complete. The title is yours." },
];

/** The rank a player holds for a given number of completed physical lessons. */
export function rankForCompleted(completed: number): { name: string; blurb: string; minCompleted: number } {
  let current = RANK_LADDER[0];
  for (const rank of RANK_LADDER) {
    if (completed >= rank.minCompleted) current = rank;
  }
  return current;
}

/** Physical lessons grouped by stage, in `PHYSICAL_STAGE_ORDER`; unknown
 * stages (none today) sort last, keeping their curriculum order. */
export function physicalStages(
  lessons: readonly TrainingLesson[],
): Array<{ stage: string; lessons: TrainingLesson[] }> {
  const groups = new Map<string, TrainingLesson[]>();
  for (const lesson of lessons) {
    if (lesson.track !== "physical") continue;
    const stage = lesson.stage ?? "More";
    const list = groups.get(stage);
    if (list) list.push(lesson);
    else groups.set(stage, [lesson]);
  }
  const ordered: Array<{ stage: string; lessons: TrainingLesson[] }> = [];
  for (const stage of PHYSICAL_STAGE_ORDER) {
    const list = groups.get(stage);
    if (list) ordered.push({ stage, lessons: list });
  }
  for (const [stage, list] of groups) {
    if (!(PHYSICAL_STAGE_ORDER as readonly string[]).includes(stage)) {
      ordered.push({ stage, lessons: list });
    }
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// Multi-turn programming lessons — running a program over several turns
// ---------------------------------------------------------------------------

export type LessonPosition = {
  /** The position after replaying `moves` (student plies + scripted replies). */
  fen: string;
  /** Number of student moves contained in the replay. */
  studentMoves: number;
  /** True when the game ended (mate, stalemate, …) during the replay. */
  over: boolean;
  /** True when one of the student moves in `moves` was illegal. */
  invalid: boolean;
};

/**
 * Replay the student's moves against a programming lesson, applying the same
 * scripted/deterministic replies the judge applies, so a multi-turn program can
 * be run one turn at a time against the live position. The server uses this to
 * decide which position to hand the program; the browser uses it to animate.
 */
export function lessonPositionAfter(lesson: TrainingLesson, moves: string[]): LessonPosition {
  const game = new ChessGame(lesson.fen);
  let invalid = false;
  let studentMoves = 0;
  for (let i = 0; i < moves.length; i++) {
    const uci = String(moves[i] ?? "").trim().toLowerCase();
    if (!uci) continue;
    if (!game.move(uci)) {
      invalid = true;
      break;
    }
    studentMoves++;
    if (game.status().over) break;
    const reply = opponentReply(lesson, game, i);
    if (reply) {
      const replyPly = game.move(reply);
      if (!replyPly) break;
    }
  }
  return { fen: game.fen(), studentMoves, over: game.status().over, invalid };
}

// ---------------------------------------------------------------------------
// Progression — stages and ranks for the programming track
// ---------------------------------------------------------------------------

/**
 * The programming track's stages, in curriculum order. The original lessons
 * (which predate staging) take their stage from PROGRAMMING_ORIG_STAGE; the
 * staged extras carry `stage` inline.
 */
export const PROGRAMMING_STAGE_ORDER = [
  "Python Foundations",
  "The Board API",
  "Movement & Attacks",
  "Tactics in Code",
  "Defence in Code",
  "Endgames in Code",
  "Search & Strategy",
  "Code Grandmaster Trials",
] as const;

export type ProgrammingStage = (typeof PROGRAMMING_STAGE_ORDER)[number];

/** The rank ladder for the programming track. */
export const PROGRAMMER_RANK_LADDER: ReadonlyArray<{
  minCompleted: number;
  name: string;
  blurb: string;
}> = [
  { minCompleted: 0, name: "Code Novice", blurb: "Every engine starts with one function." },
  { minCompleted: 12, name: "Scripter", blurb: "Loops and conditions feel natural now." },
  { minCompleted: 30, name: "Tactician", blurb: "Your programs spot forks, pins and hanging pieces." },
  { minCompleted: 55, name: "Engine Builder", blurb: "Evaluation and search are in your toolkit." },
  { minCompleted: 80, name: "Algorithm Master", blurb: "Multi-move strategy runs on real Python." },
  { minCompleted: 109, name: "Code Grandmaster", blurb: "Every programming lesson solved. The title is yours." },
];

/** The rank a programmer holds for a given number of completed lessons. */
export function rankForProgrammingCompleted(completed: number): { name: string; blurb: string; minCompleted: number } {
  let current = PROGRAMMER_RANK_LADDER[0];
  for (const rank of PROGRAMMER_RANK_LADDER) {
    if (completed >= rank.minCompleted) current = rank;
  }
  return current;
}

/** Programming lessons grouped by stage, in `PROGRAMMING_STAGE_ORDER`. */
export function programmingStages(
  lessons: readonly TrainingLesson[],
): Array<{ stage: string; lessons: TrainingLesson[] }> {
  const groups = new Map<string, TrainingLesson[]>();
  for (const lesson of lessons) {
    if (lesson.track !== "programming") continue;
    const stage = lesson.stage ?? PROGRAMMING_ORIG_STAGE[lesson.id] ?? "More";
    const list = groups.get(stage);
    if (list) list.push(lesson);
    else groups.set(stage, [lesson]);
  }
  const ordered: Array<{ stage: string; lessons: TrainingLesson[] }> = [];
  for (const stage of PROGRAMMING_STAGE_ORDER) {
    const list = groups.get(stage);
    if (list) ordered.push({ stage, lessons: list });
  }
  for (const [stage, list] of groups) {
    if (!(PROGRAMMING_STAGE_ORDER as readonly string[]).includes(stage)) {
      ordered.push({ stage, lessons: list });
    }
  }
  return ordered;
}
