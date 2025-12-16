# Supabase Migration Guide

## Migration Overview

This document details the migration from Neon PostgreSQL to self-hosted Supabase for the Printyx platform.

**Migration Date**: December 2024
**Status**: In Progress

---

## Infrastructure Changes

### Before (Neon)
- **Database**: Neon serverless PostgreSQL
- **Authentication**: Replit Auth (OpenID Connect)
- **Session**: Express session with PostgreSQL store
- **User ID Source**: `req.session.userId` or `req.user.claims.sub`
- **Tenant ID Source**: `req.user.claims.tenantId` or session

### After (Self-Hosted Supabase)
- **Database**: Self-hosted Supabase PostgreSQL at `209.145.59.219`
- **Authentication**: Supabase GoTrue (JWT-based)
- **Session**: JWT tokens + fallback session support
- **User ID Source**: `req.user.id` (from decoded JWT)
- **Tenant ID Source**: `x-tenant-id` header or `app_metadata.tenantId`

---

## Connection Details

### Supabase Services

| Service | URL/Endpoint | Port |
|---------|-------------|------|
| Supabase API | `https://api.printyx.net` | 443 |
| Edge Functions | `https://functions.printyx.net` | 443 |
| PostgreSQL Pooler | `209.145.59.219` | 5433 |
| PostgreSQL Direct | `209.145.59.219` | 5432 |

### Database Connection

**Connection String**:
```
postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres
```

**Required Environment Variables**:
```env
# Database
DATABASE_URL=postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# Supabase
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Frontend (Vite)
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

---

## Code Changes Required

### 1. Backend Route Authentication Patterns

#### Old Pattern (Session-based)
```typescript
// ❌ OLD - Session only
const userId = req.session.userId;
const tenantId = req.user.claims.tenantId;

if (!req.session.userId) {
  return res.status(401).json({ error: 'Not authenticated' });
}
```

#### New Pattern (JWT + Session Fallback)
```typescript
// ✅ NEW - Supports both JWT and session
const getUserId = (req: Request): string | undefined => {
  const reqAny = req as any;
  return (
    reqAny.user?.id ||
    reqAny.user?.claims?.sub ||
    reqAny.session?.userId ||
    reqAny.session?.user?.id
  );
};

const userId = getUserId(req);
if (!userId) {
  return res.status(401).json({ error: 'Not authenticated' });
}
```

#### Using Auth Helpers
```typescript
import { getUserId, getTenantId, isAuthenticated } from '../utils/auth-helpers';

const userId = getUserId(req);
const tenantId = getTenantId(req);

if (!isAuthenticated(req)) {
  return res.status(401).json({ message: 'Not authenticated' });
}
```

### 2. Frontend Authentication

#### Old Pattern (Replit Auth)
```typescript
// ❌ OLD - Replit OIDC
window.location.href = '/__repl_auth/login';
```

#### New Pattern (Supabase Auth)
```typescript
// ✅ NEW - Supabase GoTrue
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      tenantId: 'tenant-uuid',
      // other user metadata
    },
  },
});

// Sign out
await supabase.auth.signOut();
```

### 3. API Request Headers

#### Frontend API Calls
```typescript
// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Include token in all API requests
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${session?.access_token}`,
    'x-tenant-id': tenantId,  // Optional: explicit tenant override
    'Content-Type': 'application/json',
  },
});
```

### 4. Tenant Resolution

Tenants are now resolved in this priority:
1. `x-tenant-id` request header
2. JWT `app_metadata.tenantId`
3. Session `tenantId` (fallback)

---

## Files Modified

### Core Authentication Files

| File | Status | Changes |
|------|--------|---------|
| `server/middleware/supabase-auth.ts` | ✅ Created | JWT validation middleware |
| `server/utils/auth-helpers.ts` | ✅ Created | Unified auth utility functions |
| `server/middleware/tenancy.ts` | ✅ Updated | Added x-tenant-id header support |
| `server/replitAuth.ts` | ✅ Updated | Added Supabase JWT support to isAuthenticated |
| `client/src/hooks/useSupabaseAuth.ts` | 🔄 Review | Frontend auth hook |
| `client/src/lib/supabase.ts` | 🔄 Review | Supabase client initialization |

### Route Files Fixed

See `docs/ROUTE_MIGRATION_CHECKLIST.md` for complete list.

**Priority Routes Fixed** (Added getUserId helper):
1. ✅ `routes-mobile-technician.ts`
2. ✅ `routes-knowledge-base.ts`
3. ✅ `routes-documents.ts`
4. ✅ `routes-document-automation.ts`
5. ✅ `routes-onboarding.ts`
6. ✅ `routes-trial.ts`
7. ✅ `routes-email-parser.ts`
8. ✅ `routes-equipment-lifecycle-state-machine.ts`
9. ✅ `routes-equipment-disposal.ts`
10. ✅ `routes-today-dashboard.ts`

---

## Remaining Work

### High Priority

#### Backend Routes Needing Auth Pattern Fix
These routes still use old session-only patterns:

