import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import crypto from 'crypto';
// SECURITY FIX: Import requireRootAdmin middleware for admin-only endpoints
import { requireRootAdmin } from '../routes-root-admin';

const router = Router();

// ==================== Helper Functions ====================

function generateTOTPSecret(): string {
  // Generate a random base32-encoded secret (20 bytes = 32 base32 chars)
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.ceil((cleanInput.length * 5) / 8));

  for (let i = 0; i < cleanInput.length; i++) {
    const charIndex = alphabet.indexOf(cleanInput[i]);
    if (charIndex === -1) continue;

    value = (value << 5) | charIndex;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return output.subarray(0, index);
}

function generateTOTP(secret: string, window: number = 0): string {
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const counter = Math.floor(epoch / timeStep) + window;

  const secretBuffer = base32Decode(secret);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(timeBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

function verifyTOTP(secret: string, token: string): boolean {
  // Check current time window and ±1 window for clock drift tolerance
  for (let window = -1; window <= 1; window++) {
    if (generateTOTP(secret, window) === token) {
      return true;
    }
  }
  return false;
}

function getRequestMetadata(req: Request) {
  return {
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    deviceInfo: {
      browser: req.headers['user-agent'] || 'unknown',
    },
  };
}

// ==================== MFA Enrollment Routes ====================

// POST /api/mfa/enroll/init - Initialize MFA enrollment (generate secret and QR code URL)
router.post('/enroll/init', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Generate a new TOTP secret
    const secret = generateTOTPSecret();

    // Store the secret in the session for verification
    if (!req.session) {
      return res.status(500).json({ error: 'Session not available' });
    }
    req.session.pendingMfaSecret = secret;
    req.session.pendingMfaTimestamp = Date.now();

    // Create otpauth URL for QR code
    const issuer = 'Printyx';
    const accountName = user.email || user.id;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

    res.json({
      secret, // Still send for user convenience (QR code display)
      otpauthUrl,
      qrCodeData: otpauthUrl, // Frontend can use this to generate QR code
      backupCodes: [], // Will be generated after verification
    });
  } catch (error) {
    console.error('MFA enrollment init error:', error);
    res.status(500).json({ error: 'Failed to initialize MFA enrollment' });
  }
});

// POST /api/mfa/enroll/verify - Verify TOTP code and complete enrollment
const verifyMfaSchema = z.object({
  token: z.string().length(6),
});

