import { pgTable, varchar, timestamp, boolean, index, unique, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './schema';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * PASSWORD RESET SCHEMA
 *
 * Handles password reset tokens for secure password recovery.
 * Tokens are single-use and expire after 1 hour.
 */

export const passwordResets = pgTable(
  'password_resets',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('password_resets_user_id_idx').on(table.userId),
    tokenIdx: index('password_resets_token_idx').on(table.token),
    expiresAtIdx: index('password_resets_expires_at_idx').on(table.expiresAt),
  }),
);

export type PasswordReset = typeof passwordResets.$inferSelect;
export type NewPasswordReset = typeof passwordResets.$inferInsert;

export const insertPasswordResetSchema = createInsertSchema(passwordResets);

/**
 * EMAIL VERIFICATION SCHEMA
 *
 * Handles email verification tokens for new user signups.
 * Tokens expire after 24 hours.
 */

export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('email_verifications_user_id_idx').on(table.userId),
    emailIdx: index('email_verifications_email_idx').on(table.email),
    tokenIdx: index('email_verifications_token_idx').on(table.token),
  }),
);

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;

export const insertEmailVerificationSchema = createInsertSchema(emailVerifications);

/**
 * LOGIN ATTEMPTS SCHEMA
 *
 * SECURITY: Tracks failed login attempts per email address for account-level lockout.
 * Protects against distributed brute-force attacks that bypass IP-based rate limiting.
 * Accounts are locked after 5 failed attempts for 30 minutes.
 */

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: varchar('email', { length: 255 }).notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at').notNull().defaultNow(),
    lockedUntil: timestamp('locked_until'),
    lastIpAddress: varchar('last_ip_address', { length: 45 }), // Supports IPv6
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    emailIdx: index('login_attempts_email_idx').on(table.email),
    lockedUntilIdx: index('login_attempts_locked_until_idx').on(table.lockedUntil),
    emailUnique: unique('login_attempts_email_unique').on(table.email),
  }),
);

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type NewLoginAttempt = typeof loginAttempts.$inferInsert;

export const insertLoginAttemptSchema = createInsertSchema(loginAttempts);
