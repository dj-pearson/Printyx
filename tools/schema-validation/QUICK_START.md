# Schema Validation - Quick Start Guide

## What This Does

This system prevents database errors by:

1. **Extracting** your database schema from SQL files
2. **Validating** that your code only uses columns that actually exist
3. **Suggesting** fixes for typos and missing columns

## 3-Step Setup

### Step 1: Extract Schema (One-time)

```powershell
npx tsx tools/schema-validation/extract-schema.ts
```

**Output:**

- `schema-definition.json` - Complete database schema
- `schema-types.ts` - TypeScript types for type-safe queries

### Step 2: Validate Code

```powershell
npx tsx tools/schema-validation/validate-code.ts
```

**Output:**

- Console report of all invalid column references
- Suggestions for fixes

### Step 3: Generate Report

```powershell
npx tsx tools/schema-validation/generate-report.ts
```

**Output:**

- `VALIDATION_REPORT.md` - Comprehensive markdown report
- Grouped by: invalid column, file, table
- Top issues highlighted

## Common Commands

### View All Tables

```powershell
npx tsx tools/schema-validation/view-table.ts
```

### View Specific Table

```powershell
npx tsx tools/schema-validation/view-table.ts users
npx tsx tools/schema-validation/view-table.ts customers
npx tsx tools/schema-validation/view-table.ts companies
```

### Run Full Check

```powershell
cd tools/schema-validation
npm run check
```

This runs both extract and validate in one command.

## Example Issues Found

The system caught these real issues in your codebase:

### ❌ Issue: Non-existent Column

```typescript
// ❌ BEFORE (from useSupabaseAuth.ts)
.select('id, email, role, access_scope, is_platform_user')
```

**Error:** Columns `role`, `access_scope`, `is_platform_user` don't exist!

```typescript
// ✅ AFTER
.select('id, email, role_id, team_id, profile_image_url')
```

### ❌ Issue: Wrong Column Name

```typescript
// ❌ BEFORE
.order('customer_since', { ascending: false })
```

**Error:** `customer_since` doesn't exist in `customers` table!

```typescript
// ✅ AFTER
.order('created_at', { ascending: false })
```

## Current Findings

Based on your latest scan:

- **634 potential issues** found
- **77 files** affected
- **211 unique invalid columns**

Top invalid columns:

1. `company_name` - Should use nested `companies.business_name`
2. `access_scope` - Column doesn't exist
3. `is_platform_user` - Column doesn't exist
4. `customer_since` - Wrong table (exists in `companies`, not `customers`)
5. `url_slug` - Column doesn't exist

## Integration

### Add to package.json

```json
{
  "scripts": {
    "schema:extract": "npx tsx tools/schema-validation/extract-schema.ts",
    "schema:validate": "npx tsx tools/schema-validation/validate-code.ts",
    "schema:report": "npx tsx tools/schema-validation/generate-report.ts",
    "schema:check": "npm run schema:extract && npm run schema:validate"
  }
}
```

### Pre-Commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run schema:validate
```

## When to Run

- **After schema changes** - Run `extract` to update the schema definition
- **Before committing** - Run `validate` to catch issues
- **Weekly/Monthly** - Run `report` to track schema drift

## Files in This Folder

```
tools/schema-validation/
├── README.md                    # Comprehensive documentation
├── QUICK_START.md              # This file - quick reference
├── VALIDATION_REPORT.md        # Generated report of issues
├── package.json                # NPM scripts
├── extract-schema.ts           # Schema extractor
├── validate-code.ts            # Code validator
├── generate-report.ts          # Report generator
├── view-table.ts               # Interactive table viewer
├── schema-definition.json      # Generated schema (JSON)
└── schema-types.ts             # Generated types (TypeScript)
```

## Next Steps

1. Review the `VALIDATION_REPORT.md` to see all issues
2. Fix high-priority issues (files with most errors)
3. Re-run validation after fixes to verify
4. Integrate into your CI/CD pipeline

## Support

See the full README.md for:

- Detailed usage instructions
- Type-safe query examples
- CI/CD integration
- Configuration options
