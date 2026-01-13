-- Create business_record_activities table (CORRECT architecture - separate from business_records)

CREATE TABLE IF NOT EXISTS public.business_record_activities (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id varchar NOT NULL,
    business_record_id varchar NOT NULL, -- Links to business_records table
    
    -- Activity Details
    activity_type varchar NOT NULL, -- email, call, meeting, demo, proposal, task, note, etc.
    subject varchar NOT NULL,
    description text,
    direction varchar, -- inbound, outbound
    
    -- Email Information
    email_from varchar,
    email_to text, -- JSON array for multiple recipients
    email_cc text,
    email_subject varchar,
    email_body text,
    is_shared boolean DEFAULT false,
    
    -- Call Information
    call_duration integer, -- in minutes
    call_outcome varchar, -- answered, no_answer, busy, voicemail
    
    -- Scheduling
    scheduled_date timestamp,
    completed_date timestamp,
    due_date timestamp,
    
    -- Outcomes & Follow-up
    outcome varchar, -- completed, no_response, rescheduled, cancelled, replied
    next_action text,
    follow_up_date timestamp,
    
    -- Related Records & Attachments
    related_records jsonb, -- Links to deals, agreements, etc.
    attachments jsonb, -- File references
    
    -- Tracking
    created_by varchar NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_record_activities_tenant_id ON public.business_record_activities (tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_record_activities_business_record_id ON public.business_record_activities (business_record_id);
CREATE INDEX IF NOT EXISTS idx_business_record_activities_activity_type ON public.business_record_activities (activity_type);
CREATE INDEX IF NOT EXISTS idx_business_record_activities_created_at ON public.business_record_activities (created_at DESC);

-- Enable RLS
ALTER TABLE public.business_record_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own tenant activities" ON public.business_record_activities;
DROP POLICY IF EXISTS "Users can insert own tenant activities" ON public.business_record_activities;
DROP POLICY IF EXISTS "Users can update own tenant activities" ON public.business_record_activities;
DROP POLICY IF EXISTS "Users can delete own tenant activities" ON public.business_record_activities;

-- RLS Policies for multi-tenant access
CREATE POLICY "Users can view own tenant activities" ON public.business_record_activities
FOR SELECT TO authenticated
USING (
    (tenant_id::text = (auth.jwt() -> 'app_metadata'::text) ->> 'tenantId'::text)
);

CREATE POLICY "Users can insert own tenant activities" ON public.business_record_activities
FOR INSERT TO authenticated
WITH CHECK (
    (tenant_id::text = (auth.jwt() -> 'app_metadata'::text) ->> 'tenantId'::text)
);

CREATE POLICY "Users can update own tenant activities" ON public.business_record_activities
FOR UPDATE TO authenticated
USING (
    (tenant_id::text = (auth.jwt() -> 'app_metadata'::text) ->> 'tenantId'::text)
);

CREATE POLICY "Users can delete own tenant activities" ON public.business_record_activities
FOR DELETE TO authenticated
USING (
    (tenant_id::text = (auth.jwt() -> 'app_metadata'::text) ->> 'tenantId'::text)
);

-- Grant permissions
GRANT ALL ON TABLE public.business_record_activities TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_record_activities TO authenticated;

SELECT 'business_record_activities table created successfully' AS status;

