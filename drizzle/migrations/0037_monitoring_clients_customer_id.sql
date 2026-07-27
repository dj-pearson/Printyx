-- Adds an optional customer_id pointer to monitoring_clients so a client
-- installation can be linked to the customer (business_records row) it
-- monitors. Used by the bundled installer endpoint to pre-fill customer
-- context in bootstrap-config.json.
--
-- No FK constraint: business_records.id is varchar (UUID stored as text),
-- and tenants in the wild may have monitoring_clients pointing at
-- soft-deleted business records. We index instead, leaving referential
-- integrity to the application layer.

ALTER TABLE "monitoring_clients"
    ADD COLUMN IF NOT EXISTS "customer_id" varchar(255);

CREATE INDEX IF NOT EXISTS "monitoring_clients_customer_idx"
    ON "monitoring_clients" ("customer_id");
