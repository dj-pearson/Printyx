# Data Transformation Visual Guide

## The Problem (Before Fix)

```
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                   │
│                                                              │
│  company_contacts table:                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ id: "abc-123"                                         │  │
│  │ first_name: "John"      ← snake_case (SQL convention)│  │
│  │ last_name: "Smith"      ← snake_case (SQL convention)│  │
│  │ is_primary_contact: true                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTION (Deno)                      │
│                                                              │
│  GET /api/companies/:id/contacts                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Returns raw data AS-IS from database:                 │  │
│  │ {                                                     │  │
│  │   id: "abc-123",                                      │  │
│  │   first_name: "John",     ← Still snake_case         │  │
│  │   last_name: "Smith",     ← Still snake_case         │  │
│  │   is_primary_contact: true                           │  │
│  │ }                                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              REACT QUERY (Frontend - BEFORE FIX)             │
│                                                              │
│  useQuery({                                                  │
│    queryKey: ['/api/companies', id, 'contacts'],            │
│    // ❌ NO queryFn - no transformation!                    │
│  });                                                         │
│                                                              │
│  Data passed to component AS-IS:                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ contact.first_name = "John"                           │  │
│  │ contact.last_name = "Smith"                           │  │
│  │ contact.firstName = undefined  ← PROBLEM!             │  │
│  │ contact.lastName = undefined   ← PROBLEM!             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  REACT COMPONENT (JSX)                       │
│                                                              │
│  <div>                                                       │
│    {contact.firstName} {contact.lastName}                    │
│  </div>                                                      │
│                                                              │
│  Evaluates to:                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ undefined undefined                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  getInitials(contact.firstName, contact.lastName)            │
│  → getInitials(undefined, undefined)                         │
│  → "".charAt(0) + "".charAt(0)                               │
│  → "" + ""                                                   │
│  → "??" (fallback)                                           │
│                                                              │
│  ❌ RESULT: User sees "??"                                  │
└─────────────────────────────────────────────────────────────┘
```

## The Solution (After Fix)

```
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                   │
│                                                              │
│  company_contacts table:                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ id: "abc-123"                                         │  │
│  │ first_name: "John"      ← snake_case (SQL convention)│  │
│  │ last_name: "Smith"      ← snake_case (SQL convention)│  │
│  │ is_primary_contact: true                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTION (Deno)                      │
│                                                              │
│  GET /api/companies/:id/contacts                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Returns raw data from database:                       │  │
│  │ {                                                     │  │
│  │   id: "abc-123",                                      │  │
│  │   first_name: "John",     ← snake_case               │  │
│  │   last_name: "Smith",     ← snake_case               │  │
│  │   is_primary_contact: true                           │  │
│  │ }                                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              REACT QUERY (Frontend - AFTER FIX)              │
│                                                              │
│  useQuery({                                                  │
│    queryKey: ['/api/companies', id, 'contacts'],            │
│    ✅ queryFn: async () => {                                │
│      const response = await apiRequest(...);                 │
│      return response.map(c => ({                             │
│        id: c.id,                                             │
│        firstName: c.first_name,    ← TRANSFORM!             │
│        lastName: c.last_name,      ← TRANSFORM!             │
│        isPrimaryContact: c.is_primary_contact, ← TRANSFORM! │
│      }));                                                    │
│    }                                                         │
│  });                                                         │
│                                                              │
│  Data passed to component (TRANSFORMED):                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ contact.id = "abc-123"                                │  │
│  │ contact.firstName = "John"    ← CORRECT!              │  │
│  │ contact.lastName = "Smith"    ← CORRECT!              │  │
│  │ contact.isPrimaryContact = true                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  REACT COMPONENT (JSX)                       │
│                                                              │
│  <div>                                                       │
│    {contact.firstName} {contact.lastName}                    │
│  </div>                                                      │
│                                                              │
│  Evaluates to:                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ John Smith                                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  getInitials(contact.firstName, contact.lastName)            │
│  → getInitials("John", "Smith")                              │
│  → "J" + "S"                                                 │
│  → "JS"                                                      │
│                                                              │
│  ✅ RESULT: User sees "John Smith" and avatar "JS"         │
└─────────────────────────────────────────────────────────────┘
```

## Key Differences

### Before Fix
```typescript
// ❌ No transformation
const { data: contacts } = useQuery({
  queryKey: ['/api/companies', id, 'contacts'],
  // Missing queryFn!
});

// Data arrives as:
// { first_name: "John", last_name: "Smith" }

// Component expects:
// { firstName: "John", lastName: "Smith" }

// Result: undefined properties → ??
```

