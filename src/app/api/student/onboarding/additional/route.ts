import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { createAdditionalServiceRequest } from "@/services/onboardingService";
import { parseOnboardingBody } from "../_shared";

export const runtime = "nodejs";

/** Adds services to a plan that is already running; bills only the difference. */
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
  const result = await createAdditionalServiceRequest(user.id, input, { requestId });
  // A refusal has to explain itself. "Already part of your current plan" and
  // "no price is configured for what you picked" are different problems, and the
  // unpriced list plus the pricing warnings are what let the page say which one
  // it was instead of showing a flat, often wrong, sentence.
  if (!result.ok) {
    // Only the pricing refusals carry the detail; the other failures (no active
    // plan, invalid selection) are self-explanatory and have nothing to add.
    const unpriced = "unpriced" in result ? result.unpriced : undefined;
    const warnings = "warnings" in result ? result.warnings : undefined;
    return NextResponse.json(
      { error: result.error, ...(unpriced ? { unpriced } : {}), ...(warnings ? { warnings } : {}) },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    requestId: result.request.id,
    quotation: result.quotation,
    // Added chapters that carry no rate: the bill is correct, but the student
    // must not walk away thinking those were covered.
    unpriced: result.unpriced ?? [],
  });
}