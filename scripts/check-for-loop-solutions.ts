/**
 * Checks every reference solution in the for-loop seed data against its own
 * hidden expected output, by actually running it under python3 with the test
 * case's stdin. A wrong expected string is a broken question, so this runs
 * before anything is seeded.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/check-for-loop-solutions.ts
 */
import { execFileSync } from "node:child_process";
import { SEED_QUESTIONS, type SeedQuestion } from "./data/practicalForLoopQuestions";

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
export function verifySolutions(questions: SeedQuestion[] = SEED_QUESTIONS): string[] {
  const failures: string[] = [];
  for (const q of questions) {
    if (q.reuseExisting) continue;
    if (!q.solutionCode || !q.testCases?.length) {
      failures.push(`${q.key}: no solution or no test cases`);
      continue;
    }
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
if ((process.argv[1] ?? "").includes("check-for-loop-solutions")) {
  const failures = verifySolutions();
  for (const f of failures) console.log(`FAIL ${f}`);
  const written = SEED_QUESTIONS.filter((q) => !q.reuseExisting);
  const reused = SEED_QUESTIONS.filter((q) => q.reuseExisting);
  const cases = written.reduce((n, q) => n + (q.testCases?.length ?? 0), 0);
  console.log(
    `\n${written.length} new solutions, ${cases} cases, ${reused.length} reused questions, ${failures.length} failure(s)`,
  );
  process.exit(failures.length ? 1 : 0);
}
