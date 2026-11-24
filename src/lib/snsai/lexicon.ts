/**
 * SNSAI — Computer Science lexicon.
 *
 * A hand-built knowledge base of the vocabulary a Class 11/12 Computer Science
 * student actually uses. It does three jobs:
 *
 *   1. SYNONYMS  — "volatile"/"loses data on power off", "CPU"/"processor",
 *                  "non-volatile"/"permanent". Lets a correct answer in the
 *                  student's own words still match the reference answer.
 *   2. ABBREVIATIONS — expands "RAM" to "random access memory" so a student who
 *                  spells it out matches one who uses the acronym.
 *   3. MISCONCEPTIONS — specific wrong-but-plausible beliefs, each with the
 *                  correction. This is what turns a mark into teaching.
 *
 * This file is data, not logic, so it can grow without touching the engine.
 */

import { stem } from "./text";

/** Every group is a set of interchangeable ways of saying the same thing. */
const SYNONYM_GROUPS: string[][] = [
  // --- memory & storage -------------------------------------------------
  ["volatile", "nonpermanent", "losescontentpoweroff", "temporary", "clearedpoweroff"],
  ["nonvolatile", "permanent", "retainsdata", "retainspoweroff", "notlostpoweroff", "persistent"],
  ["randomaccessmemory", "ram", "primarymemoryworking", "mainmemory"],
  ["readonlymemory", "rom", "nonvolatilememory"],
  ["cache", "cachememory", "fastmemory", "intermediatecache"],
  ["staticrandomaccessmemory", "sram"],
  ["dynamicrandomaccessmemory", "dram"],
  ["harddisk", "hdd", "magneticstorage", "secondarystorage", "secondarymemory"],
  ["solidstatedrive", "ssd", "flashstorage"],
  ["opticalstorage", "cd", "dvd", "laser", "compactdisc"],
  ["magneticstorage", "harddisk", "hdd", "floppy", "platter"],
  ["tertiarystorage", "offline", "cloud", "archival", "backup"],
  ["addressline", "addressbus"],
  ["dataline", "databus"],
  ["controlbus", "controlsignal"],

  // --- cpu --------------------------------------------------------------
  ["cpu", "centralprocessingunit", "processor", "microprocessor"],
  ["alu", "arithmeticlogicunit", "arithmeticunit", "logicunit"],
  ["cu", "controlunit", "controlunitcu"],
  ["mu", "memoryunit", "mainmemory"],
  ["register", "registers", "accumulator", "programcounter"],
  ["instruction", "opcode", "machinecode"],
  ["fetch", "fetches", "fetched"],
  ["decode", "interpret"],
  ["execute", "run", "perform"],

  // --- generations -------------------------------------------------------
  ["firstgeneration", "vacuumtube", "vacuumtubes", "generation1"],
  ["secondgeneration", "transistor", "transistors", "generation2"],
  ["thirdgeneration", "integratedcircuit", "integratedcircuits", "ic", "generation3"],
  ["fourthgeneration", "microprocessor", "microprocessors", "vlsi", "generation4"],
  ["fifthgeneration", "artificialintelligence", "ai", "generation5", "intelligentagent"],

  // --- systems -----------------------------------------------------------
  ["systemsoftware", "systemprogram", "operatingsystem", "os"],
  ["applicationsoftware", "applicationprogram", "app", "userprogram"],
  ["hardware", "physicalcomponent", "physicalparts"],
  ["software", "program", "programs", "systemandapplicationsoftware"],
  ["driver", "devicedriver", "deviceprogram"],
  ["firmware", "bios", "uefi"],
  ["bootloader", "bootloaderprogram"],
  ["booting", "boot", "bootprocess", "startup"],
  ["post", "poweronselftest", "selftest", "ppost"],
  ["operating", "operatingsystem", "os", "systemsoftware"],
  ["kernel", "oskernel", "core"],

  // --- processes & parallelism -------------------------------------------
  ["multiprocessor", "multicore", "multi", "parallel", "concurrent"],
  ["uniprocessor", "singleprocessor", "singlecore", "sequential"],
  ["interrupt", "interrupts", "interruptmechanism"],
  ["dma", "directmemoryaccess"],
  ["wordlength", "wordsize", "bitlength"],
  ["parallelprocessing", "simultaneous", "atthesametime"],
  ["throughput", "speedofprocessing", "performance"],

  // --- storage units -----------------------------------------------------
  ["kilobyte", "kb"],
  ["megabyte", "mb"],
  ["gigabyte", "gb"],
  ["terabyte", "tb"],
  ["binary", "base2", "bitwise", "bits"],
  ["bit", "bits"],
  ["byte", "bytes"],

  // --- devices & ports ---------------------------------------------------
  ["inputdevice", "input"],
  ["outputdevice", "output"],
  ["keyboard", "keypad"],
  ["mouse", "pointingdevice"],
  ["scanner", "scandevice"],
  ["printer", "printdevice"],
  ["monitor", "display", "screen", "vdu", "crt", "lcd"],
  ["projector", "lcdprojector"],
  ["speaker", "loudspeaker", "audiooutput"],
  ["microphone", "mic"],
  ["touchscreen", "touchscreeninput", "touchdisplay"],
  ["port", "interface", "connector", "socket"],
  ["usb", "universalserialbus"],
  ["printerport", "parallelport", "lpt"],

  // --- database ----------------------------------------------------------
  ["sql", "structuredquerylanguage", "querylanguage"],
  ["database", "db", "datastore"],
  ["table", "relation", "rowsandcolumns"],
  ["row", "tuple", "record"],
  ["column", "attribute", "field"],
  ["primarykey", "pk"],
  ["foreignkey", "fk"],
  ["schema", "databaseschema", "structure"],
  ["query", "sqlquery", "sqlcommand", "statement"],
  ["select", "selects", "chosen"],
  ["retrieve", "retrieval", "obtain"],
  ["join", "joining", "combine"],
  ["aggregate", "aggregation", "groupby"],

  // --- programming / coding ----------------------------------------------
  ["algorithm", "procedure", "stepbystep", "logic"],
  ["program", "programme", "code", "sourcecode"],
  ["loop", "iteration", "repetition", "repeat"],
  ["variable", "var", "identifier"],
  ["array", "list", "collection"],
  ["function", "method", "routine", "subroutine", "module"],
  ["compilation", "compile", "compiler", "objectcode", "translate"],
  ["error", "bug", "fault", "exception", "syntaxerror"],
  ["debug", "debugging", "troubleshoot"],
  ["recursion", "recursive", "callitself"],
  ["input", "stdin", "readinput", "acceptinput"],
  ["output", "stdout", "printoutput", "displayoutput"],

// --- problem solving & computational thinking ----------------------------
  // "solving" is deliberately not placed next to "solution" or "answer": a
  // problem-solving question is about the method, and a student who writes
  // "the solution is 42" has not described an algorithm.
  ["problem", "puzzle", "task", "issue"],
  ["decompose", "decomposition", "breakdown", "subproblem"],
  ["abstract", "abstraction"],
  ["pattern", "patternrecognition", "recurrence", "recurring"],
  ["flowchart", "flowdiagram", "flow chart"],
  ["pseudocode", "pseudocodes", "plainenglish", "pseudo code"],
  ["trace", "tracing", "dryrun", "tracetable", "traced"],
  // flowchart building blocks — each a distinctive stem with no clash on any
  // existing canonical word, so flowchart questions mark cleanly.
  ["terminator", "startend", "oval", "terminalsymbol"],
  ["decision", "diamond", "branch", "branching", "conditionalbox", "decisionbox"],
  ["processbox", "rectangle", "processingbox", "processsymbol"],
  ["parallelogram", "io", "iobox", "inputoutputbox"],
  ["flowline", "connector", "arrow"],
  ["step", "steps", "ordering", "stage"],

  // --- general academic ---------------------------------------------------
  ["definition", "means", "definedas", "is", "refers"],
  ["example", "eg", "instance", "forinstance", "suchas"],
  ["because", "since", "as", "dueto", "reason"],
  ["therefore", "hence", "thus", "so", "consequently"],
  ["fast", "quicker", "speedier", "highspeed", "rapid"],
  ["slow", "slower", "lessfast", "lowspeed"],
  ["small", "smaller", "little", "tiny", "compact"],
  ["large", "bigger", "huge", "big", "greater"],
  ["expensive", "costly", "costlyprice", "highcost"],
  ["cheap", "inexpensive", "lowcost", "affordable"],
  ["new", "newer", "recent", "modern", "latest"],
  ["old", "older", "earlier", "previous"],
  ["reliable", "dependable", "consistent", "trustworthy"],
  ["power", "electricity", "energy"],
  ["user", "person", "operator", "human"],
];

