# Environment Variables Reference

This document provides a comprehensive list of all environment variables used across the Printyx platform, including server-side variables, client-side (Vite) variables, and Supabase Edge Function variables.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Server-Side Variables (process.env)](#server-side-variables-processenv)
   - [Database Configuration](#database-configuration)
   - [Supabase Configuration](#supabase-configuration)
   - [Session & Security](#session--security)
   - [Application Settings](#application-settings)
   - [Stripe Payment Integration](#stripe-payment-integration)
   - [AI Services](#ai-services)
   - [Email Services](#email-services)
   - [SMS Services](#sms-services)
   - [Third-Party Integrations](#third-party-integrations)
   - [Monitoring & Logging](#monitoring--logging)
   - [Secrets Management](#secrets-management)
   - [SEO & Knowledge Base](#seo--knowledge-base)
3. [Client-Side Variables (import.meta.env / VITE\_)](#client-side-variables-importmetaenv--vite_)
4. [Supabase Edge Function Variables (Deno.env)](#supabase-edge-function-variables-denoenv)
5. [Variable Setup by Environment](#variable-setup-by-environment)

---

## Quick Reference

| Category | Variable                    | Required               | Where to Set                     |
| -------- | --------------------------- | ---------------------- | -------------------------------- |
| Database | `DATABASE_URL`              | **Yes**                | Server `.env`                    |
| Supabase | `SUPABASE_URL`              | **Yes**                | Server `.env` + Supabase Secrets |
| Supabase | `SUPABASE_ANON_KEY`         | **Yes**                | Server `.env` + Supabase Secrets |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | **Yes**                | Server `.env` + Supabase Secrets |
| Auth     | `SESSION_SECRET`            | **Yes** (production)   | Server `.env`                    |
| Stripe   | `STRIPE_SECRET_KEY`         | **Yes** (for payments) | Server `.env`                    |
| Client   | `VITE_SUPABASE_URL`         | **Yes**                | Client `.env` / Build            |
| Client   | `VITE_SUPABASE_ANON_KEY`    | **Yes**                | Client `.env` / Build            |

---

## Server-Side Variables (process.env)

These variables are read on the Node.js server using `process.env.VARIABLE_NAME`.

### Database Configuration

| Variable                     | Required | Format                                          | Description                                                                          |
| ---------------------------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`               | **Yes**  | `postgresql://USER:PASSWORD@HOST:PORT/DATABASE` | Primary PostgreSQL connection string. Use port 5433 for Supabase Pooler (Supavisor). |
| `DB_HOST`                    | No       | `hostname`                                      | Alternative: Database host (e.g., `209.145.59.219`)                                  |
| `DB_PORT`                    | No       | `number`                                        | Alternative: Database port (default: `5432`, pooler: `5433`)                         |
| `DB_USER`                    | No       | `string`                                        | Alternative: Database username                                                       |
| `DB_PASSWORD`                | No       | `string`                                        | Alternative: Database password                                                       |
| `DB_NAME`                    | No       | `string`                                        | Alternative: Database name (default: `postgres`)                                     |
| `DB_SSL`                     | No       | `true` / `false`                                | Enable SSL connections (default: `true` in production)                               |
| `DB_SSL_REJECT_UNAUTHORIZED` | No       | `true` / `false`                                | Accept self-signed certs (set `false` for self-hosted Supabase)                      |

**Connection Pool Settings:**

| Variable                     | Required | Format           | Default | Description                                         |
| ---------------------------- | -------- | ---------------- | ------- | --------------------------------------------------- |
| `DB_POOL_MAX`                | No       | `number`         | `20`    | Maximum connections in pool                         |
| `DB_POOL_MIN`                | No       | `number`         | `2`     | Minimum connections in pool                         |
| `DB_CONNECTION_TIMEOUT_MS`   | No       | `number`         | `10000` | Connection timeout (ms)                             |
| `DB_IDLE_TIMEOUT_MS`         | No       | `number`         | `30000` | Idle connection timeout (ms)                        |
| `DB_LOG_QUERIES`             | No       | `true` / `false` | `true`  | Enable query logging                                |
| `DB_LOG_PARAMS`              | No       | `true` / `false` | `false` | Log query parameters (⚠️ may expose sensitive data) |
| `DB_SLOW_QUERY_THRESHOLD_MS` | No       | `number`         | `1000`  | Slow query threshold (ms)                           |

**Retry & Circuit Breaker Settings:**

| Variable                          | Required | Format   | Default | Description                   |
| --------------------------------- | -------- | -------- | ------- | ----------------------------- |
| `DB_MAX_RETRIES`                  | No       | `number` | `5`     | Max retry attempts            |
| `DB_RETRY_BASE_DELAY_MS`          | No       | `number` | `1000`  | Base delay between retries    |
| `DB_RETRY_MAX_DELAY_MS`           | No       | `number` | `30000` | Max delay between retries     |
| `DB_RETRY_JITTER_FACTOR`          | No       | `number` | `0.3`   | Jitter factor for retries     |
| `DB_CIRCUIT_FAILURE_THRESHOLD`    | No       | `number` | `5`     | Failures before circuit opens |
| `DB_CIRCUIT_RECOVERY_TIMEOUT_MS`  | No       | `number` | `30000` | Recovery timeout              |
| `DB_CIRCUIT_HALF_OPEN_REQUESTS`   | No       | `number` | `3`     | Half-open test requests       |
| `DB_CIRCUIT_MONITORING_WINDOW_MS` | No       | `number` | `60000` | Monitoring window             |

---

### Supabase Configuration

| Variable                    | Required | Format                                       | Description                                                                    |
| --------------------------- | -------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `SUPABASE_URL`              | **Yes**  | `https://your-project.supabase.co`           | Supabase API URL (e.g., `https://api.printyx.net`)                             |
| `SUPABASE_ANON_KEY`         | **Yes**  | JWT string                                   | Supabase anonymous/public key (safe to expose)                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes**  | JWT string                                   | Supabase service role key (**server-side only, keep secret!**)                 |
| `SUPABASE_JWT_SECRET`       | No       | `string`                                     | JWT secret for local verification (optional - validates JWTs without API call) |
| `SUPABASE_FUNCTIONS_URL`    | No       | `https://functions.your-project.supabase.co` | Edge Functions URL                                                             |

---

### Session & Security

| Variable                 | Required       | Format                    | Description                               |
| ------------------------ | -------------- | ------------------------- | ----------------------------------------- |
| `SESSION_SECRET`         | **Yes** (prod) | Random string (32+ chars) | Session encryption secret                 |
| `COOKIE_DOMAIN`          | No             | `.yourdomain.com`         | Cookie domain for cross-subdomain auth    |
| `ENCRYPTION_KEY`         | No             | Hex string (64 chars)     | AES-256 encryption key for sensitive data |
| `ARCHIVE_ENCRYPTION_KEY` | No             | Buffer/Hex                | Encryption key for audit log archives     |

---

### Application Settings

| Variable             | Required | Format                                | Description                                       |
| -------------------- | -------- | ------------------------------------- | ------------------------------------------------- |
| `NODE_ENV`           | No       | `development` / `production` / `test` | Environment mode (default: `development`)         |
| `PORT`               | No       | `number`                              | Server port (default: `5000`)                     |
| `BASE_URL`           | No       | `https://yourdomain.com`              | Public base URL                                   |
| `CLIENT_URL`         | No       | `https://app.yourdomain.com`          | Frontend application URL                          |
| `PUBLIC_URL`         | No       | `https://yourdomain.com`              | Public URL for emails/links                       |
| `DEMO_TENANT_ID`     | No       | UUID                                  | Demo/fallback tenant ID                           |
| `DEMO_USER_PASSWORD` | No       | `string`                              | Demo user password (dev only)                     |
| `WINDOWS_COMPAT`     | No       | `true` / `false`                      | Enable Windows compatibility (disables reusePort) |
| `LEGACY_LOGGING`     | No       | `true` / `false`                      | Enable legacy console.log format                  |
| `TEST_MODE`          | No       | `true` / `false`                      | Enable test mode (for Playwright tests)           |
| `TEST_AUTH_SECRET`   | No       | `string`                              | Test authentication secret                        |

---

### Stripe Payment Integration

| Variable                 | Required           | Format                         | Description               |
| ------------------------ | ------------------ | ------------------------------ | ------------------------- |
| `STRIPE_SECRET_KEY`      | **Yes** (payments) | `sk_test_...` or `sk_live_...` | Stripe secret API key     |
| `STRIPE_PUBLISHABLE_KEY` | **Yes** (payments) | `pk_test_...` or `pk_live_...` | Stripe publishable key    |
| `STRIPE_WEBHOOK_SECRET`  | **Yes** (webhooks) | `whsec_...`                    | Webhook endpoint secret   |
| `STRIPE_CLIENT_ID`       | No                 | `ca_...`                       | Stripe Connect client ID  |
| `STRIPE_REDIRECT_URI`    | No                 | URL                            | Stripe OAuth redirect URI |

**Checkout URLs:**

| Variable                      | Required | Format | Description                |
| ----------------------------- | -------- | ------ | -------------------------- |
| `STRIPE_CHECKOUT_SUCCESS_URL` | No       | URL    | Success redirect URL       |
| `STRIPE_CHECKOUT_CANCEL_URL`  | No       | URL    | Cancel redirect URL        |
| `STRIPE_PORTAL_RETURN_URL`    | No       | URL    | Customer portal return URL |

**Subscription Products & Prices:**

Generate these using `npm run stripe:setup` or PowerShell script `scripts/setup-stripe-products.ps1`.

| Variable                            | Required | Format      | Description                               |
| ----------------------------------- | -------- | ----------- | ----------------------------------------- |
| `STRIPE_STARTER_PRODUCT_ID`         | No       | `prod_...`  | Starter plan product ID                   |
| `STRIPE_STARTER_PRICE_MONTHLY`      | No       | `price_...` | Starter monthly price ID ($79/month)      |
| `STRIPE_STARTER_PRICE_ANNUAL`       | No       | `price_...` | Starter annual price ID ($758/year)       |
| `STRIPE_PROFESSIONAL_PRODUCT_ID`    | No       | `prod_...`  | Professional plan product ID              |
| `STRIPE_PROFESSIONAL_PRICE_MONTHLY` | No       | `price_...` | Professional monthly price ID ($99/month) |
| `STRIPE_PROFESSIONAL_PRICE_ANNUAL`  | No       | `price_...` | Professional annual price ID ($950/year)  |
| `STRIPE_ENTERPRISE_PRODUCT_ID`      | No       | `prod_...`  | Enterprise plan product ID                |
| `STRIPE_ENTERPRISE_PRICE_MONTHLY`   | No       | `price_...` | Enterprise monthly price ID ($149/month)  |
| `STRIPE_ENTERPRISE_PRICE_ANNUAL`    | No       | `price_...` | Enterprise annual price ID ($1430/year)   |

**Payment Links:**

| Variable                           | Required | Format | Description                       |
| ---------------------------------- | -------- | ------ | --------------------------------- |
| `STRIPE_STARTER_LINK_MONTHLY`      | No       | URL    | Starter monthly payment link      |
| `STRIPE_STARTER_LINK_ANNUAL`       | No       | URL    | Starter annual payment link       |
| `STRIPE_PROFESSIONAL_LINK_MONTHLY` | No       | URL    | Professional monthly payment link |
| `STRIPE_PROFESSIONAL_LINK_ANNUAL`  | No       | URL    | Professional annual payment link  |
| `STRIPE_ENTERPRISE_LINK_MONTHLY`   | No       | URL    | Enterprise monthly payment link   |
| `STRIPE_ENTERPRISE_LINK_ANNUAL`    | No       | URL    | Enterprise annual payment link    |

---

### AI Services

**Anthropic Claude:**

| Variable            | Required | Format       | Description                               |
| ------------------- | -------- | ------------ | ----------------------------------------- |
| `ANTHROPIC_API_KEY` | No       | `sk-ant-...` | Anthropic API key (for @anthropic-ai/sdk) |
| `CLAUDE_API_KEY`    | No       | `sk-ant-...` | Alternative: Claude API key               |

**OpenAI:**

| Variable         | Required | Format   | Description                         |
| ---------------- | -------- | -------- | ----------------------------------- |
| `OPENAI_API_KEY` | No       | `sk-...` | OpenAI API key (for GPT-5 features) |

---

### Email Services

| Variable         | Required | Format                                       | Description                            |
| ---------------- | -------- | -------------------------------------------- | -------------------------------------- |
| `EMAIL_ENABLED`  | No       | `true` / `false`                             | Enable email sending                   |
| `EMAIL_PROVIDER` | No       | `sendgrid` / `ses` / `resend` / `simulation` | Email provider (default: `simulation`) |

**SendGrid:**

| Variable              | Required    | Format             | Description          |
| --------------------- | ----------- | ------------------ | -------------------- |
| `SENDGRID_API_KEY`    | Conditional | `SG.xxx`           | SendGrid API key     |
| `SENDGRID_FROM_EMAIL` | No          | `email@domain.com` | Default from address |

**AWS SES:**

| Variable                | Required    | Format             | Description          |
| ----------------------- | ----------- | ------------------ | -------------------- |
| `AWS_REGION`            | Conditional | `us-east-1`        | AWS region           |
| `AWS_ACCESS_KEY_ID`     | Conditional | `AKIA...`          | AWS access key       |
| `AWS_SECRET_ACCESS_KEY` | Conditional | `secret`           | AWS secret key       |
| `AWS_SES_FROM_EMAIL`    | No          | `email@domain.com` | Default from address |

**Resend:**

| Variable            | Required    | Format             | Description          |
| ------------------- | ----------- | ------------------ | -------------------- |
| `RESEND_API_KEY`    | Conditional | `re_xxx`           | Resend API key       |
| `RESEND_FROM_EMAIL` | No          | `email@domain.com` | Default from address |

**Billing Emails:**

| Variable             | Required | Format             | Description                 |
| -------------------- | -------- | ------------------ | --------------------------- |
| `BILLING_FROM_EMAIL` | No       | `email@domain.com` | Billing notification sender |

---

### SMS Services

| Variable       | Required | Format                    | Description                    |
| -------------- | -------- | ------------------------- | ------------------------------ |
| `SMS_ENABLED`  | No       | `true` / `false`          | Enable SMS sending             |
| `SMS_PROVIDER` | No       | `twilio` / `sns` / `mock` | SMS provider (default: `mock`) |

**Twilio:**

| Variable              | Required    | Format  | Description                |
| --------------------- | ----------- | ------- | -------------------------- |
| `TWILIO_ACCOUNT_SID`  | Conditional | `AC...` | Twilio account SID         |
| `TWILIO_AUTH_TOKEN`   | Conditional | `token` | Twilio auth token          |
| `TWILIO_PHONE_NUMBER` | Conditional | `+1...` | Twilio sender phone number |

---

### Third-Party Integrations

**Google (Calendar & SEO):**

| Variable               | Required | Format                           | Description                |
| ---------------------- | -------- | -------------------------------- | -------------------------- |
| `GOOGLE_CLIENT_ID`     | No       | `xxx.apps.googleusercontent.com` | Google OAuth client ID     |
| `GOOGLE_CLIENT_SECRET` | No       | `GOCSPX-xxx`                     | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI`  | No       | URL                              | OAuth callback URL         |

**Microsoft (Calendar & 365):**

| Variable                  | Required | Format   | Description                 |
| ------------------------- | -------- | -------- | --------------------------- |
| `MICROSOFT_CLIENT_ID`     | No       | UUID     | Microsoft app client ID     |
| `MICROSOFT_CLIENT_SECRET` | No       | `secret` | Microsoft app client secret |
| `MICROSOFT_REDIRECT_URI`  | No       | URL      | OAuth callback URL          |

**Salesforce:**

| Variable                   | Required | Format         | Description                           |
| -------------------------- | -------- | -------------- | ------------------------------------- |
| `SALESFORCE_CLIENT_ID`     | No       | `consumer_key` | Salesforce connected app consumer key |
| `SALESFORCE_CLIENT_SECRET` | No       | `secret`       | Salesforce connected app secret       |
| `SALESFORCE_REDIRECT_URI`  | No       | URL            | OAuth callback URL                    |

**QuickBooks:**

| Variable                   | Required | Format      | Description                |
| -------------------------- | -------- | ----------- | -------------------------- |
| `QUICKBOOKS_CLIENT_ID`     | No       | `client_id` | QuickBooks app client ID   |
| `QUICKBOOKS_CLIENT_SECRET` | No       | `secret`    | QuickBooks app secret      |
| `QUICKBOOKS_REDIRECT_URI`  | No       | URL         | OAuth callback URL         |
| `QUICKBOOKS_WEBHOOK_TOKEN` | No       | `token`     | Webhook verification token |

---

### Monitoring & Logging

**Application Logging:**

| Variable      | Required | Format                                                  | Description                                    |
| ------------- | -------- | ------------------------------------------------------- | ---------------------------------------------- |
| `LOG_LEVEL`   | No       | `trace` / `debug` / `info` / `warn` / `error` / `fatal` | Log level (default: `info`)                    |
| `APP_NAME`    | No       | `string`                                                | Application name for logs (default: `printyx`) |
| `APP_VERSION` | No       | `string`                                                | Application version                            |
| `HOSTNAME`    | No       | `string`                                                | Server hostname for logs                       |

**APM (Application Performance Monitoring):**

| Variable                   | Required | Format                                     | Description                          |
| -------------------------- | -------- | ------------------------------------------ | ------------------------------------ |
| `APM_PROVIDER`             | No       | `sentry` / `datadog` / `newrelic` / `none` | APM provider                         |
| `SENTRY_DSN`               | No       | `https://xxx@sentry.io/project`            | Sentry DSN                           |
| `APM_TRACES_SAMPLE_RATE`   | No       | `0.0` - `1.0`                              | Trace sampling rate (default: `0.1`) |
| `APM_PROFILES_SAMPLE_RATE` | No       | `0.0` - `1.0`                              | Profile sampling rate                |
| `APM_ENABLE_TRACING`       | No       | `true` / `false`                           | Enable tracing (default: `true`)     |
| `APM_DEBUG`                | No       | `true` / `false`                           | Enable APM debug mode                |

**Log Transport:**

| Variable                | Required | Format                                                                  | Description                                   |
| ----------------------- | -------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `LOG_TRANSPORT`         | No       | `console` / `cloudwatch` / `elasticsearch` / `splunk` / `http` / `file` | Log destination                               |
| `LOG_BATCH_SIZE`        | No       | `number`                                                                | Batch size for log transport (default: `100`) |
| `LOG_FLUSH_INTERVAL_MS` | No       | `number`                                                                | Flush interval (default: `5000`)              |
| `LOG_MAX_RETRIES`       | No       | `number`                                                                | Max retries for log transport                 |
| `LOG_RETRY_DELAY_MS`    | No       | `number`                                                                | Retry delay                                   |

**CloudWatch (if using AWS CloudWatch):**

| Variable                | Required    | Format                 | Description           |
| ----------------------- | ----------- | ---------------------- | --------------------- |
| `CLOUDWATCH_LOG_GROUP`  | Conditional | `/printyx/application` | CloudWatch log group  |
| `CLOUDWATCH_LOG_STREAM` | Conditional | `production`           | CloudWatch log stream |

**Elasticsearch (if using ELK Stack):**

| Variable                 | Required    | Format   | Description               |
| ------------------------ | ----------- | -------- | ------------------------- |
| `ELASTICSEARCH_NODE`     | Conditional | URL      | Elasticsearch cluster URL |
| `ELASTICSEARCH_INDEX`    | Conditional | `string` | Index name                |
| `ELASTICSEARCH_USERNAME` | No          | `string` | Auth username             |
| `ELASTICSEARCH_PASSWORD` | No          | `string` | Auth password             |
| `ELASTICSEARCH_API_KEY`  | No          | `string` | API key auth              |

---

### Secrets Management

| Variable            | Required | Format                  | Description                         |
| ------------------- | -------- | ----------------------- | ----------------------------------- |
| `SECRETS_PROVIDER`  | No       | `env` / `vault` / `aws` | Secrets provider (default: `env`)   |
| `SECRETS_CACHE_TTL` | No       | `number`                | Cache TTL in ms (default: `300000`) |
| `SECRET_ENV_PREFIX` | No       | `string`                | Prefix for env secrets              |

**HashiCorp Vault (if using Vault):**

| Variable           | Required    | Format   | Description                           |
| ------------------ | ----------- | -------- | ------------------------------------- |
| `VAULT_ADDR`       | Conditional | URL      | Vault server address                  |
| `VAULT_TOKEN`      | Conditional | `token`  | Vault auth token                      |
| `VAULT_ROLE_ID`    | Conditional | UUID     | AppRole role ID (alternative auth)    |
| `VAULT_SECRET_ID`  | Conditional | UUID     | AppRole secret ID                     |
| `VAULT_NAMESPACE`  | No          | `string` | Vault namespace                       |
| `VAULT_MOUNT_PATH` | No          | `string` | Secret mount path (default: `secret`) |

**AWS Secrets Manager (if using AWS):**

| Variable            | Required | Format   | Description             |
| ------------------- | -------- | -------- | ----------------------- |
| `AWS_SECRET_PREFIX` | No       | `string` | Prefix for secret names |

---

### SEO & Knowledge Base

**PageSpeed & Search Console:**

| Variable                     | Required | Format   | Description                    |
| ---------------------------- | -------- | -------- | ------------------------------ |
| `PAGESPEED_INSIGHTS_API_KEY` | No       | `string` | Google PageSpeed API key       |
| `GOOGLE_SEO_CLIENT_ID`       | No       | `string` | Search Console OAuth client ID |
| `GOOGLE_SEO_CLIENT_SECRET`   | No       | `string` | Search Console OAuth secret    |
| `GOOGLE_SEO_REDIRECT_URI`    | No       | URL      | OAuth callback URL             |

**Backlink APIs:**

| Variable         | Required | Format   | Description    |
| ---------------- | -------- | -------- | -------------- |
| `AHREFS_API_KEY` | No       | `string` | Ahrefs API key |
| `MOZ_ACCESS_ID`  | No       | `string` | Moz access ID  |
| `MOZ_SECRET_KEY` | No       | `string` | Moz secret key |

**SERP Tracking:**

| Variable              | Required | Format   | Description         |
| --------------------- | -------- | -------- | ------------------- |
| `SERPAPI_KEY`         | No       | `string` | SerpAPI key         |
| `DATAFORSEO_LOGIN`    | No       | `string` | DataForSEO login    |
| `DATAFORSEO_PASSWORD` | No       | `string` | DataForSEO password |

**Knowledge Base:**

| Variable                          | Required | Format                 | Description                                             |
| --------------------------------- | -------- | ---------------------- | ------------------------------------------------------- |
| `KB_AI_MODEL`                     | No       | `string`               | AI model for KB (default: `claude-3-5-sonnet-20241022`) |
| `KB_AI_TEMPERATURE`               | No       | `number`               | AI temperature (default: `0.7`)                         |
| `KB_AI_MAX_TOKENS`                | No       | `number`               | Max tokens (default: `4000`)                            |
| `KB_EMBEDDING_MODEL`              | No       | `string`               | Embedding model (default: `text-embedding-ada-002`)     |
| `KB_SEMANTIC_SEARCH_ENABLED`      | No       | `true` / `false`       | Enable semantic search                                  |
| `KB_AUTO_GENERATE_EMBEDDINGS`     | No       | `true` / `false`       | Auto-generate embeddings                                |
| `KB_AI_GENERATION_ENABLED`        | No       | `true` / `false`       | Enable AI content generation                            |
| `KB_AI_BATCH_SIZE`                | No       | `number`               | Batch size for AI processing                            |
| `KB_AI_QUEUE_PROCESSING_INTERVAL` | No       | `number`               | Queue processing interval (ms)                          |
| `KB_EXTENSION_ALLOWED_ORIGINS`    | No       | `comma,separated,urls` | Allowed origins for Chrome extension                    |
| `KB_EXTENSION_API_VERSION`        | No       | `v1`                   | API version for extension                               |

---

## Client-Side Variables (import.meta.env / VITE\_)

These variables are used in the React frontend and must be prefixed with `VITE_` to be exposed to the browser.

| Variable                  | Required | Format                           | Description                                   |
| ------------------------- | -------- | -------------------------------- | --------------------------------------------- |
| `VITE_SUPABASE_URL`       | **Yes**  | `https://api.printyx.net`        | Supabase API URL                              |
| `VITE_SUPABASE_ANON_KEY`  | **Yes**  | JWT string                       | Supabase anonymous key                        |
| `VITE_FUNCTIONS_URL`      | No       | `https://functions.printyx.net`  | Edge Functions URL                            |
| `VITE_AUTH_MODE`          | No       | `supabase` / `hybrid` / `legacy` | Auth mode (default: `supabase`)               |
| `VITE_USE_SUPABASE_PROXY` | No       | `true` / `false`                 | Use Cloudflare Pages proxy (default: `false`) |
| `VITE_API_BASE_URL`       | No       | URL                              | API base URL (empty = relative URLs)          |
| `VITE_APP_VERSION`        | No       | `string`                         | Application version (default: `1.0.0`)        |

**Built-in Vite Variables (no prefix needed):**

| Variable               | Type      | Description           |
| ---------------------- | --------- | --------------------- |
| `import.meta.env.DEV`  | `boolean` | `true` in development |
| `import.meta.env.PROD` | `boolean` | `true` in production  |
| `import.meta.env.MODE` | `string`  | Current mode          |

---

## Supabase Edge Function Variables (Deno.env)

These variables are available in Supabase Edge Functions using `Deno.env.get('VARIABLE_NAME')`.

**Automatically Provided by Supabase:**

| Variable                    | Description                            |
| --------------------------- | -------------------------------------- |
| `SUPABASE_URL`              | Supabase project URL (auto-injected)   |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-injected)       |

**Custom Secrets (set via Supabase CLI or Dashboard):**

| Variable   | Required | Format                | Description                        |
| ---------- | -------- | --------------------- | ---------------------------------- |
| `SITE_URL` | No       | `https://printyx.net` | Site URL for email links/redirects |

**Setting Supabase Secrets:**

```bash
# Using Supabase CLI
supabase secrets set SITE_URL=https://printyx.net

# List all secrets
supabase secrets list
```

---

## Variable Setup by Environment

### Development (Local)

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL=postgresql://postgres:password@localhost:5433/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_key
SESSION_SECRET=dev-session-secret-32-chars-min

# Frontend
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your_local_anon_key
VITE_AUTH_MODE=supabase

# Optional for development
NODE_ENV=development
PORT=5000
```

### Production (Self-Hosted Supabase)

```env
# Database
DATABASE_URL=postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# Supabase
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Security
SESSION_SECRET=production-secure-random-string-64-chars
ENCRYPTION_KEY=your_64_char_hex_encryption_key

# Stripe (required for payments)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Frontend (set at build time or in hosting platform)
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=your_production_anon_key
VITE_FUNCTIONS_URL=https://functions.printyx.net
VITE_AUTH_MODE=supabase

# Application
NODE_ENV=production
BASE_URL=https://printyx.net
```

### Supabase Edge Functions

Set via Supabase Dashboard (Settings > Edge Functions > Secrets) or CLI:

```bash
# Required secrets for Edge Functions
supabase secrets set SITE_URL=https://printyx.net

# The following are auto-injected and don't need to be set:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
```

### Cloudflare Pages (Frontend Hosting)

Set in Cloudflare Dashboard (Settings > Environment Variables):

| Variable                  | Value                           |
| ------------------------- | ------------------------------- |
| `VITE_SUPABASE_URL`       | `https://api.printyx.net`       |
| `VITE_SUPABASE_ANON_KEY`  | Your anon key                   |
| `VITE_FUNCTIONS_URL`      | `https://functions.printyx.net` |
| `VITE_AUTH_MODE`          | `supabase`                      |
| `VITE_USE_SUPABASE_PROXY` | `true` (if using proxy)         |

---

## Security Notes

1. **Never commit `.env` files** to version control
2. **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS - never expose to frontend
3. **Session Secret** should be at least 32 characters of random data
4. **Encryption Key** should be 64 hex characters (32 bytes)
5. **API Keys** for third-party services should be rotated regularly
6. Use **Secrets Manager** (`SECRETS_PROVIDER=vault` or `aws`) for production deployments

---

## Troubleshooting

### "DATABASE_URL not found"

- Ensure `.env` file exists in project root
- Check the variable is not misspelled
- Verify the connection string format

### "SUPABASE_ANON_KEY not found" (Frontend)

- Remember: Frontend variables must be prefixed with `VITE_`
- Rebuild the frontend after changing `.env`

### "Connection refused" to database

- Check `DB_PORT` (5433 for pooler, 5432 for direct)
- Verify `DB_SSL` settings match server configuration
- For self-signed certs: `DB_SSL_REJECT_UNAUTHORIZED=false`

### Edge Functions not receiving secrets

- Use `supabase secrets set` to configure
- Redeploy functions after setting new secrets
- Check secrets with `supabase secrets list`
