/**
 * SNSAI — teaching feedback generator.
 *
 * The marking decides the score; this file decides what the student is *taught*.
 * Every line it produces is derived from the question, the reference answer and
 * the measured state of the student's work, so the advice is specific to what
 * they actually wrote rather than generic encouragement.
 */

import { MISCONCEPTIONS } from "./lexicon";
import { numbersIn } from "./keypoints";
import { contentTokens, sentences, wordCount } from "./text";
import type { SnsaiCriterion, SnsaiFault, SnsaiReport, SnsaiVerdict } from "./types";

/** Plain-language teaching steps for the question itself. */
export function buildTeaching(
  stem: string,
  reference: string,
  criteria: SnsaiCriterion[],
  type: string
): string[] {
  const steps: string[] = [];

  steps.push(
    type === "LONG"
      ? `A full answer to this ${summarise(stem)} needs every point below. Read them one at a time, then write your own version without looking.`
      : `For a ${type.toLowerCase()} question like this, the marks come from making specific points — not from writing a long paragraph.`
  );

  if (criteria.length > 0) {
    steps.push("The key points a correct answer must contain:");
    criteria.forEach((c, i) => {
      steps.push(`${i + 1}. ${c.expected}`);
    });
  }

  if (reference.trim().length > 0) {
    steps.push(`Read the reference answer once for understanding: ${reference}`);
  }

  steps.push(
    "Now close the reference and write the answer again in your own words. If you can do that, you have actually learnt it."
  );
  return steps;
}

function summarise(stem: string): string {
  const s = stem.trim();
  if (s.length <= 70) return s;
  return `${s.slice(0, 67).trimEnd()}…`;
}

/** Detect a misconception the student actually wrote, not a random one. */
export function findMisconception(answer: string): SnsaiFault[] {
  const faults: SnsaiFault[] = [];
  for (const m of MISCONCEPTIONS) {
    if (m.pattern.test(answer)) {
      faults.push({
        kind: "misconception",
        message: `There is a common mistake here: "${m.says}".`,
        teach: m.truth,
      });
    }
  }
  return faults;
}

/** Points the student missed, turned into actionable gaps. */
export function missingPointFaults(criteria: SnsaiCriterion[]): SnsaiFault[] {
  return criteria
    .filter((c) => !c.hit)
    .sort((a, b) => a.score - b.score)
    .map((c) => ({
      kind: c.score > 0.2 ? ("vague" as const) : ("missing_point" as const),
      message:
        c.score > 0.2
          ? `Half-made: ${c.label} — you touched it but did not finish it.`
          : `Not covered: ${c.label}.`,
      teach: `Add this to your answer: ${c.expected}`,
    }));
}

/** Length faults, worded so the student knows what to do about it. */
export function lengthFaults(answer: string, type: string): SnsaiFault[] {
  const words = wordCount(answer);
  const faults: SnsaiFault[] = [];
  const min = type === "LONG" ? 35 : 8;
  const max = type === "LONG" ? 600 : 160;

  if (words > 0 && words < min) {
    faults.push({
      kind: "too_short",
      message: `Only ${words} word${words === 1 ? "" : "s"} — too little to earn credit for a ${type === "LONG" ? "long" : "short"} answer.`,
      teach:
        type === "LONG"
          ? `A long answer usually needs a definition, the key characteristics with explanations, and at least one example or diagram description. Aim for about ${min}–80 words.`
          : `Say what it is, how it differs from the other thing you were asked to compare, and give one example. Aim for about ${min}–25 words.`,
    });
  }
  if (words > max) {
    faults.push({
      kind: "too_long",
      message: `${words} words is far longer than this question needs.`,
      teach:
        "Longer is not better. Long answers score by covering key points precisely, and irrelevant extra text lowers precision. Cut it back to the key points only.",
    });
  }
  if (words === 0) {
    faults.push({
      kind: "not_attempted",
      message: "You left this blank.",
      teach: "An unanswered question scores zero. Even a short, partly correct attempt earns marks.",
    });
  }
  return faults;
}

