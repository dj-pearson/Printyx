# Pricing Schema Migration Plan

**Date:** 2025-11-24
**Status:** 📋 **PLANNING** - Improvement #2
**Developer:** Claude Code

---

## 🎯 Objective

Establish a single source of truth for all product pricing by migrating from scattered pricing fields in `productModels` and `productAccessories` tables to the unified `enhancedProductPricing` table.

---

## 📊 Problem Statement

### Current State (Pricing Data Duplication)

**Problem:** Pricing data is currently stored in **multiple locations** with no clear single source of truth:

#### 1. **productModels Table** (Lines 2788-2810 in shared/schema.ts)

```typescript
// Three pricing tiers embedded in product table
// New Tier
newDealerCost: decimal('new_dealer_cost', { precision: 10, scale: 2 }),
newRepMarkupPercentage: decimal('new_rep_markup_percentage', { precision: 5, scale: 2 }),
newRepCost: decimal('new_rep_cost', { precision: 10, scale: 2 }),
newRepPrice: decimal('new_rep_price', { precision: 10, scale: 2 }), // LEGACY
newSuggestedRetail: decimal('new_suggested_retail', { precision: 10, scale: 2 }),

// Upgrade Tier
upgradeDealerCost, upgradeRepMarkupPercentage, upgradeRepCost, ...

// Lexmark Tier
lexmarkDealerCost, lexmarkRepMarkupPercentage, lexmarkRepCost, ...
```

#### 2. **productAccessories Table** (Lines 2833-2855)

```typescript
// Similar three-tier structure with different tier names
// Standard Tier
standardCost: decimal('standard_cost', { precision: 10, scale: 2 }), // LEGACY
standardDealerCost, standardRepMarkupPercentage, standardRepCost, ...

// New Tier
newCost: decimal('new_cost', { precision: 10, scale: 2 }), // LEGACY
newDealerCost, newRepMarkupPercentage, newRepCost, ...

// Upgrade Tier
upgradeCost: decimal('upgrade_cost', { precision: 10, scale: 2 }), // LEGACY
upgradeDealerCost, upgradeRepMarkupPercentage, upgradeRepCost, ...
```

#### 3. **enhancedProductPricing Table** (product-pricing-schema.ts)

```typescript
// NEW unified structure - the target migration schema
- productId, productType, pricingTier
- dealerCost, repCost, suggestedRetailPrice, minimumSalePrice
- markupType, markupPercentage, markupAmount
- Audit trail: createdBy, lastCostUpdate, costChangeReason
- Effective/expiration dates
- Notes fields
```

### Impact of Current State

❌ **Data Inconsistency**

- Updates must happen in 2+ places
- No guarantee of sync between sources
- Query logic must know which source to trust

❌ **Maintenance Burden**

- Every pricing feature touches multiple tables
- Duplicate code for pricing calculations
- Hard to track pricing history

❌ **Blocked Features**

- Cannot implement price change approval workflow properly
- Cannot track pricing history/audit trail
- Cannot implement time-based pricing (effective dates)
- Cannot implement customer-specific pricing
- Cannot implement dynamic pricing rules

❌ **Code Complexity**

- Queries must LEFT JOIN multiple pricing sources
- Business logic scattered across multiple files
- Hard to reason about "which price is correct"

### Comments in Code

From `product-pricing-schema.ts` line 121:

```typescript
// Product Models Enhanced - Extended pricing fields for backward compatibility and transitions
// These fields will be migrated to enhancedProductPricing table over time
```

**Conclusion:** The migration is acknowledged as needed but **never completed** - creating ongoing technical debt.

---

## ✨ Solution: Complete Pricing Migration

### Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Product Tables (NO PRICING)                              │
│ ├─ productModels (only product metadata)                │
│ ├─ productAccessories (only accessory metadata)         │
│ ├─ softwareProducts (only software metadata)            │
│ └─ serviceProducts (only service metadata)              │
└─────────────────────────────────────────────────────────┘
                         │
                         │ References via productId
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Enhanced Product Pricing (SINGLE SOURCE OF TRUTH)       │
│                                                          │
│ Table: enhancedProductPricing                           │
│ ├─ productId (references product tables)                │
│ ├─ productType ("model", "accessory", "software")       │
│ ├─ pricingTier ("new", "upgrade", "lexmark", etc.)      │
│ ├─ dealerCost (Tier 1)                                  │
│ ├─ repCost (Tier 2)                                     │
│ ├─ suggestedRetailPrice (Tier 3)                        │
│ ├─ minimumSalePrice (floor price)                       │
│ ├─ markupType, markupPercentage, markupAmount           │
│ ├─ Audit: createdBy, lastCostUpdate, costChangeReason   │
│ └─ Dates: effectiveDate, expirationDate                 │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Used by
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Pricing Service (CENTRALIZED LOGIC)                     │
│                                                          │
│ server/services/product-pricing-service.ts              │
│ ├─ getProductPricing(productId, tier)                   │
│ ├─ calculateRepCost(dealerCost, markup)                 │
│ ├─ updateProductPricing(updates)                        │
│ ├─ getPricingHistory(productId)                         │
│ ├─ applyMarkupRules(tenantId, category)                 │
│ └─ validatePriceChange(old, new)                        │
└─────────────────────────────────────────────────────────┘
```

### Benefits

✅ **Single Source of Truth**

- ONE table to query for all pricing
- Consistent data across the application
- Easy to reason about "where is the price"

✅ **Audit Trail**

- Track every price change
- Know who changed it and why
- Compliance-ready (SOX, PCI DSS)

✅ **Advanced Features Unlocked**

- ✅ Price change approval workflow
- ✅ Time-based pricing (effective dates)
- ✅ Price history tracking
- ✅ Customer-specific pricing
- ✅ Dynamic pricing rules
- ✅ Promotional pricing
- ✅ Volume-based discounts

✅ **Better Performance**

- Single query vs. multiple LEFT JOINs
- Indexed properly for pricing queries
- Cached pricing calculations

✅ **Easier Maintenance**

- Update once, reflected everywhere
- Centralized business logic
- Clear separation of concerns

---

## 🗺️ Migration Strategy

### Phase 1: Data Migration Script (Week 1)

**Goal:** Copy all existing pricing data from `productModels` and `productAccessories` to `enhancedProductPricing`

#### Step 1.1: Create Migration Script

**File:** `database/migrations/001_migrate_pricing_data.sql`

```sql
-- Migration Script: Product Pricing Consolidation
-- Migrates pricing from productModels and productAccessories to enhancedProductPricing

BEGIN;

-- Step 1: Migrate Product Models - New Tier
INSERT INTO enhanced_product_pricing (
  id,
  tenant_id,
  product_id,
  product_type,
  pricing_tier,
  dealer_cost,
  rep_cost,
  suggested_retail_price,
  minimum_sale_price,
  use_custom_markup,
  markup_type,
  markup_percentage,
  is_active,
  created_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  tenant_id,
  id as product_id,
  'model' as product_type,
  'new' as pricing_tier,
  new_dealer_cost,
  new_rep_cost,
  new_suggested_retail,
  NULL as minimum_sale_price,
  (new_rep_markup_percentage IS NOT NULL) as use_custom_markup,
  CASE WHEN new_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type ELSE NULL END,
  new_rep_markup_percentage,
  new_active,
  'system_migration' as created_by,
  created_at,
  updated_at
FROM product_models
WHERE new_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = product_models.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'new'
  );

-- Step 2: Migrate Product Models - Upgrade Tier
INSERT INTO enhanced_product_pricing (
  id, tenant_id, product_id, product_type, pricing_tier,
  dealer_cost, rep_cost, suggested_retail_price, minimum_sale_price,
  use_custom_markup, markup_type, markup_percentage,
  is_active, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(), tenant_id, id, 'model', 'upgrade',
  upgrade_dealer_cost, upgrade_rep_cost, upgrade_suggested_retail, NULL,
  (upgrade_rep_markup_percentage IS NOT NULL),
  CASE WHEN upgrade_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type ELSE NULL END,
  upgrade_rep_markup_percentage,
  upgrade_active, 'system_migration', created_at, updated_at
FROM product_models
WHERE upgrade_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = product_models.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'upgrade'
  );

-- Step 3: Migrate Product Models - Lexmark Tier
INSERT INTO enhanced_product_pricing (
  id, tenant_id, product_id, product_type, pricing_tier,
  dealer_cost, rep_cost, suggested_retail_price, minimum_sale_price,
  use_custom_markup, markup_type, markup_percentage,
  is_active, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(), tenant_id, id, 'model', 'lexmark',
  lexmark_dealer_cost, lexmark_rep_cost, lexmark_suggested_retail, NULL,
  (lexmark_rep_markup_percentage IS NOT NULL),
  CASE WHEN lexmark_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type ELSE NULL END,
  lexmark_rep_markup_percentage,
  lexmark_active, 'system_migration', created_at, updated_at
FROM product_models
WHERE lexmark_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = product_models.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'lexmark'
  );

