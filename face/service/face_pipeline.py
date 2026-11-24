"""Core face pipeline: InsightFace ArcFace embeddings + DeepFace liveness.

Everything here only ever runs as base64-decoded still images (JPEG/PNG data
URLs uploaded from the browser). No image bytes are ever persisted.

The matching distance returned is the cosine distance between two L2-normalized
ArcFace (buffalo_l) embeddings:
  distance = 1 - max(embedding . enrolled_embedding)
Same-person buffalo_l embeddings typically land below ~0.32-0.40 cosine
distance; different people are well above 0.55. Thresholds are configured on
the Next.js side (FACE_CONFIG) so they can be tuned without redeploying Python.
"""

from __future__ import annotations

import base64
import logging
import threading
import time
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger("facepipeline")


class Pipeline:
    """Lazily loads InsightFace + DeepFace models on first use (thread-safe)."""

    def __init__(self) -> None:
        self._app: Any = None
        self._spoof: Any = None
        self._spoof_err: str | None = None
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ loading
    @property
    def app(self) -> Any:
        if self._app is None:
            with self._lock:
                if self._app is None:
                    import insightface

                    t0 = time.time()
                    app = insightface.app.FaceAnalysis(
                        name="buffalo_l",
                        allowed_modules=["detection", "recognition"],
                    )
                    app.prepare(ctx_id=0, det_size=(640, 640))  # 0 => CPU, portable
                    logger.info("insightface buffalo_l ready in %.1fs", time.time() - t0)
                    self._app = app
        return self._app

    @property
    def spoof(self) -> Any:
        if self._spoof is None and self._spoof_err is None:
            with self._lock:
                if self._spoof is None and self._spoof_err is None:
                    try:
                        from deepface.modules import modeling

                        t0 = time.time()
                        model = modeling.build_model(task="spoofing", model_name="Fasnet")
                        logger.info("deepface Fasnet anti-spoof ready in %.1fs", time.time() - t0)
                        self._spoof = model
                    except Exception as e:  # noqa: BLE001
                        logger.exception("Fasnet unavailable")
                        self._spoof_err = str(e)
        return self._spoof

    @property
    def spoof_error(self) -> str | None:
        return self._spoof_err

    def status(self) -> dict[str, Any]:
        return {
            "insightface": self._app is not None,
            "deepface_fasnet": self._spoof is not None,
            "deepface_error": self._spoof_err,
        }

    @property
    def ready(self) -> bool:
        """True once a request can actually be served.

        `/health` used to answer "ok" the instant the HTTP server was listening,
        which is long before the ~16s of model loading finished. The app gates
        its own boot on that answer, so the first student to press "Create
        account" after a restart absorbed the whole model load as an unexplained
        pause. Readiness is therefore reported only once the recognition model
        is in memory.
        """
        return self._app is not None

    # ------------------------------------------------------------------- decode
    @staticmethod
    def decode_image(data_url: str) -> np.ndarray:
        if data_url.startswith("data:"):
            raw_bytes = base64.b64decode(data_url.split(",", 1)[1])
        else:
            raw_bytes = base64.b64decode(data_url)
        img = cv2.imdecode(np.frombuffer(raw_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("invalid image payload")
        return img

    # ------------------------------------------------------------- one frame
    def analyze_frame(self, data_url: str) -> dict[str, Any]:
        t0 = time.time()
        try:
            img = self.decode_image(data_url)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": f"invalid image: {e}"}

        faces = self.app.get(img)

        if len(faces) == 0:
            return {
                "ok": False,
                "error": "no_face",
                "liveness": self._liveness_for(img),
                "ms": self._ms(t0),
            }
        if len(faces) > 1:
            return {"ok": False, "error": "multiple_faces", "ms": self._ms(t0)}

        face = faces[0]
        emb: np.ndarray | None = face.normed_embedding
        if emb is None:
            emb = face.embedding
        if emb is None:
            return {"ok": False, "error": "no_embedding", "ms": self._ms(t0)}

        emb = np.asarray(emb, dtype=np.float64)
        norm = np.linalg.norm(emb)
        if norm == 0:
            return {"ok": False, "error": "degenerate_embedding", "ms": self._ms(t0)}
        emb = emb / norm

        bbox = [int(v) for v in face.bbox]  # [x1, y1, x2, y2]
        box_w, box_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        # Feed FasNet the face region with a small margin, as DeepFace does.
        mx, my = int(box_w * 0.08), int(box_h * 0.08)
        area = (
            max(0, bbox[0] - mx),
            max(0, bbox[1] - my),
            box_w + 2 * mx,
            box_h + 2 * my,
        )
        liveness = self._liveness_for(img, area)

        width = int(img.shape[1])

        return {
            "ok": True,
            "embedding": emb.tolist(),
            "det_score": round(float(face.det_score), 4),
            "face_px": max(box_w, box_h),
            "liveness": liveness,
            "ms": self._ms(t0),
            "width": width,
        }

    def _liveness_for(self, img: np.ndarray, area=None) -> dict[str, Any]:
        spoof = self.spoof
        if spoof is None:
            # No verdict, not a pass. Reporting True here made anti-spoof fail
            # open: if FasNet failed to load, every frame was stamped "real".
            return {
                "is_real": None,
                "score": None,
                "unavailable": self.spoof_error or "unknown",
            }
        try:
            if area is None:
                h, w = img.shape[:2]
                area = (0, 0, w, h)
            is_real, score = spoof.analyze(img=img, facial_area=area)
            return {"is_real": bool(is_real), "score": round(float(score), 4)}
        except Exception as e:  # noqa: BLE001
            logger.warning("Fasnet analyze failed: %s", e)
            return {"is_real": None, "score": None, "unavailable": str(e)}

    # -------------------------------------------------------------- matching
    @staticmethod
    def min_cosine_distance(embedding: list[float], enrollments: list[list[float]]) -> float:
        emb = np.asarray(embedding, dtype=np.float64)
        dots = np.max(
            [float(np.dot(emb, np.asarray(e, dtype=np.float64))) for e in enrollments] or [0.0]
        )
        return round(1.0 - float(dots), 6)

    @staticmethod
    def _ms(t0: float) -> float:
        return round((time.time() - t0) * 1000, 1)


pipeline = Pipeline()


def prewarm() -> None:
    """Eagerly load models in the background on startup (best-effort).

    InsightFace is the model every request needs, so it is loaded first and any
    failure is left to retry lazily. The anti-spoof model is a separate concern
    and a failure there must not stop the service becoming ready, because a
    missing FasNet weight would otherwise keep the whole app from booting.
    """
    try:
        pipeline.app
    except Exception:  # noqa: BLE001
        logger.exception("insightface prewarm failed (will retry lazily)")
    try:
        pipeline.spoof
    except Exception:  # noqa: BLE001
        logger.exception("anti-spoof prewarm failed (will retry lazily)")