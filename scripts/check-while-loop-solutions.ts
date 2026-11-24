/**
 * Checks every reference solution in the while-loop seed data against its own
 * hidden expected output, by actually running it under python3 with the test
 * case's stdin. A wrong expected string is a broken question, so this runs
 * before anything is seeded, and again as part of the full harness.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/check-while-loop-solutions.ts
 */
import { execFileSync } from "node:child_process";
import { SEED_QUESTIONS } from "./data/practicalWhileLoopQuestions";

export function runPython(code: string, stdin: string): { ok: true; out: string } | { ok: false; error: string } {
  try {
    const out = execFileSync("python3", ["-c", code], {
      input: stdin,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, out: out.replace(/\n$/, "") };
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return { ok: false, error: (err.stderr ?? err.message ?? "").trim().slice(0, 400) };
  }
}

/** One string per failed solution test case; empty means every case matches. */
export function verifySolutions(): string[] {
  const failures: string[] = [];
  for (const q of SEED_QUESTIONS) {
    for (const [i, t] of q.testCases.entries()) {
      const result = runPython(q.solutionCode, t.stdin);
      if (!result.ok) {
        failures.push(`${q.key} case ${i + 1}: solution crashed — ${result.error}`);
        continue;
      }
      if (result.out !== t.expected) {
        const a = t.expected.split("\n");
        const b = result.out.split("\n");
        let line = -1;
        for (let j = 0; j < Math.max(a.length, b.length); j++)
          if (a[j] !== b[j]) {
            line = j + 1;
            break;
          }
        failures.push(
          `${q.key} case ${i + 1}: expected ${JSON.stringify(t.expected.slice(0, 160))} ` +
            `actual ${JSON.stringify(result.out.slice(0, 160))} (line ${line})`,
        );
      }
    }
  }
  return failures;
}

// `require.main` is not reliable under tsx, so match the invoked path instead.
if ((process.argv[1] ?? "").includes("check-while-loop-solutions")) {
  const failures = verifySolutions();
  for (const f of failures) console.log(`FAIL ${f}`);
  const cases = SEED_QUESTIONS.reduce((n, q) => n + q.testCases.length, 0);
  console.log(`\n${SEED_QUESTIONS.length} solutions, ${cases} cases, ${failures.length} failure(s)`);
  process.exit(failures.length ? 1 : 0);
}
