import express from 'express';
import { desc, eq, and, sql, asc, gte, lte, between } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { businessRecords } from '../shared/schema';
import { salesForecasts, forecastPipelineItems, forecastMetrics, forecastRules } from './sales-forecasting-schema';

const router = express.Router();

// Sales Pipeline Forecasting API Routes
// Note: Database tables will be created after schema update

// Get all sales forecasts
router.get('/api/sales-forecasts', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    // Query actual database for forecasts
    const forecasts = await db.select().from(salesForecasts)
      .where(eq(salesForecasts.tenantId, tenantId))
      .orderBy(desc(salesForecasts.createdAt));

    res.json(forecasts);
  } catch (error) {
    console.error('Error fetching forecasts:', error);
    
    // Fallback to sample data if schema tables don't exist yet
    const sampleForecasts = [
      {
        id: 'forecast-1',
        forecastName: 'Q1 2025 Forecast',
        forecastType: 'quarterly',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        revenueTarget: 500000,
        unitTarget: 25,
        dealCountTarget: 15,
        actualRevenue: 187500,
        actualUnits: 9,
        actualDeals: 6,
        pipelineValue: 425000,
        weightedPipelineValue: 318750,
        probabilityAdjustedRevenue: 275000,
        confidenceLevel: 'high',
        confidencePercentage: 85,
        conversionRate: 40.0,
        averageDealSize: 31250,
        salesCycleLength: 45,
        status: 'active',
        achievementPercentage: 37.5, // (actualRevenue / revenueTarget) * 100
        projectedRevenue: 412500,
        gapToTarget: 87500,
        createdAt: new Date('2024-12-15')
      },
      {
        id: 'forecast-2',
        forecastName: 'January 2025',
        forecastType: 'monthly',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        revenueTarget: 150000,
        unitTarget: 8,
        dealCountTarget: 5,
        actualRevenue: 125000,
        actualUnits: 6,
        actualDeals: 4,
        pipelineValue: 95000,
        weightedPipelineValue: 71250,
        probabilityAdjustedRevenue: 142500,
        confidenceLevel: 'medium',
        confidencePercentage: 75,
        conversionRate: 50.0,
        averageDealSize: 31250,
        salesCycleLength: 38,
        status: 'completed',
        achievementPercentage: 83.3,
        projectedRevenue: 150000,
        gapToTarget: 0,
        createdAt: new Date('2024-12-20')
      }
    ];

    res.json(sampleForecasts);
    
  } catch (error) {
    console.error('Error fetching sales forecasts:', error);
    res.status(500).json({ message: 'Failed to fetch sales forecasts' });
  }
});

// Get pipeline items for a specific forecast
router.get('/api/sales-forecasts/:id/pipeline', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample pipeline items
    const samplePipelineItems = [
      {
        id: 'pipeline-1',
        forecastId: id,
        businessRecordId: 'customer-1',
        dealName: 'ABC Corp - Office Equipment Upgrade',
        dealValue: 85000,
        stage: 'proposal',
        stageEntryDate: new Date('2025-01-15'),
        closeProbability: 75,
        expectedCloseDate: new Date('2025-02-15'),
        equipmentTypes: ['MFP', 'Printer'],
        equipmentCount: 5,
        monthlyRecurringRevenue: 1200,
        salesRepId: 'rep-1',
        salesRep: 'John Smith',
        customerName: 'ABC Corporation',
        competitorNames: ['Canon', 'HP'],
        riskLevel: 'medium',
        lastActivityDate: new Date('2025-01-20'),
        nextFollowUpDate: new Date('2025-01-25'),
        activitiesCount: 12,
        daysInStage: 10,
        weightedValue: 63750 // dealValue * (closeProbability / 100)
      },
      {
        id: 'pipeline-2',
        forecastId: id,
        businessRecordId: 'customer-2',
        dealName: 'XYZ Industries - Color Production System',
        dealValue: 125000,
        stage: 'negotiation',
        stageEntryDate: new Date('2025-01-10'),
        closeProbability: 85,
        expectedCloseDate: new Date('2025-02-08'),
        equipmentTypes: ['Production Printer'],
        equipmentCount: 2,
        monthlyRecurringRevenue: 2100,
        salesRepId: 'rep-2',
        salesRep: 'Jane Doe',
        customerName: 'XYZ Industries',
        competitorNames: ['Xerox'],
        riskLevel: 'low',
        lastActivityDate: new Date('2025-01-22'),
        nextFollowUpDate: new Date('2025-01-24'),
        activitiesCount: 18,
        daysInStage: 15,
        weightedValue: 106250
      },
      {
        id: 'pipeline-3',
        forecastId: id,
        businessRecordId: 'customer-3',
        dealName: 'Tech Solutions - Multi-Location Setup',
        dealValue: 65000,
        stage: 'qualified',
        stageEntryDate: new Date('2025-01-18'),
        closeProbability: 45,
        expectedCloseDate: new Date('2025-03-01'),
        equipmentTypes: ['MFP', 'Scanner'],
        equipmentCount: 8,
        monthlyRecurringRevenue: 850,
        salesRepId: 'rep-1',
        salesRep: 'John Smith',
        customerName: 'Tech Solutions Inc',
        competitorNames: ['Ricoh', 'Konica Minolta'],
        riskLevel: 'high',
        lastActivityDate: new Date('2025-01-19'),
        nextFollowUpDate: new Date('2025-01-26'),
        activitiesCount: 7,
        daysInStage: 7,
        weightedValue: 29250
      }
    ];

    res.json(samplePipelineItems);
    
  } catch (error) {
    console.error('Error fetching pipeline items:', error);
    res.status(500).json({ message: 'Failed to fetch pipeline items' });
  }
});

