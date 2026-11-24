"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartHandshake, Pencil, Trash2, Loader2, Phone, Mail, CalendarDays, UserRound, Unlink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { friendlyError, parseJson } from "@/lib/apiClient";
import LinkStudentDialog from "@/components/admin/parents/LinkStudentDialog";
import { RevealSecret } from "@/components/admin/RevealSecret";

export type ParentStudent = {
  id: string;
  fullName: string;
  parentUserId: string | null;
  user: { id: string; username: string; status: string };
  classRoom: { name: string } | null;
};

export type ParentRow = {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: Date | string;
  parentProfile: {
    id: string;
    fullName: string | null;
    students: ParentStudent[];
  } | null;
};

const STATUS_VARIANT: Record<string, "default" | "warning" | "destructive"> = {
  ACTIVE: "default",
  SUSPENDED: "warning",
  BLOCKED: "destructive",
};

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ParentCard({ parent }: { parent: ParentRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: parent.parentProfile?.fullName ?? "",
    phone: parent.phone ?? "",
    status: parent.status,
    password: "",
  });

  const profile = parent.parentProfile;
  const students = profile?.students ?? [];

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/parents/${parent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await parseJson<{ error?: string }>(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Could not save changes.");
        return;
      }
      toast.success("Parent updated.");
      setEditOpen(false);
      setForm((f) => ({ ...f, password: "" }));
      router.refresh();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/parents/${parent.id}`, { method: "DELETE" });
      const data = await parseJson<{ error?: string }>(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Could not delete the parent.");
        setDeleteOpen(false);
        return;
      }
      toast.success(`Parent "${parent.username}" deleted.`);
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function unlink(student: ParentStudent) {
    if (!window.confirm(`Unlink ${student.fullName} from ${parent.username}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/parents/${parent.id}/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.user.id }),
      });
      const data = await parseJson<{ error?: string }>(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Could not unlink the student.");
        return;
      }
      toast.success(`${student.fullName} unlinked.`);
      router.refresh();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={parent.status !== "ACTIVE" ? "opacity-80" : undefined}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-semibold">
              <HeartHandshake className="h-4 w-4 shrink-0 text-primary" />
              {profile?.fullName || parent.username}
              <Badge variant={STATUS_VARIANT[parent.status] ?? "secondary"}>{parent.status}</Badge>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              @{parent.username}
              {parent.phone && (
                <span className="ml-3 inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {parent.phone}
                </span>
              )}
              <span className="ml-3 inline-flex items-center gap-1">
                <Mail className="h-3 w-3" /> {parent.email}
              </span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" /> Joined {formatDate(parent.createdAt)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Current password</span>
              <RevealSecret userId={parent.id} />
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button variant="ghost" size="icon" title="Edit parent" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Delete parent"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Linked students ({students.length})
            </p>
            <LinkStudentDialog
              parentUserId={parent.id}
              currentStudentIds={students.map((s) => s.user.id)}
            />
          </div>
          {students.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
              No students linked yet — the parent panel stays empty until you link at least one.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{s.fullName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      · {s.user.username} · {s.classRoom?.name ?? "no class"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      <a href={`/admin/students/${s.user.id}`}>Open</a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Unlink"
                      disabled={busy}
                      onClick={() => unlink(s)}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {parent.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`pe-name-${parent.id}`}>Full name</Label>
              <Input
                id={`pe-name-${parent.id}`}
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`pe-phone-${parent.id}`}>Phone</Label>
                <Input
                  id={`pe-phone-${parent.id}`}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                    <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pe-pass-${parent.id}`}>New password (blank keeps current)</Label>
              <Input
                id={`pe-pass-${parent.id}`}
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete @{parent.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              The account and its parent profile are removed permanently. Activity logs keep a record
              of this action. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={doDelete}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete parent
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
