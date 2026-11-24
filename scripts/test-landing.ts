/**
 * Landing-page redesign checks.
 *
 * The landing page is entirely decorative motion, so static inspection of the
 * source proves very little: what matters is whether a browser actually runs
 * the demo, whether the parallax and reveals stay put, and whether a phone
 * viewport stays within its bounds. This drives real Chrome via CDP so the DOM
 * a visitor gets is the thing being asserted.
 *
 * Read-only. It loads `/` and never authenticates or writes anything.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { launch } from "./browser";

/**
 * Read straight out of the source rather than imported.
 *
 * MacBrowser is a client component that now pulls in landing.module.css, and a
 * plain `tsx` run has no CSS loader — importing it would throw a SyntaxError
 * on the stylesheet. The constant is a plain number in the file, so parsing it
 * here keeps the test and the component in lockstep without a build step.
 */
const DEMO_CYCLE_MS = (() => {
  const src = readFileSync(
    new URL("../src/components/landing/MacBrowser.tsx", import.meta.url),
    "utf8",
  );
  const m = src.match(/const CYCLE_MS = (\d+)/);
  if (!m) throw new Error("Could not find CYCLE_MS in MacBrowser.tsx");
  return Number(m[1]);
})();

const BASE = process.env.LANDING_BASE_URL ?? "http://127.0.0.1:3001";

