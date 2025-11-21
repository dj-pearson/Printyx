--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: customer_portal_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.customer_portal_status AS ENUM (
    'active',
    'inactive',
    'suspended',
    'pending_activation'
);


ALTER TYPE public.customer_portal_status OWNER TO neondb_owner;

--
-- Name: meter_submission_method; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.meter_submission_method AS ENUM (
    'manual_entry',
    'photo_upload',
    'email',
    'automated'
);


ALTER TYPE public.meter_submission_method OWNER TO neondb_owner;

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.notification_type AS ENUM (
    'service_update',
    'invoice_ready',
    'payment_due',
    'supply_low',
    'maintenance_reminder',
    'system_alert'
);


ALTER TYPE public.notification_type OWNER TO neondb_owner;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.payment_method AS ENUM (
    'credit_card',
    'ach',
    'wire_transfer',
    'check',
    'auto_pay'
);


ALTER TYPE public.payment_method OWNER TO neondb_owner;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded',
    'partially_paid'
);


ALTER TYPE public.payment_status OWNER TO neondb_owner;

--
-- Name: role_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.role_type AS ENUM (
    'platform_admin',
    'company_admin',
    'department_role'
);


ALTER TYPE public.role_type OWNER TO neondb_owner;

--
-- Name: service_request_priority; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.service_request_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent',
    'emergency'
);


ALTER TYPE public.service_request_priority OWNER TO neondb_owner;

--
-- Name: service_request_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.service_request_status AS ENUM (
    'submitted',
    'acknowledged',
    'assigned',
    'in_progress',
    'on_hold',
    'completed',
    'cancelled'
);


ALTER TYPE public.service_request_status OWNER TO neondb_owner;

--
-- Name: service_request_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.service_request_type AS ENUM (
    'maintenance',
    'repair',
    'installation',
    'training',
    'supplies',
    'technical_support',
    'other'
);


ALTER TYPE public.service_request_type OWNER TO neondb_owner;

--
-- Name: supply_order_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.supply_order_status AS ENUM (
    'draft',
    'submitted',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
);


