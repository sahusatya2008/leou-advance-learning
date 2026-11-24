import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { runnerSessionState, runnerKillSession } from "@/services/runner";
import { getSessionOwner, releaseSession } from "@/lib/runSessions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  const { sessionId } = await ctx.params;

  const owner = getSessionOwner(sessionId);
  // A practical session belongs to the practical routes; never serve one here.
  if (!owner || owner.kind !== "ASSESSMENT" || owner.studentProfileId !== profId)
    return NextResponse.json({ error: "Session not found." }, { status: 404 });

  const submission = await prisma.submission.findUnique({
    where: { id: owner.submissionId },
    select: { id: true, studentId: true, status: true },
  });
  if (!submission || submission.studentId !== profId || submission.status !== "IN_PROGRESS") {
    // Return whatever the program produced before tearing the session down —
    // without this the terminal finishes with an empty transcript.
    let state: Record<string, unknown> | null = null;
    try {
      state = (await runnerSessionState(sessionId)) as unknown as Record<string, unknown>;
    } catch {
      /* the session is already gone; there is nothing left to read */
    }
    runnerKillSession(sessionId).catch(() => null);
    releaseSession(sessionId);
    return NextResponse.json({ ...(state ?? {}), status: "exited", closed: true }, { status: 200 });
  }

  try {
    return NextResponse.json(await runnerSessionState(sessionId));
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  const { sessionId } = await ctx.params;

  const owner = getSessionOwner(sessionId);
  // A practical session belongs to the practical routes; never serve one here.
  if (!owner || owner.kind !== "ASSESSMENT" || owner.studentProfileId !== profId)
    return NextResponse.json({ error: "Session not found." }, { status: 404 });

  try {
    await runnerKillSession(sessionId);
    releaseSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}