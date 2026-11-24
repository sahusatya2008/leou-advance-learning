"use client";

import * as React from "react";
import { Camera, Loader2, RefreshCcw, ScanFace, TriangleAlert } from "lucide-react";
import { useFaceCam } from "@/hooks/useFaceCam";
import { capturePhotoDataUrl, isFrameBlank } from "@/lib/faceLive";
import { FACE_CONFIG } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function FaceLogin({
  onResult,
  onCameraError,
  autoStart = true,
}: {
  // Uploads the captured live stills; the server embeds + matches them via the
  // InsightFace/DeepFace service. `null` means "aborted".
  onResult: (images: string[] | null) => void;
  // Lets the login screen report why the camera failed. Previously these
  // failures never left the browser, so there was no way to tell a covered
  // lens apart from a busy one in the activity log.
  onCameraError?: (detail: { kind: string; message: string; domException?: string }) => void;
  autoStart?: boolean;
}) {
  const { videoRef, start, stop, restart, streaming, ready, error, errorInfo, device } = useFaceCam();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [warn, setWarn] = React.useState<string | null>(null);
  const resolvedRef = React.useRef(false);

  React.useEffect(() => {
    if (autoStart && !streaming) void start();
  }, [autoStart, streaming, start]);

  React.useEffect(() => {
    if (errorInfo) onCameraError?.({ kind: errorInfo.kind, message: errorInfo.message, domException: errorInfo.domException });
  }, [errorInfo, onCameraError]);

  async function verify() {
    if (!videoRef.current || busy || resolvedRef.current) return;
    setBusy(true);
    setMessage(null);
    setWarn(null);
    try {
      const video = videoRef.current;
      if (video.videoWidth === 0) {
        setMessage("The camera is still starting. Wait a moment and press Verify again.");
        return;
      }
      // Catching the black-stream case here beats uploading five uniform
      // frames and asking the student to interpret "Face verification failed".
      if (isFrameBlank(video)) {
        setMessage(
          "The camera preview is black. Uncover the lens, close any video call or other tab using the camera, and press Verify again."
        );
        return;
      }

      const frames = Math.max(1, FACE_CONFIG.CAPTURE_FRAMES);
      const images: string[] = [];
      for (let i = 0; i < frames; i++) {
        const dataUrl = capturePhotoDataUrl(video);
        if (dataUrl) images.push(dataUrl);
        if (i < frames - 1) await delay(280);
      }
      if (images.length === 0) {
        setMessage("Could not read the camera. Please retry.");
        return;
      }
      setMessage("Live liveness + face match in progress…");
      resolvedRef.current = true;
      await stop();
      onResult(images);
    } catch (e) {
      console.error(e);
      setMessage("Face capture failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center text-sm">
        <p className="text-destructive">{error}</p>
        {errorInfo?.domException && (
          <p className="text-xs text-muted-foreground">
            Reported by your device as <code className="font-mono">{errorInfo.domException}</code>
          </p>
        )}
        {/* Retry in place. The old button called window.location.reload(), which
            threw away the username, the password and the whole pre-login window,
            so the "recovery" for a one-off camera glitch was a full restart. */}
        <Button
          className="mt-1 w-full"
          variant="outline"
          onClick={() => {
            resolvedRef.current = false;
            void restart();
          }}
        >
          <RefreshCcw className="h-4 w-4" /> Retry camera
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-32 rounded-2xl border-2 border-dashed border-white/40" />
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur">
          <ScanFace className="h-3.5 w-3.5" /> Look directly at the camera
        </div>
        {streaming && !ready && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/60 px-3 py-1.5 text-xs text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for the camera…
          </div>
        )}
      </div>

      {warn && (
        <p className="flex items-start gap-2 text-sm text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {warn}
        </p>
      )}

      {message && <p className="text-sm text-amber-300">{message}</p>}

      <p className="text-center text-xs text-muted-foreground">
        The system now checks for a real, live face (anti-spoofing) and matches it
        against the enrolled face using ArcFace — a printed photo or screen cannot pass.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {device ? (
          <span className="truncate">
            Camera ready{device.kind !== "?x?" ? ` · ${device.kind}` : ""}
          </span>
        ) : (
          <span>{streaming ? "Camera detected" : "Starting camera…"}</span>
        )}
        {streaming && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              resolvedRef.current = false;
              setWarn(null);
              setMessage(null);
              void restart();
            }}
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Restart camera
          </Button>
        )}
      </div>

      <Button className="w-full" size="lg" onClick={verify} disabled={busy || !streaming}>
        <Camera className="h-4 w-4" />
        {busy ? `Capturing ${FACE_CONFIG.CAPTURE_FRAMES} frames…` : "Verify and log in"}
      </Button>
    </div>
  );
}
