# Comprehensive Migration Plan: NEON → Self-Hosted Supabase

**Date:** January 13, 2026
**Status:** Phase 1 - Assessment Complete
**Priority:** HIGH - Critical for Platform Stability

---

## Executive Summary

The Printyx platform is currently in a **hybrid state** between old NEON database architecture and new self-hosted Supabase. This creates:

- **Security Risks**: Inconsistent authentication patterns
- **Maintenance Burden**: Duplicate code paths
- **Performance Issues**: Unnecessary Express.js layer
- **Deployment Complexity**: Multiple services to manage

### Current State

- **Old Server Routes**: 120+ Express.js route files in `/server`
- **Edge Functions**: Only 11 created (should be 50+)
- **Frontend API Calls**: 748 `apiRequest()` calls across 249 files
- **Authentication**: Mixed patterns (session vs JWT)

### Target State

- **Edge Functions Only**: Serverless, scalable, secure
- **Unified Auth**: Supabase JWT with RLS
- **Clean Codebase**: Remove `/server` directory
- **Proper Middleware**: JWT validation on every function

---

## Phase 1: Discovery & Inventory ✅ COMPLETE

### 1.1 NEON References Found

All NEON references are in **documentation** and **unused scripts**:

- ✅ No active code using `@neondatabase/serverless`
- ✅ Main `server/db.ts` correctly uses standard `pg` module
- ✅ Environment variables correctly point to self-hosted Supabase

**Files to Clean (Low Priority):**

- `create-test-user.ts` - Update imports
- `test-auth-connection.ts` - Update imports
- `export-database.js` - Update imports
- `export-csv.js` - Update imports
- `export-simple.js` - Update imports

### 1.2 Server Routes Inventory

**Total Express Routes:** 120+ files in `/server`

**Categories:**

- CRM & Business Records: 12 files
- Inventory & Products: 7 files
- Service Management: 8 files
- Billing & Invoices: 8 files
- Reports & Analytics: 15 files
- Tasks & Projects: 4 files
- Documents & Knowledge Base: 6 files
- Integrations: 10 files
- Admin & Platform: 10 files
- Security & Compliance: 5 files
- Equipment & Fleet: 10 files
- AI Features: 6 files
- Other: 19 files

### 1.3 Edge Functions Inventory

**Currently Deployed:** 11 functions

| Function           | Status      | Auth | Purpose               |
| ------------------ | ----------- | ---- | --------------------- |
| `hello`            | ✅ Working  | No   | Test function         |
| `signup`           | ✅ Working  | No   | User registration     |
| `me`               | ❌ 404      | Yes  | User profile          |
| `business-records` | ✅ Working  | Yes  | Leads/customers CRUD  |
| `tasks`            | ✅ Working  | Yes  | Tasks CRUD            |
| `projects`         | ✅ Working  | Yes  | Projects CRUD         |
| `users`            | ✅ Working  | Yes  | Users list            |
| `performance`      | ✅ Working  | Yes  | Performance metrics   |
| `dashboard`        | ❓ Untested | Yes  | Dashboard data        |
| `csrf-token`       | ❓ Untested | No   | CSRF token generation |
| `db-check`         | ✅ Working  | No   | Database diagnostic   |

### 1.4 Frontend API Endpoints Analysis

**Sample of Most Used Endpoints (from code scan):**

**Business Records:**

- `/api/business-records` - GET (list), POST (create)
- `/api/business-records/:id` - GET, PUT, DELETE
- `/api/business-records/:id/activities` - GET, POST
- `/api/leads/:id/contacts` - GET, POST

**Tasks:**

- `/api/tasks` - GET (list), POST (create)
- `/api/tasks/:id` - GET, PATCH, DELETE
- `/api/tasks/stats` - GET

**Projects:**

- `/api/projects` - GET (list), POST (create)
- `/api/projects/:id` - GET, PUT, DELETE

**Customers:**

- `/api/customers` - GET (list), POST (create)
- `/api/customers/:id` - GET, PATCH, DELETE

