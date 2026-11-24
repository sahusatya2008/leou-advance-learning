/**
 * Question bank: CBSE Class 11 Computer Science — "Computer System".
 *
 * Six question types are used, chosen because they suit this chapter:
 *   MCQ, SHORT, LONG, CODING, ORAL, UPLOAD
 *
 * SQL is deliberately NOT used. SQL enters the CBSE syllabus in Class 12
 * (Database Management), so a Class 11 Computer System paper has no business
 * containing it.
 *
 * Every question carries a stable `id`. The seeder matches on the question stem,
 * so this file is safe to re-run: questions are never duplicated.
 */

export type BankOption = { text: string; correct?: boolean };

export type BankQuestion = {
  id: string;
  type: "MCQ" | "SHORT" | "LONG" | "CODING" | "ORAL" | "UPLOAD";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  stem: string;
  explanation: string;
  options?: BankOption[];
  starterCode?: Record<string, string>;
  solutionCode?: string;
  /** Auto-grading test cases. `input` is piped to the program's stdin. */
  testCases?: Array<{ input: string; expected: string; isHidden?: boolean }>;
};

const py = (body: string) => ({ python: body });

export const COMPUTER_SYSTEM_QUESTIONS: BankQuestion[] = [
  // ------------------------------------------------------------------ MCQ (24)
  {
    id: "m01",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which unit of the CPU fetches, decodes and executes instructions?",
    explanation:
      "The Control Unit (CU) fetches the instruction, decodes it into an operation code, and directs the other units. The ALU carries out the operation and the Memory Unit supplies the data.",
    options: [
      { text: "Arithmetic Logic Unit", correct: false },
      { text: "Control Unit", correct: true },
      { text: "Memory Unit", correct: false },
      { text: "Cache", correct: false },
    ],
  },
  {
    id: "m02",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A memory unit has 16 address lines. How many distinct memory locations can it address?",
    explanation: "n address lines select 2^n locations. 16 address lines therefore address 2^16 = 65,536 locations.",
    options: [
      { text: "16", correct: false },
      { text: "256", correct: false },
      { text: "65,536 (2^16)", correct: true },
      { text: "4,096 (2^12)", correct: false },
    ],
  },
  {
    id: "m03",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which of the following is volatile memory?",
    explanation: "RAM loses its contents when power is removed, so it is volatile. ROM is non-volatile.",
    options: [
      { text: "RAM", correct: true },
      { text: "ROM", correct: false },
      { text: "Hard disk", correct: false },
      { text: "DVD", correct: false },
    ],
  },
  {
    id: "m04",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Fourth generation computers are characterised by the use of",
    explanation: "The fourth generation (from the mid-1970s) uses large-scale integrated circuits and the microprocessor, giving machines that are smaller, faster, cheaper and more reliable.",
    options: [
      { text: "Vacuum tubes", correct: false },
      { text: "Transistors", correct: false },
      { text: "Integrated circuits", correct: false },
      { text: "Microprocessors", correct: true },
    ],
  },
  {
    id: "m05",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "The BIOS (Basic Input Output System) of a computer is stored in",
    explanation: "The BIOS is firmware held in ROM/flash on the motherboard. It runs first when the machine is powered on and performs the power-on self test before handing over to the boot loader.",
    options: [
      { text: "RAM", correct: false },
      { text: "ROM", correct: true },
      { text: "Hard disk", correct: false },
      { text: "Cache", correct: false },
    ],
  },
  {
    id: "m06",
    type: "MCQ",
    difficulty: "EASY",
    stem: "The bus that carries the memory address from the CPU to the memory unit is the",
    explanation: "The address bus carries addresses from the CPU outward; the data bus carries data both ways between CPU, memory and I/O devices.",
    options: [
      { text: "Data bus", correct: false },
      { text: "Address bus", correct: true },
      { text: "Control bus", correct: false },
      { text: "System bus", correct: false },
    ],
  },
  {
    id: "m07",
    type: "MCQ",
    difficulty: "EASY",
    stem: "1 kilobyte is equal to",
    explanation: "In computing, 1 KB = 2^10 = 1024 bytes.",
    options: [
      { text: "1000 bytes", correct: false },
      { text: "1024 bytes", correct: true },
      { text: "512 bytes", correct: false },
      { text: "2048 bytes", correct: false },
    ],
  },
  {
    id: "m08",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which of the following is an example of secondary memory?",
    explanation: "A hard disk is secondary storage: it is non-volatile, holds data permanently, and is slower than primary memory.",
    options: [
      { text: "Cache", correct: false },
      { text: "RAM", correct: false },
      { text: "Hard disk", correct: true },
      { text: "Register", correct: false },
    ],
  },
  {
    id: "m09",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Cache memory is placed between the CPU and",
    explanation: "Cache sits between the CPU and main memory, holding recently used data so the CPU does not have to wait for slower RAM.",
    options: [
      { text: "The power supply", correct: false },
      { text: "RAM", correct: true },
      { text: "The printer", correct: false },
      { text: "The monitor", correct: false },
    ],
  },
  {
    id: "m10",
    type: "MCQ",
    difficulty: "EASY",
    stem: "The Arithmetic Logic Unit (ALU) performs",
    explanation: "The ALU carries out arithmetic operations (addition, subtraction) and logical operations (AND, OR, NOT, comparisons).",
    options: [
      { text: "Only arithmetic operations", correct: false },
      { text: "Arithmetic and logical operations", correct: true },
      { text: "Data storage operations", correct: false },
      { text: "Instruction fetching", correct: false },
    ],
  },
  {
    id: "m11",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A computer whose address bus is 32 bits wide can address a maximum memory of",
    explanation: "32 address lines address 2^32 bytes = 4 GB (using 1 KB = 1024 bytes).",
    options: [
      { text: "2 GB", correct: false },
      { text: "4 GB", correct: true },
      { text: "64 GB", correct: false },
      { text: "16 MB", correct: false },
    ],
  },
  {
    id: "m12",
    type: "MCQ",
    difficulty: "EASY",
    stem: "A DVD is an example of",
    explanation: "DVD is optical storage: data is stored as pits and lands read by a laser. Hard disk and SSD are magnetic/solid-state storage.",
    options: [
      { text: "Magnetic storage", correct: false },
      { text: "Optical storage", correct: true },
      { text: "Cache storage", correct: false },
      { text: "Primary storage", correct: false },
    ],
  },
  {
    id: "m13",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which of the following is system software?",
    explanation: "An operating system, device driver and utility program are system software: they manage the hardware for the user. A word processor is application software.",
    options: [
      { text: "MS Word", correct: false },
      { text: "Windows / Linux", correct: true },
      { text: "Photoshop", correct: false },
      { text: "Chrome", correct: false },
    ],
  },
  {
    id: "m14",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "The register that holds the result of an arithmetic or logical operation inside the CPU is the",
    explanation: "The accumulator stores the immediate result of an ALU operation. Other registers include the program counter, the instruction register and the memory address register.",
    options: [
      { text: "Program counter", correct: false },
      { text: "Instruction register", correct: false },
      { text: "Accumulator", correct: true },
      { text: "Buffer register", correct: false },
    ],
  },
  {
    id: "m15",
    type: "MCQ",
    difficulty: "HARD",
    stem: "The range of values that can be stored in a signed 8-bit integer is",
    explanation:
      "In a signed n-bit number the range is -2^(n-1) to 2^(n-1) - 1. For n = 8 that is -128 to 127.",
    options: [
      { text: "0 to 255", correct: false },
      { text: "-128 to 127", correct: true },
      { text: "-255 to 255", correct: false },
      { text: "-127 to 128", correct: false },
    ],
  },
  {
    id: "m16",
    type: "MCQ",
    difficulty: "EASY",
    stem: "First generation computers used which technology?",
    explanation: "First generation computers (1940s-1950s) used vacuum tubes, with drum memory, magnetic core memory and punched-card input. They were huge, slow and unreliable.",
    options: [
      { text: "Vacuum tubes", correct: true },
      { text: "Transistors", correct: false },
      { text: "Integrated circuits", correct: false },
      { text: "Microprocessors", correct: false },
    ],
  },
  {
    id: "m17",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "DMA stands for",
    explanation: "Direct Memory Access allows a peripheral device to transfer data to and from memory without the CPU handling every byte, which frees the CPU for other work.",
    options: [
      { text: "Direct Memory Access", correct: true },
      { text: "Dynamic Memory Allocation", correct: false },
      { text: "Digital Media Adapter", correct: false },
      { text: "Data Memory Address", correct: false },
    ],
  },
  {
    id: "m18",
    type: "MCQ",
    difficulty: "EASY",
    stem: "A printer is classified as an",
    explanation: "A printer produces output, so it is an output device. A scanner and a keyboard are input devices.",
    options: [
      { text: "Input device", correct: false },
      { text: "Output device", correct: true },
      { text: "Memory device", correct: false },
      { text: "Communication device", correct: false },
    ],
  },
  {
    id: "m19",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "ROM stands for",
    explanation: "ROM is Read Only Memory. It is non-volatile and holds firmware such as the BIOS, which must survive when power is off.",
    options: [
      { text: "Read Only Memory", correct: true },
      { text: "Random Output Memory", correct: false },
      { text: "Read Output Memory", correct: false },
      { text: "Rapid Online Memory", correct: false },
    ],
  },
  {
    id: "m20",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "The word length of a computer refers to",
    explanation: "Word length is the number of bits the CPU processes in a single operation — 32 bits or 64 bits on a modern machine.",
    options: [
      { text: "The number of bits processed at a time", correct: true },
      { text: "The number of keys on the keyboard", correct: false },
      { text: "The number of characters on the screen", correct: false },
      { text: "The number of I/O ports", correct: false },
    ],
  },
  {
    id: "m21",
    type: "MCQ",
    difficulty: "EASY",
    stem: "Which combination correctly forms the Central Processing Unit?",
    explanation: "The CPU = Control Unit + ALU + Memory Unit + a set of registers.",
    options: [
      { text: "Control Unit and ALU", correct: true },
      { text: "RAM and ROM", correct: false },
      { text: "Monitor and keyboard", correct: false },
      { text: "Hard disk and cache", correct: false },
    ],
  },
  {
    id: "m22",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "Compared with RAM, cache memory is",
    explanation: "Cache is much faster but far smaller and more expensive per byte, so it holds only a small amount of recently used data.",
    options: [
      { text: "Larger in size and slower", correct: false },
      { text: "Smaller in size but faster", correct: true },
      { text: "Same size but slower", correct: false },
      { text: "Larger in size and faster", correct: false },
    ],
  },
  {
    id: "m23",
    type: "MCQ",
    difficulty: "MEDIUM",
    stem: "A computer with more than one processing unit in its CPU is called a",
    explanation: "A multiprocessor or multicore CPU can execute several instructions in parallel, which increases throughput for a single program as well as for many programs.",
    options: [
      { text: "Uniprocessor", correct: false },
      { text: "Multiprocessor", correct: true },
      { text: "Peripheral", correct: false },
      { text: "Microcontroller", correct: false },
    ],
  },
  {
    id: "m24",
    type: "MCQ",
    difficulty: "HARD",
    stem: "A computer has 16 memory chips of 1 KB each. Every chip is byte-wide (8 data lines) and needs 10 address lines of its own. If the 16 chips are arranged to form one contiguous memory, the total number of address lines required is",
    explanation:
      "Each byte-wide chip keeps its 10 address lines, so 8 chips are never wired in parallel on the data lines; the 16 chips sit one per row. Selecting one of 16 rows needs log2(16) = 4 further (chip-select) address lines. Total = 10 + 4 = 14 address lines, which addresses 2^14 = 16 KB. Data lines stay at 8.",
    options: [
      { text: "10", correct: false },
      { text: "12", correct: false },
      { text: "14", correct: true },
      { text: "16", correct: false },
    ],
  },

  // --------------------------------------------------------------- SHORT (16)
  {
    id: "s01",
    type: "SHORT",
    difficulty: "EASY",
    stem: "Differentiate between RAM and ROM.",
    explanation:
      "RAM is volatile, read/write, faster, and used for working memory while the program runs. ROM is non-volatile, read-mostly, and holds firmware that must survive a power cut. Examples: RAM = DDR4; ROM = BIOS chip.",
  },
  {
    id: "s02",
    type: "SHORT",
    difficulty: "EASY",
    stem: "Differentiate between hardware and software, giving one example of each.",
    explanation:
      "Hardware is the physical, tangible part of a computer (a keyboard). Software is the set of programs and instructions (MS Word or a Python program) that work on the hardware. Hardware without software cannot perform any task.",
  },
  {
    id: "s03",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "Why is cache memory used when the computer already has RAM?",
    explanation:
      "RAM is far slower than the CPU. Cache holds a small amount of recently used data and instructions so the CPU does not have to wait for RAM on every access. It is very fast (often built inside the CPU) but small and expensive.",
  },
  {
    id: "s04",
    type: "SHORT",
    difficulty: "EASY",
    stem: "Differentiate between primary and secondary memory.",
    explanation:
      "Primary memory (RAM, ROM) is directly accessible by the CPU, small, fast and (for RAM) volatile. Secondary memory (hard disk, SSD, DVD) is not directly reachable by the CPU, large, slower and non-volatile; data must first be loaded into RAM.",
  },
  {
    id: "s05",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "State the functions of the Control Unit.",
    explanation:
      "The Control Unit fetches an instruction from memory, decodes it, and then directs the ALU, memory unit and I/O units to carry out the operation. It also controls the timing and sequencing of data transfer.",
  },
  {
    id: "s06",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "Explain the roles of the data bus, address bus and control bus.",
    explanation:
      "Address bus carries the address of the memory location (unidirectional, CPU to memory). Data bus carries the actual data (bidirectional). Control bus carries timing and control signals such as read, write and interrupt (mostly CPU outward).",
  },
  {
    id: "s07",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "Differentiate between magnetic and optical secondary storage.",
    explanation:
      "Magnetic storage (hard disk, floppy) stores data as magnetised patterns on a rotating platter and is rewritable. Optical storage (CD, DVD) stores data as pits and lands read by a laser and is essentially write-once. Optical is more compact and durable; magnetic is faster to rewrite.",
  },
  {
    id: "s08",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "Differentiate between SRAM and DRAM.",
    explanation:
      "SRAM stores a bit in a flip-flop made of 6 transistors, needs no refreshing, is very fast and is expensive — used for cache. DRAM stores a bit as charge in a capacitor, must be refreshed thousands of times a second, is slower and cheap — used for main RAM.",
  },
  {
    id: "s09",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "How is the memory capacity of a computer with 20 address lines calculated?",
    explanation:
      "n address lines address 2^n locations. 2^20 = 1,048,576 locations. If each location holds 1 byte, the capacity is 1 MB (1,048,576 bytes), because 1 MB = 2^20 bytes.",
  },
  {
    id: "s10",
    type: "SHORT",
    difficulty: "EASY",
    stem: "State any four functions of an operating system.",
    explanation:
      "Any four of: process management, memory management, file management, device management, providing a user interface, security and account management, and providing services to other programs.",
  },
  {
    id: "s11",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "Differentiate between a microprocessor and a CPU.",
    explanation:
      "A microprocessor is the entire CPU fabricated on a single chip — registers, ALU and control unit. 'CPU' is the functional unit that executes instructions, which in a personal computer happens to be a microprocessor but may be built from several chips.",
  },
  {
    id: "s12",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "Differentiate between a uniprocessor and a multiprocessor system.",
    explanation:
      "A uniprocessor system has a single CPU and processes one instruction stream at a time. A multiprocessor system has two or more CPUs (or one CPU with several cores) that can work on different tasks in parallel, improving throughput and reliability.",
  },
  {
    id: "s13",
    type: "SHORT",
    difficulty: "EASY",
    stem: "Give two examples each of input and output devices, and state what a port is.",
    explanation:
      "Input: keyboard, mouse, scanner, microphone, touchscreen. Output: monitor, printer, speaker, projector. A port is the interface on a computer where a peripheral is connected, for example USB, HDMI, VGA or a Bluetooth adapter.",
  },
  {
    id: "s14",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "What is meant by booting? Name the components involved.",
    explanation:
      "Booting is the sequence of steps a computer follows from the moment power is switched on until the operating system is ready for the user. The sequence is: power-on self test in the BIOS/UEFI → boot device selected → boot loader (boot sector) loads the OS → OS initialises and the shell starts.",
  },
  {
    id: "s15",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "What is a device driver and why is one needed?",
    explanation:
      "A device driver is a program that lets the operating system control a particular device, translating standard commands into the device's own control language. It is needed because each device speaks a different protocol; without the driver the OS cannot use the device.",
  },
  {
    id: "s16",
    type: "SHORT",
    difficulty: "MEDIUM",
    stem: "Differentiate between a minicomputer, a mainframe and a supercomputer.",
    explanation:
      "A minicomputer serves a small department, a mainframe serves hundreds of users of one organisation, and a supercomputer performs very large computations such as weather forecasting. All three differ from a microcomputer in size, cost, speed and the number of users they support.",
  },

  // ----------------------------------------------------------------- LONG (10)
  {
    id: "l01",
    type: "LONG",
    difficulty: "MEDIUM",
    stem:
      "Explain the functional blocks of a computer system with the help of a block diagram, describing input, output, memory, CPU and storage.",
    explanation:
      "Answer should cover: input unit (accepts data and converts it to binary), memory unit (RAM, ROM, cache, registers), CPU = CU + ALU + MU + registers, output unit, secondary storage, and the buses that connect them. A labelled block diagram is expected.",
  },
  {
    id: "l02",
    type: "LONG",
    difficulty: "MEDIUM",
    stem: "Explain the five generations of computers with their technology, characteristics and limitations.",
    explanation:
      "1st vacuum tubes; 2nd transistors; 3rd integrated circuits; 4th microprocessors; 5th AI and intelligent agents. For each give size, speed, cost, reliability, power use and one limitation, and note that generations overlap rather than follow cleanly.",
  },
  {
    id: "l03",
    type: "LONG",
    difficulty: "HARD",
    stem:
      "A computer has 16 address lines and each addressable location stores 1 byte. Find the memory capacity in bytes, KB, MB and GB, and state how many such locations exist.",
    explanation:
      "2^16 = 65,536 locations and 65,536 bytes of capacity. 65,536 bytes = 64 KB = 0.0625 MB. State clearly that 1 KB = 1024 bytes, 1 MB = 1024 KB, 1 GB = 1024 MB, and that 16 address lines address 64 KB, not 64 MB.",
  },
  {
    id: "l04",
    type: "LONG",
    difficulty: "MEDIUM",
    stem: "Explain the system bus in detail, describing the data bus, address bus and control bus.",
    explanation:
      "A bus is a shared communication path. The system bus connects CPU, memory and I/O. Describe direction of data flow, purpose of each of the three buses, what bus width means, and why the address bus being n bits wide limits memory to 2^n locations. Mention that a bus is shared, so only one device may use it at a time unless arbitration is used.",
  },
  {
    id: "l05",
    type: "LONG",
    difficulty: "HARD",
    stem: "Explain what happens when a computer is switched on, from power-on self test to the loading of the operating system.",
    explanation:
      "Power supply stabilises → BIOS/UEFI runs POST → boot device order is checked → boot sector/boot loader loads the OS kernel into RAM → device drivers load → services start → user interface appears. Explain why firmware must be in non-volatile memory.",
  },
  {
    id: "l06",
    type: "LONG",
    difficulty: "MEDIUM",
    stem: "Explain the memory hierarchy of a computer from registers through to tertiary storage.",
    explanation:
      "Registers → cache → main memory (RAM/ROM) → secondary storage (SSD/HDD/DVD) → tertiary/offline (cloud, tape, archival). For each level give speed, size, cost per byte and volatility, and explain why the hierarchy exists (the CPU is far faster than RAM).",
  },
  {
    id: "l07",
    type: "LONG",
    difficulty: "MEDIUM",
    stem: "Explain the role of an operating system as a resource manager.",
    explanation:
      "Cover process management (scheduling, ready/terminated states), memory management (allocation, virtual memory), file and secondary storage management, device management using drivers, security and user accounts, and the user interface. Give one practical example for each.",
  },
  {
    id: "l08",
    type: "LONG",
    difficulty: "MEDIUM",
    stem: "Classify input and output devices with at least three examples of each and explain their purpose.",
    explanation:
      "Input: keyboard, mouse, scanner, mic, touchscreen, barcode reader. Output: monitor, printer, speaker, projector, plotter. Mention that a touch screen is both, and that a port is needed to connect a peripheral.",
  },
  {
    id: "l09",
    type: "LONG",
    difficulty: "HARD",
    stem: "Differentiate carefully between a microcomputer, minicomputer, mainframe and supercomputer.",
    explanation:
      "Compare size, cost, speed, number of users, typical examples and use cases. Expected conclusion: they differ mainly in scale and the number of simultaneous users; a microcomputer now has more raw power than a mainframe of the 1970s.",
  },
  {
    id: "l10",
    type: "LONG",
    difficulty: "HARD",
    stem:
      "A memory of 16 KB is to be built from 1 KB memory chips. Each chip is byte-wide, that is, it has 8 data lines and needs 10 address lines of its own. Draw the arrangement, state the total address lines and the total data lines, and calculate the total capacity.",
    explanation:
      "Because the memory is byte-wide, chips are not placed in parallel on the data lines: 8 chips in a row would give 64 data lines. So the 16 chips form 16 rows of one chip each. Each chip still needs 10 address lines, and selecting one of 16 rows needs 4 chip-select address lines, giving 10 + 4 = 14 address lines in total. Data lines = 8. Capacity = 16 x 1 KB = 16 KB = 2^14 bytes, which matches the 14 address lines. Drawing the arrangement is expected.",
  },

  // --------------------------------------------------------------- CODING (7)
  {
    id: "c01",
    type: "CODING",
    difficulty: "EASY",
    stem:
      "Write a program that takes a file size in kilobytes and prints the same size in megabytes and gigabytes, rounded to two decimal places.",
    explanation: "1 KB = 1024 bytes, 1 MB = 1024 KB, 1 GB = 1024 MB. So MB = KB / 1024 and GB = KB / (1024 * 1024).",
    starterCode: py(
      `# Read a size in KB and print it in MB and GB.
# 1 MB = 1024 KB, 1 GB = 1024 MB
kb = float(input())

mb = 0.0   # TODO
gb = 0.0   # TODO

print(f"{mb:.2f} MB")
print(f"{gb:.2f} GB")
`
    ),
    solutionCode: `kb = float(input())
mb = kb / 1024
gb = kb / (1024 * 1024)
print(f"{mb:.2f} MB")
print(f"{gb:.2f} GB")
`,
    testCases: [
      { input: "1024", expected: "1.00 MB\n0.00 GB" },
      { input: "1048576", expected: "1024.00 MB\n1.00 GB" },
      { input: "512", expected: "0.50 MB\n0.00 GB" },
    ],
  },
  {
    id: "c02",
    type: "CODING",
    difficulty: "MEDIUM",
    stem:
      "Write a program that reads the number of address lines of a memory and prints how many distinct memory locations it can address.",
    explanation: "n address lines select 2^n locations, so compute 2 ** n.",
    starterCode: py(
      `# n address lines -> 2**n addressable locations
n = int(input())

locations = 0   # TODO

print(locations)
`
    ),
    solutionCode: `n = int(input())
locations = 2 ** n
print(locations)
`,
    testCases: [
      { input: "16", expected: "65536" },
      { input: "20", expected: "1048576" },
      { input: "10", expected: "1024" },
    ],
  },
  {
    id: "c03",
    type: "CODING",
    difficulty: "HARD",
    stem:
      "Write a program that reads the number of byte-wide memory chips, the number of address lines each chip needs and the number of data lines each chip has, then prints how the chips must be arranged: chips per row, number of rows, extra chip-select address lines, total address lines, total data lines and the total capacity in KB.",
    explanation:
      "The memory being built is byte-wide, so the total data lines are 8: chipsPerRow = 8 / dataLinesPerChip. rows = chips / chipsPerRow. The extra chip-select address lines = log2(rows). totalAddressLines = addressLinesPerChip + chipSelectLines. capacityKB = chips * 2**addressLinesPerChip / 1024. Worked example: 16 chips, 10 address lines, 8 data lines gives 1 chip per row, 16 rows, 4 chip-select lines, 14 total address lines, 8 data lines and 16.0 KB.",
    starterCode: py(
      `# Arrange byte-wide memory chips into one contiguous memory.
chips = int(input())
address_lines_per_chip = int(input())
data_lines_per_chip = int(input())

chips_per_row = 0
rows = 0
chip_select_lines = 0
total_address_lines = 0
total_data_lines = 0
capacity_kb = 0.0

print(chips_per_row, rows, chip_select_lines, total_address_lines, total_data_lines, capacity_kb)
`
    ),
    solutionCode: `chips = int(input())
address_lines_per_chip = int(input())
data_lines_per_chip = int(input())

total_data_lines = 8
chips_per_row = total_data_lines // data_lines_per_chip
rows = chips // chips_per_row
chip_select_lines = rows.bit_length() - 1
total_address_lines = address_lines_per_chip + chip_select_lines
capacity_kb = chips * (2 ** address_lines_per_chip) / 1024

print(chips_per_row, rows, chip_select_lines, total_address_lines, total_data_lines, capacity_kb)
`,
    testCases: [
      { input: "16\n10\n8", expected: "1 16 4 14 8 16.0" },
      { input: "8\n8\n8", expected: "1 8 3 11 8 2.0" },
      { input: "32\n10\n8", expected: "1 32 5 15 8 32.0" },
    ],
  },
  {
    id: "c04",
    type: "CODING",
    difficulty: "MEDIUM",
    stem: "Write a program that finds the number of address lines required to address N memory locations.",
    explanation: "Find the smallest n such that 2**n >= N, i.e. n = ceil(log2(N)).",
    starterCode: py(
      `# Smallest n such that 2**n >= n_locations
locations = int(input())

address_lines = 0   # TODO

print(address_lines)
`
    ),
    solutionCode: `locations = int(input())
address_lines = 0
while 2 ** address_lines < locations:
    address_lines += 1
print(address_lines)
`,
    testCases: [
      { input: "65536", expected: "16" },
      { input: "1000", expected: "10" },
      { input: "1", expected: "0" },
    ],
  },
  {
    id: "c05",
    type: "CODING",
    difficulty: "MEDIUM",
    stem:
      "Write a program that prints a table showing, for 2 to 2^20, the power of two, the number of addressable locations and the equivalent size in KB, MB and GB.",
    explanation: "Loop p from 1 to 20 and print 2**p, 2**p, and 2**p / 1024 (KB), /1024/1024 (MB), /1024/1024/1024 (GB).",
    starterCode: py(
      `# Print the addressing table for 2**1 .. 2**20
for p in range(1, 21):
    locations = 0        # 2 ** p
    kb = 0.0
    mb = 0.0
    gb = 0.0
    print(p, locations, f"{kb:.4f}", f"{mb:.4f}", f"{gb:.4f}")
`
    ),
    solutionCode: `for p in range(1, 21):
    locations = 2 ** p
    kb = locations / 1024
    mb = kb / 1024
    gb = mb / 1024
    print(p, locations, f"{kb:.4f}", f"{mb:.4f}", f"{gb:.4f}")
`,
    testCases: [
      {
        input: "",
        expected: [
          "1 2 0.0020 0.0000 0.0000",
          "2 4 0.0039 0.0000 0.0000",
          "3 8 0.0078 0.0000 0.0000",
          "4 16 0.0156 0.0000 0.0000",
          "5 32 0.0312 0.0000 0.0000",
          "6 64 0.0625 0.0001 0.0000",
          "7 128 0.1250 0.0001 0.0000",
          "8 256 0.2500 0.0002 0.0000",
          "9 512 0.5000 0.0005 0.0000",
          "10 1024 1.0000 0.0010 0.0000",
          "11 2048 2.0000 0.0020 0.0000",
          "12 4096 4.0000 0.0039 0.0000",
          "13 8192 8.0000 0.0078 0.0000",
          "14 16384 16.0000 0.0156 0.0000",
          "15 32768 32.0000 0.0312 0.0000",
          "16 65536 64.0000 0.0625 0.0001",
          "17 131072 128.0000 0.1250 0.0001",
          "18 262144 256.0000 0.2500 0.0002",
          "19 524288 512.0000 0.5000 0.0005",
          "20 1048576 1024.0000 1.0000 0.0010",
        ].join("\n"),
      },
    ],
  },
  {
    id: "c06",
    type: "CODING",
    difficulty: "EASY",
    stem:
      "Write a program that reads a data size in MB and prints how many 1.44 MB floppy disks are needed to store it, and how many would be left unused.",
    explanation: "disks = ceil(mb / 1.44); unused = disks * 1.44 - mb.",
    starterCode: py(
      `import math

mb = float(input())

disks = 0      # math.ceil(mb / 1.44)
unused_mb = 0.0

print(disks)
print(f"{unused_mb:.2f}")
`
    ),
    solutionCode: `import math

mb = float(input())

disks = math.ceil(mb / 1.44)
unused_mb = disks * 1.44 - mb

print(disks)
print(f"{unused_mb:.2f}")
`,
    testCases: [
      { input: "1.44", expected: "1\n0.00" },
      { input: "10", expected: "7\n0.08" },
      { input: "100", expected: "70\n0.80" },
    ],
  },
  {
    id: "c07",
    type: "CODING",
    difficulty: "MEDIUM",
    stem:
      "Write a program that reads the number of bits n and prints the range of values an unsigned n-bit integer and a signed n-bit integer can hold.",
    explanation:
      "An unsigned n-bit integer runs from 0 to 2^n - 1. A signed n-bit integer runs from -2^(n-1) to 2^(n-1) - 1, because one bit is used for the sign.",
    starterCode: py(
      `# Range of an n-bit unsigned and signed integer
n = int(input())

unsigned_max = 0
signed_min = 0
signed_max = 0

print(unsigned_max, signed_min, signed_max)
`
    ),
    solutionCode: `n = int(input())

unsigned_max = 2 ** n - 1
signed_min = -(2 ** (n - 1))
signed_max = 2 ** (n - 1) - 1

print(unsigned_max, signed_min, signed_max)
`,
    testCases: [
      { input: "8", expected: "255 -128 127" },
      { input: "4", expected: "15 -8 7" },
      { input: "16", expected: "65535 -32768 32767" },
    ],
  },

  // ----------------------------------------------------------------- ORAL (9)
  {
    id: "o01",
    type: "ORAL",
    difficulty: "EASY",
    stem: "In one sentence each, what is the difference between firmware and software?",
    explanation:
      "Firmware is software written into non-volatile memory (ROM/flash) that controls low-level hardware and is not usually user-updatable; software is a general program run by the OS from RAM and can be changed freely.",
  },
  {
    id: "o02",
    type: "ORAL",
    difficulty: "EASY",
    stem: "Why can a computer not keep its programs permanently in RAM?",
    explanation: "RAM is volatile — it loses all contents when power is removed — so programs and data would be lost at every shutdown.",
  },
  {
    id: "o03",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "If you switch off a computer, which kind of memory loses its data first, and why?",
    explanation:
      "Cache and RAM lose their data first because they are volatile. ROM and hard disk keep their contents because they are non-volatile.",
  },
  {
    id: "o04",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "What is an interrupt, and why does a computer need it?",
    explanation:
      "An interrupt is a signal from a device or timer that temporarily suspends the running program so the CPU can service the device, then resume. It lets a slow peripheral request attention without the CPU polling it continuously.",
  },
  {
    id: "o05",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "What does it mean to call a computer '32-bit'?",
    explanation:
      "It describes the natural word size of the CPU: it can process 32 bits in a single operation, and its address bus can address 2^32 bytes (4 GB) of memory.",
  },
  {
    id: "o06",
    type: "ORAL",
    difficulty: "MEDIUM",
    stem: "What is the role of the memory controller in a computer system?",
    explanation:
      "It sits between the CPU and the memory chips, translates the CPU's memory request into chip select, row and column signals, and refreshes DRAM so the charge in each cell is restored.",
  },
  {
    id: "o07",
    type: "ORAL",
    difficulty: "EASY",
    stem: "What is the difference between a core and a processor?",
    explanation:
      "A processor (CPU) is the whole chip. A core is one independent execution unit inside it, with its own registers and ALU. A multi-core processor can run several tasks at once.",
  },
  {
    id: "o08",
    type: "ORAL",
    difficulty: "EASY",
    stem: "Why does a computer need an operating system at all?",
    explanation:
      "To manage hardware, memory and files and to give programs a standard interface. Without an OS each program would have to drive the hardware directly, and the user would have no way to manage files or devices.",
  },
  {
    id: "o09",
    type: "ORAL",
    difficulty: "EASY",
    stem: "Name the port commonly used to connect a printer today, and one older port it replaced.",
    explanation:
      "USB is the modern port; it replaced the parallel (LPT) port on older printers. A network printer may also use an Ethernet port.",
  },

  // --------------------------------------------------------------- UPLOAD (4)
  {
    id: "u01",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem:
      "Draw a labelled block diagram of a computer system showing the input unit, CPU (with CU, ALU, MU and registers), memory, secondary storage and output unit. Upload a clear photograph or a neat drawing.",
    explanation:
      "Marks are for correct blocks, correct labels inside the CPU, sensible arrows showing the flow of data and instructions, and legibility.",
  },
  {
    id: "u02",
    type: "UPLOAD",
    difficulty: "MEDIUM",
    stem:
      "Draw the memory hierarchy of a computer as a pyramid, from registers at the top to tertiary storage at the bottom. Upload the image and label each level with its speed, size and volatility.",
    explanation:
      "Expected order: registers, cache, main memory, secondary storage, tertiary storage. Add the speed/size/volatility note beside each level.",
  },
  {
    id: "u03",
    type: "UPLOAD",
    difficulty: "EASY",
    stem:
      "Open the cabinet of a computer (or study a photograph of one online) and upload a labelled photograph identifying the motherboard, CPU, RAM modules, storage device, SMPS and expansion slots.",
    explanation:
      "All six parts must be identified clearly. If you cannot open a computer, use a clearly labelled diagram of a motherboard instead and say so.",
  },
  {
    id: "u04",
    type: "UPLOAD",
    difficulty: "HARD",
    stem:
      "Prepare a chart comparing the five generations of computers with columns for technology, size, speed, cost, reliability and power consumption, plus one limitation of each. Upload the chart as an image or PDF.",
    explanation:
      "All five generations must appear with all six attributes. Marks are lost for a missing generation or a repeated value across generations.",
  },
];
