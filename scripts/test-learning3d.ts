/**
 * Verification for the student 3D learning section.
 *
 * Three layers, cheapest first:
 *   1. the entitlement gate, called directly for real users;
 *   2. the student API over HTTP (with and without a session);
 *   3. the real browser — canvas renders, controls redraw the model, the quick
 *      check records progress, and a non-eligible student is turned away.
 *
 * Read-only with respect to platform data: sessions are revoked afterwards and
 * progress is written only to the test browser's own localStorage.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-learning3d.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";
import { CONCEPTS, COURSE_ID } from "@/lib/learning3d/encodingCourse";
import { GOC_CONCEPTS, GOC_COURSE_ID } from "@/lib/learning3d/chemCourse";
import { HALO_COURSE_ID } from "@/lib/learning3d/haloCourse";
import { getLearningAccess, getLearningCatalogue, getLearningCourse, isHaloChapterTopic } from "@/services/learningService";
import { launch } from "./browser";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const PAGE = BASE.replace("127.0.0.1", "localhost");
const CLASS_11_ID = "cmue7ywg500015irw4sofszke";
const ELIGIBLE = ["rolex", "zeeshanalam"];

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

async function main() {
  // ---------- 1. the gate, directly ----------
  console.log("\nentitlement gate");
  for (const username of ELIGIBLE) {
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) {
      check(`${username} exists in the test database`, false);
      continue;
    }
    const access = await getLearningAccess(user.id);
    check(`${username} is allowed`, access.ok, access.ok ? "" : access.error);
    check(
      `${username} sees the Encoding course as playable`,
      access.ok && access.chapters.some((c) => c.id === COURSE_ID && c.available),
      access.ok ? JSON.stringify(access.chapters) : "",
    );
    if (access.ok) {
      const course = await getLearningCourse(user.id, COURSE_ID);
      check(`${username} can open the course (${CONCEPTS.length} lessons)`, course.ok && course.conceptCount === CONCEPTS.length);
      const other = await getLearningCourse(user.id, "not-a-course");
      check(`${username} cannot open an unknown course`, !other.ok && other.status === 404);
    }
  }

  const outsider = await prisma.user.findFirst({
    where: { role: "STUDENT", studentProfile: { classRoomId: { not: CLASS_11_ID } } },
    select: { id: true, username: true },
  });
  if (outsider) {
    const access = await getLearningAccess(outsider.id);
    check(`a non-Class-11 student (${outsider.username}) is denied`, !access.ok, access.ok ? "was allowed" : access.error);

    // GOC is deliberately free: it bypasses the Encoding entitlement entirely.
    const free = await getLearningCourse(outsider.id, GOC_COURSE_ID);
    check("GOC is open to a student without the Encoding entitlement", free.ok && free.conceptCount === GOC_CONCEPTS.length, free.ok ? "" : free.error);
    const locked = await getLearningCourse(outsider.id, HALO_COURSE_ID);
    check("Haloalkanes stays locked without the availed chapter", !locked.ok && locked.status === 403, locked.ok ? "was allowed" : locked.error);
    const catalogue = await getLearningCatalogue(outsider.id);
    check("catalogue always lists free GOC", catalogue.chapters.some((c) => c.id === GOC_COURSE_ID && c.available && c.free), JSON.stringify(catalogue.chapters.map((c) => c.id)));
    check("catalogue lists Haloalkanes as locked with a reason", catalogue.chapters.some((c) => c.id === HALO_COURSE_ID && !c.available && !!c.lockedReason));
    check("catalogue keeps the paid-entitlement flag false", catalogue.eligible === false, String(catalogue.eligible));
  } else {
    console.log("  skip no non-Class-11 student in the test database");
  }

  console.log("\nchemistry chapter matcher");
  const availedSpellings = [
    "Haloalkanes and Haloarenes",
    "HALOALKANES & HALOARENES",
    "haloalkanes & haloarenes",
    "haloarenes and haloalkanes",
    "Haloalkanes",
    "haloarens",
  ];
  check("accepts the availed chapter spellings", availedSpellings.every(isHaloChapterTopic));
  check("rejects unrelated chapters", !isHaloChapterTopic("Alkenes") && !isHaloChapterTopic("Alcohols") && !isHaloChapterTopic("Organic Chemistry"));

  // ---------- 2. HTTP + sessions ----------
  console.log("\nstudent API");
  const anon = await fetch(`${BASE}/api/student/learn`);
  check("anonymous request is 401", anon.status === 401, `status ${anon.status}`);

  const rolex = await prisma.user.findUnique({ where: { username: ELIGIBLE[0] }, select: { id: true } });
  if (!rolex) throw new Error("eligible test student missing");
  const session = await createSession({ id: rolex.id, role: "STUDENT" }, { userAgent: "learning3d-test" });
  const cookie = `${SESSION_COOKIE}=${session.token}`;
  try {
    const hub = await fetch(`${BASE}/api/student/learn`, { headers: { cookie }, cache: "no-store" });
    const hubBody = (await hub.json()) as { eligible?: boolean; chapters?: { id: string; available: boolean }[] };
    check("eligible student gets the catalogue", hub.status === 200 && hubBody.eligible === true, JSON.stringify(hubBody));
    check("catalogue marks Encoding as playable", Boolean(hubBody.chapters?.some((c) => c.id === COURSE_ID && c.available)));

    const detail = await fetch(`${BASE}/api/student/learn/${COURSE_ID}`, { headers: { cookie }, cache: "no-store" });
    const detailBody = (await detail.json()) as { course?: { conceptCount?: number } };
    check("eligible student can read the course detail", detail.status === 200 && detailBody.course?.conceptCount === CONCEPTS.length, JSON.stringify(detailBody));
  } finally {
    await revokeSession(session.token);
  }

  if (outsider) {
    const outSession = await createSession({ id: outsider.id, role: "STUDENT" }, { userAgent: "learning3d-test" });
    const outCookie = `${SESSION_COOKIE}=${outSession.token}`;
    try {
      const hub = await fetch(`${BASE}/api/student/learn`, { headers: { cookie: outCookie }, cache: "no-store" });
      const body = (await hub.json()) as { eligible?: boolean; chapters?: { id: string; available: boolean; free?: boolean }[] };
      check("non-eligible hub says not eligible", body.eligible === false, JSON.stringify(body));
      check("non-eligible hub still lists free GOC", Boolean(body.chapters?.some((c) => c.id === GOC_COURSE_ID && c.available && c.free)), JSON.stringify(body.chapters));
      const detail = await fetch(`${BASE}/api/student/learn/${COURSE_ID}`, { headers: { cookie: outCookie }, cache: "no-store" });
      check("non-eligible detail is 403", detail.status === 403, `status ${detail.status}`);
      const gocDetail = await fetch(`${BASE}/api/student/learn/${GOC_COURSE_ID}`, { headers: { cookie: outCookie }, cache: "no-store" });
      const gocBody = (await gocDetail.json()) as { course?: { conceptCount?: number } };
      check("free GOC detail is 200 for a non-entitled student", gocDetail.status === 200 && gocBody.course?.conceptCount === GOC_CONCEPTS.length, JSON.stringify(gocBody).slice(0, 160));
      const haloDetail = await fetch(`${BASE}/api/student/learn/${HALO_COURSE_ID}`, { headers: { cookie: outCookie }, cache: "no-store" });
      check("gated Haloalkanes detail is 403", haloDetail.status === 403, `status ${haloDetail.status}`);
      const page = await fetch(`${PAGE}/dashboard/learn/${COURSE_ID}`, { headers: { cookie: outCookie }, cache: "no-store" });
      const html = await page.text();
      // The guarded layout may redirect a lapsed student to onboarding first;
      // either way the lesson body must never be served to them.
      check(
        "non-eligible course page never serves the lessons",
        !html.includes(`Concept 1 of ${CONCEPTS.length}`) && !html.includes("Bits — the alphabet"),
        `page started: ${html.slice(0, 120).replace(/\s+/g, " ")}`,
      );
    } finally {
      await revokeSession(outSession.token);
    }
  }

  // ---------- 3. the real browser ----------
  console.log("\nbrowser");
  const session2 = await createSession({ id: rolex.id, role: "STUDENT" }, { userAgent: "learning3d-browser-test" });
  let browser: Awaited<ReturnType<typeof launch>> | null = null;
  try {
    browser = await launch({ width: 1440, height: 1000 });
    await browser.setCookie(SESSION_COOKIE, session2.token);

    await browser.goto(`${PAGE}/dashboard/learn`);
    const hubReady = await until(async () => {
      const text = await browser!.text();
      return text.includes("3D Learning") && text.includes("Start learning") ? true : null;
    });
    check("hub lists the playable course", Boolean(hubReady));

    await browser.goto(`${PAGE}/dashboard/learn/${COURSE_ID}`);
    const stage = await until(async () => {
      const view = await browser!.eval<{ canvas: boolean; labeled: boolean; concepts: number; readout: string }>(`(() => {
        const canvas = document.querySelector('canvas');
        const rail = [...document.querySelectorAll('button[aria-current="step"]')].length
          + [...document.querySelectorAll('aside button')].filter((b) => /min$/.test(b.textContent.trim())).length;
        const body = document.body.innerText;
        return {
          canvas: !!canvas && canvas.width > 0 && canvas.height > 0,
          labeled: !!canvas && (canvas.getAttribute('aria-label') || '').includes('3D model'),
          concepts: rail,
          readout: (body.match(/byte: [01]{8}/) || [''])[0],
        };
      })()`);
      return view?.canvas && view.labeled && view.concepts >= 15 && view.readout ? view : null;
    });
    check("3D canvas renders with a model", Boolean(stage?.canvas && stage?.labeled), JSON.stringify(stage));
    check(`all ${CONCEPTS.length} concepts are listed`, (stage?.concepts ?? 0) >= CONCEPTS.length, `got ${stage?.concepts}`);
    check("live readout shows the current byte", /^byte: [01]{8}$/.test(stage?.readout ?? ""), stage?.readout);

    // Flip the most significant bit and confirm the live model readout changes.
    const before = stage!.readout;
    const flipped = await browser.eval<string>(`(() => {
      const b = document.querySelector('button[aria-label^="Bit 8"]');
      if (!b) return '';
      b.click();
      return 'ok';
    })()`);
    const after = await until(async () => {
      const text = await browser!.text();
      const match = text.match(/byte: ([01]{8})/);
      return match && match[1] !== before.slice(6) ? match[0] : null;
    });
    check("flipping a switch changes the model", flipped === "ok" && Boolean(after), `${before} → ${after}`);

    // Answer the first concept's quick check correctly (choice index 2 → "64").
    await browser.eval(`(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /^C\\s*64$/.test(b.textContent.replace(/\\s+/g, ' ').trim()));
      if (btn) btn.click();
    })()`);
    const checked = await until(async () => {
      const text = await browser!.text();
      return text.includes("Correct.") && text.includes(`1/${CONCEPTS.length}`) ? true : null;
    });
    check("quick check records progress", Boolean(checked));

    // The free chemistry course must work for the same student with no extra
    // entitlement: canvas, all concepts, a live control and a quiz.
    await browser.goto(`${PAGE}/dashboard/learn/${GOC_COURSE_ID}`);
    const gocStage = await until(async () => {
      const view = await browser!.eval<{ canvas: boolean; labeled: boolean; concepts: number; slider: boolean; header: boolean }>(`(() => {
        const c = document.querySelector('canvas');
        const body = document.body.innerText;
        const rail = [...document.querySelectorAll('button[aria-current="step"]')].length
          + [...document.querySelectorAll('aside button')].filter((b) => /min/.test(b.textContent.trim())).length;
        return {
          canvas: !!c && c.width > 0 && c.height > 0,
          labeled: !!c && (c.getAttribute('aria-label') || '').includes('3D model'),
          concepts: rail,
          slider: !!document.querySelector('#chem-chain'),
          header: /Concept\\s*1\\s*of/i.test(body),
        };
      })()`);
      return view?.canvas && view.labeled && view.concepts >= GOC_CONCEPTS.length && view.slider && view.header ? view : null;
    });
    check("free GOC renders its 3D canvas", Boolean(gocStage?.canvas && gocStage?.labeled), JSON.stringify(gocStage));
    check(`all ${GOC_CONCEPTS.length} GOC concepts are listed`, (gocStage?.concepts ?? 0) >= GOC_CONCEPTS.length, `got ${gocStage?.concepts}`);
    check("GOC practical controls are present", Boolean(gocStage?.slider));

    const chainBefore = await browser.eval<string>(`(document.body.innerText.match(/chain: \\d+ C/) || [''])[0]`);
    const changed = await browser.eval<string>(`(() => {
      const el = document.querySelector('#chem-chain');
      if (!el) return '';
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, '6');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    })()`);
    const chainAfter = await until(async () => {
      const t = await browser!.text();
      return t.includes("chain: 6 C") ? "chain: 6 C" : null;
    });
    check("GOC chain control rebuilds the model", changed === "ok" && Boolean(chainAfter) && chainBefore !== chainAfter, `${chainBefore} → ${chainAfter}`);

    await browser.eval(`(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /Strong C.C catenation/.test(b.textContent.replace(/\\s+/g, ' ').trim()));
      if (btn) btn.click();
    })()`);
    const gocChecked = await until(async () => {
      const t = await browser!.text();
      return t.includes("Correct.") && t.includes(`1/${GOC_CONCEPTS.length}`) ? true : null;
    });
    check("GOC quick check records progress", Boolean(gocChecked));

    const errors = browser.consoleMessages().filter((m) => m.type === "error").map((m) => m.text);
    check("no console errors on the course page", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    if (browser) await browser.close();
    await revokeSession(session2.token);
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) process.exitCode = 1;
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
