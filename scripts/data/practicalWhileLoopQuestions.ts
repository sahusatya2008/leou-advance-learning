/**
 * The Class 11 "Getting Started with Python" while-loop exercise set.
 *
 * Every entry is one row in the question bank: the stem as the textbook poses it,
 * a starter for the student's editor, a reference solution the teacher can show,
 * and hidden test cases holding the exact expected stdout. Output formatting is
 * pinned down in the starter (one item per line, or space separated where the
 * question says "series") so the expected text is unambiguous rather than a
 * guess about spacing.
 *
 * This file is data only. `scripts/seed-practical-while-loop.ts` loads it.
 */

export type SeedQuestion = {
  /** Short label used in logs and in the reference answer. */
  key: string;
  stem: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  /** Marks the question as important; the student practical page then shows a
   *  designed "Very Important" badge for it. */
  important?: boolean;
  /** What the student starts with in the editor. */
  starterCode: string;
  /** Reference solution. Never sent to a student's browser. */
  solutionCode: string;
  /** Model answer shown to the teacher, and used as the question explanation. */
  explanation: string;
  /** Hidden expected stdout. `stdin` is fed to the program before it runs. */
  testCases: { stdin: string; expected: string }[];
};

export const WHILE_LOOP_TAGS = ["while-loop", "loop"];

/** Reserved tag that marks a question as very important. Rendered as a distinct
 *  badge on the student practical page and filtered out of the plain tag chips. */
export const VERY_IMPORTANT_TAG = "very-important";

export const CHAPTER = "Getting Started with Python";

export const SEED_TITLE = "Getting Started with Python — While Loop Practical";

