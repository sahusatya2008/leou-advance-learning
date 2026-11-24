import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake, Link2, Users } from "lucide-react";
import CreateParentDialog from "@/components/admin/parents/CreateParentDialog";
import ParentCard from "@/components/admin/parents/ParentCard";

export const dynamic = "force-dynamic";

export default async function ParentsPage() {
  const parents = await prisma.user.findMany({
    where: { role: "PARENT" },
    orderBy: { createdAt: "desc" },
    include: {
      parentProfile: {
        include: {
          students: {
            include: {
              user: { select: { id: true, username: true, status: true } },
              classRoom: { select: { name: true } },
            },
            orderBy: { fullName: "asc" },
          },
        },
      },
    },
  });

  const linkedStudents = parents.reduce((n, p) => n + (p.parentProfile?.students.length ?? 0), 0);
  const suspended = parents.filter((p) => p.status !== "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <HeartHandshake className="h-6 w-6 text-primary" /> Parents
          </h1>
          <p className="text-sm text-muted-foreground">
            Parent accounts see their linked students&apos; fees, results and activity — nothing else.
          </p>
        </div>
        <CreateParentDialog />
      </div>

      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="px-3 py-1.5 text-sm">
          <Users className="mr-1.5 h-3.5 w-3.5" /> {parents.length} parent{parents.length === 1 ? "" : "s"}
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 text-sm">
          <Link2 className="mr-1.5 h-3.5 w-3.5" /> {linkedStudents} linked student{linkedStudents === 1 ? "" : "s"}
        </Badge>
        {suspended > 0 && (
          <Badge variant="warning" className="px-3 py-1.5 text-sm">
            {suspended} not active
          </Badge>
        )}
      </div>

      {parents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No parent accounts yet. Create one and link their students.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {parents.map((p) => (
            <ParentCard key={p.id} parent={p} />
          ))}
        </div>
      )}
    </div>
  );
}
