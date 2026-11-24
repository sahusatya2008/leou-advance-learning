/**
 * In-process sliding-window rate limiter.
 *
 * Runs in the Node runtime (Next 16 Proxy defaults to Node, and route handlers
 * are Node too), so one limiter instance is shared by every request the process
 * serves. That is exactly right for a single-instance deployment; if this app
 * is ever scaled to more than one instance the store must move to Redis, or
 * each instance will only see its own share of traffic.
 */

type Bucket = { hits: number[]; blockedUntil: number; strikes: number; lastOk: number };

const buckets = new Map<string, Bucket>();

// Keep the map from growing without bound under random-key traffic.
const MAX_BUCKETS = 20_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    const stale = bucket.hits.every((t) => now - t > 3_600_000) && bucket.blockedUntil < now;
    if (stale) buckets.delete(key);
    if (buckets.size <= MAX_BUCKETS * 0.8) break;
  }
}

export type RateLimitRule = {
  /** Requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /**
   * The FIRST block, in milliseconds, once the limit is hit. Subsequent blocks
   * double from here up to `maxBlockMs`. This is the whole point of the change:
   * a student who trips a limit by retrying a form should wait seconds, while
   * someone actually hammering waits minutes.
   */
  blockMs?: number;
  /** Ceiling for the escalating block. Defaults to 15 minutes. */
  maxBlockMs?: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds the caller should wait before retrying. */
  retryAfter: number;
};

export function rateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], blockedUntil: 0, strikes: 0, lastOk: 0 };
    buckets.set(key, bucket);
  }

  const baseMs = rule.blockMs ?? rule.windowMs;
  const capMs = rule.maxBlockMs ?? 15 * 60_000;
  const backoff = (strikes: number) => Math.min(capMs, baseMs * 2 ** Math.min(strikes, 6));

  // Already blocked. Each further attempt escalates, so quietly waiting costs
  // the legitimate user seconds while a client that keeps hammering climbs
  // towards the cap on its own.
  if (bucket.blockedUntil > now) {
    bucket.strikes += 1;
    const wait = backoff(bucket.strikes);
    bucket.blockedUntil = now + wait;
    return { ok: false, remaining: 0, retryAfter: Math.ceil(wait / 1000) };
  }

  // A quiet window clears the escalation, so one bad afternoon does not keep
  // penalising a student tomorrow.
  if (bucket.strikes > 0 && now - bucket.lastOk > rule.windowMs) bucket.strikes = 0;

  bucket.hits = bucket.hits.filter((t) => now - t < rule.windowMs);

  if (bucket.hits.length >= rule.limit) {
    bucket.strikes += 1;
    const wait = backoff(bucket.strikes);
    bucket.blockedUntil = now + wait;
    bucket.hits = [];
    return { ok: false, remaining: 0, retryAfter: Math.ceil(wait / 1000) };
  }

  bucket.lastOk = now;
  bucket.hits.push(now);
  return { ok: true, remaining: rule.limit - bucket.hits.length, retryAfter: 0 };
}

/** Clear a bucket after a legitimate success (e.g. a correct password). */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * Progressive lockout for credential endpoints: the more failures, the longer
 * the caller is parked. This is what stops password and access-code guessing.
 */
export function registerFailure(key: string, baseMs = 1_000, maxMs = 15 * 60_000): number {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [], blockedUntil: 0, strikes: 0, lastOk: 0 };
  const failures = bucket.hits.length + 1;
  const wait = Math.min(maxMs, baseMs * 2 ** Math.min(failures, 10));
  bucket.hits = [...bucket.hits, now].slice(-20);
  bucket.blockedUntil = now + wait;
  buckets.set(key, bucket);
  return wait;
}

export function clearFailures(key: string) {
  buckets.delete(key);
}

export function blockedFor(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;
  return Math.max(0, bucket.blockedUntil - Date.now());
}
