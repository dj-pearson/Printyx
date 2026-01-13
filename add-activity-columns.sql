-- Add activity-related columns to business_records table

-- Activity Type (call, email, meeting, note, etc.)
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS activity_type varchar;

-- Activity Subject/Title
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS activity_subject text;

-- Activity Notes/Description
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS notes text;

-- Activity Direction (inbound/outbound for calls and emails)
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS direction varchar;

-- Email fields
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS email_to varchar;

ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS email_cc varchar;

-- Activity Outcome
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS activity_outcome varchar;

-- Generic outcome (completed, no_response, rescheduled, cancelled)
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS outcome varchar;

-- Activity Duration (in minutes)
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS activity_duration integer;

-- Activity Date/Time
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS activity_date timestamp;

-- Due Date (for tasks)
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS due_date timestamp;

-- Completed Date
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS completed_date timestamp;

-- Next Action
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS next_action text;

-- Follow-up Date
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS follow_up_date timestamp;

-- Priority (for tasks)
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS priority varchar DEFAULT 'medium';

-- Related Business Record ID (for activities linked to a parent record)
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS related_to varchar;

SELECT 'Activity columns added successfully' AS status;

