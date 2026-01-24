# Data Transformation Testing & Fixing Strategy

## The Problem

**Root Cause**: API endpoints return snake_case (PostgreSQL convention), but React components expect camelCase (JavaScript convention).

**Common Symptom**: UI displays `??`, empty strings, or `undefined` even though data exists in the database.

**Why It Happens**:
```typescript
// ❌ BAD - No transformation
const { data: contacts } = useQuery({
  queryKey: ['/api/contacts'],
});
// API returns: { first_name: "John", last_name: "Smith" }
// Component tries: contact.firstName (undefined!)

// ✅ GOOD - With transformation
const { data: contacts } = useQuery({
  queryKey: ['/api/contacts'],
  queryFn: async () => {
    const response = await apiRequest('/api/contacts', 'GET');
    return response.map(c => ({
      firstName: c.first_name,
      lastName: c.last_name,
    }));
  },
});
```

## Automated Detection

### 1. Run the Linter

```bash
tsx tools/data-transformation-linter.ts
```

**What it finds:**
- `useQuery` without `queryFn` (missing transformation)
- Direct access to snake_case properties (`.first_name`)
- API endpoints that need transformation

**Output:**
```
❌ MISSING_QUERY_FN: 23 issues
⚠️  SNAKE_CASE_ACCESS: 156 issues

📄 Detailed report: tools/data-transformation-report.json
```

### 2. Run the Auto-Fixer (Dry Run)

```bash
tsx tools/data-transformation-fixer.ts --dry-run
```

**What it does:**
- Detects `useQuery` calls without transformations
- Generates appropriate `queryFn` with camelCase mapping
- Shows what would be changed (but doesn't modify files)

### 3. Apply Fixes

```bash
tsx tools/data-transformation-fixer.ts
```

**⚠️ Review all changes before committing!**

## Manual Testing Checklist

### For Each Entity Type

Test the **list view** and **detail view** for each entity:

- [ ] **Contacts** (`/contacts`, `/customers/:id/contacts`)
- [ ] **Companies** (`/companies`, `/companies/:id`)
- [ ] **Customers** (`/customers`, `/customers/:id`)
- [ ] **Business Records** (`/business-records`)
- [ ] **Leads** (`/leads`, `/leads/:id`)
- [ ] **Equipment** (`/equipment`, `/equipment/:id`)
- [ ] **Service Tickets** (`/service-tickets`, `/service-tickets/:id`)
- [ ] **Quotes** (`/quotes`, `/quotes/:id`)
- [ ] **Invoices** (`/invoices`, `/invoices/:id`)
- [ ] **Contracts** (`/contracts`, `/contracts/:id`)
- [ ] **Users** (`/users`, `/users/:id`)
- [ ] **Teams** (`/teams`, `/teams/:id`)

### Testing Steps

For each entity:

1. **Navigate to list view**
   - Check: Names/titles display correctly (not `??`)
   - Check: Dates display correctly
   - Check: Status fields display correctly

2. **Open detail view**
   - Check: All fields populated
   - Check: Related data (contacts, equipment, etc.) displays

3. **Edit a record**
   - Make a change
   - Save
   - Verify change persists after refresh

4. **Create a new record**
   - Fill all fields
   - Save
   - Verify it appears in list
   - Verify all fields saved correctly

5. **Check browser console**
   - No errors
   - No warnings about undefined properties

## Common Patterns to Fix

### Pattern 1: useQuery without queryFn

**Before:**
```typescript
const { data: contacts } = useQuery({
  queryKey: ['/api/companies', companyId, 'contacts'],
});
```

**After:**
```typescript
const { data: contacts } = useQuery({
  queryKey: ['/api/companies', companyId, 'contacts'],
  queryFn: async () => {
    const response = await apiRequest(`/api/companies/${companyId}/contacts`, 'GET');
    return (response || []).map((c: any) => ({
      id: c.id,
      firstName: c.first_name || '',
      lastName: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      title: c.title || '',
      isPrimaryContact: c.is_primary_contact || false,
      companyId: c.company_id,
    }));
  },
});
```

### Pattern 2: Direct snake_case access

**Before:**
```typescript
<div>{contact.first_name} {contact.last_name}</div>
```

**After:**
```typescript
<div>{contact.firstName} {contact.lastName}</div>
```

### Pattern 3: Missing cache invalidation

**Before:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['/api/company-contacts'] });
}
```

**After:**
```typescript
onSuccess: () => {
  // Match the fetch queryKey exactly!
  queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'contacts'] });
}
```

## Integration Testing

### End-to-End Test Suite

```typescript
// tests/data-transformation.spec.ts
import { test, expect } from '@playwright/test';

