# Deal Desk Implementation Guide

## Overview

This guide covers the implementation and deployment of the **Deal Desk** approval workflow system for the Printyx Sales Hub. This feature provides enterprise-grade pricing governance through automated approval routing and discount management.

## What Was Implemented

### Backend (100% Complete)

#### 1. Database Schemas

- **`shared/deal-desk-schema.ts`** - Complete approval workflow data model
  - `approvalRules` - Configurable business rules for when approvals are required
  - `approvalRequests` - Full lifecycle tracking of approval requests
  - `approvalComments` - Comment threading for discussions
  - `discountAnalytics` - Margin protection insights and metrics
  - `approvalDelegations` - Temporary authority transfer (PTO, busy periods)

#### 2. Business Logic Services

- **`server/services/approval-workflow-service.ts`** - Intelligent routing engine
  - Rule evaluation with complex conditions (AND/OR logic)
  - Dynamic approval chain building based on thresholds
  - Multi-level approval support (sequential, parallel, conditional)
  - SLA breach detection and automatic escalation
  - Delegation resolution for temporary assignments
  - Notification hooks (ready for email/SMS/push integration)

#### 3. API Routes

- **`server/routes-deal-desk.ts`** - 20+ REST API endpoints
  - Rules CRUD operations
  - Approval request lifecycle management
  - Decision processing (approve/reject/request_changes)
  - Dashboard analytics and metrics
  - Comment management
  - Delegation management
  - SLA check background job

### Frontend (100% Complete)

#### 1. Main Dashboard

- **`client/src/pages/DealDeskDashboard.tsx`**
  - Real-time approval queue with auto-refresh
  - Dashboard stats cards (my queue, total pending, SLA breached, approval rate)
  - Tabbed views: My Queue / All Requests / Completed
  - Search and filter capabilities
  - Quick approve/reject actions
  - Visual approval chain progress
  - SLA countdown timers with alerts

#### 2. Detail View

- **`client/src/pages/ApprovalRequestDetail.tsx`**
  - Complete pricing breakdown
  - Business justification display
  - Visual approval chain
  - Comment threading
  - Decision form with validation
  - Related deal/quote context
  - Complete audit trail

#### 3. Configuration

- **`client/src/pages/ApprovalRulesConfiguration.tsx`**
  - Visual rule builder
  - Threshold configuration
  - Approval chain designer
  - SLA settings
  - Priority ordering
  - Active/inactive toggle

## Database Migration

### Step 1: Push Schema Changes

Run the Drizzle migration to create the new tables:

```bash
npm run db:push
```

This will create the following tables:

- `approval_rules`
- `approval_requests`
- `approval_comments`
- `discount_analytics`
- `approval_delegations`

### Step 2: Seed Initial Data (Optional)

Create default approval rules for common scenarios:

```sql
-- Example: Discounts >15% require Manager approval
INSERT INTO approval_rules (
  tenant_id,
  rule_name,
  description,
  rule_type,
  threshold_type,
  threshold_value,
  comparison_operator,
  approval_chain_type,
  approvers,
  sla_hours,
  escalation_enabled,
  priority,
  is_active
) VALUES (
  'your-tenant-id',
  'Discount >15% requires Manager approval',
  'Automatically route discount requests exceeding 15% to sales management',
  'discount',
  'discount_percentage',
  '15',
  '>',
  'sequential',
  '[{"level": 1, "roleName": "Sales Manager", "isRequired": true, "canDelegate": true}]'::jsonb,
  24,
  true,
  100,
  true
);

-- Example: Margin <20% requires VP approval
INSERT INTO approval_rules (
  tenant_id,
  rule_name,
  description,
  rule_type,
  threshold_type,
  threshold_value,
  comparison_operator,
  approval_chain_type,
  approvers,
  sla_hours,
  escalation_enabled,
  priority,
  is_active
) VALUES (
  'your-tenant-id',
  'Margin <20% requires VP approval',
  'Critical margin protection - VP approval required',
  'discount',
  'margin_below',
  '20',
  '<',
  'sequential',
  '[{"level": 1, "roleName": "VP of Sales", "isRequired": true, "canDelegate": false}]'::jsonb,
  12,
  true,
  200,
  true
);

-- Example: Deals >$100k require Director approval
INSERT INTO approval_rules (
  tenant_id,
  rule_name,
  description,
  rule_type,
  threshold_type,
  threshold_value,
  comparison_operator,
  approval_chain_type,
  approvers,
  sla_hours,
  escalation_enabled,
  priority,
  is_active
) VALUES (
  'your-tenant-id',
  'Deals >$100k require Director approval',
  'Large deal governance',
  'discount',
  'deal_value',
  '100000',
  '>',
  'sequential',
  '[{"level": 1, "roleName": "Sales Director", "isRequired": true, "canDelegate": true}]'::jsonb,
  48,
  true,
  150,
  true
);
```