**Reports:**

- `/api/reports/executive-summary` - GET
- `/api/reports/kpi-scorecards` - GET
- `/api/reports/business-insights` - GET
- `/api/reports/custom` - POST
- `/api/reports/custom/preview` - POST

**Territories:**

- `/api/territories` - GET (list), POST (create)
- `/api/territories/stats` - GET
- `/api/territories/:id` - PUT, DELETE

**GDPR:**

- `/api/gdpr/consent/stats` - GET
- `/api/gdpr/dpa/stats` - GET
- `/api/gdpr/data-export/requests` - GET

**Enrichment:**

- `/api/enrichment/campaigns` - POST

**Catalog:**

- `/api/catalog/models/:id/enable` - POST
- `/api/catalog/models/bulk-enable` - POST

**Pricing:**

- `/api/pricing/products` - POST
- `/api/pricing/products/bulk-update` - POST

**Import:**

- `/api/import/entity-types` - GET
- `/api/import/templates/:type` - GET
- `/api/import/jobs/:id/validate` - POST
- `/api/import/jobs/:id/execute` - POST

**Inventory:**

- `/api/inventory/:id` - DELETE

**Service Tickets:**

- `/api/service-tickets/:id` - DELETE

**Dashboard:**

- `/api/dashboard/layouts` - GET, POST
- `/api/dashboard/layouts/default` - GET

**Quotes:**

- `/api/quotes` - POST

**Companies:**

- `/api/companies` - POST

---

## Phase 2: Authentication & Security Pattern

### 2.1 Current Auth Middleware

**File:** `server/middleware/supabase-auth.ts`

**Pattern:** (Need to review - marked for next step)

### 2.2 Required Auth Pattern for Edge Functions

**Every Edge Function MUST:**

```typescript
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // 1. Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 2. Extract and validate JWT
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const supabase = createSupabaseClient(req);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt);

  if (userError || !user) {
    console.error('Auth error:', userError);
    return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
  }

  // 3. Extract tenant ID from JWT metadata
  const tenantId =
    (user.app_metadata?.tenantId as string) ||
    (user.app_metadata?.tenant_id as string) ||
    (user.user_metadata?.tenantId as string) ||
    (user.user_metadata?.tenant_id as string);

  if (!tenantId) {
    console.error('No tenant ID found for user:', user.id);
    return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
  }

  // 4. Use service_role client for database operations (bypasses RLS)
  const admin = createSupabaseServiceClient();

  // 5. Always filter by tenant_id and user.id
  const { data, error } = await admin
    .from('table_name')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id);

  // 6. Return with CORS
  return createCorsResponse(data || [], 200, req);
}
```

### 2.3 RLS Policies

**Status:** ✅ Already implemented in database

All tables with `tenant_id` have RLS policies:

- SELECT: `tenant_id = auth.jwt() ->> 'tenantId'`
- INSERT/UPDATE/DELETE: Same tenant check + ownership

---

## Phase 3: Migration Priority Matrix

### High Priority (Week 1) - Core Functions

| Endpoint                  | Current    | Target  | Complexity | Users Affected |
| ------------------------- | ---------- | ------- | ---------- | -------------- |
| `/api/business-records/*` | ✅ Edge    | ✅ Done | Low        | All Sales      |
| `/api/tasks/*`            | ✅ Edge    | ✅ Done | Low        | All Users      |
| `/api/projects/*`         | ✅ Edge    | ✅ Done | Low        | All Users      |
| `/api/users`              | ✅ Edge    | ✅ Done | Low        | All Users      |
| `/api/me`                 | ❌ Express | Edge    | Low        | All Users      |
| `/api/customers/*`        | ❌ Express | Edge    | Medium     | Sales          |
| `/api/leads/:id/contacts` | ❌ Express | Edge    | Low        | Sales          |
| `/api/service-tickets/*`  | ❌ Express | Edge    | High       | Service        |

