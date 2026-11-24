export const STREAMS = {
  HUMANITIES: "Humanities",
  SCIENCE: "Science",
  COMMERCE: "Commerce",
} as const;

export type StreamKey = keyof typeof STREAMS;

export const QUESTION_TYPES = {
  MCQ: "Multiple Choice",
  SHORT: "Short Answer",
  LONG: "Long Answer",
  CODING: "Coding",
  SQL: "Database / SQL",
  ORAL: "Oral / Verbal",
  UPLOAD: "Photo Upload",
} as const;

export const ASSESSMENT_KINDS = {
  ASSIGNMENT: "Assignment",
  MOCK: "Mock Test",
  TEST: "Real Test",
} as const;

export const CODEC_LANGUAGES = ["python", "javascript", "java", "cpp", "c", "rust"] as const;
export type CodeLanguage = (typeof CODEC_LANGUAGES)[number];

export const SQL_DIALECTS = ["MySQL", "PostgreSQL", "SQLite"] as const;

export const FACE_CONFIG = {
  MAX_FACE_PX: 70,
  MIN_FACE_PX: 112,
  ENROLL_SAMPLES: 5,
  // ArcFace (InsightFace "buffalo_l") produces 512-d L2-normalized embeddings.
  // Face recognition now runs entirely in the Python verification service.
  EMBEDDING_DIM: 512,
  // max allowed cosine distance between a live ArcFace embedding and the
  // enrolled set. Same person: ~0.25-0.35; different people: > 0.55.
  MATCH_DISTANCE: 0.4,
  // max pairwise cosine distance allowed inside a student's OWN enrollment /
  // live verification set (protects against mixing faces or photos).
  SELF_MAX_DISTANCE: 0.45,
  // how long the liveness "blink" challenge waits (kept for compatibility; the
  // deployed liveness check is DeepFace anti-spoofing inside the Python service).
  LIVENESS_WINDOW_MS: 10000,
  BLINKS_REQUIRED: 2,
  // how many quality-gated frames are captured at login and voted on by the
  // server. With N frames a face passes only if >= ceil(N/2) match enrollment.
  CAPTURE_FRAMES: 3,
  // (legacy client-side blink constants, no longer used by the live pipeline)
  EAR_CLOSED_MIN: 0.12,
  EAR_OPEN_MIN: 0.16,
  // max degrees a head may be turned before the frame is rejected as unusable.
  YAW_MAX_DEG: 30,
} as const;

export const ACCESS_CODE_TTL_MS = 60_000;
export const ACCESS_CODE_LENGTH = 6;

/**
 * Login-time policy switches.
 *
 * These live in env rather than the database on purpose: changing them must
 * never touch a migration or a single row of student data. Flipping one and
 * redeploying is enough, and setting it to "0" restores the previous behaviour.
 */
export const LOGIN_CONFIG = {
  /**
   * Let a student read their OWN access code after proving their password,
   * without the admin generating it. The password is still required, the code
   * is still single-use and 60s-long, and every issue is written to the
   * activity log.
   *
   * Be aware of what this means: face verification stops being a *requirement*
   * for signing in. Anyone holding a student's password can sign in without
   * passing the face check. Set SELF_SERVICE_ACCESS_CODE=0 to require an
   * admin-issued code again.
   */
  SELF_SERVICE_ACCESS_CODE: process.env.SELF_SERVICE_ACCESS_CODE !== "0",

  /**
   * How many access codes one account may fetch per hour before it is parked.
   * Generous enough that a student retrying after a failed camera never hits
   * it, tight enough that a script looping on the endpoint does.
   */
  SELF_SERVICE_CODES_PER_HOUR: 12,
} as const;

// Payment-success access codes (15 digits) issued by the admin after a student
// is allowed & billed; redeeming one activates exactly one service month.
export const SERVICE_CODE_LENGTH = 15;
export const SERVICE_CODE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
export const SERVICE_PERIOD_MS = 1000 * 60 * 60 * 24 * 30; // 1 month of services
export const SERVICE_CONTACT = "+91 9975510580";

export const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days of inactivity, sliding while in use
/**
 * Window between a correct password and the face/access-code confirmation.
 *
 * This has to cover the slowest part of the flow, not the fastest: granting
 * camera permission, the browser warming up, and the face service itself,
 * which is allowed 120s to answer. The old 90s was shorter than that service's
 * own timeout, so a student on a slow phone or a slow network passed a correct
 * password and was then locked out mid-verification with no way back to the
 * password step. It is still a short-lived credential that can only be used to
 * finish a login that already passed password authentication.
 */
export const PRELOGIN_TTL = 1000 * 60 * 10; // 10 minutes
// ---------------------------------------------------------------------------
// Manual (UPI) payment collection.
//
// There is no payment gateway here: the student pays the student by UPI/PhonePe
// and then proves it. The details below are configuration rather than code so
// the real UPI ID, QR image and helpline number can be dropped in without a
// rebuild, and so nothing secret is baked into the bundle.
// ---------------------------------------------------------------------------
export const PAYMENT_CONFIG = {
  /** Where the student sends the money. */
  upiId: process.env.PAYMENT_UPI_ID || "your-upi-id@okaxis",
  /** Payee name shown by most UPI apps next to the amount. */
  payeeName: process.env.PAYMENT_PAYEE_NAME || "LEOU",
  /**
   * Optional PhonePe/QR artwork in /public, e.g. "/payment-qr.png".
   *
   * Empty by default on purpose: a QR is then generated from the UPI id above, so
   * the code and the printed id can never disagree. Point this at your own
   * PhonePe image once you have one - it takes precedence over the generated code.
   */
  qrImage: process.env.PAYMENT_QR_IMAGE || "",
  /** Human-readable number a student can call if UPI fails. */
  helpline: process.env.PAYMENT_HELPLINE || SERVICE_CONTACT,
  /** Shown next to the QR so a student can confirm who they paid. */
  bankNote: process.env.PAYMENT_BANK_NOTE || "LEOU tuition fees",
} as const;

/**
 * Is the payment setup actually finished?
 *
 * Every value here has a default so the app boots cleanly on a fresh machine,
 * which is exactly why an unconfigured UPI id is dangerous: the pay page renders
 * perfectly, the QR scans, and the money goes to a placeholder. This is what the
 * admin screen checks so that cannot pass unnoticed.
 */
export const PAYMENT_IS_PLACEHOLDER = PAYMENT_CONFIG.upiId === "your-upi-id@okaxis";

/** How a student proved they paid. */
export const PAYMENT_METHODS = {
  TRANSACTION_ID: "TRANSACTION_ID",
  SCREENSHOT: "SCREENSHOT",
  CAMERA_SCAN: "CAMERA_SCAN",
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