router.post('/enroll/verify', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!req.session) {
    return res.status(500).json({ error: 'Session not available' });
  }

  try {
    const { token } = verifyMfaSchema.parse(req.body);

    // Retrieve the server-stored secret from session
    const storedSecret = req.session.pendingMfaSecret;
    const storedTimestamp = req.session.pendingMfaTimestamp;

    if (!storedSecret) {
      // Log attempt without pending secret for audit trail
      await storage.createMfaAuditLog({
        userId: user.id,
        tenantId: user.tenantId || null,
        eventType: 'enrollment',
        success: false,
        failureReason: 'no_pending_secret',
        ...getRequestMetadata(req),
      });

      return res
        .status(400)
        .json({ error: 'No pending MFA enrollment. Please start enrollment again.' });
    }

    // Check if the secret has expired (10 minutes)
    const TEN_MINUTES = 10 * 60 * 1000;
    if (storedTimestamp && Date.now() - storedTimestamp > TEN_MINUTES) {
      // Clear expired secret
      delete req.session.pendingMfaSecret;
      delete req.session.pendingMfaTimestamp;

      await storage.createMfaAuditLog({
        userId: user.id,
        tenantId: user.tenantId || null,
        eventType: 'enrollment',
        success: false,
        failureReason: 'secret_expired',
        ...getRequestMetadata(req),
      });

      return res
        .status(400)
        .json({ error: 'Enrollment session expired. Please start enrollment again.' });
    }

    // Verify the TOTP token against the server-stored secret
    const isValid = verifyTOTP(storedSecret, token);

    if (!isValid) {
      // Log failed enrollment attempt
      await storage.createMfaAuditLog({
        userId: user.id,
        tenantId: user.tenantId || null,
        eventType: 'enrollment',
        success: false,
        failureReason: 'invalid_token',
        ...getRequestMetadata(req),
      });

      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Enable MFA for the user with the server-stored secret
    await storage.enableMfaForUser(user.id, storedSecret);

    // Clear the pending secret from session
    delete req.session.pendingMfaSecret;
    delete req.session.pendingMfaTimestamp;

    // Generate backup codes
    const { codes } = await storage.generateBackupCodes(user.id, user.tenantId || null, 10);

    // Log successful enrollment
    await storage.createMfaAuditLog({
      userId: user.id,
      tenantId: user.tenantId || null,
      eventType: 'enrollment',
      success: true,
      ...getRequestMetadata(req),
    });

    res.json({
      success: true,
      backupCodes: codes,
      message: 'MFA enabled successfully. Save your backup codes in a secure location.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('MFA enrollment verify error:', error);
    res.status(500).json({ error: 'Failed to complete MFA enrollment' });
  }
});

// ==================== MFA Verification Routes ====================

// POST /api/mfa/verify - Verify TOTP or backup code during login
const verifyLoginSchema = z.object({
  userId: z.string(),
  code: z.string(),
  useBackupCode: z.boolean().optional(),
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { userId, code, useBackupCode } = verifyLoginSchema.parse(req.body);

    const user = await storage.getUser(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'MFA not enabled for this user' });
    }

    let isValid = false;
    let usedBackupCode = false;

    if (useBackupCode) {
      // Verify backup code
      isValid = await storage.validateBackupCode(userId, code);
      usedBackupCode = isValid;

      if (isValid) {
        await storage.createMfaAuditLog({
          userId,
          tenantId: user.tenantId || null,
          eventType: 'backup_code_used',
          success: true,
          ...getRequestMetadata(req),
        });
      }
    } else {
      // Verify TOTP
      isValid = verifyTOTP(user.twoFactorSecret, code);
    }

    if (!isValid) {
      await storage.createMfaAuditLog({
        userId,
        tenantId: user.tenantId || null,
        eventType: 'verification_failure',
        success: false,
        failureReason: useBackupCode ? 'invalid_backup_code' : 'invalid_token',
        ...getRequestMetadata(req),
      });

      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Log successful verification
    await storage.createMfaAuditLog({
      userId,
      tenantId: user.tenantId || null,
      eventType: 'verification_success',
      success: true,
      eventDetails: { usedBackupCode },
      ...getRequestMetadata(req),
    });

    res.json({ success: true, usedBackupCode });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('MFA verification error:', error);
    res.status(500).json({ error: 'Failed to verify MFA code' });
  }
});

// ==================== MFA Status & Management Routes ====================

// GET /api/mfa/status - Get user's MFA status
router.get('/status', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const status = await storage.getUserMfaStatus(user.id);
    res.json(status);
  } catch (error) {
    console.error('Get MFA status error:', error);
    res.status(500).json({ error: 'Failed to get MFA status' });
  }
});

// POST /api/mfa/disable - Disable MFA for current user
const disableMfaSchema = z.object({
  token: z.string().length(6),
});

router.post('/disable', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { token } = disableMfaSchema.parse(req.body);

    // Get current user data
    const currentUser = await storage.getUser(user.id);
    if (!currentUser || !currentUser.twoFactorEnabled || !currentUser.twoFactorSecret) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    // Verify TOTP token before disabling
    const isValid = verifyTOTP(currentUser.twoFactorSecret, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Disable MFA
    await storage.disableMfaForUser(user.id);

    // Log the action
    await storage.createMfaAuditLog({
      userId: user.id,
      tenantId: user.tenantId || null,
      eventType: 'disabled',
      success: true,
      performedBy: user.id,
      ...getRequestMetadata(req),
    });

    res.json({ success: true, message: 'MFA disabled successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

// ==================== Backup Codes Routes ====================

// POST /api/mfa/backup-codes/regenerate - Regenerate backup codes
const regenerateCodesSchema = z.object({
  token: z.string().length(6),
});

router.post('/backup-codes/regenerate', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { token } = regenerateCodesSchema.parse(req.body);

    // Get current user data
    const currentUser = await storage.getUser(user.id);
    if (!currentUser || !currentUser.twoFactorEnabled || !currentUser.twoFactorSecret) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }

    // Verify TOTP token before regenerating
    const isValid = verifyTOTP(currentUser.twoFactorSecret, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate new backup codes
    const { codes } = await storage.generateBackupCodes(user.id, user.tenantId || null, 10);

    res.json({
      success: true,
      backupCodes: codes,
      message: 'Backup codes regenerated successfully. Save them in a secure location.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({ error: 'Failed to regenerate backup codes' });
  }
});

// GET /api/mfa/backup-codes/count - Get count of unused backup codes
router.get('/backup-codes/count', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const unusedCodes = await storage.getUnusedBackupCodes(user.id);
    res.json({ count: unusedCodes.length });
  } catch (error) {
    console.error('Get backup codes count error:', error);
    res.status(500).json({ error: 'Failed to get backup codes count' });
  }
});

// ==================== Admin Routes ====================

// POST /api/mfa/admin/reset/:userId - Admin: Reset MFA for a user
// SECURITY FIX: Added requireRootAdmin middleware to restrict access to root admins only
router.post('/admin/reset/:userId', requireRootAdmin, async (req: Request, res: Response) => {
  const user = (req as any).user || req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { userId } = req.params;

    // Disable MFA for the target user
    await storage.disableMfaForUser(userId);

    // Log the admin action
    await storage.createMfaAuditLog({
      userId,
      tenantId: user.tenantId || null,
      eventType: 'admin_reset',
      success: true,
      performedBy: user.id,
      ...getRequestMetadata(req),
    });

    res.json({ success: true, message: 'MFA reset successfully for user' });
  } catch (error) {
    console.error('Admin MFA reset error:', error);
    res.status(500).json({ error: 'Failed to reset MFA' });
  }
});

// GET /api/mfa/admin/compliance-report - Admin: Get MFA compliance report for tenant
router.get('/admin/compliance-report', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!user.tenantId) {
    return res.status(400).json({ error: 'User must belong to a tenant' });
  }

  try {
    const report = await storage.getMfaComplianceReport(user.tenantId);
    res.json(report);
  } catch (error) {
    console.error('Get compliance report error:', error);
    res.status(500).json({ error: 'Failed to get compliance report' });
  }
});

