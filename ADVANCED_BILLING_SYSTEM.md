# Advanced Billing & Meter Processing Engine

## Overview
The Advanced Billing & Meter Processing Engine automates complex billing calculations, detects meter anomalies, manages billing disputes, and provides flexible usage-based pricing rules for copier dealer management. This system extends the basic meter billing infrastructure with intelligent automation, anomaly detection, and dispute resolution workflows.

## System Architecture

### Database Schema
**6 tables with 30 composite indexes for high-performance billing operations:**

1. **billing_rules** - Flexible usage-based billing rule engine
   - Supports: tiered rates, volume discounts, time-based pricing, overage penalties, flat rates, custom formulas
   - Rule priority system for conflict resolution
   - Customer/contract/equipment-specific rules
   - Date-based activation and expiration

2. **meter_anomalies** - Automated meter reading anomaly detection
   - Detects: spikes, negative readings, stagnant meters, out-of-range values, inconsistent patterns
   - Severity classification (low, medium, high, critical)
   - Review and resolution workflow
   - Impact tracking on billing and invoices

3. **billing_disputes** - Comprehensive dispute management system
   - Dispute types: meter reading, pricing, service quality, billing error, unauthorized charge
   - Full lifecycle tracking (open → under review → resolved/escalated → closed)
   - Manager approval workflow for credits
   - Communication log and customer satisfaction tracking

4. **invoice_generation_logs** - Invoice generation audit trail
   - Tracks successful, failed, and partial generations
   - Batch processing support
   - Error logging and retry management
   - Performance metrics (processing time, line items, totals)

5. **billing_schedules** - Recurring billing automation
   - Supports: daily, weekly, monthly, quarterly, annual cycles
   - Customer/contract-specific schedules
   - Auto-send and late fee automation
   - Next run date calculation

6. **credit_memos** - Credit memo issuance and tracking
   - Reasons: billing error, dispute resolution, goodwill, service failure
   - Approval workflow (pending → approved → issued)
   - Invoice application tracking
   - Void capability with reason logging

### Storage Layer
**55 storage methods** across IStorage interface:

#### Billing Rules (9 methods)
- Complete CRUD operations with filtering
- `getActiveBillingRules()` - Get applicable rules for billing calculation
- `applyBillingRule()` - Apply rule to usage data and calculate charges
- Customer and contract-specific rule retrieval

#### Meter Anomalies (9 methods)
- Anomaly detection, review, and resolution workflows
- `detectAnomalies()` - Automated anomaly detection for meter readings
- Filtering by equipment, type, severity, resolution status
- Impact tracking on billing invoices

#### Billing Disputes (11 methods)
- Full dispute lifecycle management
- Assignment, acknowledgment, resolution, and escalation workflows
- Customer and invoice-specific dispute retrieval
- Manager approval tracking

#### Invoice Generation Logs (7 methods)
- Generation audit trail with batch support
- Failed generation tracking for retry
- Statistics and performance metrics
- Batch processing support

#### Billing Schedules (8 methods)
- Schedule creation and management
- `getDueSchedules()` - Get schedules ready for execution
- Next run date calculation
- Active/inactive filtering

#### Credit Memos (10 methods)
- Credit memo lifecycle (pending → approved → issued → applied)
- Approval and issuance workflows
- Invoice application tracking
- Void capability for corrections

### API Routes
**48 RESTful endpoints** organized by category:

#### Billing Rules (`/api/billing/rules`)
```
GET    /api/billing/rules                          List all billing rules with filtering
GET    /api/billing/rules/:id                      Get specific billing rule
POST   /api/billing/rules                          Create new billing rule (Admin/Manager)
PUT    /api/billing/rules/:id                      Update billing rule (Admin/Manager)
DELETE /api/billing/rules/:id                      Delete billing rule (Admin/Manager)
GET    /api/billing/rules/customer/:customerId     Get rules for customer
GET    /api/billing/rules/contract/:contractId     Get rules for contract
```

#### Meter Anomalies (`/api/billing/anomalies`)
```
GET    /api/billing/anomalies                      List all anomalies with filtering
GET    /api/billing/anomalies/unresolved           Get unresolved anomalies
GET    /api/billing/anomalies/:id                  Get specific anomaly
POST   /api/billing/anomalies                      Create anomaly (automated)
POST   /api/billing/anomalies/:id/review           Review anomaly
POST   /api/billing/anomalies/:id/resolve          Resolve anomaly
GET    /api/billing/anomalies/equipment/:equipmentId Get anomalies for equipment
```

#### Billing Disputes (`/api/billing/disputes`)
```
GET    /api/billing/disputes                       List all disputes with filtering
GET    /api/billing/disputes/open                  Get open disputes
GET    /api/billing/disputes/:id                   Get specific dispute
POST   /api/billing/disputes                       Create new dispute
PUT    /api/billing/disputes/:id                   Update dispute
POST   /api/billing/disputes/:id/assign            Assign dispute (Admin/Manager)
POST   /api/billing/disputes/:id/acknowledge       Acknowledge dispute
POST   /api/billing/disputes/:id/resolve           Resolve dispute (Admin/Manager)
POST   /api/billing/disputes/:id/escalate          Escalate dispute (Admin/Manager)
GET    /api/billing/disputes/customer/:customerId  Get disputes for customer
GET    /api/billing/disputes/invoice/:invoiceId    Get disputes for invoice
```

