# Local Development Environment Setup Guide

This guide will help you set up your `.env` file for local development with Supabase.

> **Note:** Printyx uses a **self-hosted Supabase** instance. Production uses:
>
> - **API URL:** `https://api.printyx.net`
> - **Functions URL:** `https://functions.printyx.net`
> - **Database:** `209.145.59.219:5433` (Supavisor pooler)
>
> Contact your administrator for access credentials.

## Quick Start

1. **Copy the template below into a new file named `.env` in the root directory**
2. **Fill in the required Supabase values** (marked as REQUIRED)
3. **Run `npm run dev` to start the development server**

---

## Environment Variables Template

Copy everything below into your `.env` file:

```bash
# ========================================
# SUPABASE DATABASE CONNECTION (REQUIRED)
# ========================================
# You can use EITHER Option 1 OR Option 2

# Option 1: Single DATABASE_URL (Recommended)
# For self-hosted Supabase (Printyx production):
DATABASE_URL=postgresql://postgres:your-password@209.145.59.219:5433/postgres
# For cloud Supabase:
# DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# Option 2: Individual Database Components (Alternative)
# DB_HOST=209.145.59.219 (self-hosted) or aws-0-us-east-1.pooler.supabase.com (cloud)
# DB_PORT=5432
# DB_USER=postgres.your-project-ref
# DB_PASSWORD=your-password
# DB_NAME=postgres

# Database SSL Configuration
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# Database Connection Pool Settings (Optional - has defaults)
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_CONNECTION_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=30000

# Database Logging & Debugging
DB_LOG_QUERIES=true
DB_LOG_PARAMS=false
DB_SLOW_QUERY_THRESHOLD_MS=1000

# ========================================
# SUPABASE AUTHENTICATION (REQUIRED)
# ========================================
# JWT Secret: Found in Supabase Dashboard > Settings > API > JWT Secret
SUPABASE_JWT_SECRET=your-supabase-jwt-secret-here

# ========================================
# APPLICATION CONFIGURATION
# ========================================
# Environment
NODE_ENV=development

# Base URLs
BASE_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173

# Session/Security (for any legacy routes)
SESSION_SECRET=your-local-dev-session-secret-change-this
ENCRYPTION_KEY=your-32-byte-hex-encryption-key-here

# Demo/Test Data IDs (Optional - for seeding)
DEMO_TENANT_ID=550e8400-e29b-41d4-a716-446655440000
DEMO_USER_PASSWORD=change-this-password

# ========================================
# SUPABASE CLIENT CONFIGURATION (REQUIRED - For Frontend)
# ========================================
# These are prefixed with VITE_ for Vite to expose them to the frontend

# Supabase URL: For self-hosted use api.printyx.net, for cloud use your-project.supabase.co
VITE_SUPABASE_URL=https://api.printyx.net

# Supabase Anon Key: Found in Supabase Dashboard > Settings > API > anon public
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# API Base URL (leave empty for relative URLs in dev)
VITE_API_BASE_URL=

# Auth Mode: 'supabase' (recommended) | 'legacy' | 'hybrid'
VITE_AUTH_MODE=supabase

# Proxy Mode: Use 'true' only for Cloudflare Pages deployment
VITE_USE_SUPABASE_PROXY=false

# App Version
VITE_APP_VERSION=1.0.0
```

---

## Where to Find Your Supabase Credentials

### 1. **Supabase Dashboard → Settings → API**

You'll find:

- **Project URL** → Use for `VITE_SUPABASE_URL`
- **anon public key** → Use for `VITE_SUPABASE_ANON_KEY`
- **JWT Secret** → Use for `SUPABASE_JWT_SECRET`

### 2. **Database Connection String**

#### Option A: From Supabase Dashboard

1. Go to **Settings → Database**
2. Look for **Connection string** section
3. Select **Connection Pooling** (Session mode recommended)
4. Copy the URI and paste it as `DATABASE_URL`

Example format (self-hosted Printyx):

```
postgresql://postgres:[YOUR-PASSWORD]@209.145.59.219:5433/postgres
```

Example format (cloud Supabase):

```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

#### Option B: Construct it manually

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[HOST]:5432/postgres
```

**Important:** Make sure to:

- Use the **pooler** endpoint (not direct connection) for better performance
- Include your actual database password (not [YOUR-PASSWORD])
- Set `DB_SSL=true` for Supabase

---

## Required Variables Summary

For basic local development, you **MUST** have these 5 variables:

```bash
# Backend Database
DATABASE_URL=postgresql://...
SUPABASE_JWT_SECRET=your-jwt-secret

# Frontend (use api.printyx.net for self-hosted)
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AUTH_MODE=supabase
```

---

## Optional Integration Variables

Only add these if you're testing specific features:

### AI Features

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### QuickBooks Integration

```bash
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=http://localhost:5000/api/integrations/quickbooks/callback
```

### Other Integrations

```bash
# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Salesforce
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_CLIENT_ID=

# Apollo.io
APOLLOIO_API_KEY=

# Twilio SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

## Testing Your Setup

After creating your `.env` file:

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Check the console for:**
   - `[Database] Connecting to PostgreSQL...` (should succeed)
   - No authentication errors
   - Frontend should load at `http://localhost:5173`
   - Backend API should be at `http://localhost:5000`

3. **Test database connection:**
   - Visit `http://localhost:5000/health`
   - Should return JSON with database status

4. **Test authentication:**
   - Try logging in with your Supabase credentials
   - Check browser console for auth config logs

---

## Troubleshooting

### "Database configuration incomplete"

- Make sure `DATABASE_URL` is set correctly
- Check that it starts with `postgresql://`
- Verify your password is correct

### "SUPABASE_JWT_SECRET environment variable is not set"

- Go to Supabase Dashboard → Settings → API
- Copy the **JWT Secret** (under "JWT Settings")
- Paste it into your `.env` file

### "Failed to fetch" or CORS errors

- Make sure `VITE_SUPABASE_URL` matches your actual Supabase project URL
- Set `VITE_USE_SUPABASE_PROXY=false` for local development
- Restart your dev server after changing `.env`

### SSL Certificate Errors

- Set `DB_SSL_REJECT_UNAUTHORIZED=false` in your `.env`
- This is safe for development with Supabase's self-signed certs

### Frontend can't connect to backend

- Verify backend is running on `http://localhost:5000`
- Verify frontend is running on `http://localhost:5173`
- Check `VITE_API_BASE_URL` is empty or not set (for relative URLs)

---

## Security Notes

⚠️ **IMPORTANT:**

- Never commit `.env` files to git
- `.env` is already in `.gitignore` by default
- Use different credentials for development and production
- Rotate your `JWT_SECRET` and database passwords regularly
- The `ENCRYPTION_KEY` should be a 32-byte hex string (64 characters)

---

## Generate Secure Keys

If you need to generate secure keys:

### Session Secret (any random string)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Encryption Key (32-byte hex)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Next Steps

After setting up your environment:

1. ✅ Run database migrations: `npm run db:migrate`
2. ✅ Seed initial data (optional): `npm run db:seed`
3. ✅ Start development: `npm run dev`
4. ✅ Test in browser: `http://localhost:5173`

Happy coding! 🚀
