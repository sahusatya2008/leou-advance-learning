/**
 * Stage 6 — Endgames in Code.
 *
 * Promotion, underpromotion, stalemate and the simple mates: the program
 * computes the finish with the same apply()/status() tools.
 */
import type { TrainingLesson } from "../../training";

const STAGE = "Endgames in Code";

const PROMOTE = `def move(game):
    # Any move with a fifth character is a promotion.
    for m in game.legal_moves():
        if len(m) == 5:
            return m
    return game.legal_moves()[0]
`;

const MATE_LOOP = `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
    return game.legal_moves()[0]
`;

export const ENDGAME_LESSONS: TrainingLesson[] = [
  {
    id: "end-push-and-promote",
    track: "programming",
    stage: STAGE,
    name: "March and Promote",
    concept: "Promotion",
    difficulty: "beginner",
    mission: "Push the pawn to the eighth rank and promote it — the program must do it every turn.",
    fen: "7k/8/8/8/8/8/4P3/6K1 w - - 0 1",
    goal: { type: "promote" },
    par: 5,
    maxPlayerMoves: 5,
    replies: ["h8g8", "g8h8", "h8g8", "g8h8"],
    hints: ["Return the pawn's move each turn.", "The final move carries a promotion letter."],
    solution: ["e2e4", "e4e5", "e5e6", "e6e7", "e7e8q"],
    explanation:
      "The same program runs every turn. It finds the pawn and pushes it; when the pawn reaches the last rank it promotes automatically with a fifth letter.",
    learningObjectives: ["Write a program that works over many turns", "Detect a promotion move"],
    expandKnowledge: ["An engine does not memorise a sequence — it reads the board each turn."],
    steps: ["Find the pawn's square.", "Return a move from it; the final one promotes."],
    codeExplanation: "moves_from finds the pawn; a five-character move is a promotion.",
    lineNotes: [
      "The pawn advanced one square.",
      "It pushed again.",
      "Another push up the board.",
      "Now on the seventh rank.",
      "The pawn reached the last rank and promoted to a queen.",
    ],
    starterCode: {
      python: `def move(game):
    for square in ["e7", "e6", "e5", "e4", "e3", "e2"]:
        if game.piece_at(square) == "P":
            moves = game.moves_from(square)
            for m in moves:
                if len(m) == 5:
                    return m
            return moves[-1]
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    for square in ["e7", "e6", "e5", "e4", "e3", "e2"]:
        if game.piece_at(square) == "P":
            moves = game.moves_from(square)
            for m in moves:
                if len(m) == 5:
                    return m
            return moves[-1]
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `game.piece_at(square) == "P"`, caption: "Find the pawn, wherever it has marched to." },
      { code: `if len(m) == 5: return m`, caption: "If a promotion is available, take it." },
      { code: `return moves[-1]`, caption: "Otherwise push as far as possible — the double step first." },
    ],
    guidedSteps: [
      {
        title: "Find the pawn",
        instructions: "Return a move for the pawn on e2.",
        codeMustInclude: ["moves_from"],
      },
    ],
  },
  {
    id: "end-capture-then-promote",
    track: "programming",
    stage: STAGE,
    name: "Capture to Promote",
    concept: "Promotion",
    difficulty: "intermediate",
    mission: "Take the rook on d8 and promote in the same move.",
    fen: "3r4/2P5/8/7k/8/8/5K2/8 w - - 0 1",
    goal: { type: "promote" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The pawn on c7 can capture the rook on d8.", "The capture move is c7d8q."],
    solution: ["c7d8q"],
    explanation: "A pawn that captures onto the last rank promotes too. The program returns a promotion move — any five-character move — and takes the rook on the way.",
    learningObjectives: ["Promote by capture", "Return a promotion move"],
    expandKnowledge: ["Capturing to promote is often the strongest move on the board."],
    steps: ["Return the promotion capture c7d8q."],
    codeExplanation: "The five-character move both captures and promotes.",
    lineNotes: ["Your pawn captured the rook and promoted."],
    starterCode: { python: PROMOTE },
    solutionCode: PROMOTE,
    codeWalkthrough: [
      { code: `for m in game.legal_moves():`, caption: "Look through every move." },
      { code: `if len(m) == 5`, caption: "A five-character move promotes." },
      { code: `return m`, caption: "Playing it captures the rook and queens." },
    ],
    guidedSteps: [{ title: "Promote by capture", instructions: "Return the promotion move.", codeMustInclude: ["len("] }],
  },
  {
    id: "end-underpromote-check",
    track: "programming",
    stage: STAGE,
    name: "Underpromote to Check",
    concept: "Underpromotion",
    difficulty: "intermediate",
    mission: "Promote to a knight to give check.",
    fen: "8/1P1k4/8/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The king is on d7.", "A queen on b8 would not check the king — a knight does."],
    solution: ["b7b8n"],
    explanation:
      "Normally you promote to a queen, but sometimes another piece is stronger. Here only a knight on b8 checks the king on d7 — an underpromotion.",
    learningObjectives: ["Choose an underpromotion", "Find a checking promotion"],
    expandKnowledge: ["Underpromotion to knight is the most common kind, usually for a fork."],
    steps: ["Return b7b8n."],
    codeExplanation: "The promotion letter chooses the knight.",
    lineNotes: ["Your pawn underpromoted to a knight and gave check."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        if m == "b7b8n":
            return m
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        if m == "b7b8n":
            return m
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `m == "b7b8n"`, caption: "The knight promotion — the 'n' is the piece letter." },
      { code: `return m`, caption: "Play it and the king is in check." },
    ],
    guidedSteps: [{ title: "Underpromote", instructions: "Return the knight promotion.", codeMustInclude: ["b8n"] }],
  },
  {
    id: "end-rook-underpromote",
    track: "programming",
    stage: STAGE,
    name: "Promote to a Rook",
    concept: "Underpromotion",
    difficulty: "advanced",
    mission: "Promote to a rook — a queen would be stalemate.",
    fen: "8/1P5k/8/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "promote" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Only the rook promotion is legal to keep it simple.", "Return b7b8r."],
    solution: ["b7b8r"],
    explanation: "Promoting to a queen is usually right, but a rook can avoid a stalemate. The program simply returns the rook promotion.",
    learningObjectives: ["Promote to a rook", "Understand why the piece letter matters"],
    expandKnowledge: ["Choosing the promotion piece is a real endgame skill."],
    steps: ["Return b7b8r."],
    codeExplanation: "The final letter 'r' promotes to a rook.",
    lineNotes: ["Your pawn promoted to a rook."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        if m == "b7b8r":
            return m
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        if m == "b7b8r":
            return m
    return game.legal_moves()[0]
`,
    codeWalkthrough: [{ code: `m == "b7b8r"`, caption: "The rook promotion — 'r' is the piece letter." }],
    guidedSteps: [{ title: "Promote to rook", instructions: "Return the rook promotion.", codeMustInclude: ["b8r"] }],
  },
  {
    id: "end-promote-with-check",
    track: "programming",
    stage: STAGE,
    name: "Promotion with Check",
    concept: "Promotion",
    difficulty: "intermediate",
    mission: "Promote the pawn — the new queen checks the king.",
    fen: "8/4P3/8/8/8/8/8/4k2K w - - 0 1",
    goal: { type: "promote" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The pawn on e7 promotes on e8.", "The new queen lands on the e-file, checking the king on e1."],
    solution: ["e7e8q"],
    explanation: "Promoting with check is the ideal promotion: you gain a queen and force the opponent's reply at the same time.",
    learningObjectives: ["Promote with check", "Return a promotion move"],
    expandKnowledge: ["Promotion checks are decisive in most pawn races."],
    steps: ["Return e7e8q."],
    codeExplanation: "The promotion move gives check automatically.",
    lineNotes: ["Your pawn promoted with check."],
    starterCode: { python: PROMOTE },
    solutionCode: PROMOTE,
    codeWalkthrough: [{ code: `len(m) == 5`, caption: "The promotion move — here e7e8q, giving check." }],
    guidedSteps: [{ title: "Promote with check", instructions: "Return the promotion move.", codeMustInclude: ["len("] }],
  },
  {
    id: "end-simple-rook-mate",
    track: "programming",
    stage: STAGE,
    name: "Simple Rook Mate",
    concept: "Checkmate",
    difficulty: "intermediate",
    mission: "Checkmate with the rook in one move.",
    fen: "7k/8/6K1/8/8/8/8/R7 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Your king covers g7 and h7.", "The rook delivers the blow on the eighth rank."],
    solution: ["a1a8"],
    explanation: "With the enemy king trapped on the edge and your king guarding the escape squares, a rook on the eighth rank is mate. The program finds it by testing status().",
    learningObjectives: ["Mate with king and rook", "Detect mate by simulation"],
    expandKnowledge: ["King and rook versus king is always won — you saw the final pattern here."],
    steps: ["Loop, apply, find a move whose status is checkmate."],
    codeExplanation: "Mate detection is the same loop every time.",
    lineNotes: ["Your rook delivered mate on the back rank."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [
      { code: `after.status()["result"]`, caption: "Read the result after the move." },
      { code: `== "checkmate"`, caption: "A finished game — the mate." },
    ],
    guidedSteps: [{ title: "Find the mate", instructions: "Return the rook move that mates.", codeMustInclude: ["status("] }],
  },
  {
    id: "end-kq-mate",
    track: "programming",
    stage: STAGE,
    name: "Queen Mate",
    concept: "Checkmate",
    difficulty: "intermediate",
    mission: "Checkmate with the queen in one move.",
    fen: "7k/8/6K1/8/8/8/8/2Q5 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Your king guards the escape squares.", "Bring the queen to the eighth rank."],
    solution: ["c1c8"],
    explanation: "A queen on the back rank mates a king trapped by your own king. The program finds it by simulation.",
    learningObjectives: ["Mate with queen and king", "Reuse mate detection"],
    expandKnowledge: ["Queen and king versus king is the easiest mate to learn first."],
    steps: ["Return a move whose status is checkmate."],
    codeExplanation: "Same mate loop, different pieces.",
    lineNotes: ["Your queen delivered mate."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "Finds the queen's mating move." }],
    guidedSteps: [{ title: "Queen mate", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
  {
    id: "end-capture-into-mate",
    track: "programming",
    stage: STAGE,
    name: "Capture into Mate",
    concept: "Checkmate",
    difficulty: "advanced",
    mission: "Take the queen and checkmate in one move.",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1KN1R w KQkq - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Your queen on h5 can take on f7.", "That is Scholar's Mate."],
    solution: ["h5f7"],
    explanation: "The queen captures the f7 pawn and delivers checkmate — the famous Scholar's Mate. The program does not need the name; it only needs status().",
    learningObjectives: ["Find a mate that is also a capture", "Trust the search"],
    expandKnowledge: ["Scholar's Mate punishes a careless defence of f7."],
    steps: ["Return a move whose status is checkmate."],
    codeExplanation: "The capture and the mate are the same move.",
    lineNotes: ["Your queen captured on f7 — mate."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "The capture on f7 mates." }],
    guidedSteps: [{ title: "Mate the king", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
  {
    id: "end-create-stalemate",
    track: "programming",
    stage: STAGE,
    name: "Create Stalemate",
    concept: "Stalemate",
    difficulty: "advanced",
    mission: "Trap the king with no legal move — without giving check.",
    fen: "7k/5K2/Q7/8/8/8/8/8 w - - 0 1",
    goal: { type: "stalemate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Stalemate is status result \"stalemate\".", "The queen must take away the last squares without checking."],
    solution: ["a6d3"],
    explanation:
      "Stalemate is a draw: the opponent has no legal move and is not in check. status() reports it just like checkmate, so the same loop finds it.",
    learningObjectives: ["Detect stalemate", "Draw a lost game with no check"],
    expandKnowledge: ["Stalemate is the defender's best friend — always check for it before moving."],
    steps: ["Loop, apply, look for result == \"stalemate\"."],
    codeExplanation: "Same loop as mate detection, different result string.",
    lineNotes: ["Your queen took away the last escape and stalemated the king."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "stalemate":
            return m
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "stalemate":
            return m
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `after.status()["result"]`, caption: "The position after the candidate move." },
      { code: `== "stalemate"`, caption: "No legal move and not in check — a draw the defender wants." },
    ],
    guidedSteps: [{ title: "Stalemate", instructions: "Return a move that leaves the king stalemated.", codeMustInclude: ["stalemate"] }],
  },
  {
    id: "end-stalemate-corner",
    track: "programming",
    stage: STAGE,
    name: "Corner Stalemate",
    concept: "Stalemate",
    difficulty: "advanced",
    mission: "Stalemate the king in the corner.",
    fen: "k7/8/1K3N2/8/8/8/8/8 w - - 0 1",
    goal: { type: "stalemate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The king on a8 is boxed by your king on b6.", "The knight must cover b8."],
    solution: ["f6d7"],
    explanation: "The knight takes the last flight square without checking. Classic corner stalemate — found by the same status() test.",
    learningObjectives: ["Stalemate with a knight", "Find the cover square"],
    expandKnowledge: ["Knights are excellent stalemating pieces because they cover awkward squares."],
    steps: ["Loop, apply, look for result == \"stalemate\"."],
    codeExplanation: "The knight's move removes the final escape square.",
    lineNotes: ["Your knight stalemated the cornered king."],
    starterCode: {
      python: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "stalemate":
            return m
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "stalemate":
            return m
    return game.legal_moves()[0]
`,
    codeWalkthrough: [{ code: `after.status()["result"] == "stalemate"`, caption: "The knight covers b8 — no legal move, no check." }],
    guidedSteps: [{ title: "Corner stalemate", instructions: "Return a move that leaves the king stalemated.", codeMustInclude: ["stalemate"] }],
  },
  {
    id: "end-rook-mate-ladder",
    track: "programming",
    stage: STAGE,
    name: "Rook Ladder",
    concept: "Checkmate",
    difficulty: "advanced",
    mission: "Build the ladder: check, then mate.",
    fen: "3k4/2R5/2K5/8/8/8/8/7R w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Your rook on c7 already gives the king no room.", "Move the other rook to the eighth rank."],
    solution: ["h1h8"],
    explanation: "Two rooks mate by alternating checks along ranks — the 'ladder'. Here one rook already fences the king, and the second delivers mate on the back rank.",
    learningObjectives: ["Mate with a rook on the back rank", "Recognise the ladder pattern"],
    expandKnowledge: ["Two rooks always win against a lone king — this is the pattern."],
    steps: ["Return the mate move."],
    codeExplanation: "The second rook lands on h8 for the finish.",
    lineNotes: ["Your rooks built the ladder and delivered mate."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "The ladder mate on the eighth rank." }],
    guidedSteps: [{ title: "Ladder mate", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
];
