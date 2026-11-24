/**
 * Verifies the student panel's payments page shows the complete picture of
 * whatever the student has paid so far:
 *
 *   - a payment history covering every proof submitted - awaiting, verified,
 *     rejected and superseded - with amounts, references, transaction ids,
 *     decision notes and the verified total;
 *   - the fee records with their paid date and receipt link.
 *
 * Everything it needs is created here and removed in `finally`: a throwaway
 * student, one onboarding request carrying four payment attempts in the four
 * possible states, and two fee records. No pre-existing row is modified.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-payment-history.ts
 *   BASE_URL=https://<public-host> npx tsx --tsconfig scripts/tsconfig.json scripts/test-payment-history.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/validation";
import { SESSION_COOKIE, createSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const PASSWORD = "Test-Passw0rd!";
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

async function getPage(path: string, cookie: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  return { status: res.status, text: await res.text() };
}

const undo: (() => Promise<void>)[] = [];

async function main() {
  console.log(`\npayment history (${BASE})`);

  const [classRoom, board] = await Promise.all([
    prisma.classRoom.findFirst({ select: { id: true } }),
    prisma.board.findFirst({ orderBy: { sortOrder: "asc" }, select: { id: true } }),
  ]);
  if (!classRoom) throw new Error("no class room");
  if (!board) throw new Error("no board");

  const student = await prisma.user.create({
    data: {
      username: `zz_hist_${STAMP}`,
      email: `zz_hist_${STAMP}@leou.invalid`,
      passwordHash: await hashPassword(PASSWORD),
      role: "STUDENT",
      studentProfile: {
        create: {
          fullName: "Payment History Student",
          classRoomId: classRoom.id,
          schoolName: "ZZ School",
          facePhotoUrl: "",
          faceEmbeddings: [],
        },
      },
    },
    include: { studentProfile: true },
  });
  const profileId = student.studentProfile!.id;
  undo.push(async () => {
    await prisma.user.delete({ where: { id: student.id } }).catch(() => null);
  });

  const request = await prisma.onboardingRequest.create({
    data: {
      userId: student.id,
      boardId: board.id,
      classRoomId: classRoom.id,
      subjects: [],
      assignmentTopics: "",
      mockTopics: "",
      testTopics: "",
      tutorSubjects: [],
      tutorGoals: "",
      amount: 1000,
      leouPayRef: `LEOU-ZZ-${STAMP}`,
      status: "ACTIVATED",
    },
  });
  undo.push(async () => {
    await prisma.paymentRequest.deleteMany({ where: { requestId: request.id } }).catch(() => null);
    await prisma.onboardingRequest.delete({ where: { id: request.id } }).catch(() => null);
  });

  // Four attempts in the four states a payment can be in, staggered so the
  // newest-first ordering of the history can actually be observed.
  const now = Date.now();
  const ref = (tag: string) => `LEOU-ZZ${tag}-${STAMP}`;
  const base = { userId: student.id, requestId: request.id, leouPayRef: "" };
  await prisma.paymentRequest.create({
    data: {
      ...base,
      leouPayRef: ref("AA"),
      purpose: "REGISTRATION",
      method: "TRANSACTION_ID",
      transactionId: "ZZTXN12345",
      amountExpected: 111,
      status: "SUBMITTED",
      submittedAt: new Date(now - 0),
    },
  });
  await prisma.paymentRequest.create({
    data: {
      ...base,
      leouPayRef: ref("BB"),
      purpose: "RENEWAL",
      method: "SCREENSHOT",
      amountExpected: 222,
      status: "APPROVED",
      decisionNote: "ZZ approved note",
      decidedAt: new Date(now - 60_000),
      submittedAt: new Date(now - 120_000),
    },
  });
  await prisma.paymentRequest.create({
    data: {
      ...base,
      leouPayRef: ref("CC"),
      purpose: "ADDITIONAL_SERVICE",
      method: "CAMERA_SCAN",
      amountExpected: 333,
      status: "REJECTED",
      decisionNote: `ZZ rejected ${STAMP}`,
      decidedAt: new Date(now - 180_000),
      submittedAt: new Date(now - 240_000),
    },
  });
  await prisma.paymentRequest.create({
    data: {
      ...base,
      leouPayRef: ref("DD"),
      purpose: "REGISTRATION",
      method: "TRANSACTION_ID",
      transactionId: "ZZTXN00000",
      amountExpected: 444,
      status: "SUPERSEDED",
      submittedAt: new Date(now - 300_000),
    },
  });

  await prisma.paymentRecord.create({
    data: {
      studentId: profileId,
      title: `ZZ paid fee ${STAMP}`,
      amount: 555,
      dueDate: new Date(now - 7 * 86_400_000),
      status: "PAID",
      paidAt: new Date(now - 6 * 86_400_000),
      receiptUrl: "/api/files/payment/receipt.jpg",
    },
  });
  await prisma.paymentRecord.create({
    data: {
      studentId: profileId,
      title: `ZZ pending fee ${STAMP}`,
      amount: 250,
      dueDate: new Date(now + 7 * 86_400_000),
      status: "PENDING",
    },
  });
  undo.push(async () => {
    await prisma.paymentRecord.deleteMany({ where: { studentId: profileId } }).catch(() => null);
  });

  try {
    const info = await createSession({ id: student.id, role: "STUDENT" }, { userAgent: "payment-history-test" });
    const cookie = `${SESSION_COOKIE}=${info.token}`;

    const page = await getPage("/dashboard/payments", cookie);
    check("the payments page renders", page.status === 200, `got ${page.status}`);
    // Server React splits adjacent static text and expressions with comments
    // ("Verified<!-- -->1"); strip them so substring checks see what a reader sees.
    const html = page.text.replace(/<!-- -->/g, "");

    check("it has a payment history section", html.includes("Payment history"));
    check(
      "it counts the states",
      html.includes("Verified 1") && html.includes("Awaiting 1") && html.includes("Rejected 1")
    );
    check("it totals the verified money", html.includes("Total verified ₹222.00"));

    check(
      "it shows all four statuses",
      html.includes("Awaiting verification") && html.includes("Verified") && html.includes("Rejected") && html.includes("Replaced")
    );
    check(
      "it labels the purposes",
      html.includes("Registration fee") && html.includes("Renewal") && html.includes("Additional service")
    );
    check(
      "it shows every amount",
      ["₹111.00", "₹222.00", "₹333.00", "₹444.00"].every((a) => html.includes(a)),
      html.includes("₹444.00") ? "" : "missing some amounts"
    );
    check(
      "it shows every reference",
      [ref("AA"), ref("BB"), ref("CC"), ref("DD")].every((r) => html.includes(r))
    );
    check("it shows the transaction id", html.includes("ZZTXN12345"));
    check("it shows decision notes", html.includes("Admin note:") && html.includes(`ZZ rejected ${STAMP}`));
    check("it says the services were activated", html.includes("Services activated"));

    const order = [ref("AA"), ref("BB"), ref("CC"), ref("DD")].map((r) => html.indexOf(r));
    check(
      "the newest payment comes first",
      order.every((i) => i >= 0) && order[0]! < order[1]! && order[1]! < order[2]! && order[2]! < order[3]!,
      JSON.stringify(order)
    );

    check("it lists the fee records", html.includes(`ZZ paid fee ${STAMP}`) && html.includes(`ZZ pending fee ${STAMP}`));
    check("the paid fee shows its paid date", html.includes("Paid") && html.includes("was due"));
    check("the paid fee links its receipt", html.includes("View receipt") && html.includes("/api/files/payment/receipt.jpg"));
    check("the pending fee still reads pending", html.includes("Pending"));
  } finally {
    for (const step of undo.reverse()) await step();
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
