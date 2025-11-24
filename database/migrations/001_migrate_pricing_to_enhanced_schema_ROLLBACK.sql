-- Rollback Script: Product Pricing Consolidation
-- Purpose: Rollback pricing migration if issues are detected
-- Date: 2025-11-24
-- Author: Claude Code
-- Version: 1.0

-- WARNING: This script will DELETE all migrated pricing data from enhanced_product_pricing
-- Only run this if you need to rollback the migration

BEGIN;

-- ============================================================================
-- PRE-ROLLBACK VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Starting Pricing Migration ROLLBACK';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE 'WARNING: This will delete migrated pricing data';
  RAISE NOTICE '===========================================';
END $$;

-- Count records to be deleted
DO $$
DECLARE
  records_to_delete INT;
BEGIN
  SELECT COUNT(*) INTO records_to_delete
  FROM enhanced_product_pricing
  WHERE created_by = 'system_migration';

  RAISE NOTICE 'Records to be deleted: %', records_to_delete;

  IF records_to_delete = 0 THEN
    RAISE NOTICE 'No migrated records found. Nothing to rollback.';
  END IF;
END $$;

-- ============================================================================
-- STEP 1: DELETE MIGRATED PRICING RECORDS
-- ============================================================================

DELETE FROM enhanced_product_pricing
WHERE created_by = 'system_migration';

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 1] Deleted % migrated pricing records', row_count;
END $$;

-- ============================================================================
-- STEP 2: RESET MIGRATION FLAGS
-- ============================================================================

-- Reset product_models migration flag
UPDATE product_models
SET pricing_migrated = FALSE
WHERE pricing_migrated = TRUE;

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 2a] Reset pricing_migrated flag for % Product Models', row_count;
END $$;

-- Reset product_accessories migration flag
UPDATE product_accessories
SET pricing_migrated = FALSE
WHERE pricing_migrated = TRUE;

-- Log progress
DO $$
DECLARE
  row_count INT;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '[STEP 2b] Reset pricing_migrated flag for % Product Accessories', row_count;
END $$;

-- ============================================================================
-- STEP 3: OPTIONAL - DROP MIGRATION FLAGS (UNCOMMENT IF NEEDED)
-- ============================================================================

-- Uncomment these lines if you want to completely remove the migration tracking columns

-- ALTER TABLE product_models DROP COLUMN IF EXISTS pricing_migrated;
-- ALTER TABLE product_accessories DROP COLUMN IF EXISTS pricing_migrated;

-- RAISE NOTICE '[STEP 3] Dropped pricing_migrated columns';

-- ============================================================================
-- POST-ROLLBACK VALIDATION
-- ============================================================================

DO $$
DECLARE
  remaining_migrated_records INT;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'POST-ROLLBACK VALIDATION';
  RAISE NOTICE '===========================================';

  -- Check for any remaining migrated records
  SELECT COUNT(*) INTO remaining_migrated_records
  FROM enhanced_product_pricing
  WHERE created_by = 'system_migration';

  IF remaining_migrated_records > 0 THEN
    RAISE WARNING 'WARNING: Still found % migrated records', remaining_migrated_records;
    RAISE EXCEPTION 'Rollback incomplete. Rolling back transaction.';
  ELSE
    RAISE NOTICE '✓ All migrated records successfully deleted';
  END IF;

  -- Check migration flags
  DECLARE
    models_with_flag INT;
    accessories_with_flag INT;
  BEGIN
    SELECT COUNT(*) INTO models_with_flag
    FROM product_models
    WHERE pricing_migrated = TRUE;

    SELECT COUNT(*) INTO accessories_with_flag
    FROM product_accessories
    WHERE pricing_migrated = TRUE;

    IF models_with_flag > 0 OR accessories_with_flag > 0 THEN
      RAISE WARNING 'WARNING: Found % product models and % accessories still marked as migrated',
        models_with_flag, accessories_with_flag;
    ELSE
      RAISE NOTICE '✓ All migration flags successfully reset';
    END IF;
  END;

  RAISE NOTICE '===========================================';
  RAISE NOTICE '✓ ROLLBACK VALIDATION PASSED';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Rollback completed at: %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK NOTES
-- ============================================================================

/*
After running this rollback:

1. The original pricing data in product_models and product_accessories remains UNCHANGED
2. All migrated records in enhanced_product_pricing have been deleted
3. Migration flags have been reset

You can now:
- Re-run the migration script after fixing any issues
- Continue using the old pricing fields
- Investigate what went wrong

To verify rollback was successful, run:

SELECT COUNT(*) FROM enhanced_product_pricing WHERE created_by = 'system_migration';
-- Should return 0

SELECT COUNT(*) FROM product_models WHERE pricing_migrated = TRUE;
-- Should return 0

SELECT COUNT(*) FROM product_accessories WHERE pricing_migrated = TRUE;
-- Should return 0
*/