| Route File | Issue |
|------------|-------|
| `routes-customer-portal.ts` | Uses `req.session` patterns |
| `routes-customer-numbers.ts` | Uses `req.session` patterns |
| `routes-admin-workflows.ts` | Uses session pattern |
| `routes-tenant-onboarding.ts` | Uses session pattern |
| `routes-enhanced-rbac.ts` | Uses session pattern |
| `routes-user-lifecycle.ts` | Uses session pattern |
| `routes-root-admin.ts` | Uses hybrid pattern |
| `routes-reporting-architecture.ts` | Uses `isAuthenticated` pattern |
| `routes-custom-reports.ts` | Uses hybrid pattern |
| `routes-predictive-analytics.ts` | Uses session pattern |
| `routes-ai-gpt5.ts` | Uses session pattern |
| `routes-dashboard-layouts.ts` | Uses hybrid pattern |
| `routes-csv-import.ts` | Uses hybrid pattern |
| `routes-proposals.ts` | Uses session pattern |
| `routes-social-media.ts` | Uses session pattern |
| `routes-company-ids.ts` | Uses session pattern |
| `routes-client-monitoring.ts` | Uses session check |
| `routes-sales-pipeline.ts` | Temporarily disabled |

#### Frontend Changes
| File | Status | Changes Needed |
|------|--------|----------------|
| `client/src/hooks/useAuth.ts` | 🔄 Review | Ensure uses Supabase client |
| `client/src/App.tsx` | 🔄 Review | Auth provider setup |
| `client/src/pages/Login.tsx` | 🔄 Review | Supabase sign-in form |
| `client/src/pages/Signup.tsx` | 🔄 Review | Supabase sign-up with tenant |
| `client/src/lib/queryClient.ts` | 🔄 Review | Add auth headers to all requests |

### Medium Priority

#### Routes Needing Testing
All routes marked with 🔄 in the checklist need verification:
- CRM routes (lead assignment, customer success, etc.)
- Inventory routes (warehouse FPY, product pricing, etc.)
- Service routes (technician management, maintenance, etc.)
- Billing routes (subscriptions, commissions, etc.)
- Reports routes (analytics, custom reports, etc.)
- Integration routes (Salesforce, QuickBooks, etc.)

### Low Priority

#### Documentation Updates
- [ ] Update API documentation with new auth headers
- [ ] Update Postman/Insomnia collections
- [ ] Create user guide for Supabase auth flow

---

## Testing Checklist

### Authentication Tests
- [ ] Login with email/password via Supabase
- [ ] Login persists across page refresh
- [ ] Logout clears session properly
- [ ] Protected routes redirect to login
- [ ] JWT token included in API requests
- [ ] Token refresh works correctly

### API Route Tests
- [ ] CRUD operations work with JWT auth
- [ ] Tenant isolation works correctly
- [ ] RBAC permissions enforced
- [ ] Error responses are correct (401, 403)

### Database Tests
- [ ] Connection pooler (5433) works
- [ ] SSL connections work
- [ ] Transactions work correctly
- [ ] Connection recovery on disconnect

---

## Rollback Plan

If migration needs to be rolled back:

1. **Environment Variables**:
   ```env
   # Revert to Neon
   DATABASE_URL=postgresql://user:pass@neon-host/db
   ```

2. **Auth Middleware**:
   - Routes support both JWT and session
   - Disable Supabase middleware
   - Re-enable Replit Auth

3. **Frontend**:
   - Switch auth hook back to Replit OIDC
   - Remove Supabase client

---

## Troubleshooting

### Database Connection Issues

**ECONNREFUSED**:
- Verify port is correct (5433 for pooler)
- Check firewall rules
- Verify Supabase containers are running

**Connection terminated unexpectedly**:
- Enable SSL: `DB_SSL=true`
- For self-signed: `DB_SSL_REJECT_UNAUTHORIZED=false`

**ECONNRESET**:
- SSL mismatch - check if server requires SSL
- Check connection pooler settings

### Authentication Issues

**401 Unauthorized**:
- Verify JWT token is being sent
- Check token is not expired
- Verify SUPABASE_SERVICE_ROLE_KEY is correct

**403 Forbidden**:
- Check tenant is set correctly
- Verify user has required permissions
- Check RBAC role assignment

**User not found**:
- Verify user exists in Supabase auth.users
- Check user email is confirmed
- Verify user is not banned

---

## Migration Commands

### Quick Fix Pattern for Routes

```bash
# Find routes with old patterns
grep -r "req.session.userId" server/routes-*.ts
grep -r "req.session!.userId" server/routes-*.ts
grep -r "req.user.claims.sub" server/routes-*.ts
grep -r "req.user.claims.tenantId" server/routes-*.ts
```

### Add getUserId Helper to File

Add this to the top of route files:
```typescript
// Helper to get user ID from request (supports Supabase JWT and session)
const getUserId = (req: Request): string | undefined => {
  const reqAny = req as any;
  return (
    reqAny.user?.id ||
    reqAny.user?.claims?.sub ||
    reqAny.session?.userId ||
    reqAny.session?.user?.id
  );
};
```

### Test Database Connection

```bash
# Test with psql
psql "postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres?sslmode=require"

# Test from Node.js
node -e "const {Pool}=require('pg');const p=new Pool({connectionString:'postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres',ssl:{rejectUnauthorized:false}});p.query('SELECT 1').then(r=>console.log('OK')).catch(e=>console.error(e)).finally(()=>p.end())"
```

---

## Contact & Support

For migration issues:
- Check server logs: `server/logs/`
- Database logs: Supabase dashboard
- Auth issues: Check Supabase Auth logs

---

*Last Updated: December 15, 2024*
