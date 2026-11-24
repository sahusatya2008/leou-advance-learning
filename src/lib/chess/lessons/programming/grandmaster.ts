/**
 * Stage 8 — Code Grandmaster Trials.
 *
 * The hardest programming lessons: real combinations, some spanning several
 * turns, solved by a program that must keep working on every turn. Several are
 * deliberately multi-move so the student sees a strategy run, not a one-liner.
 */
import type { TrainingLesson } from "../../training";

const STAGE = "Code Grandmaster Trials";

const MATE_LOOP = `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
    return game.legal_moves()[0]
`;

const CAPTURE_LOOP = (target: string) => `def move(game):
    for m in game.legal_moves():
        if m[2:4] == ${JSON.stringify(target)}:
            return m
    return game.legal_moves()[0]
`;

export const GRANDMASTER_LESSONS: TrainingLesson[] = [
  {
    id: "gm-smothered",
    track: "programming",
    stage: STAGE,
    name: "Smothered Mate",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Checkmate the king walled in by its own pieces.",
    fen: "6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The king is surrounded by its rook and pawns.", "A knight check on f7 cannot be taken."],
    solution: ["e5f7"],
    explanation: "The knight checks from f7, a square nothing can reach. With the king's own rook and pawns blocking the escapes, it is mate — the smothered mate.",
    learningObjectives: ["Deliver a smothered mate in code", "See how enemy pieces become walls"],
    expandKnowledge: ["Philidor's Legacy forces this pattern with a queen sacrifice."],
    steps: ["Loop, apply, return a mate move."],
    codeExplanation: "The mate loop finds the knight's smothered mate without naming it.",
    lineNotes: ["Your knight smothered the king for mate."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "The knight's check is unstoppable — mate." }],
    guidedSteps: [{ title: "Smothered mate", instructions: "Return the mating knight move.", codeMustInclude: ["status("] }],
  },
  {
    id: "gm-deflection-sacrifice",
    track: "programming",
    stage: STAGE,
    name: "Deflection Sacrifice",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Deflect the rook with a sacrifice — then mate.",
    fen: "3Q2rk/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    goal: { type: "mate" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["h8g8"],
    hints: ["Sacrifice the queen on g8 to pull the rook away.", "Then the back rank is open for mate."],
    solution: ["d8g8", "a1a8"],
    explanation:
      "A deflection sacrifice: the queen gives itself up on g8, dragging the rook off h8. Once the rook leaves, the back-rank mate is unstoppable. The program plays each move of the combination on its own turn.",
    learningObjectives: ["Execute a two-move combination", "Carry a plan across turns"],
    expandKnowledge: ["Sacrifices that decoy a defender are the classic mating mechanism."],
    steps: ["Qxg8+ forces the rook to recapture.", "Then Ra8 is mate."],
    codeExplanation: "Turn one sacrifices; turn two mates once the defender has moved.",
    lineNotes: ["Your queen sacrificed itself on g8, deflecting the rook.", "With h8 cleared, your rook delivered mate."],
    starterCode: {
      python: `def move(game):
    # Turn 1: sacrifice the queen on g8. Turn 2: mate on the back rank.
    for m in game.moves_from("d8"):
        return m
    return "a1a8"
`,
    },
    solutionCode: `def move(game):
    for m in game.legal_moves():
        after = game.apply(m)
        if after is not None and after.status()["result"] == "checkmate":
            return m
    return "d8g8"
`,
    codeWalkthrough: [
      { code: `after.status()["result"] == "checkmate"`, caption: "No immediate mate exists yet." },
      { code: `return "d8g8"`, caption: "So play the deflection sacrifice." },
      { code: `after.status()... == "checkmate"`, caption: "Next turn, the mate is found automatically." },
    ],
    guidedSteps: [{ title: "Sacrifice", instructions: "Play the queen sacrifice on g8.", codeMustInclude: ["d8g8"] }],
  },
  {
    id: "gm-ladder",
    track: "programming",
    stage: STAGE,
    name: "Two-Rook Ladder",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Build the ladder with your rooks — check, then mate.",
    fen: "4k3/8/8/8/8/8/8/K4R1R w - - 0 1",
    goal: { type: "mate" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["e8d8"],
    hints: ["First rook climbs to the seventh rank with check.", "Then the other rook mates on the eighth."],
    solution: ["f1f7", "h1h8"],
    explanation:
      "The two-rook ladder: one rook checks on the seventh rank, pushing the king to the eighth; the other then mates along the back rank.",
    learningObjectives: ["Alternate rooks to drive the king", "Finish with a back-rank mate"],
    expandKnowledge: ["The ladder is the fastest way two rooks mate a lone king."],
    steps: ["Rf7+ pushes the king.", "Rh8# ends it."],
    codeExplanation: "The program checks with the first rook, then mates with the second.",
    lineNotes: ["Your first rook climbed to the seventh with check.", "Your second rook delivered mate on the eighth rank."],
    starterCode: {
      python: `def move(game):
    if game.piece_at("f1") == "R":
        return "f1f7"
    return "h1h8"
`,
    },
    solutionCode: `def move(game):
    if game.piece_at("f1") == "R":
        return "f1f7"
    return "h1h8"
`,
    codeWalkthrough: [
      { code: `if game.piece_at("f1") == "R"`, caption: "Turn one: the first rook is still on f1." },
      { code: `return "f1f7"`, caption: "Check on the seventh rank." },
      { code: `return "h1h8"`, caption: "Turn two: mate on the back rank." },
    ],
    guidedSteps: [{ title: "Start the ladder", instructions: "Play the rook check on the seventh rank.", codeMustInclude: ["f1f7"] }],
  },
  {
    id: "gm-royal-fork",
    track: "programming",
    stage: STAGE,
    name: "Win the Queen",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Fork the king and queen, then take the queen.",
    fen: "q3k3/8/4N3/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["e8d8"],
    hints: ["The knight on e6 can jump to c7.", "c7 attacks both the king and the queen on a8."],
    solution: ["e6c7", "c7a8"],
    explanation: "The royal fork: Nc7+ hits king and queen together. After the forced king move, the knight takes the queen. Two turns, one program.",
    learningObjectives: ["Fork across two turns", "Convert a fork into material"],
    expandKnowledge: ["Forking the king is the surest way to win any piece."],
    steps: ["Nc7+ forks.", "Then Nxa8 wins the queen."],
    codeExplanation: "Turn one forks; turn two captures once the king has moved.",
    lineNotes: ["Your knight forked king and queen.", "The king moved, and you took the queen."],
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
      { code: `return "e6c7"`, caption: "The royal fork." },
      { code: `game.piece_at("c7") == "N"`, caption: "Next turn: the knight is already on c7." },
      { code: `return "c7a8"`, caption: "So take the queen." },
    ],
    guidedSteps: [{ title: "Fork", instructions: "Play the knight fork.", codeMustInclude: ["e6c7"] }],
  },
  {
    id: "gm-skewer",
    track: "programming",
    stage: STAGE,
    name: "Skewer Mastery",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Skewer the king to win the queen.",
    fen: "8/8/8/2k4q/8/8/8/R4K2 w - - 0 1",
    goal: { type: "capture", piece: "q" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["c5b6"],
    hints: ["Line the rook up with the king.", "The queen is behind the king on the same rank."],
    solution: ["a1a5", "a5h5"],
    explanation: "The rook checks the king on a5; the king must step aside, exposing the queen on h5. That is a skewer — the mirror image of a pin.",
    learningObjectives: ["Set up a skewer", "Capture the exposed piece"],
    expandKnowledge: ["Pins and skewers differ only in which piece is in front."],
    steps: ["Ra5+ skewers.", "Then Rxh5."],
    codeExplanation: "The program checks, then takes the queen that could not move away.",
    lineNotes: ["Your rook checked the king on a5, skewering the queen.", "The king moved and you took the queen."],
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
      { code: `return "a1a5"`, caption: "The skewering check." },
      { code: `game.piece_at("a5") == "R"`, caption: "The rook is already on a5." },
      { code: `return "a5h5"`, caption: "So capture the queen." },
    ],
    guidedSteps: [{ title: "Skewer", instructions: "Play the rook check.", codeMustInclude: ["a1a5"] }],
  },
  {
    id: "gm-double-attack",
    track: "programming",
    stage: STAGE,
    name: "Queen Double Attack",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Attack king and rook, then win the rook.",
    fen: "k6r/8/8/8/8/8/8/K3Q3 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["a8b7"],
    hints: ["The rook is on h8.", "The queen can reach the eighth rank with check."],
    solution: ["e1e8", "e8h8"],
    explanation: "From e8 the queen checks the king and attacks the rook on h8. The king must move, and the rook falls — a double attack.",
    learningObjectives: ["Create a double attack", "Convert check into material"],
    expandKnowledge: ["Double attacks win material because the opponent can only fix one threat."],
    steps: ["Qe8+ attacks both.", "Then Qxh8."],
    codeExplanation: "The program checks, then takes the rook.",
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
      { code: `return "e1e8"`, caption: "The double-attacking check." },
      { code: `game.piece_at("e8") == "Q"`, caption: "The queen is already on e8." },
      { code: `return "e8h8"`, caption: "So capture the rook." },
    ],
    guidedSteps: [{ title: "Double attack", instructions: "Play the queen check.", codeMustInclude: ["e1e8"] }],
  },
  {
    id: "gm-underpromotion-fork",
    track: "programming",
    stage: STAGE,
    name: "Underpromotion Fork",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Underpromote to a knight with check, then fork the rook.",
    fen: "8/1P1k4/2r5/8/8/8/8/6K1 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["d7d8"],
    hints: ["A knight on b8 checks the king on d7 — a queen would not.", "Then the knight forks king and rook from c6."],
    solution: ["b7b8n", "b8c6"],
    explanation:
      "The grandest underpromotion: promote to a knight to give check, then use the knight to fork the king and rook. The program recognises it must pick the knight promotion.",
    learningObjectives: ["Underpromote with purpose", "Follow up forking"],
    expandKnowledge: ["This is why 'queen everything' is sometimes wrong — the knight is a fork machine."],
    steps: ["Promote to a knight (b8n) with check.", "Then Nc6 forks."],
    codeExplanation: "A knight promotion gives the check; the next turn the fork wins the rook.",
    lineNotes: ["Your pawn underpromoted to a knight and gave check.", "The knight forked the king and rook."],
    starterCode: {
      python: `def move(game):
    if game.piece_at("b7") == "P":
        return "b7b8n"
    return "b8c6"
`,
    },
    solutionCode: `def move(game):
    if game.piece_at("b7") == "P":
        return "b7b8n"
    return "b8c6"
`,
    codeWalkthrough: [
      { code: `game.piece_at("b7") == "P"`, caption: "Turn one: the pawn is ready to promote." },
      { code: `return "b7b8n"`, caption: "Underpromote to a knight — check." },
      { code: `return "b8c6"`, caption: "Turn two: the fork wins the rook." },
    ],
    guidedSteps: [{ title: "Underpromote", instructions: "Play the knight promotion.", codeMustInclude: ["b8n"] }],
  },
  {
    id: "gm-promotion-deflection",
    track: "programming",
    stage: STAGE,
    name: "Promotion Deflection",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Deflect the rook from a8, then promote.",
    fen: "r6k/P7/8/8/8/8/8/3Q2K1 w - - 0 1",
    goal: { type: "promote" },
    par: 2,
    maxPlayerMoves: 2,
    replies: ["a8d8"],
    hints: ["The rook on a8 guards the promotion square.", "Deflect it with a queen check on the eighth rank."],
    solution: ["d1d8", "a7a8q"],
    explanation:
      "A promotion deflection: Qd8+ forces the rook to leave a8 to block or capture, and then the pawn queens. The program checks first, then promotes.",
    learningObjectives: ["Deflect a blockader", "Promote on the next turn"],
    expandKnowledge: ["Deflection is the standard way to clear a promotion square."],
    steps: ["Qd8+ drags the rook away.", "Then a8=Q."],
    codeExplanation: "Turn one deflects; turn two promotes safely.",
    lineNotes: ["Your queen gave check, drawing the rook off a8.", "Your pawn promoted with the square now clear."],
    starterCode: {
      python: `def move(game):
    if game.piece_at("a7") == "P":
        moves = [m for m in game.moves_from("a7") if len(m) == 5]
        if moves:
            return moves[0]
    return "d1d8"
`,
    },
    solutionCode: `def move(game):
    if game.piece_at("a7") == "P":
        moves = [m for m in game.moves_from("a7") if len(m) == 5]
        if moves:
            return moves[0]
    return "d1d8"
`,
    codeWalkthrough: [
      { code: `return "d1d8"`, caption: "Turn one: the deflecting check." },
      { code: `moves = [m for m in game.moves_from("a7") if len(m) == 5]`, caption: "Turn two: is the promotion available now?" },
      { code: `return moves[0]`, caption: "If so, promote." },
    ],
    guidedSteps: [{ title: "Deflect", instructions: "Play the deflecting queen check.", codeMustInclude: ["d1d8"] }],
  },
  {
    id: "gm-king-hunt",
    track: "programming",
    stage: STAGE,
    name: "King Hunt",
    concept: "Combination",
    difficulty: "advanced",
    mission: "Mate the wandering king.",
    fen: "k7/8/1K6/8/8/8/8/3R4 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Your king on b6 covers a7 and b7.", "The rook mates on the eighth rank."],
    solution: ["d1d8"],
    explanation: "The king does the covering; the rook delivers the blow. The program finds the back-rank mate by search.",
    learningObjectives: ["Mate with king and rook", "Reuse mate detection"],
    expandKnowledge: ["King and rook versus king is always mate in at most 16 moves."],
    steps: ["Return a mate move."],
    codeExplanation: "The mate loop finds the finish.",
    lineNotes: ["Your rook mated the king on the edge."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "The rook mate on the eighth rank." }],
    guidedSteps: [{ title: "Mate the king", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
  {
    id: "gm-back-rank-sweep",
    track: "programming",
    stage: STAGE,
    name: "Back-Rank Sweep",
    concept: "Checkmate",
    difficulty: "advanced",
    mission: "Sweep the queen along the back rank for mate.",
    fen: "6k1/5ppp/8/8/8/8/8/Q4K2 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The king is fenced in by its pawns.", "The queen reaches the eighth rank."],
    solution: ["a1a8"],
    explanation: "A queen on the back rank mates a king trapped by its own pawns — the same pattern as a rook, with more power.",
    learningObjectives: ["Mate with the queen on the back rank", "Recognise the trapped king"],
    expandKnowledge: ["Any open line to the eighth rank mates a king with no flight squares."],
    steps: ["Return a mate move."],
    codeExplanation: "The queen sweeps to a8 for mate.",
    lineNotes: ["Your queen swept to the back rank for mate."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "The queen's back-rank mate." }],
    guidedSteps: [{ title: "Back-rank mate", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
  {
    id: "gm-rook-and-queen",
    track: "programming",
    stage: STAGE,
    name: "Rook and Queen Finish",
    concept: "Checkmate",
    difficulty: "advanced",
    mission: "Deliver mate with rook and queen together.",
    fen: "7k/8/6K1/8/8/8/8/3Q2R1 w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Your king covers the escape squares.", "Either heavy piece can deliver on the eighth rank."],
    solution: ["d1d8"],
    explanation: "With the king guarded, a queen or rook on the back rank mates. The program simply tries every move and keeps the finish.",
    learningObjectives: ["Combine pieces for mate", "Trust the search to pick the piece"],
    expandKnowledge: ["More attackers make mate easier — variety, not just power."],
    steps: ["Return a mate move."],
    codeExplanation: "The mate loop finds whichever piece delivers mate.",
    lineNotes: ["Your queen delivered mate on the back rank."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "Mate delivered by search." }],
    guidedSteps: [{ title: "Deliver mate", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
  {
    id: "gm-epaulette",
    track: "programming",
    stage: STAGE,
    name: "Epaulette Mate",
    concept: "Checkmate",
    difficulty: "advanced",
    mission: "Mate the king flanked by its own rooks.",
    fen: "1rkr4/8/8/8/8/8/8/2Q4K w - - 0 1",
    goal: { type: "mate" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The rooks on b8 and d8 'shoulder' the king.", "The queen mates on c6."],
    solution: ["c1c6"],
    explanation:
      "The epaulette mate: the king's own rooks on either side block its escape, and the queen delivers the check on c6. The program finds it because it tests every move.",
    learningObjectives: ["Find an unusual mating move", "Rely on status(), not pattern-matching"],
    expandKnowledge: ["Named mates are just search results that humans gave a name to."],
    steps: ["Return a mate move."],
    codeExplanation: "Qc6 is the mate — found by simulation.",
    lineNotes: ["Your queen delivered the epaulette mate."],
    starterCode: { python: MATE_LOOP },
    solutionCode: MATE_LOOP,
    codeWalkthrough: [{ code: `after.status()["result"] == "checkmate"`, caption: "The queen's mate on c6." }],
    guidedSteps: [{ title: "Epaulette mate", instructions: "Return the mating move.", codeMustInclude: ["status("] }],
  },
  {
    id: "gm-win-the-exchange",
    track: "programming",
    stage: STAGE,
    name: "Win the Exchange",
    concept: "Material",
    difficulty: "advanced",
    mission: "Win the rook with your knight.",
    fen: "7k/8/8/4r3/8/3N4/8/K7 w - - 0 1",
    goal: { type: "capture", piece: "r" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["The rook is on e5.", "The knight on d3 can jump to e5."],
    solution: ["d3e5"],
    explanation: "A knight winning a rook is winning 'the exchange'. The program captures by destination, as always.",
    learningObjectives: ["Win material with a knight", "Reuse the capture scan"],
    expandKnowledge: ["The exchange is worth about two pawns."],
    steps: ["Return the move ending on e5."],
    codeExplanation: "The knight captures the rook.",
    lineNotes: ["Your knight won the exchange."],
    starterCode: { python: CAPTURE_LOOP("e5") },
    solutionCode: CAPTURE_LOOP("e5"),
    codeWalkthrough: [{ code: `m[2:4] == "e5"`, caption: "The rook's square." }],
    guidedSteps: [{ title: "Win the exchange", instructions: "Return the move ending on e5.", codeMustInclude: ["[2:4]"] }],
  },
];
