# Supabase Auth Migration Progress

## Status: IN PROGRESS - Phase 1 & 3 Complete

Last Updated: 2024-12-12

---

## Overview

Migrating from Express/Neon session-based auth to Supabase Auth (GoTrue) with:
- Hybrid transition period (both auth systems)
- Edge Functions for business logic
- RLS policies for multi-tenancy

## Architecture

```
Frontend: printyx.net (Cloudflare Pages)
Auth:     api.printyx.net (Supabase GoTrue)
API:      functions.printyx.net (Supabase Edge Functions)
Database: Supabase PostgreSQL with RLS
```

---

## Progress Checklist

### Phase 1: Frontend Auth Infrastructure
- [x] Create `client/src/hooks/useSupabaseAuth.ts`
- [x] Create `client/src/providers/AuthProvider.tsx`
- [x] Update `client/src/lib/config.ts` - Add authMode, functionsUrl
- [x] Update `client/src/lib/supabase.ts` - Configure PKCE auth
- [x] Update `client/src/lib/queryClient.ts` - Bearer token support
- [x] Update `client/src/App.tsx` - Wrap with AuthProvider
- [x] Update `client/src/pages/Login.tsx` - Use Supabase auth
- [x] Update `client/src/pages/Signup.tsx` - Call Edge Function

### Phase 2: Supabase Configuration
- [ ] Set Cloudflare Pages env vars (VITE_SUPABASE_URL, etc.)
- [ ] Configure Supabase Site URL and Redirect URLs
- [ ] Verify JWT settings

### Phase 3: Edge Functions
- [x] Update `supabase/functions/_shared/cors.ts` - Proper CORS with allowed origins
- [x] Verify `supabase/functions/_shared/supabase.ts` - Client helpers exist
- [x] Create `supabase/functions/signup/index.ts` - Full signup with tenant creation
- [x] Update `supabase/config.toml` - Configure signup function
- [ ] Create example business logic Edge Function (optional)
- [ ] Deploy Edge Functions to Supabase

### Phase 4: RLS Policies
- [ ] Create `supabase/migrations/001_rls_policies.sql`
- [ ] Add helper functions (auth.tenant_id(), etc.)
- [ ] Enable RLS on business tables
- [ ] Test policies

### Phase 5: User Migration
- [ ] Create migration script
- [ ] Test with sample users
- [ ] Send password reset emails
- [ ] Verify user metadata

### Phase 6: Cleanup (After Full Migration)
- [ ] Remove Express auth routes
- [ ] Remove session middleware
- [ ] Remove CSRF middleware
- [ ] Update dependencies

---

## Environment Variables

### Cloudflare Pages
```
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_FUNCTIONS_URL=https://functions.printyx.net
VITE_AUTH_MODE=hybrid
```

### Supabase (Coolify)
```
GOTRUE_SITE_URL=https://printyx.net
GOTRUE_EXTERNAL_URL=https://api.printyx.net
SITE_URL=https://printyx.net  # For Edge Functions email links
```

---

## User Metadata Structure

```json
{
  "user_metadata": {
    "first_name": "string",
    "last_name": "string",
    "full_name": "string",
    "phone": "string"
  },
  "app_metadata": {
    "tenantId": "uuid",
    "roleId": "uuid",
    "accessScope": "company|region|location|team|own",
    "isPlatformUser": false
  }
}
```

---

## Files Modified/Created

### New Files
| File | Status | Description |
|------|--------|-------------|
| `client/src/hooks/useSupabaseAuth.ts` | Complete | Supabase auth hook with session management |
| `client/src/providers/AuthProvider.tsx` | Complete | Unified auth context (supports legacy/hybrid/supabase) |
| `supabase/functions/signup/index.ts` | Complete | Creates tenant + role + user + sends verification |

### Modified Files
| File | Status | Changes |
|------|--------|---------|
| `client/src/lib/config.ts` | Complete | Added authMode, functionsUrl, getApiUrl helper |
| `client/src/lib/supabase.ts` | Complete | PKCE auth config, getAccessToken helper |
| `client/src/lib/queryClient.ts` | Complete | Bearer token support, Edge Function routing |
| `client/src/App.tsx` | Complete | Wrapped with AuthProvider, uses useAuthContext |
| `client/src/pages/Login.tsx` | Complete | Uses unified auth provider |
| `client/src/pages/Signup.tsx` | Complete | Passes metadata to signup Edge Function |
| `supabase/functions/_shared/cors.ts` | Complete | Proper CORS with printyx.net origins |
| `supabase/config.toml` | Complete | Added signup function config |

---

## How Auth Modes Work

### Legacy Mode (`VITE_AUTH_MODE=legacy`)
- Uses Express session-based auth
- Session stored in PostgreSQL
- CSRF protection required
- Credentials sent with cookies

### Hybrid Mode (`VITE_AUTH_MODE=hybrid`)
- Primary: Supabase Auth (GoTrue)
- Fallback: Legacy Express auth
- Bearer tokens for API calls
- Both auth systems work simultaneously

### Supabase Mode (`VITE_AUTH_MODE=supabase`)
- Only Supabase Auth
- Bearer tokens for all API calls
- Edge Functions for business logic
- RLS for tenant isolation

---

## API Request Flow

```
Frontend (Login.tsx)
    |
    v
AuthProvider.login(email, password)
    |
    +--[hybrid/supabase mode]---> supabase.auth.signInWithPassword()
    |                                  |
    |                                  v
    |                             Returns JWT + refresh token
    |
    +--[legacy mode]---> apiRequest('/api/auth/login')
                              |
                              v
                         Returns session cookie
```

```
Frontend (API Call)
    |
    v
apiRequest('/api/resource')
    |
    +--[hybrid/supabase]---> getAccessToken() -> Bearer header
    |                              |
    |                              v
    |                        functions.printyx.net/resource
    |
    +--[legacy]---> credentials: 'include' (cookies)
                         |
                         v
                    Express server /api/resource
```

---

## Signup Edge Function Flow

```
1. Frontend submits form data
2. AuthProvider.signup() calls Edge Function
3. Edge Function (signup/index.ts):
   a. Creates tenant record
   b. Creates admin role for tenant
   c. Creates Supabase Auth user with app_metadata
   d. Creates user record in users table
   e. Generates verification email
4. User receives email, clicks link
5. User redirected to /auth/callback
6. Session established
```

---

## Next Steps

1. **Set Cloudflare Pages Environment Variables**
   - Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_FUNCTIONS_URL, VITE_AUTH_MODE

2. **Deploy Edge Functions**
   - Run `supabase functions deploy signup`
   - Set SUPABASE_SERVICE_ROLE_KEY in Edge Functions secrets

3. **Configure Supabase Auth**
   - Set Site URL: https://printyx.net
   - Add Redirect URL: https://printyx.net/auth/callback

4. **Create RLS Policies**
   - Add auth.tenant_id() helper function
   - Enable RLS on business tables
   - Create tenant isolation policies

5. **Test Full Flow**
   - Test signup creates tenant + user
   - Test login returns JWT
   - Test API calls with Bearer token
   - Test tenant isolation

---

## Rollback Plan

If issues occur, revert to legacy auth:
1. Set `VITE_AUTH_MODE=legacy` in Cloudflare Pages
2. Redeploy frontend
3. Users continue using Express session auth

---

## Notes

- Existing users will need password reset (bcrypt hashes cannot be migrated to Supabase)
- Hybrid mode allows both auth systems during transition
- RLS policies provide automatic tenant isolation without middleware
- Edge Function creates tenant + role + user atomically
- Verification email sent automatically by Supabase