/**
 * Content-word equivalences: single words a student substitutes for another
 * while still being correct.
 *
 * This is the layer that decides whether a genuine paraphrase is recognised.
 * Without it, "loses its contents the moment power is removed" and "loses all
 * its data when the power goes off" look like two unrelated sentences, and a
 * correct answer is marked as missing the point.
 *
 * The first entry of each group is the canonical form.
 */
const CONTENT_SYNONYMS: string[][] = [
  // --- what is preserved / lost -----------------------------------------
  ["data", "contents", "content", "information", "info", "values"],
  ["volatile", "temporary", "transient", "nonpermanent", "clear", "clears", "cleared"],
  // "Drives the hardware" is how a student says "controls low-level hardware".
  // Without this, explaining that firmware drives the hardware missed the one
  // point that distinguishes firmware from an ordinary program.
  ["control", "controls", "controlled", "controlling", "drive", "drives", "driving", "driven"],
  ["nonvolatile", "permanent", "persistent", "retain", "retains", "retained", "keep", "keeps"],
  ["off", "removed", "remove", "removal", "cut", "unplugged", "disconnected", "gone", "goes", "switchedoff"],
  ["quickly", "moment", "instant", "instantly", "immediately", "abruptly"],
  ["store", "stores", "stored", "hold", "holds", "keep", "keeps", "save", "saves", "retain"],
  ["erase", "cleared", "clear", "wiped", "deleted", "destroyed"],

  // --- describing a computer -------------------------------------------
  ["fast", "quick", "rapid", "quicker"],
  ["slow", "sluggish", "slower"],
  ["small", "tiny", "smaller", "compact"],
  ["large", "big", "bigger", "huge"],
  ["expensive", "costly", "pricey"],
  ["cheap", "inexpensive", "affordable"],
  ["temporary", "volatile", "transient"],
  ["permanent", "nonvolatile", "lasting"],

  // --- describing software / code ---------------------------------------
  ["program", "software", "application", "code", "programme"],
  ["run", "execute", "executing", "perform", "works", "operating", "running"],
  ["write", "writes", "written", "coding", "store"],
  ["read", "reads", "reading", "retrieve"],
  ["load", "loads", "loading", "loaded"],
  ["access", "accessed", "reach", "touch"],
  ["error", "mistake", "fault", "bug", "incorrect", "wrong", "fail", "failure"],
  ["correct", "right", "valid", "proper", "accurate"],
  ["repeat", "loop", "iteration", "repetition", "cycle"],
  ["end", "conclusion", "terminates", "terminate", "stop", "finish", "final"],

  // --- describing logic / numbers ---------------------------------------
  ["number", "digit", "count", "integer", "numeral"],
  // "value", "name" and "variable" are kept apart on purpose. Collapsing them
  // renames the SQL column `name` to "variable" and destroys the difference
  // between a stored value and the slot that holds it.
  ["value", "amount", "quantity"],
  ["variable", "identifier"],
  ["plus", "add", "addition", "sum", "total"],
  ["minus", "subtract", "subtraction", "difference"],
  ["times", "multiply", "multiplication", "product"],
  ["divide", "division", "quotient"],
  ["increase", "increment", "add", "raise", "gain", "grow"],
  ["decrease", "decrement", "reduce", "lower", "fall", "shrink", "drop"],
  ["maximum", "max", "largest", "highest", "biggest", "peak"],
  ["minimum", "min", "smallest", "lowest", "least"],
  ["condition", "test", "check", "requirement", "if", "criteria"],
  ["list", "array", "collection", "sequence", "table"],
  ["function", "method", "routine", "procedure", "module"],
  ["loop", "repeat", "iteration", "while", "for"],
  ["input", "argument", "parameter", "given", "userinput"],
  ["output", "result", "return", "answer", "display", "print"],
  ["true", "yes", "correct", "valid", "1"],
  ["false", "no", "incorrect", "invalid", "wrong", "0"],

  // --- everyday wording a student actually uses in an exam answer --------
  // These carry no Computer Science meaning of their own, so folding them in
  // is safe and does most of the work of recognising a paraphrase.
  ["computer", "machine", "system", "device"],
  ["on", "switchedon", "poweredon", "turnedon", "started"],
  ["off", "switchedoff", "poweredoff", "turnedoff", "shutoff"],
  ["start", "starts", "starting", "begins", "boot", "boots", "booting"],
  ["load", "loads", "loading", "loaded", "copy", "copies", "bring"],
  ["run", "runs", "running", "execute", "executes", "execution", "perform", "performs", "work", "works"],
  ["show", "shows", "display", "displays", "print", "prints", "present", "presents"],
  ["give", "gives", "provide", "provides", "supply", "supplies", "offer", "offers"],
  ["big", "large", "bigger", "larger", "huge", "high", "higher"],
  ["small", "little", "smaller", "tiny", "low", "lower"],
  ["fast", "quick", "rapid", "speed", "speedup"],
  ["store", "stores", "stored", "keep", "keeps", "save", "saves", "hold", "holds", "retain", "retains"],
  ["send", "sends", "transmit", "transmits", "transfer", "transfers", "move", "moves"],
  ["get", "gets", "obtain", "obtains", "fetch", "fetches", "receive", "receives"],
  ["make", "makes", "create", "creates", "build", "builds", "produce", "produces", "generate", "generates"],
  ["check", "checks", "test", "tests", "examine", "examines", "verify", "verifies", "compare", "compares"],
  ["biggest", "largest", "highest", "maximum", "max", "most", "greatest"],
  ["smallest", "lowest", "minimum", "min", "least", "fewest"],
];

