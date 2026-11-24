import { requireRole } from "@/lib/panels";
import { OnboardingWizard } from "@/components/student/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireRole("STUDENT");
  return <OnboardingWizard />;
}