# Database Schema Report

**Generated:** 2026-01-26T05:03:19.058Z

**Statistics:** 210 tables, 4274 columns

## Tables

### _realtime.extensions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| type | text | YES | - | - |
| settings | jsonb | YES | - | - |
| tenant_external_id | text | YES | - | - |
| inserted_at | timestamp without time zone | NO | - | - |
| updated_at | timestamp without time zone | NO | - | - |

### _realtime.schema_migrations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| version | bigint | NO | - | - |
| inserted_at | timestamp without time zone | YES | - | - |

### _realtime.tenants

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| name | text | YES | - | - |
| external_id | text | YES | - | - |
| jwt_secret | text | YES | - | - |
| max_concurrent_users | integer | NO | 200 | - |
| inserted_at | timestamp without time zone | NO | - | - |
| updated_at | timestamp without time zone | NO | - | - |
| max_events_per_second | integer | NO | 100 | - |
| postgres_cdc_default | text | YES | 'postgres_cdc_rls'::text | - |
| max_bytes_per_second | integer | NO | 100000 | - |
| max_channels_per_client | integer | NO | 100 | - |
| max_joins_per_second | integer | NO | 500 | - |
| suspend | boolean | YES | false | - |
| jwt_jwks | jsonb | YES | - | - |
| notify_private_alpha | boolean | YES | false | - |
| private_only | boolean | NO | false | - |

### auth.audit_log_entries

Auth: Audit trail for user actions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| instance_id | uuid | YES | - | - |
| id | uuid | NO | - | - |
| payload | json | YES | - | - |
| created_at | timestamp with time zone | YES | - | - |
| ip_address | character varying(64) | NO | ''::character varying | - |

### auth.flow_state

stores metadata for pkce logins

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| user_id | uuid | YES | - | - |
| auth_code | text | NO | - | - |
| code_challenge_method | USER-DEFINED | NO | - | - |
| code_challenge | text | NO | - | - |
| provider_type | text | NO | - | - |
| provider_access_token | text | YES | - | - |
| provider_refresh_token | text | YES | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |
| authentication_method | text | NO | - | - |
| auth_code_issued_at | timestamp with time zone | YES | - | - |

### auth.identities

Auth: Stores identities associated to a user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| provider_id | text | NO | - | - |
| user_id | uuid | NO | - | - |
| identity_data | jsonb | NO | - | - |
| provider | text | NO | - | - |
| last_sign_in_at | timestamp with time zone | YES | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |
| email | text | YES | - | Auth: Email is a generated column that references the optional email property in the identity_data |
| id | uuid | NO | gen_random_uuid() | - |

### auth.instances

Auth: Manages users across multiple sites.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| uuid | uuid | YES | - | - |
| raw_base_config | text | YES | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |

### auth.mfa_amr_claims

auth: stores authenticator method reference claims for multi factor authentication

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| session_id | uuid | NO | - | - |
| created_at | timestamp with time zone | NO | - | - |
| updated_at | timestamp with time zone | NO | - | - |
| authentication_method | text | NO | - | - |
| id | uuid | NO | - | - |

### auth.mfa_challenges

auth: stores metadata about challenge requests made

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| factor_id | uuid | NO | - | - |
| created_at | timestamp with time zone | NO | - | - |
| verified_at | timestamp with time zone | YES | - | - |
| ip_address | inet | NO | - | - |
| otp_code | text | YES | - | - |
| web_authn_session_data | jsonb | YES | - | - |

### auth.mfa_factors

auth: stores metadata about factors

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| user_id | uuid | NO | - | - |
| friendly_name | text | YES | - | - |
| factor_type | USER-DEFINED | NO | - | - |
| status | USER-DEFINED | NO | - | - |
| created_at | timestamp with time zone | NO | - | - |
| updated_at | timestamp with time zone | NO | - | - |
| secret | text | YES | - | - |
| phone | text | YES | - | - |
| last_challenged_at | timestamp with time zone | YES | - | - |
| web_authn_credential | jsonb | YES | - | - |
| web_authn_aaguid | uuid | YES | - | - |

### auth.one_time_tokens

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| user_id | uuid | NO | - | - |
| token_type | USER-DEFINED | NO | - | - |
| token_hash | text | NO | - | - |
| relates_to | text | NO | - | - |
| created_at | timestamp without time zone | NO | now() | - |
| updated_at | timestamp without time zone | NO | now() | - |

### auth.refresh_tokens

Auth: Store of tokens used to refresh JWT tokens once they expire.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| instance_id | uuid | YES | - | - |
| id | bigint | NO | nextval('auth.refresh_tokens_id_seq'::regclass) | - |
| token | character varying(255) | YES | - | - |
| user_id | character varying(255) | YES | - | - |
| revoked | boolean | YES | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |
| parent | character varying(255) | YES | - | - |
| session_id | uuid | YES | - | - |

### auth.saml_providers

Auth: Manages SAML Identity Provider connections.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| sso_provider_id | uuid | NO | - | - |
| entity_id | text | NO | - | - |
| metadata_xml | text | NO | - | - |
| metadata_url | text | YES | - | - |
| attribute_mapping | jsonb | YES | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |
| name_id_format | text | YES | - | - |

### auth.saml_relay_states

Auth: Contains SAML Relay State information for each Service Provider initiated login.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| sso_provider_id | uuid | NO | - | - |
| request_id | text | NO | - | - |
| for_email | text | YES | - | - |
| redirect_to | text | YES | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |
| flow_state_id | uuid | YES | - | - |

### auth.schema_migrations

Auth: Manages updates to the auth system.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| version | character varying(14) | NO | - | - |

### auth.sessions

Auth: Stores session data associated to a user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| user_id | uuid | NO | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |
| factor_id | uuid | YES | - | - |
| aal | USER-DEFINED | YES | - | - |
| not_after | timestamp with time zone | YES | - | Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired. |
| refreshed_at | timestamp without time zone | YES | - | - |
| user_agent | text | YES | - | - |
| ip | inet | YES | - | - |
| tag | text | YES | - | - |

### auth.sso_domains

Auth: Manages SSO email address domain mapping to an SSO Identity Provider.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| sso_provider_id | uuid | NO | - | - |
| domain | text | NO | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |

### auth.sso_providers

Auth: Manages SSO identity provider information; see saml_providers for SAML.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | - | - |
| resource_id | text | YES | - | Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code. |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |

### auth.users

Auth: Stores user login data within a secure schema.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| instance_id | uuid | YES | - | - |
| id | uuid | NO | - | - |
| aud | character varying(255) | YES | - | - |
| role | character varying(255) | YES | - | - |
| email | character varying(255) | YES | - | - |
| encrypted_password | character varying(255) | YES | - | - |
| email_confirmed_at | timestamp with time zone | YES | - | - |
| invited_at | timestamp with time zone | YES | - | - |
| confirmation_token | character varying(255) | YES | - | - |
| confirmation_sent_at | timestamp with time zone | YES | - | - |
| recovery_token | character varying(255) | YES | - | - |
| recovery_sent_at | timestamp with time zone | YES | - | - |
| email_change_token_new | character varying(255) | YES | - | - |
| email_change | character varying(255) | YES | - | - |
| email_change_sent_at | timestamp with time zone | YES | - | - |
| last_sign_in_at | timestamp with time zone | YES | - | - |
| raw_app_meta_data | jsonb | YES | - | - |
| raw_user_meta_data | jsonb | YES | - | - |
| is_super_admin | boolean | YES | - | - |
| created_at | timestamp with time zone | YES | - | - |
| updated_at | timestamp with time zone | YES | - | - |
| phone | text | YES | NULL::character varying | - |
| phone_confirmed_at | timestamp with time zone | YES | - | - |
| phone_change | text | YES | ''::character varying | - |
| phone_change_token | character varying(255) | YES | ''::character varying | - |
| phone_change_sent_at | timestamp with time zone | YES | - | - |
| confirmed_at | timestamp with time zone | YES | - | - |
| email_change_token_current | character varying(255) | YES | ''::character varying | - |
| email_change_confirm_status | smallint | YES | 0 | - |
| banned_until | timestamp with time zone | YES | - | - |
| reauthentication_token | character varying(255) | YES | ''::character varying | - |
| reauthentication_sent_at | timestamp with time zone | YES | - | - |
| is_sso_user | boolean | NO | false | Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails. |
| deleted_at | timestamp with time zone | YES | - | - |
| is_anonymous | boolean | NO | false | - |

