import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { runnerSendInput } from "@/services/runner";
import { getSessionOwner } from "@/lib/runSessions";
import { loadOwnAttempt, recordTerminalInput } from "@/services/practicalService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

/** Feeds one line to a live practical session (REPL entry, shell command). */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const userId = auth.current.user.id;
  const profId = auth.current.user.studentProfile?.id;
  const { sessionId } = await ctx.params;

  const owner = getSessionOwner(sessionId);
  if (!owner || owner.kind !== "PRACTICAL" || owner.studentProfileId !== profId)
    return NextResponse.json({ error: "Session not found." }, { status: 404 });

  let body: { input?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const input = String(body.input ?? "").slice(0, 2000);

  const own = await loadOwnAttempt({ userId, attemptId: owner.practicalAttemptId });
  if (!own.ok || own.attempt.status === "FINISHED")
    return NextResponse.json({ error: "This attempt is no longer open." }, { status: 409 });

  try {
    const result = await runnerSendInput(sessionId, input);
    // Recorded after the send succeeded so the trail never shows input the
    // runner rejected. A failed insert must not fail the request.
    await recordTerminalInput({
      attemptId: owner.practicalAttemptId,
      studentId: owner.studentProfileId,
      sessionId,
      text: input,
    }).catch(() => null);
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}