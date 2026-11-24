/**
 * SNSAI — concept extraction and matching.
 *
 * The heart of the engine.
 *
 * A reference answer is not a checklist of sentences. Splitting a 30-word
 * sentence into "one key point" makes that point impossible to hit without
 * copying the answer word-for-word, which is exactly the behaviour SNSAI must
 * not reward. So instead the reference is broken down into **concepts**: short
 * clauses, each reduced to the distinctive terms that carry its meaning.
 *
 * "RAM is volatile: it loses its contents the moment power is removed"
 *   -> concept 1: RAM is volatile                  [ram, volatil]
 *   -> concept 2: RAM loses data when power is off  [ram, power, lose]
 *
 * A student who writes "RAM is temporary and clears on power off" hits both,
 * because "temporary" is in the synonym table for "volatile" and "clears"
 * stems to "clear" ~ "loses" via the concept terms. Nobody has to copy.
 */

import { ABBREVIATIONS, ANTONYMS, canonicalize } from "./lexicon";
import { clamp, sentences, stem, stems, tokenize } from "./text";
import type { SnsaiCriterion } from "./types";

/** Expand abbreviations so "RAM" and "random access memory" compare equal. */
export function expand(text: string): string {
  let out = text;
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    out = out.replace(new RegExp(`\\b${abbr}\\b`, "gi"), full);
  }
  // Hyphens stop tokens like "non-volatile" and "read-mostly" from ever
  // matching a student's "non volatile" or "readonly". Slashes are split for
  // the same reason: expanding "ROM/flash" to "read only memory/flash" left
  // "memory/flash" as one unmatchable token, so a student naming either half
  // was recorded as having missed the point.
  return out.replace(/[-‐-―/]/g, " ");
}

/** Comparison view: expanded, canonicalised, stemmed. */
export function normalise(text: string): string[] {
  return canonicalize(stems(expand(text)));
}

/**
 * Terms too generic to be evidence that a point was made.
 *
 * Stemmed at build time: the engine compares stemmed tokens, so an entry for
 * "used" would never suppress the token "us", and "contents" would not
 * suppress "cont".
 */
const WEAK_TERMS: Set<string> = new Set(
  [
    "system", "computer", "device", "unit", "memory", "data", "program", "example",
    "use", "used", "using", "call", "type", "part", "way", "time", "number", "set",
    "value", "make", "made", "give", "take", "need", "work", "help", "also", "thing",
    "like", "etc", "name", "form", "kind", "state", "list", "answer", "question",
    "means", "refers", "such", "first", "second", "one", "two", "new", "old", "very",
    "must", "can", "will", "would", "should", "may", "might", "shall", "let", "get",
    "per", "via", "which", "whose", "whom", "there", "here", "then", "than", "when",
    "where", "while", "also", "just", "only", "very", "much", "many", "some", "any",
  ].map((w) => stem(w))
);

/** A single teachable idea extracted from the reference answer. */
export type Concept = {
  /** Short human label shown in the checklist. */
  label: string;
  /** Distinctive stemmed terms that make up the concept. */
  terms: string[];
  /** The clause the student is expected to reproduce in meaning. */
  expected: string;
};

/**
 * Split prose into candidate clauses: sentence boundaries first, then colons and
 * semicolons, then commas. Commas alone over-split ("it loses its contents the
 * moment power is removed, so it is used for working memory" is one idea), so
 * fragments that carry no distinctive term are merged back into their
 * neighbour by `extractConcepts`.
 */
/**
 * Modifiers: words that sharpen a point without being the point.
 *
 * "Controls low level hardware" is one idea — controlling hardware. "Low" and
 * "level" only describe it, but they counted as much as "controls" and
 * "hardware", so an answer that said "drives the hardware" covered the idea
 * fully and was still marked as having missed the point. Their weight is
 * reduced rather than dropped, because a student who does echo the intensifier
 * should still be credited for it.
 */
const MODIFIERS: Set<string> = new Set([
  "low", "level", "high", "small", "big", "larg", "general", "ordinari",
  "usual", "common", "basic", "simple", "main", "primari", "certain", "particular",
]);

/** Words that carry no meaning in a label on their own. */
const CONNECTIVES: Set<string> = new Set([
  "into", "from", "with", "that", "which", "when", "where", "while", "than", "then",
  "into", "onto", "over", "under", "about", "also", "just", "only", "very", "such",
]);

/** A clause must have at least this many words to stand as a point on its own. */
const MIN_CLAUSE_WORDS = 4;

const countWords = (s: string) => tokenize(s).filter((w) => w.length > 1).length;

