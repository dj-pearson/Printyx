/**
 * BILLING ANALYTICS SERVICE
 *
 * Advanced analytics for billing operations including:
 * - Revenue forecasting
 * - Churn prediction
 * - Customer lifetime value (CLV)
 * - Payment behavior analysis
 * - Revenue trends and seasonality
 *
 * Uses statistical methods and simple ML techniques for predictions.
 */

import { db } from '../db';
import { eq, and, desc, sql, gte, lte, count, sum, avg } from 'drizzle-orm';
import { invoices, businessRecords, contracts, meterReadings, type Invoice } from '@shared/schema';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface RevenueForecast {
  period: string;
  forecastedRevenue: number;
  confidence: number; // 0-100
  upperBound: number;
  lowerBound: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonalityFactor: number;
}

export interface ChurnPrediction {
  customerId: string;
  customerName: string;
  churnRisk: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnFactor[];
  recommendations: string[];
  lastInvoiceDate: Date | null;
  totalRevenue: number;
}

export interface ChurnFactor {
  factor: string;
  impact: number; // -100 to 100 (negative = increases churn risk)
  description: string;
}

export interface CustomerLifetimeValue {
  customerId: string;
  customerName: string;
  historicalValue: number;
  predictedLifetimeValue: number;
  averageMonthlyRevenue: number;
  customerAge: number; // months
  retentionProbability: number;
}

export interface RevenueAnalysis {
  totalRevenue: number;
  averageInvoiceValue: number;
  revenueGrowthRate: number; // % change from previous period
  topCustomers: {
    customerId: string;
    customerName: string;
    revenue: number;
    percentOfTotal: number;
  }[];
  revenueByMonth: {
    month: string;
    revenue: number;
    invoiceCount: number;
  }[];
}

export interface PaymentBehaviorAnalysis {
  averageDaysToPayment: number;
  onTimePaymentRate: number; // %
  latePaymentRate: number; // %
  averageOverdueDays: number;
  defaultRate: number; // %
  paymentTrends: {
    month: string;
    onTimeRate: number;
    avgDaysToPayment: number;
  }[];
}

// =============================================================================
// BILLING ANALYTICS SERVICE CLASS
// =============================================================================

class BillingAnalyticsService {
  // ===========================================================================
  // REVENUE FORECASTING
  // ===========================================================================

  /**
   * Forecast revenue for upcoming periods using time series analysis
   */
  async forecastRevenue(tenantId: string, periodsAhead: number = 3): Promise<RevenueForecast[]> {
    try {
      // 1. Get historical revenue data (last 12 months)
      const historicalData = await this.getHistoricalRevenue(tenantId, 12);

      if (historicalData.length < 3) {
        throw new Error('Insufficient historical data for forecasting (need at least 3 months)');
      }

      // 2. Calculate trend using simple linear regression
      const trend = this.calculateLinearTrend(historicalData);

      // 3. Calculate seasonality factors
      const seasonality = this.calculateSeasonality(historicalData);

      // 4. Generate forecasts
      const forecasts: RevenueForecast[] = [];
      const lastMonth = new Date(historicalData[historicalData.length - 1].month);

      for (let i = 1; i <= periodsAhead; i++) {
        const forecastMonth = new Date(lastMonth);
        forecastMonth.setMonth(forecastMonth.getMonth() + i);

        const monthIndex = forecastMonth.getMonth();
        const seasonalFactor = seasonality[monthIndex] || 1.0;

        // Base forecast using trend
        const baseForecast = trend.intercept + trend.slope * (historicalData.length + i);

        // Apply seasonality
        const forecastedRevenue = Math.max(0, baseForecast * seasonalFactor);

        // Calculate confidence interval (95%)
        const standardError = this.calculateStandardError(historicalData, trend);
        const marginOfError = 1.96 * standardError;

        // Determine trend direction
        let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (trend.slope > 100) trendDirection = 'increasing';
        else if (trend.slope < -100) trendDirection = 'decreasing';

        forecasts.push({
          period: this.formatMonth(forecastMonth),
          forecastedRevenue: Math.round(forecastedRevenue),
          confidence: Math.min(100, Math.max(0, 100 - i * 10)), // Confidence decreases with time
          upperBound: Math.round(forecastedRevenue + marginOfError),
          lowerBound: Math.max(0, Math.round(forecastedRevenue - marginOfError)),
          trend: trendDirection,
          seasonalityFactor: seasonalFactor,
        });
      }

      return forecasts;
    } catch (error) {
      console.error('Error forecasting revenue:', error);
      throw error;
    }
  }

