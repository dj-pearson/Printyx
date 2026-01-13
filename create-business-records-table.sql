-- Create business_records table for leads/customers management
-- Simplified version with essential columns only

CREATE TABLE IF NOT EXISTS public.business_records (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id varchar NOT NULL,
    
    -- Record Type & Status
    record_type varchar NOT NULL DEFAULT 'lead',
    status varchar NOT NULL DEFAULT 'new',
    
    -- Company Information
    company_name varchar NOT NULL,
    website varchar,
    industry varchar,
    
    -- Primary Contact Information
    primary_contact_name varchar,
    primary_contact_email varchar,
    primary_contact_phone varchar,
    primary_contact_title varchar,
    
    -- Address Information
    address_line1 varchar,
    address_line2 varchar,
    city varchar,
    state varchar,
    postal_code varchar,
    country varchar DEFAULT 'US',
    
    -- Communication
    phone varchar,
    
    -- Lead Pipeline Information
    source varchar NOT NULL DEFAULT 'website',
    estimated_deal_value numeric(10, 2),
    probability integer DEFAULT 50,
    close_date timestamp,
    priority varchar DEFAULT 'medium',
    
    -- Assignment
    owner_id varchar,
    assigned_sales_rep varchar,
    
    -- Customer-Specific
    customer_number varchar UNIQUE,
    customer_since timestamp,
    
    -- Activity Tracking
    last_contact_date timestamp,
    next_follow_up timestamp,
    
    -- Notes
    notes text,
    
    -- Timestamps
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    created_by varchar,
    updated_by varchar
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_business_records_tenant ON public.business_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_records_type ON public.business_records(record_type);
CREATE INDEX IF NOT EXISTS idx_business_records_status ON public.business_records(status);
CREATE INDEX IF NOT EXISTS idx_business_records_owner ON public.business_records(owner_id);

-- Enable RLS
ALTER TABLE public.business_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own tenant business records" ON public.business_records;
DROP POLICY IF EXISTS "Users can insert own tenant business records" ON public.business_records;
DROP POLICY IF EXISTS "Users can update own tenant business records" ON public.business_records;
DROP POLICY IF EXISTS "Users can delete own tenant business records" ON public.business_records;

-- RLS Policies
CREATE POLICY "Users can view own tenant business records" ON public.business_records
FOR SELECT TO authenticated
USING (
    (tenant_id::text = (auth.jwt() -> 'app_metadata'::text) ->> 'tenantId'::text)
);

CREATE POLICY "Users can insert own tenant business records" ON public.business_records
FOR INSERT TO authenticated
WITH CHECK (
    (tenant_id::text = (auth.jwt() -> 'app_metadata'::text) ->> 'tenantId'::text)
);

CREATE POLICY "Users can update own tenant business records" ON public.business_records
FOR UPDATE TO authenticated
USING (
    (tenant_id::text = (auth.jwt() -> 'app_metadata'::text) ->> 'tenantId'::text)
);

CREATE POLICY "Users can delete own tenant business records" ON public.business_records
FOR DELETE TO authenticated
USING (
    (tenant_id::text = (auth.jwt() -> 'app_metadata'::text) ->> 'tenantId'::text)
);

-- Grant permissions
GRANT ALL ON TABLE public.business_records TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_records TO authenticated;

-- Verify table creation
SELECT 'business_records table created successfully' AS status;

