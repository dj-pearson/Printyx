-- Migration: Add Foreign Key Constraints for Companies Architecture
-- Date: 2026-01-15
-- Purpose: Add missing foreign key constraints to enable PostgREST joins

BEGIN;

-- First, fix data type mismatches
-- companies.id is uuid, but customers.company_id and company_contacts.company_id are character varying
-- We need to convert them to uuid for foreign key constraints to work

-- Convert company_contacts.company_id from character varying to uuid
DO $$ 
BEGIN
  -- Check if column is already uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'company_contacts' 
    AND column_name = 'company_id' 
    AND data_type = 'character varying'
  ) THEN
    -- Check for any invalid values first
    DECLARE
      invalid_count INT;
    BEGIN
      SELECT COUNT(*) INTO invalid_count
      FROM public.company_contacts
      WHERE company_id IS NOT NULL 
        AND company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      
      IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % invalid UUID values in company_contacts.company_id. Run 002_data_cleanup.sql first.', invalid_count;
      END IF;
    END;
    
    -- Convert to uuid using CAST (NULL values will remain NULL)
    ALTER TABLE public.company_contacts 
      ALTER COLUMN company_id TYPE uuid USING company_id::uuid;
  END IF;
END $$;

-- Convert customers.company_id from character varying to uuid
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'customers' 
    AND column_name = 'company_id' 
    AND data_type = 'character varying'
  ) THEN
    -- Check for invalid values
    DECLARE
      invalid_count INT;
    BEGIN
      SELECT COUNT(*) INTO invalid_count
      FROM public.customers
      WHERE company_id IS NOT NULL 
        AND company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      
      IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % invalid UUID values in customers.company_id. Run 002_data_cleanup.sql first.', invalid_count;
      END IF;
    END;
    
    ALTER TABLE public.customers 
      ALTER COLUMN company_id TYPE uuid USING company_id::uuid;
  END IF;
END $$;

-- Convert customers.contact_id from character varying to uuid
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'customers' 
    AND column_name = 'contact_id' 
    AND data_type = 'character varying'
  ) THEN
    -- Check for invalid values
    DECLARE
      invalid_count INT;
    BEGIN
      SELECT COUNT(*) INTO invalid_count
      FROM public.customers
      WHERE contact_id IS NOT NULL 
        AND contact_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      
      IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % invalid UUID values in customers.contact_id. Run 002_data_cleanup.sql first.', invalid_count;
      END IF;
    END;
    
    ALTER TABLE public.customers 
      ALTER COLUMN contact_id TYPE uuid USING contact_id::uuid;
  END IF;
END $$;

-- Convert leads.company_id from character varying to uuid (if exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'leads' 
    AND column_name = 'company_id' 
    AND data_type = 'character varying'
  ) THEN
    -- Check for invalid values
    DECLARE
      invalid_count INT;
    BEGIN
      SELECT COUNT(*) INTO invalid_count
      FROM public.leads
      WHERE company_id IS NOT NULL 
        AND company_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      
      IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % invalid UUID values in leads.company_id. Run 002_data_cleanup.sql first.', invalid_count;
      END IF;
    END;
    
    ALTER TABLE public.leads 
      ALTER COLUMN company_id TYPE uuid USING company_id::uuid;
  END IF;
END $$;

-- Convert leads.contact_id from character varying to uuid (if exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'leads' 
    AND column_name = 'contact_id' 
    AND data_type = 'character varying'
  ) THEN
    -- Check for invalid values
    DECLARE
      invalid_count INT;
    BEGIN
      SELECT COUNT(*) INTO invalid_count
      FROM public.leads
      WHERE contact_id IS NOT NULL 
        AND contact_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      
      IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % invalid UUID values in leads.contact_id. Run 002_data_cleanup.sql first.', invalid_count;
      END IF;
    END;
    
    ALTER TABLE public.leads 
      ALTER COLUMN contact_id TYPE uuid USING contact_id::uuid;
  END IF;
END $$;

-- Add foreign key from customers to companies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customers_company_id_fkey'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_company_id_fkey 
      FOREIGN KEY (company_id) 
      REFERENCES public.companies(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from customers to company_contacts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customers_contact_id_fkey'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_contact_id_fkey 
      FOREIGN KEY (contact_id) 
      REFERENCES public.company_contacts(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key from company_contacts to companies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'company_contacts_company_id_fkey'
  ) THEN
    ALTER TABLE public.company_contacts
      ADD CONSTRAINT company_contacts_company_id_fkey 
      FOREIGN KEY (company_id) 
      REFERENCES public.companies(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from leads to companies (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_company_id_fkey'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_company_id_fkey 
      FOREIGN KEY (company_id) 
      REFERENCES public.companies(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from leads to company_contacts (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_contact_id_fkey'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_contact_id_fkey 
      FOREIGN KEY (contact_id) 
      REFERENCES public.company_contacts(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_contact_id ON public.customers(contact_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_company_id ON public.company_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_tenant_id ON public.company_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON public.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON public.leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);

COMMIT;
