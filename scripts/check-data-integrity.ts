import "dotenv/config";
import { prisma } from "@/lib/prisma";

/** Read-only integrity check. Creates and changes nothing. */
async function main() {
  const counts = {
    users: await prisma.user.count(),
    students: await prisma.studentProfile.count(),
    parents: await prisma.parentProfile.count(),
    classes: await prisma.classRoom.count(),
    assessments: await prisma.assessment.count(),
    questions: await prisma.question.count(),
    submissions: await prisma.submission.count(),
    answers: await prisma.answer.count(),
    payments: await prisma.paymentRecord.count(),
    sessions: await prisma.session.count(),
    activityLogs: await prisma.activityLog.count(),
    accessCodes: await prisma.accessCode.count(),
  };
  console.log("row counts:", counts);

  const leftover = await prisma.user.count({
    where: { OR: [{ username: { startsWith: "zz_" } }, { email: { startsWith: "zz_" } }] },
  });
  console.log("leftover test users:", leftover);

  // AccessCode.studentId is a required FK with onDelete: Cascade, so orphans
  // are structurally impossible; only the shape of the codes is worth checking.
  // Filtered in JS because Prisma string filters do not accept a regex.
  const allCodes = await prisma.accessCode.findMany({ select: { code: true, expiresAt: true } });
  const malformed = allCodes.filter(
    (c) => !/^\d{6}$/.test(c.code) || c.expiresAt.getTime() < new Date("2000-01-01").getTime()
  );
  console.log("malformed access codes:", malformed.length);

  const suspendedStillOk = await prisma.user.count({
    where: { status: { in: ["BLOCKED", "SUSPENDED"] }, studentProfile: { isNot: null } },
  });
  console.log("blocked/suspended students (untouched by this work):", suspendedStillOk);
}

main().finally(() => prisma.$disconnect());
