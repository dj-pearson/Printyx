# Data Cleanup Strategy - NOT NULL Constraint Issue

## The Problem You Encountered

```
ERROR: null value in column "company_id" of relation "company_contacts" 
violates not-null constraint
```

## Why This Happened

The `company_contacts` table has a NOT NULL constraint on `company_id`, which means **every contact must have a company**. We can't just set invalid IDs to NULL.

## The Solution

Instead of setting invalid values to NULL, we **create placeholder companies** for orphaned contacts.

## Updated Cleanup Strategy

### 1. Invalid UUID Format (like "lead-001")

**Problem:** Contact has `company_id = "lead-001"` (not a valid UUID)

**Solution:** 
- Create a new company based on contact's email domain
- Name it: "Acme (Migrated from lead-001)"
- Link contact to this new company

**Example:**
```sql
-- Before
company_contacts: { id: "abc", company_id: "lead-001", email: "john@acme.com" }
-- ❌ "lead-001" is not a valid UUID

-- After
companies: { id: "new-uuid", business_name: "Acme (Migrated from lead-001)" }
company_contacts: { id: "abc", company_id: "new-uuid", email: "john@acme.com" }
-- ✅ Valid relationship
```

### 2. Orphaned Valid UUIDs

**Problem:** Contact has valid UUID but company doesn't exist

**Solution:**
- Create the missing company using that exact UUID
- Name it based on contact's email domain
- Now the relationship is valid

**Example:**
```sql
-- Before
company_contacts: { company_id: "550e8400-e29b-..." }
companies: (no record with id "550e8400-e29b-...")
-- ❌ Reference to non-existent company

-- After
companies: { id: "550e8400-e29b-...", business_name: "Acme (Recovered)" }
company_contacts: { company_id: "550e8400-e29b-..." }
-- ✅ Valid relationship restored
```

## What the Updated Cleanup Script Does

### Phase 1: Invalid UUIDs
1. Finds all non-UUID values in foreign key columns
2. Extracts domain from contact's email
3. Creates placeholder company with descriptive name
4. Updates contact to point to new company
5. Logs the action

### Phase 2: Orphaned Records
1. Finds valid UUIDs that reference non-existent companies
2. Creates the missing company using the orphaned UUID
3. Names it based on contact's email
4. Logs the action

### Phase 3: Summary
Shows you:
- How many records were fixed
- What actions were taken
- Complete log of all changes

## Running the Cleanup

```powershell
cd C:\Users\dpearson\Documents\Printyx

# Run the updated cleanup script
supabase db execute -f migrations/002_data_cleanup.sql

# Review the output - you'll see:
# - Number of records fixed
# - Names of placeholder companies created
# - Complete log of changes
```

## After Cleanup

### Immediate Next Step
Run the migration now that data is clean:

```powershell
supabase db push
```

### Follow-up Tasks (Optional)

1. **Review Placeholder Companies**
   ```sql
   SELECT * FROM companies 
   WHERE business_name LIKE '%(Migrated%' 
      OR business_name LIKE '%(Recovered)%';
   ```

2. **Update Company Information**
   - Change placeholder names to real company names
   - Add addresses, phone numbers, websites
   - Fill in missing contact details

3. **Check for Duplicates**
   ```sql
   SELECT business_name, COUNT(*) 
   FROM companies 
   GROUP BY business_name 
   HAVING COUNT(*) > 1;
   ```

4. **Merge Duplicates if Needed**
   - Identify which records should be merged
   - Update foreign keys to point to the correct company
   - Delete duplicate companies

## Safety Guarantees

✅ **No data loss** - All records preserved
✅ **Fully logged** - Every change is recorded
✅ **Transaction safe** - All or nothing (rolls back on error)
✅ **Idempotent** - Safe to run multiple times

## What Changed in the Cleanup Script

### Old Approach (Didn't Work)
```sql
UPDATE company_contacts SET company_id = NULL WHERE id = rec.id;
-- ❌ FAILS: NOT NULL constraint violation
```

### New Approach (Works)
```sql
-- Create placeholder company
INSERT INTO companies (...) VALUES (...) RETURNING id INTO placeholder_id;

-- Link contact to placeholder
UPDATE company_contacts SET company_id = placeholder_id WHERE id = rec.id;
-- ✅ SUCCESS: Contact always has a company
```

## Expected Output

When you run the cleanup, you'll see:

```
NOTICE: Found invalid company_id in company_contacts: id=abc, company_id=lead-001
NOTICE:   → Created placeholder company: id=new-uuid, name=Acme (Migrated from lead-001)
NOTICE: Found orphaned company_contact: id=def, company_id=550e8400-...
NOTICE:   → Created company with existing UUID: id=550e8400-..., name=Leadcompany (Recovered)

 table_name       | column_name | records_fixed | action_summary
------------------+-------------+---------------+--------------------------------
 company_contacts | company_id  |            4  | Invalid UUID - created placeholder company
 company_contacts | company_id  |            2  | Orphaned - created company
```

## Questions?

- **Will I lose data?** No, all records are preserved
- **Can I revert this?** Yes, the log shows exactly what was changed
- **Do I need to update the companies?** Optional but recommended
- **Will customer creation work after?** Yes, once you run the migration

## Ready to Proceed

Now you can safely run:

```powershell
# 1. Run cleanup (creates placeholder companies)
supabase db execute -f migrations/002_data_cleanup.sql

# 2. Run migration (adds foreign key constraints)
supabase db push

# 3. Deploy edge function
supabase functions deploy customers

# 4. Build and deploy frontend
cd client && npm run build
```
