/**
 * Every 3D scene in the Encoding Schemes course is built from the same small
 * object vocabulary in `scene.ts`. A scene is a pure function of the student's
 * controls, so dragging a control does not swap in a canned picture: the whole
 * model is rebuilt from the bits or number the student is actually exploring.
 */
import { box, COLORS, disc, line, text, type SceneObject, type SceneSpec, type Vec3 } from "./scene";

export type LearningState = {
  /** Most significant bit first. */
  bits: boolean[];
  decimal: number;
  base: 8 | 10 | 16;
  text: string;
};

export const INITIAL_STATE: LearningState = {
  bits: [true, false, true, true, false, true, false, true],
  decimal: 181,
  base: 16,
  text: "LEOU",
};

/** Render a register as 10110101 — never as "truefalse…". */
export const bitString = (bits: boolean[]): string =>
  bits.map((on) => (on ? "1" : "0")).join("");

export const bitValue = (bits: boolean[]): number =>
  bits.reduce((sum, on, i) => sum + (on ? 2 ** (bits.length - 1 - i) : 0), 0);

export const toBits = (value: number, width: number): boolean[] =>
  Array.from({ length: width }, (_, i) => Boolean((Math.floor(value) >> (width - 1 - i)) & 1));

const HEX = "0123456789ABCDEF";

export const digitChar = (value: number): string =>
  value < 10 ? String(value) : HEX[value - 10] ?? "?";

/** Group a bit string from the right; the first group may be shorter. */
export const groupBits = (bits: boolean[], size: number): boolean[][] => {
  const groups: boolean[][] = [];
  for (let end = bits.length; end > 0; end -= size) groups.unshift(bits.slice(Math.max(0, end - size), end));
  return groups;
};

export const groupValue = (bits: boolean[]): number => bitValue(bits);

export type DivStep = { value: number; quotient: number; remainder: number; digit: string };

/** Repeated-division steps, in the order a student writes them top to bottom. */
export const divisionSteps = (value: number, base: number): DivStep[] => {
  const steps: DivStep[] = [];
  let n = Math.max(0, Math.floor(value));
  if (n === 0) steps.push({ value: 0, quotient: 0, remainder: 0, digit: "0" });
  while (n > 0) {
    const quotient = Math.floor(n / base);
    const remainder = n % base;
    steps.push({ value: n, quotient, remainder, digit: digitChar(remainder) });
    n = quotient;
  }
  return steps;
};

/** A register of cubes, labelled with powers of two underneath. */
function bitRegister(objects: SceneObject[], bits: boolean[], opts: {
  x?: number; y?: number; z?: number; pitch?: number; showWeights?: boolean; id?: string;
}) {
  const { x = 0, y = 1.6, z = 0, pitch = 1.05, showWeights = true, id = "reg" } = opts;
  const start = x - ((bits.length - 1) * pitch) / 2;
  bits.forEach((on, i) => {
    const px = start + i * pitch;
    objects.push(
      box(`${id}-cube-${i}`, [px, y, z], [0.86, 0.86, 0.86], on ? COLORS.on : COLORS.off, {
        top: on ? COLORS.onTop : COLORS.offTop,
        glow: on ? 0.55 : 0,
        face: on ? "1" : "0",
      }),
      text(`${id}-bit-${i}`, [px, y + 0.9, z], on ? "1" : "0", {
        color: on ? COLORS.onTop : COLORS.faint, size: 0.42, bold: true,
      }),
    );
    if (showWeights) {
      objects.push(
        line(`${id}-stem-${i}`, [px, y - 0.5, z], [px, y - 1.05, z], { color: COLORS.guide }),
        text(`${id}-weight-${i}`, [px, y - 1.35, z], String(2 ** (bits.length - 1 - i)), {
          color: COLORS.faint, size: 0.34,
        }),
      );
    }
  });
  return { start, pitch };
}

