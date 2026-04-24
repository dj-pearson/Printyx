-- ============================================================================
-- ai-employee-tables.sql — schema safety net for Phase 5 US-020 (AI features).
--
-- Source of truth: migrations/ai-employees-migration.sql (already applied on
-- the main DB). This file is the idempotent replay — CREATE TABLE IF NOT
-- EXISTS for every table the ai-employee edge function reads or writes, plus
-- ADD COLUMN IF NOT EXISTS for the small set of fields added after the
-- original migration.
--
-- Run order:
--   \i drizzle/rls/apply-rls.sql             # upgrades apply_tenant_rls()
--   \i drizzle/rls/ai-employee-tables.sql    # this file
--   \i drizzle/rls/ai-employee.sql           # RLS policies
-- ============================================================================

BEGIN;

-- ─── ai_employees ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_name varchar(255) NOT NULL,
  employee_type varchar(100) NOT NULL,
  employee_role varchar(255) NOT NULL,
  employee_avatar_url text,
  ai_model varchar(100) DEFAULT 'claude-3-5-sonnet-20241022',
  ai_personality jsonb DEFAULT '{}',
  ai_expertise_areas jsonb DEFAULT '[]',
  ai_capabilities jsonb DEFAULT '[]',
  ai_constraints jsonb DEFAULT '[]',
  autonomy_level varchar(50) DEFAULT 'supervised',
  decision_threshold numeric(3,2) DEFAULT 0.8,
  escalation_rules jsonb DEFAULT '[]',
  working_hours jsonb DEFAULT '{}',
  success_rate numeric(3,2) DEFAULT 0.0,
  total_tasks_completed integer DEFAULT 0,
  average_task_completion_time_minutes integer DEFAULT 0,
  user_satisfaction_rating numeric(2,1) DEFAULT 0.0,
  learning_data jsonb DEFAULT '{}',
  system_permissions jsonb DEFAULT '[]',
  api_rate_limits jsonb DEFAULT '{}',
  cost_budget_monthly numeric(10,2),
  current_month_costs numeric(10,2) DEFAULT 0.0,
  status varchar(50) DEFAULT 'active',
  created_by uuid NOT NULL,
  last_active_at timestamp,
  training_completion_percentage integer DEFAULT 0,
  tasks_assigned integer DEFAULT 0,
  tasks_completed integer DEFAULT 0,
  tasks_failed integer DEFAULT 0,
  average_response_time_ms integer DEFAULT 0,
  created_at timestamp DEFAULT current_timestamp,
  updated_at timestamp DEFAULT current_timestamp
);
-- unique(tenant_id, employee_name) — deferred; live DB may already have it.
CREATE INDEX IF NOT EXISTS idx_ai_employees_tenant_type ON ai_employees(tenant_id, employee_type);
CREATE INDEX IF NOT EXISTS idx_ai_employees_status ON ai_employees(status, autonomy_level);

-- ─── ai_employee_tasks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_employee_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid,
  task_type varchar(100) NOT NULL,
  task_title varchar(255) NOT NULL,
  task_description text,
  task_priority varchar(50) DEFAULT 'medium',
  task_context jsonb NOT NULL DEFAULT '{}',
  input_data jsonb DEFAULT '{}',
  expected_output jsonb DEFAULT '{}',
  assigned_at timestamp DEFAULT current_timestamp,
  started_at timestamp,
  completed_at timestamp,
  due_date timestamp,
  status varchar(50) DEFAULT 'assigned',
  progress_percentage integer DEFAULT 0,
  current_step varchar(255),
  task_result jsonb DEFAULT '{}',
  quality_score integer,
  human_review_required boolean DEFAULT false,
  human_review_status varchar(50),
  execution_time_minutes integer,
  ai_confidence_score numeric(3,2),
  retry_count integer DEFAULT 0,
  error_messages jsonb DEFAULT '[]',
  parent_task_id uuid,
  workflow_id uuid,
  depends_on_tasks jsonb DEFAULT '[]',
  ai_tokens_used integer DEFAULT 0,
  estimated_cost numeric(10,4) DEFAULT 0.0,
  actual_cost numeric(10,4) DEFAULT 0.0,
  created_at timestamp DEFAULT current_timestamp,
  updated_at timestamp DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS idx_ai_employee_tasks_employee ON ai_employee_tasks(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_employee_tasks_status ON ai_employee_tasks(status, task_priority, due_date);

-- ─── ai_employee_workflows ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_employee_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workflow_name varchar(255) NOT NULL,
  workflow_type varchar(100) NOT NULL,
  workflow_description text,
  workflow_version varchar(50) DEFAULT '1.0',
  workflow_steps jsonb NOT NULL DEFAULT '[]',
  decision_points jsonb DEFAULT '[]',
  employee_assignments jsonb DEFAULT '{}',
  trigger_conditions jsonb DEFAULT '[]',
  input_requirements jsonb DEFAULT '{}',
  success_criteria jsonb DEFAULT '{}',
  average_completion_time_minutes integer DEFAULT 0,
  success_rate numeric(3,2) DEFAULT 0.0,
  total_executions integer DEFAULT 0,
  optimization_suggestions jsonb DEFAULT '[]',
  status varchar(50) DEFAULT 'active',
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamp,
  created_at timestamp DEFAULT current_timestamp,
  updated_at timestamp DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS idx_ai_workflows_tenant_type ON ai_employee_workflows(tenant_id, workflow_type);

-- ─── ai_workflow_executions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  workflow_id uuid,
  triggered_by varchar(100),
  trigger_data jsonb DEFAULT '{}',
  input_data jsonb DEFAULT '{}',
  started_at timestamp DEFAULT current_timestamp,
  completed_at timestamp,
  current_step_index integer DEFAULT 0,
  current_step_name varchar(255),
  status varchar(50) DEFAULT 'running',
  final_result jsonb DEFAULT '{}',
  error_details jsonb DEFAULT '{}',
  total_execution_time_minutes integer,
  steps_completed integer DEFAULT 0,
  steps_failed integer DEFAULT 0,
  human_interventions integer DEFAULT 0,
  total_ai_tokens_used integer DEFAULT 0,
  total_cost numeric(10,4) DEFAULT 0.0,
  employees_involved jsonb DEFAULT '[]',
  created_at timestamp DEFAULT current_timestamp,
  updated_at timestamp DEFAULT current_timestamp
);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_executions_workflow ON ai_workflow_executions(workflow_id, status);

-- ─── ai_employee_skills ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_employee_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid,
  skill_name varchar(255) NOT NULL,
  skill_category varchar(100) NOT NULL,
  skill_description text,
  proficiency_level integer DEFAULT 1,
  confidence_score numeric(3,2) DEFAULT 0.5,
  success_rate numeric(3,2) DEFAULT 0.0,
  training_data jsonb DEFAULT '{}',
  practice_opportunities integer DEFAULT 0,
  improvement_suggestions jsonb DEFAULT '[]',
  times_used integer DEFAULT 0,
  last_used_at timestamp,
  average_performance_score numeric(3,2) DEFAULT 0.0,
  created_at timestamp DEFAULT current_timestamp,
  updated_at timestamp DEFAULT current_timestamp
);
-- Unique is required by the skills upsert (onConflict below). Live DB may
-- already have it as a constraint under a different name — the next statement
-- skips silently if present.
DO $$ BEGIN
  ALTER TABLE ai_employee_skills
    ADD CONSTRAINT ai_employee_skills_unique UNIQUE (tenant_id, employee_id, skill_name);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_ai_employee_skills_employee ON ai_employee_skills(employee_id, skill_category);

COMMIT;
