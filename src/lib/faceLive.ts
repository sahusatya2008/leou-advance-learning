"use client";

// Live-scan face helpers. These turn the raw face-api detection into
// verification-grade samples: blink liveness (a photo/video can't blink),
// single-face-in-frame, minimum size, head-on pose and descriptor
// self-consistency (the captured frames must clearly belong to ONE face).
import { FACE_CONFIG } from "@/lib/constants";
import { loadFaceApi } from "@/lib/faceApiClient";
import { cosineDistance } from "@/lib/face";

const EAR_OPEN_MIN = FACE_CONFIG.EAR_OPEN_MIN;
const BLINKS_REQUIRED = FACE_CONFIG.BLINKS_REQUIRED;
const YAW_MAX_DEG = FACE_CONFIG.YAW_MAX_DEG;
const MIN_FACE_PX = FACE_CONFIG.MIN_FACE_PX;
const SELF_MAX = FACE_CONFIG.SELF_MAX_DISTANCE;
const CAPTURE_FRAMES = FACE_CONFIG.CAPTURE_FRAMES;
const LIVENESS_WINDOW_MS = FACE_CONFIG.LIVENESS_WINDOW_MS;

type Point = { x: number; y: number };

function eyeAspectRatio(eye: Point[]): number {
  if (eye.length !== 6) return 0;
  const d1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const d2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const d0 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  if (d0 === 0) return 0;
  return (d1 + d2) / (2 * d0);
}

type LandmarkSet = {
  getLeftEye(): Point[];
  getRightEye(): Point[];
  getNose(): Point[];
};

function earAndYaw(landmarks: LandmarkSet): { ear: number; yawDeg: number } {
  const left = landmarks.getLeftEye();
  const right = landmarks.getRightEye();
  const nose = landmarks.getNose()[3];
  const leftCorner = left[0];
  const rightCorner = right[3];
  const ear = (eyeAspectRatio(left) + eyeAspectRatio(right)) / 2;
  const dL = nose.x - leftCorner.x;
  const dR = rightCorner.x - nose.x;
  const yawDeg = (Math.atan2(dL - dR, dL + dR) * 180) / Math.PI;
  return { ear, yawDeg };
}

export type FrameAnalysis = {
  ok: boolean;
  reason?: string;
  descriptor?: number[];
  ear?: number;
  open?: boolean;
  yawDeg?: number;
  boxW?: number;
  faceCount?: number;
};

const bad = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

type FaceApiModule = Awaited<ReturnType<typeof loadFaceApi>>;

type DetectedFace = {
  detection: { box: { width: number } };
  landmarks: LandmarkSet;
  descriptor?: Float32Array;
};

async function detect(
  faceapi: FaceApiModule,
  video: HTMLVideoElement,
  withDescriptors: boolean
): Promise<DetectedFace[]> {
  // Generous score threshold: eyes-closed faces often score lower, and if the
  // detector drops the face mid-blink the dip is never observed.
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 });
  const task = faceapi.detectAllFaces(video, options).withFaceLandmarks();
  const out = withDescriptors ? await task.withFaceDescriptors() : await task;
  return out as unknown as DetectedFace[];
}

/** Full frame analysis (slow path — computes the face descriptor too). */
export async function analyzeFrame(video: HTMLVideoElement): Promise<FrameAnalysis> {
  try {
    const faceapi = await loadFaceApi();
    const results = await detect(faceapi, video, true);
    const usable = results.filter(
      (r) => r.descriptor && r.descriptor.length === FACE_CONFIG.EMBEDDING_DIM
    );
    if (usable.length === 0) return bad("no face detected");
    if (usable.length > 1) return bad("more than one face in the frame");
    const r = usable[0];
    const { ear, yawDeg } = earAndYaw(r.landmarks);
    return {
      ok: true,
      descriptor: Array.from(r.descriptor as Float32Array),
      ear,
      open: ear >= EAR_OPEN_MIN,
      yawDeg,
      boxW: r.detection.box.width,
      faceCount: results.length,
    };
  } catch (e) {
    console.error(e);
    return bad("face detection failed");
  }
}

export type EyeAnalysis =
  | { ok: true; ear: number; open: boolean; yawDeg: number; boxW: number }
  | { ok: false; reason: string };