/** Multi-word surface forms that must survive as one idea. */
const PHRASE_FORMS: string[][] = [
  ["bootloader", "boot loader", "boot load program"],
  ["operating system", "os"],
  ["central processing unit", "cpu"],
  // "Working memory" is the everyday name for RAM, and students reach for it
  // far more often than the full term, so a correct answer was being marked as
  // having missed the point about where a running program lives.
  ["random access memory", "ram", "working memory"],
  ["read only memory", "rom"],
  ["hard disk drive", "hdd", "hard disk", "hard drive"],
  ["solid state drive", "ssd"],
  ["arithmetic logic unit", "alu"],
  ["control unit", "cu"],
  ["memory unit", "mu"],
  ["direct memory access", "dma"],
  ["basic input output system", "bios"],
  ["power on self test", "post"],
  ["liquid crystal display", "lcd"],
  ["light emitting diode", "led"],
  ["dynamic random access memory", "dram"],
  ["static random access memory", "sram"],
];

/**
 * Keys are stemmed at build time.
 *
 * The engine compares stemmed tokens, so an unstemmed key is dead weight: a
 * table entry for "contents" can never match, because by the time it is
 * compared the token has already become "cont". Every key and every canonical
 * form is therefore passed through the same stemmer the text layer uses.
 */
