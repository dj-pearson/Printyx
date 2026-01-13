# Companies-Based Architecture Migration Plan

**Status:** In Progress  
**Created:** January 13, 2026  
**Decision:** Migrate from `business_records` to `companies`-based architecture

## Executive Summary

Reverting to the proven `companies`-based architecture from your old NEON database. This provides a single source of truth for company data and follows industry-standard CRM patterns.

## The Problem with business_records

### Current Issues
- ❌ **Data Duplication**: Company info duplicated in every lead/customer record
- ❌ **No Multi-Contact Support**: Can't have multiple contacts per company
- ❌ **Lost Relationships**: Converting lead → customer loses history
- ❌ **Denormalized**: Violates database best practices
- ❌ **Inconsistency Risk**: Same company can have different data in different records

### Files Currently Using business_records
**Frontend (11 files):**
- `client/src/pages/LeadsManagement.tsx`
- `client/src/pages/customers.tsx`
- `client/src/pages/CustomerDetail.tsx`
- `client/src/pages/enhanced-crm.tsx`
- `client/src/pages/Contacts.tsx`
- `client/src/components/leads/LeadsImport.tsx`
- (+ 5 more)

**Backend (44 files):**
- `server/routes-business-records.ts`
- `server/routes-customers.ts`
- `server/storage.ts`
- `supabase/functions/business-records/index.ts`
- `supabase/functions/customers/index.ts`
- (+ 39 more)

## The Solution: Companies Architecture

### Core Principle
**One Company = One Source of Truth**

### Database Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPANIES TABLE                          │
│                  (Single Source of Truth)                   │
│                                                             │
│  - id (PK)                                                  │
│  - tenant_id                                                │
│  - business_name                                            │
│  - customer_number                                          │
│  - phone, email, website                                    │
│  - billing_address, shipping_address                        │
│  - industry, business_type                                  │
│  - customer_since                                           │
│  - created_at, updated_at                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─── company_contacts (Many contacts per company)
             │    - id, company_id (FK)
             │    - first_name, last_name, email, phone
             │    - title, is_primary
             │
             ├─── leads (Sales pipeline - before customer)
             │    - id, company_id (FK), contact_id (FK)
             │    - status: new, contacted, qualified, proposal
             │    - estimated_value, probability, close_date
             │    - owner_id, assigned_sales_rep
             │
             ├─── customers (Active customer relationships)
             │    - id, company_id (FK), contact_id (FK)
             │    - converted_from_lead_id (FK)
             │    - customer_since, preferred_technician
             │    - current_balance, last_service_date
             │
             ├─── deals / opportunities (Sales opportunities)
             │    - id, company_id (FK)
             │    - deal_value, stage, probability
             │
             ├─── equipment (Installed equipment)
             │    - id, company_id (FK)
             │    - serial_number, model, location
             │
             ├─── service_tickets (Support history)
             │    - id, company_id (FK), customer_id (FK)
             │    - issue_description, status
             │
             ├─── invoices (Billing)
             │    - id, company_id (FK), customer_id (FK)
             │    - amount, due_date, status
             │
             └─── quotes (Sales quotes)
                  - id, company_id (FK), lead_id (FK)
                  - quote_amount, valid_until
