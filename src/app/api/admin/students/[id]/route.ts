import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { isValidEmail, isValidPassword, isValidUsername } from "@/lib/validation";
import { passwordFields } from "@/lib/passwords";
import type { UserStatus, SchoolStatus } from "@/generated/prisma/enums";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true },
  });
  if (!user || user.role !== "STUDENT" || !user.studentProfile)
    return NextResponse.json({ error: "Student not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const prof = user.studentProfile;

  // Resolve field values (defaulting to current)
  const fullName = body.fullName !== undefined ? String(body.fullName).trim() : prof.fullName;
  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : user.email;
  const phone = body.phone !== undefined ? String(body.phone ?? "").trim() : (user.phone ?? "");
  const username = body.username !== undefined ? String(body.username).trim() : user.username;
  const schoolName = body.schoolName !== undefined ? String(body.schoolName).trim() : prof.schoolName;
  const schoolStatus = body.schoolStatus ?? prof.schoolStatus;
  const schoolClassHistory = body.schoolClassHistory !== undefined ? String(body.schoolClassHistory ?? "") : (prof.schoolClassHistory ?? "");
  const stream = body.stream !== undefined ? ((body.stream as never) ?? null) : prof.stream;
  const classRoomId = body.classRoomId !== undefined ? String(body.classRoomId) : prof.classRoomId;
  const status = body.status ?? user.status;
  const password = body.password !== undefined && String(body.password).length ? String(body.password) : null;

  // Validation
  const allStatuses: UserStatus[] = ["ACTIVE", "SUSPENDED", "BLOCKED"];
  if (!allStatuses.includes(status as UserStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (fullName.trim().length < 3) return NextResponse.json({ error: "Full name must be at least 3 characters." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (typeof phone === "string" && !/^[0-9+\-\s]{7,15}$/.test(phone)) {
    return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });
  }
  if (!isValidUsername(username)) return NextResponse.json({ error: "Username must be 4-32 chars (letters, numbers, _ .)." }, { status: 400 });
  if (password && !isValidPassword(password)) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const classRoom = await prisma.classRoom.findUnique({ where: { id: classRoomId } });
  if (!classRoom || !classRoom.isActive) return NextResponse.json({ error: "Selected class is not available." }, { status: 400 });
  if (classRoom.hasStreams && !stream) return NextResponse.json({ error: "Stream selection is required for this class." }, { status: 400 });

  const usernameTaken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (usernameTaken && usernameTaken.id !== id) return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailTaken && emailTaken.id !== id) return NextResponse.json({ error: "Email is already registered." }, { status: 409 });
  const phoneTaken = phone
    ? await prisma.user.findFirst({ where: { phone }, select: { id: true } })
    : null;
  if (phoneTaken && phoneTaken.id !== id) return NextResponse.json({ error: "Phone number is already registered." }, { status: 409 });

  // Batch assignment edits
  let batchUpdate: Record<string, unknown> | undefined;
  if (Array.isArray(body.batchIds)) {
    const batchIds = [...new Set(body.batchIds.map((b) => String(b)))];
    const batches = await prisma.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, classRoomId: true } });
    if (batches.length !== batchIds.length) {
      return NextResponse.json({ error: "One or more batches do not exist." }, { status: 400 });
    }
    if (batches.some((b) => b.classRoomId !== classRoomId)) {
      return NextResponse.json({ error: "Batches must belong to the student's class." }, { status: 400 });
    }
    const existing = await prisma.batchStudent.findMany({
      where: { studentId: prof.id },
      select: { batchId: true },
    });
    const existingSet = new Set(existing.map((e) => e.batchId));
    batchUpdate = {
      deleteMany: { batchId: { notIn: batchIds.length ? batchIds : ["__none__"] } },
      create: batchIds.filter((bid) => !existingSet.has(bid)).map((batchId) => ({ batchId })),
    };
  }

  const pwFields = password ? await passwordFields(password) : null;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      username,
      email,
      phone,
      status: status as UserStatus,
      ...(pwFields ?? {}),
      studentProfile: {
        update: {
          fullName,
          classRoomId,
          stream,
          schoolName,
          schoolStatus: schoolStatus as SchoolStatus,
          ...(schoolClassHistory ? { schoolClassHistory } : { schoolClassHistory: null }),
          ...(batchUpdate ? { batches: batchUpdate } : {}),
        },
      },
    },
    // Return only what the caller needs. An unrestricted `include` here echoed
    // back `passwordHash`, `passwordEnc` and the face template on every save.
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      status: true,
      studentProfile: { select: { id: true, fullName: true, classRoomId: true, stream: true } },
    },
  });

  const logType =
    body.status === "SUSPENDED"
      ? "ADMIN_SUSPEND_STUDENT"
      : body.status === "BLOCKED"
        ? "ADMIN_BLOCK_STUDENT"
        : "ADMIN_UPDATE_STUDENT";

  await logActivity({
    userId: admin.user.id,
    type: logType,
    targetId: user.id,
    metadata: { username: updated.username, fullName: updated.studentProfile?.fullName },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ student: updated });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({ where: { id }, include: { studentProfile: true } });
  if (!user || user.role !== "STUDENT") return NextResponse.json({ error: "Student not found." }, { status: 404 });

  await prisma.user.delete({ where: { id } });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_DELETE_STUDENT",
    targetId: id,
    metadata: { username: user.username, fullName: user.studentProfile?.fullName },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}