import { requireRole } from "@/lib/panels";
import { getStudentPlanSummary } from "@/services/studentPlanService";
import { PlanDetails } from "@/components/student/PlanDetails";

export const dynamic = "force-dynamic";

export default async function StudentPlanPage() {
  const { user } = await requireRole("STUDENT");
  const plan = await getStudentPlanSummary(user.id);

  if (!plan) {
    return <p className="text-sm text-muted-foreground">No plan information available.</p>;
  }

  return <PlanDetails plan={plan} mode="student" paymentsHref="/dashboard/payments" />;
}
