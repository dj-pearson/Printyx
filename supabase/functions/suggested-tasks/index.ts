// Suggested Tasks (COP-B03).
//
// Endpoints (the dispatcher strips the function-name segment first):
//   GET    /                  ranked open suggestions (?mine=true, ?type=)
//   POST   /sweep             recompute every live signal, expire the rest
//   GET    /settings  PUT /settings
//   POST   /:id/dismiss       records the dismissal (AC6)
//   POST   /:id/complete      the rep did the thing
//
// AC4 IS A SET DIFFERENCE AND THAT IS THE WHOLE DESIGN. The sweep computes
// every live key, upserts them (colliding on the unique index rather than
// duplicating - AC7), and then expires every OPEN row whose key the sweep did
// not produce. Nothing has to remember to retract a suggestion: the rep logs
// the call, `gone_quiet` stops being a risk on that deal, its key is absent,
// and the row expires. Disabling a suggestion type expires its open rows by
// exactly the same mechanism, because a disabled type emits no keys.
//
// A DISMISSAL AND A COMPLETION ARE BOTH TERMINAL (AC6). The unique index is on
// (tenant_id, dedupe_key) regardless of status, so a sweep that still sees the
// condition collides with the dismissed row and leaves it alone - it does not
// argue with a rep who has already said they know. The cost of that choice,
// stated rather than hidden: a rep who marks "call the contact" done without
// logging the call will not be asked again, and the deal's own record page is
// then the only place the risk still shows.
//
// DEVIATION FROM AC1, DELIBERATE. AC1 asks for generation on the workflow
// runtime via dispatchWorkflowEvent. That runtime cannot carry this feature
// today: CRMX-008a is open, an edge enrolment can only QUEUE, and the step
// executor is Node-only, so binding a rep-facing list to it would ship
// something nobody can see. This is a sweep endpoint, the same shape COP-B04's
// radar scan already uses, and it is callable from a workflow action or pg_cron
// the day that runtime closes.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import {
  DEFAULT_SUGGESTION_THRESHOLDS,
  expireKeys,
  rankSuggestions,
  suggestionsFromDeals,
  suggestionsFromPlays,
  suggestionsFromQuotes,
  type SuggestionDealRow,
  type SuggestionThresholds,
} from '../_shared/suggested-task.ts';

type Row = Record<string, any>;

/** Deal statuses that are still worth a rep's morning. */
const OPEN_DEAL_STATUSES = ['open', 'on_hold'];

function toThresholds(row: Row | null): SuggestionThresholds {
  const out: SuggestionThresholds = {
    ...DEFAULT_SUGGESTION_THRESHOLDS,
    disabledTypes: [...DEFAULT_SUGGESTION_THRESHOLDS.disabledTypes],
  };
  if (!row) return out;
  const window = Number(row.quote_expiry_window_days);
  if (Number.isFinite(window) && window > 0) out.quoteExpiryWindowDays = window;
  const disabled = row.disabled_types;
  if (Array.isArray(disabled)) out.disabledTypes = disabled.map((t: unknown) => String(t));
  return out;
}