```

### Key Benefits

1. **Single Source of Truth**
   - Company data exists in ONE place
   - All changes automatically reflected everywhere
   - No sync issues or data conflicts

2. **Complete History**
   - Track entire journey: Lead → Customer → Former Customer
   - All activities tied to company, not scattered across records
   - Never lose historical data

3. **Multiple Contacts**
   - One company can have many contacts
   - Sales can work with multiple decision-makers
   - Billing contact separate from primary contact

4. **Proper Relationships**
   - Converting lead to customer maintains company_id
   - All equipment, tickets, invoices link to same company
   - Easy to query "show me everything for this company"

5. **Industry Standard**
   - Salesforce uses Accounts (companies) → Contacts → Opportunities
   - HubSpot uses Companies → Contacts → Deals
   - Microsoft Dynamics uses Accounts → Contacts

## Migration Strategy

### Phase 1: Data Migration ✓ (Already in NEON backup)

Your `database-exports/complete-with-schema.sql` already has:
- ✅ 181 tables including `companies`
- ✅ `company_contacts` table
- ✅ `leads` table (with company_id FK)
- ✅ `customers` table (with company_id FK)
- ✅ All other tables properly linked

**Action:** Deploy the schema (we're doing this now!)

### Phase 2: Deprecate business_records

1. **Mark as Deprecated**
   - Add comments to business_records table
   - Document migration path
   - Keep temporarily for rollback safety

2. **Migrate Existing Data** (if any business_records data exists)
   ```sql
   -- Move business_records to companies
   INSERT INTO companies (tenant_id, business_name, phone, email, ...)
   SELECT DISTINCT tenant_id, company_name, phone, primary_contact_email, ...
   FROM business_records
   ON CONFLICT (customer_number) DO UPDATE ...;
   
   -- Create company_contacts from business_records
   INSERT INTO company_contacts (company_id, first_name, last_name, email, ...)
   SELECT c.id, br.primary_contact_name, br.primary_contact_email, ...
   FROM business_records br
   JOIN companies c ON c.business_name = br.company_name;
   
   -- Create leads from business_records where record_type='lead'
   INSERT INTO leads (company_id, contact_id, status, estimated_value, ...)
   SELECT c.id, cc.id, br.status, br.estimated_deal_value, ...
   FROM business_records br
   JOIN companies c ON c.business_name = br.company_name
   LEFT JOIN company_contacts cc ON cc.company_id = c.id AND cc.is_primary = true
   WHERE br.record_type = 'lead';
   
   -- Create customers from business_records where record_type='customer'
   INSERT INTO customers (company_id, contact_id, customer_since, ...)
   SELECT c.id, cc.id, br.customer_since, ...
   FROM business_records br
   JOIN companies c ON c.business_name = br.company_name
   LEFT JOIN company_contacts cc ON cc.company_id = c.id AND cc.is_primary = true
   WHERE br.record_type = 'customer';
   ```

### Phase 3: Update Edge Functions

**Update Priority:**
1. ✅ `supabase/functions/business-records/index.ts` → Redirect to companies
2. ✅ `supabase/functions/customers/index.ts` → Use customers + companies
3. ✅ `supabase/functions/deals/index.ts` → Use companies
4. ✅ `supabase/functions/quotes/index.ts` → Use companies
5. ✅ `supabase/functions/service-tickets/index.ts` → Use companies
6. ✅ `supabase/functions/equipment/index.ts` → Use companies
7. ✅ `supabase/functions/invoices/index.ts` → Use companies

**Pattern for Edge Functions:**
```typescript
// OLD (business_records)
const { data } = await supabase
  .from('business_records')
  .select('*')
  .eq('tenant_id', tenantId);

// NEW (companies-based)
const { data } = await supabase
  .from('companies')
  .select(`
    *,
    company_contacts!inner(*),
    leads(*),
    customers(*)
  `)
  .eq('tenant_id', tenantId);
```

### Phase 4: Update Frontend Pages

**Page Updates:**
1. **LeadsManagement.tsx**
   - Query: `companies` with `leads` join
   - Create: Insert into `companies` + `company_contacts` + `leads`
   - Convert: Update `leads.status` + insert into `customers`

2. **customers.tsx**
   - Query: `companies` with `customers` join
   - Display: Show company info + customer relationship details

3. **CustomerDetail.tsx / Company Profile**
   - Single source: Load from `companies`
   - Show related: contacts, leads, customers, equipment, tickets

4. **Contacts.tsx**
   - Query: `company_contacts` with `companies` join
   - Link to parent company

**Frontend Query Pattern:**
```typescript
// OLD
const { data: leads } = await supabase
  .from('business_records')
  .select('*')
  .eq('record_type', 'lead');

