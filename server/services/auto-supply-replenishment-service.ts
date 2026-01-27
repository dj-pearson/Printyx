import { db } from '../db';
import { eq, and, lt, gte, desc, sql } from 'drizzle-orm';
import {
  supplyMonitoring,
  autoSupplyOrders,
  supplyUsageHistory,
  supplyReplenishmentRules,
  supplyReplenishmentAnalytics,
} from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Auto-Supply Replenishment Service
 *
 * AI-powered supply monitoring and automated ordering system
 */

interface SupplyAnalysisResult {
  currentLevel: number;
  predictedDepletionDate: Date | null;
  daysUntilDepletion: number | null;
  confidenceScore: number;
  aiAnalysis: {
    summary: string;
    usagePattern: string;
    riskLevel: string;
    recommendation: string;
    factors: string[];
  };
  shouldOrder: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
}

interface DashboardMetrics {
  devicesMonitored: number;
  suppliesTracked: number;
  lowSupplies: number;
  urgentOrders: number;
  ordersThisMonth: number;
  projectedSavings: number;
  emergenciesPrevented: number;
  averageLeadTime: number;
}

/**
 * Analyze supply level and predict depletion using AI
 */
export async function analyzeSupplyLevel(
  tenantId: number,
  supplyMonitoringId: number,
): Promise<SupplyAnalysisResult> {
  // Get supply monitoring record
  const supply = await db.query.supplyMonitoring.findFirst({
    where: and(
      eq(supplyMonitoring.id, supplyMonitoringId),
      eq(supplyMonitoring.tenantId, tenantId),
    ),
  });

  if (!supply) {
    throw new Error('Supply monitoring record not found');
  }

  // Get usage history for AI analysis
  const usageHistory = await db.query.supplyUsageHistory.findMany({
    where: and(
      eq(supplyUsageHistory.supplyMonitoringId, supplyMonitoringId),
      eq(supplyUsageHistory.tenantId, tenantId),
    ),
    orderBy: [desc(supplyUsageHistory.dateRecorded)],
    limit: 90, // Last 90 days
  });

  // Calculate usage trends
  const dailyUsage = supply.dailyUsageAverage
    ? parseFloat(supply.dailyUsageAverage.toString())
    : calculateAverageUsage(usageHistory);

  // Prepare data for AI analysis
  const analysisPrompt = `Analyze this copier/printer supply status and provide predictions:

Supply Information:
- Type: ${supply.supplyType}
- Name: ${supply.supplyName}
- Current Level: ${supply.currentLevel}%
- Capacity: ${supply.capacityPages || 'Unknown'} pages
- Model: ${supply.model}
- Location: ${supply.location || 'Unknown'}

Usage Data:
- Daily Average: ${supply.dailyUsageAverage || 'N/A'} pages
- Weekly Average: ${supply.weeklyUsageAverage || 'N/A'} pages
- Monthly Average: ${supply.monthlyUsageAverage || 'N/A'} pages
- Usage Trend: ${supply.usageTrend || 'Unknown'}

Historical Data Points: ${usageHistory.length} readings over ${usageHistory.length > 0 ? Math.ceil((Date.now() - new Date(usageHistory[usageHistory.length - 1].dateRecorded).getTime()) / (1000 * 60 * 60 * 24)) : 0} days

Please analyze and provide:
1. Predicted depletion date (YYYY-MM-DD format or "Unable to predict")
2. Confidence score (0-100)
3. Usage pattern classification (stable/increasing/decreasing/erratic)
4. Risk level (low/medium/high/critical)
5. Specific recommendation (monitor/order_soon/order_now/urgent)
6. Key factors affecting prediction

Format your response as JSON:
{
  "depletionDate": "YYYY-MM-DD or null",
  "confidenceScore": 85,
  "usagePattern": "stable",
  "riskLevel": "medium",
  "recommendation": "order_soon",
  "summary": "Brief analysis summary",
  "factors": ["factor1", "factor2", "factor3"]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const aiResponse = JSON.parse(responseText);

    // Calculate depletion timing
    let depletionDate: Date | null = null;
    let daysUntilDepletion: number | null = null;

    if (aiResponse.depletionDate && aiResponse.depletionDate !== 'null') {
      depletionDate = new Date(aiResponse.depletionDate);
      daysUntilDepletion = Math.ceil(
        (depletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
    } else if (dailyUsage > 0 && supply.currentLevel > 0) {
      // Fallback calculation
      const pagesRemaining = supply.capacityPages
        ? (supply.capacityPages * supply.currentLevel) / 100
        : 0;

      if (pagesRemaining > 0) {
        daysUntilDepletion = Math.ceil(pagesRemaining / dailyUsage);
        depletionDate = new Date(Date.now() + daysUntilDepletion * 24 * 60 * 60 * 1000);
      }
    }

    // Determine priority based on days until depletion
    let priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical' = 'low';
    if (daysUntilDepletion !== null) {
      if (daysUntilDepletion <= 3) priority = 'critical';
      else if (daysUntilDepletion <= 7) priority = 'urgent';
      else if (daysUntilDepletion <= 14) priority = 'high';
      else if (daysUntilDepletion <= 30) priority = 'medium';
    }

    // Determine if order should be placed
    const shouldOrder =
      supply.currentLevel <= (supply.reorderThreshold || 20) ||
      aiResponse.recommendation === 'order_now' ||
      aiResponse.recommendation === 'urgent' ||
      priority === 'critical' ||
      priority === 'urgent';

    return {
      currentLevel: supply.currentLevel,
      predictedDepletionDate: depletionDate,
      daysUntilDepletion,
      confidenceScore: aiResponse.confidenceScore || 50,
      aiAnalysis: {
        summary: aiResponse.summary,
        usagePattern: aiResponse.usagePattern,
        riskLevel: aiResponse.riskLevel,
        recommendation: aiResponse.recommendation,
        factors: aiResponse.factors,
      },
      shouldOrder,
      priority,
    };
  } catch (error) {
    console.error('AI analysis error:', error);

    // Fallback to simple calculation
    let depletionDate: Date | null = null;
    let daysUntilDepletion: number | null = null;

    if (dailyUsage > 0 && supply.currentLevel > 0 && supply.capacityPages) {
      const pagesRemaining = (supply.capacityPages * supply.currentLevel) / 100;
      daysUntilDepletion = Math.ceil(pagesRemaining / dailyUsage);
      depletionDate = new Date(Date.now() + daysUntilDepletion * 24 * 60 * 60 * 1000);
    }

    let priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical' = 'low';
    if (daysUntilDepletion !== null) {
      if (daysUntilDepletion <= 3) priority = 'critical';
      else if (daysUntilDepletion <= 7) priority = 'urgent';
      else if (daysUntilDepletion <= 14) priority = 'high';
      else if (daysUntilDepletion <= 30) priority = 'medium';
    }

    return {
      currentLevel: supply.currentLevel,
      predictedDepletionDate: depletionDate,
      daysUntilDepletion,
      confidenceScore: 60,
      aiAnalysis: {
        summary: 'Automatic analysis based on usage patterns',
        usagePattern: supply.usageTrend || 'stable',
        riskLevel: priority === 'critical' || priority === 'urgent' ? 'high' : 'medium',
        recommendation:
          supply.currentLevel <= (supply.reorderThreshold || 20) ? 'order_now' : 'monitor',
        factors: ['Current level', 'Usage trend', 'Historical data'],
      },
      shouldOrder: supply.currentLevel <= (supply.reorderThreshold || 20),
      priority,
    };
  }
}

/**
 * Calculate average daily usage from history
 */
function calculateAverageUsage(history: any[]): number {
  if (history.length < 2) return 0;

  const validReadings = history.filter((h) => h.pagesSinceLastReading > 0);
  if (validReadings.length === 0) return 0;

  const totalPages = validReadings.reduce((sum, h) => sum + h.pagesSinceLastReading, 0);
  const daysCovered = Math.ceil(
    (new Date(history[0].dateRecorded).getTime() -
      new Date(history[history.length - 1].dateRecorded).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return daysCovered > 0 ? totalPages / daysCovered : 0;
}

/**
 * Create automatic supply order
 */
export async function createAutoSupplyOrder(
  tenantId: number,
  supplyMonitoringId: number,
  analysis: SupplyAnalysisResult,
): Promise<any> {
  const supply = await db.query.supplyMonitoring.findFirst({
    where: and(
      eq(supplyMonitoring.id, supplyMonitoringId),
      eq(supplyMonitoring.tenantId, tenantId),
    ),
  });

  if (!supply) {
    throw new Error('Supply not found');
  }

  // Check if auto-order is enabled
  if (!supply.autoOrderEnabled) {
    throw new Error('Auto-order is not enabled for this supply');
  }

  // Check if order already exists
  const existingOrder = await db.query.autoSupplyOrders.findFirst({
    where: and(
      eq(autoSupplyOrders.supplyMonitoringId, supplyMonitoringId),
      eq(autoSupplyOrders.tenantId, tenantId),
      sql`status IN ('order_placed', 'order_confirmed', 'in_transit')`,
    ),
  });

  if (existingOrder) {
    return existingOrder;
  }

  // Generate order number
  const orderNumber = `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Create order
  const [order] = await db
    .insert(autoSupplyOrders)
    .values({
      tenantId,
      supplyMonitoringId,
      equipmentId: supply.equipmentId,
      serialNumber: supply.serialNumber,
      orderNumber,
      supplyType: supply.supplyType,
      supplyName: supply.supplyName,
      partNumber: supply.partNumber || undefined,
      quantity: supply.reorderQuantity || 1,
      status: 'order_placed',
      priority: analysis.priority,
      triggeredBy: 'ai_prediction',
      preventedEmergency: analysis.priority === 'critical' || analysis.priority === 'urgent',
      orderDate: new Date(),
      // Estimate delivery based on lead time (default 3 days)
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    })
    .returning();

  // Update supply monitoring status
  await db
    .update(supplyMonitoring)
    .set({
      status: 'order_placed',
      lastOrderedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(supplyMonitoring.id, supplyMonitoringId), eq(supplyMonitoring.tenantId, tenantId)),
    );

  return order;
}

