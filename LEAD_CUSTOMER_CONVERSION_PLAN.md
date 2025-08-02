# Lead-to-Customer Conversion Architecture Fix

## Current Problem

The existing system has duplicate data structures that create data integrity risks:

- **Separate Tables**: `leads` and `customers` tables with nearly identical structures
- **Data Duplication**: Converting leads creates NEW records instead of status changes
- **Broken Relationships**: Activities, history, and relationships don't transfer seamlessly
- **Complex Maintenance**: Two separate codepaths for essentially the same business entity

## Proposed Solution: Unified Business Records

### 1. Single Table Architecture with Complete Lifecycle Management
```sql
-- Replace both leads and customers tables with:
business_records {
  id: primary key
  tenant_id: foreign key
  company_id: foreign key (to companies table)
  contact_id: foreign key (to company_contacts table)
  
  -- Status Management - Complete Business Relationship Lifecycle
  record_type: varchar -- 'lead', 'customer', 'former_customer'
  status: varchar 
    -- Lead statuses: new, contacted, qualified, proposal, negotiation, closed_won, closed_lost
    -- Customer statuses: active, inactive, on_hold, churned, competitor_switch, non_payment, expired
  
  -- Common Fields (used throughout entire lifecycle)
  lead_source: varchar
  estimated_amount: decimal
  priority: varchar
  owner_id: foreign key
  notes: text
  
  -- Customer-Only Fields (populated when recordType = 'customer')
  customer_number: varchar -- Generated on conversion
  customer_since: timestamp -- Date of conversion
  customer_until: timestamp -- Date when customer relationship ended
  churn_reason: varchar -- competitor_switch, pricing, service_issues, business_closure, non_payment
  
  -- Service & Support Information
  preferred_technician: varchar
  last_service_date: timestamp
  current_balance: decimal
  last_meter_reading_date: timestamp
  
  -- Tracking & Audit
  converted_by: varchar -- Who converted from lead to customer
  deactivated_by: varchar -- Who deactivated the customer
  
  created_at: timestamp
  updated_at: timestamp
}
```

### 2. Complete Business Lifecycle Workflows

#### Lead to Customer Conversion
```javascript
// Convert lead to customer - NO data duplication
async convertLeadToCustomer(leadId, tenantId, userId) {
  const customerNumber = await generateCustomerNumber(tenantId);
  
  await db.update(businessRecords)
    .set({
      recordType: 'customer',
      status: 'active',
      customerNumber: customerNumber,
      customerSince: new Date(),
      convertedBy: userId,
      probability: 100
    })
    .where(eq(businessRecords.id, leadId));
    
  // All activities, relationships, and history automatically preserved!
  return await getBusinessRecord(leadId, tenantId);
}
```

#### Customer Deactivation Workflows
```javascript
// Customer goes to competitor
async deactivateCustomer(customerId, tenantId, userId, reason) {
  await db.update(businessRecords)
    .set({
      recordType: 'former_customer',
      status: 'competitor_switch',
      customerUntil: new Date(),
      churnReason: reason,
      deactivatedBy: userId
    })
    .where(eq(businessRecords.id, customerId));
  
  // Create activity record for audit trail
  await db.insert(businessRecordActivities).values({
    businessRecordId: customerId,
    activityType: 'churn_prevention',
    subject: `Customer Deactivated - ${reason}`,
    description: `Customer relationship ended due to: ${reason}`,
    createdBy: userId
  });
}

// Customer stops paying
async markCustomerNonPayment(customerId, tenantId, userId) {
  await db.update(businessRecords)
    .set({
      status: 'non_payment',
      deactivatedBy: userId,
      updatedAt: new Date()
    })
    .where(eq(businessRecords.id, customerId));
}

// Customer business closure
async markCustomerExpired(customerId, tenantId, userId) {
  await db.update(businessRecords)
    .set({
      recordType: 'former_customer',
      status: 'expired',
      customerUntil: new Date(),
      churnReason: 'business_closure',
      deactivatedBy: userId
    })
    .where(eq(businessRecords.id, customerId));
}
```

### 3. Benefits

1. **Zero Data Loss**: All activities, notes, and relationships are preserved
2. **Single Source of Truth**: One record for the entire business relationship lifecycle
3. **Simplified Code**: One set of APIs instead of duplicate lead/customer logic
4. **Seamless Transition**: Customer-specific features (meter reads, contracts, invoices) activate automatically when `record_type = 'customer'`
5. **Easier Maintenance**: Single schema to maintain and evolve

### 4. Frontend Behavior

- **Lead View**: Shows pipeline management, qualification tools, conversion buttons
- **Customer View**: Shows service history, meter readings, billing info, contracts
- **Unified Activities**: Same activity timeline works for both lead and customer phases
- **Smart UI**: Customer-only features are hidden/disabled when `record_type = 'lead'`

### 5. Migration Strategy

1. Create new `business_records` table
2. Migrate all leads to `business_records` with `record_type = 'lead'`
3. Migrate all customers to `business_records` with `record_type = 'customer'`
4. Update all foreign key references to point to `business_records.id`
5. Create views for backward compatibility during transition
6. Update APIs to use unified approach
7. Remove old tables after verification

### 6. Database Relations

```sql
-- All customer-specific tables reference the same ID
meter_readings.business_record_id -> business_records.id
contracts.business_record_id -> business_records.id  
service_tickets.business_record_id -> business_records.id
invoices.business_record_id -> business_records.id

-- Activities table works for entire lifecycle
business_record_activities.business_record_id -> business_records.id
```

## Implementation Priority

This is a **critical architectural fix** that should be implemented before adding more customer-related features. The current duplicate structure will only create more data integrity issues as the system grows.

Would you like me to implement this unified architecture?