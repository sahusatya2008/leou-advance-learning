import { NextResponse } from "next/server";
import { getRequestMeta } from "@/lib/requestMeta";
import { recordClientDevice, type ClientDevice } from "@/lib/trafficStore";

export const dynamic = "force-dynamic";

/**
 * The browser's half of the traffic picture.
 *
 * The proxy can read a user agent, but only the client knows its language,
 * time zone, screen size and platform. A tiny beacon sends those once per
 * session; we attach them to the visitor row keyed by the same deviceId the
 * proxy derives from ip + user-agent.
 *
 * Unauthenticated by design (most visitors are), and cheap: one small upsert.
 * The Proxy's per-IP/per-device write budget still applies.
 */
export async function POST(request: Request) {
  let body: ClientDevice = {};
  try {
    const parsed = (await request.json()) as Record<string, unknown>;
    const pick = (k: string, max: number) => {
      const v = parsed?.[k];
      return typeof v === "string" ? v.slice(0, max) : undefined;
    };
    body = {
      language: pick("language", 64),
      timezone: pick("timezone", 64),
      screen: pick("screen", 32),
      platform: pick("platform", 64),
    };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  try {
    const meta = getRequestMeta(request);
    await recordClientDevice(meta.deviceId, meta.device, body);
  } catch (err) {
    console.error("traffic identify failed", err);
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
