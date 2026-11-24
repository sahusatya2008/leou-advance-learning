import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { authorizeRecordingPlayback } from "@/services/practicalService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ recordingId: string }> };

/**
 * Plays back one of the caller's own recordings. Private, no-store: this is the
 * only route that can read the bytes, and it re-checks ownership on every hit.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { recordingId } = await ctx.params;

  const allowed = await authorizeRecordingPlayback(auth.current.user.id, "STUDENT", recordingId);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const stream = fs.createReadStream(allowed.abs);
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": allowed.mimeType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
