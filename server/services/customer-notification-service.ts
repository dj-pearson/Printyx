import { emailService } from './email-service';
import { smsService } from './sms-service';
import { db } from '../db';
import { businessRecords, serviceTickets } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Customer Notification Service
 *
 * Handles automated notifications for service dispatch ETA updates
 * Supports both email and SMS channels
 */

interface CustomerContact {
  customerId: string;
  customerName?: string;
  email?: string;
  phone?: string;
  preferredContact?: 'email' | 'sms' | 'both';
}

interface ETANotificationData {
  ticketId: string;
  ticketNumber?: string;
  technicianName: string;
  technicianPhone?: string;
  estimatedArrival: Date;
  customerContact: CustomerContact;
  serviceDescription?: string;
  trackingLink?: string;
}

interface NotificationResult {
  success: boolean;
  emailSent: boolean;
  smsSent: boolean;
  errors: string[];
}

export class CustomerNotificationService {
  /**
   * Calculate ETA window based on current time and estimated duration
   */
  calculateETAWindow(estimatedMinutes: number = 30): {
    start: string;
    end: string;
    minutes: number;
  } {
    const now = new Date();
    const startTime = new Date(now.getTime() + estimatedMinutes * 60000);
    const endTime = new Date(startTime.getTime() + 30 * 60000); // 30-minute window

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    return {
      start: formatTime(startTime),
      end: formatTime(endTime),
      minutes: estimatedMinutes,
    };
  }

  /**
   * Get customer contact information from database
   */
  async getCustomerContact(tenantId: string, customerId: string): Promise<CustomerContact | null> {
    try {
      const [customer] = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          email: businessRecords.primaryContactEmail,
          phone: businessRecords.primaryContactPhone,
        })
        .from(businessRecords)
        .where(and(eq(businessRecords.id, customerId), eq(businessRecords.tenantId, tenantId)))
        .limit(1);

      if (!customer) {
        return null;
      }

