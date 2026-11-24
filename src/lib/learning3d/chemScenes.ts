/**
 * 3D scene vocabulary for the chemistry courses.
 *
 * Uses the same dependency-free Canvas renderer as the encoding course — no
 * three.js, no WebGL, no new packages. Every scene is a pure function of the
 * student's controls, so moving a slider rebuilds the actual model.
 */
import { box, COLORS, disc, line, text, type SceneObject, type SceneSpec, type Vec3 } from "./scene";

export type ChemState = {
  /** Number of carbons in the displayed chain (1–6). */
  chain: number;
  halogen: "F" | "Cl" | "Br" | "I";
  group: "H" | "CH3" | "C2H5" | "NO2" | "OH" | "CN";
  effect: "I" | "R" | "H";
  hybrid: "sp3" | "sp2" | "sp";
  mechanism: "SN1" | "SN2" | "E1" | "E2";
  solvent: "protic" | "aprotic";
  stereo: boolean;
  heat: number;
};

export const INITIAL_CHEM_STATE: ChemState = {
  chain: 2,
  halogen: "Cl",
  group: "CH3",
  effect: "I",
  hybrid: "sp3",
  mechanism: "SN2",
  solvent: "aprotic",
  stereo: true,
  heat: 40,
};

export type ChemControlKind =
  | "chain" | "halogen" | "group" | "effect" | "hybrid"
  | "mechanism" | "solvent" | "stereo" | "heat";

export type ChemSceneKind =
  | "carbon" | "hybrid" | "sigmaPi" | "inductive" | "resonance" | "hyperconj"
  | "dipole" | "intermolecular" | "acidBase" | "carbocation" | "intermediates"
  | "nucleophile" | "stereo" | "conformation" | "aromaticity" | "alkylHalide"
  | "physicalProps" | "sn2" | "sn1" | "elimination" | "solvent" | "benzeneEAS"
  | "grignard" | "benzyne" | "reactivity" | "workshop";

export const EN: Record<string, number> = { F: 4.0, Cl: 3.0, Br: 2.8, I: 2.5, C: 2.5, H: 2.1, O: 3.5, N: 3.0 };
export const BOND_PM: Record<string, number> = { F: 139, Cl: 178, Br: 194, I: 214 };
export const BOND_KJ: Record<string, number> = { F: 485, Cl: 339, Br: 285, I: 213 };

const X_COLOR: Record<string, string> = { F: "#67e8f9", Cl: "#86efac", Br: "#fbbf24", I: "#c4b5fd" };

function atom(o: SceneObject[], id: string, pos: Vec3, label: string, color: string, size = 0.9, glow = 0) {
  o.push(box(id, pos, [size, size, size], color, { top: color, face: label, glow }));
}
function bond(o: SceneObject[], id: string, a: Vec3, b: Vec3, color = COLORS.faint, width = 2, double = false) {
  o.push(line(id, a, b, { color, width }));
  if (double) {
    const off: Vec3 = [0.16, 0.16, 0];
    o.push(line(`${id}-2`, [a[0] + off[0], a[1] + off[1], a[2]], [b[0] + off[0], b[1] + off[1], b[2]], { color, width }));
  }
}
function caption(o: SceneObject[], id: string, pos: Vec3, value: string, color = COLORS.faint, size = 0.36) {
  o.push(text(id, pos, value, { color, size }));
}
function zigzag(n: number, y = 0, pitch = 1.35): Vec3[] {
  const pts: Vec3[] = [];
  const start = -((n - 1) * pitch) / 2;
  for (let i = 0; i < n; i++) pts.push([start + i * pitch, y + (i % 2 ? -0.7 : 0.7), 0]);
  return pts;
}
function ring(radius = 2.4, y = 0.4): Vec3[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return [Math.cos(a) * radius, y + Math.sin(a) * radius, 0] as Vec3;
  });
}

