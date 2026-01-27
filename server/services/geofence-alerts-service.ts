import { db } from '../db';
import { eq, and, gte, lte, isNull, sql, desc } from 'drizzle-orm';
import {
  geofenceAlertRules,
  geofenceAlerts,
  geofenceAlertSubscriptions,
  technicianDwellSessions,
  InsertGeofenceAlertRule,
  InsertGeofenceAlert,
  InsertTechnicianDwellSession,
  GeofenceAlertRule,
  GeofenceAlert,
  TechnicianDwellSession,
} from '@shared/geofence-alerts-schema';
import { geofences, geofenceEvents, technicianLocations } from '@shared/gps-tracking-schema';

interface TriggerContext {
  technicianId: string;
  technicianName?: string;
  geofenceId: string;
  geofenceName?: string;
  geofenceType?: string;
  eventType: 'entry' | 'exit' | 'dwell';
  location: { lat: number; lng: number; address?: string };
  ticketId?: string;
  customerId?: string;
  customerName?: string;
  routeId?: string;
  dwellDurationMinutes?: number;
}

interface NotificationResult {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  errors: { type: string; userId?: string; error: string }[];
}

export class GeofenceAlertsService {
  /**
   * Generate unique alert number
   */
  private generateAlertNumber(): string {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `GFA-${date}-${random}`;
  }

  /**
   * Check if current time is within active hours for a rule
   */
  private isWithinActiveHours(rule: GeofenceAlertRule): boolean {
    if (!rule.activeStartTime || !rule.activeEndTime) {
      return true; // No time restriction
    }

    const now = new Date();
    const timezone = rule.timezone || 'America/New_York';

    // Get current time in rule's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
    const currentTime = formatter.format(now);

    // Check if current time is between start and end
    const current = parseInt(currentTime.replace(':', ''));
    const start = parseInt(rule.activeStartTime.replace(':', ''));
    const end = parseInt(rule.activeEndTime.replace(':', ''));

    if (start <= end) {
      return current >= start && current <= end;
    } else {
      // Handles overnight ranges (e.g., 22:00 to 06:00)
      return current >= start || current <= end;
    }
  }

