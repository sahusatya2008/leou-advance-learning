/**
 * Assignments: CBSE Class 11 Computer Science — "Problem Solving &
 * Computational Thinking".
 *
 * Design rules (all enforced by scripts/dev-problem-solving-assignments.ts):
 *   - every assignment is UNTYPED in the sense of "no mixing": each paper is
 *     PURE — an MCQ paper holds only MCQs, an Upload paper only photo-upload
 *     written/flowchart work, an Oral paper only viva questions. This keeps
 *     grading (auto for MCQ, teacher-reviewed for Upload/Oral) clean and the
 *     student experience predictable.
 *   - every paper is untimed (durationMinutes = 0, rendered as "No time limit"
 *     by src/lib/assessmentTime.ts) with unlimited attempts (maxAttempts =
 *     null), status RELEASED and no start/end window, so a student can work
 *     through practice at their own pace.
 *   - every assessment is topic-scoped to the SubjectPricingItem of the same
 *     name, so only students whose active plan lists that chapter (and who are
 *     members of the batch) can see/attempt it (assessmentTopicAllowed).
 *   - the 80 MCQs, 20 uploads and 20 orals are each partitioned across their
 *     own papers, so every question is used exactly once within its type (a
 *     student answers every question in the chapter exactly once). Revisions
 *     are handled by mixing the type-pure papers, not by duplicating questions.
 */

export type BankAssignment = {
  /** 1-based number used in the title, e.g. 7 -> "… 07: …". */
  n: number;
  title: string;
  instructions: string;
  /** [questionId, marks] in the order the student will see them. */
  items: Array<[string, number]>;
};

const MCQ_HOW_TO =
  "Untimed practice with unlimited attempts. Start when you like and submit when you are ready. Every question is single-correct; choose the one best option and press Submit. You will see your result and explanation immediately after submitting. You may attempt this paper as many times as you need.";

const UPLOAD_HOW_TO =
  "Untimed written/practical work with unlimited attempts. Write or draw your full solution neatly on paper, then upload a clear photograph of it using the upload control. Include input, processing, output and a clear start/stop wherever an algorithm or flowchart is asked for. Your teacher will review and return the marked answer.";

const ORAL_HOW_TO =
  "Untimed viva with unlimited attempts. Answer each question aloud (or in writing, if you prefer), as clearly and completely as you can. Your teacher will assess your understanding and give feedback.";

