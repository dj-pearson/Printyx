import { Router } from 'express';
import { db } from './db';
import { eq, and, gte, lte, desc, sql, isNull, or } from 'drizzle-orm';
import { businessRecordActivities, businessRecords, deals } from '@shared/schema';
import type { Request, Response } from 'express';
import { format, startOfDay, endOfDay, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';

// Helper to get user ID from request (supports Supabase JWT and session)
const getUserId = (req: Request): string | undefined => {
  const reqAny = req as any;
  return (
    reqAny.user?.id ||
    reqAny.user?.claims?.sub ||
    reqAny.session?.userId ||
    reqAny.session?.user?.id
  );
};

interface TenantRequest extends Request {
  tenantId?: string;
  session?: {
    userId?: string;
    user?: {
      id?: string;
      role?: string;
    };
  };
}

export function registerTodayDashboardRoutes(app: Router) {
  /**
   * GET /api/dashboards/today
   * Returns personalized daily workflow view with:
   * - Overdue activities
   * - Today's schedule
   * - Upcoming activities (next 3 days)
   * - Hot leads (AI-scored)
   * - Pipeline alerts (stalled deals)
   * - Recent wins
   * - Quick stats
   */
  app.get('/api/dashboards/today', async (req: TenantRequest, res: Response) => {
    try {
      const tenantId = req.tenantId;
      const userId = getUserId(req);

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const yesterday = subDays(now, 1);
      const threeDaysFromNow = addDays(now, 3);
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);

      // Fetch overdue activities
      const overdueActivities =
        (await db.query.activities?.findMany({
          where: and(
            eq(businessRecordActivities.tenantId, tenantId),
            or(
              lte(businessRecordActivities.dueDate!, todayStart),
              lte(businessRecordActivities.scheduledDate!, yesterday),
            ),
            eq(businessRecordActivities.status, 'pending'),
          ),
          orderBy: [businessRecordActivities.dueDate],
          limit: 10,
        })) || [];

      // Fetch today's activities
      const todayActivities =
        (await db.query.activities?.findMany({
          where: and(
            eq(businessRecordActivities.tenantId, tenantId),
            gte(businessRecordActivities.scheduledDate!, todayStart),
            lte(businessRecordActivities.scheduledDate!, todayEnd),
            eq(businessRecordActivities.status, 'pending'),
          ),
          orderBy: [businessRecordActivities.scheduledDate],
          limit: 20,
        })) || [];

      // Fetch upcoming activities (next 3 days)
      const upcomingActivities =
        (await db.query.activities?.findMany({
          where: and(
            eq(businessRecordActivities.tenantId, tenantId),
            gte(businessRecordActivities.scheduledDate!, addDays(todayEnd, 1)),
            lte(businessRecordActivities.scheduledDate!, threeDaysFromNow),
            eq(businessRecordActivities.status, 'pending'),
          ),
          orderBy: [businessRecordActivities.scheduledDate],
          limit: 10,
        })) || [];

      // Fetch hot leads (high-scoring leads from lead_scoring table or high-priority leads)
      // TODO: Implement lead scoring when leadScoring table is available
      const hotLeads: any[] = [];

      // Enrich leads with business record data
      const enrichedHotLeads = await Promise.all(
        hotLeads.map(async (lead) => {
          const businessRecord = lead.businessRecordId
            ? await db.query.businessRecords?.findFirst({
                where: eq(businessRecords.id, lead.businessRecordId),
              })
            : null;

          return {
            id: lead.businessRecordId || lead.id,
            companyName: businessRecord?.companyName || 'Unknown',
            contactName: businessRecord?.primaryContactName,
            estimatedValue: businessRecord?.estimatedDealValue || lead.estimatedValue,
            score: lead.score,
            status: businessRecord?.status || 'lead',
            lastContact: businessRecord?.lastContactDate,
            reason: lead.scoringReason || 'High engagement and budget confirmed',
          };
        }),
      );

      // Fetch pipeline alerts (stalled deals)
      const allDeals =
        (await db.query.deals?.findMany({
          where: and(
            eq(deals.tenantId, tenantId),
            or(
              eq(deals.dealStage, 'prospecting'),
              eq(deals.dealStage, 'qualification'),
              eq(deals.dealStage, 'proposal'),
              eq(deals.dealStage, 'negotiation'),
            ),
          ),
        })) || [];

      // Calculate days since last update and identify stale deals
      const pipelineAlerts = allDeals
        .map((deal) => {
          const updatedAt = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt!);
          const daysSinceUpdate = Math.floor(
            (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
          );

          // Consider deals stale if > 7 days in same stage
          const isStale = daysSinceUpdate > 7;

          return {
            id: deal.id,
            title: deal.title || deal.dealName || 'Unnamed Deal',
            companyName: deal.companyName || 'Unknown',
            value: deal.dealValue || deal.amount || 0,
            stage: deal.dealStage,
            daysSinceUpdate,
            probability: deal.probability || 0,
            staleReason: isStale ? `Stalled in ${deal.dealStage} stage (avg: 12 days)` : undefined,
            isStale,
          };
        })
        .filter((deal) => deal.isStale)
        .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
        .slice(0, 5);

      // Fetch recent wins (closed-won deals this week)
      const recentWins =
        (await db.query.deals?.findMany({
          where: and(
            eq(deals.tenantId, tenantId),
            eq(deals.dealStage, 'closed-won'),
            gte(deals.actualCloseDate!, weekStart),
            lte(deals.actualCloseDate!, weekEnd),
          ),
          orderBy: [desc(deals.actualCloseDate)],
          limit: 5,
        })) || [];

      const enrichedWins = recentWins.map((deal) => ({
        id: deal.id,
        title: deal.title || deal.dealName || 'Unnamed Deal',
        companyName: deal.companyName || 'Unknown',
        value: deal.dealValue || deal.amount || 0,
        stage: deal.dealStage,
        daysSinceUpdate: 0,
        probability: 100,
      }));

      // Calculate quick stats
      const allDealsForStats =
        (await db.query.deals?.findMany({
          where: eq(deals.tenantId, tenantId),
        })) || [];

      const pipelineValue = allDealsForStats
        .filter((d) => d.dealStage !== 'closed-won' && d.dealStage !== 'closed-lost')
        .reduce((sum, d) => sum + (d.dealValue || d.amount || 0), 0);

      // Calculate quota attainment (assuming monthly quota of $100K for demo)
      const monthlyQuota = 100000;
      const thisMonthWins = allDealsForStats.filter((d) => {
        if (d.dealStage !== 'closed-won' || !d.actualCloseDate) return false;
        const closeDate = new Date(d.actualCloseDate);
        return (
          closeDate.getMonth() === now.getMonth() && closeDate.getFullYear() === now.getFullYear()
        );
      });
      const thisMonthRevenue = thisMonthWins.reduce(
        (sum, d) => sum + (d.dealValue || d.amount || 0),
        0,
      );
      const quotaAttainment = Math.round((thisMonthRevenue / monthlyQuota) * 100);

      // Calculate conversion rate
      const totalLeads =
        (await db.query.businessRecords?.findMany({
          where: and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.recordType, 'lead'),
          ),
        })) || [];
      const convertedLeads = totalLeads.filter(
        (l) => l.status === 'active' || l.recordType === 'customer',
      );
      const conversionRate =
        totalLeads.length > 0 ? Math.round((convertedLeads.length / totalLeads.length) * 100) : 0;

      // Tasks completed today
      const completedToday =
        (await db.query.activities?.findMany({
          where: and(
            eq(businessRecordActivities.tenantId, tenantId),
            eq(businessRecordActivities.status, 'completed'),
            gte(businessRecordActivities.completedAt!, todayStart),
          ),
        })) || [];

      const stats = {
        pipelineValue: Math.round(pipelineValue),
        quotaAttainment,
        conversionRate,
        tasksCompleted: completedToday.length,
      };

      // Return formatted response
      return res.json({
        overdue: overdueActivities.map(formatActivity),
        today: todayActivities.map(formatActivity),
        upcoming: upcomingActivities.map(formatActivity),
        hotLeads: enrichedHotLeads,
        pipelineAlerts: pipelineAlerts.map((alert) => ({
          id: alert.id,
          title: alert.title,
          companyName: alert.companyName,
          value: alert.value,
          stage: alert.stage,
          daysSinceUpdate: alert.daysSinceUpdate,
          probability: alert.probability,
          staleReason: alert.staleReason,
        })),
        recentWins: enrichedWins,
        stats,
      });
    } catch (error) {
      console.error('Error fetching today dashboard:', error);
      return res.status(500).json({
        error: 'Failed to fetch today dashboard',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

// Helper function to format activities
function formatActivity(activity: any) {
  return {
    id: activity.id,
    title: activity.title || activity.subject || 'Untitled Activity',
    type: activity.type || activity.activityType || 'task',
    scheduledDate: activity.scheduledDate,
    dueDate: activity.dueDate,
    priority: activity.priority || 'medium',
    status: activity.status || 'pending',
    customerName: activity.customerName || activity.companyName,
    customerId: activity.customerId || activity.businessRecordId,
    notes: activity.notes || activity.description,
  };
}
