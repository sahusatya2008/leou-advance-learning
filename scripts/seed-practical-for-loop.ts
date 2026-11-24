/**
 * Seeds the Class 11 "Getting Started with Python" for-loop exercise set.
 *
 * The chapter already has one practical set (created by
 * `seed-practical-while-loop.ts`) and the schema allows exactly one set per
 * (batch, subject, chapter). So this script does not create a second set: it
 * adds the for-loop questions to that set, after the while-loop block, and
 * re-tags the three questions the textbook already poses as for-loop exercises.
 *
 * Idempotent by construction:
 *   - a question is matched on its exact stem (with a whitespace/punctuation
 *     insensitive fallback) inside the class/subject, so a re-run patches the
 *     existing row instead of inserting a duplicate;
 *   - membership is matched on (assignmentId, questionId);
 *   - the final order is recomputed and only written when it differs.
 *
 * It writes through Prisma rather than the admin HTTP API so it needs no admin
 * password, and it repeats the same guards the API applies: the class must be
 * active, CS must be allotted to it, the batch must take CS, and the chapter
 * must exist as a pricing item of that batch (that is the string students'
 * entitlements are matched against).
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/seed-practical-for-loop.ts
 *
 * Env:
 *   DRY_RUN=1   report what would change without writing
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  SEED_QUESTIONS,
  CHAPTER,
  SEED_TITLE,
  SEED_INSTRUCTIONS,
  FOR_LOOP_TAGS,
  VERY_IMPORTANT_TAG,
  type SeedQuestion,
} from "./data/practicalForLoopQuestions";

const DRY_RUN = process.env.DRY_RUN === "1";

/** Stem comparison that ignores case, collapsed whitespace and a trailing dot,
 *  so a question written slightly differently is still recognised. */
const norm = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").replace(/[.]+$/, "").trim();

type ExistingQuestion = { id: string; stem: string; tags: unknown };

function mergeForLoopTags(current: unknown, important: boolean): string[] {
  const list = Array.isArray(current) ? current.map(String) : [];
  // These questions are for-loop exercises now; leaving the old while-loop tag
  // would put them in the wrong concept group on the student page.
  const keep = list.filter((t) => t !== "while-loop" && t !== VERY_IMPORTANT_TAG);
  const next = [...FOR_LOOP_TAGS, ...keep];
  if (important) next.push(VERY_IMPORTANT_TAG);
  return [...new Set(next)];
}

function questionFields(seed: SeedQuestion, classRoomId: string, subjectId: string) {
  if (!seed.starterCode || !seed.solutionCode || !seed.explanation || !seed.testCases?.length) {
    throw new Error(`${seed.key}: incomplete seed entry (starter, solution, explanation and tests are required)`);
  }
  return {
    type: "CODING" as const,
    classRoomId,
    subjectId,
    difficulty: seed.difficulty,
    topic: CHAPTER,
    isPractical: true,
    tags: [...FOR_LOOP_TAGS, ...(seed.important ? [VERY_IMPORTANT_TAG] : [])],
    stem: seed.stem.trim(),
    explanation: seed.explanation.trim(),
    allowedLanguages: ["python"] as never,
    starterCode: { python: seed.starterCode } as never,
    solutionCode: seed.solutionCode,
  };
}

function testCases(seed: SeedQuestion) {
  return (seed.testCases ?? []).map((t, i) => ({
    input: t.stdin,
    expected: t.expected,
    isHidden: true,
    weight: 1,
    sortOrder: i,
  }));
}

