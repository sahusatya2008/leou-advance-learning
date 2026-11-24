import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { rateLimit } from "@/lib/rateLimit";
import { isOfferedLanguage, type GameLanguage } from "@/lib/games/types";
import { submitHumanMove } from "@/lib/chess/matchService";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  // Playing the computer is free for any signed-in student, so there is no
  // enrollment gate here — only the shared sandbox budget below.
  const profId = user.studentProfile?.id ?? user.id;

  // Each turn spends a sandbox container, so it shares the code-exec budget.
  const limit = rateLimit(`chess-move:${profId}`, { limit: 20, windowMs: 10_000, blockMs: 15_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Easy there — too many moves at once. Try again in ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const { id } = await params;

  let body: { code?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const language = String(body.language ?? "python");
  if (!isOfferedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) return NextResponse.json({ error: "Write some code first." }, { status: 400 });

  const result = await submitHumanMove(user.id, id, code, language as GameLanguage);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, illegal: result.illegal, stdout: result.stdout.slice(0, 4000), stderr: result.stderr.slice(0, 4000) },
      { status: result.illegal ? 422 : 400, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      match: result.match,
      humanMove: result.humanMove,
      aiMove: result.aiMove,
      stdout: result.stdout.slice(0, 4000),
      stderr: result.stderr.slice(0, 4000),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
