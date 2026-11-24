/**
 * Traffic manager: the host-side shield for an app that runs on a single Mac
 * behind a Tailscale Funnel.
 *
 * The premise is worth stating plainly, because it shapes every number here.
 * This is **not** a request-metered free host - a Funnel has no request or byte
 * meter, only fair-use bandwidth. So "protecting the free tier" really means
 * protecting the machine: the Mac's CPU (each page render is a real render) and
 * its uplink. If the box falls over, the site is down for everyone.
 *
 * Two layers, cheapest first, both applied before a route runs:
 *
 *   1. {@link isScanner} - a small denylist of exploit-probe paths, tooling
 *      user-agents and WebDAV verbs. A scan wave then costs a string compare,
 *      not a render, and gets the cheapest possible 404.
 *
 *   2. {@link takeToken} - a host-wide token bucket. This is the aggregate rate
 *      the Mac will accept regardless of source, so a distributed flood cannot
 *      beat the per-IP rules by simply spreading out. Shedding is a tiny 503
 *      with `Retry-After`, which is far cheaper to produce than a page.
 *
 * Per-IP and per-device budgets stay in the proxy next to the per-route API
 * rules: those are *scoped policy* about a client, whereas this file is about
 * the *host*. Keeping the two apart is why individual limits can stay loose.
 *
 * State is in-process, which is correct for this single-instance deployment.
 * If the app is ever scaled out, each instance would hold its own bucket and the
 * global ceiling would multiply - at that point move this to Redis, exactly as
 * the note in `src/lib/rateLimit.ts` says.
 */

import { SECURITY, SECURITY_HEADERS, cspHeader } from "@/lib/security";

type TokenBucket = { tokens: number; updated: number };

const buckets = new Map<string, TokenBucket>();

/**
 * Paths that only ever show up in automated exploit probes: CMS admin
 * dashboards we do not run, secret files, cloud metadata, known-vulnerable
 * appliance endpoints. Matched as case-insensitive prefixes.
 */
const SCANNER_PATH_PREFIXES = [
  "/wp-admin",
  "/wp-content",
  "/wp-includes",
  "/wp-login",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/pma/",
  "/myadmin",
  "/.git/",
  "/.svn/",
  "/.hg/",
  "/.aws/",
  "/.ssh/",
  "/.env",
  "/.vscode/",
  "/.idea/",
  "/vendor/phpunit",
  "/vendor/autoload.php",
  "/actuator/",
  "/solr/",
  "/cgi-bin/",
  "/manager/html",
  "/hnap1/",
  "/gponform/",
  "/boaform/",
  "/ecp/",
  "/autodiscover/",
  "/server-status",
  "/server-info",
  "/phpinfo",
  "/admin.php",
  "/config.php",
  "/setup.php",
  "/eval",
  "/cpanel",
  "/whm",
  "/webdav",
];

/** Exact paths (also exploit probes, too generic to prefix-match safely). */
const SCANNER_PATH_EXACT = new Set([
  "/.ds_store",
  "/credentials",
  "/id_rsa",
  "/shell",
  "/.git/config",
  "/.git/head",
]);

/**
 * A short list of well-known offensive tooling. This is a denylist, so it only
 * ever catches the lazy end of scanning - that is fine. A determined client
 * rotates its UA; the point is to make the noise cheap, not to be exhaustive.
 * `curl` and the like are deliberately absent: the host's own health checks use
 * them.
 */
const SCANNER_USER_AGENTS = [
  "sqlmap",
  "nikto",
  "nmap",
  "masscan",
  "zgrab",
  "nuclei",
  "acunetix",
  "dirbuster",
  "gobuster",
  "feroxbuster",
  "wpscan",
  "w3af",
  "hydra",
  "commix",
  "jaeles",
  "detectify",
];

/**
 * True when the request looks like automated reconnaissance rather than a
 * person. Callers should answer these with the cheapest possible 404.
 */
