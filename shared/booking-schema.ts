/**
 * CRMX-016 — Public meeting booking pages (Calendly-style self-scheduling).
 *
 * `booking_pages`          — per-rep / per-team public booking page config.
 *                             Owned by a rep, published under a globally-unique
 *                             slug so the public URL (/book/:slug) resolves
 *                             without a tenant hint.
 * `booking_page_bookings`  — a booking made by a prospect against a page. Holds
 *                             the invitee info, the resolved rep (for round-robin),
 *                             the created calendar_events / CRM activity ids, and
 *                             opaque reschedule / cancel tokens for the manage page.
 *
 * Availability is derived from the existing calendar sync (calendar_events) plus
 * confirmed rows in this table; provider events + confirmation emails are created
 * best-effort by the public-booking edge function.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * A single weekly availability window in the page owner's timezone.
 * dayOfWeek: 0 = Sunday … 6 = Saturday. Times are "HH:mm" 24h wall-clock.
 */
export interface BookingAvailabilityRule {
  dayOfWeek: number;
  startTime: string; // "09:00"
  endTime: string; // "17:00"
}

export interface BookingBranding {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string; // hex
  welcomeMessage?: string;
}

export const bookingPages = pgTable(
  'booking_pages',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Owning rep. For round_robin pages this is the page administrator; the
    // actual meeting host is resolved from teamMemberIds at booking time.
    ownerUserId: varchar('owner_user_id').notNull(),

    // Public identity — globally unique so /book/:slug resolves without a tenant.
    slug: varchar('slug').notNull(),
    title: varchar('title').notNull(),
    description: text('description'),

    // Scheduling rules
    timezone: varchar('timezone').notNull().default('America/New_York'),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    bufferBeforeMinutes: integer('buffer_before_minutes').notNull().default(0),
    bufferAfterMinutes: integer('buffer_after_minutes').notNull().default(0),
    minNoticeMinutes: integer('min_notice_minutes').notNull().default(240), // 4h
    dateRangeDays: integer('date_range_days').notNull().default(30), // how far out bookable
    slotIntervalMinutes: integer('slot_interval_minutes').notNull().default(30),

    // Weekly recurring availability windows (BookingAvailabilityRule[]).
    availabilityRules: jsonb('availability_rules')
      .$type<BookingAvailabilityRule[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Routing
    bookingType: varchar('booking_type').notNull().default('individual'), // individual | round_robin
    teamMemberIds: jsonb('team_member_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Which calendar connection to read busy windows from / write events to.
    // Null => availability falls back to calendar_events for ownerUserId and
    // no provider event is created (CRM activity still recorded).
    calendarConnectionId: varchar('calendar_connection_id'),

    // Presentation
    branding: jsonb('branding').$type<BookingBranding>(),
    location: varchar('location'), // free-text or video link template
    confirmationMessage: text('confirmation_message'),

    isActive: boolean('is_active').notNull().default(true),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex('idx_booking_pages_slug').on(table.slug),
    tenantOwnerIdx: index('idx_booking_pages_tenant_owner').on(table.tenantId, table.ownerUserId),
  }),
);

export const bookingPageBookings = pgTable(
  'booking_page_bookings',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    bookingPageId: varchar('booking_page_id').notNull(),

    // Resolved host rep (== page owner for individual pages, or the round-robin pick).
    assignedUserId: varchar('assigned_user_id').notNull(),

    // Invitee (prospect) details captured on the public page.
    inviteeName: varchar('invitee_name').notNull(),
    inviteeEmail: varchar('invitee_email').notNull(),
    inviteePhone: varchar('invitee_phone'),
    inviteeCompany: varchar('invitee_company'),
    inviteeNotes: text('invitee_notes'),
    inviteeTimezone: varchar('invitee_timezone').notNull().default('America/New_York'),

    // Scheduled slot (UTC instants).
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),

    status: varchar('status').notNull().default('confirmed'), // confirmed | cancelled | rescheduled

    // Downstream artifacts (best-effort; may be null if creation failed).
    calendarEventId: varchar('calendar_event_id'),
    externalEventId: varchar('external_event_id'),
    businessRecordId: varchar('business_record_id'), // matched/created lead
    contactId: varchar('contact_id'), // matched company_contacts row
    activityId: varchar('activity_id'), // business_record_activities row

    // Opaque tokens for the public manage (reschedule / cancel) page.
    manageToken: varchar('manage_token').notNull(),

    confirmationEmailSent: boolean('confirmation_email_sent').notNull().default(false),
    // COP-B14 AC6. A TIMESTAMP, not a boolean, because the reminder sweep needs
    // to know WHEN as well as whether - and because a null is the only state a
    // re-run can safely act on, which is what makes the sweep idempotent.
    reminderEmailSentAt: timestamp('reminder_email_sent_at'),
    cancelledAt: timestamp('cancelled_at'),
    cancelReason: text('cancel_reason'),
    rescheduledFromId: varchar('rescheduled_from_id'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    manageTokenUnique: uniqueIndex('idx_booking_bookings_manage_token').on(table.manageToken),
    pageTimeIdx: index('idx_booking_bookings_page_time').on(table.bookingPageId, table.startTime),
    tenantIdx: index('idx_booking_bookings_tenant').on(table.tenantId),
    assignedTimeIdx: index('idx_booking_bookings_assigned_time').on(
      table.assignedUserId,
      table.startTime,
    ),
  }),
);

// ─── Zod ────────────────────────────────────────────────────────────────────
const availabilityRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm'),
});

const brandingSchema = z.object({
  companyName: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  welcomeMessage: z.string().optional(),
});

export const insertBookingPageSchema = createInsertSchema(bookingPages, {
  availabilityRules: z.array(availabilityRuleSchema),
  teamMemberIds: z.array(z.string()),
  branding: brandingSchema.optional(),
}).omit({
  id: true,
  tenantId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingPageBookingSchema = createInsertSchema(bookingPageBookings).omit({
  id: true,
  tenantId: true,
  manageToken: true,
  createdAt: true,
  updatedAt: true,
});

export type BookingPage = typeof bookingPages.$inferSelect;
export type InsertBookingPage = z.infer<typeof insertBookingPageSchema>;
export type BookingPageBooking = typeof bookingPageBookings.$inferSelect;
export type InsertBookingPageBooking = z.infer<typeof insertBookingPageBookingSchema>;

/**
 * Attempts against a public booking surface, for the rate limit (COP-B14 AC4).
 *
 * ONE ROW PER ATTEMPT, counted over a window, rather than a counter that is
 * read-then-incremented. Two edge invocations racing on a counter lose an
 * update and let a burst through; appends cannot lose one. Counting is an
 * indexed range scan, which is cheap, and the cron sweep prunes the table.
 *
 * NO TENANT COLUMN, on purpose: the throttle has to decide before the slug is
 * resolved to a page, and an attempt against a slug that does not exist has no
 * tenant to attribute. `bucket` already carries a hash of the address and the
 * slug, and the raw address is never stored - throttling needs "the same
 * source again", not who.
 */
export const publicBookingAttempts = pgTable(
  'public_booking_attempts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** booking:<slug>:<digest> for a source, booking-page:<slug> for a page. */
    bucket: varchar('bucket', { length: 200 }).notNull(),
    /** honeypot | too_fast | rate_limited when the attempt was refused. */
    rejectedReason: varchar('rejected_reason', { length: 40 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    bucketWindowIdx: index('public_booking_attempts_bucket_window_idx').on(
      table.bucket,
      table.createdAt,
    ),
  }),
);

export type PublicBookingAttempt = typeof publicBookingAttempts.$inferSelect;
