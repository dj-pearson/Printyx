/**
 * TRIAL MANAGEMENT API ROUTES
 */

import express, { Request } from 'express';
import { TrialManagementService } from './services/trial-management-service';

const router = express.Router();

// Helper to get user ID from request (supports Supabase JWT and session)
const getUserId = (req: Request): string | undefined => {
  const reqAny = req as any;
  return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.userId;
};

/**
 * GET /api/trial/status
 * Get current user's trial status
 */
router.get('/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const trialStatus = await TrialManagementService.getTrialStatus(userId);

    if (!trialStatus) {
      return res.status(404).json({ message: 'Trial status not found' });
    }

    res.json(trialStatus);
  } catch (error) {
    console.error('[TRIAL STATUS] Error:', error);
    res.status(500).json({ message: 'Failed to get trial status' });
  }
});

/**
 * POST /api/trial/process-emails
 * Manually trigger trial email processing (admin only)
 * This is normally run by a cron job
 */
router.post('/process-emails', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // TODO: Add admin role check here
    // For now, allow any authenticated user in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const results = await TrialManagementService.processTrialEmails();

    res.json({
      message: 'Trial emails processed successfully',
      results,
    });
  } catch (error) {
    console.error('[TRIAL PROCESSING] Error:', error);
    res.status(500).json({ message: 'Failed to process trial emails' });
  }
});

/**
 * GET /api/trial/users
 * Get all users in trial (admin only)
 */
router.get('/users', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // TODO: Add admin role check here
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const trialUsers = await TrialManagementService.getAllTrialUsers();

    res.json({
      count: trialUsers.length,
      users: trialUsers,
    });
  } catch (error) {
    console.error('[TRIAL USERS] Error:', error);
    res.status(500).json({ message: 'Failed to get trial users' });
  }
});

export { router as trialRoutes };
