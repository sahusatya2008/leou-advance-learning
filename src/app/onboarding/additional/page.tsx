import { redirect } from "next/navigation";
import { getActiveServices } from "@/services/onboardingService";
import { requireRole } from "@/lib/panels";
import { OnboardingWizard } from "@/components/student/OnboardingWizard";

export const dynamic = "force-dynamic";

/** Lets a student on an active plan add subjects, chapters or tutoring to it. */
export default async function AdditionalServicesPage() {
  const { user } = await requireRole("STUDENT");
  const active = await getActiveServices(user.id);

  // Nothing to add to without a running plan; the wizard's first flow handles
  // a first purchase, and guessing here would strand the student.
  if (!active) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Add more services</h1>
        <p className="text-muted-foreground">
          Everything you already pay for is ticked below. Add to it, and you will only
          be charged for what is new.
        </p>
      </div>
      <OnboardingWizard mode="additional" />
    </div>
  );
}
