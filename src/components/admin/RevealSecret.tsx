"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shows a provisioned password on demand. The value is fetched from the admin
 * secret endpoint only when the administrator asks for it, so it never rides
 * along in a page payload (e.g. a long parents list) by default.
 */
export function RevealSecret({
  userId,
  className,
  endpoint = "/api/admin/secret",
}: {
  userId: string;
  className?: string;
  endpoint?: string;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "missing">("idle");
  const [copied, setCopied] = useState(false);

  async function load() {
    if (state === "ready") {
      setState("idle"); // hide again
      return;
    }
    setState("loading");
    const res = await fetch(`${endpoint}?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
    if (!res.ok) {
      setState("missing");
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { password?: string | null };
    if (!data.password) {
      setValue(null);
      setState("missing");
      return;
    }
    setValue(data.password);
    setState("ready");
  }

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the value is visible anyway */
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <code className="min-w-[8rem] rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-xs">
        {state === "ready" && value ? value : state === "missing" ? "not recorded" : "••••••••"}
      </code>
      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={load}>
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === "ready" ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        {state === "ready" ? "Hide" : state === "missing" ? "Retry" : "Reveal"}
      </Button>
      {state === "ready" && value && (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      )}
    </div>
  );
}
