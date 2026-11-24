"use client";

let loadingPromise: Promise<typeof import("@vladmandic/face-api")> | null = null;

export function loadFaceApi() {
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      return faceapi;
    })();
  }
  return loadingPromise;
}

export type FaceSample = {
  descriptor: number[];
  photoDataUrl: string;
};

export async function captureFaceSample(video: HTMLVideoElement): Promise<FaceSample | null> {
  const faceapi = await loadFaceApi();

  const result = await faceapi
    .detectSingleFace(
      video,
      new (await import("@vladmandic/face-api")).TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5,
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result || !result.descriptor || result.descriptor.length !== 128) return null;
  const descriptor = result.descriptor;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);
  const photoDataUrl = canvas.toDataURL("image/jpeg", 0.92);

  return { descriptor: Array.from(descriptor), photoDataUrl };
}