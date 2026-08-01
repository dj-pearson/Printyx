/**
 * Churn-risk edge function (PROD-010) — port of server/routes-churn-risk.ts.
 *
 * WHY: the domain had an Express handler and NO edge function, so
 * pages/CustomerRisk.tsx worked in dev and hard-404'd in production, where
 * getApiUrl() rewrites /api/churn-risk -> functions.printyx.net/churn-risk with no
 * Express fallback.
 *
 * ROUTES — all seven Express endpoints, which is also everything the page calls:
 *   POST /score                      run scoring for every active customer
 *   GET  /scores?band=               latest score per customer  -> { data, total }
 *   GET  /scores/:customerId/history up to 52 points, oldest -> newest
 *   POST /save-plan                  { customerId } -> drafted outreach + offer
 *   GET  /settings                   weights, thresholds, digest toggle
 *   PUT  /settings                   partial update (weights MERGE)
 *   POST /digest/preview             weekly at-risk digest with WoW deltas
 *
 * SHAPE: CustomerRisk.tsx types ChurnScore/Settings/HistoryPoint/SavePlan/Digest
 * in camelCase. PostgREST returns snake_case, so rows are mapped explicitly —
 * NOT run through a key converter, because `signals` is a jsonb column whose
 * inner keys are snake_case by design (ticket_delta, ar_past_due, meter_trend,
 * renewal_proximity) and the page reads them at exactly those names.
 *
 * TWO QUERIES HAD NO POSTGREST EQUIVALENT and are computed in JS instead:
 *   - /scores used `SELECT DISTINCT ON (customer_id) ... ORDER BY calculated_at
 *     DESC`; here rows come back newest-first and the first per customer wins.
 *   - /digest/preview used `ROW_NUMBER() OVER (PARTITION BY customer_id)` to pair
 *     each customer's latest score with the previous one for the week-over-week
 *     delta; here the same newest-first ordering yields rank 1 and rank 2.
 * Both depend on the descending order to be correct. Lose it and the page shows
 * stale scores and nonsense deltas, with nothing failing loudly.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  buildSavePlan,
  getOrCreateSettings,
  resolveWeights,
  runScoring,
  type ScoredCustomer,
} from './scoring.ts';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const reasonsOf = (signals: unknown): string[] => {
  const s = signals as { reasons?: unknown } | null;
  return Array.isArray(s?.reasons) ? (s!.reasons as string[]) : [];
};

/** Settings row -> the camelCase Settings the page types. */
const toSettings = (row: Record<string, unknown> | null) =>
  row
    ? {
        tenantId: row.tenant_id,
        weights: row.weights ?? null,
        watchThreshold: row.watch_threshold,
        atRiskThreshold: row.at_risk_threshold,
        digestEnabled: row.digest_enabled,
        updatedAt: row.updated_at,
      }
    : null;

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Idempotent — the dispatcher strips segment 0 before the handler runs.
    const { parts } = normalizePath(url.pathname, 'churn-risk');
    const [first, second, third] = parts;
    const method = req.method.toUpperCase();

    // --- POST /score -------------------------------------------------------
    if (method === 'POST' && first === 'score') {
      const result = await runScoring(admin, tenantId);
      return createCorsResponse(result, 200, req);
    }

    // --- GET /scores/:customerId/history -----------------------------------
    // Matched before the bare /scores list so the id form is not swallowed.
    if (method === 'GET' && first === 'scores' && second && third === 'history') {
      const { data, error } = await admin
        .from('customer_churn_scores')
        .select('score, band, calculated_at')
        .eq('tenant_id', tenantId)
        .eq('customer_id', second)
        .order('calculated_at', { ascending: false })
        .limit(52);
      if (error) throw error;

      // Fetched newest-first to get the LAST 52, then reversed: the sparkline
      // draws left-to-right in time order.
      const history = (data ?? [])
        .map((r: Record<string, unknown>) => ({
          score: num(r.score),
          band: r.band,
          calculatedAt: r.calculated_at ?? null,
        }))
        .reverse();

      return createCorsResponse({ customerId: second, history }, 200, req);
    }

    // --- GET /scores -------------------------------------------------------
    if (method === 'GET' && first === 'scores' && !second) {
      const band = url.searchParams.get('band') ?? undefined;

      let query = admin
        .from('customer_churn_scores')
        .select('id, customer_id, score, band, signals, contract_value, calculated_at')
        .eq('tenant_id', tenantId);
      if (band) query = query.eq('band', band);

      const { data, error } = await query.order('calculated_at', { ascending: false });
      if (error) throw error;

      // DISTINCT ON (customer_id) equivalent — first row per customer wins,
      // which is the newest because of the ordering above.
      const latest = new Map<string, Record<string, unknown>>();
      for (const row of data ?? []) {
        const key = String(row.customer_id);
        if (!latest.has(key)) latest.set(key, row);
      }
      const rows = Array.from(latest.values());

      const names = await companyNames(
        admin,
        tenantId,
        rows.map((r) => String(r.customer_id)),
      );

      const result = rows
        .map((r) => {
          const score = num(r.score);
          const contractValue = num(r.contract_value);
          return {
            id: r.id,
            customerId: r.customer_id,
            companyName: names.get(String(r.customer_id)) ?? null,
            score,
            band: r.band,
            signals: r.signals ?? null,
            contractValue,
            calculatedAt: r.calculated_at ?? null,
            // Value-weighted: a high score on a small account should not outrank
            // a moderate score on a large one.
            priorityScore: score * contractValue,
            reasons: reasonsOf(r.signals),
          };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore);

      return createCorsResponse({ data: result, total: result.length }, 200, req);
    }

    // --- POST /save-plan ---------------------------------------------------
    if (method === 'POST' && first === 'save-plan') {
      const body = await safeJson(req);
      const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
      if (!customerId) {
        return createCorsResponse(
          { message: 'Invalid input', errors: { customerId: 'required' } },
          400,
          req,
        );
      }

      const { data: customer } = await admin
        .from('business_records')
        .select('company_name')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!customer) return createCorsResponse({ message: 'Customer not found' }, 404, req);

      const { data: latestRows } = await admin
        .from('customer_churn_scores')
        .select('band, signals, score')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .order('calculated_at', { ascending: false })
        .limit(1);

      const score = (latestRows ?? [])[0];
      const plan = buildSavePlan({
        companyName: (customer.company_name as string) ?? '',
        band: (score?.band as string) ?? 'healthy',
        signals: (score?.signals as ScoredCustomer['signals']) ?? null,
      });

      return createCorsResponse(
        {
          customerId,
          companyName: customer.company_name ?? null,
          band: score?.band ?? null,
          score: score ? num(score.score) : null,
          ...plan,
        },
        200,
        req,
      );
    }

    // --- GET /settings -----------------------------------------------------
    if (method === 'GET' && first === 'settings') {
      const settings = await getOrCreateSettings(admin, tenantId);
      return createCorsResponse(toSettings(settings), 200, req);
    }

    // --- PUT /settings -----------------------------------------------------
    if (method === 'PUT' && first === 'settings') {
      const body = await safeJson(req);

      const invalid = validateSettings(body);
      if (invalid) {
        return createCorsResponse({ message: 'Invalid input', errors: invalid }, 400, req);
      }

      const current = await getOrCreateSettings(admin, tenantId);
      if (!current) {
        return createCorsResponse({ message: 'Failed to load settings' }, 500, req);
      }

      const updates: Record<string, unknown> = {
        updated_by_user_id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (body.weights !== undefined) {
        // MERGE over existing/defaults so a partial weight edit does not silently
        // reset the signals the caller did not mention.
        updates.weights = {
          ...resolveWeights(current.weights),
          ...(body.weights as Record<string, number>),
        };
      }
      if (body.watchThreshold !== undefined) updates.watch_threshold = body.watchThreshold;
      if (body.atRiskThreshold !== undefined) updates.at_risk_threshold = body.atRiskThreshold;
      if (body.digestEnabled !== undefined) updates.digest_enabled = body.digestEnabled;

      const { data, error } = await admin
        .from('churn_risk_settings')
        .update(updates)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();
      if (error) throw error;

      return createCorsResponse(toSettings(data ?? null), 200, req);
    }

    // --- POST /digest/preview ----------------------------------------------
    if (method === 'POST' && first === 'digest' && second === 'preview') {
      const settings = await getOrCreateSettings(admin, tenantId);

      const { data, error } = await admin
        .from('customer_churn_scores')
        .select('customer_id, score, band, signals, contract_value, calculated_at')
        .eq('tenant_id', tenantId)
        .order('calculated_at', { ascending: false });
      if (error) throw error;

      // ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY calculated_at DESC)
      // equivalent: newest-first ordering means the first two rows seen per
      // customer are ranks 1 and 2.
      const byCustomer = new Map<string, Record<string, unknown>[]>();
      for (const row of data ?? []) {
        const key = String(row.customer_id);
        const list = byCustomer.get(key) ?? [];
        if (list.length < 2) {
          list.push(row);
          byCustomer.set(key, list);
        }
      }

      const atRisk = Array.from(byCustomer.values())
        .filter(([current]) => current.band === 'at_risk')
        .map(([current, previous]) => {
          const score = num(current.score);
          const contractValue = num(current.contract_value);
          return {
            customerId: String(current.customer_id),
            score,
            band: current.band,
            contractValue,
            // null (not 0) when there is no prior run — "no change" and "no
            // history" are different things and the page renders them differently.
            weekOverWeekDelta: previous == null ? null : score - num(previous.score),
            reasons: reasonsOf(current.signals),
            _sort: score * contractValue,
          };
        })
        .sort((a, b) => b._sort - a._sort)
        .slice(0, 10);

      const names = await companyNames(
        admin,
        tenantId,
        atRisk.map((i) => i.customerId),
      );
      const topAtRisk = atRisk.map(({ _sort, ...item }) => ({
        ...item,
        companyName: names.get(item.customerId) ?? null,
      }));

      // NOTE: assembly is real; DELIVERY is still a stub here, same as Express —
      // there is no outbound-email wiring on this path.
      return createCorsResponse(
        {
          title: 'Weekly Churn-Risk Digest',
          generatedAt: new Date().toISOString(),
          tenantId,
          digestEnabled: settings?.digest_enabled ?? true,
          atRiskCount: topAtRisk.length,
          topAtRisk,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('churn-risk function error:', message);
    return createCorsResponse({ message: 'Churn-risk request failed', error: message }, 500, req);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mirrors the Express zod schema; returns a field->message map or null. */
function validateSettings(body: Record<string, unknown>): Record<string, string> | null {
  const errors: Record<string, string> = {};

  const intInRange = (v: unknown) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;

  if (body.watchThreshold !== undefined && !intInRange(body.watchThreshold)) {
    errors.watchThreshold = 'must be an integer 0-100';
  }
  if (body.atRiskThreshold !== undefined && !intInRange(body.atRiskThreshold)) {
    errors.atRiskThreshold = 'must be an integer 0-100';
  }
  if (body.digestEnabled !== undefined && typeof body.digestEnabled !== 'boolean') {
    errors.digestEnabled = 'must be a boolean';
  }
  if (body.weights !== undefined) {
    const w = body.weights;
    if (!w || typeof w !== 'object' || Array.isArray(w)) {
      errors.weights = 'must be an object';
    } else {
      for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
        if (typeof v !== 'number' || v < 0) {
          errors.weights = `${k} must be a number >= 0`;
          break;
        }
      }
    }
  }

  return Object.keys(errors).length ? errors : null;
}

async function companyNames(
  admin: ReturnType<typeof createSupabaseServiceClient>,
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

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