/** Penalise an answer that is off-topic rather than merely incomplete. */
export function relevanceFaults(precisionScore: number, similarity: number, coverage: number): SnsaiFault[] {
  if (precisionScore > 0 && precisionScore < 0.25 && coverage < 0.35) {
    return [
      {
        kind: "irrelevant",
        message: "A lot of this answer is not about the question.",
        teach:
          "Answer the question that was asked. Read it once more, underline the key words, and make sure every sentence you write helps answer it.",
      },
    ];
  }
  if (similarity < 0.06 && coverage < 0.15 && precisionScore > 0.25) {
    return [
      {
        kind: "irrelevant",
        message: "The words are on-topic but none of the expected ideas appear.",
        teach:
          "You have used related vocabulary without making the required points. Go through the key points one by one and check which ones you have actually said.",
      },
    ];
  }
  return [];
}

/** Rewarding what the student got right, specifically. */
export function praise(hit: SnsaiCriterion[], total: number): string[] {
  if (hit.length === 0) return [];
  const out: string[] = [];
  if (hit.length >= total) {
    out.push("You covered every key point. That is a complete answer.");
  } else {
    out.push(`You made ${hit.length} of the ${total} required points clearly. Those are correct and will earn marks.`);
  }
  out.push(`Correctly covered: ${hit.map((c) => c.label).join(", ")}.`);
  return out;
}

/** Numbers the student wrote that do not appear anywhere in the question or
 *  reference. In a computational topic that is usually an arithmetic slip. */
export function arithmeticFaults(answer: string, reference: string, stem: string): SnsaiFault[] {
  const expected = new Set([
    ...numbersIn(reference),
    ...numbersIn(stem),
  ]);
  const given = numbersIn(answer);
  const strange = [...new Set(given)].filter((n) => !expected.has(n));
  if (strange.length === 0 || strange.length > 4) return [];
  return [
    {
      kind: "wrong_value",
      message: `The number${strange.length === 1 ? "" : "s"} ${strange.join(", ")} do not appear in the question or the reference answer.`,
      teach:
        "Re-check the calculation. This chapter turns on powers of two, so work through 2^n one step at a time and show the working.",
    },
  ];
}

/** Map a 0..1 quality onto a verdict. */
/**
 * The verdict follows quality, and "unanswered" is decided by whether the
 * student actually responded — never by word count.
 *
 * An MCQ, a program and a query are all valid answers with zero words, so
 * inferring "unanswered" from length marked every one of them as blank and
 * then awarded zero for it.
 */
export function verdictFor(quality: number, attempted: boolean): SnsaiVerdict {
  if (!attempted) return "unanswered";
  if (quality >= 0.9) return "correct";
  if (quality >= 0.7) return "mostly_correct";
  if (quality >= 0.35) return "partial";
  return "incorrect";
}

/** One-line summary of the state of the answer. */
export function headlineFor(verdict: SnsaiVerdict, criteria: SnsaiCriterion[], faults: SnsaiFault[]): string {
  const missed = criteria.filter((c) => !c.hit).length;
  const hasMisconception = faults.some((f) => f.kind === "misconception");
  switch (verdict) {
    case "needs_teacher":
      return "File received — your teacher will mark this one.";
    case "unanswered":
      return "No answer to check yet.";
    case "correct":
      return missed === 0 ? "Correct — every key point is covered." : "Correct on the points you made.";
    case "mostly_correct":
      return `Right idea, but ${missed} key point${missed === 1 ? "" : "s"} missing.`;
    case "partial":
      return hasMisconception
        ? "Partly right, and one idea in it is incorrect."
        : `Partly right — ${criteria.length - missed} of ${criteria.length} key points covered.`;
    default:
      return hasMisconception
        ? "Incorrect, and it contains a common mistake."
        : "This does not yet answer the question.";
  }
}

