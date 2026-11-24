"use client";

import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import type { PaymentCheckResult } from "@/lib/paymentVerification";

/**
 * Renders the per-field comparison of what was read off a payment screen
 * against the quotation.
 *
 * Shared by the camera scanner and the uploaded-screenshot path because a
 * student choosing either one needs the same answer in the same place, and
 * having one component means the two paths cannot quietly drift apart.
 */
export function PaymentCheckList({ checks }: { checks: PaymentCheckResult }) {
  return (
    <div className="space-y-2">
      <div
        role="status"
        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
          checks.hasMismatch
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-primary/30 bg-primary/5"
        }`}
      >
        {checks.hasMismatch ? (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <span>{checks.summary}</span>
      </div>
      <ul className="space-y-1.5">
        {checks.checks.map((c) => {
          const Icon = c.state === "match" ? CheckCircle2 : c.state === "mismatch" ? XCircle : CircleHelp;
          const tone =
            c.state === "match"
              ? "text-emerald-600"
              : c.state === "mismatch"
                ? "text-destructive"
                : "text-muted-foreground";
          return (
            <li key={c.field} className="flex items-start gap-2 text-xs">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
              <span className="space-y-0.5">
                <span className="font-medium text-foreground">{c.label}</span>
                {c.found && (
                  <span className="text-muted-foreground">
                    {" "}
                    — read <span className="font-mono">{c.found}</span>
                    {c.expected ? ` (quotation: ${c.expected})` : ""}
                  </span>
                )}
                <span className="block text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
