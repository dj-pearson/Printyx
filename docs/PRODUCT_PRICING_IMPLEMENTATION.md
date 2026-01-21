# Product Pricing Refinement - Three-Tier Pricing Implementation

## Overview

This document details the comprehensive three-tier pricing system implemented for Printyx. The system supports:

1. **Dealer Cost** - Hard cost to the dealer (fluctuates with supplier pricing)
2. **Rep Cost** - Dealer Cost + Company Markup (default 13%, covers operating expenses)
3. **Customer Price** - Final price set by sales reps (may require approval)

## Business Requirements

### Pricing Tiers

#### Tier 1: Dealer Cost

- **Definition**: The hard cost to the dealer for acquiring the product
- **Fluctuation**: Changes as supplier costs change
- **Editable By**: Admins and above only
- **Visible To**: Managers and above (configurable)

#### Tier 2: Rep Cost

- **Definition**: Dealer Cost + Company Markup Percentage
- **Default Markup**: 13% (configurable per company)
- **Calculation**: `repCost = dealerCost * (1 + markupPercentage / 100)`
- **Markup Types**:
  - Blanket markup (applies to all products)
  - Per-category markup (e.g., MFP: 13%, Production: 15%)
  - Per-product markup (custom override)
- **Editable By**: Automatically calculated (markup % editable by admins)
- **Visible To**: Sales reps and above

#### Tier 3: Customer Price

- **Definition**: Final price shown to customer
- **Set By**: Sales reps (may require manager approval)
- **Constraints**:
  - Must meet minimum margin requirements (default 5% from dealer cost)
  - Discounts beyond threshold require approval (default 10% from rep cost)
- **Visible To**: Everyone (including customers in proposals)

### Role-Based Visibility

| Role           | Can See Dealer Cost | Can See Rep Cost | Can See Customer Price | Can Edit Dealer Cost | Can Edit Customer Price |
| -------------- | ------------------- | ---------------- | ---------------------- | -------------------- | ----------------------- |
| Platform Admin | ✅                  | ✅               | ✅                     | ✅                   | ✅                      |
| Super Admin    | ✅                  | ✅               | ✅                     | ✅                   | ✅                      |
| Admin          | ✅                  | ✅               | ✅                     | ✅                   | ✅                      |
| Manager        | ✅                  | ✅               | ✅                     | ❌                   | ✅                      |
| Sales Rep      | ❌\*                | ✅               | ✅                     | ❌                   | ✅\*\*                  |
| Support        | ❌                  | ❌               | ✅                     | ❌                   | ❌                      |
| Read-Only      | ❌                  | ❌               | ✅                     | ❌                   | ❌                      |
| Guest          | ❌                  | ❌               | ✅                     | ❌                   | ❌                      |

\*Configurable via company settings: `showDealerCostToReps`
\*\*Subject to approval workflow based on company settings

### Approval Workflow

Sales reps may need approval when:

1. **Always Required**: `requireApprovalForPriceEdit = true` in company settings
2. **Threshold-Based**: Discount from rep cost exceeds `autoApprovalThreshold` (default 10%)
3. **Minimum Margin**: Customer price results in margin below `minMarginPercentage` (default 5%)

Approval process:

1. Rep submits price change request with reason
2. Manager receives notification
3. Manager approves or rejects with notes
4. Rep is notified of decision
5. If approved, price change is applied

## Implementation Details

### Schema Changes

#### New Schema File: `shared/product-pricing-schema.ts`

**Tables Created:**

1. **`company_pricing_settings`** - Tenant-level pricing configuration
   - Default markup percentage (13%)
   - Category-specific markup overrides
   - Sales rep permissions
   - Approval thresholds
   - Visibility settings

2. **`enhanced_product_pricing`** - Product-level pricing (new normalized structure)
   - Links to productModels or productAccessories
   - Three-tier pricing fields
   - Markup configuration
   - Effective date tracking

3. **`enhanced_quote_pricing`** - Quote-level pricing with approval workflow
   - All three pricing tiers at quote level
   - Margin calculations
   - Approval status tracking
   - Version history

4. **`enhanced_quote_pricing_line_items`** - Line item pricing
   - Three-tier pricing per line
   - Margin calculations per line
   - Discount tracking
   - Override flags

