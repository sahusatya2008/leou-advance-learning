/**
 * Public-exposure limits and security policy.
 *
 * Tuned for a single instance on a free host. Raise deliberately, not blindly:
 * these values are what keep one client from starving everybody else.
 */

export const SECURITY = {
  /** Anything larger than this is rejected before it is read into memory. */
  MAX_BODY_BYTES: 12 * 1024 * 1024,

  /**
   * Limits come in pairs, and the distinction matters.
   *
   * `limit` is the **per-device** budget and is the strict one — that is what
   * actually stops one client hammering an endpoint.
   *
   * `ipLimit` is the **per-IP** budget and is deliberately much looser. A school
   * puts every student behind one NAT address, so a tight per-IP rule would let a
   * single student lock out every other student on the same connection. The
   * per-IP number exists to bound a botnet, not to police individuals; per-username
   * progressive lockout inside the credential routes is what stops guessing.
   *
   * `id` namespaces the bucket, so a 15-minute credential lockout never bleeds into
   * the client's ordinary reads. Keep every `id` unique.
   */
  /**
   * Budgets are sized so that *normal* use can never reach them, and the
   * punishment for reaching one is short. The multi-step onboarding wizard
   * re-posts its quotation on every step and on every retry, and a student
   * working through a form they do not yet understand is exactly who used to
   * get parked for five minutes by the old flat block. These limits exist to
   * stop abuse, not to ration ordinary use.
   */
  API: { id: "api", limit: 600, ipLimit: 6_000, windowMs: 60_000, blockMs: 3_000, maxBlockMs: 30_000 },

  /**
   * Everything that is not `/api` and not a build asset: page renders, RSC
   * navigations, server actions and the cacheable public files. Before the
   * traffic manager only `/api` was budgeted, which left the most expensive
   * surface - server-rendering a page - completely unguarded. Sized identically
   * to API so normal reading is never touched; it exists to blunt a page flood.
   */
  PAGE: { id: "page", limit: 600, ipLimit: 6_000, windowMs: 60_000, blockMs: 3_000, maxBlockMs: 30_000 },

  /**
   * Credential endpoints stay genuinely tight - this is where guessing lives -
   * but they escalate from a short block, so a student who mistypes a password
   * twice is not treated like a brute-forcer.
   */
  LOGIN: { id: "login", limit: 8, ipLimit: 60, windowMs: 5 * 60_000, blockMs: 15_000, maxBlockMs: 15 * 60_000 },
  ACCESS_CODE: { id: "accesscode", limit: 10, ipLimit: 60, windowMs: 5 * 60_000, blockMs: 15_000, maxBlockMs: 15 * 60_000 },
  SERVICE_CODE: { id: "servicecode", limit: 10, ipLimit: 60, windowMs: 5 * 60_000, blockMs: 15_000, maxBlockMs: 10 * 60_000 },

  /**
   * Self-registration is public and each request costs a bcrypt hash plus a
   * stored face photo, so it is throttled well below ordinary writes: a genuine
   * person registers once, a script would register thousands of times. The
   * per-IP ceiling is looser so a whole classroom behind one NAT can still sign
   * up, while a single device is held to a handful per hour.
   */
  REGISTER: { id: "register", limit: 5, ipLimit: 40, windowMs: 60 * 60_000, blockMs: 60_000, maxBlockMs: 60 * 60_000 },

  /** Face embedding: costs real CPU (ArcFace + MiniFASNet), so cap it hard. */
  FACE_EMBED: { id: "faceembed", limit: 30, ipLimit: 300, windowMs: 60_000, blockMs: 10_000, maxBlockMs: 5 * 60_000 },
  FACE_VERIFY: { id: "faceverify", limit: 30, ipLimit: 300, windowMs: 60_000, blockMs: 10_000, maxBlockMs: 5 * 60_000 },

  /** Writes: one client must not flood the database. */
  WRITE: { id: "write", limit: 120, ipLimit: 1_200, windowMs: 60_000, blockMs: 5_000, maxBlockMs: 60_000 },

  UPLOAD: { id: "upload", limit: 60, ipLimit: 600, windowMs: 60_000, blockMs: 10_000, maxBlockMs: 2 * 60_000 },

  /**
   * Host-wide shield. This is not a per-client budget - it is the aggregate
   * request rate this one Mac will accept no matter who is asking. It is a
   * token bucket (smooth refill, not a fixed window) and deliberately generous:
   * ordinary bursts never touch it, its only job is to shed a flood so the box
   * stays responsive for everyone else. Env-tunable so the ceiling can move on
   * the host without a rebuild.
   */
  GLOBAL: {
    ratePerSec: Number(process.env.TRAFFIC_GLOBAL_RPS ?? "100"),
    burst: Number(process.env.TRAFFIC_GLOBAL_BURST ?? "400"),
  },

  /**
   * The probes that must answer even mid-flood: `/api/health` (the watchdog's
   * lifeline - if it cannot get a reply it will restart a perfectly healthy app)
   * and `/api/traffic` (the readout used to diagnose the flood). They get their
   * own, far more generous bucket rather than an outright exemption, so they
   * stay effectively always-available but a flood pointed straight at them is
   * still bounded. A watchdog poll is ~2/min, nowhere near this ceiling.
   */
  GLOBAL_PROBE: {
    ratePerSec: Number(process.env.TRAFFIC_PROBE_RPS ?? "50"),
    burst: Number(process.env.TRAFFIC_PROBE_BURST ?? "100"),
  },

  /** Longest edge cache TTL we ever set on a public HTML response. */
  CDN_MAX_AGE: 0,
} as const;

/** The per-IP variant of a rule, used by the proxy's IP bucket. */
export function ipRuleFor<T extends { limit: number; ipLimit?: number }>(rule: T) {
  return rule.ipLimit === undefined ? rule : { ...rule, limit: rule.ipLimit };
}

/**
 * Content-Security-Policy. Next.js injects inline bootstrap scripts, so the
 * policy allows 'unsafe-inline' for scripts (removing it needs per-request
 * nonces wired through the whole app) but still blocks every external origin,
 * which is what stops a payload from phoning home or loading a remote kit.
 */
export function cspHeader(): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // ngrok injects its own interstitial/banner styles in front of the app.
    "style-src 'self' 'unsafe-inline' https://*.ngrok-free.dev https://*.ngrok.io",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.ngrok-free.dev https://*.ngrok.io"
      : "script-src 'self' 'unsafe-inline' https://*.ngrok-free.dev https://*.ngrok.io",
    "img-src 'self' data: blob: https://*.ngrok-free.dev https://*.ngrok.io",
    "font-src 'self' data:",
    // Monaco builds its language/worker hosts from a Blob URL and imports our
    // own same-origin script inside it. Without this, workers are blocked and
    // monaco falls back to running them on the main thread (UI freezes on big
    // files). Blob URLs are same-origin to us and carry no more power than the
    // 'unsafe-inline' script-src already does.
    "worker-src 'self' blob:",
    "connect-src 'self' https://*.ngrok-free.dev https://*.ngrok.io wss://*.ngrok-free.dev wss://*.ngrok.io",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
