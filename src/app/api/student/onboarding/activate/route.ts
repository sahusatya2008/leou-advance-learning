import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { redeemServiceCode } from "@/services/onboardingService";
import { registerFailure, clearFailures, blockedFor } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const code = String(body.code ?? "").trim();
  if (!/^\d{15}$/.test(code))
    return NextResponse.json({ error: "Enter the 15-digit payment code exactly as shared by the admin." }, { status: 400 });

  // A 15-digit code is only guessable, so cap attempts per account and escalate.
  const key = `svc:${user.id}`;
  const wait = blockedFor(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(wait / 60_000) || 1} minute(s).` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } },
    );
  }

  const result = await redeemServiceCode(user.id, code);
  if (!result.ok) {
    const lock = registerFailure(key, 2_000, 30 * 60_000);
    return NextResponse.json(
      { error: result.error },
      { status: 400, headers: lock > 10_000 ? { "Retry-After": String(Math.ceil(lock / 1000)) } : undefined },
    );
  }
  clearFailures(key);

  return NextResponse.json({ ok: true, expiresAt: result.expiresAt });
}