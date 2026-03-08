import express from 'express';
import rateLimit from 'express-rate-limit';
import { storage } from './storage';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { db } from './db';
import { passwordResets, emailVerifications, loginAttempts } from '../shared/auth-schema';
import { users, tenants } from '@shared/schema';
import { eq, and, gt, desc, lt, isNull, or } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { EmailTemplates } from './services/email-templates';
import { emailService } from './services/email-service';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('auth-routes');

const router = express.Router();

// SECURITY: Progressive account lockout configuration
const LOCKOUT_TIERS = [
  { threshold: 5, durationMinutes: 15 },   // 5 failures → 15 min lock
  { threshold: 10, durationMinutes: 60 },   // 10 failures → 1 hour lock
  { threshold: 20, durationMinutes: -1 },   // 20 failures → requires admin unlock (-1 = permanent)
];
const ATTEMPT_WINDOW_MINUTES = 15; // Count attempts within 15-minute window

// Known automated tool User-Agent patterns
const AUTOMATED_UA_PATTERNS = [
  /curl\//i, /python-requests/i, /python-urllib/i, /axios\//i,
  /headlesschrome/i, /phantomjs/i, /selenium/i, /puppeteer/i,
  /scrapy/i, /httpie/i, /postman/i, /insomnia/i,
];

// SECURITY FIX: Enhanced password validation with complexity requirements
const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1), // Don't validate complexity on login, only on creation/reset
});

// Password reset schemas
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema, // SECURITY FIX: Use enhanced password validation
});

// Signup schema
const signupSchema = z.object({
  // Company information
  companyName: z.string().min(2, 'Company name is required'),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),

  // Admin user
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  password: passwordSchema, // SECURITY FIX: Use enhanced password validation
  phone: z.string().optional(),

  // Company details
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().default('US'),
  timezone: z.string().default('America/New_York'),

  // Plan selection
  planSlug: z.string().default('starter'),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly'),

  // Terms acceptance
  acceptedTerms: z.boolean().refine((val) => val === true, 'You must accept the terms'),
  acceptedPrivacy: z.boolean().refine((val) => val === true, 'You must accept the privacy policy'),
});

// Email verification schema
const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

// Session management
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    tenantId?: string;
  }
}

// Brute-force protection for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' },
});

// Rate limiting for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts. Please try again later.' },
});

// SECURITY FIX: Rate limiting for signup to prevent automated account creation
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many signup attempts. Please try again later.' },
});

/**
 * SECURITY: Helper function to check if account is locked
 */
async function isAccountLocked(
  email: string,
): Promise<{ locked: boolean; remainingMinutes?: number; requiresAdminUnlock?: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();

  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, normalizedEmail))
    .limit(1);

  if (!attempt || !attempt.lockedUntil) {
    return { locked: false };
  }

  // Check for permanent lock (sentinel value: epoch 0)
  if (attempt.lockedUntil.getTime() === 0) {
    return { locked: true, requiresAdminUnlock: true };
  }

  const now = new Date();
  if (attempt.lockedUntil > now) {
    const remainingMs = attempt.lockedUntil.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
    return { locked: true, remainingMinutes };
  }

  return { locked: false };
}

/**
 * SECURITY: Detect anomalous login behavior
 */
function detectLoginAnomaly(
  req: express.Request,
  email: string,
): { isAnomalous: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const userAgent = req.headers['user-agent'] || '';

  // Check for automated tool signatures
  for (const pattern of AUTOMATED_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      reasons.push(`automated_tool_detected:${pattern.source}`);
      break;
    }
  }

  // Missing standard browser headers
  if (!req.headers['accept-language'] && userAgent) {
    reasons.push('missing_accept_language');
  }

  // Empty or missing User-Agent
  if (!userAgent) {
    reasons.push('missing_user_agent');
  }

  return { isAnomalous: reasons.length > 0, reasons };
}

/**
 * SECURITY: Record a failed login attempt with progressive lockout
 */