const key = (t: string): string => stem(t.replace(/-/g, " ").split(" ")[0]);

/** Canonical term -> all the ways students write it. Built once at module load. */
export const SYNONYMS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of [...SYNONYM_GROUPS, ...CONTENT_SYNONYMS, ...PHRASE_FORMS]) {
    const canonical = group[0];
    for (const term of group) {
      const existing = map.get(canonical) ?? [];
      if (!existing.includes(term)) existing.push(term);
      map.set(canonical, existing);
    }
  }
  return map;
})();

/**
 * Reverse index restricted to single-word forms, which is all a token-level
 * lookup can ever match. Multi-word entries used to live here too, where they
 * could never fire because no token equals "centralprocessingunit".
 */
export const CANONICAL: Map<string, string> = (() => {
  const rev = new Map<string, string>();
  for (const [canonical, forms] of SYNONYMS) {
    for (const f of [canonical, ...forms]) {
      if (f.includes(" ")) continue;
      const k = key(f);
      if (k && !rev.has(k)) rev.set(k, key(canonical));
    }
  }
  return rev;
})();

/**
 * Multi-word forms, matched as consecutive token sequences and collapsed to a
 * single canonical token before comparison. Keyed on space-joined tokens.
 *
 * The key parts are stemmed, because the tokens being searched are stemmed.
 * Keys used to hold the words as written, so a form with an inflected word
 * could never be found: the key said "working memory" while the token stream
 * said "work" and "memory", and the same was true of "operating system"
 * against "operat system". Those forms were registered but unreachable.
 */
