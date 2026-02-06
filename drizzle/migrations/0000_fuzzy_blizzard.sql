CREATE TYPE "public"."access_review_status" AS ENUM('not_started', 'in_progress', 'completed', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."access_type" AS ENUM('read', 'write', 'delete', 'export');--> statement-breakpoint
CREATE TYPE "public"."activity_goal_type" AS ENUM('calls', 'emails', 'meetings', 'reachouts', 'proposals', 'new_opportunities', 'demos', 'follow_ups');--> statement-breakpoint
CREATE TYPE "public"."adjustment_type" AS ENUM('chargeback', 'bonus', 'penalty', 'correction', 'manual_adjustment', 'split_adjustment');--> statement-breakpoint
CREATE TYPE "public"."ai_confidence" AS ENUM('high', 'medium', 'low', 'manual');--> statement-breakpoint
CREATE TYPE "public"."ai_generation_status" AS ENUM('pending', 'generating', 'completed', 'failed', 'review_needed');--> statement-breakpoint
CREATE TYPE "public"."alert_category" AS ENUM('data_breach', 'malware', 'unauthorized_access', 'ddos', 'brute_force', 'suspicious_data_export', 'privilege_escalation', 'account_takeover', 'phishing', 'sql_injection', 'xss', 'api_abuse', 'insider_threat', 'compliance_violation', 'other');--> statement-breakpoint
CREATE TYPE "public"."alert_priority" AS ENUM('p1', 'p2', 'p3', 'p4');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'acknowledged', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."analysis_type" AS ENUM('diagnostic', 'repair', 'maintenance', 'installation', 'inspection', 'training');--> statement-breakpoint
CREATE TYPE "public"."approval_chain_type" AS ENUM('sequential', 'parallel', 'conditional', 'any_one');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'in_review', 'approved', 'rejected', 'escalated', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('discount', 'custom_pricing', 'payment_terms', 'contract_terms', 'deal_structure', 'pricing_exception', 'waived_fees', 'custom_package');--> statement-breakpoint
CREATE TYPE "public"."article_category" AS ENUM('crm_sales', 'service_management', 'meter_billing', 'inventory_warehouse', 'manufacturer_integration', 'fleet_monitoring', 'workflow_automation', 'ai_features', 'customer_portal', 'reporting_analytics', 'system_setup', 'troubleshooting', 'best_practices', 'getting_started');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."audit_category" AS ENUM('authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('api_key', 'oauth2', 'basic_auth', 'certificate', 'hmac');--> statement-breakpoint
CREATE TYPE "public"."calculation_status" AS ENUM('draft', 'calculated', 'approved', 'paid', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."check_in_type" AS ENUM('arrival', 'departure', 'break_start', 'break_end');--> statement-breakpoint
CREATE TYPE "public"."collection_frequency" AS ENUM('real_time', 'hourly', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."company_size" AS ENUM('small', 'medium', 'large', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."condition_operator" AS ENUM('equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'is_null', 'is_not_null', 'matches_regex');--> statement-breakpoint
CREATE TYPE "public"."manufacturer_connection_status" AS ENUM('active', 'inactive', 'suspended', 'error');--> statement-breakpoint
CREATE TYPE "public"."contact_method" AS ENUM('phone', 'email', 'portal', 'chat', 'walk_in');--> statement-breakpoint
CREATE TYPE "public"."containment_action_type" AS ENUM('suspend_user', 'terminate_session', 'block_ip', 'quarantine_file', 'disable_integration', 'rate_limit', 'force_password_reset', 'enable_mfa', 'restrict_permissions', 'notify_team');--> statement-breakpoint
CREATE TYPE "public"."content_category" AS ENUM('operational_efficiency', 'meter_billing', 'service_operations', 'business_growth', 'integration', 'mobile', 'analytics', 'automation', 'security', 'industry_news');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('tutorial', 'how_to', 'reference', 'troubleshooting', 'best_practice', 'release_notes', 'faq', 'video', 'api_documentation');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'review', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('active', 'expiring_soon', 'renewal_proposed', 'renewal_negotiating', 'renewed', 'expired', 'cancelled', 'churned');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('service_agreement', 'equipment_lease', 'supplies_contract', 'managed_print_services', 'full_service', 'custom');--> statement-breakpoint
CREATE TYPE "public"."customer_portal_status" AS ENUM('active', 'inactive', 'suspended', 'pending_activation');--> statement-breakpoint
CREATE TYPE "public"."data_classification" AS ENUM('public', 'internal', 'confidential', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('online', 'offline', 'error', 'maintenance', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."calculator_device_type" AS ENUM('desktop_printer', 'copier', 'mfp', 'production_printer');--> statement-breakpoint
CREATE TYPE "public"."difficulty_level" AS ENUM('beginner', 'intermediate', 'advanced', 'expert');--> statement-breakpoint
CREATE TYPE "public"."disposition_action" AS ENUM('return', 'purchase', 'renew', 'upgrade', 'extend');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('submitted', 'under_review', 'escalated', 'resolved', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."dispute_type" AS ENUM('calculation_error', 'split_commission', 'chargeback_dispute', 'rate_dispute', 'quota_dispute', 'bonus_dispute');--> statement-breakpoint
CREATE TYPE "public"."document_format" AS ENUM('pdf', 'docx', 'html', 'markdown', 'txt');--> statement-breakpoint
CREATE TYPE "public"."document_template_type" AS ENUM('contract', 'purchase_order', 'invoice', 'quote', 'proposal', 'service_agreement', 'work_order', 'email', 'letter', 'form', 'report', 'custom');--> statement-breakpoint
CREATE TYPE "public"."email_sequence_status" AS ENUM('pending', 'sent', 'opened', 'clicked', 'bounced', 'failed');--> statement-breakpoint
CREATE TYPE "public"."enhanced_ticket_status" AS ENUM('new', 'assigned', 'scheduled', 'en_route', 'on_site', 'in_progress', 'parts_needed', 'customer_approval', 'testing', 'completed', 'follow_up_required', 'cancelled', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."equipment_onboarding_status" AS ENUM('draft', 'in_progress', 'pending_review', 'completed', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."exception_severity" AS ENUM('info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."exception_type" AS ENUM('connection_failed', 'authentication_failed', 'validation_error', 'product_not_found', 'insufficient_inventory', 'price_mismatch', 'order_rejected', 'shipment_delayed', 'delivery_failed', 'timeout', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."field_service_status" AS ENUM('scheduled', 'en_route', 'checked_in', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."calculator_fleet_age" AS ENUM('under_2_years', '2_4_years', '5_7_years', '8_plus_years');--> statement-breakpoint
CREATE TYPE "public"."gdpr_request_type" AS ENUM('access', 'rectification', 'erasure', 'portability', 'restrict_processing', 'object_processing');--> statement-breakpoint
CREATE TYPE "public"."gdpr_status" AS ENUM('pending', 'in_progress', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."goal_period" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."health_score_grade" AS ENUM('excellent', 'good', 'fair', 'poor', 'critical');--> statement-breakpoint
CREATE TYPE "public"."calculator_industry_type" AS ENUM('healthcare', 'legal', 'education', 'financial_services', 'manufacturing', 'retail', 'government', 'technology', 'professional_services', 'non_profit', 'other');--> statement-breakpoint
CREATE TYPE "public"."installation_type" AS ENUM('new_installation', 'replacement', 'relocation', 'upgrade');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('active', 'inactive', 'error', 'pending');--> statement-breakpoint
CREATE TYPE "public"."issue_category" AS ENUM('paper_jam', 'print_quality', 'connectivity', 'hardware_failure', 'software_issue', 'toner_cartridge', 'maintenance', 'installation', 'training', 'other');--> statement-breakpoint
CREATE TYPE "public"."keyword_tier" AS ENUM('tier1_pain_points', 'tier2_solution_specific', 'tier3_conversational');--> statement-breakpoint
CREATE TYPE "public"."kit_quality_status" AS ENUM('pass', 'fail', 'rework_required', 'pending_inspection');--> statement-breakpoint
CREATE TYPE "public"."lease_payment_status" AS ENUM('scheduled', 'processing', 'completed', 'failed', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('pending', 'active', 'pending_renewal', 'renewed', 'expired', 'terminated', 'defaulted');--> statement-breakpoint
CREATE TYPE "public"."lease_type" AS ENUM('fmv', 'dollar_buyout', 'ten_percent', 'trac', 'operating', 'capital');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_event_type" AS ENUM('onboarding_started', 'onboarding_in_progress', 'onboarding_completed', 'onboarding_failed', 'offboarding_started', 'offboarding_in_progress', 'offboarding_completed', 'offboarding_failed', 'role_changed', 'access_granted', 'access_revoked', 'access_review_started', 'access_review_completed');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."logical_operator" AS ENUM('AND', 'OR', 'NOT');--> statement-breakpoint
CREATE TYPE "public"."manufacturer" AS ENUM('canon', 'xerox', 'hp', 'konica_minolta', 'lexmark', 'fmaudit', 'printanista');--> statement-breakpoint
CREATE TYPE "public"."manufacturer_type" AS ENUM('canon', 'xerox', 'hp', 'ricoh', 'konica_minolta', 'sharp', 'brother', 'epson', 'kyocera', 'lexmark', 'other');--> statement-breakpoint
CREATE TYPE "public"."markup_type" AS ENUM('percentage', 'fixed_amount', 'custom');--> statement-breakpoint
CREATE TYPE "public"."meter_submission_method" AS ENUM('manual_entry', 'photo_upload', 'email', 'automated');--> statement-breakpoint
CREATE TYPE "public"."network_assignment" AS ENUM('static', 'dhcp', 'reserved_dhcp');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('service_update', 'invoice_ready', 'payment_due', 'supply_low', 'maintenance_reminder', 'system_alert');--> statement-breakpoint
CREATE TYPE "public"."ocr_processing_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_method" AS ENUM('api', 'edi', 'email', 'portal', 'manual');--> statement-breakpoint
CREATE TYPE "public"."order_priority" AS ENUM('low', 'medium', 'high', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."manufacturer_order_status" AS ENUM('draft', 'pending_approval', 'approved', 'submitted', 'acknowledged', 'processing', 'shipped', 'partially_shipped', 'delivered', 'cancelled', 'rejected', 'error');--> statement-breakpoint
CREATE TYPE "public"."organizational_tier" AS ENUM('platform', 'company', 'regional', 'location');--> statement-breakpoint
CREATE TYPE "public"."calculator_pain_point" AS ENUM('high_costs', 'frequent_breakdowns', 'supply_management', 'lack_of_visibility');--> statement-breakpoint
CREATE TYPE "public"."parts_order_status" AS ENUM('pending', 'ordered', 'shipped', 'delivered', 'installed', 'returned');--> statement-breakpoint
CREATE TYPE "public"."payment_frequency" AS ENUM('weekly', 'bi_weekly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('credit_card', 'ach', 'wire_transfer', 'check', 'auto_pay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_paid');--> statement-breakpoint
CREATE TYPE "public"."permission_effect" AS ENUM('ALLOW', 'DENY');--> statement-breakpoint
CREATE TYPE "public"."pipeline_type" AS ENUM('new_business', 'renewals', 'expansions', 'upsell', 'cross_sell', 'custom');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('sales_rep', 'sales_manager', 'service_tech', 'account_manager', 'inside_sales', 'field_sales');--> statement-breakpoint
CREATE TYPE "public"."platform_activity_type" AS ENUM('call', 'email', 'meeting', 'demo', 'proposal', 'trial_check_in', 'support_ticket', 'renewal_discussion', 'executive_review', 'note', 'task');--> statement-breakpoint
CREATE TYPE "public"."platform_churn_risk" AS ENUM('very_low', 'low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."platform_deal_stage" AS ENUM('prospecting', 'qualification', 'demo_scheduled', 'demo_completed', 'trial_started', 'proposal', 'negotiation', 'closed_won', 'closed_lost');--> statement-breakpoint
CREATE TYPE "public"."platform_health_status" AS ENUM('excellent', 'healthy', 'at_risk', 'critical', 'churned');--> statement-breakpoint
CREATE TYPE "public"."platform_lead_grade" AS ENUM('A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F');--> statement-breakpoint
CREATE TYPE "public"."platform_lead_tier" AS ENUM('hot', 'warm', 'cold');--> statement-breakpoint
CREATE TYPE "public"."platform_record_status" AS ENUM('new', 'contacted', 'qualified', 'demo_scheduled', 'demo_completed', 'trial_started', 'trial_active', 'proposal_sent', 'negotiating', 'active_customer', 'at_risk', 'renewal_pending', 'churned', 'former_customer', 'lost', 'disqualified', 'not_a_fit');--> statement-breakpoint
CREATE TYPE "public"."platform_record_type" AS ENUM('prospect', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."pricing_approval_status" AS ENUM('pending', 'approved', 'rejected', 'auto_approved');--> statement-breakpoint
CREATE TYPE "public"."print_management_system" AS ENUM('papercut', 'equitrac', 'ysoft', 'other', 'none');--> statement-breakpoint
CREATE TYPE "public"."renewal_action" AS ENUM('monitor', 'send_proposal', 'schedule_call', 'offer_incentive', 'escalate_to_sales', 'increase_engagement', 'address_concerns');--> statement-breakpoint
CREATE TYPE "public"."renewal_risk" AS ENUM('very_low', 'low', 'medium', 'high', 'very_high');--> statement-breakpoint
CREATE TYPE "public"."resolution_confidence" AS ENUM('very_low', 'low', 'medium', 'high', 'very_high');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approved', 'revoked', 'modified', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."role_hierarchy_level" AS ENUM('level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6', 'level_7', 'level_8');--> statement-breakpoint
CREATE TYPE "public"."role_type" AS ENUM('platform_admin', 'company_admin', 'regional_manager', 'location_manager', 'department_role');--> statement-breakpoint
CREATE TYPE "public"."routing_reason" AS ENUM('category_match', 'workload_balance', 'expertise_match', 'availability', 'escalation', 'manual_assignment');--> statement-breakpoint
CREATE TYPE "public"."seo_alert_status" AS ENUM('active', 'acknowledged', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."seo_audit_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."seo_content_status" AS ENUM('draft', 'optimized', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."seo_fix_status" AS ENUM('pending', 'applied', 'failed', 'reverted');--> statement-breakpoint
CREATE TYPE "public"."seo_monitoring_frequency" AS ENUM('hourly', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."seo_notification_type" AS ENUM('email', 'slack', 'webhook', 'dashboard');--> statement-breakpoint
CREATE TYPE "public"."seo_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."service_outcome" AS ENUM('resolved', 'partial_fix', 'requires_parts', 'requires_escalation', 'customer_declined', 'follow_up_needed', 'warranty_claim', 'preventive_maintenance');--> statement-breakpoint
CREATE TYPE "public"."service_request_priority" AS ENUM('low', 'normal', 'high', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."service_request_status" AS ENUM('submitted', 'acknowledged', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_request_type" AS ENUM('maintenance', 'repair', 'installation', 'training', 'supplies', 'technical_support', 'other');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'picked', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'delayed', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."step_action_type" AS ENUM('email', 'sms', 'http_request', 'database_update', 'create_task', 'create_ticket', 'send_notification', 'update_crm', 'generate_invoice', 'create_quote', 'schedule_appointment', 'assign_technician', 'order_parts', 'send_webhook', 'wait_delay', 'conditional_branch', 'loop', 'transform_data', 'call_integration', 'require_approval', 'wait_for_approval');--> statement-breakpoint
CREATE TYPE "public"."step_execution_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."supply_order_status" AS ENUM('draft', 'submitted', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."supply_replenishment_status" AS ENUM('monitoring', 'predicted_low', 'low', 'order_placed', 'order_confirmed', 'in_transit', 'delivered', 'installed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."supply_type" AS ENUM('toner_black', 'toner_cyan', 'toner_magenta', 'toner_yellow', 'drum', 'fuser', 'transfer_belt', 'waste_toner_bottle', 'staples', 'paper');--> statement-breakpoint
CREATE TYPE "public"."tenant_industry_type" AS ENUM('managed_print_services', 'it_services', 'equipment_rental', 'field_services', 'manufacturing', 'healthcare', 'education', 'finance', 'retail', 'other');--> statement-breakpoint
CREATE TYPE "public"."tenant_integration_status" AS ENUM('not_configured', 'configuring', 'testing', 'active', 'failed', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."tenant_onboarding_status" AS ENUM('not_started', 'in_progress', 'completed', 'abandoned', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tenant_onboarding_step_status" AS ENUM('pending', 'in_progress', 'completed', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."threshold_type" AS ENUM('discount_percentage', 'discount_amount', 'margin_below', 'deal_value', 'total_contract_value', 'payment_terms_days', 'custom_field');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('event', 'schedule', 'manual', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."calculator_user_role" AS ENUM('it_manager', 'office_manager', 'copier_dealer', 'owner', 'other');--> statement-breakpoint
CREATE TYPE "public"."warehouse_operation_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'inactive', 'error', 'pending_setup');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('on_premise', 'cloud', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('view_report', 'export_report', 'schedule_report', 'customize_dashboard', 'create_report', 'share_report');--> statement-breakpoint
CREATE TYPE "public"."delivery_method" AS ENUM('email', 'webhook', 'sftp', 'download');--> statement-breakpoint
CREATE TYPE "public"."display_format" AS ENUM('number', 'currency', 'percentage', 'decimal');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('json', 'csv', 'xml', 'pdf', 'zip');--> statement-breakpoint
CREATE TYPE "public"."organizational_scope" AS ENUM('platform', 'company', 'regional', 'location', 'team', 'individual');--> statement-breakpoint
CREATE TYPE "public"."performance_level" AS ENUM('excellent', 'good', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('sales', 'service', 'finance', 'operations', 'hr', 'it', 'compliance', 'executive');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('success', 'failed', 'running', 'timeout', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."report_visualization" AS ENUM('table', 'chart', 'dashboard', 'kpi_widget', 'chart_table_combo');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('absolute', 'percentage', 'ratio');--> statement-breakpoint
CREATE TYPE "public"."time_period" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."color_blind_type" AS ENUM('none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia');--> statement-breakpoint
CREATE TYPE "public"."cursor_size" AS ENUM('normal', 'large');--> statement-breakpoint
CREATE TYPE "public"."font_size" AS ENUM('small', 'normal', 'large', 'extra-large');--> statement-breakpoint
CREATE TYPE "public"."api_key_status" AS ENUM('active', 'inactive', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."api_key_type" AS ENUM('service', 'integration', 'webhook', 'readonly', 'admin');--> statement-breakpoint
CREATE TYPE "public"."blog_content_queue_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."duplicate_resolution" AS ENUM('skip', 'merge', 'create_new', 'pending');--> statement-breakpoint
CREATE TYPE "public"."import_entity_type" AS ENUM('business_records', 'contacts', 'products', 'product_models', 'product_accessories', 'service_products', 'software_products', 'supplies', 'managed_services', 'inventory', 'equipment', 'opportunities', 'service_tickets', 'invoices', 'contracts');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'validating', 'awaiting_review', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."equipment_health_status" AS ENUM('excellent', 'good', 'warning', 'critical', 'offline');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('routine_maintenance', 'preventive_maintenance', 'deep_cleaning', 'firmware_update', 'parts_replacement', 'calibration', 'inspection');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."satisfaction_question_type" AS ENUM('rating_scale', 'yes_no', 'multiple_choice', 'text_short', 'text_long', 'nps_score');--> statement-breakpoint
CREATE TYPE "public"."satisfaction_response_status" AS ENUM('invited', 'started', 'completed', 'expired', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."satisfaction_survey_type" AS ENUM('service_request_completion', 'maintenance_appointment', 'supply_delivery', 'technical_support', 'general_experience', 'annual_review');--> statement-breakpoint
CREATE TYPE "public"."usage_type" AS ENUM('total', 'black_white', 'color', 'large_format', 'scan', 'fax');--> statement-breakpoint
CREATE TYPE "public"."consent_source" AS ENUM('web_form', 'email', 'phone', 'in_person', 'api', 'import', 'contract', 'legitimate_interest');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('given', 'withdrawn', 'expired', 'pending', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('marketing_email', 'marketing_sms', 'marketing_phone', 'data_processing', 'profiling', 'analytics', 'third_party_sharing', 'newsletters', 'product_updates', 'transactional', 'research', 'automated_decisions');--> statement-breakpoint
CREATE TYPE "public"."dpa_status" AS ENUM('draft', 'pending_review', 'pending_signature', 'active', 'expired', 'terminated', 'renewed');--> statement-breakpoint
CREATE TYPE "public"."duplicate_match_type" AS ENUM('exact', 'fuzzy', 'phonetic', 'normalized');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'expired', 'downloaded');--> statement-breakpoint
CREATE TYPE "public"."legal_basis" AS ENUM('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests');--> statement-breakpoint
CREATE TYPE "public"."merge_strategy" AS ENUM('keep_primary', 'keep_secondary', 'combine', 'manual');--> statement-breakpoint
CREATE TYPE "public"."vendor_risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."archive_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'restored');--> statement-breakpoint
CREATE TYPE "public"."change_environment" AS ENUM('development', 'staging', 'production', 'all');--> statement-breakpoint
CREATE TYPE "public"."change_risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."change_status" AS ENUM('draft', 'pending_review', 'pending_approval', 'approved', 'in_progress', 'completed', 'failed', 'rolled_back', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."change_type" AS ENUM('standard', 'normal', 'emergency', 'major');--> statement-breakpoint
CREATE TYPE "public"."incident_category" AS ENUM('security', 'availability', 'performance', 'data_integrity', 'compliance', 'access_control', 'infrastructure', 'application', 'third_party');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('sev1', 'sev2', 'sev3', 'sev4', 'sev5');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('detected', 'acknowledged', 'investigating', 'identified', 'mitigating', 'resolved', 'closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."payment_action" AS ENUM('payment_intent_created', 'payment_intent_succeeded', 'payment_intent_failed', 'payment_intent_cancelled', 'payment_method_attached', 'payment_method_detached', 'payment_method_updated', 'subscription_created', 'subscription_updated', 'subscription_cancelled', 'subscription_renewed', 'invoice_created', 'invoice_paid', 'invoice_failed', 'invoice_voided', 'refund_initiated', 'refund_completed', 'refund_failed', 'dispute_created', 'dispute_won', 'dispute_lost', 'chargeback_received', 'customer_created', 'customer_updated', 'customer_deleted');--> statement-breakpoint
CREATE TYPE "public"."purge_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."retention_policy_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."sso_connection_status" AS ENUM('pending', 'configured', 'active', 'error', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."sso_protocol" AS ENUM('saml2', 'oidc');--> statement-breakpoint
CREATE TYPE "public"."sso_provider_type" AS ENUM('azure_ad', 'okta', 'google_workspace', 'onelogin', 'ping_identity', 'custom_saml', 'custom_oidc');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'review', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('warehouse_low_fpy', 'warehouse_low_accuracy', 'warehouse_tech_support', 'service_low_ftf', 'service_sla_violation', 'service_low_csat', 'service_tech_support', 'sales_low_activity', 'sales_stuck_deals', 'sales_quota_risk');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'slack', 'in_app');--> statement-breakpoint
CREATE TABLE "access_review_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"access_review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reviewed_by" uuid NOT NULL,
	"user_snapshot" jsonb NOT NULL,
	"current_roles" jsonb NOT NULL,
	"current_permissions" jsonb NOT NULL,
	"elevated_access" jsonb,
	"decision" "review_decision" NOT NULL,
	"decision_notes" text,
	"roles_revoked" jsonb,
	"roles_added" jsonb,
	"permissions_changed" jsonb,
	"last_login_date" timestamp,
	"days_since_last_login" integer,
	"unused_permissions" jsonb,
	"certified" boolean DEFAULT false,
	"certified_at" timestamp,
	"certification_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"review_period" varchar(50) NOT NULL,
	"review_year" integer NOT NULL,
	"review_quarter" integer NOT NULL,
	"manager_id" uuid NOT NULL,
	"organizational_unit_id" uuid,
	"user_count" integer NOT NULL,
	"status" "access_review_status" DEFAULT 'not_started' NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"started_at" timestamp,
	"due_date" timestamp NOT NULL,
	"completed_at" timestamp,
	"reviewed_users" integer DEFAULT 0,
	"progress_percent" integer DEFAULT 0,
	"access_approved" integer DEFAULT 0,
	"access_revoked" integer DEFAULT 0,
	"access_modified" integer DEFAULT 0,
	"escalations" integer DEFAULT 0,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_sent" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessory_model_compatibility" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"accessory_id" varchar NOT NULL,
	"model_id" varchar NOT NULL,
	"is_required" boolean DEFAULT false,
	"is_optional" boolean DEFAULT true,
	"installation_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_payable" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"bill_number" varchar NOT NULL,
	"purchase_order_number" varchar,
	"reference_number" varchar,
	"bill_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"description" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"balance_amount" numeric(12, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"category" varchar,
	"department" varchar,
	"payment_method" varchar,
	"payment_date" timestamp,
	"check_number" varchar,
	"approved_by" varchar,
	"approved_date" timestamp,
	"approval_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_receivable" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"invoice_number" varchar NOT NULL,
	"contract_id" varchar,
	"sales_order_number" varchar,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"description" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"balance_amount" numeric(12, 2) NOT NULL,
	"status" varchar DEFAULT 'outstanding' NOT NULL,
	"invoice_type" varchar NOT NULL,
	"category" varchar,
	"payment_terms" varchar DEFAULT 'Net 30',
	"payment_method" varchar,
	"last_payment_date" timestamp,
	"follow_up_date" timestamp,
	"collection_notes" text,
	"days_overdue" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"team_id" varchar,
	"report_date" timestamp NOT NULL,
	"period" "goal_period" NOT NULL,
	"total_calls" integer DEFAULT 0,
	"total_emails" integer DEFAULT 0,
	"total_meetings" integer DEFAULT 0,
	"total_reachouts" integer DEFAULT 0,
	"total_proposals" integer DEFAULT 0,
	"total_new_opportunities" integer DEFAULT 0,
	"total_demos" integer DEFAULT 0,
	"total_follow_ups" integer DEFAULT 0,
	"connected_calls" integer DEFAULT 0,
	"email_replies" integer DEFAULT 0,
	"meetings_scheduled" integer DEFAULT 0,
	"proposals_accepted" integer DEFAULT 0,
	"opportunities_converted" integer DEFAULT 0,
	"call_connect_rate" numeric(5, 2),
	"email_reply_rate" numeric(5, 2),
	"meeting_show_rate" numeric(5, 2),
	"proposal_win_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_content_generation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid,
	"category_id" uuid,
	"generation_type" varchar(100) NOT NULL,
	"prompt" text NOT NULL,
	"ai_model" varchar(100) DEFAULT 'claude-3-5-sonnet-20241022' NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.7',
	"max_tokens" integer DEFAULT 4000,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feature_area" varchar(255),
	"target_audience" varchar(100),
	"status" "ai_generation_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"generated_content" jsonb,
	"generated_metadata" jsonb,
	"ai_confidence_score" numeric(5, 2),
	"quality_score" numeric(5, 2),
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"error_message" text,
	"processing_time_ms" integer,
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"rule_name" varchar(255) NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb NOT NULL,
	"assign_to_user_id" uuid,
	"assign_to_team_id" uuid,
	"assign_to_role" varchar(100),
	"enable_load_balancing" boolean DEFAULT false,
	"max_active_incidents" integer,
	"escalation_enabled" boolean DEFAULT true,
	"escalation_time_minutes" integer DEFAULT 60,
	"escalate_to_user_id" uuid,
	"escalate_to_team_id" uuid,
	"notification_channels" jsonb,
	"is_active" boolean DEFAULT true,
	"times_triggered" integer DEFAULT 0,
	"last_triggered" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_triage_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"alert_id" uuid NOT NULL,
	"alert_title" varchar(500) NOT NULL,
	"alert_description" text,
	"ai_classification" jsonb NOT NULL,
	"context_gathered" jsonb,
	"similar_incidents" jsonb,
	"routing_recommendation" jsonb,
	"suggestions" jsonb,
	"auto_containment_needed" boolean DEFAULT false,
	"auto_containment_actions" jsonb,
	"risk_score" integer NOT NULL,
	"risk_factors" jsonb,
	"potential_impact" text,
	"requires_escalation" boolean DEFAULT false,
	"escalation_reason" text,
	"overall_confidence" integer NOT NULL,
	"ai_model_version" varchar(50),
	"human_review_required" boolean DEFAULT false,
	"human_reviewed" boolean DEFAULT false,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"classification_accurate" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"approval_request_id" varchar NOT NULL,
	"comment_text" text NOT NULL,
	"comment_type" varchar(50) DEFAULT 'general',
	"author_id" varchar NOT NULL,
	"author_name" varchar,
	"author_role" varchar,
	"parent_comment_id" varchar,
	"is_internal" boolean DEFAULT false,
	"visible_to_roles" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_delegations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"delegator_id" varchar NOT NULL,
	"delegate_id" varchar NOT NULL,
	"delegation_type" varchar(50) NOT NULL,
	"approval_rule_ids" text[],
	"max_discount_percentage" numeric(5, 2),
	"max_deal_value" numeric(15, 2),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"reason" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"deal_id" varchar,
	"quote_id" varchar,
	"opportunity_id" varchar,
	"customer_id" varchar,
	"request_type" "approval_type" NOT NULL,
	"request_title" varchar(500) NOT NULL,
	"request_description" text,
	"requested_by" varchar NOT NULL,
	"requested_by_name" varchar,
	"requested_by_role" varchar,
	"original_price" numeric(15, 2),
	"proposed_price" numeric(15, 2),
	"discount_amount" numeric(15, 2),
	"discount_percentage" numeric(5, 2),
	"original_margin" numeric(5, 2),
	"proposed_margin" numeric(5, 2),
	"deal_value" numeric(15, 2),
	"total_contract_value" numeric(15, 2),
	"business_justification" text NOT NULL,
	"competitive_context" text,
	"strategic_rationale" text,
	"risk_assessment" text,
	"custom_terms" jsonb,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"current_approval_level" integer DEFAULT 1,
	"approval_chain" jsonb NOT NULL,
	"sla_deadline" timestamp,
	"sla_breached" boolean DEFAULT false,
	"escalated_at" timestamp,
	"escalated_to" varchar,
	"final_decision" varchar(50),
	"final_decision_by" varchar,
	"final_decision_at" timestamp,
	"final_decision_comments" text,
	"approved_discount_percentage" numeric(5, 2),
	"approved_margin" numeric(5, 2),
	"conditions_attached" jsonb,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"first_reviewed_at" timestamp,
	"completed_at" timestamp,
	"activity_log" jsonb DEFAULT '[]'::jsonb,
	"notifications_sent" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"description" text,
	"rule_type" "approval_type" NOT NULL,
	"threshold_type" "threshold_type" NOT NULL,
	"threshold_value" numeric(15, 2) NOT NULL,
	"comparison_operator" varchar(20) NOT NULL,
	"conditions" jsonb,
	"approval_chain_type" "approval_chain_type" NOT NULL,
	"approvers" jsonb NOT NULL,
	"sla_hours" integer DEFAULT 24,
	"escalation_enabled" boolean DEFAULT true,
	"escalate_to_role_id" varchar,
	"escalate_to_user_id" varchar,
	"notify_on_creation" boolean DEFAULT true,
	"notify_on_approval" boolean DEFAULT true,
	"notify_on_rejection" boolean DEFAULT true,
	"notify_on_escalation" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"allow_skip_for_role" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "article_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"embedding_vector" jsonb NOT NULL,
	"embedding_model" varchar(100) DEFAULT 'text-embedding-ada-002' NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding_scope" varchar(50) DEFAULT 'full_article' NOT NULL,
	"section_id" varchar(100),
	"embedding_confidence" numeric(5, 2) DEFAULT '0.95',
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "article_embedding_unique" UNIQUE("article_id","embedding_scope","section_id")
);
--> statement-breakpoint
CREATE TABLE "article_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255),
	"user_name" varchar(255),
	"feedback_type" varchar(50) NOT NULL,
	"rating" integer,
	"comment" text,
	"issue_type" varchar(100),
	"suggested_correction" text,
	"ai_analyzed" boolean DEFAULT false NOT NULL,
	"ai_sentiment_score" numeric(5, 2),
	"ai_extracted_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_suggested_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"change_description" text,
	"change_type" varchar(50),
	"title" varchar(500) NOT NULL,
	"content" jsonb NOT NULL,
	"plain_text_content" text,
	"ai_generated_changes" boolean DEFAULT false NOT NULL,
	"ai_change_prompt" text,
	"ai_confidence_score" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid,
	"session_id" varchar(255),
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"time_spent_seconds" integer,
	"scroll_depth_percentage" integer,
	"completed_reading" boolean DEFAULT false NOT NULL,
	"referrer" varchar(500),
	"search_query" text,
	"device_type" varchar(50),
	"was_helpful" boolean,
	"rating" integer,
	"shared_article" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_groups" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(255) NOT NULL,
	"resource" varchar(255) NOT NULL,
	"resource_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"session_id" varchar(255),
	"severity" "audit_severity" NOT NULL,
	"category" "audit_category" NOT NULL,
	"request_id" uuid,
	"parent_action_id" uuid,
	"additional_context" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_invoice_generation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_type" varchar NOT NULL,
	"source_id" varchar NOT NULL,
	"invoice_id" varchar,
	"invoice_number" varchar,
	"generation_status" varchar DEFAULT 'pending',
	"generation_attempts" integer DEFAULT 0,
	"error_message" text,
	"triggered_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"issuance_delay_hours" numeric(8, 2),
	"labor_hours" numeric(6, 2),
	"labor_rate" numeric(8, 2),
	"parts_total" numeric(10, 2),
	"total_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auto_supply_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auto_supply_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"supply_monitoring_id" integer NOT NULL,
	"equipment_id" integer NOT NULL,
	"serial_number" text NOT NULL,
	"order_number" text NOT NULL,
	"supply_type" "supply_type" NOT NULL,
	"supply_name" text NOT NULL,
	"part_number" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"supplier_id" integer,
	"supplier_name" text,
	"supplier_order_id" text,
	"unit_price" numeric(10, 2),
	"total_price" numeric(10, 2),
	"shipping_cost" numeric(10, 2),
	"order_date" timestamp DEFAULT now() NOT NULL,
	"estimated_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"installation_date" timestamp,
	"status" "supply_replenishment_status" DEFAULT 'order_placed',
	"priority" "order_priority" DEFAULT 'medium',
	"triggered_by" text DEFAULT 'ai_prediction',
	"prevented_emergency" boolean DEFAULT false,
	"customer_notified" boolean DEFAULT false,
	"customer_notified_at" timestamp,
	"tracking_number" text,
	"tracking_url" text,
	"carrier" text,
	"notes" text,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auto_supply_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "automated_containment_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"alert_id" uuid NOT NULL,
	"triage_result_id" uuid,
	"action_type" "containment_action_type" NOT NULL,
	"action_target" varchar(255) NOT NULL,
	"action_details" jsonb,
	"automated" boolean DEFAULT true,
	"executed_by" uuid,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"success" boolean NOT NULL,
	"result" text,
	"error_message" text,
	"reversed" boolean DEFAULT false,
	"reversed_at" timestamp,
	"reversed_by" uuid,
	"reversal_reason" text,
	"notifications_sent" jsonb,
	"audit_log_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subscription_id" varchar,
	"invoice_number" varchar(50),
	"invoice_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0',
	"discount" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"amount_due" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(50),
	"stripe_invoice_id" varchar,
	"stripe_payment_intent_id" varchar,
	"billing_email" varchar,
	"billing_address" jsonb DEFAULT '{}'::jsonb,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "billing_history_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "billing_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"rule_description" text,
	"rule_type" varchar NOT NULL,
	"rule_status" varchar DEFAULT 'active',
	"priority" integer DEFAULT 0,
	"contract_id" varchar,
	"customer_id" varchar,
	"equipment_id" varchar,
	"product_category" varchar,
	"applicable_to_all_customers" boolean DEFAULT false,
	"applicable_to_all_equipment" boolean DEFAULT false,
	"effective_start_date" timestamp NOT NULL,
	"effective_end_date" timestamp,
	"billing_cycle" varchar DEFAULT 'monthly',
	"tiered_rates" jsonb,
	"base_charge" numeric(10, 2),
	"minimum_charge" numeric(10, 2),
	"maximum_charge" numeric(10, 2),
	"bw_rate" numeric(6, 4),
	"color_rate" numeric(6, 4),
	"base_volume_bw" integer DEFAULT 0,
	"base_volume_color" integer DEFAULT 0,
	"overage_multiplier" numeric(5, 2) DEFAULT '1.0',
	"volume_discounts" jsonb,
	"time_based_pricing" jsonb,
	"allow_negative_balance" boolean DEFAULT false,
	"rounding_method" varchar DEFAULT 'nearest',
	"rounding_precision" integer DEFAULT 2,
	"custom_calculation_formula" text,
	"metadata" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billing_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"schedule_name" varchar NOT NULL,
	"schedule_description" text,
	"schedule_type" varchar NOT NULL,
	"frequency" varchar NOT NULL,
	"contract_id" varchar,
	"customer_id" varchar,
	"day_of_month" integer,
	"day_of_week" integer,
	"billing_cutoff_day" integer,
	"next_run_date" timestamp NOT NULL,
	"last_run_date" timestamp,
	"is_active" boolean DEFAULT true,
	"auto_send_invoice" boolean DEFAULT false,
	"auto_apply_late_fees" boolean DEFAULT false,
	"notify_before_days" integer DEFAULT 3,
	"metadata" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"meta_title" varchar(60),
	"meta_description" varchar(160),
	"focus_keyword" varchar(255),
	"secondary_keywords" jsonb,
	"keyword_tier" "keyword_tier",
	"structured_data" jsonb,
	"featured_image" varchar(500),
	"featured_image_alt" varchar(255),
	"category" "content_category" NOT NULL,
	"tags" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"scheduled_for" timestamp,
	"author_id" uuid,
	"author_name" varchar(255),
	"view_count" integer DEFAULT 0,
	"read_time" integer,
	"word_count" integer,
	"has_citations" boolean DEFAULT false,
	"has_statistics" boolean DEFAULT false,
	"has_quotations" boolean DEFAULT false,
	"has_faq_section" boolean DEFAULT false,
	"has_steps_section" boolean DEFAULT false,
	"has_comparison_table" boolean DEFAULT false,
	"seo_score" integer,
	"readability_score" integer,
	"geo_score" integer,
	"related_posts" jsonb,
	"pillar_page_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bulk_user_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"initiated_by" uuid NOT NULL,
	"file_name" varchar(255),
	"template_id" uuid,
	"total_records" integer NOT NULL,
	"processed_records" integer DEFAULT 0,
	"successful_records" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"status" "lifecycle_status" DEFAULT 'pending' NOT NULL,
	"progress_percent" integer DEFAULT 0,
	"results" jsonb,
	"error_summary" jsonb,
	"error_details" text,
	"rollback_supported" boolean DEFAULT false,
	"rolled_back" boolean DEFAULT false,
	"rollback_at" timestamp,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_record_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"business_record_id" varchar,
	"company_id" varchar,
	"activity_type" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"description" text,
	"direction" varchar,
	"email_from" varchar,
	"email_to" text,
	"email_cc" text,
	"email_subject" varchar,
	"email_body" text,
	"is_shared" boolean DEFAULT false,
	"call_duration" integer,
	"call_outcome" varchar,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"due_date" timestamp,
	"outcome" varchar,
	"next_action" text,
	"follow_up_date" timestamp,
	"related_records" jsonb,
	"attachments" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_customer_id" varchar,
	"external_system_id" varchar,
	"external_salesforce_id" varchar,
	"external_lead_id" varchar,
	"migration_status" varchar,
	"last_sync_date" timestamp,
	"external_data" jsonb,
	"record_type" varchar DEFAULT 'lead' NOT NULL,
	"status" varchar DEFAULT 'new' NOT NULL,
	"company_name" varchar NOT NULL,
	"account_number" varchar,
	"account_type" varchar,
	"website" varchar,
	"industry" varchar,
	"company_size" varchar,
	"employee_count" integer,
	"annual_revenue" numeric(15, 2),
	"customer_rating" varchar,
	"parent_account_id" varchar,
	"customer_priority" varchar,
	"sla_level" varchar,
	"is_active" boolean DEFAULT true,
	"upsell_opportunity" varchar,
	"account_notes" text,
	"primary_contact_name" varchar,
	"primary_contact_email" varchar,
	"primary_contact_phone" varchar,
	"primary_contact_title" varchar,
	"billing_contact_name" varchar,
	"billing_contact_email" varchar,
	"billing_contact_phone" varchar,
	"address_line1" varchar,
	"address_line2" varchar,
	"city" varchar,
	"state" varchar,
	"postal_code" varchar,
	"country" varchar DEFAULT 'US',
	"billing_address_1" varchar,
	"billing_address_2" varchar,
	"billing_city" varchar,
	"billing_state" varchar,
	"billing_zip_code" varchar,
	"phone" varchar,
	"fax" varchar,
	"preferred_contact_method" varchar,
	"source" varchar DEFAULT 'website' NOT NULL,
	"estimated_deal_value" numeric(10, 2),
	"probability" integer DEFAULT 50,
	"close_date" timestamp,
	"sales_stage" varchar,
	"interest_level" varchar,
	"owner_id" varchar,
	"assigned_sales_rep" varchar,
	"territory" varchar,
	"account_manager_id" varchar,
	"lead_score" integer DEFAULT 0,
	"priority" varchar DEFAULT 'medium',
	"customer_number" varchar,
	"company_display_id" varchar,
	"url_slug" varchar,
	"customer_since" timestamp,
	"customer_until" timestamp,
	"deactivation_reason" varchar,
	"reactivation_date" timestamp,
	"churned_date" timestamp,
	"competitor_name" varchar,
	"credit_limit" numeric(10, 2),
	"payment_terms" varchar,
	"billing_terms" varchar,
	"tax_exempt" boolean DEFAULT false,
	"tax_id" varchar,
	"customer_tier" varchar,
	"preferred_technician" varchar,
	"last_service_date" timestamp,
	"next_scheduled_service" timestamp,
	"last_invoice_date" timestamp,
	"last_payment_date" timestamp,
	"current_balance" numeric(10, 2) DEFAULT '0',
	"last_meter_reading_date" timestamp,
	"next_meter_reading_date" timestamp,
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"notes" text,
	"created_by" varchar NOT NULL,
	"converted_by" varchar,
	"deactivated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "business_records_customer_number_unique" UNIQUE("customer_number"),
	CONSTRAINT "business_records_company_display_id_unique" UNIQUE("company_display_id"),
	CONSTRAINT "business_records_url_slug_unique" UNIQUE("url_slug")
);
--> statement-breakpoint
CREATE TABLE "calculator_analytics_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"visitor_id" varchar,
	"event_type" varchar NOT NULL,
	"event_category" varchar NOT NULL,
	"event_data" jsonb,
	"user_agent" text,
	"ip_address" varchar,
	"device_type" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calculator_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"company_name" varchar NOT NULL,
	"full_name" varchar,
	"phone" varchar,
	"role" varchar NOT NULL,
	"wants_quarterly_updates" boolean DEFAULT false,
	"is_dealer_account" boolean DEFAULT false,
	"is_qualified" boolean DEFAULT false,
	"has_booked_demo" boolean DEFAULT false,
	"has_started_trial" boolean DEFAULT false,
	"has_converted_to_paid" boolean DEFAULT false,
	"session_count" integer DEFAULT 1,
	"first_session_id" varchar,
	"lead_score" integer DEFAULT 0,
	"lead_temperature" varchar,
	"utm_source" varchar,
	"utm_medium" varchar,
	"utm_campaign" varchar,
	"email_sequence_started" boolean DEFAULT false,
	"email_sequence_day" integer DEFAULT 0,
	"email_sequence_opt_out" boolean DEFAULT false,
	"notes" text,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now(),
	"last_contacted_at" timestamp,
	"demo_booked_at" timestamp,
	"trial_started_at" timestamp,
	"converted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "calculator_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_key" varchar NOT NULL,
	"lead_id" varchar,
	"visitor_id" varchar,
	"device_count" integer NOT NULL,
	"device_types" jsonb NOT NULL,
	"fleet_age" varchar NOT NULL,
	"monthly_page_volume" integer NOT NULL,
	"color_ratio" numeric(5, 2) NOT NULL,
	"monthly_supplie_cost" numeric(10, 2),
	"monthly_service_cost" numeric(10, 2),
	"monthly_downtime_hours" numeric(6, 2),
	"monthly_energy_cost" numeric(10, 2),
	"employee_count" integer NOT NULL,
	"industry" varchar NOT NULL,
	"pain_points" jsonb NOT NULL,
	"calculated_results" jsonb NOT NULL,
	"is_completed" boolean DEFAULT false,
	"has_email_capture" boolean DEFAULT false,
	"pdf_downloaded" boolean DEFAULT false,
	"completion_time_seconds" integer,
	"source_url" text,
	"utm_source" varchar,
	"utm_medium" varchar,
	"utm_campaign" varchar,
	"referrer" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"email_captured_at" timestamp,
	CONSTRAINT "calculator_sessions_session_key_unique" UNIQUE("session_key")
);
--> statement-breakpoint
CREATE TABLE "case_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"subtitle" varchar(500),
	"client_name" varchar(255),
	"client_industry" varchar(100),
	"client_size" varchar(50),
	"is_anonymized" boolean DEFAULT false,
	"challenge" text NOT NULL,
	"solution" text NOT NULL,
	"results" text NOT NULL,
	"testimonial" text,
	"testimonial_author" varchar(255),
	"testimonial_role" varchar(255),
	"metrics" jsonb,
	"roi_percentage" integer,
	"time_saved" varchar(100),
	"cost_savings" varchar(100),
	"meta_title" varchar(60),
	"meta_description" varchar(160),
	"focus_keyword" varchar(255),
	"structured_data" jsonb,
	"featured_image" varchar(500),
	"featured_image_alt" varchar(255),
	"additional_images" jsonb,
	"category" "content_category",
	"tags" jsonb,
	"featured_solutions" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"view_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"seo_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "case_studies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"account_code" varchar NOT NULL,
	"account_name" varchar NOT NULL,
	"account_type" varchar NOT NULL,
	"account_subtype" varchar,
	"parent_account_id" varchar,
	"level" integer DEFAULT 1,
	"description" text,
	"is_active" boolean DEFAULT true,
	"is_system" boolean DEFAULT false,
	"current_balance" numeric(12, 2) DEFAULT '0',
	"debit_balance" numeric(12, 2) DEFAULT '0',
	"credit_balance" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"activity" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"message" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"devices_in_submission" jsonb DEFAULT '0'::jsonb,
	"metrics_count" jsonb DEFAULT '0'::jsonb,
	"error_code" varchar(50),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_collected_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"serial_number" text NOT NULL,
	"ip_address" text NOT NULL,
	"manufacturer" text,
	"model" text,
	"device_name" text,
	"toner_black" integer,
	"toner_cyan" integer,
	"toner_magenta" integer,
	"toner_yellow" integer,
	"paper_tray1" integer,
	"paper_tray2" integer,
	"paper_tray3" integer,
	"paper_tray4" integer,
	"total_impressions" integer,
	"bw_impressions" integer,
	"color_impressions" integer,
	"large_impressions" integer,
	"fuser_life" integer,
	"drum_life" integer,
	"transfer_belt_life" integer,
	"device_status" text NOT NULL,
	"error_codes" text[],
	"warning_codes" text[],
	"collection_timestamp" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "client_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"location" text,
	"api_key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_heartbeat" timestamp,
	"client_version" text,
	"installed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_registrations_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "client_registrations_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "commission_adjustments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"calculation_id" varchar,
	"employee_id" varchar NOT NULL,
	"adjustment_type" "adjustment_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"reference_type" varchar,
	"reference_id" varchar,
	"reference_name" varchar,
	"is_processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"processed_by" varchar,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_bonuses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calculation_id" varchar NOT NULL,
	"bonus_type" varchar NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"eligibility_met" boolean DEFAULT false NOT NULL,
	"eligibility_criteria" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_calculation_details" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calculation_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"category_name" varchar NOT NULL,
	"sales_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"description" text,
	"billable_hours" numeric(8, 2),
	"hourly_rate" numeric(8, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_calculations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"calculation_period_start" timestamp NOT NULL,
	"calculation_period_end" timestamp NOT NULL,
	"period_name" varchar NOT NULL,
	"total_sales" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"quota_target" numeric(15, 2),
	"quota_achievement" numeric(5, 2),
	"gross_commission" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_bonuses" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_adjustments" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"net_commission" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"status" "calculation_status" DEFAULT 'draft' NOT NULL,
	"calculated_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"paid_at" timestamp,
	"payout_date" timestamp,
	"calculated_by" varchar,
	"approved_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_dispute_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"user" varchar NOT NULL,
	"user_id" varchar,
	"description" text NOT NULL,
	"previous_status" "dispute_status",
	"new_status" "dispute_status",
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"dispute_number" varchar NOT NULL,
	"calculation_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"dispute_type" "dispute_type" NOT NULL,
	"status" "dispute_status" DEFAULT 'submitted' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"disputed_amount" numeric(12, 2) NOT NULL,
	"expected_amount" numeric(12, 2) NOT NULL,
	"difference" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"employee_comments" text,
	"manager_comments" text,
	"assigned_to" varchar,
	"estimated_resolution" timestamp,
	"actual_resolution" timestamp,
	"resolution_type" varchar,
	"adjustment_amount" numeric(12, 2),
	"resolution_notes" text,
	"submitted_date" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"submitted_by" varchar NOT NULL,
	"resolved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commission_disputes_dispute_number_unique" UNIQUE("dispute_number")
);
--> statement-breakpoint
CREATE TABLE "commission_plan_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"tier_level" integer NOT NULL,
	"tier_name" varchar NOT NULL,
	"minimum_sales" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"maximum_sales" numeric(15, 2),
	"commission_rate" numeric(5, 2) NOT NULL,
	"bonus_threshold" numeric(15, 2),
	"bonus_amount" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"plan_name" varchar NOT NULL,
	"plan_type" "plan_type" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"payment_frequency" "payment_frequency" DEFAULT 'monthly' NOT NULL,
	"payment_delay" integer DEFAULT 30 NOT NULL,
	"minimum_commission_payment" numeric(10, 2) DEFAULT '0.00',
	"split_commission_allowed" boolean DEFAULT false NOT NULL,
	"chargeback_enabled" boolean DEFAULT true NOT NULL,
	"chargeback_period" integer DEFAULT 90 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "commission_product_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"category_name" varchar NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_sales_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"calculation_id" varchar,
	"employee_id" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"transaction_id" varchar NOT NULL,
	"transaction_number" varchar,
	"transaction_date" timestamp NOT NULL,
	"customer_id" varchar,
	"customer_name" varchar,
	"sale_amount" numeric(15, 2) NOT NULL,
	"commissionable_amount" numeric(15, 2) NOT NULL,
	"category" varchar NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"is_split_commission" boolean DEFAULT false NOT NULL,
	"split_percentage" numeric(5, 2) DEFAULT '100.00',
	"primary_employee_id" varchar,
	"is_processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"is_charged_back" boolean DEFAULT false NOT NULL,
	"charged_back_at" timestamp,
	"chargeback_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"business_record_type" varchar DEFAULT 'Customer' NOT NULL,
	"customer_number" varchar,
	"business_name" varchar NOT NULL,
	"business_site" varchar,
	"parent_business" varchar,
	"industry" varchar,
	"activity" varchar,
	"description" text,
	"phone" varchar,
	"fax" varchar,
	"website" varchar,
	"next_call_back" timestamp,
	"billing_address" text,
	"billing_city" varchar,
	"billing_state" varchar,
	"billing_zip" varchar,
	"shipping_address" text,
	"shipping_city" varchar,
	"shipping_state" varchar,
	"shipping_zip" varchar,
	"customer_since" timestamp,
	"employees" integer,
	"annual_revenue" numeric(12, 2),
	"number_of_locations" integer,
	"sic_code" varchar,
	"product_services_interest" text,
	"number_of_steps_rights" integer,
	"special_delivery_instructions" text,
	"tax_state" varchar,
	"elevator" varchar,
	"created_by" varchar,
	"business_owner" varchar,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_customer_number_unique" UNIQUE("customer_number")
);
--> statement-breakpoint
CREATE TABLE "company_branding_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"is_default" boolean DEFAULT false,
	"company_name" varchar NOT NULL,
	"tagline" varchar,
	"logo_url" varchar,
	"website_url" varchar,
	"primary_color" varchar DEFAULT '#0066CC',
	"secondary_color" varchar DEFAULT '#F8F9FA',
	"accent_color" varchar DEFAULT '#28A745',
	"text_color" varchar DEFAULT '#212529',
	"heading_font" varchar DEFAULT 'Inter',
	"body_font" varchar DEFAULT 'Inter',
	"address" text,
	"phone" varchar,
	"email" varchar,
	"social_links" jsonb DEFAULT '{}',
	"custom_css" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"salutation" varchar,
	"first_name" varchar,
	"last_name" varchar NOT NULL,
	"title" varchar,
	"department" varchar,
	"phone" varchar,
	"mobile" varchar,
	"email" varchar,
	"reports_to" varchar,
	"contact_roles" text,
	"is_primary_contact" boolean DEFAULT false,
	"lead_status" varchar DEFAULT 'new',
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"owner_id" varchar,
	"favorite_content_type" varchar,
	"preferred_channels" text,
	"assistant" varchar,
	"assistant_phone" varchar,
	"other_phone" varchar,
	"home_phone" varchar,
	"fax" varchar,
	"birthdate" timestamp,
	"mailing_address" text,
	"mailing_city" varchar,
	"mailing_state" varchar,
	"mailing_zip" varchar,
	"other_address" text,
	"other_city" varchar,
	"other_state" varchar,
	"other_zip" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_pricing_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"default_markup_type" "markup_type" DEFAULT 'percentage',
	"default_markup_percentage" numeric(5, 2) DEFAULT '13.00',
	"default_markup_amount" numeric(10, 2),
	"category_markup_overrides" jsonb,
	"allow_rep_price_edit" boolean DEFAULT true,
	"require_approval_for_price_edit" boolean DEFAULT false,
	"require_approval_above_threshold" boolean DEFAULT true,
	"max_discount_percentage" numeric(5, 2) DEFAULT '20.00',
	"min_margin_percentage" numeric(5, 2) DEFAULT '5.00',
	"auto_approval_threshold" numeric(5, 2) DEFAULT '10.00',
	"show_dealer_cost_to_reps" boolean DEFAULT false,
	"show_margin_to_reps" boolean DEFAULT true,
	"notify_on_price_change" boolean DEFAULT true,
	"notify_managers_on_approval" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "company_pricing_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"document_type" varchar NOT NULL,
	"document_url" varchar,
	"metadata" jsonb,
	"verification_status" varchar DEFAULT 'pending',
	"verified_by" uuid,
	"verification_date" timestamp,
	"expiration_date" timestamp,
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"gdpr_enabled" boolean DEFAULT true,
	"gdpr_contact_email" varchar(255),
	"gdpr_response_days" integer DEFAULT 30,
	"automatic_data_retention" boolean DEFAULT false,
	"data_retention_period_days" integer DEFAULT 2555,
	"audit_retention_period_days" integer DEFAULT 2555,
	"audit_high_risk_only" boolean DEFAULT false,
	"audit_failed_logins_only" boolean DEFAULT false,
	"session_timeout_minutes" integer DEFAULT 30,
	"session_warning_minutes" integer DEFAULT 25,
	"max_concurrent_sessions" integer DEFAULT 3,
	"force_logout_suspicious" boolean DEFAULT true,
	"encrypt_sensitive_fields" boolean DEFAULT true,
	"mask_data_in_logs" boolean DEFAULT true,
	"require_data_classification" boolean DEFAULT true,
	"notify_on_gdpr_request" boolean DEFAULT true,
	"notify_on_suspicious_activity" boolean DEFAULT true,
	"notify_on_data_breach" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" "content_type" NOT NULL,
	"content_id" uuid NOT NULL,
	"source" varchar(100),
	"medium" varchar(100),
	"campaign" varchar(255),
	"session_duration" integer,
	"scroll_depth" integer,
	"cta_clicked" boolean DEFAULT false,
	"downloaded" boolean DEFAULT false,
	"device" varchar(50),
	"browser" varchar(50),
	"country" varchar(2),
	"region" varchar(100),
	"is_ai_referral" boolean DEFAULT false,
	"ai_platform" varchar(50),
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" "content_type" NOT NULL,
	"content_id" uuid NOT NULL,
	"source_title" varchar(500) NOT NULL,
	"source_url" varchar(1000),
	"source_author" varchar(255),
	"source_organization" varchar(255),
	"publication_date" timestamp,
	"cited_text" text,
	"context_in_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" "content_type" NOT NULL,
	"content_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"order" integer DEFAULT 0,
	"is_main_entity" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_renewal_tracking" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contract_renewal_tracking_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"contract_id" integer NOT NULL,
	"contract_number" text NOT NULL,
	"contract_type" "contract_type" NOT NULL,
	"customer_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"days_until_expiration" integer NOT NULL,
	"renewal_window_start" timestamp,
	"monthly_recurring_revenue" numeric(10, 2),
	"annual_contract_value" numeric(10, 2),
	"total_contract_value" numeric(10, 2),
	"status" "contract_status" DEFAULT 'active',
	"renewal_risk" "renewal_risk" DEFAULT 'low',
	"renewal_probability" integer,
	"churn_risk_score" integer,
	"ai_analysis" jsonb,
	"risk_factors" jsonb,
	"opportunity_factors" jsonb,
	"recommended_action" "renewal_action" DEFAULT 'monitor',
	"confidence_score" integer,
	"last_interaction_date" timestamp,
	"interaction_frequency" numeric(10, 2),
	"nps_score" integer,
	"satisfaction_score" integer,
	"support_tickets_last_90_days" integer DEFAULT 0,
	"escalations_last_90_days" integer DEFAULT 0,
	"equipment_count" integer DEFAULT 0,
	"average_uptime" numeric(5, 2),
	"service_calls_last_90_days" integer DEFAULT 0,
	"average_response_time" numeric(10, 2),
	"first_time_fix_rate" numeric(5, 2),
	"proposal_generated" boolean DEFAULT false,
	"proposal_generated_at" timestamp,
	"proposal_sent_at" timestamp,
	"proposal_viewed_at" timestamp,
	"proposal_accepted_at" timestamp,
	"proposed_mrr" numeric(10, 2),
	"proposed_acv" numeric(10, 2),
	"proposed_term_months" integer,
	"proposed_discount" numeric(5, 2),
	"upsell_opportunities" jsonb,
	"auto_renewal_enabled" boolean DEFAULT false,
	"auto_renewal_approved" boolean DEFAULT false,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_sent_at" timestamp,
	"assigned_sales_rep_id" integer,
	"assigned_sales_rep_name" text,
	"sales_rep_notified" boolean DEFAULT false,
	"sales_rep_notified_at" timestamp,
	"notes" text,
	"action_items" jsonb,
	"renewal_outcome" text,
	"renewal_date" timestamp,
	"churn_date" timestamp,
	"churn_reason" text,
	"competitor_name" text,
	"last_analyzed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_renewals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"renewal_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"renewal_type" varchar(50) NOT NULL,
	"contract_start_date" timestamp NOT NULL,
	"contract_end_date" timestamp NOT NULL,
	"renewal_notice_date" timestamp,
	"renewal_target_date" timestamp,
	"current_mrr" numeric(12, 2),
	"current_arr" numeric(12, 2),
	"current_contract_value" numeric(12, 2) NOT NULL,
	"current_term" integer,
	"proposed_mrr" numeric(12, 2),
	"proposed_arr" numeric(12, 2),
	"proposed_contract_value" numeric(12, 2),
	"proposed_term" integer,
	"proposed_start_date" timestamp,
	"value_change" numeric(12, 2),
	"value_change_percentage" numeric(5, 2),
	"term_change" integer,
	"renewal_risk_score" integer DEFAULT 50,
	"renewal_risk_level" varchar(50),
	"churn_probability" numeric(5, 4),
	"risk_factors" jsonb,
	"strengths" jsonb,
	"account_owner_id" varchar,
	"renewal_owner_id" varchar,
	"executive_sponsor" varchar,
	"last_contact_date" timestamp,
	"next_contact_date" timestamp,
	"qbr_scheduled" boolean DEFAULT false,
	"qbr_date" timestamp,
	"executive_review_scheduled" boolean DEFAULT false,
	"renewal_strategy" text,
	"competitive_threats" text[],
	"upsell_opportunities" text[],
	"current_discount" numeric(5, 2),
	"proposed_discount" numeric(5, 2),
	"discount_approval_required" boolean DEFAULT false,
	"discount_approved_by" varchar,
	"renewal_proposal_id" varchar,
	"renewal_proposal_sent_at" timestamp,
	"renewal_contract_id" varchar,
	"renewal_contract_signed_at" timestamp,
	"renewal_closed_date" timestamp,
	"renewal_won_reason" text,
	"renewal_lost_reason" text,
	"churned_to_competitor" varchar,
	"alerts_enabled" boolean DEFAULT true,
	"day_180_alert_sent" boolean DEFAULT false,
	"day_90_alert_sent" boolean DEFAULT false,
	"day_60_alert_sent" boolean DEFAULT false,
	"day_30_alert_sent" boolean DEFAULT false,
	"day_7_alert_sent" boolean DEFAULT false,
	"internal_notes" text,
	"customer_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_tiered_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"tier_name" varchar NOT NULL,
	"color_type" varchar NOT NULL,
	"minimum_volume" integer DEFAULT 0 NOT NULL,
	"maximum_volume" integer,
	"rate" numeric(10, 4) NOT NULL,
	"minimum_charge" numeric(10, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"contract_number" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"black_rate" numeric(10, 4),
	"color_rate" numeric(10, 4),
	"monthly_base" numeric(10, 2),
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversion_funnel" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"team_id" varchar,
	"tracking_period" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_activities" integer DEFAULT 0,
	"connections_established" integer DEFAULT 0,
	"meetings_scheduled" integer DEFAULT 0,
	"meetings_held" integer DEFAULT 0,
	"proposals_sent" integer DEFAULT 0,
	"deals_won" integer DEFAULT 0,
	"activity_to_connection_rate" numeric(5, 2) DEFAULT '0',
	"connection_to_meeting_rate" numeric(5, 2) DEFAULT '0',
	"meeting_to_proposal_rate" numeric(5, 2) DEFAULT '0',
	"proposal_to_win_rate" numeric(5, 2) DEFAULT '0',
	"overall_conversion_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversion_funnel_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signup_id" varchar NOT NULL,
	"stage" varchar(50) NOT NULL,
	"stage_entered_at" timestamp DEFAULT now(),
	"stage_exited_at" timestamp,
	"duration_minutes" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cpc_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"model_id" varchar NOT NULL,
	"service_name" varchar NOT NULL,
	"pricing_level" varchar NOT NULL,
	"color_mode" varchar NOT NULL,
	"type" varchar NOT NULL,
	"min_volume" integer DEFAULT 0,
	"max_volume" integer,
	"base_rate" numeric(10, 5),
	"cpc" numeric(10, 5),
	"cpc_overage" numeric(10, 5),
	"includes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"title" varchar,
	"department" varchar,
	"phone" varchar,
	"email" varchar,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_meter_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"equipment_serial_number" varchar(100) NOT NULL,
	"total_impressions" integer,
	"black_white_impressions" integer,
	"color_impressions" integer,
	"large_format_impressions" integer,
	"scan_impressions" integer,
	"fax_impressions" integer,
	"submission_method" "meter_submission_method" NOT NULL,
	"reading_date" timestamp NOT NULL,
	"submission_date" timestamp DEFAULT now() NOT NULL,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_by" uuid,
	"validated_at" timestamp,
	"validation_notes" text,
	"is_billed" boolean DEFAULT false NOT NULL,
	"billing_date" timestamp,
	"invoice_id" uuid,
	"customer_notes" text,
	"internal_notes" text
);
--> statement-breakpoint
CREATE TABLE "customer_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp,
	"is_sms_capable" boolean DEFAULT false NOT NULL,
	"is_sms_sent" boolean DEFAULT false NOT NULL,
	"sms_sent_at" timestamp,
	"is_portal_read" boolean DEFAULT false NOT NULL,
	"portal_read_at" timestamp,
	"related_service_request_id" uuid,
	"related_invoice_id" uuid,
	"related_payment_id" uuid,
	"related_supply_order_id" uuid,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"scheduled_send_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_number_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"prefix" varchar(10) DEFAULT 'CUST' NOT NULL,
	"current_sequence" integer DEFAULT 1000 NOT NULL,
	"sequence_length" integer DEFAULT 4 NOT NULL,
	"separator_char" varchar(1) DEFAULT '-',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_number_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"customer_number" varchar NOT NULL,
	"config_id" varchar NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"generated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "customer_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid,
	"payment_number" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"invoice_id" uuid,
	"invoice_number" varchar(100),
	"transaction_id" varchar(255),
	"processor_name" varchar(100),
	"processor_response" jsonb,
	"payment_method_details" jsonb,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"customer_notes" text,
	"internal_notes" text,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	CONSTRAINT "customer_payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "customer_portal_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"status" "customer_portal_status" DEFAULT 'pending_activation' NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(255),
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"last_login_at" timestamp,
	"session_token" varchar(255),
	"session_expires" timestamp,
	"permissions" jsonb DEFAULT '{"canViewInvoices":true,"canSubmitServiceRequests":true,"canOrderSupplies":true,"canSubmitMeterReadings":true,"canViewServiceHistory":true,"canMakePayments":true}'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{"emailNotifications":true,"smsNotifications":false,"language":"en","timezone":"America/New_York"}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "customer_portal_access_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "customer_portal_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"description" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"related_record_type" varchar(50),
	"related_record_id" uuid,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_related_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"record_type" varchar NOT NULL,
	"record_id" varchar NOT NULL,
	"record_title" varchar,
	"record_count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid NOT NULL,
	"request_number" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"type" "service_request_type" NOT NULL,
	"priority" "service_request_priority" DEFAULT 'normal' NOT NULL,
	"status" "service_request_status" DEFAULT 'submitted' NOT NULL,
	"equipment_id" uuid,
	"equipment_serial_number" varchar(100),
	"equipment_model" varchar(100),
	"equipment_location" varchar(255),
	"contact_name" varchar(100) NOT NULL,
	"contact_phone" varchar(20),
	"contact_email" varchar(255),
	"preferred_date" timestamp,
	"preferred_time" varchar(50),
	"urgency_notes" text,
	"assigned_technician_id" uuid,
	"service_ticket_id" uuid,
	"estimated_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"customer_notes" text,
	"internal_notes" text,
	"resolution_notes" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"customer_rating" integer,
	"customer_feedback" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_service_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "customer_supply_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_sku" varchar(100) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"product_description" text,
	"compatible_equipment_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"estimated_ship_date" timestamp,
	"customer_notes" text
);
--> statement-breakpoint
CREATE TABLE "customer_supply_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"status" "supply_order_status" DEFAULT 'draft' NOT NULL,
	"delivery_address" jsonb NOT NULL,
	"delivery_instructions" text,
	"requested_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"shipping" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_contract_covered" boolean DEFAULT false NOT NULL,
	"contract_id" uuid,
	"purchase_order_number" varchar(100),
	"tracking_number" varchar(100),
	"carrier" varchar(50),
	"shipped_at" timestamp,
	"customer_notes" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_supply_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "daily_usage_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"active_users" integer DEFAULT 0,
	"api_calls" integer DEFAULT 0,
	"storage_used_mb" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_usage_tenant_date_idx" UNIQUE("tenant_id","date")
);
--> statement-breakpoint
CREATE TABLE "dashboard_layouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "report_category",
	"layout" jsonb NOT NULL,
	"widgets" jsonb NOT NULL,
	"is_public" boolean DEFAULT false,
	"allowed_roles" jsonb DEFAULT '[]',
	"allowed_users" jsonb DEFAULT '[]',
	"is_default" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"layout_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"layout_snapshot" jsonb NOT NULL,
	"is_automatic" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_widget_library" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"widget_id" varchar NOT NULL,
	"custom_name" varchar(255),
	"is_enabled" boolean DEFAULT true,
	"custom_config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_widgets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"icon" varchar(50),
	"default_width" integer DEFAULT 1,
	"default_height" integer DEFAULT 300,
	"required_permission" varchar(100),
	"applicable_roles" jsonb DEFAULT '[]'::jsonb,
	"applicable_modules" jsonb DEFAULT '[]'::jsonb,
	"default_config" jsonb DEFAULT '{}'::jsonb,
	"configurable_fields" jsonb DEFAULT '[]'::jsonb,
	"is_draggable" boolean DEFAULT true,
	"is_resizable" boolean DEFAULT true,
	"supports_refresh" boolean DEFAULT true,
	"supports_drill_down" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"is_premium" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dashboard_widgets_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "data_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"resource" varchar(255) NOT NULL,
	"resource_id" uuid,
	"access_type" "access_type" NOT NULL,
	"query" text,
	"result_count" integer,
	"response_time_ms" integer,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"session_id" varchar(255),
	"data_classification" "data_classification" NOT NULL,
	"contains_pii" boolean DEFAULT false,
	"suspicious_activity" boolean DEFAULT false,
	"risk_score" integer DEFAULT 0,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_import_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_session_id" uuid,
	"tenant_id" uuid,
	"data_type" varchar(100) NOT NULL,
	"file_name" varchar(255),
	"file_size_bytes" integer,
	"detected_columns" jsonb,
	"column_mappings" jsonb,
	"total_rows" integer NOT NULL,
	"valid_rows" integer DEFAULT 0,
	"invalid_rows" integer DEFAULT 0,
	"warning_rows" integer DEFAULT 0,
	"errors" jsonb,
	"warnings" jsonb,
	"duplicates_found" integer DEFAULT 0,
	"duplicate_details" jsonb,
	"bulk_fix_suggestions" jsonb,
	"import_executed" boolean DEFAULT false,
	"imported_rows" integer,
	"failed_rows" integer,
	"imported_at" timestamp,
	"rollback_supported" boolean DEFAULT true,
	"rolled_back" boolean DEFAULT false,
	"rollback_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"subject" varchar(200),
	"description" text,
	"user_id" varchar NOT NULL,
	"duration" integer,
	"outcome" varchar,
	"previous_value" text,
	"new_value" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_stage_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"from_stage_id" varchar,
	"to_stage_id" varchar NOT NULL,
	"from_stage_name" varchar,
	"to_stage_name" varchar NOT NULL,
	"changed_by" varchar NOT NULL,
	"change_reason" text,
	"was_automatic" boolean DEFAULT false,
	"days_in_previous_stage" integer,
	"entered_at" timestamp DEFAULT now() NOT NULL,
	"deal_value" numeric(15, 2),
	"probability" integer,
	"expected_close_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#3B82F6',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_closing_stage" boolean DEFAULT false,
	"is_won_stage" boolean DEFAULT false,
	"requires_approval" boolean DEFAULT false,
	"auto_move_conditions" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"amount" numeric(12, 2),
	"owner_id" varchar NOT NULL,
	"customer_id" varchar,
	"company_name" varchar,
	"stage_id" varchar NOT NULL,
	"probability" integer DEFAULT 0,
	"expected_close_date" timestamp,
	"actual_close_date" timestamp,
	"source" varchar,
	"deal_type" varchar,
	"priority" varchar DEFAULT 'medium',
	"primary_contact_name" varchar,
	"primary_contact_email" varchar,
	"primary_contact_phone" varchar,
	"products_interested" text,
	"estimated_monthly_value" numeric(10, 2),
	"status" varchar DEFAULT 'open' NOT NULL,
	"lost_reason" varchar,
	"last_activity_date" timestamp,
	"next_follow_up_date" timestamp,
	"created_by_id" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "delivery_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"time_window" varchar,
	"delivery_type" varchar DEFAULT 'standard' NOT NULL,
	"special_instructions" text,
	"delivery_address" jsonb NOT NULL,
	"contact_person" varchar,
	"contact_phone" varchar,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"driver_id" uuid,
	"vehicle_id" varchar,
	"actual_delivery_time" timestamp,
	"delivery_notes" text,
	"signature_url" varchar,
	"photo_urls" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_equipment_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demo_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"equipment_type" varchar NOT NULL,
	"manufacturer" varchar,
	"model" varchar NOT NULL,
	"serial_number" varchar,
	"required_features" jsonb DEFAULT '[]'::jsonb,
	"special_configuration" text,
	"accessories_needed" jsonb DEFAULT '[]'::jsonb,
	"transport_required" boolean DEFAULT false,
	"setup_time" integer DEFAULT 30,
	"teardown_time" integer DEFAULT 15,
	"is_available" boolean DEFAULT true,
	"current_location" varchar,
	"available_from" timestamp,
	"available_until" timestamp,
	"status" varchar DEFAULT 'required',
	"reserved_by" varchar,
	"reserved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_outcomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demo_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"overall_outcome" varchar NOT NULL,
	"customer_interest_level" varchar,
	"decision_timeframe" varchar,
	"budget_confirmed" boolean DEFAULT false,
	"decision_maker_present" boolean DEFAULT false,
	"features_of_interest" jsonb DEFAULT '[]'::jsonb,
	"concerns" jsonb DEFAULT '[]'::jsonb,
	"competitive_situation" text,
	"price_expectations" text,
	"product_fit_rating" integer,
	"price_value_rating" integer,
	"service_rating" integer,
	"overall_satisfaction" integer,
	"immediate_next_steps" text,
	"proposal_requested" boolean DEFAULT false,
	"proposal_deadline" timestamp,
	"additional_info_needed" text,
	"next_meeting_scheduled" boolean DEFAULT false,
	"next_meeting_date" timestamp,
	"next_meeting_type" varchar,
	"stakeholders_to_involve" jsonb DEFAULT '[]'::jsonb,
	"probability_assessment" integer,
	"expected_close_date" timestamp,
	"estimated_value" numeric(10, 2),
	"confidence" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"business_record_id" varchar NOT NULL,
	"customer_name" varchar NOT NULL,
	"contact_person" varchar NOT NULL,
	"contact_email" varchar,
	"contact_phone" varchar,
	"demo_type" varchar NOT NULL,
	"demo_title" varchar,
	"demo_description" text,
	"demo_objectives" text,
	"scheduled_date" timestamp NOT NULL,
	"scheduled_time" varchar NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"time_zone" varchar DEFAULT 'America/New_York',
	"demo_location" varchar NOT NULL,
	"customer_address" text,
	"showroom_location" varchar,
	"virtual_meeting_link" varchar,
	"virtual_meeting_id" varchar,
	"virtual_platform" varchar,
	"equipment_models" jsonb DEFAULT '[]'::jsonb,
	"product_categories" jsonb DEFAULT '[]'::jsonb,
	"software_features" jsonb DEFAULT '[]'::jsonb,
	"assigned_sales_rep" varchar NOT NULL,
	"assigned_technician" varchar,
	"backup_sales_rep" varchar,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"confirmation_status" varchar DEFAULT 'pending',
	"confirmation_date" timestamp,
	"confirmation_method" varchar,
	"preparation_completed" boolean DEFAULT false,
	"preparation_notes" text,
	"special_requirements" text,
	"equipment_to_transport" jsonb DEFAULT '[]'::jsonb,
	"materials_needed" jsonb DEFAULT '[]'::jsonb,
	"proposal_amount" numeric(10, 2),
	"proposal_id" varchar,
	"expected_close_date" timestamp,
	"probability" integer DEFAULT 50,
	"demo_completed" boolean DEFAULT false,
	"customer_feedback" text,
	"customer_satisfaction" integer,
	"follow_up_required" boolean DEFAULT true,
	"follow_up_date" timestamp,
	"follow_up_method" varchar,
	"next_steps" text,
	"resulting_proposal_id" varchar,
	"resulting_sale_id" varchar,
	"conversion_value" numeric(10, 2),
	"conversion_date" timestamp,
	"lost_reason" varchar,
	"competitor_information" text,
	"original_scheduled_date" timestamp,
	"reschedule_count" integer DEFAULT 0,
	"reschedule_reason" varchar,
	"reschedule_history" jsonb DEFAULT '[]'::jsonb,
	"external_event_id" varchar,
	"calendar_provider" varchar,
	"calendar_event_link" varchar,
	"attendees_notified" boolean DEFAULT false,
	"calendar_sync_status" varchar DEFAULT 'pending',
	"last_calendar_sync" timestamp,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_date" timestamp,
	"communication_history" jsonb DEFAULT '[]'::jsonb,
	"internal_notes" text,
	"sales_notes" text,
	"technician_notes" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_meter_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"serial_number" text NOT NULL,
	"total_impressions" integer,
	"bw_impressions" integer,
	"color_impressions" integer,
	"total_diff" integer,
	"bw_diff" integer,
	"color_diff" integer,
	"billing_period_start" timestamp,
	"billing_period_end" timestamp,
	"reading_timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"collection_timestamp" timestamp NOT NULL,
	"total_impressions" integer,
	"bw_impressions" integer,
	"color_impressions" integer,
	"large_impressions" integer,
	"device_status" "device_status" DEFAULT 'unknown',
	"toner_levels" jsonb DEFAULT '{}'::jsonb,
	"paper_levels" jsonb DEFAULT '{}'::jsonb,
	"error_codes" text[],
	"response_time" integer,
	"uptime" numeric(5, 2),
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"device_name" varchar(255),
	"model" varchar(255),
	"serial_number" varchar(255),
	"ip_address" varchar(45),
	"mac_address" varchar(17),
	"location" varchar(255),
	"department" varchar(255),
	"status" "device_status" DEFAULT 'unknown' NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"last_seen" timestamp,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"aggregation_level" varchar(50) NOT NULL,
	"aggregation_id" varchar,
	"total_requests" integer DEFAULT 0,
	"approved_requests" integer DEFAULT 0,
	"rejected_requests" integer DEFAULT 0,
	"pending_requests" integer DEFAULT 0,
	"approval_rate" numeric(5, 2),
	"average_discount_requested" numeric(5, 2),
	"average_discount_approved" numeric(5, 2),
	"total_value_at_risk" numeric(15, 2),
	"total_value_approved" numeric(15, 2),
	"total_revenue_impact" numeric(15, 2),
	"total_margin_impact" numeric(15, 2),
	"average_approval_time_hours" numeric(8, 2),
	"sla_breach_count" integer DEFAULT 0,
	"sla_breach_rate" numeric(5, 2),
	"deals_with_discount" integer DEFAULT 0,
	"deals_without_discount" integer DEFAULT 0,
	"win_rate_with_discount" numeric(5, 2),
	"win_rate_without_discount" numeric(5, 2),
	"top_approvers" jsonb,
	"calculated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discount_redemptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subscription_id" varchar,
	"redeemed_by" varchar,
	"amount_discounted" numeric(10, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" varchar(20) NOT NULL,
	"percent_off" integer,
	"amount_off" numeric(10, 2),
	"trial_extension_days" integer,
	"applies_to_plans" jsonb DEFAULT '[]'::jsonb,
	"billing_cycles" jsonb DEFAULT '["monthly","annual"]'::jsonb,
	"duration" varchar(20) NOT NULL,
	"duration_months" integer,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0,
	"first_time_only" boolean DEFAULT false,
	"min_amount" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "discounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "document_field_mappings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_field_mappings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_type" text NOT NULL,
	"source_fields" jsonb NOT NULL,
	"target_entity_type" text NOT NULL,
	"target_fields" jsonb NOT NULL,
	"transformation_rules" jsonb,
	"validation_rules" jsonb,
	"use_ai_field_extraction" boolean DEFAULT true NOT NULL,
	"ai_prompt" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"document_type" text NOT NULL,
	"recipient_user_id" integer,
	"recipient_email" text,
	"recipient_role" text,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"sent_via" text NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"viewed_at" timestamp,
	"downloaded_at" timestamp,
	"workflow_id" integer,
	"task_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "document_template_type" NOT NULL,
	"category" text,
	"content" text NOT NULL,
	"format" "document_format" DEFAULT 'pdf' NOT NULL,
	"field_mapping" jsonb NOT NULL,
	"styles" jsonb,
	"page_settings" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_template_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_uploads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_uploads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" text NOT NULL,
	"ocr_status" "ocr_processing_status" DEFAULT 'pending' NOT NULL,
	"ocr_text" text,
	"ocr_confidence" integer,
	"ocr_processed_at" timestamp,
	"ocr_error" text,
	"ai_extracted_fields" jsonb,
	"ai_field_mapping" jsonb,
	"ai_processed_at" timestamp,
	"ai_error" text,
	"target_entity_type" text,
	"target_entity_id" integer,
	"workflow_id" integer,
	"task_id" integer,
	"requires_review" boolean DEFAULT true NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"is_processed" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_workflow_actions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_workflow_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"workflow_id" integer NOT NULL,
	"step_id" text NOT NULL,
	"action_type" text NOT NULL,
	"template_id" integer,
	"generate_format" "document_format",
	"send_to" jsonb,
	"send_method" text,
	"email_subject" text,
	"email_body" text,
	"field_mapping_id" integer,
	"require_review" boolean DEFAULT true NOT NULL,
	"conditions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"document_number" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"agreement_number" varchar,
	"buyer_name" varchar,
	"buyer_address" text,
	"ship_to_name" varchar,
	"ship_to_address" text,
	"po_number" varchar,
	"order_date" timestamp,
	"line_items" jsonb,
	"include_service_contract" boolean DEFAULT false,
	"service_term" integer,
	"service_start_date" timestamp,
	"auto_renewal" boolean DEFAULT false,
	"minimum_black_prints" integer,
	"minimum_color_prints" integer,
	"black_rate" numeric(10, 4),
	"color_rate" numeric(10, 4),
	"monthly_base" numeric(10, 2),
	"include_consumables" boolean DEFAULT false,
	"include_black_supplies" boolean DEFAULT false,
	"include_color_supplies" boolean DEFAULT false,
	"payment_terms" varchar,
	"warranty_terms" text,
	"special_terms" text,
	"authorized_signer_title" varchar,
	"customer_name" varchar,
	"status" varchar DEFAULT 'draft',
	"created_by" varchar NOT NULL,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_auto_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"issue_category" text NOT NULL,
	"subject" text NOT NULL,
	"body_template" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"campaign_name" varchar NOT NULL,
	"campaign_description" text,
	"campaign_type" varchar NOT NULL,
	"template_id" varchar,
	"subject" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"sender_email" varchar NOT NULL,
	"reply_to_email" varchar,
	"list_ids" text[],
	"segment_criteria" jsonb,
	"exclude_list_ids" text[],
	"sequence_steps" jsonb,
	"current_step" integer DEFAULT 1,
	"schedule_type" varchar NOT NULL,
	"scheduled_date" timestamp,
	"timezone" varchar DEFAULT 'UTC',
	"recurring_pattern" jsonb,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"total_recipients" integer DEFAULT 0,
	"emails_sent" integer DEFAULT 0,
	"emails_delivered" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"emails_bounced" integer DEFAULT 0,
	"emails_unsubscribed" integer DEFAULT 0,
	"emails_spam_reported" integer DEFAULT 0,
	"delivery_rate" numeric(5, 2),
	"open_rate" numeric(5, 2),
	"click_rate" numeric(5, 2),
	"bounce_rate" numeric(5, 2),
	"unsubscribe_rate" numeric(5, 2),
	"is_ab_test" boolean DEFAULT false,
	"ab_test_variants" jsonb,
	"winning_variant" varchar,
	"sendgrid_campaign_id" varchar,
	"owner_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_campaigns_name_unique" UNIQUE("tenant_id","campaign_name")
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"email_send_id" varchar NOT NULL,
	"campaign_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"event_timestamp" timestamp NOT NULL,
	"clicked_url" text,
	"link_label" varchar,
	"user_agent" text,
	"ip_address" varchar,
	"device_type" varchar,
	"email_client" varchar,
	"operating_system" varchar,
	"country" varchar,
	"city" varchar,
	"sendgrid_event_id" varchar,
	"provider_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_list_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"list_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"contact_id" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"company" varchar,
	"custom_fields" jsonb,
	"tags" text[],
	"status" varchar DEFAULT 'active' NOT NULL,
	"subscription_source" varchar,
	"engagement_score" integer DEFAULT 0,
	"last_email_opened" timestamp,
	"last_email_clicked" timestamp,
	"subscribed_at" timestamp DEFAULT now(),
	"unsubscribed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_list_members_unique" UNIQUE("list_id","email")
);
--> statement-breakpoint
CREATE TABLE "email_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"list_name" varchar NOT NULL,
	"list_description" text,
	"list_type" varchar NOT NULL,
	"segment_criteria" jsonb,
	"tags" text[],
	"category" varchar,
	"is_active" boolean DEFAULT true,
	"total_members" integer DEFAULT 0,
	"active_members" integer DEFAULT 0,
	"unsubscribed_members" integer DEFAULT 0,
	"owner_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_lists_name_unique" UNIQUE("tenant_id","list_name")
);
--> statement-breakpoint
CREATE TABLE "email_monitor_config" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email_address" text NOT NULL,
	"protocol" text NOT NULL,
	"host" text,
	"port" integer,
	"username" text,
	"encrypted_password" text,
	"tls" boolean DEFAULT true,
	"oauth_client_id" text,
	"oauth_encrypted_refresh_token" text,
	"oauth_token_expiry" timestamp,
	"enabled" boolean DEFAULT true,
	"poll_interval" integer DEFAULT 60,
	"auto_assign_technician" boolean DEFAULT true,
	"send_confirmation_email" boolean DEFAULT true,
	"last_check_at" timestamp,
	"last_success_at" timestamp,
	"last_error_at" timestamp,
	"last_error" text,
	"total_emails_processed" integer DEFAULT 0,
	"total_tickets_created" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_monitor_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"campaign_id" varchar NOT NULL,
	"template_id" varchar,
	"recipient_email" varchar NOT NULL,
	"recipient_name" varchar,
	"contact_id" varchar,
	"subject" varchar NOT NULL,
	"html_content" text,
	"text_content" text,
	"merge_data" jsonb,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"sendgrid_message_id" varchar,
	"provider_status" varchar,
	"provider_response" jsonb,
	"error_message" text,
	"error_code" varchar,
	"bounce_type" varchar,
	"bounce_reason" text,
	"queued_at" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"bounced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_sequence_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"sequence_day" integer NOT NULL,
	"email_subject" text NOT NULL,
	"email_template" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"click_count" integer DEFAULT 0,
	"links_clicked" jsonb,
	"email_provider" varchar,
	"message_id" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"scheduled_for" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_name" varchar NOT NULL,
	"template_description" text,
	"template_type" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"preheader_text" varchar,
	"html_content" text NOT NULL,
	"text_content" text,
	"design_json" jsonb,
	"variable_fields" jsonb,
	"category" varchar,
	"tags" text[],
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_templates_name_unique" UNIQUE("tenant_id","template_name")
);
--> statement-breakpoint
CREATE TABLE "email_unsubscribes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"contact_id" varchar,
	"unsubscribe_type" varchar NOT NULL,
	"campaign_id" varchar,
	"list_id" varchar,
	"reason" varchar,
	"feedback_text" text,
	"unsubscribe_method" varchar,
	"email_send_id" varchar,
	"user_agent" text,
	"ip_address" varchar,
	"unsubscribed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_unsubscribes_unique" UNIQUE("tenant_id","email","unsubscribe_type")
);
--> statement-breakpoint
CREATE TABLE "employee_commission_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"quota_target" numeric(15, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"custom_rates" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_employee_id" varchar,
	"employee_number" varchar,
	"last_sync_date" timestamp,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"work_email" varchar,
	"work_phone" varchar,
	"mobile_phone" varchar,
	"department" varchar,
	"job_title" varchar,
	"hire_date" timestamp,
	"termination_date" timestamp,
	"manager_id" varchar,
	"assigned_territory" varchar,
	"commission_rate" numeric(5, 4),
	"hourly_labor_rate" numeric(10, 2),
	"technician_certification_level" varchar,
	"is_active" boolean DEFAULT true,
	"employee_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "employees_employee_number_unique" UNIQUE("employee_number")
);
--> statement-breakpoint
CREATE TABLE "enabled_products" (
	"enabled_product_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"master_product_id" varchar,
	"source" varchar DEFAULT 'master_catalog' NOT NULL,
	"enabled" boolean DEFAULT true,
	"custom_sku" varchar,
	"custom_name" varchar,
	"dealer_cost" numeric(10, 2),
	"company_price" numeric(10, 2),
	"markup_rule_id" varchar,
	"price_overridden" boolean DEFAULT false,
	"enabled_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "encrypted_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"table_name" varchar(255) NOT NULL,
	"record_id" uuid NOT NULL,
	"field_name" varchar(255) NOT NULL,
	"encrypted_value" text NOT NULL,
	"encryption_iv" varchar(255) NOT NULL,
	"encryption_tag" varchar(255) NOT NULL,
	"encryption_algorithm" varchar(50) DEFAULT 'aes-256-gcm' NOT NULL,
	"key_version" varchar(50) DEFAULT 'v1' NOT NULL,
	"encrypted_at" timestamp DEFAULT now() NOT NULL,
	"access_level" "data_classification" DEFAULT 'confidential' NOT NULL,
	"retention_period_days" integer,
	"original_data_type" varchar(50),
	"field_category" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enhanced_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_contact_id" varchar,
	"external_account_id" varchar,
	"external_lead_id" varchar,
	"migration_status" varchar,
	"last_sync_date" timestamp,
	"first_name" varchar,
	"last_name" varchar,
	"full_name" varchar,
	"salutation" varchar,
	"suffix" varchar,
	"title" varchar,
	"department" varchar,
	"company_id" varchar,
	"company_name" varchar,
	"email" varchar,
	"work_phone" varchar,
	"mobile_phone" varchar,
	"home_phone" varchar,
	"other_phone" varchar,
	"fax" varchar,
	"reports_to_contact_id" varchar,
	"contact_level" varchar,
	"contact_role" varchar,
	"is_decision_maker" boolean DEFAULT false,
	"is_primary_contact" boolean DEFAULT false,
	"lead_status" varchar,
	"lead_source" varchar,
	"owner_id" varchar,
	"owner_name" varchar,
	"has_opted_out_of_email" boolean DEFAULT false,
	"do_not_call" boolean DEFAULT false,
	"preferred_contact_method" varchar,
	"languages" varchar,
	"mailing_address_line_1" varchar,
	"mailing_city" varchar,
	"mailing_state" varchar,
	"mailing_zip_code" varchar,
	"mailing_country" varchar,
	"birthdate" timestamp,
	"assistant_name" varchar,
	"assistant_phone" varchar,
	"description" text,
	"is_person_account" boolean DEFAULT false,
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"last_activity_date" timestamp,
	"favorite_content_type" varchar,
	"preferred_channels" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enhanced_product_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"pricing_tier" varchar,
	"dealer_cost" numeric(12, 2) NOT NULL,
	"dealer_cost_notes" text,
	"use_custom_markup" boolean DEFAULT false,
	"markup_type" "markup_type",
	"markup_percentage" numeric(5, 2),
	"markup_amount" numeric(10, 2),
	"rep_cost" numeric(12, 2) NOT NULL,
	"suggested_retail_price" numeric(12, 2),
	"minimum_sale_price" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp DEFAULT now(),
	"expiration_date" timestamp,
	"last_cost_update" timestamp,
	"last_cost_update_by" varchar,
	"cost_change_reason" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enhanced_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_product_id" varchar,
	"migration_status" varchar,
	"last_sync_date" timestamp,
	"product_name" varchar NOT NULL,
	"product_code" varchar,
	"description" text,
	"product_family" varchar,
	"category" varchar,
	"subcategory" varchar,
	"product_type" varchar,
	"is_active" boolean DEFAULT true,
	"can_use_quantity_schedule" boolean DEFAULT false,
	"can_use_revenue_schedule" boolean DEFAULT false,
	"quantity_unit_of_measure" varchar,
	"sku" varchar,
	"display_url" varchar,
	"external_data_source_id" varchar,
	"external_id" varchar,
	"manufacturer" varchar,
	"model_number" varchar,
	"specifications" text,
	"warranty_period_months" integer,
	"weight" numeric(10, 2),
	"dimensions" varchar,
	"power_requirements" varchar,
	"monthly_duty_cycle" integer,
	"print_speed_ppm" integer,
	"is_color_capable" boolean DEFAULT false,
	"is_duplex_capable" boolean DEFAULT false,
	"is_network_capable" boolean DEFAULT false,
	"product_cost" numeric(10, 2),
	"msrp" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enhanced_quote_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar,
	"customer_id" varchar,
	"quote_number" varchar NOT NULL,
	"quote_version" varchar DEFAULT '1.0',
	"total_dealer_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_rep_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_customer_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_margin_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_margin_percentage" numeric(5, 2) DEFAULT '0',
	"total_rep_margin_amount" numeric(12, 2) DEFAULT '0',
	"total_rep_margin_percentage" numeric(5, 2) DEFAULT '0',
	"total_discount_amount" numeric(12, 2) DEFAULT '0',
	"total_discount_percentage" numeric(5, 2) DEFAULT '0',
	"requires_approval" boolean DEFAULT false,
	"approval_reason" text,
	"approval_status" "pricing_approval_status" DEFAULT 'pending',
	"approved_by" varchar,
	"approved_date" timestamp,
	"approval_notes" text,
	"rejection_reason" text,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"valid_until" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"sent_date" timestamp,
	CONSTRAINT "enhanced_quote_pricing_quote_number_unique" UNIQUE("quote_number")
);
--> statement-breakpoint
CREATE TABLE "enhanced_quote_pricing_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"quote_pricing_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"pricing_tier" varchar,
	"line_number" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"product_code" varchar,
	"product_description" text,
	"quantity" varchar DEFAULT '1' NOT NULL,
	"unit_dealer_cost" numeric(12, 2) NOT NULL,
	"unit_rep_cost" numeric(12, 2) NOT NULL,
	"unit_customer_price" numeric(12, 2) NOT NULL,
	"total_dealer_cost" numeric(12, 2) NOT NULL,
	"total_rep_cost" numeric(12, 2) NOT NULL,
	"total_customer_price" numeric(12, 2) NOT NULL,
	"line_margin_amount" numeric(12, 2) NOT NULL,
	"line_margin_percentage" numeric(5, 2) NOT NULL,
	"line_rep_margin_amount" numeric(12, 2),
	"line_rep_margin_percentage" numeric(5, 2),
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"discount_percentage" numeric(5, 2) DEFAULT '0',
	"discount_reason" text,
	"is_price_overridden" boolean DEFAULT false,
	"original_rep_cost" numeric(12, 2),
	"override_reason" text,
	"override_approved_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enhanced_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"organizational_unit_id" varchar,
	"name" varchar(128) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"hierarchy_level" "role_hierarchy_level" NOT NULL,
	"organizational_tier" "organizational_tier" NOT NULL,
	"parent_role_id" varchar,
	"lft" integer NOT NULL,
	"rght" integer NOT NULL,
	"depth" integer NOT NULL,
	"department" varchar(50) NOT NULL,
	"functional_area" varchar(50),
	"is_system_role" boolean DEFAULT false,
	"is_customizable" boolean DEFAULT true,
	"is_template" boolean DEFAULT false,
	"max_direct_reports" integer,
	"territory_scope" varchar(50),
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enriched_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"zoominfo_company_id" varchar,
	"apollo_company_id" varchar,
	"company_name" varchar NOT NULL,
	"website" varchar,
	"primary_domain" varchar,
	"main_phone" varchar,
	"primary_industry" varchar,
	"sub_industry" varchar,
	"employee_count" integer,
	"employee_range" varchar,
	"annual_revenue" numeric,
	"revenue_range" varchar,
	"founded_year" integer,
	"company_type" varchar,
	"stock_ticker" varchar,
	"street_address" varchar,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"country" varchar,
	"parent_company_id" varchar,
	"parent_company_name" varchar,
	"technologies" jsonb,
	"departments" jsonb,
	"key_executives" jsonb,
	"business_keywords" jsonb,
	"total_funding" numeric,
	"funding_stage" varchar,
	"last_funding_date" timestamp,
	"company_score" integer,
	"target_account_tier" varchar,
	"account_priority" varchar DEFAULT 'medium',
	"enrichment_source" varchar,
	"last_enriched_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enriched_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"zoominfo_contact_id" varchar,
	"apollo_contact_id" varchar,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"full_name" varchar,
	"email" varchar,
	"direct_phone" varchar,
	"mobile_phone" varchar,
	"job_title" varchar,
	"management_level" varchar,
	"department" varchar,
	"sub_department" varchar,
	"job_function" varchar,
	"company_external_id" varchar,
	"company_name" varchar,
	"company_domain" varchar,
	"city" varchar,
	"state" varchar,
	"country" varchar,
	"zip_code" varchar,
	"time_zone" varchar,
	"linkedin_url" varchar,
	"twitter_url" varchar,
	"facebook_url" varchar,
	"person_score" integer,
	"is_verified" boolean DEFAULT false,
	"email_verification_status" varchar,
	"work_history" jsonb,
	"education_history" jsonb,
	"skills" jsonb,
	"prospecting_status" varchar DEFAULT 'new',
	"lead_score" integer,
	"priority_level" varchar DEFAULT 'medium',
	"enrichment_source" varchar,
	"last_enriched_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enriched_intent_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"company_external_id" varchar NOT NULL,
	"company_name" varchar,
	"intent_topic" varchar,
	"topic_category" varchar,
	"intent_score" integer,
	"intent_level" varchar,
	"buying_stage" varchar,
	"decision_timeframe" varchar,
	"is_trending" boolean DEFAULT false,
	"first_seen_date" timestamp,
	"last_activity_date" timestamp,
	"days_active" integer,
	"intent_keywords" jsonb,
	"research_areas" jsonb,
	"competitor_activity" jsonb,
	"sales_opportunity_score" integer,
	"recommended_actions" jsonb,
	"optimal_timing_window" varchar,
	"data_source" varchar DEFAULT 'zoominfo',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enriched_org_hierarchy" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"company_external_id" varchar NOT NULL,
	"person_external_id" varchar NOT NULL,
	"manager_person_id" varchar,
	"department_name" varchar,
	"organizational_level" integer,
	"team_size" integer,
	"direct_reports_count" integer,
	"decision_making_power" varchar,
	"has_budget_authority" boolean DEFAULT false,
	"procurement_influence_level" varchar,
	"influence_score" integer,
	"accessibility_score" integer,
	"hierarchy_path" jsonb,
	"peer_contacts" jsonb,
	"subordinate_contacts" jsonb,
	"data_source" varchar DEFAULT 'zoominfo',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enrichment_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar,
	"company_id" varchar,
	"activity_type" varchar NOT NULL,
	"activity_subtype" varchar,
	"activity_description" text,
	"outcome" varchar,
	"outcome_details" text,
	"campaign_name" varchar,
	"sequence_step" integer,
	"follow_up_required" boolean DEFAULT false,
	"next_action_date" timestamp,
	"next_action_type" varchar,
	"response_time_hours" integer,
	"engagement_score" integer,
	"lead_quality_score" integer,
	"assigned_user_id" varchar,
	"completed_by_user_id" varchar,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_equipment_id" varchar,
	"external_customer_id" varchar,
	"last_sync_date" timestamp,
	"serial_number" varchar,
	"model_number" varchar,
	"manufacturer" varchar,
	"description" text,
	"asset_tag" varchar,
	"customer_id" varchar NOT NULL,
	"location_description" text,
	"install_date" timestamp,
	"ip_address" varchar,
	"meter_type" varchar,
	"is_color_capable" boolean DEFAULT false,
	"equipment_status" varchar DEFAULT 'active',
	"purchase_price" numeric(10, 2),
	"monthly_payment" numeric(10, 2),
	"lease_expires_date" timestamp,
	"warranty_expires_date" timestamp,
	"service_contract_number" varchar,
	"last_service_date" timestamp,
	"next_service_due_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "equipment_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "equipment_lifecycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"manufacturer" varchar(100),
	"model" varchar(100),
	"qr_code" varchar(255),
	"current_stage" varchar DEFAULT 'ordered' NOT NULL,
	"current_location" varchar,
	"customer_id" uuid,
	"purchase_order_id" uuid,
	"warranty_start_date" timestamp,
	"warranty_end_date" timestamp,
	"warranty_registered" boolean DEFAULT false,
	"last_service_date" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "equipment_lifecycle_equipment_id_unique" UNIQUE("equipment_id")
);
--> statement-breakpoint
CREATE TABLE "equipment_onboarding_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"quote_id" varchar,
	"order_id" varchar,
	"checklist_title" varchar NOT NULL,
	"description" text,
	"status" "equipment_onboarding_status" DEFAULT 'draft',
	"installation_type" "installation_type" NOT NULL,
	"customer_data" jsonb,
	"site_information" jsonb,
	"equipment_details" jsonb,
	"scheduled_install_date" timestamp,
	"actual_install_date" timestamp,
	"assigned_technician_id" varchar,
	"estimated_duration" integer,
	"access_requirements" text,
	"business_hours" jsonb,
	"special_instructions" text,
	"pdf_url" varchar,
	"pdf_generated_at" timestamp,
	"completed_sections" integer DEFAULT 0,
	"total_sections" integer DEFAULT 0,
	"progress_percentage" numeric(5, 2) DEFAULT '0',
	"created_by" varchar NOT NULL,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"package_name" varchar NOT NULL,
	"package_code" varchar,
	"category" varchar,
	"description" text,
	"equipment" jsonb,
	"accessories" jsonb,
	"services" jsonb,
	"base_price" numeric(10, 2),
	"total_retail_price" numeric(10, 2),
	"recommended_selling_price" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"allow_customization" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expansion_opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"renewal_id" varchar,
	"opportunity_type" varchar(50) NOT NULL,
	"opportunity_source" varchar(50),
	"trigger_event" varchar(255),
	"insight" text,
	"estimated_mrr" numeric(12, 2),
	"estimated_arr" numeric(12, 2),
	"estimated_one_time_revenue" numeric(12, 2),
	"confidence_level" varchar(50),
	"proposed_products" jsonb,
	"proposed_services" jsonb,
	"status" varchar(50) DEFAULT 'identified' NOT NULL,
	"priority" varchar(50) DEFAULT 'medium',
	"identified_by" varchar,
	"owner_id" varchar,
	"identified_at" timestamp DEFAULT now() NOT NULL,
	"target_close_date" timestamp,
	"closed_at" timestamp,
	"actual_revenue" numeric(12, 2),
	"outcome_notes" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"total_pipeline_value" numeric(12, 2),
	"weighted_pipeline_value" numeric(12, 2),
	"commit_revenue" numeric(12, 2),
	"best_case_revenue" numeric(12, 2),
	"worst_case_revenue" numeric(12, 2),
	"total_deals" integer,
	"new_deals" integer,
	"advanced_deals" integer,
	"closed_won_deals" integer,
	"closed_lost_deals" integer,
	"conversion_rate" numeric(5, 2),
	"average_deal_size" numeric(10, 2),
	"average_sales_cycle" integer,
	"velocity_score" numeric(8, 2),
	"stage_distribution" jsonb,
	"pipeline_trend" varchar,
	"velocity_trend" varchar,
	"quality_trend" varchar,
	"territory_metrics" jsonb,
	"calculated_by" varchar,
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forecast_pipeline_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"business_record_id" varchar NOT NULL,
	"deal_name" varchar NOT NULL,
	"customer_name" varchar NOT NULL,
	"deal_value" numeric(10, 2) NOT NULL,
	"weighted_value" numeric(10, 2),
	"probability" integer DEFAULT 50,
	"expected_close_date" timestamp,
	"actual_close_date" timestamp,
	"days_in_pipeline" integer,
	"sales_stage" varchar NOT NULL,
	"stage_progress" integer DEFAULT 0,
	"next_milestone" varchar,
	"next_milestone_date" timestamp,
	"assigned_sales_rep" varchar NOT NULL,
	"sales_team" varchar,
	"product_category" varchar,
	"equipment_type" varchar,
	"service_type" varchar,
	"quantity" integer DEFAULT 1,
	"competitor_involved" boolean DEFAULT false,
	"primary_competitor" varchar,
	"competitive_advantage" text,
	"risk_level" varchar DEFAULT 'medium',
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"mitigation_strategies" text,
	"last_activity_date" timestamp,
	"next_activity_date" timestamp,
	"activity_count" integer DEFAULT 0,
	"outcome" varchar,
	"lost_reason" varchar,
	"actual_revenue" numeric(10, 2),
	"included_in_forecast" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forecast_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"rule_type" varchar NOT NULL,
	"description" text,
	"conditions" jsonb,
	"actions" jsonb,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"frequency" varchar DEFAULT 'daily',
	"last_executed" timestamp,
	"execution_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fpy_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_operations" integer NOT NULL,
	"first_pass_operations" integer NOT NULL,
	"fpy_percentage" numeric(5, 2) NOT NULL,
	"fpy_by_technician" jsonb DEFAULT '{}'::jsonb,
	"fpy_by_equipment_type" jsonb DEFAULT '{}'::jsonb,
	"top_defect_types" jsonb DEFAULT '[]'::jsonb,
	"rework_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gdpr_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "gdpr_request_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"subject_email" varchar(255) NOT NULL,
	"requestor_id" uuid NOT NULL,
	"description" text NOT NULL,
	"legal_basis" text,
	"processing_purpose" text,
	"status" "gdpr_status" DEFAULT 'pending' NOT NULL,
	"priority" "audit_severity" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp NOT NULL,
	"completion_date" timestamp,
	"rejection_reason" text,
	"data_categories" jsonb NOT NULL,
	"affected_systems" jsonb NOT NULL,
	"identity_verified" boolean DEFAULT false,
	"verification_method" varchar(100),
	"verification_date" timestamp,
	"response_data" jsonb,
	"response_format" varchar(50),
	"response_size_bytes" integer,
	"processing_notes" text,
	"approved_by" uuid,
	"approval_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "generated_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"template_id" integer NOT NULL,
	"template_version" integer NOT NULL,
	"name" text NOT NULL,
	"type" "document_template_type" NOT NULL,
	"format" "document_format" NOT NULL,
	"content" text NOT NULL,
	"file_path" text,
	"file_size" integer,
	"data_context" jsonb NOT NULL,
	"workflow_id" integer,
	"task_id" integer,
	"business_record_id" integer,
	"quote_id" integer,
	"deal_id" integer,
	"service_call_id" integer,
	"emailed_to" jsonb,
	"emailed_at" timestamp,
	"downloaded_count" integer DEFAULT 0 NOT NULL,
	"last_downloaded_at" timestamp,
	"is_archived" boolean DEFAULT false NOT NULL,
	"generated_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_number" varchar(50),
	"account_description" text,
	"fully_qualified_name" varchar(500),
	"is_active" boolean DEFAULT true,
	"is_sub_account" boolean DEFAULT false,
	"parent_account_id" varchar,
	"account_classification" varchar(50),
	"account_type" varchar(100),
	"account_sub_type" varchar(100),
	"bank_account_number" varchar,
	"routing_number" varchar,
	"opening_balance" numeric(15, 2) DEFAULT '0.00',
	"opening_balance_date" timestamp,
	"current_balance" numeric(15, 2) DEFAULT '0.00',
	"current_balance_with_sub_accounts" numeric(15, 2) DEFAULT '0.00',
	"currency_id" varchar,
	"tax_code_id" varchar,
	"account_alias" varchar,
	"is_tax_account" boolean DEFAULT false,
	"external_account_id" varchar,
	"qb_domain" varchar,
	"is_sparse" boolean DEFAULT false,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"goal_id" varchar NOT NULL,
	"report_date" timestamp NOT NULL,
	"current_count" integer DEFAULT 0,
	"target_count" integer NOT NULL,
	"progress_percentage" numeric(5, 2),
	"daily_average" numeric(10, 2),
	"projected_total" integer,
	"on_track" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gsc_keyword_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"query" varchar(255) NOT NULL,
	"page" varchar(500),
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	"ctr" numeric(5, 2) NOT NULL,
	"position" numeric(5, 2) NOT NULL,
	"country" varchar(2),
	"device" varchar(20),
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_oauth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_type" varchar(50) DEFAULT 'Bearer',
	"expires_at" timestamp NOT NULL,
	"scope" text,
	"email" varchar(255),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_page_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"page" varchar(500) NOT NULL,
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	"ctr" numeric(5, 2) NOT NULL,
	"position" numeric(5, 2) NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"property_url" varchar(500) NOT NULL,
	"property_name" varchar(255),
	"permission_level" varchar(50),
	"is_active" boolean DEFAULT true,
	"auto_sync" boolean DEFAULT true,
	"sync_frequency" "seo_monitoring_frequency" DEFAULT 'daily',
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"subtitle" varchar(500),
	"description" text,
	"content" text NOT NULL,
	"table_of_contents" jsonb,
	"meta_title" varchar(60),
	"meta_description" varchar(160),
	"focus_keyword" varchar(255),
	"secondary_keywords" jsonb,
	"structured_data" jsonb,
	"cover_image" varchar(500),
	"cover_image_alt" varchar(255),
	"category" "content_category" NOT NULL,
	"is_pillar" boolean DEFAULT false,
	"tags" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"author_id" uuid,
	"author_name" varchar(255),
	"view_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"read_time" integer,
	"word_count" integer,
	"has_citations" boolean DEFAULT false,
	"has_statistics" boolean DEFAULT false,
	"has_interactive_tool" boolean DEFAULT false,
	"seo_score" integer,
	"geo_score" integer,
	"related_guides" jsonb,
	"related_blog_posts" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guides_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "handoff_task_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_name" varchar(255) NOT NULL,
	"handoff_type" varchar(50) NOT NULL,
	"description" text,
	"tasks" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handoff_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"handoff_id" varchar NOT NULL,
	"task_name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"assigned_to" varchar,
	"assigned_to_role" varchar,
	"assigned_at" timestamp,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"is_required" boolean DEFAULT true,
	"is_blocking" boolean DEFAULT false,
	"depends_on" text[],
	"blocked_by" text[],
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"completed_by" varchar,
	"task_data" jsonb,
	"attachments" jsonb,
	"notes" text,
	"completion_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "implementation_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"handoff_id" varchar,
	"project_name" varchar(255) NOT NULL,
	"project_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'planning' NOT NULL,
	"planned_start_date" timestamp,
	"planned_end_date" timestamp,
	"actual_start_date" timestamp,
	"actual_end_date" timestamp,
	"go_live_date" timestamp,
	"project_manager_id" varchar,
	"team_members" text[],
	"milestones" jsonb,
	"completion_percentage" integer DEFAULT 0,
	"current_phase" varchar(100),
	"risks" jsonb,
	"issues" jsonb,
	"last_customer_update" timestamp,
	"next_customer_update" timestamp,
	"customer_satisfaction" integer,
	"budgeted_hours" numeric(8, 2),
	"actual_hours" numeric(8, 2),
	"project_notes" text,
	"lessons_learned" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_correlations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"master_incident_id" uuid NOT NULL,
	"master_incident_title" varchar(500) NOT NULL,
	"related_incident_ids" jsonb NOT NULL,
	"total_related_incidents" integer NOT NULL,
	"correlation_factors" jsonb,
	"correlation_strength" integer NOT NULL,
	"correlation_type" varchar(100),
	"attack_scope" text,
	"affected_systems" jsonb,
	"affected_users" jsonb,
	"combined_risk_score" integer,
	"estimated_impact" text,
	"all_incidents_resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_resolution_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "alert_category" NOT NULL,
	"sub_category" varchar(100),
	"pattern_name" varchar(255) NOT NULL,
	"description" text,
	"common_resolution_steps" jsonb NOT NULL,
	"common_root_causes" jsonb,
	"prevention_measures" jsonb,
	"avg_resolution_time_minutes" integer NOT NULL,
	"median_resolution_time_minutes" integer,
	"success_rate_percent" integer NOT NULL,
	"total_incidents" integer DEFAULT 0,
	"total_resolved" integer DEFAULT 0,
	"confidence" "resolution_confidence" NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"based_on_incidents" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industry_benchmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry" varchar NOT NULL,
	"company_size" varchar NOT NULL,
	"avg_cost_per_page_bw" numeric(6, 4) NOT NULL,
	"avg_cost_per_page_color" numeric(6, 4) NOT NULL,
	"avg_cost_per_employee" numeric(10, 2) NOT NULL,
	"avg_device_per_employee" numeric(4, 2) NOT NULL,
	"avg_utilization_rate" numeric(5, 2) NOT NULL,
	"avg_downtime_hours_per_month" numeric(6, 2) NOT NULL,
	"avg_service_calls_per_device" numeric(4, 2) NOT NULL,
	"supplies_cost_percent" numeric(5, 2) NOT NULL,
	"service_cost_percent" numeric(5, 2) NOT NULL,
	"energy_cost_percent" numeric(5, 2) NOT NULL,
	"labor_cost_percent" numeric(5, 2) NOT NULL,
	"downtime_cost_percent" numeric(5, 2) NOT NULL,
	"data_source" varchar,
	"sample_size" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "installation_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"installation_id" varchar NOT NULL,
	"item_order" integer NOT NULL,
	"category" varchar NOT NULL,
	"item_name" varchar NOT NULL,
	"item_description" text,
	"is_completed" boolean DEFAULT false,
	"is_required" boolean DEFAULT true,
	"completed_at" timestamp,
	"completed_by" varchar,
	"notes" text,
	"photo_ids" text[],
	"requires_photo" boolean DEFAULT false,
	"requires_signature" boolean DEFAULT false,
	"expected_value" text,
	"actual_value" text,
	"passed" boolean,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "installation_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"estimated_duration" integer,
	"installation_type" varchar NOT NULL,
	"site_requirements" jsonb,
	"pre_installation_checklist" jsonb,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"actual_start_time" timestamp,
	"actual_end_time" timestamp,
	"installation_notes" text,
	"customer_signature" varchar,
	"installation_photos" jsonb,
	"configuration_backup" jsonb,
	"training_provided" boolean DEFAULT false,
	"customer_satisfaction_rating" integer,
	"follow_up_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"installation_number" varchar NOT NULL,
	"installation_type" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"service_ticket_id" varchar,
	"quote_id" varchar,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"estimated_duration" integer,
	"assigned_technician_id" varchar,
	"assisting_technician_ids" text[],
	"installation_address" text NOT NULL,
	"gps_latitude" numeric(10, 8),
	"gps_longitude" numeric(11, 8),
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"serial_number" varchar,
	"model_number" varchar,
	"network_configured" boolean DEFAULT false,
	"drivers_installed" boolean DEFAULT false,
	"user_training_completed" boolean DEFAULT false,
	"installation_notes" text,
	"technician_notes" text,
	"customer_name" varchar,
	"customer_email" varchar,
	"customer_phone" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "installations_number_unique" UNIQUE("tenant_id","installation_number")
);
--> statement-breakpoint
CREATE TABLE "integration_api_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"integration_id" varchar NOT NULL,
	"endpoint" varchar NOT NULL,
	"method" varchar NOT NULL,
	"request_timestamp" timestamp NOT NULL,
	"response_status" integer,
	"latency_ms" integer,
	"success" boolean DEFAULT false,
	"error_type" varchar,
	"error_message" text,
	"records_affected" integer DEFAULT 0,
	"response_size" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid,
	"device_id" uuid,
	"action" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"message" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"response_time" integer,
	"error_code" varchar(50),
	"user_id" uuid,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"integration_name" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"api_key" text,
	"api_secret" text,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp,
	"account_id" varchar,
	"webhook_secret" varchar,
	"sandbox_mode" boolean DEFAULT false,
	"config" jsonb,
	"last_health_check" timestamp,
	"health_status" varchar DEFAULT 'unknown',
	"error_message" text,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"integration_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_api_calls" integer DEFAULT 0,
	"successful_calls" integer DEFAULT 0,
	"failed_calls" integer DEFAULT 0,
	"avg_latency_ms" integer DEFAULT 0,
	"min_latency_ms" integer,
	"max_latency_ms" integer,
	"p95_latency_ms" integer,
	"records_synced" integer DEFAULT 0,
	"data_volume_bytes" bigint DEFAULT 0,
	"webhooks_received" integer DEFAULT 0,
	"webhooks_processed" integer DEFAULT 0,
	"webhooks_failed" integer DEFAULT 0,
	"rate_limit_hits" integer DEFAULT 0,
	"errors_by_type" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_setup_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_session_id" uuid,
	"tenant_id" uuid,
	"integration_type" varchar(100) NOT NULL,
	"integration_name" varchar(255),
	"setup_steps" jsonb NOT NULL,
	"configuration" jsonb,
	"tests_passed" boolean DEFAULT false,
	"test_results" jsonb,
	"auto_configured" boolean DEFAULT false,
	"auto_configuration_score" integer,
	"status" "tenant_integration_status" DEFAULT 'not_configured' NOT NULL,
	"setup_duration_minutes" integer,
	"initial_sync_duration_minutes" integer,
	"records_synced" integer,
	"error_count" integer DEFAULT 0,
	"last_error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"external_item_id" varchar,
	"last_sync_date" timestamp,
	"part_number" varchar,
	"manufacturer_part_number" varchar,
	"item_description" text,
	"item_category" varchar,
	"manufacturer" varchar,
	"quantity_on_hand" integer DEFAULT 0,
	"quantity_committed" integer DEFAULT 0,
	"quantity_available" integer DEFAULT 0,
	"quantity_on_order" integer DEFAULT 0,
	"reorder_point" integer DEFAULT 0,
	"reorder_quantity" integer DEFAULT 0,
	"max_stock_level" integer,
	"unit_cost" numeric(10, 4),
	"average_cost" numeric(10, 4),
	"last_cost" numeric(10, 4),
	"unit_price" numeric(10, 4),
	"retail_price" numeric(10, 4),
	"warehouse_location" varchar,
	"bin_location" varchar,
	"primary_vendor" varchar,
	"vendor_part_number" varchar,
	"unit_of_measure" varchar DEFAULT 'EA',
	"item_weight" numeric(8, 3),
	"is_taxable" boolean DEFAULT true,
	"is_serialized" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_sold_date" timestamp,
	"last_received_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_items_part_number_unique" UNIQUE("part_number")
);
--> statement-breakpoint
CREATE TABLE "invoice_generation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"batch_id" varchar,
	"generation_type" varchar NOT NULL,
	"invoice_id" varchar,
	"customer_id" varchar NOT NULL,
	"contract_id" varchar,
	"equipment_id" varchar,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"status" varchar NOT NULL,
	"meter_readings_used" jsonb,
	"billing_rules_applied" jsonb,
	"calculated_subtotal" numeric(10, 2),
	"calculated_tax" numeric(10, 2),
	"calculated_total" numeric(10, 2),
	"line_items_generated" integer DEFAULT 0,
	"processing_time_ms" integer,
	"error_occurred" boolean DEFAULT false,
	"error_type" varchar,
	"error_message" text,
	"error_stack" text,
	"warnings_generated" jsonb,
	"skipped_reason" text,
	"retried_count" integer DEFAULT 0,
	"retried_at" timestamp,
	"triggered_by" varchar,
	"triggered_by_event" varchar,
	"sent_to_customer" boolean DEFAULT false,
	"sent_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_line_item_id" varchar,
	"external_invoice_id" varchar,
	"external_item_id" varchar,
	"external_equipment_id" varchar,
	"invoice_id" varchar NOT NULL,
	"equipment_id" varchar,
	"meter_reading_id" varchar,
	"line_description" text,
	"quantity" integer DEFAULT 0,
	"unit_price" numeric(10, 4),
	"extended_price" numeric(10, 2),
	"discount_percent" numeric(5, 2),
	"discount_amount" numeric(10, 2),
	"tax_rate" numeric(5, 4),
	"tax_amount" numeric(10, 2),
	"line_total" numeric(10, 2),
	"gl_account_code" varchar,
	"serial_number" varchar,
	"meter_start_reading" integer,
	"meter_end_reading" integer,
	"meter_usage" integer,
	"billing_type" varchar,
	"description" varchar,
	"rate" numeric(10, 4) DEFAULT '0',
	"amount" numeric(10, 2),
	"line_type" varchar DEFAULT 'meter',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_invoice_id" varchar,
	"external_customer_id" varchar,
	"last_sync_date" timestamp,
	"customer_id" varchar NOT NULL,
	"contract_id" varchar,
	"invoice_number" varchar,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"po_number" varchar,
	"sales_rep" varchar,
	"invoice_type" varchar DEFAULT 'sales',
	"subtotal_amount" numeric(10, 2),
	"tax_amount" numeric(10, 2),
	"total_amount" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"balance_due" numeric(10, 2),
	"invoice_status" varchar DEFAULT 'open',
	"payment_terms" varchar,
	"billing_period_start" timestamp,
	"billing_period_end" timestamp,
	"monthly_base" numeric(10, 2) DEFAULT '0',
	"black_copies_total" integer DEFAULT 0,
	"color_copies_total" integer DEFAULT 0,
	"black_amount" numeric(10, 2) DEFAULT '0',
	"color_amount" numeric(10, 2) DEFAULT '0',
	"status" varchar DEFAULT 'draft',
	"paid_date" timestamp,
	"issuance_delay_hours" integer DEFAULT 0,
	"issued_at" timestamp,
	"invoice_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"excerpt" text,
	"content" jsonb NOT NULL,
	"plain_text_content" text,
	"html_content" text,
	"category_id" uuid NOT NULL,
	"subcategory" varchar(255),
	"content_type" "content_type" DEFAULT 'tutorial' NOT NULL,
	"difficulty_level" "difficulty_level" DEFAULT 'beginner' NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_version" integer,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"ai_generated_percentage" numeric(5, 2),
	"ai_model_used" varchar(100),
	"ai_generation_prompts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_confidence_score" numeric(5, 2),
	"ai_content_quality_score" numeric(5, 2),
	"meta_title" varchar(255),
	"meta_description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"estimated_reading_time" integer DEFAULT 0 NOT NULL,
	"related_articles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"featured_image" varchar(500),
	"media_attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"unique_view_count" integer DEFAULT 0 NOT NULL,
	"helpful_votes" integer DEFAULT 0 NOT NULL,
	"unhelpful_votes" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2),
	"share_count" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"allow_comments" boolean DEFAULT true NOT NULL,
	"allow_feedback" boolean DEFAULT true NOT NULL,
	"last_reviewed_at" timestamp,
	"last_reviewed_by" uuid,
	"content_freshness_score" numeric(5, 2),
	"next_review_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"archived_at" timestamp,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "kb_article_tenant_slug_unique" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE TABLE "knowledge_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(100),
	"parent_category_id" uuid,
	"category_order" integer DEFAULT 0 NOT NULL,
	"category_level" integer DEFAULT 0 NOT NULL,
	"ai_suggested_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_content_gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"article_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "kb_category_tenant_slug_unique" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE TABLE "knowledge_search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"query_text" text NOT NULL,
	"query_intent" varchar(50),
	"user_id" uuid,
	"session_id" varchar(255),
	"results_count" integer DEFAULT 0 NOT NULL,
	"top_result_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clicked_result_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_answer_generated" boolean DEFAULT false NOT NULL,
	"ai_answer_helpful" boolean,
	"ai_confidence_score" numeric(5, 2),
	"search_time_ms" integer,
	"ai_response_time_ms" integer,
	"user_satisfaction_rating" integer,
	"found_answer" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"page_type" varchar(50) NOT NULL,
	"meta_title" varchar(60),
	"meta_description" varchar(160),
	"focus_keyword" varchar(255),
	"secondary_keywords" jsonb,
	"hero_headline" varchar(255),
	"hero_subheadline" text,
	"hero_image" varchar(500),
	"hero_cta" varchar(100),
	"hero_cta_url" varchar(500),
	"sections" jsonb,
	"structured_data" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"view_count" integer DEFAULT 0,
	"conversion_count" integer DEFAULT 0,
	"conversion_rate" integer,
	"is_variant" boolean DEFAULT false,
	"parent_page_id" uuid,
	"variant_name" varchar(100),
	"seo_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "landing_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "lead_assignment_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"assigned_from" varchar,
	"assigned_to" varchar NOT NULL,
	"assignment_reason" varchar(100) NOT NULL,
	"rule_id" varchar,
	"assigned_by" varchar,
	"assignment_notes" text,
	"first_response_at" timestamp,
	"first_response_time_minutes" integer,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_assignment_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0,
	"target_user_id" varchar,
	"rule_id" varchar,
	"schedule_for" timestamp,
	"processed_at" timestamp,
	"assigned_at" timestamp,
	"attempt_count" integer DEFAULT 0,
	"last_error" text,
	"max_attempts" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_assignment_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"description" text,
	"assignment_type" varchar(50) NOT NULL,
	"criteria" jsonb NOT NULL,
	"territory_id" varchar,
	"assign_to_user_id" varchar,
	"assign_to_team" varchar,
	"round_robin_config" jsonb,
	"respect_capacity_limits" boolean DEFAULT true,
	"max_leads_per_rep" integer,
	"max_leads_per_day" integer,
	"assign_immediately" boolean DEFAULT true,
	"delay_minutes" integer DEFAULT 0,
	"business_hours_only" boolean DEFAULT false,
	"escalation_enabled" boolean DEFAULT false,
	"escalate_after_minutes" integer DEFAULT 60,
	"escalate_to_user_id" varchar,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assignments_count" integer DEFAULT 0,
	"last_assigned_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"title" varchar,
	"department" varchar,
	"phone" varchar,
	"email" varchar,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_related_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"record_type" varchar NOT NULL,
	"record_id" varchar NOT NULL,
	"record_title" varchar,
	"record_count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lease_dispositions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lease_id" varchar NOT NULL,
	"action" "disposition_action" NOT NULL,
	"action_date" timestamp NOT NULL,
	"return_scheduled_date" timestamp,
	"return_completed_date" timestamp,
	"return_condition" varchar,
	"return_notes" text,
	"purchase_price" numeric(12, 2),
	"purchase_date" timestamp,
	"purchase_invoice_id" varchar,
	"upgrade_proposal_id" varchar,
	"upgrade_lease_id" varchar,
	"trade_in_value" numeric(12, 2),
	"settlement_amount" numeric(12, 2),
	"damage_fees" numeric(10, 2),
	"excess_usage_fees" numeric(10, 2),
	"other_fees" numeric(10, 2),
	"fee_notes" text,
	"equipment_condition_report" jsonb,
	"photo_urls" jsonb,
	"final_status" varchar,
	"completion_date" timestamp,
	"assigned_to" varchar,
	"completed_by" varchar,
	"notes" text,
	"internal_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lease_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lease_id" varchar NOT NULL,
	"payment_number" integer NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"scheduled_amount" numeric(10, 2) NOT NULL,
	"paid_date" timestamp,
	"paid_amount" numeric(10, 2),
	"status" "lease_payment_status" DEFAULT 'scheduled' NOT NULL,
	"payment_method" varchar,
	"confirmation_number" varchar,
	"transaction_id" varchar,
	"invoice_id" varchar,
	"payment_integration_id" varchar,
	"principal" numeric(10, 2),
	"interest" numeric(10, 2),
	"tax" numeric(10, 2),
	"fees" numeric(10, 2),
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"last_retry_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lease_renewals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lease_id" varchar NOT NULL,
	"renewal_offered" boolean DEFAULT false,
	"renewal_offer_date" timestamp,
	"renewal_deadline" timestamp,
	"renewal_term" integer,
	"renewal_monthly_payment" numeric(10, 2),
	"renewal_total_amount" numeric(12, 2),
	"renewal_type" "lease_type",
	"customer_decision" varchar,
	"decision_date" timestamp,
	"decision_by" varchar,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_date" timestamp,
	"next_reminder_date" timestamp,
	"notes" text,
	"internal_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lease_number" varchar NOT NULL,
	"lease_name" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"business_record_id" varchar,
	"proposal_id" varchar,
	"contract_id" varchar,
	"lease_type" "lease_type" DEFAULT 'fmv' NOT NULL,
	"status" "lease_status" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"monthly_payment" numeric(10, 2) NOT NULL,
	"term" integer NOT NULL,
	"interest_rate" numeric(5, 3),
	"residual_value" numeric(12, 2),
	"buyout_amount" numeric(12, 2),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"first_payment_date" timestamp NOT NULL,
	"last_payment_date" timestamp NOT NULL,
	"equipment_ids" jsonb DEFAULT '[]'::jsonb,
	"payment_method" varchar,
	"payment_day_of_month" integer DEFAULT 1,
	"auto_pay_enabled" boolean DEFAULT false,
	"insurance_required" boolean DEFAULT false,
	"maintenance_included" boolean DEFAULT false,
	"taxable" boolean DEFAULT true,
	"sales_tax_rate" numeric(5, 3),
	"renewal_option" boolean DEFAULT true,
	"renewal_notice_months" integer DEFAULT 6,
	"renewal_reminder_sent" boolean DEFAULT false,
	"renewal_reminder_date" timestamp,
	"early_termination_allowed" boolean DEFAULT false,
	"early_termination_penalty" numeric(10, 2),
	"document_url" varchar,
	"e_signature_id" varchar,
	"lessor_name" varchar,
	"lessor_contact_name" varchar,
	"lessor_contact_email" varchar,
	"lessor_contact_phone" varchar,
	"lessor_account_number" varchar,
	"notes" text,
	"special_terms" text,
	"payments_completed" integer DEFAULT 0,
	"payments_remaining" integer,
	"total_paid" numeric(12, 2) DEFAULT 0,
	"balance_remaining" numeric(12, 2),
	"days_until_expiry" integer,
	"payment_health" varchar DEFAULT 'good',
	"missed_payments" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "leases_lease_number_unique" UNIQUE("lease_number")
);
--> statement-breakpoint
CREATE TABLE "location_history" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(6, 2),
	"altitude" numeric(8, 2),
	"heading" numeric(5, 2),
	"speed" numeric(6, 2),
	"ticket_id" varchar,
	"customer_id" varchar,
	"activity_type" varchar,
	"distance_from_previous" numeric(10, 2),
	"distance_from_ticket" numeric(10, 2),
	"device_id" varchar,
	"battery_level" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"address" varchar,
	"city" varchar,
	"state" varchar(2),
	"zip_code" varchar(10),
	"phone" varchar,
	"email" varchar,
	"location_type" varchar(30) DEFAULT 'branch',
	"is_headquarters" boolean DEFAULT false,
	"region_id" varchar,
	"location_manager_id" varchar,
	"is_active" boolean DEFAULT true,
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "managed_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"category" varchar DEFAULT 'IT Services',
	"service_type" varchar,
	"service_level" varchar,
	"description" text,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"config_note" text,
	"related_products" text,
	"support_hours" varchar,
	"response_time" varchar,
	"includes_hardware" boolean DEFAULT false,
	"remote_mgmt" boolean DEFAULT false,
	"onsite_support" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric,
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric,
	"graphic_active" boolean DEFAULT false,
	"graphic_rep_price" numeric,
	"price_book_id" varchar,
	"temp_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "manager_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"manager_id" varchar NOT NULL,
	"team_id" varchar,
	"user_id" varchar,
	"insight_type" varchar NOT NULL,
	"insight_category" varchar NOT NULL,
	"current_performance" numeric(10, 2),
	"target_performance" numeric(10, 2),
	"performance_gap" numeric(10, 2),
	"recommended_actions" jsonb,
	"priority_level" varchar NOT NULL,
	"expected_impact" varchar,
	"timeframe" varchar,
	"insight_title" varchar NOT NULL,
	"insight_description" text,
	"supporting_data" jsonb,
	"is_active" boolean DEFAULT true,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "manufacturer_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"manufacturer_type" "manufacturer_type" NOT NULL,
	"manufacturer_name" varchar(255) NOT NULL,
	"connection_status" "manufacturer_connection_status" DEFAULT 'inactive' NOT NULL,
	"api_endpoint" text,
	"api_key" text,
	"api_secret" text,
	"client_id" text,
	"client_secret" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"edi_enabled" boolean DEFAULT false,
	"edi_interchange_id" varchar(100),
	"edi_qualifier" varchar(10),
	"order_method" "order_method" DEFAULT 'api' NOT NULL,
	"auto_submit_enabled" boolean DEFAULT false,
	"sandbox_mode" boolean DEFAULT true,
	"webhook_url" text,
	"webhook_secret" text,
	"dealer_account_number" varchar(100),
	"dealer_account_name" varchar(255),
	"shipping_account_number" varchar(100),
	"last_connection_test" timestamp with time zone,
	"last_successful_order" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0,
	"default_ship_to_address_id" varchar,
	"configuration_options" jsonb,
	"custom_fields" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "manufacturer_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"manufacturer" "manufacturer" NOT NULL,
	"integration_name" varchar(255) NOT NULL,
	"status" "integration_status" DEFAULT 'pending' NOT NULL,
	"auth_method" "auth_method" NOT NULL,
	"credentials" jsonb NOT NULL,
	"api_endpoint" varchar(500),
	"collection_frequency" "collection_frequency" DEFAULT 'daily' NOT NULL,
	"last_sync" timestamp,
	"next_sync" timestamp,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manufacturer_order_confirmations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"confirmation_number" varchar(100),
	"confirmation_type" varchar(50) NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmation_status" varchar(50) DEFAULT 'received',
	"confirmed_amount" numeric(12, 2),
	"confirmed_delivery_date" timestamp with time zone,
	"raw_confirmation_data" jsonb,
	"parsed_data" jsonb,
	"processed_at" timestamp with time zone,
	"processing_errors" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manufacturer_order_exceptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"order_id" varchar,
	"connection_id" varchar,
	"exception_type" "exception_type" NOT NULL,
	"severity" "exception_severity" DEFAULT 'error' NOT NULL,
	"exception_message" text NOT NULL,
	"exception_code" varchar(50),
	"context" varchar(100),
	"affected_line_items" jsonb,
	"error_details" jsonb,
	"stack_trace" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar,
	"resolution_notes" text,
	"retryable" boolean DEFAULT true,
	"retry_count" integer DEFAULT 0,
	"next_retry_at" timestamp with time zone,
	"notification_sent" boolean DEFAULT false,
	"notified_users" jsonb,
	"custom_fields" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manufacturer_order_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"product_code" varchar(100) NOT NULL,
	"manufacturer_part_number" varchar(100),
	"description" text NOT NULL,
	"quantity_ordered" integer NOT NULL,
	"quantity_shipped" integer DEFAULT 0,
	"quantity_delivered" integer DEFAULT 0,
	"quantity_cancelled" integer DEFAULT 0,
	"quantity_backordered" integer DEFAULT 0,
	"unit_price" numeric(12, 2) NOT NULL,
	"list_price" numeric(12, 2),
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"line_total" numeric(12, 2) NOT NULL,
	"uom" varchar(20) DEFAULT 'EA',
	"weight" numeric(10, 2),
	"weight_unit" varchar(10),
	"requested_ship_date" timestamp with time zone,
	"estimated_ship_date" timestamp with time zone,
	"actual_ship_date" timestamp with time zone,
	"inventory_item_id" varchar,
	"product_id" varchar,
	"line_status" varchar(50) DEFAULT 'pending',
	"backorder_date" timestamp with time zone,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manufacturer_order_shipments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"shipment_number" varchar(100),
	"tracking_number" varchar(100),
	"carrier" varchar(100),
	"carrier_service" varchar(100),
	"shipment_status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"shipped_date" timestamp with time zone,
	"estimated_delivery_date" timestamp with time zone,
	"actual_delivery_date" timestamp with time zone,
	"package_count" integer DEFAULT 1,
	"total_weight" numeric(10, 2),
	"weight_unit" varchar(10),
	"line_items_shipped" jsonb,
	"tracking_url" text,
	"tracking_events" jsonb,
	"last_tracking_update" timestamp with time zone,
	"delivered_to" varchar(255),
	"signature_required" boolean DEFAULT false,
	"signature_name" varchar(255),
	"signature_timestamp" timestamp with time zone,
	"shipping_cost" numeric(12, 2),
	"insurance_amount" numeric(12, 2),
	"special_instructions" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manufacturer_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"connection_id" varchar NOT NULL,
	"purchase_order_id" varchar,
	"order_number" varchar(100) NOT NULL,
	"manufacturer_order_number" varchar(100),
	"reference_number" varchar(100),
	"order_status" "manufacturer_order_status" DEFAULT 'draft' NOT NULL,
	"order_method" "order_method" NOT NULL,
	"order_date" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"shipping_cost" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"ship_to_name" varchar(255),
	"ship_to_address" text,
	"ship_to_city" varchar(100),
	"ship_to_state" varchar(50),
	"ship_to_zip" varchar(20),
	"ship_to_country" varchar(100),
	"shipping_method" varchar(100),
	"requested_delivery_date" timestamp with time zone,
	"estimated_delivery_date" timestamp with time zone,
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"tracking_numbers" jsonb,
	"carrier_info" jsonb,
	"shipment_count" integer DEFAULT 0,
	"total_quantity_ordered" integer DEFAULT 0,
	"total_quantity_shipped" integer DEFAULT 0,
	"total_quantity_delivered" integer DEFAULT 0,
	"total_quantity_cancelled" integer DEFAULT 0,
	"auto_submitted" boolean DEFAULT false,
	"retry_count" integer DEFAULT 0,
	"last_retry_at" timestamp with time zone,
	"submission_payload" jsonb,
	"submission_response" jsonb,
	"last_polled_at" timestamp with time zone,
	"special_instructions" text,
	"internal_notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "master_product_accessories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer" varchar NOT NULL,
	"accessory_code" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"specs_json" jsonb,
	"msrp" numeric(10, 2),
	"category" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"discontinued_at" timestamp,
	"version" varchar DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "master_product_accessory_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_product_id" varchar NOT NULL,
	"accessory_id" varchar NOT NULL,
	"relationship_type" varchar DEFAULT 'compatible' NOT NULL,
	"category" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "master_product_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer" varchar NOT NULL,
	"model_code" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"specs_json" jsonb,
	"msrp" numeric(10, 2),
	"dealer_cost" numeric(10, 2),
	"margin_percentage" numeric(5, 2),
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric(10, 2),
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric(10, 2),
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric(10, 2),
	"status" varchar DEFAULT 'active' NOT NULL,
	"discontinued_at" timestamp,
	"version" varchar DEFAULT '1.0' NOT NULL,
	"category" varchar,
	"product_type" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meter_anomalies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"meter_reading_id" varchar NOT NULL,
	"equipment_id" varchar NOT NULL,
	"contract_id" varchar,
	"customer_id" varchar,
	"anomaly_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"detection_method" varchar NOT NULL,
	"current_bw_reading" integer,
	"current_color_reading" integer,
	"previous_bw_reading" integer,
	"previous_color_reading" integer,
	"expected_bw_reading" integer,
	"expected_color_reading" integer,
	"bw_deviation" integer,
	"color_deviation" integer,
	"bw_deviation_percent" numeric(5, 2),
	"color_deviation_percent" numeric(5, 2),
	"anomaly_description" text,
	"suggested_action" text,
	"requires_review" boolean DEFAULT true,
	"reviewed" boolean DEFAULT false,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"review_notes" text,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolution_method" varchar,
	"resolution_notes" text,
	"corrected_bw_reading" integer,
	"corrected_color_reading" integer,
	"auto_notification_sent" boolean DEFAULT false,
	"notified_users" jsonb,
	"impact_on_billing" boolean DEFAULT false,
	"affected_invoice_ids" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_reading_id" varchar,
	"external_equipment_id" varchar,
	"last_sync_date" timestamp,
	"equipment_id" varchar NOT NULL,
	"contract_id" varchar,
	"reading_date" timestamp NOT NULL,
	"bw_meter_reading" integer,
	"color_meter_reading" integer,
	"scan_meter_reading" integer,
	"fax_meter_reading" integer,
	"large_paper_meter_reading" integer,
	"previous_black_meter" integer DEFAULT 0,
	"previous_color_meter" integer DEFAULT 0,
	"black_copies" integer DEFAULT 0,
	"color_copies" integer DEFAULT 0,
	"reading_method" varchar DEFAULT 'manual',
	"collection_method" varchar DEFAULT 'manual',
	"dca_device_id" varchar,
	"dca_last_sync" timestamp,
	"dca_error" text,
	"email_source" varchar,
	"email_subject" varchar,
	"email_timestamp" timestamp,
	"api_source" varchar,
	"api_response_id" varchar,
	"technician_id" varchar,
	"is_verified" boolean DEFAULT false,
	"verified_by" varchar,
	"verified_at" timestamp,
	"has_exception" boolean DEFAULT false,
	"exception_reason" varchar,
	"exception_notes" text,
	"adjustment_amount" numeric(10, 2) DEFAULT '0',
	"billing_period" varchar,
	"billing_status" varchar DEFAULT 'pending',
	"invoice_number" varchar,
	"invoice_id" varchar,
	"billing_amount" numeric(10, 2),
	"reading_notes" text,
	"notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mfa_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar,
	"event_type" varchar NOT NULL,
	"event_details" jsonb,
	"ip_address" varchar,
	"user_agent" varchar,
	"device_info" jsonb,
	"success" boolean DEFAULT true NOT NULL,
	"failure_reason" varchar,
	"performed_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mfa_backup_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar,
	"code_hash" varchar NOT NULL,
	"is_used" boolean DEFAULT false,
	"used_at" timestamp,
	"used_ip_address" varchar,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mobile_service_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"check_in_latitude" numeric(10, 7),
	"check_in_longitude" numeric(10, 7),
	"check_in_address" text,
	"check_in_timestamp" timestamp,
	"check_out_latitude" numeric(10, 7),
	"check_out_longitude" numeric(10, 7),
	"check_out_address" text,
	"check_out_timestamp" timestamp,
	"total_hours" numeric(4, 2),
	"break_hours" numeric(4, 2),
	"working_hours" numeric(4, 2),
	"status" "field_service_status" DEFAULT 'scheduled',
	"service_notes" text,
	"customer_signature" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monitored_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"serial_number" text NOT NULL,
	"ip_address" text NOT NULL,
	"hostname" text,
	"device_name" text,
	"manufacturer" text,
	"model" text,
	"protocol" text NOT NULL,
	"snmp_version" text,
	"snmp_community" text,
	"snmp_port" integer DEFAULT 161,
	"snmp_username" text,
	"snmp_auth_protocol" text,
	"snmp_auth_password" text,
	"snmp_priv_protocol" text,
	"snmp_priv_password" text,
	"http_port" integer,
	"http_username" text,
	"http_password" text,
	"custom_oids" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"polling_interval" integer DEFAULT 300,
	"toner_alert_threshold" integer DEFAULT 15,
	"paper_alert_threshold" integer DEFAULT 20,
	"last_seen" timestamp,
	"last_successful_collection" timestamp,
	"consecutive_failures" integer DEFAULT 0,
	"discovered_at" timestamp,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offboarding_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lifecycle_event_id" uuid,
	"initiated_by" uuid NOT NULL,
	"reason" varchar(255) NOT NULL,
	"last_working_day" timestamp NOT NULL,
	"transfer_ownership_to" uuid,
	"records_transferred" integer,
	"transfer_details" jsonb,
	"data_exported" boolean DEFAULT false,
	"data_export_path" varchar(500),
	"data_export_size_bytes" integer,
	"data_exported_at" timestamp,
	"access_revoked" boolean DEFAULT false,
	"access_revoked_at" timestamp,
	"roles_revoked" jsonb,
	"integrations_revoked" jsonb,
	"sessions_terminated" integer,
	"equipment_returned" boolean DEFAULT false,
	"equipment_list" jsonb,
	"exit_interview_completed" boolean DEFAULT false,
	"exit_interview_notes" text,
	"exit_interview_date" timestamp,
	"notifications_sent" jsonb,
	"compliance_checklist" jsonb,
	"audit_report_generated" boolean DEFAULT false,
	"audit_report_path" varchar(500),
	"status" "lifecycle_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oid_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"manufacturer" text NOT NULL,
	"model_series" text,
	"mapping_name" text NOT NULL,
	"oids" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_custom" boolean DEFAULT false,
	"created_by" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" varchar(50) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"onboardings_started" integer DEFAULT 0,
	"onboardings_completed" integer DEFAULT 0,
	"onboardings_abandoned" integer DEFAULT 0,
	"onboardings_failed" integer DEFAULT 0,
	"completion_rate_percent" integer,
	"avg_completion_time_minutes" integer,
	"median_completion_time_minutes" integer,
	"template_usage" jsonb,
	"step_metrics" jsonb,
	"common_bottlenecks" jsonb,
	"integration_setup_metrics" jsonb,
	"data_import_metrics" jsonb,
	"health_score_distribution" jsonb,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lifecycle_event_id" uuid,
	"items" jsonb NOT NULL,
	"total_items" integer NOT NULL,
	"completed_items" integer DEFAULT 0,
	"progress_percent" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"target_completion_date" timestamp,
	"completed_at" timestamp,
	"check_ins" jsonb,
	"next_check_in" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_dynamic_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"section_title" varchar NOT NULL,
	"section_description" text,
	"section_order" integer DEFAULT 0,
	"section_type" varchar NOT NULL,
	"fields_config" jsonb,
	"form_data" jsonb,
	"is_required" boolean DEFAULT false,
	"is_completed" boolean DEFAULT false,
	"completed_by" varchar,
	"completed_at" timestamp,
	"notes" text,
	"attachments" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"equipment_id" varchar,
	"manufacturer" varchar NOT NULL,
	"model" varchar NOT NULL,
	"serial_number" varchar,
	"asset_tag" varchar,
	"target_ip_address" varchar,
	"hostname" varchar,
	"mac_address" varchar,
	"network_assignment" "network_assignment",
	"building_location" varchar,
	"room_location" varchar,
	"specific_location" text,
	"is_replacement" boolean DEFAULT false,
	"old_equipment_data" jsonb,
	"is_installed" boolean DEFAULT false,
	"install_date" timestamp,
	"install_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_network_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"equipment_id" varchar,
	"ip_address" varchar,
	"subnet_mask" varchar,
	"gateway" varchar,
	"dns_servers" text[],
	"vlan_id" integer,
	"switch_port" varchar,
	"switch_location" varchar,
	"domain_name" varchar,
	"hostname_convention" varchar,
	"dns_update_required" boolean DEFAULT false,
	"firewall_rules" jsonb,
	"qos_settings" jsonb,
	"is_configured" boolean DEFAULT false,
	"configuration_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_print_management" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"equipment_id" varchar,
	"system" "print_management_system" NOT NULL,
	"system_version" varchar,
	"server_address" varchar,
	"queue_name" varchar,
	"cost_center" varchar,
	"location_code" varchar,
	"device_type" varchar,
	"authorized_groups" text[],
	"print_quotas" jsonb,
	"print_restrictions" jsonb,
	"account_codes_required" boolean DEFAULT false,
	"valid_account_codes" text[],
	"default_account_code" varchar,
	"is_configured" boolean DEFAULT false,
	"configuration_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"flow_type" varchar(50) NOT NULL,
	"current_step" varchar(50),
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"is_complete" boolean DEFAULT false,
	"completed_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"section_id" varchar,
	"task_title" varchar NOT NULL,
	"task_description" text,
	"task_type" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium',
	"assigned_to" varchar,
	"assigned_team" varchar,
	"estimated_hours" numeric(4, 2),
	"due_date" timestamp,
	"scheduled_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"depends_on" text[],
	"blocked_by" text[],
	"status" varchar DEFAULT 'pending',
	"progress_notes" text,
	"completion_notes" text,
	"attachments" text[],
	"verified_by" varchar,
	"verification_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_opportunity_id" varchar,
	"external_account_id" varchar,
	"migration_status" varchar,
	"last_sync_date" timestamp,
	"opportunity_name" varchar NOT NULL,
	"account_id" varchar,
	"account_name" varchar,
	"stage_name" varchar NOT NULL,
	"amount" numeric(15, 2),
	"probability" integer DEFAULT 50,
	"close_date" timestamp,
	"opportunity_type" varchar,
	"lead_source" varchar,
	"campaign_id" varchar,
	"is_won" boolean DEFAULT false,
	"is_closed" boolean DEFAULT false,
	"is_private" boolean DEFAULT false,
	"owner_id" varchar,
	"owner_name" varchar,
	"description" text,
	"next_step" text,
	"forecast_category" varchar,
	"expected_revenue" numeric(15, 2),
	"total_quantity" numeric(10, 2),
	"has_line_items" boolean DEFAULT false,
	"price_book_id" varchar,
	"main_competitors" text,
	"delivery_status" varchar,
	"tracking_number" varchar,
	"order_number" varchar,
	"current_situation" text,
	"product_type" varchar,
	"financing_type" varchar,
	"monthly_payment" numeric(10, 2),
	"lease_term_months" integer,
	"commission_rate" numeric(5, 4),
	"gross_margin_percent" numeric(5, 2),
	"territory" varchar,
	"partner_account_id" varchar,
	"last_activity_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizational_units" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"parent_unit_id" varchar,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"unit_type" "organizational_tier" NOT NULL,
	"description" text,
	"lft" integer NOT NULL,
	"rght" integer NOT NULL,
	"depth" integer NOT NULL,
	"address" text,
	"city" varchar(100),
	"state" varchar(2),
	"zip_code" varchar(10),
	"phone" varchar(20),
	"email" varchar(255),
	"manager_id" varchar,
	"is_active" boolean DEFAULT true,
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "parsing_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email_id" text NOT NULL,
	"ai_parsed_data" jsonb NOT NULL,
	"corrected_data" jsonb NOT NULL,
	"correction_reason" text,
	"corrected_by" text NOT NULL,
	"corrected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"part_number" varchar(100) NOT NULL,
	"part_name" varchar(255) NOT NULL,
	"part_description" text,
	"quantity_ordered" integer NOT NULL,
	"quantity_received" integer DEFAULT 0,
	"quantity_backordered" integer DEFAULT 0,
	"unit_price" numeric(10, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"line_total" numeric(10, 2) NOT NULL,
	"item_status" "parts_order_status" DEFAULT 'pending' NOT NULL,
	"expected_date" timestamp,
	"received_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"service_ticket_id" uuid NOT NULL,
	"order_number" varchar(100) NOT NULL,
	"vendor_id" uuid,
	"vendor_name" varchar(255) NOT NULL,
	"status" "parts_order_status" DEFAULT 'pending' NOT NULL,
	"order_date" timestamp NOT NULL,
	"expected_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0',
	"shipping" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"rush_order" boolean DEFAULT false,
	"special_instructions" text,
	"delivery_address" text,
	"tracking_number" varchar(100),
	"follow_up_ticket_id" uuid,
	"installation_scheduled" boolean DEFAULT false,
	"installation_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"payment_method_name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"payment_method_type" varchar(50),
	"external_payment_method_id" varchar,
	"qb_domain" varchar,
	"is_sparse" boolean DEFAULT false,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"term_name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"term_type" varchar(50),
	"due_days" integer,
	"discount_percent" numeric(5, 4),
	"discount_days" integer,
	"day_of_month_due" integer,
	"due_next_month_days" integer,
	"discount_day_of_month" integer,
	"external_term_id" varchar,
	"qb_domain" varchar,
	"is_sparse" boolean DEFAULT false,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"metric_type" varchar NOT NULL,
	"value" numeric(10, 4) NOT NULL,
	"unit" varchar NOT NULL,
	"endpoint" varchar,
	"timestamp" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "permission_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organizational_context" varchar NOT NULL,
	"effective_permissions" jsonb NOT NULL,
	"permission_hash" varchar(64) NOT NULL,
	"computed_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"cache_version" integer DEFAULT 1,
	"computation_time" integer,
	"cache_hits" integer DEFAULT 0,
	"tenant_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"effect" "permission_effect" NOT NULL,
	"override_reason" text NOT NULL,
	"business_justification" text NOT NULL,
	"requested_by" varchar NOT NULL,
	"approved_by" varchar,
	"approval_date" timestamp,
	"effective_from" timestamp DEFAULT now(),
	"effective_until" timestamp,
	"tenant_id" varchar NOT NULL,
	"organizational_unit_id" varchar,
	"requires_review" boolean DEFAULT true,
	"next_review_date" timestamp,
	"last_review_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"module" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"scope_level" varchar(50) NOT NULL,
	"requires_approval" boolean DEFAULT false,
	"requires_mfa" boolean DEFAULT false,
	"risk_level" varchar(20) DEFAULT 'low',
	"compliance_level" varchar(20) DEFAULT 'standard',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_name_unique" UNIQUE("name"),
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "phone_in_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"caller_name" varchar NOT NULL,
	"caller_phone" varchar NOT NULL,
	"caller_email" varchar,
	"caller_role" varchar,
	"customer_id" varchar,
	"customer_name" varchar NOT NULL,
	"location_address" text NOT NULL,
	"location_building" varchar,
	"location_floor" varchar,
	"location_room" varchar,
	"equipment_id" varchar,
	"equipment_brand" varchar,
	"equipment_model" varchar,
	"equipment_serial" varchar,
	"issue_category" "issue_category" NOT NULL,
	"issue_description" text NOT NULL,
	"urgency_level" "ticket_priority" NOT NULL,
	"troubleshooting_attempted" text,
	"error_codes" jsonb DEFAULT '[]'::jsonb,
	"business_impact" text,
	"affected_users" integer,
	"preferred_service_time" varchar,
	"contact_method" "contact_method" NOT NULL,
	"special_instructions" text,
	"handled_by" varchar NOT NULL,
	"call_duration_minutes" integer,
	"converted_to_ticket_id" varchar,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pipeline_automation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"stage_id" varchar,
	"trigger_type" varchar(50) NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_config" jsonb,
	"status" varchar(50) NOT NULL,
	"executed_at" timestamp DEFAULT now(),
	"error_message" text,
	"result_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"pipeline_template_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#3B82F6',
	"icon" varchar(50),
	"order" integer NOT NULL,
	"is_final_stage" boolean DEFAULT false,
	"is_closed_won" boolean DEFAULT false,
	"is_closed_lost" boolean DEFAULT false,
	"required_fields" jsonb,
	"sla_enabled" boolean DEFAULT false,
	"sla_days" integer,
	"sla_hours" integer,
	"sla_escalation_enabled" boolean DEFAULT false,
	"sla_escalate_to" varchar,
	"automation_triggers" jsonb,
	"default_probability" integer DEFAULT 50,
	"include_in_forecast" boolean DEFAULT true,
	"weighted_value" boolean DEFAULT true,
	"best_practices" text,
	"action_required" text,
	"exit_criteria" text,
	"average_days_in_stage" numeric(8, 2),
	"conversion_rate" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pipeline_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"pipeline_type" "pipeline_type" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"deal_id" varchar,
	"contact_id" varchar,
	"activity_type" "platform_activity_type" NOT NULL,
	"subject" varchar(255) NOT NULL,
	"description" text,
	"activity_date" timestamp DEFAULT now() NOT NULL,
	"call_duration_minutes" integer,
	"call_outcome" varchar(50),
	"call_recording_url" varchar,
	"call_disposition" varchar(100),
	"email_from" varchar(255),
	"email_to" varchar(255),
	"email_cc" varchar,
	"email_subject" varchar(255),
	"email_body" text,
	"email_opened" boolean DEFAULT false,
	"email_clicked" boolean DEFAULT false,
	"email_replied" boolean DEFAULT false,
	"meeting_date" timestamp,
	"meeting_duration_minutes" integer,
	"meeting_type" varchar(50),
	"meeting_location" varchar,
	"meeting_attendees" jsonb DEFAULT '[]'::jsonb,
	"meeting_notes" text,
	"meeting_outcome" varchar(100),
	"demo_type" varchar(50),
	"features_shown" jsonb DEFAULT '[]'::jsonb,
	"demo_feedback" text,
	"task_due_date" timestamp,
	"task_completed" boolean DEFAULT false,
	"task_completed_at" timestamp,
	"task_priority" varchar(20),
	"sentiment" varchar(20),
	"sentiment_score" numeric(5, 4),
	"related_records" jsonb DEFAULT '{}'::jsonb,
	"outcome" varchar(100),
	"next_steps" text,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_activity_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" varchar(20) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"user_id" varchar,
	"team_id" varchar,
	"total_calls" integer DEFAULT 0,
	"connected_calls" integer DEFAULT 0,
	"total_emails" integer DEFAULT 0,
	"email_replies" integer DEFAULT 0,
	"total_meetings" integer DEFAULT 0,
	"meetings_held" integer DEFAULT 0,
	"total_demos" integer DEFAULT 0,
	"demos_completed" integer DEFAULT 0,
	"new_prospects" integer DEFAULT 0,
	"qualified_prospects" integer DEFAULT 0,
	"new_deals" integer DEFAULT 0,
	"deals_won" integer DEFAULT 0,
	"deals_lost" integer DEFAULT 0,
	"deals_in_progress" integer DEFAULT 0,
	"total_arr_booked" numeric(12, 2) DEFAULT '0',
	"average_deal_size" numeric(12, 2),
	"pipeline_value" numeric(12, 2) DEFAULT '0',
	"call_connect_rate" numeric(5, 2),
	"email_reply_rate" numeric(5, 2),
	"meeting_show_rate" numeric(5, 2),
	"demo_to_trial_rate" numeric(5, 2),
	"trial_to_customer_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_activity_reports_user_period_idx" UNIQUE("user_id","period","period_start")
);
--> statement-breakpoint
CREATE TABLE "platform_bant_qualification" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"deal_id" varchar,
	"budget_identified" boolean DEFAULT false,
	"budget_amount" numeric(12, 2),
	"budget_timeframe" varchar(50),
	"budget_approved" boolean DEFAULT false,
	"budget_score" integer DEFAULT 0,
	"budget_notes" text,
	"decision_maker_identified" boolean DEFAULT false,
	"decision_maker_name" varchar(255),
	"decision_maker_title" varchar(100),
	"decision_maker_contact_id" varchar,
	"decision_process" text,
	"influencers_identified" jsonb DEFAULT '[]'::jsonb,
	"authority_score" integer DEFAULT 0,
	"authority_notes" text,
	"need_identified" boolean DEFAULT false,
	"need_type" varchar(100),
	"need_urgency" varchar(20),
	"need_description" text,
	"pain_points" jsonb DEFAULT '[]'::jsonb,
	"current_solution" text,
	"need_score" integer DEFAULT 0,
	"need_notes" text,
	"timeline_identified" boolean DEFAULT false,
	"expected_decision_date" timestamp,
	"expected_implementation_date" timestamp,
	"decision_timeline" varchar(50),
	"implementation_timeline" varchar(50),
	"blockers" jsonb DEFAULT '[]'::jsonb,
	"timeline_score" integer DEFAULT 0,
	"timeline_notes" text,
	"total_bant_score" integer DEFAULT 0,
	"qualification_status" varchar(50),
	"qualified_date" timestamp,
	"disqualified_date" timestamp,
	"disqualified_reason" text,
	"competitors_evaluating" jsonb DEFAULT '[]'::jsonb,
	"our_advantages" text,
	"competitor_advantages" text,
	"assessed_by" varchar,
	"last_assessed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_bant_qualification_business_record_id_unique" UNIQUE("business_record_id")
);
--> statement-breakpoint
CREATE TABLE "platform_business_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "platform_record_type" DEFAULT 'prospect' NOT NULL,
	"status" "platform_record_status" DEFAULT 'new' NOT NULL,
	"previous_status" "platform_record_status",
	"company_name" varchar(255) NOT NULL,
	"company_display_id" varchar(20),
	"website" varchar(255),
	"industry" varchar(100),
	"company_size" varchar(50),
	"employee_count" integer,
	"annual_revenue" numeric(15, 2),
	"primary_contact_name" varchar(255),
	"primary_contact_email" varchar(255),
	"primary_contact_phone" varchar(20),
	"primary_contact_title" varchar(100),
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"city" varchar(100),
	"state" varchar(50),
	"postal_code" varchar(20),
	"country" varchar(100) DEFAULT 'USA',
	"timezone" varchar(50),
	"lead_source" varchar(100),
	"lead_score" integer DEFAULT 0,
	"lead_grade" "platform_lead_grade",
	"lead_tier" "platform_lead_tier",
	"qualification_score" integer DEFAULT 0,
	"utm_source" varchar(100),
	"utm_campaign" varchar(100),
	"utm_medium" varchar(100),
	"utm_content" varchar(255),
	"utm_term" varchar(100),
	"product_interest" jsonb DEFAULT '[]'::jsonb,
	"pain_points" jsonb DEFAULT '[]'::jsonb,
	"competitor_info" text,
	"sales_stage" varchar(50),
	"estimated_value" numeric(12, 2),
	"probability" integer,
	"expected_close_date" timestamp,
	"assigned_sales_rep" varchar,
	"assigned_csm" varchar,
	"territory" varchar(100),
	"tenant_id" varchar,
	"primary_user_id" varchar,
	"trial_plan_selected" varchar(50),
	"trial_started_at" timestamp,
	"trial_end_date" timestamp,
	"trial_status" varchar(20),
	"customer_since" timestamp,
	"current_mrr" numeric(10, 2),
	"current_arr" numeric(12, 2),
	"lifetime_value" numeric(12, 2),
	"contract_start_date" timestamp,
	"contract_end_date" timestamp,
	"renewal_date" timestamp,
	"auto_renew" boolean DEFAULT false,
	"churn_risk" "platform_churn_risk",
	"churn_probability" numeric(5, 4),
	"churned_at" timestamp,
	"churn_reason" text,
	"winback_eligible" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"demos_requested" integer DEFAULT 0,
	"demos_completed" integer DEFAULT 0,
	"last_engagement_date" timestamp,
	"engagement_score" integer DEFAULT 0,
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"total_activities" integer DEFAULT 0,
	"total_calls" integer DEFAULT 0,
	"total_emails" integer DEFAULT 0,
	"total_meetings" integer DEFAULT 0,
	"nps_score" integer,
	"csat_score" numeric(3, 2),
	"last_survey_date" timestamp,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"internal_notes" text,
	"priority" varchar(20) DEFAULT 'medium',
	"is_strategic" boolean DEFAULT false,
	"requires_approval" boolean DEFAULT false,
	"converted_from_prospect_at" timestamp,
	"converted_by" varchar,
	"conversion_source" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "platform_business_records_company_display_id_unique" UNIQUE("company_display_id")
);
--> statement-breakpoint
CREATE TABLE "platform_churn_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"tenant_id" varchar,
	"churn_risk" "platform_churn_risk" NOT NULL,
	"churn_probability" numeric(5, 4) NOT NULL,
	"confidence_level" numeric(5, 4),
	"predicted_churn_date" timestamp,
	"days_until_churn" integer,
	"contract_end_date" timestamp,
	"days_until_renewal" integer,
	"primary_risk_factors" jsonb DEFAULT '[]'::jsonb,
	"secondary_risk_factors" jsonb DEFAULT '[]'::jsonb,
	"model_version" varchar(50),
	"model_type" varchar(50),
	"feature_importance" jsonb DEFAULT '{}'::jsonb,
	"estimated_mrr" numeric(10, 2),
	"estimated_arr" numeric(12, 2),
	"estimated_ltv" numeric(12, 2),
	"retention_cost" numeric(10, 2),
	"intervention_required" boolean DEFAULT false,
	"intervention_triggered" boolean DEFAULT false,
	"intervention_id" varchar,
	"predicted_at" timestamp DEFAULT now(),
	"predicted_by" varchar,
	"next_prediction" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_cohort_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_name" varchar(255) NOT NULL,
	"cohort_period" varchar(20),
	"cohort_date" timestamp NOT NULL,
	"initial_size" integer NOT NULL,
	"current_size" integer NOT NULL,
	"retention_rate" numeric(5, 2),
	"initial_mrr" numeric(12, 2),
	"current_mrr" numeric(12, 2),
	"cumulative_revenue" numeric(15, 2),
	"average_ltv" numeric(12, 2),
	"average_cac" numeric(10, 2),
	"ltv_to_cac_ratio" numeric(5, 2),
	"churned_count" integer DEFAULT 0,
	"churn_rate" numeric(5, 2),
	"average_tenure_months" numeric(5, 2),
	"expanded_count" integer DEFAULT 0,
	"expansion_mrr" numeric(12, 2),
	"net_revenue_retention" numeric(5, 2),
	"lead_source" jsonb DEFAULT '{}'::jsonb,
	"industry_breakdown" jsonb DEFAULT '{}'::jsonb,
	"company_size_breakdown" jsonb DEFAULT '{}'::jsonb,
	"calculated_at" timestamp DEFAULT now(),
	"periods_covered" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"mobile_phone" varchar(20),
	"title" varchar(100),
	"department" varchar(100),
	"role" varchar(50),
	"reports_to_id" varchar,
	"is_decision_maker" boolean DEFAULT false,
	"is_primary_contact" boolean DEFAULT false,
	"email_opt_in" boolean DEFAULT true,
	"phone_opt_in" boolean DEFAULT true,
	"preferred_contact_method" varchar(20),
	"linkedin_url" varchar(255),
	"twitter_handle" varchar(100),
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"emails_received" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"deal_name" varchar(255) NOT NULL,
	"description" text,
	"deal_type" varchar(50),
	"stage" "platform_deal_stage" DEFAULT 'prospecting' NOT NULL,
	"previous_stage" "platform_deal_stage",
	"status" varchar(20) DEFAULT 'open',
	"deal_value" numeric(12, 2) NOT NULL,
	"estimated_mrr" numeric(10, 2),
	"probability" integer NOT NULL,
	"weighted_value" numeric(12, 2),
	"expected_close_date" timestamp,
	"actual_close_date" timestamp,
	"plan_interested" varchar(50),
	"billing_cycle" varchar(20),
	"seats_requested" integer,
	"owner_id" varchar NOT NULL,
	"assigned_csm" varchar,
	"budget_confirmed" boolean DEFAULT false,
	"authority_confirmed" boolean DEFAULT false,
	"need_confirmed" boolean DEFAULT false,
	"timeline_confirmed" boolean DEFAULT false,
	"bant_score" integer DEFAULT 0,
	"proposal_sent" boolean DEFAULT false,
	"proposal_sent_at" timestamp,
	"contract_sent" boolean DEFAULT false,
	"contract_sent_at" timestamp,
	"demo_completed" boolean DEFAULT false,
	"demo_completed_at" timestamp,
	"competitor_info" text,
	"competitors_identified" jsonb DEFAULT '[]'::jsonb,
	"lost_reason" text,
	"lost_to_competitor" varchar(100),
	"win_reason" text,
	"commission_amount" numeric(10, 2),
	"commission_paid" boolean DEFAULT false,
	"forecast_category" varchar(20),
	"last_activity_date" timestamp,
	"next_activity_date" timestamp,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"internal_notes" text,
	"priority" varchar(20) DEFAULT 'medium',
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_health_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"tenant_id" varchar,
	"overall_score" integer NOT NULL,
	"health_status" "platform_health_status" NOT NULL,
	"trend" varchar(20),
	"usage_score" integer DEFAULT 0,
	"engagement_score" integer DEFAULT 0,
	"adoption_score" integer DEFAULT 0,
	"support_score" integer DEFAULT 0,
	"payment_score" integer DEFAULT 0,
	"satisfaction_score" integer DEFAULT 0,
	"days_since_last_login" integer,
	"active_users_percent" integer,
	"features_adopted" integer,
	"total_features" integer,
	"open_support_tickets" integer DEFAULT 0,
	"avg_ticket_resolution_days" numeric(5, 2),
	"overdue_invoices" integer DEFAULT 0,
	"days_since_last_payment" integer,
	"nps_score" integer,
	"csat_score" numeric(3, 2),
	"last_survey_date" timestamp,
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"strength_factors" jsonb DEFAULT '[]'::jsonb,
	"recommendations" jsonb DEFAULT '[]'::jsonb,
	"calculated_at" timestamp DEFAULT now(),
	"calculated_by" varchar,
	"next_calculation_due" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_health_scores_business_record_id_unique" UNIQUE("business_record_id")
);
--> statement-breakpoint
CREATE TABLE "platform_lead_assignment_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"assigned_from" varchar,
	"assigned_to" varchar NOT NULL,
	"assignment_reason" varchar(100),
	"rule_id" varchar,
	"first_response_at" timestamp,
	"first_response_time_minutes" integer,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"assigned_by" varchar,
	"notes" text,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_lead_assignment_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0,
	"assignment_type" varchar(50),
	"lead_source" jsonb DEFAULT '[]'::jsonb,
	"lead_score_min" integer,
	"lead_score_max" integer,
	"industries" jsonb DEFAULT '[]'::jsonb,
	"company_size" jsonb DEFAULT '[]'::jsonb,
	"deal_size_min" numeric(12, 2),
	"deal_size_max" numeric(12, 2),
	"geography" jsonb DEFAULT '{}'::jsonb,
	"round_robin_users" jsonb DEFAULT '[]'::jsonb,
	"current_index" integer DEFAULT 0,
	"skip_unavailable" boolean DEFAULT true,
	"respect_capacity" boolean DEFAULT true,
	"assign_to_territory_id" varchar,
	"assign_to_user_id" varchar,
	"max_leads_per_rep" integer,
	"max_leads_per_day" integer,
	"assign_immediately" boolean DEFAULT true,
	"delay_minutes" integer DEFAULT 0,
	"business_hours_only" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "platform_lead_score_calculations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"demographic_score" integer DEFAULT 0,
	"firmographic_score" integer DEFAULT 0,
	"behavioral_score" integer DEFAULT 0,
	"engagement_score" integer DEFAULT 0,
	"bant_score" integer DEFAULT 0,
	"total_score" integer DEFAULT 0 NOT NULL,
	"lead_grade" "platform_lead_grade" DEFAULT 'F' NOT NULL,
	"lead_tier" "platform_lead_tier" DEFAULT 'cold' NOT NULL,
	"ml_prediction_score" numeric(5, 4),
	"conversion_probability" numeric(5, 4),
	"estimated_time_to_conversion_days" integer,
	"confidence_level" numeric(5, 4),
	"model_version" varchar(50),
	"recommended_action" varchar(50),
	"recommended_next_steps" jsonb DEFAULT '[]'::jsonb,
	"factors_considered" integer DEFAULT 0,
	"rules_applied" jsonb DEFAULT '[]'::jsonb,
	"calculated_at" timestamp DEFAULT now(),
	"next_calculation" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_lead_score_calculations_business_record_id_unique" UNIQUE("business_record_id")
);
--> statement-breakpoint
CREATE TABLE "platform_lead_scoring_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"field_name" varchar(100) NOT NULL,
	"operator" varchar(20) NOT NULL,
	"value" jsonb NOT NULL,
	"points" integer NOT NULL,
	"max_points" integer,
	"priority" integer DEFAULT 0,
	"weight" numeric(5, 2) DEFAULT '1.0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "platform_renewal_opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"tenant_id" varchar,
	"renewal_type" varchar(50),
	"renewal_status" varchar(50),
	"renewal_probability" numeric(5, 4),
	"contract_end_date" timestamp NOT NULL,
	"days_until_renewal" integer,
	"outreach_start_date" timestamp,
	"target_close_date" timestamp,
	"actual_renewal_date" timestamp,
	"current_mrr" numeric(10, 2),
	"projected_mrr" numeric(10, 2),
	"mrr_change" numeric(10, 2),
	"mrr_change_percent" numeric(5, 2),
	"current_contract_value" numeric(12, 2),
	"projected_contract_value" numeric(12, 2),
	"expansion_potential" varchar(50),
	"suggested_add_ons" jsonb DEFAULT '[]'::jsonb,
	"suggested_upgrades" jsonb DEFAULT '[]'::jsonb,
	"estimated_expansion_value" numeric(12, 2),
	"renewal_risk" "platform_churn_risk",
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"strength_factors" jsonb DEFAULT '[]'::jsonb,
	"assigned_csm" varchar,
	"assigned_sales_rep" varchar,
	"last_contact_date" timestamp,
	"next_contact_date" timestamp,
	"contact_frequency" varchar(50),
	"action_plan" text,
	"internal_notes" text,
	"competitor_threats" text,
	"outcome_notes" text,
	"lost_reason" text,
	"win_reason" text,
	"related_health_score_id" varchar,
	"related_churn_prediction_id" varchar,
	"quote_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_rep_capacity" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"max_active_prospects" integer DEFAULT 50,
	"max_new_prospects_per_day" integer DEFAULT 5,
	"max_new_prospects_per_week" integer DEFAULT 20,
	"current_active_prospects" integer DEFAULT 0,
	"prospects_assigned_today" integer DEFAULT 0,
	"prospects_assigned_this_week" integer DEFAULT 0,
	"is_available" boolean DEFAULT true,
	"unavailable_reason" varchar(100),
	"unavailable_until" timestamp,
	"skills" jsonb DEFAULT '[]'::jsonb,
	"specializations" jsonb DEFAULT '[]'::jsonb,
	"average_response_time_minutes" integer,
	"conversion_rate" numeric(5, 2),
	"average_deal_size" numeric(12, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_reset_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_rep_capacity_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "platform_sales_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_name" varchar(255) NOT NULL,
	"goal_type" varchar(50) NOT NULL,
	"metric_type" varchar(50),
	"target_value" numeric(15, 2) NOT NULL,
	"current_value" numeric(15, 2) DEFAULT '0',
	"achievement_percent" integer DEFAULT 0,
	"period" varchar(20) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"assigned_to_user_id" varchar,
	"assigned_to_team_id" varchar,
	"territory" varchar,
	"is_active" boolean DEFAULT true,
	"is_achieved" boolean DEFAULT false,
	"achieved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_sales_territories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20),
	"description" text,
	"territory_type" varchar(50),
	"countries" jsonb DEFAULT '[]'::jsonb,
	"states" jsonb DEFAULT '[]'::jsonb,
	"cities" jsonb DEFAULT '[]'::jsonb,
	"postal_codes" jsonb DEFAULT '[]'::jsonb,
	"industries" jsonb DEFAULT '[]'::jsonb,
	"company_size_min" integer,
	"company_size_max" integer,
	"revenue_min" numeric(15, 2),
	"revenue_max" numeric(15, 2),
	"account_tiers" jsonb DEFAULT '[]'::jsonb,
	"owner_id" varchar NOT NULL,
	"team_members" jsonb DEFAULT '[]'::jsonb,
	"manager_id" varchar,
	"monthly_quota" numeric(12, 2),
	"quarterly_quota" numeric(12, 2),
	"annual_quota" numeric(12, 2),
	"current_pipeline" numeric(12, 2) DEFAULT '0',
	"active_prospects_count" integer DEFAULT 0,
	"active_deals_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_sales_territories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "platform_signups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"industry" varchar(100),
	"company_size" varchar(50),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"trial_plan_selected" varchar(50),
	"interest_areas" jsonb DEFAULT '[]'::jsonb,
	"source" varchar(100),
	"utm_source" varchar(100),
	"utm_campaign" varchar(100),
	"utm_medium" varchar(100),
	"status" varchar(20) DEFAULT 'pending',
	"qualification_score" integer DEFAULT 0,
	"tenant_id" varchar,
	"primary_user_id" varchar,
	"email_verified" boolean DEFAULT false,
	"email_verified_at" timestamp,
	"trial_started_at" timestamp,
	"trial_ended_at" timestamp,
	"upgraded_at" timestamp,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"assigned_to" varchar,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"demos_requested" integer DEFAULT 0,
	"docs_viewed" integer DEFAULT 0,
	"features_explored" jsonb DEFAULT '[]'::jsonb,
	"last_activity_at" timestamp,
	"feedback_score" integer,
	"feedback_comment" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_success_interventions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_record_id" varchar NOT NULL,
	"intervention_type" varchar(50),
	"trigger" varchar(100),
	"priority" varchar(20),
	"status" varchar(20) DEFAULT 'pending',
	"outcome" varchar(50),
	"assigned_to" varchar,
	"assigned_at" timestamp,
	"due_date" timestamp,
	"scheduled_date" timestamp,
	"executed_at" timestamp,
	"completed_at" timestamp,
	"title" varchar(255) NOT NULL,
	"description" text,
	"action_items" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"customer_response" varchar(50),
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"health_score_before" integer,
	"health_score_after" integer,
	"churn_risk_before" "platform_churn_risk",
	"churn_risk_after" "platform_churn_risk",
	"related_health_score_id" varchar,
	"related_churn_prediction_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_change_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"request_type" varchar NOT NULL,
	"reference_id" varchar NOT NULL,
	"requested_by" varchar NOT NULL,
	"requested_date" timestamp DEFAULT now(),
	"request_reason" text NOT NULL,
	"original_price" numeric(12, 2),
	"requested_price" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2),
	"discount_percentage" numeric(5, 2),
	"original_margin_percentage" numeric(5, 2),
	"new_margin_percentage" numeric(5, 2),
	"status" "pricing_approval_status" DEFAULT 'pending',
	"approved_by" varchar,
	"approved_date" timestamp,
	"approval_notes" text,
	"rejection_reason" text,
	"escalated_to" varchar,
	"escalated_date" timestamp,
	"escalation_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proactive_threat_detection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"detection_type" varchar(100) NOT NULL,
	"threat_category" "alert_category" NOT NULL,
	"anomaly_description" text NOT NULL,
	"detection_reason" text,
	"affected_entity_type" varchar(100) NOT NULL,
	"affected_entity_id" varchar(255) NOT NULL,
	"anomaly_data" jsonb,
	"risk_score" integer NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"status" varchar(50) DEFAULT 'monitoring' NOT NULL,
	"alert_created" boolean DEFAULT false,
	"alert_id" uuid,
	"first_detected_at" timestamp NOT NULL,
	"last_detected_at" timestamp NOT NULL,
	"detection_count" integer DEFAULT 1,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email_id" text NOT NULL,
	"from" text NOT NULL,
	"to" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"html_body" text,
	"ticket_id" text,
	"parsed_data" jsonb,
	"processing_status" text NOT NULL,
	"processing_error" text,
	"ai_confidence" text,
	"processing_duration" integer,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "processed_emails_email_id_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "product_accessories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"accessory_code" varchar NOT NULL,
	"accessory_name" varchar NOT NULL,
	"accessory_type" varchar,
	"category" varchar,
	"manufacturer" varchar,
	"description" text,
	"standard_cost" numeric(10, 2),
	"standard_dealer_cost" numeric(10, 2),
	"standard_rep_markup_percentage" numeric(5, 2),
	"standard_rep_cost" numeric(10, 2),
	"standard_rep_price" numeric(10, 2),
	"standard_suggested_retail" numeric(10, 2),
	"new_cost" numeric(10, 2),
	"new_dealer_cost" numeric(10, 2),
	"new_rep_markup_percentage" numeric(5, 2),
	"new_rep_cost" numeric(10, 2),
	"new_rep_price" numeric(10, 2),
	"new_suggested_retail" numeric(10, 2),
	"upgrade_cost" numeric(10, 2),
	"upgrade_dealer_cost" numeric(10, 2),
	"upgrade_rep_markup_percentage" numeric(5, 2),
	"upgrade_rep_cost" numeric(10, 2),
	"upgrade_rep_price" numeric(10, 2),
	"upgrade_suggested_retail" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT false,
	"funding" boolean DEFAULT false,
	"lease" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"category" varchar DEFAULT 'MFP',
	"manufacturer" varchar,
	"description" text,
	"msrp" numeric(10, 2),
	"color_mode" varchar,
	"color_speed" varchar,
	"bw_speed" varchar,
	"product_family" varchar,
	"required_accessories" text,
	"new_active" boolean DEFAULT false,
	"new_dealer_cost" numeric(10, 2),
	"new_rep_markup_percentage" numeric(5, 2),
	"new_rep_cost" numeric(10, 2),
	"new_rep_price" numeric(10, 2),
	"new_suggested_retail" numeric(10, 2),
	"upgrade_active" boolean DEFAULT false,
	"upgrade_dealer_cost" numeric(10, 2),
	"upgrade_rep_markup_percentage" numeric(5, 2),
	"upgrade_rep_cost" numeric(10, 2),
	"upgrade_rep_price" numeric(10, 2),
	"upgrade_suggested_retail" numeric(10, 2),
	"lexmark_active" boolean DEFAULT false,
	"lexmark_dealer_cost" numeric(10, 2),
	"lexmark_rep_markup_percentage" numeric(5, 2),
	"lexmark_rep_cost" numeric(10, 2),
	"lexmark_rep_price" numeric(10, 2),
	"lexmark_suggested_retail" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"dealer_cost" numeric(12, 2) NOT NULL,
	"company_markup_percentage" numeric(5, 2),
	"company_price" numeric(12, 2) NOT NULL,
	"minimum_sale_price" numeric(12, 2),
	"suggested_retail_price" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp DEFAULT now(),
	"expiration_date" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "professional_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"category" varchar DEFAULT 'Professional Services',
	"accessory_type" varchar,
	"description" text,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"related_products" text,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"msrp" numeric,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric,
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric,
	"graphic_active" boolean DEFAULT false,
	"graphic_rep_price" numeric,
	"manufacturer" varchar,
	"manufacturer_product_code" varchar,
	"model" varchar,
	"units" varchar,
	"environment" varchar,
	"color_mode" varchar,
	"ea_item_number" varchar,
	"price_book_id" varchar,
	"temp_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"project_manager" varchar,
	"created_by" varchar NOT NULL,
	"customer_id" varchar,
	"contract_id" varchar,
	"start_date" timestamp,
	"end_date" timestamp,
	"estimated_budget" integer,
	"actual_budget" integer,
	"completion_percentage" integer DEFAULT 0,
	"color" varchar DEFAULT '#3b82f6',
	"template" varchar,
	"workflow" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "proposal_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"event_details" jsonb,
	"visitor_id" varchar,
	"customer_user_id" varchar,
	"session_id" varchar,
	"timestamp" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"approval_level" integer NOT NULL,
	"approval_type" varchar NOT NULL,
	"required_role" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"approver_id" varchar,
	"approver_name" varchar,
	"approval_notes" text,
	"conditions" text,
	"requested_at" timestamp DEFAULT now(),
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"comment_type" varchar NOT NULL,
	"content" text NOT NULL,
	"author_id" varchar NOT NULL,
	"author_name" varchar NOT NULL,
	"author_role" varchar,
	"parent_comment_id" varchar,
	"is_resolved" boolean DEFAULT false,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_content_blocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"block_type" varchar NOT NULL,
	"category" varchar,
	"title" varchar,
	"content" text NOT NULL,
	"html_content" text,
	"is_global" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"team_id" varchar,
	"tags" jsonb DEFAULT '[]',
	"usage_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"item_type" varchar NOT NULL,
	"product_id" varchar,
	"product_code" varchar,
	"product_name" varchar NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(10, 2),
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0',
	"margin" numeric(5, 2),
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" varchar,
	"recurring_duration" integer,
	"lead_time" integer,
	"warranty_period" integer,
	"service_level" varchar,
	"is_optional" boolean DEFAULT false,
	"is_customizable" boolean DEFAULT false,
	"configuration_options" jsonb,
	"alternative_options" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"section_type" varchar NOT NULL,
	"section_title" varchar NOT NULL,
	"display_order" integer NOT NULL,
	"content" text,
	"html_content" text,
	"is_visible" boolean DEFAULT true,
	"is_completed" boolean DEFAULT false,
	"template_section_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_template_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"section_type" varchar NOT NULL,
	"section_title" varchar NOT NULL,
	"display_order" integer NOT NULL,
	"is_required" boolean DEFAULT false,
	"is_visible" boolean DEFAULT true,
	"is_editable" boolean DEFAULT true,
	"default_content" text,
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_name" varchar NOT NULL,
	"template_type" varchar NOT NULL,
	"description" text,
	"header_content" jsonb,
	"cover_page_template" text,
	"executive_summary_template" text,
	"proposal_body_template" text,
	"terms_conditions_template" text,
	"footer_template" text,
	"branding_colors" jsonb,
	"font_settings" jsonb,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_number" varchar NOT NULL,
	"version" integer DEFAULT 1,
	"title" varchar NOT NULL,
	"business_record_id" varchar NOT NULL,
	"contact_id" varchar,
	"template_id" varchar,
	"proposal_type" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"executive_summary" text,
	"customer_needs" text,
	"proposed_solution" text,
	"implementation_plan" text,
	"equipment_package_id" varchar,
	"custom_equipment" jsonb,
	"subtotal" numeric(10, 2),
	"discount_amount" numeric(10, 2) DEFAULT '0',
	"discount_percentage" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(10, 2),
	"payment_terms" varchar,
	"delivery_terms" varchar,
	"warranty_terms" text,
	"service_terms" text,
	"valid_until" timestamp,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"e_signature_required" boolean DEFAULT false,
	"e_signature_provider" varchar,
	"e_signature_document_id" varchar,
	"e_signature_status" varchar,
	"open_count" integer DEFAULT 0,
	"last_opened_at" timestamp,
	"time_spent_viewing" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar,
	"team_id" varchar,
	"internal_notes" text,
	"customer_feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "proposals_proposal_number_unique" UNIQUE("proposal_number")
);
--> statement-breakpoint
CREATE TABLE "prospecting_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"campaign_name" varchar NOT NULL,
	"campaign_description" text,
	"campaign_type" varchar,
	"target_industries" jsonb,
	"target_company_sizes" jsonb,
	"target_job_titles" jsonb,
	"target_management_levels" jsonb,
	"target_technologies" jsonb,
	"sequence_steps" jsonb,
	"follow_up_cadence" jsonb,
	"personalization_rules" jsonb,
	"total_contacts" integer DEFAULT 0,
	"contacts_reached" integer DEFAULT 0,
	"responses_received" integer DEFAULT 0,
	"meetings_booked" integer DEFAULT 0,
	"opportunities_created" integer DEFAULT 0,
	"response_rate" numeric,
	"meeting_rate" numeric,
	"opportunity_rate" numeric,
	"status" varchar DEFAULT 'draft',
	"start_date" timestamp,
	"end_date" timestamp,
	"campaign_owner_id" varchar,
	"team_members" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2),
	"total_price" numeric(10, 2),
	"serial_number" varchar(100),
	"received_quantity" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"po_number" varchar(50) NOT NULL,
	"vendor_id" uuid NOT NULL,
	"order_date" timestamp DEFAULT now(),
	"expected_delivery_date" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(10, 2),
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qb_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"vendor_name" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"display_name" varchar(255),
	"print_on_check_name" varchar(255),
	"is_active" boolean DEFAULT true,
	"external_vendor_id" varchar,
	"vendor_type_id" varchar,
	"tax_id" varchar,
	"account_number" varchar,
	"is_1099_vendor" boolean DEFAULT false,
	"currency_id" varchar,
	"ap_account_id" varchar,
	"payment_terms_id" varchar,
	"current_balance" numeric(15, 2) DEFAULT '0.00',
	"open_balance_date" timestamp,
	"credit_limit" numeric(15, 2),
	"primary_phone_json" jsonb,
	"alternate_phone_json" jsonb,
	"mobile_phone_json" jsonb,
	"fax_json" jsonb,
	"primary_email_json" jsonb,
	"website_json" jsonb,
	"billing_address_json" jsonb,
	"vendor_notes" text,
	"qb_domain" varchar,
	"is_sparse" boolean DEFAULT false,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quickbooks_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"qb_company_id" varchar NOT NULL,
	"qb_company_name" varchar,
	"connection_status" varchar(50) DEFAULT 'connected',
	"access_token_hash" text,
	"refresh_token_hash" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"last_sync_status" varchar(50),
	"sync_errors" jsonb,
	"customers_synced_at" timestamp,
	"vendors_synced_at" timestamp,
	"items_synced_at" timestamp,
	"invoices_synced_at" timestamp,
	"accounts_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"quote_id" varchar NOT NULL,
	"description" varchar NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar,
	"customer_id" varchar,
	"quote_number" varchar NOT NULL,
	"blanket_gross_profit_percentage" numeric(5, 2) DEFAULT '10.00',
	"apply_blanket_to_all_items" boolean DEFAULT true,
	"total_dealer_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_company_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_sale_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_gross_profit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_gross_profit_percentage" numeric(5, 2) DEFAULT '0',
	"status" varchar DEFAULT 'draft' NOT NULL,
	"created_by" varchar NOT NULL,
	"approved_by" varchar,
	"approved_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_pricing_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"quote_pricing_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"product_name" varchar NOT NULL,
	"product_description" text,
	"product_sku" varchar,
	"quantity" integer DEFAULT 1 NOT NULL,
	"dealer_cost" numeric(12, 2) NOT NULL,
	"company_price" numeric(12, 2) NOT NULL,
	"sale_price" numeric(12, 2) NOT NULL,
	"total_dealer_cost" numeric(12, 2) NOT NULL,
	"total_company_price" numeric(12, 2) NOT NULL,
	"total_sale_price" numeric(12, 2) NOT NULL,
	"unit_gross_profit" numeric(12, 2) NOT NULL,
	"total_gross_profit" numeric(12, 2) NOT NULL,
	"gross_profit_percentage" numeric(5, 2) NOT NULL,
	"use_custom_gross_profit" boolean DEFAULT false,
	"custom_gross_profit_percentage" numeric(5, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar,
	"customer_id" varchar,
	"quote_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"valid_until" timestamp NOT NULL,
	"terms" text,
	"notes" text,
	"created_by" varchar NOT NULL,
	"sent_date" timestamp,
	"accepted_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" text,
	"regional_manager_id" varchar,
	"states" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "renewal_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"renewal_id" varchar NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"activity_subject" varchar(255),
	"activity_description" text,
	"performed_by" varchar,
	"customer_contacts" text[],
	"outcome" varchar(100),
	"next_steps" text,
	"customer_sentiment" varchar(50),
	"renewal_likelihood" varchar(50),
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"follow_up_assigned_to" varchar,
	"activity_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_analytics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "renewal_analytics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"period_type" text NOT NULL,
	"contracts_expiring" integer DEFAULT 0,
	"contracts_renewed" integer DEFAULT 0,
	"contracts_churned" integer DEFAULT 0,
	"renewal_rate" numeric(5, 2),
	"mrr_at_risk" numeric(10, 2) DEFAULT '0.00',
	"mrr_retained" numeric(10, 2) DEFAULT '0.00',
	"mrr_expanded" numeric(10, 2) DEFAULT '0.00',
	"mrr_churned" numeric(10, 2) DEFAULT '0.00',
	"total_revenue_saved" numeric(10, 2) DEFAULT '0.00',
	"proposals_auto_generated" integer DEFAULT 0,
	"proposals_manually_created" integer DEFAULT 0,
	"auto_renewal_success_rate" numeric(5, 2),
	"average_days_to_renewal" numeric(10, 2),
	"ai_prediction_accuracy" numeric(5, 2),
	"average_confidence_score" numeric(5, 2),
	"high_risk_contracts_saved" integer DEFAULT 0,
	"average_proposal_view_time" integer,
	"proposal_acceptance_rate" numeric(5, 2),
	"average_response_time" numeric(10, 2),
	"hours_saved_by_automation" numeric(10, 2) DEFAULT '0.00',
	"manual_hours_required" numeric(10, 2) DEFAULT '0.00',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_automation_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "renewal_automation_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"renewal_window_days" integer DEFAULT 90,
	"early_renewal_incentive_days" integer DEFAULT 120,
	"early_renewal_discount_percent" numeric(5, 2) DEFAULT '5.00',
	"auto_renewal_enabled" boolean DEFAULT true,
	"require_customer_approval" boolean DEFAULT true,
	"auto_accept_threshold" numeric(10, 2) DEFAULT '5000.00',
	"low_risk_threshold" integer DEFAULT 70,
	"medium_risk_threshold" integer DEFAULT 50,
	"high_risk_threshold" integer DEFAULT 30,
	"auto_pricing_enabled" boolean DEFAULT true,
	"max_discount_percent" numeric(5, 2) DEFAULT '15.00',
	"min_price_increase_percent" numeric(5, 2) DEFAULT '0.00',
	"max_price_increase_percent" numeric(5, 2) DEFAULT '5.00',
	"market_rate_adjustment" boolean DEFAULT true,
	"auto_send_proposals" boolean DEFAULT true,
	"reminder_frequency_days" integer DEFAULT 14,
	"max_reminders" integer DEFAULT 3,
	"escalation_enabled" boolean DEFAULT true,
	"escalation_days_before_expiry" integer DEFAULT 30,
	"notify_sales_on_high_risk" boolean DEFAULT true,
	"notify_sales_on_large_contracts" boolean DEFAULT true,
	"large_contract_threshold" numeric(10, 2) DEFAULT '10000.00',
	"ai_analysis_enabled" boolean DEFAULT true,
	"ai_proposal_generation" boolean DEFAULT true,
	"minimum_confidence_score" integer DEFAULT 75,
	"block_renewal_if_outstanding" boolean DEFAULT true,
	"require_service_review_meeting" boolean DEFAULT false,
	"minimum_contract_term_months" integer DEFAULT 12,
	"maximum_contract_term_months" integer DEFAULT 60,
	"enable_upsell_recommendations" boolean DEFAULT true,
	"upsell_minimum_percent" numeric(5, 2) DEFAULT '10.00',
	"upsell_maximum_percent" numeric(5, 2) DEFAULT '30.00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "renewal_automation_rules_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "renewal_communication_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "renewal_communication_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"contract_renewal_tracking_id" integer NOT NULL,
	"renewal_proposal_id" integer,
	"customer_id" integer NOT NULL,
	"communication_type" text NOT NULL,
	"subject" text,
	"message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"automated_message" boolean DEFAULT true,
	"template_used" text,
	"triggered_by" text,
	"opened" boolean DEFAULT false,
	"opened_at" timestamp,
	"clicked" boolean DEFAULT false,
	"clicked_at" timestamp,
	"replied" boolean DEFAULT false,
	"replied_at" timestamp,
	"reply_content" text,
	"sent_by_user_id" integer,
	"sent_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_playbooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"playbook_name" varchar(255) NOT NULL,
	"description" text,
	"trigger_conditions" jsonb,
	"steps" jsonb NOT NULL,
	"success_rate" numeric(5, 2),
	"times_used" integer DEFAULT 0,
	"average_days_to_close" numeric(8, 2),
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_proposals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "renewal_proposals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"contract_renewal_tracking_id" integer NOT NULL,
	"contract_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"proposal_number" text NOT NULL,
	"proposal_date" timestamp DEFAULT now() NOT NULL,
	"expiration_date" timestamp NOT NULL,
	"current_mrr" numeric(10, 2),
	"current_acv" numeric(10, 2),
	"current_term_months" integer,
	"proposed_mrr" numeric(10, 2) NOT NULL,
	"proposed_acv" numeric(10, 2) NOT NULL,
	"proposed_term_months" integer NOT NULL,
	"proposed_start_date" timestamp NOT NULL,
	"proposed_end_date" timestamp NOT NULL,
	"base_price" numeric(10, 2),
	"discount_percentage" numeric(5, 2),
	"discount_amount" numeric(10, 2),
	"incentive_offered" text,
	"incentive_value" numeric(10, 2),
	"ai_pricing_strategy" jsonb,
	"competitive_analysis" jsonb,
	"value_proposition" jsonb,
	"risk_mitigation" jsonb,
	"base_services_included" jsonb,
	"additional_services_offered" jsonb,
	"upsell_value" numeric(10, 2),
	"executive_summary" text,
	"services_summary" text,
	"pricing_summary" text,
	"terms_and_conditions" text,
	"custom_message" text,
	"sent_via" text,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"view_count" integer DEFAULT 0,
	"time_spent_viewing" integer,
	"questions_asked" integer DEFAULT 0,
	"customer_response" text,
	"response_date" timestamp,
	"counter_offer_received" boolean DEFAULT false,
	"counter_offer_details" jsonb,
	"rejection_reason" text,
	"follow_up_scheduled" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"follow_up_completed" boolean DEFAULT false,
	"status" text DEFAULT 'draft',
	"accepted_at" timestamp,
	"signed_document_url" text,
	"generated_by" text DEFAULT 'ai_autopilot',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "renewal_proposals_proposal_number_unique" UNIQUE("proposal_number")
);
--> statement-breakpoint
CREATE TABLE "rep_capacity" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"max_active_leads" integer DEFAULT 50,
	"max_new_leads_per_day" integer DEFAULT 10,
	"max_new_leads_per_week" integer DEFAULT 30,
	"current_active_leads" integer DEFAULT 0,
	"leads_assigned_today" integer DEFAULT 0,
	"leads_assigned_this_week" integer DEFAULT 0,
	"is_available" boolean DEFAULT true,
	"unavailable_reason" varchar(100),
	"unavailable_until" timestamp,
	"skills" text[],
	"certifications" text[],
	"languages" text[],
	"average_response_time_minutes" integer,
	"conversion_rate" numeric(5, 2),
	"average_deal_size" numeric(12, 2),
	"working_hours" jsonb,
	"last_reset_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resolution_suggestion_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"suggestion_id" varchar(255) NOT NULL,
	"triage_result_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"suggestion_used" boolean NOT NULL,
	"suggestion_helpful" boolean,
	"helpfulness_score" integer,
	"incident_resolved" boolean NOT NULL,
	"resolution_time_minutes" integer,
	"steps_followed" jsonb,
	"additional_steps" text,
	"root_cause_correct" boolean,
	"estimated_time_accurate" boolean,
	"feedback" text,
	"improvement_suggestions" text,
	"provided_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"effect" "permission_effect" DEFAULT 'ALLOW' NOT NULL,
	"conditions" jsonb DEFAULT '{}',
	"constraints" jsonb DEFAULT '{}',
	"is_customized" boolean DEFAULT false,
	"customized_by" varchar,
	"customized_at" timestamp,
	"customization_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"code" varchar(30) NOT NULL,
	"role_type" "role_type" DEFAULT 'department_role' NOT NULL,
	"department" varchar(30) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"description" varchar(255),
	"permissions" jsonb DEFAULT '{}' NOT NULL,
	"can_access_all_tenants" boolean DEFAULT false,
	"can_view_system_metrics" boolean DEFAULT false,
	"can_access_all_locations" boolean DEFAULT false,
	"can_manage_company_users" boolean DEFAULT false,
	"can_create_locations" boolean DEFAULT false,
	"can_view_company_financials" boolean DEFAULT false,
	"can_manage_regional_users" boolean DEFAULT false,
	"can_view_regional_reports" boolean DEFAULT false,
	"can_approve_regional_deals" boolean DEFAULT false,
	"can_manage_location_users" boolean DEFAULT false,
	"can_view_location_reports" boolean DEFAULT false,
	"can_approve_location_deals" boolean DEFAULT false,
	"can_manage_compliance" boolean DEFAULT false,
	"can_manage_training" boolean DEFAULT false,
	"can_manage_hr" boolean DEFAULT false,
	"can_manage_it" boolean DEFAULT false,
	"can_view_analytics" boolean DEFAULT false,
	"can_manage_quality" boolean DEFAULT false,
	"can_access_audit_logs" boolean DEFAULT false,
	"can_manage_integrations" boolean DEFAULT false,
	"can_manage_users" boolean DEFAULT false,
	"is_system_role" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sales_forecasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"forecast_name" varchar NOT NULL,
	"forecast_type" varchar NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"revenue_target" numeric(12, 2) NOT NULL,
	"unit_target" integer,
	"deal_count_target" integer,
	"actual_revenue" numeric(12, 2) DEFAULT '0',
	"actual_units" integer DEFAULT 0,
	"actual_deals" integer DEFAULT 0,
	"pipeline_value" numeric(12, 2) DEFAULT '0',
	"weighted_pipeline_value" numeric(12, 2) DEFAULT '0',
	"probability_adjusted_revenue" numeric(12, 2) DEFAULT '0',
	"confidence_level" varchar NOT NULL,
	"confidence_percentage" integer DEFAULT 50,
	"conversion_rate" numeric(5, 2) DEFAULT '0',
	"average_deal_size" numeric(10, 2) DEFAULT '0',
	"sales_cycle_length" integer DEFAULT 30,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"achievement_percentage" numeric(5, 2) DEFAULT '0',
	"projected_revenue" numeric(12, 2) DEFAULT '0',
	"gap_to_target" numeric(12, 2) DEFAULT '0',
	"sales_territory" varchar,
	"sales_team" jsonb DEFAULT '[]'::jsonb,
	"sales_manager" varchar,
	"forecast_notes" text,
	"assumptions" text,
	"risk_factors" text,
	"opportunities" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_calculated" timestamp
);
--> statement-breakpoint
CREATE TABLE "sales_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"assigned_to_user_id" varchar,
	"assigned_to_team_id" varchar,
	"assigned_by" varchar NOT NULL,
	"goal_type" "activity_goal_type" NOT NULL,
	"target_count" integer NOT NULL,
	"period" "goal_period" NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_handoff_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"opportunity_id" varchar,
	"contract_id" varchar,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"handoff_type" varchar(50) NOT NULL,
	"sales_rep_id" varchar NOT NULL,
	"sales_rep_name" varchar,
	"implementation_owner_id" varchar,
	"csm_id" varchar,
	"installation_tech_id" varchar,
	"account_profile" jsonb,
	"customer_expectations" jsonb,
	"contract_summary" jsonb,
	"equipment_details" jsonb,
	"services_included" jsonb,
	"technical_requirements" jsonb,
	"installation_planning" jsonb,
	"training_requirements" jsonb,
	"billing_information" jsonb,
	"sales_notes" text,
	"competitive_info" text,
	"deal_story" text,
	"risk_factors" text[],
	"opportunity_for_upsell" text[],
	"handoff_meeting_scheduled" boolean DEFAULT false,
	"handoff_meeting_date" timestamp,
	"handoff_meeting_notes" text,
	"attendees" text[],
	"completion_percentage" integer DEFAULT 0,
	"required_fields_complete" boolean DEFAULT false,
	"ready_for_implementation" boolean DEFAULT false,
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"target_completion_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"team_id" varchar,
	"metric_period" varchar NOT NULL,
	"period_start_date" timestamp NOT NULL,
	"period_end_date" timestamp NOT NULL,
	"total_calls" integer DEFAULT 0,
	"answered_calls" integer DEFAULT 0,
	"total_emails" integer DEFAULT 0,
	"email_replies" integer DEFAULT 0,
	"total_meetings" integer DEFAULT 0,
	"meetings_held" integer DEFAULT 0,
	"call_answer_rate" numeric(5, 2) DEFAULT '0',
	"email_response_rate" numeric(5, 2) DEFAULT '0',
	"activity_to_meeting_rate" numeric(5, 2) DEFAULT '0',
	"meeting_to_proposal_rate" numeric(5, 2) DEFAULT '0',
	"proposal_closing_rate" numeric(5, 2) DEFAULT '0',
	"total_proposals" integer DEFAULT 0,
	"closed_deals" integer DEFAULT 0,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"average_deal_size" numeric(12, 2) DEFAULT '0',
	"activities_per_deal" numeric(8, 2) DEFAULT '0',
	"activities_needed_for_goal" integer DEFAULT 0,
	"projected_revenue" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"team_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'member',
	"joined_date" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"parent_team_id" varchar,
	"team_level" integer DEFAULT 1,
	"manager_id" varchar NOT NULL,
	"territory" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_territories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"territory_name" varchar(255) NOT NULL,
	"territory_code" varchar(50),
	"description" text,
	"territory_type" varchar(50) NOT NULL,
	"geographic_rules" jsonb,
	"account_rules" jsonb,
	"product_focus" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0,
	"owner_id" varchar,
	"team_members" text[],
	"manager_id" varchar,
	"monthly_quota" numeric(12, 2),
	"current_pipeline" numeric(12, 2) DEFAULT '0',
	"active_leads_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"device_fingerprint" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"terminated_at" timestamp,
	"is_active" boolean DEFAULT true,
	"timeout_warning_shown" boolean DEFAULT false,
	"is_suspicious" boolean DEFAULT false,
	"failed_login_attempts" integer DEFAULT 0,
	"last_failed_login" timestamp,
	"mfa_verified" boolean DEFAULT false,
	"mfa_method" varchar(50),
	"mfa_verified_at" timestamp,
	"country" varchar(2),
	"city" varchar(100),
	"risk_score" integer DEFAULT 0,
	"risk_factors" jsonb,
	"termination_reason" varchar(100),
	"terminated_by" uuid,
	CONSTRAINT "security_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "seo_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"metric" varchar(100) NOT NULL,
	"operator" varchar(20) NOT NULL,
	"threshold" numeric(10, 2) NOT NULL,
	"target_url" varchar(500),
	"target_keyword" varchar(255),
	"is_active" boolean DEFAULT true,
	"severity" "seo_severity" DEFAULT 'medium' NOT NULL,
	"notify_email" boolean DEFAULT true,
	"notify_slack" boolean DEFAULT false,
	"notify_webhook" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule_id" uuid,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"severity" "seo_severity" NOT NULL,
	"status" "seo_alert_status" DEFAULT 'active' NOT NULL,
	"metric" varchar(100),
	"old_value" numeric(10, 2),
	"new_value" numeric(10, 2),
	"url" varchar(500),
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_audit_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"status" "seo_audit_status" DEFAULT 'pending' NOT NULL,
	"overall_score" integer,
	"technical_score" integer,
	"content_score" integer,
	"performance_score" integer,
	"critical_issues" integer DEFAULT 0,
	"high_issues" integer DEFAULT 0,
	"medium_issues" integer DEFAULT 0,
	"low_issues" integer DEFAULT 0,
	"issues" jsonb,
	"recommendations" jsonb,
	"technical_details" jsonb,
	"duration_ms" integer,
	"triggered_by" uuid,
	"audit_type" varchar(50) DEFAULT 'manual',
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_competitor_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"competitor_url" varchar(500) NOT NULL,
	"competitor_name" varchar(255),
	"estimated_traffic" integer,
	"domain_authority" integer,
	"page_authority" integer,
	"ranking_keywords" integer,
	"top_ranking_keywords" jsonb,
	"total_backlinks" integer,
	"referring_domains" integer,
	"content_strategies" jsonb,
	"top_pages" jsonb,
	"analyzed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_content_optimization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" varchar(500),
	"title" varchar(255) NOT NULL,
	"original_content" text,
	"optimized_content" text,
	"target_keyword" varchar(255),
	"secondary_keywords" jsonb,
	"keyword_density" numeric(5, 2),
	"readability_score" integer,
	"seo_score" integer,
	"word_count" integer,
	"heading_structure" jsonb,
	"keyword_placements" jsonb,
	"ai_suggestions" jsonb,
	"status" "seo_content_status" DEFAULT 'draft' NOT NULL,
	"meta_title" varchar(255),
	"meta_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "seo_core_web_vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"lcp" integer,
	"fid" integer,
	"cls" numeric(5, 3),
	"fcp" integer,
	"ttfb" integer,
	"tti" integer,
	"tbt" integer,
	"si" numeric(6, 2),
	"performance_score" integer,
	"accessibility_score" integer,
	"best_practices_score" integer,
	"seo_score" integer,
	"device" varchar(20) DEFAULT 'mobile',
	"diagnostics" jsonb,
	"opportunities" jsonb,
	"measured_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_crawl_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"crawl_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"title" varchar(255),
	"meta_description" text,
	"h1" varchar(255),
	"status_code" integer,
	"redirect_url" varchar(500),
	"word_count" integer,
	"content_type" varchar(100),
	"internal_links" integer,
	"external_links" integer,
	"broken_links" integer,
	"total_images" integer,
	"images_without_alt" integer,
	"has_canonical" boolean DEFAULT false,
	"canonical_url" varchar(500),
	"has_schema" boolean DEFAULT false,
	"schema_types" jsonb,
	"load_time_ms" integer,
	"page_size_bytes" integer,
	"crawl_depth" integer DEFAULT 0,
	"issues" jsonb,
	"crawled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_duplicate_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url1" varchar(500) NOT NULL,
	"url2" varchar(500) NOT NULL,
	"similarity_score" numeric(5, 2),
	"duplicate_percentage" integer,
	"shared_phrases" jsonb,
	"unique_content_1_chars" integer,
	"unique_content_2_chars" integer,
	"canonical_set" boolean DEFAULT false,
	"canonical_url" varchar(500),
	"recommendation" text,
	"detected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_fixes_applied" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"issue" text NOT NULL,
	"fix" text NOT NULL,
	"severity" "seo_severity" NOT NULL,
	"status" "seo_fix_status" DEFAULT 'pending' NOT NULL,
	"old_value" text,
	"new_value" text,
	"applied_by" uuid,
	"reverted_by" uuid,
	"metadata" jsonb,
	"error_message" text,
	"applied_at" timestamp,
	"reverted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_image_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"page_url" varchar(500) NOT NULL,
	"image_url" varchar(500) NOT NULL,
	"alt_text" varchar(500),
	"title" varchar(255),
	"file_size_bytes" integer,
	"width" integer,
	"height" integer,
	"format" varchar(20),
	"is_optimized" boolean DEFAULT false,
	"has_alt_text" boolean DEFAULT false,
	"is_lazy" boolean DEFAULT false,
	"has_responsive" boolean DEFAULT false,
	"issues" jsonb,
	"recommended_format" varchar(20),
	"potential_savings_bytes" integer,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_keyword_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword_id" uuid NOT NULL,
	"position" integer,
	"impressions" integer,
	"clicks" integer,
	"ctr" numeric(5, 2),
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"target_url" varchar(500),
	"current_position" integer,
	"target_position" integer,
	"best_position" integer,
	"search_volume" integer,
	"difficulty" integer,
	"cpc" numeric(10, 2),
	"impressions" integer,
	"clicks" integer,
	"ctr" numeric(5, 2),
	"competitor_urls" jsonb,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 5,
	"last_checked" timestamp,
	"check_frequency" "seo_monitoring_frequency" DEFAULT 'weekly',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_link_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_url" varchar(500) NOT NULL,
	"target_url" varchar(500) NOT NULL,
	"anchor_text" text,
	"link_type" varchar(50),
	"is_no_follow" boolean DEFAULT false,
	"is_no_opener" boolean DEFAULT false,
	"is_broken" boolean DEFAULT false,
	"status_code" integer,
	"error_message" text,
	"link_value" integer,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_mobile_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"is_mobile_friendly" boolean DEFAULT false,
	"mobile_score" integer,
	"has_viewport_meta" boolean DEFAULT false,
	"viewport_content" varchar(255),
	"has_touch_friendly_elements" boolean DEFAULT false,
	"touch_elements_issues" jsonb,
	"has_readable_text" boolean DEFAULT false,
	"text_issues" jsonb,
	"content_fits_viewport" boolean DEFAULT false,
	"mobile_load_time_ms" integer,
	"mobile_fcp" integer,
	"mobile_lcp" integer,
	"issues" jsonb,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_monitoring_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"check_type" varchar(100) NOT NULL,
	"target_url" varchar(500),
	"status" varchar(50) NOT NULL,
	"result" jsonb,
	"response_time_ms" integer,
	"status_code" integer,
	"change_detected" boolean DEFAULT false,
	"change_details" jsonb,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_monitoring_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"task_type" varchar(100) NOT NULL,
	"target_url" varchar(500),
	"frequency" "seo_monitoring_frequency" NOT NULL,
	"schedule_time" varchar(10),
	"timezone" varchar(50) DEFAULT 'UTC',
	"is_active" boolean DEFAULT true,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"email" boolean DEFAULT true,
	"email_address" varchar(255),
	"slack" boolean DEFAULT false,
	"slack_webhook" varchar(500),
	"webhook" boolean DEFAULT false,
	"webhook_url" varchar(500),
	"ranking_changes" boolean DEFAULT true,
	"technical_issues" boolean DEFAULT true,
	"performance_alerts" boolean DEFAULT true,
	"audit_completed" boolean DEFAULT true,
	"min_ranking_change" integer DEFAULT 5,
	"min_performance_change" integer DEFAULT 10,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_page_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"title" varchar(255),
	"seo_score" integer,
	"content_quality" integer,
	"technical_seo" integer,
	"user_experience" integer,
	"word_count" integer,
	"reading_level" numeric(4, 2),
	"unique_content_percentage" integer,
	"load_time_ms" integer,
	"mobile_score" integer,
	"accessibility_score" integer,
	"issues" jsonb,
	"last_analyzed" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_performance_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"target_url" varchar(500),
	"max_load_time_ms" integer,
	"max_page_size_kb" integer,
	"max_requests" integer,
	"max_images" integer,
	"max_scripts" integer,
	"max_stylesheets" integer,
	"max_lcp" integer,
	"max_fid" integer,
	"max_cls" numeric(5, 3),
	"is_active" boolean DEFAULT true,
	"check_frequency" "seo_monitoring_frequency" DEFAULT 'daily',
	"alert_on_exceed" boolean DEFAULT true,
	"alert_threshold_percent" integer DEFAULT 90,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_redirect_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_url" varchar(500) NOT NULL,
	"destination_url" varchar(500) NOT NULL,
	"redirect_chain" jsonb,
	"chain_length" integer,
	"status_code" integer,
	"redirect_type" varchar(50),
	"has_redirect_loop" boolean DEFAULT false,
	"has_multiple_redirects" boolean DEFAULT false,
	"issues" jsonb,
	"total_time_ms" integer,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_security_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"has_https" boolean DEFAULT false,
	"https_redirect" boolean DEFAULT false,
	"certificate_valid" boolean DEFAULT false,
	"certificate_expiry" timestamp,
	"has_hsts" boolean DEFAULT false,
	"has_x_frame_options" boolean DEFAULT false,
	"has_x_content_type_options" boolean DEFAULT false,
	"has_csp" boolean DEFAULT false,
	"headers" jsonb,
	"security_score" integer,
	"issues" jsonb,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_semantic_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"related_keywords" jsonb,
	"semantic_clusters" jsonb,
	"search_intent" varchar(50),
	"intent_confidence" numeric(5, 2),
	"top_ranking_content" jsonb,
	"recommended_topics" jsonb,
	"recommended_questions" jsonb,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_url" varchar(500) NOT NULL,
	"site_name" varchar(255),
	"default_title" varchar(255),
	"default_description" text,
	"default_keywords" text,
	"default_og_image" varchar(500),
	"robots_txt" text,
	"llms_txt" text,
	"sitemap_url" varchar(500),
	"twitter_handle" varchar(50),
	"facebook_app_id" varchar(50),
	"monitoring_enabled" boolean DEFAULT false,
	"monitoring_frequency" "seo_monitoring_frequency" DEFAULT 'daily',
	"google_analytics_id" varchar(50),
	"gsc_verification" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_structured_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"schema_type" varchar(100) NOT NULL,
	"schema_format" varchar(20) DEFAULT 'json-ld',
	"schema_data" jsonb NOT NULL,
	"is_valid" boolean DEFAULT false,
	"validation_errors" jsonb,
	"validation_warnings" jsonb,
	"rich_results_eligible" boolean DEFAULT false,
	"rich_result_types" jsonb,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"validated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "service_call_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_ticket_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"call_start_time" timestamp NOT NULL,
	"call_end_time" timestamp,
	"actual_arrival_time" timestamp,
	"on_site_time_minutes" integer,
	"travel_time_minutes" integer,
	"analysis_type" "analysis_type" NOT NULL,
	"problem_description" text NOT NULL,
	"root_cause" text,
	"actions_taken" jsonb DEFAULT '[]'::jsonb,
	"outcome" "service_outcome" NOT NULL,
	"equipment_condition" text,
	"meter_reading" integer,
	"diagnostic_codes" jsonb DEFAULT '[]'::jsonb,
	"customer_present" boolean DEFAULT false,
	"customer_signature" text,
	"customer_feedback" text,
	"customer_satisfaction_score" integer,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"follow_up_reason" text,
	"labor_hours" numeric(4, 2),
	"labor_rate" numeric(10, 2),
	"total_labor_cost" numeric(10, 2),
	"before_photos" jsonb DEFAULT '[]'::jsonb,
	"after_photos" jsonb DEFAULT '[]'::jsonb,
	"service_report_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_service_call_id" varchar,
	"external_customer_id" varchar,
	"external_equipment_id" varchar,
	"last_sync_date" timestamp,
	"service_call_number" varchar,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"call_date" timestamp NOT NULL,
	"call_time" varchar,
	"call_type" varchar,
	"priority_level" varchar DEFAULT 'medium',
	"call_status" varchar DEFAULT 'open',
	"problem_description" text,
	"problem_code" varchar,
	"resolution_description" text,
	"resolution_code" varchar,
	"assigned_technician_id" varchar,
	"dispatched_by_user_id" varchar,
	"time_on_site_minutes" integer,
	"travel_time_minutes" integer,
	"completed_date" timestamp,
	"customer_signature" text,
	"customer_satisfaction_rating" integer,
	"labor_charge_amount" numeric(10, 2),
	"parts_charge_amount" numeric(10, 2),
	"travel_charge_amount" numeric(10, 2),
	"total_charge_amount" numeric(10, 2),
	"is_billable" boolean DEFAULT true,
	"invoice_number" varchar,
	"service_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "service_calls_service_call_number_unique" UNIQUE("service_call_number")
);
--> statement-breakpoint
CREATE TABLE "service_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_contract_id" varchar,
	"external_customer_id" varchar,
	"external_equipment_id" varchar,
	"last_sync_date" timestamp,
	"contract_number" varchar,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"contract_type" varchar,
	"contract_status" varchar DEFAULT 'active',
	"start_date" timestamp,
	"end_date" timestamp,
	"auto_renewal" boolean DEFAULT false,
	"billing_frequency" varchar DEFAULT 'monthly',
	"monthly_base_rate" numeric(10, 2),
	"bw_overage_rate" numeric(6, 4),
	"color_overage_rate" numeric(6, 4),
	"base_volume_bw" integer,
	"base_volume_color" integer,
	"total_contract_value" numeric(10, 2),
	"includes_toner" boolean DEFAULT true,
	"includes_parts" boolean DEFAULT true,
	"includes_labor" boolean DEFAULT true,
	"response_time_hours" integer DEFAULT 24,
	"sales_rep" varchar,
	"commission_rate" numeric(5, 4),
	"contract_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "service_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "service_parts_used" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"part_number" varchar(100) NOT NULL,
	"part_name" varchar(255) NOT NULL,
	"part_description" text,
	"quantity_used" integer NOT NULL,
	"quantity_wasted" integer DEFAULT 0,
	"was_in_stock" boolean DEFAULT false,
	"inventory_item_id" uuid,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"billable" boolean DEFAULT true,
	"warranty_period_months" integer,
	"serial_numbers" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar NOT NULL,
	"session_id" uuid,
	"file_name" varchar NOT NULL,
	"original_name" varchar,
	"mime_type" varchar NOT NULL,
	"file_size" integer,
	"object_path" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"address" text,
	"category" varchar,
	"description" text,
	"taken_at" timestamp,
	"uploaded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"category" varchar DEFAULT 'Service',
	"service_type" varchar,
	"pricing_level" varchar,
	"description" text,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"related_products" text,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric,
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric,
	"graphic_active" boolean DEFAULT false,
	"graphic_rep_price" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar,
	"installation_id" varchar,
	"signature_type" varchar NOT NULL,
	"signer_name" varchar NOT NULL,
	"signer_title" varchar,
	"signer_email" varchar,
	"signer_phone" varchar,
	"signature_data_url" text NOT NULL,
	"signature_method" varchar NOT NULL,
	"gps_latitude" numeric(10, 8),
	"gps_longitude" numeric(11, 8),
	"location_address" text,
	"ip_address" varchar,
	"user_agent" text,
	"device_info" jsonb,
	"signed_at" timestamp NOT NULL,
	"captured_by" varchar NOT NULL,
	"agreement_text" text,
	"consent_given" boolean DEFAULT true,
	"verified" boolean DEFAULT false,
	"verified_by" varchar,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_ticket_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"update_type" varchar NOT NULL,
	"old_value" text,
	"new_value" text,
	"notes" text,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"ticket_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"assigned_technician_id" varchar,
	"scheduled_date" timestamp,
	"estimated_duration" integer,
	"customer_address" text,
	"customer_phone" varchar,
	"required_skills" text[],
	"required_parts" text[],
	"work_order_notes" text,
	"resolution_notes" text,
	"customer_signature" text,
	"parts_used" text[],
	"labor_hours" numeric(4, 2),
	"created_by" varchar NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"request_id" varchar,
	"signer_id" varchar,
	"document_id" varchar,
	"event_type" varchar NOT NULL,
	"event_description" text,
	"actor_type" varchar,
	"actor_id" varchar,
	"actor_name" varchar,
	"actor_email" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"external_event_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signature_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"request_id" varchar NOT NULL,
	"document_order" integer DEFAULT 1 NOT NULL,
	"document_name" varchar NOT NULL,
	"document_type" varchar,
	"original_file_url" text,
	"signed_file_url" text,
	"certificate_url" text,
	"file_size" integer,
	"external_document_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"total_fields" integer DEFAULT 0,
	"completed_fields" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"request_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"customer_id" varchar,
	"proposal_id" varchar,
	"contract_id" varchar,
	"lease_id" varchar,
	"provider" varchar NOT NULL,
	"integration_id" varchar,
	"external_id" varchar,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"email_subject" varchar,
	"email_message" text,
	"reminder_enabled" boolean DEFAULT true,
	"reminder_days" integer DEFAULT 3,
	"sequential_signing" boolean DEFAULT false,
	"total_signers" integer DEFAULT 0,
	"signers_completed" integer DEFAULT 0,
	"total_documents" integer DEFAULT 0,
	"voided_reason" text,
	"declined_reason" text,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "signature_requests_tenant_request_number_unique" UNIQUE("tenant_id","request_number")
);
--> statement-breakpoint
CREATE TABLE "signature_signers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"request_id" varchar NOT NULL,
	"signer_order" integer DEFAULT 1 NOT NULL,
	"signer_type" varchar DEFAULT 'signer' NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"contact_id" varchar,
	"user_id" varchar,
	"external_signer_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"declined_at" timestamp,
	"signature_method" varchar,
	"ip_address" varchar,
	"decline_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_media_cron_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"cron_expression" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"prompt_template" text NOT NULL,
	"target_platforms" jsonb NOT NULL,
	"webhook_url" varchar NOT NULL,
	"last_executed" timestamp,
	"next_execution" timestamp,
	"execution_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_media_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"generation_type" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"claude_model" varchar DEFAULT 'claude-sonnet-4-20250514',
	"claude_prompt" text,
	"claude_response" jsonb,
	"title" varchar NOT NULL,
	"short_content" text NOT NULL,
	"long_content" text NOT NULL,
	"website_link" varchar DEFAULT 'https://printyx.net',
	"scheduled_for" timestamp,
	"cron_expression" varchar,
	"is_recurring" boolean DEFAULT false,
	"webhook_url" varchar,
	"webhook_payload" jsonb,
	"webhook_status" varchar,
	"webhook_sent_at" timestamp,
	"target_platforms" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "software_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"vendor" varchar,
	"product_type" varchar,
	"category" varchar,
	"accessory_type" varchar,
	"description" text,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"config_note" text,
	"related_products" text,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"standard_active" boolean DEFAULT false,
	"standard_cost" numeric,
	"standard_rep_price" numeric,
	"new_active" boolean DEFAULT false,
	"new_cost" numeric,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_cost" numeric,
	"upgrade_rep_price" numeric,
	"price_book_id" varchar,
	"temp_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stage_transitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"pipeline_template_id" varchar NOT NULL,
	"from_stage_id" varchar NOT NULL,
	"to_stage_id" varchar NOT NULL,
	"is_automatic" boolean DEFAULT false,
	"automatic_conditions" jsonb,
	"on_transition_actions" jsonb,
	"requires_approval" boolean DEFAULT false,
	"approval_role_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_addons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"billing_cycle" varchar(20),
	"stripe_price_id" varchar(100),
	"stripe_product_id" varchar(100),
	"unit" varchar(50),
	"quantity" integer DEFAULT 1,
	"applies_to_plans" jsonb DEFAULT '[]'::jsonb,
	"display_order" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_addons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subscription_id" varchar,
	"event_type" varchar(50) NOT NULL,
	"user_id" varchar,
	"from_plan" varchar,
	"to_plan" varchar,
	"data" jsonb DEFAULT '{}'::jsonb,
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50),
	"is_core" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_features_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscription_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"type" varchar(50) NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"action_url" varchar,
	"action_text" varchar(50),
	"channels" jsonb DEFAULT '["in_app"]'::jsonb,
	"sent_at" timestamp,
	"read_at" timestamp,
	"dismissed_at" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"next_retry_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"type" varchar(20) NOT NULL,
	"stripe_payment_method_id" varchar,
	"card_brand" varchar(20),
	"card_last4" varchar(4),
	"card_exp_month" integer,
	"card_exp_year" integer,
	"bank_name" varchar(100),
	"bank_last4" varchar(4),
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"billing_details" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"monthly_price" numeric(10, 2) NOT NULL,
	"annual_price" numeric(10, 2) NOT NULL,
	"annual_discount" integer DEFAULT 0,
	"max_users" integer NOT NULL,
	"max_storage" integer NOT NULL,
	"max_api_calls" integer NOT NULL,
	"max_locations" integer NOT NULL,
	"max_business_records" integer NOT NULL,
	"trial_enabled" boolean DEFAULT true,
	"trial_days" integer DEFAULT 14,
	"trial_requires_payment" boolean DEFAULT false,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"display_order" integer DEFAULT 0,
	"is_popular" boolean DEFAULT false,
	"is_visible" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"stripe_price_id_monthly" varchar(100),
	"stripe_price_id_annual" varchar(100),
	"stripe_product_id" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_plans_name_unique" UNIQUE("name"),
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "supplies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"product_type" varchar DEFAULT 'Supplies',
	"dealer_comp" varchar,
	"inventory" varchar,
	"in_stock" varchar,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"related_products" text,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric,
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric,
	"graphic_active" boolean DEFAULT false,
	"graphic_rep_price" numeric,
	"price_book_id" varchar,
	"temp_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supply_monitoring" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supply_monitoring_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"equipment_id" integer NOT NULL,
	"serial_number" text NOT NULL,
	"model" text NOT NULL,
	"location" text,
	"supply_type" "supply_type" NOT NULL,
	"supply_name" text NOT NULL,
	"part_number" text,
	"current_level" integer NOT NULL,
	"capacity_pages" integer,
	"daily_usage_average" numeric(10, 2),
	"weekly_usage_average" numeric(10, 2),
	"monthly_usage_average" numeric(10, 2),
	"usage_trend" text,
	"predicted_depletion_date" timestamp,
	"days_until_depletion" integer,
	"confidence_score" integer,
	"ai_analysis" jsonb,
	"reorder_threshold" integer DEFAULT 20,
	"reorder_quantity" integer DEFAULT 1,
	"auto_order_enabled" boolean DEFAULT true,
	"status" "supply_replenishment_status" DEFAULT 'monitoring',
	"priority" "order_priority" DEFAULT 'low',
	"alert_sent" boolean DEFAULT false,
	"alert_sent_at" timestamp,
	"last_checked_at" timestamp DEFAULT now() NOT NULL,
	"last_ordered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_replenishment_analytics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supply_replenishment_analytics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"period_type" text NOT NULL,
	"total_orders" integer DEFAULT 0,
	"auto_orders" integer DEFAULT 0,
	"manual_orders" integer DEFAULT 0,
	"emergency_orders_prevented" integer DEFAULT 0,
	"total_spend" numeric(10, 2) DEFAULT '0.00',
	"emergency_cost_savings" numeric(10, 2) DEFAULT '0.00',
	"bulk_discount_savings" numeric(10, 2) DEFAULT '0.00',
	"average_lead_time" numeric(10, 2),
	"on_time_delivery_rate" numeric(5, 2),
	"prediction_accuracy" numeric(5, 2),
	"stockouts_prevented" integer DEFAULT 0,
	"downtime_hours_prevented" numeric(10, 2) DEFAULT '0.00',
	"customer_satisfaction_score" numeric(5, 2),
	"complaints_received" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_replenishment_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supply_replenishment_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"auto_order_enabled" boolean DEFAULT true,
	"require_approval" boolean DEFAULT false,
	"approval_threshold" numeric(10, 2) DEFAULT '500.00',
	"default_reorder_threshold" integer DEFAULT 20,
	"urgent_threshold" integer DEFAULT 10,
	"critical_threshold" integer DEFAULT 5,
	"default_lead_time" integer DEFAULT 3,
	"buffer_days" integer DEFAULT 7,
	"preferred_supplier_id" integer,
	"alternate_supplier_ids" jsonb,
	"notify_on_order_placed" boolean DEFAULT true,
	"notify_on_delivery" boolean DEFAULT true,
	"notify_customers" boolean DEFAULT true,
	"notification_email" text,
	"notification_phone" text,
	"order_days_of_week" jsonb DEFAULT '[1,2,3,4,5]',
	"no_order_holidays" boolean DEFAULT true,
	"consolidate_orders" boolean DEFAULT true,
	"consolidation_window" integer DEFAULT 24,
	"ai_prediction_enabled" boolean DEFAULT true,
	"minimum_confidence_score" integer DEFAULT 70,
	"usage_history_days" integer DEFAULT 90,
	"max_order_value" numeric(10, 2),
	"monthly_budget" numeric(10, 2),
	"current_month_spend" numeric(10, 2) DEFAULT '0.00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supply_replenishment_rules_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "supply_usage_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supply_usage_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"supply_monitoring_id" integer NOT NULL,
	"equipment_id" integer NOT NULL,
	"serial_number" text NOT NULL,
	"supply_type" "supply_type" NOT NULL,
	"supply_name" text NOT NULL,
	"date_recorded" timestamp DEFAULT now() NOT NULL,
	"level_percentage" integer NOT NULL,
	"pages_remaining" integer,
	"pages_printed" integer,
	"pages_since_last_reading" integer,
	"day_of_week" integer,
	"month_of_year" integer,
	"is_weekend" boolean DEFAULT false,
	"is_holiday" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"severity" varchar DEFAULT 'medium',
	"source" varchar,
	"resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'disconnected' NOT NULL,
	"configuration" jsonb,
	"credentials" jsonb,
	"last_sync" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar,
	"created_by" varchar NOT NULL,
	"project_id" varchar,
	"parent_task_id" varchar,
	"due_date" timestamp,
	"start_date" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer,
	"completion_percentage" integer DEFAULT 0,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"watchers" jsonb DEFAULT '[]'::jsonb,
	"time_tracked" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"attachment_count" integer DEFAULT 0,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"location_id" varchar,
	"name" varchar(100) NOT NULL,
	"department" varchar(30) NOT NULL,
	"manager_id" varchar,
	"parent_team_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_availability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"start_time" varchar NOT NULL,
	"end_time" varchar NOT NULL,
	"is_booked" boolean DEFAULT false,
	"ticket_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"certification_type" varchar NOT NULL,
	"certification_number" varchar,
	"issued_date" timestamp,
	"expiration_date" timestamp,
	"certification_body" varchar,
	"document_url" varchar,
	"is_active" boolean DEFAULT true,
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_ticket_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"expected_latitude" numeric(10, 7),
	"expected_longitude" numeric(10, 7),
	"actual_latitude" numeric(10, 7),
	"actual_longitude" numeric(10, 7),
	"location_verified" boolean DEFAULT false,
	"distance_from_expected" numeric(8, 2),
	"check_in_timestamp" timestamp DEFAULT now(),
	"check_in_address" text,
	"check_in_notes" text,
	"workflow_step" varchar DEFAULT 'initial_assessment',
	"initial_assessment" text,
	"diagnosis_notes" text,
	"customer_approval_needed" boolean DEFAULT false,
	"customer_approval_received" boolean DEFAULT false,
	"work_performed" text,
	"parts_used_ids" jsonb DEFAULT '[]'::jsonb,
	"parts_requested_ids" jsonb DEFAULT '[]'::jsonb,
	"issue_resolved" boolean DEFAULT false,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_reason" text,
	"check_out_timestamp" timestamp,
	"total_duration_minutes" integer,
	"billable_hours" numeric(4, 2),
	"customer_present" boolean DEFAULT false,
	"customer_signature" text,
	"customer_satisfaction_rating" integer,
	"customer_feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"employee_id" varchar,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"skills" text[],
	"certifications" text[],
	"current_location" text,
	"is_active" boolean DEFAULT true,
	"is_available" boolean DEFAULT true,
	"working_hours" text,
	"hourly_rate" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_variables" (
	"id" varchar PRIMARY KEY NOT NULL,
	"template_id" varchar NOT NULL,
	"variable_name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"data_type" varchar(50) NOT NULL,
	"default_value" text,
	"required" boolean DEFAULT false NOT NULL,
	"validation_rules" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_addon_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subscription_id" varchar NOT NULL,
	"addon_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"canceled_at" timestamp,
	"stripe_subscription_item_id" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_clone_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_tenant_id" uuid NOT NULL,
	"target_tenant_id" uuid,
	"clone_type" varchar(50) NOT NULL,
	"clone_settings" jsonb NOT NULL,
	"status" "tenant_onboarding_status" DEFAULT 'not_started' NOT NULL,
	"progress_percent" integer DEFAULT 0,
	"items_cloned" jsonb,
	"modifications" jsonb,
	"initiated_by" uuid NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_minutes" integer,
	"error_count" integer DEFAULT 0,
	"errors" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_enabled_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"master_product_id" varchar,
	"source" varchar DEFAULT 'master' NOT NULL,
	"enabled" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"discontinued" boolean DEFAULT false,
	"custom_sku" varchar,
	"custom_name" varchar,
	"dealer_cost" numeric(10, 2),
	"markup_rule_id" varchar,
	"company_price" numeric(10, 2),
	"price_overridden" boolean DEFAULT false,
	"tenant_product_json" jsonb,
	"enabled_at" timestamp,
	"enabled_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_health_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"overall_score" integer NOT NULL,
	"overall_grade" "health_score_grade" NOT NULL,
	"isolation_score" integer NOT NULL,
	"isolation_grade" "health_score_grade",
	"access_score" integer NOT NULL,
	"access_grade" "health_score_grade",
	"integration_score" integer NOT NULL,
	"integration_grade" "health_score_grade",
	"data_quality_score" integer NOT NULL,
	"data_quality_grade" "health_score_grade",
	"performance_score" integer NOT NULL,
	"performance_grade" "health_score_grade",
	"validation_results" jsonb,
	"recommendations" jsonb,
	"critical_issues" integer DEFAULT 0,
	"warnings" integer DEFAULT 0,
	"dashboard_load_time_ms" integer,
	"avg_query_time_ms" integer,
	"error_rate" numeric(5, 2),
	"previous_score" integer,
	"score_change" integer,
	"trend" varchar(20),
	"checks_performed" integer NOT NULL,
	"checks_passed" integer NOT NULL,
	"checks_pass_rate" integer NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"next_calculation" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_health_scores_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"template_id" uuid,
	"current_step" integer DEFAULT 1 NOT NULL,
	"total_steps" integer DEFAULT 8 NOT NULL,
	"status" "tenant_onboarding_status" DEFAULT 'not_started' NOT NULL,
	"step_data" jsonb,
	"progress_percent" integer DEFAULT 0,
	"steps_completed" jsonb DEFAULT '[]'::jsonb,
	"validation_errors" jsonb,
	"tenant_id" uuid,
	"tenant_activated" boolean DEFAULT false,
	"created_by" uuid NOT NULL,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"abandoned_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"error_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_onboarding_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "tenant_onboarding_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"industry" "tenant_industry_type" NOT NULL,
	"company_size" "company_size" NOT NULL,
	"organizational_structure" jsonb NOT NULL,
	"subscription_plan" varchar(100),
	"default_billing_cycle" varchar(50),
	"default_trial_days" integer,
	"user_role_templates" jsonb,
	"integration_configs" jsonb,
	"custom_fields" jsonb,
	"workflows" jsonb,
	"sample_data" jsonb,
	"settings" jsonb,
	"branding_options" jsonb,
	"usage_count" integer DEFAULT 0,
	"avg_onboarding_time_minutes" integer,
	"success_rate_percent" integer,
	"last_used" timestamp,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tenant_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"billing_cycle" varchar(20) NOT NULL,
	"billing_interval" integer DEFAULT 1,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at" timestamp,
	"canceled_at" timestamp,
	"ended_at" timestamp,
	"is_trialing" boolean DEFAULT false,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"discount_id" varchar,
	"discount_amount" numeric(10, 2) DEFAULT '0',
	"discount_percent" integer DEFAULT 0,
	"is_free" boolean DEFAULT false,
	"custom_pricing" boolean DEFAULT false,
	"custom_limits" jsonb DEFAULT '{}'::jsonb,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"stripe_payment_intent_id" varchar,
	"usage_based_billing" boolean DEFAULT false,
	"overage_charges" numeric(10, 2) DEFAULT '0',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"domain" varchar,
	"subdomain_prefix" varchar,
	"path_prefix" varchar,
	"is_active" boolean DEFAULT true,
	"plan" varchar(20) DEFAULT 'basic',
	"subscription" varchar(20) DEFAULT 'trialing',
	"billing_status" varchar(20) DEFAULT 'pending',
	"last_activity" timestamp,
	"storage_used" integer DEFAULT 0,
	"api_calls" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain"),
	CONSTRAINT "tenants_subdomain_prefix_unique" UNIQUE("subdomain_prefix"),
	CONSTRAINT "tenants_path_prefix_unique" UNIQUE("path_prefix")
);
--> statement-breakpoint
CREATE TABLE "third_party_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_name" varchar(100) NOT NULL,
	"integration_name" varchar(255) NOT NULL,
	"status" "integration_status" DEFAULT 'pending' NOT NULL,
	"credentials" jsonb NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"supported_manufacturers" "manufacturer"[],
	"last_sync" timestamp,
	"next_sync" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_parts_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar NOT NULL,
	"session_id" uuid,
	"technician_id" varchar NOT NULL,
	"part_number" varchar NOT NULL,
	"part_description" varchar NOT NULL,
	"quantity_needed" integer NOT NULL,
	"urgency" "ticket_priority" NOT NULL,
	"justification" text,
	"requires_approval" boolean DEFAULT false,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_reason" text,
	"status" varchar DEFAULT 'requested',
	"estimated_cost" numeric(10, 2),
	"vendor_id" varchar,
	"expected_delivery_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_tracking_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"session_id" uuid NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"address" text,
	"check_in_type" "check_in_type" NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "toner_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"device_id" integer,
	"serial_number" text NOT NULL,
	"alert_type" text NOT NULL,
	"supply_type" text NOT NULL,
	"current_level" integer,
	"threshold" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by" integer,
	"resolved_at" timestamp,
	"order_created" boolean DEFAULT false,
	"order_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trial_activity_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signup_id" varchar NOT NULL,
	"tenant_id" varchar,
	"activity_type" varchar(50) NOT NULL,
	"description" text,
	"feature_module" varchar(100),
	"action_details" jsonb DEFAULT '{}'::jsonb,
	"engagement_value" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trial_communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signup_id" varchar NOT NULL,
	"campaign_name" varchar(255) NOT NULL,
	"email_template" varchar(100),
	"subject" varchar(255) NOT NULL,
	"sent_at" timestamp NOT NULL,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"status" varchar(20) DEFAULT 'sent',
	"clicked_url" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trigger_schedules" (
	"id" varchar PRIMARY KEY NOT NULL,
	"trigger_id" varchar NOT NULL,
	"cron_expression" varchar(255) NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"next_run_at" timestamp,
	"last_run_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"active_users" integer DEFAULT 0,
	"total_users" integer DEFAULT 0,
	"storage_used_mb" integer DEFAULT 0,
	"api_calls" integer DEFAULT 0,
	"active_locations" integer DEFAULT 0,
	"business_records" integer DEFAULT 0,
	"feature_usage" jsonb DEFAULT '{}'::jsonb,
	"is_over_limit" boolean DEFAULT false,
	"overage_details" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_customer_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"location_id" varchar,
	"user_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"assignment_type" varchar(20) DEFAULT 'primary' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_dashboard_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"active_layout_id" varchar,
	"refresh_interval" integer DEFAULT 60000,
	"theme" varchar(50) DEFAULT 'light',
	"show_grid_lines" boolean DEFAULT false,
	"compact_mode" boolean DEFAULT false,
	"global_filters" jsonb DEFAULT '{}'::jsonb,
	"widget_states" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_impersonation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"impersonated_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"ticket_number" varchar(100),
	"actions_performed" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_minutes" integer,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" "lifecycle_event_type" NOT NULL,
	"status" "lifecycle_status" NOT NULL,
	"template_id" uuid,
	"triggered_by" uuid NOT NULL,
	"automated_action" boolean DEFAULT false,
	"metadata" jsonb,
	"steps_completed" integer DEFAULT 0,
	"steps_total" integer,
	"current_step" varchar(255),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"error_details" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_location_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"access_type" varchar(20) DEFAULT 'full' NOT NULL,
	"assigned_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_provisioning_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"job_title" varchar(255),
	"role_ids" jsonb NOT NULL,
	"primary_role_id" uuid,
	"temporary_role_ids" jsonb,
	"temporary_role_duration_days" integer,
	"permissions" jsonb,
	"permission_overrides" jsonb,
	"preferences" jsonb,
	"notification_settings" jsonb,
	"integration_access" jsonb,
	"default_department" varchar(255),
	"default_location_id" uuid,
	"organizational_unit_level" varchar(50),
	"onboarding_steps" jsonb,
	"send_welcome_email" boolean DEFAULT true,
	"welcome_email_template" varchar(100),
	"assign_onboarding_buddy" boolean DEFAULT false,
	"check_in_days" jsonb,
	"usage_count" integer DEFAULT 0,
	"avg_onboarding_time_minutes" integer,
	"success_rate_percent" integer,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"organizational_unit_id" varchar,
	"assigned_by" varchar NOT NULL,
	"assignment_reason" text,
	"effective_from" timestamp DEFAULT now(),
	"effective_until" timestamp,
	"territory_restrictions" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"phone" varchar,
	"job_title" varchar,
	"department" varchar,
	"bio" text,
	"avatar" varchar,
	"theme" varchar(20) DEFAULT 'system',
	"language" varchar(10) DEFAULT 'en',
	"timezone" varchar DEFAULT 'America/New_York',
	"date_format" varchar DEFAULT 'MM/dd/yyyy',
	"time_format" varchar(2) DEFAULT '12',
	"currency" varchar(3) DEFAULT 'USD',
	"notifications" jsonb DEFAULT '{"email": true, "push": true, "sms": false, "marketing": false}',
	"accessibility" jsonb DEFAULT '{"highContrast": false, "reducedMotion": false, "fontSize": "medium", "screenReader": false, "keyboardNavigation": false, "colorBlind": "none", "soundEnabled": true, "voiceCommands": false}',
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"role" varchar,
	"role_id" varchar,
	"team_id" varchar,
	"manager_id" varchar,
	"employee_id" varchar,
	"primary_location_id" varchar,
	"region_id" varchar,
	"access_scope" varchar(20) DEFAULT 'location',
	"is_platform_user" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"bill_number" varchar(100),
	"transaction_date" timestamp NOT NULL,
	"due_date" timestamp,
	"vendor_id" varchar,
	"ap_account_id" varchar,
	"total_amount" numeric(15, 2) NOT NULL,
	"balance_due" numeric(15, 2) NOT NULL,
	"department_id" varchar,
	"currency_id" varchar,
	"exchange_rate" numeric(10, 6),
	"private_note" text,
	"memo" text,
	"line_items_json" jsonb,
	"linked_transactions_json" jsonb,
	"remit_to_address_json" jsonb,
	"tax_detail_json" jsonb,
	"payment_terms_id" varchar,
	"global_tax_calculation" varchar,
	"transaction_location_type" varchar,
	"class_id" varchar,
	"sales_terms_id" varchar,
	"recurring_data_id" varchar,
	"external_bill_id" varchar,
	"qb_domain" varchar,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_vendor_id" varchar,
	"last_sync_date" timestamp,
	"vendor_name" varchar NOT NULL,
	"primary_contact_name" varchar,
	"address_line_1" varchar,
	"address_line_2" varchar,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"phone" varchar,
	"fax" varchar,
	"email" varchar,
	"website" varchar,
	"payment_terms" varchar,
	"tax_id" varchar,
	"account_number" varchar,
	"credit_limit" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"vendor_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouse_kitting_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"purchase_order_id" varchar,
	"order_number" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"kit_name" varchar NOT NULL,
	"equipment_model" varchar,
	"required_accessories" jsonb DEFAULT '[]'::jsonb,
	"checklist_items" jsonb DEFAULT '[]'::jsonb,
	"first_pass_yield" boolean DEFAULT false,
	"quality_status" "kit_quality_status" DEFAULT 'pending_inspection',
	"defects_found" jsonb DEFAULT '[]'::jsonb,
	"rework_required" boolean DEFAULT false,
	"rework_count" integer DEFAULT 0,
	"rework_notes" text,
	"assigned_technician" varchar NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"total_duration_minutes" integer,
	"operation_status" "warehouse_operation_status" DEFAULT 'pending',
	"completed_by" varchar,
	"supervisor_approval" boolean DEFAULT false,
	"approved_by" varchar,
	"approved_at" timestamp,
	"asset_tags" jsonb DEFAULT '[]'::jsonb,
	"firmware_versions" jsonb DEFAULT '{}'::jsonb,
	"serial_numbers" jsonb DEFAULT '[]'::jsonb,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouse_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"operation_type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"notes" text,
	"quality_control_checks" jsonb,
	"photos" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "white_label_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"company_tagline" varchar(255),
	"logo_url" text,
	"logo_square_url" text,
	"favicon_url" text,
	"custom_domain" varchar(255),
	"custom_domain_verified" boolean DEFAULT false,
	"custom_domain_verified_at" timestamp,
	"color_primary" varchar(7) DEFAULT '#6366f1',
	"color_secondary" varchar(7) DEFAULT '#8b5cf6',
	"color_accent" varchar(7) DEFAULT '#ec4899',
	"color_success" varchar(7) DEFAULT '#10b981',
	"color_warning" varchar(7) DEFAULT '#f59e0b',
	"color_error" varchar(7) DEFAULT '#ef4444',
	"color_background" varchar(7) DEFAULT '#ffffff',
	"color_text" varchar(7) DEFAULT '#1f2937',
	"font_family" varchar(100) DEFAULT 'Inter, sans-serif',
	"font_heading_family" varchar(100),
	"welcome_title" varchar(255),
	"welcome_message" text,
	"welcome_banner_url" text,
	"support_email" varchar(255),
	"support_phone" varchar(50),
	"support_hours_text" text,
	"terms_of_service_url" text,
	"privacy_policy_url" text,
	"custom_terms_of_service" text,
	"custom_privacy_policy" text,
	"features" jsonb DEFAULT '{"enableServiceRequests":true,"enableSupplyOrdering":true,"enableMeterSubmission":true,"enableInvoicePayments":true,"enableEquipmentMonitoring":true,"enableKnowledgeBase":true,"enableLiveChat":false,"showEquipmentDetails":true,"showUsageAnalytics":true,"showMaintenanceHistory":true}'::jsonb,
	"custom_css" text,
	"custom_js" text,
	"analytics_code" text,
	"social_links" jsonb,
	"mobile_app_name" varchar(100),
	"mobile_app_icon_url" text,
	"mobile_app_splash_screen_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "white_label_email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"template_name" varchar(255) NOT NULL,
	"description" text,
	"from_name" varchar(255),
	"from_email" varchar(255),
	"reply_to_email" varchar(255),
	"subject" varchar(500) NOT NULL,
	"html_body" text NOT NULL,
	"text_body" text,
	"available_variables" jsonb,
	"include_header" boolean DEFAULT true,
	"include_footer" boolean DEFAULT true,
	"custom_header" text,
	"custom_footer" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false,
	"sent_count" varchar DEFAULT '0',
	"last_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "white_label_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_name" varchar(255) NOT NULL,
	"preset_slug" varchar(100) NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"config" jsonb NOT NULL,
	"is_public" boolean DEFAULT true,
	"usage_count" varchar DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "white_label_presets_preset_slug_unique" UNIQUE("preset_slug")
);
--> statement-breakpoint
CREATE TABLE "workflow_approvals" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"execution_id" varchar NOT NULL,
	"step_execution_id" varchar NOT NULL,
	"assigned_to_user_id" varchar,
	"assigned_to_group_id" varchar,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approval_comment" text,
	"due_date" timestamp,
	"context_data" jsonb,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_conditions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"trigger_id" varchar,
	"step_id" varchar,
	"condition_group" varchar(50),
	"logical_operator" "logical_operator" DEFAULT 'AND' NOT NULL,
	"left_operand" varchar NOT NULL,
	"operator" "condition_operator" NOT NULL,
	"right_operand" varchar,
	"data_type" varchar(50),
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_event_registry" (
	"id" varchar PRIMARY KEY NOT NULL,
	"event_name" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"payload_schema" jsonb NOT NULL,
	"example_payload" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_event_registry_event_name_unique" UNIQUE("event_name")
);
--> statement-breakpoint
CREATE TABLE "workflow_execution_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"execution_id" varchar NOT NULL,
	"step_execution_id" varchar,
	"event_type" varchar(100) NOT NULL,
	"event_data" jsonb,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_execution_steps" (
	"id" varchar PRIMARY KEY NOT NULL,
	"execution_id" varchar NOT NULL,
	"step_id" varchar NOT NULL,
	"step_name" varchar(255) NOT NULL,
	"status" "step_execution_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_executions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"workflow_id" varchar NOT NULL,
	"workflow_version_id" varchar NOT NULL,
	"trigger_id" varchar,
	"tenant_id" varchar NOT NULL,
	"status" "execution_status" DEFAULT 'queued' NOT NULL,
	"initiated_by" varchar,
	"context" jsonb,
	"result" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_step_transitions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"step_id" varchar NOT NULL,
	"condition" varchar(50) NOT NULL,
	"next_step_id" varchar,
	"condition_expression" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"session_id" uuid NOT NULL,
	"step_name" varchar NOT NULL,
	"step_started" timestamp DEFAULT now(),
	"step_completed" timestamp,
	"step_data" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_steps_automation" (
	"id" varchar PRIMARY KEY NOT NULL,
	"workflow_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"action_type" "step_action_type" NOT NULL,
	"config" jsonb NOT NULL,
	"order_index" integer NOT NULL,
	"retry_enabled" boolean DEFAULT false NOT NULL,
	"max_retries" integer DEFAULT 3,
	"retry_delay_seconds" integer DEFAULT 60,
	"timeout_seconds" integer DEFAULT 300,
	"continue_on_error" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"definition" jsonb NOT NULL,
	"version" varchar(50) NOT NULL,
	"preview_image" text,
	"complexity" varchar(20),
	"estimated_time_saved" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_triggers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"workflow_id" varchar NOT NULL,
	"type" "trigger_type" NOT NULL,
	"event_name" varchar(255),
	"webhook_path" varchar(255),
	"payload_mapping" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_versions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"workflow_id" varchar NOT NULL,
	"version" integer NOT NULL,
	"schema_hash" varchar(64),
	"definition" jsonb NOT NULL,
	"changelog" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_version_unique" UNIQUE("workflow_id","version")
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" varchar,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_by" varchar,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_bulk_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"equipment_ids" jsonb NOT NULL,
	"operation_data" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"total_count" integer NOT NULL,
	"success_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"results" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_disposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"disposal_type" varchar(50) NOT NULL,
	"disposal_date" timestamp NOT NULL,
	"disposal_vendor" varchar(200),
	"disposal_cost" numeric(10, 2),
	"certificate_url" varchar(500),
	"data_wiped" boolean DEFAULT false NOT NULL,
	"environmental_compliance" boolean DEFAULT true,
	"write_off_amount" numeric(10, 2),
	"salvage_value" numeric(10, 2),
	"disposal_photos" jsonb,
	"disposal_notes" text,
	"approved_by" uuid,
	"approved_at" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "equipment_lifecycle_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"from_stage" varchar(50),
	"to_stage" varchar(50) NOT NULL,
	"transition_type" varchar(50) NOT NULL,
	"triggered_by" uuid,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"validations_passed" jsonb,
	"validations_failed" jsonb,
	"is_rollback" boolean DEFAULT false,
	"rollback_reason" text,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment_trade_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trade_in_equipment_id" uuid,
	"new_equipment_id" uuid,
	"customer_id" uuid NOT NULL,
	"evaluation_date" timestamp,
	"evaluated_by" uuid,
	"condition" varchar(50),
	"estimated_value" numeric(10, 2),
	"approved_value" numeric(10, 2),
	"bw_meter_reading" integer,
	"color_meter_reading" integer,
	"credit_amount" numeric(10, 2),
	"credit_applied_to" varchar(100),
	"evaluation_checklist" jsonb,
	"photos" jsonb,
	"notes" text,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "equipment_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"transfer_type" varchar(50) NOT NULL,
	"from_customer_id" uuid,
	"from_location" varchar(200),
	"to_customer_id" uuid,
	"to_location" varchar(200),
	"transfer_date" timestamp NOT NULL,
	"transfer_reason" text,
	"requested_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp,
	"delivery_schedule_id" uuid,
	"installation_schedule_id" uuid,
	"transfer_cost" numeric(10, 2),
	"billed_to_customer" boolean DEFAULT false,
	"compliance_documents" jsonb,
	"notes" text,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lifecycle_transition_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"from_stage" varchar(50) NOT NULL,
	"to_stage" varchar(50) NOT NULL,
	"is_allowed" boolean DEFAULT true NOT NULL,
	"required_validations" jsonb,
	"auto_trigger_conditions" jsonb,
	"notification_templates" jsonb,
	"allow_rollback" boolean DEFAULT false,
	"rollback_time_limit_hours" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "apollo_api_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"endpoint" varchar NOT NULL,
	"method" varchar NOT NULL,
	"request_params" jsonb,
	"status_code" integer,
	"success" boolean DEFAULT true,
	"error_message" text,
	"credits_used" integer DEFAULT 1,
	"response_time_ms" integer,
	"rate_limit_remaining" integer,
	"rate_limit_reset" timestamp,
	"created_at" timestamp DEFAULT now(),
	"user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "apollo_search_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_hash" varchar NOT NULL,
	"search_filters" jsonb NOT NULL,
	"result_count" integer DEFAULT 0,
	"total_available" integer DEFAULT 0,
	"apollo_ids" jsonb,
	"expires_at" timestamp NOT NULL,
	"hit_count" integer DEFAULT 1,
	"api_credits_used" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"last_accessed_at" timestamp DEFAULT now(),
	CONSTRAINT "apollo_search_cache_search_hash_unique" UNIQUE("search_hash")
);
--> statement-breakpoint
CREATE TABLE "centralized_apollo_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apollo_id" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"name" varchar,
	"title" varchar,
	"email" varchar,
	"email_status" varchar,
	"linkedin_url" varchar,
	"phone_numbers" jsonb,
	"organization_id" varchar,
	"organization_name" varchar,
	"website_url" varchar,
	"company_domain" varchar,
	"company_size" varchar,
	"employee_count" integer,
	"industry" varchar,
	"company_location" varchar,
	"seniority" varchar,
	"departments" jsonb,
	"functions" jsonb,
	"raw_data" jsonb,
	"last_enriched_at" timestamp DEFAULT now(),
	"enrichment_version" integer DEFAULT 1,
	"access_count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "centralized_apollo_contacts_apollo_id_unique" UNIQUE("apollo_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_apollo_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"apollo_contact_id" varchar NOT NULL,
	"apollo_id" varchar NOT NULL,
	"status" varchar DEFAULT 'discovered' NOT NULL,
	"added_to_crm" boolean DEFAULT false,
	"business_record_id" varchar,
	"search_query" jsonb,
	"discovered_via" varchar DEFAULT 'apollo_search',
	"viewed_at" timestamp,
	"viewed_by" varchar,
	"added_at" timestamp,
	"added_by" varchar,
	"rejected_at" timestamp,
	"rejected_by" varchar,
	"rejection_reason" text,
	"notes" text,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_discovered_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"mac_address" varchar(17),
	"serial_number" varchar(255),
	"manufacturer" varchar(100),
	"model" varchar(255),
	"protocol" varchar(50),
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"is_registered" boolean DEFAULT false,
	"registered_device_id" uuid,
	"first_discovered" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" varchar(100) NOT NULL,
	"client_name" varchar(255) NOT NULL,
	"client_type" "client_type" DEFAULT 'on_premise' NOT NULL,
	"status" "client_status" DEFAULT 'pending_setup' NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"api_key_last_rotated" timestamp,
	"version" varchar(50),
	"hostname" varchar(255),
	"ip_address" varchar(45),
	"network_ranges" text[],
	"configuration" jsonb DEFAULT '{"pollingInterval":300,"discoveryEnabled":true,"retryAttempts":3,"timeout":10000,"tonerThreshold":15,"paperThreshold":20}'::jsonb,
	"last_heartbeat" timestamp,
	"last_successful_collection" timestamp,
	"total_devices_monitored" jsonb DEFAULT '0'::jsonb,
	"total_metrics_collected" jsonb DEFAULT '0'::jsonb,
	"description" text,
	"location" varchar(255),
	"contact_email" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monitoring_clients_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "monitoring_clients_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "irs_mileage_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"trip_date" timestamp NOT NULL,
	"start_location" text NOT NULL,
	"end_location" text NOT NULL,
	"business_purpose" text NOT NULL,
	"miles_driven" numeric(8, 2) NOT NULL,
	"odometer_start" numeric(10, 1),
	"odometer_end" numeric(10, 1),
	"vehicle_used" varchar,
	"tolls" numeric(8, 2),
	"parking" numeric(8, 2),
	"ticket_id" varchar,
	"customer_id" varchar,
	"customer_name" varchar,
	"tax_year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mileage_reimbursement_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rate_name" varchar NOT NULL,
	"rate_description" text,
	"rate_type" varchar NOT NULL,
	"rate_per_mile" numeric(6, 4) NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"effective_start_date" timestamp NOT NULL,
	"effective_end_date" timestamp,
	"applies_to_all_technicians" boolean DEFAULT true,
	"applicable_technician_ids" jsonb,
	"applicable_vehicle_types" jsonb,
	"max_daily_miles" numeric(8, 2),
	"max_monthly_miles" numeric(10, 2),
	"max_annual_miles" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mileage_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"report_number" varchar NOT NULL,
	"report_type" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"technician_id" varchar,
	"total_miles" numeric(12, 2) NOT NULL,
	"business_miles" numeric(12, 2) NOT NULL,
	"personal_miles" numeric(12, 2),
	"commute_miles" numeric(12, 2),
	"total_reimbursement" numeric(12, 2),
	"average_rate_per_mile" numeric(6, 4),
	"total_trips" integer,
	"total_service_calls" integer,
	"average_miles_per_trip" numeric(8, 2),
	"average_miles_per_day" numeric(8, 2),
	"total_fuel_gallons" numeric(10, 3),
	"total_fuel_cost" numeric(10, 2),
	"average_mpg" numeric(6, 2),
	"cost_per_mile" numeric(6, 4),
	"daily_breakdown" jsonb,
	"report_status" varchar DEFAULT 'draft',
	"submitted_at" timestamp,
	"submitted_by" varchar,
	"approved_at" timestamp,
	"approved_by" varchar,
	"rejection_reason" text,
	"payment_date" timestamp,
	"payment_reference" varchar,
	"payment_method" varchar,
	"exported_to_payroll" boolean DEFAULT false,
	"exported_at" timestamp,
	"export_format" varchar,
	"notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mileage_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
CREATE TABLE "technician_mileage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"week_number" integer,
	"month_number" integer,
	"year" integer,
	"start_odometer" numeric(10, 1),
	"end_odometer" numeric(10, 1),
	"total_miles" numeric(10, 2) NOT NULL,
	"gps_calculated_miles" numeric(10, 2),
	"business_miles" numeric(10, 2) DEFAULT '0' NOT NULL,
	"personal_miles" numeric(10, 2) DEFAULT '0',
	"commute_miles" numeric(10, 2) DEFAULT '0',
	"number_of_trips" integer DEFAULT 0,
	"number_of_stops" integer DEFAULT 0,
	"route_ids" jsonb,
	"ticket_ids" jsonb,
	"start_location" jsonb,
	"end_location" jsonb,
	"reimbursement_rate" numeric(6, 4),
	"reimbursement_amount" numeric(10, 2),
	"reimbursement_status" varchar DEFAULT 'pending',
	"fuel_purchased" numeric(6, 3),
	"fuel_cost" numeric(8, 2),
	"fuel_receipt_attached" boolean DEFAULT false,
	"vehicle_id" varchar,
	"vehicle_plate_number" varchar,
	"verification_method" varchar DEFAULT 'gps',
	"is_verified" boolean DEFAULT false,
	"verified_by" varchar,
	"verified_at" timestamp,
	"notes" text,
	"adjustment_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"vehicle_name" varchar NOT NULL,
	"vehicle_type" varchar NOT NULL,
	"make" varchar,
	"model" varchar,
	"year" integer,
	"plate_number" varchar,
	"vin" varchar,
	"assigned_to_technician_id" varchar,
	"assignment_start_date" timestamp NOT NULL,
	"assignment_end_date" timestamp,
	"current_odometer" numeric(10, 1),
	"last_odometer_update" timestamp,
	"estimated_mpg" numeric(6, 2),
	"fuel_type" varchar,
	"insurance_provider" varchar,
	"insurance_expiry" timestamp,
	"registration_expiry" timestamp,
	"last_maintenance_date" timestamp,
	"next_maintenance_due" timestamp,
	"next_maintenance_miles" numeric(10, 1),
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofence_alert_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"rule_description" text,
	"geofence_id" varchar NOT NULL,
	"trigger_type" varchar NOT NULL,
	"active_start_time" varchar,
	"active_end_time" varchar,
	"active_days" jsonb,
	"timezone" varchar DEFAULT 'America/New_York',
	"dwell_time_minutes" integer,
	"max_dwell_time_minutes" integer,
	"severity" varchar DEFAULT 'info' NOT NULL,
	"notify_by_email" boolean DEFAULT true,
	"notify_by_push" boolean DEFAULT true,
	"notify_by_sms" boolean DEFAULT false,
	"notify_in_app" boolean DEFAULT true,
	"notify_users" jsonb,
	"notify_roles" jsonb,
	"notify_technician_manager" boolean DEFAULT true,
	"notify_customer" boolean DEFAULT false,
	"alert_title" varchar,
	"alert_message" text,
	"cooldown_minutes" integer DEFAULT 15,
	"last_triggered_at" timestamp,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofence_alert_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_type" varchar NOT NULL,
	"geofence_id" varchar,
	"technician_id" varchar,
	"customer_id" varchar,
	"alert_rule_id" varchar,
	"min_severity" varchar DEFAULT 'info',
	"email_enabled" boolean DEFAULT true,
	"push_enabled" boolean DEFAULT true,
	"sms_enabled" boolean DEFAULT false,
	"in_app_enabled" boolean DEFAULT true,
	"quiet_hours_enabled" boolean DEFAULT false,
	"quiet_hours_start" varchar,
	"quiet_hours_end" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofence_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"alert_number" varchar NOT NULL,
	"alert_rule_id" varchar NOT NULL,
	"geofence_id" varchar NOT NULL,
	"geofence_event_id" varchar,
	"technician_id" varchar NOT NULL,
	"alert_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"trigger_location" jsonb NOT NULL,
	"geofence_name" varchar,
	"geofence_type" varchar,
	"technician_name" varchar,
	"technician_status" varchar,
	"ticket_id" varchar,
	"customer_id" varchar,
	"customer_name" varchar,
	"route_id" varchar,
	"dwell_duration_minutes" integer,
	"expected_dwell_minutes" integer,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"notifications_sent" jsonb,
	"notified_users" jsonb,
	"notification_errors" jsonb,
	"is_acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar,
	"acknowledgment_notes" text,
	"is_resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"resolution_type" varchar,
	"resolution_notes" text,
	"is_escalated" boolean DEFAULT false,
	"escalated_at" timestamp,
	"escalated_to" varchar,
	"escalation_reason" text,
	"auto_resolved_at" timestamp,
	"auto_resolve_reason" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "geofence_alerts_alert_number_unique" UNIQUE("alert_number")
);
--> statement-breakpoint
CREATE TABLE "technician_dwell_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"geofence_id" varchar NOT NULL,
	"entry_time" timestamp NOT NULL,
	"exit_time" timestamp,
	"dwell_duration_minutes" integer,
	"is_active" boolean DEFAULT true,
	"session_status" varchar DEFAULT 'active',
	"entry_location" jsonb NOT NULL,
	"entry_event_id" varchar,
	"exit_location" jsonb,
	"exit_event_id" varchar,
	"ticket_id" varchar,
	"customer_id" varchar,
	"route_id" varchar,
	"expected_dwell_minutes" integer,
	"alerts_triggered" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"category" "report_category" NOT NULL,
	"calculation_sql" text NOT NULL,
	"target_value" numeric(15, 2),
	"target_type" "target_type" DEFAULT 'absolute',
	"display_format" "display_format" DEFAULT 'number',
	"prefix" varchar(10),
	"suffix" varchar(10),
	"decimal_places" integer DEFAULT 0,
	"color_scheme" jsonb DEFAULT '{}',
	"alert_enabled" boolean DEFAULT false,
	"alert_thresholds" jsonb DEFAULT '{}',
	"alert_recipients" jsonb DEFAULT '[]',
	"required_permissions" jsonb NOT NULL,
	"organizational_scope" "organizational_scope" NOT NULL,
	"refresh_frequency" integer DEFAULT 3600,
	"cache_duration" integer DEFAULT 300,
	"is_active" boolean DEFAULT true,
	"is_high_priority" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_values" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"kpi_definition_id" varchar NOT NULL,
	"location_id" varchar,
	"region_id" varchar,
	"user_id" varchar,
	"team_id" varchar,
	"department_id" varchar,
	"date_value" date NOT NULL,
	"time_period" time_period NOT NULL,
	"fiscal_year" integer,
	"fiscal_quarter" integer,
	"actual_value" numeric(15, 2) NOT NULL,
	"target_value" numeric(15, 2),
	"variance_value" numeric(15, 2),
	"variance_percentage" numeric(8, 4),
	"performance_level" "performance_level",
	"is_target_met" boolean,
	"alert_triggered" boolean DEFAULT false,
	"calculation_timestamp" timestamp DEFAULT now(),
	"data_freshness" timestamp,
	"source_query" text,
	"data_quality_score" integer,
	"confidence_level" numeric(5, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"category" "report_category" NOT NULL,
	"sql_query" text NOT NULL,
	"default_parameters" jsonb DEFAULT '{}',
	"available_filters" jsonb DEFAULT '{}',
	"available_groupings" jsonb DEFAULT '{}',
	"required_permissions" jsonb NOT NULL,
	"organizational_scope" "organizational_scope" NOT NULL,
	"contains_sensitive_data" boolean DEFAULT false,
	"default_visualization" "report_visualization" DEFAULT 'table',
	"chart_config" jsonb DEFAULT '{}',
	"cache_duration" integer DEFAULT 300,
	"query_timeout" integer DEFAULT 30,
	"max_row_limit" integer DEFAULT 10000,
	"is_real_time" boolean DEFAULT false,
	"supports_drill_down" boolean DEFAULT false,
	"supports_export" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"version" varchar(10) DEFAULT '1.0',
	"tags" jsonb DEFAULT '[]',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_executions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"report_definition_id" varchar NOT NULL,
	"user_id" varchar,
	"schedule_id" varchar,
	"parameters" jsonb DEFAULT '{}',
	"filters" jsonb DEFAULT '{}',
	"execution_time_ms" integer,
	"row_count" integer,
	"data_size" integer,
	"cache_hit" boolean DEFAULT false,
	"export_format" "export_format",
	"file_path" varchar(500),
	"file_size" integer,
	"download_count" integer DEFAULT 0,
	"status" "report_status" NOT NULL,
	"error_message" text,
	"error_code" varchar(50),
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"report_definition_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cron_expression" varchar(100) NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC',
	"parameters" jsonb DEFAULT '{}',
	"filters" jsonb DEFAULT '{}',
	"recipients" jsonb NOT NULL,
	"delivery_method" "delivery_method" DEFAULT 'email',
	"export_format" "export_format" DEFAULT 'pdf',
	"email_subject" varchar(255),
	"email_body" text,
	"attach_file_name" varchar(255),
	"is_active" boolean DEFAULT true,
	"last_run" timestamp,
	"next_run" timestamp,
	"run_count" integer DEFAULT 0,
	"last_status" "report_status",
	"last_error" text,
	"average_execution_time" integer,
	"last_execution_time" integer,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_report_activity" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" "activity_type" NOT NULL,
	"report_definition_id" varchar,
	"kpi_definition_id" varchar,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"referrer" varchar,
	"parameters" jsonb DEFAULT '{}',
	"duration_seconds" integer,
	"load_time_ms" integer,
	"error_occurred" boolean DEFAULT false,
	"error_message" text,
	"scroll_depth" integer,
	"export_count" integer DEFAULT 0,
	"share_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_report_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"report_definition_id" varchar NOT NULL,
	"custom_filters" jsonb DEFAULT '{}',
	"custom_groupings" jsonb DEFAULT '{}',
	"custom_chart_config" jsonb DEFAULT '{}',
	"custom_columns" jsonb DEFAULT '[]',
	"sort_preferences" jsonb DEFAULT '{}',
	"favorite_dashboard" boolean DEFAULT false,
	"dashboard_position" integer,
	"widget_size" varchar(20) DEFAULT 'medium',
	"last_accessed" timestamp,
	"access_count" integer DEFAULT 0,
	"average_view_duration" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accessibility_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"audit_type" varchar(100) NOT NULL,
	"page_url" varchar(500) NOT NULL,
	"wcag_level" varchar(10) NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"issues_found" jsonb,
	"issue_count" jsonb,
	"tool_used" varchar(100),
	"tool_version" varchar(50),
	"auditor_id" uuid,
	"auditor_name" varchar(255),
	"notes" varchar(5000),
	"audit_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessibility_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"category" varchar(100) NOT NULL,
	"severity" varchar(50),
	"page_url" varchar(500),
	"component_name" varchar(200),
	"description" varchar(5000) NOT NULL,
	"user_email" varchar(255),
	"user_name" varchar(255),
	"assistive_technology" varchar(255),
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"resolution" varchar(2000),
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"browser_info" varchar(500),
	"os_info" varchar(255),
	"screen_size" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_accessibility_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"high_contrast" boolean DEFAULT false NOT NULL,
	"font_size" "font_size" DEFAULT 'normal' NOT NULL,
	"color_blind" "color_blind_type" DEFAULT 'none' NOT NULL,
	"focus_indicators" boolean DEFAULT true NOT NULL,
	"underline_links" boolean DEFAULT false NOT NULL,
	"cursor_size" "cursor_size" DEFAULT 'normal' NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"screen_reader" boolean DEFAULT false NOT NULL,
	"keyboard_navigation" boolean DEFAULT true NOT NULL,
	"voice_commands" boolean DEFAULT false NOT NULL,
	"custom_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_accessibility_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "billing_disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"dispute_number" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"meter_reading_id" varchar,
	"dispute_type" varchar NOT NULL,
	"dispute_status" varchar DEFAULT 'open',
	"severity" varchar DEFAULT 'medium',
	"disputed_amount" numeric(10, 2) NOT NULL,
	"approved_credit_amount" numeric(10, 2) DEFAULT '0',
	"customer_complaint" text NOT NULL,
	"customer_contact_name" varchar,
	"customer_contact_email" varchar,
	"customer_contact_phone" varchar,
	"filed_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"assigned_to" varchar,
	"assigned_at" timestamp,
	"priority_level" integer DEFAULT 3,
	"internal_notes" text,
	"research_notes" text,
	"resolution_type" varchar,
	"resolution_description" text,
	"resolution_date" timestamp,
	"resolved_by" varchar,
	"credit_memo_id" varchar,
	"credit_memo_number" varchar,
	"credit_memo_amount" numeric(10, 2),
	"credit_memo_issued" boolean DEFAULT false,
	"credit_memo_issued_at" timestamp,
	"corrected_invoice_id" varchar,
	"communication_log" jsonb,
	"requires_manager_approval" boolean DEFAULT false,
	"manager_approved" boolean,
	"approved_by" varchar,
	"approved_at" timestamp,
	"approval_notes" text,
	"escalated" boolean DEFAULT false,
	"escalated_to" varchar,
	"escalated_at" timestamp,
	"escalation_reason" text,
	"customer_satisfaction_rating" integer,
	"customer_feedback" text,
	"preventative_action" text,
	"metadata" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "billing_disputes_dispute_number_unique" UNIQUE("dispute_number")
);
--> statement-breakpoint
CREATE TABLE "credit_memos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"credit_memo_number" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"invoice_id" varchar,
	"dispute_id" varchar,
	"credit_amount" numeric(10, 2) NOT NULL,
	"credit_reason" varchar NOT NULL,
	"credit_description" text,
	"credit_status" varchar DEFAULT 'pending',
	"applied_to_invoice" boolean DEFAULT false,
	"applied_to_invoice_id" varchar,
	"applied_at" timestamp,
	"issued_date" timestamp NOT NULL,
	"expiration_date" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"voided_by" varchar,
	"voided_at" timestamp,
	"void_reason" text,
	"metadata" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "credit_memos_credit_memo_number_unique" UNIQUE("credit_memo_number")
);
--> statement-breakpoint
CREATE TABLE "api_key_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"bucket_type" varchar(20) NOT NULL,
	"bucket_key" varchar(50) NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"bucket_start" timestamp NOT NULL,
	"bucket_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_rate_limits_bucket_unique" UNIQUE("api_key_id","bucket_type","bucket_key")
);
--> statement-breakpoint
CREATE TABLE "api_key_rotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"old_key_prefix" varchar(12) NOT NULL,
	"old_key_hash" varchar(128) NOT NULL,
	"new_key_prefix" varchar(12) NOT NULL,
	"rotated_at" timestamp DEFAULT now() NOT NULL,
	"rotated_by" uuid,
	"reason" text,
	"grace_period_ends_at" timestamp,
	"old_key_disabled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "api_key_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"request_id" varchar(255),
	"method" varchar(10) NOT NULL,
	"path" varchar(1024) NOT NULL,
	"query_params" jsonb DEFAULT '{}'::jsonb,
	"status_code" integer,
	"response_time_ms" integer,
	"error_message" text,
	"client_ip" varchar(45),
	"user_agent" text,
	"origin" varchar(512),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"key_type" "api_key_type" DEFAULT 'service' NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"key_salt" varchar(64) NOT NULL,
	"status" "api_key_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"never_expires" boolean DEFAULT false NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"allowed_ips" jsonb DEFAULT '[]'::jsonb,
	"allow_all_ips" boolean DEFAULT true NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 1000,
	"rate_limit_per_hour" integer DEFAULT 10000,
	"rate_limit_per_day" integer DEFAULT 100000,
	"last_used_at" timestamp,
	"usage_count" varchar(20) DEFAULT '0',
	"last_used_ip" varchar(45),
	"last_used_user_agent" text,
	"environment" varchar(50) DEFAULT 'production',
	"allowed_environments" jsonb DEFAULT '["production"]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_by" uuid,
	"revoked_by" uuid,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_verifications_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp DEFAULT now() NOT NULL,
	"locked_until" timestamp,
	"last_ip_address" varchar(45),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "login_attempts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_resets_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "blog_content_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" varchar(500) NOT NULL,
	"primary_keyword" varchar(255) NOT NULL,
	"secondary_keywords" jsonb,
	"category" "content_category" NOT NULL,
	"target_audience" text,
	"priority" integer DEFAULT 0,
	"status" "blog_content_queue_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"blog_post_id" uuid,
	"generated_title" varchar(500),
	"generated_slug" varchar(255),
	"requested_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csv_import_duplicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_job_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"row_data" jsonb NOT NULL,
	"existing_record_id" uuid,
	"existing_record_data" jsonb,
	"matching_fields" jsonb,
	"match_score" integer,
	"resolution" "duplicate_resolution" DEFAULT 'pending',
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"merge_strategy" jsonb,
	"result_record_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csv_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" "import_entity_type" NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size_bytes" integer,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"use_ai_refinement" boolean DEFAULT false,
	"ai_mapping_confidence" integer,
	"ai_processing_cost" integer,
	"original_headers" jsonb,
	"column_mappings" jsonb,
	"unmapped_columns" jsonb,
	"total_rows" integer DEFAULT 0,
	"valid_rows" integer DEFAULT 0,
	"invalid_rows" integer DEFAULT 0,
	"imported_rows" integer DEFAULT 0,
	"skipped_rows" integer DEFAULT 0,
	"merged_rows" integer DEFAULT 0,
	"duplicates_detected" integer DEFAULT 0,
	"duplicates_resolved" integer DEFAULT 0,
	"duplicate_strategy" varchar(50) DEFAULT 'prompt',
	"validation_errors" jsonb,
	"import_errors" jsonb,
	"raw_data" jsonb,
	"transformed_data" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csv_import_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"entity_type" "import_entity_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"columns" jsonb NOT NULL,
	"sample_data" jsonb,
	"validation_rules" jsonb,
	"duplicate_detection_fields" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_maintenance_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"portal_user_id" varchar,
	"equipment_id" varchar,
	"equipment_name" varchar,
	"equipment_make" varchar,
	"equipment_model" varchar,
	"equipment_serial" varchar,
	"equipment_location" varchar,
	"maintenance_type" "maintenance_type" NOT NULL,
	"appointment_date" timestamp NOT NULL,
	"appointment_time" varchar NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"time_zone" varchar DEFAULT 'America/New_York',
	"assigned_technician_id" varchar,
	"technician_name" varchar,
	"status" "appointment_status" DEFAULT 'requested' NOT NULL,
	"confirmation_code" varchar,
	"confirmed_at" timestamp,
	"description" text,
	"service_notes" text,
	"special_instructions" text,
	"estimated_cost" numeric(10, 2),
	"contact_method" varchar DEFAULT 'email',
	"customer_phone" varchar,
	"customer_email" varchar,
	"original_date" timestamp,
	"reschedule_count" integer DEFAULT 0,
	"reschedule_reason" text,
	"service_request_id" varchar,
	"service_ticket_id" varchar,
	"reminder_sent" boolean DEFAULT false,
	"reminder_sent_at" timestamp,
	"confirmation_sent" boolean DEFAULT false,
	"completed_at" timestamp,
	"customer_satisfaction_rating" integer,
	"customer_feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_surveys_sent" integer DEFAULT 0 NOT NULL,
	"total_surveys_completed" integer DEFAULT 0 NOT NULL,
	"response_rate" numeric(5, 2) DEFAULT '0.00',
	"service_request_scores" jsonb DEFAULT '{}'::jsonb,
	"maintenance_scores" jsonb DEFAULT '{}'::jsonb,
	"supply_order_scores" jsonb DEFAULT '{}'::jsonb,
	"average_overall_score" numeric(4, 2),
	"average_nps_score" numeric(4, 2),
	"service_quality_score" numeric(4, 2),
	"timeliness_score" numeric(4, 2),
	"communication_score" numeric(4, 2),
	"value_score" numeric(4, 2),
	"score_change" numeric(4, 2),
	"response_rate_change" numeric(5, 2),
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"question_type" "satisfaction_question_type" NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"order_index" integer NOT NULL,
	"rating_scale" jsonb DEFAULT '{"min":1,"max":5,"labels":["Very Poor","Poor","Fair","Good","Excellent"]}'::jsonb,
	"multiple_choice_options" jsonb DEFAULT '[]'::jsonb,
	"depends_on_question" uuid,
	"show_condition" jsonb,
	"category" varchar(100),
	"weight" numeric(3, 2) DEFAULT '1.00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"rating_value" integer,
	"text_value" text,
	"selected_options" jsonb DEFAULT '[]'::jsonb,
	"boolean_value" boolean,
	"time_spent_seconds" integer,
	"response_order" integer,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_survey_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"survey_type" "satisfaction_survey_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"send_delay_hours" integer DEFAULT 24 NOT NULL,
	"reminder_delay_hours" integer DEFAULT 72 NOT NULL,
	"expiry_days" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid,
	"template_id" uuid NOT NULL,
	"survey_type" "satisfaction_survey_type" NOT NULL,
	"status" "satisfaction_response_status" DEFAULT 'invited' NOT NULL,
	"related_service_request_id" uuid,
	"related_maintenance_appointment_id" uuid,
	"related_supply_order_id" uuid,
	"related_payment_id" uuid,
	"invitation_sent_at" timestamp,
	"first_viewed_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"access_token" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"overall_score" numeric(4, 2),
	"nps_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_satisfaction_surveys_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "customer_service_request_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_request_id" uuid NOT NULL,
	"previous_status" "service_request_status",
	"new_status" "service_request_status" NOT NULL,
	"change_reason" text,
	"customer_visible_notes" text,
	"internal_notes" text,
	"changed_by_type" varchar(50) NOT NULL,
	"changed_by_id" uuid,
	"changed_by_name" varchar(255) NOT NULL,
	"estimated_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"technician_name" varchar,
	"date" timestamp NOT NULL,
	"start_time" varchar NOT NULL,
	"end_time" varchar NOT NULL,
	"duration" integer NOT NULL,
	"is_available" boolean DEFAULT true,
	"is_blocked" boolean DEFAULT false,
	"block_reason" varchar,
	"appointment_id" varchar,
	"appointment_type" varchar,
	"service_area" varchar,
	"max_travel_distance" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "churn_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"churn_risk" varchar NOT NULL,
	"churn_probability" numeric(5, 4) NOT NULL,
	"confidence_level" numeric(5, 4) NOT NULL,
	"predicted_churn_date" timestamp,
	"days_until_churn" integer,
	"contract_end_date" timestamp,
	"primary_risk_factors" text[],
	"secondary_risk_factors" text[],
	"model_version" varchar NOT NULL,
	"model_type" varchar NOT NULL,
	"feature_importance" text,
	"estimated_mrr" numeric(12, 2),
	"estimated_ltv" numeric(12, 2),
	"retention_cost" numeric(12, 2),
	"intervention_required" boolean DEFAULT false,
	"intervention_triggered" boolean DEFAULT false,
	"intervention_id" varchar,
	"predicted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_health_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"overall_score" integer NOT NULL,
	"health_status" varchar NOT NULL,
	"trend" varchar NOT NULL,
	"usage_score" integer NOT NULL,
	"engagement_score" integer NOT NULL,
	"support_score" integer NOT NULL,
	"payment_score" integer NOT NULL,
	"satisfaction_score" integer NOT NULL,
	"days_since_last_service" integer,
	"open_tickets_count" integer DEFAULT 0,
	"overdue_invoices_count" integer DEFAULT 0,
	"nps_score" integer,
	"csat" numeric(3, 2),
	"risk_factors" text[],
	"strength_factors" text[],
	"recommendations" text[],
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"calculated_by" varchar,
	"next_calculation_due" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_journeys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"current_stage" varchar NOT NULL,
	"previous_stage" varchar,
	"stage_entered_at" timestamp NOT NULL,
	"days_since_stage_change" integer DEFAULT 0,
	"total_days_as_customer" integer DEFAULT 0,
	"lifecycle_phase" varchar NOT NULL,
	"onboarding_completed" boolean DEFAULT false,
	"onboarding_completed_at" timestamp,
	"first_service_completed" boolean DEFAULT false,
	"first_service_completed_at" timestamp,
	"first_renewal_completed" boolean DEFAULT false,
	"first_renewal_completed_at" timestamp,
	"total_touchpoints" integer DEFAULT 0,
	"last_touchpoint_date" timestamp,
	"last_touchpoint_type" varchar,
	"avg_days_between_touchpoints" integer,
	"engagement_trend" varchar,
	"next_expected_stage" varchar,
	"predicted_stage_change_date" timestamp,
	"recommended_actions" text[],
	"journey_health" varchar NOT NULL,
	"blockers" text[],
	"current_intervention_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"renewal_type" varchar NOT NULL,
	"renewal_status" varchar NOT NULL,
	"renewal_probability" numeric(5, 4) NOT NULL,
	"contract_end_date" timestamp NOT NULL,
	"days_until_renewal" integer NOT NULL,
	"outreach_start_date" timestamp,
	"target_close_date" timestamp,
	"actual_renewal_date" timestamp,
	"current_mrr" numeric(12, 2) NOT NULL,
	"projected_mrr" numeric(12, 2) NOT NULL,
	"mrr_change" numeric(12, 2),
	"mrr_change_percent" numeric(5, 2),
	"current_contract_value" numeric(12, 2),
	"projected_contract_value" numeric(12, 2),
	"expansion_potential" boolean DEFAULT false,
	"suggested_add_ons" text[],
	"suggested_upgrades" text[],
	"estimated_expansion_value" numeric(12, 2),
	"renewal_risk" varchar NOT NULL,
	"risk_factors" text[],
	"strength_factors" text[],
	"assigned_csm" varchar,
	"assigned_sales_rep" varchar,
	"last_contact_date" timestamp,
	"next_contact_date" timestamp,
	"contact_frequency" varchar,
	"action_plan" text[],
	"internal_notes" text,
	"competitor_threats" text[],
	"outcome_notes" text,
	"lost_reason" varchar,
	"win_reason" varchar,
	"related_health_score_id" varchar,
	"related_churn_prediction_id" varchar,
	"related_intervention_ids" text[],
	"quote_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "success_interventions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"intervention_type" varchar NOT NULL,
	"trigger" varchar NOT NULL,
	"priority" varchar NOT NULL,
	"status" varchar NOT NULL,
	"outcome" varchar,
	"assigned_to" varchar,
	"assigned_at" timestamp,
	"due_date" timestamp,
	"scheduled_date" timestamp,
	"executed_at" timestamp,
	"completed_at" timestamp,
	"title" varchar NOT NULL,
	"description" text,
	"action_items" text[],
	"notes" text,
	"customer_response" varchar,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"health_score_before" integer,
	"health_score_after" integer,
	"churn_risk_before" varchar,
	"churn_risk_after" varchar,
	"related_health_score_id" varchar,
	"related_churn_prediction_id" varchar,
	"related_ticket_ids" text[],
	"automated_action" boolean DEFAULT false,
	"workflow_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "consent_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"consent_record_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"previous_status" "consent_status",
	"new_status" "consent_status",
	"previous_values" jsonb,
	"new_values" jsonb,
	"changed_by" uuid,
	"changed_by_type" varchar(50),
	"ip_address" varchar(45),
	"user_agent" text,
	"reason" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_preferences_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"required_consents" jsonb DEFAULT '[]'::jsonb,
	"optional_consents" jsonb DEFAULT '[]'::jsonb,
	"default_legal_basis" "legal_basis" DEFAULT 'consent',
	"expiration_days" integer,
	"require_double_opt_in" boolean DEFAULT false,
	"consent_texts" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subject_type" varchar(50) NOT NULL,
	"subject_id" uuid NOT NULL,
	"subject_email" varchar(255),
	"consent_type" "consent_type" NOT NULL,
	"status" "consent_status" DEFAULT 'pending' NOT NULL,
	"legal_basis" "legal_basis" DEFAULT 'consent' NOT NULL,
	"source" "consent_source" NOT NULL,
	"source_details" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"proof_type" varchar(100),
	"proof_reference" text,
	"consent_text" text,
	"version" varchar(50),
	"processing_purposes" jsonb DEFAULT '[]'::jsonb,
	"data_categories" jsonb DEFAULT '[]'::jsonb,
	"given_at" timestamp,
	"withdrawn_at" timestamp,
	"expires_at" timestamp,
	"withdrawal_reason" text,
	"withdrawal_method" varchar(100),
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_merge_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"surviving_record_id" uuid NOT NULL,
	"merged_record_id" uuid NOT NULL,
	"duplicate_match_id" uuid,
	"surviving_record_before" jsonb,
	"surviving_record_after" jsonb,
	"merged_record_snapshot" jsonb,
	"field_resolutions" jsonb DEFAULT '[]'::jsonb,
	"related_updates" jsonb DEFAULT '[]'::jsonb,
	"merge_type" varchar(50),
	"merge_reason" text,
	"can_rollback" boolean DEFAULT true,
	"rolled_back_at" timestamp,
	"rolled_back_by" uuid,
	"rollback_reason" text,
	"merged_by" uuid NOT NULL,
	"merged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_export_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"format" "export_format" DEFAULT 'json',
	"included_categories" jsonb DEFAULT '[]'::jsonb,
	"excluded_categories" jsonb DEFAULT '[]'::jsonb,
	"included_tables" jsonb DEFAULT '[]'::jsonb,
	"field_mappings" jsonb DEFAULT '{}'::jsonb,
	"include_metadata" boolean DEFAULT true,
	"include_audit_trail" boolean DEFAULT false,
	"anonymize_data" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_processing_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agreement_number" varchar(100),
	"name" varchar(255) NOT NULL,
	"description" text,
	"vendor_name" varchar(255) NOT NULL,
	"vendor_legal_name" varchar(255),
	"vendor_address" text,
	"vendor_country" varchar(2),
	"vendor_contact_name" varchar(255),
	"vendor_contact_email" varchar(255),
	"vendor_contact_phone" varchar(50),
	"vendor_dpo_email" varchar(255),
	"vendor_privacy_url" text,
	"risk_level" "vendor_risk_level" DEFAULT 'medium',
	"risk_assessment_date" timestamp,
	"risk_assessment_notes" text,
	"status" "dpa_status" DEFAULT 'draft' NOT NULL,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"renewal_date" timestamp,
	"auto_renewal" boolean DEFAULT false,
	"data_categories" jsonb DEFAULT '[]'::jsonb,
	"data_subjects" jsonb DEFAULT '[]'::jsonb,
	"processing_purposes" jsonb DEFAULT '[]'::jsonb,
	"processing_locations" jsonb DEFAULT '[]'::jsonb,
	"allows_subprocessors" boolean DEFAULT false,
	"subprocessor_approval_required" boolean DEFAULT true,
	"subprocessors" jsonb DEFAULT '[]'::jsonb,
	"security_measures" jsonb DEFAULT '[]'::jsonb,
	"certifications" jsonb DEFAULT '[]'::jsonb,
	"encryption_at_rest" boolean DEFAULT true,
	"encryption_in_transit" boolean DEFAULT true,
	"cross_border_transfer" boolean DEFAULT false,
	"transfer_mechanism" varchar(100),
	"transfer_countries" jsonb DEFAULT '[]'::jsonb,
	"document_url" text,
	"signed_copy_url" text,
	"our_signatory" varchar(255),
	"our_signature_date" timestamp,
	"vendor_signatory" varchar(255),
	"vendor_signature_date" timestamp,
	"renewal_reminder_days" integer DEFAULT 30,
	"last_notification_sent" timestamp,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpa_compliance_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"dpa_id" uuid NOT NULL,
	"check_type" varchar(100) NOT NULL,
	"check_date" timestamp NOT NULL,
	"next_check_date" timestamp,
	"status" varchar(50) NOT NULL,
	"overall_score" integer,
	"findings" jsonb DEFAULT '[]'::jsonb,
	"evidence_urls" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"reviewed_by" uuid,
	"approved_by" uuid,
	"approval_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_detection_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"entity_type" varchar(50) NOT NULL,
	"matching_fields" jsonb NOT NULL,
	"minimum_score" integer DEFAULT 80,
	"auto_merge_threshold" integer,
	"default_merge_strategy" "merge_strategy" DEFAULT 'manual',
	"field_merge_rules" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"run_on_import" boolean DEFAULT true,
	"run_on_create" boolean DEFAULT true,
	"run_on_schedule" boolean DEFAULT false,
	"schedule_expression" varchar(100),
	"last_run_at" timestamp,
	"last_run_duration_ms" integer,
	"total_duplicates_found" integer DEFAULT 0,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule_id" uuid,
	"entity_type" varchar(50) NOT NULL,
	"primary_record_id" uuid NOT NULL,
	"secondary_record_id" uuid NOT NULL,
	"match_score" integer NOT NULL,
	"match_type" "duplicate_match_type" NOT NULL,
	"matched_fields" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"confidence" varchar(20),
	"resolution" varchar(50),
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"merged_record_id" uuid,
	"merge_strategy" "merge_strategy",
	"detected_source" varchar(50),
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_scan_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255),
	"job_type" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"rule_id" uuid,
	"target_record_ids" jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"records_scanned" integer DEFAULT 0,
	"duplicates_found" integer DEFAULT 0,
	"auto_merged" integer DEFAULT 0,
	"error_message" text,
	"triggered_by" uuid,
	"trigger_type" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"gdpr_request_id" uuid,
	"export_number" varchar(100),
	"subject_type" varchar(50) NOT NULL,
	"subject_id" uuid NOT NULL,
	"subject_email" varchar(255),
	"requested_by" uuid NOT NULL,
	"requested_by_type" varchar(50) NOT NULL,
	"purpose" varchar(255),
	"format" "export_format" DEFAULT 'json' NOT NULL,
	"included_categories" jsonb DEFAULT '[]'::jsonb,
	"excluded_categories" jsonb DEFAULT '[]'::jsonb,
	"included_tables" jsonb DEFAULT '[]'::jsonb,
	"date_range_start" timestamp,
	"date_range_end" timestamp,
	"status" "export_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"error_message" text,
	"record_count" integer,
	"file_size" integer,
	"file_path" text,
	"download_url" text,
	"download_expiry" timestamp,
	"download_count" integer DEFAULT 0,
	"last_downloaded_at" timestamp,
	"encrypted" boolean DEFAULT true,
	"encryption_key" varchar(255),
	"password" varchar(255),
	"delivery_method" varchar(50) DEFAULT 'download',
	"delivery_email" varchar(255),
	"delivery_sent_at" timestamp,
	"identity_verified" boolean DEFAULT false,
	"verification_method" varchar(100),
	"verification_date" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "eta_calculations" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"current_latitude" numeric(10, 7) NOT NULL,
	"current_longitude" numeric(10, 7) NOT NULL,
	"destination_latitude" numeric(10, 7) NOT NULL,
	"destination_longitude" numeric(10, 7) NOT NULL,
	"destination_address" text,
	"estimated_arrival_time" timestamp NOT NULL,
	"calculation_method" varchar NOT NULL,
	"straight_line_distance" numeric(10, 2),
	"road_distance" numeric(10, 2),
	"estimated_duration" integer NOT NULL,
	"traffic_condition" varchar,
	"traffic_delay_minutes" integer DEFAULT 0,
	"weather_condition" varchar,
	"confidence_score" numeric(3, 2),
	"actual_arrival_time" timestamp,
	"accuracy_minutes" integer,
	"route_id" varchar,
	"stop_sequence" integer,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofence_events" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"tenant_id" varchar NOT NULL,
	"geofence_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"event_location" jsonb NOT NULL,
	"ticket_id" varchar,
	"route_id" varchar,
	"entry_time" timestamp,
	"exit_time" timestamp,
	"dwell_duration" integer,
	"device_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"geofence_type" varchar NOT NULL,
	"center_latitude" numeric(10, 7) NOT NULL,
	"center_longitude" numeric(10, 7) NOT NULL,
	"radius_meters" numeric(10, 2),
	"polygon_coordinates" jsonb,
	"customer_id" varchar,
	"location_id" varchar,
	"trigger_on_entry" boolean DEFAULT true,
	"trigger_on_exit" boolean DEFAULT true,
	"trigger_on_dwell" boolean DEFAULT false,
	"dwell_time_minutes" integer,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_assignments" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"route_name" varchar NOT NULL,
	"route_date" timestamp NOT NULL,
	"route_status" varchar DEFAULT 'assigned' NOT NULL,
	"waypoints" jsonb NOT NULL,
	"total_stops" integer NOT NULL,
	"completed_stops" integer DEFAULT 0,
	"optimized_route" boolean DEFAULT false,
	"optimization_algorithm" varchar,
	"total_distance" numeric(10, 2),
	"estimated_duration" integer,
	"actual_duration" integer,
	"route_start_time" timestamp,
	"route_end_time" timestamp,
	"start_location" jsonb,
	"end_location" jsonb,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_deviations" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"tenant_id" varchar NOT NULL,
	"route_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"deviation_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"deviation_location" jsonb NOT NULL,
	"intended_location" jsonb,
	"deviation_distance" numeric(10, 2),
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"expected_time" timestamp,
	"actual_time" timestamp,
	"delay_minutes" integer,
	"affected_ticket_id" varchar,
	"reason" text,
	"auto_detected" boolean DEFAULT true,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"notification_sent" boolean DEFAULT false,
	"notified_users" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_locations" (
	"id" varchar PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(6, 2),
	"altitude" numeric(8, 2),
	"heading" numeric(5, 2),
	"speed" numeric(6, 2),
	"status" varchar DEFAULT 'active' NOT NULL,
	"is_moving" boolean DEFAULT false,
	"battery_level" integer,
	"current_ticket_id" varchar,
	"current_customer_id" varchar,
	"address" text,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"device_id" varchar,
	"app_version" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"collection_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookmark_user_article_unique" UNIQUE("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "article_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"rating_type" varchar(50) DEFAULT 'overall' NOT NULL,
	"comment" text,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"verified_reader" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rating_user_article_type_unique" UNIQUE("user_id","article_id","rating_type")
);
--> statement-breakpoint
CREATE TABLE "article_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"vote_type" varchar(20) NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vote_user_article_unique" UNIQUE("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "reading_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"scroll_position" integer DEFAULT 0 NOT NULL,
	"reading_progress" integer DEFAULT 0 NOT NULL,
	"current_section_id" varchar(255),
	"completed" boolean DEFAULT false NOT NULL,
	"total_time_seconds" integer DEFAULT 0 NOT NULL,
	"last_read_duration" integer DEFAULT 0 NOT NULL,
	"first_viewed_at" timestamp DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "reading_history_user_article_unique" UNIQUE("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "bant_qualification_criteria" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"budget_identified" boolean DEFAULT false,
	"budget_amount" numeric(15, 2),
	"budget_timeframe" varchar,
	"budget_approved" boolean DEFAULT false,
	"budget_score" integer DEFAULT 0,
	"budget_notes" text,
	"decision_maker_identified" boolean DEFAULT false,
	"decision_maker_name" varchar,
	"decision_maker_title" varchar,
	"decision_maker_contact" varchar,
	"decision_process" text,
	"authority_score" integer DEFAULT 0,
	"authority_notes" text,
	"need_identified" boolean DEFAULT false,
	"need_type" varchar,
	"need_urgency" varchar,
	"need_description" text,
	"pain_points" jsonb,
	"need_score" integer DEFAULT 0,
	"need_notes" text,
	"timeline_identified" boolean DEFAULT false,
	"expected_close_date" timestamp,
	"decision_timeline" varchar,
	"implementation_timeline" varchar,
	"blockers" jsonb,
	"timeline_score" integer DEFAULT 0,
	"timeline_notes" text,
	"total_bant_score" integer DEFAULT 0,
	"qualification_status" varchar DEFAULT 'unqualified',
	"qualified_date" timestamp,
	"disqualified_reason" text,
	"assessed_by" varchar,
	"last_assessed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_engagement_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"engagement_type" varchar NOT NULL,
	"engagement_channel" varchar,
	"engagement_source" varchar,
	"engagement_value" integer DEFAULT 1,
	"engagement_metadata" jsonb,
	"campaign_id" varchar,
	"user_id" varchar,
	"engaged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_qualification_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"previous_status" varchar,
	"new_status" varchar NOT NULL,
	"status_reason" text,
	"score_at_change" integer,
	"bant_score_at_change" integer,
	"changed_by" varchar,
	"change_reason" varchar,
	"notes" text,
	"metadata" jsonb,
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_score_calculations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"demographic_score" integer DEFAULT 0,
	"firmographic_score" integer DEFAULT 0,
	"behavioral_score" integer DEFAULT 0,
	"engagement_score" integer DEFAULT 0,
	"bant_score" integer DEFAULT 0,
	"total_score" integer DEFAULT 0 NOT NULL,
	"previous_score" integer,
	"score_change" integer,
	"lead_grade" varchar,
	"lead_tier" varchar,
	"prediction_score" numeric(5, 2),
	"confidence_level" varchar,
	"recommended_action" varchar,
	"calculation_method" varchar DEFAULT 'rule_based',
	"rules_applied" jsonb,
	"calculation_duration_ms" integer,
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_scoring_factors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"rule_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"factor_name" varchar NOT NULL,
	"factor_category" varchar NOT NULL,
	"points_awarded" integer NOT NULL,
	"evaluated_field" varchar,
	"evaluated_value" jsonb,
	"rule_condition" jsonb,
	"evaluated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_scoring_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"rule_description" text,
	"category" varchar NOT NULL,
	"field" varchar NOT NULL,
	"operator" varchar NOT NULL,
	"value" jsonb NOT NULL,
	"score_points" integer NOT NULL,
	"max_score" integer,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_archive_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"archive_id" uuid,
	"job_type" varchar(50) NOT NULL,
	"status" "archive_status" DEFAULT 'pending' NOT NULL,
	"triggered_by" uuid NOT NULL,
	"trigger_reason" text,
	"total_records" integer,
	"processed_records" integer DEFAULT 0,
	"progress_percentage" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_seconds" integer,
	"result_message" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"archive_name" varchar(255) NOT NULL,
	"status" "archive_status" DEFAULT 'pending' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"record_count" integer NOT NULL,
	"original_size_bytes" integer,
	"compressed_size_bytes" integer,
	"compression_ratio" integer,
	"storage_location" text NOT NULL,
	"storage_provider" varchar(50),
	"encryption_key" varchar(255),
	"checksum_sha256" varchar(64) NOT NULL,
	"retain_until" timestamp NOT NULL,
	"legal_hold" boolean DEFAULT false,
	"metadata" jsonb,
	"last_restored_at" timestamp,
	"restoration_count" integer DEFAULT 0,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	"archived_by" uuid NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "change_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_request_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"approver_name" varchar(255) NOT NULL,
	"approver_role" varchar(100) NOT NULL,
	"decision" varchar(20) NOT NULL,
	"comments" text,
	"conditions" text,
	"approval_level" integer DEFAULT 1 NOT NULL,
	"is_required" boolean DEFAULT true,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_request_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_name" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"field_name" varchar(100),
	"old_value" text,
	"new_value" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"change_number" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"type" "change_type" DEFAULT 'normal' NOT NULL,
	"risk_level" "change_risk_level" NOT NULL,
	"environment" "change_environment" NOT NULL,
	"status" "change_status" DEFAULT 'draft' NOT NULL,
	"requester_id" uuid NOT NULL,
	"assignee_id" uuid,
	"business_justification" text NOT NULL,
	"affected_systems" jsonb NOT NULL,
	"affected_users" text,
	"planned_start_date" timestamp,
	"planned_end_date" timestamp,
	"actual_start_date" timestamp,
	"actual_end_date" timestamp,
	"implementation_plan" text,
	"test_plan" text,
	"rollback_plan" text NOT NULL,
	"communication_plan" text,
	"risk_assessment" jsonb,
	"approval_deadline" timestamp,
	"approved_by" jsonb,
	"rejected_by" uuid,
	"rejection_reason" text,
	"implementation_notes" text,
	"verification_notes" text,
	"failure_reason" text,
	"rollback_notes" text,
	"related_change_ids" jsonb,
	"parent_change_id" uuid,
	"tags" jsonb,
	"priority" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"closed_at" timestamp,
	CONSTRAINT "change_requests_change_number_unique" UNIQUE("change_number")
);
--> statement-breakpoint
CREATE TABLE "data_purge_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"status" "purge_status" DEFAULT 'pending' NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"triggered_by" uuid,
	"table_name" varchar(255) NOT NULL,
	"cutoff_date" timestamp NOT NULL,
	"records_identified" integer DEFAULT 0,
	"records_archived" integer DEFAULT 0,
	"records_purged" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_seconds" integer,
	"archive_location" text,
	"error_log" jsonb,
	"verification_status" varchar(50),
	"verified_by" uuid,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"table_name" varchar(255) NOT NULL,
	"date_field" varchar(255) NOT NULL,
	"additional_conditions" jsonb,
	"retention_days" integer NOT NULL,
	"archive_before_purge" boolean DEFAULT true,
	"archive_destination" varchar(255),
	"status" "retention_policy_status" DEFAULT 'active' NOT NULL,
	"priority" integer DEFAULT 5,
	"batch_size" integer DEFAULT 1000,
	"max_execution_minutes" integer DEFAULT 60,
	"schedule" varchar(100) DEFAULT '0 2 * * 0',
	"timezone" varchar(100) DEFAULT 'UTC',
	"legal_hold" boolean DEFAULT false,
	"legal_hold_reason" text,
	"legal_hold_until" timestamp,
	"notify_on_execution" boolean DEFAULT true,
	"notify_on_failure" boolean DEFAULT true,
	"notification_emails" jsonb,
	"last_executed_at" timestamp,
	"last_records_purged" integer,
	"total_records_purged" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"from_level" integer NOT NULL,
	"to_level" integer NOT NULL,
	"reason" text NOT NULL,
	"escalated_by" uuid NOT NULL,
	"escalated_to" uuid NOT NULL,
	"escalated_to_name" varchar(255),
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"escalated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"actor_id" uuid,
	"actor_name" varchar(255),
	"metadata" jsonb,
	"is_automated" boolean DEFAULT false,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"incident_number" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"severity" "incident_severity" NOT NULL,
	"category" "incident_category" NOT NULL,
	"status" "incident_status" DEFAULT 'detected' NOT NULL,
	"detected_at" timestamp NOT NULL,
	"detected_by" uuid,
	"detection_method" varchar(100),
	"detection_source" text,
	"impact_summary" text,
	"affected_systems" jsonb,
	"affected_users" integer,
	"business_impact" text,
	"data_breach_confirmed" boolean DEFAULT false,
	"pii_involved" boolean DEFAULT false,
	"incident_commander_id" uuid,
	"assigned_team" jsonb,
	"root_cause" text,
	"contributing_factors" jsonb,
	"resolution_summary" text,
	"resolution_actions" jsonb,
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"lessons_learned" text,
	"preventive_measures" jsonb,
	"post_mortem_url" text,
	"post_mortem_completed_at" timestamp,
	"external_notification_required" boolean DEFAULT false,
	"regulatory_notification_required" boolean DEFAULT false,
	"notifications_sent" jsonb,
	"time_to_acknowledge_minutes" integer,
	"time_to_resolve_minutes" integer,
	"related_incident_ids" jsonb,
	"related_change_ids" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	CONSTRAINT "incidents_incident_number_unique" UNIQUE("incident_number")
);
--> statement-breakpoint
CREATE TABLE "payment_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action" "payment_action" NOT NULL,
	"status" varchar(50) NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"stripe_invoice_id" varchar(255),
	"stripe_customer_id" varchar(255),
	"stripe_payment_method_id" varchar(255),
	"user_id" uuid,
	"customer_id" uuid,
	"invoice_id" uuid,
	"amount" integer,
	"currency" varchar(3),
	"card_last4" varchar(4),
	"card_brand" varchar(50),
	"card_exp_month" integer,
	"card_exp_year" integer,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"session_id" varchar(255),
	"request_id" uuid,
	"error_code" varchar(100),
	"error_message" text,
	"decline_code" varchar(100),
	"risk_level" varchar(20),
	"risk_score" integer,
	"metadata" jsonb,
	"stripe_event_id" varchar(255),
	"webhook_received" boolean DEFAULT false,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment_method_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"stripe_payment_method_id" varchar(255) NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"previous_default" boolean DEFAULT false,
	"new_default" boolean DEFAULT false,
	"card_last4" varchar(4),
	"card_brand" varchar(50),
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"reason" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"provider_id" uuid,
	"user_id" uuid,
	"request_id" varchar(255) NOT NULL,
	"protocol" "sso_protocol" NOT NULL,
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"success" boolean NOT NULL,
	"completed_at" timestamp,
	"error_code" varchar(100),
	"error_message" text,
	"external_id" varchar(512),
	"external_email" varchar(255),
	"user_provisioned" boolean DEFAULT false,
	"user_updated" boolean DEFAULT false,
	"client_ip" varchar(45),
	"user_agent" text,
	"relay_state" text,
	"saml_assertion_id" varchar(255),
	"saml_issuer" varchar(512),
	"saml_session_index" varchar(255),
	"oidc_nonce" varchar(255),
	"oidc_state" varchar(255),
	"duration_ms" varchar(20),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "sso_provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_type" "sso_provider_type" NOT NULL,
	"protocol" "sso_protocol" NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"description" text,
	"status" "sso_connection_status" DEFAULT 'pending' NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"saml_entity_id" varchar(512),
	"saml_sso_url" varchar(1024),
	"saml_slo_url" varchar(1024),
	"saml_certificate" text,
	"saml_certificate_fingerprint" varchar(255),
	"saml_signing_algorithm" varchar(50) DEFAULT 'sha256',
	"saml_digest_algorithm" varchar(50) DEFAULT 'sha256',
	"saml_request_signature" boolean DEFAULT true,
	"saml_want_assertions_signed" boolean DEFAULT true,
	"oidc_client_id" varchar(512),
	"oidc_client_secret" text,
	"oidc_issuer" varchar(1024),
	"oidc_authorization_url" varchar(1024),
	"oidc_token_url" varchar(1024),
	"oidc_userinfo_url" varchar(1024),
	"oidc_jwks_url" varchar(1024),
	"oidc_scopes" varchar(512) DEFAULT 'openid profile email',
	"attribute_mapping" jsonb DEFAULT '{}'::jsonb,
	"group_role_mapping" jsonb DEFAULT '{}'::jsonb,
	"allowed_domains" varchar(1024),
	"allowed_email_domains" varchar(1024),
	"auto_provision_users" boolean DEFAULT true NOT NULL,
	"auto_update_user_attributes" boolean DEFAULT true NOT NULL,
	"auto_deactivate_users" boolean DEFAULT false NOT NULL,
	"default_role" varchar(100),
	"default_location_id" uuid,
	"jit_provisioning" boolean DEFAULT true NOT NULL,
	"jit_provisioning_rules" jsonb DEFAULT '{}'::jsonb,
	"session_timeout" varchar(20) DEFAULT '8h',
	"force_reauthentication" boolean DEFAULT false,
	"single_logout_enabled" boolean DEFAULT true,
	"provider_settings" jsonb DEFAULT '{}'::jsonb,
	"metadata_url" varchar(1024),
	"metadata_xml" text,
	"metadata_last_fetched" timestamp,
	"verified_at" timestamp,
	"verified_by" uuid,
	"last_login_at" timestamp,
	"login_count" varchar(20) DEFAULT '0',
	"last_error" text,
	"last_error_at" timestamp,
	"error_count" varchar(20) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "sso_provider_configs_tenant_provider_unique" UNIQUE("tenant_id","provider_type","name")
);
--> statement-breakpoint
CREATE TABLE "sso_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"app_session_id" varchar(255),
	"saml_session_index" varchar(255),
	"saml_name_id" varchar(512),
	"saml_name_id_format" varchar(255),
	"oidc_id_token" text,
	"oidc_access_token" text,
	"oidc_refresh_token" text,
	"oidc_token_expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"logout_initiated_at" timestamp,
	"logout_completed_at" timestamp,
	"logout_method" varchar(50),
	"client_ip" varchar(45),
	"user_agent" text,
	CONSTRAINT "sso_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "sso_user_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"external_id" varchar(512) NOT NULL,
	"external_email" varchar(255),
	"external_username" varchar(255),
	"saml_name_id" varchar(512),
	"saml_name_id_format" varchar(255),
	"oidc_subject" varchar(512),
	"provisioned_at" timestamp DEFAULT now() NOT NULL,
	"provisioned_by" varchar(50) DEFAULT 'jit' NOT NULL,
	"last_synced_at" timestamp,
	"external_attributes" jsonb DEFAULT '{}'::jsonb,
	"external_groups" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp,
	"deactivated_reason" varchar(255),
	"last_login_at" timestamp,
	"login_count" varchar(20) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sso_user_mappings_provider_external_id_unique" UNIQUE("provider_id","external_id"),
	CONSTRAINT "sso_user_mappings_user_provider_unique" UNIQUE("user_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar,
	"task_template" jsonb DEFAULT '[]'::jsonb,
	"is_public" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"description" text,
	"hours" integer NOT NULL,
	"entry_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alert_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"alert_type" "alert_type" NOT NULL,
	"enabled" boolean DEFAULT true,
	"thresholds" jsonb DEFAULT '{}'::jsonb,
	"notification_channels" jsonb DEFAULT '["email"]'::jsonb,
	"notification_frequency" varchar DEFAULT 'daily',
	"quiet_hours_start" varchar,
	"quiet_hours_end" varchar,
	"additional_recipients" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alert_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"configuration_id" uuid,
	"alert_type" "alert_type" NOT NULL,
	"severity" "alert_severity" DEFAULT 'warning' NOT NULL,
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"subject_user_id" varchar,
	"subject_name" varchar,
	"team_id" varchar,
	"location_id" varchar,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"notified_at" timestamp,
	"notified_via" jsonb DEFAULT '[]'::jsonb,
	"notifications_sent" integer DEFAULT 0,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alert_notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"alert_instance_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient" varchar NOT NULL,
	"subject" varchar,
	"content" text,
	"sent" boolean DEFAULT false,
	"sent_at" timestamp,
	"delivery_status" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_subscription_id_tenant_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activity_logs" ADD CONSTRAINT "client_activity_logs_client_id_monitoring_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."monitoring_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_funnel" ADD CONSTRAINT "conversion_funnel_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_funnel" ADD CONSTRAINT "conversion_funnel_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_funnel" ADD CONSTRAINT "conversion_funnel_team_id_sales_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sales_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_funnel_events" ADD CONSTRAINT "conversion_funnel_events_signup_id_platform_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."platform_signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_meter_submissions" ADD CONSTRAINT "customer_meter_submissions_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_related_service_request_id_customer_service_requests_id_fk" FOREIGN KEY ("related_service_request_id") REFERENCES "public"."customer_service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_related_payment_id_customer_payments_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_related_supply_order_id_customer_supply_orders_id_fk" FOREIGN KEY ("related_supply_order_id") REFERENCES "public"."customer_supply_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_portal_activity_log" ADD CONSTRAINT "customer_portal_activity_log_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_requests" ADD CONSTRAINT "customer_service_requests_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_supply_order_items" ADD CONSTRAINT "customer_supply_order_items_order_id_customer_supply_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_supply_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_supply_orders" ADD CONSTRAINT "customer_supply_orders_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_usage_snapshots" ADD CONSTRAINT "daily_usage_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_snapshots" ADD CONSTRAINT "dashboard_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_snapshots" ADD CONSTRAINT "dashboard_snapshots_layout_id_dashboard_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."dashboard_layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widget_library" ADD CONSTRAINT "dashboard_widget_library_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widget_library" ADD CONSTRAINT "dashboard_widget_library_widget_id_dashboard_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."dashboard_widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_metrics" ADD CONSTRAINT "device_metrics_device_id_device_registrations_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_metrics" ADD CONSTRAINT "device_metrics_integration_id_manufacturer_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."manufacturer_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_integration_id_manufacturer_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."manufacturer_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_subscription_id_tenant_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_checklists" ADD CONSTRAINT "installation_checklists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_checklists" ADD CONSTRAINT "installation_checklists_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_customer_id_business_records_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."business_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_service_ticket_id_service_tickets_id_fk" FOREIGN KEY ("service_ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_assigned_technician_id_technicians_id_fk" FOREIGN KEY ("assigned_technician_id") REFERENCES "public"."technicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_integration_id_manufacturer_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."manufacturer_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_device_id_device_registrations_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_insights" ADD CONSTRAINT "manager_insights_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_insights" ADD CONSTRAINT "manager_insights_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_insights" ADD CONSTRAINT "manager_insights_team_id_sales_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sales_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_insights" ADD CONSTRAINT "manager_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturer_order_confirmations" ADD CONSTRAINT "manufacturer_order_confirmations_order_id_manufacturer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."manufacturer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturer_order_exceptions" ADD CONSTRAINT "manufacturer_order_exceptions_order_id_manufacturer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."manufacturer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturer_order_exceptions" ADD CONSTRAINT "manufacturer_order_exceptions_connection_id_manufacturer_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."manufacturer_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturer_order_line_items" ADD CONSTRAINT "manufacturer_order_line_items_order_id_manufacturer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."manufacturer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturer_order_shipments" ADD CONSTRAINT "manufacturer_order_shipments_order_id_manufacturer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."manufacturer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufacturer_orders" ADD CONSTRAINT "manufacturer_orders_connection_id_manufacturer_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."manufacturer_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_activities" ADD CONSTRAINT "platform_activities_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_activities" ADD CONSTRAINT "platform_activities_deal_id_platform_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."platform_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_activities" ADD CONSTRAINT "platform_activities_contact_id_platform_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."platform_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_bant_qualification" ADD CONSTRAINT "platform_bant_qualification_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_bant_qualification" ADD CONSTRAINT "platform_bant_qualification_deal_id_platform_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."platform_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_bant_qualification" ADD CONSTRAINT "platform_bant_qualification_decision_maker_contact_id_platform_contacts_id_fk" FOREIGN KEY ("decision_maker_contact_id") REFERENCES "public"."platform_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_business_records" ADD CONSTRAINT "platform_business_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_business_records" ADD CONSTRAINT "platform_business_records_primary_user_id_users_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_churn_predictions" ADD CONSTRAINT "platform_churn_predictions_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_churn_predictions" ADD CONSTRAINT "platform_churn_predictions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_contacts" ADD CONSTRAINT "platform_contacts_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_contacts" ADD CONSTRAINT "platform_contacts_reports_to_id_platform_contacts_id_fk" FOREIGN KEY ("reports_to_id") REFERENCES "public"."platform_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_deals" ADD CONSTRAINT "platform_deals_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_health_scores" ADD CONSTRAINT "platform_health_scores_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_health_scores" ADD CONSTRAINT "platform_health_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_lead_assignment_history" ADD CONSTRAINT "platform_lead_assignment_history_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_lead_assignment_history" ADD CONSTRAINT "platform_lead_assignment_history_rule_id_platform_lead_assignment_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."platform_lead_assignment_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_lead_assignment_rules" ADD CONSTRAINT "platform_lead_assignment_rules_assign_to_territory_id_platform_sales_territories_id_fk" FOREIGN KEY ("assign_to_territory_id") REFERENCES "public"."platform_sales_territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_lead_score_calculations" ADD CONSTRAINT "platform_lead_score_calculations_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_renewal_opportunities" ADD CONSTRAINT "platform_renewal_opportunities_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_renewal_opportunities" ADD CONSTRAINT "platform_renewal_opportunities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_renewal_opportunities" ADD CONSTRAINT "platform_renewal_opportunities_related_health_score_id_platform_health_scores_id_fk" FOREIGN KEY ("related_health_score_id") REFERENCES "public"."platform_health_scores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_renewal_opportunities" ADD CONSTRAINT "platform_renewal_opportunities_related_churn_prediction_id_platform_churn_predictions_id_fk" FOREIGN KEY ("related_churn_prediction_id") REFERENCES "public"."platform_churn_predictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_signups" ADD CONSTRAINT "platform_signups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_signups" ADD CONSTRAINT "platform_signups_primary_user_id_users_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_success_interventions" ADD CONSTRAINT "platform_success_interventions_business_record_id_platform_business_records_id_fk" FOREIGN KEY ("business_record_id") REFERENCES "public"."platform_business_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_success_interventions" ADD CONSTRAINT "platform_success_interventions_related_health_score_id_platform_health_scores_id_fk" FOREIGN KEY ("related_health_score_id") REFERENCES "public"."platform_health_scores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_success_interventions" ADD CONSTRAINT "platform_success_interventions_related_churn_prediction_id_platform_churn_predictions_id_fk" FOREIGN KEY ("related_churn_prediction_id") REFERENCES "public"."platform_churn_predictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_ticket_id_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_metrics" ADD CONSTRAINT "sales_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_metrics" ADD CONSTRAINT "sales_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_metrics" ADD CONSTRAINT "sales_metrics_team_id_sales_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sales_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_session_id_mobile_service_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mobile_service_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_signatures" ADD CONSTRAINT "service_signatures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_signatures" ADD CONSTRAINT "service_signatures_service_ticket_id_service_tickets_id_fk" FOREIGN KEY ("service_ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_signatures" ADD CONSTRAINT "service_signatures_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_audit_logs" ADD CONSTRAINT "signature_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_audit_logs" ADD CONSTRAINT "signature_audit_logs_request_id_signature_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_audit_logs" ADD CONSTRAINT "signature_audit_logs_signer_id_signature_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."signature_signers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_audit_logs" ADD CONSTRAINT "signature_audit_logs_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_documents" ADD CONSTRAINT "signature_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_documents" ADD CONSTRAINT "signature_documents_request_id_signature_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_customer_id_business_records_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."business_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_integration_id_integration_credentials_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_request_id_signature_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_signers" ADD CONSTRAINT "signature_signers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_tenant_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_notifications" ADD CONSTRAINT "subscription_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_notifications" ADD CONSTRAINT "subscription_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payment_methods" ADD CONSTRAINT "subscription_payment_methods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_variables" ADD CONSTRAINT "template_variables_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_addon_subscriptions" ADD CONSTRAINT "tenant_addon_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_addon_subscriptions" ADD CONSTRAINT "tenant_addon_subscriptions_subscription_id_tenant_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_addon_subscriptions" ADD CONSTRAINT "tenant_addon_subscriptions_addon_id_subscription_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."subscription_addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_parts_requests" ADD CONSTRAINT "ticket_parts_requests_session_id_technician_ticket_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."technician_ticket_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_tracking_entries" ADD CONSTRAINT "time_tracking_entries_session_id_mobile_service_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mobile_service_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_activity_log" ADD CONSTRAINT "trial_activity_log_signup_id_platform_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."platform_signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_activity_log" ADD CONSTRAINT "trial_activity_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_communications" ADD CONSTRAINT "trial_communications_signup_id_platform_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."platform_signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trigger_schedules" ADD CONSTRAINT "trigger_schedules_trigger_id_workflow_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."workflow_triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_preferences" ADD CONSTRAINT "user_dashboard_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_preferences" ADD CONSTRAINT "user_dashboard_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_preferences" ADD CONSTRAINT "user_dashboard_preferences_active_layout_id_dashboard_layouts_id_fk" FOREIGN KEY ("active_layout_id") REFERENCES "public"."dashboard_layouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_step_execution_id_workflow_execution_steps_id_fk" FOREIGN KEY ("step_execution_id") REFERENCES "public"."workflow_execution_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_assigned_to_group_id_assignment_groups_id_fk" FOREIGN KEY ("assigned_to_group_id") REFERENCES "public"."assignment_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_conditions" ADD CONSTRAINT "workflow_conditions_trigger_id_workflow_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."workflow_triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_events" ADD CONSTRAINT "workflow_execution_events_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_events" ADD CONSTRAINT "workflow_execution_events_step_execution_id_workflow_execution_steps_id_fk" FOREIGN KEY ("step_execution_id") REFERENCES "public"."workflow_execution_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution_steps" ADD CONSTRAINT "workflow_execution_steps_execution_id_workflow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."workflow_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_version_id_workflow_versions_id_fk" FOREIGN KEY ("workflow_version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_trigger_id_workflow_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."workflow_triggers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_transitions" ADD CONSTRAINT "workflow_step_transitions_step_id_workflow_steps_automation_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps_automation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_transitions" ADD CONSTRAINT "workflow_step_transitions_next_step_id_workflow_steps_automation_id_fk" FOREIGN KEY ("next_step_id") REFERENCES "public"."workflow_steps_automation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_session_id_technician_ticket_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."technician_ticket_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps_automation" ADD CONSTRAINT "workflow_steps_automation_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_discovered_devices" ADD CONSTRAINT "client_discovered_devices_client_id_monitoring_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."monitoring_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_discovered_devices" ADD CONSTRAINT "client_discovered_devices_registered_device_id_device_registrations_id_fk" FOREIGN KEY ("registered_device_id") REFERENCES "public"."device_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_rate_limits" ADD CONSTRAINT "api_key_rate_limits_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_rotations" ADD CONSTRAINT "api_key_rotations_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_rotations" ADD CONSTRAINT "api_key_rotations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_rotations" ADD CONSTRAINT "api_key_rotations_rotated_by_users_id_fk" FOREIGN KEY ("rotated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_usage_logs" ADD CONSTRAINT "api_key_usage_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_usage_logs" ADD CONSTRAINT "api_key_usage_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_maintenance_appointments" ADD CONSTRAINT "customer_maintenance_appointments_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_questions" ADD CONSTRAINT "customer_satisfaction_survey_questions_template_id_customer_satisfaction_survey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_satisfaction_survey_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_responses" ADD CONSTRAINT "customer_satisfaction_survey_responses_survey_id_customer_satisfaction_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."customer_satisfaction_surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_responses" ADD CONSTRAINT "customer_satisfaction_survey_responses_question_id_customer_satisfaction_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."customer_satisfaction_survey_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_template_id_customer_satisfaction_survey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_satisfaction_survey_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_related_service_request_id_customer_service_requests_id_fk" FOREIGN KEY ("related_service_request_id") REFERENCES "public"."customer_service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_related_maintenance_appointment_id_customer_maintenance_appointments_id_fk" FOREIGN KEY ("related_maintenance_appointment_id") REFERENCES "public"."customer_maintenance_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_related_supply_order_id_customer_supply_orders_id_fk" FOREIGN KEY ("related_supply_order_id") REFERENCES "public"."customer_supply_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_related_payment_id_customer_payments_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_request_status_history" ADD CONSTRAINT "customer_service_request_status_history_service_request_id_customer_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."customer_service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_availability_slots" ADD CONSTRAINT "technician_availability_slots_appointment_id_customer_maintenance_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."customer_maintenance_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_archive_jobs" ADD CONSTRAINT "audit_archive_jobs_archive_id_audit_log_archives_id_fk" FOREIGN KEY ("archive_id") REFERENCES "public"."audit_log_archives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_approvals" ADD CONSTRAINT "change_approvals_change_request_id_change_requests_id_fk" FOREIGN KEY ("change_request_id") REFERENCES "public"."change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_change_request_id_change_requests_id_fk" FOREIGN KEY ("change_request_id") REFERENCES "public"."change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_purge_jobs" ADD CONSTRAINT "data_purge_jobs_policy_id_data_retention_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."data_retention_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_escalations" ADD CONSTRAINT "incident_escalations_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_timeline" ADD CONSTRAINT "incident_timeline_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_login_attempts" ADD CONSTRAINT "sso_login_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_login_attempts" ADD CONSTRAINT "sso_login_attempts_provider_id_sso_provider_configs_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."sso_provider_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_login_attempts" ADD CONSTRAINT "sso_login_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_provider_configs" ADD CONSTRAINT "sso_provider_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_provider_id_sso_provider_configs_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."sso_provider_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_user_mappings" ADD CONSTRAINT "sso_user_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_user_mappings" ADD CONSTRAINT "sso_user_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_user_mappings" ADD CONSTRAINT "sso_user_mappings_provider_id_sso_provider_configs_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."sso_provider_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_gen_queue_status_priority_idx" ON "ai_content_generation_queue" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "ai_gen_queue_tenant_status_idx" ON "ai_content_generation_queue" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "ai_gen_queue_target_idx" ON "ai_content_generation_queue" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ai_gen_queue_created_idx" ON "ai_content_generation_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "approval_comments_request_idx" ON "approval_comments" USING btree ("approval_request_id");--> statement-breakpoint
CREATE INDEX "approval_comments_tenant_request_idx" ON "approval_comments" USING btree ("tenant_id","approval_request_id");--> statement-breakpoint
CREATE INDEX "approval_comments_author_idx" ON "approval_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "approval_delegations_delegator_idx" ON "approval_delegations" USING btree ("delegator_id");--> statement-breakpoint
CREATE INDEX "approval_delegations_delegate_idx" ON "approval_delegations" USING btree ("delegate_id");--> statement-breakpoint
CREATE INDEX "approval_delegations_tenant_active_idx" ON "approval_delegations" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "approval_delegations_date_range_idx" ON "approval_delegations" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "approval_requests_tenant_idx" ON "approval_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "approval_requests_deal_idx" ON "approval_requests" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "approval_requests_quote_idx" ON "approval_requests" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "approval_requests_requested_by_idx" ON "approval_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approval_requests_tenant_status_idx" ON "approval_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "approval_requests_sla_deadline_idx" ON "approval_requests" USING btree ("sla_deadline");--> statement-breakpoint
CREATE INDEX "approval_requests_submitted_at_idx" ON "approval_requests" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "approval_rules_tenant_idx" ON "approval_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "approval_rules_tenant_active_idx" ON "approval_rules" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "approval_rules_rule_type_idx" ON "approval_rules" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "approval_rules_priority_idx" ON "approval_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "article_embedding_tenant_idx" ON "article_embeddings" USING btree ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "article_embedding_hash_idx" ON "article_embeddings" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "article_feedback_article_type_idx" ON "article_feedback" USING btree ("article_id","feedback_type");--> statement-breakpoint
CREATE INDEX "article_feedback_unresolved_idx" ON "article_feedback" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "article_feedback_tenant_idx" ON "article_feedback" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "article_feedback_created_idx" ON "article_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "article_version_idx" ON "article_versions" USING btree ("article_id","version");--> statement-breakpoint
CREATE INDEX "article_version_tenant_idx" ON "article_versions" USING btree ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "article_view_article_date_idx" ON "article_views" USING btree ("article_id","viewed_at");--> statement-breakpoint
CREATE INDEX "article_view_user_article_idx" ON "article_views" USING btree ("user_id","article_id");--> statement-breakpoint
CREATE INDEX "article_view_session_idx" ON "article_views" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "article_view_tenant_idx" ON "article_views" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "assignment_groups_tenant_idx" ON "assignment_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "assignment_groups_type_idx" ON "assignment_groups" USING btree ("type");--> statement-breakpoint
CREATE INDEX "billing_history_tenant_id_idx" ON "billing_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_history_status_idx" ON "billing_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_history_invoice_date_idx" ON "billing_history" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "billing_rules_tenant_id_idx" ON "billing_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_rules_tenant_status_idx" ON "billing_rules" USING btree ("tenant_id","rule_status");--> statement-breakpoint
CREATE INDEX "billing_rules_tenant_contract_idx" ON "billing_rules" USING btree ("tenant_id","contract_id");--> statement-breakpoint
CREATE INDEX "billing_rules_tenant_customer_idx" ON "billing_rules" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "billing_rules_tenant_effective_idx" ON "billing_rules" USING btree ("tenant_id","effective_start_date");--> statement-breakpoint
CREATE INDEX "billing_schedules_tenant_id_idx" ON "billing_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_schedules_tenant_active_idx" ON "billing_schedules" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "billing_schedules_tenant_contract_idx" ON "billing_schedules" USING btree ("tenant_id","contract_id");--> statement-breakpoint
CREATE INDEX "billing_schedules_tenant_next_run_idx" ON "billing_schedules" USING btree ("tenant_id","next_run_date");--> statement-breakpoint
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_status_idx" ON "blog_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_posts_category_idx" ON "blog_posts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "blog_posts_tenant_idx" ON "blog_posts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "business_records_tenant_type_idx" ON "business_records" USING btree ("tenant_id","record_type");--> statement-breakpoint
CREATE INDEX "business_records_tenant_status_idx" ON "business_records" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "business_records_url_slug_idx" ON "business_records" USING btree ("url_slug");--> statement-breakpoint
CREATE INDEX "business_records_display_id_idx" ON "business_records" USING btree ("company_display_id");--> statement-breakpoint
CREATE INDEX "business_records_customer_number_idx" ON "business_records" USING btree ("customer_number");--> statement-breakpoint
CREATE INDEX "business_records_created_at_idx" ON "business_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "calculator_analytics_events_session_id_idx" ON "calculator_analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "calculator_analytics_events_visitor_id_idx" ON "calculator_analytics_events" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "calculator_analytics_events_event_type_idx" ON "calculator_analytics_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "calculator_analytics_events_created_at_idx" ON "calculator_analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "calculator_analytics_events_session_event_idx" ON "calculator_analytics_events" USING btree ("session_id","event_type");--> statement-breakpoint
CREATE INDEX "calculator_leads_email_idx" ON "calculator_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "calculator_leads_role_idx" ON "calculator_leads" USING btree ("role");--> statement-breakpoint
CREATE INDEX "calculator_leads_is_dealer_idx" ON "calculator_leads" USING btree ("is_dealer_account");--> statement-breakpoint
CREATE INDEX "calculator_leads_lead_score_idx" ON "calculator_leads" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "calculator_leads_qualified_idx" ON "calculator_leads" USING btree ("is_qualified");--> statement-breakpoint
CREATE INDEX "calculator_leads_sequence_idx" ON "calculator_leads" USING btree ("email_sequence_started","email_sequence_day");--> statement-breakpoint
CREATE INDEX "calculator_leads_created_at_idx" ON "calculator_leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "calculator_sessions_session_key_idx" ON "calculator_sessions" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "calculator_sessions_lead_id_idx" ON "calculator_sessions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "calculator_sessions_visitor_id_idx" ON "calculator_sessions" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "calculator_sessions_created_at_idx" ON "calculator_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "calculator_sessions_industry_idx" ON "calculator_sessions" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "calculator_sessions_completed_idx" ON "calculator_sessions" USING btree ("is_completed");--> statement-breakpoint
CREATE INDEX "calculator_sessions_email_capture_idx" ON "calculator_sessions" USING btree ("has_email_capture");--> statement-breakpoint
CREATE INDEX "case_studies_slug_idx" ON "case_studies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "case_studies_status_idx" ON "case_studies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_tenant_time_idx" ON "client_activity_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "client_activity_time_idx" ON "client_activity_logs" USING btree ("client_id","timestamp");--> statement-breakpoint
CREATE INDEX "client_activity_idx" ON "client_activity_logs" USING btree ("activity");--> statement-breakpoint
CREATE INDEX "client_activity_status_idx" ON "client_activity_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_collected_metrics_tenant_serial_idx" ON "client_collected_metrics" USING btree ("tenant_id","serial_number");--> statement-breakpoint
CREATE INDEX "client_collected_metrics_collection_time_idx" ON "client_collected_metrics" USING btree ("collection_timestamp");--> statement-breakpoint
CREATE INDEX "client_collected_metrics_client_id_idx" ON "client_collected_metrics" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_collected_metrics_device_status_idx" ON "client_collected_metrics" USING btree ("device_status");--> statement-breakpoint
CREATE INDEX "client_collected_metrics_received_at_idx" ON "client_collected_metrics" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "client_registrations_tenant_idx" ON "client_registrations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "client_registrations_client_id_idx" ON "client_registrations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_registrations_api_key_idx" ON "client_registrations" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "commission_adjustments_tenant_id_idx" ON "commission_adjustments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_adjustments_calculation_id_idx" ON "commission_adjustments" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_adjustments_employee_id_idx" ON "commission_adjustments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_adjustments_adjustment_type_idx" ON "commission_adjustments" USING btree ("adjustment_type");--> statement-breakpoint
CREATE INDEX "commission_adjustments_processed_idx" ON "commission_adjustments" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "commission_bonuses_calculation_id_idx" ON "commission_bonuses" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_bonuses_bonus_type_idx" ON "commission_bonuses" USING btree ("bonus_type");--> statement-breakpoint
CREATE INDEX "commission_calculation_details_calculation_id_idx" ON "commission_calculation_details" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_calculation_details_category_idx" ON "commission_calculation_details" USING btree ("category");--> statement-breakpoint
CREATE INDEX "commission_calculations_tenant_id_idx" ON "commission_calculations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_calculations_employee_id_idx" ON "commission_calculations" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_calculations_plan_id_idx" ON "commission_calculations" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "commission_calculations_status_idx" ON "commission_calculations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_calculations_period_idx" ON "commission_calculations" USING btree ("calculation_period_start","calculation_period_end");--> statement-breakpoint
CREATE INDEX "commission_calculations_payout_date_idx" ON "commission_calculations" USING btree ("payout_date");--> statement-breakpoint
CREATE INDEX "commission_dispute_history_dispute_id_idx" ON "commission_dispute_history" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "commission_dispute_history_action_idx" ON "commission_dispute_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "commission_dispute_history_created_at_idx" ON "commission_dispute_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "commission_disputes_tenant_id_idx" ON "commission_disputes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_disputes_dispute_number_idx" ON "commission_disputes" USING btree ("dispute_number");--> statement-breakpoint
CREATE INDEX "commission_disputes_calculation_id_idx" ON "commission_disputes" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_disputes_employee_id_idx" ON "commission_disputes" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_disputes_status_idx" ON "commission_disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_disputes_assigned_to_idx" ON "commission_disputes" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "commission_plan_tiers_plan_id_idx" ON "commission_plan_tiers" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "commission_plan_tiers_tier_level_idx" ON "commission_plan_tiers" USING btree ("tier_level");--> statement-breakpoint
CREATE INDEX "commission_plans_tenant_id_idx" ON "commission_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_plans_active_idx" ON "commission_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "commission_plans_effective_date_idx" ON "commission_plans" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "commission_product_rates_plan_id_idx" ON "commission_product_rates" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "commission_product_rates_category_idx" ON "commission_product_rates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_tenant_id_idx" ON "commission_sales_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_calculation_id_idx" ON "commission_sales_transactions" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_employee_id_idx" ON "commission_sales_transactions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_transaction_type_idx" ON "commission_sales_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_transaction_id_idx" ON "commission_sales_transactions" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_transaction_date_idx" ON "commission_sales_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_processed_idx" ON "commission_sales_transactions" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_charged_back_idx" ON "commission_sales_transactions" USING btree ("is_charged_back");--> statement-breakpoint
CREATE INDEX "content_analytics_content_idx" ON "content_analytics" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "content_analytics_source_idx" ON "content_analytics" USING btree ("source");--> statement-breakpoint
CREATE INDEX "content_analytics_viewed_at_idx" ON "content_analytics" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "content_citations_content_idx" ON "content_citations" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "content_faqs_content_idx" ON "content_faqs" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "contract_renewals_tenant_idx" ON "contract_renewals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contract_renewals_customer_idx" ON "contract_renewals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "contract_renewals_contract_idx" ON "contract_renewals" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_renewals_status_idx" ON "contract_renewals" USING btree ("renewal_status");--> statement-breakpoint
CREATE INDEX "contract_renewals_end_date_idx" ON "contract_renewals" USING btree ("contract_end_date");--> statement-breakpoint
CREATE INDEX "contract_renewals_risk_level_idx" ON "contract_renewals" USING btree ("renewal_risk_level");--> statement-breakpoint
CREATE INDEX "contract_renewals_owner_idx" ON "contract_renewals" USING btree ("renewal_owner_id");--> statement-breakpoint
CREATE INDEX "funnel_signup_id_idx" ON "conversion_funnel_events" USING btree ("signup_id");--> statement-breakpoint
CREATE INDEX "funnel_stage_idx" ON "conversion_funnel_events" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "funnel_created_at_idx" ON "conversion_funnel_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tenant_customer_meter_idx" ON "customer_meter_submissions" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "meter_equipment_idx" ON "customer_meter_submissions" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "meter_reading_date_idx" ON "customer_meter_submissions" USING btree ("reading_date");--> statement-breakpoint
CREATE INDEX "meter_submission_date_idx" ON "customer_meter_submissions" USING btree ("submission_date");--> statement-breakpoint
CREATE INDEX "meter_validation_idx" ON "customer_meter_submissions" USING btree ("is_validated");--> statement-breakpoint
CREATE INDEX "tenant_customer_notification_idx" ON "customer_notifications" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "notification_type_idx" ON "customer_notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notification_created_idx" ON "customer_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "unread_portal_notifications_idx" ON "customer_notifications" USING btree ("is_portal_read");--> statement-breakpoint
CREATE INDEX "tenant_customer_payment_idx" ON "customer_payments" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "customer_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_number_idx" ON "customer_payments" USING btree ("payment_number");--> statement-breakpoint
CREATE INDEX "payment_date_idx" ON "customer_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payment_invoice_idx" ON "customer_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "tenant_customer_idx" ON "customer_portal_access" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "portal_status_idx" ON "customer_portal_access" USING btree ("status");--> statement-breakpoint
CREATE INDEX "portal_email_idx" ON "customer_portal_access" USING btree ("email");--> statement-breakpoint
CREATE INDEX "portal_username_idx" ON "customer_portal_access" USING btree ("username");--> statement-breakpoint
CREATE INDEX "tenant_customer_activity_idx" ON "customer_portal_activity_log" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "activity_action_idx" ON "customer_portal_activity_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "activity_timestamp_idx" ON "customer_portal_activity_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "tenant_customer_service_idx" ON "customer_service_requests" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "service_request_status_idx" ON "customer_service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_request_priority_idx" ON "customer_service_requests" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "service_request_type_idx" ON "customer_service_requests" USING btree ("type");--> statement-breakpoint
CREATE INDEX "service_request_submitted_idx" ON "customer_service_requests" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "service_request_number_idx" ON "customer_service_requests" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "supply_order_items_order_idx" ON "customer_supply_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "supply_order_items_product_idx" ON "customer_supply_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "tenant_customer_supply_idx" ON "customer_supply_orders" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "supply_order_status_idx" ON "customer_supply_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supply_order_number_idx" ON "customer_supply_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "supply_order_submitted_idx" ON "customer_supply_orders" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "daily_usage_tenant_id_idx" ON "daily_usage_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "daily_usage_date_idx" ON "daily_usage_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_dashboard_layouts_tenant" ON "dashboard_layouts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_dashboard_layouts_user" ON "dashboard_layouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dashboard_layouts_category" ON "dashboard_layouts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "dashboard_snapshots_user_id_idx" ON "dashboard_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dashboard_snapshots_layout_id_idx" ON "dashboard_snapshots" USING btree ("layout_id");--> statement-breakpoint
CREATE INDEX "widget_library_tenant_id_idx" ON "dashboard_widget_library" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "widget_library_widget_id_idx" ON "dashboard_widget_library" USING btree ("widget_id");--> statement-breakpoint
CREATE INDEX "dashboard_widgets_key_idx" ON "dashboard_widgets" USING btree ("key");--> statement-breakpoint
CREATE INDEX "dashboard_widgets_type_idx" ON "dashboard_widgets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "deal_stage_history_deal_idx" ON "deal_stage_history" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_stage_history_tenant_deal_idx" ON "deal_stage_history" USING btree ("tenant_id","deal_id");--> statement-breakpoint
CREATE INDEX "deal_stage_history_entered_at_idx" ON "deal_stage_history" USING btree ("entered_at");--> statement-breakpoint
CREATE INDEX "deals_customer_id_idx" ON "deals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "deals_owner_id_idx" ON "deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "deals_tenant_status_idx" ON "deals" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "deals_tenant_stage_idx" ON "deals" USING btree ("tenant_id","stage_id");--> statement-breakpoint
CREATE INDEX "deals_expected_close_date_idx" ON "deals" USING btree ("expected_close_date");--> statement-breakpoint
CREATE INDEX "device_meter_history_tenant_serial_idx" ON "device_meter_history" USING btree ("tenant_id","serial_number");--> statement-breakpoint
CREATE INDEX "device_meter_history_reading_time_idx" ON "device_meter_history" USING btree ("reading_timestamp");--> statement-breakpoint
CREATE INDEX "device_meter_history_billing_period_idx" ON "device_meter_history" USING btree ("billing_period_start","billing_period_end");--> statement-breakpoint
CREATE INDEX "tenant_device_time_idx" ON "device_metrics" USING btree ("tenant_id","device_id","collection_timestamp");--> statement-breakpoint
CREATE INDEX "collection_timestamp_idx" ON "device_metrics" USING btree ("collection_timestamp");--> statement-breakpoint
CREATE INDEX "metrics_device_idx" ON "device_metrics" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "tenant_device_idx" ON "device_registrations" USING btree ("tenant_id","device_id");--> statement-breakpoint
CREATE INDEX "device_integration_idx" ON "device_registrations" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "device_status_idx" ON "device_registrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_last_seen_idx" ON "device_registrations" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "discount_analytics_tenant_idx" ON "discount_analytics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "discount_analytics_period_idx" ON "discount_analytics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "discount_analytics_aggregation_idx" ON "discount_analytics" USING btree ("aggregation_level","aggregation_id");--> statement-breakpoint
CREATE INDEX "discount_redemptions_discount_id_idx" ON "discount_redemptions" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_redemptions_tenant_id_idx" ON "discount_redemptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "discounts_code_idx" ON "discounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discounts_is_active_idx" ON "discounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "email_campaigns_tenant_idx" ON "email_campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_campaigns_type_idx" ON "email_campaigns" USING btree ("campaign_type");--> statement-breakpoint
CREATE INDEX "email_campaigns_scheduled_idx" ON "email_campaigns" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "email_campaigns_owner_idx" ON "email_campaigns" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "email_events_tenant_idx" ON "email_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "email_events_send_idx" ON "email_events" USING btree ("email_send_id");--> statement-breakpoint
CREATE INDEX "email_events_campaign_idx" ON "email_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "email_events_type_idx" ON "email_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "email_events_timestamp_idx" ON "email_events" USING btree ("event_timestamp");--> statement-breakpoint
CREATE INDEX "email_list_members_tenant_idx" ON "email_list_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "email_list_members_list_idx" ON "email_list_members" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "email_list_members_email_idx" ON "email_list_members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_list_members_status_idx" ON "email_list_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_lists_tenant_idx" ON "email_lists" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "email_lists_type_idx" ON "email_lists" USING btree ("list_type");--> statement-breakpoint
CREATE INDEX "email_lists_active_idx" ON "email_lists" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "email_sends_tenant_idx" ON "email_sends" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "email_sends_campaign_idx" ON "email_sends" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "email_sends_recipient_idx" ON "email_sends" USING btree ("recipient_email");--> statement-breakpoint
CREATE INDEX "email_sends_status_idx" ON "email_sends" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_sends_message_id_idx" ON "email_sends" USING btree ("sendgrid_message_id");--> statement-breakpoint
CREATE INDEX "email_sends_sent_at_idx" ON "email_sends" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_sequence_tracking_lead_id_idx" ON "email_sequence_tracking" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "email_sequence_tracking_sequence_day_idx" ON "email_sequence_tracking" USING btree ("sequence_day");--> statement-breakpoint
CREATE INDEX "email_sequence_tracking_status_idx" ON "email_sequence_tracking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_sequence_tracking_scheduled_for_idx" ON "email_sequence_tracking" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "email_sequence_tracking_sent_at_idx" ON "email_sequence_tracking" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_sequence_tracking_lead_sequence_idx" ON "email_sequence_tracking" USING btree ("lead_id","sequence_day");--> statement-breakpoint
CREATE INDEX "email_templates_tenant_idx" ON "email_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "email_templates_type_idx" ON "email_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "email_templates_active_idx" ON "email_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "email_unsubscribes_tenant_idx" ON "email_unsubscribes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "email_unsubscribes_email_idx" ON "email_unsubscribes" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_unsubscribes_type_idx" ON "email_unsubscribes" USING btree ("unsubscribe_type");--> statement-breakpoint
CREATE INDEX "email_unsubscribes_campaign_idx" ON "email_unsubscribes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_tenant_id_idx" ON "employee_commission_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_employee_id_idx" ON "employee_commission_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_plan_id_idx" ON "employee_commission_assignments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_active_idx" ON "employee_commission_assignments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_effective_date_idx" ON "employee_commission_assignments" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "enabled_products_tenant_master_idx" ON "enabled_products" USING btree ("tenant_id","master_product_id");--> statement-breakpoint
CREATE INDEX "enabled_products_tenant_enabled_idx" ON "enabled_products" USING btree ("tenant_id","enabled");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_tenant" ON "enhanced_roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_org_unit" ON "enhanced_roles" USING btree ("organizational_unit_id");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_hierarchy" ON "enhanced_roles" USING btree ("hierarchy_level");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_nested_set" ON "enhanced_roles" USING btree ("lft","rght");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_department" ON "enhanced_roles" USING btree ("department");--> statement-breakpoint
CREATE INDEX "expansion_opportunities_tenant_idx" ON "expansion_opportunities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "expansion_opportunities_customer_idx" ON "expansion_opportunities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "expansion_opportunities_status_idx" ON "expansion_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expansion_opportunities_owner_idx" ON "expansion_opportunities" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "gsc_keyword_property_idx" ON "gsc_keyword_performance" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "gsc_keyword_query_idx" ON "gsc_keyword_performance" USING btree ("query");--> statement-breakpoint
CREATE INDEX "gsc_keyword_date_idx" ON "gsc_keyword_performance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "gsc_oauth_tenant_idx" ON "gsc_oauth_credentials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "gsc_page_property_idx" ON "gsc_page_performance" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "gsc_page_page_idx" ON "gsc_page_performance" USING btree ("page");--> statement-breakpoint
CREATE INDEX "gsc_page_date_idx" ON "gsc_page_performance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "gsc_properties_tenant_idx" ON "gsc_properties" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "gsc_properties_credential_idx" ON "gsc_properties" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "guides_slug_idx" ON "guides" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "guides_status_idx" ON "guides" USING btree ("status");--> statement-breakpoint
CREATE INDEX "guides_pillar_idx" ON "guides" USING btree ("is_pillar");--> statement-breakpoint
CREATE INDEX "handoff_task_templates_tenant_idx" ON "handoff_task_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "handoff_task_templates_type_idx" ON "handoff_task_templates" USING btree ("handoff_type");--> statement-breakpoint
CREATE INDEX "handoff_tasks_handoff_idx" ON "handoff_tasks" USING btree ("handoff_id");--> statement-breakpoint
CREATE INDEX "handoff_tasks_tenant_handoff_idx" ON "handoff_tasks" USING btree ("tenant_id","handoff_id");--> statement-breakpoint
CREATE INDEX "handoff_tasks_assigned_to_idx" ON "handoff_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "handoff_tasks_status_idx" ON "handoff_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "handoff_tasks_due_date_idx" ON "handoff_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "implementation_projects_tenant_idx" ON "implementation_projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "implementation_projects_customer_idx" ON "implementation_projects" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "implementation_projects_status_idx" ON "implementation_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "implementation_projects_pm_idx" ON "implementation_projects" USING btree ("project_manager_id");--> statement-breakpoint
CREATE INDEX "implementation_projects_go_live_idx" ON "implementation_projects" USING btree ("go_live_date");--> statement-breakpoint
CREATE INDEX "industry_benchmarks_industry_idx" ON "industry_benchmarks" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "industry_benchmarks_company_size_idx" ON "industry_benchmarks" USING btree ("company_size");--> statement-breakpoint
CREATE INDEX "industry_benchmarks_industry_company_size_idx" ON "industry_benchmarks" USING btree ("industry","company_size");--> statement-breakpoint
CREATE INDEX "installation_checklists_tenant_idx" ON "installation_checklists" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "installation_checklists_installation_idx" ON "installation_checklists" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "installation_checklists_order_idx" ON "installation_checklists" USING btree ("installation_id","item_order");--> statement-breakpoint
CREATE INDEX "installation_checklists_category_idx" ON "installation_checklists" USING btree ("category");--> statement-breakpoint
CREATE INDEX "installations_tenant_idx" ON "installations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "installations_number_idx" ON "installations" USING btree ("tenant_id","installation_number");--> statement-breakpoint
CREATE INDEX "installations_customer_idx" ON "installations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "installations_status_idx" ON "installations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "installations_scheduled_date_idx" ON "installations" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "tenant_time_idx" ON "integration_audit_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "integration_time_idx" ON "integration_audit_logs" USING btree ("integration_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_status_idx" ON "integration_audit_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "integration_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "integration_credentials_tenant_provider_idx" ON "integration_credentials" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "integration_credentials_status_idx" ON "integration_credentials" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoice_gen_logs_tenant_id_idx" ON "invoice_generation_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoice_gen_logs_tenant_batch_idx" ON "invoice_generation_logs" USING btree ("tenant_id","batch_id");--> statement-breakpoint
CREATE INDEX "invoice_gen_logs_tenant_status_idx" ON "invoice_generation_logs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "invoice_gen_logs_tenant_invoice_idx" ON "invoice_generation_logs" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_gen_logs_tenant_customer_idx" ON "invoice_generation_logs" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "kb_article_category_idx" ON "knowledge_articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "kb_article_status_idx" ON "knowledge_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kb_article_published_idx" ON "knowledge_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "kb_article_tenant_status_idx" ON "knowledge_articles" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "kb_article_featured_idx" ON "knowledge_articles" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "kb_article_content_type_idx" ON "knowledge_articles" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "kb_category_parent_idx" ON "knowledge_categories" USING btree ("parent_category_id");--> statement-breakpoint
CREATE INDEX "kb_category_tenant_idx" ON "knowledge_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "kb_search_tenant_date_idx" ON "knowledge_search_queries" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "kb_search_intent_idx" ON "knowledge_search_queries" USING btree ("query_intent");--> statement-breakpoint
CREATE INDEX "kb_search_user_session_idx" ON "knowledge_search_queries" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE INDEX "landing_pages_slug_idx" ON "landing_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "landing_pages_status_idx" ON "landing_pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "landing_pages_page_type_idx" ON "landing_pages" USING btree ("page_type");--> statement-breakpoint
CREATE INDEX "lead_assignment_history_lead_idx" ON "lead_assignment_history" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_assignment_history_tenant_lead_idx" ON "lead_assignment_history" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_assignment_history_assigned_to_idx" ON "lead_assignment_history" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "lead_assignment_history_assigned_at_idx" ON "lead_assignment_history" USING btree ("assigned_at");--> statement-breakpoint
CREATE INDEX "lead_assignment_queue_tenant_status_idx" ON "lead_assignment_queue" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "lead_assignment_queue_lead_idx" ON "lead_assignment_queue" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_assignment_queue_schedule_idx" ON "lead_assignment_queue" USING btree ("schedule_for");--> statement-breakpoint
CREATE INDEX "lead_assignment_queue_priority_idx" ON "lead_assignment_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "lead_assignment_rules_tenant_idx" ON "lead_assignment_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lead_assignment_rules_tenant_active_idx" ON "lead_assignment_rules" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "lead_assignment_rules_priority_idx" ON "lead_assignment_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "lead_assignment_rules_territory_idx" ON "lead_assignment_rules" USING btree ("territory_id");--> statement-breakpoint
CREATE INDEX "lease_dispositions_lease_idx" ON "lease_dispositions" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "lease_dispositions_action_idx" ON "lease_dispositions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "lease_dispositions_status_idx" ON "lease_dispositions" USING btree ("final_status");--> statement-breakpoint
CREATE INDEX "lease_payments_lease_idx" ON "lease_payments" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "lease_payments_scheduled_date_idx" ON "lease_payments" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "lease_payments_status_idx" ON "lease_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lease_renewals_lease_idx" ON "lease_renewals" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "lease_renewals_deadline_idx" ON "lease_renewals" USING btree ("renewal_deadline");--> statement-breakpoint
CREATE INDEX "leases_tenant_idx" ON "leases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "leases_customer_idx" ON "leases" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "leases_status_idx" ON "leases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leases_end_date_idx" ON "leases" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "location_history_tenant_id_idx" ON "location_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "location_history_technician_id_idx" ON "location_history" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "location_history_ticket_id_idx" ON "location_history" USING btree ("tenant_id","ticket_id");--> statement-breakpoint
CREATE INDEX "location_history_timestamp_idx" ON "location_history" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "location_history_activity_type_idx" ON "location_history" USING btree ("tenant_id","activity_type");--> statement-breakpoint
CREATE INDEX "manufacturer_connections_tenant_idx" ON "manufacturer_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "manufacturer_connections_tenant_manufacturer_idx" ON "manufacturer_connections" USING btree ("tenant_id","manufacturer_type");--> statement-breakpoint
CREATE INDEX "manufacturer_connections_tenant_status_idx" ON "manufacturer_connections" USING btree ("tenant_id","connection_status");--> statement-breakpoint
CREATE INDEX "manufacturer_connections_manufacturer_type_idx" ON "manufacturer_connections" USING btree ("manufacturer_type");--> statement-breakpoint
CREATE INDEX "manufacturer_connections_status_idx" ON "manufacturer_connections" USING btree ("connection_status");--> statement-breakpoint
CREATE INDEX "tenant_manufacturer_idx" ON "manufacturer_integrations" USING btree ("tenant_id","manufacturer");--> statement-breakpoint
CREATE INDEX "integration_status_idx" ON "manufacturer_integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "next_sync_idx" ON "manufacturer_integrations" USING btree ("next_sync");--> statement-breakpoint
CREATE INDEX "manufacturer_order_confirmations_tenant_idx" ON "manufacturer_order_confirmations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_confirmations_tenant_order_idx" ON "manufacturer_order_confirmations" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_confirmations_order_idx" ON "manufacturer_order_confirmations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_confirmations_confirmed_at_idx" ON "manufacturer_order_confirmations" USING btree ("confirmed_at");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_tenant_idx" ON "manufacturer_order_exceptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_tenant_order_idx" ON "manufacturer_order_exceptions" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_tenant_severity_idx" ON "manufacturer_order_exceptions" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_tenant_resolved_idx" ON "manufacturer_order_exceptions" USING btree ("tenant_id","resolved");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_tenant_occurred_at_idx" ON "manufacturer_order_exceptions" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_order_idx" ON "manufacturer_order_exceptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_connection_idx" ON "manufacturer_order_exceptions" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_severity_idx" ON "manufacturer_order_exceptions" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "manufacturer_order_exceptions_resolved_idx" ON "manufacturer_order_exceptions" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "manufacturer_order_line_items_tenant_idx" ON "manufacturer_order_line_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_line_items_tenant_order_idx" ON "manufacturer_order_line_items" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_line_items_order_idx" ON "manufacturer_order_line_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_line_items_product_code_idx" ON "manufacturer_order_line_items" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "manufacturer_order_line_items_inventory_item_idx" ON "manufacturer_order_line_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_shipments_tenant_idx" ON "manufacturer_order_shipments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_shipments_tenant_order_idx" ON "manufacturer_order_shipments" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_shipments_tenant_status_idx" ON "manufacturer_order_shipments" USING btree ("tenant_id","shipment_status");--> statement-breakpoint
CREATE INDEX "manufacturer_order_shipments_order_idx" ON "manufacturer_order_shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "manufacturer_order_shipments_tracking_number_idx" ON "manufacturer_order_shipments" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX "manufacturer_order_shipments_status_idx" ON "manufacturer_order_shipments" USING btree ("shipment_status");--> statement-breakpoint
CREATE INDEX "manufacturer_order_shipments_shipped_date_idx" ON "manufacturer_order_shipments" USING btree ("shipped_date");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_tenant_idx" ON "manufacturer_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_tenant_order_number_idx" ON "manufacturer_orders" USING btree ("tenant_id","order_number");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_tenant_status_idx" ON "manufacturer_orders" USING btree ("tenant_id","order_status");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_tenant_connection_idx" ON "manufacturer_orders" USING btree ("tenant_id","connection_id");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_tenant_order_date_idx" ON "manufacturer_orders" USING btree ("tenant_id","order_date");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_connection_idx" ON "manufacturer_orders" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_status_idx" ON "manufacturer_orders" USING btree ("order_status");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_order_number_idx" ON "manufacturer_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "manufacturer_orders_po_idx" ON "manufacturer_orders" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "master_relationships_base_idx" ON "master_product_accessory_relationships" USING btree ("base_product_id");--> statement-breakpoint
CREATE INDEX "master_relationships_accessory_idx" ON "master_product_accessory_relationships" USING btree ("accessory_id");--> statement-breakpoint
CREATE INDEX "master_relationships_unique_idx" ON "master_product_accessory_relationships" USING btree ("base_product_id","accessory_id");--> statement-breakpoint
CREATE INDEX "master_models_manufacturer_model_idx" ON "master_product_models" USING btree ("manufacturer","model_code");--> statement-breakpoint
CREATE INDEX "master_models_status_idx" ON "master_product_models" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meter_anomalies_tenant_id_idx" ON "meter_anomalies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "meter_anomalies_tenant_meter_idx" ON "meter_anomalies" USING btree ("tenant_id","meter_reading_id");--> statement-breakpoint
CREATE INDEX "meter_anomalies_tenant_equipment_idx" ON "meter_anomalies" USING btree ("tenant_id","equipment_id");--> statement-breakpoint
CREATE INDEX "meter_anomalies_tenant_type_idx" ON "meter_anomalies" USING btree ("tenant_id","anomaly_type");--> statement-breakpoint
CREATE INDEX "meter_anomalies_tenant_severity_idx" ON "meter_anomalies" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "meter_anomalies_tenant_resolved_idx" ON "meter_anomalies" USING btree ("tenant_id","resolved");--> statement-breakpoint
CREATE INDEX "meter_readings_equipment_date_idx" ON "meter_readings" USING btree ("equipment_id","reading_date");--> statement-breakpoint
CREATE INDEX "meter_readings_tenant_date_idx" ON "meter_readings" USING btree ("tenant_id","reading_date");--> statement-breakpoint
CREATE INDEX "meter_readings_tenant_equipment_idx" ON "meter_readings" USING btree ("tenant_id","equipment_id");--> statement-breakpoint
CREATE INDEX "meter_readings_billing_status_idx" ON "meter_readings" USING btree ("tenant_id","billing_status");--> statement-breakpoint
CREATE INDEX "idx_mfa_audit_logs_user" ON "mfa_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mfa_audit_logs_event_type" ON "mfa_audit_logs" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_mfa_audit_logs_user_event" ON "mfa_audit_logs" USING btree ("user_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_mfa_backup_codes_user" ON "mfa_backup_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mfa_backup_codes_user_unused" ON "mfa_backup_codes" USING btree ("user_id","is_used");--> statement-breakpoint
CREATE INDEX "monitored_devices_tenant_client_idx" ON "monitored_devices" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "monitored_devices_serial_number_idx" ON "monitored_devices" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "monitored_devices_ip_address_idx" ON "monitored_devices" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "monitored_devices_enabled_idx" ON "monitored_devices" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "oid_mappings_manufacturer_idx" ON "oid_mappings" USING btree ("manufacturer");--> statement-breakpoint
CREATE INDEX "oid_mappings_default_idx" ON "oid_mappings" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "onboarding_progress_tenant_id_idx" ON "onboarding_progress" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "onboarding_progress_user_id_idx" ON "onboarding_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_org_units_tenant" ON "organizational_units" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_org_units_parent" ON "organizational_units" USING btree ("parent_unit_id");--> statement-breakpoint
CREATE INDEX "idx_org_units_nested_set" ON "organizational_units" USING btree ("lft","rght");--> statement-breakpoint
CREATE INDEX "idx_org_units_type" ON "organizational_units" USING btree ("unit_type");--> statement-breakpoint
CREATE INDEX "idx_permission_cache_user_context" ON "permission_cache" USING btree ("user_id","organizational_context");--> statement-breakpoint
CREATE INDEX "idx_permission_cache_expires" ON "permission_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_permission_cache_hash" ON "permission_cache" USING btree ("permission_hash");--> statement-breakpoint
CREATE INDEX "idx_permission_overrides_user" ON "permission_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_permission_overrides_permission" ON "permission_overrides" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "idx_permission_overrides_effective" ON "permission_overrides" USING btree ("effective_from","effective_until");--> statement-breakpoint
CREATE INDEX "idx_permission_overrides_review" ON "permission_overrides" USING btree ("next_review_date");--> statement-breakpoint
CREATE INDEX "idx_permissions_module" ON "permissions" USING btree ("module");--> statement-breakpoint
CREATE INDEX "idx_permissions_resource_action" ON "permissions" USING btree ("resource_type","action");--> statement-breakpoint
CREATE INDEX "idx_permissions_scope" ON "permissions" USING btree ("scope_level");--> statement-breakpoint
CREATE INDEX "pipeline_automation_logs_deal_idx" ON "pipeline_automation_logs" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "pipeline_automation_logs_status_idx" ON "pipeline_automation_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pipeline_automation_logs_executed_at_idx" ON "pipeline_automation_logs" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "pipeline_stages_pipeline_idx" ON "pipeline_stages" USING btree ("pipeline_template_id");--> statement-breakpoint
CREATE INDEX "pipeline_stages_tenant_pipeline_idx" ON "pipeline_stages" USING btree ("tenant_id","pipeline_template_id");--> statement-breakpoint
CREATE INDEX "pipeline_stages_order_idx" ON "pipeline_stages" USING btree ("order");--> statement-breakpoint
CREATE INDEX "pipeline_templates_tenant_idx" ON "pipeline_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pipeline_templates_tenant_active_idx" ON "pipeline_templates" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "platform_activities_business_record_id_idx" ON "platform_activities" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_activities_deal_id_idx" ON "platform_activities" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "platform_activities_type_idx" ON "platform_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "platform_activities_date_idx" ON "platform_activities" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "platform_activities_created_by_idx" ON "platform_activities" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "platform_activity_reports_period_idx" ON "platform_activity_reports" USING btree ("period","period_start");--> statement-breakpoint
CREATE INDEX "platform_bant_business_record_id_idx" ON "platform_bant_qualification" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_bant_total_score_idx" ON "platform_bant_qualification" USING btree ("total_bant_score");--> statement-breakpoint
CREATE INDEX "platform_business_records_company_name_idx" ON "platform_business_records" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "platform_business_records_email_idx" ON "platform_business_records" USING btree ("primary_contact_email");--> statement-breakpoint
CREATE INDEX "platform_business_records_status_idx" ON "platform_business_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_business_records_type_idx" ON "platform_business_records" USING btree ("record_type");--> statement-breakpoint
CREATE INDEX "platform_business_records_tenant_id_idx" ON "platform_business_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "platform_business_records_assigned_rep_idx" ON "platform_business_records" USING btree ("assigned_sales_rep");--> statement-breakpoint
CREATE INDEX "platform_business_records_lead_score_idx" ON "platform_business_records" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "platform_business_records_next_followup_idx" ON "platform_business_records" USING btree ("next_follow_up_date");--> statement-breakpoint
CREATE INDEX "platform_business_records_created_at_idx" ON "platform_business_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_churn_predictions_record_id_idx" ON "platform_churn_predictions" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_churn_predictions_risk_idx" ON "platform_churn_predictions" USING btree ("churn_risk");--> statement-breakpoint
CREATE INDEX "platform_churn_predictions_date_idx" ON "platform_churn_predictions" USING btree ("predicted_churn_date");--> statement-breakpoint
CREATE INDEX "platform_cohort_analysis_date_idx" ON "platform_cohort_analysis" USING btree ("cohort_date");--> statement-breakpoint
CREATE INDEX "platform_contacts_business_record_id_idx" ON "platform_contacts" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_contacts_email_idx" ON "platform_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "platform_contacts_is_primary_idx" ON "platform_contacts" USING btree ("is_primary_contact");--> statement-breakpoint
CREATE INDEX "platform_deals_business_record_id_idx" ON "platform_deals" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_deals_stage_idx" ON "platform_deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "platform_deals_status_idx" ON "platform_deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_deals_owner_id_idx" ON "platform_deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "platform_deals_expected_close_date_idx" ON "platform_deals" USING btree ("expected_close_date");--> statement-breakpoint
CREATE INDEX "platform_deals_created_at_idx" ON "platform_deals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_health_scores_record_id_idx" ON "platform_health_scores" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_health_scores_status_idx" ON "platform_health_scores" USING btree ("health_status");--> statement-breakpoint
CREATE INDEX "platform_health_scores_overall_idx" ON "platform_health_scores" USING btree ("overall_score");--> statement-breakpoint
CREATE INDEX "platform_assignment_history_record_id_idx" ON "platform_lead_assignment_history" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_assignment_history_assigned_to_idx" ON "platform_lead_assignment_history" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "platform_lead_score_business_record_id_idx" ON "platform_lead_score_calculations" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_lead_score_total_score_idx" ON "platform_lead_score_calculations" USING btree ("total_score");--> statement-breakpoint
CREATE INDEX "platform_lead_score_grade_idx" ON "platform_lead_score_calculations" USING btree ("lead_grade");--> statement-breakpoint
CREATE INDEX "platform_renewals_record_id_idx" ON "platform_renewal_opportunities" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_renewals_contract_end_idx" ON "platform_renewal_opportunities" USING btree ("contract_end_date");--> statement-breakpoint
CREATE INDEX "platform_renewals_status_idx" ON "platform_renewal_opportunities" USING btree ("renewal_status");--> statement-breakpoint
CREATE INDEX "platform_goals_assigned_user_idx" ON "platform_sales_goals" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "platform_goals_period_idx" ON "platform_sales_goals" USING btree ("period","start_date");--> statement-breakpoint
CREATE INDEX "platform_territories_owner_id_idx" ON "platform_sales_territories" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "signups_email_idx" ON "platform_signups" USING btree ("email");--> statement-breakpoint
CREATE INDEX "signups_status_idx" ON "platform_signups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signups_tenant_id_idx" ON "platform_signups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "signups_created_at_idx" ON "platform_signups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "signups_qualification_idx" ON "platform_signups" USING btree ("qualification_score");--> statement-breakpoint
CREATE INDEX "platform_interventions_record_id_idx" ON "platform_success_interventions" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "platform_interventions_status_idx" ON "platform_success_interventions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_interventions_assigned_to_idx" ON "platform_success_interventions" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "platform_interventions_due_date_idx" ON "platform_success_interventions" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "renewal_activities_renewal_idx" ON "renewal_activities" USING btree ("renewal_id");--> statement-breakpoint
CREATE INDEX "renewal_activities_tenant_renewal_idx" ON "renewal_activities" USING btree ("tenant_id","renewal_id");--> statement-breakpoint
CREATE INDEX "renewal_activities_date_idx" ON "renewal_activities" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "renewal_activities_follow_up_idx" ON "renewal_activities" USING btree ("follow_up_date");--> statement-breakpoint
CREATE INDEX "renewal_playbooks_tenant_idx" ON "renewal_playbooks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "renewal_playbooks_active_idx" ON "renewal_playbooks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rep_capacity_tenant_user_idx" ON "rep_capacity" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "rep_capacity_user_idx" ON "rep_capacity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rep_capacity_available_idx" ON "rep_capacity" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_permission" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_effect" ON "role_permissions" USING btree ("effect");--> statement-breakpoint
CREATE INDEX "sales_handoff_tenant_idx" ON "sales_handoff_checklists" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_handoff_customer_idx" ON "sales_handoff_checklists" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_handoff_status_idx" ON "sales_handoff_checklists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_handoff_sales_rep_idx" ON "sales_handoff_checklists" USING btree ("sales_rep_id");--> statement-breakpoint
CREATE INDEX "sales_handoff_csm_idx" ON "sales_handoff_checklists" USING btree ("csm_id");--> statement-breakpoint
CREATE INDEX "sales_territories_tenant_idx" ON "sales_territories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_territories_tenant_active_idx" ON "sales_territories" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "sales_territories_owner_idx" ON "sales_territories" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "seo_alert_rules_tenant_idx" ON "seo_alert_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_alert_rules_active_idx" ON "seo_alert_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "seo_alerts_tenant_idx" ON "seo_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_alerts_status_idx" ON "seo_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seo_alerts_severity_idx" ON "seo_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "seo_audit_history_tenant_idx" ON "seo_audit_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_audit_history_url_idx" ON "seo_audit_history" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seo_audit_history_status_idx" ON "seo_audit_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seo_competitor_tenant_idx" ON "seo_competitor_analysis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_competitor_url_idx" ON "seo_competitor_analysis" USING btree ("competitor_url");--> statement-breakpoint
CREATE INDEX "seo_content_opt_tenant_idx" ON "seo_content_optimization" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_content_opt_status_idx" ON "seo_content_optimization" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seo_content_opt_keyword_idx" ON "seo_content_optimization" USING btree ("target_keyword");--> statement-breakpoint
CREATE INDEX "seo_cwv_tenant_idx" ON "seo_core_web_vitals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_cwv_url_idx" ON "seo_core_web_vitals" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seo_cwv_measured_idx" ON "seo_core_web_vitals" USING btree ("measured_at");--> statement-breakpoint
CREATE INDEX "seo_crawl_tenant_idx" ON "seo_crawl_results" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_crawl_crawlid_idx" ON "seo_crawl_results" USING btree ("crawl_id");--> statement-breakpoint
CREATE INDEX "seo_crawl_url_idx" ON "seo_crawl_results" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seo_duplicate_tenant_idx" ON "seo_duplicate_content" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_duplicate_url1_idx" ON "seo_duplicate_content" USING btree ("url1");--> statement-breakpoint
CREATE INDEX "seo_duplicate_url2_idx" ON "seo_duplicate_content" USING btree ("url2");--> statement-breakpoint
CREATE INDEX "seo_fixes_tenant_idx" ON "seo_fixes_applied" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_fixes_audit_idx" ON "seo_fixes_applied" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "seo_fixes_status_idx" ON "seo_fixes_applied" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seo_image_tenant_idx" ON "seo_image_analysis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_image_page_idx" ON "seo_image_analysis" USING btree ("page_url");--> statement-breakpoint
CREATE INDEX "seo_keyword_history_keyword_idx" ON "seo_keyword_history" USING btree ("keyword_id");--> statement-breakpoint
CREATE INDEX "seo_keyword_history_recorded_idx" ON "seo_keyword_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "seo_keywords_tenant_idx" ON "seo_keywords" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_keywords_keyword_idx" ON "seo_keywords" USING btree ("keyword");--> statement-breakpoint
CREATE INDEX "seo_keywords_active_idx" ON "seo_keywords" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "seo_link_tenant_idx" ON "seo_link_analysis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_link_source_idx" ON "seo_link_analysis" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "seo_link_broken_idx" ON "seo_link_analysis" USING btree ("is_broken");--> statement-breakpoint
CREATE INDEX "seo_mobile_tenant_idx" ON "seo_mobile_analysis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_mobile_url_idx" ON "seo_mobile_analysis" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seo_monitoring_tenant_idx" ON "seo_monitoring_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_monitoring_type_idx" ON "seo_monitoring_log" USING btree ("check_type");--> statement-breakpoint
CREATE INDEX "seo_monitoring_checked_idx" ON "seo_monitoring_log" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "seo_schedules_tenant_idx" ON "seo_monitoring_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_schedules_active_idx" ON "seo_monitoring_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "seo_schedules_next_run_idx" ON "seo_monitoring_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "seo_notif_prefs_tenant_idx" ON "seo_notification_preferences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_notif_prefs_user_idx" ON "seo_notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "seo_page_scores_tenant_idx" ON "seo_page_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_page_scores_url_idx" ON "seo_page_scores" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seo_perf_budget_tenant_idx" ON "seo_performance_budget" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_perf_budget_active_idx" ON "seo_performance_budget" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "seo_redirect_tenant_idx" ON "seo_redirect_analysis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_redirect_source_idx" ON "seo_redirect_analysis" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "seo_security_tenant_idx" ON "seo_security_analysis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_security_url_idx" ON "seo_security_analysis" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seo_semantic_tenant_idx" ON "seo_semantic_analysis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_semantic_keyword_idx" ON "seo_semantic_analysis" USING btree ("keyword");--> statement-breakpoint
CREATE INDEX "seo_settings_tenant_idx" ON "seo_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_schema_tenant_idx" ON "seo_structured_data" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seo_schema_url_idx" ON "seo_structured_data" USING btree ("url");--> statement-breakpoint
CREATE INDEX "seo_schema_type_idx" ON "seo_structured_data" USING btree ("schema_type");--> statement-breakpoint
CREATE INDEX "service_signatures_tenant_idx" ON "service_signatures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "service_signatures_ticket_idx" ON "service_signatures" USING btree ("service_ticket_id");--> statement-breakpoint
CREATE INDEX "service_signatures_installation_idx" ON "service_signatures" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "service_signatures_type_idx" ON "service_signatures" USING btree ("signature_type");--> statement-breakpoint
CREATE INDEX "service_signatures_signed_at_idx" ON "service_signatures" USING btree ("signed_at");--> statement-breakpoint
CREATE INDEX "service_tickets_customer_id_idx" ON "service_tickets" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "service_tickets_technician_id_idx" ON "service_tickets" USING btree ("assigned_technician_id");--> statement-breakpoint
CREATE INDEX "service_tickets_tenant_status_idx" ON "service_tickets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "service_tickets_tenant_created_idx" ON "service_tickets" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "service_tickets_scheduled_date_idx" ON "service_tickets" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "signature_audit_logs_request_idx" ON "signature_audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "signature_audit_logs_signer_idx" ON "signature_audit_logs" USING btree ("signer_id");--> statement-breakpoint
CREATE INDEX "signature_audit_logs_event_type_idx" ON "signature_audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "signature_audit_logs_created_at_idx" ON "signature_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "signature_documents_request_order_idx" ON "signature_documents" USING btree ("request_id","document_order");--> statement-breakpoint
CREATE INDEX "signature_requests_tenant_status_idx" ON "signature_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "signature_requests_customer_idx" ON "signature_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "signature_requests_external_id_idx" ON "signature_requests" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "signature_requests_expires_at_idx" ON "signature_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "signature_signers_request_order_idx" ON "signature_signers" USING btree ("request_id","signer_order");--> statement-breakpoint
CREATE INDEX "signature_signers_status_idx" ON "signature_signers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signature_signers_email_idx" ON "signature_signers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "stage_transitions_pipeline_idx" ON "stage_transitions" USING btree ("pipeline_template_id");--> statement-breakpoint
CREATE INDEX "stage_transitions_from_idx" ON "stage_transitions" USING btree ("from_stage_id");--> statement-breakpoint
CREATE INDEX "stage_transitions_to_idx" ON "stage_transitions" USING btree ("to_stage_id");--> statement-breakpoint
CREATE INDEX "subscription_addons_slug_idx" ON "subscription_addons" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "subscription_addons_category_idx" ON "subscription_addons" USING btree ("category");--> statement-breakpoint
CREATE INDEX "subscription_events_tenant_id_idx" ON "subscription_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "subscription_events_subscription_id_idx" ON "subscription_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_events_event_type_idx" ON "subscription_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "subscription_events_created_at_idx" ON "subscription_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "subscription_notifications_tenant_id_idx" ON "subscription_notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "subscription_notifications_user_id_idx" ON "subscription_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_notifications_status_idx" ON "subscription_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_notifications_type_idx" ON "subscription_notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "subscription_payment_methods_tenant_id_idx" ON "subscription_payment_methods" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "technicians_tenant_user_idx" ON "technicians" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "technicians_tenant_active_idx" ON "technicians" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "technicians_email_idx" ON "technicians" USING btree ("email");--> statement-breakpoint
CREATE INDEX "template_variables_template_idx" ON "template_variables" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "tenant_addon_subscriptions_tenant_id_idx" ON "tenant_addon_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_addon_subscriptions_subscription_id_idx" ON "tenant_addon_subscriptions" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "tenant_addon_subscriptions_addon_id_idx" ON "tenant_addon_subscriptions" USING btree ("addon_id");--> statement-breakpoint
CREATE INDEX "tenant_addon_subscriptions_status_idx" ON "tenant_addon_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_enabled_products_tenant_master_idx" ON "tenant_enabled_products" USING btree ("tenant_id","master_product_id");--> statement-breakpoint
CREATE INDEX "tenant_enabled_products_tenant_enabled_idx" ON "tenant_enabled_products" USING btree ("tenant_id","enabled");--> statement-breakpoint
CREATE INDEX "tenant_subscriptions_tenant_id_idx" ON "tenant_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_subscriptions_status_idx" ON "tenant_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_subscriptions_stripe_subscription_id_idx" ON "tenant_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "tenant_provider_idx" ON "third_party_integrations" USING btree ("tenant_id","provider_name");--> statement-breakpoint
CREATE INDEX "third_party_status_idx" ON "third_party_integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "toner_alerts_tenant_device_idx" ON "toner_alerts" USING btree ("tenant_id","serial_number");--> statement-breakpoint
CREATE INDEX "toner_alerts_status_idx" ON "toner_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "toner_alerts_created_at_idx" ON "toner_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trial_activity_signup_id_idx" ON "trial_activity_log" USING btree ("signup_id");--> statement-breakpoint
CREATE INDEX "trial_activity_type_idx" ON "trial_activity_log" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "trial_activity_created_at_idx" ON "trial_activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "communications_signup_id_idx" ON "trial_communications" USING btree ("signup_id");--> statement-breakpoint
CREATE INDEX "communications_sent_at_idx" ON "trial_communications" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "communications_status_idx" ON "trial_communications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trigger_schedules_trigger_idx" ON "trigger_schedules" USING btree ("trigger_id");--> statement-breakpoint
CREATE INDEX "trigger_schedules_next_run_idx" ON "trigger_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "usage_metrics_tenant_id_idx" ON "usage_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "usage_metrics_period_idx" ON "usage_metrics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "user_dashboard_prefs_user_id_idx" ON "user_dashboard_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_dashboard_prefs_tenant_id_idx" ON "user_dashboard_preferences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_user" ON "user_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_role" ON "user_role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_tenant" ON "user_role_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_org_unit" ON "user_role_assignments" USING btree ("organizational_unit_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_effective" ON "user_role_assignments" USING btree ("effective_from","effective_until");--> statement-breakpoint
CREATE INDEX "white_label_config_tenant_idx" ON "white_label_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "white_label_config_domain_idx" ON "white_label_config" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "white_label_email_templates_tenant_key_idx" ON "white_label_email_templates" USING btree ("tenant_id","template_key");--> statement-breakpoint
CREATE INDEX "white_label_email_templates_tenant_idx" ON "white_label_email_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "white_label_presets_slug_idx" ON "white_label_presets" USING btree ("preset_slug");--> statement-breakpoint
CREATE INDEX "workflow_approvals_tenant_idx" ON "workflow_approvals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_approvals_execution_idx" ON "workflow_approvals" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "workflow_approvals_status_idx" ON "workflow_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_approvals_assigned_user_idx" ON "workflow_approvals" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "workflow_approvals_assigned_group_idx" ON "workflow_approvals" USING btree ("assigned_to_group_id");--> statement-breakpoint
CREATE INDEX "workflow_approvals_due_date_idx" ON "workflow_approvals" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "workflow_conditions_trigger_idx" ON "workflow_conditions" USING btree ("trigger_id");--> statement-breakpoint
CREATE INDEX "workflow_conditions_step_idx" ON "workflow_conditions" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "workflow_conditions_group_idx" ON "workflow_conditions" USING btree ("condition_group");--> statement-breakpoint
CREATE INDEX "workflow_event_registry_event_name_idx" ON "workflow_event_registry" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "workflow_event_registry_category_idx" ON "workflow_event_registry" USING btree ("category");--> statement-breakpoint
CREATE INDEX "workflow_execution_events_execution_idx" ON "workflow_execution_events" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_events_created_at_idx" ON "workflow_execution_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflow_execution_steps_execution_idx" ON "workflow_execution_steps" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_steps_status_idx" ON "workflow_execution_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_executions_workflow_idx" ON "workflow_executions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_executions_tenant_idx" ON "workflow_executions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_executions_created_at_idx" ON "workflow_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflow_step_transitions_step_idx" ON "workflow_step_transitions" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "workflow_steps_automation_workflow_idx" ON "workflow_steps_automation" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_steps_automation_order_idx" ON "workflow_steps_automation" USING btree ("workflow_id","order_index");--> statement-breakpoint
CREATE INDEX "workflow_templates_category_idx" ON "workflow_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "workflow_templates_featured_idx" ON "workflow_templates" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "workflow_triggers_workflow_idx" ON "workflow_triggers" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_triggers_type_idx" ON "workflow_triggers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "workflow_triggers_event_name_idx" ON "workflow_triggers" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "workflow_versions_workflow_idx" ON "workflow_versions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflows_tenant_idx" ON "workflows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflows_status_idx" ON "workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflows_category_idx" ON "workflows" USING btree ("category");--> statement-breakpoint
CREATE INDEX "workflows_is_template_idx" ON "workflows" USING btree ("is_template");--> statement-breakpoint
CREATE INDEX "idx_apollo_usage_tenant_id" ON "apollo_api_usage" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_apollo_usage_endpoint" ON "apollo_api_usage" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "idx_apollo_usage_created_at" ON "apollo_api_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_apollo_usage_success" ON "apollo_api_usage" USING btree ("success");--> statement-breakpoint
CREATE INDEX "idx_apollo_usage_tenant_date" ON "apollo_api_usage" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_apollo_search_hash" ON "apollo_search_cache" USING btree ("search_hash");--> statement-breakpoint
CREATE INDEX "idx_apollo_search_expires" ON "apollo_search_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_apollo_search_created_at" ON "apollo_search_cache" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_centralized_apollo_id" ON "centralized_apollo_contacts" USING btree ("apollo_id");--> statement-breakpoint
CREATE INDEX "idx_centralized_email" ON "centralized_apollo_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_centralized_org_name" ON "centralized_apollo_contacts" USING btree ("organization_name");--> statement-breakpoint
CREATE INDEX "idx_centralized_seniority" ON "centralized_apollo_contacts" USING btree ("seniority");--> statement-breakpoint
CREATE INDEX "idx_centralized_email_status" ON "centralized_apollo_contacts" USING btree ("email_status");--> statement-breakpoint
CREATE INDEX "idx_centralized_last_enriched" ON "centralized_apollo_contacts" USING btree ("last_enriched_at");--> statement-breakpoint
CREATE INDEX "idx_tenant_apollo_tenant_id" ON "tenant_apollo_leads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_apollo_status" ON "tenant_apollo_leads" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_tenant_apollo_contact_id" ON "tenant_apollo_leads" USING btree ("apollo_contact_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_business_record_id" ON "tenant_apollo_leads" USING btree ("business_record_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_added_to_crm" ON "tenant_apollo_leads" USING btree ("tenant_id","added_to_crm");--> statement-breakpoint
CREATE INDEX "idx_tenant_apollo_created_at" ON "tenant_apollo_leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tenant_apollo_lookup" ON "tenant_apollo_leads" USING btree ("tenant_id","apollo_id");--> statement-breakpoint
CREATE INDEX "discovered_tenant_client_idx" ON "client_discovered_devices" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "discovered_ip_idx" ON "client_discovered_devices" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "discovered_registered_idx" ON "client_discovered_devices" USING btree ("is_registered");--> statement-breakpoint
CREATE INDEX "discovered_last_seen_idx" ON "client_discovered_devices" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "tenant_client_idx" ON "monitoring_clients" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "client_status_idx" ON "monitoring_clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_heartbeat_idx" ON "monitoring_clients" USING btree ("last_heartbeat");--> statement-breakpoint
CREATE INDEX "client_api_key_idx" ON "monitoring_clients" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "irs_mileage_logs_tenant_id_idx" ON "irs_mileage_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "irs_mileage_logs_technician_id_idx" ON "irs_mileage_logs" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "irs_mileage_logs_tax_year_idx" ON "irs_mileage_logs" USING btree ("tenant_id","tax_year");--> statement-breakpoint
CREATE INDEX "irs_mileage_logs_trip_date_idx" ON "irs_mileage_logs" USING btree ("tenant_id","trip_date");--> statement-breakpoint
CREATE INDEX "mileage_rates_tenant_id_idx" ON "mileage_reimbursement_rates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mileage_rates_active_idx" ON "mileage_reimbursement_rates" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "mileage_rates_effective_idx" ON "mileage_reimbursement_rates" USING btree ("tenant_id","effective_start_date");--> statement-breakpoint
CREATE INDEX "mileage_reports_tenant_id_idx" ON "mileage_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mileage_reports_technician_id_idx" ON "mileage_reports" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "mileage_reports_period_idx" ON "mileage_reports" USING btree ("tenant_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "mileage_reports_status_idx" ON "mileage_reports" USING btree ("tenant_id","report_status");--> statement-breakpoint
CREATE INDEX "mileage_reports_num_idx" ON "mileage_reports" USING btree ("tenant_id","report_number");--> statement-breakpoint
CREATE INDEX "technician_mileage_tenant_id_idx" ON "technician_mileage" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "technician_mileage_technician_id_idx" ON "technician_mileage" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "technician_mileage_date_idx" ON "technician_mileage" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "technician_mileage_year_month_idx" ON "technician_mileage" USING btree ("tenant_id","year","month_number");--> statement-breakpoint
CREATE INDEX "technician_mileage_status_idx" ON "technician_mileage" USING btree ("tenant_id","reimbursement_status");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_tenant_id_idx" ON "vehicle_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_technician_id_idx" ON "vehicle_assignments" USING btree ("tenant_id","assigned_to_technician_id");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_plate_idx" ON "vehicle_assignments" USING btree ("tenant_id","plate_number");--> statement-breakpoint
CREATE INDEX "vehicle_assignments_active_idx" ON "vehicle_assignments" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "geofence_alert_rules_tenant_id_idx" ON "geofence_alert_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geofence_alert_rules_geofence_id_idx" ON "geofence_alert_rules" USING btree ("tenant_id","geofence_id");--> statement-breakpoint
CREATE INDEX "geofence_alert_rules_active_idx" ON "geofence_alert_rules" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "geofence_alert_rules_trigger_type_idx" ON "geofence_alert_rules" USING btree ("tenant_id","trigger_type");--> statement-breakpoint
CREATE INDEX "geofence_subscriptions_tenant_id_idx" ON "geofence_alert_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geofence_subscriptions_user_id_idx" ON "geofence_alert_subscriptions" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "geofence_subscriptions_type_idx" ON "geofence_alert_subscriptions" USING btree ("tenant_id","subscription_type");--> statement-breakpoint
CREATE INDEX "geofence_subscriptions_active_idx" ON "geofence_alert_subscriptions" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "geofence_alerts_tenant_id_idx" ON "geofence_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geofence_alerts_rule_id_idx" ON "geofence_alerts" USING btree ("tenant_id","alert_rule_id");--> statement-breakpoint
CREATE INDEX "geofence_alerts_geofence_id_idx" ON "geofence_alerts" USING btree ("tenant_id","geofence_id");--> statement-breakpoint
CREATE INDEX "geofence_alerts_technician_id_idx" ON "geofence_alerts" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "geofence_alerts_type_idx" ON "geofence_alerts" USING btree ("tenant_id","alert_type");--> statement-breakpoint
CREATE INDEX "geofence_alerts_severity_idx" ON "geofence_alerts" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "geofence_alerts_acknowledged_idx" ON "geofence_alerts" USING btree ("tenant_id","is_acknowledged");--> statement-breakpoint
CREATE INDEX "geofence_alerts_resolved_idx" ON "geofence_alerts" USING btree ("tenant_id","is_resolved");--> statement-breakpoint
CREATE INDEX "geofence_alerts_triggered_at_idx" ON "geofence_alerts" USING btree ("tenant_id","triggered_at");--> statement-breakpoint
CREATE INDEX "dwell_sessions_tenant_id_idx" ON "technician_dwell_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dwell_sessions_technician_id_idx" ON "technician_dwell_sessions" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "dwell_sessions_geofence_id_idx" ON "technician_dwell_sessions" USING btree ("tenant_id","geofence_id");--> statement-breakpoint
CREATE INDEX "dwell_sessions_active_idx" ON "technician_dwell_sessions" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "dwell_sessions_entry_time_idx" ON "technician_dwell_sessions" USING btree ("tenant_id","entry_time");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_tenant" ON "kpi_definitions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_category" ON "kpi_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_scope" ON "kpi_definitions" USING btree ("organizational_scope");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_code" ON "kpi_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_tenant_date" ON "kpi_values" USING btree ("tenant_id","date_value");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_kpi_period" ON "kpi_values" USING btree ("kpi_definition_id","time_period","date_value");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_location_date" ON "kpi_values" USING btree ("location_id","date_value");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_user_date" ON "kpi_values" USING btree ("user_id","date_value");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_performance" ON "kpi_values" USING btree ("performance_level");--> statement-breakpoint
CREATE INDEX "idx_report_definitions_tenant" ON "report_definitions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_report_definitions_category" ON "report_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_report_definitions_scope" ON "report_definitions" USING btree ("organizational_scope");--> statement-breakpoint
CREATE INDEX "idx_report_definitions_code" ON "report_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_report_executions_tenant_date" ON "report_executions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_report_executions_user_date" ON "report_executions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_report_executions_report" ON "report_executions" USING btree ("report_definition_id");--> statement-breakpoint
CREATE INDEX "idx_report_executions_status" ON "report_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_tenant" ON "report_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_next_run" ON "report_schedules" USING btree ("next_run");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_active" ON "report_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_date" ON "user_report_activity" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_activity_tenant_type" ON "user_report_activity" USING btree ("tenant_id","activity_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_activity_report" ON "user_report_activity" USING btree ("report_definition_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_user" ON "user_report_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_report" ON "user_report_preferences" USING btree ("report_definition_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_favorite" ON "user_report_preferences" USING btree ("favorite_dashboard");--> statement-breakpoint
CREATE INDEX "a11y_audit_type_idx" ON "accessibility_audit_log" USING btree ("audit_type");--> statement-breakpoint
CREATE INDEX "a11y_audit_page_url_idx" ON "accessibility_audit_log" USING btree ("page_url");--> statement-breakpoint
CREATE INDEX "a11y_audit_tenant_id_idx" ON "accessibility_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "a11y_feedback_category_idx" ON "accessibility_feedback" USING btree ("category");--> statement-breakpoint
CREATE INDEX "a11y_feedback_status_idx" ON "accessibility_feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "a11y_feedback_tenant_id_idx" ON "accessibility_feedback" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "a11y_user_id_idx" ON "user_accessibility_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "a11y_tenant_id_idx" ON "user_accessibility_preferences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_id_idx" ON "billing_disputes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_status_idx" ON "billing_disputes" USING btree ("tenant_id","dispute_status");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_invoice_idx" ON "billing_disputes" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_customer_idx" ON "billing_disputes" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_dispute_num_idx" ON "billing_disputes" USING btree ("tenant_id","dispute_number");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_id_idx" ON "credit_memos" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_status_idx" ON "credit_memos" USING btree ("tenant_id","credit_status");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_customer_idx" ON "credit_memos" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_invoice_idx" ON "credit_memos" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_memo_num_idx" ON "credit_memos" USING btree ("tenant_id","credit_memo_number");--> statement-breakpoint
CREATE INDEX "api_key_rate_limits_api_key_idx" ON "api_key_rate_limits" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "api_key_rate_limits_bucket_key_idx" ON "api_key_rate_limits" USING btree ("api_key_id","bucket_type","bucket_key");--> statement-breakpoint
CREATE INDEX "api_key_rate_limits_bucket_end_idx" ON "api_key_rate_limits" USING btree ("bucket_end");--> statement-breakpoint
CREATE INDEX "api_key_rotations_api_key_idx" ON "api_key_rotations" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "api_key_rotations_tenant_idx" ON "api_key_rotations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "api_key_rotations_rotated_at_idx" ON "api_key_rotations" USING btree ("rotated_at");--> statement-breakpoint
CREATE INDEX "api_key_usage_logs_api_key_idx" ON "api_key_usage_logs" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "api_key_usage_logs_tenant_idx" ON "api_key_usage_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "api_key_usage_logs_timestamp_idx" ON "api_key_usage_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "api_key_usage_logs_method_path_idx" ON "api_key_usage_logs" USING btree ("method","path");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_status_idx" ON "api_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "api_keys_expires_at_idx" ON "api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "api_keys_key_type_idx" ON "api_keys" USING btree ("key_type");--> statement-breakpoint
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verifications_email_idx" ON "email_verifications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_verifications_token_idx" ON "email_verifications" USING btree ("token");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "login_attempts_locked_until_idx" ON "login_attempts" USING btree ("locked_until");--> statement-breakpoint
CREATE INDEX "password_resets_user_id_idx" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_resets_token_idx" ON "password_resets" USING btree ("token");--> statement-breakpoint
CREATE INDEX "password_resets_expires_at_idx" ON "password_resets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "blog_content_queue_status_idx" ON "blog_content_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_content_queue_priority_idx" ON "blog_content_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "blog_content_queue_tenant_idx" ON "blog_content_queue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_content_queue_created_at_idx" ON "blog_content_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_tenant_period_idx" ON "customer_satisfaction_analytics" USING btree ("tenant_id","period_type","period_start");--> statement-breakpoint
CREATE INDEX "analytics_period_idx" ON "customer_satisfaction_analytics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "survey_question_template_order_idx" ON "customer_satisfaction_survey_questions" USING btree ("template_id","order_index");--> statement-breakpoint
CREATE INDEX "survey_question_category_idx" ON "customer_satisfaction_survey_questions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "survey_response_survey_question_idx" ON "customer_satisfaction_survey_responses" USING btree ("survey_id","question_id");--> statement-breakpoint
CREATE INDEX "survey_response_rating_idx" ON "customer_satisfaction_survey_responses" USING btree ("rating_value");--> statement-breakpoint
CREATE INDEX "survey_template_tenant_type_idx" ON "customer_satisfaction_survey_templates" USING btree ("tenant_id","survey_type");--> statement-breakpoint
CREATE INDEX "survey_template_active_idx" ON "customer_satisfaction_survey_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "survey_tenant_customer_idx" ON "customer_satisfaction_surveys" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "survey_status_idx" ON "customer_satisfaction_surveys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "survey_type_idx" ON "customer_satisfaction_surveys" USING btree ("survey_type");--> statement-breakpoint
CREATE INDEX "survey_completed_idx" ON "customer_satisfaction_surveys" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "survey_access_token_idx" ON "customer_satisfaction_surveys" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "status_history_tenant_idx" ON "customer_service_request_status_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "status_history_request_idx" ON "customer_service_request_status_history" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "status_history_status_idx" ON "customer_service_request_status_history" USING btree ("new_status");--> statement-breakpoint
CREATE INDEX "status_history_timeline_idx" ON "customer_service_request_status_history" USING btree ("service_request_id","created_at");--> statement-breakpoint
CREATE INDEX "churn_pred_tenant_customer_idx" ON "churn_predictions" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "churn_pred_tenant_risk_idx" ON "churn_predictions" USING btree ("tenant_id","churn_risk");--> statement-breakpoint
CREATE INDEX "churn_pred_tenant_probability_idx" ON "churn_predictions" USING btree ("tenant_id","churn_probability");--> statement-breakpoint
CREATE INDEX "churn_pred_tenant_intervention_idx" ON "churn_predictions" USING btree ("tenant_id","intervention_required");--> statement-breakpoint
CREATE INDEX "churn_pred_predicted_churn_idx" ON "churn_predictions" USING btree ("predicted_churn_date");--> statement-breakpoint
CREATE INDEX "churn_pred_expires_at_idx" ON "churn_predictions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "health_scores_tenant_customer_idx" ON "customer_health_scores" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "health_scores_tenant_status_idx" ON "customer_health_scores" USING btree ("tenant_id","health_status");--> statement-breakpoint
CREATE INDEX "health_scores_tenant_trend_idx" ON "customer_health_scores" USING btree ("tenant_id","trend");--> statement-breakpoint
CREATE INDEX "health_scores_tenant_score_idx" ON "customer_health_scores" USING btree ("tenant_id","overall_score");--> statement-breakpoint
CREATE INDEX "health_scores_calculated_at_idx" ON "customer_health_scores" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "health_scores_next_calc_idx" ON "customer_health_scores" USING btree ("next_calculation_due");--> statement-breakpoint
CREATE INDEX "journeys_tenant_customer_idx" ON "customer_journeys" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "journeys_tenant_stage_idx" ON "customer_journeys" USING btree ("tenant_id","current_stage");--> statement-breakpoint
CREATE INDEX "journeys_tenant_phase_idx" ON "customer_journeys" USING btree ("tenant_id","lifecycle_phase");--> statement-breakpoint
CREATE INDEX "journeys_tenant_health_idx" ON "customer_journeys" USING btree ("tenant_id","journey_health");--> statement-breakpoint
CREATE INDEX "journeys_stage_entered_idx" ON "customer_journeys" USING btree ("stage_entered_at");--> statement-breakpoint
CREATE INDEX "journeys_last_touchpoint_idx" ON "customer_journeys" USING btree ("last_touchpoint_date");--> statement-breakpoint
CREATE INDEX "renewals_tenant_customer_idx" ON "renewal_opportunities" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "renewals_tenant_contract_idx" ON "renewal_opportunities" USING btree ("tenant_id","contract_id");--> statement-breakpoint
CREATE INDEX "renewals_tenant_status_idx" ON "renewal_opportunities" USING btree ("tenant_id","renewal_status");--> statement-breakpoint
CREATE INDEX "renewals_tenant_risk_idx" ON "renewal_opportunities" USING btree ("tenant_id","renewal_risk");--> statement-breakpoint
CREATE INDEX "renewals_tenant_days_until_idx" ON "renewal_opportunities" USING btree ("tenant_id","days_until_renewal");--> statement-breakpoint
CREATE INDEX "renewals_contract_end_date_idx" ON "renewal_opportunities" USING btree ("contract_end_date");--> statement-breakpoint
CREATE INDEX "renewals_assigned_csm_idx" ON "renewal_opportunities" USING btree ("assigned_csm");--> statement-breakpoint
CREATE INDEX "renewals_assigned_sales_idx" ON "renewal_opportunities" USING btree ("assigned_sales_rep");--> statement-breakpoint
CREATE INDEX "renewals_next_contact_idx" ON "renewal_opportunities" USING btree ("next_contact_date");--> statement-breakpoint
CREATE INDEX "interventions_tenant_customer_idx" ON "success_interventions" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "interventions_tenant_status_idx" ON "success_interventions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "interventions_tenant_type_idx" ON "success_interventions" USING btree ("tenant_id","intervention_type");--> statement-breakpoint
CREATE INDEX "interventions_tenant_priority_idx" ON "success_interventions" USING btree ("tenant_id","priority");--> statement-breakpoint
CREATE INDEX "interventions_assigned_to_idx" ON "success_interventions" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "interventions_due_date_idx" ON "success_interventions" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "interventions_scheduled_date_idx" ON "success_interventions" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "consent_audit_tenant_idx" ON "consent_audit_trail" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "consent_audit_consent_idx" ON "consent_audit_trail" USING btree ("consent_record_id");--> statement-breakpoint
CREATE INDEX "consent_audit_changed_at_idx" ON "consent_audit_trail" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "consent_template_tenant_idx" ON "consent_preferences_template" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "consent_template_active_idx" ON "consent_preferences_template" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "consent_records_tenant_idx" ON "consent_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "consent_records_subject_idx" ON "consent_records" USING btree ("tenant_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "consent_records_type_idx" ON "consent_records" USING btree ("tenant_id","consent_type");--> statement-breakpoint
CREATE INDEX "consent_records_status_idx" ON "consent_records" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "consent_records_email_idx" ON "consent_records" USING btree ("tenant_id","subject_email");--> statement-breakpoint
CREATE INDEX "merge_history_tenant_idx" ON "contact_merge_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "merge_history_surviving_idx" ON "contact_merge_history" USING btree ("surviving_record_id");--> statement-breakpoint
CREATE INDEX "merge_history_merged_idx" ON "contact_merge_history" USING btree ("merged_record_id");--> statement-breakpoint
CREATE INDEX "merge_history_merged_at_idx" ON "contact_merge_history" USING btree ("merged_at");--> statement-breakpoint
CREATE INDEX "export_template_tenant_idx" ON "data_export_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "export_template_active_idx" ON "data_export_templates" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "dpa_tenant_idx" ON "data_processing_agreements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dpa_status_idx" ON "data_processing_agreements" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "dpa_vendor_idx" ON "data_processing_agreements" USING btree ("tenant_id","vendor_name");--> statement-breakpoint
CREATE INDEX "dpa_expiration_idx" ON "data_processing_agreements" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "dpa_check_tenant_idx" ON "dpa_compliance_checks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dpa_check_dpa_idx" ON "dpa_compliance_checks" USING btree ("dpa_id");--> statement-breakpoint
CREATE INDEX "dpa_check_date_idx" ON "dpa_compliance_checks" USING btree ("check_date");--> statement-breakpoint
CREATE INDEX "dup_rule_tenant_idx" ON "duplicate_detection_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dup_rule_entity_type_idx" ON "duplicate_detection_rules" USING btree ("tenant_id","entity_type");--> statement-breakpoint
CREATE INDEX "dup_rule_active_idx" ON "duplicate_detection_rules" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "dup_match_tenant_idx" ON "duplicate_matches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dup_match_status_idx" ON "duplicate_matches" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "dup_match_primary_idx" ON "duplicate_matches" USING btree ("primary_record_id");--> statement-breakpoint
CREATE INDEX "dup_match_secondary_idx" ON "duplicate_matches" USING btree ("secondary_record_id");--> statement-breakpoint
CREATE INDEX "dup_match_entity_idx" ON "duplicate_matches" USING btree ("tenant_id","entity_type");--> statement-breakpoint
CREATE INDEX "dup_match_score_idx" ON "duplicate_matches" USING btree ("match_score");--> statement-breakpoint
CREATE INDEX "scan_job_tenant_idx" ON "duplicate_scan_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "scan_job_status_idx" ON "duplicate_scan_jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "scan_job_scheduled_idx" ON "duplicate_scan_jobs" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "data_export_tenant_idx" ON "personal_data_exports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "data_export_subject_idx" ON "personal_data_exports" USING btree ("tenant_id","subject_id");--> statement-breakpoint
CREATE INDEX "data_export_status_idx" ON "personal_data_exports" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "data_export_gdpr_request_idx" ON "personal_data_exports" USING btree ("gdpr_request_id");--> statement-breakpoint
CREATE INDEX "eta_calculations_tenant_id_idx" ON "eta_calculations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "eta_calculations_ticket_id_idx" ON "eta_calculations" USING btree ("tenant_id","ticket_id");--> statement-breakpoint
CREATE INDEX "eta_calculations_technician_id_idx" ON "eta_calculations" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "eta_calculations_route_id_idx" ON "eta_calculations" USING btree ("tenant_id","route_id");--> statement-breakpoint
CREATE INDEX "eta_calculations_calculated_at_idx" ON "eta_calculations" USING btree ("tenant_id","calculated_at");--> statement-breakpoint
CREATE INDEX "geofence_events_tenant_id_idx" ON "geofence_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geofence_events_geofence_id_idx" ON "geofence_events" USING btree ("tenant_id","geofence_id");--> statement-breakpoint
CREATE INDEX "geofence_events_technician_id_idx" ON "geofence_events" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "geofence_events_ticket_id_idx" ON "geofence_events" USING btree ("tenant_id","ticket_id");--> statement-breakpoint
CREATE INDEX "geofence_events_event_type_idx" ON "geofence_events" USING btree ("tenant_id","event_type");--> statement-breakpoint
CREATE INDEX "geofences_tenant_id_idx" ON "geofences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geofences_type_idx" ON "geofences" USING btree ("tenant_id","geofence_type");--> statement-breakpoint
CREATE INDEX "geofences_customer_id_idx" ON "geofences" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "geofences_active_idx" ON "geofences" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "route_assignments_tenant_id_idx" ON "route_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "route_assignments_technician_id_idx" ON "route_assignments" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "route_assignments_route_date_idx" ON "route_assignments" USING btree ("tenant_id","route_date");--> statement-breakpoint
CREATE INDEX "route_assignments_status_idx" ON "route_assignments" USING btree ("tenant_id","route_status");--> statement-breakpoint
CREATE INDEX "route_deviations_tenant_id_idx" ON "route_deviations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "route_deviations_route_id_idx" ON "route_deviations" USING btree ("tenant_id","route_id");--> statement-breakpoint
CREATE INDEX "route_deviations_technician_id_idx" ON "route_deviations" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "route_deviations_type_idx" ON "route_deviations" USING btree ("tenant_id","deviation_type");--> statement-breakpoint
CREATE INDEX "route_deviations_severity_idx" ON "route_deviations" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "route_deviations_resolved_idx" ON "route_deviations" USING btree ("tenant_id","resolved");--> statement-breakpoint
CREATE INDEX "technician_locations_tenant_id_idx" ON "technician_locations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "technician_locations_technician_id_idx" ON "technician_locations" USING btree ("tenant_id","technician_id");--> statement-breakpoint
CREATE INDEX "technician_locations_status_idx" ON "technician_locations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "technician_locations_ticket_id_idx" ON "technician_locations" USING btree ("tenant_id","current_ticket_id");--> statement-breakpoint
CREATE INDEX "technician_locations_timestamp_idx" ON "technician_locations" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "bookmark_user_idx" ON "article_bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmark_tenant_user_idx" ON "article_bookmarks" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "rating_article_idx" ON "article_ratings" USING btree ("article_id","rating");--> statement-breakpoint
CREATE INDEX "rating_user_idx" ON "article_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rating_tenant_article_idx" ON "article_ratings" USING btree ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "rating_created_idx" ON "article_ratings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "vote_article_idx" ON "article_votes" USING btree ("article_id","vote_type");--> statement-breakpoint
CREATE INDEX "vote_user_idx" ON "article_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vote_tenant_article_idx" ON "article_votes" USING btree ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "reading_history_user_idx" ON "reading_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reading_history_last_viewed_idx" ON "reading_history" USING btree ("user_id","last_viewed_at");--> statement-breakpoint
CREATE INDEX "reading_history_completed_idx" ON "reading_history" USING btree ("user_id","completed");--> statement-breakpoint
CREATE INDEX "bant_qualification_lead_idx" ON "bant_qualification_criteria" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "bant_qualification_tenant_lead_idx" ON "bant_qualification_criteria" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "bant_qualification_tenant_idx" ON "bant_qualification_criteria" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bant_qualification_tenant_status_idx" ON "bant_qualification_criteria" USING btree ("tenant_id","qualification_status");--> statement-breakpoint
CREATE INDEX "bant_qualification_status_idx" ON "bant_qualification_criteria" USING btree ("qualification_status");--> statement-breakpoint
CREATE INDEX "bant_qualification_tenant_score_idx" ON "bant_qualification_criteria" USING btree ("tenant_id","total_bant_score");--> statement-breakpoint
CREATE INDEX "lead_engagement_tracking_lead_idx" ON "lead_engagement_tracking" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_engagement_tracking_tenant_lead_idx" ON "lead_engagement_tracking" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_engagement_tracking_tenant_idx" ON "lead_engagement_tracking" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lead_engagement_tracking_tenant_engaged_idx" ON "lead_engagement_tracking" USING btree ("tenant_id","engaged_at");--> statement-breakpoint
CREATE INDEX "lead_engagement_tracking_type_idx" ON "lead_engagement_tracking" USING btree ("engagement_type");--> statement-breakpoint
CREATE INDEX "lead_engagement_tracking_engaged_at_idx" ON "lead_engagement_tracking" USING btree ("engaged_at");--> statement-breakpoint
CREATE INDEX "lead_qualification_history_lead_idx" ON "lead_qualification_history" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_qualification_history_tenant_lead_idx" ON "lead_qualification_history" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_qualification_history_tenant_idx" ON "lead_qualification_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lead_qualification_history_tenant_changed_idx" ON "lead_qualification_history" USING btree ("tenant_id","changed_at");--> statement-breakpoint
CREATE INDEX "lead_qualification_history_changed_at_idx" ON "lead_qualification_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "lead_score_calculations_lead_idx" ON "lead_score_calculations" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_score_calculations_tenant_lead_idx" ON "lead_score_calculations" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_score_calculations_tenant_idx" ON "lead_score_calculations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lead_score_calculations_tenant_score_idx" ON "lead_score_calculations" USING btree ("tenant_id","total_score");--> statement-breakpoint
CREATE INDEX "lead_score_calculations_tenant_calc_at_idx" ON "lead_score_calculations" USING btree ("tenant_id","calculated_at");--> statement-breakpoint
CREATE INDEX "lead_score_calculations_grade_idx" ON "lead_score_calculations" USING btree ("lead_grade");--> statement-breakpoint
CREATE INDEX "lead_score_calculations_tier_idx" ON "lead_score_calculations" USING btree ("lead_tier");--> statement-breakpoint
CREATE INDEX "lead_score_calculations_calculated_at_idx" ON "lead_score_calculations" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "lead_scoring_factors_lead_idx" ON "lead_scoring_factors" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_scoring_factors_tenant_lead_idx" ON "lead_scoring_factors" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_scoring_factors_tenant_idx" ON "lead_scoring_factors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lead_scoring_factors_rule_idx" ON "lead_scoring_factors" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "lead_scoring_factors_evaluated_at_idx" ON "lead_scoring_factors" USING btree ("evaluated_at");--> statement-breakpoint
CREATE INDEX "lead_scoring_rules_tenant_idx" ON "lead_scoring_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lead_scoring_rules_tenant_category_idx" ON "lead_scoring_rules" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "lead_scoring_rules_tenant_active_idx" ON "lead_scoring_rules" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "lead_scoring_rules_category_idx" ON "lead_scoring_rules" USING btree ("category");--> statement-breakpoint
CREATE INDEX "lead_scoring_rules_active_idx" ON "lead_scoring_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "archive_jobs_tenant_idx" ON "audit_archive_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "archive_jobs_status_idx" ON "audit_archive_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "archive_jobs_created_at_idx" ON "audit_archive_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_archives_tenant_idx" ON "audit_log_archives" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_archives_status_idx" ON "audit_log_archives" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_archives_date_range_idx" ON "audit_log_archives" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "change_approvals_change_request_idx" ON "change_approvals" USING btree ("change_request_id");--> statement-breakpoint
CREATE INDEX "change_approvals_approver_idx" ON "change_approvals" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX "change_history_change_request_idx" ON "change_history" USING btree ("change_request_id");--> statement-breakpoint
CREATE INDEX "change_history_timestamp_idx" ON "change_history" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "change_requests_tenant_idx" ON "change_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "change_requests_status_idx" ON "change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "change_requests_requester_idx" ON "change_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "change_requests_created_at_idx" ON "change_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "purge_jobs_tenant_idx" ON "data_purge_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "purge_jobs_policy_idx" ON "data_purge_jobs" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "purge_jobs_status_idx" ON "data_purge_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purge_jobs_created_at_idx" ON "data_purge_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "retention_policies_tenant_idx" ON "data_retention_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "retention_policies_status_idx" ON "data_retention_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "retention_policies_table_idx" ON "data_retention_policies" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "incident_escalations_incident_idx" ON "incident_escalations" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_timeline_incident_idx" ON "incident_timeline" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_timeline_timestamp_idx" ON "incident_timeline" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "incidents_tenant_idx" ON "incidents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_severity_idx" ON "incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "incidents_detected_at_idx" ON "incidents" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "payment_audit_tenant_idx" ON "payment_audit_trail" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_audit_action_idx" ON "payment_audit_trail" USING btree ("action");--> statement-breakpoint
CREATE INDEX "payment_audit_stripe_customer_idx" ON "payment_audit_trail" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "payment_audit_timestamp_idx" ON "payment_audit_trail" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "payment_audit_payment_intent_idx" ON "payment_audit_trail" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_method_changes_tenant_idx" ON "payment_method_changes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_method_changes_user_idx" ON "payment_method_changes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_method_changes_timestamp_idx" ON "payment_method_changes" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "sso_login_attempts_tenant_idx" ON "sso_login_attempts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sso_login_attempts_provider_idx" ON "sso_login_attempts" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "sso_login_attempts_user_idx" ON "sso_login_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sso_login_attempts_request_id_idx" ON "sso_login_attempts" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "sso_login_attempts_initiated_at_idx" ON "sso_login_attempts" USING btree ("initiated_at");--> statement-breakpoint
CREATE INDEX "sso_login_attempts_success_idx" ON "sso_login_attempts" USING btree ("success");--> statement-breakpoint
CREATE INDEX "sso_provider_configs_tenant_idx" ON "sso_provider_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sso_provider_configs_provider_type_idx" ON "sso_provider_configs" USING btree ("provider_type");--> statement-breakpoint
CREATE INDEX "sso_provider_configs_status_idx" ON "sso_provider_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sso_provider_configs_enabled_idx" ON "sso_provider_configs" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "sso_sessions_tenant_idx" ON "sso_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sso_sessions_user_idx" ON "sso_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sso_sessions_provider_idx" ON "sso_sessions" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "sso_sessions_session_id_idx" ON "sso_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sso_sessions_active_idx" ON "sso_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sso_sessions_expires_at_idx" ON "sso_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sso_user_mappings_tenant_idx" ON "sso_user_mappings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sso_user_mappings_user_idx" ON "sso_user_mappings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sso_user_mappings_provider_idx" ON "sso_user_mappings" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "sso_user_mappings_external_id_idx" ON "sso_user_mappings" USING btree ("external_id");