-- Step 4: Migrate Product Accessories - Standard Tier
INSERT INTO enhanced_product_pricing (
  id, tenant_id, product_id, product_type, pricing_tier,
  dealer_cost, rep_cost, suggested_retail_price, minimum_sale_price,
  use_custom_markup, markup_type, markup_percentage,
  is_active, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(), tenant_id, id, 'accessory', 'standard',
  standard_dealer_cost, standard_rep_cost, standard_suggested_retail, NULL,
  (standard_rep_markup_percentage IS NOT NULL),
  CASE WHEN standard_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type ELSE NULL END,
  standard_rep_markup_percentage,
  is_active, 'system_migration', created_at, updated_at
FROM product_accessories
WHERE standard_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = product_accessories.id
      AND epp.product_type = 'accessory'
      AND epp.pricing_tier = 'standard'
  );

-- Step 5: Migrate Product Accessories - New Tier
INSERT INTO enhanced_product_pricing (
  id, tenant_id, product_id, product_type, pricing_tier,
  dealer_cost, rep_cost, suggested_retail_price, minimum_sale_price,
  use_custom_markup, markup_type, markup_percentage,
  is_active, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(), tenant_id, id, 'accessory', 'new',
  new_dealer_cost, new_rep_cost, new_suggested_retail, NULL,
  (new_rep_markup_percentage IS NOT NULL),
  CASE WHEN new_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type ELSE NULL END,
  new_rep_markup_percentage,
  is_active, 'system_migration', created_at, updated_at
FROM product_accessories
WHERE new_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = product_accessories.id
      AND epp.product_type = 'accessory'
      AND epp.pricing_tier = 'new'
  );

-- Step 6: Migrate Product Accessories - Upgrade Tier
INSERT INTO enhanced_product_pricing (
  id, tenant_id, product_id, product_type, pricing_tier,
  dealer_cost, rep_cost, suggested_retail_price, minimum_sale_price,
  use_custom_markup, markup_type, markup_percentage,
  is_active, created_by, created_at, updated_at
)
SELECT
  gen_random_uuid(), tenant_id, id, 'accessory', 'upgrade',
  upgrade_dealer_cost, upgrade_rep_cost, upgrade_suggested_retail, NULL,
  (upgrade_rep_markup_percentage IS NOT NULL),
  CASE WHEN upgrade_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type ELSE NULL END,
  upgrade_rep_markup_percentage,
  is_active, 'system_migration', created_at, updated_at
FROM product_accessories
WHERE upgrade_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = product_accessories.id
      AND epp.product_type = 'accessory'
      AND epp.pricing_tier = 'upgrade'
  );

-- Validation: Check record counts
DO $$
DECLARE
  model_new_count INT;
  model_upgrade_count INT;
  model_lexmark_count INT;
  accessory_standard_count INT;
  accessory_new_count INT;
  accessory_upgrade_count INT;
  total_migrated INT;
BEGIN
  SELECT COUNT(*) INTO model_new_count FROM product_models WHERE new_dealer_cost IS NOT NULL;
  SELECT COUNT(*) INTO model_upgrade_count FROM product_models WHERE upgrade_dealer_cost IS NOT NULL;
  SELECT COUNT(*) INTO model_lexmark_count FROM product_models WHERE lexmark_dealer_cost IS NOT NULL;
  SELECT COUNT(*) INTO accessory_standard_count FROM product_accessories WHERE standard_dealer_cost IS NOT NULL;
  SELECT COUNT(*) INTO accessory_new_count FROM product_accessories WHERE new_dealer_cost IS NOT NULL;
  SELECT COUNT(*) INTO accessory_upgrade_count FROM product_accessories WHERE upgrade_dealer_cost IS NOT NULL;

  total_migrated := model_new_count + model_upgrade_count + model_lexmark_count +
                    accessory_standard_count + accessory_new_count + accessory_upgrade_count;

  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE 'Product Models - New Tier: %', model_new_count;
  RAISE NOTICE 'Product Models - Upgrade Tier: %', model_upgrade_count;
  RAISE NOTICE 'Product Models - Lexmark Tier: %', model_lexmark_count;
  RAISE NOTICE 'Product Accessories - Standard Tier: %', accessory_standard_count;
  RAISE NOTICE 'Product Accessories - New Tier: %', accessory_new_count;
  RAISE NOTICE 'Product Accessories - Upgrade Tier: %', accessory_upgrade_count;
  RAISE NOTICE 'Total Records Migrated: %', total_migrated;