/** A repeated-division ladder drawn as three-deep steps. */
function divisionLadder(objects: SceneObject[], value: number, base: number, id: string) {
  const steps = divisionSteps(value, base);
  steps.forEach((s, i) => {
    const z = 2.2 - i * 1.45;
    const fade = 1 - i * 0.045;
    objects.push(
      box(`${id}-val-${i}`, [-2.4, 1.3 - i * 0.12, z], [1.35, 0.85, 0.85], COLORS.off, {
        top: COLORS.offTop, face: String(s.value),
      }),
      text(`${id}-div-${i}`, [-1.05, 1.3 - i * 0.12, z], `÷ ${base}`, { color: COLORS.warm, size: 0.36 }),
      box(`${id}-q-${i}`, [0.55, 1.3 - i * 0.12, z], [1.35, 0.85, 0.85], COLORS.digit, {
        top: COLORS.digitTop, face: String(s.quotient), opacity: Math.max(0.35, fade),
      }),
      text(`${id}-rem-${i}`, [1.9, 1.3 - i * 0.12, z], `r = ${s.digit}`, {
        color: s.remainder === 0 ? COLORS.faint : COLORS.on, size: 0.38, bold: true,
      }),
    );
    if (i < steps.length - 1) {
      objects.push(line(`${id}-flow-${i}`, [0.55, 0.7 - i * 0.12, z], [0.55, 1.3 - (i + 1) * 0.12, z - 1.45], {
        color: COLORS.guide,
      }));
    }
  });
  const answer = steps.map((s) => s.digit).reverse().join("");
  objects.push(
    text(`${id}-answer`, [3.5, 1.9, -0.8], `${answer}₍${base}₎`, { color: COLORS.on, size: 0.55, bold: true }),
    text(`${id}-read`, [3.5, 1.3, -0.8], "read ↑", { color: COLORS.faint, size: 0.32 }),
  );
}

const A = COLORS.on;
const B = COLORS.digit;

function sceneBits(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  bitRegister(objects, s.bits, { y: 1.1, id: "bits" });
  const on = s.bits.filter(Boolean).length;
  objects.push(
    text("title", [0, 3.5, -1], "8 switches · one byte", { color: COLORS.ink, size: 0.62, bold: true }),
    text("count", [0, -2.1, 0], `${on} on / ${s.bits.length - on} off  ·  2^${s.bits.length} = ${2 ** s.bits.length} patterns`, {
      color: COLORS.faint, size: 0.36,
    }),
  );
  return { objects, floor: true, caption: "Each cube is one bit. Flip a switch below and watch the byte change." };
}

function sceneRadix(): SceneSpec {
  const objects: SceneObject[] = [];
  const bases = [
    { base: 2, digits: "1011", color: A },
    { base: 8, digits: "2753", color: B },
    { base: 10, digits: "8094", color: COLORS.warm },
    { base: 16, digits: "A3F1", color: COLORS.sign },
  ];
  bases.forEach((b, i) => {
    const x = -4.5 + i * 3;
    b.digits.split("").forEach((ch, j) => {
      objects.push(
        box(`tower-${i}-${j}`, [x, -0.7 + j * 1.1, 0], [1.25, 0.85, 1.25], b.color, {
          top: COLORS.digitTop, face: ch,
        }),
      );
    });
    objects.push(
      text(`base-${i}`, [x, 3.35, 0], `base ${b.base}`, { color: b.color, size: 0.48, bold: true }),
      text(`digits-${i}`, [x, -2, 0], b.base === 2 ? "0 1" : b.base === 8 ? "0…7" : b.base === 10 ? "0…9" : "0…F", {
        color: COLORS.faint, size: 0.32,
      }),
    );
  });
  return { objects, floor: true, caption: "A base is the number of symbols a position can hold. Higher bases fit more into each digit." };
}

function sceneWeights(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  bitRegister(objects, s.bits, { y: 1, id: "weights" });
  const value = bitValue(s.bits);
  objects.push(
    text("value", [0, 3.3, -1], `${bitString(s.bits)}₂  =  ${value}₁₀`, { color: COLORS.on, size: 0.6, bold: true }),
    text("rule", [0, -2.3, 0], "value = Σ (bit × 2^position)", { color: COLORS.faint, size: 0.34 }),
  );
  s.bits.forEach((on, i) => {
    if (on) objects.push(line(`lit-${i}`, [0, 0.1, 0], [0, -0.1, 0], { color: COLORS.on }));
  });
  return { objects, floor: true, caption: "Position is power. The leftmost cube of a byte is worth 128; the rightmost is worth 1." };
}

function sceneToDecimal(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  bitRegister(objects, s.bits, { y: 1.8, z: -2.2, id: "src" });
  let running = 0;
  const active = s.bits.map((on, i) => ({ on, weight: 2 ** (s.bits.length - 1 - i) })).filter((b) => b.on);
  const start = -((active.length - 1) * 1.4) / 2;
  active.forEach((b, i) => {
    running += b.weight;
    const x = start + i * 1.4;
    objects.push(
      disc(`spark-${i}`, [x, 0.7, 0.4], 0.28, COLORS.on, 0.75),
      text(`add-${i}`, [x, 0.1, 0.4], `+${b.weight}`, { color: COLORS.onTop, size: 0.36 }),
      line(`path-${i}`, [x, 1.2, -2.2], [x, 0.9, 0.4], { color: COLORS.guide, dashed: true }),
    );
  });
  objects.push(
    box("sum", [0, -1.4, 0.8], [3.6, 1.15, 1.2], COLORS.digit, { top: COLORS.digitTop, face: String(running), glow: 0.4 }),
    text("sum-cap", [0, -2.35, 0.8], "decimal total", { color: COLORS.faint, size: 0.32 }),
    text("head", [0, 3.5, -1.5], "binary → decimal", { color: COLORS.ink, size: 0.55, bold: true }),
  );
  return { objects, floor: true, caption: "Only lit cubes contribute. Add their weights to get the decimal value." };
}

