import crypto from "node:crypto";

/** Browser-safe reference helpers. */
export function isLeouPayRefShape(raw: string): boolean {
  return normaliseLeouPayRef(raw) !== "";
}

/**
 * "SNSX powered LEOU" payment reference.
 *
 * A student pays first and proves it afterwards, so the admin needs something
 * to match a UPI entry against. This is that something: it is shown on the Pay
 * Now page before any money moves, the student is asked to note it down, and it
 * travels with the verification request so the admin can reconcile the bank
 * entry.
 *
 * It is a reference, never a secret and never proof of payment - approving is
 * still the admin's decision.
 */

// Crockford-style alphabet: no 0/O/1/I/U, so a reference read aloud or copied
// off a phone screen cannot be misread.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTVWXYZ";
const GROUP = 4;
const GROUPS = 2;

export const LEOU_PAY_PREFIX = "LEOU";

function randomChars(n: number): string {
  const bytes = crypto.randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** e.g. "LEOU-7K2M-QH9X" */
export function newLeouPayRef(): string {
  const groups = Array.from({ length: GROUPS }, () => randomChars(GROUP));
  return `${LEOU_PAY_PREFIX}-${groups.join("-")}`;
}

const REF_RE = new RegExp(`^${LEOU_PAY_PREFIX}(-[${ALPHABET}]{${GROUP}}){${GROUPS}}$`);

/** Accepts a reference the student typed, ignoring case and stray spaces. */
export function normaliseLeouPayRef(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return REF_RE.test(cleaned) ? cleaned : "";
}

/** A deep link that opens the student's UPI app straight on the pay screen. */
export function upiDeepLink(opts: { upiId: string; payeeName: string; amount?: number; note: string }): string {
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName,
    tn: opts.note,
    cu: "INR",
  });
  if (typeof opts.amount === "number" && Number.isFinite(opts.amount) && opts.amount > 0) {
    params.set("am", opts.amount.toFixed(2));
  }
  return `upi://pay?${params.toString()}`;
}
