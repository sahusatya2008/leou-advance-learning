import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { rateLimit, type RateLimitRule } from "@/lib/rateLimit";
import { SECURITY, SECURITY_HEADERS, cspHeader, ipRuleFor } from "@/lib/security";
import { getRequestMeta } from "@/lib/requestMeta";
import { SESSION_COOKIE } from "@/lib/cookies";
import {
  busyResponse,
  isScanner,
  noteRequest,
  noteScanner,
  noteShed,
  scannerResponse,
  takeToken,
  trafficReport,
} from "@/lib/trafficManager";
// Type-only: erased at compile time, so it does NOT pull the store (and its
// database client) into the Proxy's main chunk.
import type { TrafficRecord } from "@/lib/trafficStore";

/**
 * Next 16 calls this Proxy (it replaced `middleware.ts`). It runs on the Node
 * runtime before a request reaches a route or a page.
 *
 * The work is ordered cheapest-first, so the expensive path is only reached by
 * traffic that has already earned it:
 *   1. answer known scanners with a stub 404 (a string compare, no render),
 *   2. spend a host-wide token so a flood cannot starve the Mac (see
 *      `src/lib/trafficManager.ts` for the two-layer rationale),
 *   3. refuse oversized bodies before they are buffered,
 *   4. spend a per-client rate-limit token (API rules, or the page budget),
 *   5. stamp every response with hardening headers.
 *
 * Proxy is a speed bump, not the security boundary — authorisation stays in the
 * route handlers and server components, as the Next data-security guide requires.
 */

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Paths we never write to the traffic log. The two monitoring endpoints are
 * read by the dashboard itself (and the watchdog) on a timer, so recording them
 * would fill the feed with the act of reading the feed; the identify beacon is
 * bookkeeping about a visitor, not an activity of theirs.
 */
const SKIP_TRAFFIC_RECORD = new Set([
  "/api/traffic",
  "/api/health",
  "/api/admin/traffic",
  "/api/traffic/identify",
]);

/** A per-route rule plus the optional loose per-IP ceiling from `SECURITY`. */
type ClientRule = RateLimitRule & { id: string; ipLimit?: number };

/** Credential and CPU-expensive endpoints get their own, much smaller budget. */
function ruleFor(pathname: string, method: string) {
  if (pathname === "/api/auth/login") return SECURITY.LOGIN;
  if (pathname === "/api/face/embed") return SECURITY.FACE_EMBED;
  if (pathname === "/api/access-code/verify" || pathname.startsWith("/api/access-code/")) {
    return SECURITY.ACCESS_CODE;
  }
  if (pathname.startsWith("/api/upload")) return SECURITY.UPLOAD;
  if (pathname.startsWith("/api/student/onboarding/activate")) return SECURITY.SERVICE_CODE;
  if (pathname.startsWith("/api/") && WRITE_METHODS.has(method)) return SECURITY.WRITE;
  if (pathname.startsWith("/api/")) return SECURITY.API;
  return null;
}

/** Flat rate-limit JSON, used by both the API and page budgets. */
function limitedResponse(rule: { limit: number; id: string }, retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly.", retryAfter },
    {
      status: 429,
      headers: {
        ...SECURITY_HEADERS,
        "Content-Security-Policy": cspHeader(),
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(rule.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(retryAfter),
      },
    },
  );
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const meta = getRequestMeta(request);

  // 1. Reconnaissance gets the cheapest possible answer and nothing else.
  if (isScanner(pathname, meta.userAgent, method)) {
    noteScanner();
    return scannerResponse();
  }

  // 2. The host-wide token: the aggregate ceiling, independent of source. The
  //    watchdog's probes draw from a separate, generous bucket so they still
  //    answer mid-flood (see SECURITY.GLOBAL_PROBE).
  const isProbe = pathname === "/api/health" || pathname === "/api/traffic";
  const ceiling = isProbe ? SECURITY.GLOBAL_PROBE : SECURITY.GLOBAL;
  const token = takeToken(isProbe ? "global:probe" : "global", ceiling.ratePerSec, ceiling.burst);
  if (!token.ok) {
    noteShed();
    return busyResponse(token.retryAfter);
  }

  // The traffic readout is served straight from the proxy's own state, and is
  // deliberately the one thing that skips the per-client budgets below.
  if (pathname === "/api/traffic") return trafficReport();

  if (pathname.startsWith("/api/")) {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > SECURITY.MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large." },
        { status: 413, headers: { ...SECURITY_HEADERS, "Content-Security-Policy": cspHeader() } },
      );
    }

    const rule = ruleFor(pathname, method);
    if (rule) {
      const denied = spendClientBudget(rule, meta);
      if (denied) return denied;
    }
  } else {
    // Page renders and cacheable public files: previously unbudgeted, and the
    // most expensive surface on the box. Same loose sizing as API.
    const denied = spendClientBudget(SECURITY.PAGE, meta);
    if (denied) return denied;
  }

  const kind = pathname.startsWith("/api/") ? "api" : "page";
  noteRequest(kind);

  // Record who is on the box and what they asked for. Scheduled, not awaited:
  // the database write happens after the response has been sent.
  if (!SKIP_TRAFFIC_RECORD.has(pathname)) {
    scheduleTrafficRecord(event, {
      kind,
      method,
      path: pathname,
      ip: meta.ip,
      userAgent: meta.userAgent,
      deviceId: meta.deviceId,
      device: meta.device,
      referer: request.headers.get("referer"),
      sessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null,
    });
  }

  return withSecurityHeaders(NextResponse.next());
}

/**
 * Persist a request after the response is sent, via `event.waitUntil`.
 *
 * The store is imported dynamically and every failure is swallowed: the traffic
 * log is an observability nicety, and it must never be able to fail a request,
 * crash the Proxy, or (if the database is down) slow the shield down.
 */
function scheduleTrafficRecord(event: NextFetchEvent | undefined, record: TrafficRecord) {
  if (!event?.waitUntil) return;
  event.waitUntil(
    import("@/lib/trafficStore")
      .then((mod) => mod.recordTraffic(record))
      .catch(() => {}),
  );
}

/**
 * Spend a client's per-IP and per-device budgets, returning a 429 response when
 * either is exhausted (or null when both pass). The split is deliberate: the
 * per-IP budget is loose because a school shares one NAT address, while the
 * per-device budget is the strict one that actually stops abuse. A spoofed
 * X-Forwarded-For alone therefore cannot buy a fresh budget.
 */
function spendClientBudget(
  rule: ClientRule,
  meta: { ip: string; deviceId: string },
) {
  const budgets: Array<[string, ClientRule]> = [
    [`${rule.id}:ip:${meta.ip}`, ipRuleFor(rule)],
    [`${rule.id}:dev:${meta.deviceId}`, rule],
  ];
  for (const [key, budget] of budgets) {
    const result = rateLimit(key, budget);
    if (!result.ok) return limitedResponse(budget, result.retryAfter);
  }
  return null;
}

/** Apply the hardening headers and stop advertising the stack. */
function withSecurityHeaders(response: NextResponse) {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, header === "Content-Security-Policy" ? cspHeader() : value);
  }
  response.headers.delete("X-Powered-By");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
