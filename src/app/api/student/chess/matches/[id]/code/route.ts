import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { prisma } from "@/lib/prisma";
import { isOfferedLanguage, type GameLanguage } from "@/lib/games/types";

export const runtime = "nodejs";

const MAX_SAVED_CODE = 20_000;

type Params = { params: Promise<{ id: string }> };

/** Save the strategy currently open in the editor, so a visit resumes exactly. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const { id } = await params;

  let body: { code?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.slice(0, MAX_SAVED_CODE) : "";
  const language = String(body.language ?? "python");
  if (!isOfferedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const match = await prisma.chessMatch.findFirst({
    where: { id, OR: [{ createdById: user.id }, { whiteId: user.id }, { blackId: user.id }] },
    select: { id: true, whiteId: true, blackId: true, status: true },
  });
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.status !== "ACTIVE") return NextResponse.json({ ok: true });
  if (match.whiteId !== user.id && match.blackId !== user.id)
    return NextResponse.json({ error: "Match not found." }, { status: 404 });

  // The draft follows the seat, so each player's editor saves separately.
  const iAmWhite = match.whiteId === user.id;

  await prisma.chessMatch.update({
    where: { id },
    data: { [iAmWhite ? "whiteCode" : "blackCode"]: code, language: language as GameLanguage },
  });

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
