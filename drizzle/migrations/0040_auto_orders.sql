-- Auto-order on critical alerts.
--
-- Adds:
--   1. device_registrations.customer_id   — denormalised from
--      monitoring_clients so device→customer is a single column lookup.
--   2. device_alerts.triggered_order_id   — soft pointer to the
--      auto-order this alert generated.
--   3. device_supply_orders               — agent-driven order pipeline
--      (separate from the customer-portal customer_supply_orders flow,
--      which has different lifecycle / required fields).
--
-- Idempotent. Safe to re-run.

ALTER TABLE "device_registrations"
    ADD COLUMN IF NOT EXISTS "customer_id" varchar(255);

CREATE INDEX IF NOT EXISTS "device_registrations_customer_idx"
    ON "device_registrations" ("customer_id");

ALTER TABLE "device_alerts"
    ADD COLUMN IF NOT EXISTS "triggered_order_id" uuid;

CREATE INDEX IF NOT EXISTS "device_alerts_triggered_order_idx"
    ON "device_alerts" ("triggered_order_id");

CREATE TABLE IF NOT EXISTS "device_supply_orders" (
    "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id"             uuid                       NOT NULL,
    "customer_id"           varchar(255),
    "device_id"             uuid                       NOT NULL,
    "alert_id"              uuid,
    "supply_type"           varchar(64)                NOT NULL,
    "product_id"            varchar(255),
    "product_sku"           varchar(100),
    "product_name"          varchar(255),
    "quantity"              integer DEFAULT 1          NOT NULL,
    "unit_price"            numeric(10, 2),
    "total_price"           numeric(10, 2),
    "status"                varchar(24) DEFAULT 'pending' NOT NULL,
    "triggered_by"          varchar(16) DEFAULT 'auto' NOT NULL,
    "triggered_by_user_id"  varchar(255),
    "approved_at"           timestamp,
    "approved_by"           varchar(255),
    "ordered_at"            timestamp,
    "cancelled_at"          timestamp,
    "notes"                 text,
    "created_at"            timestamp DEFAULT now()    NOT NULL,
    "updated_at"            timestamp DEFAULT now()    NOT NULL
);

DO $$ BEGIN
    ALTER TABLE "device_supply_orders"
        ADD CONSTRAINT "device_supply_orders_device_id_fk"
        FOREIGN KEY ("device_id")
        REFERENCES "device_registrations"("id")
        ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "device_supply_orders_tenant_status_idx"
    ON "device_supply_orders" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "device_supply_orders_device_idx"
    ON "device_supply_orders" ("device_id");
CREATE INDEX IF NOT EXISTS "device_supply_orders_alert_idx"
    ON "device_supply_orders" ("alert_id");
CREATE INDEX IF NOT EXISTS "device_supply_orders_customer_idx"
    ON "device_supply_orders" ("customer_id");
