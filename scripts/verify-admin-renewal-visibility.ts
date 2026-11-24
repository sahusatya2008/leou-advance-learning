/**
 * Checks that a submitted renewal reaches the admin payments queue *before* the
 * student uploads any proof, and that recording a bank-matched payment opens the
 * ordinary verify screen.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/verify-admin-renewal-visibility.ts [username]
 *
 * Everything it creates is removed before it exits, and it never approves a
 * payment, so no service window is touched.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const USERNAME = process.argv[2] ?? "rolex";
const TXN = `ZZVERIFY${Date.now()}`;

let checks = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: string) {
  checks++;
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

type Json = Record<string, unknown>;

async function api(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE}=${token}`,
      ...(init?.headers ?? {}),
    },
    redirect: "manual",
  });
  const text = await res.text();
  let body: Json | null = null;
  try {
    body = JSON.parse(text) as Json;
  } catch {
    body = null;
  }
  return { status: res.status, body, text };
}

function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

async function main() {
  const student = await prisma.user.findUnique({
    where: { username: USERNAME },
    select: { id: true },
  });
  if (!student) throw new Error(`no user named ${USERNAME}`);
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("no admin user");

  const live = await prisma.serviceActivation.findFirst({
    where: { userId: student.id, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    include: { request: true },
  });
  if (!live?.request) throw new Error(`${USERNAME} has no live activation to renew`);

  const r = live.request;
  const renewalBody = {
    boardId: r.boardId,
    classRoomId: r.classRoomId,
    subjectIds: (r.subjects as unknown as string[]) ?? [],
    wantAssignments: r.wantAssignments,
    wantMockTests: r.wantMockTests,
    wantRealTests: r.wantRealTests,
    sameTopicsForMockTests: r.sameTopicsForMockTests,
    wantTutoring: r.wantTutoring,
    tutorSubjects: (r.tutorSubjects as unknown as string[]) ?? [],
    tutorGoals: r.tutorGoals,
    tutorPlan: r.tutorPlan,
    tutorHours: r.tutorHours,
    subjectTopics: r.subjectTopics,
    assignmentTopics: r.assignmentTopics,
    mockTopics: r.mockTopics,
    testTopics: r.testTopics,
    renewsActivationIds: [live.id],
  };

  const studentSession = await createSession({ id: student.id, role: "STUDENT" }, { userAgent: "renewal-visibility" });
  const adminSession = await createSession({ id: admin.id, role: "ADMIN" }, { userAgent: "renewal-visibility" });

  const created: { requestId?: string; paymentIds: string[] } = { paymentIds: [] };

  try {
    console.log(`\n1. ${USERNAME} submits a renewal (no payment yet)`);
    const renewal = await api("/api/student/onboarding/renewal", studentSession.token, {
      method: "POST",
      body: JSON.stringify(renewalBody),
    });
    const requestId = String(renewal.body?.requestId ?? "");
    if (!requestId) throw new Error(`renewal failed: ${renewal.status} ${renewal.text.slice(0, 300)}`);
    created.requestId = requestId;
    const row = await prisma.onboardingRequest.findUnique({
      where: { id: requestId },
      select: { kind: true, status: true, amount: true, lockedAt: true, leouPayRef: true },
    });
    check("renewal created as RENEWAL with a reference", row?.kind === "RENEWAL" && !!row.leouPayRef);
    const ref = row?.leouPayRef ?? "";
    console.log(`     ${requestId} kind=${row?.kind} status=${row?.status} ₹${row?.amount} ref=${ref}`);

    console.log("\n2. it is visible in the admin queue BEFORE any proof");
    const beforePage = await api("/admin/payments?tab=RENEWAL", adminSession.token);
    const beforeText = visibleText(beforePage.text);
    check("RENEWAL tab renders", beforePage.status === 200, String(beforePage.status));
    check("request reference is listed", beforeText.includes(ref));
    check("it is labelled as awaiting payment", /Requests awaiting payment/.test(beforeText));
    check("request page is linked", beforePage.text.includes(`/admin/payments/requests/${requestId}`));
    const proofsBefore = await prisma.paymentRequest.count({ where: { requestId } });
    check("no proof exists yet (still only the request)", proofsBefore === 0);

    console.log("\n3. the admin records the statement entry");
    const record = await api("/api/admin/payments/record", adminSession.token, {
      method: "POST",
      body: JSON.stringify({ requestId, transactionId: TXN, note: "verified by script" }),
    });
    check("record returns 201", record.status === 201, `${record.status} ${record.text.slice(0, 200)}`);
    const paymentId = String(record.body?.paymentId ?? "");
    if (paymentId) created.paymentIds.push(paymentId);

    const payment = paymentId
      ? await prisma.paymentRequest.findUnique({
          where: { id: paymentId },
          select: { purpose: true, status: true, leouPayRef: true, transactionId: true, amountExpected: true },
        })
      : null;
    check("payment row is SUBMITTED and RENEWAL", payment?.status === "SUBMITTED" && payment?.purpose === "RENEWAL");
    check("payment carries the request reference", payment?.leouPayRef === ref);
    check("payment carries the transaction id", payment?.transactionId === TXN);

    const verifyPage = paymentId
      ? await api(`/admin/payments/${paymentId}`, adminSession.token)
      : { status: 0, text: "" };
    const verifyText = visibleText(verifyPage.text);
    check("verify screen opens", verifyPage.status === 200, String(verifyPage.status));
    check("verify screen shows the reference", verifyText.includes(ref));
    check("verify screen offers the decision", /Approve/.test(visibleText(verifyPage.text)));

    const afterPage = await api("/admin/payments?tab=RENEWAL", adminSession.token);
    check(
      "request leaves the awaiting-payment list once recorded",
      !afterPage.text.includes(`/admin/payments/requests/${requestId}`)
    );
    check("the proof now shows in the queue", visibleText(afterPage.text).includes(ref));

    console.log("\n4. recording twice does not duplicate the queue");
    const again = await api("/api/admin/payments/record", adminSession.token, {
      method: "POST",
      body: JSON.stringify({ requestId, transactionId: TXN }),
    });
    check("second record is refused", again.status === 400, String(again.status));
    const count = await prisma.paymentRequest.count({ where: { requestId } });
    check("still exactly one payment row", count === 1, String(count));

    console.log("\n5. a bank that already has the money can still be reconciled later");
    const recorded = await prisma.paymentRequest.findFirst({
      where: { requestId, status: "SUBMITTED" },
      select: { id: true },
    });
    check("recorded payment is open for a decision", !!recorded);
  } finally {
    for (const id of created.paymentIds) {
      await prisma.paymentRequestAttachment.deleteMany({ where: { paymentId: id } });
      await prisma.paymentRequest.delete({ where: { id } }).catch(() => undefined);
    }
    if (created.requestId) {
      await prisma.paymentRequest.deleteMany({ where: { requestId: created.requestId } });
      await prisma.onboardingRequest.delete({ where: { id: created.requestId } }).catch(() => undefined);
      await prisma.activityLog.deleteMany({
        where: {
          createdAt: { gt: new Date(Date.now() - 10 * 60_000) },
          metadata: { path: ["requestId"], equals: created.requestId },
        },
      });
    }
    await revokeSession(studentSession.sid).catch(() => undefined);
    await revokeSession(adminSession.sid).catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log(`\n${checks} checks, ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
