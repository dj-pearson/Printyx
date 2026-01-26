# Schema Validation & Auto-Fix Toolkit

> Comprehensive database schema validation and automatic fixing for the Printyx platform

## 🎯 Quick Start (30 seconds)

```bash
# 1. Validate your codebase
npm run validate:schema

# 2. Preview automatic fixes
npm run fix:schema

# 3. Apply fixes (when ready)
npm run fix:schema:apply
```

## 📋 What This Does

This toolkit cross-references your entire codebase against `docs/DATABASE_SCHEMA.md` to find and fix:

- ❌ **NEON database references** (old database)
- ❌ **Invalid table names** (non-existent or misspelled)
- ⚠️ **Invalid column names** (wrong columns for tables)
- ⚠️ **Case mismatches** (camelCase vs snake_case)
- ⚠️ **Deprecated patterns** (old database code)

## 📊 Current Status

```
✅ Toolkit installed and tested
✅ 210 tables, 4,274 columns parsed from schema
✅ 1,108 files scanned across codebase
✅ 3,511 issues identified
   - 2,248 errors (mostly case mismatches)
   - 1,263 warnings (column references)
   - 0 NEON references (already migrated!)
✅ 4,540 auto-fixable issues found (324 files)
```

## 🚀 Getting Started

### Step 1: Run Validation

```bash
npm run validate:schema
```

This generates two reports:
- `tests/schema-validation-report.json` - Machine-readable
- `tests/SCHEMA_VALIDATION_REPORT.md` - Human-readable

**Example Output:**
```
============================================================
📋 VALIDATION SUMMARY
============================================================
Files Scanned:    1,108
Total Issues:     3,511
  Errors:         2,248 ❌
  Warnings:       1,263 ⚠️

Schema Info:
  Tables:         210
  Columns:        4,274
  Schemas:        _realtime, realtime, public, auth, storage
============================================================
```

### Step 2: Review Issues

Open `tests/SCHEMA_VALIDATION_REPORT.md` to see:

**Example Issue:**
```markdown
❌ Line 74: Table 'subscriptionPlans' not found in schema

```typescript
const existingPlan = await db.query.subscriptionPlans.findFirst({
```

💡 Suggestion: Did you mean 'subscription_plans'?
```

### Step 3: Preview Fixes

```bash
npm run fix:schema
```

This runs in **dry-run mode** (no changes made) and shows:
- What would be fixed
- Which files would be modified
- Confidence level of each fix

**Example Output:**
```
✅ Found 4,540 case mismatches
   Files affected: 324
   Mode: dry-run (no changes made)

💡 To apply these fixes, run:
   npm run fix:schema:apply
```

### Step 4: Apply Fixes

Choose your approach:

#### Option A: High-Confidence Only (Recommended)
```bash
npm run fix:schema:apply
```
Applies only fixes marked as "high confidence" (e.g., `tenantId` → `tenant_id`)

#### Option B: All Fixes
```bash
npm run fix:schema:auto
```
Applies ALL fixes automatically (use with caution)

**Safety Features:**
- ✅ Automatic backup created before any changes
- ✅ Backup location shown in output
- ✅ Easy rollback if needed

### Step 5: Verify & Test

```bash
# Re-run validation
npm run validate:schema

# Test your app
npm run dev

# Run tests
npm run test
```

## 📚 Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[This README](README.md)** | Quick start & overview | Start here |
| **[SCHEMA_VALIDATION_QUICKSTART.md](SCHEMA_VALIDATION_QUICKSTART.md)** | Detailed 3-step guide | For detailed workflow |
| **[README_SCHEMA_VALIDATOR.md](README_SCHEMA_VALIDATOR.md)** | Complete reference | For advanced usage |
| **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** | Technical details | For understanding internals |

## 🎨 Features

### Validator (`schema-validator.ts`)

✅ **Comprehensive Detection**
- Parses DATABASE_SCHEMA.md (210 tables, 4,274 columns)
- Scans TypeScript, JavaScript, SQL files
- Detects Drizzle ORM queries
- Finds raw SQL statements
- Identifies schema definition issues

✅ **Smart Filtering**
- Skips import statements
- Ignores comments
- Filters common words/methods
- Reduces false positives

✅ **Actionable Reports**
- Line-by-line issue breakdown
- Suggestions for fixes
- Similar table/column recommendations
- JSON + Markdown formats

### Auto-Fixer (`schema-fixer.ts`)

✅ **Safe Fixes**
- Dry-run mode by default
- Automatic backups before changes
- Confidence levels (high/medium/low)
- Rollback capability

✅ **Intelligent Patterns**
- NEON → Supabase migrations
- Case mismatch corrections
- Common typo fixes
- Deprecated pattern updates

## 🔧 Commands Reference

| Command | Description | Safety |
|---------|-------------|--------|
| `npm run validate:schema` | Run full validation | ✅ Read-only |
| `npm run fix:schema` | Preview fixes (dry-run) | ✅ No changes |
| `npm run fix:schema:apply` | Apply high-confidence fixes | ⚠️ Makes changes |
| `npm run fix:schema:auto` | Apply all fixes | ⚠️ Makes many changes |

**Direct execution:**
```bash
npx tsx tests/schema-validator.ts
npx tsx tests/schema-fixer.ts
npx tsx tests/schema-fixer.ts --apply
npx tsx tests/schema-fixer.ts --apply --auto
```

## 📊 Common Issues & Fixes

### Issue 1: Case Mismatches (Most Common)

**Problem:**
```typescript
// ❌ Wrong: camelCase
const plan = await db.query.subscriptionPlans.findFirst();
```

**Fix:**
```typescript
// ✅ Correct: snake_case
const plan = await db.query.subscription_plans.findFirst();
```

**Auto-fixable:** ✅ Yes (high confidence)

### Issue 2: Invalid Table Names

**Problem:**
```typescript
// ❌ Wrong: Table doesn't exist
const data = await db.query.old_customers.findMany();
```

**Fix:**
```typescript
// ✅ Correct: Use current table
const data = await db.query.business_records.findMany({
  where: eq(business_records.type, 'customer')
});
```

**Auto-fixable:** ❌ No (requires manual fix)

### Issue 3: Invalid Column Names

**Problem:**
```typescript
// ❌ Wrong: Column doesn't exist
where: eq(users.tenant_id, tenantId)
```

**Fix:**
```typescript
// ✅ Correct: Use actual column
where: eq(users.tenantId, tenantId)
```

**Auto-fixable:** ⚠️ Sometimes (medium confidence)

## 🎯 Best Practices

### 1. Run Regularly

```bash
# Before committing
npm run validate:schema

# Before deploying
npm run validate:schema && npm run build
```

### 2. Review Reports

Always check `SCHEMA_VALIDATION_REPORT.md` before applying fixes:
- Understand what's wrong
- Verify suggestions are correct
- Identify patterns in issues

### 3. Apply Fixes Incrementally

```bash
# Step 1: Preview
npm run fix:schema

# Step 2: Review the fix report
cat tests/SCHEMA_FIX_REPORT.md

# Step 3: Apply high-confidence fixes
npm run fix:schema:apply

# Step 4: Test
npm run dev && npm run test

# Step 5: Validate again
npm run validate:schema

# Step 6: Fix remaining issues manually
```

### 4. Keep Schema Updated

```bash
# Regenerate schema after database changes
npm run check:schema

# Then re-run validation
npm run validate:schema
```

## 🚨 Troubleshooting

### Problem: Too many false positives

**Solution:** The validator may need tuning for your specific code patterns. Common false positives:
- Dynamic table names
- Template strings with keywords
- Property accesses that look like table.column

Review and manually filter these from the report.

### Problem: Auto-fixer broke something

**Solution:** Restore from backup:
```bash
# Backups are in tests/backups/<timestamp>/
# Copy files back from backup directory
```

Then review the fix report to understand what changed.

### Problem: Schema is outdated

**Solution:**
```bash
# Regenerate the schema
npm run check:schema

# Re-run validation
npm run validate:schema
```

## 📈 Integration

### CI/CD Pipeline

```yaml
# .github/workflows/validate.yml
name: Schema Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run validate:schema
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
npm run validate:schema || {
  echo "❌ Schema validation failed!"
  exit 1
}
```

## 📁 Files Overview

```
tests/
├── schema-validator.ts          # Main validation engine (~750 lines)
├── schema-fixer.ts              # Auto-fix engine (~350 lines)
├── README.md                    # This file (quick start)
├── SCHEMA_VALIDATION_QUICKSTART.md  # Detailed guide
├── README_SCHEMA_VALIDATOR.md   # Complete reference
├── IMPLEMENTATION_SUMMARY.md    # Technical summary
├── schema-validation-report.json    # Generated: validation results
├── SCHEMA_VALIDATION_REPORT.md      # Generated: human-readable report
├── schema-fix-report.json       # Generated: fix results
├── SCHEMA_FIX_REPORT.md         # Generated: human-readable fixes
└── backups/                     # Generated: backup files (when applying fixes)
    └── <timestamp>/             # Timestamped backup directories
```

## 🎓 Learning Path

1. **Start here** → Read this README
2. **Run validation** → `npm run validate:schema`
3. **Review report** → Open `SCHEMA_VALIDATION_REPORT.md`
4. **Preview fixes** → `npm run fix:schema`
5. **Read quickstart** → `SCHEMA_VALIDATION_QUICKSTART.md`
6. **Apply fixes** → `npm run fix:schema:apply`
7. **Read reference** → `README_SCHEMA_VALIDATOR.md` (when needed)

## ✅ Success Checklist

- [ ] Read this README
- [ ] Run `npm run validate:schema`
- [ ] Review `SCHEMA_VALIDATION_REPORT.md`
- [ ] Understand the types of issues found
- [ ] Run `npm run fix:schema` (dry-run)
- [ ] Review `SCHEMA_FIX_REPORT.md`
- [ ] Apply fixes with `npm run fix:schema:apply`
- [ ] Test your application
- [ ] Fix remaining issues manually
- [ ] Add validation to CI/CD (optional)

## 🎉 Summary

You now have:
- ✅ Comprehensive schema validation
- ✅ Automatic fixing for common issues
- ✅ Detailed reports and documentation
- ✅ Safe backup and rollback
- ✅ npm integration for easy use

**Current findings:**
- 0 NEON references (database already migrated!)
- 3,511 total issues (mostly case mismatches)
- 4,540 auto-fixable issues

**Next step:** Run `npm run validate:schema` to see the full report!

---

**Version:** 1.0.0  
**Last Updated:** 2026-01-26  
**Status:** ✅ Production Ready
