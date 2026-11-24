/**
 * Minimal Chrome DevTools Protocol driver.
 *
 * The pay-now work could not be verified over HTTP: the quotation and the QR
 * payment screen are both client-rendered behind a loading shell, so `curl`
 * returns a page with no buttons in it and every check passes while the student
 * sees nothing. This drives the real browser so the DOM that a student actually
 * gets inspected is the thing being asserted.
 *
 * Deliberately dependency-free - it speaks CDP over the WebSocket that ships
 * with Node, and uses the Chrome already in the puppeteer cache.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CHROME_CANDIDATES = [
  join(homedir(), ".cache/puppeteer/chrome"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

function findChrome(): string {
  for (const base of CHROME_CANDIDATES) {
    if (!existsSync(base)) continue;
    if (base.endsWith(".app/Contents/MacOS/Google Chrome") || base.endsWith("Chromium")) {
      return base;
    }
    for (const dir of readdirSync(base)) {
      const bundle = join(base, dir);
      try {
        if (!statSync(bundle).isDirectory()) continue;
      } catch {
        continue;
      }
      for (const inner of readdirSync(bundle)) {
        for (const leaf of [
          join(bundle, inner, "Contents/MacOS/Google Chrome for Testing"),
          join(bundle, inner, "chrome"),
          // Chrome for Testing in Puppeteer: sometimes nested one level deeper (e.g.
          // .../chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/...)
          join(
            bundle,
            inner,
            "Google Chrome for Testing.app",
            "Contents/MacOS/Google Chrome for Testing",
          ),
        ]) {
          if (existsSync(leaf)) return leaf;
        }
      }
    }
  }
  throw new Error("no Chrome binary found");
}

export type Browser = {
  goto: (url: string) => Promise<void>;
  eval: <T>(fn: string) => Promise<T>;
  setCookie: (name: string, value: string) => Promise<void>;
  text: () => Promise<string>;
  click: (selector: string) => Promise<boolean>;
  /**
   * Type real keystrokes into whatever has focus. Built on Input events rather
   * than execCommand so components that watch keydown/selection (a code editor,
   * for one) behave exactly as they do for a human.
   */
  typeText: (text: string) => Promise<void>;
  /** Insert text the way an IME or a paste does: beforeinput + input. */
  insertText: (text: string) => Promise<void>;
  /**
   * Press the left mouse button at viewport coordinates. A JS `el.click()` is
   * not the same thing: some components (a code editor, for one) arm themselves
   * on pointerdown and never notice a synthetic click.
   */
  mouseClick: (x: number, y: number) => Promise<void>;
  /**
   * Override the layout viewport independently of the OS window.
   *
   * `--window-size` alone cannot test a phone: macOS Chrome refuses to make a
   * window narrower than ~500px, so `window.innerWidth` comes back at 500 and a
   * 390px assertion is silently measuring a desktop. Device metrics override is
   * the only way to get a true mobile layout viewport.
   */
  setViewport: (opts: { width: number; height: number; mobile?: boolean }) => Promise<void>;
  /** Full-page PNG as a base64 string, for visual review. */
  screenshot: (opts?: { fullPage?: boolean }) => Promise<string>;
  /**
   * Emulate media features, e.g. `prefers-reduced-motion: reduce`, without
   * touching the OS accessibility settings of whoever is running the test.
   */
  setMediaFeatures: (features: { name: string; value: string }[]) => Promise<void>;
  /** Console traffic seen since the browser launched, errors and warnings first. */
  consoleMessages: () => { type: string; text: string; stack?: string }[];
  /** Requests the page made that never came back: 404s, blocks, aborts. */
  failedRequests: () => { url: string; error: string }[];
  close: () => Promise<void>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fmtFrames(st?: { callFrames?: { functionName?: string; url?: string; lineNumber?: number }[] }): string | undefined {
  const frames = st?.callFrames;
  if (!frames?.length) return undefined;
  return frames
    .slice(0, 5)
    .map((f) => `${f.functionName || "<anonymous>"} (${f.url}:${(f.lineNumber ?? 0) + 1})`)
    .join("\n");
}