/**
 * Conjunctions and relative pronouns are clause boundaries too.
 *
 * Splitting only on punctuation left "Firmware is software written into
 * non-volatile memory (ROM/flash) that controls low-level hardware and is not
 * usually user-updatable" as a single twenty-word concept. Almost nothing a
 * student writes satisfies twenty words at once — "baked into" is not "written
 * into", "drives" is not "controls" — so the concept scored zero however well
 * the idea was explained, and the answer was marked wrong for being correct.
 *
 * A split is only kept when both sides still carry enough words to be a point
 * in their own right; anything too small is folded back into its neighbour, so
 * short sentences are not shattered into meaningless fragments.
 */
function splitOnConnectors(part: string): string[] {
  const pieces = part
    .split(/\s+(?:and|but|which|that|who|whose|so|because|since|while|whereas|although)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (pieces.length < 2) return [part.trim()];

  const out: string[] = [];
  for (const piece of pieces) {
    if (countWords(piece) < MIN_CLAUSE_WORDS && out.length > 0) {
      out[out.length - 1] = `${out[out.length - 1]} ${piece}`;
    } else {
      out.push(piece);
    }
  }
  // A short tail ("is not usually user-updatable") belongs with what precedes it.
  if (out.length > 1 && countWords(out[out.length - 1]) < MIN_CLAUSE_WORDS) {
    out[out.length - 2] = `${out[out.length - 2]} ${out.pop()}`;
  }
  return out;
}

function clauses(text: string): string[] {
  const out: string[] = [];
  for (const sentence of sentences(text)) {
    for (const part of sentence.split(/\s*[:;]\s*/)) {
      for (const piece of part.split(/\s*,\s*/)) {
        for (const clause of splitOnConnectors(piece)) {
          const trimmed = clause.trim();
          if (trimmed) out.push(trimmed);
        }
      }
    }
  }
  return out;
}

/**
 * Build the concept list for a question.
 *
 * `stem` discounts terms: a word already in the question ("differentiate
 * between RAM and ROM") is repeated by every student and is not evidence that
 * they made a point. The discount is only applied while it leaves the concept
 * with something to say — otherwise "RAM is volatile" would be deleted because
 * "RAM" is in the question, throwing away the single most important point.
 */
export function extractConcepts(reference: string, stem = ""): Concept[] {
  const text = expand(reference).trim();
  if (!text) return [];

  const stemTerms = new Set(normalise(stem));
  const fragments: Array<{ text: string; terms: string[] }> = [];

  for (const clause of clauses(text)) {
    if (tokenize(clause).filter((w) => w.length > 1).length < 2) continue;
    const all = [...new Set(normalise(clause))].filter((t) => t.length > 1 && !WEAK_TERMS.has(t));
    if (all.length === 0) continue;

    // Discount question words, but never so far that the point stops being
    // markable. Keeping at least two terms matters more than it sounds: for
    // "SELECT name FROM students WHERE score > 80" under the question "list the
    // names of students who score above 80", discounting every repeated word
    // leaves only the word SELECT, and then any query at all matches it.
    const keep = Math.max(2, Math.ceil(all.length * 0.4));
    const discounted = all.filter((t) => !stemTerms.has(t));
    let terms = discounted;
    if (discounted.length < keep) {
      // Put the question words back, rarest first, until the concept is big
      // enough to tell one answer from another.
      const restored = all
        .filter((t) => stemTerms.has(t))
        .sort((a, b) => all.indexOf(a) - all.indexOf(b));
      terms = [...discounted, ...restored].slice(0, Math.max(keep, discounted.length));
    }
    fragments.push({ text: clause.replace(/\s+/g, " ").trim(), terms });
  }

  if (fragments.length === 0) return [];

  // Fragments are kept as separate concepts and every term counts.
  //
  // Two refinements were tried here and removed. Merging a thin fragment into
  // its neighbour pulled unrelated sentences together — "It runs first" was
  // absorbed into the previous clause, dragging "runs" into a concept about
  // loading the OS. Dropping terms that recurred across concepts then deleted
  // "operating", "memory" and "machine" from that concept for no gain. Both
  // steps made the marking harder to predict, which is the one thing a
  // marking engine must not be.
  const concepts: Concept[] = [];
  const seen = new Set<string>();
  for (const m of fragments) {
    const key = m.terms.slice().sort().join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    concepts.push({ label: labelFor(m.text, m.terms), terms: m.terms, expected: m.text });
  }
  return concepts;
}

/**
 * A short, readable name for a concept.
 *
 * This is shown to the student, so it must read as English. Taking the first
 * five words produced fragments like "firmware software written into non" —
 * meaningless on their own, and worse when quoted back in a message saying the
 * student "used the opposite term". Connectives and weak words are dropped and
 * the remaining words are the ones the concept is actually about.
 */
function labelFor(clause: string, terms: string[]): string {
  const words = tokenize(clause).filter((w) => w.length > 2 && !WEAK_TERMS.has(w) && !CONNECTIVES.has(w));
  if (words.length === 0) return terms.slice(0, 3).join(" ");
  return words.slice(0, 5).join(" ");
}

/**
 * Score the student's answer against one concept.
 *
 * Terms are weighted by how rare they are across the whole reference, so
 * hitting "firmware" counts for more than hitting "power", and using the terms
 * together earns a small bonus so single scattered words cannot farm credit.
 */
function matchConcept(
  concept: Concept,
  answerTerms: Set<string>,
  answerBigrams: Set<string>,
  rarity: Map<string, number>
): { score: number; matched: string[] } {
  const matched: string[] = [];
  let hitWeight = 0;
  let totalWeight = 0;
  for (const t of concept.terms) {
    const w = (rarity.get(t) ?? 1) * (MODIFIERS.has(t) ? 0.4 : 1);
    totalWeight += w;
    if (answerTerms.has(t)) {
      hitWeight += w;
      matched.push(t);
    }
  }
  if (totalWeight === 0) return { score: 0, matched: [] };
  const coverage = hitWeight / totalWeight;

  // Did the student join the concept's terms, or just sprinkle them?
  const joined = concept.terms.some((t, i) => {
    const next = concept.terms[i + 1];
    return !!next && answerBigrams.has(`${t} ${next}`);
  });

  return { score: clamp(coverage + (joined ? 0.08 : 0)), matched };
}

/** Score the student's answer against every concept in the reference. */
export function buildCriteria(
  reference: string,
  answer: string,
  stem: string,
  adminKeyPoints?: string[]
): { criteria: SnsaiCriterion[]; coverage: number; conflicts: string[] } {
  const ref = adminKeyPoints?.length ? adminKeyPoints.join("; ") : reference;
  const concepts = extractConcepts(ref, stem);
  if (concepts.length === 0) return { criteria: [], coverage: 0, conflicts: [] };

  const answerTerms = new Set(normalise(answer));
  // Contradiction detection uses the student's own words, not the expanded
  // view. Expansion rewrites "ROM" as "read only memory", so an answer that
  // merely says "ROM" arrives carrying the word "read" — and a reference
  // expecting "written" was then read as contradicted by a term the student
  // never typed. That produced a confident "uses the opposite term" fault on
  // a correct answer. The expansion exists to make matching forgiving; it must
  // not invent a disagreement.
  const spokenTerms = new Set(canonicalize(stems(answer)));
  const answerNorm = [...answerTerms];
  const answerBigrams = new Set<string>();
  for (let i = 0; i < answerNorm.length - 1; i++) answerBigrams.add(`${answerNorm[i]} ${answerNorm[i + 1]}`);

  // Rarity within this reference: a term used by every concept is background.
  const conceptCount = new Map<string, number>();
  for (const c of concepts) for (const t of new Set(c.terms)) conceptCount.set(t, (conceptCount.get(t) ?? 0) + 1);
  const rarity = new Map<string, number>();
  for (const [t, n] of conceptCount) rarity.set(t, 1 / n);

  const conflicts: string[] = [];
  const criteria: SnsaiCriterion[] = concepts.map((c) => {
    const { score, matched } = matchConcept(c, answerTerms, answerBigrams, rarity);

    // Contradiction check: the student used this concept's vocabulary but
    // attached the opposite meaning to it. This is the difference between
    // "did not know" and "knew it wrongly", and it matters for teaching.
    const conflict = antonymConflict(c, spokenTerms);
    if (conflict) {
      conflicts.push(conflict);
      return {
        label: c.label,
        score: 0,
        hit: false,
        expected: c.expected,
        matched,
        note: "Stated, but with the opposite meaning.",
      };
    }

    const hit = score >= 0.6;
    return {
      label: c.label,
      score: hit ? Math.min(1, score) : score,
      hit,
      expected: c.expected,
      matched: matched.slice(0, 5),
      note: hit ? undefined : score > 0.25 ? "Partly there, but not stated clearly." : "Not covered.",
    };
  });

  // Every concept counts equally. Weighting the first concept more heavily was
  // tried and rejected: it flattered answers that stated the opening sentence
  // and nothing else, and pushed a half-answer up to 80% of the marks.
  const coverage = criteria.reduce((s, c) => s + c.score, 0) / criteria.length;
  return { criteria, coverage, conflicts };
}

/**
 * Detect "said it backwards": the answer uses the opposite of a term the
 * reference requires, *and does not use the required term itself*.
 *
 * The second half is what makes this safe. Merely finding an antonym somewhere
 * in the answer is not evidence of a contradiction — in a comparison question
 * both sides legitimately appear, and in a long answer the opposite word is
 * often attached to a different sentence entirely. Demanding that the
 * reference's own word is missing is a much stronger signal, and it is what
 * distinguishes "the list is in descending order" (a real contradiction) from
 * an answer that mentions ascending and descending in two different points.
 */
function antonymConflict(concept: Concept, answerTerms: Set<string>): string | null {
  for (const [a, b] of ANTONYMS) {
    for (const [own, flipped] of [
      [a, b],
      [b, a],
    ] as const) {
      if (!concept.terms.includes(own)) continue;
      // The reference's word is present: the student used the right idea, so
      // any antonym here belongs to a different statement.
      if (answerTerms.has(own)) continue;
      if (answerTerms.has(flipped)) {
        return `The answer says "${concept.label}" but uses the opposite term.`;
      }
    }
  }
  return null;
}

/** Cosine similarity over IDF-weighted term frequencies, for the overall shape
 *  of the answer relative to the reference. */
export function cosine(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const tfA = termFreq(a);
  const tfB = termFreq(b);
  const idf = (t: string) => (setA.has(t) && setB.has(t) ? 0 : 1);

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const [t, f] of tfA) {
    const v = (1 + Math.log(f)) * (1 + idf(t));
    magA += v * v;
    const fb = tfB.get(t);
    if (fb) {
      const vb = (1 + Math.log(fb)) * (1 + idf(t));
      dot += v * vb;
    }
  }
  for (const [t, f] of tfB) {
    const v = (1 + Math.log(f)) * (1 + idf(t));
    magB += v * v;
  }
  if (magA === 0 || magB === 0) return 0;
  return clamp(dot / (Math.sqrt(magA) * Math.sqrt(magB)));
}

