/**
 * Email Service Adapter
 *
 * Provider-agnostic email service that supports multiple providers:
 * - SendGrid
 * - AWS SES
 * - Resend
 * - Simulation mode (default)
 *
 * Configuration via environment variables:
 * - EMAIL_PROVIDER: 'sendgrid' | 'aws-ses' | 'resend' | 'simulation'
 * - EMAIL_ENABLED: 'true' | 'false'
 */
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('email-service');

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface EmailProvider {
  send(message: EmailMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

class SimulationEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    log.info(`[EMAIL SIMULATION] Would send email:`);
    log.info(`  To: ${message.to}`);
    log.info(`  Subject: ${message.subject}`);
    log.info(`  From: ${message.from || 'notifications@printyx.com'}`);
    log.info(`  Body: ${message.text || message.html.substring(0, 100)}...`);

    return {
      success: true,
      messageId: `sim-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }
}

class SendGridProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(message: EmailMessage) {
    try {
      const sgMail = await import('@sendgrid/mail');
      sgMail.default.setApiKey(this.apiKey);

      const result = await sgMail.default.send({
        to: message.to,
        from: message.from || process.env.SENDGRID_FROM_EMAIL || 'notifications@printyx.com',
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      log.info(`[SENDGRID] Email sent successfully`);
      log.info(`  To: ${message.to}, Subject: ${message.subject}`);

      return {
        success: true,
        messageId: result[0].headers['x-message-id'],
      };
    } catch (error: any) {
      log.error('[SENDGRID] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

class AWSSESProvider implements EmailProvider {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(region: string, accessKeyId: string, secretAccessKey: string) {
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
  }

  async send(message: EmailMessage) {
    try {
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
      const ses = new SESClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });

      const result = await ses.send(
        new SendEmailCommand({
          Source: message.from || process.env.AWS_SES_FROM_EMAIL || 'notifications@printyx.com',
          Destination: { ToAddresses: [message.to] },
          Message: {
            Subject: { Data: message.subject },
            Body: {
              Html: { Data: message.html },
              Text: { Data: message.text || '' },
            },
          },
        }),
      );

      log.info(`[AWS SES] Email sent successfully`);
      log.info(`  To: ${message.to}, Subject: ${message.subject}`);

      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error: any) {
      log.error('[AWS SES] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

class ResendProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(message: EmailMessage) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(this.apiKey);

      const result = await resend.emails.send({
        from: message.from || process.env.RESEND_FROM_EMAIL || 'notifications@printyx.com',
        to: message.to,
        subject: message.subject,
        html: message.html,
      });

      log.info(`[RESEND] Email sent successfully`);
      log.info(`  To: ${message.to}, Subject: ${message.subject}`);

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error: any) {
      log.error('[RESEND] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export class EmailService {
  private provider: EmailProvider;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.EMAIL_ENABLED === 'true';

    const providerType = process.env.EMAIL_PROVIDER || 'simulation';

    switch (providerType) {
      case 'sendgrid':
        if (!process.env.SENDGRID_API_KEY) {
          log.warn(
            '[EMAIL SERVICE] SendGrid selected but SENDGRID_API_KEY not set. Falling back to simulation.',
          );
          this.provider = new SimulationEmailProvider();
        } else {
          this.provider = new SendGridProvider(process.env.SENDGRID_API_KEY);
        }
        break;

      case 'aws-ses':
        if (
          !process.env.AWS_REGION ||
          !process.env.AWS_ACCESS_KEY_ID ||
          !process.env.AWS_SECRET_ACCESS_KEY
        ) {
          log.warn(
            '[EMAIL SERVICE] AWS SES selected but credentials not set. Falling back to simulation.',
          );
          this.provider = new SimulationEmailProvider();
        } else {
          this.provider = new AWSSESProvider(
            process.env.AWS_REGION,
            process.env.AWS_ACCESS_KEY_ID,
            process.env.AWS_SECRET_ACCESS_KEY,
          );
        }
        break;

      case 'resend':
        if (!process.env.RESEND_API_KEY) {
          log.warn(
            '[EMAIL SERVICE] Resend selected but RESEND_API_KEY not set. Falling back to simulation.',
          );
          this.provider = new SimulationEmailProvider();
        } else {
          this.provider = new ResendProvider(process.env.RESEND_API_KEY);
        }
        break;

      case 'simulation':
      default:
        this.provider = new SimulationEmailProvider();
        break;
    }

    log.info(
      `[EMAIL SERVICE] Initialized with provider: ${providerType}, enabled: ${this.enabled}`,
    );
  }

  async send(message: EmailMessage) {
    if (!this.enabled) {
      log.info(`[EMAIL SERVICE] Email sending is disabled. Message to ${message.to} not sent.`);
      return {
        success: false,
        error: 'Email service is disabled',
      };
    }

    return await this.provider.send(message);
  }
}

// Singleton instance
export const emailService = new EmailService();

// Export convenience function for direct usage
export async function sendEmail(message: EmailMessage) {
  return emailService.send(message);
}
