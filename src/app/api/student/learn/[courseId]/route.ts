import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getLearningCourse } from "@/services/learningService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { courseId } = await ctx.params;

  const result = await getLearningCourse(auth.current.user.id, courseId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(
    {
      course: {
        id: result.courseId,
        title: result.title,
        tagline: result.tagline,
        chapter: result.chapter,
        conceptCount: result.conceptCount,
        chapters: result.chapters,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