export function isScanner(pathname: string, userAgent: string, method: string): boolean {
  const path = pathname.toLowerCase();

  if (SCANNER_PATH_EXACT.has(path)) return true;
  for (const prefix of SCANNER_PATH_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }

  // Directory-listing verbs a browser never sends.
  if (method === "PROPFIND" || method === "TRACE") return true;

  const ua = userAgent.toLowerCase();
  if (ua) {
    for (const tool of SCANNER_USER_AGENTS) {
      if (ua.includes(tool)) return true;
    }
  }

  return false;
}

export type TokenResult = { ok: boolean; retryAfter: number };

/**
 * Spend one token from a named bucket, refilling smoothly at `ratePerSec` up to
 * `burst`. Returns a `Retry-After` (whole seconds) when the bucket is empty.
 *
 * A token bucket rather than a sliding window on purpose: the global ceiling
 * should absorb a short spike without punishing it, and recover the instant the
 * spike ends - which is exactly what "burst then steady rate" means.
 */
export function takeToken(key: string, ratePerSec: number, burst: number): TokenResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: burst, updated: now };
    buckets.set(key, bucket);
  }

  const elapsedSec = (now - bucket.updated) / 1000;
  if (elapsedSec > 0) {
    bucket.tokens = Math.min(burst, bucket.tokens + elapsedSec * ratePerSec);
    bucket.updated = now;
  }

  if (bucket.tokens < 1) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((1 - bucket.tokens) / ratePerSec)) };
  }

  bucket.tokens -= 1;
  return { ok: true, retryAfter: 0 };
}

const startedAt = Date.now();
const counters = { total: 0, api: 0, page: 0, shed: 0, scanners: 0 };
/** Timestamps of recent requests, for a live requests-per-second reading. */
const recent: number[] = [];
const RPS_WINDOW_MS = 5_000;

/** Record a request that was allowed through. `kind` splits the two surfaces. */
export function noteRequest(kind: "api" | "page"): void {
  counters.total += 1;
  counters[kind] += 1;
  recent.push(Date.now());
}

/** Record a request shed by the global shield. */
export function noteShed(): void {
  counters.shed += 1;
}

/** Record a request refused as a scanner probe. */
export function noteScanner(): void {
  counters.scanners += 1;
}

export type TrafficSnapshot = {
  ok: true;
  uptimeSeconds: number;
  rps: number;
  requests: { total: number; api: number; page: number };
  shed: number;
  scanners: number;
  global: { ratePerSec: number; burst: number };
};

/**
 * A coarse, non-sensitive reading of host load. Deliberately counts-only: it is
 * meant for the watchdog and `status.sh`, not for anyone deciding whether to
 * bother attacking. Exposed through the proxy itself (see `trafficReport`) so it
 * reads the *same* in-process state the shield writes.
 */
export function snapshot(): TrafficSnapshot {
  const cutoff = Date.now() - RPS_WINDOW_MS;
  while (recent.length > 0 && recent[0] < cutoff) recent.shift();

  return {
    ok: true,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    rps: Number((recent.length / (RPS_WINDOW_MS / 1000)).toFixed(2)),
    requests: { total: counters.total, api: counters.api, page: counters.page },
    shed: counters.shed,
    scanners: counters.scanners,
    global: { ratePerSec: SECURITY.GLOBAL.ratePerSec, burst: SECURITY.GLOBAL.burst },
  };
}

/** Shared hardening headers, plus a non-empty CSP, for shield responses. */
function shieldHeaders(): Record<string, string> {
  return { ...SECURITY_HEADERS, "Content-Security-Policy": cspHeader(), "Cache-Control": "no-store" };
}

/** The cheapest possible refusal for a scanner: a stub 404, no body to speak of. */
export function scannerResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * The refusal for a genuine client when the host is over capacity. Kept tiny:
 * under load we want to send as few bytes as possible, and `Retry-After` tells
 * well-behaved clients (and our own tooling) when to come back.
 */
export function busyResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: "The server is busy right now. Please try again in a moment.",
      retryAfter,
    }),
    { status: 503, headers: { ...shieldHeaders(), "Content-Type": "application/json", "Retry-After": String(retryAfter) } },
  );
}

/** The `GET /api/traffic` body, served straight from the proxy's own state. */
export function trafficReport(): Response {
  return new Response(JSON.stringify(snapshot()), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
