import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Terminal } from "lucide-react";
import PracticalActivity from "@/components/admin/students/PracticalActivity";

export const dynamic = "force-dynamic";

/** Read-only audit of one student's practical work: attempts, per-question
 * detail, terminal transcripts and doubt threads. */
export default async function StudentPracticalActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await prisma.user.findUnique({
    where: { id },
    select: { username: true, studentProfile: { select: { fullName: true } } },
  });
  if (!student?.studentProfile) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/students/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
            <Terminal className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Practical activity</h1>
            <p className="text-sm text-muted-foreground">
              {student.studentProfile.fullName} · @{student.username}
            </p>
          </div>
        </div>
      </div>
      <PracticalActivity studentUserId={id} />
    </div>
  );
}
