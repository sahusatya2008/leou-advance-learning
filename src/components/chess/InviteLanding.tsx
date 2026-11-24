"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChessBoard } from "@/components/chess/ChessBoard";
import { cn } from "@/lib/utils";
import { Crown, LogIn, Loader2, Swords, TriangleAlert, UserPlus, Users } from "lucide-react";

const LANGUAGE_LABEL: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
};

type Preview = {
  id: string;
  status: string;
  language: string;
  plyCount: number;
  fen: string;
  result: string | null;
  hostName: string | null;
  whiteName: string | null;
  blackName: string | null;
  openSeat: "white" | "black" | null;
  claimable: boolean;
};

type Auth = { signedIn: boolean; role: string | null; myColor: "white" | "black" | null; canClaim: boolean };

/**
 * The friend-facing side of an invitation. It reads the public preview, shows
 * the board they are being pulled into, and either takes their seat (if they
 * already have an account) or hands them off to register / sign in — the invite
 * cookie set by the preview then carries them back here.
 */
export function InviteLanding({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/chess/invite/${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "This invitation could not be found.");
        if (!alive) return;
        setPreview(data.match as Preview);
        setAuth(data.auth as Auth);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const claim = useCallback(async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimError("");
    try {
      const res = await fetch(`/api/chess/invite/${encodeURIComponent(token)}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not take your seat.");
      router.push(`/dashboard/chess/${data.matchId}`);
    } catch (e) {
      setClaimError((e as Error).message);
      setClaiming(false);
    }
  }, [claiming, token, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,0.18), transparent 70%), radial-gradient(40% 40% at 85% 90%, rgba(34,211,238,0.12), transparent 70%)" }} />

      <div className="relative w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-center gap-2 text-primary">
          <Swords className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Leou Chess</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/60 px-6 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Loading invitation…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-14 text-center text-red-200">
            <TriangleAlert className="h-7 w-7" />
            <p className="font-medium">{error}</p>
            <Link href="/dashboard/chess" className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Go to Leou Chess
            </Link>
          </div>
        ) : preview && auth ? (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="mx-auto w-full max-w-sm">
                <ChessBoard fen={preview.fen} orientation={auth.myColor === "black" ? "black" : "white"} />
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">You are invited</p>
                <h1 className="mt-1 text-xl font-bold tracking-tight">
                  {preview.hostName ?? "A friend"} wants to play chess
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Write real code each turn to move your pieces. Language: <span className="text-foreground">{LANGUAGE_LABEL[preview.language] ?? preview.language}</span>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Seat name={preview.whiteName} color="White" active={auth.myColor === "white"} />
                <Seat name={preview.blackName} color="Black" active={auth.myColor === "black"} />
              </div>

              {claimError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{claimError}</span>
                </div>
              )}

              <div className="mt-auto flex flex-col gap-2">
                {auth.canClaim ? (
                  <button
                    type="button"
                    onClick={() => void claim()}
                    disabled={claiming}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
                  >
                    {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                    {claiming ? "Taking your seat…" : `Take the ${preview.openSeat ?? "open"} seat`}
                  </button>
                ) : auth.myColor ? (
                  <Link
                    href={`/dashboard/chess/${preview.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <Crown className="h-4 w-4" /> You are in this game — open the board
                  </Link>
                ) : preview.status !== "ACTIVE" ? (
                  <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-center text-xs text-muted-foreground">
                    This game is already over.
                  </p>
                ) : (
                  <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-center text-xs text-muted-foreground">
                    <Users className="mr-1 inline h-3.5 w-3.5" /> Both seats are taken — this game has already started.
                  </p>
                )}

                {!auth.signedIn && (
                  <>
                    <Link
                      href="/register"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-secondary"
                    >
                      <UserPlus className="h-4 w-4" /> Create an account
                    </Link>
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-secondary"
                    >
                      <LogIn className="h-4 w-4" /> I already have an account
                    </Link>
                    <p className="text-center text-[11px] text-muted-foreground">
                      Your first game with a friend is free — no plan needed.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Seat({ name, color, active }: { name: string | null; color: string; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
        active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-secondary/40 text-muted-foreground"
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color === "White" ? "#f8fafc" : "#0b1220", boxShadow: "0 0 0 1px rgba(148,163,184,0.5)" }} />
      {color}: {name ?? <span className="italic">open</span>}
    </span>
  );
}
