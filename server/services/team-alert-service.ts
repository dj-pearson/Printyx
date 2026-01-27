/**
 * TEAM ALERT SERVICE
 * Monitors team performance metrics and triggers alerts based on configured thresholds
 * Sends notifications via email for coaching flags and performance issues
 */

import { db } from '../db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import {
  alertConfigurations,
  alertInstances,
  alertNotificationLog,
  type AlertConfiguration,
  type NewAlertInstance,
} from '@shared/team-alerts-schema';
import { WarehouseReportingService } from './warehouse-reporting-service';
import { ServiceSupervisorReportingService } from './service-supervisor-reporting-service';
import type { EnhancedUserContext } from '../middleware/enhanced-rbac-middleware';

interface EmailService {
  sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// Import email service dynamically to avoid circular dependencies
let emailService: EmailService | null = null;

async function getEmailService(): Promise<EmailService> {
  if (!emailService) {
    const { default: service } = await import('./email-service');
    emailService = service;
  }
  return emailService;
}

// =====================================================================
// ALERT MONITORING
// =====================================================================

export class TeamAlertService {
  /**
   * Check warehouse team metrics and trigger alerts if thresholds are breached
   */
  static async checkWarehouseAlerts(userContext: EnhancedUserContext): Promise<void> {
    try {
      // Get user's alert configurations
      const configs = await db
        .select()
        .from(alertConfigurations)
        .where(
          and(
            eq(alertConfigurations.tenant_id, userContext.tenant_id),
            eq(alertConfigurations.user_id, userContext.user_id),
            eq(alertConfigurations.enabled, true),
          ),
        );

      if (configs.length === 0) {
        return; // No alerts configured
      }

      // Fetch current warehouse stats
      const stats = await WarehouseReportingService.getTeamQuickStats(userContext);

      // Check each configuration
      for (const config of configs) {
        await this.evaluateWarehouseAlert(config, stats, userContext);
      }
    } catch (error) {
      console.error('Error checking warehouse alerts:', error);
    }
  }

  /**
   * Evaluate a single warehouse alert configuration
   */
  private static async evaluateWarehouseAlert(
    config: AlertConfiguration,
    stats: any,
    userContext: EnhancedUserContext,
  ): Promise<void> {
    const thresholds = config.thresholds as any;
    let shouldAlert = false;
    let alertDetails: any = {};

    // Check FPY rate
    if (config.alertType === 'warehouse_low_fpy' && thresholds.fpyRate) {
      if (stats.performance.firstPassYield < thresholds.fpyRate) {
        shouldAlert = true;
        alertDetails = {
          currentValue: stats.performance.firstPassYield,
          threshold: thresholds.fpyRate,
          metric: 'First Pass Yield',
          period: 'Last 30 days',
        };
      }
    }

    // Check accuracy rate
    if (config.alertType === 'warehouse_low_accuracy' && thresholds.accuracyRate) {
      if (stats.performance.accuracyRate < thresholds.accuracyRate) {
        shouldAlert = true;
        alertDetails = {
          currentValue: stats.performance.accuracyRate,
          threshold: thresholds.accuracyRate,
          metric: 'Accuracy Rate',
          period: 'Last 30 days',
        };
      }
    }

    // Check technicians needing support
    if (config.alertType === 'warehouse_tech_support') {
      if (stats.team.techsNeedingSupport > 0) {
        shouldAlert = true;
        alertDetails = {
          currentValue: stats.team.techsNeedingSupport,
          metric: 'Technicians Needing Support',
          details: {
            totalTechnicians: stats.team.totalTechnicians,
            techsNeedingSupport: stats.team.techsNeedingSupport,
          },
        };
      }
    }

    if (shouldAlert) {
      await this.createAlert(
        {
          tenantId: userContext.tenant_id,
          configurationId: config.id,
          alertType: config.alertType,
          severity: this.determineSeverity(alertDetails),
          title: this.generateWarehouseAlertTitle(config.alertType, alertDetails),
          message: this.generateWarehouseAlertMessage(config.alertType, alertDetails, stats),
          data: alertDetails,
        },
        config,
      );
    }
  }

