ALTER TABLE "dashboard_layouts" ADD COLUMN "surface" varchar(40) DEFAULT 'custom';--> statement-breakpoint
CREATE INDEX "dashboard_layouts_surface_idx" ON "dashboard_layouts" USING btree ("tenant_id","user_id","surface");--> statement-breakpoint
-- CRM-LAYOUT-001. ADD COLUMN ... DEFAULT 'custom' backfills EVERY existing row,
-- including the ones the role dashboard saved, so they have to be corrected
-- afterwards or the discriminator starts life wrong for exactly the rows it
-- exists to separate.
--
-- The only evidence available is the name: dashboard-widgets has always
-- inserted the literal 'Custom Dashboard', while the custom-dashboard surface
-- writes whatever the user typed. That is a HEURISTIC, and it is stated as one:
-- a user who named their own dashboard "Custom Dashboard" is relabelled here.
-- It is the right trade because the alternative - leaving both surfaces reading
-- one row - is the defect this migration exists to end, and a mislabelled row
-- is recoverable by saving again where a silently shared one is not.
UPDATE "dashboard_layouts"
   SET "surface" = 'role-dashboard'
 WHERE "is_user_custom" = true
   AND "name" = 'Custom Dashboard';
