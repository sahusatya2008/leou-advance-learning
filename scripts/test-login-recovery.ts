/**
 * Regression checks for the login-recovery work: self-service access codes,
 * camera-error telemetry, and self-service face re-enrollment.
 *
 * Every test runs against a throwaway student created here and deleted in the
 * `finally` block. No pre-existing row is read for anything but a count, and no
 * other student's codes are touched.
 *
 *   BASE_URL=http://127.0.0.1:3001 npx tsx --tsconfig scripts/tsconfig.json scripts/test-login-recovery.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/validation";
import { ACCESS_CODE_LENGTH, LOGIN_CONFIG } from "@/lib/constants";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const STAMP = Date.now().toString(36);
const PASSWORD = "Test-Passw0rd!";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = "") {
  checks++;
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const created: string[] = [];

async function makeUser(role: "STUDENT" | "ADMIN", withProfile: boolean, tag = "") {
  const user = await prisma.user.create({
    data: {
      username: `zz_login_${STAMP}_${tag}${role.toLowerCase()}`,
      email: `zz_login_${STAMP}_${tag}${role.toLowerCase()}@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role,
    },
  });
  created.push(user.id);
  // Created separately rather than as a nested write: mixing the unchecked
  // scalar fields with a nested relation create fails Prisma's input type.
  // The existing classroom is referenced read-only; nothing about it changes.
  if (withProfile) {
    const classroom = await prisma.classRoom.findFirst({ select: { id: true } });
    if (!classroom) throw new Error("no ClassRoom exists to attach the test profile to");
    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        fullName: "Login Recovery Test",
        classRoomId: classroom.id,
        schoolName: "Test School",
        facePhotoUrl: "",
        faceEmbeddings: [],
      },
    });
  }
  return user;
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* leave empty */
  }
  return { status: res.status, json, headers: res.headers };
}

