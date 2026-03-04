#!/usr/bin/env bash
#
# Push environment variables to Infisical
# Usage: Run on Coolify server via SSH, or locally with .env sourced
#
# Required env vars (set before running or in .env):
#   INFISICAL_TOKEN       - Machine identity or service token
#   INFISICAL_PROJECT_ID  - Target Infisical project ID
#   DB_PASSWORD           - Source value to push (or other vars)
#
# Optional:
#   INFISICAL_ENV         - Environment slug (dev, prod, staging) [default: prod]
#   INFISICAL_PATH        - Secret path in project [default: /]
#
# Example mapping: DB_PASSWORD -> INFISICAL_CONTAINER (or any target key)
# Set MAPPING as "SOURCE_KEY:TARGET_KEY" pairs, space-separated
#

set -euo pipefail

# --- Configuration (override via env) ---
INFISICAL_ENV="${INFISICAL_ENV:-prod}"
INFISICAL_PATH="${INFISICAL_PATH:-/}"

# Mapping: SOURCE_ENV_VAR:TARGET_INFISICAL_KEY
# Add more as needed: "DB_PASSWORD:INFISICAL_CONTAINER" "DATABASE_URL:DATABASE_URL"
MAPPING="${MAPPING:-DB_PASSWORD:INFISICAL_CONTAINER}"

# --- Validation ---
if [[ -z "${INFISICAL_TOKEN:-}" ]]; then
  echo "ERROR: INFISICAL_TOKEN is required" >&2
  exit 1
fi

if [[ -z "${INFISICAL_PROJECT_ID:-}" ]]; then
  echo "ERROR: INFISICAL_PROJECT_ID is required" >&2
  exit 1
fi

# --- Load .env if present (optional) ---
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# --- Build secrets set args ---
export INFISICAL_DISABLE_UPDATE_CHECK=true
ARGS=()
CLEANUP_FILES=()

for pair in $MAPPING; do
  source_key="${pair%%:*}"
  target_key="${pair##*:}"
  value="${!source_key:-}"

  if [[ -z "$value" ]]; then
    echo "WARN: $source_key is empty or unset, skipping" >&2
    continue
  fi

  # Use temp file for values with special chars (spaces, quotes, newlines)
  if [[ "$value" == *$'\n'* ]] || [[ "$value" == *'"'* ]] || [[ "$value" == *"'"* ]] || [[ "$value" == *'='* ]]; then
    tmpfile=$(mktemp)
    printf '%s' "$value" > "$tmpfile"
    ARGS+=("${target_key}=@${tmpfile}")
    CLEANUP_FILES+=("$tmpfile")
  else
    ARGS+=("${target_key}=${value}")
  fi
done

# Cleanup temp files on exit
cleanup() {
  for f in "${CLEANUP_FILES[@]:-}"; do
    rm -f "$f"
  done
}
trap cleanup EXIT

if [[ ${#ARGS[@]} -eq 0 ]]; then
  echo "ERROR: No secrets to push (all source vars empty?)" >&2
  exit 1
fi

# --- Push to Infisical ---
echo "Pushing ${#ARGS[@]} secret(s) to Infisical project $INFISICAL_PROJECT_ID ($INFISICAL_ENV)..." >&2
infisical secrets set "${ARGS[@]}" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --path="$INFISICAL_PATH" \
  --silent

echo "Done." >&2
