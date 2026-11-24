"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import BatchForm from "./BatchForm";

export default function BatchActions({
  batch,
  classSubjects,
}: {
  batch: { id: string; name: string; active: boolean; subjectIds: string[]; classRoomId: string };
  classSubjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    const res = await fetch(`/api/admin/batches/${batch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !batch.active }),
    });
    setBusy(false);
    if (!res.ok) return toast.error("Failed to update batch.");
    toast.success(batch.active ? "Batch deactivated." : "Batch activated.");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/admin/batches/${batch.id}`, { method: "DELETE" });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Failed to delete batch.");
    toast.success("Batch deleted.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <BatchForm
        batch={batch}
        classRoom={{ id: batch.classRoomId, subjects: classSubjects }}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit batch">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{batch.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={busy} onClick={toggleActive}>
            <Power className="h-4 w-4" /> {batch.active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete batch “{batch.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This only succeeds when the batch has no students and no assessments.
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}