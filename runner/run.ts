import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

export const LANGS = ["python", "node", "java", "c", "cpp", "rust"] as const;
export type Language = (typeof LANGS)[number];

export const IMAGES: Record<Language, string> = {
  python: "python:3.12-slim",
  node: "node:22-alpine",
  java: "eclipse-temurin:21-jdk-jammy",
  c: "gcc:13",
  cpp: "gcc:13",
  rust: "rust:1-slim",
};

type FileSpec = { name: string; content: string };
type CmdSpec = { args: string[] };

/**
 * `interactive` makes the session outlive the code: python is started with `-i`,
 * which runs the file and then drops to a `>>>` prompt in the *same* interpreter,
 * so the student's variables are still there. Used by practical sessions only;
 * assessments keep the plain run-then-exit behaviour their terminal expects.
 */
export function filePlan(
  language: Language,
  code: string,
  interactive = false
): { files: FileSpec[]; cmd: CmdSpec } {
  switch (language) {
    case "python":
      return {
        files: [{ name: "main.py", content: code }],
        cmd: { args: ["sh", "-c", interactive ? "python3 -i -u main.py" : "python3 -u main.py"] },
      };
    case "node":
      return { files: [{ name: "main.js", content: code }], cmd: { args: ["sh", "-c", "node main.js"] } };
    case "java":
      return {
        files: [{ name: "Main.java", content: code }],
        cmd: { args: ["sh", "-c", "javac -J-Xmx128m Main.java && java -Xmx192m Main"] },
      };
    case "c":
      return { files: [{ name: "main.c", content: code }], cmd: { args: ["sh", "-c", "gcc -O2 -static-libgcc -o main main.c && stdbuf -oL ./main"] } };
    case "cpp":
      return { files: [{ name: "main.cpp", content: code }], cmd: { args: ["sh", "-c", "g++ -O2 -static-libgcc -o main main.cpp && stdbuf -oL ./main"] } };
    case "rust":
      return { files: [{ name: "main.rs", content: code }], cmd: { args: ["sh", "-c", "rustc -O -o main main.rs && ./main"] } };
  }
}

const MAX_OUTPUT = 64 * 1024;

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  started: string;
  timeMs: number;
};

export async function runCode(language: Language, code: string, stdin: string, opts: { timeoutMs: number }): Promise<RunResult> {
  if (!LANGS.includes(language)) throw Object.assign(new Error(`Unsupported language: ${language}`), { status: 400 });
  if (!code?.trim()) throw Object.assign(new Error("No code provided."), { status: 400 });

  const dir = await mkdtemp(path.join(tmpdir(), "leou-run-"));
  try {
    const plan = filePlan(language, code);
    await Promise.all(plan.files.map((f) => writeFile(path.join(dir, f.name), f.content)));

    const args = [
      "run",
      "--rm",
      "-i",
      "--network",
      "none",
      "--cpus",
      "1",
      "--memory",
      "256m",
      "--pids-limit",
      "256",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "-v",
      `${dir}:/workspace`,
      "-w",
      "/workspace",
      IMAGES[language],
      ...plan.cmd.args,
    ];

    return await runContainer(args, stdin, opts.timeoutMs);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

async function runContainer(args: string[], stdin: string, timeoutMs: number): Promise<RunResult> {
  return await new Promise<RunResult>((resolve, reject) => {
    const proc = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    const started = Date.now();
    let stdoutBuf = "";
    let stderrBuf = "";
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
      // docker may leave a container; best-effort prune just this one
      setTimeout(() => {
        // not shelling here; rejection handled by on('error'/close)
      }, 0);
    }, timeoutMs);

    proc.stdout.on("data", (d) => {
      stdoutBuf += d.toString();
      if (stdoutBuf.length > MAX_OUTPUT) stdoutBuf = stdoutBuf.slice(0, MAX_OUTPUT);
    });
    proc.stderr.on("data", (d) => {
      stderrBuf += d.toString();
      if (stderrBuf.length > MAX_OUTPUT) stderrBuf = stderrBuf.slice(0, MAX_OUTPUT);
    });

    proc.on("error", (e) => {
      clearTimeout(killTimer);
      reject(Object.assign(new Error(`Docker unavailable: ${e.message}`), { status: 500 }));
    });

    proc.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        stdout: stdoutBuf,
        stderr: stderrBuf,
        exitCode: code ?? 0,
        timedOut,
        started: new Date().toISOString(),
        timeMs: Date.now() - started,
      });
    });

    proc.stdin.write(stdin ?? "");
    proc.stdin.end();
  });
}

export async function requireImage(language: Language): Promise<boolean> {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("docker", ["image", "inspect", IMAGES[language]], { stdio: "ignore" });
  return r.status === 0;
}

// ---------------------------------------------------------------------------
// Interactive sessions: a docker run whose stdin stays open so the student can
// feed input line-by-line while the program runs (like a real terminal).
// ---------------------------------------------------------------------------

type RunSessionEntry = {
  language: Language;
  proc: ChildProcess;
  stdout: string;
  stderr: string;
  status: "running" | "exited";
  exitCode: number | null;
  timedOut: boolean;
  startedAtMs: number;
  lastActivityMs: number;
  dir: string;
  container: string;
};

export type SessionState = {
  status: "running" | "exited";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  timeMs: number | null;
};

