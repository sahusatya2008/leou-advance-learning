"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Swords } from "lucide-react";
import { OFFERED_LANGUAGES, LANGUAGE_LABELS, type GameLanguage } from "@/lib/games/types";
import { cn } from "@/lib/utils";

const DIFFICULTIES = [
  { id: "easy", label: "Rookie", blurb: "Learning the board" },
  { id: "medium", label: "Challenger", blurb: "Plays solid moves" },
  { id: "hard", label: "Master", blurb: "Punishes mistakes" },
  { id: "grandmaster", label: "Grandmaster", blurb: "Barely misses" },
] as const;

export function NewComputerGame() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [color, setColor] = useState<"white" | "black">("white");
  const [language, setLanguage] = useState<GameLanguage>("python");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/student/chess/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "COMPUTER", difficulty, color, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the game.");
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
        style={{ background: "radial-gradient(120% 140% at 100% 0%, #22d3ee55, transparent 55%), radial-gradient(120% 140% at 0% 100%, #6366f166, transparent 55%)" }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold tracking-tight">New game vs computer</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Write a <code className="rounded bg-secondary px-1">move(game)</code> function and the engine answers. Free to play.</p>

        <div className="mt-5 space-y-4">
          <Field label="Opponent">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left transition",
                    difficulty === d.id ? "border-primary bg-primary/15" : "border-border hover:bg-secondary/60"
                  )}
                >
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className="text-[11px] text-muted-foreground">{d.blurb}</div>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Play as">
              <div className="flex overflow-hidden rounded-lg border border-border">
                {(["white", "black"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn("flex-1 px-3 py-2 text-sm capitalize transition", color === c ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {OFFERED_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            {busy ? "Setting up…" : "Start playing"}
          </button>
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
