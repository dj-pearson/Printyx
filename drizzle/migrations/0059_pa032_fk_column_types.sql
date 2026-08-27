-- PA-032: these fifteen columns were declared with a type their foreign-key
-- target does not have, so Postgres rejected every one of those constraints and
-- migration 0000 could not be applied to an empty database. The migrations
-- themselves are corrected in place (they had never executed anywhere); this
-- migration brings an EXISTING database, built by db:push rather than by the
-- chain, to the same shape. On a database built from the corrected migrations
-- every statement here is a no-op.
--
-- The two uuid casts need an explicit USING — varchar does not cast to uuid
-- implicitly, unlike uuid to varchar. A row holding a non-uuid string would fail
-- the cast, which is the correct outcome: it could never have satisfied the
-- foreign key either.
ALTER TABLE "customer_maintenance_appointments" ALTER COLUMN "portal_user_id" SET DATA TYPE uuid USING "portal_user_id"::uuid;--> statement-breakpoint
ALTER TABLE "technician_availability_slots" ALTER COLUMN "appointment_id" SET DATA TYPE uuid USING "appointment_id"::uuid;--> statement-breakpoint
ALTER TABLE "api_key_rotations" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "api_key_rotations" ALTER COLUMN "rotated_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "api_key_usage_logs" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "created_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "revoked_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "sso_login_attempts" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "sso_login_attempts" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "sso_provider_configs" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "sso_sessions" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "sso_sessions" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "sso_user_mappings" ALTER COLUMN "tenant_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "sso_user_mappings" ALTER COLUMN "user_id" SET DATA TYPE varchar;