export const PHRASE_CANONICAL: Map<string, string> = (() => {
  const map = new Map<string, string>();
  const phraseKey = (form: string) =>
    form
      .replace(/-/g, " ")
      .split(/\s+/)
      .map((part) => stem(part))
      .filter(Boolean)
      .join(" ");
  for (const [canonical, forms] of SYNONYMS) {
    const target = canonical.includes(" ")
      ? canonical.replace(/-/g, " ").replace(/\s+/g, " ").trim()
      : key(canonical);
    for (const f of forms) {
      if (!f.includes(" ")) continue;
      const k = phraseKey(f);
      if (k && !map.has(k)) map.set(k, target);
    }
  }
  return map;
})();

/**
 * Collapse multi-word phrases to their canonical token. Longest phrases are
 * replaced first so "arithmetic logic unit" is not shadowed by "logic unit".
 */
export function applyPhrases(tokens: string[]): string[] {
  if (PHRASE_CANONICAL.size === 0) return tokens;
  const byLength = [...PHRASE_CANONICAL.keys()].sort((a, b) => b.split(" ").length - a.split(" ").length);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let matched = false;
    for (const phrase of byLength) {
      const parts = phrase.split(" ");
      if (i + parts.length > tokens.length) continue;
      if (parts.every((p, j) => tokens[i + j] === p)) {
        out.push(PHRASE_CANONICAL.get(phrase)!);
        i += parts.length - 1;
        matched = true;
        break;
      }
    }
    if (!matched) out.push(tokens[i]);
  }
  return out;
}

/** Multi-word abbreviations worth expanding before comparison. */
export const ABBREVIATIONS: Record<string, string> = {
  cpu: "central processing unit",
  ram: "random access memory",
  rom: "read only memory",
  sram: "static random access memory",
  dram: "dynamic random access memory",
  hdd: "hard disk drive",
  ssd: "solid state drive",
  alu: "arithmetic logic unit",
  cu: "control unit",
  mu: "memory unit",
  os: "operating system",
  ic: "integrated circuit",
  ai: "artificial intelligence",
  usb: "universal serial bus",
  vdu: "visual display unit",
  lcd: "liquid crystal display",
  crt: "cathode ray tube",
  dma: "direct memory access",
  sql: "structured query language",
  pk: "primary key",
  fk: "foreign key",
  kb: "kilobyte",
  mb: "megabyte",
  gb: "gigabyte",
  tb: "terabyte",
  vhdl: "very high speed integrated circuit",
  post: "power on self test",
  ppi: "pixels per inch",
  ascii: "american standard code for information interchange",
  url: "uniform resource locator",
  ip: "internet protocol",
};

