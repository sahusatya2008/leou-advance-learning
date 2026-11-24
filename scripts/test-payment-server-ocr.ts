/**
 * Proves the submission route reads the payment screen itself.
 *
 * Two things are being asserted:
 *
 *  1. Tampering fails. A student can post `scannedAmount` matching the
 *     quotation, along with a screenshot showing a completely different sum.
 *     If the server took the client's word for it, that attempt would be
 *     recorded as a pass and the admin would be looking at a green tick over a
 *     receipt for the wrong amount.
 *
 *  2. The screenshot path is checked at all. It used to store the image and
 *     nothing else, so the option most students pick was the only one with no
 *     comparison against what they owed.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { verifyPaymentScreen } from "@/lib/paymentVerification";

const JsonNull = (PrismaClient as unknown as { JsonNull: unknown }).JsonNull ?? "null";
const BASE = "http://localhost:3001";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
}

const dataUrl = (p: string) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;

async function main() {
  const room = await prisma.classRoom.findFirst({
    where: { isActive: true, subjects: { some: {} } },
    select: { id: true },
  });
  if (!room) throw new Error("no seeded class room with subjects");

  // Submitting proof locks the request, so each case gets its own student: the
  // next case can never reuse (or overwrite) a request the previous one froze.
  const users: string[] = [];
  let cookie = "";
  const newStudent = async () => {
    const s = await prisma.user.create({
      data: {
        email: `server-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`,
        username: `server-ocr-${Date.now()}`,
        passwordHash: "x",
        role: "STUDENT",
        studentProfile: {
          create: {
            fullName: "Server OCR",
            schoolName: "Test School",
            facePhotoUrl: "/api/files/face/sample.jpg",
            faceEmbeddings: JsonNull as never,
            classRoom: { connect: { id: room.id } },
          },
        },
      },
    });
    users.push(s.id);
    const tok = (await createSession({ id: s.id, role: s.role } as never, { ip: "127.0.0.1", userAgent: "v" })).token;
    cookie = `${SESSION_COOKIE}=${tok}`;
  };
  await newStudent();

  const post = (p: string, body: unknown) =>
    fetch(`${BASE}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(body),
    });

  type Topic = { name: string; assignmentRate: number; mockRate: number; testRate: number };
  const priced = (t: Topic) => t.assignmentRate + t.mockRate + t.testRate > 0;
  const opts = (await (
    await fetch(`${BASE}/api/student/onboarding/options`, { headers: { cookie } })
  ).json()) as { boards: { id: string }[]; classes: { id: string; subjects: { id: string; topics: Topic[] }[] }[] };
  const cls = opts.classes.find((c) => c.subjects.some((x) => x.topics.some(priced)))!;
  const sub = cls.subjects.find((x) => x.topics.some(priced))!;
  const topic = sub.topics.find(priced)!.name;
  const cr = await post("/api/student/onboarding/request", {
    boardId: opts.boards[0].id,
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
  const cj = (await cr.json()) as { requestId: string; quotation: { totals: { grand: number } } };
  const amount = cj.quotation.totals.grand;
  console.log(`\nfixture: request ${cj.requestId}, quotation ₹${amount}\n`);

  // Each case is a fresh student+request so the SUBMITTED-until-one-at-a-time
  // rule does not make the later attempts look superseded.
  const freshRequest = async () => {
    await newStudent();
    const r = await post("/api/student/onboarding/request", {
      boardId: opts.boards[0].id,
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
    if (r.status !== 200) throw new Error(`freshRequest failed: status ${r.status}`);
    return ((await r.json()) as { requestId: string }).requestId;
  };

  const latest = async (requestId: string) =>
    prisma.paymentRequest.findFirstOrThrow({ where: { requestId }, orderBy: { submittedAt: "desc" } });

  // --- 1. The attack: forged values, wrong screenshot --------------------
  console.log("[1] forged scannedAmount with a ₹500 screenshot on a ₹5 quote");
  {
    const rid = cj.requestId;
    const res = await post("/api/student/payments", {
      requestId: rid,
      method: "SCREENSHOT",
      screenshot: dataUrl("/tmp/q_wrong.png"),
      // Everything the old route would have believed:
      scannedAmount: amount,
      scannedDate: new Date().toISOString().slice(0, 10),
      scannedTime: "14:03",
      scannedPayee: "LEOU",
      ocrText: "Payment Successful Rs 5.00 Paid to LEOU",
    });
    check("submission accepted as an attempt", res.status === 201, `status ${res.status}`);
    const row = await latest(rid);
    const check_ = row.checkResult ? JSON.parse(row.checkResult) : null;
    check("a verification was recorded for the screenshot", Boolean(check_));
    check("forged scannedAmount was ignored", Number(row.scannedAmount) !== amount, `stored ${row.scannedAmount}`);
    if (check_) {
      const amountCheck = check_.checks.find((c: { field: string }) => c.field === "amount");
      check(
        "the ₹500 screen is reported as a mismatch, not a pass",
        amountCheck?.state === "mismatch" || amountCheck?.state === "unreadable",
        `state ${amountCheck?.state}`
      );
      check("overall result is not a pass", check_.matches === false);
    }
  }

  // --- 2. A genuine match -------------------------------------------------
  console.log("\n[2] honest screenshot showing the correct amount and today's date");
  {
    const rid = await freshRequest();
    const res = await post("/api/student/payments", {
      requestId: rid,
      method: "SCREENSHOT",
      screenshot: dataUrl("/tmp/q_match.png"),
    });
    check("submission accepted", res.status === 201, `status ${res.status}`);
    const row = await latest(rid);
    check("server read the amount off the image", Number(row.scannedAmount) === amount, `read ${row.scannedAmount}`);
    check("server stored the OCR text", Boolean(row.ocrText));
    const check_ = row.checkResult ? JSON.parse(row.checkResult) : null;
    if (check_) {
      const amountCheck = check_.checks.find((c: { field: string }) => c.field === "amount");
      check("amount reported as a match", amountCheck?.state === "match", `state ${amountCheck?.state}`);
      const dateCheck = check_.checks.find((c: { field: string }) => c.field === "date");
      check("recent date reported as a match", dateCheck?.state === "match", `state ${dateCheck?.state}`);
      check("overall result is a pass", check_.matches === true);
    } else {
      check("a verification was recorded", false);
    }
  }

  // --- 3. A stale receipt -------------------------------------------------
  console.log("\n[3] correct amount but dated 40 days ago");
  {
    const rid = await freshRequest();
    await post("/api/student/payments", {
      requestId: rid,
      method: "SCREENSHOT",
      screenshot: dataUrl("/tmp/q_old.png"),
    });
    const row = await latest(rid);
    const check_ = row.checkResult ? JSON.parse(row.checkResult) : null;
    const dateCheck = check_?.checks.find((c: { field: string }) => c.field === "date");
    check("old receipt flagged as a date mismatch", dateCheck?.state === "mismatch", `state ${dateCheck?.state}`);
    check("overall result is not a pass", check_?.matches === false);
  }

  // --- 4. A dark screenshot must not be a silent pass ---------------------
  console.log("\n[4] dark, low-contrast screenshot");
  {
    const rid = await freshRequest();
    await post("/api/student/payments", {
      requestId: rid,
      method: "SCREENSHOT",
      screenshot: dataUrl("/tmp/q_dark.png"),
    });
    const row = await latest(rid);
    const check_ = row.checkResult ? JSON.parse(row.checkResult) : null;
    check("a verdict is still produced", Boolean(check_));
    if (check_?.matches) {
      // Passing on an unreadable screen would mean the check proved nothing.
      const amountCheck = check_.checks.find((c: { field: string }) => c.field === "amount");
      check("a pass is backed by a real reading", amountCheck?.state === "match", `state ${amountCheck?.state}`);
    } else {
      check("unreadable screen is not a pass", true);
    }
  }

  // --- 5. The camera path re-reads its own frame too ---------------------
  console.log("\n[5] camera path is re-read server-side too");
  {
    const rid = await freshRequest();
    await post("/api/student/payments", {
      requestId: rid,
      method: "CAMERA_SCAN",
      cameraProof: dataUrl("/tmp/q_match.png"),
      transactionId: "428190000101",
      // Forged: claims a different amount than the frame shows.
      scannedAmount: 999,
    });
    const row = await latest(rid);
    check("camera frame stored", Boolean(row.cameraProofUrl));
    check("forged camera scannedAmount ignored", Number(row.scannedAmount) !== 999, `stored ${row.scannedAmount}`);
  }

  // --- 6. The shared verifier still behaves ------------------------------
  console.log("\n[6] verifyPaymentScreen unit behaviour");
  {
    const good = verifyPaymentScreen({
      amountFound: 5,
      amountExpected: 5,
      dateFound: new Date().toISOString().slice(0, 10),
      timeFound: "14:03",
      txnFound: "abc123",
    });
    check("a clean screen passes", good.matches === true, good.summary);
    const bad = verifyPaymentScreen({
      amountFound: 1,
      amountExpected: 5,
      dateFound: new Date().toISOString().slice(0, 10),
      timeFound: "14:03",
      txnFound: "abc123",
    });
    check("a wrong amount fails", bad.matches === false && bad.hasMismatch === true);
  }

  await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
  console.log(
    `\n${failures === 0 ? "PASS" : `FAIL: ${failures} check(s) failed`}  ` +
      `(users=${await prisma.user.count()}, requests=${await prisma.onboardingRequest.count()})`
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
