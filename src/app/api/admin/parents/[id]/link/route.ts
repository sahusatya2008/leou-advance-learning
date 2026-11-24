import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Body: { studentId: <student User id>, replace?: boolean }
 *
 * Linking is multi-child: a parent may hold any number of students. A student
 * only ever has one parent, so moving them from another parent requires
 * `replace: true` (the route reports 409 + needsReplace otherwise).
 */
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
  const replace = body.replace === true;

  const parent = await prisma.user.findUnique({
    where: { id },
    include: { parentProfile: true },
  });
  if (!parent || parent.role !== "PARENT" || !parent.parentProfile) {
    return NextResponse.json({ error: "Parent not found." }, { status: 404 });
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { studentProfile: { include: { user: { select: { username: true } } } } },
  });
  if (!student || student.role !== "STUDENT" || !student.studentProfile) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const profile = student.studentProfile;
  const currentParentId = profile.parentUserId;
  if (currentParentId && currentParentId !== parent.parentProfile.id) {
    if (!replace) {
      const existing = await prisma.parentProfile.findUnique({
        where: { id: currentParentId },
        include: { user: { select: { username: true } } },
      });
      return NextResponse.json(
        {
          error: `Student is already linked to another parent${existing ? ` (${existing.user.username})` : ""}.`,
          needsReplace: true,
        },
        { status: 409 },
      );
    }
  }

  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: { parentUserId: parent.parentProfile.id },
  });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_MANAGE_PARENT",
    targetId: id,
    metadata: {
      action: "link",
      studentId,
      studentUsername: student.username,
      replacedParent: replace && currentParentId && currentParentId !== parent.parentProfile.id ? currentParentId : undefined,
      ...meta,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: true, studentId });
}