/**
 * Fast path for the liveness blink loop: landmarks only, no descriptor, so the
 * eye aspect ratio is sampled many times per second. A blink lasts ~200-400 ms;
 * the old code computed a full descriptor per sample and simply missed blinks.
 */
export async function analyzeEyes(video: HTMLVideoElement): Promise<EyeAnalysis> {
  try {
    const faceapi = await loadFaceApi();
    const results = await detect(faceapi, video, false);
    const usable = results.filter(
      (r) => r.landmarks.getLeftEye().length === 6 && r.landmarks.getRightEye().length === 6
    );
    if (usable.length === 0) return bad("no face detected");
    if (usable.length > 1) return bad("more than one face in the frame");
    const r = usable[0];
    const { ear, yawDeg } = earAndYaw(r.landmarks);
    return { ok: true, ear, open: ear >= EAR_OPEN_MIN, yawDeg, boxW: r.detection.box.width };
  } catch (e) {
    console.error(e);
    return bad("face detection failed");
  }
}

function isUsable(s: FrameAnalysis): boolean {
  return (
    !!s.ok &&
    s.faceCount === 1 &&
    !!s.open &&
    typeof s.boxW === "number" &&
    s.boxW >= MIN_FACE_PX &&
    typeof s.yawDeg === "number" &&
    Math.abs(s.yawDeg) <= YAW_MAX_DEG
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True when the camera is streaming but the frame carries no usable image.
 *
 * A live MediaStream does not guarantee pixels. A covered lens, a hardware
 * privacy shutter, a camera held by another app, or a driver that hands back a
 * black stream all look identical to the page: `readyState` is 4, the preview
 * shows, and every captured "photo" is a uniform black JPEG. Uploading those
 * wastes a round trip and produces a bewildering "Face verification failed".
 * Sampling a thumbnail and measuring its brightness and contrast catches it.
 */
export function isFrameBlank(video: HTMLVideoElement): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let sum = 0;
    let sumSq = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      // Rec. 601 luma. Green weights highest because faces carry most of it.
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += y;
      sumSq += y * y;
    }
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);
    const stdDev = Math.sqrt(variance);

    // Uniformly dark (lens covered / shutter closed / driver black frame), or
    // a flat mid-grey wall with no contrast at all.
    return (mean < 10 && stdDev < 6) || stdDev < 2.5;
  } catch {
    // A tainted or unavailable 2D context is not evidence of a blank frame.
    return false;
  }
}

