import type { Express } from 'express';
import { db } from './db';
import { autoLeadRoutingService } from './services/auto-lead-routing-service';
import { leadAssignmentHistory, leadScoreCalculations, repCapacity, businessRecords } from '@shared/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

export function registerAutoLeadRoutingRoutes(app: Express) {
  /**
   * Manually trigger auto-routing for a specific lead
   */
  app.post('/api/auto-lead-routing/route/:leadId', async (req, res) => {
    try {
      const { leadId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      console.log(`🤖 Auto-routing lead ${leadId} for tenant ${tenantId}...`);

      const result = await autoLeadRoutingService.routeLeadAutomatically(
        leadId,
        tenantId
      );

      console.log(`✅ Lead routed in ${result.processingTimeMs}ms to ${result.assignedRepName}`);

      res.json({
        success: true,
        message: 'Lead successfully routed',
        data: result,
      });
    } catch (error: any) {
      console.error('Auto-routing failed:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to route lead',
      });
    }
  });

  /**
   * Batch route multiple leads
   */
  app.post('/api/auto-lead-routing/route-batch', async (req, res) => {
    try {
      const { leadIds } = req.body;
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: 'leadIds array required' });
      }

      console.log(`🤖 Batch routing ${leadIds.length} leads...`);

      const results = [];
      const errors = [];

      for (const leadId of leadIds) {
        try {
          const result = await autoLeadRoutingService.routeLeadAutomatically(
            leadId,
            tenantId
          );
          results.push({ leadId, ...result });
        } catch (error: any) {
          errors.push({ leadId, error: error.message });
        }
      }

      res.json({
        success: true,
        routed: results.length,
        failed: errors.length,
        results,
        errors,
      });
    } catch (error: any) {
      console.error('Batch routing failed:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to route leads',
      });
    }
  });

  /**
   * Get auto-routing dashboard metrics
   */
  app.get('/api/auto-lead-routing/dashboard', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // Get routing statistics for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Total auto-routed leads
      const autoRoutedLeads = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadAssignmentHistory)
        .where(
          and(
            eq(leadAssignmentHistory.tenantId, tenantId),
            eq(leadAssignmentHistory.assignmentReason, 'auto_ai_routing'),
            gte(leadAssignmentHistory.assignedAt, thirtyDaysAgo)
          )
        );

      const totalAutoRouted = autoRoutedLeads[0]?.count || 0;

      // Average response times
      const responseStats = await db
        .select({
          avgResponseTime: sql<number>`AVG(first_response_time_minutes)::int`,
          fastResponses: sql<number>`COUNT(CASE WHEN first_response_time_minutes <= 5 THEN 1 END)::int`,
        })
        .from(leadAssignmentHistory)
        .where(
          and(
            eq(leadAssignmentHistory.tenantId, tenantId),
            eq(leadAssignmentHistory.assignmentReason, 'auto_ai_routing'),
            gte(leadAssignmentHistory.assignedAt, thirtyDaysAgo)
          )
        );

      const avgResponseTime = responseStats[0]?.avgResponseTime || 0;
      const fastResponseRate =
        totalAutoRouted > 0
          ? ((responseStats[0]?.fastResponses || 0) / totalAutoRouted) * 100
          : 0;

      // Lead score distribution
      const scoreDistribution = await db
        .select({
          grade: leadScoreCalculations.leadGrade,
          count: sql<number>`count(*)::int`,
        })
        .from(leadScoreCalculations)
        .where(
          and(
            eq(leadScoreCalculations.tenantId, tenantId),
            gte(leadScoreCalculations.calculatedAt, thirtyDaysAgo)
          )
        )
        .groupBy(leadScoreCalculations.leadGrade);

      // Rep workload distribution
      const repWorkload = await db
        .select({
          userId: repCapacity.userId,
          currentLoad: repCapacity.currentActiveLeads,
          maxLoad: repCapacity.maxActiveLeads,
          leadsToday: repCapacity.leadsAssignedToday,
          conversionRate: repCapacity.conversionRate,
          avgResponseTime: repCapacity.averageResponseTimeMinutes,
        })
        .from(repCapacity)
        .where(
          and(
            eq(repCapacity.tenantId, tenantId),
            eq(repCapacity.isAvailable, true)
          )
        );

      // Recent auto-routed leads
      const recentLeads = await db
        .select({
          id: leadAssignmentHistory.id,
          leadId: leadAssignmentHistory.leadId,
          assignedTo: leadAssignmentHistory.assignedTo,
          assignedAt: leadAssignmentHistory.assignedAt,
          firstResponseAt: leadAssignmentHistory.firstResponseAt,
          firstResponseTimeMinutes: leadAssignmentHistory.firstResponseTimeMinutes,
        })
        .from(leadAssignmentHistory)
        .where(
          and(
            eq(leadAssignmentHistory.tenantId, tenantId),
            eq(leadAssignmentHistory.assignmentReason, 'auto_ai_routing')
          )
        )
        .orderBy(desc(leadAssignmentHistory.assignedAt))
        .limit(10);

      // Calculate time saved
      // Assumption: Manual routing takes 5 minutes per lead
      const manualTimePerLead = 5;
      const totalTimeSavedMinutes = totalAutoRouted * manualTimePerLead;
      const timeSavedHours = totalTimeSavedMinutes / 60;

      res.json({
        overview: {
          totalAutoRouted,
          avgResponseTimeMinutes: avgResponseTime,
          fastResponseRate: fastResponseRate.toFixed(1),
          timeSavedHours: timeSavedHours.toFixed(1),
          timeSavedCost: (timeSavedHours * 35).toFixed(0), // $35/hour
          period: '30 days',
        },
        scoreDistribution: scoreDistribution.map(d => ({
          grade: d.grade,
          count: d.count,
        })),
        repWorkload: repWorkload.map(rep => ({
          userId: rep.userId,
          utilizationPercent: ((rep.currentLoad / (rep.maxLoad || 50)) * 100).toFixed(0),
          currentLoad: rep.currentLoad,
          maxLoad: rep.maxLoad || 50,
          leadsToday: rep.leadsToday,
          conversionRate: parseFloat(rep.conversionRate?.toString() || '0') * 100,
          avgResponseTime: rep.avgResponseTime,
        })),
        recentLeads,
      });
    } catch (error: any) {
      console.error('Failed to fetch dashboard:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard data',
      });
    }
  });

  /**
   * Configure auto-routing settings
   */
  app.get('/api/auto-lead-routing/config', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // TODO: Fetch from tenant settings table
      // For now, return defaults
      res.json({
        enabled: true,
        autoRouteNewLeads: true,
        minLeadScore: 50, // Only auto-route leads with score >= 50
        respectRepCapacity: true,
        maxLeadsPerRepPerDay: 10,
        sendImmediateEmail: true,
        emailTemplate: 'default',
        slaMinutes: 5, // Target to contact within 5 minutes
        businessHoursOnly: false,
        escalationEnabled: true,
        escalateAfterMinutes: 60,
      });
    } catch (error: any) {
      console.error('Failed to fetch config:', error);
      res.status(500).json({
        error: 'Failed to fetch configuration',
      });
    }
  });

  /**
   * Update auto-routing settings
   */
  app.put('/api/auto-lead-routing/config', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const config = req.body;

      // TODO: Save to tenant settings table
      console.log('📝 Updating auto-routing config:', config);

      res.json({
        success: true,
        message: 'Configuration updated',
        config,
      });
    } catch (error: any) {
      console.error('Failed to update config:', error);
      res.status(500).json({
        error: 'Failed to update configuration',
      });
    }
  });

  /**
   * Preview routing for a lead (without actually assigning)
   */
  app.get('/api/auto-lead-routing/preview/:leadId', async (req, res) => {
    try {
      const { leadId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // Fetch lead
      const lead = await db.query.businessRecords.findFirst({
        where: and(
          eq(businessRecords.id, leadId),
          eq(businessRecords.tenantId, tenantId)
        ),
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Score lead (but don't save)
      const service = autoLeadRoutingService as any;
      const leadScore = await service.scoreLead(lead, tenantId);

      // Get rep recommendations (but don't assign)
      const repScores = await service.scoreRepsForLead(lead, leadScore, tenantId);

      res.json({
        leadScore,
        recommendedReps: repScores.slice(0, 5), // Top 5
        previewOnly: true,
      });
    } catch (error: any) {
      console.error('Preview failed:', error);
      res.status(500).json({
        error: 'Failed to generate preview',
      });
    }
  });
}