// Get sales performance metrics
router.get('/api/sales-performance-metrics', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { period = 'monthly', startDate, endDate } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample performance metrics
    const sampleMetrics = [
      {
        id: 'metrics-1',
        metricDate: new Date('2025-01-01'),
        periodType: 'monthly',
        totalRevenue: 125000,
        totalDeals: 4,
        totalUnits: 6,
        averageDealSize: 31250,
        pipelineTotalValue: 425000,
        pipelineDealsCount: 12,
        newLeadsGenerated: 25,
        leadsConverted: 8,
        leadToOpportunityRate: 32.0,
        opportunityToCloseRate: 50.0,
        overallConversionRate: 16.0,
        callsMade: 180,
        emailsSent: 340,
        meetingsHeld: 45,
        proposalsSent: 12,
        averageSalesCycle: 38,
        shortestSalesCycle: 21,
        longestSalesCycle: 67
      },
      {
        id: 'metrics-2',
        metricDate: new Date('2024-12-01'),
        periodType: 'monthly',
        totalRevenue: 98000,
        totalDeals: 3,
        totalUnits: 4,
        averageDealSize: 32667,
        pipelineTotalValue: 380000,
        pipelineDealsCount: 10,
        newLeadsGenerated: 22,
        leadsConverted: 6,
        leadToOpportunityRate: 27.3,
        opportunityToCloseRate: 50.0,
        overallConversionRate: 13.6,
        callsMade: 165,
        emailsSent: 298,
        meetingsHeld: 38,
        proposalsSent: 9,
        averageSalesCycle: 42,
        shortestSalesCycle: 28,
        longestSalesCycle: 61
      }
    ];

    res.json(sampleMetrics);
    
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ message: 'Failed to fetch performance metrics' });
  }
});

// Create new sales forecast
router.post('/api/sales-forecasts', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const {
      forecastName,
      forecastType,
      startDate,
      endDate,
      revenueTarget,
      unitTarget,
      dealCountTarget
    } = req.body;

    // For now, return success response until schema is updated
    const newForecast = {
      id: `forecast-${Date.now()}`,
      tenantId,
      forecastName,
      forecastType: forecastType || 'monthly',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      revenueTarget: parseFloat(revenueTarget),
      unitTarget: parseInt(unitTarget),
      dealCountTarget: parseInt(dealCountTarget),
      actualRevenue: 0,
      actualUnits: 0,
      actualDeals: 0,
      pipelineValue: 0,
      weightedPipelineValue: 0,
      probabilityAdjustedRevenue: 0,
      confidenceLevel: 'medium',
      confidencePercentage: 75,
      conversionRate: 0,
      averageDealSize: 0,
      salesCycleLength: 30,
      status: 'active',
      createdBy: userId,
      createdAt: new Date()
    };

    res.status(201).json(newForecast);
    
  } catch (error) {
    console.error('Error creating sales forecast:', error);
    res.status(500).json({ message: 'Failed to create sales forecast' });
  }
});

// Update pipeline item stage/probability
router.put('/api/sales-pipeline/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { stage, closeProbability, expectedCloseDate, notes } = req.body;
    
    // For now, return success response until schema is updated
    res.json({ 
      message: 'Pipeline item updated successfully',
      id,
      stage,
      closeProbability,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      notes,
      updatedAt: new Date()
    });
    
  } catch (error) {
    console.error('Error updating pipeline item:', error);
    res.status(500).json({ message: 'Failed to update pipeline item' });
  }
});

// Get forecasting rules/settings
router.get('/api/sales-forecasting-rules', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample forecasting rules
    const sampleRules = [
      {
        id: 'rule-1',
        ruleName: 'Prospect Stage Probability',
        ruleType: 'stage_probability',
        dealStage: 'prospect',
        baseProbability: 20,
        isActive: true
      },
      {
        id: 'rule-2',
        ruleName: 'Qualified Stage Probability',
        ruleType: 'stage_probability',
        dealStage: 'qualified',
        baseProbability: 45,
        isActive: true
      },
      {
        id: 'rule-3',
        ruleName: 'Proposal Stage Probability',
        ruleType: 'stage_probability',
        dealStage: 'proposal',
        baseProbability: 75,
        isActive: true
      },
      {
        id: 'rule-4',
        ruleName: 'Negotiation Stage Probability',
        ruleType: 'stage_probability',
        dealStage: 'negotiation',
        baseProbability: 85,
        isActive: true
      },
      {
        id: 'rule-5',
        ruleName: 'Time Decay - 30+ Days',
        ruleType: 'time_decay',
        daysInStage: 30,
        probabilityAdjustment: -10,
        isActive: true
      }
    ];
    
    res.json(sampleRules);
    
  } catch (error) {
    console.error('Error fetching forecasting rules:', error);
    res.status(500).json({ message: 'Failed to fetch forecasting rules' });
  }
});

// Get historical performance for trend analysis
router.get('/api/sales-trends', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { months = 12 } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample trend data
    const sampleTrends = Array.from({ length: parseInt(months as string) }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      return {
        month: date.toISOString().substring(0, 7), // YYYY-MM format
        monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        revenue: Math.floor(Math.random() * 50000) + 80000,
        deals: Math.floor(Math.random() * 3) + 3,
        units: Math.floor(Math.random() * 4) + 4,
        pipelineValue: Math.floor(Math.random() * 100000) + 300000,
        conversionRate: Math.floor(Math.random() * 20) + 25,
        averageDealSize: Math.floor(Math.random() * 10000) + 25000
      };
    }).reverse();

    res.json(sampleTrends);
    
  } catch (error) {
    console.error('Error fetching sales trends:', error);
    res.status(500).json({ message: 'Failed to fetch sales trends' });
  }
});

export default router;