export const SEED_QUESTIONS: SeedQuestion[] = [
  {
    key: "q01",
    stem: "Write a program to print the following using while loop:\na. First 10 Even numbers\nb. First 10 Odd numbers\nc. First 10 Natural numbers\nd. First 10 Whole numbers",
    difficulty: "EASY",
    starterCode: `# Print the following using a while loop.
# Print one number per line, and label each group.
#   a. First 10 Even numbers      -> 2 4 6 ... 20
#   b. First 10 Odd numbers       -> 1 3 5 ... 19
#   c. First 10 Natural numbers   -> 1 2 3 ... 10
#   d. First 10 Whole numbers     -> 0 1 2 ... 9
#
# Reminder: a while loop needs a counter, and the counter must change
# every time round, or the loop never ends.

i = 1
print("a. First 10 Even numbers")
# your code here
`,
    solutionCode: `i = 1
print("a. First 10 Even numbers")
while i <= 10:
    print(2 * i)
    i = i + 1

i = 1
print("b. First 10 Odd numbers")
while i <= 10:
    print(2 * i - 1)
    i = i + 1

i = 1
print("c. First 10 Natural numbers")
while i <= 10:
    print(i)
    i = i + 1

i = 0
print("d. First 10 Whole numbers")
while i < 10:
    print(i)
    i = i + 1
`,
    explanation:
      "All four parts are the same loop with a different start value and step count. Even numbers are 2*i for i=1..10, odd numbers are 2*i-1, natural numbers start at 1, and whole numbers include 0 so the loop starts at i=0. The counter must be updated inside the loop body every single pass.",
    testCases: [
      {
        stdin: "",
        expected: `a. First 10 Even numbers
2
4
6
8
10
12
14
16
18
20
b. First 10 Odd numbers
1
3
5
7
9
11
13
15
17
19
c. First 10 Natural numbers
1
2
3
4
5
6
7
8
9
10
d. First 10 Whole numbers
0
1
2
3
4
5
6
7
8
9`,
      },
    ],
  },
  {
    key: "q02",
    stem: "Write a program to print first 10 integers and their squares using while loop.\n1     1\n2     4\n3     9 and so on",
    difficulty: "EASY",
    starterCode: `# Print the first 10 integers and their squares, one pair per line.
#   1 1
#   2 4
#   3 9
#
# The square is i*i - no exponent needed.

i = 1
while i <= 10:
    # your code here
    i = i + 1
`,
    solutionCode: `i = 1
while i <= 10:
    print(i, i * i)
    i = i + 1
`,
    explanation:
      "One counter drives the loop and the square comes from i*i. print(i, i*i) puts a space between the two, which is exactly the alignment shown in the question.",
    testCases: [
      {
        stdin: "",
        expected: `1 1
2 4
3 9
4 16
5 25
6 36
7 49
8 64
9 81
10 100`,
      },
    ],
  },
  {
    key: "q03",
    stem: "Write for loop statement to print the following series: 10, 20, 30 … … 300",
    difficulty: "EASY",
    starterCode: `# Print the series 10, 20, 30 ... 300.
# Print one number per line.
#
# The question asks for a for loop here, so use range().

for n in range(0):
    print(n)
`,
    solutionCode: `for n in range(10, 301, 10):
    print(n)
`,
    explanation:
      "range(10, 301, 10) walks 10, 20, 30 ... 300. The stop value is 301 rather than 300 because range() excludes the value it stops at.",
    testCases: [
      { stdin: "", expected: Array.from({ length: 30 }, (_, i) => (i + 1) * 10).join("\n") },
    ],
  },
  {
    key: "q04",
    stem: "Write a while loop statement to print the following series: 105, 98, 91 ………7.",
    difficulty: "EASY",
    starterCode: `# Print the series 105, 98, 91 ... 7, one number per line.
# The series goes down by 7 each time.

n = 105
while n > 0:
    print(n)
    # your code here
`,
    solutionCode: `n = 105
while n >= 7:
    print(n)
    n = n - 7
`,
    explanation:
      "Start at 105 and subtract 7 each pass. The stopping condition is n >= 7 because 7 itself is part of the series: 105, 98, 91, ... 14, 7.",
    testCases: [{ stdin: "", expected: Array.from({ length: 15 }, (_, i) => 105 - i * 7).join("\n") }],
  },
  {
    key: "q05",
    stem: "Write a program to print first 10 natural number in reverse order using while loop.",
    difficulty: "EASY",
    starterCode: `# Print 10 down to 1, one number per line.

i = 10
while i > 0:
    print(i)
    # your code here
`,
    solutionCode: `i = 10
while i >= 1:
    print(i)
    i = i - 1
`,
    explanation:
      "Set the counter to 10 and decrease it. The loop must run while i >= 1 so that 1 is printed before the loop stops.",
    testCases: [{ stdin: "", expected: Array.from({ length: 10 }, (_, i) => 10 - i).join("\n") }],
  },
  {
    key: "q06",
    stem: "Write a program to print sum of first 10 Natural numbers.",
    difficulty: "EASY",
    starterCode: `# Print the sum of the first 10 natural numbers: 1+2+...+10 = 55.
# Print only the number 55.

i = 1
total = 0
while i <= 10:
    # your code here
`,
    solutionCode: `i = 1
total = 0
while i <= 10:
    total = total + i
    i = i + 1
print(total)
`,
    explanation:
      "Keep a running total in a variable that starts at 0, add each number to it inside the loop, and print the total once after the loop has finished.",
    testCases: [{ stdin: "", expected: "55" }],
  },
  {
    key: "q07",
    stem: "Write a program to print sum of first 10 Even numbers.",
    difficulty: "EASY",
    starterCode: `# Print the sum of the first 10 even numbers: 2+4+...+20 = 110.
# Print only the number 110.

i = 1
total = 0
while i <= 10:
    # your code here
`,
    solutionCode: `i = 1
total = 0
while i <= 10:
    total = total + 2 * i
    i = i + 1
print(total)
`,
    explanation:
      "The same running-total loop as before, but the number added each pass is the i-th even number, 2*i.",
    testCases: [{ stdin: "", expected: "110" }],
  },
  {
    key: "q08",
    stem: "Write a program to print table of a number entered from the user.",
    difficulty: "EASY",
    starterCode: `# Read a number from the user and print its multiplication table
# from 1 to 10, one line per multiple.
#
# If the user enters 5 the output is:
#   5 x 1 = 5
#   5 x 2 = 10
#   ... up to 5 x 10 = 50

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
i = 1
while i <= 10:
    print(n, "x", i, "=", n * i)
    i = i + 1
`,
    explanation:
      "Read the number with input(), then loop i from 1 to 10 printing n x i = n*i. The loop counter and the value being multiplied are different things, so keep them as separate variables.",
    testCases: [{ stdin: "5\n", expected: "5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n5 x 6 = 30\n5 x 7 = 35\n5 x 8 = 40\n5 x 9 = 45\n5 x 10 = 50" }],
  },
  {
    key: "q09",
    stem: "Write a program to print all even numbers that falls between two numbers (exclusive both numbers) entered from the user using while loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read two numbers from the user and print the even numbers
# strictly between them, one per line. The two numbers themselves
# must NOT be printed even if they are even.
#
# The user may enter them in either order, so sort them first.

a = int(input())
b = int(input())

# your code here
`,
    solutionCode: `a = int(input())
b = int(input())
if a > b:
    a, b = b, a

n = a + 1
while n < b:
    if n % 2 == 0:
        print(n)
    n = n + 1
`,
    explanation:
      "\"Exclusive both numbers\" means start from a+1 and stop before b. Swapping a and b first handles the case where the smaller number was typed second, and testing n % 2 == 0 picks out the even numbers.",
    testCases: [
      { stdin: "3\n10\n", expected: "4\n6\n8" },
      { stdin: "10\n3\n", expected: "4\n6\n8" },
      { stdin: "4\n8\n", expected: "6" },
    ],
  },
  {
    key: "q10",
    stem: "Write a program to check whether a number is prime or not using while loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a number and print either "Prime" or "Not Prime".
# 1 is not prime. Any number divisible only by itself and 1 is prime.
#
# You only need to test divisors up to the square root of the number.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())

if n < 2:
    print("Not Prime")
else:
    i = 2
    prime = True
    while i * i <= n:
        if n % i == 0:
            prime = False
            break
        i = i + 1
    if prime:
        print("Prime")
    else:
        print("Not Prime")
`,
    explanation:
      "Numbers below 2 are never prime. For larger numbers, try dividing by 2, 3, 4 ... and stop as soon as i*i exceeds n, because if n had a factor larger than its square root it would also have a smaller one. A number with no divisor found is prime.",
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
    stem: "Write a program to find the sum of the digits of a number accepted from the user.",
    difficulty: "MEDIUM",
    starterCode: `# Read a number and print the sum of its digits.
# For 1234 the sum is 1+2+3+4 = 10.
#
# Use % 10 to take the last digit and // 10 to drop it.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
total = 0
while n > 0:
    total = total + n % 10
    n = n // 10
print(total)
`,
    explanation:
      "Repeatedly peel off the last digit with n % 10 and add it to the total, then remove it with n = n // 10. When n reaches 0 every digit has been counted.",
    testCases: [
      { stdin: "1234\n", expected: "10" },
      { stdin: "999\n", expected: "27" },
      { stdin: "7\n", expected: "7" },
      { stdin: "1000\n", expected: "1" },
    ],
  },
  {
    key: "q12",
    stem: "Write a program to find the product of the digits of a number accepted from the user.",
    difficulty: "MEDIUM",
    starterCode: `# Read a number and print the product of its digits.
# For 123 the product is 1*2*3 = 6.
#
# Watch out: the product starts at 1, not 0, or every answer
# would come out as zero. Any zero digit makes the product zero.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
product = 1
while n > 0:
    product = product * (n % 10)
    n = n // 10
print(product)
`,
    explanation:
      "Same digit-picking loop as the sum, but multiply instead of add. The running product must start at 1 because 0 times anything is 0.",
    testCases: [
      { stdin: "123\n", expected: "6" },
      { stdin: "4321\n", expected: "24" },
      { stdin: "505\n", expected: "0" },
      { stdin: "9\n", expected: "9" },
    ],
  },
  {
    key: "q13",
    stem: "Write a program to reverse the number accepted from user using while loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a number and print it with its digits reversed.
# For 1234 the output is 4321.
#
# Build the answer by adding each new digit on the right:
#   answer = answer * 10 + digit

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
answer = 0
while n > 0:
    answer = answer * 10 + n % 10
    n = n // 10
print(answer)
`,
    explanation:
      "Take the last digit of n with n % 10, push the existing answer one place left with * 10, add the digit, then drop the digit from n with // 10. Repeating this reverses the number.",
    testCases: [
      { stdin: "1234\n", expected: "4321" },
      { stdin: "100\n", expected: "1" },
      { stdin: "56\n", expected: "65" },
      { stdin: "7\n", expected: "7" },
    ],
  },
  {
    key: "q14",
    stem: "Write a program to display the number names of the digits of a number entered by user, for example if the number is 231 then output should be Two Three One.",
    difficulty: "MEDIUM",
    starterCode: `# Read a number and print each digit's name in capitals,
# separated by a single space. For 231 the output is "Two Three One".
#
# A list indexed by the digit gives you the name directly:
#   names[digit]

names = ["Zero", "One", "Two", "Three", "Four",
         "Five", "Six", "Seven", "Eight", "Nine"]

n = int(input())

# your code here
`,
    solutionCode: `names = ["Zero", "One", "Two", "Three", "Four",
         "Five", "Six", "Seven", "Eight", "Nine"]

n = int(input())
answer = []
while n > 0:
    answer.append(names[n % 10])
    n = n // 10

if answer == []:
    answer.append(names[0])
answer.reverse()
print(" ".join(answer))
`,
    explanation:
      "Taking digits from the right with n % 10 gives them back to front, so collect the names into a list, reverse the list, then join it with spaces. Joining with \" \".join(...) keeps exactly one space between names.",
    testCases: [
      { stdin: "231\n", expected: "Two Three One" },
      { stdin: "0\n", expected: "Zero" },
      { stdin: "45\n", expected: "Four Five" },
      { stdin: "9007\n", expected: "Nine Zero Zero Seven" },
    ],
  },
  {
    key: "q15",
    stem: "Write a program to print the Fibonacci series till n terms (Accept n from user) using while loop.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read n and print the first n Fibonacci numbers,
# one per line. The series starts 0, 1, 1, 2, 3, 5, 8 ...
#
# You need to remember the previous two terms.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
a, b = 0, 1
i = 0
while i < n:
    print(a)
    a, b = b, a + b
    i = i + 1
`,
    explanation:
      "Keep the current and next term in two variables. Print the current one, then shift them along with a, b = b, a + b. The series begins 0, 1, 1, 2, 3, 5 with 0 as the first term.",
    testCases: [
      { stdin: "7\n", expected: "0\n1\n1\n2\n3\n5\n8" },
      { stdin: "1\n", expected: "0" },
      { stdin: "10\n", expected: "0\n1\n1\n2\n3\n5\n8\n13\n21\n34" },
    ],
  },
  {
    key: "q16",
    stem: "Write a program to print the factorial of a number accepted from user.",
    difficulty: "EASY",
    important: true,
    starterCode: `# Read a number and print its factorial.
# 5! = 120. Remember 0! = 1.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
fact = 1
i = 1
while i <= n:
    fact = fact * i
    i = i + 1
print(fact)
`,
    explanation:
      "Start the answer at 1 and multiply by every number from 1 up to n. Starting at 1 also gives the right answer for n = 0, since the loop never runs and 0! is 1.",
    testCases: [
      { stdin: "5\n", expected: "120" },
      { stdin: "0\n", expected: "1" },
      { stdin: "1\n", expected: "1" },
      { stdin: "10\n", expected: "3628800" },
    ],
  },
  {
    key: "q17",
    stem: "Write a program to check whether a number is Armstrong or not. (Armstrong number is a number that is equal to the sum of cubes of its digits for example : 153 = 1^3 + 5^3 + 3^3.)",
    difficulty: "MEDIUM",
    starterCode: `# Read a number and print "Armstrong" if it equals the sum of
# the cubes of its digits, otherwise print "Not Armstrong".
# 153 and 370 and 407 are Armstrong numbers.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())

x = n
total = 0
while x > 0:
    digit = x % 10
    total = total + digit ** 3
    x = x // 10

if total == n:
    print("Armstrong")
else:
    print("Not Armstrong")
`,
    explanation:
      "Copy the number first, because the loop destroys the original with // 10 and the comparison needs the number that was typed. Cube each digit with digit ** 3 and add it to the total.",
    testCases: [
      { stdin: "153\n", expected: "Armstrong" },
      { stdin: "407\n", expected: "Armstrong" },
      { stdin: "100\n", expected: "Not Armstrong" },
      { stdin: "370\n", expected: "Armstrong" },
    ],
  },
  {
    key: "q18",
    stem: "Write a program to add first n terms of the following series using a for loop:\n1/1! + 1/2! + 1/3! + ........ + 1/n!",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read n and print the sum of 1/1! + 1/2! + ... + 1/n!
# rounded to 6 decimal places.
#
# Do not call math.factorial: work the factorial out yourself as you
# go, so each term only needs one multiplication.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
fact = 1
total = 0.0
for i in range(1, n + 1):
    fact = fact * i
    total = total + 1 / fact
print(round(total, 6))
`,
    explanation:
      "Build the factorial up one step at a time and divide 1 by it each pass. Adding 1/fact to a total that starts at 0.0 keeps the arithmetic in floating point. For n = 4 the sum is 1.666667.",
    testCases: [
      { stdin: "4\n", expected: "1.708333" },
      { stdin: "1\n", expected: "1.0" },
      { stdin: "5\n", expected: "1.716667" },
    ],
  },
  {
    key: "q19",
    stem: "Write a program to enter the numbers till the user wants and at the end it should display the sum of all the numbers entered.",
    difficulty: "EASY",
    starterCode: `# Keep reading numbers and add them to a total.
# The user stops the program by typing a negative number -
# that number is NOT included in the sum.
# Print only the final sum.

total = 0

# your code here
`,
    solutionCode: `total = 0
while True:
    n = int(input())
    if n < 0:
        break
    total = total + n
print(total)
`,
    explanation:
      "while True with a break is the standard way to loop until the user says stop. Testing for the stop value before adding it keeps the stopping number out of the total.",
    testCases: [
      { stdin: "10\n20\n30\n-1\n", expected: "60" },
      { stdin: "5\n5\n5\n5\n-9\n", expected: "20" },
      { stdin: "-2\n", expected: "0" },
    ],
  },
  {
    key: "q20",
    stem: "Write a program to enter the numbers till the user enter ZERO and at the end it should display the count of positive and negative numbers entered.",
    difficulty: "MEDIUM",
    starterCode: `# Keep reading numbers until the user types 0.
# 0 itself is not counted.
# Then print the positive count and the negative count,
# one per line, in that order.

positive = 0
negative = 0

# your code here
`,
    solutionCode: `positive = 0
negative = 0
while True:
    n = int(input())
    if n == 0:
        break
    if n > 0:
        positive = positive + 1
    else:
        negative = negative + 1

print(positive)
print(negative)
`,
    explanation:
      "Two counters, incremented on opposite branches of the comparison. Break out of the loop as soon as 0 arrives, before either counter is touched, so the stopping zero is ignored.",
    testCases: [
      { stdin: "5\n-3\n2\n0\n", expected: "2\n1" },
      { stdin: "0\n", expected: "0\n0" },
      { stdin: "-1\n-2\n-3\n0\n", expected: "0\n3" },
    ],
  },
  {
    key: "q21",
    stem: "Write a program to find the HCF of two numbers entered from the user.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read two numbers and print their HCF (highest common factor).
# 12 and 18 have an HCF of 6.
#
# The Euclidean algorithm keeps subtracting the smaller from the
# larger until the two numbers are equal. That value is the HCF.

a = int(input())
b = int(input())

# your code here
`,
    solutionCode: `a = int(input())
b = int(input())

while b != 0:
    a, b = b, a % b
print(a)
`,
    explanation:
      "The Euclidean algorithm replaces (a, b) with (b, a % b) and repeats. When b finally becomes 0, a holds the HCF. The swapped assignment uses the old values of both variables, so nothing is lost.",
    testCases: [
      { stdin: "12\n18\n", expected: "6" },
      { stdin: "7\n13\n", expected: "1" },
      { stdin: "48\n18\n", expected: "6" },
      { stdin: "9\n9\n", expected: "9" },
    ],
  },
  {
    key: "q22",
    stem: "Write a program to convert Decimal to Binary.",
    difficulty: "MEDIUM",
    starterCode: `# Read a decimal number and print it in binary.
# 10 becomes 1010. Do not use bin() or format(..., 'b').
#
# Repeatedly divide by 2, keep each remainder, then print the
# remainders in the opposite order to the one you collected them.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())

bits = []
while n > 0:
    bits.append(str(n % 2))
    n = n // 2

if bits == []:
    bits.append("0")

print("".join(reversed(bits)))
`,
    explanation:
      "n % 2 gives the binary digit from the right, so the digits come out least significant first. Reversing the collected list puts them in the right order. Zero needs a special case because its loop never runs.",
    testCases: [
      { stdin: "10\n", expected: "1010" },
      { stdin: "0\n", expected: "0" },
      { stdin: "7\n", expected: "111" },
      { stdin: "255\n", expected: "11111111" },
    ],
  },
  {
    key: "q23",
    stem: "Write a program to convert Binary to Decimal.",
    difficulty: "MEDIUM",
    starterCode: `# Read a binary number as text and print its decimal value.
# 1010 becomes 10. Do not use int(x, 2).
#
# Work left to right: double the running total, then add the
# next bit. Doubling is what moves a digit one place left.

bits = input()

# your code here
`,
    solutionCode: `bits = input()

total = 0
i = 0
while i < len(bits):
    total = total * 2 + int(bits[i])
    i = i + 1
print(total)
`,
    explanation:
      "Reading the string one character at a time, multiply the total by 2 to shift it left one place and add the new bit. 1010 gives 1, then 2, then 5, then 10.",
    testCases: [
      { stdin: "1010\n", expected: "10" },
      { stdin: "0\n", expected: "0" },
      { stdin: "1111\n", expected: "15" },
      { stdin: "100000\n", expected: "32" },
    ],
  },
  {
    key: "q24",
    stem: "Write a program to check whether a number is palindrome or not.",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a number and print "Palindrome" if it reads the same
# forwards and backwards, otherwise print "Not Palindrome".
# 121 and 1331 are palindromes; 123 is not.
#
# Build the reversed number and compare.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())

x = n
reverse = 0
while x > 0:
    reverse = reverse * 10 + x % 10
    x = x // 10

if n == reverse:
    print("Palindrome")
else:
    print("Not Palindrome")
`,
    explanation:
      "Reverse the digits with the running answer = answer * 10 + digit trick, keeping the original number untouched in n, then compare the two.",
    testCases: [
      { stdin: "121\n", expected: "Palindrome" },
      { stdin: "123\n", expected: "Not Palindrome" },
      { stdin: "1331\n", expected: "Palindrome" },
      { stdin: "7\n", expected: "Palindrome" },
    ],
  },
  {
    key: "q25",
    stem: "Write a python program to sum the sequence: 1 + 1/1! + 1/2! + 1/3! + ........ + 1/n!",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read n and print the sum of 1 + 1/1! + 1/2! + ... + 1/n!
# rounded to 6 decimal places.
#
# Unlike question 18 this series starts with a plain 1 in front of
# the fractions, so start the total at 1.0.

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
      "Same running-factorial loop as before, but the total starts at 1.0 because this series has that extra leading 1. For n = 3 the sum is 2.666667.",
    testCases: [
      { stdin: "3\n", expected: "2.666667" },
      { stdin: "4\n", expected: "2.708333" },
      { stdin: "1\n", expected: "2.0" },
    ],
  },
  {
    key: "q26",
    stem: "Write a program to accept 10 numbers from the user and display it's average.",
    difficulty: "EASY",
    starterCode: `# Read exactly 10 numbers from the user and print their average.
# A whole-number answer should print without a decimal point,
# so divide with // when there is no remainder.

total = 0
count = 0

while count < 10:
    # your code here
`,
    solutionCode: `total = 0
count = 0
while count < 10:
    total = total + int(input())
    count = count + 1

average = total / 10
if total % 10 == 0:
    print(total // 10)
else:
    print(round(average, 2))
`,
    explanation:
      "A fixed ten passes, so the loop condition is simply count < 10. Divide the total by 10 at the end; using // when the total divides exactly keeps the output tidy for sums like 10 numbers averaging to 5.",
    testCases: [
      { stdin: "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n", expected: "5.5" },
      { stdin: "1\n1\n1\n1\n1\n1\n1\n1\n1\n2\n", expected: "1.1" },
      { stdin: "10\n20\n30\n40\n50\n60\n70\n80\n90\n100\n", expected: "55" },
    ],
  },
  {
    key: "q27",
    stem: "Write a program to accept 10 numbers from the user and display the largest & smallest number.",
    difficulty: "EASY",
    starterCode: `# Read exactly 10 numbers and print the largest and the
# smallest, largest first, one per line.
#
# Seed the two with the first number rather than 0, otherwise a
# list of only negative numbers would give the wrong answer.

first = int(input())
largest = first
smallest = first
count = 1

while count < 10:
    # your code here
`,
    solutionCode: `first = int(input())
largest = first
smallest = first
count = 1

while count < 10:
    n = int(input())
    if n > largest:
        largest = n
    if n < smallest:
        smallest = n
    count = count + 1

print(largest)
print(smallest)
`,
    explanation:
      "Read the first number and copy it into both largest and smallest, then read the remaining nine. Compare each new number against both and update whichever one it beats. Seeding from the first value rather than 0 keeps an all-negative list correct.",
    testCases: [
      { stdin: "5\n3\n9\n1\n7\n2\n8\n4\n6\n0\n", expected: "9\n0" },
      { stdin: "-5\n-3\n-9\n-1\n-7\n-2\n-8\n-4\n-6\n-10\n", expected: "-1\n-10" },
      { stdin: "4\n4\n4\n4\n4\n4\n4\n4\n4\n4\n", expected: "4\n4" },
    ],
  },
  {
    key: "q28",
    stem: "Write a program to display sum of odd numbers and even numbers separately that fall between two numbers accepted from the user (including both numbers) using while loop.",
    difficulty: "MEDIUM",
    starterCode: `# Read two numbers and print the sum of the odd numbers and
# the sum of the even numbers BETWEEN them, both ends included.
# Print the odd sum first, then the even sum.
#
# This time the two end numbers are included, so start at the
# smaller one rather than one past it.

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
n = a
while n <= b:
    if n % 2 == 0:
        even = even + n
    else:
        odd = odd + n
    n = n + 1

print(odd)
print(even)
`,
    explanation:
      "Unlike question 9 the ends are included here, so the loop starts at a and runs while n <= b. Keep two running sums and add each number to the odd or even one.",
    testCases: [
      { stdin: "1\n10\n", expected: "25\n30" },
      { stdin: "10\n1\n", expected: "25\n30" },
      { stdin: "4\n6\n", expected: "5\n10" },
    ],
  },
  {
    key: "q29",
    stem: "Write a program to display all the numbers which are divisible by 13 but not by 3 between 100 and 500 (exclusive both numbers).",
    difficulty: "MEDIUM",
    starterCode: `# Print every number strictly between 100 and 500 that is
# divisible by 13 and NOT divisible by 3, one number per line.
#
# 100 and 500 themselves must not be printed.

n = 101

while n < 500:
    # your code here
    n = n + 1
`,
    solutionCode: `n = 101
while n < 500:
    if n % 13 == 0 and n % 3 != 0:
        print(n)
    n = n + 1
`,
    explanation:
      "Start at 101 and stop before 500 to exclude both ends. The two conditions are joined with and, so a number has to pass both tests: a multiple of 13 that is not also a multiple of 3.",
    testCases: [
      {
        stdin: "",
        expected: Array.from({ length: 400 }, (_, i) => 101 + i)
          .filter((n) => n % 13 === 0 && n % 3 !== 0)
          .join("\n"),
      },
    ],
  },
  {
    key: "q30",
    stem: "Write a program to print the following series till n terms:\n2 , 22 , 222 , 2222 _ _ _ _ _ n terms",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read n and print the first n terms of 2, 22, 222, 2222 ...
# one term per line.
#
# Each new term is the previous one times 10 plus 2.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
term = 0
count = 0
while count < n:
    term = term * 10 + 2
    print(term)
    count = count + 1
`,
    explanation:
      "Build each term from the one before it: multiplying by 10 shifts the existing 2s left and adding another 2 puts a 2 in the units place.",
    testCases: [
      { stdin: "5\n", expected: "2\n22\n222\n2222\n22222" },
      { stdin: "1\n", expected: "2" },
      { stdin: "8\n", expected: "2\n22\n222\n2222\n22222\n222222\n2222222\n22222222" },
    ],
  },
  {
    key: "q31",
    stem: "Write a program to print the following series till n terms:\n1 4 9 16 25 _ _ _ _ _ n terms.",
    difficulty: "EASY",
    starterCode: `# Read n and print the first n square numbers,
# one per line: 1, 4, 9, 16, 25 ...

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
i = 1
while i <= n:
    print(i * i)
    i = i + 1
`,
    explanation:
      "The series is the squares of 1, 2, 3 ... so the i-th term is i*i for i from 1 to n.",
    testCases: [
      { stdin: "6\n", expected: "1\n4\n9\n16\n25\n36" },
      { stdin: "1\n", expected: "1" },
      { stdin: "10\n", expected: Array.from({ length: 10 }, (_, i) => (i + 1) ** 2).join("\n") },
    ],
  },
  {
    key: "q32",
    stem: "Write a program to find the sum of the following series (accept values of x and n from user):\n1 + x/1! + x^2/2! + .......... x^n/n!",
    difficulty: "HARD",
    important: true,
    starterCode: `# Read x and n, then print the sum of
# 1 + x/1! + x^2/2! + ... + x^n/n!  rounded to 6 decimal places.
#
# The powers of x are also built up step by step:
#   xpower = xpower * x
# Do not use ** or math.factorial for the running values.

x = int(input())
n = int(input())

# your code here
`,
    solutionCode: `x = int(input())
n = int(input())

fact = 1
xpower = 1
total = 1.0
i = 1
while i <= n:
    fact = fact * i
    xpower = xpower * x
    total = total + xpower / fact
    i = i + 1

print(round(total, 6))
`,
    explanation:
      "Three running values are needed: the factorial, the current power of x, and the total. The total starts at 1.0 because the series begins with a plain 1 before x/1!. For x = 2, n = 3 the sum is 4.333333.",
    testCases: [
      { stdin: "2\n3\n", expected: "6.333333" },
      { stdin: "1\n2\n", expected: "2.5" },
      { stdin: "3\n4\n", expected: "16.375" },
    ],
  },
  {
    key: "q33",
    stem: "Write a program to find the sum of following series:\nx + x^2/2 + .......... x^n/n",
    difficulty: "HARD",
    important: true,
    starterCode: `# Read x and n, then print the sum of
# x + x^2/2 + x^3/3 + ... + x^n/n  rounded to 6 decimal places.
#
# There is no factorial here - each term divides by the term
# number itself, and the powers of x still build up one at a time.

x = int(input())
n = int(input())

# your code here
`,
    solutionCode: `x = int(input())
n = int(input())

xpower = 1
total = 0.0
i = 1
while i <= n:
    xpower = xpower * x
    total = total + xpower / i
    i = i + 1

print(round(total, 6))
`,
    explanation:
      "Multiply the running power by x to get x^i, then divide by i to get the term. The total starts at 0.0 because this series has no leading term. For x = 2, n = 4 the sum is 9.666667.",
    testCases: [
      { stdin: "2\n4\n", expected: "10.666667" },
      { stdin: "3\n2\n", expected: "7.5" },
      { stdin: "1\n5\n", expected: "2.283333" },
    ],
  },
  {
    key: "q34",
    stem: "Write a program to find the sum of following series:\n1 + 8 + 27 ………… n terms",
    difficulty: "EASY",
    starterCode: `# Read n and print the sum of the first n cubes,
# 1 + 8 + 27 + ... rounded to 6 decimal places.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
total = 0.0
i = 1
while i <= n:
    total = total + i * i * i
    i = i + 1
print(round(total, 6))
`,
    explanation:
      "The series is the cubes of 1, 2, 3 ... so add i*i*i each pass. Starting the total at 0.0 keeps the arithmetic in floating point. For n = 4 the sum is 100.0.",
    testCases: [
      { stdin: "4\n", expected: "100.0" },
      { stdin: "1\n", expected: "1.0" },
      { stdin: "6\n", expected: "441.0" },
    ],
  },
  {
    key: "q35",
    stem: "Write a program to find the sum of following series:\n1 + 2 + 6 + 24 + 120 . . . . . n terms",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read n and print the sum of the first n factorials:
# 1! + 2! + 3! + ... + n!
# For n = 5 the answer is 153.
#
# The factorial builds up one multiplication at a time.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
fact = 1
total = 0
i = 1
while i <= n:
    fact = fact * i
    total = total + fact
    i = i + 1
print(total)
`,
    explanation:
      "Keep one running factorial and add it to the total on each pass, instead of computing each factorial from scratch. 1 + 2 + 6 + 24 + 120 = 153.",
    testCases: [
      { stdin: "5\n", expected: "153" },
      { stdin: "1\n", expected: "1" },
      { stdin: "4\n", expected: "33" },
    ],
  },
  {
    key: "q36",
    stem: "Write a program to find the sum of following series:\nS = 1 + 4 – 9 + 16 – 25 + 36 – … … n terms",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read n and print the sum of the first n terms of
# 1 + 4 - 9 + 16 - 25 + 36 - ...
#
# Every term is a square: 1, 4, 9, 16, 25, 36 ...
# The signs are +, +, then - + - + ... , so from the third term
# onwards a term is subtracted when its position is odd.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())
total = 0
i = 1
while i <= n:
    square = i * i
    if i <= 2 or i % 2 == 0:
        total = total + square
    else:
        total = total - square
    i = i + 1
print(total)
`,
    explanation:
      "Every term is i*i. The first two terms (1 and 4) are both added, and from the third onwards the sign alternates, so an odd position (3, 5, 7 ...) is subtracted and an even position is added: 1 + 4 - 9 + 16 - 25 + 36. For n = 6 the sum is 23.",
    testCases: [
      { stdin: "6\n", expected: "23" },
      { stdin: "3\n", expected: "-4" },
      { stdin: "7\n", expected: "-26" },
      { stdin: "2\n", expected: "5" },
    ],
  },
  {
    key: "q37",
    stem: "Write a Program to print all the characters in the string ‘PYTHON’ using while loop.",
    difficulty: "EASY",
    important: true,
    starterCode: `# Print every character of the word PYTHON, one per line.
# Do not use a for loop for the string and do not index from 0
# upward using len(); a while loop with an index is expected.

word = "PYTHON"
i = 0

while i < len(word):
    # your code here
    i = i + 1
`,
    solutionCode: `word = "PYTHON"
i = 0
while i < len(word):
    print(word[i])
    i = i + 1
`,
    explanation:
      "A string can be indexed like a list, so word[i] gives one character. Start i at 0 and keep it below len(word), increasing it each pass.",
    testCases: [{ stdin: "", expected: "P\nY\nT\nH\nO\nN" }],
  },
  {
    key: "q38",
    stem: "Write a program to print only odd numbers from the given list using while loop:\nL = [23, 45, 32, 25, 46, 33, 71, 90]",
    difficulty: "EASY",
    starterCode: `# Print only the odd numbers from the list, one per line.
# The list is given; only the loop is yours to write.

L = [23, 45, 32, 25, 46, 33, 71, 90]
i = 0

while i < len(L):
    # your code here
    i = i + 1
`,
    solutionCode: `L = [23, 45, 32, 25, 46, 33, 71, 90]
i = 0
while i < len(L):
    if L[i] % 2 != 0:
        print(L[i])
    i = i + 1
`,
    explanation:
      "Walk the list with an index and print an element only when it fails to divide evenly by 2. The counter must advance whether or not the element is printed, so i = i + 1 stays outside the if.",
    testCases: [{ stdin: "", expected: "23\n45\n25\n33\n71" }],
  },
  {
    key: "q39",
    stem: "Write a program to print all the factors of a number using for loop.",
    difficulty: "EASY",
    important: true,
    starterCode: `# Read a number and print all of its factors in increasing order,
# one per line. 1 and the number itself are both factors.
# The question asks for a for loop.
#
# Walk i from 1 upwards; whenever i divides n it is a factor, and
# range() walks upward so the factors come out already in order.

n = int(input())

# your code here
`,
    solutionCode: `n = int(input())

for i in range(1, n + 1):
    if n % i == 0:
        print(i)
`,
    explanation:
      "n % i == 0 is exactly the definition of a factor, and i = 1 and i = n always pass, so both end factors are included. range(1, n + 1) walks upward, which is why the printed factors are already in increasing order. For 16 the divisors are 1, 2, 4, 8, 16 - note 4 is counted once even though it pairs with itself.",
    testCases: [
      { stdin: "12\n", expected: "1\n2\n3\n4\n6\n12" },
      { stdin: "16\n", expected: "1\n2\n4\n8\n16" },
      { stdin: "13\n", expected: "1\n13" },
      { stdin: "1\n", expected: "1" },
    ],
  },
  {
    key: "q40",
    stem: "Write a python program to get the following output:\n1——49\n2——48\n3——47\n. .\n. .\n48——2\n49——1",
    difficulty: "MEDIUM",
    starterCode: `# Print the pairing shown below, with "----" between the numbers
# and no trailing spaces:
#
# 1----49
# 2----48
# ...
# 49----1
#
# The first number counts up to 49 and the second counts down.

i = 1

while i <= 49:
    # your code here
    i = i + 1
`,
    solutionCode: `i = 1
while i <= 49:
    print(i, "----", 50 - i, sep="")
    i = i + 1
`,
    explanation:
      "The first column runs 1 to 49 and the second is always 50 minus it, so only one counter is needed. print(i, \"----\", 50 - i, sep=\"\") suppresses the spaces print would otherwise insert, which keeps the dashes tight against both numbers.",
    testCases: [
      {
        stdin: "",
        expected: Array.from({ length: 49 }, (_, i) => `${i + 1}----${49 - i}`).join("\n"),
      },
    ],
  },
  {
    key: "q41",
    stem: "Write a program in python to input the value of x and n and print the sum of the following series:\n−x + x²/2 − x³/3 + x⁴/4 − … + xⁿ/n",
    difficulty: "HARD",
    important: true,
    starterCode: `# Read x and n, then print the sum of
#   -x + x^2/2 - x^3/3 + x^4/4 - ... (+ or -) x^n/n
# rounded to 6 decimal places.
#
# The powers of x build up step by step (xpower = xpower * x),
# every k-th term divides by k, and the sign alternates - :
#   odd powers are subtracted, even powers are added.

x = int(input())
n = int(input())

# your code here
`,
    solutionCode: `x = int(input())
n = int(input())

xpower = 1
total = 0.0
k = 1
while k <= n:
    xpower = xpower * x
    term = xpower / k
    if k % 2 == 1:
        total = total - term
    else:
        total = total + term
    k = k + 1

print(round(total, 6))
`,
    explanation:
      "Each term is x^k / k with an alternating sign: odd powers are subtracted and even powers are added, so a running power (xpower = xpower * x) plus a check on k % 2 gives every term exactly once. For x = 2, n = 3 the sum is -2 + 2 - 2.666667 = -2.666667.",
    testCases: [
      { stdin: "1\n4\n", expected: "-0.583333" },
      { stdin: "2\n3\n", expected: "-2.666667" },
      { stdin: "1\n2\n", expected: "-0.5" },
    ],
  },
  {
    key: "q42",
    stem: "Write a program in python that accepts two numbers and swap them without using a third variable.",
    difficulty: "EASY",
    important: true,
    starterCode: `# Read two numbers and print them swapped - a first, then b -
# WITHOUT using a third variable. Use only arithmetic on a and b.
#
# The classic trick:
#   a = a + b
#   b = a - b
#   a = a - b

a = int(input())
b = int(input())

# your code here

print(a)
print(b)
`,
    solutionCode: `a = int(input())
b = int(input())

a = a + b
b = a - b
a = a - b

print(a)
print(b)
`,
    explanation:
      "Adding b into a and then subtracting the new a from b recovers the original a in b, and subtracting that from a recovers the original b - all with just two variables. For input 5 and 7 the output is 7 then 5.",
    testCases: [
      { stdin: "5\n7\n", expected: "7\n5" },
      { stdin: "10\n20\n", expected: "20\n10" },
      { stdin: "3\n3\n", expected: "3\n3" },
    ],
  },
  {
    key: "q43",
    stem: "Write a program in python that accepts a and b two integers and compute the greatest common divisor. (Marks: 2 + 3 = 5)",
    difficulty: "MEDIUM",
    important: true,
    starterCode: `# Read a and b (two integers) and print their GCD
# (greatest common divisor). The GCD of 12 and 18 is 6.
#
# Euclidean algorithm: keep replacing (a, b) with (b, a % b)
# until b becomes 0 - then a holds the GCD.

a = int(input())
b = int(input())

# your code here
`,
    solutionCode: `a = int(input())
b = int(input())

while b != 0:
    a, b = b, a % b

print(a)
`,
    explanation:
      "The Euclidean algorithm replaces (a, b) with (b, a % b) and repeats. When b finally reaches 0, a holds the GCD. The swapped assignment uses the old values of both variables, so the modulo is computed before a changes.",
    testCases: [
      { stdin: "12\n18\n", expected: "6" },
      { stdin: "48\n18\n", expected: "6" },
      { stdin: "7\n13\n", expected: "1" },
    ],
  },
];