/**
 * Ask the OS for a free port, then give it straight back.
 *
 * A fixed debugging port is a trap: if a previous run was killed before it
 * released 9333, the stale Chrome still owns the port, `waitForDevtools` talks
 * to that dead browser, and the run dies with a misleading "endpoint never came
 * up" while the new Chrome quietly sits there. Binding to port 0 and closing
 * removes the collision instead of retrying around it.
 */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

async function waitForDevtools(port: number, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const json = (await res.json()) as { webSocketDebuggerUrl: string };
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint never came up");
}

export async function launch(opts: { port?: number; width?: number; height?: number } = {}): Promise<Browser> {
  const port = opts.port ?? (await freePort());
  const bin = findChrome();
  const profile = `/tmp/cdp-profile-${Date.now()}`;
  const child: ChildProcess = spawn(
    bin,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--window-size=${opts.width ?? 1280},${opts.height ?? 900}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const wsUrl = await waitForDevtools(port);
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((res, rej) => {
    ws.addEventListener("open", () => res(), { once: true });
    ws.addEventListener("error", () => rej(new Error("devtools socket failed")), { once: true });
  });

  let id = 0;
  const consoleMessages: { type: string; text: string; stack?: string }[] = [];
  const failedRequests: { url: string; error: string }[] = [];
  const requestUrls = new Map<string, string>();
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String((ev as MessageEvent).data)) as {
      id?: number;
      result?: unknown;
      error?: { message: string };
      method?: string;
      params?: Record<string, unknown>;
    };
    // Events carry no id; they are the whole reason this listener also reads
    // `method`. A page that throws or fails a fetch is invisible to `eval`.
    if (msg.method === "Runtime.consoleAPICalled") {
      const p = msg.params as {
        type: string;
        args: { value?: unknown; description?: string }[];
        stackTrace?: { callFrames?: { functionName?: string; url?: string; lineNumber?: number }[] };
      };
      const text = (p.args ?? []).map((a) => String(a.value ?? a.description ?? "")).join(" ");
      if (p.type === "error" || p.type === "warning" || p.type === "assert")
        consoleMessages.push({ type: p.type, text, stack: fmtFrames(p.stackTrace) });
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params?.exceptionDetails as {
        text?: string;
        exception?: { description?: string };
        stackTrace?: { callFrames?: { functionName?: string; url?: string; lineNumber?: number }[] };
        url?: string;
        lineNumber?: number;
      };
      consoleMessages.push({
        type: "error",
        text: String(d?.exception?.description ?? d?.text ?? "exception"),
        stack: fmtFrames(d?.stackTrace) || (d?.url ? `${d.url}:${d.lineNumber}` : undefined),
      });
      return;
    }
    if (msg.method === "Log.entryAdded") {
      const e = msg.params?.entry as {
        level?: string;
        text?: string;
        url?: string;
        lineNumber?: number;
        stackTrace?: { callFrames?: { functionName?: string; url?: string; lineNumber?: number }[] };
      };
      if (e?.level === "error" || e?.level === "warning")
        consoleMessages.push({
          type: String(e.level),
          text: String(e.text ?? ""),
          stack: fmtFrames(e.stackTrace) || (e.url ? `${e.url}:${e.lineNumber}` : undefined),
        });
      return;
    }
    if (msg.method === "Network.loadingFailed") {
      const f = msg.params as { requestId?: string; type?: string; errorText?: string; canceled?: boolean; blockedReason?: string };
      const url = requestUrls.get(String(f?.requestId)) ?? "";
      failedRequests.push({
        url,
        error: String(f?.blockedReason ?? f?.errorText ?? "failed"),
      });
      return;
    }
    if (msg.method === "Network.requestWillBeSent") {
      const r = msg.params as { requestId?: string; request?: { url?: string } };
      if (r?.requestId && r.request?.url) requestUrls.set(r.requestId, r.request.url);
      return;
    }
    if (msg.id == null) return;
    const slot = pending.get(msg.id);
    if (!slot) return;
    pending.delete(msg.id);
    if (msg.error) slot.reject(new Error(msg.error.message));
    else slot.resolve(msg.result);
  });

  const send = <T>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> => {
    const msgId = ++id;
    return new Promise<T>((resolve, reject) => {
      pending.set(msgId, { resolve: resolve as (v: unknown) => void, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  };

  // A page target, so we get a real renderer rather than the browser shell.
  const { targetId } = (await send<{ targetId: string }>("Target.createTarget", {
    url: "about:blank",
  })) as { targetId: string };
  const { sessionId } = (await send<{ sessionId: string }>("Target.attachToTarget", {
    targetId,
    flatten: true,
  })) as { sessionId: string };

  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Log.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);

  const evaluate = async <T>(expression: string): Promise<T> => {
    const res = (await send<{ result: { value: T }; exceptionDetails?: { text: string } }>(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )) as { result: { value: T }; exceptionDetails?: { text: string } };
    if (res.exceptionDetails) {
      const d = res.exceptionDetails as { text?: string; exception?: { description?: string } };
      throw new Error(d.exception?.description || d.text || "eval exception");
    }
    return res.result.value;
  };

  return {
    async goto(url) {
      await send("Page.navigate", { url }, sessionId);
      // Client-rendered: give the fetches and React a chance to settle.
      await sleep(2200);
    },
    eval: evaluate,
    async setCookie(name, value) {
      await send(
        "Network.setCookie",
        { name, value, domain: "localhost", path: "/" },
        sessionId,
      );
    },
    async text() {
      return evaluate<string>("document.body.innerText");
    },
    async typeText(text) {
      for (const ch of text) {
        const code = ch.charCodeAt(0);
        // `keyDown` with text set is enough for Chromium to insert the character
        // (adding a separate `char` event types it twice); keyUp closes the pair.
        await send(
          "Input.dispatchKeyEvent",
          { type: "keyDown", text: ch, unmodifiedText: ch, key: ch, windowsVirtualKeyCode: code },
          sessionId,
        );
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch, windowsVirtualKeyCode: code }, sessionId);
      }
      await sleep(150);
    },
    async mouseClick(x, y) {
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await send(
          "Input.dispatchMouseEvent",
          {
            type,
            x,
            y,
            button: "left",
            clickCount: type === "mousePressed" ? 1 : undefined,
            buttons: type === "mousePressed" ? 1 : 0,
          },
          sessionId,
        );
      }
      await sleep(250);
    },
    async insertText(text) {
      await send("Input.insertText", { text }, sessionId);
      await sleep(150);
    },
    async click(selector) {
      const hit = await evaluate<boolean>(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false; el.click(); return true; })()`,
      );
      if (hit) await sleep(1800);
      return hit;
    },
    async setViewport({ width, height, mobile = false }) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: mobile ? 3 : 1, mobile },
        sessionId,
      );
      // Layout settles on the next frame; without this a measurement can read
      // the pre-override width.
      await sleep(250);
    },
    async setMediaFeatures(features) {
      await send("Emulation.setEmulatedMedia", { features }, sessionId);
      await sleep(250);
    },
    async screenshot({ fullPage = false } = {}) {
      if (fullPage) {
        // captureBeyondViewport gives the whole document in one shot.
        const metrics = await send<{ cssContentSize: { width: number; height: number } }>(
          "Page.getLayoutMetrics",
          {},
          sessionId,
        );
        await send(
          "Emulation.setDeviceMetricsOverride",
          {
            width: Math.ceil(metrics.cssContentSize.width),
            height: Math.ceil(metrics.cssContentSize.height),
            deviceScaleFactor: 1,
            mobile: false,
          },
          sessionId,
        );
        await sleep(400);
      }
      const { data } = await send<{ data: string }>(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: fullPage },
        sessionId,
      );
      if (fullPage) {
        await send("Emulation.clearDeviceMetricsOverride", {}, sessionId);
      }
      return data;
    },
    consoleMessages: () => consoleMessages.slice(),
    failedRequests: () => failedRequests.slice(),
    async close() {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      child.kill("SIGKILL");
      // Each launch makes a fresh profile dir; without this they pile up in /tmp
      // for the lifetime of the machine.
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}
