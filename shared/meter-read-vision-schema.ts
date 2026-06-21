/**
 * SMS/Photo Meter Reads with Vision Extraction Schema (US-SUPER-002).
 *
 * Customers text/email a phone photo of the MFP meter panel; Claude vision
 * extracts the counters, the read is validated against the 90-day trend, and a
 * billable meter read is created (flagged reads land in a review queue).
 *
 *   - meter_read_submissions : one row per inbound photo (sms|email|web|manual)
 *   - meter_read_settings    : per-tenant SMS templates + validation threshold +
 *                              encrypted Twilio credential markers
 *
 * Twilio + Anthropic calls sit behind named adapter stubs; credentials are
 * encrypted (credential vault) and never returned — only *_set booleans.
 * Identical images are de-duplicated by hash for cost control.
 *
 * Re-exported from shared/schema.ts.
 * TODO(rbac): requirePermission(['billing.meter_read.review']) once it exists.
 */

import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/** Inbound channel. */
export const METER_READ_SOURCES = ['sms', 'email', 'web', 'manual'] as const;
export type MeterReadSource = (typeof METER_READ_SOURCES)[number];

/** Validation lifecycle. */
export const METER_READ_VALIDATION_STATUSES = [
  'pending', // received, not yet extracted/validated
  'auto_approved', // passed validation, billable read created
  'flagged', // failed validation → review queue
  'approved', // reviewer approved (after flag/pending)
  'rejected', // reviewer rejected
] as const;
export type MeterReadValidationStatus = (typeof METER_READ_VALIDATION_STATUSES)[number];

// ---------------------------------------------------------------------------
// meter_read_submissions
// ---------------------------------------------------------------------------
export const meterReadSubmissions = pgTable(
  'meter_read_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** sms | email | web | manual. */
    source: varchar('source', { length: 12 }).notNull().default('manual'),
    /** Caller phone (matched against business_records.phone). */
    fromPhone: varchar('from_phone'),
    /** Resolved customer (business_records.id), null when ambiguous. */
    customerId: varchar('customer_id'),
    /** Resolved machine (equipment.id), null when unknown/ambiguous. */
    machineId: varchar('machine_id'),
    /** Image URL (storage). */
    rawImageUrl: varchar('raw_image_url'),
    /** SHA-256 of the image bytes — identical images are reused (cost control). */
    imageHash: varchar('image_hash'),
    /**
     * Vision-extracted counters:
     *   { black, color, scan, fax, confidence, source: 'ai'|'fallback' }
     */
    extractedValues: jsonb('extracted_values'),
    /** pending | auto_approved | flagged | approved | rejected. */
    validationStatus: varchar('validation_status', { length: 16 }).notNull().default('pending'),
    /** Why it was flagged/approved: { reason, deltaBlack, rollingAvg, ... }. */
    validationDetail: jsonb('validation_detail'),
    /** The outbound SMS we sent back (confirmation or clarification). */
    outboundMessage: varchar('outbound_message', { length: 1000 }),
    /** The meter_readings.id created on approval, if any. */
    meterReadingId: varchar('meter_reading_id'),
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
    reviewedByUserId: varchar('reviewed_by_user_id'),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('meter_read_submissions_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('meter_read_submissions_tenant_status_idx').on(
      table.tenantId,
      table.validationStatus,
    ),
    tenantHashIdx: index('meter_read_submissions_tenant_hash_idx').on(
      table.tenantId,
      table.imageHash,
    ),
  }),
);

// ---------------------------------------------------------------------------
// meter_read_settings
// ---------------------------------------------------------------------------
export const meterReadSettings = pgTable('meter_read_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Reject/flag when delta < 0 or > this × the rolling 90-day average. */
  maxDeltaMultiplier: integer('max_delta_multiplier').notNull().default(3),
  /** Outbound SMS template on a confirmed read ({{black}}, {{color}} tokens). */
  confirmTemplate: varchar('confirm_template', { length: 1000 }),
  /** Outbound SMS template asking for site/machine clarification. */
  clarifyTemplate: varchar('clarify_template', { length: 1000 }),
  /**
   * Encrypted Twilio credentials (credential vault); never returned.
   * Read paths expose only *_set booleans derived from this.
   */
  encryptedConfig: jsonb('encrypted_config'),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type MeterReadSubmission = typeof meterReadSubmissions.$inferSelect;
export type NewMeterReadSubmission = typeof meterReadSubmissions.$inferInsert;
export type MeterReadSettings = typeof meterReadSettings.$inferSelect;
