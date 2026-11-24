/**
 * Prints the practical sidebar's text as the browser receives it, so the block
 * grouping (While loop / For loop), the per-block counters and the per-block
 * numbering can be eyeballed without a browser.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/dump-practical-sidebar.ts [username]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const USERNAME = process.argv[2] ?? "rolex";
const ASSIGNMENT = "cmuv2egn4009m2spj5d0gxyhx";

const strip = (html: string) =>
  html
    .replace(/<\/(p|div|button|span|li)>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

async function main() {
  const user = await prisma.user.findUnique({ where: { username: USERNAME }, select: { id: true } });
  if (!user) throw new Error(`no user named ${USERNAME}`);
  const session = await createSession({ id: user.id, role: "STUDENT" }, { userAgent: "sidebar-dump" });
  try {
    const res = await fetch(`${BASE}/dashboard/practicals/${ASSIGNMENT}`, {
      headers: { Cookie: `${SESSION_COOKIE}=${session.token}` },
    });
    const html = await res.text();
    // The page shell has its own <aside>; the workspace one is the one that
    // carries the progress line.
    const chunks = html.split("<aside").slice(1);
    const chunk = chunks.find((c) => c.includes("While loop") && c.includes("For loop"));
    if (!chunk) throw new Error("practical sidebar not found in the rendered page");
    const lines = strip(chunk.slice(0, chunk.indexOf("</aside>")));
    console.log(`${USERNAME}: ${lines.length} lines in the sidebar\n`);
    for (const line of lines) console.log(`  ${line.slice(0, 96)}`);
  } finally {
    await revokeSession(session.sid);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
