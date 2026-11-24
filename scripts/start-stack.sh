#!/usr/bin/env bash
# Bring the whole platform up: database, web app + face service, public tunnel.
#
# The app runs in Docker (not as a host process) so that a crash is recovered by
# Docker's restart policy instead of depending on a login shell. The tunnel runs as
# a LaunchAgent because macOS refuses to let launchd execute anything inside
# ~/Documents — but the tailscale binary and its config live in ~/.config/leou,
# which launchd can reach.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

LOG_DIR="$APP_DIR/logs"
mkdir -p "$LOG_DIR"
log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

CONFIG_DIR="$HOME/.config/leou"
TUNNEL_LABEL="com.leou.funnel"
WATCHDOG_LABEL="com.leou.watchdog"
PUBLIC_DOMAIN="https://leou.tailabe1e6.ts.net"

# ------------------------------------------------------------------ 0. docker
if ! pgrep -x Docker > /dev/null 2>&1; then
  log "starting Docker Desktop"
  open -g -a Docker
  for _ in $(seq 1 60); do
    docker info > /dev/null 2>&1 && break
    sleep 2
  done
fi
docker info > /dev/null 2>&1 || { log "ERROR: Docker is not available"; exit 1; }

# ------------------------------------------------------- 1. tunnel preconditions
# The Tailscale Funnel needs tailscaled running (kept up by brew services) and
# the node logged in. A missing node means the platform stays private.
if ! tailscale status >/dev/null 2>&1; then
  log "tailscale not up - the platform will run, but stay private; run: sudo tailscaled up --hostname=leou"
fi

# ------------------------------------------------- 2. app + database containers
log "starting app and database containers"
docker compose up -d

log "waiting for the app to report healthy"
APP_OK=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 http://localhost:3001/api/health > /dev/null 2>&1; then
    APP_OK=1
    break
  fi
  sleep 5
done
[ "$APP_OK" = 1 ] || { log "ERROR: app did not become healthy; check 'docker compose logs app'"; exit 1; }
HEALTH="$(curl -fsS --max-time 10 http://localhost:3001/api/health)"
log "app healthy: $HEALTH"

# ------------------------------------------------------------- 3. launchd jobs
# Both jobs use only paths outside ~/Documents so launchd can run them.
for LABEL in "$TUNNEL_LABEL" "$WATCHDOG_LABEL"; do
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  if [ ! -f "$PLIST" ]; then
    log "WARNING: $PLIST is missing - automatic recovery is disabled"
    continue
  fi
  if ! launchctl list | grep -q "$LABEL"; then
    log "loading $LABEL"
    launchctl load -w "$PLIST"
  fi
done

# launchd registers the job asynchronously, so give it a moment before verifying.
sleep 8

# ----------------------------------------------------------------- 4. verify
if launchctl list | grep -q "$TUNNEL_LABEL"; then
  sleep 6
  if curl -fsS -o /dev/null --max-time 25 "$PUBLIC_DOMAIN/login"; then
    log "public URL: $PUBLIC_DOMAIN  (verified, HTTP 200)"
  else
    log "WARNING: tunnel is loaded but $PUBLIC_DOMAIN did not answer; see ~/.config/leou/funnel.err"
  fi
else
  log "tunnel not running - platform is up on http://localhost:3001 only"
fi

log "stack up"
