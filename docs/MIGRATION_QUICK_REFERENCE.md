# Migration Quick Reference Guide

**Last Updated:** January 13, 2026

---

## 🚨 CRITICAL ISSUES FOUND

### 1. Hybrid Architecture Risk

- **Problem:** Application uses both Express routes (`/server`) AND Edge Functions
- **Impact:** Security inconsistencies, maintenance burden, deployment complexity
- **Status:** 🔴 HIGH PRIORITY

### 2. Missing Edge Functions

- **Problem:** Only 11 Edge Functions created, need 50+
- **Impact:** Many features broken or insecure
- **List:**
  - ❌ `/api/me` - 404 error (user profile broken)
  - ❌ `/api/customers` - Using old Express route
  - ❌ `/api/service-tickets` - Using old Express route
  - ❌ `/api/contacts` - Lead contacts broken
  - ❌ `/api/reports` - Dashboard data broken
  - ❌ `/api/territories` - Territory management broken
  - ❌ `/api/catalog` - Product catalog broken
  - ❌ `/api/pricing` - Pricing updates broken
  - ❌ `/api/inventory` - Warehouse operations limited
  - ❌ `/api/quotes` - Quote creation broken

### 3. Inconsistent Authentication

- **Problem:** Mixed patterns (session vs JWT)
- **Impact:** Security vulnerabilities, unpredictable auth
- **Status:** 🟡 MEDIUM PRIORITY

---

## 📋 MIGRATION CHECKLIST

### Week 1: Critical Functions

- [ ] **Task 1:** Fix `/api/me` endpoint (30 min)
  - File: `supabase/functions/me/index.ts`
  - Currently: 404 error
  - Impact: User profile loading fails

- [ ] **Task 2:** Create `/api/customers` Edge Function (2 hrs)
  - File: `supabase/functions/customers/index.ts`
  - Port from: `server/routes-customers.ts`
  - Impact: Customer management broken

- [ ] **Task 3:** Create `/api/service-tickets` Edge Function (3 hrs)
  - File: `supabase/functions/service-tickets/index.ts`
  - Port from: `server/routes-service-dispatch.ts`
  - Impact: Service dispatch broken

- [ ] **Task 4:** Create `/api/contacts` Edge Function (1 hr)
  - File: `supabase/functions/contacts/index.ts` OR merge into `business-records`
  - Impact: Cannot add contacts to leads

### Week 2: Supporting Functions

- [ ] **Task 5:** Create `/api/reports` Edge Function (4 hrs)
  - File: `supabase/functions/reports/index.ts`
  - Port from: Multiple `server/routes-reports-*.ts`
  - Impact: Executive dashboards broken

- [ ] **Task 6:** Create `/api/territories` Edge Function (2 hrs)
  - File: `supabase/functions/territories/index.ts`
  - Port from: `server/routes-territory-management.ts`
  - Impact: Sales leadership features broken

- [ ] **Task 7:** Create `/api/catalog` Edge Function (2 hrs)
  - File: `supabase/functions/catalog/index.ts`
  - Port from: `server/routes-catalog.ts`
  - Impact: Cannot enable/disable products

- [ ] **Task 8:** Create `/api/pricing` Edge Function (2 hrs)
  - File: `supabase/functions/pricing/index.ts`
  - Port from: `server/routes-pricing.ts`
  - Impact: Cannot update product pricing

### Week 3: Advanced Functions

- [ ] **Task 9:** Create `/api/inventory` Edge Function (3 hrs)
  - File: `supabase/functions/inventory/index.ts`
  - Port from: `server/routes-warehouse.ts`
  - Impact: Warehouse operations partially broken

- [ ] **Task 10:** Create `/api/quotes` Edge Function (4 hrs)
  - File: `supabase/functions/quotes/index.ts`
  - Port from: `server/routes/quotes-routes.ts`
  - Impact: Cannot create quotes

---

## 🔐 REQUIRED AUTH PATTERN

**EVERY Edge Function MUST include this:**

```typescript
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // 1. CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 2. JWT Validation
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const supabase = createSupabaseClient(req);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt);

  if (userError || !user) {
    return createCorsResponse({ error: 'Unauthorized' }, 401, req);
  }

  // 3. Tenant ID Extraction
  const tenantId =
    (user.app_metadata?.tenantId as string) || (user.app_metadata?.tenant_id as string);

  if (!tenantId) {
    return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
  }

  // 4. Database Operations (always filter by tenant_id!)
  const admin = createSupabaseServiceClient();
  const { data, error } = await admin.from('table_name').select('*').eq('tenant_id', tenantId); // ⚠️ CRITICAL: Always filter!

  return createCorsResponse(data || [], 200, req);
}
```

---

## 🎯 IMMEDIATE ACTIONS (TODAY)

### 1. Fix `/api/me` (30 minutes)

**Problem:** Returns 404, user profile won't load
**Solution:** Create or fix the function

```bash
# Check current state
ssh root@209.145.59.219 "docker logs qc8gw0k4oo4gs4owggg80s8w 2>&1 | grep 'Loaded function: me'"

# If missing, create it
# File: supabase/functions/me/index.ts
```

### 2. Test Core CRM (1 hour)

Open these pages and verify they work:

- ✅ https://printyx.net/leads-management - Works
- ✅ https://printyx.net/leads/:id - Fixed today
- ✅ https://printyx.net/task-hub - Works
- ❌ https://printyx.net/customers - Test this
- ❌ https://printyx.net/service-hub - Test this

### 3. Create Priority Edge Functions (4 hours)

Based on user impact:

1. `/api/me` - Highest (all users)
2. `/api/customers` - High (sales team)
3. `/api/service-tickets` - High (service team)
4. `/api/contacts` - Medium (sales team)

---

## 📊 CURRENT STATUS SUMMARY

