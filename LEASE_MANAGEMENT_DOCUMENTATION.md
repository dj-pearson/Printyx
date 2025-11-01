# Lease Management System - Complete Documentation

## Overview
The Lease Management System is a comprehensive solution for managing equipment leases throughout their entire lifecycle, from creation through disposition. This represents **40-60% of MPS (Managed Print Services) revenue** and is critical business infrastructure.

## Architecture

### Database Schema (4 Tables)

#### 1. `leases` Table
**Purpose:** Core lease records with complete financial and contractual information

**Key Fields:**
- **Identification:** `lease_number`, `lease_name`, `customer_id`
- **Financial:** `total_amount`, `monthly_payment`, `term`, `residual_value`, `buyout_amount`
- **Dates:** `start_date`, `end_date`, `first_payment_date`, `last_payment_date`
- **Type & Status:** `lease_type` (FMV, $1 Buyout, 10% Buyout, TRAC, Operating, Capital)
- **Analytics:** `payments_completed`, `total_paid`, `payment_health`
- **Configuration:** `auto_pay_enabled`, `renewal_option`, `early_termination_allowed`

**Indexes:**
- `(tenant_id, lease_number)` - Unique constraint
- `(tenant_id, customer_id)` - Customer lookups
- `(tenant_id, status)` - Status filtering
- `(end_date)` - Expiration tracking

#### 2. `lease_payments` Table
**Purpose:** Complete payment schedule and transaction history

**Key Fields:**
- **Schedule:** `payment_number`, `scheduled_date`, `scheduled_amount`
- **Status:** `status` (scheduled, completed, failed, late, waived)
- **Transaction:** `paid_date`, `paid_amount`, `transaction_id`, `payment_method`
- **Tracking:** `late_fee_charged`, `grace_period_applied`

**Indexes:**
- `(tenant_id, lease_id, payment_number)` - Unique payment identification
- `(tenant_id, status, scheduled_date)` - Upcoming/overdue queries
- `(scheduled_date)` - Date-based filtering

#### 3. `lease_renewals` Table
**Purpose:** Track renewal offers, customer responses, and renewal outcomes

**Key Fields:**
- **Offer:** `renewal_offered`, `renewal_offer_date`, `renewal_deadline`
- **Terms:** `renewal_term`, `renewal_monthly_payment`, `renewal_changes`
- **Response:** `customer_response` (pending, accepted, declined, countered)
- **Outcome:** `new_lease_id`, `renewal_notes`

**Indexes:**
- `(tenant_id, lease_id)` - One renewal per lease
- `(tenant_id, renewal_deadline)` - Deadline tracking

#### 4. `lease_dispositions` Table
**Purpose:** End-of-lease actions and equipment disposition

**Key Fields:**
- **Action:** `action` (return, purchase, upgrade, renew)
- **Status:** `final_status`, `completion_date`
- **Return:** `equipment_picked_up`, `pickup_date`, `return_condition`
- **Purchase:** `purchase_price`, `invoice_generated`
- **Upgrade:** `upgrade_quote_id`, `new_lease_id`

**Indexes:**
- `(tenant_id, lease_id)` - One disposition per lease
- `(action_date)` - Timeline tracking

### Storage Layer (28+ Methods)

**File:** `server/storage.ts`

#### Lease Operations
```typescript
getLeases(tenantId: string): Promise<Lease[]>
getLease(id: string, tenantId: string): Promise<Lease | undefined>
getLeasesByCustomer(customerId: string, tenantId: string): Promise<Lease[]>
getLeasesByStatus(status: string, tenantId: string): Promise<Lease[]>
createLease(lease: InsertLease): Promise<Lease>
updateLease(id: string, tenantId: string, lease: Partial<Lease>): Promise<Lease>
deleteLease(id: string, tenantId: string): Promise<void>
```