function sceneToBinary(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  divisionLadder(objects, Math.min(255, s.decimal), 2, "divbin");
  objects.push(text("head", [0, 3.7, 2.2], `${s.decimal}₁₀  →  binary`, { color: COLORS.ink, size: 0.55, bold: true }));
  return { objects, floor: true, caption: "Divide by 2, keep the remainder, and read the remainders from the bottom upwards." };
}

function sceneOctal(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const bits = [...Array(Math.max(0, 9 - s.bits.length)).fill(false), ...s.bits].slice(-9);
  const groups = groupBits(bits, 3);
  groups.forEach((g, i) => {
    const x = -3.2 + i * 3.2;
    g.forEach((on, j) => {
      objects.push(
        box(`o-${i}-${j}`, [x + (j - 1) * 0.95, 1, 0], [0.78, 0.78, 0.78], on ? A : COLORS.off, {
          top: on ? COLORS.onTop : COLORS.offTop, face: on ? "1" : "0", glow: on ? 0.4 : 0,
        }),
      );
    });
    objects.push(
      line(`brace-${i}`, [x - 1.45, 0.35, 0], [x + 1.45, 0.35, 0], { color: COLORS.guide }),
      line(`arrow-${i}`, [x, 0.45, 0], [x, 1.95, 0], { color: COLORS.guide }),
      box(`digit-${i}`, [x, 2.65, 0], [1.1, 1.1, 1.1], B, {
        top: COLORS.digitTop, face: digitChar(groupValue(g)),
      }),
    );
  });
  objects.push(
    text("head", [0, 4.1, -1], "3 bits → 1 octal digit  (2³ = 8)", { color: COLORS.ink, size: 0.5, bold: true }),
    text("answer", [0, -1.7, 0.6], `${groups.map(groupValue).join("")}₈`, { color: A, size: 0.55, bold: true }),
  );
  return { objects, floor: true, caption: "Start at the right, make groups of three, and turn each group into one octal digit." };
}

function sceneHex(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const groups = groupBits(s.bits, 4);
  groups.forEach((g, i) => {
    const x = -2.1 + i * 4.2;
    g.forEach((on, j) => {
      objects.push(
        box(`h-${i}-${j}`, [x + (j - 1.5) * 0.95, 1, 0], [0.76, 0.76, 0.76], on ? A : COLORS.off, {
          top: on ? COLORS.onTop : COLORS.offTop, face: on ? "1" : "0", glow: on ? 0.4 : 0,
        }),
      );
    });
    objects.push(
      line(`brace-${i}`, [x - 1.95, 0.35, 0], [x + 1.95, 0.35, 0], { color: COLORS.guide }),
      line(`arrow-${i}`, [x, 0.45, 0], [x, 1.9, 0], { color: COLORS.guide }),
      box(`nibble-${i}`, [x, 2.6, 0], [1.2, 1.2, 1.2], COLORS.warm, {
        top: COLORS.warmTop, face: digitChar(groupValue(g)),
      }),
      text(`nlabel-${i}`, [x, 3.45, 0], "nibble", { color: COLORS.faint, size: 0.3 }),
    );
  });
  objects.push(
    text("head", [0, 4.35, -1], "4 bits → 1 hex digit  (2⁴ = 16)", { color: COLORS.ink, size: 0.5, bold: true }),
    text("answer", [0, -1.5, 0.6], `0x${groups.map(groupValue).map(digitChar).join("")}`, { color: COLORS.warm, size: 0.55, bold: true }),
  );
  return { objects, floor: true, caption: "A nibble is four bits. Hex writes each nibble with one symbol: 0–9 then A–F." };
}

