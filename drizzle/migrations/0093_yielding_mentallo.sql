CREATE TABLE "public_booking_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" varchar(200) NOT NULL,
	"rejected_reason" varchar(40),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_page_bookings" ADD COLUMN "reminder_email_sent_at" timestamp;--> statement-breakpoint
CREATE INDEX "public_booking_attempts_bucket_window_idx" ON "public_booking_attempts" USING btree ("bucket","created_at");