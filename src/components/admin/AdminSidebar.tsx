"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Layers,
  BookMarked,
  Database,
  ClipboardList,
  FlaskConical,
  ClipboardCheck,
  Wallet,
  HeartHandshake,
  Activity,
  UserPlus,
  GraduationCap,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/shell/MobileNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/students", label: "Student Management", icon: Users },
  { href: "/admin/students/new", label: "Newly Registered", icon: UserPlus },
  {
    href: "/admin/students/learning",
    label: "Learning Requests",
    icon: GraduationCap,
  },
  { href: "/admin/categories", label: "Category Management", icon: Layers },
  { href: "/admin/subjects", label: "Subject Management", icon: BookMarked },
  { href: "/admin/questions", label: "Question Bank", icon: Database },
  { href: "/admin/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/admin/practical", label: "Practicals", icon: FlaskConical },
  { href: "/admin/practical/doubts", label: "Practical Doubts", icon: HelpCircle },
  { href: "/admin/evaluation", label: "Evaluation", icon: ClipboardCheck },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
  { href: "/admin/parents", label: "Parents", icon: HeartHandshake },
  { href: "/admin/traffic", label: "Traffic Manager", icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <>
      {/* Small screens get a top bar + drawer; the sidebar below is desktop-only. */}
      <MobileNav items={nav} title="Admin" />
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/admin">
            <Brand />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}
