-- Migration Script: Product Pricing Consolidation
-- Purpose: Migrate pricing data from productModels and productAccessories to enhancedProductPricing
-- Date: 2025-11-24
-- Author: Claude Code
-- Version: 1.0

-- IMPORTANT: This migration is IDEMPOTENT (can be run multiple times safely)
-- It uses EXISTS checks to prevent duplicate inserts

BEGIN;

-- ============================================================================
-- PRE-MIGRATION VALIDATION
-- ============================================================================

-- Check if enhancedProductPricing table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'enhanced_product_pricing'
  ) THEN
    RAISE EXCEPTION 'Table enhanced_product_pricing does not exist. Please ensure schema is up to date.';
  END IF;
END $$;

-- Log migration start
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Starting Pricing Data Migration';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE '===========================================';
END $$;

-- ============================================================================
-- STEP 1: MIGRATE PRODUCT MODELS - NEW TIER
-- ============================================================================

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
  effective_date,
  created_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() AS id,
  pm.tenant_id,
  pm.id AS product_id,
  'model' AS product_type,
  'new' AS pricing_tier,
  pm.new_dealer_cost AS dealer_cost,
  pm.new_rep_cost AS rep_cost,
  pm.new_suggested_retail AS suggested_retail_price,
  NULL AS minimum_sale_price,
  (pm.new_rep_markup_percentage IS NOT NULL) AS use_custom_markup,
  CASE
    WHEN pm.new_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type
    ELSE NULL
  END AS markup_type,
  pm.new_rep_markup_percentage AS markup_percentage,
  COALESCE(pm.new_active, true) AS is_active,
  pm.created_at AS effective_date,
  'system_migration' AS created_by,
  pm.created_at,
  pm.updated_at
FROM product_models pm
WHERE pm.new_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM enhanced_product_pricing epp
    WHERE epp.product_id = pm.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'new'
  );

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 1] Migrated % Product Models - New Tier', row_count;
END $$;

-- ============================================================================
-- STEP 2: MIGRATE PRODUCT MODELS - UPGRADE TIER
-- ============================================================================

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
  effective_date,
  created_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  pm.tenant_id,
  pm.id,
  'model',
  'upgrade',
  pm.upgrade_dealer_cost,
  pm.upgrade_rep_cost,
  pm.upgrade_suggested_retail,
  NULL,
  (pm.upgrade_rep_markup_percentage IS NOT NULL),
  CASE
    WHEN pm.upgrade_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type
    ELSE NULL
  END,
  pm.upgrade_rep_markup_percentage,
  COALESCE(pm.upgrade_active, true),
  pm.created_at,
  'system_migration',
  pm.created_at,
  pm.updated_at
FROM product_models pm
WHERE pm.upgrade_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM enhanced_product_pricing epp
    WHERE epp.product_id = pm.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'upgrade'
  );

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 2] Migrated % Product Models - Upgrade Tier', row_count;
END $$;

-- ============================================================================
-- STEP 3: MIGRATE PRODUCT MODELS - LEXMARK TIER
-- ============================================================================

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
  effective_date,
  created_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  pm.tenant_id,
  pm.id,
  'model',
  'lexmark',
  pm.lexmark_dealer_cost,
  pm.lexmark_rep_cost,
  pm.lexmark_suggested_retail,
  NULL,
  (pm.lexmark_rep_markup_percentage IS NOT NULL),
  CASE
    WHEN pm.lexmark_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type
    ELSE NULL
  END,
  pm.lexmark_rep_markup_percentage,
  COALESCE(pm.lexmark_active, true),
  pm.created_at,
  'system_migration',
  pm.created_at,
  pm.updated_at
FROM product_models pm
WHERE pm.lexmark_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM enhanced_product_pricing epp
    WHERE epp.product_id = pm.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'lexmark'
  );

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 3] Migrated % Product Models - Lexmark Tier', row_count;
END $$;

