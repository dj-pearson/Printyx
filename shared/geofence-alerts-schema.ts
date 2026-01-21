import {
  pgTable,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Geofence Alert Rules ====================
export const geofenceAlertRules = pgTable(
  'geofence_alert_rules',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Rule identification
    ruleName: varchar('rule_name').notNull(),
    ruleDescription: text('rule_description'),

    // Associated geofence
    geofenceId: varchar('geofence_id').notNull(),

    // Trigger conditions
    triggerType: varchar('trigger_type').notNull(), // entry, exit, dwell, entry_during_hours, exit_during_hours

    // Time-based conditions (optional)
    activeStartTime: varchar('active_start_time'), // HH:MM format
    activeEndTime: varchar('active_end_time'), // HH:MM format
    activeDays: jsonb('active_days'), // [0,1,2,3,4,5,6] - days of week (0=Sunday)
    timezone: varchar('timezone').default('America/New_York'),

    // Dwell conditions
    dwellTimeMinutes: integer('dwell_time_minutes'), // Trigger after this many minutes in zone
    maxDwellTimeMinutes: integer('max_dwell_time_minutes'), // Alert if exceeds this time

    // Alert severity
    severity: varchar('severity').notNull().default('info'), // info, warning, critical

    // Notification configuration
    notifyByEmail: boolean('notify_by_email').default(true),
    notifyByPush: boolean('notify_by_push').default(true),
    notifyBySms: boolean('notify_by_sms').default(false),
    notifyInApp: boolean('notify_in_app').default(true),

    // Recipients
    notifyUsers: jsonb('notify_users'), // [userId1, userId2, ...]
    notifyRoles: jsonb('notify_roles'), // ['manager', 'dispatcher', ...]
    notifyTechnicianManager: boolean('notify_technician_manager').default(true),
    notifyCustomer: boolean('notify_customer').default(false),

    // Custom message template
    alertTitle: varchar('alert_title'),
    alertMessage: text('alert_message'), // Supports placeholders: {technician}, {geofence}, {time}, {duration}

    // Cooldown (prevent alert spam)
    cooldownMinutes: integer('cooldown_minutes').default(15),
    lastTriggeredAt: timestamp('last_triggered_at'),

    // Status
    isActive: boolean('is_active').default(true),
    priority: integer('priority').default(0), // Higher = higher priority

    // Metadata
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('geofence_alert_rules_tenant_id_idx').on(table.tenantId),
    geofenceIdIdx: index('geofence_alert_rules_geofence_id_idx').on(
      table.tenantId,
      table.geofenceId,
    ),
    activeIdx: index('geofence_alert_rules_active_idx').on(table.tenantId, table.isActive),
    triggerTypeIdx: index('geofence_alert_rules_trigger_type_idx').on(
      table.tenantId,
      table.triggerType,
    ),
  }),
);

export const insertGeofenceAlertRuleSchema = createInsertSchema(geofenceAlertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGeofenceAlertRule = z.infer<typeof insertGeofenceAlertRuleSchema>;
export type GeofenceAlertRule = typeof geofenceAlertRules.$inferSelect;

// ==================== Geofence Alerts (Triggered Alerts) ====================
export const geofenceAlerts = pgTable(
  'geofence_alerts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Alert identification
    alertNumber: varchar('alert_number').unique().notNull(),

    // Related entities
    alertRuleId: varchar('alert_rule_id').notNull(),
    geofenceId: varchar('geofence_id').notNull(),
    geofenceEventId: varchar('geofence_event_id'),
    technicianId: varchar('technician_id').notNull(),

    // Alert details
    alertType: varchar('alert_type').notNull(), // entry, exit, dwell_start, dwell_exceeded, unauthorized_entry, unauthorized_exit
    severity: varchar('severity').notNull(), // info, warning, critical

    // Trigger information
    triggeredAt: timestamp('triggered_at').notNull().defaultNow(),
    triggerLocation: jsonb('trigger_location').notNull(), // { lat, lng, address }

    // Geofence details at trigger time
    geofenceName: varchar('geofence_name'),
    geofenceType: varchar('geofence_type'),

    // Technician details at trigger time
    technicianName: varchar('technician_name'),
    technicianStatus: varchar('technician_status'),

    // Context
    ticketId: varchar('ticket_id'),
    customerId: varchar('customer_id'),
    customerName: varchar('customer_name'),
    routeId: varchar('route_id'),

    // Dwell tracking
    dwellDurationMinutes: integer('dwell_duration_minutes'),
    expectedDwellMinutes: integer('expected_dwell_minutes'),

    // Alert content
    title: varchar('title').notNull(),
    message: text('message').notNull(),

    // Notification status
    notificationsSent: jsonb('notifications_sent'), // { email: true, push: true, sms: false, inApp: true }
    notifiedUsers: jsonb('notified_users'), // [userId1, userId2, ...]
    notificationErrors: jsonb('notification_errors'), // [{ type, userId, error }, ...]

    // Acknowledgment
    isAcknowledged: boolean('is_acknowledged').default(false),
    acknowledgedAt: timestamp('acknowledged_at'),
    acknowledgedBy: varchar('acknowledged_by'),
    acknowledgmentNotes: text('acknowledgment_notes'),

    // Resolution
    isResolved: boolean('is_resolved').default(false),
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: varchar('resolved_by'),
    resolutionType: varchar('resolution_type'), // auto_resolved, manual_resolved, false_alarm, escalated
    resolutionNotes: text('resolution_notes'),

    // Escalation
    isEscalated: boolean('is_escalated').default(false),
    escalatedAt: timestamp('escalated_at'),
    escalatedTo: varchar('escalated_to'),
    escalationReason: text('escalation_reason'),

    // Auto-resolve conditions
    autoResolvedAt: timestamp('auto_resolved_at'),
    autoResolveReason: varchar('auto_resolve_reason'), // technician_left, dwell_ended, shift_ended

    // Metadata
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('geofence_alerts_tenant_id_idx').on(table.tenantId),
    alertRuleIdIdx: index('geofence_alerts_rule_id_idx').on(table.tenantId, table.alertRuleId),
    geofenceIdIdx: index('geofence_alerts_geofence_id_idx').on(table.tenantId, table.geofenceId),
    technicianIdIdx: index('geofence_alerts_technician_id_idx').on(
      table.tenantId,
      table.technicianId,
    ),
    alertTypeIdx: index('geofence_alerts_type_idx').on(table.tenantId, table.alertType),
    severityIdx: index('geofence_alerts_severity_idx').on(table.tenantId, table.severity),
    acknowledgedIdx: index('geofence_alerts_acknowledged_idx').on(
      table.tenantId,
      table.isAcknowledged,
    ),
    resolvedIdx: index('geofence_alerts_resolved_idx').on(table.tenantId, table.isResolved),
    triggeredAtIdx: index('geofence_alerts_triggered_at_idx').on(table.tenantId, table.triggeredAt),
  }),
);

