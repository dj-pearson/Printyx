-- Validation Queries for Pricing Migration
-- Purpose: Verify data integrity and completeness after migration
-- Date: 2025-11-24
-- Author: Claude Code

-- ============================================================================
-- QUERY 1: Migration Summary Statistics
-- ============================================================================

SELECT
  '============================================' as separator,
  'MIGRATION SUMMARY STATISTICS' as title,
  '============================================' as separator2
UNION ALL
SELECT '', '', '';

SELECT
  product_type,
  pricing_tier,
  COUNT(*) as record_count,
  COUNT(CASE WHEN dealer_cost IS NOT NULL THEN 1 END) as with_dealer_cost,
  COUNT(CASE WHEN rep_cost IS NOT NULL THEN 1 END) as with_rep_cost,
  COUNT(CASE WHEN suggested_retail_price IS NOT NULL THEN 1 END) as with_retail_price,
  COUNT(CASE WHEN use_custom_markup = TRUE THEN 1 END) as with_custom_markup
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'
GROUP BY product_type, pricing_tier
ORDER BY product_type, pricing_tier;

-- ============================================================================
-- QUERY 2: Source vs Target Record Counts
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'SOURCE VS TARGET COMPARISON'
UNION ALL
SELECT '============================================';

-- Product Models comparison
SELECT
  'Product Models - New Tier' as category,
  (SELECT COUNT(*) FROM product_models WHERE new_dealer_cost IS NOT NULL) as source_count,
  (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'model' AND pricing_tier = 'new') as target_count,
  CASE
    WHEN (SELECT COUNT(*) FROM product_models WHERE new_dealer_cost IS NOT NULL) =
         (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'model' AND pricing_tier = 'new')
    THEN '✓ MATCH'
    ELSE '✗ MISMATCH'
  END as status

UNION ALL

SELECT
  'Product Models - Upgrade Tier',
  (SELECT COUNT(*) FROM product_models WHERE upgrade_dealer_cost IS NOT NULL),
  (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'model' AND pricing_tier = 'upgrade'),
  CASE
    WHEN (SELECT COUNT(*) FROM product_models WHERE upgrade_dealer_cost IS NOT NULL) =
         (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'model' AND pricing_tier = 'upgrade')
    THEN '✓ MATCH'
    ELSE '✗ MISMATCH'
  END

UNION ALL

SELECT
  'Product Models - Lexmark Tier',
  (SELECT COUNT(*) FROM product_models WHERE lexmark_dealer_cost IS NOT NULL),
  (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'model' AND pricing_tier = 'lexmark'),
  CASE
    WHEN (SELECT COUNT(*) FROM product_models WHERE lexmark_dealer_cost IS NOT NULL) =
         (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'model' AND pricing_tier = 'lexmark')
    THEN '✓ MATCH'
    ELSE '✗ MISMATCH'
  END

UNION ALL

SELECT
  'Product Accessories - Standard',
  (SELECT COUNT(*) FROM product_accessories WHERE (standard_dealer_cost IS NOT NULL OR standard_cost IS NOT NULL)),
  (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'accessory' AND pricing_tier = 'standard'),
  CASE
    WHEN (SELECT COUNT(*) FROM product_accessories WHERE (standard_dealer_cost IS NOT NULL OR standard_cost IS NOT NULL)) =
         (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'accessory' AND pricing_tier = 'standard')
    THEN '✓ MATCH'
    ELSE '✗ MISMATCH'
  END

UNION ALL

SELECT
  'Product Accessories - New',
  (SELECT COUNT(*) FROM product_accessories WHERE (new_dealer_cost IS NOT NULL OR new_cost IS NOT NULL)),
  (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'accessory' AND pricing_tier = 'new'),
  CASE
    WHEN (SELECT COUNT(*) FROM product_accessories WHERE (new_dealer_cost IS NOT NULL OR new_cost IS NOT NULL)) =
         (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'accessory' AND pricing_tier = 'new')
    THEN '✓ MATCH'
    ELSE '✗ MISMATCH'
  END

UNION ALL

