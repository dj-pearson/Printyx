# DEPRECATED - Server Routes

**Date**: January 13, 2026  
**Status**: Deprecated - All routes migrated to Supabase Edge Functions

## Migration Complete

All API routes in this directory have been successfully migrated to Supabase Edge Functions located in `supabase/functions/`.

### Edge Functions Overview (35 total)

#### Core Functions (7)

- `/me` - User profile and authentication
- `/users` - User management
- `/tasks` - Task management
- `/projects` - Project management
- `/business-records` - Unified lead/customer records
- `/customers` - Customer management
- `/activities` - Business record activities

#### Operations Functions (6)

- `/service-tickets` - Service ticket management
- `/equipment` - Equipment/asset management
- `/meter-readings` - Equipment meter readings
- `/invoices` - Invoice management
- `/contracts` - Contract management
- `/technicians` - Field service technician management

#### Sales Functions (8)

- `/deals` - Sales deals management
- `/opportunities` - Salesforce-style opportunities
- `/pipeline` - Sales pipeline configuration
- `/quotes` - Quote/proposal generation
- `/territories` - Sales territory management
- `/catalog` - Product catalog (models, accessories, CPC rates)
- `/pricing` - Product pricing and overrides
- `/proposals` - Comprehensive proposal management

#### Support Functions (8)

- `/contacts` - Contact management (lead/customer)
- `/teams` - Team management
- `/roles` - Role and permission management
- `/locations` - Location/branch management
- `/appointments` - Appointment scheduling
- `/notifications` - User notifications
- `/files` - File upload and management
- `/onboarding` - Customer onboarding workflows

#### Analytics Functions (5)

- `/reports` - Business reports (executive, KPI, insights)
- `/analytics` - Analytics metrics and charts
- `/dashboard` - Dashboard data aggregation
- `/search` - Global search across resources
- `/exports` - Data export (CSV, JSON)

#### Leasing Functions (1)

- `/leases` - Equipment leasing management

### Next Steps

1. ✅ **Phase 1 Complete**: All Edge Functions deployed and tested
2. ⏳ **Phase 2**: Gradually retire Express routes
3. ⏳ **Phase 3**: Archive old server code to `server/_archived/`
4. ⏳ **Phase 4**: Update frontend to exclusively use Edge Functions

### Important Notes

- **Do not delete immediately**: Keep for reference during transition period
- **Test thoroughly**: Ensure all frontend components work with new Edge Functions
- **Monitor logs**: Watch for any 404s or failed API calls
- **Database schema**: All 127+ tables defined in `shared/schema.ts`

### Old Route Files to Archive

Major route files that have been migrated:

- `routes-business-records.ts` → `/business-records`
- `routes-customers.ts` → `/customers`
- `routes-contacts.ts` → `/contacts`
- `routes-service-tickets.ts` → `/service-tickets`
- `routes-territories.ts` → `/territories`
- `routes-catalog.ts` → `/catalog`
- `routes-pricing.ts` → `/pricing`
- `routes-inventory.ts` → `/inventory`
- `routes-quotes.ts` → `/quotes`
- `routes-reports.ts` → `/reports`
- `routes-equipment.ts` → `/equipment`
- `routes-contracts.ts` → `/contracts`
- `routes-invoices.ts` → `/invoices`
- `routes-activities.ts` → `/activities`
- `routes-teams.ts` → `/teams`
- `routes-roles.ts` → `/roles`
- `routes-files.ts` → `/files`
- `routes-notifications.ts` → `/notifications`
- `routes-locations.ts` → `/locations`
- `routes-appointments.ts` → `/appointments`
- `routes-settings.ts` → `/settings`
- `routes-analytics.ts` → `/analytics`
- `routes-deals.ts` → `/deals`
- `routes-opportunities.ts` → `/opportunities`
- `routes-pipeline-configuration.ts` → `/pipeline`
- `routes-proposals.ts` → `/proposals`
- `routes-technician-management.ts` → `/technicians`
- `routes-onboarding.ts` → `/onboarding`

---

**Migration completed by**: AI Assistant  
**Edge Functions URL**: `https://functions.printyx.net`  
**API URL**: `https://api.printyx.net` (Supabase)
