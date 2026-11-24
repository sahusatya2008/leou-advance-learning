/**
 * Reproduces a student's renewal end to end against the running app and reports
 * what the admin's Payments page would show.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/diagnose-renewal-payment.ts [username]
 *
 * Safe to re-run: everything it creates (the renewal request, its payment row,
 * the log entries and the sessions) is deleted before it exits. It never
 * approves anything, so no activation window is touched.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, createSession, revokeSession } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const USERNAME = process.argv[2] ?? "rolex";
const TXN = `ZZRENEWAL${Date.now()}`;

type Json = Record<string, unknown>;

async function api(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE}=${token}`,
      ...(init?.headers ?? {}),
    },
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

async function main() {
  const student = await prisma.user.findUnique({
    where: { username: USERNAME },
    select: { id: true, role: true, onboardingRequired: true },
  });
  if (!student) throw new Error(`no user named ${USERNAME}`);
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("no admin user");

  const live = await prisma.serviceActivation.findFirst({
    where: { userId: student.id, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    include: { request: true },
  });
  if (!live) throw new Error(`${USERNAME} has no live activation, so a renewal cannot be started`);

  const r = live.request;
  if (!r) throw new Error(`activation ${live.id} has no linked request`);
  const body = {
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

  const studentSession = await createSession({ id: student.id, role: "STUDENT" }, { userAgent: "renewal-diagnose" });
  const adminSession = await createSession({ id: admin.id, role: "ADMIN" }, { userAgent: "renewal-diagnose" });

  const created: { requestId?: string; paymentId?: string } = {};
  try {
    console.log(`student ${USERNAME} (${student.id}), live activation until ${live.expiresAt.toISOString()}`);

    console.log("\n1. POST /api/student/onboarding/renewal");
    const renewal = await api("/api/student/onboarding/renewal", studentSession.token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    console.log(`   -> ${renewal.status} ${JSON.stringify(renewal.body)}`);
    const requestId = String(renewal.body?.requestId ?? "");
    if (!requestId) throw new Error("renewal did not return a requestId");
    created.requestId = requestId;

    const row = await prisma.onboardingRequest.findUnique({
      where: { id: requestId },
      select: { id: true, kind: true, status: true, amount: true, lockedAt: true, leouPayRef: true },
    });
    console.log(`   db: kind=${row?.kind} status=${row?.status} amount=${row?.amount} locked=${row?.lockedAt != null} ref=${row?.leouPayRef}`);

    console.log("\n2. POST /api/student/onboarding/lock  (what 'Lock request & pay now' does)");
    const lock = await api("/api/student/onboarding/lock", studentSession.token, {
      method: "POST",
      body: JSON.stringify({ requestId, lock: true }),
    });
    console.log(`   -> ${lock.status} ${JSON.stringify(lock.body)}`);

    const before = await prisma.paymentRequest.count({ where: { status: "SUBMITTED" } });
    const adminBefore = await api("/admin/payments?tab=RENEWAL", adminSession.token);
    console.log(`   admin RENEWAL tab before proof: ${adminBefore.status}, ${(adminBefore.text.match(/Nothing waiting under this heading/g) ?? []).length} empty-state(s), open proofs=${before}`);

    console.log("\n3. POST /api/student/payments  (submitting a transaction id)");
    const pay = await api("/api/student/payments", studentSession.token, {
      method: "POST",
      body: JSON.stringify({ requestId, method: "TRANSACTION_ID", transactionId: TXN }),
    });
    console.log(`   -> ${pay.status} ${JSON.stringify(pay.body)}`);
    if (pay.body?.paymentId) created.paymentId = String(pay.body.paymentId);

    const proof = created.paymentId
      ? await prisma.paymentRequest.findUnique({
          where: { id: created.paymentId },
          select: { id: true, purpose: true, status: true, superseded: true, leouPayRef: true, transactionId: true },
        })
      : null;
    console.log(`   db: ${JSON.stringify(proof)}`);

    console.log("\n4. admin Payments page");
    for (const tab of ["REGISTRATION", "RENEWAL", "ADDITIONAL_SERVICE"]) {
      const page = await api(`/admin/payments?tab=${tab}`, adminSession.token);
      const hasRow = proof ? page.text.includes(proof.leouPayRef) : false;
      const empty = page.text.includes("Nothing waiting under this heading");
      console.log(`   ${tab.padEnd(19)} ${page.status} rows-for-this-payment=${hasRow} empty-state=${empty}`);
    }
  } finally {
    if (created.paymentId) {
      await prisma.paymentRequestAttachment.deleteMany({ where: { paymentId: created.paymentId } });
      await prisma.paymentRequest.delete({ where: { id: created.paymentId } }).catch(() => undefined);
    }
    if (created.requestId) {
      await prisma.paymentRequest.deleteMany({ where: { requestId: created.requestId } });
      await prisma.onboardingRequest.delete({ where: { id: created.requestId } }).catch(() => undefined);
      await prisma.activityLog.deleteMany({
        where: { createdAt: { gt: new Date(Date.now() - 10 * 60_000) }, metadata: { path: ["requestId"], equals: created.requestId } },
      });
    }
    await revokeSession(studentSession.sid).catch(() => undefined);
    await revokeSession(adminSession.sid).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
