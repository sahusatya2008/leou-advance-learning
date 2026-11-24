/**
 * Stage 2 — The Board API.
 *
 * The program must *compute* the answer from the position rather than hard-code
 * it: enumerate legal moves, inspect the board, detect checks and use
 * game.apply(move) to look one move ahead. Both files in this stage are solved
 * by simple, honest code.
 */
import type { TrainingLesson } from "../../training";

const STAGE = "The Board API";

const CANDIDATE_LOOP = `def move(game):
    # A move that ends with the enemy king in check is a checking move.
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
    return game.legal_moves()[0]
`;

export const BOARD_API_LESSONS: TrainingLesson[] = [
  {
    id: "api-loop-moves",
    track: "programming",
    stage: STAGE,
    name: "Loop the Moves",
    concept: "legal_moves()",
    difficulty: "beginner",
    mission: "Play the first move that starts on the a2 pawn.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ['startswith("a2") picks the pawn\'s moves.', "Return the first one you find."],
    solution: ["a2a3"],
    explanation:
      "legal_moves() gives every move you may play. Looping over them and picking the one you want is the basic pattern every chess program starts from.",
    learningObjectives: ["Loop over legal_moves()", "Select one move and return it"],
    expandKnowledge: ["moves_from(square) is the shortcut for this exact filter."],
    steps: ["for m in game.legal_moves():", '    if m.startswith("a2"): return m'],
    codeExplanation: "The loop checks each move; the first one starting on a2 is returned.",
    lineNotes: ["You scanned the moves and played the pawn on a2."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        if m.startswith("a2"):
            return m
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        if m.startswith("a2"):
            return m
`,
    codeWalkthrough: [
      { code: `game.legal_moves()`, caption: "The full list of legal moves." },
      { code: `if m.startswith("a2")`, caption: "Keep the move that starts on the a2 square." },
      { code: `return m`, caption: "Play it as soon as it is found." },
    ],
    guidedSteps: [
      {
        title: "Find the pawn's move",
        instructions: "Loop over legal_moves() and return the one starting on a2.",
        codeMustInclude: ["for ", "startswith"],
      },
    ],
  },
  {
    id: "api-take-piece",
    track: "programming",
    stage: STAGE,
    name: "Spot a Capture",
    concept: "Capture",
    difficulty: "beginner",
    mission: "Capture the black queen. Work out which move lands on her.",
    fen: "4k3/8/8/3q4/8/8/8/3R2K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ['The queen stands on d5.', "A capture is a move whose destination (m[2:4]) equals d5."],
    solution: ["d1d5"],
    explanation:
      "A UCI move is from-square + to-square, so a move's destination is m[2:4]. Finding the move whose destination holds an enemy piece is how a program finds a capture.",
    learningObjectives: ["Slice a move string", "Detect a capture by destination"],
    expandKnowledge: ["piece_at(square) tells you what stands there; lower-case means black."],
    steps: ['for m in game.legal_moves():', '    if m[2:4] == "d5": return m'],
    codeExplanation: "m[2:4] is the destination square — here the queen's square.",
    lineNotes: ["Your program sliced the destination and captured the queen."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        if m[2:4] == "d5":
            return m
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        if m[2:4] == "d5":
            return m
`,
    codeWalkthrough: [
      { code: `m[2:4]`, caption: "Characters 2 and 3 of a UCI move are the destination square." },
      { code: `== "d5"`, caption: "The target square where the black queen stands." },
      { code: `return m`, caption: "Playing it captures the queen." },
    ],
    guidedSteps: [
      {
        title: "Target the destination",
        instructions: "Return the move whose destination is d5.",
        codeMustInclude: ["[2:4]"],
      },
    ],
  },
  {
    id: "api-take-highest",
    track: "programming",
    stage: STAGE,
    name: "Take the Valuable Piece",
    concept: "Choosing",
    difficulty: "beginner",
    mission: "Your knight can take a pawn or a queen. Take the queen.",
    fen: "4k3/8/5p2/6q1/4N3/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The queen is on g5; the pawn is on f6.", "Use a value table and pick the best target."],
    solution: ["e4g5"],
    explanation: "Not all captures are equal. Comparing the value of the target turns \"find a capture\" into \"find the best capture\".",
    learningObjectives: ["Compare capture targets by value", "Return the best move"],
    expandKnowledge: ["This is the seed of a real evaluation function."],
    steps: ['values = {"p":1,"n":3,"b":3,"r":5,"q":9,"k":0}', "Choose the move whose target has the highest value."],
    codeExplanation: "The program scores each destination and keeps the best.",
    lineNotes: ["Your program valued the targets and chose the queen."],
    starterCode: {
      python: `def move(game):
    values = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}
    best = None
    best_value = 0
    for m in game.legal_moves():
        piece = game.piece_at(m[2:4]).lower()
        if piece and values[piece] > best_value:
            best_value = values[piece]
            best = m
    return best
`,
    },
    solutionCode: `def move(game):
    values = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}
    best = None
    best_value = 0
    for m in game.legal_moves():
        piece = game.piece_at(m[2:4]).lower()
        if piece and values[piece] > best_value:
            best_value = values[piece]
            best = m
    return best
`,
    codeWalkthrough: [
      { code: `piece = game.piece_at(m[2:4]).lower()`, caption: "What (if anything) stands on the destination?" },
      { code: `if piece and values[piece] > best_value:`, caption: "Only captures, and only if worth more than the best so far." },
      { code: `best_value = values[piece]; best = m`, caption: "Remember the winner." },
      { code: `return best`, caption: "Play the highest-value capture." },
    ],
    guidedSteps: [
      {
        title: "Score the captures",
        instructions: "Use a value table to take the most valuable piece.",
        codeMustInclude: ["piece_at", "values"],
      },
    ],
  },
  {
    id: "api-check-detect",
    track: "programming",
    stage: STAGE,
    name: "Detect the Check",
    concept: "apply + in_check",
    difficulty: "beginner",
    mission: "Play the rook move that gives check to the black king.",
    fen: "7k/8/8/8/8/8/R7/5K2 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["game.apply(m) returns the position after m.", "Test after.in_check() to see if your move gave check."],
    solution: ["a2a8"],
    explanation:
      "game.apply(move) plays a move on a copy of the board and hands the new Game back. Asking whether the enemy king is in check after each candidate is how a program finds checking moves — no hard-coding required.",
    learningObjectives: ["Simulate a move with apply()", "Detect check on the resulting position"],
    expandKnowledge: ["Simulation like this is the foundation of every engine search."],
    steps: ["for m in game.legal_moves():", "    after = game.apply(m)", "    if after.in_check(): return m"],
    codeExplanation: "apply() is the key: it lets your program look one move ahead.",
    lineNotes: ["Your program simulated each move and found the check."],
    starterCode: { python: CANDIDATE_LOOP },
    solutionCode: CANDIDATE_LOOP,
    codeWalkthrough: [
      { code: `for m in game.legal_moves():`, caption: "Try every legal move in turn." },
      { code: `after = game.apply(m)`, caption: "apply() plays m on a copy and returns the new position." },
      { code: `if after.in_check(): return m`, caption: "If the opponent is now in check, play that move." },
    ],
    guidedSteps: [
      {
        title: "Simulate the move",
        instructions: "Use game.apply(m) and after.in_check() to find the check.",
        codeMustInclude: ["apply(", "in_check("],
      },
    ],
  },
  {
    id: "api-mate-detect",
    track: "programming",
    stage: STAGE,
    name: "Detect the Mate",
    concept: "status()",
    difficulty: "intermediate",
    mission: "Play the move that checkmates the black king.",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["after.status() returns a dict with \"result\".", 'A mate has result == "checkmate" and it is the opponent to move.'],
    solution: ["a1a8"],
    explanation:
      "status() reports whether a position is checkmate, stalemate, a draw or still playing. A mate is a checkmate where the side to move is the opponent — exactly what status() tells you after applying your move.",
    learningObjectives: ["Read status() after applying a move", "Find a mate programmatically"],
    expandKnowledge: ["Mate detection = give check AND leave the opponent no legal move."],
    steps: ["after = game.apply(m)", 'if after.status()["result"] == "checkmate": return m'],
    codeExplanation: "The status dict holds the result string; \"checkmate\" is a finished game.",
    lineNotes: ["Your program checked the status after each move and found mate."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `after = game.apply(m)`, caption: "Simulate the candidate move." },
      { code: `after.status()["result"]`, caption: "The result of the position after your move." },
      { code: `== "checkmate"`, caption: "True only for a finished game — the mate." },
    ],
    guidedSteps: [
      {
        title: "Test for mate",
        instructions: "Apply each move and return the one whose status is checkmate.",
        codeMustInclude: ["apply(", "status("],
      },
    ],
  },
  {
    id: "api-any-mate",
    track: "programming",
    stage: STAGE,
    name: "Mate Hunter",
    concept: "Search",
    difficulty: "intermediate",
    mission: "Checkmate the cornered king in one move.",
    fen: "k7/7Q/1K6/8/8/8/8/8 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Reuse the mate-detection loop.", "Any move that leaves the enemy king mated wins."],
    solution: ["h7a7"],
    explanation: "The same mate-detection loop solves any \"mate in one\" position, because the program does not need to know which move mates — it tries them all.",
    learningObjectives: ["Reuse a search loop", "Trust the engine over hand analysis"],
    expandKnowledge: ["A program that tries all moves and keeps the mate is already a (slow) engine."],
    steps: ["Loop, apply, test status()[\"result\"] == \"checkmate\"."],
    codeExplanation: "Identical pattern to the previous lesson — that is the point.",
    lineNotes: ["The same mate-hunting loop found the finish here."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
`,
    codeWalkthrough: [
      { code: `for m in game.legal_moves():`, caption: "Try every move — the search is blind, but complete." },
      { code: `after.status()["result"] == "checkmate"`, caption: "Keep the one that ends the game." },
    ],
    guidedSteps: [
      {
        title: "Hunt the mate",
        instructions: "Find the checkmating move by simulation.",
        codeMustInclude: ["apply(", "status("],
      },
    ],
  },
  {
    id: "api-king-square",
    track: "programming",
    stage: STAGE,
    name: "Find the King",
    concept: "king_square()",
    difficulty: "beginner",
    mission: "Print both kings' squares, then attack the black king.",
    fen: "7k/8/8/8/8/8/8/K3Q3 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["game.king_square() gives the side-to-move king.", "game.king_square(False) is the black king."],
    solution: ["e1e8"],
    explanation: "king_square() returns where a king stands. Most attacks are aimed at the enemy king, so knowing its square is the starting point.",
    learningObjectives: ["Locate a king by colour", "Aim an attack at it"],
    expandKnowledge: ["Attacks on the king are what make forcing moves work."],
    steps: ["print(game.king_square(False))", "Return a checking move using apply()."],
    codeExplanation: "king_square(True) is white's king, king_square(False) is black's.",
    lineNotes: ["You located the king, then checked it."],
    starterCode: {
      python: `def move(game):
    print(game.king_square(False))
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
`,
    },
    solutionCode: `def move(game):
    print(game.king_square(False))
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
`,
    codeWalkthrough: [
      { code: `game.king_square(False)`, caption: "False asks for the black king — h8 here." },
      { code: `after.in_check()`, caption: "Every move that checks the black king is a candidate." },
      { code: `return m`, caption: "Play the first checking move." },
    ],
    guidedSteps: [
      {
        title: "Locate the king",
        instructions: "Print the black king's square, then return a checking move.",
        codeMustInclude: ["king_square"],
        expectedOutputIncludes: ["h8"],
      },
    ],
  },
  {
    id: "api-attacked-squares",
    track: "programming",
    stage: STAGE,
    name: "Attacked Squares",
    concept: "attacked_squares()",
    difficulty: "intermediate",
    mission: "Print where your pieces attack, then give check.",
    fen: "8/7B/8/8/k7/8/8/6K1 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["game.attacked_squares() lists every square white attacks.", "Your bishop can reach the king's diagonal."],
    solution: ["h7c2"],
    explanation: "attacked_squares() returns every square the side to move covers. It is the building block for safety checks and for spotting checks.",
    learningObjectives: ["List attacked squares", "Connect attack detection to checking"],
    expandKnowledge: ["\"Is my king attacked?\" is just membership in this list."],
    steps: ["print(len(game.attacked_squares()))", "Return a checking move."],
    codeExplanation: "The list length is a quick way to see your reach; the moves still come from legal_moves().",
    lineNotes: ["You listed your attacks, then found the check."],
    starterCode: {
      python: `def move(game):
    print(len(game.attacked_squares()))
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
`,
    },
    solutionCode: `def move(game):
    print(len(game.attacked_squares()))
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
`,
    codeWalkthrough: [
      { code: `game.attacked_squares()`, caption: "Every square your side attacks." },
      { code: `print(len(...))`, caption: "How many squares that is — a measure of your reach." },
      { code: `after.in_check()`, caption: "The checking move still comes from simulation." },
    ],
    guidedSteps: [
      {
        title: "List your attacks",
        instructions: "Print the number of attacked squares, then give check.",
        codeMustInclude: ["attacked_squares"],
      },
    ],
  },
  {
    id: "api-enumerate-captures",
    track: "programming",
    stage: STAGE,
    name: "Every Capture",
    concept: "Enumerate",
    difficulty: "intermediate",
    mission: "Print all of your captures, then take the knight.",
    fen: "4k3/8/5p2/6q1/4N3/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["A capture is a move whose destination holds an enemy piece.", "Collect them in a list and print it."],
    solution: ["e4g5"],
    explanation: "Enumerating every capture (not just the first) lets a program compare and choose — the difference between random play and strategy.",
    learningObjectives: ["Build a list of captures", "Inspect and print that list"],
    expandKnowledge: ["Sorting captures by value is the classic \"MVV-LVA\" ordering."],
    steps: ["Collect moves whose destination is occupied by black.", "Take the queen."],
    codeExplanation: "A move is a capture when the destination holds a lower-case (black) piece.",
    lineNotes: ["You enumerated the captures, then took the queen."],
    starterCode: {
      python: `def move(game):
    captures = []
    for m in game.legal_moves():
        target = game.piece_at(m[2:4])
        if target and target.islower():
            captures.append(m)
    print(captures)
    return captures[0] if captures else game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    values = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}
    best = None
    best_value = 0
    for m in game.legal_moves():
        target = game.piece_at(m[2:4])
        if target.islower() if target else False:
            if values[target] > best_value:
                best_value = values[target]
                best = m
    if best is None:
        captures = [m for m in game.legal_moves() if game.piece_at(m[2:4]).islower() and game.piece_at(m[2:4])]
        best = captures[0] if captures else game.legal_moves()[0]
    return best
`,
    codeWalkthrough: [
      { code: `target = game.piece_at(m[2:4])`, caption: "What stands on the destination?" },
      { code: `target and target.islower()`, caption: "A lower-case piece is black — so this is a capture." },
      { code: `captures.append(m)`, caption: "Collect them all in a list." },
    ],
    guidedSteps: [
      {
        title: "Collect the captures",
        instructions: "Build a list of every capture and print it, then take the queen.",
        codeMustInclude: ["append("],
      },
    ],
  },
];
