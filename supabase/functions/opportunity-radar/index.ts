// Installed-Base Opportunity Radar (COP-B04).
//
// Endpoints (the dispatcher strips the function-name segment first):
//   GET    /                    ranked open plays (?status=, ?playType=, ?mine=true)
//   POST   /scan                run the detection sweep
//   GET    /settings  PUT /settings
//   POST   /:id/dismiss         records the outcome
//   POST   /:id/convert         one-click into a deal, equipment attached
//
// THE SCAN IS CHUNKED AND THE AGGREGATION IS IN MEMORY (AC8). PostgREST has no
// GROUP BY, so meter readings come back per row and are summarised here; every
// read is paged through fetchAllRows so a dealer with 4,000 machines is not cut
// off at PostgREST's silent 1,000-row cap.
//
// IDEMPOTENCY IS THE UNIQUE INDEX, NOT A LOOKUP (AC7). The scan inserts with
// ignoreDuplicates against radar_plays_dedupe_uq, so a second run of the same
// day collides instead of doubling every play. Proven against a real Postgres.
//
// WHAT THE DATA CANNOT ANSWER, reported rather than implied: there is no
// service COST column anywhere in the schema, so the service play counts calls.
// The scan returns that in `unbacked` and the page renders it.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import { isCronRequest } from '../_shared/cron-auth.ts';
import type { AuthContext } from '../_shared/auth.ts';
import { firstStageId, type DealStageRow } from '../_shared/deal-stage.ts';
import { buildTerritoryIndex, resolveTerritory } from '../_shared/territory.ts';
import {
  DEFAULT_THRESHOLDS,
  dealFromPlay,
  detectPlays,
  type RadarMeterSummary,
  type RadarThresholds,
} from '../_shared/opportunity-radar.ts';

type Row = Record<string, any>;

const SETTINGS_COLUMNS: Array<[keyof RadarThresholds, string]> = [
  ['leaseWindowDays', 'lease_window_days'],
  ['contractWindowDays', 'contract_window_days'],
  ['volumeOveragePct', 'volume_overage_pct'],
  ['serviceCallThreshold', 'service_call_threshold'],
  ['serviceLookbackDays', 'service_lookback_days'],
  ['colorUnderusePct', 'color_underuse_pct'],
  ['meterSilenceDays', 'meter_silence_days'],
];

function toThresholds(row: Row | null): RadarThresholds {
  if (!row) return { ...DEFAULT_THRESHOLDS };
  const out = { ...DEFAULT_THRESHOLDS };
  for (const [key, column] of SETTINGS_COLUMNS) {
    const value = Number(row[column]);
    if (Number.isFinite(value) && value > 0) out[key] = value;
  }
  return out;
}

function toPlayResponse(row: Row) {
  return {
    id: row.id,
    playType: row.play_type,
    customerId: row.customer_id,
    companyName: row.company_name,
    equipmentIds: row.equipment_ids ?? [],
    contractId: row.contract_id,
    reason: row.reason,
    triggerDate: row.trigger_date,
    estimatedValue: row.estimated_value != null ? Number(row.estimated_value) : null,
    score: row.score,
    scoreFactors: row.score_factors ?? {},
    ownerId: row.owner_id,
    status: row.status,
    dealId: row.deal_id,
    detectedAt: row.detected_at,
  };
}

/**
 * One tenant's sweep. Extracted so the manual button and the nightly cron run
 * the SAME code - a scheduled scan that drifted from the one a manager can
 * press would be two radars, and only one of them ever gets looked at.
 */