/**
 * Wrong-but-common beliefs. Each entry is checked against the student's answer
 * and, when it fires, the student is told exactly why it is wrong.
 *
 * `pattern` entries are regexes tested against the *normalised* answer.
 */
export interface Misconception {
  id: string;
  pattern: RegExp;
  says: string;
  truth: string;
}

export const MISCONCEPTIONS: Misconception[] = [
  {
    id: "ram-not-permanent",
    // The separator is [\s-] rather than \s so that "non-volatile" is caught:
    // "non\s*volatile" silently fails on a hyphen, which is how this rule
    // managed to miss the most common way students write it.
    // The gap may not cross another component. Without this lookahead, the
    // perfectly correct "RAM is volatile and ROM is non-volatile" matches,
    // because "non-volatile" is within 40 characters of "RAM" even though it
    // describes a different chip. The negation has to belong to the subject.
    pattern:
      /\b(ram)\b(?:(?!\b(rom|hdd|ssd|cd|dvd|cache|disk|drive)\b)[^.]){0,40}\b(permanent|non[\s-]*volatile|does not lose|never lose|retain)\b/i,
    says: "RAM cannot lose its data",
    truth:
      "RAM is volatile: it loses everything the moment power is cut. Only ROM, flash and disks are non-volatile. If the question contrasts RAM and ROM, that contrast is the whole point.",
  },
  {
    id: "rom-volatile",
    // The lookbehind stops this firing on the correct phrase "ROM is
    // non-volatile", where "volatile" is preceded by "non".
    pattern:
      /\b(rom)\b(?:(?!\b(ram|hdd|ssd|cd|dvd|cache|disk|drive)\b)[^.]){0,40}\b(?<!non[\s-])(volatile|temporary|transient|cleared|lose|lost)\b/i,
    says: "ROM is volatile, like RAM",
    truth:
      "The two are opposites here: RAM is volatile and loses its data when power is cut, while ROM is non-volatile and keeps its firmware. Swapping them is the single most common RAM/ROM error.",
  },
  {
    id: "rom-writable",
    pattern: /\b(rom)\b[^.]{0,40}\b(write|writeable|writable|used to save|store new)\b/i,
    says: "ROM is written to like RAM",
    truth:
      "ROM is read-mostly: it holds firmware that must not change, such as the BIOS. New data is never written to it during normal use.",
  },
  {
    id: "address-lines-linear",
    pattern: /\b(\d+)\s*(kb|mb|gb)\b[^.]{0,30}\b(\d+)\s*address\s*lines?\b/i,
    says: "The address-line count equals the number of address lines in the same units",
    truth:
      "Address lines are counted in powers of two: n address lines address 2^n locations. 10 lines address 1 KB, 20 lines address 1 MB. Never add units to line counts.",
  },
  {
    id: "cache-bigger",
    pattern: /\bcache\b[^.]{0,40}\b(larger|bigger|more)\b[^.]{0,20}\bthan\b[^.]{0,20}\bram\b/i,
    says: "Cache is larger than RAM",
    truth:
      "Cache is far smaller and far more expensive than RAM. Its speed, not its size, is the point: it holds recently used data so the CPU does not wait for slow RAM.",
  },
  {
    id: "cache-larger-than",
    pattern: /\bram\b[^.]{0,40}\b(smaller|larger|bigger|less|fewer)\b[^.]{0,20}\bthan\b[^.]{0,20}\bcache\b/i,
    says: "RAM is smaller than cache",
    truth:
      "The relationship is the other way round: cache is a small, fast slice of memory in front of a large, slow RAM. Compare size and speed together.",
  },
  {
    id: "alu-stores",
    pattern: /\balu\b[^.]{0,40}\b(stores|store|keep|retain|save)\b/i,
    says: "The ALU stores data",
    truth:
      "The ALU calculates. Storage is the job of the memory unit and registers. The Control Unit tells the ALU what to do.",
  },
  {
    id: "cu-calculates",
    pattern: /\b(control unit|cu)\b[^.]{0,40}\b(calculate|arithmetic|add|adds|compute|does the maths)\b/i,
    says: "The Control Unit does the arithmetic",
    truth:
      "The Control Unit fetches, decodes and directs. The ALU performs the arithmetic and logic.",
  },
  {
    id: "software-physical",
    pattern: /\bsoftware\b[^.]{0,30}\b(physical|hardware|tangible|can touch|is a part)\b/i,
    says: "Software is the physical part",
    truth:
      "Software is the set of programs and instructions — intangible. Hardware is the physical part you can touch.",
  },
  {
    id: "first-gen-transistor",
    pattern: /\b(first|1st|1)\s*(generation)?\b[^.]{0,40}\b(transistor|integrated circuit|microprocessor)\b/i,
    says: "The first generation used transistors",
    truth:
      "Generation order: vacuum tubes (1st), transistors (2nd), integrated circuits (3rd), microprocessors (4th), AI (5th).",
  },
  {
    id: "fifth-gen-microprocessor",
    pattern: /\b(fifth|5th|5)\s*(generation)?\b[^.]{0,40}\bmicroprocessor\b/i,
    says: "The fifth generation used the microprocessor",
    truth:
      "The microprocessor is the fourth generation. The fifth generation is defined by artificial intelligence and intelligent agents.",
  },
  {
    id: "secondary-in-cpu",
    pattern: /\b(secondary memory|hard disk|ssd)\b[^.]{0,30}\b(directly|accessible|immediately|fast access)\b[^.]{0,20}\bcpu\b/i,
    says: "The CPU accesses secondary memory directly",
    truth:
      "The CPU can address primary memory only. Data on a disk or SSD must first be loaded into RAM, which is why secondary storage is slower.",
  },
  {
    id: "kb-is-1000",
    pattern: /\b1\s*kb\b[^.]{0,20}\b(1000|one thousand)\b/i,
    says: "1 KB = 1000 bytes",
    truth:
      "In computing 1 KB = 2^10 = 1024 bytes, 1 MB = 1024 KB, 1 GB = 1024 MB. The 1000-based scale is used in storage marketing, not in computing.",
  },
  {
    id: "db-required-to-run",
    pattern: /\b(database|db)\b[^.]{0,40}\b(need|required|necessary|essential|must)\b[^.]{0,20}\bto (run|operate|use|work)\b/i,
    says: "A database is needed to run a computer",
    truth:
      "A database is a store of related data, not a requirement for running a computer. Even without one the OS, CPU and memory all work.",
  },

  // --- problem solving & computational thinking --------------------------
  // A symbol-shape mix-up is the classic flowchart error: the terminal box is
  // an oval, processing is a rectangle, decision is a diamond and I/O is a
  // parallelogram. When a student describes a flowchart symbol badly, the
  // correction names the exact shape so they can re-draw it.
  {
    id: "decision-is-rectangle",
    pattern: /\bdecision\b[^.]{0,30}\b(rectangle|rectangular|box shaped|a square)\b/i,
    says: "The decision symbol of a flowchart is a rectangle",
    truth:
      "The decision symbol is a diamond: one entry, one exit for 'yes' and one for 'no'. A rectangle is the processing symbol; a parallelogram is input/output; an oval is start/stop.",
  },
  {
    id: "flowchart-runs-on-computer",
    pattern: /\bflow ?chart\b[^.]{0,40}\b(execut|compil(ed|es)?|run (directly|by the computer)|automatical)\b/i,
    says: "A flowchart can be run directly by the computer",
    truth:
      "A flowchart is a diagram for people. It shows the algorithm, but no computer executes it — the algorithm must first be written in a programming language.",
  },
  {
    id: "algorithm-must-be-code",
    pattern: /\balgorithm\b[^.]{0,45}\b(must be|needs to be|only way)\b[^.]{0,20}\b(python|c\+\+|java|programming language|code|compiled)\b/i,
    says: "An algorithm has to be written in a programming language",
    truth:
      "An algorithm is just a sequence of steps in everyday language, pseudocode or a flowchart. Code is only one possible way to express it.",
  },
  {
    id: "pseudocode-is-language",
    pattern: /\bpseudo[\s-]?code\b[^.]{0,40}\b(language|compil|execut|run)\b/i,
    says: "Pseudocode is a programming language",
    truth:
      "Pseudocode is structured plain English for expressing an algorithm. It has no compiler and cannot run; it is a design step before real code.",
  },
  {
    id: "algorithm-is-answer",
    pattern: /\b(solve|solving)\b[^.]{0,40}\b(just|only)\b[^.]{0,20}\b(calculate|computed|the answer is)\b/i,
    says: "Solving a problem only means getting the answer",
    truth:
      "In computational thinking the answer itself is not the algorithm. The method — the step-by-step procedure — is what is marked, and it must be stated.",
  },
  {
    id: "decomposition-vs-abstraction",
    pattern: /\b(decomposition|decomposing)\b[^.]{0,30}\b(same as|same thing as|is called)\b[^.]{0,20}\babstraction\b/i,
    says: "Decomposition is the same as abstraction",
    truth:
      "They are different steps. Decomposition splits a big problem into smaller sub-problems; abstraction hides the irrelevant details of each one to focus on what matters.",
  },
  {
    id: "no-termination-check",
    pattern: /\ban? algorithm\b[^.]{0,50}\b(need not|does not (need to|have to)|need not always|must not)\b[^.]{0,20}\b(end|stop|terminate|finish)\b/i,
    says: "An algorithm does not have to end",
    truth:
      "Every algorithm must terminate: its steps are finite and stop after a fixed number of operations. An unending list of steps is not an algorithm.",
  },
];

