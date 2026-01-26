# Contacts Page 403 Error - Fix Documentation

## 🔴 **Problem Identified**

The Contacts page at `printyx.net/contacts` is experiencing **403 Forbidden errors** and trying to call non-existent endpoints.

### Root Causes

1. **Direct Supabase REST API Calls** (Line 425-429 in `Contacts.tsx`)
   ```typescript
   const { data, error } = await supabase
     .from('company_contacts')
     .select('*')
     .eq('tenant_id', tenantId)
     .order('updated_at', { ascending: false });
   ```
   - This bypasses Edge Functions
   - Gets blocked by Row Level Security (RLS) policies
   - Results in **403 Forbidden** errors

2. **Non-Existent Edge Function Call**
   ```
   GET https://functions.printyx.net/enrichment/contacts?page=1&limit=25 404 (Not Found)
   ```
   - The `/enrichment/contacts` endpoint doesn't exist
   - Needs to be removed or implemented

3. **Auth Context Issue**
   ```
   "No role found (neither role string nor role_id), using default user role"
   ```
   - User's role isn't being properly detected
   - May be causing RLS policy failures

---

## ✅ **Solution**

### Option 1: Use Existing API Endpoint (RECOMMENDED)

**Fix: Use the `/api/company-contacts` Edge Function** that we already created.

**Change in `client/src/pages/Contacts.tsx` (Line 407-518):**

```typescript
// ❌ BEFORE - Direct Supabase Call (BLOCKED BY RLS)
const {
  data: contactsData,
  isLoading,
  error,
} = useQuery({
  queryKey: [
    'supabase-company-contacts',
    tenantId,
    filters,
    searchQuery,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
  ],
  queryFn: async () => {
    if (!tenantId) return { contacts: [], total: 0, page: currentPage, limit: pageSize };

    const { data, error } = await supabase
      .from('company_contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    // ... transformation logic
  },
  retry: 2,
  enabled: !!tenantId,
});

// ✅ AFTER - Use Edge Function API (WORKS)
const {
  data: contactsData,
  isLoading,
  error,
} = useQuery({
  queryKey: [
    'company-contacts-api',
    tenantId,
    filters,
    searchQuery,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
  ],
  queryFn: async () => {
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    params.append('limit', pageSize.toString());
    
    if (searchQuery) params.append('search', searchQuery);
    if (filters.leadStatus && filters.leadStatus !== 'all') 
      params.append('status', filters.leadStatus);
    if (filters.contactOwner && filters.contactOwner !== 'all') 
      params.append('ownerId', filters.contactOwner);
    if (sortBy) params.append('sortBy', sortBy);
    if (sortOrder) params.append('sortOrder', sortOrder);

    const response = await apiRequest(`/api/companies/all/contacts?${params.toString()}`, 'GET');
    
    return {
      contacts: (response?.contacts || []).map((c: any) => ({
        id: c.id,
        firstName: c.first_name || c.firstName || '',
        lastName: c.last_name || c.lastName,
        email: c.email || '',
        phone: c.phone || '',
        title: c.title || '',
        companyId: c.company_id || c.companyId,
        companyName: c.company_name || c.companyName || '',
        leadStatus: c.lead_status || c.leadStatus || 'new',
        lastContactDate: c.last_contact_date || c.lastContactDate,
        nextFollowUpDate: c.next_follow_up_date || c.nextFollowUpDate,
        createdAt: c.created_at || c.createdAt,
        ownerId: c.owner_id || c.ownerId,
        ownerName: c.owner_name || c.ownerName || 'Unassigned',
        department: c.department || '',
        mobile: c.mobile || '',
        salutation: c.salutation || '',
        tenantId: c.tenant_id || c.tenantId,
      })),
      total: response?.total || 0,
      page: response?.page || currentPage,
      limit: response?.limit || pageSize,
    };
  },
  retry: 2,
  enabled: !!tenantId,
});
```

### Option 2: Fix RLS Policies (If You Want Direct Access)

If you want to keep the direct Supabase calls, you need to add proper RLS policies:

**Run this SQL on your Supabase database:**

