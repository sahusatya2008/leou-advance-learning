import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireRole } from "@/lib/panels";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row lg:min-h-screen">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}