# Customer Creation Fix - Deployment Guide

## Date: January 15, 2026

## Issues Fixed

1. **Missing Foreign Key Constraints** - Added FK constraints between customers/companies and companies/company_contacts tables
2. **Data Format Mismatch** - Updated customers edge function to handle frontend form data format
3. **User Profile Query Error** - Removed non-existent `role` column from user profile query

## Files Changed

### Backend (Edge Functions)
- `supabase/functions/customers/index.ts` - Updated to handle frontend data format

### Frontend
- `client/src/hooks/useSupabaseAuth.ts` - Fixed user profile query

### Database
- `migrations/002_add_foreign_key_constraints.sql` - NEW migration file

## Deployment Steps

### Step 0: Pre-Migration Check (IMPORTANT!)

Before applying the migration, run the pre-migration checks to identify any data issues:

```powershell
# Via Supabase CLI
supabase db execute -f migrations/002_pre_migration_checks.sql

# Or via Supabase Dashboard SQL Editor
# Copy/paste contents of migrations/002_pre_migration_checks.sql and run
```

**If the query returns any rows**, you have data issues that need to be fixed. Proceed to Step 0.5.

**If the query returns no rows**, skip Step 0.5 and go directly to Step 1.

### Step 0.5: Data Cleanup (Only if Step 0 found issues)

Run the data cleanup script to fix invalid UUID values:

```powershell
# Via Supabase CLI
supabase db execute -f migrations/002_data_cleanup.sql

# Or via Supabase Dashboard SQL Editor
# Copy/paste contents of migrations/002_data_cleanup.sql and run
```

**What this does:**
- Identifies all non-UUID values (like "lead-001") in foreign key columns
- Sets them to NULL (safer than deleting records)
- Logs all changes for your review
- Shows a summary of what was fixed

**Review the output carefully** - it will show which records were affected. These records will still exist but won't have company/contact relationships until you manually link them later.

### Step 1: Apply Database Migration

You need to run the migration on your production database. Choose one of these methods:

#### Option A: Via Supabase CLI (Recommended)
```powershell
# Make sure you're in the project directory
cd C:\Users\dpearson\Documents\Printyx

# Link to your production project (if not already linked)
supabase link --project-ref your-production-project-ref

# Push the migration
supabase db push
```

#### Option B: Via Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/your-project/sql
2. Copy the contents of `migrations/002_add_foreign_key_constraints.sql`
3. Paste into SQL Editor
4. Click "Run"

#### Option C: Direct Database Connection
If you have direct database access:
```powershell
# Replace with your production database connection string
psql "postgresql://user:password@host:port/database" -f migrations/002_add_foreign_key_constraints.sql
```

### Step 2: Deploy Edge Functions

The customers edge function needs to be redeployed:

```powershell
# Deploy the updated customers function
supabase functions deploy customers
```

### Step 3: Deploy Frontend

Build and deploy the updated frontend:

```powershell
cd client

# Build the frontend
npm run build

# Deploy to Cloudflare Pages (if that's your deployment method)
# Or use your current deployment method
```

### Step 4: Verify the Fix

1. Navigate to https://printyx.net/customers?tab=active
2. Open browser console (F12)
3. Click "Add Customer" button
4. Fill in the form with test data:
   - Company Name: Test Company
   - Primary Contact Name: John Doe
   - Primary Contact Email: john@test.com
   - Other fields as desired
5. Click Save
6. Check console for errors:
   - Should NOT see "column users.role does not exist"
   - Should NOT see "Could not find a relationship between customers and companies"
   - Should see successful customer creation

## What Changed

### Database Schema

#### Data Type Conversions
The migration converts the following columns from `character varying` to `uuid` to match the primary key types:
- `company_contacts.company_id`: `character varying` → `uuid`
- `customers.company_id`: `character varying` → `uuid`
- `customers.contact_id`: `character varying` → `uuid`
- `leads.company_id`: `character varying` → `uuid`
- `leads.contact_id`: `character varying` → `uuid`

#### Foreign Key Constraints
- Added foreign key constraints:
  - `customers.company_id` → `companies.id` (ON DELETE CASCADE)
  - `customers.contact_id` → `company_contacts.id` (ON DELETE SET NULL)
  - `company_contacts.company_id` → `companies.id` (ON DELETE CASCADE)
  - `leads.company_id` → `companies.id` (ON DELETE CASCADE)
  - `leads.contact_id` → `company_contacts.id` (ON DELETE SET NULL)

#### Performance Indexes
- Added performance indexes on FK columns for faster joins

### Customers Edge Function
Before:
- Required `company_id` and `contact_id` to exist
- Frontend had to create company/contact separately first

After:
- Accepts frontend form data with fields like `companyName`, `primaryContactName`, etc.
- Automatically creates company and contact if they don't exist
- Still supports the old format with `company_id` and `contact_id`

### User Profile Query
Before:
- Tried to select `role` column from users table
- Column didn't exist, causing 400 errors

After:
- Only selects `role_id` (FK to roles table)
- Properly handles role lookups via roles table

## Rollback Plan

If issues occur, you can rollback the database migration:

```sql
BEGIN;

-- Remove foreign key constraints
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_company_id_fkey;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_contact_id_fkey;
ALTER TABLE public.company_contacts DROP CONSTRAINT IF EXISTS company_contacts_company_id_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_company_id_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_contact_id_fkey;

-- Remove indexes
DROP INDEX IF EXISTS idx_customers_company_id;
DROP INDEX IF EXISTS idx_customers_contact_id;
DROP INDEX IF EXISTS idx_customers_tenant_id;
DROP INDEX IF EXISTS idx_company_contacts_company_id;
DROP INDEX IF EXISTS idx_company_contacts_tenant_id;
DROP INDEX IF EXISTS idx_companies_tenant_id;
DROP INDEX IF EXISTS idx_leads_company_id;
DROP INDEX IF EXISTS idx_leads_contact_id;
DROP INDEX IF EXISTS idx_leads_tenant_id;

COMMIT;
```

Then redeploy the previous version of the edge function and frontend.

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Edge function deployed successfully
- [ ] Frontend deployed successfully
- [ ] Can access /customers page without console errors
- [ ] User profile loads without "column users.role does not exist" error
- [ ] Customer list loads without PostgREST relationship errors
- [ ] Can create a new customer with company and contact data
- [ ] Created customer appears in the list with correct company info
- [ ] Can view customer details
- [ ] Can edit customer
- [ ] Can delete customer

## Support

If you encounter issues during deployment, check:

1. **Database Migration Errors**: Look for constraint conflicts - might need to clean up orphaned records first
2. **Edge Function Errors**: Check Supabase logs in dashboard under Edge Functions
3. **Frontend Errors**: Check browser console and network tab for API errors

## Notes

- The migration is idempotent (safe to run multiple times)
- Foreign key constraints ensure data integrity
- CASCADE deletes mean deleting a company will delete related customers (by design)
- The frontend changes are backward compatible
