-- AI Employee Framework Migration
-- Adds specialized AI agents, workflows, and autonomous task management
-- Created: September 26, 2025

-- AI Employee definitions and configurations
CREATE TABLE IF NOT EXISTS ai_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Employee identity
    employee_name VARCHAR(255) NOT NULL,
    employee_type VARCHAR(100) NOT NULL, -- 'sales_assistant', 'support_agent', 'data_analyst', 'project_manager', 'custom'
    employee_role VARCHAR(255) NOT NULL, -- Human-readable role description
    employee_avatar_url TEXT,
    
    -- AI Configuration
    ai_model VARCHAR(100) DEFAULT 'claude-3-5-sonnet-20241022',
    ai_personality JSONB DEFAULT '{}', -- personality traits, communication style
    ai_expertise_areas JSONB DEFAULT '[]', -- areas of specialization
    ai_capabilities JSONB DEFAULT '[]', -- specific capabilities this employee can perform
    ai_constraints JSONB DEFAULT '[]', -- what this employee cannot or should not do
    
    -- Behavior and autonomy
    autonomy_level VARCHAR(50) DEFAULT 'supervised', -- 'supervised', 'semi_autonomous', 'autonomous'
    decision_threshold DECIMAL(3,2) DEFAULT 0.8, -- confidence threshold for autonomous decisions
    escalation_rules JSONB DEFAULT '[]', -- when to escalate to humans
    working_hours JSONB DEFAULT '{}', -- when this employee is "available"
    
    -- Performance and learning
    success_rate DECIMAL(3,2) DEFAULT 0.0,
    total_tasks_completed INTEGER DEFAULT 0,
    average_task_completion_time_minutes INTEGER DEFAULT 0,
    user_satisfaction_rating DECIMAL(2,1) DEFAULT 0.0,
    learning_data JSONB DEFAULT '{}', -- accumulated learning and improvements
    
    -- Integration and access
    system_permissions JSONB DEFAULT '[]', -- which systems/data this employee can access
    api_rate_limits JSONB DEFAULT '{}', -- rate limiting for API calls
    cost_budget_monthly DECIMAL(10,2), -- monthly budget for AI API costs
    current_month_costs DECIMAL(10,2) DEFAULT 0.0,
    
    -- Status and lifecycle
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'training', 'suspended'
    created_by UUID NOT NULL,
    last_active_at TIMESTAMP,
    training_completion_percentage INTEGER DEFAULT 0,
    
    -- Metrics and analytics
    tasks_assigned INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    average_response_time_ms INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, employee_name)
);

-- AI Employee tasks and work assignments
CREATE TABLE IF NOT EXISTS ai_employee_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID REFERENCES ai_employees(id) ON DELETE CASCADE,
    
    -- Task definition
    task_type VARCHAR(100) NOT NULL, -- 'lead_qualification', 'customer_support', 'data_analysis', 'report_generation'
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    task_priority VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    
    -- Task context and data
    task_context JSONB NOT NULL DEFAULT '{}', -- all data needed to complete the task
    input_data JSONB DEFAULT '{}', -- specific input data for this task
    expected_output JSONB DEFAULT '{}', -- what output is expected
    
    -- Execution details
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    due_date TIMESTAMP,
    
    -- Status and progress
    status VARCHAR(50) DEFAULT 'assigned', -- 'assigned', 'in_progress', 'completed', 'failed', 'escalated', 'cancelled'
    progress_percentage INTEGER DEFAULT 0,
    current_step VARCHAR(255), -- current step in the task workflow
    
    -- Results and output
    task_result JSONB DEFAULT '{}', -- final output/result of the task
    quality_score INTEGER, -- AI assessment of result quality (1-100)
    human_review_required BOOLEAN DEFAULT FALSE,
    human_review_status VARCHAR(50), -- 'pending', 'approved', 'rejected', 'needs_revision'
    
    -- Performance tracking
    execution_time_minutes INTEGER,
    ai_confidence_score DECIMAL(3,2), -- AI confidence in the result
    retry_count INTEGER DEFAULT 0,
    error_messages JSONB DEFAULT '[]',
    
    -- Workflow and dependencies
    parent_task_id UUID REFERENCES ai_employee_tasks(id) ON DELETE SET NULL,
    workflow_id UUID, -- reference to workflow if part of larger process
    depends_on_tasks JSONB DEFAULT '[]', -- task IDs this task depends on
    
    -- Cost tracking
    ai_tokens_used INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10,4) DEFAULT 0.0,
    actual_cost DECIMAL(10,4) DEFAULT 0.0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Employee workflows and process definitions
