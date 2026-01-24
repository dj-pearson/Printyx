# Data Transformation Issue - Resolution Summary

## Problem Identified

**Issue**: Contact names displayed as `??` in the UI despite correct data in database.

**Root Cause**: Missing data transformation from snake_case (database) to camelCase (frontend).

```typescript
// Database returns:
{ first_name: "John", last_name: "Smith" }

// Component expects:
{ firstName: "John", lastName: "Smith" }

// Without transformation → undefined → displays as "??"
```

## Immediate Fixes Applied

### 1. CustomerDetail.tsx
**File**: `client/src/pages/CustomerDetail.tsx`

**Change**: Added `queryFn` with transformation for contacts query.

```typescript
// Before
const { data: companyContacts = [] } = useQuery({
  queryKey: ['/api/companies', customer?.id, 'contacts'],
  enabled: !!customer?.id,
});

// After
const { data: companyContacts = [] } = useQuery({
  queryKey: ['/api/companies', customer?.id, 'contacts'],
  enabled: !!customer?.id,
  queryFn: async () => {
    const response = await apiRequest(`/api/companies/${customer?.id}/contacts`, 'GET');
    return (response || []).map((c: any) => ({
      firstName: c.first_name || '',
      lastName: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      isPrimaryContact: c.is_primary_contact || false,
      // ... other fields
    }));
  },
});
```

### 2. Import Function Enhancement
**File**: `supabase/functions/import/index.ts`

**Change**: Auto-update placeholder contacts with real data during import.

**Before**:
- Imported data would skip updating existing contacts
- Placeholder contacts (`Primary`/`Contact`) stayed as placeholders

**After**:
- Detects placeholder contacts during import
- Automatically updates with real name data if available
- Logs update activity for transparency

```typescript
const isPlaceholder = 
  existingContact.first_name === 'Primary' && 
  existingContact.last_name === 'Contact';

if (isPlaceholder && hasRealContactData) {
  // Update with real data from import
  await admin.from('company_contacts').update({
    first_name: mappedData.primaryContactFirstName,
    last_name: mappedData.primaryContactLastName,
    // ...
  });
}
```

## Tools Created

### 1. Data Transformation Linter
**File**: `tools/data-transformation-linter.ts`

**Purpose**: Scan codebase for missing transformations.

**Usage**:
```bash
npm run lint:transformations
```

**Detects**:
- `useQuery` without `queryFn` transformation
- Direct snake_case property access
- Missing camelCase transformations

**Output**: JSON report with file locations and fix suggestions.

### 2. Data Transformation Auto-Fixer
**File**: `tools/data-transformation-fixer.ts`

**Purpose**: Automatically add missing transformations.

**Usage**:
```bash
# Preview changes
npm run fix:transformations:dry-run

# Apply fixes
npm run fix:transformations
```

**Features**:
- Detects missing `queryFn` in useQuery
- Generates appropriate transformation code
- Preserves code formatting
- Safe (dry-run mode available)

## Documentation Created

### 1. Contact Import Guide
**File**: `docs/CONTACT_IMPORT_GUIDE.md`

**Contents**:
- How placeholder detection works
- CSV column mapping reference
- Salesforce export compatibility
- Troubleshooting guide
- API endpoints reference

### 2. Data Transformation Strategy
**File**: `docs/DATA_TRANSFORMATION_STRATEGY.md`

**Contents**:
- Problem explanation with examples
- Automated detection tools usage
- Manual testing checklist
- Common patterns to fix
- Integration testing strategy
- Field mapping reference
- Prevention strategy
- Rollout plan

## Impact

### Immediate (Deployed)
✅ Contact names now display correctly in CustomerDetail
✅ Import function updates placeholders automatically
✅ Cache invalidation fixed for contact updates

### Future (Tools Available)
🔧 Automated detection of similar issues across codebase
🔧 Automated fixing capability (with human review)
📚 Comprehensive documentation for team
🧪 Testing strategy for ongoing development

## How to Use These Tools

### For Developers

1. **Before committing new code**:
   ```bash
   npm run lint:transformations
   ```
   Ensure no new transformation issues introduced.

2. **When adding new useQuery**:
   - Always include `queryFn` when fetching from `/api/`
   - Always transform snake_case to camelCase
   - Refer to field mapping in docs

3. **When editing components**:
   - Use camelCase properties (not snake_case)
   - Check types match expected format

### For QA/Testing

1. **Visual check**: No `??` in any UI
2. **Data persistence**: Changes save and reload correctly
3. **Network tab**: Check response has data
4. **Console**: No undefined property errors

### For Platform-Wide Fix

1. Run linter to identify all issues:
   ```bash
   npm run lint:transformations
   ```

2. Review report:
   ```bash
   cat tools/data-transformation-report.json
   ```

3. Fix incrementally (by entity type):
   - Contacts (✅ DONE)
   - Companies (next)
   - Customers
   - Equipment
   - Service Tickets
   - etc.

4. Test each fix before moving to next entity.

## Lessons Learned

1. **Always transform API data**: Database !== Frontend format
2. **Test data display**: Don't assume data shows correctly
3. **Cache invalidation**: Match fetch key exactly
4. **Automated tools**: Essential for large codebases
5. **Documentation**: Prevents repeat issues

## Next Steps

### Short Term (This Week)
- [ ] Run linter on full codebase
- [ ] Prioritize high-traffic pages (Companies, Customers)
- [ ] Fix and test incrementally

### Medium Term (This Month)
- [ ] Add ESLint rule to prevent missing transformations
- [ ] Create TypeScript types for all API responses
- [ ] Add E2E tests for data display
- [ ] Train team on new tools

### Long Term (Ongoing)
- [ ] Add CI check for transformation issues
- [ ] Maintain field mapping documentation
- [ ] Review new PRs for transformation correctness
- [ ] Consider API layer standardization (auto-transform?)

## Metrics to Track

- [ ] Number of `??` displays in production (should be 0)
- [ ] User reports of "missing data" (should decrease)
- [ ] Console errors for undefined properties (should decrease)
- [ ] E2E test pass rate (should increase)

## Questions?

- **Tooling**: See `docs/DATA_TRANSFORMATION_STRATEGY.md`
- **Import**: See `docs/CONTACT_IMPORT_GUIDE.md`
- **General Dev**: See `CLAUDE.md`

## Credits

**Issue Discovered**: User testing (contact names showing as `??`)  
**Root Cause Analysis**: Network tab inspection + database verification  
**Solution**: Systematic transformation + automated tooling  
**Date**: 2026-01-24
