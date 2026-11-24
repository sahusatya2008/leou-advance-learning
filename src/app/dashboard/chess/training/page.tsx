import Link from "next/link";
import { ArrowRight, Crown, GraduationCap, Lock, Puzzle, Star } from "lucide-react";
import { requireRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { prisma } from "@/lib/prisma";
import { TRAINING_TRACKS, TRAINING_TRACK_IDS, lessonsForTrack, rankForCompleted, rankForProgrammingCompleted } from "@/lib/chess/training";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChessTrainingHubPage() {
  const { user } = await requireRole("STUDENT");
  const service = await requireActiveService(user.id);

  const progress = await prisma.chessTrainingProgress.findMany({
    where: { userId: user.id },
    select: { track: true, stars: true, completed: true },
  });

  const byTrack = new Map<string, { done: number; stars: number; maxStars: number }>();
  for (const id of TRAINING_TRACK_IDS) {
    const lessons = lessonsForTrack(id);
    byTrack.set(id, { done: 0, stars: 0, maxStars: lessons.length * 3 });
  }
  for (const p of progress) {
    const agg = byTrack.get(p.track);
    if (!agg) continue;
    if (p.completed) agg.done += 1;
    agg.stars += p.stars;
  }

  const physicalAgg = byTrack.get("physical")!;
  const physicalRank = rankForCompleted(physicalAgg.done);
  const programmingAgg = byTrack.get("programming")!;
  const programmingRank = rankForProgrammingCompleted(programmingAgg.done);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 text-accent" />
          Chess Training
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Training Grounds</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Two guided tracks that take you from moving a single piece to teaching your program to win.
          Solve a lesson to earn up to three stars — solve it in fewer moves to keep all three.
        </p>
      </header>

      {!service.ok && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {service.reason ?? "Training is part of an active plan."}{" "}
            <Link href="/onboarding" className="font-semibold underline underline-offset-2">
              Get started
            </Link>
          </span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {TRAINING_TRACK_IDS.map((id) => {
          const meta = TRAINING_TRACKS[id];
          const lessons = lessonsForTrack(id);
          const agg = byTrack.get(id)!;
          const pct = agg.maxStars ? Math.round((agg.stars / agg.maxStars) * 100) : 0;
          const card = (
            <div
              className={cn(
                "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/60 p-5 transition",
                service.ok ? "hover:border-primary/50 hover:bg-card" : "opacity-70"
              )}
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl"
                style={{ background: `linear-gradient(135deg, ${meta.accent[0]}, ${meta.accent[1]})` }}
              />
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: `linear-gradient(135deg, ${meta.accent[0]}, ${meta.accent[1]})` }}>
                  {id === "physical" ? <Puzzle className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                </span>
                <div>
                  <h2 className="text-lg font-bold leading-tight">{meta.title}</h2>
                  <p className="text-xs text-muted-foreground">{meta.tagline}</p>
                </div>
                {!service.ok && <Lock className="ml-auto h-4 w-4 text-muted-foreground" />}
              </div>
              {id === "physical" && (
                <div
                  className={cn(
                    "mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    physicalRank.name === "Grandmaster"
                      ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <Crown className={cn("h-3 w-3", physicalRank.name === "Grandmaster" ? "text-amber-300" : "text-accent")} />
                  {physicalRank.name}
                </div>
              )}
              {id === "programming" && (
                <div
                  className={cn(
                    "mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    programmingRank.name === "Code Grandmaster"
                      ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <Crown className={cn("h-3 w-3", programmingRank.name === "Code Grandmaster" ? "text-amber-300" : "text-accent")} />
                  {programmingRank.name}
                </div>
              )}
              <p className="mb-4 flex-1 text-sm text-muted-foreground">{meta.description}</p>
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {agg.done}/{lessons.length} lessons
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {agg.stars}/{agg.maxStars}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {service.ok && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  {agg.done === 0 ? "Start track" : "Continue"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              )}
            </div>
          );
          return service.ok ? (
            <Link key={id} href={`/dashboard/chess/training/${id}`} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={id}>{card}</div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/dashboard/chess" className="font-medium text-foreground underline underline-offset-2 hover:text-primary">
          ← Back to Leou Chess
        </Link>
      </p>
    </div>
  );
}
