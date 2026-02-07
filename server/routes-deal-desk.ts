/**
 * Deal Desk API Routes
 * Approval workflows, discount management, and pricing governance
 */
import type { Express } from 'express';
import { eq, and, desc, or, lte, gte, sql, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-deal-desk');

import {
  approvalRules,
  approvalRequests,
  approvalComments,
  discountAnalytics,
  approvalDelegations,
  users,
  deals,
  quotes,
  insertApprovalRuleSchema,
  insertApprovalRequestSchema,
  insertApprovalCommentSchema,
  insertApprovalDelegationSchema,
  type ApprovalRequest,
} from '@shared/schema';
import { ApprovalWorkflowService } from './services/approval-workflow-service';
import { cacheControl, etag } from './middleware/cache-middleware';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  requireLevel,
  PERMISSIONS,
  ROLE_LEVELS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

export function registerDealDeskRoutes(app: Express) {
  // Apply authentication and RBAC context to all deal desk routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/deal-desk', isAuthenticated, enhanceUserContext);
  // ==================== Approval Rules Management ====================

  // Get all approval rules for tenant - requires deal view permission
  app.get(
    '/api/deal-desk/rules',
    isAuthenticated,
    requirePermission([PERMISSIONS.SALES.DEAL.VIEW]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;

        const rules = await db
          .select()
          .from(approvalRules)
          .where(eq(approvalRules.tenantId, tenantId))
          .orderBy(desc(approvalRules.priority), desc(approvalRules.order));

        res.json(rules);
      } catch (error) {
        log.error('Error fetching approval rules:', error);
        res.status(500).json({ error: 'Failed to fetch approval rules' });
      }
    },
  );

  // Create approval rule - requires manager level
  app.post(
    '/api/deal-desk/rules',
    isAuthenticated,
    requireLevel(ROLE_LEVELS.MANAGER),
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user?.id || req.user?.claims?.sub;

        const ruleData = insertApprovalRuleSchema.parse({
          ...req.body,
          tenantId,
          createdBy: userId,
        });

        const [newRule] = await db.insert(approvalRules).values(ruleData).returning();

        res.status(201).json(newRule);
      } catch (error) {
        log.error('Error creating approval rule:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to create approval rule' });
      }
    },
  );

  // Update approval rule
  app.put('/api/deal-desk/rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const [updatedRule] = await db
        .update(approvalRules)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(and(eq(approvalRules.id, id), eq(approvalRules.tenantId, tenantId)))
        .returning();

      if (!updatedRule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json(updatedRule);
    } catch (error) {
      log.error('Error updating approval rule:', error);
      res.status(500).json({ error: 'Failed to update approval rule' });
    }
  });

  // Delete approval rule
  app.delete('/api/deal-desk/rules/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const [deletedRule] = await db
        .delete(approvalRules)
        .where(and(eq(approvalRules.id, id), eq(approvalRules.tenantId, tenantId)))
        .returning();

      if (!deletedRule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json({ message: 'Rule deleted successfully' });
    } catch (error) {
      log.error('Error deleting approval rule:', error);
      res.status(500).json({ error: 'Failed to delete approval rule' });
    }
  });

  // ==================== Approval Requests ====================

  // Check if approval is required
  app.post('/api/deal-desk/check-approval', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const context = req.body;

      const result = await ApprovalWorkflowService.checkApprovalRequired(tenantId, context);

      res.json(result);
    } catch (error) {
      log.error('Error checking approval:', error);
      res.status(500).json({ error: 'Failed to check approval requirement' });
    }
  });

  // Create approval request
  app.post('/api/deal-desk/requests', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;
      const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

      // Check if approval is required
      const { required, matchedRules } = await ApprovalWorkflowService.checkApprovalRequired(
        tenantId,
        req.body,
      );

      if (!required) {
        return res.status(400).json({ error: 'No approval required for this request' });
      }

      const requestData = insertApprovalRequestSchema.parse({
        ...req.body,
        tenantId,
        requestedBy: userId,
        requestedByName: userName,
        requestedByRole: req.user.role?.name || 'User',
      });

      const approvalRequest = await ApprovalWorkflowService.createApprovalRequest(
        requestData,
        matchedRules,
      );

      res.status(201).json(approvalRequest);
    } catch (error) {
      log.error('Error creating approval request:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create approval request' });
    }
  });

  // Get all approval requests (with filters)
  app.get('/api/deal-desk/requests', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { status, requestedBy, dealId, quoteId } = req.query;

      let conditions = [eq(approvalRequests.tenantId, tenantId)];

      if (status) {
        conditions.push(eq(approvalRequests.status, status));
      }
      if (requestedBy) {
        conditions.push(eq(approvalRequests.requestedBy, requestedBy));
      }
      if (dealId) {
        conditions.push(eq(approvalRequests.dealId, dealId));
      }
      if (quoteId) {
        conditions.push(eq(approvalRequests.quoteId, quoteId));
      }

      const requests = await db
        .select()
        .from(approvalRequests)
        .where(and(...conditions))
        .orderBy(desc(approvalRequests.submittedAt));

      res.json(requests);
    } catch (error) {
      log.error('Error fetching approval requests:', error);
      res.status(500).json({ error: 'Failed to fetch approval requests' });
    }
  });

  // Get my pending approvals
  app.get('/api/deal-desk/my-approvals', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;

      const pendingApprovals = await ApprovalWorkflowService.getPendingApprovalsForUser(
        tenantId,
        userId,
      );

      res.json(pendingApprovals);
    } catch (error) {
      log.error('Error fetching pending approvals:', error);
      res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }
  });

  // Get approval request by ID
  app.get('/api/deal-desk/requests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const [request] = await db
        .select()
        .from(approvalRequests)
        .where(and(eq(approvalRequests.id, id), eq(approvalRequests.tenantId, tenantId)));

      if (!request) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      // Get related data
      let dealData = null;
      let quoteData = null;

      if (request.dealId) {
        const [deal] = await db.select().from(deals).where(eq(deals.id, request.dealId));
        dealData = deal;
      }

      if (request.quoteId) {
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, request.quoteId));
        quoteData = quote;
      }

      // Get comments
      const comments = await db
        .select()
        .from(approvalComments)
        .where(eq(approvalComments.approvalRequestId, id))
        .orderBy(approvalComments.createdAt);

      res.json({
        ...request,
        deal: dealData,
        quote: quoteData,
        comments,
      });
    } catch (error) {
      log.error('Error fetching approval request:', error);
      res.status(500).json({ error: 'Failed to fetch approval request' });
    }
  });

  // Process approval decision
  app.post('/api/deal-desk/requests/:id/decision', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      const { id } = req.params;
      const { decision, comments } = req.body;

      if (!['approve', 'reject', 'request_changes'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid decision' });
      }

      const updatedRequest = await ApprovalWorkflowService.processDecision(
        id,
        userId,
        decision,
        comments,
      );

      res.json(updatedRequest);
    } catch (error) {
      log.error('Error processing approval decision:', error);
      res.status(500).json({ error: 'Failed to process approval decision' });
    }
  });

  // Add comment to approval request
  app.post('/api/deal-desk/requests/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;
      const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
      const { id } = req.params;
      const { commentText, isInternal } = req.body;

      const [comment] = await db
        .insert(approvalComments)
        .values({
          tenantId,
          approvalRequestId: id,
          commentText,
          authorId: userId,
          authorName: userName,
          authorRole: req.user.role?.name || 'User',
          isInternal: isInternal || false,
        })
        .returning();

      res.status(201).json(comment);
    } catch (error) {
      log.error('Error adding comment:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  });

  // ==================== Analytics & Dashboard ====================

  // Get deal desk dashboard stats
  app.get(
    '/api/deal-desk/dashboard',
    isAuthenticated,
    cacheControl(300),
    etag(),
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user?.id || req.user?.claims?.sub;

        // My pending approvals count
        const myPendingApprovals = await ApprovalWorkflowService.getPendingApprovalsForUser(
          tenantId,
          userId,
        );

        // Total pending requests
        const [totalPendingResult] = await db
          .select({ count: count() })
          .from(approvalRequests)
          .where(
            and(
              eq(approvalRequests.tenantId, tenantId),
              or(eq(approvalRequests.status, 'pending'), eq(approvalRequests.status, 'in_review')),
            ),
          );

        // SLA breached count
        const [slaBreachedResult] = await db
          .select({ count: count() })
          .from(approvalRequests)
          .where(
            and(
              eq(approvalRequests.tenantId, tenantId),
              eq(approvalRequests.slaBreached, true),
              or(eq(approvalRequests.status, 'pending'), eq(approvalRequests.status, 'in_review')),
            ),
          );

        // Approval rate (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [approvedCount] = await db
          .select({ count: count() })
          .from(approvalRequests)
          .where(
            and(
              eq(approvalRequests.tenantId, tenantId),
              eq(approvalRequests.status, 'approved'),
              gte(approvalRequests.submittedAt, thirtyDaysAgo),
            ),
          );

        const [rejectedCount] = await db
          .select({ count: count() })
          .from(approvalRequests)
          .where(
            and(
              eq(approvalRequests.tenantId, tenantId),
              eq(approvalRequests.status, 'rejected'),
              gte(approvalRequests.submittedAt, thirtyDaysAgo),
            ),
          );

        const totalDecisions = (approvedCount.count || 0) + (rejectedCount.count || 0);
        const approvalRate =
          totalDecisions > 0 ? ((approvedCount.count || 0) / totalDecisions) * 100 : 0;

        // Average approval time
        const recentCompleted = await db
          .select({
            submittedAt: approvalRequests.submittedAt,
            completedAt: approvalRequests.completedAt,
          })
          .from(approvalRequests)
          .where(
            and(
              eq(approvalRequests.tenantId, tenantId),
              or(eq(approvalRequests.status, 'approved'), eq(approvalRequests.status, 'rejected')),
              gte(approvalRequests.submittedAt, thirtyDaysAgo),
            ),
          );

        let avgApprovalTimeHours = 0;
        if (recentCompleted.length > 0) {
          const totalHours = recentCompleted.reduce((sum, req) => {
            if (!req.completedAt || !req.submittedAt) return sum;
            const hours =
              (req.completedAt.getTime() - req.submittedAt.getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0);
          avgApprovalTimeHours = totalHours / recentCompleted.length;
        }

        res.json({
          myPendingApprovals: myPendingApprovals.length,
          totalPending: totalPendingResult.count || 0,
          slaBreached: slaBreachedResult.count || 0,
          approvalRate: Math.round(approvalRate * 100) / 100,
          avgApprovalTimeHours: Math.round(avgApprovalTimeHours * 10) / 10,
          recentApproved: approvedCount.count || 0,
          recentRejected: rejectedCount.count || 0,
        });
      } catch (error) {
        log.error('Error fetching deal desk dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
      }
    },
  );

  // Get discount analytics
  app.get('/api/deal-desk/analytics/discounts', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { period, startDate, endDate } = req.query;

      let conditions = [eq(discountAnalytics.tenantId, tenantId)];

      if (period) {
        conditions.push(eq(discountAnalytics.periodType, period as string));
      }

      if (startDate) {
        conditions.push(gte(discountAnalytics.periodStart, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(discountAnalytics.periodEnd, new Date(endDate as string)));
      }

      const analytics = await db
        .select()
        .from(discountAnalytics)
        .where(and(...conditions))
        .orderBy(desc(discountAnalytics.periodStart));

      res.json(analytics);
    } catch (error) {
      log.error('Error fetching discount analytics:', error);
      res.status(500).json({ error: 'Failed to fetch discount analytics' });
    }
  });

  // ==================== Delegations ====================

  // Get delegations
  app.get('/api/deal-desk/delegations', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;

      const delegations = await db
        .select()
        .from(approvalDelegations)
        .where(
          and(
            eq(approvalDelegations.tenantId, tenantId),
            or(
              eq(approvalDelegations.delegatorId, userId),
              eq(approvalDelegations.delegateId, userId),
            ),
          ),
        )
        .orderBy(desc(approvalDelegations.createdAt));

      res.json(delegations);
    } catch (error) {
      log.error('Error fetching delegations:', error);
      res.status(500).json({ error: 'Failed to fetch delegations' });
    }
  });

  // Create delegation
  app.post('/api/deal-desk/delegations', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;

      const delegationData = insertApprovalDelegationSchema.parse({
        ...req.body,
        tenantId,
        delegatorId: userId,
        createdBy: userId,
      });

      const [delegation] = await db.insert(approvalDelegations).values(delegationData).returning();

      res.status(201).json(delegation);
    } catch (error) {
      log.error('Error creating delegation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create delegation' });
    }
  });

  // Deactivate delegation
  app.patch('/api/deal-desk/delegations/:id/deactivate', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user?.id || req.user?.claims?.sub;
      const { id } = req.params;

      const [delegation] = await db
        .update(approvalDelegations)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(approvalDelegations.id, id),
            eq(approvalDelegations.tenantId, tenantId),
            eq(approvalDelegations.delegatorId, userId),
          ),
        )
        .returning();

      if (!delegation) {
        return res.status(404).json({ error: 'Delegation not found' });
      }

      res.json(delegation);
    } catch (error) {
      log.error('Error deactivating delegation:', error);
      res.status(500).json({ error: 'Failed to deactivate delegation' });
    }
  });

  // ==================== Background Jobs ====================

  // Check SLA and escalate (should be called via CRON)
  app.post('/api/deal-desk/check-sla', isAuthenticated, async (req: any, res) => {
    try {
      // Only allow platform admin to trigger
      if (!req.user.role?.canAccessAllTenants) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await ApprovalWorkflowService.checkSLAAndEscalate();

      res.json({ message: 'SLA check completed' });
    } catch (error) {
      log.error('Error checking SLA:', error);
      res.status(500).json({ error: 'Failed to check SLA' });
    }
  });
}
