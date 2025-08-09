import { Router } from 'express';

const analyticsRouter = Router();

// Phase 3: Analytics endpoints for conversion insights and trend widgets
analyticsRouter.get('/api/analytics/conversion-metrics/:dealId?', async (req, res) => {
  try {
    const tenantId = req.session?.tenantId;
    const conversionMetrics = {
      leadToQualifiedRate: 65,
      qualifiedToDemoRate: 45,
      demoToProposalRate: 72,
      proposalToClosedWonRate: 38,
      overallConversionRate: 8.2,
      averageSalesCycle: 45,
      topLossReasons: [
        { reason: 'Price too high', count: 15 },
        { reason: 'Competitor chosen', count: 12 },
        { reason: 'Budget not approved', count: 8 },
        { reason: 'Timeline mismatch', count: 6 },
      ],
      monthlyTrend: [
        { month: 'Aug', conversions: 12 },
        { month: 'Sep', conversions: 18 },
        { month: 'Oct', conversions: 15 },
        { month: 'Nov', conversions: 22 },
      ]
    };
    res.json(conversionMetrics);
  } catch (error) {
    console.error('Error fetching conversion metrics:', error);
    return res.status(500).json({ message: "Failed to fetch conversion metrics", error });
  }
});

analyticsRouter.get('/api/analytics/activity-nudges/:dealId?', async (req, res) => {
  try {
    const activityNudges = [
      {
        type: 'call',
        message: 'Follow up call overdue - last contact 5 days ago',
        priority: 'high',
        dueDate: '2025-01-10',
        dealId: 'deal-1',
        dealTitle: 'ABC Corporation - Equipment Upgrade'
      },
      {
        type: 'demo',
        message: 'Schedule demo to move deal forward',
        priority: 'medium',
        dueDate: '2025-01-12',
        dealId: 'deal-2',
        dealTitle: 'XYZ Industries - Color Printing Solution'
      },
      {
        type: 'proposal',
        message: 'Proposal due - customer expecting quote',
        priority: 'high',
        dueDate: '2025-01-11',
        dealId: 'deal-3',
        dealTitle: 'Tech Solutions Inc - Multi-function Devices'
      }
    ];
    res.json(activityNudges);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch activity nudges", error });
  }
});

analyticsRouter.get('/api/analytics/control-charts', async (req, res) => {
  try {
    const controlChartData = [
      { period: 'Week 1', value: 15, upperControlLimit: 25, lowerControlLimit: 5, centerLine: 15, isOutOfControl: false },
      { period: 'Week 2', value: 22, upperControlLimit: 25, lowerControlLimit: 5, centerLine: 15, isOutOfControl: false },
      { period: 'Week 3', value: 28, upperControlLimit: 25, lowerControlLimit: 5, centerLine: 15, isOutOfControl: true },
      { period: 'Week 4', value: 12, upperControlLimit: 25, lowerControlLimit: 5, centerLine: 15, isOutOfControl: false }
    ];
    res.json(controlChartData);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch control chart data", error });
  }
});

analyticsRouter.get('/api/analytics/trend-widgets', async (req, res) => {
  try {
    const trendWidgets = [
      { id: 'leads-generated', title: 'Leads Generated', currentValue: 42, previousValue: 38, trend: 'up', unit: 'leads', target: 50, criticalThreshold: 30 },
      { id: 'demos-scheduled', title: 'Demos Scheduled', currentValue: 18, previousValue: 22, trend: 'down', unit: 'demos', target: 25, criticalThreshold: 15 },
      { id: 'proposals-sent', title: 'Proposals Sent', currentValue: 12, previousValue: 12, trend: 'stable', unit: 'proposals', target: 15, criticalThreshold: 8 },
      { id: 'deals-closed', title: 'Deals Closed', currentValue: 8, previousValue: 6, trend: 'up', unit: 'deals', target: 10, criticalThreshold: 5 },
      { id: 'revenue-generated', title: 'Revenue Generated', currentValue: 145000, previousValue: 132000, trend: 'up', unit: '$', target: 200000, criticalThreshold: 100000 },
      { id: 'avg-deal-size', title: 'Avg Deal Size', currentValue: 18125, previousValue: 22000, trend: 'down', unit: '$', target: 25000, criticalThreshold: 15000 }
    ];
    res.json(trendWidgets);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch trend widgets", error });
  }
});

export { analyticsRouter };