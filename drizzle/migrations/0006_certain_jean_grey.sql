CREATE TABLE "business_contexts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"icp_summary" text,
	"icp_company_size" text,
	"icp_industries" text[],
	"icp_geographies" text[],
	"icp_buyer_titles" text[],
	"icp_pain_points" text[],
	"icp_trigger_signals" text[],
	"offer_summary" text,
	"offer_outcomes" text[],
	"offer_differentiators" text[],
	"offer_proof" text[],
	"positioning_statement" text,
	"positioning_objections" jsonb,
	"not_for_customers" text[],
	"past_wins" jsonb,
	"tools_notes" text,
	"additional_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_drafts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"sequence_id" varchar,
	"step_id" varchar,
	"prospect_id" varchar NOT NULL,
	"channel" varchar(20) NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"variants" jsonb,
	"selected_variant_index" integer DEFAULT 0,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"marked_sent_at" timestamp,
	"marked_replied_at" timestamp,
	"replied_sentiment" varchar(20),
	"meeting_booked" boolean DEFAULT false NOT NULL,
	"generation_context" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_prospects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"business_record_id" varchar,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"title" varchar(255),
	"email" varchar(255),
	"linkedin_url" varchar(500),
	"phone" varchar(50),
	"company_name" varchar(255),
	"company_website" varchar(500),
	"industry" varchar(100),
	"employee_count" integer,
	"city" varchar(100),
	"state" varchar(100),
	"trigger_signal" text,
	"custom_fields" jsonb,
	"source" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_sequence_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"sequence_id" varchar NOT NULL,
	"step_order" integer NOT NULL,
	"channel" varchar(20) NOT NULL,
	"day_offset" integer DEFAULT 0 NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"variants" jsonb,
	"spam_flags" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_sequences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"angle" text,
	"target_specialty" varchar(50),
	"includes_email" boolean DEFAULT true NOT NULL,
	"includes_linkedin" boolean DEFAULT false NOT NULL,
	"is_dream_account_only" boolean DEFAULT false NOT NULL,
	"generation_context" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rep_specializations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"specialty" varchar(50) NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL,
	"experience_years" integer,
	"personal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "business_contexts_tenant_idx" ON "business_contexts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_contexts_tenant_user_uniq" ON "business_contexts" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "outreach_drafts_tenant_user_idx" ON "outreach_drafts" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "outreach_drafts_prospect_idx" ON "outreach_drafts" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "outreach_drafts_status_idx" ON "outreach_drafts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "outreach_prospects_tenant_user_idx" ON "outreach_prospects" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "outreach_prospects_email_idx" ON "outreach_prospects" USING btree ("email");--> statement-breakpoint
CREATE INDEX "outreach_sequence_steps_sequence_idx" ON "outreach_sequence_steps" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "outreach_sequence_steps_tenant_idx" ON "outreach_sequence_steps" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "outreach_sequences_tenant_user_idx" ON "outreach_sequences" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "rep_specializations_tenant_user_idx" ON "rep_specializations" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rep_specializations_user_specialty_uniq" ON "rep_specializations" USING btree ("user_id","specialty");