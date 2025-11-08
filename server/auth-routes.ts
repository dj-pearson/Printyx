import express from "express";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db } from "./db";
import { passwordResets } from "../shared/password-reset-schema";
import { users } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { EmailTemplates } from "./services/email-templates";
import { emailService } from "./services/email-service";

const router = express.Router();

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Password reset schemas
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Session management
declare module "express-session" {
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
  message: { message: "Too many login attempts. Please try again later." },
});

// Rate limiting for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset attempts. Please try again later." },
});

// Login endpoint
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await storage.authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Set session
    req.session.userId = user.id;
    req.session.tenantId = user.tenantId || undefined;

    // Get user with role information
    const userWithRole = await storage.getUserWithRole(user.id);

    res.json({
      message: "Login successful",
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
    console.error("Login error:", error);
    res.status(400).json({ message: "Invalid request" });
  }
});

// Logout endpoint
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logout successful" });
  });
});

// Get current user
router.get("/user", async (req, res) => {
  try {
    // TEST MODE: Support Playwright testing with test header
    const isTestMode = process.env.TEST_MODE === 'true' || !!process.env.TESTING_STRIPE_SECRET_KEY;
    if (isTestMode && req.headers['x-test-auth'] === 'playwright') {
      const testUserId = 'test-user-playwright';
      const defaultTenantId = process.env.DEMO_TENANT_ID || "550e8400-e29b-41d4-a716-446655440000";
      
      // Ensure test user exists
      let testUser = await storage.getUser(testUserId);
      if (!testUser) {
        // Create test user if doesn't exist
        let tenant = await storage.getTenant(defaultTenantId);
        if (!tenant) {
          tenant = await storage.createTenant({
            name: "Default Copier Dealer",
            domain: "default",
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
    
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUserWithRole(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      team: user.team,
      tenantId: user.tenantId,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
});

// ============================================================================
// PASSWORD RESET ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Always return success to prevent email enumeration
    const successResponse = {
      message: "If an account with that email exists, we've sent password reset instructions.",
    };

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // If user doesn't exist, return success anyway (security best practice)
    if (!user) {
      console.log(`[PASSWORD RESET] No user found for email: ${email}`);
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

    console.log(`[PASSWORD RESET] Reset email sent to: ${email}`);
    res.json(successResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(400).json({ message: "Invalid request" });
  }
});

/**
 * GET /api/auth/verify-reset-token/:token
 * Verify if reset token is valid
 */
router.get("/verify-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [resetRecord] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.token, token),
          gt(passwordResets.expiresAt, new Date()),
          eq(passwordResets.usedAt, null as any)
        )
      )
      .limit(1);

    if (!resetRecord) {
      return res.status(400).json({
        valid: false,
        message: "Invalid or expired reset token",
      });
    }

    res.json({
      valid: true,
      message: "Token is valid",
    });
  } catch (error) {
    console.error("Verify reset token error:", error);
    res.status(500).json({ message: "Failed to verify token" });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post("/reset-password", async (req, res) => {
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
          eq(passwordResets.usedAt, null as any)
        )
      )
      .limit(1);

    if (!resetRecord) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, resetRecord.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));

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

    console.log(`[PASSWORD RESET] Password changed for user: ${user.id}`);

    res.json({
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid request",
        errors: error.errors,
      });
    }
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export { router as authRoutes };