## Feature Configuration

### 1. Set Up Approval Rules

Navigate to `/deal-desk/rules` and create your first approval rule:

1. Click "Create Rule"
2. Fill in the details:
   - **Rule Name**: Descriptive name (e.g., "Discount >15%")
   - **Description**: When this rule applies
   - **Request Type**: Type of approval (discount, custom_pricing, etc.)
   - **Threshold Type**: What to measure (discount_percentage, margin_below, deal_value)
   - **Comparison**: >, <, >=, <=, ==
   - **Threshold Value**: Numeric value (e.g., 15 for 15%)
3. Configure approval chain:
   - **Chain Type**: Sequential (one by one) or Parallel (all at once)
   - **Approvers**: Add levels with role names
   - **Required**: Must approve vs. optional
   - **Can Delegate**: Allow temporary delegation
4. Set SLA and priority:
   - **SLA Hours**: Time limit for decision
   - **Priority**: Higher numbers checked first
   - **Escalation**: Auto-escalate on SLA breach
5. Save and activate

### 2. Configure SLA Monitoring (Background Job)

Add a CRON job to check for SLA breaches:

```typescript
// In server/services/cron-service.ts or similar

import { ApprovalWorkflowService } from './approval-workflow-service';

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Checking approval SLA breaches...');
  await ApprovalWorkflowService.checkSLAAndEscalate();
});
```

Or manually trigger via API (platform admin only):

```bash
POST /api/deal-desk/check-sla
```

### 3. Configure Notifications (Optional)

Update `ApprovalWorkflowService` to integrate with your email service:

```typescript
// In server/services/approval-workflow-service.ts

private static async notifyApprovers(request: ApprovalRequest, level: number): Promise<void> {
  const approversAtLevel = request.approvalChain.filter(
    (m: ApprovalChainMember) => m.level === level && m.status === 'pending'
  );

  for (const approver of approversAtLevel) {
    // Send email notification
    await emailService.send({
      to: approver.approverId, // Resolve to email
      subject: `Approval Required: ${request.requestTitle}`,
      template: 'approval-request',
      data: {
        requesterName: request.requestedByName,
        discountPercentage: request.discountPercentage,
        dealValue: request.dealValue,
        justification: request.businessJustification,
        approvalUrl: `https://your-domain.com/deal-desk/requests/${request.id}`,
      }
    });
  }
}
```

## Usage Guide

### For Sales Reps

#### Creating an Approval Request

When building a quote with a discount:

1. System automatically checks if approval is required based on rules
2. If required, rep fills out justification form:
   - **Business Justification**: Why this discount is needed
   - **Competitive Context**: What competitors are offering
   - **Strategic Rationale**: Long-term value of this customer
   - **Risk Assessment**: Any risks to consider
3. Submit request - rep is notified when decided

#### Tracking Status

Navigate to `/deal-desk` to:

- View all your submitted requests
- See current approval status and who's reviewing
- Check time remaining until SLA deadline
- Add comments to provide additional context

### For Approvers

#### Daily Workflow

1. Navigate to `/deal-desk`
2. "My Queue" tab shows requests requiring YOUR approval
3. Dashboard shows:
   - How many approvals you have pending
   - How many are SLA breached (need immediate attention)
   - Your approval rate and average decision time

#### Reviewing a Request

1. Click on any approval card or "View Details"
2. Review the complete context:
   - Pricing details (original vs. proposed, discount %, margin impact)
   - Business justification from sales rep
   - Deal/quote information
   - Approval chain progress
3. Make a decision:
   - **Approve**: Optionally add comments, click Approve
   - **Reject**: MUST provide rejection reason, click Reject
   - **Discuss**: Add comments before deciding

#### Quick Approval

For simple approvals:

1. From dashboard, click "Approve" or "Reject" on any card
2. Add comments (optional for approve, required for reject)
3. Confirm decision

### For Administrators

#### Managing Rules

1. Navigate to `/deal-desk/rules`
2. View all active approval rules
3. Edit rules to adjust thresholds
4. Deactivate rules temporarily without deleting
5. Reorder by priority for complex logic

#### Analytics & Reporting

Dashboard provides key metrics:

- **Total Pending**: All requests in system
- **SLA Breached**: Requests past deadline
- **Approval Rate**: % approved in last 30 days
- **Avg Approval Time**: How fast decisions are made

Query the `discount_analytics` table for deeper insights:

- Approval rates by approver
- Discount velocity trends
- Margin protection effectiveness
- Win rates with vs. without discounts

## Integration Points

### Quote Builder Integration

When a user changes discount in quote builder:

```typescript
// In QuoteBuilderPage or similar

