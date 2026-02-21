#!/usr/bin/env bash
#
# Printyx Database Restore Script
# US-031: Restore database from backup (GCS or local)
#
# Usage:
#   ./scripts/db-restore.sh <backup-file-or-gcs-path>
#   ./scripts/db-restore.sh printyx-backup-2026-02-19-020000.sql.gz
#   ./scripts/db-restore.sh gs://printyx-backups/printyx-backup/printyx-backup-2026-02-19-020000.sql.gz
#   ./scripts/db-restore.sh --list                    # List available backups
#   ./scripts/db-restore.sh --latest                  # Restore latest backup
#
# Environment variables (from .env or exported):
#   DATABASE_URL          - PostgreSQL connection string
#   DB_HOST               - Database host (fallback: 209.145.59.219)
#   DB_PORT               - Database port (fallback: 5433)
#   DB_USER               - Database user (fallback: postgres)
#   DB_PASSWORD            - Database password
#   DB_NAME               - Database name (fallback: postgres)
#   BACKUP_GCS_BUCKET     - GCS bucket name for backups
#   RESTORE_TARGET_DB     - Override target database name
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env" 2>/dev/null || true
  set +a
fi

# Configuration with defaults
DB_HOST="${DB_HOST:-209.145.59.219}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${RESTORE_TARGET_DB:-${DB_NAME:-postgres}}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKUP_GCS_BUCKET="${BACKUP_GCS_BUCKET:-printyx-backups}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-$PROJECT_ROOT/backups}"
TEMP_DIR="${BACKUP_LOCAL_DIR}/tmp"

log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date -u +"%Y-%m-%d %H:%M:%S UTC") $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC}   $(date -u +"%Y-%m-%d %H:%M:%S UTC") $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date -u +"%Y-%m-%d %H:%M:%S UTC") $1"
}

log_error() {
  echo -e "${RED}[ERR]${NC}  $(date -u +"%Y-%m-%d %H:%M:%S UTC") $1"
}