  /**
   * Get historical revenue by month
   */
  private async getHistoricalRevenue(
    tenantId: string,
    monthsBack: number,
  ): Promise<{ month: string; revenue: number }[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const results = await db
      .select({
        month: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.invoiceDate, startDate),
          sql`${invoices.invoiceStatus} IN ('paid', 'partial')`,
        ),
      )
      .groupBy(sql`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`);

    return results.map((r) => ({
      month: r.month,
      revenue: r.revenue || 0,
    }));
  }

  /**
   * Calculate linear trend using least squares regression
   */
  private calculateLinearTrend(data: { month: string; revenue: number }[]): {
    slope: number;
    intercept: number;
  } {
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    data.forEach((point, index) => {
      const x = index + 1; // Time periods (1, 2, 3, ...)
      const y = point.revenue;

      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Calculate seasonality factors (monthly multipliers)
   */
  private calculateSeasonality(data: { month: string; revenue: number }[]): Record<number, number> {
    // Group by month of year
    const monthlyRevenue: Record<number, number[]> = {};

    data.forEach((point) => {
      const date = new Date(point.month + '-01');
      const month = date.getMonth();

      if (!monthlyRevenue[month]) {
        monthlyRevenue[month] = [];
      }
      monthlyRevenue[month].push(point.revenue);
    });

    // Calculate average for each month
    const monthlyAverages: Record<number, number> = {};
    const overallAverage = data.reduce((sum, d) => sum + d.revenue, 0) / data.length;

    for (let month = 0; month < 12; month++) {
      if (monthlyRevenue[month] && monthlyRevenue[month].length > 0) {
        const avg =
          monthlyRevenue[month].reduce((sum, val) => sum + val, 0) / monthlyRevenue[month].length;
        monthlyAverages[month] = avg / overallAverage;
      } else {
        monthlyAverages[month] = 1.0;
      }
    }

    return monthlyAverages;
  }

  /**
   * Calculate standard error for confidence intervals
   */
  private calculateStandardError(
    data: { month: string; revenue: number }[],
    trend: { slope: number; intercept: number },
  ): number {
    const residuals = data.map((point, index) => {
      const predicted = trend.intercept + trend.slope * (index + 1);
      return point.revenue - predicted;
    });

    const sumSquaredResiduals = residuals.reduce((sum, r) => sum + r * r, 0);
    const variance = sumSquaredResiduals / (data.length - 2);

    return Math.sqrt(variance);
  }

  // ===========================================================================
  // CHURN PREDICTION
  // ===========================================================================

  /**
   * Predict customer churn risk based on multiple factors
   */
  async predictChurn(tenantId: string): Promise<ChurnPrediction[]> {
    try {
      // Get all active customers with their metrics
      const customers = await this.getCustomerMetrics(tenantId);

      const predictions: ChurnPrediction[] = [];

      for (const customer of customers) {
        const factors = await this.analyzeChurnFactors(customer, tenantId);

        // Calculate overall churn risk (weighted average of factors)
        const churnRisk = this.calculateChurnRisk(factors);

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (churnRisk >= 75) riskLevel = 'critical';
        else if (churnRisk >= 50) riskLevel = 'high';
        else if (churnRisk >= 25) riskLevel = 'medium';

        // Generate recommendations
        const recommendations = this.generateChurnRecommendations(factors, riskLevel);

        predictions.push({
          customerId: customer.id,
          customerName: customer.name,
          churnRisk: Math.round(churnRisk),
          riskLevel,
          factors,
          recommendations,
          lastInvoiceDate: customer.lastInvoiceDate,
          totalRevenue: customer.totalRevenue,
        });
      }

      // Sort by churn risk (highest first)
      return predictions.sort((a, b) => b.churnRisk - a.churnRisk);
    } catch (error) {
      console.error('Error predicting churn:', error);
      throw error;
    }
  }

  /**
   * Get customer metrics for churn analysis
   */
  private async getCustomerMetrics(tenantId: string) {
    const last90Days = new Date();
    last90Days.setDate(last90Days.getDate() - 90);

    const results = await db
      .select({
        id: businessRecords.id,
        name: businessRecords.companyName,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
        invoiceCount: count(invoices.id),
        lastInvoiceDate: sql<Date>`MAX(${invoices.invoiceDate})`,
        avgDaysToPayment: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paymentDate} - ${invoices.invoiceDate})))`,
        latePaymentCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.paymentDate} > ${invoices.dueDate})`,
      })
      .from(businessRecords)
      .leftJoin(invoices, eq(businessRecords.id, invoices.customerId))
      .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.status, 'active')))
      .groupBy(businessRecords.id, businessRecords.companyName);

    return results;
  }

  /**
   * Analyze churn factors for a customer
   */
  private async analyzeChurnFactors(customer: any, tenantId: string): Promise<ChurnFactor[]> {
    const factors: ChurnFactor[] = [];

    // Factor 1: Inactivity (no recent invoices)
    if (customer.lastInvoiceDate) {
      const daysSinceLastInvoice = Math.floor(
        (Date.now() - new Date(customer.lastInvoiceDate).getTime()) / (1000 * 60 * 60 * 24),
      );

      let inactivityImpact = 0;
      if (daysSinceLastInvoice > 90) inactivityImpact = -40;
      else if (daysSinceLastInvoice > 60) inactivityImpact = -25;
      else if (daysSinceLastInvoice > 30) inactivityImpact = -10;
      else inactivityImpact = 10;

      factors.push({
        factor: 'Recent Activity',
        impact: inactivityImpact,
        description: `Last invoice ${daysSinceLastInvoice} days ago`,
      });
    }

    // Factor 2: Payment behavior
    const latePaymentRate =
      customer.invoiceCount > 0 ? (customer.latePaymentCount / customer.invoiceCount) * 100 : 0;

    let paymentImpact = 10;
    if (latePaymentRate > 50) paymentImpact = -30;
    else if (latePaymentRate > 25) paymentImpact = -15;
    else if (latePaymentRate === 0) paymentImpact = 20;

    factors.push({
      factor: 'Payment Behavior',
      impact: paymentImpact,
      description: `${latePaymentRate.toFixed(0)}% late payments`,
    });

    // Factor 3: Revenue trend
    const revenueImpact =
      customer.totalRevenue > 10000 ? 15 : customer.totalRevenue > 1000 ? 5 : -10;

    factors.push({
      factor: 'Revenue Value',
      impact: revenueImpact,
      description: `Total revenue: $${customer.totalRevenue.toFixed(0)}`,
    });

    // Factor 4: Invoice frequency
    const invoiceFrequencyImpact =
      customer.invoiceCount >= 12
        ? 15
        : customer.invoiceCount >= 6
          ? 5
          : customer.invoiceCount >= 3
            ? 0
            : -20;

    factors.push({
      factor: 'Engagement Level',
      impact: invoiceFrequencyImpact,
      description: `${customer.invoiceCount} invoices`,
    });

    return factors;
  }

  /**
   * Calculate overall churn risk from factors
   */
  private calculateChurnRisk(factors: ChurnFactor[]): number {
    // Base churn risk is 50% (neutral)
    let risk = 50;

    // Adjust based on factors
    factors.forEach((factor) => {
      risk -= factor.impact; // Negative impact increases risk
    });

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, risk));
  }

  /**
   * Generate recommendations to reduce churn
   */
  private generateChurnRecommendations(factors: ChurnFactor[], riskLevel: string): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Schedule immediate check-in call with customer');
      recommendations.push('Review service quality and address any concerns');
    }

    // Check for inactivity
    const activityFactor = factors.find((f) => f.factor === 'Recent Activity');
    if (activityFactor && activityFactor.impact < 0) {
      recommendations.push('Re-engage customer with promotional offer or service review');
    }

    // Check payment issues
    const paymentFactor = factors.find((f) => f.factor === 'Payment Behavior');
    if (paymentFactor && paymentFactor.impact < 0) {
      recommendations.push('Discuss payment terms and offer flexible payment options');
    }

    // Check engagement
    const engagementFactor = factors.find((f) => f.factor === 'Engagement Level');
    if (engagementFactor && engagementFactor.impact < 0) {
      recommendations.push('Increase touchpoints and provide value-added services');
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain current service level and continue regular check-ins');
    }

    return recommendations;
  }

  // ===========================================================================
  // CUSTOMER LIFETIME VALUE
  // ===========================================================================

  /**
   * Calculate customer lifetime value
   */
  async calculateLifetimeValue(
    tenantId: string,
    customerId?: string,
  ): Promise<CustomerLifetimeValue[]> {
    try {
      // Build query conditions
      const conditions = [eq(businessRecords.tenantId, tenantId)];
      if (customerId) {
        conditions.push(eq(businessRecords.id, customerId));
      }

      const customers = await db
        .select({
          id: businessRecords.id,
          name: businessRecords.companyName,
          createdAt: businessRecords.createdAt,
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DECIMAL)), 0)`,
          invoiceCount: count(invoices.id),
          firstInvoiceDate: sql<Date>`MIN(${invoices.invoiceDate})`,
          lastInvoiceDate: sql<Date>`MAX(${invoices.invoiceDate})`,
        })
        .from(businessRecords)
        .leftJoin(invoices, eq(businessRecords.id, invoices.customerId))
        .where(and(...conditions))
        .groupBy(businessRecords.id, businessRecords.companyName, businessRecords.createdAt);

      const lifetimeValues: CustomerLifetimeValue[] = [];

      for (const customer of customers) {
        // Calculate customer age in months
        const firstDate = customer.firstInvoiceDate || customer.createdAt;
        const customerAge = Math.max(1, this.monthsDiff(new Date(firstDate), new Date()));

        // Calculate average monthly revenue
        const averageMonthlyRevenue = (customer.totalRevenue || 0) / customerAge;

        // Simple retention probability (based on recent activity)
        const daysSinceLastInvoice = customer.lastInvoiceDate
          ? Math.floor(
              (Date.now() - new Date(customer.lastInvoiceDate).getTime()) / (1000 * 60 * 60 * 24),
            )
          : 999;

        let retentionProbability = 0.95;
        if (daysSinceLastInvoice > 180) retentionProbability = 0.1;
        else if (daysSinceLastInvoice > 90) retentionProbability = 0.5;
        else if (daysSinceLastInvoice > 60) retentionProbability = 0.75;
        else if (daysSinceLastInvoice > 30) retentionProbability = 0.85;

        // Predicted lifetime value = avg monthly revenue × expected remaining months
        // Expected remaining months = average customer lifespan × retention probability
        const expectedLifetimeMonths = 36; // Assume 3-year average lifespan
        const expectedRemainingMonths =
          (expectedLifetimeMonths - customerAge) * retentionProbability;
        const predictedLifetimeValue =
          (customer.totalRevenue || 0) + averageMonthlyRevenue * expectedRemainingMonths;

        lifetimeValues.push({
          customerId: customer.id,
          customerName: customer.name || 'Unknown',
          historicalValue: customer.totalRevenue || 0,
          predictedLifetimeValue,
          averageMonthlyRevenue,
          customerAge,
          retentionProbability,
        });
      }

      // Sort by predicted lifetime value (highest first)
      return lifetimeValues.sort((a, b) => b.predictedLifetimeValue - a.predictedLifetimeValue);
    } catch (error) {
      console.error('Error calculating lifetime value:', error);
      throw error;
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Format month for display
   */
  private formatMonth(date: Date): string {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  /**
   * Calculate months difference between two dates
   */
  private monthsDiff(start: Date, end: Date): number {
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }
}

// Export singleton instance
export const billingAnalytics = new BillingAnalyticsService();
export { BillingAnalyticsService };
