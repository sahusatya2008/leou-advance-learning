/**
 * SNSAI — shared result types.
 *
 * One report shape for every question type, so the UI, the API and any later
 * reporting all read the same fields no matter what was answered.
 */

/**
 * "needs_teacher" exists because an uploaded diagram genuinely cannot be
 * machine-marked. Forcing it into "incorrect" would tell a student their work
 * was wrong when the truth is that nobody has read it yet, so the state is
 * named honestly instead of being rounded to a judgement.
 */
export type SnsaiVerdict =
  | "correct"
  | "mostly_correct"
  | "partial"
  | "incorrect"
  | "unanswered"
  | "needs_teacher";

export type SnsaiCriterion = {
  /** Short label for the point being checked, e.g. "RAM is volatile". */
  label: string;
  /** How well the student covered it, 0..1. */
  score: number;
  hit: boolean;
  /** The exact reference wording, shown as the "correct version". */
  expected: string;
  /** The student's own words that matched, if any. */
  matched: string[];
  /** Why this point was judged the way it was. */
  note?: string;
};

export type SnsaiFault = {
  /** Machine-readable category so the UI can group faults consistently. */
  kind:
    | "missing_point"
    | "misconception"
    | "too_short"
    | "too_long"
    | "no_example"
    | "irrelevant"
    | "copied_reference"
    | "vague"
    | "wrong_value"
    | "unreadable"
    | "no_transcript"
    | "runtime_error"
    | "wrong_output"
    | "not_attempted";
  message: string;
  /** The corrective teaching note, in plain language. */
  teach: string;
};

export type SnsaiReport = {
  /** Overall marks this answer would earn, 0..maxMarks. */
  marks: number;
  maxMarks: number;
  /** 0..1 overall quality, independent of the mark weighting. */
  quality: number;
  verdict: SnsaiVerdict;
  /** One-line headline, e.g. "Right idea, two key points missing". */
  headline: string;
  /** Per-point breakdown shown as a checklist. */
  criteria: SnsaiCriterion[];
  /** Everything wrong or missing, most important first. */
  faults: SnsaiFault[];
  /** The teaching section: what the idea is, in simple steps. */
  teaching: string[];
  /** The full reference answer, always shown after a Check. */
  reference: string;
  /** Optional short next step for the student. */
  nextStep: string;
  /** Debug/telemetry — kept small, useful for tuning the engine. */
  signals: {
    words: number;
    similarity: number;
    coverage: number;
    precision: number;
    elapsedMs: number;
  };
};

/** What the caller must hand the engine for one question. */
export type SnsaiInput = {
  type: "MCQ" | "SHORT" | "LONG" | "CODING" | "SQL" | "ORAL" | "UPLOAD";
  /** The question text as shown to the student. */
  stem: string;
  /** The admin's reference / model answer. */
  reference: string;
  /** Marks available for this question. */
  maxMarks: number;
  /** The student's submitted payload, shape depends on `type`. */
  payload: unknown;
  /** MCQ only. */
  options?: { id: string; text: string; isCorrect: boolean }[];
  /** CODING / SQL only. */
  testCases?: { input: string; expected: string }[];
  /** SQL only. */
  sqlContext?: { dialect?: string | null; schemaSql?: string | null; seedSql?: string | null };
  /** ORAL only — transcript produced by the browser's speech recognition. */
  transcript?: string;
  /** ORAL/UPLOAD only — was audio actually captured? */
  hasAudio?: boolean;
  /** Optional administrator-authored key points. When present they replace the
   *  automatically extracted ones, which makes the marking more predictable. */
  keyPoints?: string[];
};