### Medium Priority (Week 2) - Supporting Functions

| Endpoint             | Current    | Target | Complexity | Users Affected |
| -------------------- | ---------- | ------ | ---------- | -------------- |
| `/api/territories/*` | ❌ Express | Edge   | Medium     | Sales Mgmt     |
| `/api/catalog/*`     | ❌ Express | Edge   | Medium     | Product Mgmt   |
| `/api/pricing/*`     | ❌ Express | Edge   | Medium     | Sales          |
| `/api/inventory/*`   | ❌ Express | Edge   | Medium     | Warehouse      |
| `/api/quotes/*`      | ❌ Express | Edge   | High       | Sales          |
| `/api/proposals/*`   | ❌ Express | Edge   | High       | Sales          |
| `/api/contacts/*`    | ❌ Express | Edge   | Low        | Sales          |
| `/api/companies/*`   | ❌ Express | Edge   | Low        | Sales          |

### Low Priority (Week 3) - Admin/Advanced

| Endpoint              | Current    | Target | Complexity | Users Affected |
| --------------------- | ---------- | ------ | ---------- | -------------- |
| `/api/reports/*`      | ❌ Express | Edge   | High       | Executives     |
| `/api/dashboard/*`    | ❌ Express | Edge   | Medium     | All Users      |
| `/api/gdpr/*`         | ❌ Express | Edge   | Medium     | Compliance     |
| `/api/import/*`       | ❌ Express | Edge   | High       | Admins         |
| `/api/enrichment/*`   | ❌ Express | Edge   | Low        | Sales Ops      |
| `/api/integrations/*` | ❌ Express | Edge   | High       | Admins         |
| `/api/ai/*`           | ❌ Express | Edge   | Medium     | Power Users    |

---

## Phase 4: Detailed Migration Tasks

### Task 1: Fix `/api/me` endpoint ❌ BROKEN

**Status:** Currently returning 404
**Impact:** User profile loading fails
**Solution:** Create or fix `supabase/functions/me/index.ts`
**Type:** Edge Function
**Estimated Time:** 30 minutes
**Dependencies:** None

### Task 2: Create `/api/customers` Edge Function

**Status:** Currently using Express route
**Impact:** Customer management broken in places
**Solution:** Create `supabase/functions/customers/index.ts`
**Type:** Edge Function
**Estimated Time:** 2 hours
**Dependencies:** None
**Migration:** Port from `server/routes-customers.ts`

### Task 3: Create `/api/service-tickets` Edge Function

**Status:** Currently using Express route
**Impact:** Service dispatch broken
**Solution:** Create `supabase/functions/service-tickets/index.ts`
**Type:** Edge Function
**Estimated Time:** 3 hours
**Dependencies:** Complex business logic
**Migration:** Port from `server/routes-service-dispatch.ts`

### Task 4: Create `/api/contacts` Edge Function

**Status:** Lead contacts failing
**Impact:** Cannot add contacts to leads
**Solution:** Merge into `business-records` function or create separate
**Type:** Edge Function Enhancement
**Estimated Time:** 1 hour
**Dependencies:** None

### Task 5: Create `/api/reports` Edge Function

**Status:** Report pages not loading
**Impact:** Executives cannot view dashboards
**Solution:** Create `supabase/functions/reports/index.ts`
**Type:** Edge Function
**Estimated Time:** 4 hours
**Dependencies:** Complex aggregations
**Migration:** Port from multiple `server/routes-reports-*.ts`

### Task 6: Create `/api/territories` Edge Function

**Status:** Territory management broken
**Impact:** Sales leadership features broken
**Solution:** Create `supabase/functions/territories/index.ts`
**Type:** Edge Function
**Estimated Time:** 2 hours
**Dependencies:** None
**Migration:** Port from `server/routes-territory-management.ts`

### Task 7: Create `/api/catalog` Edge Function

