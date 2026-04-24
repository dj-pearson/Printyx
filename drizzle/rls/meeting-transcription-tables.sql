-- ============================================================================
-- meeting-transcription-tables.sql — schema safety net for the transcription
-- edge function. Idempotent replay of migrations/meeting-transcription-
-- migration.sql (7 tables).
--
-- Storage note: the edge function uploads audio to a Supabase Storage bucket
-- named `meeting-recordings`. Create it once in the Supabase dashboard (or
-- via the storage API) — RLS on the bucket should restrict access to paths
-- prefixed by the caller's tenant_id. This file handles the relational
-- metadata tables only.
-- ============================================================================

BEGIN;

-- ─── meeting_recordings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  recording_name varchar(255) NOT NULL,
  recording_url text,
  recording_format varchar(50) DEFAULT 'mp4',
  file_size_bytes bigint,
  duration_seconds integer,
  recording_source varchar(100),
  audio_quality varchar(50) DEFAULT 'good',
  video_quality varchar(50),
  processing_status varchar(50) DEFAULT 'pending',
  transcription_status varchar(50) DEFAULT 'pending',
  ai_analysis_status varchar(50) DEFAULT 'pending',
  ai_confidence_score numeric(3,2),
  ai_speaker_count integer,
  ai_language_detected varchar(10) DEFAULT 'en',
  ai_audio_clarity_score numeric(3,2),
  uploaded_at timestamp DEFAULT now(),
  processing_started_at timestamp,
  processing_completed_at timestamp,
  uploaded_by uuid NOT NULL,
  is_public boolean DEFAULT false,
  access_permissions jsonb DEFAULT '[]',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_meeting ON meeting_recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_tenant ON meeting_recordings(tenant_id);

-- ─── meeting_transcriptions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid,
  meeting_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  full_transcript text NOT NULL,
  transcript_segments jsonb NOT NULL DEFAULT '[]',
  transcription_service varchar(100),
  ai_model_version varchar(100),
  processing_time_seconds integer,
  overall_confidence numeric(3,2),
  word_count integer,
  speaker_count integer,
  speakers jsonb DEFAULT '[]',
  speaker_mapping jsonb DEFAULT '{}',
  primary_language varchar(10) DEFAULT 'en',
  detected_languages jsonb DEFAULT '[]',
  content_categories jsonb DEFAULT '[]',
  transcribed_at timestamp DEFAULT now(),
  last_updated_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_recording
  ON meeting_transcriptions(recording_id);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_tenant_meeting
  ON meeting_transcriptions(tenant_id, meeting_id);

-- ─── meeting_notes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  recording_id uuid,
  transcription_id uuid,
  tenant_id uuid NOT NULL,
  title varchar(255) NOT NULL,
  executive_summary text,
  detailed_notes text,
  key_points jsonb DEFAULT '[]',
  decisions_made jsonb DEFAULT '[]',
  action_items jsonb DEFAULT '[]',
  follow_up_items jsonb DEFAULT '[]',
  meeting_sentiment varchar(50),
  engagement_level varchar(50),
  productivity_score numeric(3,2),
  topics_discussed jsonb DEFAULT '[]',
  participants_mentioned jsonb DEFAULT '[]',
  companies_mentioned jsonb DEFAULT '[]',
  dates_mentioned jsonb DEFAULT '[]',
  numbers_mentioned jsonb DEFAULT '[]',
  ai_insights jsonb DEFAULT '[]',
  ai_recommendations jsonb DEFAULT '[]',
  ai_risk_flags jsonb DEFAULT '[]',
  ai_opportunities jsonb DEFAULT '[]',
  ai_model_used varchar(100),
  generation_prompt_version varchar(50),
  processing_time_seconds integer,
  ai_confidence_score numeric(3,2),
  version integer DEFAULT 1,
  is_final boolean DEFAULT false,
  parent_note_id uuid,
  created_by uuid NOT NULL,
  shared_with jsonb DEFAULT '[]',
  is_public boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- ─── meeting_highlights ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  recording_id uuid,
  transcription_id uuid,
  tenant_id uuid NOT NULL,
  highlight_type varchar(100) NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  start_time_seconds integer,
  end_time_seconds integer,
  duration_seconds integer,
  speaker_id varchar,
  speaker_name varchar,
  text_content text,
  confidence_score numeric(3,2),
  importance_score numeric(3,2),
  ai_generated boolean DEFAULT true,
  user_confirmed boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_highlights_meeting ON meeting_highlights(meeting_id, highlight_type);

-- ─── meeting_speakers ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  speaker_id varchar NOT NULL,
  speaker_name varchar,
  speaker_email varchar,
  speaker_role varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE meeting_speakers
    ADD CONSTRAINT meeting_speakers_unique UNIQUE (tenant_id, meeting_id, speaker_id);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;

-- ─── meeting_content_search / meeting_content_analytics / recording_integrations ─
-- Minimal placeholder definitions — the edge function doesn't write to these
-- today, but we create them so future code additions don't need a second
-- schema pass.
CREATE TABLE IF NOT EXISTS meeting_content_search (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  search_query text NOT NULL,
  results jsonb DEFAULT '[]',
  searched_by uuid,
  searched_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_content_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  analysis_date date NOT NULL,
  total_transcriptions integer DEFAULT 0,
  total_words integer DEFAULT 0,
  average_confidence numeric(3,2) DEFAULT 0.0,
  by_provider jsonb DEFAULT '[]',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recording_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider varchar NOT NULL,
  config jsonb DEFAULT '{}',
  is_enabled boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

COMMIT;
