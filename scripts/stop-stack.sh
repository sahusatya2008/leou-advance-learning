#!/usr/bin/env bash
# Stop the platform.
#
#   ./scripts/stop-stack.sh          stop app + database, keep the funnel config
#   ./scripts/stop-stack.sh --all    also unload the launchd jobs and the funnel
#
# The unrelated `gscy` tunnel on localhost:8787 is never touched: this script
# only unloads its own labelled LaunchAgent.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

FULL=0
[ "${1:-}" = "--all" ] && FULL=1

if [ "$FULL" = 1 ]; then
  for LABEL in com.leou.funnel com.leou.watchdog; do
    if launchctl list | grep -q "$LABEL"; then
      launchctl unload "$HOME/Library/LaunchAgents/$LABEL.plist" 2> /dev/null || true
      log "$LABEL unloaded"
    fi
  done
fi

if docker info > /dev/null 2>&1; then
  docker compose stop
  log "app and database stopped (data is kept in the leou_pgdata volume)"
else
  log "Docker is not running, nothing to stop"
fi

log "stopped"
