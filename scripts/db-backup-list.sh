#!/usr/bin/env bash
#
# Printyx Database Backup List
# Lists all available backups from GCS and local storage.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env" 2>/dev/null || true
  set +a
fi

BACKUP_GCS_BUCKET="${BACKUP_GCS_BUCKET:-printyx-backups}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-$PROJECT_ROOT/backups}"

echo ""
echo "==========================================="
echo "  Printyx Database Backups"
echo "  $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "==========================================="

# GCS Backups
if command -v gsutil &>/dev/null; then
  echo ""
  echo "=== Main Database Backups (GCS) ==="
  echo ""
  echo "--- Daily (last 7) ---"
  gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-backup/*.sql.gz" 2>/dev/null | tail -8 || echo "  (none)"
  echo ""
  echo "--- Weekly (last 4) ---"
  gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-backup/weekly/*.sql.gz" 2>/dev/null | tail -5 || echo "  (none)"
  echo ""
  echo "--- Monthly (last 12) ---"
  gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-backup/monthly/*.sql.gz" 2>/dev/null | tail -13 || echo "  (none)"

  echo ""
  echo "=== Forecasting Database Backups (GCS) ==="
  echo ""
  echo "--- Daily (last 7) ---"
  gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-forecast-backup/*.sql.gz" 2>/dev/null | tail -8 || echo "  (none)"
  echo ""
  echo "--- Weekly (last 4) ---"
  gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-forecast-backup/weekly/*.sql.gz" 2>/dev/null | tail -5 || echo "  (none)"
  echo ""
  echo "--- Monthly (last 12) ---"
  gsutil ls -l "gs://${BACKUP_GCS_BUCKET}/printyx-forecast-backup/monthly/*.sql.gz" 2>/dev/null | tail -13 || echo "  (none)"
else
  echo ""
  echo "(gsutil not available - install Google Cloud SDK for GCS backup listing)"
fi

# Local backups
echo ""
echo "=== Local Backups (${BACKUP_LOCAL_DIR}/) ==="
echo ""
if ls "$BACKUP_LOCAL_DIR"/*.sql.gz &>/dev/null 2>&1; then
  ls -lht "$BACKUP_LOCAL_DIR"/*.sql.gz
else
  echo "  (none)"
fi

echo ""
echo "=== Retention Policy ==="
echo "  Daily:   7 days"
echo "  Weekly:  4 weeks (Sunday backups)"
echo "  Monthly: 12 months (1st of month backups)"
echo ""
