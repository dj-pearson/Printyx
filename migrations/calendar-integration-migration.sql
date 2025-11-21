-- Calendar Integration Migration
-- Adds calendar sync and event management capabilities
-- Created: September 26, 2025

-- Calendar Connections (for external calendar sync)
CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR NOT NULL,
    provider VARCHAR NOT NULL, -- 'google', 'outlook', 'icloud'
    provider_account_id VARCHAR NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    calendar_id VARCHAR, -- External calendar ID
    calendar_name VARCHAR,
    is_primary BOOLEAN DEFAULT false,
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    sync_token VARCHAR, -- For incremental sync
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, provider, calendar_id)
);

-- Calendar Events (both internal and synced external events)
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR NOT NULL,
    calendar_connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE,
    external_event_id VARCHAR, -- ID from external calendar
    title VARCHAR NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_all_day BOOLEAN DEFAULT false,
    location VARCHAR,
    attendees JSONB DEFAULT '[]',
    recurrence_rule VARCHAR, -- RRULE format
    status VARCHAR DEFAULT 'confirmed', -- confirmed, tentative, cancelled
    visibility VARCHAR DEFAULT 'default', -- default, public, private
    event_type VARCHAR DEFAULT 'meeting', -- meeting, task, reminder, focus_time
    related_entity_id VARCHAR, -- Link to deals, leads, etc.
    related_entity_type VARCHAR, -- 'deal', 'lead', 'project', 'task'
    is_ai_generated BOOLEAN DEFAULT false,
    ai_confidence DECIMAL(3,2), -- 0.00-1.00
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Calendar Event Reminders
CREATE TABLE IF NOT EXISTS calendar_event_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
    reminder_minutes INTEGER NOT NULL, -- Minutes before event
    reminder_method VARCHAR DEFAULT 'notification', -- notification, email, sms
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Calendar Availability (for scheduling optimization)
CREATE TABLE IF NOT EXISTS calendar_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR DEFAULT 'America/New_York',
    is_available BOOLEAN DEFAULT true,
    availability_type VARCHAR DEFAULT 'work', -- work, personal, focus_time, break
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Calendar Sync Logs (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE,
    sync_type VARCHAR NOT NULL, -- 'full', 'incremental', 'webhook'
    sync_status VARCHAR NOT NULL, -- 'success', 'error', 'partial'
    events_synced INTEGER DEFAULT 0,
    events_created INTEGER DEFAULT 0,
    events_updated INTEGER DEFAULT 0,
    events_deleted INTEGER DEFAULT 0,
    error_message TEXT,
    sync_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_connections_tenant_user 
ON calendar_connections(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_user_time 
ON calendar_events(tenant_id, user_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_calendar_events_external 
ON calendar_events(calendar_connection_id, external_event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_availability_user_day 
ON calendar_availability(tenant_id, user_id, day_of_week);

-- Add comments for documentation
COMMENT ON TABLE calendar_connections IS 'External calendar service connections (Google, Outlook, etc.)';
COMMENT ON TABLE calendar_events IS 'All calendar events including synced external events and AI-generated events';
COMMENT ON TABLE calendar_availability IS 'User availability patterns for intelligent scheduling';
COMMENT ON COLUMN calendar_events.ai_confidence IS 'AI confidence score for generated events (0.00-1.00)';
