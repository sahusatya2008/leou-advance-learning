/**
 * SNSAI — text normalisation layer.
 *
 * Everything here is pure, dependency-free and synchronous. SNSAI runs on every
 * keystroke-triggered "Check", so the whole engine is designed to answer in
 * single-digit milliseconds on a mid-range phone CPU.
 */

/** Words that carry no marking signal. Kept small on purpose: over-aggressive
 *  stop-wording throws away real technical terms like "not", "no", "only". */
export const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "so", "as", "of", "at", "by",
  "for", "with", "about", "into", "to", "from", "in", "on", "is", "are", "was", "were", "be",
  "been", "being", "am", "do", "does", "did", "doing", "have", "has", "had", "having",
  "it", "its", "this", "that", "these", "those", "there", "here", "he", "she", "they",
  "them", "his", "her", "their", "we", "us", "our", "you", "your", "i", "me", "my", "as",
  "which", "what", "who", "whom", "whose", "when", "where", "why", "how", "all", "any",
  "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "too", "very", "can", "will", "just", "should", "now", "also",
  "e", "g", "eg", "ie", "etc", "vs",
]);

/** Suffix-stripping stemmer. Not linguistically perfect, but it is tiny,
 *  predictable and good enough to make "storing"/"stored"/"stores"/"storage"
 *  collapse onto the same root for matching purposes. */
const STEP2: Array<[RegExp, string]> = [
  [/ies$/, "y"], [/sses$/, "ss"], [/([^s])s$/, "$1"],
  [/eed$/, "ee"], [/ed$/, ""], [/ing$/, ""],
];
const STEP3: Array<[RegExp, string]> = [
  [/ational$/, "ate"], [/tional$/, "tion"], [/alism$/, "al"], [/aliti$/, "al"],
  [/iviti$/, "ive"], [/biliti$/, "ble"], [/ation$/, "ate"],
  [/fulness$/, "ful"], [/ousness$/, "ous"], [/iveness$/, "ive"],
  [/ment$/, ""], [/ence$/, "ent"], [/ance$/, "ant"],
  [/able$/, ""], [/ible$/, ""],
  [/ent$/, ""], [/ant$/, ""], [/ism$/, ""], [/ate$/, ""], [/iti$/, ""],
  [/ous$/, ""], [/ive$/, ""], [/al$/, ""],
];
const STEP4: Array<[RegExp, string]> = [
  [/icate$/, "ic"], [/ative$/, ""], [/alize$/, "al"], [/iciti$/, "ic"],
  [/ical$/, "ic"], [/ful$/, ""], [/ness$/, ""], [/ous$/, ""],
  [/ization$/, "ize"], [/ation$/, "ate"], [/ator$/, "ate"],
  [/alism$/, "al"], [/iveness$/, "ive"], [/fulness$/, "ful"], [/ousness$/, "ous"],
];

/**
 * Words ending in "ly" that are not adverbs, and must not be cut in half.
 */
const LY_NOT_ADVERB: Set<string> = new Set([
  "family", "supply", "apply", "reply", "imply", "comply", "multiply", "july",
  "lily", "ally", "bully", "rally", "silly", "tally", "chilly", "holy", "ugly",
  "early", "italy", "monopoly", "rely", "italy", "folly", "jelly", "belly",
  "only", "assembly", "anomaly", "homily", "melancholy",
]);

export function stem(word: string): string {
  let w = word;
  if (w.length <= 2) return w;
  // An adverb and its adjective must compare equal, or "freely" misses "free"
  // and "directly" misses "direct" — which is the whole point of a student
  // answering in their own words. Only "ally" keeps its extra l ("generally"
  // is "general"), and a word ending in "ly" that is not an adverb is left
  // alone.
  if (w.length > 4 && w.endsWith("ly") && !LY_NOT_ADVERB.has(w)) {
    // "easily" is "easy" with "ily" for "y", not a bare "ly" to drop.
    const base = w.endsWith("ily") ? `${w.slice(0, -3)}y` : w.slice(0, -2);
    if (base.length >= 3) w = base;
  }
  for (const [re, rep] of STEP2) {
    if (re.test(w)) {
      w = w.replace(re, rep);
      // "hopping" -> "hop", but keep doubled consonant ("running" -> "runn" -> "run")
      if (/ing$|ed$/.test(re.source) && /([bdfglmnprt])\1$/.test(w)) w = w.slice(0, -1);
      break;
    }
  }
  for (const [re, rep] of STEP3) {
    if (re.test(w)) {
      w = w.replace(re, rep);
      break;
    }
  }
  for (const [re, rep] of STEP4) {
    if (re.test(w)) {
      w = w.replace(re, rep);
      break;
    }
  }
  // Collapse a trailing bare "e" ("cache" -> "cach") but never shorten below 3.
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Split into normalised word tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'#.+/^*-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['.-]+|['.-]+$/g, ""))
    .filter(Boolean);
}

/** Content tokens with stopwords removed. */
export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

/** Content tokens, stemmed, stopwords removed. This is the default unit of
 *  comparison everywhere in SNSAI. */
export function stems(text: string): string[] {
  return contentTokens(text).map(stem);
}

/** Stemmed token set, for O(1) membership tests. */
export function stemSet(text: string): Set<string> {
  return new Set(stems(text));
}

export function ngrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

/** Split prose into sentences without a dependency. Handles ".", "!", "?" and
 *  avoids splitting on decimals, abbreviations and common initials. */
const ABBREV = new Set(["e.g", "i.e", "etc", "vs", "fig", "no", "mr", "mrs", "ms", "dr", "st", "al"]);
export function sentences(text: string): string[] {
  const guarded = text
    .replace(/(\d)\.(\d)/g, "$1<DOT>$2") // protect decimals
    .replace(/\b([A-Z])\./g, "$1<DOT>"); // protect initials
  const raw = guarded.split(/(?<=[.!?])\s+/);
  return raw
    .map((s) => s.replace(/<DOT>/g, ".").trim())
    .filter((s) => {
      if (!s) return false;
      const last = s.split(/\s+/).pop()?.toLowerCase().replace(/[.:;,]$/, "") ?? "";
      return !ABBREV.has(last);
    });
}

/** Word count of natural-language content (numbers still count as words). */
export function wordCount(text: string): number {
  return contentTokens(text).length;
}

export function clamp(n: number, lo = 0, hi = 1): number {
  return n < lo ? lo : n > hi ? hi : n;
}

export function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