#### Payment Operations
```typescript
getLeasePayments(leaseId: string, tenantId: string): Promise<LeasePayment[]>
getLeasePayment(id: string, tenantId: string): Promise<LeasePayment | undefined>
getUpcomingPayments(tenantId: string, daysAhead: number): Promise<LeasePayment[]>
getPastDuePayments(tenantId: string): Promise<LeasePayment[]>
createLeasePayment(payment: InsertLeasePayment): Promise<LeasePayment>
updateLeasePayment(id: string, tenantId: string, payment: Partial<LeasePayment>): Promise<LeasePayment>
deleteLeasePayment(id: string, tenantId: string): Promise<void>
```

#### Renewal Operations
```typescript
getLeaseRenewals(tenantId: string): Promise<LeaseRenewal[]>
getLeaseRenewal(id: string, tenantId: string): Promise<LeaseRenewal | undefined>
getLeaseRenewalByLease(leaseId: string, tenantId: string): Promise<LeaseRenewal>
getLeasesNeedingRenewalAction(tenantId: string, daysAhead: number): Promise<LeaseRenewal[]>
createLeaseRenewal(renewal: InsertLeaseRenewal): Promise<LeaseRenewal>
updateLeaseRenewal(id: string, tenantId: string, renewal: Partial<LeaseRenewal>): Promise<LeaseRenewal>
deleteLeaseRenewal(id: string, tenantId: string): Promise<void>
```

#### Disposition Operations
```typescript
getLeaseDispositions(tenantId: string): Promise<LeaseDisposition[]>
getLeaseDisposition(id: string, tenantId: string): Promise<LeaseDisposition | undefined>
getLeaseDispositionByLease(leaseId: string, tenantId: string): Promise<LeaseDisposition>
createLeaseDisposition(disposition: InsertLeaseDisposition): Promise<LeaseDisposition>
updateLeaseDisposition(id: string, tenantId: string, disposition: Partial<LeaseDisposition>): Promise<LeaseDisposition>
deleteLeaseDisposition(id: string, tenantId: string): Promise<void>
```

### API Layer (20+ Endpoints)

**File:** `server/routes/lease-routes.ts`

#### CRUD Endpoints
```
GET    /api/leases                        - Get all leases for tenant
GET    /api/leases/:id                    - Get single lease by ID
GET    /api/customers/:customerId/leases  - Get leases by customer
GET    /api/leases/status/:status         - Get leases by status
POST   /api/leases                        - Create new lease
PATCH  /api/leases/:id                    - Update lease
DELETE /api/leases/:id                    - Delete lease
```

#### Payment Endpoints
```
GET    /api/leases/:leaseId/payments      - Get payments for lease
GET    /api/lease-payments/upcoming       - Get upcoming payments (?days=30)
GET    /api/lease-payments/past-due       - Get overdue payments
POST   /api/lease-payments                - Create payment record
PATCH  /api/lease-payments/:id            - Update payment
DELETE /api/lease-payments/:id            - Delete payment
POST   /api/lease-payments/:id/process    - Process payment
```

#### Renewal Endpoints
```
GET    /api/lease-renewals                - Get all renewals
GET    /api/leases/:leaseId/renewal       - Get renewal by lease
GET    /api/lease-renewals/action-needed  - Get renewals needing action
POST   /api/lease-renewals                - Create renewal record
PATCH  /api/lease-renewals/:id            - Update renewal
DELETE /api/lease-renewals/:id            - Delete renewal
POST   /api/leases/:id/initiate-renewal   - Initiate renewal process
```

#### Disposition Endpoints
```
GET    /api/lease-dispositions            - Get all dispositions
GET    /api/leases/:leaseId/disposition   - Get disposition by lease
POST   /api/lease-dispositions            - Create disposition
PATCH  /api/lease-dispositions/:id        - Update disposition
DELETE /api/lease-dispositions/:id        - Delete disposition
POST   /api/leases/:id/complete-disposition - Complete disposition
```

#### Lifecycle Automation Endpoints
```
POST   /api/leases/:id/generate-payment-schedule - Auto-generate payment schedule
```

### UI Components

#### 1. Lease List Page (`/leases`)
**File:** `client/src/pages/Leases.tsx`

