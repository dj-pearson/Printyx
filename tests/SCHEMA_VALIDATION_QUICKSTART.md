# Schema Validation - Quick Start Guide

Complete guide to validating and fixing database schema references in your codebase.

## 🎯 Overview

This toolkit helps you ensure your codebase correctly references the database schema documented in `docs/DATABASE_SCHEMA.md`. It identifies and helps fix:

- ❌ **NEON database references** (old database)
- ❌ **Invalid table names** (non-existent tables)
- ⚠️ **Invalid column names** (non-existent columns)
- ⚠️ **Case mismatches** (camelCase vs snake_case)
- ⚠️ **Deprecated patterns** (old database connection code)

## 🚀 Quick Start (3 Steps)

### Step 1: Validate Your Schema

Run the validator to find all issues:

```bash
npm run validate:schema
```

This will:
- ✅ Parse `docs/DATABASE_SCHEMA.md` (210 tables, 4274 columns)
- ✅ Scan your entire codebase
- ✅ Generate two reports:
  - `tests/schema-validation-report.json` (machine-readable)
  - `tests/SCHEMA_VALIDATION_REPORT.md` (human-readable)

**Output:**
```
🚀 Starting Schema Validation...

📖 Parsing DATABASE_SCHEMA.md...
✅ Parsed 210 tables

🔍 Finding files to scan...
📁 Found 500 files to scan

🔍 Scanning files for issues...
  📄 Scanned 50 files...
  📄 Scanned 100 files...
  ...

============================================================
📋 VALIDATION SUMMARY
============================================================
Files Scanned:    500
Total Issues:     42
  Errors:         5
  Warnings:       35
  Info:           2

Schema Info:
  Tables:         210
  Columns:        4274
  Schemas:        public, auth, _realtime, ...
============================================================
```

### Step 2: Review the Report

Open the human-readable report:

```bash
# Windows
notepad tests\SCHEMA_VALIDATION_REPORT.md

# Mac/Linux
cat tests/SCHEMA_VALIDATION_REPORT.md
```

The report organizes issues by type:

#### 🔴 NEON Database References (Critical)
```
❌ Line 15: Reference to NEON database found
```typescript
import { neon } from '@neondatabase/serverless';
```
💡 Suggestion: Update to use Supabase PostgreSQL (209.145.59.219:5433)
```

#### ❌ Invalid Table References (Critical)
```
❌ Line 42: Table 'old_customers' not found in schema
```typescript
const data = await db.query.old_customers.findMany();
```
💡 Suggestion: Did you mean 'business_records'?
```

#### ⚠️ Invalid Column References (Warning)
```
⚠️ Line 68: Column 'tenant_id' not found in table 'users'
```typescript
where: eq(users.tenant_id, tenantId)
```
💡 Suggestion: Did you mean 'users.tenantId'?
```

### Step 3: Fix the Issues

You have two options:

#### Option A: Auto-Fix (Recommended for Simple Issues)

Preview fixes without applying them:

```bash
npm run fix:schema
```

Apply high-confidence fixes only:

```bash
npm run fix:schema:apply
```

Apply ALL fixes automatically:

```bash
npm run fix:schema:auto
```

**What gets auto-fixed:**
- ✅ NEON import statements → Supabase/Drizzle
- ✅ NEON environment variables → DATABASE_URL
- ✅ Common case mismatches (tenantId → tenant_id)
- ✅ Deprecated patterns → Modern equivalents

#### Option B: Manual Fix

For complex issues or low-confidence fixes, manually update the code based on suggestions in the report.

## 📊 Understanding the Reports

### Validation Report (`SCHEMA_VALIDATION_REPORT.md`)

**Structure:**
```markdown
# Schema Validation Report

## Summary
- Files Scanned: 500
- Total Issues: 42
  - Errors: 5 ❌    ← Fix these first!
  - Warnings: 35 ⚠️  ← Fix these next
  - Info: 2 ℹ️       ← Review these

## 🔴 NEON Database References
[List of NEON references with line numbers and suggestions]

## ❌ Invalid Table References
[List of invalid tables with suggestions]

## ⚠️ Invalid Column References
[List of invalid columns with suggestions]

## 🎯 Recommendations
[Specific action items based on your issues]

## Next Steps
[Step-by-step guide to fix issues]
```

### Fix Report (`SCHEMA_FIX_REPORT.md`)

**Structure:**
```markdown
# Schema Auto-Fix Report

## Summary
- Files Modified: 12
- Total Fixes: 28
- Backup Location: tests/backups/2026-01-26T12-30-00/

## NEON REFERENCE
### server/db.ts
✅ Line 5 (high confidence)
**Before:**
import { neon } from '@neondatabase/serverless';

**After:**
import postgres from 'drizzle-orm/postgres-js';
```

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `npm run validate:schema` | Run validation and generate reports |
| `npm run fix:schema` | Preview fixes (dry run) |
| `npm run fix:schema:apply` | Apply high-confidence fixes |
| `npm run fix:schema:auto` | Apply all fixes automatically |

**Direct execution:**
```bash
# Validator
npx tsx tests/schema-validator.ts

# Fixer (dry run)
npx tsx tests/schema-fixer.ts

# Fixer (apply)
npx tsx tests/schema-fixer.ts --apply

# Fixer (auto-apply all)
npx tsx tests/schema-fixer.ts --apply --auto
```

## 🎨 Common Issue Patterns

### Pattern 1: NEON References

**Issue:**
```typescript
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.NEON_DATABASE_URL);
```