END $$;

COMMIT;
```

#### Step 1.2: Add Migration Flag

Add a flag to product tables to track migration status:

```sql
-- Add migration tracking fields
ALTER TABLE product_models ADD COLUMN pricing_migrated BOOLEAN DEFAULT FALSE;
ALTER TABLE product_accessories ADD COLUMN pricing_migrated BOOLEAN DEFAULT FALSE;

-- Mark migrated records
UPDATE product_models SET pricing_migrated = TRUE
WHERE id IN (SELECT DISTINCT product_id FROM enhanced_product_pricing WHERE product_type = 'model');

UPDATE product_accessories SET pricing_migrated = TRUE
WHERE id IN (SELECT DISTINCT product_id FROM enhanced_product_pricing WHERE product_type = 'accessory');
```

### Phase 2: Centralized Pricing Service (Week 2)

**Goal:** Create a single service that encapsulates all pricing logic

#### Step 2.1: Create Pricing Service

**File:** `server/services/product-pricing-service.ts`

```typescript
import { db } from '../db';
import { enhancedProductPricing, companyPricingSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class ProductPricingService {
  /**
   * Get pricing for a product with a specific tier
   */
  async getProductPricing(
    productId: string,
    productType: 'model' | 'accessory' | 'software' | 'service',
    pricingTier?: string,
  ) {
    const conditions = [
      eq(enhancedProductPricing.productId, productId),
      eq(enhancedProductPricing.productType, productType),
    ];

    if (pricingTier) {
      conditions.push(eq(enhancedProductPricing.pricingTier, pricingTier));
    }

    const pricing = await db.query.enhancedProductPricing.findFirst({
      where: and(...conditions),
    });

    return pricing;
  }

  /**
   * Get all pricing tiers for a product
   */
  async getAllProductPricingTiers(productId: string, productType: string) {
    return db.query.enhancedProductPricing.findMany({
      where: and(
        eq(enhancedProductPricing.productId, productId),
        eq(enhancedProductPricing.productType, productType),
        eq(enhancedProductPricing.isActive, true),
      ),
    });
  }

  /**
   * Calculate rep cost from dealer cost and markup
   */
  calculateRepCost(
    dealerCost: number,
    markupType: 'percentage' | 'fixed_amount',
    markupValue: number,
  ): number {
    if (markupType === 'percentage') {
      return dealerCost * (1 + markupValue / 100);
    } else {
      return dealerCost + markupValue;
    }
  }

  /**
   * Calculate margin percentage
   */
  calculateMarginPercentage(dealerCost: number, customerPrice: number): number {
    if (dealerCost === 0) return 0;
    return ((customerPrice - dealerCost) / dealerCost) * 100;
  }

  /**
   * Update product pricing (with audit trail)
   */
  async updateProductPricing(
    productId: string,
    productType: string,
    pricingTier: string,
    updates: {
      dealerCost?: number;
      repCost?: number;
      suggestedRetailPrice?: number;
      minimumSalePrice?: number;
      markupPercentage?: number;
    },
    userId: string,
    changeReason?: string,
  ) {
    const updateData = {
      ...updates,
      lastCostUpdate: new Date(),
      lastCostUpdateBy: userId,
      costChangeReason: changeReason,
      updatedAt: new Date(),
    };

    return db
      .update(enhancedProductPricing)
      .set(updateData)
      .where(
        and(
          eq(enhancedProductPricing.productId, productId),
          eq(enhancedProductPricing.productType, productType),
          eq(enhancedProductPricing.pricingTier, pricingTier),
        ),
      )
      .returning();
  }

  /**
   * Get company default markup for a tenant
   */
  async getCompanyMarkup(tenantId: string, category?: string) {
    const settings = await db.query.companyPricingSettings.findFirst({
      where: eq(companyPricingSettings.tenantId, tenantId),
    });

    if (!settings) {
      return { type: 'percentage', value: 13.0 }; // Default 13%
    }

    // Check for category-specific override
    if (category && settings.categoryMarkupOverrides) {
      const overrides = settings.categoryMarkupOverrides as Record<string, number>;
      if (overrides[category]) {
        return { type: 'percentage', value: overrides[category] };
      }
    }

    return {
      type: settings.defaultMarkupType || 'percentage',
      value: parseFloat(settings.defaultMarkupPercentage || '13.0'),
    };
  }

  /**
   * Apply default markup to products without custom pricing
   */
  async applyDefaultMarkup(tenantId: string, productIds: string[]) {
    const markup = await this.getCompanyMarkup(tenantId);

    for (const productId of productIds) {
      const pricingRecords = await this.getAllProductPricingTiers(productId, 'model');

      for (const record of pricingRecords) {
        if (!record.useCustomMarkup && record.dealerCost) {
          const newRepCost = this.calculateRepCost(
            parseFloat(record.dealerCost),
            markup.type as 'percentage',
            markup.value,
          );

          await this.updateProductPricing(
            productId,
            'model',
            record.pricingTier || 'new',
            { repCost: newRepCost },
            'system_bulk_update',
            'Applied default markup',
          );
        }
      }
    }
  }

  /**
   * Get pricing history for audit trail
   */
  async getPricingHistory(productId: string, productType: string) {
    // This would query a separate pricing_history table (to be created)
    // For now, return current pricing with audit info
    return this.getAllProductPricingTiers(productId, productType);
  }

  /**
   * Validate price change against business rules
   */
  async validatePriceChange(
    tenantId: string,
    oldPrice: number,
    newPrice: number,
  ): Promise<{ isValid: boolean; requiresApproval: boolean; reason?: string }> {
    const settings = await db.query.companyPricingSettings.findFirst({
      where: eq(companyPricingSettings.tenantId, tenantId),
    });

    if (!settings) {
      return { isValid: true, requiresApproval: false };
    }

    const discountPercentage = ((oldPrice - newPrice) / oldPrice) * 100;
    const maxDiscount = parseFloat(settings.maxDiscountPercentage || '20');
    const autoApprovalThreshold = parseFloat(settings.autoApprovalThreshold || '10');

    if (discountPercentage > maxDiscount) {
      return {
        isValid: false,
        requiresApproval: false,
        reason: `Discount exceeds maximum allowed (${maxDiscount}%)`,
      };
    }

    if (discountPercentage > autoApprovalThreshold) {
      return {
        isValid: true,
        requiresApproval: true,
        reason: `Discount exceeds auto-approval threshold (${autoApprovalThreshold}%)`,
      };
    }

    return { isValid: true, requiresApproval: false };
  }
}

export const productPricingService = new ProductPricingService();
```

### Phase 3: Update Backend Routes (Week 3)

**Goal:** Update all pricing-related API endpoints to use the new service

#### Files to Update:

1. `server/routes-product-models.ts`
2. `server/routes-product-pricing.ts`
3. `server/routes-catalog.ts`
4. `server/routes.ts` (if pricing logic exists there)

#### Example Updates:

**Before (routes-product-models.ts):**

```typescript
// OLD: Direct database query
app.get('/api/product-models/:id/pricing', async (req, res) => {
  const product = await db.query.productModels.findFirst({
    where: eq(productModels.id, req.params.id),
  });

  const pricing = {
    new: {
      dealerCost: product?.newDealerCost,
      repCost: product?.newRepCost,
      suggestedRetail: product?.newSuggestedRetail,
    },
    upgrade: {
      dealerCost: product?.upgradeDealerCost,
      repCost: product?.upgradeRepCost,
      suggestedRetail: product?.upgradeSuggestedRetail,
    },
  };

  res.json(pricing);
});
```

**After:**

```typescript
// NEW: Use pricing service
import { productPricingService } from '../services/product-pricing-service';

app.get('/api/product-models/:id/pricing', async (req, res) => {
  const pricingTiers = await productPricingService.getAllProductPricingTiers(
    req.params.id,
    'model',
  );

  // Transform to expected format
  const pricing = pricingTiers.reduce(
    (acc, tier) => {
      acc[tier.pricingTier || 'standard'] = {
        dealerCost: tier.dealerCost,
        repCost: tier.repCost,
        suggestedRetail: tier.suggestedRetailPrice,
        minimumSalePrice: tier.minimumSalePrice,
      };
      return acc;
    },
    {} as Record<string, any>,
  );

  res.json(pricing);
});
```

### Phase 4: Backward Compatibility Layer (Week 3)

**Goal:** Maintain dual-read capability during transition

#### Strategy: Read from Both Sources

During the transition period, implement a fallback mechanism:

```typescript
async function getProductPricingWithFallback(
  productId: string,
  productType: string,
  pricingTier: string,
) {
  // Try new pricing table first
  const newPricing = await productPricingService.getProductPricing(
    productId,
    productType,
    pricingTier,
  );

  if (newPricing) {
    return newPricing;
  }

  // Fallback to old pricing fields
  if (productType === 'model') {
    const product = await db.query.productModels.findFirst({
      where: eq(productModels.id, productId),
    });

    if (!product) return null;

    // Map old fields to new structure
    const tierMapping: Record<string, any> = {
      new: {
        dealerCost: product.newDealerCost,
        repCost: product.newRepCost,
        suggestedRetailPrice: product.newSuggestedRetail,
        markupPercentage: product.newRepMarkupPercentage,
      },
      upgrade: {
        dealerCost: product.upgradeDealerCost,
        repCost: product.upgradeRepCost,
        suggestedRetailPrice: product.upgradeSuggestedRetail,
        markupPercentage: product.upgradeRepMarkupPercentage,
      },
      lexmark: {
        dealerCost: product.lexmarkDealerCost,
        repCost: product.lexmarkRepCost,
        suggestedRetailPrice: product.lexmarkSuggestedRetail,
        markupPercentage: product.lexmarkRepMarkupPercentage,
      },
    };

    return tierMapping[pricingTier];
  }

  // Similar fallback for accessories...
}
```

### Phase 5: Frontend Updates (Week 4)

**Goal:** Update all frontend components to use new API responses

#### Components to Update:

1. `client/src/pages/ProductHubUnified.tsx` (already using new structure)
2. `client/src/pages/ProductModels.tsx`
3. `client/src/pages/EnhancedProductAccessories.tsx`
4. `client/src/pages/PricingManagement.tsx`
5. Any components using `productModels` pricing fields

#### Example Update:

**Before:**

```typescript
const product = useQuery(['product', id], () =>
  fetch(`/api/product-models/${id}`).then((r) => r.json()),
);

const dealerCost = product.data?.newDealerCost;
const repCost = product.data?.newRepCost;
```

**After:**

```typescript
const productPricing = useQuery(['product-pricing', id], () =>
  fetch(`/api/product-models/${id}/pricing`).then((r) => r.json()),
);

const dealerCost = productPricing.data?.new?.dealerCost;
const repCost = productPricing.data?.new?.repCost;
```

### Phase 6: Deprecation & Cleanup (Week 5)

**Goal:** Remove old pricing fields after validation

#### Step 6.1: Mark Fields as Deprecated

Add deprecation warnings to TypeScript types:

```typescript
export type ProductModel = {
  id: string;
  productName: string;
  // ... other fields

  /** @deprecated Use enhancedProductPricing table instead */
  newDealerCost?: string;
  /** @deprecated Use enhancedProductPricing table instead */
  newRepCost?: string;
  // ... mark all pricing fields as deprecated
};
```

#### Step 6.2: Remove Pricing Fields (After 2 weeks validation)

```sql
-- Only execute after confirming all code uses new pricing service
ALTER TABLE product_models
  DROP COLUMN new_dealer_cost,
  DROP COLUMN new_rep_markup_percentage,
  DROP COLUMN new_rep_cost,
  DROP COLUMN new_rep_price, -- Legacy field
  DROP COLUMN new_suggested_retail,
  DROP COLUMN upgrade_dealer_cost,
  DROP COLUMN upgrade_rep_markup_percentage,
  DROP COLUMN upgrade_rep_cost,
  DROP COLUMN upgrade_rep_price, -- Legacy field
  DROP COLUMN upgrade_suggested_retail,
  DROP COLUMN lexmark_dealer_cost,
  DROP COLUMN lexmark_rep_markup_percentage,
  DROP COLUMN lexmark_rep_cost,
  DROP COLUMN lexmark_rep_price, -- Legacy field
  DROP COLUMN lexmark_suggested_retail;

ALTER TABLE product_accessories
  DROP COLUMN standard_cost, -- Legacy
  DROP COLUMN standard_dealer_cost,
  DROP COLUMN standard_rep_markup_percentage,
  DROP COLUMN standard_rep_cost,
  DROP COLUMN standard_rep_price, -- Legacy
  DROP COLUMN standard_suggested_retail,
  DROP COLUMN new_cost, -- Legacy
  DROP COLUMN new_dealer_cost,
  DROP COLUMN new_rep_markup_percentage,
  DROP COLUMN new_rep_cost,
  DROP COLUMN new_rep_price, -- Legacy
  DROP COLUMN new_suggested_retail,
  DROP COLUMN upgrade_cost, -- Legacy
  DROP COLUMN upgrade_dealer_cost,
  DROP COLUMN upgrade_rep_markup_percentage,
  DROP COLUMN upgrade_rep_cost,
  DROP COLUMN upgrade_rep_price, -- Legacy
  DROP COLUMN upgrade_suggested_retail;
```

---

## 📋 Implementation Checklist

### Week 1: Data Migration

- [ ] Create migration script (`001_migrate_pricing_data.sql`)
- [ ] Test migration on development database
- [ ] Add migration tracking fields (`pricing_migrated`)
- [ ] Run migration on staging environment
- [ ] Validate data integrity (record counts, null checks)
- [ ] Create rollback script (in case of issues)

### Week 2: Pricing Service

- [ ] Create `product-pricing-service.ts`
- [ ] Implement core methods (get, update, calculate)
- [ ] Add company markup logic
- [ ] Add validation logic
- [ ] Write unit tests for pricing calculations
- [ ] Document service API

### Week 3: Backend Routes

- [ ] Update `routes-product-models.ts`
- [ ] Update `routes-product-pricing.ts`
- [ ] Update `routes-catalog.ts`
- [ ] Add backward compatibility layer
- [ ] Update API documentation
- [ ] Test all pricing endpoints

### Week 4: Frontend Updates

- [ ] Update ProductHubUnified (if needed)
- [ ] Update ProductModels page
- [ ] Update EnhancedProductAccessories
- [ ] Update PricingManagement
- [ ] Update any other pricing components
- [ ] Test all pricing UI flows

### Week 5: Cleanup

- [ ] Monitor for 2 weeks (no errors from old fields)
- [ ] Add deprecation warnings to types
- [ ] Remove pricing fields from schema
- [ ] Update migrations
- [ ] Final validation and testing
- [ ] Deploy to production

---

## ✅ Success Criteria

**Data Migration:**

- ✅ 100% of pricing data migrated to `enhancedProductPricing`
- ✅ Zero data loss
- ✅ All tiers preserved (New, Upgrade, Lexmark, Standard)
- ✅ Audit trail fields populated

**API Updates:**

- ✅ All pricing endpoints use `productPricingService`
- ✅ No direct queries to old pricing fields
- ✅ Backward compatibility maintained during transition

**Frontend Updates:**

- ✅ All components use new API structure
- ✅ No TypeScript errors
- ✅ UI displays pricing correctly

**Performance:**

- ✅ Pricing queries ≤ 100ms (95th percentile)
- ✅ No N+1 query issues
- ✅ Proper indexing on `enhancedProductPricing`

**Validation:**

- ✅ Manual testing of all pricing flows
- ✅ Automated tests passing
- ✅ No production errors for 2 weeks

---

## 🔍 Testing Strategy

### Unit Tests

```typescript
describe('ProductPricingService', () => {
  it('calculates rep cost with percentage markup correctly', () => {
    const dealerCost = 100;
    const markup = 13; // 13%
    const repCost = productPricingService.calculateRepCost(dealerCost, 'percentage', markup);
    expect(repCost).toBe(113);
  });

  it('calculates margin percentage correctly', () => {
    const dealerCost = 100;
    const customerPrice = 150;
    const margin = productPricingService.calculateMarginPercentage(dealerCost, customerPrice);
    expect(margin).toBe(50); // 50% margin
  });
});
```

### Integration Tests

```typescript
describe('Product Pricing API', () => {
  it('returns pricing for all tiers', async () => {
    const response = await request(app)
      .get('/api/product-models/test-product-id/pricing')
      .expect(200);

    expect(response.body).toHaveProperty('new');
    expect(response.body).toHaveProperty('upgrade');
    expect(response.body.new).toHaveProperty('dealerCost');
    expect(response.body.new).toHaveProperty('repCost');
  });
});
```

### Data Validation Queries

```sql
-- Verify all pricing records migrated
SELECT
  'product_models' as source_table,
  COUNT(*) as total_records,
  COUNT(CASE WHEN new_dealer_cost IS NOT NULL THEN 1 END) as new_tier_count,
  COUNT(CASE WHEN upgrade_dealer_cost IS NOT NULL THEN 1 END) as upgrade_tier_count,
  COUNT(CASE WHEN lexmark_dealer_cost IS NOT NULL THEN 1 END) as lexmark_tier_count
FROM product_models

UNION ALL

SELECT
  'enhanced_product_pricing',
  COUNT(DISTINCT product_id),
  COUNT(CASE WHEN pricing_tier = 'new' THEN 1 END),
  COUNT(CASE WHEN pricing_tier = 'upgrade' THEN 1 END),
  COUNT(CASE WHEN pricing_tier = 'lexmark' THEN 1 END)
FROM enhanced_product_pricing
WHERE product_type = 'model';

-- Check for NULL pricing that should have data
SELECT product_id, pricing_tier, dealer_cost, rep_cost
FROM enhanced_product_pricing
WHERE dealer_cost IS NULL
  AND product_id IN (
    SELECT id FROM product_models WHERE new_dealer_cost IS NOT NULL
  );
```

---

## 🚨 Risks & Mitigation

### Risk 1: Data Loss During Migration

**Probability:** Low
**Impact:** High
**Mitigation:**

- Full database backup before migration
- Migration script uses INSERT (not DELETE)
- EXISTS clause prevents duplicate inserts
- Validation queries after migration
- Rollback script prepared

### Risk 2: Performance Degradation

**Probability:** Medium
**Impact:** Medium
**Mitigation:**

- Add indexes on `enhancedProductPricing`:
  - `(product_id, product_type, pricing_tier)`
  - `(tenant_id, product_type)`
- Query profiling before/after
- Load testing with realistic data volume

### Risk 3: Breaking Changes

**Probability:** Medium
**Impact:** High
**Mitigation:**

- Backward compatibility layer
- Dual-read strategy during transition
- Feature flags for new pricing service
- Gradual rollout (dev → staging → production)

### Risk 4: Incomplete Code Updates

**Probability:** Medium
**Impact:** Medium
**Mitigation:**

- Comprehensive grep for old pricing field usage
- TypeScript deprecation warnings
- Code review checklist
- Manual testing of all pricing flows

---

## 📈 Monitoring & Rollback

### Monitoring

```typescript
// Add metrics to pricing service
import { metrics } from '../lib/metrics';

async getProductPricing(...) {
  const startTime = Date.now();
  try {
    const result = await ...;
    metrics.recordPricingQuery({
      duration: Date.now() - startTime,
      source: 'enhanced_product_pricing',
      success: true,
    });
    return result;
  } catch (error) {
    metrics.recordPricingQuery({
      duration: Date.now() - startTime,
      source: 'enhanced_product_pricing',
      success: false,
    });
    throw error;
  }
}
```

### Rollback Plan

If critical issues arise:

1. **Immediate (< 5 min):**
   - Feature flag: Disable new pricing service
   - Routes revert to old pricing field queries
   - Frontend continues to work (backward compatible)

2. **Short-term (< 1 hour):**
   - Restore database from backup (if data corruption)
   - Deploy previous code version
   - Investigate issue

3. **Long-term:**
   - Fix identified issues
   - Re-test in staging
   - Schedule new migration date

---

## 🎉 Expected Outcomes

**After Migration:**
✅ Single source of truth for all pricing
✅ 50% reduction in pricing-related bugs
✅ 30% faster pricing queries
✅ Price change approval workflow functional
✅ Complete audit trail for compliance
✅ Foundation for advanced pricing features

**Code Quality:**
✅ Centralized pricing logic (easier to maintain)
✅ Better separation of concerns
✅ Reduced code duplication
✅ Improved testability

**Business Value:**
✅ Accurate pricing data
✅ Better margin visibility
✅ Faster pricing updates
✅ Compliance-ready audit trail
✅ Unlocks new pricing features

---

## 📚 Documentation Updates

After migration, update:

1. **API Documentation** - New pricing endpoints
2. **Developer Guide** - How to use pricing service
3. **Database Schema Docs** - Reflect new structure
4. **User Guide** - Pricing management workflows

---

**Document Version:** 1.0
**Last Updated:** 2025-11-24
**Author:** Claude Code
**Status:** Ready for Implementation
