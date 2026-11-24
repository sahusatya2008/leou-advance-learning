import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/panels";
import { getStudentPractical } from "@/services/practicalService";
import { PracticalWorkspace } from "@/components/student/PracticalWorkspace";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Practical" };

export default async function StudentPracticalPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { user } = await requireRole("STUDENT");
  const { assignmentId } = await params;

  // The same gate the API uses, so an unpublished set or someone else's set
  // renders as a 404 rather than an empty page.
  const result = await getStudentPractical({ userId: user.id, assignmentId });
  if (!result.ok) notFound();

  const p = result.practical;

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/practicals">
            <ArrowLeft className="h-4 w-4" /> All practicals
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{p.title}</h1>
        <p className="text-sm text-muted-foreground">
          {p.subjectName} · {p.topic} · {p.className} · {p.batchName}
        </p>
      </div>

      {p.instructions && (
        <div className="rounded-xl border border-border bg-card/70 p-4 text-sm leading-relaxed">
          {p.instructions}
        </div>
      )}

      <PracticalWorkspace practical={p} />
    </div>
  );
}