const handleDiscountChange = async (newDiscountPercentage: number) => {
  // Calculate new pricing
  const newMargin = calculateMargin(price, cost, newDiscountPercentage);

  // Check if approval required
  const approvalCheck = await apiRequest('/api/deal-desk/check-approval', {
    method: 'POST',
    body: JSON.stringify({
      discountPercentage: newDiscountPercentage,
      margin: newMargin,
      dealValue: quoteTotal,
    }),
  });

  if (approvalCheck.required) {
    // Show approval request dialog
    setShowApprovalDialog(true);
    setApprovalContext({
      matchedRules: approvalCheck.matchedRules,
      ...
    });

    // Lock quote from being sent until approved
    setQuoteLocked(true);
  }
};
```

### Deals Workflow Integration

Auto-create approval requests when deal moves to certain stages:

```typescript
// In deals routes or service

const handleStageChange = async (dealId: string, newStage: string) => {
  if (newStage === 'negotiation' && deal.discountPercentage > 10) {
    // Auto-create approval request
    await apiRequest('/api/deal-desk/requests', {
      method: 'POST',
      body: JSON.stringify({
        dealId,
        requestType: 'discount',
        requestTitle: `Discount Approval: ${deal.title}`,
        discountPercentage: deal.discountPercentage,
        businessJustification: deal.notes,
        ...
      }),
    });
  }
};
```

## Testing Guide

### Manual Testing Checklist

#### 1. Rule Configuration

- [ ] Create new approval rule
- [ ] Edit existing rule
- [ ] Deactivate/reactivate rule
- [ ] Delete rule
- [ ] Verify priority ordering works

#### 2. Approval Request Flow

- [ ] Create request that matches a rule
- [ ] Create request that matches multiple rules
- [ ] Verify approval chain built correctly
- [ ] Check SLA deadline calculated properly
- [ ] Add comments to request

#### 3. Approval Decision

- [ ] Approve a request
- [ ] Reject a request
- [ ] Verify next approver notified (sequential chain)
- [ ] Test parallel approval chain
- [ ] Test "any one" approval chain

#### 4. SLA & Escalation

- [ ] Create request with short SLA (e.g., 1 hour)
- [ ] Wait for SLA to breach
- [ ] Run SLA check job
- [ ] Verify escalation triggered

#### 5. Delegation

- [ ] Create delegation
- [ ] Verify requests route to delegate
- [ ] Deactivate delegation
- [ ] Verify requests route back to delegator

#### 6. Analytics

- [ ] Check dashboard stats
- [ ] Verify approval rate calculation
- [ ] Check avg approval time
- [ ] Test search and filters

### API Testing

```bash
# Check if approval required
curl -X POST http://localhost:5000/api/deal-desk/check-approval \
  -H "Content-Type: application/json" \
  -H "Cookie: session-cookie-here" \
  -d '{
    "discountPercentage": 20,
    "dealValue": 50000,
    "margin": 25
  }'

