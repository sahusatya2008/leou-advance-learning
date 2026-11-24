/**
 * Browser check for the practical room's block layout: the while-loop sheet and
 * the for-loop sheet must be separate, clearly labelled sections, each numbered
 * from 1, each with its own progress counter, and collapsing one must not touch
 * the other. The panel must say which block the open question belongs to.
 *
 * Read-only: it opens the real page as a real student, clicks around, and leaves
 * no attempt, code or toggle behind (collapse is client state only).
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-practical-blocks-ui.ts [assignmentId]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";
import { launch } from "./browser";
import { SEED_QUESTIONS as FOR_SEED } from "./data/practicalForLoopQuestions";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
// setCookie() pins the cookie to `localhost`, so a BASE of 127.0.0.1 would load
// a page that never sees the session and bounce to the login screen.
const PAGE = BASE.replace("127.0.0.1", "localhost");
const ASSIGNMENT = process.argv[2] ?? "cmuv2egn4009m2spj5d0gxyhx";
const USERNAME = process.env.STUDENT ?? "rolex";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(fn: () => Promise<T | null | undefined | false>, ms = 20_000): Promise<T | null> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await sleep(400);
  }
  return null;
}

/** Runs in the page: one entry per block header, with its visible question rows. */
const READ_BLOCKS = `(() => {
  const aside = [...document.querySelectorAll('aside')].find(
    (a) => a.textContent.includes('While loop') && a.textContent.includes('For loop')
  );
  if (!aside) return null;
  return [...aside.querySelectorAll('button[aria-expanded]')].map((header) => {
    const wrap = header.parentElement;
    const rows = [...wrap.querySelectorAll('button:not([aria-expanded])')];
    return {
      header: header.textContent.replace(/\\s+/g, ' ').trim(),
      expanded: header.getAttribute('aria-expanded'),
      rows: rows.length,
      firstRow: rows[0] ? rows[0].textContent.replace(/\\s+/g, ' ').trim().slice(0, 90) : '',
      lastRow: rows.length ? rows[rows.length - 1].textContent.replace(/\\s+/g, ' ').trim().slice(0, 90) : '',
      stars: wrap.querySelectorAll('svg.lucide-star').length,
      done: wrap.querySelectorAll('svg.lucide-circle-check').length,
    };
  });
})()`;

/** Runs in the page: the question panel's own header (block badge + stem). */
const READ_PANEL = `(() => {
  const section = [...document.querySelectorAll('section')].find(
    (s) => /Mark done|Reopen/.test(s.textContent)
  );
  if (!section) return null;
  const badges = [...section.querySelectorAll('div.inline-flex')]
    .map((b) => b.textContent.replace(/\\s+/g, ' ').trim())
    .filter(Boolean);
  const stemEl = section.querySelector('div.max-w-2xl');
  const stem = stemEl ? stemEl.textContent.replace(/\\s+/g, ' ').trim() : '';
  return { badges, stem: stem.slice(0, 90), text: section.textContent.slice(0, 400) };
})()`;

type BlockView = { header: string; expanded: string; rows: number; firstRow: string; lastRow: string; stars: number; done: number };
type PanelView = { badges: string[]; stem: string; text: string } | null;

