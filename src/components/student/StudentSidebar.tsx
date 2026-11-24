"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Layers,
  FlaskConical,
  Box,
  Code2,
  BarChart3,
  FileText,
  Activity,
  Wallet,
  ShieldCheck,
  Sparkles,
  IdCard,
  LogOut,
  Gamepad2,
  Swords,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/shell/MobileNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/onboarding", label: "My Plan", icon: ShieldCheck },
  { href: "/dashboard/plan", label: "Facilities", icon: Sparkles },
  { href: "/dashboard/classes", label: "My Classes", icon: Layers },
  { href: "/dashboard/tests", label: "Tests", icon: FlaskConical },
  { href: "/dashboard/practicals", label: "Practicals", icon: Code2 },
  { href: "/dashboard/learn", label: "Courses", icon: Box },
  { href: "/dashboard/games", label: "Code Games", icon: Gamepad2 },
  { href: "/dashboard/chess", label: "Leou Chess", icon: Swords },
  { href: "/dashboard/results", label: "Results", icon: BarChart3 },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
  { href: "/dashboard/payments", label: "Payments", icon: Wallet },
  { href: "/dashboard/profile", label: "Profile", icon: IdCard },
];

export function StudentSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <>
      {/* Small screens get a top bar + drawer; the sidebar below is desktop-only. */}
      <MobileNav items={nav} title="My account" />
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/dashboard">
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
