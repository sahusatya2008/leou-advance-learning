import Link from "next/link";
import { ArrowRight, Code2, Gamepad2, Lock, Sparkles, Star, Swords, Trophy } from "lucide-react";
import { requireRole } from "@/lib/panels";
import { prisma } from "@/lib/prisma";
import { GAMES } from "@/lib/games/catalog";
import { CONCEPT_LABELS } from "@/lib/games/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const { user } = await requireRole("STUDENT");

  const rows = await prisma.gameProgress.findMany({
    where: { userId: user.id },
    select: { gameId: true, levelId: true, stars: true, completed: true },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Gamepad2 className="h-3.5 w-3.5 text-primary" />
          Learn by playing
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Code Games</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Write real code — not drag-and-drop — to solve puzzles. Five cabinets and over a hundred levels:
          steer a robot out of neon labs, escape generated mazes, paint with a turtle, sharpen your
          problem-solving in the dojo, and out-sort the machine in the arena. Pick Python, JavaScript or Java.
        </p>
      </header>

      <div className="grid gap-6">
        {GAMES.map((game) => {
          const gameRows = rows.filter((r) => r.gameId === game.id);
          const completed = gameRows.filter((r) => r.completed).length;
          const stars = gameRows.reduce((n, r) => n + r.stars, 0);
          const maxStars = game.levels.length * 3;
          const pct = Math.round((completed / game.levels.length) * 100);
          const firstIncomplete = game.levels.find((l) => !gameRows.some((r) => r.levelId === l.id && r.completed));
          const target = firstIncomplete ?? game.levels[game.levels.length - 1];

          return (
            <div
              key={game.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 shadow-xl shadow-black/20"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{ background: `radial-gradient(120% 140% at 100% 0%, ${game.accent[1]}55, transparent 55%), radial-gradient(120% 140% at 0% 100%, ${game.accent[0]}66, transparent 55%)` }}
              />
              <div className="relative grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5" style={{ color: game.accent[1] }} />
                    <h2 className="text-xl font-bold tracking-tight">{game.title}</h2>
                  </div>
                  <p className="mt-1 text-sm font-medium" style={{ color: game.accent[1] }}>
                    {game.tagline}
                  </p>
                  <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{game.description}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <Stat icon={<Trophy className="h-4 w-4 text-primary" />} label="Labs done" value={`${completed}/${game.levels.length}`} />
                    <Stat icon={<Star className="h-4 w-4 fill-amber-400 text-amber-400" />} label="Stars" value={`${stars}/${maxStars}`} />
                    <Stat icon={<Code2 className="h-4 w-4 text-accent" />} label="Languages" value="Python · JS · Java" />
                  </div>

                  <div className="mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${game.accent[0]}, ${game.accent[1]})` }}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-3 sm:w-56">
                  <GamePreview accent={game.accent} />
                  <Link
                    href={`/dashboard/games/${game.id}?level=${target.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                  >
                    {completed > 0 ? "Continue" : "Start playing"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="relative flex flex-wrap gap-2 border-t border-border/60 px-6 py-4">
                {Array.from(new Set(game.levels.map((l) => l.concept))).map((c) => (
                  <span key={c} className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                    {CONCEPT_LABELS[c]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        <Link
          href="/dashboard/chess"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 shadow-xl shadow-black/20"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{ background: "radial-gradient(120% 140% at 100% 0%, #22d3ee55, transparent 55%), radial-gradient(120% 140% at 0% 100%, #6366f166, transparent 55%)" }}
          />
          <div className="relative grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-accent" />
                <h2 className="text-xl font-bold tracking-tight">Leou Chess</h2>
                <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">New</span>
              </div>
              <p className="mt-1 text-sm font-medium text-accent">You write the moves</p>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Chess where every turn is a program. Your <span className="font-mono text-foreground">move(game)</span> function
                runs in a sandbox and returns a move like <span className="font-mono text-foreground">&quot;e2e4&quot;</span>. Beat the
                engine in Python, JavaScript or Java — then challenge a friend.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Stat icon={<Swords className="h-4 w-4 text-accent" />} label="Opponents" value="Engine + friends" />
                <Stat icon={<Code2 className="h-4 w-4 text-primary" />} label="Languages" value="Python · JS · Java" />
                <Stat icon={<Trophy className="h-4 w-4 text-primary" />} label="Cost" value="Free to play" />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:w-56">
              <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-background/70 text-5xl">
                <span className="text-[#0b1220] [text-shadow:0_1px_2px_rgba(0,0,0,.35)]">{"\u265A"}</span>
              </div>
              <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition group-hover:brightness-110">
                Play chess
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>

        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            One engine, many worlds
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Every cabinet runs the same way: you write a <span className="font-mono text-foreground">solve()</span> function,
            it runs in a real sandbox, and the app replays the result to animate and score it. New worlds drop in
            without changing how your code runs.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground/70">
            <Lock className="h-3.5 w-3.5" /> More cabinets coming soon
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="leading-tight">
        <div className="text-sm font-semibold">{value}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/** A small decorative grid with a bot and portal — pure CSS, no assets. */
function GamePreview({ accent }: { accent: [string, string] }) {
  const cells = Array.from({ length: 36 });
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/70 p-3">
      <div className="grid grid-cols-6 gap-1">
        {cells.map((_, i) => {
          const isBot = i === 7;
          const isGoal = i === 33;
          const isWall = i === 14 || i === 15 || i === 20;
          return (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-[3px]",
                isWall ? "bg-secondary" : "bg-secondary/40"
              )}
              style={
                isBot
                  ? { background: accent[1], boxShadow: `0 0 10px ${accent[1]}` }
                  : isGoal
                    ? { background: accent[0], boxShadow: `0 0 10px ${accent[0]}` }
                    : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
