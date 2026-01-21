# Self-Hosted Supabase Migration Audit Report

**Date:** 2025-12-18
**Status:** Migration Complete with Minor Fixes Needed

## Executive Summary

The Printyx codebase has been audited for proper routing to the self-hosted Supabase infrastructure:

- **Edge Functions:** Route to `functions.printyx.net`
- **Kong/API:** Route to `api.printyx.net`
- **Database:** Connect to `209.145.59.219:5433` (Supavisor pooler)

---

## 1. Edge Functions Inventory

### Supabase Edge Functions (Deno-based)

**Location:** `supabase/functions/`

| Function | Path                | JWT Required | Purpose                                    |
| -------- | ------------------- | ------------ | ------------------------------------------ |
| `hello`  | `/functions/hello`  | No           | Sample/test function                       |
| `signup` | `/functions/signup` | No           | User registration & tenant creation        |
| `me`     | `/functions/me`     | Yes          | Current user profile with role/permissions |

**Shared Utilities:**

- `_shared/cors.ts` - CORS handling with allowed origins: `printyx.net`, `www.printyx.net`, `localhost:5173`, `localhost:5000`
- `_shared/supabase.ts` - Supabase client factory

**Configuration:** `supabase/functions/config.toml`

### Cloudflare Pages Functions (Proxy Layer)

**Location:** `functions/`

| Function              | Path           | Proxies To                    |
| --------------------- | -------------- | ----------------------------- |
| `[[path]].ts`         | `/functions/*` | `${SUPABASE_URL}/functions/*` |
| `rest/[[path]].ts`    | `/rest/*`      | `${SUPABASE_URL}/rest/*`      |
| `storage/[[path]].ts` | `/storage/*`   | `${SUPABASE_URL}/storage/*`   |
| `auth/[[path]].ts`    | `/auth/*`      | `${SUPABASE_URL}/auth/*`      |

---

## 2. Files Requiring Fixes (Neon References)

### High Priority - Active Code Files

| File                            | Issue                                             | Fix Required                                          |
| ------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `create-test-user.ts:10`        | `import { Pool } from '@neondatabase/serverless'` | Change to `import pg from 'pg'; const { Pool } = pg;` |
| `test-auth-connection.ts:10-11` | Neon Pool and Drizzle imports                     | Change to standard `pg` module                        |
| `export-database.js:3,7`        | `import { neon }` from Neon SDK                   | Change to standard `pg` Pool                          |
| `export-csv.js:3,6`             | `import { neon }` from Neon SDK                   | Change to standard `pg` Pool                          |
| `export-simple.js:3,6`          | `import { neon }` from Neon SDK                   | Change to standard `pg` Pool                          |

### Low Priority - Documentation Only

| File                                      | Line                           | Context                             |
| ----------------------------------------- | ------------------------------ | ----------------------------------- |
| `server/lib/connection-resilience.ts:118` | Comment mentioning Neon errors | Cosmetic update                     |
| `scripts/migrate-users-to-supabase.ts`    | Comments about legacy Neon     | Historical documentation (accurate) |

---

## 3. Environment Variables Reference

### Database Configuration (Required)

```env
# Primary connection string
DATABASE_URL=postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres

# Or individual components
DB_HOST=209.145.59.219
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=postgres

# SSL for self-hosted Supabase
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

### Supabase Configuration (Required)

```env
# Server-side
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_FUNCTIONS_URL=https://functions.printyx.net

# Client-side (Vite)
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_FUNCTIONS_URL=https://functions.printyx.net
VITE_AUTH_MODE=supabase
VITE_USE_SUPABASE_PROXY=false
```

### Session & Auth (Required)

```env
SESSION_SECRET=your_session_secret
DEMO_TENANT_ID=550e8400-e29b-41d4-a716-446655440000
```

### AI Services

```env
# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_key
CLAUDE_API_KEY=your_claude_key  # Alternative name used in some services

# OpenAI
OPENAI_API_KEY=your_openai_key
```

### Payment Processing

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Email & SMS

```env
# Email (choose one provider)
EMAIL_PROVIDER=sendgrid|resend|ses
SENDGRID_API_KEY=SG....
RESEND_API_KEY=re_...

# SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

### Third-Party Integrations

```env
# Salesforce
SALESFORCE_CLIENT_ID=...
SALESFORCE_CLIENT_SECRET=...

# QuickBooks
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...

# Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Microsoft Calendar
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...

# Lead Enrichment
APOLLOIO_API_KEY=...
```

### Monitoring & Logging

```env
# APM
APM_PROVIDER=sentry
SENTRY_DSN=https://...@sentry.io/...

# Logging
LOG_LEVEL=info
LOG_TRANSPORT=console
```

### Connection Resilience

```env
# Pool settings
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_CONNECTION_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=30000

# Retry settings
DB_MAX_RETRIES=5
DB_RETRY_BASE_DELAY_MS=1000
DB_RETRY_MAX_DELAY_MS=30000

# Circuit breaker
DB_CIRCUIT_FAILURE_THRESHOLD=5
DB_CIRCUIT_RECOVERY_TIMEOUT_MS=30000
```

---

## 4. Database Connection Architecture

### Primary Configuration (`server/db.ts`)

The main database connection is **correctly configured** for self-hosted Supabase:

```typescript
// Uses standard pg module (NOT Neon serverless)
import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
```

**Features:**

- Connection pooling (2-20 connections)
- SSL support with self-signed certificate handling
- Circuit breaker for failure protection
- Retry with exponential backoff
- Health check endpoints

