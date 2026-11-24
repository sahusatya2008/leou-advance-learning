/**
 * Seeds the Class 11 Mathematics "Trigonometric Functions" photo-upload set:
 * 100 corrected worksheet questions in the bank, plus 10 released assignments
 * of 10 questions each, in worksheet order.
 *
 * Every question is type UPLOAD: the student writes the answer on paper,
 * photographs it and uploads it against the question; the answer lands in the
 * grading queue with `explanation` as the reference the teacher marks against.
 *
 * Idempotent by construction: questions match on their exact stem within the
 * class + subject, assessments match on their title within the batch. Re-running
 * updates what is already there and never duplicates it.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/seed-trig-upload.ts
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/seed-trig-upload.ts --dry
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/seed-trig-upload.ts --enroll <username>
 *
 * Assessments are untimed (durationMinutes 0), unlimited-attempt, RELEASED and
 * topic-scoped to the SubjectPricingItem of the same name, matching every other
 * practice paper this platform ships. Students only see a paper when their
 * active plan lists this chapter — the report at the end says exactly who that
 * is, and `--enroll` grants the chapter to a named student.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { assessmentTopicAllowed, getActiveServices } from "@/services/onboardingService";
import { SEED_QUESTIONS, ASSESSMENT_GROUPS, TRIG_TAGS, CHAPTER } from "./data/trigUploadQuestions";

const CLASS_NAME = process.env.TRIG_CLASS ?? "Class 11";
const SUBJECT_CODE = process.env.TRIG_SUBJECT ?? "MAT";
const BATCH_NAME = process.env.TRIG_BATCH ?? "B Code Brain";

const dry = process.argv.includes("--dry");
const enrollIdx = process.argv.indexOf("--enroll");
const enrollUsernames = enrollIdx === -1 ? [] : process.argv.slice(enrollIdx + 1);

function fail(msg: string): never {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function integrityCheck() {
  // Every question must be used by exactly one paper, and the papers must
  // cover the bank completely, or a student would silently miss an exercise.
  const seen = new Map<string, number>();
  for (const q of SEED_QUESTIONS) {
    if (seen.has(q.key)) fail(`duplicate key "${q.key}" in the data file`);
    seen.set(q.key, 1);
  }
  const keyOf = (n: number) => `q${String(n).padStart(2, "0")}`;
  const used = new Set<string>();
  for (const g of ASSESSMENT_GROUPS) {
    if (g.from > g.to) fail(`group "${g.title}" has an empty range`);
    for (let n = g.from; n <= g.to; n++) {
      const key = keyOf(n);
      if (!seen.has(key)) fail(`group "${g.title}" references unknown question ${key}`);
      if (used.has(key)) fail(`${key} appears in more than one paper`);
      used.add(key);
    }
  }
  const missing = [...seen.keys()].filter((k) => !used.has(k));
  if (missing.length) fail(`questions not covered by any paper: ${missing.join(", ")}`);
}

async function main() {
  integrityCheck();

  // --------------------------------------------------------------- scope
  const classRoom = await prisma.classRoom.findFirst({ where: { name: CLASS_NAME, isActive: true } });
  if (!classRoom) fail(`no active class named "${CLASS_NAME}"`);

  const subject = await prisma.subject.findFirst({ where: { code: SUBJECT_CODE } });
  if (!subject) fail(`no subject with code ${SUBJECT_CODE}`);

  const allotted = await prisma.subjectClass.findUnique({
    where: { subjectId_classRoomId: { subjectId: subject.id, classRoomId: classRoom.id } },
  });
  if (!allotted) fail(`${SUBJECT_CODE} is not allotted to ${CLASS_NAME}`);

  const batch = await prisma.batch.findFirst({
    where: { name: BATCH_NAME, classRoomId: classRoom.id },
    select: { id: true, name: true },
  });
  if (!batch) fail(`no batch named "${BATCH_NAME}" in ${CLASS_NAME}`);

  const pricingItem = await prisma.subjectPricingItem.findFirst({
    where: { batchId: batch.id, subjectId: subject.id, name: CHAPTER },
    select: { id: true, name: true },
  });
  if (!pricingItem) fail(`batch "${batch.name}" has no priced chapter "${CHAPTER}" — students could never be entitled to it`);

  console.log(`class    ${classRoom.name} (${classRoom.id})`);
  console.log(`subject  ${subject.name} (${subject.id})`);
  console.log(`batch    ${batch.name} (${batch.id})`);
  console.log(`chapter  ${pricingItem.name} (${pricingItem.id})`);
  console.log(`mode     ${dry ? "DRY RUN" : "WRITE"}\n`);

  // ----------------------------------------------------------- questions
  const data = SEED_QUESTIONS.map((q) => ({
    q,
    payload: {
      type: "UPLOAD" as const,
      difficulty: q.difficulty,
      topic: CHAPTER,
      isPractical: false,
      tags: [...TRIG_TAGS, ...q.tags],
      stem: q.stem,
      explanation: q.explanation,
      allowedLanguages: [] as string[],
      starterCode: undefined,
      solutionCode: null,
    },
  }));

  const ids = new Map<string, string>();
  let createdQ = 0;
  let updatedQ = 0;

  for (const { q, payload } of data) {
    const existing = await prisma.question.findFirst({
      where: { classRoomId: classRoom.id, subjectId: subject.id, stem: q.stem },
      select: { id: true },
    });

    if (dry) {
      if (existing) updatedQ++;
      else createdQ++;
      ids.set(q.key, existing?.id ?? `dry-${q.key}`);
      continue;
    }

    if (existing) {
      await prisma.question.update({ where: { id: existing.id }, data: payload });
      ids.set(q.key, existing.id);
      updatedQ++;
    } else {
      const created = await prisma.question.create({
        data: { ...payload, classRoomId: classRoom.id, subjectId: subject.id },
      });
      ids.set(q.key, created.id);
      createdQ++;
    }
  }

  console.log(`questions  ${createdQ} created, ${updatedQ} updated, ${SEED_QUESTIONS.length} total`);

  // --------------------------------------------------------- assessments
  let createdA = 0;
  let updatedA = 0;
  let totalMarks = 0;

  for (const group of ASSESSMENT_GROUPS) {
    const wantedKeys: string[] = [];
    for (let n = group.from; n <= group.to; n++) wantedKeys.push(`q${String(n).padStart(2, "0")}`);
    const items = wantedKeys.map((key) => {
      const id = ids.get(key);
      if (!id) fail(`question ${key} was not seeded`);
      return { questionId: id, marks: 1 };
    });
    const marks = items.reduce((s, i) => s + i.marks, 0);
    totalMarks += marks;

    const body = {
      kind: "ASSIGNMENT" as const,
      subjectId: subject.id,
      topic: pricingItem.name,
      attemptMode: "FLEXIBLE" as const,
      maxAttempts: null,
      title: group.title,
      instructions: group.instructions,
      status: "RELEASED" as const,
      startsAt: null,
      endsAt: null,
      durationMinutes: 0,
      shuffleQuestions: false,
      totalMarks: marks,
    };

    const existing = await prisma.assessment.findFirst({
      where: { batchId: batch.id, title: group.title },
      select: { id: true },
    });

    if (dry) {
      if (existing) updatedA++;
      else createdA++;
      continue;
    }

    let assessmentId: string;
    if (existing) {
      assessmentId = existing.id;
      await prisma.assessment.update({ where: { id: existing.id }, data: body });
      // Rebuild the question list in worksheet order.
      await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: existing.id } });
      await prisma.assessmentQuestion.createMany({
        data: items.map((i, index) => ({ assessmentId: existing.id, questionId: i.questionId, order: index, marks: i.marks })),
      });
      updatedA++;
    } else {
      const created = await prisma.assessment.create({
        data: {
          ...body,
          batchId: batch.id,
          questions: { create: items.map((i, index) => ({ questionId: i.questionId, order: index, marks: i.marks })) },
        },
      });
      assessmentId = created.id;
      createdA++;
    }
    console.log(`  paper  ${group.title} → ${assessmentId} (${items.length} questions, ${marks} marks)`);
  }

  console.log(`assignments  ${createdA} created, ${updatedA} updated, ${ASSESSMENT_GROUPS.length} total`);
  console.log(`total marks across all papers: ${totalMarks}`);

  // ----------------------------------------------------------- verify
  const typeCounts = await prisma.question.groupBy({
    by: ["type"],
    where: { classRoomId: classRoom.id, subjectId: subject.id, topic: CHAPTER },
    _count: true,
  });
  console.log(`bank types in "${CHAPTER}": ${typeCounts.map((t) => `${t.type}=${t._count}`).join("  ")}`);

  const rows = await prisma.assessment.findMany({
    where: { batchId: batch.id, topic: pricingItem.name, kind: "ASSIGNMENT" },
    include: { _count: { select: { questions: true } } },
    orderBy: { title: "asc" },
  });
  const bad = rows.filter((r) => r.status !== "RELEASED" || r.durationMinutes !== 0 || r.maxAttempts !== null);
  if (bad.length) fail(`untimed/unlimited policy violated on: ${bad.map((b) => b.title).join(", ")}`);
  const wrongSize = rows.filter((r) => r._count.questions !== 10);
  if (wrongSize.length) fail(`papers without exactly 10 questions: ${wrongSize.map((b) => `${b.title} (${b._count.questions})`).join(", ")}`);
  if (!dry) console.log(`verified ${rows.length} released, untimed, unlimited-attempt papers of 10 questions each`);

  // ---------------------------------------------------------- enrolment
  if (enrollUsernames.length && !dry) {
    for (const username of enrollUsernames) {
      const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
      if (!user) {
        console.log(`enrol  ${username}: NO SUCH USER`);
        continue;
      }
      const request = await prisma.onboardingRequest.findFirst({
        where: { userId: user.id, activations: { some: { expiresAt: { gt: new Date() } } } },
        orderBy: { createdAt: "desc" },
      });
      if (!request) {
        console.log(`enrol  ${username}: skipped, no active plan (an expired plan already sees everything)`);
        continue;
      }
      const bySubject = { ...((request.subjectTopics ?? {}) as Record<string, { assignment?: string[]; mock?: string[]; test?: string[] }>) };
      const entry = bySubject[subject.id] ?? {};
      const assignment = (entry.assignment ?? []).map((t) => t.trim()).filter(Boolean);
      if (assignment.some((t) => t.toLowerCase() === pricingItem.name.toLowerCase())) {
        console.log(`enrol  ${username}: already has "${pricingItem.name}"`);
        continue;
      }
      const flat = request.assignmentTopics.split(",").map((t) => t.trim()).filter(Boolean);
      assignment.push(pricingItem.name);
      bySubject[subject.id] = { ...entry, assignment };
      if (!flat.some((t) => t.toLowerCase() === pricingItem.name.toLowerCase())) flat.push(pricingItem.name);
      await prisma.onboardingRequest.update({
        where: { id: request.id },
        data: { subjectTopics: bySubject as never, assignmentTopics: flat.join(", ") },
      });
      console.log(`enrol  ${username}: granted "${pricingItem.name}" (assignmentTopics: ${flat.join(", ")})`);
    }
  } else if (enrollUsernames.length) {
    console.log("\n(dry run: no enrolment changes)");
  }

  // ------------------------------------------------ who can actually see them
  const members = await prisma.batchStudent.findMany({
    where: { batchId: batch.id },
    select: { student: { select: { userId: true, user: { select: { username: true } } } } },
  });

  const entitled: string[] = [];
  const missing: string[] = [];
  for (const m of members) {
    const services = await getActiveServices(m.student.userId);
    const allowed = assessmentTopicAllowed(services, "ASSIGNMENT", pricingItem.name, subject.id);
    (allowed ? entitled : missing).push(m.student.user.username);
  }

  console.log(`\n${batch.name} students who will see these ${ASSESSMENT_GROUPS.length} papers:`);
  console.log(`  entitled: ${entitled.join(", ") || "none"}`);
  if (missing.length) {
    console.log(`  not entitled to "${pricingItem.name}": ${missing.join(", ")}`);
    console.log(`    grant with: npx tsx --tsconfig scripts/tsconfig.json scripts/seed-trig-upload.ts --enroll ${missing[0]}`);
  }

  console.log(dry ? "\nDRY RUN: nothing written." : "\nDone.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