function sceneCarbon(): SceneSpec {
  const o: SceneObject[] = [];
  const c: Vec3 = [0, 0.4, 0];
  atom(o, "c", c, "C", COLORS.on, 1.25, 0.5);
  const dirs: Vec3[] = [[-1.9, 1.9, 0.9], [1.9, 1.9, -0.9], [-1.9, -1.1, -0.9], [1.9, -1.1, 0.9]];
  dirs.forEach((d, i) => {
    const h: Vec3 = [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
    bond(o, `b${i}`, c, h, COLORS.guide, 2);
    atom(o, `h${i}`, h, "H", COLORS.off, 0.7);
  });
  caption(o, "title", [0, 3.6, 0], "Carbon makes four bonds — a tetrahedron, not a flat cross", COLORS.ink, 0.5);
  caption(o, "sub", [0, -3, 0], "sp³ · 109.5° · catenation lets carbon build long, stable chains", COLORS.digit);
  return { objects: o, floor: true, caption: "Rotate the tetrahedron: four equivalent C–H bonds point to the corners of a tetrahedron." };
}

function sceneHybrid(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const center: Vec3 = [0, 0.4, 0];
  const p = s.hybrid;
  const lobes = p === "sp3" ? 4 : p === "sp2" ? 3 : 2;
  const angle = p === "sp3" ? 109.5 : p === "sp2" ? 120 : 180;
  atom(o, "c", center, "C", COLORS.on, 1.2, 0.45);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + (p === "sp3" ? Math.PI / 4 : 0);
    const end: Vec3 = [Math.cos(a) * 3.4, center[1] + Math.sin(a) * 2.6, (i % 2 ? 0.5 : -0.5)];
    bond(o, `lo${i}`, center, end, COLORS.digit, 3);
    atom(o, `lob${i}`, end, p, COLORS.warm, 0.75);
  }
  if (p !== "sp3") {
    const perp: Vec3 = [0, center[1] + (p === "sp" ? 3.2 : 2.9), 0.1];
    bond(o, "pi", [-0.5, center[1], 0], [-0.5, perp[1], 0], COLORS.sign, 2);
    bond(o, "pi2", [0.5, center[1], 0], [0.5, perp[1], 0], COLORS.sign, 2);
    caption(o, "p", [0, center[1] + 3.8, 0], "unhybridised p orbital → π bond", COLORS.sign, 0.34);
  }
  caption(o, "title", [0, 4.3, 0], `${p} hybridisation · bond angle ≈ ${angle}°`, COLORS.ink, 0.5);
  caption(o, "sub", [0, -3.1, 0], p === "sp3" ? "4 σ bonds · tetrahedral · alkane" : p === "sp2" ? "3 σ + 1 π · trigonal planar · alkene" : "2 σ + 2 π · linear · alkyne", COLORS.digit);
  return { objects: o, floor: true, caption: `Switch hybridisation to see the geometry and the leftover p orbitals that make π bonds.` };
}

function sceneSigmaPi(): SceneSpec {
  const o: SceneObject[] = [];
  const a: Vec3 = [-1.5, 0.8, 0];
  const b: Vec3 = [1.5, 0.8, 0];
  atom(o, "a", a, "C", COLORS.on, 1.2);
  atom(o, "b", b, "C", COLORS.on, 1.2);
  bond(o, "sigma", a, b, COLORS.guide, 4);
  caption(o, "sl", [-1.6, -0.6, 0], "σ: head-on overlap", COLORS.digit, 0.34);
  bond(o, "pi1", [-0.6, 1.5, 0.35], [-0.6, 2.9, 0.35], COLORS.sign, 3);
  bond(o, "pi2", [0.6, 1.5, -0.35], [0.6, 2.9, -0.35], COLORS.sign, 3);
  caption(o, "pl", [1.8, 2.6, 0], "π: sideways overlap (above + below)", COLORS.sign, 0.34);
  caption(o, "title", [0, 3.9, 0], "σ is strong and cylindrical; π is weaker and locked above/below the plane", COLORS.ink, 0.44);
  caption(o, "sub", [0, -2.4, 0], "C=C = 1σ + 1π (ΔH ≈ 612 kJ/mol) · C≡C = 1σ + 2π (ΔH ≈ 839 kJ/mol)", COLORS.faint);
  return { objects: o, floor: true, caption: "The π cloud is what alkenes and alkynes offer to an attacking reagent." };
}

function sceneInductive(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const pts = zigzag(Math.min(6, Math.max(3, s.chain)));
  pts.forEach((p, i) => atom(o, `c${i}`, p, i === pts.length - 1 ? s.halogen : "C", i === pts.length - 1 ? X_COLOR[s.halogen] : COLORS.on, 0.9));
  for (let i = 0; i < pts.length - 1; i++) bond(o, `b${i}`, pts[i], pts[i + 1], COLORS.guide, 2);
  pts.forEach((p, i) => {
    if (i < pts.length - 1) caption(o, `d${i}`, [p[0], p[1] + 1.1, 0], "δ⁺", COLORS.sign, 0.4);
  });
  const last = pts[pts.length - 1];
  caption(o, "dx", [last[0], last[1] + 1.4, 0], "δ⁻", COLORS.digit, 0.46);
  caption(o, "arrow", [0, 3.6, 0], `${s.halogen} pulls electrons through σ bonds: −I effect`, COLORS.ink, 0.48);
  caption(o, "dist", [0, -3, 0], "Effect falls sharply with distance — 1° > 2° > 3° carbons feel it most", COLORS.faint);
  return { objects: o, floor: true, caption: "Inductive effect is permanent polarisation transmitted through sigma bonds; it weakens with distance." };
}

function sceneResonance(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const pts = ring(2.3, 0.6);
  pts.forEach((p, i) => atom(o, `c${i}`, p, "C", COLORS.on, 0.85));
  for (let i = 0; i < 6; i++) bond(o, `r${i}`, pts[i], pts[(i + 1) % 6], COLORS.guide, 2, i % 2 === 0);
  for (let i = 0; i < 6; i++) {
    const mid: Vec3 = [(pts[i][0] + pts[(i + 1) % 6][0]) / 2, (pts[i][1] + pts[(i + 1) % 6][1]) / 2, 0.2];
    caption(o, `e${i}`, mid, "•", COLORS.warm, 0.5);
  }
  caption(o, "ring", [0, 0.6, 0.2], "π⁶", COLORS.warm, 0.55);
  caption(o, "title", [0, 4.1, 0], s.effect === "R" ? "Resonance: electrons are delocalised, not bouncing" : "Resonance hybrid: one real structure, many contributors", COLORS.ink, 0.46);
  caption(o, "sub", [0, -2.9, 0], "6 π electrons in a closed ring → Hückel aromatic · equal C–C bonds (139 pm)", COLORS.digit);
  return { objects: o, floor: true, caption: "The dots are a single delocalised π system — benzene is not rapidly flipping between two structures." };
}

