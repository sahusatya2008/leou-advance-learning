"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Lock, Save, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ProfileEditorData = {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  classRoomName: string;
  hasStreams: boolean;
  stream: string;
  schoolName: string;
  schoolStatus: string;
  schoolClassHistory: string;
  currentPassword: string | null;
};

export function ProfileEditor({ data }: { data: ProfileEditorData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: data.email,
    phone: data.phone,
    schoolName: data.schoolName,
    schoolStatus: data.schoolStatus,
    schoolClassHistory: data.schoolClassHistory,
    stream: data.stream,
  });
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/student/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, stream: data.hasStreams ? form.stream || null : null, newPassword: newPassword || undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return toast.error(body.error ?? "Could not save your profile.");
    toast.success("Profile updated.");
    setNewPassword("");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" /> Personal details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="flex items-center gap-1.5">
                Full name <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input value={data.fullName} disabled readOnly />
              <p className="text-xs text-muted-foreground">Name is fixed by the institute. Ask the admin to change it.</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Username <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input value={data.username} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Class <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input value={data.classRoomName} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Optional" />
            </div>
            {data.hasStreams && (
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
            <div className="space-y-2 sm:col-span-2">
              <Label>School</Label>
              <Input value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Previous school / class history (optional)</Label>
              <Input
                value={form.schoolClassHistory}
                onChange={(e) => set("schoolClassHistory", e.target.value)}
                placeholder="e.g. Class 10 at Springdale Public School"
              />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={busy}>
                <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" /> Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current password</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-sm">
                {data.currentPassword ? (showCurrent ? data.currentPassword : "•".repeat(Math.max(8, data.currentPassword.length))) : "not recorded"}
              </code>
              {data.currentPassword && (
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setShowCurrent((v) => !v)}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The admin can also see this, so they can sign you in if you are locked out.
            </p>
          </div>
          <PasswordChange
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            onSaved={() => setNewPassword("")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function PasswordChange({
  newPassword,
  setNewPassword,
  onSaved,
}: {
  newPassword: string;
  setNewPassword: (v: string) => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function save() {
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const res = await fetch("/api/student/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return toast.error(body.error ?? "Could not change your password.");
    toast.success("Password changed.");
    onSaved();
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label>Set a new password</Label>
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
        <Button type="button" variant="outline" onClick={save} disabled={busy || !newPassword}>
          Update
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[0.65rem]">
          Requested by the institute
        </Badge>
        <span className="text-xs text-muted-foreground">Changing it also updates what the admin sees.</span>
      </div>
    </div>
  );
}
