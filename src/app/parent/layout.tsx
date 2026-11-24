import { ParentSidebar } from "@/components/parent/ParentSidebar";
import { requireRole } from "@/lib/panels";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requireRole("PARENT");
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row lg:min-h-screen">
      <ParentSidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}