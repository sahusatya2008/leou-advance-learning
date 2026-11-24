"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ClassInput = { id?: string; name: string; hasStreams: boolean; sortOrder: number };

export default function ClassForm({
  cls,
  trigger,
}: {
  cls?: ClassInput;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(cls?.name ?? "");
  const [hasStreams, setHasStreams] = useState(cls?.hasStreams ?? false);
  const [sortOrder, setSortOrder] = useState(cls?.sortOrder ?? 0);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(cls ? `/api/admin/classes/${cls.id}` : "/api/admin/classes", {
      method: cls ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, hasStreams, sortOrder }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong.");
      return;
    }
    toast.success(cls ? "Class updated." : "Class created.");
    setOpen(false);
    if (!cls) {
      setName("");
      setHasStreams(false);
      setSortOrder(0);
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" /> {cls ? "Edit" : "Add class"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cls ? "Edit class" : "Add class"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cls-name">Class name</Label>
            <Input
              id="cls-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Class 11"
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Has streams</p>
              <p className="text-xs text-muted-foreground">Show stream selection (Science / Commerce)</p>
            </div>
            <Switch checked={hasStreams} onCheckedChange={setHasStreams} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cls-order">Sort order</Label>
            <Input
              id="cls-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="ml-auto">
              {cls ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {cls ? "Save changes" : "Create class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}