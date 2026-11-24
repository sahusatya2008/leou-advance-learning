import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { runnerSendInput } from "@/services/runner";
import { getSessionOwner } from "@/lib/runSessions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;
  const { sessionId } = await ctx.params;

  const owner = getSessionOwner(sessionId);
  // A practical session belongs to the practical routes; never serve one here.
  if (!owner || owner.kind !== "ASSESSMENT" || owner.studentProfileId !== profId)
    return NextResponse.json({ error: "Session not found." }, { status: 404 });

  let body: { input?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const input = String(body.input ?? "").slice(0, 2000);

  const submission = await prisma.submission.findUnique({
    where: { id: owner.submissionId },
    select: { studentId: true, status: true },
  });
  if (!submission || submission.studentId !== profId || submission.status !== "IN_PROGRESS")
    return NextResponse.json({ error: "Submission is not open for attempts." }, { status: 409 });

  try {
    return NextResponse.json(await runnerSendInput(sessionId, input));
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}