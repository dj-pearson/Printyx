# Supabase Migration & Data Integrity Findings

**Date:** 2025-12-20
**Purpose:** Comprehensive audit of database connections, stubbed functionality, and hardcoded data

---

## Executive Summary

This document identifies all issues that need to be addressed to ensure:
1. All connections route to the self-hosted Supabase at `209.145.59.219:5433`
2. All functionality displays real data from the database
3. No hardcoded example data or placeholder values in production code

---

## 1. CRITICAL: Connection Configuration Issues

### 1.1 Mobile App API URL - FIXED ✅
**File:** `mobile-app/src/services/api.ts:14-16`
**Status:** Fixed on 2025-12-20
```typescript
const baseURL = __DEV__
  ? 'http://localhost:5000/api' // Development
  : 'https://api.printyx.net/api'; // Production
```

- [x] Update mobile app API URL to use `api.printyx.net`

### 1.2 Frontend Placeholder Fallbacks - FIXED ✅
**File:** `client/src/lib/config.ts:38-44`
**Status:** Fixed on 2025-12-20
```typescript
url: useProxy
  ? getOriginUrl()
  : import.meta.env.VITE_SUPABASE_URL || 'https://api.printyx.net',
anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
functionsUrl: useProxy
  ? `${getOriginUrl()}/functions`
  : import.meta.env.VITE_FUNCTIONS_URL || 'https://functions.printyx.net',
```

- [x] Remove or update placeholder fallbacks in config.ts

### 1.3 Desktop App Default URL
**File:** `printyx-desktop/src/main/main.ts:23`
```typescript
serverUrl: { type: 'string', default: 'https://app.printyx.net' },
```
**Status:** This appears correct (using printyx.net domain)

- [x] Desktop app uses correct domain

---

## 2. CRITICAL: Hardcoded/Random Data in Production Routes

### 2.1 Customer Health Reports (STUBBED)
**File:** `server/routes-reports.ts:168-182`
**Issue:** Health scores are randomly generated instead of calculated
```typescript
const healthScore = Math.floor(Math.random() * 100);
const avgHealthScore = Math.round(allCustomers.length > 0
  ? (Math.floor(Math.random() * 50) + 50)
  : 0);
```

- [ ] Implement real health score calculation based on:
  - Service history
  - Payment history
  - Engagement metrics
  - Contract status

### 2.2 Technician Utilization Reports (STUBBED)
**File:** `server/routes-reports.ts:211-217`
**Issue:** Utilization metrics are randomly generated
```typescript
const utilizationPercent = Math.floor(Math.random() * 100);
averageTicketTime: Math.floor(Math.random() * 120) + 30
```

- [ ] Implement real utilization calculation based on:
  - Actual time tracking data
  - Service call durations
  - Travel time between jobs

### 2.3 Remote Monitoring Historical Data (STUBBED)
**File:** `server/routes-remote-monitoring.ts:316-332`
**Issue:** Historical data is generated with random values
```typescript
temperature: Array.from({ length: 24 }, (_, i) => ({
  timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
  value: 40 + Math.random() * 8, // ← Random
  status: 'normal'
})),
powerConsumption: Array.from({ length: 24 }, (_, i) => ({
  value: 300 + Math.random() * 400, // ← Random
})),
utilizationRate: Array.from({ length: 24 }, (_, i) => ({
  value: Math.random() * 100, // ← Random
})),
```

- [ ] Implement real SNMP data collection and storage
- [ ] Query historical data from database

### 2.4 Client Monitoring Dashboard (PARTIALLY STUBBED)
**File:** `server/routes-client-monitoring.ts:1087-1088`
**Issue:** Summary metrics are hardcoded
```typescript
averageUptime: 96.8, // TODO: Calculate from uptime metrics
fleetUtilization: 78.5, // TODO: Calculate from usage patterns
```

- [ ] Implement uptime tracking in database
- [ ] Calculate fleet utilization from actual usage data

### 2.5 Integration Dashboard (STUBBED)
**File:** `server/integrations/dashboard-service.ts:91-99`
**Issue:** All metrics are randomly generated
```typescript
recordsSynced: Math.floor(Math.random() * 10000), // TODO: Track real metrics
apiCallsToday: Math.floor(Math.random() * 1000),
successRate: integration.status === 'connected' ? 95 + Math.random() * 4 : 0,
averageLatency: 150 + Math.floor(Math.random() * 200),
dataVolume: Math.round(Math.random() * 3 * 10) / 10,
errorCount: integration.status === 'error' ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 3),
```

- [ ] Create integration metrics table
- [ ] Track actual API calls and success rates
- [ ] Store latency measurements

### 2.6 Integration Routes (STUBBED)
**File:** `server/integrations/routes.ts:72-88`
**Issue:** Same random data pattern as dashboard-service
```typescript
recordsSynced: Math.floor(Math.random() * 10000), // TODO: Replace with real data
apiCallsToday: Math.floor(Math.random() * 1000),
```

