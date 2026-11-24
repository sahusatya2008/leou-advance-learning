"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Eye,
  Gauge,
  Globe,
  Monitor,
  MousePointerClick,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TrafficEventDTO, TrafficFeedDTO, TrafficVisitorDTO } from "@/lib/trafficTypes";

/**
 * The `GET /api/traffic` readout: coarse host-load counters served straight from
 * the proxy's own in-memory state (see src/lib/trafficManager.ts). Fetched
 * alongside the database feed because the shield's counters never leave the
 * Proxy bundle.
 */
type Shield = {
  ok: boolean;
  uptimeSeconds: number;
  rps: number;
  requests: { total: number; api: number; page: number };
  shed: number;
  scanners: number;
  global: { ratePerSec: number; burst: number };
};

const POLL_MS = 3000;

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function deviceLabel(d: { browser: string | null; os: string | null }): string {
  if (!d.browser && !d.os) return "Unknown device";
  return [d.browser, d.os].filter(Boolean).join(" · ");
}

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TrafficDashboard() {
  const [feed, setFeed] = useState<TrafficFeedDTO | null>(null);
  const [shield, setShield] = useState<Shield | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [updated, setUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const [feedRes, shieldRes] = await Promise.all([
        fetch("/api/admin/traffic", { cache: "no-store" }),
        fetch("/api/traffic", { cache: "no-store" }).catch(() => null),
      ]);
      if (!feedRes.ok) throw new Error(String(feedRes.status));
      setFeed((await feedRes.json()) as TrafficFeedDTO);
      if (shieldRes?.ok) setShield((await shieldRes.json()) as Shield);
      setError(null);
      setUpdated(Date.now());
      setNow(Date.now());
    } catch {
      setError("Could not load traffic data.");
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [live, load]);

  // Re-render once a second so the "Ns ago" labels stay honest between polls.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const stats = feed?.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            {live && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full",
                live ? "bg-emerald-500" : "bg-muted-foreground",
              )}
            />
          </span>
          <span className="text-sm text-muted-foreground">
            {live ? "Live" : "Paused"}
            {updated ? ` · updated ${ago(new Date(updated).toISOString(), now)}` : ""}
          </span>
          {error && <Badge variant="destructive">{error}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLive((v) => !v)}>
            {live ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {live ? "Pause" : "Resume"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Zap} label="Requests / sec" value={stats ? stats.rps.toFixed(2) : "—"} accent />
        <Stat icon={Eye} label="Active visitors" value={stats ? String(stats.activeVisitors) : "—"} hint="last 2 min" />
        <Stat icon={MousePointerClick} label="Requests today" value={stats ? String(stats.requestsToday) : "—"} />
        <Stat icon={Users} label="Visitors" value={stats ? String(stats.totalVisitors) : "—"} hint={stats ? `${stats.visitorsToday} today` : undefined} />
        <Stat icon={UserCheck} label="Page views today" value={stats ? String(stats.pageToday) : "—"} />
        <Stat icon={Activity} label="API calls today" value={stats ? String(stats.apiToday) : "—"} />
        <Stat icon={ShieldCheck} label="Scanners blocked" value={shield ? String(shield.scanners) : "—"} />
        <Stat icon={Gauge} label="Shed / uptime" value={shield ? `${shield.shed} · ${uptime(shield.uptimeSeconds)}` : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Live activity
            </CardTitle>
            <Badge variant="secondary">{feed?.events.length ?? 0} recent</Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-16">Kind</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead className="hidden md:table-cell">Device</TableHead>
                    <TableHead className="hidden lg:table-cell">User</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(feed?.events ?? []).map((e) => (
                    <EventRow key={e.id} e={e} now={now} />
                  ))}
                  {feed && feed.events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        No requests recorded yet. Traffic will appear here as it arrives.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" /> Top paths (24h)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <BarList
                items={(feed?.topPaths ?? []).map((p) => ({ label: p.path, count: p.count }))}
                empty="No requests in the last 24h."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-primary" /> Top browsers (24h)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {(feed?.topBrowsers ?? []).map((b) => (
                  <Badge key={b.label} variant="outline" className="px-2.5 py-1">
                    {b.label} <span className="ml-1 text-muted-foreground">{b.count}</span>
                  </Badge>
                ))}
                {feed && feed.topBrowsers.length === 0 && (
                  <span className="text-sm text-muted-foreground">No data yet.</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> Visitors
          </CardTitle>
          <Badge variant="secondary">{feed?.visitors.length ?? 0} recent</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[30rem] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead className="hidden sm:table-cell">IP</TableHead>
                  <TableHead className="hidden md:table-cell">Locale</TableHead>
                  <TableHead className="hidden lg:table-cell">User</TableHead>
                  <TableHead className="text-right">Hits</TableHead>
                  <TableHead className="text-right">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(feed?.visitors ?? []).map((v) => (
                  <VisitorRow key={v.id} v={v} now={now} />
                ))}
                {feed && feed.visitors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No visitors recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            accent ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold tabular-nums">{value}</div>
          <div className="truncate text-xs text-muted-foreground">
            {label}
            {hint ? ` · ${hint}` : ""}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventRow({ e, now }: { e: TrafficEventDTO; now: number }) {
  return (
    <TableRow>
      <TableCell>
        <Badge variant={e.kind === "PAGE" ? "info" : "secondary"}>{e.kind}</Badge>
      </TableCell>
      <TableCell className="max-w-[18rem]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
            {e.method}
          </span>
          <span className="truncate font-medium" title={e.path}>
            {e.path}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {e.isMobile ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
          <span className="truncate">{deviceLabel(e)}</span>
        </span>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {e.username ? <UserBadge name={e.username} role={e.role} /> : <span className="text-muted-foreground">Guest</span>}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right text-muted-foreground" title={clock(e.createdAt)}>
        {ago(e.createdAt, now)}
      </TableCell>
    </TableRow>
  );
}

function VisitorRow({ v, now }: { v: TrafficVisitorDTO; now: number }) {
  const locale = [v.timezone, v.language, v.screen].filter(Boolean).join(" · ");
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {v.isMobile ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : <Monitor className="h-4 w-4 text-muted-foreground" />}
          <div className="min-w-0">
            <div className="truncate font-medium">{deviceLabel(v)}</div>
            <div className="truncate text-xs text-muted-foreground">{v.platform ?? v.device ?? "—"}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
        {v.ip ?? "—"}
      </TableCell>
      <TableCell className="hidden max-w-[16rem] truncate text-xs text-muted-foreground md:table-cell" title={locale}>
        {locale || "—"}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {v.username ? <UserBadge name={v.username} role={v.role} /> : <span className="text-muted-foreground">Guest</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span title={`${v.pageHits} page · ${v.apiHits} api`}>{v.hits}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right text-muted-foreground" title={clock(v.lastSeen)}>
        {ago(v.lastSeen, now)}
      </TableCell>
    </TableRow>
  );
}

function UserBadge({ name, role }: { name: string; role: string | null }) {
  const variant = role === "ADMIN" ? "default" : role === "PARENT" ? "accent" : "success";
  return (
    <span className="flex items-center gap-2">
      <Badge variant={variant}>{name}</Badge>
      {role && <span className="text-xs text-muted-foreground">{role.toLowerCase()}</span>}
    </span>
  );
}

function BarList({ items, empty }: { items: { label: string; count: number }[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{i.count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
