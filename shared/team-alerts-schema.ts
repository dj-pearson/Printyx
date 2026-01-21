/**
 * TEAM ALERTS SCHEMA
 * Configuration and tracking for team performance alerts
 * Supports email notifications for coaching flags and performance issues
 */

import {
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  pgEnum,
  uuid,
  integer,
  decimal,
  jsonb,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Alert type enum
export const alertTypeEnum = pgEnum('alert_type', [
  'warehouse_low_fpy',
  'warehouse_low_accuracy',
  'warehouse_tech_support',
  'service_low_ftf',
  'service_sla_violation',
  'service_low_csat',
  'service_tech_support',
  'sales_low_activity',
  'sales_stuck_deals',
  'sales_quota_risk',
]);

// Alert severity enum
export const alertSeverityEnum = pgEnum('alert_severity', ['info', 'warning', 'critical']);

// Alert status enum
export const alertStatusEnum = pgEnum('alert_status', [
  'active',
  'acknowledged',
  'resolved',
  'dismissed',
]);

// Notification channel enum
export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'slack', 'in_app']);

// Alert configurations (per tenant, per user)
export const alertConfigurations = pgTable('alert_configurations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  userId: varchar('user_id').notNull(),

  // Alert type and thresholds
  alertType: alertTypeEnum('alert_type').notNull(),
  enabled: boolean('enabled').default(true),

  // Threshold values (stored as JSON for flexibility)
  thresholds: jsonb('thresholds')
    .$type<{
      fpyRate?: number; // e.g., 70% (alert if below)
      accuracyRate?: number; // e.g., 85% (alert if below)
      ftfRate?: number; // e.g., 75% (alert if below)
      slaCompliance?: number; // e.g., 90% (alert if below)
      csatScore?: number; // e.g., 3.5/5 (alert if below)
      activityCount?: number; // e.g., 50 activities/month (alert if below)
      stuckDealsDays?: number; // e.g., 30 days (alert if longer)
      quotaAttainment?: number; // e.g., 80% (alert if below)
    }>()
    .default({}),

  // Notification preferences
  notificationChannels: jsonb('notification_channels').$type<string[]>().default(['email']),
  notificationFrequency: varchar('notification_frequency').default('daily'), // immediate, hourly, daily, weekly
  quietHoursStart: varchar('quiet_hours_start'), // e.g., "22:00"
  quietHoursEnd: varchar('quiet_hours_end'), // e.g., "08:00"

  // Recipients (if different from user)
  additionalRecipients: jsonb('additional_recipients').$type<string[]>().default([]),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Alert instances (triggered alerts)
export const alertInstances = pgTable('alert_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  configurationId: uuid('configuration_id'),

  // Alert details
  alertType: alertTypeEnum('alert_type').notNull(),
  severity: alertSeverityEnum('severity').notNull().default('warning'),
  status: alertStatusEnum('status').notNull().default('active'),

  // Subject and affected entities
  subjectUserId: varchar('subject_user_id'), // Technician/rep who triggered alert
  subjectName: varchar('subject_name'),
  teamId: varchar('team_id'),
  locationId: varchar('location_id'),

  // Alert data
  title: varchar('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data')
    .$type<{
      currentValue?: number;
      threshold?: number;
      metric?: string;
      period?: string;
      details?: Record<string, any>;
    }>()
    .default({}),

  // Notification tracking
  notifiedAt: timestamp('notified_at'),
  notifiedVia: jsonb('notified_via').$type<string[]>().default([]),
  notificationsSent: integer('notifications_sent').default(0),

  // Resolution tracking
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: varchar('acknowledged_by'),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by'),
  resolutionNotes: text('resolution_notes'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Alert notification log (for audit trail)
export const alertNotificationLog = pgTable('alert_notification_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  alertInstanceId: uuid('alert_instance_id').notNull(),

  // Notification details
  channel: notificationChannelEnum('channel').notNull(),
  recipient: varchar('recipient').notNull(),
  subject: varchar('subject'),
  content: text('content'),

  // Delivery status
  sent: boolean('sent').default(false),
  sentAt: timestamp('sent_at'),
  deliveryStatus: varchar('delivery_status'), // sent, delivered, failed, bounced
  errorMessage: text('error_message'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
});

// Zod schemas for validation
export const insertAlertConfigurationSchema = createInsertSchema(alertConfigurations, {
  thresholds: z
    .object({
      fpyRate: z.number().min(0).max(100).optional(),
      accuracyRate: z.number().min(0).max(100).optional(),
      ftfRate: z.number().min(0).max(100).optional(),
      slaCompliance: z.number().min(0).max(100).optional(),
      csatScore: z.number().min(0).max(5).optional(),
      activityCount: z.number().min(0).optional(),
      stuckDealsDays: z.number().min(0).optional(),
      quotaAttainment: z.number().min(0).max(100).optional(),
    })
    .optional(),
  notificationChannels: z.array(z.string()).optional(),
  additionalRecipients: z.array(z.string().email()).optional(),
});

export const insertAlertInstanceSchema = createInsertSchema(alertInstances);
export const insertAlertNotificationLogSchema = createInsertSchema(alertNotificationLog);

export const selectAlertConfigurationSchema = createSelectSchema(alertConfigurations);
export const selectAlertInstanceSchema = createSelectSchema(alertInstances);
export const selectAlertNotificationLogSchema = createSelectSchema(alertNotificationLog);

// TypeScript types
export type AlertConfiguration = typeof alertConfigurations.$inferSelect;
export type NewAlertConfiguration = typeof alertConfigurations.$inferInsert;
export type AlertInstance = typeof alertInstances.$inferSelect;
export type NewAlertInstance = typeof alertInstances.$inferInsert;
export type AlertNotificationLog = typeof alertNotificationLog.$inferSelect;
export type NewAlertNotificationLog = typeof alertNotificationLog.$inferInsert;
