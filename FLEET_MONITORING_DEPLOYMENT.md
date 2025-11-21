# Fleet Monitoring & Toner Integration - Deployment Guide

**Branch:** `claude/fm-audit-client-011CUthx8J8LarHPYzpfPbZT`
**Date:** 2025-11-07
**Status:** Ready for Testing & Deployment

---

## 📋 Executive Summary

This deployment adds **complete toner management automation** to the Printyx fleet monitoring system. The integration connects monitoring clients → product catalog → warehouse inventory → service contracts → customer notifications in a fully automated workflow.

### What Was Built
1. ✅ Product catalog integration for real-time toner SKU lookup
2. ✅ Warehouse inventory checking with stock availability
3. ✅ Service contract validation for automatic toner coverage
4. ✅ Email/SMS notification system for customer alerts
5. ✅ Navigation integration for Fleet Monitoring Dashboard

---

## 🎯 What Was Accomplished

### 1. Navigation & Routing Integration
**Commit:** `2111e63`

**Files Modified:**
- `client/src/App.tsx` - Added `/fleet-monitoring` route
- `client/src/components/layout/RoleAwareCollapsibleSidebar.tsx` - Added menu item
- `client/src/components/customer/CustomerMeterReadings.tsx` - Moved to correct location

**What It Does:**
- Fleet Monitoring Dashboard is now accessible at `/fleet-monitoring`
- Appears in Service Hub section of sidebar navigation
- Auto-highlights when route is active

**Deployment Notes:**
- No database changes required
- Frontend-only changes
- Works immediately after deployment

---

### 2. Product Catalog Integration
**Commit:** `2b50d5e`

**Files Modified:**
- `server/routes-client-monitoring.ts`

**What It Does:**
- Created `lookupTonerProduct()` helper function
- Queries `supplies` table for real toner products
- Searches by manufacturer, model, and color with flexible patterns:
  - `TONER-BLACK-HP-LASERJET`
  - `HP-LASERJET-BLACK-TONER`
  - `BLACK-HP-LASERJET`
- Returns actual product ID, SKU, name, description, and pricing
- Uses tiered pricing: `newRepPrice` → `upgradeRepPrice` → `lexmarkRepPrice` → `graphicRepPrice`
- Falls back to placeholder values if product not found

**Database Tables Used:**
- `supplies` (existing table, no migration needed)
  - `productCode` - Product SKU
  - `productName` - Product name
  - `tenantId` - Multi-tenant filtering
  - `isActive` - Only active products
  - Pricing fields: `newRepPrice`, `upgradeRepPrice`, etc.

**Deployment Requirements:**
- ✅ No database migration needed (uses existing `supplies` table)
- ⚠️ **ACTION REQUIRED:** Populate `supplies` table with toner products
  - Add toner products with searchable product codes
  - Example: `TONER-BLACK-HP-P4015`, `TONER-CYAN-CANON-IR5075`
  - Set appropriate pricing tiers
  - Mark as `isActive: true`

**Testing:**
```sql
-- Verify supplies table has toner products
SELECT productCode, productName, newRepPrice, isActive
FROM supplies
WHERE productName ILIKE '%toner%'
  AND isActive = true
LIMIT 10;
```

---

### 3. Warehouse Inventory Integration
**Commit:** `e4e1ff6`

**Files Modified:**
- `server/routes-client-monitoring.ts`

**What It Does:**
- Enhanced `lookupTonerProduct()` to check warehouse inventory
- Queries `inventoryItems` table for stock availability
- Checks actual stock levels:
  - `quantityOnHand` - Total quantity in warehouse
  - `quantityCommitted` - Already allocated to orders
  - `quantityAvailable` - Available for new orders
  - `quantityOnOrder` - Coming from suppliers
- Calculates estimated ship dates:
  - If in stock: ships immediately
  - If on order: estimates 7-day lead time
- Links products to inventory via:
  - `partNumber` = `productCode`
  - `manufacturerPartNumber` = `productCode`

**Database Tables Used:**
- `inventoryItems` (existing table, no migration needed)
  - `partNumber` - Links to supplies.productCode
  - `manufacturerPartNumber` - Alternate linking field
  - `quantityAvailable` - Available stock
  - `quantityOnOrder` - Incoming stock
  - `warehouseLocation` - Physical location
  - `binLocation` - Bin location for picking

