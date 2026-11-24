/**
 * Read-only: prints what the admin Payments page currently shows, per tab.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/inspect-admin-queue.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("no admin user");
  const session = await createSession({ id: admin.id, role: "ADMIN" }, { userAgent: "queue-inspect" });
  try {
    for (const tab of ["REGISTRATION", "RENEWAL", "ADDITIONAL_SERVICE"]) {
      const res = await fetch(`${BASE}/admin/payments?tab=${tab}`, {
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
      console.log(`\n${tab} -> ${res.status}`);
      const start = text.findIndex((l) => /Newly registering/.test(l));
      if (start >= 0) console.log(`   tabs: ${text.slice(start, start + 12).join(" | ")}`);
      const pending = text.findIndex((l) => /Requests awaiting payment/.test(l));
      console.log(`   awaiting-payment section: ${pending >= 0 ? "yes" : "no"}`);
      if (pending >= 0) console.log(`   ${text.slice(pending, pending + 9).join(" | ")}`);
      const proofs = text.findIndex((l) => /Payments waiting for verification/.test(l));
      console.log(`   verification section: ${proofs >= 0 ? "yes" : "no"}`);
      if (proofs >= 0) console.log(`   ${text.slice(proofs, proofs + 7).join(" | ")}`);
      console.log(`   empty state: ${/Nothing waiting under this heading/.test(text.join("\n")) ? "yes" : "no"}`);
    }
  } finally {
    await revokeSession(session.sid).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