-- ============================================================================
-- STEP 4: MIGRATE PRODUCT ACCESSORIES - STANDARD TIER
-- ============================================================================

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
  effective_date,
  created_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  pa.tenant_id,
  pa.id,
  'accessory',
  'standard',
  COALESCE(pa.standard_dealer_cost, pa.standard_cost), -- Fallback to legacy field
  pa.standard_rep_cost,
  pa.standard_suggested_retail,
  NULL,
  (pa.standard_rep_markup_percentage IS NOT NULL),
  CASE
    WHEN pa.standard_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type
    ELSE NULL
  END,
  pa.standard_rep_markup_percentage,
  COALESCE(pa.is_active, true),
  pa.created_at,
  'system_migration',
  pa.created_at,
  pa.updated_at
FROM product_accessories pa
WHERE (pa.standard_dealer_cost IS NOT NULL OR pa.standard_cost IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM enhanced_product_pricing epp
    WHERE epp.product_id = pa.id
      AND epp.product_type = 'accessory'
      AND epp.pricing_tier = 'standard'
  );

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 4] Migrated % Product Accessories - Standard Tier', row_count;
END $$;

-- ============================================================================
-- STEP 5: MIGRATE PRODUCT ACCESSORIES - NEW TIER
-- ============================================================================

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
  effective_date,
  created_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  pa.tenant_id,
  pa.id,
  'accessory',
  'new',
  COALESCE(pa.new_dealer_cost, pa.new_cost), -- Fallback to legacy field
  pa.new_rep_cost,
  pa.new_suggested_retail,
  NULL,
  (pa.new_rep_markup_percentage IS NOT NULL),
  CASE
    WHEN pa.new_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type
    ELSE NULL
  END,
  pa.new_rep_markup_percentage,
  COALESCE(pa.is_active, true),
  pa.created_at,
  'system_migration',
  pa.created_at,
  pa.updated_at
FROM product_accessories pa
WHERE (pa.new_dealer_cost IS NOT NULL OR pa.new_cost IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM enhanced_product_pricing epp
    WHERE epp.product_id = pa.id
      AND epp.product_type = 'accessory'
      AND epp.pricing_tier = 'new'
  );

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 5] Migrated % Product Accessories - New Tier', row_count;
END $$;

-- ============================================================================
-- STEP 6: MIGRATE PRODUCT ACCESSORIES - UPGRADE TIER
-- ============================================================================

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
  effective_date,
  created_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  pa.tenant_id,
  pa.id,
  'accessory',
  'upgrade',
  COALESCE(pa.upgrade_dealer_cost, pa.upgrade_cost), -- Fallback to legacy field
  pa.upgrade_rep_cost,
  pa.upgrade_suggested_retail,
  NULL,
  (pa.upgrade_rep_markup_percentage IS NOT NULL),
  CASE
    WHEN pa.upgrade_rep_markup_percentage IS NOT NULL THEN 'percentage'::markup_type
    ELSE NULL
  END,
  pa.upgrade_rep_markup_percentage,
  COALESCE(pa.is_active, true),
  pa.created_at,
  'system_migration',
  pa.created_at,
  pa.updated_at
FROM product_accessories pa
WHERE (pa.upgrade_dealer_cost IS NOT NULL OR pa.upgrade_cost IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM enhanced_product_pricing epp
    WHERE epp.product_id = pa.id
      AND epp.product_type = 'accessory'
      AND epp.pricing_tier = 'upgrade'
  );

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 6] Migrated % Product Accessories - Upgrade Tier', row_count;
END $$;

-- ============================================================================
-- STEP 7: ADD MIGRATION TRACKING FLAGS
-- ============================================================================

-- Add pricing_migrated column to product_models if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_models'
      AND column_name = 'pricing_migrated'
  ) THEN
    ALTER TABLE product_models ADD COLUMN pricing_migrated BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '[STEP 7a] Added pricing_migrated column to product_models';
  ELSE
    RAISE NOTICE '[STEP 7a] Column pricing_migrated already exists in product_models';
  END IF;
END $$;

