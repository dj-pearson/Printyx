#!/usr/bin/env bash
#
# Printyx Database Backup Script
# US-031: Automated database backups with Google Cloud Storage
#
# Usage:
#   ./scripts/db-backup.sh                    # Backup main database
#   ./scripts/db-backup.sh --forecasting      # Backup forecasting database
#   ./scripts/db-backup.sh --all              # Backup both databases
#   ./scripts/db-backup.sh --retention        # Run retention cleanup after backup
#
# Environment variables (from .env or exported):
#   DATABASE_URL          - PostgreSQL connection string
#   DB_HOST               - Database host (fallback: 209.145.59.219)
#   DB_PORT               - Database port (fallback: 5433)
#   DB_USER               - Database user (fallback: postgres)
#   DB_PASSWORD            - Database password
#   DB_NAME               - Database name (fallback: postgres)
#   BACKUP_GCS_BUCKET     - GCS bucket name for backups
#   GOOGLE_APPLICATION_CREDENTIALS - Path to GCS service account key
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
DB_NAME="${DB_NAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKUP_GCS_BUCKET="${BACKUP_GCS_BUCKET:-printyx-backups}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date -u +"%Y-%m-%d-%H%M%S")

# Parse arguments
BACKUP_MAIN=true
BACKUP_FORECAST=false
RUN_RETENTION=false

for arg in "$@"; do
  case "$arg" in
    --forecasting)
      BACKUP_MAIN=false
      BACKUP_FORECAST=true
      ;;
    --all)
      BACKUP_MAIN=true
      BACKUP_FORECAST=true
      ;;
    --retention)
      RUN_RETENTION=true
      ;;
    --help|-h)
      echo "Usage: $0 [--forecasting] [--all] [--retention]"
      echo ""
      echo "Options:"
      echo "  --forecasting   Backup forecasting database only"
      echo "  --all           Backup both main and forecasting databases"
      echo "  --retention     Run retention cleanup after backup"
      echo "  -h, --help      Show this help message"
      exit 0
      ;;
  esac
done

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

# Ensure local backup directory exists
mkdir -p "$BACKUP_LOCAL_DIR"

# Check for required tools
check_tools() {
  local missing=()

  if ! command -v pg_dump &>/dev/null; then
    missing+=("pg_dump")
  fi

  if ! command -v gzip &>/dev/null; then
    missing+=("gzip")
  fi

  if ! command -v gsutil &>/dev/null; then
    log_warn "gsutil not found - backups will only be saved locally"
    log_warn "Install Google Cloud SDK for GCS uploads: https://cloud.google.com/sdk/docs/install"
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    log_error "Install PostgreSQL client tools and try again."
    exit 1
  fi
}

