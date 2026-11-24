import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { runnerSessionState, runnerKillSession, type SessionState } from "@/services/runner";
import { getSessionOwner, releaseSession } from "@/lib/runSessions";
import { loadOwnAttempt, recordSessionTranscript } from "@/services/practicalService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

/** Writes the transcript of an ending session exactly once (deduped inside). */
async function preserveTranscript(
  sessionId: string,
  owner: { practicalAttemptId: string; studentProfileId: string },
  state: SessionState
) {
  await recordSessionTranscript({
    attemptId: owner.practicalAttemptId,
    studentId: owner.studentProfileId,
    sessionId,
    stdout: state.stdout,
    stderr: state.stderr,
    exitCode: state.exitCode,
  }).catch(() => null);
}

/**
 * Polls a live practical session. An assessment session is rejected outright so
 * the two id spaces stay disjoint.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const profId = auth.current.user.studentProfile?.id;
  const { sessionId } = await ctx.params;

  const owner = getSessionOwner(sessionId);
  if (!owner || owner.kind !== "PRACTICAL" || owner.studentProfileId !== profId)
    return NextResponse.json({ error: "Session not found." }, { status: 404 });

  // The attempt may have been finished or the set archived since the session was
  // claimed; either way the session is over.
  const own = await loadOwnAttempt({ userId: auth.current.user.id, attemptId: owner.practicalAttemptId });
  if (!own.ok || own.attempt.status === "FINISHED") {
    // Return the transcript before the session is torn down so the workspace
    // does not lose the tail of the run.
    let state: SessionState | null = null;
    try {
      state = await runnerSessionState(sessionId);
    } catch {
      /* the session is already gone; there is nothing left to read */
    }
    if (state) await preserveTranscript(sessionId, owner, state);
    runnerKillSession(sessionId).catch(() => null);
    releaseSession(sessionId);
    return NextResponse.json({ ...(state ?? {}), status: "exited", closed: true }, { status: 200 });
  }

  try {
    const state = await runnerSessionState(sessionId);
    // A shell or interpreter that exited on its own still deserves its
    // transcript in the activity trail; the write is deduped, so the kill the
    // client sends next cannot double it.
    if (state.status === "exited") await preserveTranscript(sessionId, owner, state);
    return NextResponse.json(state);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const profId = auth.current.user.studentProfile?.id;
  const { sessionId } = await ctx.params;

  const owner = getSessionOwner(sessionId);
  if (!owner || owner.kind !== "PRACTICAL" || owner.studentProfileId !== profId)
    return NextResponse.json({ error: "Session not found." }, { status: 404 });

  // Read the transcript before the kill: the runner keeps the buffers either
  // way, but this also captures anything the final keystroke produced.
  let state: SessionState | null = null;
  try {
    state = await runnerSessionState(sessionId);
  } catch {
    /* already swept; record nothing rather than a partial transcript */
  }
  if (state) await preserveTranscript(sessionId, owner, state);

  try {
    await runnerKillSession(sessionId);
    releaseSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}