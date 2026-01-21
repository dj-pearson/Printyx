import { Router } from 'express';
import { db } from './db';
import {
  platformBusinessRecords,
  platformDeals,
  platformActivities,
  platformCohortAnalysis,
  platformActivityReports,
  platformSalesGoals,
  platformHealthScores,
  platformChurnPredictions,
} from '../shared/schema';
import { eq, and, sql, gte, lte, desc, asc, inArray } from 'drizzle-orm';

const router = Router();

/**
 * PLATFORM ANALYTICS API
 *
 * Provides advanced analytics and reporting for platform administrators
 * to analyze tenant acquisition, retention, revenue, and performance.
 *
 * Endpoints:
 * - GET /api/platform-analytics/cohort-analysis - Cohort retention analysis
 * - GET /api/platform-analytics/revenue-metrics - LTV, CAC, NRR, ARR metrics
 * - GET /api/platform-analytics/conversion-funnel - Pipeline conversion rates
 * - GET /api/platform-analytics/sales-performance - Sales team performance
 * - GET /api/platform-analytics/pipeline-forecast - Revenue forecasting
 * - GET /api/platform-analytics/churn-analysis - Churn trends and analysis
 * - GET /api/platform-analytics/activity-trends - Activity volume trends
 * - POST /api/platform-analytics/cohort-analysis/generate - Generate new cohort
 * - GET /api/platform-analytics/goals-tracking - Sales goals vs actuals
 * - GET /api/platform-analytics/health-trends - Customer health trends
 */

/**
 * GET /api/platform-analytics/cohort-analysis
 * Get cohort analysis data with retention metrics
 *
 * Query params:
 * - periodType: 'monthly' | 'quarterly' | 'yearly'
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - cohortBy: 'signup' | 'activation' | 'first_payment'
 */