# Run a single database backup.
#
# LAUNCH-011: the third argument is an optional pg_dump --schema filter, and it
# is the whole reason the forecasting backup existed as a lie. This function was
# called as `run_backup "$DB_NAME" "printyx-forecast-backup"` with no filter, so
# it dumped the ENTIRE MAIN DATABASE and named the archive as the forecasting
# one - two 228K files, both 683 tables, neither containing anything from the
# forecasting schema, and the log reporting "Forecasting database backup
# successful". k8s/base/cronjob-backup.yaml has always passed
# `--schema=forecasting` and the runbook has always called it the "Forecasting
# schema", so the script an operator runs by hand and the job that runs nightly
# wrote DIFFERENT ARTIFACTS UNDER THE SAME NAME, into the same GCS folder.
# Restoring "the latest forecast backup" then depends on which ran last, and one
# of them is the whole main database.
run_backup() {
  local db_name="$1"
  local backup_prefix="$2"
  local schema="${3:-}"
  local backup_file="${backup_prefix}-${TIMESTAMP}.sql.gz"
  local local_path="${BACKUP_LOCAL_DIR}/${backup_file}"

  if [ -n "$schema" ]; then
    log_info "Starting backup of schema '${schema}' in database '${db_name}' on ${DB_HOST}:${DB_PORT}..."
  else
    log_info "Starting backup of database '${db_name}' on ${DB_HOST}:${DB_PORT}..."
  fi

  # Set password for pg_dump
  export PGPASSWORD="${DB_PASSWORD}"

  # Run pg_dump and compress with gzip
  local start_time=$(date +%s)

  # Built as an array so the optional --schema can be appended without a second
  # copy of the pg_dump call. Failure detection is already sound here and was
  # before this change: `set -euo pipefail` at the top of the file means the
  # `pg_dump | gzip` pipeline reports pg_dump's status, which was verified by
  # pointing this at a database that does not exist (exit 1, "backup FAILED",
  # no file left behind). The place that shape DOES bite is
  # k8s/base/cronjob-backup.yaml, where a `|| echo` swallows the status - see
  # the note there.
  local dump_args=(
    --host="$DB_HOST"
    --port="$DB_PORT"
    --username="$DB_USER"
    --dbname="$db_name"
    --format=plain
    --no-owner
    --no-privileges
    --verbose
  )
  [ -n "$schema" ] && dump_args+=(--schema="$schema")

  if pg_dump "${dump_args[@]}" \
    2>"${local_path%.sql.gz}.log" \
    | gzip -9 > "$local_path"; then

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local file_size=$(du -h "$local_path" | cut -f1)

    log_success "Backup completed in ${duration}s: ${backup_file} (${file_size})"
  else
    log_error "pg_dump failed for database '${db_name}'"
    cat "${local_path%.sql.gz}.log" 2>/dev/null
    rm -f "$local_path" "${local_path%.sql.gz}.log"
    return 1
  fi

  # Clean up log file
  rm -f "${local_path%.sql.gz}.log"

  # Upload to GCS if gsutil is available
  if command -v gsutil &>/dev/null; then
    local gcs_path="gs://${BACKUP_GCS_BUCKET}/${backup_prefix}/${backup_file}"

    log_info "Uploading to GCS: ${gcs_path}..."

    if gsutil cp "$local_path" "$gcs_path" 2>/dev/null; then
      log_success "Uploaded to GCS: ${gcs_path}"

      # Verify upload
      if gsutil stat "$gcs_path" &>/dev/null; then
        log_success "GCS upload verified"
      else
        log_warn "GCS upload verification failed - keeping local copy"
        return 0
      fi
    else
      log_warn "GCS upload failed - backup saved locally at: ${local_path}"
      return 0
    fi
  else
    log_info "Backup saved locally: ${local_path}"
  fi

  # Tag weekly backups (Sunday) and monthly backups (1st of month)
  local day_of_week=$(date -u +"%u") # 1=Monday, 7=Sunday
  local day_of_month=$(date -u +"%d")

  if command -v gsutil &>/dev/null; then
    if [ "$day_of_week" = "7" ]; then
      local weekly_path="gs://${BACKUP_GCS_BUCKET}/${backup_prefix}/weekly/${backup_file}"
      gsutil cp "gs://${BACKUP_GCS_BUCKET}/${backup_prefix}/${backup_file}" "$weekly_path" 2>/dev/null && \
        log_info "Tagged as weekly backup" || true
    fi

    if [ "$day_of_month" = "01" ]; then
      local monthly_path="gs://${BACKUP_GCS_BUCKET}/${backup_prefix}/monthly/${backup_file}"
      gsutil cp "gs://${BACKUP_GCS_BUCKET}/${backup_prefix}/${backup_file}" "$monthly_path" 2>/dev/null && \
        log_info "Tagged as monthly backup" || true
    fi
  fi

  unset PGPASSWORD
  return 0
}

