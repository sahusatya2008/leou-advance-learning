import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

  let body: { name?: string; subjectIds?: string[]; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : batch.name;
  if (name.length < 2) return NextResponse.json({ error: "Batch name is required." }, { status: 400 });

  const data: Record<string, unknown> = { name, isActive: body.isActive ?? batch.isActive };

  if (Array.isArray(body.subjectIds)) {
    const subjectIds = [...new Set(body.subjectIds)];
    const validCount = await prisma.subjectClass.count({
      where: { classRoomId: batch.classRoomId, subjectId: { in: subjectIds } },
    });
    if (validCount !== subjectIds.length) {
      return NextResponse.json({ error: "One or more chosen subjects are not allotted to this class." }, { status: 400 });
    }
    const existing = await prisma.batchSubject.findMany({ where: { batchId: id }, select: { subjectId: true } });
    const existingIds = new Set(existing.map((s) => s.subjectId));
    data.subjects = {
      deleteMany: { subjectId: { notIn: subjectIds.length ? subjectIds : ["__none__"] } },
      create: subjectIds.filter((s) => !existingIds.has(s)).map((subjectId) => ({ subjectId })),
    };
  }

  const updated = await prisma.batch.update({ where: { id }, data });
  await logActivity({ userId: admin.user.id, type: "ADMIN_UPDATE_BATCH", targetId: id, ...meta }).catch(() => null);
  return NextResponse.json({ batch: updated });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const batch = await prisma.batch.findUnique({
    where: { id },
    include: { _count: { select: { students: true, assessments: true } } },
  });
  if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  if (batch._count.students > 0 || batch._count.assessments > 0) {
    return NextResponse.json(
      { error: "Cannot delete: unassign its students and assessments first." },
      { status: 409 }
    );
  }

  await prisma.batch.delete({ where: { id } });
  await logActivity({ userId: admin.user.id, type: "ADMIN_DELETE_BATCH", targetId: id, ...meta }).catch(() => null);
  return NextResponse.json({ ok: true });
}