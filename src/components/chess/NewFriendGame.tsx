"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Link2, Lock } from "lucide-react";
import { OFFERED_LANGUAGES, LANGUAGE_LABELS, type GameLanguage } from "@/lib/games/types";
import { cn } from "@/lib/utils";

/**
 * Open a room and hand the inviter a link. The invitee plays for free, but
 * opening the room here is the paid side of multiplayer, so an unenrolled
 * student sees the card locked with a way to fix it.
 */
export function NewFriendGame({ canInvite, lockReason }: { canInvite: boolean; lockReason?: string }) {
  const router = useRouter();
  const [color, setColor] = useState<"white" | "black">("white");
  const [language, setLanguage] = useState<GameLanguage>("python");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/student/chess/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "MULTIPLAYER", color, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open the room.");
      router.push(`/dashboard/chess/${data.match.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 shadow-xl shadow-black/20">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ background: "radial-gradient(120% 140% at 0% 0%, #a855f755, transparent 55%), radial-gradient(120% 140% at 100% 100%, #22d3ee66, transparent 55%)" }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold tracking-tight">Play with a friend</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a room, share the link, and play a real person. Your friend&apos;s first game is free.
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Play as">
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(["white", "black"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  disabled={!canInvite}
                  className={cn("flex-1 px-3 py-2 text-sm capitalize transition disabled:opacity-50", color === c ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Language">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as GameLanguage)}
              disabled={!canInvite}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              {OFFERED_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABELS[l]}
                </option>
              ))}
            </select>
          </Field>

          {canInvite ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {busy ? "Opening room…" : "Create invite link"}
            </button>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-200">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {lockReason ?? "Opening a room needs an active plan."}{" "}
                <Link href="/onboarding" className="font-semibold underline underline-offset-2">
                  Get started
                </Link>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
