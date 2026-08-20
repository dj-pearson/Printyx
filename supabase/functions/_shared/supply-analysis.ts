/**
 * Supply depletion analysis, shared shape (EDGE-002g).
 *
 * /api/auto-supply-replenishment/analyze-all runs on Express in dev and on the
 * auto-supply-replenishment edge function in production. Both need the same
 * prompt and — more importantly — the same DETERMINISTIC fallback, which is
 * what actually runs whenever the model call fails or no API key is configured.
 *
 * Node and Deno cannot import each other, so the logic lives here and
 * server/services/auto-supply-replenishment-service.ts exposes the same
 * functions. server/tests/unit/supply-analysis-parity.test.ts imports both and
 * asserts identical output, so a change landing in only one file fails.
 *
 * Pure by design — no Deno or Node APIs — which is what lets vitest import it.
 */

export type SupplyPriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';

/** The supply_monitoring fields the analysis reads, in camelCase. */
export interface SupplyAnalysisInput {
  supplyType?: string | null;
  supplyName?: string | null;
  currentLevel?: number | null;
  capacityPages?: number | null;
  model?: string | null;
  location?: string | null;
  dailyUsageAverage?: string | number | null;
  weeklyUsageAverage?: string | number | null;
  monthlyUsageAverage?: string | number | null;
  usageTrend?: string | null;
  reorderThreshold?: number | null;
}

/** One supply_usage_history row, in camelCase. */
export interface SupplyUsageReading {
  dateRecorded: string | Date;
  pagesSinceLastReading?: number | null;
}

export interface SupplyAnalysisResult {
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
  priority: SupplyPriority;
}

/**
 * Average daily usage across the reading history.
 *
 * History is expected newest-first, matching the service's
 * `orderBy: [desc(dateRecorded)]`.
 */
export function calculateAverageUsage(history: SupplyUsageReading[]): number {
  if (history.length < 2) return 0;

  const validReadings = history.filter((h) => (h.pagesSinceLastReading ?? 0) > 0);
  if (validReadings.length === 0) return 0;

  const totalPages = validReadings.reduce((sum, h) => sum + (h.pagesSinceLastReading ?? 0), 0);
  const daysCovered = Math.ceil(
    (new Date(history[0].dateRecorded).getTime() -
      new Date(history[history.length - 1].dateRecorded).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return daysCovered > 0 ? totalPages / daysCovered : 0;
}

/** Days-to-depletion mapped onto the order priority band. */
export function supplyPriorityFor(daysUntilDepletion: number | null): SupplyPriority {
  if (daysUntilDepletion === null) return 'low';
  if (daysUntilDepletion <= 3) return 'critical';
  if (daysUntilDepletion <= 7) return 'urgent';
  if (daysUntilDepletion <= 14) return 'high';
  if (daysUntilDepletion <= 30) return 'medium';
  return 'low';
}

/** The analysis prompt. Kept identical on both sides so results do not drift. */
export function buildSupplyAnalysisPrompt(
  supply: SupplyAnalysisInput,
  usageHistory: SupplyUsageReading[],
  now: number,
): string {
  const daysCovered =
    usageHistory.length > 0
      ? Math.ceil(
          (now - new Date(usageHistory[usageHistory.length - 1].dateRecorded).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  return `Analyze this copier/printer supply status and provide predictions:

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

Historical Data Points: ${usageHistory.length} readings over ${daysCovered} days

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
}

/**
 * Deterministic analysis used whenever the model call is unavailable or fails.
 *
 * With no CLAUDE_API_KEY configured this is the only path that ever runs, so
 * these numbers are the ones that drive ordering.
 *
 * `now` is passed in rather than read from the clock so the result is a pure
 * function of its inputs and can be asserted in a test.
 */
export function heuristicSupplyAnalysis(
  supply: SupplyAnalysisInput,
  dailyUsage: number,
  now: number,
): SupplyAnalysisResult {
  const currentLevel = supply.currentLevel ?? 0;

  let depletionDate: Date | null = null;
  let daysUntilDepletion: number | null = null;

  if (dailyUsage > 0 && currentLevel > 0 && supply.capacityPages) {
    const pagesRemaining = (supply.capacityPages * currentLevel) / 100;
    daysUntilDepletion = Math.ceil(pagesRemaining / dailyUsage);
    depletionDate = new Date(now + daysUntilDepletion * 24 * 60 * 60 * 1000);
  }

  const priority = supplyPriorityFor(daysUntilDepletion);
  const shouldOrder = currentLevel <= (supply.reorderThreshold || 20);

  return {
    currentLevel,
    predictedDepletionDate: depletionDate,
    daysUntilDepletion,
    confidenceScore: 60,
    aiAnalysis: {
      summary: 'Automatic analysis based on usage patterns',
      usagePattern: supply.usageTrend || 'stable',
      riskLevel: priority === 'critical' || priority === 'urgent' ? 'high' : 'medium',
      recommendation: shouldOrder ? 'order_now' : 'monitor',
      factors: ['Current level', 'Usage trend', 'Historical data'],
    },
    shouldOrder,
    priority,
  };
}
