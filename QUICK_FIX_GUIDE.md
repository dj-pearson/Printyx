# Customer Creation Fix - Quick Start Guide

## The Problem

Your database has invalid UUID values (like "lead-001") in foreign key columns. These need to be cleaned up before we can add proper foreign key constraints.

## The Solution (3 Simple Steps)

### Step 1: Run Data Cleanup

This will fix all the invalid UUID values:

```powershell
cd C:\Users\dpearson\Documents\Printyx
supabase db execute -f migrations/002_data_cleanup.sql
```

**What happens:**
- Finds values like "lead-001" in company_id and contact_id columns
- Sets them to NULL (records are preserved, just unlinked)
- Shows you a log of what was changed

**Review the output** - it will tell you how many records were affected.

### Step 2: Apply Database Migration

Now that data is clean, add the foreign key constraints:

```powershell
supabase db push
```

**What happens:**
- Converts column types to UUID
- Adds foreign key constraints
- Adds performance indexes
- Takes about 1 second

### Step 3: Deploy Edge Function & Frontend

Deploy the updated code:

```powershell
# Deploy edge function
supabase functions deploy customers

# Build frontend
cd client
npm run build

# Deploy the build to your hosting platform (Cloudflare Pages, etc.)
# The build is in client/dist/
```

## That's It!

After these 3 steps, customer creation will work on https://printyx.net/customers?tab=active

## What About the Invalid Values?

The cleanup script **creates placeholder companies** for records with invalid IDs because `company_contacts.company_id` has a NOT NULL constraint.

### What it does:
1. **For invalid UUIDs** (like "lead-001"):
   - Creates a new company named after the contact's email domain
   - Example: "Acme (Migrated from lead-001)"
   - Links the contact to this new company

2. **For orphaned records** (valid UUID but company doesn't exist):
   - Creates the missing company with that exact UUID
   - Names it based on the contact's email
   - Example: "Acme (Recovered)"

### After cleanup:
- ✅ All records are preserved (nothing deleted)
- ✅ All relationships are valid
- ✅ You can update placeholder company info later
- ℹ️ Check for duplicate companies and merge if needed

See `migrations/002_data_cleanup_explained.md` for detailed explanation.

## Need More Details?

- **Detailed Steps**: See `CUSTOMER_CREATION_FIX_DEPLOYMENT.md`
- **Understanding Changes**: See `CUSTOMER_CREATION_FIX_SUMMARY.md`
- **Migration Order**: See `migrations/MIGRATION_ORDER.md`

## Quick Automated Script

Or just run the automated script that does everything:

```powershell
.\scripts\deploy-customer-fix.ps1
```

This will walk you through all steps interactively.

## Verification

After deployment, test at https://printyx.net/customers?tab=active:

1. ✅ Page loads without console errors
2. ✅ Can click "Add Customer"
3. ✅ Can fill out form and save
4. ✅ New customer appears in list with company name
5. ✅ No more "column users.role does not exist" errors
6. ✅ No more PostgREST relationship errors

## Need Help?

The data cleanup is safe - it only sets invalid values to NULL, doesn't delete anything. You can review exactly what changed in the cleanup log output.