```sql
-- Enable RLS on company_contacts table
ALTER TABLE company_contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read contacts in their tenant
CREATE POLICY "Users can read contacts in their tenant"
ON company_contacts
FOR SELECT
USING (
  tenant_id = (
    SELECT raw_app_meta_data->>'tenantId' 
    FROM auth.users 
    WHERE id = auth.uid()
  )::uuid
);

-- Policy: Users can insert contacts in their tenant
CREATE POLICY "Users can insert contacts in their tenant"
ON company_contacts
FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT raw_app_meta_data->>'tenantId' 
    FROM auth.users 
    WHERE id = auth.uid()
  )::uuid
);

-- Policy: Users can update contacts in their tenant
CREATE POLICY "Users can update contacts in their tenant"
ON company_contacts
FOR UPDATE
USING (
  tenant_id = (
    SELECT raw_app_meta_data->>'tenantId' 
    FROM auth.users 
    WHERE id = auth.uid()
  )::uuid
);

-- Policy: Users can delete contacts in their tenant
CREATE POLICY "Users can delete contacts in their tenant"
ON company_contacts
FOR DELETE
USING (
  tenant_id = (
    SELECT raw_app_meta_data->>'tenantId' 
    FROM auth.users 
    WHERE id = auth.uid()
  )::uuid
);
```

---

## 🔧 **Additional Fixes Needed**

### 1. Remove Non-Existent Enrichment Call

**Location:** The error shows calls to `/enrichment/contacts` which doesn't exist.

**Search for:** Any references to `enrichment/contacts` in the codebase and remove or fix them.

```bash
# Find the reference
grep -r "enrichment/contacts" client/src/
```

### 2. Fix "No Role Found" Warning

**Problem:** User's role isn't being detected properly.

**Check:** `client/src/providers/AuthProvider.tsx` and ensure it's properly setting the user's role from JWT metadata.

**Expected JWT structure:**
```json
{
  "app_metadata": {
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user",
    "role_id": "some-role-uuid"
  }
}
```

---

## 🎯 **Recommended Immediate Action**

### Step 1: Fix Contacts Page (5 minutes)
Use **Option 1** above - change to use the Edge Function API instead of direct Supabase calls.

### Step 2: Run System Check (1 minute)
```bash
npm run check:system
```

This will scan your entire codebase and report:
- Missing Edge Functions
- Direct Supabase REST API calls (potential RLS issues)
- Missing queryFn transformations
- API endpoint mismatches

### Step 3: Deploy Edge Function for Contacts (if needed)

If the `/api/companies/all/contacts` endpoint doesn't exist, create it or use the existing company-contacts endpoint.

---

## 📊 **Why This Happened**

1. **Direct Database Access Pattern**: The Contacts page was using direct Supabase client calls instead of going through Edge Functions
2. **RLS Not Configured**: The `company_contacts` table likely doesn't have proper RLS policies
3. **Mixed Patterns**: Some pages use Edge Functions, some use direct Supabase calls - inconsistent architecture

---

## 🛡️ **Best Practice Going Forward**

### Always Use Edge Functions for Data Access

**Why?**
- ✅ Consistent authorization
- ✅ Better error handling
- ✅ Centralized business logic
- ✅ Easier to debug
- ✅ No RLS configuration needed
- ✅ Data transformation in one place

**Pattern to Follow:**
```
Frontend (React Query with queryFn) 
  → Edge Function (/api/*)
    → Database (with tenant filtering)
      → Return transformed data
```

**NOT:**
```
Frontend (React Query) 
  → Direct Supabase Client
    → Database (blocked by RLS) ❌
```

---

## 📝 **Testing After Fix**

1. **Clear browser cache and reload**
2. **Check console** - should see no 403 or 404 errors
3. **Verify contacts load** - should display contact list
4. **Test create contact** - should successfully create
5. **Test filters** - should filter correctly

---

## 🚀 **Deployment Checklist**

- [ ] Update `Contacts.tsx` to use API endpoint
- [ ] Remove enrichment endpoint references
- [ ] Test locally
- [ ] Commit changes
- [ ] Push to main
- [ ] Cloudflare Pages rebuilds automatically
- [ ] Verify in production

---

*Last Updated: January 24, 2026*
*Issue: 403 Forbidden on Contacts Page*
*Fix: Use Edge Functions instead of Direct Supabase Calls*
