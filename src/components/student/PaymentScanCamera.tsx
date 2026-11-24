"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, RefreshCw, ScanLine, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentCheckList } from "@/components/student/PaymentCheckList";
import type { PaymentCheckResult } from "@/lib/paymentVerification";

type Phase = "IDLE" | "CAMERA" | "SCANNING" | "REVIEW";

/**
 * "SNSX scanning" camera.
 *
 * The student points the back camera at their payment confirmation, we grab a
 * frame and read it, then check what we read against the quotation: the amount
 * has to be the amount quoted, and the date has to be recent enough that the
 * receipt belongs to this attempt rather than an earlier one.
 *
 * The frame is kept and sent with the submission, so the admin sees the actual
 * device screen next to our reading of it. Nothing is submitted from here: every
 * field is shown back for the student to confirm, and a mismatch is stated
 * plainly rather than quietly dropped, because the student is the one who can
 * still fix it.
 */
export function PaymentScanCamera(props: {
  requestId: string;
  onSubmit: (payload: {
    transactionId: string;
    cameraProof: string;
  }) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [readId, setReadId] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [edited, setEdited] = useState(readId);
  const [checks, setChecks] = useState<PaymentCheckResult | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  async function openCamera() {
    setHint(null);
    setChecks(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("CAMERA");
    } catch {
      setHint(
        "The camera could not start. Allow camera access, or type the transaction id instead."
      );
      setPhase("IDLE");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    setPhase("SCANNING");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setPhase("CAMERA");
      return;
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    try {
      const res = await fetch("/api/student/payments/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The requestId lets the server compare what it read against this
        // student's own quotation instead of guessing at an amount.
        body: JSON.stringify({ image: dataUrl, requestId: props.requestId }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        transactionId?: string;
        text?: string;
        amount?: number | null;
        date?: string | null;
        time?: string | null;
        payee?: string | null;
        verification?: PaymentCheckResult | null;
      };
      stop();
      if (!data.ok) {
        setHint(data.error ?? "Nothing could be read from that frame. Try again.");
        setPhase("CAMERA");
        return;
      }
      if (!data.transactionId) {
        setHint("A transaction id was not found on that screen. Hold the confirmation in frame.");
        setPhase("CAMERA");
        return;
      }
      setShot(dataUrl);
      setReadId(data.transactionId);
      setEdited(data.transactionId);
      setChecks(data.verification ?? null);
      setPhase("REVIEW");
    } catch {
      stop();
      setHint("The scan failed. Try again, or type the transaction id.");
      setPhase("CAMERA");
    }
  }

  if (phase === "IDLE") {
    return (
      <Card className="glass">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ScanLine className="h-4 w-4 text-primary" /> SNSX payment scan
          </div>
          <p className="text-sm text-muted-foreground">
            Open the payment app on your other device, show the confirmation to this camera,
            and the transaction id will be read for you. Nothing is sent until you confirm it.
          </p>
          {hint && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {hint}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={openCamera}>
              <Camera className="h-4 w-4" /> Start camera
            </Button>
            <Button variant="ghost" onClick={props.onCancel}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "REVIEW") {
    return (
      <Card className="glass border-primary/30">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Check what was read
          </div>
          <p className="text-sm text-muted-foreground">
            This is what the scanner found, checked against your quotation. This photo is sent to
            the admin with your request. Correct anything that does not match your payment app.
          </p>
          {shot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="Captured payment confirmation" className="max-h-48 rounded-lg border border-border" />
          )}

          {checks && <PaymentCheckList checks={checks} />}
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="scanned-txn">
              Transaction id
            </label>
            <input
              id="scanned-txn"
              value={edited}
              onChange={(e) => setEdited(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {props.error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <TriangleAlert className="h-4 w-4" /> {props.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                props.onSubmit({
                  transactionId: edited,
                  cameraProof: shot ?? "",
                })
              }
              disabled={props.submitting || edited.trim().length < 6}
            >
              {props.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit this
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShot(null);
                setHint(null);
                setChecks(null);
                            setPhase("IDLE");
              }}
            >
              <RefreshCw className="h-4 w-4" /> Retake
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          {phase === "SCANNING" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the transaction id…
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 text-primary" /> Show the payment confirmation
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Fill the frame with the payment confirmation. Hold the phone steady.
        </p>
        <div className="relative overflow-hidden rounded-xl border border-border bg-black">
          <video ref={videoRef} playsInline muted className="w-full" />
          {phase === "CAMERA" && (
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-primary/70" />
          )}
        </div>
        {hint && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {hint}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={capture} disabled={phase === "SCANNING"}>
            {phase === "SCANNING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Scan it
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              stop();
              setPhase("IDLE");
            }}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