// GET /api/mfa/admin/users-without-mfa - Admin: Get users without MFA enabled
router.get('/admin/users-without-mfa', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!user.tenantId) {
    return res.status(400).json({ error: 'User must belong to a tenant' });
  }

  try {
    const users = await storage.getUsersWithoutMfa(user.tenantId);
    res.json(users);
  } catch (error) {
    console.error('Get users without MFA error:', error);
    res.status(500).json({ error: 'Failed to get users without MFA' });
  }
});

// GET /api/mfa/audit-logs - Get MFA audit logs for current user
router.get('/audit-logs', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { eventType, success } = req.query;

    const filters: { eventType?: string; success?: boolean } = {};
    if (eventType && typeof eventType === 'string') {
      filters.eventType = eventType;
    }
    if (success !== undefined) {
      filters.success = success === 'true';
    }

    const logs = await storage.getMfaAuditLogs(user.id, filters);
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// GET /api/mfa/admin/audit-logs - Admin: Get MFA audit logs for entire tenant
router.get('/admin/audit-logs', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!user.tenantId) {
    return res.status(400).json({ error: 'User must belong to a tenant' });
  }

  try {
    const { eventType, success } = req.query;

    const filters: { eventType?: string; success?: boolean } = {};
    if (eventType && typeof eventType === 'string') {
      filters.eventType = eventType;
    }
    if (success !== undefined) {
      filters.success = success === 'true';
    }

    const logs = await storage.getMfaAuditLogsByTenant(user.tenantId, filters);
    res.json(logs);
  } catch (error) {
    console.error('Get tenant audit logs error:', error);
    res.status(500).json({ error: 'Failed to get tenant audit logs' });
  }
});

// ==================== SMS/Email OTP Routes ====================

import {
  sendEmailOtp,
  sendSmsOtp,
  verifyOtp,
  getAvailableMfaMethods,
  isValidPhoneNumber,
  maskPhoneNumber,
  maskEmail,
} from '../services/mfa-otp-service';

// POST /api/mfa/otp/email/send - Send OTP via email
const sendEmailOtpSchema = z.object({
  email: z.string().email().optional(), // Uses user's email if not provided
});

