/**
 * Assignments: CBSE Class 11 Computer Science — "Computer System".
 *
 * Every assignment is:
 *   - untimed: durationMinutes = 0, which the app renders as "No time limit"
 *     (see src/lib/assessmentTime.ts),
 *   - unlimited attempts: maxAttempts = null,
 *   - always open: attemptMode FLEXIBLE, status RELEASED, no start/end window,
 *   - bound to the topic "Computer System" so that only students whose plan lists
 *     that chapter can see or attempt it (assessmentTopicAllowed).
 *
 * A question may appear in more than one assignment — that is intentional, and is
 * how revision papers are built.
 */

export type BankAssignment = {
  /** 1-based number used in the title, e.g. 7 -> "Computer System 07: ...". */
  n: number;
  title: string;
  instructions: string;
  /** [questionId, marks] in the order the student will see them. */
  items: Array<[string, number]>;
};

const HOW_TO =
  "This is untimed practice. There is no clock and no attempt limit — start when you like, submit when you are ready, and you may attempt it as many times as you need. Answer every question, then press Submit. Write your answers in your own words; model answers are for checking afterwards.";

export const COMPUTER_SYSTEM_ASSIGNMENTS: BankAssignment[] = [
  {
    n: 1,
    title: "Computer System 01: Role of the Control Unit",
    instructions: `Revision of how the CPU directs work. ${HOW_TO}`,
    items: [
      ["m01", 1],
      ["m21", 1],
      ["s05", 3],
      ["o01", 2],
    ],
  },
  {
    n: 2,
    title: "Computer System 02: ALU and CPU Registers",
    instructions: `The units that actually compute, and the registers that hold their operands. ${HOW_TO}`,
    items: [
      ["m10", 1],
      ["m14", 1],
      ["s11", 3],
      ["o05", 2],
    ],
  },
  {
    n: 3,
    title: "Computer System 03: The Memory Unit",
    instructions: `Where data waits inside the machine. ${HOW_TO}`,
    items: [
      ["m09", 1],
      ["m03", 1],
      ["s03", 3],
      ["o02", 2],
    ],
  },
  {
    n: 4,
    title: "Computer System 04: Address Lines and Memory Capacity",
    instructions: `The single most examined calculation in this chapter: 2^n locations. ${HOW_TO}`,
    items: [
      ["m02", 1],
      ["s09", 3],
      ["l03", 6],
      ["c02", 5],
    ],
  },
  {
    n: 5,
    title: "Computer System 05: RAM and ROM",
    instructions: `Volatile versus non-volatile memory. ${HOW_TO}`,
    items: [
      ["m03", 1],
      ["m19", 1],
      ["s01", 3],
      ["o02", 2],
    ],
  },
  {
    n: 6,
    title: "Computer System 06: SRAM and DRAM",
    instructions: `The two technologies behind cache and main memory. ${HOW_TO}`,
    items: [
      ["m22", 1],
      ["s08", 3],
      ["s03", 3],
      ["o03", 2],
    ],
  },
  {
    n: 7,
    title: "Computer System 07: Cache Memory",
    instructions: `Why a tiny, expensive memory makes a big machine fast. ${HOW_TO}`,
    items: [
      ["m09", 1],
      ["m22", 1],
      ["s03", 3],
      ["l06", 6],
    ],
  },
  {
    n: 8,
    title: "Computer System 08: Primary and Secondary Memory",
    instructions: `The two tiers every other storage question depends on. ${HOW_TO}`,
    items: [
      ["m08", 1],
      ["m12", 1],
      ["s04", 3],
      ["o03", 2],
    ],
  },
  {
    n: 9,
    title: "Computer System 09: Magnetic Storage",
    instructions: `How data is stored on platters, and what makes a hard disk different from an SSD. ${HOW_TO}`,
    items: [
      ["m08", 1],
      ["s07", 3],
      ["o03", 2],
      ["c06", 5],
    ],
  },
  {
    n: 10,
    title: "Computer System 10: Optical and Flash Storage",
    instructions: `Pits, lands and flash memory. ${HOW_TO}`,
    items: [
      ["m12", 1],
      ["s07", 3],
      ["o02", 2],
      ["c01", 5],
    ],
  },
  {
    n: 11,
    title: "Computer System 11: The System Bus",
    instructions: `How the CPU talks to everything else. ${HOW_TO}`,
    items: [
      ["m06", 1],
      ["m20", 1],
      ["s06", 3],
      ["l04", 6],
    ],
  },
  {
    n: 12,
    title: "Computer System 12: Data Bus and Address Bus",
    instructions: `Direction and width of the two main buses. ${HOW_TO}`,
    items: [
      ["m06", 1],
      ["m07", 1],
      ["s06", 3],
      ["c04", 5],
    ],
  },
  {
    n: 13,
    title: "Computer System 13: Control Bus and Bus Width",
    instructions: `Signals, arbitration and what a wider bus actually buys you. ${HOW_TO}`,
    items: [
      ["m20", 1],
      ["m11", 1],
      ["o06", 2],
      ["c07", 5],
    ],
  },
  {
    n: 14,
    title: "Computer System 14: First and Second Generation Computers",
    instructions: `Vacuum tubes and transistors. ${HOW_TO}`,
    items: [
      ["m16", 1],
      ["m04", 1],
      ["l02", 6],
      ["o02", 2],
    ],
  },
  {
    n: 15,
    title: "Computer System 15: Third and Fourth Generation Computers",
    instructions: `Integrated circuits and the microprocessor. ${HOW_TO}`,
    items: [
      ["m04", 1],
      ["m16", 1],
      ["m23", 1],
      ["l02", 6],
    ],
  },
  {
    n: 16,
    title: "Computer System 16: Fifth Generation and AI",
    instructions: `Where the fifth generation sits today, and how it differs from the fourth. ${HOW_TO}`,
    items: [
      ["m04", 1],
      ["l02", 6],
      ["o07", 2],
      ["u04", 4],
    ],
  },
  {
    n: 17,
    title: "Computer System 17: Generations Summary Chart",
    instructions: `Build the comparison table you would want in a revision notebook. ${HOW_TO}`,
    items: [
      ["m16", 1],
      ["m04", 1],
      ["u04", 4],
      ["o02", 2],
    ],
  },
  {
    n: 18,
    title: "Computer System 18: Types of Computers by Size",
    instructions: `Micro, mini, mainframe and supercomputer. ${HOW_TO}`,
    items: [
      ["m23", 1],
      ["s16", 3],
      ["o07", 2],
      ["l09", 6],
    ],
  },
  {
    n: 19,
    title: "Computer System 19: Supercomputers and Mainframes",
    instructions: `Where a mainframe still beats a laptop. ${HOW_TO}`,
    items: [
      ["s16", 3],
      ["o07", 2],
      ["l09", 6],
    ],
  },
  {
    n: 20,
    title: "Computer System 20: Hardware and Software",
    instructions: `The basic division of a computer system. ${HOW_TO}`,
    items: [
      ["m13", 1],
      ["s02", 3],
      ["o08", 2],
    ],
  },
  {
    n: 21,
    title: "Computer System 21: System and Application Software",
    instructions: `What the operating system does for you. ${HOW_TO}`,
    items: [
      ["m13", 1],
      ["s10", 3],
      ["s15", 3],
      ["o08", 2],
    ],
  },
  {
    n: 22,
    title: "Computer System 22: Input Devices",
    instructions: `From keyboard to barcode reader. ${HOW_TO}`,
    items: [
      ["m18", 1],
      ["s13", 3],
      ["l08", 6],
    ],
  },
  {
    n: 23,
    title: "Computer System 23: Output Devices and Ports",
    instructions: `Devices that produce results, and how they are connected. ${HOW_TO}`,
    items: [
      ["m18", 1],
      ["o09", 2],
      ["s13", 3],
      ["l08", 6],
    ],
  },
  {
    n: 24,
    title: "Computer System 24: Booting and Firmware",
    instructions: `What happens between the power switch and the desktop. ${HOW_TO}`,
    items: [
      ["m05", 1],
      ["s14", 3],
      ["o01", 2],
    ],
  },
  {
    n: 25,
    title: "Computer System 25: BIOS, Boot Loader and the OS Handover",
    instructions: `The full boot sequence, in order. ${HOW_TO}`,
    items: [
      ["m05", 1],
      ["o01", 2],
      ["l05", 6],
      ["s14", 3],
    ],
  },
  {
    n: 26,
    title: "Computer System 26: The Operating System as Resource Manager",
    instructions: `Memory, processes, files, devices, security. ${HOW_TO}`,
    items: [
      ["m13", 1],
      ["s10", 3],
      ["l07", 6],
    ],
  },
  {
    n: 27,
    title: "Computer System 27: Multiprocessor and Multicore",
    instructions: `Parallel processing and throughput. ${HOW_TO}`,
    items: [
      ["m23", 1],
      ["s12", 3],
      ["o07", 2],
    ],
  },
  {
    n: 28,
    title: "Computer System 28: Microprocessor and Word Length",
    instructions: `The chip, and what '32-bit' or '64-bit' actually claims. ${HOW_TO}`,
    items: [
      ["m20", 1],
      ["m11", 1],
      ["s11", 3],
      ["o05", 2],
    ],
  },
  {
    n: 29,
    title: "Computer System 29: Interrupts and Direct Memory Access",
    instructions: `How peripherals get the CPU's attention. ${HOW_TO}`,
    items: [
      ["m17", 1],
      ["o04", 2],
      ["o06", 2],
      ["l05", 6],
    ],
  },
  {
    n: 30,
    title: "Computer System 30: Memory Chip Interleaving (Lab)",
    instructions: `The classic CBSE lab problem: how many chips, address lines and data lines. ${HOW_TO}`,
    items: [
      ["m24", 1],
      ["l10", 6],
      ["c03", 5],
    ],
  },
  {
    n: 31,
    title: "Computer System 31: Storage Unit Conversions (Lab)",
    instructions: `Turn your unit-conversion arithmetic into working code. ${HOW_TO}`,
    items: [
      ["m07", 1],
      ["c01", 5],
      ["c06", 5],
    ],
  },
  {
    n: 32,
    title: "Computer System 32: Addressable Locations Table (Lab)",
    instructions: `Print the powers-of-two table used to check any memory question. ${HOW_TO}`,
    items: [
      ["m15", 1],
      ["c05", 5],
      ["c07", 5],
    ],
  },
  {
    n: 33,
    title: "Computer System 33: Block Diagram of a Computer System",
    instructions: `Put the whole chapter on one page. ${HOW_TO}`,
    items: [
      ["m21", 1],
      ["l01", 6],
      ["u01", 4],
    ],
  },
  {
    n: 34,
    title: "Computer System 34: Memory Hierarchy and a Real Machine (Practical)",
    instructions: `Draw the hierarchy, then document an actual computer. ${HOW_TO}`,
    items: [
      ["s03", 3],
      ["l06", 6],
      ["u02", 4],
      ["u03", 4],
    ],
  },
];
