import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { isValidEmail, isValidPassword } from "@/lib/validation";
import { passwordFields } from "@/lib/passwords";
import type { SchoolStatus, Stream } from "@/generated/prisma/enums";

export const runtime = "nodejs";

/**
 * A student editing their own profile.
 *
 * Deliberately narrow: name, username and class are provisioned by the
 * institute and stay under admin control, so a student can change only their
 * contact and schooling details here. The admin "manage student" page reads the
 * same `StudentProfile` row, so edits show up there immediately.
 */
export async function PATCH(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const meta = getRequestMeta(req);

  const profile = user.studentProfile;
  if (!profile) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : user.email;
  const phone = body.phone !== undefined ? String(body.phone ?? "").trim() : (user.phone ?? "");
  const schoolName = body.schoolName !== undefined ? String(body.schoolName).trim() : profile.schoolName;
  const schoolStatus = (body.schoolStatus ?? profile.schoolStatus) as SchoolStatus;
  const schoolClassHistory =
    body.schoolClassHistory !== undefined ? String(body.schoolClassHistory ?? "") : (profile.schoolClassHistory ?? "");
  const stream = (body.stream !== undefined ? ((body.stream as Stream | null) ?? null) : profile.stream) as Stream | null;
  const newPassword = body.newPassword !== undefined && String(body.newPassword).length ? String(body.newPassword) : null;

  if (!isValidEmail(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone)) {
    return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });
  }
  if (schoolName.length < 2) return NextResponse.json({ error: "School name is required." }, { status: 400 });
  if (!["CURRENT", "PAST"].includes(schoolStatus)) {
    return NextResponse.json({ error: "Invalid school status." }, { status: 400 });
  }
  if (newPassword && !isValidPassword(newPassword)) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const classRoom = await prisma.classRoom.findUnique({ where: { id: profile.classRoomId } });
  if (classRoom?.hasStreams && !stream) {
    return NextResponse.json({ error: "Stream selection is required for your class." }, { status: 400 });
  }

  const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailTaken && emailTaken.id !== user.id) {
    return NextResponse.json({ error: "Email is already registered." }, { status: 409 });
  }
  const phoneTaken = phone ? await prisma.user.findFirst({ where: { phone }, select: { id: true } }) : null;
  if (phoneTaken && phoneTaken.id !== user.id) {
    return NextResponse.json({ error: "Phone number is already registered." }, { status: 409 });
  }

  const pwFields = newPassword ? await passwordFields(newPassword) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      phone: phone || null,
      ...(pwFields ?? {}),
      studentProfile: {
        update: {
          schoolName,
          schoolStatus,
          schoolClassHistory: schoolClassHistory || null,
          stream: classRoom?.hasStreams ? stream : null,
        },
      },
    },
  });

  await logActivity({
    userId: user.id,
    type: "ADMIN_UPDATE_STUDENT",
    metadata: { self: true, passwordChanged: !!newPassword },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
