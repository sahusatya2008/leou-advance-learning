/**
 * Opens the real student practical page for a given username and checks the
 * server-rendered HTML, then closes the session it minted. Read-only.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/check-for-loop-page.ts rolex
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const USERNAME = process.argv[2] ?? "rolex";
const ASSIGNMENT = "cmuv2egn4009m2spj5d0gxyhx";

async function main() {
  const user = await prisma.user.findUnique({ where: { username: USERNAME }, select: { id: true } });
  if (!user) throw new Error(`no user named ${USERNAME}`);
  const session = await createSession({ id: user.id, role: "STUDENT" }, { userAgent: "page-check" });
  try {
    const res = await fetch(`${BASE}/dashboard/practicals/${ASSIGNMENT}`, {
      headers: { Cookie: `${SESSION_COOKIE}=${session.token}` },
    });
    const html = await res.text();
    console.log(`${USERNAME}: GET /dashboard/practicals/${ASSIGNMENT} -> ${res.status} (${html.length} bytes)`);
    for (const needle of ["Loop Practical", "While loop", "For loop", "Very Important", "for loop"]) {
      console.log(`  ${html.includes(needle) ? "found  " : "absent "} ${JSON.stringify(needle)}`);
    }
    // Each block header is rendered once per block in the sidebar, so a missing
    // block or a duplicated one shows up here.
    const blocks = ["While loop", "For loop"].map((label) => html.split(label).length - 1);
    console.log(`  block headers : while=${blocks[0]} for=${blocks[1]}`);
    if (res.status !== 200) process.exitCode = 1;
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
