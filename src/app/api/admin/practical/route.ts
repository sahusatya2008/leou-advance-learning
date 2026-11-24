import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import {
  addQuestionToPractical,
  getPracticalAssignment,
  removeQuestionFromPractical,
  reorderPracticalQuestions,
  upsertPracticalAssignment,
} from "@/services/practicalService";

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * GET    ?batchId&subjectId&topic  -> the practical set for that chapter
 * POST   { batchId, subjectId, topic, title?, instructions?, status?, action? }
 *          action: "create" | "add" | "remove" | "reorder"
 */
export async function GET(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  const batchId = url.searchParams.get("batchId") ?? "";
  const subjectId = url.searchParams.get("subjectId") ?? "";
  const topic = url.searchParams.get("topic") ?? "";
  if (!batchId || !subjectId || !topic) return bad("batchId, subjectId and topic are required.");

  const assignment = await getPracticalAssignment({ batchId, subjectId, topic });
  return NextResponse.json({ assignment });
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
    return bad("Invalid JSON.");
  }
  const action = String(body.action ?? "create");

  if (action === "create") {
    const batchId = String(body.batchId ?? "");
    const subjectId = String(body.subjectId ?? "");
    const topic = String(body.topic ?? "").trim();
    if (!batchId || !subjectId || !topic) return bad("batchId, subjectId and topic are required.");
    const status = body.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
    if (status && !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return bad("Unknown status.");

    const result = await upsertPracticalAssignment({
      batchId,
      subjectId,
      topic,
      title: typeof body.title === "string" ? body.title : undefined,
      instructions: typeof body.instructions === "string" ? body.instructions : undefined,
      status,
    });
    if (!result.ok) return bad(result.error);
    await logActivity({
      userId: admin.user.id,
      type: "ADMIN_CREATE_PRACTICAL",
      targetId: result.id,
      metadata: { action: "practical.upsert", topic, status: status ?? null },
      ...meta,
    }).catch(() => null);
    return NextResponse.json({ ok: true, id: result.id });
  }

  const assignmentId = String(body.assignmentId ?? "");
  if (!assignmentId) return bad("assignmentId is required.");

  if (action === "add" || action === "remove") {
    const questionId = String(body.questionId ?? "");
    if (!questionId) return bad("questionId is required.");
    const result =
      action === "add"
        ? await addQuestionToPractical({ assignmentId, questionId })
        : await removeQuestionFromPractical({ assignmentId, questionId });
    if (!result.ok) return bad(result.error, 400);
    await logActivity({
      userId: admin.user.id,
      type: "ADMIN_UPDATE_PRACTICAL",
      targetId: assignmentId,
      metadata: { action: `practical.${action}`, questionId },
      ...meta,
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  if (action === "reorder") {
    const ordered = Array.isArray(body.orderedQuestionIds)
      ? (body.orderedQuestionIds as unknown[]).map(String)
      : null;
    if (!ordered) return bad("orderedQuestionIds must be an array.");
    const result = await reorderPracticalQuestions({ assignmentId, orderedQuestionIds: ordered });
    if (!result.ok) return bad(result.error);
    return NextResponse.json({ ok: true });
  }

  return bad(`Unknown action "${action}".`);
}