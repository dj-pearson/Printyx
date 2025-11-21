-- Task Management Migration
-- Adds comprehensive task management with AI scheduling capabilities
-- Created: September 26, 2025

-- Task Categories (for organizing tasks)
CREATE TABLE IF NOT EXISTS task_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code
    icon VARCHAR(50), -- Icon name for UI
    is_system BOOLEAN DEFAULT false, -- System-defined categories
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Enhanced Tasks Table (extends existing functionality)
CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium', -- asap, high, medium, low
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled, on_hold
    
    -- Scheduling fields
    due_date TIMESTAMP,
    estimated_duration INTEGER, -- in minutes
    actual_duration INTEGER, -- in minutes (when completed)
    start_date TIMESTAMP,
    completion_date TIMESTAMP,
    
    -- Dependencies
    depends_on JSONB DEFAULT '[]', -- Array of task IDs this task depends on
    blocks JSONB DEFAULT '[]', -- Array of task IDs this task blocks
    
    -- AI scheduling fields
    ai_suggested_start TIMESTAMP,
    ai_suggested_end TIMESTAMP,
    ai_priority_score DECIMAL(5,2), -- AI-calculated priority (0-100)
    ai_complexity_score DECIMAL(5,2), -- AI-estimated complexity (0-100)
    ai_scheduling_confidence DECIMAL(3,2), -- AI confidence in scheduling (0.00-1.00)
    ai_scheduling_reasoning TEXT,
    is_ai_scheduled BOOLEAN DEFAULT false,
    
    -- Context and relationships
    related_entity_type VARCHAR(50), -- 'lead', 'deal', 'project', 'customer'
    related_entity_id VARCHAR(255),
    project_id UUID, -- Link to projects if applicable
    
    -- Task metadata
    tags JSONB DEFAULT '[]', -- Array of tag strings
    attachments JSONB DEFAULT '[]', -- Array of attachment objects
    checklist JSONB DEFAULT '[]', -- Array of checklist items
    completion_percentage INTEGER DEFAULT 0, -- 0-100
    
    -- Tracking fields
    created_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Task Dependencies (for complex dependency management)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predecessor_task_id UUID REFERENCES ai_tasks(id) ON DELETE CASCADE,
    successor_task_id UUID REFERENCES ai_tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'finish_to_start', -- finish_to_start, start_to_start, finish_to_finish, start_to_finish
    lag_days INTEGER DEFAULT 0, -- Days to wait after predecessor
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(predecessor_task_id, successor_task_id)
);

-- Task Time Entries (for time tracking)
CREATE TABLE IF NOT EXISTS task_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES ai_tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INTEGER, -- Calculated duration
    description TEXT,
    is_billable BOOLEAN DEFAULT false,
    hourly_rate DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Task Comments/Activity Log
CREATE TABLE IF NOT EXISTS task_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES ai_tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- comment, status_change, assignment, completion, etc.
    content TEXT,
    metadata JSONB DEFAULT '{}', -- Additional activity data
    created_at TIMESTAMP DEFAULT NOW()
);

-- Task Templates (for recurring tasks)
CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,
    template_data JSONB NOT NULL, -- Task fields as template
    is_public BOOLEAN DEFAULT false, -- Available to all users in tenant
    usage_count INTEGER DEFAULT 0,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Task Suggestions (for intelligent task creation)
CREATE TABLE IF NOT EXISTS ai_task_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    suggested_task JSONB NOT NULL, -- Suggested task data
    suggestion_reason TEXT, -- Why AI suggested this task
    confidence_score DECIMAL(3,2), -- AI confidence (0.00-1.00)
    source_entity_type VARCHAR(50), -- What triggered the suggestion
    source_entity_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, dismissed
    created_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP,
    response_user_id VARCHAR(255)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_tasks_tenant_user 
ON ai_tasks(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status_priority 
ON ai_tasks(status, priority);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_due_date 
ON ai_tasks(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_tasks_ai_scheduled 
ON ai_tasks(ai_suggested_start, ai_suggested_end) WHERE is_ai_scheduled = true;

CREATE INDEX IF NOT EXISTS idx_ai_tasks_related_entity 
ON ai_tasks(related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_predecessor 
ON task_dependencies(predecessor_task_id);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_successor 
ON task_dependencies(successor_task_id);

CREATE INDEX IF NOT EXISTS idx_task_time_entries_task_user 
ON task_time_entries(task_id, user_id);

CREATE INDEX IF NOT EXISTS idx_task_activities_task_date 
ON task_activities(task_id, created_at);

-- Insert default task categories
INSERT INTO task_categories (tenant_id, name, description, color, icon, is_system) VALUES
('00000000-0000-0000-0000-000000000000', 'Sales', 'Sales-related tasks and follow-ups', '#10B981', 'DollarSign', true),
('00000000-0000-0000-0000-000000000000', 'Service', 'Customer service and support tasks', '#F59E0B', 'Wrench', true),
('00000000-0000-0000-0000-000000000000', 'Administrative', 'Administrative and operational tasks', '#6B7280', 'FileText', true),
('00000000-0000-0000-0000-000000000000', 'Follow-up', 'Customer and lead follow-up tasks', '#8B5CF6', 'Phone', true),
('00000000-0000-0000-0000-000000000000', 'Meeting', 'Meeting preparation and follow-up', '#EF4444', 'Calendar', true),
('00000000-0000-0000-0000-000000000000', 'Proposal', 'Proposal creation and management', '#3B82F6', 'FileEdit', true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE ai_tasks IS 'Enhanced task management with AI scheduling capabilities';
COMMENT ON TABLE task_dependencies IS 'Task dependency relationships for project management';
COMMENT ON TABLE task_time_entries IS 'Time tracking entries for tasks';
COMMENT ON TABLE ai_task_suggestions IS 'AI-generated task suggestions based on user behavior and context';
COMMENT ON COLUMN ai_tasks.ai_priority_score IS 'AI-calculated priority score (0-100) based on multiple factors';
COMMENT ON COLUMN ai_tasks.ai_complexity_score IS 'AI-estimated task complexity (0-100) for duration prediction';
