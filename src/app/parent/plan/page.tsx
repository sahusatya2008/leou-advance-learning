import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { getStudentPlanSummary } from "@/services/studentPlanService";
import { PlanDetails } from "@/components/student/PlanDetails";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ParentPlanPage() {
  const { user } = await requireRole("PARENT");
  const profile = user.parentProfile;

  const students = profile
    ? await prisma.studentProfile.findMany({
        where: { parentUserId: profile.id },
        include: { user: { select: { id: true, username: true } }, classRoom: { select: { name: true } } },
        orderBy: { fullName: "asc" },
      })
    : [];

  const plans = await Promise.all(
    students.map(async (s) => ({ student: s, plan: await getStudentPlanSummary(s.user.id) })),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Layers className="h-6 w-6 text-primary" /> Plans & services
        </h1>
        <p className="text-sm text-muted-foreground">
          The services chosen for each child, with the itemised quotation, subjects and validity window.
        </p>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No students linked yet. Ask the admin to link your students.
          </CardContent>
        </Card>
      ) : (
        plans.map(({ student, plan }) => (
          <section key={student.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="text-lg font-semibold">{student.fullName}</h2>
                <p className="text-xs text-muted-foreground">
                  @{student.user.username} · {student.classRoom?.name ?? "No class"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {plan?.active ? <Badge variant="success">Active</Badge> : <Badge variant="warning">Not active</Badge>}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/parent/children/${student.user.id}`}>Full details</Link>
                </Button>
              </div>
            </div>
            {plan ? (
              <PlanDetails plan={plan} mode="parent" paymentsHref="/parent/payments" />
            ) : (
              <p className="text-sm text-muted-foreground">No plan information available.</p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
