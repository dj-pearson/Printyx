-- Fix tasks table: add any missing columns and grant access

-- Add missing columns from both schema definitions
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamp;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_percentage integer DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_hours integer;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS actual_hours integer;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS customer_id varchar;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id varchar;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date timestamp;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS dependencies jsonb DEFAULT '[]';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS watchers jsonb DEFAULT '[]';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS time_tracked integer DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_count integer DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';

-- Verify columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tasks'
ORDER BY ordinal_position;
