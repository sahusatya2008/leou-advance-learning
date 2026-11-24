#!/usr/bin/env bash
# Disaster recovery: rebuild the database from the newest verified backup.
#
#   ./scripts/restore-db.sh                 # list candidates, restore newest
#   ./scripts/restore-db.sh backups/db-XXX.dump
#   DRY_RUN=1 ./scripts/restore-db.sh       # show the plan, change nothing
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/libpq/bin:/usr/local/bin:/usr/local/opt/libpq/bin:$PATH"

set -a; source .env; set +a

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"

pg_url() { python3 -c "import os,urllib.parse as u;p=u.urlparse(os.environ['DATABASE_URL']);print(p.username, u.unquote(p.password or ''), p.hostname, p.port or 5432, (p.path or '/').lstrip('/'))"; }
read -r PGUSER PGPASS PGHOST PGPORT PGDB <<< "$(pg_url)"

TARGET="${1:-$(ls -t "$BACKUP_DIR"/db-*.dump 2>/dev/null | head -1)}"
if [ -z "$TARGET" ] || [ ! -f "$TARGET" ]; then
  echo "no backup found in $BACKUP_DIR" >&2
  exit 1
fi

echo "backup : $TARGET ($(du -h "$TARGET" | cut -f1), taken $(date -r "$TARGET" -u +%FT%TZ))"
echo "target : $PGDB@$PGHOST:$PGPORT"

# Never restore on top of a live app: writers would race the restore.
if curl -fsS -o /dev/null --max-time 3 http://localhost:3001/api/health 2>/dev/null; then
  echo "WARNING: the app is running. Stop it first (./scripts/stop-stack.sh) or writers will corrupt the restore." >&2
  [ "${FORCE:-0}" = "1" ] || exit 1
fi

if ! pg_restore --list "$TARGET" > /dev/null 2>&1; then
  echo "this backup is not a readable archive - refusing to touch the database" >&2
  exit 1
fi

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY RUN: would drop and recreate schema, then restore $(pg_restore --list "$TARGET" | grep -c '^;' || true) statements"
  exit 0
fi

echo "restoring..."
PGPASSWORD="$PGPASS" pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" \
  --no-owner --no-privileges --clean --if-exists "$TARGET"

echo "verifying..."
PGPASSWORD="$PGPASS" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -tAc \
  "select 'User='||(select count(*) from \"User\")||' StudentProfile='||(select count(*) from \"StudentProfile\")||' Submission='||(select count(*) from \"Submission\");"
echo "restore complete - start the stack with ./scripts/start-stack.sh"