**Deployment Requirements:**
- ✅ No database migration needed (uses existing `inventoryItems` table)
- ⚠️ **ACTION REQUIRED:** Link inventory to toner products
  - Ensure `inventoryItems.partNumber` matches `supplies.productCode`
  - Keep `quantityAvailable` updated in real-time
  - Update `quantityOnOrder` when purchasing toner

**Testing:**
```sql
-- Check inventory for toner products
SELECT
  i.partNumber,
  i.itemDescription,
  i.quantityOnHand,
  i.quantityCommitted,
  i.quantityAvailable,
  i.quantityOnOrder,
  s.productName
FROM inventoryItems i
LEFT JOIN supplies s ON i.partNumber = s.productCode
WHERE i.itemDescription ILIKE '%toner%'
  AND i.isActive = true
LIMIT 10;
```

---

### 4. Service Contract Validation
**Commit:** `74a99bc`

**Files Modified:**
- `server/routes-client-monitoring.ts`

**What It Does:**
- Created `checkServiceContractCoverage()` helper function
- Validates active service contracts for equipment
- Checks contract coverage flags:
  - `includesToner` - Toner is covered
  - `includesParts` - Parts are covered
  - `includesLabor` - Labor is covered
- Validates contract dates:
  - Must have started (`startDate <= now`)
  - Must not be expired (`endDate > now`)
  - Must be `contractStatus = 'active'`
- **Sets customer cost to $0.00 when toner is covered**
- Adds contract information to order notes

**Database Tables Used:**
- `serviceContracts` (existing table, no migration needed)
  - `equipmentId` - Links to device_registrations
  - `customerId` - Fallback if no equipmentId
  - `contractStatus` - Must be 'active'
  - `startDate` / `endDate` - Contract validity period
  - `includesToner` - Coverage flag (boolean)
  - `contractNumber` - Reference number
  - `contractType` - Type of contract

**Deployment Requirements:**
- ✅ No database migration needed (uses existing `serviceContracts` table)
- ⚠️ **ACTION REQUIRED:** Link service contracts to equipment
  - Set `serviceContracts.equipmentId` to match device registration IDs
  - Set `includesToner = true` for contracts covering toner
  - Ensure `startDate` and `endDate` are accurate
  - Keep `contractStatus = 'active'` for valid contracts

**Business Logic:**
- When `includesToner = true`: Order total = $0.00 (free for customer)
- When `includesToner = false`: Customer pays full price
- Contract information appears in order notes for reference

**Testing:**
```sql
-- Find active contracts with toner coverage
SELECT
  sc.contractNumber,
  sc.equipmentId,
  sc.customerId,
  sc.contractType,
  sc.includesToner,
  sc.includesParts,
  sc.includesLabor,
  sc.startDate,
  sc.endDate,
  sc.contractStatus
FROM service_contracts sc
WHERE sc.contractStatus = 'active'
  AND sc.includesToner = true
  AND sc.startDate <= NOW()
  AND (sc.endDate IS NULL OR sc.endDate > NOW())
LIMIT 10;
```

---

### 5. Email/SMS Notification System
**Commit:** `12d6d78`

**Files Modified:**
- `server/routes-client-monitoring.ts`

**What It Does:**
- Created `sendNotificationAlerts()` helper function
- Sends notifications via email and SMS when toner orders are created
- Updates notification tracking fields:
  - `isEmailSent` / `emailSentAt` - Email delivery tracking
  - `isSmsSent` / `smsSentAt` - SMS delivery tracking
- Fetches customer contact info from `customerPortalAccess`:
  - `email` - Email address
  - `phone` - Phone number for SMS
- Framework ready for external service integration

**Database Tables Used:**
- `customer_notifications` (existing table, no migration needed)
  - `type` - Notification type ('supply_low')
  - `title` - Notification title
  - `message` - Notification message
  - `isEmailSent` / `emailSentAt` - Email tracking
  - `isSmsSent` / `smsSentAt` - SMS tracking
  - `isPortalRead` / `portalReadAt` - Portal notification tracking
  - `relatedSupplyOrderId` - Links to supply order
  - `priority` - 'normal' or 'high'

- `customer_portal_access` (existing table)
  - `email` - Customer email address
  - `phone` - Customer phone number

