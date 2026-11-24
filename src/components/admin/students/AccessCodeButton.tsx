"use client";

import { friendlyError, parseJson } from "@/lib/apiClient";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AccessCodeButton({ id }: { id: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/students/${id}/access-code`, { method: "POST" });
      const data = await parseJson<{ error?: string; code?: string }>(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to generate code.");
        return;
      }
      if (data?.code) setCode(data.code);
      setExpiresAt(Date.now() + 60_000);
      toast.success("New access code generated. Previous codes are now invalid.");
    } catch {
      toast.error("Could not generate a code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Code copied.");
  }

  return (
    <div className="space-y-3">
      {code && expiresAt && (
        <Card className="border-primary/40 bg-primary/10">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Live code · 60s</p>
              <p className="font-mono text-3xl font-bold tracking-widest text-primary">{code}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={copy}>
              <Copy className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
      <Button onClick={generate} disabled={busy} className="w-full">
        <KeyRound className="h-4 w-4" /> {code ? "Rotate access code" : "Generate access code"}
      </Button>
    </div>
  );
}