import { Router } from 'express';
import { UserLifecycleService } from './services/user-lifecycle-service';
import { db } from './db';
import {
  userProvisioningTemplates,
  userLifecycleEvents,
  onboardingChecklists,
  offboardingWorkflows,
  accessReviews,
  bulkUserOperations,
  userImpersonationSessions,
} from '@shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { requireRootAdmin } from './routes-root-admin';
import * as fs from 'fs';
import * as path from 'path';
// Auth helpers for Supabase JWT + session fallback
import { getUserId, getTenantId } from './utils/auth-helpers';

/**
 * USER LIFECYCLE MANAGEMENT ROUTES
 *
 * Admin endpoints for user provisioning, onboarding, offboarding, and access reviews.
 * Provides automation for the entire user lifecycle.
 * SECURITY: All routes in this file require root admin authorization (Level 7+).
 *
 * CRITICAL SECURITY NOTE: User impersonation is an extremely sensitive operation
 * that requires the highest level of security and audit logging.
 */

const router = Router();

// ============================================================================
// SECURITY MIDDLEWARE - PROTECT ALL ROUTES
// ============================================================================
// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!req.user) {
    req.user = {
      id: userId,
      tenantId: getTenantId(req),
    };
  } else if (!req.user.tenant_id || !req.user.id) {
    req.user = {
      ...req.user,
      id: req.user.id || userId,
      tenantId: req.user.tenant_id || getTenantId(req),
    };
  }

  next();
};

// Audit logging middleware for sensitive operations
const auditLog = (action: string) => {
  return (req: any, res: any, next: any) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId: getUserId(req),
      userEmail: req.user?.email,
      targetUserId: req.params.user_id || req.body.user_id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      requestBody: action.includes('IMPERSONATION')
        ? { ...req.body, password: '[REDACTED]' }
        : req.body,
    };

    // Log to file for audit trail
    const logPath = path.join(__dirname, 'audit.log');
    fs.appendFile(logPath, JSON.stringify(logEntry) + '\n', (err) => {
      if (err) console.error('Failed to write audit log:', err);
    });

    // Log to console
    console.warn(`[AUDIT] ${action}:`, logEntry);

    next();
  };
};

// Apply authentication and root admin authorization to ALL routes
router.use(requireAuth);
router.use(requireRootAdmin);

// ============================================================================
// PROVISIONING TEMPLATES
// ============================================================================

/**
 * GET /api/users/templates
 * Get all provisioning templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { tenantId, category } = req.query;

    const templates = await UserLifecycleService.getTemplates(tenantId as string | undefined);

    // Filter by category if specified
    const filtered = category ? templates.filter((t) => t.category === category) : templates;

    res.json({ templates: filtered });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    res.status(500).json({ error: 'Failed to fetch provisioning templates' });
  }
});

/**
 * GET /api/users/templates/:id
 * Get a specific template
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const template = await UserLifecycleService.getTemplate(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Failed to fetch template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * POST /api/users/templates
 * Create a new provisioning template
 */
