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

  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

  let body: { name?: string; classIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : subject.name;
  if (name.length < 2) return NextResponse.json({ error: "Subject name is required." }, { status: 400 });
  const dup = await prisma.subject.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
  });
  if (dup) return NextResponse.json({ error: "A subject with this name already exists." }, { status: 409 });

  let classes;
  if (Array.isArray(body.classIds)) {
    const classIds = [...new Set(body.classIds)];
    const found = await prisma.classRoom.findMany({ where: { id: { in: classIds } }, select: { id: true } });
    if (found.length !== classIds.length) {
      return NextResponse.json({ error: "One or more classes do not exist." }, { status: 400 });
    }
    const existing = await prisma.subjectClass.findMany({ where: { subjectId: id }, select: { classRoomId: true } });
    const existingSet = new Set(existing.map((c) => c.classRoomId));
    classes = {
      deleteMany: { classRoomId: { notIn: classIds.length ? classIds : ["__none__"] } },
      create: classIds.filter((classRoomId) => !existingSet.has(classRoomId)).map((classRoomId) => ({ classRoomId })),
    };
  }

  const updated = await prisma.subject.update({
    where: { id },
    data: { name, ...(classes ? { classes } : {}) },
    include: { classes: { include: { classRoom: true } } },
  });

  await logActivity({ userId: admin.user.id, type: "ADMIN_UPDATE_SUBJECT", targetId: id, ...meta }).catch(() => null);
  return NextResponse.json({ subject: updated });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { _count: { select: { questions: true } } },
  });
  if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
  if (subject._count.questions > 0) {
    return NextResponse.json({ error: "Cannot delete: this subject has questions in the bank." }, { status: 409 });
  }

  await prisma.subject.delete({ where: { id } });
  await logActivity({ userId: admin.user.id, type: "ADMIN_DELETE_SUBJECT", targetId: id, ...meta }).catch(() => null);
  return NextResponse.json({ ok: true });
}