**Deployment Requirements:**
- ✅ No database migration needed
- ⚠️ **ACTION REQUIRED:** Set up external notification services

**TODO: Email Service Integration**
Choose one email provider and add credentials to environment:

**Option 1: SendGrid**
```bash
# .env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=notifications@printyx.com
SENDGRID_FROM_NAME="Printyx Notifications"
```

**Option 2: AWS SES**
```bash
# .env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxx
AWS_SES_FROM_EMAIL=notifications@printyx.com
```

**Option 3: Resend**
```bash
# .env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=notifications@printyx.com
```

**Code Integration Point:**
Located at `server/routes-client-monitoring.ts:381-388`
```typescript
// TODO: Integrate with email service (SendGrid, AWS SES, Resend, etc.)
// Example integration:
// await emailService.send({
//   to: recipientEmail,
//   subject: title,
//   html: message,
//   from: 'notifications@printyx.com',
// });
```

**TODO: SMS Service Integration**
Choose one SMS provider and add credentials to environment:

**Option 1: Twilio**
```bash
# .env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
```

**Option 2: AWS SNS**
```bash
# .env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxx
AWS_SNS_SENDER_ID=Printyx
```

**Code Integration Point:**
Located at `server/routes-client-monitoring.ts:414-419`
```typescript
// TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
// Example integration:
// await smsService.send({
//   to: recipientPhone,
//   body: `${title}\n\n${message}`,
//   from: process.env.TWILIO_PHONE_NUMBER,
// });
```

**Testing (Current Simulation Mode):**
- Email/SMS are currently **simulated** (marked as sent but not actually delivered)
- Logs show what would be sent: `[EMAIL NOTIFICATION]` and `[SMS NOTIFICATION]`
- Safe to deploy - notifications won't spam customers until services are configured

---

## 🗄️ Database Migration Checklist

### Required Data Population

#### 1. Populate `supplies` Table with Toner Products
**Priority:** HIGH
**Before:** Toner orders will use placeholder prices
**After:** Toner orders will use real product catalog prices

```sql
-- Example: Add toner products for common printers
INSERT INTO supplies (
  tenant_id,
  product_code,
  product_name,
  product_type,
  new_rep_price,
  in_stock,
  is_active,
  summary
) VALUES
  (
    'your-tenant-id',
    'TONER-BLACK-HP-P4015',
    'HP LaserJet P4015 Black Toner',
    'Supplies',
    '89.99',
    'true',
    true,
    'High-yield black toner cartridge for HP LaserJet P4015 series'
  ),
  (
    'your-tenant-id',
    'TONER-CYAN-CANON-IR5075',
    'Canon imageRUNNER 5075 Cyan Toner',
    'Supplies',
    '129.99',
    'true',
    true,
    'Cyan toner cartridge for Canon imageRUNNER 5075'
  );
  -- Add more products for your printer models
```

**Naming Convention:**
- Use searchable product codes: `TONER-{COLOR}-{MANUFACTURER}-{MODEL}`
- Support flexible searches: manufacturer + model, just manufacturer, etc.

#### 2. Link Inventory to Toner Products
**Priority:** HIGH
**Before:** Stock availability will show as "in stock" by default
**After:** Real-time stock availability from warehouse

```sql
-- Example: Add inventory for toner products
INSERT INTO inventory_items (
  tenant_id,
  part_number,
  manufacturer_part_number,
  item_description,
  item_category,
  manufacturer,
  quantity_on_hand,
  quantity_committed,
  quantity_available,
  quantity_on_order,
  unit_price,
  warehouse_location,
  bin_location,
  is_active
) VALUES
  (
    'your-tenant-id',
    'TONER-BLACK-HP-P4015',  -- Must match supplies.product_code
    'CC364X',                 -- Manufacturer part number
    'HP 64X Black High Yield Toner',
    'Toner',
    'HP',
    50,  -- On hand
    10,  -- Committed to other orders
    40,  -- Available (50 - 10)
    100, -- On order from supplier
    '89.99',
    'WAREHOUSE-A',
    'AISLE-12-BIN-3',
    true
  );
  -- Add more inventory records
```

**Important:**
- Keep `quantity_available` updated in real-time
- Link via `part_number` = `supplies.product_code`
- Update `quantity_on_order` when purchasing from suppliers

