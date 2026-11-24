"use client";

import * as React from "react";
import {
  Camera,
  ImagePlus,
  RefreshCcw,
  CheckCircle2,
  ScanFace,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { useFaceCam } from "@/hooks/useFaceCam";
import { capturePhotoDataUrl, isFrameBlank, analyzeEyes } from "@/lib/faceLive";
import { Button } from "@/components/ui/button";
import { FACE_CONFIG } from "@/lib/constants";

export type FaceSampleMode = "live" | "upload" | "mixed";

/** A face smaller than this (in video pixels) is too far away to enroll well. */
const MIN_LOCAL_FACE_PX = 96;
/** One frame roughly every third of a second while scanning. */
const SCAN_FRAME_MS = 350;
/** Hard ceiling so a stubborn camera can never leave the student stuck scanning. */
const SCAN_MAX_MS = 20_000;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function downscaleImage(file: File, maxDim = 1280, quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode_failed"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas_failed"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function FaceSampleCapture({
  onComplete,
  samples = FACE_CONFIG.ENROLL_SAMPLES,
  minSamples = 3,
  maxSamples = samples + 3,
}: {
  onComplete: (photos: string[], mode: FaceSampleMode) => void;
  samples?: number;
  minSamples?: number;
  /**
   * How many frames the auto-scan aims to gather before it stops. Collecting a
   * few MORE than are required is what lets the enrollment keep only the frames
   * that agree and quietly drop one blurry or half-turned shot, instead of
   * failing the whole capture over a single bad frame.
   */
  maxSamples?: number;
}) {
  const { videoRef, start, stop, restart, streaming, ready: camReady, error, errorInfo } = useFaceCam();
  const [mode, setMode] = React.useState<FaceSampleMode>("live");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [guidance, setGuidance] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const used = React.useRef<{ live: boolean; upload: boolean }>({ live: false, upload: false });

  const target = Math.max(samples, maxSamples);

  function sourceMode(): FaceSampleMode {
    if (used.current.live && used.current.upload) return "mixed";
    return used.current.live ? "live" : "upload";
  }

  React.useEffect(() => {
    if (mode === "live" && !streaming) void start();
  }, [mode, streaming, start]);

  React.useEffect(() => () => stop(), [stop]);

  // Smart framing hint while the student lines up, before they press scan. It is
  // strictly advisory: if the on-device model is unavailable it simply stays
  // quiet and the capture falls back to plain frame grabbing.
  React.useEffect(() => {
    if (mode !== "live" || error || !streaming || !camReady || scanning) return;
    let cancelled = false;
    let fails = 0;
    let inFlight = false;
    const tick = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const video = videoRef.current;
        if (!video || cancelled) return;
        const a = await analyzeEyes(video);
        if (cancelled) return;
        if (a.ok) {
          fails = 0;
          if (a.boxW < MIN_LOCAL_FACE_PX) setGuidance("Move a little closer to the camera.");
          else if (Math.abs(a.yawDeg) > FACE_CONFIG.YAW_MAX_DEG) setGuidance("Face the camera straight on.");
          else setGuidance("Looks good — press Start scan.");
        } else if (a.reason === "no face detected") {
          fails = 0;
          setGuidance("Centre the face inside the oval.");
        } else if (a.reason === "more than one face in the frame") {
          fails = 0;
          setGuidance("Only the student should be in the frame.");
        } else {
          // Detection model unavailable — stop hinting rather than flashing errors.
          fails += 1;
          if (fails >= 3) setGuidance(null);
        }
      } finally {
        inFlight = false;
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 600);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mode, error, streaming, camReady, scanning, videoRef]);

  function switchMode(next: FaceSampleMode) {
    if (next === mode || busy) return;
    if (next === "upload") stop();
    setMode(next);
    setMessage(null);
    setGuidance(null);
  }

  function commit(list: string[]) {
    used.current.live = true;
    onComplete([...list], sourceMode());
  }

  /** Grabs as many clean frames as possible, in one animated pass. */
  async function autoScan() {
    const video = videoRef.current;
    if (scanning || busy || !video || !camReady) return;
    if (photos.length >= target) return;
    setScanning(true);
    setBusy(true);
    setMessage(null);
    const collected = [...photos];
    const startedAt = Date.now();
    try {
      while (collected.length < target && Date.now() - startedAt < SCAN_MAX_MS) {
        if (!video.videoWidth) {
          await delay(120);
          continue;
        }
        if (isFrameBlank(video)) {
          setGuidance("The preview looks dark — uncover the lens or add more light.");
          await delay(SCAN_FRAME_MS);
          continue;
        }
        // Best-effort gate. A rejected frame is simply skipped (the loop keeps
        // trying); if the on-device model is missing, `face detection failed`
        // leaves accept = true so the scan still gathers frames.
        const a = await analyzeEyes(video);
        let accept = true;
        if (a.ok) {
          if (a.boxW < MIN_LOCAL_FACE_PX) {
            accept = false;
            setGuidance("Move a little closer to the camera.");
          } else if (Math.abs(a.yawDeg) > FACE_CONFIG.YAW_MAX_DEG) {
            accept = false;
            setGuidance("Face the camera straight on.");
          } else {
            setGuidance("Hold still…");
          }
        } else if (a.reason === "more than one face in the frame") {
          accept = false;
          setGuidance("Only the student should be in the frame.");
        } else if (a.reason === "no face detected") {
          accept = false;
          setGuidance("Centre the face inside the oval.");
        }
        if (accept) {
          const frame = capturePhotoDataUrl(video);
          if (frame) {
            collected.push(frame);
            setPhotos([...collected]);
          }
        }
        await delay(SCAN_FRAME_MS);
      }
    } finally {
      setScanning(false);
      setBusy(false);
    }
    if (collected.length >= minSamples) {
      commit(collected);
    } else {
      setMessage(
        "Could not capture enough clear frames. Face the camera in good light, keep only the student in the frame, and try again."
      );
    }
  }

  /** One deliberate frame, for anyone who prefers to take it slowly. */
  function snap() {
    const video = videoRef.current;
    if (!video || busy || scanning || photos.length >= target) return;
    setBusy(true);
    setMessage(null);
    try {
      if (isFrameBlank(video)) {
        setMessage(
          "The camera preview is black. Uncover the lens, close any video call or other tab using the camera, and try again."
        );
        return;
      }
      const dataUrl = capturePhotoDataUrl(video);
      if (!dataUrl) {
        setMessage("Could not read the camera. Please retry.");
        return;
      }
      const next = [...photos, dataUrl];
      setPhotos(next);
      used.current.live = true;
      if (next.length >= target) {
        onComplete([...next], sourceMode());
      } else if (next.length >= minSamples) {
        setMessage('Good. Add more frames, or press "Use photos".');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const added: string[] = [];
      for (const f of files) {
        if (photos.length + added.length >= target) break;
        if (!f.type.startsWith("image/")) continue;
        try {
          added.push(await downscaleImage(f));
        } catch {
          /* skip unreadable files */
        }
      }
      if (added.length === 0) {
        setMessage("No readable face photos were added. Try jpg/png files.");
        return;
      }
      const next = [...photos, ...added].slice(0, target);
      setPhotos(next);
      used.current.upload = true;
      if (next.length >= target) {
        onComplete([...next], sourceMode());
      } else if (next.length >= minSamples) {
        setMessage('Photos added. You can add more or press "Use photos".');
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(i: number) {
    if (busy || scanning) return;
    setPhotos(photos.filter((_, j) => j !== i));
  }

  function redo() {
    if (busy || scanning) return;
    setPhotos([]);
    setMessage(null);
    used.current = { live: false, upload: false };
  }

  function done() {
    if (busy || scanning) return;
    onComplete([...photos], sourceMode());
  }

  const ready = photos.length >= minSamples;
  const progress = Math.min(1, photos.length / target);

  return (
    <div className="space-y-4">
      {/* source switcher */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "live" ? "default" : "outline"}
          onClick={() => switchMode("live")}
          disabled={busy}
        >
          <Camera className="h-4 w-4" /> Live capture
        </Button>
        <Button
          type="button"
          variant={mode === "upload" ? "default" : "outline"}
          onClick={() => switchMode("upload")}
          disabled={busy}
        >
          <ImagePlus className="h-4 w-4" /> Upload photos
        </Button>
      </div>

      {mode === "live" ? (
        error ? (
          <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
            <Camera className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            {errorInfo?.domException && (
              <p className="mt-1 text-xs text-muted-foreground">
                Reported by your device as <code className="font-mono">{errorInfo.domException}</code>
              </p>
            )}
            {/* Retry the camera in place rather than reloading the page, which
                discarded every sample already captured. */}
            <Button className="mt-4" variant="outline" onClick={() => void restart()}>
              <RefreshCcw className="h-4 w-4" /> Retry camera
            </Button>
          </div>
        ) : (
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full -scale-x-100 object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`h-44 w-36 rounded-[50%] border-2 ${
                  scanning
                    ? "animate-pulse border-accent shadow-[0_0_25px_-2px] shadow-accent/60"
                    : "border-dashed border-white/40"
                }`}
              />
            </div>
            <div className="absolute left-3 top-3 flex max-w-[80%] items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur">
              {scanning ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <ScanFace className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">
                {scanning ? `Capturing ${photos.length} of ${target}…` : guidance ?? "Keep the face inside the oval"}
              </span>
            </div>
            {/* progress rail */}
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )
      ) : (
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center transition-colors hover:border-primary/50"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Click to upload face photos</p>
          <p className="text-xs text-muted-foreground">
            jpg / png, one or many at once. Photos are auto-formatted for the AI.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFiles}
            disabled={busy}
          />
        </div>
      )}

      {/* thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`Sample ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={busy || scanning}
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                aria-label={`Remove sample ${i + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: target }).map((_, i) => (
            <span
              key={i}
              className={`grid h-7 w-7 place-items-center rounded-full border text-[10px] transition-colors ${
                i < photos.length
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                  : i < samples
                    ? "border-border text-muted-foreground"
                    : "border-border/60 text-muted-foreground/60"
              }`}
            >
              {i < photos.length ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
          ))}
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          {photos.length} / {samples}+ captured
        </div>
      </div>

      {message && photos.length < target && <p className="text-sm text-amber-300">{message}</p>}

      {mode === "live" && !error && (
        scanning ? (
          <Button className="w-full" size="lg" disabled>
            <Loader2 className="h-4 w-4 animate-spin" /> Capturing {photos.length} of {target}…
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => void autoScan()}
              disabled={busy || !camReady || photos.length >= target}
            >
              <Sparkles className="h-4 w-4" />
              {photos.length === 0 ? "Start face scan" : "Scan more frames"}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="sm"
              onClick={snap}
              disabled={busy || !camReady || photos.length >= target}
            >
              <Camera className="h-4 w-4" /> Capture one frame manually
            </Button>
          </div>
        )
      )}

      {ready && photos.length < target && (
        <div className="flex gap-2">
          <Button className="flex-1" size="lg" onClick={done} disabled={busy || scanning}>
            Use {photos.length} photos
          </Button>
          <Button variant="ghost" size="lg" onClick={redo} disabled={busy || scanning}>
            <RefreshCcw className="h-4 w-4" /> Start over
          </Button>
        </div>
      )}
    </div>
  );
}
