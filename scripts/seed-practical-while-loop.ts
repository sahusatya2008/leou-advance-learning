/**
 * Seeds the Class 11 "Getting Started with Python" while-loop exercise set.
 *
 * Idempotent by construction: a question is matched on its exact stem within
 * the class/subject, so re-running the script patches the existing row in place
 * instead of inserting a duplicate. Nothing outside this set is touched.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/seed-practical-while-loop.ts
 *
 * Options (env):
 *   BASE_URL        app origin            (default http://127.0.0.1:3001)
 *   ADMIN_IDENTIFIER / ADMIN_PASSWORD      (default admin / admin123)
 *   DRY_RUN=1       report what would change without writing
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { SEED_QUESTIONS, WHILE_LOOP_TAGS, VERY_IMPORTANT_TAG, CHAPTER, SEED_TITLE } from "./data/practicalWhileLoopQuestions";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const IDENTIFIER = process.env.ADMIN_IDENTIFIER ?? "admin";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";
const DRY_RUN = process.env.DRY_RUN === "1";

let cookie = "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  // The admin API is rate limited, and this script makes ~90 writes in a row.
  // Pace it, and back off rather than failing when the limiter still bites.
  for (let attempt = 0; ; attempt++) {
    await sleep(250);
    const res = await once<T>(method, path, body);
    if (res.status !== 429 || attempt >= 8) return res;
    await sleep(1000 * (attempt + 1));
  }
}

async function once<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? res.headers.get("set-cookie");
  if (setCookie) {
    const first = (Array.isArray(setCookie) ? setCookie : [setCookie])[0];
    if (first) cookie = first.split(";")[0] ?? cookie;
  }
  const text = await res.text();
  let json = {} as T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    /* leave empty */
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\nseeding "${CHAPTER}" while-loop set → ${BASE}${DRY_RUN ? " (dry run)" : ""}`);

  // ---- scope: Class 11 / CS / B Code Brain / this chapter -------------
  const classRoom = await prisma.classRoom.findFirst({ where: { name: "Class 11", isActive: true } });
  if (!classRoom) throw new Error('no active class named "Class 11"');
  const subject = await prisma.subject.findFirst({ where: { code: "CS" } });
  if (!subject) throw new Error("no subject with code CS");

  const allotted = await prisma.subjectClass.findUnique({
    where: { subjectId_classRoomId: { subjectId: subject.id, classRoomId: classRoom.id } },
  });
  if (!allotted) throw new Error("CS is not allotted to Class 11");

  const batch = await prisma.batch.findFirst({
    where: { classRoomId: classRoom.id, subjects: { some: { subjectId: subject.id } } },
    select: {
      id: true,
      name: true,
      pricingItems: { where: { subjectId: subject.id }, select: { name: true } },
    },
  });
  if (!batch) throw new Error("no Class 11 batch takes CS");
  const chapter = batch.pricingItems.find((p) => p.name === CHAPTER);
  if (!chapter) {
    throw new Error(`batch "${batch.name}" has no pricing item named "${CHAPTER}"; found: ${batch.pricingItems.map((p) => p.name).join(", ") || "(none)"}`);
  }

  const login = await api("POST", "/api/auth/login", {
    mode: "password",
    identifier: IDENTIFIER,
    password: PASSWORD,
  });
  if (login.status !== 200 && login.status !== 201) throw new Error(`admin login failed (${login.status})`);

  console.log(`  class=${classRoom.name} subject=${subject.code} batch="${batch.name}" chapter="${CHAPTER}"`);

  // ---- write the questions -------------------------------------------
  const existing = await prisma.question.findMany({
    where: { classRoomId: classRoom.id, subjectId: subject.id },
    select: { id: true, stem: true },
  });
  const byStem = new Map(existing.map((q) => [q.stem, q.id]));

  let created = 0;
  let updated = 0;
  const ids: string[] = [];

  for (const [index, seed] of SEED_QUESTIONS.entries()) {
    const payload = {
      type: "CODING",
      classRoomId: classRoom.id,
      subjectId: subject.id,
      difficulty: seed.difficulty,
      topic: CHAPTER,
      isPractical: true,
      tags: seed.important ? [VERY_IMPORTANT_TAG, ...WHILE_LOOP_TAGS] : WHILE_LOOP_TAGS,
      stem: seed.stem,
      explanation: seed.explanation,
      allowedLanguages: ["python"],
      starterCode: { python: seed.starterCode },
      solutionCode: seed.solutionCode,
      testCases: seed.testCases.map((t) => ({
        input: t.stdin,
        expected: t.expected,
        isHidden: true,
        weight: 1,
      })),
    };

    if (DRY_RUN) {
      const exists = byStem.has(seed.stem);
      if (exists) updated++;
      else created++;
      ids.push(byStem.get(seed.stem) ?? "(new)");
      continue;
    }

    const existingId = byStem.get(seed.stem);
    if (existingId) {
      const res = await api<{ error?: string }>("PATCH", `/api/admin/questions/${existingId}`, payload);
      if (res.status !== 200) throw new Error(`${seed.key} patch failed (${res.status}): ${res.json.error ?? ""}`);
      updated++;
      ids.push(existingId);
      console.log(`  ok   ${String(index + 1).padStart(2, "0")}/${SEED_QUESTIONS.length} update ${seed.key}${seed.important ? " ★" : ""}`);
    } else {
      const res = await api<{ question?: { id: string }; error?: string }>("POST", "/api/admin/questions", payload);
      if (res.status !== 201 || !res.json.question) throw new Error(`${seed.key} create failed (${res.status}): ${res.json.error ?? ""}`);
      created++;
      byStem.set(seed.stem, res.json.question.id);
      ids.push(res.json.question.id);
      console.log(`  ok   ${String(index + 1).padStart(2, "0")}/${SEED_QUESTIONS.length} create ${seed.key}${seed.important ? " ★" : ""}`);
    }
  }

  // ---- the practical set for this chapter ------------------------------
  const stemToId = byStem;
  const upsert = await api<{ id?: string; error?: string }>("POST", "/api/admin/practical", {
    action: "create",
    batchId: batch.id,
    subjectId: subject.id,
    topic: CHAPTER,
    title: SEED_TITLE,
    instructions:
      "Work through these while-loop exercises one at a time. Run your code in the terminal, " +
      "save often, and raise a doubt on any question you get stuck on - your code and terminal " +
      "output are attached automatically so the teacher sees exactly what you saw.",
    // No status here: publishing an empty set is refused by the API, so the
    // set is created (or its existing status left alone) first and published
    // only once every question has joined.
  });
  if (upsert.status !== 200 || !upsert.json.id) throw new Error(`set upsert failed (${upsert.status}): ${upsert.json.error ?? ""}`);
  const assignmentId = String(upsert.json.id);

  type SetQuestion = { questionId: string; stem: string };
  const getSet = async () => {
    const res = await api<{ assignment?: { questions: SetQuestion[]; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" } | null }>(
      "GET",
      `/api/admin/practical?batchId=${encodeURIComponent(batch.id)}&subjectId=${encodeURIComponent(subject.id)}&topic=${encodeURIComponent(CHAPTER)}`,
    );
    const assignment = res.json.assignment;
    if (!assignment) throw new Error("the set disappeared after it was created");
    return assignment;
  };

  let set = await getSet();
  const existingIds = new Set(set.questions.map((q) => q.questionId));
  let added = 0;
  for (const seed of SEED_QUESTIONS) {
    const qid = stemToId.get(seed.stem);
    if (!qid || existingIds.has(qid)) {
      if (DRY_RUN && qid && !existingIds.has(qid)) added++;
      continue;
    }
    if (DRY_RUN) continue;
    const res = await api<{ error?: string }>("POST", "/api/admin/practical", {
      action: "add",
      assignmentId,
      questionId: qid,
    });
    if (res.status !== 200) throw new Error(`${seed.key} could not join the set (${res.status}): ${res.json.error ?? ""}`);
    existingIds.add(qid);
    added++;
  }

  // Questions are appended in arrival order, so force the set back to the
  // order the exercise sheet is written in.
  const wanted = SEED_QUESTIONS.map((s) => stemToId.get(s.stem)).filter((id): id is string => Boolean(id));
  set = await getSet();
  const current = set.questions.map((q) => q.questionId);
  const orderDiffers = current.length !== wanted.length || current.some((id, i) => id !== wanted[i]);
  if (orderDiffers && !DRY_RUN) {
    const reordered = await api<{ error?: string }>("POST", "/api/admin/practical", {
      action: "reorder",
      assignmentId,
      orderedQuestionIds: wanted,
    });
    if (reordered.status !== 200) throw new Error(`reorder failed (${reordered.status}): ${reordered.json.error ?? ""}`);
    set = await getSet();
    console.log("  reordered the set into exercise-sheet order");
  }
  if (orderDiffers && DRY_RUN) console.log(`  would reorder the set into exercise-sheet order (${current.length} → ${wanted.length})`);
  if (set.status !== "PUBLISHED" && !DRY_RUN) {
    const publish = await api<{ error?: string }>("POST", "/api/admin/practical", {
      action: "create",
      batchId: batch.id,
      subjectId: subject.id,
      topic: CHAPTER,
      status: "PUBLISHED",
    });
    if (publish.status !== 200) throw new Error(`publish failed (${publish.status}): ${publish.json.error ?? ""}`);
    set = await getSet();
    console.log("  published");
  }
  if (set.status !== "PUBLISHED" && DRY_RUN) console.log(`  would publish (currently ${set.status})`);
  console.log(`  set ${assignmentId} status=${set.status} questions=${set.questions.length} added=${added}`);

  // ---- report ---------------------------------------------------------
  const total = await prisma.question.count({
    where: { classRoomId: classRoom.id, subjectId: subject.id, topic: CHAPTER, isPractical: true },
  });
  // Json columns have no `has` filter, so check the list in code.
  const inChapter = await prisma.question.findMany({
    where: { classRoomId: classRoom.id, subjectId: subject.id, topic: CHAPTER, isPractical: true },
    select: { tags: true },
  });
  const tagged = inChapter.filter((q) => Array.isArray(q.tags) && q.tags.includes("while-loop")).length;

  console.log(`\n  created=${created} updated=${updated}`);
  console.log(`  practical questions in "${CHAPTER}": ${total}, tagged while-loop: ${tagged}`);
  console.log(`  ids: ${ids.join(",")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
