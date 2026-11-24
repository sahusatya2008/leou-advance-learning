import { StudentSidebar } from "@/components/student/StudentSidebar";
import { requireRole } from "@/lib/panels";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireRole("STUDENT");
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row lg:min-h-screen">
      <StudentSidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}