export function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

/**
 * Precision: how much of the answer is actually about this question. Used to
 * punish rambling and to catch keyword-stuffing, where every word is real but
 * no idea is actually explained.
 */
export function precision(answer: string, reference: string, stem: string): number {
  const answerNorm = normalise(answer);
  if (answerNorm.length === 0) return 0;
  const onTopic = new Set([...normalise(reference), ...normalise(stem)]);
  let hits = 0;
  for (const t of new Set(answerNorm)) if (onTopic.has(t)) hits++;
  return clamp(hits / new Set(answerNorm).size);
}

/** Overlap with the reference, used to detect verbatim copying. */
export function verbatimOverlap(answer: string, reference: string): number {
  const a = [...new Set(normalise(answer))];
  if (a.length === 0) return 0;
  const r = new Set(normalise(reference));
  let shared = 0;
  for (const t of a) if (r.has(t)) shared++;
  return clamp(shared / a.length);
}

/** Numbers written by the student, for arithmetic checking. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Is this a keyword list rather than an explanation? Real answers contain
 * connectives, clauses and end punctuation; a stuffed answer is a bare run of
 * nouns.
 *
 * Both shapes have to be caught. "RAM, ROM, volatile, firmware" is a
 * comma-separated list, but "RAM ROM volatile non-volatile permanent power
 * firmware BIOS DDR4 cache" has no commas at all and is just as much a list —
 * requiring punctuation to spot one let the worst offender through.
 */
export function looksLikeKeywordList(text: string): boolean {
  const words = tokenize(text);
  if (words.length < 4) return false;
  const connectives =
    /\b(is|are|was|were|has|have|does|do|when|which|that|because|so|but|if|than|used|means|lives|loss|loses|holds|performs|prints|reads|writes|carries|consists|becomes|contains|and|or)\b/gi;
  const hits = text.match(connectives)?.length ?? 0;
  if (hits >= 2) return false;

  // A long run of short comma-separated fragments is a list.
  const fragments = text.split(/[,;]/).map((f) => f.trim()).filter(Boolean);
  const shortOnes = fragments.filter((f) => f.split(/\s+/).length <= 3).length;
  if (fragments.length >= 3 && shortOnes / fragments.length >= 0.6) return true;

  // No connectives and no sentence punctuation: a bare run of words.
  return !/[.!?]/.test(text) && words.length >= 5;
}