function toSuggestionResponse(row: Row) {
  return {
    id: row.id,
    suggestionType: row.suggestion_type,
    recordType: row.record_type,
    recordId: row.record_id,
    reason: row.reason,
    action: row.action,
    score: row.score,
    ownerId: row.owner_id,
    customerId: row.customer_id,
    companyName: row.company_name,
    status: row.status,
    detectedAt: row.detected_at,
  };
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    /**
     * Reading, dismissing and completing a suggestion is a rep's own work and
     * is open to any tenant member. Running the sweep writes rows for the whole
     * tenant and changing a threshold reshapes every rep's list, so both are
     * manager acts.
     *
     * A LEVEL check, not a permission code (SEC-EDGE-002).
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
            error: 'Running the sweep and changing suggestion settings require a manager role',
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
    const { parts } = normalizePath(url.pathname, 'suggested-tasks');
    const resource = parts[0];
    const action = parts[1];

    const loadSettings = async (): Promise<Row | null> => {
      const { data } = await admin
        .from('suggested_task_settings')
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
          { ...toThresholds(row), sweepEnabled: row ? row.sweep_enabled !== 0 : true },
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
        const window = Number(body.quoteExpiryWindowDays);
        // Zero would make the window meaningless; refuse rather than store it.
        if (Number.isFinite(window) && window > 0) {
          values.quote_expiry_window_days = Math.round(window);
        }
        if (Array.isArray(body.disabledTypes)) {
          values.disabled_types = body.disabledTypes.map((t: unknown) => String(t));
        }
        if (body.sweepEnabled !== undefined) values.sweep_enabled = body.sweepEnabled ? 1 : 0;
        values.updated_at = new Date().toISOString();

        const { data, error } = await admin
          .from('suggested_task_settings')
          .upsert(values, { onConflict: 'tenant_id' })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return createCorsResponse(
          { ...toThresholds(data as Row), sweepEnabled: (data as Row).sweep_enabled !== 0 },
          200,
          req,
        );
      }
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // ─── POST /sweep (AC1's replacement, AC4, AC7) ───────────────────
    if (resource === 'sweep' && req.method === 'POST') {
      try {
        requireManager();
      } catch (err) {
        return denyManager(err);
      }
      const settingsRow = await loadSettings();
      const force = url.searchParams.get('force') === 'true';
      // AC5's kill switch. A skip, not a silent no-op that reads as "nothing
      // to suggest".
      if (settingsRow && settingsRow.sweep_enabled === 0 && !force) {
        return createCorsResponse(
          { skipped: true, reason: 'Suggested-task sweeps are disabled for this tenant' },
          200,
          req,
        );
      }
      const thresholds = toThresholds(settingsRow);
      const now = new Date();

      const [dealRows, quoteRows, playRows] = await Promise.all([
        fetchAllRows<Row>(() =>
          admin
            .from('deals')
            .select(
              'id, title, status, amount, probability, created_at, owner_id, customer_id, company_name, stage_id, expected_close_date, last_activity_date, next_follow_up_date, primary_contact_email, primary_contact_phone',
            )
            .eq('tenant_id', tenantId)
            .in('status', OPEN_DEAL_STATUSES),
        ),
        fetchAllRows<Row>(() =>
          admin
            .from('proposals')
            .select(
              'id, proposal_number, title, valid_until, deal_id, business_record_id, assigned_to, status',
            )
            .eq('tenant_id', tenantId)
            .not('status', 'in', '("accepted","rejected","expired","superseded")'),
        ),
        fetchAllRows<Row>(() =>
          admin
            .from('radar_plays')
            .select('id, play_type, reason, score, owner_id, customer_id, company_name, status')
            .eq('tenant_id', tenantId)
            .eq('status', 'open'),
        ),
      ]);

      const dealIds = (dealRows ?? []).map((d) => String(d.id));

      /**
       * Stage entry and its SLA, so `deal_stage_sla_breached` can fire at all.
       * `deals` has no stage_entered_at column - the pipeline-config function
       * writes `deal_stage_history` on every move, and `pipeline_stages` holds
       * the SLA, bridged to the legacy `deals.stage_id` by `legacy_stage_id`
       * (CRMX-005). A deal that has never moved has no history row and simply
       * contributes no SLA signal, which is the no-fabrication rule.
       *
       * Best-effort: losing this costs one signal, not the sweep.
       */
      const stageEnteredAt = new Map<string, string>();
      const slaByStage = new Map<string, number>();
      try {
        const [history, stages] = await Promise.all([
          dealIds.length > 0
            ? fetchAllRows<Row>(() =>
                admin
                  .from('deal_stage_history')
                  .select('deal_id, entered_at')
                  .eq('tenant_id', tenantId)
                  .in('deal_id', dealIds.slice(0, 1000)),
              )
            : Promise.resolve([]),
          fetchAllRows<Row>(() =>
            admin
              .from('pipeline_stages')
              .select('id, legacy_stage_id, sla_days')
              .eq('tenant_id', tenantId),
          ),
        ]);
        for (const h of history ?? []) {
          const dealId = String(h.deal_id ?? '');
          const at = String(h.entered_at ?? '');
          if (!dealId || !at) continue;
          const seen = stageEnteredAt.get(dealId);
          if (!seen || at > seen) stageEnteredAt.set(dealId, at);
        }
        for (const s of stages ?? []) {
          const sla = Number(s.sla_days);
          if (!Number.isFinite(sla) || sla <= 0) continue;
          if (s.legacy_stage_id) slaByStage.set(String(s.legacy_stage_id), sla);
          if (s.id) slaByStage.set(String(s.id), sla);
        }
      } catch (err) {
        console.error('[SUGGESTED-TASKS] stage SLA lookup failed:', (err as Error).message);
      }

      const deals: SuggestionDealRow[] = (dealRows ?? []).map((d) => ({
        id: String(d.id),
        owner_id: d.owner_id ?? null,
        customer_id: d.customer_id ?? null,
        company_name: d.company_name ?? null,
        title: d.title ?? null,
        status: d.status,
        amount: d.amount,
        probability: d.probability,
        createdAt: d.created_at,
        lastActivityDate: d.last_activity_date,
        nextFollowUpDate: d.next_follow_up_date,
        expectedCloseDate: d.expected_close_date,
        stageEnteredAt: stageEnteredAt.get(String(d.id)) ?? null,
        stageSlaDays: d.stage_id ? (slaByStage.get(String(d.stage_id)) ?? null) : null,
        primaryContactEmail: d.primary_contact_email ?? null,
        primaryContactPhone: d.primary_contact_phone ?? null,
      }));

      // Account names for the quote suggestions, one read for the accounts the
      // quotes actually name.
      const accountIds = [
        ...new Set((quoteRows ?? []).map((q) => q.business_record_id).filter(Boolean)),
      ] as string[];
      const companyNames = new Map<string, string>();
      if (accountIds.length > 0) {
        const accounts = await fetchAllRows<Row>(() =>
          admin
            .from('business_records')
            .select('id, company_name')
            .eq('tenant_id', tenantId)
            .in('id', accountIds.slice(0, 1000)),
        );
        for (const a of accounts ?? []) {
          if (a.company_name) companyNames.set(String(a.id), String(a.company_name));
        }
      }

      const drafts = rankSuggestions([
        ...suggestionsFromDeals(deals, now, thresholds),
        ...suggestionsFromQuotes((quoteRows ?? []) as any, now, thresholds, companyNames),
        ...suggestionsFromPlays((playRows ?? []) as any, thresholds),
      ]);

      const nowIso = now.toISOString();
      const insertRows = drafts.map((d) => ({
        tenant_id: tenantId,
        suggestion_type: d.suggestionType,
        dedupe_key: d.dedupeKey,
        record_type: d.recordType,
        record_id: d.recordId,
        reason: d.reason,
        action: d.action,
        score: d.score,
        owner_id: d.ownerId,
        customer_id: d.customerId,
        company_name: d.companyName,
      }));

      let created = 0;
      // Chunked so one oversized request cannot fail a whole sweep.
      for (let i = 0; i < insertRows.length; i += 200) {
        const batch = insertRows.slice(i, i + 200);
        const { data, error } = await admin
          .from('suggested_tasks')
          .upsert(batch, { onConflict: 'tenant_id,dedupe_key', ignoreDuplicates: true })
          .select('id');
        if (error) {
          console.error('[SUGGESTED-TASKS] insert batch failed:', error.message);
          continue;
        }
        created += (data ?? []).length;
      }

      // AC4. Every OPEN row the sweep did not regenerate has lost its signal.
      const openRows = await fetchAllRows<Row>(() =>
        admin
          .from('suggested_tasks')
          .select('id, dedupe_key')
          .eq('tenant_id', tenantId)
          .eq('status', 'open'),
      );
      const byKey = new Map((openRows ?? []).map((r) => [String(r.dedupe_key), String(r.id)]));
      const staleKeys = expireKeys(
        [...byKey.keys()],
        drafts.map((d) => d.dedupeKey),
      );
      let expired = 0;
      for (let i = 0; i < staleKeys.length; i += 200) {
        const ids = staleKeys.slice(i, i + 200).map((k) => byKey.get(k)!);
        const { error } = await admin
          .from('suggested_tasks')
          .update({ status: 'expired', resolved_at: nowIso, updated_at: nowIso })
          .eq('tenant_id', tenantId)
          .in('id', ids);
        if (error) {
          console.error('[SUGGESTED-TASKS] expiry batch failed:', error.message);
          continue;
        }
        expired += ids.length;
      }

      return createCorsResponse(
        {
          detected: drafts.length,
          created,
          // detected - created is the idempotency working, not a failure.
          alreadyOpen: drafts.length - created,
          expired,
          dealsScanned: deals.length,
          unbacked: [
            'A deal that has never changed stage has no deal_stage_history row, so no stage-SLA suggestion can be raised for it. Nothing back-fills stage entry for deals created before pipeline-config started recording moves.',
          ],
        },
        200,
        req,
      );
    }

    // ─── POST /:id/dismiss and /:id/complete (AC6) ───────────────────
    if (resource && action) {
      const { data: suggestion } = await admin
        .from('suggested_tasks')
        .select('id, status')
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!suggestion) return createCorsResponse({ error: 'Suggestion not found' }, 404, req);

      if ((action === 'dismiss' || action === 'complete') && req.method === 'POST') {
        const body = (await req.json().catch(() => ({}))) as Row;
        const nowIso = new Date().toISOString();
        const { error } = await admin
          .from('suggested_tasks')
          .update({
            status: action === 'dismiss' ? 'dismissed' : 'done',
            dismissed_reason:
              action === 'dismiss' && body.reason ? String(body.reason).slice(0, 255) : null,
            resolved_by: user.id,
            resolved_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', resource)
          .eq('tenant_id', tenantId);
        if (error) throw new Error(error.message);
        return createCorsResponse({ success: true, id: resource }, 200, req);
      }

      return createCorsResponse({ error: 'Not found' }, 404, req);
    }

    // ─── GET / (AC3's ranking, AC6's workspace list) ─────────────────
    if (req.method === 'GET' && !resource) {
      let query = admin
        .from('suggested_tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', url.searchParams.get('status') || 'open')
        .order('score', { ascending: false })
        .limit(Math.min(200, Number(url.searchParams.get('limit')) || 50));

      const type = url.searchParams.get('type');
      if (type) query = query.eq('suggestion_type', type);
      if (url.searchParams.get('mine') === 'true') query = query.eq('owner_id', user.id);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return createCorsResponse(
        { data: (data ?? []).map(toSuggestionResponse), total: (data ?? []).length },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[SUGGESTED-TASKS] error:', error);
    return createCorsResponse(
      { error: 'Request failed', message: (error as Error).message },
      500,
      req,
    );
  }
}
