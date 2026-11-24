"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Power, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { UserStatus } from "@/generated/prisma/enums";

export default function StudentStatusActions({ id, status }: { id: string; status: UserStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: UserStatus) {
    setBusy(true);
    const res = await fetch(`/api/admin/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Failed to update status.");
    toast.success(`Student marked ${next.toLowerCase()}.`);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Failed to delete student.");
    toast.success("Student deleted.");
    router.push("/admin/students");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {status !== "ACTIVE" ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("ACTIVE")}>
          <Power className="h-4 w-4" /> Activate
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("SUSPENDED")}>
          <ShieldOff className="h-4 w-4" /> Suspend
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this student account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the student, their sessions and history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={remove} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}