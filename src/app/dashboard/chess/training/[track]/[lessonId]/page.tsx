import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { prisma } from "@/lib/prisma";
import { TRAINING_TRACKS, getTrainingLesson, isTrainingTrack, lessonsForTrack } from "@/lib/chess/training";
import { chessStarter } from "@/lib/chess/harness";
import { LANGUAGE_LABELS, OFFERED_LANGUAGES, type GameLanguage } from "@/lib/games/types";
import { TrainingPlayer } from "@/components/chess/TrainingPlayer";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ track: string; lessonId: string }> };

export default async function ChessTrainingLessonPage({ params }: Params) {
  const { user } = await requireRole("STUDENT");
  const { track, lessonId } = await params;
  if (!isTrainingTrack(track)) notFound();

  const lesson = getTrainingLesson(track, lessonId);
  if (!lesson) notFound();

  const meta = TRAINING_TRACKS[track];
  const service = await requireActiveService(user.id);

  if (!service.ok) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-5 text-amber-200">
          <Lock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h1 className="text-lg font-bold">{meta.title} is part of an active plan</h1>
            <p className="mt-1 text-sm">
              {service.reason ?? "Enroll to unlock the training grounds."}{" "}
              <Link href="/onboarding" className="font-semibold underline underline-offset-2">
                Get started
              </Link>
            </p>
            <Link href={`/dashboard/chess/training/${track}`} className="mt-3 inline-block text-sm font-medium underline underline-offset-2">
              ← Back to the track
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progress = await prisma.chessTrainingProgress.findUnique({
    where: { userId_track_lessonId: { userId: user.id, track, lessonId: lesson.id } },
    select: { stars: true, bestMoves: true, completed: true, language: true, code: true },
  });

  const lessons = lessonsForTrack(track);
  const idx = lessons.findIndex((l) => l.id === lesson.id);
  const nextLessonId = idx >= 0 && idx + 1 < lessons.length ? lessons[idx + 1].id : null;

  const languages: GameLanguage[] = OFFERED_LANGUAGES;
  const starters: Record<string, string> = {};
  for (const lang of languages) starters[lang] = lesson.starterCode?.[lang as GameLanguage] ?? chessStarter(lang);

  const initialLanguage = progress?.language && OFFERED_LANGUAGES.includes(progress.language as GameLanguage) ? progress.language : "python";
  const savedCode: Record<string, string> = progress?.code ? { [initialLanguage]: progress.code } : {};

  return (
    <TrainingPlayer
      track={track}
      lesson={lesson}
      starters={starters}
      savedCode={savedCode}
      languages={languages}
      languageLabels={LANGUAGE_LABELS}
      initialLanguage={initialLanguage}
      initialStars={progress?.stars ?? 0}
      initialBestMoves={progress?.bestMoves ?? null}
      initialCompleted={progress?.completed ?? false}
      nextLessonId={nextLessonId}
    />
  );
}
