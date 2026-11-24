/**
 * Compare what was read off a student's payment screen against the quotation.
 *
 * The scan is evidence, not a decision. This produces a per-field verdict so
 * three different people can look at the same thing: the student, who sees
 * whether their screen matched before submitting; the admin, who gets the
 * comparison next to the screenshot when deciding; and the audit trail, which
 * needs to record what was actually read rather than what was claimed.
 *
 * Every field is reported independently on purpose. A receipt that matches the
 * amount but shows the wrong date is a different situation from one that shows
 * no date at all, and collapsing that into a single pass/fail would throw away
 * the information the admin needs to judge it.
 */

export type CheckState = "match" | "mismatch" | "unreadable";

export type FieldCheck = {
  field: string;
  label: string;
  state: CheckState;
  /** What the OCR read, or null when it could not read it. */
  found: string | null;
  /** What we expected, or null when there is nothing to compare against. */
  expected: string | null;
  detail: string;
};

export type PaymentCheckResult = {
  /** True only when every readable field agreed and nothing contradicted. */
  matches: boolean;
  /** True when a readable field actively disagrees with the quotation. */
  hasMismatch: boolean;
  checks: FieldCheck[];
  /** One line the student can act on. */
  summary: string;
};

/** Money is compared to the paisa; receipts round and print inconsistently. */
function amountsMatch(expected: number, found: number): boolean {
  return Math.abs(expected - found) <= 0.5;
}

function dayDiff(a: Date, b: Date): number {
  const utc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round(Math.abs(utc(a) - utc(b)) / 86_400_000);
}

/**
 * A receipt only proves payment if it was produced around the time the student
 * paid. Older than that and it is a receipt from a previous attempt, which is
 * exactly the case that slips through a manual glance at a screenshot.
 */
const STALE_AFTER_DAYS = 3;

export function verifyPaymentScreen(input: {
  amountFound: number | null;
  amountExpected: number | null;
  dateFound: string | null;
  timeFound: string | null;
  txnFound: string | null;
  now?: Date;
}): PaymentCheckResult {
  const checks: FieldCheck[] = [];
  const now = input.now ?? new Date();

  // Amount - the field that decides whether the quotation was paid in full.
  if (input.amountExpected != null && input.amountFound != null) {
    const ok = amountsMatch(input.amountExpected, input.amountFound);
    checks.push({
      field: "amount",
      label: "Amount",
      state: ok ? "match" : "mismatch",
      found: `₹${input.amountFound.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      expected: `₹${input.amountExpected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      detail: ok
        ? "The amount on your screen matches the quotation."
        : `The screen shows ₹${input.amountFound.toLocaleString("en-IN")} but the quotation is ₹${input.amountExpected.toLocaleString("en-IN")}.`,
    });
  } else {
    checks.push({
      field: "amount",
      label: "Amount",
      state: "unreadable",
      found: null,
      expected:
        input.amountExpected != null
          ? `₹${input.amountExpected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          : null,
      detail:
        input.amountExpected == null
          ? "No quotation amount to compare against."
          : "Could not read an amount from the screen. The admin will check it.",
    });
  }

  // Date - guards against reusing a screenshot from an earlier attempt.
  if (input.dateFound) {
    const found = new Date(`${input.dateFound}T00:00:00Z`);
    const diff = Number.isNaN(found.getTime()) ? null : dayDiff(found, now);
    const future = !Number.isNaN(found.getTime()) && found.getTime() > now.getTime() + 86_400_000;
    const state: CheckState = future || (diff ?? 0) > STALE_AFTER_DAYS ? "mismatch" : "match";
    checks.push({
      field: "date",
      label: "Payment date",
      state,
      found: input.dateFound,
      expected: `within ${STALE_AFTER_DAYS} days`,
      detail: future
        ? "The date on the screen is in the future, so it cannot be a real payment."
        : state === "mismatch"
          ? `The screen is dated ${input.dateFound}, which is ${diff} days ago. If you have already paid, check you are showing this payment.`
          : "The date on your screen is recent.",
    });
  } else {
    checks.push({
      field: "date",
      label: "Payment date",
      state: "unreadable",
      found: null,
      expected: null,
      detail: "Could not read a date from the screen. The admin will check it.",
    });
  }

  // Time - reported, but never a mismatch on its own. Phone clocks drift and
  // receipts sometimes omit the time, so a difference here proves nothing.
  checks.push({
    field: "time",
    label: "Payment time",
    state: input.timeFound ? "match" : "unreadable",
    found: input.timeFound,
    expected: null,
    detail: input.timeFound
      ? `Paid at ${input.timeFound}.`
      : "Could not read a time from the screen.",
  });

  // Reference - the admin uses this to find the payment in the bank statement.
  checks.push({
    field: "reference",
    label: "Transaction reference",
    state: input.txnFound ? "match" : "unreadable",
    found: input.txnFound,
    expected: null,
    detail: input.txnFound
      ? `Read reference ${input.txnFound}.`
      : "Could not read a transaction reference. Type it in if you can.",
  });

  const hasMismatch = checks.some((c) => c.state === "mismatch");
  const unreadable = checks.filter((c) => c.state === "unreadable").length;
  const summary = hasMismatch
    ? "Some details on your screen do not match the quotation. Check them before submitting."
    : unreadable
      ? "Checked, but some details could not be read. The admin will confirm them."
      : "Your screen matches the quotation.";

  return {
    matches: !hasMismatch && unreadable === 0,
    hasMismatch,
    checks,
    summary,
  };
}
