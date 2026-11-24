#!/usr/bin/env bash
# Container entrypoint: one Node process (the app) and one Python process (the
# face service), with the app refusing to serve until the face service answers.
set -uo pipefail

PORT="${PORT:-3000}"
FACE_SVC_PORT="${FACE_SVC_PORT:-8000}"
export FACE_SVC_URL="${FACE_SVC_URL:-http://127.0.0.1:${FACE_SVC_PORT}}"

log() { printf '[entrypoint] %s\n' "$*"; }

# ---------------------------------------------------------------- schema
# The Prisma CLI is intentionally absent from this image (it would add ~212MB),
# so migrations are a deploy step, not a boot step:
#
#   docker build --target migrate -t leou-migrate .
#   docker run --rm --env-file .env leou-migrate
#
# If the CLI happens to be present (a host that installs it at release time),
# honour RUN_MIGRATIONS=1 and apply them before serving.
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  if [ -n "${DATABASE_URL:-}" ] && command -v npx > /dev/null 2>&1 && [ -d node_modules/prisma ]; then
    log "applying migrations (RUN_MIGRATIONS=1)"
    npx prisma migrate deploy >> /tmp/migrate.log 2>&1 \
      || log "WARNING: migrate deploy failed - see /tmp/migrate.log"
  else
    log "RUN_MIGRATIONS=1 but the Prisma CLI is not in this image - run the migrate target instead"
  fi
fi

# ---------------------------------------------------------------- face service
log "starting face service on :${FACE_SVC_PORT}"
# main.py does a flat `from face_pipeline import ...`, so the service directory
# must be the import root - this mirrors face/serve.sh's --app-dir.
cd /app/face/service
python -m uvicorn main:app --app-dir /app/face/service --host 0.0.0.0 --port "$FACE_SVC_PORT" --workers 1 \
  >> /tmp/face.log 2>&1 &
FACE_PID=$!

# The face service answers /health with 503 until the recognition model is in
# memory (~15s). Waiting for that here is what stops the very first person to
# press "Create account" after a restart from absorbing the model load: without
# the gate the web app was serving immediately, so that request blocked for the
# best part of a minute behind an apparently dead button.
log "waiting for the face service to finish loading its models"
face_ready=0
for _ in $(seq 1 180); do
  if curl -fsS "http://127.0.0.1:${FACE_SVC_PORT}/health" >/dev/null 2>&1; then
    face_ready=1
    break
  fi
  if ! kill -0 "$FACE_PID" 2>/dev/null; then
    log "face service exited during startup - see /tmp/face.log"
    exit 1
  fi
  sleep 1
done
if [ "$face_ready" -eq 1 ]; then
  log "face service ready"
else
  # Better to come up degraded and log it than to refuse to boot entirely: the
  # admin can still sign in, and a later request will retry the model load.
  log "WARNING: face service not ready after 180s - starting anyway, see /tmp/face.log"
fi

# ---------------------------------------------------------------- web app
log "starting web app on :${PORT}"
cd /app
node server.js >> /tmp/app.log 2>&1 &
APP_PID=$!

# ---------------------------------------------------------------- supervision
# If either process dies the whole container should die, so the host restarts a
# clean pair instead of serving a platform that cannot verify faces.
term() {
  log "shutting down"
  kill "$APP_PID" "$FACE_PID" 2>/dev/null
  wait 2>/dev/null
  exit 0
}
trap term TERM INT

while true; do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    log "web app exited - see /tmp/app.log"
    exit 1
  fi
  if ! kill -0 "$FACE_PID" 2>/dev/null; then
    log "face service exited - see /tmp/face.log"
    exit 1
  fi
  sleep 5
done
