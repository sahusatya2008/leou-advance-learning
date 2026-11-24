import "dotenv/config";
import { prisma } from "@/lib/prisma";

const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60);

async function main() {
  const rows = await prisma.activityLog.findMany({
    where: { type: { in: ["LOGIN_FACE_FAIL", "LOGIN_FACE", "LOGIN_ACCESS_CODE", "ACCESS_CODE_GENERATED", "ACCESS_CODE_CONSUMED"] }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { type: true, metadata: true, userAgent: true, createdAt: true },
  });

  console.log("total log rows (60d):", rows.length);

  const byType: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  const byUa: Record<string, number> = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const reason = typeof meta.reason === "string" ? meta.reason : undefined;
    if (r.type === "LOGIN_FACE_FAIL") {
      const key = reason ?? (meta.ok === false ? "code_not_found" : "no_reason");
      byReason[key] = (byReason[key] ?? 0) + 1;
    }
    if (reason) byReason[reason] = (byReason[reason] ?? 0) + 1;
    const ua = r.userAgent ?? "none";
    byUa[ua] = (byUa[ua] ?? 0) + 1;
  }

  console.log("\nby type:", byType);
  console.log("\nby reason:", byReason);
  console.log("\ntop user agents:");
  Object.entries(byUa).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([ua, n]) => console.log(`  ${n}x  ${ua.slice(0, 110)}`));

  const live = await prisma.accessCode.count({ where: { usedAt: null, expiresAt: { gt: new Date() } } });
  const total = await prisma.accessCode.count();
  console.log("\naccess codes: total", total, "live-unused", live);
}

main().finally(() => prisma.$disconnect());