function sceneHyperconj(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const c1: Vec3 = [-1.4, 0.5, 0];
  const c2: Vec3 = [1.2, 0.5, 0];
  atom(o, "c1", c1, "C⁺", COLORS.sign, 1.15, 0.5);
  atom(o, "c2", c2, "C", COLORS.on, 1.05);
  bond(o, "cc", c1, c2, COLORS.guide, 3);
  const hs: Vec3[] = [[2.8, 1.7, 0.4], [2.8, 0.5, -0.4], [2.8, -0.7, 0.4]];
  hs.forEach((h, i) => {
    bond(o, `ch${i}`, c2, h, COLORS.guide, 2);
    atom(o, `h${i}`, h, "H", COLORS.off, 0.65);
  });
  bond(o, "ov1", [0.4, 1.5, 0.1], [0.4, 3.0, 0.1], COLORS.warm, 2);
  bond(o, "ov2", [0.9, 1.5, -0.1], [0.9, 3.0, -0.1], COLORS.warm, 2);
  caption(o, "title", [0, 4.1, 0], "Hyperconjugation = σ(C–H) donating into an empty p orbital", COLORS.ink, 0.46);
  caption(o, "n", [0, -2.9, 0], `${Math.max(0, s.chain - 1)} α-C–H bonds → ${Math.max(0, s.chain - 1)} no-bond resonance structures`, COLORS.warm);
  return { objects: o, floor: true, caption: "More alpha hydrogens means a more stable carbocation or alkene." };
}

function sceneDipole(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const c: Vec3 = [-1.6, 0.4, 0];
  const x: Vec3 = [1.6, 0.4, 0];
  atom(o, "c", c, "C", COLORS.on, 1.2);
  atom(o, "x", x, s.halogen, X_COLOR[s.halogen], 1.2);
  bond(o, "b", c, x, COLORS.guide, 4);
  const d = (EN[s.halogen] - EN.C).toFixed(1);
  caption(o, "pc", [-1.6, -1.1, 0], "δ⁺", COLORS.sign, 0.45);
  caption(o, "px", [1.6, -1.1, 0], "δ⁻", COLORS.digit, 0.45);
  o.push(line("arrow", [0.3, 1.6, 0], [2.7, 1.6, 0], { color: COLORS.warm, width: 3 }));
  caption(o, "d", [1.3, 2.2, 0], `ΔEN = ${d} D`, COLORS.warm, 0.42);
  caption(o, "title", [0, 3.8, 0], "Polar covalent bond — charge separation without full electron transfer", COLORS.ink, 0.46);
  caption(o, "sub", [0, -2.8, 0], `C–${s.halogen} is polar; C–H is almost non-polar (ΔEN ≈ 0.4)`, COLORS.faint);
  return { objects: o, floor: true, caption: "Bond polarity explains solubility, boiling point and which end a nucleophile attacks." };
}

function sceneIntermolecular(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const rows = [
    { label: "alkane", bp: -42, color: COLORS.off },
    { label: "haloalkane", bp: 12 + (s.halogen === "F" ? -30 : s.halogen === "Cl" ? 0 : s.halogen === "Br" ? 25 : 50), color: X_COLOR[s.halogen] },
    { label: "alcohol", bp: 78, color: COLORS.digit },
    { label: "acid", bp: 118, color: COLORS.sign },
  ];
  rows.forEach((r, i) => {
    const y = 2.8 - i * 1.7;
    caption(o, `l${i}`, [-5.3, y, 0], r.label, r.color, 0.42);
    const len = Math.max(1, (r.bp + 60) / 24);
    o.push(box(`bar${i}`, [-3.2 + len / 2, y, 0], [len, 0.62, 0.5], r.color, { glow: 0.18 }));
    caption(o, `v${i}`, [-3.2 + len + 0.4, y, 0], `${Math.round(r.bp)}°C`, COLORS.faint, 0.34);
  });
  caption(o, "title", [0, 4.2, 0], "Hydrogen bonding >> dipole–dipole >> London forces", COLORS.ink, 0.5);
  caption(o, "sub", [0, -3.2, 0], "More carbons / heavier halogen → larger surface area → higher boiling point", COLORS.faint);
  return { objects: o, floor: true, caption: "Compare intermolecular forces to predict physical properties instead of memorising tables." };
}

