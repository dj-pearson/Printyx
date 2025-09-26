-- AI Search & Knowledge Base Migration
-- Adds vector database search, AI query processing, and intelligent answer generation
-- Created: September 26, 2025

-- Vector embeddings for semantic search across all content types
CREATE TABLE IF NOT EXISTS vector_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Content identification
    content_id UUID NOT NULL, -- Reference to source content (document, meeting, article, etc.)
    content_type VARCHAR(100) NOT NULL, -- 'document', 'meeting_transcription', 'knowledge_article', 'email', 'chat_message'
    content_section VARCHAR(255), -- Specific section or chunk of content
    
    -- Vector data
    embedding_vector TEXT NOT NULL, -- JSON array representation of vector (1536 dimensions)
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
    vector_version INTEGER DEFAULT 1,
    
    -- Content metadata for retrieval
    content_text TEXT NOT NULL, -- Original text used for embedding
    content_title VARCHAR(500),
    content_summary TEXT,
    content_keywords JSONB DEFAULT '[]', -- Array of extracted keywords
    
    -- Content context and categorization
    content_category VARCHAR(100), -- Primary category
    content_subcategory VARCHAR(100), -- Subcategory for refinement
    content_tags JSONB DEFAULT '[]', -- Array of tags for filtering
    content_language VARCHAR(10) DEFAULT 'en',
    
    -- Authoring and access control
    content_author_id UUID,
    content_created_at TIMESTAMP,
    access_level VARCHAR(50) DEFAULT 'tenant', -- 'tenant', 'public', 'restricted', 'private'
    access_permissions JSONB DEFAULT '[]', -- Array of user IDs or role IDs
    
    -- Quality and relevance metrics
    content_quality_score DECIMAL(3,2) DEFAULT 0.0, -- AI-assessed content quality (0.0-1.0)
    engagement_score DECIMAL(3,2) DEFAULT 0.0, -- User engagement with this content
    freshness_score DECIMAL(3,2) DEFAULT 1.0, -- Content freshness (1.0 = very fresh, 0.0 = stale)
    
    -- Processing metadata
    embedding_confidence DECIMAL(3,2) DEFAULT 1.0, -- Confidence in embedding quality
    last_updated_embedding TIMESTAMP DEFAULT NOW(),
    embedding_source VARCHAR(100), -- 'api', 'batch_process', 'manual'
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI search queries and results for learning and optimization
CREATE TABLE IF NOT EXISTS ai_search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Query details
    query_text TEXT NOT NULL,
    query_intent VARCHAR(100), -- 'factual', 'how_to', 'troubleshooting', 'definition', 'comparison'
    query_language VARCHAR(10) DEFAULT 'en',
    
    -- Search configuration
    search_filters JSONB DEFAULT '{}', -- Applied filters (content_type, date_range, etc.)
    search_scope JSONB DEFAULT '[]', -- Scope of search (content types, categories)
    max_results INTEGER DEFAULT 10,
    
    -- AI processing
    query_embedding TEXT, -- JSON array representation of query vector
    query_expansion JSONB DEFAULT '[]', -- AI-expanded query terms
    semantic_intent JSONB DEFAULT '{}', -- AI-analyzed user intent
    
    -- Results and performance
    results_count INTEGER DEFAULT 0,
    top_result_scores JSONB DEFAULT '[]', -- Array of top similarity scores
    response_time_ms INTEGER,
    
    -- User interaction
    user_satisfaction_rating INTEGER, -- 1-5 rating
    clicked_results JSONB DEFAULT '[]', -- Array of result IDs user clicked
    follow_up_query_id UUID REFERENCES ai_search_queries(id) ON DELETE SET NULL,
    
    -- Learning data
    result_quality_feedback JSONB DEFAULT '{}', -- Feedback on result quality
    query_success_indicators JSONB DEFAULT '{}', -- Indicators of successful query resolution
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- AI-generated answers and knowledge synthesis
CREATE TABLE IF NOT EXISTS ai_generated_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    query_id UUID REFERENCES ai_search_queries(id) ON DELETE CASCADE,
    
    -- Answer content
    answer_text TEXT NOT NULL,
    answer_confidence DECIMAL(3,2) NOT NULL, -- AI confidence in answer accuracy
    answer_type VARCHAR(100) NOT NULL, -- 'direct', 'synthesized', 'step_by_step', 'comparison', 'summary'
    
    -- Source attribution
    source_documents JSONB NOT NULL DEFAULT '[]', -- Array of source document references
    source_confidence JSONB DEFAULT '[]', -- Confidence scores for each source
    citation_style VARCHAR(50) DEFAULT 'inline', -- 'inline', 'footnotes', 'bibliography'
    
    -- Answer structure and formatting
    answer_sections JSONB DEFAULT '[]', -- Structured answer with sections
    key_points JSONB DEFAULT '[]', -- Key points extracted or synthesized
    related_topics JSONB DEFAULT '[]', -- Related topics for further exploration
    
    -- Quality assessment
    factual_accuracy_score DECIMAL(3,2), -- AI assessment of factual accuracy
    completeness_score DECIMAL(3,2), -- How complete the answer is
    clarity_score DECIMAL(3,2), -- How clear and understandable
    usefulness_score DECIMAL(3,2), -- Overall usefulness assessment
    
    -- User feedback and validation
    user_helpful_votes INTEGER DEFAULT 0,
    user_unhelpful_votes INTEGER DEFAULT 0,
    user_corrections JSONB DEFAULT '[]', -- User-submitted corrections
    expert_validation_status VARCHAR(50), -- 'pending', 'validated', 'flagged', 'corrected'
    
    -- AI model information
    ai_model_used VARCHAR(100) NOT NULL,
    generation_prompt TEXT,
    generation_parameters JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    
    -- Versioning and updates
    version INTEGER DEFAULT 1,
    superseded_by UUID REFERENCES ai_generated_answers(id) ON DELETE SET NULL,
    is_current BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge graph relationships and entity connections
