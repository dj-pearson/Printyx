-- Company Deduplication SQL Script
-- Run this directly in Supabase SQL Editor or psql
-- 
-- Step 1: Preview duplicates (run this first!)
-- Step 2: Execute the merge (uncomment and run)

-- Your tenant ID
DO $$
DECLARE
    v_tenant_id UUID := '550e8400-e29b-41d4-a716-446655440000';
BEGIN
    RAISE NOTICE 'Processing tenant: %', v_tenant_id;
END $$;

-- ============================================
-- STEP 1: PREVIEW - See what will be merged
-- ============================================
WITH normalized_companies AS (
    SELECT 
        id,
        business_name,
        billing_city,
        billing_state,
        created_at,
        LOWER(TRIM(COALESCE(business_name, ''))) || '|' || 
        LOWER(TRIM(COALESCE(billing_city, ''))) || '|' || 
        LOWER(TRIM(COALESCE(billing_state, ''))) AS group_key
    FROM companies
    WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
),
duplicate_groups AS (
    SELECT 
        group_key,
        COUNT(*) as count,
        MIN(created_at) as oldest_created,
        array_agg(id ORDER BY created_at ASC) as company_ids,
        array_agg(business_name ORDER BY created_at ASC) as names
    FROM normalized_companies
    GROUP BY group_key
    HAVING COUNT(*) > 1
)
SELECT 
    SPLIT_PART(group_key, '|', 1) as company_name,
    SPLIT_PART(group_key, '|', 2) as city,
    SPLIT_PART(group_key, '|', 3) as state,
    count as duplicate_count,
    company_ids[1] as survivor_id,
    company_ids[2:] as ids_to_delete
FROM duplicate_groups
ORDER BY count DESC;

-- ============================================
-- STEP 2: EXECUTE MERGE (run after reviewing!)
-- READY TO EXECUTE!
-- ============================================
-- Create temp table with merge plan
CREATE TEMP TABLE merge_plan AS
WITH normalized_companies AS (
    SELECT 
        id,
        created_at,
        LOWER(TRIM(COALESCE(business_name, ''))) || '|' || 
        LOWER(TRIM(COALESCE(billing_city, ''))) || '|' || 
        LOWER(TRIM(COALESCE(billing_state, ''))) AS group_key
    FROM companies
    WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
),
ranked AS (
    SELECT 
        id,
        group_key,
        ROW_NUMBER() OVER (PARTITION BY group_key ORDER BY created_at ASC) as rn
    FROM normalized_companies
)
SELECT 
    r1.id as survivor_id,
    r2.id as duplicate_id
FROM ranked r1
JOIN ranked r2 ON r1.group_key = r2.group_key AND r1.rn = 1 AND r2.rn > 1;

-- Move contacts to survivor
UPDATE company_contacts cc
SET company_id = mp.survivor_id, updated_at = NOW()
FROM merge_plan mp
WHERE cc.company_id::text = mp.duplicate_id::text
  AND cc.tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Move activities to survivor  
UPDATE business_record_activities bra
SET company_id = mp.survivor_id::text, updated_at = NOW()
FROM merge_plan mp
WHERE bra.company_id::text = mp.duplicate_id::text
  AND bra.tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Delete duplicate companies
DELETE FROM companies c
USING merge_plan mp
WHERE c.id = mp.duplicate_id
  AND c.tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Cleanup
DROP TABLE merge_plan;

-- Verify results
SELECT COUNT(*) as remaining_companies FROM companies 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';