#### 3. Link Service Contracts to Equipment
**Priority:** MEDIUM
**Before:** All toner orders charge customers full price
**After:** Contracts with toner coverage = $0.00 for customer

```sql
-- Example: Create service contracts with toner coverage
INSERT INTO service_contracts (
  tenant_id,
  contract_number,
  customer_id,
  equipment_id,  -- Must match device_registrations.id
  contract_type,
  contract_status,
  start_date,
  end_date,
  includes_toner,
  includes_parts,
  includes_labor,
  monthly_base_rate,
  auto_renewal
) VALUES
  (
    'your-tenant-id',
    'SVC-2025-001',
    'customer-id-123',
    'device-registration-id-456',  -- Link to monitored device
    'full-service',
    'active',
    '2025-01-01',
    '2026-01-01',
    true,   -- Toner IS covered (customer pays $0)
    true,   -- Parts covered
    true,   -- Labor covered
    299.99,
    true
  );
  -- Add more contracts
```

**Business Rules:**
- `includesToner = true` → Customer pays $0.00 for toner
- `includesToner = false` → Customer pays full catalog price
- Link to `device_registrations.id` for automatic lookup

#### 4. Ensure Customer Portal Access Has Contact Info
**Priority:** HIGH (for notifications)
**Before:** Notifications created but not sent
**After:** Email/SMS delivered to customers

```sql
-- Verify customer portal users have email/phone
SELECT
  id,
  email,
  phone,
  full_name
FROM customer_portal_access
WHERE tenant_id = 'your-tenant-id'
  AND (email IS NULL OR phone IS NULL);

-- Update missing contact info
UPDATE customer_portal_access
SET
  email = 'customer@example.com',
  phone = '+15551234567'
WHERE id = 'portal-user-id';
```

---

## 📦 Deployment Steps

### 1. Pre-Deployment Checklist
- [ ] Review all code changes in branch `claude/fm-audit-client-011CUthx8J8LarHPYzpfPbZT`
- [ ] Verify database schema (no migrations needed - all tables exist)
- [ ] Populate `supplies` table with toner products
- [ ] Link `inventoryItems` to toner products
- [ ] Create/update `serviceContracts` for equipment
- [ ] Verify `customerPortalAccess` has email/phone for all users
- [ ] Decide on email/SMS providers (optional for initial deployment)

### 2. Deployment Commands

```bash
# 1. Merge to main branch (or your deployment branch)
git checkout main
git merge claude/fm-audit-client-011CUthx8J8LarHPYzpfPbZT

# 2. Install dependencies (if any new ones)
npm install

# 3. Build frontend
npm run build

# 4. Restart server
npm start  # or your deployment command
```

### 3. Post-Deployment Verification

#### Backend API Tests
```bash
# Test toner order endpoint
curl -X POST http://localhost:5000/api/devices/{device-id}/order-toner \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "colors": ["black", "cyan"],
    "urgent": false,
    "notes": "Test order"
  }'

# Expected response:
# {
#   "success": true,
#   "message": "Toner order created successfully",
#   "order": {
#     "orderId": "...",
#     "orderNumber": "TONER-...",
#     "deviceName": "...",
#     "colors": ["black", "cyan"],
#     "status": "draft",
#     "items": [...]
#   }
# }
```

#### Database Verification
```sql
-- Check that orders are being created
SELECT
  order_number,
  status,
  subtotal,
  total,
  is_contract_covered,
  created_at
FROM customer_supply_orders
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check that order items have real products
SELECT
  oi.product_sku,
  oi.product_name,
  oi.unit_price,
  oi.in_stock,
  oi.estimated_ship_date,
  s.product_code
FROM customer_supply_order_items oi
LEFT JOIN supplies s ON oi.product_id = s.id
WHERE oi.order_id IN (
  SELECT id FROM customer_supply_orders
  WHERE created_at > NOW() - INTERVAL '1 hour'
);

-- Check that notifications are being created
SELECT
  type,
  title,
  message,
  is_email_sent,
  is_sms_sent,
  priority,
  created_at
FROM customer_notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

#### Frontend Tests
1. Navigate to `/fleet-monitoring`
2. Click "Order Toner" on a low-toner device
3. Select toner colors
4. Submit order
5. Verify success message
6. Check that order appears in system

### 4. Monitoring & Logging

**Key Log Patterns to Monitor:**
```bash
# Product catalog lookups
[TONER LOOKUP] Found product:
[TONER LOOKUP] No product found for:

# Warehouse inventory checks
[WAREHOUSE INVENTORY] Stock check:
[WAREHOUSE INVENTORY] No inventory record found

# Service contract validation
[SERVICE CONTRACT] Found active contract:
[SERVICE CONTRACT] No active contract found
[SERVICE CONTRACT] Contract expired:

# Notifications
[NOTIFICATION] Created notification for toner order:
[EMAIL NOTIFICATION] Sending email:
[SMS NOTIFICATION] Sending SMS:
[NOTIFICATION] Alerts sent:
```

**Error Patterns to Watch:**
```bash
[TONER LOOKUP] Error looking up toner product:
[SERVICE CONTRACT] Error checking coverage:
[NOTIFICATION] Failed to create notification:
[SUPPLY ORDER] Failed to create order:
```

---

## 🔧 Configuration Requirements

### Environment Variables (Optional)

```bash
# Email Service (choose one)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=notifications@printyx.com

# SMS Service (choose one)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567

# Notification Settings (optional)
NOTIFICATION_EMAIL_ENABLED=true
NOTIFICATION_SMS_ENABLED=true
NOTIFICATION_RETRY_ATTEMPTS=3
```

**Note:** Notifications will work without these (logged but not sent) until services are configured.

---

## 📊 Feature Flags & Rollout

### Gradual Rollout Strategy

```sql
-- Option 1: Enable for specific tenants first
-- Add a feature flag to tenant configuration
UPDATE tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{features,autoTonerOrdering}',
  'true'::jsonb
)
WHERE id = 'pilot-tenant-id';

-- Option 2: Enable for specific customers
-- Add customer-level feature flag
UPDATE business_records
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{features,autoTonerOrdering}',
  'true'::jsonb
)
WHERE id = 'pilot-customer-id';
```

### Testing Groups
1. **Internal Testing** - Your own devices first
2. **Pilot Customers** - 5-10 friendly customers
3. **General Availability** - All customers

---

## ✅ Testing Checklist

### Unit Testing
- [ ] Test `lookupTonerProduct()` with various manufacturers/models
- [ ] Test `lookupTonerProduct()` with missing products (fallback)
- [ ] Test `checkServiceContractCoverage()` with active contracts
- [ ] Test `checkServiceContractCoverage()` with expired contracts
- [ ] Test `checkServiceContractCoverage()` with no contracts
- [ ] Test `sendNotificationAlerts()` email flag updates
- [ ] Test `sendNotificationAlerts()` SMS flag updates

### Integration Testing
- [ ] Create toner order with product in catalog → verify real price
- [ ] Create toner order with product NOT in catalog → verify fallback price
- [ ] Create toner order with in-stock product → verify availability
- [ ] Create toner order with out-of-stock product → verify ship date
- [ ] Create toner order with contract coverage → verify $0.00 total
- [ ] Create toner order without contract → verify full price
- [ ] Create toner order → verify notification created
- [ ] Create toner order → verify email/SMS flags updated

### End-to-End Testing
- [ ] Full flow: Low toner alert → Order toner → Notification sent
- [ ] Full flow: Urgent order → Contract covered → $0.00 invoice
- [ ] Full flow: Normal order → Not covered → Charged full price
- [ ] Full flow: Out of stock → Estimated ship date shown

### Load Testing
- [ ] 100 concurrent toner orders
- [ ] 1000 devices reporting low toner simultaneously
- [ ] Database query performance on large `supplies` table
- [ ] Database query performance on large `inventoryItems` table

---

## 🚨 Troubleshooting Guide

### Issue: "No product found for toner"
**Symptoms:** Orders use placeholder SKUs and $99.99 price
**Cause:** Product not in catalog or search patterns don't match
**Solution:**
```sql
-- Check what products exist for this manufacturer/model
SELECT product_code, product_name
FROM supplies
WHERE product_name ILIKE '%HP%'
  AND product_name ILIKE '%P4015%'
  AND is_active = true;

