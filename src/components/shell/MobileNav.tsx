"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

/**
 * Navigation for small screens.
 *
 * The sidebars are `hidden` below `lg`, so on a phone the platform had no way
 * to reach any page other than the one already open. This is that way: a
 * top bar with a menu button that reveals the full nav, closing on navigation.
 *
 * It exists only below `lg`. The desktop sidebar is untouched.
 */
export function MobileNav({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // If the route changes for any reason other than tapping a link (back button,
  // a redirect), the drawer must not stay open over the new page. Render-phase
  // adjustment rather than an effect, so the close is committed with the route
  // change instead of painting one frame with the drawer still open.
  const [lastPath, setLastPath] = React.useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  // Escape closes it, and the page behind must not scroll while it is open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  return (
    <>
      {/* Top bar: only on small screens, where the sidebar is not rendered. */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/80 px-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary"
        >
          <MenuIcon />
        </button>
        <span className="truncate text-sm font-semibold">{title}</span>
        <Link href={items[0]?.href ?? "/"} aria-label="Go to home" className="flex h-11 w-11 items-center justify-center">
          <Brand showText={false} />
        </Link>
      </div>

      {/* Drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col border-r border-border bg-card shadow-2xl",
              "safe-top safe-bottom"
            )}
          >
            <div className="flex h-14 items-center justify-between border-b border-border px-3">
              <Link href="/" onClick={() => setOpen(false)}>
                <Brand />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
