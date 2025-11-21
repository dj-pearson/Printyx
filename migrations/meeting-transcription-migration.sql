-- Meeting Transcription & Notes Migration
-- Adds AI-powered meeting recording, transcription, and intelligent note generation
-- Created: September 26, 2025

-- Meeting recordings with metadata and processing status
CREATE TABLE IF NOT EXISTS meeting_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL, -- Reference to meetings table
    tenant_id UUID NOT NULL,
    
    -- Recording details
    recording_name VARCHAR(255) NOT NULL,
    recording_url TEXT, -- URL to stored recording file
    recording_format VARCHAR(50) DEFAULT 'mp4', -- mp4, webm, mp3, wav
    file_size_bytes BIGINT,
    duration_seconds INTEGER,
    
    -- Recording source and quality
    recording_source VARCHAR(100), -- zoom, teams, google_meet, manual_upload, phone
    audio_quality VARCHAR(50) DEFAULT 'good', -- excellent, good, fair, poor
    video_quality VARCHAR(50), -- hd, standard, low, audio_only
    
    -- Processing status
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    transcription_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    ai_analysis_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    
    -- AI processing insights
    ai_confidence_score DECIMAL(3,2), -- Overall AI processing confidence (0.0-1.0)
    ai_speaker_count INTEGER, -- Number of distinct speakers detected
    ai_language_detected VARCHAR(10) DEFAULT 'en', -- ISO language code
    ai_audio_clarity_score DECIMAL(3,2), -- Audio clarity assessment (0.0-1.0)
    
    -- Processing timestamps
    uploaded_at TIMESTAMP DEFAULT NOW(),
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    
    -- Access control
    uploaded_by UUID NOT NULL,
    is_public BOOLEAN DEFAULT FALSE, -- Whether recording is accessible to all participants
    access_permissions JSONB DEFAULT '[]', -- Array of user IDs with access
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Meeting transcriptions with speaker identification and timing
CREATE TABLE IF NOT EXISTS meeting_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID REFERENCES meeting_recordings(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    
    -- Transcription content
    full_transcript TEXT NOT NULL,
    transcript_segments JSONB NOT NULL DEFAULT '[]', -- Array of timestamped segments
    
    -- AI processing details
    transcription_service VARCHAR(100), -- openai_whisper, google_speech, azure_speech, aws_transcribe
    ai_model_version VARCHAR(100),
    processing_time_seconds INTEGER,
    
    -- Quality metrics
    overall_confidence DECIMAL(3,2), -- Average confidence across all segments
    word_count INTEGER,
    speaker_count INTEGER,
    
    -- Speaker identification
    speakers JSONB DEFAULT '[]', -- Array of identified speakers with metadata
    speaker_mapping JSONB DEFAULT '{}', -- Mapping of speaker IDs to participant names
    
    -- Language and content analysis
    primary_language VARCHAR(10) DEFAULT 'en',
    detected_languages JSONB DEFAULT '[]', -- Multi-language support
    content_categories JSONB DEFAULT '[]', -- AI-detected content categories
    
    -- Processing metadata
    transcribed_at TIMESTAMP DEFAULT NOW(),
    last_updated_at TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- AI-generated meeting notes and summaries
CREATE TABLE IF NOT EXISTS meeting_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,
    recording_id UUID REFERENCES meeting_recordings(id) ON DELETE SET NULL,
    transcription_id UUID REFERENCES meeting_transcriptions(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL,
    
    -- Note content
    title VARCHAR(255) NOT NULL,
    executive_summary TEXT,
    detailed_notes TEXT,
    
    -- Structured content
    key_points JSONB DEFAULT '[]', -- Array of key discussion points
    decisions_made JSONB DEFAULT '[]', -- Array of decisions with context
    action_items JSONB DEFAULT '[]', -- Array of action items with assignees and due dates
    follow_up_items JSONB DEFAULT '[]', -- Array of follow-up topics
    
    -- Meeting analysis
    meeting_sentiment VARCHAR(50), -- positive, neutral, negative, mixed
    engagement_level VARCHAR(50), -- high, medium, low
    productivity_score DECIMAL(3,2), -- AI assessment of meeting productivity (0.0-1.0)
    
    -- Content categorization
    topics_discussed JSONB DEFAULT '[]', -- Array of main topics
    participants_mentioned JSONB DEFAULT '[]', -- People mentioned in discussion
    companies_mentioned JSONB DEFAULT '[]', -- External companies/clients mentioned
    dates_mentioned JSONB DEFAULT '[]', -- Important dates mentioned
    numbers_mentioned JSONB DEFAULT '[]', -- Key numbers/metrics mentioned
    
    -- AI insights
    ai_insights JSONB DEFAULT '[]', -- Array of AI-generated insights
    ai_recommendations JSONB DEFAULT '[]', -- AI suggestions for follow-up
    ai_risk_flags JSONB DEFAULT '[]', -- Potential risks or concerns identified
    ai_opportunities JSONB DEFAULT '[]', -- Business opportunities identified
    
    -- Generation metadata
    ai_model_used VARCHAR(100), -- claude-3-5-sonnet, gpt-4, etc.
    generation_prompt_version VARCHAR(50),
    processing_time_seconds INTEGER,
    ai_confidence_score DECIMAL(3,2),
    
    -- Version control
    version INTEGER DEFAULT 1,
    is_final BOOLEAN DEFAULT FALSE,
    parent_note_id UUID REFERENCES meeting_notes(id) ON DELETE SET NULL,
    
    -- Access and sharing
    created_by UUID NOT NULL,
    shared_with JSONB DEFAULT '[]', -- Array of user IDs
    is_public BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Meeting highlights and key moments
CREATE TABLE IF NOT EXISTS meeting_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,
    recording_id UUID REFERENCES meeting_recordings(id) ON DELETE CASCADE,
    transcription_id UUID REFERENCES meeting_transcriptions(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL,
    
    -- Highlight details
    highlight_type VARCHAR(100) NOT NULL, -- decision, action_item, key_point, question, concern, opportunity
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Timing information
    start_time_seconds INTEGER, -- Start time in recording
    end_time_seconds INTEGER, -- End time in recording
    duration_seconds INTEGER,
    
    -- Content
    transcript_excerpt TEXT, -- Relevant transcript portion
    context_before TEXT, -- Context before the highlight
    context_after TEXT, -- Context after the highlight
    
    -- Participants involved
    speakers JSONB DEFAULT '[]', -- Array of speaker IDs involved
    participants_mentioned JSONB DEFAULT '[]', -- People mentioned in this highlight
    
    -- AI analysis
    importance_score DECIMAL(3,2), -- AI-assessed importance (0.0-1.0)
    sentiment VARCHAR(50), -- positive, neutral, negative
    confidence_score DECIMAL(3,2), -- AI confidence in this highlight
    
    -- Categorization
    tags JSONB DEFAULT '[]', -- Array of tags for categorization
    related_topics JSONB DEFAULT '[]', -- Related discussion topics
    business_impact VARCHAR(50), -- high, medium, low, none
    
    -- Follow-up tracking
    requires_action BOOLEAN DEFAULT FALSE,
    assigned_to UUID, -- User ID if action required
    due_date DATE,
    completion_status VARCHAR(50) DEFAULT 'open', -- open, in_progress, completed, cancelled
    
    -- Creation metadata
    created_by UUID, -- User ID if manually created, NULL if AI-generated
    ai_generated BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Speaker profiles and voice recognition
CREATE TABLE IF NOT EXISTS meeting_speakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID, -- Reference to user if identified, NULL for external participants
    
    -- Speaker identification
    speaker_name VARCHAR(255),
    email VARCHAR(255),
    voice_signature_id VARCHAR(255), -- Unique voice identification signature
    
    -- Voice characteristics (for recognition)
    voice_characteristics JSONB DEFAULT '{}', -- AI voice analysis data
    recognition_confidence DECIMAL(3,2), -- Confidence in voice identification
    
    -- Speaking patterns and analytics
    average_speaking_pace INTEGER, -- Words per minute
    common_phrases JSONB DEFAULT '[]', -- Frequently used phrases
    speaking_style VARCHAR(100), -- formal, casual, technical, etc.
    
    -- Meeting participation stats
    total_meetings_participated INTEGER DEFAULT 0,
    total_speaking_time_minutes INTEGER DEFAULT 0,
    average_participation_rate DECIMAL(3,2), -- Percentage of meeting time speaking
    
    -- Learning and improvement
    transcription_accuracy_feedback JSONB DEFAULT '[]', -- User corrections for learning
    last_voice_sample_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(tenant_id, voice_signature_id)
);

-- Meeting content search index for full-text search
CREATE TABLE IF NOT EXISTS meeting_content_search (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    
    -- Searchable content
    searchable_content TEXT NOT NULL, -- Combined transcript, notes, and metadata
    content_type VARCHAR(50) NOT NULL, -- transcript, notes, highlights, action_items
    content_source_id UUID, -- ID of source record (transcription_id, note_id, etc.)
    
    -- Search metadata
    content_timestamp TIMESTAMP, -- When this content occurred in meeting
    speakers_involved JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    
    -- Search optimization
    search_vector TSVECTOR, -- PostgreSQL full-text search vector
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Meeting analytics and insights aggregation
CREATE TABLE IF NOT EXISTS meeting_content_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    analysis_date DATE NOT NULL,
    
    -- Meeting volume metrics
    total_meetings_recorded INTEGER DEFAULT 0,
    total_recording_hours DECIMAL(8,2) DEFAULT 0,
    total_transcription_words INTEGER DEFAULT 0,
    
    -- AI processing metrics
    average_transcription_confidence DECIMAL(3,2),
    average_ai_processing_time_seconds INTEGER,
    transcription_accuracy_rate DECIMAL(3,2),
    
    -- Content analysis
    most_discussed_topics JSONB DEFAULT '[]', -- Top topics across meetings
    common_action_item_types JSONB DEFAULT '[]',
    average_meeting_productivity_score DECIMAL(3,2),
    
    -- Participation analytics
    average_speaker_count DECIMAL(3,1),
    most_active_speakers JSONB DEFAULT '[]',
    speaking_time_distribution JSONB DEFAULT '{}',
    
    -- Business insights
    decisions_made_count INTEGER DEFAULT 0,
    action_items_generated_count INTEGER DEFAULT 0,
    follow_up_completion_rate DECIMAL(3,2),
    
    -- AI insights and recommendations
    ai_insights JSONB DEFAULT '[]',
    ai_recommendations JSONB DEFAULT '[]',
    content_quality_trends JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, analysis_date)
);

-- Meeting recording integrations and webhooks
CREATE TABLE IF NOT EXISTS recording_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Integration details
    integration_type VARCHAR(100) NOT NULL, -- zoom, teams, google_meet, webex, manual
    integration_name VARCHAR(255) NOT NULL,
    
    -- Configuration
    api_credentials JSONB DEFAULT '{}', -- Encrypted API credentials
    webhook_url TEXT,
    auto_processing_enabled BOOLEAN DEFAULT TRUE,
    
    -- Processing settings
    auto_transcription BOOLEAN DEFAULT TRUE,
    auto_note_generation BOOLEAN DEFAULT TRUE,
    auto_highlight_extraction BOOLEAN DEFAULT TRUE,
    
    -- Notification settings
    notification_settings JSONB DEFAULT '{}',
    processing_complete_notifications JSONB DEFAULT '[]', -- Array of user IDs to notify
    
    -- Status and health
    is_active BOOLEAN DEFAULT TRUE,
    last_successful_sync TIMESTAMP,
    last_error_message TEXT,
    error_count INTEGER DEFAULT 0,
    
    -- Usage statistics
    recordings_processed INTEGER DEFAULT 0,
    total_processing_time_hours DECIMAL(8,2) DEFAULT 0,
    
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(tenant_id, integration_type, integration_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_meeting ON meeting_recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_status ON meeting_recordings(processing_status, transcription_status);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_tenant_date ON meeting_recordings(tenant_id, uploaded_at);

CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_meeting ON meeting_transcriptions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_recording ON meeting_transcriptions(recording_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_tenant ON meeting_transcriptions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting ON meeting_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_tenant_date ON meeting_notes(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_created_by ON meeting_notes(created_by);

CREATE INDEX IF NOT EXISTS idx_meeting_highlights_meeting ON meeting_highlights(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_highlights_type ON meeting_highlights(highlight_type, importance_score);
CREATE INDEX IF NOT EXISTS idx_meeting_highlights_action ON meeting_highlights(requires_action, completion_status);

CREATE INDEX IF NOT EXISTS idx_meeting_speakers_tenant ON meeting_speakers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meeting_speakers_user ON meeting_speakers(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_speakers_voice ON meeting_speakers(voice_signature_id);

CREATE INDEX IF NOT EXISTS idx_content_search_meeting ON meeting_content_search(meeting_id);
CREATE INDEX IF NOT EXISTS idx_content_search_tenant ON meeting_content_search(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_search_vector ON meeting_content_search USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_content_analytics_date ON meeting_content_analytics(analysis_date);
CREATE INDEX IF NOT EXISTS idx_recording_integrations_tenant ON recording_integrations(tenant_id, is_active);

-- Insert default meeting highlight types for reference
INSERT INTO meeting_highlights (id, meeting_id, recording_id, tenant_id, highlight_type, title, description, importance_score, ai_generated, created_by) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', NULL, '00000000-0000-0000-0000-000000000000', 'decision', 'Sample Decision Highlight', 'Example of a key decision made during the meeting', 0.9, TRUE, NULL),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', NULL, '00000000-0000-0000-0000-000000000000', 'action_item', 'Sample Action Item', 'Example of an action item assigned during the meeting', 0.8, TRUE, NULL),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', NULL, '00000000-0000-0000-0000-000000000000', 'key_point', 'Sample Key Point', 'Example of an important discussion point', 0.7, TRUE, NULL),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', NULL, '00000000-0000-0000-0000-000000000000', 'opportunity', 'Sample Business Opportunity', 'Example of a business opportunity identified', 0.85, TRUE, NULL),
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', NULL, '00000000-0000-0000-0000-000000000000', 'concern', 'Sample Concern', 'Example of a concern or risk identified', 0.75, TRUE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE meeting_recordings IS 'Meeting recordings with processing status and AI analysis metadata';
COMMENT ON TABLE meeting_transcriptions IS 'AI-generated meeting transcriptions with speaker identification and timing';
COMMENT ON TABLE meeting_notes IS 'AI-generated meeting notes, summaries, and structured content extraction';
COMMENT ON TABLE meeting_highlights IS 'Key moments and highlights extracted from meetings with AI analysis';
COMMENT ON TABLE meeting_speakers IS 'Speaker profiles and voice recognition for meeting participants';
COMMENT ON TABLE meeting_content_search IS 'Full-text search index for meeting content across all sources';
COMMENT ON TABLE meeting_content_analytics IS 'Aggregated analytics and insights from meeting content analysis';
COMMENT ON TABLE recording_integrations IS 'Integration configurations for automatic recording processing';