export const insertGeofenceAlertSchema = createInsertSchema(geofenceAlerts).omit({
  id: true,
  createdAt: true,
});
export type InsertGeofenceAlert = z.infer<typeof insertGeofenceAlertSchema>;
export type GeofenceAlert = typeof geofenceAlerts.$inferSelect;

// ==================== Geofence Alert Subscriptions ====================
export const geofenceAlertSubscriptions = pgTable(
  'geofence_alert_subscriptions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Subscriber
    userId: varchar('user_id').notNull(),

    // Subscription scope
    subscriptionType: varchar('subscription_type').notNull(), // all, geofence, technician, customer, rule
    geofenceId: varchar('geofence_id'), // if type = geofence
    technicianId: varchar('technician_id'), // if type = technician
    customerId: varchar('customer_id'), // if type = customer
    alertRuleId: varchar('alert_rule_id'), // if type = rule

    // Filter by severity
    minSeverity: varchar('min_severity').default('info'), // info, warning, critical

    // Notification preferences for this subscription
    emailEnabled: boolean('email_enabled').default(true),
    pushEnabled: boolean('push_enabled').default(true),
    smsEnabled: boolean('sms_enabled').default(false),
    inAppEnabled: boolean('in_app_enabled').default(true),

    // Quiet hours
    quietHoursEnabled: boolean('quiet_hours_enabled').default(false),
    quietHoursStart: varchar('quiet_hours_start'), // HH:MM
    quietHoursEnd: varchar('quiet_hours_end'), // HH:MM

    // Status
    isActive: boolean('is_active').default(true),

    // Metadata
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('geofence_subscriptions_tenant_id_idx').on(table.tenantId),
    userIdIdx: index('geofence_subscriptions_user_id_idx').on(table.tenantId, table.userId),
    typeIdx: index('geofence_subscriptions_type_idx').on(table.tenantId, table.subscriptionType),
    activeIdx: index('geofence_subscriptions_active_idx').on(table.tenantId, table.isActive),
  }),
);

export const insertGeofenceAlertSubscriptionSchema = createInsertSchema(
  geofenceAlertSubscriptions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGeofenceAlertSubscription = z.infer<typeof insertGeofenceAlertSubscriptionSchema>;
export type GeofenceAlertSubscription = typeof geofenceAlertSubscriptions.$inferSelect;

// ==================== Technician Dwell Sessions ====================
export const technicianDwellSessions = pgTable(
  'technician_dwell_sessions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    technicianId: varchar('technician_id').notNull(),
    geofenceId: varchar('geofence_id').notNull(),

    // Session timing
    entryTime: timestamp('entry_time').notNull(),
    exitTime: timestamp('exit_time'),
    dwellDurationMinutes: integer('dwell_duration_minutes'),

    // Session status
    isActive: boolean('is_active').default(true), // True while technician is still in zone
    sessionStatus: varchar('session_status').default('active'), // active, completed, interrupted

    // Entry details
    entryLocation: jsonb('entry_location').notNull(), // { lat, lng }
    entryEventId: varchar('entry_event_id'),

    // Exit details
    exitLocation: jsonb('exit_location'), // { lat, lng }
    exitEventId: varchar('exit_event_id'),

    // Context
    ticketId: varchar('ticket_id'),
    customerId: varchar('customer_id'),
    routeId: varchar('route_id'),
    expectedDwellMinutes: integer('expected_dwell_minutes'),

    // Alerts triggered during session
    alertsTriggered: jsonb('alerts_triggered'), // [alertId1, alertId2, ...]

    // Metadata
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('dwell_sessions_tenant_id_idx').on(table.tenantId),
    technicianIdIdx: index('dwell_sessions_technician_id_idx').on(
      table.tenantId,
      table.technicianId,
    ),
    geofenceIdIdx: index('dwell_sessions_geofence_id_idx').on(table.tenantId, table.geofenceId),
    activeIdx: index('dwell_sessions_active_idx').on(table.tenantId, table.isActive),
    entryTimeIdx: index('dwell_sessions_entry_time_idx').on(table.tenantId, table.entryTime),
  }),
);

export const insertTechnicianDwellSessionSchema = createInsertSchema(technicianDwellSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTechnicianDwellSession = z.infer<typeof insertTechnicianDwellSessionSchema>;
export type TechnicianDwellSession = typeof technicianDwellSessions.$inferSelect;
