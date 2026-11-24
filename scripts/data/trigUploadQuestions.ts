/**
 * Class 11 Mathematics — "Trigonometric Functions": 100 exercises, as
 * photo-upload questions, in two batches of 50.
 *
 * Batch 1 (Questions 1–50) arrived as OCR text that dropped or mangled most
 * π-fractions, superscripts and minus signs. Every item there was reconstructed
 * and checked against the worked solution printed underneath it (and, where the
 * print was itself wrong, against arithmetic) before it was written down. Where
 * the worksheet's own statement or answer is wrong, the corrected text is what
 * is asked and the `explanation` says what was fixed.
 *
 * Batch 2 (Questions 51–100) continues the same chapter: domain, range and
 * periodicity; general solutions of trigonometric equations (two papers); and
 * the multiple/sub-multiple-angle and conditional-identity work that rounds the
 * chapter off. Every solution below was worked and re-checked by hand.
 *
 * This file is data only. `scripts/seed-trig-upload.ts` loads it.
 */

export type TrigQuestion = {
  /** Short label used in logs, e.g. "q07". */
  key: string;
  /** The corrected question exactly as the student sees it. */
  stem: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  /** Concept tags, on top of the shared chapter tags. */
  tags: string[];
  /** The model answer: full working, used as the reference for marking. */
  explanation: string;
};

/** Applied to every question in the set. */
export const TRIG_TAGS = ["trigonometric-functions", "class-11-maths"];

export const CHAPTER = "Trigonometric Functions";

/** Ten questions per assessment, in worksheet order. */
export const ASSESSMENT_GROUPS: { number: string; title: string; from: number; to: number; instructions: string }[] = [
  {
    number: "01",
    title: "Trigonometric Functions 01: Radians, Arcs & Trigonometric Ratios",
    from: 1,
    to: 10,
    instructions:
      "Questions 1–10 of the Trigonometric Functions worksheet. Write each answer by hand, " +
      "photograph your working (one photo per question is fine, keep it sharp and well lit), " +
      "and upload it against that question. Show every step — a bare final number is not enough " +
      "to award the mark. Part (a) means the first sub-question of that item.",
  },
  {
    number: "02",
    title: "Trigonometric Functions 02: Exact Values & Quadrant Signs",
    from: 11,
    to: 20,
    instructions:
      "Questions 11–20. Give exact values (surds and fractions, never a decimal approximation) " +
      "and photograph your working for each question before uploading it.",
  },
  {
    number: "03",
    title: "Trigonometric Functions 03: Compound Angle Identities",
    from: 21,
    to: 30,
    instructions:
      "Questions 21–30. Every item is a proof or an evaluation using the compound angle formulas. " +
      "Photograph the full chain of steps for each one and upload it against the question.",
  },
  {
    number: "04",
    title: "Trigonometric Functions 04: Sum, Difference & Product Identities",
    from: 31,
    to: 40,
    instructions:
      "Questions 31–40. State the identity you are using at each step, photograph your working, " +
      "and upload one photo per question.",
  },
  {
    number: "05",
    title: "Trigonometric Functions 05: Products-to-Sums & Advanced Identities",
    from: 41,
    to: 50,
    instructions:
      "Questions 41–50, the hardest set on the worksheet. Show the formula being used at every " +
      "line, photograph your working, and upload one photo per question.",
  },
  {
    number: "06",
    title: "Trigonometric Functions 06: Graphs, Domain, Range & Periodicity",
    from: 51,
    to: 60,
    instructions:
      "Questions 51–60. For each function give the domain — and where asked the range or the " +
      "period — with your reasoning. Write by hand, photograph your working, and upload one photo " +
      "per question.",
  },
  {
    number: "07",
    title: "Trigonometric Functions 07: Trigonometric Equations — General Solutions",
    from: 61,
    to: 70,
    instructions:
      "Questions 61–70. Give the complete general solution (the whole family of angles), never a " +
      "single value. State at each step which standard result you are using — sin θ = sin α, " +
      "cos θ = cos α or tan θ = tan α. Photograph your working and upload one photo per question.",
  },
  {
    number: "08",
    title: "Trigonometric Functions 08: Equations by Factorising & Reduction",
    from: 71,
    to: 80,
    instructions:
      "Questions 71–80. These equations must first be reduced — by sum-to-product formulae or by " +
      "substitution — before the general solution can be read off. Show the reduction, then the " +
      "solution; photograph your working and upload one photo per question.",
  },
  {
    number: "09",
    title: "Trigonometric Functions 09: Multiple & Sub-multiple Angles",
    from: 81,
    to: 90,
    instructions:
      "Questions 81–90. Use the double- and triple-angle formulae and the half-angle formulae. For " +
      "the proofs, work one side down to the other line by line; photograph your working and upload " +
      "one photo per question.",
  },
  {
    number: "10",
    title: "Trigonometric Functions 10: Conditional Identities",
    from: 91,
    to: 100,
    instructions:
      "Questions 91–100. Each identity holds under a stated condition (for example A + B + C = π). " +
      "Use the condition explicitly at the step where it enters; photograph your full working and " +
      "upload one photo per question.",
  },
];