### After Fix
```typescript
// ✅ With transformation
const { data: contacts } = useQuery({
  queryKey: ['/api/companies', id, 'contacts'],
  queryFn: async () => {
    const response = await apiRequest(`/api/companies/${id}/contacts`, 'GET');
    return (response || []).map((c: any) => ({
      id: c.id,
      firstName: c.first_name || '',      // snake → camel
      lastName: c.last_name || '',        // snake → camel
      email: c.email || '',
      phone: c.phone || '',
      isPrimaryContact: c.is_primary_contact || false, // snake → camel
      companyId: c.company_id,            // snake → camel
    }));
  },
});

// Data arrives transformed:
// { firstName: "John", lastName: "Smith" }

// Component expects:
// { firstName: "John", lastName: "Smith" }

// Result: Perfect match! ✅
```

## Data Flow Comparison

### ❌ Without Transformation
```
Database     Edge Function    React Query       Component
(snake)   →   (snake)      →   (snake)       →   expects camel
                                                   ↓
                                                 ERROR!
                                                   ??
```

### ✅ With Transformation
```
Database     Edge Function    React Query       Component
(snake)   →   (snake)      →   TRANSFORM     →   expects camel
                                 (camel)           ↓
                                                 SUCCESS!
                                                 "John Smith"
```

## Why This Happens

### Convention Mismatch

**PostgreSQL Convention**: `snake_case`
- `first_name`, `last_name`, `is_primary_contact`
- Follows SQL naming standards
- Used in all database schemas

**JavaScript Convention**: `camelCase`
- `firstName`, `lastName`, `isPrimaryContact`
- Standard in JS/TS codebases
- Used in React components

### The Gap

**API Layer** returns database format (snake_case)
**Frontend Layer** expects JavaScript format (camelCase)

**Without explicit transformation** → properties don't match → `undefined`

## Real Example from Codebase

### Before (CustomerDetail.tsx)
```typescript
const { data: companyContacts = [] } = useQuery({
  queryKey: ['/api/companies', customer?.id, 'contacts'],
  enabled: !!customer?.id,
  // ❌ No transformation - data arrives as snake_case
});

const primaryContact = useMemo(() => {
  const list = (companyContacts as any[]) || [];
  if (!list.length) return null;
  // ❌ Tries to access c.isPrimaryContact but data has c.is_primary_contact
  return list.find((c: any) => c.isPrimaryContact) || list[0];
}, [companyContacts]);

// Later in JSX:
<div>{primaryContact.firstName} {primaryContact.lastName}</div>
// ❌ firstName is undefined, lastName is undefined → displays ??
```

### After (CustomerDetail.tsx)
```typescript
const { data: companyContacts = [] } = useQuery({
  queryKey: ['/api/companies', customer?.id, 'contacts'],
  enabled: !!customer?.id,
  // ✅ Transformation layer added
  queryFn: async () => {
    const response = await apiRequest(`/api/companies/${customer?.id}/contacts`, 'GET');
    return (response || []).map((c: any) => ({
      id: c.id,
      firstName: c.first_name || '',           // ✅ Transform
      lastName: c.last_name || '',             // ✅ Transform
      email: c.email || '',
      phone: c.phone || '',
      isPrimaryContact: c.is_primary_contact || false, // ✅ Transform
      companyId: c.company_id,                 // ✅ Transform
    }));
  },
});

const primaryContact = useMemo(() => {
  const list = (companyContacts as any[]) || [];
  if (!list.length) return null;
  // ✅ Now c.isPrimaryContact exists (camelCase)
  return list.find((c: any) => c.isPrimaryContact) || list[0];
}, [companyContacts]);

// Later in JSX:
<div>{primaryContact.firstName} {primaryContact.lastName}</div>
// ✅ firstName = "John", lastName = "Smith" → displays "John Smith"
```

## Tools to Prevent This

### 1. Linter (Detection)
```bash
npm run lint:transformations
```
Scans entire codebase, reports all missing transformations.

### 2. Auto-Fixer (Correction)
```bash
npm run fix:transformations:dry-run  # Preview
npm run fix:transformations          # Apply
```
Automatically adds queryFn transformations.

### 3. TypeScript Types (Prevention)
```typescript
// Define API response type (snake_case)
interface ContactAPIResponse {
  id: string;
  first_name: string;
  last_name: string;
}

// Define frontend type (camelCase)
interface Contact {
  id: string;
  firstName: string;
  lastName: string;
}

// Transformation function
function transformContact(api: ContactAPIResponse): Contact {
  return {
    id: api.id,
    firstName: api.first_name,
    lastName: api.last_name,
  };
}
```

## Best Practices

1. **Always transform API data** in `queryFn`
2. **Use camelCase** in all React components
3. **Use snake_case** in all database queries
4. **Never mix conventions** in the same layer
5. **Run linter** before committing
6. **Add E2E tests** for data display
7. **Document field mappings** in code comments

## Quick Reference

| Database (snake_case) | Frontend (camelCase) |
|-----------------------|----------------------|
| `first_name` | `firstName` |
| `last_name` | `lastName` |
| `company_id` | `companyId` |
| `is_primary_contact` | `isPrimaryContact` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `business_name` | `businessName` |

See full mapping: `docs/DATA_TRANSFORMATION_STRATEGY.md`