function sceneBridges(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const groupSize = s.base === 8 ? 3 : 4;
  const groups = groupBits(s.bits, groupSize);
  const digits = groups.map(groupValue).map(digitChar);
  groups.forEach((g, i) => {
    const y = 1.7 - i * 1.4;
    g.forEach((on, j) => {
      objects.push(box(`b-${i}-${j}`, [-4.5 + j * 0.85, y, 0], [0.62, 0.62, 0.62], on ? A : COLORS.off, {
        top: on ? COLORS.onTop : COLORS.offTop, face: on ? "1" : "0", glow: on ? 0.35 : 0,
      }));
    });
    objects.push(
      line(`bridge-${i}`, [-2.4, y, 0], [2.6, y, 0], { color: COLORS.guide, dashed: true }),
      disc(`node-${i}`, [2.9, y, 0], 0.16, COLORS.on, 0.8),
      box(`out-${i}`, [4.2, y, 0], [1.1, 1.1, 1.1], s.base === 8 ? B : COLORS.warm, {
        top: s.base === 8 ? COLORS.digitTop : COLORS.warmTop, face: digits[i] ?? "0",
      }),
    );
  });
  objects.push(
    text("head", [0, 3.7, -1], `binary ⇄ ${s.base === 8 ? "octal" : "hexadecimal"}`, { color: COLORS.ink, size: 0.55, bold: true }),
    text("result", [0, -2.2, 0.8], `${bitString(s.bits)}₂  =  ${digits.join("")}${s.base === 8 ? "₈" : "₁₆"}`, {
      color: s.base === 8 ? B : COLORS.warm, size: 0.48, bold: true,
    }),
  );
  return { objects, floor: true, caption: "The bridge works both ways: regroup the bits to convert, no decimal arithmetic needed." };
}

function sceneDivisions(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  divisionLadder(objects, Math.min(4095, s.decimal), s.base, "divgen");
  objects.push(text("head", [0, 3.7, 2.2], `${s.decimal}₁₀  →  base ${s.base}`, { color: COLORS.ink, size: 0.55, bold: true }));
  return { objects, floor: true, caption: `Keep dividing by ${s.base}. The digits are the remainders read in reverse.` };
}

function sceneBcd(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const digits = String(Math.min(9999, Math.max(0, s.decimal))).padStart(4, "0").split("");
  const pure = toBits(Math.min(255, s.decimal), 8);
  digits.forEach((d, i) => {
    const x = -3.2 + i * 2.15;
    objects.push(
      box(`dec-${i}`, [x, 2.7, -0.8], [1.2, 1.2, 1.2], COLORS.warm, { top: COLORS.warmTop, face: d }),
      text(`declab-${i}`, [x, 3.55, -0.8], "decimal digit", { color: COLORS.faint, size: 0.27 }),
    );
    toBits(Number(d), 4).forEach((on, j) => {
      objects.push(box(`bcd-${i}-${j}`, [x + (j - 1.5) * 0.5, 0.9, -0.8], [0.42, 0.5, 0.42], on ? A : COLORS.off, {
        top: on ? COLORS.onTop : COLORS.offTop, glow: on ? 0.3 : 0,
      }));
    });
  });
  bitRegister(objects, pure, { y: -1.7, z: 0.4, pitch: 0.78, id: "pure", showWeights: false });
  objects.push(
    line("sep", [-5, 0.1, 0.2], [5, 0.1, 0.2], { color: COLORS.guide }),
    text("bcdlab", [-4.6, 1.85, -0.8], "BCD: 4 bits per decimal digit", { color: A, size: 0.38 }),
    text("binlab", [-4.6, -0.75, 0.4], "pure binary: 8 bits for the whole number", { color: B, size: 0.38 }),
  );
  return { objects, floor: true, caption: "BCD keeps each decimal digit separate — easy to display, wasteful to calculate with." };
}

function sceneSigned(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const n = Math.min(127, Math.max(-128, bitValue(s.bits.slice(1))));
  const negative = s.bits[0] ?? false;
  const value = negative ? -n : n;
  const flipped = s.bits.map((b) => !b);
  const plusOne = toBits((bitValue(flipped) + 1) & 255, 8);
  bitRegister(objects, s.bits, { y: 2.3, z: -1.5, pitch: 0.9, id: "orig", showWeights: false });
  bitRegister(objects, flipped, { y: 0.4, z: 0, pitch: 0.9, id: "flip", showWeights: false });
  bitRegister(objects, plusOne, { y: -1.5, z: 1.5, pitch: 0.9, id: "twos", showWeights: false });
  objects.push(
    box("signcube", [-3.15, 2.3, -1.5], [0.95, 0.95, 0.95], COLORS.sign, { top: COLORS.signTop, face: "S", glow: 0.5 }),
    text("signlab", [-3.15, 3.2, -1.5], "sign bit", { color: COLORS.sign, size: 0.34, bold: true }),
    text("row1", [3.4, 2.3, -1.5], `original → ${value}`, { color: COLORS.faint, size: 0.36 }),
    text("row2", [3.4, 0.4, 0], "flip every bit", { color: B, size: 0.34 }),
    text("row3", [3.4, -1.5, 1.5], "+ 1 → two's complement", { color: COLORS.ok, size: 0.34 }),
    text("head", [0, 4.2, -1], "signed numbers in 8 bits", { color: COLORS.ink, size: 0.55, bold: true }),
  );
  return { objects, floor: true, caption: "The leftmost bit carries the sign. Two's complement negates by flipping every bit and adding one." };
}

