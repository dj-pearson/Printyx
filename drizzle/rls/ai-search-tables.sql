-- ============================================================================
-- ai-search-tables.sql — schema safety net for the ai-search edge function.
--
-- Source of truth: migrations/ai-search-knowledge-migration.sql. Replayed here
-- idempotently so fresh installs still get these tables even if the bespoke
-- migration was never applied.
--
-- Note on vectors: `embedding_vector` is stored as TEXT (JSON-encoded
-- 1536-dim array). There is no pgvector dependency in the current schema;
-- the edge function does cosine similarity in JS. If you later install
-- pgvector and switch to `vector(1536)`, add an IVFFlat index in a follow-up
-- migration.
-- ============================================================================

BEGIN;

-- ─── vector_embeddings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  content_id uuid NOT NULL,
  content_type varchar(100) NOT NULL,
  content_section varchar(255),
  embedding_vector text NOT NULL,
  embedding_model varchar(100) DEFAULT 'text-embedding-3-small',
  vector_version integer DEFAULT 1,
  content_text text NOT NULL,
  content_title varchar(500),
  content_summary text,
  content_keywords jsonb DEFAULT '[]',
  content_category varchar(100),
  content_subcategory varchar(100),
  content_tags jsonb DEFAULT '[]',
  content_language varchar(10) DEFAULT 'en',
  content_author_id uuid,
  content_created_at timestamp,
  access_level varchar(50) DEFAULT 'tenant',
  access_permissions jsonb DEFAULT '[]',
  content_quality_score numeric(3,2) DEFAULT 0.0,
  engagement_score numeric(3,2) DEFAULT 0.0,
  freshness_score numeric(3,2) DEFAULT 1.0,
  embedding_confidence numeric(3,2) DEFAULT 1.0,
  last_updated_embedding timestamp DEFAULT now(),
  embedding_source varchar(100),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_tenant ON vector_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_content ON vector_embeddings(content_type, content_id);

