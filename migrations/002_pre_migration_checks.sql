-- Pre-Migration Checks for 002_add_foreign_key_constraints.sql
-- Run this before applying the migration to identify potential issues

-- Check for invalid UUID values in company_contacts.company_id
SELECT 
  'company_contacts.company_id' as table_column,
  COUNT(*) as invalid_count,
  'These records have company_id that cannot be converted to UUID' as issue
FROM public.company_contacts
WHERE company_id IS NOT NULL 
  AND company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
GROUP BY table_column
HAVING COUNT(*) > 0

UNION ALL

-- Check for invalid UUID values in customers.company_id
SELECT 
  'customers.company_id' as table_column,
  COUNT(*) as invalid_count,
  'These records have company_id that cannot be converted to UUID' as issue
FROM public.customers
WHERE company_id IS NOT NULL 
  AND company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
GROUP BY table_column
HAVING COUNT(*) > 0

UNION ALL

-- Check for invalid UUID values in customers.contact_id
SELECT 
  'customers.contact_id' as table_column,
  COUNT(*) as invalid_count,
  'These records have contact_id that cannot be converted to UUID' as issue
FROM public.customers
WHERE contact_id IS NOT NULL 
  AND contact_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
GROUP BY table_column
HAVING COUNT(*) > 0

UNION ALL

-- Check for orphaned customers (company_id doesn't exist in companies)
-- Only check records with valid UUID format
SELECT 
  'customers orphaned records' as table_column,
  COUNT(*) as invalid_count,
  'These customer records reference non-existent companies' as issue
FROM public.customers c
LEFT JOIN public.companies co ON 
  (c.company_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND c.company_id::uuid = co.id)
WHERE c.company_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND co.id IS NULL
GROUP BY table_column
HAVING COUNT(*) > 0

UNION ALL

-- Check for orphaned company_contacts (company_id doesn't exist in companies)
-- Only check records with valid UUID format
SELECT 
  'company_contacts orphaned records' as table_column,
  COUNT(*) as invalid_count,
  'These contact records reference non-existent companies' as issue
FROM public.company_contacts cc
LEFT JOIN public.companies co ON 
  (cc.company_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND cc.company_id::uuid = co.id)
WHERE cc.company_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND co.id IS NULL
GROUP BY table_column
HAVING COUNT(*) > 0;

-- If the query returns no rows, you're good to proceed with the migration!
-- If it returns rows, you need to fix the data issues first.

-- Sample query to view the actual problematic records:
-- SELECT * FROM public.customers WHERE company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
