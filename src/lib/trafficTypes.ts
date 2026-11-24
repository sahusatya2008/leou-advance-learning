/**
 * Wire shapes for the traffic manager. Pure types, no imports, so client
 * components can consume them without dragging server code into the browser
 * bundle.
 */

export type TrafficEventKind = "PAGE" | "API";

export type TrafficEventDTO = {
  id: string;
  kind: TrafficEventKind;
  method: string;
  path: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  isMobile: boolean;
  referer: string | null;
  username: string | null;
  userId: string | null;
  role: string | null;
  createdAt: string;
};

export type TrafficVisitorDTO = {
  id: string;
  deviceId: string;
  ip: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  isMobile: boolean;
  username: string | null;
  userId: string | null;
  role: string | null;
  language: string | null;
  timezone: string | null;
  screen: string | null;
  platform: string | null;
  hits: number;
  pageHits: number;
  apiHits: number;
  firstSeen: string;
  lastSeen: string;
};

export type TrafficStatsDTO = {
  /** Requests recorded in the last 5 seconds, per second. */
  rps: number;
  requestsLastMinute: number;
  requestsToday: number;
  pageToday: number;
  apiToday: number;
  totalEvents: number;
  /** Distinct devices seen in the last 2 minutes. */
  activeVisitors: number;
  totalVisitors: number;
  visitorsToday: number;
};

export type TrafficFeedDTO = {
  ok: true;
  generatedAt: string;
  stats: TrafficStatsDTO;
  topPaths: { path: string; count: number }[];
  topBrowsers: { label: string; count: number }[];
  events: TrafficEventDTO[];
  visitors: TrafficVisitorDTO[];
};
