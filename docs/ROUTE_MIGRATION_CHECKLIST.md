# Route Migration Checklist - Neon to Supabase

This document tracks the status of all API routes after migrating from Neon PostgreSQL to self-hosted Supabase.

## Migration Summary

**Database**: Self-hosted Supabase at `209.145.59.219:5555`
**Auth Method**: Supabase JWT (GoTrue) with `Authorization: Bearer <token>`
**Tenant Resolution**: Via `x-tenant-id` header or JWT `app_metadata.tenantId`

---

## Key Changes Made

### Authentication Middleware
- [x] `server/middleware/tenancy.ts` - Added `x-tenant-id` header support
- [x] `server/replitAuth.ts` - `isAuthenticated` now supports Supabase JWT
- [x] `server/middleware/supabase-auth.ts` - JWT validation middleware ready
- [x] `server/utils/auth-helpers.ts` - NEW: Unified auth utility functions

### Auth Pattern Fix
Changed from: `req.user.claims.tenantId` / `req.user.claims.sub`
Changed to: `req.user?.tenantId || req.user?.claims?.tenantId` / `req.user?.id || req.user?.claims?.sub`

---

## Route Status by Category

### Legend
- ✅ Fixed & Verified
- ⚠️ Needs Review
- ❌ Broken
- 🔄 Not Yet Tested

---

## CRM / Business Records
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-business-records.ts` | ✅ | Fixed auth flow for create/update |
| `routes-crm-goals.ts` | ✅ | Fixed `req.user.claims.sub` pattern |
| `routes-deals-management.ts` | ✅ | Fixed userId pattern |
| `routes-deal-desk.ts` | ✅ | Fixed userId pattern |
| `routes-opportunities.ts` | ✅ | Fixed userId pattern |
| `routes-data-enrichment.ts` | ✅ | Fixed userId pattern |
| `routes-lead-assignment.ts` | 🔄 | Needs testing |
| `routes-auto-lead-routing.ts` | 🔄 | Needs testing |
| `routes-customer-success.ts` | 🔄 | Needs testing |
| `routes-customer-portal.ts` | ⚠️ | Uses session patterns |
| `routes-customer-numbers.ts` | ⚠️ | Uses session patterns |
| `routes-platform-business-records.ts` | 🔄 | Needs testing |
| `routes-platform-deals.ts` | 🔄 | Needs testing |
| `routes-platform-customer-success.ts` | 🔄 | Needs testing |
| `routes-territory-management.ts` | 🔄 | Needs testing |
| `routes-sales-handoff.ts` | 🔄 | Needs testing |
| `routes-sales-pipeline.ts` | ⚠️ | Temporarily disabled |

---

## Inventory / Products / Warehouse
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-warehouse.ts` | ✅ | Fixed tenantId and userId patterns |
| `routes-warehouse-fpy.ts` | 🔄 | Needs testing |
| `routes-purchase-orders.ts` | ✅ | Fixed tenantId and userId patterns |
| `routes-product-models.ts` | ⚠️ | Uses `req.user!.tenantId` - should work |
| `routes-product-pricing.ts` | 🔄 | Needs testing |
| `routes-software-products.ts` | 🔄 | Needs testing |
| `routes-catalog.ts` | 🔄 | Needs testing |

---

## Service Management
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-service-dispatch.ts` | ✅ | Uses Router pattern with RBAC |
| `routes-service-analysis.ts` | ✅ | No problematic patterns found |
| `routes-enhanced-service.ts` | ✅ | No problematic patterns found |
| `routes-technician-management.ts` | 🔄 | Needs testing |
| `routes-mobile-technician.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-predictive-service-dispatch.ts` | 🔄 | Needs testing |
| `routes-proactive-maintenance.ts` | 🔄 | Needs testing |
| `routes-preventive-maintenance.ts` | 🔄 | Needs testing |
| `routes-predictive-maintenance-hub.ts` | 🔄 | Needs testing |

---

## Billing / Invoices
| Route File | Status | Notes |
|------------|--------|-------|
| `routes/billing.ts` | 🔄 | Consolidated billing routes |
| `routes/advanced-billing-routes.ts` | 🔄 | Needs testing |
| `routes/automated-billing-routes.ts` | 🔄 | Needs testing |
| `routes-subscriptions.ts` | 🔄 | Needs testing |
| `routes-admin-subscriptions.ts` | 🔄 | Needs testing |
| `routes-commission.ts` | 🔄 | Needs testing |
| `routes-pricing.ts` | 🔄 | Needs testing |

---

## Reports / Analytics
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-reporting.ts` | 🔄 | Needs testing |
| `routes-reporting-architecture.ts` | ⚠️ | Uses `isAuthenticated` pattern |
| `routes-custom-reports.ts` | ⚠️ | Uses `req.user?.id || req.session?.userId` |
| `routes-analytics.ts` | 🔄 | Needs testing |
| `routes-predictive-analytics.ts` | ⚠️ | Uses session pattern |
| `routes/reporting-api.ts` | 🔄 | Needs testing |
| `routes/sales-reports-api.ts` | 🔄 | Needs testing |
| `routes/service-reports-api.ts` | 🔄 | Needs testing |
| `routes/director-reports-api.ts` | 🔄 | Needs testing |
| `routes/executive-reports-api.ts` | 🔄 | Needs testing |

