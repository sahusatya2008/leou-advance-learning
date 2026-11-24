/**
 * Stage 7 — Search & Strategy.
 *
 * Evaluation and one-ply search: the program scores positions and picks the
 * best move, and on longer lessons keeps its plan across turns.
 */
import type { TrainingLesson } from "../../training";

const STAGE = "Search & Strategy";

const BEST_CAPTURE = `def move(game):
    values = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}
    best = None
    best_value = 0
    for m in game.legal_moves():
        target = game.piece_at(m[2:4])
        if target and target.islower() and values[target] > best_value:
            best_value = values[target]
            best = m
    return best if best else game.legal_moves()[0]
`;

const MATE_LOOP = `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
    return game.legal_moves()[0]
`;

export const SEARCH_LESSONS: TrainingLesson[] = [
  {
    id: "search-win-the-queen",
    track: "programming",
    stage: STAGE,
    name: "Evaluate and Grab",
    concept: "Evaluation",
    difficulty: "intermediate",
    mission: "Score every capture and take the most valuable piece.",
    fen: "4k3/8/5p2/6q1/4N3/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Use a value table.", "Keep the move with the highest target value."],
    solution: ["e4g5"],
    explanation:
      "Even a tiny evaluation function changes play: score each capture target by its value and pick the maximum. This is the kernel of a chess engine.",
    learningObjectives: ["Score capture targets", "Select the maximum by value"],
    expandKnowledge: ["Real engines add position terms, but material value is the foundation."],
    steps: ["For each capture, look up the target's value.", "Return the highest."],
    codeExplanation: "The loop climbs through the captures keeping the best value seen.",
    lineNotes: ["Your evaluation picked the queen over the pawn."],
    starterCode: { python: BEST_CAPTURE },
    solutionCode: BEST_CAPTURE,
    codeWalkthrough: [
      { code: `values = {"p": 1, ..., "q": 9, ...}`, caption: "The evaluation table." },
      { code: `if target and target.islower() and values[target] > best_value`, caption: "Only enemy pieces, only better than the best so far." },
      { code: `return best`, caption: "The highest-value capture wins." },
    ],
    guidedSteps: [{ title: "Score the captures", instructions: "Take the highest-value enemy piece.", codeMustInclude: ["values"] }],
  },
  {
    id: "search-prefer-check",
    track: "programming",
    stage: STAGE,
    name: "Prefer the Check",
    concept: "Move ordering",
    difficulty: "intermediate",
    mission: "If any move gives check, play it.",
    fen: "7k/8/8/8/8/8/R7/5K2 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["First look for a checking move; fall back if there is none.", "apply + in_check finds checks."],
    solution: ["a2a8"],
    explanation: "Ordering moves matters: try forcing moves (checks, captures) first. Here the program simply prefers a check when one exists.",
    learningObjectives: ["Prioritise checks", "Order candidate moves"],
    expandKnowledge: ["Searching forcing moves first makes an engine far more efficient."],
    steps: ["Loop, apply, return any move that checks."],
    codeExplanation: "The first checking move found is returned.",
    lineNotes: ["Your program preferred the checking move."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `for m in game.legal_moves():`, caption: "Try moves in order." },
      { code: `after.in_check()`, caption: "The first one that checks is chosen." },
    ],
    guidedSteps: [{ title: "Prefer a check", instructions: "Return a checking move.", codeMustInclude: ["in_check("] }],
  },
  {
    id: "search-avoid-hanging",
    track: "programming",
    stage: STAGE,
    name: "Play the Safe Check",
    concept: "Safety",
    difficulty: "advanced",
    mission: "Give check — but only with a move that cannot be captured.",
    fen: "7k/8/8/8/8/8/R7/5K2 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["A move is safe if the destination is not attacked by the enemy.", "after has no black turn — check attacked_squares(False)."],
    solution: ["a2a8"],
    explanation:
      "Combining ideas: prefer a check, but only if the checking piece is safe. The program tests whether the enemy attacks the square it moved to.",
    learningObjectives: ["Combine preference with safety", "Use attacked_squares for the opponent"],
    expandKnowledge: ["Safety checks stop a program from throwing pieces away."],
    steps: ["Find a checking move whose piece is not attacked afterwards."],
    codeExplanation: "attacked_squares(False) lists black's attacks; the checking square must not be among them.",
    lineNotes: ["Your program chose a check that is also safe."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is None or not after.in_check():
            continue
        if m[2:4] not in after.attacked_squares(False):
            return m
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is None or not after.in_check():
            continue
        if m[2:4] not in after.attacked_squares(False):
            return m
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `after.in_check()`, caption: "Only consider checking moves." },
      { code: `after.attacked_squares(False)`, caption: "Where black can capture." },
      { code: `m[2:4] not in ...`, caption: "Reject a check that hangs the piece." },
    ],
    guidedSteps: [{ title: "Safe check", instructions: "Return a checking move whose piece is safe.", codeMustInclude: ["attacked_squares"] }],
  },
  {
    id: "search-king-and-pawn",
    track: "programming",
    stage: STAGE,
    name: "King and Pawn",
    concept: "Plan",
    difficulty: "advanced",
    mission: "March the pawn home over several turns, keeping the king close.",
    fen: "7k/8/8/8/8/8/P7/K7 w - - 0 1",
    goal: { type: "promote" },
    par: 5,
    maxPlayerMoves: 6,
    replies: ["h8g8", "g8h8", "h8g8", "g8h8", "h8g8"],
    hints: ["Push the pawn; if it cannot move, step the king.", "The same program runs every turn."],
    solution: ["a2a4", "a4a5", "a5a6", "a6a7", "a7a8q"],
    explanation:
      "A multi-turn plan: push the pawn whenever possible, otherwise improve the king. The program reads the board afresh each turn, so it keeps going without being told the sequence.",
    learningObjectives: ["Implement a simple plan", "Fall back to another move"],
    expandKnowledge: ["King-and-pawn endings are won or drawn by exactly this kind of plan."],
    steps: ["Return the pawn's move if it has one.", "Otherwise move the king."],
    codeExplanation: "moves_from finds the pawn; an empty list means it is blocked, so the king moves.",
    lineNotes: [
      "The pawn marched two squares.",
      "Another push.",
      "Sixth rank now.",
      "One step from promotion.",
      "The pawn reached the eighth rank and became a queen.",
    ],
    starterCode: {
      python: `def move(game):
    for square in ["a7", "a6", "a5", "a4", "a3", "a2"]:
        if game.piece_at(square) == "P":
            moves = game.moves_from(square)
            if moves:
                return moves[0]
    return game.moves_from("a1")[0]
`,
    },
    solutionCode: `def move(game):
    for square in ["a7", "a6", "a5", "a4", "a3", "a2"]:
        if game.piece_at(square) == "P":
            moves = game.moves_from(square)
            if moves:
                return moves[0]
    return game.moves_from("a1")[0]
`,
    codeWalkthrough: [
      { code: `for square in ["a7", ..., "a2"]`, caption: "Look for the pawn, wherever it is." },
      { code: `moves = game.moves_from(square)`, caption: "Does it have a push available?" },
      { code: `if moves: return moves[0]`, caption: "Push it." },
      { code: `return game.moves_from("a1")[0]`, caption: "Otherwise move the king." },
    ],
    guidedSteps: [{ title: "Push the pawn", instructions: "Return the pawn's move.", codeMustInclude: ["moves_from"] }],
  },
  {
    id: "search-simplify",
    track: "programming",
    stage: STAGE,
    name: "Trade When Ahead",
    concept: "Strategy",
    difficulty: "advanced",
    mission: "You are up a queen — take the last black piece.",
    fen: "7k/8/8/8/8/8/4r3/3Q1K2 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The rook is the only black piece.", "Take it."],
    solution: ["d1e2"],
    explanation: "When you are ahead, trading pieces simplifies to a winning ending. The program takes the last defender.",
    learningObjectives: ["Simplify winning positions", "Reuse the capture scan"],
    expandKnowledge: ["'When ahead, trade pieces; when behind, trade pawns.'"],
    steps: ["Return the move ending on e2."],
    codeExplanation: "The queen captures the rook, leaving a bare king.",
    lineNotes: ["Your queen took the last black piece."],
    starterCode: { python: BEST_CAPTURE },
    solutionCode: BEST_CAPTURE,
    codeWalkthrough: [{ code: `return best`, caption: "The only capture — and the winning one." }],
    guidedSteps: [{ title: "Simplify", instructions: "Take the rook.", codeMustInclude: ["values"] }],
  },
  {
    id: "search-mate-first",
    track: "programming",
    stage: STAGE,
    name: "Mate Before Material",
    concept: "Priority",
    difficulty: "advanced",
    mission: "A mate is available — find it before anything else.",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Always look for mate first.", "The back rank is open."],
    solution: ["a1a8"],
    explanation:
      "Move priority: mate beats everything. The program checks for mate before considering captures — the ordering a real engine uses.",
    learningObjectives: ["Prioritise mate", "Reuse the mate loop"],
    expandKnowledge: ["An engine that finds mate-in-one never misses it — that is the whole point of search."],
    steps: ["Loop, apply, return a move whose status is checkmate."],
    codeExplanation: "Mate detection runs first, so it never misses the finish.",
    lineNotes: ["Your program found mate before thinking about material."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "Mate is checked before anything else." }],
    guidedSteps: [{ title: "Find mate", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
  {
    id: "search-two-move",
    track: "programming",
    stage: STAGE,
    name: "Two-Move Plan",
    concept: "Plan",
    difficulty: "advanced",
    mission: "Set up the back-rank mate, then deliver it.",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    replies: [],
    hints: ["One move mates from the start position.", "Ra8 is the finish."],
    solution: ["a1a8"],
    explanation: "The program hunts for mate on every turn; a plan that finishes in one move is simply the fastest plan.",
    learningObjectives: ["Order a plan around mate", "Keep the search simple"],
    expandKnowledge: ["A forced mate is the largest possible evaluation — bigger than any material."],
    steps: ["Return a mate move."],
    codeExplanation: "The mate loop finds the finish.",
    lineNotes: ["Your program delivered the back-rank mate."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "Back-rank mate found by search." }],
    guidedSteps: [{ title: "Two-move plan", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
  {
    id: "search-centralise",
    track: "programming",
    stage: STAGE,
    name: "Activate the King",
    concept: "Plan",
    difficulty: "advanced",
    mission: "Bring the king up the board to help the pawn promote.",
    fen: "7k/8/8/4P3/8/8/8/K7 w - - 0 1",
    goal: { type: "promote" },
    par: 4,
    maxPlayerMoves: 6,
    replies: ["h8g8", "g8h8", "h8g8", "g8h8"],
    hints: ["At first the pawn can just run.", "Keep the same program every turn."],
    solution: ["e5e6", "e6e7", "e7e8q"],
    explanation:
      "Simple plans keep going. The pawn runs to the end; the program does not need new instructions each turn.",
    learningObjectives: ["Implement a pawn race", "Re-use one program across turns"],
    expandKnowledge: ["This pawn race is why every tempo counts in the endgame."],
    steps: ["Push the pawn each turn."],
    codeExplanation: "moves_from on the pawn's current square.",
    lineNotes: ["The pawn advanced.", "Another push.", "Promotion!"],
    starterCode: {
      python: `def move(game):
    for square in ["e7", "e6", "e5"]:
        if game.piece_at(square) == "P":
            moves = game.moves_from(square)
            if moves:
                return moves[0]
    return game.moves_from("a1")[0]
`,
    },
    solutionCode: `def move(game):
    for square in ["e7", "e6", "e5"]:
        if game.piece_at(square) == "P":
            moves = game.moves_from(square)
            if moves:
                return moves[0]
    return game.moves_from("a1")[0]
`,
    codeWalkthrough: [
      { code: `if game.piece_at(square) == "P"`, caption: "Find the pawn wherever it is." },
      { code: `return moves[0]`, caption: "Push it forward." },
    ],
    guidedSteps: [{ title: "Run the pawn", instructions: "Return the pawn's move.", codeMustInclude: ["moves_from"] }],
  },
  {
    id: "search-mate-hunt-2",
    track: "programming",
    stage: STAGE,
    name: "Mate Hunter II",
    concept: "Priority",
    difficulty: "advanced",
    mission: "Mate the cornered king in one move.",
    fen: "k7/8/1K6/8/8/8/8/7Q w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Look for mate first.", "The queen reaches the back rank."],
    solution: ["h1h8"],
    explanation: "The mate-hunting loop solves any mate-in-one, regardless of the pieces. That is the power of search over memorisation.",
    learningObjectives: ["Solve mate-in-one generally", "Trust search"],
    expandKnowledge: ["General search beats memorised patterns every time."],
    steps: ["Return a mate move."],
    codeExplanation: "Same mate loop.",
    lineNotes: ["Your program found the corner mate."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "Mate found by trying every move." }],
    guidedSteps: [{ title: "Mate the king", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
];
