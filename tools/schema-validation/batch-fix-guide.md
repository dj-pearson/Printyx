# Batch Fix Guide - Schema Validation Issues

## Strategy: Smart Automated + Manual Review

Out of **634 issues** found, here's the breakdown:

### ✅ Auto-Fixable (~30-40%)

These can be fixed with automated scripts:

- Simple column renames with suggestions
- Removing non-existent columns from queries
- Consistent patterns across files

### 🔍 Needs Manual Review (~40-50%)

These require your judgment:

- `app_metadata` & `user_metadata` (valid on Supabase auth.User)
- Nested data structures (API responses vs database queries)
- Business logic decisions (which field to use)

### ⚠️ False Positives (~10-20%)

These might not be issues:

- Columns from external APIs
- Computed properties
- Dynamic column names

## 🚀 Recommended Approach

### Phase 1: High-Impact Files (Manual)

Fix these files first - they have the most issues and are critical:

```bash
# Top 5 files to fix manually:
1. server/services/service-manager-reporting-service.ts (38 issues)
2. server/routes-sales-pipeline.ts (34 issues)
3. server/services/sales-reporting-service.ts (34 issues)
4. supabase/functions/me/index.ts (27 issues)
5. client/src/pages/LeadsManagement.tsx (17 issues)
```

**Why manual?** These files contain complex business logic and reporting queries.

### Phase 2: Pattern-Based Auto-Fix

Use the auto-fix tool for repetitive issues:

```powershell
# Preview what will be fixed (dry run)
npx tsx tools/schema-validation/auto-fix.ts

# Apply automatic fixes
npx tsx tools/schema-validation/auto-fix.ts --apply

# Verify fixes worked
npx tsx tools/schema-validation/validate-code.ts
```

### Phase 3: Remaining Issues

After auto-fix, tackle remaining issues by category:

1. **Metadata fields** - Verify these are auth.User objects
2. **Nested structures** - Transform API responses correctly
3. **Missing columns** - Add to schema or remove references

## 📊 Issue Categories

### Category 1: Invalid Metadata Access

**Example**: `user.app_metadata`, `user.user_metadata`

**Issue**: Validator thinks these don't exist, but they're valid on Supabase `auth.User`

**Fix**:

```typescript
// ✅ Valid for auth.User objects
const metadata = user.user_metadata;
const appData = user.app_metadata;

// ❌ Invalid for database users table
// (use role_id, permissions, etc. instead)
```

**Action**: Review and mark as valid if using Supabase auth

### Category 2: Nested Data Structures

**Example**: `customer.company_name`, `row.primary_contact_email`

**Issue**: Data comes from Edge Function with nested structure

**Fix**:

```typescript
// ❌ BEFORE
const name = customer.company_name;

// ✅ AFTER
const name = customer.companies?.business_name;

// Or transform in useMemo
const enriched = customers.map((c) => ({
  ...c,
  companyName: c.companies?.business_name,
}));
```

**Action**: Add data transformation layer (we did this for customers.tsx!)

### Category 3: Wrong Table

**Example**: `customers.customer_since`

**Issue**: Column exists but in different table

**Fix**:

```typescript
// ❌ BEFORE
.select('id, customer_since')
.from('customers')

// ✅ AFTER
.select(`
  id,
  companies!inner(customer_since)
`)
.from('customers')
```

**Action**: Update query to include nested select

### Category 4: Doesn't Exist Anywhere

**Example**: `access_scope`, `is_platform_user`

**Issue**: Column was removed/never existed

**Fix**: Remove all references or use correct alternative

**Action**: Remove or replace with actual columns

## 🛠️ Tools Available

### 1. View Validation Report

```powershell
# Open detailed report
code tools/schema-validation/VALIDATION_REPORT.md
```

### 2. Check Specific Table

```powershell
# See what columns actually exist
npx tsx tools/schema-validation/view-table.ts users
npx tsx tools/schema-validation/view-table.ts customers
npx tsx tools/schema-validation/view-table.ts companies
```

### 3. Auto-Fix Preview

```powershell
# See what can be auto-fixed
npx tsx tools/schema-validation/auto-fix.ts --rules
```

### 4. Validate After Fixes

```powershell
# Check progress
npx tsx tools/schema-validation/validate-code.ts
```

## 📝 Fix Checklist

- [ ] Review VALIDATION_REPORT.md
- [ ] Fix top 10 most problematic files manually
- [ ] Run auto-fix in dry-run mode
- [ ] Review auto-fix suggestions
- [ ] Apply auto-fixes
- [ ] Re-run validation
- [ ] Fix remaining issues by category
- [ ] Final validation pass
- [ ] Update schema documentation

## 💡 Tips

1. **Start with Server**: Server-side issues are more critical than client-side
2. **Fix by File**: Complete one file at a time for better context
3. **Test After Each Fix**: Run validation after major changes
4. **Commit Often**: Small commits make it easier to revert if needed
5. **Use Type Safety**: Import `TableColumns` for future queries

## 🎯 Success Criteria

**Goal**: Reduce from 634 to < 50 issues

**Expected outcome**:

- ✅ All database queries use valid columns
- ✅ Nested data properly transformed
- ✅ Auth metadata correctly accessed
- ✅ Type-safe column references

## 📞 Need Help?

If you're unsure about a fix:

1. Check `VALIDATION_REPORT.md` for suggestions
2. Run `view-table.ts` to see actual schema
3. Look at similar working code (like our CustomerDetail.tsx fix)
4. Mark for manual review and continue
