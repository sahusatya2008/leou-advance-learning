/**
 * Guards the one thing no API test can see: that the practical workspace
 * actually renders a working code editor.
 *
 * It exists because of a real regression - `@monaco-editor/react` fetches
 * Monaco from jsdelivr, our CSP only allows same-origin scripts, so the loader
 * was blocked and the code box was a permanent loading skeleton with no error
 * anywhere. Network and console are the only witnesses to that.
 *
 * What it checks against a running server:
 *   - the editor mounts (`.monaco-editor`, an instance, a cursor),
 *   - Monaco comes from our own origin, never a CDN,
 *   - no CSP / console errors, and monaco's workers are allowed to start,
 *   - the question's starter code is pre-filled,
 *   - keystrokes reach the model (a placeholder that never accepts input would
 *     pass every check above),
 *
 * Needs a Chrome/Chromium on the machine and a student entitled to a published
 * set. Any attempt created by the typing check is removed afterwards.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-practical-editor.ts [assignmentId]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";
import { launch } from "./browser";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
// setCookie() pins the cookie to `localhost`, so a BASE of 127.0.0.1 would load
// a page that never sees the session and redirect to the login screen.
const PAGE = BASE.replace("127.0.0.1", "localhost");
const MARKER = "ZEBRATYPING";

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

/** Poll the page until fn() is truthy, or give up. */
async function until<T>(fn: () => Promise<T | null | undefined | false>, ms = 20000): Promise<T | null> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await sleep(400);
  }
  return null;
}