5. **`price_change_approvals`** - Approval request tracking
   - Request details and reason
   - Pricing impact analysis
   - Approval/rejection workflow
   - Escalation support

**Extended Existing Tables:**

1. **`productModels`** - Added three-tier pricing for each tier (new, upgrade, lexmark):
   - `newDealerCost`, `newRepMarkupPercentage`, `newRepCost`, `newSuggestedRetail`
   - `upgradeDealerCost`, `upgradeRepMarkupPercentage`, `upgradeRepCost`, `upgradeSuggestedRetail`
   - `lexmarkDealerCost`, `lexmarkRepMarkupPercentage`, `lexmarkRepCost`, `lexmarkSuggestedRetail`
   - Legacy fields (`newRepPrice`, etc.) maintained for backward compatibility

2. **`productAccessories`** - Added three-tier pricing for each tier (standard, new, upgrade):
   - `standardDealerCost`, `standardRepMarkupPercentage`, `standardRepCost`, `standardSuggestedRetail`
   - `newDealerCost`, `newRepMarkupPercentage`, `newRepCost`, `newSuggestedRetail`
   - `upgradeDealerCost`, `upgradeRepMarkupPercentage`, `upgradeRepCost`, `upgradeSuggestedRetail`

### Server-Side Implementation

#### New Service: `server/services/pricing-service.ts`

**Key Functions:**

1. **RBAC Functions:**
   - `canSeeDealerCost(userRole, settings)` - Check dealer cost visibility
   - `canSeeRepCost(userRole, settings)` - Check rep cost visibility
   - `canEditDealerCost(userRole)` - Check dealer cost edit permission
   - `canEditCustomerPrice(userRole, settings)` - Check customer price edit permission

2. **Calculation Functions:**
   - `calculateRepCost(dealerCost, markup, settings, category)` - Calculate rep cost
   - `calculateMarginPercentage(customerPrice, cost)` - Calculate margin %
   - `calculateDiscountPercentage(original, discounted)` - Calculate discount %
   - `validateMinimumMargin(customerPrice, dealerCost, settings)` - Validate pricing

3. **Approval Functions:**
   - `requiresApproval(userRole, originalPrice, newPrice, repCost, settings)` - Check if approval needed

4. **Filtering Functions:**
   - `filterPricingByRole(data, userRole, settings)` - Remove fields user can't see
   - `filterPricingArrayByRole(array, userRole, settings)` - Filter array of pricing data

5. **Settings Functions:**
   - `getCompanyPricingSettings(tenantId)` - Get pricing settings
   - `getOrCreatePricingSettings(tenantId)` - Get or create with defaults
   - `getPricingVisibility(tenantId, userRole)` - Get visibility config for user

#### New Routes: `server/routes-product-pricing.ts`

**API Endpoints:**

1. **Company Settings:**
   - `GET /api/pricing/settings` - Get company pricing settings
   - `PUT /api/pricing/settings` - Update pricing settings (admins only)

2. **Pricing Visibility:**
   - `GET /api/pricing/visibility` - Get visibility config for current user

3. **Pricing Calculations:**
   - `POST /api/pricing/calculate-rep-cost` - Calculate rep cost from dealer cost

4. **Product Pricing:**
   - `PATCH /api/product-models/:id/pricing` - Update product pricing
   - `POST /api/pricing/bulk-update-dealer-cost` - Bulk update dealer costs (admins only)

5. **Reports:**
   - `GET /api/pricing/margin-report` - Sales manager margin analysis report
   - `GET /api/pricing/margin-report/export` - Export margin report to CSV

6. **Approval Workflow:**
   - `POST /api/pricing/request-approval` - Submit price change for approval
   - `PATCH /api/pricing/approval/:id` - Approve or reject price change
   - `GET /api/pricing/approvals/pending` - Get pending approvals (managers only)

**Route Registration:**
Added to `server/routes.ts`:

```typescript
import { registerProductPricingRoutes } from './routes-product-pricing';
// ...
registerProductPricingRoutes(app);
```

### Configuration

**Drizzle Config Updated:**

```typescript
// drizzle.config.ts
schema: [
  './shared/schema.ts',
  './shared/product-pricing-schema.ts', // Added
  './server/sales-forecasting-schema.ts',
  './shared/reporting-schema.ts',
];
```

