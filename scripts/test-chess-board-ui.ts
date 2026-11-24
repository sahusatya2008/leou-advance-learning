/**
 * Interactive training board checks.
 *
 * The board's click layer is pure geometry: pieces are absolutely placed with
 * `translate`, and an earlier version fed the ordered square list into a CSS
 * grid that auto-placed in array order — so the hit-areas drifted away from the
 * pieces and taps landed on the wrong square. That class of bug is invisible to
 * type-checks and unit tests, so this drives real Chrome via CDP and asserts the
 * DOM a student actually gets: every hit-area sits exactly on its square, tap
 * and drag both move a piece, the promotion chooser appears on the last rank,
 * and a stray click does nothing.
 *
 * It does authenticate (as an enrolled student) and grades a couple of lessons,
 * which writes `ChessTrainingProgress` rows for that account.
 *
 *   CHESS_BOARD_BASE_URL=http://127.0.0.1:3101 \
 *     npx tsx --tsconfig scripts/tsconfig.json scripts/test-chess-board-ui.ts
 */
import "dotenv/config";
import { launch } from "./browser";

const BASE = process.env.CHESS_BOARD_BASE_URL ?? "http://127.0.0.1:3001";
const IDENTIFIER = process.env.CHESS_TEST_IDENTIFIER ?? "shellstudent";
const PASSWORD = process.env.CHESS_TEST_PASSWORD ?? "ShellPass123";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type B = Awaited<ReturnType<typeof launch>>;

async function loggedIn(b: B) {
  await b.goto(`${BASE}/login`);
  const out = await b.eval<string>(
    `(async () => {
      const j = (o) => JSON.stringify(o);
      const id = ${JSON.stringify(IDENTIFIER)}, pw = ${JSON.stringify(PASSWORD)};
      const post = (url, body) => fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: j(body) }).then(r => r.json());
      const a = await post('/api/auth/login', { mode:'password', identifier:id, password:pw });
      if (!a.ok) return j(a);
      const c = await post('/api/auth/access-code', { identifier:id, password:pw });
      return j(await post('/api/auth/login', { mode:'access-code', identifier:id, password:pw, code:c.code }));
    })()`
  );
  return JSON.parse(out) as { ok?: boolean; redirect?: string };
}

/** Scroll the board into the middle of the viewport and let the scroll settle. */
async function centerBoard(b: B) {
  await b.eval(`document.querySelector('[data-testid="chessboard"]').scrollIntoView({ block: 'center' })`);
  await sleep(400);
}

/** Live viewport center of a square's hit-area (read fresh, immediately before use). */
async function squareCenter(b: B, s: string): Promise<{ x: number; y: number }> {
  const raw = await b.eval<string>(
    `(() => { const el = document.querySelector('button[data-square="${s}"]'); if (!el) return 'null'; const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 }); })()`
  );
  return JSON.parse(raw);
}

/** Alignment: each hit-area and its piece must sit on the expected square. */
async function alignment(b: B) {
  const raw = await b.eval<string>(
    `(() => {
      const board = document.querySelector('[data-testid="chessboard"]');
      if (!board) return JSON.stringify({ error: 'no board' });
      const r = board.getBoundingClientRect();
      const squares = ['a1','h1','g1','f3','h8','e1','d1'];
      const out = squares.map((s) => {
        const file = s.charCodeAt(0) - 97, rank = Number(s[1]) - 1;
        const col = file, row = 7 - rank;
        const ex = r.left + (col + 0.5) * r.width / 8;
        const ey = r.top + (row + 0.5) * r.height / 8;
        const btn = document.querySelector('button[data-square="' + s + '"]');
        const br = btn && btn.getBoundingClientRect();
        const piece = document.querySelector('[data-square="' + s + '"][data-piece]');
        const pr = piece && piece.getBoundingClientRect();
        return { s, ex, ey,
          bx: br ? br.left + br.width/2 : null, by: br ? br.top + br.height/2 : null,
          px: pr ? pr.left + pr.width/2 : null, py: pr ? pr.top + pr.height/2 : null,
          hasPiece: !!piece, piece: piece ? piece.getAttribute('data-piece') : null };
      });
      return JSON.stringify({ out });
    })()`
  );
  return JSON.parse(raw) as { error?: string; out?: Array<{ s: string; ex: number; ey: number; bx: number | null; by: number | null; px: number | null; py: number | null; hasPiece: boolean; piece: string | null }> };
}

async function solved(b: B, timeout = 9000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await b.text()).includes("Solved")) return true;
    await sleep(300);
  }
  return false;
}

