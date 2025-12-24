# Routes Refactor Strategy

**Status**: 📊 In Progress
**Priority**: 🔴 High (Technical Debt)
**Impact**: Performance, Maintainability, Security

---

## 🎯 Goal

Eliminate the monolithic `server/routes.ts` file (15,515 lines, 513KB) by migrating all inline route definitions to modular route files.

---

## 📊 Current State

- **Monolithic routes.ts**: 15,515 lines, 513KB
- **Inline routes**: 225 route definitions still in routes.ts
- **Modular files**: 165 route files already exist
- **Auth migration**: ✅ **COMPLETED** - Unified auth middleware now active

---

## ✅ Auth Migration Complete (Dec 24, 2025)

**What was done:**
- Enhanced `server/routes.ts` with 3-phase auth middleware:
  1. **Phase 1**: Always try Supabase JWT first (non-blocking)
  2. **Phase 2**: Populate `req.user` for backward compatibility
  3. **Phase 3**: Require authentication using unified helpers

**Impact:**
- ✅ ALL routes now support both Supabase JWT and session auth
- ✅ Unified auth helpers (`getUserId`, `getTenantId`) work across entire app
- ✅ No breaking changes - full backward compatibility
- ✅ Security improved across 225+ routes with ONE change

**Files Modified:**
- `server/routes.ts:651-710` - Enhanced auth middleware stack

---

## 📋 Routes Migration Roadmap

### **Phase 1: High-Traffic Routes** (Priority: Highest)

Migrate frequently-used business-critical routes first:

```
/api/business-records/*       → routes-business-records.ts (EXISTS)
/api/customers/*               → routes-customers.ts (NEW)
/api/deals/*                   → routes-deals-management.ts (EXISTS)
/api/service-dispatch/*        → routes-service-dispatch.ts (EXISTS)
/api/invoices/*                → routes-invoices.ts (EXISTS)
```

**Estimated Impact**: 40-50 routes (18% of inline routes)

### **Phase 2: Domain-Specific Routes** (Priority: High)

Group by business domain:

**Commission & Compensation**
```
/api/commission/*              → routes-commission.ts (NEW)
```

**Customer Success**
```
/api/customer-success/*        → routes-customer-success.ts (EXISTS)
```

**Analytics & Reporting**
```
/api/analytics/*               → routes-analytics.ts (NEW)
/api/billing/analytics         → routes-billing-analytics.ts (NEW)
```

**Catalog Management**
```
/api/catalog/*                 → routes-catalog.ts (NEW)
/api/master-catalog/*          → routes-master-catalog.ts (NEW)
```

**Financial Operations**
```
/api/accounts-payable/*        → routes-accounts-payable.ts (EXISTS)
/api/accounts-receivable/*     → routes-accounts-receivable.ts (EXISTS)
/api/chart-of-accounts/*       → routes-chart-of-accounts.ts (NEW)
/api/journal-entries/*         → routes-journal-entries.ts (NEW)
```

**Estimated Impact**: 80-100 routes (36% of inline routes)

### **Phase 3: Remaining Routes** (Priority: Medium)

Migrate all remaining routes:

```
/api/activities/*              → routes-activities.ts (NEW)
/api/automation/*              → routes-automation.ts (NEW)
/api/contacts/*                → routes-contacts.ts (EXISTS)
/api/companies/*               → routes-companies.ts (NEW)
/api/contract-tiered-rates/*   → routes-contract-rates.ts (NEW)
```

**Estimated Impact**: 85-95 routes (46% of inline routes)

---

## 🏗️ Migration Pattern

### **1. Create Modular Route File**

```typescript
// server/routes-[domain].ts
import { Router } from 'express';
import { db } from './db';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { protectedRoute } from './middleware/supabase-auth';

const router = Router();

// Routes automatically have unified auth via global middleware
// Use protectedRoute middleware for additional protection
router.get('/api/[domain]', async (req, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required' });
    }

    // Your route logic here
    const data = await db.query.[domain].findMany({
      where: { tenantId }
    });

    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export function register[Domain]Routes(app: Express) {
  app.use(router);
}

export default router;
```

### **2. Register in routes.ts**

```typescript
// server/routes.ts
import { register[Domain]Routes } from './routes-[domain]';

export async function registerRoutes(app: Express): Promise<Server> {
  // ... existing middleware ...

  // Register modular routes
  register[Domain]Routes(app);

  // ... rest of setup ...
}
```

### **3. Remove from Inline**

Delete the route definitions from `routes.ts` after verifying the modular version works.

---

## 🧪 Testing Strategy

For each migrated route:

1. **Build verification**: `npm run build` - No TypeScript errors
2. **Endpoint test**: Test the route with both JWT and session auth
3. **Tenant isolation**: Verify tenant filtering works
4. **Error handling**: Test error cases (missing tenant, invalid data)

---

## 📈 Success Metrics

### **Completion Criteria**

- [ ] All 225 inline routes migrated to modular files
- [ ] `routes.ts` contains ONLY registration logic (< 1,000 lines)
- [ ] All routes use unified auth helpers
- [ ] Build completes successfully
- [ ] All E2E tests pass

### **Expected Benefits**

**Performance**:
- 🚀 Faster server startup (smaller routes.ts)
- 🚀 Better code splitting and lazy loading
- 🚀 Reduced memory footprint

**Maintainability**:
- 📝 Easier to find routes (organized by domain)
- 📝 Smaller files = easier to review
- 📝 Clear separation of concerns

**Security**:
- 🔒 Consistent auth patterns
- 🔒 Easier to audit
- 🔒 Better tenant isolation

---

## 🚀 Quick Start

To migrate a route:

```bash
# 1. Create new route file
touch server/routes-[domain].ts

# 2. Copy route definitions from routes.ts
# 3. Implement registration function
# 4. Import and register in routes.ts
# 5. Test the endpoint
# 6. Delete from routes.ts
# 7. Run build: npm run build
# 8. Commit changes
```

---

## 📚 Related Documentation

- [Supabase Migration Guide](./SUPABASE_MIGRATION_GUIDE.md)
- [RBAC Implementation](./RBAC_IMPLEMENTATION.md)
- [Route Migration Checklist](./ROUTE_MIGRATION_CHECKLIST.md)

---

**Last Updated**: December 24, 2025
**Next Review**: January 15, 2026
