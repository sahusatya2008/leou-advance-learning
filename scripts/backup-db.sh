#!/usr/bin/env bash
# Encrypted-at-rest-resting backups of the platform database.
#
# The data (students, embeddings, payments, attempts) is the one thing that
# cannot be regenerated, so it gets copied off the machine on a schedule and
# every run is verified before it is trusted.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# launchd runs this with a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin), so the
# Homebrew client binaries would be invisible. Put them back explicitly.
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/libpq/bin:/usr/local/bin:/usr/local/opt/libpq/bin:$PATH"

# shellcheck disable=SC1091
set -a; source .env; set +a

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/db-$STAMP.dump"

mkdir -p "$BACKUP_DIR"

# Parse the pieces out of DATABASE_URL rather than hard-coding them.
export DATABASE_URL="${DATABASE_URL:-postgresql://leou:leou_pass@localhost:5433/leou?schema=public}"
PGUSER="$(python3 -c "import os,urllib.parse as u;print(u.urlparse(os.environ['DATABASE_URL']).username)")"
PGPASS="$(python3 -c "import os,urllib.parse as u;print(u.unquote(u.urlparse(os.environ['DATABASE_URL']).password or ''))")"
PGHOST="$(python3 -c "import os,urllib.parse as u;print(u.urlparse(os.environ['DATABASE_URL']).hostname)")"
PGPORT="$(python3 -c "import os,urllib.parse as u;print(u.urlparse(os.environ['DATABASE_URL']).port or 5432)")"
PGDB="$(python3 -c "import os,urllib.parse as u;print((u.urlparse(os.environ['DATABASE_URL']).path or '/').lstrip('/'))")"

echo "[$(date -u +%FT%TZ)] dumping $PGDB@$PGHOST:$PGPORT"

# --clean --if-exists keeps the dump restorable over an existing schema.
if ! PGPASSWORD="$PGPASS" pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" \
      --format=custom --clean --if-exists --no-owner --no-privileges -f "$OUT.tmp"; then
  rm -f "$OUT.tmp"
  echo "pg_dump failed" >&2
  exit 1
fi

# A dump that cannot be listed is not a backup: verify, then publish.
if ! pg_restore --list "$OUT.tmp" > /dev/null 2>&1; then
  rm -f "$OUT.tmp"
  echo "verification failed - dump discarded" >&2
  exit 1
fi

mv "$OUT.tmp" "$OUT"
# NOTE: custom format is already compressed internally, and pg_restore cannot
# read a gzipped custom archive. Do not wrap this file in gzip.
SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date -u +%FT%TZ)] wrote $OUT ($SIZE)"

# Retention
find "$BACKUP_DIR" -name 'db-*.dump' -type f -mtime "+$KEEP_DAYS" -delete
COUNT="$(find "$BACKUP_DIR" -name 'db-*.dump' -type f | wc -l | tr -d ' ')"
echo "[$(date -u +%FT%TZ)] retained $COUNT backup(s)"

# Face embeddings are the heaviest table; note its size so growth is visible.
psql_out="$(PGPASSWORD="$PGPASS" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -tAc \
  "select pg_size_pretty(pg_total_relation_size('\"StudentProfile\"'));")" 2>/dev/null || true
[ -n "${psql_out:-}" ] && echo "StudentProfile table size: $psql_out"
