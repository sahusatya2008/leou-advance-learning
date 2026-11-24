/**
 * Guards the practical workspace terminal against output replay.
 *
 * The runner hands back the *whole* session buffer on every poll. The panel
 * used to append that buffer verbatim, so an interactive session (python -i,
 * which never exits) printed the same lines over and over — "output running in
 * a loop with no reason" — and a mode switch could leave that poller running
 * with no Stop button left to kill it. No API test can see that; only the
 * rendered transcript over time.
 *
 * What it checks against a running server:
 *   - a live session's transcript stays byte-identical across poll ticks,
 *   - each marker line appears exactly once,
 *   - stopping really stops: the pane keeps still afterwards,
 *   - one-shot runs print once and then stay still,
 *   - switching to One-shot while a session is live stops its poller,
 *   - no console errors while running.
 *
 * Needs Chrome/Chromium and a student entitled to a published set. Any attempt
 * created during the run is removed afterwards.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-practical-output.ts [assignmentId]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";
import { launch, type Browser } from "./browser";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
// setCookie() pins the cookie to `localhost`, so a BASE of 127.0.0.1 would load
// a page that never sees the session and redirect to the login screen.
const PAGE = BASE.replace("127.0.0.1", "localhost");

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(fn: () => Promise<T | null | undefined | false>, ms = 20000): Promise<T | null> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await sleep(400);
  }
  return null;
}

/** Text of the terminal pane only — nothing else on the page. */
async function term(b: Browser): Promise<string> {
  return (
    (await b.eval<string>(
      `(function () {
         var el = document.querySelector('[class~="h-56"]');
         return el ? el.innerText : '';
       })()`,
    )) ?? ""
  );
}

const count = (hay: string, needle: string) => hay.split(needle).length - 1;

/** Find a button by its visible label and press it like a human would. */
async function press(b: Browser, label: string): Promise<boolean> {
  const pos = await b.eval<{ x: number; y: number }>(
    `(function () {
       var els = Array.prototype.slice.call(document.querySelectorAll('button'));
       var el = els.filter(function (b) { return (b.innerText || '').trim() === ${JSON.stringify(label)}; })[0];
       if (!el || el.disabled) return { x: -1, y: -1 };
       var r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
     })()`,
  );
  if (!pos || pos.x < 0) return false;
  await b.mouseClick(pos.x, pos.y);
  return true;
}

