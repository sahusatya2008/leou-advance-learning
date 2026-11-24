# Multi-stage build for a free container host (Render, Fly, Railway, Koyeb).
#
# Two runtimes ship in the final image: Next.js needs Node, and the face
# pipeline needs Python + OpenCV. They are separate processes behind one
# entrypoint, because face login is a hard dependency of the product - without
# the Python service nobody can sign in as a student.
#
# Migrations deliberately do NOT live in the runtime image. The Prisma CLI plus
# its engines are ~212MB, which would triple the image for something that runs
# once per deploy. Use the `migrate` target instead:
#
#   docker build --target migrate -t leou-migrate .
#   docker run --rm --env-file .env leou-migrate

# ---------------------------------------------------------------- face models
FROM python:3.11-slim AS face

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PIP_DEFAULT_TIMEOUT=180 \
    PIP_RETRIES=10

# libgl1/libglib2.0 are what the onnxruntime/dlib wheels link against.
# tesseract-ocr backs the "show the payment screen to the camera" scan, which
# reads the transaction id off a student's phone so they do not have to type it.
# Same story as the pip step below: this runs over a home connection that has been
# observed dropping DNS mid-fetch, which fails the whole RUN. apt keeps its fetched
# .debs in /var/cache/apt/archives, so retrying resumes rather than restarting.
RUN for attempt in 1 2 3 4 5; do \
      echo "apt-get attempt $attempt/5"; \
      apt-get update \
      && apt-get install -y --no-install-recommends \
           libgl1 libglib2.0-0 build-essential curl tesseract-ocr tesseract-ocr-eng \
      && break; \
      if [ "$attempt" = "5" ]; then echo "apt-get failed after 5 attempts"; exit 1; fi; \
      echo "attempt $attempt failed, retrying in 15s"; sleep 15; \
    done \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/face
COPY face/requirements.txt ./
# This stage pulls ~2.5GB of wheels (onnxruntime, insightface, dlib, tf-keras and
# their transitive deps) from PyPI over the user's home connection. That transfer is
# long enough to hit two different transient faults on files.pythonhosted.org: a
# mid-stream ReadTimeout, and a silently truncated index page that surfaces as a
# JSONDecodeError rather than a network error (so pip's own --retries never fires).
# Either one aborts a ~40 minute download and, with the cache disabled, throws away
# every byte already fetched. The retry loop below survives that: pip's wheel cache
# is kept, so each attempt resumes from what already landed instead of re-fetching
# the whole set. PIP_DEFAULT_TIMEOUT/PIP_RETRIES above cover the genuine timeouts.
RUN for attempt in 1 2 3 4 5; do \
      echo "pip install attempt $attempt/5"; \
      pip install -r requirements.txt && break; \
      if [ "$attempt" = "5" ]; then echo "pip install failed after 5 attempts"; exit 1; fi; \
      echo "attempt $attempt failed, retrying with warm cache in 15s"; sleep 15; \
    done \
 && pip cache purge \
 && python -c "import cv2, numpy, onnxruntime, fastapi, pytesseract; print('face deps import OK')"
COPY face/service/ ./service/

# Pull buffalo_l + the anti-spoofing weights into the image at build time so the
# first real login is not a multi-hundred-megabyte download. Both cache dirs are
# created unconditionally so the runtime COPY cannot fail when a download is
# skipped (offline build, cached layer) - an empty dir just means "fetch on boot".
RUN mkdir -p /root/.insightface/models /root/.deepface/weights \
 && (python -c "\
import sys; sys.path.insert(0, '/app/face/service'); \
from face_pipeline import pipeline; \
pipeline.app; \
pipeline.spoof; \
print('face models baked into the image')" \
   || echo 'WARN: model warm-up failed; the service will download on first boot') \
 && du -sh /root/.insightface /root/.deepface

# ---------------------------------------------------------------- web build
FROM node:22-slim AS build

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------- migrations
# Throwaway image: full deps + schema, runs the migration, exits.
FROM build AS migrate
WORKDIR /app
ENV DATABASE_URL=""
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------- runtime
FROM python:3.11-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    FACE_SVC_PORT=8000

# tesseract is needed at runtime, not just in the face build stage: the payment
# scanner is served by the same Python process that does face verification.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 curl ca-certificates gnupg procps openssl \
      tesseract-ocr tesseract-ocr-eng \
 && install -d /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The standalone bundle already contains a pruned, traced node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Schema is kept so a post-deploy `prisma migrate deploy` can run from a shell.
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

# Face service + the model weights baked in by the face stage.
COPY --from=face /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=face /app/face/service /app/face/service
COPY --from=face /root/.insightface /root/.insightface
COPY --from=face /root/.deepface /root/.deepface

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=6s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
