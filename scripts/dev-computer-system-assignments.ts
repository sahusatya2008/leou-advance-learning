import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { COMPUTER_SYSTEM_QUESTIONS } from './data/computerSystemQuestions';
import { COMPUTER_SYSTEM_ASSIGNMENTS } from './data/computerSystemAssignments';

/**
 * Seeds the CBSE Class 11 "Computer System" chapter: 70 questions and 34
 * untimed, unlimited-attempt assignments.
 *
 * Every assessment is topic-scoped to the SubjectPricingItem named "Computer
 * System", so only students whose active plan lists that chapter see them
 * (see assessmentTopicAllowed in src/services/onboardingService.ts).
 *
 * Idempotent: questions match on stem within the class+subject, assessments
 * match on title within the batch. Re-running updates in place.
 *
 *   npx tsx scripts/dev-computer-system-assignments.ts            # seed
 *   npx tsx scripts/dev-computer-system-assignments.ts --dry      # report only
 *   npx tsx scripts/dev-computer-system-assignments.ts --enroll shellstudent
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const CLASS_NAME = process.env.CS_CLASS ?? 'Class 11';
const SUBJECT_NAME = process.env.CS_SUBJECT ?? 'Computer Science';
const BATCH_NAME = process.env.CS_BATCH ?? 'B Code Brain';
const TOPIC = process.env.CS_TOPIC ?? 'Computer System';

const dry = process.argv.includes('--dry');
const enrollIdx = process.argv.indexOf('--enroll');
const enrollUsernames = enrollIdx === -1 ? [] : process.argv.slice(enrollIdx + 1);

function fail(msg: string): never {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

async function main() {
  // ---------------------------------------------------------------- resolve
  const classRoom = await prisma.classRoom.findFirst({
    where: { name: CLASS_NAME },
    include: { subjects: true },
  });
  if (!classRoom) fail(`Class "${CLASS_NAME}" not found.`);

  const subjects = await prisma.subject.findMany({ where: { name: SUBJECT_NAME } });
  if (subjects.length === 0) fail(`Subject "${SUBJECT_NAME}" not found.`);
  // Prefer the subject that is actually offered to this class.
  const offered = classRoom.subjects.map((s) => s.subjectId);
  const subject = subjects.find((s) => offered.includes(s.id)) ?? subjects[0];
  if (!offered.includes(subject.id)) {
    console.warn(`WARN: "${subject.name}" is not offered for ${CLASS_NAME}; seeding anyway.`);
  }

  const batch = await prisma.batch.findFirst({ where: { name: BATCH_NAME } });
  if (!batch) fail(`Batch "${BATCH_NAME}" not found.`);

  const pricingItem = await prisma.subjectPricingItem.findFirst({
    where: { subjectId: subject.id, name: TOPIC },
  });
  if (!pricingItem) {
    fail(
      `No SubjectPricingItem named "${TOPIC}" for ${subject.name}. ` +
        `Create the chapter in the admin pricing screen first, otherwise students ` +
        `can never be entitled to these assignments.`
    );
  }

  console.log(`class    ${classRoom.name} (${classRoom.id})`);
  console.log(`subject  ${subject.name} (${subject.id})`);
  console.log(`batch    ${batch.name} (${batch.id})`);
  console.log(`topic    ${pricingItem.name} (${pricingItem.id})`);
  console.log(`mode     ${dry ? 'DRY RUN' : 'WRITE'}\n`);

  // -------------------------------------------------------------- questions
  const bankIds = new Set(COMPUTER_SYSTEM_QUESTIONS.map((q) => q.id));
  for (const a of COMPUTER_SYSTEM_ASSIGNMENTS) {
    for (const [qid] of a.items) {
      if (!bankIds.has(qid)) fail(`Assignment "${a.title}" references unknown question "${qid}".`);
    }
  }
  const duplicateStems = new Map<string, string[]>();
  for (const q of COMPUTER_SYSTEM_QUESTIONS) {
    const list = duplicateStems.get(q.stem) ?? [];
    list.push(q.id);
    duplicateStems.set(q.stem, list);
  }
  for (const [stem, ids] of duplicateStems) {
    if (ids.length > 1) fail(`Duplicate question stems: ${ids.join(', ')} -> ${stem.slice(0, 70)}`);
  }

  const questionIds = new Map<string, string>();
  let createdQ = 0;
  let updatedQ = 0;

  for (const q of COMPUTER_SYSTEM_QUESTIONS) {
    const data = {
      type: q.type,
      difficulty: q.difficulty,
      stem: q.stem,
      explanation: q.explanation,
      // non-nullable Json: always an array, Python-only for coding questions
      allowedLanguages: q.type === 'CODING' ? ['python'] : [],
      starterCode: q.starterCode ?? undefined,
      solutionCode: q.solutionCode ?? null,
    };

    const existing = await prisma.question.findFirst({
      where: { classRoomId: classRoom.id, subjectId: subject.id, stem: q.stem },
    });

    let id: string;
    if (existing) {
      id = existing.id;
      updatedQ++;
    } else {
      id = `dry-${q.id}`;
      createdQ++;
    }

    if (dry) {
      questionIds.set(q.id, id);
      continue;
    }

    if (existing) {
      await prisma.question.update({ where: { id: existing.id }, data });
      // Options and test cases are replaced wholesale so re-runs cannot duplicate.
      await prisma.$transaction([
        prisma.questionOption.deleteMany({ where: { questionId: existing.id } }),
        prisma.testCase.deleteMany({ where: { questionId: existing.id } }),
      ]);
    } else {
      id = (
        await prisma.question.create({
          data: { ...data, classRoomId: classRoom.id, subjectId: subject.id },
        })
      ).id;
    }

    if (q.options?.length) {
      await prisma.questionOption.createMany({
        data: q.options.map((o, i) => ({
          questionId: id,
          text: o.text,
          isCorrect: o.correct ?? false,
          sortOrder: i,
        })),
      });
    }
    const mcqWithNoCorrect = q.type === 'MCQ' && !q.options?.some((o) => o.correct);
    if (mcqWithNoCorrect) fail(`MCQ "${q.id}" has no correct option.`);

    if (q.testCases?.length) {
      await prisma.testCase.createMany({
        data: q.testCases.map((t, i) => ({
          questionId: id,
          input: t.input,
          expected: t.expected,
          isHidden: t.isHidden ?? false,
          sortOrder: i,
          weight: 1,
        })),
      });
    }
    questionIds.set(q.id, id);
  }

  const codingWithNoCases = COMPUTER_SYSTEM_QUESTIONS.filter(
    (q) => q.type === 'CODING' && !q.testCases?.length
  );
  if (codingWithNoCases.length) {
    fail(`Coding questions without test cases cannot auto-grade: ${codingWithNoCases.map((q) => q.id)}`);
  }

  console.log(`questions  ${createdQ} created, ${updatedQ} updated, ${COMPUTER_SYSTEM_QUESTIONS.length} total`);

  // ------------------------------------------------------------ assessments
  let createdA = 0;
  let updatedA = 0;
  let totalMarks = 0;

  for (const a of COMPUTER_SYSTEM_ASSIGNMENTS) {
    const marks = a.items.reduce((sum, [, m]) => sum + m, 0);
    totalMarks += marks;

    const data = {
      kind: 'ASSIGNMENT' as const,
      subjectId: subject.id,
      topic: pricingItem.name,
      // FLEXIBLE + null maxAttempts = attempt as often as you like.
      attemptMode: 'FLEXIBLE' as const,
      maxAttempts: null,
      title: a.title,
      instructions: a.instructions,
      status: 'RELEASED' as const,
      // no window
      startsAt: null,
      endsAt: null,
      // 0 is the app's "no time limit" sentinel (src/lib/assessmentTime.ts)
      durationMinutes: 0,
      shuffleQuestions: false,
      totalMarks: marks,
    };

    const existing = await prisma.assessment.findFirst({
      where: { batchId: batch.id, title: a.title },
    });

    if (dry) {
      if (existing) updatedA++;
      else createdA++;
      continue;
    }

    const id = existing
      ? (await prisma.assessment.update({ where: { id: existing.id }, data })).id
      : (await prisma.assessment.create({ data: { ...data, batchId: batch.id } })).id;
    if (existing) updatedA++;
    else createdA++;

    // Reorder safely: wipe then rewrite so a re-run cannot duplicate rows
    // (AssessmentQuestion is unique on assessmentId+questionId).
    await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
    await prisma.assessmentQuestion.createMany({
      data: a.items.map(([qid, m], i) => ({
        assessmentId: id,
        questionId: questionIds.get(qid)!,
        order: i,
        marks: m,
      })),
    });
  }

  console.log(`assignments  ${createdA} created, ${updatedA} updated, ${COMPUTER_SYSTEM_ASSIGNMENTS.length} total`);
  console.log(`total marks across all papers: ${totalMarks}`);

  const typeCounts: Record<string, number> = {};
  for (const q of COMPUTER_SYSTEM_QUESTIONS) typeCounts[q.type] = (typeCounts[q.type] ?? 0) + 1;
  console.log(`question types: ${Object.entries(typeCounts).map(([k, v]) => `${k}=${v}`).join('  ')}`);

  // --------------------------------------------------------- report on views
  const rows = await prisma.assessment.findMany({
    where: { batchId: batch.id, topic: pricingItem.name, kind: 'ASSIGNMENT' },
    include: { _count: { select: { questions: true } } },
    orderBy: { title: 'asc' },
  });
  const bad = rows.filter((r) => r.status !== 'RELEASED' || r.durationMinutes !== 0 || r.maxAttempts !== null);
  if (bad.length) fail(`Untimed/unlimited policy violated on: ${bad.map((b) => b.title).join(', ')}`);
  const noQuestions = rows.filter((r) => !dry && r._count.questions === 0);
  if (noQuestions.length) fail(`Assessments with no questions: ${noQuestions.map((b) => b.title).join(', ')}`);
  console.log(
    `\n${dry ? 'would verify' : 'verified'} ${dry ? COMPUTER_SYSTEM_ASSIGNMENTS.length : rows.length} released, untimed, unlimited-attempt assignments in ${batch.name}`
  );

  // ----------------------------------------------------------------- enrol
  if (enrollUsernames.length && !dry) {
    for (const username of enrollUsernames) {
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) { console.log(`enrol  ${username}: NO SUCH USER`); continue; }
      const activation = await prisma.serviceActivation.findFirst({
        where: { userId: user.id },
        orderBy: { activatedAt: 'desc' },
      });
      if (!activation || activation.expiresAt.getTime() <= Date.now()) {
        console.log(`enrol  ${username}: skipped, no active plan (already sees everything)`);
        continue;
      }
      const request = await prisma.onboardingRequest.findFirst({
        where: { userId: user.id, activations: { some: { expiresAt: { gt: new Date() } } } },
        orderBy: { createdAt: 'desc' },
      });
      if (!request) { console.log(`enrol  ${username}: skipped, no active onboarding request`); continue; }

      const topics = request.assignmentTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (topics.some((t) => t.toLowerCase() === pricingItem.name.toLowerCase())) {
        console.log(`enrol  ${username}: already has "${pricingItem.name}"`);
        continue;
      }
      topics.push(pricingItem.name);
      await prisma.onboardingRequest.update({
        where: { id: request.id },
        data: { assignmentTopics: topics.join(', ') },
      });
      console.log(`enrol  ${username}: assignmentTopics -> ${topics.join(', ')}`);
    }
  } else if (enrollUsernames.length) {
    console.log('\n(dry run: no enrolment changes)');
  }

  // Who can see them? Students with an active plan must list the topic.
  const activations = await prisma.serviceActivation.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: activations.map((a) => a.userId) } },
    select: {
      username: true,
      onboardingRequests: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { wantAssignments: true, assignmentTopics: true },
      },
    },
  });
  const entitled: string[] = [];
  const missing: string[] = [];
  for (const u of users) {
    const request = u.onboardingRequests[0];
    if (!request?.wantAssignments) continue;
    const topics = (request.assignmentTopics ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (topics.length === 0 || topics.includes(pricingItem.name.toLowerCase())) entitled.push(u.username);
    else missing.push(u.username);
  }
  console.log(`\nentitled (assignment plan lists "${pricingItem.name}"): ${entitled.join(', ') || 'none'}`);
  if (missing.length) {
    console.log(`subscribed but without the chapter: ${missing.join(', ')}`);
    console.log(`  fix with: npx tsx scripts/dev-computer-system-assignments.ts --enrol ${missing[0]}`);
  }
  console.log(
    `students with no active plan see these too (assessmentTopicAllowed returns true when services is null)`
  );

  console.log(dry ? '\nDRY RUN: nothing written.' : '\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
