/**
 * The single place every browser-side request goes through.
 *
 * Three separate failures used to reach the UI as raw crashes, all of them the
 * same shape: the browser asked for JSON and something answered with HTML.
 *
 *  1. An expired or wrong-role session used to produce a `307` to the login
 *     page. `fetch` follows redirects silently, so the caller saw a `200` with
 *     `text/html` and `res.json()` threw `Unexpected token '<'`.
 *  2. An unhandled server exception answers with Next's HTML/plain-text error
 *     page, so `.json()` threw the same way.
 *  3. During an app restart the tunnel serves its own HTML 502 page, which no
 *     server log records.
 *
 * The fix is not to make each caller careful. It is to refuse to parse a
 * non-JSON body as JSON and to turn every failure mode into a typed error the
 * UI can describe in words. Content type and redirect destination are checked
 * *before* parsing, because `res.ok` is useless here: a followed redirect
 * arrives as `200`.
 */

/** Longer than any server block we set, so a retry is never wasted. */
const MAX_WAIT_MS = 65_000;

const DEFAULT_TIMEOUT_MS = 30_000;

export class RateLimitedError extends Error {
  readonly retryAfter: number;
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitedError";
    this.retryAfter = retryAfter;
  }
}

/** The session is gone (or was never valid). The UI should send them to /login. */
export class SessionExpiredError extends Error {
  constructor(message = "Your session has ended. Please sign in again.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

/** A real HTTP failure with a real status. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The network or the tunnel is down; retrying shortly is reasonable. */
export class NetworkError extends Error {
  constructor(message = "Cannot reach the server. Check your connection and try again.") {
    super(message);
    this.name = "NetworkError";
  }
}

/** True when the caller should navigate to the login page. */
export function isSessionExpired(err: unknown): err is SessionExpiredError {
  return err instanceof SessionExpiredError;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryAfterMs(res: Response): number {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, MAX_WAIT_MS);
  // No usable header: back off briefly rather than hammering immediately.
  return 2_000;
}

function isJson(res: Response): boolean {
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json") || ct.includes("+json");
}

/**
 * Did the request end up somewhere other than where it was sent?
 *
 * An expired session answers with a redirect to the login page. The browser
 * follows it, so by the time we look the status is `200` and the body is the
 * login HTML. Comparing the final URL against the requested path is what makes
 * this detectable.
 */
function redirectedToLogin(res: Response, input: RequestInfo | URL): boolean {
  if (!res.redirected || !res.url) return false;
  let requested = "";
  try {
    requested = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname;
  } catch {
    requested = "";
  }
  // Only the auth entry points matter; a legitimate 307 elsewhere is fine.
  return /^\/(login|admin|dashboard|onboarding|parent)(\/|$)/.test(new URL(res.url).pathname) && !requested.startsWith("/login");
}

type Opts = RequestInit & { retries?: number; timeoutMs?: number };

function withTimeout(init: RequestInit, timeoutMs: number): RequestInit {
  if (timeoutMs <= 0) return init;
  const { retries, timeoutMs: _t, signal, ...rest } = init as Opts;
  void retries;
  void _t;
  const timeout = AbortSignal.timeout(timeoutMs);
  return { ...rest, signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

/**
 * `fetch` with transparent recovery from a transient failure.
 *
 * Retries are deliberately conservative so nothing is ever submitted twice:
 *
 *  - `429` is retried for every method. The server rejected the request before
 *    doing any work, so replaying it is safe, and it carries `Retry-After`.
 *  - Network drops and `5xx` are retried only for safe methods (`GET`,
 *    `HEAD`). A dropped `POST` may already have been applied, so re-sending it
 *    could duplicate a payment or an onboarding request.
 */
export async function fetchWithRetry(input: RequestInfo | URL, init?: Opts): Promise<Response> {
  const { retries = 1, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init ?? {};
  const method = (rest.method ?? "GET").toUpperCase();
  const safeMethod = method === "GET" || method === "HEAD";
  const headers = new Headers(rest.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");

  let lastNetworkError: unknown = null;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(input, withTimeout({ ...rest, headers }, timeoutMs));
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") throw new NetworkError("The request timed out. Please try again.");
      lastNetworkError = err;
      // Retry a dropped connection only when re-sending cannot duplicate work.
      if (safeMethod && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw new NetworkError();
    }

    if (res.status === 429) {
      if (attempt < retries) {
        await sleep(retryAfterMs(res));
        continue;
      }
      let seconds = 0;
      try {
        const body = (await res.clone().json()) as { retryAfter?: number };
        seconds = Number(body.retryAfter ?? 0);
      } catch {
        /* body is optional; the header already told us */
      }
      throw new RateLimitedError("Too many requests. Please wait a few seconds and try again.", seconds);
    }

    // An ended session is answered with a redirect to the login page. Catch it
    // here, before the body is ever parsed, so it can never become a parse error.
    if (redirectedToLogin(res, input)) {
      throw new SessionExpiredError();
    }

    if (res.status === 401) throw new SessionExpiredError();

    // A 5xx on a safe method is worth one more attempt; on anything else the
    // caller must decide, because we cannot know if it was applied.
    if (res.status >= 500 && safeMethod && attempt < retries) {
      await sleep(500 * (attempt + 1));
      continue;
    }

    if (lastNetworkError) throw new NetworkError();
    return res;
  }
}

/**
 * Read a JSON body, refusing anything that is not JSON.
 *
 * This is the guard that turns "Unexpected token '<'" into a sentence a user
 * can act on. The HTML itself is never surfaced, because it is server chrome,
 * not an explanation.
 */
export async function parseJson<T = unknown>(res: Response): Promise<T> {
  if (!isJson(res)) {
    if (res.status >= 500) throw new ApiError("The server had a problem. Please try again.", res.status);
    throw new ApiError("The server sent an unexpected response. Please try again.", res.status);
  }
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("The server sent an unreadable response. Please try again.", res.status);
  }
}

/**
 * `fetch` + JSON parse with the same guarantees, in one call.
 *
 * Rejects with a typed error for every failure mode: `SessionExpiredError`,
 * `RateLimitedError`, `NetworkError`, `ApiError` (a real HTTP status).
 */
export async function apiJson<T = unknown>(input: RequestInfo | URL, init?: Opts): Promise<T> {
  const res = await fetchWithRetry(input, init);
  const data = await parseJson<T>(res);
  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error;
    if (res.status === 403) throw new ApiError(message ?? "You do not have access to that.", res.status);
    throw new ApiError(message ?? `Request failed (${res.status}).`, res.status);
  }
  return data;
}

/**
 * The error text to show a user.
 *
 * A raw `SyntaxError` from `JSON.parse`, or a `TypeError: Failed to fetch`,
 * tells a student nothing and suggests the app is broken. These do not.
 */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof SessionExpiredError) return err.message;
  if (err instanceof RateLimitedError) return err.message;
  if (err instanceof NetworkError) return err.message;
  if (err instanceof ApiError) return err.message;
  if (err instanceof SyntaxError) return "The server sent an unexpected response. Please try again.";
  if (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message)) return "Cannot reach the server. Check your connection and try again.";
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
