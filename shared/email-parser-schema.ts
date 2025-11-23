import { pgTable, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';
import { serviceTickets } from './schema';

/**
 * Email Parser Schema
 *
 * Tables for AI-powered email-to-ticket conversion system
 */

/**
 * Tracks processed emails to prevent duplicates (idempotency)
 */
export const processedEmails = pgTable('processed_emails', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text('tenant_id').notNull(),
  emailId: text('email_id').notNull().unique(), // Message-ID header from email
  from: text('from').notNull(),
  to: text('to'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  htmlBody: text('html_body'),
  ticketId: text('ticket_id').references(() => serviceTickets.id),
  parsedData: jsonb('parsed_data'), // Structured data extracted by AI
  processingStatus: text('processing_status').notNull(), // success, failed, skipped
  processingError: text('processing_error'),
  aiConfidence: text('ai_confidence'), // high, medium, low
  processingDuration: integer('processing_duration'), // milliseconds
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Store corrections to AI parsing for learning and improvement
 */
export const parsingCorrections = pgTable('parsing_corrections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  emailId: text('email_id').notNull(),
  aiParsedData: jsonb('ai_parsed_data').notNull(),
  correctedData: jsonb('corrected_data').notNull(),
  correctionReason: text('correction_reason'),
  correctedBy: text('corrected_by').notNull(), // User ID who made correction
  correctedAt: timestamp('corrected_at').defaultNow().notNull(),
});

/**
 * Email monitor configuration per tenant
 */
export const emailMonitorConfig = pgTable('email_monitor_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text('tenant_id').notNull().unique(), // One config per tenant
  emailAddress: text('email_address').notNull(),
  protocol: text('protocol').notNull(), // imap, graph, gmail

  // IMAP Configuration
  host: text('host'),
  port: integer('port'),
  username: text('username'),
  encryptedPassword: text('encrypted_password'), // AES-256 encrypted
  tls: boolean('tls').default(true),

  // OAuth Configuration (for Microsoft Graph / Gmail API)
  oauthClientId: text('oauth_client_id'),
  oauthEncryptedRefreshToken: text('oauth_encrypted_refresh_token'),
  oauthTokenExpiry: timestamp('oauth_token_expiry'),

  // Settings
  enabled: boolean('enabled').default(true),
  pollInterval: integer('poll_interval').default(60), // seconds
  autoAssignTechnician: boolean('auto_assign_technician').default(true),
  sendConfirmationEmail: boolean('send_confirmation_email').default(true),

  // Stats
  lastCheckAt: timestamp('last_check_at'),
  lastSuccessAt: timestamp('last_success_at'),
  lastErrorAt: timestamp('last_error_at'),
  lastError: text('last_error'),
  totalEmailsProcessed: integer('total_emails_processed').default(0),
  totalTicketsCreated: integer('total_tickets_created').default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Auto-response templates for different issue categories
 */
export const emailAutoResponses = pgTable('email_auto_responses', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text('tenant_id').notNull(),
  issueCategory: text('issue_category').notNull(), // paper_jam, toner_empty, etc.
  subject: text('subject').notNull(),
  bodyTemplate: text('body_template').notNull(), // Supports {{variables}}
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Types for TypeScript
export type ProcessedEmail = typeof processedEmails.$inferSelect;
export type NewProcessedEmail = typeof processedEmails.$inferInsert;

export type ParsingCorrection = typeof parsingCorrections.$inferSelect;
export type NewParsingCorrection = typeof parsingCorrections.$inferInsert;

export type EmailMonitorConfig = typeof emailMonitorConfig.$inferSelect;
export type NewEmailMonitorConfig = typeof emailMonitorConfig.$inferInsert;

export type EmailAutoResponse = typeof emailAutoResponses.$inferSelect;
export type NewEmailAutoResponse = typeof emailAutoResponses.$inferInsert;