CREATE TABLE IF NOT EXISTS ai_employee_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Workflow definition
    workflow_name VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(100) NOT NULL, -- 'lead_processing', 'customer_onboarding', 'support_escalation'
    workflow_description TEXT,
    workflow_version VARCHAR(50) DEFAULT '1.0',
    
    -- Workflow configuration
    workflow_steps JSONB NOT NULL DEFAULT '[]', -- ordered array of workflow steps
    decision_points JSONB DEFAULT '[]', -- conditional logic and branching
    employee_assignments JSONB DEFAULT '{}', -- which employees handle which steps
    
    -- Triggers and conditions
    trigger_conditions JSONB DEFAULT '[]', -- when this workflow should be triggered
    input_requirements JSONB DEFAULT '{}', -- required input data
    success_criteria JSONB DEFAULT '{}', -- how to determine workflow success
    
    -- Performance and optimization
    average_completion_time_minutes INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 0.0,
    total_executions INTEGER DEFAULT 0,
    optimization_suggestions JSONB DEFAULT '[]',
    
    -- Status and lifecycle
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'draft', 'deprecated'
    created_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, workflow_name, workflow_version)
);

-- AI Employee workflow executions
CREATE TABLE IF NOT EXISTS ai_workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    workflow_id UUID REFERENCES ai_employee_workflows(id) ON DELETE CASCADE,
    
    -- Execution context
    triggered_by VARCHAR(100), -- 'user_action', 'scheduled', 'event', 'api_call'
    trigger_data JSONB DEFAULT '{}',
    input_data JSONB DEFAULT '{}',
    
    -- Execution tracking
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    current_step_index INTEGER DEFAULT 0,
    current_step_name VARCHAR(255),
    
    -- Status and results
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed', 'paused', 'cancelled'
    final_result JSONB DEFAULT '{}',
    error_details JSONB DEFAULT '{}',
    
    -- Performance metrics
    total_execution_time_minutes INTEGER,
    steps_completed INTEGER DEFAULT 0,
    steps_failed INTEGER DEFAULT 0,
    human_interventions INTEGER DEFAULT 0,
    
    -- Cost and resource usage
    total_ai_tokens_used INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.0,
    employees_involved JSONB DEFAULT '[]', -- list of employee IDs that worked on this
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Employee skills and competencies
CREATE TABLE IF NOT EXISTS ai_employee_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID REFERENCES ai_employees(id) ON DELETE CASCADE,
    
    -- Skill definition
    skill_name VARCHAR(255) NOT NULL,
    skill_category VARCHAR(100) NOT NULL, -- 'communication', 'analysis', 'technical', 'domain_specific'
    skill_description TEXT,
    
    -- Proficiency and performance
    proficiency_level INTEGER DEFAULT 1, -- 1-10 scale
    confidence_score DECIMAL(3,2) DEFAULT 0.5,
    success_rate DECIMAL(3,2) DEFAULT 0.0,
    
    -- Learning and improvement
    training_data JSONB DEFAULT '{}',
    practice_opportunities INTEGER DEFAULT 0,
    improvement_suggestions JSONB DEFAULT '[]',
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    average_performance_score DECIMAL(3,2) DEFAULT 0.0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, employee_id, skill_name)
);