-- Add product with searchable code
INSERT INTO supplies (
  tenant_id, product_code, product_name,
  new_rep_price, is_active
) VALUES (
  'tenant-id',
  'TONER-BLACK-HP-P4015',
  'HP LaserJet P4015 Black Toner',
  '89.99',
  true
);
```

### Issue: "Inventory always shows 'in stock'"
**Symptoms:** All orders show available even when out of stock
**Cause:** No inventory record linked to product
**Solution:**
```sql
-- Check if inventory exists for this product
SELECT * FROM inventory_items
WHERE part_number = 'TONER-BLACK-HP-P4015';

-- Add inventory record
INSERT INTO inventory_items (
  tenant_id,
  part_number,
  manufacturer_part_number,
  item_description,
  quantity_available,
  is_active
) VALUES (
  'tenant-id',
  'TONER-BLACK-HP-P4015',  -- Must match supplies.product_code
  'CC364X',
  'HP 64X Black Toner',
  25,  -- Available quantity
  true
);
```

### Issue: "Contract coverage not working"
**Symptoms:** Orders charge full price even with contract
**Cause:** Contract not linked to device or includes_toner = false
**Solution:**
```sql
-- Find the device registration ID
SELECT id, device_name, serial_number
FROM device_registrations
WHERE serial_number = 'ABC123';

-- Check if contract exists for this device
SELECT * FROM service_contracts
WHERE equipment_id = 'device-registration-id'
  AND contract_status = 'active';

-- Create or update contract
UPDATE service_contracts
SET
  equipment_id = 'device-registration-id',
  includes_toner = true,
  contract_status = 'active',
  start_date = '2025-01-01',
  end_date = '2026-01-01'
WHERE contract_number = 'SVC-2025-001';
```

### Issue: "Notifications not being sent"
**Symptoms:** Notifications created but email/SMS not delivered
**Cause:** External services not configured (expected until integration)
**Solution:**
- This is **normal behavior** until email/SMS services are set up
- Check logs for `[EMAIL NOTIFICATION]` and `[SMS NOTIFICATION]` entries
- Notifications are being logged and tracked in database
- Add external service credentials when ready (see configuration above)

---

## 📈 Performance Optimization

### Database Indexes
Already exist on:
- `supplies.tenant_id` + `supplies.is_active`
- `supplies.product_code`
- `inventory_items.tenant_id` + `inventory_items.part_number`
- `service_contracts.tenant_id` + `service_contracts.equipment_id`
- `customer_notifications.tenant_id` + `customer_notifications.created_at`

### Query Performance Tips
```sql
-- If supplies table grows large, add composite index:
CREATE INDEX idx_supplies_search
ON supplies (tenant_id, is_active, product_code);

-- If inventory lookups are slow:
CREATE INDEX idx_inventory_part_lookup
ON inventory_items (tenant_id, part_number, manufacturer_part_number)
WHERE is_active = true;