router.post('/templates', async (req, res) => {
  try {
    const template = await UserLifecycleService.createTemplate(req.body);

    res.status(201).json({ template });
  } catch (error) {
    console.error('Failed to create template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ============================================================================
// USER PROVISIONING
// ============================================================================

/**
 * POST /api/users/provision
 * Provision a single user with optional template
 */
router.post('/provision', async (req, res) => {
  try {
    const { templateId, tenantId, userData, triggeredBy, sendWelcomeEmail } = req.body;

    // Validate required fields
    if (!tenantId || !userData || !triggeredBy) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, userData, triggeredBy',
      });
    }

    if (!userData.name || !userData.email) {
      return res.status(400).json({
        error: 'User data must include name and email',
      });
    }

    const result = await UserLifecycleService.provisionUser({
      templateId,
      tenantId,
      userData,
      triggeredBy,
      sendWelcomeEmail,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to provision user:', error);
    res.status(500).json({
      error: 'Failed to provision user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/users/provision/bulk
 * Bulk provision users from CSV data
 */
router.post('/provision/bulk', async (req, res) => {
  try {
    const { tenantId, templateId, users, triggeredBy } = req.body;

    // Validate required fields
    if (!tenantId || !users || !Array.isArray(users) || !triggeredBy) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, users (array), triggeredBy',
      });
    }

    if (users.length === 0) {
      return res.status(400).json({ error: 'Users array cannot be empty' });
    }

    const result = await UserLifecycleService.bulkProvisionUsers({
      tenantId,
      templateId,
      users,
      triggeredBy,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to bulk provision users:', error);
    res.status(500).json({
      error: 'Failed to bulk provision users',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/users/bulk-operations/:id
 * Get bulk operation status
 */
router.get('/bulk-operations/:id', async (req, res) => {
  try {
    const operation = await db.query.bulkUserOperations.findFirst({
      where: eq(bulkUserOperations.id, req.params.id),
    });

    if (!operation) {
      return res.status(404).json({ error: 'Bulk operation not found' });
    }

    res.json({ operation });
  } catch (error) {
    console.error('Failed to fetch bulk operation:', error);
    res.status(500).json({ error: 'Failed to fetch bulk operation status' });
  }
});

// ============================================================================
// ONBOARDING
// ============================================================================

/**
 * GET /api/users/:userId/onboarding
 * Get user's onboarding checklist
 */
router.get('/:userId/onboarding', async (req, res) => {
  try {
    const checklist = await db.query.onboardingChecklists.findFirst({
      where: eq(onboardingChecklists.user_id, req.params.user_id),
      orderBy: desc(onboardingChecklists.created_at),
    });

    if (!checklist) {
      return res.status(404).json({ error: 'Onboarding checklist not found' });
    }

    res.json({ checklist });
  } catch (error) {
    console.error('Failed to fetch onboarding checklist:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding checklist' });
  }
});

/**
 * PUT /api/users/:userId/onboarding/:checklistId/items/:itemId
 * Update a checklist item status
 */
router.put('/:userId/onboarding/:checklistId/items/:itemId', async (req, res) => {
  try {
    const { status, notes, completedBy } = req.body;

    const checklist = await db.query.onboardingChecklists.findFirst({
      where: eq(onboardingChecklists.id, req.params.checklistId),
    });

    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    // Update item in the items array
    const items = (checklist.items as any[]) || [];
    const itemIndex = items.findIndex((item) => item.id === req.params.itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    items[itemIndex] = {
      ...items[itemIndex],
      status,
      notes,
      completedBy,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    };

    // Calculate new progress
    const completedItems = items.filter((item) => item.status === 'completed').length;
    const progressPercent = Math.round((completedItems / items.length) * 100);

    // Update checklist
    const [updated] = await db
      .update(onboardingChecklists)
      .set({
        items,
        completedItems,
        progressPercent,
        completedAt: progressPercent === 100 ? new Date() : null,
      })
      .where(eq(onboardingChecklists.id, req.params.checklistId))
      .returning();

    res.json({ checklist: updated });
  } catch (error) {
    console.error('Failed to update checklist item:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// ============================================================================
// OFFBOARDING
// ============================================================================

/**
 * POST /api/users/:userId/offboard
 * Initiate user offboarding workflow
 */
router.post('/:userId/offboard', async (req, res) => {
  try {
    const { tenantId, reason, lastWorkingDay, transferOwnershipTo, initiatedBy } = req.body;

    // Validate required fields
    if (!tenantId || !reason || !lastWorkingDay || !initiatedBy) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, reason, lastWorkingDay, initiatedBy',
      });
    }

    const result = await UserLifecycleService.offboardUser({
      userId: req.params.user_id,
      tenantId,
      reason,
      lastWorkingDay: new Date(lastWorkingDay),
      transferOwnershipTo,
      initiatedBy,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to initiate offboarding:', error);
    res.status(500).json({
      error: 'Failed to initiate offboarding',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/users/:userId/offboarding
 * Get offboarding workflow status
 */
router.get('/:userId/offboarding', async (req, res) => {
  try {
    const workflow = await db.query.offboardingWorkflows.findFirst({
      where: eq(offboardingWorkflows.user_id, req.params.user_id),
      orderBy: desc(offboardingWorkflows.created_at),
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Offboarding workflow not found' });
    }

    res.json({ workflow });
  } catch (error) {
    console.error('Failed to fetch offboarding workflow:', error);
    res.status(500).json({ error: 'Failed to fetch offboarding workflow' });
  }
});

// ============================================================================
// ACCESS REVIEWS
// ============================================================================

/**
 * POST /api/users/access-review
 * Create a quarterly access review
 */
router.post('/access-review', async (req, res) => {
  try {
    const { tenantId, managerId, reviewPeriod, reviewYear, reviewQuarter, organizationalUnitId } =
      req.body;

    // Validate required fields
    if (!tenantId || !managerId || !reviewPeriod || !reviewYear || !reviewQuarter) {
      return res.status(400).json({
        error:
          'Missing required fields: tenantId, managerId, reviewPeriod, reviewYear, reviewQuarter',
      });
    }

    const review = await UserLifecycleService.createAccessReview({
      tenantId,
      managerId,
      reviewPeriod,
      reviewYear,
      reviewQuarter,
      organizationalUnitId,
    });

    res.status(201).json({
      success: true,
      review,
    });
  } catch (error) {
    console.error('Failed to create access review:', error);
    res.status(500).json({
      error: 'Failed to create access review',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/users/access-review
 * Get pending access reviews for a manager
 */
router.get('/access-review', async (req, res) => {
  try {
    const { managerId, tenantId } = req.query;

    if (!managerId || !tenantId) {
      return res.status(400).json({
        error: 'Missing required query parameters: managerId, tenantId',
      });
    }

    const reviews = await UserLifecycleService.getPendingAccessReviews(
      managerId as string,
      tenantId as string,
    );

    res.json({ reviews });
  } catch (error) {
    console.error('Failed to fetch access reviews:', error);
    res.status(500).json({ error: 'Failed to fetch access reviews' });
  }
});

/**
 * GET /api/users/access-review/:id
 * Get access review details
 */
router.get('/access-review/:id', async (req, res) => {
  try {
    const review = await db.query.accessReviews.findFirst({
      where: eq(accessReviews.id, req.params.id),
    });

    if (!review) {
      return res.status(404).json({ error: 'Access review not found' });
    }

    // Get certifications for this review
    const certifications = await db.query.accessReviewCertifications.findMany({
      where: eq(accessReviewCertifications.accessReviewId, req.params.id),
    });

    res.json({
      review,
      certifications,
    });
  } catch (error) {
    console.error('Failed to fetch access review:', error);
    res.status(500).json({ error: 'Failed to fetch access review details' });
  }
});

// ============================================================================
// USER IMPERSONATION
// ============================================================================

/**
 * POST /api/users/:userId/impersonate
 * Start user impersonation session for support
 * CRITICAL: Extra audit logging applied - all impersonation attempts logged
 */
router.post('/:userId/impersonate', auditLog('USER_IMPERSONATION_START'), async (req, res) => {
  try {
    const { adminId, tenantId, reason, ticketNumber } = req.body;

    // Validate required fields
    if (!adminId || !tenantId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: adminId, tenantId, reason',
      });
    }

    const ipAddress = req.ip || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await UserLifecycleService.startImpersonation({
      adminId,
      impersonatedUserId: req.params.user_id,
      tenantId,
      reason,
      ticketNumber,
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to start impersonation:', error);
    res.status(500).json({
      error: 'Failed to start impersonation session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/users/impersonate/:sessionId/end
 * End impersonation session
 * CRITICAL: Extra audit logging applied
 */
router.post('/impersonate/:sessionId/end', auditLog('USER_IMPERSONATION_END'), async (req, res) => {
  try {
    await UserLifecycleService.endImpersonation(req.params.sessionId);

    res.json({
      success: true,
      message: 'Impersonation session ended',
    });
  } catch (error) {
    console.error('Failed to end impersonation:', error);
    res.status(500).json({
      error: 'Failed to end impersonation session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/users/impersonate/active
 * Get active impersonation sessions
 */
router.get('/impersonate/active', async (req, res) => {
  try {
    const { tenantId } = req.query;

    const sessions = await db.query.userImpersonationSessions.findMany({
      where: and(
        eq(userImpersonationSessions.isActive, true),
        tenantId ? eq(userImpersonationSessions.tenant_id, tenantId as string) : undefined,
      ),
      orderBy: desc(userImpersonationSessions.startedAt),
    });

    res.json({ sessions });
  } catch (error) {
    console.error('Failed to fetch impersonation sessions:', error);
    res.status(500).json({ error: 'Failed to fetch impersonation sessions' });
  }
});

// ============================================================================
// LIFECYCLE EVENTS
// ============================================================================

/**
 * GET /api/users/:userId/lifecycle-events
 * Get user lifecycle event history
 */
router.get('/:userId/lifecycle-events', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const events = await db.query.userLifecycleEvents.findMany({
      where: eq(userLifecycleEvents.user_id, req.params.user_id),
      orderBy: desc(userLifecycleEvents.created_at),
      limit: Number(limit),
    });

    res.json({ events });
  } catch (error) {
    console.error('Failed to fetch lifecycle events:', error);
    res.status(500).json({ error: 'Failed to fetch lifecycle events' });
  }
});

export default router;
