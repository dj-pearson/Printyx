#!/usr/bin/env bash
# Apply tenant Row-Level Security from drizzle/rls/ (PA-017).
#
# Codifies the manual psql flow documented in drizzle/rls/README.md into one
# idempotent pass so RLS is applied consistently instead of file-by-file by
# hand. Order matters and mirrors the file headers' dependencies:
#   1. apply-rls.sql        — installs the apply_tenant_rls() helper function
#   2. *-tables.sql         — per-domain table safety-net (idempotent replay)
#   3. <domain>.sql         — per-domain RLS policies (depend on 1 + 2)
#
# The policies key on the CORRECT JWT claim (app_metadata ->> 'tenantId'); the
# old root setup-rls-policies.sql used snake_case tenant_id (always NULL) and
# was removed.
#
# Requires: psql on PATH and DATABASE_URL set. Test against staging first —
# enabling RLS with a wrong policy can deny access.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
RLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../drizzle/rls" && pwd)"

run() {
  echo "→ $(basename "$1")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$1"
}

# 1. Helper function
run "$RLS_DIR/apply-rls.sql"

# 2. Per-domain table safety-nets
for f in "$RLS_DIR"/*-tables.sql; do
  [ -e "$f" ] && run "$f"
done

# 3. Per-domain RLS policies (skip helper, template, operator-only, and tables)
for f in "$RLS_DIR"/*.sql; do
  case "$(basename "$f")" in
    apply-rls.sql | _template.sql | service-role.sql | *-tables.sql) continue ;;
  esac
  run "$f"
done

echo "✓ RLS applied. Verify: SELECT relname, relrowsecurity FROM pg_class WHERE relrowsecurity;"
