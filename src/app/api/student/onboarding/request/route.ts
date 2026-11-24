import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { createOrUpdateOnboardingRequest } from "@/services/onboardingService";
import { parseOnboardingBody } from "../_shared";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { input, requestId } = parseOnboardingBody(body);
  // requestId present ⇒ the student is editing an exact quotation from the
  // final quotation screen (step 2's "Edit choices"), not overwriting some
  // other pending request by guesswork.
  const result = await createOrUpdateOnboardingRequest(user.id, input, { requestId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    requestId: result.request.id,
    quotation: result.quotation,
    locked: false,
  });
}