-- Remote-control command queue for monitoring agents.
--
-- An operator (or the platform itself) writes a row when they want a
-- specific agent to do something one-shot: rescan the network, reload
-- config, rotate its API key, force a metrics submission. The agent
-- pulls pending rows on each heartbeat, executes them, and acks back
-- via /api/client-metrics/commands/:id/ack.
--
-- Idempotent / safe to re-run.

CREATE TABLE IF NOT EXISTS "client_commands" (
    "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id"          uuid                       NOT NULL,
    "client_id"          uuid                       NOT NULL,
    "command"            varchar(64)                NOT NULL,
    "payload"            jsonb DEFAULT '{}'::jsonb,
    "status"             varchar(32) DEFAULT 'queued' NOT NULL,
    "issued_by_user_id"  varchar(255),
    "dispatched_at"      timestamp,
    "completed_at"       timestamp,
    "expires_at"         timestamp                  NOT NULL,
    "result"             jsonb,
    "error_message"      text,
    "created_at"         timestamp DEFAULT now()    NOT NULL
);

DO $$ BEGIN
    ALTER TABLE "client_commands"
        ADD CONSTRAINT "client_commands_client_id_fk"
        FOREIGN KEY ("client_id")
        REFERENCES "monitoring_clients"("id")
        ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "client_commands_client_status_idx"
    ON "client_commands" ("client_id", "status");
CREATE INDEX IF NOT EXISTS "client_commands_expires_idx"
    ON "client_commands" ("expires_at");