**Features:**
- **Dashboard Stats:** Active leases, pending renewals, monthly revenue, expired leases
- **Search & Filter:** Text search by name/number, filter by status (all, active, pending_renewal, expired)
- **Data Table:** Displays lease info with sortable columns
- **Quick Actions:** View lease details, create new lease

**Key Metrics Displayed:**
- Total active leases and their combined value
- Pending renewal count requiring action
- Monthly recurring revenue from active leases
- Expired leases needing disposition

#### 2. Lease Detail Page (`/leases/:id`)
**File:** `client/src/pages/LeaseDetail.tsx`

**Tabs:**
1. **Overview Tab:**
   - Lease details (type, payment health, dates)
   - Financial summary (residual value, buyout amount)
   - Auto-pay status
   - Notes and special terms

2. **Payments Tab:**
   - Complete payment schedule
   - Payment status badges (completed, scheduled, late)
   - Transaction IDs and dates
   - Process payment button for scheduled payments

3. **Documents Tab:**
   - Lease agreements
   - Signed contracts
   - Related documentation

**Actions:**
- Edit lease details
- Initiate renewal process
- Process individual payments

#### 3. Lease Form Page (`/leases/new` & `/leases/:id/edit`)
**File:** `client/src/pages/LeaseForm.tsx`

**Form Sections:**
1. **Basic Information:**
   - Lease name and number
   - Customer selection
   - Status selection

2. **Financial Terms:**
   - Lease type (FMV, $1 Buyout, 10% Buyout, TRAC, Operating, Capital)
   - Term in months
   - Monthly payment amount
   - Total lease value
   - Residual value
   - Buyout amount

3. **Dates:**
   - Start date
   - End date
   - First payment date
   - Last payment date

4. **Additional Details:**
   - Notes and special terms

**Validation:**
- All required fields enforced via Zod schema
- Customer must be selected
- Financial amounts must be valid
- Dates must be properly formatted

### Mock Data

**File:** `server/seed-lease-data.ts`

**Seeded Data:**
- **5 Leases** representing different lifecycle states:
  - 2 Active leases with ongoing payments
  - 1 Pending renewal lease (near end of term)
  - 2 Expired leases requiring disposition
  
- **98 Payment Records:**
  - Completed payments (past transactions)
  - Scheduled payments (upcoming obligations)
  - Mixed payment statuses for testing

- **1 Renewal Record:**
  - Pending customer response
  - Renewal terms defined
  - Deadline tracking

- **2 Disposition Records:**
  - Purchase disposition (completed)
  - Return disposition (equipment picked up)

## Usage Workflows

### Creating a New Lease

1. Navigate to `/leases`
2. Click "New Lease" button
3. Fill out form:
   - Enter lease name and number
   - Select customer
   - Choose lease type and set financial terms
   - Configure dates and payment schedule
   - Add notes if needed
4. Click "Create Lease"
5. System validates and creates lease record
6. Optionally generate payment schedule

### Processing Payments

1. Navigate to `/leases/:id`
2. Click "Payments" tab
3. Find scheduled payment
4. Click "Process" button
5. System:
   - Marks payment as completed
   - Records transaction
   - Updates lease totals
   - Updates payment health

### Initiating Lease Renewal

1. Navigate to `/leases/:id`
2. Click "Initiate Renewal" button
3. System:
   - Creates renewal record
   - Sets renewal deadline (30 days before end)
   - Updates lease status to "pending_renewal"
   - Sends notification (future feature)

### Managing Lease Disposition

1. Identify expired lease
2. Navigate to lease detail
3. Create disposition record via API
4. Specify action (return, purchase, upgrade, renew)
5. Track completion status
6. Update equipment records accordingly

## Integration Points

### Existing Systems

**Connected to:**
- **Business Records:** Lease creation requires valid customer ID
- **Proposals:** Accepted proposals can generate leases (future)
- **Contracts:** Leases link to service contracts
- **Billing:** Payment processing triggers invoice generation (future)
- **Equipment:** Leases track equipment IDs

**Future Integrations:**
- **E-Signature:** Electronic lease agreement signing
- **Payment Gateway:** Automated payment processing
- **Accounting:** GL posting and revenue recognition
- **Notifications:** Email/SMS for payment reminders and renewal notices

