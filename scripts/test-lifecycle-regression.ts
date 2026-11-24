/**
 * Regression for the per-subject entitlement + payment-lock + independent
 * subscription windows.
 *
 *   A1. A request that carries per-subject chapters prices each subject on its
 *       own and never lets one subject's chapter into another subject's box.
 *   A2. Locking freezes the request server-side: edits are refused, the state
 *       reports locked, and unlocking is possible only while nothing is under
 *       review.
 *   B1. Approving an add-on opens its OWN 30-day window rather than riding out
 *       the primary's tail end (independent expiry).
 *   B2. Approving a renewal retires exactly the live windows it was created to
 *       take over (renewsActivationIds) and opens a fresh one - a renewed
 *       subject disappears from the entitlement the moment the old window ends.
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { decidePayment } from "@/services/paymentService";
import { createRenewalRequest } from "@/services/onboardingService";
import type { User } from "@/generated/prisma/client";

const JsonNull = (PrismaClient as unknown as { JsonNull: unknown }).JsonNull ?? "null";
const BASE = "http://localhost:3001";
const DAY = 86_400_000;

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
}

type Topic = { name: string; assignmentRate: number; mockRate: number; testRate: number };
type Opt = { id: string; subjects: { id: string; name: string; topics: Topic[] }[] };
const priced = (t: Topic) => t.assignmentRate + t.mockRate + t.testRate > 0;

async function makeStudent(roomId: string) {
  const email = `lifecycle-${Date.now()}@example.test`;
  return prisma.user.create({
    data: {
      email,
      username: email.split("@")[0],
      passwordHash: "x",
      role: "STUDENT",
      studentProfile: {
        create: {
          fullName: "Lifecycle Check",
          schoolName: "Test School",
          facePhotoUrl: "/api/files/face/sample.jpg",
          faceEmbeddings: JsonNull as never,
          classRoom: { connect: { id: roomId } },
        },
      },
    },
  });
}

let approveCounter = 0;
async function approveRequest(s: User, adminId: string, requestId: string, purpose: "REGISTRATION" | "RENEWAL" | "ADDITIONAL_SERVICE" = "REGISTRATION") {
  approveCounter += 1;
  const attempt = await prisma.paymentRequest.create({
    data: {
      user: { connect: { id: s.id } },
      request: { connect: { id: requestId } },
      purpose,
      leouPayRef: `LEOU-TEST-LIFECYCLE-${Date.now()}-${approveCounter}`,
      method: "SCREENSHOT",
    },
  });
  const res = await decidePayment({ paymentId: attempt.id, adminUserId: adminId, decision: "APPROVE", note: "auto lifecycle" });
  if (!res.ok) throw new Error(`decidePayment failed: ${res.error}`);
}

async function main() {
  const room = await prisma.classRoom.findFirst({
    where: { isActive: true, subjects: { some: {} } },
    select: { id: true },
  });
  if (!room) throw new Error("no seeded class room with subjects");

  const s = await makeStudent(room.id);
  // A real user id for decidedBy (activities reference it).
  const admin = await prisma.user.create({
    data: { email: `lifecycle-admin-${Date.now()}@example.test`, username: "lifecycle-admin", passwordHash: "x", role: "ADMIN" },
  });

  try {
    const tok = (await createSession({ id: s.id, role: s.role } as never, { ip: "127.0.0.1", userAgent: "v" })).token;
    const cookie = `${SESSION_COOKIE}=${tok}`;
    const get = (p: string) => fetch(`${BASE}${p}`, { headers: { cookie } });
    const post = (p: string, body: unknown) =>
      fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) });

    const options = (await (await get("/api/student/onboarding/options")).json()) as { boards: { id: string }[]; classes: Opt[] };
    const classes = (options.classes ?? []).filter((c) => Array.isArray(c.subjects));
    const pricedCount = (c: Opt) => (c.subjects ?? []).reduce((n, x) => n + (x.topics ?? []).filter(priced).length, 0);
    const cls = [...classes].sort((a, b) => pricedCount(b) - pricedCount(a))[0];
    if (!cls) throw new Error("no seeded class room with priced subjects");
    // Subject with the most priced chapters first: the add-on below needs a
    // genuinely new priced chapter to buy, so a two-priced-topic subject is the
    // least-fragile target.
    const rankedSubs = [...cls.subjects].sort(
      (a, b) => (b.topics ?? []).filter(priced).length - (a.topics ?? []).filter(priced).length
    );
    const pricedSubs = rankedSubs.filter((x) => (x.topics ?? []).some(priced));
    // Prefer two priced subjects; otherwise add a second (possibly unpriced)
    // subject so the per-subject scoping still has two boxes to test.
    const subs =
      pricedSubs.length >= 2
        ? pricedSubs.slice(0, 2)
        : [pricedSubs[0], cls.subjects.find((x) => x.id !== pricedSubs[0].id) ?? pricedSubs[0]];
    const t1 = subs[0].topics.find((t: Topic) => priced(t))!.name;
    const addTopic = (subs[0].topics.filter((t: Topic) => priced(t)).find((t: Topic) => t.name !== t1) ?? subs[0].topics.find((t: Topic) => priced(t)))!.name;
    if (addTopic === t1) throw new Error("seed needs a subject with at least two priced chapters for the add-on");
    const t2 = subs[1].topics?.find((t: Topic) => priced(t))?.name ?? subs[1].topics?.find((t: Topic) => t.name.trim())?.name ?? "";

    // ---- A1. per-subject chapters price only their own subject ----
    console.log("\n[A1] per-subject chapters stay in their own subject");
    const res = await post("/api/student/onboarding/request", {
      boardId: options.boards[0].id,
      classRoomId: cls.id,
      subjectIds: [subs[0].id, subs[1].id],
      wantAssignments: true,
      subjectTopics: {
        [subs[0].id]: { assignment: t1, mock: "", test: "" },
        [subs[1].id]: { assignment: t2, mock: "", test: "" },
      },
      assignmentTopics: [t1, t2].filter(Boolean).join(", "),
      wantMockTests: false,
      mockTopics: "",
      wantRealTests: false,
      testTopics: "",
      wantTutoring: false,
      tutorSubjects: [],
      tutorGoals: "",
      tutorPlan: null,
      tutorHours: null,
    });
    const cj = (await res.json()) as { requestId: string; quotation: { perSubject: { subjectId: string; assignment: { total: number } }[]; totals: { grand: number } } };
    check("request created", res.status === 200 && Boolean(cj.requestId), `status ${res.status}`);
    const perSubject = cj.quotation.perSubject;
    check("quotation has one line per subject", perSubject.length === 2, `got ${perSubject.length}`);
    const grand = perSubject.reduce((sum, q) => sum + q.assignment.total, 0);
    check("grand equals per-subject totals (no cross-mixing)", Math.abs(grand - cj.quotation.totals.grand) < 0.01, `grand ${cj.quotation.totals.grand} vs ${grand}`);

    const state = (await (await get("/api/student/onboarding")).json()) as {
      request: { id: string; subjectTopics: Record<string, { assignment: string[] }>; assignmentTopics: string; locked: boolean };
    };
    check("GET returns the per-subject map", Boolean(state.request?.subjectTopics));
    const s1list = state.request?.subjectTopics?.[subs[0].id]?.assignment ?? [];
    const s2list = state.request?.subjectTopics?.[subs[1].id]?.assignment ?? [];
    check("subject 1 chapter lands only in subject 1", s1list.length === 1 && JSON.stringify(s1list).toLowerCase().includes(t1.toLowerCase()));
    check(
      "subject 2 never inherits subject 1's chapter",
      !JSON.stringify(s2list).toLowerCase().includes(t1.toLowerCase()) && (!t2 || JSON.stringify(s2list).toLowerCase().includes(t2.toLowerCase())),
      JSON.stringify(s2list)
    );
    check(
      "flat union field is the readable fallback",
      (state.request?.assignmentTopics ?? "").toLowerCase().includes(t1.toLowerCase()) &&
        (!t2 || state.request.assignmentTopics.toLowerCase().includes(t2.toLowerCase()))
    );
    check("not locked yet", state.request?.locked === false);

    // ---- A2. lock / edit refusal / unlock ----
    console.log("\n[A2] payment lock refuses edits until decided");
    const lockRes = await post("/api/student/onboarding/lock", { requestId: cj.requestId, lock: true });
    check("lock accepted", lockRes.status === 200, `status ${lockRes.status}`);
    const locked = (await (await get("/api/student/onboarding")).json()) as { request: { locked: boolean } };
    check("state reports locked", locked.request?.locked === true);

    const editLocked = await post("/api/student/onboarding/request", {
      requestId: cj.requestId,
      boardId: options.boards[0].id,
      classRoomId: cls.id,
      subjectIds: [subs[0].id],
      wantAssignments: true,
      subjectTopics: { [subs[0].id]: { assignment: t1, mock: "", test: "" } },
      assignmentTopics: t1,
      wantMockTests: false,
      mockTopics: "",
      wantRealTests: false,
      testTopics: "",
      wantTutoring: false,
      tutorSubjects: [],
      tutorGoals: "",
      tutorPlan: null,
      tutorHours: null,
    });
    check("editing a locked request is refused", editLocked.status === 400 || editLocked.status === 403, `status ${editLocked.status}`);

    const unlockRes = await post("/api/student/onboarding/lock", { requestId: cj.requestId, lock: false });
    check("unlock allowed while nothing is under review", unlockRes.status === 200, `status ${unlockRes.status}`);
    const unlocked = (await (await get("/api/student/onboarding")).json()) as { request: { locked: boolean } };
    check("state reports unlocked after unlock", unlocked.request?.locked === false);
    await post("/api/student/onboarding/lock", { requestId: cj.requestId, lock: true });

    // ---- B1. add-on gets its own 30-day window ----
    console.log("\n[B1] approving the first purchase, then an add-on with its own month");
    await approveRequest(s, admin.id, cj.requestId);
    const activations = await prisma.serviceActivation.findMany({ where: { userId: s.id }, orderBy: { activatedAt: "asc" } });
    check("first purchase opened one activation", activations.length === 1);
    const primary = activations[0];
    check("primary window spans about one month", primary.expiresAt.getTime() - primary.activatedAt.getTime() >= 29 * DAY, `diff ${(primary.expiresAt.getTime() - primary.activatedAt.getTime()) / DAY} d`);
    const [primaryLocked] = await prisma.onboardingRequest.findMany({ where: { userId: s.id, lockedAt: { not: null } }, take: 1, select: { lockedAt: true } });
    check("approval cleared the lock", !primaryLocked);

    const add = await post("/api/student/onboarding/additional", {
      boardId: options.boards[0].id,
      classRoomId: cls.id,
      subjectIds: [subs[0].id],
      wantAssignments: true,
      subjectTopics: { [subs[0].id]: { assignment: [t1, addTopic].filter(Boolean).join(", "), mock: "", test: "" } },
      assignmentTopics: [t1, addTopic].filter(Boolean).join(", "),
      wantMockTests: false,
      mockTopics: "",
      wantRealTests: false,
      testTopics: "",
      wantTutoring: false,
      tutorSubjects: [],
      tutorGoals: "",
      tutorPlan: null,
      tutorHours: null,
    });
    const addJson = (await add.json()) as { requestId: string; quotation: { totals: { grand: number } } };
    check("add-on request created (new chapter priced > 0)", add.status === 200 && Boolean(addJson.requestId) && (addJson.quotation?.totals?.grand ?? 0) > 0, `status ${add.status}`);
    await approveRequest(s, admin.id, addJson.requestId, "ADDITIONAL_SERVICE");
    const afterAdd = await prisma.serviceActivation.findMany({ where: { userId: s.id }, orderBy: { activatedAt: "asc" } });
    const addon = afterAdd[afterAdd.length - 1];
    check("add-on opened a second activation", afterAdd.length === 2);
    // Independence: the add-on window starts now, not at the primary's expiry.
    check(
      "add-on expires independently (not shared with the primary)",
      addon.expiresAt.getTime() !== primary.expiresAt.getTime() && addon.expiresAt.getTime() > primary.expiresAt.getTime() - DAY,
      `primary ${primary.expiresAt.toISOString()} addon ${addon.expiresAt.toISOString()}`
    );

    // ---- B2. subset renewal retires only the named window ----
    console.log("\n[B2] renewal of one subscription only");
    const renewal = await createRenewalRequest(s.id, {
      boardId: options.boards[0].id,
      classRoomId: cls.id,
      subjectIds: [subs[0].id],
      wantAssignments: true,
      assignmentTopics: t1,
      subjectTopics: { [subs[0].id]: { assignment: t1, mock: "", test: "" } },
      wantMockTests: false,
      mockTopics: "",
      wantRealTests: false,
      testTopics: "",
      sameTopicsForMockTests: false,
      wantTutoring: false,
      tutorSubjects: [],
      tutorGoals: "",
      tutorPlan: null,
      tutorHours: null,
      renewsActivationIds: [primary.id],
    });
    check("subset renewal created", renewal.ok && Boolean((renewal as { request: { id: string } }).request?.id));
    if (renewal.ok) {
      const renewalRequest = await prisma.onboardingRequest.findUnique({
        where: { id: (renewal as { request: { id: string } }).request.id },
      });
      const storedTargets = renewalRequest?.renewsActivationIds as unknown as string[] | null;
      const pinned = Boolean(storedTargets && storedTargets.length === 1 && storedTargets[0] === primary.id);
      check("renewsActivationIds pins the primary window", pinned, JSON.stringify(storedTargets));

      await approveRequest(s, admin.id, renewalRequest!.id, "RENEWAL");
      const afterRenewal = await prisma.serviceActivation.findMany({ where: { userId: s.id }, orderBy: { activatedAt: "asc" } });
      const renewedPrimary = afterRenewal.find((a) => a.id === primary.id);
      const addonStillLive = afterRenewal.find((a) => a.id === addon.id);
      check("primary window was ended by the renewal", !renewedPrimary || renewedPrimary.expiresAt.getTime() <= Date.now());
      check(
        "add-on window was NOT ended (subset renewal)",
        addonStillLive !== undefined && addonStillLive.expiresAt.getTime() > Date.now(),
        addonStillLive ? addonStillLive.expiresAt.toISOString() : "missing"
      );
      const fresh = afterRenewal.find((a) => a.id !== primary.id && a.id !== addon.id);
      check("a fresh window opened for the renewed subscription", Boolean(fresh));
    }
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [s.id, admin.id] } } }).catch(() => {});
  }

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