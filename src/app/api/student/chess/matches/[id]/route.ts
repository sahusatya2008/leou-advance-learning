import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { prisma } from "@/lib/prisma";
import { toPublicMatch, participantColor } from "@/lib/chess/matchService";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const { id } = await params;

  const match = await prisma.chessMatch.findFirst({
    where: { id, OR: [{ createdById: user.id }, { whiteId: user.id }, { blackId: user.id }] },
    include: { moves: { orderBy: { ply: "asc" } } },
  });
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

  return NextResponse.json(
    {
      ok: true,
      match: toPublicMatch(match),
      // The seat decides who moves; it is returned here so a friend who claimed
      // a seat through the invite link sees the board flipped correctly.
      myColor: participantColor(match, user.id),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
