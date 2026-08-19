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

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
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

  const { data: draftRows } = await admin
    .from('renewal_auto_quotes')
    .select('contract_id')
    .eq('tenant_id', tenantId)
    .in('status', ['renewal_draft', 'sent']);
  const alreadyDrafted = new Set(((draftRows as Row[]) || []).map((d) => d.contract_id));

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

  for (const c of candidates) {
    if (suppressed.has(c.customer_id)) {
      skippedSuppressed++;
      continue;
    }
    if (alreadyDrafted.has(c.id)) {
      skippedExisting++;
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
      const { data: eqRows } = await admin
        .from('equipment')
        .select('id, serial_number, model_number')
        .in('id', equipmentIds);
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
  }

  audit('GENERATE', {
    scanned: candidates.length,
    generated,
    skippedSuppressed,
    skippedExisting,
    skippedNoUsage,
  });

  return createCorsResponse(
    { scanned: candidates.length, generated, skippedSuppressed, skippedExisting, skippedNoUsage },
    200,
    req,
  );
}
