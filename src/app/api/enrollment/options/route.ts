import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const classes = await prisma.classRoom.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { subjects: { include: { subject: true }, orderBy: { subject: { name: "asc" } } } },
  });

  const data = classes.map((c) => ({
    id: c.id,
    name: c.name,
    hasStreams: c.hasStreams,
    subjects: c.subjects.map((s) => ({ id: s.subjectId, name: s.subject.name })),
  }));

  return NextResponse.json({ classes: data });
}