"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, Lock, ScanFace, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaceLogin } from "@/components/face/FaceLogin";
import { FaceSampleCapture } from "@/components/face/FaceSampleCapture";
import { AccessCodePanel } from "@/components/auth/AccessCodePanel";

type Step = "password" | "face" | "code" | "reenroll" | "done";

export function LoginFlow() {
  const [step, setStep] = useState<Step>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when the server says the stored face is unusable but can be replaced.
  const [canReEnroll, setCanReEnroll] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);

  async function passwordStep() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "password", identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }
      if (data.step === "done") {
        window.location.href = data.redirect;
        return;
      }
      setDisplayName(data.displayName ?? data.name);
      setCameraNote(null);
      setCanReEnroll(false);
      setStep("face");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Camera failures used to die in the browser, so the activity log could not
   * distinguish a covered lens from a busy one. Fire-and-forget the reason.
   */
  const reportCameraError = useCallback((detail: { kind: string; message: string; domException?: string }) => {
    setCameraNote(detail.message);
    void fetch("/api/auth/camera-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detail),
      keepalive: true,
    }).catch(() => null);
  }, []);

  async function faceResult(images: string[] | null) {
    if (!images || images.length === 0) {
      setError("Could not read your face. Please try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "face", images }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Face verification failed.");
        setCanReEnroll(Boolean(data.allowReEnroll));
        if (data.allowReEnroll) {
          setStep("reenroll");
          return;
        }
        if (data.allowAccessCode) setStep("code");
        return;
      }
      window.location.href = data.redirect;
    } catch {
      setError("Network error during face verification.");
    } finally {
      setBusy(false);
    }
  }

  /** Completes the login from inside the pre-login window and signs the student in. */
  async function reEnrollComplete(photos: string[], mode: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/re-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: photos, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not re-enroll your face.");
        return;
      }
      window.location.href = data.redirect ?? "/dashboard";
    } catch {
      setError("Network error during re-enrollment.");
    } finally {
      setBusy(false);
    }
  }

  async function codeStep() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "access-code", identifier, password, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Access code failed.");
        return;
      }
      window.location.href = data.redirect;
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="glass w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          {step === "face" || step === "reenroll" ? (
            <ScanFace className="h-5 w-5 text-accent" />
          ) : (
            <Lock className="h-5 w-5 text-accent" />
          )}
          {step === "code"
            ? "Access code login"
            : step === "reenroll"
              ? "Re-enroll your face"
              : step === "face"
                ? "Face verification"
                : "Sign in to Leou."}
        </CardTitle>
        <CardDescription>
          {step === "face"
            ? `Hi ${displayName}, let's confirm it's really you.`
            : step === "reenroll"
              ? "Your saved face is in an older format, so it cannot be matched. Take a few fresh samples to fix it — this takes a minute."
              : step === "code"
                ? "Enter the 6-digit code and your password to finish signing in."
                : "Enter your credentials, then verify your face."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === "password" && (
          <>
            <div>
              <Label>Username or email</Label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="username or email"
                autoComplete="username"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && passwordStep()}
                placeholder="••••••••"
                autoComplete="current-password"
                className="mt-1.5"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" size="lg" onClick={passwordStep} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </>
        )}

        {step === "face" && (
          <>
            <FaceLogin onResult={faceResult} onCameraError={reportCameraError} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!error && cameraNote && (
              <p className="flex items-start gap-2 text-sm text-amber-300">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {cameraNote}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Button variant="ghost" onClick={() => setStep("password")} className="px-0">
                <ArrowLeft className="h-4 w-4" /> Change account
              </Button>
              <Button variant="link" onClick={() => { setError(null); setStep("code"); }} className="px-0">
                <KeyRound className="h-4 w-4" /> Face not working? Use access code
              </Button>
            </div>
          </>
        )}

        {step === "reenroll" && (
          <>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <FaceSampleCapture
              onComplete={(photos, mode) => void reEnrollComplete(photos, mode)}
              samples={5}
              minSamples={3}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Button
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setCanReEnroll(false);
                  setStep("code");
                }}
                className="px-0"
              >
                <KeyRound className="h-4 w-4" /> Use an access code instead
              </Button>
              <Button variant="link" onClick={() => setStep("password")} className="px-0">
                <ArrowLeft className="h-4 w-4" /> Change account
              </Button>
            </div>
          </>
        )}

        {step === "code" && (
          <>
            <AccessCodePanel
              identifier={identifier}
              password={password}
              onPasswordChange={setPassword}
              autoStart
              className="pt-1"
            />

            <div>
              <Label>Access code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
                className="mt-1.5 text-center text-2xl tracking-[0.4em]"
              />
            </div>
            <div>
              <Label>Password (confirm account)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && codeStep()}
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1.5"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" size="lg" onClick={codeStep} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Log in with code
            </Button>
            <div className="flex items-center justify-between text-sm">
              <Button
                variant="ghost"
                onClick={() => { setError(null); setStep(canReEnroll ? "reenroll" : "face"); }}
                className="px-0"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="link" onClick={() => setStep("password")} className="px-0">
                Change account
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
