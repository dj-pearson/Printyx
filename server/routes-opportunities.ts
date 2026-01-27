import type { Express } from 'express';
import { eq, and, desc, sql, count, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { businessRecords, quotes, deals, users, type BusinessRecord } from '@shared/schema';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  hasPermission,
  getQueryBuilder,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

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
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user!.tenant_id;

        // Get high-value leads and prospects
        const opportunities = await db
          .select({
            id: businessRecords.id,
            companyName: businessRecords.companyName,
            contactName: businessRecords.contactName,
            email: businessRecords.email,
            phone: businessRecords.phone,
            source: businessRecords.source,
            status: businessRecords.status,
            assignedToId: businessRecords.assignedToId,
            assignedToName: users.firstName,
            estimatedValue: businessRecords.estimatedValue,
            priority: businessRecords.priority,
            lastContactDate: businessRecords.lastContactDate,
            nextFollowUpDate: businessRecords.nextFollowUpDate,
            stage: businessRecords.stage,
            createdAt: businessRecords.created_at,
            updatedAt: businessRecords.updated_at,
            notes: businessRecords.notes,
          })
          .from(businessRecords)
          .leftJoin(users, eq(businessRecords.assignedToId, users.id))
          .where(
            and(
              eq(businessRecords.tenant_id, tenantId),
              sql`${businessRecords.estimatedValue} > 0 OR ${businessRecords.priority} IN ('high', 'urgent')`,
            ),
          )
          .orderBy(desc(businessRecords.estimatedValue), desc(businessRecords.created_at));

        res.json(opportunities);
      } catch (error) {
        console.error('Error fetching opportunities:', error);
        res.status(500).json({ error: 'Failed to fetch opportunities' });
      }
    },
  );

  // Get opportunity by ID
  app.get('/api/opportunities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const opportunityId = req.params.id;

      const [opportunity] = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          contactName: businessRecords.contactName,
          email: businessRecords.email,
          phone: businessRecords.phone,
          source: businessRecords.source,
          status: businessRecords.status,
          assignedToId: businessRecords.assignedToId,
          assignedToName: users.firstName,
          estimatedValue: businessRecords.estimatedValue,
          priority: businessRecords.priority,
          lastContactDate: businessRecords.lastContactDate,
          nextFollowUpDate: businessRecords.nextFollowUpDate,
          stage: businessRecords.stage,
          createdAt: businessRecords.created_at,
          updatedAt: businessRecords.updated_at,
          notes: businessRecords.notes,
          industry: businessRecords.industry,
          employeeCount: businessRecords.employeeCount,
          annualRevenue: businessRecords.annualRevenue,
        })
        .from(businessRecords)
        .leftJoin(users, eq(businessRecords.assignedToId, users.id))
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenant_id, tenantId)));

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      // Get related quotes
      const relatedQuotes = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.customerId, opportunityId), eq(quotes.tenant_id, tenantId)))
        .orderBy(desc(quotes.created_at));

      // Get related deals
      const relatedDeals = await db
        .select()
        .from(deals)
        .where(and(eq(deals.customerId, opportunityId), eq(deals.tenant_id, tenantId)))
        .orderBy(desc(deals.created_at));

      res.json({
        ...opportunity,
        relatedQuotes,
        relatedDeals,
      });
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      res.status(500).json({ error: 'Failed to fetch opportunity' });
    }
  });

  // Update opportunity
  app.put('/api/opportunities/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const opportunityId = req.params.id;

      const [updatedOpportunity] = await db
        .update(businessRecords)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenant_id, tenantId)))
        .returning();

      if (!updatedOpportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      res.json(updatedOpportunity);
    } catch (error) {
      console.error('Error updating opportunity:', error);
      res.status(500).json({ error: 'Failed to update opportunity' });
    }
  });

  // Convert opportunity to deal
  app.post('/api/opportunities/:id/convert-to-deal', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;
      const opportunityId = req.params.id;
      const userId = req.user?.id || req.user?.claims?.sub;

      // Get the opportunity
      const [opportunity] = await db
        .select()
        .from(businessRecords)
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenant_id, tenantId)));

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      // Create deal from opportunity
      const dealData = {
        title: `Deal: ${opportunity.companyName}`,
        description: `Converted from opportunity: ${opportunity.contactName}`,
        customerId: opportunity.id,
        value: opportunity.estimatedValue || 0,
        probability: 50, // Default probability
        stage: 'prospecting',
        status: 'active',
        assignedToId: opportunity.assignedToId || userId,
        tenantId,
        createdBy: userId,
        expectedCloseDate:
          req.body.expectedCloseDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };

      const [newDeal] = await db.insert(deals).values(dealData).returning();

      // Update opportunity status to indicate it's been converted
      await db
        .update(businessRecords)
        .set({
          status: 'customer',
          stage: 'converted',
          updatedAt: new Date(),
        })
        .where(and(eq(businessRecords.id, opportunityId), eq(businessRecords.tenant_id, tenantId)));

      res.json(newDeal);
    } catch (error) {
      console.error('Error converting opportunity to deal:', error);
      res.status(500).json({ error: 'Failed to convert opportunity to deal' });
    }
  });

  // Get opportunities dashboard
  app.get('/api/opportunities/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;

      // Get opportunity statistics
      const totalOpportunitiesResult = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenant_id, tenantId),
            sql`${businessRecords.estimatedValue} > 0 OR ${businessRecords.priority} IN ('high', 'urgent')`,
          ),
        );

      const highValueOpportunitiesResult = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenant_id, tenantId),
            sql`${businessRecords.estimatedValue} >= 10000`,
          ),
        );

      const urgentOpportunitiesResult = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(
          and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.priority, 'urgent')),
        );

      const totalValueResult = await db
        .select({
          totalValue: sql<number>`COALESCE(SUM(${businessRecords.estimatedValue}), 0)`,
        })
        .from(businessRecords)
        .where(
          and(eq(businessRecords.tenant_id, tenantId), sql`${businessRecords.estimatedValue} > 0`),
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
      console.error('Error fetching opportunities dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch opportunities dashboard' });
    }
  });

  // Get opportunities by stage
  app.get('/api/opportunities/by-stage', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenant_id;

      const opportunitiesByStage = await db
        .select({
          stage: businessRecords.stage,
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(${businessRecords.estimatedValue}), 0)`,
        })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenant_id, tenantId),
            sql`${businessRecords.estimatedValue} > 0 OR ${businessRecords.priority} IN ('high', 'urgent')`,
          ),
        )
        .groupBy(businessRecords.stage);

      res.json(opportunitiesByStage);
    } catch (error) {
      console.error('Error fetching opportunities by stage:', error);
      res.status(500).json({ error: 'Failed to fetch opportunities by stage' });
    }
  });
}
