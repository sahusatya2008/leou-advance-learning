import { NextResponse } from "next/server";
import { createStudent, type CreateStudentInput } from "@/services/studentService";
import { logActivity } from "@/lib/log";
import { getRequestMeta } from "@/lib/requestMeta";
import { rateLimit } from "@/lib/rateLimit";
import { SECURITY, ipRuleFor } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const meta = getRequestMeta(req);

  // Registration is public and expensive (bcrypt + a stored face photo), so it
  // is budgeted per device and per IP before any work is done. The per-IP budget
  // is the loose one, so a classroom behind a single NAT still fits.
  const budgets: Array<[string, typeof SECURITY.REGISTER]> = [
    [`${SECURITY.REGISTER.id}:ip:${meta.ip}`, ipRuleFor(SECURITY.REGISTER)],
    [`${SECURITY.REGISTER.id}:dev:${meta.deviceId}`, SECURITY.REGISTER],
  ];
  for (const [key, budget] of budgets) {
    const result = rateLimit(key, budget);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Too many sign-ups from here. Try again in ${result.retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
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

  const result = await createStudent({ ...input, onboardingRequired: true });
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  await logActivity({
    userId: result.user.id,
    type: "FACE_ENROLL",
    metadata: { samples: input.faceEmbeddings.length },
    ...meta,
  });

  return NextResponse.json({ ok: true, studentId: result.user.id });
}