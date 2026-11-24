import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { prisma } from "@/lib/prisma";
import { isOfferedLanguage } from "@/lib/games/types";
import { getTrainingLesson, isTrainingTrack } from "@/lib/chess/training";

export const runtime = "nodejs";

const MAX_SAVED_CODE = 20_000;

/**
 * Persist the programming-lesson editor draft so a student resumes where they
 * left off. Deliberately cannot touch `stars`, `completed` or `bestMoves` — those
 * are only ever written by the run route after a real judged attempt.
 */
export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  let body: { track?: string; lessonId?: string; language?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const track = String(body.track ?? "");
  if (!isTrainingTrack(track)) return NextResponse.json({ error: "Unknown training track." }, { status: 400 });

  const lesson = getTrainingLesson(track, String(body.lessonId ?? ""));
  if (!lesson) return NextResponse.json({ error: "Unknown lesson." }, { status: 400 });

  const language = String(body.language ?? "python");
  if (!isOfferedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const code = typeof body.code === "string" ? body.code.slice(0, MAX_SAVED_CODE) : "";

  await prisma.chessTrainingProgress.upsert({
    where: { userId_track_lessonId: { userId: user.id, track, lessonId: lesson.id } },
    create: { userId: user.id, track, lessonId: lesson.id, language, code },
    update: { language, code },
  });

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
