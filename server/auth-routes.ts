import express from "express";
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
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    tenantId?: string;
  }
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    // Debug logging for failed logins
    console.log(`Login attempt for email: ${email}`);
    console.log(`Password length: ${password.length}`);
    
    const user = await storage.authenticateUser(email, password);
    if (!user) {
      console.log(`Authentication failed for ${email}`);
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
        tenantId: user.tenantId
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(400).json({ message: "Invalid request" });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.clearCookie('connect.sid');
    res.json({ message: "Logout successful" });
  });
});

// Get current user
router.get('/user', async (req, res) => {
  try {
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
      tenantId: user.tenantId
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
});

export { router as authRoutes };