- [ ] Same fix as 2.5 above

### 2.7 Preventive Maintenance Cost Savings (STUBBED)
**File:** `server/routes-preventive-maintenance.ts:493`
**Issue:** Cost savings estimate is random
```typescript
estimatedCostSavings: Math.floor(Math.random() * 300) + 200
```

- [ ] Implement actual cost savings calculation based on:
  - Historical repair costs
  - Prevented failures
  - Parts costs

### 2.8 SEO Position Tracking (STUBBED)
**File:** `server/routes-seo.ts:1229`
**Issue:** Position data is randomly generated
```typescript
return Math.floor(Math.random() * 50) + 1;
```

- [ ] Integrate with actual SERP API (SERPApi or DataForSEO)

---

## 3. Neon Database References - RESOLVED ✅

All Neon database references have been migrated to use the standard `pg` module.

### 3.1 Test User Creation Script
**File:** `create-test-user.ts`
**Status:** ✅ Already using standard `pg` module

- [x] Update to use standard `pg` module

### 3.2 Auth Connection Test Script
**File:** `test-auth-connection.ts`
**Status:** ✅ Already using standard `pg` module

- [x] Update to use standard `pg` module

### 3.3 Database Export Scripts
**Files:**
- `export-database.js`
- `export-csv.js`
- `export-simple.js`

**Status:** ✅ All using standard `pg` Pool

- [x] Update to use standard `pg` Pool

### 3.4 Connection Resilience Comments
**File:** `server/lib/connection-resilience.ts:118`
**Issue:** Comment mentions Neon transient errors (cosmetic only)

- [ ] Update comment to reference PostgreSQL errors generically (low priority)

---

## 4. Documentation with Old Cloud Supabase References

### 4.1 ENV Setup Guide
**File:** `ENV_SETUP_GUIDE.md`
**Lines:** 24, 27, 78, 117, 142
**Issue:** References `supabase.co` cloud URLs

- [ ] Update to reference self-hosted `api.printyx.net`

### 4.2 Cloudflare Pages Setup
**File:** `CLOUDFLARE_PAGES_SETUP.md`
**Lines:** 59, 63, 95
**Issue:** Contains `your-project-id.supabase.co` placeholders

- [ ] Update to show `api.printyx.net` and `functions.printyx.net`

### 4.3 SEO Duplication Guide
**File:** `SEO_DUPLICATION_GUIDE.md`
**Lines:** 351, 584, 753, 814
**Issue:** References `your-project.supabase.co`

- [ ] Update to show self-hosted URLs

---

## 5. TODOs Indicating Incomplete Functionality

### 5.1 Calendar Integration (Priority: HIGH)
**File:** `client/src/components/calendar/CalendarProvider.tsx:73-183`
```typescript
// TODO: Implement OAuth flow for calendar providers
// TODO: Implement actual API calls
// TODO: Implement actual API calls for updating events
// TODO: Implement actual API calls for deleting events
```

- [ ] Implement Google Calendar OAuth flow
- [ ] Implement Microsoft Calendar OAuth flow
- [ ] Wire up CRUD operations to backend APIs

### 5.2 Service Report PDF Generation
**File:** `server/routes-mobile-technician.ts:302-303`
```typescript
// TODO: Generate PDF service report
// TODO: Send email to customer
```

- [ ] Implement PDF generation (puppeteer or react-pdf)
- [ ] Integrate with email service

### 5.3 E-Signature Provider Integration
**File:** `server/routes/signature-routes.ts:354-689`
```typescript
// TODO: Integrate with actual e-signature provider (DocuSign, Adobe Sign, etc.)
// TODO: Verify webhook signature
// TODO: Process DocuSign events and update signature requests accordingly
```

- [ ] Choose e-signature provider
- [ ] Implement provider integration
- [ ] Set up webhook handlers

### 5.4 Email Parser Connection Test
**File:** `server/routes-email-parser.ts:160`
```typescript
// TODO: Implement actual IMAP connection test
```

- [ ] Implement IMAP connection testing

### 5.5 Lead Scoring
**File:** `server/routes-today-dashboard.ts:95`
```typescript
// TODO: Implement lead scoring when leadScoring table is available
```

- [ ] Create lead scoring table if not exists
- [ ] Implement AI-powered lead scoring

### 5.6 Chrome Extension API Keys
**File:** `server/routes/chrome-extension-routes.ts:464-519`
```typescript
// TODO: Store API key in database (create extension_api_keys table)
// TODO: Add expiration
// TODO: Check ZoomInfo when implemented
```

- [ ] Create extension_api_keys table
- [ ] Implement key storage and rotation
- [ ] Add ZoomInfo integration check