## Default Company Pricing Settings

When a tenant is created, default settings are:

```typescript
{
  defaultMarkupPercentage: 13.00,
  allowRepPriceEdit: true,
  requireApprovalForPriceEdit: false,
  requireApprovalAboveThreshold: true,
  maxDiscountPercentage: 20.00,
  minMarginPercentage: 5.00,
  autoApprovalThreshold: 10.00,
  showDealerCostToReps: false,
  showMarginToReps: true,
  notifyOnPriceChange: true,
  notifyManagersOnApproval: true,
}
```

## Migration Path

### Phase 1: Schema Deployment (CURRENT)

- ✅ New pricing tables created
- ✅ Existing tables extended with new pricing fields
- ✅ Legacy fields maintained for backward compatibility
- ⏳ Run database migration: `npm run db:push`

### Phase 2: Backend Services (COMPLETE)

- ✅ Pricing service with calculations and RBAC
- ✅ API routes for pricing management
- ✅ Approval workflow endpoints
- ✅ Margin reporting endpoints

### Phase 3: Frontend UI (PENDING - Next Steps)

#### 3.1: Company Pricing Settings Page (New)

**Location:** `client/src/pages/PricingSettings.tsx`

**Features Needed:**

- Default markup percentage configuration
- Category-specific markup overrides
- Sales rep permissions toggle
- Approval workflow settings
- Visibility settings
- Notification preferences

**Implementation Guide:**

```typescript
// Fetch settings
const { data: settings } = useQuery({
  queryKey: ['/api/pricing/settings'],
});

// Update settings
const updateMutation = useMutation({
  mutationFn: (data) => apiRequest('/api/pricing/settings', 'PUT', data),
  onSuccess: () => queryClient.invalidateQueries(['/api/pricing/settings']),
});
```

#### 3.2: Product Models Page Updates

**Location:** `client/src/pages/ProductModels.tsx`

**Changes Needed:**

1. Fetch pricing visibility for current user:

```typescript
const { data: visibility } = useQuery({
  queryKey: ['/api/pricing/visibility'],
});
```

2. Update pricing form fields to show three tiers:

```typescript
// For each tier (new, upgrade, lexmark):
{visibility?.showDealerCost && (
  <FormField name="newDealerCost" label="Dealer Cost" />
)}
<FormField name="newRepMarkupPercentage" label="Markup %" />
<FormField name="newRepCost" label="Rep Cost" disabled />
<FormField name="newSuggestedRetail" label="Suggested Retail" />
```

3. Add real-time rep cost calculation:

```typescript
const calculateRepCost = async (dealerCost) => {
  const result = await apiRequest('/api/pricing/calculate-rep-cost', 'POST', {
    dealerCost,
    markupPercentage: form.getValues('newRepMarkupPercentage'),
    productCategory: form.getValues('category'),
  });
  form.setValue('newRepCost', result.repCost);
};
```

4. Filter displayed pricing in product cards based on role:

```typescript
{visibility?.showDealerCost && (
  <div>Dealer: {formatCurrency(model.newDealerCost)}</div>
)}
{visibility?.showRepCost && (
  <div>Rep Cost: {formatCurrency(model.newRepCost)}</div>
)}
```

#### 3.3: Product Accessories Page Updates

**Location:** `client/src/pages/ProductAccessories.tsx`

**Changes:** Same pattern as Product Models page

- Three-tier pricing for each tier (standard, new, upgrade)
- Role-based visibility
- Real-time calculations

#### 3.4: Quote Builder Updates

**Location:** `client/src/pages/QuoteBuilderPage.tsx`

**Changes Needed:**

1. Show rep cost when adding products (if user can see it)
2. Calculate customer price with margin display
3. Show approval warning if discount exceeds threshold
4. Submit for approval if needed

**Implementation:**

```typescript
// Check if approval needed
const needsApproval = async (lineItem) => {
  const discountPercentage = calculateDiscountPercentage(lineItem.repCost, lineItem.customerPrice);

  if (discountPercentage > settings.autoApprovalThreshold) {
    // Show approval dialog
    setShowApprovalDialog(true);
  }
};

// Submit quote with approval request
const submitQuote = async () => {
  if (requiresApproval) {
    await apiRequest('/api/pricing/request-approval', 'POST', {
      requestType: 'quote',
      referenceId: quoteId,
      requestReason: approvalReason,
      // ...
    });
  }
};
```

