import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { ParsedDevice } from "@/lib/device";

/**
 * The traffic manager's write path.
 *
 * This module is imported *dynamically* from `src/proxy.ts`, inside the
 * `event.waitUntil(...)` background task. Two consequences, both intentional:
 *
 *   1. Its dependencies (the Prisma client, `pg`, `jose`) are code-split out of
 *      the Proxy's main chunk, so the request-shield path stays lean and a
 *      failure to load this module can never take the shield down.
 *   2. Every call is "after the response", so a slow database never shows up as
 *      request latency.
 *
 * Nothing here decides whether a request is allowed; that is the proxy's job.
 * This only records what already happened.
 */

const EVENTS_RETENTION_DAYS = 14;
const VISITORS_RETENTION_DAYS = 30;
const MAX_PATH = 512;
const MAX_REFERER = 512;
const MAX_UA = 512;

const DEV_FALLBACK = "dev-secret-change-me";

/**
 * Mirror of `auth.ts`'s signing key. Deliberately re-derived here rather than
 * imported: `auth.ts` pulls in `next/headers` and the full session graph, which
 * must not enter the Proxy bundle. The JWT is only decoded for a display name,
 * so a verification failure is not a security event - it simply records the
 * request as anonymous.
 */
function jwtSecret(): Uint8Array | null {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw === DEV_FALLBACK) {
    if (process.env.NODE_ENV === "production") return null;
    return new TextEncoder().encode(DEV_FALLBACK);
  }
  return new TextEncoder().encode(raw);
}

async function resolveUser(sessionToken: string | null): Promise<{ userId?: string; role?: string }> {
  if (!sessionToken) return {};
  const secret = jwtSecret();
  if (!secret) return {};
  try {
    const { payload } = await jwtVerify(sessionToken, secret);
    const userId = typeof payload.uid === "string" ? payload.uid : undefined;
    const role = typeof payload.role === "string" ? payload.role : undefined;
    return { userId, role };
  } catch {
    return {};
  }
}

export type TrafficRecord = {
  kind: "page" | "api";
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  deviceId: string;
  device: ParsedDevice;
  referer: string | null;
  sessionToken: string | null;
};

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

/** Persist one request plus fold it into its visitor row. Never throws. */
export async function recordTraffic(record: TrafficRecord): Promise<void> {
  try {
    const now = new Date();
    const { userId, role } = await resolveUser(record.sessionToken);
    const kind = record.kind === "api" ? "API" : "PAGE";
    const path = clip(record.path, MAX_PATH) ?? "/";
    const ua = clip(record.userAgent, MAX_UA);

    await prisma.trafficEvent.create({
      data: {
        kind,
        method: clip(record.method, 16) ?? "GET",
        path,
        ip: clip(record.ip, 64),
        userAgent: ua,
        deviceId: record.deviceId,
        browser: record.device.browser,
        os: record.device.os,
        device: record.device.device,
        isMobile: record.device.isMobile,
        referer: clip(record.referer, MAX_REFERER),
        userId: userId ?? null,
        role: role ?? null,
        createdAt: now,
      },
    });

    await prisma.trafficVisitor.upsert({
      where: { deviceId: record.deviceId },
      create: {
        deviceId: record.deviceId,
        ip: clip(record.ip, 64),
        userAgent: ua,
        browser: record.device.browser,
        os: record.device.os,
        device: record.device.device,
        isMobile: record.device.isMobile,
        userId: userId ?? null,
        role: role ?? null,
        hits: 1,
        pageHits: kind === "PAGE" ? 1 : 0,
        apiHits: kind === "API" ? 1 : 0,
        firstSeen: now,
        lastSeen: now,
      },
      update: {
        ip: clip(record.ip, 64),
        userAgent: ua,
        browser: record.device.browser,
        os: record.device.os,
        device: record.device.device,
        isMobile: record.device.isMobile,
        // Only overwrite identity when we actually resolved one, so a logged-out
        // request from a known device cannot blank out its user.
        ...(userId ? { userId, role: role ?? null } : {}),
        hits: { increment: 1 },
        pageHits: { increment: kind === "PAGE" ? 1 : 0 },
        apiHits: { increment: kind === "API" ? 1 : 0 },
        lastSeen: now,
      },
    });
  } catch (err) {
    console.error("recordTraffic failed", err);
  }
}

export type ClientDevice = {
  language?: string;
  timezone?: string;
  screen?: string;
  platform?: string;
};

/**
 * Fold the browser-only device facts into an existing visitor row. The beacon
 * fires once per session; if the visitor has not been seen yet (no request has
 * been logged), the upsert creates the row so the facts are still captured.
 */
export async function recordClientDevice(
  deviceId: string,
  device: ParsedDevice,
  extra: ClientDevice,
): Promise<void> {
  const clean = (v: string | undefined, max: number) => (v ? v.slice(0, max) : undefined);
  const now = new Date();
  await prisma.trafficVisitor.upsert({
    where: { deviceId },
    create: {
      deviceId,
      browser: device.browser,
      os: device.os,
      device: device.device,
      isMobile: device.isMobile,
      language: clean(extra.language, 64) ?? null,
      timezone: clean(extra.timezone, 64) ?? null,
      screen: clean(extra.screen, 32) ?? null,
      platform: clean(extra.platform, 64) ?? null,
      firstSeen: now,
      lastSeen: now,
    },
    update: {
      language: clean(extra.language, 64),
      timezone: clean(extra.timezone, 64),
      screen: clean(extra.screen, 32),
      platform: clean(extra.platform, 64),
    },
  });
}

/**
 * Drop old rows so the tables stay bounded. Called opportunistically by the
 * admin read path (at most hourly), not on the write path.
 */
export async function pruneTraffic(): Promise<{ events: number; visitors: number }> {
  const eventsBefore = new Date(Date.now() - EVENTS_RETENTION_DAYS * 86_400_000);
  const visitorsBefore = new Date(Date.now() - VISITORS_RETENTION_DAYS * 86_400_000);
  const [events, visitors] = await Promise.all([
    prisma.trafficEvent.deleteMany({ where: { createdAt: { lt: eventsBefore } } }),
    prisma.trafficVisitor.deleteMany({ where: { lastSeen: { lt: visitorsBefore } } }),
  ]);
  return { events: events.count, visitors: visitors.count };
}