router.get('/cohort-analysis', async (req, res) => {
  try {
    const { periodType = 'monthly', startDate, endDate, cohortBy = 'signup' } = req.query;

    const whereConditions = [];
    if (startDate) {
      whereConditions.push(
        gte(platformCohortAnalysis.cohortStartDate, new Date(startDate as string)),
      );
    }
    if (endDate) {
      whereConditions.push(
        lte(platformCohortAnalysis.cohortStartDate, new Date(endDate as string)),
      );
    }

    const cohorts = await db.query.platformCohortAnalysis.findMany({
      where: and(eq(platformCohortAnalysis.periodType, periodType as string), ...whereConditions),
      orderBy: [desc(platformCohortAnalysis.cohortStartDate)],
    });

    // Calculate aggregated metrics
    const totalCustomers = cohorts.reduce((sum, c) => sum + (c.customersAtStart || 0), 0);
    const totalRevenue = cohorts.reduce((sum, c) => sum + parseFloat(c.revenueAtStart || '0'), 0);
    const avgRetention =
      cohorts.length > 0
        ? cohorts.reduce((sum, c) => sum + parseFloat(c.retentionRate || '0'), 0) / cohorts.length
        : 0;

    res.json({
      cohorts,
      summary: {
        totalCohorts: cohorts.length,
        totalCustomers,
        totalRevenue,
        averageRetentionRate: avgRetention.toFixed(2),
        periodType,
        dateRange: {
          start: startDate || 'all',
          end: endDate || 'all',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching cohort analysis:', error);
    res.status(500).json({ message: 'Failed to fetch cohort analysis' });
  }
});

/**
 * POST /api/platform-analytics/cohort-analysis/generate
 * Generate cohort analysis for a specific period
 *
 * Body:
 * - cohortStartDate: ISO date string
 * - periodType: 'monthly' | 'quarterly' | 'yearly'
 * - cohortDefinition: 'signup' | 'activation' | 'first_payment'
 */
router.post('/cohort-analysis/generate', async (req, res) => {
  try {
    const { cohortStartDate, periodType = 'monthly', cohortDefinition = 'signup' } = req.body;

    if (!cohortStartDate) {
      return res.status(400).json({ message: 'cohortStartDate is required' });
    }

    const startDate = new Date(cohortStartDate);

    // Calculate period end date
    let endDate = new Date(startDate);
    if (periodType === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (periodType === 'quarterly') {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (periodType === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Get customers who joined in this cohort period
    const cohortCustomers = await db.query.platformBusinessRecords.findMany({
      where: and(
        eq(platformBusinessRecords.recordType, 'tenant'),
        gte(platformBusinessRecords.createdAt, startDate),
        lte(platformBusinessRecords.createdAt, endDate),
      ),
    });

    const customersAtStart = cohortCustomers.length;
    const revenueAtStart = cohortCustomers.reduce(
      (sum, c) => sum + parseFloat(c.currentMRR || '0'),
      0,
    );

    // Calculate current retention
    const activeCustomers = cohortCustomers.filter(
      (c) => c.status === 'active_customer' || c.status === 'trial_active',
    );
    const customersNow = activeCustomers.length;
    const revenueNow = activeCustomers.reduce((sum, c) => sum + parseFloat(c.currentMRR || '0'), 0);

    const retentionRate =
      customersAtStart > 0 ? ((customersNow / customersAtStart) * 100).toFixed(2) : '0';
    const revenueRetentionRate =
      revenueAtStart > 0 ? ((revenueNow / revenueAtStart) * 100).toFixed(2) : '0';

    // Calculate churn
    const churnedCustomers = cohortCustomers.filter(
      (c) => c.status === 'churned' || c.status === 'trial_churned',
    );
    const churnRate =
      customersAtStart > 0 ? ((churnedCustomers.length / customersAtStart) * 100).toFixed(2) : '0';

    // Calculate LTV (simple calculation: average MRR * average lifetime months)
    const averageMRR = customersAtStart > 0 ? revenueAtStart / customersAtStart : 0;
    const avgLifetimeMonths = 24; // Placeholder - should calculate from actual data
    const ltv = averageMRR * avgLifetimeMonths;

    const [cohort] = await db
      .insert(platformCohortAnalysis)
      .values({
        cohortStartDate: startDate,
        cohortEndDate: endDate,
        periodType,
        cohortDefinition,
        customersAtStart,
        revenueAtStart: revenueAtStart.toFixed(2),
        customersNow,
        revenueNow: revenueNow.toFixed(2),
        retentionRate,
        revenueRetentionRate,
        churnRate,
        ltv: ltv.toFixed(2),
        calculatedAt: new Date(),
        calculatedBy: 'system', // TODO: Get from auth context
      })
      .returning();

    res.status(201).json({
      message: 'Cohort analysis generated successfully',
      cohort,
    });
  } catch (error) {
    console.error('Error generating cohort analysis:', error);
    res.status(500).json({ message: 'Failed to generate cohort analysis' });
  }
});

/**
 * GET /api/platform-analytics/revenue-metrics
 * Get key revenue metrics (LTV, CAC, NRR, ARR, MRR)
 *
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
router.get('/revenue-metrics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereConditions = [];
    if (startDate) {
      whereConditions.push(gte(platformBusinessRecords.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      whereConditions.push(lte(platformBusinessRecords.createdAt, new Date(endDate as string)));
    }

    // Get all active tenants
    const activeTenants = await db.query.platformBusinessRecords.findMany({
      where: and(
        eq(platformBusinessRecords.recordType, 'tenant'),
        eq(platformBusinessRecords.status, 'active_customer'),
        ...whereConditions,
      ),
    });

    // Calculate MRR (Monthly Recurring Revenue)
    const totalMRR = activeTenants.reduce((sum, t) => sum + parseFloat(t.currentMRR || '0'), 0);

    // Calculate ARR (Annual Recurring Revenue)
    const totalARR = totalMRR * 12;

    // Calculate average revenue per account (ARPA)
    const arpa = activeTenants.length > 0 ? totalMRR / activeTenants.length : 0;

    // Get churned tenants for churn rate
    const churnedTenants = await db.query.platformBusinessRecords.findMany({
      where: and(
        eq(platformBusinessRecords.recordType, 'tenant'),
        eq(platformBusinessRecords.status, 'churned'),
        ...whereConditions,
      ),
    });

    // Calculate gross revenue retention (GRR) and net revenue retention (NRR)
    // Simplified calculation - should track month-over-month changes
    const churnRate =
      activeTenants.length + churnedTenants.length > 0
        ? (churnedTenants.length / (activeTenants.length + churnedTenants.length)) * 100
        : 0;
    const grr = 100 - churnRate; // Simplified GRR

    // Calculate expansion revenue (tenants with increased MRR)
    const expandedTenants = activeTenants.filter(
      (t) => t.lastMRRChange && parseFloat(t.lastMRRChange) > 0,
    );
    const expansionMRR = expandedTenants.reduce(
      (sum, t) => sum + parseFloat(t.lastMRRChange || '0'),
      0,
    );
    const expansionRate = totalMRR > 0 ? (expansionMRR / totalMRR) * 100 : 0;

    // NRR = GRR + Expansion Rate
    const nrr = grr + expansionRate;

    // Calculate LTV (Lifetime Value)
    const avgLifetimeMonths = churnRate > 0 ? 1 / (churnRate / 100) : 24; // Inverse of churn rate
    const ltv = arpa * avgLifetimeMonths;

    // Calculate CAC (Customer Acquisition Cost)
    // Placeholder - would need marketing spend data
    const estimatedCAC = ltv / 3; // Industry benchmark: LTV should be 3x CAC

    // Calculate LTV:CAC ratio
    const ltvCacRatio = estimatedCAC > 0 ? ltv / estimatedCAC : 0;

    // Get new customer count
    const newCustomers = await db.query.platformBusinessRecords.findMany({
      where: and(eq(platformBusinessRecords.recordType, 'tenant'), ...whereConditions),
    });

    // Calculate payback period (months to recover CAC)
    const paybackPeriod = arpa > 0 ? estimatedCAC / arpa : 0;

    res.json({
      metrics: {
        mrr: totalMRR.toFixed(2),
        arr: totalARR.toFixed(2),
        arpa: arpa.toFixed(2),
        ltv: ltv.toFixed(2),
        cac: estimatedCAC.toFixed(2),
        ltvCacRatio: ltvCacRatio.toFixed(2),
        grr: grr.toFixed(2),
        nrr: nrr.toFixed(2),
        churnRate: churnRate.toFixed(2),
        expansionRate: expansionRate.toFixed(2),
        paybackPeriod: paybackPeriod.toFixed(1),
      },
      counts: {
        activeTenants: activeTenants.length,
        churnedTenants: churnedTenants.length,
        newCustomers: newCustomers.length,
        expandedTenants: expandedTenants.length,
      },
      dateRange: {
        start: startDate || 'all',
        end: endDate || 'all',
      },
    });
  } catch (error) {
    console.error('Error calculating revenue metrics:', error);
    res.status(500).json({ message: 'Failed to calculate revenue metrics' });
  }
});

/**
 * GET /api/platform-analytics/conversion-funnel
 * Get conversion funnel metrics from prospect to customer
 */
router.get('/conversion-funnel', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereConditions = [];
    if (startDate) {
      whereConditions.push(gte(platformBusinessRecords.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      whereConditions.push(lte(platformBusinessRecords.createdAt, new Date(endDate as string)));
    }

    // Count by status
    const allRecords = await db.query.platformBusinessRecords.findMany({
      where: and(...whereConditions),
    });

    const statusCounts = {
      new: 0,
      contacted: 0,
      qualified: 0,
      trial_active: 0,
      trial_converted: 0,
      active_customer: 0,
      churned: 0,
      lost: 0,
    };

    allRecords.forEach((record) => {
      const status = record.status;
      if (status && status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts]++;
      }
    });

    // Calculate conversion rates
    const totalProspects = allRecords.filter((r) => r.recordType === 'prospect').length;
    const totalTenants = allRecords.filter((r) => r.recordType === 'tenant').length;

    const contactedRate = totalProspects > 0 ? (statusCounts.contacted / totalProspects) * 100 : 0;
    const qualifiedRate = totalProspects > 0 ? (statusCounts.qualified / totalProspects) * 100 : 0;
    const trialRate = totalProspects > 0 ? (statusCounts.trial_active / totalProspects) * 100 : 0;
    const conversionRate = totalProspects > 0 ? (totalTenants / totalProspects) * 100 : 0;

    // Get deal conversion rates
    const deals = await db.query.platformDeals.findMany({
      where:
        whereConditions.length > 0
          ? and(
              ...whereConditions.map((c) => {
                if ('column' in c && c.column === platformBusinessRecords.createdAt) {
                  return gte(platformDeals.createdAt, (c as any).value);
                }
                return c;
              }),
            )
          : undefined,
    });

    const dealsByStage = deals.reduce(
      (acc, deal) => {
        const stage = deal.stage || 'prospecting';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const closedWon = deals.filter((d) => d.stage === 'closed_won').length;
    const closedLost = deals.filter((d) => d.stage === 'closed_lost').length;
    const totalClosed = closedWon + closedLost;
    const winRate = totalClosed > 0 ? (closedWon / totalClosed) * 100 : 0;

    res.json({
      funnel: [
        {
          stage: 'New Prospects',
          count: statusCounts.new,
          percentage: 100,
          conversionToNext: contactedRate.toFixed(2),
        },
        {
          stage: 'Contacted',
          count: statusCounts.contacted,
          percentage: contactedRate.toFixed(2),
          conversionToNext: qualifiedRate.toFixed(2),
        },
        {
          stage: 'Qualified',
          count: statusCounts.qualified,
          percentage: qualifiedRate.toFixed(2),
          conversionToNext: trialRate.toFixed(2),
        },
        {
          stage: 'Trial Active',
          count: statusCounts.trial_active,
          percentage: trialRate.toFixed(2),
          conversionToNext: conversionRate.toFixed(2),
        },
        {
          stage: 'Active Customer',
          count: statusCounts.active_customer,
          percentage: conversionRate.toFixed(2),
          conversionToNext: null,
        },
      ],
      summary: {
        totalProspects,
        totalTenants,
        overallConversionRate: conversionRate.toFixed(2),
        contactedRate: contactedRate.toFixed(2),
        qualifiedRate: qualifiedRate.toFixed(2),
        trialRate: trialRate.toFixed(2),
      },
      dealPipeline: {
        dealsByStage,
        totalDeals: deals.length,
        closedWon,
        closedLost,
        winRate: winRate.toFixed(2),
      },
      dateRange: {
        start: startDate || 'all',
        end: endDate || 'all',
      },
    });
  } catch (error) {
    console.error('Error calculating conversion funnel:', error);
    res.status(500).json({ message: 'Failed to calculate conversion funnel' });
  }
});

/**
 * GET /api/platform-analytics/sales-performance
 * Get sales team performance metrics
 */
router.get('/sales-performance', async (req, res) => {
  try {
    const { startDate, endDate, repId } = req.query;

    const whereConditions = [];
    if (startDate) {
      whereConditions.push(gte(platformActivityReports.reportDate, new Date(startDate as string)));
    }
    if (endDate) {
      whereConditions.push(lte(platformActivityReports.reportDate, new Date(endDate as string)));
    }
    if (repId) {
      whereConditions.push(eq(platformActivityReports.repId, repId as string));
    }

    const reports = await db.query.platformActivityReports.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: [desc(platformActivityReports.reportDate)],
    });

    // Aggregate metrics by rep
    const repMetrics = reports.reduce(
      (acc, report) => {
        const rep = report.repId || 'unassigned';
        if (!acc[rep]) {
          acc[rep] = {
            repId: rep,
            repName: report.repName || 'Unassigned',
            totalCalls: 0,
            totalEmails: 0,
            totalMeetings: 0,
            totalDemos: 0,
            totalActivities: 0,
            leadsGenerated: 0,
            opportunitiesCreated: 0,
            dealsWon: 0,
            revenueGenerated: 0,
            avgDealSize: 0,
            conversionRate: 0,
          };
        }

        acc[rep].totalCalls += report.callsLogged || 0;
        acc[rep].totalEmails += report.emailsSent || 0;
        acc[rep].totalMeetings += report.meetingsHeld || 0;
        acc[rep].totalDemos += report.demosCompleted || 0;
        acc[rep].totalActivities += report.totalActivities || 0;
        acc[rep].leadsGenerated += report.leadsGenerated || 0;
        acc[rep].opportunitiesCreated += report.opportunitiesCreated || 0;
        acc[rep].dealsWon += report.dealsWon || 0;
        acc[rep].revenueGenerated += parseFloat(report.revenueGenerated || '0');

        return acc;
      },
      {} as Record<string, any>,
    );

    // Calculate derived metrics
    Object.values(repMetrics).forEach((metrics: any) => {
      metrics.avgDealSize = metrics.dealsWon > 0 ? metrics.revenueGenerated / metrics.dealsWon : 0;
      metrics.conversionRate =
        metrics.leadsGenerated > 0 ? (metrics.dealsWon / metrics.leadsGenerated) * 100 : 0;
    });

    // Get top performers
    const sortedReps = Object.values(repMetrics).sort(
      (a: any, b: any) => b.revenueGenerated - a.revenueGenerated,
    );

    // Calculate team totals
    const teamTotals = {
      totalCalls: sortedReps.reduce((sum: number, r: any) => sum + r.totalCalls, 0),
      totalEmails: sortedReps.reduce((sum: number, r: any) => sum + r.totalEmails, 0),
      totalMeetings: sortedReps.reduce((sum: number, r: any) => sum + r.totalMeetings, 0),
      totalDemos: sortedReps.reduce((sum: number, r: any) => sum + r.totalDemos, 0),
      totalActivities: sortedReps.reduce((sum: number, r: any) => sum + r.totalActivities, 0),
      leadsGenerated: sortedReps.reduce((sum: number, r: any) => sum + r.leadsGenerated, 0),
      opportunitiesCreated: sortedReps.reduce(
        (sum: number, r: any) => sum + r.opportunitiesCreated,
        0,
      ),
      dealsWon: sortedReps.reduce((sum: number, r: any) => sum + r.dealsWon, 0),
      revenueGenerated: sortedReps.reduce((sum: number, r: any) => sum + r.revenueGenerated, 0),
    };

    res.json({
      repPerformance: sortedReps,
      teamTotals,
      dateRange: {
        start: startDate || 'all',
        end: endDate || 'all',
      },
    });
  } catch (error) {
    console.error('Error calculating sales performance:', error);
    res.status(500).json({ message: 'Failed to calculate sales performance' });
  }
});

/**
 * GET /api/platform-analytics/pipeline-forecast
 * Get revenue forecast based on current pipeline
 */
router.get('/pipeline-forecast', async (req, res) => {
  try {
    const { months = 3 } = req.query;

    // Get all open deals
    const openDeals = await db.query.platformDeals.findMany({
      where: inArray(platformDeals.stage, [
        'prospecting',
        'qualification',
        'proposal',
        'negotiation',
      ]),
    });

    // Group by expected close date and calculate weighted pipeline
    const forecastByMonth: Record<string, any> = {};

    openDeals.forEach((deal) => {
      const closeDate = deal.expectedCloseDate
        ? new Date(deal.expectedCloseDate)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days

      const monthKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, '0')}`;

      if (!forecastByMonth[monthKey]) {
        forecastByMonth[monthKey] = {
          month: monthKey,
          totalPipeline: 0,
          weightedPipeline: 0,
          dealCount: 0,
          deals: [],
        };
      }

      const dealValue = parseFloat(deal.dealValue || '0');
      const probability = deal.probability || 0;
      const weightedValue = (dealValue * probability) / 100;

      forecastByMonth[monthKey].totalPipeline += dealValue;
      forecastByMonth[monthKey].weightedPipeline += weightedValue;
      forecastByMonth[monthKey].dealCount += 1;
      forecastByMonth[monthKey].deals.push({
        id: deal.id,
        dealName: deal.dealName,
        dealValue,
        probability,
        weightedValue,
        stage: deal.stage,
      });
    });

    // Sort by month
    const sortedForecast = Object.values(forecastByMonth).sort((a: any, b: any) =>
      a.month.localeCompare(b.month),
    );

    // Calculate totals
    const totals = {
      totalPipeline: sortedForecast.reduce((sum: number, f: any) => sum + f.totalPipeline, 0),
      weightedPipeline: sortedForecast.reduce((sum: number, f: any) => sum + f.weightedPipeline, 0),
      totalDeals: sortedForecast.reduce((sum: number, f: any) => sum + f.dealCount, 0),
    };

    res.json({
      forecast: sortedForecast.slice(0, parseInt(months as string)),
      totals,
      forecastPeriod: `${months} months`,
    });
  } catch (error) {
    console.error('Error calculating pipeline forecast:', error);
    res.status(500).json({ message: 'Failed to calculate pipeline forecast' });
  }
});

/**
 * GET /api/platform-analytics/churn-analysis
 * Get churn trends and analysis
 */
router.get('/churn-analysis', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereConditions = [];
    if (startDate) {
      whereConditions.push(
        gte(platformChurnPredictions.predictedAt, new Date(startDate as string)),
      );
    }
    if (endDate) {
      whereConditions.push(lte(platformChurnPredictions.predictedAt, new Date(endDate as string)));
    }

    const predictions = await db.query.platformChurnPredictions.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: [desc(platformChurnPredictions.predictedAt)],
      limit: 1000,
    });

    // Group by risk level
    const byRiskLevel = predictions.reduce(
      (acc, pred) => {
        const risk = pred.churnRiskLevel || 'unknown';
        if (!acc[risk]) {
          acc[risk] = { count: 0, totalProbability: 0, totalRevenue: 0 };
        }
        acc[risk].count += 1;
        acc[risk].totalProbability += parseFloat(pred.churnProbability || '0');
        acc[risk].totalRevenue += parseFloat(pred.estimatedRevenueImpact || '0');
        return acc;
      },
      {} as Record<string, any>,
    );

    // Calculate averages
    Object.values(byRiskLevel).forEach((level: any) => {
      level.avgProbability = level.count > 0 ? level.totalProbability / level.count : 0;
      level.avgRevenueImpact = level.count > 0 ? level.totalRevenue / level.count : 0;
    });

    // Get actual churn count
    const churnedTenants = await db.query.platformBusinessRecords.findMany({
      where: and(
        eq(platformBusinessRecords.status, 'churned'),
        ...whereConditions.map((c) => {
          if ('column' in c && c.column === platformChurnPredictions.predictedAt) {
            return gte(platformBusinessRecords.churnedAt, (c as any).value);
          }
          return c;
        }),
      ),
    });

    const churnedRevenue =
      churnedTenants.reduce((sum, t) => sum + parseFloat(t.currentMRR || '0'), 0) * 12; // Annualized

    res.json({
      predictions: {
        total: predictions.length,
        byRiskLevel,
        highRiskCount: byRiskLevel.high?.count || 0,
        mediumRiskCount: byRiskLevel.medium?.count || 0,
        lowRiskCount: byRiskLevel.low?.count || 0,
      },
      actual: {
        churnedCount: churnedTenants.length,
        churnedRevenue: churnedRevenue.toFixed(2),
      },
      dateRange: {
        start: startDate || 'all',
        end: endDate || 'all',
      },
    });
  } catch (error) {
    console.error('Error analyzing churn:', error);
    res.status(500).json({ message: 'Failed to analyze churn' });
  }
});

/**
 * GET /api/platform-analytics/activity-trends
 * Get activity volume trends over time
 */
router.get('/activity-trends', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const whereConditions = [];
    if (startDate) {
      whereConditions.push(gte(platformActivities.activityDate, new Date(startDate as string)));
    }
    if (endDate) {
      whereConditions.push(lte(platformActivities.activityDate, new Date(endDate as string)));
    }

    const activities = await db.query.platformActivities.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: [desc(platformActivities.activityDate)],
    });

    // Group by date and activity type
    const trends: Record<string, any> = {};

    activities.forEach((activity) => {
      const date = new Date(activity.activityDate);
      let dateKey: string;

      if (groupBy === 'day') {
        dateKey = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        dateKey = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        dateKey = date.toISOString().split('T')[0];
      }

      if (!trends[dateKey]) {
        trends[dateKey] = {
          date: dateKey,
          call: 0,
          email: 0,
          meeting: 0,
          demo: 0,
          proposal: 0,
          task: 0,
          note: 0,
          total: 0,
        };
      }

      const activityType = activity.activityType || 'note';
      trends[dateKey][activityType] = (trends[dateKey][activityType] || 0) + 1;
      trends[dateKey].total += 1;
    });

    // Convert to array and sort
    const sortedTrends = Object.values(trends).sort((a: any, b: any) =>
      a.date.localeCompare(b.date),
    );

    // Calculate totals
    const totals = {
      call: activities.filter((a) => a.activityType === 'call').length,
      email: activities.filter((a) => a.activityType === 'email').length,
      meeting: activities.filter((a) => a.activityType === 'meeting').length,
      demo: activities.filter((a) => a.activityType === 'demo').length,
      proposal: activities.filter((a) => a.activityType === 'proposal').length,
      task: activities.filter((a) => a.activityType === 'task').length,
      note: activities.filter((a) => a.activityType === 'note').length,
      total: activities.length,
    };

    res.json({
      trends: sortedTrends,
      totals,
      groupBy,
      dateRange: {
        start: startDate || 'all',
        end: endDate || 'all',
      },
    });
  } catch (error) {
    console.error('Error calculating activity trends:', error);
    res.status(500).json({ message: 'Failed to calculate activity trends' });
  }
});

/**
 * GET /api/platform-analytics/goals-tracking
 * Get sales goals vs actuals tracking
 */
router.get('/goals-tracking', async (req, res) => {
  try {
    const { repId, startDate, endDate } = req.query;

    const whereConditions = [];
    if (repId) {
      whereConditions.push(eq(platformSalesGoals.repId, repId as string));
    }
    if (startDate) {
      whereConditions.push(gte(platformSalesGoals.periodStart, new Date(startDate as string)));
    }
    if (endDate) {
      whereConditions.push(lte(platformSalesGoals.periodEnd, new Date(endDate as string)));
    }

    const goals = await db.query.platformSalesGoals.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: [desc(platformSalesGoals.periodStart)],
    });

    // Calculate attainment for each goal
    const goalsWithAttainment = goals.map((goal) => {
      const revenueAttainment =
        goal.revenueTarget && parseFloat(goal.revenueTarget) > 0
          ? (parseFloat(goal.actualRevenue || '0') / parseFloat(goal.revenueTarget)) * 100
          : 0;

      const dealsAttainment =
        goal.dealsTarget && goal.dealsTarget > 0
          ? ((goal.actualDeals || 0) / goal.dealsTarget) * 100
          : 0;

      const activitiesAttainment =
        goal.activitiesTarget && goal.activitiesTarget > 0
          ? ((goal.actualActivities || 0) / goal.activitiesTarget) * 100
          : 0;

      const overallAttainment = (revenueAttainment + dealsAttainment + activitiesAttainment) / 3;

      return {
        ...goal,
        attainment: {
          revenue: revenueAttainment.toFixed(2),
          deals: dealsAttainment.toFixed(2),
          activities: activitiesAttainment.toFixed(2),
          overall: overallAttainment.toFixed(2),
        },
        gaps: {
          revenue: (
            parseFloat(goal.revenueTarget || '0') - parseFloat(goal.actualRevenue || '0')
          ).toFixed(2),
          deals: (goal.dealsTarget || 0) - (goal.actualDeals || 0),
          activities: (goal.activitiesTarget || 0) - (goal.actualActivities || 0),
        },
      };
    });

    // Calculate team summary
    const teamSummary = {
      totalRevenueTarget: goals.reduce((sum, g) => sum + parseFloat(g.revenueTarget || '0'), 0),
      totalRevenueActual: goals.reduce((sum, g) => sum + parseFloat(g.actualRevenue || '0'), 0),
      totalDealsTarget: goals.reduce((sum, g) => sum + (g.dealsTarget || 0), 0),
      totalDealsActual: goals.reduce((sum, g) => sum + (g.actualDeals || 0), 0),
      goalsOnTrack: goalsWithAttainment.filter((g: any) => parseFloat(g.attainment.overall) >= 90)
        .length,
      goalsAtRisk: goalsWithAttainment.filter((g: any) => parseFloat(g.attainment.overall) < 70)
        .length,
    };

    res.json({
      goals: goalsWithAttainment,
      teamSummary,
      dateRange: {
        start: startDate || 'all',
        end: endDate || 'all',
      },
    });
  } catch (error) {
    console.error('Error tracking goals:', error);
    res.status(500).json({ message: 'Failed to track goals' });
  }
});

/**
 * GET /api/platform-analytics/health-trends
 * Get customer health score trends over time
 */
router.get('/health-trends', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereConditions = [];
    if (startDate) {
      whereConditions.push(gte(platformHealthScores.calculatedAt, new Date(startDate as string)));
    }
    if (endDate) {
      whereConditions.push(lte(platformHealthScores.calculatedAt, new Date(endDate as string)));
    }

    const healthScores = await db.query.platformHealthScores.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: [desc(platformHealthScores.calculatedAt)],
    });

    // Group by health status
    const byStatus = healthScores.reduce(
      (acc, score) => {
        const status = score.healthStatus || 'unknown';
        if (!acc[status]) {
          acc[status] = { count: 0, totalScore: 0, totalRevenue: 0 };
        }
        acc[status].count += 1;
        acc[status].totalScore += score.overallScore || 0;

        // Get revenue from business record (would need join in real implementation)
        return acc;
      },
      {} as Record<string, any>,
    );

    // Calculate averages
    Object.values(byStatus).forEach((status: any) => {
      status.avgScore = status.count > 0 ? status.totalScore / status.count : 0;
    });

    // Calculate trend (comparing first half vs second half of period)
    const midpoint = Math.floor(healthScores.length / 2);
    const firstHalf = healthScores.slice(midpoint);
    const secondHalf = healthScores.slice(0, midpoint);

    const avgFirst =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, s) => sum + (s.overallScore || 0), 0) / firstHalf.length
        : 0;
    const avgSecond =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, s) => sum + (s.overallScore || 0), 0) / secondHalf.length
        : 0;

    const trend = avgSecond - avgFirst;
    const trendDirection = trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable';

    res.json({
      byStatus,
      trend: {
        direction: trendDirection,
        change: trend.toFixed(2),
        avgFirst: avgFirst.toFixed(2),
        avgSecond: avgSecond.toFixed(2),
      },
      summary: {
        total: healthScores.length,
        healthy: byStatus.healthy?.count || 0,
        at_risk: byStatus.at_risk?.count || 0,
        critical: byStatus.critical?.count || 0,
      },
      dateRange: {
        start: startDate || 'all',
        end: endDate || 'all',
      },
    });
  } catch (error) {
    console.error('Error calculating health trends:', error);
    res.status(500).json({ message: 'Failed to calculate health trends' });
  }
});

export default router;
