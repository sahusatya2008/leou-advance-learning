"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Wallet, Activity, Layers, LineChart, Receipt, LogOut } from "lucide-react";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/shell/MobileNav";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/parent", label: "Home", icon: Home, exact: true },
  { href: "/parent/plan", label: "Plans", icon: Layers },
  { href: "/parent/payments", label: "Payments", icon: Wallet },
  { href: "/parent/progress", label: "Progress", icon: LineChart },
  { href: "/parent/fees", label: "Fees", icon: Receipt },
  { href: "/parent/activity", label: "Activity", icon: Activity },
];

export function ParentSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <>
      <MobileNav items={nav} title="Parent" />
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/parent">
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
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>
    </>
  );
}