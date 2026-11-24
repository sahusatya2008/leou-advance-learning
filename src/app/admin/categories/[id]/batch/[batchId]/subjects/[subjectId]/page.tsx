import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import SubjectPricingForm from "@/components/admin/classes/SubjectPricingForm";

export const dynamic = "force-dynamic";

export default async function SubjectPricingPage({
  params,
}: {
  params: Promise<{ id: string; batchId: string; subjectId: string }>;
}) {
  await requireRole("ADMIN");
  const { id: classId, batchId, subjectId } = await params;

  const batch = await prisma.batch.findUnique({ where: { id: batchId }, include: { classRoom: true } });
  if (!batch || batch.classRoomId !== classId) notFound();

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) notFound();

  const inBatch = await prisma.batchSubject.findUnique({
    where: { batchId_subjectId: { batchId, subjectId } },
  });
  if (!inBatch) notFound();

  const [items, tutoring] = await Promise.all([
    prisma.subjectPricingItem.findMany({ where: { batchId, subjectId }, orderBy: { name: "asc" } }),
    prisma.tutoringRate.findUnique({ where: { batchId_subjectId: { batchId, subjectId } } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/categories/${classId}/batch/${batchId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
            <Badge variant="outline">{batch.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Pricing for {batch.classRoom.name} · {subject.name}
          </p>
        </div>
      </div>

      <SubjectPricingForm
        subjectName={subject.name}
        initialItems={items.map((i) => ({
          id: i.id,
          name: i.name,
          assignmentRate: Number(i.assignmentRate),
          mockRate: Number(i.mockRate),
          testRate: Number(i.testRate),
        }))}
        initialTutoring={
          tutoring
            ? {
                hourlyRate: tutoring.hourlyRate != null ? Number(tutoring.hourlyRate) : null,
                weeklyClasses: tutoring.weeklyClasses,
                weeklyRate: tutoring.weeklyRate != null ? Number(tutoring.weeklyRate) : null,
                monthlyDaysPerWeek: tutoring.monthlyDaysPerWeek,
                monthlyRate: tutoring.monthlyRate != null ? Number(tutoring.monthlyRate) : null,
              }
            : null
        }
      />
    </div>
  );
}