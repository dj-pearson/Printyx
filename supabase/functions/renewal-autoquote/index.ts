// Renewal Auto-Quote Edge Function (US-SUPER-010 / PROD-011)
//
// Production counterpart to server/routes-renewal-autoquote.ts, which had no
// edge function — so the whole renewal dashboard 404'd in production while
// working in dev.
//
// Endpoints (the dispatcher strips the function-name segment first):
//   POST /generate                      daily generator; ?force bypasses the toggle
//   GET  /                              list drafts (?status=, ?underage=true)
//   GET  /stats
//   GET  /settings          PUT /settings
//   GET  /suppressions      POST /suppressions   DELETE /suppressions/:customerId
//   GET  /:id
//   POST /:id/mark-sent     POST /:id/dismiss    POST /:id/outcome
//
// Two things worth knowing before editing:
//
//  1. The tables (renewal_auto_quotes, renewal_autoquote_settings,
//     renewal_suppressions) are NOT in the drizzle journal. They are created by
//     the hand-run drizzle/migrations/_backfill_renewal_autoquote.sql, so they
//     exist only where someone ran it — the same condition the Express handler
//     has always been under.
//
//  2. Responses are camelCase because RenewalAutoQuote.tsx reads camelCase
//     (r.quoteValue, r.isUnderage, r.monthlyAvgBlack, detail.machineBreakdown).
//     PostgREST returns snake_case, so every row is converted on the way out.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { pickTier, num, type CpcTier } from '../_shared/renewal-retier.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import {
  RENEWAL_DEAL_MOTION,
  buildRenewalDealInsert,
  buildRenewalDealUpdate,
  type RenewalDraftFacts,
} from '../_shared/renewal-deal.ts';
import { firstStageId, type DealStageRow } from '../_shared/deal-stage.ts';

type Row = Record<string, any>;

const toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function camelRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}
const camelRows = (rows: Row[] | null | undefined): Row[] => (rows || []).map(camelRow);

const SETTINGS_COLUMNS = new Set([
  'days_window_start',
  'days_window_end',
  'growth_buffer_pct',
  'underage_threshold_pct',
  'expiration_days',
  'auto_generate_enabled',
]);

