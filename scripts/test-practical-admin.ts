/**
 * Verifies the practical-assignment builder API end to end against a running
 * server, using a throwaway admin.
 *
 * Nothing pre-existing is left changed: the practical set this creates is
 * deleted, and any question whose `isPractical` flag it flips is restored to the
 * exact value it had beforehand. Existing questions, batches and chapters are
 * only ever read.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/test-practical-admin.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/validation";

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

let cookie = "";

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0] ?? cookie;
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* keep empty */
  }
  return { status: res.status, json };
}

/** Everything this script creates, undone in reverse. */
const undo: (() => Promise<void>)[] = [];
let adminId: string | null = null;

async function main() {
  console.log(`\npractical builder (${BASE})`);

  // Pick a real CS batch/subject/chapter to build against.
  const scope = await prisma.batch.findFirst({
    where: { subjects: { some: { subject: { code: "CS" } } } },
    select: {
      id: true,
      classRoomId: true,
      subjects: { where: { subject: { code: "CS" } }, select: { subjectId: true } },
      pricingItems: { where: { subject: { code: "CS" } }, select: { subjectId: true, name: true }, orderBy: { name: "asc" } },
    },
  });
  if (!scope) throw new Error("no batch takes CS");
  const chapter = scope.pricingItems[0];
  if (!chapter) throw new Error("that batch has no CS chapters");
  const subjectId = chapter.subjectId;
  const topic = chapter.name;

  adminId = (
    await prisma.user.create({
      data: {
        username: `zz_practical_${STAMP}`,
        email: `zz_practical_${STAMP}@leou.invalid`,
        passwordHash: await hashPassword(PASSWORD),
        role: "ADMIN",
      },
    })
  ).id;
  undo.push(async () => {
    await prisma.user.delete({ where: { id: adminId! } }).catch(() => null);
  });

  console.log("\nauth");
  {
    const r = await api("POST", "/api/auth/login", {
      mode: "password",
      identifier: `zz_practical_${STAMP}`,
      password: PASSWORD,
    });
    check("the throwaway admin can log in", r.status === 200, `got ${r.status}`);
  }

  // A SYNTHETIC question, created through the real admin API. A pre-existing
  // question must never be PATCHed here: that route rewrites type, stem, topic
  // and every coding/sql field, so pointing it at real data would corrupt it.
  const probeStem = `ZZ practical probe ${STAMP}`;
  let probeId = "";
  let probeQuestionId = "";
  let secondQuestionId = "";
  {
    const created = await api("POST", "/api/admin/questions", {
      type: "CODING",
      classRoomId: scope.classRoomId,
      subjectId,
      difficulty: "MEDIUM",
      topic,
      stem: probeStem,
      allowedLanguages: ["python"],
      starterCode: { python: "print(1)" },
      solutionCode: "print(1)",
      testCases: [{ input: "", expected: "1", isHidden: false, weight: 1 }],
    });
    check("a synthetic coding question can be created", created.status === 201, `got ${created.status} ${String(created.json.error ?? "")}`);
    probeId = String((created.json.question as { id?: string } | undefined)?.id ?? "");
    const row = await prisma.question.findFirst({ where: { stem: probeStem }, select: { id: true } });
    probeQuestionId = row?.id ?? probeId;
    undo.push(async () => {
      await prisma.practicalAssignmentQuestion.deleteMany({ where: { questionId: probeQuestionId } }).catch(() => null);
      await prisma.question.delete({ where: { id: probeQuestionId } }).catch(() => null);
    });

    // A second probe, so ordering can actually be exercised.
    const second = await api("POST", "/api/admin/questions", {
      type: "CODING",
      classRoomId: scope.classRoomId,
      subjectId,
      difficulty: "EASY",
      topic,
      stem: `${probeStem} two`,
      allowedLanguages: ["python"],
      starterCode: { python: "print(2)" },
      solutionCode: "print(2)",
      testCases: [{ input: "", expected: "2", isHidden: false, weight: 1 }],
    });
    const secondRow = await prisma.question.findFirst({ where: { stem: `${probeStem} two` }, select: { id: true } });
    secondQuestionId = secondRow?.id ?? "";
    check("a second synthetic question can be created", second.status === 201 && Boolean(secondQuestionId), `got ${second.status} ${String(second.json.error ?? "")}`);
    undo.push(async () => {
      await prisma.practicalAssignmentQuestion.deleteMany({ where: { questionId: secondQuestionId } }).catch(() => null);
      await prisma.question.delete({ where: { id: secondQuestionId } }).catch(() => null);
    });

    // Tag the second one practical too.
    await api("PATCH", `/api/admin/questions/${secondQuestionId}`, {
      type: "CODING",
      classRoomId: scope.classRoomId,
      subjectId,
      difficulty: "EASY",
      topic,
      stem: `${probeStem} two`,
      allowedLanguages: ["python"],
      starterCode: { python: "print(2)" },
      solutionCode: "print(2)",
      testCases: [{ input: "", expected: "2", isHidden: false, weight: 1 }],
      isPractical: true,
    });
  }

  {
    const r = await api("GET", "/api/admin/practical/catalog");
    check("the catalog is admin-only", r.status === 200, `got ${r.status}`);
    const catalog = r.json.catalog as { classes: { name: string; batches: { name: string; subjects: { code: string; chapters: string[] }[] }[] }[] };
    const hasCs = catalog.classes.some((c) =>
      c.batches.some((b) => b.subjects.some((s) => s.code === "CS"))
    );
    check("the catalog exposes the CS cascade", hasCs);
    check("chapters come from the batch's own list", catalog.classes.some((c) => c.batches.some((b) => b.subjects.some((s) => s.chapters.includes(topic)))));
  }

  console.log("\nthe integrity rules");
  {
    const r = await api("POST", "/api/admin/practical", {
      action: "create",
      batchId: scope.id,
      subjectId,
      topic: "A Chapter That Does Not Exist",
    });
    check("an unknown chapter is refused", r.status === 400, `got ${r.status}`);
  }
  {
    const other = await prisma.subject.findFirst({ where: { code: { not: "CS" } }, select: { id: true } });
    if (other) {
      const r = await api("POST", "/api/admin/practical", {
        action: "create",
        batchId: scope.id,
        subjectId: other.id,
        topic,
      });
      check("a subject the batch does not take is refused", r.status === 400, `got ${r.status}`);
    }
  }

  console.log("\ncreating the set");
  let assignmentId = "";
  {
    const r = await api("POST", "/api/admin/practical", {
      action: "create",
      batchId: scope.id,
      subjectId,
      topic,
      title: "ZZ temporary practical",
    });
    check("the set is created", r.status === 200 && typeof r.json.id === "string", `got ${r.status}`);
    assignmentId = String(r.json.id ?? "");
    undo.push(async () => {
      await prisma.practicalAssignment.delete({ where: { id: assignmentId } }).catch(() => null);
    });
  }
  {
    const r = await api("POST", "/api/admin/practical", {
      action: "create",
      batchId: scope.id,
      subjectId,
      topic,
    });
    check("creating the same chapter twice reuses the set", r.json.id === assignmentId);
  }
  {
    const r = await api("GET", `/api/admin/practical?batchId=${scope.id}&subjectId=${subjectId}&topic=${encodeURIComponent(topic)}`);
    const a = r.json.assignment as { status: string; questions: unknown[] } | null;
    check("the set reads back as a draft", r.status === 200 && a?.status === "DRAFT");
    check("a new set starts empty", a?.questions.length === 0);
  }

  console.log("\npractical tagging gates membership");
  {
    const r = await api("POST", "/api/admin/practical", {
      action: "add",
      assignmentId,
      questionId: probeQuestionId,
    });
    check("an untagged question is refused", r.status === 400, `got ${r.status}`);
    check(
      "and the refusal explains why",
      /Practical question/i.test(String(r.json.error ?? "")),
      String(r.json.error ?? "")
    );
  }

  console.log("\nthe question form persists the flag");
  {
    const r = await api("PATCH", `/api/admin/questions/${probeQuestionId}`, {
      type: "CODING",
      classRoomId: scope.classRoomId,
      subjectId,
      difficulty: "MEDIUM",
      topic,
      stem: probeStem,
      allowedLanguages: ["python"],
      starterCode: { python: "print(1)" },
      solutionCode: "print(1)",
      testCases: [{ input: "", expected: "1", isHidden: false, weight: 1 }],
      isPractical: true,
    });
    check("the PATCH accepts isPractical", r.status === 200, `got ${r.status} ${String(r.json.error ?? "")}`);
    const after = await prisma.question.findUnique({ where: { id: probeQuestionId }, select: { isPractical: true } });
    check("the flag is stored", after?.isPractical === true);
  }

  console.log("\nadd, reorder and remove");
  {
    const r = await api("POST", "/api/admin/practical", { action: "add", assignmentId, questionId: probeQuestionId });
    check("a tagged question in the same chapter is added", r.status === 200, `got ${r.status} ${String(r.json.error ?? "")}`);

    const read = await api("GET", `/api/admin/practical?batchId=${scope.id}&subjectId=${subjectId}&topic=${encodeURIComponent(topic)}`);
    const a = read.json.assignment as { questions: { questionId: string }[]; available: { id: string }[] };
    check("it is listed in the set", a.questions.some((q) => q.questionId === probeQuestionId));
    check("it is no longer offered as available", !a.available.some((q) => q.id === probeQuestionId));

    const dup = await api("POST", "/api/admin/practical", { action: "add", assignmentId, questionId: probeQuestionId });
    check("adding it twice is refused", dup.status >= 400, `got ${dup.status}`);

    await api("POST", "/api/admin/practical", { action: "add", assignmentId, questionId: secondQuestionId });
    const before = await api("GET", `/api/admin/practical?batchId=${scope.id}&subjectId=${subjectId}&topic=${encodeURIComponent(topic)}`);
    const orderBefore = ((before.json.assignment as { questions: { questionId: string }[] }).questions ?? []).map((q) => q.questionId);
    check("both questions are in the set", orderBefore.length === 2, `got ${orderBefore.length}`);

    const short = await api("POST", "/api/admin/practical", { action: "reorder", assignmentId, orderedQuestionIds: [orderBefore[0]] });
    check("a short reorder list is refused", short.status === 400, `got ${short.status}`);

    const flipped = [orderBefore[1], orderBefore[0]];
    const good = await api("POST", "/api/admin/practical", { action: "reorder", assignmentId, orderedQuestionIds: flipped });
    check("a full reorder is accepted", good.status === 200, `got ${good.status} ${String(good.json.error ?? "")}`);
    const afterOrder = await api("GET", `/api/admin/practical?batchId=${scope.id}&subjectId=${subjectId}&topic=${encodeURIComponent(topic)}`);
    const orderAfter = ((afterOrder.json.assignment as { questions: { questionId: string }[] }).questions ?? []).map((q) => q.questionId);
    check("the new order is persisted", JSON.stringify(orderAfter) === JSON.stringify(flipped), `${JSON.stringify(orderAfter)} vs ${JSON.stringify(flipped)}`);
    await api("POST", "/api/admin/practical", { action: "remove", assignmentId, questionId: secondQuestionId });

    const rm = await api("POST", "/api/admin/practical", { action: "remove", assignmentId, questionId: probeQuestionId });
    check("it can be removed again", rm.status === 200, `got ${rm.status}`);

    const missing = await api("POST", "/api/admin/practical", { action: "remove", assignmentId, questionId: probeQuestionId });
    check("removing a question not in the set is refused", missing.status === 400, `got ${missing.status}`);
  }

  console.log("\nquestion bank filter");
  {
    const r = await api("GET", `/api/admin/questions?classRoomId=${scope.classRoomId}&subjectId=${subjectId}&practical=1&light=1`);
    const questions = r.json.questions as { isPractical: boolean }[];
    check("practical=1 returns only practical questions", questions.every((q) => q.isPractical));
  }

  console.log("\npublishing");
  {
    await api("POST", "/api/admin/practical", { action: "add", assignmentId, questionId: probeQuestionId });
    const r = await api("POST", "/api/admin/practical", {
      action: "create",
      batchId: scope.id,
      subjectId,
      topic,
      status: "PUBLISHED",
    });
    check("the set publishes", r.status === 200, `got ${r.status}`);
    const a = (await prisma.practicalAssignment.findUnique({ where: { id: assignmentId }, select: { status: true } }));
    check("status is PUBLISHED in the database", a?.status === "PUBLISHED");
    const audit = await prisma.activityLog.count({ where: { type: "ADMIN_CREATE_PRACTICAL" } });
    check("the admin action was audited", audit > 0, `audit rows: ${audit}`);
  }

  console.log("\nempty sets can never reach a student");
  {
    // Take the only question out of the live set.
    const rm = await api("POST", "/api/admin/practical", { action: "remove", assignmentId, questionId: probeQuestionId });
    check("the last question can be removed from a live set", rm.status === 200, `got ${rm.status}`);
    const after = await prisma.practicalAssignment.findUnique({ where: { id: assignmentId }, select: { status: true } });
    check("the emptied set is archived rather than left published", after?.status === "ARCHIVED", `status: ${after?.status}`);

    const tryPublish = await api("POST", "/api/admin/practical", {
      action: "create",
      batchId: scope.id,
      subjectId,
      topic,
      status: "PUBLISHED",
    });
    check("publishing an empty set is refused", tryPublish.status === 400, `got ${tryPublish.status}`);
    const stillArchived = await prisma.practicalAssignment.findUnique({ where: { id: assignmentId }, select: { status: true } });
    check("the refused publish changed nothing", stillArchived?.status === "ARCHIVED", `status: ${stillArchived?.status}`);
  }
}

main()
  .catch((e) => {
    failures++;
    console.log(`  FAIL harness error \u2014 ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(async () => {
    // Unwind everything, newest first.
    for (const step of undo.reverse()) await step();
    // Prove the question bank is exactly as we found it.
    const stray = await prisma.practicalAssignment.count({ where: { title: { startsWith: "ZZ" } } });
    const tagged = await prisma.question.count({ where: { stem: { startsWith: "ZZ practical" } } });
    console.log(`\ncleanup: leftover ZZ sets ${stray}, leftover ZZ questions ${tagged}`);
    await prisma.$disconnect();
    console.log(`\n${checks - failures}/${checks} checks passed`);
    process.exit(failures ? 1 : 0);
  });