async function main() {
  console.log(`\nlogin recovery (${BASE})`);
  console.log(`  self-service access codes: ${LOGIN_CONFIG.SELF_SERVICE_ACCESS_CODE ? "ENABLED" : "DISABLED"}`);

  const student = await makeUser("STUDENT", true);
  const admin = await makeUser("ADMIN", false);
  // Deliberate wrong-password cases get their own account. The lockout is keyed
  // on IP + identifier, so hammering this user would otherwise park the
  // happy-path student for the rest of the run.
  const badpw = await makeUser("STUDENT", true, "badpw_");

  // Baseline so we can prove no other student's codes were disturbed.
  const codesBefore = await prisma.accessCode.count({ where: { studentId: { not: student.id } } });

  console.log("\naccess code: wrong password");
  {
    const r = await post("/api/auth/access-code", {
      identifier: badpw.username,
      password: "definitely-wrong",
    });
    check("wrong password is rejected", r.status === 401, `got ${r.status}`);
    check("no code is leaked on failure", typeof r.json.code === "undefined");
  }

  console.log("\nrepeating a wrong password eventually locks the pair out");
  {
    // Escalating lockout, shared with the login form. Confirms the self-service
    // endpoint cannot be used as a free password oracle.
    let saw429 = false;
    for (let i = 0; i < 12; i++) {
      const r = await post("/api/auth/access-code", { identifier: badpw.username, password: "wrong-again" });
      if (r.status === 429) {
        saw429 = true;
        break;
      }
    }
    check("repeated failures end in a lockout", saw429);
    const after = await post("/api/auth/access-code", { identifier: badpw.username, password: PASSWORD });
    check("the correct password is refused while parked", after.status === 429, `got ${after.status}`);
  }

  console.log("\naccess code: unknown account");
  {
    const r = await post("/api/auth/access-code", {
      identifier: `zz_no_such_user_${STAMP}`,
      password: PASSWORD,
    });
    check("unknown account is rejected", r.status === 401, `got ${r.status}`);
    check("unknown account gives the same message as a wrong password",
      String(r.json.error) === "Invalid username or password.");
  }

  console.log("\naccess code: non-student");
  {
    const r = await post("/api/auth/access-code", { identifier: admin.username, password: PASSWORD });
    check("an admin cannot fetch a student access code", r.status === 403, `got ${r.status}`);
    check("the reason is spelled out", String(r.json.error).includes("student"));
  }

  console.log("\naccess code: student fetches their own");
  let firstCode = "";
  {
    const r = await post("/api/auth/access-code", { identifier: student.username, password: PASSWORD });
    check("a student can read their own code after the password", r.status === 200, `got ${r.status} ${JSON.stringify(r.json)}`);
    firstCode = String(r.json.code ?? "");
    check("the code has the expected length", firstCode.length === ACCESS_CODE_LENGTH, `"${firstCode}"`);
    check("the code is numeric", /^\d+$/.test(firstCode));
    const ttl = Number(r.json.ttlMs ?? 0);
    check("the code advertises a short life", ttl > 0 && ttl <= 60_000, `${ttl}ms`);
    check("the response carries no session cookie", !String(r.headers.get("set-cookie") ?? "").includes("leou_session"));
  }

  console.log("\nlogin with the self-service code");
  {
    const r = await post("/api/auth/login", {
      mode: "access-code",
      identifier: student.username,
      password: PASSWORD,
      code: firstCode,
    });
    check("the code logs the student in", r.status === 200 && r.json.redirect === "/dashboard", `got ${r.status}`);
    const cookie = String(r.headers.get("set-cookie") ?? "");
    check("a real session cookie is issued", cookie.includes("leou_session"));
    check("the session cookie is httpOnly", /httponly/i.test(cookie));
  }

  console.log("\ncodes are single-use");
  {
    const r = await post("/api/auth/login", {
      mode: "access-code",
      identifier: student.username,
      password: PASSWORD,
      code: firstCode,
    });
    check("the same code cannot be replayed", r.status === 403, `got ${r.status}`);
  }

  console.log("\nfetching a new code invalidates the old one");
  {
    const second = await post("/api/auth/access-code", { identifier: student.username, password: PASSWORD });
    const secondCode = String(second.json.code ?? "");
    check("a fresh code is issued", secondCode.length === ACCESS_CODE_LENGTH, `got "${secondCode}"`);
    const reuse = await post("/api/auth/login", {
      mode: "access-code",
      identifier: student.username,
      password: PASSWORD,
      code: firstCode,
    });
    check("the superseded code is dead", reuse.status === 403, `got ${reuse.status}`);
    const useNew = await post("/api/auth/login", {
      mode: "access-code",
      identifier: student.username,
      password: PASSWORD,
      code: secondCode,
    });
    check("the newest code works", useNew.status === 200, `got ${useNew.status}`);
  }

  console.log("\ncamera-error telemetry");
  {
    const r = await post("/api/auth/camera-error", {
      kind: "permission",
      domException: "NotAllowedError",
      device: "640x480",
    });
    check("a camera failure can be reported", r.status === 200, `got ${r.status}`);
    const logged = await prisma.activityLog.findFirst({
      where: { type: "LOGIN_FACE_FAIL", metadata: { path: ["reason"], equals: "camera_permission" } },
      orderBy: { createdAt: "desc" },
    });
    check("the reason is written to the activity log", !!logged);
  }
  {
    const r = await post("/api/auth/camera-error", { kind: "not-a-kind" });
    check("telemetry never fails a request", r.status === 200 || r.status === 400, `got ${r.status}`);
  }

  console.log("\nre-enrollment is scoped to the pre-login window");
  {
    const r = await post("/api/auth/re-enroll", { images: [] });
    check("no pre-login cookie means no re-enrollment", r.status === 401, `got ${r.status}`);
    check("the student is told to sign in again", String(r.json.error).toLowerCase().includes("sign in"));
  }

  console.log("\nlegacy face enrollment advertises the recovery path");
  {
    const login = readLoginRoute();
    check("legacy enrollments set allowReEnroll", /allowReEnroll:\s*true/.test(login));
    check("legacy enrollments still allow an access code", /allowAccessCode:\s*true/.test(login));
    check("the login route was not made reachable without the pre-login cookie",
      /getPreloginIdentity\(\)/.test(login));
  }

  console.log("\nno other student's data was touched");
  {
    const codesAfter = await prisma.accessCode.count({ where: { studentId: { not: student.id } } });
    check("other students' access codes are unchanged", codesBefore === codesAfter, `${codesBefore} -> ${codesAfter}`);
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exitCode = 1;
}

function readLoginRoute() {
  return readFileSync("src/app/api/auth/login/route.ts", "utf8");
}

main()
  .catch((e) => {
    failures++;
    console.error("\nharness error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Clean up in the right order: ActivityLog.userId is SetNull on delete, so
    // the test rows have to go first or they are orphaned.
    try {
      await prisma.activityLog.deleteMany({ where: { userId: { in: created } } });
      await prisma.session.deleteMany({ where: { userId: { in: created } } });
      await prisma.accessCode.deleteMany({ where: { studentId: { in: created } } });
      await prisma.user.deleteMany({ where: { id: { in: created } } });
      const left = await prisma.user.count({ where: { id: { in: created } } });
      console.log(`\ncleanup: ${left === 0 ? "test users removed" : `${left} test users LEFT BEHIND`}`);
      if (left > 0) process.exitCode = 1;
    } catch (e) {
      console.error("cleanup failed:", e);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
