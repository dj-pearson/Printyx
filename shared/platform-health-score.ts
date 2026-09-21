/**
 * Tenant health scoring for the platform customer-success surface.
 *
 * ONE implementation shared by the single-record button
 * (POST /platform-cs/health-scores/calculate) and the nightly sweep
 * (POST /platform-cs/health-scores/calculate-all). COP-B04's rule: extract the
 * per-record work into one function both entry points call, or they drift and
 * only one of them gets looked at.
 *
 * WHY THIS MODULE EXISTS AT ALL. The scorer this replaces weighted six factors
 * and FOUR of them were constants, because nothing in this product writes the
 * columns they read:
 *
 *   usage        20%  `engagement_score`, written by NOTHING -> `|| 0` scored
 *                     every tenant ZERO, so a fifth of every health score was a
 *                     hardcoded penalty. It also tripped the "Low usage" risk
 *                     factor on every account in the platform.
 *   adoption     15%  literal 70.
 *   support      15%  literal 85.
 *   satisfaction 10%  `nps_score`, written by nothing -> literal 50.
 *
 * Sixty per cent of a number that is written onto
 * `platform_business_records.churn_risk`. Firing the sweep without this rewrite
 * would not have surfaced a dormant feature, it would have PUBLISHED the
 * fabrication to every account (PROD-010's lesson: repairing the thing that was
 * blocking a fabricated backend is how it finally ships).
 *
 * THREE RULES IT ENCODES.
 *
 * 1. A FACTOR WITH NO WRITER IS UNMEASURED, NOT A CONSTANT. Each one is
 *    reported by name with the reason, so a platform admin reads what the score
 *    does and does not cover instead of a number implying it covers everything.
 *
 * 2. THE WEIGHTS RENORMALISE OVER WHAT WAS MEASURED. Dropping an unmeasured
 *    factor without renormalising subtracts its weight from every score, so
 *    removing a fabricated 85 reads as a collapse in health rather than as the
 *    correction it is. `coverage` reports the fraction of weight that had data
 *    behind it.
 *
 * 3. TOO LITTLE COVERAGE PRODUCES NO ROW. `platform_health_scores.overall_score`
 *    and `.health_status` are both NOT NULL, so a record with almost nothing
 *    measured cannot be stored honestly - and inventing a value to satisfy a
 *    NOT NULL is what COP-B00 refuses. Such a record is SKIPPED and counted,
 *    never written with a placeholder.
 *
 * OUR OUTREACH IS NOT THEIR ENGAGEMENT. `last_contact_date` is bumped by
 * `platform-activities` when OUR team logs a call, an email or a demo - it
 * records what we did to the tenant, not what the tenant did in the product.
 * The factor is named `outreachRecency` for that reason. Naming it "engagement"
 * is how a CSM reads their own diligence back as the customer's health.
 *
 * Dependency-free and reads no environment, so both runtimes can import it
 * (round 123: `process.env` and `Deno.env.get` are the same configuration
 * spelled two ways, which is what stops a module being shared).
 */

/** The `platform_business_records` columns the score reads. */
export interface PlatformRecordRow {
  id?: string | null;
  record_type?: string | null;
  status?: string | null;
  company_name?: string | null;
  tenant_id?: string | null;
  current_mrr?: unknown;
  nps_score?: number | null;
  csat_score?: unknown;
  last_contact_date?: string | null;
  last_engagement_date?: string | null;
}

export interface HealthFactor {
  key: string;
  label: string;
  /** Share of the score this factor carries when it is measured. */
  weight: number;
  /** 0-100, or null when nothing in this product records it. */
  score: number | null;
  /** Present exactly when `score` is null. */
  reason?: string;
}

export interface HealthScoreResult {
  overallScore: number | null;
  healthStatus: 'excellent' | 'healthy' | 'at_risk' | 'critical' | 'churned' | null;
  factors: HealthFactor[];
  /** Fraction of total weight that had data behind it, 0-1. */
  coverage: number;
  /** Labels of the factors nothing measures, for the response and the UI. */
  unmeasured: string[];
  daysSinceLastActivity: number | null;
  riskFactors: string[];
  strengthFactors: string[];
  recommendations: string[];
  /** Set when no row should be written; names why. */
  skipped?: string;
}

/**
 * Below this fraction of measured weight the composite is not a health score,
 * it is one factor wearing a composite's name. 0.3 requires at least two of the
 * three measurable factors rather than any single one.
 */
export const MIN_COVERAGE = 0.3;

/** Statuses on the account that mean the tenant has left. */
const CHURNED_STATUSES = ['churned', 'former_customer'];

function finiteNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Most recent of the two activity stamps, or null when neither is set. */
export function lastActivityAt(row: PlatformRecordRow): Date | null {
  const times = [row.last_contact_date, row.last_engagement_date]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((v) => new Date(v).getTime())
    .filter((t) => Number.isFinite(t));
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

export function scoreTenantHealth(
  row: PlatformRecordRow,
  now: Date = new Date(),
): HealthScoreResult {
  const activity = lastActivityAt(row);
  const daysSinceLastActivity = activity
    ? Math.max(0, Math.floor((now.getTime() - activity.getTime()) / 86400000))
    : null;

  // A record with no activity date is NOT "999 days idle" - that was the old
  // sentinel, and `100 - 999 * 2` clamped to 0 made an account nobody has
  // logged an activity against indistinguishable from one we have abandoned.
  const outreach: HealthFactor =
    daysSinceLastActivity === null
      ? {
          key: 'outreachRecency',
          label: 'Outreach recency',
          weight: 0.2,
          score: null,
          reason: 'No activity has been logged against this account, so there is nothing to date.',
        }
      : {
          key: 'outreachRecency',
          label: 'Outreach recency',
          weight: 0.2,
          score: clamp(100 - daysSinceLastActivity * 2),
        };

  // MRR absent is "nobody has recorded one", which is not the same as paying
  // nothing - the old `mrr ? 100 : 50` called an unfilled field half-healthy.
  const mrr = finiteNumber(row.current_mrr);
  const payment: HealthFactor =
    mrr === null
      ? {
          key: 'payment',
          label: 'Payment',
          weight: 0.2,
          score: null,
          reason: 'No MRR is recorded on this account.',
        }
      : { key: 'payment', label: 'Payment', weight: 0.2, score: mrr > 0 ? 100 : 0 };

  // NPS runs -100..100 and CSAT 0..5; prefer NPS, which is the one the platform
  // CRM exposes a field for.
  const nps = finiteNumber(row.nps_score);
  const csat = finiteNumber(row.csat_score);
  const satisfaction: HealthFactor =
    nps !== null
      ? { key: 'satisfaction', label: 'Satisfaction', weight: 0.1, score: clamp((nps + 100) / 2) }
      : csat !== null
        ? { key: 'satisfaction', label: 'Satisfaction', weight: 0.1, score: clamp(csat * 20) }
        : {
            key: 'satisfaction',
            label: 'Satisfaction',
            weight: 0.1,
            score: null,
            reason: 'No survey response is recorded; nothing in this product collects NPS or CSAT.',
          };

  const factors: HealthFactor[] = [
    outreach,
    payment,
    satisfaction,
    {
      key: 'productUsage',
      label: 'Product usage',
      weight: 0.2,
      score: null,
      reason:
        'Nothing records per-tenant product usage at the platform level; platform_business_records.engagement_score has no writer.',
    },
    {
      key: 'adoption',
      label: 'Feature adoption',
      weight: 0.15,
      score: null,
      reason: 'Nothing records which features a tenant has adopted.',
    },
    {
      key: 'support',
      label: 'Support',
      weight: 0.15,
      score: null,
      reason:
        'There is no platform support-ticket table; service_tickets are the dealer own tickets about their copiers.',
    },
  ];

  const measured = factors.filter((f) => f.score !== null);
  const coverage = measured.reduce((sum, f) => sum + f.weight, 0);
  const unmeasured = factors.filter((f) => f.score === null).map((f) => f.label);

  const base: Omit<HealthScoreResult, 'overallScore' | 'healthStatus' | 'skipped'> = {
    factors,
    coverage,
    unmeasured,
    daysSinceLastActivity,
    riskFactors: [],
    strengthFactors: [],
    recommendations: [],
  };

  if (coverage < MIN_COVERAGE) {
    return {
      ...base,
      overallScore: null,
      healthStatus: null,
      skipped:
        measured.length === 0
          ? 'Nothing about this account is measured.'
          : `Only ${measured.map((f) => f.label).join(', ')} is measured, which is too little to score.`,
    };
  }

  const overallScore = Math.round(
    measured.reduce((sum, f) => sum + (f.score as number) * f.weight, 0) / coverage,
  );

  // A tenant the account record says has LEFT is churned whatever the factors
  // say - the enum has carried that member since migration 0000 and nothing
  // ever wrote it.
  const status = (row.status || '').toLowerCase();
  let healthStatus: HealthScoreResult['healthStatus'];
  if (CHURNED_STATUSES.includes(status)) healthStatus = 'churned';
  else if (overallScore >= 90) healthStatus = 'excellent';
  else if (overallScore >= 70) healthStatus = 'healthy';
  else if (overallScore >= 50) healthStatus = 'at_risk';
  else healthStatus = 'critical';

  // Every cited factor is one that was MEASURED. The old list pushed
  // "Low usage" from a score that was always zero, so it appeared on every
  // account in the platform and meant nothing.
  const riskFactors: string[] = [];
  const strengthFactors: string[] = [];
  const recommendations: string[] = [];

  if (outreach.score !== null && outreach.score < 50) riskFactors.push('Low outreach recency');
  if (daysSinceLastActivity !== null && daysSinceLastActivity > 30)
    riskFactors.push('No recent activity');
  if (mrr !== null && mrr <= 0) riskFactors.push('No active subscription');
  if (nps !== null && nps < 0) riskFactors.push('Negative NPS');

  if (outreach.score !== null && outreach.score >= 80) strengthFactors.push('Recent contact');
  if (nps !== null && nps > 50) strengthFactors.push('High NPS');
  if (mrr !== null && mrr > 1000) strengthFactors.push('High-value customer');

  if (overallScore < 70) {
    recommendations.push('Schedule check-in call');
    if (outreach.score !== null && outreach.score < 50)
      recommendations.push('Send re-engagement campaign');
  }

  return { ...base, overallScore, healthStatus, riskFactors, strengthFactors, recommendations };
}

/** Maps a health status onto the account record's churn-risk vocabulary. */
export function churnRiskFor(status: HealthScoreResult['healthStatus']): string | null {
  switch (status) {
    case 'churned':
      return 'critical';
    case 'critical':
      return 'critical';
    case 'at_risk':
      return 'high';
    case 'healthy':
      return 'low';
    case 'excellent':
      return 'very_low';
    default:
      return null;
  }
}