**Fix:**
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
```

### Pattern 2: Invalid Table Names

**Issue:**
```typescript
// ❌ Wrong: Table doesn't exist
const customers = await db.query.customers.findMany();
```

**Fix:**
```typescript
// ✅ Correct: Use actual table name
const customers = await db.query.business_records.findMany({
  where: eq(business_records.type, 'customer')
});
```

### Pattern 3: Case Mismatches

**Issue:**
```typescript
// ❌ Wrong: camelCase (doesn't exist in DB)
where: eq(users.tenantId, id)
```

**Fix:**
```typescript
// ✅ Correct: snake_case (matches DB schema)
where: eq(users.tenant_id, id)
```

### Pattern 4: Non-Existent Columns

**Issue:**
```typescript
// ❌ Wrong: Column doesn't exist
select: { id: true, full_name: true }
```

**Fix:**
```typescript
// ✅ Correct: Use actual column names
select: { id: true, firstName: true, lastName: true }
```

## 🔄 Typical Workflow

### First Time Setup

1. **Run Validation**
   ```bash
   npm run validate:schema
   ```

2. **Review Reports**
   - Check `tests/SCHEMA_VALIDATION_REPORT.md`
   - Note the number of errors and warnings
   - Understand the types of issues

3. **Apply Auto-Fixes**
   ```bash
   # Preview first
   npm run fix:schema
   
   # Apply if looks good
   npm run fix:schema:apply
   ```

4. **Validate Again**
   ```bash
   npm run validate:schema
   ```

5. **Manual Fixes**
   - Fix remaining issues manually
   - Use suggestions in the report
   - Refer to DATABASE_SCHEMA.md for correct names

6. **Final Validation**
   ```bash
   npm run validate:schema
   ```

7. **Test & Commit**
   ```bash
   # Test your app
   npm run dev
   
   # Run tests
   npm run test
   
   # Commit if everything works
   git add .
   git commit -m "fix: resolve database schema validation issues"
   ```

### Regular Maintenance

Run validation regularly to catch issues early:

```bash
# Before committing changes
npm run validate:schema

# In CI/CD pipeline
npm run validate:schema && npm run build
```

## 🚨 Troubleshooting

### Issue: False Positives

**Problem:** Validator reports valid code as an issue.

**Solutions:**
1. Check if table/column exists in `docs/DATABASE_SCHEMA.md`
2. Verify exact case matches (camelCase vs snake_case)
3. Check for schema prefix (e.g., `public.users` vs `users`)
4. Regenerate schema if tables are missing:
   ```bash
   npm run check:schema
   ```

### Issue: Auto-Fixer Breaks Code

**Problem:** Code doesn't work after applying auto-fixes.

**Solutions:**
1. Restore from backup:
   ```bash
   # Backup is in tests/backups/<timestamp>/
   cp -r tests/backups/<timestamp>/* .
   ```
2. Review the fix report to see what changed
3. Apply fixes manually instead of using auto-fix
4. Report the issue so patterns can be improved

### Issue: Schema Out of Date

**Problem:** Validator reports tables that actually exist.

**Solutions:**
1. Regenerate the schema document:
   ```bash
   npm run check:schema
   ```
2. Review and commit the updated `docs/DATABASE_SCHEMA.md`
3. Re-run validation:
   ```bash
   npm run validate:schema
   ```

### Issue: Too Many Issues

**Problem:** Thousands of issues reported, overwhelming to fix.

**Solutions:**
1. Start with critical errors only (NEON references)
2. Use auto-fix for high-confidence fixes:
   ```bash
   npm run fix:schema:auto
   ```
3. Fix one file type at a time (e.g., all route files)
4. Consider gradual migration approach

## 📈 Integration with CI/CD

### GitHub Actions

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
        with:
          node-version: '18'
      - run: npm install
      - run: npm run validate:schema
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: schema-validation-report
          path: tests/SCHEMA_VALIDATION_REPORT.md
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run schema validation
npm run validate:schema || {
  echo "❌ Schema validation failed!"
  echo "   Review tests/SCHEMA_VALIDATION_REPORT.md"
  echo "   Fix issues or use: npm run fix:schema:apply"
  exit 1
}
```

## 📚 Advanced Usage

### Filter Issues Programmatically

```typescript
import report from './tests/schema-validation-report.json';

// Get NEON issues only
const neonIssues = report.issues.filter(i => i.type === 'neon_reference');

// Get errors in specific directory
const serverErrors = report.issues.filter(i => 
  i.severity === 'error' && i.file.startsWith('server/')
);

// Generate custom report
console.log(`Server has ${serverErrors.length} critical issues`);
```

### Custom Validation Rules

Extend the validator by modifying `tests/schema-validator.ts`:

```typescript
// Add new pattern detection
checkCustomPattern(content: string, filePath: string): void {
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    if (/your-pattern-here/.test(line)) {
      this.issues.push({
        type: 'custom_issue',
        severity: 'warning',
        file: filePath,
        line: index + 1,
        content: line.trim(),
        message: 'Your custom message',
      });
    }
  });
}
```

## 📝 Summary

**Key Benefits:**
- ✅ Catch database reference errors early
- ✅ Ensure consistency with schema documentation
- ✅ Automate common fixes
- ✅ Prevent NEON/old database references
- ✅ Maintain code quality

**Best Practices:**
1. Run validation before every commit
2. Keep DATABASE_SCHEMA.md up to date
3. Use auto-fix for simple issues
4. Review all changes before committing
5. Add validation to CI/CD pipeline

**Support:**
- Documentation: `tests/README_SCHEMA_VALIDATOR.md`
- Reports: `tests/SCHEMA_VALIDATION_REPORT.md`
- Source: `tests/schema-validator.ts`, `tests/schema-fixer.ts`