async function main() {
  console.log(`\nseeding "${CHAPTER}" for-loop set${DRY_RUN ? " (dry run)" : ""}`);

  // ---- scope: Class 11 / CS / the batch that priced this chapter --------
  const classRoom = await prisma.classRoom.findFirst({ where: { name: "Class 11", isActive: true } });
  if (!classRoom) throw new Error('no active class named "Class 11"');

  const subject = await prisma.subject.findFirst({ where: { code: "CS" } });
  if (!subject) throw new Error("no subject with code CS");

  const allotted = await prisma.subjectClass.findUnique({
    where: { subjectId_classRoomId: { subjectId: subject.id, classRoomId: classRoom.id } },
  });
  if (!allotted) throw new Error("CS is not allotted to Class 11");

  const batch = await prisma.batch.findFirst({
    where: {
      classRoomId: classRoom.id,
      isActive: true,
      subjects: { some: { subjectId: subject.id } },
      pricingItems: { some: { subjectId: subject.id, name: CHAPTER } },
    },
    select: { id: true, name: true },
  });
  if (!batch)
    throw new Error(
      `no active Class 11 batch takes CS and prices the chapter "${CHAPTER}" - students could not be entitled to it`,
    );

  console.log(`  class=${classRoom.name} subject=${subject.code} batch="${batch.name}" chapter="${CHAPTER}"`);

  // ---- resolve every seed entry to a question row ----------------------
  const existing: ExistingQuestion[] = await prisma.question.findMany({
    where: { classRoomId: classRoom.id, subjectId: subject.id },
    select: { id: true, stem: true, tags: true },
  });
  const byExact = new Map(existing.map((q) => [q.stem, q]));
  const byNorm = new Map<string, ExistingQuestion[]>();
  for (const q of existing) {
    const k = norm(q.stem);
    byNorm.set(k, [...(byNorm.get(k) ?? []), q]);
  }

  const resolve = (stem: string): ExistingQuestion | undefined => {
    const exact = byExact.get(stem);
    if (exact) return exact;
    const candidates = byNorm.get(norm(stem)) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  const idOf = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let retagged = 0;

  for (const seed of SEED_QUESTIONS) {
    if (seed.reuseExisting) {
      const found = resolve(seed.stem);
      if (!found) throw new Error(`${seed.key}: expected to find an existing question for this stem, found none`);
      idOf.set(seed.key, found.id);
      const tags = mergeForLoopTags(found.tags, Boolean(seed.important));
      const before = JSON.stringify(Array.isArray(found.tags) ? found.tags : []);
      if (before !== JSON.stringify(tags)) {
        retagged++;
        if (!DRY_RUN) {
          await prisma.question.update({ where: { id: found.id }, data: { tags, isPractical: true } });
        }
        console.log(`  ok   ${seed.key} re-tag (existing question, content untouched) ${tags.join(", ")}`);
      } else {
        console.log(`  ok   ${seed.key} reuse (already tagged)`);
      }
      continue;
    }

    const fields = questionFields(seed, classRoom.id, subject.id);
    const found = resolve(seed.stem);

    if (found) {
      idOf.set(seed.key, found.id);
      updated++;
      if (!DRY_RUN) {
        await prisma.question.update({
          where: { id: found.id },
          data: { ...fields, testCases: { deleteMany: {}, create: testCases(seed) } },
        });
      }
      console.log(`  ok   ${seed.key} update${seed.important ? " \u2605" : ""}`);
    } else {
      created++;
      if (DRY_RUN) {
        idOf.set(seed.key, `(new:${seed.key})`);
      } else {
        const row = await prisma.question.create({
          data: { ...fields, testCases: { create: testCases(seed) } },
          select: { id: true },
        });
        idOf.set(seed.key, row.id);
      }
      console.log(`  ok   ${seed.key} create${seed.important ? " \u2605" : ""}`);
    }
  }

  // ---- the chapter's practical set --------------------------------------
  // One set per (batch, subject, chapter) is a schema invariant, so an existing
  // set is updated rather than a second one created. Its status is deliberately
  // not touched: an already-published set must stay published throughout.
  const existingAssignment = await prisma.practicalAssignment.findUnique({
    where: {
      batchId_subjectId_topic: { batchId: batch.id, subjectId: subject.id, topic: CHAPTER },
    },
    select: { id: true, status: true },
  });
  const assignment =
    existingAssignment ??
    (DRY_RUN
      ? { id: "(new assignment)", status: "DRAFT" as const }
      : await prisma.practicalAssignment.create({
          data: {
            batchId: batch.id,
            subjectId: subject.id,
            topic: CHAPTER,
            title: SEED_TITLE,
            instructions: SEED_INSTRUCTIONS,
            status: "DRAFT",
          },
          select: { id: true, status: true },
        }));

  if (DRY_RUN) {
    console.log(
      existingAssignment
        ? `  set ${assignment.id} (existing, title/instructions would be updated)`
        : "  set would be created",
    );
  } else if (existingAssignment) {
    await prisma.practicalAssignment.update({
      where: { id: assignment.id },
      data: { title: SEED_TITLE, instructions: SEED_INSTRUCTIONS },
    });
  }

  const seedIds = SEED_QUESTIONS.map((s) => idOf.get(s.key)).filter((id): id is string => Boolean(id));
  if (seedIds.length !== SEED_QUESTIONS.length)
    throw new Error(`only ${seedIds.length}/${SEED_QUESTIONS.length} seed entries resolved to a question`);

  const memberships = await prisma.practicalAssignmentQuestion.findMany({
    where: { assignmentId: assignment.id },
    orderBy: { order: "asc" },
    select: { questionId: true, order: true },
  });
  const present = new Set(memberships.map((m) => m.questionId));

  let added = 0;
  let nextOrder = (memberships.at(-1)?.order ?? 0) + 1;
  for (const id of seedIds) {
    if (present.has(id)) continue;
    added++;
    if (!DRY_RUN) {
      await prisma.practicalAssignmentQuestion.create({
        data: { assignmentId: assignment.id, questionId: id, order: nextOrder },
      });
    }
    present.add(id);
    nextOrder++;
  }

  // While-loop block keeps its current order; the whole for-loop set follows it
  // in exercise-sheet order (Q1 ... Q48).
  const seedSet = new Set(seedIds);
  const base = memberships.map((m) => m.questionId).filter((id) => !seedSet.has(id));
  const desired = [...base, ...seedIds];

  const after = await prisma.practicalAssignmentQuestion.findMany({
    where: { assignmentId: assignment.id },
    orderBy: { order: "asc" },
    select: { questionId: true, order: true },
  });
  const current = after.map((m) => m.questionId);
  const orderDiffers = current.length !== desired.length || current.some((id, i) => id !== desired[i]);

  if (orderDiffers) {
    if (DRY_RUN) {
      console.log(`  would reorder the set: ${current.length} current -> ${desired.length} desired`);
    } else {
      await prisma.$transaction(
        desired.map((questionId, index) =>
          prisma.practicalAssignmentQuestion.update({
            where: { assignmentId_questionId: { assignmentId: assignment.id, questionId } },
            data: { order: index + 1 },
          }),
        ),
      );
      console.log(`  reordered the set: while block first, then for-loop Q1..Q48 (${desired.length} questions)`);
    }
  }

  // ---- publish, but only a non-empty set -------------------------------
  if (assignment.status !== "PUBLISHED") {
    const count = await prisma.practicalAssignmentQuestion.count({ where: { assignmentId: assignment.id } });
    if (count === 0) throw new Error("refusing to publish a practical set with no questions");
    if (!DRY_RUN) {
      await prisma.practicalAssignment.update({
        where: { id: assignment.id },
        data: { status: "PUBLISHED" },
      });
    }
    console.log(`  published (${count} questions)`);
  }

  // ---- verify ---------------------------------------------------------
  if (DRY_RUN) {
    console.log(`\n  dry run: created=${created} updated=${updated} re-tagged=${retagged} added-to-set=${added}`);
    return;
  }

  const final = await prisma.practicalAssignmentQuestion.findMany({
    where: { assignmentId: assignment.id },
    orderBy: { order: "asc" },
    select: { order: true, questionId: true },
  });
  const finalIds = new Set(final.map((m) => m.questionId));
  const missing = SEED_QUESTIONS.filter((s) => !finalIds.has(idOf.get(s.key)!));
  const tagged = await prisma.question.findMany({
    where: { id: { in: seedIds } },
    select: { id: true, tags: true },
  });
  const withTag = tagged.filter((q) => Array.isArray(q.tags) && (q.tags as string[]).includes("for-loop")).length;
  const stars = tagged.filter((q) => Array.isArray(q.tags) && (q.tags as string[]).includes(VERY_IMPORTANT_TAG)).length;

  console.log(`\n  created=${created} updated=${updated} re-tagged=${retagged} added-to-set=${added}`);
  console.log(`  set ${assignment.id}: ${final.length} questions, for-loop tagged ${withTag}, very-important ${stars}`);
  console.log(`  seed entries present in the set: ${SEED_QUESTIONS.length - missing.length}/${SEED_QUESTIONS.length}`);
  if (missing.length) throw new Error(`missing from the set: ${missing.map((m) => m.key).join(", ")}`);
  console.log(`  order: ${final.map((m) => m.order).join(",")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
