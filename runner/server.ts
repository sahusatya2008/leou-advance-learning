import express from "express";
import { timingSafeEqual } from "node:crypto";
import {
  runCode,
  requireImage,
  LANGS,
  startRunSession,
  sessionState,
  sendSessionInput,
  killRunSession,
  sweepSessions,
} from "./run.ts";
import { runSql, DIALECTS } from "./sql.ts";

const app = express();
app.use(express.json({ limit: "256kb" }));

const RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS ?? 10_000);
const MAX_INPUT = 2000;

// ---------------------------------------------------------------------------
// Shared-secret auth.
//
// The runner has to be reachable from the app container, and the only address
// the container can reach on Docker Desktop for Mac is the host's LAN IP
// (`host.docker.internal` resolves to an IPv6 address the container has no
// route to). Binding to the LAN IP means anything else on the same Wi-Fi could
// otherwise POST to /run and get free, sandboxed code execution on this
// machine. Without a token that is an open endpoint on a public network.
//
// The token is compared in constant time and the health endpoint stays open so
// launchd and the deploy preflight can still probe liveness.
// ---------------------------------------------------------------------------
const TOKEN = (process.env.RUNNER_TOKEN ?? "").trim();

function unauthorized(res: express.Response): void {
  res.status(401).json({ error: "Runner token missing or invalid." });
}

function authed(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!TOKEN) {
    // Refuse to serve code execution with no token configured: an open runner
    // on the LAN is worse than a non-functional one, and failing loudly beats
    // silently accepting code from anyone.
    res.status(503).json({ error: "Runner has no RUNNER_TOKEN set; refusing to execute." });
    return;
  }
  const header = req.header("x-runner-token") ?? "";
  const given = Buffer.from(header);
  const want = Buffer.from(TOKEN);
  const ok = given.length === want.length && given.length > 0 && timingSafeEqual(given, want);
  if (!ok) {
    unauthorized(res);
    return;
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), authRequired: Boolean(TOKEN) });
});

// Everything past this point can execute code.
app.use(authed);

app.post("/run", async (req, res) => {
  const { language, code, stdin } = req.body ?? {};
  try {
    if (!(LANGS as readonly string[]).includes(language ?? "")) {
      return res.status(400).json({ error: `language must be one of ${LANGS.join(", ")}` });
    }
    const result = await runCode(language, String(code ?? ""), String(stdin ?? ""), { timeoutMs: RUN_TIMEOUT_MS });
    res.json(result);
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.post("/sql", async (req, res) => {
  const { dialect, schemaSql, seedSql, query } = req.body ?? {};
  try {
    const d = (dialect ?? "PostgreSQL") as (typeof DIALECTS)[number];
    const result = await runSql(d, String(schemaSql ?? ""), String(seedSql ?? ""), String(query ?? ""));
    res.json(result);
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get("/images", async (_req, res) => {
  const out: Record<string, boolean> = {};
  for (const l of LANGS) out[l] = await requireImage(l);
  res.json(out);
});

app.post("/run/session", async (req, res) => {
  const { language, code, interactive } = req.body ?? {};
  try {
    if (!(LANGS as readonly string[]).includes(language ?? "")) {
      return res.status(400).json({ error: `language must be one of ${LANGS.join(", ")}` });
    }
    const session = await startRunSession(language as (typeof LANGS)[number], String(code ?? ""), {
      interactive: interactive === true,
    });
    res.json(session);
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get("/run/session/:id", (req, res) => {
  try {
    res.json(sessionState(req.params.id));
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 404).json({ error: err.message });
  }
});

app.post("/run/session/:id/input", (req, res) => {
  const input = String(req.body?.input ?? "").slice(0, MAX_INPUT);
  try {
    res.json(sendSessionInput(req.params.id, input));
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.post("/run/session/:id/kill", (req, res) => {
  try {
    res.json(killRunSession(req.params.id));
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 404).json({ error: err.message });
  }
});

setInterval(sweepSessions, 30_000).unref();

const PORT = Number(process.env.RUNNER_PORT ?? 4100);
app.listen(PORT, () => console.log(`[runner] listening on ${PORT}`));