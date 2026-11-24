"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartHandshake, Loader2, Lock, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type ParentStatus =
  | { linked: false; suggestedUsername: string }
  | { linked: true; parent: { username: string; fullName: string | null; usernameLocked: boolean } };

/**
 * "Register a parent" from the student's own profile.
 *
 * The username starts as a system suggestion the student may personalise once;
 * after it is saved the link is fixed (an admin can still change it later).
 */
export function ParentRegisterCard() {
  const router = useRouter();
  const [status, setStatus] = useState<ParentStatus | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState({ username: "", fullName: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/student/parent", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: ParentStatus) => {
        if (!alive) return;
        setStatus(d);
        if (!d.linked) setForm((f) => ({ ...f, username: d.suggestedUsername }));
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/student/parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return toast.error(body.error ?? "Could not register the parent account.");
    toast.success("Parent account created.");
    router.refresh();
    setStatus({ linked: true, parent: { username: form.username, fullName: form.fullName || null, usernameLocked: true } });
  }

  return (
    <Card className="glass h-fit">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartHandshake className="h-4 w-4 text-primary" /> Parent access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">Could not load parent status. Refresh to try again.</p>
        ) : status.linked ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Linked</Badge>
              {status.parent.usernameLocked && (
                <Badge variant="secondary" className="gap-1 text-[0.65rem]">
                  <Lock className="h-3 w-3" /> Username fixed
                </Badge>
              )}
            </div>
            <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
              <p className="text-muted-foreground">Parent account</p>
              <p className="font-mono font-medium">@{status.parent.username}</p>
              {status.parent.fullName && <p className="text-muted-foreground">{status.parent.fullName}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              Your parent signs in on the same login page with this username. They see your activity, plan, fees and
              results — read-only.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Create a parent login. The username below is generated for you — you can change it once before saving.
            </p>
            <form onSubmit={submit} className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label>Parent username</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Parent name (optional)</Label>
                  <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone (optional)</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Set a password for the parent</Label>
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <Button type="submit" disabled={busy} className="justify-self-start">
                <UserPlus className="h-4 w-4" /> {busy ? "Creating…" : "Register parent"}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