async function main() {
  const user = await prisma.user.findUnique({ where: { username: USERNAME }, select: { id: true } });
  if (!user) throw new Error(`no user named ${USERNAME}`);
  // Counts are derived, never typed in: the for sheet's own length and starred
  // count, and whatever the set holds beyond it as the while block. Adding a
  // question to either sheet then shows up here instead of as a stale 35.
  const FOR_QUESTIONS = FOR_SEED.length;
  const FOR_STARS = FOR_SEED.filter((q) => q.important).length;
  const total = await prisma.practicalAssignmentQuestion.count({ where: { assignmentId: ASSIGNMENT } });
  const WHILE_QUESTIONS = total - FOR_QUESTIONS;
  const session = await createSession({ id: user.id, role: "STUDENT" }, { userAgent: "blocks-ui-test" });
  let browser: Awaited<ReturnType<typeof launch>> | null = null;

  try {
    browser = await launch({ width: 1440, height: 1000 });
    await browser.setCookie(SESSION_COOKIE, session.token);
    await browser.goto(`${PAGE}/dashboard/practicals/${ASSIGNMENT}`);

    const ready = await until(async () => {
      const blocks = await browser!.eval<BlockView[] | null>(READ_BLOCKS);
      return Array.isArray(blocks) && blocks.length >= 2 ? blocks : null;
    });
    if (!ready) throw new Error("the two block sections never rendered");
    console.log("\nblock layout");

    const whileBlock = ready.find((b) => b.header.startsWith("While loop"));
    const forBlock = ready.find((b) => b.header.startsWith("For loop"));
    check("a While loop section exists", Boolean(whileBlock), ready.map((b) => b.header).join(" | "));
    check("a For loop section exists", Boolean(forBlock), ready.map((b) => b.header).join(" | "));
    check(
      "they are the only two sections",
      ready.length === 2,
      `sections: ${ready.map((b) => b.header.split(" ")[0]).join(", ")}`,
    );
    check(`the While loop section lists its ${WHILE_QUESTIONS} questions`, whileBlock?.rows === WHILE_QUESTIONS, `got ${whileBlock?.rows}`);
    check(`the For loop section lists its ${FOR_QUESTIONS} questions`, forBlock?.rows === FOR_QUESTIONS, `got ${forBlock?.rows}`);
    check(
      "each section has its own done counter",
      Boolean(whileBlock?.header.match(new RegExp(`\\d+ ?/ ?${WHILE_QUESTIONS}`))) &&
        Boolean(forBlock?.header.match(new RegExp(`\\d+ ?/ ?${FOR_QUESTIONS}`))),
      `${whileBlock?.header} | ${forBlock?.header}`,
    );
    check("numbering restarts at 1 in each block", Boolean(whileBlock?.firstRow.startsWith("1.")) && Boolean(forBlock?.firstRow.startsWith("1.")), `${whileBlock?.firstRow} | ${forBlock?.firstRow}`);
    check(
      "the while sheet's last question stays in the while block",
      Boolean(whileBlock?.lastRow) && !/for loop/i.test(whileBlock?.lastRow ?? ""),
      whileBlock?.lastRow,
    );
    check(
      "the for block starts with the for-loop sheet's Q1",
      Boolean(forBlock?.firstRow) && /first 10 even numbers/i.test(forBlock?.firstRow ?? ""),
      forBlock?.firstRow,
    );
    check(
      "the for block shows the starred questions",
      (forBlock?.stars ?? 0) === FOR_STARS,
      `${forBlock?.stars} stars`,
    );

    console.log("\nselection");
    // Third question of the for block: click it and read the panel back.
    const clicked = await browser.eval<boolean>(`(() => {
      const aside = [...document.querySelectorAll('aside')].find(
        (a) => a.textContent.includes('While loop') && a.textContent.includes('For loop')
      );
      const header = [...aside.querySelectorAll('button[aria-expanded]')].find((h) => h.textContent.startsWith('For loop'));
      const rows = [...header.parentElement.querySelectorAll('button:not([aria-expanded])')];
      if (!rows[2]) return false;
      rows[2].click();
      return true;
    })()`);
    check("a for-loop question can be opened", clicked);

    const panel = await until(async () => {
      const p = await browser!.eval<PanelView>(READ_PANEL);
      return p && p.badges.includes("For loop") ? p : null;
    });
    check("the panel is labelled with its block", Boolean(panel), "no For loop badge in the panel");
    check(
      "the panel shows the clicked question, not the first one",
      Boolean(panel?.stem) && /10, 20, 30/.test(panel?.stem ?? ""),
      panel?.stem,
    );
    const marked = await browser.eval<boolean>(`(() => {
      const current = document.querySelector('aside button[aria-current="true"]');
      return Boolean(current && current.textContent.trim().startsWith('3.'));
    })()`);
    check("the sidebar marks the open question", marked);

    // The star-pattern questions carry a picture inside a fenced block. It has
    // to reach the page in a monospace block with its spaces intact, otherwise
    // the student is asked to reproduce a shape they were never shown.
    console.log("\nstar patterns");
    const patternSeed = FOR_SEED[FOR_SEED.length - 1];
    const patternText = patternSeed.testCases?.[0]?.expected ?? "";
    const clickedLast = await browser.eval<boolean>(`(() => {
      const aside = [...document.querySelectorAll('aside')].find(
        (a) => a.textContent.includes('While loop') && a.textContent.includes('For loop')
      );
      if (!aside) return false;
      const header = [...aside.querySelectorAll('button[aria-expanded]')].find((h) => h.textContent.startsWith('For loop'));
      if (!header) return false;
      const rows = [...header.parentElement.querySelectorAll('button:not([aria-expanded])')];
      if (!rows.length) return false;
      rows[rows.length - 1].click();
      return true;
    })()`);
    check("the last for-loop question opens", clickedLast);
    const picture = await until(async () => {
      const text = await browser!.eval<string | null>(
        `(() => { const p = document.querySelector('section pre[data-stem="code"]'); return p ? p.textContent : null; })()`,
      );
      return text && text.includes("*") ? text : null;
    });
    check("the pattern is shown in a monospace block", Boolean(picture), "no stem <pre> rendered");
    check(
      "the picture keeps its exact spacing",
      picture === patternText,
      JSON.stringify(picture ?? "").slice(0, 140),
    );
    const asideText = await browser.eval<string>(`(() => { const a = document.querySelector('aside'); return a ? a.textContent : ''; })()`);
    check("the question list shows no fence markers", !asideText.includes("\u0060\u0060\u0060"), "a fence leaked into the list");

    console.log("\ncollapsing");
    await browser.eval<null>(`(() => {
      const aside = [...document.querySelectorAll('aside')].find(
        (a) => a.textContent.includes('While loop') && a.textContent.includes('For loop')
      );
      const header = [...aside.querySelectorAll('button[aria-expanded]')].find((h) => h.textContent.startsWith('While loop'));
      header.click();
      return null;
    })()`);
    await sleep(300);
    const afterCollapse = await browser.eval<BlockView[]>(READ_BLOCKS);
    const whileAfter = afterCollapse.find((b) => b.header.startsWith("While loop"));
    const forAfter = afterCollapse.find((b) => b.header.startsWith("For loop"));
    check("collapsing the while block hides its questions", whileAfter?.rows === 0, `got ${whileAfter?.rows}`);
    check("its header stays put", Boolean(whileAfter) && whileAfter?.expanded === "false", `expanded=${whileAfter?.expanded}`);
    check("the for block is untouched", forAfter?.rows === FOR_QUESTIONS, `got ${forAfter?.rows}`);

    await browser.eval<null>(`(() => {
      const aside = [...document.querySelectorAll('aside')].find(
        (a) => a.textContent.includes('While loop') && a.textContent.includes('For loop')
      );
      const header = [...aside.querySelectorAll('button[aria-expanded]')].find((h) => h.textContent.startsWith('While loop'));
      header.click();
      return null;
    })()`);
    await sleep(300);
    const restored = await browser.eval<BlockView[]>(READ_BLOCKS);
    check(
      `expanding it restores all ${WHILE_QUESTIONS}`,
      restored.find((b) => b.header.startsWith("While loop"))?.rows === WHILE_QUESTIONS,
      `got ${restored.find((b) => b.header.startsWith("While loop"))?.rows}`,
    );

    console.log("\nconsole");
    const errors = browser.consoleMessages().filter((m) => m.type === "error");
    check("no console errors", errors.length === 0, errors.slice(0, 2).map((e) => e.text).join(" | "));
    const failed = browser.failedRequests().filter((r) => !/analytics|favicon|_rsc=/.test(r.url));
    check("no failed requests", failed.length === 0, failed.slice(0, 2).map((f) => `${f.url} ${f.error}`).join(" | "));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await revokeSession(session.sid).catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log(`\n${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
