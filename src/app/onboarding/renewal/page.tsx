import { redirect } from "next/navigation";
import type { ComponentProps } from "react";
import { getActiveServices } from "@/services/onboardingService";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { OnboardingWizard } from "@/components/student/OnboardingWizard";

export const dynamic = "force-dynamic";

type RenewalTarget = NonNullable<ComponentProps<typeof OnboardingWizard>["renewalTarget"]>;

/**
 * Renews the current plan into next month, letting the student add or drop
 * subjects, chapters and tutoring before paying. With ?activationId= it renews
 * ONLY that subscription (fewer subjects can leave several windows running), and
 * that old window is ended the moment the renewal payment is approved.
 */
export default async function RenewalPage({
  searchParams,
}: {
  searchParams: Promise<{ activationId?: string }>;
}) {
  const { user } = await requireRole("STUDENT");
  const { activationId } = await searchParams;
  const active = await getActiveServices(user.id);

  // Nothing to edit without a plan on file; the first-purchase flow covers the rest.
  if (!active) redirect("/onboarding");

  // A subset renewal: pre-fill the wizard from the named live subscription only
  // (it must belong to this student and still be running), so the diff and the
  // take-over are scoped to exactly that window.
  let renewalTarget: RenewalTarget | null = null;
  if (activationId) {
    const activation = await prisma.serviceActivation.findUnique({
      where: { id: activationId },
      include: { request: true },
    });
    if (activation && activation.userId === user.id && activation.expiresAt.getTime() > new Date().getTime() && activation.request) {
      const r = activation.request;
      const subjectTopics = r.subjectTopics as Record<
        string,
        { assignment?: string | string[]; mock?: string | string[]; test?: string | string[] }
      > | null;
      renewalTarget = {
        activationId: activation.id,
        boardId: r.boardId ?? undefined,
        classRoomId: r.classRoomId ?? undefined,
        subjectIds: (r.subjects as unknown as string[]) ?? [],
        wantAssignments: r.wantAssignments,
        wantMockTests: r.wantMockTests,
        wantRealTests: r.wantRealTests,
        sameTopicsForMockTests: r.sameTopicsForMockTests,
        wantTutoring: r.wantTutoring,
        tutorSubjects: (r.tutorSubjects as unknown as string[]) ?? [],
        tutorGoals: r.tutorGoals,
        tutorPlan: r.tutorPlan as string | null,
        tutorHours: r.tutorHours,
        subjectTopics,
        assignmentTopics: r.assignmentTopics,
        mockTopics: r.mockTopics,
        testTopics: r.testTopics,
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {renewalTarget ? "Renew one subscription" : "Renew your plan"}
        </h1>
        <p className="text-muted-foreground">
          {renewalTarget
            ? "Only this subscription's subjects are being renewed. Add what you need, remove what you no longer do, and you will be charged for its next month at today's rates. Your other subscriptions stay exactly as they are."
            : "Your current plan is loaded below. Add what you need, remove what you no longer do, and you will be charged for the next month at today's rates."}
        </p>
      </div>
      <OnboardingWizard mode="renewal" renewalTarget={renewalTarget} />
    </div>
  );
}