## Business Rules

### Payment Health Scoring
- **Good:** All payments on time, no missed payments
- **Warning:** 1-2 late payments, grace period used
- **Critical:** 3+ missed payments, significant arrears

### Renewal Timeline
- **180 days before end:** Initial renewal notification
- **90 days before end:** Second renewal reminder
- **30 days before end:** Final renewal deadline
- **Lease end date:** Automatic disposition if no renewal

### Lease Types Explained
- **FMV (Fair Market Value):** Customer pays FMV at end to purchase
- **$1 Buyout:** Ownership transfers for $1 at term end
- **10% Buyout:** Purchase for 10% of original value
- **TRAC (Terminal Rental Adjustment Clause):** Vehicle/equipment specific
- **Operating Lease:** Return equipment, no ownership transfer
- **Capital Lease:** Ownership effectively transfers during term

## Technical Specifications

### Security
- **Tenant Isolation:** All queries filtered by `tenant_id`
- **Authorization:** User must be authenticated to access endpoints
- **Audit Trail:** `created_by` and `updated_by` fields track changes

### Performance
- **Indexes:** Optimized for common query patterns (customer, status, dates)
- **Pagination:** Large lease lists support pagination (future)
- **Caching:** React Query caches API responses client-side

### Data Validation
- **Backend:** Zod schemas validate all API inputs
- **Frontend:** React Hook Form with Zod resolver validates forms
- **Database:** PostgreSQL constraints enforce data integrity

## Testing

### Manual Test Scenarios

1. **Create Lease:** Verify all fields save correctly
2. **Generate Payment Schedule:** Confirm correct number of payments
3. **Process Payment:** Check payment status updates and lease totals recalculate
4. **Initiate Renewal:** Verify renewal record created and lease status updated
5. **Filter by Status:** Confirm filtering works on list page
6. **Search:** Test search by lease name and number

### Data Integrity Checks
- Verify payment totals match lease `total_paid`
- Confirm payment count matches `payments_completed`
- Check renewal deadlines calculated correctly
- Validate disposition records link to correct leases

## Future Enhancements

### Phase 2 Features
- **Payment Gateway Integration:** Stripe/Authorize.net for automated processing
- **Email Notifications:** Automated payment reminders and renewal notices
- **Customer Portal:** Self-service lease viewing and payment
- **Reporting:** Lease revenue reports, expiration forecasts
- **Bulk Operations:** Mass payment processing, bulk renewals

### Phase 3 Features
- **E-Signature Integration:** DocuSign/HelloSign for lease agreements
- **Accounting Integration:** QuickBooks GL posting
- **Advanced Analytics:** Churn prediction, renewal probability
- **Mobile App:** Field technician lease lookup
- **API Webhooks:** Event notifications for external systems

## Support & Maintenance

### Common Issues

**Issue:** Lease total doesn't match payment schedule
**Solution:** Regenerate payment schedule or manually adjust final payment

**Issue:** Cannot initiate renewal for expired lease
**Solution:** Lease must be active or pending_renewal status

**Issue:** Payment processing fails
**Solution:** Check lease is active and payment is in scheduled status

### Database Maintenance

```sql
-- Find leases expiring in next 30 days
SELECT * FROM leases 
WHERE end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
AND status = 'active';

-- Get payment health summary
SELECT payment_health, COUNT(*) 
FROM leases 
WHERE status = 'active'
GROUP BY payment_health;

-- Find overdue payments
SELECT * FROM lease_payments
WHERE status = 'scheduled' 
AND scheduled_date < NOW();
```

## Conclusion

The Lease Management System provides comprehensive functionality for managing the entire lease lifecycle from creation through disposition. With robust backend infrastructure, intuitive UI, and extensive API coverage, it supports the critical business function of managing 40-60% of MPS revenue.

**Status:** ✅ Complete with full CRUD operations, lifecycle automation, and working UI
**Next Steps:** Customer portal access, automated payment processing, renewal alert system