### SSL Configuration

For self-hosted Supabase with self-signed certificates:

```env
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

For production with proper SSL:

```env
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

---

## 5. API Routing Architecture

### Backend Routes → `api.printyx.net`

All Express routes are served through Kong at `api.printyx.net`:

| Category         | Base Path                 | Description              |
| ---------------- | ------------------------- | ------------------------ |
| Auth             | `/api/auth/*`             | Authentication endpoints |
| Business Records | `/api/business-records/*` | CRM data                 |
| Service          | `/api/service/*`          | Service dispatch         |
| Billing          | `/api/billing/*`          | Invoice/billing          |
| Integrations     | `/api/integrations/*`     | Third-party integrations |

### Edge Functions → `functions.printyx.net`

Supabase Edge Functions are served at `functions.printyx.net`:

| Function | URL                                    |
| -------- | -------------------------------------- |
| Signup   | `https://functions.printyx.net/signup` |
| Me       | `https://functions.printyx.net/me`     |
| Hello    | `https://functions.printyx.net/hello`  |

### Client Configuration

The frontend is configured in `client/src/lib/config.ts`:

```typescript
export const config = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || 'https://api.printyx.net',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    functionsUrl: import.meta.env.VITE_FUNCTIONS_URL || 'https://functions.printyx.net',
  },
  // ...
};
```

---

## 6. Deployment Configuration

### Docker for Edge Functions

**File:** `Dockerfile.edge-functions`

```dockerfile
FROM denoland/deno:1.38.5
# ... copies supabase/functions/
EXPOSE 3001
```

**Environment Variables for Edge Functions Container:**

```env
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3001
```

### Cloudflare Pages

For Cloudflare Pages deployment, the proxy functions in `functions/` route requests to the self-hosted Supabase:

**Environment Variables for Cloudflare:**

```env
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_FUNCTIONS_URL=https://functions.printyx.net
```

---

## 7. Migration Checklist

### Completed

- [x] Main database connection (`server/db.ts`) uses standard `pg` module
- [x] Supabase auth middleware configured for self-hosted
- [x] Edge functions deployed to `functions.printyx.net`
- [x] Frontend configured with correct URLs
- [x] CORS configured for `printyx.net` domains
- [x] RLS policies created for tenant isolation
- [x] Docker configuration for edge functions
- [x] `.env.example` updated with self-hosted configuration

### Needs Fixing

- [ ] `create-test-user.ts` - Replace Neon imports
- [ ] `test-auth-connection.ts` - Replace Neon imports
- [ ] `export-database.js` - Replace Neon SDK
- [ ] `export-csv.js` - Replace Neon SDK
- [ ] `export-simple.js` - Replace Neon SDK

### Recommended

- [ ] Remove `@neondatabase/serverless` from `package.json` after fixes
- [ ] Update comment in `server/lib/connection-resilience.ts:118`

---

## 8. Troubleshooting

### Connection Issues

**`ECONNREFUSED`:**

- Check port: Use `5433` for Supavisor pooler, `5432` for direct
- Verify host: `209.145.59.219`
- Check firewall rules

**`Connection terminated unexpectedly`:**

- Enable SSL: Set `DB_SSL=true`
- For self-signed certs: Set `DB_SSL_REJECT_UNAUTHORIZED=false`

**`Authentication failed`:**

- Verify `DB_PASSWORD` is correct
- Check user permissions in PostgreSQL

### JWT Issues

**`401 Unauthorized`:**

- Verify `SUPABASE_JWT_SECRET` matches Supabase configuration
- Check token is being sent in `Authorization: Bearer <token>` header
- Verify token hasn't expired

**`Tenant not found`:**

- Ensure `x-tenant-id` header is set OR
- User's `app_metadata.tenantId` is set in Supabase

---

## 9. Security Considerations

### Keys to Keep Secret (Server-Only)

- `SUPABASE_SERVICE_ROLE_KEY` - Never expose to client
- `SUPABASE_JWT_SECRET` - Never expose to client
- `DB_PASSWORD` - Never expose to client
- `STRIPE_SECRET_KEY` - Never expose to client

### Keys Safe for Client

- `VITE_SUPABASE_URL` - Public URL
- `VITE_SUPABASE_ANON_KEY` - Designed for client-side use
- `VITE_FUNCTIONS_URL` - Public URL

### RLS Enforcement

Row-Level Security is enforced at the database level:

- All tables with `tenant_id` column have RLS policies
- Helper functions in `auth` schema extract tenant from JWT
- Service role bypasses RLS (use only server-side)

---

## 10. Files Reference

### Core Database

- `server/db.ts` - Main database connection (correctly configured)
- `shared/schema.ts` - Drizzle ORM schema (293KB)

### Supabase Auth

- `server/middleware/supabase-auth.ts` - JWT validation middleware
- `server/utils/auth-helpers.ts` - Unified auth utilities
- `client/src/lib/supabase.ts` - Client-side Supabase client
- `client/src/hooks/useSupabaseAuth.ts` - Auth state hook

### Edge Functions

- `supabase/functions/signup/index.ts` - User registration
- `supabase/functions/me/index.ts` - Current user profile
- `supabase/functions/_shared/supabase.ts` - Client factory
- `supabase/functions/_shared/cors.ts` - CORS handling

### Configuration

- `.env.example` - Environment variable reference
- `drizzle.config.ts` - Drizzle migration config
- `client/src/lib/config.ts` - Frontend configuration