function sceneAcidBase(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const acids = [
    { name: "HCl", pka: -7, color: COLORS.sign },
    { name: "RCOOH", pka: 4.8, color: COLORS.warm },
    { name: "PhOH", pka: 10, color: COLORS.digit },
    { name: "H₂O", pka: 15.7, color: COLORS.on },
    { name: "ROH", pka: 16, color: COLORS.off },
    { name: "RC≡CH", pka: 25, color: COLORS.faint },
  ];
  acids.forEach((a, i) => {
    const y = 3 - i * 1.15;
    caption(o, `n${i}`, [-5, y, 0], a.name, a.color, 0.4);
    const x = -1.5 + (a.pka + 7) * 0.22;
    o.push(box(`m${i}`, [x, y, 0], [0.28, 0.28, 0.28], a.color, { glow: 0.3 }));
    caption(o, `v${i}`, [x + 0.4, y, 0], `pKa ${a.pka}`, COLORS.faint, 0.32);
  });
  o.push(line("axis", [-1.6, -3.4, 0], [9, -3.4, 0], { color: COLORS.guide, width: 2 }));
  caption(o, "ax", [3.6, -3.9, 0], "weaker acid →", COLORS.faint, 0.34);
  caption(o, "title", [0, 4.3, 0], "Lower pKa = stronger acid. A 1-unit drop means 10× stronger.", COLORS.ink, 0.46);
  return { objects: o, floor: true, caption: `Current substituent ${s.group} — electron withdrawing groups stabilise the conjugate base and lower pKa.` };
}

function sceneCarbocation(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const c: Vec3 = [0, 0.5, 0];
  atom(o, "c", c, "C⁺", COLORS.sign, 1.3, 0.6);
  const dirs: Vec3[] = [[-2.6, 1.7, 0], [2.6, 1.7, 0], [0, -2.2, 0]];
  dirs.forEach((d, i) => {
    const p: Vec3 = [c[0] + d[0], c[1] + d[1], 0];
    bond(o, `b${i}`, c, p, COLORS.guide, 2);
    atom(o, `g${i}`, p, i === 2 ? s.group : "CH₃", COLORS.on, 0.8);
  });
  bond(o, "p1", [-0.6, 0.7, 0.15], [-0.6, 3.0, 0.15], COLORS.warm, 2);
  bond(o, "p2", [0.6, 0.7, -0.15], [0.6, 3.0, -0.15], COLORS.warm, 2);
  caption(o, "title", [0, 4.1, 0], "Planar sp² carbocation with an empty p orbital", COLORS.ink, 0.48);
  caption(o, "stab", [0, -3.4, 0], s.stereo ? "Attack from either face → racemic mixture" : "3° > 2° > 1° > methyl (hyperconjugation + inductive)", COLORS.digit);
  return { objects: o, floor: true, caption: "The flat carbocation is why SN1 gives racemisation and rearrangements." };
}

function sceneIntermediates(): SceneSpec {
  const o: SceneObject[] = [];
  const cards = [
    { name: "Carbocation", sym: "C⁺", color: COLORS.sign, note: "6e⁻ · planar · electrophilic" },
    { name: "Carbanion", sym: "C⁻", color: COLORS.digit, note: "8e⁻ · pyramidal · nucleophilic" },
    { name: "Free radical", sym: "C•", color: COLORS.warm, note: "7e⁻ · planar · paramagnetic" },
    { name: "Carbene", sym: ":C", color: COLORS.on, note: "6e⁻ · singlet/triplet" },
  ];
  cards.forEach((c, i) => {
    const x = -5.2 + i * 3.4;
    o.push(box(`card${i}`, [x, 0.6, 0], [2.9, 3.5, 0.4], COLORS.dim, { opacity: 0.25 }));
    caption(o, `sym${i}`, [x, 1.7, 0.4], c.sym, c.color, 0.7);
    caption(o, `nm${i}`, [x, 0.2, 0.4], c.name, c.color, 0.34);
    caption(o, `nt${i}`, [x, -0.9, 0.4], c.note, COLORS.faint, 0.26);
  });
  caption(o, "title", [0, 4.2, 0], "Reaction intermediates — know the electron count and the shape", COLORS.ink, 0.46);
  return { objects: o, floor: true, caption: "Stability order of each intermediate decides which mechanism the reaction takes." };
}

function sceneNucleophile(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const left: Vec3 = [-4.1, 0.8, 0];
  const mid: Vec3 = [0, 0.8, 0];
  const right: Vec3 = [4.1, 0.8, 0];
  atom(o, "nuc", left, "Nu⁻", COLORS.digit, 1.3, 0.4);
  atom(o, "c", mid, "C", COLORS.on, 1.15);
  atom(o, "lg", right, s.halogen, X_COLOR[s.halogen], 1.2);
  bond(o, "b1", left, mid, COLORS.guide, 2);
  bond(o, "b2", mid, right, COLORS.guide, 2);
  caption(o, "nl", [-4.1, -0.8, 0], "electron rich", COLORS.digit, 0.34);
  caption(o, "cl", [0, -0.8, 0], "electrophilic centre", COLORS.on, 0.34);
  caption(o, "gl", [4.1, -0.8, 0], "leaving group", X_COLOR[s.halogen], 0.34);
  caption(o, "title", [0, 3.8, 0], "A nucleophile attacks an electron-poor carbon; the leaving group departs", COLORS.ink, 0.44);
  caption(o, "sub", [0, -2.9, 0], `Stronger Nu⁻ in ${s.solvent} solvent → faster substitution`, COLORS.faint);
  return { objects: o, floor: true, caption: "Good nucleophiles have available electrons; good leaving groups are weak bases." };
}

