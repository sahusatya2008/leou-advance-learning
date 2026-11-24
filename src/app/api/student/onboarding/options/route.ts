import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getSubjectPricing } from "@/services/onboardingService";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;

  const boards = await prisma.board.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const classes = await prisma.classRoom.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { subjects: { include: { subject: true }, orderBy: { subject: { name: "asc" } } } },
  });

  const classesWithPricing = await Promise.all(
    classes.map(async (c) => ({
      id: c.id,
      name: c.name,
      hasStreams: c.hasStreams,
      subjects: await Promise.all(
        c.subjects.map(async (s) => {
          const pricing = await getSubjectPricing(c.id, s.subjectId);
          return {
            id: s.subjectId,
            name: s.subject.name,
            batchId: pricing.batchId,
            batchName: pricing.batchName,
            topics: pricing.topics,
            tutoring: pricing.tutoring,
          };
        })
      ),
    }))
  );

  return NextResponse.json({
    boards: boards.map((b) => ({ id: b.id, name: b.name })),
    classes: classesWithPricing,
  });
}