# Retention cleanup
# LAUNCH-011: the LOCAL cleanup used to be `find -name '*.sql.gz' -mtime +7
# -delete`, which deletes EVERYTHING at seven days - including the Sunday and
# first-of-month archives the policy keeps for four weeks and twelve months. So
# a deployment without GCS, which this script explicitly supports ("backups will
# only be saved locally"), had no weekly and no monthly retention at all, while
# both this script and db-backup-list.sh printed the three-tier policy. Proven
# by aging four files: a 20-day-old weekly and a 100-day-old monthly were both
# deleted alongside the 20-day-old daily.
#
# The tier comes from the DATE IN THE FILENAME, which is the same thing the GCS
# branch below keys on, rather than from a weekly/ and monthly/ subdirectory -
# so one archive serves all three tiers instead of being copied three times.
prune_local_backups() {
  local now_epoch
  now_epoch=$(date -u +%s)
  local removed=0 kept=0

  shopt -s nullglob
  for file in "$BACKUP_LOCAL_DIR"/*.sql.gz; do
    local base file_date keep_days file_epoch age_days dom dow
    base=$(basename "$file")
    file_date=$(echo "$base" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)

    # No parseable date means no way to tier it. KEPT, not deleted: an archive
    # nobody can date is not an archive anybody should silently destroy.
    if [ -z "$file_date" ]; then
      kept=$((kept + 1))
      continue
    fi

    file_epoch=$(date -u -d "$file_date" +%s 2>/dev/null || echo "")
    if [ -z "$file_epoch" ]; then
      kept=$((kept + 1))
      continue
    fi

    age_days=$(( (now_epoch - file_epoch) / 86400 ))
    dom=$(date -u -d "$file_date" +%d)
    dow=$(date -u -d "$file_date" +%u)   # 1=Monday .. 7=Sunday

    if [ "$dom" = "01" ]; then
      keep_days=365                      # monthly: 12 months
    elif [ "$dow" = "7" ]; then
      keep_days=28                       # weekly: 4 weeks
    else
      keep_days=7                        # daily
    fi

    if [ "$age_days" -gt "$keep_days" ]; then
      rm -f "$file" && removed=$((removed + 1))
    else
      kept=$((kept + 1))
    fi
  done
  shopt -u nullglob

  log_info "Local retention: kept ${kept}, removed ${removed} (daily 7d, weekly 28d, monthly 365d)"
}

run_retention() {
  if ! command -v gsutil &>/dev/null; then
    log_warn "gsutil not available - skipping GCS retention cleanup"
    prune_local_backups
    log_success "Local retention cleanup complete"
    return 0
  fi

  local prefix="$1"
  log_info "Running retention cleanup for ${prefix}..."

  # Daily backups: keep 7 days
  log_info "Cleaning daily backups older than 7 days..."
  local cutoff_daily=$(date -u -d "7 days ago" +"%Y-%m-%d" 2>/dev/null || date -u -v-7d +"%Y-%m-%d" 2>/dev/null || echo "")
  if [ -n "$cutoff_daily" ]; then
    gsutil ls "gs://${BACKUP_GCS_BUCKET}/${prefix}/" 2>/dev/null | while read -r file; do
      local file_date=$(echo "$file" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)
      if [ -n "$file_date" ] && [[ "$file_date" < "$cutoff_daily" ]]; then
        gsutil rm "$file" 2>/dev/null && log_info "Removed old daily: $(basename "$file")" || true
      fi
    done
  fi

  # Weekly backups: keep 4 weeks
  log_info "Cleaning weekly backups older than 4 weeks..."
  local cutoff_weekly=$(date -u -d "28 days ago" +"%Y-%m-%d" 2>/dev/null || date -u -v-28d +"%Y-%m-%d" 2>/dev/null || echo "")
  if [ -n "$cutoff_weekly" ]; then
    gsutil ls "gs://${BACKUP_GCS_BUCKET}/${prefix}/weekly/" 2>/dev/null | while read -r file; do
      local file_date=$(echo "$file" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)
      if [ -n "$file_date" ] && [[ "$file_date" < "$cutoff_weekly" ]]; then
        gsutil rm "$file" 2>/dev/null && log_info "Removed old weekly: $(basename "$file")" || true
      fi
    done
  fi

  # Monthly backups: keep 12 months
  log_info "Cleaning monthly backups older than 12 months..."
  local cutoff_monthly=$(date -u -d "365 days ago" +"%Y-%m-%d" 2>/dev/null || date -u -v-365d +"%Y-%m-%d" 2>/dev/null || echo "")
  if [ -n "$cutoff_monthly" ]; then
    gsutil ls "gs://${BACKUP_GCS_BUCKET}/${prefix}/monthly/" 2>/dev/null | while read -r file; do
      local file_date=$(echo "$file" | grep -oP '\d{4}-\d{2}-\d{2}' | head -1)
      if [ -n "$file_date" ] && [[ "$file_date" < "$cutoff_monthly" ]]; then
        gsutil rm "$file" 2>/dev/null && log_info "Removed old monthly: $(basename "$file")" || true
      fi
    done
  fi

  prune_local_backups

  log_success "Retention cleanup complete for ${prefix}"
}

# List available backups
list_backups() {
  local prefix="${1:-printyx-backup}"

  if command -v gsutil &>/dev/null; then
    echo ""
    echo "=== GCS Backups (gs://${BACKUP_GCS_BUCKET}/${prefix}/) ==="
    echo ""
    echo "--- Daily ---"
    gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/${prefix}/*.sql.gz" 2>/dev/null || echo "  (none)"
    echo ""
    echo "--- Weekly ---"
    gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/${prefix}/weekly/*.sql.gz" 2>/dev/null || echo "  (none)"
    echo ""
    echo "--- Monthly ---"
    gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/${prefix}/monthly/*.sql.gz" 2>/dev/null || echo "  (none)"
  fi

  echo ""
  echo "=== Local Backups (${BACKUP_LOCAL_DIR}) ==="
  if ls "$BACKUP_LOCAL_DIR"/*.sql.gz &>/dev/null; then
    ls -lh "$BACKUP_LOCAL_DIR"/*.sql.gz
  else
    echo "  (none)"
  fi
}

# ---- Main ----

echo ""
echo "==========================================="
echo "  Printyx Database Backup"
echo "  $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "==========================================="
echo ""

check_tools

ERRORS=0

if [ "$BACKUP_MAIN" = true ]; then
  log_info "=== Main Database Backup ==="
  if run_backup "$DB_NAME" "printyx-backup"; then
    log_success "Main database backup successful"
  else
    log_error "Main database backup FAILED"
    ERRORS=$((ERRORS + 1))
  fi
  echo ""
fi

if [ "$BACKUP_FORECAST" = true ]; then
  log_info "=== Forecasting Database Backup ==="
  # The forecasting data is a SCHEMA inside the main database, which is what
  # the CronJob and the runbook have always said. BACKUP_FORECAST_SCHEMA exists
  # so a deployment that names it differently can say so rather than silently
  # dumping everything.
  if run_backup "$DB_NAME" "printyx-forecast-backup" "${BACKUP_FORECAST_SCHEMA:-forecasting}"; then
    log_success "Forecasting database backup successful"
  else
    log_error "Forecasting database backup FAILED"
    ERRORS=$((ERRORS + 1))
  fi
  echo ""
fi

if [ "$RUN_RETENTION" = true ]; then
  log_info "=== Retention Cleanup ==="
  run_retention "printyx-backup"
  if [ "$BACKUP_FORECAST" = true ]; then
    run_retention "printyx-forecast-backup"
  fi
  echo ""
fi

if [ $ERRORS -gt 0 ]; then
  log_error "$ERRORS backup(s) failed!"
  exit 1
else
  log_success "All backups completed successfully"
  exit 0
fi
