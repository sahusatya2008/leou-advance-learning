import { rateLimit } from "@/lib/rateLimit";

let fails = 0;
const check = (label: string, ok: boolean, extra = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) fails++;
};

const rule = { id: "t", limit: 5, windowMs: 1_000, blockMs: 1_000, maxBlockMs: 8_000 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("[general endpoint escalation]");
  for (let i = 1; i <= 5; i++) check(`req ${i} allowed`, rateLimit("k1", rule).ok);
  const first = rateLimit("k1", rule);
  check("req 6 blocked", !first.ok);
  check("first block is short, not minutes", first.retryAfter <= 2, `retryAfter=${first.retryAfter}s`);
  const second = rateLimit("k1", rule);
  check("retrying while blocked escalates", second.retryAfter >= first.retryAfter, `retryAfter=${second.retryAfter}s`);
  const third = rateLimit("k1", rule);
  check("hammering keeps escalating", third.retryAfter > second.retryAfter, `retryAfter=${third.retryAfter}s`);
  check("still blocked just after escalating", !rateLimit("k1", rule).ok);

  // The cap on this rule is 8s; wait it out, then prove the escalation decayed.
  await sleep(9_000);
  check("recovers once the block expires", rateLimit("k1", rule).ok);

  // Trip it again: a clean streak must have reset strikes, so this block is
  // short again rather than still escalated from the earlier burst. The recovery
  // call above already spent one hit, so four more fill the window and this
  // next call is the one that trips it.
  for (let i = 0; i < 4; i++) rateLimit("k1", rule);
  const afterQuiet = rateLimit("k1", rule);
  check("escalation was reset by the quiet window", !afterQuiet.ok && afterQuiet.retryAfter <= 2, `retryAfter=${afterQuiet.retryAfter}s`);

  console.log("\n[old behaviour would have been: blockMs=300000 for WRITE]");
  const old = { id: "o", limit: 1, windowMs: 60_000, blockMs: 5 * 60_000 };
  rateLimit("k2", old);
  const r = rateLimit("k2", old);
  check("old-style rule still escalates rather than hard-parking", r.retryAfter >= 300, `retryAfter=${r.retryAfter}s`);

  console.log(fails === 0 ? "\nPASS" : `\nFAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}
main();
