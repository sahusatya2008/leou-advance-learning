/**
 * The Class 11 "Getting Started with Python" for-loop exercise set.
 *
 * Same shape as `practicalWhileLoopQuestions.ts`: each entry is one row in the
 * question bank with a starter for the student's editor, a reference solution
 * the teacher can show, and hidden test cases holding the exact expected
 * stdout. Output formatting is pinned down in the starter so the expected text
 * is unambiguous rather than a guess about spacing.
 *
 * Three of the questions below already existed in the bank as for-loop
 * exercises (they came in with the while-loop sheet because the textbook poses
 * them that way). They are marked `reuseExisting` and are only re-tagged, never
 * duplicated and never rewritten.
 *
 * This file is data only. `scripts/seed-practical-for-loop.ts` loads it.
 */

export type SeedQuestion = {
  /** Short label used in logs. Matches the question number on the sheet. */
  key: string;
  stem: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  /** Marks the question as important; the student practical page then shows a
   *  designed "Very Important" badge for it. */
  important?: boolean;
  /** Already in the question bank with this exact stem: only ensure the
   *  for-loop tags, never touch the content. */
  reuseExisting?: true;
  /** What the student starts with in the editor. */
  starterCode?: string;
  /** Reference solution. Never sent to a student's browser. */
  solutionCode?: string;
  /** Model answer shown to the teacher, and used as the question explanation. */
  explanation?: string;
  /** Hidden expected stdout. `stdin` is fed to the program before it runs. */
  testCases?: { stdin: string; expected: string }[];
};

export const FOR_LOOP_TAGS = ["for-loop", "loop"];

/** Reserved tag that marks a question as very important. Rendered as a distinct
 *  badge on the student practical page and filtered out of the plain tag chips. */
export const VERY_IMPORTANT_TAG = "very-important";

export const CHAPTER = "Getting Started with Python";

export const SEED_TITLE = "Getting Started with Python — Loop Practical";

export const SEED_INSTRUCTIONS =
  "Work through these exercises one at a time - the while-loop questions first, then the " +
  "for-loop set. Run your code in the terminal, save often, and raise a doubt on any question " +
  "you get stuck on: your code and terminal output are attached automatically so the teacher " +
  "sees exactly what you saw. Questions marked Very Important (the star) are the ones to " +
  "master before a test.";

/** Inclusive numeric range, used to build expected outputs without typos. */
const range = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  if (step > 0) for (let n = from; n <= to; n += step) out.push(n);
  else for (let n = from; n >= to; n += step) out.push(n);
  return out;
};

/** Join lines, so a big expected output stays readable in this file. */
const row = (...parts: (string | number)[]): string => parts.join("\n");

/* ------------------------------------------------------------------------- *
 * Star-pattern helpers.
 *
 * Every pattern question below prints a fixed picture. Its expected stdout is
 * generated from the same rule the reference solution follows, never copied by
 * hand: one missing space in a hand-copied picture is a question that cannot be
 * passed, and the mistake is invisible in the source.
 * ------------------------------------------------------------------------- */

/** One row of n stars separated by a single space (no trailing space). */
const starRow = (n: number): string =>
  Array.from({ length: Math.max(0, n) }, () => "*").join(" ");

/** One row of n touching stars, for the patterns drawn as a solid block. */
const solidRow = (n: number): string => "*".repeat(Math.max(0, n));

/** A left margin of n spaces. */
const margin = (n: number): string => " ".repeat(Math.max(0, n));

/** Right-align one row to `width` by padding it on the left. */
const right = (s: string, width: number): string => s.padStart(width, " ");

const sheet = (rows: string[]): string => rows.join("\n");

/** A fenced block, so the rendered question shows the picture in monospace. */
const fence = (pattern: string): string => "```\n" + pattern + "\n```";

/** Picture rows as Python comments, for a starter's hint. */
const notes = (rows: string[]): string =>
  rows.map((r) => (r.length ? `# ${r}` : "#")).join("\n");

const halfPyramid = (rows: number) => range(1, rows).map(starRow);
const mirroredHalf = (rows: number) =>
  range(1, rows).map((i) => right(starRow(i), 2 * rows - 1));
const downwardHalf = (rows: number) => range(rows, 1, -1).map(starRow);
const downwardFull = (rows: number) =>
  range(rows, 1, -1).map((i) => margin(rows - i) + starRow(i));
const rightDownMirror = (rows: number) =>
  range(rows, 1, -1).map((i) => margin(rows - i) + solidRow(i));
const equilateral = (rows: number) =>
  range(1, rows).map((i) => margin(rows - i) + starRow(i));
const twoPyramids = (rows: number) => [
  ...range(1, rows).map(starRow),
  "",
  ...range(rows, 1, -1).map(starRow),
];
const rightPascal = (rows: number) => [
  ...range(1, rows).map(starRow),
  ...range(rows - 1, 1, -1).map(starRow),
];
const leftPascal = (rows: number) => {
  const width = 2 * rows - 1;
  return [
    ...range(1, rows).map((i) => right(starRow(i), width)),
    ...range(rows - 1, 1, -1).map((i) => right(starRow(i), width)),
  ];
};
const sandglass = (rows: number) => [
  ...range(rows, 1, -1).map((i) => margin(rows - i) + starRow(i)),
  ...range(1, rows).map((i) => margin(rows - i) + starRow(i)),
];
const pant = (rows: number) => [
  solidRow(2 * rows),
  ...range(1, rows - 1).map(
    (i) => solidRow(rows - i) + margin(2 * i) + solidRow(rows - i),
  ),
];
const diamond = (rows: number) => [
  ...range(1, rows).map((i) => margin(rows - i) + starRow(i)),
  ...range(rows - 1, 1, -1).map((i) => margin(rows - i) + starRow(i)),
];
const hollowDiamond = (rows: number) => {
  const edgeRow = (i: number) =>
    i === 1
      ? margin(rows - 1) + "*"
      : margin(rows - i) + "*" + margin(2 * i - 3) + "*";
  return [...range(1, rows).map(edgeRow), ...range(rows - 1, 1, -1).map(edgeRow)];
};

/* One picture per question, so the stem and the hidden output can never drift
 * apart: both render this same array. */
const P36 = halfPyramid(5);
const P37 = mirroredHalf(5);
const P38 = downwardHalf(5);
const P39 = downwardFull(6);
const P40 = rightDownMirror(5);
const P41 = equilateral(7);
const P42 = twoPyramids(6);
const P43 = rightPascal(5);
const P44 = leftPascal(5);
const P45 = sandglass(5);
const P46 = pant(8);
const P47 = diamond(6);
const P48 = hollowDiamond(5);

