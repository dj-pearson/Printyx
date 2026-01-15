-- Data Cleanup Script for Invalid UUID Values
-- Run this BEFORE applying 002_add_foreign_key_constraints.sql
-- This script identifies and fixes non-UUID values in foreign key columns

BEGIN;

-- Create a temporary table to log what we're fixing
CREATE TEMP TABLE IF NOT EXISTS cleanup_log (
  table_name TEXT,
  column_name TEXT,
  record_id TEXT,
  old_value TEXT,
  action TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Fix company_contacts with invalid company_id values
-- Strategy: Create placeholder companies for orphaned contacts (company_id has NOT NULL constraint)
DO $$
DECLARE
  rec RECORD;
  placeholder_company_id UUID;
  tenant_uuid UUID;
BEGIN
  -- Find all company_contacts with invalid UUIDs
  FOR rec IN 
    SELECT id, tenant_id, company_id, first_name, last_name, email
    FROM public.company_contacts
    WHERE company_id IS NOT NULL 
      AND company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  LOOP
    RAISE NOTICE 'Found invalid company_id in company_contacts: id=%, company_id=%, contact=%', rec.id, rec.company_id, rec.email;
    
    -- Extract domain from email for company name (if possible)
    DECLARE
      company_name TEXT;
      email_domain TEXT;
    BEGIN
      IF rec.email IS NOT NULL AND rec.email ~ '@' THEN
        email_domain := split_part(rec.email, '@', 2);
        company_name := initcap(split_part(email_domain, '.', 1)) || ' (Migrated from ' || rec.company_id || ')';
      ELSE
        company_name := rec.first_name || ' ' || rec.last_name || ' Company (Migrated from ' || rec.company_id || ')';
      END IF;
      
      -- Create a placeholder company
      INSERT INTO public.companies (
        id, 
        tenant_id, 
        business_name,
        email,
        business_record_type,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        rec.tenant_id,
        company_name,
        rec.email,
        'Customer',
        NOW(),
        NOW()
      ) RETURNING id INTO placeholder_company_id;
      
      RAISE NOTICE '  → Created placeholder company: id=%, name=%', placeholder_company_id, company_name;
      
      -- Log the action
      INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
      VALUES (
        'company_contacts', 
        'company_id', 
        rec.id::TEXT, 
        rec.company_id, 
        'Invalid UUID - created placeholder company: ' || placeholder_company_id::TEXT || ' (' || company_name || ')'
      );
      
      -- Update the contact to point to the new placeholder company
      UPDATE public.company_contacts
      SET company_id = placeholder_company_id::TEXT
      WHERE id = rec.id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  → ERROR creating placeholder company: %', SQLERRM;
      -- Log the error
      INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
      VALUES ('company_contacts', 'company_id', rec.id::TEXT, rec.company_id, 'ERROR: ' || SQLERRM);
    END;
  END LOOP;
END $$;

-- Fix customers with invalid company_id values
-- Check if company_id column allows NULL first
DO $$
DECLARE
  rec RECORD;
  column_is_nullable BOOLEAN;
  placeholder_company_id UUID;
BEGIN
  -- Check if customers.company_id allows NULL
  SELECT (c.is_nullable = 'YES') INTO column_is_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'customers'
    AND c.column_name = 'company_id';
  
  FOR rec IN 
    SELECT id, tenant_id, company_id
    FROM public.customers
    WHERE company_id IS NOT NULL 
      AND company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  LOOP
    RAISE NOTICE 'Found invalid company_id in customers: id=%, company_id=%', rec.id, rec.company_id;
    
    IF column_is_nullable THEN
      -- If nullable, set to NULL
      INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
      VALUES ('customers', 'company_id', rec.id::TEXT, rec.company_id, 'Invalid UUID - setting to NULL');
      
      UPDATE public.customers
      SET company_id = NULL
      WHERE id = rec.id;
    ELSE
      -- If NOT NULL constraint, create placeholder company
      DECLARE
        company_name TEXT;
      BEGIN
        company_name := 'Customer Company (Migrated from ' || rec.company_id || ')';
        
        INSERT INTO public.companies (
          id, 
          tenant_id, 
          business_name,
          business_record_type,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          rec.tenant_id,
          company_name,
          'Customer',
          NOW(),
          NOW()
        ) RETURNING id INTO placeholder_company_id;
        
        RAISE NOTICE '  → Created placeholder company: id=%, name=%', placeholder_company_id, company_name;
        
        INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
        VALUES (
          'customers', 
          'company_id', 
          rec.id::TEXT, 
          rec.company_id, 
          'Invalid UUID - created placeholder company: ' || placeholder_company_id::TEXT
        );
        
        UPDATE public.customers
        SET company_id = placeholder_company_id::TEXT
        WHERE id = rec.id;
      END;
    END IF;
  END LOOP;
END $$;

-- Fix customers with invalid contact_id values
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT id, contact_id
    FROM public.customers
    WHERE contact_id IS NOT NULL 
      AND contact_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  LOOP
    RAISE NOTICE 'Found invalid contact_id in customers: id=%, contact_id=%', rec.id, rec.contact_id;
    
    INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
    VALUES ('customers', 'contact_id', rec.id::TEXT, rec.contact_id, 'Invalid UUID - setting to NULL');
    
    UPDATE public.customers
    SET contact_id = NULL
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Fix leads table if it exists
DO $$
DECLARE
  rec RECORD;
  company_id_type TEXT;
  contact_id_type TEXT;
BEGIN
  -- Check if leads table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
    
    -- Check data type of company_id column
    SELECT data_type INTO company_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'company_id';
    
    -- Only check for invalid UUIDs if column is character varying (not already uuid)
    IF company_id_type = 'character varying' THEN
      -- Fix invalid company_id
      FOR rec IN 
        SELECT id, company_id
        FROM public.leads
        WHERE company_id IS NOT NULL 
          AND company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      LOOP
        RAISE NOTICE 'Found invalid company_id in leads: id=%, company_id=%', rec.id, rec.company_id;
        
        INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
        VALUES ('leads', 'company_id', rec.id::TEXT, rec.company_id, 'Invalid UUID - setting to NULL');
        
        UPDATE public.leads
        SET company_id = NULL
        WHERE id = rec.id;
      END LOOP;
    ELSE
      RAISE NOTICE 'leads.company_id is already uuid type, skipping invalid UUID check';
    END IF;
    
    -- Check data type of contact_id column
    SELECT data_type INTO contact_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'contact_id';
    
    -- Only check for invalid UUIDs if column is character varying (not already uuid)
    IF contact_id_type = 'character varying' THEN
      -- Fix invalid contact_id
      FOR rec IN 
        SELECT id, contact_id
        FROM public.leads
        WHERE contact_id IS NOT NULL 
          AND contact_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      LOOP
        RAISE NOTICE 'Found invalid contact_id in leads: id=%, contact_id=%', rec.id, rec.contact_id;
        
        INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
        VALUES ('leads', 'contact_id', rec.id::TEXT, rec.contact_id, 'Invalid UUID - setting to NULL');
        
        UPDATE public.leads
        SET contact_id = NULL
        WHERE id = rec.id;
      END LOOP;
    ELSE
      RAISE NOTICE 'leads.contact_id is already uuid type, skipping invalid UUID check';
    END IF;
  END IF;
END $$;

-- Fix orphaned contact_id in customers (valid UUID but contact doesn't exist)
-- Strategy: Create placeholder contacts (contact_id has NOT NULL constraint)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT c.id, c.tenant_id, c.company_id, c.contact_id
    FROM public.customers c
    LEFT JOIN public.company_contacts cc ON c.contact_id::uuid = cc.id
    WHERE c.contact_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND cc.id IS NULL
  LOOP
    RAISE NOTICE 'Found orphaned contact_id in customers: id=%, contact_id=%', rec.id, rec.contact_id;
    
    DECLARE
      placeholder_company_id UUID;
    BEGIN
      -- Get or create a company for this contact
      IF rec.company_id IS NOT NULL AND rec.company_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        placeholder_company_id := rec.company_id::uuid;
      ELSE
        -- Create a placeholder company if customer doesn't have one
        INSERT INTO public.companies (
          id, 
          tenant_id, 
          business_name,
          business_record_type,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          rec.tenant_id::uuid,  -- Cast to uuid
          'Recovered Customer Company',
          'Customer',
          NOW(),
          NOW()
        ) RETURNING id INTO placeholder_company_id;
        
        RAISE NOTICE '  → Created placeholder company: id=%', placeholder_company_id;
      END IF;
      
      -- Create the missing contact using the orphaned UUID
      INSERT INTO public.company_contacts (
        id,
        tenant_id,
        company_id,
        first_name,
        last_name,
        email,
        is_primary,
        created_at
      ) VALUES (
        rec.contact_id::uuid,  -- Use the existing UUID
        rec.tenant_id::uuid,   -- Cast to uuid
        placeholder_company_id,
        'Recovered',
        'Contact',
        'recovered-' || rec.contact_id || '@placeholder.local',
        true,
        NOW()
      );
      
      RAISE NOTICE '  → Created placeholder contact with existing UUID: id=%', rec.contact_id;
      
      INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
      VALUES (
        'customers', 
        'contact_id', 
        rec.id::TEXT, 
        rec.contact_id, 
        'Orphaned - created placeholder contact'
      );
      
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE '  → Contact already exists (race condition handled)';
    WHEN OTHERS THEN
      RAISE NOTICE '  → ERROR creating placeholder contact: %', SQLERRM;
      INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
      VALUES ('customers', 'contact_id', rec.id::TEXT, rec.contact_id, 'ERROR: ' || SQLERRM);
    END;
  END LOOP;
END $$;

-- Fix orphaned company_contacts (valid UUID but company doesn't exist)
DO $$
DECLARE
  rec RECORD;
  placeholder_company_id UUID;
BEGIN
  FOR rec IN 
    SELECT cc.id, cc.tenant_id, cc.company_id, cc.first_name, cc.last_name, cc.email
    FROM public.company_contacts cc
    LEFT JOIN public.companies co ON cc.company_id::uuid = co.id
    WHERE cc.company_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND co.id IS NULL
  LOOP
    RAISE NOTICE 'Found orphaned company_contact: id=%, company_id=%, contact=%', rec.id, rec.company_id, rec.email;
    
    DECLARE
      company_name TEXT;
      email_domain TEXT;
    BEGIN
      IF rec.email IS NOT NULL AND rec.email ~ '@' THEN
        email_domain := split_part(rec.email, '@', 2);
        company_name := initcap(split_part(email_domain, '.', 1)) || ' (Recovered)';
      ELSE
        company_name := rec.first_name || ' ' || rec.last_name || ' Company (Recovered)';
      END IF;
      
      -- Create company with the orphaned UUID
      INSERT INTO public.companies (
        id, 
        tenant_id, 
        business_name,
        email,
        business_record_type,
        created_at,
        updated_at
      ) VALUES (
        rec.company_id::uuid,  -- Use the existing UUID
        rec.tenant_id,
        company_name,
        rec.email,
        'Customer',
        NOW(),
        NOW()
      );
      
      RAISE NOTICE '  → Created company with existing UUID: id=%, name=%', rec.company_id, company_name;
      
      INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
      VALUES (
        'company_contacts', 
        'company_id', 
        rec.id::TEXT, 
        rec.company_id, 
        'Orphaned - created company: ' || company_name
      );
      
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE '  → Company already exists (race condition handled)';
    WHEN OTHERS THEN
      RAISE NOTICE '  → ERROR creating company: %', SQLERRM;
      INSERT INTO cleanup_log (table_name, column_name, record_id, old_value, action)
      VALUES ('company_contacts', 'company_id', rec.id::TEXT, rec.company_id, 'ERROR: ' || SQLERRM);
    END;
  END LOOP;
END $$;

-- Display summary of changes
SELECT 
  table_name,
  column_name,
  COUNT(*) as records_fixed,
  LEFT(action, 50) as action_summary
FROM cleanup_log
GROUP BY table_name, column_name, LEFT(action, 50)
ORDER BY table_name, column_name;

-- Display detailed log
SELECT 
  table_name,
  column_name,
  record_id,
  old_value,
  action,
  timestamp
FROM cleanup_log 
ORDER BY timestamp;

COMMIT;

-- Instructions for next steps:
-- 1. Review the cleanup log above
-- 2. If everything looks good, proceed with: migrations/002_add_foreign_key_constraints.sql
-- 3. After migration, you may need to manually link these records to proper companies
