import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { pruneTraffic } from "@/lib/trafficStore";
import type {
  TrafficEventDTO,
  TrafficEventKind,
  TrafficFeedDTO,
  TrafficVisitorDTO,
} from "@/lib/trafficTypes";

export const dynamic = "force-dynamic";

const FEED_LIMIT = 120;
const VISITOR_LIMIT = 100;
const TOP_LIMIT = 8;

/** Opportunistic retention sweep, at most once an hour per process. */
let lastPrune = 0;
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 3_600_000) return;
  lastPrune = now;
  pruneTraffic().catch(() => {});
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const guard = await requireApiRole("ADMIN");
  if ("error" in guard) return guard.error;

  maybePrune();

  const now = Date.now();
  const fiveSecAgo = new Date(now - 5_000);
  const oneMinAgo = new Date(now - 60_000);
  const twoMinAgo = new Date(now - 120_000);
  const dayAgo = new Date(now - 86_400_000);
  const today = startOfToday();

  const [
    lastFiveSeconds,
    lastMinute,
    requestsToday,
    pageToday,
    apiToday,
    totalEvents,
    activeVisitors,
    totalVisitors,
    visitorsToday,
    topPathRows,
    topBrowserRows,
    eventRows,
    visitorRows,
  ] = await Promise.all([
    prisma.trafficEvent.count({ where: { createdAt: { gte: fiveSecAgo } } }),
    prisma.trafficEvent.count({ where: { createdAt: { gte: oneMinAgo } } }),
    prisma.trafficEvent.count({ where: { createdAt: { gte: today } } }),
    prisma.trafficEvent.count({ where: { createdAt: { gte: today }, kind: "PAGE" } }),
    prisma.trafficEvent.count({ where: { createdAt: { gte: today }, kind: "API" } }),
    prisma.trafficEvent.count(),
    prisma.trafficVisitor.count({ where: { lastSeen: { gte: twoMinAgo } } }),
    prisma.trafficVisitor.count(),
    prisma.trafficVisitor.count({ where: { lastSeen: { gte: today } } }),
    prisma.trafficEvent.groupBy({
      by: ["path"],
      where: { createdAt: { gte: dayAgo } },
      _count: { path: true },
    }),
    prisma.trafficEvent.groupBy({
      by: ["browser"],
      where: { createdAt: { gte: dayAgo } },
      _count: { browser: true },
    }),
    prisma.trafficEvent.findMany({ orderBy: { createdAt: "desc" }, take: FEED_LIMIT }),
    prisma.trafficVisitor.findMany({ orderBy: { lastSeen: "desc" }, take: VISITOR_LIMIT }),
  ]);

  // Resolve the display names for everyone referenced in this payload, in one
  // query rather than one per row.
  const userIds = new Set<string>();
  for (const e of eventRows) if (e.userId) userIds.add(e.userId);
  for (const v of visitorRows) if (v.userId) userIds.add(v.userId);
  const users = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, username: true, role: true },
      })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.username]));

  const events: TrafficEventDTO[] = eventRows.map((e) => ({
    id: e.id,
    kind: e.kind as TrafficEventKind,
    method: e.method,
    path: e.path,
    ip: e.ip,
    browser: e.browser,
    os: e.os,
    device: e.device,
    isMobile: e.isMobile,
    referer: e.referer,
    userId: e.userId,
    role: e.role,
    username: e.userId ? nameById.get(e.userId) ?? null : null,
    createdAt: e.createdAt.toISOString(),
  }));

  const visitors: TrafficVisitorDTO[] = visitorRows.map((v) => ({
    id: v.id,
    deviceId: v.deviceId,
    ip: v.ip,
    userAgent: v.userAgent,
    browser: v.browser,
    os: v.os,
    device: v.device,
    isMobile: v.isMobile,
    userId: v.userId,
    role: v.role,
    username: v.userId ? nameById.get(v.userId) ?? null : null,
    language: v.language,
    timezone: v.timezone,
    screen: v.screen,
    platform: v.platform,
    hits: v.hits,
    pageHits: v.pageHits,
    apiHits: v.apiHits,
    firstSeen: v.firstSeen.toISOString(),
    lastSeen: v.lastSeen.toISOString(),
  }));

  const topPaths = [...topPathRows]
    .map((r) => ({ path: r.path, count: r._count.path }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LIMIT);

  const topBrowsers = [...topBrowserRows]
    .map((r) => ({ label: r.browser ?? "Unknown", count: r._count.browser }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LIMIT);

  const payload: TrafficFeedDTO = {
    ok: true,
    generatedAt: new Date().toISOString(),
    stats: {
      rps: Number((lastFiveSeconds / 5).toFixed(2)),
      requestsLastMinute: lastMinute,
      requestsToday,
      pageToday,
      apiToday,
      totalEvents,
      activeVisitors,
      totalVisitors,
      visitorsToday,
    },
    topPaths,
    topBrowsers,
    events,
    visitors,
  };

  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
