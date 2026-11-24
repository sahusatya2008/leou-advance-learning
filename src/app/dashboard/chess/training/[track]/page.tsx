import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Crown, Lock, Star, Swords } from "lucide-react";
import { requireRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { prisma } from "@/lib/prisma";
import { TRAINING_TRACKS, isTrainingTrack, lessonsForTrack, physicalStages, programmingStages, rankForCompleted, rankForProgrammingCompleted } from "@/lib/chess/training";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ track: string }> };

export default async function ChessTrainingTrackPage({ params }: Params) {
  const { user } = await requireRole("STUDENT");
  const { track } = await params;
  if (!isTrainingTrack(track)) notFound();

  const meta = TRAINING_TRACKS[track];
  const lessons = lessonsForTrack(track);
  const service = await requireActiveService(user.id);

  const rows = await prisma.chessTrainingProgress.findMany({
    where: { userId: user.id, track },
    select: { lessonId: true, stars: true, completed: true },
  });
  const byLesson = new Map(rows.map((r) => [r.lessonId, r]));
  const firstIncomplete = lessons.find((l) => !byLesson.get(l.id)?.completed)?.id ?? lessons[lessons.length - 1]?.id;

  // Both tracks group into stages; each carries its own rank ladder.
  const groups = track === "physical" ? physicalStages(lessons) : programmingStages(lessons);
  const completedCount = lessons.filter((l) => byLesson.get(l.id)?.completed).length;
  const rank = track === "physical" ? rankForCompleted(completedCount) : rankForProgrammingCompleted(completedCount);
  const topRankName = track === "physical" ? "Grandmaster" : "Code Grandmaster";

  // Continuous numbering across groups (1..N).
  const numberByLesson = new Map<string, number>();
  let n = 0;
  for (const g of groups) for (const l of g.lessons) numberByLesson.set(l.id, ++n);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/dashboard/chess/training" className="text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
        All tracks
      </Link>
      <header className="mb-6 mt-2">
        <h1 className="text-3xl font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{meta.description}</p>
      </header>

      {rank && (
        <div
          className={cn(
            "mb-6 flex items-center gap-4 rounded-2xl border px-5 py-4",
            rank.name === topRankName
              ? "border-amber-400/60 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-yellow-500/20"
              : "border-border bg-card/60"
          )}
        >
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              rank.name === topRankName ? "bg-amber-400/20 text-amber-300" : "bg-primary/15 text-primary"
            )}
          >
            {rank.name === topRankName ? <Crown className="h-6 w-6" /> : <Swords className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-lg font-bold leading-tight", rank.name === topRankName && "text-amber-200")}>{rank.name}</p>
            <p className="text-xs text-muted-foreground">{rank.blurb}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold">
              {completedCount}/{lessons.length}
            </p>
            <p className="text-[11px] text-muted-foreground">lessons</p>
          </div>
        </div>
      )}

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

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.stage}>
            {groups.length > 1 && (
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {group.stage}
                <span className="h-px flex-1 bg-border" />
              </h2>
            )}
            <ol className="space-y-2.5">
              {group.lessons.map((lesson) => {
                const i = numberByLesson.get(lesson.id) ?? 0;
                const p = byLesson.get(lesson.id);
                const done = p?.completed ?? false;
                const stars = p?.stars ?? 0;
                const isNext = lesson.id === firstIncomplete;
                const inner = (
                  <div
                    className={cn(
                      "flex items-center gap-4 rounded-xl border bg-card/60 p-4 transition",
                      isNext && service.ok ? "border-primary/50 bg-card" : "border-border",
                      service.ok ? "hover:border-primary/40 hover:bg-card" : "opacity-70"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        done ? "bg-emerald-500/15 text-emerald-400" : isNext ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : i}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{lesson.name}</span>
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{lesson.concept}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{lesson.mission}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {[0, 1, 2].map((s) => (
                        <Star key={s} className={cn("h-4 w-4", s < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                      ))}
                    </div>
                    {!service.ok && <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </div>
                );
                return (
                  <li key={lesson.id}>
                    {service.ok ? (
                      <Link href={`/dashboard/chess/training/${track}/${lesson.id}`}>{inner}</Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
