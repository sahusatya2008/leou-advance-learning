"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EditStudent = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  classRoomId: string;
  stream: string | null;
  schoolName: string;
  schoolStatus: string;
  schoolClassHistory: string | null;
};

export default function StudentEditDialog({
  student,
  classes,
}: {
  student: EditStudent;
  classes: { id: string; name: string; hasStreams: boolean }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: student.fullName,
    username: student.username,
    email: student.email,
    phone: student.phone,
    classRoomId: student.classRoomId,
    stream: student.stream ?? "",
    schoolName: student.schoolName,
    schoolStatus: student.schoolStatus,
    schoolClassHistory: student.schoolClassHistory ?? "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  const selected = classes.find((c) => c.id === form.classRoomId);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "classRoomId") setForm((f) => ({ ...f, stream: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/admin/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        stream: selected?.hasStreams ? form.stream || null : null,
        password: form.password || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(data.error ?? "Failed to update student.");
    toast.success("Student updated.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit student</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 col-span-2">
            <Label>Full name</Label>
            <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={form.username} onChange={(e) => set("username", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={form.classRoomId} onValueChange={(v) => set("classRoomId", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected?.hasStreams && (
            <div className="space-y-2">
              <Label>Stream</Label>
              <Select value={form.stream} onValueChange={(v) => set("stream", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stream" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCIENCE">Science</SelectItem>
                  <SelectItem value="COMMERCE">Commerce</SelectItem>
                  <SelectItem value="HUMANITIES">Humanities</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>School</Label>
            <Input value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>School status</Label>
            <Select value={form.schoolStatus} onValueChange={(v) => set("schoolStatus", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CURRENT">Currently attending</SelectItem>
                <SelectItem value="PAST">Past student</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Previous school / class history (optional)</Label>
            <Input
              value={form.schoolClassHistory}
              onChange={(e) => set("schoolClassHistory", e.target.value)}
              placeholder="e.g. Class 10 at Springdale Public School"
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Reset password (leave blank to keep current)</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="New password (min 8 chars)"
            />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={busy} className="ml-auto">
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}