# URGENT: Complete NEON → Supabase Migration Plan

**Status**: 🚨 **CRITICAL - 177 Core Tables Missing**  
**Priority**: **IMMEDIATE ACTION REQUIRED**  
**Generated**: January 16, 2026

---

## 🎯 Situation Confirmed

### What We Know:
- ✅ You have **complete NEON backups** ready
- ✅ Supabase is running (41 new feature tables)
- ❌ **177 core business tables MISSING** from Supabase
- ❌ No users, companies, customers, invoices, quotes, etc.

### Why This Happened:
You started building **new features** in Supabase (AI, Calendar, Meetings) but **never migrated the core business data** from NEON.

### Impact:
- **CRITICAL**: No access to historical business data
- **BLOCKER**: Can't view old customers/invoices/quotes
- **WORKAROUND**: We manually created some tables (companies, company_contacts)
- **TEMPORARY**: Customer creation works, but missing 177 other tables

---

## 📋 Migration Plan (3 Phases)

### Phase 1: Critical Business Tables (Immediate - 1-2 hours)

These are **required** for basic operations:

#### Priority 1A: Core Identity & Access (30 min)
```sql
✅ users          - User accounts
✅ tenants        - Multi-tenant setup
✅ roles          - Access control
✅ role_permissions
✅ teams          - Team organization
✅ locations      - Location data
✅ regions        - Regional setup
```

#### Priority 1B: Business Records (30 min)
```sql
✅ companies      - Company master data
✅ company_contacts - Contact information
✅ customers      - Customer records
✅ leads          - Lead management
✅ business_records - Unified record system
✅ business_record_activities - Activity tracking
```

#### Priority 1C: Sales & Revenue (30 min)
```sql
✅ quotes         - Quote management
✅ quote_line_items - Quote details
✅ invoices       - Invoice records
✅ invoice_line_items - Invoice details
✅ contracts      - Contract management
✅ proposals      - Proposal system
✅ proposal_line_items
```

**After Phase 1**: Core CRM and sales operations functional

---

### Phase 2: Operations & Service (2-3 hours)

#### Priority 2A: Service Management
```sql
✅ service_tickets - Service requests
✅ service_ticket_updates - Ticket history
✅ service_requests - Service tracking
✅ technicians    - Technician records
✅ technician_availability
✅ field_work_orders - Field service
✅ maintenance_schedules
✅ maintenance_tasks
```

#### Priority 2B: Equipment & Inventory
```sql
✅ equipment      - Equipment tracking
✅ customer_equipment - Customer devices
✅ meter_readings - Meter data
✅ inventory_items - Inventory
✅ master_product_models - Product catalog
✅ master_product_accessories - Accessories
✅ supplies       - Supply management
✅ supply_orders  - Supply tracking
```

#### Priority 2C: Customer Portal & Communication
```sql
✅ customer_portal_access
✅ customer_portal_activity_log
✅ customer_service_requests
✅ customer_notifications
✅ customer_interactions
✅ customer_activities
```

**After Phase 2**: Full service operations restored

---

### Phase 3: Advanced Features & Analytics (1-2 hours)

#### Priority 3A: Financial Management
```sql
✅ accounts_payable
✅ accounts_receivable
✅ billing_invoices
✅ billing_line_items
✅ billing_configurations
✅ payment_methods
✅ payment_schedules
✅ gl_accounts
```

#### Priority 3B: Analytics & Reporting
```sql
✅ commission_calculations
✅ commission_analytics
✅ performance_benchmarks
✅ profitability_analysis
✅ financial_forecasts
✅ sales_forecasts
✅ forecast_metrics
```

#### Priority 3C: Integrations & Automation
```sql
✅ quickbooks_integrations
✅ manufacturer_integrations
✅ system_integrations
✅ automation_rules
✅ automated_tasks
✅ workflow_executions
```

**After Phase 3**: All 177 tables migrated, full platform operational

---

## 🛠️ Migration Methods (Choose One)

### Method 1: Full Restore (Recommended - Fastest)

**Uses**: `database-exports/complete-with-schema.sql`

