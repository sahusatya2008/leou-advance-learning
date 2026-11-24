/**
 * Shared model for the two chemistry 3D courses.
 *
 * Like the encoding course, all teaching content is static TypeScript in `src/`:
 * nothing here reads or writes a database row, and progress stays in the
 * browser. The scenes are pure functions of the student's controls
 * (`buildChemScene` in `chemScenes.ts`).
 */
import {
  BOND_KJ,
  BOND_PM,
  EN,
  type ChemControlKind,
  type ChemSceneKind,
  type ChemState,
} from "./chemScenes";

export type ChemStoryBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "example"; title: string; lines: string[] }
  | { kind: "note"; tone: "tip" | "remember" | "watch"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

export type ChemConcept = {
  id: string;
  title: string;
  tagline: string;
  minutes: number;
  scene: ChemSceneKind;
  controls: ChemControlKind[];
  story: ChemStoryBlock[];
  /** Live values under the model, recomputed from the student's controls. */
  live: (state: ChemState) => string[];
  quiz: { prompt: string; choices: string[]; answer: number; why: string };
  /** A small badge so students can see which syllabus level a lesson serves. */
  level: "CBSE" | "JEE" | "Both";
};

export type ChemCourse = {
  id: string;
  title: string;
  tagline: string;
  chapter: string;
  concepts: ChemConcept[];
};

export const GOC_COURSE_ID = "goc";
export const HALO_COURSE_ID = "haloalkanes-haloarenes";

export const GOC_COURSE_TITLE = "General Organic Chemistry (GOC)";
export const HALO_COURSE_TITLE = "Haloalkanes & Haloarenes";

// ---- story builders ----
export const p = (text: string): ChemStoryBlock => ({ kind: "p", text });
export const h = (text: string): ChemStoryBlock => ({ kind: "h", text });
export const steps = (...items: string[]): ChemStoryBlock => ({ kind: "steps", items });
export const example = (title: string, ...lines: string[]): ChemStoryBlock => ({ kind: "example", title, lines });
export const note = (tone: "tip" | "remember" | "watch", text: string): ChemStoryBlock => ({ kind: "note", tone, text });
export const table = (head: string[], ...rows: string[][]): ChemStoryBlock => ({ kind: "table", head, rows });

// ---- live helpers ----
const ROOTS = ["", "meth", "eth", "prop", "but", "pent", "hex"];
export const stem = (n: number) => ROOTS[Math.min(6, Math.max(1, n))] ?? "hex";
export const haloName: Record<string, string> = { F: "fluoro", Cl: "chloro", Br: "bromo", I: "iodo" };
const bondInfo = (s: ChemState) => `C–${s.halogen}: ${BOND_PM[s.halogen]} pm · ${BOND_KJ[s.halogen]} kJ/mol`;
const enInfo = (s: ChemState) => `ΔEN(C–${s.halogen}) = ${(EN[s.halogen] - EN.C).toFixed(1)}`;
const alphaH = (s: ChemState) => Math.max(0, s.chain - 1);
const groupLabel = (s: ChemState) => `–${s.group}`;
const effectLabel: Record<string, string> = { I: "inductive (−I / +I)", R: "resonance (±R / ±M)", H: "hyperconjugation" };

// =====================================================================
// GOC — free for every student. Basics → CBSE boards → JEE advanced.
// =====================================================================
export const GOC_CONCEPTS: ChemConcept[] = [
  {
    id: "carbon-catenation",
    title: "Why carbon? Catenation and the tetravalent atom",
    tagline: "Four bonds, small size, endless chains — the foundation of organic chemistry.",
    minutes: 6,
    scene: "carbon",
    controls: ["chain"],
    level: "CBSE",
    story: [
      p("Organic chemistry is the chemistry of **carbon compounds**. Carbon has just 4 valence electrons (2s²2p²), yet it never sits with only two bonds: it promotes one 2s electron and forms **four equivalent covalent bonds**. That is why methane is CH₄, not CH₂."),
      p("Carbon is small, so its 2p orbitals overlap strongly with each other and with hydrogen, oxygen, nitrogen, sulfur and the halogens. Strong overlap means stable bonds — this is **catenation**: the ability to form long open chains, branched chains and rings."),
      h("Three reasons carbon dominates"),
      steps(
        "**Tetravalence:** four bonds let carbon reach a stable octet and build complex skeletons.",
        "**Catenation:** C–C bonds are strong (≈348 kJ/mol), so chains of hundreds of atoms are stable.",
        "**Versatility:** carbon bonds to H, O, N, S, X and metals, giving millions of compounds.",
      ),
      table(
        ["Element", "Catenation", "Why"],
        ["Carbon", "Excellent", "Small size, strong C–C bond"],
        ["Silicon", "Weak", "Si–Si bond is long and weak; Si–O takes over"],
        ["Sulfur", "Moderate", "S–S chains exist but are unstable"],
      ),
      note("remember", "Carbon's four bonds point to the corners of a **tetrahedron** (109.5°), never a flat cross. Every mechanism later depends on this 3D shape."),
    ],
    live: (s) => [`chain: ${s.chain} C atoms`, "C makes 4 σ bonds", "angle ≈ 109.5° (sp³)"],
    quiz: { prompt: "Why is carbon able to form long, stable chains?", choices: ["Large atomic size", "Strong C–C catenation", "High electronegativity", "Two valence electrons"], answer: 1, why: "Small size gives strong C–C overlap — catenation is the reason, not size or electronegativity." },
  },
  {
    id: "hybridisation",
    title: "Hybridisation — sp³, sp² and sp",
    tagline: "Mix orbitals, get geometry. Geometry decides reactivity.",
    minutes: 7,
    scene: "hybrid",
    controls: ["hybrid"],
    level: "Both",
    story: [
      p("Atomic s and p orbitals are not the shapes we see in molecules. Carbon **mixes** them to make hybrid orbitals that point exactly where bonds need to go. Mix one s + three p → **sp³** (four orbitals); one s + two p → **sp²** (three); one s + one p → **sp** (two)."),
      h("The three geometries you must know cold"),
      table(
        ["Hybridisation", "Orbitals used", "Shape", "Angle", "Example"],
        ["sp³", "1s + 3p", "Tetrahedral", "109.5°", "CH₄, alkanes"],
        ["sp²", "1s + 2p", "Trigonal planar", "120°", "C₂H₄, benzene"],
        ["sp", "1s + 1p", "Linear", "180°", "C₂H₂, alkynes"],
      ),
      p("The unhybridised p orbitals are just as important: **one leftover p orbital makes a π bond** (alkene), **two make two π bonds** (alkyne). No π bond exists in sp³ carbon — that is why alkanes are saturated and fairly inert."),
      example("Count it yourself", "CH₄: 4 σ, 0 π → sp³", "CH₂=CH₂: 5 σ, 1 π → sp²", "HC≡CH: 3 σ, 2 π → sp"),
      note("watch", "More s-character pulls electrons closer to the nucleus: sp (50%) > sp² (33%) > sp³ (25%). This is why alkynes are more acidic than alkenes, which are more acidic than alkanes."),
    ],
    live: (s) => [`hybridisation: ${s.hybrid}`, `σ bonds: ${s.hybrid === "sp3" ? 4 : s.hybrid === "sp2" ? 3 : 2}`, `π bonds: ${s.hybrid === "sp3" ? 0 : s.hybrid === "sp2" ? 1 : 2}`],
    quiz: { prompt: "A carbon in a double bond is:", choices: ["sp³ hybridised", "sp² hybridised", "sp hybridised", "unhybridised"], answer: 1, why: "A C=C has 3 σ + 1 π, so carbon uses sp² hybrids and keeps one p orbital for the π bond." },
  },
  {
    id: "sigma-pi",
    title: "Sigma (σ) and pi (π) bonds",
    tagline: "Head-on strength vs sideways exposure.",
    minutes: 5,
    scene: "sigmaPi",
    controls: ["hybrid"],
    level: "Both",
    story: [
      p("A **σ bond** is formed by head-on overlap along the internuclear axis. It is cylindrical, strong, and can rotate freely. Every single bond is a σ bond, and every double/triple bond **contains one** σ bond."),
      p("A **π bond** comes from sideways overlap of two parallel p orbitals, above and below the plane. It is weaker than σ, locks rotation, and — crucially — is the electron-rich region that attacking reagents see first."),
      table(
        ["Bond", "Overlap", "Strength", "Free rotation?"],
        ["C–C (σ)", "head-on", "≈348 kJ/mol", "Yes"],
        ["C=C (σ+π)", "head-on + sideways", "≈612 kJ/mol", "No"],
        ["C≡C (σ+2π)", "head-on + 2 sideways", "≈839 kJ/mol", "No"],
      ),
      note("tip", "π bonds are weaker **per bond** than σ: the π part of C=C is only about 264 kJ/mol. That is why alkenes undergo addition — breaking π and forming two σ bonds releases energy."),
    ],
    live: (s) => [s.hybrid === "sp3" ? "only σ bonds (saturated)" : s.hybrid === "sp2" ? "1 σ + 1 π per double bond" : "1 σ + 2 π per triple bond", "rotation blocked by π"],
    quiz: { prompt: "Which statement about a π bond is correct?", choices: ["It is stronger than σ", "It allows free rotation", "It lies above and below the bond axis", "It exists in methane"], answer: 2, why: "The π cloud sits above/below the axis, is weaker than σ, and stops rotation." },
  },
  {
    id: "inductive",
    title: "Inductive effect (−I and +I)",
    tagline: "A permanent tug of electrons through σ bonds, fading with distance.",
    minutes: 6,
    scene: "inductive",
    controls: ["chain", "halogen", "group"],
    level: "Both",
    story: [
      p("When two atoms of different electronegativity join, the shared electron pair is pulled towards the more electronegative one. The bond becomes **polar** (δ⁺—δ⁻). This polarisation is passed down the σ-framework — that is the **inductive effect**."),
      p("Groups that withdraw electrons are **−I** (halogens, –NO₂, –CN, –CHO, –COOH, –OH); groups that push electrons are **+I** (alkyl groups). The effect is **permanent** and **weakens rapidly after 2–3 bonds**."),
      h("The −I order you will use everywhere"),
      example("Standard −I order", "–NR₃⁺ > –NO₂ > –CN > –SO₃H > –CHO > –CO > –COOH > –COCl > –CONH₂ > –F > –Cl > –Br > –I > –OH > –OR > –NH₂ > –C₆H₅ > –H"),
      steps(
        "Notice halogens: **–F is the strongest −I** even though fluoride is a poor leaving group.",
        "+I order: **3° alkyl > 2° > 1° > methyl** (more alkyl groups push more electron density).",
        "Inductive effects decide acidity (electron withdrawal stabilises the conjugate base) and carbocation stability (+I groups stabilise the cation).",
      ),
      note("watch", "The current model shows a C–X chain. Increase the chain length and watch the δ⁺ marks fade: at the far end the effect is nearly zero. Confusing this with resonance is a classic JEE error."),
    ],
    live: (s) => [`terminal atom: ${s.halogen} (EN ${EN[s.halogen]})`, `chain length: ${s.chain} C`, "effect fades with distance"],
    quiz: { prompt: "Which group has the strongest −I effect?", choices: ["–I", "–CH₃", "–NO₂", "–H"], answer: 2, why: "–NO₂ is a very strong electron withdrawer; –CH₃ is +I, –I is a weak −I group." },
  },
  {
    id: "resonance",
    title: "Resonance — the real structure is a hybrid",
    tagline: "Electrons are delocalised; the molecule does not flip between drawings.",
    minutes: 7,
    scene: "resonance",
    controls: ["group", "effect"],
    level: "Both",
    story: [
      p("When a π system is separated by only a single bond (**conjugation**), electrons are not fixed between two atoms — they belong to the whole system. We draw several **resonance structures**, but the molecule is one **resonance hybrid** with equalised bond lengths and a lower energy than any contributor."),
      h("Rules for drawing valid resonance structures"),
      steps(
        "Only **electrons move** — never nuclei. The σ skeleton and atom positions stay fixed.",
        "Every structure must obey the octet rule and keep the same total charge.",
        "Structures with complete octets, fewer charges and negative charge on the more electronegative atom contribute more.",
        "Equivalent contributors contribute equally (benzene's two Kekulé forms).",
      ),
      example("Benzene: two equal contributors", "Kekulé A: double bonds at 1–2, 3–4, 5–6", "Kekulé B: double bonds at 2–3, 4–5, 6–1", "Reality: all six C–C bonds = 139 pm (between 154 and 134 pm)"),
      p("**Resonance effect (±R or ±M):** groups like –OH, –OR, –NH₂, –Cl donate a lone pair (+R) when attached to a π system; –NO₂, –CN, –CHO, –COOH withdraw (−R). The +R of –OH is why phenol is so reactive towards electrophiles."),
      note("watch", "Resonance is **not** a rapid equilibrium (that is tautomerism). If you catch yourself saying 'it changes fast', you are describing the wrong idea."),
    ],
    live: (s) => [`substituent: ${groupLabel(s)}`, `effect shown: ${effectLabel[s.effect]}`, "π electrons delocalised"],
    quiz: { prompt: "Resonance structures differ only in the position of:", choices: ["Atoms", "Electrons", "Nuclei", "Sigma bonds"], answer: 1, why: "Only electrons move; the sigma framework and atom positions are identical." },
  },
  {
    id: "hyperconjugation",
    title: "Hyperconjugation — no-bond resonance",
    tagline: "A C–H σ bond donates into an empty p orbital.",
    minutes: 5,
    scene: "hyperconj",
    controls: ["chain", "group"],
    level: "Both",
    story: [
      p("In a carbocation (or an alkene), a σ(C–H) bond on the **adjacent (α) carbon** can overlap with the empty p orbital. The electrons partly leave their bond — giving **no-bond resonance** structures. This is **hyperconjugation**."),
      h("Count the α-hydrogens"),
      p("Stability grows with the number of α-C–H bonds: **CH₃–CH₂⁺ has 3, (CH₃)₂CH⁺ has 6, (CH₃)₃C⁺ has 9**. That is the real reason behind 3° > 2° > 1° carbocations — not just a rule to memorise."),
      table(
        ["Cation", "α-H bonds", "Stability"],
        ["CH₃⁺", "0", "least stable"],
        ["CH₃CH₂⁺ (1°)", "3", "low"],
        ["(CH₃)₂CH⁺ (2°)", "6", "medium"],
        ["(CH₃)₃C⁺ (3°)", "9", "high"],
      ),
      note("tip", "Hyperconjugation also explains why **more substituted alkenes are more stable** (Saytzeff product) and why the –CH₃ group is weakly electron donating (+I and hyperconjugation)."),
    ],
    live: (s) => [`α C–H bonds: ${alphaH(s)}`, `${alphaH(s)} no-bond structures`, `substituent: ${groupLabel(s)}`],
    quiz: { prompt: "Which carbocation is most stabilised by hyperconjugation?", choices: ["CH₃⁺", "CH₃CH₂⁺", "(CH₃)₂CH⁺", "(CH₃)₃C⁺"], answer: 3, why: "tert-Butyl has 9 α-hydrogens — the most no-bond resonance structures." },
  },
  {
    id: "dipole",
    title: "Bond polarity and dipole moment",
    tagline: "Unequal sharing creates a vector you can measure.",
    minutes: 5,
    scene: "dipole",
    controls: ["halogen", "group"],
    level: "CBSE",
    story: [
      p("Electronegativity (EN) is an atom's pull on shared electrons. When ΔEN is between about 0.4 and 1.7, the bond is **polar covalent**: one end is δ⁺, the other δ⁻. Dipole moment μ = charge × distance (in Debye)."),
      p("Bond polarity decides **which carbon a nucleophile attacks** (the δ⁺ end), which way a molecule aligns in an electric field, and how it dissolves."),
      table(
        ["Bond", "ΔEN", "Character"],
        ["C–H", "0.4", "almost non-polar"],
        ["C–I", "0.0–0.5", "weakly polar"],
        ["C–Br", "0.3", "polar"],
        ["C–Cl", "0.5", "polar"],
        ["C–F", "1.5", "strongly polar"],
        ["C–O", "1.0", "strongly polar"],
      ),
      note("remember", "A molecule can have polar bonds and **zero net dipole** if they cancel by symmetry: CO₂ and CCl₄ are non-polar even though every bond in them is polar."),
    ],
    live: (s) => [enInfo(s), `halogen: ${s.halogen}`, `group: ${groupLabel(s)}`],
    quiz: { prompt: "Which molecule has polar bonds but zero dipole moment?", choices: ["H₂O", "CHCl₃", "CCl₄", "NH₃"], answer: 2, why: "In tetrahedral CCl₄ the four C–Cl dipoles cancel exactly by symmetry." },
  },
  {
    id: "intermolecular",
    title: "Intermolecular forces → physical properties",
    tagline: "Boiling point is a story about attractions, not memorised numbers.",
    minutes: 6,
    scene: "intermolecular",
    controls: ["halogen", "chain"],
    level: "Both",
    story: [
      p("Boiling point depends on how strongly molecules hold each other. In increasing strength: **London dispersion < dipole–dipole < hydrogen bonding < ionic**."),
      steps(
        "More electrons / bigger surface area → stronger London forces → higher b.p. (hence b.p. rises up a homologous series).",
        "Branching makes a molecule more compact → less surface contact → **lower** b.p. (neo-pentane < iso-pentane < n-pentane).",
        "Hydrogen bonding (with O–H, N–H, F–H) causes a huge jump: compare ethanol (78 °C) with ethane (−89 °C).",
      ),
      p("Haloalkanes have a permanent dipole, so their b.p. is higher than alkanes of similar mass. They are **denser than water** but barely soluble: they cannot hydrogen-bond with water because they have no O–H or N–H."),
      note("watch", "Among halogens the b.p. order for the same alkyl group is **RI > RBr > RCl > RF** — mass/polarisability wins even though C–F is the most polar bond."),
    ],
    live: (s) => [`halogen: ${s.halogen}`, `chain: ${s.chain} C → larger surface`, "H-bonding absent in R–X"],
    quiz: { prompt: "Why does n-pentane boil higher than neopentane?", choices: ["More mass", "Larger surface area for London forces", "Stronger dipole", "Hydrogen bonding"], answer: 1, why: "Same formula; the straight chain has more surface contact, so dispersion forces are stronger." },
  },
  {
    id: "acid-base",
    title: "Acidic and basic strength — the pKa ladder",
    tagline: "A 1-unit pKa change means ten times stronger.",
    minutes: 7,
    scene: "acidBase",
    controls: ["group"],
    level: "Both",
    story: [
      p("An acid donates H⁺; a base accepts it. Strength is measured by **pKa** (lower = stronger). Because the scale is logarithmic, **pKa 3 is 100× stronger than pKa 5**."),
      h("What makes an acid strong?"),
      p("The conjugate base must be **stable**. Three effects stabilise it: (1) electronegativity of the atom holding the charge, (2) resonance delocalisation, (3) inductive electron withdrawal."),
      table(
        ["Compound", "pKa ≈", "Reason"],
        ["HCl", "−7", "Very stable Cl⁻"],
        ["R–COOH", "4.8", "Resonance over two oxygens"],
        ["Ph–OH", "10", "Phenoxide stabilised by ring resonance"],
        ["H₂O", "15.7", "Reference"],
        ["R–OH", "16", "Alkoxide not resonance-stabilised"],
        ["HC≡CH", "25", "sp carbon (50% s-character)"],
      ),
      p("Acid strength order: **carboxylic acid > phenol > water > alcohol > terminal alkyne > alkene > alkane**. Electron-withdrawing groups (–NO₂, –Cl) lower pKa; electron-donating alkyl groups raise it."),
      note("tip", "Basicity is the mirror image: a **stable conjugate base means a weak base**. Compare phenoxide (stable, weak base) with ethoxide (unstable, strong base)."),
    ],
    live: (s) => [`group: ${groupLabel(s)}`, "lower pKa = stronger acid", "Δ1 pKa = ×10 strength"],
    quiz: { prompt: "Why is phenol more acidic than ethanol?", choices: ["Phenol has more carbons", "Phenoxide is resonance-stabilised", "Ethanol has a stronger O–H bond", "Phenol is less soluble"], answer: 1, why: "The negative charge in phenoxide delocalises into the aromatic ring; ethoxide has no such resonance." },
  },
  {
    id: "carbocation",
    title: "Carbocations — flat, eager and prone to rearrange",
    tagline: "The planar sp² cation explains racemisation and rearrangements.",
    minutes: 6,
    scene: "carbocation",
    controls: ["group", "chain", "stereo"],
    level: "Both",
    story: [
      p("A carbocation (R₃C⁺) has only **six electrons** in its valence shell and an **empty p orbital**. It is sp² hybridised and **planar**. That flatness is not a detail — it is why a nucleophile can attack from either face."),
      h("Stability order and why"),
      steps(
        "**3° > 2° > 1° > CH₃⁺** — alkyl groups donate by +I and hyperconjugation.",
        "Resonance beats degree: **allylic and benzylic cations are very stable** even when primary.",
        "A less stable cation will **rearrange** (hydride shift or methyl shift) to a more stable one before it is trapped.",
      ),
      example("Rearrangement you must spot", "CH₃–CH₂–CH⁺–CH₃  →  1,2-H shift  →  CH₃–C⁺(CH₃)–CH₃", "(2° cation becomes 3° before attack)"),
      note("watch", "If your SN1 product has a rearranged carbon skeleton, you did not make a mistake — you forgot the rearrangement."),
    ],
    live: (s) => [`cation carbon is sp² · planar`, `α-H bonds: ${alphaH(s)}`, s.stereo ? "attack either face → racemic" : "3° > 2° > 1° > methyl"],
    quiz: { prompt: "A carbocation is:", choices: ["sp³ and pyramidal", "sp² and planar", "sp and linear", "octet-complete"], answer: 1, why: "Six electrons, an empty p orbital and trigonal planar geometry." },
  },
  {
    id: "intermediates",
    title: "Reaction intermediates — electron count and shape",
    tagline: "Carbocation, carbanion, radical, carbene: know all four.",
    minutes: 6,
    scene: "intermediates",
    controls: ["group", "chain"],
    level: "JEE",
    story: [
      table(
        ["Intermediate", "Electrons on C", "Shape", "Character", "Stabilised by"],
        ["Carbocation R₃C⁺", "6", "Planar sp²", "Electrophile", "+I, resonance, hyperconjugation"],
        ["Carbanion R₃C⁻", "8 (lone pair)", "Pyramidal sp³", "Nucleophile", "−I, resonance, s-character"],
        ["Free radical R₃C•", "7", "Planar/sp²", "Both", "Resonance > 3° > 2° > 1°"],
        ["Carbene R₂C:", "6", "Singlet bent / triplet linear", "Both", "Substituents, resonance"],
      ),
      p("Electron count determines shape, and shape determines stereochemistry. A **carbanion** is pyramidal and can be chiral; a **carbocation** is flat and racemises; a **radical** is nearly flat and usually racemises too."),
      p("For carbanions the stability order is **the reverse** of carbocations: CH₃⁻ > 1° > 2° > 3°, because alkyl groups push electrons onto an already negative centre. Electron-withdrawing groups (–NO₂, –CN, –CO) stabilise carbanions strongly."),
      note("remember", "Resonance stabilises **every** intermediate — it is the most powerful stabilising effect overall."),
    ],
    live: (s) => [`substituent: ${groupLabel(s)}`, `chain: ${s.chain} C`, "resonance > hyperconjugation > inductive"],
    quiz: { prompt: "Which intermediate is pyramidal with a lone pair?", choices: ["Carbocation", "Carbanion", "Free radical", "Carbene"], answer: 1, why: "A carbanion has 8 electrons (three bonds + a lone pair) and is sp³/pyramidal." },
  },
  {
    id: "nucleophile-electrophile",
    title: "Nucleophiles, electrophiles and leaving groups",
    tagline: "Every reaction is a conversation between electron-rich and electron-poor.",
    minutes: 6,
    scene: "nucleophile",
    controls: ["halogen", "solvent"],
    level: "Both",
    story: [
      p("A **nucleophile (Nu⁻)** donates an electron pair (electron-rich: OH⁻, CN⁻, I⁻, NH₃, RO⁻). An **electrophile (E⁺)** accepts an electron pair (electron-poor: H⁺, carbocations, the δ⁺ carbon of R–X, carbonyl carbon). A **leaving group (X⁻)** departs with the electron pair."),
      h("Good leaving groups are weak bases"),
      p("The best leaving groups are the conjugate bases of **strong acids**: **I⁻ > Br⁻ > Cl⁻ >> F⁻** (HI is a stronger acid than HF, so I⁻ is a far weaker base and a far better leaving group). –OH is a terrible leaving group; protonating it to –OH₂⁺ turns it into water, an excellent one."),
      table(
        ["Group", "Leaving ability", "Note"],
        ["I⁻", "Best", "Weakest base, C–I weakest bond"],
        ["Br⁻", "Very good", "Common in lab synthesis"],
        ["Cl⁻", "Good", "Needs stronger conditions"],
        ["F⁻", "Poor", "C–F is the strongest bond"],
        ["OH⁻", "Very poor", "Protonate to H₂O first"],
      ),
      note("tip", "Strong nucleophile + polar aprotic solvent → **SN2**. Weak nucleophile + polar protic solvent → **SN1** (the solvent can ionise the substrate)."),
    ],
    live: (s) => [`leaving group: ${s.halogen}⁻`, bondInfo(s), `solvent: ${s.solvent}`],
    quiz: { prompt: "Best leaving group among the halides:", choices: ["F⁻", "Cl⁻", "Br⁻", "I⁻"], answer: 3, why: "I⁻ is the weakest base and C–I is the weakest bond, so iodide leaves most readily." },
  },
  {
    id: "stereo-basics",
    title: "Stereochemistry — chirality and R/S",
    tagline: "Four different groups make a carbon a handed centre.",
    minutes: 7,
    scene: "stereo",
    controls: ["stereo"],
    level: "Both",
    story: [
      p("A carbon attached to **four different groups** is **chiral** (a stereocentre). Its mirror image cannot be superimposed — like your left and right hands. Molecules with one stereocentre exist as a pair of **enantiomers**."),
      h("Assigning R / S"),
      steps(
        "Rank the four groups 1 → 4 by CIP priority (higher atomic number = higher priority; isotopes by mass).",
        "Point the lowest priority group (4) **away** from you.",
        "Trace 1 → 2 → 3: **clockwise = R** (rectus), **anticlockwise = S** (sinister).",
      ),
      p("A 1:1 mixture of enantiomers is **racemic** and optically inactive. A single enantiomer is optically active. **SN2 inverts** the configuration (Walden inversion); **SN1 racemises** because its flat cation can be attacked from both faces."),
      note("watch", "If groups 4 is pointing **towards** you, reverse the answer you get. This one trap costs marks in every exam."),
    ],
    live: (s) => [s.stereo ? "chiral centre present" : "achiral centre", "4 different groups → R or S", "SN2 inverts · SN1 racemises"],
    quiz: { prompt: "A carbon with four different groups is:", choices: ["Achiral", "Chiral", "Always R", "Always optically inactive"], answer: 1, why: "Four different substituents make it a stereocentre — chirality means non-superimposable mirror images." },
  },
  {
    id: "conformation",
    title: "Conformations — Newman projection and strain",
    tagline: "Rotation is free in σ bonds, but not all angles are equal.",
    minutes: 6,
    scene: "conformation",
    controls: ["heat", "chain"],
    level: "JEE",
    story: [
      p("A C–C σ bond can rotate, giving **conformers**. A **Newman projection** looks straight down that bond: the front carbon is a dot, the back carbon a circle. The two extremes are **staggered** (lowest energy) and **eclipsed** (highest energy)."),
      h("The energy ladder for ethane/butane"),
      steps(
        "**Staggered anti** (large groups 180° apart): most stable — no torsional or steric strain.",
        "**Staggered gauche** (60°): a little steric strain in butane.",
        "**Eclipsed**: torsional strain from aligned bonds; **fully eclipsed** (large groups at 0°) is worst.",
      ),
      p("Heating a sample gives molecules enough energy to cross these barriers, so conformers interconvert rapidly at room temperature — but the **anti** form always dominates the population."),
      note("tip", "In cyclic systems this becomes axial/equatorial: a bulky group prefers **equatorial** to avoid 1,3-diaxial interactions."),
    ],
    live: (s) => [`heat: ${s.heat} °C`, s.heat > 55 ? "eclipsed / higher energy" : "staggered / lower energy", `chain: ${s.chain} C`],
    quiz: { prompt: "Most stable conformation of n-butane:", choices: ["Fully eclipsed", "Eclipsed", "Gauche", "Anti staggered"], answer: 3, why: "Anti staggered keeps the two methyl groups 180° apart — minimum torsional and steric strain." },
  },
  {
    id: "aromaticity",
    title: "Aromaticity — Hückel's (4n+2) rule",
    tagline: "Planar, cyclic, fully conjugated and 4n+2 π electrons.",
    minutes: 6,
    scene: "aromaticity",
    controls: ["group"],
    level: "Both",
    story: [
      p("An aromatic compound is **cyclic, planar, fully conjugated** and has **(4n+2) π electrons**. Benzene has 6 π electrons (n = 1) and is aromatic; cyclobutadiene has 4 (n = 1 for 4n) and is **antiaromatic** and unstable."),
      h("The four tests — apply them in order"),
      steps("Is it a ring?", "Is every ring atom sp² (or sp) — continuous p orbitals?", "Is it planar?", "Count π electrons: 4n+2 aromatic, 4n antiaromatic, otherwise non-aromatic."),
      p("Aromatic rings are **unusually stable**: they resist addition (which would destroy aromaticity) and prefer **substitution**. Hückel's rule also explains why cyclopentadienyl anion (6π) is aromatic while the cation (4π) is not."),
      note("watch", "Naphthalene (10π), anthracene (14π) and the tropylium cation (6π) are all aromatic — count the whole conjugated loop, not each ring separately."),
    ],
    live: (s) => ["6 π electrons (n=1)", "planar · cyclic · conjugated", `group: ${groupLabel(s)}`],
    quiz: { prompt: "Which species is aromatic?", choices: ["Cyclobutadiene (4π)", "Cyclopentadiene (4π in ring)", "Tropylium cation (6π)", "Cyclooctatetraene (8π)"], answer: 2, why: "Tropylium has 6 π electrons and is planar — it satisfies 4n+2 with n=1." },
  },
  {
    id: "sn2",
    title: "SN2 — one step, backside attack, inversion",
    tagline: "Rate = k[RX][Nu⁻]. Geometry flips like an umbrella in wind.",
    minutes: 7,
    scene: "sn2",
    controls: ["mechanism", "halogen", "solvent", "stereo"],
    level: "Both",
    story: [
      p("SN2 is **concerted**: the nucleophile attacks from the side opposite the leaving group while the C–X bond breaks — all in one step. There is **no intermediate**, only a pentacoordinate transition state."),
      h("The rules"),
      steps(
        "**Rate = k[RX][Nu⁻]** — both species appear in the slow step.",
        "Backside attack gives **Walden inversion** at a stereocentre.",
        "Substrate order: **CH₃X > 1° > 2° >> 3°** (3° is blocked sterically).",
        "Favoured by a **strong nucleophile** and a **polar aprotic** solvent (DMSO, DMF, acetone).",
      ),
      p("Leaving group ability matters: I⁻ > Br⁻ > Cl⁻ >> F⁻. A protic solvent hydrogen-bonds to the nucleophile and slows it down — the same reagent is much faster in DMSO than in water."),
      note("remember", "If the question shows a chiral alkyl halide and asks for the product, check for inversion first. That is the single most tested SN2 fact."),
    ],
    live: (s) => [`leaving group: ${s.halogen}⁻`, `solvent: ${s.solvent}`, s.mechanism === "SN2" ? "concerted · inversion" : "switch to SN2 to see it"],
    quiz: { prompt: "SN2 is fastest with:", choices: ["3° alkyl halide", "2° alkyl halide", "1° alkyl halide", "Aryl halide"], answer: 2, why: "Less steric hindrance means faster backside attack: methyl > 1° > 2° >> 3°." },
  },
  {
    id: "sn1",
    title: "SN1 — ionisation first, racemisation next",
    tagline: "Rate = k[RX]. The carbocation is the star of the show.",
    minutes: 7,
    scene: "sn1",
    controls: ["mechanism", "halogen", "stereo"],
    level: "Both",
    story: [
      p("SN1 happens in **two steps**. First the leaving group departs slowly to give a **planar carbocation** (this is the rate-determining step). Then the nucleophile attacks quickly from either face."),
      h("The rules"),
      steps(
        "**Rate = k[RX]** — nucleophile concentration does not appear in the rate law.",
        "Substrate order: **3° > 2° >> 1°** (follows carbocation stability).",
        "Attack on both faces gives a **racemic mixture** (often partial racemisation from ion-pair effects).",
        "Favoured by a **polar protic** solvent, which stabilises the ions, and a **weak nucleophile**.",
      ),
      p("Because a carbocation forms, **rearrangements are possible**. A 1,2-hydride or methyl shift can move the positive charge to a more stable carbon before the nucleophile arrives."),
      note("watch", "SN1 and E1 share the same carbocation — they always compete. Heat favours elimination; a small nucleophile favours substitution."),
    ],
    live: (s) => [`leaving group: ${s.halogen}⁻`, "rate = k[RX] only", s.stereo ? "racemisation possible" : "carbocation rearranges"],
    quiz: { prompt: "The rate-determining step of SN1 is:", choices: ["Nucleophile attack", "Ionisation to a carbocation", "Deprotonation", "Backside attack"], answer: 1, why: "Slow loss of the leaving group forms the carbocation; the nucleophile then attacks fast." },
  },
  {
    id: "solvent-effects",
    title: "Solvent effects — protic vs aprotic",
    tagline: "The medium can decide which mechanism wins.",
    minutes: 5,
    scene: "solvent",
    controls: ["solvent", "mechanism"],
    level: "Both",
    story: [
      p("**Polar protic** solvents (water, alcohols) have O–H or N–H bonds and hydrogen-bond to anions. They surround and stabilise the nucleophile, making it less reactive — but they stabilise carbocations and leaving groups, helping SN1."),
      p("**Polar aprotic** solvents (DMSO, DMF, acetone, DMAC) have no acidic H. They solvate cations but leave anions **naked and aggressive**, which strongly accelerates SN2."),
      table(
        ["Solvent", "Example", "Effect on Nu⁻", "Favours"],
        ["Polar protic", "H₂O, EtOH", "H-bonded, slower", "SN1 / E1"],
        ["Polar aprotic", "DMSO, DMF", "Bare, faster", "SN2 / E2"],
        ["Non-polar", "Hexane, CCl₄", "Poor ion solvation", "Radical reactions"],
      ),
      note("tip", "F⁻ is a weak nucleophile in water (heavily hydrated) but a **strong** nucleophile in DMSO. Same ion, different solvent, opposite behaviour."),
    ],
    live: (s) => [`solvent: ${s.solvent}`, s.solvent === "protic" ? "Nu⁻ hydrogen-bonded → SN1" : "naked Nu⁻ → fast SN2", `mechanism: ${s.mechanism}`],
    quiz: { prompt: "A polar aprotic solvent favours:", choices: ["SN1", "SN2", "No reaction", "Only E1"], answer: 1, why: "It leaves the nucleophile unsolvated and highly reactive — the hallmark of SN2." },
  },
  {
    id: "elimination",
    title: "Elimination — E1, E2 and Saytzeff vs Hofmann",
    tagline: "Take a β-H, form an alkene, choose the product.",
    minutes: 7,
    scene: "elimination",
    controls: ["mechanism", "heat", "halogen"],
    level: "Both",
    story: [
      p("Elimination removes H and X from adjacent carbons to make a π bond. It needs a **β-hydrogen**. E2 is concerted (like SN2) and needs a strong base; E1 is two-step (like SN1) and goes through a carbocation."),
      h("Which alkene wins?"),
      steps(
        "**Saytzeff product** = more substituted alkene — more stable by hyperconjugation. Usual answer with a small base.",
        "**Hofmann product** = less substituted alkene — favoured by a **bulky base** (t-BuOK) or a poor leaving group.",
        "**Heat favours elimination** over substitution (more particles, higher entropy).",
      ),
      p("E2 has a strict stereochemical requirement: the β-H and leaving group must be **anti-periplanar** (coplanar and opposite). In cyclohexanes this means both must be **axial** — a trans-diaxial arrangement."),
      note("watch", "No β-hydrogen means **no elimination**. Neopentyl halides (no β-H) can only substitute."),
    ],
    live: (s) => [`mechanism: ${s.mechanism}`, s.heat > 60 ? "heat → Hofmann favoured" : "Saytzeff (more substituted)", `leaving group: ${s.halogen}`],
    quiz: { prompt: "A bulky base in elimination gives mainly:", choices: ["Saytzeff product", "Hofmann product", "No alkene", "A carbocation"], answer: 1, why: "Steric hindrance makes the base grab the easiest (least hindered) β-H — the Hofmann product." },
  },
  {
    id: "eas",
    title: "Electrophilic aromatic substitution",
    tagline: "Keep the aromatic ring; swap one H for an electrophile.",
    minutes: 6,
    scene: "benzeneEAS",
    controls: ["group"],
    level: "Both",
    story: [
      p("Benzene resists addition because it would destroy aromaticity. Instead it undergoes **substitution**: an electrophile replaces one H in two steps — E⁺ attacks to give a resonance-stabilised **arenium (σ) complex**, then H⁺ leaves and aromaticity returns."),
      h("Directing effects — a high-yield table"),
      table(
        ["Substituent", "Effect", "Directs to", "Example"],
        ["–OH, –OR, –NH₂", "Strongly activating, +R", "ortho / para", "Phenol"],
        ["–CH₃, –R", "Weakly activating, +I/H", "ortho / para", "Toluene"],
        ["–F, –Cl, –Br, –I", "Deactivating, −I but +R", "ortho / para", "Chlorobenzene"],
        ["–NO₂, –CN, –CHO, –COOH", "Strongly deactivating, −R", "meta", "Nitrobenzene"],
      ),
      p("Halogen is the famous exception: it **deactivates** the ring (−I dominates) yet directs **ortho/para** because its lone pair can donate by resonance to stabilise the σ-complex."),
      note("watch", "Never answer 'addition' for benzene with Br₂/FeBr₃ — the catalyst generates Br⁺, and the product is bromobenzene, not an addition product."),
    ],
    live: (s) => [`substituent: ${groupLabel(s)}`, "E⁺ → σ-complex → H⁺ leaves", "aromaticity restored"],
    quiz: { prompt: "Chlorine on benzene is:", choices: ["Activating and meta directing", "Deactivating but ortho/para directing", "Activating and ortho/para directing", "Deactivating and meta directing"], answer: 1, why: "−I deactivates the ring; +R lone-pair donation directs ortho/para." },
  },
  {
    id: "grignard",
    title: "Grignard reagents — carbon becomes a nucleophile",
    tagline: "R–X + Mg → R–MgX, the gateway to alcohols and acids.",
    minutes: 6,
    scene: "grignard",
    controls: ["chain", "halogen"],
    level: "Both",
    story: [
      p("An alkyl halide reacts with magnesium in **dry ether** to give R–MgX, a Grignard reagent. The C–Mg bond is strongly polarised: carbon is **δ⁻** and behaves like **R⁻** — a superb nucleophile and a very strong base."),
      h("The three reactions you must know"),
      steps(
        "With **formaldehyde** → primary alcohol.",
        "With an **aldehyde** (other than HCHO) → secondary alcohol.",
        "With a **ketone** → tertiary alcohol; with **CO₂** → carboxylic acid after acidification.",
      ),
      p("Grignards are destroyed instantly by water, alcohols and acids (R–MgX + H₂O → R–H). That is why the ether must be **anhydrous** and why the final step is a separate acidic work-up."),
      note("watch", "Work backwards in synthesis questions: the alcohol's –OH carbon was once the carbonyl carbon, and the groups attached to it come from R–MgX."),
    ],
    live: (s) => [`R = C${s.chain} group`, `X = ${s.halogen}`, "dry ether · moisture-free"],
    quiz: { prompt: "Grignard reagent must be prepared in:", choices: ["Water", "Wet alcohol", "Dry ether", "Dilute acid"], answer: 2, why: "Any protic solvent would protonate and destroy the highly basic R–MgX." },
  },
  {
    id: "workshop-goc",
    title: "GOC workshop — the decision tree",
    tagline: "Read the substrate, pick the effect, predict the product.",
    minutes: 8,
    scene: "workshop",
    controls: ["chain", "halogen", "group", "effect", "hybrid", "mechanism", "solvent", "stereo", "heat"],
    level: "Both",
    story: [
      p("You now have the whole toolkit. Use this order for **every** GOC problem, board or JEE:"),
      steps(
        "**Hybridisation first** — sp²/sp carbons (aryl, vinyl) cannot do normal SN1/SN2.",
        "**Identify the effects** — −I/+I, ±R, hyperconjugation; rank stability of any cation, anion or radical.",
        "**Choose the mechanism** — SN2 for methyl/1° + strong Nu⁻ + aprotic; SN1 for 3°/benzylic + protic.",
        "**Check stereochemistry and rearrangement** — inversion, racemisation, hydride/methyl shifts.",
        "**Elimination vs substitution** — heat and bulky base push E2; Saytzeff vs Hofmann decides the alkene.",
      ),
      example("Worked mini-problem", "2-bromobutane + NaI in acetone (DMF)", "→ 1°/2° substrate, strong Nu⁻, aprotic → SN2", "→ 2-iodobutane with inversion at C2"),
      note("tip", "When stuck, write the intermediate on paper and rank every possible resonance/hyperconjugation contributor. The answer almost always follows stability."),
    ],
    live: (s) => [`chain ${s.chain} · X ${s.halogen} · ${groupLabel(s)}`, `${s.mechanism} in ${s.solvent}`, s.heat > 60 ? "heat → elimination" : "substitution likely"],
    quiz: { prompt: "First question to ask about an unknown organic reaction:", choices: ["What is the product colour?", "What is the hybridisation of the reacting carbon?", "How much does it cost?", "What is the boiling point?"], answer: 1, why: "Hybridisation decides whether substitution is even possible — always start with structure." },
  },
];

export const GOC_COURSE: ChemCourse = {
  id: GOC_COURSE_ID,
  title: GOC_COURSE_TITLE,
  tagline: "Free for every student — organic chemistry from first principles to JEE level.",
  chapter: "General Organic Chemistry",
  concepts: GOC_CONCEPTS,
};