      return {
        customerId: customer.id,
        customerName: customer.companyName || undefined,
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        preferredContact: 'both', // Default to both channels
      };
    } catch (error) {
      console.error('[CUSTOMER NOTIFICATION] Error fetching customer contact:', error);
      return null;
    }
  }

  /**
   * Send technician assignment notification with ETA
   */
  async sendAssignmentNotification(data: ETANotificationData): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: true,
      emailSent: false,
      smsSent: false,
      errors: [],
    };

    const eta = this.calculateETAWindow(
      data.estimatedArrival
        ? Math.floor((data.estimatedArrival.getTime() - Date.now()) / 60000)
        : 30,
    );

    // Prepare message content
    const customerName = data.customerContact.customerName || 'Valued Customer';
    const ticketRef = data.ticketNumber || data.ticketId;
    const serviceDesc = data.serviceDescription || 'service call';

    // Email notification
    if (
      data.customerContact.email &&
      (data.customerContact.preferredContact === 'email' ||
        data.customerContact.preferredContact === 'both')
    ) {
      try {
        const emailResult = await emailService.send({
          to: data.customerContact.email,
          subject: `Technician Assigned - Service Call ${ticketRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Your Service Call is Scheduled</h2>
              <p>Hello ${customerName},</p>
              <p>Great news! Your ${serviceDesc} has been assigned to our technician.</p>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1f2937;">Service Details</h3>
                <p style="margin: 10px 0;"><strong>Ticket Number:</strong> ${ticketRef}</p>
                <p style="margin: 10px 0;"><strong>Technician:</strong> ${data.technicianName}</p>
                ${data.technicianPhone ? `<p style="margin: 10px 0;"><strong>Technician Phone:</strong> ${data.technicianPhone}</p>` : ''}
                <p style="margin: 10px 0;"><strong>Estimated Arrival:</strong> ${eta.start} - ${eta.end}</p>
              </div>

              <p style="color: #6b7280; font-size: 14px;">
                <strong>What's Next?</strong><br/>
                • You'll receive another notification 30 minutes before arrival<br/>
                • Please ensure someone is available at the service location<br/>
                • Have any equipment model/serial numbers ready
              </p>

              ${
                data.trackingLink
                  ? `
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${data.trackingLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Track Technician in Real-Time
                  </a>
                </p>
              `
                  : ''
              }

              <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                This is an automated notification from Printyx Service Management. If you have questions, please contact your service provider.
              </p>
            </div>
          `,
          text: `Your service call ${ticketRef} has been assigned to ${data.technicianName}. Estimated arrival: ${eta.start} - ${eta.end}. You'll receive another notification 30 minutes before arrival.`,
        });

        if (emailResult.success) {
          result.emailSent = true;
          console.log(
            `[CUSTOMER NOTIFICATION] Email sent to ${data.customerContact.email} for ticket ${data.ticketId}`,
          );
        } else {
          result.errors.push(`Email failed: ${emailResult.error}`);
        }
      } catch (error: any) {
        result.errors.push(`Email error: ${error.message}`);
        console.error('[CUSTOMER NOTIFICATION] Email send error:', error);
      }
    }

    // SMS notification
    if (
      data.customerContact.phone &&
      (data.customerContact.preferredContact === 'sms' ||
        data.customerContact.preferredContact === 'both')
    ) {
      try {
        const smsBody = `Printyx Service: Your service call ${ticketRef} is assigned to ${data.technicianName}. Estimated arrival: ${eta.start}-${eta.end}. You'll receive a 30-min reminder.${data.trackingLink ? ` Track: ${data.trackingLink}` : ''}`;

        const smsResult = await smsService.send({
          to: data.customerContact.phone,
          body: smsBody,
        });

        if (smsResult.success) {
          result.smsSent = true;
          console.log(
            `[CUSTOMER NOTIFICATION] SMS sent to ${data.customerContact.phone} for ticket ${data.ticketId}`,
          );
        } else {
          result.errors.push(`SMS failed: ${smsResult.error}`);
        }
      } catch (error: any) {
        result.errors.push(`SMS error: ${error.message}`);
        console.error('[CUSTOMER NOTIFICATION] SMS send error:', error);
      }
    }

    result.success = result.emailSent || result.smsSent;

    if (!result.success) {
      console.warn(
        `[CUSTOMER NOTIFICATION] Failed to send any notifications for ticket ${data.ticketId}`,
      );
    }

    return result;
  }

  /**
   * Send 30-minute reminder notification
   */
  async send30MinuteReminder(data: ETANotificationData): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: true,
      emailSent: false,
      smsSent: false,
      errors: [],
    };

    const customerName = data.customerContact.customerName || 'Valued Customer';
    const ticketRef = data.ticketNumber || data.ticketId;

    // SMS is preferred for time-sensitive reminders
    if (
      data.customerContact.phone &&
      (data.customerContact.preferredContact === 'sms' ||
        data.customerContact.preferredContact === 'both')
    ) {
      try {
        const smsBody = `Printyx Service Reminder: Technician ${data.technicianName} will arrive in approximately 30 minutes for service call ${ticketRef}. Please be ready at the service location.`;

        const smsResult = await smsService.send({
          to: data.customerContact.phone,
          body: smsBody,
        });

        if (smsResult.success) {
          result.smsSent = true;
          console.log(
            `[CUSTOMER NOTIFICATION] 30-min reminder SMS sent to ${data.customerContact.phone}`,
          );
        } else {
          result.errors.push(`SMS failed: ${smsResult.error}`);
        }
      } catch (error: any) {
        result.errors.push(`SMS error: ${error.message}`);
        console.error('[CUSTOMER NOTIFICATION] 30-min reminder SMS error:', error);
      }
    }

    // Email reminder (less urgent)
    if (data.customerContact.email && data.customerContact.preferredContact === 'both') {
      try {
        const emailResult = await emailService.send({
          to: data.customerContact.email,
          subject: `Technician Arriving Soon - Service Call ${ticketRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #f59e0b;">Technician Arriving in 30 Minutes</h2>
              <p>Hello ${customerName},</p>
              <p>${data.technicianName} will arrive in approximately 30 minutes for your service call ${ticketRef}.</p>
              <p>Please ensure someone is available at the service location to meet the technician.</p>
              ${data.trackingLink ? `<p><a href="${data.trackingLink}">Track technician location</a></p>` : ''}
              <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
                This is an automated reminder from Printyx Service Management.
              </p>
            </div>
          `,
          text: `Technician ${data.technicianName} will arrive in approximately 30 minutes for service call ${ticketRef}. Please be ready.`,
        });

        if (emailResult.success) {
          result.emailSent = true;
        } else {
          result.errors.push(`Email failed: ${emailResult.error}`);
        }
      } catch (error: any) {
        result.errors.push(`Email error: ${error.message}`);
      }
    }

    result.success = result.emailSent || result.smsSent;
    return result;
  }

  /**
   * Send arrival notification
   */
  async sendArrivalNotification(
    data: Omit<ETANotificationData, 'estimatedArrival'>,
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: true,
      emailSent: false,
      smsSent: false,
      errors: [],
    };

    const customerName = data.customerContact.customerName || 'Valued Customer';
    const ticketRef = data.ticketNumber || data.ticketId;

    // SMS notification (immediate)
    if (
      data.customerContact.phone &&
      (data.customerContact.preferredContact === 'sms' ||
        data.customerContact.preferredContact === 'both')
    ) {
      try {
        const smsBody = `Printyx Service: Technician ${data.technicianName} has arrived for service call ${ticketRef}. Work will begin shortly.`;

        const smsResult = await smsService.send({
          to: data.customerContact.phone,
          body: smsBody,
        });

        if (smsResult.success) {
          result.smsSent = true;
          console.log(`[CUSTOMER NOTIFICATION] Arrival SMS sent to ${data.customerContact.phone}`);
        } else {
          result.errors.push(`SMS failed: ${smsResult.error}`);
        }
      } catch (error: any) {
        result.errors.push(`SMS error: ${error.message}`);
      }
    }

    result.success = result.emailSent || result.smsSent;
    return result;
  }

  /**
   * Schedule a reminder notification (to be called by a job scheduler)
   * This would typically be handled by a background job system
   */
  scheduleReminder(ticketId: string, delayMinutes: number): void {
    // In production, this would integrate with a job scheduler like Bull, Agenda, or node-cron
    // For now, we'll just log the intent
    console.log(
      `[CUSTOMER NOTIFICATION] Reminder scheduled for ticket ${ticketId} in ${delayMinutes} minutes`,
    );

    // Placeholder for actual scheduling implementation:
    // Example using setTimeout (not recommended for production):
    // setTimeout(async () => {
    //   const ticket = await getTicketDetails(ticketId);
    //   if (ticket) {
    //     await this.send30MinuteReminder({...});
    //   }
    // }, delayMinutes * 60 * 1000);
  }
}

// Singleton instance
export const customerNotificationService = new CustomerNotificationService();