function sceneStereo(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const centres: { x: number; label: string }[] = [{ x: -3.2, label: "R" }, { x: 3.2, label: "S" }];
  centres.forEach((c, k) => {
    const p: Vec3 = [c.x, 0.5, 0];
    atom(o, `c${k}`, p, "C*", COLORS.on, 1.05);
    const dirs: Vec3[] = [[-1.5, 1.6, 0.6], [1.5, 1.6, -0.6], [-1.5, -1.5, -0.6], [1.5, -1.5, 0.6]];
    dirs.forEach((d, i) => {
      const q: Vec3 = [p[0] + d[0], p[1] + d[1], d[2]];
      bond(o, `b${k}_${i}`, p, q, COLORS.guide, 2);
      atom(o, `g${k}_${i}`, q, ["1", "2", "3", "4"][i], i === 0 ? COLORS.sign : COLORS.off, 0.62);
    });
    caption(o, `l${k}`, [c.x, -2.9, 0], s.stereo ? `mirror image: ${c.label}` : "identical", c.label === "R" ? COLORS.warm : COLORS.digit, 0.42);
  });
  o.push(line("mirror", [0, -2.2, 0], [0, 3.3, 0], { color: COLORS.guide, width: 2, dashed: true }));
  caption(o, "title", [0, 4.2, 0], "A carbon with four different groups is chiral — its mirror is not superimposable", COLORS.ink, 0.44);
  return { objects: o, floor: true, caption: "SN2 inverts the centre (R→S); SN1 goes through a flat carbocation and racemises." };
}

function sceneConformation(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const cx = 0, cy = 0.5;
  o.push(disc("hub", [cx, cy, 0], 0.42, COLORS.on));
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 2;
    const ex = cx + Math.cos(a) * 2.4;
    const ey = cy + Math.sin(a) * 2.4;
    bond(o, `sp${i}`, [cx, cy, 0], [ex, ey, 0], COLORS.guide, 2);
    atom(o, `h${i}`, [ex, ey, 0], "H", COLORS.off, 0.62);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 2 + (s.heat / 100) * Math.PI / 3;
    const ex = cx + Math.cos(a) * 3.1;
    const ey = cy + Math.sin(a) * 3.1;
    bond(o, `bk${i}`, [cx, cy, 0.15], [ex, ey, 0.15], COLORS.digit, 2);
    atom(o, `bh${i}`, [ex, ey, 0.15], i === 0 ? s.group : "H", COLORS.warm, 0.55);
  }
  caption(o, "title", [0, 4.2, 0], "Newman projection: front carbon (dot) vs back carbon (circle)", COLORS.ink, 0.44);
  caption(o, "sub", [0, -3.6, 0], s.heat > 55 ? "eclipsed / higher energy (torsional strain)" : "staggered / lower energy (anti = most stable)", COLORS.digit);
  return { objects: o, floor: true, caption: "Rotate the back carbon with the heat slider to feel why staggered conformations win." };
}

function sceneAromaticity(): SceneSpec {
  const o: SceneObject[] = [];
  const pts = ring(2.5, 0.4);
  pts.forEach((p, i) => atom(o, `c${i}`, p, "C", COLORS.on, 0.88));
  for (let i = 0; i < 6; i++) bond(o, `r${i}`, pts[i], pts[(i + 1) % 6], COLORS.guide, 2);
  [0, 1, 2, 3, 4, 5].forEach((i) => {
    const p = pts[i];
    const inner: Vec3 = [p[0] * 0.84, 0.4 + (p[1] - 0.4) * 0.84, 0.1];
    atom(o, `pi${i}`, inner, "π", COLORS.warm, 0.45, 0.25);
  });
  caption(o, "t", [0, 3.9, 0], "Hückel: planar, cyclic, fully conjugated, (4n+2) π electrons", COLORS.ink, 0.46);
  caption(o, "s", [0, -3.1, 0], "benzene 6π (n=1) aromatic · cyclobutadiene 4π antiaromatic", COLORS.digit);
  return { objects: o, floor: true, caption: "Aromatic compounds resist addition and prefer substitution — that is the whole haloarene story." };
}

function sceneAlkylHalide(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const pts = zigzag(Math.min(6, Math.max(2, s.chain)));
  pts.forEach((p, i) => atom(o, `c${i}`, p, i === pts.length - 1 ? s.halogen : "C", i === pts.length - 1 ? X_COLOR[s.halogen] : COLORS.on, 0.9));
  for (let i = 0; i < pts.length - 1; i++) bond(o, `b${i}`, pts[i], pts[i + 1], COLORS.guide, 2);
  const last = pts[pts.length - 1];
  caption(o, "delta", [last[0] + 1.1, last[1] + 1.2, 0], "δ⁻", X_COLOR[s.halogen], 0.44);
  caption(o, "title", [0, 3.8, 0], `C–${s.halogen}: ${BOND_PM[s.halogen]} pm · ${BOND_KJ[s.halogen]} kJ/mol · ΔEN ${(EN[s.halogen] - 2.5).toFixed(1)}`, COLORS.ink, 0.46);
  caption(o, "sub", [0, -3.1, 0], s.halogen === "I" ? "longest, weakest bond → best leaving group" : s.halogen === "F" ? "shortest, strongest bond → almost unreactive" : "balance of bond strength and leaving-group ability", COLORS.digit);
  return { objects: o, floor: true, caption: "Swap the halogen and chain length to derive reactivity and physical trends instead of memorising them." };
}

