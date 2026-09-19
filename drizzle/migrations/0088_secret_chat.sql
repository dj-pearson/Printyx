ALTER TABLE "proposals" ADD COLUMN "deal_id" varchar;--> statement-breakpoint
CREATE INDEX "proposals_tenant_deal_idx" ON "proposals" USING btree ("tenant_id","deal_id");