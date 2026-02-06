/**
 * MFA OTP Service
 *
 * Provides SMS and Email-based OTP verification as alternative to TOTP.
 * Supports multiple delivery methods for multi-factor authentication.
 */

import crypto from 'crypto';
import { db } from '../db';
import { emailService } from './email-service';
import { EmailTemplates } from './email-templates';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('mfa-otp-service');

// OTP Configuration
export const OTP_CONFIG = {
  codeLength: 6,
  expirationMinutes: 10,
  maxAttempts: 5,
  cooldownMinutes: 1,
  resendCooldownMinutes: 2,
};

export type MfaMethod = 'totp' | 'sms' | 'email' | 'backup_code';

export interface OtpRecord {
  userId: string;
  tenantId: string | null;
  code: string;
  method: MfaMethod;
  destination: string; // Phone number or email
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

// In-memory store for OTP codes (should be Redis in production)
const otpStore = new Map<string, OtpRecord>();

/**
 * Generate a secure random OTP code
 */
function generateOtpCode(length: number = OTP_CONFIG.codeLength): string {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const code = crypto.randomInt(min, max);
  return code.toString();
}

/**
 * Create a unique key for storing OTP
 */
function createOtpKey(userId: string, method: MfaMethod): string {
  return `otp:${method}:${userId}`;
}

/**
 * Store OTP record
 */
function storeOtp(record: OtpRecord): void {
  const key = createOtpKey(record.userId, record.method);
  otpStore.set(key, record);

  // Auto-cleanup after expiration
  const ttl = OTP_CONFIG.expirationMinutes * 60 * 1000;
  setTimeout(() => {
    const current = otpStore.get(key);
    if (current && current.createdAt.getTime() === record.createdAt.getTime()) {
      otpStore.delete(key);
    }
  }, ttl + 1000);
}

/**
 * Get OTP record
 */
function getOtp(userId: string, method: MfaMethod): OtpRecord | undefined {
  const key = createOtpKey(userId, method);
  return otpStore.get(key);
}

/**
 * Delete OTP record
 */
function deleteOtp(userId: string, method: MfaMethod): void {
  const key = createOtpKey(userId, method);
  otpStore.delete(key);
}

/**
 * Update OTP record
 */
function updateOtp(userId: string, method: MfaMethod, updates: Partial<OtpRecord>): void {
  const key = createOtpKey(userId, method);
  const existing = otpStore.get(key);
  if (existing) {
    otpStore.set(key, { ...existing, ...updates });
  }
}

/**
 * Send OTP via Email
 */
export async function sendEmailOtp(
  userId: string,
  email: string,
  tenantId: string | null,
  userName?: string,
): Promise<{ success: boolean; message: string; expiresAt?: Date }> {
  try {
    // Check for existing unexpired OTP (cooldown)
    const existingOtp = getOtp(userId, 'email');
    if (existingOtp && !existingOtp.verified) {
      const timeSinceCreated = Date.now() - existingOtp.createdAt.getTime();
      const cooldownMs = OTP_CONFIG.resendCooldownMinutes * 60 * 1000;

      if (timeSinceCreated < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - timeSinceCreated) / 1000);
        return {
          success: false,
          message: `Please wait ${waitSeconds} seconds before requesting a new code.`,
        };
      }
    }

