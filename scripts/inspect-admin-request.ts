/**
 * Read-only: renders one admin request page and prints the meaningful lines, so
 * the wording/counts can be eyeballed without a browser.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/inspect-admin-request.ts <requestId>
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const REQUEST_ID = process.argv[2];

async function main() {
  if (!REQUEST_ID) throw new Error("pass an onboarding request id");
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("no admin user");
  const session = await createSession({ id: admin.id, role: "ADMIN" }, { userAgent: "request-inspect" });
  try {
    const res = await fetch(`${BASE}/admin/payments/requests/${REQUEST_ID}`, {
      headers: { Cookie: `${SESSION_COOKIE}=${session.token}` },
      redirect: "manual",
    });
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/₹/g, "Rs ")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    console.log(`${REQUEST_ID} -> ${res.status}`);
    for (const line of text) console.log(`   ${line}`);
    const row = await prisma.onboardingRequest.findUnique({
      where: { id: REQUEST_ID },
      select: { id: true, kind: true, status: true, amount: true, leouPayRef: true, lockedAt: true },
    });
    console.log("\ndb:", JSON.stringify(row));
  } finally {
    await revokeSession(session.sid).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