-- If contract lookups are slow:
CREATE INDEX idx_contracts_equipment_active
ON service_contracts (tenant_id, equipment_id, contract_status)
WHERE contract_status = 'active';
```

---

## 🔮 Future Enhancements

### Short-Term (Next Sprint)
1. **Email Template Designer**
   - Create rich HTML email templates for toner notifications
   - Include order details, shipping info, tracking links
   - Add company branding and logos

2. **SMS Message Customization**
   - Allow tenants to customize SMS message format
   - Add opt-out links for SMS notifications
   - Track SMS delivery status

3. **Auto-Reorder Logic**
   - Automatically submit urgent orders when toner drops below 10%
   - Send approval requests for contract-covered orders
   - Add customer preferences for auto-ordering

4. **Order Tracking**
   - Add tracking number to supply orders
   - Integrate with shipping carriers (FedEx, UPS, USPS)
   - Send delivery notifications

### Medium-Term (Next Quarter)
1. **Analytics Dashboard**
   - Toner consumption trends by device/customer
   - Cost savings from contract coverage
   - Inventory turnover rates
   - Notification delivery rates

2. **Supplier Integration**
   - Auto-purchase from suppliers when inventory low
   - Real-time pricing updates
   - Automatic PO generation

3. **Customer Self-Service**
   - Customer portal to view past toner orders
   - Customer-initiated toner requests
   - Order history and invoicing

4. **Machine Learning**
   - Predict toner depletion dates
   - Optimize reorder points
   - Identify abnormal consumption patterns

### Long-Term (Future Roadmap)
1. **Multi-Warehouse Support**
   - Route orders to nearest warehouse
   - Transfer inventory between warehouses
   - Regional pricing

2. **Subscription Model**
   - Monthly toner subscription plans
   - Automatic replenishment
   - Usage-based pricing

3. **OEM Integration**
   - Direct integration with HP, Canon, Xerox
   - OEM-specific toner recommendations
   - Warranty validation

---

## 📞 Support & Contacts

### Development Team
- **Primary Developer:** Claude (AI Assistant)
- **Repository:** `dj-pearson/Printyx`
- **Branch:** `claude/fm-audit-client-011CUthx8J8LarHPYzpfPbZT`

### External Services to Configure
- **Email Provider:** SendGrid / AWS SES / Resend
- **SMS Provider:** Twilio / AWS SNS
- **Support:** Refer to provider documentation for API setup

### Deployment Questions
- Review commit messages for detailed implementation notes
- Check server logs for `[TONER LOOKUP]`, `[SERVICE CONTRACT]`, `[NOTIFICATION]` prefixes
- Database queries use standard Drizzle ORM patterns

---

## 📝 Change Log

### 2025-11-07 (Initial Implementation)
- ✅ Added navigation routing for Fleet Monitoring Dashboard
- ✅ Implemented product catalog integration with supplies table
- ✅ Added warehouse inventory checking with stock availability
- ✅ Implemented service contract validation for toner coverage
- ✅ Created email/SMS notification framework (ready for external services)
- ✅ Updated toner order endpoint to use all integrations
- ✅ Added comprehensive logging for debugging
- ✅ Graceful fallbacks for missing data

### 2025-11-07 (Notification Delivery Improvements)
- ✅ Created provider-agnostic notification adapter system
  - `server/services/email-service.ts` - Email service with provider support (SendGrid, AWS SES, Resend)
  - `server/services/sms-service.ts` - SMS service with provider support (Twilio, AWS SNS)
  - Simulation mode for testing without external service credentials
- ✅ Fixed critical notification delivery tracking bug
  - Notifications now only marked as sent when provider reports `success: true`
  - Previous implementation marked as sent even on failure
  - Database updates are conditional based on actual delivery success
- ✅ Added notification delivery status to API response
  - API response now includes `notifications: { emailSent, smsSent }`
  - Clients can verify if customer was successfully notified
  - Non-blocking design: order succeeds even if notifications fail
- ✅ Environment variable configuration for notification services
  - `EMAIL_ENABLED="true"` - Required for email delivery (simulation mode reports success when true)
  - `SMS_ENABLED="true"` - Required for SMS delivery (simulation mode reports success when true)
  - `EMAIL_PROVIDER="sendgrid|ses|resend|simulation"` - Choose email provider
  - `SMS_PROVIDER="twilio|sns|simulation"` - Choose SMS provider
- ✅ Created comprehensive seed script for toner workflow
  - `server/seed-toner-workflow.ts` - Populates 15 toner products + inventory
  - Supports HP, Canon, Xerox, and Ricoh manufacturers
  - Realistic pricing and stock levels
  - Idempotent (can run multiple times safely)
- ✅ Database schema fixes via direct SQL
  - Added `phone` field to `customer_portal_access` (E.164 format for SMS)
  - Added warehouse fields to `inventory_items` (warehouse_location, bin_location)

---

## ⚠️ Known Schema Mismatches (For Future Resolution)

During testing, the following schema mismatches were discovered between the Drizzle TypeScript schema and the actual PostgreSQL database:

### 1. `device_registrations` Table
**Drizzle Schema Expects:**
- `ipAddress`, `macAddress`, `department`, `capabilities`, `registeredAt`

**Actual Database Has:**
- `installation_date`, `created_at`, `updated_at`
- Missing: `ipAddress`, `macAddress`, `department`, `capabilities`, `registeredAt`

**Impact:** LOW - The toner order endpoint works with existing columns
**Resolution:** Run `npm run db:push --force` to sync schema when ready

### 2. `device_metrics` Table
**Drizzle Schema Expects:**
- `collectionTimestamp`, `totalImpressions`, `bwImpressions`, `colorImpressions`
- `tonerLevels` (JSONB), `paperLevels` (JSONB), `errorCodes`, `rawData`
- Rich metric structure

**Actual Database Has:**
- `metric_type`, `metric_value`, `collected_at`
- Simplified key-value pair structure

**Impact:** MEDIUM - Toner order endpoint gracefully handles missing metrics
**Resolution:** Decide on metric storage strategy:
  - Option A: Migrate to rich schema (run `npm run db:push --force`)
  - Option B: Keep simplified schema and update Drizzle schema to match
  - Option C: Hybrid approach with metric type mapping

### 3. Recommendation
**Do NOT run schema migration during toner order deployment** - The current implementation works with existing schema via graceful fallbacks. Schedule schema migration separately after reviewing impact.

---

## 🔧 Notification Service Configuration

### Quick Start (Simulation Mode)
For testing without external services:
```bash
# .env
EMAIL_ENABLED="true"
SMS_ENABLED="true"
EMAIL_PROVIDER="simulation"
SMS_PROVIDER="simulation"
```

This configuration allows the notification flow to be tested without actually sending emails/SMS. The API response will show `emailSent: true` and `smsSent: true` when simulation is enabled.

### Production Setup (External Services)

#### Option 1: SendGrid + Twilio
```bash
# .env
EMAIL_ENABLED="true"
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="SG.xxxxxxxxxxxxx"
SENDGRID_FROM_EMAIL="notifications@printyx.com"
SENDGRID_FROM_NAME="Printyx Notifications"

