"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import SubjectForm from "./SubjectForm";

export default function SubjectActions({
  subject,
  classes,
}: {
  subject: { id: string; name: string; classIds: string[] };
  classes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/admin/subjects/${subject.id}`, { method: "DELETE" });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Failed to delete subject.");
    toast.success("Subject deleted.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <SubjectForm
        subject={subject}
        classes={classes}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit subject">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete subject">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subject “{subject.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This only succeeds when the subject has no questions in the bank.
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