    // Generate OTP code
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_CONFIG.expirationMinutes * 60 * 1000);

    // Store OTP record
    const otpRecord: OtpRecord = {
      userId,
      tenantId,
      code,
      method: 'email',
      destination: email,
      expiresAt,
      attempts: 0,
      verified: false,
      createdAt: new Date(),
    };
    storeOtp(otpRecord);

    // Send email
    const emailContent = {
      subject: 'Your Printyx Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Hi${userName ? ` ${userName}` : ''},</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p>This code will expire in ${OTP_CONFIG.expirationMinutes} minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
        </div>
      `,
      text: `Your Printyx verification code is: ${code}. This code expires in ${OTP_CONFIG.expirationMinutes} minutes.`,
    };

    await emailService.send({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return {
      success: true,
      message: 'Verification code sent to your email.',
      expiresAt,
    };
  } catch (error) {
    log.error('Failed to send email OTP:', error);
    return {
      success: false,
      message: 'Failed to send verification code. Please try again.',
    };
  }
}

/**
 * Send OTP via SMS
 */
export async function sendSmsOtp(
  userId: string,
  phoneNumber: string,
  tenantId: string | null,
): Promise<{ success: boolean; message: string; expiresAt?: Date }> {
  try {
    // Check for existing unexpired OTP (cooldown)
    const existingOtp = getOtp(userId, 'sms');
    if (existingOtp && !existingOtp.verified) {
      const timeSinceCreated = Date.now() - existingOtp.createdAt.getTime();
      const cooldownMs = OTP_CONFIG.resendCooldownMinutes * 60 * 1000;

      if (timeSinceCreated < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - timeSinceCreated) / 1000);
        return {
          success: false,
          message: `Please wait ${waitSeconds} seconds before requesting a new code.`,
        };
      }
    }

    // Generate OTP code
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_CONFIG.expirationMinutes * 60 * 1000);

    // Store OTP record
    const otpRecord: OtpRecord = {
      userId,
      tenantId,
      code,
      method: 'sms',
      destination: phoneNumber,
      expiresAt,
      attempts: 0,
      verified: false,
      createdAt: new Date(),
    };
    storeOtp(otpRecord);

    // Send SMS using configured provider
    const smsResult = await sendSmsMessage(
      phoneNumber,
      `Your Printyx verification code is: ${code}`,
    );

    if (!smsResult.success) {
      deleteOtp(userId, 'sms');
      return {
        success: false,
        message: 'Failed to send SMS. Please check your phone number and try again.',
      };
    }

    return {
      success: true,
      message: 'Verification code sent to your phone.',
      expiresAt,
    };
  } catch (error) {
    log.error('Failed to send SMS OTP:', error);
    return {
      success: false,
      message: 'Failed to send verification code. Please try again.',
    };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOtp(
  userId: string,
  code: string,
  method: MfaMethod,
): Promise<{ success: boolean; message: string }> {
  try {
    const otpRecord = getOtp(userId, method);

    if (!otpRecord) {
      return {
        success: false,
        message: 'No pending verification code found. Please request a new code.',
      };
    }

    // Check if already verified
    if (otpRecord.verified) {
      deleteOtp(userId, method);
      return {
        success: false,
        message: 'This code has already been used. Please request a new code.',
      };
    }

    // Check expiration
    if (new Date() > otpRecord.expiresAt) {
      deleteOtp(userId, method);
      return {
        success: false,
        message: 'Verification code has expired. Please request a new code.',
      };
    }

    // Check max attempts
    if (otpRecord.attempts >= OTP_CONFIG.maxAttempts) {
      deleteOtp(userId, method);
      return {
        success: false,
        message: 'Too many failed attempts. Please request a new code.',
      };
    }

    // Verify code (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(code.padEnd(6, '0')),
      Buffer.from(otpRecord.code.padEnd(6, '0')),
    );

    if (!isValid) {
      // Increment attempts
      updateOtp(userId, method, { attempts: otpRecord.attempts + 1 });
      const remainingAttempts = OTP_CONFIG.maxAttempts - otpRecord.attempts - 1;
      return {
        success: false,
        message: `Invalid code. ${remainingAttempts} attempts remaining.`,
      };
    }

    // Mark as verified and delete
    updateOtp(userId, method, { verified: true });
    deleteOtp(userId, method);

    return {
      success: true,
      message: 'Verification successful.',
    };
  } catch (error) {
    log.error('OTP verification error:', error);
    return {
      success: false,
      message: 'Verification failed. Please try again.',
    };
  }
}

/**
 * Get available MFA methods for a user
 */
export async function getAvailableMfaMethods(userId: string): Promise<{
  totp: { available: boolean; enabled: boolean };
  sms: { available: boolean; enabled: boolean; destination?: string };
  email: { available: boolean; enabled: boolean; destination?: string };
}> {
  // Get user data to determine available methods
  // This would query the user's profile for phone and email

  // For now, return default configuration
  // In production, this would check user settings and tenant configuration
  return {
    totp: { available: true, enabled: false },
    sms: { available: true, enabled: false },
    email: { available: true, enabled: false },
  };
}

/**
 * SMS Provider Interface
 */
interface SmsProvider {
  send(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string }>;
}

/**
 * Twilio SMS Provider
 */
class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
  }

  async send(
    phoneNumber: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      log.warn('Twilio not configured. SMS not sent.');
      return { success: false };
    }

    try {
      // Dynamic import to avoid loading Twilio if not used
      const twilio = await import('twilio');
      const client = twilio.default(this.accountSid, this.authToken);

      const result = await client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      log.error('Twilio SMS error:', error);
      return { success: false };
    }
  }
}

/**
 * AWS SNS SMS Provider
 */
class AwsSnsSmsProvider implements SmsProvider {
  async send(
    phoneNumber: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      log.warn('AWS SNS not configured. SMS not sent.');
      return { success: false };
    }

    try {
      // Dynamic import
      const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');

      const client = new SNSClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const command = new PublishCommand({
        PhoneNumber: phoneNumber,
        Message: message,
      });

      const result = await client.send(command);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      log.error('AWS SNS error:', error);
      return { success: false };
    }
  }
}

/**
 * Mock SMS Provider for development/testing
 */
class MockSmsProvider implements SmsProvider {
  async send(
    phoneNumber: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    log.info(`[MOCK SMS] To: ${phoneNumber}, Message: ${message}`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}

/**
 * Get configured SMS provider
 */
function getSmsProvider(): SmsProvider {
  const provider = process.env.SMS_PROVIDER || 'mock';

  switch (provider.toLowerCase()) {
    case 'twilio':
      return new TwilioSmsProvider();
    case 'aws':
    case 'sns':
      return new AwsSnsSmsProvider();
    case 'mock':
    default:
      return new MockSmsProvider();
  }
}

/**
 * Send SMS message using configured provider
 */
async function sendSmsMessage(
  phoneNumber: string,
  message: string,
): Promise<{ success: boolean; messageId?: string }> {
  const provider = getSmsProvider();
  return provider.send(phoneNumber, message);
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // E.164 format validation
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Mask phone number for display
 */
export function maskPhoneNumber(phone: string): string {
  if (phone.length < 7) return '***';
  return phone.slice(0, 3) + '*'.repeat(phone.length - 5) + phone.slice(-2);
}

/**
 * Mask email for display
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';

  const maskedLocal =
    local.length > 2
      ? local[0] + '*'.repeat(Math.min(local.length - 2, 5)) + local[local.length - 1]
      : local[0] + '*';

  return `${maskedLocal}@${domain}`;
}

export default {
  sendEmailOtp,
  sendSmsOtp,
  verifyOtp,
  getAvailableMfaMethods,
  isValidPhoneNumber,
  maskPhoneNumber,
  maskEmail,
  OTP_CONFIG,
};
