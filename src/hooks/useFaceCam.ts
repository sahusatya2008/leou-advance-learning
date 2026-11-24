"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Why the camera could not be opened, in terms the student can act on.
 *
 * The previous version collapsed every failure into one generic sentence and
 * then made the only escape hatch a full page reload, so a phone that was
 * merely *busy* looked identical to a laptop with no camera at all. Each kind
 * gets its own message and its own recovery.
 */
export type CameraErrorKind =
  | "insecure"
  | "permission"
  | "notfound"
  | "busy"
  | "overconstrained"
  | "unsupported"
  | "unknown";

export type CameraErrorInfo = {
  kind: CameraErrorKind;
  /** Student-facing text. Never mentions audio: the camera flow never asks for it. */
  message: string;
  /** Coarse name of the underlying DOMException, for the error reporter. */
  domException?: string;
};

export type CameraDevice = {
  label: string;
  kind: string;
} | null;

function describe(e: unknown): { kind: CameraErrorKind; domException?: string } {
  const name =
    typeof e === "object" && e !== null && "name" in e
      ? String((e as { name: unknown }).name)
      : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return { kind: "permission", domException: name };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return { kind: "notfound", domException: name };
    case "NotReadableError":
    case "TrackStartError":
      return { kind: "busy", domException: name };
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return { kind: "overconstrained", domException: name };
    case "TypeError":
      // No getUserMedia at all: an old or locked-down browser.
      return { kind: "unsupported", domException: name };
    default:
      return { kind: "unknown", domException: name || undefined };
  }
}

function messageFor(kind: CameraErrorKind): string {
  switch (kind) {
    case "insecure":
      return "The camera only works on a secure (https) address. Reopen this site over https and try again.";
    case "permission":
      return "Camera access is blocked for this site. Open the padlock or site settings in your browser, allow the camera, then press Retry.";
    case "notfound":
      return "No camera was found on this device. If it has a built-in or USB camera, make sure nothing is covering it and press Retry.";
    case "busy":
      return "The camera is already in use by another app or tab. Close it (video calls, other browser tabs, Zoom, Meet) and press Retry.";
    case "overconstrained":
      return "This camera cannot provide a usable video stream. Press Retry to try it again with different settings.";
    case "unsupported":
      return "This browser cannot open the camera. Update the browser, or use an access code to sign in instead.";
    default:
      return "The camera could not be started. Press Retry, or use an access code to sign in instead.";
  }
}

/**
 * Constraint sets tried in order, most specific first.
 *
 * `facingMode: "user"` as a bare (non-ideal) value is what broke a large share
 * of student devices: it is a hard requirement, so any camera that cannot
 * satisfy it rejects outright even though a perfectly good stream is
 * available. Everything here is `ideal`, and the last resort drops the
 * constraints entirely, so the browser gives us whatever it has.
 */