ALTER TYPE public.supply_order_status OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts_payable; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.accounts_payable (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    vendor_id character varying NOT NULL,
    bill_number character varying NOT NULL,
    purchase_order_number character varying,
    reference_number character varying,
    bill_date timestamp without time zone NOT NULL,
    due_date timestamp without time zone NOT NULL,
    description text,
    subtotal numeric(12,2) NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0,
    balance_amount numeric(12,2) NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    priority character varying DEFAULT 'normal'::character varying,
    category character varying,
    department character varying,
    payment_method character varying,
    payment_date timestamp without time zone,
    check_number character varying,
    approved_by character varying,
    approved_date timestamp without time zone,
    approval_notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.accounts_payable OWNER TO neondb_owner;

--
-- Name: accounts_receivable; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.accounts_receivable (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    customer_ref character varying(255),
    invoice_ref character varying(255),
    amount numeric(10,2),
    balance numeric(10,2),
    due_date date,
    status character varying(50),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.accounts_receivable OWNER TO neondb_owner;

--
-- Name: accounts_receivable_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.accounts_receivable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accounts_receivable_id_seq OWNER TO neondb_owner;

--
-- Name: accounts_receivable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.accounts_receivable_id_seq OWNED BY public.accounts_receivable.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.audit_logs (
    id character varying NOT NULL,
    user_id character varying,
    action character varying,
    table_name character varying,
    record_id character varying,
    old_values jsonb,
    new_values jsonb,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address character varying,
    user_agent text,
    tenant_id character varying
);


ALTER TABLE public.audit_logs OWNER TO neondb_owner;

--
-- Name: automated_tasks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.automated_tasks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    task_title character varying NOT NULL,
    task_description text,
    task_type character varying NOT NULL,
    task_category character varying NOT NULL,
    created_by_workflow_id character varying,
    created_by_rule_id character varying,
    automation_trigger character varying,
    priority character varying DEFAULT 'medium'::character varying,
    urgency_score integer DEFAULT 5,
    estimated_duration_minutes integer,
    complexity_level character varying DEFAULT 'medium'::character varying,
    assigned_to character varying,
    assigned_team character varying,
    assignment_method character varying DEFAULT 'auto'::character varying,
    assignment_criteria jsonb,
    due_date date,
    due_time time without time zone,
    start_after timestamp without time zone,
    must_complete_by timestamp without time zone,
    status character varying DEFAULT 'pending'::character varying,
    progress_percentage numeric(5,2) DEFAULT 0,
    last_activity timestamp without time zone DEFAULT now(),
    depends_on_tasks jsonb,
    blocks_tasks jsonb,
    related_entity_type character varying,
    related_entity_id character varying,
    task_data jsonb,
    input_requirements jsonb,
    output_expectations jsonb,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    actual_duration_minutes numeric(8,2),
    completion_quality_score numeric(3,2),
    completion_notes text,
    task_results jsonb,
    customer_satisfaction integer,
    escalation_level integer DEFAULT 0,
    escalated_to character varying,
    escalation_reason text,
    follow_up_required boolean DEFAULT false,
    follow_up_date date,
    requires_review boolean DEFAULT false,
    reviewed_by character varying,
    review_status character varying,
    review_comments text,
    reminder_schedule jsonb,
    last_reminder_sent timestamp without time zone,
    notification_preferences jsonb,
    sla_compliance boolean,
    efficiency_score numeric(5,2),
    rework_required boolean DEFAULT false,
    rework_reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.automated_tasks OWNER TO neondb_owner;

--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.automation_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    rule_name character varying NOT NULL,
    rule_description text,
    rule_category character varying NOT NULL,
    trigger_events jsonb NOT NULL,
    conditions jsonb NOT NULL,
    condition_logic character varying DEFAULT 'AND'::character varying,
    actions jsonb NOT NULL,
    action_sequence character varying DEFAULT 'sequential'::character varying,
    delay_before_action integer DEFAULT 0,
    execution_window jsonb,
    cooldown_period integer DEFAULT 0,
    priority integer DEFAULT 5,
    is_critical boolean DEFAULT false,
    bypass_business_hours boolean DEFAULT false,
    applies_to_entities jsonb,
    entity_filters jsonb,
    department_scope jsonb,
    max_executions_per_day integer,
    max_executions_per_hour integer,
    max_concurrent_executions integer DEFAULT 1,
    requires_approval boolean DEFAULT false,
    approved_by character varying,
    approval_date date,
    governance_notes text,
    execution_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    last_executed timestamp without time zone,
    last_success timestamp without time zone,
    is_active boolean DEFAULT true,
    is_test_mode boolean DEFAULT false,
    effective_from date,
    effective_until date,
    depends_on_rules jsonb,
    conflicts_with_rules jsonb,
    average_execution_time_ms numeric(10,2),
    error_rate numeric(5,4),
    impact_score numeric(5,2),
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.automation_rules OWNER TO neondb_owner;

--
-- Name: billing_adjustments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.billing_adjustments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    invoice_id character varying,
    customer_id character varying,
    business_record_id character varying,
    adjustment_type character varying NOT NULL,
    adjustment_reason character varying NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying DEFAULT 'USD'::character varying,
    status character varying DEFAULT 'pending'::character varying,
    requested_by character varying NOT NULL,
    approved_by character varying,
    approval_date timestamp without time zone,
    rejection_reason text,
    applied_date timestamp without time zone,
    reversal_id character varying,
    description text,
    supporting_documents jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.billing_adjustments OWNER TO neondb_owner;

--
-- Name: billing_configurations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.billing_configurations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    configuration_name character varying NOT NULL,
    billing_type character varying NOT NULL,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    billing_frequency character varying DEFAULT 'monthly'::character varying,
    billing_day integer DEFAULT 1,
    base_rate numeric(10,2) DEFAULT 0,
    minimum_charge numeric(10,2) DEFAULT 0,
    maximum_charge numeric(10,2),
    usage_tiers jsonb,
    overage_rate numeric(10,4) DEFAULT 0,
    setup_fee numeric(10,2) DEFAULT 0,
    maintenance_fee numeric(10,2) DEFAULT 0,
    contract_length_months integer,
    early_termination_fee numeric(10,2),
    currency character varying DEFAULT 'USD'::character varying,
    tax_rate numeric(5,4) DEFAULT 0,
    tax_inclusive boolean DEFAULT false,
    applicable_equipment_types jsonb,
    applicable_service_types jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.billing_configurations OWNER TO neondb_owner;

--
-- Name: billing_cycles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.billing_cycles (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    cycle_name character varying NOT NULL,
    cycle_date date NOT NULL,
    status character varying DEFAULT 'pending'::character varying,
    total_customers integer DEFAULT 0,
    processed_customers integer DEFAULT 0,
    failed_customers integer DEFAULT 0,
    total_invoices_generated integer DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    processing_duration_seconds integer,
    error_count integer DEFAULT 0,
    error_details jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.billing_cycles OWNER TO neondb_owner;

--
-- Name: billing_invoices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.billing_invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying,
    business_record_id character varying,
    invoice_number character varying NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    billing_period_start date NOT NULL,
    billing_period_end date NOT NULL,
    status character varying DEFAULT 'draft'::character varying,
    subtotal numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    paid_amount numeric(12,2) DEFAULT 0,
    balance_due numeric(12,2) DEFAULT 0,
    currency character varying DEFAULT 'USD'::character varying,
    payment_terms character varying DEFAULT 'net_30'::character varying,
    billing_configuration_id character varying,
    notes text,
    purchase_order_number character varying,
    auto_generated boolean DEFAULT false,
    billing_cycle_id character varying,
    payment_method character varying,
    payment_date date,
    payment_reference character varying,
    dispute_reason text,
    dispute_date date,
    dispute_resolved_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.billing_invoices OWNER TO neondb_owner;

--
-- Name: billing_line_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.billing_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    invoice_id character varying NOT NULL,
    line_number integer NOT NULL,
    item_type character varying NOT NULL,
    product_id character varying,
    equipment_id character varying,
    service_id character varying,
    description text NOT NULL,
    unit_of_measure character varying DEFAULT 'each'::character varying,
    quantity numeric(10,3) DEFAULT 1,
    unit_price numeric(10,4) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    meter_start_reading integer,
    meter_end_reading integer,
    usage_amount integer,
    service_period_start date,
    service_period_end date,
    taxable boolean DEFAULT true,
    tax_rate numeric(5,4) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    discount_percentage numeric(5,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    adjustment_reason character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.billing_line_items OWNER TO neondb_owner;

--
-- Name: budget_vs_actual; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.budget_vs_actual (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    comparison_name character varying NOT NULL,
    budget_period date NOT NULL,
    category character varying NOT NULL,
    subcategory character varying,
    budgeted_amount numeric(15,2) NOT NULL,
    actual_amount numeric(15,2) DEFAULT 0,
    variance_amount numeric(15,2) DEFAULT 0,
    variance_percentage numeric(5,2) DEFAULT 0,
    variance_type character varying,
    variance_explanation text,
    corrective_actions text,
    ytd_budget numeric(15,2) DEFAULT 0,
    ytd_actual numeric(15,2) DEFAULT 0,
    forecast_revision numeric(15,2) DEFAULT 0,
    responsible_department character varying,
    responsible_manager character varying,
    follow_up_required boolean DEFAULT false,
    follow_up_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.budget_vs_actual OWNER TO neondb_owner;

--
-- Name: business_intelligence_dashboards; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.business_intelligence_dashboards (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    dashboard_name character varying NOT NULL,
    dashboard_type character varying NOT NULL,
    category character varying NOT NULL,
    dashboard_config jsonb NOT NULL,
    widget_configurations jsonb,
    data_sources jsonb,
    owner_id character varying NOT NULL,
    visibility character varying DEFAULT 'private'::character varying,
    authorized_roles jsonb,
    authorized_users jsonb,
    layout_type character varying DEFAULT 'grid'::character varying,
    refresh_interval integer DEFAULT 300,
    auto_refresh boolean DEFAULT true,
    default_filters jsonb,
    parameter_definitions jsonb,
    drill_down_enabled boolean DEFAULT true,
    cache_duration integer DEFAULT 900,
    last_generated timestamp without time zone,
    generation_time_ms integer,
    query_performance_stats jsonb,
    view_count integer DEFAULT 0,
    last_viewed timestamp without time zone,
    average_session_duration integer,
    most_used_widgets jsonb,
    alert_configurations jsonb,
    notification_settings jsonb,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    maintenance_mode boolean DEFAULT false,
    deprecation_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.business_intelligence_dashboards OWNER TO neondb_owner;

--
-- Name: business_record_activities; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.business_record_activities (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    business_record_id character varying NOT NULL,
    activity_type character varying NOT NULL,
    subject character varying NOT NULL,
    description text,
    direction character varying,
    email_from character varying,
    email_to text,
    email_cc text,
    email_subject character varying,
    email_body text,
    is_shared boolean DEFAULT false,
    call_duration integer,
    call_outcome character varying,
    scheduled_date timestamp without time zone,
    completed_date timestamp without time zone,
    due_date timestamp without time zone,
    outcome character varying,
    next_action text,
    follow_up_date timestamp without time zone,
    related_records jsonb,
    attachments jsonb,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.business_record_activities OWNER TO neondb_owner;

--
-- Name: business_records; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.business_records (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    record_type character varying DEFAULT 'lead'::character varying NOT NULL,
    status character varying DEFAULT 'new'::character varying NOT NULL,
    company_name character varying NOT NULL,
    website character varying,
    industry character varying,
    company_size character varying,
    annual_revenue numeric(15,2),
    primary_contact_name character varying,
    primary_contact_email character varying,
    primary_contact_phone character varying,
    billing_contact_name character varying,
    billing_contact_email character varying,
    billing_contact_phone character varying,
    address_line1 character varying,
    address_line2 character varying,
    city character varying,
    state character varying,
    postal_code character varying,
    country character varying DEFAULT 'US'::character varying,
    source character varying,
    interest_level character varying,
    customer_since timestamp without time zone,
    account_manager_id character varying,
    billing_terms character varying,
    credit_limit numeric(15,2),
    tax_exempt boolean DEFAULT false,
    customer_tier character varying,
    last_contact_date timestamp without time zone,
    next_follow_up_date timestamp without time zone,
    sales_stage character varying,
    estimated_deal_value numeric(15,2),
    deactivation_reason character varying,
    reactivation_date timestamp without time zone,
    churned_date timestamp without time zone,
    competitor_name character varying,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    external_customer_id character varying,
    external_system_id character varying,
    last_sync_date timestamp without time zone,
    customer_type character varying,
    primary_contact_title character varying,
    billing_address_1 character varying,
    billing_address_2 character varying,
    billing_city character varying,
    billing_state character varying,
    billing_zip_code character varying,
    phone character varying,
    fax character varying,
    assigned_sales_rep character varying,
    territory character varying,
    lead_score integer DEFAULT 0,
    priority character varying DEFAULT 'medium'::character varying,
    customer_number character varying,
    customer_until timestamp without time zone,
    payment_terms character varying,
    tax_id character varying,
    preferred_technician character varying,
    last_service_date timestamp without time zone,
    next_scheduled_service timestamp without time zone,
    last_invoice_date timestamp without time zone,
    last_payment_date timestamp without time zone,
    current_balance numeric(10,2) DEFAULT 0,
    last_meter_reading_date timestamp without time zone,
    next_meter_reading_date timestamp without time zone,
    probability integer DEFAULT 50,
    close_date timestamp without time zone,
    owner_id character varying,
    converted_by character varying,
    deactivated_by character varying,
    notes text,
    external_salesforce_id character varying,
    external_lead_id character varying,
    migration_status character varying,
    external_data jsonb,
    account_number character varying,
    account_type character varying,
    customer_rating character varying,
    parent_account_id character varying,
    customer_priority character varying,
    sla_level character varying,
    upsell_opportunity character varying,
    account_notes text,
    employee_count integer,
    preferred_contact_method character varying,
    is_active boolean DEFAULT true
);


ALTER TABLE public.business_records OWNER TO neondb_owner;

--
-- Name: cash_flow_projections; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.cash_flow_projections (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    projection_name character varying NOT NULL,
    projection_period date NOT NULL,
    beginning_cash numeric(15,2) DEFAULT 0,
    collections_forecast numeric(15,2) DEFAULT 0,
    other_income numeric(15,2) DEFAULT 0,
    total_cash_inflow numeric(15,2) DEFAULT 0,
    payroll_expenses numeric(15,2) DEFAULT 0,
    operating_expenses numeric(15,2) DEFAULT 0,
    equipment_purchases numeric(15,2) DEFAULT 0,
    loan_payments numeric(15,2) DEFAULT 0,
    tax_payments numeric(15,2) DEFAULT 0,
    other_expenses numeric(15,2) DEFAULT 0,
    total_cash_outflow numeric(15,2) DEFAULT 0,
    net_cash_flow numeric(15,2) DEFAULT 0,
    ending_cash numeric(15,2) DEFAULT 0,
    minimum_cash_required numeric(15,2) DEFAULT 0,
    cash_shortage_risk boolean DEFAULT false,
    days_cash_on_hand integer DEFAULT 0,
    assumptions text,
    risk_factors text,
    status character varying DEFAULT 'draft'::character varying,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.cash_flow_projections OWNER TO neondb_owner;

--
-- Name: commission_analytics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.commission_analytics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    analytics_period character varying NOT NULL,
    period_type character varying NOT NULL,
    period_start_date date NOT NULL,
    period_end_date date NOT NULL,
    sales_rep_id character varying NOT NULL,
    sales_rep_name character varying NOT NULL,
    total_sales_amount numeric(12,2) DEFAULT 0,
    total_deals_closed integer DEFAULT 0,
    average_deal_size numeric(10,2) DEFAULT 0,
    quota_target numeric(12,2) DEFAULT 0,
    quota_achievement_percentage numeric(5,2) DEFAULT 0,
    gross_commission_earned numeric(10,2) DEFAULT 0,
    commission_adjustments numeric(10,2) DEFAULT 0,
    commission_clawbacks numeric(10,2) DEFAULT 0,
    net_commission_earned numeric(10,2) DEFAULT 0,
    average_commission_rate numeric(5,4) DEFAULT 0,
    sales_rank_in_team integer,
    sales_rank_in_company integer,
    commission_rank_in_team integer,
    commission_rank_in_company integer,
    hardware_sales numeric(12,2) DEFAULT 0,
    software_sales numeric(12,2) DEFAULT 0,
    services_sales numeric(12,2) DEFAULT 0,
    supplies_sales numeric(12,2) DEFAULT 0,
    maintenance_sales numeric(12,2) DEFAULT 0,
    hardware_commission numeric(10,2) DEFAULT 0,
    software_commission numeric(10,2) DEFAULT 0,
    services_commission numeric(10,2) DEFAULT 0,
    supplies_commission numeric(10,2) DEFAULT 0,
    maintenance_commission numeric(10,2) DEFAULT 0,
    customer_satisfaction_score numeric(3,2) DEFAULT 0,
    deal_close_rate numeric(5,2) DEFAULT 0,
    average_sales_cycle_days integer DEFAULT 0,
    volume_bonuses_earned numeric(10,2) DEFAULT 0,
    quota_bonuses_earned numeric(10,2) DEFAULT 0,
    special_incentives_earned numeric(10,2) DEFAULT 0,
    total_bonuses_earned numeric(10,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.commission_analytics OWNER TO neondb_owner;

--
-- Name: commission_calculations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.commission_calculations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    calculation_period_start date NOT NULL,
    calculation_period_end date NOT NULL,
    calculation_run_date timestamp without time zone DEFAULT now(),
    employee_id character varying NOT NULL,
    commission_structure_id character varying NOT NULL,
    total_sales_amount numeric(12,2) DEFAULT 0,
    total_gross_profit numeric(12,2) DEFAULT 0,
    total_net_profit numeric(12,2) DEFAULT 0,
    total_units_sold integer DEFAULT 0,
    commission_base_amount numeric(12,2) DEFAULT 0,
    base_commission_rate numeric(5,4) DEFAULT 0,
    base_commission_amount numeric(10,2) DEFAULT 0,
    tier_commission_amount numeric(10,2) DEFAULT 0,
    performance_bonus_amount numeric(10,2) DEFAULT 0,
    team_bonus_amount numeric(10,2) DEFAULT 0,
    gross_commission_amount numeric(10,2) DEFAULT 0,
    adjustments numeric(10,2) DEFAULT 0,
    net_commission_amount numeric(10,2) DEFAULT 0,
    payment_status character varying DEFAULT 'pending'::character varying,
    payment_due_date date,
    payment_date date,
    payment_reference character varying,
    commission_breakdown jsonb,
    performance_metrics jsonb,
    calculated_by character varying NOT NULL,
    approved_by character varying,
    approval_date timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.commission_calculations OWNER TO neondb_owner;

--
-- Name: commission_disputes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.commission_disputes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    dispute_number character varying NOT NULL,
    dispute_type character varying NOT NULL,
    employee_id character varying NOT NULL,
    commission_calculation_id character varying,
    sale_id character varying,
    payment_id character varying,
    dispute_amount numeric(10,2),
    claimed_amount numeric(10,2),
    description text NOT NULL,
    supporting_documentation jsonb,
    status character varying DEFAULT 'open'::character varying,
    priority character varying DEFAULT 'medium'::character varying,
    dispute_date date NOT NULL,
    response_due_date date,
    resolution_date date,
    assigned_to character varying,
    resolution_type character varying,
    resolution_amount numeric(10,2),
    resolution_notes text,
    adjustment_required boolean DEFAULT false,
    recalculation_required boolean DEFAULT false,
    policy_update_required boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.commission_disputes OWNER TO neondb_owner;

--
-- Name: commission_payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.commission_payments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    payment_batch_id character varying,
    payment_date date NOT NULL,
    payment_period_start date NOT NULL,
    payment_period_end date NOT NULL,
    employee_id character varying NOT NULL,
    gross_commission_amount numeric(10,2) NOT NULL,
    tax_withholding numeric(10,2) DEFAULT 0,
    other_deductions numeric(10,2) DEFAULT 0,
    net_payment_amount numeric(10,2) NOT NULL,
    payment_method character varying DEFAULT 'payroll'::character varying,
    payment_reference character varying,
    payment_account character varying,
    calculation_ids jsonb,
    payment_status character varying DEFAULT 'scheduled'::character varying,
    processing_date timestamp without time zone,
    completion_date timestamp without time zone,
    bank_reference character varying,
    reconciled boolean DEFAULT false,
    reconciliation_date date,
    payment_notes text,
    adjustment_reason text,
    adjustment_amount numeric(10,2) DEFAULT 0,
    created_by character varying NOT NULL,
    approved_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.commission_payments OWNER TO neondb_owner;

--
-- Name: commission_sales_data; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.commission_sales_data (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    sale_id character varying NOT NULL,
    sale_date date NOT NULL,
    invoice_id character varying,
    primary_sales_rep_id character varying NOT NULL,
    secondary_sales_reps jsonb,
    sales_manager_id character varying,
    customer_id character varying,
    business_record_id character varying,
    product_category character varying,
    product_type character varying,
    sale_amount numeric(12,2) NOT NULL,
    cost_of_goods numeric(12,2) DEFAULT 0,
    gross_profit numeric(12,2) DEFAULT 0,
    net_profit numeric(12,2) DEFAULT 0,
    commission_eligible boolean DEFAULT true,
    commission_percentage numeric(5,4),
    commission_amount numeric(10,2),
    commission_split jsonb,
    commission_override_reason text,
    override_amount numeric(10,2),
    payment_status character varying DEFAULT 'pending_invoice'::character varying,
    collection_date date,
    quota_contribution numeric(12,2) DEFAULT 0,
    performance_period character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.commission_sales_data OWNER TO neondb_owner;

--
-- Name: commission_structures; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.commission_structures (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    structure_name character varying NOT NULL,
    structure_type character varying NOT NULL,
    applies_to character varying NOT NULL,
    role_types jsonb,
    product_categories jsonb,
    base_rate numeric(5,4) DEFAULT 0,
    tier_definitions jsonb,
    calculation_basis character varying DEFAULT 'revenue'::character varying,
    minimum_threshold numeric(12,2) DEFAULT 0,
    maximum_cap numeric(12,2),
    calculation_period character varying DEFAULT 'monthly'::character varying,
    payment_delay_days integer DEFAULT 30,
    performance_multipliers jsonb,
    team_performance_factor numeric(4,3) DEFAULT 1.0,
    is_active boolean DEFAULT true,
    effective_date date NOT NULL,
    expiration_date date,
    created_by character varying NOT NULL,
    approved_by character varying,
    approval_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tier_thresholds jsonb,
    tier_rates jsonb,
    volume_bonuses jsonb,
    quota_bonuses jsonb,
    special_incentives jsonb,
    requires_payment_received boolean DEFAULT true,
    clawback_period_days integer DEFAULT 90,
    split_rules jsonb,
    minimum_payout_amount numeric(10,2) DEFAULT 0,
    payment_schedule character varying DEFAULT 'monthly'::character varying
);


ALTER TABLE public.commission_structures OWNER TO neondb_owner;

--
-- Name: commission_transactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.commission_transactions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    transaction_type character varying NOT NULL,
    reference_number character varying,
    sales_rep_id character varying NOT NULL,
    sales_rep_name character varying NOT NULL,
    customer_id character varying,
    customer_name character varying,
    deal_id character varying,
    sale_amount numeric(12,2) NOT NULL,
    commission_rate numeric(5,4) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    product_category character varying,
    product_details jsonb,
    commission_structure_id character varying,
    commission_structure_name character varying,
    calculation_method character varying,
    sale_date date NOT NULL,
    commission_period character varying NOT NULL,
    commission_status character varying DEFAULT 'pending'::character varying,
    payment_status character varying DEFAULT 'unpaid'::character varying,
    requires_approval boolean DEFAULT false,
    approved_by character varying,
    approved_at timestamp without time zone,
    approval_notes text,
    payment_date date,
    payment_amount numeric(10,2),
    payment_method character varying,
    payment_reference character varying,
    is_clawback_eligible boolean DEFAULT true,
    clawback_expiry_date date,
    clawed_back_amount numeric(10,2) DEFAULT 0,
    clawback_reason text,
    adjustment_reason text,
    original_transaction_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.commission_transactions OWNER TO neondb_owner;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    business_name character varying(255) NOT NULL,
    parent_company character varying(255),
    business_type character varying(100),
    industry character varying(100),
    website character varying(255),
    phone character varying(50),
    email character varying(255),
    business_address text,
    billing_address text,
    shipping_address text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    business_record_type character varying(255) DEFAULT 'Customer'::character varying,
    customer_number character varying(255),
    business_site character varying(255),
    parent_business character varying(255),
    activity character varying(255),
    description text,
    fax character varying(255),
    next_call_back timestamp without time zone,
    billing_city character varying(255),
    billing_state character varying(255),
    billing_zip character varying(255),
    shipping_city character varying(255),
    shipping_state character varying(255),
    shipping_zip character varying(255),
    customer_since timestamp without time zone,
    employees integer,
    annual_revenue numeric(12,2),
    number_of_locations integer,
    sic_code character varying(255),
    product_services_interest text,
    number_of_steps_rights integer,
    special_delivery_instructions text,
    tax_state character varying(255),
    elevator character varying(255),
    created_by character varying(255),
    business_owner character varying(255),
    last_modified_by character varying(255)
);


ALTER TABLE public.companies OWNER TO neondb_owner;

--
-- Name: company_contacts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.company_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    company_id character varying NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    title character varying(100),
    email character varying(255),
    phone character varying(50),
    mobile character varying(50),
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    salutation character varying(50),
    department character varying(100),
    reports_to character varying(255),
    contact_roles text,
    is_primary_contact boolean DEFAULT false,
    assistant character varying(255),
    assistant_phone character varying(50),
    other_phone character varying(50),
    home_phone character varying(50),
    fax character varying(50),
    birthdate timestamp without time zone,
    mailing_address text,
    mailing_city character varying(100),
    mailing_state character varying(50),
    mailing_zip character varying(20),
    other_address text,
    other_city character varying(100),
    other_state character varying(50),
    other_zip character varying(20),
    lead_status character varying DEFAULT 'new'::character varying,
    last_contact_date timestamp without time zone,
    next_follow_up_date timestamp without time zone,
    owner_id character varying,
    favorite_content_type character varying,
    preferred_channels text
);


ALTER TABLE public.company_contacts OWNER TO neondb_owner;

--
-- Name: company_pricing_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.company_pricing_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    default_markup_percentage numeric(5,2) DEFAULT 20.00 NOT NULL,
    allow_salesperson_override boolean DEFAULT true,
    minimum_gross_profit_percentage numeric(5,2) DEFAULT 5.00,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.company_pricing_settings OWNER TO neondb_owner;

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.contracts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    contract_number character varying NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    black_rate numeric(10,4),
    color_rate numeric(10,4),
    monthly_base numeric(10,2),
    status character varying DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.contracts OWNER TO neondb_owner;

--
-- Name: cpc_rates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.cpc_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    model_id uuid NOT NULL,
    color_type character varying NOT NULL,
    volume_tier character varying NOT NULL,
    rate numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.cpc_rates OWNER TO neondb_owner;

--
-- Name: customer_activities; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_activities (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    activity_type character varying NOT NULL,
    subject character varying NOT NULL,
    description text,
    direction character varying,
    email_from character varying,
    email_to text,
    email_cc text,
    email_subject character varying,
    email_body text,
    is_shared boolean DEFAULT false,
    call_duration integer,
    call_outcome character varying,
    scheduled_date timestamp without time zone,
    completed_date timestamp without time zone,
    due_date timestamp without time zone,
    outcome character varying,
    next_action text,
    follow_up_date timestamp without time zone,
    related_records jsonb,
    attachments jsonb,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_activities OWNER TO neondb_owner;

--
-- Name: customer_contacts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_contacts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    title character varying,
    department character varying,
    phone character varying,
    email character varying,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_contacts OWNER TO neondb_owner;

--
-- Name: customer_equipment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_equipment (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    business_record_id character varying NOT NULL,
    equipment_name character varying NOT NULL,
    make character varying,
    model character varying,
    serial_number character varying,
    asset_tag character varying,
    location character varying,
    department character varying,
    installed_date timestamp without time zone,
    service_contract_type character varying,
    contract_start_date timestamp without time zone,
    contract_end_date timestamp without time zone,
    service_level character varying,
    current_meter_reading integer,
    last_service_date timestamp without time zone,
    next_service_due timestamp without time zone,
    status character varying DEFAULT 'active'::character varying,
    specifications jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_equipment OWNER TO neondb_owner;

--
-- Name: customer_interactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_interactions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying,
    lead_id character varying,
    interaction_type character varying NOT NULL,
    subject character varying NOT NULL,
    description text,
    outcome character varying,
    next_action text,
    scheduled_date timestamp without time zone,
    completed_date timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_interactions OWNER TO neondb_owner;

--
-- Name: customer_meter_submissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_meter_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    customer_portal_user_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    equipment_serial_number character varying(100) NOT NULL,
    total_impressions integer,
    black_white_impressions integer,
    color_impressions integer,
    large_format_impressions integer,
    scan_impressions integer,
    fax_impressions integer,
    submission_method public.meter_submission_method NOT NULL,
    reading_date timestamp without time zone NOT NULL,
    submission_date timestamp without time zone DEFAULT now() NOT NULL,
    photo_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_validated boolean DEFAULT false NOT NULL,
    validated_by uuid,
    validated_at timestamp without time zone,
    validation_notes text,
    is_billed boolean DEFAULT false NOT NULL,
    billing_date timestamp without time zone,
    invoice_id uuid,
    customer_notes text,
    internal_notes text
);


ALTER TABLE public.customer_meter_submissions OWNER TO neondb_owner;

--
-- Name: customer_notifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    customer_portal_user_id uuid,
    type public.notification_type NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    is_email_sent boolean DEFAULT false NOT NULL,
    email_sent_at timestamp without time zone,
    is_sms_capable boolean DEFAULT false NOT NULL,
    is_sms_sent boolean DEFAULT false NOT NULL,
    sms_sent_at timestamp without time zone,
    is_portal_read boolean DEFAULT false NOT NULL,
    portal_read_at timestamp without time zone,
    related_service_request_id uuid,
    related_invoice_id uuid,
    related_payment_id uuid,
    related_supply_order_id uuid,
    priority character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    scheduled_send_at timestamp without time zone,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    sent_at timestamp without time zone
);


ALTER TABLE public.customer_notifications OWNER TO neondb_owner;

--
-- Name: customer_number_config; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_number_config (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    prefix character varying(10) DEFAULT 'CUST'::character varying NOT NULL,
    current_sequence integer DEFAULT 1000 NOT NULL,
    sequence_length integer DEFAULT 4 NOT NULL,
    separator_char character varying(1) DEFAULT '-'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_number_config OWNER TO neondb_owner;

--
-- Name: customer_number_history; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_number_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    customer_number character varying NOT NULL,
    config_id character varying NOT NULL,
    generated_at timestamp without time zone DEFAULT now(),
    generated_by character varying
);


ALTER TABLE public.customer_number_history OWNER TO neondb_owner;

--
-- Name: customer_payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    customer_portal_user_id uuid,
    payment_number character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    invoice_id uuid,
    invoice_number character varying(100),
    transaction_id character varying(255),
    processor_name character varying(100),
    processor_response jsonb,
    payment_method_details jsonb,
    payment_date timestamp without time zone DEFAULT now() NOT NULL,
    processed_at timestamp without time zone,
    customer_notes text,
    internal_notes text,
    failure_reason text,
    retry_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp without time zone
);


ALTER TABLE public.customer_payments OWNER TO neondb_owner;

--
-- Name: customer_portal_access; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_portal_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    status public.customer_portal_status DEFAULT 'pending_activation'::public.customer_portal_status NOT NULL,
    is_email_verified boolean DEFAULT false NOT NULL,
    email_verification_token character varying(255),
    password_reset_token character varying(255),
    password_reset_expires timestamp without time zone,
    last_login_at timestamp without time zone,
    session_token character varying(255),
    session_expires timestamp without time zone,
    permissions jsonb DEFAULT '{"canMakePayments": true, "canViewInvoices": true, "canOrderSupplies": true, "canViewServiceHistory": true, "canSubmitMeterReadings": true, "canSubmitServiceRequests": true}'::jsonb NOT NULL,
    preferences jsonb DEFAULT '{"language": "en", "timezone": "America/New_York", "smsNotifications": false, "emailNotifications": true}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.customer_portal_access OWNER TO neondb_owner;

--
-- Name: customer_portal_activity_log; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_portal_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    customer_portal_user_id uuid,
    action character varying(100) NOT NULL,
    description text,
    ip_address character varying(45),
    user_agent text,
    related_record_type character varying(50),
    related_record_id uuid,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_portal_activity_log OWNER TO neondb_owner;

--
-- Name: customer_related_records; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_related_records (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    record_type character varying NOT NULL,
    record_id character varying NOT NULL,
    record_title character varying,
    record_count integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.customer_related_records OWNER TO neondb_owner;

--
-- Name: customer_service_requests; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_service_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    customer_portal_user_id uuid NOT NULL,
    request_number character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    type public.service_request_type NOT NULL,
    priority public.service_request_priority DEFAULT 'normal'::public.service_request_priority NOT NULL,
    status public.service_request_status DEFAULT 'submitted'::public.service_request_status NOT NULL,
    equipment_id uuid,
    equipment_serial_number character varying(100),
    equipment_model character varying(100),
    equipment_location character varying(255),
    contact_name character varying(100) NOT NULL,
    contact_phone character varying(20),
    contact_email character varying(255),
    preferred_date timestamp without time zone,
    preferred_time character varying(50),
    urgency_notes text,
    assigned_technician_id uuid,
    service_ticket_id uuid,
    estimated_completion_date timestamp without time zone,
    actual_completion_date timestamp without time zone,
    customer_notes text,
    internal_notes text,
    resolution_notes text,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    customer_rating integer,
    customer_feedback text,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    acknowledged_at timestamp without time zone,
    completed_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_service_requests OWNER TO neondb_owner;

--
-- Name: customer_supply_order_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_supply_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_sku character varying(100) NOT NULL,
    product_name character varying(255) NOT NULL,
    product_description text,
    compatible_equipment_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    in_stock boolean DEFAULT true NOT NULL,
    estimated_ship_date timestamp without time zone,
    customer_notes text
);


ALTER TABLE public.customer_supply_order_items OWNER TO neondb_owner;

--
-- Name: customer_supply_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customer_supply_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    customer_portal_user_id uuid NOT NULL,
    order_number character varying(50) NOT NULL,
    status public.supply_order_status DEFAULT 'draft'::public.supply_order_status NOT NULL,
    delivery_address jsonb NOT NULL,
    delivery_instructions text,
    requested_delivery_date timestamp without time zone,
    actual_delivery_date timestamp without time zone,
    subtotal numeric(10,2) DEFAULT 0.00 NOT NULL,
    tax numeric(10,2) DEFAULT 0.00 NOT NULL,
    shipping numeric(10,2) DEFAULT 0.00 NOT NULL,
    total numeric(10,2) DEFAULT 0.00 NOT NULL,
    is_contract_covered boolean DEFAULT false NOT NULL,
    contract_id uuid,
    purchase_order_number character varying(100),
    tracking_number character varying(100),
    carrier character varying(50),
    shipped_at timestamp without time zone,
    customer_notes text,
    internal_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    submitted_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_supply_orders OWNER TO neondb_owner;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.customers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    company_id character varying NOT NULL,
    contact_id character varying NOT NULL,
    lead_source character varying DEFAULT 'website'::character varying NOT NULL,
    lead_status character varying DEFAULT 'customer'::character varying NOT NULL,
    estimated_amount numeric(10,2),
    probability integer DEFAULT 100,
    close_date timestamp without time zone,
    owner_id character varying,
    lead_score integer DEFAULT 0,
    priority character varying DEFAULT 'medium'::character varying,
    notes text,
    last_contact_date timestamp without time zone,
    next_follow_up_date timestamp without time zone,
    created_by character varying NOT NULL,
    preferred_technician character varying,
    last_service_date timestamp without time zone,
    next_scheduled_service timestamp without time zone,
    last_invoice_date timestamp without time zone,
    last_payment_date timestamp without time zone,
    current_balance numeric(10,2) DEFAULT 0,
    last_meter_reading_date timestamp without time zone,
    next_meter_reading_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    external_salesforce_id character varying(255),
    last_salesforce_sync timestamp without time zone
);


ALTER TABLE public.customers OWNER TO neondb_owner;

--
-- Name: deal_activities; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.deal_activities (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    deal_id character varying NOT NULL,
    user_id character varying NOT NULL,
    activity_type character varying DEFAULT 'stage_change'::character varying NOT NULL,
    title character varying,
    description text,
    activity_date timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    type character varying,
    subject character varying,
    duration integer,
    outcome character varying,
    previous_value text,
    new_value text
);


ALTER TABLE public.deal_activities OWNER TO neondb_owner;

--
-- Name: deal_stages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.deal_stages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    color character varying NOT NULL,
    sort_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_closing_stage boolean DEFAULT false NOT NULL,
    is_won_stage boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    requires_approval boolean DEFAULT false,
    auto_move_conditions jsonb
);


ALTER TABLE public.deal_stages OWNER TO neondb_owner;

--
-- Name: deals; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.deals (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    title character varying NOT NULL,
    description text,
    amount numeric(12,2),
    company_name character varying,
    primary_contact_name character varying,
    primary_contact_email character varying,
    primary_contact_phone character varying,
    source character varying,
    deal_type character varying,
    priority character varying DEFAULT 'medium'::character varying NOT NULL,
    expected_close_date timestamp without time zone,
    products_interested text,
    estimated_monthly_value numeric(12,2),
    notes text,
    status character varying DEFAULT 'open'::character varying NOT NULL,
    probability integer DEFAULT 0,
    stage_id character varying NOT NULL,
    owner_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    customer_id character varying,
    lost_reason character varying,
    last_activity_date timestamp without time zone,
    next_follow_up_date timestamp without time zone,
    created_by_id character varying,
    actual_close_date timestamp without time zone
);


ALTER TABLE public.deals OWNER TO neondb_owner;

--
-- Name: device_metrics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.device_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    metric_type character varying(50) NOT NULL,
    metric_value integer NOT NULL,
    collected_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.device_metrics OWNER TO neondb_owner;

--
-- Name: device_performance_trends; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.device_performance_trends (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    device_id character varying NOT NULL,
    analysis_period_start date NOT NULL,
    analysis_period_end date NOT NULL,
    analysis_type character varying NOT NULL,
    average_uptime_percentage numeric(5,2),
    total_pages_processed integer,
    average_processing_speed numeric(6,2),
    error_rate numeric(6,4),
    jam_rate numeric(6,4),
    peak_usage_hours jsonb,
    usage_pattern_type character varying,
    workload_distribution jsonb,
    energy_consumption numeric(10,2),
    supply_consumption_rate numeric(8,4),
    maintenance_frequency numeric(6,2),
    performance_trend character varying,
    trend_slope numeric(8,4),
    seasonality_detected boolean DEFAULT false,
    anomaly_count integer DEFAULT 0,
    reliability_score numeric(3,2),
    maintenance_prediction_accuracy numeric(3,2),
    failure_risk_score numeric(3,2),
    peer_performance_percentile numeric(3,0),
    industry_benchmark_comparison numeric(5,2),
    optimization_recommendations jsonb,
    maintenance_recommendations jsonb,
    upgrade_recommendations jsonb,
    data_points_analyzed integer,
    confidence_interval numeric(3,2),
    statistical_significance numeric(4,3),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.device_performance_trends OWNER TO neondb_owner;

--
-- Name: device_registrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.device_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    device_name character varying(100) NOT NULL,
    model character varying(100) NOT NULL,
    serial_number character varying(100) NOT NULL,
    device_id character varying(100),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    location character varying(100),
    installation_date date,
    last_seen timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.device_registrations OWNER TO neondb_owner;

--
-- Name: device_telemetry; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.device_telemetry (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    device_id character varying NOT NULL,
    recorded_at timestamp without time zone NOT NULL,
    data_type character varying NOT NULL,
    metric_name character varying NOT NULL,
    metric_value numeric(15,4),
    metric_unit character varying,
    string_value text,
    boolean_value boolean,
    event_source character varying,
    event_category character varying,
    severity_level character varying DEFAULT 'info'::character varying,
    raw_data jsonb,
    processed_data jsonb,
    data_quality_score numeric(3,2) DEFAULT 1.0,
    validation_status character varying DEFAULT 'valid'::character varying,
    validation_notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.device_telemetry OWNER TO neondb_owner;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.documents (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    document_number character varying NOT NULL,
    document_type character varying NOT NULL,
    agreement_number character varying,
    buyer_name character varying,
    buyer_address text,
    ship_to_name character varying,
    ship_to_address text,
    po_number character varying,
    order_date timestamp without time zone,
    line_items jsonb,
    include_service_contract boolean DEFAULT false,
    service_term integer,
    service_start_date timestamp without time zone,
    auto_renewal boolean DEFAULT false,
    minimum_black_prints integer,
    minimum_color_prints integer,
    black_rate numeric(10,4),
    color_rate numeric(10,4),
    monthly_base numeric(10,2),
    include_consumables boolean DEFAULT false,
    include_black_supplies boolean DEFAULT false,
    include_color_supplies boolean DEFAULT false,
    payment_terms character varying,
    warranty_terms text,
    special_terms text,
    authorized_signer_title character varying,
    customer_name character varying,
    status character varying DEFAULT 'draft'::character varying,
    created_by character varying NOT NULL,
    updated_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.documents OWNER TO neondb_owner;

--
-- Name: enabled_products; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.enabled_products (
    enabled_product_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    master_product_id uuid,
    source character varying(50) DEFAULT 'master_catalog'::character varying NOT NULL,
    enabled boolean DEFAULT true,
    custom_sku character varying(100),
    custom_name character varying(255),
    dealer_cost numeric(10,2),
    company_price numeric(10,2),
    markup_rule_id uuid,
    price_overridden boolean DEFAULT false,
    enabled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.enabled_products OWNER TO neondb_owner;

--
-- Name: enhanced_roles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.enhanced_roles (
    id character varying(255) NOT NULL,
    tenant_id character varying(255) NOT NULL,
    organizational_unit_id character varying(255),
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    hierarchy_level character varying(50) NOT NULL,
    department character varying(100) DEFAULT 'general'::character varying NOT NULL,
    organizational_tier character varying(50) DEFAULT 'COMPANY'::character varying NOT NULL,
    is_customizable boolean DEFAULT true NOT NULL,
    is_system_role boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    max_assignments integer,
    assignment_rules jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.enhanced_roles OWNER TO neondb_owner;

--
-- Name: enriched_companies; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.enriched_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    company_name character varying(255) NOT NULL,
    primary_industry character varying(255),
    secondary_industries text[],
    employee_count integer,
    annual_revenue bigint,
    company_stage character varying(100),
    headquarters_country character varying(100),
    headquarters_state character varying(100),
    headquarters_city character varying(100),
    website character varying(500),
    company_linkedin_url character varying(500),
    technology_stack text[],
    target_account_tier character varying(50),
    lead_score integer DEFAULT 0,
    enrichment_source character varying(50) NOT NULL,
    source_company_id character varying(255),
    last_enriched_date timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.enriched_companies OWNER TO neondb_owner;

--
-- Name: enriched_contacts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.enriched_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    first_name character varying(255),
    last_name character varying(255),
    full_name character varying(255),
    email character varying(255),
    phone character varying(50),
    job_title character varying(255),
    job_function character varying(255),
    management_level character varying(100),
    department character varying(255),
    seniority character varying(100),
    company_name character varying(255),
    company_linkedin_url character varying(500),
    person_linkedin_url character varying(500),
    twitter_username character varying(100),
    github_username character varying(100),
    facebook_url character varying(500),
    lead_score integer DEFAULT 0,
    prospecting_status character varying(50) DEFAULT 'new'::character varying,
    last_contact_date timestamp without time zone,
    next_follow_up_date timestamp without time zone,
    enrichment_source character varying(50) NOT NULL,
    source_person_id character varying(255),
    last_enriched_date timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.enriched_contacts OWNER TO neondb_owner;

--
-- Name: equipment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equipment (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    serial_number character varying NOT NULL,
    model character varying NOT NULL,
    manufacturer character varying NOT NULL,
    location character varying,
    install_date timestamp without time zone,
    black_meter integer DEFAULT 0,
    color_meter integer DEFAULT 0,
    last_meter_reading timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.equipment OWNER TO neondb_owner;

--
-- Name: equipment_asset_tracking; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equipment_asset_tracking (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    asset_tag character varying NOT NULL,
    equipment_id character varying NOT NULL,
    serial_number character varying NOT NULL,
    brand character varying NOT NULL,
    model character varying NOT NULL,
    equipment_type character varying NOT NULL,
    current_status character varying DEFAULT 'active'::character varying,
    current_location_type character varying,
    current_location_details text,
    customer_id character varying,
    business_record_id character varying,
    contract_id character varying,
    purchase_price numeric(12,2),
    current_book_value numeric(12,2),
    depreciation_method character varying DEFAULT 'straight_line'::character varying,
    depreciation_rate numeric(5,4),
    last_maintenance_date date,
    next_maintenance_due date,
    maintenance_interval_days integer DEFAULT 90,
    current_bw_count integer DEFAULT 0,
    current_color_count integer DEFAULT 0,
    last_meter_reading_date date,
    warranty_start_date date,
    warranty_end_date date,
    warranty_type character varying,
    support_contract_id character varying,
    installation_date date,
    activation_date date,
    retirement_date date,
    disposal_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.equipment_asset_tracking OWNER TO neondb_owner;

--
-- Name: equipment_delivery_schedules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equipment_delivery_schedules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    delivery_id character varying NOT NULL,
    purchase_order_id character varying,
    scheduled_date date NOT NULL,
    time_window_start time without time zone,
    time_window_end time without time zone,
    delivery_type character varying DEFAULT 'standard'::character varying,
    delivery_address text NOT NULL,
    contact_person character varying NOT NULL,
    contact_phone character varying NOT NULL,
    contact_email character varying,
    status character varying DEFAULT 'scheduled'::character varying,
    driver_name character varying,
    driver_phone character varying,
    vehicle_info character varying,
    departure_time timestamp without time zone,
    arrival_time timestamp without time zone,
    completion_time timestamp without time zone,
    delivery_notes text,
    customer_signature character varying,
    delivery_photo_urls jsonb,
    condition_on_delivery character varying DEFAULT 'good'::character varying,
    special_equipment_required boolean DEFAULT false,
    access_requirements text,
    delivery_instructions text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.equipment_delivery_schedules OWNER TO neondb_owner;

--
-- Name: equipment_installations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equipment_installations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    equipment_id character varying NOT NULL,
    delivery_id character varying,
    scheduled_date date NOT NULL,
    scheduled_time_start time without time zone,
    scheduled_time_end time without time zone,
    installation_location text NOT NULL,
    site_contact_person character varying,
    site_contact_phone character varying,
    power_requirements character varying,
    network_requirements character varying,
    space_requirements character varying,
    environmental_conditions text,
    lead_technician_id character varying NOT NULL,
    assistant_technicians jsonb,
    estimated_duration_hours numeric(4,2) DEFAULT 2.0,
    status character varying DEFAULT 'scheduled'::character varying,
    actual_start_time timestamp without time zone,
    actual_end_time timestamp without time zone,
    installation_notes text,
    configuration_settings jsonb,
    network_settings jsonb,
    functionality_tests jsonb,
    print_test_completed boolean DEFAULT false,
    network_test_completed boolean DEFAULT false,
    user_training_completed boolean DEFAULT false,
    installation_photos jsonb,
    user_manual_provided boolean DEFAULT false,
    warranty_registration_completed boolean DEFAULT false,
    customer_signature character varying,
    customer_satisfaction_rating integer,
    customer_feedback text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.equipment_installations OWNER TO neondb_owner;

--
-- Name: equipment_lifecycle_stages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equipment_lifecycle_stages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    equipment_id character varying NOT NULL,
    equipment_serial_number character varying,
    equipment_model character varying,
    equipment_brand character varying,
    current_stage character varying NOT NULL,
    stage_status character varying DEFAULT 'in_progress'::character varying,
    stage_started_at timestamp without time zone DEFAULT now(),
    stage_completed_at timestamp without time zone,
    estimated_completion_date date,
    actual_completion_date date,
    customer_id character varying,
    business_record_id character varying,
    delivery_address text,
    installation_location text,
    contact_person character varying,
    contact_phone character varying,
    purchase_order_number character varying,
    vendor_id character varying,
    warehouse_location character varying,
    delivery_tracking_number character varying,
    installation_technician_id character varying,
    installation_notes text,
    progress_percentage integer DEFAULT 0,
    last_activity_date date DEFAULT CURRENT_DATE,
    next_action_required character varying,
    assigned_to character varying,
    required_documents jsonb,
    completed_documents jsonb,
    compliance_checklist jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.equipment_lifecycle_stages OWNER TO neondb_owner;

--
-- Name: equipment_packages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equipment_packages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    package_name character varying NOT NULL,
    package_code character varying,
    category character varying,
    description text,
    equipment jsonb,
    accessories jsonb,
    services jsonb,
    total_value numeric,
    discount_percentage numeric,
    margin_percentage numeric,
    is_active boolean DEFAULT true,
    allow_customization boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.equipment_packages OWNER TO neondb_owner;

--
-- Name: equipment_purchase_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equipment_purchase_orders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    po_number character varying NOT NULL,
    vendor_id character varying,
    vendor_name character varying,
    order_date date NOT NULL,
    requested_delivery_date date,
    confirmed_delivery_date date,
    subtotal numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    shipping_cost numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    status character varying DEFAULT 'draft'::character varying,
    tracking_number character varying,
    customer_id character varying,
    business_record_id character varying,
    delivery_address text,
    special_instructions text,
    requested_by character varying NOT NULL,
    approved_by character varying,
    approval_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.equipment_purchase_orders OWNER TO neondb_owner;

--
-- Name: equipment_status_monitoring; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.equipment_status_monitoring (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    equipment_id character varying NOT NULL,
    device_id character varying NOT NULL,
    status_timestamp timestamp without time zone NOT NULL,
    operational_status character varying NOT NULL,
    power_status character varying,
    connectivity_status character varying,
    current_job_count integer DEFAULT 0,
    total_page_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    toner_levels jsonb,
    paper_levels jsonb,
    temperature numeric(5,2),
    humidity numeric(5,2),
    ambient_light integer,
    pages_printed_today integer DEFAULT 0,
    pages_printed_month integer DEFAULT 0,
    average_job_size numeric(8,2),
    peak_usage_time time without time zone,
    drum_life_remaining integer,
    fuser_life_remaining integer,
    transfer_belt_remaining integer,
    waste_toner_level integer,
    print_speed_current numeric(6,2),
    print_quality_score numeric(3,2),
    jam_frequency numeric(6,4),
    uptime_percentage numeric(5,2),
    active_alerts jsonb,
    alert_count integer DEFAULT 0,
    critical_alerts integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.equipment_status_monitoring OWNER TO neondb_owner;

--
-- Name: field_technicians; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.field_technicians (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    employee_id character varying NOT NULL,
    user_id character varying,
    technician_name character varying NOT NULL,
    technician_email character varying,
    technician_phone character varying,
    device_id character varying,
    device_type character varying,
    device_model character varying,
    app_version character varying,
    last_sync_timestamp timestamp without time zone,
    assigned_territory jsonb,
    home_base_location jsonb,
    current_location jsonb,
    location_accuracy_meters numeric(8,2),
    location_updated_at timestamp without time zone,
    skill_categories jsonb,
    certifications jsonb,
    equipment_authorizations jsonb,
    security_clearance_level character varying,
    work_schedule jsonb,
    availability_status character varying DEFAULT 'available'::character varying,
    shift_start_time time without time zone,
    shift_end_time time without time zone,
    overtime_approved boolean DEFAULT false,
    jobs_completed_today integer DEFAULT 0,
    jobs_completed_week integer DEFAULT 0,
    jobs_completed_month integer DEFAULT 0,
    average_job_duration_minutes numeric(8,2) DEFAULT 0,
    customer_satisfaction_rating numeric(3,2) DEFAULT 0,
    first_time_fix_rate numeric(5,2) DEFAULT 0,
    offline_sync_enabled boolean DEFAULT true,
    gps_tracking_enabled boolean DEFAULT true,
    voice_notes_enabled boolean DEFAULT true,
    photo_upload_enabled boolean DEFAULT true,
    push_notifications_enabled boolean DEFAULT true,
    employment_status character varying DEFAULT 'active'::character varying,
    hire_date date,
    emergency_contact_info jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.field_technicians OWNER TO neondb_owner;

--
-- Name: field_work_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.field_work_orders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    work_order_number character varying NOT NULL,
    related_service_ticket_id character varying,
    work_order_type character varying NOT NULL,
    priority character varying DEFAULT 'medium'::character varying,
    customer_id character varying NOT NULL,
    customer_name character varying NOT NULL,
    service_location jsonb NOT NULL,
    site_contact_name character varying,
    site_contact_phone character varying,
    site_access_instructions text,
    safety_requirements jsonb,
    assigned_technician_id character varying,
    assigned_team_id character varying,
    assignment_method character varying DEFAULT 'automatic'::character varying,
    skill_requirements jsonb,
    estimated_duration_minutes integer,
    scheduled_date date,
    scheduled_time_start time without time zone,
    scheduled_time_end time without time zone,
    time_window_flexibility_minutes integer DEFAULT 30,
    required_equipment jsonb,
    required_parts jsonb,
    equipment_loaded jsonb,
    parts_loaded jsonb,
    work_description text NOT NULL,
    special_instructions text,
    customer_notes text,
    internal_notes text,
    status character varying DEFAULT 'created'::character varying,
    status_history jsonb,
    actual_start_time timestamp without time zone,
    actual_end_time timestamp without time zone,
    travel_time_minutes integer,
    on_site_time_minutes integer,
    total_duration_minutes integer,
    technician_arrival_location jsonb,
    technician_departure_location jsonb,
    gps_breadcrumb_trail jsonb,
    geofence_compliance boolean DEFAULT true,
    work_performed text,
    parts_used jsonb,
    completion_photos jsonb,
    completion_signature jsonb,
    customer_satisfaction_score integer,
    quality_checklist_completed boolean DEFAULT false,
    quality_checklist_data jsonb,
    safety_incidents jsonb,
    compliance_violations jsonb,
    follow_up_required boolean DEFAULT false,
    follow_up_date date,
    follow_up_notes text,
    warranty_provided jsonb,
    billable_hours numeric(5,2),
    labor_cost numeric(10,2),
    parts_cost numeric(10,2),
    travel_cost numeric(10,2),
    total_cost numeric(10,2),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.field_work_orders OWNER TO neondb_owner;

--
-- Name: financial_forecasts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.financial_forecasts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    forecast_name character varying NOT NULL,
    forecast_type character varying NOT NULL,
    forecast_period character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    base_amount numeric(15,2) DEFAULT 0,
    growth_rate numeric(5,4) DEFAULT 0,
    seasonality_factor numeric(5,4) DEFAULT 1.0,
    scenario_type character varying DEFAULT 'base'::character varying,
    confidence_level numeric(3,2) DEFAULT 0.75,
    calculation_method character varying DEFAULT 'linear'::character varying,
    data_sources jsonb,
    assumptions text,
    total_forecast_amount numeric(15,2) DEFAULT 0,
    variance_percentage numeric(5,2) DEFAULT 0,
    status character varying DEFAULT 'draft'::character varying,
    is_baseline boolean DEFAULT false,
    last_calculated_at timestamp without time zone,
    created_by character varying NOT NULL,
    approved_by character varying,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.financial_forecasts OWNER TO neondb_owner;

--
-- Name: financial_kpis; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.financial_kpis (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    kpi_name character varying NOT NULL,
    kpi_category character varying NOT NULL,
    calculation_period date NOT NULL,
    current_value numeric(15,4) NOT NULL,
    previous_value numeric(15,4) DEFAULT 0,
    target_value numeric(15,4) DEFAULT 0,
    trend_direction character varying,
    performance_vs_target character varying,
    percentage_change numeric(5,2) DEFAULT 0,
    calculation_formula text,
    data_sources jsonb,
    warning_threshold numeric(15,4),
    critical_threshold numeric(15,4),
    alert_triggered boolean DEFAULT false,
    industry_average numeric(15,4),
    peer_comparison character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.financial_kpis OWNER TO neondb_owner;

--
-- Name: forecast_line_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.forecast_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    forecast_id character varying NOT NULL,
    period_date date NOT NULL,
    line_item_type character varying NOT NULL,
    category character varying NOT NULL,
    subcategory character varying,
    forecasted_amount numeric(15,2) NOT NULL,
    actual_amount numeric(15,2) DEFAULT 0,
    variance_amount numeric(15,2) DEFAULT 0,
    variance_percentage numeric(5,2) DEFAULT 0,
    quantity_forecast numeric(10,2),
    unit_price_forecast numeric(10,2),
    calculation_notes text,
    source_data jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.forecast_line_items OWNER TO neondb_owner;

--
-- Name: forecast_metrics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.forecast_metrics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    forecast_id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    snapshot_date timestamp without time zone NOT NULL,
    total_pipeline_value numeric(12,2),
    weighted_pipeline_value numeric(12,2),
    commit_revenue numeric(12,2),
    best_case_revenue numeric(12,2),
    worst_case_revenue numeric(12,2),
    total_deals integer,
    new_deals integer,
    advanced_deals integer,
    closed_won_deals integer,
    closed_lost_deals integer,
    conversion_rate numeric(5,2),
    average_deal_size numeric(10,2),
    average_sales_cycle integer,
    velocity_score numeric(8,2),
    stage_distribution jsonb,
    pipeline_trend character varying,
    velocity_trend character varying,
    quality_trend character varying,
    territory_metrics jsonb,
    calculated_by character varying,
    calculated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.forecast_metrics OWNER TO neondb_owner;

--
-- Name: forecast_pipeline_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.forecast_pipeline_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    forecast_id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    business_record_id character varying NOT NULL,
    deal_name character varying NOT NULL,
    customer_name character varying NOT NULL,
    deal_value numeric(10,2) NOT NULL,
    weighted_value numeric(10,2),
    probability integer DEFAULT 50,
    expected_close_date timestamp without time zone,
    actual_close_date timestamp without time zone,
    days_in_pipeline integer,
    sales_stage character varying NOT NULL,
    stage_progress integer DEFAULT 0,
    next_milestone character varying,
    next_milestone_date timestamp without time zone,
    assigned_sales_rep character varying NOT NULL,
    sales_team character varying,
    product_category character varying,
    equipment_type character varying,
    service_type character varying,
    quantity integer DEFAULT 1,
    competitor_involved boolean DEFAULT false,
    primary_competitor character varying,
    competitive_advantage text,
    risk_level character varying DEFAULT 'medium'::character varying,
    risk_factors jsonb DEFAULT '[]'::jsonb,
    mitigation_strategies text,
    last_activity_date timestamp without time zone,
    next_activity_date timestamp without time zone,
    activity_count integer DEFAULT 0,
    outcome character varying,
    lost_reason character varying,
    actual_revenue numeric(10,2),
    included_in_forecast boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.forecast_pipeline_items OWNER TO neondb_owner;

--
-- Name: forecast_rules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.forecast_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    rule_name character varying NOT NULL,
    rule_type character varying NOT NULL,
    description text,
    conditions jsonb,
    actions jsonb,
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    frequency character varying DEFAULT 'daily'::character varying,
    last_executed timestamp without time zone,
    execution_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    created_by character varying NOT NULL,
    updated_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.forecast_rules OWNER TO neondb_owner;

--
-- Name: gl_accounts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.gl_accounts (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    qb_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    account_type character varying(100),
    account_sub_type character varying(100),
    classification character varying(100),
    account_code character varying(50),
    description text,
    balance numeric(15,2) DEFAULT 0,
    active boolean DEFAULT true,
    sync_token character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.gl_accounts OWNER TO neondb_owner;

--
-- Name: gl_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.gl_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gl_accounts_id_seq OWNER TO neondb_owner;

--
-- Name: gl_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.gl_accounts_id_seq OWNED BY public.gl_accounts.id;


--
-- Name: gps_tracking_points; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.gps_tracking_points (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    work_order_id character varying,
    session_id character varying,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    altitude_meters numeric(8,2),
    accuracy_meters numeric(8,2),
    speed_kmh numeric(6,2),
    heading_degrees numeric(6,2),
    activity_type character varying,
    movement_status character varying,
    battery_level integer,
    signal_strength integer,
    within_service_area boolean DEFAULT true,
    geofence_violations jsonb,
    nearest_landmark character varying,
    clock_in_out_event boolean DEFAULT false,
    break_start_end_event boolean DEFAULT false,
    work_start_end_event boolean DEFAULT false,
    data_source character varying DEFAULT 'mobile_app'::character varying,
    sync_status character varying DEFAULT 'synced'::character varying,
    offline_captured boolean DEFAULT false,
    recorded_at timestamp without time zone NOT NULL,
    synced_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.gps_tracking_points OWNER TO neondb_owner;

--
-- Name: integration_audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.integration_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid,
    device_id uuid,
    tenant_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    message text,
    details jsonb,
    response_time integer,
    error_code character varying(50),
    "timestamp" timestamp without time zone DEFAULT now()
);


ALTER TABLE public.integration_audit_logs OWNER TO neondb_owner;

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.inventory_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying NOT NULL,
    part_number character varying,
    category character varying NOT NULL,
    current_stock integer DEFAULT 0,
    reorder_point integer DEFAULT 0,
    unit_cost numeric(10,2),
    supplier character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.inventory_items OWNER TO neondb_owner;

--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoice_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    invoice_id character varying NOT NULL,
    equipment_id character varying NOT NULL,
    meter_reading_id character varying,
    description character varying NOT NULL,
    quantity integer DEFAULT 0,
    rate numeric(10,4) DEFAULT '0'::numeric,
    amount numeric(10,2) NOT NULL,
    line_type character varying DEFAULT 'meter'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.invoice_line_items OWNER TO neondb_owner;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    contract_id character varying NOT NULL,
    invoice_number character varying NOT NULL,
    billing_period_start timestamp without time zone NOT NULL,
    billing_period_end timestamp without time zone NOT NULL,
    monthly_base numeric(10,2) DEFAULT '0'::numeric,
    black_copies_total integer DEFAULT 0,
    color_copies_total integer DEFAULT 0,
    black_amount numeric(10,2) DEFAULT '0'::numeric,
    color_amount numeric(10,2) DEFAULT '0'::numeric,
    total_amount numeric(10,2) NOT NULL,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    due_date timestamp without time zone NOT NULL,
    paid_date timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.invoices OWNER TO neondb_owner;

--
-- Name: iot_devices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.iot_devices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    device_id character varying NOT NULL,
    device_serial_number character varying NOT NULL,
    device_name character varying NOT NULL,
    device_type character varying NOT NULL,
    manufacturer character varying NOT NULL,
    model character varying NOT NULL,
    equipment_id character varying,
    asset_tag character varying,
    customer_id character varying,
    business_record_id character varying,
    installation_location text,
    installation_date date,
    connection_type character varying DEFAULT 'ethernet'::character varying,
    ip_address inet,
    mac_address character varying,
    network_name character varying,
    firmware_version character varying,
    last_firmware_update date,
    monitoring_enabled boolean DEFAULT true,
    data_collection_interval integer DEFAULT 300,
    device_status character varying DEFAULT 'active'::character varying,
    last_ping_time timestamp without time zone,
    last_data_received timestamp without time zone,
    battery_level integer,
    signal_strength integer,
    alert_thresholds jsonb,
    maintenance_schedule jsonb,
    device_token character varying,
    encryption_enabled boolean DEFAULT true,
    last_security_update date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.iot_devices OWNER TO neondb_owner;

--
-- Name: knowledge_base_articles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.knowledge_base_articles (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    title character varying NOT NULL,
    slug character varying,
    content text NOT NULL,
    summary text,
    category character varying NOT NULL,
    subcategory character varying,
    tags jsonb,
    applicable_equipment jsonb,
    is_published boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    view_count integer DEFAULT 0,
    helpful_votes integer DEFAULT 0,
    unhelpful_votes integer DEFAULT 0,
    meta_description text,
    search_keywords jsonb,
    author_id character varying NOT NULL,
    published_at timestamp without time zone,
    last_reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.knowledge_base_articles OWNER TO neondb_owner;

--
-- Name: lead_activities; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lead_activities (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    lead_id character varying NOT NULL,
    activity_type character varying NOT NULL,
    subject character varying NOT NULL,
    description text,
    direction character varying,
    email_from character varying,
    email_to text,
    email_cc text,
    email_subject character varying,
    email_body text,
    is_shared boolean DEFAULT false,
    call_duration integer,
    call_outcome character varying,
    scheduled_date timestamp without time zone,
    completed_date timestamp without time zone,
    due_date timestamp without time zone,
    outcome character varying,
    next_action text,
    follow_up_date timestamp without time zone,
    related_records jsonb,
    attachments jsonb,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lead_activities OWNER TO neondb_owner;

--
-- Name: lead_contacts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lead_contacts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    lead_id character varying NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    title character varying,
    department character varying,
    phone character varying,
    email character varying,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lead_contacts OWNER TO neondb_owner;

--
-- Name: lead_related_records; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lead_related_records (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    lead_id character varying NOT NULL,
    record_type character varying NOT NULL,
    record_id character varying NOT NULL,
    record_title character varying,
    record_count integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lead_related_records OWNER TO neondb_owner;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.leads (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    email character varying,
    phone character varying,
    address text,
    source character varying DEFAULT 'website'::character varying NOT NULL,
    assigned_sales_rep_id character varying,
    estimated_value numeric(10,2) DEFAULT '0'::numeric,
    estimated_close_date timestamp without time zone,
    notes text,
    last_contact_date timestamp without time zone,
    next_follow_up_date timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    company_id uuid,
    contact_id uuid,
    owner_id uuid,
    lead_source character varying(100),
    lead_status character varying(50) DEFAULT 'new'::character varying,
    status character varying(50) DEFAULT 'new'::character varying,
    estimated_amount numeric(10,2),
    probability integer DEFAULT 50,
    close_date date,
    lead_score integer DEFAULT 0,
    priority character varying(20) DEFAULT 'medium'::character varying,
    external_salesforce_id character varying(255),
    last_salesforce_sync timestamp without time zone
);


ALTER TABLE public.leads OWNER TO neondb_owner;

--
-- Name: locations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.locations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    address text,
    city character varying(50),
    state character varying(20),
    postal_code character varying(20),
    country character varying(50) DEFAULT 'USA'::character varying,
    phone character varying(20),
    email character varying(255),
    manager_id character varying,
    region_id character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.locations OWNER TO neondb_owner;

--
-- Name: maintenance_notifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.maintenance_notifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    schedule_id character varying NOT NULL,
    notification_type character varying NOT NULL,
    recipient_type character varying NOT NULL,
    recipient_id character varying NOT NULL,
    subject character varying NOT NULL,
    message text NOT NULL,
    notification_method character varying NOT NULL,
    is_delivered boolean DEFAULT false,
    delivered_at timestamp without time zone,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    scheduled_for timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.maintenance_notifications OWNER TO neondb_owner;

--
-- Name: maintenance_schedules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.maintenance_schedules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    equipment_id character varying,
    contract_id character varying,
    customer_id character varying,
    business_record_id character varying,
    schedule_name character varying NOT NULL,
    schedule_type character varying NOT NULL,
    frequency character varying NOT NULL,
    frequency_value integer DEFAULT 1,
    next_service_date timestamp without time zone,
    last_service_date timestamp without time zone,
    meter_threshold integer,
    current_meter_reading integer,
    last_service_meter integer,
    service_template_id character varying,
    service_duration_minutes integer DEFAULT 60,
    required_technician_level character varying,
    required_skills jsonb,
    estimated_cost numeric(10,2),
    advance_notification_days integer DEFAULT 7,
    customer_notification boolean DEFAULT true,
    technician_notification boolean DEFAULT true,
    is_active boolean DEFAULT true,
    priority character varying DEFAULT 'medium'::character varying,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.maintenance_schedules OWNER TO neondb_owner;

--
-- Name: maintenance_tasks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.maintenance_tasks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    schedule_id character varying NOT NULL,
    task_title character varying NOT NULL,
    task_description text,
    task_category character varying NOT NULL,
    estimated_duration_minutes integer DEFAULT 30,
    required_parts jsonb,
    required_tools jsonb,
    safety_requirements jsonb,
    instructions text,
    is_completed boolean DEFAULT false,
    completed_by character varying,
    completed_at timestamp without time zone,
    actual_duration_minutes integer,
    notes text,
    quality_check_required boolean DEFAULT false,
    quality_check_by character varying,
    quality_check_at timestamp without time zone,
    quality_score integer,
    sort_order integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.maintenance_tasks OWNER TO neondb_owner;

--
-- Name: managed_services; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.managed_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    product_code character varying NOT NULL,
    product_name character varying NOT NULL,
    category character varying DEFAULT 'IT Services'::character varying,
    service_type character varying,
    service_level character varying,
    description text,
    summary text,
    note text,
    ea_notes text,
    config_note text,
    related_products text,
    support_hours character varying,
    response_time character varying,
    includes_hardware boolean DEFAULT false,
    remote_mgmt boolean DEFAULT false,
    onsite_support boolean DEFAULT false,
    is_active boolean DEFAULT true,
    available_for_all boolean DEFAULT false,
    repost_edit boolean DEFAULT false,
    sales_rep_credit boolean DEFAULT true,
    funding boolean DEFAULT true,
    lease boolean DEFAULT false,
    payment_type character varying,
    new_active boolean DEFAULT false,
    new_rep_price numeric,
    upgrade_active boolean DEFAULT false,
    upgrade_rep_price numeric,
    lexmark_active boolean DEFAULT false,
    lexmark_rep_price numeric,
    graphic_active boolean DEFAULT false,
    graphic_rep_price numeric,
    price_book_id character varying,
    temp_key character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.managed_services OWNER TO neondb_owner;

--
-- Name: manufacturer_integrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.manufacturer_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    manufacturer character varying(50) NOT NULL,
    integration_name character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'inactive'::character varying NOT NULL,
    auth_method character varying(20) DEFAULT 'api_key'::character varying NOT NULL,
    api_endpoint character varying(255),
    api_key character varying(255),
    username character varying(100),
    password character varying(255),
    collection_frequency character varying(20) DEFAULT 'daily'::character varying NOT NULL,
    last_sync timestamp without time zone,
    next_sync timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    credentials jsonb,
    configuration jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true
);


ALTER TABLE public.manufacturer_integrations OWNER TO neondb_owner;

--
-- Name: master_product_accessories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.master_product_accessories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer character varying(100) NOT NULL,
    accessory_code character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    category character varying(50),
    msrp numeric(10,2),
    specs_json jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    discontinued_at timestamp without time zone,
    version character varying DEFAULT '1.0'::character varying
);


ALTER TABLE public.master_product_accessories OWNER TO neondb_owner;

--
-- Name: master_product_accessory_relationships; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.master_product_accessory_relationships (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    base_product_id character varying NOT NULL,
    accessory_id character varying NOT NULL,
    relationship_type character varying DEFAULT 'compatible'::character varying NOT NULL,
    category character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.master_product_accessory_relationships OWNER TO neondb_owner;

--
-- Name: master_product_models; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.master_product_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer character varying(100) NOT NULL,
    model_code character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    category character varying(50),
    product_type character varying(100),
    msrp numeric(10,2),
    specs_json jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    discontinued_at timestamp without time zone,
    version character varying DEFAULT '1.0'::character varying,
    dealer_cost numeric(10,2),
    margin_percentage numeric(5,2)
);


ALTER TABLE public.master_product_models OWNER TO neondb_owner;

--
-- Name: meter_readings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.meter_readings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    equipment_id character varying NOT NULL,
    contract_id character varying NOT NULL,
    reading_date timestamp without time zone NOT NULL,
    black_meter integer DEFAULT 0 NOT NULL,
    color_meter integer DEFAULT 0 NOT NULL,
    previous_black_meter integer DEFAULT 0,
    previous_color_meter integer DEFAULT 0,
    black_copies integer DEFAULT 0,
    color_copies integer DEFAULT 0,
    collection_method character varying DEFAULT 'manual'::character varying NOT NULL,
    notes text,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.meter_readings OWNER TO neondb_owner;

--
-- Name: mobile_app_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.mobile_app_sessions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    session_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    device_id character varying,
    session_start timestamp without time zone NOT NULL,
    session_end timestamp without time zone,
    last_activity timestamp without time zone DEFAULT now(),
    device_type character varying,
    device_model character varying,
    os_version character varying,
    app_version character varying,
    connection_type character varying,
    network_quality character varying,
    start_location jsonb,
    end_location jsonb,
    locations_recorded integer DEFAULT 0,
    work_orders_accessed jsonb,
    parts_orders_created integer DEFAULT 0,
    photos_uploaded integer DEFAULT 0,
    signatures_captured integer DEFAULT 0,
    sync_operations integer DEFAULT 0,
    data_uploaded_mb numeric(8,2) DEFAULT 0,
    data_downloaded_mb numeric(8,2) DEFAULT 0,
    offline_time_minutes integer DEFAULT 0,
    crash_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    performance_issues jsonb,
    end_reason character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.mobile_app_sessions OWNER TO neondb_owner;

--
-- Name: mobile_field_metrics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.mobile_field_metrics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    date_recorded date NOT NULL,
    shift_type character varying DEFAULT 'regular'::character varying,
    work_orders_completed integer DEFAULT 0,
    work_orders_attempted integer DEFAULT 0,
    first_time_fix_count integer DEFAULT 0,
    callback_count integer DEFAULT 0,
    total_work_hours numeric(5,2) DEFAULT 0,
    billable_hours numeric(5,2) DEFAULT 0,
    travel_hours numeric(5,2) DEFAULT 0,
    break_hours numeric(5,2) DEFAULT 0,
    administrative_hours numeric(5,2) DEFAULT 0,
    total_distance_km numeric(8,2) DEFAULT 0,
    fuel_efficiency_km_per_liter numeric(6,2),
    average_speed_kmh numeric(6,2),
    geofence_compliance_percentage numeric(5,2) DEFAULT 100,
    customer_interactions integer DEFAULT 0,
    customer_satisfaction_avg numeric(3,2) DEFAULT 0,
    customer_complaints integer DEFAULT 0,
    customer_compliments integer DEFAULT 0,
    voice_notes_recorded integer DEFAULT 0,
    photos_captured integer DEFAULT 0,
    forms_completed integer DEFAULT 0,
    parts_consumption_value numeric(10,2) DEFAULT 0,
    safety_incidents integer DEFAULT 0,
    safety_near_misses integer DEFAULT 0,
    compliance_violations integer DEFAULT 0,
    ppe_compliance_percentage numeric(5,2) DEFAULT 100,
    app_login_count integer DEFAULT 0,
    offline_work_duration_minutes integer DEFAULT 0,
    sync_attempts integer DEFAULT 0,
    sync_failures integer DEFAULT 0,
    data_usage_mb numeric(8,2) DEFAULT 0,
    work_quality_score numeric(5,2) DEFAULT 0,
    documentation_completeness_percentage numeric(5,2) DEFAULT 0,
    follow_up_required_count integer DEFAULT 0,
    warranty_claims_count integer DEFAULT 0,
    revenue_generated numeric(10,2) DEFAULT 0,
    costs_incurred numeric(10,2) DEFAULT 0,
    profit_margin numeric(5,2) DEFAULT 0,
    upsell_opportunities integer DEFAULT 0,
    average_job_duration_minutes numeric(8,2) DEFAULT 0,
    setup_time_minutes numeric(8,2) DEFAULT 0,
    cleanup_time_minutes numeric(8,2) DEFAULT 0,
    waiting_time_minutes numeric(8,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.mobile_field_metrics OWNER TO neondb_owner;

--
-- Name: mobile_field_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.mobile_field_orders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    order_number character varying NOT NULL,
    order_type character varying NOT NULL,
    technician_id character varying NOT NULL,
    work_order_id character varying,
    order_date date NOT NULL,
    requested_delivery_date date,
    delivery_method character varying DEFAULT 'truck_delivery'::character varying,
    delivery_address text,
    delivery_contact_name character varying,
    delivery_contact_phone character varying,
    delivery_instructions text,
    status character varying DEFAULT 'submitted'::character varying,
    urgency character varying DEFAULT 'standard'::character varying,
    requires_approval boolean DEFAULT false,
    approved_by character varying,
    approval_date timestamp without time zone,
    approval_notes text,
    subtotal numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    shipping_cost numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0,
    tracking_number character varying,
    shipped_date date,
    delivered_date date,
    delivery_confirmation text,
    order_notes text,
    special_instructions text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.mobile_field_orders OWNER TO neondb_owner;

--
-- Name: mobile_order_line_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.mobile_order_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    field_order_id character varying NOT NULL,
    line_number integer NOT NULL,
    part_id character varying NOT NULL,
    part_number character varying NOT NULL,
    part_name character varying NOT NULL,
    quantity_requested integer NOT NULL,
    quantity_approved integer,
    quantity_shipped integer,
    quantity_received integer,
    unit_cost numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    line_status character varying DEFAULT 'pending'::character varying,
    substitute_part_id character varying,
    line_notes text,
    usage_reason character varying,
    work_order_reference character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.mobile_order_line_items OWNER TO neondb_owner;

--
-- Name: mobile_parts_inventory; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.mobile_parts_inventory (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    part_number character varying NOT NULL,
    part_name character varying NOT NULL,
    part_description text,
    manufacturer character varying,
    category character varying,
    warehouse_quantity integer DEFAULT 0,
    truck_quantity integer DEFAULT 0,
    reserved_quantity integer DEFAULT 0,
    available_quantity integer DEFAULT 0,
    unit_cost numeric(10,2) NOT NULL,
    list_price numeric(10,2) NOT NULL,
    markup_percentage numeric(5,2) DEFAULT 0,
    weight_lbs numeric(6,2),
    dimensions character varying,
    compatibility jsonb,
    primary_vendor_id character varying,
    vendor_part_number character varying,
    lead_time_days integer DEFAULT 7,
    minimum_order_quantity integer DEFAULT 1,
    reorder_point integer DEFAULT 5,
    max_stock_level integer DEFAULT 100,
    last_restocked_date date,
    is_active boolean DEFAULT true,
    is_stockable boolean DEFAULT true,
    requires_special_handling boolean DEFAULT false,
    commonly_used boolean DEFAULT false,
    truck_stock_priority integer DEFAULT 5,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.mobile_parts_inventory OWNER TO neondb_owner;

--
-- Name: mobile_work_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.mobile_work_orders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    work_order_number character varying NOT NULL,
    work_order_type character varying NOT NULL,
    priority character varying DEFAULT 'medium'::character varying,
    customer_id character varying NOT NULL,
    business_record_id character varying NOT NULL,
    equipment_id character varying,
    asset_tag character varying,
    service_address text NOT NULL,
    site_contact_name character varying,
    site_contact_phone character varying,
    access_instructions text,
    special_requirements text,
    scheduled_date date,
    scheduled_time_start time without time zone,
    scheduled_time_end time without time zone,
    estimated_duration_hours numeric(4,2) DEFAULT 2.0,
    assigned_technician_id character varying NOT NULL,
    backup_technician_id character varying,
    technician_notes text,
    problem_description text NOT NULL,
    work_performed text,
    parts_used jsonb,
    labor_hours numeric(5,2) DEFAULT 0,
    status character varying DEFAULT 'assigned'::character varying,
    status_updated_at timestamp without time zone DEFAULT now(),
    arrival_time timestamp without time zone,
    start_work_time timestamp without time zone,
    completion_time timestamp without time zone,
    departure_time timestamp without time zone,
    travel_time_minutes integer,
    customer_signature text,
    customer_satisfaction_rating integer,
    customer_feedback text,
    before_photos jsonb,
    after_photos jsonb,
    documentation_notes text,
    service_charge numeric(10,2) DEFAULT 0,
    parts_cost numeric(10,2) DEFAULT 0,
    total_cost numeric(10,2) DEFAULT 0,
    billing_notes text,
    follow_up_required boolean DEFAULT false,
    follow_up_date date,
    follow_up_notes text,
    last_sync_time timestamp without time zone,
    sync_status character varying DEFAULT 'synced'::character varying,
    offline_data jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.mobile_work_orders OWNER TO neondb_owner;

--
-- Name: monitoring_dashboards; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.monitoring_dashboards (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    dashboard_name character varying NOT NULL,
    dashboard_type character varying NOT NULL,
    dashboard_config jsonb NOT NULL,
    data_sources jsonb,
    refresh_interval integer DEFAULT 300,
    is_public boolean DEFAULT false,
    owner_id character varying NOT NULL,
    shared_with jsonb,
    color_scheme character varying DEFAULT 'default'::character varying,
    layout_type character varying DEFAULT 'grid'::character varying,
    widget_settings jsonb,
    cache_duration integer DEFAULT 300,
    last_generated timestamp without time zone,
    generation_time_ms integer,
    is_active boolean DEFAULT true,
    last_accessed timestamp without time zone,
    access_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.monitoring_dashboards OWNER TO neondb_owner;

--
-- Name: onboarding_checklists; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.onboarding_checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    checklist_title character varying(255) NOT NULL,
    installation_type character varying(50) NOT NULL,
    customer_data jsonb,
    site_information jsonb,
    scheduled_install_date date,
    actual_install_date date,
    access_requirements text,
    special_instructions text,
    status character varying(20) DEFAULT 'draft'::character varying,
    progress_percentage numeric(5,2) DEFAULT 0,
    total_sections integer DEFAULT 0,
    completed_sections integer DEFAULT 0,
    pdf_url character varying(500),
    pdf_generated_at timestamp with time zone,
    created_by uuid NOT NULL,
    last_modified_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    customer_id character varying,
    equipment_details jsonb,
    assigned_technician_id character varying,
    estimated_duration integer,
    business_hours jsonb,
    description text,
    quote_id character varying,
    order_id character varying,
    CONSTRAINT onboarding_checklists_installation_type_check CHECK (((installation_type)::text = ANY ((ARRAY['new_site'::character varying, 'equipment_upgrade'::character varying, 'relocation'::character varying, 'expansion'::character varying])::text[]))),
    CONSTRAINT onboarding_checklists_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.onboarding_checklists OWNER TO neondb_owner;

--
-- Name: onboarding_dynamic_sections; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.onboarding_dynamic_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    checklist_id uuid NOT NULL,
    section_title character varying(255) NOT NULL,
    section_description text,
    section_order integer DEFAULT 0,
    field_configs jsonb,
    form_data jsonb,
    is_completed boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.onboarding_dynamic_sections OWNER TO neondb_owner;

--
-- Name: onboarding_equipment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.onboarding_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    checklist_id uuid NOT NULL,
    manufacturer character varying(100),
    model character varying(100),
    serial_number character varying(100),
    asset_tag character varying(100),
    building_location character varying(100),
    room_location character varying(100),
    specific_location text,
    target_ip_address character varying(45),
    subnet_mask character varying(45),
    hostname character varying(100),
    is_installed boolean DEFAULT false,
    installation_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.onboarding_equipment OWNER TO neondb_owner;

--
-- Name: onboarding_network_config; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.onboarding_network_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    checklist_id uuid NOT NULL,
    network_name character varying(100),
    network_type character varying(50),
    vlan_id integer,
    dhcp_range_start character varying(45),
    dhcp_range_end character varying(45),
    dns_primary character varying(45),
    dns_secondary character varying(45),
    security_protocol character varying(50),
    wifi_ssid character varying(100),
    wifi_password character varying(255),
    is_configured boolean DEFAULT false,
    configuration_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT onboarding_network_config_network_type_check CHECK (((network_type)::text = ANY ((ARRAY['wired'::character varying, 'wireless'::character varying, 'guest'::character varying])::text[])))
);


ALTER TABLE public.onboarding_network_config OWNER TO neondb_owner;

--
-- Name: onboarding_print_management; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.onboarding_print_management (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    checklist_id uuid NOT NULL,
    solution_type character varying(50),
    server_address character varying(255),
    database_config jsonb,
    authentication_method character varying(50),
    quota_settings jsonb,
    security_settings jsonb,
    is_configured boolean DEFAULT false,
    configuration_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT onboarding_print_management_solution_type_check CHECK (((solution_type)::text = ANY ((ARRAY['papercut'::character varying, 'safeq'::character varying, 'equitrac'::character varying, 'follow_me'::character varying, 'custom'::character varying])::text[])))
);


ALTER TABLE public.onboarding_print_management OWNER TO neondb_owner;

--
-- Name: onboarding_tasks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.onboarding_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    checklist_id uuid NOT NULL,
    task_title character varying(255) NOT NULL,
    task_description text,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    assigned_to uuid,
    due_date date,
    completed_date timestamp with time zone,
    completion_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT onboarding_tasks_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT onboarding_tasks_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'blocked'::character varying])::text[])))
);


ALTER TABLE public.onboarding_tasks OWNER TO neondb_owner;

--
-- Name: organizational_units; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.organizational_units (
    id character varying(255) NOT NULL,
    tenant_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    tier character varying(50) NOT NULL,
    parent_unit_id character varying(255),
    lft integer DEFAULT 1 NOT NULL,
    rgt integer DEFAULT 2 NOT NULL,
    depth integer DEFAULT 0 NOT NULL,
    description text,
    manager_id character varying(255),
    location_id character varying(255),
    region_id character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organizational_units_tier_check CHECK (((tier)::text = ANY ((ARRAY['PLATFORM'::character varying, 'COMPANY'::character varying, 'REGIONAL'::character varying, 'LOCATION'::character varying])::text[])))
);


ALTER TABLE public.organizational_units OWNER TO neondb_owner;

--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payment_methods (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.payment_methods OWNER TO neondb_owner;

--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payment_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_methods_id_seq OWNER TO neondb_owner;

--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- Name: payment_schedules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payment_schedules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying,
    business_record_id character varying,
    contract_id character varying,
    schedule_name character varying NOT NULL,
    payment_frequency character varying NOT NULL,
    payment_amount numeric(12,2) NOT NULL,
    currency character varying DEFAULT 'USD'::character varying,
    start_date date NOT NULL,
    end_date date,
    next_payment_date date NOT NULL,
    payment_method character varying DEFAULT 'invoice'::character varying,
    auto_charge_card_id character varying,
    auto_charge_bank_id character varying,
    status character varying DEFAULT 'active'::character varying,
    payments_made integer DEFAULT 0,
    total_payments_scheduled integer,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    last_retry_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.payment_schedules OWNER TO neondb_owner;

--
-- Name: payment_terms; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payment_terms (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50),
    discount_percent numeric(5,2),
    discount_days integer,
    net_days integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.payment_terms OWNER TO neondb_owner;

--
-- Name: payment_terms_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payment_terms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_terms_id_seq OWNER TO neondb_owner;

--
-- Name: payment_terms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payment_terms_id_seq OWNED BY public.payment_terms.id;


--
-- Name: performance_benchmarks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.performance_benchmarks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    benchmark_name character varying NOT NULL,
    benchmark_category character varying NOT NULL,
    metric_type character varying,
    industry_average numeric(15,4),
    industry_best_practice numeric(15,4),
    company_target numeric(15,4),
    current_performance numeric(15,4),
    performance_grade character varying,
    percentile_ranking numeric(5,2),
    gap_to_target numeric(15,4),
    gap_to_best_practice numeric(15,4),
    previous_period_value numeric(15,4),
    trend_direction character varying,
    months_to_target integer,
    data_source character varying,
    measurement_frequency character varying,
    last_updated date,
    validity_period_end date,
    geographic_scope character varying,
    company_size_category character varying,
    industry_segment character varying,
    improvement_priority character varying,
    action_plan jsonb,
    responsible_party character varying,
    target_completion_date date,
    estimated_roi numeric(10,2),
    business_impact character varying,
    investment_required numeric(12,2),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.performance_benchmarks OWNER TO neondb_owner;

--
-- Name: phone_in_tickets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.phone_in_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    caller_name character varying NOT NULL,
    caller_phone character varying NOT NULL,
    caller_email character varying,
    caller_role character varying,
    customer_id character varying,
    customer_name character varying NOT NULL,
    location_address text NOT NULL,
    location_building character varying,
    location_floor character varying,
    location_room character varying,
    equipment_id character varying,
    equipment_brand character varying,
    equipment_model character varying,
    equipment_serial character varying,
    issue_category character varying DEFAULT 'other'::character varying,
    issue_description text NOT NULL,
    priority character varying DEFAULT 'medium'::character varying,
    contact_method character varying DEFAULT 'phone'::character varying,
    preferred_service_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    converted_to_ticket_id character varying,
    converted_at timestamp without time zone,
    notes text
);


ALTER TABLE public.phone_in_tickets OWNER TO neondb_owner;

--
-- Name: po_line_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.po_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    purchase_order_id character varying NOT NULL,
    line_number integer NOT NULL,
    product_id character varying,
    equipment_model character varying NOT NULL,
    equipment_brand character varying,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    specifications jsonb,
    warranty_period_months integer DEFAULT 12,
    serial_numbers jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.po_line_items OWNER TO neondb_owner;

--
-- Name: predictive_alerts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.predictive_alerts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    alert_id character varying NOT NULL,
    device_id character varying NOT NULL,
    equipment_id character varying,
    alert_type character varying NOT NULL,
    alert_category character varying NOT NULL,
    severity character varying NOT NULL,
    predicted_failure_component character varying,
    failure_probability numeric(5,4),
    time_to_failure_days integer,
    confidence_score numeric(3,2),
    alert_title character varying NOT NULL,
    alert_description text NOT NULL,
    recommended_actions jsonb,
    prediction_model character varying,
    model_version character varying,
    feature_importance jsonb,
    historical_pattern_match jsonb,
    alert_status character varying DEFAULT 'open'::character varying,
    acknowledged_by character varying,
    acknowledged_at timestamp without time zone,
    resolved_by character varying,
    resolved_at timestamp without time zone,
    resolution_notes text,
    customer_id character varying,
    business_record_id character varying,
    estimated_downtime_hours numeric(6,2),
    business_impact_level character varying,
    escalation_level integer DEFAULT 1,
    assigned_technician_id character varying,
    work_order_id character varying,
    notifications_sent jsonb,
    customer_notified boolean DEFAULT false,
    customer_notification_time timestamp without time zone,
    detection_accuracy boolean,
    actual_failure_date date,
    prevention_successful boolean,
    cost_savings_estimate numeric(10,2),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.predictive_alerts OWNER TO neondb_owner;

--
-- Name: process_automation_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.process_automation_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    log_type character varying NOT NULL,
    entity_type character varying NOT NULL,
    entity_id character varying NOT NULL,
    event_name character varying NOT NULL,
    event_timestamp timestamp without time zone NOT NULL,
    event_source character varying,
    event_data jsonb,
    previous_state jsonb,
    new_state jsonb,
    context_variables jsonb,
    triggered_by_user character varying,
    executing_system_user character varying,
    client_ip character varying,
    user_agent text,
    execution_duration_ms integer,
    memory_usage_mb numeric(8,2),
    cpu_usage_percentage numeric(5,2),
    api_calls_made integer DEFAULT 0,
    success boolean NOT NULL,
    error_code character varying,
    error_message text,
    stack_trace text,
    retry_attempt integer DEFAULT 0,
    business_value_impact numeric(10,2),
    cost_impact numeric(10,2),
    time_saved_minutes numeric(8,2),
    compliance_flags jsonb,
    audit_trail_id character varying,
    data_sensitivity_level character varying,
    performance_baseline numeric(8,2),
    performance_actual numeric(8,2),
    alert_thresholds_breached jsonb,
    external_system_calls jsonb,
    webhook_responses jsonb,
    api_response_times jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.process_automation_logs OWNER TO neondb_owner;

--
-- Name: product_accessories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.product_accessories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    model_id uuid NOT NULL,
    accessory_code character varying NOT NULL,
    accessory_name character varying NOT NULL,
    category character varying,
    description text,
    msrp numeric,
    rep_price numeric,
    is_required boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_accessories OWNER TO neondb_owner;

--
-- Name: product_models; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.product_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    product_code character varying NOT NULL,
    product_name character varying NOT NULL,
    category character varying DEFAULT 'MFP'::character varying,
    manufacturer character varying,
    description text,
    msrp numeric,
    color_mode character varying,
    color_speed character varying,
    bw_speed character varying,
    product_family character varying,
    new_active boolean DEFAULT false,
    new_rep_price numeric,
    upgrade_active boolean DEFAULT false,
    upgrade_rep_price numeric,
    lexmark_active boolean DEFAULT false,
    lexmark_rep_price numeric,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_models OWNER TO neondb_owner;

--
-- Name: product_pricing; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.product_pricing (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    product_id character varying NOT NULL,
    product_type character varying NOT NULL,
    dealer_cost numeric(12,2) NOT NULL,
    company_markup_percentage numeric(5,2),
    company_price numeric(12,2) NOT NULL,
    minimum_sale_price numeric(12,2),
    suggested_retail_price numeric(12,2),
    is_active boolean DEFAULT true,
    effective_date timestamp without time zone DEFAULT now(),
    expiration_date timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_pricing OWNER TO neondb_owner;

--
-- Name: product_tags; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.product_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    model_id uuid NOT NULL,
    tag character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_tags OWNER TO neondb_owner;

--
-- Name: professional_services; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.professional_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    product_code character varying NOT NULL,
    product_name character varying NOT NULL,
    category character varying DEFAULT 'Professional Services'::character varying,
    accessory_type character varying,
    description text,
    summary text,
    note text,
    ea_notes text,
    related_products text,
    is_active boolean DEFAULT true,
    available_for_all boolean DEFAULT false,
    repost_edit boolean DEFAULT false,
    sales_rep_credit boolean DEFAULT true,
    funding boolean DEFAULT true,
    lease boolean DEFAULT false,
    payment_type character varying,
    msrp numeric,
    new_active boolean DEFAULT false,
    new_rep_price numeric,
    upgrade_active boolean DEFAULT false,
    upgrade_rep_price numeric,
    lexmark_active boolean DEFAULT false,
    lexmark_rep_price numeric,
    graphic_active boolean DEFAULT false,
    graphic_rep_price numeric,
    manufacturer character varying,
    manufacturer_product_code character varying,
    model character varying,
    units character varying,
    environment character varying,
    color_mode character varying,
    ea_item_number character varying,
    price_book_id character varying,
    temp_key character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.professional_services OWNER TO neondb_owner;

--
-- Name: profitability_analysis; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.profitability_analysis (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    analysis_name character varying NOT NULL,
    analysis_type character varying NOT NULL,
    analysis_period_start date NOT NULL,
    analysis_period_end date NOT NULL,
    subject_type character varying NOT NULL,
    subject_id character varying,
    subject_name character varying,
    service_revenue numeric(15,2) DEFAULT 0,
    product_revenue numeric(15,2) DEFAULT 0,
    other_revenue numeric(15,2) DEFAULT 0,
    total_revenue numeric(15,2) DEFAULT 0,
    direct_costs numeric(15,2) DEFAULT 0,
    labor_costs numeric(15,2) DEFAULT 0,
    material_costs numeric(15,2) DEFAULT 0,
    overhead_allocation numeric(15,2) DEFAULT 0,
    total_costs numeric(15,2) DEFAULT 0,
    gross_profit numeric(15,2) DEFAULT 0,
    gross_margin_percentage numeric(5,2) DEFAULT 0,
    net_profit numeric(15,2) DEFAULT 0,
    net_margin_percentage numeric(5,2) DEFAULT 0,
    roi_percentage numeric(5,2) DEFAULT 0,
    customer_lifetime_value numeric(15,2) DEFAULT 0,
    customer_acquisition_cost numeric(15,2) DEFAULT 0,
    industry_benchmark_margin numeric(5,2),
    performance_vs_benchmark numeric(5,2),
    ranking_percentile numeric(3,0),
    status character varying DEFAULT 'completed'::character varying,
    calculation_method character varying DEFAULT 'activity_based'::character varying,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.profitability_analysis OWNER TO neondb_owner;

--
-- Name: proposal_analytics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.proposal_analytics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    proposal_id character varying NOT NULL,
    event_type character varying NOT NULL,
    event_timestamp timestamp without time zone DEFAULT now(),
    event_details jsonb,
    user_id character varying,
    customer_user_id character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proposal_analytics OWNER TO neondb_owner;

--
-- Name: proposal_comments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.proposal_comments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    proposal_id character varying NOT NULL,
    comment_type character varying DEFAULT 'general'::character varying,
    content text NOT NULL,
    author_id character varying NOT NULL,
    author_name character varying NOT NULL,
    author_role character varying,
    is_internal boolean DEFAULT false,
    is_resolved boolean DEFAULT false,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proposal_comments OWNER TO neondb_owner;

--
-- Name: proposal_line_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.proposal_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    proposal_id character varying NOT NULL,
    line_number integer NOT NULL,
    item_type character varying NOT NULL,
    product_id character varying,
    product_name character varying NOT NULL,
    description text,
    quantity integer DEFAULT 1,
    unit_price numeric NOT NULL,
    unit_cost numeric,
    total_price numeric NOT NULL,
    service_frequency character varying,
    service_duration character varying,
    equipment_condition character varying,
    warranty_info text,
    is_optional boolean DEFAULT false,
    is_alternative boolean DEFAULT false,
    package_id character varying,
    specifications jsonb,
    alternative_options jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proposal_line_items OWNER TO neondb_owner;

--
-- Name: proposal_templates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.proposal_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    template_name character varying NOT NULL,
    template_type character varying NOT NULL,
    description text,
    header_content jsonb,
    cover_page_template text,
    executive_summary_template text,
    proposal_body_template text,
    terms_conditions_template text,
    footer_template text,
    branding_colors jsonb,
    font_settings jsonb,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proposal_templates OWNER TO neondb_owner;

--
-- Name: proposals; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.proposals (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    proposal_number character varying NOT NULL,
    version character varying DEFAULT '1.0'::character varying,
    title character varying NOT NULL,
    business_record_id character varying NOT NULL,
    contact_id character varying,
    created_by character varying NOT NULL,
    assigned_to character varying NOT NULL,
    team_id character varying,
    proposal_type character varying NOT NULL,
    description text,
    executive_summary text,
    company_introduction text,
    solution_overview text,
    terms_and_conditions text,
    investment_summary text,
    next_steps text,
    subtotal numeric DEFAULT '0'::numeric,
    discount_amount numeric DEFAULT '0'::numeric,
    discount_percentage numeric DEFAULT '0'::numeric,
    tax_amount numeric DEFAULT '0'::numeric,
    total_amount numeric DEFAULT '0'::numeric,
    valid_until timestamp without time zone,
    estimated_start_date timestamp without time zone,
    estimated_end_date timestamp without time zone,
    status character varying DEFAULT 'draft'::character varying,
    priority character varying DEFAULT 'medium'::character varying,
    sent_at timestamp without time zone,
    viewed_at timestamp without time zone,
    accepted_at timestamp without time zone,
    rejected_at timestamp without time zone,
    open_count integer DEFAULT 0,
    last_opened_at timestamp without time zone,
    template_id character varying,
    custom_styling jsonb,
    internal_notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proposals OWNER TO neondb_owner;

--
-- Name: prospecting_campaigns; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.prospecting_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) NOT NULL,
    campaign_name character varying(255) NOT NULL,
    campaign_type character varying(100) NOT NULL,
    campaign_description text,
    target_industry character varying(255),
    target_company_size character varying(100),
    target_job_titles text[],
    status character varying(50) DEFAULT 'active'::character varying,
    total_contacts integer DEFAULT 0,
    contacted_count integer DEFAULT 0,
    response_count integer DEFAULT 0,
    response_rate numeric(5,4),
    conversion_count integer DEFAULT 0,
    conversion_rate numeric(5,4),
    start_date timestamp without time zone DEFAULT now(),
    end_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.prospecting_campaigns OWNER TO neondb_owner;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_orders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    po_number character varying NOT NULL,
    vendor_id character varying NOT NULL,
    requested_by character varying NOT NULL,
    order_date timestamp without time zone NOT NULL,
    expected_date timestamp without time zone,
    description text,
    subtotal numeric(12,2) NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0,
    shipping_amount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    delivery_address text,
    special_instructions text,
    approved_by character varying,
    approved_date timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.purchase_orders OWNER TO neondb_owner;

--
-- Name: qb_customers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.qb_customers (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    qb_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    company_name character varying(255),
    email character varying(255),
    phone character varying(50),
    billing_address jsonb,
    shipping_address jsonb,
    balance numeric(10,2) DEFAULT 0,
    credit_limit numeric(10,2),
    payment_terms character varying(100),
    sync_token character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.qb_customers OWNER TO neondb_owner;

--
-- Name: qb_customers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.qb_customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.qb_customers_id_seq OWNER TO neondb_owner;

--
-- Name: qb_customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.qb_customers_id_seq OWNED BY public.qb_customers.id;


--
-- Name: qb_invoices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.qb_invoices (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    qb_id character varying(255) NOT NULL,
    doc_number character varying(100),
    customer_ref character varying(255),
    total_amount numeric(10,2),
    balance numeric(10,2),
    due_date date,
    txn_date date,
    email_status character varying(50),
    print_status character varying(50),
    private_note text,
    customer_memo text,
    sync_token character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.qb_invoices OWNER TO neondb_owner;

--
-- Name: qb_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.qb_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.qb_invoices_id_seq OWNER TO neondb_owner;

--
-- Name: qb_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.qb_invoices_id_seq OWNED BY public.qb_invoices.id;


--
-- Name: qb_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.qb_items (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    qb_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50),
    description text,
    unit_price numeric(10,2),
    quantity_on_hand integer DEFAULT 0,
    income_account_ref character varying(255),
    expense_account_ref character varying(255),
    asset_account_ref character varying(255),
    sku character varying(100),
    sync_token character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.qb_items OWNER TO neondb_owner;

--
-- Name: qb_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.qb_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.qb_items_id_seq OWNER TO neondb_owner;

--
-- Name: qb_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.qb_items_id_seq OWNED BY public.qb_items.id;


--
-- Name: qb_vendors; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.qb_vendors (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    qb_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    company_name character varying(255),
    email character varying(255),
    phone character varying(50),
    billing_address jsonb,
    account_number character varying(100),
    balance numeric(10,2) DEFAULT 0,
    payment_terms character varying(100),
    sync_token character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.qb_vendors OWNER TO neondb_owner;

--
-- Name: qb_vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.qb_vendors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.qb_vendors_id_seq OWNER TO neondb_owner;

--
-- Name: qb_vendors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.qb_vendors_id_seq OWNED BY public.qb_vendors.id;


--
-- Name: quickbooks_integrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quickbooks_integrations (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    company_id character varying(255),
    access_token_expires_at timestamp without time zone,
    refresh_token_expires_at timestamp without time zone,
    connected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_sync_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quickbooks_integrations OWNER TO neondb_owner;

--
-- Name: quickbooks_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.quickbooks_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quickbooks_integrations_id_seq OWNER TO neondb_owner;

--
-- Name: quickbooks_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.quickbooks_integrations_id_seq OWNED BY public.quickbooks_integrations.id;


--
-- Name: quote_line_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quote_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    quote_id character varying NOT NULL,
    description character varying NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,4) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    item_type character varying DEFAULT 'service'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_line_items OWNER TO neondb_owner;

--
-- Name: quote_pricing; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quote_pricing (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    lead_id character varying,
    customer_id character varying,
    quote_number character varying NOT NULL,
    blanket_gross_profit_percentage numeric(5,2) DEFAULT 10.00,
    apply_blanket_to_all_items boolean DEFAULT true,
    total_dealer_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_company_price numeric(12,2) DEFAULT 0 NOT NULL,
    total_sale_price numeric(12,2) DEFAULT 0 NOT NULL,
    total_gross_profit numeric(12,2) DEFAULT 0 NOT NULL,
    total_gross_profit_percentage numeric(5,2) DEFAULT 0,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    created_by character varying NOT NULL,
    approved_by character varying,
    approved_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_pricing OWNER TO neondb_owner;

--
-- Name: quote_pricing_line_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quote_pricing_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    quote_pricing_id character varying NOT NULL,
    line_number integer NOT NULL,
    product_id character varying NOT NULL,
    product_type character varying NOT NULL,
    description text,
    quantity integer DEFAULT 1,
    dealer_cost numeric(12,2),
    company_price numeric(12,2),
    sale_price numeric(12,2) NOT NULL,
    gross_profit numeric(12,2),
    gross_profit_percentage numeric(5,2),
    use_blanket_pricing boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_pricing_line_items OWNER TO neondb_owner;

--
-- Name: quotes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quotes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    lead_id character varying,
    customer_id character varying,
    quote_number character varying NOT NULL,
    title character varying NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    valid_until timestamp without time zone NOT NULL,
    sent_date timestamp without time zone,
    accepted_date timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    terms text,
    notes text
);


ALTER TABLE public.quotes OWNER TO neondb_owner;

--
-- Name: regions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.regions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    description text,
    manager_id character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.regions OWNER TO neondb_owner;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.role_permissions (
    id character varying(255) NOT NULL,
    role_id character varying(255) NOT NULL,
    permission_id character varying(255) NOT NULL,
    effect character varying(10) DEFAULT 'ALLOW'::character varying NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb,
    granted_by character varying(255) NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    assignment_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT role_permissions_effect_check CHECK (((effect)::text = ANY ((ARRAY['ALLOW'::character varying, 'DENY'::character varying])::text[])))
);


ALTER TABLE public.role_permissions OWNER TO neondb_owner;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.roles (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    code character varying(30) NOT NULL,
    department character varying(30) NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    description character varying(255),
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    role_type public.role_type DEFAULT 'department_role'::public.role_type,
    can_access_all_tenants boolean DEFAULT false,
    can_manage_users boolean DEFAULT false,
    can_view_system_metrics boolean DEFAULT false,
    is_system_role boolean DEFAULT false,
    can_access_all_locations boolean DEFAULT false,
    can_manage_company_users boolean DEFAULT false,
    can_create_locations boolean DEFAULT false,
    can_view_company_financials boolean DEFAULT false,
    can_manage_regional_users boolean DEFAULT false,
    can_view_regional_reports boolean DEFAULT false,
    can_approve_regional_deals boolean DEFAULT false,
    can_manage_location_users boolean DEFAULT false,
    can_view_location_reports boolean DEFAULT false,
    can_approve_location_deals boolean DEFAULT false,
    can_manage_compliance boolean DEFAULT false,
    can_manage_training boolean DEFAULT false,
    can_manage_hr boolean DEFAULT false,
    can_manage_it boolean DEFAULT false,
    can_view_analytics boolean DEFAULT false,
    can_manage_quality boolean DEFAULT false,
    can_access_audit_logs boolean DEFAULT false,
    can_manage_integrations boolean DEFAULT false
);


ALTER TABLE public.roles OWNER TO neondb_owner;

--
-- Name: sales_forecasts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_forecasts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    forecast_name character varying NOT NULL,
    forecast_type character varying NOT NULL,
    description text,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    revenue_target numeric(12,2) NOT NULL,
    unit_target integer,
    deal_count_target integer,
    actual_revenue numeric(12,2) DEFAULT 0,
    actual_units integer DEFAULT 0,
    actual_deals integer DEFAULT 0,
    pipeline_value numeric(12,2) DEFAULT 0,
    weighted_pipeline_value numeric(12,2) DEFAULT 0,
    probability_adjusted_revenue numeric(12,2) DEFAULT 0,
    confidence_level character varying NOT NULL,
    confidence_percentage integer DEFAULT 50,
    conversion_rate numeric(5,2) DEFAULT 0,
    average_deal_size numeric(10,2) DEFAULT 0,
    sales_cycle_length integer DEFAULT 30,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    achievement_percentage numeric(5,2) DEFAULT 0,
    projected_revenue numeric(12,2) DEFAULT 0,
    gap_to_target numeric(12,2) DEFAULT 0,
    sales_territory character varying,
    sales_team jsonb DEFAULT '[]'::jsonb,
    sales_manager character varying,
    forecast_notes text,
    assumptions text,
    risk_factors text,
    opportunities text,
    created_by character varying NOT NULL,
    updated_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    last_calculated timestamp without time zone
);


ALTER TABLE public.sales_forecasts OWNER TO neondb_owner;

--
-- Name: sales_quotas; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_quotas (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    quota_period_start date NOT NULL,
    quota_period_end date NOT NULL,
    quota_type character varying NOT NULL,
    employee_id character varying NOT NULL,
    department character varying,
    team_id character varying,
    territory character varying,
    quota_amount numeric(12,2) NOT NULL,
    stretch_goal_amount numeric(12,2),
    minimum_threshold numeric(12,2),
    current_achievement numeric(12,2) DEFAULT 0,
    achievement_percentage numeric(5,2) DEFAULT 0,
    monthly_breakdown jsonb,
    product_category_breakdown jsonb,
    bonus_structure jsonb,
    penalty_structure jsonb,
    status character varying DEFAULT 'active'::character varying,
    last_updated_date date DEFAULT CURRENT_DATE,
    created_by character varying NOT NULL,
    approved_by character varying,
    approval_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sales_quotas OWNER TO neondb_owner;

--
-- Name: sales_representatives; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sales_representatives (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    employee_id character varying NOT NULL,
    user_id character varying,
    rep_name character varying NOT NULL,
    rep_email character varying,
    rep_phone character varying,
    manager_id character varying,
    team_id character varying,
    territory_assignment jsonb,
    account_assignments jsonb,
    primary_commission_structure_id character varying,
    override_commission_rates jsonb,
    quota_targets jsonb,
    current_month_sales numeric(12,2) DEFAULT 0,
    current_quarter_sales numeric(12,2) DEFAULT 0,
    current_year_sales numeric(12,2) DEFAULT 0,
    quota_achievement_percentage numeric(5,2) DEFAULT 0,
    commission_payment_method character varying DEFAULT 'payroll'::character varying,
    tax_classification character varying DEFAULT 'employee'::character varying,
    employment_status character varying DEFAULT 'active'::character varying,
    hire_date date,
    termination_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sales_representatives OWNER TO neondb_owner;

--
-- Name: seo_pages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.seo_pages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying,
    path character varying NOT NULL,
    title character varying,
    description text,
    lastmod timestamp without time zone DEFAULT now(),
    changefreq character varying DEFAULT 'monthly'::character varying,
    priority numeric(2,1) DEFAULT 0.5,
    include_in_sitemap boolean DEFAULT true,
    schema_type character varying,
    schema_data jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.seo_pages OWNER TO neondb_owner;

--
-- Name: seo_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.seo_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying,
    site_name character varying,
    site_url character varying,
    default_title character varying,
    default_description text,
    default_og_image character varying,
    twitter_handle character varying,
    allow_ai_crawling boolean DEFAULT true,
    sitemap_changefreq character varying DEFAULT 'weekly'::character varying,
    sitemap_priority_default numeric(2,1) DEFAULT 0.5,
    last_sitemap_generated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.seo_settings OWNER TO neondb_owner;

--
-- Name: service_performance_metrics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_performance_metrics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    metric_date date NOT NULL,
    metric_period character varying NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_service_calls integer DEFAULT 0,
    emergency_calls integer DEFAULT 0,
    routine_maintenance integer DEFAULT 0,
    installations integer DEFAULT 0,
    repairs integer DEFAULT 0,
    average_response_time_minutes numeric(8,2) DEFAULT 0,
    median_response_time_minutes numeric(8,2) DEFAULT 0,
    first_call_resolution_rate numeric(5,2) DEFAULT 0,
    total_technician_hours numeric(10,2) DEFAULT 0,
    billable_hours numeric(10,2) DEFAULT 0,
    travel_time_hours numeric(10,2) DEFAULT 0,
    utilization_rate numeric(5,2) DEFAULT 0,
    average_satisfaction_score numeric(3,2) DEFAULT 0,
    nps_score numeric(5,2) DEFAULT 0,
    complaint_count integer DEFAULT 0,
    escalation_count integer DEFAULT 0,
    total_service_revenue numeric(12,2) DEFAULT 0,
    parts_revenue numeric(12,2) DEFAULT 0,
    labor_revenue numeric(12,2) DEFAULT 0,
    average_service_value numeric(10,2) DEFAULT 0,
    jobs_completed_on_time integer DEFAULT 0,
    jobs_completed_late integer DEFAULT 0,
    rework_required integer DEFAULT 0,
    callbacks_within_30_days integer DEFAULT 0,
    devices_under_service integer DEFAULT 0,
    preventive_maintenance_completed integer DEFAULT 0,
    equipment_downtime_hours numeric(10,2) DEFAULT 0,
    parts_accuracy_rate numeric(5,2) DEFAULT 0,
    diagnostic_accuracy_rate numeric(5,2) DEFAULT 0,
    documentation_completeness numeric(5,2) DEFAULT 0,
    month_over_month_growth numeric(6,2) DEFAULT 0,
    year_over_year_growth numeric(6,2) DEFAULT 0,
    industry_benchmark_score numeric(5,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.service_performance_metrics OWNER TO neondb_owner;

--
-- Name: service_products; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    product_code character varying NOT NULL,
    product_name character varying NOT NULL,
    category character varying DEFAULT 'Service'::character varying,
    service_type character varying,
    pricing_level character varying,
    description text,
    summary text,
    note text,
    ea_notes text,
    related_products text,
    is_active boolean DEFAULT true,
    available_for_all boolean DEFAULT false,
    repost_edit boolean DEFAULT false,
    sales_rep_credit boolean DEFAULT true,
    funding boolean DEFAULT true,
    lease boolean DEFAULT false,
    payment_type character varying,
    new_active boolean DEFAULT false,
    new_rep_price numeric,
    upgrade_active boolean DEFAULT false,
    upgrade_rep_price numeric,
    lexmark_active boolean DEFAULT false,
    lexmark_rep_price numeric,
    graphic_active boolean DEFAULT false,
    graphic_rep_price numeric,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.service_products OWNER TO neondb_owner;

--
-- Name: service_requests; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_requests (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_portal_user_id character varying NOT NULL,
    business_record_id character varying NOT NULL,
    equipment_id character varying,
    request_type character varying NOT NULL,
    priority character varying DEFAULT 'medium'::character varying,
    subject character varying NOT NULL,
    description text NOT NULL,
    status character varying DEFAULT 'submitted'::character varying,
    equipment_make character varying,
    equipment_model character varying,
    equipment_serial character varying,
    meter_reading integer,
    preferred_contact_method character varying DEFAULT 'email'::character varying,
    preferred_service_time character varying,
    urgency_reason text,
    attachments jsonb,
    assigned_technician_id character varying,
    scheduled_date timestamp without time zone,
    estimated_duration integer,
    resolution_notes text,
    completed_at timestamp without time zone,
    customer_satisfaction_rating integer,
    customer_feedback text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.service_requests OWNER TO neondb_owner;

--
-- Name: service_templates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    template_name character varying NOT NULL,
    template_description text,
    service_type character varying NOT NULL,
    equipment_type character varying,
    estimated_duration_minutes integer DEFAULT 60,
    technician_level character varying,
    required_skills jsonb,
    required_parts jsonb,
    required_tools jsonb,
    pre_service_checklist jsonb,
    service_checklist jsonb,
    post_service_checklist jsonb,
    labor_cost numeric(10,2),
    materials_cost numeric(10,2),
    total_cost numeric(10,2),
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.service_templates OWNER TO neondb_owner;

--
-- Name: service_ticket_updates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_ticket_updates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    ticket_id character varying NOT NULL,
    update_type character varying NOT NULL,
    old_value text,
    new_value text,
    notes text,
    updated_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.service_ticket_updates OWNER TO neondb_owner;

--
-- Name: service_tickets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_tickets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    equipment_id character varying,
    ticket_number character varying NOT NULL,
    title character varying NOT NULL,
    description text,
    priority character varying DEFAULT 'medium'::character varying NOT NULL,
    status character varying DEFAULT 'open'::character varying NOT NULL,
    assigned_technician_id character varying,
    created_by character varying NOT NULL,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    scheduled_date timestamp without time zone,
    estimated_duration integer,
    customer_address text,
    customer_phone character varying,
    required_skills text[],
    required_parts text[],
    work_order_notes text,
    resolution_notes text,
    customer_signature text,
    parts_used text[],
    labor_hours numeric(4,2)
);


ALTER TABLE public.service_tickets OWNER TO neondb_owner;

--
-- Name: service_trend_analysis; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.service_trend_analysis (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    trend_category character varying NOT NULL,
    analysis_date date NOT NULL,
    period_type character varying NOT NULL,
    current_value numeric(15,4) NOT NULL,
    previous_value numeric(15,4),
    percentage_change numeric(8,4),
    trend_direction character varying,
    moving_average_7d numeric(15,4),
    moving_average_30d numeric(15,4),
    seasonal_adjustment numeric(15,4),
    variance numeric(15,4),
    forecasted_next_period numeric(15,4),
    forecast_confidence numeric(5,2),
    forecast_range_min numeric(15,4),
    forecast_range_max numeric(15,4),
    contributing_factors jsonb,
    external_influences jsonb,
    threshold_breach boolean DEFAULT false,
    alert_level character varying,
    threshold_value numeric(15,4),
    trend_insights text,
    recommended_actions jsonb,
    impact_assessment character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.service_trend_analysis OWNER TO neondb_owner;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO neondb_owner;

--
-- Name: social_media_cron_jobs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.social_media_cron_jobs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    cron_expression character varying NOT NULL,
    is_active boolean DEFAULT true,
    prompt_template text NOT NULL,
    target_platforms jsonb NOT NULL,
    webhook_url character varying NOT NULL,
    last_executed timestamp without time zone,
    next_execution timestamp without time zone,
    execution_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.social_media_cron_jobs OWNER TO neondb_owner;

--
-- Name: social_media_posts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.social_media_posts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    generation_type character varying NOT NULL,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    claude_model character varying DEFAULT 'claude-sonnet-4-20250514'::character varying,
    claude_prompt text,
    claude_response jsonb,
    title character varying NOT NULL,
    short_content text NOT NULL,
    long_content text NOT NULL,
    website_link character varying DEFAULT 'https://printyx.net'::character varying,
    scheduled_for timestamp without time zone,
    cron_expression character varying,
    is_recurring boolean DEFAULT false,
    webhook_url character varying,
    webhook_payload jsonb,
    webhook_status character varying,
    webhook_sent_at timestamp without time zone,
    target_platforms jsonb,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.social_media_posts OWNER TO neondb_owner;

--
-- Name: software_products; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.software_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    product_code character varying NOT NULL,
    product_name character varying NOT NULL,
    product_type character varying,
    category character varying,
    accessory_type character varying,
    description text,
    summary text,
    note text,
    ea_notes text,
    config_note text,
    related_products text,
    is_active boolean DEFAULT true,
    available_for_all boolean DEFAULT false,
    repost_edit boolean DEFAULT false,
    sales_rep_credit boolean DEFAULT true,
    funding boolean DEFAULT true,
    lease boolean DEFAULT false,
    payment_type character varying,
    standard_active boolean DEFAULT false,
    standard_cost numeric,
    standard_rep_price numeric,
    new_active boolean DEFAULT false,
    new_cost numeric,
    new_rep_price numeric,
    upgrade_active boolean DEFAULT false,
    upgrade_cost numeric,
    upgrade_rep_price numeric,
    price_book_id character varying,
    temp_key character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.software_products OWNER TO neondb_owner;

--
-- Name: supplies; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.supplies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    product_code character varying NOT NULL,
    product_name character varying NOT NULL,
    product_type character varying DEFAULT 'Supplies'::character varying,
    dealer_comp character varying,
    inventory character varying,
    in_stock character varying,
    summary text,
    note text,
    ea_notes text,
    related_products text,
    is_active boolean DEFAULT true,
    available_for_all boolean DEFAULT false,
    repost_edit boolean DEFAULT false,
    sales_rep_credit boolean DEFAULT true,
    funding boolean DEFAULT true,
    lease boolean DEFAULT false,
    payment_type character varying,
    new_active boolean DEFAULT false,
    new_rep_price numeric,
    upgrade_active boolean DEFAULT false,
    upgrade_rep_price numeric,
    lexmark_active boolean DEFAULT false,
    lexmark_rep_price numeric,
    graphic_active boolean DEFAULT false,
    graphic_rep_price numeric,
    price_book_id character varying,
    temp_key character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.supplies OWNER TO neondb_owner;

--
-- Name: supply_order_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.supply_order_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    supply_order_id character varying NOT NULL,
    product_type character varying NOT NULL,
    product_id character varying,
    product_name character varying NOT NULL,
    product_code character varying,
    manufacturer character varying,
    model_compatibility character varying,
    quantity_requested integer NOT NULL,
    quantity_approved integer,
    quantity_shipped integer,
    quantity_delivered integer,
    unit_price numeric(10,2),
    line_total numeric(10,2),
    specifications jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.supply_order_items OWNER TO neondb_owner;

--
-- Name: supply_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.supply_orders (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    customer_portal_user_id character varying NOT NULL,
    business_record_id character varying NOT NULL,
    order_number character varying NOT NULL,
    order_type character varying DEFAULT 'supplies'::character varying,
    status character varying DEFAULT 'pending'::character varying,
    priority character varying DEFAULT 'standard'::character varying,
    delivery_method character varying DEFAULT 'standard'::character varying,
    delivery_address jsonb,
    delivery_instructions text,
    requested_delivery_date timestamp without time zone,
    estimated_delivery_date timestamp without time zone,
    actual_delivery_date timestamp without time zone,
    subtotal numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    shipping_cost numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0,
    special_instructions text,
    purchase_order_number character varying,
    billing_address jsonb,
    payment_terms character varying DEFAULT 'net_30'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.supply_orders OWNER TO neondb_owner;

--
-- Name: system_integrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.system_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    provider character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'inactive'::character varying NOT NULL,
    configuration jsonb,
    credentials jsonb,
    last_sync timestamp without time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.system_integrations OWNER TO neondb_owner;

--
-- Name: system_permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.system_permissions (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100) NOT NULL,
    description text,
    module character varying(100) NOT NULL,
    resource_type character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    scope_level character varying(50) NOT NULL,
    is_sensitive boolean DEFAULT false NOT NULL,
    business_impact character varying(50) DEFAULT 'MEDIUM'::character varying,
    compliance_tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.system_permissions OWNER TO neondb_owner;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.teams (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name character varying(100) NOT NULL,
    department character varying(30) NOT NULL,
    manager_id character varying,
    parent_team_id character varying,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    location_id character varying
);


ALTER TABLE public.teams OWNER TO neondb_owner;

--
-- Name: technician_availability; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.technician_availability (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    date timestamp without time zone NOT NULL,
    start_time character varying NOT NULL,
    end_time character varying NOT NULL,
    is_booked boolean DEFAULT false,
    ticket_id character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.technician_availability OWNER TO neondb_owner;

--
-- Name: technician_locations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.technician_locations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    recorded_at timestamp without time zone NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    accuracy_meters numeric(8,2),
    altitude_meters numeric(8,2),
    speed_mph numeric(6,2),
    heading_degrees numeric(6,2),
    location_type character varying,
    work_order_id character varying,
    customer_id character varying,
    street_address text,
    city character varying,
    state character varying,
    zip_code character varying,
    device_battery_level integer,
    device_id character varying,
    app_version character varying,
    location_source character varying DEFAULT 'gps'::character varying,
    is_accurate boolean DEFAULT true,
    privacy_level character varying DEFAULT 'business'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.technician_locations OWNER TO neondb_owner;

--
-- Name: technician_performance_analytics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.technician_performance_analytics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    analysis_period_start date NOT NULL,
    analysis_period_end date NOT NULL,
    analysis_type character varying NOT NULL,
    total_jobs_completed integer DEFAULT 0,
    emergency_responses integer DEFAULT 0,
    routine_maintenance integer DEFAULT 0,
    installations_performed integer DEFAULT 0,
    total_work_hours numeric(8,2) DEFAULT 0,
    billable_hours numeric(8,2) DEFAULT 0,
    travel_hours numeric(8,2) DEFAULT 0,
    overtime_hours numeric(8,2) DEFAULT 0,
    average_job_completion_time numeric(6,2) DEFAULT 0,
    first_time_fix_rate numeric(5,2) DEFAULT 0,
    customer_satisfaction_avg numeric(3,2) DEFAULT 0,
    revenue_generated numeric(10,2) DEFAULT 0,
    parts_sales numeric(10,2) DEFAULT 0,
    upsell_revenue numeric(10,2) DEFAULT 0,
    revenue_per_hour numeric(8,2) DEFAULT 0,
    rework_incidents integer DEFAULT 0,
    customer_complaints integer DEFAULT 0,
    safety_incidents integer DEFAULT 0,
    documentation_score numeric(5,2) DEFAULT 0,
    productivity_score numeric(5,2) DEFAULT 0,
    efficiency_ranking integer,
    improvement_trend character varying,
    certifications_earned integer DEFAULT 0,
    training_hours numeric(6,2) DEFAULT 0,
    skill_assessment_score numeric(5,2) DEFAULT 0,
    monthly_target_achievement numeric(5,2) DEFAULT 0,
    annual_goal_progress numeric(5,2) DEFAULT 0,
    bonus_eligibility boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.technician_performance_analytics OWNER TO neondb_owner;

--
-- Name: technician_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.technician_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    service_ticket_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    check_in_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    check_out_time timestamp without time zone,
    gps_location character varying,
    session_status character varying DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.technician_sessions OWNER TO neondb_owner;

--
-- Name: technician_time_tracking; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.technician_time_tracking (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    work_order_id character varying,
    time_entry_type character varying NOT NULL,
    timestamp_recorded timestamp without time zone NOT NULL,
    location_at_timestamp jsonb,
    location_accuracy_meters numeric(8,2),
    time_category character varying NOT NULL,
    activity_description text,
    duration_minutes integer,
    billable_minutes integer,
    overtime_minutes integer DEFAULT 0,
    customer_id character varying,
    job_code character varying,
    project_id character varying,
    verification_method character varying DEFAULT 'gps'::character varying,
    verification_photo_url character varying,
    supervisor_approval_required boolean DEFAULT false,
    supervisor_approved_by character varying,
    supervisor_approved_at timestamp without time zone,
    exception_reason character varying,
    adjustment_minutes integer DEFAULT 0,
    adjustment_reason text,
    adjusted_by character varying,
    adjusted_at timestamp without time zone,
    device_id character varying,
    app_version character varying,
    network_quality character varying,
    offline_recorded boolean DEFAULT false,
    sync_status character varying DEFAULT 'synced'::character varying,
    sync_conflicts jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.technician_time_tracking OWNER TO neondb_owner;

--
-- Name: technicians; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.technicians (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    user_id character varying NOT NULL,
    employee_id character varying,
    skills text[],
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    email character varying NOT NULL,
    phone character varying,
    certifications text[],
    current_location text,
    is_available boolean DEFAULT true,
    working_hours text,
    hourly_rate numeric(10,2)
);


ALTER TABLE public.technicians OWNER TO neondb_owner;

--
-- Name: tenant_catalog_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tenant_catalog_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    auto_enable_new_products boolean DEFAULT false,
    default_markup_percentage numeric(5,2) DEFAULT 25.00,
    require_approval_for_enablement boolean DEFAULT false,
    import_tracking_enabled boolean DEFAULT true,
    last_catalog_sync timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tenant_catalog_settings OWNER TO neondb_owner;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tenants (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    domain character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    slug character varying,
    subdomain_prefix character varying,
    path_prefix character varying,
    is_active boolean DEFAULT true,
    plan character varying(20) DEFAULT 'basic'::character varying
);


ALTER TABLE public.tenants OWNER TO neondb_owner;

--
-- Name: ticket_parts_requests; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.ticket_parts_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    service_ticket_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    part_number character varying NOT NULL,
    part_description text,
    quantity integer NOT NULL,
    estimated_cost numeric(10,2),
    vendor_id character varying,
    status character varying DEFAULT 'pending'::character varying,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_at timestamp without time zone,
    approved_by character varying,
    rejected_reason text,
    expected_delivery_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ticket_parts_requests OWNER TO neondb_owner;

--
-- Name: user_location_assignments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_location_assignments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    user_id character varying NOT NULL,
    location_id character varying NOT NULL,
    access_type character varying(20) DEFAULT 'full'::character varying,
    assigned_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_location_assignments OWNER TO neondb_owner;

--
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_role_assignments (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    role_id character varying(255) NOT NULL,
    tenant_id character varying(255) NOT NULL,
    organizational_unit_id character varying(255),
    assigned_by character varying(255) NOT NULL,
    assignment_reason text,
    is_active boolean DEFAULT true NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_until timestamp with time zone,
    territory_restrictions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_role_assignments OWNER TO neondb_owner;

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_settings (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    tenant_id character varying NOT NULL,
    first_name character varying,
    last_name character varying,
    email character varying,
    phone character varying,
    job_title character varying,
    department character varying,
    bio text,
    avatar character varying,
    theme character varying DEFAULT 'system'::character varying,
    language character varying DEFAULT 'en'::character varying,
    timezone character varying DEFAULT 'America/New_York'::character varying,
    date_format character varying DEFAULT 'MM/dd/yyyy'::character varying,
    time_format character varying DEFAULT '12'::character varying,
    currency character varying DEFAULT 'USD'::character varying,
    notifications jsonb DEFAULT '{"sms": false, "push": true, "email": true, "marketing": false}'::jsonb,
    accessibility jsonb DEFAULT '{"fontSize": "medium", "colorBlind": "none", "highContrast": false, "screenReader": false, "soundEnabled": true, "reducedMotion": false, "voiceCommands": false, "keyboardNavigation": false}'::jsonb,
    two_factor_enabled boolean DEFAULT false,
    two_factor_secret character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_settings OWNER TO neondb_owner;

--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    tenant_id character varying,
    role character varying DEFAULT 'user'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    password_hash character varying,
    role_id character varying,
    team_id character varying,
    manager_id character varying,
    employee_id character varying,
    is_active boolean DEFAULT true,
    last_login_at timestamp without time zone,
    is_platform_user boolean DEFAULT false,
    primary_location_id character varying,
    region_id character varying,
    access_scope character varying(20) DEFAULT 'location'::character varying
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: vendor_bills; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendor_bills (
    id integer NOT NULL,
    tenant_id character varying(255) NOT NULL,
    vendor_ref character varying(255),
    total_amount numeric(10,2),
    balance numeric(10,2),
    due_date date,
    txn_date date,
    private_note text,
    status character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.vendor_bills OWNER TO neondb_owner;

--
-- Name: vendor_bills_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.vendor_bills_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_bills_id_seq OWNER TO neondb_owner;

--
-- Name: vendor_bills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.vendor_bills_id_seq OWNED BY public.vendor_bills.id;


--
-- Name: voice_notes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.voice_notes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    technician_id character varying NOT NULL,
    work_order_id character varying,
    note_category character varying NOT NULL,
    audio_file_url character varying NOT NULL,
    audio_duration_seconds integer,
    audio_format character varying DEFAULT 'mp3'::character varying,
    audio_file_size_mb numeric(8,2),
    transcription_text text,
    transcription_confidence numeric(5,4),
    transcription_status character varying DEFAULT 'pending'::character varying,
    transcription_language character varying DEFAULT 'en'::character varying,
    manual_transcription text,
    location_recorded jsonb,
    recorded_timestamp timestamp without time zone NOT NULL,
    note_title character varying,
    tags jsonb,
    sentiment_analysis jsonb,
    keywords_extracted jsonb,
    action_items_detected jsonb,
    urgency_level character varying,
    shared_with_supervisor boolean DEFAULT false,
    shared_with_customer boolean DEFAULT false,
    internal_only boolean DEFAULT true,
    requires_follow_up boolean DEFAULT false,
    contains_sensitive_info boolean DEFAULT false,
    compliance_reviewed boolean DEFAULT false,
    reviewed_by character varying,
    reviewed_at timestamp without time zone,
    device_id character varying,
    recording_quality character varying,
    background_noise_level character varying,
    backed_up boolean DEFAULT false,
    backup_location character varying,
    retention_expiry_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.voice_notes OWNER TO neondb_owner;

--
-- Name: workflow_executions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.workflow_executions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    execution_id character varying NOT NULL,
    workflow_template_id character varying NOT NULL,
    execution_name character varying,
    triggered_by_user_id character varying,
    triggered_by_event character varying,
    trigger_data jsonb,
    context_data jsonb,
    input_parameters jsonb,
    status character varying DEFAULT 'pending'::character varying,
    current_step_index integer DEFAULT 0,
    completed_steps integer DEFAULT 0,
    total_steps integer NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    paused_at timestamp without time zone,
    execution_duration_minutes numeric(10,2),
    assigned_to character varying,
    pending_approval_from character varying,
    approval_status character varying,
    execution_results jsonb,
    final_output jsonb,
    error_details jsonb,
    progress_percentage numeric(5,2) DEFAULT 0,
    last_activity_at timestamp without time zone DEFAULT now(),
    next_action_due timestamp without time zone,
    priority character varying DEFAULT 'medium'::character varying,
    scheduled_start timestamp without time zone,
    max_completion_time timestamp without time zone,
    alerts_sent jsonb,
    escalation_level integer DEFAULT 0,
    manual_interventions integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.workflow_executions OWNER TO neondb_owner;

--
-- Name: workflow_step_executions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.workflow_step_executions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    workflow_execution_id character varying NOT NULL,
    step_index integer NOT NULL,
    step_name character varying NOT NULL,
    step_type character varying NOT NULL,
    step_config jsonb NOT NULL,
    input_data jsonb,
    expected_output jsonb,
    status character varying DEFAULT 'pending'::character varying,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    execution_time_seconds numeric(8,2),
    output_data jsonb,
    success boolean,
    error_message text,
    error_code character varying,
    attempt_number integer DEFAULT 1,
    max_attempts integer DEFAULT 3,
    retry_after timestamp without time zone,
    assigned_to character varying,
    completed_by character varying,
    manual_input jsonb,
    depends_on_steps jsonb,
    blocks_steps jsonb,
    requires_approval boolean DEFAULT false,
    approval_request_sent_at timestamp without time zone,
    approved_by character varying,
    approval_notes text,
    external_system character varying,
    api_call_details jsonb,
    webhook_response jsonb,
    performance_metrics jsonb,
    resource_usage jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.workflow_step_executions OWNER TO neondb_owner;

--
-- Name: workflow_steps; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.workflow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    session_id character varying NOT NULL,
    step_name character varying NOT NULL,
    step_started timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    step_completed timestamp without time zone,
    step_data jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workflow_steps OWNER TO neondb_owner;

--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.workflow_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    template_name character varying NOT NULL,
    template_description text,
    template_category character varying NOT NULL,
    template_version character varying DEFAULT '1.0'::character varying,
    workflow_steps jsonb NOT NULL,
    trigger_conditions jsonb NOT NULL,
    execution_rules jsonb,
    is_active boolean DEFAULT true,
    auto_start boolean DEFAULT true,
    requires_approval boolean DEFAULT false,
    priority character varying DEFAULT 'medium'::character varying,
    execution_delay_minutes integer DEFAULT 0,
    max_execution_time_hours integer DEFAULT 24,
    retry_attempts integer DEFAULT 3,
    retry_delay_minutes integer DEFAULT 15,
    default_assignee_id character varying,
    escalation_rules jsonb,
    notification_settings jsonb,
    required_integrations jsonb,
    prerequisite_workflows jsonb,
    success_criteria jsonb,
    failure_criteria jsonb,
    monitoring_enabled boolean DEFAULT true,
    approval_required_steps jsonb,
    approver_roles jsonb,
    approval_timeout_hours integer DEFAULT 48,
    execution_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    average_completion_time_minutes numeric(8,2) DEFAULT 0,
    created_by character varying NOT NULL,
    is_system_template boolean DEFAULT false,
    is_published boolean DEFAULT false,
    tags jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.workflow_templates OWNER TO neondb_owner;

--
-- Name: accounts_receivable id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.accounts_receivable ALTER COLUMN id SET DEFAULT nextval('public.accounts_receivable_id_seq'::regclass);


--
-- Name: gl_accounts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.gl_accounts ALTER COLUMN id SET DEFAULT nextval('public.gl_accounts_id_seq'::regclass);


--
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- Name: payment_terms id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_terms ALTER COLUMN id SET DEFAULT nextval('public.payment_terms_id_seq'::regclass);


--
-- Name: qb_customers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_customers ALTER COLUMN id SET DEFAULT nextval('public.qb_customers_id_seq'::regclass);


--
-- Name: qb_invoices id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_invoices ALTER COLUMN id SET DEFAULT nextval('public.qb_invoices_id_seq'::regclass);


--
-- Name: qb_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_items ALTER COLUMN id SET DEFAULT nextval('public.qb_items_id_seq'::regclass);


--
-- Name: qb_vendors id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_vendors ALTER COLUMN id SET DEFAULT nextval('public.qb_vendors_id_seq'::regclass);


--
-- Name: quickbooks_integrations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quickbooks_integrations ALTER COLUMN id SET DEFAULT nextval('public.quickbooks_integrations_id_seq'::regclass);


--
-- Name: vendor_bills id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_bills ALTER COLUMN id SET DEFAULT nextval('public.vendor_bills_id_seq'::regclass);


--
-- Name: accounts_payable accounts_payable_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.accounts_payable
    ADD CONSTRAINT accounts_payable_pkey PRIMARY KEY (id);


--
-- Name: accounts_receivable accounts_receivable_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.accounts_receivable
    ADD CONSTRAINT accounts_receivable_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automated_tasks automated_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.automated_tasks
    ADD CONSTRAINT automated_tasks_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: billing_adjustments billing_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.billing_adjustments
    ADD CONSTRAINT billing_adjustments_pkey PRIMARY KEY (id);


--
-- Name: billing_configurations billing_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.billing_configurations
    ADD CONSTRAINT billing_configurations_pkey PRIMARY KEY (id);


--
-- Name: billing_cycles billing_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.billing_cycles
    ADD CONSTRAINT billing_cycles_pkey PRIMARY KEY (id);


--
-- Name: billing_invoices billing_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: billing_invoices billing_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.billing_invoices
    ADD CONSTRAINT billing_invoices_pkey PRIMARY KEY (id);


--
-- Name: billing_line_items billing_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.billing_line_items
    ADD CONSTRAINT billing_line_items_pkey PRIMARY KEY (id);


--
-- Name: budget_vs_actual budget_vs_actual_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budget_vs_actual
    ADD CONSTRAINT budget_vs_actual_pkey PRIMARY KEY (id);


--
-- Name: business_intelligence_dashboards business_intelligence_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.business_intelligence_dashboards
    ADD CONSTRAINT business_intelligence_dashboards_pkey PRIMARY KEY (id);


--
-- Name: business_record_activities business_record_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.business_record_activities
    ADD CONSTRAINT business_record_activities_pkey PRIMARY KEY (id);


--
-- Name: business_records business_records_customer_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.business_records
    ADD CONSTRAINT business_records_customer_number_key UNIQUE (customer_number);


--
-- Name: business_records business_records_id_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.business_records
    ADD CONSTRAINT business_records_id_tenant_id_key UNIQUE (id, tenant_id);


--
-- Name: business_records business_records_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.business_records
    ADD CONSTRAINT business_records_pkey PRIMARY KEY (id);


--
-- Name: cash_flow_projections cash_flow_projections_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cash_flow_projections
    ADD CONSTRAINT cash_flow_projections_pkey PRIMARY KEY (id);


--
-- Name: commission_analytics commission_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commission_analytics
    ADD CONSTRAINT commission_analytics_pkey PRIMARY KEY (id);


--
-- Name: commission_calculations commission_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commission_calculations
    ADD CONSTRAINT commission_calculations_pkey PRIMARY KEY (id);


--
-- Name: commission_disputes commission_disputes_dispute_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commission_disputes
    ADD CONSTRAINT commission_disputes_dispute_number_key UNIQUE (dispute_number);


--
-- Name: commission_disputes commission_disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commission_disputes
    ADD CONSTRAINT commission_disputes_pkey PRIMARY KEY (id);


--
-- Name: commission_payments commission_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_pkey PRIMARY KEY (id);


--
-- Name: commission_sales_data commission_sales_data_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commission_sales_data
    ADD CONSTRAINT commission_sales_data_pkey PRIMARY KEY (id);


--
-- Name: commission_structures commission_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commission_structures
    ADD CONSTRAINT commission_structures_pkey PRIMARY KEY (id);


--
-- Name: commission_transactions commission_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.commission_transactions
    ADD CONSTRAINT commission_transactions_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_contacts company_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.company_contacts
    ADD CONSTRAINT company_contacts_pkey PRIMARY KEY (id);


--
-- Name: company_pricing_settings company_pricing_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.company_pricing_settings
    ADD CONSTRAINT company_pricing_settings_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: cpc_rates cpc_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cpc_rates
    ADD CONSTRAINT cpc_rates_pkey PRIMARY KEY (id);


--
-- Name: customer_activities customer_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_activities
    ADD CONSTRAINT customer_activities_pkey PRIMARY KEY (id);


--
-- Name: customer_contacts customer_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_pkey PRIMARY KEY (id);


--
-- Name: customer_equipment customer_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_equipment
    ADD CONSTRAINT customer_equipment_pkey PRIMARY KEY (id);


--
-- Name: customer_interactions customer_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_interactions
    ADD CONSTRAINT customer_interactions_pkey PRIMARY KEY (id);


--
-- Name: customer_meter_submissions customer_meter_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_meter_submissions
    ADD CONSTRAINT customer_meter_submissions_pkey PRIMARY KEY (id);


--
-- Name: customer_notifications customer_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_pkey PRIMARY KEY (id);


--
-- Name: customer_number_config customer_number_config_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_number_config
    ADD CONSTRAINT customer_number_config_pkey PRIMARY KEY (id);


--
-- Name: customer_number_history customer_number_history_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_number_history
    ADD CONSTRAINT customer_number_history_pkey PRIMARY KEY (id);


--
-- Name: customer_payments customer_payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: customer_payments customer_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_pkey PRIMARY KEY (id);


--
-- Name: customer_portal_access customer_portal_access_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_portal_access
    ADD CONSTRAINT customer_portal_access_pkey PRIMARY KEY (id);


--
-- Name: customer_portal_access customer_portal_access_username_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_portal_access
    ADD CONSTRAINT customer_portal_access_username_key UNIQUE (username);


--
-- Name: customer_portal_activity_log customer_portal_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_portal_activity_log
    ADD CONSTRAINT customer_portal_activity_log_pkey PRIMARY KEY (id);


--
-- Name: customer_related_records customer_related_records_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_related_records
    ADD CONSTRAINT customer_related_records_pkey PRIMARY KEY (id);


--
-- Name: customer_service_requests customer_service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_service_requests
    ADD CONSTRAINT customer_service_requests_pkey PRIMARY KEY (id);


--
-- Name: customer_service_requests customer_service_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_service_requests
    ADD CONSTRAINT customer_service_requests_request_number_key UNIQUE (request_number);


--
-- Name: customer_supply_order_items customer_supply_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_supply_order_items
    ADD CONSTRAINT customer_supply_order_items_pkey PRIMARY KEY (id);


--
-- Name: customer_supply_orders customer_supply_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_supply_orders
    ADD CONSTRAINT customer_supply_orders_order_number_key UNIQUE (order_number);


--
-- Name: customer_supply_orders customer_supply_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_supply_orders
    ADD CONSTRAINT customer_supply_orders_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deal_activities deal_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deal_activities
    ADD CONSTRAINT deal_activities_pkey PRIMARY KEY (id);


--
-- Name: deal_stages deal_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deal_stages
    ADD CONSTRAINT deal_stages_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: device_metrics device_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.device_metrics
    ADD CONSTRAINT device_metrics_pkey PRIMARY KEY (id);


--
-- Name: device_performance_trends device_performance_trends_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.device_performance_trends
    ADD CONSTRAINT device_performance_trends_pkey PRIMARY KEY (id);


--
-- Name: device_registrations device_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.device_registrations
    ADD CONSTRAINT device_registrations_pkey PRIMARY KEY (id);


--
-- Name: device_telemetry device_telemetry_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.device_telemetry
    ADD CONSTRAINT device_telemetry_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: enabled_products enabled_products_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.enabled_products
    ADD CONSTRAINT enabled_products_pkey PRIMARY KEY (enabled_product_id);


--
-- Name: enabled_products enabled_products_tenant_id_master_product_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.enabled_products
    ADD CONSTRAINT enabled_products_tenant_id_master_product_id_key UNIQUE (tenant_id, master_product_id);


--
-- Name: enhanced_roles enhanced_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.enhanced_roles
    ADD CONSTRAINT enhanced_roles_pkey PRIMARY KEY (id);


--
-- Name: enriched_companies enriched_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.enriched_companies
    ADD CONSTRAINT enriched_companies_pkey PRIMARY KEY (id);


--
-- Name: enriched_contacts enriched_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.enriched_contacts
    ADD CONSTRAINT enriched_contacts_pkey PRIMARY KEY (id);


--
-- Name: equipment_asset_tracking equipment_asset_tracking_asset_tag_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_asset_tracking
    ADD CONSTRAINT equipment_asset_tracking_asset_tag_key UNIQUE (asset_tag);


--
-- Name: equipment_asset_tracking equipment_asset_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_asset_tracking
    ADD CONSTRAINT equipment_asset_tracking_pkey PRIMARY KEY (id);


--
-- Name: equipment_delivery_schedules equipment_delivery_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_delivery_schedules
    ADD CONSTRAINT equipment_delivery_schedules_pkey PRIMARY KEY (id);


--
-- Name: equipment_installations equipment_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_installations
    ADD CONSTRAINT equipment_installations_pkey PRIMARY KEY (id);


--
-- Name: equipment_lifecycle_stages equipment_lifecycle_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_lifecycle_stages
    ADD CONSTRAINT equipment_lifecycle_stages_pkey PRIMARY KEY (id);


--
-- Name: equipment_packages equipment_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_packages
    ADD CONSTRAINT equipment_packages_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: equipment_purchase_orders equipment_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_purchase_orders
    ADD CONSTRAINT equipment_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: equipment_purchase_orders equipment_purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_purchase_orders
    ADD CONSTRAINT equipment_purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: equipment_status_monitoring equipment_status_monitoring_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.equipment_status_monitoring
    ADD CONSTRAINT equipment_status_monitoring_pkey PRIMARY KEY (id);


--
-- Name: field_technicians field_technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.field_technicians
    ADD CONSTRAINT field_technicians_pkey PRIMARY KEY (id);


--
-- Name: field_work_orders field_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.field_work_orders
    ADD CONSTRAINT field_work_orders_pkey PRIMARY KEY (id);


--
-- Name: field_work_orders field_work_orders_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.field_work_orders
    ADD CONSTRAINT field_work_orders_work_order_number_key UNIQUE (work_order_number);


--
-- Name: financial_forecasts financial_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.financial_forecasts
    ADD CONSTRAINT financial_forecasts_pkey PRIMARY KEY (id);


--
-- Name: financial_kpis financial_kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.financial_kpis
    ADD CONSTRAINT financial_kpis_pkey PRIMARY KEY (id);


--
-- Name: forecast_line_items forecast_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.forecast_line_items
    ADD CONSTRAINT forecast_line_items_pkey PRIMARY KEY (id);


--
-- Name: forecast_metrics forecast_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.forecast_metrics
    ADD CONSTRAINT forecast_metrics_pkey PRIMARY KEY (id);


--
-- Name: forecast_pipeline_items forecast_pipeline_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.forecast_pipeline_items
    ADD CONSTRAINT forecast_pipeline_items_pkey PRIMARY KEY (id);


--
-- Name: forecast_rules forecast_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.forecast_rules
    ADD CONSTRAINT forecast_rules_pkey PRIMARY KEY (id);


--
-- Name: gl_accounts gl_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.gl_accounts
    ADD CONSTRAINT gl_accounts_pkey PRIMARY KEY (id);


--
-- Name: gl_accounts gl_accounts_tenant_id_qb_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.gl_accounts
    ADD CONSTRAINT gl_accounts_tenant_id_qb_id_key UNIQUE (tenant_id, qb_id);


--
-- Name: gps_tracking_points gps_tracking_points_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.gps_tracking_points
    ADD CONSTRAINT gps_tracking_points_pkey PRIMARY KEY (id);


--
-- Name: integration_audit_logs integration_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.integration_audit_logs
    ADD CONSTRAINT integration_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: iot_devices iot_devices_device_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_device_id_key UNIQUE (device_id);


--
-- Name: iot_devices iot_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_articles knowledge_base_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.knowledge_base_articles
    ADD CONSTRAINT knowledge_base_articles_pkey PRIMARY KEY (id);


--
-- Name: lead_activities lead_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_activities
    ADD CONSTRAINT lead_activities_pkey PRIMARY KEY (id);


--
-- Name: lead_contacts lead_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_contacts
    ADD CONSTRAINT lead_contacts_pkey PRIMARY KEY (id);


--
-- Name: lead_related_records lead_related_records_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lead_related_records
    ADD CONSTRAINT lead_related_records_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: maintenance_notifications maintenance_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_notifications
    ADD CONSTRAINT maintenance_notifications_pkey PRIMARY KEY (id);


--
-- Name: maintenance_schedules maintenance_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_pkey PRIMARY KEY (id);


--
-- Name: maintenance_tasks maintenance_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_tasks
    ADD CONSTRAINT maintenance_tasks_pkey PRIMARY KEY (id);


--
-- Name: managed_services managed_services_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.managed_services
    ADD CONSTRAINT managed_services_pkey PRIMARY KEY (id);


--
-- Name: manufacturer_integrations manufacturer_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.manufacturer_integrations
    ADD CONSTRAINT manufacturer_integrations_pkey PRIMARY KEY (id);


--
-- Name: master_product_accessories master_product_accessories_manufacturer_accessory_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.master_product_accessories
    ADD CONSTRAINT master_product_accessories_manufacturer_accessory_code_key UNIQUE (manufacturer, accessory_code);


--
-- Name: master_product_accessories master_product_accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.master_product_accessories
    ADD CONSTRAINT master_product_accessories_pkey PRIMARY KEY (id);


--
-- Name: master_product_accessory_relationships master_product_accessory_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.master_product_accessory_relationships
    ADD CONSTRAINT master_product_accessory_relationships_pkey PRIMARY KEY (id);


--
-- Name: master_product_models master_product_models_manufacturer_model_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.master_product_models
    ADD CONSTRAINT master_product_models_manufacturer_model_code_key UNIQUE (manufacturer, model_code);


--
-- Name: master_product_models master_product_models_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.master_product_models
    ADD CONSTRAINT master_product_models_pkey PRIMARY KEY (id);


--
-- Name: meter_readings meter_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.meter_readings
    ADD CONSTRAINT meter_readings_pkey PRIMARY KEY (id);


--
-- Name: mobile_app_sessions mobile_app_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_app_sessions
    ADD CONSTRAINT mobile_app_sessions_pkey PRIMARY KEY (id);


--
-- Name: mobile_app_sessions mobile_app_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_app_sessions
    ADD CONSTRAINT mobile_app_sessions_session_id_key UNIQUE (session_id);


--
-- Name: mobile_field_metrics mobile_field_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_field_metrics
    ADD CONSTRAINT mobile_field_metrics_pkey PRIMARY KEY (id);


--
-- Name: mobile_field_orders mobile_field_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_field_orders
    ADD CONSTRAINT mobile_field_orders_order_number_key UNIQUE (order_number);


--
-- Name: mobile_field_orders mobile_field_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_field_orders
    ADD CONSTRAINT mobile_field_orders_pkey PRIMARY KEY (id);


--
-- Name: mobile_order_line_items mobile_order_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_order_line_items
    ADD CONSTRAINT mobile_order_line_items_pkey PRIMARY KEY (id);


--
-- Name: mobile_parts_inventory mobile_parts_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_parts_inventory
    ADD CONSTRAINT mobile_parts_inventory_pkey PRIMARY KEY (id);


--
-- Name: mobile_work_orders mobile_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_work_orders
    ADD CONSTRAINT mobile_work_orders_pkey PRIMARY KEY (id);


--
-- Name: mobile_work_orders mobile_work_orders_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mobile_work_orders
    ADD CONSTRAINT mobile_work_orders_work_order_number_key UNIQUE (work_order_number);


--
-- Name: monitoring_dashboards monitoring_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.monitoring_dashboards
    ADD CONSTRAINT monitoring_dashboards_pkey PRIMARY KEY (id);


--
-- Name: onboarding_checklists onboarding_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_checklists
    ADD CONSTRAINT onboarding_checklists_pkey PRIMARY KEY (id);


--
-- Name: onboarding_dynamic_sections onboarding_dynamic_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_dynamic_sections
    ADD CONSTRAINT onboarding_dynamic_sections_pkey PRIMARY KEY (id);


--
-- Name: onboarding_equipment onboarding_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_equipment
    ADD CONSTRAINT onboarding_equipment_pkey PRIMARY KEY (id);


--
-- Name: onboarding_network_config onboarding_network_config_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_network_config
    ADD CONSTRAINT onboarding_network_config_pkey PRIMARY KEY (id);


--
-- Name: onboarding_print_management onboarding_print_management_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_print_management
    ADD CONSTRAINT onboarding_print_management_pkey PRIMARY KEY (id);


--
-- Name: onboarding_tasks onboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: organizational_units organizational_units_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.organizational_units
    ADD CONSTRAINT organizational_units_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_schedules payment_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_schedules
    ADD CONSTRAINT payment_schedules_pkey PRIMARY KEY (id);


--
-- Name: payment_terms payment_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_terms
    ADD CONSTRAINT payment_terms_pkey PRIMARY KEY (id);


--
-- Name: performance_benchmarks performance_benchmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.performance_benchmarks
    ADD CONSTRAINT performance_benchmarks_pkey PRIMARY KEY (id);


--
-- Name: phone_in_tickets phone_in_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.phone_in_tickets
    ADD CONSTRAINT phone_in_tickets_pkey PRIMARY KEY (id);


--
-- Name: po_line_items po_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.po_line_items
    ADD CONSTRAINT po_line_items_pkey PRIMARY KEY (id);


--
-- Name: predictive_alerts predictive_alerts_alert_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.predictive_alerts
    ADD CONSTRAINT predictive_alerts_alert_id_key UNIQUE (alert_id);


--
-- Name: predictive_alerts predictive_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.predictive_alerts
    ADD CONSTRAINT predictive_alerts_pkey PRIMARY KEY (id);


--
-- Name: process_automation_logs process_automation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.process_automation_logs
    ADD CONSTRAINT process_automation_logs_pkey PRIMARY KEY (id);


--
-- Name: product_accessories product_accessories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_accessories
    ADD CONSTRAINT product_accessories_pkey PRIMARY KEY (id);


--
-- Name: product_models product_models_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_models
    ADD CONSTRAINT product_models_pkey PRIMARY KEY (id);


--
-- Name: product_models product_models_tenant_id_product_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_models
    ADD CONSTRAINT product_models_tenant_id_product_code_key UNIQUE (tenant_id, product_code);


--
-- Name: product_pricing product_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_pricing
    ADD CONSTRAINT product_pricing_pkey PRIMARY KEY (id);


--
-- Name: product_tags product_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_tags
    ADD CONSTRAINT product_tags_pkey PRIMARY KEY (id);


--
-- Name: professional_services professional_services_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.professional_services
    ADD CONSTRAINT professional_services_pkey PRIMARY KEY (id);


--
-- Name: professional_services professional_services_tenant_id_product_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.professional_services
    ADD CONSTRAINT professional_services_tenant_id_product_code_key UNIQUE (tenant_id, product_code);


--
-- Name: profitability_analysis profitability_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.profitability_analysis
    ADD CONSTRAINT profitability_analysis_pkey PRIMARY KEY (id);


--
-- Name: proposal_analytics proposal_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.proposal_analytics
    ADD CONSTRAINT proposal_analytics_pkey PRIMARY KEY (id);


--
-- Name: proposal_comments proposal_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.proposal_comments
    ADD CONSTRAINT proposal_comments_pkey PRIMARY KEY (id);


--
-- Name: proposal_line_items proposal_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.proposal_line_items
    ADD CONSTRAINT proposal_line_items_pkey PRIMARY KEY (id);


--
-- Name: proposal_templates proposal_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.proposal_templates
    ADD CONSTRAINT proposal_templates_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_proposal_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_proposal_number_key UNIQUE (proposal_number);


--
-- Name: prospecting_campaigns prospecting_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.prospecting_campaigns
    ADD CONSTRAINT prospecting_campaigns_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: qb_customers qb_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_customers
    ADD CONSTRAINT qb_customers_pkey PRIMARY KEY (id);


--
-- Name: qb_customers qb_customers_tenant_id_qb_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_customers
    ADD CONSTRAINT qb_customers_tenant_id_qb_id_key UNIQUE (tenant_id, qb_id);


--
-- Name: qb_invoices qb_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_invoices
    ADD CONSTRAINT qb_invoices_pkey PRIMARY KEY (id);


--
-- Name: qb_invoices qb_invoices_tenant_id_qb_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_invoices
    ADD CONSTRAINT qb_invoices_tenant_id_qb_id_key UNIQUE (tenant_id, qb_id);


--
-- Name: qb_items qb_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_items
    ADD CONSTRAINT qb_items_pkey PRIMARY KEY (id);


--
-- Name: qb_items qb_items_tenant_id_qb_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_items
    ADD CONSTRAINT qb_items_tenant_id_qb_id_key UNIQUE (tenant_id, qb_id);


--
-- Name: qb_vendors qb_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_vendors
    ADD CONSTRAINT qb_vendors_pkey PRIMARY KEY (id);


--
-- Name: qb_vendors qb_vendors_tenant_id_qb_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.qb_vendors
    ADD CONSTRAINT qb_vendors_tenant_id_qb_id_key UNIQUE (tenant_id, qb_id);


--
-- Name: quickbooks_integrations quickbooks_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quickbooks_integrations
    ADD CONSTRAINT quickbooks_integrations_pkey PRIMARY KEY (id);


--
-- Name: quickbooks_integrations quickbooks_integrations_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quickbooks_integrations
    ADD CONSTRAINT quickbooks_integrations_tenant_id_key UNIQUE (tenant_id);


--
-- Name: quote_line_items quote_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quote_line_items
    ADD CONSTRAINT quote_line_items_pkey PRIMARY KEY (id);


--
-- Name: quote_pricing_line_items quote_pricing_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quote_pricing_line_items
    ADD CONSTRAINT quote_pricing_line_items_pkey PRIMARY KEY (id);


--
-- Name: quote_pricing quote_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quote_pricing
    ADD CONSTRAINT quote_pricing_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sales_forecasts sales_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_forecasts
    ADD CONSTRAINT sales_forecasts_pkey PRIMARY KEY (id);


--
-- Name: sales_quotas sales_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_quotas
    ADD CONSTRAINT sales_quotas_pkey PRIMARY KEY (id);


--
-- Name: sales_representatives sales_representatives_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sales_representatives
    ADD CONSTRAINT sales_representatives_pkey PRIMARY KEY (id);


--
-- Name: seo_pages seo_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.seo_pages
    ADD CONSTRAINT seo_pages_pkey PRIMARY KEY (id);


--
-- Name: seo_settings seo_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_pkey PRIMARY KEY (id);


--
-- Name: service_performance_metrics service_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_performance_metrics
    ADD CONSTRAINT service_performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: service_products service_products_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_products
    ADD CONSTRAINT service_products_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: service_templates service_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_pkey PRIMARY KEY (id);


--
-- Name: service_ticket_updates service_ticket_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_ticket_updates
    ADD CONSTRAINT service_ticket_updates_pkey PRIMARY KEY (id);


--
-- Name: service_tickets service_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_tickets
    ADD CONSTRAINT service_tickets_pkey PRIMARY KEY (id);


--
-- Name: service_trend_analysis service_trend_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.service_trend_analysis
    ADD CONSTRAINT service_trend_analysis_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: social_media_cron_jobs social_media_cron_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.social_media_cron_jobs
    ADD CONSTRAINT social_media_cron_jobs_pkey PRIMARY KEY (id);


--
-- Name: social_media_posts social_media_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.social_media_posts
    ADD CONSTRAINT social_media_posts_pkey PRIMARY KEY (id);


--
-- Name: software_products software_products_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.software_products
    ADD CONSTRAINT software_products_pkey PRIMARY KEY (id);


--
-- Name: supplies supplies_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.supplies
    ADD CONSTRAINT supplies_pkey PRIMARY KEY (id);


--
-- Name: supply_order_items supply_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.supply_order_items
    ADD CONSTRAINT supply_order_items_pkey PRIMARY KEY (id);


--
-- Name: supply_orders supply_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.supply_orders
    ADD CONSTRAINT supply_orders_order_number_key UNIQUE (order_number);


--
-- Name: supply_orders supply_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.supply_orders
    ADD CONSTRAINT supply_orders_pkey PRIMARY KEY (id);


--
-- Name: system_integrations system_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_integrations
    ADD CONSTRAINT system_integrations_pkey PRIMARY KEY (id);


--
-- Name: system_permissions system_permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_permissions
    ADD CONSTRAINT system_permissions_code_key UNIQUE (code);


--
-- Name: system_permissions system_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_permissions
    ADD CONSTRAINT system_permissions_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: technician_availability technician_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.technician_availability
    ADD CONSTRAINT technician_availability_pkey PRIMARY KEY (id);


--
-- Name: technician_locations technician_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.technician_locations
    ADD CONSTRAINT technician_locations_pkey PRIMARY KEY (id);


--
-- Name: technician_performance_analytics technician_performance_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.technician_performance_analytics
    ADD CONSTRAINT technician_performance_analytics_pkey PRIMARY KEY (id);


--
-- Name: technician_sessions technician_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.technician_sessions
    ADD CONSTRAINT technician_sessions_pkey PRIMARY KEY (id);


--
-- Name: technician_time_tracking technician_time_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.technician_time_tracking
    ADD CONSTRAINT technician_time_tracking_pkey PRIMARY KEY (id);


--
-- Name: technicians technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_pkey PRIMARY KEY (id);


--
-- Name: tenant_catalog_settings tenant_catalog_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenant_catalog_settings
    ADD CONSTRAINT tenant_catalog_settings_pkey PRIMARY KEY (id);


--
-- Name: tenant_catalog_settings tenant_catalog_settings_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenant_catalog_settings
    ADD CONSTRAINT tenant_catalog_settings_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenants tenants_domain_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_domain_unique UNIQUE (domain);


--
-- Name: tenants tenants_path_prefix_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_path_prefix_key UNIQUE (path_prefix);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: tenants tenants_subdomain_prefix_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_subdomain_prefix_key UNIQUE (subdomain_prefix);


--
-- Name: ticket_parts_requests ticket_parts_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ticket_parts_requests
    ADD CONSTRAINT ticket_parts_requests_pkey PRIMARY KEY (id);


--
-- Name: user_location_assignments user_location_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_location_assignments
    ADD CONSTRAINT user_location_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_bills vendor_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_bills
    ADD CONSTRAINT vendor_bills_pkey PRIMARY KEY (id);


--
-- Name: voice_notes voice_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.voice_notes
    ADD CONSTRAINT voice_notes_pkey PRIMARY KEY (id);


--
-- Name: workflow_executions workflow_executions_execution_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_execution_id_key UNIQUE (execution_id);


--
-- Name: workflow_executions workflow_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_pkey PRIMARY KEY (id);


--
-- Name: workflow_step_executions workflow_step_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.workflow_step_executions
    ADD CONSTRAINT workflow_step_executions_pkey PRIMARY KEY (id);


--
-- Name: workflow_steps workflow_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT workflow_steps_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: activity_action_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX activity_action_idx ON public.customer_portal_activity_log USING btree (action);


--
-- Name: activity_timestamp_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX activity_timestamp_idx ON public.customer_portal_activity_log USING btree ("timestamp");


--
-- Name: idx_companies_tenant; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_companies_tenant ON public.companies USING btree (tenant_id);


--
-- Name: idx_company_contacts_company; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_company_contacts_company ON public.company_contacts USING btree (company_id);


--
-- Name: idx_company_contacts_tenant; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_company_contacts_tenant ON public.company_contacts USING btree (tenant_id);


--
-- Name: idx_leads_company; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_leads_company ON public.leads USING btree (company_id);


--
-- Name: idx_leads_contact; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_leads_contact ON public.leads USING btree (contact_id);


--
-- Name: idx_leads_owner; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_leads_owner ON public.leads USING btree (owner_id);


--
-- Name: master_relationships_accessory_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX master_relationships_accessory_idx ON public.master_product_accessory_relationships USING btree (accessory_id);


--
-- Name: master_relationships_base_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX master_relationships_base_idx ON public.master_product_accessory_relationships USING btree (base_product_id);


--
-- Name: master_relationships_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX master_relationships_unique_idx ON public.master_product_accessory_relationships USING btree (base_product_id, accessory_id);


--
-- Name: meter_equipment_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX meter_equipment_idx ON public.customer_meter_submissions USING btree (equipment_id);


--
-- Name: meter_reading_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX meter_reading_date_idx ON public.customer_meter_submissions USING btree (reading_date);


--
-- Name: meter_submission_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX meter_submission_date_idx ON public.customer_meter_submissions USING btree (submission_date);


--
-- Name: meter_validation_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX meter_validation_idx ON public.customer_meter_submissions USING btree (is_validated);


--
-- Name: notification_created_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX notification_created_idx ON public.customer_notifications USING btree (created_at);


--
-- Name: notification_type_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX notification_type_idx ON public.customer_notifications USING btree (type);


--
-- Name: payment_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payment_date_idx ON public.customer_payments USING btree (payment_date);


--
-- Name: payment_invoice_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payment_invoice_idx ON public.customer_payments USING btree (invoice_id);


--
-- Name: payment_number_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payment_number_idx ON public.customer_payments USING btree (payment_number);


--
-- Name: payment_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payment_status_idx ON public.customer_payments USING btree (status);


--
-- Name: portal_email_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX portal_email_idx ON public.customer_portal_access USING btree (email);


--
-- Name: portal_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX portal_status_idx ON public.customer_portal_access USING btree (status);


--
-- Name: portal_username_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX portal_username_idx ON public.customer_portal_access USING btree (username);


--
-- Name: seo_pages_path_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX seo_pages_path_idx ON public.seo_pages USING btree (path);


--
-- Name: service_request_number_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX service_request_number_idx ON public.customer_service_requests USING btree (request_number);


--
-- Name: service_request_priority_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX service_request_priority_idx ON public.customer_service_requests USING btree (priority);


--
-- Name: service_request_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX service_request_status_idx ON public.customer_service_requests USING btree (status);


--
-- Name: service_request_submitted_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX service_request_submitted_idx ON public.customer_service_requests USING btree (submitted_at);


--
-- Name: service_request_type_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX service_request_type_idx ON public.customer_service_requests USING btree (type);


--
-- Name: supply_order_items_order_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX supply_order_items_order_idx ON public.customer_supply_order_items USING btree (order_id);


--
-- Name: supply_order_items_product_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX supply_order_items_product_idx ON public.customer_supply_order_items USING btree (product_id);


--
-- Name: supply_order_number_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX supply_order_number_idx ON public.customer_supply_orders USING btree (order_number);


--
-- Name: supply_order_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX supply_order_status_idx ON public.customer_supply_orders USING btree (status);


--
-- Name: supply_order_submitted_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX supply_order_submitted_idx ON public.customer_supply_orders USING btree (submitted_at);


--
-- Name: tenant_customer_activity_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX tenant_customer_activity_idx ON public.customer_portal_activity_log USING btree (tenant_id, customer_id);


--
-- Name: tenant_customer_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX tenant_customer_idx ON public.customer_portal_access USING btree (tenant_id, customer_id);


--
-- Name: tenant_customer_meter_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX tenant_customer_meter_idx ON public.customer_meter_submissions USING btree (tenant_id, customer_id);


--
-- Name: tenant_customer_notification_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX tenant_customer_notification_idx ON public.customer_notifications USING btree (tenant_id, customer_id);


--
-- Name: tenant_customer_payment_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX tenant_customer_payment_idx ON public.customer_payments USING btree (tenant_id, customer_id);


--
-- Name: tenant_customer_service_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX tenant_customer_service_idx ON public.customer_service_requests USING btree (tenant_id, customer_id);


--
-- Name: tenant_customer_supply_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX tenant_customer_supply_idx ON public.customer_supply_orders USING btree (tenant_id, customer_id);


--
-- Name: unread_portal_notifications_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX unread_portal_notifications_idx ON public.customer_notifications USING btree (is_portal_read);


--
-- Name: business_record_activities business_record_activities_business_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.business_record_activities
    ADD CONSTRAINT business_record_activities_business_record_id_fkey FOREIGN KEY (business_record_id) REFERENCES public.business_records(id) ON DELETE CASCADE;


--
-- Name: cpc_rates cpc_rates_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cpc_rates
    ADD CONSTRAINT cpc_rates_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.product_models(id) ON DELETE CASCADE;


--
-- Name: customer_meter_submissions customer_meter_submissions_customer_portal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_meter_submissions
    ADD CONSTRAINT customer_meter_submissions_customer_portal_user_id_fkey FOREIGN KEY (customer_portal_user_id) REFERENCES public.customer_portal_access(id);


--
-- Name: customer_notifications customer_notifications_customer_portal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_customer_portal_user_id_fkey FOREIGN KEY (customer_portal_user_id) REFERENCES public.customer_portal_access(id);


--
-- Name: customer_notifications customer_notifications_related_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_related_payment_id_fkey FOREIGN KEY (related_payment_id) REFERENCES public.customer_payments(id);


--
-- Name: customer_notifications customer_notifications_related_service_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_related_service_request_id_fkey FOREIGN KEY (related_service_request_id) REFERENCES public.customer_service_requests(id);


--
-- Name: customer_notifications customer_notifications_related_supply_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_related_supply_order_id_fkey FOREIGN KEY (related_supply_order_id) REFERENCES public.customer_supply_orders(id);


--
-- Name: customer_payments customer_payments_customer_portal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_customer_portal_user_id_fkey FOREIGN KEY (customer_portal_user_id) REFERENCES public.customer_portal_access(id);


--
-- Name: customer_portal_activity_log customer_portal_activity_log_customer_portal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_portal_activity_log
    ADD CONSTRAINT customer_portal_activity_log_customer_portal_user_id_fkey FOREIGN KEY (customer_portal_user_id) REFERENCES public.customer_portal_access(id);


--
-- Name: customer_service_requests customer_service_requests_customer_portal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_service_requests
    ADD CONSTRAINT customer_service_requests_customer_portal_user_id_fkey FOREIGN KEY (customer_portal_user_id) REFERENCES public.customer_portal_access(id);


--
-- Name: customer_supply_order_items customer_supply_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_supply_order_items
    ADD CONSTRAINT customer_supply_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_supply_orders(id) ON DELETE CASCADE;


--
-- Name: customer_supply_orders customer_supply_orders_customer_portal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.customer_supply_orders
    ADD CONSTRAINT customer_supply_orders_customer_portal_user_id_fkey FOREIGN KEY (customer_portal_user_id) REFERENCES public.customer_portal_access(id);


--
-- Name: deal_activities deal_activities_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deal_activities
    ADD CONSTRAINT deal_activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: deals deals_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.deal_stages(id);


--
-- Name: device_metrics device_metrics_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.device_metrics
    ADD CONSTRAINT device_metrics_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.device_registrations(id);


--
-- Name: device_registrations device_registrations_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.device_registrations
    ADD CONSTRAINT device_registrations_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.manufacturer_integrations(id);


--
-- Name: enabled_products enabled_products_master_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.enabled_products
    ADD CONSTRAINT enabled_products_master_product_id_fkey FOREIGN KEY (master_product_id) REFERENCES public.master_product_models(id);


--
-- Name: enriched_companies enriched_companies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.enriched_companies
    ADD CONSTRAINT enriched_companies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: enriched_contacts enriched_contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.enriched_contacts
    ADD CONSTRAINT enriched_contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: integration_audit_logs integration_audit_logs_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.integration_audit_logs
    ADD CONSTRAINT integration_audit_logs_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.device_registrations(id);


--
-- Name: integration_audit_logs integration_audit_logs_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.integration_audit_logs
    ADD CONSTRAINT integration_audit_logs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.manufacturer_integrations(id);


--
-- Name: onboarding_dynamic_sections onboarding_dynamic_sections_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_dynamic_sections
    ADD CONSTRAINT onboarding_dynamic_sections_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE;


--
-- Name: onboarding_equipment onboarding_equipment_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_equipment
    ADD CONSTRAINT onboarding_equipment_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE;


--
-- Name: onboarding_network_config onboarding_network_config_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_network_config
    ADD CONSTRAINT onboarding_network_config_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE;


--
-- Name: onboarding_print_management onboarding_print_management_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_print_management
    ADD CONSTRAINT onboarding_print_management_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE;


--
-- Name: onboarding_tasks onboarding_tasks_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE;


--
-- Name: product_accessories product_accessories_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_accessories
    ADD CONSTRAINT product_accessories_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.product_models(id) ON DELETE CASCADE;


--
-- Name: product_tags product_tags_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.product_tags
    ADD CONSTRAINT product_tags_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.product_models(id) ON DELETE CASCADE;


--
-- Name: prospecting_campaigns prospecting_campaigns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.prospecting_campaigns
    ADD CONSTRAINT prospecting_campaigns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quote_pricing_line_items quote_pricing_line_items_quote_pricing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quote_pricing_line_items
    ADD CONSTRAINT quote_pricing_line_items_quote_pricing_id_fkey FOREIGN KEY (quote_pricing_id) REFERENCES public.quote_pricing(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

