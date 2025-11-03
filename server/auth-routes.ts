import express from "express";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { z } from "zod";

const router = express.Router();

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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

export { router as authRoutes };
