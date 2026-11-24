import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { createStudent, type CreateStudentInput } from "@/services/studentService";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    // Explicit select, not `include`: the raw profile carries the biometric
    // template (faceEmbeddings) and the face photo, and this list endpoint has
    // no use for either. Only the fields the picker actually renders are sent.
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      status: true,
      onboardingRequired: true,
      createdAt: true,
      studentProfile: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          classRoomId: true,
          stream: true,
          schoolName: true,
          schoolStatus: true,
          schoolClassHistory: true,
          parentUserId: true,
          createdAt: true,
          updatedAt: true,
          classRoom: { select: { id: true, name: true } },
          batches: { select: { batch: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  return NextResponse.json({ students });
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

  const input: CreateStudentInput = {
    fullName: String(body.fullName ?? ""),
    classRoomId: String(body.classRoomId ?? ""),
    stream: (body.stream as CreateStudentInput["stream"]) ?? null,
    subjectIds: Array.isArray(body.subjectIds) ? body.subjectIds.map(String) : [],
    schoolName: String(body.schoolName ?? ""),
    schoolStatus: body.schoolStatus === "PAST" ? "PAST" : "CURRENT",
    schoolClassHistory: body.schoolClassHistory ? String(body.schoolClassHistory) : undefined,
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    username: String(body.username ?? ""),
    password: String(body.password ?? ""),
    faceEmbeddings: (body.faceEmbeddings as number[][]) ?? [],
    facePhoto: String(body.facePhoto ?? ""),
  };

  const result = await createStudent(input);
  if (!result.ok) {
    // A rejected enrollment used to leave no trace beyond a spinner that
    // stopped, so nobody could tell a duplicate username from an unreadable
    // photo. Recording the reason makes the failure diagnosable after the fact
    // and keeps the audit trail complete.
    await logActivity({
      userId: admin.user.id,
      type: "ADMIN_CREATE_STUDENT_FAIL",
      metadata: { errors: result.errors, username: input.username || null },
      ...meta,
    }).catch(() => null);
    return NextResponse.json({ error: result.errors.join(" · ") }, { status: 400 });
  }

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_CREATE_STUDENT",
    targetId: result.user.id,
    metadata: { studentUserId: result.user.id, username: result.user.username },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ student: result.user }, { status: 201 });
}