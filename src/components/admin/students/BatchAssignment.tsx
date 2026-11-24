"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BatchRow = {
  id: string;
  name: string;
  studentCount: number;
  subjectNames: string[];
  assigned: boolean;
};

export default function BatchAssignment({
  studentUserId,
  batches,
}: {
  studentUserId: string;
  batches: BatchRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(batches.filter((b) => b.assigned).map((b) => b.id))
  );
  const [busy, setBusy] = useState(false);

  async function toggle(batchId: string) {
    if (busy) return;
    const next = new Set(selected);
    if (next.has(batchId)) next.delete(batchId);
    else next.add(batchId);
    setSelected(next);
    setBusy(true);
    const res = await fetch(`/api/admin/students/${studentUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchIds: [...next].filter((id) => batches.find((b) => b.id === id)) }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSelected(new Set(batches.filter((b) => b.assigned).map((b) => b.id)));
      return toast.error(data.error ?? "Failed to update batch assignment.");
    }
    router.refresh();
  }

  if (batches.length === 0) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Briefcase className="h-4 w-4" />
        No batches exist for this class yet. Create one under Category Management.
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {batches.map((b) => {
        const active = selected.has(b.id);
        return (
          <button
            key={b.id}
            type="button"
            disabled={busy}
            onClick={() => toggle(b.id)}
            className={cn(
              "flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
              active
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-card/60 hover:bg-secondary",
              busy && "opacity-60"
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")} />
                <p className="font-medium">{b.name}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {b.subjectNames.length === 0 && (
                  <Badge variant="outline" className="text-xs">No subjects</Badge>
                )}
                {b.subjectNames.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">{b.studentCount}</p>
          </button>
        );
      })}
    </div>
  );
}