#### Invoice Generation (`/api/billing/generation`)
```
GET    /api/billing/generation/logs                List invoice generation logs
GET    /api/billing/generation/logs/:id            Get specific log
POST   /api/billing/generation/generate            Generate invoice (Admin/Manager)
POST   /api/billing/generation/batch               Generate batch (Admin/Manager)
GET    /api/billing/generation/failed              Get failed generations
GET    /api/billing/generation/stats               Get generation statistics
```

#### Billing Schedules (`/api/billing/schedules`)
```
GET    /api/billing/schedules                      List all billing schedules
GET    /api/billing/schedules/active               Get active schedules
GET    /api/billing/schedules/due                  Get schedules due for execution
GET    /api/billing/schedules/:id                  Get specific schedule
POST   /api/billing/schedules                      Create schedule (Admin/Manager)
PUT    /api/billing/schedules/:id                  Update schedule (Admin/Manager)
DELETE /api/billing/schedules/:id                  Delete schedule (Admin/Manager)
```

#### Credit Memos (`/api/billing/credit-memos`)
```
GET    /api/billing/credit-memos                   List all credit memos
GET    /api/billing/credit-memos/pending           Get pending credit memos
GET    /api/billing/credit-memos/:id               Get specific credit memo
POST   /api/billing/credit-memos                   Create credit memo (Admin/Manager)
PUT    /api/billing/credit-memos/:id               Update credit memo
POST   /api/billing/credit-memos/:id/approve       Approve (Admin/Manager)
POST   /api/billing/credit-memos/:id/issue         Issue credit memo
POST   /api/billing/credit-memos/:id/apply         Apply to invoice (Admin/Manager)
POST   /api/billing/credit-memos/:id/void          Void credit memo (Admin only)
GET    /api/billing/credit-memos/customer/:customerId Get memos for customer
```

## Key Features

### 1. Usage-Based Billing Rule Engine
**Flexible pricing models:**
- **Tiered Rates**: Volume-based pricing tiers (0-1000: $0.01, 1001-5000: $0.008, etc.)
- **Volume Discounts**: Threshold-based discounts (10K pages: 5%, 25K: 10%, 50K: 15%)
- **Overage Pricing**: Premium rates for usage above contract base volumes
- **Flat Rate**: Simple monthly charges regardless of usage
- **Time-Based Pricing**: Peak/off-peak hour pricing multipliers
- **Custom Formulas**: JavaScript formula evaluation for complex calculations

**Rule Priority System:**
- Rules sorted by priority (1 = highest)
- Most specific rules take precedence (equipment > contract > customer > global)
- Date-based activation and expiration

### 2. Automated Meter Anomaly Detection
**Anomaly Types:**
- **Spike**: Sudden increase >40% from expected reading
- **Negative Reading**: Meter value decreased (equipment swap/meter replacement)
- **Stagnant**: No usage detected for 30+ days
- **Sudden Drop**: Unexpected decrease in usage pattern
- **Out of Range**: Deviation outside normal usage patterns
- **Inconsistent Pattern**: Usage doesn't match historical behavior

**Detection Algorithm:**
- Compare current reading to previous reading
- Calculate expected reading based on historical average
- Compute deviation percentage
- Classify severity (low < 10%, medium 10-25%, high 25-50%, critical >50%)
- Auto-notify relevant users based on severity

**Resolution Workflow:**
1. Auto-detect anomaly → Create anomaly record
2. Notify billing team and manager
3. Review → Mark as reviewed with notes
4. Resolve → Accept, correct reading, contact customer, or replace meter
5. Track impact on billing and invoices

### 3. Billing Dispute Management
**Dispute Lifecycle:**
1. **Filed**: Customer submits dispute with complaint
2. **Assigned**: Dispute assigned to billing admin/manager
3. **Under Review**: Research and investigation phase
4. **Acknowledged**: Dispute acknowledged with customer communication
5. **Resolved**: Credit issued, invoice corrected, or no action
6. **Escalated**: Escalate to senior management if needed
7. **Closed**: Dispute finalized with customer satisfaction tracking

**Resolution Options:**
- **Credit Issued**: Full or partial credit memo
- **Invoice Corrected**: Generate corrected invoice
- **No Action**: Dispute determined invalid
- **Partial Credit**: Compromise settlement
- **Waived**: Goodwill gesture

**Manager Approval:**
- Credits > $100 require manager approval
- High-severity disputes auto-escalate
- Approval tracking with notes and timestamps

### 4. Automated Invoice Generation
**Generation Types:**
- **Scheduled**: Automated monthly/quarterly/annual billing
- **Manual**: Ad-hoc invoice generation by admin
- **Triggered**: Event-based generation (contract end, meter submission)
- **Batch**: Bulk generation for multiple customers

