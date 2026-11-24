/**
 * Walks the payment journey in a real browser.
 *
 * Everything here is what a student does with the mouse: land on the quotation,
 * click Pay now, arrive at the QR page, and confirm the UPI details and proof
 * options are actually on screen. HTTP checks cannot see any of it, because the
 * page is client-rendered and the server only ships a loading shell - which is
 * exactly how a missing button survived earlier rounds of "verification".
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { launch } from "./browser";

const JsonNull = (PrismaClient as unknown as { JsonNull: unknown }).JsonNull ?? "null";
const BASE = "http://localhost:3001";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const email = `browser-paynow-${Date.now()}@example.test`;
  const probeRoom = await prisma.classRoom.findFirst({
    where: { isActive: true, subjects: { some: {} } },
    select: { id: true },
  });
  if (!probeRoom) throw new Error("no seeded class room with subjects");

  const s = await prisma.user.create({
    data: {
      email,
      username: email.split("@")[0],
      passwordHash: "x",
      role: "STUDENT",
      studentProfile: {
        create: {
          fullName: "Browser Check",
          schoolName: "Test School",
          facePhotoUrl: "/api/files/face/sample.jpg",
          faceEmbeddings: JsonNull as never,
          classRoom: { connect: { id: probeRoom.id } },
        },
      },
    },
  });

  const tok = (await createSession({ id: s.id, role: s.role } as never, { ip: "127.0.0.1", userAgent: "v" })).token;
  const cookie = `${SESSION_COOKIE}=${tok}`;
  const get = (p: string) => fetch(`${BASE}${p}`, { headers: { cookie } });
  const post = (p: string, body: unknown) =>
    fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) });

  type Topic = { name: string; assignmentRate: number; mockRate: number; testRate: number };
  type Opt = { id: string; name: string; subjects: { id: string; name: string; topics: Topic[] }[] };
  const priced = (t: Topic) => t.assignmentRate + t.mockRate + t.testRate > 0;
  const options = (await (await get("/api/student/onboarding/options")).json()) as { boards: { id: string; name: string }[]; classes: Opt[] };
  const cls = options.classes.find((c) => c.subjects.some((x) => (x.topics ?? []).some(priced)))!;
  const sub = cls.subjects.find((x) => (x.topics ?? []).some(priced))!;
  const topic = sub.topics.find(priced)!.name;

  const created = await post("/api/student/onboarding/request", {
    boardId: options.boards[0].id,
    classRoomId: cls.id,
    subjectIds: [sub.id],
    assignmentTopics: topic,
    wantAssignments: true,
    wantMockTests: false,
    mockTopics: "",
    wantRealTests: false,
    testTopics: "",
    wantTutoring: false,
    tutorSubjects: [],
    tutorGoals: "",
  });
  const cjson = (await created.json()) as { requestId: string; quotation: { totals: { grand: number } } };
  console.log(`\nfixture: request ${cjson.requestId}, total ₹${cjson.quotation.totals.grand}`);

  const b = await launch();
  try {
    await b.setCookie(SESSION_COOKIE, tok);

    // 1. The returning student lands on their quotation.
    await b.goto(`${BASE}/onboarding`);
    const quoteText = await b.text();
    console.log("\n[1] quotation page (returning student, unpaid request)");
    check("quotation total is shown", quoteText.includes("Total to pay") || /Total to pay/i.test(quoteText));
    check("'Pay now' button is visible", /pay ₹|pay now/i.test(quoteText));
    // The request is not locked yet, so the pay action must be a button that
    // opens the preview + lock step, NOT a direct link to the pay page.
    const hasDirectLink = await b.eval<boolean>(
      `!!document.querySelector('a[href*="/dashboard/payments/${cjson.requestId}/pay"]')`,
    );
    check("no direct pay link before locking", !hasDirectLink);

    // 1b. Pay now -> bill preview with Edit choices / Lock, exactly as a
    // student would experience the new lock-first billing.
    console.log("\n[1b] Pay now opens bill preview with Edit choices / Lock");
    const payBtn = await b.eval<boolean>(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => /Pay ₹/.test(x.innerText) && /upload proof/i.test(x.innerText)); if (!b) return false; b.click(); return true; })()`,
    );
    check("pay button exists and was clicked", payBtn);
    await new Promise((r) => setTimeout(r, 1200));
    const previewText = await b.text();
    check("bill preview is on screen", /preview of your bill/i.test(previewText));
    check("Edit choices option present", /edit choices/i.test(previewText));
    check("Lock request & pay now option present", /lock request & pay now/i.test(previewText));
    const previewEditWorks = await b.eval<boolean>(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => /Edit choices/i.test(x.innerText)); if (!b) return false; b.click(); return true; })()`,
    );
    check("Edit choices returns to step 1", previewEditWorks);
    await new Promise((r) => setTimeout(r, 1200));
    check(
      "step-1 choices are editable again",
      (await b.eval<string>("location.pathname")) === "/onboarding" && /choose your services|subjects/i.test(await b.text()),
    );
    // Re-open the preview to actually lock this time: re-run the quotation
    // (the requestId stays the same, so the server edits the request in place)
    // and then step through preview -> lock.
    await b.eval<boolean>(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => /Get my quotation/i.test(x.innerText)); if (!b) return false; b.click(); return true; })()`,
    );
    await new Promise((r) => setTimeout(r, 1500));
    await b.eval<boolean>(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => /Pay ₹/.test(x.innerText) && /upload proof/i.test(x.innerText)); if (!b) return false; b.click(); return true; })()`,
    );
    await new Promise((r) => setTimeout(r, 1200));
    await b.eval<boolean>(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => /Lock request & pay now/i.test(x.innerText)); if (!b) return false; b.click(); return true; })()`,
    );
    await new Promise((r) => setTimeout(r, 2500));

    // 2. Locking lands on the QR payment page.
    console.log("\n[2] locking the request -> QR payment page");
    const payUrl = await b.eval<string>("location.pathname");
    check("navigated to /dashboard/payments/.../pay", payUrl.includes(`/dashboard/payments/${cjson.requestId}/pay`), payUrl);
    const payText = await b.text();
    check("real UPI id is on screen", payText.includes("9975510580.wallet@phonepe"));
    check("academy QR image is on screen", await b.eval<boolean>("!!document.querySelector('img[src*=\"/payment-qr.png\"]')"));
    check("LEOU reference is on screen", /LEOU-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(payText), payText.match(/LEOU-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0] ?? "");
    check("UPI app pay link carries amount", await b.eval<boolean>(
      `!!document.querySelector('a[href^="upi://"]')`,
    ));
    check("pay-with-app link has an amount", await b.eval<boolean>(
      `!![...document.querySelectorAll('a[href^="upi://"]')].find(a => /am=/.test(a.getAttribute('href')))`,
    ));
    // The lock must have landed server-side: a second edit attempt via the API
    // would be refused, and the returned state reports the request as locked.
    const lockedState = (await (await get("/api/student/onboarding")).json()) as { request: { locked: boolean } };
    check("request is locked server-side after locking", !!lockedState.request?.locked);

    // 3. All three ways of proving payment must be offered.
    console.log("\n[3] proof options on the pay page");
    check("transaction id option", /transaction id/i.test(payText));
    check("screenshot upload option", /screenshot/i.test(payText));
    check("camera scan option", /camera/i.test(payText));
    const optionCount = await b.eval<number>(
      `[...document.querySelectorAll('button')].filter(b => /transaction id|screenshot|camera/i.test(b.innerText)).length`,
    );
    check("three proof buttons rendered", optionCount >= 3, `found ${optionCount}`);

    // 4. Nothing may claim the QR is missing now that one is configured.
    check("no missing-QR fallback warning", !/so a QR was generated/i.test(payText));

    // 5. The onboarding lock must survive the fix for every *other* dashboard
    //    page - the guard was narrowed to (guarded), not deleted. A locked
    //    student still gets bounced off /dashboard/plan, while payments stay
    //    open, because that is where they go to actually pay.
    console.log("\n[5] onboarding lock still guards the rest of the dashboard");
    await b.goto(`${BASE}/dashboard/plan`);
    check("locked student is sent to /onboarding from /dashboard/plan", (await b.eval<string>("location.pathname")) === "/onboarding");
    await b.goto(`${BASE}/dashboard/payments`);
    check("locked student can still reach /dashboard/payments", (await b.eval<string>("location.pathname")) === "/dashboard/payments");
  } finally {
    await b.close();
    await prisma.user.delete({ where: { id: s.id } });
  }

  console.log(
    `\n${failures === 0 ? "PASS" : `FAIL: ${failures} check(s) failed`}  ` +
      `(users=${await prisma.user.count()}, requests=${await prisma.onboardingRequest.count()})`,
  );
  process.exit(failures ? 1 : 0);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
