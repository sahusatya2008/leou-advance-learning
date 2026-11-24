import Link from "next/link";
import { ArrowRight, Crown, GraduationCap, Handshake, Hourglass, Swords, TriangleAlert } from "lucide-react";
import { requireRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { prisma } from "@/lib/prisma";
import { NewComputerGame } from "@/components/chess/NewComputerGame";
import { NewFriendGame } from "@/components/chess/NewFriendGame";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Rookie",
  medium: "Challenger",
  hard: "Master",
  grandmaster: "Grandmaster",
};

export default async function ChessHubPage() {
  const { user } = await requireRole("STUDENT");

  const [matches, service] = await Promise.all([
    prisma.chessMatch.findMany({
      // Rooms opened here plus rooms the student was invited into.
      where: { OR: [{ createdById: user.id }, { whiteId: user.id }, { blackId: user.id }] },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, mode: true, status: true, difficulty: true, result: true, reason: true, plyCount: true, whiteId: true, blackId: true, updatedAt: true },
    }),
    requireActiveService(user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Swords className="h-3.5 w-3.5 text-accent" />
          Program your moves
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Leou Chess</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Chess, but you write the moves. Each turn your <code className="rounded bg-secondary px-1">move(game)</code> function
          runs in a real sandbox and returns a move like <code className="rounded bg-secondary px-1">&quot;e2e4&quot;</code>.
          Beat the engine in Python, JavaScript or Java — then take on a friend.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <NewComputerGame />
        <NewFriendGame canInvite={service.ok} lockReason={service.ok ? undefined : service.reason} />
      </div>

      <Link
        href="/dashboard/chess/training"
        className="group mt-5 flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-5 transition hover:border-primary/50 hover:bg-card"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-primary text-white">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">Training Grounds</h2>
          <p className="text-sm text-muted-foreground">
            Guided lessons on the board and in code — move real pieces, then teach your program to win.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
          Train <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </Link>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your games</h2>
        {matches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/30 px-4 py-6 text-sm text-muted-foreground">
            No games yet. Start one above.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((m) => {
              const iAmWhite = m.whiteId === user.id;
              const waiting = m.mode === "MULTIPLAYER" && m.status === "ACTIVE" && (m.whiteId == null || m.blackId == null);
              const won = m.status === "FINISHED" && ((m.result === "WHITE" && iAmWhite) || (m.result === "BLACK" && !iAmWhite));
              const lost = m.status === "FINISHED" && !won && m.result !== "DRAW";
              const draw = m.status === "FINISHED" && m.result === "DRAW";
              return (
                <Link
                  key={m.id}
                  href={`/dashboard/chess/${m.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 transition hover:border-primary/50 hover:bg-card"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      won ? "bg-emerald-500/15 text-emerald-400" : lost ? "bg-red-500/15 text-red-400" : draw ? "bg-amber-500/15 text-amber-400" : waiting ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {won ? <Crown className="h-4 w-4" /> : lost ? <TriangleAlert className="h-4 w-4" /> : draw ? <Handshake className="h-4 w-4" /> : waiting ? <Hourglass className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {m.mode === "COMPUTER" ? `${DIFFICULTY_LABEL[m.difficulty ?? "medium"] ?? "Computer"} engine` : "Friend"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">as {iAmWhite ? "White" : "Black"}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {waiting ? "Waiting for a friend to join" : m.status === "ACTIVE" ? `In progress · ${m.plyCount} plies` : (m.reason ?? "Finished")}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
                    {waiting ? "Share link →" : m.status === "ACTIVE" ? "Resume →" : "Review →"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
