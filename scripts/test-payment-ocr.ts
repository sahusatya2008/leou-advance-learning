/**
 * Guards the payment-screen parser.
 *
 * This reads the OCR receipts out of a captured phone screen and compares them
 * against the quotation, so a parsing slip here is what lets a wrong amount or a
 * stale receipt past the admin. The failure modes are subtle - a 12h clock read
 * backwards, an ISO year mistaken for a day - and none of them are visible by
 * eyeballing the output, so they are pinned here.
 *
 * The parsers are pure text, so the test stubs out pytesseract and runs the real
 * functions from the real module. No image, model or container needed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const OCR = "face/service/payment_ocr.py";
if (!existsSync(OCR)) {
  console.error(`FAIL: ${OCR} not found`);
  process.exit(1);
}

// Runs the assertions in the project's own Python (which has cv2); the stub in
// the snippet below is only needed where pytesseract is absent.
const src = readFileSync(OCR, "utf8");
for (const needle of [
  "def _extract_amount(",
  "def _extract_datetime(",
  "def _extract_payee(",
  "def scan_payment(",
]) {
  if (!src.includes(needle)) {
    console.error(`FAIL: payment_ocr.py is missing ${needle}`);
    process.exit(1);
  }
}

const PY = existsSync("face/.venv/bin/python") ? "face/.venv/bin/python" : "python3";
const probe = readFileSync(new URL("./payment-ocr-cases.json", import.meta.url), "utf8");
const cases: { name: string; text: string }[] = JSON.parse(probe);
const expected: Record<string, Record<string, unknown>> = JSON.parse(
  readFileSync(new URL("./payment-ocr-expect.json", import.meta.url), "utf8"),
);

let failures = 0;
for (const c of cases) {
  const out = execFileSync(
    PY,
    ["-c", `
import sys, types, json
sys.modules.setdefault("pytesseract", types.ModuleType("pytesseract"))
sys.path.insert(0, "face/service")
from payment_ocr import _extract_amount, _extract_datetime, _extract_payee, _candidates
text = json.loads(sys.stdin.read())
a, d = _extract_amount(text), _extract_datetime(text)
print(json.dumps({
  "amount": a["value"] if a else None,
  "date": d["date"] if d else None,
  "time": d["time"] if d else None,
  "payee": _extract_payee(text),
  "txn": _candidates(text)[0][0] if _candidates(text) else None,
}))
`],
    { input: JSON.stringify(c.text), encoding: "utf8" },
  );
  const got = JSON.parse(out) as Record<string, unknown>;
  for (const [field, want] of Object.entries(expected[c.name] ?? {})) {
    // A receipt read through a photograph often glues the label onto the
    // reference ("Transacti0n10428190000101"), so assert the digits survive
    // rather than demanding an exact string the OCR had no way to produce.
    if (field === "txn_suffix") {
      const txn = String(got.txn ?? "");
      if (!txn.endsWith(String(want))) {
        console.error(`  FAIL ${c.name}.${field}: got ${JSON.stringify(got.txn)} want to end with ${JSON.stringify(want)}`);
        failures++;
      }
      continue;
    }
    if (got[field] !== want) {
      console.error(`  FAIL ${c.name}.${field}: got ${JSON.stringify(got[field])} want ${JSON.stringify(want)}`);
      failures++;
    }
  }
}

console.log(`${cases.length} payment OCR cases checked, ${failures} failed`);
process.exit(failures ? 1 : 0);