SELECT
  'Product Accessories - Upgrade',
  (SELECT COUNT(*) FROM product_accessories WHERE (upgrade_dealer_cost IS NOT NULL OR upgrade_cost IS NOT NULL)),
  (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'accessory' AND pricing_tier = 'upgrade'),
  CASE
    WHEN (SELECT COUNT(*) FROM product_accessories WHERE (upgrade_dealer_cost IS NOT NULL OR upgrade_cost IS NOT NULL)) =
         (SELECT COUNT(*) FROM enhanced_product_pricing WHERE product_type = 'accessory' AND pricing_tier = 'upgrade')
    THEN '✓ MATCH'
    ELSE '✗ MISMATCH'
  END;

-- ============================================================================
-- QUERY 3: Check for Missing Products (Should return 0 rows)
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'MISSING PRODUCTS CHECK (Should be empty)'
UNION ALL
SELECT '============================================';

-- Product Models with pricing not migrated
SELECT
  'model' as product_type,
  'new' as pricing_tier,
  pm.id,
  pm.product_name,
  pm.new_dealer_cost,
  'MISSING' as status
FROM product_models pm
WHERE pm.new_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = pm.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'new'
  )

UNION ALL

SELECT
  'model',
  'upgrade',
  pm.id,
  pm.product_name,
  pm.upgrade_dealer_cost,
  'MISSING'
FROM product_models pm
WHERE pm.upgrade_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = pm.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'upgrade'
  )

UNION ALL

SELECT
  'model',
  'lexmark',
  pm.id,
  pm.product_name,
  pm.lexmark_dealer_cost,
  'MISSING'
FROM product_models pm
WHERE pm.lexmark_dealer_cost IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM enhanced_product_pricing epp
    WHERE epp.product_id = pm.id
      AND epp.product_type = 'model'
      AND epp.pricing_tier = 'lexmark'
  );

-- ============================================================================
-- QUERY 4: Check for Price Discrepancies (Should return 0 rows)
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'PRICE DISCREPANCIES CHECK (Should be empty)'
UNION ALL
SELECT '============================================';

-- Product Models - New Tier price discrepancies
SELECT
  pm.id,
  pm.product_name,
  'new' as tier,
  pm.new_dealer_cost::numeric as source_dealer_cost,
  epp.dealer_cost::numeric as target_dealer_cost,
  ABS(pm.new_dealer_cost::numeric - epp.dealer_cost::numeric) as difference
FROM product_models pm
JOIN enhanced_product_pricing epp
  ON epp.product_id = pm.id
  AND epp.product_type = 'model'
  AND epp.pricing_tier = 'new'
WHERE pm.new_dealer_cost IS NOT NULL
  AND epp.dealer_cost IS NOT NULL
  AND ABS(pm.new_dealer_cost::numeric - epp.dealer_cost::numeric) > 0.01; -- Allow 1 cent rounding difference

-- ============================================================================
-- QUERY 5: Check for NULL Dealer Costs (Should return 0 rows)
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'NULL DEALER COSTS CHECK (Should be empty)'
UNION ALL
SELECT '============================================';

SELECT
  product_id,
  product_type,
  pricing_tier,
  dealer_cost,
  rep_cost,
  'NULL DEALER COST' as issue
FROM enhanced_product_pricing
WHERE dealer_cost IS NULL
  AND created_by = 'system_migration';

-- ============================================================================
-- QUERY 6: Migration Flag Status
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'MIGRATION FLAG STATUS'
UNION ALL
SELECT '============================================';

SELECT
  'Product Models' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN pricing_migrated = TRUE THEN 1 END) as migrated_count,
  COUNT(CASE WHEN pricing_migrated = FALSE OR pricing_migrated IS NULL THEN 1 END) as not_migrated_count
FROM product_models

UNION ALL

SELECT
  'Product Accessories',
  COUNT(*),
  COUNT(CASE WHEN pricing_migrated = TRUE THEN 1 END),
  COUNT(CASE WHEN pricing_migrated = FALSE OR pricing_migrated IS NULL THEN 1 END)
FROM product_accessories;

-- ============================================================================
-- QUERY 7: Pricing Coverage Analysis
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'PRICING COVERAGE ANALYSIS'
UNION ALL
SELECT '============================================';