### Edge Functions Status

| Function           | Status     | Auth | Users        | Priority        |
| ------------------ | ---------- | ---- | ------------ | --------------- |
| `business-records` | ✅ Working | Yes  | All Sales    | CRITICAL        |
| `tasks`            | ✅ Working | Yes  | All Users    | CRITICAL        |
| `projects`         | ✅ Working | Yes  | All Users    | CRITICAL        |
| `users`            | ✅ Working | Yes  | All Users    | CRITICAL        |
| `me`               | ❌ 404     | Yes  | All Users    | 🔴 FIX NOW      |
| `customers`        | ❌ Missing | -    | Sales        | 🔴 CREATE NOW   |
| `service-tickets`  | ❌ Missing | -    | Service      | 🔴 CREATE NOW   |
| `contacts`         | ❌ Missing | -    | Sales        | 🟡 CREATE SOON  |
| `reports`          | ❌ Missing | -    | Executives   | 🟡 CREATE SOON  |
| `territories`      | ❌ Missing | -    | Sales Mgmt   | 🟢 CREATE LATER |
| `catalog`          | ❌ Missing | -    | Product Mgmt | 🟢 CREATE LATER |
| `pricing`          | ❌ Missing | -    | Sales        | 🟢 CREATE LATER |
| `inventory`        | ❌ Missing | -    | Warehouse    | 🟢 CREATE LATER |
| `quotes`           | ❌ Missing | -    | Sales        | 🟢 CREATE LATER |

### Old Server Routes

**Total:** 120+ route files in `/server`
**Status:** ⚠️ Still in use, need migration
**Action:** Migrate to Edge Functions, then delete

### Frontend API Calls

**Total:** 748 `apiRequest()` calls across 249 files
**Using Edge Functions:** ~15%
**Using Express Routes:** ~85%
**Action:** No frontend changes needed after Edge Functions deployed

---

## 🧪 TESTING STRATEGY

### Per Feature Checklist

After creating each Edge Function:

1. **Authentication Test**

   ```bash
   # No token
   curl https://functions.printyx.net/function-name
   # Expected: 401 Unauthorized

   # With token
   curl https://functions.printyx.net/function-name \
     -H "Authorization: Bearer YOUR_TOKEN"
   # Expected: 200 OK with data
   ```

2. **Tenant Isolation Test**
   - Login as User A (Tenant 1)
   - Create record
   - Login as User B (Tenant 2)
   - Verify cannot see User A's record
   - Expected: Empty list or 404

3. **CRUD Operations**
   - [ ] Create record
   - [ ] List records
   - [ ] Get single record
   - [ ] Update record
   - [ ] Delete record

4. **Browser Test**
   - Navigate to feature page
   - Verify no console errors
   - Verify data loads
   - Verify mutations work

---

## 🔧 COMMON ISSUES & SOLUTIONS

### Issue 1: 401 Unauthorized

**Cause:** Missing or invalid JWT
**Fix:**

```typescript
// Check JWT extraction
const authHeader = req.headers.get('Authorization');
console.log('Auth header:', authHeader);

// Check user validation
console.log('User:', user);
console.log('Error:', userError);
```

### Issue 2: Empty Data (Tenant Filtering)

**Cause:** Wrong `tenant_id` or missing filter
**Fix:**

```typescript
// Always log tenant_id
console.log('Tenant ID:', tenantId);

// Always filter
.eq('tenant_id', tenantId)
```

### Issue 3: API Returns Array Instead of Object

**Cause:** Missing `.single()` on Supabase query
**Fix:**

```typescript
// Single record
const { data, error } = await admin
  .from('table')
  .select('*')
  .eq('id', id)
  .eq('tenant_id', tenantId)
  .single(); // ⬅️ Add this!
```

### Issue 4: Edge Function Not Loading

**Cause:** Missing `export default` or syntax error
**Fix:**

```typescript
// ✅ Correct
export default async function handler(req: Request) {}

// ❌ Wrong
export async function handler(req: Request) {}
```

### Issue 5: CORS Errors

**Cause:** Missing CORS headers
**Fix:**

```typescript
// Always use createCorsResponse
return createCorsResponse(data, 200, req);

// Never use raw Response
return new Response(JSON.stringify(data)); // ❌ Wrong
```

---

## 📚 KEY DOCUMENTS

1. **Full Migration Plan:** `docs/COMPREHENSIVE_MIGRATION_PLAN.md`
2. **Route Status Checklist:** `docs/ROUTE_MIGRATION_CHECKLIST.md`
3. **Supabase Audit:** `docs/SUPABASE_MIGRATION_AUDIT.md`
4. **Edge Function Template:** See Appendix A in Migration Plan

---

## 🎓 LEARNING RESOURCES

### Supabase Edge Functions

- [Official Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy](https://deno.com/deploy/docs)

### Authentication

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [JWT Tokens](https://jwt.io/)

### RLS Policies

- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## 📞 HELP & SUPPORT

**Questions about migration?**

- Check this guide first
- Review the full migration plan
- Test in development before production
- Monitor error logs during deployment

**Deployment Issues?**

- Check Edge Function logs: `docker logs CONTAINER_ID`
- Verify environment variables
- Test JWT token in browser console
- Check CORS configuration

---

## ✅ SUCCESS CRITERIA

**Migration is complete when:**

- [ ] All Edge Functions deployed (50+ functions)
- [ ] All Express routes removed from `/server`
- [ ] 0% API calls to Express
- [ ] 100% API calls to Edge Functions
- [ ] All features tested and working
- [ ] No authentication bypasses
- [ ] < 200ms average response time
- [ ] 99.9% uptime
- [ ] Full test coverage

---

**Remember:** Every Edge Function MUST validate JWT and filter by `tenant_id`!
