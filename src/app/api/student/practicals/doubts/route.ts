import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import {
  attachDoubtRecording,
  createDoubt,
  listStudentDoubts,
  markDoubtSatisfied,
  replyToDoubt,
} from "@/services/practicalService";
import { requireActiveService } from "@/services/onboardingService";

export const runtime = "nodejs";

/**
 * Student-side doubts for one practical question.
 *
 * GET/POST with query params read and create; the PATCH actions cover replying,
 * confirming that an answer helped, and attaching a recording. Everything is
 * re-authorised inside the service, and the service is what knows about batch
 * membership and entitlements.
 */
export async function GET(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;

  const guard = await requireActiveService(auth.current.user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  const url = new URL(req.url);
  const assignmentId = url.searchParams.get("assignmentId") ?? "";
  const questionId = url.searchParams.get("questionId") ?? "";
  if (!assignmentId || !questionId)
    return NextResponse.json({ error: "assignmentId and questionId are required." }, { status: 400 });

  const result = await listStudentDoubts({ userId: auth.current.user.id, assignmentId, questionId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ doubts: result.doubts });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const userId = auth.current.user.id;

  const guard = await requireActiveService(userId);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const action = String(body.action ?? "");

  if (action === "create") {
    const result = await createDoubt({
      userId,
      assignmentId: String(body.assignmentId ?? ""),
      questionId: String(body.questionId ?? ""),
      body: String(body.body ?? ""),
      ...(body.codeExcerpt ? { codeExcerpt: String(body.codeExcerpt) } : {}),
      ...(body.terminalExcerpt ? { terminalExcerpt: String(body.terminalExcerpt) } : {}),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ doubt: result.doubt });
  }

  if (action === "reply") {
    const result = await replyToDoubt({
      userId,
      role: "STUDENT",
      doubtId: String(body.doubtId ?? ""),
      body: String(body.body ?? ""),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ doubt: result.doubt });
  }

  if (action === "satisfied") {
    const result = await markDoubtSatisfied({ userId, doubtId: String(body.doubtId ?? "") });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ doubt: result.doubt, recordingsDeleted: result.recordingsDeleted });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

/**
 * Recording upload. Multipart, because a recording is real bytes; consent is a
 * required field and the service refuses the write without it.
 */
export async function PUT(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;

  const guard = await requireActiveService(auth.current.user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read that upload." }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "");
  const consent = form.get("consent") === "true";
  const messageId = form.get("messageId") ? String(form.get("messageId")) : null;
  const durationRaw = form.get("durationMs");
  const file = form.get("file");

  if (kind !== "SCREEN" && kind !== "VOICE")
    return NextResponse.json({ error: "Choose a screen or voice recording." }, { status: 400 });
  if (!(file instanceof File))
    return NextResponse.json({ error: "No recording was attached." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await attachDoubtRecording({
    userId: auth.current.user.id,
    doubtId: String(form.get("doubtId") ?? ""),
    messageId,
    kind,
    buffer,
    consented: consent,
    durationMs: durationRaw ? Number(durationRaw) : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ recording: result.recording });
}