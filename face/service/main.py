"""Face verification HTTP API (FastAPI).

Endpoints
---------
GET  /health   -> service + model status (no model download forced)
POST /embed    -> {images: [...]}       one ArcFace embedding + liveness per frame
POST /verify   -> {images, enrollments} per-frame match vs the enrolled face +
                 a hard verdict via majority vote (matches >= ceil(n/2))
POST /scan-payment -> {image} OCR a UPI receipt and propose a transaction id

Clients (the Next.js app) only ever exchange base64 stills; this process never
stores image bytes, embeddings or any personal data.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from face_pipeline import pipeline, prewarm
from payment_ocr import scan_payment as scan_payment_screen

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("face-service")

app = FastAPI(title="Face Verifier", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# Model download/load is heavy; kick it off in the background at boot.
threading.Thread(target=prewarm, daemon=True).start()


class EmbedRequest(BaseModel):
    images: list[str] = Field(..., min_length=1, max_length=12)


class ScanPaymentRequest(BaseModel):
    image: str = Field(..., min_length=200, max_length=12_000_000)


class VerifyRequest(BaseModel):
    images: list[str] = Field(..., min_length=1, max_length=12)
    enrollments: list[list[float]] = Field(..., min_length=1)
    match_distance: float = 0.42
    require_liveness: bool = True
    min_face_px: int = 64


@app.get("/health")
def health() -> dict[str, Any]:
    """Liveness plus readiness.

    The status code is what the container entrypoint polls before letting the
    web app serve, so it must not report success while the models are still
    loading. Callers that only want to know the process is alive can read
    `liveness: true` from the body.
    """
    ready = pipeline.ready
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "ok": ready,
            "liveness": True,
            "service": "face-verifier",
            "ready": ready,
            "status": pipeline.status(),
        },
    )


@app.post("/embed")
def embed(req: EmbedRequest) -> dict[str, Any]:
    """Embed every submitted image, keeping the caller's original order.

    Enrolling a student submits 3-5 photos at once and each one costs a second
    or two of detection and recognition, so doing them in sequence left the admin
    watching a spinner for the best part of a minute. onnxruntime runs its
    inference in native code and releases the GIL, so a small thread pool gives a
    real speed-up rather than just interleaving Python bytecode. Order is
    restored by index, so `results[i]` still describes `images[i]`.
    """
    images = list(req.images)

    def one(item: tuple[int, str]) -> dict[str, Any]:
        idx, img = item
        frame = pipeline.analyze_frame(img)
        frame["index"] = idx
        return frame

    if len(images) == 1:
        ordered = [one((0, images[0]))]
    else:
        workers = min(len(images), 4)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            ordered = list(pool.map(one, enumerate(images)))
    return {"results": ordered}


@app.post("/verify")
def verify(req: VerifyRequest) -> dict[str, Any]:
    """Per-frame verification: matching is a majority vote across the frames.

    Every usable frame must depict the enrolled face (cosine distance within
    `match_distance`) and, unless liveness is disabled, must be classified as a
    real (non-spoof) capture. A frame that fails detection, shows multiple or
    too-small faces, is a spoof, or does not match simply withholds its vote.
    The scan passes only when >= half the submitted frames vote positively.
    """
    results: list[dict[str, Any]] = []
    valid = 0
    for idx, img in enumerate(req.images):
        frame = pipeline.analyze_frame(img)
        frame["index"] = idx
        frame["matched"] = False
        frame["distance"] = None
        frame["reason"] = None

        ok = frame.get("ok") is True
        if not ok:
            frame["reason"] = frame.get("error", "unusable")
            results.append(frame)
            continue

        if frame.get("face_px", 0) < req.min_face_px:
            frame["reason"] = "too_small"
            results.append(frame)
            continue

        if req.require_liveness:
            live = frame.get("liveness") or {}
            if live.get("unavailable"):
                # Anti-spoof could not reach a verdict. Treating "unknown" as
                # "real" let a photo of a student through precisely when FasNet
                # failed to load or errored, i.e. exactly when nobody is
                # watching. Fail closed, and keep the reason distinct from a
                # spoof so the caller can ask for a retry instead of accusing
                # the student.
                frame["reason"] = "liveness_unavailable"
                results.append(frame)
                continue
            if live.get("is_real") is not True:
                frame["reason"] = "spoof"
                results.append(frame)
                continue

        dist = pipeline.min_cosine_distance(frame["embedding"], req.enrollments)
        frame["distance"] = dist
        if dist <= req.match_distance:
            frame["matched"] = True
            valid += 1

        results.append(frame)

    votes_required = (len(req.images) + 1) // 2
    passed = valid >= votes_required
    return {
        "samples": len(req.images),
        "valid": valid,
        "votes_required": votes_required,
        "pass": passed,
        "results": results,
    }


@app.post("/scan-payment")
def scan_payment(req: ScanPaymentRequest) -> dict[str, Any]:
    """Propose a transaction id from a photo of the payment confirmation.

    This is a reading aid, not a decision: the id is returned for the student to
    confirm (or correct) before anything is submitted, and the admin still
    approves the payment by hand.
    """
    try:
        return scan_payment_screen(req.image)
    except Exception:
        logger.exception("payment scan failed")
        return {
            "ok": False,
            "error": "The payment screen could not be scanned. Enter the transaction id instead.",
        }
