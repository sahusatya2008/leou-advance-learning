import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { availableParentUsername, registerParentForStudent } from "@/services/parentService";

export const runtime = "nodejs";

/** The status of the student's parent link, plus a suggested username to offer. */
export async function GET() {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  const student = await prisma.user.findUnique({
    where: { id: user.id },
    include: { studentProfile: { include: { parent: { include: { user: { select: { id: true, username: true } } } } } } },
  });
  const parent = student?.studentProfile?.parent ?? null;

  if (parent) {
    return NextResponse.json({
      linked: true,
      parent: { username: parent.user.username, fullName: parent.fullName, usernameLocked: parent.usernameLocked },
    });
  }

  return NextResponse.json({ linked: false, suggestedUsername: await availableParentUsername(user.username) });
}

/** Register a parent for the signed-in student. */
export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const meta = getRequestMeta(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await registerParentForStudent({
    studentUserId: user.id,
    username: String(body.username ?? ""),
    password: String(body.password ?? ""),
    fullName: body.fullName ? String(body.fullName) : undefined,
    email: body.email ? String(body.email) : undefined,
    phone: body.phone ? String(body.phone) : undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await logActivity({
    userId: user.id,
    type: "ADMIN_MANAGE_PARENT",
    targetId: result.parentUserId,
    metadata: { action: "student_register_parent", username: result.username },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ok: true, username: result.username }, { status: 201 });
}