**Status:** Product catalog operations broken
**Impact:** Cannot enable/disable products
**Solution:** Create `supabase/functions/catalog/index.ts`
**Type:** Edge Function
**Estimated Time:** 2 hours
**Dependencies:** Product pricing logic
**Migration:** Port from `server/routes-catalog.ts`

### Task 8: Create `/api/pricing` Edge Function

**Status:** Pricing updates broken
**Impact:** Cannot update product pricing
**Solution:** Create `supabase/functions/pricing/index.ts`
**Type:** Edge Function
**Estimated Time:** 2 hours
**Dependencies:** Complex pricing rules
**Migration:** Port from `server/routes-pricing.ts`

### Task 9: Create `/api/inventory` Edge Function

**Status:** Inventory operations limited
**Impact:** Warehouse operations partially broken
**Solution:** Create `supabase/functions/inventory/index.ts`
**Type:** Edge Function
**Estimated Time:** 3 hours
**Dependencies:** Warehouse FPY calculations
**Migration:** Port from `server/routes-warehouse.ts`

### Task 10: Create `/api/quotes` Edge Function

**Status:** Quote creation broken
**Impact:** Cannot create quotes
**Solution:** Create `supabase/functions/quotes/index.ts`
**Type:** Edge Function
**Estimated Time:** 4 hours
**Dependencies:** Complex quote builder logic
**Migration:** Port from `server/routes/quotes-routes.ts`

---

## Phase 5: Database Schema Verification

### 5.1 Required Tables (from `shared/schema.ts`)

**Core Tables:**

- ✅ `users` - User accounts
- ✅ `tenants` - Multi-tenant data
- ✅ `business_records` - Leads/customers/prospects
- ✅ `business_record_activities` - All activities
- ✅ `tasks` - Task management
- ✅ `projects` - Project management

**Missing/Unverified Tables:**

- ❓ `service_tickets` - Service dispatch
- ❓ `inventory` - Warehouse inventory
- ❓ `quotes` - Sales quotes
- ❓ `proposals` - Sales proposals
- ❓ `territories` - Territory management
- ❓ `catalog_products` - Product catalog
- ❓ `pricing_rules` - Pricing management

**Action Required:** Run comprehensive schema sync

---

## Phase 6: Code Cleanup Plan

### 6.1 Files to Delete (After Migration Complete)

**Server Routes (120+ files):**

- All files in `server/routes-*.ts`
- All files in `server/routes/*.ts`

**Server Services:**

- `server/services/*` - Move to Edge Functions or delete

**Server Middleware:**

- `server/middleware/tenancy.ts` - No longer needed
- `server/replitAuth.ts` - Remove Replit OIDC
- Keep: `server/middleware/supabase-auth.ts` (for reference)

**Server Utils:**

- Keep: `server/utils/auth-helpers.ts` (convert to Deno)
- Delete: Old session management code

### 6.2 NPM Dependencies to Remove

After migration:

- Remove Express.js and related packages
- Remove session management packages
- Keep: Drizzle ORM (for migrations only)
- Keep: pg (for direct DB access if needed)

---

## Phase 7: Testing Strategy

### 7.1 Automated Tests

**Create Test Suite:**

```typescript
// tests/edge-functions/business-records.test.ts
describe('Business Records Edge Function', () => {
  it('should return 401 without auth');
  it('should create lead with valid token');
  it('should filter by tenant_id');
  it('should return 403 for wrong tenant');
});
```

### 7.2 Manual Testing Checklist

**Per Feature:**

- [ ] Login with test user
- [ ] Create new record
- [ ] List records (verify tenant filtering)
- [ ] Update record
- [ ] Delete record
- [ ] Verify audit logs

### 7.3 Load Testing

**After All Migration:**

- Concurrent users: 100+
- Response time: < 200ms
- Error rate: < 0.1%

---

## Phase 8: Deployment Strategy

### 8.1 Deployment Order

1. **Week 1 - Critical Functions**
   - Deploy core Edge Functions
   - Test in production with monitoring
   - Keep Express routes as fallback

