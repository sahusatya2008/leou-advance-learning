import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { authorizeRecordingPlayback } from "@/services/practicalService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ recordingId: string }> };

/** Admin playback of a doubt recording, for helping a student. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { recordingId } = await ctx.params;

  const allowed = await authorizeRecordingPlayback(auth.current.user.id, "ADMIN", recordingId);
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