# List available backups
list_backups() {
  echo ""
  echo "=== Available Backups ==="
  echo ""

  if command -v gsutil &>/dev/null; then
    echo "--- GCS Daily (gs://${BACKUP_GCS_BUCKET}/printyx-backup/) ---"
    gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-backup/*.sql.gz" 2>/dev/null | tail -20 || echo "  (none)"
    echo ""
    echo "--- GCS Weekly ---"
    gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-backup/weekly/*.sql.gz" 2>/dev/null | tail -10 || echo "  (none)"
    echo ""
    echo "--- GCS Monthly ---"
    gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-backup/monthly/*.sql.gz" 2>/dev/null | tail -12 || echo "  (none)"
  else
    echo "(gsutil not available - showing local backups only)"
  fi

  echo ""
  echo "--- Local Backups (${BACKUP_LOCAL_DIR}/) ---"
  if ls "$BACKUP_LOCAL_DIR"/*.sql.gz &>/dev/null 2>&1; then
    ls -lht "$BACKUP_LOCAL_DIR"/*.sql.gz | head -20
  else
    echo "  (none)"
  fi
  echo ""
}

# Get latest backup path
get_latest_backup() {
  # Try GCS first
  if command -v gsutil &>/dev/null; then
    local latest=$(gsutil ls "gs://${BACKUP_GCS_BUCKET}/printyx-backup/*.sql.gz" 2>/dev/null | sort | tail -1)
    if [ -n "$latest" ]; then
      echo "$latest"
      return 0
    fi
  fi

  # Fallback to local
  local latest_local=$(ls -t "$BACKUP_LOCAL_DIR"/*.sql.gz 2>/dev/null | head -1)
  if [ -n "$latest_local" ]; then
    echo "$latest_local"
    return 0
  fi

  return 1
}

# Download backup from GCS if needed
resolve_backup_path() {
  local input="$1"

  # If it's a GCS path, download it
  if [[ "$input" == gs://* ]]; then
    if ! command -v gsutil &>/dev/null; then
      log_error "gsutil is required to download from GCS"
      exit 1
    fi

    mkdir -p "$TEMP_DIR"
    local filename=$(basename "$input")
    local local_path="${TEMP_DIR}/${filename}"

    log_info "Downloading from GCS: ${input}..."
    if gsutil cp "$input" "$local_path"; then
      log_success "Downloaded: ${filename}"
      echo "$local_path"
    else
      log_error "Failed to download from GCS"
      exit 1
    fi
    return 0
  fi

  # If it's just a filename, look for it locally
  if [ -f "$input" ]; then
    echo "$input"
    return 0
  fi

  if [ -f "${BACKUP_LOCAL_DIR}/${input}" ]; then
    echo "${BACKUP_LOCAL_DIR}/${input}"
    return 0
  fi

  # Try to find it in GCS
  if command -v gsutil &>/dev/null; then
    local gcs_path="gs://${BACKUP_GCS_BUCKET}/printyx-backup/${input}"
    if gsutil stat "$gcs_path" &>/dev/null; then
      mkdir -p "$TEMP_DIR"
      local local_path="${TEMP_DIR}/${input}"
      log_info "Found in GCS, downloading..."
      gsutil cp "$gcs_path" "$local_path"
      echo "$local_path"
      return 0
    fi
  fi

  log_error "Backup file not found: ${input}"
  log_error "Checked: local filesystem, ${BACKUP_LOCAL_DIR}/, and GCS bucket"
  exit 1
}

# ---- Main ----

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup-file> | --list | --latest"
  echo ""
  echo "Examples:"
  echo "  $0 printyx-backup-2026-02-19-020000.sql.gz"
  echo "  $0 gs://printyx-backups/printyx-backup/printyx-backup-2026-02-19-020000.sql.gz"
  echo "  $0 --list     List available backups"
  echo "  $0 --latest   Restore the most recent backup"
  exit 1
fi

case "$1" in
  --list|-l)
    list_backups
    exit 0
    ;;
  --latest)
    BACKUP_INPUT=$(get_latest_backup) || {
      log_error "No backups found"
      exit 1
    }
    log_info "Latest backup: ${BACKUP_INPUT}"
    ;;
  --help|-h)
    echo "Usage: $0 <backup-file> | --list | --latest"
    exit 0
    ;;
  *)
    BACKUP_INPUT="$1"
    ;;
esac

# Check for required tools
if ! command -v psql &>/dev/null; then
  log_error "psql is required for restore. Install PostgreSQL client tools."
  exit 1
fi

if ! command -v gunzip &>/dev/null; then
  log_error "gunzip is required for decompression."
  exit 1
fi

echo ""
echo "==========================================="
echo "  Printyx Database Restore"
echo "  $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "==========================================="
echo ""

# Resolve the backup file path (download from GCS if needed)
BACKUP_FILE=$(resolve_backup_path "$BACKUP_INPUT")
BACKUP_FILENAME=$(basename "$BACKUP_FILE")

log_info "Backup file: ${BACKUP_FILENAME}"
log_info "File size: $(du -h "$BACKUP_FILE" | cut -f1)"
log_info "Target database: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo ""
echo -e "${RED}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  WARNING: This will restore data to the database!   ║${NC}"
echo -e "${RED}║  Existing data may be overwritten.                  ║${NC}"
echo -e "${RED}║                                                     ║${NC}"
echo -e "${RED}║  Target: ${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Confirmation prompt
read -p "Are you sure you want to restore this backup? (type 'yes' to confirm): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  log_info "Restore cancelled by user"
  # Cleanup temp files
  rm -rf "$TEMP_DIR" 2>/dev/null || true
  exit 0
fi

# Second confirmation for production
if [ "$DB_HOST" = "209.145.59.219" ]; then
  echo ""
  echo -e "${RED}This appears to be the PRODUCTION database!${NC}"
  read -p "Type the database name to confirm production restore: " CONFIRM_DB
  if [ "$CONFIRM_DB" != "$DB_NAME" ]; then
    log_info "Restore cancelled - database name did not match"
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    exit 0
  fi
fi

log_info "Starting restore..."
start_time=$(date +%s)

# Decompress and restore
export PGPASSWORD="${DB_PASSWORD}"

mkdir -p "$TEMP_DIR"
SQL_FILE="${TEMP_DIR}/${BACKUP_FILENAME%.gz}"

log_info "Decompressing backup..."
gunzip -c "$BACKUP_FILE" > "$SQL_FILE"
log_success "Decompressed: $(du -h "$SQL_FILE" | cut -f1)"

log_info "Restoring to database..."
if psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --single-transaction \
  --set ON_ERROR_STOP=off \
  -f "$SQL_FILE" \
  > "${TEMP_DIR}/restore.log" 2>&1; then

  end_time=$(date +%s)
  duration=$((end_time - start_time))
  log_success "Restore completed in ${duration}s"
else
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  log_warn "Restore completed with warnings in ${duration}s (check ${TEMP_DIR}/restore.log)"
fi

unset PGPASSWORD

# Cleanup temp files
log_info "Cleaning up temporary files..."
rm -f "$SQL_FILE"
rm -rf "$TEMP_DIR" 2>/dev/null || true

echo ""
log_success "Database restore complete!"
echo ""
echo "Next steps:"
echo "  1. Verify data integrity: npm run check:system"
echo "  2. Run migrations if needed: npm run db:migrate"
echo "  3. Check application health: npm run dev"
echo ""
