/**
 * The first 3D course: Encoding Schemes & Conversions.
 *
 * Static teaching content, deliberately kept out of the database. It is the
 * same for every student, never graded, and changing a lesson cannot disturb a
 * single row of the platform. The interactive models are generated from the
 * student's own controls by `buildScene`.
 */
import {
  bitString,
  bitValue,
  digitChar,
  divisionSteps,
  groupBits,
  groupValue,
  toBits,
  type LearningState,
  type SceneKind,
} from "./scenes";

export const COURSE_ID = "encoding-schemes";
export const COURSE_CHAPTER = "Encoding Schemes and Number System";
export const COURSE_TITLE = "Encoding Schemes & Conversions";
export const COURSE_TAGLINE = "See bits become numbers, letters and colour.";

export type ControlKind = "bits" | "decimal" | "base" | "text";

export type StoryBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "example"; title: string; lines: string[] }
  | { kind: "note"; tone: "tip" | "remember" | "watch"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

export type Concept = {
  id: string;
  title: string;
  tagline: string;
  minutes: number;
  scene: SceneKind;
  controls: ControlKind[];
  story: StoryBlock[];
  /** Live values under the model, recomputed from the student's controls. */
  live: (state: LearningState) => string[];
  quiz: { prompt: string; choices: string[]; answer: number; why: string };
};

const p = (text: string): StoryBlock => ({ kind: "p", text });
const h = (text: string): StoryBlock => ({ kind: "h", text });
const steps = (...items: string[]): StoryBlock => ({ kind: "steps", items });
const example = (title: string, ...lines: string[]): StoryBlock => ({ kind: "example", title, lines });
const note = (tone: "tip" | "remember" | "watch", text: string): StoryBlock => ({ kind: "note", tone, text });
const table = (head: string[], ...rows: string[][]): StoryBlock => ({ kind: "table", head, rows });

const bits = (s: LearningState) => bitString(s.bits);
const hexOf = (s: LearningState) => groupBits(s.bits, 4).map(groupValue).map(digitChar).join("");
const octOf = (s: LearningState) => groupBits(s.bits, 3).map(groupValue).join("");
const divOf = (s: LearningState, base: number) => divisionSteps(s.decimal, base).map((x) => x.digit).reverse().join("");

export const CONCEPTS: Concept[] = [
  {
    id: "bits",
    title: "Bits — the alphabet of a computer",
    tagline: "One switch, two states, a whole digital world.",
    minutes: 4,
    scene: "bits",
    controls: ["bits"],
    story: [
      p("Touch a light switch: it is either off or on. A computer stores information with millions of tiny switches that work the same way. We write the off state as 0 and the on state as 1. One such choice is a **bit** (binary digit) — the smallest unit of information."),
      p("A single bit can only answer a yes/no question. Put eight bits side by side and you get a **byte**, which can hold 256 different patterns. Every letter, pixel, note and instruction in your computer is eventually a long row of these 0s and 1s."),
      h("How many patterns do n bits give?"),
      steps(
        "One bit gives 2 patterns: 0 and 1.",
        "Add a second bit and every old pattern can be followed by 0 or 1 — so 2 × 2 = 4.",
        "Each extra bit doubles the count: n bits give 2ⁿ patterns.",
        "8 bits → 256 patterns (0…255); 10 bits → 1024; 16 bits → 65,536.",
      ),
      example("A quick estimate", "To label 26 letters you need at least 5 bits, because 2⁴ = 16 is too few but 2⁵ = 32 is enough."),
      note("remember", "Bit = one 0 or 1. Byte = 8 bits. They are not interchangeable: a byte is eight times a bit."),
    ],
    live: (s) => [`byte: ${bits(s)}`, `${s.bits.length} bits → 2^${s.bits.length} = ${2 ** s.bits.length} patterns`, `${s.bits.filter(Boolean).length} switches are ON`],
    quiz: {
      prompt: "How many different values can 6 bits represent?",
      choices: ["6", "12", "64", "128"],
      answer: 2,
      why: "Each bit doubles the count: 2⁶ = 64, from 000000 to 111111.",
    },
  },
  {
    id: "radix",
    title: "Number systems — what a 'base' really means",
    tagline: "Base 2, 8, 10 and 16 are four ways to count the same quantity.",
    minutes: 5,
    scene: "radix",
    controls: [],
    story: [
      p("A **number system** is an agreed way of writing quantities. Its **base** (or radix) tells you how many different symbols one position can hold. Decimal uses ten symbols (0–9) because we have ten fingers. Binary uses two because a switch has two states."),
      p("The value of a number does not change when you change its base — only the way it is written does. Thirteen is 13 in decimal, 1101 in binary, 15 in octal and D in hexadecimal."),
      table(["System", "Base", "Allowed symbols", "One digit holds"], ["Binary", "2", "0, 1", "1 bit"], ["Octal", "8", "0–7", "3 bits"], ["Decimal", "10", "0–9", "—"], ["Hexadecimal", "16", "0–9, A–F", "4 bits"]),
      h("Why computer courses love powers of two"),
      p("8, 16 and 256 are all powers of two, so octal and hex are simply shorthand for long binary strings. One octal digit replaces exactly three bits; one hex digit replaces exactly four. No arithmetic is needed — only regrouping."),
      example("The same quantity, four disguises", "1101₂  =  15₈  =  13₁₀  =  D₁₆"),
      note("tip", "Subscripts (₂, ₈, ₁₀, ₁₆) or prefixes (0b, 0x) tell you the base. Never drop them in an exam answer."),
    ],
    live: () => ["2ⁿ patterns per digit position", "binary 1 bit · octal 3 bits · hex 4 bits"],
    quiz: {
      prompt: "Which digit can never appear in an octal number?",
      choices: ["0", "3", "7", "8"],
      answer: 3,
      why: "Octal is base 8, so its digits stop at 7.",
    },
  },
  {
    id: "weights",
    title: "Place value — the same digit, different worth",
    tagline: "Position is power: read the weights from right to left.",
    minutes: 5,
    scene: "weights",
    controls: ["bits"],
    story: [
      p("In our everyday decimal system, the 3 in 333 is worth 300, 30 or 3 depending on where it sits. That is **positional notation**: each position has a weight, and a digit's contribution is digit × weight."),
      p("The weights are powers of the base. In decimal they are …1000, 100, 10, 1. In binary they double: …128, 64, 32, 16, 8, 4, 2, 1. The rightmost bit is the **least significant bit (LSB)**; the leftmost is the **most significant bit (MSB)**."),
      steps(
        "Number the positions from the right, starting at 0.",
        "Write the weight of each position as base^position.",
        "Multiply each digit by its weight.",
        "Add the products — that is the value of the whole number.",
      ),
      example("Reading 101101₂", "weights: 32 16 8 4 2 1\nbits:     1  0 1 1 0 1\nvalue = 32 + 8 + 4 + 1 = 45₁₀"),
      note("watch", "A zero still occupies its position. Deleting it shifts every other bit and changes the number completely."),
    ],
    live: (s) => [`bits: ${bits(s)}`, `weights: ${s.bits.map((_, i) => 2 ** (s.bits.length - 1 - i)).join(" + ")}`, `value: ${bitValue(s.bits)}`],
    quiz: {
      prompt: "In the 8-bit byte 00000100, what is the weight of the ON bit?",
      choices: ["2", "4", "8", "100"],
      answer: 1,
      why: "Positions from the right are 1, 2, 4, 8… so the third position is worth 4.",
    },
  },
  {
    id: "to-decimal",
    title: "Binary → decimal — adding the lit weights",
    tagline: "Ignore the zeros, add the powers of two under the ones.",
    minutes: 5,
    scene: "toDecimal",
    controls: ["bits"],
    story: [
      p("Converting a binary number to decimal is reading its place values. Every position that holds a 1 contributes its weight; every 0 contributes nothing. Add the contributions and you have the decimal value."),
      steps(
        "Write the binary number and the weights above or below each bit.",
        "Cross out (or ignore) every position with a 0.",
        "Add the remaining weights.",
        "Write the answer with a ₁₀ subscript.",
      ),
      example("Worked example", "10110101₂\n= 128 + 0 + 32 + 16 + 0 + 4 + 0 + 1\n= 181₁₀"),
      p("Notice that this works for any base: replace the powers of two by powers of eight or sixteen and the same multiply-and-add rule converts octal or hex to decimal."),
      note("tip", "Use the model: flip a bit ON and a glowing weight joins the sum. That is the whole algorithm in motion."),
    ],
    live: (s) => {
      const parts = s.bits.map((on, i) => (on ? 2 ** (s.bits.length - 1 - i) : 0)).filter(Boolean);
      return [`lit weights: ${parts.join(" + ") || "none"}`, `${bits(s)}₂ = ${bitValue(s.bits)}₁₀`];
    },
    quiz: {
      prompt: "What is 10000000₂ in decimal?",
      choices: ["8", "80", "100", "128"],
      answer: 3,
      why: "The only ON bit is in the 2⁷ = 128 position.",
    },
  },
  {
    id: "to-binary",
    title: "Decimal → binary — repeated division by 2",
    tagline: "The remainders, read upwards, are the answer.",
    minutes: 6,
    scene: "toBinary",
    controls: ["decimal"],
    story: [
      p("To go the other way, repeatedly divide the decimal number by 2. Write the quotient underneath and note the remainder (which is always 0 or 1). Stop when the quotient becomes 0."),
      steps(
        "Divide the number by 2.",
        "Write the quotient below it and the remainder at the side.",
        "Repeat with the new quotient until it reaches 0.",
        "Read the remainders from the **bottom** upwards — that is the binary number.",
      ),
      example("Convert 45₁₀", "45 ÷ 2 = 22 r 1   ↑ last bit\n22 ÷ 2 = 11 r 0\n11 ÷ 2 =  5 r 1\n 5 ÷ 2 =  2 r 1\n 2 ÷ 2 =  1 r 0\n 1 ÷ 2 =  0 r 1   ← first bit\nread upwards: 101101₂"),
      p("Check your work by converting back: 101101₂ = 32 + 8 + 4 + 1 = 45. A round trip is the easiest way to catch a reversed remainder."),
      note("watch", "Reading the remainders top-down is the classic mistake — it gives the mirror image of the answer."),
    ],
    live: (s) => {
      const steps = divisionSteps(Math.min(255, s.decimal), 2);
      return [`${s.decimal}₁₀ = ${steps.map((x) => x.digit).reverse().join("")}₂`, `check: ${bitString(toBits(Math.min(255, s.decimal), 8))} in 8 bits`];
    },
    quiz: {
      prompt: "After dividing repeatedly by 2, from where do you read the remainders?",
      choices: ["Top to bottom", "Bottom to top", "Left to right", "In pairs"],
      answer: 1,
      why: "The last remainder is the most significant bit, so the answer is read upwards.",
    },
  },
  {
    id: "octal",
    title: "Octal — three bits make one digit",
    tagline: "Group from the right in threes; each triple becomes 0–7.",
    minutes: 6,
    scene: "octal",
    controls: ["bits"],
    story: [
      p("Octal is base 8. Because 8 = 2³, exactly three binary bits can represent each octal digit: 000 is 0 and 111 is 7. That makes octal a compact way to write binary without doing any arithmetic."),
      steps(
        "Start at the **right** of the binary number and make groups of three.",
        "If the leftmost group is short, add leading zeros (they do not change the value).",
        "Convert each group using 000→0, 001→1, … 111→7.",
        "Write the digits in the same order, with an ₈ subscript.",
      ),
      example("Binary to octal", "101101₂ → 101 | 101 → 5 | 5 → 55₈"),
      example("With padding", "11101₂ → 011 | 101 → 3 | 5 → 35₈"),
      p("Octal was popular on early computers with 12-bit and 36-bit words, and it survives in Unix file permissions: chmod 755 writes three octal digits, one for owner, group and others."),
      note("remember", "Group from the right, pad on the left. Grouping from the left produces a different (wrong) answer."),
    ],
    live: (s) => [`groups: ${groupBits(s.bits, 3).map(bitString).join(" | ")}`, `${bits(s)}₂ = ${octOf(s)}₈`],
    quiz: {
      prompt: "The binary string 111₂ is which octal digit?",
      choices: ["3", "7", "8", "11"],
      answer: 1,
      why: "111₂ = 4 + 2 + 1 = 7, the largest octal digit.",
    },
  },
  {
    id: "hex",
    title: "Hexadecimal — four bits make one digit",
    tagline: "Sixteen symbols, one nibble each, written with A–F.",
    minutes: 6,
    scene: "hex",
    controls: ["bits"],
    story: [
      p("Hexadecimal is base 16. It uses the digits 0–9 and then the letters A (10), B (11), C (12), D (13), E (14), F (15). Since 16 = 2⁴, one hex digit stands for exactly four bits — a **nibble**."),
      steps(
        "Starting at the right, split the binary string into groups of four.",
        "Pad the leftmost group with zeros if needed.",
        "Map each group to 0–F: 1010→A, 1011→B, 1100→C, 1101→D, 1110→E, 1111→F.",
        "Prefix with 0x when writing in code, or use a ₁₆ subscript in maths.",
      ),
      example("A byte in two nibbles", "1111 1010₂ → F A → 0xFA (= 250₁₀)"),
      example("Letters are values", "0x2B → 0010 1011₂ → 43₁₀"),
      p("You meet hex wherever humans need to read binary: HTML colours (#RRGGBB), memory addresses, MAC addresses, error codes and machine instructions. It is short, exact and converts to bits by simple grouping."),
      note("tip", "A–F are digits, not variables. A means ten, F means fifteen — never write them as letters in a calculation."),
    ],
    live: (s) => [`nibbles: ${groupBits(s.bits, 4).map(bitString).join(" ")}`, `${bits(s)}₂ = 0x${hexOf(s)} = ${bitValue(s.bits)}₁₀`],
    quiz: {
      prompt: "What decimal value does the hex digit F have?",
      choices: ["10", "14", "15", "16"],
      answer: 2,
      why: "Hex digits run 0–9 then A=10 … F=15. There is no single digit for sixteen.",
    },
  },
  {
    id: "bridges",
    title: "The fast bridges — binary ⇄ octal / hex",
    tagline: "No long division: just regroup the same bits.",
    minutes: 6,
    scene: "bridges",
    controls: ["bits", "base"],
    story: [
      p("Because octal and hex are powers of two, they are not really 'other' number systems for a computer — they are shorthand for binary. Converting between them and binary is pure grouping, so it is fast and exact."),
      h("Binary → octal or hex"),
      steps("Group bits from the right: 3 per octal digit, 4 per hex digit.", "Pad the last group with leading zeros.", "Replace each group by its digit."),
      h("Octal or hex → binary"),
      steps("Write each digit separately.", "Replace it by its 3-bit (octal) or 4-bit (hex) pattern.", "Join the patterns and drop any leading zeros."),
      example("Both directions", "0x2B → 0010 1011₂ → 000 101 011₂ → 053₈\nbinary 101101 → 101 101₂ → 55₈ → 0x2D"),
      p("Decimal is the awkward one: it is base 10, not a power of two, so moving between decimal and binary needs division or multiplication. The model shows both lanes — choose the base and watch the groups become digits."),
      note("remember", "Grouping works only because 8 = 2³ and 16 = 2⁴. Never try it between decimal and binary."),
    ],
    live: (s) => {
      const size = s.base === 8 ? 3 : 4;
      return [`groups of ${size}: ${groupBits(s.bits, size).map(bitString).join(" | ")}`, s.base === 8 ? `${bits(s)}₂ = ${octOf(s)}₈` : `${bits(s)}₂ = 0x${hexOf(s)}`];
    },
    quiz: {
      prompt: "Which conversion can be done by grouping bits alone?",
      choices: ["Decimal → binary", "Binary → hex", "Decimal → octal", "Hex → decimal"],
      answer: 1,
      why: "16 is 2⁴, so every hex digit is exactly four bits. Decimal needs repeated division." ,
    },
  },
  {
    id: "divisions",
    title: "Decimal → octal or hex — one algorithm, any base",
    tagline: "Divide by the target base; remainders become digits.",
    minutes: 6,
    scene: "divisions",
    controls: ["decimal", "base"],
    story: [
      p("The repeated-division method you used for binary works unchanged for any base: divide by the **target base** rather than by 2. The remainders are digits in that base, read from the bottom upwards."),
      steps(
        "Divide the decimal number by the target base (8 or 16).",
        "Note the remainder — if it is 10 or more, write A, B, C, D, E or F.",
        "Continue with the quotient until it is 0.",
        "Read the remainders upwards and attach the correct subscript.",
      ),
      example("255₁₀ → hexadecimal", "255 ÷ 16 = 15 r 15 → F\n 15 ÷ 16 =  0 r 15 → F\nread upwards: FF₁₆"),
      example("255₁₀ → octal", "255 ÷ 8 = 31 r 7\n 31 ÷ 8 =  3 r 7\n  3 ÷ 8 =  0 r 3\nread upwards: 377₈"),
      p("Verify by multiplying back: FF₁₆ = 15×16 + 15 = 255, and 377₈ = 3×64 + 7×8 + 7 = 255. Same quantity, different notation."),
      note("watch", "A remainder of 10 is A, not '10'. Writing two decimal digits in one hex position is a common exam error."),
    ],
    live: (s) => [`${s.decimal}₁₀ in base ${s.base} = ${divOf(s, s.base)}`, `steps: ${divisionSteps(s.decimal, s.base).map((x) => `${x.value}÷${s.base}=${x.quotient}r${x.digit}`).join(" → ")}`],
    quiz: {
      prompt: "What is 255₁₀ in hexadecimal?",
      choices: ["FF", "377", "1111", "1A"],
      answer: 0,
      why: "255 = 15×16 + 15, and fifteen is written F, so the answer is FF₁₆.",
    },
  },
  {
    id: "bcd",
    title: "BCD — binary that keeps decimal digits",
    tagline: "Four bits per digit: easy to display, costly to compute.",
    minutes: 6,
    scene: "bcd",
    controls: ["decimal"],
    story: [
      p("In **Binary Coded Decimal (BCD)** each decimal digit is stored separately as its own 4-bit binary pattern using the 8421 weights. The number 59 is written 0101 1001: one nibble for 5, another for 9. It is *not* the same as the pure binary value 111011."),
      steps(
        "Write the decimal number as separate digits.",
        "Convert each digit with four bits (0→0000, 1→0001, … 9→1001).",
        "Join the groups in the same order.",
      ),
      table(["Decimal digit", "0", "1", "5", "8", "9"], ["8421 BCD", "0000", "0001", "0101", "1000", "1001"]),
      p("BCD makes digital displays simple: a clock or calculator can send each nibble straight to a seven-segment driver. The price is wasted space — four bits can hold 16 patterns but BCD uses only 10 — and arithmetic needs extra correction steps."),
      note("watch", "The patterns 1010 to 1111 are invalid in BCD. Seeing one means the value is not a decimal digit."),
    ],
    live: (s) => {
      const n = Math.min(9999, Math.max(0, s.decimal));
      return [`digits: ${String(n).split("").map((d) => `${d}→${bitString(toBits(Number(d), 4))}`).join("  ")}`, `pure binary would be ${bitString(toBits(Math.min(255, n), 8))}`];
    },
    quiz: {
      prompt: "How is 59 written in 8421 BCD?",
      choices: ["111011", "0101 1001", "0011 1011", "1010 1001"],
      answer: 1,
      why: "5 → 0101 and 9 → 1001, so BCD is 0101 1001. 111011 is the pure binary value.",
    },
  },
  {
    id: "signed",
    title: "Negative numbers — sign and two's complement",
    tagline: "Flip every bit, add one: subtraction becomes addition.",
    minutes: 7,
    scene: "signed",
    controls: ["bits"],
    story: [
      p("Unsigned 8 bits can hold 0 to 255. To store negative values, one bit — normally the leftmost — is reserved as the **sign bit**: 0 for positive, 1 for negative. That leaves seven bits for the size, so an 8-bit signed number runs from −128 to +127."),
      h("Three historical methods"),
      table(["Method", "Represent −5 in 8 bits", "Idea"], ["Sign-magnitude", "1000 0101", "sign bit + size"], ["1's complement", "1111 1010", "flip every bit"], ["2's complement", "1111 1011", "flip, then add 1"]),
      steps(
        "Write the positive value in 8 bits (5 → 0000 0101).",
        "Flip every bit: 1111 1010 (this is the 1's complement).",
        "Add 1: 1111 1011 — this is −5 in 2's complement.",
      ),
      p("Two's complement won because it has exactly one zero and ordinary addition works: 7 + (−5) is 0000 0111 + 1111 1011 = 0000 0010, with the overflow carry discarded. The same hardware adds signed and unsigned numbers."),
      note("watch", "To find the size of a negative two's-complement number, flip and add one again. 1111 1011 → 0000 0101 → 5."),
    ],
    live: (s) => {
      const magnitude = bitValue(s.bits.slice(1));
      const signed = (s.bits[0] ? -magnitude : magnitude);
      const mag = Math.abs(signed);
      const flipped = toBits((bitValue(s.bits.map((b) => !b)) + 1) & 255, 8);
      return [`sign bit ${s.bits[0] ? "1 (negative)" : "0 (positive)"} → ${signed}`, `−${mag} in 2's complement: ${bitString(flipped)}`];
    },
    quiz: {
      prompt: "What is −5 in 8-bit two's complement?",
      choices: ["1000 0101", "1111 1010", "1111 1011", "0000 0101"],
      answer: 2,
      why: "0000 0101 → flip → 1111 1010 → add 1 → 1111 1011.",
    },
  },
  {
    id: "text",
    title: "Text is numbers too — ASCII and Unicode",
    tagline: "Agree on a code and a letter becomes a bit pattern.",
    minutes: 6,
    scene: "encoding",
    controls: ["text"],
    story: [
      p("Encoding is an agreement: everyone must use the same number for the same symbol. **ASCII** assigns numbers 0–127 to English letters, digits and punctuation. Capital A is 65, which is 0100 0001₂ or 0x41. Seven bits are enough for all 128 ASCII characters."),
      p("ASCII cannot represent Devanagari, Arabic, Chinese or emoji, so **Unicode** assigns a unique number (a code point) to characters in every script. Unicode is a table of numbers; **UTF-8** is a way of storing those numbers as one to four bytes. ASCII characters still take one byte, which is why UTF-8 is compatible with old files."),
      steps(
        "Look up the character's code point (A → U+0041).",
        "Choose an encoding scheme: UTF-8 stores it as the single byte 0x41.",
        "Store or transmit that byte; the receiver uses the same table to show 'A'.",
      ),
      example("A small message", "L = 76 = 0x4C    E = 69 = 0x45    O = 79 = 0x4F    U = 85 = 0x55"),
      p("Hex is popular here because one byte is exactly two hex digits: 0x4C is far easier to read and type than 01001100."),
      note("tip", "Type your own short word in the control. Each cube shows the character's decimal code and its hex form."),
    ],
    live: (s) => (s.text || "LEOU").slice(0, 6).toUpperCase().split("").map((ch) => `${ch} = ${ch.charCodeAt(0)} = 0x${ch.charCodeAt(0).toString(16).toUpperCase()}`),
    quiz: {
      prompt: "Why is hexadecimal convenient for describing bytes?",
      choices: ["It uses only 0 and 1", "One byte is exactly two hex digits", "It is base 10", "It stores text only"],
      answer: 1,
      why: "A byte is 8 bits = two nibbles, and each nibble is one hex digit.",
    },
  },
  {
    id: "colour",
    title: "Colour — three channels, six hex digits",
    tagline: "#RRGGBB is three 8-bit numbers wearing a costume.",
    minutes: 5,
    scene: "encoding",
    controls: ["text"],
    story: [
      p("A screen pixel mixes red, green and blue light. Each channel is stored as a byte from 0 (off) to 255 (fully on). Three bytes give 256³ = 16,777,216 possible colours — often called 24-bit or 'true' colour."),
      p("Web pages write those three bytes in hex: #RRGGBB. The first pair is red, the second green, the third blue. #FF0000 is pure red, #00FF00 pure green, #000000 black and #FFFFFF white."),
      steps(
        "Split the six hex digits into RR, GG and BB.",
        "Convert each pair from hex to decimal (0–255).",
        "Those are the red, green and blue intensities.",
      ),
      example("Read #22D3EE", "22₁₆ = 34     D3₁₆ = 211     EE₁₆ = 238\nlow red, high green, high blue → a bright cyan"),
      p("This is the same lesson again: encoding is just an agreed mapping from symbols to numbers. Here the symbols are colour intensities; earlier they were quantities and letters."),
      note("remember", "Each pair is two hex digits because a channel is one byte. Six digits = three bytes."),
    ],
    live: () => ["#22D3EE → R 0x22 = 34, G 0xD3 = 211, B 0xEE = 238", "256³ = 16,777,216 colours"],
    quiz: {
      prompt: "In #FF8040, what is the green intensity?",
      choices: ["FF", "80", "40", "1280"],
      answer: 1,
      why: "The middle pair is green: 0x80 = 128 out of 255.",
    },
  },
  {
    id: "parity",
    title: "Parity — a tiny bit that catches a big mistake",
    tagline: "One extra bit can reveal that a bit flipped in transit.",
    minutes: 5,
    scene: "parity",
    controls: ["bits"],
    story: [
      p("Bits travel through wires and sit in memory, and occasionally one flips. A **parity bit** is one extra bit appended to a block of data so that the total number of 1s follows a rule. In **even parity**, the total must be even; in **odd parity**, it must be odd."),
      steps(
        "Count the 1s in the data bits.",
        "For even parity, set the parity bit to 0 if the count is already even, otherwise 1.",
        "The receiver counts again. If the rule is broken, at least one bit changed.",
      ),
      example("Even parity", "data 1011010 has four 1s → parity bit 0\ndata 1011011 has five 1s → parity bit 1"),
      p("Parity detects a single flipped bit, but it cannot tell you *which* bit flipped, and two flips cancel each other out. More powerful codes (Hamming codes, CRC) add more check bits and can locate or correct errors."),
      note("watch", "Detection is not correction. Parity tells you 'something is wrong', not 'here is the right answer'."),
    ],
    live: (s) => {
      const data = s.bits.slice(0, 7);
      const ones = data.filter(Boolean).length;
      return [`data: ${bitString(data)}`, `${ones} ones → even-parity bit = ${ones % 2}`];
    },
    quiz: {
      prompt: "Even parity is used and the receiver counts five 1s. What happened?",
      choices: ["Nothing — five is fine", "An odd number of bits flipped", "Exactly two bits flipped", "The parity bit is missing"],
      answer: 1,
      why: "Even parity promises an even total; an odd total means an odd number of flips (at least one).",
    },
  },
  {
    id: "map",
    title: "The conversion map — choose your route",
    tagline: "Group bits when you can; divide when the base is not a power of two.",
    minutes: 4,
    scene: "map",
    controls: ["bits", "decimal"],
    story: [
      p("There are four systems in this chapter, but only two ideas. **Grouping** moves between binary and bases that are powers of two (octal and hex). **Multiply-and-add** reads any base into decimal. **Repeated division** writes decimal into any base."),
      table(["From", "To", "Method"], ["Binary", "Octal / Hex", "Group 3 / 4 bits from the right"], ["Octal / Hex", "Binary", "Write 3 / 4 bits per digit"], ["Any base", "Decimal", "Multiply each digit by its weight, then add"], ["Decimal", "Any base", "Divide repeatedly, read remainders upwards"]),
      h("A final worked journey"),
      example("0x2B → decimal → octal", "0x2B = 2×16 + 11 = 43₁₀\n43 ÷ 8 = 5 r 3; 5 ÷ 8 = 0 r 5 → 53₈\ndirect route: 0x2B = 0010 1011₂ = 000 101 011₂ = 053₈"),
      p("The direct route is shorter, but both agree. Being able to check an answer two ways is what makes you confident in an exam."),
      note("remember", "Powers of two → group. Decimal → divide or multiply. Always say which base your answer is in."),
    ],
    live: (s) => [`${bits(s)}₂ = ${bitValue(s.bits)}₁₀ = ${octOf(s)}₈ = 0x${hexOf(s)}`, `${s.decimal}₁₀ = ${divOf(s, 2)}₂ = ${divOf(s, 8)}₈ = ${divOf(s, 16)}₁₆`],
    quiz: {
      prompt: "Which route turns 0x3F into binary most directly?",
      choices: ["Divide by 2 repeatedly", "Write 4 bits for 3 and 4 bits for F", "Convert to decimal first", "Group into threes"],
      answer: 1,
      why: "Each hex digit is exactly four bits: 3 → 0011 and F → 1111, so 0x3F = 00111111₂.",
    },
  },
  {
    id: "why-binary",
    title: "Why binary? — switches, voltage and noise",
    tagline: "Two states survive electrical wobble; ten would not.",
    minutes: 5,
    scene: "physics",
    controls: ["bits"],
    story: [
      p("At the heart of a chip is a **transistor** used as an electronic switch. When it conducts, the wire sits near the supply voltage (say 5 V, or 1.8 V in modern chips); when it does not, the wire sits near 0 V. We call the high band **1** and the low band **0**."),
      p("Why not build a decimal computer with ten voltage levels? Because real wires are noisy. Heat, interference and tiny manufacturing differences nudge voltages. With two bands far apart, a small wobble still reads correctly. With ten closely spaced levels, the same wobble would be ambiguous. Binary pays for reliability with longer strings of digits."),
      h("From a switch to a number"),
      steps(
        "One transistor stores one bit: conducting (1) or cut off (0).",
        "Eight transistors side by side store a byte — 256 possible patterns.",
        "A rule (binary place value) turns a pattern into a number; another rule (ASCII) turns it into a letter.",
        "Clocks and logic gates move and combine those bits millions of times a second.",
      ),
      example("Why 0.8 V and 2.0 V are still readable", "If a chip treats anything below 0.8 V as 0 and above 2.0 V as 1, the gap between 0.8 and 2.0 V is a 'no man's land'. Noise smaller than that margin never flips a bit."),
      note("remember", "The bit is a physical reality (a switch), not just a mathematical idea. Every conversion rule in this course sits on top of that switch."),
    ],
    live: (s) => [`${s.bits.filter(Boolean).length} switches closed → ${bits(s)}`, `8 switches → 2^8 = 256 patterns`],
    quiz: {
      prompt: "Why do computers use two voltage levels instead of ten?",
      choices: ["Two levels use less wire", "Two widely separated levels resist electrical noise", "Decimal arithmetic is impossible in hardware", "Binary numbers are shorter"],
      answer: 1,
      why: "A wide gap between the two valid bands means small voltage wobbles cannot be misread. Ten levels would be far less reliable.",
    },
  },
  {
    id: "binary-addition",
    title: "Binary arithmetic — addition and carry",
    tagline: "Add in columns from the right; carry when a column reaches two.",
    minutes: 6,
    scene: "add",
    controls: ["bits"],
    story: [
      p("Binary addition follows the same column method you use in decimal, with one change: a column is full at **2**, not 10. The rules are tiny: 0+0=0, 0+1=1, 1+0=1, 1+1=10 (write 0, carry 1), and 1+1+1=11 (write 1, carry 1)."),
      steps(
        "Write the two numbers one above the other, right-aligned.",
        "Add the rightmost column first, including any incoming carry.",
        "If the total is 0 or 1, write it. If it is 2 or 3, write total−2 and carry 1 to the next column.",
        "Keep going. A final carry becomes a new leftmost bit — unless you are limited to 8 bits.",
      ),
      example("Add 10110101 and 00101101", "  10110101  (181)\n+ 00101101  ( 45)\n  --------\n  11100010  (226)\ncheck: 181 + 45 = 226 ✓"),
      p("Hardware does this with a **full adder**: a small circuit taking two bits and a carry in, and producing a sum bit and a carry out. Chain eight of them and you can add bytes. This is why the carry rule matters far beyond a written exercise."),
      note("watch", "In a fixed 8-bit register a carry out is lost and the answer is wrong (overflow). Calculators and CPUs set an overflow flag to warn about exactly this."),
    ],
    live: (s) => {
      const a = s.bits.map((b) => (b ? 1 : 0));
      const b = toBits(45, 8).map((x) => (x ? 1 : 0));
      let c = 0;
      const out: number[] = [];
      for (let i = 7; i >= 0; i--) {
        const total = a[i]! + b[i]! + c;
        out[i] = total % 2;
        c = Math.floor(total / 2);
      }
      return [`${bits(s)}₂ = ${bitValue(s.bits)}`, `+ 00101101₂ = 45`, `= ${out.join("")}₂ = ${bitValue(out.map(Boolean))}${c ? " (carry out!)" : ""}`];
    },
    quiz: {
      prompt: "What is 1 + 1 in binary?",
      choices: ["2", "10", "11", "1"],
      answer: 1,
      why: "Two is written 10₂: write 0 in this column and carry 1 into the next.",
    },
  },
  {
    id: "binary-subtraction",
    title: "Binary arithmetic — subtraction the clever way",
    tagline: "Flip, add one, then add — because hardware only wants to add.",
    minutes: 6,
    scene: "subtract",
    controls: ["bits"],
    story: [
      p("You can subtract in columns with borrows, but computers avoid a second circuit for borrowing. Instead they use the trick you already met: the **two's complement**. To compute A − B, form −B by flipping every bit of B and adding one, then simply add it to A."),
      steps(
        "Write B in 8 bits (for example 5 → 0000 0101).",
        "Flip every bit: 1111 1010.",
        "Add 1: 1111 1011 — this is −5 modulo 256.",
        "Add to A and discard the carry out. The low 8 bits are A − 5.",
      ),
      example("13 − 5", "A = 0000 1101\n−B = 1111 1011\n        ---- add ----\n  1 0000 1000  → drop the carry → 0000 1000 = 8 ✓"),
      p("If A is smaller than B, the answer comes out as a large unsigned number — which is exactly the two's-complement representation of a negative value. For example 5 − 8 gives 1111 1101, which means −3 in signed 8-bit arithmetic."),
      note("tip", "One adder circuit handles both addition and subtraction. That economy is why two's complement won over sign-magnitude and one's complement."),
    ],
    live: (s) => {
      const aVal = bitValue(s.bits);
      const result = (aVal - 5 + 256) & 255;
      return [`A = ${aVal}`, `−5 → 11111011`, `${aVal} − 5 = ${result} → ${bitString(toBits(result, 8))}`];
    },
    quiz: {
      prompt: "To subtract B from A using two's complement you should…",
      choices: ["Borrow from the next column", "Flip B's bits, add 1, then add to A", "Multiply B by −1 in decimal", "Shift B right by one"],
      answer: 1,
      why: "Flip every bit of B and add 1 to get −B, then add it to A and drop the final carry.",
    },
  },
  {
    id: "bit-shifts",
    title: "Shifts — multiplying by powers of two for free",
    tagline: "Slide the bits left to double, right to halve.",
    minutes: 5,
    scene: "shift",
    controls: ["bits"],
    story: [
      p("Because each binary position is twice the one to its right, moving every bit one place left multiplies the whole number by 2. Moving them one place right divides by 2. A **shift** is one of the fastest things a processor can do — much cheaper than a general multiplication."),
      steps(
        "Left shift (<< 1): move each bit one place left, fill the empty right end with 0.",
        "Right shift (>> 1): move each bit one place right, fill the empty left end with 0 (for unsigned numbers).",
        "Shift by n places to multiply or divide by 2ⁿ.",
        "Watch for overflow: bits pushed out of an 8-bit register are lost.",
      ),
      example("Shift 00001101 (13)", "left  → 00011010 = 26  (13 × 2)\nleft  → 00110100 = 52  (13 × 4)\nright → 00000110 = 6   (13 ÷ 2, remainder dropped)"),
      p("Shifts are everywhere: scaling graphics, converting between units, computing addresses, and extracting a field from a bit pattern. Compilers quietly replace multiplication by a constant with a shift plus a few adds."),
      note("watch", "Right shift of a negative signed number is implementation-defined in some languages: a logical shift fills with 0, an arithmetic shift copies the sign bit. Know which one you are using."),
    ],
    live: (s) => {
      const v = bitValue(s.bits);
      const left = [...s.bits.slice(1), false];
      const right = [false, ...s.bits.slice(0, 7)];
      return [`${v} << 1 = ${bitValue(left)}`, `${v} >> 1 = ${bitValue(right)}`, "shift n places = ×2ⁿ or ÷2ⁿ"];
    },
    quiz: {
      prompt: "Shifting 00001101₂ left by one gives which value?",
      choices: ["00000110₂", "00011010₂", "00001110₂", "00010110₂"],
      answer: 1,
      why: "Left shift doubles 13 to 26, which is 00011010₂.",
    },
  },
  {
    id: "binary-fractions",
    title: "Fractions — bits after the binary point",
    tagline: "The places after the point are 1/2, 1/4, 1/8…",
    minutes: 6,
    scene: "fractions",
    controls: ["bits"],
    story: [
      p("Decimal fractions use tenths, hundredths and thousandths because each place divides by ten. Binary fractions do the same with two: the first bit after the point is worth **1/2**, the next **1/4**, then **1/8**, **1/16** and so on. The point itself is only notation."),
      steps(
        "Write the bits after the point and their weights 2⁻¹, 2⁻², 2⁻³…",
        "Multiply each 1 by its weight and add the results.",
        "To convert a decimal fraction to binary, multiply repeatedly by 2 and record the integer part each time.",
        "Stop when the fraction becomes 0 or the pattern starts repeating.",
      ),
      example("Two directions", "0.1011₂ = 1/2 + 0/4 + 1/8 + 1/16 = 0.6875₁₀\n0.625₁₀: 0.625×2=1.25 → 1; 0.25×2=0.5 → 0; 0.5×2=1.0 → 1 ⇒ 0.101₂"),
      p("Not every decimal fraction terminates in binary. 0.1₁₀ becomes the repeating pattern 0.000110011…₂, which is why 0.1 + 0.2 in many programming languages is not exactly 0.3. This is a representation issue, not a bug."),
      note("watch", "A finite number of fractional bits means limited precision. More bits (double instead of single) narrow the error but never remove it for repeating values."),
    ],
    live: (s) => {
      const frac = s.bits.slice(0, 6);
      const total = frac.reduce((sum, on, i) => sum + (on ? 2 ** (-(i + 1)) : 0), 0);
      const weights = frac.map((_, i) => `1/${2 ** (i + 1)}`).join(" + ");
      return [`0.${frac.map((b) => (b ? "1" : "0")).join("")}₂ = ${total.toFixed(4)}₁₀`, `weights: ${weights}`];
    },
    quiz: {
      prompt: "What is 0.101₂ in decimal?",
      choices: ["0.5", "0.625", "0.75", "5"],
      answer: 1,
      why: "1/2 + 0/4 + 1/8 = 0.5 + 0.125 = 0.625.",
    },
  },
  {
    id: "floating-point",
    title: "Floating point — very large and very small numbers",
    tagline: "Scientific notation in binary: sign, exponent, mantissa.",
    minutes: 7,
    scene: "float",
    controls: ["decimal"],
    story: [
      p("Integers have a fixed range. Science and graphics need numbers from the size of an atom to the size of a galaxy, so **floating point** stores a number the way you write scientific notation: a sign, a power of two (the exponent) and the leading digits (the mantissa)."),
      p("In IEEE 754 single precision a float is 32 bits: 1 sign bit, 8 exponent bits and 23 mantissa bits. The mantissa always starts with an implicit leading 1 (for normal numbers), so only the fractional bits need storing. The exponent is stored **biased** by 127 so it can be written as an unsigned value."),
      steps(
        "Write the number in binary as 1.something × 2ᵉ (normalise it).",
        "Sign bit: 0 for positive, 1 for negative.",
        "Exponent field = e + 127, written in 8 bits.",
        "Mantissa field = the fractional bits after the leading 1, padded to 23 bits.",
      ),
      example("Encode 22.5", "22.5₁₀ = 10110.1₂ = 1.01101₂ × 2⁴\nsign = 0, exponent = 4 + 127 = 131 = 10000011₂\nmantissa = 01101 followed by zeros (23 bits)"),
      p("Double precision uses 64 bits (1 + 11 + 52) and gives about 15–16 decimal digits of accuracy. The trade-off is always range versus precision: floats cover enormous magnitudes but cannot represent every value exactly."),
      note("watch", "Never compare two floats for exact equality after calculations. Check whether their difference is smaller than a tolerance instead."),
    ],
    live: (s) => {
      const v = Math.min(1023, s.decimal) + 0.5;
      const e = Math.max(0, Math.floor(Math.log2(v)));
      return [`${v} ≈ 1.x₂ × 2^${e}`, `exponent stored = ${e} + 127 = ${e + 127}`, "32-bit: 1 sign + 8 exponent + 23 mantissa"];
    },
    quiz: {
      prompt: "In IEEE 754 single precision, the exponent bias is…",
      choices: ["8", "23", "127", "256"],
      answer: 2,
      why: "The 8-bit exponent is stored as (true exponent + 127) so it can be unsigned.",
    },
  },
  {
    id: "memory-units",
    title: "Bits, bytes and memory prefixes",
    tagline: "Why a 'kilobyte' of RAM is really 1024 bytes.",
    minutes: 5,
    scene: "units",
    controls: ["bits"],
    story: [
      p("The **bit** is one switch. Eight bits make a **byte**, the smallest addressable unit in most computers — a byte can hold 256 patterns, enough for all ASCII characters. Memory sizes grow in powers of two because addresses are binary numbers."),
      table(["Unit", "Bytes", "Powers"], ["bit", "1/8 byte", "one switch"], ["byte (B)", "1", "2³ bits"], ["KiB", "1,024", "2¹⁰ B"], ["MiB", "1,048,576", "2²⁰ B"], ["GiB", "1,073,741,824", "2³⁰ B"]),
      p("You will see both KB and KiB. Strictly, **kilo** means 1000 (decimal, used for disk capacities and network speeds) while **kibi** means 1024 (binary, used for memory). Informally people say 'kilobyte' for 1024 bytes, so check the context when a number looks slightly off."),
      example("A small photo", "A 3 MB photo ≈ 3 × 1024 × 1024 bytes ≈ 3,145,728 bytes ≈ 25,165,824 individual bits."),
      p("Storage is measured in bytes because a byte is the unit the CPU can fetch with one address. File sizes, image colours and network packets all reduce to counting bytes."),
      note("remember", "8 bits = 1 byte · 1024 bytes = 1 KiB · 1024 KiB = 1 MiB. Powers of two, every time."),
    ],
    live: () => ["8 bits = 1 byte = 256 patterns", "1 KiB = 1024 B · 1 MiB = 1024 KiB", "powers of two, not powers of ten"],
    quiz: {
      prompt: "How many bytes are in one kibibyte (KiB)?",
      choices: ["100", "1000", "1024", "2048"],
      answer: 2,
      why: "KiB is the binary prefix: 2¹⁰ = 1024 bytes.",
    },
  },
  {
    id: "hex-arithmetic",
    title: "Hexadecimal arithmetic — carrying at sixteen",
    tagline: "Add hex digits the decimal way, only the carry point moves.",
    minutes: 5,
    scene: "hexMath",
    controls: ["decimal"],
    story: [
      p("You can add and subtract hexadecimal numbers directly, without converting to decimal. The method is identical to long addition except that a column carries when it reaches **16** instead of 10, and the digits run 0–9 then A–F."),
      steps(
        "Add the rightmost digits as decimal values (A=10 … F=15).",
        "If the total is 16 or more, subtract 16 and carry 1 to the next column.",
        "Continue leftwards, including the carry.",
        "Check by converting both sides to decimal if you are unsure.",
      ),
      example("Add two hex bytes", "  2B  (43)\n+ 1F  (31)\n  --\n  4A  (74)\nB + F = 11 + 15 = 26 → write A (10), carry 1; 2 + 1 + 1 = 4."),
      p("A byte ranges from 0x00 to 0xFF (0–255). Adding 1 to 0xFF wraps to 0x00 with a carry out — the same overflow you saw in binary. Hex is the natural way to write memory addresses, colour codes and machine words precisely because two hex digits are exactly one byte."),
      note("tip", "Treat A–F as normal numbers in the column (10–15), not as letters. That one habit makes hex arithmetic feel just like decimal."),
    ],
    live: (s) => {
      const a = Math.min(255, s.decimal);
      const b = 31;
      const sum = (a + b) & 255;
      const hx = (n: number) => digitChar((n >> 4) & 15) + digitChar(n & 15);
      return [`0x${hx(a)} + 0x${hx(b)} = 0x${hx(sum)}`, "carry at 16, not 10"];
    },
    quiz: {
      prompt: "What is 0x0F + 0x01?",
      choices: ["0x10", "0x00", "0x0F", "0x20"],
      answer: 0,
      why: "F is 15; 15 + 1 = 16, which is 0 carry 1 in base 16 — so the answer is 0x10.",
    },
  },
  {
    id: "workshop",
    title: "Conversion workshop — choose your route",
    tagline: "A final workout across every representation you have met.",
    minutes: 6,
    scene: "map",
    controls: ["bits", "decimal"],
    story: [
      p("You now have the whole toolkit. The art is choosing the shortest route: **group bits** for binary ⇄ octal/hex, **multiply and add** to read any base into decimal, **divide repeatedly** to write decimal into any base, and **shift** for powers of two."),
      table(["Question", "Fast route"], ["binary → hex", "groups of 4 bits"], ["hex → binary", "4 bits per digit"], ["binary → octal", "groups of 3 bits"], ["any base → decimal", "digit × weight, then add"], ["decimal → any base", "divide, read remainders up"], ["×2ⁿ or ÷2ⁿ", "shift n places"]),
      h("A mixed challenge"),
      example("From colour to bits to decimal", "#2B₁₆ = 2×16 + 11 = 43₁₀\n43 = 32 + 8 + 2 + 1 = 00101011₂\ncheck the grouping: 0010 1011 = 0x2B ✓"),
      p("Try every combination with the controls: flip bits, change the decimal value, switch bases. Then predict the answer before reading the live readout. Being able to check a result two ways is the mark of someone who truly understands number systems."),
      note("remember", "Powers of two → group or shift. Decimal → divide or multiply. State the base of every answer, always."),
    ],
    live: (s) => [`${bits(s)}₂ = ${bitValue(s.bits)}₁₀ = ${octOf(s)}₈ = 0x${hexOf(s)}`, `${s.decimal}₁₀ = ${divOf(s, 2)}₂ = ${divOf(s, 16)}₁₆`],
    quiz: {
      prompt: "A byte gives 256 patterns. How many patterns do two bytes give?",
      choices: ["512", "1024", "65,536", "1,000,000"],
      answer: 2,
      why: "Two bytes are 16 bits, so 2¹⁶ = 65,536 patterns — the range of a 16-bit number.",
    },
  },
];

export const conceptById = (id: string): Concept | undefined => CONCEPTS.find((c) => c.id === id);
