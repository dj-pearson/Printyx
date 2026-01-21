# Migration Execution Order

## Problem

The database contains non-UUID values (like "lead-001") in foreign key columns that need to be converted to UUID type.

## Solution: Run migrations in this order

### Step 1: Pre-Migration Check

**File:** `002_pre_migration_checks.sql`

This will identify any data quality issues:

- Invalid UUID formats
- Orphaned records

```bash
supabase db execute -f migrations/002_pre_migration_checks.sql
```

**Expected Output:**

- If query returns rows: You have data issues that need cleanup
- If query returns no rows: Skip to Step 3

### Step 2: Data Cleanup (Only if Step 1 found issues)

**File:** `002_data_cleanup.sql`

This script will:

- Find all non-UUID values in foreign key columns
- Set them to NULL (safer than deleting)
- Log all changes for review
- Display a summary of what was fixed

```bash
supabase db execute -f migrations/002_data_cleanup.sql
```

**What this does:**

- Sets invalid `company_id` values to NULL in `company_contacts`
- Sets invalid `company_id` values to NULL in `customers`
- Sets invalid `contact_id` values to NULL in `customers`
- Sets invalid `company_id` and `contact_id` values to NULL in `leads` (if table exists)
- Creates a log table showing what was changed

**Review the output** to see what was cleaned up. The records will still exist, just with NULL foreign keys.

### Step 3: Apply Foreign Key Constraints Migration

**File:** `002_add_foreign_key_constraints.sql`

Now that data is clean, apply the actual migration:

```bash
supabase db push
```

This will:

- Convert column types from `character varying` to `uuid`
- Add foreign key constraints
- Add performance indexes

## Important Notes

### About NULL Values

Records with NULL foreign keys after cleanup will:

- Still exist in the database
- Won't have company/contact relationships
- Can be manually linked to companies later
- Won't cause errors when creating new customers

### After Migration

You should:

1. Review the cleanup log to see which records were affected
2. Consider creating companies for the orphaned records
3. Manually link those records to the new companies

### Example: Linking Orphaned Records After Migration

```sql
-- Find company_contacts with NULL company_id
SELECT id, first_name, last_name, email
FROM company_contacts
WHERE company_id IS NULL;

-- Create a company for them
INSERT INTO companies (id, tenant_id, business_name, created_at)
VALUES (gen_random_uuid(), 'your-tenant-id', 'Company Name', NOW())
RETURNING id;

-- Link the contact to the company
UPDATE company_contacts
SET company_id = 'new-company-uuid-from-above'
WHERE id = 'contact-id';
```

## Rollback

If something goes wrong, you can rollback:

```sql
BEGIN;

-- Revert type conversions (this will fail if constraints exist, so drop them first)
ALTER TABLE public.company_contacts DROP CONSTRAINT IF EXISTS company_contacts_company_id_fkey;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_company_id_fkey;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_contact_id_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_company_id_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_contact_id_fkey;

-- Convert back to character varying
ALTER TABLE public.company_contacts ALTER COLUMN company_id TYPE character varying USING company_id::text;
ALTER TABLE public.customers ALTER COLUMN company_id TYPE character varying USING company_id::text;
ALTER TABLE public.customers ALTER COLUMN contact_id TYPE character varying USING contact_id::text;
ALTER TABLE public.leads ALTER COLUMN company_id TYPE character varying USING company_id::text;
ALTER TABLE public.leads ALTER COLUMN contact_id TYPE character varying USING contact_id::text;

COMMIT;
```

## Quick Reference

```bash
# Full migration sequence
cd C:\Users\dpearson\Documents\Printyx

# 1. Check for issues
supabase db execute -f migrations/002_pre_migration_checks.sql

# 2. If issues found, clean up data
supabase db execute -f migrations/002_data_cleanup.sql

# 3. Apply the migration
supabase db push

# 4. Deploy edge function
supabase functions deploy customers

# 5. Build and deploy frontend
cd client
npm run build
# Then deploy dist/ to your hosting platform
```