function sceneEncoding(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const chars = (s.text || "LEOU").slice(0, 6).toUpperCase().split("");
  chars.forEach((ch, i) => {
    const code = ch.charCodeAt(0);
    const x = -3.2 + i * 1.3;
    objects.push(
      box(`char-${i}`, [x, 2.4, -0.8], [1, 1, 1], COLORS.digit, { top: COLORS.digitTop, face: ch }),
      text(`code-${i}`, [x, 1.45, -0.8], `${code} / ${code.toString(16).toUpperCase()}`, { color: COLORS.faint, size: 0.28 }),
    );
  });
  const rgb = [0x22, 0xd3, 0xee];
  ["R", "G", "B"].forEach((c, i) => {
    const x = -2.6 + i * 2.6;
    objects.push(
      box(`rgb-${i}`, [x, -0.9, 0.7], [1.6, 1.9, 1.1], [COLORS.sign, COLORS.ok, A][i] ?? A, {
        top: COLORS.digitTop, face: c,
      }),
      text(`rgbv-${i}`, [x, -2.2, 0.7], `${c} = ${rgb[i]?.toString(16).toUpperCase().padStart(2, "0")}`, { color: COLORS.faint, size: 0.3 }),
    );
  });
  objects.push(
    disc("swatch", [3.6, -0.9, 0.7], 0.85, "#22D3EE"),
    text("hex", [0, 4.1, -1], "#22D3EE  =  (34, 211, 238)", { color: COLORS.on, size: 0.45, bold: true }),
    text("swatchlab", [3.6, -2.2, 0.7], "colour", { color: COLORS.faint, size: 0.3 }),
  );
  return { objects, floor: true, caption: "Encoding is not only numbers: text and colour are numbers too, once you agree on the code." };
}

function sceneParity(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const bits = s.bits.slice(0, 7);
  bitRegister(objects, bits, { y: 1.6, z: -1, pitch: 0.92, id: "par" });
  const ones = bits.filter(Boolean).length;
  const parity = ones % 2 === 0 ? 0 : 1;
  objects.push(
    line("divide", [3.6, 0.6, -1], [3.6, 2.6, -1], { color: COLORS.guide }),
    box("parity-cube", [4.7, 1.6, -1], [1.05, 1.05, 1.05], parity ? COLORS.warm : COLORS.ok, {
      top: parity ? COLORS.warmTop : COLORS.ok, face: String(parity), glow: 0.4,
    }),
    text("parlab", [4.7, 2.7, -1], "parity bit", { color: COLORS.faint, size: 0.3 }),
    text("head", [0, 3.6, -1], `${ones} ones → parity bit ${parity} (even parity)`, { color: COLORS.ink, size: 0.44, bold: true }),
    text("foot", [0, -1.9, 0.5], "total number of 1s is always even", { color: COLORS.faint, size: 0.34 }),
  );
  return { objects, floor: true, caption: "A parity bit adds just enough 1s to make the count even — enough to spot a single flipped bit." };
}

function sceneMap(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const nodes: { id: string; label: string; pos: Vec3; color: string }[] = [
    { id: "dec", label: "DECIMAL", pos: [-3.5, 2, -2], color: COLORS.warm },
    { id: "bin", label: "BINARY", pos: [3.5, 2, -2], color: A },
    { id: "oct", label: "OCTAL", pos: [-3.5, -1.6, 1.6], color: B },
    { id: "hex", label: "HEX", pos: [3.5, -1.6, 1.6], color: COLORS.sign },
  ];
  nodes.forEach((n) => {
    objects.push(box(`node-${n.id}`, n.pos, [2.15, 1.15, 1.15], n.color, { top: COLORS.digitTop, face: n.label, glow: 0.35 }));
  });
  const pairs: [string, string][] = [["dec", "bin"], ["dec", "oct"], ["dec", "hex"], ["bin", "oct"], ["bin", "hex"], ["oct", "hex"]];
  pairs.forEach(([from, to], i) => {
    const a = nodes.find((n) => n.id === from)!.pos;
    const b = nodes.find((n) => n.id === to)!.pos;
    objects.push(line(`edge-${i}`, a, b, { color: COLORS.guide, dashed: i > 2 }));
  });
  const groups = groupBits(s.bits, 4).map(groupValue).map(digitChar).join("");
  objects.push(
    text("center", [0, 0.2, 0], "×2  ÷2   ×8  ÷8   ×16  ÷16", { color: COLORS.ink, size: 0.42, bold: true }),
    text("sample", [0, -3, 1.5], `today's byte: ${bitString(s.bits)}₂ = ${bitValue(s.bits)}₁₀ = 0x${groups}`, {
      color: COLORS.faint, size: 0.36,
    }),
  );
  return { objects, floor: true, caption: "Pick a route on the map. Some conversions group bits; others divide repeatedly." };
}

