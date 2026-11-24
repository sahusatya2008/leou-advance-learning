/**
 * Exercises the admin parents area and the parent panel end to end:
 *
 *   - admin CRUD: create (and duplicate/weak-password rejects), list, patch
 *     (rename / phone / status / password reset), delete-with-children 409;
 *   - linking: link to parent A, refusing to steal without `replace`, moving
 *     with replace, unlink, and delete-after-unlink;
 *   - parents page HTML renders, and role guards hold (parent -> /admin and
 *     /dashboard redirect away, parent calling admin APIs gets 403);
 *   - the parent panel: password login goes to /parent and records
 *     PARENT_LOGIN, home shows linked children, the child page gates on
 *     ownership (404 for strangers), fees + activity render.
 *
 * All rows it touches are created here and removed in `finally`.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-parent-panels.ts
 *   BASE_URL=https://<public-host> npx tsx --tsconfig scripts/tsconfig.json scripts/test-parent-panels.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/validation";
import { SESSION_COOKIE, createSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const PASSWORD = "Parent-Passw0rd!";
const STAMP = Date.now().toString(36);

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

async function json<T = unknown>(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body: body as T | null };
}

async function getPage(path: string, cookie: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie }, redirect: "manual" });
  return { status: res.status, text: await res.text() };
}

const undo: (() => Promise<unknown>)[] = [];

async function main() {
  console.log(`\nparent panels (${BASE})`);

  const classRoom = await prisma.classRoom.findFirst({ select: { id: true, hasStreams: true } });
  if (!classRoom) throw new Error("no class room");
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!adminUser) throw new Error("no admin user");

  // Self-heal from an interrupted earlier run with this exact stamp so the
  // "empty list" assertion holds on re-runs.
  await prisma.user.deleteMany({
    where: { username: { in: [`zz_par_${STAMP}`, `zz_pa_${STAMP}`, `zz_pb_${STAMP}`, `zz_pc_${STAMP}`] } },
  });

  const adminInfo = await createSession({ id: adminUser.id, role: "ADMIN" }, { userAgent: "parent-panels-test" });
  const adminCookie = `${SESSION_COOKIE}=${adminInfo.token}`;

  // ----- unauthenticated guard + empty list run BEFORE any seeding ---------------
  {
    const res = await fetch(`${BASE}/api/admin/parents`);
    check("api parents without session -> 401", res.status === 401, `got ${res.status}`);
  }
  {
    const r = await json<{ parents: unknown[] }>("/api/admin/parents", {
      headers: { Cookie: adminCookie },
    });
    check("list parents -> 200", r.status === 200, `got ${r.status}`);
    check("list parents starts empty", Array.isArray(r.body?.parents) && r.body!.parents.length === 0);
  }

  // ----- seed a throwaway student + two parents ---------------------------------
  const student = await prisma.user.create({
    data: {
      username: `zz_par_${STAMP}`,
      email: `zz_par_${STAMP}@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role: "STUDENT",
      studentProfile: {
        create: {
          fullName: "Parent Test Child",
          classRoomId: classRoom.id,
          schoolName: "ZZ School",
          facePhotoUrl: "",
          faceEmbeddings: [],
        },
      },
    },
  });
  undo.push(() => prisma.user.deleteMany({ where: { id: student.id } }));

  const parentA = await prisma.user.create({
    data: {
      username: `zz_pa_${STAMP}`,
      email: `zz_pa_${STAMP}@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role: "PARENT",
      parentProfile: { create: { fullName: "Parent A" } },
    },
  });
  undo.push(() => prisma.user.deleteMany({ where: { id: parentA.id } }));

  const parentB = await prisma.user.create({
    data: {
      username: `zz_pb_${STAMP}`,
      email: `zz_pb_${STAMP}@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role: "PARENT",
      parentProfile: { create: { fullName: "Parent B" } },
    },
  });
  undo.push(() => prisma.user.deleteMany({ where: { id: parentB.id } }));
  undo.push(async () => {
    // The parent panel logs PARENT_LOGIN rows against these users; wiping the
    // accounts nulls their userId, so drop the leftovers here too.
    await prisma.activityLog.deleteMany({
      where: { type: "PARENT_LOGIN", userId: { in: [parentA.id, parentB.id] } },
    });
  });

  const studentId = student.id;

  // ----- create -----------------------------------------------------------------
  let createdId = "";
  {
    const body = JSON.stringify({
      username: `zz_pc_${STAMP}`,
      password: PASSWORD,
      fullName: "Created Parent",
      phone: "+92 300 1234567",
    });
    const r = await json<{ parent?: { id: string; username: string; parentProfile: { fullName: string | null } }; error?: string }>(
      "/api/admin/parents",
      {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body,
      },
    );
    check("create parent -> 201", r.status === 201, `got ${r.status}`);
    check("create sets fullName", r.body?.parent?.parentProfile?.fullName === "Created Parent");
    if (r.body?.parent?.id) createdId = r.body.parent.id;
    undo.unshift(() => prisma.user.deleteMany({ where: { id: createdId } }));
  }

  {
    const body = JSON.stringify({ username: `zz_pc_${STAMP}`, password: PASSWORD, fullName: "Dup" });
    const r = await json<{ error?: string }>("/api/admin/parents", {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body,
    });
    check("duplicate username -> 409", r.status === 409, `got ${r.status}`);
  }
  {
    const body = JSON.stringify({ username: `zz_pd_${STAMP}`, password: "short", fullName: "Bad" });
    const r = await json<{ error?: string }>("/api/admin/parents", {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body,
    });
    check("weak password -> 400", r.status === 400, `got ${r.status}`);
  }

  // list now contains created + A + B
  {
    const r = await json<{ parents: { username: string }[] }>("/api/admin/parents", {
      headers: { Cookie: adminCookie },
    });
    const names = r.body?.parents.map((p) => p.username) ?? [];
    check("list contains created parent", names.includes(`zz_pc_${STAMP}`), names.join(","));
    check("list contains seeded A + B", names.includes(parentA.username) && names.includes(parentB.username));
  }

  // ----- link/unlink --------------------------------------------------------------
  {
    const r = await json<{ ok?: boolean; error?: string }>(`/api/admin/parents/${parentA.id}/link`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    check("link student -> ok", r.status === 200 && r.body?.ok === true, `got ${r.status}`);

    const detail = await json<{ parent?: { parentProfile: { students: { user: { id: string } }[] } | null }; error?: string }>(
      `/api/admin/parents/${parentA.id}`,
      { headers: { Cookie: adminCookie } },
    );
    const kids = detail.body?.parent?.parentProfile?.students ?? [];
    check("parent A shows the child", kids.some((k) => k.user.id === studentId), JSON.stringify(kids.length));
  }
  {
    const r = await json<{ error?: string; needsReplace?: boolean }>(`/api/admin/parents/${parentB.id}/link`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    check("steal without replace -> 409 + needsReplace", r.status === 409 && r.body?.needsReplace === true, `got ${r.status}`);
  }
  {
    const r = await json<{ ok?: boolean }>(`/api/admin/parents/${parentB.id}/link`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, replace: true }),
    });
    check("move with replace -> ok", r.status === 200 && r.body?.ok === true, `got ${r.status}`);

    const profileA = await prisma.parentProfile.findUnique({ where: { userId: parentA.id }, select: { id: true } });
    const profileB = await prisma.parentProfile.findUnique({ where: { userId: parentB.id }, select: { id: true } });
    const [a, b] = await Promise.all([
      prisma.studentProfile.findFirst({ where: { parentUserId: profileA!.id }, select: { id: true } }),
      prisma.studentProfile.findFirst({ where: { parentUserId: profileB!.id }, select: { id: true } }),
    ]);
    check("child now on B only", !a && !!b, `a:${!!a} b:${!!b}`);
  }
  {
    const r = await json<{ ok?: boolean }>(`/api/admin/parents/${parentA.id}/unlink`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    check("unlink from non-owner -> 409", r.status === 409, `got ${r.status}`);

    const ok = await json<{ ok?: boolean }>(`/api/admin/parents/${parentB.id}/unlink`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    check("unlink from owner -> ok", ok.status === 200 && ok.body?.ok === true, `got ${ok.status}`);
  }

  // ----- patch: rename / phone / password / status ---------------------------------
  {
    const r = await json<{ error?: string; parent?: { username: string; phone: string | null; parentProfile: { fullName: string | null } } }>(
      `/api/admin/parents/${parentA.id}`,
      {
        method: "PATCH",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Parent A Renamed", phone: "+92 322 5555555" }),
      },
    );
    check("patch rename+phone -> 200", r.status === 200, `got ${r.status}`);
    check(
      "patch applied",
      r.body?.parent?.parentProfile?.fullName === "Parent A Renamed" && r.body?.parent?.phone === "+92 322 5555555",
    );

    const loginOld = await json<{ step?: string; redirect?: string; error?: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "password", identifier: parentA.username, password: PASSWORD }),
    });
    check("current password logs parent in", loginOld.status === 200 && loginOld.body?.step === "done" && loginOld.body?.redirect === "/parent");

    // Reset the password. A verified old hash and a verified new hash prove the
    // reset without firing a failed login (which trips the progressive lockout
    // and would spuriously park the very next legitimate login attempt).
    const beforeReset = await prisma.user.findUnique({ where: { id: parentA.id }, select: { passwordHash: true } });
    check("old hash active pre-reset", !!beforeReset && (await verifyPassword(PASSWORD, beforeReset.passwordHash)));

    const reset = await json(`/api/admin/parents/${parentA.id}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "New-Parent-Pass!" }),
    });
    check("password reset -> 200", reset.status === 200, `got ${reset.status}`);

    const afterReset = await prisma.user.findUnique({ where: { id: parentA.id }, select: { passwordHash: true } });
    check(
      "old hash dead, new hash live",
      !!afterReset &&
        (await verifyPassword("New-Parent-Pass!", afterReset.passwordHash)) &&
        !(await verifyPassword(PASSWORD, afterReset.passwordHash)),
    );

    const loginNew = await json<{ step?: string; redirect?: string; error?: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "password", identifier: parentA.username, password: "New-Parent-Pass!" }),
    });
    check("new password logs parent in to /parent", loginNew.status === 200 && loginNew.body?.step === "done" && loginNew.body?.redirect === "/parent");
  }

  {
    const r = await json(`/api/admin/parents/${parentB.id}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SUSPENDED" }),
    });
    check("suspend parent -> 200", r.status === 200, `got ${r.status}`);

    const login = await json<{ error?: string }>("/api/auth/login", {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "password", identifier: parentB.username, password: PASSWORD }),
    });
    check("suspended parent login refused", login.status === 403 && /suspended/i.test(login.body?.error ?? ""), `got ${login.status}`);

    await json(`/api/admin/parents/${parentB.id}`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
  }

  // ----- role guards ------------------------------------------------------------
  {
    const parentInfo = await createSession({ id: parentA.id, role: "PARENT" }, { userAgent: "parent-panels-test" });
    const parentCookie = `${SESSION_COOKIE}=${parentInfo.token}`;

    const adminPage = await getPage("/admin", parentCookie);
    check("parent on /admin -> 307 away", adminPage.status === 307, `got ${adminPage.status}`);

    const dashPage = await getPage("/dashboard", parentCookie);
    check("parent on /dashboard -> 307 away", dashPage.status === 307, `got ${dashPage.status}`);

    const adminApi = await fetch(`${BASE}/api/admin/parents`, { headers: { Cookie: parentCookie } });
    check("parent calling admin api -> 403", adminApi.status === 403, `got ${adminApi.status}`);

    const linkAsParent = await fetch(`${BASE}/api/admin/parents/${parentA.id}/link`, {
      method: "POST",
      headers: { Cookie: parentCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    check("parent linking via admin api -> 403", linkAsParent.status === 403, `got ${linkAsParent.status}`);
  }

  // ----- parent panel --------------------------------------------------------------
  // Link the child to parent A for panel access.
  await json(`/api/admin/parents/${parentA.id}/link`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ studentId }),
  });
  const parentInfo = await createSession({ id: parentA.id, role: "PARENT" }, { userAgent: "parent-panels-test" });
  const parentCookie = `${SESSION_COOKIE}=${parentInfo.token}`;

  const logBefore = await prisma.activityLog.count({
    where: { userId: parentA.id, type: "PARENT_LOGIN" },
  });
  const pwLogin = await json<{ step?: string; redirect?: string }>("/api/auth/login", {
    method: "POST",
    headers: { Cookie: parentCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "password", identifier: parentA.username, password: "New-Parent-Pass!" }),
  });
  const logAfter = await prisma.activityLog.count({
    where: { userId: parentA.id, type: "PARENT_LOGIN" },
  });
  check("panel login redirects /parent", pwLogin.status === 200 && pwLogin.body?.step === "done" && pwLogin.body?.redirect === "/parent");
  check("panel login records PARENT_LOGIN", logAfter >= logBefore + 1, `${logBefore} -> ${logAfter}`);

  {
    const home = await getPage("/parent", parentCookie);
    check("parent home -> 200", home.status === 200, `got ${home.status}`);
    const clean = home.text.replace(/<!-- -->/g, "");
    check("home shows child name", clean.includes("Parent Test Child"), clean.slice(0, 60));
    check("home shows child fee stats header", clean.includes("Fees") || clean.includes("Paid"));

    const childPage = await getPage(`/parent/children/${studentId}`, parentCookie);
    check("child page -> 200", childPage.status === 200, `got ${childPage.status}`);
    const cClean = childPage.text.replace(/<!-- -->/g, "");
    check("child page shows results section", cClean.includes("Results"));
    check("child page shows fee section", cClean.includes("Fees"));
    check("child page shows activity section", cClean.includes("Recent activity"));

    const strangerPage = await getPage("/parent/children/zyvhwxyzzy1aj0oa7d5ff1234", parentCookie);
    check("stranger child id -> 404", strangerPage.status === 404, `got ${strangerPage.status}`);

    const fees = await getPage("/parent/fees", parentCookie);
    check("fees page -> 200", fees.status === 200 && fees.text.replace(/<!-- -->/g, "").includes("Parent Test Child"), `got ${fees.status}`);

    const act = await getPage("/parent/activity", parentCookie);
    check("activity page -> 200", act.status === 200, `got ${act.status}`);

    const plan = await getPage("/parent/plan", parentCookie);
    const planClean = plan.text.replace(/<!-- -->/g, "");
    check("plan page -> 200", plan.status === 200, `got ${plan.status}`);
    check("plan page shows child", planClean.includes("Parent Test Child"), planClean.slice(0, 60));

    const pay = await getPage("/parent/payments", parentCookie);
    const payClean = pay.text.replace(/<!-- -->/g, "");
    check("payments page -> 200", pay.status === 200, `got ${pay.status}`);
    check(
      "payments page shows child + fee records",
      payClean.includes("Parent Test Child") && payClean.includes("fee records"),
      payClean.slice(0, 60),
    );

    const prog = await getPage("/parent/progress", parentCookie);
    const progClean = prog.text.replace(/<!-- -->/g, "");
    check("progress page -> 200", prog.status === 200, `got ${prog.status}`);
    check(
      "progress page shows child + performance + tracking",
      progClean.includes("Parent Test Child") &&
        progClean.includes("Performance by subject") &&
        progClean.includes("Work tracking"),
    );
  }

  // ----- admin parents page HTML ---------------------------------------------------
  {
    const page = await getPage("/admin/parents", adminCookie);
    check("admin parents page -> 200", page.status === 200, `got ${page.status}`);
    const clean = page.text.replace(/<!-- -->/g, "");
    check("page shows heading", clean.includes("Parents"));
    check("page shows created parent", clean.includes("Created Parent"));
    check("page shows linked child card", clean.includes("Parent Test Child"));
    check("page has link control", clean.includes("Link student"));
  }

  // ----- delete-with-children 409, then delete cleanly ------------------------------
  {
    const r = await json<{ error?: string }>(`/api/admin/parents/${parentA.id}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    check("delete parent with children -> 409", r.status === 409, `got ${r.status} ${r.body?.error ?? ""}`);
  }
  {
    await prisma.studentProfile.update({ where: { userId: studentId }, data: { parentUserId: null } });
    const r = await json<{ ok?: boolean }>(`/api/admin/parents/${parentA.id}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    check("delete parent after unlink -> ok", r.status === 200 && r.body?.ok === true, `got ${r.status}`);
    const gone = await prisma.user.findUnique({ where: { id: parentA.id } });
    check("parent row gone", !gone);
  }

  // ----- student profile + parent self-registration + admin reveal -------------------
  {
    const studentInfo = await createSession({ id: studentId, role: "STUDENT" }, { userAgent: "parent-panels-test" });
    const studentCookie = `${SESSION_COOKIE}=${studentInfo.token}`;

    const prof = await getPage("/dashboard/profile", studentCookie);
    const pClean = prof.text.replace(/<!-- -->/g, "");
    check("student profile page -> 200", prof.status === 200, `got ${prof.status}`);
    check("student profile shows personal details", pClean.includes("Personal details"));
    check("student profile shows parent access", pClean.includes("Parent access"));

    const patch = await json<{ ok?: boolean; error?: string }>("/api/student/profile", {
      method: "PATCH",
      headers: { Cookie: studentCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+92 300 9999999",
        schoolName: "ZZ School",
        stream: classRoom.hasStreams ? "SCIENCE" : null,
      }),
    });
    check("student self-edit profile -> 200", patch.status === 200, `got ${patch.status} ${patch.body?.error ?? ""}`);
    const afterProfile = await prisma.user.findUnique({ where: { id: studentId }, select: { phone: true } });
    check("self-edit phone persisted", afterProfile?.phone === "+92 300 9999999", afterProfile?.phone ?? "null");

    const st = await json<{ linked?: boolean; suggestedUsername?: string }>("/api/student/parent", {
      headers: { Cookie: studentCookie },
    });
    check("parent status -> not linked", st.status === 200 && st.body?.linked === false, `got ${st.status}`);
    check("parent status suggests a username", !!st.body?.suggestedUsername);

    const regUser = `zz_reg_${STAMP}`;
    await prisma.user.deleteMany({ where: { username: regUser } });
    const reg = await json<{ ok?: boolean; username?: string; error?: string }>("/api/student/parent", {
      method: "POST",
      headers: { Cookie: studentCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ username: regUser, password: PASSWORD, fullName: "Registered Parent" }),
    });
    check("student registers parent -> 201", reg.status === 201 && reg.body?.ok === true, `got ${reg.status} ${reg.body?.error ?? ""}`);

    const createdParent = await prisma.user.findUnique({ where: { username: regUser }, select: { id: true } });
    undo.unshift(() => prisma.user.deleteMany({ where: { username: regUser } }));
    undo.unshift(async () => {
      await prisma.activityLog.deleteMany({
        where: {
          type: "ADMIN_MANAGE_PARENT",
          OR: [
            { metadata: { path: ["targetId"], equals: createdParent?.id ?? "" } },
            { metadata: { path: ["targetId"], equals: studentId } },
          ],
        },
      });
    });
    check("registered parent row exists", !!createdParent);

    if (createdParent) {
      const pp = await prisma.parentProfile.findUnique({
        where: { userId: createdParent.id },
        select: { usernameLocked: true },
      });
      check("registered parent username is locked", pp?.usernameLocked === true);

      const secret = await json<{ password?: string | null }>(`/api/admin/secret?userId=${createdParent.id}`, {
        headers: { Cookie: adminCookie },
      });
      check(
        "admin reveals the parent password",
        secret.status === 200 && secret.body?.password === PASSWORD,
        `got ${secret.status} ${secret.body?.password ?? "null"}`,
      );
    }

    const studentSecret = await json<{ password?: string | null }>(`/api/admin/secret?userId=${studentId}`, {
      headers: { Cookie: adminCookie },
    });
    check("admin secret endpoint answers for a student", studentSecret.status === 200, `got ${studentSecret.status}`);

    const linkedStatus = await json<{ linked?: boolean }>("/api/student/parent", { headers: { Cookie: studentCookie } });
    check("parent status now linked", linkedStatus.status === 200 && linkedStatus.body?.linked === true);
  }

  console.log(failures ? `\n${checks - failures}/${checks} passed, ${failures} FAILED` : `\n${checks}/${checks} passed`);
}

main()
  .catch((err) => {
    console.error(err);
    failures++;
  })
  .finally(async () => {
    for (const fn of undo) await fn().catch(() => null);
    await prisma.$disconnect();
    process.exit(failures ? 1 : 0);
  });