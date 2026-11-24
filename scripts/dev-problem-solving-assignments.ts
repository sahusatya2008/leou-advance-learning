import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { assessmentTopicAllowed, getActiveServices } from '../src/services/onboardingService';
import { PROBLEM_SOLVING_QUESTIONS } from './data/problemSolvingQuestions';
import { PROBLEM_SOLVING_ASSIGNMENTS } from './data/problemSolvingAssignments';

/**
 * Seeds the CBSE Class 11 "Problem Solving & Computational Thinking" chapter:
 * 120 questions (80 MCQ, 20 upload, 20 oral) and 17 untimed, unlimited-attempt
 * assignments.
 *
 * Every assessment is topic-scoped to the SubjectPricingItem of the same name,
 * so only students whose active plan lists that chapter see them (see
 * assessmentTopicAllowed in src/services/onboardingService.ts).
 *
 * The tag string (env PS_TOPIC, default "Problem Solving & Computational
 * Thinking") must exist as a SubjectPricingItem for that batch + subject, or
 * students can never be entitled to the papers. If it is missing, this script
 * creates it idempotently using the rates of the sibling chapter
 * "Introduction to Problem Solving" so the tag and entitlement line up.
 *
 * Idempotent: questions match on stem within the class+subject, assessments
 * match on title within the batch. Re-running updates in place.
 *
 *   npx tsx scripts/dev-problem-solving-assignments.ts            # seed
 *   npx tsx scripts/dev-problem-solving-assignments.ts --dry      # report only
 *   npx tsx scripts/dev-problem-solving-assignments.ts --enroll shellstudent
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const CLASS_NAME = process.env.PS_CLASS ?? 'Class 11';
const SUBJECT_NAME = process.env.PS_SUBJECT ?? 'Computer Science';
const BATCH_NAME = process.env.PS_BATCH ?? 'B Code Brain';
const TOPIC = process.env.PS_TOPIC ?? 'Problem Solving & Computational Thinking';
/** Sibling chapter already priced for this subject; used as a rate template. */
const PRICED_SIBLING = process.env.PS_SIBLING ?? 'Introduction to Problem Solving';

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
  const offered = classRoom.subjects.map((s) => s.subjectId);
  const subject = subjects.find((s) => offered.includes(s.id)) ?? subjects[0];
  if (!offered.includes(subject.id)) {
    console.warn(`WARN: "${subject.name}" is not offered for ${CLASS_NAME}; seeding anyway.`);
  }

  const batch = await prisma.batch.findFirst({ where: { name: BATCH_NAME } });
  if (!batch) fail(`Batch "${BATCH_NAME}" not found.`);

  // ----------------------------------------------------------- price the topic
  let pricingItem: { id: string; name: string } | null = await prisma.subjectPricingItem.findFirst({
    where: { subjectId: subject.id, name: TOPIC },
  });

  if (!pricingItem) {
    const sibling = await prisma.subjectPricingItem.findFirst({
      where: { batchId: batch.id, subjectId: subject.id, name: PRICED_SIBLING },
    });
    const rates = sibling
      ? { assignmentRate: sibling.assignmentRate, mockRate: sibling.mockRate, testRate: sibling.testRate }
      : { assignmentRate: 0, mockRate: 0, testRate: 0 };
    if (dry) {
      console.log(`topic    would create "${TOPIC}" (rates from "${PRICED_SIBLING}")`);
    } else {
      pricingItem = await prisma.subjectPricingItem.create({
        data: { batchId: batch.id, subjectId: subject.id, name: TOPIC, ...rates },
      });
      console.log(`topic    created "${TOPIC}" with rates assign=${rates.assignmentRate} mock=${rates.mockRate} test=${rates.testRate}`);
    }
  }

  console.log(`class    ${classRoom.name} (${classRoom.id})`);
  console.log(`subject  ${subject.name} (${subject.id})`);
  console.log(`batch    ${batch.name} (${batch.id})`);
  console.log(`topic    ${TOPIC}${pricingItem ? ` (${pricingItem.id})` : ' (DRY, to be created)'}`);
  console.log(`mode     ${dry ? 'DRY RUN' : 'WRITE'}\n`);

  if (!pricingItem && dry) pricingItem = { id: `dry-${TOPIC}`, name: TOPIC };
  if (!pricingItem) return;

  // -------------------------------------------------------------- questions
  const bankIds = new Set(PROBLEM_SOLVING_QUESTIONS.map((q) => q.id));
  for (const a of PROBLEM_SOLVING_ASSIGNMENTS) {
    for (const [qid] of a.items) {
      if (!bankIds.has(qid)) fail(`Assignment "${a.title}" references unknown question "${qid}".`);
    }
  }
  const duplicateStems = new Map<string, string[]>();
  for (const q of PROBLEM_SOLVING_QUESTIONS) {
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

  for (const q of PROBLEM_SOLVING_QUESTIONS) {
    const data = {
      type: q.type,
      difficulty: q.difficulty,
      stem: q.stem,
      explanation: q.explanation,
      // chapter tag mirrors the assessment topic; this drives the admin filter
      topic: TOPIC,
      allowedLanguages: [] as string[],
      starterCode: undefined,
      solutionCode: null,
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
      await prisma.$transaction([
        prisma.questionOption.deleteMany({ where: { questionId: existing.id } }),
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

    questionIds.set(q.id, id);
  }

  console.log(`questions  ${createdQ} created, ${updatedQ} updated, ${PROBLEM_SOLVING_QUESTIONS.length} total`);

  // ------------------------------------------------------------ assessments
  let createdA = 0;
  let updatedA = 0;
  let totalMarks = 0;

  // ------------------------------------------------------ retire stale papers
  // Earlier versions of this bank shipped mixed-type papers (MCQ+oral together)
  // under different titles. Those are now superseded by the type-pure set below.
  // Remove them so the student sees one coherent list — but only if no student
  // has ever attempted them, so real work can never be destroyed.
  const wantedTitles = new Set(PROBLEM_SOLVING_ASSIGNMENTS.map((a) => a.title));
  const stale = await prisma.assessment.findMany({
    where: {
      batchId: batch.id,
      subjectId: subject.id,
      topic: pricingItem.name,
      kind: 'ASSIGNMENT',
      NOT: { title: { in: [...wantedTitles] } },
    },
    include: { _count: { select: { submissions: true } } },
  });
  const attempted = stale.filter((s) => s._count.submissions > 0);
  if (attempted.length) {
    fail(
      `Refusing to remove ${attempted.length} superseded paper(s) that students have already attempted: ` +
        attempted.map((a) => a.title).join(', ')
    );
  }
  if (stale.length) {
    console.log(`retire    ${stale.length} superseded paper(s): ${stale.map((s) => s.title).join(', ')}`);
    if (!dry) await prisma.assessment.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  for (const a of PROBLEM_SOLVING_ASSIGNMENTS) {
    const marks = a.items.reduce((sum, [, m]) => sum + m, 0);
    totalMarks += marks;

    const data = {
      kind: 'ASSIGNMENT' as const,
      subjectId: subject.id,
      topic: pricingItem.name,
      attemptMode: 'FLEXIBLE' as const,
      maxAttempts: null,
      title: a.title,
      instructions: a.instructions,
      status: 'RELEASED' as const,
      startsAt: null,
      endsAt: null,
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

  console.log(`assignments  ${createdA} created, ${updatedA} updated, ${PROBLEM_SOLVING_ASSIGNMENTS.length} total`);
  console.log(`total marks across all papers: ${totalMarks}`);

  const typeCounts: Record<string, number> = {};
  for (const q of PROBLEM_SOLVING_QUESTIONS) typeCounts[q.type] = (typeCounts[q.type] ?? 0) + 1;
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
    `\n${dry ? 'would verify' : 'verified'} ${dry ? PROBLEM_SOLVING_ASSIGNMENTS.length : rows.length} released, untimed, unlimited-attempt assignments in ${batch.name}`
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

      // subjectTopics is the entitlement authority (assessmentTopicAllowed reads
      // it via getActiveServices). The flat columns are a legacy union mirror,
      // so both must be written or the grant silently does nothing.
      const bySubject = { ...((request.subjectTopics ?? {}) as Record<string, { assignment?: string[]; mock?: string[]; test?: string[] }>) };
      const entry = bySubject[subject.id] ?? {};
      const assignment = (entry.assignment ?? []).map((t) => t.trim()).filter(Boolean);
      const chapter = pricingItem.name.toLowerCase();
      if (assignment.some((t) => t.toLowerCase() === chapter)) {
        console.log(`enrol  ${username}: already has "${pricingItem.name}"`);
        continue;
      }
      const flat = request.assignmentTopics.split(',').map((t) => t.trim()).filter(Boolean);
      if (flat.some((t) => t.toLowerCase() === chapter)) {
        // flat already lists it but subjectTopics does not — promote it.
        bySubject[subject.id] = { ...entry, assignment: [...assignment, pricingItem.name] };
      } else {
        assignment.push(pricingItem.name);
        bySubject[subject.id] = { ...entry, assignment };
        flat.push(pricingItem.name);
      }
      await prisma.onboardingRequest.update({
        where: { id: request.id },
        data: {
          subjectTopics: bySubject as never,
          assignmentTopics: flat.join(', '),
        },
      });
      console.log(
        `enrol  ${username}: granted "${pricingItem.name}" (assignmentTopics: ${flat.join(', ')})`
      );
    }
  } else if (enrollUsernames.length) {
    console.log('\n(dry run: no enrolment changes)');
  }

  // Who can actually see these papers? Ask the app's own entitlement code
  // (getActiveServices + assessmentTopicAllowed) rather than re-deriving it, so
  // this report cannot drift from what a real student experiences.
  const members = await prisma.batchStudent.findMany({
    where: { batchId: batch.id },
    select: { student: { select: { userId: true, user: { select: { username: true } } } } },
  });

  const entitled: string[] = [];
  const missing: string[] = [];
  const notMembers: string[] = [];

  for (const m of members) {
    const services = await getActiveServices(m.student.userId);
    const inBatch = true;
    const allowed = inBatch && assessmentTopicAllowed(services, 'ASSIGNMENT', pricingItem.name, subject.id);
    (allowed ? entitled : missing).push(m.student.user.username);
  }

  // Students elsewhere who hold an active plan but are not in this batch cannot
  // open the papers either — the attempt route checks batch membership.
  const activations = await prisma.serviceActivation.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((m) => m.student.userId));
  const outsiders = await prisma.user.findMany({
    where: { id: { in: activations.map((a) => a.userId).filter((id) => !memberIds.has(id)) } },
    select: { username: true },
  });
  notMembers.push(...outsiders.map((u) => u.username));

  console.log(`\nB Code Brain students who will see these ${PROBLEM_SOLVING_ASSIGNMENTS.length} papers:`);
  console.log(`  entitled: ${entitled.join(', ') || 'none'}`);
  if (missing.length) {
    console.log(`  subscribed but chapter NOT in plan: ${missing.join(', ')}`);
    console.log(`    grant with: npx tsx scripts/dev-problem-solving-assignments.ts --enroll ${missing[0]}`);
  }
  if (notMembers.length) {
    console.log(`  active plan but not a member of ${batch.name} (blocked by batch check): ${notMembers.join(', ')}`);
  }

  console.log(dry ? '\nDRY RUN: nothing written.' : '\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());