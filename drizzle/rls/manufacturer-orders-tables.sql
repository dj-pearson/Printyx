-- ============================================================================
-- manufacturer-orders-tables.sql — create any missing manufacturer tables.
--
-- 6 tables + 7 enums. All 6 tables store sensitive payload data; the
-- manufacturer_connections table additionally stores plaintext credentials
-- (api_key, api_secret, client_secret, access_token, refresh_token,
-- webhook_secret). Redaction happens at the handler layer — see
-- supabase/functions/manufacturer-orders/_credentials.ts. Encryption at
-- rest is a cross-domain follow-up (see tasks/followup-credentials-encryption.md).
-- ============================================================================

BEGIN;

-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "manufacturer_connection_status" AS ENUM('active', 'inactive', 'suspended', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "manufacturer_type" AS ENUM('canon', 'xerox', 'hp', 'ricoh', 'konica_minolta', 'sharp', 'brother', 'epson', 'kyocera', 'lexmark', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "manufacturer_order_status" AS ENUM('draft', 'pending_approval', 'approved', 'submitted', 'acknowledged', 'processing', 'shipped', 'partially_shipped', 'delivered', 'cancelled', 'rejected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "order_method" AS ENUM('api', 'edi', 'email', 'portal', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "shipment_status" AS ENUM('pending', 'picked', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'delayed', 'returned', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "exception_type" AS ENUM('connection_failed', 'authentication_failed', 'validation_error', 'product_not_found', 'insufficient_inventory', 'price_mismatch', 'order_rejected', 'shipment_delayed', 'delivery_failed', 'timeout', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "exception_severity" AS ENUM('info', 'warning', 'error', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── manufacturer_connections ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "manufacturer_connections" (
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
CREATE INDEX IF NOT EXISTS "manufacturer_connections_tenant_idx" ON "manufacturer_connections" ("tenant_id");
CREATE INDEX IF NOT EXISTS "manufacturer_connections_tenant_type_idx" ON "manufacturer_connections" ("tenant_id","manufacturer_type");
CREATE INDEX IF NOT EXISTS "manufacturer_connections_status_idx" ON "manufacturer_connections" ("tenant_id","connection_status");

-- Also EDI password + portal password columns the PRD mentions. Add
-- idempotently — some DB variants have them, some don't.
ALTER TABLE "manufacturer_connections" ADD COLUMN IF NOT EXISTS "edi_password" text;
ALTER TABLE "manufacturer_connections" ADD COLUMN IF NOT EXISTS "portal_username" varchar(255);
ALTER TABLE "manufacturer_connections" ADD COLUMN IF NOT EXISTS "portal_password" text;

-- ─── manufacturer_orders ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "manufacturer_orders" (
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
CREATE INDEX IF NOT EXISTS "manufacturer_orders_tenant_idx" ON "manufacturer_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "manufacturer_orders_connection_idx" ON "manufacturer_orders" ("connection_id");
CREATE INDEX IF NOT EXISTS "manufacturer_orders_status_idx" ON "manufacturer_orders" ("tenant_id","order_status");

-- ─── manufacturer_order_line_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "manufacturer_order_line_items" (
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
CREATE INDEX IF NOT EXISTS "manufacturer_order_line_items_order_idx" ON "manufacturer_order_line_items" ("order_id");
CREATE INDEX IF NOT EXISTS "manufacturer_order_line_items_tenant_idx" ON "manufacturer_order_line_items" ("tenant_id");

-- ─── manufacturer_order_confirmations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "manufacturer_order_confirmations" (
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
CREATE INDEX IF NOT EXISTS "manufacturer_order_confirmations_order_idx" ON "manufacturer_order_confirmations" ("order_id");
CREATE INDEX IF NOT EXISTS "manufacturer_order_confirmations_tenant_idx" ON "manufacturer_order_confirmations" ("tenant_id");

-- ─── manufacturer_order_shipments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "manufacturer_order_shipments" (
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
CREATE INDEX IF NOT EXISTS "manufacturer_order_shipments_order_idx" ON "manufacturer_order_shipments" ("order_id");
CREATE INDEX IF NOT EXISTS "manufacturer_order_shipments_tenant_idx" ON "manufacturer_order_shipments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "manufacturer_order_shipments_tracking_idx" ON "manufacturer_order_shipments" ("tracking_number");

-- ─── manufacturer_order_exceptions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "manufacturer_order_exceptions" (
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
CREATE INDEX IF NOT EXISTS "manufacturer_order_exceptions_tenant_idx" ON "manufacturer_order_exceptions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "manufacturer_order_exceptions_resolved_idx" ON "manufacturer_order_exceptions" ("tenant_id","resolved");
CREATE INDEX IF NOT EXISTS "manufacturer_order_exceptions_order_idx" ON "manufacturer_order_exceptions" ("order_id");

COMMIT;
