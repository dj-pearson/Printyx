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
import { applyUserScope, resolveScope } from '../_shared/scope.ts';
import {
  resolveTerritoryFilter,
  territoryMembership,
} from '../../../shared/territory-membership.ts';
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

  // AC8: paged, not capped. A tenant with a large installed base must be
  // scanned whole - a flat .limit() re-finds the same first page every night
  // and the tail is never looked at (the shape COP-I01 found on the board and
  // the deal-desk SLA sweep found on a schedule, where it is worse).
  const equipment = await fetchAllRows<Row>(() =>
    admin
      .from('equipment')
      .select(
        'id, customer_id, serial_number, model_number, is_color_capable, equipment_status, lease_expires_date, purchase_price',
      )
      .eq('tenant_id', tenantId),
  );

  const contracts = await fetchAllRows<Row>(() =>
    admin
      .from('contracts')
      .select('id, customer_id, end_date, status, monthly_base, black_rate, color_rate')
      .eq('tenant_id', tenantId),
  );

  const equipmentIds = equipment.map((e) => String(e.id));

  /**
   * PostgREST has no GROUP BY, so the per-machine monthly volume is aggregated
   * here from the raw readings - the same division of labour every aggregate in
   * this tree uses.
   *
   * VOLUME COMES FROM THE LIFETIME COUNTERS, not the stored delta columns
   * (COP-B05): `black_copies`/`color_copies` DEFAULT TO 0, so a row nobody
   * finished importing is indistinguishable from a month in which the machine
   * printed nothing, and a volume play built on that fires on a machine that is
   * simply unmeasured.
   */
  const readings = equipmentIds.length
    ? await fetchAllRows<Row>(() =>
        admin
          .from('meter_readings')
          .select('equipment_id, reading_date, bw_meter_reading, color_meter_reading')
          .eq('tenant_id', tenantId)
          .order('reading_date', { ascending: true }),
      )
    : [];

  const byMachine = new Map<string, Row[]>();
  for (const row of readings) {
    const id = row.equipment_id ? String(row.equipment_id) : null;
    if (!id) continue;
    const list = byMachine.get(id);
    if (list) list.push(row);
    else byMachine.set(id, [row]);
  }

  const meters: RadarMeterSummary[] = [];
  for (const [equipmentId, rows] of byMachine) {
    const last = rows[rows.length - 1];
    const lastReadingDate = last?.reading_date ? String(last.reading_date) : null;
    // Two readings are the minimum for a rate: one counter is a position, not a
    // volume. Fewer, and the machine is reported with zero volume and a last
    // reading date, which is what the meter-silence play is for.
    if (rows.length < 2) {
      meters.push({ equipmentId, monthlyBlack: 0, monthlyColor: 0, lastReadingDate });
      continue;
    }
    const first = rows[0];
    const spanMs = Date.parse(String(last.reading_date)) - Date.parse(String(first.reading_date));
    const months = spanMs > 0 ? spanMs / (30.44 * 86400000) : 0;
    const deltaBlack = Number(last.bw_meter_reading ?? 0) - Number(first.bw_meter_reading ?? 0);
    const deltaColor =
      Number(last.color_meter_reading ?? 0) - Number(first.color_meter_reading ?? 0);
    // A counter that reads LOWER than it did is a meter reset or a swapped
    // machine, not negative printing (COP-B05).
    meters.push({
      equipmentId,
      monthlyBlack: months > 0 && deltaBlack >= 0 ? deltaBlack / months : 0,
      monthlyColor: months > 0 && deltaColor >= 0 ? deltaColor / months : 0,
      lastReadingDate,
    });
  }

  /**
   * Service CALLS inside the lookback, per machine. The unbacked note below
   * says why it is calls: no service cost column exists anywhere in the schema,
   * so a cost or margin threshold cannot be computed and is not pretended.
   */
  const lookbackFrom = new Date(
    now.getTime() - thresholds.serviceLookbackDays * 86400000,
  ).toISOString();
  const tickets = await fetchAllRows<Row>(() =>
    admin
      .from('service_tickets')
      .select('equipment_id, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', lookbackFrom),
  );
  const serviceCalls = new Map<string, number>();
  for (const t of tickets) {
    const id = t.equipment_id ? String(t.equipment_id) : null;
    if (!id) continue;
    serviceCalls.set(id, (serviceCalls.get(id) ?? 0) + 1);
  }

  // Readable reasons need the account name; a play that says "lease expiring on
  // 3f2a-..." is a play nobody acts on.
  const customerIds = [
    ...new Set(
      [...equipment, ...contracts]
        .map((r) => (r.customer_id ? String(r.customer_id) : null))
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const companyNames = new Map<string, string>();
  if (customerIds.length > 0) {
    const records = await fetchAllRows<Row>(() =>
      admin
        .from('business_records')
        .select('id, company_name')
        .eq('tenant_id', tenantId)
        .in('id', customerIds),
    );
    for (const r of records) {
      if (r.id) companyNames.set(String(r.id), String(r.company_name ?? ''));
    }
  }

  const drafts = detectPlays({
    equipment: equipment as never,
    contracts: contracts as never,
    meters,
    serviceCalls,
    companyNames,
    thresholds,
    now,
  });

  /**
   * AC7's idempotency is the UNIQUE INDEX (tenant_id, dedupe_key), not a
   * scan-time lookup: two sweeps overlapping would both read "not present" and
   * both insert. `ignoreDuplicates` turns the re-run into a no-op, and the
   * count of what was actually written is what the response reports - so
   * `detected - created` reads as the dedupe working rather than as a failure.
   */
  let inserted = 0;
  if (drafts.length > 0) {
    const payload = drafts.map((d) => ({
      tenant_id: tenantId,
      play_type: d.playType,
      dedupe_key: d.dedupeKey,
      customer_id: d.customerId,
      company_name: d.customerId ? (companyNames.get(d.customerId) ?? null) : null,
      equipment_ids: d.equipmentIds,
      contract_id: d.contractId,
      reason: d.reason,
      trigger_date: d.triggerDate,
      estimated_value: d.estimatedValue,
      score: d.score,
      score_factors: d.scoreFactors,
      status: 'open',
      detected_at: now.toISOString(),
      updated_at: now.toISOString(),
    }));
    const { data: written, error } = await admin
      .from('radar_plays')
      .upsert(payload, { onConflict: 'tenant_id,dedupe_key', ignoreDuplicates: true })
      .select('id');
    if (error) {
      console.error('[RADAR] insert failed:', error.message);
      throw new Error(`radar_plays insert failed: ${error.message}`);
    }
    inserted = (written ?? []).length;
  }

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

      /**
       * The same scope the list applies, applied to the row this acts ON.
       *
       * Filtering the list and leaving the item open is a half-measure: a play
       * id is a uuid, but ids travel in URLs, exports and support tickets, and
       * hard-to-guess is not an authorisation check (SEC-TENANT-005 makes
       * exactly this point about update filters). Dismissing another rep's
       * play removes it from their board, and converting one creates a deal
       * in their name - both are writes on somebody else's book.
       *
       * An UNOWNED play stays actionable for anyone who can see it, which is
       * what `applyUserScope`'s own default encodes: nobody is deprived of a
       * play nobody has claimed.
       */
      const itemScope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
      });
      const playOwner = (play as Row).owner_id ? String((play as Row).owner_id) : null;
      const inScope =
        itemScope.userIds === null || playOwner === null || itemScope.userIds.includes(playOwner);
      if (!inScope) {
        return createCorsResponse(
          {
            error: 'That play belongs to another rep',
            code: 'OUT_OF_SCOPE',
            scopeTier: itemScope.tier,
          },
          403,
          req,
        );
      }

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

        /**
         * NOT best effort. This is AC6's outcome record, and the deal above
         * has already been created - so a discarded error here leaves a play
         * that still reads `open` pointing at nothing, and the next rep to
         * look converts it again into a SECOND deal for the same trigger.
         * The idempotency the story asks for lives in this row.
         */
        const { error: outcomeError } = await admin
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
          {
            dealId: (deal as Row).id,
            equipmentAttached: equipmentIds.length,
            // The deal is real either way; the caller needs to know the play
            // was not closed so it can be dismissed by hand rather than
            // converted twice.
            outcomeRecorded: !outcomeError,
            ...(outcomeError
              ? {
                  warning: `The deal was created but this play could not be marked converted (${outcomeError.message}). Dismiss it manually so it is not converted again.`,
                }
              : {}),
          },
          201,
          req,
        );
      }

      return createCorsResponse({ error: 'Not found' }, 404, req);
    }

    // ─── GET / (AC4's ranking and scoping) ───────────────────────────
    if (req.method === 'GET' && !resource) {
      /**
       * AC4's "and RBAC scope", which this branch did not have.
       *
       * `?mine=true` was the only ownership filter, and a filter the CALLER
       * chooses is not an access check - omitting it returned up to 500 plays
       * from across the whole tenant, each carrying an account name, the
       * machines, the trigger and an estimated dollar value. Every rep could
       * read every other rep's book of opportunities by dropping one query
       * parameter. Same shape as COP-I06's forecast categories, and the fix is
       * the same: THE SCOPE GOES ON FIRST and the query parameters filter
       * inside it. Applied before `mine` and before `playType`, so a parameter
       * can only ever narrow what the tier already allows.
       *
       * `radar_plays.owner_id` is inherited from the account, so it is null
       * for an unowned account. `applyUserScope` includes unowned rows for any
       * tier above 'own' by default, which is the behaviour wanted here: a rep
       * sees their own book, a manager also sees what nobody has picked up.
       */
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      });

      let query = admin
        .from('radar_plays')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', url.searchParams.get('status') || 'open')
        .order('score', { ascending: false })
        .limit(500);

      query = applyUserScope(query, 'owner_id', scope);

      const playType = url.searchParams.get('playType');
      if (playType) query = query.eq('play_type', playType);
      // `mine` narrows within the scope above; it never widens it.
      if (url.searchParams.get('mine') === 'true') query = query.eq('owner_id', user.id);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let rows = (data ?? []).map(toPlayResponse);

      /**
       * COP-B09 AC4 and AC3's second half.
       *
       * AC4's territory scoping was here; AC3's "reps see their territory by
       * DEFAULT" was not, so a rep had to know the filter existed and pick
       * their own territory out of a list to get their own plays. The default
       * now comes from the caller's membership, and `?territory=all` is how a
       * manager rolls up - an explicit request always wins, so nobody is
       * trapped in a default.
       *
       * A person with no territory, or whose only relationship is managerial,
       * gets NO narrowing: `resolveTerritoryFilter` returns null rather than
       * an empty list, because filtering to nothing would show a rep an empty
       * board and let them conclude they have no work.
       *
       * Resolved through the shared resolver over `business_records.territory`
       * rather than a column on the play, so a territory renamed or defined
       * after a scan takes effect immediately instead of needing a re-scan.
       */
      const requestedTerritory = url.searchParams.get('territory');
      const territoryRows = await fetchAllRows<Row>(() =>
        admin
          .from('sales_territories')
          .select(
            'id, territory_name, territory_code, is_active, owner_id, manager_id, team_members',
          )
          .eq('tenant_id', tenantId),
      );
      const membership = territoryMembership(
        (territoryRows ?? []).map((t) => ({
          id: String(t.id),
          ownerId: (t.owner_id as string) ?? null,
          teamMembers: (t.team_members as string[]) ?? null,
          managerId: (t.manager_id as string) ?? null,
          isActive: t.is_active as boolean,
        })),
        user.id,
      );
      const { territoryIds, source: territorySource } = resolveTerritoryFilter(
        requestedTerritory,
        membership,
      );

      if (territoryIds) {
        const wanted = new Set(territoryIds);
        const accountIds = [...new Set(rows.map((p) => p.customerId).filter(Boolean))] as string[];
        // The territory rows were already read above for the membership, so
        // this reuses them rather than asking twice for the same table.
        const accounts =
          accountIds.length > 0
            ? await fetchAllRows<Row>(() =>
                admin
                  .from('business_records')
                  .select('id, territory')
                  .eq('tenant_id', tenantId)
                  .in('id', accountIds),
              )
            : [];
        const index = buildTerritoryIndex(
          (territoryRows ?? []).filter((t) => t.is_active !== false),
        );
        const territoryByAccount = new Map(
          (accounts ?? []).map((a) => [a.id, resolveTerritory(a.territory, index)]),
        );
        rows = rows.filter((play) => {
          const resolved = play.customerId ? territoryByAccount.get(play.customerId) : null;
          return resolved?.territory ? wanted.has(String(resolved.territory.id)) : false;
        });
      }

      return createCorsResponse(
        {
          data: rows,
          total: rows.length,
          // COP-I06: a narrowed list that does not say it was narrowed is a
          // wrong number rather than a safe one. A rep seeing fewer plays than
          // their manager should be able to tell that is why.
          scopeTier: scope.tier,
          coversWholeTenant: scope.userIds === null,
          degradedFrom: scope.degradedFrom,
          // AC3: which territories these plays came from and WHY, so a rep can
          // tell a default from a choice and a manager knows to ask for `all`.
          territoryIds,
          territorySource,
          territoryRole: membership.role,
          unbacked: territoryIds
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