**Steps**:
```bash
# 1. Backup current Supabase (your 41 new tables)
pg_dump $SUPABASE_DB_URL > backup-current-supabase-$(date +%Y%m%d).sql

# 2. Restore NEON data
psql $SUPABASE_DB_URL < database-exports/complete-with-schema.sql

# 3. Re-run new feature migrations (AI, Calendar, etc.)
cd supabase/migrations
for file in ai-*.sql calendar-*.sql meeting-*.sql task-*.sql; do
  psql $SUPABASE_DB_URL < $file
done
```

**Pros**: ✅ Fast, complete, exact copy of NEON  
**Cons**: ⚠️ May conflict with new tables, need to re-apply new migrations

---

### Method 2: Selective Table Migration (Safer)

**Uses**: Individual table exports

**Phase 1 Script**:
```bash
#!/bin/bash
# migrate-phase1.sh

SUPABASE_DB_URL="your-supabase-url"

# Core tables
psql $SUPABASE_DB_URL < database-exports/users.sql
psql $SUPABASE_DB_URL < database-exports/tenants.sql
psql $SUPABASE_DB_URL < database-exports/roles.sql
psql $SUPABASE_DB_URL < database-exports/companies.sql
psql $SUPABASE_DB_URL < database-exports/customers.sql
psql $SUPABASE_DB_URL < database-exports/quotes.sql
psql $SUPABASE_DB_URL < database-exports/invoices.sql

echo "✅ Phase 1 complete!"
```

**Pros**: ✅ Safer, won't affect new tables, incremental  
**Cons**: ⚠️ Slower, need to handle dependencies

---

### Method 3: Use Existing Restore Script (Easiest)

**Uses**: Your existing `deployment/restore-schema-remote.sh`

```bash
cd deployment
./restore-schema-remote.sh
```

**What it does**:
- Backs up current state
- Cleans NEON-specific commands
- Applies schema
- Handles permissions

**Pros**: ✅ Automated, tested, handles edge cases  
**Cons**: ⚠️ Need to configure connection string

---

## 📝 Step-by-Step Migration (Recommended Method)

### Step 1: Prepare (5 minutes)

```bash
# 1. Verify you have backups
ls -lh database-exports/

# 2. Check Supabase connection
echo $SUPABASE_DB_URL

# 3. Test connection
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"

# 4. Backup current Supabase
pg_dump $SUPABASE_DB_URL > backup-supabase-before-migration.sql
```

### Step 2: Extract Schema Only (10 minutes)

```bash
# Extract just CREATE TABLE statements from NEON export
# This creates tables without data first
pg_restore --schema-only database-exports/complete-with-schema.sql | \
  psql $SUPABASE_DB_URL

# Or use the SQL file:
psql $SUPABASE_DB_URL < database-exports/schema.sql
```

### Step 3: Import Data (30-60 minutes)

```bash
# Import all data
psql $SUPABASE_DB_URL < database-exports/all-data.sql

# Or full restore (schema + data):
psql $SUPABASE_DB_URL < database-exports/complete-with-schema.sql
```

### Step 4: Fix Conflicts (15 minutes)

```bash
# Some tables might conflict with new ones you created
# Drop your manually created tables first:

psql $SUPABASE_DB_URL <<EOF
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS company_contacts CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
EOF

# Then re-run the import
psql $SUPABASE_DB_URL < database-exports/complete-with-schema.sql
```

### Step 5: Verify (10 minutes)

```bash
# Check table count
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
# Should show ~218 tables (181 from NEON + 37 new)

# Check core tables exist
psql $SUPABASE_DB_URL <<EOF
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'companies', 'customers', 'invoices', 'quotes')
ORDER BY table_name;
EOF

# Check data counts
psql $SUPABASE_DB_URL <<EOF
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM companies) as companies,
  (SELECT COUNT(*) FROM customers) as customers,
  (SELECT COUNT(*) FROM invoices) as invoices,
  (SELECT COUNT(*) FROM quotes) as quotes;
EOF
```

### Step 6: Re-apply New Migrations (10 minutes)

