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

  const classroom = await prisma.classRoom.findUnique({ where: { id } });
  if (!classroom) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  let body: { name?: string; hasStreams?: boolean; sortOrder?: unknown; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : classroom.name;
  if (name.length < 2) return NextResponse.json({ error: "Class name is required." }, { status: 400 });

  const dup = await prisma.classRoom.findUnique({ where: { name } });
  if (dup && dup.id !== id) {
    return NextResponse.json({ error: "A class with this name already exists." }, { status: 409 });
  }

  const updated = await prisma.classRoom.update({
    where: { id },
    data: {
      name,
      hasStreams: body.hasStreams ?? classroom.hasStreams,
      sortOrder: body.sortOrder !== undefined ? body.sortOrder || 0 : classroom.sortOrder,
      isActive: body.isActive ?? classroom.isActive,
    },
  });

  await logActivity({ userId: admin.user.id, type: "ADMIN_UPDATE_CLASS", targetId: id, ...meta }).catch(() => null);
  return NextResponse.json({ classroom: updated });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const classroom = await prisma.classRoom.findUnique({
    where: { id },
    include: { _count: { select: { students: true, batches: true } } },
  });
  if (!classroom) return NextResponse.json({ error: "Class not found." }, { status: 404 });
  if (classroom._count.students > 0 || classroom._count.batches > 0) {
    return NextResponse.json(
      { error: "Cannot delete: move or remove its students and batches first." },
      { status: 409 }
    );
  }

  await prisma.classRoom.delete({ where: { id } });
  await logActivity({ userId: admin.user.id, type: "ADMIN_DELETE_CLASS", targetId: id, ...meta }).catch(() => null);
  return NextResponse.json({ ok: true });
}