export const PROBLEM_SOLVING_ASSIGNMENTS: BankAssignment[] = [
  // ------------------------------------------------------------------ MCQ (80)
  {
    n: 1,
    title: "Problem Solving 01: Foundations & First Steps",
    instructions: `The building blocks: what problem solving is, what an algorithm is, and the first step in solving any computational problem. ${MCQ_HOW_TO}`,
    items: [
      ["m01", 1], // first step in solving a computational problem
      ["m02", 1], // best describes problem solving
      ["m06", 1], // an algorithm is
      ["m08", 1], // NOT a characteristic of a good algorithm
      ["m15", 1], // logical problem-solving sequence
      ["m16", 1], // "appropriate operation" problematic instruction
      ["m33", 1], // steps should be
      ["m39", 1], // well-designed algorithm should have
      ["m50", 1], // computer cannot solve an inadequately defined problem
      ["m66", 1], // why write an algorithm before code
    ],
  },
  {
    n: 2,
    title: "Problem Solving 02: Definiteness, Finiteness & Effectiveness",
    instructions: `The properties that separate a real algorithm from a vague list of steps: definiteness, finiteness and effectiveness. ${MCQ_HOW_TO}`,
    items: [
      ["m07", 1], // must eventually terminate
      ["m17", 1], // definiteness violated (multiple interpretations)
      ["m22", 1], // inspect algorithm for definiteness
      ["m23", 1], // which algorithm is definite
      ["m24", 1], // no stopping condition -> finiteness
      ["m34", 1], // finite process
      ["m40", 1], // inspect algorithm
      ["m41", 1], // simple interest algorithm (definite?)
      ["m46", 1], // "if the number is large" ambiguous
      ["m58", 1], // characteristic making an operation effective
    ],
  },
  {
    n: 3,
    title: "Problem Solving 03: Decomposition",
    instructions: `Breaking a large problem into smaller, manageable parts — with real scenarios. ${MCQ_HOW_TO}`,
    items: [
      ["m03", 1], // breaking into smaller parts = decomposition
      ["m11", 1], // school-management into modules
      ["m14", 1], // best example of decomposition
      ["m21", 1], // admission/attendance/exam/fees modules
      ["m29", 1], // largest of three numbers
      ["m43", 1], // attendance decomposition
      ["m44", 1], // why decomposition is useful
      ["m49", 1], // employee-salary approach
      ["m76", 1], // major task -> smaller -> combine
      ["m79", 1], // overall computational thinking demo
    ],
  },
  {
    n: 4,
    title: "Problem Solving 04: Pattern Recognition & Generalisation",
    instructions: `Spotting common structure across problems, and widening a solution to a whole class of problems. ${MCQ_HOW_TO}`,
    items: [
      ["m04", 1], // identifying similarities = pattern recognition
      ["m12", 1], // area of square/rect/triangle similarity
      ["m18", 1], // average of five numbers approach
      ["m19", 1], // same general procedure for three problems
      ["m27", 1], // total cost + total marks both add repeatedly
      ["m35", 1], // comparing values for maximum = pattern
      ["m42", 1], // algorithmic thinking example
      ["m45", 1], // average marks general approach
      ["m67", 1], // generalisation situation
      ["m71", 1], // pattern recognition statement
    ],
  },
  {
    n: 5,
    title: "Problem Solving 05: Abstraction",
    instructions: `Keeping only what matters and hiding the rest — and telling abstraction apart from decomposition. ${MCQ_HOW_TO}`,
    items: [
      ["m05", 1], // removing unnecessary details = abstraction
      ["m13", 1], // statement about abstraction
      ["m25", 1], // ignoring road colour = abstraction
      ["m28", 1], // both decomposition and abstraction
      ["m36", 1], // distinguishes decomposition from abstraction
      ["m37", 1], // food-delivery hides database = abstraction
      ["m47", 1], // hospital essential features = abstraction
      ["m48", 1], // inspect solution (abstraction?)
      ["m72", 1], // Celsius -> Fahrenheit transformation
      ["m80", 1], // design-process scenario
    ],
  },
  {
    n: 6,
    title: "Problem Solving 06: Problem Analysis — Inputs, Outputs & Constraints",
    instructions: `Analysing a problem before solving it: inputs, outputs and constraints. ${MCQ_HOW_TO}`,
    items: [
      ["m09", 1], // input -> processing -> output
      ["m10", 1], // inputs for area of rectangle
      ["m20", 1], // pass/fail first task before writing program
      ["m30", 1], // purpose of analysing a problem
      ["m31", 1], // input for total bill
      ["m32", 1], // output rather than input
      ["m38", 1], // first step for electricity bill
      ["m51", 1], // solution space
      ["m53", 1], // a constraint
      ["m54", 1], // "currently enrolled" is a constraint
    ],
  },
  {
    n: 7,
    title: "Problem Solving 07: Requirement Analysis & Solution Design",
    instructions: `Turning a vague requirement into a precise, designable specification. ${MCQ_HOW_TO}`,
    items: [
      ["m26", 1], // online exam: what next after decomposition
      ["m52", 1], // essential info for even/odd design
      ["m55", 1], // activity most associated with problem analysis
      ["m56", 1], // factor considered during analysis (shortest route)
      ["m57", 1], // example of a computational problem
      ["m65", 1], // improve after analysing limitations
      ["m69", 1], // makes an algorithm difficult to maintain
      ["m73", 1], // discount + tax sequence
      ["m74", 1], // "fast and user-friendly" insufficient
      ["m75", 1], // dependency: marks above class average
    ],
  },
  {
    n: 8,
    title: "Problem Solving 08: Testing, Edge Cases & Reuse",
    instructions: `Proving a solution works: normal, boundary and unusual inputs, plus reuse of common solutions. ${MCQ_HOW_TO}`,
    items: [
      ["m59", 1], // primary purpose of testing
      ["m60", 1], // testing with 0/negative/very large numbers
      ["m61", 1], // algorithm independent of a language
      ["m62", 1], // edge case dividing two numbers
      ["m63", 1], // boundary: exactly minimum passing marks
      ["m64", 1], // identify handling of unusual inputs
      ["m68", 1], // one rectangle -> any rectangle (generalisation)
      ["m70", 1], // reusing a common solution
      ["m77", 1], // works for positive, not negative -> indicates
      ["m78", 1], // design-process scenario (testing)
    ],
  },

  // --------------------------------------------------------------- UPLOAD (20)
  {
    n: 9,
    title: "Problem Solving 09: Written — Basic Algorithms",
    instructions: `Write these algorithms neatly on paper (inputs, processing, output, clear start/stop) and upload a clear photograph. Do not write Python — write only the logical steps. ${UPLOAD_HOW_TO}`,
    items: [
      ["u01", 4], // sum of two numbers
      ["u05", 4], // even or odd
      ["u09", 4], // discount final price
      ["u13", 4], // simple interest + amount
      ["u17", 4], // annual fee (generalised)
    ],
  },
  {
    n: 10,
    title: "Problem Solving 10: Written — Basic Flowcharts",
    instructions: `Draw these flowcharts using standard symbols (terminator, input/output, process, decision) and upload a clear photograph of each. ${UPLOAD_HOW_TO}`,
    items: [
      ["u02", 4], // area of rectangle
      ["u04", 4], // positive / negative / zero
      ["u06", 4], // larger of two numbers
      ["u08", 4], // average of five subjects
      ["u18", 5], // display 1..10 using iteration
    ],
  },
  {
    n: 11,
    title: "Problem Solving 11: Written — Decision Flowcharts",
    instructions: `These flowcharts turn on decisions. Use proper diamonds for every decision, label both branches, and handle all cases the question mentions. ${UPLOAD_HOW_TO}`,
    items: [
      ["u10", 5], // pass or fail (>= 33)
      ["u11", 6], // largest of three numbers
      ["u12", 6], // smallest of three numbers
      ["u14", 5], // divisible by both 3 and 5
      ["u16", 6], // grade assignment (multiple decisions)
    ],
  },
  {
    n: 12,
    title: "Problem Solving 12: Written — Advanced & HOTS",
    instructions: `Combined algorithm + flowchart work and complete problem-solving tasks. Show all three parts where asked (decomposition, algorithm, flowchart). ${UPLOAD_HOW_TO}`,
    items: [
      ["u03", 5], // perimeter of square (algo + flowchart)
      ["u07", 5], // total marks of three subjects (algo + flowchart)
      ["u15", 5], // Celsius to Fahrenheit (algo + flowchart)
      ["u19", 8], // exam system: decompose + algo + flowchart
      ["u20", 8], // cinema discount: full analysis + algo + flowchart
    ],
  },

  // ----------------------------------------------------------------- ORAL (20)
  {
    n: 13,
    title: "Problem Solving 13: Oral — Foundations",
    instructions: `Foundational viva on what a computational problem is and how problem solving works. Answer clearly and in your own words. ${ORAL_HOW_TO}`,
    items: [
      ["o01", 2], // what is a computational problem
      ["o02", 2], // understand problem before solving
      ["o03", 2], // difference between problem and solution
      ["o04", 2], // identifying input and output
      ["o05", 2], // same problem, more than one valid algorithm
    ],
  },
  {
    n: 14,
    title: "Problem Solving 14: Oral — Computational Thinking Techniques",
    instructions: `Viva on the four techniques: decomposition, pattern recognition, abstraction and algorithmic design. ${ORAL_HOW_TO}`,
    items: [
      ["o06", 2], // what is computational thinking
      ["o07", 2], // major techniques
      ["o08", 2], // decomposition for online shopping
      ["o09", 2], // real-life abstraction without a computer
      ["o10", 2], // pattern recognition for a new problem
    ],
  },
  {
    n: 15,
    title: "Problem Solving 15: Oral — Algorithm Properties",
    instructions: `Viva on what makes an algorithm an algorithm: definiteness, finiteness, and language-independence. ${ORAL_HOW_TO}`,
    items: [
      ["o11", 2], // algorithm vs random instructions
      ["o12", 2], // why steps must be unambiguous
      ["o13", 2], // no definite stopping point
      ["o14", 2], // must an algorithm use a programming language
      ["o15", 2], // two algorithms, same output — both valid?
    ],
  },
  {
    n: 16,
    title: "Problem Solving 16: Oral — Analysis & Testing (HOTS)",
    instructions: `Higher-order viva: analysing unfamiliar requirements and testing solutions thoroughly. ${ORAL_HOW_TO}`,
    items: [
      ["o16", 2], // info to identify for an age-based service
      ["o17", 2], // why test with different inputs
      ["o18", 2], // boundary case and its importance
      ["o19", 2], // one correct input != correct algorithm
      ["o20", 2], // complicated problem, no language selected yet
    ],
  },
];