/**
 * TRIAL MANAGEMENT SERVICE
 *
 * Handles trial lifecycle, email automation, and subscription transitions
 */

import { db } from '../db';
import { users, tenants } from '../../shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { EmailTemplates } from './email-templates';
import { emailService } from './email-service';

export interface TrialStatus {
  userId: string;
  tenantId: string;
  trialStartDate: Date;
  trialEndDate: Date;
  daysRemaining: number;
  status: 'active' | 'expired' | 'converted';
}

export class TrialManagementService {
  /**
   * Get trial status for a user
   */
  static async getTrialStatus(userId: string): Promise<TrialStatus | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user || !user.tenantId) {
      return null;
    }

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);

    if (!tenant || !tenant.createdAt) {
      return null;
    }

    // Calculate trial period (14 days from tenant creation)
    const trialStartDate = new Date(tenant.createdAt);
    const trialEndDate = new Date(trialStartDate);
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    const now = new Date();
    const daysRemaining = Math.ceil(
      (trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const status: 'active' | 'expired' | 'converted' =
      daysRemaining > 0 ? 'active' : daysRemaining <= 0 ? 'expired' : 'active';

    return {
      userId: user.id,
      tenantId: tenant.id,
      trialStartDate,
      trialEndDate,
      daysRemaining,
      status,
    };
  }

  /**
   * Send trial email based on days elapsed
   */
  static async sendTrialEmail(
    userId: string,
    emailType: 'day3' | 'day7' | 'day11' | 'day13' | 'expired',
  ): Promise<boolean> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        console.error(`[TRIAL EMAIL] User not found: ${userId}`);
        return false;
      }

      const trialStatus = await this.getTrialStatus(userId);
      if (!trialStatus) {
        console.error(`[TRIAL EMAIL] Could not get trial status for user: ${userId}`);
        return false;
      }

      const templateData = {
        userName: user.firstName || undefined,
        userEmail: user.email,
        trialEndDate: trialStatus.trialEndDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        trialDays: trialStatus.daysRemaining,
      };

      let emailTemplate;
      switch (emailType) {
        case 'day3':
          emailTemplate = EmailTemplates.trialDay3(templateData);
          break;
        case 'day7':
          emailTemplate = EmailTemplates.trialDay7(templateData);
          break;
        case 'day11':
          emailTemplate = EmailTemplates.trialEndingSoon(templateData);
          break;
        case 'day13':
          emailTemplate = EmailTemplates.trialEndingSoon(templateData);
          break;
        case 'expired':
          emailTemplate = EmailTemplates.trialEndingSoon(templateData); // Use existing template
          break;
        default:
          console.error(`[TRIAL EMAIL] Unknown email type: ${emailType}`);
          return false;
      }

      await emailService.send({
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      console.log(`[TRIAL EMAIL] Sent ${emailType} email to ${user.email}`);
      return true;
    } catch (error) {
      console.error(`[TRIAL EMAIL] Error sending ${emailType} email:`, error);
      return false;
    }
  }

  /**
   * Process all trial users and send appropriate emails
   * This should be called by a cron job daily
   */
  static async processTrialEmails(): Promise<{
    processed: number;
    sent: number;
    errors: number;
  }> {
    const results = {
      processed: 0,
      sent: 0,
      errors: 0,
    };

    try {
      // Get all users with active trials
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(sql`${users.tenantId} IS NOT NULL`);

      for (const user of allUsers) {
        results.processed++;

        try {
          const trialStatus = await this.getTrialStatus(user.id);

          if (!trialStatus || trialStatus.status !== 'active') {
            continue;
          }

          // Calculate days elapsed since trial start
          const now = new Date();
          const daysElapsed = Math.floor(
            (now.getTime() - trialStatus.trialStartDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          // Send appropriate email based on trial day
          let emailSent = false;

          if (daysElapsed === 3) {
            emailSent = await this.sendTrialEmail(user.id, 'day3');
          } else if (daysElapsed === 7) {
            emailSent = await this.sendTrialEmail(user.id, 'day7');
          } else if (daysElapsed === 11) {
            emailSent = await this.sendTrialEmail(user.id, 'day11');
          } else if (daysElapsed === 13) {
            emailSent = await this.sendTrialEmail(user.id, 'day13');
          } else if (daysElapsed >= 14 && trialStatus.status === 'expired') {
            emailSent = await this.sendTrialEmail(user.id, 'expired');
          }

          if (emailSent) {
            results.sent++;
          }
        } catch (error) {
          console.error(`[TRIAL PROCESSING] Error processing user ${user.id}:`, error);
          results.errors++;
        }
      }

      console.log(
        `[TRIAL PROCESSING] Completed: ${results.processed} processed, ${results.sent} sent, ${results.errors} errors`,
      );
      return results;
    } catch (error) {
      console.error('[TRIAL PROCESSING] Fatal error:', error);
      throw error;
    }
  }

  /**
   * Get all users in trial
   */
  static async getAllTrialUsers(): Promise<TrialStatus[]> {
    const allUsers = await db
      .select({
        id: users.id,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(sql`${users.tenantId} IS NOT NULL`);

    const trialUsers: TrialStatus[] = [];

    for (const user of allUsers) {
      const status = await this.getTrialStatus(user.id);
      if (status && status.status === 'active') {
        trialUsers.push(status);
      }
    }

    return trialUsers;
  }
}

export const trialManagementService = new TrialManagementService();