# Create approval request
curl -X POST http://localhost:5000/api/deal-desk/requests \
  -H "Content-Type: application/json" \
  -H "Cookie: session-cookie-here" \
  -d '{
    "requestType": "discount",
    "requestTitle": "20% Discount - Acme Corp",
    "discountPercentage": 20,
    "dealValue": 50000,
    "proposedMargin": 25,
    "businessJustification": "Competitive situation with competitor offering 18% discount..."
  }'

# Get my pending approvals
curl http://localhost:5000/api/deal-desk/my-approvals \
  -H "Cookie: session-cookie-here"

# Approve a request
curl -X POST http://localhost:5000/api/deal-desk/requests/{id}/decision \
  -H "Content-Type: application/json" \
  -H "Cookie: session-cookie-here" \
  -d '{
    "decision": "approve",
    "comments": "Approved for strategic account"
  }'
```

## Troubleshooting

### Common Issues

#### 1. Approvals not routing correctly

**Symptom**: Request created but no one assigned as approver

**Solution**:

- Check that approval rules have `approvers` array configured
- Verify `roleName` matches existing roles in system
- Check rule `isActive` is `true`
- Verify `priority` and `order` fields set

#### 2. SLA not triggering

**Symptom**: Requests past deadline but not marked as breached

**Solution**:

- Ensure CRON job is running (`checkSLAAndEscalate`)
- Check `slaDeadline` field is populated on request
- Verify server timezone matches expected timezone

#### 3. Dashboard not showing pending approvals

**Symptom**: User has requests to approve but "My Queue" is empty

**Solution**:

- Check user ID matches `approverId` in approval chain
- Verify `currentApprovalLevel` matches user's level in chain
- Check request `status` is 'pending' or 'in_review'

#### 4. Rules not matching

**Symptom**: Creating request but no rules match

**Solution**:

- Verify threshold value and operator are correct
- Check `thresholdType` matches field being checked
- Ensure `conditions` array (if used) has correct field names
- Check rule `ruleType` matches request `requestType`

## Performance Considerations

### Database Indexes

The schemas include indexes on:

- `tenantId` (all tables)
- `status` and `submittedAt` (approvalRequests)
- `approverId` and `level` (approval chain queries)
- `slaDeadline` (SLA checks)

### Caching Strategy

- Dashboard stats: 5-minute cache
- My approvals: 15-second cache (near real-time)
- All requests: 30-second cache
- Rules: Cache until mutation

### Query Optimization

- Use `select()` to limit fields returned
- Paginate large result sets
- Filter by `tenantId` + `status` indexes
- Use `exists` queries for boolean checks

## Security Considerations

1. **Authorization**: All routes require authentication
2. **Tenant Isolation**: All queries filtered by `tenantId`
3. **Input Validation**: Zod schemas on all mutations
4. **Audit Trail**: Complete activity log in requests
5. **Role-Based**: Only approvers can make decisions
6. **No Bypass**: No way to skip rules programmatically

## Future Enhancements

Potential additions:

1. Mobile push notifications
2. Slack/Teams integration for approvals
3. Approval request templates
4. Bulk approval actions
5. Advanced analytics dashboard
6. Approval workflow automation (auto-approve certain scenarios)
7. Approval limits per user (max discount they can approve)
8. Time-based rules (higher thresholds during EOQ)

## Support

For questions or issues:

1. Check this guide first
2. Review API route code in `server/routes-deal-desk.ts`
3. Check service logic in `server/services/approval-workflow-service.ts`
4. Review schemas in `shared/deal-desk-schema.ts`
