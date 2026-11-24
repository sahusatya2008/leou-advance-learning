import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { buildEnrollment, collectImages, livenessLog } from "@/services/faceEnrollmentService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true },
  });
  if (!user || !user.studentProfile || user.role !== "STUDENT") {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  let body: { images?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Shared with the self-service re-enrollment route so an admin enrollment and
  // a student re-enrollment can never enforce different quality bars.
  const images = collectImages(body);
  const result = await buildEnrollment(images);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  await prisma.studentProfile.update({
    where: { id: user.studentProfile.id },
    data: {
      faceEmbeddings: result.embeddings,
      facePhotoUrl: result.images[0],
    },
  });

  await logActivity({
    userId: admin.user.id,
    type: "FACE_ENROLL",
    targetId: user.id,
    metadata: {
      actor: "ADMIN",
      mode: typeof body.mode === "string" && body.mode ? body.mode : "unknown",
      submittedFrames: images.length,
      acceptedFrames: result.accepted,
      samples: result.embeddings.length,
      liveness: livenessLog(result.embed),
    },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ok: true, samples: result.embeddings.length, faceCount: result.embeddings.length });
}
