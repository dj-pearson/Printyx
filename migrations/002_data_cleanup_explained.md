# Data Cleanup Script - Explanation

## What the Script Does

The `002_data_cleanup.sql` script handles invalid and orphaned foreign key values in your database. Here's what happens:

## Problem 1: Invalid UUID Values (like "lead-001")

### Issue

Some records have foreign keys like "lead-001" which aren't valid UUIDs.

### Solution

**Creates placeholder companies** for these records because `company_contacts.company_id` has a NOT NULL constraint (we can't just set it to NULL).

### What happens:

1. Finds contact with invalid company_id like "lead-001"
2. Extracts domain from email (e.g., "john@acme.com" → "Acme")
3. Creates new company: "Acme (Migrated from lead-001)"
4. Links the contact to this new company
5. Logs the change

### Example:

```
Before:
  company_contacts.id = abc123
  company_contacts.company_id = "lead-001"  ← Invalid!
  company_contacts.email = "john@acme.com"

After:
  companies.id = [new UUID]
  companies.business_name = "Acme (Migrated from lead-001)"

  company_contacts.id = abc123
  company_contacts.company_id = [new UUID]  ← Now points to real company
```

## Problem 2: Orphaned Records (Valid UUID but Company Doesn't Exist)

### Issue

Some contacts have valid UUIDs but the company doesn't exist in the database.

### Solution

**Creates the missing company** using the existing UUID, so the reference becomes valid.

### What happens:

1. Finds contact with valid UUID that references non-existent company
2. Creates the missing company with that UUID
3. Names it based on contact's email domain
4. Now the relationship is valid

### Example:

```
Before:
  company_contacts.company_id = "550e8400-e29b-41d4-a716-446655440000"
  companies.id = "550e8400-e29b-41d4-a716-446655440000"  ← DOESN'T EXIST

After:
  companies.id = "550e8400-e29b-41d4-a716-446655440000"  ← NOW EXISTS!
  companies.business_name = "Leadcompany (Recovered)"

  company_contacts.company_id = "550e8400-e29b-41d4-a716-446655440000"  ← Still same, but now valid
```

## For Customers Table

Same approach, but checks if the column allows NULL first:

- If **nullable**: Sets invalid values to NULL
- If **NOT NULL**: Creates placeholder companies

## After Running the Script

You'll see output like:

```
 table_name       | column_name | records_fixed | action_summary
------------------+-------------+---------------+------------------------------
 company_contacts | company_id  |             4 | Invalid UUID - created placeholder company
 company_contacts | company_id  |             2 | Orphaned - created company
```

## What You Should Do Next

### 1. Review the Created Companies

```sql
SELECT * FROM companies
WHERE business_name LIKE '%(Migrated%'
   OR business_name LIKE '%(Recovered)%';
```

### 2. Update Company Information

The placeholder companies have minimal info. You should:

- Update business names to real names
- Add addresses, phone numbers, etc.
- Merge duplicates if any

### 3. Link Related Records

If you have customers, leads, etc. that should belong to these companies:

```sql
-- Find all contacts for a company
SELECT * FROM company_contacts WHERE company_id = 'uuid-here';

-- Find any customers that might belong to this company
SELECT * FROM customers WHERE company_id IS NULL;
```

## Safety Notes

✅ **No data is deleted** - All records are preserved
✅ **All changes are logged** - You can see what was changed
✅ **Idempotent** - Safe to run multiple times
✅ **Transaction** - All changes commit together or roll back on error

❌ **You may have duplicate companies** - Check for duplicates after
❌ **Placeholder names** - You'll want to update company names

## After Migration Complete

Once you've run the cleanup and migration:

1. **Review placeholder companies** - Update their info
2. **Check for duplicates** - Merge if needed
3. **Test customer creation** - Should work now
4. **Update any references** - In your app code if needed
