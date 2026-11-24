/**
 * Question bank: CBSE Class 11 Computer Science — "Problem Solving &
 * Computational Thinking".
 *
 * Three question types are used, matching how this chapter is examined:
 *   MCQ (80)  — conceptual recall, ordering, analysis and HOTS,
 *   UPLOAD (20) — handwritten algorithms and flowcharts, judged by a teacher,
 *   ORAL (20) — viva questions from basic recall to HOTS discussion.
 *
 * Every question carries a stable `id`. The seeder matches on the question stem,
 * so this file is safe to re-run: questions are never duplicated.
 */

export type BankOption = { text: string; correct?: boolean };

export type BankQuestion = {
  id: string;
  type: "MCQ" | "UPLOAD" | "ORAL";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  stem: string;
  explanation: string;
  options?: BankOption[];
};

export const PROBLEM_SOLVING_QUESTIONS: BankQuestion[] = [
  // ====================================================== MCQ 01–30 (set one)
  {
    id: "m01",
    type: "MCQ",
    difficulty: "EASY",
    stem: "The first step in solving a computational problem is to:",
    explanation:
      "Every problem-solving process begins by identifying and understanding the problem — the inputs, the required output and the constraints. Writing code or drawing a flowchart comes only after the problem is understood.",
    options: [
      { text: "Write the program", correct: false },
      { text: "Identify and understand the problem", correct: true },
      { text: "Draw a flowchart", correct: false },
      { text: "Test the program", correct: false },
    ],
  },
  {
    id: "m02",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which of the following best describes problem solving?",
    explanation:
      "Problem solving is finding a systematic, step-by-step solution to a given problem. It is a planned procedure, not guessing, memorising syntax or blindly repeating an execution.",
    options: [
      { text: "Writing code without planning", correct: false },
      { text: "Finding a systematic solution to a given problem", correct: true },
      { text: "Memorising programming syntax", correct: false },
      { text: "Executing a program repeatedly", correct: false },
    ],
  },
  {
    id: "m03",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Breaking a complex problem into smaller, manageable parts is called:",
    explanation:
      "Decomposition splits a big problem into smaller sub-problems that can each be understood and solved separately. Abstraction instead hides detail; iteration means repetition.",
    options: [
      { text: "Abstraction", correct: false },
      { text: "Decomposition", correct: true },
      { text: "Iteration", correct: false },
      { text: "Compilation", correct: false },
    ],
  },
  {
    id: "m04",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which computational thinking technique focuses on identifying similarities among different problems?",
    explanation:
      "Pattern recognition finds recurring similarities or structures so that a solution to one problem can be reused for others. The common phrase 'pattern recognition' is the standard answer here.",
    options: [
      { text: "Pattern recognition", correct: true },
      { text: "Decomposition", correct: false },
      { text: "Abstraction", correct: false },
      { text: "Debugging", correct: false },
    ],
  },
  {
    id: "m05",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Removing unnecessary details while focusing only on the important features of a problem is known as:",
    explanation:
      "Abstraction ignores irrelevant details and keeps what matters, so the problem becomes easier to reason about. Decomposition splits the problem up; it is not about hiding detail.",
    options: [
      { text: "Decomposition", correct: false },
      { text: "Abstraction", correct: true },
      { text: "Pattern recognition", correct: false },
      { text: "Iteration", correct: false },
    ],
  },
  {
    id: "m06",
    type: "MCQ",
    difficulty: "EASY",
    stem: "An algorithm is:",
    explanation:
      "An algorithm is a finite, well-defined sequence of steps that transforms an input into an output. It is not a programming language, hardware or memory — and it need not be code.",
    options: [
      { text: "A programming language", correct: false },
      { text: "A hardware component", correct: false },
      { text: "A finite sequence of well-defined steps to solve a problem", correct: true },
      { text: "A type of computer memory", correct: false },
    ],
  },
  {
    id: "m07",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which property of an algorithm means that it must eventually terminate?",
    explanation:
      "Finiteness requires the algorithm to stop after a finite number of steps. Definiteness requires each step to be unambiguous; input and output describe the data that flows through it.",
    options: [
      { text: "Definiteness", correct: false },
      { text: "Finiteness", correct: true },
      { text: "Input", correct: false },
      { text: "Output", correct: false },
    ],
  },
  {
    id: "m08",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which of the following is NOT generally considered a characteristic of a good algorithm?",
    explanation:
      "A good algorithm must be definite and finite with effective steps. Ambiguity is the opposite — an instruction open to more than one meaning is a flaw, not a feature.",
    options: [
      { text: "Clearly defined steps", correct: false },
      { text: "Finiteness", correct: false },
      { text: "Ambiguity", correct: true },
      { text: "Effective operations", correct: false },
    ],
  },
  {
    id: "m09",
    type: "MCQ",
    difficulty: "EASY",
    stem: `Consider the following steps:

Display the result
Enter two numbers
Add the numbers

What should be the correct order?`,
    explanation:
      "Processing must come before output: first enter the two numbers, then add them, then display the result. Order 2 → 3 → 1 follows input → processing → output.",
    options: [
      { text: "1 → 2 → 3", correct: false },
      { text: "2 → 3 → 1", correct: true },
      { text: "3 → 2 → 1", correct: false },
      { text: "2 → 1 → 3", correct: false },
    ],
  },
  {
    id: "m10",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which of the following represents input → processing → output correctly?",
    explanation:
      "Inputs (numbers) are processed by a calculation that produces a result (output). The only option in that order is Numbers → calculation → result.",
    options: [
      { text: "Result → calculation → numbers", correct: false },
      { text: "Numbers → calculation → result", correct: true },
      { text: "Calculation → result → numbers", correct: false },
      { text: "Result → numbers → calculation", correct: false },
    ],
  },
  {
    id: "m11",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A student wants to create a program to calculate the area of a rectangle. Which information is essential as input?",
    explanation:
      "The area of a rectangle is length × breadth, so those two measurements are the essential inputs. Colour, perimeter and diagonal are not needed for the formula.",
    options: [
      { text: "Colour of the rectangle", correct: false },
      { text: "Length and breadth", correct: true },
      { text: "Perimeter only", correct: false },
      { text: "Diagonal only", correct: false },
    ],
  },
  {
    id: "m12",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which computational thinking concept would be most useful for dividing a large problem such as a school-management system into modules like students, teachers and fees?",
    explanation:
      "This is decomposition: breaking one large system into smaller, separately manageable modules, each of which can be built and maintained independently.",
    options: [
      { text: "Abstraction", correct: false },
      { text: "Decomposition", correct: true },
      { text: "Pattern recognition", correct: false },
      { text: "Simulation", correct: false },
    ],
  },
  {
    id: "m13",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Suppose you observe that calculating the area of a square, rectangle and triangle all involves taking certain measurements and applying mathematical formulas. Identifying this similarity is an example of:",
    explanation:
      "Noticing that several problems share the same general structure (measure then apply a formula) is pattern recognition. It lets one approach be adapted across problems.",
    options: [
      { text: "Pattern recognition", correct: true },
      { text: "Decomposition", correct: false },
      { text: "Debugging", correct: false },
      { text: "Compilation", correct: false },
    ],
  },
  {
    id: "m14",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which statement about abstraction is correct?",
    explanation:
      "Abstraction hides irrelevant details and keeps only the essential information needed to solve the problem. It does not mean 'convert to Python' and is distinct from decomposition.",
    options: [
      { text: "It requires considering every possible detail", correct: false },
      { text: "It hides irrelevant details and focuses on essential information", correct: true },
      { text: "It always converts an algorithm into Python code", correct: false },
      { text: "It means dividing a problem into smaller problems", correct: false },
    ],
  },
  {
    id: "m15",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which of the following is the best example of decomposition?",
    explanation:
      "Dividing a shopping application into login, product search, payment and order modules is textbook decomposition: splitting a large system into smaller components. The other options describe abstraction or pattern recognition.",
    options: [
      { text: "Ignoring the colour of a car while calculating its speed", correct: false },
      { text: "Identifying that many problems use addition", correct: false },
      { text: "Dividing a shopping application into login, product search, payment and order modules", correct: true },
      { text: "Finding repeated patterns in data", correct: false },
    ],
  },
  {
    id: "m16",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which sequence represents a logical problem-solving process most appropriately?",
    explanation:
      "The textbook order is: identify/understand the problem, analyse it, design the solution, implement it, then test. Testing last and understanding first are the two anchors.",
    options: [
      { text: "Coding → testing → understanding → problem definition", correct: false },
      { text: "Problem identification → analysis → solution design → implementation → testing", correct: true },
      { text: "Testing → coding → problem identification → implementation", correct: false },
      { text: "Implementation → problem analysis → testing → coding", correct: false },
    ],
  },
  {
    id: "m17",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "An algorithm contains the instruction: “Calculate the result using an appropriate operation.” Why is this instruction problematic?",
    explanation:
      "‘An appropriate operation’ is not defined: a reader cannot tell what to calculate or how. That ambiguity violates the definiteness property of an algorithm.",
    options: [
      { text: "It is too short", correct: false },
      { text: "It is ambiguous", correct: true },
      { text: "It has too many inputs", correct: false },
      { text: "It contains a loop", correct: false },
    ],
  },
  {
    id: "m18",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which characteristic of an algorithm is violated when an instruction can be interpreted in more than one way?",
    explanation:
      "Definiteness requires each step to have exactly one meaning. If a step can be read two ways, the algorithm is not definite regardless of whether it terminates.",
    options: [
      { text: "Finiteness", correct: false },
      { text: "Definiteness", correct: true },
      { text: "Input", correct: false },
      { text: "Output", correct: false },
    ],
  },
  {
    id: "m19",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A problem asks for the average of five numbers. Which of the following is the most appropriate high-level approach?",
    explanation:
      "The average is the sum divided by the count: add the five numbers and divide their sum by five. The other options compute unrelated quantities.",
    options: [
      { text: "Find the largest number only", correct: false },
      { text: "Add the numbers and divide their sum by five", correct: true },
      { text: "Multiply all numbers by five", correct: false },
      { text: "Subtract the numbers from one another", correct: false },
    ],
  },
  {
    id: "m20",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A programmer notices that three different problems can be solved using the same general procedure with minor changes. Which computational thinking concept is being applied?",
    explanation:
      "Reusing one general procedure across several problems is the reward of pattern recognition — you identified the recurring structure once and apply one solution with small adaptations.",
    options: [
      { text: "Pattern recognition", correct: true },
      { text: "Decomposition", correct: false },
      { text: "Randomisation", correct: false },
      { text: "Compilation", correct: false },
    ],
  },
  {
    id: "m21",
    type: "MCQ",
    difficulty: "HARD",
    stem: "Consider this problem: “A school wants to determine whether a student has passed based on marks in five subjects.” Which of the following is the most important first task before writing the program?",
    explanation:
      "Before any code, define the pass criteria (e.g. pass mark per subject and whether all must be passed) and the required inputs. That analysis determines everything that follows.",
    options: [
      { text: "Select a programming font", correct: false },
      { text: "Define the pass criteria and required inputs", correct: true },
      { text: "Write Python loops", correct: false },
      { text: "Design the user interface", correct: false },
    ],
  },
  {
    id: "m22",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A programmer decides that a student-management system can be divided into modules for admission, attendance, examination and fees. This primarily demonstrates:",
    explanation:
      "Splitting a large system into admission, attendance, examination and fees modules is an example of decomposition, exactly as in a real software project.",
    options: [
      { text: "Abstraction", correct: false },
      { text: "Decomposition", correct: true },
      { text: "Pattern recognition", correct: false },
      { text: "Algorithm termination", correct: false },
    ],
  },
  {
    id: "m23",
    type: "MCQ",
    difficulty: "HARD",
    stem: `Consider the following algorithm:

Start
Input number N
Calculate N × N
Display result
Stop

What is the output if N = 7?`,
    explanation:
      "The algorithm squares N. 7 × 7 = 49, so 49 is displayed. Options 14, 21 and 77 are not the square of 7.",
    options: [
      { text: "14", correct: false },
      { text: "21", correct: false },
      { text: "49", correct: true },
      { text: "77", correct: false },
    ],
  },
  {
    id: "m24",
    type: "MCQ",
    difficulty: "HARD",
    stem: "Which of the following algorithms is definite?",
    explanation:
      "‘Add 10 to the input number and display the result’ has exactly one meaning at every step. The alternatives use vague words such as ‘some’, ‘appropriate’ and ‘useful’.",
    options: [
      { text: "Add some numbers and display the answer", correct: false },
      { text: "Process the data appropriately", correct: false },
      { text: "Add 10 to the input number and display the result", correct: true },
      { text: "Do something useful with the number", correct: false },
    ],
  },
  {
    id: "m25",
    type: "MCQ",
    difficulty: "HARD",
    stem: "An algorithm repeatedly performs a step but has no condition that allows it to stop. Which property is most directly violated?",
    explanation:
      "Repeating without any stopping condition destroys finiteness: the sequence of steps never terminates. Even a loop is fine only when a condition eventually ends it.",
    options: [
      { text: "Input", correct: false },
      { text: "Output", correct: false },
      { text: "Finiteness", correct: true },
      { text: "Pattern recognition", correct: false },
    ],
  },
  {
    id: "m26",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A navigation application does not need to know the colour of a road to calculate the shortest route. Ignoring road colour is an example of:",
    explanation:
      "The app abstracts away the road's colour because it is irrelevant to distance. Keeping only what matters (length, connections) is exactly abstraction.",
    options: [
      { text: "Decomposition", correct: false },
      { text: "Abstraction", correct: true },
      { text: "Pattern recognition", correct: false },
      { text: "Iteration", correct: false },
    ],
  },
  {
    id: "m27",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A teacher asks students to design a solution for an online examination system. A student first divides the problem into login, question display, answer submission, evaluation and result generation. What should the student most logically do next?",
    explanation:
      "After decomposing into components, the natural next step is to design an algorithm for each component. Writing the whole program first skips the design step; deleting parts or skipping testing is wrong.",
    options: [
      { text: "Immediately write the complete program", correct: false },
      { text: "Develop algorithms for the individual components", correct: true },
      { text: "Delete the smaller components", correct: false },
      { text: "Ignore testing", correct: false },
    ],
  },
  {
    id: "m28",
    type: "MCQ",
    difficulty: "HARD",
    stem: "Two different problems—calculating the total cost of items and calculating the total marks of students—both require repeatedly adding values. Recognising this common structure is:",
    explanation:
      "Spotting that both problems repeatedly add values is pattern recognition: the same 'running total' pattern serves either problem.",
    options: [
      { text: "Abstraction", correct: false },
      { text: "Pattern recognition", correct: true },
      { text: "Decomposition", correct: false },
      { text: "Compilation", correct: false },
    ],
  },
  {
    id: "m29",
    type: "MCQ",
    difficulty: "HARD",
    stem: "Which situation demonstrates both decomposition and abstraction most clearly?",
    explanation:
      "Dividing a banking application into modules (decomposition) while hiding complex transaction-processing details from the user (abstraction) shows both techniques working together.",
    options: [
      { text: "Dividing a banking application into modules while hiding complex transaction-processing details from the user", correct: true },
      { text: "Adding two numbers", correct: false },
      { text: "Printing a message repeatedly", correct: false },
      { text: "Changing a variable name", correct: false },
    ],
  },
  {
    id: "m30",
    type: "MCQ",
    difficulty: "HARD",
    stem: `A student is asked to design an algorithm for determining the largest of three numbers. The student proposes:

Input A, B and C
Compare A, B and C
Find the largest
Display the largest

Which statement is most accurate?`,
    explanation:
      "The outline is a reasonable high-level plan, but ‘compare’ and ‘find the largest’ could be written more precisely (compare A with B, keep the bigger, then compare with C). It is not invalid merely because no Python is shown.",
    options: [
      { text: "It is completely invalid because no Python code is given", correct: false },
      { text: "It provides a reasonable high-level solution, but the comparison procedure could be made more precise", correct: true },
      { text: "It cannot accept three inputs", correct: false },
      { text: "It violates finiteness because comparison is impossible", correct: false },
    ],
  },

  // ==================================================== MCQ 31–50 (set two)
  {
    id: "m31",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which of the following is the most important purpose of analysing a problem before developing its solution?",
    explanation:
      "Analysis establishes the inputs, the required outputs and the processing needed. Understanding the problem first is what makes a correct solution possible.",
    options: [
      { text: "To select colours for the program", correct: false },
      { text: "To understand inputs, required outputs and processing", correct: true },
      { text: "To reduce the size of the keyboard", correct: false },
      { text: "To avoid testing the solution", correct: false },
    ],
  },
  {
    id: "m32",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A problem requires finding the total bill amount for several products. Which of the following would be an input?",
    explanation:
      "Product prices and quantities are the data that go into the calculation. The bill amount and the tax are computed; the receipt is an output.",
    options: [
      { text: "Final bill amount", correct: false },
      { text: "Total calculated tax", correct: false },
      { text: "Product prices and quantities", correct: true },
      { text: "Printed receipt", correct: false },
    ],
  },
  {
    id: "m33",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which of the following represents an output rather than an input?",
    explanation:
      "The calculated percentage is produced by processing, so it is an output. Roll number, marks and subject count are the raw inputs.",
    options: [
      { text: "Student's roll number", correct: false },
      { text: "Marks obtained in subjects", correct: false },
      { text: "Calculated percentage", correct: true },
      { text: "Number of subjects", correct: false },
    ],
  },
  {
    id: "m34",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "An algorithm should contain steps that are:",
    explanation:
      "Steps must be clear and unambiguous — exactly the definiteness property. Vague or randomly ordered steps would not be definite and could be interpreted several ways.",
    options: [
      { text: "Vague and flexible", correct: false },
      { text: "Clearly defined and unambiguous", correct: true },
      { text: "Randomly arranged", correct: false },
      { text: "Dependent on the programmer's mood", correct: false },
    ],
  },
  {
    id: "m35",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which of the following is an example of a finite process?",
    explanation:
      "A process that repeats an operation only until a condition is met is finite: the condition eventually ends it. The other options never stop, which violates finiteness.",
    options: [
      { text: "Continue adding numbers forever", correct: false },
      { text: "Repeat an operation until a condition is met", correct: true },
      { text: "Keep displaying a message without stopping", correct: false },
      { text: "Generate numbers indefinitely", correct: false },
    ],
  },
  {
    id: "m36",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A programmer studies several problems and notices that each requires comparing values to identify the maximum. Which computational thinking technique is being used?",
    explanation:
      "Noticing that every problem needs a value-comparison to find a maximum is pattern recognition: one reusable pattern, many problems.",
    options: [
      { text: "Pattern recognition", correct: true },
      { text: "Decomposition", correct: false },
      { text: "Abstraction", correct: false },
      { text: "Documentation", correct: false },
    ],
  },
  {
    id: "m37",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which statement best distinguishes decomposition from abstraction?",
    explanation:
      "Decomposition divides a problem into smaller parts; abstraction hides unnecessary details. They are complementary, not the same, and not limited to hardware.",
    options: [
      { text: "Decomposition removes details, while abstraction divides problems", correct: false },
      { text: "Decomposition divides a problem; abstraction hides unnecessary details", correct: true },
      { text: "Both mean exactly the same thing", correct: false },
      { text: "Decomposition is used only in hardware", correct: false },
    ],
  },
  {
    id: "m38",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A food-delivery application displays only the restaurant name, menu and price to the customer while hiding database and server operations. This is an example of:",
    explanation:
      "Showing the user only relevant data while hiding database and server internals is abstraction. The hidden machinery is irrelevant to the customer's task.",
    options: [
      { text: "Decomposition", correct: false },
      { text: "Abstraction", correct: true },
      { text: "Pattern recognition", correct: false },
      { text: "Iteration", correct: false },
    ],
  },
  {
    id: "m39",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which of the following would be the best first step when developing a solution to calculate the electricity bill?",
    explanation:
      "Understand how the bill is computed (tariff slabs, unit rates) and identify the required inputs. Loops, databases and UI choices all come later, after the problem is clear.",
    options: [
      { text: "Write a for loop", correct: false },
      { text: "Understand how the bill is calculated and identify required inputs", correct: true },
      { text: "Create a database", correct: false },
      { text: "Choose a variable colour", correct: false },
    ],
  },
  {
    id: "m40",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A well-designed algorithm should have:",
    explanation:
      "Where inputs and outputs apply, they must be clearly defined, along with definite, finite steps. Infinite loops and ambiguity are faults, not design goals.",
    options: [
      { text: "Infinite steps", correct: false },
      { text: "Ambiguous instructions", correct: false },
      { text: "Clearly defined inputs and outputs where applicable", correct: true },
      { text: "No logical order", correct: false },
    ],
  },
  {
    id: "m41",
    type: "MCQ",
    difficulty: "HARD",
    stem: `Consider:

Input radius
Calculate π × r × r
Display area
Stop

Which step represents processing?`,
    explanation:
      "Processing is the calculation — step 2, 'Calculate π × r × r'. Step 1 is input, step 3 is output and step 4 is termination.",
    options: [
      { text: "Step 1", correct: false },
      { text: "Step 2", correct: true },
      { text: "Step 3", correct: false },
      { text: "Step 4", correct: false },
    ],
  },
  {
    id: "m42",
    type: "MCQ",
    difficulty: "HARD",
    stem: `A student writes an algorithm for calculating simple interest:

Input P, R, T
Calculate (P × R × T) / 100
Display SI

What is missing if the algorithm is expected to be a complete algorithm?`,
    explanation:
      "A complete algorithm needs an explicit start and stop so it clearly begins and terminates. A programming language or database is not part of an algorithm.",
    options: [
      { text: "A programming language", correct: false },
      { text: "A clearly defined beginning/end or termination", correct: true },
      { text: "A database", correct: false },
      { text: "A flowchart only", correct: false },
    ],
  },
  {
    id: "m43",
    type: "MCQ",
    difficulty: "HARD",
    stem: "Which of the following is an example of algorithmic thinking?",
    explanation:
      "Algorithmic thinking means solving a problem through an ordered sequence of logical steps. Guessing, memorising specs and random trial are its opposite.",
    options: [
      { text: "Guessing an answer", correct: false },
      { text: "Solving a problem through an ordered sequence of logical steps", correct: true },
      { text: "Memorising computer specifications", correct: false },
      { text: "Randomly trying different commands", correct: false },
    ],
  },
  {
    id: "m44",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A school wants to automate attendance. Which decomposition would be most logical?",
    explanation:
      "Attendance breaks down as students → dates → attendance records → reports. The other options mix in irrelevant items such as keyboard colour, wallpaper or music.",
    options: [
      { text: "Attendance → students → dates → attendance records → reports", correct: true },
      { text: "Attendance → keyboard colour → monitor size", correct: false },
      { text: "Attendance → wallpaper → printer colour", correct: false },
      { text: "Attendance → music → games", correct: false },
    ],
  },
  {
    id: "m45",
    type: "MCQ",
    difficulty: "HARD",
    stem: "Why is decomposition useful for complex problems?",
    explanation:
      "Smaller parts are easier to understand, solve and check individually, and their solutions can later be combined. Decomposition does not replace algorithms or programming.",
    options: [
      { text: "It makes every problem mathematically easier", correct: false },
      { text: "It allows smaller parts to be understood and solved separately", correct: true },
      { text: "It eliminates the need for algorithms", correct: false },
      { text: "It prevents the use of programming languages", correct: false },
    ],
  },
  {
    id: "m46",
    type: "MCQ",
    difficulty: "HARD",
    stem: "Suppose a program needs to calculate the average marks of N students. Which approach is most general?",
    explanation:
      "Adding all relevant marks and dividing by the count works for any N. Hard-coding 'exactly five marks' or picking only the highest mark is not general.",
    options: [
      { text: "Add exactly five marks every time", correct: false },
      { text: "Add all relevant marks and divide by the number of values", correct: true },
      { text: "Select only the highest mark", correct: false },
      { text: "Divide every mark by itself", correct: false },
    ],
  },
  {
    id: "m47",
    type: "MCQ",
    difficulty: "HARD",
    stem: `Consider the instruction: “If the number is large, perform the required calculation.”
What is the major problem with this instruction?`,
    explanation:
      "‘Large’ and ‘required calculation’ are not precisely defined, so the instruction is ambiguous and cannot be executed as written. It is vague, not merely long or infinite.",
    options: [
      { text: "It has too many steps", correct: false },
      { text: "“Large” and “required calculation” are not precisely defined", correct: true },
      { text: "It contains too many inputs", correct: false },
      { text: "It is necessarily infinite", correct: false },
    ],
  },
  {
    id: "m48",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A developer first identifies the essential features of a hospital system and ignores details irrelevant to patient appointment scheduling. This primarily demonstrates:",
    explanation:
      "Identifying essential features and ignoring what is irrelevant to the task at hand is abstraction — focus on the appointment-scheduling view, hide the rest.",
    options: [
      { text: "Abstraction", correct: true },
      { text: "Decomposition", correct: false },
      { text: "Pattern recognition", correct: false },
      { text: "Compilation", correct: false },
    ],
  },
  {
    id: "m49",
    type: "MCQ",
    difficulty: "HARD",
    stem: `A student creates the following solution:

Divide the problem into smaller tasks.
Identify similarities with previously solved problems.
Ignore unnecessary details.
Develop a sequence of precise steps.

Which computational thinking concepts are represented in order?`,
    explanation:
      "The order matches: decomposition (divide tasks) → pattern recognition (find similarities) → abstraction (ignore unnecessary details) → algorithm (precise steps).",
    options: [
      { text: "Abstraction → Pattern recognition → Decomposition → Algorithm", correct: false },
      { text: "Decomposition → Pattern recognition → Abstraction → Algorithm", correct: true },
      { text: "Pattern recognition → Decomposition → Algorithm → Abstraction", correct: false },
      { text: "Algorithm → Abstraction → Decomposition → Pattern recognition", correct: false },
    ],
  },
  {
    id: "m50",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A company wants software to calculate employee salaries. The programmer identifies employee details, attendance, basic salary, allowances and deductions, then designs a sequence of steps to calculate the final salary. Which statement best describes this approach?",
    explanation:
      "The approach combines problem analysis (identifying inputs), decomposition (grouping details) and algorithm design (a step sequence). It is not merely coding, hardware or free of computational thinking.",
    options: [
      { text: "Only coding is involved", correct: false },
      { text: "It combines problem analysis, decomposition and algorithm design", correct: true },
      { text: "It is purely hardware design", correct: false },
      { text: "It does not involve computational thinking", correct: false },
    ],
  },

  // ==================================================== MCQ 51–80 (set three)
  {
    id: "m51",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which statement best explains why a computer cannot solve an inadequately defined problem reliably?",
    explanation:
      "Computers follow instructions literally, so they need precise instructions and clearly defined requirements. A vague problem cannot be translated into reliable steps.",
    options: [
      { text: "Computers cannot perform calculations", correct: false },
      { text: "Computers require precise instructions and clearly defined requirements", correct: true },
      { text: "Computers cannot store algorithms", correct: false },
      { text: "Computers can only solve mathematical problems", correct: false },
    ],
  },
  {
    id: "m52",
    type: "MCQ",
    difficulty: "EASY",
    stem: "In computational problem solving, the term solution space refers to:",
    explanation:
      "The solution space is the set of all possible solutions to a problem, from which the best one is chosen. It has nothing to do with storage, screens or memory.",
    options: [
      { text: "The physical storage available on a computer", correct: false },
      { text: "The set of possible solutions to a problem", correct: true },
      { text: "The screen area occupied by a program", correct: false },
      { text: "The memory required by an algorithm", correct: false },
    ],
  },
  {
    id: "m53",
    type: "MCQ",
    difficulty: "EASY",
    stem: "A student is asked to determine whether a number is even or odd. Which information is essential for designing the solution?",
    explanation:
      "The essential input is the number and the essential rule is the condition that distinguishes even and odd (a number is even if it is divisible by 2). Colour, monitor size and language choice are irrelevant.",
    options: [
      { text: "The colour of the number", correct: false },
      { text: "The size of the monitor", correct: false },
      { text: "The condition that distinguishes even and odd numbers", correct: true },
      { text: "The name of the programming language only", correct: false },
    ],
  },
  {
    id: "m54",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which of the following is a constraint in a computational problem?",
    explanation:
      "A constraint is a condition or limitation a valid solution must satisfy, such as a time limit or a data range. The final answer, the programmer's name and the UI colour are not constraints.",
    options: [
      { text: "A condition or limitation that the solution must satisfy", correct: true },
      { text: "The final answer produced by the program", correct: false },
      { text: "The name of the programmer", correct: false },
      { text: "The colour of the user interface", correct: false },
    ],
  },
  {
    id: "m55",
    type: "MCQ",
    difficulty: "EASY",
    stem: "A school database must store only students who are currently enrolled. “Currently enrolled” is an example of a:",
    explanation:
      "‘Currently enrolled’ restricts which records are valid, so it is a constraint on the data. It is not a compiler, pattern or hardware device.",
    options: [
      { text: "Constraint", correct: true },
      { text: "Compiler", correct: false },
      { text: "Pattern", correct: false },
      { text: "Hardware device", correct: false },
    ],
  },
  {
    id: "m56",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which activity is most closely associated with problem analysis?",
    explanation:
      "Analysis identifies the inputs, outputs and required operations. Installing an OS, choosing a brand or formatting a disk are unrelated to analysing a problem.",
    options: [
      { text: "Identifying inputs, outputs and required operations", correct: true },
      { text: "Installing an operating system", correct: false },
      { text: "Choosing a computer brand", correct: false },
      { text: "Formatting a hard disk", correct: false },
    ],
  },
  {
    id: "m57",
    type: "MCQ",
    difficulty: "EASY",
    stem: "A programmer wants to solve a problem that involves finding the shortest route between locations. Which factor should be considered during problem analysis?",
    explanation:
      "The relationship between locations and distances is the core of the problem. Map colour, monitor resolution and keyboard layout are irrelevant details that abstraction would set aside.",
    options: [
      { text: "The relationship between locations and distances", correct: true },
      { text: "The colour of the map", correct: false },
      { text: "The monitor resolution", correct: false },
      { text: "The keyboard layout", correct: false },
    ],
  },
  {
    id: "m58",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which of the following is an example of a computational problem?",
    explanation:
      "Finding the highest temperature in a dataset is a well-defined computational problem with clear inputs and output. Deciding favourite songs, attractive colours or favourite food is subjective.",
    options: [
      { text: "Choosing your favourite song", correct: false },
      { text: "Finding the highest temperature recorded in a dataset", correct: true },
      { text: "Deciding which colour looks attractive", correct: false },
      { text: "Selecting a favourite food", correct: false },
    ],
  },
  {
    id: "m59",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which characteristic makes an operation in an algorithm effective?",
    explanation:
      "An effective operation can be carried out in a practical, finite number of steps without guessing. Requiring English text or heaps of instructions is not effectiveness.",
    options: [
      { text: "It can be carried out in a practical and finite number of steps", correct: true },
      { text: "It must require human guessing", correct: false },
      { text: "It must be written in English only", correct: false },
      { text: "It must use the largest possible number of instructions", correct: false },
    ],
  },
  {
    id: "m60",
    type: "MCQ",
    difficulty: "EASY",
    stem: "What is the primary purpose of testing a proposed solution?",
    explanation:
      "Testing checks whether the solution works correctly across relevant cases. It does not speed up hardware, remove analysis, or turn hardware into software.",
    options: [
      { text: "To make the computer physically faster", correct: false },
      { text: "To determine whether the solution works correctly for relevant cases", correct: true },
      { text: "To eliminate the need for problem analysis", correct: false },
      { text: "To convert hardware into software", correct: false },
    ],
  },
  {
    id: "m61",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A student tests a program using 0, negative numbers and very large numbers. These are examples of testing:",
    explanation:
      "0, negatives and very large values represent different types of possible input cases — including edge cases. They are not normal-case-only testing, hardware checks or syntax checks.",
    options: [
      { text: "Only normal cases", correct: false },
      { text: "Different types of possible input cases", correct: true },
      { text: "Hardware compatibility", correct: false },
      { text: "Programming syntax only", correct: false },
    ],
  },
  {
    id: "m62",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Why should an algorithm be independent of a particular programming language?",
    explanation:
      "The logical solution can be implemented in any suitable programming language, so the algorithm should describe logic, not syntax. Algorithms certainly contain logic and can be stored.",
    options: [
      { text: "Algorithms cannot contain logic", correct: false },
      { text: "The logical solution can be implemented in different programming languages", correct: true },
      { text: "Programming languages cannot perform calculations", correct: false },
      { text: "Algorithms are hardware components", correct: false },
    ],
  },
  {
    id: "m63",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which of the following could be considered an edge case while designing a program to divide two numbers?",
    explanation:
      "Dividing by zero is the classic edge case — an unusual input that breaks a naive implementation. Dividing 20 by 5 and similar examples are normal cases.",
    options: [
      { text: "Dividing 20 by 5", correct: false },
      { text: "Dividing 100 by 10", correct: false },
      { text: "Dividing a number by zero", correct: true },
      { text: "Dividing 50 by 2", correct: false },
    ],
  },
  {
    id: "m64",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A program for calculating examination grades must handle a student who obtains exactly the minimum passing marks. Why is this case important?",
    explanation:
      "Exactly the minimum passing mark sits on a boundary of the grading rule, where a careless comparison test may give the wrong result. It is a classic boundary case.",
    options: [
      { text: "It may test a boundary condition in the grading rule", correct: true },
      { text: "It tests the keyboard", correct: false },
      { text: "It makes the program shorter", correct: false },
      { text: "It eliminates the need for input", correct: false },
    ],
  },
  {
    id: "m65",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which activity most directly helps identify whether a proposed algorithm handles unusual inputs correctly?",
    explanation:
      "Testing with unusual and boundary inputs is precisely what reveals how an algorithm behaves on those cases. Formatting or documentation cannot do this.",
    options: [
      { text: "Testing", correct: true },
      { text: "Formatting", correct: false },
      { text: "Compilation only", correct: false },
      { text: "Documentation only", correct: false },
    ],
  },
  {
    id: "m66",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A programmer first creates a simple solution and then improves it after analysing its limitations. This reflects which general problem-solving principle?",
    explanation:
      "Iterative refinement means building a working simple version and improving it step by step. It is a disciplined, planned process — not guessing, abstraction or deletion.",
    options: [
      { text: "Iterative refinement", correct: true },
      { text: "Random guessing", correct: false },
      { text: "Hardware abstraction", correct: false },
      { text: "Data deletion", correct: false },
    ],
  },
  {
    id: "m67",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Why is it useful to write an algorithm before writing program code?",
    explanation:
      "The algorithm lets you plan the logic independently of any language's syntax. It does not auto-write the program, remove every error, or remove testing.",
    options: [
      { text: "It allows the logic of the solution to be planned independently of syntax", correct: true },
      { text: "It automatically creates the final program", correct: false },
      { text: "It removes all possible errors", correct: false },
      { text: "It eliminates the need for testing", correct: false },
    ],
  },
  {
    id: "m68",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which situation demonstrates generalisation in computational thinking?",
    explanation:
      "Generalisation builds a solution that handles a whole class of similar problems, not just one input. A solution for one specific input is the opposite.",
    options: [
      { text: "Creating a solution that works only for one specific input", correct: false },
      { text: "Developing a solution that can handle a broader class of similar problems", correct: true },
      { text: "Removing all inputs from a problem", correct: false },
      { text: "Replacing a computer with a calculator", correct: false },
    ],
  },
  {
    id: "m69",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A student develops a method to calculate the area of one specific rectangle. Later, the method is modified to calculate the area of any rectangle. This modification demonstrates:",
    explanation:
      "Extending a method from one case to any similar case is generalisation. The broader method works for a whole class of rectangle inputs.",
    options: [
      { text: "Generalisation", correct: true },
      { text: "Hardware testing", correct: false },
      { text: "Compilation", correct: false },
      { text: "Randomisation", correct: false },
    ],
  },
  {
    id: "m70",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Which of the following is most likely to make an algorithm difficult to maintain?",
    explanation:
      "Repeated, unnecessarily complicated logic is hard to read and maintain. Clear structure, meaningful steps and well-defined inputs/outputs all help maintainability.",
    options: [
      { text: "Clear structure and meaningful steps", correct: false },
      { text: "Repeated, unnecessarily complicated logic", correct: true },
      { text: "Clearly defined inputs", correct: false },
      { text: "Well-defined outputs", correct: false },
    ],
  },
  {
    id: "m71",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A programmer notices that two parts of a problem require the same calculation. Reusing the common solution primarily reflects:",
    explanation:
      "Spoting a repeated calculation and reusing one solution for both places is recognising and exploiting a pattern. It makes the solution shorter and easier to maintain.",
    options: [
      { text: "Recognising and exploiting a pattern", correct: true },
      { text: "Ignoring the problem", correct: false },
      { text: "Increasing ambiguity", correct: false },
      { text: "Removing the input", correct: false },
    ],
  },
  {
    id: "m72",
    type: "MCQ",
    difficulty: "HARD",
    stem: "Which statement about pattern recognition is correct?",
    explanation:
      "Pattern recognition means identifying recurring similarities or structures across problems. It does not remove detail (that is abstraction) and is not about hardware or translation.",
    options: [
      { text: "It means identifying recurring similarities or structures", correct: true },
      { text: "It means removing all details from a problem", correct: false },
      { text: "It means dividing hardware into components", correct: false },
      { text: "It means translating Python into machine language", correct: false },
    ],
  },
  {
    id: "m73",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A weather-analysis program receives temperatures in Celsius but the required output is Fahrenheit. Which part of problem analysis identifies this transformation?",
    explanation:
      "The transformation (Celsius → Fahrenheit) is processing that the program must perform. It is identified during analysis as the processing required between input and output.",
    options: [
      { text: "Processing", correct: true },
      { text: "Output device", correct: false },
      { text: "Storage", correct: false },
      { text: "Hardware configuration", correct: false },
    ],
  },
  {
    id: "m74",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A problem requires calculating the total price of items after applying a discount and tax. Which sequence is logically most appropriate?",
    explanation:
      "Start from the relevant price, apply the discount, then apply tax to the discounted price, and obtain the final amount. The alternatives reorder steps or add random operations.",
    options: [
      { text: "Apply tax → determine original price → apply discount", correct: false },
      { text: "Determine relevant price → apply discount → calculate applicable tax → obtain final amount", correct: true },
      { text: "Display final amount → calculate discount → enter prices", correct: false },
      { text: "Apply random operations → display result", correct: false },
    ],
  },
  {
    id: "m75",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A programmer is given the following requirement: “Create a system that is fast and user-friendly.” Why is this requirement insufficient for directly designing an algorithm?",
    explanation:
      "‘Fast’ and ‘user-friendly’ are subjective until given measurable or precise definitions (e.g. respond within 2 seconds). Vague requirements cannot be turned into definite algorithm steps.",
    options: [
      { text: "It contains no computer hardware", correct: false },
      { text: "Terms such as “fast” and “user-friendly” need measurable or precise definitions", correct: true },
      { text: "Algorithms cannot be used for systems", correct: false },
      { text: "User requirements are never relevant", correct: false },
    ],
  },
  {
    id: "m76",
    type: "MCQ",
    difficulty: "HARD",
    stem: 'Consider the following problem: "Find students whose marks are above the class average." Which dependency must be resolved before identifying such students?',
    explanation:
      "The comparison needs the class average, so the average must be calculated first. Nothing about deleting students, monitor resolution or language choice affects the logic.",
    options: [
      { text: "The class average must first be calculated", correct: true },
      { text: "The students must first be deleted", correct: false },
      { text: "The monitor resolution must be determined", correct: false },
      { text: "The programming language must be changed", correct: false },
    ],
  },
  {
    id: "m77",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A programmer solves a problem by first identifying the major task, then breaking it into smaller tasks, solving each task and combining the results. Which strategy is this closest to?",
    explanation:
      "This is divide-and-conquer style decomposition: split the problem, solve the pieces, and combine the solutions. It is a planned strategy, not random search or hardware work.",
    options: [
      { text: "Divide-and-conquer style problem decomposition", correct: true },
      { text: "Random search", correct: false },
      { text: "Hardware optimisation", correct: false },
      { text: "Data encryption", correct: false },
    ],
  },
  {
    id: "m78",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A solution works correctly for positive integers but produces incorrect results for negative integers. What does this most strongly indicate?",
    explanation:
      "The failure on negatives means the solution did not adequately consider the complete input domain. Computers process integers fine; there is no reason negatives are invalid here.",
    options: [
      { text: "The algorithm or implementation has not adequately considered the complete input domain", correct: true },
      { text: "The computer cannot process integers", correct: false },
      { text: "Negative numbers are not valid inputs in computational problems", correct: false },
      { text: "Testing is unnecessary", correct: false },
    ],
  },
  {
    id: "m79",
    type: "MCQ",
    difficulty: "HARD",
    stem: `Consider the following design process:

Requirement → ? → Algorithm → Implementation → Testing

Which stage is most appropriate in the missing position?`,
    explanation:
      "After gathering requirements, the next stage is problem analysis and solution design, which then feeds the algorithm. Hardware manufacturing, deletion and random input do not fit.",
    options: [
      { text: "Problem analysis and solution design", correct: true },
      { text: "Hardware manufacturing", correct: false },
      { text: "Software deletion", correct: false },
      { text: "Random input generation", correct: false },
    ],
  },
  {
    id: "m80",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A programmer is given a large problem. They identify its essential requirements, divide it into manageable components, identify reusable patterns, design a precise procedure and test it against normal and boundary cases. What does this demonstrate overall?",
    explanation:
      "This joins every computational-thinking technique — analysis, abstraction, decomposition, pattern recognition, algorithm design and testing — into one systematic problem-solving approach.",
    options: [
      { text: "A systematic computational problem-solving approach", correct: true },
      { text: "Only programming syntax", correct: false },
      { text: "Only computer hardware knowledge", correct: false },
      { text: "Only data storage management", correct: false },
    ],
  },

  // ==================================================== UPLOAD 01–20
  {
    id: "u01",
    type: "UPLOAD",
    difficulty: "EASY",
    stem: "Write a step-by-step algorithm to calculate the sum of two numbers. Your answer must include the input, the processing, the output, and a proper beginning and termination. Upload a clear photograph of your written algorithm.",
    explanation:
      "The algorithm must state its start, read two inputs, add them, display the result and stop — e.g. Start → Input a, b → sum = a + b → Display sum → Stop. Marks are for input/output stated, a correct processing step, and explicit start and stop.",
  },
  {
    id: "u02",
    type: "UPLOAD",
    difficulty: "EASY",
    stem: "Draw a flowchart to calculate the area of a rectangle. The flowchart should accept the length and breadth and display the calculated area. Upload a photograph of your handwritten flowchart.",
    explanation:
      "Use an oval terminal (Start/Stop), a parallelogram to input length and breadth, a rectangle to compute area = length × breadth, and a parallelogram to display the area. Labels must be correct.",
  },
  {
    id: "u03",
    type: "UPLOAD",
    difficulty: "EASY",
    stem: "Write an algorithm and draw a flowchart to calculate the perimeter of a square. Perimeter = 4 × side. Upload one photograph containing both the algorithm and flowchart.",
    explanation:
      "Both representations must show: input 'side', processing perimeter = 4 × side, output of the perimeter, and a clear start/stop. The flowchart must use the standard symbols.",
  },
  {
    id: "u04",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem: "Draw a flowchart that accepts a number and determines whether it is positive, negative, or zero. Your flowchart must contain appropriate decision-making logic. Upload a photograph of the completed flowchart.",
    explanation:
      "After input, a decision diamond tests the number (e.g. 'is it > 0?'); the yes branch prints Positive. A second decision tests '< 0' printing Negative, else the remaining branch prints Zero. Full branching must be covered.",
  },
  {
    id: "u05",
    type: "UPLOAD",
    difficulty: "EASY",
    stem: "Write an algorithm to determine whether a given number is even or odd. Do not write Python code — write only the logical steps of the algorithm. Upload a photograph of your handwritten answer.",
    explanation:
      "State start, input the number, compute the remainder when divided by 2, and use a decision: remainder 0 → display Even, otherwise display Odd, then stop. No code allowed; only structured steps.",
  },
  {
    id: "u06",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem: "Draw a flowchart to accept two numbers and display the larger number. Your flowchart must correctly handle the situation where both numbers are equal. Upload a photograph of the flowchart.",
    explanation:
      "Input a and b, then decide: if a > b display a, else if b > a display b, else display 'equal'. A well-labelled decision diamond and the equality branch must both appear.",
  },
  {
    id: "u07",
    type: "UPLOAD",
    difficulty: "EASY",
    stem: "A student's marks in three subjects are given. Write an algorithm and draw a flowchart to calculate Total Marks = Physics + Chemistry + Mathematics. Upload a photograph showing both answers.",
    explanation:
      "Both the algorithm and flowchart must show input of three marks, the addition step, and output of the total, with a clear start and stop. Use the correct flowchart symbols.",
  },
  {
    id: "u08",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem: "Draw a flowchart that accepts marks in five subjects, calculates the average and displays it. The flowchart should clearly show the inputs, the calculation and the output. Upload a photograph of your flowchart.",
    explanation:
      "Read five marks, compute average = sum ÷ 5, and display it. Each of input, processing and output must be clearly drawn and labelled, with start and stop terminals.",
  },
  {
    id: "u09",
    type: "UPLOAD",
    difficulty: "EASY",
    stem: "A shopkeeper wants to calculate the final bill amount after giving a discount. Write an algorithm that accepts the original price and the discount percentage, and calculates the final price. Upload a photograph of your algorithm.",
    explanation:
      "The algorithm must read original price and discount percentage, compute discount = price × percent ÷ 100, then final price = price − discount, display it, and stop.",
  },
  {
    id: "u10",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem: "Draw a flowchart that accepts a student's marks and determines whether the student has passed or failed. Assume Marks ≥ 33 → PASS and Marks < 33 → FAIL. Upload a photograph of the flowchart.",
    explanation:
      "Input marks, use a decision diamond on 'marks ≥ 33?': yes branch displays PASS, no branch displays FAIL, then stop on both paths. The boundary at 33 must be exact.",
  },
  {
    id: "u11",
    type: "UPLOAD",
    difficulty: "HARD",
    stem: "Write an algorithm and draw a flowchart to find the largest among three numbers. Your solution must correctly handle cases where the first, second or third number is largest, and cases where two or more are equal. Upload a photograph containing both.",
    explanation:
      "Compare A with B; whichever is larger is compared with C. Handle equal values so ties still produce a correct largest value. The flowchart must use decision diamonds at each comparison and a single output.",
  },
  {
    id: "u12",
    type: "UPLOAD",
    difficulty: "HARD",
    stem: "Draw a flowchart to find the smallest among three numbers. Use appropriate decision symbols and logical conditions. Upload a photograph of your handwritten flowchart.",
    explanation:
      "Mirror the 'largest of three' logic: compare A and B to keep the smaller, then compare that with C. Use a correct decision diamond and cover ties.",
  },
  {
    id: "u13",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem: "Write an algorithm to calculate Simple Interest and the total amount. Given SI = (P × R × T) / 100 and Amount = P + SI, where P = Principal, R = Rate and T = Time. Upload a photograph of your algorithm.",
    explanation:
      "Input P, R and T; compute SI with the formula; compute amount as P + SI; display both; and terminate. Show both formulas and a clear start/stop.",
  },
  {
    id: "u14",
    type: "UPLOAD",
    difficulty: "HARD",
    stem: "Draw a flowchart that accepts an integer and determines whether it is divisible by both 3 and 5. Upload a photograph of your completed flowchart.",
    explanation:
      "Use two decision diamonds in sequence (remainder mod 3 = 0, then remainder mod 5 = 0); only if both hold display 'divisible by 3 and 5', otherwise display 'not divisible'. Both branches must terminate.",
  },
  {
    id: "u15",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem: "Create an algorithm and flowchart to convert temperature from Celsius to Fahrenheit. Use F = (9 × C / 5) + 32. Upload a photograph containing both the algorithm and flowchart.",
    explanation:
      "Input the Celsius value, apply the conversion formula exactly, display the Fahrenheit result, and stop in both forms. Verify the formula and order of operations are drawn correctly.",
  },
  {
    id: "u16",
    type: "UPLOAD",
    difficulty: "HARD",
    stem: "Draw a flowchart for assigning grades: 90–100 → A, 75–89 → B, 60–74 → C, 40–59 → D, Below 40 → F. Your flowchart must use appropriate multiple decision conditions. Upload a photograph of the flowchart.",
    explanation:
      "Chain decision diamonds from the highest grade down: marks ≥ 90 → A; else ≥ 75 → B; else ≥ 60 → C; else ≥ 40 → D; else F. Each branch displays its grade and stops.",
  },
  {
    id: "u17",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem: "A school needs to calculate the total fees paid by a student over 12 months. Write a generalised algorithm that accepts the monthly fee and calculates the annual fee. Your algorithm should not assume a particular fee amount. Upload a photograph of your algorithm.",
    explanation:
      "Input the monthly fee once, multiply by 12 to get the annual fee, display it, and stop. The fee stays an input so the same algorithm works for any amount — this is a generalised solution.",
  },
  {
    id: "u18",
    type: "UPLOAD",
    difficulty: "HARD",
    stem: "Draw a flowchart to display the numbers 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Your solution must demonstrate repetition/iteration rather than writing ten separate output steps. Upload a photograph of the flowchart.",
    explanation:
      "Initialise a counter (e.g. num = 1), display it, increment it, and loop back while num ≤ 10, exiting the loop when the condition fails and stopping. The iteration symbol/decision must be explicit.",
  },
  {
    id: "u19",
    type: "UPLOAD",
    difficulty: "HARD",
    stem: "A school examination system needs to accept student details, accept marks, calculate total, calculate percentage, determine pass/fail and display the result. a) Break this problem into smaller logical components (decomposition). b) Write an algorithm for the overall process. c) Draw a flowchart representing the process. Upload photograph(s) containing all three parts.",
    explanation:
      "a) Components such as input, calculation, decision and output. b) The algorithm must sequence those components with a pass/fail decision. c) The flowchart must show terminals, a decision diamond for pass/fail, and a single result output.",
  },
  {
    id: "u20",
    type: "UPLOAD",
    difficulty: "HARD",
    stem: "A cinema charges ₹200 per ticket. If a customer purchases more than 5 tickets, a 10% discount is provided on the total ticket cost. a) Identify the inputs. b) Identify the processing required. c) Identify the output. d) Write a complete algorithm. e) Draw a complete flowchart. Your flowchart must correctly handle both cases: 5 or fewer tickets, and more than 5 tickets. Upload a clear photograph of your complete handwritten solution.",
    explanation:
      "Input: number of tickets. Processing: total = n × 200, then decide with a diamond — if n > 5 apply 10% discount, else keep total; final = discounted or undiscounted total. Output: final payable amount. Both branches shown and terminated.",
  },

  // ====================================================== ORAL 01–20
  {
    id: "o01",
    type: "ORAL",
    difficulty: "EASY",
    stem: "What do you understand by a computational problem?",
    explanation:
      "A computational problem is one that can be solved with a computer: it has clearly defined inputs, a well-defined processing step and a defined output, and the solution can be expressed as an algorithm.",
  },
  {
    id: "o02",
    type: "ORAL",
    difficulty: "EASY",
    stem: "Why is it important to understand the problem completely before attempting to solve it?",
    explanation:
      "Without understanding, you cannot state the inputs, the required outputs or the constraints. An incomplete understanding produces a solution to the wrong problem, wasting effort and time.",
  },
  {
    id: "o03",
    type: "ORAL",
    difficulty: "EASY",
    stem: "What is the difference between a problem and a solution?",
    explanation:
      "A problem is the task or difficulty to be resolved — defined by its inputs, output and constraints. A solution is the method (usually an algorithm or program) that transforms the inputs into the correct output.",
  },
  {
    id: "o04",
    type: "ORAL",
    difficulty: "EASY",
    stem: "What is meant by identifying the input and output of a problem?",
    explanation:
      "Input is the data given to the program; output is the result it must produce. Identifying both precisely tells you what processing is required and what a correct answer looks like.",
  },
  {
    id: "o05",
    type: "ORAL",
    difficulty: "EASY",
    stem: "Can the same problem have more than one valid algorithm? Explain briefly.",
    explanation:
      "Yes. Many different step sequences can yield the same correct output, so several valid algorithms may exist for one problem. What matters is that each is definite, finite and correct.",
  },
  {
    id: "o06",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "What is meant by computational thinking?",
    explanation:
      "Computational thinking is the process of formulating a problem and its solution so that a computer — or a person following rules — can carry it out. It emphasises systematic, step-by-step reasoning.",
  },
  {
    id: "o07",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "Name the major techniques commonly associated with computational thinking.",
    explanation:
      "The four core techniques are decomposition, pattern recognition, abstraction and algorithmic design (defining the sequence of steps). Together they convert a messy problem into a solvable one.",
  },
  {
    id: "o08",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "Suppose you are asked to design an online shopping system. How would decomposition help you?",
    explanation:
      "Decomposition splits the system into manageable modules such as login/registration, product catalogue, shopping cart, payment and order tracking. Each module can then be designed, built and tested separately.",
  },
  {
    id: "o09",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "Give a real-life example of abstraction without using a computer.",
    explanation:
      "A phone number abstracts away a person's address; a bus route number abstracts the detailed route; a map of the metro shows only stations, not every building. In each case irrelevant details are hidden to keep what matters.",
  },
  {
    id: "o10",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "How is pattern recognition useful when solving a new problem?",
    explanation:
      "If the new problem contains patterns you have seen before, you can reuse or adapt an existing solution instead of starting from scratch. It saves time and reduces errors.",
  },
  {
    id: "o11",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "What makes an algorithm different from a random sequence of instructions?",
    explanation:
      "An algorithm is ordered, definite and finite, and it is designed to solve a particular problem. Random instructions lack this purpose and are not guaranteed to terminate or produce a correct result.",
  },
  {
    id: "o12",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "Why must the steps of an algorithm be unambiguous?",
    explanation:
      "If a step can be interpreted in more than one way, different people (or the same person at different times) may execute different instructions and get different results. Unambiguity — definiteness — is required for a single correct execution.",
  },
  {
    id: "o13",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "What would happen if an algorithm had no definite stopping point?",
    explanation:
      "It would loop forever and never deliver an output — violating finiteness. An algorithm must terminate after a finite number of steps to be a valid algorithm.",
  },
  {
    id: "o14",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "Is an algorithm required to be written in a programming language? Why or why not?",
    explanation:
      "No. An algorithm is language-independent logic and can be written in plain English, pseudocode or a flowchart. A programming language is just one way of implementing it.",
  },
  {
    id: "o15",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "If two algorithms produce the same correct output, can both be considered valid solutions? Give a reason.",
    explanation:
      "Yes, both are valid as long as each is definite, finite and produces the correct result for all required inputs. Correctness of output — not a unique method — is the test of validity.",
  },
  {
    id: "o16",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "You are designing a program that determines whether a person is eligible for a particular age-based service. What information would you identify before designing the algorithm?",
    explanation:
      "The inputs (the person's age, and any other eligibility data), the exact eligibility rule (minimum/maximum age), the output (eligible or not) and any constraints such as date-of-birth handling or error cases.",
  },
  {
    id: "o17",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "Why should a solution be tested with different types of input rather than only one example?",
    explanation:
      "One example only checks one path. Different inputs — normal, large, zero, negative, boundary — exercise different branches and edge cases, exposing errors that a single case would miss.",
  },
  {
    id: "o18",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "What is a boundary case, and why can it be important when testing a solution?",
    explanation:
      "A boundary case is an input exactly at the edge of a rule or range, such as exactly the passing marks or dividing by zero. Bugs often hide at boundaries where a comparison uses the wrong operator.",
  },
  {
    id: "o19",
    type: "ORAL",
    difficulty: "HARD",
    stem: "A student says, “Once an algorithm gives the correct answer for one input, we know the algorithm is correct.” Do you agree? Explain your reasoning.",
    explanation:
      "No. One correct result proves nothing about all possible inputs. The algorithm may be wrong for other cases, especially edge cases. Correctness must be argued for the whole input domain, and tested on normal, boundary and unusual cases.",
  },
  {
    id: "o20",
    type: "ORAL",
    difficulty: "HARD",
    stem: "Suppose you are given a very complicated real-world problem but no programming language has been selected yet. Can you begin solving the problem? Explain what you would do first and why.",
    explanation:
      "Yes. Language choice is an implementation detail. First, analyse the problem: identify inputs, outputs and constraints; use decomposition and abstraction to manage complexity; recognise patterns; and design the algorithm — all before any language is chosen.",
  },
];