#### 3.5: Quote Proposal View Updates

**Location:** `client/src/pages/QuoteView.tsx`, `client/src/pages/QuoteProposalGeneration.tsx`

**Changes:**

- Customers see ONLY customer price
- Sales reps see rep cost and customer price
- Managers see all three tiers
- Show margin calculations for managers

#### 3.6: Sales Manager Reports (New)

**Location:** `client/src/pages/MarginAnalysisReport.tsx`

**Features:**

- Filter by date range, sales rep, quote status
- Show all quotes with margin breakdown
- Line-by-line margin analysis
- Export to CSV
- Dashboard widgets showing margin trends

**Implementation:**

```typescript
const { data: report } = useQuery({
  queryKey: ['/api/pricing/margin-report', filters],
});

// Export function
const exportReport = async () => {
  const blob = await fetch('/api/pricing/margin-report/export?' + queryParams);
  downloadFile(blob, 'margin-report.csv');
};
```

#### 3.7: Price Approval Workflow UI (New)

**Location:** `client/src/pages/PriceApprovals.tsx`

**Features:**

- List pending approvals (for managers)
- Show pricing impact (original vs requested)
- Margin impact analysis
- Approve/reject with notes
- Notification system

**Implementation:**

```typescript
const { data: pending } = useQuery({
  queryKey: ['/api/pricing/approvals/pending'],
});

const approveMutation = useMutation({
  mutationFn: (data) =>
    apiRequest(`/api/pricing/approval/${approvalId}`, 'PATCH', {
      status: 'approved',
      approvalNotes: data.notes,
    }),
});
```

## Testing Checklist

### Backend Testing

- [ ] Company pricing settings CRUD
- [ ] Pricing visibility by role
- [ ] Rep cost calculation (blanket, per-category, per-product)
- [ ] Margin validation
- [ ] Approval workflow (request, approve, reject)
- [ ] Margin report generation
- [ ] CSV export
- [ ] Bulk dealer cost updates

### Frontend Testing

- [ ] Pricing settings page (admin only)
- [ ] Product models page - three-tier pricing
- [ ] Product accessories page - three-tier pricing
- [ ] Quote builder - pricing with approval
- [ ] Quote view - role-based visibility
- [ ] Margin report - filtering and export
- [ ] Price approvals - manager workflow
- [ ] Role-based visibility (test with different roles)

### Integration Testing

- [ ] Dealer cost change recalculates rep cost
- [ ] Markup % change recalculates rep cost
- [ ] Customer price validates minimum margin
- [ ] Approval threshold enforcement
- [ ] Notifications sent on approval requests
- [ ] Quote pricing persists correctly
- [ ] Report accuracy (margin calculations)

## Example Workflows

### Workflow 1: Admin Updates Dealer Cost

1. Admin navigates to Product Models
2. Edits product, updates dealer cost (e.g., $5000 → $5500)
3. System auto-calculates new rep cost: $5500 \* 1.13 = $6215
4. Admin saves changes
5. All quotes using this product show updated pricing

### Workflow 2: Sales Rep Creates Quote with Discount

1. Sales rep creates quote
2. Adds product with rep cost of $6215
3. Sets customer price to $6500 (4.6% margin from rep cost)
4. Within auto-approval threshold → No approval needed
5. Quote can be sent immediately

### Workflow 3: Sales Rep Requests Large Discount

1. Sales rep creates quote
2. Adds product with rep cost of $6215
3. Sets customer price to $5500 (11.5% discount from rep cost)
4. Exceeds auto-approval threshold (10%)
5. System prompts for approval reason
6. Rep submits: "Large volume deal, strategic account"
7. Manager receives notification
8. Manager reviews margin impact
9. Manager approves with note: "Approved for this customer only"
10. Quote status changes to "approved"
11. Rep can now send quote

### Workflow 4: Manager Reviews Margin Report

1. Manager navigates to Margin Report
2. Filters: Last 30 days, All reps
3. Views summary:
   - Total quotes: 45
   - Average margin: 18.5%
   - Total revenue: $425,000
   - Total margin: $78,625
