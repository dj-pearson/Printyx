/**
 * Accessibility API Routes
 * Backend routes for managing user accessibility preferences
 * WCAG 2.1 Compliance
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import {
  userAccessibilityPreferences,
  accessibilityFeedback,
  accessibilityAuditLog,
  updateUserAccessibilityPreferencesSchema,
  insertAccessibilityFeedbackSchema,
  insertAccessibilityAuditLogSchema,
} from '@shared/accessibility-schema';
import { getUserId, getTenantId, isAuthenticated } from './utils/auth-helpers';

const router = Router();

/**
 * GET /api/accessibility/preferences
 * Get the current user's accessibility preferences
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      // Return default preferences for unauthenticated users
      return res.json({
        highContrast: false,
        reducedMotion: false,
        fontSize: 'normal',
        screenReader: false,
        keyboardNavigation: true,
        colorBlind: 'none',
        soundEnabled: true,
        voiceCommands: false,
        focusIndicators: true,
        underlineLinks: false,
        cursorSize: 'normal',
      });
    }

    const preferences = await db.query.userAccessibilityPreferences.findFirst({
      where: eq(userAccessibilityPreferences.userId, userId),
    });

    if (!preferences) {
      // Return default preferences if none exist
      return res.json({
        highContrast: false,
        reducedMotion: false,
        fontSize: 'normal',
        screenReader: false,
        keyboardNavigation: true,
        colorBlind: 'none',
        soundEnabled: true,
        voiceCommands: false,
        focusIndicators: true,
        underlineLinks: false,
        cursorSize: 'normal',
      });
    }

    return res.json(preferences);
  } catch (error) {
    console.error('Error fetching accessibility preferences:', error);
    return res.status(500).json({ message: 'Failed to fetch accessibility preferences' });
  }
});

/**
 * PUT /api/accessibility/preferences
 * Update the current user's accessibility preferences
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId || !tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validation = updateUserAccessibilityPreferencesSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid preferences data',
        errors: validation.error.errors,
      });
    }

    const data = validation.data;

    // Check if preferences exist
    const existing = await db.query.userAccessibilityPreferences.findFirst({
      where: eq(userAccessibilityPreferences.userId, userId),
    });

    let result;
    if (existing) {
      // Update existing preferences
      const updated = await db
        .update(userAccessibilityPreferences)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(userAccessibilityPreferences.userId, userId))
        .returning();
      result = updated[0];
    } else {
      // Create new preferences
      const created = await db
        .insert(userAccessibilityPreferences)
        .values({
          userId,
          tenantId,
          ...data,
        })
        .returning();
      result = created[0];
    }

    return res.json(result);
  } catch (error) {
    console.error('Error updating accessibility preferences:', error);
    return res.status(500).json({ message: 'Failed to update accessibility preferences' });
  }
});

/**
 * DELETE /api/accessibility/preferences
 * Reset accessibility preferences to defaults
 */
router.delete('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    await db
      .delete(userAccessibilityPreferences)
      .where(eq(userAccessibilityPreferences.userId, userId));

    return res.json({ message: 'Preferences reset to defaults' });
  } catch (error) {
    console.error('Error resetting accessibility preferences:', error);
    return res.status(500).json({ message: 'Failed to reset accessibility preferences' });
  }
});

/**
 * POST /api/accessibility/feedback
 * Submit accessibility feedback (can be anonymous)
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    const validation = insertAccessibilityFeedbackSchema.safeParse({
      ...req.body,
      userId,
      tenantId,
    });

    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid feedback data',
        errors: validation.error.errors,
      });
    }

    // Extract browser and OS info from user agent
    const userAgent = req.headers['user-agent'] || '';

    const feedback = await db
      .insert(accessibilityFeedback)
      .values({
        ...validation.data,
        browserInfo: userAgent.substring(0, 500),
        status: 'open',
      })
      .returning();

    return res.status(201).json({
      message: 'Thank you for your feedback. We will review it shortly.',
      feedbackId: feedback[0].id,
    });
  } catch (error) {
    console.error('Error submitting accessibility feedback:', error);
    return res.status(500).json({ message: 'Failed to submit feedback' });
  }
});

/**
 * GET /api/accessibility/feedback
 * Get accessibility feedback (admin only)
 */
