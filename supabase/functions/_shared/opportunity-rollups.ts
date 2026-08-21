// Opportunity rollups for the opportunities edge function (PROD-008b).
//
// PostgREST has no GROUP BY and no SUM, so /opportunities/dashboard and
// /opportunities/by-stage select the columns they need and fold them here.
// Pure and dependency-free so vitest can assert the arithmetic without a
// database or an edge runtime.
//
// MODEL NOTE: an opportunity IS a deal (docs/crm-canonical-model.md, CRMX-002).
// The retired Express copy of these two endpoints read business_records and
// counted a record as an opportunity only when `estimated_amount > 0 OR
// priority IN ('high','urgent')` - the test it used to separate an opportunity
// from a plain lead. That distinction does not exist on `deals`, where every
// row is already an opportunity, so every deal counts here and the amount and
// priority thresholds survive only as the sub-counts below.

export interface OpportunityRow {
  /** deals.amount - PostgREST returns numeric as a string. */
  amount?: string | number | null;
  priority?: string | null;
  status?: string | null;
  deal_stage?: { name?: string | null } | null;
}

export interface OpportunityDashboard {
  totalOpportunities: number;
  highValueOpportunities: number;
  urgentOpportunities: number;
  totalValue: number;
  averageValue: number;
}

export interface OpportunityStageRollup {
  stage: string;
  count: number;
  totalValue: number;
}

/** The dollar figure at or above which a deal counts as high value. */
export const HIGH_VALUE_THRESHOLD = 10000;

/** Non-finite, negative and unparseable amounts all read as 0. */
export function toAmount(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

export function dashboardRollup(rows: OpportunityRow[]): OpportunityDashboard {
  const totalOpportunities = rows.length;
  let highValueOpportunities = 0;
  let urgentOpportunities = 0;
  let totalValue = 0;

  for (const row of rows) {
    const amount = toAmount(row.amount);
    totalValue += amount;
    if (amount >= HIGH_VALUE_THRESHOLD) highValueOpportunities++;
    if ((row.priority ?? '').toLowerCase() === 'urgent') urgentOpportunities++;
  }

  // Rounded to cents: summing numeric-as-string amounts in float otherwise
  // surfaces 0.30000000000000004 in the payload.
  totalValue = Math.round(totalValue * 100) / 100;

  return {
    totalOpportunities,
    highValueOpportunities,
    urgentOpportunities,
    totalValue,
    averageValue:
      totalOpportunities > 0 ? Math.round((totalValue / totalOpportunities) * 100) / 100 : 0,
  };
}

/**
 * One row per stage, ordered by descending value so the biggest stage leads.
 * The stage name comes from the embedded deal_stages row; deals with no stage
 * fall back to `status`, then to 'unassigned' - never dropped, because a
 * missing stage is exactly what a pipeline-health view needs to show.
 */
export function byStageRollup(rows: OpportunityRow[]): OpportunityStageRollup[] {
  const byStage = new Map<string, OpportunityStageRollup>();

  for (const row of rows) {
    const stage = row.deal_stage?.name || row.status || 'unassigned';
    const entry = byStage.get(stage) ?? { stage, count: 0, totalValue: 0 };
    entry.count++;
    entry.totalValue += toAmount(row.amount);
    byStage.set(stage, entry);
  }

  return [...byStage.values()]
    .map((e) => ({ ...e, totalValue: Math.round(e.totalValue * 100) / 100 }))
    .sort((a, b) => b.totalValue - a.totalValue || a.stage.localeCompare(b.stage));
}
