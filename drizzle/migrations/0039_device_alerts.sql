-- Materialised device alert table.
--
-- Replaces the on-the-fly alert computation in routes-device-monitoring.ts
-- so operators can acknowledge / snooze / resolve and the state sticks
-- across heartbeats. The materializer (server/services/alert-materializer.ts)
-- writes here on each /submit; the dashboards read here.

CREATE TABLE IF NOT EXISTS "device_alerts" (
    "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id"        uuid                       NOT NULL,
    "device_id"        uuid                       NOT NULL,
    "supply_type"      varchar(64)                NOT NULL,
    "alert_type"       varchar(32)                NOT NULL,
    "severity"         varchar(16)                NOT NULL,
    "current_value"    integer,
    "threshold"        integer,
    "status"           varchar(16) DEFAULT 'active' NOT NULL,
    "message"          text,
    "acknowledged_at"  timestamp,
    "acknowledged_by"  varchar(255),
    "snoozed_until"    timestamp,
    "resolved_at"      timestamp,
    "first_seen_at"    timestamp DEFAULT now()    NOT NULL,
    "last_seen_at"     timestamp DEFAULT now()    NOT NULL,
    "created_at"       timestamp DEFAULT now()    NOT NULL,
    "updated_at"       timestamp DEFAULT now()    NOT NULL
);

DO $$ BEGIN
    ALTER TABLE "device_alerts"
        ADD CONSTRAINT "device_alerts_device_id_fk"
        FOREIGN KEY ("device_id")
        REFERENCES "device_registrations"("id")
        ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One open alert per (device, supply). 'resolved' rows are exempt so
-- history accumulates. Postgres requires the WHERE clause for partial
-- uniques; we list each open status explicitly.
CREATE UNIQUE INDEX IF NOT EXISTS "device_alerts_open_unique_idx"
    ON "device_alerts" ("tenant_id", "device_id", "supply_type")
    WHERE "status" IN ('active', 'acknowledged', 'snoozed');

CREATE INDEX IF NOT EXISTS "device_alerts_tenant_status_idx"
    ON "device_alerts" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "device_alerts_device_idx"
    ON "device_alerts" ("device_id");
CREATE INDEX IF NOT EXISTS "device_alerts_severity_idx"
    ON "device_alerts" ("severity");
CREATE INDEX IF NOT EXISTS "device_alerts_snooze_expiry_idx"
    ON "device_alerts" ("snoozed_until");