CREATE TABLE IF NOT EXISTS knowledge_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Entity identification
    entity_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL, -- 'person', 'organization', 'concept', 'product', 'location', 'event'
    entity_aliases JSONB DEFAULT '[]', -- Alternative names and aliases
    
    -- Entity description and context
    entity_description TEXT,
    entity_summary TEXT, -- Brief summary for quick reference
    entity_category VARCHAR(100), -- High-level category
    entity_subcategory VARCHAR(100),
    
    -- Relationships and connections
    related_entities JSONB DEFAULT '[]', -- Array of related entity IDs
    parent_entity_id UUID REFERENCES knowledge_entities(id) ON DELETE SET NULL,
    child_entities JSONB DEFAULT '[]', -- Array of child entity IDs
    
    -- Content associations
    mentioned_in_documents JSONB DEFAULT '[]', -- Documents that mention this entity
    mentioned_in_meetings JSONB DEFAULT '[]', -- Meetings that discuss this entity
    knowledge_articles JSONB DEFAULT '[]', -- KB articles about this entity
    
    -- Metrics and importance
    mention_frequency INTEGER DEFAULT 0, -- How often entity is mentioned
    importance_score DECIMAL(3,2) DEFAULT 0.5, -- Calculated importance (0.0-1.0)
    trending_score DECIMAL(3,2) DEFAULT 0.0, -- Current trending level
    
    -- AI-extracted information
    entity_attributes JSONB DEFAULT '{}', -- Key attributes and properties
    entity_facts JSONB DEFAULT '[]', -- Known facts about the entity
    ai_confidence_score DECIMAL(3,2) DEFAULT 0.0, -- AI confidence in entity information
    
    -- Maintenance and quality
    last_mentioned_at TIMESTAMP,
    entity_status VARCHAR(50) DEFAULT 'active', -- 'active', 'deprecated', 'merged', 'deleted'
    quality_score DECIMAL(3,2) DEFAULT 0.5,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(tenant_id, entity_name, entity_type)
);

-- Semantic search sessions with conversation context
CREATE TABLE IF NOT EXISTS search_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Session metadata
    session_title VARCHAR(255), -- User-defined or AI-generated title
    session_context TEXT, -- Overall context and purpose
    session_type VARCHAR(100) DEFAULT 'exploration', -- 'research', 'troubleshooting', 'learning', 'exploration'
    
    -- Session queries and flow
    query_sequence JSONB DEFAULT '[]', -- Array of query IDs in order
    conversation_flow JSONB DEFAULT '[]', -- Conversation structure and branching
    session_summary TEXT, -- AI-generated session summary
    
    -- Learning and adaptation
    discovered_topics JSONB DEFAULT '[]', -- Topics discovered during session
    knowledge_gaps JSONB DEFAULT '[]', -- Identified knowledge gaps
    recommended_actions JSONB DEFAULT '[]', -- AI-recommended follow-up actions
    
    -- Session outcomes
    session_success_rating INTEGER, -- 1-5 user rating
    goals_achieved JSONB DEFAULT '[]', -- Whether session goals were met
    time_saved_estimate INTEGER, -- Estimated time saved (minutes)
    
    -- Duration and engagement
    started_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    total_duration_minutes INTEGER,
    query_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Content similarity and recommendations
CREATE TABLE IF NOT EXISTS content_similarities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Content pair identification
    content_a_id UUID NOT NULL,
    content_a_type VARCHAR(100) NOT NULL,
    content_b_id UUID NOT NULL,
    content_b_type VARCHAR(100) NOT NULL,
    
    -- Similarity metrics
    vector_similarity DECIMAL(5,4) NOT NULL, -- Cosine similarity between embeddings
    semantic_similarity DECIMAL(5,4), -- AI-assessed semantic similarity
    topic_overlap_score DECIMAL(3,2), -- Topic/keyword overlap score
    
    -- Relationship type and context
    relationship_type VARCHAR(100), -- 'duplicate', 'related', 'prerequisite', 'follow_up', 'contradictory'
    relationship_strength VARCHAR(50) DEFAULT 'medium', -- 'weak', 'medium', 'strong'
    relationship_context TEXT, -- Context or reason for relationship
    
    -- Quality and validation
    ai_confidence DECIMAL(3,2) NOT NULL,
    user_validated BOOLEAN DEFAULT FALSE,
    validation_feedback JSONB DEFAULT '{}',
    
    -- Usage and performance
    recommendation_clicks INTEGER DEFAULT 0,
    recommendation_usefulness_rating DECIMAL(2,1), -- Average user rating
    last_recommended_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(tenant_id, content_a_id, content_b_id),
    CHECK (content_a_id != content_b_id)
);

