ALTER TABLE "deals" ADD COLUMN "deal_motion" varchar(40);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "forecast_category" varchar(20);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "incumbent_vendor" varchar;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "lease_buyout_exposure" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "trade_in_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "current_monthly_volume_bw" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "current_monthly_volume_color" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "target_cpc_black" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "target_cpc_color" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "replaces_contract_id" varchar;