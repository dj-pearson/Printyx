# Fix Missing Contacts for Imported Companies

## Problem

Companies imported before the latest fix don't have `company_contacts` records, so they don't appear in the Customers page (which uses `INNER JOIN` with `company_contacts`).

## Solution: Re-Import Your CSV

The easiest fix is to **re-import the same CSV file**. The updated import logic will:

1. ✅ Find existing companies by name
2. ✅ Skip updating company fields (no changes)
3. ✅ **Create missing `company_contacts` records**
4. ✅ Count as "merged" (not skipped)

### Steps:

1. **Wait 2-3 minutes** for the latest deployment to finish (deployed at ~23:52 UTC)

2. Go to https://printyx.net/customers

3. Click **Import** button

4. Upload the same CSV file you used before

5. Complete the wizard (map columns, validate, execute)

### Expected Results:

```
✅ Import Complete
- Imported: 0 (no new companies)
- Merged: 5 (contacts created for existing companies)
- Skipped: 0 (all companies needed contacts)
```

6. Refresh the Customers page

7. Your companies should now appear! 🎉

## Why This Works

The updated import function now:

- Creates `company_contacts` record when creating customer relationship
- Checks for missing contacts on existing companies
- Creates a default "Primary Contact" if none exists
- Uses company name, phone, and email from CSV if available

## Alternative: Manual Database Fix

If you prefer to fix it directly in the database, run this SQL in Supabase:

```sql
-- Find companies with customers but no contacts
SELECT
  c.id,
  c.business_name,
  c.tenant_id,
  c.phone,
  c.created_by
FROM companies c
INNER JOIN customers cust ON cust.company_id = c.id
LEFT JOIN company_contacts cc ON cc.company_id = c.id
WHERE cc.id IS NULL;

-- Create missing contacts (replace tenant_id and created_by as needed)
INSERT INTO company_contacts (
  company_id,
  tenant_id,
  first_name,
  last_name,
  phone,
  is_primary_contact,
  created_by
)
SELECT
  c.id,
  c.tenant_id,
  'Primary',
  'Contact',
  c.phone,
  true,
  c.created_by
FROM companies c
INNER JOIN customers cust ON cust.company_id = c.id
LEFT JOIN company_contacts cc ON cc.company_id = c.id
WHERE cc.id IS NULL;
```

## Root Cause

The Customers edge function (`supabase/functions/customers/index.ts` line 71) uses:

```typescript
company_contacts!inner(...)  // INNER JOIN - requires contact to exist
```

This was a design decision to ensure every customer has at least one contact. The import function has been updated to respect this requirement.