function scenePhysicalProps(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const base = -24 + (s.halogen === "F" ? -55 : s.halogen === "Cl" ? 0 : s.halogen === "Br" ? 25 : 52);
  const items = [
    { n: "1°, straight", v: base, c: COLORS.on },
    { n: "2°", v: base - 12, c: COLORS.digit },
    { n: "3°, branched", v: base - 30, c: COLORS.warm },
  ];
  items.forEach((it, i) => {
    const y = 2.2 - i * 1.8;
    caption(o, `n${i}`, [-5.3, y, 0], it.n, it.c, 0.38);
    const len = Math.max(1, (it.v + 90) / 18);
    o.push(box(`b${i}`, [-3.2 + len / 2, y, 0], [len, 0.6, 0.5], it.c, { glow: 0.2 }));
    caption(o, `v${i}`, [-3.2 + len + 0.3, y, 0], `${Math.round(it.v)}°C`, COLORS.faint, 0.32);
  });
  caption(o, "title", [0, 4.1, 0], "Branching lowers boiling point; molar mass raises it", COLORS.ink, 0.48);
  caption(o, "sub", [0, -3.2, 0], "Haloalkanes are denser than water but only sparingly soluble (no H-bonding with water)", COLORS.faint);
  return { objects: o, floor: true, caption: "Use surface area and molar mass to predict the trend, then check against the data table." };
}

function sceneSN2(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const nuc: Vec3 = [-4.5, 0.5, 0];
  const c: Vec3 = [0, 0.5, 0];
  const lg: Vec3 = [4.2, 0.5, 0];
  atom(o, "nu", nuc, "Nu⁻", COLORS.digit, 1.15, 0.5);
  atom(o, "c", c, "C", COLORS.on, 1.15);
  atom(o, "lg", lg, s.halogen, X_COLOR[s.halogen], 1.15);
  bond(o, "a", nuc, c, COLORS.guide, 2);
  bond(o, "b", c, lg, COLORS.guide, 2);
  const ts = s.mechanism === "SN2";
  o.push(line("arr", [-2.9, 2.3, 0], [-0.6, 2.3, 0], { color: COLORS.warm, width: 3 }));
  caption(o, "back", [-2.4, 2.9, 0], ts ? "backside attack" : "front-side blocked", COLORS.warm, 0.36);
  caption(o, "hy", [0, -1.2, 0], "[Nu···C···X]‡  pentacoordinate transition state", COLORS.sign, 0.34);
  caption(o, "title", [0, 4.2, 0], ts ? "SN2: one concerted step, rate = k[RX][Nu⁻]" : "Switch to SN2 to see the concerted backside attack", COLORS.ink, 0.44);
  caption(o, "sub", [0, -3.4, 0], "Walden inversion · fastest for CH₃X > 1° > 2° · favoured by polar aprotic solvent", COLORS.digit);
  return { objects: o, floor: true, caption: "SN2 has no intermediate: bond making and bond breaking happen together." };
}

function sceneSN1(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const c: Vec3 = [0, 0.5, 0];
  atom(o, "c", c, "C⁺", COLORS.sign, 1.35, 0.6);
  const lg: Vec3 = [4.4, 2.2, 0];
  atom(o, "lg", lg, `${s.halogen}⁻`, X_COLOR[s.halogen], 0.95);
  o.push(line("leave", [2.2, 1.4, 0], [3.6, 2, 0], { color: COLORS.warm, width: 3 }));
  const nu1: Vec3 = [-3.9, 1.9, 0.6], nu2: Vec3 = [-3.9, -0.9, -0.6];
  atom(o, "n1", nu1, "Nu⁻", COLORS.digit, 0.9);
  atom(o, "n2", nu2, "Nu⁻", COLORS.digit, 0.9);
  o.push(line("at1", [-2.9, 1.7, 0.4], [-0.8, 0.8, 0.2], { color: COLORS.digit, width: 2 }));
  o.push(line("at2", [-2.9, -0.6, -0.4], [-0.8, 0.2, -0.2], { color: COLORS.digit, width: 2 }));
  caption(o, "title", [0, 4.1, 0], s.mechanism === "SN1" ? "SN1: slow ionisation makes a flat carbocation" : "Switch to SN1 to see ionisation first", COLORS.ink, 0.44);
  caption(o, "sub", [0, -3.4, 0], "rate = k[RX] · 3° > 2° >> 1° · racemisation · rearrangements possible", COLORS.digit);
  return { objects: o, floor: true, caption: "Attack on both faces of the planar cation explains partial or full racemisation." };
}

