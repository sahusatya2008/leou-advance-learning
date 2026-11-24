/**
 * Read-only: what does a given student see on the renewal-related screens right
 * now? Prints status codes, redirects and a few distinguishing strings.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/inspect-renewal-screens.ts [username]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const USERNAME = process.argv[2] ?? "zeeshanalam";

async function main() {
  const user = await prisma.user.findUnique({ where: { username: USERNAME }, select: { id: true } });
  if (!user) throw new Error(`no user named ${USERNAME}`);
  const session = await createSession({ id: user.id, role: "STUDENT" }, { userAgent: "renewal-screens" });
  try {
    for (const path of ["/onboarding", "/onboarding/renewal", "/dashboard/payments", "/dashboard/plan"]) {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Cookie: `${SESSION_COOKIE}=${session.token}` },
        redirect: "manual",
      });
      const html = res.status === 200 ? await res.text() : "";
      console.log(`\n${path} -> ${res.status}${res.headers.get("location") ? ` (location ${res.headers.get("location")})` : ""}`);
      if (!html) continue;
      const text = html
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<[^>]+>/g, "\n")
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/[ \t]+/g, " ")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const wanted = text.filter((l) =>
        /renew|pay now|service request|quotation|locked|active until|period has ended|₹|payment id|reference/i.test(l)
      );
      for (const line of wanted.slice(0, 22)) console.log(`   ${line.slice(0, 110)}`);
    }

    const requests = await prisma.onboardingRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, status: true, amount: true, lockedAt: true, leouPayRef: true, createdAt: true },
    });
    console.log("\nrequests");
    for (const r of requests) console.log(`   ${r.id} ${r.kind} ${r.status} ₹${r.amount} locked=${r.lockedAt != null} ${r.leouPayRef}`);
  } finally {
    await revokeSession(session.sid).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