-- Add pricing_migrated column to product_accessories if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_accessories'
      AND column_name = 'pricing_migrated'
  ) THEN
    ALTER TABLE product_accessories ADD COLUMN pricing_migrated BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '[STEP 7b] Added pricing_migrated column to product_accessories';
  ELSE
    RAISE NOTICE '[STEP 7b] Column pricing_migrated already exists in product_accessories';
  END IF;
END $$;

-- Mark migrated product models
UPDATE product_models
SET pricing_migrated = TRUE
WHERE id IN (
  SELECT DISTINCT product_id
  FROM enhanced_product_pricing
  WHERE product_type = 'model'
);

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 7c] Marked % Product Models as pricing_migrated', row_count;
END $$;

-- Mark migrated product accessories
UPDATE product_accessories
SET pricing_migrated = TRUE
WHERE id IN (
  SELECT DISTINCT product_id
  FROM enhanced_product_pricing
  WHERE product_type = 'accessory'
);

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 7d] Marked % Product Accessories as pricing_migrated', row_count;
END $$;

-- ============================================================================
-- POST-MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
  -- Source counts
  pm_new_count INT;
  pm_upgrade_count INT;
  pm_lexmark_count INT;
  pa_standard_count INT;
  pa_new_count INT;
  pa_upgrade_count INT;
  source_total INT;

  -- Target counts
  epp_model_new_count INT;
  epp_model_upgrade_count INT;
  epp_model_lexmark_count INT;
  epp_accessory_standard_count INT;
  epp_accessory_new_count INT;
  epp_accessory_upgrade_count INT;
  target_total INT;

  -- Validation flags
  validation_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'POST-MIGRATION VALIDATION';
  RAISE NOTICE '===========================================';

  -- Count source records
  SELECT COUNT(*) INTO pm_new_count FROM product_models WHERE new_dealer_cost IS NOT NULL;
  SELECT COUNT(*) INTO pm_upgrade_count FROM product_models WHERE upgrade_dealer_cost IS NOT NULL;
  SELECT COUNT(*) INTO pm_lexmark_count FROM product_models WHERE lexmark_dealer_cost IS NOT NULL;
  SELECT COUNT(*) INTO pa_standard_count FROM product_accessories WHERE (standard_dealer_cost IS NOT NULL OR standard_cost IS NOT NULL);
  SELECT COUNT(*) INTO pa_new_count FROM product_accessories WHERE (new_dealer_cost IS NOT NULL OR new_cost IS NOT NULL);
  SELECT COUNT(*) INTO pa_upgrade_count FROM product_accessories WHERE (upgrade_dealer_cost IS NOT NULL OR upgrade_cost IS NOT NULL);

  source_total := pm_new_count + pm_upgrade_count + pm_lexmark_count +
                  pa_standard_count + pa_new_count + pa_upgrade_count;

  -- Count migrated records
  SELECT COUNT(*) INTO epp_model_new_count
  FROM enhanced_product_pricing
  WHERE product_type = 'model' AND pricing_tier = 'new';

  SELECT COUNT(*) INTO epp_model_upgrade_count
  FROM enhanced_product_pricing
  WHERE product_type = 'model' AND pricing_tier = 'upgrade';

  SELECT COUNT(*) INTO epp_model_lexmark_count
  FROM enhanced_product_pricing
  WHERE product_type = 'model' AND pricing_tier = 'lexmark';

  SELECT COUNT(*) INTO epp_accessory_standard_count
  FROM enhanced_product_pricing
  WHERE product_type = 'accessory' AND pricing_tier = 'standard';

  SELECT COUNT(*) INTO epp_accessory_new_count
  FROM enhanced_product_pricing
  WHERE product_type = 'accessory' AND pricing_tier = 'new';

  SELECT COUNT(*) INTO epp_accessory_upgrade_count
  FROM enhanced_product_pricing
  WHERE product_type = 'accessory' AND pricing_tier = 'upgrade';

  target_total := epp_model_new_count + epp_model_upgrade_count + epp_model_lexmark_count +
                  epp_accessory_standard_count + epp_accessory_new_count + epp_accessory_upgrade_count;

  -- Display results
  RAISE NOTICE 'SOURCE COUNTS (product_models & product_accessories):';
  RAISE NOTICE '  Product Models - New Tier: %', pm_new_count;
  RAISE NOTICE '  Product Models - Upgrade Tier: %', pm_upgrade_count;
  RAISE NOTICE '  Product Models - Lexmark Tier: %', pm_lexmark_count;
  RAISE NOTICE '  Product Accessories - Standard Tier: %', pa_standard_count;
  RAISE NOTICE '  Product Accessories - New Tier: %', pa_new_count;
  RAISE NOTICE '  Product Accessories - Upgrade Tier: %', pa_upgrade_count;
  RAISE NOTICE '  TOTAL SOURCE RECORDS: %', source_total;
  RAISE NOTICE '';

  RAISE NOTICE 'TARGET COUNTS (enhanced_product_pricing):';
  RAISE NOTICE '  Product Models - New Tier: %', epp_model_new_count;
  RAISE NOTICE '  Product Models - Upgrade Tier: %', epp_model_upgrade_count;
  RAISE NOTICE '  Product Models - Lexmark Tier: %', epp_model_lexmark_count;
  RAISE NOTICE '  Product Accessories - Standard Tier: %', epp_accessory_standard_count;
  RAISE NOTICE '  Product Accessories - New Tier: %', epp_accessory_new_count;
  RAISE NOTICE '  Product Accessories - Upgrade Tier: %', epp_accessory_upgrade_count;
  RAISE NOTICE '  TOTAL TARGET RECORDS: %', target_total;
  RAISE NOTICE '';

  -- Validate counts match
  IF source_total != target_total THEN
    validation_passed := FALSE;
    RAISE WARNING 'VALIDATION FAILED: Source count (%) does not match target count (%)', source_total, target_total;
  END IF;

  -- Validate no NULL dealer costs in migrated data
  DECLARE
    null_dealer_cost_count INT;
  BEGIN
    SELECT COUNT(*) INTO null_dealer_cost_count
    FROM enhanced_product_pricing
    WHERE dealer_cost IS NULL
      AND created_by = 'system_migration';

    IF null_dealer_cost_count > 0 THEN
      validation_passed := FALSE;
      RAISE WARNING 'VALIDATION FAILED: Found % records with NULL dealer_cost', null_dealer_cost_count;
    END IF;
  END;

  -- Final validation result
  IF validation_passed THEN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✓ MIGRATION VALIDATION PASSED';
    RAISE NOTICE '===========================================';
  ELSE
    RAISE EXCEPTION 'Migration validation failed. Rolling back transaction.';
  END IF;

  RAISE NOTICE 'Migration completed at: %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-COMMIT RECOMMENDATIONS