/** A single concrete thing to do next. */
export function nextStepFor(faults: SnsaiFault[], criteria: SnsaiCriterion[]): string {
  const unreadable = faults.find((f) => f.kind === "unreadable" || f.kind === "no_example");
  if (faults.some((f) => f.message.startsWith("Files received"))) {
    return unreadable?.teach ?? "Check the file is legible, then read the reference points and confirm your own answer covers them.";
  }
  const misconception = faults.find((f) => f.kind === "misconception");
  if (misconception) return "Fix the wrong idea first: " + misconception.teach;
  const missing = faults.find((f) => f.kind === "missing_point");
  if (missing) return "Next, add this: " + missing.teach;
  const short = faults.find((f) => f.kind === "too_short");
  if (short) return "Expand your answer: " + short.teach;
  const irrelevant = faults.find((f) => f.kind === "irrelevant");
  if (irrelevant) return irrelevant.teach;
  const notHit = criteria.find((c) => !c.hit);
  if (notHit) return `Strengthen this point: ${notHit.expected}`;
  return "Read the reference once more, then rewrite the answer in your own words before you submit.";
}

/** Assemble the final report. */
export function assemble(input: {
  type: string;
  stem: string;
  reference: string;
  maxMarks: number;
  quality: number;
  criteria: SnsaiCriterion[];
  faults: SnsaiFault[];
  words: number;
  similarity: number;
  coverage: number;
  precision: number;
  elapsedMs: number;
  /**
   * Whether the student actually responded. Defaults to "wrote something",
   * which is right for prose and wrong for MCQ, code and queries — those
   * evaluators pass it explicitly.
   */
  attempted?: boolean;
  /**
   * Overrides the verdict when quality cannot decide it. An unreadable upload
   * is neither right nor wrong, so it must not be squeezed into one.
   */
  forcedVerdict?: SnsaiVerdict;
}): SnsaiReport {
  const attempted = input.attempted ?? input.words > 0;
  const verdict = input.forcedVerdict ?? verdictFor(input.quality, attempted);
  // Marks track quality but a partially-correct long answer should still earn
  // meaningful credit, so the curve is slightly generous below full marks.
  const markable = verdict !== "unanswered" && verdict !== "needs_teacher";
  const ratio = markable ? Math.min(1, input.quality * 1.05) : 0;
  const marks = Math.round(ratio * input.maxMarks * 100) / 100;

  const ordered = [...input.faults].sort((a, b) => faultPriority(a) - faultPriority(b));
  const teaching = buildTeaching(input.stem, input.reference, input.criteria, input.type);
  const good = input.criteria.filter((c) => c.hit);

  return {
    marks,
    maxMarks: input.maxMarks,
    quality: Math.round(input.quality * 100) / 100,
    verdict,
    headline: headlineFor(verdict, input.criteria, ordered),
    criteria: input.criteria,
    faults: ordered,
    teaching: [...praise(good, input.criteria.length), ...teaching],
    reference: input.reference,
    nextStep: nextStepFor(ordered, input.criteria),
    signals: {
      words: input.words,
      similarity: Math.round(input.similarity * 1000) / 1000,
      coverage: Math.round(input.coverage * 1000) / 1000,
      precision: Math.round(input.precision * 1000) / 1000,
      elapsedMs: input.elapsedMs,
    },
  };
}

const FAULT_ORDER: Record<string, number> = {
  misconception: 0,
  unreadable: 1,
  no_transcript: 1,
  runtime_error: 1,
  wrong_output: 2,
  not_attempted: 2,
  irrelevant: 3,
  missing_point: 4,
  vague: 5,
  wrong_value: 6,
  too_short: 7,
  too_long: 8,
  copied_reference: 9,
  no_example: 10,
};

function faultPriority(f: SnsaiFault): number {
  return FAULT_ORDER[f.kind] ?? 5;
}

export { sentences, contentTokens };