-- AI search analytics and performance tracking
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    analysis_date DATE NOT NULL,
    
    -- Query volume and patterns
    total_queries INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    average_queries_per_user DECIMAL(5,2) DEFAULT 0.0,
    
    -- Query characteristics
    most_common_query_types JSONB DEFAULT '[]', -- Array of query types and frequencies
    popular_search_terms JSONB DEFAULT '[]', -- Most searched terms
    trending_topics JSONB DEFAULT '[]', -- Topics with increasing search volume
    
    -- Performance metrics
    average_response_time_ms INTEGER DEFAULT 0,
    average_result_count DECIMAL(4,1) DEFAULT 0.0,
    zero_result_query_rate DECIMAL(3,2) DEFAULT 0.0,
    
    -- Answer generation performance
    answers_generated INTEGER DEFAULT 0,
    average_answer_confidence DECIMAL(3,2) DEFAULT 0.0,
    answer_helpfulness_rate DECIMAL(3,2) DEFAULT 0.0, -- Percentage of helpful ratings
    
    -- User satisfaction and engagement
    average_user_satisfaction DECIMAL(2,1) DEFAULT 0.0,
    session_completion_rate DECIMAL(3,2) DEFAULT 0.0,
    follow_up_query_rate DECIMAL(3,2) DEFAULT 0.0,
    
    -- Content performance
    most_retrieved_content JSONB DEFAULT '[]', -- Most frequently retrieved content
    highest_scoring_content JSONB DEFAULT '[]', -- Content with highest relevance scores
    content_gap_indicators JSONB DEFAULT '[]', -- Indicators of content gaps
    
    -- AI model performance
    embedding_generation_time_ms INTEGER DEFAULT 0,
    answer_generation_time_ms INTEGER DEFAULT 0,
    ai_accuracy_indicators JSONB DEFAULT '{}',
    
    -- Insights and recommendations
    ai_insights JSONB DEFAULT '[]', -- AI-generated insights about search patterns
    optimization_recommendations JSONB DEFAULT '[]', -- Recommendations for improvement
    content_suggestions JSONB DEFAULT '[]', -- Suggestions for new content creation
    
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, analysis_date)
);

-- Create indexes for optimal search performance
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_tenant ON vector_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_content ON vector_embeddings(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_category ON vector_embeddings(content_category, content_subcategory);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_access ON vector_embeddings(access_level);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_quality ON vector_embeddings(content_quality_score, freshness_score);

CREATE INDEX IF NOT EXISTS idx_search_queries_tenant_user ON ai_search_queries(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_created ON ai_search_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_search_queries_intent ON ai_search_queries(query_intent);

CREATE INDEX IF NOT EXISTS idx_generated_answers_query ON ai_generated_answers(query_id);
CREATE INDEX IF NOT EXISTS idx_generated_answers_confidence ON ai_generated_answers(answer_confidence);
CREATE INDEX IF NOT EXISTS idx_generated_answers_current ON ai_generated_answers(is_current, version);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_tenant ON knowledge_entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type ON knowledge_entities(entity_type, entity_category);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_name ON knowledge_entities(entity_name);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_importance ON knowledge_entities(importance_score, trending_score);

CREATE INDEX IF NOT EXISTS idx_search_sessions_tenant_user ON search_sessions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_type ON search_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_search_sessions_activity ON search_sessions(last_activity_at);

CREATE INDEX IF NOT EXISTS idx_content_similarities_tenant ON content_similarities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_similarities_score ON content_similarities(vector_similarity, semantic_similarity);

CREATE INDEX IF NOT EXISTS idx_search_analytics_date ON search_analytics(analysis_date);

-- Insert sample knowledge entities
INSERT INTO knowledge_entities (id, tenant_id, entity_name, entity_type, entity_description, entity_category, entity_attributes, entity_facts, importance_score) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Motion AI', 'product', 'Advanced AI-powered productivity and automation platform', 'software', 
 '{"type": "SaaS platform", "industry": "productivity", "target_market": "enterprise"}',
 '["Integrates with popular meeting platforms", "Provides AI-powered transcription", "Offers intelligent scheduling"]',
 0.95),

('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Claude AI', 'technology', 'Large language model for AI-powered content generation and analysis', 'artificial_intelligence',
 '{"provider": "Anthropic", "model_type": "language_model", "capabilities": ["text_generation", "analysis", "reasoning"]}',
 '["Developed by Anthropic", "Constitutional AI approach", "Strong reasoning capabilities"]',
 0.88)

ON CONFLICT (id) DO NOTHING;
