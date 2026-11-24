import { FACE_CONFIG } from "@/lib/constants";

export function isEmbeddingArray(value: unknown): value is number[][] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (v) =>
      Array.isArray(v) &&
      v.length === FACE_CONFIG.EMBEDDING_DIM &&
      v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function isSingleEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === FACE_CONFIG.EMBEDDING_DIM &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 1;
  return 1 - dot / denom;
}

/**
 * A degenerate input is one that was never produced by a real face (all zeros,
 * NaNs, or a near-constant vector). Such a vector must never be trusted as a
 * verification sample — reject it outright instead of scoring it.
 */
export function isDegenerateEmbedding(value: number[]): boolean {
  let min = Infinity;
  let max = -Infinity;
  let hasFinite = false;
  for (const n of value) {
    if (!Number.isFinite(n) || Math.abs(n) < 0.00001) continue;
    hasFinite = true;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  if (!hasFinite) return true; // all zeros / non-finite
  return max - min < 0.02; // near-constant → not a real face descriptor
}

export function bestMatchDistance(value: number[], enrolled: number[][]): number {
  if (isDegenerateEmbedding(value)) return 1;
  let best = Infinity;
  for (const e of enrolled) {
    if (isDegenerateEmbedding(e)) continue;
    const d = cosineDistance(value, e);
    if (Number.isFinite(d) && d < best) best = d;
  }
  return best;
}

/** Element-wise mean of an embedding — used to fuse several live frames. */
export function meanEmbedding(samples: number[][]): number[] {
  if (samples.length === 0) return [];
  const out = new Array(samples[0].length).fill(0);
  for (const s of samples) for (let i = 0; i < out.length; i++) out[i] += s[i];
  for (let i = 0; i < out.length; i++) out[i] /= samples.length;
  return out;
}

export function isFaceMatch(value: number[], enrolled: number[][]): boolean {
  return bestMatchDistance(value, enrolled) <= FACE_CONFIG.MATCH_DISTANCE;
}

export type FaceGroupSelection =
  | { ok: true; kept: number[]; dropped: number[] }
  | { ok: false; reason: "empty" | "inconsistent"; kept: number[]; dropped: number[] };

/**
 * Chooses the largest group of embeddings that clearly depict ONE face.
 *
 * The rule this replaces — "reject if ANY two samples are farther apart than
 * SELF_MAX" — had zero tolerance for a single blurry or badly-lit frame, so a
 * perfectly good capture of one student was thrown away because one of five
 * frames drifted past the threshold (a head turned a little, a moment of motion
 * blur, a passing shadow). The student was correctly in frame the whole time.
 *
 * This measures every sample against the medoid — the sample closest, on
 * average, to all the others — keeps the samples that agree with it, and only
 * refuses when agreement is not a majority or when the leftovers themselves
 * form a second, sizeable face, i.e. a genuinely mixed set. A lone bad frame is
 * dropped instead of failing the whole enrollment, which is both more forgiving
 * and strictly safer: an outlier can never be stored, so it can never water down
 * the login vote.
 *
 * Returns the ORIGINAL indices (so callers can line up the matching photos), in
 * the order they were supplied.
 */
export function selectFaceGroup(
  embeddings: number[][],
  opts: { selfMax?: number; minCore?: number } = {}
): FaceGroupSelection {
  const selfMax = opts.selfMax ?? FACE_CONFIG.SELF_MAX_DISTANCE;
  const minCore = Math.max(1, Math.floor(opts.minCore ?? 3));

  // Drop degenerate (non-face) vectors up front; they must never anchor a group.
  const samples = embeddings
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => Array.isArray(e) && e.length > 0 && !isDegenerateEmbedding(e));

  const n = samples.length;
  if (n === 0) return { ok: false, reason: "empty", kept: [], dropped: [] };

  const dist: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const d = cosineDistance(samples[a].e, samples[b].e);
      dist[a][b] = d;
      dist[b][a] = d;
    }
  }

  const medoidOf = (positions: number[]): number => {
    let best = positions[0];
    let bestMean = Infinity;
    for (const a of positions) {
      let sum = 0;
      for (const b of positions) sum += dist[a][b];
      const mean = positions.length > 1 ? sum / (positions.length - 1) : 0;
      if (mean < bestMean) {
        bestMean = mean;
        best = a;
      }
    }
    return best;
  };

  const all = Array.from({ length: n }, (_, i) => i);
  const medoid = medoidOf(all);
  const keptPos = all.filter((a) => a === medoid || dist[a][medoid] <= selfMax);
  const dropPos = all.filter((a) => !keptPos.includes(a));

  const kept = keptPos.map((p) => samples[p].i);
  const dropped = dropPos.map((p) => samples[p].i);

  // Not enough agreement, or the agreeing samples are not a majority: refuse.
  if (keptPos.length < minCore || keptPos.length * 2 < n) {
    return { ok: false, reason: "inconsistent", kept, dropped };
  }

  // If the leftovers are themselves a consistent, sizeable face, the set really
  // does contain two different people — refuse rather than silently pick a side.
  if (dropPos.length >= minCore) {
    const dMedoid = medoidOf(dropPos);
    const within = dropPos.filter((a) => a === dMedoid || dist[a][dMedoid] <= selfMax).length;
    if (within >= minCore) return { ok: false, reason: "inconsistent", kept, dropped };
  }

  return { ok: true, kept, dropped };
}