-- ============================================================================

-- Run these queries manually after migration to verify data integrity:
/*

-- 1. Check for any products with pricing in old schema but not in new
SELECT 'Missing Model - New' as issue, id, product_name
FROM product_models
WHERE new_dealer_cost IS NOT NULL
  AND NOT pricing_migrated;

-- 2. Check for price discrepancies (if any)
SELECT pm.id, pm.product_name,
       pm.new_dealer_cost as old_dealer_cost,
       epp.dealer_cost as new_dealer_cost,
       (pm.new_dealer_cost::numeric - epp.dealer_cost::numeric) as difference
FROM product_models pm
JOIN enhanced_product_pricing epp
  ON epp.product_id = pm.id
  AND epp.product_type = 'model'
  AND epp.pricing_tier = 'new'
WHERE ABS(pm.new_dealer_cost::numeric - epp.dealer_cost::numeric) > 0.01;

-- 3. Get migration summary
SELECT
  product_type,
  pricing_tier,
  COUNT(*) as record_count,
  COUNT(CASE WHEN dealer_cost IS NOT NULL THEN 1 END) as with_dealer_cost,
  COUNT(CASE WHEN rep_cost IS NOT NULL THEN 1 END) as with_rep_cost
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'
GROUP BY product_type, pricing_tier
ORDER BY product_type, pricing_tier;

*/
