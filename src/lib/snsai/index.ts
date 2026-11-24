/**
 * SNSAI — Smart Newschool Support & Assessment Intelligence.
 *
 * The answer-evaluation engine. It runs entirely inside this application:
 * no external API, no model file, no network call, no state. Everything it
 * knows about Computer Science lives in ./lexicon.ts as plain data.
 *
 * Entry point:
 *   import { evaluateAnswer, summariseReports } from "@/lib/snsai/evaluate";
 */

export { evaluateAnswer, summariseReports, SNSAI_VERSION } from "./evaluate";
export { MISCONCEPTIONS, SYNONYMS, ABBREVIATIONS } from "./lexicon";
export { extractConcepts, buildCriteria, cosine, type Concept } from "./keypoints";
export type { SnsaiReport, SnsaiCriterion, SnsaiFault, SnsaiInput, SnsaiVerdict } from "./types";