### 5.7 Predictive Service Dispatch
**File:** `server/services/predictive-service-dispatch-service.ts:443-506`
```typescript
technicianName: tech.userId, // TODO: Join with users table
distance: 10, // TODO: Calculate actual distance
// TODO: Create service call in database
// TODO: Actually create purchase orders
```

- [ ] Implement user table join for names
- [ ] Integrate distance calculation API (Google Maps)
- [ ] Implement service call creation
- [ ] Implement purchase order creation

### 5.8 Auto Lead Routing Service
**File:** `server/services/auto-lead-routing-service.ts:397-468`
```typescript
userName: rep.userId, // TODO: Join with users table for actual name
// TODO: Integrate with email service
```

- [ ] Implement user table join
- [ ] Integrate notification emails

### 5.9 Equipment Lifecycle
**File:** `server/services/equipment-lifecycle-state-machine.ts:460-466`
```typescript
// TODO: Integrate with QR code generation service
// TODO: Schedule follow-up service check
```

- [ ] Implement QR code generation
- [ ] Implement follow-up scheduling

### 5.10 Billing Tax Calculation
**File:** `server/routes-client-monitoring.ts:1447`
```typescript
const tax = 0; // TODO: Calculate based on location/tax rules
```

- [ ] Implement tax calculation based on customer location
- [ ] Consider integration with tax service (Avalara, TaxJar)

---

## 6. Seed Data vs Production Data

### 6.1 Seed Files (Acceptable for Development)
These files contain sample data for development/testing purposes:
- `server/seed-lease-data.ts`
- `server/seed-signature-data.ts`
- `server/seed-advanced-billing.ts`
- `server/seed-field-service-data.ts`
- `server/seed-mfa-data.ts`
- `server/seed-email-marketing-data.ts`
- `server/seed-oid-mappings.ts`

**Status:** These are appropriate for seeding dev/test databases

### 6.2 CSV Import Sample Data (Acceptable)
**File:** `client/src/components/leads/LeadsImport.tsx:83-111`
**Status:** This is template data for user guidance during CSV imports - appropriate

---

## 7. Security Considerations

### 7.1 Placeholder Keys in Config
**Issue:** `client/src/lib/config.ts` has `'placeholder-key'` as fallback
**Risk:** Could expose that keys are missing in logs/errors

- [ ] Improve error messaging when keys are missing

### 7.2 Example Emails in Code
Multiple files contain `example.com` emails which is fine for examples/documentation:
- CSV schema examples
- Form placeholders
- Test scripts

**Status:** Acceptable - these are for documentation/placeholder purposes

---

## 8. Recommended Priority Order

### Phase 1: Critical Connection Fixes ✅ COMPLETE
1. [x] Fix mobile app API URL (`api.printyx.net`) - Fixed 2025-12-20
2. [x] Remove/update config.ts placeholders - Fixed 2025-12-20
3. [x] Neon imports already migrated to standard `pg`

### Phase 2: Core Business Data
1. [ ] Implement real customer health scores
2. [ ] Implement real technician utilization metrics
3. [ ] Implement integration metrics tracking

### Phase 3: Device Monitoring Data
1. [ ] Implement SNMP data storage
2. [ ] Calculate real uptime/utilization from stored data
3. [ ] Store and query historical device data

### Phase 4: Integrations & Workflows
1. [ ] Complete calendar OAuth integration
2. [ ] Implement e-signature provider
3. [ ] Complete email parser IMAP testing

### Phase 5: Documentation Updates
1. [ ] Update ENV_SETUP_GUIDE.md
2. [ ] Update CLOUDFLARE_PAGES_SETUP.md
3. [ ] Update SEO_DUPLICATION_GUIDE.md

---

## 9. Testing Checklist

After each fix, verify:
- [ ] Development environment works
- [ ] Data displays correctly in UI
- [ ] API responses contain real data (not random)
- [ ] No console errors about missing configuration
- [ ] Database queries execute successfully

---

## Appendix: Files Confirmed Working

### Database Connection
- `server/db.ts` - ✅ Properly configured for self-hosted Supabase
- `drizzle.config.ts` - ✅ Uses DATABASE_URL environment variable
- `.env.example` - ✅ Has correct self-hosted Supabase configuration

### Authentication
- `server/middleware/supabase-auth.ts` - ✅ JWT validation ready
- `server/utils/auth-helpers.ts` - ✅ Unified auth utilities
- `client/src/lib/supabase.ts` - ✅ Uses config for Supabase client

### CORS Configuration
- `server/index.ts` - ✅ Includes `printyx.net` domains
- `supabase/functions/_shared/cors.ts` - ✅ Proper origin whitelist
- `functions/**/*.ts` - ✅ Cloudflare functions have correct CORS

---

**Document Version:** 1.0
**Last Updated:** 2025-12-20
**Next Review:** After Phase 1 completion