router.post('/otp/email/send', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { email: customEmail } = sendEmailOtpSchema.parse(req.body);
    const userEmail = customEmail || user.email;

    if (!userEmail) {
      return res.status(400).json({ error: 'No email address available' });
    }

    const result = await sendEmailOtp(
      user.id,
      userEmail,
      user.tenantId || null,
      user.firstName || user.email,
    );

    if (!result.success) {
      return res.status(429).json({ error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      destination: maskEmail(userEmail),
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Send email OTP error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /api/mfa/otp/sms/send - Send OTP via SMS
const sendSmsOtpSchema = z.object({
  phoneNumber: z.string(),
});

router.post('/otp/sms/send', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { phoneNumber } = sendSmsOtpSchema.parse(req.body);

    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        error: 'Invalid phone number format',
        message: 'Please provide a phone number in E.164 format (e.g., +1234567890)',
      });
    }

    const result = await sendSmsOtp(user.id, phoneNumber, user.tenantId || null);

    if (!result.success) {
      return res.status(429).json({ error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      destination: maskPhoneNumber(phoneNumber),
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Send SMS OTP error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /api/mfa/otp/verify - Verify OTP code (email or SMS)
const verifyOtpSchema = z.object({
  code: z.string().length(6),
  method: z.enum(['email', 'sms']),
});

router.post('/otp/verify', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { code, method } = verifyOtpSchema.parse(req.body);

    const result = await verifyOtp(user.id, code, method);

    if (!result.success) {
      // Log failed verification
      await storage.createMfaAuditLog({
        userId: user.id,
        tenantId: user.tenantId || null,
        eventType: 'otp_verification_failure',
        success: false,
        failureReason: 'invalid_code',
        eventDetails: { method },
        ...getRequestMetadata(req),
      });

      return res.status(400).json({ error: result.message });
    }

    // Log successful verification
    await storage.createMfaAuditLog({
      userId: user.id,
      tenantId: user.tenantId || null,
      eventType: 'otp_verification_success',
      success: true,
      eventDetails: { method },
      ...getRequestMetadata(req),
    });

    // Mark MFA as verified in session
    if (req.session) {
      (req.session as any).mfaVerified = true;
      (req.session as any).mfaVerifiedAt = Date.now();
      (req.session as any).mfaMethod = method;
    }

    res.json({
      success: true,
      message: 'Verification successful',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// GET /api/mfa/methods - Get available MFA methods for current user
router.get('/methods', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get TOTP status
    const mfaStatus = await storage.getUserMfaStatus(user.id);

    // Get OTP methods
    const otpMethods = await getAvailableMfaMethods(user.id);

    res.json({
      totp: {
        available: true,
        enabled: mfaStatus?.enabled || false,
        description: 'Time-based One-Time Password (Authenticator App)',
      },
      sms: {
        available: otpMethods.sms.available,
        enabled: otpMethods.sms.enabled,
        destination: otpMethods.sms.destination
          ? maskPhoneNumber(otpMethods.sms.destination)
          : undefined,
        description: 'SMS Text Message',
      },
      email: {
        available: otpMethods.email.available,
        enabled: otpMethods.email.enabled,
        destination: user.email ? maskEmail(user.email) : undefined,
        description: 'Email Verification Code',
      },
      backupCodes: {
        available: mfaStatus?.enabled || false,
        enabled: mfaStatus?.hasBackupCodes || false,
        description: 'Pre-generated Backup Codes',
      },
    });
  } catch (error) {
    console.error('Get MFA methods error:', error);
    res.status(500).json({ error: 'Failed to get MFA methods' });
  }
});

// POST /api/mfa/challenge - Request MFA challenge (for re-verification)
const challengeSchema = z.object({
  method: z.enum(['totp', 'sms', 'email']).default('totp'),
  phoneNumber: z.string().optional(), // Required for SMS
});

router.post('/challenge', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { method, phoneNumber } = challengeSchema.parse(req.body);

    switch (method) {
      case 'email':
        const emailResult = await sendEmailOtp(
          user.id,
          user.email,
          user.tenantId || null,
          user.firstName,
        );
        return res.json({
          success: emailResult.success,
          method: 'email',
          message: emailResult.message,
          destination: user.email ? maskEmail(user.email) : undefined,
        });

      case 'sms':
        if (!phoneNumber) {
          return res.status(400).json({ error: 'Phone number required for SMS challenge' });
        }
        const smsResult = await sendSmsOtp(user.id, phoneNumber, user.tenantId || null);
        return res.json({
          success: smsResult.success,
          method: 'sms',
          message: smsResult.message,
          destination: maskPhoneNumber(phoneNumber),
        });

      case 'totp':
      default:
        // TOTP doesn't require sending - just verify user has it enabled
        const mfaStatus = await storage.getUserMfaStatus(user.id);
        if (!mfaStatus?.enabled) {
          return res.status(400).json({
            error: 'TOTP not enabled',
            message: 'Please set up an authenticator app first',
          });
        }
        return res.json({
          success: true,
          method: 'totp',
          message: 'Enter the code from your authenticator app',
        });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('MFA challenge error:', error);
    res.status(500).json({ error: 'Failed to initiate MFA challenge' });
  }
});

export default router;
