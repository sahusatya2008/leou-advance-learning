/**
 * Proves the 3D Courses section is really published on the public website,
 * not just on localhost. The request is pinned to the IP that a real visitor's
 * browser resolves (public DNS, not this Mac's MagicDNS), so a healthy hairpin
 * cannot fake a passing result. Uses a real student session and checks the
 * server-rendered HTML of both new pages.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/verify-public-learning.ts
 */
import "dotenv/config";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";
import { CONCEPTS, COURSE_ID } from "@/lib/learning3d/encodingCourse";
import { GOC_CONCEPTS, GOC_COURSE_ID } from "@/lib/learning3d/chemCourse";
import { HALO_COURSE_ID } from "@/lib/learning3d/haloCourse";

const HOST = "leou.tailabe1e6.ts.net";
const BASE = `https://${HOST}`;

// Ignore this machine's tailnet answer; use the address the outside world sees.
const PUBLIC_IP =
  process.env.PUBLIC_IP ??
  execFileSync("dig", ["+short", HOST, "@1.1.1.1"], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => /^\d+\.\d+\.\d+\.\d+$/.test(s)) ?? "";
if (!PUBLIC_IP) throw new Error("could not resolve the public ingress IP");

function pub(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: HOST,
        port: 443,
        path,
        method: "GET",
        headers: { Host: HOST, ...headers },
        lookup: (_hostname, _opts, cb) => {
          // Node 20+ asks for all addresses by default (autoSelectFamily).
          // Answer with the single pinned ingress IP in either shape.
          const opts = _opts as { all?: boolean } | undefined;
          if (opts?.all) (cb as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address: PUBLIC_IP, family: 4 }]);
          else (cb as (e: null, a: string, f: number) => void)(null, PUBLIC_IP, 4);
        },
        timeout: 120_000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout on ${path}`)));
    req.on("error", reject);
    req.end();
  });
}

let checks = 0;
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`public site: ${BASE} via ingress ${PUBLIC_IP}`);
  const root = await pub("/api/health");
  check("public site is healthy", root.status === 200, `status ${root.status}`);

  const user = await prisma.user.findUnique({ where: { username: "rolex" }, select: { id: true } });
  if (!user) throw new Error("eligible test student missing");
  const session = await createSession({ id: user.id, role: "STUDENT" }, { userAgent: "public-verify" });
  const headers = { cookie: `${SESSION_COOKIE}=${session.token}` };
  try {
    const hub = await pub("/dashboard/learn", headers);
    check("hub page is public and rendered", hub.status === 200, `status ${hub.status}`);
    check("nav label 'Courses' is served", hub.body.includes("Courses"));
    check(
      "hub lists the Encoding course",
      /Encoding Schemes (\&|&amp;) Conversions/.test(hub.body) && hub.body.includes("Start learning"),
      hub.body.slice(0, 160).replace(/\s+/g, " "),
    );
    check(
      "hub lists GOC as free for all",
      hub.body.includes("General Organic Chemistry (GOC)") && hub.body.includes("Free for all"),
      hub.body.slice(0, 200).replace(/\s+/g, " "),
    );
    check(
      "hub lists Haloalkanes as locked without the chapter",
      /Haloalkanes (\&|&amp;) Haloarenes/.test(hub.body) && hub.body.includes("Locked"),
      hub.body.slice(0, 220).replace(/\s+/g, " "),
    );

    const course = await pub(`/dashboard/learn/${COURSE_ID}`, headers);
    check("course page is public", course.status === 200, `status ${course.status}`);
    check(
      `all ${CONCEPTS.length} lessons are on the page`,
      /Concept[^A-Za-z]{0,80}1[^A-Za-z]{0,80}of[^A-Za-z]{0,80}24/.test(course.body),
      (() => {
        const i = course.body.indexOf("Concept");
        return JSON.stringify(course.body.slice(i, i + 220));
      })(),
    );
    check("interactive 3D canvas is present", course.body.includes("<canvas"));

    const goc = await pub(`/dashboard/learn/${GOC_COURSE_ID}`, headers);
    check("free GOC course page is public", goc.status === 200, `status ${goc.status}`);
    check(
      `all ${GOC_CONCEPTS.length} GOC lessons are on the page`,
      new RegExp(`Concept[^A-Za-z]{0,80}1[^A-Za-z]{0,80}of[^A-Za-z]{0,80}${GOC_CONCEPTS.length}`).test(goc.body),
      (() => {
        const i = goc.body.indexOf("Concept");
        return JSON.stringify(goc.body.slice(i, i + 220));
      })(),
    );
    check("GOC has its 3D canvas and practical controls", goc.body.includes("<canvas") && goc.body.includes("chem-chain"));
    check("GOC explains the basics", goc.body.includes("Why carbon?"));

    const halo = await pub(`/dashboard/learn/${HALO_COURSE_ID}`, headers);
    check("Haloalkanes stays locked without the availed chapter", halo.status === 200 && halo.body.includes("Course unavailable"), `status ${halo.status}`);

    const api = await pub("/api/student/learn", headers);
    const body = JSON.parse(api.body) as {
      eligible?: boolean;
      chapters?: { id: string; available: boolean; free?: boolean }[];
    };
    check("public API confirms eligibility", api.status === 200 && body.eligible === true, api.body.slice(0, 200));
    check("public API lists Encoding as playable", Boolean(body.chapters?.some((c) => c.id === COURSE_ID && c.available)));
    check("public API lists GOC as free and playable", Boolean(body.chapters?.some((c) => c.id === GOC_COURSE_ID && c.available && c.free)));
  } finally {
    await revokeSession(session.token);
  }

  console.log(`\n${checks - failures}/${checks} public checks passed`);
  if (failures) process.exitCode = 1;
  await prisma.$disconnect();
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