  /**
   * Check service team metrics and trigger alerts if thresholds are breached
   */
  static async checkServiceAlerts(userContext: EnhancedUserContext): Promise<void> {
    try {
      // Get user's alert configurations
      const configs = await db
        .select()
        .from(alertConfigurations)
        .where(
          and(
            eq(alertConfigurations.tenant_id, userContext.tenant_id),
            eq(alertConfigurations.user_id, userContext.user_id),
            eq(alertConfigurations.enabled, true),
          ),
        );

      if (configs.length === 0) {
        return;
      }

      // Fetch current service stats
      const stats = await ServiceSupervisorReportingService.getTeamQuickStats(userContext);

      // Check each configuration
      for (const config of configs) {
        await this.evaluateServiceAlert(config, stats, userContext);
      }
    } catch (error) {
      console.error('Error checking service alerts:', error);
    }
  }

  /**
   * Evaluate a single service alert configuration
   */
  private static async evaluateServiceAlert(
    config: AlertConfiguration,
    stats: any,
    userContext: EnhancedUserContext,
  ): Promise<void> {
    const thresholds = config.thresholds as any;
    let shouldAlert = false;
    let alertDetails: any = {};

    // Check FTF rate
    if (config.alertType === 'service_low_ftf' && thresholds.ftfRate) {
      if (stats.performance.firstTimeFixRate < thresholds.ftfRate) {
        shouldAlert = true;
        alertDetails = {
          currentValue: stats.performance.firstTimeFixRate,
          threshold: thresholds.ftfRate,
          metric: 'First-Time Fix Rate',
          period: 'Last 30 days',
        };
      }
    }

    // Check SLA compliance
    if (config.alertType === 'service_sla_violation' && thresholds.slaCompliance) {
      if (stats.performance.slaCompliance < thresholds.slaCompliance) {
        shouldAlert = true;
        alertDetails = {
          currentValue: stats.performance.slaCompliance,
          threshold: thresholds.slaCompliance,
          metric: 'SLA Compliance',
          period: 'Last 30 days',
          details: {
            overdueTickets: stats.activity.overdueTickets,
          },
        };
      }
    }

    // Check CSAT score
    if (config.alertType === 'service_low_csat' && thresholds.csatScore) {
      if (stats.performance.customerSatisfaction < thresholds.csatScore) {
        shouldAlert = true;
        alertDetails = {
          currentValue: stats.performance.customerSatisfaction,
          threshold: thresholds.csatScore,
          metric: 'Customer Satisfaction',
          period: 'Last 30 days',
        };
      }
    }

    // Check technicians needing support
    if (config.alertType === 'service_tech_support') {
      if (stats.team.techsNeedingSupport > 0) {
        shouldAlert = true;
        alertDetails = {
          currentValue: stats.team.techsNeedingSupport,
          metric: 'Technicians Needing Support',
          details: {
            totalTechnicians: stats.team.totalTechnicians,
            techsNeedingSupport: stats.team.techsNeedingSupport,
          },
        };
      }
    }

    if (shouldAlert) {
      await this.createAlert(
        {
          tenantId: userContext.tenant_id,
          configurationId: config.id,
          alertType: config.alertType,
          severity: this.determineSeverity(alertDetails),
          title: this.generateServiceAlertTitle(config.alertType, alertDetails),
          message: this.generateServiceAlertMessage(config.alertType, alertDetails, stats),
          data: alertDetails,
        },
        config,
      );
    }
  }

  /**
   * Create an alert instance and send notifications
   */
  private static async createAlert(
    alertData: NewAlertInstance,
    config: AlertConfiguration,
  ): Promise<void> {
    try {
      // Check if similar alert already exists and is active
      const existingAlert = await db
        .select()
        .from(alertInstances)
        .where(
          and(
            eq(alertInstances.tenant_id, alertData.tenant_id!),
            eq(alertInstances.alertType, alertData.alertType),
            eq(alertInstances.status, 'active'),
            gte(alertInstances.created_at, new Date(Date.now() - 24 * 60 * 60 * 1000)), // Last 24 hours
          ),
        )
        .limit(1);

      if (existingAlert.length > 0) {
        console.log(`Alert already exists for ${alertData.alertType}, skipping duplicate`);
        return;
      }

      // Create alert instance
      const [alert] = await db
        .insert(alertInstances)
        .values({
          ...alertData,
          status: 'active',
          createdAt: new Date(),
        })
        .returning();

      console.log(`Created alert instance: ${alert.id} (${alert.alertType})`);

      // Send notifications
      await this.sendNotifications(alert, config);
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }

  /**
   * Send notifications for an alert
   */
  private static async sendNotifications(alert: any, config: AlertConfiguration): Promise<void> {
    const channels = config.notificationChannels as string[];

    for (const channel of channels) {
      if (channel === 'email') {
        await this.sendEmailNotification(alert, config);
      }
      // Future: Add Slack, in-app notifications
    }

    // Update alert with notification timestamp
    await db
      .update(alertInstances)
      .set({
        notifiedAt: new Date(),
        notifiedVia: channels,
        notificationsSent: channels.length,
      })
      .where(eq(alertInstances.id, alert.id));
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    alert: any,
    config: AlertConfiguration,
  ): Promise<void> {
    try {
      const emailSvc = await getEmailService();

      // Get user email
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, config.user_id),
      });

