"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { friendlyError, parseJson } from "@/lib/apiClient";

export default function CreateParentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    phone: "",
    email: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/parents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await parseJson<{ error?: string; parent?: { username: string } }>(res);
      if (!res.ok || !data?.parent) {
        toast.error(data?.error ?? "Could not create the parent account.");
        return;
      }
      toast.success(`Parent account "${data.parent.username}" created.`);
      setForm({ fullName: "", username: "", password: "", phone: "", email: "" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> Create parent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create parent account</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pp-fullname">Full name</Label>
            <Input
              id="pp-fullname"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="e.g. Muhammad Aslam"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pp-username">Username (login)</Label>
              <Input
                id="pp-username"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="4-32 chars, a-z 0-9 _ ."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-password">Password</Label>
              <Input
                id="pp-password"
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pp-phone">Phone (optional)</Label>
              <Input
                id="pp-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+92 …"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-email">Email (optional)</Label>
              <Input
                id="pp-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="auto-generated if blank"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The parent signs in at /login with this username and password — no face or access code needed.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create parent"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
