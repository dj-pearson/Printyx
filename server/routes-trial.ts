/**
 * TRIAL MANAGEMENT API ROUTES
 */

import express, { Request } from 'express';
import { TrialManagementService } from './services/trial-management-service';
import { AuthenticationError, AuthorizationError, NotFoundError } from './lib/api-errors';

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
router.get('/status', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      throw new AuthenticationError();
    }

    const trialStatus = await TrialManagementService.getTrialStatus(userId);

    if (!trialStatus) {
      throw new NotFoundError('Trial status');
    }

    res.json(trialStatus);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/trial/process-emails
 * Manually trigger trial email processing (admin only)
 * This is normally run by a cron job
 */
router.post('/process-emails', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      throw new AuthenticationError();
    }

    // TODO: Add admin role check here
    // For now, allow any authenticated user in development
    if (process.env.NODE_ENV === 'production') {
      throw new AuthorizationError('Admin access required');
    }

    const results = await TrialManagementService.processTrialEmails();

    res.json({
      message: 'Trial emails processed successfully',
      results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/trial/users
 * Get all users in trial (admin only)
 */
router.get('/users', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      throw new AuthenticationError();
    }

    // TODO: Add admin role check here
    if (process.env.NODE_ENV === 'production') {
      throw new AuthorizationError('Admin access required');
    }

    const trialUsers = await TrialManagementService.getAllTrialUsers();

    res.json({
      count: trialUsers.length,
      users: trialUsers,
    });
  } catch (error) {
    next(error);
  }
});

export { router as trialRoutes };
