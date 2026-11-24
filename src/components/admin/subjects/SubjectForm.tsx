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

export default function SubjectForm({
  classes,
  subject,
  trigger,
}: {
  classes: { id: string; name: string }[];
  subject?: { id: string; name: string; classIds: string[] };
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const editing = !!subject;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subject?.name ?? "");
  const [classIds, setClassIds] = useState<string[]>(subject?.classIds ?? []);
  const [busy, setBusy] = useState(false);

  function toggleClass(id: string) {
    setClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(editing ? `/api/admin/subjects/${subject.id}` : "/api/admin/subjects", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, classIds }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong.");
      return;
    }
    toast.success(editing ? "Subject updated." : "Subject created.");
    setOpen(false);
    if (!editing) {
      setName("");
      setClassIds([]);
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" /> {editing ? "Edit subject" : "Add subject"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit subject" : "Add subject"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subj-name">Subject name</Label>
            <Input
              id="subj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Physics"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Allot to classes</Label>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border p-3">
              {classes.length === 0 && (
                <p className="col-span-2 text-sm text-muted-foreground">No classes exist yet.</p>
              )}
              {classes.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                >
                  <Checkbox checked={classIds.includes(c.id)} onCheckedChange={() => toggleClass(c.id)} />
                  <Badge variant="outline" className="font-normal">
                    {c.name}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="ml-auto">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? "Save changes" : "Create subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}