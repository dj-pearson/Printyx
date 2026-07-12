-- Add missing columns that LeadsManagement component expects

-- Territory field
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS territory varchar;

-- Employee count
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS employee_count integer;

-- Annual revenue
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS annual_revenue numeric(15, 2);

-- Next follow-up date
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS next_follow_up_date timestamp;

-- Lead score
ALTER TABLE public.business_records 
ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;

SELECT 'Additional columns added successfully' AS status;