async function runScan(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  force: boolean,
): Promise<Row> {
  const { data: settings } = await admin
    .from('radar_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const settingsRow = (settings as Row) ?? null;

  // AC5's kill switch: a tenant that turned the scan off gets a skip, not a
  // silent no-op that looks like "nothing to find". A tenant with NO settings
  // row is enabled - the radar is on by default and opted out of, which is why
  // the test is `settingsRow &&` rather than a truthiness check on the column.
  if (settingsRow && settingsRow.scan_enabled === 0 && !force) {
    return { skipped: true, reason: 'Radar scan is disabled for this tenant' };
  }

  const thresholds = toThresholds(settingsRow);
  const now = new Date();

  return {
    detected: drafts.length,
    created: inserted,
    // detected - created is the idempotency working, not a failure.
    alreadyKnown: drafts.length - inserted,
    machinesScanned: (equipment ?? []).length,
    unbacked: [
      'The service play counts CALLS, not cost: no service cost column exists on service_tickets or anywhere else in the schema, so a cost or margin threshold cannot be computed.',
    ],
  };
}

/**
 * Every tenant, one at a time, with one tenant's failure costing that tenant
 * only.
 *
 * SEQUENTIAL ON PURPOSE. Each tenant's scan already pages through its whole
 * installed base (AC8), so running fifty in parallel would multiply the peak
 * load on the database by fifty to finish a nightly job a few minutes sooner.
 *
 * A tenant that throws is RECORDED AND STEPPED OVER rather than aborting the
 * sweep - the failure mode to avoid is the one AUDIT-028 describes, where one
 * missing table blanks a whole surface. The response names every tenant that
 * failed and why, so a silent partial sweep is not mistaken for a quiet night.
 */
async function sweepAllTenants(req: Request, url: URL): Promise<Response> {
  const admin = createSupabaseServiceClient();
  const force = url.searchParams.get('force') === 'true';
  const limit = Number(url.searchParams.get('limit')) || 0;

  const { data: tenantRows, error } = await admin.from('tenants').select('id').order('id');
  if (error) {
    return createCorsResponse({ error: 'Could not list tenants', detail: error.message }, 503, req);
  }

  const tenants = (tenantRows ?? []).map((t: Row) => t.id as string);
  const scanned: Row[] = [];
  const skipped: string[] = [];
  const failed: Row[] = [];

  for (const tenantId of limit > 0 ? tenants.slice(0, limit) : tenants) {
    try {
      const result = await runScan(admin, tenantId, force);
      if (result.skipped) {
        skipped.push(tenantId);
        continue;
      }
      scanned.push({ tenantId, detected: result.detected, created: result.created });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[RADAR] tenant ${tenantId} sweep failed:`, message);
      failed.push({ tenantId, error: message });
    }
  }

  return createCorsResponse(
    {
      tenants: tenants.length,
      scanned: scanned.length,
      skipped: skipped.length,
      failed: failed.length,
      created: scanned.reduce((sum, r) => sum + (Number(r.created) || 0), 0),
      failures: failed,
    },
    // A sweep where every tenant failed is not a success with a detail field.
    failed.length > 0 && scanned.length === 0 ? 500 : 200,
    req,
  );
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    /**
     * POST /scan/all - the SCHEDULED sweep (AC1, AC5).
     *
     * This has to sit above auth.getUser, because pg_cron carries the internal
     * cron token and no user JWT - `isCronRequest` is the whole authentication
     * for this branch and there is no fallback to a user, deliberately: a
     * tenant-wide sweep across EVERY tenant is not something any user should be
     * able to trigger. A manager runs their own tenant's scan through
     * POST /scan.
     *
     * Until this existed the radar only ever ran when somebody pressed the
     * button on /opportunity-radar - AC1 asks for a scheduled scan, and a play
     * that surfaces a lease expiring in 90 days is worth nothing if it is
     * detected the day a rep happens to look.
     */
    {
      const cronUrl = new URL(req.url);
      const { parts: cronParts } = normalizePath(cronUrl.pathname, 'opportunity-radar');
      if (cronParts[0] === 'scan' && cronParts[1] === 'all' && req.method === 'POST') {
        if (!isCronRequest(req)) {
          return createCorsResponse(
            { error: 'This endpoint is for the scheduler', code: 'CRON_ONLY' },
            403,
            req,
          );
        }
        return await sweepAllTenants(req, cronUrl);
      }
    }

    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    /**
     * Reading and working plays is a REP's job and is open to any tenant
     * member - a radar a rep cannot see is the status quo this story ends.
     * Running the sweep and setting the thresholds are management acts: the
     * scan writes rows for the whole tenant, and a threshold change reshapes
     * every rep's list.
     *
     * A LEVEL check, not a permission code (SEC-EDGE-002: the codes the Express
     * gates name are not the codes any seeder creates).
     */
    const authCtx: AuthContext = {
      userId: user.id,
      tenantId,
      email: user.email,
      jwt: jwt ?? '',
      supabaseUser: user,
    };
    const requireManager = () => requireRoleLevel(authCtx, ROLE_LEVEL.MANAGER);
    const denyManager = (err: unknown) => {
      if (err instanceof RbacError) {
        return createCorsResponse(
          {
            error: 'Running the radar scan and changing its thresholds require a manager role',
            code: 'INSUFFICIENT_ROLE',
            details: err.details,
          },
          403,
          req,
        );
      }
      throw err;
    };

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'opportunity-radar');
    const resource = parts[0];
    const action = parts[1];

    const loadSettings = async (): Promise<Row | null> => {
      const { data } = await admin
        .from('radar_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return (data as Row) ?? null;
    };

    // ─── /settings (AC5) ─────────────────────────────────────────────
    if (resource === 'settings') {
      if (req.method === 'GET') {
        const row = await loadSettings();
        return createCorsResponse(
          { ...toThresholds(row), scanEnabled: row ? row.scan_enabled !== 0 : true },
          200,
          req,
        );
      }
      if (req.method === 'PUT') {
        try {
          requireManager();
        } catch (err) {
          return denyManager(err);
        }
        const body = (await req.json().catch(() => ({}))) as Row;
        const values: Row = { tenant_id: tenantId, updated_by_user_id: user.id };
        for (const [key, column] of SETTINGS_COLUMNS) {
          const value = Number(body[key]);
          // A threshold of zero would make every machine a play; refuse rather
          // than store it.
          if (Number.isFinite(value) && value > 0) values[column] = Math.round(value);
        }
        if (body.scanEnabled !== undefined) values.scan_enabled = body.scanEnabled ? 1 : 0;

        const { data, error } = await admin
          .from('radar_settings')
          .upsert(values, { onConflict: 'tenant_id' })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return createCorsResponse(
          { ...toThresholds(data as Row), scanEnabled: (data as Row).scan_enabled !== 0 },
          200,
          req,
        );
      }
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // ─── POST /scan (AC1) ────────────────────────────────────────────
    if (resource === 'scan' && req.method === 'POST') {
      try {
        requireManager();
      } catch (err) {
        return denyManager(err);
      }
      const result = await runScan(admin, tenantId, url.searchParams.get('force') === 'true');
      return createCorsResponse(result, 200, req);
    }

    // ─── POST /:id/dismiss and /:id/convert (AC3, AC6) ───────────────
    if (resource && action) {
      const { data: play } = await admin
        .from('radar_plays')
        .select('*')
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!play) return createCorsResponse({ error: 'Play not found' }, 404, req);

      if (action === 'dismiss' && req.method === 'POST') {
        const body = (await req.json().catch(() => ({}))) as Row;
        const { error } = await admin
          .from('radar_plays')
          .update({
            status: 'dismissed',
            dismissed_reason: body.reason ? String(body.reason).slice(0, 255) : null,
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', resource)
          .eq('tenant_id', tenantId);
        if (error) throw new Error(error.message);
        return createCorsResponse({ success: true, id: resource }, 200, req);
      }

      if (action === 'convert' && req.method === 'POST') {
        if ((play as Row).status === 'converted' && (play as Row).deal_id) {
          // Already converted. Answering with the existing deal beats creating
          // a second one because somebody double-clicked.
          return createCorsResponse(
            { dealId: (play as Row).deal_id, alreadyConverted: true },
            200,
            req,
          );
        }

        const { data: stageRows } = await admin
          .from('deal_stages')
          .select('id, name, sort_order, is_active')
          .eq('tenant_id', tenantId);
        const stageId = firstStageId((stageRows ?? []) as DealStageRow[]);
        if (!stageId) {
          // deals.stage_id is NOT NULL, so this is a setup gap to name, not a 500.
          return createCorsResponse(
            {
              error: 'This tenant has no pipeline stages, so a deal cannot be created.',
              code: 'NO_STAGES',
            },
            409,
            req,
          );
        }

        const row = play as Row;
        const { data: deal, error: dealError } = await admin
          .from('deals')
          .insert(
            dealFromPlay(
              {
                playType: row.play_type,
                dedupeKey: row.dedupe_key,
                customerId: row.customer_id,
                equipmentIds: row.equipment_ids ?? [],
                contractId: row.contract_id,
                reason: row.reason,
                triggerDate: row.trigger_date,
                estimatedValue: row.estimated_value != null ? Number(row.estimated_value) : null,
                score: row.score,
                scoreFactors: row.score_factors ?? {},
                companyName: row.company_name,
              },
              { tenantId, stageId, ownerId: row.owner_id || user.id },
            ),
          )
          .select('id')
          .single();
        if (dealError) throw new Error(dealError.message);

        // AC3's second half: the COP-M05 equipment associations, so the rep
        // does not re-attach machines the play already named.
        const equipmentIds: string[] = Array.isArray(row.equipment_ids) ? row.equipment_ids : [];
        if (equipmentIds.length > 0) {
          const { error: linkError } = await admin.from('crm_associations').upsert(
            equipmentIds.map((equipmentId) => ({
              tenant_id: tenantId,
              source_type: 'deal',
              source_id: (deal as Row).id,
              target_type: 'equipment',
              target_id: equipmentId,
              // These are the machines the play is ABOUT - the ones going out.
              relation: 'replaces',
              created_by: user.id,
            })),
            {
              onConflict: 'tenant_id,source_type,source_id,target_type,target_id,relation',
              ignoreDuplicates: true,
            },
          );
          if (linkError) console.error('[RADAR] equipment link failed:', linkError.message);
        }

        await admin
          .from('radar_plays')
          .update({
            status: 'converted',
            deal_id: (deal as Row).id,
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', resource)
          .eq('tenant_id', tenantId);

        return createCorsResponse(
          { dealId: (deal as Row).id, equipmentAttached: equipmentIds.length },
          201,
          req,
        );
      }

      return createCorsResponse({ error: 'Not found' }, 404, req);
    }

    // ─── GET / (AC4's ranking and scoping) ───────────────────────────
    if (req.method === 'GET' && !resource) {
      let query = admin
        .from('radar_plays')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', url.searchParams.get('status') || 'open')
        .order('score', { ascending: false })
        .limit(500);

      const playType = url.searchParams.get('playType');
      if (playType) query = query.eq('play_type', playType);
      // Ownership scoping. Territory scoping is COP-B09 and does not exist.
      if (url.searchParams.get('mine') === 'true') query = query.eq('owner_id', user.id);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let rows = (data ?? []).map(toPlayResponse);

      // COP-B09 AC4: territory scoping. Resolved through the shared resolver
      // over business_records.territory rather than a column on the play, so a
      // territory renamed or defined after a scan takes effect immediately
      // instead of needing a re-scan.
      const territoryFilter = url.searchParams.get('territory');
      if (territoryFilter) {
        const accountIds = [...new Set(rows.map((p) => p.customerId).filter(Boolean))] as string[];
        const [territories, accounts] = await Promise.all([
          fetchAllRows<Row>(() =>
            admin
              .from('sales_territories')
              .select('id, territory_name, territory_code, is_active')
              .eq('tenant_id', tenantId),
          ),
          accountIds.length > 0
            ? fetchAllRows<Row>(() =>
                admin
                  .from('business_records')
                  .select('id, territory')
                  .eq('tenant_id', tenantId)
                  .in('id', accountIds),
              )
            : Promise.resolve([]),
        ]);
        const index = buildTerritoryIndex((territories ?? []).filter((t) => t.is_active !== false));
        const territoryByAccount = new Map(
          (accounts ?? []).map((a) => [a.id, resolveTerritory(a.territory, index)]),
        );
        rows = rows.filter((play) => {
          const resolved = play.customerId ? territoryByAccount.get(play.customerId) : null;
          return resolved?.territory ? String(resolved.territory.id) === territoryFilter : false;
        });
      }

      return createCorsResponse(
        {
          data: rows,
          total: rows.length,
          unbacked: territoryFilter
            ? []
            : [
                'Plays are scoped by account ownership. Filter by territory to scope them that way instead - territory is resolved from the account, so an account with no territory recorded appears only in the unfiltered list.',
              ],
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[OPPORTUNITY-RADAR] error:', error);
    return createCorsResponse(
      { error: 'Request failed', message: (error as Error).message },
      500,
      req,
    );
  }
}
