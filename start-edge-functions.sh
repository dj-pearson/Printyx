#!/bin/sh
# Startup script for the Supabase Edge Functions container.
#
# Secrets are pulled from self-hosted Infisical (env.dpearsonmedia.com) at boot
# and injected into the Deno process as env vars, so Deno.env.get('CLAUDE_API_KEY')
# (and SUPABASE_*, etc.) resolve without those values living in Coolify.
#
# Bootstrap env vars (the ONLY values that live in Coolify):
#   INFISICAL_API_URL              - https://env.dpearsonmedia.com
#   INFISICAL_MACHINE_CLIENT_ID    - Universal Auth client ID for this service
#   INFISICAL_MACHINE_CLIENT_SECRET- Universal Auth client secret
#   INFISICAL_PROJECT_ID           - Infisical project ID (Printyx)
#   INFISICAL_SECRET_ENV           - env slug to pull (defaults to "prod")
set -e

echo "======================================"
echo "Container ID: $(hostname)"
echo "Process ID: $$"
echo "Port: ${PORT:-8000}"
echo "Starting Supabase Edge Functions Server..."
echo "Available functions:"
ls -la /app/functions/
echo ""

if [ -n "$INFISICAL_MACHINE_CLIENT_ID" ]; then
  echo "Authenticating to Infisical at ${INFISICAL_API_URL}..."
  INFISICAL_TOKEN=$(infisical login --method=universal-auth \
    --client-id="$INFISICAL_MACHINE_CLIENT_ID" \
    --client-secret="$INFISICAL_MACHINE_CLIENT_SECRET" \
    --domain="$INFISICAL_API_URL" --plain --silent)
  export INFISICAL_TOKEN

  echo "Starting Deno server on port ${PORT:-8000} with Infisical-injected secrets..."
  echo "======================================"
  exec infisical run --token "$INFISICAL_TOKEN" \
    --projectId "$INFISICAL_PROJECT_ID" \
    --env "${INFISICAL_SECRET_ENV:-prod}" \
    --domain "$INFISICAL_API_URL" \
    -- deno run --allow-all /app/server.ts
else
  echo "INFISICAL_MACHINE_CLIENT_ID not set - starting with container env only (no Infisical injection)."
  echo "Starting Deno server on port ${PORT:-8000}..."
  echo "======================================"
  exec deno run --allow-all /app/server.ts
fi
