import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";

export const runtime = "nodejs";

type TutoringPayload = {
  hourlyRate: number | null;
  weeklyClasses: number | null;
  weeklyRate: number | null;
  monthlyDaysPerWeek: number | null;
  monthlyRate: number | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ classId: string; batchId: string; subjectId: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { batchId, subjectId } = await ctx.params;

  const [items, tutoring] = await Promise.all([
    prisma.subjectPricingItem.findMany({ where: { batchId, subjectId }, orderBy: { name: "asc" } }),
    prisma.tutoringRate.findUnique({ where: { batchId_subjectId: { batchId, subjectId } } }),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      assignmentRate: Number(i.assignmentRate),
      mockRate: Number(i.mockRate),
      testRate: Number(i.testRate),
    })),
    tutoring: tutoring
      ? {
          hourlyRate: tutoring.hourlyRate != null ? Number(tutoring.hourlyRate) : null,
          weeklyClasses: tutoring.weeklyClasses,
          weeklyRate: tutoring.weeklyRate != null ? Number(tutoring.weeklyRate) : null,
          monthlyDaysPerWeek: tutoring.monthlyDaysPerWeek,
          monthlyRate: tutoring.monthlyRate != null ? Number(tutoring.monthlyRate) : null,
        }
      : null,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ classId: string; batchId: string; subjectId: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { batchId, subjectId } = await ctx.params;

  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  const subjectInBatch = await prisma.batchSubject.findUnique({
    where: { batchId_subjectId: { batchId, subjectId } },
  });
  if (!subjectInBatch) return NextResponse.json({ error: "Subject not offered in this batch." }, { status: 400 });

  let body: {
    items?: { id?: string; name: string; assignmentRate: number; mockRate: number; testRate: number }[];
    deletedIds?: string[];
    tutoring?: TutoringPayload | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const itemNames = new Set<string>();
  for (const it of body.items ?? []) {
    const name = String(it.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Every chapter/topic needs a name." }, { status: 400 });
    if (itemNames.has(name.toLowerCase()))
      return NextResponse.json({ error: `Duplicate chapter/topic: “${name}”.` }, { status: 400 });
    itemNames.add(name.toLowerCase());
  }

  await prisma.$transaction(async (tx) => {
    if (body.deletedIds?.length) {
      await tx.subjectPricingItem.deleteMany({
        where: { batchId, subjectId, id: { in: body.deletedIds } },
      });
    }
    for (const it of body.items ?? []) {
      const data = {
        name: String(it.name).trim(),
        assignmentRate: num(it.assignmentRate),
        mockRate: num(it.mockRate),
        testRate: num(it.testRate),
        batchId,
        subjectId,
      };
      if (it.id) {
        await tx.subjectPricingItem.update({
          where: { id: it.id, batchId_subjectId_name: { batchId, subjectId, name: String(it.name).trim() } },
          data: { assignmentRate: data.assignmentRate, mockRate: data.mockRate, testRate: data.testRate },
        });
      } else {
        await tx.subjectPricingItem.create({ data });
      }
    }
    if (body.tutoring) {
      const t = body.tutoring;
      const payload = {
        hourlyRate: t.hourlyRate != null ? num(t.hourlyRate) : null,
        weeklyClasses: t.weeklyClasses != null ? num(t.weeklyClasses) : null,
        weeklyRate: t.weeklyRate != null ? num(t.weeklyRate) : null,
        monthlyDaysPerWeek: t.monthlyDaysPerWeek != null ? num(t.monthlyDaysPerWeek) : null,
        monthlyRate: t.monthlyRate != null ? num(t.monthlyRate) : null,
      };
      await tx.tutoringRate.upsert({
        where: { batchId_subjectId: { batchId, subjectId } },
        create: { batchId, subjectId, ...payload },
        update: payload,
      });
    }
  });

  const [savedItems, savedTutoring] = await Promise.all([
    prisma.subjectPricingItem.findMany({ where: { batchId, subjectId }, orderBy: { name: "asc" } }),
    prisma.tutoringRate.findUnique({ where: { batchId_subjectId: { batchId, subjectId } } }),
  ]);

  return NextResponse.json({
    ok: true,
    items: savedItems.map((i) => ({
      id: i.id,
      name: i.name,
      assignmentRate: Number(i.assignmentRate),
      mockRate: Number(i.mockRate),
      testRate: Number(i.testRate),
    })),
    tutoring: savedTutoring
      ? {
          hourlyRate: savedTutoring.hourlyRate != null ? Number(savedTutoring.hourlyRate) : null,
          weeklyClasses: savedTutoring.weeklyClasses,
          weeklyRate: savedTutoring.weeklyRate != null ? Number(savedTutoring.weeklyRate) : null,
          monthlyDaysPerWeek: savedTutoring.monthlyDaysPerWeek,
          monthlyRate: savedTutoring.monthlyRate != null ? Number(savedTutoring.monthlyRate) : null,
        }
      : null,
  });
}