/**
 * The Customer Success page's view of `customer_health_scores`.
 *
 * The page was written against a mock shape - nested `metrics`,
 * `scoreBreakdown`, `trends`, `alerts`, dollar-valued `opportunities`, an
 * account manager, a contract value, a churn probability - that no column
 * holds. Against the real rows (customer-success edge function, GET
 * /health-scores) it read `score.metrics.satisfactionScore.toFixed(1)` on
 * undefined, so any tenant with a single scored customer got a crashed page.
 *
 * Every field here is a column or is derived from one:
 * - the five factor scores are the table's own usage/engagement/support/
 *   payment/satisfaction columns;
 * - risk factors, strengths and recommendations are its text[] columns;
 * - one row per customer: the endpoint returns score HISTORY ordered newest
 *   first, and listing every historical row as its own customer card double-
 *   counts that customer in every total on the page.
 *
 * What the old shape claimed and nothing measures (contract value, months
 * remaining, churn probability, account manager, opportunity values) is not
 * rendered at all.
 */

export const AT_RISK_HEALTH_STATUSES = ['at_risk', 'critical', 'poor'] as const;

export interface CustomerHealthRow {
  id?: string;
  customer_id: string;
  /** Resolved by the endpoint from business_records.company_name. */
  customer_name?: string | null;
  overall_score: number | string | null;
  health_status: string | null;
  trend: string | null;
  usage_score: number | null;
  engagement_score: number | null;
  support_score: number | null;
  payment_score: number | null;
  satisfaction_score: number | null;
  days_since_last_service: number | null;
  open_tickets_count: number | null;
  overdue_invoices_count: number | null;
  nps_score: number | null;
  csat: number | string | null;
  risk_factors: string[] | null;
  strength_factors: string[] | null;
  recommendations: string[] | null;
  calculated_at: string;
  next_calculation_due: string | null;
}

export interface CustomerHealthView {
  customerId: string;
  customerName: string;
  overallScore: number | null;
  healthStatus: string;
  trend: string | null;
  atRisk: boolean;
  factors: { label: string; score: number | null }[];
  signals: {
    daysSinceLastService: number | null;
    openTickets: number | null;
    overdueInvoices: number | null;
    nps: number | null;
    csat: number | null;
  };
  riskFactors: string[];
  strengths: string[];
  recommendations: string[];
  calculatedAt: string;
  nextCalculationDue: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function toHealthViews(
  rows: readonly CustomerHealthRow[] | null | undefined,
): CustomerHealthView[] {
  const latest = new Map<string, CustomerHealthRow>();
  for (const row of rows ?? []) {
    if (!row?.customer_id) continue;
    const seen = latest.get(row.customer_id);
    if (!seen || String(row.calculated_at) > String(seen.calculated_at)) {
      latest.set(row.customer_id, row);
    }
  }
  return [...latest.values()].map((r) => {
    const status = r.health_status || 'unknown';
    return {
      customerId: r.customer_id,
      customerName: r.customer_name?.trim() || `Customer ${r.customer_id.slice(0, 8)}`,
      overallScore: num(r.overall_score),
      healthStatus: status,
      trend: r.trend ?? null,
      atRisk: (AT_RISK_HEALTH_STATUSES as readonly string[]).includes(status),
      factors: [
        { label: 'Usage', score: num(r.usage_score) },
        { label: 'Engagement', score: num(r.engagement_score) },
        { label: 'Support', score: num(r.support_score) },
        { label: 'Payment', score: num(r.payment_score) },
        { label: 'Satisfaction', score: num(r.satisfaction_score) },
      ],
      signals: {
        daysSinceLastService: num(r.days_since_last_service),
        openTickets: num(r.open_tickets_count),
        overdueInvoices: num(r.overdue_invoices_count),
        nps: num(r.nps_score),
        csat: num(r.csat),
      },
      riskFactors: r.risk_factors ?? [],
      strengths: r.strength_factors ?? [],
      recommendations: r.recommendations ?? [],
      calculatedAt: r.calculated_at,
      nextCalculationDue: r.next_calculation_due ?? null,
    };
  });
}

/** Mean of the scores that exist; null when none do. */
export function averageScore(views: readonly CustomerHealthView[]): number | null {
  const scores = views.map((v) => v.overallScore).filter((s): s is number => s !== null);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}