4. Drills into specific rep's quotes
5. Identifies rep consistently pricing below 10% margin
6. Exports detailed report for coaching session

## Database Migration Script

After deploying schema changes, run:

```bash
npm run db:push
```

This will:

1. Create new pricing tables
2. Add new columns to product models and accessories
3. Preserve existing data
4. Set up indexes for performance

**Note:** Legacy pricing fields are maintained for backward compatibility. A future migration can copy data from legacy fields to new structure if needed.

## API Usage Examples

### Get Pricing Visibility for Current User

```javascript
GET /api/pricing/visibility

Response:
{
  "showDealerCost": false,
  "showRepCost": true,
  "showMargin": true,
  "canEditDealerCost": false,
  "canEditRepCost": false,
  "canEditCustomerPrice": true,
  "requiresApprovalForPriceChange": false,
  "maxDiscountPercentage": 20,
  "minMarginPercentage": 5
}
```

### Calculate Rep Cost

```javascript
POST /api/pricing/calculate-rep-cost
{
  "dealerCost": 5500,
  "markupPercentage": null,  // Use company default
  "productCategory": "MFP"
}

Response:
{
  "dealerCost": 5500,
  "repCost": 6215,
  "markupPercentage": "13.00"
}
```

### Update Product Pricing

```javascript
PATCH /api/product-models/{id}/pricing
{
  "tier": "new",
  "dealerCost": "5500.00",
  "repMarkupPercentage": "13.00",
  "suggestedRetail": "7500.00"
}

Response: (filtered by role)
{
  "id": "...",
  "newRepCost": "6215.00",
  "newSuggestedRetail": "7500.00",
  // dealerCost omitted if user is sales rep
}
```

### Request Price Approval

```javascript
POST /api/pricing/request-approval
{
  "requestType": "quote",
  "referenceId": "quote-123",
  "originalPrice": 6215,
  "requestedPrice": 5500,
  "requestReason": "Large volume deal, strategic account"
}

Response:
{
  "id": "approval-456",
  "status": "pending",
  "discountPercentage": "11.50",
  "requestedDate": "2025-11-21T...",
  // ...
}
```

### Get Margin Report

```javascript
GET /api/pricing/margin-report?startDate=2025-10-01&endDate=2025-11-21&salesRepId=rep-123

Response:
{
  "count": 12,
  "report": [
    {
      "quoteNumber": "Q-2025-1234",
      "quoteDate": "2025-11-15T...",
      "salesRep": "John Doe",
      "totalDealerCost": 15000,
      "totalRepCost": 16950,
      "totalCustomerPrice": 18500,
      "totalMargin": 3500,
      "marginPercentage": 23.33,
      "lineItems": [...]
    },
    // ...
  ]
}
```

## Next Steps

1. **Deploy Schema Changes:**

   ```bash
   npm run db:push
   ```

2. **Test Backend APIs:**
   - Use Postman or Thunder Client to test endpoints
   - Verify RBAC permissions
   - Test calculations

3. **Implement Frontend UI:**
   - Start with Pricing Settings page (admin configuration)
   - Update Product Models page with three-tier pricing
   - Update Quote Builder with approval workflow
   - Build Margin Report page

4. **User Acceptance Testing:**
   - Test with actual users in different roles
   - Validate approval workflows
   - Verify margin calculations

5. **Documentation:**
   - Create user guides for each role
   - Document common workflows
   - Create video tutorials

## Support

For questions or issues with this implementation:

1. Check API endpoints with `/api/pricing/*` routes
2. Review pricing service logic in `server/services/pricing-service.ts`
3. Verify RBAC permissions match business requirements
4. Test with different user roles to verify visibility

## Summary

This implementation provides a robust, role-based three-tier pricing system with:

- ✅ Flexible markup configuration (company-wide, per-category, per-product)
- ✅ Role-based visibility and permissions
- ✅ Approval workflows for discount management
- ✅ Comprehensive margin reporting
- ✅ Bulk update capabilities
- ✅ Full audit trail

The backend is complete and ready for frontend integration. UI implementation can proceed incrementally, starting with admin settings and gradually updating product pages and quote builder.
