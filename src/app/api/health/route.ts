import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for the host. Deliberately says nothing sensitive:
 * it reports whether the app, the database and the face service are reachable,
 * and nothing about rows, users or versions.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; ms: number; detail?: string }> = {};

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, ms: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      ok: false,
      ms: Date.now() - dbStart,
      detail: error instanceof Error ? error.message.slice(0, 120) : "unavailable",
    };
  }

  const faceStart = Date.now();
  try {
    const base = process.env.FACE_SVC_URL ?? "http://127.0.0.1:8000";
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4_000), cache: "no-store" });
    checks.faceService = { ok: res.ok, ms: Date.now() - faceStart };
  } catch {
    checks.faceService = { ok: false, ms: Date.now() - faceStart, detail: "unreachable" };
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok, uptimeSeconds: Math.round(process.uptime()), checks },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