      if (!user || !user.email) {
        console.error(`No email found for user ${config.user_id}`);
        return;
      }

      const recipients = [user.email, ...((config.additionalRecipients as string[]) || [])];

      // Generate email HTML
      const html = this.generateAlertEmailHTML(alert);
      const text = this.generateAlertEmailText(alert);

      // Send to all recipients
      for (const recipient of recipients) {
        const result = await emailSvc.sendEmail({
          to: recipient,
          subject: `🚨 Team Alert: ${alert.title}`,
          html,
          text,
        });

        // Log notification
        await db.insert(alertNotificationLog).values({
          tenantId: config.tenant_id,
          alertInstanceId: alert.id,
          channel: 'email',
          recipient,
          subject: alert.title,
          content: text,
          sent: result.success,
          sentAt: result.success ? new Date() : null,
          deliveryStatus: result.success ? 'sent' : 'failed',
          errorMessage: result.error,
        });

        console.log(`Email notification sent to ${recipient}: ${result.success}`);
      }
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  // =====================================================================
  // HELPER METHODS
  // =====================================================================

  private static determineSeverity(details: any): 'info' | 'warning' | 'critical' {
    if (!details.threshold || !details.currentValue) {
      return 'info';
    }

    const percentDiff = ((details.threshold - details.currentValue) / details.threshold) * 100;

    if (percentDiff > 20) return 'critical';
    if (percentDiff > 10) return 'warning';
    return 'info';
  }

  private static generateWarehouseAlertTitle(alertType: string, details: any): string {
    switch (alertType) {
      case 'warehouse_low_fpy':
        return `Low FPY Rate: ${details.currentValue.toFixed(1)}%`;
      case 'warehouse_low_accuracy':
        return `Low Accuracy Rate: ${details.currentValue.toFixed(1)}%`;
      case 'warehouse_tech_support':
        return `${details.currentValue} Technician(s) Need Support`;
      default:
        return 'Warehouse Team Alert';
    }
  }

  private static generateWarehouseAlertMessage(
    alertType: string,
    details: any,
    stats: any,
  ): string {
    switch (alertType) {
      case 'warehouse_low_fpy':
        return `Warehouse FPY rate (${details.currentValue.toFixed(1)}%) has fallen below the threshold of ${details.threshold}%. Current stats: ${stats.activity.completedKits} completed kits, ${stats.activity.reworkRequired} requiring rework.`;
      case 'warehouse_low_accuracy':
        return `Warehouse accuracy rate (${details.currentValue.toFixed(1)}%) has fallen below the threshold of ${details.threshold}%. This indicates quality control issues requiring attention.`;
      case 'warehouse_tech_support':
        return `${details.currentValue} warehouse technician(s) are performing below team average (FPY < 70%) and may need coaching or additional training.`;
      default:
        return 'A warehouse team alert has been triggered.';
    }
  }

  private static generateServiceAlertTitle(alertType: string, details: any): string {
    switch (alertType) {
      case 'service_low_ftf':
        return `Low FTF Rate: ${details.currentValue.toFixed(1)}%`;
      case 'service_sla_violation':
        return `SLA Compliance Below Target: ${details.currentValue.toFixed(1)}%`;
      case 'service_low_csat':
        return `Low Customer Satisfaction: ${details.currentValue.toFixed(2)}/5.0`;
      case 'service_tech_support':
        return `${details.currentValue} Technician(s) Need Support`;
      default:
        return 'Service Team Alert';
    }
  }

  private static generateServiceAlertMessage(alertType: string, details: any, stats: any): string {
    switch (alertType) {
      case 'service_low_ftf':
        return `Service team FTF rate (${details.currentValue.toFixed(1)}%) has fallen below the threshold of ${details.threshold}%. Current stats: ${stats.activity.completedCalls} completed calls.`;
      case 'service_sla_violation':
        return `SLA compliance (${details.currentValue.toFixed(1)}%) is below the ${details.threshold}% threshold. There are currently ${details.details?.overdueTickets || 0} overdue tickets requiring attention.`;
      case 'service_low_csat':
        return `Customer satisfaction score (${details.currentValue.toFixed(2)}/5.0) has fallen below the threshold of ${details.threshold}/5.0. This requires immediate attention to improve customer experience.`;
      case 'service_tech_support':
        return `${details.currentValue} service technician(s) are performing below team average and may need coaching or additional support.`;
      default:
        return 'A service team alert has been triggered.';
    }
  }

