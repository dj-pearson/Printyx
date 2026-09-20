CREATE INDEX "business_records_tenant_created_idx" ON "business_records" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "companies_tenant_created_idx" ON "companies" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "companies_tenant_type_idx" ON "companies" USING btree ("tenant_id","business_record_type");--> statement-breakpoint
CREATE INDEX "companies_tenant_created_by_idx" ON "companies" USING btree ("tenant_id","created_by");--> statement-breakpoint
CREATE INDEX "deals_tenant_owner_idx" ON "deals" USING btree ("tenant_id","owner_id");--> statement-breakpoint
CREATE INDEX "deals_tenant_close_date_idx" ON "deals" USING btree ("tenant_id","expected_close_date");