2. **Week 2 - Supporting Functions**
   - Deploy supporting Edge Functions
   - Gradual traffic shift (10% → 50% → 100%)
   - Monitor error rates

3. **Week 3 - Advanced Functions**
   - Deploy remaining Edge Functions
   - Full cutover from Express
   - Remove Express routes

### 8.2 Rollback Plan

**If Issues Arise:**

1. Revert frontend to call Express routes
2. Scale up Express server
3. Debug Edge Functions
4. Redeploy with fixes

---

## Phase 9: Success Metrics

### 9.1 Technical Metrics

- ✅ All API calls use Edge Functions (0 Express calls)
- ✅ JWT validation on every function
- ✅ RLS policies enforced
- ✅ < 200ms average response time
- ✅ 99.9% uptime
- ✅ 0 authentication bypasses

### 9.2 Code Quality Metrics

- ✅ 0 NEON references
- ✅ 0 old server routes
- ✅ 100% test coverage for Edge Functions
- ✅ All Edge Functions have proper auth
- ✅ Consistent error handling

### 9.3 Business Metrics

- ✅ No user-facing errors
- ✅ Faster page load times
- ✅ Reduced server costs
- ✅ Improved scalability

---

## Immediate Next Steps (This Week)

### Day 1 (Today)

1. ✅ Complete this assessment document
2. ⏳ Fix `/api/me` endpoint (30 min)
3. ⏳ Create `/api/customers` Edge Function (2 hrs)
4. ⏳ Test core CRM flows

### Day 2

1. Create `/api/contacts` Edge Function
2. Merge or separate from business-records
3. Test lead contact management

### Day 3

1. Create `/api/service-tickets` Edge Function
2. Port complex dispatch logic
3. Test service workflows

### Day 4

1. Create `/api/territories` Edge Function
2. Create `/api/catalog` Edge Function
3. Test territory and catalog management

### Day 5

1. Create `/api/pricing` Edge Function
2. Create `/api/inventory` Edge Function
3. Test warehouse operations

---

## Appendix A: Edge Function Template

```typescript
// supabase/functions/[name]/index.ts
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) || (user.app_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const id = pathParts[1];

    // GET /function-name
    if (req.method === 'GET' && !id) {
      const { data, error } = await admin
        .from('table_name')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching records:', error);
        return createCorsResponse({ error: 'Failed to fetch records' }, 500, req);
      }

      return createCorsResponse(data || [], 200, req);
    }

    // GET /function-name/:id
    if (req.method === 'GET' && id) {
      const { data, error } = await admin
        .from('table_name')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Record not found' }, 404, req);
      }

      return createCorsResponse(data, 200, req);
    }

    // POST /function-name
    if (req.method === 'POST') {
      const body = await req.json();

      const { data, error } = await admin
        .from('table_name')
        .insert({
          ...body,
          tenant_id: tenantId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating record:', error);
        return createCorsResponse({ error: 'Failed to create record' }, 500, req);
      }

      return createCorsResponse(data, 201, req);
    }

    // PUT /function-name/:id
    if (req.method === 'PUT' && id) {
      const body = await req.json();

      const { data, error } = await admin
        .from('table_name')
        .update({
          ...body,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update record' }, 500, req);
      }

      return createCorsResponse(data, 200, req);
    }

    // DELETE /function-name/:id
    if (req.method === 'DELETE' && id) {
      const { error } = await admin
        .from('table_name')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete record' }, 500, req);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error:', error);
    return createCorsResponse({ error: 'Internal server error' }, 500, req);
  }
}
```

---

## Appendix B: Frontend Config Update

After each Edge Function is created, update `client/src/lib/config.ts` if needed:

```typescript
// No changes needed - all /api/* calls automatically route to Edge Functions
// via the apiRequest() wrapper in queryClient.ts
```

---

## Contact & Questions

For questions about this migration plan, contact the development team.

**Last Updated:** January 13, 2026
**Next Review:** January 20, 2026
