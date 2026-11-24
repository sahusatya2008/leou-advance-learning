"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export type TabKey = "REGISTRATION" | "RENEWAL" | "ADDITIONAL_SERVICE";

/**
 * The three payment queues. Kept as links with a query param rather than state
 * so a queue can be bookmarked, shared, and reloaded without losing your place -
 * the admin often leaves a tab open to check a UPI statement and comes back.
 */
export function PaymentQueueTabs({
  active,
  tabs,
}: {
  active: TabKey;
  tabs: { key: TabKey; label: string; count: number }[];
}) {
  return (
    <Suspense fallback={<div className="h-10" />}>
      <Inner active={active} tabs={tabs} />
    </Suspense>
  );
}

function Inner({
  active,
  tabs,
}: {
  active: TabKey;
  tabs: { key: TabKey; label: string; count: number }[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {tabs.map((t) => {
        const q = new URLSearchParams(params.toString());
        q.set("tab", t.key);
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`${pathname}?${q.toString()}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                  isActive ? "bg-white/20" : "bg-background"
                }`}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