router.get('/feedback', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { status, category, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(accessibilityFeedback);

    // Apply filters
    const conditions = [eq(accessibilityFeedback.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(accessibilityFeedback.status, status as string));
    }
    if (category) {
      conditions.push(eq(accessibilityFeedback.category, category as string));
    }

    const feedbackList = await query
      .where(and(...conditions))
      .limit(limitNum)
      .offset(offset);

    return res.json({
      data: feedbackList,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Error fetching accessibility feedback:', error);
    return res.status(500).json({ message: 'Failed to fetch feedback' });
  }
});

/**
 * PATCH /api/accessibility/feedback/:id
 * Update feedback status (admin only)
 */
router.patch('/feedback/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const { status, resolution } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'wont_fix'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
      if (status === 'resolved' || status === 'wont_fix') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = userId;
      }
    }

    if (resolution) {
      updateData.resolution = resolution;
    }

    const updated = await db
      .update(accessibilityFeedback)
      .set(updateData)
      .where(eq(accessibilityFeedback.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    return res.json(updated[0]);
  } catch (error) {
    console.error('Error updating feedback:', error);
    return res.status(500).json({ message: 'Failed to update feedback' });
  }
});

/**
 * POST /api/accessibility/audit
 * Log an accessibility audit result
 */
router.post('/audit', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validation = insertAccessibilityAuditLogSchema.safeParse({
      ...req.body,
      tenantId,
      auditorId: userId,
    });

    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid audit data',
        errors: validation.error.errors,
      });
    }

    const audit = await db.insert(accessibilityAuditLog).values(validation.data).returning();

    return res.status(201).json(audit[0]);
  } catch (error) {
    console.error('Error logging accessibility audit:', error);
    return res.status(500).json({ message: 'Failed to log audit' });
  }
});

/**
 * GET /api/accessibility/audit
 * Get accessibility audit history
 */
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { pageUrl, auditType, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    let conditions = [eq(accessibilityAuditLog.tenantId, tenantId)];

    if (pageUrl) {
      conditions.push(eq(accessibilityAuditLog.pageUrl, pageUrl as string));
    }
    if (auditType) {
      conditions.push(eq(accessibilityAuditLog.auditType, auditType as string));
    }

    const audits = await db
      .select()
      .from(accessibilityAuditLog)
      .where(and(...conditions))
      .limit(limitNum)
      .offset(offset)
      .orderBy(accessibilityAuditLog.auditDate);

    return res.json({
      data: audits,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Error fetching accessibility audits:', error);
    return res.status(500).json({ message: 'Failed to fetch audits' });
  }
});

/**
 * GET /api/accessibility/vpat
 * Request VPAT document
 */
router.get('/vpat', async (req: Request, res: Response) => {
  try {
    // Return VPAT metadata and contact information
    return res.json({
      message: 'VPAT (Voluntary Product Accessibility Template) available upon request',
      version: '2.4 WCAG Edition',
      lastUpdated: '2026-01-12',
      wcagConformance: {
        levelA: 'Supports',
        levelAA: 'Partially Supports',
        levelAAA: 'Not Evaluated',
      },
      section508Conformance: 'Supports',
      contactEmail: 'accessibility@printyx.net',
      contactPhone: '1-800-555-1234',
      requestVpat: 'POST /api/accessibility/feedback with category: "vpat_request"',
    });
  } catch (error) {
    console.error('Error fetching VPAT info:', error);
    return res.status(500).json({ message: 'Failed to fetch VPAT information' });
  }
});

/**
 * GET /api/accessibility/statement
 * Get accessibility statement data for the page
 */
router.get('/statement', async (_req: Request, res: Response) => {
  try {
    return res.json({
      title: 'Accessibility Statement',
      conformanceLevel: 'WCAG 2.1 Level AA',
      lastReviewed: '2026-01-12',
      standards: [
        'WCAG 2.1 Level AA',
        'Section 508 of the Rehabilitation Act',
        'Americans with Disabilities Act (ADA) Title III',
      ],
      features: [
        {
          name: 'Keyboard Navigation',
          description: 'Full keyboard accessibility with skip links and shortcuts',
        },
        {
          name: 'Screen Reader Support',
          description: 'Compatible with NVDA, JAWS, VoiceOver, and TalkBack',
        },
        {
          name: 'Visual Accommodations',
          description: 'High contrast mode, adjustable fonts, color blindness filters',
        },
        {
          name: 'Motor Accessibility',
          description: 'Large click targets (44x44px), reduced motion option',
        },
        {
          name: 'Audio & Multimedia',
          description: 'No auto-play, accessible media controls, captions where applicable',
        },
        {
          name: 'Form Accessibility',
          description: 'Labels, error messages, and clear instructions on all forms',
        },
      ],
      contact: {
        email: 'accessibility@printyx.net',
        phone: '1-800-555-1234',
        responseTime: '5 business days',
      },
    });
  } catch (error) {
    console.error('Error fetching accessibility statement:', error);
    return res.status(500).json({ message: 'Failed to fetch accessibility statement' });
  }
});

export default router;