async function knightHere(b: B) {
  return JSON.parse(
    await b.eval<string>(
      `JSON.stringify({ f3: !!document.querySelector('[data-square="f3"][data-piece="N"]'), g1: !!document.querySelector('[data-square="g1"][data-piece="N"]') })`
    )
  ) as { f3: boolean; g1: boolean };
}

const LESSON = "/dashboard/chess/training/physical/knight-jump";

async function main() {
  const b = await launch({ width: 1280, height: 900 });
  try {
    const login = await loggedIn(b);
    check("login succeeds", login.ok === true, JSON.stringify(login));

    // Mark the teaching intro as already seen for the lessons this test visits,
    // so the first-visit popup never sits over the board and eats a click.
    await b.goto(`${BASE}${LESSON}`);
    await b.eval(
      `(() => { for (const k of ['leou:teach:physical:knight-jump','leou:teach:physical:pawn-push','leou:teach:programming:hello-move']) localStorage.setItem(k, '1'); })()`
    );

    /* ---------------------------------------------- alignment (tap areas) */
    await b.goto(`${BASE}${LESSON}`);
    await centerBoard(b);
    const g = await alignment(b);
    if (g.error || !g.out) {
      check("board present", false, JSON.stringify(g));
    } else {
      for (const o of g.out) {
        const bd = Math.hypot(o.ex - (o.bx ?? -999), o.ey - (o.by ?? -999));
        check(`hit-area on ${o.s}`, bd < 2, `off by ${bd.toFixed(1)}px`);
        if (o.hasPiece && o.px != null) {
          const pd = Math.hypot(o.ex - o.px, o.ey - (o.py ?? -999));
          check(`piece on ${o.s}`, pd < 2, `off by ${pd.toFixed(1)}px`);
        }
      }
      const g1 = g.out.find((o) => o.s === "g1")!;
      const f3 = g.out.find((o) => o.s === "f3")!;
      check("knight starts on g1", g1.hasPiece && g1.piece === "N", `piece=${g1.piece}`);
      check("rook sits on f3", f3.hasPiece && f3.piece === "r", `piece=${f3.piece}`);
    }

    /* ---------------------------------------------- tap-to-move */
    const g1c = await squareCenter(b, "g1");
    await b.mouseClick(g1c.x, g1c.y);
    const targets = await b.eval<number>(`document.querySelectorAll('[data-target]').length`);
    check("selecting the knight shows move targets", targets > 0, `targets=${targets}`);
    const f3c = await squareCenter(b, "f3");
    const f3IsTarget = await b.eval<boolean>(
      `(() => { return [...document.querySelectorAll('[data-target]')].some(e=>{const r=e.getBoundingClientRect(); return Math.abs((r.left+r.width/2)-${f3c.x})<3 && Math.abs((r.top+r.height/2)-${f3c.y})<3;}); })()`
    );
    check("f3 is a highlighted capture target", f3IsTarget);
    await b.mouseClick(f3c.x, f3c.y);
    await sleep(1200);
    const m = await knightHere(b);
    check("tap-tap moved the knight g1 -> f3", m.f3 && !m.g1, JSON.stringify(m));
    check("tap-tap graded as solved", await solved(b));

    /* ---------------------------------------------- drag-and-drop */
    await b.goto(`${BASE}${LESSON}`);
    await centerBoard(b);
    const dg1 = await squareCenter(b, "g1");
    const df3 = await squareCenter(b, "f3");
    const mid = { x: (dg1.x + df3.x) / 2, y: (dg1.y + df3.y) / 2 };
    // Dispatch each pointer event in its own task so React re-renders between
    // them, exactly as a real drag does.
    const dispatch = (type: string, selector: string, x: number, y: number) =>
      b.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.dispatchEvent(new PointerEvent(${JSON.stringify(type)}, { bubbles:true, cancelable:true, composed:true, clientX:${x}, clientY:${y}, pointerId:1, pointerType:'mouse', button:0, buttons:${type === "pointerup" ? 0 : 1} })); return true; })()`
      );
    await dispatch("pointerdown", 'button[data-square="g1"]', dg1.x, dg1.y);
    await sleep(120);
    await dispatch("pointermove", '[data-testid="chessboard"]', mid.x, mid.y);
    await sleep(120);
    await dispatch("pointermove", '[data-testid="chessboard"]', df3.x, df3.y);
    await sleep(120);
    const ghost = await b.eval<boolean>(`document.querySelectorAll('.chess-piece').length > document.querySelectorAll('[data-square][data-piece]').length`);
    await dispatch("pointerup", '[data-testid="chessboard"]', df3.x, df3.y);
    check("dragging shows a floating piece", ghost);
    await sleep(1200);
    const m2 = await knightHere(b);
    check("drag moved the knight g1 -> f3", m2.f3 && !m2.g1, JSON.stringify(m2));

    /* ---------------------------------------------- multi-move + promotion */
    await b.goto(`${BASE}/dashboard/chess/training/physical/pawn-push`);
    await centerBoard(b);
    for (const [from, to] of [["a5", "a6"], ["a6", "a7"]] as const) {
      const fc = await squareCenter(b, from);
      await b.mouseClick(fc.x, fc.y);
      const tc = await squareCenter(b, to);
      await b.mouseClick(tc.x, tc.y);
      await sleep(1500); // let the scripted king reply animate back to the player's turn
    }
    const a7 = await squareCenter(b, "a7");
    await b.mouseClick(a7.x, a7.y);
    const a8 = await squareCenter(b, "a8");
    await b.mouseClick(a8.x, a8.y);
    await sleep(400);
    const promo = await b.eval<number>(`document.querySelectorAll('[data-promo]').length`);
    check("reaching the last rank opens the promotion chooser", promo > 0, `options=${promo}`);
    const q = await b.eval<string>(
      `(() => { const el = document.querySelector('[data-promo="a7a8q"]'); if (!el) return 'null'; const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 }); })()`
    );
    if (q !== "null") {
      const c = JSON.parse(q) as { x: number; y: number };
      await b.mouseClick(c.x, c.y);
    }
    check("three-move pawn walk promotes and grades as solved", await solved(b, 12000));

    /* ---------------------------------------------- opponent plays back */
    // The reported bug: a non-solving move handed the turn to an opponent that
    // never moved, freezing the board on "Waiting for the opponent". The
    // opponent must answer so control returns to the student.
    await b.goto(`${BASE}${LESSON}`);
    await centerBoard(b);
    const ng1 = await squareCenter(b, "g1");
    await b.mouseClick(ng1.x, ng1.y);
    const ne2 = await squareCenter(b, "e2");
    await b.mouseClick(ne2.x, ne2.y);
    await sleep(3000); // student move + opponent reply animations
    const oppState = JSON.parse(
      await b.eval<string>(
        `JSON.stringify({ e2: !!document.querySelector('[data-square="e2"][data-piece="N"]'), h8: !!document.querySelector('[data-square="h8"][data-piece="k"]'), f3: !!document.querySelector('[data-square="f3"][data-piece="r"]') })`
      )
    ) as { e2: boolean; h8: boolean; f3: boolean };
    check("non-solving knight move lands on e2", oppState.e2, JSON.stringify(oppState));
    check("the computer answered (a black piece left its square)", !(oppState.h8 && oppState.f3), JSON.stringify(oppState));
    const oppText = await b.text();
    check("turn returns to the student after the computer reply", oppText.includes("Your move"));
    check("board is not stuck waiting for an opponent", !oppText.includes("Waiting for the opponent"));

    /* ---------------------------------------------- programming lesson */
    await b.goto(`${BASE}/dashboard/chess/training/programming/hello-move`);
    await sleep(3000); // Monaco is loaded dynamically
    const setCode = await b.eval<string>(
      `(() => {
        const m = window.monaco; if (!m) return 'no monaco';
        const models = m.editor.getModels();
        if (!models.length) return 'no model';
        const target = models.find(mm => /def move/.test(mm.getValue())) || models[0];
        target.setValue('def move(game):\\n    return "e2e4"\\n');
        return 'set:' + models.length + ':' + /e2e4/.test(target.getValue());
      })()`
    );
    check("Monaco editor is mounted", setCode.startsWith("set"), setCode);
    await sleep(500);
    const runBtn = await b.eval<string>(
      `(() => { const el = [...document.querySelectorAll('button')].find(b => /Run my program/.test(b.textContent||'')); if (!el) return 'null'; el.scrollIntoView({ block: 'center' }); return 'ok'; })()`
    );
    check("Run button is present", runBtn === "ok", runBtn);
    await sleep(400);
    if (runBtn === "ok") {
      const c = await b.eval<string>(
        `(() => { const el = [...document.querySelectorAll('button')].find(b => /Run my program/.test(b.textContent||'')); const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 }); })()`
      );
      const p = JSON.parse(c) as { x: number; y: number };
      await b.mouseClick(p.x, p.y);
    }
    const okP = await solved(b, 20000);
    if (!okP) console.log("   debug page:", (await b.text()).slice(-600).replace(/\s+/g, " "));
    check("coding the winning move grades as solved in-browser", okP);

    /* --------------------------------- multi-turn programming + walkthrough */
    // A programming lesson that spans several turns: the walkthrough popup must
    // open on a fresh visit, and running the program must advance the turn
    // counter rather than resetting.
    const MULTI = "/dashboard/chess/training/programming/end-push-and-promote";
    await b.goto(`${BASE}${MULTI}`);
    await b.eval(`localStorage.removeItem('leou:teach:programming:end-push-and-promote')`);
    await b.goto(`${BASE}${MULTI}`);
    await sleep(2500);
    const walkOpen = await b.eval<string>(
      `(() => { const d = document.querySelector('[aria-label^="Learn:"]'); return d ? (d.textContent||'') : 'none'; })()`
    );
    check("code walkthrough popup auto-opens", walkOpen.includes("Code walkthrough") || walkOpen.includes("Walk me through it"), walkOpen.slice(0, 80));
    const walked = await b.eval<string>(
      `(() => { const el = [...document.querySelectorAll('button')].find(b => /Walk me through it/.test(b.textContent||'')); if (!el) return 'no'; el.click(); return 'ok'; })()`
    );
    check("walkthrough start button works", walked === "ok", walked);
    await sleep(600);
    const stepText = await b.eval<string>(`document.body.textContent || ''`);
    check("walkthrough shows a step counter", /Step \d+ of \d+/.test(stepText), stepText.slice(0, 80));
    // Close the popup so it does not cover the editor.
    await b.eval(`(() => { const el = [...document.querySelectorAll('button[aria-label="Close"]')].pop(); if (el) el.click(); })()`);
    await sleep(600);
    const popupGone = await b.eval<boolean>(`!document.querySelector('[role="dialog"][aria-label^="Learn:"]')`);
    check("walkthrough popup closes", popupGone);

    // Load the lesson's Python solution into Monaco and run it twice.
    const setMulti = await b.eval<string>(
      `(() => {
        const m = window.monaco; if (!m) return 'no monaco';
        const models = m.editor.getModels();
        if (!models.length) return 'no model';
        const target = models.find(mm => /def move/.test(mm.getValue())) || models[0];
        return 'ok:' + target.getValue().length;
      })()`
    );
    check("multi-turn lesson mounts Monaco", setMulti.startsWith("ok"), setMulti);
    const runMulti = async () => {
      const found = await b.eval<string>(
        `(() => { const el = [...document.querySelectorAll('button')].find(b => /Run my program|Run next turn/.test(b.textContent||'')); if (!el) return 'null'; el.scrollIntoView({ block:'center' }); return 'ok'; })()`
      );
      if (found === "null") return false;
      await sleep(500);
      const c = await b.eval<string>(
        `(() => { const el = [...document.querySelectorAll('button')].find(b => /Run my program|Run next turn/.test(b.textContent||'')); if (!el) return 'null'; const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 }); })()`
      );
      if (c === "null") return false;
      const p = JSON.parse(c) as { x: number; y: number };
      if (p.y < 0 || p.y > 900) return false;
      await b.mouseClick(p.x, p.y);
      return true;
    };
    // Seed the exact solution (the lesson's starterCode.python).
    await b.eval(
      `(() => { const m = window.monaco; const models = m.editor.getModels(); const t = models.find(mm => /def move/.test(mm.getValue())) || models[0];
        t.setValue(${JSON.stringify(`def move(game):
    for square in ["e7", "e6", "e5", "e4", "e3", "e2"]:
        if game.piece_at(square) == "P":
            moves = game.moves_from(square)
            for m in moves:
                if len(m) == 5:
                    return m
            return moves[-1]
    return game.legal_moves()[0]
`)}); })()`
    );
    await sleep(400);
    await runMulti();
    await sleep(4000);
    let afterOne = await b.text();
    if (!/Turn 2 of 5/.test(afterOne)) {
      console.log("   debug run btn:", await b.eval<string>(`JSON.stringify([...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>t.length<30))`));
      console.log("   debug page:", afterOne.slice(-400).replace(/\s+/g, " "));
      await runMulti();
      await sleep(4000);
      afterOne = await b.text();
    }
    check("multi-turn run advances to turn 2", /Turn 2 of 5/.test(afterOne), afterOne.slice(-200).replace(/\s+/g, " "));

    /* ---------------------------------------------- stray click is ignored */
    await b.goto(`${BASE}${LESSON}`);
    await centerBoard(b);
    const sg1 = await squareCenter(b, "g1");
    const sa1 = await squareCenter(b, "a1");
    await b.mouseClick(sg1.x, sg1.y);
    await b.mouseClick(sa1.x, sa1.y);
    await sleep(500);
    check("clicking an empty square does not move the knight", await b.eval<boolean>(`!!document.querySelector('[data-square="g1"][data-piece="N"]')`));

    console.log(`\n${pass} passed, ${fail} failed`);
    if (fail) process.exitCode = 1;
  } finally {
    await b.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