export const SEED_QUESTIONS: SeedQuestion[] = [
  {
    key: "q01",
    stem: "Write a program to print the following using for loop:\na. First 10 Even numbers\nb. First 10 Odd numbers\nc. First 10 Natural numbers\nd. First 10 Whole numbers",
    difficulty: "EASY",
    important: true,
    starterCode: `# Print the following using a for loop.
# Print one number per line, and label each group.
#   a. First 10 Even numbers      -> 2 4 6 ... 20
#   b. First 10 Odd numbers       -> 1 3 5 ... 19
#   c. First 10 Natural numbers   -> 1 2 3 ... 10
#   d. First 10 Whole numbers     -> 0 1 2 ... 9
#
# A for loop takes its values from range(start, stop, step) and needs no
# counter of its own. range() stops BEFORE its stop value. Even numbers can
# be produced with a step of 2, but do not mix that with 2*i in the same loop.

print("a. First 10 Even numbers")
# your code here
`,
    solutionCode: `print("a. First 10 Even numbers")
for i in range(1, 11):
    print(2 * i)

print("b. First 10 Odd numbers")
for i in range(1, 11):
    print(2 * i - 1)

print("c. First 10 Natural numbers")
for i in range(1, 11):
    print(i)

print("d. First 10 Whole numbers")
for i in range(10):
    print(i)
`,
    explanation:
      "All four parts are the same loop with a different range. Multiplying the loop variable gives the even numbers (2*i) and the odd numbers (2*i-1); natural numbers start at 1, and whole numbers include 0 so the range starts at 0. Nothing needs to be incremented by hand - range() supplies the next value on every pass.",
    testCases: [
      {
        stdin: "",
        expected: row(
          "a. First 10 Even numbers",
          ...range(2, 20, 2),
          "b. First 10 Odd numbers",
          ...range(1, 19, 2),
          "c. First 10 Natural numbers",
          ...range(1, 10),
          "d. First 10 Whole numbers",
          ...range(0, 9),
        ),
      },
    ],
  },
  {
    key: "q02",
    stem: "Write a program to print first 10 integers and their squares using for loop.\n1     1\n2     4\n3     9 and so on",
    difficulty: "EASY",
    important: true,
    starterCode: `# Print the first 10 integers and their squares, one pair per line.
#   1 1
#   2 4
#   3 9
#
# The square is i*i - no exponent needed. print(i, i*i) puts one space
# between the two values.

for i in range(1, 11):
    # your code here
`,
    solutionCode: `for i in range(1, 11):
    print(i, i * i)
`,
    explanation:
      "One loop variable drives both columns: the number itself and its square. print(i, i * i) separates the two values with a single space, which is the alignment the question shows.",
    testCases: [
      { stdin: "", expected: row(...range(1, 10).map((i) => `${i} ${i * i}`)) },
    ],
  },
  {
    key: "q03",
    stem: "Write for loop statement to print the following series: 10, 20, 30 … … 300",
    difficulty: "EASY",
    important: true,
    reuseExisting: true,
  },
  {
    key: "q04",
    stem: "Write a for loop statement to print the following series:\n105, 98, 91 ……… 7",
    difficulty: "EASY",
    starterCode: `# Print the series 105, 98, 91 ... 7, one number per line.
# Each term is 7 less than the one before it.
#
# A negative step makes range() count downwards. It stops BEFORE the
# stop value, so the stop must be one step past the last term.

for n in range(0):
    print(n)
`,
    solutionCode: `for n in range(105, 6, -7):
    print(n)
`,
    explanation:
      "range(105, 6, -7) walks 105, 98, 91 ... 14, 7. The stop is 6 (not 7) because range() excludes the value it stops at: with a stop of 7 the final term would be missing.",
    testCases: [{ stdin: "", expected: row(...range(105, 7, -7)) }],
  },
  {
    key: "q05",
    stem: "Write a program to print first 10 natural numbers in reverse order using for loop.",
    difficulty: "EASY",
    starterCode: `# Print 10 down to 1, one number per line.
#
# Counting down is just a negative step: range(start, stop, -1).

for i in range(0):
    print(i)
`,
    solutionCode: `for i in range(10, 0, -1):
    print(i)
`,
    explanation:
      "range(10, 0, -1) produces 10, 9, 8 ... 1. The stop is 0 because range() never includes its stop value, so 1 is the last number printed.",
    testCases: [{ stdin: "", expected: row(...range(10, 1, -1)) }],
  },
  {
    key: "q06",
    stem: "Write a program to print sum of first 10 Natural numbers using for loop.",
    difficulty: "EASY",
    important: true,
    starterCode: `# Add 1 + 2 + 3 + ... + 10 and print the total.
#
# An accumulator needs a home before the loop starts: total = 0.

total = 0
for i in range(1, 11):
    # your code here

print(total)
`,
    solutionCode: `total = 0
for i in range(1, 11):
    total = total + i
print(total)
`,
    explanation:
      "Set the total to 0 before the loop, add each number to it during the loop, and print it after the loop - never inside it, or you would print ten running totals instead of one answer. 1 + 2 + ... + 10 = 55.",
    testCases: [{ stdin: "", expected: "55" }],
  },
  {
    key: "q07",
    stem: "Write a program to print sum of first 10 Even numbers using for loop.",
    difficulty: "EASY",
    starterCode: `# Add 2 + 4 + 6 + ... + 20 and print the total.
#
# Reuse the accumulator pattern from the previous question, but make
# range() produce only even numbers.

total = 0
for i in range(0):
    # your code here

print(total)
`,
    solutionCode: `total = 0
for i in range(2, 21, 2):
    total = total + i
print(total)
`,
    explanation:
      "range(2, 21, 2) yields the ten even numbers from 2 to 20, and the body adds each one to the running total. The answer is 110.",
    testCases: [{ stdin: "", expected: "110" }],
  },
  {
    key: "q08",
    stem: "Write a program to print table of a number entered from the user using for loop.",
    difficulty: "EASY",
    important: true,
    starterCode: `# Read a number and print its multiplication table from 1 to 10,
# one line per multiple, in this exact form:
#   5 x 1 = 5
#   5 x 2 = 10
#   ... up to 5 x 10 = 50

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
for i in range(1, 11):
    print(n, "x", i, "=", n * i)
`,
    explanation:
      "The loop variable is the multiplier, not the number being multiplied: i runs 1 to 10 and n stays fixed. print(n, \"x\", i, \"=\", n * i) inserts the spaces and symbols for you.",
    testCases: [
      { stdin: "5\n", expected: row(...range(1, 10).map((i) => `5 x ${i} = ${5 * i}`)) },
      { stdin: "7\n", expected: row(...range(1, 10).map((i) => `7 x ${i} = ${7 * i}`)) },
    ],
  },
  {
    key: "q09",
    stem: "Write a program to print all even numbers that falls between two numbers (exclusive both numbers) entered from the user using for loop.",
    difficulty: "MEDIUM",
    starterCode: `# Read two numbers and print the even numbers strictly between
# them, one per line. Neither end may be printed, even if it is even.
#
# The user may type them in either order, so sort them first.

a = int(input())
b = int(input())

# your code here
`,
    solutionCode: `a = int(input())
b = int(input())
if a > b:
    a, b = b, a

for n in range(a + 1, b):
    if n % 2 == 0:
        print(n)
`,
    explanation:
      "\"Exclusive both numbers\" means the range starts at a + 1 and stops before b - exactly what range(a + 1, b) already does. Swapping a and b first handles the case where the larger number was typed first, and n % 2 == 0 picks out the even ones.",
    testCases: [
      { stdin: "3\n10\n", expected: "4\n6\n8" },
      { stdin: "10\n3\n", expected: "4\n6\n8" },
      { stdin: "4\n8\n", expected: "6" },
      { stdin: "4\n6\n", expected: "" },
    ],
  },
  {
    key: "q10",
    stem: "Write a program to check whether a number is prime or not using for loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a number and print either "Prime" or "Not Prime".
# 1 is not prime. A prime is divisible only by 1 and itself.
#
# Try every divisor from 2 up to n - 1 and stop at the first one
# that divides exactly. A break is what makes the loop worth using.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())

if n < 2:
    print("Not Prime")
else:
    prime = True
    for i in range(2, n):
        if n % i == 0:
            prime = False
            break
    if prime:
        print("Prime")
    else:
        print("Not Prime")
`,
    explanation:
      "Numbers below 2 are never prime, so they are answered before the loop. For everything else, if any i in 2 ... n-1 divides n exactly then n is not prime and break leaves the loop at once; if the loop finishes without finding one, the flag is still True and n is prime.",
    testCases: [
      { stdin: "7\n", expected: "Prime" },
      { stdin: "9\n", expected: "Not Prime" },
      { stdin: "1\n", expected: "Not Prime" },
      { stdin: "2\n", expected: "Prime" },
      { stdin: "97\n", expected: "Prime" },
      { stdin: "100\n", expected: "Not Prime" },
    ],
  },
  {
    key: "q11",
    stem: "Write a program to find the sum of the digits of a number accepted from the user using for loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a number and print the sum of its digits.
# 1234 gives 1 + 2 + 3 + 4 = 10.
#
# A for loop cannot peel digits off with % 10 on its own, so walk the
# digits as text instead: str(n) gives a string you can loop over,
# and int(digit) turns each character back into a number.
# abs(n) keeps a minus sign out of the digit list.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
total = 0
for digit in str(abs(n)):
    total = total + int(digit)
print(total)
`,
    explanation:
      "str(abs(n)) turns the number into a string, and a for loop over a string visits one character at a time. Each character is converted back with int() and added to the total. abs() matters because the minus sign of a negative number is not a digit.",
    testCases: [
      { stdin: "1234\n", expected: "10" },
      { stdin: "0\n", expected: "0" },
      { stdin: "907\n", expected: "16" },
      { stdin: "-45\n", expected: "9" },
    ],
  },
  {
    key: "q12",
    stem: "Write a program to find the product of the digits of a number accepted from the user using for loop.",
    difficulty: "MEDIUM",
    starterCode: `# Read a number and print the product of its digits.
# 234 gives 2 * 3 * 4 = 24.
#
# Same idea as the digit sum, but the running value starts at 1:
# multiplying by 0 would wipe the answer out.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
product = 1
for digit in str(abs(n)):
    product = product * int(digit)
print(product)
`,
    explanation:
      "A product must start at 1, not 0, or every multiplication would give 0. Loop over str(abs(n)), convert each character with int() and multiply it in. A number containing a 0 digit correctly gives 0.",
    testCases: [
      { stdin: "234\n", expected: "24" },
      { stdin: "5\n", expected: "5" },
      { stdin: "0\n", expected: "0" },
      { stdin: "-36\n", expected: "18" },
      { stdin: "907\n", expected: "0" },
    ],
  },
  {
    key: "q13",
    stem: "Write a program to reverse the number accepted from user using for loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a number and print it with the digits reversed.
# 1234 becomes 4321 and 120 becomes 21.
#
# Two ways work with a for loop:
#   - walk reversed(str(abs(n))) and build reverse = reverse * 10 + digit
#   - or collect the digits as text and join them back to front
#
# The * 10 + digit version keeps the answer a number, so a trailing
# zero disappears (120 -> 21) exactly as it should.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
reverse = 0
for digit in reversed(str(abs(n))):
    reverse = reverse * 10 + int(digit)
print(reverse)
`,
    explanation:
      "reversed(str(abs(n))) visits the digits from right to left. Each pass shifts what is already built one place left with * 10 and adds the new digit, so 1234 becomes 4, 43, 432, 4321. A trailing zero in the original vanishes because leading zeros are not stored in a number.",
    testCases: [
      { stdin: "1234\n", expected: "4321" },
      { stdin: "120\n", expected: "21" },
      { stdin: "7\n", expected: "7" },
      { stdin: "1000\n", expected: "1" },
    ],
  },
  {
    key: "q14",
    stem: "Write a program to display the number names of the digits of a number entered by user using for loop, for example if the number is 231 then output should be Two Three One.",
    difficulty: "MEDIUM",
    starterCode: `# Read a number and print each digit's name, separated by a single
# space. For 231 the output is:
#   Two Three One
#
# A list indexed by the digit gives the name directly:
#   names[digit]
#
# str(abs(n)) already gives the digits in the right order, so no
# reversing is needed here.

names = ["Zero", "One", "Two", "Three", "Four",
         "Five", "Six", "Seven", "Eight", "Nine"]

n = int(input())

# your code here
`,
    solutionCode: `names = ["Zero", "One", "Two", "Three", "Four",
         "Five", "Six", "Seven", "Eight", "Nine"]

n = int(input())
words = []
for digit in str(abs(n)):
    words.append(names[int(digit)])
print(" ".join(words))
`,
    explanation:
      "The list is used as a lookup table: names[int(digit)] returns the word for that digit position. Collect the words in a list and join once at the end with \" \".join(...) - printing inside the loop would put each word on its own line.",
    testCases: [
      { stdin: "231\n", expected: "Two Three One" },
      { stdin: "0\n", expected: "Zero" },
      { stdin: "9007\n", expected: "Nine Zero Zero Seven" },
      { stdin: "45\n", expected: "Four Five" },
    ],
  },
  {
    key: "q15",
    stem: "Write a program to print the Fibonacci series till n terms (Accept n from user) using for loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read n and print the first n Fibonacci numbers, one per line.
# The series starts 0, 1, 1, 2, 3, 5, 8 ...
#
# Keep the current and the next term in two variables, print the
# current one, then shift both along.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
a, b = 0, 1
for i in range(n):
    print(a)
    a, b = b, a + b
`,
    explanation:
      "The loop runs n times and never uses i itself - the state lives in a and b. a, b = b, a + b moves the pair one step along the series, and Python evaluates the right-hand side before assigning, so the old a is still available for the sum.",
    testCases: [
      { stdin: "7\n", expected: row(...[0, 1, 1, 2, 3, 5, 8]) },
      { stdin: "1\n", expected: "0" },
      { stdin: "10\n", expected: row(...[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]) },
    ],
  },
  {
    key: "q16",
    stem: "Write a program to print the factorial of a number accepted from user using for loop.",
    difficulty: "EASY",
    important: true,
    starterCode: `# Read a number and print its factorial.
# 5! = 5 * 4 * 3 * 2 * 1 = 120, and 0! = 1.
#
# The running product starts at 1 and is multiplied by every number
# up to n. range(1, n + 1) is needed because range() excludes its stop.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
fact = 1
for i in range(1, n + 1):
    fact = fact * i
print(fact)
`,
    explanation:
      "Multiply a running product by 1, 2, 3 ... n. Starting at 1 also gives the correct 0! = 1, because the range is empty and the answer is never changed. The stop must be n + 1 so that n itself is included.",
    testCases: [
      { stdin: "5\n", expected: "120" },
      { stdin: "0\n", expected: "1" },
      { stdin: "1\n", expected: "1" },
      { stdin: "10\n", expected: "3628800" },
    ],
  },
  {
    key: "q17",
    stem: "Write a program to check whether a number is Armstrong or not using for loop. (Armstrong number is a number that is equal to the sum of cubes of its digits for example : 153 = 1^3 + 5^3 + 3^3.)",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a number and print "Armstrong" if it equals the sum of the
# cubes of its digits, otherwise print "Not Armstrong".
# 153, 370 and 407 are Armstrong numbers; 100 is not.
#
# Cube each digit with digit ** 3 and add the results.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
total = 0
for digit in str(abs(n)):
    total = total + int(digit) ** 3
print("Armstrong" if total == n else "Not Armstrong")
`,
    explanation:
      "str(abs(n)) gives the digits one at a time, and each is cubed and added. The comparison has to use the original n, which is why the digits are read from a string copy instead of by destroying n with // 10 as the while-loop version does.",
    testCases: [
      { stdin: "153\n", expected: "Armstrong" },
      { stdin: "407\n", expected: "Armstrong" },
      { stdin: "100\n", expected: "Not Armstrong" },
      { stdin: "370\n", expected: "Armstrong" },
      { stdin: "123\n", expected: "Not Armstrong" },
    ],
  },
  {
    key: "q18",
    stem: "Write a program to convert binary to decimal using for loop.",
    difficulty: "MEDIUM",
    starterCode: `# Read a binary number as text and print its decimal value.
# 1010 becomes 10. Do not use int(x, 2).
#
# Work left to right: double the running total, then add the next bit.
# Doubling is what moves the digits already read one place to the left.

bits = input()

# your code here
`,
    solutionCode: `bits = input()
total = 0
for bit in bits:
    total = total * 2 + int(bit)
print(total)
`,
    explanation:
      "Each pass shifts everything read so far one binary place left by doubling it, then adds the new bit. Reading 1010 gives 1, then 2, then 5, then 10. A for loop over the string is enough because the position is implicit in how far the loop has got.",
    testCases: [
      { stdin: "1010\n", expected: "10" },
      { stdin: "0\n", expected: "0" },
      { stdin: "1111\n", expected: "15" },
      { stdin: "100000\n", expected: "32" },
    ],
  },
  {
    key: "q19",
    stem: "Write a program to add first n terms of the following series using a for loop:\n1/1! + 1/2! + 1/3! + ........ + 1/n!",
    difficulty: "MEDIUM",
    important: true,
    reuseExisting: true,
  },
  {
    key: "q20",
    stem: "Write a program to check whether a number is palindrome or not using for loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a number and print "Palindrome" if it reads the same
# forwards and backwards, otherwise "Not Palindrome".
# 121 and 1331 are palindromes; 123 is not.
#
# With a for loop the string is the easy route: build the reversed
# text one character at a time and compare it with the original.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
text = str(n)
reverse = ""
for ch in text:
    reverse = ch + reverse
if reverse == text:
    print("Palindrome")
else:
    print("Not Palindrome")
`,
    explanation:
      "Prepending each character (ch + reverse) flips the string as it is read. Comparing the flipped text with the original needs no arithmetic, and it keeps a single-digit number a palindrome, which it is.",
    testCases: [
      { stdin: "121\n", expected: "Palindrome" },
      { stdin: "1331\n", expected: "Palindrome" },
      { stdin: "123\n", expected: "Not Palindrome" },
      { stdin: "7\n", expected: "Palindrome" },
    ],
  },
  {
    key: "q21",
    stem: "Write a python program to sum the sequence using a for loop:\n1 + 1/1! + 1/2! + 1/3! + ........ + 1/n!",
    difficulty: "MEDIUM",
    starterCode: `# Read n and print 1 + 1/1! + 1/2! + ... + 1/n! rounded to
# 6 decimal places.
#
# This series has a plain leading 1 before the fractions, so the
# total starts at 1.0 rather than 0.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
fact = 1
total = 1.0
for i in range(1, n + 1):
    fact = fact * i
    total = total + 1 / fact
print(round(total, 6))
`,
    explanation:
      "Keep one running factorial: multiply it by i on each pass instead of recomputing i! from scratch. Adding 1/fact to a total that began at 1.0 gives the leading term. For n = 3 the sum is 2.666667.",
    testCases: [
      { stdin: "3\n", expected: "2.666667" },
      { stdin: "4\n", expected: "2.708333" },
      { stdin: "1\n", expected: "2.0" },
    ],
  },
  {
    key: "q22",
    stem: "Write a program to accept 10 numbers from the user and display its average using for loop.",
    difficulty: "EASY",
    starterCode: `# Read exactly 10 numbers and print their average.
# A whole-number answer should print without a decimal point,
# so use // when the total divides exactly.

total = 0

for i in range(10):
    # your code here

# your code here
`,
    solutionCode: `total = 0
for i in range(10):
    total = total + int(input())

if total % 10 == 0:
    print(total // 10)
else:
    print(round(total / 10, 2))
`,
    explanation:
      "The number of passes is fixed, so range(10) is the natural loop and no counter is needed. Divide only after the loop has finished. Checking total % 10 keeps an exact answer like 55 from printing as 55.0.",
    testCases: [
      { stdin: "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n", expected: "5.5" },
      { stdin: "1\n1\n1\n1\n1\n1\n1\n1\n1\n2\n", expected: "1.1" },
      { stdin: "10\n20\n30\n40\n50\n60\n70\n80\n90\n100\n", expected: "55" },
    ],
  },
  {
    key: "q23",
    stem: "Write a program to accept 10 numbers from the user and display the largest & smallest number using for loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read exactly 10 numbers and print the largest, then the
# smallest, one per line.
#
# Seed both with the FIRST number rather than 0, otherwise a list of
# only negative numbers would give the wrong answer. The loop then
# runs 9 more times.

first = int(input())
largest = first
smallest = first

# your code here
`,
    solutionCode: `first = int(input())
largest = first
smallest = first

for i in range(9):
    n = int(input())
    if n > largest:
        largest = n
    if n < smallest:
        smallest = n

print(largest)
print(smallest)
`,
    explanation:
      "The first value is both the biggest and the smallest seen so far. Each of the remaining nine is compared with both, and one (or neither) of the two variables is updated. Starting from the first value instead of 0 keeps an all-negative list correct.",
    testCases: [
      { stdin: "5\n3\n9\n1\n7\n2\n8\n4\n6\n0\n", expected: "9\n0" },
      { stdin: "-5\n-3\n-9\n-1\n-7\n-2\n-8\n-4\n-6\n-10\n", expected: "-1\n-10" },
      { stdin: "4\n4\n4\n4\n4\n4\n4\n4\n4\n4\n", expected: "4\n4" },
    ],
  },
  {
    key: "q24",
    stem: "Write a program to display sum of odd numbers and even numbers separately that fall between two numbers accepted from the user (including both numbers) using for loop.",
    difficulty: "MEDIUM",
    starterCode: `# Read two numbers and print the sum of the odd numbers and the
# sum of the even numbers between them, both ends included.
# Print the odd sum first, then the even sum.
#
# Unlike the "exclusive" question, this range includes both ends,
# so the loop starts at the smaller number and stops at the larger.

a = int(input())
b = int(input())

# your code here
`,
    solutionCode: `a = int(input())
b = int(input())
if a > b:
    a, b = b, a

odd = 0
even = 0
for n in range(a, b + 1):
    if n % 2 == 0:
        even = even + n
    else:
        odd = odd + n

print(odd)
print(even)
`,
    explanation:
      "Including both ends means range(a, b + 1), and swapping the inputs first lets the smaller number always be the start. Two accumulators collect the two sums, and the odd one is printed first as the question asks.",
    testCases: [
      { stdin: "1\n10\n", expected: "25\n30" },
      { stdin: "10\n1\n", expected: "25\n30" },
      { stdin: "4\n6\n", expected: "5\n10" },
    ],
  },
  {
    key: "q25",
    stem: "Write a program to display all the numbers which are divisible by 13 but not by 3 between 100 and 500 using for loop.",
    difficulty: "MEDIUM",
    starterCode: `# Print every number from 100 to 500 that is divisible by 13
# but NOT by 3, one per line.
#
# Two conditions joined with and. Read them literally:
#   n % 13 == 0  and  n % 3 != 0

for n in range(100, 501):
    # your code here
`,
    solutionCode: `for n in range(100, 501):
    if n % 13 == 0 and n % 3 != 0:
        print(n)
`,
    explanation:
      "range(100, 501) covers 100 to 500 inclusive. The two tests are independent: % 13 == 0 asks whether 13 divides it, and % 3 != 0 asks whether 3 does not. Both must be true, so they are joined with and.",
    testCases: [
      {
        stdin: "",
        expected: row(...range(100, 500).filter((n) => n % 13 === 0 && n % 3 !== 0)),
      },
    ],
  },
  {
    key: "q26",
    stem: "Write a program to print the following series till n terms using for loop.\n2 , 22 , 222 , 2222 _ _ _ _ _ n terms",
    difficulty: "MEDIUM",
    starterCode: `# Read n and print 2, 22, 222, 2222 ... one term per line.
#
# Each term is the previous term times 10 plus 2:
#   2 * 10 + 2 = 22
#   22 * 10 + 2 = 222
#
# No string multiplication - build the number.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
term = 0
for i in range(n):
    term = term * 10 + 2
    print(term)
`,
    explanation:
      "Multiplying the previous term by 10 shifts its digits left and adding 2 appends the new digit, which is exactly how 2 becomes 22 and 22 becomes 222. The loop runs n times, so n terms are printed.",
    testCases: [
      { stdin: "4\n", expected: "2\n22\n222\n2222" },
      { stdin: "1\n", expected: "2" },
      {
        stdin: "6\n",
        expected: row(...range(1, 6).map((i) => Number("2".repeat(i)))),
      },
    ],
  },
  {
    key: "q27",
    stem: "Write a program to print the following series till n terms using for loop.\n1 4 9 16 25 _ _ _ _ _ n terms",
    difficulty: "EASY",
    starterCode: `# Read n and print the first n square numbers, one per line:
# 1, 4, 9, 16, 25 ...
#
# The i-th term is i * i, for i from 1 to n.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
for i in range(1, n + 1):
    print(i * i)
`,
    explanation:
      "The series is the squares of 1, 2, 3 ... so the term for loop value i is i * i. Printing inside the loop gives one term per line.",
    testCases: [
      { stdin: "6\n", expected: "1\n4\n9\n16\n25\n36" },
      { stdin: "1\n", expected: "1" },
      { stdin: "10\n", expected: row(...range(1, 10).map((i) => i * i)) },
    ],
  },
  {
    key: "q28",
    stem: "Write a program to find the sum of the following series using for loop (accept values of x and n from user)\n1 + x/1! + x^2/2! + ……….x^n/n!",
    difficulty: "HARD",
    important: true,
    starterCode: `# Read x and n, then print the sum of
# 1 + x/1! + x^2/2! + ... + x^n/n!  rounded to 6 decimal places.
#
# Two running values are enough: the power of x and the factorial.
# Multiply each by something on every pass instead of recomputing.

x = int(input())
n = int(input())

# your code here
`,
    solutionCode: `x = int(input())
n = int(input())

fact = 1
power = 1
total = 1.0
for i in range(1, n + 1):
    power = power * x
    fact = fact * i
    total = total + power / fact

print(round(total, 6))
`,
    explanation:
      "Keep two running values - x raised to the current power and the current factorial - and update both with one multiplication per pass. The leading 1 is already in the total. For x = 2, n = 4 the sum is 7.0.",
    testCases: [
      { stdin: "2\n4\n", expected: "7.0" },
      { stdin: "1\n5\n", expected: "2.716667" },
      { stdin: "3\n3\n", expected: "13.0" },
    ],
  },
  {
    key: "q29",
    stem: "Write a program to find the sum of following series using for loop:\nx + x^2/2 + ……….x^n/n",
    difficulty: "HARD",
    starterCode: `# Read x and n, then print the sum of
# x + x^2/2 + x^3/3 + ... + x^n/n  rounded to 6 decimal places.
#
# There is no factorial here: each term divides by the term number
# itself. The powers of x still build up one multiplication at a time.

x = int(input())
n = int(input())

# your code here
`,
    solutionCode: `x = int(input())
n = int(input())

power = 1
total = 0.0
for i in range(1, n + 1):
    power = power * x
    total = total + power / i

print(round(total, 6))
`,
    explanation:
      "Multiplying the running power by x gives x^i, and dividing it by i gives the term - the denominator is i, not i!. The total starts at 0.0 because this series has no leading 1. For x = 2, n = 4 the sum is 10.666667.",
    testCases: [
      { stdin: "2\n4\n", expected: "10.666667" },
      { stdin: "3\n2\n", expected: "7.5" },
      { stdin: "1\n5\n", expected: "2.283333" },
    ],
  },
  {
    key: "q30",
    stem: "Write a program to find the sum of following series using for loop:\n1 + 8 + 27 …………n terms",
    difficulty: "EASY",
    starterCode: `# Read n and print 1 + 8 + 27 + ... for n terms.
#
# 1, 8, 27 are the cubes of 1, 2, 3. Add i ** 3 to an accumulator.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
total = 0
for i in range(1, n + 1):
    total = total + i ** 3
print(total)
`,
    explanation:
      "The series is the cubes of the natural numbers, so the i-th term is i ** 3. Adding it to a total that starts at 0 gives the answer; for n = 4 that is 1 + 8 + 27 + 64 = 100.",
    testCases: [
      { stdin: "4\n", expected: "100" },
      { stdin: "1\n", expected: "1" },
      { stdin: "6\n", expected: "441" },
    ],
  },
  {
    key: "q31",
    stem: "Write a program to find the sum of following series using for loop:\n1 + 2 + 6 + 24 + 120 . . . . . n terms",
    difficulty: "MEDIUM",
    starterCode: `# Read n and print the sum of the first n factorials:
# 1! + 2! + 3! + ... + n!
# For n = 5 the answer is 153.
#
# Keep one running factorial and add it to a total on each pass.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
fact = 1
total = 0
for i in range(1, n + 1):
    fact = fact * i
    total = total + fact
print(total)
`,
    explanation:
      "The terms are 1!, 2!, 3! ... Multiplying the running factorial by i on each pass gives the next term without recomputing it, and adding it to the total builds the sum: 1 + 2 + 6 + 24 + 120 = 153.",
    testCases: [
      { stdin: "5\n", expected: "153" },
      { stdin: "1\n", expected: "1" },
      { stdin: "4\n", expected: "33" },
    ],
  },
  {
    key: "q32",
    stem: "Write a program to find the sum of following series using for loop:\nS = 1 + 4 – 9 + 16 – 25 + 36 – … … n terms",
    difficulty: "MEDIUM",
    starterCode: `# Read n and print S = 1 + 4 - 9 + 16 - 25 + 36 - ...
# for n terms.
#
# The term values are squares of 1, 2, 3 ... but the signs alternate:
#   +1  +4  -9  +16  -25  +36
# The first term is added, and from the second term the even
# positions are added and the odd positions are subtracted.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
total = 0
for i in range(1, n + 1):
    if i == 1 or i % 2 == 0:
        total = total + i * i
    else:
        total = total - i * i
print(total)
`,
    explanation:
      "Each term is i * i; only the sign changes. Compare the positions with the sheet: +1, +4, -9, +16, -25, +36 - so position 1 and every even position are added, and odd positions after the first are subtracted. For n = 6 the sum is 23.",
    testCases: [
      { stdin: "1\n", expected: "1" },
      { stdin: "4\n", expected: "12" },
      { stdin: "5\n", expected: "-13" },
      { stdin: "6\n", expected: "23" },
    ],
  },
  {
    key: "q33",
    stem: "Write a Program to print all the characters in the string ‘COMPUTER’ using for loop.",
    difficulty: "EASY",
    important: true,
    starterCode: `# Print every character of the word COMPUTER, one per line.
#
# A for loop over a string visits one character at a time, so no
# index and no len() are needed.

word = "COMPUTER"

# your code here
`,
    solutionCode: `word = "COMPUTER"
for ch in word:
    print(ch)
`,
    explanation:
      "Looping directly over the string is the Python way: ch takes each character in turn, so the index and the call to len() that a while loop would need simply disappear.",
    testCases: [{ stdin: "", expected: "C\nO\nM\nP\nU\nT\nE\nR" }],
  },
  {
    key: "q34",
    stem: "Write a program to print only odd numbers from the given list using for loop.\nL = [23, 45, 32, 25, 46, 33, 71, 90]",
    difficulty: "EASY",
    starterCode: `# Print only the odd numbers from the list, one per line.
# The list is given; only the loop and the test are yours to write.
#
# A for loop over a list yields each element directly, so L[i] is not
# needed.

L = [23, 45, 32, 25, 46, 33, 71, 90]

# your code here
`,
    solutionCode: `L = [23, 45, 32, 25, 46, 33, 71, 90]
for n in L:
    if n % 2 != 0:
        print(n)
`,
    explanation:
      "Looping over the list gives each element in n, and n % 2 != 0 keeps the odd ones. Unlike the while version there is no counter to advance by hand, so no element can be skipped by forgetting i = i + 1.",
    testCases: [{ stdin: "", expected: "23\n45\n25\n33\n71" }],
  },
  {
    key: "q35",
    stem: "Write a program to print all the factors of a number using for loop.",
    difficulty: "EASY",
    important: true,
    reuseExisting: true,
  },

  /* ----------------------------------------------------------------------- *
   * Star-pattern block (Q36 - Q48).
   *
   * These are the classic nested-for-loop pictures: the row number decides the
   * star count, and for the centred ones it also decides the left margin. The
   * expected stdout is generated from `P36`...`P48` above, the same arrays the
   * stems display, so a question can never show one picture and demand another.
   * ----------------------------------------------------------------------- */
  {
    key: "q36",
    stem: `Write a program using a for loop to print this half pyramid of 5 rows:

${fence(sheet(P36))}

Every row has one more star than the row above it, and the stars on a row are separated by a single space. Build each row inside the loop from the row number - do not print the five rows as five separate literal strings.`,
    difficulty: "EASY",
    important: true,
    starterCode: `# Print a 5-row half pyramid:
${notes(P36)}
#
# Row i needs i stars separated by one space. Either nest a loop over the
# stars or join ["*"] * i with " " - print() adds the newline.

rows = 5
for i in range(1, rows + 1):
    # your code here
`,
    solutionCode: `rows = 5
for i in range(1, rows + 1):
    print(" ".join(["*"] * i))
`,
    explanation:
      "The outer loop walks the row number from 1 to 5. Row i is i stars joined by a single space, so print() ends the line exactly after the last star: the triangle grows by one star per pass and no line carries a trailing space.",
    testCases: [{ stdin: "", expected: sheet(P36) }],
  },
  {
    key: "q37",
    stem: `Write a program using a for loop to print this mirrored right triangle of 5 rows:

${fence(sheet(P37))}

The right edge of the triangle is straight: the bottom row touches the left margin and every row above it is pushed further right. Stars are separated by one space, and the leading spaces are part of the answer.`,
    difficulty: "MEDIUM",
    starterCode: `# Print a 5-row right triangle pushed to the right edge:
${notes(P37)}
#
# The widest row is 5 stars and 4 spaces = 9 characters. Work that width
# out from the row count, then right-align every row to it.

rows = 5
width = 2 * rows - 1
for i in range(1, rows + 1):
    # your code here
`,
    solutionCode: `rows = 5
width = 2 * rows - 1
for i in range(1, rows + 1):
    print(" ".join(["*"] * i).rjust(width))
`,
    explanation:
      "It is the half pyramid again, only right-aligned. The widest row holds 5 stars and 4 gaps, which is 2*rows - 1 = 9 characters, so rjust(9) pushes every shorter row right; row i ends up with 2*(rows - i) leading spaces.",
    testCases: [{ stdin: "", expected: sheet(P37) }],
  },
  {
    key: "q38",
    stem: `Write a program using a for loop to print this downward half pyramid of 5 rows:

${fence(sheet(P38))}

The first row is the widest and every row after it loses one star. Stars are separated by a single space.`,
    difficulty: "EASY",
    starterCode: `# Print a 5-row downward half pyramid:
${notes(P38)}
#
# Count down: start at 5 stars and stop after 1. range() never includes
# its stop value, so the loop needs a step of -1.

rows = 5
for i in range(rows, 0, -1):
    # your code here
`,
    solutionCode: `rows = 5
for i in range(rows, 0, -1):
    print(" ".join(["*"] * i))
`,
    explanation:
      "The same row builder as the half pyramid, with the loop running from rows down to 1. Because the star count is the loop variable, the picture shrinks by one star per pass and stops at the single star.",
    testCases: [{ stdin: "", expected: sheet(P38) }],
  },
  {
    key: "q39",
    stem: `Write a program using a for loop to print this downward full pyramid of 6 rows:

${fence(sheet(P39))}

The top row is the widest. As the rows get shorter they also move one column to the right, so the left edge slopes down to a point. Stars are separated by a single space.`,
    difficulty: "MEDIUM",
    starterCode: `# Print a 6-row downward full pyramid:
${notes(P39)}
#
# Row i (counting down from 6) needs (6 - i) leading spaces and i stars.
# The margin grows by one every pass while the stars shrink by one.

rows = 6
for i in range(rows, 0, -1):
    # your code here
`,
    solutionCode: `rows = 6
for i in range(rows, 0, -1):
    print(" " * (rows - i) + " ".join(["*"] * i))
`,
    explanation:
      "Counting down makes both quantities fall out of the same variable: row i gets rows - i leading spaces (0, 1, 2, ...) and i stars. The margin grows by one per pass while the star count shrinks by one, which is what slopes the left edge.",
    testCases: [{ stdin: "", expected: sheet(P39) }],
  },
  {
    key: "q40",
    stem: `Write a program using a for loop to print this right-down mirror of a solid star block:

${fence(sheet(P40))}

Unlike the spaced patterns, this one prints a solid block of stars with no spaces between them, and each row starts one column further right than the row above it.`,
    difficulty: "EASY",
    starterCode: `# Print a solid 5-row block, shifted right row by row:
${notes(P40)}
#
# Two things change per row: the left margin grows and the star count
# shrinks. Both come from the same loop variable.

rows = 5
for i in range(rows, 0, -1):
    # your code here
`,
    solutionCode: `rows = 5
for i in range(rows, 0, -1):
    print(" " * (rows - i) + "*" * i)
`,
    explanation:
      "Row i gets rows - i spaces and i stars, with no separator between the stars because this block is solid. Counting down means the first row is the full width and every later row is one star shorter and one column further right.",
    testCases: [{ stdin: "", expected: sheet(P40) }],
  },
  {
    key: "q41",
    stem: `Write a program using a for loop to print this equilateral triangle of 7 rows:

${fence(sheet(P41))}

The top star sits in the middle of the widest row and both edges slope away evenly. Stars are separated by one space, and the leading spaces are part of the answer.`,
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Print a 7-row equilateral (centred) triangle:
${notes(P41)}
#
# Row i needs (7 - i) leading spaces and then i stars separated by one
# space. Row 1 is a single star under the middle of row 7.

rows = 7
for i in range(1, rows + 1):
    # your code here
`,
    solutionCode: `rows = 7
for i in range(1, rows + 1):
    print(" " * (rows - i) + " ".join(["*"] * i))
`,
    explanation:
      "A pyramid combines the two earlier shapes: row i gets rows - i leading spaces (so the first star lines up under the middle of the last row) and i stars joined by one space. Row 7 is 13 characters wide and the row-1 star sits in its centre column.",
    testCases: [{ stdin: "", expected: sheet(P41) }],
  },
  {
    key: "q42",
    stem: `Write a program using two for loops to print an upward pyramid, then one empty line, then the same pyramid upside down:

${fence(sheet(P42))}

Both halves have 6 rows. The empty line between them is part of the expected output.`,
    difficulty: "MEDIUM",
    starterCode: `# Print a 6-row pyramid, a blank line, then the same pyramid inverted:
${notes(P42)}
#
# Two loops in sequence: the first counts 1..6, the second counts 6..1.
# A bare print() produces the empty line between them.

rows = 6
for i in range(1, rows + 1):
    # your code here

# blank line here

for i in range(rows, 0, -1):
    # your code here
`,
    solutionCode: `rows = 6
for i in range(1, rows + 1):
    print(" ".join(["*"] * i))
print()
for i in range(rows, 0, -1):
    print(" ".join(["*"] * i))
`,
    explanation:
      "Both halves are the half pyramid - one counting up, one counting down - so the row builder is written once in your head and used twice. print() with no arguments emits the empty line; leaving it out would join the two halves into one 12-row triangle.",
    testCases: [{ stdin: "", expected: sheet(P42) }],
  },
  {
    key: "q43",
    stem: `Write a program using for loops to print this right Pascal triangle: 5 growing rows followed by 4 shrinking rows:

${fence(sheet(P43))}

Stars are separated by a single space. The widest row is printed once; the rows below it mirror the four rows above it.`,
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Print a 5-row right Pascal triangle:
${notes(P43)}
#
# The upward loop prints 1..5 stars, the downward loop prints 4..1.
# Use rows - 1 as the start of the second loop so the widest row is
# not printed twice.

rows = 5
for i in range(1, rows + 1):
    # your code here

# second loop here

`,
    solutionCode: `rows = 5
for i in range(1, rows + 1):
    print(" ".join(["*"] * i))
for i in range(rows - 1, 0, -1):
    print(" ".join(["*"] * i))
`,
    explanation:
      "The upward loop stops on the widest row, so the downward loop has to start at rows - 1 instead of rows or the 5-star row would appear twice. Both loops print the same row shape, which is why the outline looks like a mirrored right triangle.",
    testCases: [{ stdin: "", expected: sheet(P43) }],
  },
  {
    key: "q44",
    stem: `Write a program using for loops to print this left Pascal triangle, right-aligned:

${fence(sheet(P44))}

The triangle grows to 5 stars and then shrinks back to 1, and every row is right-aligned to the width of the widest row. The leading spaces are part of the answer.`,
    difficulty: "MEDIUM",
    starterCode: `# Print a 5-row left Pascal triangle:
${notes(P44)}
#
# Same two-loop shape as the right Pascal triangle, but each row is
# right-aligned to the widest row: 5 stars and 4 gaps = 9 characters.

rows = 5
width = 2 * rows - 1
for i in range(1, rows + 1):
    # your code here

# second loop here

`,
    solutionCode: `rows = 5
width = 2 * rows - 1
for i in range(1, rows + 1):
    print(" ".join(["*"] * i).rjust(width))
for i in range(rows - 1, 0, -1):
    print(" ".join(["*"] * i).rjust(width))
`,
    explanation:
      "This is the right Pascal triangle pushed to the right edge. Only the printing changes: every row is built the same way and then right-aligned to 2*rows - 1 = 9 characters, so the stars line up on the right while the left edge moves in and out.",
    testCases: [{ stdin: "", expected: sheet(P44) }],
  },
  {
    key: "q45",
    stem: `Write a program using for loops to print this sandglass of stars:

${fence(sheet(P45))}

The top half is a downward full pyramid of 5 rows and the bottom half is its mirror image. The single-star point is printed twice - once at the end of the top half and once at the start of the bottom half.`,
    difficulty: "HARD",
    important: true,
    starterCode: `# Print a sandglass:
${notes(P45)}
#
# Top half: stars go 5 -> 1 while the left margin grows 0 -> 4.
# Bottom half: exactly the same rows, run in the opposite order.
# Build the row from (margin, stars) once - do not hand-write 10 rows.

rows = 5
for i in range(rows, 0, -1):
    # your code here

# second loop here

`,
    solutionCode: `rows = 5
for i in range(rows, 0, -1):
    print(" " * (rows - i) + " ".join(["*"] * i))
for i in range(1, rows + 1):
    print(" " * (rows - i) + " ".join(["*"] * i))
`,
    explanation:
      "Each half is the downward full pyramid row - (rows - i) spaces then i stars - so the two loops differ only in direction. The apex row is i = 1 in both loops, which is why the single star appears twice and the two halves join at a point.",
    testCases: [{ stdin: "", expected: sheet(P45) }],
  },
  {
    key: "q46",
    stem: `Write a program using a for loop to print this "pant" style pattern of 8 rows:

${fence(sheet(P46))}

Every row is exactly 16 characters wide: a block of stars, a gap of spaces, then the same block again. The gap grows by 2 spaces per row (the first row has no gap at all), so the two star blocks shrink as the gap widens.`,
    difficulty: "HARD",
    starterCode: `# Print an 8-row "pant" pattern, 16 characters wide on every row:
${notes(P46)}
#
# Row 1 has no gap. For each later row i = 1..7 the star block is
# (8 - i) and the middle gap is 2 * i, so 2*(8 - i) + 2*i is always 16.

rows = 8
width = 2 * rows
# first row here

# loop for the remaining rows here
`,
    solutionCode: `rows = 8
width = 2 * rows
print("*" * width)
for i in range(1, rows):
    stars = rows - i
    print("*" * stars + " " * (2 * i) + "*" * stars)
`,
    explanation:
      "The first row is a solid block of 2*rows = 16 stars. Each later row keeps the width fixed: the star block is rows - i and the gap is 2*i, so 2*(rows - i) + 2*i is always 2*rows. The gap grows by two per row, which is why the two blocks shrink symmetrically.",
    testCases: [{ stdin: "", expected: sheet(P46) }],
  },
  {
    key: "q47",
    stem: `Write a program using for loops to print this diamond of stars:

${fence(sheet(P47))}

The upper half grows from 1 star to 6, the lower half shrinks from 5 back to 1, and every row is centred on the same column. Stars are separated by one space and the leading spaces are part of the answer.`,
    difficulty: "HARD",
    important: true,
    starterCode: `# Print an 11-row diamond:
${notes(P47)}
#
# Upper half: i = 1..6, row = (6 - i) spaces + i stars.
# Lower half: i = 5..1, the same row rule - the widest row is printed once.

rows = 6
for i in range(1, rows + 1):
    # your code here

# second loop here

`,
    solutionCode: `rows = 6
for i in range(1, rows + 1):
    print(" " * (rows - i) + " ".join(["*"] * i))
for i in range(rows - 1, 0, -1):
    print(" " * (rows - i) + " ".join(["*"] * i))
`,
    explanation:
      "Both halves use the pyramid row: rows - i leading spaces and i stars. Counting i up to 6 and then back down to 1 prints the widest row once and keeps every row centred on the same column, which is what makes the outline a diamond rather than two triangles.",
    testCases: [{ stdin: "", expected: sheet(P47) }],
  },
  {
    key: "q48",
    stem: `Write a program using for loops to print this hollow diamond of stars:

${fence(sheet(P48))}

It grows from a single star to a two-star row with a widening gap, then shrinks back to a single star. Only the two edges of each row are stars; the space between them grows by 2 on every row until the middle, then shrinks again. The leading spaces are part of the answer.`,
    difficulty: "HARD",
    starterCode: `# Print a hollow diamond:
${notes(P48)}
#
# The single-star row (i = 1) is special: one star and no gap.
# Every other row i is: margin + "*" + gap + "*", where
#   margin = rows - i   and   gap = 2 * i - 3.
# Run i = 1..5, then i = 4..1.

rows = 5
for i in range(1, rows + 1):
    # your code here

# second loop here

`,
    solutionCode: `rows = 5
for i in range(1, rows + 1):
    if i == 1:
        print(" " * (rows - 1) + "*")
    else:
        print(" " * (rows - i) + "*" + " " * (2 * i - 3) + "*")
for i in range(rows - 1, 0, -1):
    if i == 1:
        print(" " * (rows - 1) + "*")
    else:
        print(" " * (rows - i) + "*" + " " * (2 * i - 3) + "*")
`,
    explanation:
      "The first and last rows cannot have two edges, so i = 1 is handled separately as one centred star. Every other row keeps its edges at margin = rows - i and gap = 2*i - 3, which are exactly the columns where the solid diamond's outline sits. Running i up and then down mirrors the shape around its widest row.",
    testCases: [{ stdin: "", expected: sheet(P48) }],
  },
];
