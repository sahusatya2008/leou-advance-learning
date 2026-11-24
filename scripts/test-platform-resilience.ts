/**
 * Regression checks for the session and error-contract fixes.
 *
 * These are the failures that produced "my account keeps logging me out",
 * "DOCTYPE is not valid JSON" and "the site is unusable on my phone". They are
 * cheap to assert on statically, so they run in CI rather than being discovered
 * by a student.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SESSION_TTL, PRELOGIN_TTL } from "@/lib/constants";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = "") {
  checks++;
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(p: string) {
  return readFileSync(join(process.cwd(), p), "utf8");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const full = join(dir, entry);
    if (statSync(join(process.cwd(), full)).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

console.log("\nsession lifetime");
{
  check("session TTL is at least 7 days", SESSION_TTL >= 7 * 24 * 60 * 60 * 1000);
  // The face service is allowed 120s to answer, so a shorter pre-login window
  // guaranteed a lockout mid-verification on a slow connection.
  check("pre-login window outlasts the face service timeout (120s)", PRELOGIN_TTL >= 120_000, `${PRELOGIN_TTL / 1000}s`);

  const auth = read("src/lib/auth.ts");
  check("session slides forward while in use", /renewSessionIfStale/.test(auth));
  check("renewal extends the database session row", /updateMany\([\s\S]*?expiresAt/.test(auth));
  check("renewal re-signs the token", /renewSessionIfStale[\s\S]*?signToken/.test(auth));
  check("suspended/blocked accounts are not treated as logged in", /user\.status !== "ACTIVE"/.test(auth));
  check("cookie is marked high priority so the browser keeps it", /priority: "high"/.test(auth));

  const sessionRoute = read("src/app/api/auth/session/route.ts");
  check("logout clears the cookie, not just the database row", /clearSessionCookies\(res\)/.test(sessionRoute));

  const login = read("src/app/api/auth/login/route.ts");
  check("login clears the spent pre-login cookie on the real response", !/clearSessionCookies\(jsonRes/.test(login));
  check("expired pre-login offers the access-code route out", /allowAccessCode: true/.test(login));
}

console.log("\nAPI error contract (the DOCTYPE / invalid JSON class)");
{
  const panels = read("src/lib/panels.ts");
  check("route handlers use the JSON guard", /export async function requireApiRole/.test(panels));
  // Scope the assertion to requireApiRole's own body: the page guard in the same
  // file must keep using redirect().
  const apiGuard = panels.slice(panels.indexOf("export async function requireApiRole"));
  check(
    "API guard answers 401 JSON, never a redirect",
    /status: 401/.test(apiGuard) && !/redirect\(/.test(apiGuard)
  );
  check("API guard answers 403 JSON for the wrong role", /status: 403/.test(apiGuard));
  check("page guard still redirects (needed for pages)", /redirect\("\/login"\)/.test(panels));

  const routes = walk("src/app/api").filter((f) => f.endsWith("route.ts"));
  const offenders = routes.filter((f) => /requireRole\(/.test(read(f)));
  check(`no route handler calls the redirecting guard (${routes.length} routes checked)`, offenders.length === 0, offenders.join(", "));

  const unguarded = routes.filter((f) => /await req\.formData\(\)|await request\.formData\(\)/.test(read(f)) && !/try \{/.test(read(f)));
  check("every multipart read is guarded against a thrown parse error", unguarded.length === 0, unguarded.join(", "));
}

console.log("\nclient request helper");
{
  const api = read("src/lib/apiClient.ts");
  check("refuses to parse a non-JSON body", /isJson\(res\)/.test(api));
  check("detects a redirect to the login page before parsing", /redirectedToLogin/.test(api));
  check("raises a distinct error for an ended session", /class SessionExpiredError/.test(api));
  check("never replays a non-idempotent request after a network drop", /safeMethod/.test(api));
  check("translates parse failures into readable text", /Unexpected token/.test(api));

  // The poisoned-promise cache: one blip used to break the bank until reload.
  const form = read("src/components/admin/assessments/AssessmentForm.tsx");
  check("rejected question bank requests are evicted from the cache", /questionCache\.delete\(key\)/.test(form));

  // A leaked SyntaxError in the UI is the exact symptom that was reported.
  const components = walk("src/components");
  const leaks = components.filter((f) => /setError\(e instanceof Error \? e\.message/.test(read(f)));
  check(`no component shows a raw exception message (${components.length} checked)`, leaks.length === 0, leaks.join(", "));
}

console.log("\nmobile");
{
  const layout = read("src/app/layout.tsx");
  check("viewport is declared for phones", /export const viewport/.test(layout) && /width: "device-width"/.test(layout));
  check("safe areas are respected", /viewportFit: "cover"/.test(layout));

  const css = read("src/app/globals.css");
  check("the document cannot scroll sideways", /overflow-x: clip/.test(css));
  check("tap targets are sized for a fingertip", /pointer: coarse/.test(css));
  check("iOS input zoom is prevented", /font-size: 16px/.test(css));
  check("reduced-motion is respected", /prefers-reduced-motion/.test(css));

  for (const [name, file] of [
    ["student", "src/components/student/StudentSidebar.tsx"],
    ["admin", "src/components/admin/AdminSidebar.tsx"],
  ] as const) {
    const src = read(file);
    check(`${name} shell provides mobile navigation`, /MobileNav/.test(src));
  }
  check("shared drawer component exists", read("src/components/shell/MobileNav.tsx").includes("export function MobileNav"));

  const tabs = read("src/components/student/BatchTabs.tsx");
  check("hover-only affordance is visible on touch", !/text-primary opacity-0/.test(tabs));

  const attempt = read("src/components/student/AttemptView.tsx");
  check("question navigator uses finger-sized targets on phones", /grid-cols-4 gap-2 sm:grid-cols-6/.test(attempt));
  check("polling cannot deliver overlapping responses", /pollInFlightRef/.test(attempt));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