async function recordFailedLoginAttempt(
  email: string,
  ipAddress: string,
  anomalyReasons: string[] = [],
): Promise<{ locked: boolean; attemptsRemaining: number; requiresAdminUnlock: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

  // Get or create login attempt record
  const [existingAttempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, normalizedEmail))
    .limit(1);

  if (!existingAttempt) {
    // First failed attempt - create new record
    await db.insert(loginAttempts).values({
      email: normalizedEmail,
      attemptCount: 1,
      lastAttemptAt: now,
      lastIpAddress: ipAddress,
    });
    log.info(`[SECURITY] failed_login: email=${normalizedEmail} ip=${ipAddress} attempt=1${anomalyReasons.length > 0 ? ` anomaly=[${anomalyReasons.join(',')}]` : ''}`);
    return { locked: false, attemptsRemaining: LOCKOUT_TIERS[0].threshold - 1, requiresAdminUnlock: false };
  }

  // Check if previous attempts are outside the window (reset counter)
  // But DON'T reset if account requires admin unlock (permanent lock)
  let newAttemptCount: number;
  if (existingAttempt.lockedUntil && existingAttempt.lockedUntil.getTime() === 0) {
    // Permanent lock (admin unlock required) - don't reset
    newAttemptCount = existingAttempt.attemptCount + 1;
  } else if (existingAttempt.lastAttemptAt < windowStart) {
    newAttemptCount = 1;
  } else {
    newAttemptCount = existingAttempt.attemptCount + 1;
  }

  // Progressive lockout: find the matching tier
  let lockedUntil: Date | null = null;
  let requiresAdminUnlock = false;
  for (const tier of LOCKOUT_TIERS) {
    if (newAttemptCount >= tier.threshold) {
      if (tier.durationMinutes === -1) {
        // Permanent lock - requires admin unlock
        // Use epoch 0 as sentinel for "admin unlock required"
        lockedUntil = new Date(0);
        requiresAdminUnlock = true;
        log.info(`[SECURITY] account_locked_permanent: email=${normalizedEmail} attempts=${newAttemptCount} - requires admin unlock`);
      } else {
        lockedUntil = new Date(now.getTime() + tier.durationMinutes * 60 * 1000);
        log.info(`[SECURITY] account_locked: email=${normalizedEmail} attempts=${newAttemptCount} duration=${tier.durationMinutes}min`);
      }
    }
  }

  // Update the record
  await db
    .update(loginAttempts)
    .set({
      attemptCount: newAttemptCount,
      lastAttemptAt: now,
      lastIpAddress: ipAddress,
      lockedUntil,
      updatedAt: now,
    })
    .where(eq(loginAttempts.id, existingAttempt.id));

  log.info(`[SECURITY] failed_login: email=${normalizedEmail} ip=${ipAddress} attempt=${newAttemptCount}${anomalyReasons.length > 0 ? ` anomaly=[${anomalyReasons.join(',')}]` : ''}`);

  // Calculate remaining attempts until next lockout tier
  const nextTier = LOCKOUT_TIERS.find(t => t.threshold > newAttemptCount);
  const attemptsRemaining = nextTier ? nextTier.threshold - newAttemptCount : 0;

  return {
    locked: lockedUntil !== null,
    attemptsRemaining,
    requiresAdminUnlock,
  };
}

/**
 * SECURITY: Clear failed login attempts on successful login
 */