function sceneElimination(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const a: Vec3 = [-3.4, 0.3, 0], b: Vec3 = [0, 0.3, 0], c: Vec3 = [3.4, 0.3, 0];
  atom(o, "a", a, "Cβ", COLORS.on, 1.0);
  atom(o, "b", b, "Cα", COLORS.on, 1.0);
  atom(o, "c", c, s.halogen, X_COLOR[s.halogen], 1.0);
  bond(o, "ab", a, b, COLORS.guide, 2);
  bond(o, "bc", b, c, COLORS.guide, 2);
  const h: Vec3 = [-3.4, 2.6, 0];
  atom(o, "h", h, "H", COLORS.off, 0.7);
  bond(o, "ch", a, h, COLORS.guide, 2);
  const base: Vec3 = [-5.2, 3.6, 0];
  atom(o, "base", base, "B⁻", COLORS.digit, 0.9);
  o.push(line("abs", [-4.6, 3.1, 0], [-3.7, 2.8, 0], { color: COLORS.warm, width: 3 }));
  bond(o, "pi", [a[0] + 0.1, 1.5, 0], [b[0] + 0.1, 1.5, 0], COLORS.sign, 2);
  caption(o, "title", [0, 4.4, 0], s.mechanism === "E2" ? "E2: base removes β-H as X⁻ leaves — concerted" : "E1: carbocation forms first, then loses β-H", COLORS.ink, 0.44);
  caption(o, "prod", [0, -2.2, 0], s.heat > 60 ? "Hofmann (less substituted, small base)" : "Saytzeff (more substituted alkene) — more stable", COLORS.warm);
  return { objects: o, floor: true, caption: "Elimination needs a β-hydrogen; bulky bases and high heat favour the Hofmann product." };
}

function sceneSolvent(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const center: Vec3 = [0, 0.4, 0];
  atom(o, "ion", center, "X⁻", X_COLOR[s.halogen], 1.15, 0.4);
  const n = s.solvent === "protic" ? 8 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p: Vec3 = [Math.cos(a) * 3, 0.4 + Math.sin(a) * 2.4, (i % 2 ? 0.4 : -0.4)];
    atom(o, `sv${i}`, p, s.solvent === "protic" ? "H–O" : "δ⁻", s.solvent === "protic" ? COLORS.digit : COLORS.warm, 0.62);
    o.push(line(`sh${i}`, [center[0] + Math.cos(a) * 0.9, center[1] + Math.sin(a) * 0.7, 0], [p[0] - Math.cos(a) * 0.5, p[1] - Math.sin(a) * 0.5, 0], { color: COLORS.guide, width: 1, dashed: true }));
  }
  caption(o, "title", [0, 4.2, 0], s.solvent === "protic" ? "Protic solvent H-bonds to Nu⁻ and slows SN2" : "Aprotic solvent leaves Nu⁻ bare and speeds SN2", COLORS.ink, 0.46);
  caption(o, "sub", [0, -3.2, 0], "Polar protic stabilises ions → SN1 · Polar aprotic exposes nucleophile → SN2", COLORS.digit);
  return { objects: o, floor: true, caption: "The solvent can flip which mechanism wins — it is not just a background detail." };
}

function sceneBenzeneEAS(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const pts = ring(2.2, 0.4);
  pts.forEach((p, i) => atom(o, `c${i}`, p, i === 0 ? `C–${s.group}` : "C", i === 0 ? COLORS.warm : COLORS.on, 0.82));
  for (let i = 0; i < 6; i++) bond(o, `r${i}`, pts[i], pts[(i + 1) % 6], COLORS.guide, 2, i % 2 === 0);
  const e: Vec3 = [-5.3, 2.6, 0];
  atom(o, "e", e, "E⁺", COLORS.sign, 1.0);
  o.push(line("att", [-4.2, 2.3, 0], [pts[0][0] - 0.6, pts[0][1] + 0.3, 0], { color: COLORS.warm, width: 3 }));
  caption(o, "step", [0, -2.9, 0], "1) E⁺ attacks π ring → σ-complex (arenium ion)   2) H⁺ leaves → aromaticity restored", COLORS.digit, 0.3);
  caption(o, "title", [0, 4.2, 0], "Electrophilic aromatic substitution keeps the aromatic ring intact", COLORS.ink, 0.44);
  return { objects: o, floor: true, caption: "Halogen is deactivating but ortho/para directing — a classic exam trap." };
}

function sceneGrignard(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const r: Vec3 = [-3.6, 0.6, 0], mg: Vec3 = [0, 0.6, 0], x: Vec3 = [3.6, 0.6, 0];
  atom(o, "r", r, `C${s.chain}`, COLORS.on, 1.15);
  atom(o, "mg", mg, "Mg", COLORS.warm, 1.2, 0.4);
  atom(o, "x", x, s.halogen, X_COLOR[s.halogen], 1.1);
  bond(o, "rm", r, mg, COLORS.guide, 3);
  bond(o, "mx", mg, x, COLORS.guide, 3);
  caption(o, "pol", [-3.6, -0.9, 0], "δ⁻ (acts as R⁻)", COLORS.digit, 0.34);
  caption(o, "pol2", [3.6, -0.9, 0], "δ⁺", COLORS.sign, 0.34);
  caption(o, "title", [0, 4.1, 0], "R–X + Mg (dry ether) → R–MgX, a powerful nucleophile and base", COLORS.ink, 0.44);
  caption(o, "sub", [0, -3.1, 0], "Must be moisture-free: water destroys the reagent instantly", COLORS.faint);
  return { objects: o, floor: true, caption: "Grignard reagents turn an alkyl halide into a carbon nucleophile — a gateway to alcohols and acids." };
}

