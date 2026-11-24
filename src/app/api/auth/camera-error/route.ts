import { NextResponse } from "next/server";
import { getRequestMeta } from "@/lib/requestMeta";
import { rateLimit } from "@/lib/rateLimit";
import { logActivity } from "@/lib/log";
import { getPreloginIdentity } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Records why a student's camera failed to start.
 *
 * This exists because that failure never reached the server at all: the client
 * rendered an error and stopped, so every `LOGIN_FACE_FAIL` in the activity log
 * meant "we got frames and the face did not match", and the single most common
 * reason students could not sign in was completely invisible. Knowing whether a
 * device reports `permission`, `busy`, `notfound`, `overconstrained` or
 * `insecure` is what makes this fixable rather than guesswork.
 *
 * Rate-limited and schema-free. The user is attached only if the student is
 * still inside the pre-login window, so an anonymous caller cannot pollute a
 * student's log.
 */
export async function POST(req: Request) {
  const meta = getRequestMeta(req);

  const limited = rateLimit(`camerr:${meta.ip}`, {
    limit: 20,
    windowMs: 10 * 60_000,
    blockMs: 60_000,
    maxBlockMs: 5 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const kind = String(body.kind ?? "unknown").slice(0, 32);
  const domException = body.domException ? String(body.domException).slice(0, 64) : null;
  const device = body.device ? String(body.device).slice(0, 120) : null;

  const pre = await getPreloginIdentity().catch(() => null);

  // Best-effort: telemetry must never be the reason a login breaks.
  await logActivity({
    userId: pre?.uid ?? undefined,
    type: "LOGIN_FACE_FAIL",
    metadata: { reason: `camera_${kind}`, distance: null, ...(domException ? { domException } : {}), ...(device ? { device } : {}) },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