/** A compact row of calculation boxes (A, B, carry, result) used by arithmetic scenes. */
function calcRow(objects: SceneObject[], id: string, bits: number[], y: number, color: string, label: string) {
  objects.push(text(`${id}-lab`, [-5.2, y, 0], label, { color, size: 0.34, bold: true, align: "left" }));
  bits.forEach((b, i) => {
    objects.push(box(`${id}-${i}`, [-3.3 + i * 0.95, y, 0], [0.72, 0.72, 0.72], b ? color : COLORS.off, {
      top: b ? COLORS.digitTop : COLORS.offTop, face: String(b), glow: b ? 0.28 : 0,
    }));
  });
}

/** Why a switch makes a reliable bit: two wide voltage bands. */
function scenePhysics(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const bits = s.bits.slice(0, 6);
  objects.push(
    line("high-rail", [-4.3, 2.7, -0.6], [4.3, 2.7, -0.6], { color: COLORS.on, width: 2.4 }),
    line("low-rail", [-4.3, -1.9, -0.6], [4.3, -1.9, -0.6], { color: COLORS.dim, width: 2.4 }),
    text("high-lab", [0, 3.3, -0.6], "HIGH ≈ 5 V  →  1", { color: COLORS.on, size: 0.44, bold: true }),
    text("low-lab", [0, -2.5, -0.6], "LOW ≈ 0 V  →  0", { color: COLORS.faint, size: 0.4 }),
  );
  bits.forEach((on, i) => {
    const x = -2.9 + i * 1.16;
    objects.push(
      line(`wt-${i}`, [x, 2.7, -0.6], [x, 1.25, -0.6], { color: COLORS.guide }),
      line(`wb-${i}`, [x, -1.9, -0.6], [x, -0.85, -0.6], { color: COLORS.guide }),
      box(`sw-${i}`, [x, 0.2, -0.6], [0.9, 1.2, 0.9], on ? COLORS.on : COLORS.off, {
        top: on ? COLORS.onTop : COLORS.offTop, face: on ? "1" : "0", glow: on ? 0.6 : 0,
      }),
      text(`vol-${i}`, [x, -0.72, -0.6], on ? "5 V" : "0 V", { color: on ? COLORS.onTop : COLORS.faint, size: 0.3 }),
    );
  });
  objects.push(
    disc("noise", [-0.58, 0.2, 0.1], 0.26, COLORS.warm, 0.55),
    text("noiselab", [1.5, 0.95, 0.1], "small wobble", { color: COLORS.warm, size: 0.3 }),
    text("head", [0, 4.2, -1], "two wide voltage bands make a reliable bit", { color: COLORS.ink, size: 0.5, bold: true }),
  );
  return { objects, floor: true, caption: "A transistor is just a switch. Because the two voltage bands are far apart, tiny electrical noise cannot turn a 0 into a 1." };
}

/** Column-by-column binary addition with carries. */
function sceneAdd(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const a = s.bits.map((b) => (b ? 1 : 0));
  const b = toBits(45, 8).map((x) => (x ? 1 : 0));
  const carry: number[] = [];
  const sum: number[] = [];
  let c = 0;
  for (let i = 7; i >= 0; i--) {
    carry[i] = c;
    const total = a[i]! + b[i]! + c;
    sum[i] = total % 2;
    c = Math.floor(total / 2);
  }
  calcRow(objects, "a", a, 2.35, COLORS.on, "A");
  calcRow(objects, "b", b, 1.05, COLORS.digit, "B");
  calcRow(objects, "carry", carry, -0.25, COLORS.warm, "carry");
  calcRow(objects, "sum", sum, -1.55, COLORS.ok, "A+B");
  objects.push(
    text("head", [0, 3.95, -1], `${bitValue(a.map(Boolean))} + ${bitValue(b.map(Boolean))} = ${bitValue(sum.map(Boolean))}`, {
      color: COLORS.ink, size: 0.5, bold: true,
    }),
    text("fin", [4.7, -0.25, 0], c ? `carry out = ${c}` : "no carry out", { color: COLORS.warm, size: 0.32 }),
  );
  return { objects, floor: true, caption: "Work from the right. 1 + 1 writes 0 and carries 1 into the next column — exactly like decimal carries at ten." };
}

