/**
 * Exercises the traffic manager: the scanner filter, the host-wide token
 * bucket, the telemetry readout, and the response hardening it adds.
 *
 * Two halves:
 *   - unit: import `@/lib/trafficManager` directly and drive `isScanner` and
 *     `takeToken` with a spread of probes and legitimate requests.
 *   - integration: against a running instance (BASE_URL, default
 *     127.0.0.1:3001) confirm probe paths get a stub 404, the scanner counter
 *     in `/api/traffic` actually moves, `/api/health` stays up, and the public
 *     asset cache headers from `next.config.ts` are served. The integration
 *     half skips cleanly when the host is not reachable.
 *
 * Read-only against the host: it only issues GETs and reads counters.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-traffic-manager.ts
 *   BASE_URL=https://<public-host> npx tsx --tsconfig scripts/tsconfig.json scripts/test-traffic-manager.ts
 */
import "dotenv/config";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { isScanner, snapshot, takeToken } from "@/lib/trafficManager";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = "") {
  checks++;
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}

function unitTests() {
  console.log("\ntraffic manager \u2014 unit");

  // Scanner detection: exploit probes must be caught, real traffic must not.
  const probes: Array<[string, string, string]> = [
    ["/.env", "GET", "Mozilla/5.0"],
    ["/.env.production", "GET", ""],
    ["/.git/config", "GET", ""],
    ["/wp-login.php", "GET", ""],
    ["/wp-admin/setup-config.php", "GET", ""],
    ["/phpmyadmin/index.php", "GET", ""],
    ["/cgi-bin/luci", "GET", ""],
    ["/server-status", "GET", ""],
    ["/api/health", "PROPFIND", ""],
    ["/login", "GET", "sqlmap/1.7#stable"],
    ["/whatever", "GET", "Nikto/2.5.0"],
  ];
  for (const [path, method, ua] of probes) {
    check(`scanner: ${method} ${path}${ua ? ` [${ua}]` : ""}`, isScanner(path, ua, method));
  }

  const legit: Array<[string, string, string]> = [
    ["/", "GET", "Mozilla/5.0 (Macintosh)"],
    ["/login", "GET", "Mozilla/5.0"],
    ["/dashboard", "GET", "Mozilla/5.0"],
    ["/api/health", "GET", "curl/8.4.0"],
    ["/api/student/profile", "PATCH", "Mozilla/5.0"],
    ["/models/tiny_face_detector_model.bin", "GET", "Mozilla/5.0"],
    ["/vendor/monaco/vs/main-BEx-Fmlo.js", "GET", "Mozilla/5.0"],
    ["/.well-known/security.txt", "GET", "Mozilla/5.0"],
  ];
  for (const [path, method, ua] of legit) {
    check(`not scanner: ${method} ${path}`, !isScanner(path, ua, method));
  }

  // Token bucket: a fresh bucket hands out exactly `burst` tokens, then refuses.
  const key = `unit:${Date.now()}:${Math.random()}`;
  let allowed = 0;
  for (let i = 0; i < 5; i++) if (takeToken(key, 1, 3).ok) allowed++;
  check("token bucket hands out the burst then stops", allowed === 3, `allowed=${allowed}`);
  const refused = takeToken(key, 1, 3);
  check("token bucket refusal carries Retry-After", !refused.ok && refused.retryAfter >= 1, JSON.stringify(refused));

  // Telemetry shape.
  const snap = snapshot();
  check("snapshot exposes counters", typeof snap.requests.total === "number" && typeof snap.shed === "number");
  check("snapshot reports the configured ceiling", snap.global.burst > 0 && snap.global.ratePerSec > 0);
}

async function reachable() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(4_000), redirect: "manual" });
    return res.status === 200 || res.status === 503;
  } catch {
    return false;
  }
}

async function integrationTests() {
  console.log(`\ntraffic manager \u2014 integration (${BASE})`);

  const health = await fetch(`${BASE}/api/health`, { redirect: "manual" });
  check("/api/health answers", health.status === 200, `status=${health.status}`);

  const before = (await (await fetch(`${BASE}/api/traffic`)).json()) as {
    requests: { total: number };
    scanners: number;
  };
  check("/api/traffic returns json", typeof before.scanners === "number" && typeof before.requests.total === "number");

  for (const probe of ["/.env", "/wp-login.php", "/phpmyadmin/index.php"]) {
    const res = await fetch(`${BASE}${probe}`, { redirect: "manual" });
    check(`${probe} refused with 404`, res.status === 404, `status=${res.status}`);
  }

  const after = (await (await fetch(`${BASE}/api/traffic`)).json()) as { scanners: number };
  check("scanner counter advanced", after.scanners >= before.scanners + 3, `${before.scanners} -> ${after.scanners}`);

  // Cache headers from next.config.ts. This is the host's biggest bandwidth win.
  const model = await fetch(`${BASE}/models/tiny_face_detector_model.bin`, { method: "HEAD" });
  check(
    "/models/* is cached long",
    (model.headers.get("cache-control") ?? "").includes("immutable"),
    `cache-control=${model.headers.get("cache-control")}`,
  );

  let vendorFile: string | undefined;
  try {
    vendorFile = readdirSync(join(process.cwd(), "public/vendor/monaco/vs")).find((f) => f.endsWith(".js"));
  } catch {
    vendorFile = undefined;
  }
  if (vendorFile) {
    const vendor = await fetch(`${BASE}/vendor/monaco/vs/${vendorFile}`, { method: "HEAD" });
    check(
      "/vendor/* is cached long",
      (vendor.headers.get("cache-control") ?? "").includes("immutable"),
      `cache-control=${vendor.headers.get("cache-control")}`,
    );
  } else {
    console.log("  skip /vendor check (no monaco build on disk)");
  }

  const qr = await fetch(`${BASE}/payment-qr.png`, { method: "HEAD" });
  check(
    "/payment-qr.png is cached",
    (qr.headers.get("cache-control") ?? "").includes("max-age"),
    `cache-control=${qr.headers.get("cache-control")}`,
  );
}

async function main() {
  unitTests();
  if (await reachable()) await integrationTests();
  else console.log(`\ntraffic manager \u2014 integration skipped (${BASE} not reachable)`);

  console.log(`\n${checks - failures}/${checks} passed`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