test('Contact names display correctly', async ({ page }) => {
  await page.goto('/customers');
  
  // Open first customer
  await page.click('[data-testid="customer-row"]:first-child');
  
  // Check contact section
  const contactName = page.locator('[data-testid="contact-name"]').first();
  const text = await contactName.textContent();
  
  // Should not show "??" or be empty
  expect(text).not.toBe('??');
  expect(text).not.toBe('');
  expect(text?.trim().length).toBeGreaterThan(0);
});

test('Contact edit persists', async ({ page }) => {
  await page.goto('/customers');
  await page.click('[data-testid="customer-row"]:first-child');
  
  // Edit contact
  await page.click('[data-testid="edit-contact-btn"]');
  await page.fill('[name="firstName"]', 'TestFirst');
  await page.fill('[name="lastName"]', 'TestLast');
  await page.click('[data-testid="save-contact-btn"]');
  
  // Refresh page
  await page.reload();
  
  // Verify change persisted
  const contactName = page.locator('[data-testid="contact-name"]').first();
  await expect(contactName).toContainText('TestFirst TestLast');
});
```

Run tests:
```bash
npm run test:e2e
```

## Field Mapping Reference

### Common Field Transformations

| Database (snake_case) | Frontend (camelCase) |
|-----------------------|----------------------|
| `first_name` | `firstName` |
| `last_name` | `lastName` |
| `company_id` | `companyId` |
| `tenant_id` | `tenantId` |
| `is_primary_contact` | `isPrimaryContact` |
| `is_primary` | `isPrimary` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `business_name` | `businessName` |
| `business_record_type` | `businessRecordType` |
| `billing_address` | `billingAddress` |
| `billing_city` | `billingCity` |
| `billing_state` | `billingState` |
| `billing_zip` | `billingZip` |
| `phone_number` | `phoneNumber` |
| `email_address` | `emailAddress` |

## Prevention Strategy

### 1. ESLint Rule (Future)

Create custom ESLint rule to prevent:
- `useQuery` without `queryFn` when `queryKey` contains `/api/`
- Direct access to known snake_case fields

### 2. TypeScript Types

Define strict types for API responses:

```typescript
// shared/api-types.ts
export interface ContactAPIResponse {
  id: string;
  first_name: string;  // snake_case from API
  last_name: string;
  // ...
}

export interface Contact {
  id: string;
  firstName: string;   // camelCase for frontend
  lastName: string;
  // ...
}

export function transformContact(api: ContactAPIResponse): Contact {
  return {
    id: api.id,
    firstName: api.first_name,
    lastName: api.last_name,
    // ...
  };
}
```

### 3. Code Review Checklist

- [ ] All `useQuery` calls have `queryFn` when fetching from `/api/`
- [ ] All API responses are transformed to camelCase
- [ ] No direct access to snake_case properties in components
- [ ] Cache invalidation keys match fetch keys exactly

### 4. CI/CD Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Check data transformations
  run: tsx tools/data-transformation-linter.ts
```

This will fail the build if transformation issues are detected.

## Priority Fix Order

### Phase 1: Critical User-Facing Issues (Week 1)
1. ✅ Contacts display (COMPLETED)
2. Customers list
3. Companies list
4. Business Records dashboard

### Phase 2: Detail Views (Week 2)
5. Customer detail pages
6. Company detail pages
7. Equipment detail pages
8. Service ticket detail pages

### Phase 3: Forms & Editing (Week 3)
9. All edit forms
10. All create forms
11. Bulk actions

### Phase 4: Reports & Analytics (Week 4)
12. Dashboard widgets
13. Report pages
14. Analytics pages

## Rollout Strategy

1. **Run linter** → Identify all issues
2. **Fix critical paths** → User-facing lists and details
3. **Test each fix** → Manual QA + E2E tests
4. **Deploy incrementally** → One entity type at a time
5. **Monitor production** → Check for errors in Sentry/logs
6. **Add prevention** → ESLint rules + CI checks

## Success Metrics

- [ ] Zero `??` displayed in any UI
- [ ] All fields display correct data after refresh
- [ ] All edits persist correctly
- [ ] Zero console errors related to undefined properties
- [ ] E2E tests pass for all entity types
- [ ] No user reports of "missing data"

## Quick Reference Commands

```bash
# Detect issues
tsx tools/data-transformation-linter.ts

# Preview fixes
tsx tools/data-transformation-fixer.ts --dry-run

# Apply fixes
tsx tools/data-transformation-fixer.ts

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```

## Questions?

See `CLAUDE.md` for general development guidelines or ask in Slack #engineering channel.