---

## Tasks / Projects
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-tasks.ts` | ⚠️ | Already uses hybrid pattern |
| `routes-enhanced-tasks.ts` | 🔄 | Needs testing |
| `routes-templates.ts` | 🔄 | Needs testing |
| `routes/task-routes.ts` | 🔄 | Needs testing |

---

## Documents / Knowledge Base
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-documents.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-document-automation.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-document-management.ts` | 🔄 | Needs testing |
| `routes-knowledge-base.ts` | ✅ | Fixed - Added getUserId helper |
| `routes/knowledge-base-routes.ts` | 🔄 | Needs testing |
| `routes/knowledge-base-admin-routes.ts` | 🔄 | Needs testing |

---

## Integrations
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-integrations.ts` | 🔄 | Needs testing |
| `routes-salesforce-integration.ts` | 🔄 | Needs testing |
| `routes-quickbooks-integration.ts` | 🔄 | Needs testing |
| `routes-manufacturer-integration.ts` | 🔄 | Needs testing |
| `routes-integration-hub.ts` | 🔄 | Needs testing |
| `routes-erp-integration.ts` | 🔄 | Needs testing |
| `routes/calendar-routes.ts` | 🔄 | Needs testing |
| `routes/apollo-routes.ts` | 🔄 | Needs testing |
| `routes/sso-routes.ts` | 🔄 | Needs testing |

---

## Admin / Platform
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-root-admin.ts` | ⚠️ | Uses hybrid pattern |
| `routes-admin-workflows.ts` | ⚠️ | Uses session pattern |
| `routes-tenant-onboarding.ts` | ⚠️ | Uses session pattern |
| `routes-enhanced-rbac.ts` | ⚠️ | Uses session pattern |
| `routes-user-lifecycle.ts` | ⚠️ | Uses session pattern |
| `routes-onboarding.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-trial.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-white-label.ts` | 🔄 | Needs testing |
| `routes-settings.ts` | 🔄 | Needs testing |

---

## Security / Compliance
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-security-compliance.ts` | 🔄 | Needs testing |
| `routes-breach-detection.ts` | 🔄 | Needs testing |
| `routes-incident-response.ts` | 🔄 | Needs testing |
| `routes-gdpr-core.ts` | 🔄 | Needs testing |
| `routes/mfa-routes.ts` | 🔄 | Needs testing |
| `routes/api-key-routes.ts` | 🔄 | Needs testing |

---

## Equipment / Fleet
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-equipment-lifecycle-state-machine.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-equipment-disposal.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-equipment-qr.ts` | 🔄 | Needs testing |
| `routes-client-monitoring.ts` | ⚠️ | Uses session check |
| `routes-device-monitoring.ts` | 🔄 | Needs testing |
| `routes-remote-monitoring.ts` | 🔄 | Needs testing |
| `routes/gps-tracking-routes.ts` | 🔄 | Needs testing |
| `routes/route-optimization-routes.ts` | 🔄 | Needs testing |
| `routes/mileage-routes.ts` | 🔄 | Needs testing |
| `routes/geofence-alerts-routes.ts` | 🔄 | Needs testing |

---