async function main() {
  const explicit = process.argv[2];
  const assignment = await prisma.practicalAssignment.findFirst({
    where: explicit ? { id: explicit } : { status: "PUBLISHED", questions: { some: {} } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, batchId: true },
  });
  if (!assignment) {
    console.log("no published practical set with questions - nothing to check");
    return;
  }

  const members = await prisma.batchStudent.findMany({
    where: { batchId: assignment.batchId },
    take: 5,
    select: { student: { select: { id: true, userId: true, user: { select: { username: true } } } } },
  });
  if (!members.length) throw new Error(`no students in batch ${assignment.batchId}`);

  console.log(`\npractical output (${BASE})`);
  console.log(`  set      ${assignment.title} (${assignment.id})`);

  let token = "";
  let studentId = "";
  const undo: (() => Promise<void>)[] = [];
  let browser: Browser | null = null;

  try {
    for (const member of members) {
      const session = await createSession({ id: member.student.userId, role: "STUDENT" }, { userAgent: "output-test" });
      undo.push(() => revokeSession(session.sid).catch(() => undefined));
      const res = await fetch(`${BASE}/api/student/practicals/${assignment.id}`, {
        headers: { Cookie: `${SESSION_COOKIE}=${session.token}` },
      });
      if (res.ok) {
        token = session.token;
        studentId = member.student.id;
        console.log(`  student  ${member.student.user.username}`);
        break;
      }
    }
    if (!token) throw new Error("no student in that batch can open the set");

    const startedAt = new Date();
    const attemptsBefore = new Set(
      (
        await prisma.practicalAttempt.findMany({
          where: { assignmentId: assignment.id, studentId },
          select: { id: true },
        })
      ).map((a) => a.id),
    );
    undo.push(async () => {
      const stale = await prisma.practicalAttempt.findMany({
        where: { assignmentId: assignment.id, studentId, startedAt: { gte: startedAt } },
        select: { id: true },
      });
      for (const a of stale) {
        if (attemptsBefore.has(a.id)) continue; // someone else's live work
        await prisma.practicalEvent.deleteMany({ where: { attemptId: a.id } }).catch(() => undefined);
        await prisma.practicalAttempt.delete({ where: { id: a.id } }).catch(() => undefined);
      }
    });

    browser = await launch({ width: 1440, height: 1000 });
    await browser.setCookie(SESSION_COOKIE, token);
    await browser.goto(`${PAGE}/dashboard/practicals/${assignment.id}`);

    const ready = await until(async () => {
      const t = await term(browser!);
      return t.length > 0 || null;
    });
    check("terminal pane renders", !!ready, "no terminal pane on the page");

    const editor = await until(async () =>
      browser!.eval<boolean>(`document.querySelectorAll('.monaco-editor').length > 0`),
    );
    check("editor mounts", !!editor, "no .monaco-editor");

    // ---------------------------------------------------- live session
    const started = await until(async () => (await press(browser!, "Start")) || null);
    check("Start pressed", !!started, "no Start button");

    const readyLine = await until(async () => (await term(browser!)).includes("session ready"));
    check("session became ready", !!readyLine, "terminal never showed 'session ready'");

    // The replay bug only shows over time: wait for the startup output to
    // settle, then sample the transcript across several poll ticks while the
    // session is idle.
    await sleep(3000);
    const t1 = await term(browser);
    await sleep(4200); // ~4 polls at 900ms
    const t2 = await term(browser);
    check(
      "session transcript does not grow while idle",
      t2 === t1,
      `+${t2.length - t1.length} chars | t1 tail=${JSON.stringify(t1.slice(-80))} t2 tail=${JSON.stringify(t2.slice(-80))}`,
    );
    check("markers appear exactly once", count(t2, "session ready") === 1, `×${count(t2, "session ready")}`);

    // ---------------------------------------------------------- stop
    const stopped = await until(async () => (await press(browser!, "Stop")) || null);
    check("Stop pressed", !!stopped, "no Stop button");
    const stoppedLine = await until(async () => (await term(browser!)).includes("session stopped"));
    check("session stopped", !!stoppedLine);

    await sleep(1200);
    const t3 = await term(browser);
    await sleep(3000);
    const t4 = await term(browser);
    check("no poller left after Stop", t3 === t4, `+${t4.length - t3.length} chars after stop`);

    // ------------------------------------------------------- one-shot
    await press(browser, "One-shot");
    await sleep(300);
    const ran = await until(async () => (await press(browser!, "Run")) || null);
    check("Run pressed", !!ran, "no Run button");

    const exited = await until(async () => (await term(browser!)).includes("exit "), 30000);
    check("one-shot reported an exit", !!exited, "no 'exit …' line");

    await sleep(1500);
    const t5 = await term(browser);
    await sleep(3000);
    const t6 = await term(browser);
    check("one-shot output does not replay", t5 === t6, `+${t6.length - t5.length} chars over 3s`);
    check("run marker appears once", count(t6, "$ run") === 1, `×${count(t6, "$ run")}`);

    // ------------------------- switching mode mid-session kills its poller
    await press(browser, "Session");
    await sleep(300);
    const readyBefore = count(await term(browser), "session ready");
    const restarted = await until(async () => (await press(browser!, "Start")) || null);
    check("second Start pressed", !!restarted, "no Start button after mode switch");
    const ready2 = await until(
      async () => count(await term(browser!), "session ready") > readyBefore,
      10000,
    );
    check("second session became ready", !!ready2, "terminal never showed a new 'session ready'");
    const stopsBefore = count(await term(browser), "session stopped");
    const switched = await press(browser, "One-shot"); // no Stop button in this mode — it must stop itself
    check("One-shot button pressed", !!switched, "button not found or disabled");
    const selfStopped = await until(
      async () => count(await term(browser!), "session stopped") > stopsBefore,
      15000,
    );
    check("mode switch stops the live session", !!selfStopped, "'session stopped' never appeared");

    await sleep(1500);
    const t7 = await term(browser);
    await sleep(3000);
    const t8 = await term(browser);
    check("no orphaned poller after mode switch", t7 === t8, `+${t8.length - t7.length} chars`);

    const errors = browser.consoleMessages().filter((m) => m.type === "error" || m.type === "assert");
    check("no console errors while running", errors.length === 0, errors.map((e) => e.text.slice(0, 160)).join(" | "));

    await browser.close();
    browser = null;
  } finally {
    if (browser) await browser.close();
    for (const fn of undo.reverse()) await fn().catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
