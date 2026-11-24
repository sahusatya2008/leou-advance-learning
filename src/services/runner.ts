import "server-only";
import { lookup } from "node:dns/promises";

// `RUNNER_URL=""` is how an unset variable looks in a .env file and in
// docker-compose, and `??` does not catch it — only null and undefined. The
// result was an empty base URL, so every request went nowhere and the app
// reported "Runner service unreachable" even with the runner running.
const RUNNER_URL = (process.env.RUNNER_URL ?? "").trim() || "http://localhost:4100";

// `host.docker.internal` resolves to BOTH an IPv6 address and Docker Desktop's
// internal IPv4 gateway (192.168.65.254). The container has no IPv6 route, so
// anything that picks the AAAA record first fails with ENETUNREACH. The
// gateway is stable across reboots and is not routable from the LAN, which is
// exactly what we want: pin the runner host to IPv4 so we neither depend on a
// DHCP-assigned LAN address nor expose the runner to the local network.
const IPV4_ONLY = new Set(["host.docker.internal"]);
let resolvedBase: Promise<string> | null = null;

async function runnerBase(): Promise<string> {
  if (!resolvedBase) {
    resolvedBase = (async () => {
      let url: URL;
      try {
        url = new URL(RUNNER_URL);
      } catch {
        return RUNNER_URL;
      }
      if (url.hostname && IPV4_ONLY.has(url.hostname)) {
        try {
          const { address } = await lookup(url.hostname, { family: 4 });
          url.hostname = address;
        } catch {
          // Leave the name as-is and let the request fail with its own error.
        }
      }
      return url.toString().replace(/\/$/, "");
    })();
  }
  return await resolvedBase;
}

// The runner listens on the host's LAN address (the only address the app
// container can reach on Docker Desktop for Mac), so it is reachable by
// anything on the same network. It refuses every code-executing route unless
// this shared secret matches. Keep it in .env only — never inline it here.
const RUNNER_TOKEN = (process.env.RUNNER_TOKEN ?? "").trim();

function authHeaders(): Record<string, string> {
  return RUNNER_TOKEN ? { "X-Runner-Token": RUNNER_TOKEN } : {};
}

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  started: string;
  timeMs: number;
};

export type SqlResult = {
  dialect: string;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
};

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${await runnerBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = e as Error;
    throw Object.assign(
      new Error(err.name === "TimeoutError" || err.name === "AbortError" ? "Runner timed out." : "Runner service unreachable."),
      { status: 504 }
    );
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Runner error (${res.status}).`), { status: res.status });
  return data;
}

export async function runnerRun(language: string, code: string, stdin: string): Promise<RunResult> {
  return await post<RunResult>("/run", { language, code, stdin }, 20_000);
}

export type SessionState = {
  status: "running" | "exited";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  timeMs: number | null;
};

/**
 * `interactive` asks the runner to keep the process alive after the code has run,
 * dropping into an interactive prompt that shares the interpreter state. Only the
 * practical workspace wants that; assessment sessions deliberately exit.
 */
export async function runnerStartSession(
  language: string,
  code: string,
  opts: { interactive?: boolean } = {}
): Promise<{ id: string; language: string; cmd: string[] }> {
  return await post<{ id: string; language: string; cmd: string[] }>(
    "/run/session",
    { language, code, interactive: opts.interactive === true },
    10_000
  );
}

export async function runnerSessionState(id: string): Promise<SessionState> {
  let res: Response;
  try {
    res = await fetch(`${await runnerBase()}/run/session/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: authHeaders(),
      signal: AbortSignal.timeout(6_000),
    });
  } catch (e) {
    const err = e as Error;
    throw Object.assign(
      new Error(err.name === "TimeoutError" || err.name === "AbortError" ? "Runner timed out." : "Runner service unreachable."),
      { status: 504 }
    );
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & SessionState;
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Runner error (${res.status}).`), { status: res.status });
  return data;
}

export async function runnerSendInput(id: string, input: string): Promise<{ ok: true }> {
  return await post<{ ok: true }>(`/run/session/${encodeURIComponent(id)}/input`, { input }, 6_000);
}

export async function runnerKillSession(id: string): Promise<{ ok: true }> {
  return await post<{ ok: true }>(`/run/session/${encodeURIComponent(id)}/kill`, {}, 6_000);
}

export async function runnerSql(
  dialect: string,
  schemaSql: string,
  seedSql: string,
  query: string
): Promise<SqlResult> {
  return await post<SqlResult>("/sql", { dialect, schemaSql, seedSql, query }, 45_000);
}