### public.accounts_payable

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| vendor_id | character varying | NO | - | - |
| bill_number | character varying | NO | - | - |
| purchase_order_number | character varying | YES | - | - |
| reference_number | character varying | YES | - | - |
| bill_date | timestamp without time zone | NO | - | - |
| due_date | timestamp without time zone | NO | - | - |
| description | text | YES | - | - |
| subtotal | numeric | NO | - | - |
| tax_amount | numeric | YES | 0 | - |
| total_amount | numeric | NO | - | - |
| paid_amount | numeric | YES | 0 | - |
| balance_amount | numeric | NO | - | - |
| status | character varying | NO | 'pending'::character varying | - |
| priority | character varying | YES | 'normal'::character varying | - |
| category | character varying | YES | - | - |
| department | character varying | YES | - | - |
| payment_method | character varying | YES | - | - |
| payment_date | timestamp without time zone | YES | - | - |
| check_number | character varying | YES | - | - |
| approved_by | character varying | YES | - | - |
| approved_date | timestamp without time zone | YES | - | - |
| approval_notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.accounts_receivable

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('accounts_receivable_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| customer_ref | character varying(255) | YES | - | - |
| invoice_ref | character varying(255) | YES | - | - |
| amount | numeric | YES | - | - |
| balance | numeric | YES | - | - |
| due_date | date | YES | - | - |
| status | character varying(50) | YES | - | - |
| description | text | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.audit_logs

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | - | - |
| user_id | character varying | YES | - | - |
| action | character varying | YES | - | - |
| table_name | character varying | YES | - | - |
| record_id | character varying | YES | - | - |
| old_values | jsonb | YES | - | - |
| new_values | jsonb | YES | - | - |
| timestamp | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| ip_address | character varying | YES | - | - |
| user_agent | text | YES | - | - |
| tenant_id | character varying | YES | - | - |

### public.automated_tasks

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| task_title | character varying | NO | - | - |
| task_description | text | YES | - | - |
| task_type | character varying | NO | - | - |
| task_category | character varying | NO | - | - |
| created_by_workflow_id | character varying | YES | - | - |
| created_by_rule_id | character varying | YES | - | - |
| automation_trigger | character varying | YES | - | - |
| priority | character varying | YES | 'medium'::character varying | - |
| urgency_score | integer | YES | 5 | - |
| estimated_duration_minutes | integer | YES | - | - |
| complexity_level | character varying | YES | 'medium'::character varying | - |
| assigned_to | character varying | YES | - | - |
| assigned_team | character varying | YES | - | - |
| assignment_method | character varying | YES | 'auto'::character varying | - |
| assignment_criteria | jsonb | YES | - | - |
| due_date | date | YES | - | - |
| due_time | time without time zone | YES | - | - |
| start_after | timestamp without time zone | YES | - | - |
| must_complete_by | timestamp without time zone | YES | - | - |
| status | character varying | YES | 'pending'::character varying | - |
| progress_percentage | numeric | YES | 0 | - |
| last_activity | timestamp without time zone | YES | now() | - |
| depends_on_tasks | jsonb | YES | - | - |
| blocks_tasks | jsonb | YES | - | - |
| related_entity_type | character varying | YES | - | - |
| related_entity_id | character varying | YES | - | - |
| task_data | jsonb | YES | - | - |
| input_requirements | jsonb | YES | - | - |
| output_expectations | jsonb | YES | - | - |
| started_at | timestamp without time zone | YES | - | - |
| completed_at | timestamp without time zone | YES | - | - |
| actual_duration_minutes | numeric | YES | - | - |
| completion_quality_score | numeric | YES | - | - |
| completion_notes | text | YES | - | - |
| task_results | jsonb | YES | - | - |
| customer_satisfaction | integer | YES | - | - |
| escalation_level | integer | YES | 0 | - |
| escalated_to | character varying | YES | - | - |
| escalation_reason | text | YES | - | - |
| follow_up_required | boolean | YES | false | - |
| follow_up_date | date | YES | - | - |
| requires_review | boolean | YES | false | - |
| reviewed_by | character varying | YES | - | - |
| review_status | character varying | YES | - | - |
| review_comments | text | YES | - | - |
| reminder_schedule | jsonb | YES | - | - |
| last_reminder_sent | timestamp without time zone | YES | - | - |
| notification_preferences | jsonb | YES | - | - |
| sla_compliance | boolean | YES | - | - |
| efficiency_score | numeric | YES | - | - |
| rework_required | boolean | YES | false | - |
| rework_reason | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.automation_rules

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| rule_name | character varying | NO | - | - |
| rule_description | text | YES | - | - |
| rule_category | character varying | NO | - | - |
| trigger_events | jsonb | NO | - | - |
| conditions | jsonb | NO | - | - |
| condition_logic | character varying | YES | 'AND'::character varying | - |
| actions | jsonb | NO | - | - |
| action_sequence | character varying | YES | 'sequential'::character varying | - |
| delay_before_action | integer | YES | 0 | - |
| execution_window | jsonb | YES | - | - |
| cooldown_period | integer | YES | 0 | - |
| priority | integer | YES | 5 | - |
| is_critical | boolean | YES | false | - |
| bypass_business_hours | boolean | YES | false | - |
| applies_to_entities | jsonb | YES | - | - |
| entity_filters | jsonb | YES | - | - |
| department_scope | jsonb | YES | - | - |
| max_executions_per_day | integer | YES | - | - |
| max_executions_per_hour | integer | YES | - | - |
| max_concurrent_executions | integer | YES | 1 | - |
| requires_approval | boolean | YES | false | - |
| approved_by | character varying | YES | - | - |
| approval_date | date | YES | - | - |
| governance_notes | text | YES | - | - |
| execution_count | integer | YES | 0 | - |
| success_count | integer | YES | 0 | - |
| last_executed | timestamp without time zone | YES | - | - |
| last_success | timestamp without time zone | YES | - | - |
| is_active | boolean | YES | true | - |
| is_test_mode | boolean | YES | false | - |
| effective_from | date | YES | - | - |
| effective_until | date | YES | - | - |
| depends_on_rules | jsonb | YES | - | - |
| conflicts_with_rules | jsonb | YES | - | - |
| average_execution_time_ms | numeric | YES | - | - |
| error_rate | numeric | YES | - | - |
| impact_score | numeric | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.billing_adjustments

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| invoice_id | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| adjustment_type | character varying | NO | - | - |
| adjustment_reason | character varying | NO | - | - |
| amount | numeric | NO | - | - |
| currency | character varying | YES | 'USD'::character varying | - |
| status | character varying | YES | 'pending'::character varying | - |
| requested_by | character varying | NO | - | - |
| approved_by | character varying | YES | - | - |
| approval_date | timestamp without time zone | YES | - | - |
| rejection_reason | text | YES | - | - |
| applied_date | timestamp without time zone | YES | - | - |
| reversal_id | character varying | YES | - | - |
| description | text | YES | - | - |
| supporting_documents | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.billing_configurations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| configuration_name | character varying | NO | - | - |
| billing_type | character varying | NO | - | - |
| is_active | boolean | YES | true | - |
| is_default | boolean | YES | false | - |
| billing_frequency | character varying | YES | 'monthly'::character varying | - |
| billing_day | integer | YES | 1 | - |
| base_rate | numeric | YES | 0 | - |
| minimum_charge | numeric | YES | 0 | - |
| maximum_charge | numeric | YES | - | - |
| usage_tiers | jsonb | YES | - | - |
| overage_rate | numeric | YES | 0 | - |
| setup_fee | numeric | YES | 0 | - |
| maintenance_fee | numeric | YES | 0 | - |
| contract_length_months | integer | YES | - | - |
| early_termination_fee | numeric | YES | - | - |
| currency | character varying | YES | 'USD'::character varying | - |
| tax_rate | numeric | YES | 0 | - |
| tax_inclusive | boolean | YES | false | - |
| applicable_equipment_types | jsonb | YES | - | - |
| applicable_service_types | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.billing_cycles

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| cycle_name | character varying | NO | - | - |
| cycle_date | date | NO | - | - |
| status | character varying | YES | 'pending'::character varying | - |
| total_customers | integer | YES | 0 | - |
| processed_customers | integer | YES | 0 | - |
| failed_customers | integer | YES | 0 | - |
| total_invoices_generated | integer | YES | 0 | - |
| total_amount | numeric | YES | 0 | - |
| started_at | timestamp without time zone | YES | - | - |
| completed_at | timestamp without time zone | YES | - | - |
| processing_duration_seconds | integer | YES | - | - |
| error_count | integer | YES | 0 | - |
| error_details | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.billing_invoices

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| invoice_number | character varying | NO | - | - |
| invoice_date | date | NO | - | - |
| due_date | date | NO | - | - |
| billing_period_start | date | NO | - | - |
| billing_period_end | date | NO | - | - |
| status | character varying | YES | 'draft'::character varying | - |
| subtotal | numeric | YES | 0 | - |
| tax_amount | numeric | YES | 0 | - |
| total_amount | numeric | YES | 0 | - |
| paid_amount | numeric | YES | 0 | - |
| balance_due | numeric | YES | 0 | - |
| currency | character varying | YES | 'USD'::character varying | - |
| payment_terms | character varying | YES | 'net_30'::character varying | - |
| billing_configuration_id | character varying | YES | - | - |
| notes | text | YES | - | - |
| purchase_order_number | character varying | YES | - | - |
| auto_generated | boolean | YES | false | - |
| billing_cycle_id | character varying | YES | - | - |
| payment_method | character varying | YES | - | - |
| payment_date | date | YES | - | - |
| payment_reference | character varying | YES | - | - |
| dispute_reason | text | YES | - | - |
| dispute_date | date | YES | - | - |
| dispute_resolved_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.billing_line_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| invoice_id | character varying | NO | - | - |
| line_number | integer | NO | - | - |
| item_type | character varying | NO | - | - |
| product_id | character varying | YES | - | - |
| equipment_id | character varying | YES | - | - |
| service_id | character varying | YES | - | - |
| description | text | NO | - | - |
| unit_of_measure | character varying | YES | 'each'::character varying | - |
| quantity | numeric | YES | 1 | - |
| unit_price | numeric | NO | - | - |
| line_total | numeric | NO | - | - |
| meter_start_reading | integer | YES | - | - |
| meter_end_reading | integer | YES | - | - |
| usage_amount | integer | YES | - | - |
| service_period_start | date | YES | - | - |
| service_period_end | date | YES | - | - |
| taxable | boolean | YES | true | - |
| tax_rate | numeric | YES | 0 | - |
| tax_amount | numeric | YES | 0 | - |
| discount_percentage | numeric | YES | 0 | - |
| discount_amount | numeric | YES | 0 | - |
| adjustment_reason | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.budget_vs_actual

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| comparison_name | character varying | NO | - | - |
| budget_period | date | NO | - | - |
| category | character varying | NO | - | - |
| subcategory | character varying | YES | - | - |
| budgeted_amount | numeric | NO | - | - |
| actual_amount | numeric | YES | 0 | - |
| variance_amount | numeric | YES | 0 | - |
| variance_percentage | numeric | YES | 0 | - |
| variance_type | character varying | YES | - | - |
| variance_explanation | text | YES | - | - |
| corrective_actions | text | YES | - | - |
| ytd_budget | numeric | YES | 0 | - |
| ytd_actual | numeric | YES | 0 | - |
| forecast_revision | numeric | YES | 0 | - |
| responsible_department | character varying | YES | - | - |
| responsible_manager | character varying | YES | - | - |
| follow_up_required | boolean | YES | false | - |
| follow_up_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.business_intelligence_dashboards

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| dashboard_name | character varying | NO | - | - |
| dashboard_type | character varying | NO | - | - |
| category | character varying | NO | - | - |
| dashboard_config | jsonb | NO | - | - |
| widget_configurations | jsonb | YES | - | - |
| data_sources | jsonb | YES | - | - |
| owner_id | character varying | NO | - | - |
| visibility | character varying | YES | 'private'::character varying | - |
| authorized_roles | jsonb | YES | - | - |
| authorized_users | jsonb | YES | - | - |
| layout_type | character varying | YES | 'grid'::character varying | - |
| refresh_interval | integer | YES | 300 | - |
| auto_refresh | boolean | YES | true | - |
| default_filters | jsonb | YES | - | - |
| parameter_definitions | jsonb | YES | - | - |
| drill_down_enabled | boolean | YES | true | - |
| cache_duration | integer | YES | 900 | - |
| last_generated | timestamp without time zone | YES | - | - |
| generation_time_ms | integer | YES | - | - |
| query_performance_stats | jsonb | YES | - | - |
| view_count | integer | YES | 0 | - |
| last_viewed | timestamp without time zone | YES | - | - |
| average_session_duration | integer | YES | - | - |
| most_used_widgets | jsonb | YES | - | - |
| alert_configurations | jsonb | YES | - | - |
| notification_settings | jsonb | YES | - | - |
| is_active | boolean | YES | true | - |
| is_featured | boolean | YES | false | - |
| maintenance_mode | boolean | YES | false | - |
| deprecation_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.business_record_activities

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| business_record_id | character varying | YES | - | References businessRecords.id (legacy architecture) |
| activity_type | character varying | NO | - | - |
| subject | character varying | NO | - | - |
| description | text | YES | - | - |
| direction | character varying | YES | - | - |
| email_from | character varying | YES | - | - |
| email_to | text | YES | - | - |
| email_cc | text | YES | - | - |
| email_subject | character varying | YES | - | - |
| email_body | text | YES | - | - |
| is_shared | boolean | YES | false | - |
| call_duration | integer | YES | - | - |
| call_outcome | character varying | YES | - | - |
| scheduled_date | timestamp without time zone | YES | - | - |
| completed_date | timestamp without time zone | YES | - | - |
| due_date | timestamp without time zone | YES | - | - |
| outcome | character varying | YES | - | - |
| next_action | text | YES | - | - |
| follow_up_date | timestamp without time zone | YES | - | - |
| related_records | jsonb | YES | - | - |
| attachments | jsonb | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| company_id | character varying | YES | - | References companies.id (new architecture) |

### public.business_records

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| record_type | character varying | NO | 'lead'::character varying | - |
| status | character varying | NO | 'new'::character varying | - |
| company_name | character varying | NO | - | - |
| website | character varying | YES | - | - |
| industry | character varying | YES | - | - |
| primary_contact_name | character varying | YES | - | - |
| primary_contact_email | character varying | YES | - | - |
| primary_contact_phone | character varying | YES | - | - |
| primary_contact_title | character varying | YES | - | - |
| address_line1 | character varying | YES | - | - |
| address_line2 | character varying | YES | - | - |
| city | character varying | YES | - | - |
| state | character varying | YES | - | - |
| postal_code | character varying | YES | - | - |
| country | character varying | YES | 'US'::character varying | - |
| phone | character varying | YES | - | - |
| source | character varying | NO | 'website'::character varying | - |
| estimated_deal_value | numeric | YES | - | - |
| probability | integer | YES | 50 | - |
| close_date | timestamp without time zone | YES | - | - |
| priority | character varying | YES | 'medium'::character varying | - |
| owner_id | character varying | YES | - | - |
| assigned_sales_rep | character varying | YES | - | - |
| customer_number | character varying | YES | - | - |
| customer_since | timestamp without time zone | YES | - | - |
| last_contact_date | timestamp without time zone | YES | - | - |
| next_follow_up | timestamp without time zone | YES | - | - |
| notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| created_by | character varying | YES | - | - |
| updated_by | character varying | YES | - | - |
| territory | character varying | YES | - | - |
| employee_count | integer | YES | - | - |
| annual_revenue | numeric | YES | - | - |
| next_follow_up_date | timestamp without time zone | YES | - | - |
| lead_score | integer | YES | 0 | - |
| activity_type | character varying | YES | - | - |
| activity_subject | text | YES | - | - |
| activity_outcome | character varying | YES | - | - |
| activity_duration | integer | YES | - | - |
| activity_date | timestamp without time zone | YES | - | - |
| related_to | character varying | YES | - | - |
| direction | character varying | YES | - | - |
| email_to | character varying | YES | - | - |
| email_cc | character varying | YES | - | - |
| outcome | character varying | YES | - | - |
| due_date | timestamp without time zone | YES | - | - |
| completed_date | timestamp without time zone | YES | - | - |
| next_action | text | YES | - | - |
| follow_up_date | timestamp without time zone | YES | - | - |

### public.cash_flow_projections

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| projection_name | character varying | NO | - | - |
| projection_period | date | NO | - | - |
| beginning_cash | numeric | YES | 0 | - |
| collections_forecast | numeric | YES | 0 | - |
| other_income | numeric | YES | 0 | - |
| total_cash_inflow | numeric | YES | 0 | - |
| payroll_expenses | numeric | YES | 0 | - |
| operating_expenses | numeric | YES | 0 | - |
| equipment_purchases | numeric | YES | 0 | - |
| loan_payments | numeric | YES | 0 | - |
| tax_payments | numeric | YES | 0 | - |
| other_expenses | numeric | YES | 0 | - |
| total_cash_outflow | numeric | YES | 0 | - |
| net_cash_flow | numeric | YES | 0 | - |
| ending_cash | numeric | YES | 0 | - |
| minimum_cash_required | numeric | YES | 0 | - |
| cash_shortage_risk | boolean | YES | false | - |
| days_cash_on_hand | integer | YES | 0 | - |
| assumptions | text | YES | - | - |
| risk_factors | text | YES | - | - |
| status | character varying | YES | 'draft'::character varying | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.commission_analytics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| analytics_period | character varying | NO | - | - |
| period_type | character varying | NO | - | - |
| period_start_date | date | NO | - | - |
| period_end_date | date | NO | - | - |
| sales_rep_id | character varying | NO | - | - |
| sales_rep_name | character varying | NO | - | - |
| total_sales_amount | numeric | YES | 0 | - |
| total_deals_closed | integer | YES | 0 | - |
| average_deal_size | numeric | YES | 0 | - |
| quota_target | numeric | YES | 0 | - |
| quota_achievement_percentage | numeric | YES | 0 | - |
| gross_commission_earned | numeric | YES | 0 | - |
| commission_adjustments | numeric | YES | 0 | - |
| commission_clawbacks | numeric | YES | 0 | - |
| net_commission_earned | numeric | YES | 0 | - |
| average_commission_rate | numeric | YES | 0 | - |
| sales_rank_in_team | integer | YES | - | - |
| sales_rank_in_company | integer | YES | - | - |
| commission_rank_in_team | integer | YES | - | - |
| commission_rank_in_company | integer | YES | - | - |
| hardware_sales | numeric | YES | 0 | - |
| software_sales | numeric | YES | 0 | - |
| services_sales | numeric | YES | 0 | - |
| supplies_sales | numeric | YES | 0 | - |
| maintenance_sales | numeric | YES | 0 | - |
| hardware_commission | numeric | YES | 0 | - |
| software_commission | numeric | YES | 0 | - |
| services_commission | numeric | YES | 0 | - |
| supplies_commission | numeric | YES | 0 | - |
| maintenance_commission | numeric | YES | 0 | - |
| customer_satisfaction_score | numeric | YES | 0 | - |
| deal_close_rate | numeric | YES | 0 | - |
| average_sales_cycle_days | integer | YES | 0 | - |
| volume_bonuses_earned | numeric | YES | 0 | - |
| quota_bonuses_earned | numeric | YES | 0 | - |
| special_incentives_earned | numeric | YES | 0 | - |
| total_bonuses_earned | numeric | YES | 0 | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.commission_calculations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| calculation_period_start | date | NO | - | - |
| calculation_period_end | date | NO | - | - |
| calculation_run_date | timestamp without time zone | YES | now() | - |
| employee_id | character varying | NO | - | - |
| commission_structure_id | character varying | NO | - | - |
| total_sales_amount | numeric | YES | 0 | - |
| total_gross_profit | numeric | YES | 0 | - |
| total_net_profit | numeric | YES | 0 | - |
| total_units_sold | integer | YES | 0 | - |
| commission_base_amount | numeric | YES | 0 | - |
| base_commission_rate | numeric | YES | 0 | - |
| base_commission_amount | numeric | YES | 0 | - |
| tier_commission_amount | numeric | YES | 0 | - |
| performance_bonus_amount | numeric | YES | 0 | - |
| team_bonus_amount | numeric | YES | 0 | - |
| gross_commission_amount | numeric | YES | 0 | - |
| adjustments | numeric | YES | 0 | - |
| net_commission_amount | numeric | YES | 0 | - |
| payment_status | character varying | YES | 'pending'::character varying | - |
| payment_due_date | date | YES | - | - |
| payment_date | date | YES | - | - |
| payment_reference | character varying | YES | - | - |
| commission_breakdown | jsonb | YES | - | - |
| performance_metrics | jsonb | YES | - | - |
| calculated_by | character varying | NO | - | - |
| approved_by | character varying | YES | - | - |
| approval_date | timestamp without time zone | YES | - | - |
| notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.commission_disputes

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| dispute_number | character varying | NO | - | - |
| dispute_type | character varying | NO | - | - |
| employee_id | character varying | NO | - | - |
| commission_calculation_id | character varying | YES | - | - |
| sale_id | character varying | YES | - | - |
| payment_id | character varying | YES | - | - |
| dispute_amount | numeric | YES | - | - |
| claimed_amount | numeric | YES | - | - |
| description | text | NO | - | - |
| supporting_documentation | jsonb | YES | - | - |
| status | character varying | YES | 'open'::character varying | - |
| priority | character varying | YES | 'medium'::character varying | - |
| dispute_date | date | NO | - | - |
| response_due_date | date | YES | - | - |
| resolution_date | date | YES | - | - |
| assigned_to | character varying | YES | - | - |
| resolution_type | character varying | YES | - | - |
| resolution_amount | numeric | YES | - | - |
| resolution_notes | text | YES | - | - |
| adjustment_required | boolean | YES | false | - |
| recalculation_required | boolean | YES | false | - |
| policy_update_required | boolean | YES | false | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.commission_payments

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| payment_batch_id | character varying | YES | - | - |
| payment_date | date | NO | - | - |
| payment_period_start | date | NO | - | - |
| payment_period_end | date | NO | - | - |
| employee_id | character varying | NO | - | - |
| gross_commission_amount | numeric | NO | - | - |
| tax_withholding | numeric | YES | 0 | - |
| other_deductions | numeric | YES | 0 | - |
| net_payment_amount | numeric | NO | - | - |
| payment_method | character varying | YES | 'payroll'::character varying | - |
| payment_reference | character varying | YES | - | - |
| payment_account | character varying | YES | - | - |
| calculation_ids | jsonb | YES | - | - |
| payment_status | character varying | YES | 'scheduled'::character varying | - |
| processing_date | timestamp without time zone | YES | - | - |
| completion_date | timestamp without time zone | YES | - | - |
| bank_reference | character varying | YES | - | - |
| reconciled | boolean | YES | false | - |
| reconciliation_date | date | YES | - | - |
| payment_notes | text | YES | - | - |
| adjustment_reason | text | YES | - | - |
| adjustment_amount | numeric | YES | 0 | - |
| created_by | character varying | NO | - | - |
| approved_by | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.commission_sales_data

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| sale_id | character varying | NO | - | - |
| sale_date | date | NO | - | - |
| invoice_id | character varying | YES | - | - |
| primary_sales_rep_id | character varying | NO | - | - |
| secondary_sales_reps | jsonb | YES | - | - |
| sales_manager_id | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| product_category | character varying | YES | - | - |
| product_type | character varying | YES | - | - |
| sale_amount | numeric | NO | - | - |
| cost_of_goods | numeric | YES | 0 | - |
| gross_profit | numeric | YES | 0 | - |
| net_profit | numeric | YES | 0 | - |
| commission_eligible | boolean | YES | true | - |
| commission_percentage | numeric | YES | - | - |
| commission_amount | numeric | YES | - | - |
| commission_split | jsonb | YES | - | - |
| commission_override_reason | text | YES | - | - |
| override_amount | numeric | YES | - | - |
| payment_status | character varying | YES | 'pending_invoice'::character varying | - |
| collection_date | date | YES | - | - |
| quota_contribution | numeric | YES | 0 | - |
| performance_period | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.commission_structures

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| structure_name | character varying | NO | - | - |
| structure_type | character varying | NO | - | - |
| applies_to | character varying | NO | - | - |
| role_types | jsonb | YES | - | - |
| product_categories | jsonb | YES | - | - |
| base_rate | numeric | YES | 0 | - |
| tier_definitions | jsonb | YES | - | - |
| calculation_basis | character varying | YES | 'revenue'::character varying | - |
| minimum_threshold | numeric | YES | 0 | - |
| maximum_cap | numeric | YES | - | - |
| calculation_period | character varying | YES | 'monthly'::character varying | - |
| payment_delay_days | integer | YES | 30 | - |
| performance_multipliers | jsonb | YES | - | - |
| team_performance_factor | numeric | YES | 1.0 | - |
| is_active | boolean | YES | true | - |
| effective_date | date | NO | - | - |
| expiration_date | date | YES | - | - |
| created_by | character varying | NO | - | - |
| approved_by | character varying | YES | - | - |
| approval_date | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| tier_thresholds | jsonb | YES | - | - |
| tier_rates | jsonb | YES | - | - |
| volume_bonuses | jsonb | YES | - | - |
| quota_bonuses | jsonb | YES | - | - |
| special_incentives | jsonb | YES | - | - |
| requires_payment_received | boolean | YES | true | - |
| clawback_period_days | integer | YES | 90 | - |
| split_rules | jsonb | YES | - | - |
| minimum_payout_amount | numeric | YES | 0 | - |
| payment_schedule | character varying | YES | 'monthly'::character varying | - |

### public.commission_transactions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| transaction_type | character varying | NO | - | - |
| reference_number | character varying | YES | - | - |
| sales_rep_id | character varying | NO | - | - |
| sales_rep_name | character varying | NO | - | - |
| customer_id | character varying | YES | - | - |
| customer_name | character varying | YES | - | - |
| deal_id | character varying | YES | - | - |
| sale_amount | numeric | NO | - | - |
| commission_rate | numeric | NO | - | - |
| commission_amount | numeric | NO | - | - |
| product_category | character varying | YES | - | - |
| product_details | jsonb | YES | - | - |
| commission_structure_id | character varying | YES | - | - |
| commission_structure_name | character varying | YES | - | - |
| calculation_method | character varying | YES | - | - |
| sale_date | date | NO | - | - |
| commission_period | character varying | NO | - | - |
| commission_status | character varying | YES | 'pending'::character varying | - |
| payment_status | character varying | YES | 'unpaid'::character varying | - |
| requires_approval | boolean | YES | false | - |
| approved_by | character varying | YES | - | - |
| approved_at | timestamp without time zone | YES | - | - |
| approval_notes | text | YES | - | - |
| payment_date | date | YES | - | - |
| payment_amount | numeric | YES | - | - |
| payment_method | character varying | YES | - | - |
| payment_reference | character varying | YES | - | - |
| is_clawback_eligible | boolean | YES | true | - |
| clawback_expiry_date | date | YES | - | - |
| clawed_back_amount | numeric | YES | 0 | - |
| clawback_reason | text | YES | - | - |
| adjustment_reason | text | YES | - | - |
| original_transaction_id | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.companies

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| business_name | character varying(255) | NO | - | - |
| parent_company | character varying(255) | YES | - | - |
| business_type | character varying(100) | YES | - | - |
| industry | character varying(100) | YES | - | - |
| website | character varying(255) | YES | - | - |
| phone | character varying(50) | YES | - | - |
| email | character varying(255) | YES | - | - |
| business_address | text | YES | - | - |
| billing_address | text | YES | - | - |
| shipping_address | text | YES | - | - |
| notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| business_record_type | character varying(255) | YES | 'Customer'::character varying | - |
| customer_number | character varying(255) | YES | - | - |
| business_site | character varying(255) | YES | - | - |
| parent_business | character varying(255) | YES | - | - |
| activity | character varying(255) | YES | - | - |
| description | text | YES | - | - |
| fax | character varying(255) | YES | - | - |
| next_call_back | timestamp without time zone | YES | - | - |
| billing_city | character varying(255) | YES | - | - |
| billing_state | character varying(255) | YES | - | - |
| billing_zip | character varying(255) | YES | - | - |
| shipping_city | character varying(255) | YES | - | - |
| shipping_state | character varying(255) | YES | - | - |
| shipping_zip | character varying(255) | YES | - | - |
| customer_since | timestamp without time zone | YES | - | - |
| employees | integer | YES | - | - |
| annual_revenue | numeric | YES | - | - |
| number_of_locations | integer | YES | - | - |
| sic_code | character varying(255) | YES | - | - |
| product_services_interest | text | YES | - | - |
| number_of_steps_rights | integer | YES | - | - |
| special_delivery_instructions | text | YES | - | - |
| tax_state | character varying(255) | YES | - | - |
| elevator | character varying(255) | YES | - | - |
| created_by | character varying(255) | YES | - | - |
| business_owner | character varying(255) | YES | - | - |
| last_modified_by | character varying(255) | YES | - | - |

### public.company_contacts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| company_id | uuid | NO | - | - |
| first_name | character varying(100) | NO | - | - |
| last_name | character varying(100) | NO | - | - |
| title | character varying(100) | YES | - | - |
| email | character varying(255) | YES | - | - |
| phone | character varying(50) | YES | - | - |
| mobile | character varying(50) | YES | - | - |
| is_primary | boolean | YES | false | - |
| notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| salutation | character varying(50) | YES | - | - |
| department | character varying(100) | YES | - | - |
| reports_to | character varying(255) | YES | - | - |
| contact_roles | text | YES | - | - |
| is_primary_contact | boolean | YES | false | - |
| assistant | character varying(255) | YES | - | - |
| assistant_phone | character varying(50) | YES | - | - |
| other_phone | character varying(50) | YES | - | - |
| home_phone | character varying(50) | YES | - | - |
| fax | character varying(50) | YES | - | - |
| birthdate | timestamp without time zone | YES | - | - |
| mailing_address | text | YES | - | - |
| mailing_city | character varying(100) | YES | - | - |
| mailing_state | character varying(50) | YES | - | - |
| mailing_zip | character varying(20) | YES | - | - |
| other_address | text | YES | - | - |
| other_city | character varying(100) | YES | - | - |
| other_state | character varying(50) | YES | - | - |
| other_zip | character varying(20) | YES | - | - |
| lead_status | character varying | YES | 'new'::character varying | - |
| last_contact_date | timestamp without time zone | YES | - | - |
| next_follow_up_date | timestamp without time zone | YES | - | - |
| owner_id | character varying | YES | - | - |
| favorite_content_type | character varying | YES | - | - |
| preferred_channels | text | YES | - | - |

### public.company_pricing_settings

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| default_markup_percentage | numeric | NO | 20.00 | - |
| allow_salesperson_override | boolean | YES | true | - |
| minimum_gross_profit_percentage | numeric | YES | 5.00 | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.contracts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| contract_number | character varying | NO | - | - |
| start_date | timestamp without time zone | NO | - | - |
| end_date | timestamp without time zone | NO | - | - |
| black_rate | numeric | YES | - | - |
| color_rate | numeric | YES | - | - |
| monthly_base | numeric | YES | - | - |
| status | character varying | NO | 'active'::character varying | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.cpc_rates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| model_id | uuid | NO | - | - |
| color_type | character varying | NO | - | - |
| volume_tier | character varying | NO | - | - |
| rate | numeric | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.customer_activities

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| activity_type | character varying | NO | - | - |
| subject | character varying | NO | - | - |
| description | text | YES | - | - |
| direction | character varying | YES | - | - |
| email_from | character varying | YES | - | - |
| email_to | text | YES | - | - |
| email_cc | text | YES | - | - |
| email_subject | character varying | YES | - | - |
| email_body | text | YES | - | - |
| is_shared | boolean | YES | false | - |
| call_duration | integer | YES | - | - |
| call_outcome | character varying | YES | - | - |
| scheduled_date | timestamp without time zone | YES | - | - |
| completed_date | timestamp without time zone | YES | - | - |
| due_date | timestamp without time zone | YES | - | - |
| outcome | character varying | YES | - | - |
| next_action | text | YES | - | - |
| follow_up_date | timestamp without time zone | YES | - | - |
| related_records | jsonb | YES | - | - |
| attachments | jsonb | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.customer_contacts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| first_name | character varying | NO | - | - |
| last_name | character varying | NO | - | - |
| title | character varying | YES | - | - |
| department | character varying | YES | - | - |
| phone | character varying | YES | - | - |
| email | character varying | YES | - | - |
| is_primary | boolean | YES | false | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.customer_equipment

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| business_record_id | character varying | NO | - | - |
| equipment_name | character varying | NO | - | - |
| make | character varying | YES | - | - |
| model | character varying | YES | - | - |
| serial_number | character varying | YES | - | - |
| asset_tag | character varying | YES | - | - |
| location | character varying | YES | - | - |
| department | character varying | YES | - | - |
| installed_date | timestamp without time zone | YES | - | - |
| service_contract_type | character varying | YES | - | - |
| contract_start_date | timestamp without time zone | YES | - | - |
| contract_end_date | timestamp without time zone | YES | - | - |
| service_level | character varying | YES | - | - |
| current_meter_reading | integer | YES | - | - |
| last_service_date | timestamp without time zone | YES | - | - |
| next_service_due | timestamp without time zone | YES | - | - |
| status | character varying | YES | 'active'::character varying | - |
| specifications | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.customer_interactions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | YES | - | - |
| lead_id | character varying | YES | - | - |
| interaction_type | character varying | NO | - | - |
| subject | character varying | NO | - | - |
| description | text | YES | - | - |
| outcome | character varying | YES | - | - |
| next_action | text | YES | - | - |
| scheduled_date | timestamp without time zone | YES | - | - |
| completed_date | timestamp without time zone | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.customer_meter_submissions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| customer_id | uuid | NO | - | - |
| customer_portal_user_id | uuid | NO | - | - |
| equipment_id | uuid | NO | - | - |
| equipment_serial_number | character varying(100) | NO | - | - |
| total_impressions | integer | YES | - | - |
| black_white_impressions | integer | YES | - | - |
| color_impressions | integer | YES | - | - |
| large_format_impressions | integer | YES | - | - |
| scan_impressions | integer | YES | - | - |
| fax_impressions | integer | YES | - | - |
| submission_method | USER-DEFINED | NO | - | - |
| reading_date | timestamp without time zone | NO | - | - |
| submission_date | timestamp without time zone | NO | now() | - |
| photo_urls | jsonb | NO | '[]'::jsonb | - |
| is_validated | boolean | NO | false | - |
| validated_by | uuid | YES | - | - |
| validated_at | timestamp without time zone | YES | - | - |
| validation_notes | text | YES | - | - |
| is_billed | boolean | NO | false | - |
| billing_date | timestamp without time zone | YES | - | - |
| invoice_id | uuid | YES | - | - |
| customer_notes | text | YES | - | - |
| internal_notes | text | YES | - | - |

### public.customer_notifications

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| customer_id | uuid | NO | - | - |
| customer_portal_user_id | uuid | YES | - | - |
| type | USER-DEFINED | NO | - | - |
| title | character varying(255) | NO | - | - |
| message | text | NO | - | - |
| is_email_sent | boolean | NO | false | - |
| email_sent_at | timestamp without time zone | YES | - | - |
| is_sms_capable | boolean | NO | false | - |
| is_sms_sent | boolean | NO | false | - |
| sms_sent_at | timestamp without time zone | YES | - | - |
| is_portal_read | boolean | NO | false | - |
| portal_read_at | timestamp without time zone | YES | - | - |
| related_service_request_id | uuid | YES | - | - |
| related_invoice_id | uuid | YES | - | - |
| related_payment_id | uuid | YES | - | - |
| related_supply_order_id | uuid | YES | - | - |
| priority | character varying(20) | NO | 'normal'::character varying | - |
| scheduled_send_at | timestamp without time zone | YES | - | - |
| expires_at | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | NO | now() | - |
| sent_at | timestamp without time zone | YES | - | - |

### public.customer_number_config

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| prefix | character varying(10) | NO | 'CUST'::character varying | - |
| current_sequence | integer | NO | 1000 | - |
| sequence_length | integer | NO | 4 | - |
| separator_char | character varying(1) | YES | '-'::character varying | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.customer_number_history

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| customer_number | character varying | NO | - | - |
| config_id | character varying | NO | - | - |
| generated_at | timestamp without time zone | YES | now() | - |
| generated_by | character varying | YES | - | - |

### public.customer_payments

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| customer_id | uuid | NO | - | - |
| customer_portal_user_id | uuid | YES | - | - |
| payment_number | character varying(50) | NO | - | - |
| amount | numeric | NO | - | - |
| payment_method | USER-DEFINED | NO | - | - |
| status | USER-DEFINED | NO | 'pending'::payment_status | - |
| invoice_id | uuid | YES | - | - |
| invoice_number | character varying(100) | YES | - | - |
| transaction_id | character varying(255) | YES | - | - |
| processor_name | character varying(100) | YES | - | - |
| processor_response | jsonb | YES | - | - |
| payment_method_details | jsonb | YES | - | - |
| payment_date | timestamp without time zone | NO | now() | - |
| processed_at | timestamp without time zone | YES | - | - |
| customer_notes | text | YES | - | - |
| internal_notes | text | YES | - | - |
| failure_reason | text | YES | - | - |
| retry_count | integer | NO | 0 | - |
| next_retry_at | timestamp without time zone | YES | - | - |

### public.customer_portal_access

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| customer_id | uuid | NO | - | - |
| username | character varying(100) | NO | - | - |
| password_hash | character varying(255) | NO | - | - |
| email | character varying(255) | NO | - | - |
| status | USER-DEFINED | NO | 'pending_activation'::customer_portal_status | - |
| is_email_verified | boolean | NO | false | - |
| email_verification_token | character varying(255) | YES | - | - |
| password_reset_token | character varying(255) | YES | - | - |
| password_reset_expires | timestamp without time zone | YES | - | - |
| last_login_at | timestamp without time zone | YES | - | - |
| session_token | character varying(255) | YES | - | - |
| session_expires | timestamp without time zone | YES | - | - |
| permissions | jsonb | NO | '{"canMakePayments": true, "canViewInvoices": true, "canOrderSupplies": true, "canViewServiceHistory": true, "canSubmitMeterReadings": true, "canSubmitServiceRequests": true}'::jsonb | - |
| preferences | jsonb | NO | '{"language": "en", "timezone": "America/New_York", "smsNotifications": false, "emailNotifications": true}'::jsonb | - |
| created_at | timestamp without time zone | NO | now() | - |
| updated_at | timestamp without time zone | NO | now() | - |
| created_by | uuid | YES | - | - |

### public.customer_portal_activity_log

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| customer_id | uuid | NO | - | - |
| customer_portal_user_id | uuid | YES | - | - |
| action | character varying(100) | NO | - | - |
| description | text | YES | - | - |
| ip_address | character varying(45) | YES | - | - |
| user_agent | text | YES | - | - |
| related_record_type | character varying(50) | YES | - | - |
| related_record_id | uuid | YES | - | - |
| timestamp | timestamp without time zone | NO | now() | - |

### public.customer_related_records

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| record_type | character varying | NO | - | - |
| record_id | character varying | NO | - | - |
| record_title | character varying | YES | - | - |
| record_count | integer | YES | 1 | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.customer_service_requests

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| customer_id | uuid | NO | - | - |
| customer_portal_user_id | uuid | NO | - | - |
| request_number | character varying(50) | NO | - | - |
| title | character varying(255) | NO | - | - |
| description | text | NO | - | - |
| type | USER-DEFINED | NO | - | - |
| priority | USER-DEFINED | NO | 'normal'::service_request_priority | - |
| status | USER-DEFINED | NO | 'submitted'::service_request_status | - |
| equipment_id | uuid | YES | - | - |
| equipment_serial_number | character varying(100) | YES | - | - |
| equipment_model | character varying(100) | YES | - | - |
| equipment_location | character varying(255) | YES | - | - |
| contact_name | character varying(100) | NO | - | - |
| contact_phone | character varying(20) | YES | - | - |
| contact_email | character varying(255) | YES | - | - |
| preferred_date | timestamp without time zone | YES | - | - |
| preferred_time | character varying(50) | YES | - | - |
| urgency_notes | text | YES | - | - |
| assigned_technician_id | uuid | YES | - | - |
| service_ticket_id | uuid | YES | - | - |
| estimated_completion_date | timestamp without time zone | YES | - | - |
| actual_completion_date | timestamp without time zone | YES | - | - |
| customer_notes | text | YES | - | - |
| internal_notes | text | YES | - | - |
| resolution_notes | text | YES | - | - |
| attachments | jsonb | NO | '[]'::jsonb | - |
| customer_rating | integer | YES | - | - |
| customer_feedback | text | YES | - | - |
| submitted_at | timestamp without time zone | NO | now() | - |
| acknowledged_at | timestamp without time zone | YES | - | - |
| completed_at | timestamp without time zone | YES | - | - |
| updated_at | timestamp without time zone | NO | now() | - |

### public.customer_supply_order_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| order_id | uuid | NO | - | - |
| product_id | uuid | NO | - | - |
| product_sku | character varying(100) | NO | - | - |
| product_name | character varying(255) | NO | - | - |
| product_description | text | YES | - | - |
| compatible_equipment_id | uuid | YES | - | - |
| quantity | integer | NO | - | - |
| unit_price | numeric | NO | - | - |
| total_price | numeric | NO | - | - |
| in_stock | boolean | NO | true | - |
| estimated_ship_date | timestamp without time zone | YES | - | - |
| customer_notes | text | YES | - | - |

### public.customer_supply_orders

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| customer_id | uuid | NO | - | - |
| customer_portal_user_id | uuid | NO | - | - |
| order_number | character varying(50) | NO | - | - |
| status | USER-DEFINED | NO | 'draft'::supply_order_status | - |
| delivery_address | jsonb | NO | - | - |
| delivery_instructions | text | YES | - | - |
| requested_delivery_date | timestamp without time zone | YES | - | - |
| actual_delivery_date | timestamp without time zone | YES | - | - |
| subtotal | numeric | NO | 0.00 | - |
| tax | numeric | NO | 0.00 | - |
| shipping | numeric | NO | 0.00 | - |
| total | numeric | NO | 0.00 | - |
| is_contract_covered | boolean | NO | false | - |
| contract_id | uuid | YES | - | - |
| purchase_order_number | character varying(100) | YES | - | - |
| tracking_number | character varying(100) | YES | - | - |
| carrier | character varying(50) | YES | - | - |
| shipped_at | timestamp without time zone | YES | - | - |
| customer_notes | text | YES | - | - |
| internal_notes | text | YES | - | - |
| created_at | timestamp without time zone | NO | now() | - |
| submitted_at | timestamp without time zone | YES | - | - |
| updated_at | timestamp without time zone | NO | now() | - |

### public.customers

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| company_id | uuid | NO | - | - |
| contact_id | uuid | NO | - | - |
| lead_source | character varying | NO | 'website'::character varying | - |
| lead_status | character varying | NO | 'customer'::character varying | - |
| estimated_amount | numeric | YES | - | - |
| probability | integer | YES | 100 | - |
| close_date | timestamp without time zone | YES | - | - |
| owner_id | character varying | YES | - | - |
| lead_score | integer | YES | 0 | - |
| priority | character varying | YES | 'medium'::character varying | - |
| notes | text | YES | - | - |
| last_contact_date | timestamp without time zone | YES | - | - |
| next_follow_up_date | timestamp without time zone | YES | - | - |
| created_by | character varying | NO | - | - |
| preferred_technician | character varying | YES | - | - |
| last_service_date | timestamp without time zone | YES | - | - |
| next_scheduled_service | timestamp without time zone | YES | - | - |
| last_invoice_date | timestamp without time zone | YES | - | - |
| last_payment_date | timestamp without time zone | YES | - | - |
| current_balance | numeric | YES | 0 | - |
| last_meter_reading_date | timestamp without time zone | YES | - | - |
| next_meter_reading_date | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| external_salesforce_id | character varying(255) | YES | - | - |
| last_salesforce_sync | timestamp without time zone | YES | - | - |

### public.deal_activities

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| deal_id | character varying | NO | - | - |
| user_id | character varying | NO | - | - |
| activity_type | character varying | NO | 'stage_change'::character varying | - |
| title | character varying | YES | - | - |
| description | text | YES | - | - |
| activity_date | timestamp without time zone | YES | now() | - |
| created_at | timestamp without time zone | YES | now() | - |
| type | character varying | YES | - | - |
| subject | character varying | YES | - | - |
| duration | integer | YES | - | - |
| outcome | character varying | YES | - | - |
| previous_value | text | YES | - | - |
| new_value | text | YES | - | - |

### public.deal_stages

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| name | character varying | NO | - | - |
| description | text | YES | - | - |
| color | character varying | NO | - | - |
| sort_order | integer | NO | - | - |
| is_active | boolean | NO | true | - |
| is_closing_stage | boolean | NO | false | - |
| is_won_stage | boolean | NO | false | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| requires_approval | boolean | YES | false | - |
| auto_move_conditions | jsonb | YES | - | - |

### public.deals

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| title | character varying | NO | - | - |
| description | text | YES | - | - |
| amount | numeric | YES | - | - |
| company_name | character varying | YES | - | - |
| primary_contact_name | character varying | YES | - | - |
| primary_contact_email | character varying | YES | - | - |
| primary_contact_phone | character varying | YES | - | - |
| source | character varying | YES | - | - |
| deal_type | character varying | YES | - | - |
| priority | character varying | NO | 'medium'::character varying | - |
| expected_close_date | timestamp without time zone | YES | - | - |
| products_interested | text | YES | - | - |
| estimated_monthly_value | numeric | YES | - | - |
| notes | text | YES | - | - |
| status | character varying | NO | 'open'::character varying | - |
| probability | integer | YES | 0 | - |
| stage_id | character varying | NO | - | - |
| owner_id | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| customer_id | character varying | YES | - | - |
| lost_reason | character varying | YES | - | - |
| last_activity_date | timestamp without time zone | YES | - | - |
| next_follow_up_date | timestamp without time zone | YES | - | - |
| created_by_id | character varying | YES | - | - |
| actual_close_date | timestamp without time zone | YES | - | - |

### public.device_metrics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| device_id | uuid | NO | - | - |
| tenant_id | uuid | NO | - | - |
| metric_type | character varying(50) | NO | - | - |
| metric_value | integer | NO | - | - |
| collected_at | timestamp without time zone | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.device_performance_trends

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| device_id | character varying | NO | - | - |
| analysis_period_start | date | NO | - | - |
| analysis_period_end | date | NO | - | - |
| analysis_type | character varying | NO | - | - |
| average_uptime_percentage | numeric | YES | - | - |
| total_pages_processed | integer | YES | - | - |
| average_processing_speed | numeric | YES | - | - |
| error_rate | numeric | YES | - | - |
| jam_rate | numeric | YES | - | - |
| peak_usage_hours | jsonb | YES | - | - |
| usage_pattern_type | character varying | YES | - | - |
| workload_distribution | jsonb | YES | - | - |
| energy_consumption | numeric | YES | - | - |
| supply_consumption_rate | numeric | YES | - | - |
| maintenance_frequency | numeric | YES | - | - |
| performance_trend | character varying | YES | - | - |
| trend_slope | numeric | YES | - | - |
| seasonality_detected | boolean | YES | false | - |
| anomaly_count | integer | YES | 0 | - |
| reliability_score | numeric | YES | - | - |
| maintenance_prediction_accuracy | numeric | YES | - | - |
| failure_risk_score | numeric | YES | - | - |
| peer_performance_percentile | numeric | YES | - | - |
| industry_benchmark_comparison | numeric | YES | - | - |
| optimization_recommendations | jsonb | YES | - | - |
| maintenance_recommendations | jsonb | YES | - | - |
| upgrade_recommendations | jsonb | YES | - | - |
| data_points_analyzed | integer | YES | - | - |
| confidence_interval | numeric | YES | - | - |
| statistical_significance | numeric | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.device_registrations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| integration_id | uuid | NO | - | - |
| tenant_id | uuid | NO | - | - |
| device_name | character varying(100) | NO | - | - |
| model | character varying(100) | NO | - | - |
| serial_number | character varying(100) | NO | - | - |
| device_id | character varying(100) | YES | - | - |
| status | character varying(20) | NO | 'active'::character varying | - |
| location | character varying(100) | YES | - | - |
| installation_date | date | YES | - | - |
| last_seen | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.device_telemetry

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| device_id | character varying | NO | - | - |
| recorded_at | timestamp without time zone | NO | - | - |
| data_type | character varying | NO | - | - |
| metric_name | character varying | NO | - | - |
| metric_value | numeric | YES | - | - |
| metric_unit | character varying | YES | - | - |
| string_value | text | YES | - | - |
| boolean_value | boolean | YES | - | - |
| event_source | character varying | YES | - | - |
| event_category | character varying | YES | - | - |
| severity_level | character varying | YES | 'info'::character varying | - |
| raw_data | jsonb | YES | - | - |
| processed_data | jsonb | YES | - | - |
| data_quality_score | numeric | YES | 1.0 | - |
| validation_status | character varying | YES | 'valid'::character varying | - |
| validation_notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.documents

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| document_number | character varying | NO | - | - |
| document_type | character varying | NO | - | - |
| agreement_number | character varying | YES | - | - |
| buyer_name | character varying | YES | - | - |
| buyer_address | text | YES | - | - |
| ship_to_name | character varying | YES | - | - |
| ship_to_address | text | YES | - | - |
| po_number | character varying | YES | - | - |
| order_date | timestamp without time zone | YES | - | - |
| line_items | jsonb | YES | - | - |
| include_service_contract | boolean | YES | false | - |
| service_term | integer | YES | - | - |
| service_start_date | timestamp without time zone | YES | - | - |
| auto_renewal | boolean | YES | false | - |
| minimum_black_prints | integer | YES | - | - |
| minimum_color_prints | integer | YES | - | - |
| black_rate | numeric | YES | - | - |
| color_rate | numeric | YES | - | - |
| monthly_base | numeric | YES | - | - |
| include_consumables | boolean | YES | false | - |
| include_black_supplies | boolean | YES | false | - |
| include_color_supplies | boolean | YES | false | - |
| payment_terms | character varying | YES | - | - |
| warranty_terms | text | YES | - | - |
| special_terms | text | YES | - | - |
| authorized_signer_title | character varying | YES | - | - |
| customer_name | character varying | YES | - | - |
| status | character varying | YES | 'draft'::character varying | - |
| created_by | character varying | NO | - | - |
| updated_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.enabled_products

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| enabled_product_id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| master_product_id | uuid | YES | - | - |
| source | character varying(50) | NO | 'master_catalog'::character varying | - |
| enabled | boolean | YES | true | - |
| custom_sku | character varying(100) | YES | - | - |
| custom_name | character varying(255) | YES | - | - |
| dealer_cost | numeric | YES | - | - |
| company_price | numeric | YES | - | - |
| markup_rule_id | uuid | YES | - | - |
| price_overridden | boolean | YES | false | - |
| enabled_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.enhanced_roles

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying(255) | NO | - | - |
| tenant_id | character varying(255) | NO | - | - |
| organizational_unit_id | character varying(255) | YES | - | - |
| name | character varying(255) | NO | - | - |
| code | character varying(100) | NO | - | - |
| description | text | YES | - | - |
| hierarchy_level | character varying(50) | NO | - | - |
| department | character varying(100) | NO | 'general'::character varying | - |
| organizational_tier | character varying(50) | NO | 'COMPANY'::character varying | - |
| is_customizable | boolean | NO | true | - |
| is_system_role | boolean | NO | false | - |
| is_active | boolean | NO | true | - |
| max_assignments | integer | YES | - | - |
| assignment_rules | jsonb | YES | '{}'::jsonb | - |
| metadata | jsonb | YES | '{}'::jsonb | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.enriched_companies

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying(255) | NO | - | - |
| company_name | character varying(255) | NO | - | - |
| primary_industry | character varying(255) | YES | - | - |
| secondary_industries | ARRAY | YES | - | - |
| employee_count | integer | YES | - | - |
| annual_revenue | bigint | YES | - | - |
| company_stage | character varying(100) | YES | - | - |
| headquarters_country | character varying(100) | YES | - | - |
| headquarters_state | character varying(100) | YES | - | - |
| headquarters_city | character varying(100) | YES | - | - |
| website | character varying(500) | YES | - | - |
| company_linkedin_url | character varying(500) | YES | - | - |
| technology_stack | ARRAY | YES | - | - |
| target_account_tier | character varying(50) | YES | - | - |
| lead_score | integer | YES | 0 | - |
| enrichment_source | character varying(50) | NO | - | - |
| source_company_id | character varying(255) | YES | - | - |
| last_enriched_date | timestamp without time zone | YES | now() | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.enriched_contacts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying(255) | NO | - | - |
| first_name | character varying(255) | YES | - | - |
| last_name | character varying(255) | YES | - | - |
| full_name | character varying(255) | YES | - | - |
| email | character varying(255) | YES | - | - |
| phone | character varying(50) | YES | - | - |
| job_title | character varying(255) | YES | - | - |
| job_function | character varying(255) | YES | - | - |
| management_level | character varying(100) | YES | - | - |
| department | character varying(255) | YES | - | - |
| seniority | character varying(100) | YES | - | - |
| company_name | character varying(255) | YES | - | - |
| company_linkedin_url | character varying(500) | YES | - | - |
| person_linkedin_url | character varying(500) | YES | - | - |
| twitter_username | character varying(100) | YES | - | - |
| github_username | character varying(100) | YES | - | - |
| facebook_url | character varying(500) | YES | - | - |
| lead_score | integer | YES | 0 | - |
| prospecting_status | character varying(50) | YES | 'new'::character varying | - |
| last_contact_date | timestamp without time zone | YES | - | - |
| next_follow_up_date | timestamp without time zone | YES | - | - |
| enrichment_source | character varying(50) | NO | - | - |
| source_person_id | character varying(255) | YES | - | - |
| last_enriched_date | timestamp without time zone | YES | now() | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.equipment

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| serial_number | character varying | NO | - | - |
| model | character varying | NO | - | - |
| manufacturer | character varying | NO | - | - |
| location | character varying | YES | - | - |
| install_date | timestamp without time zone | YES | - | - |
| black_meter | integer | YES | 0 | - |
| color_meter | integer | YES | 0 | - |
| last_meter_reading | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.equipment_asset_tracking

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| asset_tag | character varying | NO | - | - |
| equipment_id | character varying | NO | - | - |
| serial_number | character varying | NO | - | - |
| brand | character varying | NO | - | - |
| model | character varying | NO | - | - |
| equipment_type | character varying | NO | - | - |
| current_status | character varying | YES | 'active'::character varying | - |
| current_location_type | character varying | YES | - | - |
| current_location_details | text | YES | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| contract_id | character varying | YES | - | - |
| purchase_price | numeric | YES | - | - |
| current_book_value | numeric | YES | - | - |
| depreciation_method | character varying | YES | 'straight_line'::character varying | - |
| depreciation_rate | numeric | YES | - | - |
| last_maintenance_date | date | YES | - | - |
| next_maintenance_due | date | YES | - | - |
| maintenance_interval_days | integer | YES | 90 | - |
| current_bw_count | integer | YES | 0 | - |
| current_color_count | integer | YES | 0 | - |
| last_meter_reading_date | date | YES | - | - |
| warranty_start_date | date | YES | - | - |
| warranty_end_date | date | YES | - | - |
| warranty_type | character varying | YES | - | - |
| support_contract_id | character varying | YES | - | - |
| installation_date | date | YES | - | - |
| activation_date | date | YES | - | - |
| retirement_date | date | YES | - | - |
| disposal_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.equipment_delivery_schedules

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| delivery_id | character varying | NO | - | - |
| purchase_order_id | character varying | YES | - | - |
| scheduled_date | date | NO | - | - |
| time_window_start | time without time zone | YES | - | - |
| time_window_end | time without time zone | YES | - | - |
| delivery_type | character varying | YES | 'standard'::character varying | - |
| delivery_address | text | NO | - | - |
| contact_person | character varying | NO | - | - |
| contact_phone | character varying | NO | - | - |
| contact_email | character varying | YES | - | - |
| status | character varying | YES | 'scheduled'::character varying | - |
| driver_name | character varying | YES | - | - |
| driver_phone | character varying | YES | - | - |
| vehicle_info | character varying | YES | - | - |
| departure_time | timestamp without time zone | YES | - | - |
| arrival_time | timestamp without time zone | YES | - | - |
| completion_time | timestamp without time zone | YES | - | - |
| delivery_notes | text | YES | - | - |
| customer_signature | character varying | YES | - | - |
| delivery_photo_urls | jsonb | YES | - | - |
| condition_on_delivery | character varying | YES | 'good'::character varying | - |
| special_equipment_required | boolean | YES | false | - |
| access_requirements | text | YES | - | - |
| delivery_instructions | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.equipment_installations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| equipment_id | character varying | NO | - | - |
| delivery_id | character varying | YES | - | - |
| scheduled_date | date | NO | - | - |
| scheduled_time_start | time without time zone | YES | - | - |
| scheduled_time_end | time without time zone | YES | - | - |
| installation_location | text | NO | - | - |
| site_contact_person | character varying | YES | - | - |
| site_contact_phone | character varying | YES | - | - |
| power_requirements | character varying | YES | - | - |
| network_requirements | character varying | YES | - | - |
| space_requirements | character varying | YES | - | - |
| environmental_conditions | text | YES | - | - |
| lead_technician_id | character varying | NO | - | - |
| assistant_technicians | jsonb | YES | - | - |
| estimated_duration_hours | numeric | YES | 2.0 | - |
| status | character varying | YES | 'scheduled'::character varying | - |
| actual_start_time | timestamp without time zone | YES | - | - |
| actual_end_time | timestamp without time zone | YES | - | - |
| installation_notes | text | YES | - | - |
| configuration_settings | jsonb | YES | - | - |
| network_settings | jsonb | YES | - | - |
| functionality_tests | jsonb | YES | - | - |
| print_test_completed | boolean | YES | false | - |
| network_test_completed | boolean | YES | false | - |
| user_training_completed | boolean | YES | false | - |
| installation_photos | jsonb | YES | - | - |
| user_manual_provided | boolean | YES | false | - |
| warranty_registration_completed | boolean | YES | false | - |
| customer_signature | character varying | YES | - | - |
| customer_satisfaction_rating | integer | YES | - | - |
| customer_feedback | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.equipment_lifecycle_stages

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| equipment_id | character varying | NO | - | - |
| equipment_serial_number | character varying | YES | - | - |
| equipment_model | character varying | YES | - | - |
| equipment_brand | character varying | YES | - | - |
| current_stage | character varying | NO | - | - |
| stage_status | character varying | YES | 'in_progress'::character varying | - |
| stage_started_at | timestamp without time zone | YES | now() | - |
| stage_completed_at | timestamp without time zone | YES | - | - |
| estimated_completion_date | date | YES | - | - |
| actual_completion_date | date | YES | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| delivery_address | text | YES | - | - |
| installation_location | text | YES | - | - |
| contact_person | character varying | YES | - | - |
| contact_phone | character varying | YES | - | - |
| purchase_order_number | character varying | YES | - | - |
| vendor_id | character varying | YES | - | - |
| warehouse_location | character varying | YES | - | - |
| delivery_tracking_number | character varying | YES | - | - |
| installation_technician_id | character varying | YES | - | - |
| installation_notes | text | YES | - | - |
| progress_percentage | integer | YES | 0 | - |
| last_activity_date | date | YES | CURRENT_DATE | - |
| next_action_required | character varying | YES | - | - |
| assigned_to | character varying | YES | - | - |
| required_documents | jsonb | YES | - | - |
| completed_documents | jsonb | YES | - | - |
| compliance_checklist | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.equipment_packages

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| package_name | character varying | NO | - | - |
| package_code | character varying | YES | - | - |
| category | character varying | YES | - | - |
| description | text | YES | - | - |
| equipment | jsonb | YES | - | - |
| accessories | jsonb | YES | - | - |
| services | jsonb | YES | - | - |
| total_value | numeric | YES | - | - |
| discount_percentage | numeric | YES | - | - |
| margin_percentage | numeric | YES | - | - |
| is_active | boolean | YES | true | - |
| allow_customization | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.equipment_purchase_orders

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| po_number | character varying | NO | - | - |
| vendor_id | character varying | YES | - | - |
| vendor_name | character varying | YES | - | - |
| order_date | date | NO | - | - |
| requested_delivery_date | date | YES | - | - |
| confirmed_delivery_date | date | YES | - | - |
| subtotal | numeric | YES | 0 | - |
| tax_amount | numeric | YES | 0 | - |
| shipping_cost | numeric | YES | 0 | - |
| total_amount | numeric | YES | 0 | - |
| status | character varying | YES | 'draft'::character varying | - |
| tracking_number | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| delivery_address | text | YES | - | - |
| special_instructions | text | YES | - | - |
| requested_by | character varying | NO | - | - |
| approved_by | character varying | YES | - | - |
| approval_date | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.equipment_status_monitoring

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| equipment_id | character varying | NO | - | - |
| device_id | character varying | NO | - | - |
| status_timestamp | timestamp without time zone | NO | - | - |
| operational_status | character varying | NO | - | - |
| power_status | character varying | YES | - | - |
| connectivity_status | character varying | YES | - | - |
| current_job_count | integer | YES | 0 | - |
| total_page_count | integer | YES | 0 | - |
| error_count | integer | YES | 0 | - |
| toner_levels | jsonb | YES | - | - |
| paper_levels | jsonb | YES | - | - |
| temperature | numeric | YES | - | - |
| humidity | numeric | YES | - | - |
| ambient_light | integer | YES | - | - |
| pages_printed_today | integer | YES | 0 | - |
| pages_printed_month | integer | YES | 0 | - |
| average_job_size | numeric | YES | - | - |
| peak_usage_time | time without time zone | YES | - | - |
| drum_life_remaining | integer | YES | - | - |
| fuser_life_remaining | integer | YES | - | - |
| transfer_belt_remaining | integer | YES | - | - |
| waste_toner_level | integer | YES | - | - |
| print_speed_current | numeric | YES | - | - |
| print_quality_score | numeric | YES | - | - |
| jam_frequency | numeric | YES | - | - |
| uptime_percentage | numeric | YES | - | - |
| active_alerts | jsonb | YES | - | - |
| alert_count | integer | YES | 0 | - |
| critical_alerts | integer | YES | 0 | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.field_technicians

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| employee_id | character varying | NO | - | - |
| user_id | character varying | YES | - | - |
| technician_name | character varying | NO | - | - |
| technician_email | character varying | YES | - | - |
| technician_phone | character varying | YES | - | - |
| device_id | character varying | YES | - | - |
| device_type | character varying | YES | - | - |
| device_model | character varying | YES | - | - |
| app_version | character varying | YES | - | - |
| last_sync_timestamp | timestamp without time zone | YES | - | - |
| assigned_territory | jsonb | YES | - | - |
| home_base_location | jsonb | YES | - | - |
| current_location | jsonb | YES | - | - |
| location_accuracy_meters | numeric | YES | - | - |
| location_updated_at | timestamp without time zone | YES | - | - |
| skill_categories | jsonb | YES | - | - |
| certifications | jsonb | YES | - | - |
| equipment_authorizations | jsonb | YES | - | - |
| security_clearance_level | character varying | YES | - | - |
| work_schedule | jsonb | YES | - | - |
| availability_status | character varying | YES | 'available'::character varying | - |
| shift_start_time | time without time zone | YES | - | - |
| shift_end_time | time without time zone | YES | - | - |
| overtime_approved | boolean | YES | false | - |
| jobs_completed_today | integer | YES | 0 | - |
| jobs_completed_week | integer | YES | 0 | - |
| jobs_completed_month | integer | YES | 0 | - |
| average_job_duration_minutes | numeric | YES | 0 | - |
| customer_satisfaction_rating | numeric | YES | 0 | - |
| first_time_fix_rate | numeric | YES | 0 | - |
| offline_sync_enabled | boolean | YES | true | - |
| gps_tracking_enabled | boolean | YES | true | - |
| voice_notes_enabled | boolean | YES | true | - |
| photo_upload_enabled | boolean | YES | true | - |
| push_notifications_enabled | boolean | YES | true | - |
| employment_status | character varying | YES | 'active'::character varying | - |
| hire_date | date | YES | - | - |
| emergency_contact_info | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.field_work_orders

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| work_order_number | character varying | NO | - | - |
| related_service_ticket_id | character varying | YES | - | - |
| work_order_type | character varying | NO | - | - |
| priority | character varying | YES | 'medium'::character varying | - |
| customer_id | character varying | NO | - | - |
| customer_name | character varying | NO | - | - |
| service_location | jsonb | NO | - | - |
| site_contact_name | character varying | YES | - | - |
| site_contact_phone | character varying | YES | - | - |
| site_access_instructions | text | YES | - | - |
| safety_requirements | jsonb | YES | - | - |
| assigned_technician_id | character varying | YES | - | - |
| assigned_team_id | character varying | YES | - | - |
| assignment_method | character varying | YES | 'automatic'::character varying | - |
| skill_requirements | jsonb | YES | - | - |
| estimated_duration_minutes | integer | YES | - | - |
| scheduled_date | date | YES | - | - |
| scheduled_time_start | time without time zone | YES | - | - |
| scheduled_time_end | time without time zone | YES | - | - |
| time_window_flexibility_minutes | integer | YES | 30 | - |
| required_equipment | jsonb | YES | - | - |
| required_parts | jsonb | YES | - | - |
| equipment_loaded | jsonb | YES | - | - |
| parts_loaded | jsonb | YES | - | - |
| work_description | text | NO | - | - |
| special_instructions | text | YES | - | - |
| customer_notes | text | YES | - | - |
| internal_notes | text | YES | - | - |
| status | character varying | YES | 'created'::character varying | - |
| status_history | jsonb | YES | - | - |
| actual_start_time | timestamp without time zone | YES | - | - |
| actual_end_time | timestamp without time zone | YES | - | - |
| travel_time_minutes | integer | YES | - | - |
| on_site_time_minutes | integer | YES | - | - |
| total_duration_minutes | integer | YES | - | - |
| technician_arrival_location | jsonb | YES | - | - |
| technician_departure_location | jsonb | YES | - | - |
| gps_breadcrumb_trail | jsonb | YES | - | - |
| geofence_compliance | boolean | YES | true | - |
| work_performed | text | YES | - | - |
| parts_used | jsonb | YES | - | - |
| completion_photos | jsonb | YES | - | - |
| completion_signature | jsonb | YES | - | - |
| customer_satisfaction_score | integer | YES | - | - |
| quality_checklist_completed | boolean | YES | false | - |
| quality_checklist_data | jsonb | YES | - | - |
| safety_incidents | jsonb | YES | - | - |
| compliance_violations | jsonb | YES | - | - |
| follow_up_required | boolean | YES | false | - |
| follow_up_date | date | YES | - | - |
| follow_up_notes | text | YES | - | - |
| warranty_provided | jsonb | YES | - | - |
| billable_hours | numeric | YES | - | - |
| labor_cost | numeric | YES | - | - |
| parts_cost | numeric | YES | - | - |
| travel_cost | numeric | YES | - | - |
| total_cost | numeric | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.financial_forecasts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| forecast_name | character varying | NO | - | - |
| forecast_type | character varying | NO | - | - |
| forecast_period | character varying | NO | - | - |
| start_date | date | NO | - | - |
| end_date | date | NO | - | - |
| base_amount | numeric | YES | 0 | - |
| growth_rate | numeric | YES | 0 | - |
| seasonality_factor | numeric | YES | 1.0 | - |
| scenario_type | character varying | YES | 'base'::character varying | - |
| confidence_level | numeric | YES | 0.75 | - |
| calculation_method | character varying | YES | 'linear'::character varying | - |
| data_sources | jsonb | YES | - | - |
| assumptions | text | YES | - | - |
| total_forecast_amount | numeric | YES | 0 | - |
| variance_percentage | numeric | YES | 0 | - |
| status | character varying | YES | 'draft'::character varying | - |
| is_baseline | boolean | YES | false | - |
| last_calculated_at | timestamp without time zone | YES | - | - |
| created_by | character varying | NO | - | - |
| approved_by | character varying | YES | - | - |
| approved_at | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.financial_kpis

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| kpi_name | character varying | NO | - | - |
| kpi_category | character varying | NO | - | - |
| calculation_period | date | NO | - | - |
| current_value | numeric | NO | - | - |
| previous_value | numeric | YES | 0 | - |
| target_value | numeric | YES | 0 | - |
| trend_direction | character varying | YES | - | - |
| performance_vs_target | character varying | YES | - | - |
| percentage_change | numeric | YES | 0 | - |
| calculation_formula | text | YES | - | - |
| data_sources | jsonb | YES | - | - |
| warning_threshold | numeric | YES | - | - |
| critical_threshold | numeric | YES | - | - |
| alert_triggered | boolean | YES | false | - |
| industry_average | numeric | YES | - | - |
| peer_comparison | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.forecast_line_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| forecast_id | character varying | NO | - | - |
| period_date | date | NO | - | - |
| line_item_type | character varying | NO | - | - |
| category | character varying | NO | - | - |
| subcategory | character varying | YES | - | - |
| forecasted_amount | numeric | NO | - | - |
| actual_amount | numeric | YES | 0 | - |
| variance_amount | numeric | YES | 0 | - |
| variance_percentage | numeric | YES | 0 | - |
| quantity_forecast | numeric | YES | - | - |
| unit_price_forecast | numeric | YES | - | - |
| calculation_notes | text | YES | - | - |
| source_data | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.forecast_metrics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| forecast_id | character varying | NO | - | - |
| tenant_id | character varying | NO | - | - |
| snapshot_date | timestamp without time zone | NO | - | - |
| total_pipeline_value | numeric | YES | - | - |
| weighted_pipeline_value | numeric | YES | - | - |
| commit_revenue | numeric | YES | - | - |
| best_case_revenue | numeric | YES | - | - |
| worst_case_revenue | numeric | YES | - | - |
| total_deals | integer | YES | - | - |
| new_deals | integer | YES | - | - |
| advanced_deals | integer | YES | - | - |
| closed_won_deals | integer | YES | - | - |
| closed_lost_deals | integer | YES | - | - |
| conversion_rate | numeric | YES | - | - |
| average_deal_size | numeric | YES | - | - |
| average_sales_cycle | integer | YES | - | - |
| velocity_score | numeric | YES | - | - |
| stage_distribution | jsonb | YES | - | - |
| pipeline_trend | character varying | YES | - | - |
| velocity_trend | character varying | YES | - | - |
| quality_trend | character varying | YES | - | - |
| territory_metrics | jsonb | YES | - | - |
| calculated_by | character varying | YES | - | - |
| calculated_at | timestamp without time zone | YES | now() | - |

### public.forecast_pipeline_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| forecast_id | character varying | NO | - | - |
| tenant_id | character varying | NO | - | - |
| business_record_id | character varying | NO | - | - |
| deal_name | character varying | NO | - | - |
| customer_name | character varying | NO | - | - |
| deal_value | numeric | NO | - | - |
| weighted_value | numeric | YES | - | - |
| probability | integer | YES | 50 | - |
| expected_close_date | timestamp without time zone | YES | - | - |
| actual_close_date | timestamp without time zone | YES | - | - |
| days_in_pipeline | integer | YES | - | - |
| sales_stage | character varying | NO | - | - |
| stage_progress | integer | YES | 0 | - |
| next_milestone | character varying | YES | - | - |
| next_milestone_date | timestamp without time zone | YES | - | - |
| assigned_sales_rep | character varying | NO | - | - |
| sales_team | character varying | YES | - | - |
| product_category | character varying | YES | - | - |
| equipment_type | character varying | YES | - | - |
| service_type | character varying | YES | - | - |
| quantity | integer | YES | 1 | - |
| competitor_involved | boolean | YES | false | - |
| primary_competitor | character varying | YES | - | - |
| competitive_advantage | text | YES | - | - |
| risk_level | character varying | YES | 'medium'::character varying | - |
| risk_factors | jsonb | YES | '[]'::jsonb | - |
| mitigation_strategies | text | YES | - | - |
| last_activity_date | timestamp without time zone | YES | - | - |
| next_activity_date | timestamp without time zone | YES | - | - |
| activity_count | integer | YES | 0 | - |
| outcome | character varying | YES | - | - |
| lost_reason | character varying | YES | - | - |
| actual_revenue | numeric | YES | - | - |
| included_in_forecast | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.forecast_rules

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| rule_name | character varying | NO | - | - |
| rule_type | character varying | NO | - | - |
| description | text | YES | - | - |
| conditions | jsonb | YES | - | - |
| actions | jsonb | YES | - | - |
| priority | integer | YES | 0 | - |
| is_active | boolean | YES | true | - |
| frequency | character varying | YES | 'daily'::character varying | - |
| last_executed | timestamp without time zone | YES | - | - |
| execution_count | integer | YES | 0 | - |
| success_count | integer | YES | 0 | - |
| error_count | integer | YES | 0 | - |
| created_by | character varying | NO | - | - |
| updated_by | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.gl_accounts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('gl_accounts_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| qb_id | character varying(255) | NO | - | - |
| name | character varying(255) | NO | - | - |
| account_type | character varying(100) | YES | - | - |
| account_sub_type | character varying(100) | YES | - | - |
| classification | character varying(100) | YES | - | - |
| account_code | character varying(50) | YES | - | - |
| description | text | YES | - | - |
| balance | numeric | YES | 0 | - |
| active | boolean | YES | true | - |
| sync_token | character varying(50) | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.gps_tracking_points

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| work_order_id | character varying | YES | - | - |
| session_id | character varying | YES | - | - |
| latitude | numeric | NO | - | - |
| longitude | numeric | NO | - | - |
| altitude_meters | numeric | YES | - | - |
| accuracy_meters | numeric | YES | - | - |
| speed_kmh | numeric | YES | - | - |
| heading_degrees | numeric | YES | - | - |
| activity_type | character varying | YES | - | - |
| movement_status | character varying | YES | - | - |
| battery_level | integer | YES | - | - |
| signal_strength | integer | YES | - | - |
| within_service_area | boolean | YES | true | - |
| geofence_violations | jsonb | YES | - | - |
| nearest_landmark | character varying | YES | - | - |
| clock_in_out_event | boolean | YES | false | - |
| break_start_end_event | boolean | YES | false | - |
| work_start_end_event | boolean | YES | false | - |
| data_source | character varying | YES | 'mobile_app'::character varying | - |
| sync_status | character varying | YES | 'synced'::character varying | - |
| offline_captured | boolean | YES | false | - |
| recorded_at | timestamp without time zone | NO | - | - |
| synced_at | timestamp without time zone | YES | now() | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.integration_audit_logs

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| integration_id | uuid | YES | - | - |
| device_id | uuid | YES | - | - |
| tenant_id | uuid | NO | - | - |
| action | character varying(50) | NO | - | - |
| status | character varying(20) | NO | - | - |
| message | text | YES | - | - |
| details | jsonb | YES | - | - |
| response_time | integer | YES | - | - |
| error_code | character varying(50) | YES | - | - |
| timestamp | timestamp without time zone | YES | now() | - |

### public.inventory_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| name | character varying | NO | - | - |
| part_number | character varying | YES | - | - |
| category | character varying | NO | - | - |
| current_stock | integer | YES | 0 | - |
| reorder_point | integer | YES | 0 | - |
| unit_cost | numeric | YES | - | - |
| supplier | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.invoice_line_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| invoice_id | character varying | NO | - | - |
| equipment_id | character varying | NO | - | - |
| meter_reading_id | character varying | YES | - | - |
| description | character varying | NO | - | - |
| quantity | integer | YES | 0 | - |
| rate | numeric | YES | '0'::numeric | - |
| amount | numeric | NO | - | - |
| line_type | character varying | NO | 'meter'::character varying | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.invoices

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| contract_id | character varying | NO | - | - |
| invoice_number | character varying | NO | - | - |
| billing_period_start | timestamp without time zone | NO | - | - |
| billing_period_end | timestamp without time zone | NO | - | - |
| monthly_base | numeric | YES | '0'::numeric | - |
| black_copies_total | integer | YES | 0 | - |
| color_copies_total | integer | YES | 0 | - |
| black_amount | numeric | YES | '0'::numeric | - |
| color_amount | numeric | YES | '0'::numeric | - |
| total_amount | numeric | NO | - | - |
| status | character varying | NO | 'draft'::character varying | - |
| due_date | timestamp without time zone | NO | - | - |
| paid_date | timestamp without time zone | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.iot_devices

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| device_id | character varying | NO | - | - |
| device_serial_number | character varying | NO | - | - |
| device_name | character varying | NO | - | - |
| device_type | character varying | NO | - | - |
| manufacturer | character varying | NO | - | - |
| model | character varying | NO | - | - |
| equipment_id | character varying | YES | - | - |
| asset_tag | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| installation_location | text | YES | - | - |
| installation_date | date | YES | - | - |
| connection_type | character varying | YES | 'ethernet'::character varying | - |
| ip_address | inet | YES | - | - |
| mac_address | character varying | YES | - | - |
| network_name | character varying | YES | - | - |
| firmware_version | character varying | YES | - | - |
| last_firmware_update | date | YES | - | - |
| monitoring_enabled | boolean | YES | true | - |
| data_collection_interval | integer | YES | 300 | - |
| device_status | character varying | YES | 'active'::character varying | - |
| last_ping_time | timestamp without time zone | YES | - | - |
| last_data_received | timestamp without time zone | YES | - | - |
| battery_level | integer | YES | - | - |
| signal_strength | integer | YES | - | - |
| alert_thresholds | jsonb | YES | - | - |
| maintenance_schedule | jsonb | YES | - | - |
| device_token | character varying | YES | - | - |
| encryption_enabled | boolean | YES | true | - |
| last_security_update | date | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.knowledge_base_articles

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| title | character varying | NO | - | - |
| slug | character varying | YES | - | - |
| content | text | NO | - | - |
| summary | text | YES | - | - |
| category | character varying | NO | - | - |
| subcategory | character varying | YES | - | - |
| tags | jsonb | YES | - | - |
| applicable_equipment | jsonb | YES | - | - |
| is_published | boolean | YES | false | - |
| is_featured | boolean | YES | false | - |
| view_count | integer | YES | 0 | - |
| helpful_votes | integer | YES | 0 | - |
| unhelpful_votes | integer | YES | 0 | - |
| meta_description | text | YES | - | - |
| search_keywords | jsonb | YES | - | - |
| author_id | character varying | NO | - | - |
| published_at | timestamp without time zone | YES | - | - |
| last_reviewed_at | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.lead_activities

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| lead_id | character varying | NO | - | - |
| activity_type | character varying | NO | - | - |
| subject | character varying | NO | - | - |
| description | text | YES | - | - |
| direction | character varying | YES | - | - |
| email_from | character varying | YES | - | - |
| email_to | text | YES | - | - |
| email_cc | text | YES | - | - |
| email_subject | character varying | YES | - | - |
| email_body | text | YES | - | - |
| is_shared | boolean | YES | false | - |
| call_duration | integer | YES | - | - |
| call_outcome | character varying | YES | - | - |
| scheduled_date | timestamp without time zone | YES | - | - |
| completed_date | timestamp without time zone | YES | - | - |
| due_date | timestamp without time zone | YES | - | - |
| outcome | character varying | YES | - | - |
| next_action | text | YES | - | - |
| follow_up_date | timestamp without time zone | YES | - | - |
| related_records | jsonb | YES | - | - |
| attachments | jsonb | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.lead_contacts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| lead_id | character varying | NO | - | - |
| first_name | character varying | NO | - | - |
| last_name | character varying | NO | - | - |
| title | character varying | YES | - | - |
| department | character varying | YES | - | - |
| phone | character varying | YES | - | - |
| email | character varying | YES | - | - |
| is_primary | boolean | YES | false | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.lead_related_records

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| lead_id | character varying | NO | - | - |
| record_type | character varying | NO | - | - |
| record_id | character varying | NO | - | - |
| record_title | character varying | YES | - | - |
| record_count | integer | YES | 1 | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.leads

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| email | character varying | YES | - | - |
| phone | character varying | YES | - | - |
| address | text | YES | - | - |
| source | character varying | NO | 'website'::character varying | - |
| assigned_sales_rep_id | character varying | YES | - | - |
| estimated_value | numeric | YES | '0'::numeric | - |
| estimated_close_date | timestamp without time zone | YES | - | - |
| notes | text | YES | - | - |
| last_contact_date | timestamp without time zone | YES | - | - |
| next_follow_up_date | timestamp without time zone | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| company_id | uuid | YES | - | - |
| contact_id | uuid | YES | - | - |
| owner_id | uuid | YES | - | - |
| lead_source | character varying(100) | YES | - | - |
| lead_status | character varying(50) | YES | 'new'::character varying | - |
| status | character varying(50) | YES | 'new'::character varying | - |
| estimated_amount | numeric | YES | - | - |
| probability | integer | YES | 50 | - |
| close_date | date | YES | - | - |
| lead_score | integer | YES | 0 | - |
| priority | character varying(20) | YES | 'medium'::character varying | - |
| external_salesforce_id | character varying(255) | YES | - | - |
| last_salesforce_sync | timestamp without time zone | YES | - | - |

### public.locations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| name | character varying(100) | NO | - | - |
| code | character varying(20) | NO | - | - |
| address | text | YES | - | - |
| city | character varying(50) | YES | - | - |
| state | character varying(20) | YES | - | - |
| postal_code | character varying(20) | YES | - | - |
| country | character varying(50) | YES | 'USA'::character varying | - |
| phone | character varying(20) | YES | - | - |
| email | character varying(255) | YES | - | - |
| manager_id | character varying | YES | - | - |
| region_id | character varying | YES | - | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.maintenance_notifications

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| schedule_id | character varying | NO | - | - |
| notification_type | character varying | NO | - | - |
| recipient_type | character varying | NO | - | - |
| recipient_id | character varying | NO | - | - |
| subject | character varying | NO | - | - |
| message | text | NO | - | - |
| notification_method | character varying | NO | - | - |
| is_delivered | boolean | YES | false | - |
| delivered_at | timestamp without time zone | YES | - | - |
| is_read | boolean | YES | false | - |
| read_at | timestamp without time zone | YES | - | - |
| scheduled_for | timestamp without time zone | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.maintenance_schedules

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| equipment_id | character varying | YES | - | - |
| contract_id | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| schedule_name | character varying | NO | - | - |
| schedule_type | character varying | NO | - | - |
| frequency | character varying | NO | - | - |
| frequency_value | integer | YES | 1 | - |
| next_service_date | timestamp without time zone | YES | - | - |
| last_service_date | timestamp without time zone | YES | - | - |
| meter_threshold | integer | YES | - | - |
| current_meter_reading | integer | YES | - | - |
| last_service_meter | integer | YES | - | - |
| service_template_id | character varying | YES | - | - |
| service_duration_minutes | integer | YES | 60 | - |
| required_technician_level | character varying | YES | - | - |
| required_skills | jsonb | YES | - | - |
| estimated_cost | numeric | YES | - | - |
| advance_notification_days | integer | YES | 7 | - |
| customer_notification | boolean | YES | true | - |
| technician_notification | boolean | YES | true | - |
| is_active | boolean | YES | true | - |
| priority | character varying | YES | 'medium'::character varying | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.maintenance_tasks

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| schedule_id | character varying | NO | - | - |
| task_title | character varying | NO | - | - |
| task_description | text | YES | - | - |
| task_category | character varying | NO | - | - |
| estimated_duration_minutes | integer | YES | 30 | - |
| required_parts | jsonb | YES | - | - |
| required_tools | jsonb | YES | - | - |
| safety_requirements | jsonb | YES | - | - |
| instructions | text | YES | - | - |
| is_completed | boolean | YES | false | - |
| completed_by | character varying | YES | - | - |
| completed_at | timestamp without time zone | YES | - | - |
| actual_duration_minutes | integer | YES | - | - |
| notes | text | YES | - | - |
| quality_check_required | boolean | YES | false | - |
| quality_check_by | character varying | YES | - | - |
| quality_check_at | timestamp without time zone | YES | - | - |
| quality_score | integer | YES | - | - |
| sort_order | integer | YES | 1 | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.managed_services

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| product_code | character varying | NO | - | - |
| product_name | character varying | NO | - | - |
| category | character varying | YES | 'IT Services'::character varying | - |
| service_type | character varying | YES | - | - |
| service_level | character varying | YES | - | - |
| description | text | YES | - | - |
| summary | text | YES | - | - |
| note | text | YES | - | - |
| ea_notes | text | YES | - | - |
| config_note | text | YES | - | - |
| related_products | text | YES | - | - |
| support_hours | character varying | YES | - | - |
| response_time | character varying | YES | - | - |
| includes_hardware | boolean | YES | false | - |
| remote_mgmt | boolean | YES | false | - |
| onsite_support | boolean | YES | false | - |
| is_active | boolean | YES | true | - |
| available_for_all | boolean | YES | false | - |
| repost_edit | boolean | YES | false | - |
| sales_rep_credit | boolean | YES | true | - |
| funding | boolean | YES | true | - |
| lease | boolean | YES | false | - |
| payment_type | character varying | YES | - | - |
| new_active | boolean | YES | false | - |
| new_rep_price | numeric | YES | - | - |
| upgrade_active | boolean | YES | false | - |
| upgrade_rep_price | numeric | YES | - | - |
| lexmark_active | boolean | YES | false | - |
| lexmark_rep_price | numeric | YES | - | - |
| graphic_active | boolean | YES | false | - |
| graphic_rep_price | numeric | YES | - | - |
| price_book_id | character varying | YES | - | - |
| temp_key | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.manufacturer_integrations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| manufacturer | character varying(50) | NO | - | - |
| integration_name | character varying(100) | NO | - | - |
| status | character varying(20) | NO | 'inactive'::character varying | - |
| auth_method | character varying(20) | NO | 'api_key'::character varying | - |
| api_endpoint | character varying(255) | YES | - | - |
| api_key | character varying(255) | YES | - | - |
| username | character varying(100) | YES | - | - |
| password | character varying(255) | YES | - | - |
| collection_frequency | character varying(20) | NO | 'daily'::character varying | - |
| last_sync | timestamp without time zone | YES | - | - |
| next_sync | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| credentials | jsonb | YES | - | - |
| configuration | jsonb | YES | '{}'::jsonb | - |
| is_active | boolean | YES | true | - |

### public.master_product_accessories

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| manufacturer | character varying(100) | NO | - | - |
| accessory_code | character varying(100) | NO | - | - |
| display_name | character varying(255) | NO | - | - |
| category | character varying(50) | YES | - | - |
| msrp | numeric | YES | - | - |
| specs_json | jsonb | YES | - | - |
| status | character varying(20) | YES | 'active'::character varying | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| discontinued_at | timestamp without time zone | YES | - | - |
| version | character varying | YES | '1.0'::character varying | - |

### public.master_product_accessory_relationships

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| base_product_id | character varying | NO | - | - |
| accessory_id | character varying | NO | - | - |
| relationship_type | character varying | NO | 'compatible'::character varying | - |
| category | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.master_product_models

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| manufacturer | character varying(100) | NO | - | - |
| model_code | character varying(100) | NO | - | - |
| display_name | character varying(255) | NO | - | - |
| category | character varying(50) | YES | - | - |
| product_type | character varying(100) | YES | - | - |
| msrp | numeric | YES | - | - |
| specs_json | jsonb | YES | - | - |
| status | character varying(20) | YES | 'active'::character varying | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| discontinued_at | timestamp without time zone | YES | - | - |
| version | character varying | YES | '1.0'::character varying | - |
| dealer_cost | numeric | YES | - | - |
| margin_percentage | numeric | YES | - | - |

### public.meter_readings

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| equipment_id | character varying | NO | - | - |
| contract_id | character varying | NO | - | - |
| reading_date | timestamp without time zone | NO | - | - |
| black_meter | integer | NO | 0 | - |
| color_meter | integer | NO | 0 | - |
| previous_black_meter | integer | YES | 0 | - |
| previous_color_meter | integer | YES | 0 | - |
| black_copies | integer | YES | 0 | - |
| color_copies | integer | YES | 0 | - |
| collection_method | character varying | NO | 'manual'::character varying | - |
| notes | text | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.mobile_app_sessions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| session_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| device_id | character varying | YES | - | - |
| session_start | timestamp without time zone | NO | - | - |
| session_end | timestamp without time zone | YES | - | - |
| last_activity | timestamp without time zone | YES | now() | - |
| device_type | character varying | YES | - | - |
| device_model | character varying | YES | - | - |
| os_version | character varying | YES | - | - |
| app_version | character varying | YES | - | - |
| connection_type | character varying | YES | - | - |
| network_quality | character varying | YES | - | - |
| start_location | jsonb | YES | - | - |
| end_location | jsonb | YES | - | - |
| locations_recorded | integer | YES | 0 | - |
| work_orders_accessed | jsonb | YES | - | - |
| parts_orders_created | integer | YES | 0 | - |
| photos_uploaded | integer | YES | 0 | - |
| signatures_captured | integer | YES | 0 | - |
| sync_operations | integer | YES | 0 | - |
| data_uploaded_mb | numeric | YES | 0 | - |
| data_downloaded_mb | numeric | YES | 0 | - |
| offline_time_minutes | integer | YES | 0 | - |
| crash_count | integer | YES | 0 | - |
| error_count | integer | YES | 0 | - |
| performance_issues | jsonb | YES | - | - |
| end_reason | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.mobile_field_metrics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| date_recorded | date | NO | - | - |
| shift_type | character varying | YES | 'regular'::character varying | - |
| work_orders_completed | integer | YES | 0 | - |
| work_orders_attempted | integer | YES | 0 | - |
| first_time_fix_count | integer | YES | 0 | - |
| callback_count | integer | YES | 0 | - |
| total_work_hours | numeric | YES | 0 | - |
| billable_hours | numeric | YES | 0 | - |
| travel_hours | numeric | YES | 0 | - |
| break_hours | numeric | YES | 0 | - |
| administrative_hours | numeric | YES | 0 | - |
| total_distance_km | numeric | YES | 0 | - |
| fuel_efficiency_km_per_liter | numeric | YES | - | - |
| average_speed_kmh | numeric | YES | - | - |
| geofence_compliance_percentage | numeric | YES | 100 | - |
| customer_interactions | integer | YES | 0 | - |
| customer_satisfaction_avg | numeric | YES | 0 | - |
| customer_complaints | integer | YES | 0 | - |
| customer_compliments | integer | YES | 0 | - |
| voice_notes_recorded | integer | YES | 0 | - |
| photos_captured | integer | YES | 0 | - |
| forms_completed | integer | YES | 0 | - |
| parts_consumption_value | numeric | YES | 0 | - |
| safety_incidents | integer | YES | 0 | - |
| safety_near_misses | integer | YES | 0 | - |
| compliance_violations | integer | YES | 0 | - |
| ppe_compliance_percentage | numeric | YES | 100 | - |
| app_login_count | integer | YES | 0 | - |
| offline_work_duration_minutes | integer | YES | 0 | - |
| sync_attempts | integer | YES | 0 | - |
| sync_failures | integer | YES | 0 | - |
| data_usage_mb | numeric | YES | 0 | - |
| work_quality_score | numeric | YES | 0 | - |
| documentation_completeness_percentage | numeric | YES | 0 | - |
| follow_up_required_count | integer | YES | 0 | - |
| warranty_claims_count | integer | YES | 0 | - |
| revenue_generated | numeric | YES | 0 | - |
| costs_incurred | numeric | YES | 0 | - |
| profit_margin | numeric | YES | 0 | - |
| upsell_opportunities | integer | YES | 0 | - |
| average_job_duration_minutes | numeric | YES | 0 | - |
| setup_time_minutes | numeric | YES | 0 | - |
| cleanup_time_minutes | numeric | YES | 0 | - |
| waiting_time_minutes | numeric | YES | 0 | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.mobile_field_orders

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| order_number | character varying | NO | - | - |
| order_type | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| work_order_id | character varying | YES | - | - |
| order_date | date | NO | - | - |
| requested_delivery_date | date | YES | - | - |
| delivery_method | character varying | YES | 'truck_delivery'::character varying | - |
| delivery_address | text | YES | - | - |
| delivery_contact_name | character varying | YES | - | - |
| delivery_contact_phone | character varying | YES | - | - |
| delivery_instructions | text | YES | - | - |
| status | character varying | YES | 'submitted'::character varying | - |
| urgency | character varying | YES | 'standard'::character varying | - |
| requires_approval | boolean | YES | false | - |
| approved_by | character varying | YES | - | - |
| approval_date | timestamp without time zone | YES | - | - |
| approval_notes | text | YES | - | - |
| subtotal | numeric | YES | 0 | - |
| tax_amount | numeric | YES | 0 | - |
| shipping_cost | numeric | YES | 0 | - |
| total_amount | numeric | YES | 0 | - |
| tracking_number | character varying | YES | - | - |
| shipped_date | date | YES | - | - |
| delivered_date | date | YES | - | - |
| delivery_confirmation | text | YES | - | - |
| order_notes | text | YES | - | - |
| special_instructions | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.mobile_order_line_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| field_order_id | character varying | NO | - | - |
| line_number | integer | NO | - | - |
| part_id | character varying | NO | - | - |
| part_number | character varying | NO | - | - |
| part_name | character varying | NO | - | - |
| quantity_requested | integer | NO | - | - |
| quantity_approved | integer | YES | - | - |
| quantity_shipped | integer | YES | - | - |
| quantity_received | integer | YES | - | - |
| unit_cost | numeric | NO | - | - |
| unit_price | numeric | NO | - | - |
| line_total | numeric | NO | - | - |
| line_status | character varying | YES | 'pending'::character varying | - |
| substitute_part_id | character varying | YES | - | - |
| line_notes | text | YES | - | - |
| usage_reason | character varying | YES | - | - |
| work_order_reference | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.mobile_parts_inventory

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| part_number | character varying | NO | - | - |
| part_name | character varying | NO | - | - |
| part_description | text | YES | - | - |
| manufacturer | character varying | YES | - | - |
| category | character varying | YES | - | - |
| warehouse_quantity | integer | YES | 0 | - |
| truck_quantity | integer | YES | 0 | - |
| reserved_quantity | integer | YES | 0 | - |
| available_quantity | integer | YES | 0 | - |
| unit_cost | numeric | NO | - | - |
| list_price | numeric | NO | - | - |
| markup_percentage | numeric | YES | 0 | - |
| weight_lbs | numeric | YES | - | - |
| dimensions | character varying | YES | - | - |
| compatibility | jsonb | YES | - | - |
| primary_vendor_id | character varying | YES | - | - |
| vendor_part_number | character varying | YES | - | - |
| lead_time_days | integer | YES | 7 | - |
| minimum_order_quantity | integer | YES | 1 | - |
| reorder_point | integer | YES | 5 | - |
| max_stock_level | integer | YES | 100 | - |
| last_restocked_date | date | YES | - | - |
| is_active | boolean | YES | true | - |
| is_stockable | boolean | YES | true | - |
| requires_special_handling | boolean | YES | false | - |
| commonly_used | boolean | YES | false | - |
| truck_stock_priority | integer | YES | 5 | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.mobile_work_orders

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| work_order_number | character varying | NO | - | - |
| work_order_type | character varying | NO | - | - |
| priority | character varying | YES | 'medium'::character varying | - |
| customer_id | character varying | NO | - | - |
| business_record_id | character varying | NO | - | - |
| equipment_id | character varying | YES | - | - |
| asset_tag | character varying | YES | - | - |
| service_address | text | NO | - | - |
| site_contact_name | character varying | YES | - | - |
| site_contact_phone | character varying | YES | - | - |
| access_instructions | text | YES | - | - |
| special_requirements | text | YES | - | - |
| scheduled_date | date | YES | - | - |
| scheduled_time_start | time without time zone | YES | - | - |
| scheduled_time_end | time without time zone | YES | - | - |
| estimated_duration_hours | numeric | YES | 2.0 | - |
| assigned_technician_id | character varying | NO | - | - |
| backup_technician_id | character varying | YES | - | - |
| technician_notes | text | YES | - | - |
| problem_description | text | NO | - | - |
| work_performed | text | YES | - | - |
| parts_used | jsonb | YES | - | - |
| labor_hours | numeric | YES | 0 | - |
| status | character varying | YES | 'assigned'::character varying | - |
| status_updated_at | timestamp without time zone | YES | now() | - |
| arrival_time | timestamp without time zone | YES | - | - |
| start_work_time | timestamp without time zone | YES | - | - |
| completion_time | timestamp without time zone | YES | - | - |
| departure_time | timestamp without time zone | YES | - | - |
| travel_time_minutes | integer | YES | - | - |
| customer_signature | text | YES | - | - |
| customer_satisfaction_rating | integer | YES | - | - |
| customer_feedback | text | YES | - | - |
| before_photos | jsonb | YES | - | - |
| after_photos | jsonb | YES | - | - |
| documentation_notes | text | YES | - | - |
| service_charge | numeric | YES | 0 | - |
| parts_cost | numeric | YES | 0 | - |
| total_cost | numeric | YES | 0 | - |
| billing_notes | text | YES | - | - |
| follow_up_required | boolean | YES | false | - |
| follow_up_date | date | YES | - | - |
| follow_up_notes | text | YES | - | - |
| last_sync_time | timestamp without time zone | YES | - | - |
| sync_status | character varying | YES | 'synced'::character varying | - |
| offline_data | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.monitoring_dashboards

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| dashboard_name | character varying | NO | - | - |
| dashboard_type | character varying | NO | - | - |
| dashboard_config | jsonb | NO | - | - |
| data_sources | jsonb | YES | - | - |
| refresh_interval | integer | YES | 300 | - |
| is_public | boolean | YES | false | - |
| owner_id | character varying | NO | - | - |
| shared_with | jsonb | YES | - | - |
| color_scheme | character varying | YES | 'default'::character varying | - |
| layout_type | character varying | YES | 'grid'::character varying | - |
| widget_settings | jsonb | YES | - | - |
| cache_duration | integer | YES | 300 | - |
| last_generated | timestamp without time zone | YES | - | - |
| generation_time_ms | integer | YES | - | - |
| is_active | boolean | YES | true | - |
| last_accessed | timestamp without time zone | YES | - | - |
| access_count | integer | YES | 0 | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.onboarding_checklists

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| checklist_title | character varying(255) | NO | - | - |
| installation_type | character varying(50) | NO | - | - |
| customer_data | jsonb | YES | - | - |
| site_information | jsonb | YES | - | - |
| scheduled_install_date | date | YES | - | - |
| actual_install_date | date | YES | - | - |
| access_requirements | text | YES | - | - |
| special_instructions | text | YES | - | - |
| status | character varying(20) | YES | 'draft'::character varying | - |
| progress_percentage | numeric | YES | 0 | - |
| total_sections | integer | YES | 0 | - |
| completed_sections | integer | YES | 0 | - |
| pdf_url | character varying(500) | YES | - | - |
| pdf_generated_at | timestamp with time zone | YES | - | - |
| created_by | uuid | NO | - | - |
| last_modified_by | uuid | YES | - | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |
| customer_id | character varying | YES | - | - |
| equipment_details | jsonb | YES | - | - |
| assigned_technician_id | character varying | YES | - | - |
| estimated_duration | integer | YES | - | - |
| business_hours | jsonb | YES | - | - |
| description | text | YES | - | - |
| quote_id | character varying | YES | - | - |
| order_id | character varying | YES | - | - |

### public.onboarding_dynamic_sections

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| checklist_id | uuid | NO | - | - |
| section_title | character varying(255) | NO | - | - |
| section_description | text | YES | - | - |
| section_order | integer | YES | 0 | - |
| field_configs | jsonb | YES | - | - |
| form_data | jsonb | YES | - | - |
| is_completed | boolean | YES | false | - |
| notes | text | YES | - | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.onboarding_equipment

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| checklist_id | uuid | NO | - | - |
| manufacturer | character varying(100) | YES | - | - |
| model | character varying(100) | YES | - | - |
| serial_number | character varying(100) | YES | - | - |
| asset_tag | character varying(100) | YES | - | - |
| building_location | character varying(100) | YES | - | - |
| room_location | character varying(100) | YES | - | - |
| specific_location | text | YES | - | - |
| target_ip_address | character varying(45) | YES | - | - |
| subnet_mask | character varying(45) | YES | - | - |
| hostname | character varying(100) | YES | - | - |
| is_installed | boolean | YES | false | - |
| installation_notes | text | YES | - | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.onboarding_network_config

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| checklist_id | uuid | NO | - | - |
| network_name | character varying(100) | YES | - | - |
| network_type | character varying(50) | YES | - | - |
| vlan_id | integer | YES | - | - |
| dhcp_range_start | character varying(45) | YES | - | - |
| dhcp_range_end | character varying(45) | YES | - | - |
| dns_primary | character varying(45) | YES | - | - |
| dns_secondary | character varying(45) | YES | - | - |
| security_protocol | character varying(50) | YES | - | - |
| wifi_ssid | character varying(100) | YES | - | - |
| wifi_password | character varying(255) | YES | - | - |
| is_configured | boolean | YES | false | - |
| configuration_notes | text | YES | - | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.onboarding_print_management

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| checklist_id | uuid | NO | - | - |
| solution_type | character varying(50) | YES | - | - |
| server_address | character varying(255) | YES | - | - |
| database_config | jsonb | YES | - | - |
| authentication_method | character varying(50) | YES | - | - |
| quota_settings | jsonb | YES | - | - |
| security_settings | jsonb | YES | - | - |
| is_configured | boolean | YES | false | - |
| configuration_notes | text | YES | - | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.onboarding_tasks

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| checklist_id | uuid | NO | - | - |
| task_title | character varying(255) | NO | - | - |
| task_description | text | YES | - | - |
| priority | character varying(20) | YES | 'medium'::character varying | - |
| status | character varying(20) | YES | 'pending'::character varying | - |
| assigned_to | uuid | YES | - | - |
| due_date | date | YES | - | - |
| completed_date | timestamp with time zone | YES | - | - |
| completion_notes | text | YES | - | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.organizational_units

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying(255) | NO | - | - |
| tenant_id | character varying(255) | NO | - | - |
| name | character varying(255) | NO | - | - |
| code | character varying(100) | NO | - | - |
| tier | character varying(50) | NO | - | - |
| parent_unit_id | character varying(255) | YES | - | - |
| lft | integer | NO | 1 | - |
| rgt | integer | NO | 2 | - |
| depth | integer | NO | 0 | - |
| description | text | YES | - | - |
| manager_id | character varying(255) | YES | - | - |
| location_id | character varying(255) | YES | - | - |
| region_id | character varying(255) | YES | - | - |
| is_active | boolean | NO | true | - |
| metadata | jsonb | YES | '{}'::jsonb | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.payment_methods

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('payment_methods_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| name | character varying(255) | NO | - | - |
| type | character varying(50) | YES | - | - |
| active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.payment_schedules

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| contract_id | character varying | YES | - | - |
| schedule_name | character varying | NO | - | - |
| payment_frequency | character varying | NO | - | - |
| payment_amount | numeric | NO | - | - |
| currency | character varying | YES | 'USD'::character varying | - |
| start_date | date | NO | - | - |
| end_date | date | YES | - | - |
| next_payment_date | date | NO | - | - |
| payment_method | character varying | YES | 'invoice'::character varying | - |
| auto_charge_card_id | character varying | YES | - | - |
| auto_charge_bank_id | character varying | YES | - | - |
| status | character varying | YES | 'active'::character varying | - |
| payments_made | integer | YES | 0 | - |
| total_payments_scheduled | integer | YES | - | - |
| retry_count | integer | YES | 0 | - |
| max_retries | integer | YES | 3 | - |
| last_retry_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.payment_terms

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('payment_terms_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| name | character varying(255) | NO | - | - |
| type | character varying(50) | YES | - | - |
| discount_percent | numeric | YES | - | - |
| discount_days | integer | YES | - | - |
| net_days | integer | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.performance_benchmarks

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| benchmark_name | character varying | NO | - | - |
| benchmark_category | character varying | NO | - | - |
| metric_type | character varying | YES | - | - |
| industry_average | numeric | YES | - | - |
| industry_best_practice | numeric | YES | - | - |
| company_target | numeric | YES | - | - |
| current_performance | numeric | YES | - | - |
| performance_grade | character varying | YES | - | - |
| percentile_ranking | numeric | YES | - | - |
| gap_to_target | numeric | YES | - | - |
| gap_to_best_practice | numeric | YES | - | - |
| previous_period_value | numeric | YES | - | - |
| trend_direction | character varying | YES | - | - |
| months_to_target | integer | YES | - | - |
| data_source | character varying | YES | - | - |
| measurement_frequency | character varying | YES | - | - |
| last_updated | date | YES | - | - |
| validity_period_end | date | YES | - | - |
| geographic_scope | character varying | YES | - | - |
| company_size_category | character varying | YES | - | - |
| industry_segment | character varying | YES | - | - |
| improvement_priority | character varying | YES | - | - |
| action_plan | jsonb | YES | - | - |
| responsible_party | character varying | YES | - | - |
| target_completion_date | date | YES | - | - |
| estimated_roi | numeric | YES | - | - |
| business_impact | character varying | YES | - | - |
| investment_required | numeric | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.phone_in_tickets

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| caller_name | character varying | NO | - | - |
| caller_phone | character varying | NO | - | - |
| caller_email | character varying | YES | - | - |
| caller_role | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| customer_name | character varying | NO | - | - |
| location_address | text | NO | - | - |
| location_building | character varying | YES | - | - |
| location_floor | character varying | YES | - | - |
| location_room | character varying | YES | - | - |
| equipment_id | character varying | YES | - | - |
| equipment_brand | character varying | YES | - | - |
| equipment_model | character varying | YES | - | - |
| equipment_serial | character varying | YES | - | - |
| issue_category | character varying | YES | 'other'::character varying | - |
| issue_description | text | NO | - | - |
| priority | character varying | YES | 'medium'::character varying | - |
| contact_method | character varying | YES | 'phone'::character varying | - |
| preferred_service_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| converted_to_ticket_id | character varying | YES | - | - |
| converted_at | timestamp without time zone | YES | - | - |
| notes | text | YES | - | - |

### public.po_line_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| purchase_order_id | character varying | NO | - | - |
| line_number | integer | NO | - | - |
| product_id | character varying | YES | - | - |
| equipment_model | character varying | NO | - | - |
| equipment_brand | character varying | YES | - | - |
| description | text | NO | - | - |
| quantity | integer | NO | 1 | - |
| unit_price | numeric | NO | - | - |
| line_total | numeric | NO | - | - |
| specifications | jsonb | YES | - | - |
| warranty_period_months | integer | YES | 12 | - |
| serial_numbers | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.predictive_alerts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| alert_id | character varying | NO | - | - |
| device_id | character varying | NO | - | - |
| equipment_id | character varying | YES | - | - |
| alert_type | character varying | NO | - | - |
| alert_category | character varying | NO | - | - |
| severity | character varying | NO | - | - |
| predicted_failure_component | character varying | YES | - | - |
| failure_probability | numeric | YES | - | - |
| time_to_failure_days | integer | YES | - | - |
| confidence_score | numeric | YES | - | - |
| alert_title | character varying | NO | - | - |
| alert_description | text | NO | - | - |
| recommended_actions | jsonb | YES | - | - |
| prediction_model | character varying | YES | - | - |
| model_version | character varying | YES | - | - |
| feature_importance | jsonb | YES | - | - |
| historical_pattern_match | jsonb | YES | - | - |
| alert_status | character varying | YES | 'open'::character varying | - |
| acknowledged_by | character varying | YES | - | - |
| acknowledged_at | timestamp without time zone | YES | - | - |
| resolved_by | character varying | YES | - | - |
| resolved_at | timestamp without time zone | YES | - | - |
| resolution_notes | text | YES | - | - |
| customer_id | character varying | YES | - | - |
| business_record_id | character varying | YES | - | - |
| estimated_downtime_hours | numeric | YES | - | - |
| business_impact_level | character varying | YES | - | - |
| escalation_level | integer | YES | 1 | - |
| assigned_technician_id | character varying | YES | - | - |
| work_order_id | character varying | YES | - | - |
| notifications_sent | jsonb | YES | - | - |
| customer_notified | boolean | YES | false | - |
| customer_notification_time | timestamp without time zone | YES | - | - |
| detection_accuracy | boolean | YES | - | - |
| actual_failure_date | date | YES | - | - |
| prevention_successful | boolean | YES | - | - |
| cost_savings_estimate | numeric | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.process_automation_logs

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| log_type | character varying | NO | - | - |
| entity_type | character varying | NO | - | - |
| entity_id | character varying | NO | - | - |
| event_name | character varying | NO | - | - |
| event_timestamp | timestamp without time zone | NO | - | - |
| event_source | character varying | YES | - | - |
| event_data | jsonb | YES | - | - |
| previous_state | jsonb | YES | - | - |
| new_state | jsonb | YES | - | - |
| context_variables | jsonb | YES | - | - |
| triggered_by_user | character varying | YES | - | - |
| executing_system_user | character varying | YES | - | - |
| client_ip | character varying | YES | - | - |
| user_agent | text | YES | - | - |
| execution_duration_ms | integer | YES | - | - |
| memory_usage_mb | numeric | YES | - | - |
| cpu_usage_percentage | numeric | YES | - | - |
| api_calls_made | integer | YES | 0 | - |
| success | boolean | NO | - | - |
| error_code | character varying | YES | - | - |
| error_message | text | YES | - | - |
| stack_trace | text | YES | - | - |
| retry_attempt | integer | YES | 0 | - |
| business_value_impact | numeric | YES | - | - |
| cost_impact | numeric | YES | - | - |
| time_saved_minutes | numeric | YES | - | - |
| compliance_flags | jsonb | YES | - | - |
| audit_trail_id | character varying | YES | - | - |
| data_sensitivity_level | character varying | YES | - | - |
| performance_baseline | numeric | YES | - | - |
| performance_actual | numeric | YES | - | - |
| alert_thresholds_breached | jsonb | YES | - | - |
| external_system_calls | jsonb | YES | - | - |
| webhook_responses | jsonb | YES | - | - |
| api_response_times | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.product_accessories

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| model_id | uuid | NO | - | - |
| accessory_code | character varying | NO | - | - |
| accessory_name | character varying | NO | - | - |
| category | character varying | YES | - | - |
| description | text | YES | - | - |
| msrp | numeric | YES | - | - |
| rep_price | numeric | YES | - | - |
| is_required | boolean | YES | false | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.product_models

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| product_code | character varying | NO | - | - |
| product_name | character varying | NO | - | - |
| category | character varying | YES | 'MFP'::character varying | - |
| manufacturer | character varying | YES | - | - |
| description | text | YES | - | - |
| msrp | numeric | YES | - | - |
| color_mode | character varying | YES | - | - |
| color_speed | character varying | YES | - | - |
| bw_speed | character varying | YES | - | - |
| product_family | character varying | YES | - | - |
| new_active | boolean | YES | false | - |
| new_rep_price | numeric | YES | - | - |
| upgrade_active | boolean | YES | false | - |
| upgrade_rep_price | numeric | YES | - | - |
| lexmark_active | boolean | YES | false | - |
| lexmark_rep_price | numeric | YES | - | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.product_pricing

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| product_id | character varying | NO | - | - |
| product_type | character varying | NO | - | - |
| dealer_cost | numeric | NO | - | - |
| company_markup_percentage | numeric | YES | - | - |
| company_price | numeric | NO | - | - |
| minimum_sale_price | numeric | YES | - | - |
| suggested_retail_price | numeric | YES | - | - |
| is_active | boolean | YES | true | - |
| effective_date | timestamp without time zone | YES | now() | - |
| expiration_date | timestamp without time zone | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.product_tags

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| model_id | uuid | NO | - | - |
| tag | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.professional_services

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| product_code | character varying | NO | - | - |
| product_name | character varying | NO | - | - |
| category | character varying | YES | 'Professional Services'::character varying | - |
| accessory_type | character varying | YES | - | - |
| description | text | YES | - | - |
| summary | text | YES | - | - |
| note | text | YES | - | - |
| ea_notes | text | YES | - | - |
| related_products | text | YES | - | - |
| is_active | boolean | YES | true | - |
| available_for_all | boolean | YES | false | - |
| repost_edit | boolean | YES | false | - |
| sales_rep_credit | boolean | YES | true | - |
| funding | boolean | YES | true | - |
| lease | boolean | YES | false | - |
| payment_type | character varying | YES | - | - |
| msrp | numeric | YES | - | - |
| new_active | boolean | YES | false | - |
| new_rep_price | numeric | YES | - | - |
| upgrade_active | boolean | YES | false | - |
| upgrade_rep_price | numeric | YES | - | - |
| lexmark_active | boolean | YES | false | - |
| lexmark_rep_price | numeric | YES | - | - |
| graphic_active | boolean | YES | false | - |
| graphic_rep_price | numeric | YES | - | - |
| manufacturer | character varying | YES | - | - |
| manufacturer_product_code | character varying | YES | - | - |
| model | character varying | YES | - | - |
| units | character varying | YES | - | - |
| environment | character varying | YES | - | - |
| color_mode | character varying | YES | - | - |
| ea_item_number | character varying | YES | - | - |
| price_book_id | character varying | YES | - | - |
| temp_key | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.profitability_analysis

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| analysis_name | character varying | NO | - | - |
| analysis_type | character varying | NO | - | - |
| analysis_period_start | date | NO | - | - |
| analysis_period_end | date | NO | - | - |
| subject_type | character varying | NO | - | - |
| subject_id | character varying | YES | - | - |
| subject_name | character varying | YES | - | - |
| service_revenue | numeric | YES | 0 | - |
| product_revenue | numeric | YES | 0 | - |
| other_revenue | numeric | YES | 0 | - |
| total_revenue | numeric | YES | 0 | - |
| direct_costs | numeric | YES | 0 | - |
| labor_costs | numeric | YES | 0 | - |
| material_costs | numeric | YES | 0 | - |
| overhead_allocation | numeric | YES | 0 | - |
| total_costs | numeric | YES | 0 | - |
| gross_profit | numeric | YES | 0 | - |
| gross_margin_percentage | numeric | YES | 0 | - |
| net_profit | numeric | YES | 0 | - |
| net_margin_percentage | numeric | YES | 0 | - |
| roi_percentage | numeric | YES | 0 | - |
| customer_lifetime_value | numeric | YES | 0 | - |
| customer_acquisition_cost | numeric | YES | 0 | - |
| industry_benchmark_margin | numeric | YES | - | - |
| performance_vs_benchmark | numeric | YES | - | - |
| ranking_percentile | numeric | YES | - | - |
| status | character varying | YES | 'completed'::character varying | - |
| calculation_method | character varying | YES | 'activity_based'::character varying | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.projects

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| name | character varying | NO | - | - |
| description | text | YES | - | - |
| status | character varying | NO | 'active'::character varying | - |
| start_date | timestamp without time zone | YES | - | - |
| end_date | timestamp without time zone | YES | - | - |
| budget | numeric | YES | - | - |
| completion_percentage | integer | YES | 0 | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.proposal_analytics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| proposal_id | character varying | NO | - | - |
| event_type | character varying | NO | - | - |
| event_timestamp | timestamp without time zone | YES | now() | - |
| event_details | jsonb | YES | - | - |
| user_id | character varying | YES | - | - |
| customer_user_id | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.proposal_comments

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| proposal_id | character varying | NO | - | - |
| comment_type | character varying | YES | 'general'::character varying | - |
| content | text | NO | - | - |
| author_id | character varying | NO | - | - |
| author_name | character varying | NO | - | - |
| author_role | character varying | YES | - | - |
| is_internal | boolean | YES | false | - |
| is_resolved | boolean | YES | false | - |
| attachments | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.proposal_line_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| proposal_id | character varying | NO | - | - |
| line_number | integer | NO | - | - |
| item_type | character varying | NO | - | - |
| product_id | character varying | YES | - | - |
| product_name | character varying | NO | - | - |
| description | text | YES | - | - |
| quantity | integer | YES | 1 | - |
| unit_price | numeric | NO | - | - |
| unit_cost | numeric | YES | - | - |
| total_price | numeric | NO | - | - |
| service_frequency | character varying | YES | - | - |
| service_duration | character varying | YES | - | - |
| equipment_condition | character varying | YES | - | - |
| warranty_info | text | YES | - | - |
| is_optional | boolean | YES | false | - |
| is_alternative | boolean | YES | false | - |
| package_id | character varying | YES | - | - |
| specifications | jsonb | YES | - | - |
| alternative_options | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.proposal_templates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| template_name | character varying | NO | - | - |
| template_type | character varying | NO | - | - |
| description | text | YES | - | - |
| header_content | jsonb | YES | - | - |
| cover_page_template | text | YES | - | - |
| executive_summary_template | text | YES | - | - |
| proposal_body_template | text | YES | - | - |
| terms_conditions_template | text | YES | - | - |
| footer_template | text | YES | - | - |
| branding_colors | jsonb | YES | - | - |
| font_settings | jsonb | YES | - | - |
| is_active | boolean | YES | true | - |
| is_default | boolean | YES | false | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.proposals

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| proposal_number | character varying | NO | - | - |
| version | character varying | YES | '1.0'::character varying | - |
| title | character varying | NO | - | - |
| business_record_id | character varying | NO | - | - |
| contact_id | character varying | YES | - | - |
| created_by | character varying | NO | - | - |
| assigned_to | character varying | NO | - | - |
| team_id | character varying | YES | - | - |
| proposal_type | character varying | NO | - | - |
| description | text | YES | - | - |
| executive_summary | text | YES | - | - |
| company_introduction | text | YES | - | - |
| solution_overview | text | YES | - | - |
| terms_and_conditions | text | YES | - | - |
| investment_summary | text | YES | - | - |
| next_steps | text | YES | - | - |
| subtotal | numeric | YES | '0'::numeric | - |
| discount_amount | numeric | YES | '0'::numeric | - |
| discount_percentage | numeric | YES | '0'::numeric | - |
| tax_amount | numeric | YES | '0'::numeric | - |
| total_amount | numeric | YES | '0'::numeric | - |
| valid_until | timestamp without time zone | YES | - | - |
| estimated_start_date | timestamp without time zone | YES | - | - |
| estimated_end_date | timestamp without time zone | YES | - | - |
| status | character varying | YES | 'draft'::character varying | - |
| priority | character varying | YES | 'medium'::character varying | - |
| sent_at | timestamp without time zone | YES | - | - |
| viewed_at | timestamp without time zone | YES | - | - |
| accepted_at | timestamp without time zone | YES | - | - |
| rejected_at | timestamp without time zone | YES | - | - |
| open_count | integer | YES | 0 | - |
| last_opened_at | timestamp without time zone | YES | - | - |
| template_id | character varying | YES | - | - |
| custom_styling | jsonb | YES | - | - |
| internal_notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.prospecting_campaigns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying(255) | NO | - | - |
| campaign_name | character varying(255) | NO | - | - |
| campaign_type | character varying(100) | NO | - | - |
| campaign_description | text | YES | - | - |
| target_industry | character varying(255) | YES | - | - |
| target_company_size | character varying(100) | YES | - | - |
| target_job_titles | ARRAY | YES | - | - |
| status | character varying(50) | YES | 'active'::character varying | - |
| total_contacts | integer | YES | 0 | - |
| contacted_count | integer | YES | 0 | - |
| response_count | integer | YES | 0 | - |
| response_rate | numeric | YES | - | - |
| conversion_count | integer | YES | 0 | - |
| conversion_rate | numeric | YES | - | - |
| start_date | timestamp without time zone | YES | now() | - |
| end_date | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.purchase_orders

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| po_number | character varying | NO | - | - |
| vendor_id | character varying | NO | - | - |
| requested_by | character varying | NO | - | - |
| order_date | timestamp without time zone | NO | - | - |
| expected_date | timestamp without time zone | YES | - | - |
| description | text | YES | - | - |
| subtotal | numeric | NO | - | - |
| tax_amount | numeric | YES | 0 | - |
| shipping_amount | numeric | YES | 0 | - |
| total_amount | numeric | NO | - | - |
| status | character varying | NO | 'draft'::character varying | - |
| delivery_address | text | YES | - | - |
| special_instructions | text | YES | - | - |
| approved_by | character varying | YES | - | - |
| approved_date | timestamp without time zone | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.qb_customers

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('qb_customers_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| qb_id | character varying(255) | NO | - | - |
| name | character varying(255) | NO | - | - |
| company_name | character varying(255) | YES | - | - |
| email | character varying(255) | YES | - | - |
| phone | character varying(50) | YES | - | - |
| billing_address | jsonb | YES | - | - |
| shipping_address | jsonb | YES | - | - |
| balance | numeric | YES | 0 | - |
| credit_limit | numeric | YES | - | - |
| payment_terms | character varying(100) | YES | - | - |
| sync_token | character varying(50) | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.qb_invoices

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('qb_invoices_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| qb_id | character varying(255) | NO | - | - |
| doc_number | character varying(100) | YES | - | - |
| customer_ref | character varying(255) | YES | - | - |
| total_amount | numeric | YES | - | - |
| balance | numeric | YES | - | - |
| due_date | date | YES | - | - |
| txn_date | date | YES | - | - |
| email_status | character varying(50) | YES | - | - |
| print_status | character varying(50) | YES | - | - |
| private_note | text | YES | - | - |
| customer_memo | text | YES | - | - |
| sync_token | character varying(50) | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.qb_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('qb_items_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| qb_id | character varying(255) | NO | - | - |
| name | character varying(255) | NO | - | - |
| type | character varying(50) | YES | - | - |
| description | text | YES | - | - |
| unit_price | numeric | YES | - | - |
| quantity_on_hand | integer | YES | 0 | - |
| income_account_ref | character varying(255) | YES | - | - |
| expense_account_ref | character varying(255) | YES | - | - |
| asset_account_ref | character varying(255) | YES | - | - |
| sku | character varying(100) | YES | - | - |
| sync_token | character varying(50) | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.qb_vendors

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('qb_vendors_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| qb_id | character varying(255) | NO | - | - |
| name | character varying(255) | NO | - | - |
| company_name | character varying(255) | YES | - | - |
| email | character varying(255) | YES | - | - |
| phone | character varying(50) | YES | - | - |
| billing_address | jsonb | YES | - | - |
| account_number | character varying(100) | YES | - | - |
| balance | numeric | YES | 0 | - |
| payment_terms | character varying(100) | YES | - | - |
| sync_token | character varying(50) | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.quickbooks_integrations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('quickbooks_integrations_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| company_id | character varying(255) | YES | - | - |
| access_token_expires_at | timestamp without time zone | YES | - | - |
| refresh_token_expires_at | timestamp without time zone | YES | - | - |
| connected_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| last_sync_at | timestamp without time zone | YES | - | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.quote_line_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| quote_id | character varying | NO | - | - |
| description | character varying | NO | - | - |
| quantity | integer | NO | 1 | - |
| unit_price | numeric | NO | - | - |
| total_price | numeric | NO | - | - |
| item_type | character varying | NO | 'service'::character varying | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.quote_pricing

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| lead_id | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| quote_number | character varying | NO | - | - |
| blanket_gross_profit_percentage | numeric | YES | 10.00 | - |
| apply_blanket_to_all_items | boolean | YES | true | - |
| total_dealer_cost | numeric | NO | 0 | - |
| total_company_price | numeric | NO | 0 | - |
| total_sale_price | numeric | NO | 0 | - |
| total_gross_profit | numeric | NO | 0 | - |
| total_gross_profit_percentage | numeric | YES | 0 | - |
| status | character varying | NO | 'draft'::character varying | - |
| created_by | character varying | NO | - | - |
| approved_by | character varying | YES | - | - |
| approved_date | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.quote_pricing_line_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| quote_pricing_id | character varying | NO | - | - |
| line_number | integer | NO | - | - |
| product_id | character varying | NO | - | - |
| product_type | character varying | NO | - | - |
| description | text | YES | - | - |
| quantity | integer | YES | 1 | - |
| dealer_cost | numeric | YES | - | - |
| company_price | numeric | YES | - | - |
| sale_price | numeric | NO | - | - |
| gross_profit | numeric | YES | - | - |
| gross_profit_percentage | numeric | YES | - | - |
| use_blanket_pricing | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.quotes

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| lead_id | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| quote_number | character varying | NO | - | - |
| title | character varying | NO | - | - |
| total_amount | numeric | NO | - | - |
| status | character varying | NO | 'draft'::character varying | - |
| valid_until | timestamp without time zone | NO | - | - |
| sent_date | timestamp without time zone | YES | - | - |
| accepted_date | timestamp without time zone | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| terms | text | YES | - | - |
| notes | text | YES | - | - |

### public.regions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| name | character varying(100) | NO | - | - |
| code | character varying(20) | NO | - | - |
| description | text | YES | - | - |
| manager_id | character varying | YES | - | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.role_permissions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying(255) | NO | - | - |
| role_id | character varying(255) | NO | - | - |
| permission_id | character varying(255) | NO | - | - |
| effect | character varying(10) | NO | 'ALLOW'::character varying | - |
| conditions | jsonb | YES | '{}'::jsonb | - |
| granted_by | character varying(255) | NO | - | - |
| granted_at | timestamp with time zone | YES | now() | - |
| expires_at | timestamp with time zone | YES | - | - |
| is_active | boolean | NO | true | - |
| assignment_reason | text | YES | - | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.roles

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| name | character varying(50) | NO | - | - |
| code | character varying(30) | NO | - | - |
| department | character varying(30) | NO | - | - |
| level | integer | NO | 1 | - |
| description | character varying(255) | YES | - | - |
| permissions | jsonb | NO | '{}'::jsonb | - |
| created_at | timestamp without time zone | YES | now() | - |
| role_type | USER-DEFINED | YES | 'department_role'::role_type | - |
| can_access_all_tenants | boolean | YES | false | - |
| can_manage_users | boolean | YES | false | - |
| can_view_system_metrics | boolean | YES | false | - |
| is_system_role | boolean | YES | false | - |
| can_access_all_locations | boolean | YES | false | - |
| can_manage_company_users | boolean | YES | false | - |
| can_create_locations | boolean | YES | false | - |
| can_view_company_financials | boolean | YES | false | - |
| can_manage_regional_users | boolean | YES | false | - |
| can_view_regional_reports | boolean | YES | false | - |
| can_approve_regional_deals | boolean | YES | false | - |
| can_manage_location_users | boolean | YES | false | - |
| can_view_location_reports | boolean | YES | false | - |
| can_approve_location_deals | boolean | YES | false | - |
| can_manage_compliance | boolean | YES | false | - |
| can_manage_training | boolean | YES | false | - |
| can_manage_hr | boolean | YES | false | - |
| can_manage_it | boolean | YES | false | - |
| can_view_analytics | boolean | YES | false | - |
| can_manage_quality | boolean | YES | false | - |
| can_access_audit_logs | boolean | YES | false | - |
| can_manage_integrations | boolean | YES | false | - |

### public.sales_forecasts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| forecast_name | character varying | NO | - | - |
| forecast_type | character varying | NO | - | - |
| description | text | YES | - | - |
| start_date | timestamp without time zone | NO | - | - |
| end_date | timestamp without time zone | NO | - | - |
| revenue_target | numeric | NO | - | - |
| unit_target | integer | YES | - | - |
| deal_count_target | integer | YES | - | - |
| actual_revenue | numeric | YES | 0 | - |
| actual_units | integer | YES | 0 | - |
| actual_deals | integer | YES | 0 | - |
| pipeline_value | numeric | YES | 0 | - |
| weighted_pipeline_value | numeric | YES | 0 | - |
| probability_adjusted_revenue | numeric | YES | 0 | - |
| confidence_level | character varying | NO | - | - |
| confidence_percentage | integer | YES | 50 | - |
| conversion_rate | numeric | YES | 0 | - |
| average_deal_size | numeric | YES | 0 | - |
| sales_cycle_length | integer | YES | 30 | - |
| status | character varying | NO | 'draft'::character varying | - |
| achievement_percentage | numeric | YES | 0 | - |
| projected_revenue | numeric | YES | 0 | - |
| gap_to_target | numeric | YES | 0 | - |
| sales_territory | character varying | YES | - | - |
| sales_team | jsonb | YES | '[]'::jsonb | - |
| sales_manager | character varying | YES | - | - |
| forecast_notes | text | YES | - | - |
| assumptions | text | YES | - | - |
| risk_factors | text | YES | - | - |
| opportunities | text | YES | - | - |
| created_by | character varying | NO | - | - |
| updated_by | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| last_calculated | timestamp without time zone | YES | - | - |

### public.sales_quotas

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| quota_period_start | date | NO | - | - |
| quota_period_end | date | NO | - | - |
| quota_type | character varying | NO | - | - |
| employee_id | character varying | NO | - | - |
| department | character varying | YES | - | - |
| team_id | character varying | YES | - | - |
| territory | character varying | YES | - | - |
| quota_amount | numeric | NO | - | - |
| stretch_goal_amount | numeric | YES | - | - |
| minimum_threshold | numeric | YES | - | - |
| current_achievement | numeric | YES | 0 | - |
| achievement_percentage | numeric | YES | 0 | - |
| monthly_breakdown | jsonb | YES | - | - |
| product_category_breakdown | jsonb | YES | - | - |
| bonus_structure | jsonb | YES | - | - |
| penalty_structure | jsonb | YES | - | - |
| status | character varying | YES | 'active'::character varying | - |
| last_updated_date | date | YES | CURRENT_DATE | - |
| created_by | character varying | NO | - | - |
| approved_by | character varying | YES | - | - |
| approval_date | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.sales_representatives

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| employee_id | character varying | NO | - | - |
| user_id | character varying | YES | - | - |
| rep_name | character varying | NO | - | - |
| rep_email | character varying | YES | - | - |
| rep_phone | character varying | YES | - | - |
| manager_id | character varying | YES | - | - |
| team_id | character varying | YES | - | - |
| territory_assignment | jsonb | YES | - | - |
| account_assignments | jsonb | YES | - | - |
| primary_commission_structure_id | character varying | YES | - | - |
| override_commission_rates | jsonb | YES | - | - |
| quota_targets | jsonb | YES | - | - |
| current_month_sales | numeric | YES | 0 | - |
| current_quarter_sales | numeric | YES | 0 | - |
| current_year_sales | numeric | YES | 0 | - |
| quota_achievement_percentage | numeric | YES | 0 | - |
| commission_payment_method | character varying | YES | 'payroll'::character varying | - |
| tax_classification | character varying | YES | 'employee'::character varying | - |
| employment_status | character varying | YES | 'active'::character varying | - |
| hire_date | date | YES | - | - |
| termination_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.seo_pages

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | YES | - | - |
| path | character varying | NO | - | - |
| title | character varying | YES | - | - |
| description | text | YES | - | - |
| lastmod | timestamp without time zone | YES | now() | - |
| changefreq | character varying | YES | 'monthly'::character varying | - |
| priority | numeric | YES | 0.5 | - |
| include_in_sitemap | boolean | YES | true | - |
| schema_type | character varying | YES | - | - |
| schema_data | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.seo_settings

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | YES | - | - |
| site_name | character varying | YES | - | - |
| site_url | character varying | YES | - | - |
| default_title | character varying | YES | - | - |
| default_description | text | YES | - | - |
| default_og_image | character varying | YES | - | - |
| twitter_handle | character varying | YES | - | - |
| allow_ai_crawling | boolean | YES | true | - |
| sitemap_changefreq | character varying | YES | 'weekly'::character varying | - |
| sitemap_priority_default | numeric | YES | 0.5 | - |
| last_sitemap_generated_at | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.service_performance_metrics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| metric_date | date | NO | - | - |
| metric_period | character varying | NO | - | - |
| period_start | date | NO | - | - |
| period_end | date | NO | - | - |
| total_service_calls | integer | YES | 0 | - |
| emergency_calls | integer | YES | 0 | - |
| routine_maintenance | integer | YES | 0 | - |
| installations | integer | YES | 0 | - |
| repairs | integer | YES | 0 | - |
| average_response_time_minutes | numeric | YES | 0 | - |
| median_response_time_minutes | numeric | YES | 0 | - |
| first_call_resolution_rate | numeric | YES | 0 | - |
| total_technician_hours | numeric | YES | 0 | - |
| billable_hours | numeric | YES | 0 | - |
| travel_time_hours | numeric | YES | 0 | - |
| utilization_rate | numeric | YES | 0 | - |
| average_satisfaction_score | numeric | YES | 0 | - |
| nps_score | numeric | YES | 0 | - |
| complaint_count | integer | YES | 0 | - |
| escalation_count | integer | YES | 0 | - |
| total_service_revenue | numeric | YES | 0 | - |
| parts_revenue | numeric | YES | 0 | - |
| labor_revenue | numeric | YES | 0 | - |
| average_service_value | numeric | YES | 0 | - |
| jobs_completed_on_time | integer | YES | 0 | - |
| jobs_completed_late | integer | YES | 0 | - |
| rework_required | integer | YES | 0 | - |
| callbacks_within_30_days | integer | YES | 0 | - |
| devices_under_service | integer | YES | 0 | - |
| preventive_maintenance_completed | integer | YES | 0 | - |
| equipment_downtime_hours | numeric | YES | 0 | - |
| parts_accuracy_rate | numeric | YES | 0 | - |
| diagnostic_accuracy_rate | numeric | YES | 0 | - |
| documentation_completeness | numeric | YES | 0 | - |
| month_over_month_growth | numeric | YES | 0 | - |
| year_over_year_growth | numeric | YES | 0 | - |
| industry_benchmark_score | numeric | YES | 0 | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.service_products

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| product_code | character varying | NO | - | - |
| product_name | character varying | NO | - | - |
| category | character varying | YES | 'Service'::character varying | - |
| service_type | character varying | YES | - | - |
| pricing_level | character varying | YES | - | - |
| description | text | YES | - | - |
| summary | text | YES | - | - |
| note | text | YES | - | - |
| ea_notes | text | YES | - | - |
| related_products | text | YES | - | - |
| is_active | boolean | YES | true | - |
| available_for_all | boolean | YES | false | - |
| repost_edit | boolean | YES | false | - |
| sales_rep_credit | boolean | YES | true | - |
| funding | boolean | YES | true | - |
| lease | boolean | YES | false | - |
| payment_type | character varying | YES | - | - |
| new_active | boolean | YES | false | - |
| new_rep_price | numeric | YES | - | - |
| upgrade_active | boolean | YES | false | - |
| upgrade_rep_price | numeric | YES | - | - |
| lexmark_active | boolean | YES | false | - |
| lexmark_rep_price | numeric | YES | - | - |
| graphic_active | boolean | YES | false | - |
| graphic_rep_price | numeric | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.service_requests

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_portal_user_id | character varying | NO | - | - |
| business_record_id | character varying | NO | - | - |
| equipment_id | character varying | YES | - | - |
| request_type | character varying | NO | - | - |
| priority | character varying | YES | 'medium'::character varying | - |
| subject | character varying | NO | - | - |
| description | text | NO | - | - |
| status | character varying | YES | 'submitted'::character varying | - |
| equipment_make | character varying | YES | - | - |
| equipment_model | character varying | YES | - | - |
| equipment_serial | character varying | YES | - | - |
| meter_reading | integer | YES | - | - |
| preferred_contact_method | character varying | YES | 'email'::character varying | - |
| preferred_service_time | character varying | YES | - | - |
| urgency_reason | text | YES | - | - |
| attachments | jsonb | YES | - | - |
| assigned_technician_id | character varying | YES | - | - |
| scheduled_date | timestamp without time zone | YES | - | - |
| estimated_duration | integer | YES | - | - |
| resolution_notes | text | YES | - | - |
| completed_at | timestamp without time zone | YES | - | - |
| customer_satisfaction_rating | integer | YES | - | - |
| customer_feedback | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.service_templates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| template_name | character varying | NO | - | - |
| template_description | text | YES | - | - |
| service_type | character varying | NO | - | - |
| equipment_type | character varying | YES | - | - |
| estimated_duration_minutes | integer | YES | 60 | - |
| technician_level | character varying | YES | - | - |
| required_skills | jsonb | YES | - | - |
| required_parts | jsonb | YES | - | - |
| required_tools | jsonb | YES | - | - |
| pre_service_checklist | jsonb | YES | - | - |
| service_checklist | jsonb | YES | - | - |
| post_service_checklist | jsonb | YES | - | - |
| labor_cost | numeric | YES | - | - |
| materials_cost | numeric | YES | - | - |
| total_cost | numeric | YES | - | - |
| is_active | boolean | YES | true | - |
| is_default | boolean | YES | false | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.service_ticket_updates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| ticket_id | character varying | NO | - | - |
| update_type | character varying | NO | - | - |
| old_value | text | YES | - | - |
| new_value | text | YES | - | - |
| notes | text | YES | - | - |
| updated_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.service_tickets

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_id | character varying | NO | - | - |
| equipment_id | character varying | YES | - | - |
| ticket_number | character varying | NO | - | - |
| title | character varying | NO | - | - |
| description | text | YES | - | - |
| priority | character varying | NO | 'medium'::character varying | - |
| status | character varying | NO | 'open'::character varying | - |
| assigned_technician_id | character varying | YES | - | - |
| created_by | character varying | NO | - | - |
| resolved_at | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| scheduled_date | timestamp without time zone | YES | - | - |
| estimated_duration | integer | YES | - | - |
| customer_address | text | YES | - | - |
| customer_phone | character varying | YES | - | - |
| required_skills | ARRAY | YES | - | - |
| required_parts | ARRAY | YES | - | - |
| work_order_notes | text | YES | - | - |
| resolution_notes | text | YES | - | - |
| customer_signature | text | YES | - | - |
| parts_used | ARRAY | YES | - | - |
| labor_hours | numeric | YES | - | - |

### public.service_trend_analysis

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| trend_category | character varying | NO | - | - |
| analysis_date | date | NO | - | - |
| period_type | character varying | NO | - | - |
| current_value | numeric | NO | - | - |
| previous_value | numeric | YES | - | - |
| percentage_change | numeric | YES | - | - |
| trend_direction | character varying | YES | - | - |
| moving_average_7d | numeric | YES | - | - |
| moving_average_30d | numeric | YES | - | - |
| seasonal_adjustment | numeric | YES | - | - |
| variance | numeric | YES | - | - |
| forecasted_next_period | numeric | YES | - | - |
| forecast_confidence | numeric | YES | - | - |
| forecast_range_min | numeric | YES | - | - |
| forecast_range_max | numeric | YES | - | - |
| contributing_factors | jsonb | YES | - | - |
| external_influences | jsonb | YES | - | - |
| threshold_breach | boolean | YES | false | - |
| alert_level | character varying | YES | - | - |
| threshold_value | numeric | YES | - | - |
| trend_insights | text | YES | - | - |
| recommended_actions | jsonb | YES | - | - |
| impact_assessment | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.sessions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| sid | character varying | NO | - | - |
| sess | jsonb | NO | - | - |
| expire | timestamp without time zone | NO | - | - |

### public.social_media_cron_jobs

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| name | character varying | NO | - | - |
| description | text | YES | - | - |
| cron_expression | character varying | NO | - | - |
| is_active | boolean | YES | true | - |
| prompt_template | text | NO | - | - |
| target_platforms | jsonb | NO | - | - |
| webhook_url | character varying | NO | - | - |
| last_executed | timestamp without time zone | YES | - | - |
| next_execution | timestamp without time zone | YES | - | - |
| execution_count | integer | YES | 0 | - |
| failure_count | integer | YES | 0 | - |
| created_by | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.social_media_posts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| generation_type | character varying | NO | - | - |
| status | character varying | NO | 'draft'::character varying | - |
| claude_model | character varying | YES | 'claude-sonnet-4-20250514'::character varying | - |
| claude_prompt | text | YES | - | - |
| claude_response | jsonb | YES | - | - |
| title | character varying | NO | - | - |
| short_content | text | NO | - | - |
| long_content | text | NO | - | - |
| website_link | character varying | YES | 'https://printyx.net'::character varying | - |
| scheduled_for | timestamp without time zone | YES | - | - |
| cron_expression | character varying | YES | - | - |
| is_recurring | boolean | YES | false | - |
| webhook_url | character varying | YES | - | - |
| webhook_payload | jsonb | YES | - | - |
| webhook_status | character varying | YES | - | - |
| webhook_sent_at | timestamp without time zone | YES | - | - |
| target_platforms | jsonb | YES | - | - |
| created_by | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.software_products

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| product_code | character varying | NO | - | - |
| product_name | character varying | NO | - | - |
| product_type | character varying | YES | - | - |
| category | character varying | YES | - | - |
| accessory_type | character varying | YES | - | - |
| description | text | YES | - | - |
| summary | text | YES | - | - |
| note | text | YES | - | - |
| ea_notes | text | YES | - | - |
| config_note | text | YES | - | - |
| related_products | text | YES | - | - |
| is_active | boolean | YES | true | - |
| available_for_all | boolean | YES | false | - |
| repost_edit | boolean | YES | false | - |
| sales_rep_credit | boolean | YES | true | - |
| funding | boolean | YES | true | - |
| lease | boolean | YES | false | - |
| payment_type | character varying | YES | - | - |
| standard_active | boolean | YES | false | - |
| standard_cost | numeric | YES | - | - |
| standard_rep_price | numeric | YES | - | - |
| new_active | boolean | YES | false | - |
| new_cost | numeric | YES | - | - |
| new_rep_price | numeric | YES | - | - |
| upgrade_active | boolean | YES | false | - |
| upgrade_cost | numeric | YES | - | - |
| upgrade_rep_price | numeric | YES | - | - |
| price_book_id | character varying | YES | - | - |
| temp_key | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| vendor | character varying | YES | - | Software vendor/manufacturer name |

### public.supplies

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| product_code | character varying | NO | - | - |
| product_name | character varying | NO | - | - |
| product_type | character varying | YES | 'Supplies'::character varying | - |
| dealer_comp | character varying | YES | - | - |
| inventory | character varying | YES | - | - |
| in_stock | character varying | YES | - | - |
| summary | text | YES | - | - |
| note | text | YES | - | - |
| ea_notes | text | YES | - | - |
| related_products | text | YES | - | - |
| is_active | boolean | YES | true | - |
| available_for_all | boolean | YES | false | - |
| repost_edit | boolean | YES | false | - |
| sales_rep_credit | boolean | YES | true | - |
| funding | boolean | YES | true | - |
| lease | boolean | YES | false | - |
| payment_type | character varying | YES | - | - |
| new_active | boolean | YES | false | - |
| new_rep_price | numeric | YES | - | - |
| upgrade_active | boolean | YES | false | - |
| upgrade_rep_price | numeric | YES | - | - |
| lexmark_active | boolean | YES | false | - |
| lexmark_rep_price | numeric | YES | - | - |
| graphic_active | boolean | YES | false | - |
| graphic_rep_price | numeric | YES | - | - |
| price_book_id | character varying | YES | - | - |
| temp_key | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.supply_order_items

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| supply_order_id | character varying | NO | - | - |
| product_type | character varying | NO | - | - |
| product_id | character varying | YES | - | - |
| product_name | character varying | NO | - | - |
| product_code | character varying | YES | - | - |
| manufacturer | character varying | YES | - | - |
| model_compatibility | character varying | YES | - | - |
| quantity_requested | integer | NO | - | - |
| quantity_approved | integer | YES | - | - |
| quantity_shipped | integer | YES | - | - |
| quantity_delivered | integer | YES | - | - |
| unit_price | numeric | YES | - | - |
| line_total | numeric | YES | - | - |
| specifications | jsonb | YES | - | - |
| notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.supply_orders

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| customer_portal_user_id | character varying | NO | - | - |
| business_record_id | character varying | NO | - | - |
| order_number | character varying | NO | - | - |
| order_type | character varying | YES | 'supplies'::character varying | - |
| status | character varying | YES | 'pending'::character varying | - |
| priority | character varying | YES | 'standard'::character varying | - |
| delivery_method | character varying | YES | 'standard'::character varying | - |
| delivery_address | jsonb | YES | - | - |
| delivery_instructions | text | YES | - | - |
| requested_delivery_date | timestamp without time zone | YES | - | - |
| estimated_delivery_date | timestamp without time zone | YES | - | - |
| actual_delivery_date | timestamp without time zone | YES | - | - |
| subtotal | numeric | YES | 0 | - |
| tax_amount | numeric | YES | 0 | - |
| shipping_cost | numeric | YES | 0 | - |
| total_amount | numeric | YES | 0 | - |
| special_instructions | text | YES | - | - |
| purchase_order_number | character varying | YES | - | - |
| billing_address | jsonb | YES | - | - |
| payment_terms | character varying | YES | 'net_30'::character varying | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.system_integrations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| name | character varying(255) | NO | - | - |
| provider | character varying(100) | NO | - | - |
| type | character varying(50) | NO | - | - |
| status | character varying(50) | NO | 'inactive'::character varying | - |
| configuration | jsonb | YES | - | - |
| credentials | jsonb | YES | - | - |
| last_sync | timestamp without time zone | YES | - | - |
| error_message | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.system_permissions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying(255) | NO | - | - |
| name | character varying(255) | NO | - | - |
| code | character varying(100) | NO | - | - |
| description | text | YES | - | - |
| module | character varying(100) | NO | - | - |
| resource_type | character varying(100) | NO | - | - |
| action | character varying(100) | NO | - | - |
| scope_level | character varying(50) | NO | - | - |
| is_sensitive | boolean | NO | false | - |
| business_impact | character varying(50) | YES | 'MEDIUM'::character varying | - |
| compliance_tags | ARRAY | YES | '{}'::text[] | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.tasks

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| title | character varying | NO | - | - |
| description | text | YES | - | - |
| status | character varying | NO | 'todo'::character varying | - |
| priority | character varying | NO | 'medium'::character varying | - |
| assigned_to | character varying | YES | - | - |
| project_id | character varying | YES | - | - |
| due_date | timestamp without time zone | YES | - | - |
| completion_percentage | integer | YES | 0 | - |
| tags | ARRAY | YES | - | - |
| created_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.teams

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| name | character varying(100) | NO | - | - |
| department | character varying(30) | NO | - | - |
| manager_id | character varying | YES | - | - |
| parent_team_id | character varying | YES | - | - |
| is_active | boolean | YES | true | - |
| description | text | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| location_id | character varying | YES | - | - |

### public.technician_availability

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| date | timestamp without time zone | NO | - | - |
| start_time | character varying | NO | - | - |
| end_time | character varying | NO | - | - |
| is_booked | boolean | YES | false | - |
| ticket_id | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.technician_locations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| recorded_at | timestamp without time zone | NO | - | - |
| latitude | numeric | YES | - | - |
| longitude | numeric | YES | - | - |
| accuracy_meters | numeric | YES | - | - |
| altitude_meters | numeric | YES | - | - |
| speed_mph | numeric | YES | - | - |
| heading_degrees | numeric | YES | - | - |
| location_type | character varying | YES | - | - |
| work_order_id | character varying | YES | - | - |
| customer_id | character varying | YES | - | - |
| street_address | text | YES | - | - |
| city | character varying | YES | - | - |
| state | character varying | YES | - | - |
| zip_code | character varying | YES | - | - |
| device_battery_level | integer | YES | - | - |
| device_id | character varying | YES | - | - |
| app_version | character varying | YES | - | - |
| location_source | character varying | YES | 'gps'::character varying | - |
| is_accurate | boolean | YES | true | - |
| privacy_level | character varying | YES | 'business'::character varying | - |
| created_at | timestamp without time zone | YES | now() | - |

### public.technician_performance_analytics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| analysis_period_start | date | NO | - | - |
| analysis_period_end | date | NO | - | - |
| analysis_type | character varying | NO | - | - |
| total_jobs_completed | integer | YES | 0 | - |
| emergency_responses | integer | YES | 0 | - |
| routine_maintenance | integer | YES | 0 | - |
| installations_performed | integer | YES | 0 | - |
| total_work_hours | numeric | YES | 0 | - |
| billable_hours | numeric | YES | 0 | - |
| travel_hours | numeric | YES | 0 | - |
| overtime_hours | numeric | YES | 0 | - |
| average_job_completion_time | numeric | YES | 0 | - |
| first_time_fix_rate | numeric | YES | 0 | - |
| customer_satisfaction_avg | numeric | YES | 0 | - |
| revenue_generated | numeric | YES | 0 | - |
| parts_sales | numeric | YES | 0 | - |
| upsell_revenue | numeric | YES | 0 | - |
| revenue_per_hour | numeric | YES | 0 | - |
| rework_incidents | integer | YES | 0 | - |
| customer_complaints | integer | YES | 0 | - |
| safety_incidents | integer | YES | 0 | - |
| documentation_score | numeric | YES | 0 | - |
| productivity_score | numeric | YES | 0 | - |
| efficiency_ranking | integer | YES | - | - |
| improvement_trend | character varying | YES | - | - |
| certifications_earned | integer | YES | 0 | - |
| training_hours | numeric | YES | 0 | - |
| skill_assessment_score | numeric | YES | 0 | - |
| monthly_target_achievement | numeric | YES | 0 | - |
| annual_goal_progress | numeric | YES | 0 | - |
| bonus_eligibility | boolean | YES | false | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.technician_sessions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| service_ticket_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| check_in_time | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| check_out_time | timestamp without time zone | YES | - | - |
| gps_location | character varying | YES | - | - |
| session_status | character varying | YES | 'active'::character varying | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.technician_time_tracking

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| work_order_id | character varying | YES | - | - |
| time_entry_type | character varying | NO | - | - |
| timestamp_recorded | timestamp without time zone | NO | - | - |
| location_at_timestamp | jsonb | YES | - | - |
| location_accuracy_meters | numeric | YES | - | - |
| time_category | character varying | NO | - | - |
| activity_description | text | YES | - | - |
| duration_minutes | integer | YES | - | - |
| billable_minutes | integer | YES | - | - |
| overtime_minutes | integer | YES | 0 | - |
| customer_id | character varying | YES | - | - |
| job_code | character varying | YES | - | - |
| project_id | character varying | YES | - | - |
| verification_method | character varying | YES | 'gps'::character varying | - |
| verification_photo_url | character varying | YES | - | - |
| supervisor_approval_required | boolean | YES | false | - |
| supervisor_approved_by | character varying | YES | - | - |
| supervisor_approved_at | timestamp without time zone | YES | - | - |
| exception_reason | character varying | YES | - | - |
| adjustment_minutes | integer | YES | 0 | - |
| adjustment_reason | text | YES | - | - |
| adjusted_by | character varying | YES | - | - |
| adjusted_at | timestamp without time zone | YES | - | - |
| device_id | character varying | YES | - | - |
| app_version | character varying | YES | - | - |
| network_quality | character varying | YES | - | - |
| offline_recorded | boolean | YES | false | - |
| sync_status | character varying | YES | 'synced'::character varying | - |
| sync_conflicts | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.technicians

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| user_id | character varying | NO | - | - |
| employee_id | character varying | YES | - | - |
| skills | ARRAY | YES | - | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| first_name | character varying | NO | - | - |
| last_name | character varying | NO | - | - |
| email | character varying | NO | - | - |
| phone | character varying | YES | - | - |
| certifications | ARRAY | YES | - | - |
| current_location | text | YES | - | - |
| is_available | boolean | YES | true | - |
| working_hours | text | YES | - | - |
| hourly_rate | numeric | YES | - | - |

### public.tenant_catalog_settings

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | uuid | NO | - | - |
| auto_enable_new_products | boolean | YES | false | - |
| default_markup_percentage | numeric | YES | 25.00 | - |
| require_approval_for_enablement | boolean | YES | false | - |
| import_tracking_enabled | boolean | YES | true | - |
| last_catalog_sync | timestamp without time zone | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.tenants

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | (gen_random_uuid())::text | - |
| name | character varying | NO | - | - |
| slug | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.ticket_parts_requests

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| service_ticket_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| part_number | character varying | NO | - | - |
| part_description | text | YES | - | - |
| quantity | integer | NO | - | - |
| estimated_cost | numeric | YES | - | - |
| vendor_id | character varying | YES | - | - |
| status | character varying | YES | 'pending'::character varying | - |
| requested_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| approved_at | timestamp without time zone | YES | - | - |
| approved_by | character varying | YES | - | - |
| rejected_reason | text | YES | - | - |
| expected_delivery_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.user_location_assignments

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| user_id | character varying | NO | - | - |
| location_id | character varying | NO | - | - |
| access_type | character varying(20) | YES | 'full'::character varying | - |
| assigned_by | character varying | NO | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.user_role_assignments

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying(255) | NO | - | - |
| user_id | character varying(255) | NO | - | - |
| role_id | character varying(255) | NO | - | - |
| tenant_id | character varying(255) | NO | - | - |
| organizational_unit_id | character varying(255) | YES | - | - |
| assigned_by | character varying(255) | NO | - | - |
| assignment_reason | text | YES | - | - |
| is_active | boolean | NO | true | - |
| effective_from | timestamp with time zone | NO | now() | - |
| effective_until | timestamp with time zone | YES | - | - |
| territory_restrictions | jsonb | YES | '{}'::jsonb | - |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |

### public.user_settings

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | - | - |
| user_id | character varying | NO | - | - |
| tenant_id | character varying | NO | - | - |
| first_name | character varying | YES | - | - |
| last_name | character varying | YES | - | - |
| email | character varying | YES | - | - |
| phone | character varying | YES | - | - |
| job_title | character varying | YES | - | - |
| department | character varying | YES | - | - |
| bio | text | YES | - | - |
| avatar | character varying | YES | - | - |
| theme | character varying | YES | 'system'::character varying | - |
| language | character varying | YES | 'en'::character varying | - |
| timezone | character varying | YES | 'America/New_York'::character varying | - |
| date_format | character varying | YES | 'MM/dd/yyyy'::character varying | - |
| time_format | character varying | YES | '12'::character varying | - |
| currency | character varying | YES | 'USD'::character varying | - |
| notifications | jsonb | YES | '{"sms": false, "push": true, "email": true, "marketing": false}'::jsonb | - |
| accessibility | jsonb | YES | '{"fontSize": "medium", "colorBlind": "none", "highContrast": false, "screenReader": false, "soundEnabled": true, "reducedMotion": false, "voiceCommands": false, "keyboardNavigation": false}'::jsonb | - |
| two_factor_enabled | boolean | YES | false | - |
| two_factor_secret | character varying | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.users

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | YES | - | - |
| email | character varying | YES | - | - |
| first_name | character varying | YES | - | - |
| last_name | character varying | YES | - | - |
| profile_image_url | character varying | YES | - | - |
| role_id | character varying | YES | - | - |
| is_active | boolean | YES | true | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |
| team_id | character varying | YES | - | - |

### public.vendor_bills

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | nextval('vendor_bills_id_seq'::regclass) | - |
| tenant_id | character varying(255) | NO | - | - |
| vendor_ref | character varying(255) | YES | - | - |
| total_amount | numeric | YES | - | - |
| balance | numeric | YES | - | - |
| due_date | date | YES | - | - |
| txn_date | date | YES | - | - |
| private_note | text | YES | - | - |
| status | character varying(50) | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.voice_notes

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| technician_id | character varying | NO | - | - |
| work_order_id | character varying | YES | - | - |
| note_category | character varying | NO | - | - |
| audio_file_url | character varying | NO | - | - |
| audio_duration_seconds | integer | YES | - | - |
| audio_format | character varying | YES | 'mp3'::character varying | - |
| audio_file_size_mb | numeric | YES | - | - |
| transcription_text | text | YES | - | - |
| transcription_confidence | numeric | YES | - | - |
| transcription_status | character varying | YES | 'pending'::character varying | - |
| transcription_language | character varying | YES | 'en'::character varying | - |
| manual_transcription | text | YES | - | - |
| location_recorded | jsonb | YES | - | - |
| recorded_timestamp | timestamp without time zone | NO | - | - |
| note_title | character varying | YES | - | - |
| tags | jsonb | YES | - | - |
| sentiment_analysis | jsonb | YES | - | - |
| keywords_extracted | jsonb | YES | - | - |
| action_items_detected | jsonb | YES | - | - |
| urgency_level | character varying | YES | - | - |
| shared_with_supervisor | boolean | YES | false | - |
| shared_with_customer | boolean | YES | false | - |
| internal_only | boolean | YES | true | - |
| requires_follow_up | boolean | YES | false | - |
| contains_sensitive_info | boolean | YES | false | - |
| compliance_reviewed | boolean | YES | false | - |
| reviewed_by | character varying | YES | - | - |
| reviewed_at | timestamp without time zone | YES | - | - |
| device_id | character varying | YES | - | - |
| recording_quality | character varying | YES | - | - |
| background_noise_level | character varying | YES | - | - |
| backed_up | boolean | YES | false | - |
| backup_location | character varying | YES | - | - |
| retention_expiry_date | date | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.workflow_executions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| execution_id | character varying | NO | - | - |
| workflow_template_id | character varying | NO | - | - |
| execution_name | character varying | YES | - | - |
| triggered_by_user_id | character varying | YES | - | - |
| triggered_by_event | character varying | YES | - | - |
| trigger_data | jsonb | YES | - | - |
| context_data | jsonb | YES | - | - |
| input_parameters | jsonb | YES | - | - |
| status | character varying | YES | 'pending'::character varying | - |
| current_step_index | integer | YES | 0 | - |
| completed_steps | integer | YES | 0 | - |
| total_steps | integer | NO | - | - |
| started_at | timestamp without time zone | YES | - | - |
| completed_at | timestamp without time zone | YES | - | - |
| paused_at | timestamp without time zone | YES | - | - |
| execution_duration_minutes | numeric | YES | - | - |
| assigned_to | character varying | YES | - | - |
| pending_approval_from | character varying | YES | - | - |
| approval_status | character varying | YES | - | - |
| execution_results | jsonb | YES | - | - |
| final_output | jsonb | YES | - | - |
| error_details | jsonb | YES | - | - |
| progress_percentage | numeric | YES | 0 | - |
| last_activity_at | timestamp without time zone | YES | now() | - |
| next_action_due | timestamp without time zone | YES | - | - |
| priority | character varying | YES | 'medium'::character varying | - |
| scheduled_start | timestamp without time zone | YES | - | - |
| max_completion_time | timestamp without time zone | YES | - | - |
| alerts_sent | jsonb | YES | - | - |
| escalation_level | integer | YES | 0 | - |
| manual_interventions | integer | YES | 0 | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.workflow_step_executions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| workflow_execution_id | character varying | NO | - | - |
| step_index | integer | NO | - | - |
| step_name | character varying | NO | - | - |
| step_type | character varying | NO | - | - |
| step_config | jsonb | NO | - | - |
| input_data | jsonb | YES | - | - |
| expected_output | jsonb | YES | - | - |
| status | character varying | YES | 'pending'::character varying | - |
| started_at | timestamp without time zone | YES | - | - |
| completed_at | timestamp without time zone | YES | - | - |
| execution_time_seconds | numeric | YES | - | - |
| output_data | jsonb | YES | - | - |
| success | boolean | YES | - | - |
| error_message | text | YES | - | - |
| error_code | character varying | YES | - | - |
| attempt_number | integer | YES | 1 | - |
| max_attempts | integer | YES | 3 | - |
| retry_after | timestamp without time zone | YES | - | - |
| assigned_to | character varying | YES | - | - |
| completed_by | character varying | YES | - | - |
| manual_input | jsonb | YES | - | - |
| depends_on_steps | jsonb | YES | - | - |
| blocks_steps | jsonb | YES | - | - |
| requires_approval | boolean | YES | false | - |
| approval_request_sent_at | timestamp without time zone | YES | - | - |
| approved_by | character varying | YES | - | - |
| approval_notes | text | YES | - | - |
| external_system | character varying | YES | - | - |
| api_call_details | jsonb | YES | - | - |
| webhook_response | jsonb | YES | - | - |
| performance_metrics | jsonb | YES | - | - |
| resource_usage | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### public.workflow_steps

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| session_id | character varying | NO | - | - |
| step_name | character varying | NO | - | - |
| step_started | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| step_completed | timestamp without time zone | YES | - | - |
| step_data | jsonb | YES | - | - |
| notes | text | YES | - | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### public.workflow_templates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | character varying | NO | gen_random_uuid() | - |
| tenant_id | character varying | NO | - | - |
| template_name | character varying | NO | - | - |
| template_description | text | YES | - | - |
| template_category | character varying | NO | - | - |
| template_version | character varying | YES | '1.0'::character varying | - |
| workflow_steps | jsonb | NO | - | - |
| trigger_conditions | jsonb | NO | - | - |
| execution_rules | jsonb | YES | - | - |
| is_active | boolean | YES | true | - |
| auto_start | boolean | YES | true | - |
| requires_approval | boolean | YES | false | - |
| priority | character varying | YES | 'medium'::character varying | - |
| execution_delay_minutes | integer | YES | 0 | - |
| max_execution_time_hours | integer | YES | 24 | - |
| retry_attempts | integer | YES | 3 | - |
| retry_delay_minutes | integer | YES | 15 | - |
| default_assignee_id | character varying | YES | - | - |
| escalation_rules | jsonb | YES | - | - |
| notification_settings | jsonb | YES | - | - |
| required_integrations | jsonb | YES | - | - |
| prerequisite_workflows | jsonb | YES | - | - |
| success_criteria | jsonb | YES | - | - |
| failure_criteria | jsonb | YES | - | - |
| monitoring_enabled | boolean | YES | true | - |
| approval_required_steps | jsonb | YES | - | - |
| approver_roles | jsonb | YES | - | - |
| approval_timeout_hours | integer | YES | 48 | - |
| execution_count | integer | YES | 0 | - |
| success_count | integer | YES | 0 | - |
| failure_count | integer | YES | 0 | - |
| average_completion_time_minutes | numeric | YES | 0 | - |
| created_by | character varying | NO | - | - |
| is_system_template | boolean | YES | false | - |
| is_published | boolean | YES | false | - |
| tags | jsonb | YES | - | - |
| created_at | timestamp without time zone | YES | now() | - |
| updated_at | timestamp without time zone | YES | now() | - |

### realtime.messages

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| topic | text | NO | - | - |
| extension | text | NO | - | - |
| payload | jsonb | YES | - | - |
| event | text | YES | - | - |
| private | boolean | YES | false | - |
| updated_at | timestamp without time zone | NO | now() | - |
| inserted_at | timestamp without time zone | NO | now() | - |
| id | uuid | NO | gen_random_uuid() | - |

### realtime.schema_migrations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| version | bigint | NO | - | - |
| inserted_at | timestamp without time zone | YES | - | - |

### realtime.subscription

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NO | - | - |
| subscription_id | uuid | NO | - | - |
| entity | regclass | NO | - | - |
| filters | ARRAY | NO | '{}'::realtime.user_defined_filter[] | - |
| claims | jsonb | NO | - | - |
| claims_role | regrole | NO | - | - |
| created_at | timestamp without time zone | NO | timezone('utc'::text, now()) | - |

### storage.buckets

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | text | NO | - | - |
| name | text | NO | - | - |
| owner | uuid | YES | - | Field is deprecated, use owner_id instead |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |
| public | boolean | YES | false | - |
| avif_autodetection | boolean | YES | false | - |
| file_size_limit | bigint | YES | - | - |
| allowed_mime_types | ARRAY | YES | - | - |
| owner_id | text | YES | - | - |

### storage.migrations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | - | - |
| name | character varying(100) | NO | - | - |
| hash | character varying(40) | NO | - | - |
| executed_at | timestamp without time zone | YES | CURRENT_TIMESTAMP | - |

### storage.objects

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| bucket_id | text | YES | - | - |
| name | text | YES | - | - |
| owner | uuid | YES | - | Field is deprecated, use owner_id instead |
| created_at | timestamp with time zone | YES | now() | - |
| updated_at | timestamp with time zone | YES | now() | - |
| last_accessed_at | timestamp with time zone | YES | now() | - |
| metadata | jsonb | YES | - | - |
| path_tokens | ARRAY | YES | - | - |
| version | text | YES | - | - |
| owner_id | text | YES | - | - |
| user_metadata | jsonb | YES | - | - |

### storage.s3_multipart_uploads

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | text | NO | - | - |
| in_progress_size | bigint | NO | 0 | - |
| upload_signature | text | NO | - | - |
| bucket_id | text | NO | - | - |
| key | text | NO | - | - |
| version | text | NO | - | - |
| owner_id | text | YES | - | - |
| created_at | timestamp with time zone | NO | now() | - |
| user_metadata | jsonb | YES | - | - |

### storage.s3_multipart_uploads_parts

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | - |
| upload_id | text | NO | - | - |
| size | bigint | NO | 0 | - |
| part_number | integer | NO | - | - |
| bucket_id | text | NO | - | - |
| key | text | NO | - | - |
| etag | text | NO | - | - |
| owner_id | text | YES | - | - |
| version | text | NO | - | - |
| created_at | timestamp with time zone | NO | now() | - |