async function main() {
  const explicit = process.argv[2];
  const assignment = await prisma.practicalAssignment.findFirst({
    where: explicit ? { id: explicit } : { status: "PUBLISHED", questions: { some: {} } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      batchId: true,
      questions: {
        orderBy: { order: "asc" },
        take: 1,
        select: { question: { select: { starterCode: true, allowedLanguages: true } } },
      },
    },
  });
  if (!assignment) {
    console.log("no published practical set with questions - nothing to check");
    return;
  }

  // Whoever is entitled to that set. Fall back to any student in the batch and
  // let the API decide; an unentitled student fails the workspace check below
  // with a clear name rather than a mystery.
  const members = await prisma.batchStudent.findMany({
    where: { batchId: assignment.batchId },
    take: 5,
    select: { student: { select: { id: true, userId: true, user: { select: { username: true } } } } },
  });
  if (!members.length) throw new Error(`no students in batch ${assignment.batchId}`);

  const first = assignment.questions[0]?.question;
  const allowed = ((first?.allowedLanguages ?? []) as unknown as string[]) ?? [];
  const language = allowed[0] ?? "python";
  const starter = ((first?.starterCode ?? {}) as Record<string, string>)[language] ?? "";

  console.log(`\npractical editor (${BASE})`);
  console.log(`  set      ${assignment.title} (${assignment.id})`);

  let token = "";
  let studentId = "";
  const undo: (() => Promise<void>)[] = [];
  let browser: Awaited<ReturnType<typeof launch>> | null = null;

  try {
    for (const member of members) {
      const session = await createSession({ id: member.student.userId, role: "STUDENT" }, { userAgent: "editor-test" });
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

    const runStartedAt = new Date();
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
        where: { assignmentId: assignment.id, studentId, startedAt: { gte: runStartedAt } },
        select: { id: true, code: true },
      });
      for (const a of stale) {
        // A student working in another tab during the run must not be deleted:
        // only take back what this run wrote - an untouched starter, or the
        // marker we typed into it.
        if (attemptsBefore.has(a.id)) continue;
        const code = a.code ?? "";
        if (code !== starter && code.indexOf(MARKER) < 0) continue;
        await prisma.practicalEvent.deleteMany({ where: { attemptId: a.id } }).catch(() => undefined);
        await prisma.practicalAttempt.delete({ where: { id: a.id } }).catch(() => undefined);
      }
    });

    browser = await launch({ width: 1440, height: 1000 });
    await browser.setCookie(SESSION_COOKIE, token);
    await browser.goto(`${PAGE}/dashboard/practicals/${assignment.id}`);

    const mounted = await until(async () =>
      browser!.eval<boolean>(`document.querySelectorAll('.monaco-editor').length > 0`),
    );
    check("editor mounts", !!mounted, "no .monaco-editor appeared");

    const monacoReady = await until(async () => browser!.eval<boolean>(`typeof window.monaco === 'object'`));
    check("window.monaco is defined", !!monacoReady);

    const resources = await browser.eval<{ name: string; status: number }[]>(
      `performance.getEntriesByType('resource').map(function (r) { return { name: r.name, status: r.responseStatus }; })`,
    );
    const monacoResources = resources.filter((r) => /monaco|vs\//.test(r.name));
    check(
      "monaco served from our own origin",
      monacoResources.length > 0 && monacoResources.every((r) => r.name.startsWith(PAGE)),
      monacoResources
        .filter((r) => !r.name.startsWith(BASE))
        .map((r) => r.name)
        .join(", ") || "no monaco resources at all",
    );
    check(
      "monaco loader fetched",
      monacoResources.some((r) => r.name.includes("loader.js") && r.status === 200),
    );

    const state = await browser.eval<{
      instance: boolean;
      cursor: boolean;
      chars: number;
      sample: string;
      textareas: string[];
    }>(
      `(() => {
         if (typeof window.monaco !== 'object') return { instance: false, cursor: false, chars: -1, sample: '', textareas: [] };
         var m = window.monaco.editor.getModels ? window.monaco.editor.getModels()[0] : null;
         return {
           instance: !!(window.monaco && window.monaco.editor.getEditors && window.monaco.editor.getEditors().length),
           cursor: !!document.querySelector('.monaco-editor .cursor'),
           chars: m ? m.getValue().length : -1,
           sample: m ? m.getValue().slice(0, 80) : '',
           textareas: Array.prototype.map.call(
             document.querySelectorAll('.monaco-editor textarea'),
             function (t) { return t.className; }
           ),
         };
       })()`,
    );
    check("an editor instance exists", state.instance);
    check("a text cursor is rendered", state.cursor);
    if (starter) check("starter code is pre-filled", state.chars >= starter.trim().length, `model has ${state.chars} chars, starter ${starter.trim().length}`);
    else check("model has content", state.chars > 0, "empty model");

    // Keystrokes: monaco 0.56 keeps them in a hidden textarea classed
    // ime-text-area (it used to be inputarea). Focus it and type for real.
    // A question the student has already marked done opens read-only, which
    // swallows keystrokes without complaint. Walk the outline until the panel
    // offers "Reopen" instead, i.e. an editable question.
    for (let i = 0; i < 40; i++) {
      const done = await browser.eval<boolean>(
        `Array.prototype.some.call(document.querySelectorAll('button'), function (b) { return (b.innerText || '').trim() === 'Reopen'; })`,
      );
      if (!done) break;
      const moved = await browser.click(`aside button:nth-of-type(${i + 1})`);
      if (!moved) break;
      await sleep(600);
    }

    // Monaco arms itself on a pointer press: focus() alone leaves its hidden
    // textarea read-only, so keystrokes vanish. Click into the code like a human.
    const box = await browser.eval<{ x: number; y: number }>(
      `(function () {
         var el = document.querySelector('.monaco-editor .view-lines');
         if (!el) return { x: -1, y: -1 };
         var r = el.getBoundingClientRect();
         return { x: r.left + 12, y: r.top + 8 };
       })()`,
    );
    check("code area is on screen", box.x > 0 && box.y > 0, `box ${box.x},${box.y}`);
    await browser.mouseClick(box.x, box.y);
    await sleep(400);

    const before = await browser.eval<string>(
      `(function () { var m = window.monaco.editor.getModels()[0]; return m ? m.getValue() : ''; })()`,
    );
    await browser.typeText(MARKER);
    const after = await browser.eval<string>(
      `(function () { var m = window.monaco.editor.getModels()[0]; return m ? m.getValue() : ''; })()`,
    );
    check(
      "typing reaches the model",
      after !== before && after.indexOf(MARKER) >= 0,
      `before=${before.length} after=${after.length}`,
    );

    // Give the 1.5s autosave a moment, then look at the console: a CSP that
    // blocks monaco's blob workers or its script is what made the editor vanish.
    await sleep(2500);
    const errors = browser.consoleMessages().filter((m) => m.type === "error" || m.type === "assert");
    check("no console/CSP errors", errors.length === 0, errors.map((e) => e.text.slice(0, 160)).join(" | "));
    check(
      "monaco workers start (worker-src allows blob:)",
      !errors.some((e) => /Creating a worker/.test(e.text)) &&
        !browser.consoleMessages().some((m) => /Falling back to loading web worker code in main thread/.test(m.text)),
    );
    const cdn = browser.failedRequests().filter((f) => /jsdelivr|cdn\./.test(f.url));
    check("no CDN requests were made", cdn.length === 0, cdn.map((c) => `${c.url} ${c.error}`).join(", "));

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