/** Mirrored JPEG still of the current camera frame (mirrored to match the UI). */
export function capturePhotoDataUrl(video: HTMLVideoElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

type EyeSample = Awaited<ReturnType<typeof analyzeEyes>>;

export type BlinkResult = { ok: boolean; blinks: number; baseline: number | null };

/**
 * Blink challenge, self-normalized to the person on screen and sampled as fast
 * as detection allows.
 *
 * Instead of fixed EAR thresholds (people vary wildly and noisy landmarks
 * wreck fixed cut-offs), this learns the student's OWN "neutral, eyes-open"
 * EAR from the first frames, then treats the eyes as a blink when the EAR
 * drops below ~68% of that baseline and recovers above ~85%. A single short
 * dip is enough — blinks only last ~200-400 ms and sampling every ~30-60 ms
 * catches them in 1-3 frames.
 *
 * A printed photo or screen has a constant EAR, so it can never complete a
 * drop-and-recover transition. BLINKS_REQUIRED of them must be seen.
 */
export async function waitForBlink(
  video: HTMLVideoElement,
  timeoutMs: number = LIVENESS_WINDOW_MS,
  blinksRequired: number = BLINKS_REQUIRED
): Promise<BlinkResult> {
  const dropRatio = 0.68;
  const restoreRatio = 0.85;
  const start = Date.now();
  const warmup: number[] = [];
  let baseline: number | null = null;
  let blinks = 0;
  let state: "open" | "dip" = "open";
  let dipFrames = 0;
  let samples = 0;

  while (Date.now() - start < timeoutMs) {
    const s: EyeSample = await analyzeEyes(video);
    if (s.ok) {
      samples += 1;
      const ear = s.ear;

      // Warm-up baseline = median of the first frames. Comparing every frame to
      // this person's own neutral reading is what makes it work for ANY face.
      if (baseline === null) {
        if (warmup.length < 5) {
          warmup.push(ear);
          if (warmup.length === 5) {
            baseline = [...warmup].sort((a, b) => a - b)[2];
            console.debug("[faceLive] baseline %.3f from warm-up", baseline);
          }
        }
        continue;
      }

      // If the neutral reading came from a moment the student was squinting or
      // mid-blink, their eyes are actually much wider — re-anchor to the higher
      // value so dips are still detectible as relative drops.
      if (ear > baseline * 1.45) {
        baseline = ear;
      }

      if (state === "open") {
        if (ear < baseline * dropRatio) {
          state = "dip";
          dipFrames = 1;
        } else {
          // Slow-track for drift in pose/lighting while the eyes are clearly open.
          baseline = baseline * 0.99 + ear * 0.01;
        }
      } else if (state === "dip") {
        if (ear < baseline * dropRatio) {
          dipFrames += 1;
          // Eyes stayed shut too long to be a blink (squint/stare) — restart.
          if (dipFrames > 30) {
            state = "open";
            dipFrames = 0;
          }
        } else if (ear >= baseline * restoreRatio) {
          // Drop followed by recovery = a real blink.
          blinks += 1;
          console.debug("[faceLive] blink #%d (dip=%d, ear=%.3f, base=%.3f)", blinks, dipFrames, ear, baseline);
          state = "open";
          dipFrames = 0;
          if (blinks >= blinksRequired) return { ok: true, blinks, baseline };
        }
        // else: still recovering from half-shut — keep waiting in this dip.
      }
    }
    // No artificial delay in the loop: sample back-to-back as fast as the model
    // returns, otherwise a ~250 ms blink slips between samples. 10 ms just keeps
    // the main thread breathing.
    await delay(10);
  }
  console.debug("[faceLive] blink timeout: %d blinks from %d samples (base=%s)", blinks, samples, String(baseline));
  return { ok: false, blinks, baseline };
}

export type CaptureResult =
  | { ok: true; descriptors: number[][] }
  | { ok: false; reason: string };

/**
 * Captures `count` quality-gated frames of the same live face. Each frame must
 * pass the single-face / eye-open / size / head-pose gates, and every frame
 * must agree with the others within SELF_MAX — so a wrong face cannot sneak in
 * mid-capture. Several frames are then voted on server-side.
 */
export async function captureVerifiedSamples(
  video: HTMLVideoElement,
  count: number = CAPTURE_FRAMES,
  maxTimeMs = 9000
): Promise<CaptureResult> {
  const descriptors: number[][] = [];
  const start = Date.now();
  while (descriptors.length < count && Date.now() - start < maxTimeMs) {
    const s = await analyzeFrame(video);
    if (s.ok && isUsable(s) && s.descriptor) {
      if (
        descriptors.length > 0 &&
        descriptors.some((ex) => cosineDistance(s.descriptor!, ex) > SELF_MAX)
      ) {
        return { ok: false, reason: "Captured frames did not match each other." };
      }
      descriptors.push(s.descriptor);
      // Small pause so consecutive frames are not pixel-identical; the pose can
      // drift a little between captures, which also confirms a moving, live face.
      await delay(240);
    }
    await delay(80);
  }
  if (descriptors.length < count)
    return { ok: false, reason: "Could not capture enough clean frames. Face the camera squarely." };
  return { ok: true, descriptors };
}

export type OneSampleResult =
  | { ok: true; descriptor: number[]; photo: string }
  | { ok: false; reason: string };

/**
 * Waits up to `timeoutMs` for one quality-gated frame and returns its descriptor
 * plus a mirrored still (used by enrollment, one deliberate snapshot at a time).
 */
export async function captureOneUsable(
  video: HTMLVideoElement,
  timeoutMs = 4000
): Promise<OneSampleResult> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await analyzeFrame(video);
    if (s.ok && isUsable(s) && s.descriptor) {
      const photo = capturePhotoDataUrl(video);
      if (photo) return { ok: true, descriptor: s.descriptor, photo };
    }
    await delay(120);
  }
  return { ok: false, reason: "Could not capture a clean frame. Face the camera directly, in good light." };
}