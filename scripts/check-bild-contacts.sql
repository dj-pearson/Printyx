-- Check contacts for BILD INTERNATIONAL after merge
-- Survivor ID from your output: 98aec74d-55af-437c-9827-23c65bd2627c

-- 1. Check contacts for the survivor company
SELECT 
    'Survivor Company Contacts' as check_type,
    COUNT(*) as contact_count,
    array_agg(DISTINCT first_name || ' ' || last_name) as contact_names
FROM company_contacts
WHERE company_id::text = '98aec74d-55af-437c-9827-23c65bd2627c'
  AND tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- 2. Check if any contacts are still on the old duplicate IDs
SELECT 
    'Duplicate Company Contacts' as check_type,
    COUNT(*) as contact_count
FROM company_contacts
WHERE company_id::text IN (
    '428ced79-26e7-4469-995b-76128383250e',
    '99b3cfea-fe7f-4751-99f3-98a4e3dd1782',
    '1a7ab3d0-7d7b-4036-a9dc-c47c086a0e1b',
    '172fc58f-1bbb-4a52-84bf-4c87ac10819c',
    'c69e9aa9-5867-4520-a7e9-6e1f419eaf7e',
    '1a26b468-a9ff-4ddc-8632-f1b3ae16d46a',
    '9f03abcc-f3d8-4edf-b9b1-f788351db710',
    '4dfa408a-5985-4305-a2aa-c7f125c588f7',
    '5b341b93-1e28-40f7-8759-f39766aea55a'
  )
  AND tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- 3. Show all company_contacts for BILD companies to see the data
SELECT 
    id,
    company_id,
    first_name,
    last_name,
    email,
    phone,
    updated_at
FROM company_contacts
WHERE company_id::text = '98aec74d-55af-437c-9827-23c65bd2627c'
  AND tenant_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY updated_at DESC
LIMIT 20;

-- 4. Check the survivor company details
SELECT 
    id,
    business_name,
    billing_city,
    billing_state,
    created_at
FROM companies
WHERE id = '98aec74d-55af-437c-9827-23c65bd2627c'
  AND tenant_id = '550e8400-e29b-41d4-a716-446655440000';
