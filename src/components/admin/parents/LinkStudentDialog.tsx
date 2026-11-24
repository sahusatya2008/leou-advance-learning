"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link2, Search, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { friendlyError, parseJson } from "@/lib/apiClient";

type StudentRow = {
  id: string;
  username: string;
  studentProfile: {
    fullName: string;
    classRoom: { name: string } | null;
    parentUserId: string | null;
  } | null;
};

export default function LinkStudentDialog({
  parentUserId,
  currentStudentIds,
}: {
  parentUserId: string;
  currentStudentIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || students.length) return;
    let cancelled = false;
    fetch("/api/admin/students", { cache: "no-store" })
      .then((res) => parseJson<{ students?: StudentRow[] }>(res))
      .then((data) => {
        if (!cancelled) setStudents(data?.students ?? []);
      })
      .catch((err) => toast.error(friendlyError(err, "Could not load students.")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = students.filter((s) => s.studentProfile);
    if (!q) return rows;
    return rows.filter(
      (s) =>
        s.username.toLowerCase().includes(q) ||
        (s.studentProfile?.fullName ?? "").toLowerCase().includes(q),
    );
  }, [students, query]);

  async function link(studentId: string, replace = false) {
    setBusyId(studentId);
    try {
      const res = await fetch(`/api/admin/parents/${parentUserId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, replace }),
      });
      const data = await parseJson<{ error?: string; needsReplace?: boolean; ok?: boolean }>(res);
      if (!res.ok) {
        if (data?.needsReplace && replace === false) {
          const move = window.confirm(`${data.error ?? "Already linked elsewhere."} Move them to this parent anyway?`);
          if (move) {
            return await link(studentId, true);
          }
          return;
        }
        toast.error(data?.error ?? "Could not link the student.");
        return;
      }
      toast.success("Student linked.");
      router.refresh();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setLoading(true);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4" /> Link student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link a student</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or username…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No students match.</div>
        ) : (
          <div className="divide-y">
            {filtered.map((s) => {
              const isLinkedHere = currentStudentIds.includes(s.id);
              const linkedElsewhere = !isLinkedHere && !!s.studentProfile?.parentUserId;
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.studentProfile?.fullName}{" "}
                      <span className="font-normal text-muted-foreground">· {s.username}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.studentProfile?.classRoom?.name ?? "No class"}
                      {linkedElsewhere && " · linked to another parent"}
                    </p>
                  </div>
                  {isLinkedHere ? (
                    <Badge variant="success">
                      <Check className="mr-1 h-3 w-3" /> Linked
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant={linkedElsewhere ? "secondary" : "outline"}
                      disabled={busyId === s.id}
                      onClick={() => link(s.id)}
                    >
                      {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : linkedElsewhere ? "Move here" : "Link"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
