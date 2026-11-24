/**
 * Stage 1 — Python Foundations.
 *
 * The student does not write chess moves here; they write real Python: variables,
 * lists, loops, conditions, functions, dictionaries and sorting. Every lesson
 * runs against the live chess harness (`Game()` is real) and is graded by printed
 * output, so the sandbox, runner and output panel are all exercised for real.
 */
import type { TrainingLesson } from "../../training";

const STAGE = "Python Foundations";

export const FOUNDATION_LESSONS: TrainingLesson[] = [
  {
    id: "py-hello-output",
    track: "programming",
    stage: STAGE,
    name: "Hello, Output",
    concept: "print()",
    difficulty: "beginner",
    mission: "Print one line and return it as your move — learn how the program reports.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Anything you print() appears in the Output panel.", "Return a legal move like \"e2e4\" to finish the lesson."],
    solution: ["e2e4"],
    explanation:
      "print() writes a line to stdout. The Output panel below the editor shows exactly what your program printed, which is how you inspect a chess program while it runs.",
    learningObjectives: ["Use print() to see what a program is doing", "Return a legal move to finish"],
    expandKnowledge: ["A chess engine prints its thinking to stdout so you can debug it."],
    steps: ["Write print(\"hello chess\") above the return.", "You do not need it to solve the lesson — just to see output."],
    codeExplanation: "Whatever move(game) returns is the move played. print() is for you, not for the game.",
    lineNotes: ["Your program returned a legal move."],
    starterCode: {
      python: `def move(game):
    # Print a greeting so you can see the Output panel work.
    print("hello chess")
    # Then return a legal move.
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    print("hello chess")
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `print("hello chess")`, caption: "print() sends a line to stdout — the Output panel shows it." },
      { code: `game.legal_moves()`, caption: "legal_moves() returns every move you may play, as strings." },
      { code: `return game.legal_moves()[0]`, caption: "Returning the first legal move plays it." },
    ],
    guidedSteps: [
      {
        title: "Print something",
        instructions: "Add a print() line inside move(game) and run it.",
        codeMustInclude: ["print("],
        expectedOutputIncludes: ["hello chess"],
      },
    ],
  },
  {
    id: "py-variables",
    track: "programming",
    stage: STAGE,
    name: "Variables",
    concept: "Assignment",
    difficulty: "beginner",
    mission: "Store the legal moves in a variable, then return the first one.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["Assign with = : moves = game.legal_moves().", "Return moves[0]."],
    solution: ["e2e4"],
    explanation:
      "A variable names a value so you can use it more than once. Save the move list once, then read it instead of calling legal_moves() repeatedly.",
    learningObjectives: ["Store a value in a variable", "Index a list"],
    expandKnowledge: ["Reading the move list once is faster and keeps your code clear."],
    steps: ["moves = game.legal_moves()", "return moves[0]"],
    codeExplanation: "moves is a list of strings. moves[0] is the first element — Python counts from zero.",
    lineNotes: ["You stored the list, then returned its first move."],
    starterCode: {
      python: `def move(game):
    # Store the legal moves in a variable.
    moves = game.legal_moves()
    return moves[?]
`,
    },
    solutionCode: `def move(game):
    moves = game.legal_moves()
    return moves[0]
`,
    codeWalkthrough: [
      { code: `moves = game.legal_moves()`, caption: "legal_moves() is stored in a variable named moves." },
      { code: `return moves[0]`, caption: "Square brackets index the list — [0] is the first move." },
    ],
    guidedSteps: [
      {
        title: "Use a variable",
        instructions: "Assign game.legal_moves() to a variable and return its first item.",
        codeMustInclude: ["game.legal_moves()"],
      },
    ],
  },
  {
    id: "py-lists",
    track: "programming",
    stage: STAGE,
    name: "Lists",
    concept: "Lists",
    difficulty: "beginner",
    mission: "Print how many legal moves there are, then play one.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["len(moves) counts the items.", "Print it, then return moves[0]."],
    solution: ["e2e4"],
    explanation: "Lists hold ordered items and know their own length with len().",
    learningObjectives: ["Count a list with len()", "Print a number with str()"],
    expandKnowledge: ["From the start position there are exactly 20 legal moves."],
    steps: ["moves = game.legal_moves()", "print(len(moves))", "return moves[0]"],
    codeExplanation: "print(len(moves)) prints an integer; print() converts it to text for you.",
    lineNotes: ["You measured the list, then played its first move."],
    starterCode: {
      python: `def move(game):
    moves = game.legal_moves()
    print(len(moves))
    return moves[0]
`,
    },
    solutionCode: `def move(game):
    moves = game.legal_moves()
    print(len(moves))
    return moves[0]
`,
    codeWalkthrough: [
      { code: `moves = game.legal_moves()`, caption: "The list of legal moves." },
      { code: `print(len(moves))`, caption: "len() counts the items; print() shows the number." },
      { code: `return moves[0]`, caption: "Play the first legal move." },
    ],
    guidedSteps: [
      {
        title: "Count the moves",
        instructions: "Print the number of legal moves from the start position.",
        codeMustInclude: ["len("],
        expectedOutputIncludes: ["20"],
      },
    ],
  },
  {
    id: "py-loops",
    track: "programming",
    stage: STAGE,
    name: "Loops",
    concept: "for",
    difficulty: "beginner",
    mission: "Print every legal move, one per line, then play the first.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["for m in moves: print(m)", "Indentation matters — the print is inside the loop."],
    solution: ["e2e4"],
    explanation: "A for loop visits each item in a list in order. This is how an engine examines every possible move.",
    learningObjectives: ["Loop over a list", "Understand list iteration order"],
    expandKnowledge: ["Examining every move one by one is the heart of a chess search."],
    steps: ["for m in game.legal_moves():", "    print(m)", "return game.legal_moves()[0]"],
    codeExplanation: "The loop body is indented; Python uses indentation to know what is inside the loop.",
    lineNotes: ["You listed every move in order, then played the first."],
    starterCode: {
      python: `def move(game):
    moves = game.legal_moves()
    for m in moves:
        print(m)
    return moves[0]
`,
    },
    solutionCode: `def move(game):
    moves = game.legal_moves()
    for m in moves:
        print(m)
    return moves[0]
`,
    codeWalkthrough: [
      { code: `for m in moves:`, caption: "for visits each element of the list, naming it m." },
      { code: `    print(m)`, caption: "The indented body runs once per move." },
      { code: `return moves[0]`, caption: "Finally, play the first move." },
    ],
    guidedSteps: [
      {
        title: "Loop over moves",
        instructions: "Print each legal move with a for loop.",
        codeMustInclude: ["for "],
        expectedOutputIncludes: ["e2e4"],
      },
    ],
  },
  {
    id: "py-conditions",
    track: "programming",
    stage: STAGE,
    name: "Conditions",
    concept: "if",
    difficulty: "beginner",
    mission: "If the side to move is white, say so, then play a move.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["game.turn() returns \"white\" or \"black\".", "if game.turn() == \"white\": print(\"white to move\")"],
    solution: ["e2e4"],
    explanation: "if runs a block only when a condition is true. Every chess decision is a condition: is this a capture? is my king in check?",
    learningObjectives: ["Branch with if / else", "Compare strings with =="],
    expandKnowledge: ["A chess program is a long chain of ifs — this lesson is that idea in miniature."],
    steps: ["if game.turn() == \"white\":", "    print(\"white to move\")", "return game.legal_moves()[0]"],
    codeExplanation: "== compares two values; = assigns. Confusing them is the classic beginner bug.",
    lineNotes: ["You branched on whose turn it is, then played a move."],
    starterCode: {
      python: `def move(game):
    if game.turn() == "white":
        print("white to move")
    else:
        print("black to move")
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    if game.turn() == "white":
        print("white to move")
    else:
        print("black to move")
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `game.turn()`, caption: "turn() returns \"white\" or \"black\"." },
      { code: `if game.turn() == "white":`, caption: "Compare with == ; the indented block runs when true." },
      { code: `else:`, caption: "else covers every other case — here, black to move." },
    ],
    guidedSteps: [
      {
        title: "Branch on the turn",
        instructions: "Print which side is to move using an if.",
        codeMustInclude: ["if "],
        expectedOutputIncludes: ["white to move"],
      },
    ],
  },
  {
    id: "py-functions",
    track: "programming",
    stage: STAGE,
    name: "Your Own Function",
    concept: "def",
    difficulty: "beginner",
    mission: "Write a helper that counts the moves from a square and use it.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["def count_from(game, square): return len(game.moves_from(square))", "Then print(count_from(game, \"e2\"))."],
    solution: ["e2e4"],
    explanation: "def names a reusable block of code. move(game) itself is just a function the harness calls each turn.",
    learningObjectives: ["Define your own function", "Call it with arguments"],
    expandKnowledge: ["Breaking a chess program into small functions (attack, mate, search) keeps it readable."],
    steps: ["def count_from(game, square):", "    return len(game.moves_from(square))", "print(count_from(game, \"e2\"))"],
    codeExplanation: "The helper takes the game and a square, and returns how many legal moves start there.",
    lineNotes: ["Your helper counted the e2 pawn's moves, then you played."],
    starterCode: {
      python: `def count_from(game, square):
    return len(game.moves_from(square))

def move(game):
    print(count_from(game, "e2"))
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def count_from(game, square):
    return len(game.moves_from(square))

def move(game):
    print(count_from(game, "e2"))
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `def count_from(game, square):`, caption: "A new function with two parameters." },
      { code: `    return len(game.moves_from(square))`, caption: "moves_from(square) lists moves starting there." },
      { code: `print(count_from(game, "e2"))`, caption: "Call the helper and print the result." },
    ],
    guidedSteps: [
      {
        title: "Write a helper",
        instructions: "Define count_from(game, square) and print the count for e2.",
        codeMustInclude: ["def ", "moves_from"],
      },
    ],
  },
  {
    id: "py-dictionaries",
    track: "programming",
    stage: STAGE,
    name: "Dictionaries",
    concept: "dict",
    difficulty: "beginner",
    mission: "Give each piece a value in a dictionary, then look one up.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ['values = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}', "print(values[\"q\"])"],
    solution: ["e2e4"],
    explanation: "A dict maps keys to values — perfect for piece values, square names, or any lookup table.",
    learningObjectives: ["Create a dictionary", "Look up a key"],
    expandKnowledge: ["Piece values are the simplest evaluation function an engine can have."],
    steps: ['values = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}', 'print(values["q"])'],
    codeExplanation: "Brackets look up a value: values[\"q\"] is 9.",
    lineNotes: ["You looked up a piece value, then played a move."],
    starterCode: {
      python: `def move(game):
    values = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}
    piece = game.piece_at("c1").lower()
    print(values[piece])
    return game.legal_moves()[0]
`,
    },
    solutionCode: `def move(game):
    values = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}
    piece = game.piece_at("c1").lower()
    print(values[piece])
    return game.legal_moves()[0]
`,
    codeWalkthrough: [
      { code: `values = {"p": 1, "n": 3, ...}`, caption: "A dictionary pairs each piece letter with its value." },
      { code: `game.piece_at("c1")`, caption: "Read the piece standing on c1 (a bishop: \"B\")." },
      { code: `.lower()`, caption: "lower() turns \"B\" into \"b\" so black and white share one table." },
      { code: `print(values[piece])`, caption: "Look the value up and print it — 3." },
    ],
    guidedSteps: [
      {
        title: "Build a value table",
        instructions: "Make a dict of piece values and print the value of the c1 bishop.",
        codeMustInclude: ["{", "piece_at"],
        expectedOutputIncludes: ["3"],
      },
    ],
  },
  {
    id: "py-string-building",
    track: "programming",
    stage: STAGE,
    name: "Building Strings",
    concept: "Concatenation",
    difficulty: "beginner",
    mission: "Build a move from two squares and print it.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ['"e2" + "e4" is "e2e4".', "print(\"e2\" + \"e4\")"],
    solution: ["e2e4"],
    explanation: "A UCI move is the from-square followed by the to-square. Building it from pieces of text is how a program constructs a move.",
    learningObjectives: ["Join strings with +", "Understand UCI move formatting"],
    expandKnowledge: ["Promotions add a fifth letter: \"e7e8q\"."],
    steps: ['from_sq = "e2"', 'to_sq = "e4"', "print(from_sq + to_sq)"],
    codeExplanation: "+ glues two strings together. A move is from + to.",
    lineNotes: ["You constructed \"e2e4\" from its coordinates, then played it."],
    starterCode: {
      python: `def move(game):
    from_sq = "e2"
    to_sq = "e4"
    print(from_sq + to_sq)
    return from_sq + to_sq
`,
    },
    solutionCode: `def move(game):
    from_sq = "e2"
    to_sq = "e4"
    print(from_sq + to_sq)
    return from_sq + to_sq
`,
    codeWalkthrough: [
      { code: `from_sq = "e2"`, caption: "The origin square, as text." },
      { code: `to_sq = "e4"`, caption: "The destination square." },
      { code: `from_sq + to_sq`, caption: "+ concatenates: \"e2\" + \"e4\" becomes the move \"e2e4\"." },
    ],
    guidedSteps: [
      {
        title: "Join two squares",
        instructions: "Concatenate two square strings into a move and print it.",
        codeMustInclude: ["+"],
        expectedOutputIncludes: ["e2e4"],
      },
    ],
  },
  {
    id: "py-lists-of-lists",
    track: "programming",
    stage: STAGE,
    name: "List Comprehensions",
    concept: "Comprehension",
    difficulty: "intermediate",
    mission: "Use a list comprehension to keep only the moves of a piece.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ['[m for m in game.legal_moves() if m.startswith("e2")]', "Print how many you found."],
    solution: ["e2e4"],
    explanation: "A comprehension builds a new list by filtering or transforming an old one in a single expression — the tidy way to ask \"which moves start here?\".",
    learningObjectives: ["Write a list comprehension", "Filter with if inside a comprehension"],
    expandKnowledge: ["game.moves_from() does the same thing, but writing it yourself teaches the pattern."],
    steps: ["mine = [m for m in game.legal_moves() if m.startswith(\"e2\")]", "print(len(mine))", "return mine[0]"],
    codeExplanation: "startswith(\"e2\") is true for moves that begin on e2 — the pawn's moves.",
    lineNotes: ["Your comprehension filtered the pawn's moves, then you played one."],
    starterCode: {
      python: `def move(game):
    mine = [m for m in game.legal_moves() if m.startswith("e2")]
    print(len(mine))
    return mine[0]
`,
    },
    solutionCode: `def move(game):
    mine = [m for m in game.legal_moves() if m.startswith("e2")]
    print(len(mine))
    return mine[0]
`,
    codeWalkthrough: [
      { code: `for m in game.legal_moves()`, caption: "Start from every legal move." },
      { code: `if m.startswith("e2")`, caption: "Keep only the ones starting on e2." },
      { code: `mine = [ ... ]`, caption: "The brackets collect the kept moves into a new list." },
    ],
    guidedSteps: [
      {
        title: "Filter with a comprehension",
        instructions: "Build a list of the e2 pawn's moves and print the count.",
        codeMustInclude: ["for ", "if "],
      },
    ],
  },
  {
    id: "py-sorting",
    track: "programming",
    stage: STAGE,
    name: "Sorting",
    concept: "sorted()",
    difficulty: "intermediate",
    mission: "Sort the move list and print the first two moves alphabetically.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    goal: { type: "any" },
    par: 1,
    maxPlayerMoves: 1,
    hints: ["sorted(moves) returns a new sorted list.", "Print the first two entries."],
    solution: ["a2a3"],
    explanation: "sorted() puts a list in order. An engine often sorts candidate moves so it can try the most promising first.",
    learningObjectives: ["Sort a list with sorted()", "Slice a list"],
    expandKnowledge: ["In a real engine you sort moves by a heuristic score, not the alphabet."],
    steps: ["ordered = sorted(game.legal_moves())", "print(ordered[0], ordered[1])", "return ordered[0]"],
    codeExplanation: "ordered[:2] is a slice — the first two items.",
    lineNotes: ["You sorted the moves and played the alphabetically first one."],
    starterCode: {
      python: `def move(game):
    ordered = sorted(game.legal_moves())
    print(ordered[0], ordered[1])
    return ordered[0]
`,
    },
    solutionCode: `def move(game):
    ordered = sorted(game.legal_moves())
    print(ordered[0], ordered[1])
    return ordered[0]
`,
    codeWalkthrough: [
      { code: `sorted(game.legal_moves())`, caption: "sorted() returns the moves in alphabetical order." },
      { code: `print(ordered[0], ordered[1])`, caption: "Index 0 and 1 are the first two moves." },
      { code: `return ordered[0]`, caption: "Play the first move of the sorted list." },
    ],
    guidedSteps: [
      {
        title: "Sort the moves",
        instructions: "Sort the legal moves and print the first two.",
        codeMustInclude: ["sorted("],
      },
    ],
  },
];