-- AI Employee interactions and communications
CREATE TABLE IF NOT EXISTS ai_employee_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID REFERENCES ai_employees(id) ON DELETE CASCADE,
    
    -- Interaction details
    interaction_type VARCHAR(100) NOT NULL, -- 'customer_chat', 'email_response', 'internal_communication', 'system_notification'
    interaction_channel VARCHAR(100), -- 'chat', 'email', 'phone', 'api', 'internal'
    
    -- Participants
    human_participant_id UUID, -- user or customer involved
    other_employee_ids JSONB DEFAULT '[]', -- other AI employees involved
    external_system VARCHAR(100), -- external system if applicable
    
    -- Content and context
    interaction_subject VARCHAR(255),
    interaction_content TEXT,
    interaction_context JSONB DEFAULT '{}',
    sentiment_analysis JSONB DEFAULT '{}',
    
    -- Timing and duration
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    response_time_ms INTEGER,
    
    -- Outcomes and results
    interaction_outcome VARCHAR(100), -- 'resolved', 'escalated', 'pending', 'failed'
    satisfaction_rating INTEGER, -- 1-5 from participant
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date TIMESTAMP,
    
    -- Performance metrics
    ai_confidence_in_response DECIMAL(3,2),
    human_intervention_required BOOLEAN DEFAULT FALSE,
    quality_score INTEGER, -- 1-100
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Employee learning and training records
CREATE TABLE IF NOT EXISTS ai_employee_training (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID REFERENCES ai_employees(id) ON DELETE CASCADE,
    
    -- Training session details
    training_type VARCHAR(100) NOT NULL, -- 'initial_setup', 'skill_improvement', 'domain_knowledge', 'performance_tuning'
    training_topic VARCHAR(255) NOT NULL,
    training_description TEXT,
    
    -- Training data and methods
    training_data JSONB DEFAULT '{}',
    training_method VARCHAR(100), -- 'supervised_learning', 'reinforcement_learning', 'knowledge_base_update'
    data_sources JSONB DEFAULT '[]',
    
    -- Training progress
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    progress_percentage INTEGER DEFAULT 0,
    
    -- Results and improvements
    pre_training_performance JSONB DEFAULT '{}',
    post_training_performance JSONB DEFAULT '{}',
    improvement_metrics JSONB DEFAULT '{}',
    
    -- Validation and testing
    validation_results JSONB DEFAULT '{}',
    test_scenarios_passed INTEGER DEFAULT 0,
    test_scenarios_failed INTEGER DEFAULT 0,
    
    -- Status and approval
    status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed', 'cancelled'
    approved_by UUID,
    approved_at TIMESTAMP,
    deployment_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Employee performance analytics
CREATE TABLE IF NOT EXISTS ai_employee_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    employee_id UUID REFERENCES ai_employees(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    
    -- Daily performance metrics
    tasks_assigned INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    average_completion_time_minutes INTEGER DEFAULT 0,
    
    -- Quality metrics
    average_quality_score DECIMAL(3,2) DEFAULT 0.0,
    customer_satisfaction_rating DECIMAL(2,1) DEFAULT 0.0,
    human_intervention_rate DECIMAL(3,2) DEFAULT 0.0,
    error_rate DECIMAL(3,2) DEFAULT 0.0,
    
    -- Cost and efficiency
    total_ai_tokens_used INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.0,
    cost_per_task DECIMAL(10,4) DEFAULT 0.0,
    roi_estimate DECIMAL(10,2), -- estimated return on investment
    
    -- Learning and improvement
    new_skills_acquired INTEGER DEFAULT 0,
    skill_improvements INTEGER DEFAULT 0,
    training_hours DECIMAL(5,2) DEFAULT 0.0,
    
    -- Interaction metrics
    total_interactions INTEGER DEFAULT 0,
    successful_interactions INTEGER DEFAULT 0,
    escalated_interactions INTEGER DEFAULT 0,
    average_response_time_ms INTEGER DEFAULT 0,
    
    -- Comparative analysis
    performance_vs_baseline DECIMAL(3,2) DEFAULT 1.0, -- 1.0 = baseline, >1.0 = above baseline
    performance_trend VARCHAR(50), -- 'improving', 'stable', 'declining'
    benchmark_score INTEGER, -- score compared to similar employees (1-100)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, employee_id, analysis_date)
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_ai_employees_tenant_type ON ai_employees(tenant_id, employee_type);
CREATE INDEX IF NOT EXISTS idx_ai_employees_status ON ai_employees(status, autonomy_level);

CREATE INDEX IF NOT EXISTS idx_ai_employee_tasks_employee ON ai_employee_tasks(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_employee_tasks_status ON ai_employee_tasks(status, priority, due_date);
CREATE INDEX IF NOT EXISTS idx_ai_employee_tasks_workflow ON ai_employee_tasks(workflow_id);

CREATE INDEX IF NOT EXISTS idx_ai_workflows_tenant_type ON ai_employee_workflows(tenant_id, workflow_type);
CREATE INDEX IF NOT EXISTS idx_ai_workflows_status ON ai_employee_workflows(status);

CREATE INDEX IF NOT EXISTS idx_ai_workflow_executions_workflow ON ai_workflow_executions(workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_executions_date ON ai_workflow_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_ai_employee_skills_employee ON ai_employee_skills(employee_id, skill_category);
CREATE INDEX IF NOT EXISTS idx_ai_employee_interactions_employee ON ai_employee_interactions(employee_id, interaction_type);
CREATE INDEX IF NOT EXISTS idx_ai_employee_training_employee ON ai_employee_training(employee_id, training_type);
CREATE INDEX IF NOT EXISTS idx_ai_employee_analytics_employee_date ON ai_employee_analytics(employee_id, analysis_date);

-- Insert default AI employee templates
INSERT INTO ai_employees (id, tenant_id, employee_name, employee_type, employee_role, ai_personality, ai_expertise_areas, ai_capabilities, autonomy_level, created_by) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Sales Assistant AI', 'sales_assistant', 'AI Sales Representative specializing in lead qualification and customer engagement', 
 '{"communication_style": "professional_friendly", "proactivity": "high", "empathy_level": "medium"}',
 '["lead_qualification", "product_knowledge", "pricing_strategies", "objection_handling"]',
 '["lead_scoring", "email_outreach", "appointment_scheduling", "proposal_generation"]',
 'supervised', '00000000-0000-0000-0000-000000000000'),

('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Support Agent AI', 'support_agent', 'AI Customer Support Specialist for technical assistance and issue resolution',
 '{"communication_style": "helpful_patient", "problem_solving": "systematic", "escalation_readiness": "high"}',
 '["technical_troubleshooting", "product_support", "customer_communication", "issue_documentation"]',
 '["ticket_triage", "solution_research", "customer_communication", "knowledge_base_updates"]',
 'semi_autonomous', '00000000-0000-0000-0000-000000000000'),

('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'Data Analyst AI', 'data_analyst', 'AI Business Intelligence Analyst for data analysis and reporting',
 '{"analytical_approach": "thorough", "attention_to_detail": "high", "insight_generation": "creative"}',
 '["data_analysis", "statistical_modeling", "report_generation", "trend_identification"]',
 '["data_processing", "visualization_creation", "insight_generation", "predictive_modeling"]',
 'autonomous', '00000000-0000-0000-0000-000000000000'),

('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'Project Manager AI', 'project_manager', 'AI Project Coordinator for task management and team coordination',
 '{"leadership_style": "collaborative", "organization_level": "high", "communication_frequency": "regular"}',
 '["project_planning", "resource_allocation", "timeline_management", "stakeholder_communication"]',
 '["task_assignment", "progress_tracking", "risk_assessment", "status_reporting"]',
 'semi_autonomous', '00000000-0000-0000-0000-000000000000')

ON CONFLICT (id) DO NOTHING;

-- Insert default workflows
INSERT INTO ai_employee_workflows (id, tenant_id, workflow_name, workflow_type, workflow_description, workflow_steps, employee_assignments, created_by) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Lead Processing Workflow', 'lead_processing', 'Complete lead qualification and nurturing process',
 '[
   {"step": "lead_capture", "description": "Capture and validate lead information", "estimated_time": 5},
   {"step": "lead_scoring", "description": "Score lead based on qualification criteria", "estimated_time": 10},
   {"step": "initial_outreach", "description": "Send personalized outreach message", "estimated_time": 15},
   {"step": "follow_up_sequence", "description": "Execute follow-up communication sequence", "estimated_time": 30},
   {"step": "appointment_scheduling", "description": "Schedule qualified leads for sales calls", "estimated_time": 20}
 ]',
 '{"lead_capture": "system", "lead_scoring": "00000000-0000-0000-0000-000000000001", "initial_outreach": "00000000-0000-0000-0000-000000000001", "follow_up_sequence": "00000000-0000-0000-0000-000000000001", "appointment_scheduling": "00000000-0000-0000-0000-000000000001"}',
 '00000000-0000-0000-0000-000000000000'),

