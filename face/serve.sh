#!/usr/bin/env bash
# Start the face verification service (InsightFace + DeepFace).
# Usage: ./face/serve.sh   (or: npm run face:serve)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/face/.venv"
PORT="${FACE_SVC_PORT:-8000}"

if [ ! -x "$VENV/bin/uvicorn" ]; then
  echo "Missing venv at $VENV. Run:  /opt/homebrew/bin/python3.11 -m venv $VENV" >&2
  echo "then:  $VENV/bin/pip install -r $ROOT/face/requirements.txt" >&2
  exit 1
fi

echo "Starting face-verifier on http://127.0.0.1:$PORT (models download on first boot)"
exec "$VENV/bin/uvicorn" main:app \
  --app-dir "$ROOT/face/service" \
  --host 127.0.0.1 \
  --port "$PORT" \
  --log-level info