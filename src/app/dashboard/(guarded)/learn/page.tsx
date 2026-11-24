import Link from "next/link";
import { ArrowRight, Box, FlaskConical, LockKeyhole, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/panels";
import { getLearningCatalogue, type LearningChapter } from "@/services/learningService";

export const dynamic = "force-dynamic";

export const metadata = { title: "Courses" };

function CourseCard({ chapter }: { chapter: LearningChapter }) {
  const locked = !chapter.available;
  const isChem = chapter.kind === "goc" || chapter.kind === "halo";
  const Icon = chapter.kind === "goc" ? FlaskConical : locked ? LockKeyhole : Sparkles;
  const badge = chapter.free
    ? "Free for all"
    : locked
      ? "Locked"
      : "Available now";
  const badgeClass = chapter.free
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : locked
      ? "border-border bg-secondary/60 text-muted-foreground"
      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";

  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${chapter.free || !locked ? (isChem ? "bg-emerald-400/15 text-emerald-300" : "bg-cyan-400/15 text-cyan-300") : "bg-secondary text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${badgeClass}`}>{badge}</span>
      </div>
      <h2 className={`mt-4 text-base font-semibold leading-snug ${locked ? "text-foreground/80" : ""}`}>{chapter.name}</h2>
      <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
        {chapter.description ?? (locked ? "This chapter is in your plan. Its 3D course is being built — check back soon." : "Interactive 3D lessons — learn by doing.")}
      </p>
      {locked && chapter.lockedReason && (
        <p className="mt-2 text-[11px] leading-5 text-amber-300/80">{chapter.lockedReason}</p>
      )}
      {!locked && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300">
          Start learning <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      )}
    </>
  );

  if (locked) {
    return (
      <div key={chapter.id} className="relative overflow-hidden rounded-2xl border border-border bg-card/50 p-5 opacity-90">
        {body}
      </div>
    );
  }
  return (
    <Link
      key={chapter.id}
      href={`/dashboard/learn/${chapter.id}`}
      className={`group relative overflow-hidden rounded-2xl border p-5 transition hover:shadow-[0_0_30px_rgba(34,211,238,0.12)] ${isChem ? "border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-card to-cyan-400/5 hover:border-emerald-400/60" : "border-cyan-400/30 bg-gradient-to-br from-indigo-500/10 via-card to-cyan-400/5 hover:border-cyan-400/60"}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl" />
      {body}
    </Link>
  );
}

export default async function LearnHubPage() {
  const { user } = await requireRole("STUDENT");
  // Never fails: even a student who has availed nothing sees the free GOC course.
  const catalogue = await getLearningCatalogue(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Box className="h-6 w-6 text-cyan-300" />
          Courses
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300">
            3D Learning
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your chapters, brought to life. Turn models with your mouse and learn by doing —
          nothing here is graded. General Organic Chemistry is free for everyone.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalogue.chapters.map((chapter) => <CourseCard key={chapter.id} chapter={chapter} />)}
      </div>

      {catalogue.chapters.length === 0 && (
        <p className="rounded-2xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No courses are listed for you yet.
        </p>
      )}
    </div>
  );
}
