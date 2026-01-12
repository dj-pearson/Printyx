/**
 * Accessibility Schema
 * Database schema for user accessibility preferences
 * WCAG 2.1 Compliance
 */

import { pgTable, uuid, timestamp, varchar, boolean, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Font size preference enum
 */
export const fontSizeEnum = pgEnum('font_size', ['small', 'normal', 'large', 'extra-large']);

/**
 * Color blindness filter enum
 */
export const colorBlindTypeEnum = pgEnum('color_blind_type', [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
]);

/**
 * Cursor size enum
 */
export const cursorSizeEnum = pgEnum('cursor_size', ['normal', 'large']);

/**
 * User Accessibility Preferences Table
 * Stores user-specific accessibility settings
 */
export const userAccessibilityPreferences = pgTable(
  'user_accessibility_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().unique(),
    tenantId: uuid('tenant_id').notNull(),

    // Visual Settings
    highContrast: boolean('high_contrast').default(false).notNull(),
    fontSize: fontSizeEnum('font_size').default('normal').notNull(),
    colorBlind: colorBlindTypeEnum('color_blind').default('none').notNull(),
    focusIndicators: boolean('focus_indicators').default(true).notNull(),
    underlineLinks: boolean('underline_links').default(false).notNull(),
    cursorSize: cursorSizeEnum('cursor_size').default('normal').notNull(),

    // Motion Settings
    reducedMotion: boolean('reduced_motion').default(false).notNull(),

    // Audio Settings
    soundEnabled: boolean('sound_enabled').default(true).notNull(),

    // Assistive Technology Settings
    screenReader: boolean('screen_reader').default(false).notNull(),
    keyboardNavigation: boolean('keyboard_navigation').default(true).notNull(),
    voiceCommands: boolean('voice_commands').default(false).notNull(),

    // Custom Settings (for future extensibility)
    customSettings: jsonb('custom_settings'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('a11y_user_id_idx').on(table.userId),
    tenantIdIdx: index('a11y_tenant_id_idx').on(table.tenantId),
  })
);

/**
 * Accessibility Feedback Table
 * Stores user feedback about accessibility issues
 */
export const accessibilityFeedback = pgTable(
  'accessibility_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),
    userId: uuid('user_id'),

    // Feedback Details
    category: varchar('category', { length: 100 }).notNull(), // 'barrier', 'suggestion', 'praise', 'vpat_request'
    severity: varchar('severity', { length: 50 }), // 'critical', 'major', 'minor', 'enhancement'
    pageUrl: varchar('page_url', { length: 500 }),
    componentName: varchar('component_name', { length: 200 }),
    description: varchar('description', { length: 5000 }).notNull(),

    // User Information (optional for anonymous feedback)
    userEmail: varchar('user_email', { length: 255 }),
    userName: varchar('user_name', { length: 255 }),
    assistiveTechnology: varchar('assistive_technology', { length: 255 }), // e.g., 'NVDA', 'JAWS', 'VoiceOver'

    // Resolution
    status: varchar('status', { length: 50 }).default('open').notNull(), // 'open', 'in_progress', 'resolved', 'wont_fix'
    resolution: varchar('resolution', { length: 2000 }),
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: uuid('resolved_by'),

    // Metadata
    browserInfo: varchar('browser_info', { length: 500 }),
    osInfo: varchar('os_info', { length: 255 }),
    screenSize: varchar('screen_size', { length: 50 }),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index('a11y_feedback_category_idx').on(table.category),
    statusIdx: index('a11y_feedback_status_idx').on(table.status),
    tenantIdIdx: index('a11y_feedback_tenant_id_idx').on(table.tenantId),
  })
);

/**
 * Accessibility Audit Log Table
 * Tracks accessibility testing and audit results
 */
export const accessibilityAuditLog = pgTable(
  'accessibility_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id'),

    // Audit Details
    auditType: varchar('audit_type', { length: 100 }).notNull(), // 'automated', 'manual', 'user_testing'
    pageUrl: varchar('page_url', { length: 500 }).notNull(),
    wcagLevel: varchar('wcag_level', { length: 10 }).notNull(), // 'A', 'AA', 'AAA'

    // Results
    passed: boolean('passed').default(false).notNull(),
    issuesFound: jsonb('issues_found'), // Array of issue objects
    issueCount: jsonb('issue_count'), // { critical: 0, serious: 2, moderate: 5, minor: 10 }

    // Tool Information
    toolUsed: varchar('tool_used', { length: 100 }), // e.g., 'axe-core', 'WAVE', 'manual'
    toolVersion: varchar('tool_version', { length: 50 }),

    // Auditor Information
    auditorId: uuid('auditor_id'),
    auditorName: varchar('auditor_name', { length: 255 }),

    // Notes
    notes: varchar('notes', { length: 5000 }),

    // Timestamps
    auditDate: timestamp('audit_date').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    auditTypeIdx: index('a11y_audit_type_idx').on(table.auditType),
    pageUrlIdx: index('a11y_audit_page_url_idx').on(table.pageUrl),
    tenantIdIdx: index('a11y_audit_tenant_id_idx').on(table.tenantId),
  })
);

// Zod Schemas
export const insertUserAccessibilityPreferencesSchema = createInsertSchema(
  userAccessibilityPreferences,
  {
    userId: z.string().uuid(),
    tenantId: z.string().uuid(),
    fontSize: z.enum(['small', 'normal', 'large', 'extra-large']).optional(),
    colorBlind: z.enum(['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']).optional(),
    cursorSize: z.enum(['normal', 'large']).optional(),
  }
);

export const updateUserAccessibilityPreferencesSchema = z.object({
  highContrast: z.boolean().optional(),
  fontSize: z.enum(['small', 'normal', 'large', 'extra-large']).optional(),
  colorBlind: z.enum(['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']).optional(),
  focusIndicators: z.boolean().optional(),
  underlineLinks: z.boolean().optional(),
  cursorSize: z.enum(['normal', 'large']).optional(),
  reducedMotion: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  screenReader: z.boolean().optional(),
  keyboardNavigation: z.boolean().optional(),
  voiceCommands: z.boolean().optional(),
  customSettings: z.record(z.unknown()).optional(),
});

export const insertAccessibilityFeedbackSchema = createInsertSchema(accessibilityFeedback, {
  category: z.enum(['barrier', 'suggestion', 'praise', 'vpat_request']),
  severity: z.enum(['critical', 'major', 'minor', 'enhancement']).optional(),
  description: z.string().min(10).max(5000),
  userEmail: z.string().email().optional(),
});

export const insertAccessibilityAuditLogSchema = createInsertSchema(accessibilityAuditLog, {
  auditType: z.enum(['automated', 'manual', 'user_testing']),
  wcagLevel: z.enum(['A', 'AA', 'AAA']),
  pageUrl: z.string().url(),
});

// Type exports
export type UserAccessibilityPreferences = typeof userAccessibilityPreferences.$inferSelect;
export type NewUserAccessibilityPreferences = typeof userAccessibilityPreferences.$inferInsert;
export type AccessibilityFeedback = typeof accessibilityFeedback.$inferSelect;
export type NewAccessibilityFeedback = typeof accessibilityFeedback.$inferInsert;
export type AccessibilityAuditLog = typeof accessibilityAuditLog.$inferSelect;
export type NewAccessibilityAuditLog = typeof accessibilityAuditLog.$inferInsert;
