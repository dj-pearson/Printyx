/**
 * AI analytics dashboard aggregation (PROD-010).
 *
 * Split out of index.ts so it can be exercised without Deno: index.ts imports
 * _shared/supabase.ts, which pulls @supabase/supabase-js from esm.sh at RUNTIME
 * and therefore cannot be loaded by Node. This module takes the client as a
 * parameter and imports only its TYPE, which erases at compile time — the same
 * arrangement as qbr/content.ts, and what makes the CI tests possible.
 *
 * Column names were verified against shared/churn-risk-schema.ts and
 * shared/predictive-failure-schema.ts rather than assumed from the camelCase
 * Drizzle field names.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/** Statuses that count as an open prediction (Express: pending|approved|snoozed). */
const OPEN_STATUSES = new Set(['pending', 'approved', 'snoozed']);

/** Outcomes that count toward the precision measurement. */
const SCORED_OUTCOMES = new Set(['true_positive', 'false_positive']);

/** Accuracy is withheld below this many scored outcomes — too few to mean anything. */
const MIN_SCORED_FOR_ACCURACY = 5;

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The whole payload, as a plain object. Kept separate from the Response wrapper
 * so the aggregation can be exercised directly — there is no Deno in CI, so a
 * function that only ever returned a Response would be untestable, and this is
 * the arithmetic a port silently gets wrong.
 */
export async function computeDashboard(admin: SupabaseClient, tenantId: string) {
  // --- Churn: latest score per customer ---------------------------------
  // Express uses `SELECT DISTINCT ON (customer_id) ... ORDER BY customer_id,
  // calculated_at DESC`. PostgREST has no DISTINCT ON, so the same result is
  // produced by ordering newest-first and keeping the FIRST row seen per
  // customer. Ordering by calculated_at descending is what makes that
  // equivalent — without it this would keep an arbitrary historical score, and
  // the table holds one row per (customer, scoring run).
  const { data: churnAll, error: churnErr } = await admin
    .from('customer_churn_scores')
    .select('customer_id, score, band, signals, contract_value, calculated_at')
    .eq('tenant_id', tenantId)
    .order('calculated_at', { ascending: false });
  if (churnErr) throw churnErr;

  const latestByCustomer = new Map<string, Record<string, unknown>>();
  for (const row of churnAll ?? []) {
    const key = String(row.customer_id);
    if (!latestByCustomer.has(key)) latestByCustomer.set(key, row);
  }
  const churnRows = Array.from(latestByCustomer.values());

  const names = await companyNames(
    admin,
    tenantId,
    churnRows.map((r) => String(r.customer_id)),
  );

  const bandCount = (b: string) => churnRows.filter((r) => r.band === b).length;

  const churnCustomers = churnRows
    .map((r) => {
      const score = num(r.score);
      const contractValue = num(r.contract_value);
      const signals = (r.signals ?? null) as { reasons?: unknown } | null;
      return {
        customerId: String(r.customer_id),
        companyName: names.get(String(r.customer_id)) ?? 'Unknown account',
        score,
        band: r.band,
        // score is 0..100; the page formats this as a percentage.
        churnProbability: clamp01(score / 100),
        contractValue,
        reasons: Array.isArray(signals?.reasons) ? signals.reasons : [],
        // Value-weighted ordering: a high score on a small account should not
        // outrank a moderate score on a large one.
        priorityScore: score * contractValue,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const churnAvailable = churnRows.length > 0;

  // --- Predictive maintenance -------------------------------------------
  const { data: predRows, error: predErr } = await admin
    .from('equipment_failure_predictions')
    .select(
      'machine_id, confidence, predicted_window_start, contract_value, signals, status, outcome',
    )
    .eq('tenant_id', tenantId)
    .order('confidence', { ascending: false });
  if (predErr) throw predErr;

  const preds = predRows ?? [];
  const openPreds = preds.filter((r) => OPEN_STATUSES.has(String(r.status)));
  const monitoredMachines = new Set(preds.map((r) => String(r.machine_id))).size;
  const scoredOutcomes = preds.filter((r) => SCORED_OUTCOMES.has(String(r.outcome)));
  const truePositives = preds.filter((r) => r.outcome === 'true_positive').length;

  // Null (not 0) below the floor: the page renders null as "—" rather than
  // publishing a precision figure derived from a handful of outcomes.
  const maintenanceAccuracy =
    scoredOutcomes.length >= MIN_SCORED_FOR_ACCURACY
      ? Math.round((truePositives / scoredOutcomes.length) * 1000) / 10
      : null;

  const alerts = openPreds.slice(0, 25).map((r) => {
    const signals = (r.signals ?? null) as { suggested_parts?: unknown } | null;
    return {
      machineId: String(r.machine_id),
      confidence: clamp01(num(r.confidence)),
      predictedFailureDate: r.predicted_window_start ?? null,
      contractValue: num(r.contract_value),
      status: r.status,
      // snake_case key INSIDE the jsonb payload — not a column, so it is read
      // literally and never run through case conversion.
      suggestedParts: Array.isArray(signals?.suggested_parts) ? signals.suggested_parts : [],
    };
  });
  const maintenanceAvailable = preds.length > 0;

  // --- Record counts ------------------------------------------------------
  const customersCount = await countRecords(admin, tenantId, 'customer');
  const leadsCount = await countRecords(admin, tenantId, 'lead');

  return {
    generatedAt: new Date().toISOString(),
    // Which capabilities are backed by real data vs preview-only. The UI
    // renders an honest "Preview" state for anything false — never fake data.
    availability: {
      churn: churnAvailable,
      predictiveMaintenance: maintenanceAvailable,
      salesForecasting: false,
      sentiment: false,
      recommendations: false,
      modelRegistry: false,
      lifetimeValue: false,
      upsell: false,
    },
    overview: {
      customersCount,
      leadsCount,
      atRiskCustomers: bandCount('at_risk'),
      equipmentMonitored: monitoredMachines,
    },
    churn: {
      available: churnAvailable,
      totalAnalyzed: churnRows.length,
      highRisk: bandCount('at_risk'),
      mediumRisk: bandCount('watch'),
      lowRisk: bandCount('healthy'),
      customers: churnCustomers.slice(0, 25),
    },
    predictiveMaintenance: {
      available: maintenanceAvailable,
      equipmentMonitored: monitoredMachines,
      predictedFailures: openPreds.length,
      accuracyRate: maintenanceAccuracy,
      alerts,
    },
  };
}

/**
 * Express resolved company names with a LEFT JOIN inside the DISTINCT ON query.
 * PostgREST cannot join across the tenant boundary the same way, so names are
 * fetched separately and mapped — the join was already tenant-scoped on both
 * sides, so the result set is identical.
 */
async function companyNames(
  admin: SupabaseClient,
  tenantId: string,
  customerIds: string[],
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(customerIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await admin
    .from('business_records')
    .select('id, company_name')
    .eq('tenant_id', tenantId)
    .in('id', unique);
  return new Map(
    (data ?? []).map((r: Record<string, unknown>) => [
      String(r.id),
      (r.company_name as string) ?? null,
    ]),
  );
}

/** head+count so the row bodies are never transferred just to be counted. */
async function countRecords(
  admin: SupabaseClient,
  tenantId: string,
  recordType: string,
): Promise<number> {
  const { count } = await admin
    .from('business_records')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('record_type', recordType);
  return count ?? 0;
}
