# Schema Validator

A comprehensive validation tool that cross-references `docs/DATABASE_SCHEMA.md` with your codebase to identify database-related issues.

## What It Does

The Schema Validator scans your entire codebase and identifies:

1. **NEON Database References** ❌
   - Old NEON database URLs
   - NEON environment variables
   - NEON package imports
   - Any references to `neon.tech`

2. **Invalid Table References** ❌
   - Tables that don't exist in DATABASE_SCHEMA.md
   - Misspelled table names
   - camelCase vs snake_case mismatches

3. **Invalid Column References** ⚠️
   - Columns that don't exist in their referenced tables
   - Incorrect column names
   - Case sensitivity issues

4. **Deprecated Patterns** ⚠️
   - Old database connection patterns
   - Deprecated Neon-specific code
   - Legacy database adapter usage

## Usage

### Run the Validator

```bash
# Using tsx directly
npx tsx tests/schema-validator.ts

# Or add to package.json scripts (recommended)
npm run validate:schema
```

### Output Files

The validator generates two reports:

1. **JSON Report**: `tests/schema-validation-report.json`
   - Machine-readable format
   - Complete issue details
   - Can be used for automated processing

2. **Markdown Report**: `tests/SCHEMA_VALIDATION_REPORT.md`
   - Human-readable format
   - Organized by issue type
   - Includes recommendations and next steps

## Understanding the Report

### Issue Severity Levels

- **Error** ❌: Critical issues that must be fixed (e.g., NEON references, missing tables)
- **Warning** ⚠️: Issues that should be fixed (e.g., invalid columns, deprecated patterns)
- **Info** ℹ️: Informational notices (e.g., ambiguous references)

### Report Structure

```
📋 VALIDATION SUMMARY
Files Scanned:    500
Total Issues:     42
  Errors:         5   ← Fix these first!
  Warnings:       35  ← Fix these next
  Info:           2   ← Review these

Schema Info:
  Tables:         210
  Columns:        4274
  Schemas:        public, auth, _realtime, ...
```

## Files Scanned

The validator checks these file types:

- `server/**/*.ts` - Backend routes and services
- `server/**/*.js` - JavaScript files
- `client/src/**/*.ts(x)` - Frontend components and hooks
- `shared/**/*.ts` - Shared schemas and types
- `supabase/functions/**/*.ts` - Edge functions
- `scripts/**/*.ts` - Utility scripts
- `migrations/**/*.sql` - Database migrations
- `database/**/*.sql` - Database scripts

**Excluded:**
- `node_modules/`
- `dist/` and `build/`
- Test files (`*.test.ts`, `*.spec.ts`)

## Common Issues and Solutions

### 1. NEON References

**Issue:**
```typescript
// ❌ Old NEON connection
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.NEON_DATABASE_URL);
```

**Fix:**
```typescript
// ✅ Supabase PostgreSQL
import { createClient } from '@supabase/supabase-js';
const db = drizzle(/* use DATABASE_URL */);
```

### 2. Invalid Table Names

**Issue:**
```typescript
// ❌ Table doesn't exist
const data = await db.query.old_customers.findMany();
```

**Fix:**
```typescript
// ✅ Correct table name from schema
const data = await db.query.business_records.findMany();
```

### 3. Case Mismatches

**Issue:**
```typescript
// ❌ Wrong case
const user = await db.query.Users.findFirst();
```

**Fix:**
```typescript
// ✅ Correct case (snake_case)
const user = await db.query.users.findFirst();
```

### 4. Invalid Columns

**Issue:**
```typescript
// ❌ Column doesn't exist
where: eq(customers.tenant_id, tenantId)
```

**Fix:**
```typescript
// ✅ Correct column name
where: eq(customers.tenantId, tenantId)
```

## Integration with CI/CD

Add to your CI pipeline to catch issues early:

```yaml
# .github/workflows/schema-validation.yml
name: Schema Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx tsx tests/schema-validator.ts
```

## Workflow

1. **Run Validator**
   ```bash
   npx tsx tests/schema-validator.ts
   ```

2. **Review Report**
   - Open `tests/SCHEMA_VALIDATION_REPORT.md`
   - Check JSON output for automation

3. **Fix Issues**
   - Start with errors (highest priority)
   - Then fix warnings
   - Review info items

4. **Re-validate**
   - Run validator again
   - Repeat until all issues resolved

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "fix: resolve database schema validation issues"
   ```

## Advanced Usage

### Custom Schema Path

```bash
# Use a different schema file
SCHEMA_PATH=./custom-schema.md npx tsx tests/schema-validator.ts
```

### Filter by Issue Type

The JSON report can be filtered programmatically:

```typescript
import report from './tests/schema-validation-report.json';

// Get only NEON references
const neonIssues = report.issues.filter(i => i.type === 'neon_reference');

// Get errors only
const errors = report.issues.filter(i => i.severity === 'error');
```

## Troubleshooting

### False Positives

If the validator reports valid code as an issue:

1. Check if the table/column exists in `DATABASE_SCHEMA.md`
2. Verify the case matches exactly (camelCase vs snake_case)
3. Check for schema prefix (e.g., `public.users` vs `users`)

### Performance

For large codebases:
- The validator processes ~50 files per progress update
- Typical run time: 30-60 seconds for 500 files
- Output is buffered to avoid performance issues

### Missing Tables

If legitimate tables are reported as missing:

1. Regenerate DATABASE_SCHEMA.md:
   ```bash
   npx tsx scripts/database-schema-reporter.ts
   ```

2. Re-run validation:
   ```bash
   npx tsx tests/schema-validator.ts
   ```

## Contributing

To improve the validator:

1. **Add new patterns**: Update detection regex in `checkTableReferences()` or `checkColumnReferences()`
2. **Add new issue types**: Extend the `ValidationIssue` type
3. **Improve suggestions**: Enhance the similarity matching algorithms
4. **Add exclusions**: Update `isCommonWord()` or `isCommonMethod()`

## Examples

### Clean Report (No Issues)

```
✅ Validation passed with no issues!
Files Scanned:    500
Total Issues:     0
```

### Report with Issues

```
❌ Validation failed with errors!
Files Scanned:    500
Total Issues:     42
  Errors:         5   ← NEON references found
  Warnings:       35  ← Invalid columns
  Info:           2

See tests/SCHEMA_VALIDATION_REPORT.md for details.
```

## Next Steps

After running the validator:

1. **High Priority**: Fix all NEON database references
2. **Medium Priority**: Update invalid table references
3. **Low Priority**: Fix column name mismatches
4. **Maintenance**: Keep DATABASE_SCHEMA.md up to date

## Support

For issues or improvements, check:
- `tests/SCHEMA_VALIDATION_REPORT.md` - Detailed issue report
- `tests/schema-validation-report.json` - Raw data
- `docs/DATABASE_SCHEMA.md` - Source of truth for schema