export const SEED_QUESTIONS: TrigQuestion[] = [
  /* -------------------------------------------------- 01 · degree ↔ radian */
  {
    key: "q01",
    difficulty: "EASY",
    tags: ["radian-measure"],
    stem: `Question 1. Find the radian measure corresponding to the following degree measures:
(a) 15°
(b) −37° 30′
(c) 240°
(d) 530°`,
    explanation:
      "Use 1° = π/180 radians, so degrees × π/180 gives radians.\n" +
      "(a) 15° × π/180 = 15π/180 = π/12 radians.\n" +
      "(b) −37° 30′ = −37.5° = −(75/2)°; (75/2) × π/180 = 75π/360 = 5π/24, so the answer is −5π/24 radians.\n" +
      "(c) 240° × π/180 = 240π/180 = 4π/3 radians.\n" +
      "(d) 530° × π/180 = 530π/180 = 53π/18 radians.",
  },
  {
    key: "q02",
    difficulty: "EASY",
    tags: ["radian-measure"],
    stem: `Question 2. Find the degree measure corresponding to the following radian measures:
(a) 3/4
(b) −4
(c) 5π/3
(d) 7π/6`,
    explanation:
      "Use 1 radian = 180°/π, so radians × 180°/π gives degrees.\n" +
      "(a) (3/4) × 180°/π ≈ 42.97°. Taking π ≈ 22/7 as the worksheet does: (3/4) × 180 × 7/22 = 135 × 7/22 = 945/22 ≈ 42.95° ≈ 42° 57′.\n" +
      "(b) −4 × 180°/π ≈ −229.18°. With π ≈ 22/7: −4 × 180 × 7/22 = −5040/22 ≈ −229.09° ≈ −229° 5′.\n" +
      "(c) (5π/3) × 180°/π = 5 × 60° = 300°.\n" +
      "(d) (7π/6) × 180°/π = 7 × 30° = 210°.\n" +
      "Parts (c) and (d) are exact; (a) and (b) are irrational angles, so they are rounded to the nearest minute.",
  },
  {
    key: "q03",
    difficulty: "EASY",
    tags: ["radian-measure"],
    stem: "Question 3. A wheel makes 360 revolutions in one minute. Through how many radians does it turn in one second?",
    explanation:
      "One revolution = 2π radians, so 360 revolutions = 360 × 2π = 720π radians per minute.\n" +
      "Per second that is 720π / 60 = 12π radians per second (≈ 37.70 rad/s).",
  },

  /* ------------------------------------------------------- 04–07 · arc length */
  {
    key: "q04",
    difficulty: "EASY",
    tags: ["arc-length"],
    stem: "Question 4. Find the degree measure of the angle subtended at the centre of a circle of diameter 200 cm by an arc of length 22 cm.",
    explanation:
      "Radius r = 200/2 = 100 cm, arc length l = 22 cm.\n" +
      "θ = l/r = 22/100 = 0.22 radians.\n" +
      "In degrees: 0.22 × 180°/π ≈ 0.22 × 57.2958° ≈ 12.6° = 12° 36′. " +
      "(With π ≈ 22/7: 0.22 × 180 × 7/22 = 12.6° exactly = 12° 36′.)",
  },
  {
    key: "q05",
    difficulty: "MEDIUM",
    tags: ["arc-length"],
    stem: "Question 5. In a circle of diameter 40 cm, the length of a chord is 20 cm. Find the length of the minor arc corresponding to the chord.",
    explanation:
      "Radius r = 40/2 = 20 cm. The chord equals the radius (20 cm), so the triangle " +
      "formed by the centre and the chord's ends is equilateral and the central angle is 60° = π/3 radians.\n" +
      "Arc length l = rθ = 20 × π/3 = 20π/3 cm ≈ 20.94 cm.",
  },
  {
    key: "q06",
    difficulty: "MEDIUM",
    tags: ["arc-length"],
    stem: "Question 6. If, in two circles, arcs of the same length subtend angles of 60° and 75° at the centre, find the ratio of their radii.",
    explanation:
      "Same arc length: l = r₁θ₁ = r₂θ₂, so r₁/r₂ = θ₂/θ₁.\n" +
      "θ₁ = 60° = π/3, θ₂ = 75° = 5π/12 (the angle ratio does not depend on the unit as long as both are in the same one).\n" +
      "r₁/r₂ = 75/60 = 5/4, i.e. the radii are in the ratio 5 : 4.",
  },
  {
    key: "q07",
    difficulty: "MEDIUM",
    tags: ["arc-length"],
    stem: `Question 7. Find the angle in radians through which a pendulum swings if its length is 75 cm and the tip describes an arc of length
(i) 10 cm
(ii) 15 cm
(iii) 21 cm`,
    explanation:
      "θ = l/r with r = 75 cm.\n" +
      "(i) θ = 10/75 = 2/15 radians.\n" +
      "(ii) θ = 15/75 = 1/5 radians.\n" +
      "(iii) θ = 21/75 = 7/25 radians.",
  },

  /* ------------------------------------------- 08–11 · ratios from one value */
  {
    key: "q08",
    difficulty: "MEDIUM",
    tags: ["trigonometric-ratios", "quadrant-signs"],
    stem: "Question 8. Find the values of the other five trigonometric functions if cos θ = −1/2 and θ lies in quadrant III.",
    explanation:
      "Quadrant III: cos θ and sec θ are negative; sin θ and cosec θ are negative; tan θ and cot θ are positive.\n" +
      "cos θ = −1/2 ⇒ sec θ = 1/cos θ = −2.\n" +
      "sin²θ = 1 − cos²θ = 1 − 1/4 = 3/4 ⇒ sin θ = −√3/2 (negative in QIII) ⇒ cosec θ = −2/√3.\n" +
      "tan θ = sin θ / cos θ = (−√3/2)/(−1/2) = √3 ⇒ cot θ = 1/√3 = √3/3.\n" +
      "Answers: sin θ = −√3/2, cos θ = −1/2, tan θ = √3, cosec θ = −2/√3, sec θ = −2, cot θ = 1/√3. " +
      "(θ = 240°.)",
  },
  {
    key: "q09",
    difficulty: "MEDIUM",
    tags: ["trigonometric-ratios", "quadrant-signs"],
    stem: "Question 9. Find the values of the other five trigonometric functions if sin θ = 3/5 and θ lies in quadrant II.",
    explanation:
      "Quadrant II: sin θ and cosec θ are positive; cos θ, sec θ, tan θ and cot θ are negative.\n" +
      "sin θ = 3/5 ⇒ cosec θ = 5/3.\n" +
      "cos²θ = 1 − sin²θ = 1 − 9/25 = 16/25 ⇒ cos θ = −4/5 (negative in QII) ⇒ sec θ = −5/4.\n" +
      "tan θ = sin θ/cos θ = (3/5)/(−4/5) = −3/4 ⇒ cot θ = −4/3.\n" +
      "Answers: sin θ = 3/5, cos θ = −4/5, tan θ = −3/4, cosec θ = 5/3, sec θ = −5/4, cot θ = −4/3.",
  },
  {
    key: "q10",
    difficulty: "MEDIUM",
    tags: ["trigonometric-ratios", "quadrant-signs"],
    stem: "Question 10. Find the values of the other five trigonometric functions if tan θ = 3/4 and θ lies in quadrant III.",
    explanation:
      "Quadrant III: tan θ and cot θ are positive; sin θ, cosec θ, cos θ and sec θ are negative.\n" +
      "1 + tan²θ = sec²θ ⇒ 1 + 9/16 = 25/16 = sec²θ ⇒ sec θ = −5/4 (negative in QIII) ⇒ cos θ = −4/5.\n" +
      "sin²θ = 1 − cos²θ = 1 − 16/25 = 9/25 ⇒ sin θ = −3/5 ⇒ cosec θ = −5/3.\n" +
      "cot θ = 1/tan θ = 4/3.\n" +
      "Answers: sin θ = −3/5, cos θ = −4/5, tan θ = 3/4, cosec θ = −5/3, sec θ = −5/4, cot θ = 4/3.",
  },
  {
    key: "q11",
    difficulty: "MEDIUM",
    tags: ["trigonometric-ratios", "quadrant-signs"],
    stem: "Question 11. Find the values of the other five trigonometric functions if sec θ = 13/5 and θ lies in quadrant IV.",
    explanation:
      "Quadrant IV: cos θ and sec θ are positive; sin θ, cosec θ, tan θ and cot θ are negative.\n" +
      "sec θ = 13/5 ⇒ cos θ = 5/13.\n" +
      "sin²θ = 1 − cos²θ = 1 − 25/169 = 144/169 ⇒ sin θ = −12/13 (negative in QIV) ⇒ cosec θ = −13/12.\n" +
      "tan θ = sin θ/cos θ = (−12/13)/(5/13) = −12/5 ⇒ cot θ = −5/12.\n" +
      "Answers: sin θ = −12/13, cos θ = 5/13, tan θ = −12/5, cosec θ = −13/12, sec θ = 13/5, cot θ = −5/12.",
  },

  /* ----------------------------------------------- 12–15 · periodic values */
  {
    key: "q12",
    difficulty: "EASY",
    tags: ["periodic-functions"],
    stem: "Question 12. Find the value of the trigonometric function: sin 765°.",
    explanation:
      "765° = 2 × 360° + 45°, and sine has period 360°, so sin 765° = sin 45° = √2/2 ≈ 0.7071.",
  },
  {
    key: "q13",
    difficulty: "EASY",
    tags: ["periodic-functions"],
    stem: "Question 13. Find the value of the trigonometric function: cosec(−1410°).",
    explanation:
      "cosec(−1410°) = −cosec 1410°. Now 1410° = 4 × 360° − 30°, so cosec 1410° = cosec(−30°) = −2.\n" +
      "Therefore cosec(−1410°) = −(−2) = 2.\n" +
      "(Equivalently: −1410° + 4 × 360° = 30°, and cosec 30° = 2.)",
  },
  {
    key: "q14",
    difficulty: "MEDIUM",
    tags: ["periodic-functions", "compound-angles"],
    stem: "Question 14. Find the value of the trigonometric function: tan(13π/12).",
    explanation:
      "13π/12 = π + π/12, so tan(13π/12) = tan(π/12) (period π).\n" +
      "tan(π/12) = tan(15°) = tan(45° − 30°) = (1 − 1/√3)/(1 + 1/√3) = (√3 − 1)/(√3 + 1) = 2 − √3 ≈ 0.2679.\n" +
      "Answer: 2 − √3.",
  },
  {
    key: "q15",
    difficulty: "MEDIUM",
    tags: ["periodic-functions"],
    stem: "Question 15. Find the value of the trigonometric function: cot(−3π/4).",
    explanation:
      "cot is an odd function: cot(−3π/4) = −cot(3π/4).\n" +
      "3π/4 = π − π/4, so cot(3π/4) = −cot(π/4) = −1.\n" +
      "Hence cot(−3π/4) = −(−1) = 1.\n" +
      "(Equivalently: −3π/4 + π = π/4, and cot has period π, so the value is cot(π/4) = 1.)",
  },

  /* ------------------------------------------ 16–20 · fixed-angle identities */
  {
    key: "q16",
    difficulty: "MEDIUM",
    tags: ["trigonometric-identities"],
    stem: "Question 16. Prove that: sin²(π/6) + cos²(π/6) − 2tan²(π/4) = −1",
    explanation:
      "L.H.S. = sin²(π/6) + cos²(π/6) − 2tan²(π/4).\n" +
      "By the fundamental identity sin²θ + cos²θ = 1, the first two terms give 1.\n" +
      "tan(π/4) = 1, so 2tan²(π/4) = 2 × 1 = 2.\n" +
      "L.H.S. = 1 − 2 = −1 = R.H.S.  Hence proved.",
  },
  {
    key: "q17",
    difficulty: "MEDIUM",
    tags: ["trigonometric-identities"],
    stem: "Question 17. Prove that: 2sin²(π/3) + cosec(7π/6) · cos²(π/6) = 0",
    explanation:
      "L.H.S. = 2sin²(π/3) + cosec(7π/6) · cos²(π/6).\n" +
      "sin(π/3) = √3/2 ⇒ 2sin²(π/3) = 2 × 3/4 = 3/2.\n" +
      "7π/6 = π + π/6, so sin(7π/6) = −sin(π/6) = −1/2 ⇒ cosec(7π/6) = −2.\n" +
      "cos(π/6) = √3/2 ⇒ cos²(π/6) = 3/4.\n" +
      "L.H.S. = 3/2 + (−2)(3/4) = 3/2 − 3/2 = 0 = R.H.S.  Hence proved.",
  },
  {
    key: "q18",
    difficulty: "MEDIUM",
    tags: ["trigonometric-identities"],
    stem: "Question 18. Prove that: 3cos²(π/6) + sec(π/3) + 5tan²(π/3) = 77/4",
    explanation:
      "L.H.S. = 3cos²(π/6) + sec(π/3) + 5tan²(π/3).\n" +
      "cos(π/6) = √3/2 ⇒ cos²(π/6) = 3/4 ⇒ 3cos²(π/6) = 9/4.\n" +
      "sec(π/3) = 1/cos(60°) = 1/(1/2) = 2.\n" +
      "tan(π/3) = √3 ⇒ tan²(π/3) = 3 ⇒ 5tan²(π/3) = 15.\n" +
      "L.H.S. = 9/4 + 2 + 15 = 9/4 + 68/4 = 77/4 = R.H.S.  Hence proved.",
  },
  {
    key: "q19",
    difficulty: "MEDIUM",
    tags: ["trigonometric-identities"],
    stem: "Question 19. Prove that: cot²(π/6) + cosec(π/6) + 3tan²(π/6) = 6",
    explanation:
      "L.H.S. = cot²(π/6) + cosec(π/6) + 3tan²(π/6).\n" +
      "π/6 = 30°: cot 30° = √3 ⇒ cot² = 3; cosec 30° = 2; tan 30° = 1/√3 ⇒ tan² = 1/3 ⇒ 3tan²(π/6) = 1.\n" +
      "L.H.S. = 3 + 2 + 1 = 6 = R.H.S.  Hence proved.",
  },
  {
    key: "q20",
    difficulty: "MEDIUM",
    tags: ["trigonometric-identities"],
    stem: "Question 20. Prove that: 2sin²(π/4) + 2cos²(π/4) + 2sec²(π/3) = 10",
    explanation:
      "L.H.S. = 2sin²(π/4) + 2cos²(π/4) + 2sec²(π/3).\n" +
      "2sin²(π/4) + 2cos²(π/4) = 2[sin²(π/4) + cos²(π/4)] = 2 × 1 = 2.\n" +
      "sec(π/3) = 2 ⇒ sec²(π/3) = 4 ⇒ 2sec²(π/3) = 8.\n" +
      "L.H.S. = 2 + 8 = 10 = R.H.S.  Hence proved.",
  },

  /* ----------------------------------------------- 21–31 · compound angles */
  {
    key: "q21",
    difficulty: "EASY",
    tags: ["compound-angles"],
    stem: "Question 21. Show that: cos 70° cos 10° + sin 70° sin 10° = 1/2",
    explanation:
      "Using cos(A − B) = cos A cos B + sin A sin B with A = 70°, B = 10°:\n" +
      "L.H.S. = cos(70° − 10°) = cos 60° = 1/2 = R.H.S.  Hence proved.\n" +
      "Correction: the printed worksheet shows the right-hand side as \"2\"; the correct value is 1/2.",
  },
  {
    key: "q22",
    difficulty: "EASY",
    tags: ["compound-angles"],
    stem: "Question 22. Show that: cos 130° cos 40° + sin 130° sin 40° = 0",
    explanation:
      "Using cos(A − B) = cos A cos B + sin A sin B with A = 130°, B = 40°:\n" +
      "L.H.S. = cos(130° − 40°) = cos 90° = 0 = R.H.S.  Hence proved.",
  },
  {
    key: "q23",
    difficulty: "EASY",
    tags: ["compound-angles"],
    stem: "Question 23. Show that: sin(40° + θ) cos(10° + θ) − cos(40° + θ) sin(10° + θ) = 1/2",
    explanation:
      "Using sin(A − B) = sin A cos B − cos A sin B with A = 40° + θ and B = 10° + θ:\n" +
      "L.H.S. = sin[(40° + θ) − (10° + θ)] = sin 30° = 1/2 = R.H.S.  Hence proved.\n" +
      "Correction: the printed worksheet shows the right-hand side as \"2\"; the correct value is 1/2.",
  },
  {
    key: "q24",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 24. Prove that: cos(π/4 − θ) cos(π/4 − φ) − sin(π/4 − θ) sin(π/4 − φ) = sin(θ + φ)",
    explanation:
      "The left-hand side is cos(A + B) with A = π/4 − θ and B = π/4 − φ:\n" +
      "L.H.S. = cos[(π/4 − θ) + (π/4 − φ)] = cos[π/2 − (θ + φ)].\n" +
      "Since cos(π/2 − x) = sin x, this equals sin(θ + φ) = R.H.S.  Hence proved.",
  },
  {
    key: "q25",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 25. Prove that: tan(π/4 + x) = (1 + tan x)/(1 − tan x)",
    explanation:
      "tan(π/4 + x) = [tan(π/4) + tan x] / [1 − tan(π/4) tan x] by the tangent addition formula.\n" +
      "tan(π/4) = 1, so this becomes (1 + tan x)/(1 − tan x) = R.H.S.  Hence proved.",
  },
  {
    key: "q26",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 26. Prove that: [cos(π + θ) cos(−θ)] / [sin(π − θ) cos(π/2 + θ)] = cot²θ",
    explanation:
      "Simplify each factor:\n" +
      "cos(π + θ) = −cos θ, cos(−θ) = cos θ, so the numerator is (−cos θ)(cos θ) = −cos²θ.\n" +
      "sin(π − θ) = sin θ, cos(π/2 + θ) = −sin θ, so the denominator is (sin θ)(−sin θ) = −sin²θ.\n" +
      "L.H.S. = (−cos²θ)/(−sin²θ) = cos²θ/sin²θ = cot²θ = R.H.S.  Hence proved.",
  },
  {
    key: "q27",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 27. Prove that: cos θ + sin(270° + θ) − sin(270° − θ) + cos(180° + θ) = 0",
    explanation:
      "sin(270° + θ) = −cos θ, sin(270° − θ) = −cos θ, cos(180° + θ) = −cos θ.\n" +
      "L.H.S. = cos θ + (−cos θ) − (−cos θ) + (−cos θ)\n" +
      "      = cos θ − cos θ + cos θ − cos θ = 0 = R.H.S.  Hence proved.",
  },
  {
    key: "q28",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 28. Prove that: cos(π/2 + θ) · cos(π + θ) · (tan θ + cot θ) = 1",
    explanation:
      "cos(π/2 + θ) = −sin θ and cos(π + θ) = −cos θ, so the product of the first two factors is (−sin θ)(−cos θ) = sin θ cos θ.\n" +
      "tan θ + cot θ = sin θ/cos θ + cos θ/sin θ = (sin²θ + cos²θ)/(sin θ cos θ) = 1/(sin θ cos θ).\n" +
      "L.H.S. = sin θ cos θ × 1/(sin θ cos θ) = 1 = R.H.S.  Hence proved.",
  },
  {
    key: "q29",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 29. Prove that: sin(n + 1)x · sin(n + 2)x + cos(n + 1)x · cos(n + 2)x = cos x",
    explanation:
      "This is cos(A − B) with A = (n + 2)x and B = (n + 1)x:\n" +
      "L.H.S. = cos[(n + 2)x − (n + 1)x] = cos x.\n" +
      "Alternatively, apply cos(A − B) = cos A cos B + sin A sin B directly to A = (n + 1)x, B = (n + 2)x, which gives cos[(n + 1)x − (n + 2)x] = cos(−x) = cos x = R.H.S.  Hence proved.",
  },
  {
    key: "q30",
    difficulty: "MEDIUM",
    tags: ["periodic-functions", "quadrant-signs"],
    stem: `Question 30. Find the value of:
(i) cos 210°
(ii) sin 225°
(iii) tan 330°
(iv) cot(−315°)`,
    explanation:
      "(i) cos 210° = cos(180° + 30°) = −cos 30° = −√3/2.\n" +
      "(ii) sin 225° = sin(180° + 45°) = −sin 45° = −√2/2. " +
      "(Correction: the worksheet writes this as sin(270° + 45°) = cos 45°, which drops the sign; 225° is in quadrant III where sine is negative.)\n" +
      "(iii) tan 330° = tan(360° − 30°) = −tan 30° = −1/√3 = −√3/3.\n" +
      "(iv) cot(−315°): add 360° to get cot 45° = 1. " +
      "(Correction: the worksheet's intermediate step cot(−315°) = −cot 315° is then followed by cot(360° − 45°); going through −315° + 360° = 45° gives the same, correct, result.)",
  },
  {
    key: "q31",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 31. Find the value of tan(α + β), given that cot α = 1/2 with α ∈ (0, π/2), and sec β = −5/3 with β ∈ (π/2, π).",
    explanation:
      "cot α = 1/2 ⇒ tan α = 2 (α is in quadrant I).\n" +
      "sec β = −5/3 ⇒ cos β = −3/5. β ∈ (π/2, π) is quadrant II, where sine is positive: " +
      "sin β = √(1 − 9/25) = 4/5, so tan β = (4/5)/(−3/5) = −4/3.\n" +
      "tan(α + β) = (tan α + tan β)/(1 − tan α tan β) = (2 − 4/3)/(1 − 2 × (−4/3)) " +
      "= (2/3)/(1 + 8/3) = (2/3)/(11/3) = 2/11.\n" +
      "Answer: 2/11.\n" +
      "Correction: β lies in quadrant II (sec β negative ⇒ cos β negative ⇒ β in QII), not quadrant IV — with QIV the numerator would not come out as the worksheet's own 2/11.",
  },

  /* ------------------------------------ 32–40 · sum, difference and products */
  {
    key: "q32",
    difficulty: "MEDIUM",
    tags: ["sum-to-product"],
    stem: "Question 32. Prove the identity: sin(150° + x) + sin(150° − x) = cos x",
    explanation:
      "Using sin(A + B) + sin(A − B) = 2 sin A cos B with A = 150°, B = x:\n" +
      "L.H.S. = 2 sin 150° cos x.\n" +
      "sin 150° = sin(180° − 30°) = sin 30° = 1/2, so L.H.S. = 2 × (1/2) cos x = cos x = R.H.S.  Hence proved.",
  },
  {
    key: "q33",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 33. Prove the identity: cos(π/6 + x) − cos(π/6 − x) = −sin x",
    explanation:
      "Using cos(A + B) − cos(A − B) = −2 sin A sin B with A = π/6, B = x:\n" +
      "L.H.S. = −2 sin(π/6) sin x = −2 × (1/2) sin x = −sin x = R.H.S.  Hence proved.",
  },
  {
    key: "q34",
    difficulty: "MEDIUM",
    tags: ["compound-angles"],
    stem: "Question 34. Prove the identity: cos(π/3 + x) + cos(π/3 − x) = cos x",
    explanation:
      "Using cos(A + B) + cos(A − B) = 2 cos A cos B with A = π/3, B = x:\n" +
      "L.H.S. = 2 cos(π/3) cos x = 2 × (1/2) cos x = cos x = R.H.S.  Hence proved.",
  },
  {
    key: "q35",
    difficulty: "HARD",
    tags: ["multiple-angles"],
    stem: "Question 35. Prove that: sin 2x + 2 sin 4x + sin 6x = 4 cos²x · sin 4x",
    explanation:
      "Group the outer pair: sin 2x + sin 6x = 2 sin 4x cos 2x (sum-to-product).\n" +
      "L.H.S. = 2 sin 4x cos 2x + 2 sin 4x = 2 sin 4x (cos 2x + 1).\n" +
      "Using 1 + cos 2x = 2 cos²x: L.H.S. = 2 sin 4x · 2 cos²x = 4 cos²x sin 4x = R.H.S.  Hence proved.",
  },
  {
    key: "q36",
    difficulty: "HARD",
    tags: ["multiple-angles"],
    stem: "Question 36. Prove that: sin²6x − sin²4x = sin 2x · sin 10x",
    explanation:
      "Use sin²A − sin²B = sin(A + B) sin(A − B) with A = 6x, B = 4x:\n" +
      "L.H.S. = sin(6x + 4x) sin(6x − 4x) = sin 10x · sin 2x = R.H.S.  Hence proved.\n" +
      "Or from first principles: sin²6x − sin²4x = (1 − cos12x)/2 − (1 − cos8x)/2 = (cos8x − cos12x)/2, " +
      "and cos 8x − cos 12x = 2 sin 10x sin 2x.",
  },
  {
    key: "q37",
    difficulty: "HARD",
    tags: ["multiple-angles"],
    stem: "Question 37. Prove that: cos²2x − cos²6x = sin 4x · sin 8x",
    explanation:
      "Use cos²A − cos²B = sin(A + B) sin(B − A) = −sin(A + B) sin(A − B), with A = 2x, B = 6x:\n" +
      "L.H.S. = −sin 8x · sin(−4x) = sin 8x · sin 4x = R.H.S.  Hence proved.\n" +
      "Or from first principles: cos²2x − cos²6x = (1 + cos4x)/2 − (1 + cos12x)/2 = (cos4x − cos12x)/2, " +
      "and cos 4x − cos 12x = 2 sin 8x sin 4x.",
  },
  {
    key: "q38",
    difficulty: "HARD",
    tags: ["multiple-angles", "sum-to-product"],
    stem: "Question 38. Prove that: cos 7x + cos 5x + cos 3x + cos x = 4 cos x cos 2x cos 4x",
    explanation:
      "L.H.S. = (cos 7x + cos x) + (cos 5x + cos 3x).\n" +
      "cos 7x + cos x = 2 cos 4x cos 3x, and cos 5x + cos 3x = 2 cos 4x cos x.\n" +
      "L.H.S. = 2 cos 4x (cos 3x + cos x) = 2 cos 4x · 2 cos 2x cos x = 4 cos x cos 2x cos 4x = R.H.S.  Hence proved.",
  },
  {
    key: "q39",
    difficulty: "HARD",
    tags: ["conditional-identities"],
    stem: "Question 39. Prove that: cot 4x (sin 5x + sin 3x) = cot x (sin 5x − sin 3x)",
    explanation:
      "L.H.S.: sin 5x + sin 3x = 2 sin 4x cos x, so L.H.S. = 2 cot 4x sin 4x cos x = 2 cos 4x cos x.\n" +
      "R.H.S.: sin 5x − sin 3x = 2 cos 4x sin x, so R.H.S. = 2 cot x cos 4x sin x = 2 cos 4x cos x.\n" +
      "Both sides equal 2 cos 4x cos x, hence L.H.S. = R.H.S.",
  },
  {
    key: "q40",
    difficulty: "HARD",
    tags: ["conditional-identities"],
    stem: "Question 40. Prove that: tan 3x · tan 2x · tan x = tan 3x − tan 2x − tan x",
    explanation:
      "Start from tan 3x = tan(2x + x) = (tan 2x + tan x)/(1 − tan 2x tan x).\n" +
      "Multiply across: tan 3x (1 − tan 2x tan x) = tan 2x + tan x\n" +
      "⇒ tan 3x − tan 3x tan 2x tan x = tan 2x + tan x\n" +
      "⇒ tan 3x tan 2x tan x = tan 3x − tan 2x − tan x = R.H.S.  Hence proved.",
  },

  /* -------------------------------------------- 41–50 · products and results */
  {
    key: "q41",
    difficulty: "MEDIUM",
    tags: ["products-to-sums"],
    stem: "Question 41. Prove that: (cos 9x − cos 5x)/(sin 17x − sin 3x) = −sin 2x / cos 10x",
    explanation:
      "Numerator: cos 9x − cos 5x = −2 sin 7x sin 2x.\n" +
      "Denominator: sin 17x − sin 3x = 2 cos 10x sin 7x.\n" +
      "L.H.S. = (−2 sin 7x sin 2x)/(2 cos 10x sin 7x) = −sin 2x / cos 10x = R.H.S.  Hence proved.",
  },
  {
    key: "q42",
    difficulty: "MEDIUM",
    tags: ["sum-to-product"],
    stem: "Question 42. Prove that: (sin 5x + sin 3x)/(cos 5x + cos 3x) = tan 4x",
    explanation:
      "sin 5x + sin 3x = 2 sin 4x cos x, and cos 5x + cos 3x = 2 cos 4x cos x.\n" +
      "L.H.S. = (2 sin 4x cos x)/(2 cos 4x cos x) = sin 4x/cos 4x = tan 4x = R.H.S.  Hence proved.",
  },
  {
    key: "q43",
    difficulty: "MEDIUM",
    tags: ["sum-to-product"],
    stem: "Question 43. Prove that: (sin x − sin y)/(cos x + cos y) = tan((x − y)/2)",
    explanation:
      "sin x − sin y = 2 cos((x + y)/2) sin((x − y)/2).\n" +
      "cos x + cos y = 2 cos((x + y)/2) cos((x − y)/2).\n" +
      "L.H.S. = [2 cos((x+y)/2) sin((x−y)/2)] / [2 cos((x+y)/2) cos((x−y)/2)] = tan((x − y)/2) = R.H.S.  Hence proved.",
  },
  {
    key: "q44",
    difficulty: "MEDIUM",
    tags: ["sum-to-product"],
    stem: "Question 44. Prove that: (sin A + sin 3A)/(cos A + cos 3A) = tan 2A",
    explanation:
      "sin A + sin 3A = 2 sin 2A cos A, and cos A + cos 3A = 2 cos 2A cos A.\n" +
      "L.H.S. = (2 sin 2A cos A)/(2 cos 2A cos A) = tan 2A = R.H.S.  Hence proved.",
  },
  {
    key: "q45",
    difficulty: "MEDIUM",
    tags: ["sum-to-product"],
    stem: "Question 45. Prove that: (sin x + sin y)/(cos x + cos y) = tan((x + y)/2)",
    explanation:
      "sin x + sin y = 2 sin((x + y)/2) cos((x − y)/2).\n" +
      "cos x + cos y = 2 cos((x + y)/2) cos((x − y)/2).\n" +
      "L.H.S. = [2 sin((x+y)/2) cos((x−y)/2)] / [2 cos((x+y)/2) cos((x−y)/2)] = tan((x + y)/2) = R.H.S.  Hence proved.",
  },
  {
    key: "q46",
    difficulty: "HARD",
    tags: ["products-to-sums"],
    stem: "Question 46. Prove that: (tan 50° + tan 30°)/(tan 50° − tan 30°) = 4 cos 20° cos 40°",
    explanation:
      "Write everything in terms of sine and cosine over the common denominator cos 50° cos 30°:\n" +
      "Numerator = (sin 50° cos 30° + sin 30° cos 50°)/(cos 50° cos 30°) = sin(50° + 30°)/(cos 50° cos 30°) = sin 80°/(cos 50° cos 30°).\n" +
      "Denominator = (sin 50° cos 30° − sin 30° cos 50°)/(cos 50° cos 30°) = sin(50° − 30°)/(cos 50° cos 30°) = sin 20°/(cos 50° cos 30°).\n" +
      "L.H.S. = sin 80°/sin 20°.\n" +
      "sin 80° = 2 sin 40° cos 40°, and sin 40° = 2 sin 20° cos 20°, so sin 80° = 4 sin 20° cos 20° cos 40°.\n" +
      "L.H.S. = 4 cos 20° cos 40° = R.H.S.  Hence proved.",
  },
  {
    key: "q47",
    difficulty: "HARD",
    tags: ["products-to-sums", "multiple-angles"],
    stem: "Question 47. Prove that: (sin x − sin 3x)/(sin²x − cos²x) = 2 sin x",
    explanation:
      "Numerator: sin x − sin 3x = −(sin 3x − sin x) = −2 cos 2x sin x.\n" +
      "Denominator: sin²x − cos²x = −(cos²x − sin²x) = −cos 2x.\n" +
      "L.H.S. = (−2 cos 2x sin x)/(−cos 2x) = 2 sin x = R.H.S.  Hence proved.\n" +
      "Correction: the printed worksheet shows the denominator as \"sin x − cos x\" (squares dropped by the print); with the squares as written here the identity holds.",
  },
  {
    key: "q48",
    difficulty: "HARD",
    tags: ["multiple-angles"],
    stem: "Question 48. Prove that: (3 sin A − sin 3A)^(2/3) + (3 cos A + cos 3A)^(2/3) = 4^(2/3)",
    explanation:
      "sin 3A = 3 sin A − 4 sin³A ⇒ 3 sin A − sin 3A = 4 sin³A.\n" +
      "cos 3A = 4 cos³A − 3 cos A ⇒ 3 cos A + cos 3A = 4 cos³A.\n" +
      "L.H.S. = (4 sin³A)^(2/3) + (4 cos³A)^(2/3) = 4^(2/3) sin²A + 4^(2/3) cos²A " +
      "= 4^(2/3) (sin²A + cos²A) = 4^(2/3) · 1 = 4^(2/3) = R.H.S.  Hence proved.\n" +
      "(4^(2/3) = ∛16 ≈ 2.5198.)",
  },
  {
    key: "q49",
    difficulty: "HARD",
    tags: ["sum-to-product"],
    stem: "Question 49. Prove that: [(sin 7x + sin 5x) + (sin 9x + sin 3x)] / [(cos 7x + cos 5x) + (cos 9x + cos 3x)] = tan 6x",
    explanation:
      "sin 7x + sin 5x = 2 sin 6x cos x, and sin 9x + sin 3x = 2 sin 6x cos 3x.\n" +
      "cos 7x + cos 5x = 2 cos 6x cos x, and cos 9x + cos 3x = 2 cos 6x cos 3x.\n" +
      "L.H.S. = [2 sin 6x (cos x + cos 3x)] / [2 cos 6x (cos x + cos 3x)] = sin 6x/cos 6x = tan 6x = R.H.S.  Hence proved.",
  },
  {
    key: "q50",
    difficulty: "HARD",
    tags: ["multiple-angles"],
    stem: "Question 50. Prove that: cos 4x = 1 − 8 sin²x cos²x",
    explanation:
      "cos 4x = 1 − 2 sin²2x (double-angle formula).\n" +
      "sin 2x = 2 sin x cos x ⇒ sin²2x = 4 sin²x cos²x.\n" +
      "L.H.S. = 1 − 2 × 4 sin²x cos²x = 1 − 8 sin²x cos²x = R.H.S.  Hence proved.",
  },

  /* --------------------------------- 51–60 · domain, range and periodicity */
  {
    key: "q51",
    difficulty: "EASY",
    tags: ["domain-range"],
    stem: "Question 51. Find the domain and range of the function f(x) = 1/(3 − sin x).",
    explanation: `sin x takes every value in [−1, 1], so 3 − sin x ranges over [2, 4] and is never zero.
The domain is therefore all real numbers, ℝ.
f(x) is largest when the denominator is smallest (2) and smallest when it is largest (4):
range = [1/4, 1/2].`,
  },
  {
    key: "q52",
    difficulty: "MEDIUM",
    tags: ["periodic-functions", "domain-range"],
    stem: "Question 52. Find the fundamental period of f(x) = sin 3x + cos 2x.",
    explanation: `The period of sin 3x is 2π/3 and the period of cos 2x is 2π/2 = π.
The period of a sum is the LCM of the individual periods. As fractions of π these are 2/3 and 1 (= 3/3).
LCM of 2/3 and 3/3 = LCM(2, 3)/3 · π = 6π/3 = 2π.
Fundamental period = 2π.`,
  },
  {
    key: "q53",
    difficulty: "MEDIUM",
    tags: ["domain-range"],
    stem: "Question 53. Find the domain and range of f(x) = √(3 − 2 cos x).",
    explanation: `cos x ∈ [−1, 1] ⇒ 2 cos x ∈ [−2, 2] ⇒ 3 − 2 cos x ∈ [1, 5].
This is always ≥ 1 > 0, so the square root is defined for every real x: domain = ℝ.
Range: √(3 − 2 cos x) ∈ [√1, √5] = [1, √5].`,
  },
  {
    key: "q54",
    difficulty: "MEDIUM",
    tags: ["maximum-minimum"],
    stem: "Question 54. Find the maximum and minimum values of f(x) = 3 sin x + 4 cos x.",
    explanation: `Write 3 sin x + 4 cos x = 5 sin(x + φ), where 5 = √(3² + 4²) and φ = arctan(4/3).
As sin ranges over [−1, 1], the expression ranges over [−5, 5].
Maximum = 5 (attained at x = φ + π/2 + 2nπ), minimum = −5.`,
  },
  {
    key: "q55",
    difficulty: "MEDIUM",
    tags: ["periodic-functions"],
    stem: "Question 55. Find the period of f(x) = |sin x|.",
    explanation: `|sin(x + π)| = |−sin x| = |sin x|, so π is a period of f.
No smaller positive value works: on (0, π), |sin x| = sin x rises to 1 and falls back, so it does not repeat before π.
Fundamental period = π.`,
  },
  {
    key: "q56",
    difficulty: "MEDIUM",
    tags: ["domain-range", "maximum-minimum"],
    stem: "Question 56. Find the range of f(x) = sin²x − 2 sin x + 3.",
    explanation: `Put t = sin x, so t ∈ [−1, 1]. Then f = t² − 2t + 3 = (t − 1)² + 2.
This is smallest at t = 1 (value 2) and largest at the other end, t = −1 (value 1 + 2 + 3 = 6).
Range = [2, 6].`,
  },
  {
    key: "q57",
    difficulty: "MEDIUM",
    tags: ["maximum-minimum", "multiple-angles"],
    stem: "Question 57. Find the maximum and minimum values of f(x) = sin⁴x + cos⁴x.",
    explanation: `sin⁴x + cos⁴x = (sin²x + cos²x)² − 2 sin²x cos²x = 1 − 2 sin²x cos²x.
Since 2 sin x cos x = sin 2x, we have 2 sin²x cos²x = (1/2) sin²2x, so f = 1 − (1/2) sin²2x.
As sin²2x ranges over [0, 1], f ranges over [1/2, 1].
Maximum = 1, minimum = 1/2.`,
  },
  {
    key: "q58",
    difficulty: "HARD",
    tags: ["domain-range"],
    stem: "Question 58. Find the range of f(x) = sin²x + cos⁴x.",
    explanation: `Put t = sin²x ∈ [0, 1], so cos²x = 1 − t and cos⁴x = (1 − t)².
f = t + (1 − t)² = t² − t + 1 = (t − 1/2)² + 3/4.
This is smallest at t = 1/2 (value 3/4) and largest at an endpoint t = 0 or t = 1 (value 1).
Range = [3/4, 1].`,
  },
  {
    key: "q59",
    difficulty: "HARD",
    tags: ["periodic-functions", "multiple-angles"],
    stem: "Question 59. Find the period of f(x) = sin⁴x + cos⁴x.",
    explanation: `From Question 57, sin⁴x + cos⁴x = 1 − (1/2) sin²2x.
Now sin²2x = (1 − cos 4x)/2, so f = 1 − (1/4)(1 − cos 4x) = 3/4 + (1/4) cos 4x.
The period of cos 4x is 2π/4 = π/2, hence the fundamental period of f is π/2.`,
  },
  {
    key: "q60",
    difficulty: "MEDIUM",
    tags: ["domain-range"],
    stem: "Question 60. Find the domain of f(x) = 1/√(1 − cos 2x).",
    explanation: `1 − cos 2x = 2 sin²x, so f(x) = 1/√(2 sin²x) = 1/(√2 |sin x|).
This is undefined where sin x = 0, i.e. at x = nπ for integer n.
Domain = ℝ \ {nπ : n ∈ ℤ}.`,
  },

  /* ------------------------------------- 61–70 · equations, general solutions */
  {
    key: "q61",
    difficulty: "EASY",
    tags: ["trigonometric-equations"],
    stem: "Question 61. Solve sin θ = 1/2, giving the general solution.",
    explanation: `sin θ = 1/2 = sin(π/6).
General solution: θ = nπ + (−1)^n (π/6), n ∈ ℤ.`,
  },
  {
    key: "q62",
    difficulty: "EASY",
    tags: ["trigonometric-equations"],
    stem: "Question 62. Solve cos θ = −√3/2, giving the general solution.",
    explanation: `cos θ = −√3/2 = cos(5π/6) (cosine is negative in the second and third quadrants, and cos(5π/6) = −√3/2).
General solution: θ = 2nπ ± 5π/6, n ∈ ℤ.`,
  },
  {
    key: "q63",
    difficulty: "EASY",
    tags: ["trigonometric-equations"],
    stem: "Question 63. Solve tan θ = 1/√3, giving the general solution.",
    explanation: `tan θ = 1/√3 = tan(π/6).
General solution: θ = nπ + π/6, n ∈ ℤ.`,
  },
  {
    key: "q64",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations"],
    stem: "Question 64. Solve sin 2θ = 1/2, giving the general solution.",
    explanation: `sin 2θ = 1/2 = sin(π/6).
2θ = nπ + (−1)^n (π/6), so θ = nπ/2 + (−1)^n (π/12), n ∈ ℤ.`,
  },
  {
    key: "q65",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations"],
    stem: "Question 65. Solve cos 3θ = 0, giving the general solution.",
    explanation: `cos 3θ = 0 ⇒ 3θ = (2n + 1)(π/2).
So θ = (2n + 1)(π/6), n ∈ ℤ.`,
  },
  {
    key: "q66",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations"],
    stem: "Question 66. Solve 2 cos²θ = 1, giving the general solution.",
    explanation: `2 cos²θ = 1 ⇒ cos²θ = 1/2 ⇒ cos θ = ±1/√2.
cos θ = 1/√2 gives θ = 2nπ ± π/4; cos θ = −1/√2 gives θ = 2nπ ± 3π/4.
Together these two families are exactly θ = nπ ± π/4, n ∈ ℤ.`,
  },
  {
    key: "q67",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations"],
    stem: "Question 67. Solve tan 2θ = −1, giving the general solution.",
    explanation: `tan 2θ = −1 = tan(−π/4).
2θ = nπ − π/4, so θ = nπ/2 − π/8, n ∈ ℤ.`,
  },
  {
    key: "q68",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations"],
    stem: "Question 68. Solve sin θ + cos θ = 0, giving the general solution.",
    explanation: `sin θ + cos θ = 0 ⇒ sin θ = −cos θ ⇒ tan θ = −1 (cos θ ≠ 0 in this case).
tan θ = −1 = tan(−π/4) ⇒ θ = nπ − π/4, n ∈ ℤ.
(Equivalently cos θ + sin θ = √2 sin(θ + π/4) = 0 ⇒ θ + π/4 = nπ.)`,
  },
  {
    key: "q69",
    difficulty: "HARD",
    tags: ["trigonometric-equations"],
    stem: "Question 69. Solve 2 sin²θ − 3 sin θ + 1 = 0, giving the general solution.",
    explanation: `Factorise: (2 sin θ − 1)(sin θ − 1) = 0.
Case sin θ = 1/2: θ = nπ + (−1)^n (π/6).
Case sin θ = 1: θ = 2nπ + π/2.
Both families, n ∈ ℤ.`,
  },
  {
    key: "q70",
    difficulty: "HARD",
    tags: ["trigonometric-equations"],
    stem: "Question 70. Solve sin²θ = sin²α, giving the general solution in terms of α.",
    explanation: `sin²θ = sin²α ⇒ sin θ = ±sin α.
sin θ = sin α gives θ = nπ + (−1)^n α; sin θ = −sin α = sin(−α) gives θ = nπ + (−1)^n(−α).
Combining both families, the general solution is θ = nπ ± α, n ∈ ℤ.`,
  },

  /* -------------------------------------- 71–80 · equations by reduction */
  {
    key: "q71",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations", "sum-to-product"],
    stem: "Question 71. Solve sin θ + sin 3θ = 0, giving the general solution.",
    explanation: `sin θ + sin 3θ = 2 sin 2θ cos θ = 0.
So sin 2θ = 0 ⇒ 2θ = nπ ⇒ θ = nπ/2, or cos θ = 0 ⇒ θ = (2n + 1)π/2.
The second family is contained in the first (it is its odd members), so the solution is θ = nπ/2, n ∈ ℤ.`,
  },
  {
    key: "q72",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations", "sum-to-product"],
    stem: "Question 72. Solve sin 3θ = sin θ, giving the general solution.",
    explanation: `sin 3θ − sin θ = 2 cos 2θ sin θ = 0.
sin θ = 0 ⇒ θ = nπ; cos 2θ = 0 ⇒ 2θ = (2n + 1)π/2 ⇒ θ = (2n + 1)π/4.
Solution: θ = nπ or θ = (2n + 1)π/4, n ∈ ℤ.`,
  },
  {
    key: "q73",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations", "sum-to-product"],
    stem: "Question 73. Solve cos 2θ = cos θ, giving the general solution.",
    explanation: `cos 2θ − cos θ = −2 sin(3θ/2) sin(θ/2) = 0.
sin(θ/2) = 0 ⇒ θ = 2nπ; sin(3θ/2) = 0 ⇒ 3θ/2 = nπ ⇒ θ = 2nπ/3.
The family θ = 2nπ is contained in θ = 2nπ/3, so the solution is θ = 2nπ/3, n ∈ ℤ.`,
  },
  {
    key: "q74",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations", "compound-angles"],
    stem: "Question 74. Solve sin θ + cos θ = 1, giving the general solution.",
    explanation: `sin θ + cos θ = √2 sin(θ + π/4) = 1 ⇒ sin(θ + π/4) = 1/√2 = sin(π/4).
θ + π/4 = nπ + (−1)^n (π/4) ⇒ θ = nπ + (−1)^n (π/4) − π/4, n ∈ ℤ.
In [0, 2π) this gives θ = 0 and θ = π/2.`,
  },
  {
    key: "q75",
    difficulty: "HARD",
    tags: ["trigonometric-equations"],
    stem: "Question 75. Solve 2 cos²θ + 3 sin θ = 0, giving the general solution.",
    explanation: `Replace cos²θ = 1 − sin²θ: 2(1 − sin²θ) + 3 sin θ = 0 ⇒ 2 sin²θ − 3 sin θ − 2 = 0.
Factorise: (2 sin θ + 1)(sin θ − 2) = 0. sin θ = 2 is impossible, so sin θ = −1/2.
θ = nπ + (−1)^n(−π/6) = nπ − (−1)^n (π/6), n ∈ ℤ.`,
  },
  {
    key: "q76",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations"],
    stem: "Question 76. Solve tan²θ + (1 − √3) tan θ − √3 = 0, giving the general solution.",
    explanation: `Factorise: (tan θ + 1)(tan θ − √3) = 0.
tan θ = −1 ⇒ θ = nπ − π/4; tan θ = √3 ⇒ θ = nπ + π/3.
Solution: θ = nπ − π/4 or θ = nπ + π/3, n ∈ ℤ.`,
  },
  {
    key: "q77",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations"],
    stem: "Question 77. Solve 4 cos²θ + 4 cos θ − 3 = 0, giving the general solution.",
    explanation: `Quadratic in cos θ: cos θ = [−4 ± √(16 + 48)]/8 = (−4 ± 8)/8, so cos θ = 1/2 or cos θ = −3/2.
cos θ = −3/2 is impossible, leaving cos θ = 1/2.
θ = 2nπ ± π/3, n ∈ ℤ.`,
  },
  {
    key: "q78",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations", "compound-angles"],
    stem: "Question 78. Solve cos θ + sin θ = √2, giving the general solution.",
    explanation: `sin θ + cos θ = √2 sin(θ + π/4) = √2 ⇒ sin(θ + π/4) = 1.
θ + π/4 = 2nπ + π/2 ⇒ θ = 2nπ + π/4, n ∈ ℤ.`,
  },
  {
    key: "q79",
    difficulty: "HARD",
    tags: ["trigonometric-equations"],
    stem: "Question 79. Solve sin 2θ + cos θ = 0, giving the general solution.",
    explanation: `sin 2θ + cos θ = 2 sin θ cos θ + cos θ = cos θ (2 sin θ + 1) = 0.
cos θ = 0 ⇒ θ = (2n + 1)π/2; 2 sin θ + 1 = 0 ⇒ sin θ = −1/2 ⇒ θ = nπ − (−1)^n (π/6).
Solution: θ = (2n + 1)π/2 or θ = nπ − (−1)^n (π/6), n ∈ ℤ.`,
  },
  {
    key: "q80",
    difficulty: "MEDIUM",
    tags: ["trigonometric-equations"],
    stem: "Question 80. Solve tan θ + cot θ = 2, giving the general solution.",
    explanation: `tan θ + cot θ = tan θ + 1/tan θ = 2 ⇒ tan²θ − 2 tan θ + 1 = 0 ⇒ (tan θ − 1)² = 0.
tan θ = 1 ⇒ θ = nπ + π/4, n ∈ ℤ.`,
  },

  /* ------------------------------------ 81–90 · multiple & sub-multiple angles */
  {
    key: "q81",
    difficulty: "EASY",
    tags: ["multiple-angles"],
    stem: "Question 81. If sin A = 3/5 and A lies in quadrant I, find sin 2A.",
    explanation: `A in quadrant I ⇒ cos A = +√(1 − 9/25) = 4/5.
sin 2A = 2 sin A cos A = 2 × (3/5) × (4/5) = 24/25.`,
  },
  {
    key: "q82",
    difficulty: "EASY",
    tags: ["multiple-angles"],
    stem: "Question 82. If cos A = 1/3, find cos 2A.",
    explanation: `cos 2A = 2 cos²A − 1 = 2(1/3)² − 1 = 2/9 − 1 = −7/9.`,
  },
  {
    key: "q83",
    difficulty: "MEDIUM",
    tags: ["multiple-angles"],
    stem: "Question 83. If tan A = 1/2, find tan 2A.",
    explanation: `tan 2A = 2 tan A / (1 − tan²A) = 2(1/2) / (1 − 1/4) = 1 / (3/4) = 4/3.`,
  },
  {
    key: "q84",
    difficulty: "MEDIUM",
    tags: ["multiple-angles"],
    stem: "Question 84. Prove that sin 3A = 3 sin A − 4 sin³A.",
    explanation: `sin 3A = sin(2A + A) = sin 2A cos A + cos 2A sin A.
= (2 sin A cos A) cos A + (1 − 2 sin²A) sin A = 2 sin A cos²A + sin A − 2 sin³A.
Using cos²A = 1 − sin²A: = 2 sin A(1 − sin²A) + sin A − 2 sin³A = 3 sin A − 4 sin³A.  Hence proved.`,
  },
  {
    key: "q85",
    difficulty: "MEDIUM",
    tags: ["multiple-angles"],
    stem: "Question 85. Prove that cos 3A = 4 cos³A − 3 cos A.",
    explanation: `cos 3A = cos(2A + A) = cos 2A cos A − sin 2A sin A.
= (2 cos²A − 1) cos A − (2 sin A cos A) sin A = 2 cos³A − cos A − 2 sin²A cos A.
Using sin²A = 1 − cos²A: = 2 cos³A − cos A − 2(1 − cos²A) cos A = 4 cos³A − 3 cos A.  Hence proved.`,
  },
  {
    key: "q86",
    difficulty: "HARD",
    tags: ["multiple-angles"],
    stem: "Question 86. Prove that tan 3A = (3 tan A − tan³A)/(1 − 3 tan²A).",
    explanation: `tan 3A = tan(2A + A) = (tan 2A + tan A)/(1 − tan 2A tan A), with tan 2A = 2 tan A/(1 − tan²A).
Numerator: 2 tan A/(1 − tan²A) + tan A = [2 tan A + tan A(1 − tan²A)]/(1 − tan²A) = (3 tan A − tan³A)/(1 − tan²A).
Denominator: 1 − [2 tan A/(1 − tan²A)] tan A = (1 − tan²A − 2 tan²A)/(1 − tan²A) = (1 − 3 tan²A)/(1 − tan²A).
Ratio = (3 tan A − tan³A)/(1 − 3 tan²A).  Hence proved.`,
  },
  {
    key: "q87",
    difficulty: "MEDIUM",
    tags: ["submultiple-angles"],
    stem: "Question 87. If cos A = 3/5 and A lies in quadrant I, find sin(A/2), cos(A/2) and tan(A/2).",
    explanation: `A in quadrant I ⇒ A/2 in quadrant I, so all three values are positive.
sin(A/2) = √((1 − cos A)/2) = √((1 − 3/5)/2) = √((2/5)/2) = √(1/5) = 1/√5.
cos(A/2) = √((1 + cos A)/2) = √((1 + 3/5)/2) = √((8/5)/2) = √(4/5) = 2/√5.
tan(A/2) = sin(A/2)/cos(A/2) = (1/√5)/(2/√5) = 1/2.
(Check with tan(A/2) = (1 − cos A)/sin A = (2/5)/(4/5) = 1/2.)`,
  },
  {
    key: "q88",
    difficulty: "MEDIUM",
    tags: ["submultiple-angles"],
    stem: "Question 88. Find the exact value of sin 22½°.",
    explanation: `22½° = (45°)/2, so this is a half-angle of 45°.
sin 22½° = √((1 − cos 45°)/2) = √((1 − (√2)/2)/2) = √((2 − √2)/4) = √(2 − √2)/2.
(≈ 0.3827.)`,
  },
  {
    key: "q89",
    difficulty: "HARD",
    tags: ["submultiple-angles", "sum-to-product"],
    stem: "Question 89. Prove that sin²A + sin²(A + 120°) + sin²(A − 120°) = 3/2.",
    explanation: `Use sin²x = (1 − cos 2x)/2.
L.H.S. = 3/2 − (1/2)[cos 2A + cos(2A + 240°) + cos(2A − 240°)].
cos(2A + 240°) + cos(2A − 240°) = 2 cos 2A cos 240° = 2 cos 2A · (−1/2) = −cos 2A.
So the bracket is cos 2A − cos 2A = 0, leaving L.H.S. = 3/2 = R.H.S.  Hence proved.`,
  },
  {
    key: "q90",
    difficulty: "HARD",
    tags: ["submultiple-angles", "sum-to-product"],
    stem: "Question 90. Prove that cos²A + cos²(A + 120°) + cos²(A − 120°) = 3/2.",
    explanation: `Use cos²x = (1 + cos 2x)/2.
L.H.S. = 3/2 + (1/2)[cos 2A + cos(2A + 240°) + cos(2A − 240°)].
As in Question 89, cos 2A + cos(2A + 240°) + cos(2A − 240°) = cos 2A + 2 cos 2A cos 240° = cos 2A − cos 2A = 0.
So L.H.S. = 3/2 = R.H.S.  Hence proved.`,
  },

  /* -------------------------------------------- 91–100 · conditional identities */
  {
    key: "q91",
    difficulty: "MEDIUM",
    tags: ["conditional-identities", "compound-angles"],
    stem: "Question 91. If A + B = π/4, prove that (1 + tan A)(1 + tan B) = 2.",
    explanation: `A + B = π/4 ⇒ tan(A + B) = tan(π/4) = 1.
(tan A + tan B)/(1 − tan A tan B) = 1 ⇒ tan A + tan B = 1 − tan A tan B
⇒ tan A + tan B + tan A tan B = 1.
Adding 1 to both sides: 1 + tan A + tan B + tan A tan B = 2, i.e. (1 + tan A)(1 + tan B) = 2.  Hence proved.`,
  },
  {
    key: "q92",
    difficulty: "MEDIUM",
    tags: ["conditional-identities", "compound-angles"],
    stem: "Question 92. If A + B + C = π, prove that tan A + tan B + tan C = tan A tan B tan C.",
    explanation: `A + B + C = π ⇒ A + B = π − C, so tan(A + B) = tan(π − C) = −tan C.
(tan A + tan B)/(1 − tan A tan B) = −tan C
⇒ tan A + tan B = −tan C + tan A tan B tan C
⇒ tan A + tan B + tan C = tan A tan B tan C.  Hence proved.`,
  },
  {
    key: "q93",
    difficulty: "HARD",
    tags: ["conditional-identities", "sum-to-product"],
    stem: "Question 93. If A + B + C = π, prove that sin 2A + sin 2B + sin 2C = 4 sin A sin B sin C.",
    explanation: `sin 2A + sin 2B = 2 sin(A + B) cos(A − B) = 2 sin(π − C) cos(A − B) = 2 sin C cos(A − B).
L.H.S. = 2 sin C cos(A − B) + 2 sin C cos C = 2 sin C [cos(A − B) + cos C].
Now cos(A − B) + cos C = cos(A − B) + cos(π − A − B) = cos(A − B) − cos(A + B) = 2 sin A sin B.
L.H.S. = 2 sin C · 2 sin A sin B = 4 sin A sin B sin C = R.H.S.  Hence proved.`,
  },
  {
    key: "q94",
    difficulty: "HARD",
    tags: ["conditional-identities"],
    stem: "Question 94. If A + B + C = π, prove that cos²A + cos²B + cos²C + 2 cos A cos B cos C = 1.",
    explanation: `Use cos²A + cos²B = 1 + cos(A + B) cos(A − B). Since A + B = π − C, cos(A + B) = −cos C:
cos²A + cos²B = 1 − cos C cos(A − B).
L.H.S. = 1 − cos C cos(A − B) + cos²C + 2 cos A cos B cos C = 1 + cos C [cos C − cos(A − B) + 2 cos A cos B].
Now cos C − cos(A − B) = −cos(A + B) − cos(A − B) = −2 cos A cos B.
So the bracket is −2 cos A cos B + 2 cos A cos B = 0, leaving L.H.S. = 1 = R.H.S.  Hence proved.`,
  },
  {
    key: "q95",
    difficulty: "HARD",
    tags: ["conditional-identities", "sum-to-product"],
    stem: "Question 95. If A + B + C = π, prove that sin A + sin B + sin C = 4 cos(A/2) cos(B/2) cos(C/2).",
    explanation: `sin A + sin B = 2 sin((A + B)/2) cos((A − B)/2). Since (A + B)/2 = (π − C)/2 = π/2 − C/2, sin((A + B)/2) = cos(C/2).
So sin A + sin B = 2 cos(C/2) cos((A − B)/2), and sin C = 2 sin(C/2) cos(C/2).
L.H.S. = 2 cos(C/2)[cos((A − B)/2) + sin(C/2)].
Now sin(C/2) = cos((A + B)/2), so the bracket is cos((A − B)/2) + cos((A + B)/2) = 2 cos(A/2) cos(B/2).
L.H.S. = 2 cos(C/2) · 2 cos(A/2) cos(B/2) = 4 cos(A/2) cos(B/2) cos(C/2).  Hence proved.`,
  },
  {
    key: "q96",
    difficulty: "HARD",
    tags: ["conditional-identities", "sum-to-product"],
    stem: "Question 96. If A + B + C = π, prove that cos A + cos B + cos C = 1 + 4 sin(A/2) sin(B/2) sin(C/2).",
    explanation: `cos A + cos B = 2 cos((A + B)/2) cos((A − B)/2) = 2 sin(C/2) cos((A − B)/2), since cos((A + B)/2) = cos(π/2 − C/2) = sin(C/2).
Also cos C = 1 − 2 sin²(C/2).
L.H.S. = 1 + 2 sin(C/2) cos((A − B)/2) − 2 sin²(C/2) = 1 + 2 sin(C/2)[cos((A − B)/2) − sin(C/2)].
Now sin(C/2) = cos((A + B)/2), so the bracket is cos((A − B)/2) − cos((A + B)/2) = 2 sin(A/2) sin(B/2).
L.H.S. = 1 + 2 sin(C/2) · 2 sin(A/2) sin(B/2) = 1 + 4 sin(A/2) sin(B/2) sin(C/2).  Hence proved.`,
  },
  {
    key: "q97",
    difficulty: "HARD",
    tags: ["conditional-identities"],
    stem: "Question 97. If A + B + C = π, prove that sin²A + sin²B − sin²C = 2 sin A sin B cos C.",
    explanation: `Group as (sin²A − sin²C) + sin²B. Using sin²A − sin²C = sin(A + C) sin(A − C), and A + C = π − B ⇒ sin(A + C) = sin B:
sin²A − sin²C = sin B sin(A − C).
L.H.S. = sin²B + sin B sin(A − C) = sin B [sin B + sin(A − C)].
Now sin B = sin(π − A − C) = sin(A + C), so sin B + sin(A − C) = sin(A + C) + sin(A − C) = 2 sin A cos C.
L.H.S. = sin B · 2 sin A cos C = 2 sin A sin B cos C = R.H.S.  Hence proved.`,
  },
  {
    key: "q98",
    difficulty: "HARD",
    tags: ["conditional-identities", "sum-to-product"],
    stem: "Question 98. If A + B + C = π, prove that cos 2A + cos 2B + cos 2C = −1 − 4 cos A cos B cos C.",
    explanation: `cos 2A + cos 2B = 2 cos(A + B) cos(A − B) = 2 cos(π − C) cos(A − B) = −2 cos C cos(A − B).
L.H.S. = −2 cos C cos(A − B) + cos 2C = −2 cos C cos(A − B) + (2 cos²C − 1) = 2 cos C [cos C − cos(A − B)] − 1.
Now cos C − cos(A − B) = −cos(A + B) − cos(A − B) = −2 cos A cos B.
L.H.S. = 2 cos C (−2 cos A cos B) − 1 = −1 − 4 cos A cos B cos C = R.H.S.  Hence proved.`,
  },
  {
    key: "q99",
    difficulty: "MEDIUM",
    tags: ["conditional-identities", "compound-angles"],
    stem: "Question 99. If sin A = 3/5 and sin B = 12/13 with A and B both in quadrant I, find sin(A + B) and cos(A + B).",
    explanation: `A in quadrant I with sin A = 3/5 ⇒ cos A = 4/5. B in quadrant I with sin B = 12/13 ⇒ cos B = 5/13.
sin(A + B) = sin A cos B + cos A sin B = (3/5)(5/13) + (4/5)(12/13) = 15/65 + 48/65 = 63/65.
cos(A + B) = cos A cos B − sin A sin B = (4/5)(5/13) − (3/5)(12/13) = 20/65 − 36/65 = −16/65.`,
  },
  {
    key: "q100",
    difficulty: "HARD",
    tags: ["conditional-identities", "sum-to-product"],
    stem: "Question 100. Prove that (sin 2A + sin 2B)/(cos 2A + cos 2B) = tan(A + B).",
    explanation: `Numerator: sin 2A + sin 2B = 2 sin(A + B) cos(A − B).
Denominator: cos 2A + cos 2B = 2 cos(A + B) cos(A − B).
L.H.S. = [2 sin(A + B) cos(A − B)] / [2 cos(A + B) cos(A − B)] = sin(A + B)/cos(A + B) = tan(A + B) = R.H.S.  Hence proved.`,
  },
];