// Mirrors the Express zod schemas. Returning a 400 with the offending field is
// closer to the Express behaviour than letting PostgREST reject the write.
function validateSettings(body: Row): { values: Row } | { error: string } {
  const values: Row = {};
  const ints: Record<string, [number, number]> = {
    days_window_start: [1, 365],
    days_window_end: [1, 400],
    growth_buffer_pct: [0, 100],
    underage_threshold_pct: [0, 100],
    expiration_days: [1, 180],
  };
  for (const [k, v] of Object.entries(body || {})) {
    const col = SETTINGS_COLUMNS.has(k) ? k : toSnake(k);
    if (!SETTINGS_COLUMNS.has(col)) continue;
    if (col === 'auto_generate_enabled') {
      if (typeof v !== 'boolean') return { error: `${k} must be a boolean` };
      values[col] = v;
      continue;
    }
    const n = Number(v);
    const [lo, hi] = ints[col];
    if (!Number.isInteger(n) || n < lo || n > hi) {
      return { error: `${k} must be an integer between ${lo} and ${hi}` };
    }
    values[col] = n;
  }
  return { values };
}

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

    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);
    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'renewal-autoquote');
    const first = parts[0];
    const second = parts[1];

    const audit = (action: string, extra?: unknown) =>
      console.log(
        JSON.stringify({
          audit: true,
          action,
          tenantId,
          userId: user.id,
          timestamp: new Date().toISOString(),
          ...(extra ? { extra } : {}),
        }),
      );

    async function getOrCreateSettings(): Promise<Row | null> {
      const { data: existing } = await admin
        .from('renewal_autoquote_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (existing) return existing as Row;
      await admin.from('renewal_autoquote_settings').insert({ tenant_id: tenantId });
      const { data: created } = await admin
        .from('renewal_autoquote_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return (created as Row) ?? null;
    }

    /**
     * SEC-EDGE-001: two of these branches decide something for the whole
     * tenant, and the rest are a rep's own work on their own renewals.
     *
     * `PUT /settings` sets the discount ceiling, the lead-time window and the
     * auto-send toggle for every renewal quote the system drafts. A
     * SUPPRESSION is the other tenant-wide one and the less obvious: adding a
     * customer means they never receive a renewal quote again, and nothing on
     * the drafts board would show the absence - a renewal that silently stops
     * being offered is indistinguishable from one nobody got round to.
     *
     * Reading, marking sent, dismissing a draft and recording an outcome stay
     * open: that is what a rep does with their own book all day, and the
     * generator itself is fired by the schedule.
     */
    const requireManager = () =>
      requireRoleLevel(
        {
          userId: user.id,
          tenantId,
          email: user.email,
          jwt: jwt ?? '',
          supabaseUser: user,
        } as AuthContext,
        ROLE_LEVEL.MANAGER,
      );
    const denyManager = (err: unknown) => {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            message:
              'Changing the auto-quote policy or suppressing a customer requires a manager role',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    };

    // ─── GET /settings, PUT /settings ────────────────────────────────
    if (first === 'settings' && !second) {
      if (req.method === 'GET') {
        const settings = await getOrCreateSettings();
        if (!settings) {
          return createCorsResponse({ message: 'Failed to load settings' }, 500, req);
        }
        return createCorsResponse(camelRow(settings), 200, req);
      }
      if (req.method === 'PUT') {
        try {
          requireManager();
        } catch (err) {
          return denyManager(err);
        }
        const body = (await req.json().catch(() => ({}))) as Row;
        const parsed = validateSettings(body);
        if ('error' in parsed) {
          return createCorsResponse({ message: 'Invalid input', errors: parsed.error }, 400, req);
        }
        await getOrCreateSettings();
        const { data, error } = await admin
          .from('renewal_autoquote_settings')
          .update({
            ...parsed.values,
            updated_by_user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        audit('UPDATE_SETTINGS', parsed.values);
        return createCorsResponse(camelRow((data as Row) ?? {}), 200, req);
      }
    }

    // ─── /suppressions ───────────────────────────────────────────────
    if (first === 'suppressions') {
      if (!second && req.method === 'GET') {
        const { data, error } = await admin
          .from('renewal_suppressions')
          .select('id, customer_id, reason, created_at')
          .eq('tenant_id', tenantId);
        if (error) throw new Error(error.message);
        const rows = (data as Row[]) || [];
        const names = await companyNames(
          admin,
          tenantId,
          rows.map((r) => r.customer_id),
        );
        const out = rows.map((r) => ({
          ...camelRow(r),
          companyName: names.get(r.customer_id) ?? null,
        }));
        return createCorsResponse({ data: out, total: out.length }, 200, req);
      }

      if (!second && req.method === 'POST') {
        try {
          requireManager();
        } catch (err) {
          return denyManager(err);
        }
        const body = (await req.json().catch(() => ({}))) as Row;
        const customerId = body.customerId ?? body.customer_id;
        if (!customerId || typeof customerId !== 'string') {
          return createCorsResponse({ message: 'customerId is required' }, 400, req);
        }
        const reason = body.reason ?? null;
        if (reason !== null && String(reason).length > 500) {
          return createCorsResponse(
            { message: 'reason must be 500 characters or fewer' },
            400,
            req,
          );
        }
        // Mirrors onConflictDoNothing().returning(): an existing row yields no
        // insert, and the Express handler answers with alreadySuppressed.
        const { data: existing } = await admin
          .from('renewal_suppressions')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('customer_id', customerId)
          .maybeSingle();
        if (existing) {
          return createCorsResponse({ customerId, alreadySuppressed: true }, 201, req);
        }
        const { data, error } = await admin
          .from('renewal_suppressions')
          .insert({
            tenant_id: tenantId,
            customer_id: customerId,
            reason,
            created_by_user_id: user.id,
          })
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        audit('SUPPRESS', { customerId });
        return createCorsResponse(camelRow((data as Row) ?? {}), 201, req);
      }

      if (second && req.method === 'DELETE') {
        // Lifting a suppression is the same decision in reverse.
        try {
          requireManager();
        } catch (err) {
          return denyManager(err);
        }
        const { error } = await admin
          .from('renewal_suppressions')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('customer_id', second);
        if (error) throw new Error(error.message);
        audit('UNSUPPRESS', { customerId: second });
        return createCorsResponse({ success: true }, 200, req);
      }
    }

    // ─── GET /stats ──────────────────────────────────────────────────
    if (first === 'stats' && req.method === 'GET') {
      const { data, error } = await admin
        .from('renewal_auto_quotes')
        .select('outcome, status')
        .eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
      const rows = (data as Row[]) || [];
      const autoWon = rows.filter((r) => r.outcome === 'won').length;
      const autoLost = rows.filter((r) => r.outcome === 'lost').length;
      const decided = autoWon + autoLost;
      return createCorsResponse(
        {
          totalDrafts: rows.length,
          pendingReview: rows.filter((r) => r.status === 'renewal_draft').length,
          sent: rows.filter((r) => r.status === 'sent').length,
          autoWon,
          autoLost,
          autoWinRate: decided > 0 ? Math.round((autoWon / decided) * 1000) / 10 : null,
          // STUB on both backends: needs manual-renewal outcomes to be tracked.
          manualBaselineWinRate: null,
          manualBaselineNote:
            'Manual-renewal win-rate baseline not yet tracked; wire once manual renewals record outcomes.',
        },
        200,
        req,
      );
    }

    // ─── POST /generate ──────────────────────────────────────────────
    if (first === 'generate' && req.method === 'POST') {
      return await generate(req, { admin, tenantId, userId: user.id, url, audit });
    }

    // ─── GET / (list) ────────────────────────────────────────────────
    if (!first && req.method === 'GET') {
      const status = url.searchParams.get('status') || undefined;
      const onlyUnderage = url.searchParams.get('underage') === 'true';

      let q = admin
        .from('renewal_auto_quotes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('is_underage', { ascending: false })
        .order('quote_value', { ascending: false })
        .limit(500);
      if (status) q = q.eq('status', status);
      if (onlyUnderage) q = q.eq('is_underage', true);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data as Row[]) || [];
      const names = await companyNames(
        admin,
        tenantId,
        rows.map((r) => r.customer_id),
      );
      const out = rows.map((r) => ({
        ...camelRow(r),
        companyName: names.get(r.customer_id) ?? null,
      }));
      return createCorsResponse(
        {
          data: out,
          total: out.length,
          reviewCount: rows.filter((r) => r.status === 'renewal_draft').length,
        },
        200,
        req,
      );
    }

    // ─── /:id and /:id/<action> ──────────────────────────────────────
    if (first) {
      const loadDraft = async (): Promise<Row | null> => {
        const { data } = await admin
          .from('renewal_auto_quotes')
          .select('*')
          .eq('id', first)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        return (data as Row) || null;
      };

      if (!second && req.method === 'GET') {
        const row = await loadDraft();
        if (!row) return createCorsResponse({ message: 'Renewal draft not found' }, 404, req);
        const names = await companyNames(admin, tenantId, [row.customer_id]);
        return createCorsResponse(
          { ...camelRow(row), companyName: names.get(row.customer_id) ?? null },
          200,
          req,
        );
      }

      const patch = async (values: Row, action: string, extra?: unknown) => {
        const { data, error } = await admin
          .from('renewal_auto_quotes')
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq('id', first)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return createCorsResponse({ message: 'Renewal draft not found' }, 404, req);
        audit(action, extra ?? { id: first });
        return createCorsResponse(camelRow(data as Row), 200, req);
      };

      if (second === 'mark-sent' && req.method === 'POST') {
        return await patch({ status: 'sent' }, 'MARK_SENT');
      }
      if (second === 'dismiss' && req.method === 'POST') {
        return await patch({ status: 'dismissed' }, 'DISMISS');
      }
      if (second === 'outcome' && req.method === 'POST') {
        const body = (await req.json().catch(() => ({}))) as Row;
        if (body.outcome !== 'won' && body.outcome !== 'lost') {
          return createCorsResponse(
            { message: 'Invalid input', errors: "outcome must be 'won' or 'lost'" },
            400,
            req,
          );
        }
        if (body.note != null && String(body.note).length > 500) {
          return createCorsResponse({ message: 'note must be 500 characters or fewer' }, 400, req);
        }
        return await patch(
          {
            outcome: body.outcome,
            outcome_note: body.note ?? null,
            outcome_at: new Date().toISOString(),
          },
          'OUTCOME',
          { id: first, outcome: body.outcome },
        );
      }
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[RENEWAL-AUTOQUOTE] error:', error);
    return createCorsResponse(
      { message: 'Request failed', error: (error as Error).message },
      500,
      req,
    );
  }
}

// deno-lint-ignore no-explicit-any
async function companyNames(admin: any, tenantId: string, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string | null>();
  if (unique.length === 0) return map;
  const { data } = await admin
    .from('business_records')
    .select('id, company_name')
    .eq('tenant_id', tenantId)
    .in('id', unique);
  for (const r of (data as Row[]) || []) map.set(r.id, r.company_name ?? null);
  return map;
}

/**
 * COP-M06. Land a renewal draft in the pipeline as a deal, and attach the
 * machines it covers.
 *
 * Idempotent by the natural key (tenant, replaces_contract_id, renewal motion):
 * one renewal deal per contract, so a re-run updates instead of duplicating and
 * no column had to be added to carry the link.
 *
 * Best-effort throughout. A draft that reaches the rep on its own page but not
 * on the board is the status quo; a generator that 500s because the board is
 * mis-configured is a regression. Every failure is logged and counted, never
 * thrown.
 */
async function upsertRenewalDeal(
  // deno-lint-ignore no-explicit-any
  admin: any,
  opts: {
    tenantId: string;
    fallbackUserId: string;
    stageId: string | null;
    facts: RenewalDraftFacts;
    equipmentIds: string[];
    /** The renewal deal this contract already has, from the batched lookup. */
    existing: Row | null;
  },
): Promise<'created' | 'updated' | 'unchanged' | 'skipped'> {
  const { tenantId, fallbackUserId, stageId, facts, equipmentIds, existing } = opts;
  try {
    let dealId: string | null = existing?.id ?? null;
    let result: 'created' | 'updated' | 'unchanged' | 'skipped' = 'unchanged';

    if (existing) {
      const patch = buildRenewalDealUpdate(facts, existing as Row as never);
      if (patch) {
        const { error } = await admin
          .from('deals')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', dealId)
          .eq('tenant_id', tenantId);
        if (error) throw new Error(error.message);
        result = 'updated';
      }
    } else {
      // stage_id is NOT NULL, so a tenant with no pipeline stages cannot have a
      // deal created for it. That is a setup gap to report, not a crash.
      if (!stageId) {
        console.error('[RENEWAL-AUTOQUOTE] no deal stages for tenant; skipped deal creation');
        return 'skipped';
      }
      const { data: created, error } = await admin
        .from('deals')
        .insert(buildRenewalDealInsert(facts, { tenantId, stageId, fallbackUserId }))
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      dealId = (created as Row).id;
      result = 'created';
    }

    // The serials this renewal covers, through the generic join COP-M05 uses.
    // 'replaces' is the right relation: these are the machines currently on the
    // expiring contract. onConflict on the link's own unique constraint makes a
    // re-run a no-op rather than a duplicate-key error.
    if (dealId && equipmentIds.length > 0) {
      const links = equipmentIds.map((equipmentId) => ({
        tenant_id: tenantId,
        source_type: 'deal',
        source_id: dealId,
        target_type: 'equipment',
        target_id: equipmentId,
        relation: 'replaces',
        created_by: fallbackUserId,
      }));
      const { error: linkError } = await admin.from('crm_associations').upsert(links, {
        onConflict: 'tenant_id,source_type,source_id,target_type,target_id,relation',
        ignoreDuplicates: true,
      });
      if (linkError) {
        console.error('[RENEWAL-AUTOQUOTE] equipment link failed:', linkError.message);
      }
    }

    return result;
  } catch (err) {
    console.error('[RENEWAL-AUTOQUOTE] deal upsert failed:', (err as Error).message);
    return 'skipped';
  }
}

/** The tenant's legacy deal_stages, which deals.stage_id is keyed on (CRMX-005). */
// deno-lint-ignore no-explicit-any
async function loadDealStages(admin: any, tenantId: string): Promise<DealStageRow[]> {
  const { data } = await admin
    .from('deal_stages')
    .select('id, name, sort_order, is_active')
    .eq('tenant_id', tenantId);
  return ((data as DealStageRow[]) || []) as DealStageRow[];
}

interface GenerateCtx {
  // deno-lint-ignore no-explicit-any
  admin: any;
  tenantId: string;
  userId: string;
  url: URL;
  audit: (action: string, extra?: unknown) => void;
}

/**
 * Find active contracts ending in the configured window, re-tier from actual
 * 12-month usage, and create renewal_draft rows. Never auto-sends.
 *
 * Difference from the Express version, same result: that one ran a GROUP BY for
 * the per-machine totals and a second raw-SQL query for the peak month. Here the
 * contract's readings are fetched once and both aggregates are computed in a
 * single pass, because PostgREST has no GROUP BY and adding an RPC for this
 * would put the logic in a third place.
 */
async function generate(req: Request, ctx: GenerateCtx): Promise<Response> {
  const { admin, tenantId, userId, url, audit } = ctx;

  const { data: settingsRow } = await admin
    .from('renewal_autoquote_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  let settings = settingsRow as Row | null;
  if (!settings) {
    await admin.from('renewal_autoquote_settings').insert({ tenant_id: tenantId });
    const { data } = await admin
      .from('renewal_autoquote_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    settings = data as Row | null;
  }
  if (!settings) return createCorsResponse({ message: 'Failed to load settings' }, 500, req);

  const body = (await req.json().catch(() => ({}))) as Row;
  const force = body?.force === true || url.searchParams.get('force') === 'true';
  if (!settings.auto_generate_enabled && !force) {
    return createCorsResponse(
      { skipped: true, reason: 'auto-generate disabled for tenant' },
      200,
      req,
    );
  }

  const now = Date.now();
  const windowStart = new Date(now + settings.days_window_start * 86_400_000);
  const windowEnd = new Date(now + settings.days_window_end * 86_400_000);
  const twelveMonthsAgo = new Date(now - 365 * 86_400_000);
  const buffer = 1 + settings.growth_buffer_pct / 100;

  const { data: candidateRows, error: candErr } = await admin
    .from('contracts')
    .select('id, customer_id, end_date, black_rate, color_rate, monthly_base')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .gte('end_date', windowStart.toISOString())
    .lte('end_date', windowEnd.toISOString());
  if (candErr) throw new Error(candErr.message);
  const candidates = (candidateRows as Row[]) || [];

  const { data: suppRows } = await admin
    .from('renewal_suppressions')
    .select('customer_id')
    .eq('tenant_id', tenantId);
  const suppressed = new Set(((suppRows as Row[]) || []).map((s) => s.customer_id));

  // COP-M06: the full row rather than just the id. A contract that already has
  // a draft is skipped for DRAFTING, but it still has to be reconciled with the
  // pipeline - drafts created before this story exist and have no deal, and a
  // back-fill that needed a separate script would simply never be run.
  const { data: draftRows } = await admin
    .from('renewal_auto_quotes')
    .select(
      'id, contract_id, customer_id, quote_value, contract_end_date, assigned_sales_rep, is_underage, current_monthly_revenue, recommended_monthly_revenue, machine_breakdown',
    )
    .eq('tenant_id', tenantId)
    .in('status', ['renewal_draft', 'sent']);
  const existingDrafts = new Map<string, Row>(
    ((draftRows as Row[]) || []).map((d) => [d.contract_id, d]),
  );

  const { data: tierRows } = await admin
    .from('cpc_rates')
    .select('color_mode, min_volume, max_volume, cpc')
    .eq('tenant_id', tenantId);
  const allTiers = (tierRows as Row[]) || [];
  const blackTiers: CpcTier[] = allTiers
    .filter((t) =>
      String(t.color_mode ?? '')
        .toLowerCase()
        .includes('b'),
    )
    .map((t) => ({ minVolume: t.min_volume ?? 0, maxVolume: t.max_volume, cpc: num(t.cpc) }));
  const colorTiers: CpcTier[] = allTiers
    .filter((t) =>
      String(t.color_mode ?? '')
        .toLowerCase()
        .includes('color'),
    )
    .map((t) => ({ minVolume: t.min_volume ?? 0, maxVolume: t.max_volume, cpc: num(t.cpc) }));

  let generated = 0;
  let skippedSuppressed = 0;
  let skippedExisting = 0;
  let skippedNoUsage = 0;
  // COP-M06 pipeline reconciliation.
  let dealsCreated = 0;
  let dealsUpdated = 0;
  let dealsSkipped = 0;

  const dealStages = await loadDealStages(admin, tenantId);
  const renewalStageId = firstStageId(dealStages);
  /** Candidates that already had a draft; reconciled after the drafting loop. */
  const needsReconcile: Row[] = [];
  const countDeal = (outcome: 'created' | 'updated' | 'unchanged' | 'skipped') => {
    if (outcome === 'created') dealsCreated++;
    else if (outcome === 'updated') dealsUpdated++;
    else if (outcome === 'skipped') dealsSkipped++;
  };

  // The renewal deals these contracts already have, in ONE read rather than one
  // per contract. (tenant, replaces_contract_id, renewal motion) is the natural
  // key the upsert is idempotent on, so this is the same lookup batched.
  const existingDeals = new Map<string, Row>();
  if (candidates.length > 0) {
    const { data: dealRows } = await admin
      .from('deals')
      .select('id, status, amount, expected_close_date, title, replaces_contract_id')
      .eq('tenant_id', tenantId)
      .eq('deal_motion', RENEWAL_DEAL_MOTION)
      .in(
        'replaces_contract_id',
        candidates.map((c) => c.id),
      );
    for (const d of (dealRows as Row[]) || []) {
      if (d.replaces_contract_id) existingDeals.set(d.replaces_contract_id, d);
    }
  }

  // Account names for the deal title, fetched once for every candidate rather
  // than one lookup per contract inside the loop.
  const candidateNames = await companyNames(
    admin,
    tenantId,
    candidates.map((c) => c.customer_id),
  );

  for (const c of candidates) {
    if (suppressed.has(c.customer_id)) {
      skippedSuppressed++;
      continue;
    }
    if (existingDrafts.has(c.id)) {
      skippedExisting++;
      // Reconciled with the pipeline in its own pass below, not here - see the
      // comment on that pass for why it is separate.
      needsReconcile.push(c);
      continue;
    }

    const { data: readingRows } = await admin
      .from('meter_readings')
      .select('equipment_id, reading_date, black_copies, color_copies')
      .eq('tenant_id', tenantId)
      .eq('contract_id', c.id)
      .gte('reading_date', twelveMonthsAgo.toISOString());
    const readings = (readingRows as Row[]) || [];

    const perMachine = new Map<string, { black: number; color: number }>();
    const perMonth = new Map<string, number>();
    for (const r of readings) {
      const black = num(r.black_copies);
      const color = num(r.color_copies);
      const m = perMachine.get(r.equipment_id) ?? { black: 0, color: 0 };
      m.black += black;
      m.color += color;
      perMachine.set(r.equipment_id, m);
      const ym = String(r.reading_date ?? '').slice(0, 7);
      if (ym) perMonth.set(ym, (perMonth.get(ym) ?? 0) + black + color);
    }

    const equipmentIds = [...perMachine.keys()];
    const equipmentById = new Map<string, Row>();
    if (equipmentIds.length) {
      const eqRows = await fetchAllRows<any>(() =>
        admin.from('equipment').select('id, serial_number, model_number').in('id', equipmentIds),
      );
      for (const e of (eqRows as Row[]) || []) equipmentById.set(e.id, e);
    }

    const machineBreakdown = equipmentIds.map((id) => {
      const totals = perMachine.get(id)!;
      const eq = equipmentById.get(id);
      return {
        equipmentId: id,
        serial: eq?.serial_number ?? null,
        model: eq?.model_number ?? null,
        black: totals.black,
        color: totals.color,
      };
    });

    const totalBlack = machineBreakdown.reduce((a, m) => a + m.black, 0);
    const totalColor = machineBreakdown.reduce((a, m) => a + m.color, 0);
    if (totalBlack === 0 && totalColor === 0) {
      skippedNoUsage++;
      continue;
    }

    let peakMonth: string | null = null;
    let peakVolume = 0;
    for (const [ym, vol] of perMonth) {
      if (vol > peakVolume) {
        peakVolume = vol;
        peakMonth = ym;
      }
    }

    const monthlyAvgBlack = totalBlack / 12;
    const monthlyAvgColor = totalColor / 12;

    const blackTier = pickTier(blackTiers, monthlyAvgBlack * buffer);
    const colorTier = pickTier(colorTiers, monthlyAvgColor * buffer);
    const currentBlackRate = num(c.black_rate);
    const currentColorRate = num(c.color_rate);
    const currentMonthlyBase = num(c.monthly_base);
    const recBlackRate = blackTier ? blackTier.cpc : currentBlackRate;
    const recColorRate = colorTier ? colorTier.cpc : currentColorRate;
    const recMonthlyBase = currentMonthlyBase;

    const currentMonthlyRevenue =
      monthlyAvgBlack * currentBlackRate + monthlyAvgColor * currentColorRate + currentMonthlyBase;
    const recommendedMonthlyRevenue =
      monthlyAvgBlack * recBlackRate + monthlyAvgColor * recColorRate + recMonthlyBase;
    const isUnderage =
      currentMonthlyRevenue > 0 &&
      recommendedMonthlyRevenue >=
        currentMonthlyRevenue * (1 + settings.underage_threshold_pct / 100);

    const lineItems = [
      {
        type: 'base',
        description: 'Monthly base charge',
        quantity: 1,
        rate: recMonthlyBase,
        amount: recMonthlyBase,
      },
      {
        type: 'cpc_black',
        description: 'B/W cost-per-copy (projected monthly volume)',
        quantity: Math.round(monthlyAvgBlack),
        rate: recBlackRate,
        amount: monthlyAvgBlack * recBlackRate,
      },
      {
        type: 'cpc_color',
        description: 'Color cost-per-copy (projected monthly volume)',
        quantity: Math.round(monthlyAvgColor),
        rate: recColorRate,
        amount: monthlyAvgColor * recColorRate,
      },
    ];

    const { data: customer } = await admin
      .from('business_records')
      .select('assigned_sales_rep')
      .eq('id', c.customer_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    await admin.from('renewal_auto_quotes').insert({
      tenant_id: tenantId,
      contract_id: c.id,
      parent_contract_id: c.id,
      customer_id: c.customer_id,
      status: 'renewal_draft',
      assigned_sales_rep: (customer as Row | null)?.assigned_sales_rep ?? null,
      contract_end_date: c.end_date,
      expiration_date: new Date(now + settings.expiration_days * 86_400_000).toISOString(),
      total_black_pages: Math.round(totalBlack),
      total_color_pages: Math.round(totalColor),
      monthly_avg_black: monthlyAvgBlack,
      monthly_avg_color: monthlyAvgColor,
      peak_month: peakMonth,
      peak_volume: Math.round(peakVolume),
      machine_breakdown: machineBreakdown,
      current_black_rate: currentBlackRate,
      current_color_rate: currentColorRate,
      current_monthly_base: currentMonthlyBase,
      recommended_black_rate: recBlackRate,
      recommended_color_rate: recColorRate,
      recommended_monthly_base: recMonthlyBase,
      current_monthly_revenue: currentMonthlyRevenue,
      recommended_monthly_revenue: recommendedMonthlyRevenue,
      is_underage: isUnderage,
      retier_detail: {
        growthBufferPct: settings.growth_buffer_pct,
        blackTier,
        colorTier,
        note:
          blackTier || colorTier
            ? 'Re-tiered from cpc_rates volume bands.'
            : 'No cpc_rates tiers found; kept current rates.',
      },
      line_items: lineItems,
      quote_value: recommendedMonthlyRevenue * 12,
    });
    generated++;

    // COP-M06: the draft lands on the board as a deal in the same pass, so a
    // rep sees it where they work rather than only on the renewal page.
    // Suppressed customers never reach here - the suppression check is above
    // the draft insert, so AC6 holds without a second guard.
    countDeal(
      await upsertRenewalDeal(admin, {
        tenantId,
        fallbackUserId: userId,
        stageId: renewalStageId,
        facts: {
          contractId: c.id,
          customerId: c.customer_id,
          companyName: candidateNames.get(c.customer_id) ?? null,
          quoteValue: recommendedMonthlyRevenue * 12,
          contractEndDate: c.end_date,
          assignedSalesRep: (customer as Row | null)?.assigned_sales_rep ?? null,
          isUnderage,
          currentMonthlyRevenue,
          recommendedMonthlyRevenue,
        },
        equipmentIds,
        existing: existingDeals.get(c.id) ?? null,
      }),
    );
  }

  // COP-M06: reconcile the contracts that already had a draft.
  //
  // A SEPARATE PASS, not a branch inside the loop above, for two reasons. The
  // drafting loop is long enough already - it computes 12 months of usage, a
  // re-tier and a line-item set per contract - and burying a second concern in
  // its first ten lines is how nobody finds either. And these are the drafts
  // that predate this story: they have no deal, and a back-fill needing a
  // separate script is a back-fill nobody runs.
  for (const c of needsReconcile) {
    const draft = existingDrafts.get(c.id);
    if (!draft) continue;
    const machines = Array.isArray(draft.machine_breakdown)
      ? (draft.machine_breakdown as Row[])
          .map((m) => m?.equipmentId)
          .filter((id): id is string => typeof id === 'string')
      : [];
    countDeal(
      await upsertRenewalDeal(admin, {
        tenantId,
        fallbackUserId: userId,
        stageId: renewalStageId,
        facts: {
          contractId: c.id,
          customerId: draft.customer_id ?? c.customer_id,
          companyName: candidateNames.get(c.customer_id) ?? null,
          quoteValue: num(draft.quote_value),
          contractEndDate: draft.contract_end_date ?? c.end_date,
          assignedSalesRep: draft.assigned_sales_rep ?? null,
          isUnderage: draft.is_underage ?? false,
          currentMonthlyRevenue: num(draft.current_monthly_revenue),
          recommendedMonthlyRevenue: num(draft.recommended_monthly_revenue),
        },
        equipmentIds: machines,
        existing: existingDeals.get(c.id) ?? null,
      }),
    );
  }

  const summary = {
    scanned: candidates.length,
    generated,
    skippedSuppressed,
    skippedExisting,
    skippedNoUsage,
    dealsCreated,
    dealsUpdated,
    dealsSkipped,
  };
  audit('GENERATE', summary);

  return createCorsResponse(summary, 200, req);
}