```bash
# Re-run your new feature migrations to ensure they're applied
cd supabase/migrations

# AI features
psql $SUPABASE_DB_URL < ai-employees-migration.sql
psql $SUPABASE_DB_URL < ai-enhancement-migration.sql
psql $SUPABASE_DB_URL < ai-search-knowledge-migration.sql

# Calendar
psql $SUPABASE_DB_URL < calendar-integration-migration.sql

# Meetings
psql $SUPABASE_DB_URL < meeting-transcription-migration.sql

# Tasks
psql $SUPABASE_DB_URL < task-management-migration.sql
```

### Step 7: Test Your App (15 minutes)

1. ✅ Log into your app
2. ✅ View customers list (should see historical data)
3. ✅ View invoices (should see old invoices)
4. ✅ View quotes (should see old quotes)
5. ✅ Create new customer (should still work)
6. ✅ Check service tickets
7. ✅ Verify equipment tracking

---

## ⚠️ Important Considerations

### Before You Start:

1. **Backup Supabase First!**
   ```bash
   pg_dump $SUPABASE_DB_URL > critical-backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Downtime Warning**: Your app may be down during migration (30-60 min)

3. **Data Conflicts**: 
   - You manually created `companies` and `company_contacts`
   - These will conflict with NEON data
   - Drop them first or merge data

4. **Foreign Keys**: NEON export includes foreign key constraints - these should auto-create

5. **Permissions**: You may need to grant permissions after restore:
   ```sql
   GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
   ```

### After Migration:

1. **Test Everything**: Don't assume it works - test each feature

2. **Update Schema Docs**: Run schema extraction again:
   ```bash
   npx tsx tools/schema-validation/extract-schema.ts
   ```

3. **Verify Customer Creation**: Test the customer flow we fixed earlier

4. **Check Edge Functions**: Ensure they work with new schema

---

## 🚀 Quick Start (For the Brave)

**One command to restore everything**:

```bash
# DANGER: This will overwrite your Supabase database!
# Backup first!

pg_dump $SUPABASE_DB_URL > emergency-backup.sql && \
psql $SUPABASE_DB_URL < database-exports/complete-with-schema.sql && \
echo "✅ Migration complete! Verify with: psql $SUPABASE_DB_URL -c '\dt'"
```

---

## 📞 Need Help?

### If migration fails:

1. **Restore from backup**:
   ```bash
   psql $SUPABASE_DB_URL < emergency-backup.sql
   ```

2. **Check for errors**:
   ```bash
   psql $SUPABASE_DB_URL < database-exports/complete-with-schema.sql 2>&1 | tee migration-errors.log
   ```

3. **Verify connection string**:
   ```bash
   echo $SUPABASE_DB_URL
   ```

### Common Issues:

**"relation already exists"**:
- Drop the existing table first
- Or use `CREATE TABLE IF NOT EXISTS`

**"permission denied"**:
- Make sure you're using service_role key
- Check database user permissions

**"foreign key constraint violation"**:
- Import in dependency order
- Or disable constraints temporarily

---

## 🎯 Success Criteria

After migration, you should have:

- ✅ **218 total tables** (181 from NEON + 37 new features)
- ✅ All historical data accessible
- ✅ Customer creation still works
- ✅ Can view old invoices/quotes/contracts
- ✅ Service tickets visible
- ✅ Equipment tracking functional
- ✅ All new AI/Calendar features still work

---

## 🕐 Time Estimate

| Phase | Time | Complexity |
|-------|------|------------|
| Preparation | 15 min | Easy |
| Schema Migration | 30 min | Medium |
| Data Import | 60 min | Medium |
| Verification | 30 min | Easy |
| Testing | 30 min | Easy |
| **Total** | **2-3 hours** | **Medium** |

---

## 📌 Next Immediate Steps

1. ✅ Read this plan completely
2. ✅ Backup your current Supabase
3. ✅ Test connection to Supabase
4. ✅ Choose migration method (recommend Method 1)
5. ✅ Schedule downtime window
6. ✅ Execute migration
7. ✅ Verify and test
8. ✅ Update documentation

---

**Ready to start?** Let me know which method you want to use, and I'll guide you through it step-by-step!
