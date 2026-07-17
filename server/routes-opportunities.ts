import type { Express } from 'express';
import { eq, and, desc, sql, count, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { businessRecords, quotes, deals, users, type BusinessRecord } from '@shared/schema';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-opportunities');

// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  hasPermission,
  getQueryBuilder,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

import { getUserId, getTenantId, authed } from './utils/auth-helpers';
export function registerOpportunitiesRoutes(app: Express) {
  // Apply authentication and RBAC context to all opportunities routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/opportunities', isAuthenticated, enhanceUserContext);

  // Get all opportunities (leads with high potential) - requires opportunity view permission
  app.get(
    '/api/opportunities',
    isAuthenticated,
    requirePermission([
      PERMISSIONS.SALES.OPPORTUNITY.VIEW_OWN,
      PERMISSIONS.SALES.OPPORTUNITY.VIEW_TEAM,
      PERMISSIONS.SALES.OPPORTUNITY.VIEW_LOCATION,
    ]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenantId;

        // Get high-value leads and prospects
        const opportunities = await db
          .select({
            id: businessRecords.id,
            companyName: businessRecords.companyName,
            contactName: businessRecords.primaryContactName,
            email: businessRecords.primaryContactEmail,
            phone: businessRecords.phone,
            source: businessRecords.leadSource,
            status: businessRecords.status,
            assignedToId: businessRecords.ownerId,
            assignedToName: users.firstName,
            estimatedValue: businessRecords.estimatedAmount,
            priority: businessRecords.priority,
            lastContactDate: businessRecords.lastContactDate,
            nextFollowUpDate: businessRecords.nextFollowUpDate,
            stage: businessRecords.salesStage,
            createdAt: businessRecords.createdAt,
            updatedAt: businessRecords.updatedAt,
            notes: businessRecords.notes,
          })
          .from(businessRecords)
          .leftJoin(users, eq(businessRecords.ownerId, users.id))
          .where(
            and(
              eq(businessRecords.tenantId, tenantId),
              sql`${businessRecords.estimatedAmount} > 0 OR ${businessRecords.priority} IN ('high', 'urgent')`,
            ),
          )
          .orderBy(desc(businessRecords.estimatedAmount), desc(businessRecords.createdAt));

        res.json(opportunities);
      } catch (error) {
        log.error('Error fetching opportunities:', error);
        res.status(500).json({ error: 'Failed to fetch opportunities' });
      }
    }),
  );

  // Get opportunity by ID
  app.get('/api/opportunities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const opportunityId = req.params.id;

      const [opportunity] = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          contactName: businessRecords.primaryContactName,
          email: businessRecords.primaryContactEmail,
          phone: businessRecords.phone,
          source: businessRecords.leadSource,
          status: businessRecords.status,
          assignedToId: businessRecords.ownerId,
          assignedToName: users.firstName,
          estimatedValue: businessRecords.estimatedAmount,
          priority: businessRecords.priority,
          lastContactDate: businessRecords.lastContactDate,
          nextFollowUpDate: businessRecords.nextFollowUpDate,
          stage: businessRecords.salesStage,
          createdAt: businessRecords.createdAt,
          updatedAt: businessRecords.updatedAt,
          notes: businessRecords.notes,
          industry: businessRecords.industry,
          employeeCount: businessRecords.employeeCount,
          annualRevenue: businessRecords.annualRevenue,
        })
        .from(businessRecords)
        .leftJoin(users, eq(businessRecords.ownerId, users.id))
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)));

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      // Get related quotes
      const relatedQuotes = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.customerId, opportunityId), eq(quotes.tenantId, tenantId)))
        .orderBy(desc(quotes.createdAt));

      // Get related deals
      const relatedDeals = await db
        .select()
        .from(deals)
        .where(and(eq(deals.customerId, opportunityId), eq(deals.tenantId, tenantId)))
        .orderBy(desc(deals.createdAt));

      res.json({
        ...opportunity,
        relatedQuotes,
        relatedDeals,
      });
    } catch (error) {
      log.error('Error fetching opportunity:', error);
      res.status(500).json({ error: 'Failed to fetch opportunity' });
    }
  });

  // Update opportunity
  app.put('/api/opportunities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const opportunityId = req.params.id;

      const [updatedOpportunity] = await db
        .update(businessRecords)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)))
        .returning();

      if (!updatedOpportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      res.json(updatedOpportunity);
    } catch (error) {
      log.error('Error updating opportunity:', error);
      res.status(500).json({ error: 'Failed to update opportunity' });
    }
  });

  // PATCH /api/opportunities/:id/stage - move an opportunity to a new pipeline
  // stage. Mirrors the production opportunities edge function, which folds the
  // app's `stage` (kanban "Move Forward") or `sales_stage`/`salesStage`
  // (detail Save) field into the persisted stage. Returns `salesStage` so the
  // iOS pipeline decoder populates the column it groups by.
  app.patch('/api/opportunities/:id/stage', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const opportunityId = req.params.id;
      const incomingStage = req.body?.stage ?? req.body?.sales_stage ?? req.body?.salesStage;
      if (incomingStage === undefined || incomingStage === null || incomingStage === '') {
        return res.status(400).json({ error: 'stage is required' });
      }
      const stage = String(incomingStage).toLowerCase();

      const [updated] = await db
        .update(businessRecords)
        .set({ salesStage: stage, updatedAt: new Date() })
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      res.json({ ...updated, salesStage: updated.salesStage });
    } catch (error) {
      log.error('Error updating opportunity stage:', error);
      res.status(500).json({ error: 'Failed to update opportunity stage' });
    }
  });

  // Convert opportunity to deal
  app.post('/api/opportunities/:id/convert-to-deal', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const opportunityId = req.params.id;
      const userId = req.user?.id || req.user?.claims?.sub;

      // Get the opportunity
      const [opportunity] = await db
        .select()
        .from(businessRecords)
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)));

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      // Create deal from opportunity
      const dealData = {
        title: `Deal: ${opportunity.companyName}`,
        description: `Converted from opportunity: ${opportunity.primaryContactName}`,
        customerId: opportunity.id,
        amount: opportunity.estimatedAmount || '0',
        probability: 50, // Default probability
        status: 'active',
        ownerId: opportunity.ownerId || userId,
        tenantId,
        createdById: userId,
        expectedCloseDate:
          req.body.expectedCloseDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };

      const [newDeal] = await db.insert(deals).values(dealData).returning();

      // Update opportunity status to indicate it's been converted
      await db
        .update(businessRecords)
        .set({
          status: 'customer',
          salesStage: 'converted',
          updatedAt: new Date(),
        })
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenantId, tenantId)));

      res.json(newDeal);
    } catch (error) {
      log.error('Error converting opportunity to deal:', error);
      res.status(500).json({ error: 'Failed to convert opportunity to deal' });
    }
  });

  // Get opportunities dashboard
  app.get('/api/opportunities/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Get opportunity statistics
      const totalOpportunitiesResult = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            sql`${businessRecords.estimatedAmount} > 0 OR ${businessRecords.priority} IN ('high', 'urgent')`,
          ),
        );

      const highValueOpportunitiesResult = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            sql`${businessRecords.estimatedAmount} >= 10000`,
          ),
        );

      const urgentOpportunitiesResult = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.priority, 'urgent')));

      const totalValueResult = await db
        .select({
          totalValue: sql<number>`COALESCE(SUM(${businessRecords.estimatedAmount}), 0)`,
        })
        .from(businessRecords)
        .where(
          and(eq(businessRecords.tenantId, tenantId), sql`${businessRecords.estimatedAmount} > 0`),
        );

      const totalOpportunities = totalOpportunitiesResult[0]?.count || 0;
      const highValueOpportunities = highValueOpportunitiesResult[0]?.count || 0;
      const urgentOpportunities = urgentOpportunitiesResult[0]?.count || 0;
      const totalValue = totalValueResult[0]?.totalValue || 0;

      res.json({
        totalOpportunities,
        highValueOpportunities,
        urgentOpportunities,
        totalValue,
        averageValue: totalOpportunities > 0 ? totalValue / totalOpportunities : 0,
      });
    } catch (error) {
      log.error('Error fetching opportunities dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch opportunities dashboard' });
    }
  });

  // Get opportunities by stage
  app.get('/api/opportunities/by-stage', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const opportunitiesByStage = await db
        .select({
          stage: businessRecords.salesStage,
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(${businessRecords.estimatedAmount}), 0)`,
        })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            sql`${businessRecords.estimatedAmount} > 0 OR ${businessRecords.priority} IN ('high', 'urgent')`,
          ),
        )
        .groupBy(businessRecords.salesStage);

      res.json(opportunitiesByStage);
    } catch (error) {
      log.error('Error fetching opportunities by stage:', error);
      res.status(500).json({ error: 'Failed to fetch opportunities by stage' });
    }
  });
}
