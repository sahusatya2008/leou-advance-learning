import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { listStudentPracticals } from "@/services/practicalService";
import { requireActiveService } from "@/services/onboardingService";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const userId = auth.current.user.id;

  // A lapsed student must not even see the list. Only the write routes used to
  // check the service, which left a published set readable after expiry.
  const guard = await requireActiveService(userId);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  const practicals = await listStudentPracticals(userId);
  return NextResponse.json({ practicals });
}
