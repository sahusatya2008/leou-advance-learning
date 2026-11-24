import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const classes = await prisma.classRoom.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { students: true, batches: true } },
      subjects: { include: { subject: true } },
    },
  });
  return NextResponse.json({ classes });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Class name is required." }, { status: 400 });

  const exists = await prisma.classRoom.findUnique({ where: { name } });
  if (exists) return NextResponse.json({ error: "A class with this name already exists." }, { status: 409 });

  const classroom = await prisma.classRoom.create({
    data: {
      name,
      hasStreams: !!body.hasStreams,
      sortOrder: Number(body.sortOrder ?? 0) || 0,
    },
  });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_CREATE_CLASS",
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ classroom });
}