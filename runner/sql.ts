import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import mysql from "mysql2/promise";

export const DIALECTS = ["PostgreSQL", "MySQL", "SQLite"] as const;
export type Dialect = (typeof DIALECTS)[number];

export type SqlResult = {
  dialect: Dialect;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
};

function containerName(prefix: string) {
  return `leou-${prefix}-${randomUUID().slice(0, 12)}`;
}

function execDocker(args: string[]): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", (e) => reject(Object.assign(new Error(`Docker unavailable: ${e.message}`), { status: 500 })));
    proc.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

async function portFor(name: string, innerPort: number, deadlineMs: number): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    const r = await execDocker(["port", name, String(innerPort)]);
    if (r.code === 0 && r.out) {
      const hostPort = Number(r.out.split(":")[1]);
      if (hostPort) return hostPort;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Object.assign(new Error("Database container did not become ready in time."), { status: 504 });
}

async function waitReady<T>(fn: () => Promise<T>, deadlineMs: number): Promise<T> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < deadlineMs) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw Object.assign(new Error(`Database not ready: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`), { status: 500 });
}

async function runPostgres(schemaSql: string, seedSql: string, query: string): Promise<SqlResult> {
  const name = containerName("pg");
  const spawnR = await execDocker([
    "run", "-d", "--rm", "--name", name,
    "--cpus", "1",
    "--memory", "256m", "--pids-limit", "128",
    "-e", "POSTGRES_USER=leou", "-e", "POSTGRES_PASSWORD=leou_pass", "-e", "POSTGRES_DB=leou",
    "-p", "127.0.0.1::5432",
    "postgres:16-alpine",
  ]);
  if (spawnR.code !== 0) throw Object.assign(new Error(`Failed to start postgres container: ${spawnR.err}`), { status: 500 });

  try {
    const port = await portFor(name, 5432, 45_000);
    const cfg = { host: "127.0.0.1", port, user: "leou", password: "leou_pass", database: "leou" };
    await waitReady(async () => {
      const c = new pg.Client(cfg);
      await c.connect();
      await c.query("SELECT 1");
      await c.end();
    }, 30_000);
    const client = new pg.Client(cfg);
    await client.connect();
    try {
      if (schemaSql.trim()) await client.query(schemaSql);
      if (seedSql.trim()) await client.query(seedSql);
      const res = await client.query(query);
      return {
        dialect: "PostgreSQL",
        columns: res.fields.map((f) => f.name),
        rows: res.rows.map((r) => res.fields.map((f) => r[f.name])),
        rowCount: res.rowCount ?? res.rows.length,
      };
    } finally {
      await client.end().catch(() => null);
    }
  } finally {
    await execDocker(["rm", "-f", name]).catch(() => null);
  }
}

async function runMySql(schemaSql: string, seedSql: string, query: string): Promise<SqlResult> {
  const name = containerName("my");
  const spawnR = await execDocker([
    "run", "-d", "--rm", "--name", name,
    "--cpus", "1",
    "--memory", "256m", "--pids-limit", "128",
    "-e", "MYSQL_ROOT_PASSWORD=leou_pass", "-e", "MYSQL_DATABASE=leou",
    "-p", "127.0.0.1::3306",
    "mysql:8",
  ]);
  if (spawnR.code !== 0) throw Object.assign(new Error(`Failed to start mysql container: ${spawnR.err}`), { status: 500 });

  try {
    const port = await portFor(name, 3306, 40_000);
    const conn = await waitReady(async () => {
      const c = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", password: "leou_pass", database: "leou" });
      await c.query("SELECT 1");
      return c;
    }, 40_000);
    try {
      if (schemaSql.trim()) await conn.query(schemaSql);
      if (seedSql.trim()) await conn.query(seedSql);
      const [rows] = await conn.query(query);
      const arr = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
      const columns = arr.length > 0 ? Object.keys(arr[0]) : [];
      return {
        dialect: "MySQL",
        columns,
        rows: arr.map((r) => Object.values(r)),
        rowCount: arr.length,
      };
    } finally {
      await conn.end().catch(() => null);
    }
  } finally {
    await execDocker(["rm", "-f", name]).catch(() => null);
  }
}

async function runSqlite(schemaSql: string, seedSql: string, query: string): Promise<SqlResult> {
  const db = new DatabaseSync(":memory:");
  try {
    if (schemaSql.trim()) db.exec(schemaSql);
    if (seedSql.trim()) db.exec(seedSql);
    const stmt = db.prepare(query);
    const rows = stmt.all() as Record<string, unknown>[];
    const columns = stmt.columns().map((c) => c.name);
    return { dialect: "SQLite", columns, rows: rows.map((r) => columns.map((c) => r[c])), rowCount: rows.length };
  } finally {
    db.close();
  }
}

export async function runSql(dialect: Dialect, schemaSql: string, seedSql: string, query: string): Promise<SqlResult> {
  if (!DIALECTS.includes(dialect)) throw Object.assign(new Error(`Unsupported dialect: ${dialect}`), { status: 400 });
  if (!query?.trim()) throw Object.assign(new Error("No query provided."), { status: 400 });
  if (dialect === "PostgreSQL") return await runPostgres(schemaSql, seedSql, query);
  if (dialect === "MySQL") return await runMySql(schemaSql, seedSql, query);
  return await runSqlite(schemaSql, seedSql, query);
}