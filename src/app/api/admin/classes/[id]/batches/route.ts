import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const classroom = await prisma.classRoom.findUnique({
    where: { id },
    include: {
      subjects: { include: { subject: true }, orderBy: { subject: { name: "asc" } } },
      batches: {
        include: {
          subjects: { include: { subject: true } },
          _count: { select: { students: true } },
        },
        orderBy: { name: "asc" },
      },
      _count: { select: { students: true } },
    },
  });
  if (!classroom) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  return NextResponse.json({ classroom });
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const classroom = await prisma.classRoom.findUnique({ where: { id } });
  if (!classroom) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  let body: { name?: string; subjectIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Batch name is required." }, { status: 400 });

  const subjectIds = Array.isArray(body.subjectIds) ? [...new Set(body.subjectIds)] : [];
  const validCount = await prisma.subjectClass.count({
    where: { classRoomId: id, subjectId: { in: subjectIds } },
  });
  if (validCount !== subjectIds.length) {
    return NextResponse.json({ error: "One or more chosen subjects are not allotted to this class." }, { status: 400 });
  }

  const sameName = await prisma.batch.findFirst({ where: { classRoomId: id, name } });
  if (sameName) return NextResponse.json({ error: "A batch with this name already exists in this class." }, { status: 409 });

  const batch = await prisma.batch.create({
    data: {
      name,
      classRoomId: id,
      subjects: {
        create: subjectIds.map((subjectId) => ({ subjectId })),
      },
    },
    include: { subjects: { include: { subject: true } } },
  });

  await logActivity({ userId: admin.user.id, type: "ADMIN_CREATE_BATCH", targetId: batch.id, ...meta }).catch(() => null);
  return NextResponse.json({ batch });
}