function sceneBenzyne(): SceneSpec {
  const o: SceneObject[] = [];
  const pts = ring(2.3, 0.5);
  pts.forEach((p, i) => atom(o, `c${i}`, p, "C", COLORS.on, 0.82));
  for (let i = 0; i < 6; i++) bond(o, `r${i}`, pts[i], pts[(i + 1) % 6], COLORS.guide, 2, i === 3);
  o.push(line("extra", [pts[3][0] + 0.1, pts[3][1] - 0.9, 0], [pts[4][0] + 0.1, pts[4][1] - 0.9, 0], { color: COLORS.sign, width: 3 }));
  const nu: Vec3 = [-5.2, 2.4, 0];
  atom(o, "nu", nu, "NH₂⁻", COLORS.digit, 1.0);
  caption(o, "title", [0, 4.2, 0], "Benzyne: elimination–addition when no EWG activates the ring", COLORS.ink, 0.44);
  caption(o, "sub", [0, -3.0, 0], "NaNH₂ / NH₃ · gives a mixture of isomers · explains the 'cine substitution' product", COLORS.warm);
  return { objects: o, floor: true, caption: "Unactivated haloarenes react through a strained benzyne, not a plain carbocation." };
}

function sceneReactivity(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const rows = [
    { n: "CH₃X (SN2)", v: 9, c: COLORS.on },
    { n: "1° RX", v: 7, c: COLORS.digit },
    { n: "2° RX", v: 4.5, c: COLORS.warm },
    { n: "3° RX (SN1)", v: 6.5, c: COLORS.sign },
    { n: "Ar–X", v: 1.2, c: COLORS.off },
    { n: "CH₂=CH–X", v: 1.0, c: COLORS.faint },
  ];
  rows.forEach((r, i) => {
    const y = 3 - i * 1.1;
    caption(o, `n${i}`, [-5.2, y, 0], r.n, r.c, 0.34);
    o.push(box(`b${i}`, [-2.7 + r.v * 0.55 / 2, y, 0], [r.v * 0.55, 0.5, 0.4], r.c, { glow: 0.2 }));
  });
  caption(o, "title", [0, 4.2, 0], "Reactivity is a combination of substrate, leaving group and mechanism", COLORS.ink, 0.46);
  caption(o, "sub", [0, -3.3, 0], `Leaving group: I⁻ > Br⁻ > Cl⁻ >> F⁻  ·  Solvent: ${s.solvent}`, COLORS.digit);
  return { objects: o, floor: true, caption: "Compare rates qualitatively instead of memorising isolated facts." };
}

function sceneWorkshop(s: ChemState): SceneSpec {
  const o: SceneObject[] = [];
  const steps = [
    { q: "Is the carbon sp² (aryl/vinyl)?", a: "No substitution unless EWG or benzyne" },
    { q: "Methyl or 1°?", a: `SN2 with a strong Nu⁻ in ${s.solvent} solvent` },
    { q: "3° or stable carbocation?", a: "SN1/E1 — watch for rearrangement" },
    { q: "Bulky base + heat?", a: "E2 → Hofmann alkene" },
  ];
  steps.forEach((st, i) => {
    const y = 2.9 - i * 1.85;
    o.push(box(`n${i}`, [-5.2, y, 0], [0.7, 0.7, 0.4], COLORS.on, { face: String(i + 1), glow: 0.25 }));
    caption(o, `q${i}`, [-4.3, y + 0.25, 0], st.q, COLORS.ink, 0.36);
    caption(o, `a${i}`, [-4.3, y - 0.5, 0], `→ ${st.a}`, COLORS.digit, 0.3);
  });
  caption(o, "title", [0, 4.3, 0], "Decision tree: read the substrate, then choose the mechanism", COLORS.ink, 0.46);
  return { objects: o, floor: true, caption: "Answer the questions in order — the same rules solve board and JEE problems." };
}

const BUILDERS: Record<ChemSceneKind, (s: ChemState) => SceneSpec> = {
  carbon: sceneCarbon, hybrid: sceneHybrid, sigmaPi: sceneSigmaPi, inductive: sceneInductive,
  resonance: sceneResonance, hyperconj: sceneHyperconj, dipole: sceneDipole, intermolecular: sceneIntermolecular,
  acidBase: sceneAcidBase, carbocation: sceneCarbocation, intermediates: sceneIntermediates,
  nucleophile: sceneNucleophile, stereo: sceneStereo, conformation: sceneConformation,
  aromaticity: sceneAromaticity, alkylHalide: sceneAlkylHalide, physicalProps: scenePhysicalProps,
  sn2: sceneSN2, sn1: sceneSN1, elimination: sceneElimination, solvent: sceneSolvent,
  benzeneEAS: sceneBenzeneEAS, grignard: sceneGrignard, benzyne: sceneBenzyne,
  reactivity: sceneReactivity, workshop: sceneWorkshop,
};

export function buildChemScene(kind: ChemSceneKind, state: ChemState): SceneSpec {
  return BUILDERS[kind](state);
}