**Generation Process:**
1. Identify customers due for billing (based on schedule)
2. Retrieve meter readings for billing period
3. Apply billing rules in priority order
4. Calculate line items (base charges, overages, discounts)
5. Compute tax and totals
6. Create invoice and log generation
7. Send to customer (if auto-send enabled)

**Error Handling:**
- Log all failures with detailed error messages
- Retry failed generations automatically
- Warning generation for anomalies
- Partial success with warnings

### 5. Recurring Billing Schedules
**Schedule Types:**
- **Daily**: Test accounts, daily service charges
- **Weekly**: Trial periods, short-term contracts
- **Monthly**: Standard monthly billing (most common)
- **Quarterly**: Enterprise accounts with negotiated terms
- **Annual**: Long-term contracts, prepaid plans

**Automation Features:**
- Auto-send invoices on generation
- Auto-apply late fees if enabled
- Pre-notification X days before billing
- Next run date auto-calculation
- Active/inactive status management

### 6. Credit Memo System
**Credit Reasons:**
- **Billing Error**: Incorrect pricing, duplicate charges
- **Dispute Resolution**: Settlement of customer disputes
- **Goodwill**: Customer satisfaction gestures
- **Service Failure**: SLA violations, equipment downtime

**Approval Workflow:**
1. Create credit memo (pending status)
2. Manager review and approval
3. Issue credit memo
4. Apply to invoice (reduce balance)
5. Customer notification

**Controls:**
- Manager approval required
- Void capability for corrections
- Expiration dates for unused credits
- Application tracking (which invoice credited)

## Integration Points

### Existing Meter Billing System
- Extends existing `meterReadings` table
- Integrates with `invoices` and `invoiceLineItems` tables
- Uses existing `contracts` table for billing terms
- Leverages `equipment` and `businessRecords` relationships

### Service Dispatch Integration
- Link anomalies to service tickets for technician investigation
- Track meter validation during service calls
- Update meter readings from technician mobile app

### Contract Management Integration
- Billing rules tied to contract terms
- Auto-create rules on contract creation
- Rule expiration on contract end

## Security & Access Control

### Authentication
- All endpoints require authenticated session
- 401 Unauthorized for unauthenticated requests
- Tenant ID validation on all requests

### Authorization (RBAC)
- **Admin**: Full access to all billing features
- **Manager**: Approve disputes, credit memos; create/edit rules
- **Billing Admin**: Process disputes, review anomalies, generate invoices
- **Customer Service**: Create disputes, review anomalies (read-only)
- **Customer**: View own disputes and credit memos (read-only)

### Data Privacy
- Multi-tenant isolation (tenantId on all tables)
- Sensitive financial data access logged
- Credit memo amounts redacted for non-privileged users

## Performance Optimization

### Database Indexes
- 30 composite indexes across 6 tables
- All queries filter by tenantId first
- Optimized for common query patterns (status, date ranges, customer lookups)

### Caching Strategy
- Billing rules cached for 10 minutes (moderate change frequency)
- Active schedules cached for 5 minutes
- Anomalies and disputes not cached (real-time updates)

### Batch Processing
- Invoice generation supports batch mode
- Batch ID for tracking related generations
- Parallel processing for multiple customers
- Error isolation (one failure doesn't block others)

## Seed Data
Comprehensive seed data includes:
- 5 billing rules (tiered, volume discount, overage, flat rate, inactive)
- 4 meter anomalies (spike, negative reading, stagnant, out of range)
- 4 billing disputes (open, under review, resolved, escalated)
- 4 invoice generation logs (success, failed, partial, manual)
- 4 billing schedules (monthly, quarterly, weekly, inactive)
- 4 credit memos (issued, approved, pending, voided)

## Future Enhancements

### Phase 2 Features
1. **Machine Learning Anomaly Detection**: Train models on historical patterns for smarter detection
2. **Predictive Billing**: Forecast usage and estimated charges
3. **Dynamic Pricing**: Real-time rate adjustments based on market conditions
4. **Customer Self-Service**: Portal for viewing bills, disputing charges, applying credits
5. **Payment Gateway Integration**: Auto-apply payments, track payment status
6. **Multi-Currency Support**: International billing and currency conversion

### Advanced Analytics
1. **Revenue Attribution**: Track revenue by customer segment, product, sales rep
2. **Dispute Analytics**: Identify patterns in disputes to prevent future issues
3. **Anomaly Trends**: Dashboard showing anomaly frequency and resolution times
4. **Billing Accuracy**: Compare estimated vs actual charges, improve forecasting

### Automation Enhancements
1. **Auto-Resolution**: Automatically resolve low-severity disputes with predefined rules
2. **Smart Retries**: Intelligent retry logic for failed invoice generations
3. **Predictive Maintenance**: Detect equipment issues from meter patterns
4. **Customer Communications**: Automated emails for billing events

---

**Version**: 1.0  
**Last Updated**: November 1, 2025  
**Maintained By**: Printyx Platform Team