SELECT
  product_type,
  pricing_tier,
  COUNT(*) as total_products,
  COUNT(CASE WHEN dealer_cost IS NOT NULL THEN 1 END) as has_dealer_cost,
  COUNT(CASE WHEN rep_cost IS NOT NULL THEN 1 END) as has_rep_cost,
  COUNT(CASE WHEN suggested_retail_price IS NOT NULL THEN 1 END) as has_retail_price,
  ROUND(
    (COUNT(CASE WHEN dealer_cost IS NOT NULL AND rep_cost IS NOT NULL THEN 1 END)::numeric /
     NULLIF(COUNT(*), 0)::numeric) * 100,
    2
  ) as complete_pricing_percentage
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'
GROUP BY product_type, pricing_tier
ORDER BY product_type, pricing_tier;

-- ============================================================================
-- QUERY 8: Tenant Distribution
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'TENANT DISTRIBUTION'
UNION ALL
SELECT '============================================';

SELECT
  tenant_id,
  product_type,
  COUNT(*) as pricing_records,
  COUNT(DISTINCT product_id) as unique_products
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'
GROUP BY tenant_id, product_type
ORDER BY tenant_id, product_type;

-- ============================================================================
-- QUERY 9: Markup Analysis
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'MARKUP ANALYSIS'
UNION ALL
SELECT '============================================';

SELECT
  product_type,
  pricing_tier,
  COUNT(*) as total_records,
  COUNT(CASE WHEN use_custom_markup = TRUE THEN 1 END) as custom_markup_count,
  COUNT(CASE WHEN markup_type = 'percentage' THEN 1 END) as percentage_markup_count,
  AVG(NULLIF(markup_percentage, NULL)::numeric) as avg_markup_percentage,
  MIN(NULLIF(markup_percentage, NULL)::numeric) as min_markup_percentage,
  MAX(NULLIF(markup_percentage, NULL)::numeric) as max_markup_percentage
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'
GROUP BY product_type, pricing_tier
ORDER BY product_type, pricing_tier;

-- ============================================================================
-- QUERY 10: Final Migration Status Summary
-- ============================================================================

SELECT '============================================' as title
UNION ALL
SELECT 'FINAL MIGRATION STATUS'
UNION ALL
SELECT '============================================';

SELECT
  'Total Records Migrated' as metric,
  COUNT(*)::text as value
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'

UNION ALL

SELECT
  'Product Types',
  COUNT(DISTINCT product_type)::text
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'

UNION ALL

SELECT
  'Pricing Tiers',
  COUNT(DISTINCT pricing_tier)::text
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'

UNION ALL

SELECT
  'Tenants Affected',
  COUNT(DISTINCT tenant_id)::text
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'

UNION ALL

SELECT
  'Products Migrated (Models)',
  COUNT(DISTINCT product_id)::text
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'
  AND product_type = 'model'

UNION ALL

SELECT
  'Products Migrated (Accessories)',
  COUNT(DISTINCT product_id)::text
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'
  AND product_type = 'accessory'

UNION ALL

SELECT
  'Records with Complete Pricing',
  COUNT(*)::text
FROM enhanced_product_pricing
WHERE created_by = 'system_migration'
  AND dealer_cost IS NOT NULL
  AND rep_cost IS NOT NULL

UNION ALL

SELECT
  'Migration Status',
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM product_models
      WHERE (new_dealer_cost IS NOT NULL OR upgrade_dealer_cost IS NOT NULL OR lexmark_dealer_cost IS NOT NULL)
        AND NOT pricing_migrated
    ) = 0
    AND (
      SELECT COUNT(*)
      FROM product_accessories
      WHERE (standard_dealer_cost IS NOT NULL OR new_dealer_cost IS NOT NULL OR upgrade_dealer_cost IS NOT NULL)
        AND NOT pricing_migrated
    ) = 0
    THEN '✓ COMPLETE'
    ELSE '✗ INCOMPLETE'
  END;

-- ============================================================================
-- END OF VALIDATION QUERIES
-- ============================================================================

SELECT '============================================' as end_marker
UNION ALL
SELECT 'END OF VALIDATION REPORT'
UNION ALL
SELECT '============================================';
