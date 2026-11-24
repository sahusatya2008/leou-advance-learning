import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Body: { studentId: <student User id> } — clears the link if it points here. */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const studentId = String(body.studentId ?? "");

  const parent = await prisma.user.findUnique({
    where: { id },
    include: { parentProfile: true },
  });
  if (!parent || parent.role !== "PARENT" || !parent.parentProfile) {
    return NextResponse.json({ error: "Parent not found." }, { status: 404 });
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { studentProfile: true },
  });
  if (!student || student.role !== "STUDENT" || !student.studentProfile) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  if (student.studentProfile.parentUserId !== parent.parentProfile.id) {
    return NextResponse.json({ error: "That student is not linked to this parent." }, { status: 409 });
  }

  await prisma.studentProfile.update({
    where: { id: student.studentProfile.id },
    data: { parentUserId: null },
  });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_MANAGE_PARENT",
    targetId: id,
    metadata: { action: "unlink", studentId, studentUsername: student.username, ...meta },
  }).catch(() => null);

  return NextResponse.json({ ok: true, studentId });
}
