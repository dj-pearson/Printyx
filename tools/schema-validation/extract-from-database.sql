-- Extract Complete Database Schema
-- Run this SQL query to get your entire database schema
-- Copy the output and save it for documentation

-- ==============================================
-- PART 1: List All Tables
-- ==============================================

SELECT 
  '📋 TABLE: ' || table_name as info,
  (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name AND columns.table_schema = 'public') as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;

-- ==============================================
-- PART 2: Get All Columns for Each Table
-- ==============================================

SELECT 
  table_name,
  column_name,
  data_type,
  CASE WHEN character_maximum_length IS NOT NULL 
    THEN data_type || '(' || character_maximum_length || ')'
    ELSE data_type 
  END as full_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name IN (
      SELECT column_name 
      FROM information_schema.key_column_usage 
      WHERE key_column_usage.table_name = columns.table_name 
      AND key_column_usage.table_schema = 'public'
      AND constraint_name LIKE '%_pkey'
    ) THEN 'YES'
    ELSE 'NO'
  END as is_primary_key
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name NOT LIKE 'pg_%'
ORDER BY table_name, ordinal_position;

-- ==============================================
-- PART 3: Foreign Key Relationships
-- ==============================================

SELECT
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ==============================================
-- PART 4: Generate JSON Schema (Copy this output)
-- ==============================================

WITH table_columns AS (
  SELECT 
    table_name,
    json_agg(
      json_build_object(
        'name', column_name,
        'type', data_type,
        'nullable', is_nullable = 'YES',
        'default', column_default
      ) ORDER BY ordinal_position
    ) as columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
  GROUP BY table_name
)
SELECT 
  json_build_object(
    'tables', json_object_agg(table_name, json_build_object(
      'name', table_name,
      'columns', columns
    )),
    'generatedAt', NOW(),
    'source', 'database-query'
  ) as schema
FROM table_columns;

-- ==============================================
-- PART 5: Quick Table Reference
-- ==============================================

-- Run this to get a quick overview of a specific table
-- Replace 'users' with any table name

\d+ users;
\d+ customers;
\d+ companies;
\d+ company_contacts;

-- Or use this query:
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'  -- Change table name here
ORDER BY ordinal_position;