/**
 * Batch analyze all supplies for a tenant
 */
export async function analyzeTenantSupplies(tenantId: number): Promise<{
  analyzed: number;
  ordersCreated: number;
  results: any[];
}> {
  const supplies = await db.query.supplyMonitoring.findMany({
    where: and(eq(supplyMonitoring.tenantId, tenantId), eq(supplyMonitoring.status, 'monitoring')),
  });

  let ordersCreated = 0;
  const results = [];

  for (const supply of supplies) {
    try {
      const analysis = await analyzeSupplyLevel(tenantId, supply.id);

      // Update monitoring record with analysis
      await db
        .update(supplyMonitoring)
        .set({
          predictedDepletionDate: analysis.predictedDepletionDate || undefined,
          daysUntilDepletion: analysis.daysUntilDepletion || undefined,
          confidenceScore: analysis.confidenceScore,
          aiAnalysis: analysis.aiAnalysis as any,
          priority: analysis.priority,
          status: analysis.shouldOrder ? 'low' : 'monitoring',
          lastCheckedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(supplyMonitoring.id, supply.id));

      // Create order if recommended
      if (analysis.shouldOrder && supply.autoOrderEnabled) {
        await createAutoSupplyOrder(tenantId, supply.id, analysis);
        ordersCreated++;
      }

      results.push({
        supplyId: supply.id,
        serialNumber: supply.serialNumber,
        supplyName: supply.supplyName,
        analysis,
        orderCreated: analysis.shouldOrder,
      });
    } catch (error) {
      console.error(`Error analyzing supply ${supply.id}:`, error);
      results.push({
        supplyId: supply.id,
        serialNumber: supply.serialNumber,
        supplyName: supply.supplyName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    analyzed: supplies.length,
    ordersCreated,
    results,
  };
}

/**
 * Get dashboard metrics
 */
export async function getDashboardMetrics(tenantId: number): Promise<DashboardMetrics> {
  // Count devices and supplies
  const [devicesCount, suppliesCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${supplyMonitoring.equipmentId})` })
      .from(supplyMonitoring)
      .where(eq(supplyMonitoring.tenantId, tenantId))
      .then((res) => res[0]?.count || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(supplyMonitoring)
      .where(eq(supplyMonitoring.tenantId, tenantId))
      .then((res) => res[0]?.count || 0),
  ]);

  // Count low and urgent supplies
  const [lowSuppliesCount, urgentOrdersCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(supplyMonitoring)
      .where(and(eq(supplyMonitoring.tenantId, tenantId), lt(supplyMonitoring.currentLevel, 20)))
      .then((res) => res[0]?.count || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(autoSupplyOrders)
      .where(
        and(
          eq(autoSupplyOrders.tenantId, tenantId),
          sql`priority IN ('urgent', 'critical')`,
          sql`status IN ('order_placed', 'order_confirmed', 'in_transit')`,
        ),
      )
      .then((res) => res[0]?.count || 0),
  ]);

  // Count orders this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const ordersThisMonth = await db
    .select({ count: sql<number>`count(*)` })
    .from(autoSupplyOrders)
    .where(
      and(eq(autoSupplyOrders.tenantId, tenantId), gte(autoSupplyOrders.orderDate, startOfMonth)),
    )
    .then((res) => res[0]?.count || 0);

  // Get analytics for savings calculation
  const analytics = await db.query.supplyReplenishmentAnalytics.findFirst({
    where: and(
      eq(supplyReplenishmentAnalytics.tenantId, tenantId),
      eq(supplyReplenishmentAnalytics.periodType, 'monthly'),
    ),
    orderBy: [desc(supplyReplenishmentAnalytics.periodEnd)],
  });

  const projectedSavings = analytics?.emergencyCostSavings
    ? parseFloat(analytics.emergencyCostSavings.toString())
    : 0;

  const emergenciesPrevented = analytics?.emergencyOrdersPrevented || 0;

  const averageLeadTime = analytics?.averageLeadTime
    ? parseFloat(analytics.averageLeadTime.toString())
    : 3.0;

  return {
    devicesMonitored: devicesCount,
    suppliesTracked: suppliesCount,
    lowSupplies: lowSuppliesCount,
    urgentOrders: urgentOrdersCount,
    ordersThisMonth,
    projectedSavings,
    emergenciesPrevented,
    averageLeadTime,
  };
}

/**
 * Get low supply alerts
 */
export async function getLowSupplyAlerts(tenantId: number) {
  return db.query.supplyMonitoring.findMany({
    where: and(eq(supplyMonitoring.tenantId, tenantId), lt(supplyMonitoring.currentLevel, 20)),
    orderBy: [supplyMonitoring.currentLevel],
    limit: 50,
  });
}

/**
 * Get recent orders
 */
export async function getRecentOrders(tenantId: number, limit: number = 20) {
  return db.query.autoSupplyOrders.findMany({
    where: eq(autoSupplyOrders.tenantId, tenantId),
    orderBy: [desc(autoSupplyOrders.orderDate)],
    limit,
  });
}

/**
 * Get or create replenishment rules for tenant
 */
export async function getReplenishmentRules(tenantId: number) {
  let rules = await db.query.supplyReplenishmentRules.findFirst({
    where: eq(supplyReplenishmentRules.tenantId, tenantId),
  });

  if (!rules) {
    // Create default rules
    [rules] = await db
      .insert(supplyReplenishmentRules)
      .values({
        tenantId,
        // All defaults are set in schema
      })
      .returning();
  }

  return rules;
}

/**
 * Update replenishment rules
 */
export async function updateReplenishmentRules(
  tenantId: number,
  updates: Partial<typeof supplyReplenishmentRules.$inferInsert>,
) {
  const existing = await getReplenishmentRules(tenantId);

  const [updated] = await db
    .update(supplyReplenishmentRules)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(supplyReplenishmentRules.id, existing.id))
    .returning();

  return updated;
}
