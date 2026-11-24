import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { requireRole } from "@/lib/panels";
import { getLearningCourse } from "@/services/learningService";
import { EncodingCoursePlayer } from "@/components/learning/EncodingCoursePlayer";
import { ChemistryCoursePlayer } from "@/components/learning/ChemistryCoursePlayer";
import { COURSE_ID } from "@/lib/learning3d/encodingCourse";
import { GOC_COURSE_ID } from "@/lib/learning3d/chemCourse";
import { HALO_COURSE_ID } from "@/lib/learning3d/haloCourse";

export const dynamic = "force-dynamic";

export const metadata = { title: "3D Course" };

export default async function LearnCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { user } = await requireRole("STUDENT");
  const { courseId } = await params;
  const result = await getLearningCourse(user.id, courseId);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-border bg-card">
          <LockKeyhole className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Course unavailable</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">{result.error}</p>
        <Link href="/dashboard/learn" className="mt-6 inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Courses
        </Link>
      </div>
    );
  }

  if (courseId === GOC_COURSE_ID) return <ChemistryCoursePlayer courseId={GOC_COURSE_ID} />;
  if (courseId === HALO_COURSE_ID) return <ChemistryCoursePlayer courseId={HALO_COURSE_ID} />;
  if (courseId === COURSE_ID) return <EncodingCoursePlayer />;
  return null;
}