  /**
   * Check if current day is an active day for a rule
   */
  private isActiveDay(rule: GeofenceAlertRule): boolean {
    if (!rule.activeDays) {
      return true; // No day restriction
    }

    const activeDays = rule.activeDays as number[];
    if (activeDays.length === 0) {
      return true;
    }

    const now = new Date();
    const timezone = rule.timezone || 'America/New_York';

    // Get current day in rule's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: timezone,
    });
    const dayName = formatter.format(now);
    const dayMap: { [key: string]: number } = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const currentDay = dayMap[dayName];

    return activeDays.includes(currentDay);
  }

  /**
   * Check cooldown period
   */
  private isInCooldown(rule: GeofenceAlertRule): boolean {
    if (!rule.lastTriggeredAt || !rule.cooldownMinutes) {
      return false;
    }

    const lastTriggered = new Date(rule.lastTriggeredAt);
    const cooldownEnd = new Date(lastTriggered.getTime() + rule.cooldownMinutes * 60 * 1000);
    return new Date() < cooldownEnd;
  }

  /**
   * Format alert message with placeholders
   */
  private formatMessage(template: string, context: TriggerContext): string {
    return template
      .replace(/{technician}/g, context.technicianName || 'Unknown Technician')
      .replace(/{geofence}/g, context.geofenceName || 'Unknown Zone')
      .replace(/{geofence_type}/g, context.geofenceType || 'zone')
      .replace(/{time}/g, new Date().toLocaleTimeString())
      .replace(/{date}/g, new Date().toLocaleDateString())
      .replace(/{customer}/g, context.customerName || 'N/A')
      .replace(/{duration}/g, context.dwellDurationMinutes?.toString() || '0')
      .replace(
        /{location}/g,
        context.location.address || `${context.location.lat}, ${context.location.lng}`,
      );
  }

  /**
   * Get applicable alert rules for a geofence event
   */
  async getApplicableRules(
    tenantId: string,
    geofenceId: string,
    eventType: 'entry' | 'exit' | 'dwell',
  ): Promise<GeofenceAlertRule[]> {
    // Map event types to trigger types
    const triggerTypes: string[] = [eventType];
    if (eventType === 'entry') {
      triggerTypes.push('entry_during_hours');
    } else if (eventType === 'exit') {
      triggerTypes.push('exit_during_hours');
    }

    const rules = await db
      .select()
      .from(geofenceAlertRules)
      .where(
        and(
          eq(geofenceAlertRules.tenant_id, tenantId),
          eq(geofenceAlertRules.geofenceId, geofenceId),
          eq(geofenceAlertRules.isActive, true),
        ),
      )
      .orderBy(desc(geofenceAlertRules.priority));

    // Filter rules by trigger type and time conditions
    return rules.filter((rule) => {
      // Check trigger type match
      if (!triggerTypes.includes(rule.triggerType)) {
        return false;
      }

      // Check if within active hours
      if (!this.isWithinActiveHours(rule)) {
        return false;
      }

      // Check if active day
      if (!this.isActiveDay(rule)) {
        return false;
      }

      // Check cooldown
      if (this.isInCooldown(rule)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Send notifications for an alert
   */
  async sendNotifications(
    alert: GeofenceAlert,
    rule: GeofenceAlertRule,
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      email: false,
      push: false,
      sms: false,
      inApp: false,
      errors: [],
    };

    const notifiedUsers: string[] = [];

    // Get list of users to notify
    const usersToNotify = new Set<string>();

    // Add users from rule configuration
    if (rule.notifyUsers) {
      (rule.notifyUsers as string[]).forEach((u) => usersToNotify.add(u));
    }

    // TODO: Add users based on roles when user/role system is available
    // if (rule.notifyRoles) { ... }

    // TODO: Add technician's manager if configured
    // if (rule.notifyTechnicianManager) { ... }

    // Send notifications
    for (const userId of usersToNotify) {
      notifiedUsers.push(userId);

      // Email notification
      if (rule.notifyByEmail) {
        try {
          // TODO: Integrate with email service
          // await emailService.sendGeofenceAlert(userId, alert);
          result.email = true;
        } catch (error: any) {
          result.errors.push({ type: 'email', userId, error: error.message });
        }
      }

      // Push notification
      if (rule.notifyByPush) {
        try {
          // TODO: Integrate with push notification service
          // await pushService.sendGeofenceAlert(userId, alert);
          result.push = true;
        } catch (error: any) {
          result.errors.push({ type: 'push', userId, error: error.message });
        }
      }

      // SMS notification
      if (rule.notifyBySms) {
        try {
          // TODO: Integrate with SMS service
          // await smsService.sendGeofenceAlert(userId, alert);
          result.sms = true;
        } catch (error: any) {
          result.errors.push({ type: 'sms', userId, error: error.message });
        }
      }

      // In-app notification
      if (rule.notifyInApp) {
        try {
          // TODO: Integrate with in-app notification system
          // await notificationService.createNotification(userId, alert);
          result.inApp = true;
        } catch (error: any) {
          result.errors.push({ type: 'inApp', userId, error: error.message });
        }
      }
    }

    // Update alert with notification status
    await db
      .update(geofenceAlerts)
      .set({
        notificationsSent: result,
        notifiedUsers,
        notificationErrors: result.errors.length > 0 ? result.errors : null,
      })
      .where(eq(geofenceAlerts.id, alert.id));

    return result;
  }

  /**
   * Create and trigger a geofence alert
   */
  async triggerAlert(
    tenantId: string,
    rule: GeofenceAlertRule,
    context: TriggerContext,
  ): Promise<GeofenceAlert> {
    // Determine alert type
    let alertType = context.eventType as string;
    if (context.eventType === 'dwell' && context.dwellDurationMinutes) {
      const maxDwell = rule.maxDwellTimeMinutes || 0;
      if (maxDwell > 0 && context.dwellDurationMinutes > maxDwell) {
        alertType = 'dwell_exceeded';
      } else {
        alertType = 'dwell_start';
      }
    }

    // Format title and message
    const title = rule.alertTitle
      ? this.formatMessage(rule.alertTitle, context)
      : `${context.geofenceName || 'Geofence'} ${context.eventType} alert`;

    const message = rule.alertMessage
      ? this.formatMessage(rule.alertMessage, context)
      : this.getDefaultMessage(alertType, context);

    // Create alert
    const alertData: InsertGeofenceAlert = {
      tenantId,
      alertNumber: this.generateAlertNumber(),
      alertRuleId: rule.id,
      geofenceId: context.geofenceId,
      technicianId: context.technicianId,
      alertType,
      severity: rule.severity,
      triggeredAt: new Date(),
      triggerLocation: context.location,
      geofenceName: context.geofenceName,
      geofenceType: context.geofenceType,
      technicianName: context.technicianName,
      ticketId: context.ticketId,
      customerId: context.customerId,
      customerName: context.customerName,
      routeId: context.routeId,
      dwellDurationMinutes: context.dwellDurationMinutes,
      expectedDwellMinutes: rule.dwellTimeMinutes,
      title,
      message,
    };

    const [alert] = await db.insert(geofenceAlerts).values(alertData).returning();

    // Update rule's last triggered timestamp
    await db
      .update(geofenceAlertRules)
      .set({
        lastTriggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(geofenceAlertRules.id, rule.id));

    // Send notifications
    await this.sendNotifications(alert, rule);

    return alert;
  }

  /**
   * Get default alert message based on type
   */
  private getDefaultMessage(alertType: string, context: TriggerContext): string {
    const tech = context.technicianName || 'Technician';
    const zone = context.geofenceName || 'the geofence';
    const time = new Date().toLocaleTimeString();

    switch (alertType) {
      case 'entry':
        return `${tech} entered ${zone} at ${time}.`;
      case 'exit':
        return `${tech} left ${zone} at ${time}.`;
      case 'dwell_start':
        return `${tech} has been at ${zone} for ${context.dwellDurationMinutes} minutes.`;
      case 'dwell_exceeded':
        return `${tech} has exceeded the expected time at ${zone} (${context.dwellDurationMinutes} minutes).`;
      case 'unauthorized_entry':
        return `Unauthorized entry: ${tech} entered ${zone} at ${time}.`;
      case 'unauthorized_exit':
        return `Unexpected departure: ${tech} left ${zone} at ${time}.`;
      default:
        return `Geofence event for ${tech} at ${zone}.`;
    }
  }

  /**
   * Process a geofence event and trigger applicable alerts
   */
  async processGeofenceEvent(
    tenantId: string,
    technicianId: string,
    geofenceId: string,
    eventType: 'entry' | 'exit' | 'dwell',
    location: { lat: number; lng: number; address?: string },
    additionalContext?: {
      ticketId?: string;
      customerId?: string;
      routeId?: string;
      dwellDurationMinutes?: number;
    },
  ): Promise<GeofenceAlert[]> {
    const triggeredAlerts: GeofenceAlert[] = [];

    // Get geofence details
    const [geofence] = await db
      .select()
      .from(geofences)
      .where(and(eq(geofences.id, geofenceId), eq(geofences.tenant_id, tenantId)))
      .limit(1);

    if (!geofence) {
      console.error(`Geofence not found: ${geofenceId}`);
      return triggeredAlerts;
    }

    // Get technician details
    const [techLocation] = await db
      .select()
      .from(technicianLocations)
      .where(
        and(
          eq(technicianLocations.technicianId, technicianId),
          eq(technicianLocations.tenant_id, tenantId),
        ),
      )
      .limit(1);

    // Build context
    const context: TriggerContext = {
      technicianId,
      technicianName: undefined, // TODO: Get from user service
      geofenceId,
      geofenceName: geofence.name,
      geofenceType: geofence.geofenceType,
      eventType,
      location,
      ticketId: additionalContext?.ticketId,
      customerId: additionalContext?.customerId || geofence.customerId || undefined,
      routeId: additionalContext?.routeId,
      dwellDurationMinutes: additionalContext?.dwellDurationMinutes,
    };

    // Get applicable rules
    const rules = await this.getApplicableRules(tenantId, geofenceId, eventType);

    // Trigger alerts for each applicable rule
    for (const rule of rules) {
      // For dwell events, check if dwell time threshold is met
      if (eventType === 'dwell' && rule.dwellTimeMinutes) {
        if (!context.dwellDurationMinutes || context.dwellDurationMinutes < rule.dwellTimeMinutes) {
          continue; // Skip if dwell time threshold not met
        }
      }

      try {
        const alert = await this.triggerAlert(tenantId, rule, context);
        triggeredAlerts.push(alert);
      } catch (error) {
        console.error(`Error triggering alert for rule ${rule.id}:`, error);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Start a dwell session when technician enters a geofence
   */
  async startDwellSession(
    tenantId: string,
    technicianId: string,
    geofenceId: string,
    entryLocation: { lat: number; lng: number },
    entryEventId?: string,
    context?: {
      ticketId?: string;
      customerId?: string;
      routeId?: string;
      expectedDwellMinutes?: number;
    },
  ): Promise<TechnicianDwellSession> {
    const sessionData: InsertTechnicianDwellSession = {
      tenantId,
      technicianId,
      geofenceId,
      entryTime: new Date(),
      entryLocation,
      entryEventId,
      isActive: true,
      sessionStatus: 'active',
      ticketId: context?.ticketId,
      customerId: context?.customerId,
      routeId: context?.routeId,
      expectedDwellMinutes: context?.expectedDwellMinutes,
    };

    const [session] = await db.insert(technicianDwellSessions).values(sessionData).returning();

    return session;
  }

  /**
   * End a dwell session when technician exits a geofence
   */
  async endDwellSession(
    tenantId: string,
    technicianId: string,
    geofenceId: string,
    exitLocation: { lat: number; lng: number },
    exitEventId?: string,
  ): Promise<TechnicianDwellSession | null> {
    // Find active session
    const [activeSession] = await db
      .select()
      .from(technicianDwellSessions)
      .where(
        and(
          eq(technicianDwellSessions.tenant_id, tenantId),
          eq(technicianDwellSessions.technicianId, technicianId),
          eq(technicianDwellSessions.geofenceId, geofenceId),
          eq(technicianDwellSessions.isActive, true),
        ),
      )
      .orderBy(desc(technicianDwellSessions.entryTime))
      .limit(1);

    if (!activeSession) {
      return null;
    }

    // Calculate dwell duration
    const entryTime = new Date(activeSession.entryTime);
    const exitTime = new Date();
    const dwellDurationMinutes = Math.round(
      (exitTime.getTime() - entryTime.getTime()) / (1000 * 60),
    );

    // Update session
    const [updatedSession] = await db
      .update(technicianDwellSessions)
      .set({
        exitTime,
        exitLocation,
        exitEventId,
        dwellDurationMinutes,
        isActive: false,
        sessionStatus: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(technicianDwellSessions.id, activeSession.id))
      .returning();

    return updatedSession;
  }

  /**
   * Check active dwell sessions for time-based alerts
   */
  async checkDwellAlerts(tenantId: string): Promise<GeofenceAlert[]> {
    const triggeredAlerts: GeofenceAlert[] = [];

    // Get active dwell sessions
    const activeSessions = await db
      .select()
      .from(technicianDwellSessions)
      .where(
        and(
          eq(technicianDwellSessions.tenant_id, tenantId),
          eq(technicianDwellSessions.isActive, true),
        ),
      );

    for (const session of activeSessions) {
      const entryTime = new Date(session.entryTime);
      const currentDwell = Math.round((Date.now() - entryTime.getTime()) / (1000 * 60));

      // Get applicable dwell rules
      const rules = await this.getApplicableRules(tenantId, session.geofenceId, 'dwell');

      for (const rule of rules) {
        // Check if dwell threshold is met
        if (rule.dwellTimeMinutes && currentDwell >= rule.dwellTimeMinutes) {
          // Check if we already triggered an alert for this session/rule combination
          const existingAlerts = (session.alertsTriggered as string[]) || [];

          if (!existingAlerts.includes(rule.id)) {
            // Trigger dwell alert
            const context: TriggerContext = {
              technicianId: session.technicianId,
              geofenceId: session.geofenceId,
              eventType: 'dwell',
              location: session.entryLocation as { lat: number; lng: number },
              ticketId: session.ticketId || undefined,
              customerId: session.customerId || undefined,
              routeId: session.routeId || undefined,
              dwellDurationMinutes: currentDwell,
            };

            try {
              const alert = await this.triggerAlert(tenantId, rule, context);
              triggeredAlerts.push(alert);

              // Update session with triggered alert
              await db
                .update(technicianDwellSessions)
                .set({
                  alertsTriggered: [...existingAlerts, rule.id],
                  updatedAt: new Date(),
                })
                .where(eq(technicianDwellSessions.id, session.id));
            } catch (error) {
              console.error(`Error triggering dwell alert:`, error);
            }
          }
        }
      }
    }

    return triggeredAlerts;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    tenantId: string,
    acknowledgedBy: string,
    notes?: string,
  ): Promise<GeofenceAlert | null> {
    const [updated] = await db
      .update(geofenceAlerts)
      .set({
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy,
        acknowledgmentNotes: notes,
      })
      .where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenant_id, tenantId)))
      .returning();

    return updated || null;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    tenantId: string,
    resolvedBy: string,
    resolutionType: 'auto_resolved' | 'manual_resolved' | 'false_alarm' | 'escalated',
    notes?: string,
  ): Promise<GeofenceAlert | null> {
    const [updated] = await db
      .update(geofenceAlerts)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionType,
        resolutionNotes: notes,
      })
      .where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenant_id, tenantId)))
      .returning();

    return updated || null;
  }

  /**
   * Escalate an alert
   */
  async escalateAlert(
    alertId: string,
    tenantId: string,
    escalatedTo: string,
    reason: string,
  ): Promise<GeofenceAlert | null> {
    const [updated] = await db
      .update(geofenceAlerts)
      .set({
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedTo,
        escalationReason: reason,
      })
      .where(and(eq(geofenceAlerts.id, alertId), eq(geofenceAlerts.tenant_id, tenantId)))
      .returning();

    return updated || null;
  }

  /**
   * Get unacknowledged alerts
   */
  async getUnacknowledgedAlerts(
    tenantId: string,
    options?: { severity?: string; limit?: number },
  ): Promise<GeofenceAlert[]> {
    let query = db
      .select()
      .from(geofenceAlerts)
      .where(and(eq(geofenceAlerts.tenant_id, tenantId), eq(geofenceAlerts.isAcknowledged, false)))
      .orderBy(desc(geofenceAlerts.triggeredAt));

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    return await query;
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalAlerts: number;
    byType: { [key: string]: number };
    bySeverity: { [key: string]: number };
    acknowledgedCount: number;
    resolvedCount: number;
    avgResponseTimeMinutes: number;
    topGeofences: { geofenceId: string; geofenceName: string; count: number }[];
  }> {
    const alerts = await db
      .select()
      .from(geofenceAlerts)
      .where(
        and(
          eq(geofenceAlerts.tenant_id, tenantId),
          gte(geofenceAlerts.triggeredAt, startDate),
          lte(geofenceAlerts.triggeredAt, endDate),
        ),
      );

    const byType: { [key: string]: number } = {};
    const bySeverity: { [key: string]: number } = {};
    const geofenceCounts: { [key: string]: { name: string; count: number } } = {};
    let acknowledgedCount = 0;
    let resolvedCount = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const alert of alerts) {
      // Count by type
      byType[alert.alertType] = (byType[alert.alertType] || 0) + 1;

      // Count by severity
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;

      // Count by geofence
      if (!geofenceCounts[alert.geofenceId]) {
        geofenceCounts[alert.geofenceId] = { name: alert.geofenceName || 'Unknown', count: 0 };
      }
      geofenceCounts[alert.geofenceId].count++;

      // Count acknowledged and resolved
      if (alert.isAcknowledged) acknowledgedCount++;
      if (alert.isResolved) resolvedCount++;

      // Calculate response time (time to acknowledge)
      if (alert.acknowledgedAt && alert.triggeredAt) {
        const responseTime =
          new Date(alert.acknowledgedAt).getTime() - new Date(alert.triggeredAt).getTime();
        totalResponseTime += responseTime;
        responseTimeCount++;
      }
    }

    // Sort geofences by count and get top 10
    const topGeofences = Object.entries(geofenceCounts)
      .map(([geofenceId, data]) => ({ geofenceId, geofenceName: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalAlerts: alerts.length,
      byType,
      bySeverity,
      acknowledgedCount,
      resolvedCount,
      avgResponseTimeMinutes:
        responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount / (1000 * 60)) : 0,
      topGeofences,
    };
  }
}

export const geofenceAlertsService = new GeofenceAlertsService();
