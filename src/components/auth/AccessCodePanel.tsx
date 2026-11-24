"use client";

import * as React from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Shows a student their own access code on screen, with a copy button and a
 * live countdown.
 *
 * The code is fetched from `/api/auth/access-code`, which re-verifies the
 * password every time, so nothing here is a way around the password. When the
 * countdown reaches zero the panel quietly fetches a fresh code: the previous
 * one was already invalidated server-side, so leaving it on screen would only
 * produce a confusing "expired" dead end.
 */
export function AccessCodePanel({
  identifier,
  password,
  onPasswordChange,
  autoStart = false,
  className,
}: {
  identifier: string;
  /** Current password; the panel prompts for it when empty. */
  password: string;
  onPasswordChange: (value: string) => void;
  /** Fetch as soon as the panel mounts (used when the camera has just failed). */
  autoStart?: boolean;
  className?: string;
}) {
  const [code, setCode] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const aliveRef = React.useRef(true);

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchCode = React.useCallback(async () => {
    if (busy) return;
    if (!identifier || !password) {
      setError("Enter your username and password first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.code) {
        setCode(null);
        setSecondsLeft(0);
        setError(data?.error ?? "Could not get an access code.");
        return;
      }
      setCode(data.code);
      setSecondsLeft(Math.max(1, Math.ceil((Number(data.ttlMs) || 60_000) / 1000)));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [busy, identifier, password]);

  React.useEffect(() => {
    if (!autoStart || !identifier || !password) return;
    // Deferred to a microtask: fetchCode flips `busy` synchronously, and doing
    // that directly in the effect body is a cascading render.
    const t = queueMicrotask(() => {
      if (aliveRef.current) void fetchCode();
    });
    return () => t;
    // Intentionally mount-only: the countdown handler refreshes on expiry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Countdown; on expiry pull a new code so the student is never left holding a
  // dead one.
  React.useEffect(() => {
    if (!code || secondsLeft <= 0) return;
    const t = setTimeout(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          void fetchCode();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [code, secondsLeft, fetchCode]);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy. Write the code down instead.");
    }
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-primary/40 bg-primary/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your access code
              {code ? ` · expires in ${secondsLeft}s` : ""}
            </p>
            {code ? (
              <p className="font-mono text-4xl font-bold leading-tight tracking-[0.35em] text-primary tabular-nums">
                {code}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {busy ? "Getting your code…" : "No code yet"}
              </p>
            )}
          </div>
          {code && (
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copy access code">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <Button
          className="mt-3 w-full"
          variant={code ? "ghost" : "default"}
          onClick={() => void fetchCode()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          {code ? "Get a new code" : "Get my access code"}
        </Button>
      </div>

      {(!code || error) && !password && (
        <div className="mt-3">
          <Label>Password (to confirm it is you)</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="mt-1.5"
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <p className="mt-2 text-xs text-muted-foreground">
        <KeyRound className="mr-1 inline h-3 w-3" />
        This code is yours alone, works once, and expires in 60 seconds. Your password is
        still required to finish signing in.
      </p>
    </div>
  );
}
