"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

type Subject = { id: string; name: string };

export default function BatchForm({
  classRoom,
  batch,
  trigger,
}: {
  classRoom: { id: string; subjects: Subject[] };
  batch?: { id: string; name: string; subjectIds: string[] };
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const editing = !!batch;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(batch?.name ?? "");
  const [subjectIds, setSubjectIds] = useState<string[]>(batch?.subjectIds ?? []);
  const [busy, setBusy] = useState(false);

  function toggleSubject(id: string) {
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(
      editing ? `/api/admin/batches/${batch.id}` : `/api/admin/classes/${classRoom.id}/batches`,
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subjectIds }),
      }
    );
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong.");
      return;
    }
    toast.success(editing ? "Batch updated." : "Batch created.");
    setOpen(false);
    if (!editing) {
      setName("");
      setSubjectIds([]);
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" /> {editing ? "Edit batch" : "Add batch"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit batch" : "Add batch"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input
              id="batch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Section A"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Subjects offered in this batch</Label>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border p-3">
              {classRoom.subjects.length === 0 && (
                <p className="col-span-2 text-sm text-muted-foreground">
                  No subjects allotted to this class yet.
                </p>
              )}
              {classRoom.subjects.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                >
                  <Checkbox checked={subjectIds.includes(s.id)} onCheckedChange={() => toggleSubject(s.id)} />
                  <Badge variant="outline" className="font-normal">
                    {s.name}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="ml-auto">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? "Save changes" : "Create batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}