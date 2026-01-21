# Complete Database Migration Instructions

## ✅ Fixed Issues

1. **Column name ambiguity error** - Fixed in `005_comprehensive_schema.sql`
2. **Created automated migration scripts** for both Linux and Windows

## 📋 What You Have

### Database Exports (Complete Schema)

- **`database-exports/complete-with-schema.sql`** (870 KB) - ✅ **Use This One!**
  - Full schema with all tables, enums, and structure
  - From your old NEON database
  - Ready to import to Supabase

### Migration Scripts Created

- **`database-exports/apply-schema-to-supabase.sh`** (Linux/Mac/Server)
- **`APPLY_SCHEMA.ps1`** (Windows PowerShell)

### Supabase Migrations

- `001_rls_policies.sql` - Row Level Security
- `002_users_rls_policies.sql` - User-specific RLS
- `003_users_security_constraints.sql` - Security triggers
- `004_postgrest_grants.sql` - PostgREST permissions
- `005_comprehensive_schema.sql` - ✅ **Fixed** triggers and hooks

## 🚀 How to Apply Migration

### On Your Supabase Server (Linux)

```bash
# SSH to your server
ssh root@209.145.59.219

# Navigate to project
cd /path/to/Printyx

# Run the migration script
bash database-exports/apply-schema-to-supabase.sh
```

The script will:

1. ✅ Test database connection
2. ✅ Create automatic backup
3. ✅ Apply complete schema (127+ tables)
4. ✅ Apply Supabase-specific migrations
5. ✅ Apply RLS policies and fixes
6. ✅ Create indexes for performance
7. ✅ Set up triggers and hooks
8. ✅ Reload PostgREST schema cache
9. ✅ Verify all key tables exist

### On Windows (Local Testing)

```powershell
# Open PowerShell as Administrator
cd C:\Users\dpearson\Documents\Printyx

# Run the migration script
.\APPLY_SCHEMA.ps1
```

## 📊 What Gets Created

### Core Tables (20+)

- `tenants`, `users`, `roles`, `teams`, `locations`
- `sessions`, `user_settings`, `mfa_backup_codes`

### Business Tables (30+)

- `business_records` (unified leads/customers)
- `business_record_activities`
- `lead_contacts`, `customer_contacts`
- `deals`, `deal_stages`, `deal_activities`
- `opportunities`
- `quotes`, `quote_line_items`

### Operations Tables (25+)

- `service_tickets`, `service_ticket_updates`
- `equipment`, `meter_readings`
- `contracts`, `contract_tiered_rates`
- `invoices`, `invoice_line_items`
- `inventory_items`
- `technicians`, `technician_availability`

### Product Tables (10+)

- `product_models`, `product_accessories`
- `accessory_model_compatibility`
- `cpc_rates`, `product_pricing`

### Additional Tables (40+)

- `proposals`, `proposal_line_items`, `proposal_sections`
- `leases`, `lease_payments`, `lease_renewals`
- `equipment_onboarding_checklists`
- `tasks`, `projects`
- `notifications`, `appointments`, `files`
- And 30+ more specialized tables

**Total: 127+ tables with all indexes, constraints, and relationships**

## 🔧 Database Triggers & Hooks (Auto-Enabled)

### Automatic Timestamps

All tables with `updated_at` column will auto-update on every change.

### Auto-Generated Numbers

- **Quotes**: `Q-20260113-000001`
- **Invoices**: `INV-20260113-000001`
- **Tickets**: `TKT-20260113-000001`

### Cascade Deletes

Deleting a `business_record` automatically deletes:

- Related activities
- Related contacts
- Related history

### Audit Logging Framework

Ready for you to enable detailed change tracking.

## ✅ Verification Steps

After running the migration:

```bash
# Count tables
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# List all tables
psql "$DATABASE_URL" -c "\dt"

# Check triggers
psql "$DATABASE_URL" -c "\df update_updated_at_column"

# Verify key tables exist
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'business_records', 'tasks', 'projects', 'deals', 'quotes') ORDER BY table_name;"

# Test Edge Functions
curl https://functions.printyx.net/tasks

# Check PostgREST
curl https://api.printyx.net/rest/v1/business_records -H "apikey: YOUR_ANON_KEY"
```

## 🔴 If Something Goes Wrong

### Restore from Backup

```bash
# The script creates automatic backups
ls -lh backup_*.sql

# Restore latest backup
psql "$DATABASE_URL" < backup_20260113_120000.sql
```

### Check Logs

```bash
# View migration log
cat schema_import.log

# Check for errors
grep -i error schema_import.log
```

### Manual Rollback

```bash
# Drop all public tables (DANGEROUS!)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-apply migrations
bash database-exports/apply-schema-to-supabase.sh
```

## 📝 Post-Migration Checklist

- [ ] All 127+ tables exist
- [ ] RLS policies enabled
- [ ] Triggers working (test by updating a record)
- [ ] Edge Functions return data (not 404/500)
- [ ] Frontend can create/read/update/delete
- [ ] Auto-generated numbers work
- [ ] Tenant isolation enforced
- [ ] Performance acceptable (<100ms queries)

## 🎯 Next Steps After Migration

1. **Test All Edge Functions**

   ```bash
   curl https://functions.printyx.net/me
   curl https://functions.printyx.net/tasks
   curl https://functions.printyx.net/business-records
   ```

2. **Test Frontend**
   - Go to https://printyx.net
   - Create a lead
   - Add an activity
   - Create a quote
   - Verify data persists

3. **Monitor Performance**

   ```sql
   -- Check slow queries
   SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
   ```

4. **Archive Old Migrations**
   ```bash
   mkdir -p database/_archived_migrations
   mv *.sql database/_archived_migrations/
   # Keep only supabase/migrations/ as source of truth
   ```

## 🔗 Resources

- **Schema Definition**: `shared/schema.ts` (127+ tables)
- **Edge Functions**: `supabase/functions/` (35 functions)
- **Old NEON Schema**: `database-exports/complete-with-schema.sql`
- **Supabase Docs**: https://supabase.com/docs

---

**Status**: ✅ READY TO APPLY  
**Priority**: HIGH 🔴  
**Estimated Time**: 5-10 minutes  
**Risk**: LOW (automatic backup included)