-- ─── ai_search_queries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  query_text text NOT NULL,
  query_intent varchar(100),
  query_language varchar(10) DEFAULT 'en',
  search_filters jsonb DEFAULT '{}',
  search_scope jsonb DEFAULT '[]',
  max_results integer DEFAULT 10,
  query_embedding text,
  query_expansion jsonb DEFAULT '[]',
  semantic_intent jsonb DEFAULT '{}',
  results_count integer DEFAULT 0,
  top_result_scores jsonb DEFAULT '[]',
  response_time_ms integer,
  user_satisfaction_rating integer,
  clicked_results jsonb DEFAULT '[]',
  follow_up_query_id uuid,
  result_quality_feedback jsonb DEFAULT '{}',
  query_success_indicators jsonb DEFAULT '{}',
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_queries_tenant_user ON ai_search_queries(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_created ON ai_search_queries(created_at);

-- ─── ai_generated_answers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_generated_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  query_id uuid,
  answer_text text NOT NULL,
  answer_confidence numeric(3,2) NOT NULL,
  answer_type varchar(100) NOT NULL,
  source_documents jsonb NOT NULL DEFAULT '[]',
  source_confidence jsonb DEFAULT '[]',
  citation_style varchar(50) DEFAULT 'inline',
  answer_sections jsonb DEFAULT '[]',
  key_points jsonb DEFAULT '[]',
  related_topics jsonb DEFAULT '[]',
  factual_accuracy_score numeric(3,2),
  completeness_score numeric(3,2),
  clarity_score numeric(3,2),
  usefulness_score numeric(3,2),
  user_helpful_votes integer DEFAULT 0,
  user_unhelpful_votes integer DEFAULT 0,
  user_corrections jsonb DEFAULT '[]',
  expert_validation_status varchar(50),
  ai_model_used varchar(100) NOT NULL,
  generation_prompt text,
  generation_parameters jsonb DEFAULT '{}',
  processing_time_ms integer,
  tokens_used integer,
  version integer DEFAULT 1,
  superseded_by uuid,
  is_current boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_generated_answers_query ON ai_generated_answers(query_id);
CREATE INDEX IF NOT EXISTS idx_generated_answers_current ON ai_generated_answers(is_current, version);

-- ─── knowledge_entities ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_name varchar(255) NOT NULL,
  entity_type varchar(100) NOT NULL,
  entity_aliases jsonb DEFAULT '[]',
  entity_description text,
  entity_summary text,
  entity_category varchar(100),
  entity_subcategory varchar(100),
  related_entities jsonb DEFAULT '[]',
  parent_entity_id uuid,
  child_entities jsonb DEFAULT '[]',
  mentioned_in_documents jsonb DEFAULT '[]',
  mentioned_in_meetings jsonb DEFAULT '[]',
  knowledge_articles jsonb DEFAULT '[]',
  mention_frequency integer DEFAULT 0,
  importance_score numeric(3,2) DEFAULT 0.5,
  trending_score numeric(3,2) DEFAULT 0.0,
  entity_attributes jsonb DEFAULT '{}',
  entity_facts jsonb DEFAULT '[]',
  ai_confidence_score numeric(3,2) DEFAULT 0.0,
  last_mentioned_at timestamp,
  entity_status varchar(50) DEFAULT 'active',
  quality_score numeric(3,2) DEFAULT 0.5,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_tenant ON knowledge_entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type ON knowledge_entities(entity_type, entity_category);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_importance ON knowledge_entities(importance_score, trending_score);

-- ─── search_sessions / content_similarities / search_analytics ──────────────
-- These exist in the original migration but the edge function doesn't write
-- to them yet. Create empty if missing so future code changes don't need a
-- second SQL pass.
CREATE TABLE IF NOT EXISTS search_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_title varchar(255),
  session_context text,
  session_type varchar(100) DEFAULT 'exploration',
  query_sequence jsonb DEFAULT '[]',
  conversation_flow jsonb DEFAULT '[]',
  session_summary text,
  discovered_topics jsonb DEFAULT '[]',
  knowledge_gaps jsonb DEFAULT '[]',
  recommended_actions jsonb DEFAULT '[]',
  session_success_rating integer,
  goals_achieved jsonb DEFAULT '[]',
  time_saved_estimate integer,
  started_at timestamp DEFAULT now(),
  last_activity_at timestamp DEFAULT now(),
  ended_at timestamp,
  total_duration_minutes integer,
  query_count integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  analysis_date date NOT NULL,
  total_queries integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  average_queries_per_user numeric(5,2) DEFAULT 0.0,
  most_common_query_types jsonb DEFAULT '[]',
  popular_search_terms jsonb DEFAULT '[]',
  trending_topics jsonb DEFAULT '[]',
  average_response_time_ms integer DEFAULT 0,
  average_result_count numeric(4,1) DEFAULT 0.0,
  zero_result_query_rate numeric(3,2) DEFAULT 0.0,
  answers_generated integer DEFAULT 0,
  average_answer_confidence numeric(3,2) DEFAULT 0.0,
  answer_helpfulness_rate numeric(3,2) DEFAULT 0.0,
  average_user_satisfaction numeric(2,1) DEFAULT 0.0,
  session_completion_rate numeric(3,2) DEFAULT 0.0,
  follow_up_query_rate numeric(3,2) DEFAULT 0.0,
  most_retrieved_content jsonb DEFAULT '[]',
  highest_scoring_content jsonb DEFAULT '[]',
  content_gap_indicators jsonb DEFAULT '[]',
  embedding_generation_time_ms integer DEFAULT 0,
  answer_generation_time_ms integer DEFAULT 0,
  ai_accuracy_indicators jsonb DEFAULT '{}',
  ai_insights jsonb DEFAULT '[]',
  optimization_recommendations jsonb DEFAULT '[]',
  content_suggestions jsonb DEFAULT '[]',
  created_at timestamp DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE search_analytics
    ADD CONSTRAINT search_analytics_tenant_date_unique UNIQUE (tenant_id, analysis_date);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN duplicate_table THEN NULL;
END $$;

COMMIT;
