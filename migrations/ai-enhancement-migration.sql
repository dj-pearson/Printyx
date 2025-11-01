-- Migration: Add AI fields to existing tables for Motion AI integration
-- Created: September 26, 2025

-- Add AI fields to business_records table
ALTER TABLE business_records
ADD COLUMN IF NOT EXISTS ai_lead_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_conversion_probability DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';

-- Add AI fields to deals table
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS ai_close_probability DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_deal_health_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_risk_factors JSONB DEFAULT '[]';

-- AI Scheduling Preferences
CREATE TABLE IF NOT EXISTS ai_scheduling_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR NOT NULL,
    work_hours_start TIME DEFAULT '08:00:00',
    work_hours_end TIME DEFAULT '17:00:00',
    work_days INTEGER[] DEFAULT '{1,2,3,4,5}',
    timezone VARCHAR DEFAULT 'America/New_York',
    preferred_meeting_duration INTEGER DEFAULT 30,
    max_meetings_per_day INTEGER DEFAULT 8,
    learning_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- AI Generated Content
CREATE TABLE IF NOT EXISTS ai_generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR NOT NULL,
    content_type VARCHAR NOT NULL,
    title VARCHAR,
    content TEXT,
    model_used VARCHAR,
    usage_count INTEGER DEFAULT 0,
    user_rating INTEGER,
    status VARCHAR DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_scheduling_preferences_tenant_user
ON ai_scheduling_preferences(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_ai_generated_content_tenant_user
ON ai_generated_content(tenant_id, user_id);

-- Add comments
COMMENT ON COLUMN business_records.ai_lead_score IS 'AI-calculated lead score (0-100)';
COMMENT ON COLUMN business_records.ai_conversion_probability IS 'AI-predicted conversion probability (0-100)';
COMMENT ON COLUMN deals.ai_close_probability IS 'AI-predicted close probability (0-100)';
COMMENT ON COLUMN deals.ai_deal_health_score IS 'AI-calculated deal health score (0-100)';