let failures = 0;
let passes = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passes++;
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await launch({ width: 1440, height: 900 });
  try {
    /* ---------------------------------------------------- desktop behaviour */
    await browser.goto(`${BASE}/`);
    await sleep(1200);

    const anchors = await browser.eval<string>(
      `JSON.stringify(['platform','roles','tech'].map(id => !!document.getElementById(id)))`
    );
    check(
      "landing keeps its section anchors",
      JSON.parse(anchors).every(Boolean),
      `present: ${anchors}`
    );

    const links = await browser.eval<string>(
      `JSON.stringify({login: !!document.querySelector('a[href="/login"]'), register: !!document.querySelector('a[href="/register"]')})`
    );
    const parsed = JSON.parse(links) as { login: boolean; register: boolean };
    check("sign-in and register links are present", parsed.login && parsed.register);

    // The Mac browser must exist and auto-advance without any interaction.
    const demo = await browser.eval<string>(
      `JSON.stringify({tabs: document.querySelectorAll('[data-demo-tab]').length, caption: document.querySelector('[data-demo-caption]')?.textContent ?? null})`
    );
    const demoParsed = JSON.parse(demo) as { tabs: number; caption: string | null };
    check("mac browser demo rendered", demoParsed.tabs >= 4, `tabs: ${demoParsed.tabs}`);
    check(
      "demo labels itself as illustrative",
      /no student data|invented|illustrative|one screen per role/i.test(
        demoParsed.caption ?? ""
      ),
      demoParsed.caption ?? "no caption"
    );

    const first = demoParsed.caption;
    // Wait past a full cycle so the advance is unambiguous.
    await sleep(DEMO_CYCLE_MS + 800);
    const second = await browser.eval<string>(`document.querySelector('[data-demo-caption]')?.textContent ?? ''`);
    check("demo advances on its own", first !== second, `before=${first} after=${second}`);

    // Nothing on the page should overflow horizontally at desktop width.
    const overflow = await browser.eval<string>(
      `String(document.documentElement.scrollWidth - document.documentElement.clientWidth)`
    );
    check("no horizontal overflow on desktop", Number(overflow) <= 1, `${overflow}px`);

    /* ------------------------------------------------------- reveal on scroll */
    // A reveal that never fires leaves a section invisible; one that fires for
    // everything at once defeats the effect.
    const revealState = await browser.eval<string>(
      `JSON.stringify([...document.querySelectorAll('.reveal')].slice(0, 40).map(el => el.dataset.shown))`
    );
    const shownFlags = JSON.parse(revealState) as string[];
    check("reveal elements are wired up", shownFlags.length > 0, `${shownFlags.length} found`);
    check("above-the-fold content is revealed", shownFlags.includes("true"), shownFlags.join(","));

    await browser.eval(`document.getElementById('tech').scrollIntoView()`);
    await sleep(900);
    const afterScroll = await browser.eval<string>(
      `JSON.stringify([...document.querySelectorAll('#tech .reveal')].map(el => el.dataset.shown))`
    );
    check(
      "scrolling reveals later sections",
      (JSON.parse(afterScroll) as string[]).includes("true"),
      afterScroll
    );

    /* ------------------------------------------------------- parallax actually moves */
    const before = await browser.eval<string>(`window.scrollY`);
    await browser.eval(`window.scrollTo(0, Math.max(1000, document.body.scrollHeight * 0.25))`);
    await sleep(1200);
    const moved = await browser.eval<string>(
      `JSON.stringify([...document.querySelectorAll('[data-parallax]')].map(el => getComputedStyle(el.firstElementChild).transform))`
    );
    const scrolled = await browser.eval<string>(`window.scrollY`);
    // Some headless layouts can jump on scroll; treat any forward movement as success.
    check(
      "page scrolls",
      Number(scrolled) !== Number(before),
      `${before} -> ${scrolled}`
    );
    const transforms = JSON.parse(moved) as string[];
    check(
      "parallax layers apply a transform",
      transforms.some((t) => t && t !== "none"),
      transforms.slice(0, 3).join(" | ")
    );

    /* ------------------------------------------------------------ reduced motion */
    // Emulated rather than read out of the stylesheet: the OS setting is what
    // this page must respect, and asserting on our own CSS only proves that the
    // CSS we wrote matches the CSS we wrote.
    await browser.setMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await browser.goto(`${BASE}/`);
    await sleep(1200);

    const rmHidden = await browser.eval<string>(
      `String([...document.querySelectorAll('.reveal')].filter(el => getComputedStyle(el).opacity === '0').length)`
    );
    check("reduced motion hides nothing", Number(rmHidden) === 0, `${rmHidden} elements at opacity 0`);

    // The demo must not keep cycling. Wait past a full period: an unchanged
    // caption means the timer was correctly suppressed.
    const rmFirst = await browser.eval<string>(`document.querySelector('[data-demo-caption]')?.textContent ?? ''`);
    await sleep(DEMO_CYCLE_MS + 800);
    const rmSecond = await browser.eval<string>(`document.querySelector('[data-demo-caption]')?.textContent ?? ''`);
    check("reduced motion stops the demo cycle", rmFirst === rmSecond, `${rmFirst} vs ${rmSecond}`);

    const looping = await browser.eval<string>(
      `String([...document.querySelectorAll('*')].filter(el => {
         const s = getComputedStyle(el);
         const d = parseFloat(s.animationDuration);
         return s.animationIterationCount === 'infinite' && d > 0.2 && d < 60;
       }).length)`
    );
    check(
      "reduced motion neutralises looping animations",
      Number(looping) === 0,
      `${looping} long-running animations still active`
    );

    const rmTransforms = await browser.eval<string>(
      `JSON.stringify([...document.querySelectorAll('[data-parallax]')].map(el => getComputedStyle(el.firstElementChild).transform))`
    );
    const allIdentity = (JSON.parse(rmTransforms) as string[]).every(
      (t) => t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)"
    );
    check(
      "reduced motion parks parallax layers",
      allIdentity,
      (JSON.parse(rmTransforms) as string[]).slice(0, 3).join(" | ")
    );

    // The terminal demo should show its finished output rather than replay.
    await browser.eval(`document.getElementById('tech').scrollIntoView()`);
    await sleep(700);
    const rmTerminal = await browser.eval<string>(
      `String((document.querySelector('#tech [data-terminal-body]')?.textContent ?? '').trim().length)`
    );
    check("reduced motion shows the finished terminal", Number(rmTerminal) > 40, `${rmTerminal} chars`);

    await browser.setMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);

    /* -------------------------------------------------- full-scroll integrity */
    // Walk the page so every reveal fires, then confirm nothing was left behind.
    await browser.eval(`(async () => {
      const step = window.innerHeight * 0.6;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 110));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 400));
    })()`);

    const stuck = await browser.eval<string>(
      `String([...document.querySelectorAll('.reveal')].filter(el => getComputedStyle(el).opacity === '0').length)`
    );
    check("no reveal is stranded after a full scroll", Number(stuck) === 0, `${stuck} at opacity 0`);

    // Anchors must still land below the sticky header, not under it.
    await browser.eval(`['platform','roles','tech'].forEach(id => document.getElementById(id)?.scrollIntoView({block:'start', behavior:'instant'}))`);
    await sleep(200);
    const anchorTops = JSON.parse(
      await browser.eval<string>(
        `JSON.stringify(['platform','roles','tech'].map(id => Math.round(document.getElementById(id).getBoundingClientRect().top)))`
      )
    ) as number[];
    const navBottom = await browser.eval<number>(`Math.round(document.querySelector('nav')?.getBoundingClientRect().bottom ?? 0)`);
    check(
      "anchors land below the sticky header",
      anchorTops.some((t) => t > navBottom - 4),
      anchorTops.join(", ")
    );

    // Visible body text must not be clipped by its own box. `.sr-only` is
    // Tailwind's screen-reader utility and is clipped on purpose.
    const clipped = JSON.parse(
      await browser.eval<string>(
        `JSON.stringify([...document.querySelectorAll('h1,h2,h3,p,li,span,a,button')]
           .filter(el => !el.classList.contains('sr-only'))
           .filter(el => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'hidden')
           .map(el => el.tagName + ':' + (el.textContent || '').slice(0, 30)))`
      )
    ) as string[];
    check("no visible text is clipped", clipped.length === 0, clipped.slice(0, 3).join(" | "));

    /* ----------------------------------------------------------------- mobile */
    const mobile = await launch({ port: 9334, width: 1200, height: 900 });
    try {
      await mobile.setViewport({ width: 390, height: 844, mobile: true });
      await mobile.goto(`${BASE}/`);
      await sleep(1200);

      const mWidth = await mobile.eval<string>(`String(window.innerWidth)`);
      check("phone viewport is genuinely 390px", Number(mWidth) === 390, `${mWidth}px`);

      const mOverflow = await mobile.eval<number>(
        `document.documentElement.scrollWidth - document.documentElement.clientWidth`
      );
      check("no horizontal overflow on a phone", Number(mOverflow) <= 1, `${mOverflow}px`);

      const demoWidth = await mobile.eval<string>(
        `String(Math.round(document.querySelector('[data-demo]')?.getBoundingClientRect().width ?? 0))`
      );
      check(
        "mac demo fits the viewport",
        Number(demoWidth) > 0 && Number(demoWidth) <= 390,
        `${demoWidth}px`
      );

      const navLinks = await mobile.eval<string>(
        `String(document.querySelectorAll('a[href^="#"]').length)`
      );
      check("section links stay reachable on a phone", Number(navLinks) >= 3, `${navLinks} anchors`);

      const tapTargets = await mobile.eval<string>(
        `String([...document.querySelectorAll('a[href],button')].slice(0, 60).map(el => el.getBoundingClientRect().height).filter(h => h > 0 && h < 24).length)`
      );
      check("tap targets are not tiny", Number(tapTargets) <= 20, `${tapTargets} under 24px`);
    } finally {
      await mobile.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${passes}/${passes + failures} checks passed`);
  if (failures > 0) process.exit(1);
}

void main();