  private static generateAlertEmailHTML(alert: any): string {
    const severityColors = {
      info: '#3b82f6',
      warning: '#f59e0b',
      critical: '#ef4444',
    };

    const severityBg = {
      info: '#eff6ff',
      warning: '#fef3c7',
      critical: '#fee2e2',
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${alert.title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: ${severityBg[alert.severity]}; border-left: 4px solid ${severityColors[alert.severity]}; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
    <h2 style="margin: 0 0 10px 0; color: ${severityColors[alert.severity]};">
      🚨 ${alert.title}
    </h2>
    <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">
      ${alert.severity} Alert
    </p>
  </div>

  <div style="background-color: #f9fafb; padding: 20px; border-radius: 4px; margin-bottom: 20px;">
    <p style="margin: 0 0 15px 0; font-size: 16px;">
      ${alert.message}
    </p>

    ${
      alert.data?.currentValue !== undefined
        ? `
    <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
      <div>
        <p style="margin: 0; font-size: 12px; color: #666;">Current Value</p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: ${severityColors[alert.severity]};">
          ${typeof alert.data.currentValue === 'number' ? alert.data.currentValue.toFixed(1) : alert.data.currentValue}${alert.data.metric?.includes('Rate') || alert.data.metric?.includes('Compliance') ? '%' : ''}
        </p>
      </div>
      ${
        alert.data?.threshold !== undefined
          ? `
      <div>
        <p style="margin: 0; font-size: 12px; color: #666;">Threshold</p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #6b7280;">
          ${alert.data.threshold}${alert.data.metric?.includes('Rate') || alert.data.metric?.includes('Compliance') ? '%' : ''}
        </p>
      </div>
      `
          : ''
      }
    </div>
    `
        : ''
    }
  </div>

  <div style="background-color: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 4px;">
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">Recommended Actions</h3>
    <ul style="margin: 0; padding-left: 20px;">
      <li>Review individual team member performance</li>
      <li>Schedule coaching sessions with affected team members</li>
      <li>Analyze root causes of performance issues</li>
      <li>Implement corrective action plans</li>
      <li>Monitor progress over next 7-14 days</li>
    </ul>
  </div>

  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">
      This is an automated alert from Printyx Team Performance Monitoring
    </p>
    <p style="margin: 5px 0 0 0;">
      Alert ID: ${alert.id} | Created: ${new Date(alert.created_at).toLocaleString()}
    </p>
  </div>
</body>
</html>
    `;
  }

  private static generateAlertEmailText(alert: any): string {
    let text = `TEAM ALERT: ${alert.title}\n\n`;
    text += `Severity: ${alert.severity.toUpperCase()}\n\n`;
    text += `${alert.message}\n\n`;

    if (alert.data?.currentValue !== undefined) {
      text += `Current Value: ${alert.data.currentValue}\n`;
      if (alert.data?.threshold !== undefined) {
        text += `Threshold: ${alert.data.threshold}\n`;
      }
      text += `\n`;
    }

    text += `Recommended Actions:\n`;
    text += `- Review individual team member performance\n`;
    text += `- Schedule coaching sessions with affected team members\n`;
    text += `- Analyze root causes of performance issues\n`;
    text += `- Implement corrective action plans\n`;
    text += `- Monitor progress over next 7-14 days\n\n`;

    text += `---\n`;
    text += `Alert ID: ${alert.id}\n`;
    text += `Created: ${new Date(alert.created_at).toLocaleString()}\n`;

    return text;
  }

  /**
   * Get active alerts for a user
   */
  static async getActiveAlerts(tenantId: string, userId: string) {
    return await db
      .select()
      .from(alertInstances)
      .where(and(eq(alertInstances.tenant_id, tenantId), eq(alertInstances.status, 'active')))
      .orderBy(sql`${alertInstances.created_at} DESC`)
      .limit(50);
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(alertId: string, userId: string) {
    return await db
      .update(alertInstances)
      .set({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(alertInstances.id, alertId))
      .returning();
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string, userId: string, notes?: string) {
    return await db
      .update(alertInstances)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolutionNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(alertInstances.id, alertId))
      .returning();
  }
}
