/**
 * Auto-generated Database Schema Definitions
 * Generated at: 2026-01-16T14:55:52.670Z
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated
 */

export interface DatabaseSchema {
  ai_employees: {
    id?: string;
    tenant_id: string;
    employee_name: string;
    employee_type: string;
    ai_model?: string;
    ai_personality?: Record<string, any>;
    communication?: string;
    total_tasks_completed?: number;
    average_task_completion_time_minutes?: number;
    user_satisfaction_rating?: number;
    learning_data?: Record<string, any>;
    status?: string;
    last_active_at?: string;
    training_completion_percentage?: number;
    tasks_assigned?: number;
    tasks_completed?: number;
    tasks_failed?: number;
    average_response_time_ms?: number;
    created_at?: string;
    updated_at?: string;
  };
  ai_employee_tasks: {
    id?: string;
    tenant_id: string;
    employee_id?: string;
    task_type: string;
    task_description?: string;
    task_priority?: string;
    started_at?: string;
    completed_at?: string;
    due_date?: string;
    status?: string;
    current_step?: string;
    human_review_status?: string;
    ai_confidence_score?: number;
    error_messages?: Record<string, any>;
    parent_task_id?: string;
    workflow_id?: string;
    estimated_cost?: number;
    actual_cost?: number;
    created_at?: string;
    updated_at?: string;
  };
  ai_employee_workflows: {
    id?: string;
    tenant_id: string;
    workflow_name: string;
    workflow_type: string;
    workflow_version?: string;
    workflow_steps: Record<string, any>;
    success_rate?: number;
    total_executions?: number;
    optimization_suggestions?: Record<string, any>;
    status?: string;
    approved_by?: string;
    approved_at?: string;
    created_at?: string;
    updated_at?: string;
  };
  ai_workflow_executions: {
    id?: string;
    tenant_id: string;
    workflow_id?: string;
    triggered_by?: string;
    input_data?: Record<string, any>;
    started_at?: string;
    completed_at?: string;
    current_step_index?: number;
    current_step_name?: string;
    status?: string;
    error_details?: Record<string, any>;
    total_execution_time_minutes?: number;
    steps_completed?: number;
    steps_failed?: number;
    human_interventions?: number;
    total_ai_tokens_used?: number;
    total_cost?: number;
    employees_involved?: Record<string, any>;
    updated_at?: string;
  };
  ai_employee_skills: {
    id?: string;
    tenant_id: string;
    employee_id?: string;
    skill_name: string;
    skill_category: string;
    proficiency_level?: number;
    success_rate?: number;
    training_data?: Record<string, any>;
    practice_opportunities?: number;
    improvement_suggestions?: Record<string, any>;
    times_used?: number;
    last_used_at?: string;
    average_performance_score?: number;
    created_at?: string;
    updated_at?: string;
  };
  ai_employee_interactions: {
    id?: string;
    tenant_id: string;
    employee_id?: string;
    interaction_type: string;
    interaction_content?: string;
    interaction_context?: Record<string, any>;
    sentiment_analysis?: Record<string, any>;
    started_at?: string;
    ended_at?: string;
    response_time_ms?: number;
    interaction_outcome?: string;
    follow_up_date?: string;
    ai_confidence_in_response?: number;
    human_intervention_required?: boolean;
    quality_score?: number;
    updated_at?: string;
  };
  ai_employee_training: {
    id?: string;
    tenant_id: string;
    employee_id?: string;
    training_type: string;
    training_description?: string;
    training_data?: Record<string, any>;
    training_method?: string;
    started_at?: string;
    completed_at?: string;
    progress_percentage?: number;
    pre_training_performance?: Record<string, any>;
    post_training_performance?: Record<string, any>;
    improvement_metrics?: Record<string, any>;
    validation_results?: Record<string, any>;
    test_scenarios_passed?: number;
    test_scenarios_failed?: number;
    status?: string;
    approved_at?: string;
    deployment_date?: string;
    created_at?: string;
    updated_at?: string;
  };
  ai_employee_analytics: {
    id?: string;
    tenant_id: string;
    employee_id?: string;
    analysis_date: string;
    tasks_assigned?: number;
    tasks_completed?: number;
    tasks_failed?: number;
    average_completion_time_minutes?: number;
    average_quality_score?: number;
    customer_satisfaction_rating?: number;
    human_intervention_rate?: number;
    error_rate?: number;
    total_ai_tokens_used?: number;
    total_cost?: number;
    cost_per_task?: number;
    roi_estimate?: number;
    skill_improvements?: number;
    training_hours?: number;
    total_interactions?: number;
    successful_interactions?: number;
    escalated_interactions?: number;
    average_response_time_ms?: number;
    performance_vs_baseline?: number;
  };
  ai_scheduling_preferences: {
    id?: string;
    tenant_id: string;
    user_id: string;
    work_hours_start?: string;
    work_hours_end?: string;
    work_days?: number;
    timezone?: string;
    preferred_meeting_duration?: number;
    max_meetings_per_day?: number;
    learning_enabled?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  ai_generated_content: {
    id?: string;
    tenant_id: string;
    user_id: string;
    content_type: string;
    title?: string;
    content?: string;
    model_used?: string;
    usage_count?: number;
    user_rating?: number;
    status?: string;
    created_at?: string;
    updated_at?: string;
  };
  business_records: {
    IF?: string;
  };
  deals: {
    IF?: string;
  };
  vector_embeddings: {
    id?: string;
    tenant_id: string;
    content_id: string;
    vector_version?: number;
    content_text: string;
    content_summary?: string;
    content_keywords?: Record<string, any>;
    content_author_id?: string;
    content_created_at?: string;
    access_level?: string;
    embedding_source?: string;
    updated_at?: string;
  };
  ai_search_queries: {
    id?: string;
    tenant_id: string;
    user_id: string;
    query_text: string;
    query_intent?: string;
    search_filters?: Record<string, any>;
    query_embedding?: string;
    top_result_scores?: Record<string, any>;
    user_satisfaction_rating?: number;
    result_quality_feedback?: Record<string, any>;
  };
  ai_generated_answers: {
    id?: string;
    tenant_id: string;
    query_id?: string;
    answer_text: string;
    answer_confidence?: number;
    user_unhelpful_votes?: number;
    user_corrections?: Record<string, any>;
    generation_prompt?: string;
    generation_parameters?: Record<string, any>;
    processing_time_ms?: number;
    tokens_used?: number;
    version?: number;
    superseded_by?: string;
    is_current?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  knowledge_entities: {
    id?: string;
    tenant_id: string;
    entity_name: string;
    entity_type: string;
    entity_summary?: string;
    related_entities?: Record<string, any>;
    child_entities?: Record<string, any>;
    entity_status?: string;
    created_at?: string;
    updated_at?: string;
  };
  search_sessions: {
    id?: string;
    tenant_id: string;
    user_id: string;
    session_title?: string;
    last_activity_at?: string;
    ended_at?: string;
    total_duration_minutes?: number;
    query_count?: number;
    created_at?: string;
    updated_at?: string;
  };
  content_similarities: {
    id?: string;
    tenant_id: string;
    content_a_id: string;
    content_a_type: string;
    content_b_id: string;
    content_b_type: string;
    vector_similarity?: number;
    user_validated?: boolean;
    validation_feedback?: Record<string, any>;
    recommendation_clicks?: number;
    recommendation_usefulness_rating?: number;
    created_at?: string;
    updated_at?: string;
  };
  search_analytics: {
    id?: string;
    tenant_id: string;
    analysis_date: string;
    total_queries?: number;
    unique_users?: number;
    average_queries_per_user?: number;
    most_common_query_types?: Record<string, any>;
    average_result_count?: number;
    zero_result_query_rate?: number;
    answers_generated?: number;
    average_answer_confidence?: number;
    answer_helpfulness_rate?: number;
    session_completion_rate?: number;
    follow_up_query_rate?: number;
    most_retrieved_content?: Record<string, any>;
    answer_generation_time_ms?: number;
    ai_accuracy_indicators?: Record<string, any>;
    ai_insights?: Record<string, any>;
  };
  calendar_connections: {
    id?: string;
    tenant_id: string;
    user_id: string;
    provider: string;
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: string;
    calendar_id?: string;
    is_primary?: boolean;
    sync_enabled?: boolean;
    last_sync_at?: string;
    sync_token?: string;
    updated_at?: string;
  };
  calendar_events: {
    id?: string;
    tenant_id: string;
    user_id: string;
    calendar_connection_id?: string;
    external_event_id?: string;
    description?: string;
    start_time: string;
    end_time: string;
    is_all_day?: boolean;
    location?: string;
    attendees?: Record<string, any>;
    recurrence_rule?: string;
    cancelled?: string;
    private?: string;
    focus_time?: string;
    ai_confidence?: number;
    updated_at?: string;
  };
  calendar_event_reminders: {
    id?: string;
    event_id?: string;
    reminder_minutes: number;
    sms?: string;
    sent_at?: string;
    created_at?: string;
  };
  calendar_availability: {
    id?: string;
    tenant_id: string;
    user_id: string;
    day_of_week: number;
    end_time: string;
    timezone?: string;
    is_available?: boolean;
    availability_type?: string;
    break?: string;
    updated_at?: string;
  };
  calendar_sync_logs: {
    id?: string;
    calendar_connection_id?: string;
    sync_type: string;
    events_created?: number;
    events_updated?: number;
    events_deleted?: number;
    error_message?: string;
    sync_duration_ms?: number;
    created_at?: string;
  };
  meeting_recordings: {
    id?: string;
    meeting_id: string;
    recording_name: string;
    recording_url?: string;
    wav?: string;
    duration_seconds?: number;
    recording_source?: string;
    phone?: string;
    poor?: string;
    audio_only?: string;
    failed?: string;
    failed?: string;
    failed?: string;
    processing_started_at?: string;
    processing_completed_at?: string;
    uploaded_by: string;
    is_public?: boolean;
    updated_at?: string;
  };
  meeting_transcriptions: {
    id?: string;
    recording_id?: string;
    meeting_id: string;
    tenant_id: string;
    full_transcript: string;
    transcript_segments: Record<string, any>;
    aws_transcribe?: string;
    processing_time_seconds?: number;
    overall_confidence?: number;
    speaker_count?: number;
    speakers?: Record<string, any>;
    detected_languages?: Record<string, any>;
    last_updated_at?: string;
    created_at?: string;
  };
  meeting_notes: {
    id?: string;
    meeting_id: string;
    recording_id?: string;
    transcription_id?: string;
    tenant_id: string;
    title: string;
    executive_summary?: string;
    detailed_notes?: string;
    key_points?: Record<string, any>;
    mixed?: string;
    low?: string;
    processing_time_seconds?: number;
    ai_confidence_score?: number;
    version?: number;
    is_final?: boolean;
    parent_note_id?: string;
    created_by: string;
    shared_with?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
  };
  meeting_highlights: {
    id?: string;
    meeting_id: string;
    recording_id?: string;
    transcription_id?: string;
    tenant_id: string;
    highlight_type: string;
    opportunity: string;
    description?: string;
    start_time_seconds?: number;
    transcript_excerpt?: string;
    negative?: string;
    none?: string;
    assigned_to?: string;
    completion_status?: string;
    cancelled?: string;
    created_at?: string;
    updated_at?: string;
  };
  meeting_speakers: {
    id?: string;
    tenant_id: string;
    user_id?: string;
    NULL?: string;
    email?: string;
    voice_signature_id?: string;
    total_speaking_time_minutes?: number;
    average_participation_rate?: number;
    created_at?: string;
    updated_at?: string;
  };
  meeting_content_search: {
    id?: string;
    meeting_id: string;
    tenant_id: string;
    searchable_content: string;
    and: string;
    action_items?: string;
    tags?: Record<string, any>;
    search_vector?: string;
    updated_at?: string;
  };
  meeting_content_analytics: {
    id?: string;
    tenant_id: string;
    analysis_date: string;
    total_meetings_recorded?: number;
    total_recording_hours?: number;
    total_transcription_words?: number;
    average_transcription_confidence?: number;
    average_ai_processing_time_seconds?: number;
    transcription_accuracy_rate?: number;
    most_discussed_topics?: Record<string, any>;
    average_meeting_productivity_score?: number;
    average_speaker_count?: number;
    most_active_speakers?: Record<string, any>;
    speaking_time_distribution?: Record<string, any>;
    decisions_made_count?: number;
    action_items_generated_count?: number;
    follow_up_completion_rate?: number;
    ai_insights?: Record<string, any>;
    ai_recommendations?: Record<string, any>;
    content_quality_trends?: Record<string, any>;
    created_at?: string;
  };
  recording_integrations: {
    id?: string;
    tenant_id: string;
    integration_type: string;
    manual: number;
    api_credentials?: Record<string, any>;
    auto_processing_enabled?: boolean;
    auto_transcription?: boolean;
    auto_note_generation?: boolean;
    auto_highlight_extraction?: boolean;
    notification_settings?: Record<string, any>;
    processing_complete_notifications?: Record<string, any>;
    last_successful_sync?: string;
    last_error_message?: string;
    error_count?: number;
    recordings_processed?: number;
    total_processing_time_hours?: number;
    created_by: string;
    created_at?: string;
    updated_at?: string;
  };
  task_categories: {
    id?: string;
    tenant_id: string;
    name: string;
    description?: string;
    color?: string;
    created_at?: string;
    updated_at?: string;
  };
  ai_tasks: {
    id?: string;
    tenant_id: string;
    user_id: string;
    category_id?: string;
    title: string;
    description?: string;
    priority?: string;
    low?: string;
    on_hold?: string;
    estimated_duration?: number;
    completion_date?: string;
    depends_on?: Record<string, any>;
    ai_suggested_end?: string;
    ai_priority_score?: number;
    is_ai_scheduled?: boolean;
    related_entity_type?: string;
    project_id?: string;
    assigned_to?: string;
    last_activity_at?: string;
    created_at?: string;
    updated_at?: string;
  };
  task_dependencies: {
    id?: string;
    predecessor_task_id?: string;
    successor_task_id?: string;
    dependency_type?: string;
    start_to_finish?: string;
  };
  task_time_entries: {
    id?: string;
    task_id?: string;
    user_id: string;
    start_time: string;
    end_time?: string;
    duration_minutes?: number;
    is_billable?: boolean;
    hourly_rate?: number;
    created_at?: string;
  };
  task_activities: {
    id?: string;
    task_id?: string;
    user_id: string;
    activity_type: string;
    metadata?: Record<string, any>;
  };
  task_templates: {
    id?: string;
    tenant_id: string;
    name: string;
    description?: string;
    category_id?: string;
    template_data: Record<string, any>;
    created_by: string;
    created_at?: string;
    updated_at?: string;
  };
  ai_task_suggestions: {
    id?: string;
    tenant_id: string;
    user_id: string;
    suggested_task: Record<string, any>;
    status?: string;
    dismissed?: string;
    responded_at?: string;
    response_user_id?: string;
  };
  product_models: {
    pricing_migrated?: boolean;
  };
  product_accessories: {
    pricing_migrated?: boolean;
  };
}

// Column name constants for type-safe queries
export const TableColumns = {
  ai_employees: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    employee_name: 'employee_name' as const,
    employee_type: 'employee_type' as const,
    ai_model: 'ai_model' as const,
    ai_personality: 'ai_personality' as const,
    communication: 'communication' as const,
    total_tasks_completed: 'total_tasks_completed' as const,
    average_task_completion_time_minutes: 'average_task_completion_time_minutes' as const,
    user_satisfaction_rating: 'user_satisfaction_rating' as const,
    learning_data: 'learning_data' as const,
    status: 'status' as const,
    last_active_at: 'last_active_at' as const,
    training_completion_percentage: 'training_completion_percentage' as const,
    tasks_assigned: 'tasks_assigned' as const,
    tasks_completed: 'tasks_completed' as const,
    tasks_failed: 'tasks_failed' as const,
    average_response_time_ms: 'average_response_time_ms' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  ai_employee_tasks: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    employee_id: 'employee_id' as const,
    task_type: 'task_type' as const,
    task_description: 'task_description' as const,
    task_priority: 'task_priority' as const,
    started_at: 'started_at' as const,
    completed_at: 'completed_at' as const,
    due_date: 'due_date' as const,
    status: 'status' as const,
    current_step: 'current_step' as const,
    human_review_status: 'human_review_status' as const,
    ai_confidence_score: 'ai_confidence_score' as const,
    error_messages: 'error_messages' as const,
    parent_task_id: 'parent_task_id' as const,
    workflow_id: 'workflow_id' as const,
    estimated_cost: 'estimated_cost' as const,
    actual_cost: 'actual_cost' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  ai_employee_workflows: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    workflow_name: 'workflow_name' as const,
    workflow_type: 'workflow_type' as const,
    workflow_version: 'workflow_version' as const,
    workflow_steps: 'workflow_steps' as const,
    success_rate: 'success_rate' as const,
    total_executions: 'total_executions' as const,
    optimization_suggestions: 'optimization_suggestions' as const,
    status: 'status' as const,
    approved_by: 'approved_by' as const,
    approved_at: 'approved_at' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  ai_workflow_executions: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    workflow_id: 'workflow_id' as const,
    triggered_by: 'triggered_by' as const,
    input_data: 'input_data' as const,
    started_at: 'started_at' as const,
    completed_at: 'completed_at' as const,
    current_step_index: 'current_step_index' as const,
    current_step_name: 'current_step_name' as const,
    status: 'status' as const,
    error_details: 'error_details' as const,
    total_execution_time_minutes: 'total_execution_time_minutes' as const,
    steps_completed: 'steps_completed' as const,
    steps_failed: 'steps_failed' as const,
    human_interventions: 'human_interventions' as const,
    total_ai_tokens_used: 'total_ai_tokens_used' as const,
    total_cost: 'total_cost' as const,
    employees_involved: 'employees_involved' as const,
    updated_at: 'updated_at' as const,
  },
  ai_employee_skills: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    employee_id: 'employee_id' as const,
    skill_name: 'skill_name' as const,
    skill_category: 'skill_category' as const,
    proficiency_level: 'proficiency_level' as const,
    success_rate: 'success_rate' as const,
    training_data: 'training_data' as const,
    practice_opportunities: 'practice_opportunities' as const,
    improvement_suggestions: 'improvement_suggestions' as const,
    times_used: 'times_used' as const,
    last_used_at: 'last_used_at' as const,
    average_performance_score: 'average_performance_score' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  ai_employee_interactions: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    employee_id: 'employee_id' as const,
    interaction_type: 'interaction_type' as const,
    interaction_content: 'interaction_content' as const,
    interaction_context: 'interaction_context' as const,
    sentiment_analysis: 'sentiment_analysis' as const,
    started_at: 'started_at' as const,
    ended_at: 'ended_at' as const,
    response_time_ms: 'response_time_ms' as const,
    interaction_outcome: 'interaction_outcome' as const,
    follow_up_date: 'follow_up_date' as const,
    ai_confidence_in_response: 'ai_confidence_in_response' as const,
    human_intervention_required: 'human_intervention_required' as const,
    quality_score: 'quality_score' as const,
    updated_at: 'updated_at' as const,
  },
  ai_employee_training: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    employee_id: 'employee_id' as const,
    training_type: 'training_type' as const,
    training_description: 'training_description' as const,
    training_data: 'training_data' as const,
    training_method: 'training_method' as const,
    started_at: 'started_at' as const,
    completed_at: 'completed_at' as const,
    progress_percentage: 'progress_percentage' as const,
    pre_training_performance: 'pre_training_performance' as const,
    post_training_performance: 'post_training_performance' as const,
    improvement_metrics: 'improvement_metrics' as const,
    validation_results: 'validation_results' as const,
    test_scenarios_passed: 'test_scenarios_passed' as const,
    test_scenarios_failed: 'test_scenarios_failed' as const,
    status: 'status' as const,
    approved_at: 'approved_at' as const,
    deployment_date: 'deployment_date' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  ai_employee_analytics: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    employee_id: 'employee_id' as const,
    analysis_date: 'analysis_date' as const,
    tasks_assigned: 'tasks_assigned' as const,
    tasks_completed: 'tasks_completed' as const,
    tasks_failed: 'tasks_failed' as const,
    average_completion_time_minutes: 'average_completion_time_minutes' as const,
    average_quality_score: 'average_quality_score' as const,
    customer_satisfaction_rating: 'customer_satisfaction_rating' as const,
    human_intervention_rate: 'human_intervention_rate' as const,
    error_rate: 'error_rate' as const,
    total_ai_tokens_used: 'total_ai_tokens_used' as const,
    total_cost: 'total_cost' as const,
    cost_per_task: 'cost_per_task' as const,
    roi_estimate: 'roi_estimate' as const,
    skill_improvements: 'skill_improvements' as const,
    training_hours: 'training_hours' as const,
    total_interactions: 'total_interactions' as const,
    successful_interactions: 'successful_interactions' as const,
    escalated_interactions: 'escalated_interactions' as const,
    average_response_time_ms: 'average_response_time_ms' as const,
    performance_vs_baseline: 'performance_vs_baseline' as const,
  },
  ai_scheduling_preferences: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    work_hours_start: 'work_hours_start' as const,
    work_hours_end: 'work_hours_end' as const,
    work_days: 'work_days' as const,
    timezone: 'timezone' as const,
    preferred_meeting_duration: 'preferred_meeting_duration' as const,
    max_meetings_per_day: 'max_meetings_per_day' as const,
    learning_enabled: 'learning_enabled' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  ai_generated_content: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    content_type: 'content_type' as const,
    title: 'title' as const,
    content: 'content' as const,
    model_used: 'model_used' as const,
    usage_count: 'usage_count' as const,
    user_rating: 'user_rating' as const,
    status: 'status' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  business_records: {
    IF: 'IF' as const,
  },
  deals: {
    IF: 'IF' as const,
  },
  vector_embeddings: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    content_id: 'content_id' as const,
    vector_version: 'vector_version' as const,
    content_text: 'content_text' as const,
    content_summary: 'content_summary' as const,
    content_keywords: 'content_keywords' as const,
    content_author_id: 'content_author_id' as const,
    content_created_at: 'content_created_at' as const,
    access_level: 'access_level' as const,
    embedding_source: 'embedding_source' as const,
    updated_at: 'updated_at' as const,
  },
  ai_search_queries: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    query_text: 'query_text' as const,
    query_intent: 'query_intent' as const,
    search_filters: 'search_filters' as const,
    query_embedding: 'query_embedding' as const,
    top_result_scores: 'top_result_scores' as const,
    user_satisfaction_rating: 'user_satisfaction_rating' as const,
    result_quality_feedback: 'result_quality_feedback' as const,
  },
  ai_generated_answers: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    query_id: 'query_id' as const,
    answer_text: 'answer_text' as const,
    answer_confidence: 'answer_confidence' as const,
    user_unhelpful_votes: 'user_unhelpful_votes' as const,
    user_corrections: 'user_corrections' as const,
    generation_prompt: 'generation_prompt' as const,
    generation_parameters: 'generation_parameters' as const,
    processing_time_ms: 'processing_time_ms' as const,
    tokens_used: 'tokens_used' as const,
    version: 'version' as const,
    superseded_by: 'superseded_by' as const,
    is_current: 'is_current' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  knowledge_entities: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    entity_name: 'entity_name' as const,
    entity_type: 'entity_type' as const,
    entity_summary: 'entity_summary' as const,
    related_entities: 'related_entities' as const,
    child_entities: 'child_entities' as const,
    entity_status: 'entity_status' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  search_sessions: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    session_title: 'session_title' as const,
    last_activity_at: 'last_activity_at' as const,
    ended_at: 'ended_at' as const,
    total_duration_minutes: 'total_duration_minutes' as const,
    query_count: 'query_count' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  content_similarities: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    content_a_id: 'content_a_id' as const,
    content_a_type: 'content_a_type' as const,
    content_b_id: 'content_b_id' as const,
    content_b_type: 'content_b_type' as const,
    vector_similarity: 'vector_similarity' as const,
    user_validated: 'user_validated' as const,
    validation_feedback: 'validation_feedback' as const,
    recommendation_clicks: 'recommendation_clicks' as const,
    recommendation_usefulness_rating: 'recommendation_usefulness_rating' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  search_analytics: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    analysis_date: 'analysis_date' as const,
    total_queries: 'total_queries' as const,
    unique_users: 'unique_users' as const,
    average_queries_per_user: 'average_queries_per_user' as const,
    most_common_query_types: 'most_common_query_types' as const,
    average_result_count: 'average_result_count' as const,
    zero_result_query_rate: 'zero_result_query_rate' as const,
    answers_generated: 'answers_generated' as const,
    average_answer_confidence: 'average_answer_confidence' as const,
    answer_helpfulness_rate: 'answer_helpfulness_rate' as const,
    session_completion_rate: 'session_completion_rate' as const,
    follow_up_query_rate: 'follow_up_query_rate' as const,
    most_retrieved_content: 'most_retrieved_content' as const,
    answer_generation_time_ms: 'answer_generation_time_ms' as const,
    ai_accuracy_indicators: 'ai_accuracy_indicators' as const,
    ai_insights: 'ai_insights' as const,
  },
  calendar_connections: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    provider: 'provider' as const,
    access_token: 'access_token' as const,
    refresh_token: 'refresh_token' as const,
    token_expires_at: 'token_expires_at' as const,
    calendar_id: 'calendar_id' as const,
    is_primary: 'is_primary' as const,
    sync_enabled: 'sync_enabled' as const,
    last_sync_at: 'last_sync_at' as const,
    sync_token: 'sync_token' as const,
    updated_at: 'updated_at' as const,
  },
  calendar_events: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    calendar_connection_id: 'calendar_connection_id' as const,
    external_event_id: 'external_event_id' as const,
    description: 'description' as const,
    start_time: 'start_time' as const,
    end_time: 'end_time' as const,
    is_all_day: 'is_all_day' as const,
    location: 'location' as const,
    attendees: 'attendees' as const,
    recurrence_rule: 'recurrence_rule' as const,
    cancelled: 'cancelled' as const,
    private: 'private' as const,
    focus_time: 'focus_time' as const,
    ai_confidence: 'ai_confidence' as const,
    updated_at: 'updated_at' as const,
  },
  calendar_event_reminders: {
    id: 'id' as const,
    event_id: 'event_id' as const,
    reminder_minutes: 'reminder_minutes' as const,
    sms: 'sms' as const,
    sent_at: 'sent_at' as const,
    created_at: 'created_at' as const,
  },
  calendar_availability: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    day_of_week: 'day_of_week' as const,
    end_time: 'end_time' as const,
    timezone: 'timezone' as const,
    is_available: 'is_available' as const,
    availability_type: 'availability_type' as const,
    break: 'break' as const,
    updated_at: 'updated_at' as const,
  },
  calendar_sync_logs: {
    id: 'id' as const,
    calendar_connection_id: 'calendar_connection_id' as const,
    sync_type: 'sync_type' as const,
    events_created: 'events_created' as const,
    events_updated: 'events_updated' as const,
    events_deleted: 'events_deleted' as const,
    error_message: 'error_message' as const,
    sync_duration_ms: 'sync_duration_ms' as const,
    created_at: 'created_at' as const,
  },
  meeting_recordings: {
    id: 'id' as const,
    meeting_id: 'meeting_id' as const,
    recording_name: 'recording_name' as const,
    recording_url: 'recording_url' as const,
    wav: 'wav' as const,
    duration_seconds: 'duration_seconds' as const,
    recording_source: 'recording_source' as const,
    phone: 'phone' as const,
    poor: 'poor' as const,
    audio_only: 'audio_only' as const,
    failed: 'failed' as const,
    failed: 'failed' as const,
    failed: 'failed' as const,
    processing_started_at: 'processing_started_at' as const,
    processing_completed_at: 'processing_completed_at' as const,
    uploaded_by: 'uploaded_by' as const,
    is_public: 'is_public' as const,
    updated_at: 'updated_at' as const,
  },
  meeting_transcriptions: {
    id: 'id' as const,
    recording_id: 'recording_id' as const,
    meeting_id: 'meeting_id' as const,
    tenant_id: 'tenant_id' as const,
    full_transcript: 'full_transcript' as const,
    transcript_segments: 'transcript_segments' as const,
    aws_transcribe: 'aws_transcribe' as const,
    processing_time_seconds: 'processing_time_seconds' as const,
    overall_confidence: 'overall_confidence' as const,
    speaker_count: 'speaker_count' as const,
    speakers: 'speakers' as const,
    detected_languages: 'detected_languages' as const,
    last_updated_at: 'last_updated_at' as const,
    created_at: 'created_at' as const,
  },
  meeting_notes: {
    id: 'id' as const,
    meeting_id: 'meeting_id' as const,
    recording_id: 'recording_id' as const,
    transcription_id: 'transcription_id' as const,
    tenant_id: 'tenant_id' as const,
    title: 'title' as const,
    executive_summary: 'executive_summary' as const,
    detailed_notes: 'detailed_notes' as const,
    key_points: 'key_points' as const,
    mixed: 'mixed' as const,
    low: 'low' as const,
    processing_time_seconds: 'processing_time_seconds' as const,
    ai_confidence_score: 'ai_confidence_score' as const,
    version: 'version' as const,
    is_final: 'is_final' as const,
    parent_note_id: 'parent_note_id' as const,
    created_by: 'created_by' as const,
    shared_with: 'shared_with' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  meeting_highlights: {
    id: 'id' as const,
    meeting_id: 'meeting_id' as const,
    recording_id: 'recording_id' as const,
    transcription_id: 'transcription_id' as const,
    tenant_id: 'tenant_id' as const,
    highlight_type: 'highlight_type' as const,
    opportunity: 'opportunity' as const,
    description: 'description' as const,
    start_time_seconds: 'start_time_seconds' as const,
    transcript_excerpt: 'transcript_excerpt' as const,
    negative: 'negative' as const,
    none: 'none' as const,
    assigned_to: 'assigned_to' as const,
    completion_status: 'completion_status' as const,
    cancelled: 'cancelled' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  meeting_speakers: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    NULL: 'NULL' as const,
    email: 'email' as const,
    voice_signature_id: 'voice_signature_id' as const,
    total_speaking_time_minutes: 'total_speaking_time_minutes' as const,
    average_participation_rate: 'average_participation_rate' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  meeting_content_search: {
    id: 'id' as const,
    meeting_id: 'meeting_id' as const,
    tenant_id: 'tenant_id' as const,
    searchable_content: 'searchable_content' as const,
    and: 'and' as const,
    action_items: 'action_items' as const,
    tags: 'tags' as const,
    search_vector: 'search_vector' as const,
    updated_at: 'updated_at' as const,
  },
  meeting_content_analytics: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    analysis_date: 'analysis_date' as const,
    total_meetings_recorded: 'total_meetings_recorded' as const,
    total_recording_hours: 'total_recording_hours' as const,
    total_transcription_words: 'total_transcription_words' as const,
    average_transcription_confidence: 'average_transcription_confidence' as const,
    average_ai_processing_time_seconds: 'average_ai_processing_time_seconds' as const,
    transcription_accuracy_rate: 'transcription_accuracy_rate' as const,
    most_discussed_topics: 'most_discussed_topics' as const,
    average_meeting_productivity_score: 'average_meeting_productivity_score' as const,
    average_speaker_count: 'average_speaker_count' as const,
    most_active_speakers: 'most_active_speakers' as const,
    speaking_time_distribution: 'speaking_time_distribution' as const,
    decisions_made_count: 'decisions_made_count' as const,
    action_items_generated_count: 'action_items_generated_count' as const,
    follow_up_completion_rate: 'follow_up_completion_rate' as const,
    ai_insights: 'ai_insights' as const,
    ai_recommendations: 'ai_recommendations' as const,
    content_quality_trends: 'content_quality_trends' as const,
    created_at: 'created_at' as const,
  },
  recording_integrations: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    integration_type: 'integration_type' as const,
    manual: 'manual' as const,
    api_credentials: 'api_credentials' as const,
    auto_processing_enabled: 'auto_processing_enabled' as const,
    auto_transcription: 'auto_transcription' as const,
    auto_note_generation: 'auto_note_generation' as const,
    auto_highlight_extraction: 'auto_highlight_extraction' as const,
    notification_settings: 'notification_settings' as const,
    processing_complete_notifications: 'processing_complete_notifications' as const,
    last_successful_sync: 'last_successful_sync' as const,
    last_error_message: 'last_error_message' as const,
    error_count: 'error_count' as const,
    recordings_processed: 'recordings_processed' as const,
    total_processing_time_hours: 'total_processing_time_hours' as const,
    created_by: 'created_by' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  task_categories: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    name: 'name' as const,
    description: 'description' as const,
    color: 'color' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  ai_tasks: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    category_id: 'category_id' as const,
    title: 'title' as const,
    description: 'description' as const,
    priority: 'priority' as const,
    low: 'low' as const,
    on_hold: 'on_hold' as const,
    estimated_duration: 'estimated_duration' as const,
    completion_date: 'completion_date' as const,
    depends_on: 'depends_on' as const,
    ai_suggested_end: 'ai_suggested_end' as const,
    ai_priority_score: 'ai_priority_score' as const,
    is_ai_scheduled: 'is_ai_scheduled' as const,
    related_entity_type: 'related_entity_type' as const,
    project_id: 'project_id' as const,
    assigned_to: 'assigned_to' as const,
    last_activity_at: 'last_activity_at' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  task_dependencies: {
    id: 'id' as const,
    predecessor_task_id: 'predecessor_task_id' as const,
    successor_task_id: 'successor_task_id' as const,
    dependency_type: 'dependency_type' as const,
    start_to_finish: 'start_to_finish' as const,
  },
  task_time_entries: {
    id: 'id' as const,
    task_id: 'task_id' as const,
    user_id: 'user_id' as const,
    start_time: 'start_time' as const,
    end_time: 'end_time' as const,
    duration_minutes: 'duration_minutes' as const,
    is_billable: 'is_billable' as const,
    hourly_rate: 'hourly_rate' as const,
    created_at: 'created_at' as const,
  },
  task_activities: {
    id: 'id' as const,
    task_id: 'task_id' as const,
    user_id: 'user_id' as const,
    activity_type: 'activity_type' as const,
    metadata: 'metadata' as const,
  },
  task_templates: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    name: 'name' as const,
    description: 'description' as const,
    category_id: 'category_id' as const,
    template_data: 'template_data' as const,
    created_by: 'created_by' as const,
    created_at: 'created_at' as const,
    updated_at: 'updated_at' as const,
  },
  ai_task_suggestions: {
    id: 'id' as const,
    tenant_id: 'tenant_id' as const,
    user_id: 'user_id' as const,
    suggested_task: 'suggested_task' as const,
    status: 'status' as const,
    dismissed: 'dismissed' as const,
    responded_at: 'responded_at' as const,
    response_user_id: 'response_user_id' as const,
  },
  product_models: {
    pricing_migrated: 'pricing_migrated' as const,
  },
  product_accessories: {
    pricing_migrated: 'pricing_migrated' as const,
  },
} as const;
