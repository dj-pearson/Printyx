# Migration Guide: business_records → companies

This guide helps you migrate all references from the old `business_records` table to the new `companies` table structure.

## 🎯 Overview

Your codebase currently uses both:

- **`business_records`** - Old unified table for leads/prospects/customers
- **`companies`** - New dedicated companies table with better structure

This migration script helps systematically replace all `business_records` references with `companies`.

## 📋 What Gets Changed

### Table References

```typescript
// Before
.from('business_records')
pgTable('business_records', {...})

// After
.from('companies')
pgTable('companies', {...})
```

### API Endpoints

```typescript
// Before
'/api/business-records';
'/api/business-records/:id';

// After
'/api/companies';
'/api/companies/:id';
```

### Field Names

```typescript
// Before                    →  After
company_name                 →  business_name
companyName                  →  businessName
primary_contact_name         →  (contacts table)
address_line1                →  billing_address
city                         →  billing_city
state                        →  billing_state
postal_code                  →  billing_zip
record_type                  →  business_record_type
owner_id                     →  business_owner
```

### Type Definitions

```typescript
// Before
interface BusinessRecord { ... }
type BusinessRecord = { ... }

// After
interface Company { ... }
type Company = { ... }
```

## 🚀 Usage

### Step 1: Analyze (Safe - No Changes)

Find all references and generate a report:

```bash
npm run migrate:analyze
```

This will:

- ✅ Search all TypeScript files
- ✅ Identify table references, API endpoints, field names
- ✅ Categorize by confidence level (high/medium/low)
- ✅ Generate `migration-report.json` with details
- ✅ Show summary statistics

**Output Example:**

```
📊 Analysis Results
==========================================
📈 Total References Found: 247

By Type:
  table_reference      89
  api_endpoint         52
  column_reference     78
  type_definition      18
  comment              10

By Confidence:
  🟢 high              159
  🟡 medium            68
  🔴 low               20

Top 10 Files with Most References:
    42 client/src/pages/customers.tsx
    28 server/routes-business-records.ts
    19 client/src/pages/LeadsManagement.tsx
    ...
```

### Step 2: Preview Changes

See exactly what would be changed:

```bash
npm run migrate:preview
```

This shows:

- 🟢 **High Confidence** - Safe automatic changes
- 🟡 **Medium Confidence** - Need review
- 🔴 **Manual Review** - Complex cases requiring human judgment

**Output Example:**

```
🔍 Preview of Proposed Changes

🟢 High Confidence Changes (159):
These can be automatically applied safely.

📄 server/routes-business-records.ts:45
   - const records = await db.select().from(businessRecords)
   + const records = await db.select().from(companies)

📄 client/src/pages/customers.tsx:216
   - queryKey: ['/api/business-records'],
   + queryKey: ['/api/companies'],
```

### Step 3: Execute Changes (CAREFUL!)

Apply high-confidence changes automatically:

```bash
npm run migrate:execute
```

**⚠️ WARNING:** This modifies files! It will:

1. Wait 5 seconds (cancel with Ctrl+C if needed)
2. Create `.backup-*` files for each modified file
3. Apply all high-confidence changes
4. Show summary of changes made

**Safety Features:**

- ✅ Only applies high-confidence changes
- ✅ Creates backups of all modified files
- ✅ Preserves original line structure
- ✅ Generates detailed report

## 📊 Understanding Confidence Levels

### 🟢 High Confidence (Safe to Auto-Apply)

- Direct table references: `.from('business_records')`
- API endpoint strings: `'/api/business-records'`
- Clear type definitions: `interface BusinessRecord`
- pgTable declarations

### 🟡 Medium Confidence (Review Recommended)

- Field name replacements (might have different context)
- Column references that could mean something else
- Mixed usage with other tables

### 🔴 Low Confidence (Manual Review Required)

- Comments and documentation
- Complex conditional logic
- Ambiguous references
- Edge cases

## 🔧 Manual Review Checklist

After running the migration, manually review:

### 1. **Contacts Separation**

Some fields from `business_records` should go to a separate `contacts` table:

- `primary_contact_name` → `contacts.name`
- `primary_contact_email` → `contacts.email`
- `primary_contact_phone` → `contacts.phone`

### 2. **API Routes**

Update route files:

- Rename `server/routes-business-records.ts` → `server/routes-companies.ts`
- Update route registrations in `server/routes.ts`

### 3. **Edge Functions**

Update Supabase edge functions:

- `supabase/functions/business-records/` → `supabase/functions/companies/`
- Update all internal references

### 4. **Frontend Components**

- Update import statements
- Update component names if needed
- Update query keys for React Query

### 5. **Database Migrations**

Create a migration to:

- Copy data from `business_records` to `companies`
- Update foreign key references
- Drop old table (after verification)

## 📝 Post-Migration Steps

### 1. Run Tests

```bash
npm run check          # TypeScript type checking
npm run test           # Unit tests
npm run test:e2e       # End-to-end tests
```

### 2. Manual Testing

- Test customer creation
- Test customer listing
- Test customer details
- Test import functionality
- Test search and filters

### 3. Database Migration

Create and run SQL migration:

```sql
-- Copy data from business_records to companies
INSERT INTO companies (
  id, tenant_id, business_name, phone, billing_address,
  billing_city, billing_state, billing_zip, ...
)
SELECT
  id, tenant_id, company_name, phone, address_line1,
  city, state, postal_code, ...
FROM business_records
WHERE record_type = 'customer';

-- Update foreign keys
UPDATE activities SET company_id = business_record_id;
UPDATE quotes SET company_id = business_record_id;
-- ... etc

-- Verify data integrity
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM business_records WHERE record_type = 'customer';

-- After verification, optionally drop business_records
-- DROP TABLE business_records;
```

### 4. Update Documentation

- Update API documentation
- Update README files
- Update CLAUDE.md with new patterns

## 🔄 Rollback

If something goes wrong:

### Option 1: Use Backups

```bash
# Find backup files
find . -name "*.backup-*"

# Restore a specific file
cp path/to/file.backup-1234567890 path/to/file
```

### Option 2: Git Reset

```bash
git status                    # See what changed
git diff path/to/file        # Review changes
git checkout path/to/file    # Restore single file
git reset --hard HEAD        # Restore everything (CAREFUL!)
```

## 📈 Migration Report

After running any command, check `migration-report.json` for:

- Complete list of all references
- Grouped by file, type, and confidence
- Proposed changes for each reference
- Items needing manual review

Example structure:

```json
{
  "timestamp": "2026-01-20T...",
  "totalReferences": 247,
  "byType": { "table_reference": 89, ... },
  "byConfidence": { "high": 159, ... },
  "highConfidenceChanges": [...],
  "mediumConfidenceChanges": [...],
  "manualReviewNeeded": [...]
}
```

## 🎯 Best Practices

1. **Run analyze first** - Always start with analysis to understand scope
2. **Review preview** - Check what will change before executing
3. **Commit before migrating** - Have a clean git state
4. **Test incrementally** - Test after each major file change
5. **Keep backups** - Don't delete `.backup-*` files until verified
6. **Update in stages** - Don't migrate everything at once

## 🆘 Troubleshooting

### "Too many references found"

- Focus on one directory at a time
- Manually update the most complex files first
- Use the script for simpler, repetitive changes

### "Changes break tests"

- Review medium-confidence changes
- Check field name mappings
- Verify API endpoint changes

### "Database errors"

- Ensure database migration runs first
- Check that `companies` table exists
- Verify foreign key relationships

## 📚 Related Files

- `scripts/migrate-business-records-to-companies.ts` - Migration script
- `shared/schema.ts` - Table definitions
- `CLAUDE.md` - Development guidelines
- `migration-report.json` - Generated analysis report

## ✅ Success Checklist

- [ ] Ran `npm run migrate:analyze`
- [ ] Reviewed `migration-report.json`
- [ ] Ran `npm run migrate:preview`
- [ ] Committed current changes to git
- [ ] Ran `npm run migrate:execute`
- [ ] Reviewed all modified files
- [ ] Manually updated medium/low confidence items
- [ ] Updated API routes
- [ ] Updated edge functions
- [ ] Ran TypeScript check (`npm run check`)
- [ ] Ran tests (`npm run test`)
- [ ] Tested in browser
- [ ] Created database migration
- [ ] Updated documentation
- [ ] Committed migration changes

---

**Need Help?** Check the migration report or review specific files flagged as needing manual attention.
