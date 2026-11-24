import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getLearningCatalogue } from "@/services/learningService";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;

  // The catalogue always includes the free GOC course. `eligible` still means
  // "has a paid chapter entitled", exactly as before.
  const catalogue = await getLearningCatalogue(auth.current.user.id);
  return NextResponse.json(
    { eligible: catalogue.eligible, chapters: catalogue.chapters },
    { headers: { "cache-control": "no-store" } },
  );
}
