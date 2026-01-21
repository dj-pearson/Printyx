# Database Migration Checklist

## ⚠️ CRITICAL: Missing Migrations and Hooks

### Current Status

- ✅ 35 Edge Functions deployed
- ✅ Schema defined in `shared/schema.ts` (127+ tables)
- ⚠️ **NO comprehensive migrations in Supabase**
- ⚠️ **NO database triggers/hooks configured**
- ⚠️ **Loose SQL files not consolidated**

### Issues Found

1. **Old Migrations (NEON)** - `migrations/0000_remarkable_venom.sql`
   - 4500+ lines of CREATE TABLE statements
   - From old NEON database
   - Not applied to Supabase

2. **Incomplete Supabase Migrations** - `supabase/migrations/`
   - Only 4 files (RLS policies)
   - Missing table creation scripts
   - Missing triggers and functions

3. **Loose SQL Files** - Root directory
   - `fix-database.sql`
   - `setup-rls-policies.sql`
   - `create-business-records-table.sql`
   - `add-business-records-columns.sql`
   - `fix-tenant-id-camelcase-v2.sql`
   - etc.

   These were manually applied patches, not proper migrations!

### Required Actions

## ✅ COMPLETED

1. **Created Comprehensive Migration**
   - File: `supabase/migrations/005_comprehensive_schema.sql`
   - Includes all triggers and hooks

## ⏳ TODO

### 1. Generate Complete Schema Migration

```bash
# Option A: Use Drizzle to generate migration
npm run db:push

# Option B: Export schema from shared/schema.ts
# This will create all 127+ tables in Supabase
```

**File to create**: `supabase/migrations/006_create_all_tables.sql`

This should include:

- All table definitions from `shared/schema.ts`
- All enums
- All indexes
- All constraints

### 2. Apply Existing Migrations to Supabase

Run these SQL files on your Supabase database IN ORDER:

```bash
# On your Supabase server:
psql "postgresql://postgres:Ta881v34EPbKK92E2F0oZpc4Els39giz@209.145.59.219:5433/postgres" <<EOF

-- 1. Apply comprehensive triggers and hooks
\i supabase/migrations/005_comprehensive_schema.sql

-- 2. Ensure RLS policies are current
\i supabase/migrations/001_rls_policies.sql
\i supabase/migrations/002_users_rls_policies.sql
\i supabase/migrations/003_users_security_constraints.sql
\i supabase/migrations/004_postgrest_grants.sql

-- 3. Apply business records schema if not exists
\i create-business-records-table.sql
\i add-business-records-columns.sql
\i create-business-record-activities-table.sql

-- 4. Fix metadata
\i fix-tenant-id-camelcase-v2.sql

-- 5. Reload schema
SELECT pgrst_reload_schema();
EOF
```

### 3. Verify Tables Exist

```bash
# Check what tables exist in Supabase
psql "postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres" -c "\dt public.*"
```

### 4. Create Missing Tables

Based on `shared/schema.ts`, ensure ALL these tables exist:

**Core Tables** (must exist):

- [ ] tenants
- [ ] users
- [ ] roles
- [ ] teams
- [ ] locations
- [ ] sessions
- [ ] user_settings

**Business Tables**:

- [ ] business_records
- [ ] business_record_activities
- [ ] lead_contacts
- [ ] customer_contacts
- [ ] deals
- [ ] deal_stages
- [ ] deal_activities
- [ ] opportunities
- [ ] quotes
- [ ] quote_line_items

**Operations Tables**:

- [ ] service_tickets
- [ ] service_ticket_updates
- [ ] equipment
- [ ] meter_readings
- [ ] contracts
- [ ] contract_tiered_rates
- [ ] invoices
- [ ] invoice_line_items
- [ ] inventory_items
- [ ] technicians
- [ ] technician_availability

**Product Tables**:

- [ ] product_models
- [ ] product_accessories
- [ ] accessory_model_compatibility
- [ ] cpc_rates
- [ ] product_pricing

**Additional Tables**:

- [ ] proposals
- [ ] proposal_line_items
- [ ] proposal_sections
- [ ] proposal_comments
- [ ] leases
- [ ] lease_payments
- [ ] lease_renewals
- [ ] lease_dispositions
- [ ] equipment_onboarding_checklists
- [ ] onboarding_equipment
- [ ] onboarding_dynamic_sections
- [ ] onboarding_tasks
- [ ] tasks
- [ ] projects
- [ ] notifications
- [ ] appointments
- [ ] files

### 5. Configure Database Hooks (NOW INCLUDED IN 005)

The following are now in `005_comprehensive_schema.sql`:

✅ Auto-update `updated_at` timestamps
✅ Auto-generate quote/invoice/ticket numbers
✅ Cascade delete related records
✅ Audit logging framework
✅ Tenant ID auto-population

### 6. Performance Indexes (NOW INCLUDED IN 005)

Critical indexes for query performance are in migration 005.

### 7. Consolidate Old Migrations

Move old migrations to archive:

```bash
mkdir -p database/_archived_migrations
mv migrations/*.sql database/_archived_migrations/
mv *.sql database/_archived_migrations/ # Move loose SQL files
# Keep only supabase/migrations/ as source of truth
```

### 8. Update Drizzle Config

Ensure `drizzle.config.ts` points to Supabase:

```typescript
export default {
  schema: './shared/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:PASSWORD@209.145.59.219:5433/postgres',
  },
};
```

### 9. Future Migration Workflow

Going forward, use this process:

```bash
# 1. Update shared/schema.ts
# 2. Generate migration
npm run db:push # or drizzle-kit generate

# 3. Review generated SQL in supabase/migrations/
# 4. Test on dev database
# 5. Apply to production
# 6. Commit to git
```

## Testing Checklist

After applying migrations:

- [ ] All Edge Functions return data (not 404/500)
- [ ] Frontend can create/read/update/delete records
- [ ] RLS policies enforce tenant isolation
- [ ] Auto-generated numbers work (quotes, invoices, tickets)
- [ ] `updated_at` timestamps auto-update
- [ ] Cascade deletes work properly
- [ ] Performance is acceptable (<100ms queries)

## Emergency Rollback

If migrations fail:

1. Restore from backup:

```bash
psql DATABASE_URL < backup_before_migration.sql
```

2. Re-apply only RLS policies:

```bash
psql DATABASE_URL < supabase/migrations/001_rls_policies.sql
```

---

**Priority**: HIGH 🔴  
**Status**: MIGRATION FRAMEWORK READY, NEEDS EXECUTION  
**Next Step**: Apply migration 005, then verify all tables exist