## AI Features
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-ai-analytics.ts` | 🔄 | Needs testing |
| `routes-ai-gpt5.ts` | ⚠️ | Uses session pattern |
| `routes/ai-documentation-routes.ts` | 🔄 | Needs testing |
| `routes/ai-employee-routes.ts` | 🔄 | Needs testing |
| `routes/ai-search-knowledge-routes.ts` | 🔄 | Needs testing |
| `routes/ai-routes-simple.ts` | 🔄 | Needs testing |

---

## Other
| Route File | Status | Notes |
|------------|--------|-------|
| `routes-dashboard-layouts.ts` | ⚠️ | Uses `req.user?.id || req.session?.userId` |
| `routes-csv-import.ts` | ⚠️ | Uses `req.user?.id || req.session?.userId` |
| `routes-today-dashboard.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-modular-dashboard.ts` | 🔄 | Needs testing |
| `routes-universal-search.ts` | 🔄 | Needs testing |
| `routes-email-parser.ts` | ✅ | Fixed - Added getUserId helper |
| `routes-proposals.ts` | ⚠️ | Uses session pattern |
| `routes-content-marketing.ts` | 🔄 | Needs testing |
| `routes-social-media.ts` | ⚠️ | Uses session pattern |
| `routes-print-cost-calculator.ts` | 🔄 | Needs testing |
| `routes-demo-scheduling.ts` | 🔄 | Needs testing |
| `routes-esignature.ts` | 🔄 | Needs testing |
| `routes-contract-alerts.ts` | 🔄 | Needs testing |
| `routes-contract-renewal.ts` | 🔄 | Needs testing |
| `routes-renewal-management.ts` | 🔄 | Needs testing |
| `routes-workflow-automation.ts` | 🔄 | Needs testing |
| `routes-intelligent-alerts.ts` | 🔄 | Needs testing |
| `routes-company-ids.ts` | ⚠️ | Uses session pattern |
| `routes-signup-crm.ts` | 🔄 | Needs testing |
| `routes-export.ts` | 🔄 | Needs testing |
| `routes-pagination.ts` | 🔄 | Needs testing |
| `routes-pipeline-configuration.ts` | 🔄 | Needs testing |
| `routes-validate.ts` | 🔄 | Needs testing |
| `routes-clickup-tasks.ts` | 🔄 | Needs testing |
| `routes-client-metrics.ts` | 🔄 | Needs testing |
| `routes-dod-enforcement.ts` | 🔄 | Needs testing |
| `routes-business-process-optimization.ts` | 🔄 | Needs testing |
| `routes-platform-activities.ts` | 🔄 | Needs testing |
| `routes-platform-analytics.ts` | 🔄 | Needs testing |
| `routes-auto-supply-replenishment.ts` | 🔄 | Needs testing |
| `routes-sales-forecasting.ts` | 🔄 | Needs testing |

---

## Priority Files to Fix (⚠️ Status)

These files previously used session-only patterns. **All have been fixed to support Supabase JWT:**

1. ✅ `routes-mobile-technician.ts` - **FIXED** - Added getUserId helper
2. ✅ `routes-knowledge-base.ts` - **FIXED** - Added getUserId helper
3. ✅ `routes-documents.ts` - **FIXED** - Added getUserId and getTenantId helpers
4. ✅ `routes-document-automation.ts` - **FIXED** - Added getUserId helper
5. ✅ `routes-onboarding.ts` - **FIXED** - Added getUserId and getRequestTenantId helpers
6. ✅ `routes-trial.ts` - **FIXED** - Added getUserId helper
7. ✅ `routes-email-parser.ts` - **FIXED** - Added getUserId helper
8. ✅ `routes-equipment-lifecycle-state-machine.ts` - **FIXED** - Added getUserId helper
9. ✅ `routes-equipment-disposal.ts` - **FIXED** - Added getUserId helper
10. ✅ `routes-today-dashboard.ts` - **FIXED** - Added getUserId helper

---

## Testing Checklist

### Core CRM
- [ ] Create business record
- [ ] Update business record
- [ ] List business records
- [ ] Get single business record
- [ ] Create/list contacts for business record
- [ ] Create/list activities for business record
- [ ] Convert lead to customer

### Inventory
- [ ] List inventory items
- [ ] Create inventory item
- [ ] Warehouse operations CRUD
- [ ] Purchase orders CRUD

### Service
- [ ] List service tickets
- [ ] Create service ticket
- [ ] Dispatch recommendations
- [ ] Phone-in tickets

### Products
- [ ] List product models
- [ ] Get product details
- [ ] Product pricing

### Reports
- [ ] Dashboard data loading
- [ ] Custom reports

---

## How to Test

1. Start dev server: `npm run dev`
2. Log in via frontend (Supabase auth)
3. Open browser DevTools → Network tab
4. Navigate to each page and verify:
   - API calls return 200 status
   - Data loads correctly
   - No 401/403 errors
   - Console has no errors

---

## Quick Fix Pattern

For files that need updating, change:

```typescript
// FROM:
const userId = req.session.userId;
const tenantId = req.user.claims.tenantId;

// TO:
const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
const tenantId = req.user?.tenantId || req.user?.claims?.tenantId || req.session?.tenantId;
```

Or use the new helper:
```typescript
import { getUserId, getTenantId } from '../utils/auth-helpers';

const userId = getUserId(req);
const tenantId = getTenantId(req);
```
