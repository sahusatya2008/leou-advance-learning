"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { StudentRegisterWizard } from "@/components/register/StudentRegisterWizard";

export default function CreateStudentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> Create student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="sr-only">Create student</DialogTitle>
        </DialogHeader>
        <StudentRegisterWizard
          endpoint="/api/admin/students"
          title="Create student account"
          description="Uses the same wizard as self-registration, including AI face enrollment."
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}