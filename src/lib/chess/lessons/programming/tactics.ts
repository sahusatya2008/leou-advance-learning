/**
 * Stage 4 — Tactics in Code.
 *
 * Fork, pin, skewer and discovered attack: the program finds each by scoring
 * the position after the candidate move, using game.apply().
 */
import type { TrainingLesson } from "../../training";

const STAGE = "Tactics in Code";

const CAPTURE_TARGET = (target: string) => `def move(game):
    for m in game.legal_moves():
        if m[2:4] == ${JSON.stringify(target)}:
            return m
    return game.legal_moves()[0]
`;

const FORK = `def move(game):
    # A fork attacks the king and wins material once the king moves.
    for m in game.legal_moves():
        after = game.apply(m)
        if after is None:
            continue
        if after.in_check() and len(after.legal_moves()) > 1:
            return m
    return game.legal_moves()[0]
`;

export const TACTICS_LESSONS: TrainingLesson[] = [
  {
    id: "tac-fork-rook",
    track: "programming",
    stage: STAGE,
    name: "Knight Fork",
    concept: "Fork",
    difficulty: "intermediate",
    mission: "Fork the king and win the rook with your knight.",
    fen: "8/1P1k4/2r5/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["d7d8"],
    hints: ["A knight that checks the king often attacks another piece.", "Promote first, then fork."],
    solution: ["b7b8n", "b8c6"],
    explanation:
      "A fork attacks two targets at once. Here underpromoting to a knight with check, then jumping to c6, attacks the rook — a fork the king cannot defend against.",
    learningObjectives: ["Underpromote to a knight", "Recognise a fork that wins material"],
    expandKnowledge: ["Queening would not check the king on d7 — the knight is the only piece that forks."],
    steps: ["Promote to a knight (b8n) with check.", "Follow up with c6, forking king and rook."],
    codeExplanation: "The program returns a different move on each turn: first the promotion, then the fork.",
    lineNotes: ["You underpromoted to a knight with check.", "The knight jumped to c6, forking the king and rook."],
    starterCode: {
      python: `def move(game):
    # Turn 1: promote the pawn (a knight gives check here).
    # Turn 2: fork with the knight.
    for m in game.moves_from("b7"):
        return m
    for m in game.moves_from("b8"):
        return m
`,
    },
    solutionCode: `def move(game):
    if game.piece_at("b7") == "P":
        return "b7b8n"
    return "b8c6"
`,
    codeWalkthrough: [
      { code: `game.piece_at("b7") == "P"`, caption: "Is the pawn still on b7? Then it is turn one." },
      { code: `return "b7b8n"`, caption: "Underpromote to a knight — and give check." },
      { code: `return "b8c6"`, caption: "Next turn, the knight forks king and rook." },
    ],
    guidedSteps: [
      {
        title: "Promote with check",
        instructions: "Return the b7 promotion to a knight.",
        codeMustInclude: ["b7b8n"],
      },
    ],
  },
  {
    id: "tac-fork-check",
    track: "programming",
    stage: STAGE,
    name: "Fork the King",
    concept: "Fork",
    difficulty: "intermediate",
    mission: "Give check and attack the queen in the same move.",
    fen: "4k1q1/8/8/8/4N3/8/8/2K5 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The knight on e4 reaches f6.", "f6 touches both the king and the queen."],
    solution: ["e4f6"],
    explanation: "Nf6+ checks the king and attacks the queen together — the classic knight fork. The program finds a checking move; the fork is the bonus.",
    learningObjectives: ["Find a checking knight move", "See how a check wins a second piece"],
    expandKnowledge: ["After the king moves, the knight takes the queen."],
    steps: ["Loop, apply, return a move that gives check."],
    codeExplanation: "Any checking move already attacks the king; the fork is free.",
    lineNotes: ["Your knight gave check and attacked the queen."],
    starterCode: { python: FORK },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.in_check():
            return m
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `after.in_check()`, caption: "Moves that check the king." },
      { code: `len(after.legal_moves()) > 1`, caption: "A king with replies left — so it is the knight fork." },
      { code: `return m`, caption: "Play the fork." },
    ],
    guidedSteps: [{ title: "Fork the king", instructions: "Find a knight move that gives check.", codeMustInclude: ["in_check("] }],
  },
  {
    id: "tac-pin-wins",
    track: "programming",
    stage: STAGE,
    name: "Take the Pinned Piece",
    concept: "Pin",
    difficulty: "intermediate",
    mission: "Take the pinned knight.",
    fen: "4k3/4n3/8/5N2/8/8/8/4R1K1 w - - 0 1",
    goal: { type: "capture", piece: "n" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The knight on e7 is pinned to its king.", "Your rook on e1 takes up the file."],
    solution: ["e1e7"],
    explanation: "A pinned piece cannot move without exposing its king. That means it is effectively frozen — and free to capture if undefended.",
    learningObjectives: ["Recognise a pin", "Capture a pinned, undefended piece"],
    expandKnowledge: ["Pins are a kind of invisibility: the victim cannot run away."],
    steps: ["Return the move ending on e7."],
    codeExplanation: "The pinned knight on e7 is the target.",
    lineNotes: ["Your rook took the pinned knight."],
    starterCode: { python: CAPTURE_TARGET("e7") },
    solutionCode: CAPTURE_TARGET("e7"),
    codeWalkthrough: [{ code: `m[2:4] == "e7"`, caption: "The pinned knight's square." }],
    guidedSteps: [{ title: "Take the pin", instructions: "Capture on e7.", codeMustInclude: ["[2:4]"] }],
  },
  {
    id: "tac-skewer",
    track: "programming",
    stage: STAGE,
    name: "Skewer the Queen",
    concept: "Skewer",
    difficulty: "intermediate",
    mission: "Skewer the king to win the queen.",
    fen: "8/8/8/2k4q/8/8/8/R4K2 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["c5b6"],
    hints: ["Line the rook up with the king so the queen is behind it.", "After the king steps aside, take the queen."],
    solution: ["a1a5", "a5h5"],
    explanation:
      "A skewer attacks a valuable piece so it must move, exposing a less valuable one behind. Your rook checks the king on a5; when the king steps away, the queen on h5 is lost.",
    learningObjectives: ["Set up a skewer", "Follow the king's forced move with a capture"],
    expandKnowledge: ["Pins and skewers are mirror images: the valuable piece is in front in a skewer."],
    steps: ["Ra5+ skewers the king and queen.", "When the king steps aside, capture the queen."],
    codeExplanation: "Turn one aligns the rook; turn two takes the exposed queen.",
    lineNotes: ["Your rook checked the king on a5.", "The king stepped aside and you took the queen."],
    starterCode: {
      python: `def move(game):
    if game.piece_at("a5") == "R":
        return "a5h5"
    return "a1a5"
`,
    },
    solutionCode: `def move(game):
    if game.piece_at("a5") == "R":
        return "a5h5"
    return "a1a5"
`,
    codeWalkthrough: [
      { code: `return "a1a5"`, caption: "Step one: the rook goes to a5 with check, skewering the queen." },
      { code: `game.piece_at("a5") == "R"`, caption: "Turn two: the rook is already on a5." },
      { code: `return "a5h5"`, caption: "So capture the queen." },
    ],
    guidedSteps: [{ title: "Skewer", instructions: "Play the rook move that checks the king.", codeMustInclude: ["a1a5"] }],
  },
  {
    id: "tac-discovered",
    track: "programming",
    stage: STAGE,
    name: "Discovered Check",
    concept: "Discovered attack",
    difficulty: "intermediate",
    mission: "Move the knight so the rook gives check.",
    fen: "4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1",
    goal: { type: "check" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The rook on e1 checks along the e-file.", "The knight on e4 blocks it — move the knight."],
    solution: ["e4c5"],
    explanation: "A discovered attack moves one piece out of the way of another. Moving the knight off the e-file uncovers the rook's check.",
    learningObjectives: ["Understand discovered attacks", "Move a blocker to open a line"],
    expandKnowledge: ["Discovered checks are powerful because the moving piece can also attack something."],
    steps: ["Move the knight off the e-file."],
    codeExplanation: "The knight must leave e4 so the rook's file to the king opens.",
    lineNotes: ["Moving the knight uncovered the rook's check."],
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
      { code: `after.in_check()`, caption: "Only the knight move that uncovers the rook checks." },
      { code: `return m`, caption: "Play it." },
    ],
    guidedSteps: [{ title: "Uncover the check", instructions: "Return a move that gives discovered check.", codeMustInclude: ["in_check("] }],
  },
  {
    id: "tac-discovered-capture",
    track: "programming",
    stage: STAGE,
    name: "Discovered Capture",
    concept: "Discovered attack",
    difficulty: "intermediate",
    mission: "Move the knight to attack the pawn while the rook watches the king.",
    fen: "4k3/8/8/6p1/4N3/8/8/4R1K1 w - - 0 1",
    goal: { type: "capture", piece: "p" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The pawn is on g5.", "The knight can take it."],
    solution: ["e4g5"],
    explanation: "A discovered attack can also win material: the knight moves to take the pawn while the rook's pressure on the king pins the defence.",
    learningObjectives: ["Combine a capture with a discovered threat", "Find a capture by destination"],
    expandKnowledge: ["Discovered attacks often win a piece because the opponent must answer the check first."],
    steps: ["Return the move ending on g5."],
    codeExplanation: "The knight's capture of the pawn is the move.",
    lineNotes: ["Your knight captured the pawn."],
    starterCode: { python: CAPTURE_TARGET("g5") },
    solutionCode: CAPTURE_TARGET("g5"),
    codeWalkthrough: [{ code: `m[2:4] == "g5"`, caption: "The pawn on g5." }],
    guidedSteps: [{ title: "Discovered capture", instructions: "Capture on g5.", codeMustInclude: ["[2:4]"] }],
  },
  {
    id: "tac-royal-fork",
    track: "programming",
    stage: STAGE,
    name: "Royal Fork",
    concept: "Fork",
    difficulty: "advanced",
    mission: "Fork king and queen, then take the queen.",
    fen: "q3k3/8/4N3/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["e8d8"],
    hints: ["The queen is on a8, the king on e8.", "A knight jumping to c7 attacks both."],
    solution: ["e6c7", "c7a8"],
    explanation:
      "The royal fork: a knight attacks the king and the queen at once. The king must move, then the knight takes the queen. The program plays the fork, then the capture.",
    learningObjectives: ["Play a two-move combination", "Fork king and queen"],
    expandKnowledge: ["This is the most common way to win a queen from a fork."],
    steps: ["Nc7+ forks king and queen.", "After the king moves, Nxa8 takes the queen."],
    codeExplanation: "Two turns, two moves — the program returns the right one each time.",
    lineNotes: ["Your knight forked the king and queen.", "The king moved and your knight took the queen."],
    starterCode: {
      python: `def move(game):
    if game.piece_at("c7") == "N":
        return "c7a8"
    return "e6c7"
`,
    },
    solutionCode: `def move(game):
    if game.piece_at("c7") == "N":
        return "c7a8"
    return "e6c7"
`,
    codeWalkthrough: [
      { code: `return "e6c7"`, caption: "The royal fork — check." },
      { code: `game.piece_at("c7") == "N"`, caption: "Next turn: the knight is already on c7." },
      { code: `return "c7a8"`, caption: "So take the queen." },
    ],
    guidedSteps: [{ title: "Royal fork", instructions: "Play the knight fork.", codeMustInclude: ["e6c7"] }],
  },
  {
    id: "tac-double-attack",
    track: "programming",
    stage: STAGE,
    name: "Double Attack",
    concept: "Double attack",
    difficulty: "advanced",
    mission: "Attack king and rook at once, then win the rook.",
    fen: "k6r/8/8/8/8/8/8/K3Q3 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["a8b7"],
    hints: ["The rook sits on h8, the king on a8.", "Your queen can reach the eighth rank."],
    solution: ["e1e8", "e8h8"],
    explanation: "A queen on the eighth rank checks the king and attacks the rook simultaneously — a double attack that wins the rook next move.",
    learningObjectives: ["Create a double attack with the queen", "Convert the check into material"],
    expandKnowledge: ["Double attacks on king and piece are the bread and butter of tactics."],
    steps: ["Qe8+ attacks king and rook.", "After the king moves, Qxh8."],
    codeExplanation: "Two turns: the check, then the capture.",
    lineNotes: ["Your queen gave check and attacked the rook.", "The king moved; the rook fell."],
    starterCode: {
      python: `def move(game):
    if game.piece_at("e8") == "Q":
        return "e8h8"
    return "e1e8"
`,
    },
    solutionCode: `def move(game):
    if game.piece_at("e8") == "Q":
        return "e8h8"
    return "e1e8"
`,
    codeWalkthrough: [
      { code: `return "e1e8"`, caption: "The queen lands on the eighth rank with check." },
      { code: `game.piece_at("e8") == "Q"`, caption: "Next turn, the queen is already on e8." },
      { code: `return "e8h8"`, caption: "So capture the rook." },
    ],
    guidedSteps: [{ title: "Double attack", instructions: "Play the queen move that gives check.", codeMustInclude: ["e1e8"] }],
  },
];
