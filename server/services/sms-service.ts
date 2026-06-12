/**

 * SMS Service Adapter
 *
 * Provider-agnostic SMS service that supports multiple providers:
 * - Twilio
 * - AWS SNS
 * - Simulation mode (default)
 *
 * Configuration via environment variables:
 * - SMS_PROVIDER: 'twilio' | 'aws-sns' | 'simulation'
 * - SMS_ENABLED: 'true' | 'false'
 */

import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('sms-service');

interface SMSMessage {
  to: string; // E.164 format: +1234567890
  body: string;
  from?: string;
}

interface SMSProvider {
  send(message: SMSMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

class SimulationSMSProvider implements SMSProvider {
  async send(message: SMSMessage) {
    log.info(`[SMS SIMULATION] Would send SMS:`);
    log.info(`  To: ${message.to}`);
    log.info(`  From: ${message.from || '+15551234567'}`);
    log.info(`  Body: ${message.body}`);

    return {
      success: true,
      messageId: `sim-sms-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }
}

class TwilioProvider implements SMSProvider {
  private accountSid: string;
  private authToken: string;
  private phoneNumber: string;

  constructor(accountSid: string, authToken: string, phoneNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.phoneNumber = phoneNumber;
  }

  async send(message: SMSMessage) {
    try {
      const twilio = await import('twilio');
      const client = twilio.default(this.accountSid, this.authToken);

      const result = await client.messages.create({
        body: message.body,
        from: message.from || this.phoneNumber,
        to: message.to,
      });

      log.info(`[TWILIO] SMS sent successfully`);
      log.info(`  To: ${message.to}, Body: ${message.body.substring(0, 50)}...`);

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error: any) {
      log.error('[TWILIO] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

class AWSSNSProvider implements SMSProvider {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(region: string, accessKeyId: string, secretAccessKey: string) {
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
  }

  async send(message: SMSMessage) {
    try {
      const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
      const sns = new SNSClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });

      const result = await sns.send(
        new PublishCommand({
          Message: message.body,
          PhoneNumber: message.to,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        }),
      );

      log.info(`[AWS SNS] SMS sent successfully`);
      log.info(`  To: ${message.to}, Body: ${message.body.substring(0, 50)}...`);

      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error: any) {
      log.error('[AWS SNS] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export class SMSService {
  private provider: SMSProvider;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.SMS_ENABLED === 'true';

    const providerType = process.env.SMS_PROVIDER || 'simulation';

    switch (providerType) {
      case 'twilio':
        if (
          !process.env.TWILIO_ACCOUNT_SID ||
          !process.env.TWILIO_AUTH_TOKEN ||
          !process.env.TWILIO_PHONE_NUMBER
        ) {
          log.warn(
            '[SMS SERVICE] Twilio selected but credentials not set. Falling back to simulation.',
          );
          this.provider = new SimulationSMSProvider();
        } else {
          this.provider = new TwilioProvider(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
            process.env.TWILIO_PHONE_NUMBER,
          );
        }
        break;

      case 'aws-sns':
        if (
          !process.env.AWS_REGION ||
          !process.env.AWS_ACCESS_KEY_ID ||
          !process.env.AWS_SECRET_ACCESS_KEY
        ) {
          log.warn(
            '[SMS SERVICE] AWS SNS selected but credentials not set. Falling back to simulation.',
          );
          this.provider = new SimulationSMSProvider();
        } else {
          this.provider = new AWSSNSProvider(
            process.env.AWS_REGION,
            process.env.AWS_ACCESS_KEY_ID,
            process.env.AWS_SECRET_ACCESS_KEY,
          );
        }
        break;

      case 'simulation':
      default:
        this.provider = new SimulationSMSProvider();
        break;
    }

    log.info(`[SMS SERVICE] Initialized with provider: ${providerType}, enabled: ${this.enabled}`);
  }

  async send(message: SMSMessage) {
    if (!this.enabled) {
      log.info(`[SMS SERVICE] SMS sending is disabled. Message to ${message.to} not sent.`);
      return {
        success: false,
        error: 'SMS service is disabled',
      };
    }

    // Validate phone number format (E.164)
    if (!message.to.match(/^\+[1-9]\d{1,14}$/)) {
      log.error(
        `[SMS SERVICE] Invalid phone number format: ${message.to}. Must be E.164 format (+1234567890)`,
      );
      return {
        success: false,
        error: 'Invalid phone number format. Must be E.164 format (+1234567890)',
      };
    }

    return await this.provider.send(message);
  }
}

// Singleton instance
export const smsService = new SMSService();