const ATTEMPTS: MediaStreamConstraints[] = [
  { video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
  { video: { facingMode: { ideal: "user" }, width: { ideal: 480 } }, audio: false },
  { video: { facingMode: { ideal: "user" } }, audio: false },
  { video: { width: { ideal: 480 } }, audio: false },
  { video: true, audio: false },
];

/** A camera reported busy usually frees up within a moment; retry before giving up. */
const BUSY_RETRIES = 3;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useFaceCam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<CameraErrorInfo | null>(null);
  const [device, setDevice] = useState<CameraDevice>(null);
  /** True once a live track is attached AND real pixels have arrived. */
  const [ready, setReady] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  // Bumped by stop() and by every start(); an in-flight getUserMedia whose
  // token is stale is discarded rather than attached.
  const tokenRef = useRef(0);
  const startingRef = useRef(false);

  const teardown = useCallback(() => {
    tokenRef.current += 1;
    startingRef.current = false;
    const stream = streamRef.current;
    streamRef.current = null;
    setStreaming(false);
    setReady(false);
    setDevice(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    stream?.getTracks().forEach((t) => t.stop());
  }, []);

  /** Resolves once the element actually has pixels, or after `ms`. */
  const waitForPixels = useCallback((video: HTMLVideoElement, ms: number) => {
    if (video.videoWidth > 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        video.removeEventListener("loadedmetadata", onMeta);
        video.removeEventListener("resize", onResize);
        clearTimeout(timer);
        resolve(ok);
      };
      const onMeta = () => finish(video.videoWidth > 0);
      // Some devices raise "resize" without "loadedmetadata".
      const onResize = () => {
        if (video.videoWidth > 0) finish(true);
      };
      const timer = setTimeout(() => finish(video.videoWidth > 0), ms);
      video.addEventListener("loadedmetadata", onMeta);
      video.addEventListener("resize", onResize);
    });
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || streamRef.current) return;

    // 1. Is the camera API even reachable? Two very different failures collapse
    //    into a confusing TypeError otherwise: an insecure origin and a browser
    //    that has no getUserMedia at all.
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      const info: CameraErrorInfo = { kind: "insecure", message: messageFor("insecure") };
      setErrorInfo(info);
      setError(info.message);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      const info: CameraErrorInfo = { kind: "unsupported", message: messageFor("unsupported") };
      setErrorInfo(info);
      setError(info.message);
      return;
    }

    const token = ++tokenRef.current;
    startingRef.current = true;
    setError(null);
    setErrorInfo(null);

    let lastError: CameraErrorInfo | null = null;

    try {
      for (const constraints of ATTEMPTS) {
        let attempt = 0;
        // Inner loop exists only to ride out "busy"; anything else is final for
        // this constraint set and we fall through to a looser one.
        for (;;) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (token !== tokenRef.current) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }

            const el = videoRef.current;
            if (!el) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }

            el.srcObject = stream;
            el.muted = true;
            streamRef.current = stream;

            const track = stream.getVideoTracks()[0];
            const settings = track?.getSettings?.() ?? {};
            setDevice({
              label: track?.label || "camera",
              kind: String(settings.width ?? "?") + "x" + String(settings.height ?? "?"),
            });

            // Autoplay can hang forever on some mobile builds when the element
            // is offscreen or has no layout box. Do not let that strand the
            // state: the pixels check below is the real gate.
            void Promise.race([
              el.play().catch(() => {}),
              delay(2000),
            ]).then(async () => {
              if (token !== tokenRef.current) return;
              const gotPixels = await waitForPixels(el, 4000);
              if (token !== tokenRef.current) return;
              // Some devices report a live track before any frame decodes.
              // Claiming "streaming" there is exactly what produced black
              // frames being uploaded as if they were a real face.
              setStreaming(true);
              setReady(gotPixels);
            });

            setStreaming(true);
            return;
          } catch (e) {
            const { kind, domException } = describe(e);
            lastError = { kind, domException, message: messageFor(kind) };
            if (kind === "busy" && attempt < BUSY_RETRIES) {
              attempt += 1;
              await delay(400 * attempt);
              continue;
            }
            break;
          }
        }
      }

      // Every constraint set failed; report the most informative failure we saw
      // rather than the last (a bare "no constraint" attempt tends to end in a
      // generic NotFoundError that hides the real cause).
      const info: CameraErrorInfo = lastError ?? { kind: "unknown", message: messageFor("unknown") };
      if (token === tokenRef.current) {
        setErrorInfo(info);
        setError(info.message);
      }
    } finally {
      if (token === tokenRef.current) startingRef.current = false;
    }
  }, [waitForPixels]);

  const stop = useCallback(() => {
    teardown();
  }, [teardown]);

  /** Re-runs the whole fallback chain without losing the page or the form. */
  const restart = useCallback(async () => {
    teardown();
    await start();
  }, [start, teardown]);

  useEffect(() => stop, [stop]);

  return { videoRef, start, stop, restart, streaming, ready, error, errorInfo, device };
}
