import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { purgeStaleRecordings, RECORDING_RETENTION_DAYS } from "@/services/practicalService";
import { deleteOrphanRecordings } from "@/lib/recordings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Runs the retention sweep inside the app.
 *
 * This has to be a route rather than a plain script: the recordings live on a
 * Docker volume that only exists inside this container, so a sweep run from the
 * host can mark rows deleted but cannot unlink the bytes, which would leave the
 * files on the volume forever. The daily agent therefore calls this.
 */
export async function POST() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const result = await purgeStaleRecordings();

  // Orphans are files with no row pointing at them, which happens when a doubt or
  // a whole student is deleted by cascade: the row goes, the bytes do not. Nothing
  // in the product can still reach such a file, so it is removed here rather than
  // sitting on the volume forever. It is reported separately from the retention
  // count because a large number of them means something upstream is deleting
  // threads, which is worth noticing.
  const known = new Set(
    (await prisma.practicalRecording.findMany({ select: { storageName: true } })).map((r) => r.storageName)
  );
  const orphansRemoved = deleteOrphanRecordings(known);

  return NextResponse.json({
    ...result,
    retentionDays: RECORDING_RETENTION_DAYS,
    orphanFilesRemoved: orphansRemoved,
  });
}