async function clearLoginAttempts(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  await db
    .update(loginAttempts)
    .set({
      attemptCount: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(loginAttempts.email, normalizedEmail));
}

// Login endpoint
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // SECURITY: Check if account is locked before attempting authentication
    const lockStatus = await isAccountLocked(email);
    if (lockStatus.locked) {
      log.info(`[SECURITY] Blocked login attempt for locked account: ${email}`);
      if (lockStatus.requiresAdminUnlock) {
        return res.status(429).json({
          message: 'Account has been locked due to excessive failed attempts. Please contact your administrator to unlock.',
          locked: true,
          requiresAdminUnlock: true,
        });
      }
      return res.status(429).json({
        message: `Account is temporarily locked. Please try again in ${lockStatus.remainingMinutes} minute(s).`,
        locked: true,
        remainingMinutes: lockStatus.remainingMinutes,
      });
    }

    // SECURITY: Detect anomalous login behavior
    const anomaly = detectLoginAnomaly(req, email);
    if (anomaly.isAnomalous) {
      log.info(`[SECURITY] anomalous_login: email=${email} ip=${ipAddress} reasons=[${anomaly.reasons.join(',')}]`);
    }

    const user = await storage.authenticateUser(email, password);
    if (!user) {
      // SECURITY: Record failed attempt with anomaly info and check for progressive lockout
      const attemptResult = await recordFailedLoginAttempt(email, ipAddress, anomaly.reasons);

      if (attemptResult.requiresAdminUnlock) {
        return res.status(429).json({
          message: 'Account has been locked due to excessive failed attempts. Please contact your administrator to unlock.',
          locked: true,
          requiresAdminUnlock: true,
        });
      }

      if (attemptResult.locked) {
        return res.status(429).json({
          message: 'Too many failed attempts. Account temporarily locked.',
          locked: true,
        });
      }

      // Generic error message to prevent email enumeration
      return res.status(401).json({
        message: 'Invalid email or password',
        attemptsRemaining: attemptResult.attemptsRemaining,
      });
    }

    // SECURITY: Clear failed attempts on successful login
    await clearLoginAttempts(email);

    // SECURITY FIX: Regenerate session ID to prevent session fixation attacks
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Set session
    req.session.userId = user.id;
    req.session.tenantId = user.tenantId || undefined;

    // Get user with role information
    const userWithRole = await storage.getUserWithRole(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: userWithRole?.role,
        team: userWithRole?.team,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    log.error('Login error:', error);
    res.status(400).json({ message: 'Invalid request' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      log.error('Logout error:', err);
      return res.status(500).json({ message: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// Get current user (supports both /user and /me endpoints)
const getCurrentUserHandler = async (req: any, res: any) => {
  try {
    // SECURITY FIX: Restrict test mode to development/test environments only
    // SECURITY: Requires explicit TEST_AUTH_SECRET - no default fallback
    const isTestMode =
      (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
      process.env.TEST_MODE === 'true';

    const testAuthSecret = process.env.TEST_AUTH_SECRET;
    const demoTenantId = process.env.DEMO_TENANT_ID;

    // SECURITY: Both TEST_AUTH_SECRET and DEMO_TENANT_ID must be explicitly set
    if (isTestMode && testAuthSecret && req.headers['x-test-auth'] === testAuthSecret) {
      if (!demoTenantId) {
        log.error('[SECURITY] Test mode requires DEMO_TENANT_ID to be set');
        return res.status(500).json({ message: 'Test mode configuration error' });
      }

      const testUserId = 'test-user-playwright';
      const defaultTenantId = demoTenantId;

      // Ensure test user exists
      let testUser = await storage.getUser(testUserId);
      if (!testUser) {
        // Create test user if doesn't exist
        let tenant = await storage.getTenant(defaultTenantId);
        if (!tenant) {
          tenant = await storage.createTenant({
            name: 'Default Copier Dealer',
            domain: 'default',
          });
        }

        await storage.upsertUser({
          id: testUserId,
          email: 'test@playwright.dev',
          firstName: 'Playwright',
          lastName: 'Test User',
          profileImageUrl: null,
          tenantId: tenant.id,
          role: 'admin',
        });
        testUser = await storage.getUser(testUserId);
      }

      const userWithRole = await storage.getUserWithRole(testUserId);
      return res.json({
        id: testUser.id,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        role: userWithRole?.role || 'admin',
        team: userWithRole?.team,
        tenantId: testUser.tenantId,
      });
    }

    // Use unified auth helpers to get user ID (supports Supabase JWT and session)
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await storage.getUserWithRole(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
      role_id: user.roleId,
      team: user.team,
      team_id: user.teamId,
      tenantId: user.tenantId,
      tenant_id: user.tenantId,
    });
  } catch (error) {
    log.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
};

// Register /user endpoint (legacy compatibility)
// Note: /api/auth/me is handled by routes-user-profile.ts with proper Supabase JWT middleware
router.get('/user', getCurrentUserHandler);

// ============================================================================
// SIGNUP & EMAIL VERIFICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/signup
 * Create new tenant and admin user account
 * SECURITY: Rate limited to prevent automated mass account creation
 */
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const data = signupSchema.parse(req.body);

    // Check if email already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({
        message: 'An account with this email already exists',
      });
    }

    // Create tenant (company)
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: data.companyName,
        domain: data.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        // Store additional tenant metadata
        metadata: {
          industry: data.industry,
          companySize: data.companySize,
          website: data.website,
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          country: data.country,
          timezone: data.timezone,
        },
      })
      .returning();

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create admin user
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        // Admin role will be assigned via storage layer or default role setup
        metadata: {
          phone: data.phone,
          signupSource: 'self_service',
        },
      })
      .returning();

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

    await db.insert(emailVerifications).values({
      userId: user.id,
      email: user.email,
      token: verificationToken,
      expiresAt,
    });

    // Send verification email
    const emailTemplate = EmailTemplates.emailVerification({
      userName: user.firstName,
      userEmail: user.email,
      verificationToken,
    });

    await emailService.send({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    log.info(`[SIGNUP] New account created: ${user.email} (tenant: ${tenant.id})`);

    res.json({
      message: 'Account created successfully! Please check your email to verify your account.',
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      requiresVerification: true,
    });
  } catch (error) {
    log.error('Signup error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid signup data',
        errors: error.errors,
      });
    }
    res.status(500).json({ message: 'Failed to create account' });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email address with token
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);

    // Find valid verification token
    const [verification] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.token, token),
          gt(emailVerifications.expiresAt, new Date()),
          eq(emailVerifications.verifiedAt, null as any),
        ),
      )
      .limit(1);

    if (!verification) {
      return res.status(400).json({
        message: 'Invalid or expired verification token',
      });
    }

    // Mark as verified
    await db
      .update(emailVerifications)
      .set({ verifiedAt: new Date() })
      .where(eq(emailVerifications.id, verification.id));

    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, verification.userId)).limit(1);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Send welcome email
    const emailTemplate = EmailTemplates.welcome({
      userName: user.firstName,
      userEmail: user.email,
      trialDays: 14, // Default trial period
    });

    await emailService.send({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    // Auto-login the user
    req.session.userId = user.id;
    req.session.tenantId = user.tenantId || undefined;

    log.info(`[EMAIL VERIFICATION] Email verified for user: ${user.id}`);

    res.json({
      message: 'Email verified successfully!',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    log.error('Email verification error:', error);
    res.status(500).json({ message: 'Failed to verify email' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      // Don't reveal if email exists
      return res.json({
        message: 'If an account exists, a verification email has been sent.',
      });
    }

    // Check if already verified
    const [existingVerification] = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.userId, user.id))
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    if (existingVerification?.verifiedAt) {
      return res.status(400).json({
        message: 'Email is already verified',
      });
    }

    // Generate new token
    const verificationToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.insert(emailVerifications).values({
      userId: user.id,
      email: user.email,
      token: verificationToken,
      expiresAt,
    });

    // Send email
    const emailTemplate = EmailTemplates.emailVerification({
      userName: user.firstName || undefined,
      userEmail: user.email,
      verificationToken,
    });

    await emailService.send({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    res.json({
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    log.error('Resend verification error:', error);
    res.status(500).json({ message: 'Failed to resend verification email' });
  }
});

// ============================================================================
// PASSWORD RESET ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Always return success to prevent email enumeration
    const successResponse = {
      message: "If an account with that email exists, we've sent password reset instructions.",
    };

    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // If user doesn't exist, return success anyway (security best practice)
    if (!user) {
      log.info(`[PASSWORD RESET] No user found for email: ${email}`);
      return res.json(successResponse);
    }

    // Generate secure random token
    const token = randomBytes(32).toString('hex');

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Save reset token to database
    await db.insert(passwordResets).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Send password reset email
    const emailTemplate = EmailTemplates.passwordReset({
      userName: user.firstName || undefined,
      userEmail: user.email,
      resetToken: token,
    });

    await emailService.send({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    log.info(`[PASSWORD RESET] Reset email sent to: ${email}`);
    res.json(successResponse);
  } catch (error) {
    log.error('Forgot password error:', error);
    res.status(400).json({ message: 'Invalid request' });
  }
});

/**
 * GET /api/auth/verify-reset-token/:token
 * Verify if reset token is valid
 */
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const [resetRecord] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.token, token),
          gt(passwordResets.expiresAt, new Date()),
          eq(passwordResets.usedAt, null as any),
        ),
      )
      .limit(1);

    if (!resetRecord) {
      return res.status(400).json({
        valid: false,
        message: 'Invalid or expired reset token',
      });
    }

    res.json({
      valid: true,
      message: 'Token is valid',
    });
  } catch (error) {
    log.error('Verify reset token error:', error);
    res.status(500).json({ message: 'Failed to verify token' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    // Find valid reset token
    const [resetRecord] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.token, token),
          gt(passwordResets.expiresAt, new Date()),
          eq(passwordResets.usedAt, null as any),
        ),
      )
      .limit(1);

    if (!resetRecord) {
      return res.status(400).json({
        message: 'Invalid or expired reset token',
      });
    }

    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, resetRecord.userId)).limit(1);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    // Mark token as used
    await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, resetRecord.id));

    // Send confirmation email
    const emailTemplate = EmailTemplates.passwordChanged({
      userName: user.firstName || undefined,
      userEmail: user.email,
    });

    await emailService.send({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    log.info(`[PASSWORD RESET] Password changed for user: ${user.id}`);

    res.json({
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    log.error('Reset password error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid request',
        errors: error.errors,
      });
    }
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

export { router as authRoutes };