('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Customer Support Workflow', 'customer_support', 'Handle customer support requests from initial contact to resolution',
 '[
   {"step": "ticket_triage", "description": "Categorize and prioritize support ticket", "estimated_time": 3},
   {"step": "initial_response", "description": "Send acknowledgment and initial guidance", "estimated_time": 5},
   {"step": "issue_investigation", "description": "Research and analyze the customer issue", "estimated_time": 20},
   {"step": "solution_implementation", "description": "Provide solution or escalate if needed", "estimated_time": 15},
   {"step": "follow_up", "description": "Confirm resolution and customer satisfaction", "estimated_time": 10}
 ]',
 '{"ticket_triage": "00000000-0000-0000-0000-000000000002", "initial_response": "00000000-0000-0000-0000-000000000002", "issue_investigation": "00000000-0000-0000-0000-000000000002", "solution_implementation": "00000000-0000-0000-0000-000000000002", "follow_up": "00000000-0000-0000-0000-000000000002"}',
 '00000000-0000-0000-0000-000000000000')

ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE ai_employees IS 'AI employee definitions with capabilities, autonomy levels, and performance tracking';
COMMENT ON TABLE ai_employee_tasks IS 'Individual tasks assigned to AI employees with execution tracking and results';
COMMENT ON TABLE ai_employee_workflows IS 'Workflow definitions for complex multi-step processes involving AI employees';
COMMENT ON TABLE ai_workflow_executions IS 'Execution instances of workflows with performance and cost tracking';
COMMENT ON TABLE ai_employee_skills IS 'Skills and competencies of AI employees with proficiency tracking';
COMMENT ON TABLE ai_employee_interactions IS 'Communication and interaction records between AI employees and users/customers';
COMMENT ON TABLE ai_employee_training IS 'Training sessions and learning records for AI employee improvement';
COMMENT ON TABLE ai_employee_analytics IS 'Daily performance analytics and metrics for AI employees';