/** Subtraction as addition of the two's complement. */
function sceneSubtract(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const a = s.bits.map((b) => (b ? 1 : 0));
  const aVal = bitValue(s.bits);
  const b = toBits(5, 8).map((x) => (x ? 1 : 0));
  const negB = toBits((~bitValue(b.map(Boolean)) + 1) & 255, 8).map((x) => (x ? 1 : 0));
  const result = toBits((aVal + bitValue(negB.map(Boolean))) & 255, 8).map((x) => (x ? 1 : 0));
  calcRow(objects, "a", a, 2.35, COLORS.on, "A");
  calcRow(objects, "b", b, 1.05, COLORS.digit, "B = 5");
  calcRow(objects, "neg", negB, -0.25, COLORS.warm, "−B (2's comp)");
  calcRow(objects, "res", result, -1.55, COLORS.ok, "A−B");
  objects.push(text("head", [0, 3.95, -1], `${aVal} − 5 = ${bitValue(result.map(Boolean))}  (8-bit, carry discarded)`, {
    color: COLORS.ink, size: 0.46, bold: true,
  }));
  return { objects, floor: true, caption: "To subtract, flip the bits of B, add one, then add to A. The final carry is thrown away to keep eight bits." };
}

/** Shifting a binary number multiplies or divides by two. */
function sceneShift(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const a = s.bits.map((b) => (b ? 1 : 0));
  const left = [...a.slice(1), 0];
  const right = [0, ...a.slice(0, 7)];
  calcRow(objects, "left", left, 2.35, COLORS.on, "×2 (<<1)");
  calcRow(objects, "mid", a, 0.4, COLORS.digit, "original");
  calcRow(objects, "right", right, -1.55, COLORS.warm, "÷2 (>>1)");
  objects.push(
    text("head", [0, 3.95, -1], `${bitValue(a.map(Boolean))} → left ${bitValue(left.map(Boolean))} · right ${bitValue(right.map(Boolean))}`, {
      color: COLORS.ink, size: 0.46, bold: true,
    }),
  );
  return { objects, floor: true, caption: "Every shift left doubles the value; every shift right halves it (dropping the remainder). Shift by n bits for ×2ⁿ." };
}

/** Fractional binary weights that halve after the point. */
function sceneFractions(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const frac = s.bits.slice(0, 6);
  let total = 0;
  frac.forEach((on, i) => {
    const x = -3.3 + i * 1.35;
    const weight = 2 ** (-(i + 1));
    if (on) total += weight;
    objects.push(
      box(`fr-${i}`, [x, 1.1, 0], [0.85, 0.85, 0.85], on ? COLORS.on : COLORS.off, {
        top: on ? COLORS.onTop : COLORS.offTop, face: on ? "1" : "0", glow: on ? 0.4 : 0,
      }),
      line(`fp-${i}`, [x, 0.6, 0], [x, -0.4, 0], { color: COLORS.guide }),
      text(`fw-${i}`, [x, -0.75, 0], `1/${2 ** (i + 1)}`, { color: COLORS.faint, size: 0.32 }),
    );
  });
  objects.push(
    text("point", [-4.4, 1.1, 0], "0.", { color: COLORS.ink, size: 0.5, bold: true }),
    text("head", [0, 3.5, -1], "after the point the weights halve", { color: COLORS.ink, size: 0.5, bold: true }),
    text("ans", [0, -1.9, 0.6], `0.${frac.map((b) => (b ? "1" : "0")).join("")}₂ = ${total.toFixed(4)}₁₀`, {
      color: COLORS.on, size: 0.5, bold: true,
    }),
  );
  return { objects, floor: true, caption: "Binary fractions work like decimal fractions: the first place after the point is 1/2, then 1/4, 1/8 and so on." };
}

/** Sign, exponent and mantissa — scientific notation in binary. */
function sceneFloat(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const value = Math.min(1023, s.decimal) + 0.5;
  const exponent = Math.floor(Math.log2(value));
  const fraction = value / 2 ** exponent - 1;
  let bitsStr = "";
  let rem = fraction;
  for (let i = 0; i < 6; i++) {
    rem *= 2;
    const bit = rem >= 1 ? 1 : 0;
    bitsStr += bit;
    rem -= bit;
  }
  const parts = [
    { id: "s", label: "SIGN", face: "0", color: COLORS.sign, w: 1.5, x: -4.4 },
    { id: "e", label: "EXPONENT", face: String(exponent + 127), color: COLORS.digit, w: 2.5, x: -0.9 },
    { id: "m", label: "MANTISSA", face: `1.${bitsStr}`, color: COLORS.on, w: 3.8, x: 3.4 },
  ];
  parts.forEach((part) => {
    objects.push(
      box(`fl-${part.id}`, [part.x, 1.1, 0], [part.w, 1.7, 1.2], part.color, { top: COLORS.digitTop, face: part.face, glow: 0.35 }),
      text(`fll-${part.id}`, [part.x, 2.5, 0], part.label, { color: part.color, size: 0.36, bold: true }),
    );
  });
  objects.push(
    text("head", [0, 4.1, -1], "value = (−1)^sign × 1.mantissa × 2^(exponent − 127)", { color: COLORS.ink, size: 0.4, bold: true }),
    text("note", [0, -1.7, 0.6], `${value} = 1.${bitsStr}₂ × 2^${exponent}   →   exponent stored as ${exponent + 127} (biased)`, {
      color: COLORS.faint, size: 0.36,
    }),
  );
  return { objects, floor: true, caption: "A float is binary scientific notation in three fields: a sign bit, a biased exponent and the mantissa's fractional bits." };
}