// NEW
const { data: companies } = await supabase
  .from('companies')
  .select(`
    id,
    business_name,
    customer_number,
    phone,
    email,
    company_contacts!inner(
      id,
      first_name,
      last_name,
      email,
      phone,
      is_primary
    ),
    leads!inner(
      id,
      status,
      estimated_value,
      probability,
      owner_id,
      created_at
    )
  `)
  .eq('tenant_id', tenantId);
```

### Phase 5: Server Routes Update

**Update server routes:**
- `server/routes-business-records.ts` → Deprecate or redirect
- `server/routes-companies.ts` → Make primary
- `server/routes-customers.ts` → Update to use companies
- `server/storage.ts` → Update all queries

## Implementation Checklist

### Week 1: Foundation
- [x] Audit current business_records usage
- [x] Document architecture design
- [ ] Deploy schema to Supabase (in progress)
- [ ] Create data migration SQL scripts
- [ ] Test migration on sample data

### Week 2: Backend
- [ ] Update edge functions (7 functions)
- [ ] Update server routes (5 main routes)
- [ ] Update storage.ts queries
- [ ] Add deprecation warnings to business_records endpoints

### Week 3: Frontend
- [ ] Update LeadsManagement page
- [ ] Update customers page
- [ ] Update CustomerDetail/Company profile
- [ ] Update Contacts page
- [ ] Update import wizards

### Week 4: Testing & Deployment
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Performance testing
- [ ] Deploy to production
- [ ] Monitor for issues

## Rollback Plan

If issues arise:
1. Keep `business_records` table for 30 days
2. Keep old edge function versions
3. Feature flag for new vs old architecture
4. Database backup before each phase

## Success Metrics

- ✅ All 181 tables deployed to Supabase
- ✅ Zero data duplication (one company = one record)
- ✅ All edge functions using companies architecture
- ✅ All frontend pages updated
- ✅ No broken relationships
- ✅ Improved query performance (fewer JOINs needed)

## API Changes for Frontend

### Before (business_records)
```typescript
// Create a lead
POST /api/business-records
{
  "record_type": "lead",
  "company_name": "Acme Corp",
  "primary_contact_name": "John Doe",
  "primary_contact_email": "john@acme.com"
}

// Convert to customer
PATCH /api/business-records/:id
{
  "record_type": "customer",
  "status": "active"
}
```

### After (companies)
```typescript
// Create a company + lead
POST /api/companies
{
  "business_name": "Acme Corp",
  "phone": "555-0100",
  "contacts": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@acme.com",
      "is_primary": true
    }
  ],
  "create_lead": true,
  "lead": {
    "status": "new",
    "estimated_value": 50000,
    "source": "website"
  }
}

// Convert lead to customer
POST /api/customers
{
  "company_id": "uuid",
  "contact_id": "uuid",
  "converted_from_lead_id": "uuid",
  "customer_since": "2026-01-13"
}
// This DOES NOT duplicate company data, just creates customer relationship
```

## Next Steps

1. **Immediate:** Finish deploying schema to Supabase (fix line ending issues)
2. **Today:** Create data migration scripts
3. **Tomorrow:** Start updating edge functions
4. **This Week:** Update frontend pages
5. **Next Week:** Deploy to production

## Questions & Decisions

- ✅ **Decision:** Use companies as single source of truth
- ✅ **Decision:** Keep leads and customers as separate relationship tables
- ⏳ **Question:** Keep business_records for how long? (Recommend: 30 days)
- ⏳ **Question:** Gradual rollout or big-bang migration? (Recommend: Gradual with feature flags)

---

**Remember:** This is the RIGHT architecture. Your old NEON schema already had this working. We're going back to what worked!

