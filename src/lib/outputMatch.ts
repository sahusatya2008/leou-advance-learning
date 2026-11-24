/**
 * Program-output comparison.
 *
 * This lives apart from gradingService on purpose. gradingService is
 * `server-only` and pulls in Prisma, so importing it from the SNSAI engine
 * would drag the whole database stack into a module that must stay pure and
 * cheap. But the two must compare output by exactly the same rule: if Check
 * said a program was wrong and submit said it was right, the feature would be
 * actively harmful.
 *
 * One definition, imported by both.
 */

/**
 * Trim the differences that are not part of an answer: line endings, trailing
 * spaces on a line, and blank lines at the end.
 */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "")
    .trim();
}

/** Do two outputs mean the same thing? */
export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
