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
import ClassForm from "./ClassForm";

export default function ClassActions({ cls }: { cls: { id: string; name: string; hasStreams: boolean; sortOrder: number; active: boolean } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    const res = await fetch(`/api/admin/classes/${cls.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cls.active }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Failed to update class.");
    toast.success(cls.active ? "Class deactivated." : "Class activated.");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/admin/classes/${cls.id}`, { method: "DELETE" });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Failed to delete class.");
    toast.success("Class deleted.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <ClassForm
        cls={cls}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit class">
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
          <DropdownMenuLabel>{cls.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={busy} onClick={toggleActive}>
            <Power className="h-4 w-4" /> {cls.active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete class “{cls.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This only succeeds when the class has no students and no batches. This action cannot be undone.
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