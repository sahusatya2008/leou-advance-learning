import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { createRenewalRequest } from "@/services/onboardingService";
import { parseOnboardingBody } from "../_shared";

export const runtime = "nodejs";

/** Renews a subscription (or subscriptions) into the next month, with edits.
 * renewsActivationIds names which live subscription windows the renewal takes
 * over once approved; empty means a whole-plan renewal. */
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
  const result = await createRenewalRequest(user.id, input, { requestId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    requestId: result.request.id,
    quotation: result.quotation,
  });
}