/**
 * Opposite-meaning pairs, on the same normalised (stemmed) vocabulary the rest
 * of the engine uses.
 *
 * These let SNSAI tell the two most important situations apart:
 *   - the student never mentioned the idea      -> "missing"
 *   - the student used the idea but said it backwards -> "misconception"
 *
 * The second is far more valuable to teach from, and it is invisible to
 * keyword matching.
 */
export const ANTONYMS: Array<[string, string]> = [
  // Note: negated pairs such as volatile/non-volatile are deliberately absent.
  // "non-volatile" is two tokens after stemming, so it cannot be listed here as
  // a single opposite of "volatile". Those cases are handled by MISCONCEPTIONS,
  // which matches the phrase as written.
  //
  // A "read"/"write" pair was removed from this list. "Read only memory" is the
  // expansion of ROM, so the words "read" and "write" turn up in ordinary prose
  // about memory rather than about input and output, and the pair fired on
  // correct answers: asked to define firmware, an answer that described
  // software being *written* into ROM was reported as using the opposite term.
  // It even fired on the reference answer quoted back verbatim. The concept of
  // I/O direction is checked by the MISCONCEPTIONS patterns instead, which
  // match whole phrases and so cannot be triggered by an expansion.
  ["static", "dynamic"],
  ["faster", "slower"],
  ["larger", "smaller"],
  ["bigger", "smaller"],
  ["larger", "small"],
  ["more", "less"],
  ["increase", "decrease"],
  ["inside", "outsid"],
  ["primary", "secondary"],
  ["input", "output"],
  ["before", "after"],
  ["ascending", "descending"],
  ["ascend", "descend"],
  ["true", "false"],
  ["same", "differ"],
  ["parallel", "sequential"],
  ["concurrent", "sequential"],
  ["synchronous", "asynchronous"],
  ["loss", "gain"],
  ["lose", "gain"],
  ["maximum", "minimum"],
  ["upper", "lower"],
  ["include", "exclude"],
  ["accept", "reject"],
  ["allow", "deny"],
  ["uniprocessor", "multiprocessor"],
  ["singl", "multipl"],
  ["copied", "original"],
  ["cheap", "expensive"],
  ["lossless", "lossy"],
];

/** Convert every token to its canonical form when one is known. */
export function canonicalize(tokens: string[]): string[] {
  return applyPhrases(tokens).map((t) => CANONICAL.get(t) ?? t);
}