/** Bits, bytes and the binary memory prefixes. */
function sceneUnits(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const units = [
    { id: "bit", label: "bit", bytes: "0 or 1", size: 0.9, color: COLORS.on, x: -5.1 },
    { id: "byte", label: "byte", bytes: "8 bits", size: 1.3, color: COLORS.digit, x: -2.6 },
    { id: "kib", label: "KiB", bytes: "1024 B", size: 1.9, color: COLORS.warm, x: 0.4 },
    { id: "mib", label: "MiB", bytes: "1024 KiB", size: 2.5, color: COLORS.sign, x: 3.9 },
  ];
  units.forEach((u) => {
    objects.push(
      box(`u-${u.id}`, [u.x, 0.1, 0], [u.size, u.size, u.size], u.color, { top: COLORS.digitTop, face: u.label, glow: 0.3 }),
      text(`ul-${u.id}`, [u.x, 0.1 + u.size / 2 + 0.55, 0], u.bytes, { color: COLORS.faint, size: 0.3 }),
    );
  });
  objects.push(
    text("head", [0, 3.6, -1], "counting in powers of two", { color: COLORS.ink, size: 0.5, bold: true }),
    text("foot", [0, -2.2, 0.6], `your byte: ${bitString(s.bits)} = ${bitValue(s.bits)} different patterns`, { color: COLORS.faint, size: 0.36 }),
  );
  return { objects, floor: true, caption: "8 bits make a byte; 1024 bytes make a kibibyte (KiB), then MiB, GiB… powers of two, not powers of ten." };
}

/** Adding two hexadecimal bytes, digit by digit. */
function sceneHexMath(s: LearningState): SceneSpec {
  const objects: SceneObject[] = [];
  const a = Math.min(255, s.decimal);
  const b = 31;
  const sum = (a + b) & 255;
  const hex = (n: number) => `${digitChar((n >> 4) & 15)}${digitChar(n & 15)}`;
  const row = (id: string, value: number, y: number, color: string, label: string) => {
    objects.push(text(`${id}-lab`, [-4.4, y, 0], label, { color, size: 0.36, bold: true, align: "left" }));
    hex(value).split("").forEach((ch, i) => {
      objects.push(box(`${id}-${i}`, [-2.4 + i * 1.6, y, 0], [1.2, 1.2, 1.2], color, {
        top: COLORS.digitTop, face: ch, glow: 0.3,
      }));
    });
  };
  row("a", a, 2.2, COLORS.on, "A");
  row("b", b, 0.7, COLORS.digit, "B");
  row("r", sum, -0.8, COLORS.ok, "A+B");
  objects.push(
    text("head", [0, 3.9, -1], `0x${hex(a)} + 0x${hex(b)} = 0x${hex(sum)}`, { color: COLORS.ink, size: 0.48, bold: true }),
    text("foot", [0, -2.2, 0.6], "carry when a column reaches 16, not 10", { color: COLORS.faint, size: 0.34 }),
  );
  return { objects, floor: true, caption: "Hex addition is decimal addition with a different carrying point: a column carries when it reaches sixteen." };
}

export type SceneKind =
  | "bits" | "radix" | "weights" | "toDecimal" | "toBinary" | "octal" | "hex"
  | "bridges" | "divisions" | "bcd" | "signed" | "encoding" | "parity" | "map"
  | "physics" | "add" | "subtract" | "shift" | "fractions" | "float" | "units" | "hexMath";

const BUILDERS: Record<SceneKind, (state: LearningState) => SceneSpec> = {
  bits: sceneBits,
  radix: sceneRadix,
  weights: sceneWeights,
  toDecimal: sceneToDecimal,
  toBinary: sceneToBinary,
  octal: sceneOctal,
  hex: sceneHex,
  bridges: sceneBridges,
  divisions: sceneDivisions,
  bcd: sceneBcd,
  signed: sceneSigned,
  encoding: sceneEncoding,
  parity: sceneParity,
  map: sceneMap,
  physics: scenePhysics,
  add: sceneAdd,
  subtract: sceneSubtract,
  shift: sceneShift,
  fractions: sceneFractions,
  float: sceneFloat,
  units: sceneUnits,
  hexMath: sceneHexMath,
};

export function buildScene(kind: SceneKind, state: LearningState): SceneSpec {
  return BUILDERS[kind](state);
}
