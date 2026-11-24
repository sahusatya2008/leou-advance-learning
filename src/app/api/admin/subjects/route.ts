import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { classes: true, questions: true } },
      classes: { include: { classRoom: true } },
    },
  });
  return NextResponse.json({ subjects });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);

  let body: { name?: string; code?: string; classIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Subject name is required." }, { status: 400 });

  const dup = await prisma.subject.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (dup) return NextResponse.json({ error: "A subject with this name already exists." }, { status: 409 });

  const code = (body.code ?? "").trim().toUpperCase() || name.slice(0, 5).toUpperCase();
  const codeExists = await prisma.subject.findUnique({ where: { code } });
  if (codeExists) return NextResponse.json({ error: `Subject code “${code}” is already in use.` }, { status: 409 });

  const classIds = Array.isArray(body.classIds) ? [...new Set(body.classIds)] : [];
  const classes = await prisma.classRoom.findMany({ where: { id: { in: classIds } }, select: { id: true } });
  if (classes.length !== classIds.length) {
    return NextResponse.json({ error: "One or more classes do not exist." }, { status: 400 });
  }

  const subject = await prisma.subject.create({
    data: {
      name,
      code,
      classes: { create: classIds.map((classRoomId) => ({ classRoomId })) },
    },
    include: { classes: { include: { classRoom: true } } },
  });

  await logActivity({ userId: admin.user.id, type: "ADMIN_CREATE_SUBJECT", targetId: subject.id, ...meta }).catch(() => null);
  return NextResponse.json({ subject });
}