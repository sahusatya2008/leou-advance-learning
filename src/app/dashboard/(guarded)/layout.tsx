import { redirect } from "next/navigation";
import { requireRole } from "@/lib/panels";
import { getServiceState } from "@/services/onboardingService";

/**
 * Brand-new self-registered students get locked to the onboarding flow until
 * they submit a service request and redeem the admin's 15-digit code.
 *
 * This applies to every dashboard page *except* payments. A student with an
 * unpaid quotation is exactly the person who needs /dashboard/payments, so
 * guarding it sent them back to the wizard and left the money unpayable.
 */
export default async function GuardedLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("STUDENT");

  const service = await getServiceState(user.id);
  if (service?.harderRedirect) redirect("/onboarding");

  return children;
}
