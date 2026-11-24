import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/panels";
import { prisma } from "@/lib/prisma";
import { toPublicMatch, participantColor } from "@/lib/chess/matchService";
import { chessStarter } from "@/lib/chess/harness";
import { LANGUAGE_LABELS, OFFERED_LANGUAGES } from "@/lib/games/types";
import { ChessMatchClient } from "@/components/chess/ChessMatchClient";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ matchId: string }> };

export default async function ChessMatchPage({ params }: Params) {
  const { user } = await requireRole("STUDENT");
  const { matchId } = await params;

  // Visible to whoever sits in either seat, so a friend who claimed a seat
  // through the invite link can open the same board.
  const match = await prisma.chessMatch.findFirst({
    where: { id: matchId, OR: [{ createdById: user.id }, { whiteId: user.id }, { blackId: user.id }] },
    include: { moves: { orderBy: { ply: "asc" } } },
  });
  if (!match) notFound();

  const myColor = participantColor(match, user.id);
  if (!myColor) notFound();

  // The invite link must be absolute for a friend to paste elsewhere, so build
  // it from the host this request arrived on.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const local = host.startsWith("localhost") || host.startsWith("127.");
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  const inviteUrl = match.inviteToken && host ? `${proto}://${host}/chess/join/${match.inviteToken}` : "";

  const starters: Record<string, string> = {};
  for (const lang of OFFERED_LANGUAGES) starters[lang] = chessStarter(lang);

  return (
    <ChessMatchClient
      match={toPublicMatch(match)}
      starters={starters}
      languages={OFFERED_LANGUAGES}
      languageLabels={LANGUAGE_LABELS}
      myColor={myColor}
      inviteUrl={inviteUrl}
    />
  );
}
