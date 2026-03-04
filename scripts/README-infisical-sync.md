# Push Supabase Env Vars to Infisical

Script to sync environment variables (e.g. from Coolify/Supabase `.env`) into an Infisical project. Run via SSH on your Coolify server.

## Prerequisites

1. **Infisical CLI** installed on the Coolify server:
   ```bash
   curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash
   sudo apt-get install infisical
   ```

2. **Infisical token** (machine identity or service token):
   - Create in Infisical: Organization → Machine Identities (or use a Service Token)
   - Token needs write access to the target project

3. **Project ID** from your Infisical project (Settings → General)

## Quick One-Liner (SSH)

Push `DB_PASSWORD` from your env to Infisical as `INFISICAL_CONTAINER`:

```bash
ssh user@coolify-server 'cd /path/to/supabase-env && \
  export INFISICAL_TOKEN="YOUR_TOKEN" && \
  export INFISICAL_PROJECT_ID="YOUR_PROJECT_ID" && \
  source .env 2>/dev/null || true && \
  infisical secrets set INFISICAL_CONTAINER="$DB_PASSWORD" \
    --projectId="$INFISICAL_PROJECT_ID" \
    --env=prod \
    --path=/ \
    --silent'
```

**Important**: Use env vars for `INFISICAL_TOKEN` and `INFISICAL_PROJECT_ID`—never hardcode secrets. Store them in Infisical, a vault, or your CI/CD secrets.

## Using the Script

1. Copy `push-env-to-infisical.sh` to your Coolify server
2. Set required env vars (from a vault, Infisical, or secure storage):

```bash
export INFISICAL_TOKEN="..."           # From Infisical machine identity
export INFISICAL_PROJECT_ID="..."     # Your Infisical project ID
```

3. Optionally load your Supabase `.env`:
   ```bash
   cd /path/to/your/supabase-config
   source .env
   ```

4. Run the script:
   ```bash
   chmod +x push-env-to-infisical.sh
   ./push-env-to-infisical.sh
   ```

### Custom Mapping

Map multiple vars with `MAPPING` (format: `SOURCE:TARGET`):

```bash
export MAPPING="DB_PASSWORD:INFISICAL_CONTAINER DATABASE_URL:DATABASE_URL SUPABASE_SERVICE_ROLE_KEY:SUPABASE_SERVICE_ROLE_KEY"
./push-env-to-infisical.sh
```

### Push Entire .env File

Infisical CLI can push directly from a file:

```bash
export INFISICAL_TOKEN="..."
export INFISICAL_PROJECT_ID="..."
infisical secrets set --file=./.env \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env=prod \
  --path=/ \
  --silent
```

## SSH + Script Example

```bash
# From your local machine
scp scripts/push-env-to-infisical.sh user@coolify-server:/tmp/

ssh user@coolify-server '
  cd /path/to/supabase-env
  export INFISICAL_TOKEN="'"$INFISICAL_TOKEN"'"
  export INFISICAL_PROJECT_ID="'"$INFISICAL_PROJECT_ID"'"
  source .env 2>/dev/null || true
  bash /tmp/push-env-to-infisical.sh
'
```

Store `INFISICAL_TOKEN` and `INFISICAL_PROJECT_ID` in your local env or a secrets manager; avoid hardcoding.

## Cron / Automation

For periodic sync, add a cron job on the Coolify server. Use a machine identity with minimal permissions:

```bash
# Fetch token via machine identity (recommended for automation)
export INFISICAL_TOKEN=$(infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent --plain)
```