const SESSION_HARD_MS = 5 * 60_000; // hard cap per session, resets on input
const DEAD_RETENTION_MS = 90_000; // how long to keep a finished session readable
const MAX_SESSIONS = 60;

const sessions = new Map<string, RunSessionEntry>();
let sessionSeq = 0;

function capOutput(buf: string, chunk: string) {
  return (buf + chunk).slice(-MAX_OUTPUT * 2);
}

function buildContainerArgs(dir: string, language: Language, plan: CmdSpec, name: string): string[] {
  return [
    "run",
    "--rm",
    "-i",
    "--name",
    name,
    "--network",
    "none",
    "--cpus",
    "1",
    "--memory",
    "256m",
    "--pids-limit",
    "256",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "-v",
    `${dir}:/workspace`,
    "-w",
    "/workspace",
    IMAGES[language],
    ...plan.args,
  ];
}

export type StartSessionResult = { id: string; language: Language; cmd: string[] };

export async function startRunSession(
  language: Language,
  code: string,
  opts: { interactive?: boolean } = {}
): Promise<StartSessionResult> {
  if (!LANGS.includes(language)) throw Object.assign(new Error(`Unsupported language: ${language}`), { status: 400 });
  if (!code?.trim()) throw Object.assign(new Error("No code provided."), { status: 400 });
  if (sessions.size >= MAX_SESSIONS)
    throw Object.assign(new Error("Too many active sessions. Stop old runs and try again."), { status: 429 });

  const dir = await mkdtemp(path.join(tmpdir(), "leou-sess-"));
  const plan = filePlan(language, code, opts.interactive === true);
  await Promise.all(plan.files.map((f) => writeFile(path.join(dir, f.name), f.content)));

  const id = `s${process.pid}-${Date.now()}-${++sessionSeq}`;
  const containerName = `leou-sess-${id}`;
  const proc = spawn("docker", buildContainerArgs(dir, language, plan.cmd, containerName), { stdio: ["pipe", "pipe", "pipe"] });

  const entry: RunSessionEntry = {
    language,
    proc,
    stdout: "",
    stderr: "",
    status: "running",
    exitCode: null,
    timedOut: false,
    startedAtMs: Date.now(),
    lastActivityMs: Date.now(),
    dir,
    container: containerName,
  };
  sessions.set(id, entry);

  proc.stdout.on("data", (d) => {
    entry.stdout = capOutput(entry.stdout, d.toString());
    entry.lastActivityMs = Date.now();
  });
  proc.stderr.on("data", (d) => {
    entry.stderr = capOutput(entry.stderr, d.toString());
    entry.lastActivityMs = Date.now();
  });
  proc.on("error", () => {
    entry.status = "exited";
    entry.exitCode = null;
    entry.lastActivityMs = Date.now();
  });
  proc.on("close", (code) => {
    entry.status = "exited";
    entry.exitCode = code ?? 0;
    entry.lastActivityMs = Date.now();
    void rm(dir, { recursive: true, force: true }).catch(() => null);
  });

  return { id, language, cmd: plan.cmd.args };
}

export function sessionState(id: string): SessionState {
  const s = sessions.get(id);
  if (!s) throw Object.assign(new Error("Session not found."), { status: 404 });
  return {
    status: s.status,
    exitCode: s.exitCode,
    stdout: s.stdout,
    stderr: s.stderr,
    timedOut: s.timedOut,
    timeMs: s.status === "exited" ? Date.now() - s.startedAtMs : null,
  };
}

export function sendSessionInput(id: string, input: string): { ok: true } {
  const s = sessions.get(id);
  if (!s) throw Object.assign(new Error("Session not found."), { status: 404 });
  if (s.status !== "running" || !s.proc.stdin || s.proc.stdin.destroyed)
    throw Object.assign(new Error("Program already exited."), { status: 409 });
  s.proc.stdin.write(`${input}\n`);
  s.lastActivityMs = Date.now();
  return { ok: true };
}

function dockerKill(name: string) {
  try {
    spawn("docker", ["kill", name]).unref();
  } catch {
    /* already gone */
  }
}

export function killRunSession(id: string): { ok: true } {
  const s = sessions.get(id);
  if (!s) throw Object.assign(new Error("Session not found."), { status: 404 });
  try {
    s.proc.kill("SIGKILL");
  } catch {
    /* already gone */
  }
  dockerKill(s.container);
  s.lastActivityMs = Date.now();
  return { ok: true };
}

export function sweepSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.status === "exited" && now - s.lastActivityMs > DEAD_RETENTION_MS) {
      sessions.delete(id);
      void rm(s.dir, { recursive: true, force: true }).catch(() => null);
    // Idle timeout, measured from the last output or keystroke rather than from
    // the start: an interactive REPL sits idle waiting for the student, and
    // killing it 5 minutes after launch would cut a legitimate session short.
    } else if (s.status === "running" && now - s.lastActivityMs > SESSION_HARD_MS) {
      s.timedOut = true;
      dockerKill(s.container);
      try {
        s.proc.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
  if (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.values()]
      .filter((s) => s.status === "running")
      .sort((a, b) => a.startedAtMs - b.startedAtMs)
      .slice(0, sessions.size - MAX_SESSIONS);
    for (const s of oldest) {
      dockerKill(s.container);
      try {
        s.proc.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}