SMS_ENABLED="true"
SMS_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER="+15551234567"
```

#### Option 2: AWS SES + AWS SNS
```bash
# .env
EMAIL_ENABLED="true"
EMAIL_PROVIDER="ses"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIAxxxxxxxxxxxxx"
AWS_SECRET_ACCESS_KEY="xxxxxxxxxxxxxxxx"
AWS_SES_FROM_EMAIL="notifications@printyx.com"

SMS_ENABLED="true"
SMS_PROVIDER="sns"
# Uses same AWS credentials as SES
AWS_SNS_SENDER_ID="Printyx"
```

#### Option 3: Resend + Twilio
```bash
# .env
EMAIL_ENABLED="true"
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_xxxxxxxxxxxxx"
RESEND_FROM_EMAIL="notifications@printyx.com"

SMS_ENABLED="true"
SMS_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER="+15551234567"
```

### Notification Delivery Verification

After configuring services, verify delivery:

```bash
# Check notification delivery status in database
SELECT 
  id,
  title,
  message,
  is_email_sent,
  email_sent_at,
  is_sms_sent,
  sms_sent_at,
  created_at
FROM customer_notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Testing Notification Flow

1. **Run seed script to populate test data:**
   ```bash
   npx tsx server/seed-toner-workflow.ts
   ```

2. **Set environment variables for simulation mode:**
   ```bash
   EMAIL_ENABLED="true"
   SMS_ENABLED="true"
   EMAIL_PROVIDER="simulation"
   SMS_PROVIDER="simulation"
   ```

3. **Create a test toner order via API or UI**
   - The API response will include `notifications: { emailSent: true, smsSent: true }`
   - Check server logs for `[EMAIL SIMULATION]` and `[SMS SIMULATION]` messages

4. **Verify in database:**
   - `customer_notifications.is_email_sent` should be `true`
   - `customer_notifications.is_sms_sent` should be `true`

---

## ✨ Summary

**Ready to Deploy:** YES
**Database Migrations Required:** NO (schema mismatches can be resolved separately)
**Breaking Changes:** NO
**Data Population Required:** YES (use seed script: `npx tsx server/seed-toner-workflow.ts`)
**External Services Required:** NO (simulation mode available for testing)

**Key Benefits:**
- Real product catalog pricing instead of placeholders
- Real-time warehouse inventory availability
- Automatic $0.00 pricing for contract-covered toner
- Production-ready notification system with multiple provider support
- Complete audit trail in database with delivery confirmation
- Graceful fallbacks for missing data
- API responses include notification delivery status
- Simulation mode for safe testing

**Risk Level:** LOW
- No destructive schema changes required
- Backward compatible with existing data
- Fails gracefully if data not populated or services not configured
- Can deploy immediately and populate data incrementally
- Notifications supplementary to workflow (orders succeed even if notifications fail)
