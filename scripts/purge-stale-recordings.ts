/**
 * Daily retention sweep for doubt recordings.
 *
 * Calls the app's own purge route rather than touching the database directly.
 * That is deliberate: the recordings live on a Docker volume inside the app
 * container, so a sweep run on the host can mark rows deleted but cannot unlink
 * the bytes. Doing it inside the app keeps the row and the file in agreement.
 *
 * Run daily from com.leou.purge-recordings, or by hand:
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/purge-stale-recordings.ts
 */
import "dotenv/config";
import { SESSION_COOKIE, createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";

async function main() {
  // An admin session is minted rather than stored: this script is maintenance,
  // not a user, and it already has direct database access on this host.
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) {
    console.log("purge: no admin account to authenticate as; skipping");
    return;
  }
  const session = await createSession({ id: admin.id, role: "ADMIN" }, { userAgent: "recording-retention" });
  // The session exists only to make this one call, so it is removed again
  // afterwards instead of piling up one row a day.
  const dropSession = () => prisma.session.delete({ where: { id: session.sid } }).catch(() => null);

  const res = await fetch(`${BASE}/api/admin/practical/purge-recordings`, {
    method: "POST",
    headers: { Cookie: `${SESSION_COOKIE}=${session.token}` },
  });
  await dropSession();

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.log(`purge: app refused with ${res.status} ${String(json.error ?? "")}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    [
      `retention: ${String(json.retentionDays)} days`,
      `purged: ${String(json.purged)} recording(s)`,
      `freed: ${(Number(json.bytesFreed) / 1024 / 1024).toFixed(1)} MB`,
      `orphan files removed: ${String(json.orphanFilesRemoved)}`,
    ].join(" | ")
  );
}

main()
  .catch((e) => {
    console.log("purge failed:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
