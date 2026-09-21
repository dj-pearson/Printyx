// Deals/Opportunities Edge Function
// Handles sales deals and opportunities management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { buildSearchOr, DEAL_LIST_SPEC, parseCrmListQuery } from '../_shared/crm-list-query.ts';
import {
  DEAL_EQUIPMENT_RELATIONS,
  dealEquipmentRelationError,
} from '../_shared/crm-associations.ts';
import {
  monthlyVolumeFromReadings,
  sumVolumes,
  totalBuyoutExposure,
} from '../_shared/installed-base.ts';
import { dispatchWorkflowEventSafe } from '../_shared/workflow-dispatch.ts';
import {
  buildStageNameMap,
  findStageId,
  resolveStageId,
  type DealStageRow,
} from '../_shared/deal-stage.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';
import {
  buildDealFingerprint,
  buildDealSummaryPrompt,
  hasEnoughHistory,
  MAX_TIMELINE_ENTRIES,
  type DealSummaryEntry,
} from '../_shared/deal-summary.ts';
import {
  GPT5_CONFIGS,
  buildResponsesRequest,
  extractResponseText,
} from '../_shared/gpt5-prompts.ts';
import { syncRenewalOutcomeFromDeal } from '../_shared/renewal-deal.ts';
import { isMissingColumnError } from '../_shared/postgrest-errors.ts';

/** The tenant's pipeline stages. Small table; read once per request. */
async function loadStages(admin: any, tenantId: string): Promise<DealStageRow[]> {
  const { data, error } = await admin
    .from('deal_stages')
    .select('id, name, sort_order, is_active')
    .eq('tenant_id', tenantId);
  if (error) {
    console.error('Error loading deal stages:', error);
    return [];
  }
  return (data ?? []) as DealStageRow[];
}

/**
 * Raw snake row -> the shape the CRM table and the deal pages read.
 *
 * The handler selects '*', so it was returning business_name-style keys while
 * the registry named camelCase ones; Amount, Stage, Close Date, Company and
 * Created were all blank. Aliases are ADDED to the spread, so anything already
 * reading the snake keys keeps working. `stage` is the stage NAME, mapped from
 * stage_id in memory rather than through an FK embed — this handler avoids
 * embeds on purpose (the deals FKs are not reliably in the schema cache).
 */
function toDealResponse(deal: any, stageNames: Record<string, string>) {
  return {
    ...deal,
    title: deal.title,
    amount: deal.amount,
    stageId: deal.stage_id,
    stage: stageNames[deal.stage_id] ?? null,
    ownerId: deal.owner_id,
    customerId: deal.customer_id,
    companyName: deal.company_name,
    dealType: deal.deal_type,
    expectedCloseDate: deal.expected_close_date,
    actualCloseDate: deal.actual_close_date,
    primaryContactName: deal.primary_contact_name,
    primaryContactEmail: deal.primary_contact_email,
    primaryContactPhone: deal.primary_contact_phone,
    productsInterested: deal.products_interested,
    estimatedMonthlyValue: deal.estimated_monthly_value,
    lostReason: deal.lost_reason,
    lastActivityDate: deal.last_activity_date,
    nextFollowUpDate: deal.next_follow_up_date,
    createdById: deal.created_by_id,
    customFields: deal.custom_fields,
    // COP-M04: the copier-deal fields. The raw snake row is already spread above;
    // these are the camelCase aliases the frontend reads.
    dealMotion: deal.deal_motion,
    forecastCategory: deal.forecast_category,
    incumbentVendor: deal.incumbent_vendor,
    leaseBuyoutExposure: deal.lease_buyout_exposure,
    tradeInValue: deal.trade_in_value,
    currentMonthlyVolumeBw: deal.current_monthly_volume_bw,
    currentMonthlyVolumeColor: deal.current_monthly_volume_color,
    targetCpcBlack: deal.target_cpc_black,
    targetCpcColor: deal.target_cpc_color,
    replacesContractId: deal.replaces_contract_id,
    // WF-S-03: the lead this deal came out of, so a caller can navigate back
    // without a second request.
    sourceBusinessRecordId: deal.source_business_record_id,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
  };
}

/**
 * COP-M05 / AC5. Derives the COP-M04 fields from every machine currently linked
 * to the deal as 'replaces', and writes only the ones the deal has not answered.
 *
 * Returns a map of what it wrote. Never throws: a failure here must not take
 * down the attach that already succeeded, so it degrades to writing nothing.
 */
async function fillDealFromInstalledBase(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  dealId: string,
): Promise<Record<string, unknown>> {
  try {
    const { data: deal } = await admin
      .from('deals')
      .select(
        'id, lease_buyout_exposure, replaces_contract_id, current_monthly_volume_bw, current_monthly_volume_color',
      )
      .eq('id', dealId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!deal) return {};

    const wantsBuyout = deal.lease_buyout_exposure === null;
    const wantsContract = deal.replaces_contract_id === null;
    const wantsBw = deal.current_monthly_volume_bw === null;
    const wantsColor = deal.current_monthly_volume_color === null;
    if (!wantsBuyout && !wantsContract && !wantsBw && !wantsColor) return {};

    const { data: links } = await admin
      .from('crm_associations')
      .select('source_type, source_id, target_type, target_id')
      .eq('tenant_id', tenantId)
      .eq('relation', 'replaces')
      .or(
        `and(source_type.eq.deal,source_id.eq.${dealId},target_type.eq.equipment),` +
          `and(target_type.eq.deal,target_id.eq.${dealId},source_type.eq.equipment)`,
      );

    const equipmentIds = [
      ...new Set(
        (links ?? []).map((l: Record<string, any>) =>
          l.source_type === 'equipment' ? l.source_id : l.target_id,
        ),
      ),
    ];
    if (equipmentIds.length === 0) return {};

    const { data: machines } = await admin
      .from('equipment')
      .select('id, customer_id, service_contract_number')
      .eq('tenant_id', tenantId)
      .in('id', equipmentIds);
    if (!machines || machines.length === 0) return {};

    const update: Record<string, unknown> = {};

    if (wantsBuyout) {
      // leases.equipment_ids is a jsonb ARRAY, so this is a containment test,
      // not an equality one.
      const perMachine = await Promise.all(
        equipmentIds.map((id) =>
          admin
            .from('leases')
            .select('buyout_amount')
            .eq('tenant_id', tenantId)
            .contains('equipment_ids', [id]),
        ),
      );
      const leases = perMachine.flatMap((r) => r.data ?? []);
      const exposure = totalBuyoutExposure(leases);
      if (exposure !== null) update.lease_buyout_exposure = exposure;
    }

    if (wantsContract) {
      // equipment.service_contract_number is free text, so this matches on the
      // contract NUMBER for the same customer rather than on an id that does not
      // exist. Only taken when exactly one machine points at exactly one
      // contract — an ambiguous answer is left for the rep.
      const numbered = machines.filter((m: Record<string, any>) => m.service_contract_number);
      const distinct = [
        ...new Set(numbered.map((m: Record<string, any>) => m.service_contract_number)),
      ];
      if (distinct.length === 1) {
        const { data: contracts } = await admin
          .from('contracts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('contract_number', distinct[0])
          .limit(2);
        if (contracts?.length === 1) update.replaces_contract_id = contracts[0].id;
      }
    }

    if (wantsBw || wantsColor) {
      const perMachine = await Promise.all(
        equipmentIds.map(async (id) => {
          const { data } = await admin
            .from('meter_readings')
            .select('reading_date, bw_meter_reading, color_meter_reading')
            .eq('tenant_id', tenantId)
            .eq('equipment_id', id)
            .order('reading_date', { ascending: false })
            .limit(2);
          return monthlyVolumeFromReadings(data ?? []);
        }),
      );
      const volume = sumVolumes(perMachine);
      if (wantsBw && volume.bw !== null) update.current_monthly_volume_bw = volume.bw;
      if (wantsColor && volume.color !== null) update.current_monthly_volume_color = volume.color;
    }

    if (Object.keys(update).length === 0) return {};

    const { error } = await admin
      .from('deals')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', dealId)
      .eq('tenant_id', tenantId);
    if (error) {
      console.error('COP-M05: failed to write derived deal fields:', error);
      return {};
    }
    return update;
  } catch (error) {
    console.error('COP-M05: installed-base derivation failed:', error);
    return {};
  }
}

/**
 * The deal and its timeline, in the shape the summary module wants. One read of
 * each, because both the GET (staleness) and the POST (generation) need them.
 */
async function loadSummarySource(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  dealId: string,
): Promise<{ deal: Record<string, any>; entries: DealSummaryEntry[] } | null> {
  const { data: deal } = await admin
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!deal) return null;

  // Two sources, because the deal's history is written to two tables: calls,
  // emails, meetings and stage changes land in deal_activities, and what the
  // rep typed lands in crm_notes (CRMX-006). Summarising only the first would
  // leave out the half a rep actually wrote.
  //
  // Both capped at the query, not in memory: a deal with 900 logged calls must
  // not pull 900 rows over the wire to throw 860 of them away.
  const [activityResult, noteResult] = await Promise.all([
    admin
      .from('deal_activities')
      .select('id, type, subject, description, outcome, created_at')
      .eq('deal_id', dealId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(MAX_TIMELINE_ENTRIES),
    admin
      .from('crm_notes')
      .select('id, body, created_at')
      .eq('tenant_id', tenantId)
      .eq('parent_type', 'deal')
      .eq('parent_id', dealId)
      .order('created_at', { ascending: false })
      .limit(MAX_TIMELINE_ENTRIES),
  ]);

  const activities: DealSummaryEntry[] = (activityResult.data ?? []).map(
    (r: Record<string, any>) => ({
      id: r.id,
      type: r.type,
      subject: r.subject,
      description: r.description,
      outcome: r.outcome,
      createdAt: r.created_at,
    }),
  );

  const notes: DealSummaryEntry[] = (noteResult.data ?? []).map((r: Record<string, any>) => ({
    id: r.id,
    type: 'note',
    description: r.body,
    createdAt: r.created_at,
  }));

  // Merged newest-first, which is the order boundedTimeline expects. An undated
  // row sorts last rather than jumping to the front of the story.
  const entries = [...activities, ...notes].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );

  return { deal, entries };
}

/** The deal fields the narrative and the fingerprint read, in camelCase. */
function toSummaryDeal(deal: Record<string, any>, stageNames: Record<string, string>) {
  return {
    id: deal.id,
    title: deal.title,
    companyName: deal.company_name,
    amount: deal.amount,
    stage: stageNames[deal.stage_id] ?? null,
    status: deal.status,
    expectedCloseDate: deal.expected_close_date,
    nextFollowUpDate: deal.next_follow_up_date,
    lastActivityDate: deal.last_activity_date,
    incumbentVendor: deal.incumbent_vendor,
    forecastCategory: deal.forecast_category,
    leaseBuyoutExposure: deal.lease_buyout_exposure,
    dealMotion: deal.deal_motion,
  };
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // Resolve tenant ID from the verified JWT (canonical). The x-tenant-id header
    // is only a fallback and must NEVER override the JWT tenant — otherwise any
    // authenticated user can read/write another tenant by spoofing the header.
    // SEC-TENANT-003: app_metadata only. The two user_metadata terms this used
    // to end with are a bag the session holder writes with
    // supabase.auth.updateUser, so they could not be what the name claims.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) || (user.app_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    // WF-R-03: the role claim carries the uppercase role CODE, so comparing it to
    // a lowercase string could never fire and this rested on a flag nothing wrote.
    const platformRoleCode = String(user.app_metadata?.role ?? '').toUpperCase();
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true ||
      platformRoleCode === 'PLATFORM_ADMIN' ||
      platformRoleCode === 'ROOT_ADMIN';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { error: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }
    // SEC-TENANT-003: the header is honoured ONLY for a platform admin. It used
    // to sit ahead of the users-table lookup below, so a caller whose JWT
    // carried no tenantId - a freshly provisioned user, a service caller, an
    // account whose app_metadata was written by a path that never set it - got
    // whatever tenant they asked for, and every .eq('tenant_id', tenantId) past
    // this point filtered on it. The web client sends the header from
    // localStorage, so it is a devtools edit away.
    let tenantId = jwtTenantId || (isPlatformAdmin ? headerTenantId : undefined);

    if (!tenantId) {
      // Fallback: look up tenant from public.users
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      tenantId = dbUser?.tenant_id;
    }

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const rawParts = url.pathname.split('/').filter(Boolean);
    // Normalize: strip function name from path if the relay preserved it
    const pathParts = rawParts[0] === 'deals' ? rawParts.slice(1) : rawParts;
    const dealId = pathParts[0];
    const subResource = pathParts[1]; // e.g. /deals/:id/activities

    // ─── /deals/:id/activities (EDGE-005b) ─────────────────────────────────
    // Ported from the legacy Express /api/deals-management/deals/:id/activities.
    // Uses the CANONICAL deal_activities schema (type/description/created_at) —
    // the old Express handler referenced drifted column names (activity_type/
    // created_by/follow_up_date) that do not exist on the table. Response is
    // mapped to camelCase to match the frontend ActivityEntry shape.
    if (dealId && subResource === 'activities') {
      if (req.method === 'GET') {
        const { data, error } = await admin
          .from('deal_activities')
          .select('*')
          .eq('deal_id', dealId)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching deal activities:', error);
          return createCorsResponse({ error: 'Failed to fetch deal activities' }, 500, req);
        }

        const activities = (data ?? []).map((a: Record<string, any>) => ({
          id: a.id,
          dealId: a.deal_id,
          type: a.type,
          subject: a.subject,
          description: a.description,
          outcome: a.outcome,
          duration: a.duration,
          userId: a.user_id,
          createdAt: a.created_at,
        }));
        return createCorsResponse(activities, 200, req);
      }

      if (req.method === 'POST') {
        const body = await req.json();
        const activityData = {
          tenant_id: tenantId,
          deal_id: dealId,
          type: body.type || body.activityType || 'note',
          subject: body.subject ?? null,
          description: body.description ?? null,
          outcome: body.outcome ?? null,
          duration: body.duration ?? null,
          user_id: user.id,
          created_at: new Date().toISOString(),
        };
        const { data: created, error } = await admin
          .from('deal_activities')
          .insert(activityData)
          .select()
          .single();

        if (error) {
          console.error('Error creating deal activity:', error);
          return createCorsResponse({ error: 'Failed to create deal activity' }, 500, req);
        }
        return createCorsResponse(
          {
            id: created.id,
            dealId: created.deal_id,
            type: created.type,
            subject: created.subject,
            description: created.description,
            outcome: created.outcome,
            duration: created.duration,
            userId: created.user_id,
            createdAt: created.created_at,
          },
          201,
          req,
        );
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // ─── /deals/:id/quotes (COP-B02) ───────────────────────────────────────
    //
    // The deal's own quotes. `proposals.deal_id` landed with COP-B02; before it
    // this tab could not exist, because an account's newest proposal is not
    // attributable to one of its deals the moment the account has two.
    //
    // Tolerates the column being absent: migration 0088 is committed and
    // unapplied, and a deal record that 500s because one migration has not run
    // is worse than one whose Quotes tab is empty.
    if (dealId && subResource === 'quotes' && req.method === 'GET') {
      const { data, error } = await admin
        .from('proposals')
        .select(
          'id, proposal_number, title, status, total_amount, subtotal, discount_amount, discount_percentage, total_margin_percentage, valid_until, created_at, updated_at',
        )
        .eq('tenant_id', tenantId)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingColumnError(error)) {
          return createCorsResponse(
            {
              data: [],
              unbacked: [
                'Quotes cannot be linked to a deal on this database yet: migration 0088 adds proposals.deal_id and has not been applied.',
              ],
            },
            200,
            req,
          );
        }
        console.error('Error fetching deal quotes:', error);
        return createCorsResponse({ error: 'Failed to fetch quotes' }, 500, req);
      }

      return createCorsResponse(
        {
          data: (data ?? []).map((q: Record<string, any>) => ({
            id: q.id,
            proposalNumber: q.proposal_number,
            title: q.title,
            status: q.status,
            totalAmount: q.total_amount,
            subtotal: q.subtotal,
            discountAmount: q.discount_amount,
            discountPercentage: q.discount_percentage,
            marginPercentage: q.total_margin_percentage,
            validUntil: q.valid_until,
            createdAt: q.created_at,
          })),
          unbacked: [],
        },
        200,
        req,
      );
    }

    // ─── /deals/:id/summary (COP-B11) ──────────────────────────────────────
    //
    // The AI narrative half of the insights panel. Two verbs on purpose:
    //
    //   GET  reads the cached summary and says whether it still describes the
    //        deal as it stands. It NEVER generates. A GET that quietly called
    //        an LLM would bill the tenant for every page view of a deal that
    //        changed, which is the cost bound AC6 asks for.
    //   POST generates and stores, when a rep asks for it.
    //
    // Refusing to generate is a normal outcome: a deal with no logged
    // interaction has nothing to narrate, and a model handed six fields and no
    // events writes fluent sales fiction (COP-I07).
    if (dealId && subResource === 'summary') {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return createCorsResponse({ error: 'Method not allowed' }, 405, req);
      }

      const source = await loadSummarySource(admin, tenantId, dealId);
      if (!source) {
        return createCorsResponse({ error: 'Deal not found' }, 404, req);
      }

      const stageNames = buildStageNameMap(await loadStages(admin, tenantId));
      const summaryDeal = toSummaryDeal(source.deal, stageNames);
      const fingerprint = buildDealFingerprint(summaryDeal, source.entries);
      const enoughHistory = hasEnoughHistory(source.entries);

      const { data: cached } = await admin
        .from('deal_ai_summaries')
        .select('summary, fingerprint, model, generated_at, source_entry_count')
        .eq('tenant_id', tenantId)
        .eq('deal_id', dealId)
        .maybeSingle();

      if (req.method === 'GET') {
        return createCorsResponse(
          {
            summary: cached?.summary ?? null,
            generatedAt: cached?.generated_at ?? null,
            model: cached?.model ?? null,
            sourceEntryCount: cached?.source_entry_count ?? null,
            // Out of date rather than absent: the rep can still read what was
            // written, knowing the deal has moved since.
            stale: cached ? cached.fingerprint !== fingerprint : false,
            canGenerate: enoughHistory,
            entryCount: source.entries.length,
          },
          200,
          req,
        );
      }

      if (!enoughHistory) {
        return createCorsResponse(
          {
            error: 'Nothing to summarise',
            code: 'NO_INTERACTION_HISTORY',
            detail:
              'This deal has no logged activity. A summary written from the record alone would be invention, not a summary.',
          },
          422,
          req,
        );
      }

      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) {
        // 503, not 500: the request is well formed and works the moment the key
        // is configured in this environment.
        return createCorsResponse(
          { error: 'Summary generation is not configured', code: 'LLM_NOT_CONFIGURED' },
          503,
          req,
        );
      }

      // LEAD_ANALYSIS, not BUSINESS_ANALYTICS: gpt-5-mini at medium effort and
      // medium verbosity. This is a 3-to-5 sentence recap of a timeline, and
      // BUSINESS_ANALYTICS is gpt-5 at high/high - paying for deep reasoning and
      // a long answer would work against both halves of AC6.
      const config = GPT5_CONFIGS.LEAD_ANALYSIS;
      let payload: any = null;
      try {
        const res = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            buildResponsesRequest(buildDealSummaryPrompt(summaryDeal, source.entries), config),
          ),
        });
        payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message = payload?.error?.message || `OpenAI request failed (${res.status})`;
          console.error('Error generating the deal summary:', message);
          return createCorsResponse({ error: message, code: 'LLM_ERROR' }, 502, req);
        }
      } catch (err) {
        console.error('Error calling the summary model:', err);
        return createCorsResponse(
          { error: 'Could not reach the summary model', code: 'LLM_UNREACHABLE' },
          502,
          req,
        );
      }

      const text = extractResponseText(payload).trim();
      if (!text) {
        // An empty completion is not a summary. Storing it would replace a
        // readable stale one with a blank.
        return createCorsResponse(
          { error: 'The model returned nothing', code: 'LLM_EMPTY' },
          502,
          req,
        );
      }

      const row = {
        tenant_id: tenantId,
        deal_id: dealId,
        summary: text,
        fingerprint,
        source_entry_count: source.entries.length,
        model: config.model ?? null,
        total_tokens: payload?.usage?.total_tokens ?? null,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
      };

      const { error: writeError } = await admin
        .from('deal_ai_summaries')
        .upsert(row, { onConflict: 'tenant_id,deal_id' });

      if (writeError) {
        console.error('Error storing the deal summary:', writeError);
        // The text is still returned: the rep asked a question and got an
        // answer, and a cache write is not what they asked for.
      }

      return createCorsResponse(
        {
          summary: text,
          generatedAt: row.generated_at,
          model: row.model,
          sourceEntryCount: source.entries.length,
          stale: false,
          canGenerate: true,
          entryCount: source.entries.length,
          cached: !writeError,
        },
        200,
        req,
      );
    }

    // ─── /deals/:id/equipment (COP-M05) ────────────────────────────────────
    // The installed-base link: which serials a deal REPLACES and which it
    // PLACES. Stored in the generic crm_associations join (CRMX-006) rather than
    // a bespoke deal_equipment table, so the link survives the lead -> customer
    // lifecycle and needs no migration. The rep-facing fields are joined here
    // rather than left to the client, because a board card or a record panel
    // that has to fan out one request per serial is the thing COP-I01 exists to
    // prevent.
    if (dealId && subResource === 'equipment') {
      const equipmentId = pathParts[2];

      // Every branch below is scoped by tenant_id on BOTH the association and
      // the equipment row: a link is only usable if the machine is also ours.
      if (req.method === 'GET') {
        const { data: links, error: linkError } = await admin
          .from('crm_associations')
          .select('id, source_type, source_id, target_type, target_id, relation, created_at')
          .eq('tenant_id', tenantId)
          .or(
            `and(source_type.eq.deal,source_id.eq.${dealId},target_type.eq.equipment),` +
              `and(target_type.eq.deal,target_id.eq.${dealId},source_type.eq.equipment)`,
          )
          .order('created_at', { ascending: false });

        if (linkError) {
          console.error('Error fetching deal equipment links:', linkError);
          return createCorsResponse({ error: 'Failed to fetch deal equipment' }, 500, req);
        }

        const rows = links ?? [];
        if (rows.length === 0) return createCorsResponse({ data: [], total: 0 }, 200, req);

        // The deal is one side of the link; the machine is whichever side is not.
        const idFor = (l: Record<string, any>) =>
          l.source_type === 'equipment' ? l.source_id : l.target_id;
        const equipmentIds = [...new Set(rows.map(idFor))];

        const { data: machines, error: equipmentError } = await admin
          .from('equipment')
          .select(
            'id, serial_number, model_number, manufacturer, description, meter_type, ' +
              'is_color_capable, equipment_status, location_description, install_date, ' +
              'lease_expires_date, monthly_payment, service_contract_number, customer_id',
          )
          .eq('tenant_id', tenantId)
          .in('id', equipmentIds);

        if (equipmentError) {
          console.error('Error fetching equipment for deal:', equipmentError);
          return createCorsResponse({ error: 'Failed to fetch deal equipment' }, 500, req);
        }

        const byId = new Map((machines ?? []).map((m: Record<string, any>) => [m.id, m]));

        // Current meters and contract rates, which is what makes this list
        // useful to a rep rather than an inventory dump. Both are fetched in ONE
        // query each and grouped in memory: a per-machine round trip here is the
        // fan-out COP-I01 exists to prevent.
        const { data: readings } = await admin
          .from('meter_readings')
          .select('equipment_id, reading_date, bw_meter_reading, color_meter_reading')
          .eq('tenant_id', tenantId)
          .in('equipment_id', equipmentIds)
          .order('reading_date', { ascending: false });

        const readingsByEquipment = new Map<string, Record<string, any>[]>();
        for (const r of readings ?? []) {
          const list = readingsByEquipment.get(r.equipment_id) ?? [];
          // Already ordered newest first, and only the newest pair is used.
          if (list.length < 2) list.push(r);
          readingsByEquipment.set(r.equipment_id, list);
        }

        // equipment.service_contract_number is free text, so the rates come from
        // the contract carrying that NUMBER for the tenant, not from an id.
        const contractNumbers = [
          ...new Set(
            (machines ?? [])
              .map((m: Record<string, any>) => m.service_contract_number)
              .filter(Boolean),
          ),
        ];
        const contractByNumber = new Map<string, Record<string, any>>();
        if (contractNumbers.length > 0) {
          const { data: contracts } = await admin
            .from('contracts')
            .select('id, contract_number, black_rate, color_rate')
            .eq('tenant_id', tenantId)
            .in('contract_number', contractNumbers);
          for (const c of contracts ?? []) contractByNumber.set(c.contract_number, c);
        }

        const data = rows
          // A link whose machine is missing or belongs to another tenant is
          // dropped rather than returned as a hollow row.
          .filter((l: Record<string, any>) => byId.has(idFor(l)))
          .map((l: Record<string, any>) => {
            const m = byId.get(idFor(l)) as Record<string, any>;
            const machineReadings = readingsByEquipment.get(m.id) ?? [];
            const volume = monthlyVolumeFromReadings(machineReadings);
            const newestReading = machineReadings[0];
            const contract = m.service_contract_number
              ? contractByNumber.get(m.service_contract_number)
              : undefined;
            return {
              associationId: l.id,
              relation: l.relation,
              linkedAt: l.created_at,
              equipmentId: m.id,
              serialNumber: m.serial_number,
              modelNumber: m.model_number,
              manufacturer: m.manufacturer,
              description: m.description,
              meterType: m.meter_type,
              isColorCapable: m.is_color_capable,
              equipmentStatus: m.equipment_status,
              locationDescription: m.location_description,
              installDate: m.install_date,
              leaseExpiresDate: m.lease_expires_date,
              monthlyPayment: m.monthly_payment,
              serviceContractNumber: m.service_contract_number,
              customerId: m.customer_id,
              // Null rather than 0 when the meters cannot answer — see
              // monthlyVolumeFromReadings for what makes a period unusable.
              currentMonthlyVolumeBw: volume.bw,
              currentMonthlyVolumeColor: volume.color,
              latestMeterDate: newestReading?.reading_date ?? null,
              contractId: contract?.id ?? null,
              contractBlackRate: contract?.black_rate ?? null,
              contractColorRate: contract?.color_rate ?? null,
            };
          });

        return createCorsResponse({ data, total: data.length }, 200, req);
      }

      if (req.method === 'POST' && !equipmentId) {
        const body = await req.json().catch(() => ({}));
        const targetId = body.equipmentId ?? body.equipment_id;
        const relation = body.relation;

        if (!targetId) {
          return createCorsResponse({ error: 'equipmentId is required' }, 400, req);
        }
        const relationError = dealEquipmentRelationError({
          sourceType: 'deal',
          targetType: 'equipment',
          relation,
        });
        if (relationError) {
          return createCorsResponse(
            { error: relationError, allowed: DEAL_EQUIPMENT_RELATIONS },
            400,
            req,
          );
        }

        // Confirm both ends are this tenant's before writing the link. Without
        // this a rep could attach any serial in the database by id.
        const [{ data: deal }, { data: machine }] = await Promise.all([
          admin.from('deals').select('id').eq('id', dealId).eq('tenant_id', tenantId).maybeSingle(),
          admin
            .from('equipment')
            .select('id')
            .eq('id', targetId)
            .eq('tenant_id', tenantId)
            .maybeSingle(),
        ]);
        if (!deal) return createCorsResponse({ error: 'Deal not found' }, 404, req);
        if (!machine) return createCorsResponse({ error: 'Equipment not found' }, 404, req);

        const { data: created, error } = await admin
          .from('crm_associations')
          .insert({
            tenant_id: tenantId,
            source_type: 'deal',
            source_id: dealId,
            target_type: 'equipment',
            target_id: targetId,
            relation,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) {
          if ((error as { code?: string }).code === '23505') {
            return createCorsResponse(
              { error: 'This equipment is already linked to the deal with that role' },
              409,
              req,
            );
          }
          console.error('Error linking equipment to deal:', error);
          return createCorsResponse({ error: 'Failed to link equipment' }, 500, req);
        }

        // COP-M05 / AC5: fill in the COP-M04 fields the machine already answers,
        // instead of making the rep retype them. Only for 'replaces' — a machine
        // going IN has no buyout and no history.
        //
        // Fills BLANKS ONLY. A rep who has typed a negotiated buyout must not
        // have it overwritten by attaching another serial, and a derived number
        // silently replacing a human one is the kind of thing nobody reports and
        // everybody distrusts afterwards.
        const filled =
          created.relation === 'replaces'
            ? await fillDealFromInstalledBase(admin, tenantId, dealId)
            : {};

        return createCorsResponse(
          {
            associationId: created.id,
            equipmentId: created.target_id,
            relation: created.relation,
            linkedAt: created.created_at,
            // What the attach wrote onto the deal, so the UI can say so rather
            // than leaving the rep to notice fields changing on their own.
            derived: filled,
          },
          201,
          req,
        );
      }

      if (req.method === 'DELETE' && equipmentId) {
        // Detach by equipment id rather than association id, so the caller does
        // not have to hold one. ?relation= removes just that role; without it,
        // both roles go.
        const relation = url.searchParams.get('relation');
        let query = admin
          .from('crm_associations')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('source_type', 'deal')
          .eq('source_id', dealId)
          .eq('target_type', 'equipment')
          .eq('target_id', equipmentId);
        if (relation) query = query.eq('relation', relation);

        const { data, error } = await query.select();
        if (error) {
          console.error('Error unlinking equipment from deal:', error);
          return createCorsResponse({ error: 'Failed to unlink equipment' }, 500, req);
        }
        if (!data || data.length === 0) {
          return createCorsResponse({ error: 'Association not found' }, 404, req);
        }
        return createCorsResponse({ success: true, removed: data.length }, 200, req);
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // ─── Bulk ops (EDGE-005b) — POST /deals/bulk-update | /deals/bulk-delete ──
    // Ported from legacy Express /api/deals-management/deals/bulk-{update,delete}.
    // COP-M01: this used to name deal_name, deal_value, stage and next_step.
    // None of them are columns on `deals` (migration 0000: title, amount,
    // stage_id, and no next_step at all), so a bulk update touching any of them
    // came back 42703. Aliases for the names callers actually send are kept, but
    // every VALUE below is a real column.
    const BULK_FIELD_MAP: Record<string, string> = {
      title: 'title',
      dealName: 'title',
      description: 'description',
      amount: 'amount',
      dealValue: 'amount',
      value: 'amount',
      stageId: 'stage_id',
      status: 'status',
      priority: 'priority',
      probability: 'probability',
      expectedCloseDate: 'expected_close_date',
      actualCloseDate: 'actual_close_date',
      ownerId: 'owner_id',
      customerId: 'customer_id',
      companyName: 'company_name',
      // COP-I06: the recurring half of a copier deal. The column has existed
      // since 0000 and was READ in four places and written by NOTHING, so the
      // recurring side of every forecast was structurally empty - it was not
      // in this map, so no PATCH could set it.
      estimatedMonthlyValue: 'estimated_monthly_value',
      source: 'source',
      dealType: 'deal_type',
      lostReason: 'lost_reason',
      notes: 'notes',
      // COP-M04
      dealMotion: 'deal_motion',
      forecastCategory: 'forecast_category',
      incumbentVendor: 'incumbent_vendor',
      leaseBuyoutExposure: 'lease_buyout_exposure',
      tradeInValue: 'trade_in_value',
      currentMonthlyVolumeBw: 'current_monthly_volume_bw',
      currentMonthlyVolumeColor: 'current_monthly_volume_color',
      targetCpcBlack: 'target_cpc_black',
      targetCpcColor: 'target_cpc_color',
      replacesContractId: 'replaces_contract_id',
      // CRM-008: the fields the record page's editable property groups expose.
      // They are real columns and were read everywhere, but absent from this
      // map - so a PATCH setting a next step or a contact answered 200 having
      // changed nothing, which is the worst shape a write can take.
      nextFollowUpDate: 'next_follow_up_date',
      primaryContactName: 'primary_contact_name',
      primaryContactEmail: 'primary_contact_email',
      primaryContactPhone: 'primary_contact_phone',
      productsInterested: 'products_interested',
    };

    if (req.method === 'POST' && dealId === 'bulk-update') {
      const body = await req.json();
      const ids: string[] = Array.isArray(body.dealIds) ? body.dealIds : [];
      const updates: Record<string, any> = body.updates ?? {};
      if (ids.length === 0) {
        return createCorsResponse({ error: 'dealIds required' }, 400, req);
      }
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const [camelKey, snakeKey] of Object.entries(BULK_FIELD_MAP)) {
        if (updates[camelKey] !== undefined) updateData[snakeKey] = updates[camelKey];
        else if (updates[snakeKey] !== undefined) updateData[snakeKey] = updates[snakeKey];
      }
      const { data, error } = await admin
        .from('deals')
        .update(updateData)
        .in('id', ids)
        .eq('tenant_id', tenantId)
        .select('id');
      if (error) {
        console.error('Error bulk-updating deals:', error);
        return createCorsResponse({ error: 'Failed to bulk-update deals' }, 500, req);
      }
      return createCorsResponse({ success: true, updated: data?.length ?? 0 }, 200, req);
    }

    if (req.method === 'POST' && dealId === 'bulk-delete') {
      const body = await req.json();
      const ids: string[] = Array.isArray(body.dealIds) ? body.dealIds : [];
      if (ids.length === 0) {
        return createCorsResponse({ error: 'dealIds required' }, 400, req);
      }
      const { error } = await admin.from('deals').delete().in('id', ids).eq('tenant_id', tenantId);
      if (error) {
        console.error('Error bulk-deleting deals:', error);
        return createCorsResponse({ error: 'Failed to bulk-delete deals' }, 500, req);
      }
      return createCorsResponse({ success: true, deleted: ids.length }, 200, req);
    }

    // GET /deals - List deals
    if (req.method === 'GET' && !dealId) {
      // COP-M01: the search filter named deal_name (42703 -> 500 on every
      // search) and the stage filter named a `stage` column that does not exist;
      // sortBy/sortOrder were ignored entirely. All three now come from the
      // shared spec.
      const q = parseCrmListQuery(url.searchParams, DEAL_LIST_SPEC);
      const ownerId = q.filters.ownerId || url.searchParams.get('owner_id');

      // Select deals without FK joins to avoid schema cache errors
      // (business_records table is deprecated, FK may not exist)
      let query = admin
        .from('deals')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order(q.sortColumn, { ascending: q.ascending })
        .range(q.offset, q.offset + q.limit - 1);

      // WF-R-04: the board showed every deal in the tenant to every rep. The
      // `ownerId` filter below is a caller-supplied preference and never was a
      // control - it is applied on top of this, not instead of it.
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      });
      query = applyUserScope(query, ['owner_id', 'created_by_id'], scope);

      const stages = await loadStages(admin, tenantId);

      // `stage` carries a slug from the hardcoded picker, so match it against the
      // tenant's own stages rather than comparing it to an id. findStageId does
      // NOT fall back to a default: an unrecognized slug must return nothing,
      // not a different column of the board.
      const requestedStage = q.filters.stageId || q.filters.stage;
      if (requestedStage) {
        query = query.eq('stage_id', findStageId(stages, requestedStage) ?? '');
      }

      if (ownerId) query = query.eq('owner_id', ownerId);
      if (q.filters.status) query = query.eq('status', q.filters.status);
      if (q.filters.priority) query = query.eq('priority', q.filters.priority);
      if (q.filters.customerId) query = query.eq('customer_id', q.filters.customerId);
      // WF-S-03. `leadId` is accepted as an alias and nothing else: the tab
      // shipped sending it, and answering the tenant's whole deal list to an
      // old bundle is the defect this story exists to close.
      const businessRecordId =
        q.filters.businessRecordId ||
        url.searchParams.get('business_record_id') ||
        url.searchParams.get('leadId') ||
        url.searchParams.get('lead_id');
      if (businessRecordId) query = query.eq('source_business_record_id', businessRecordId);
      // COP-M04
      if (q.filters.dealMotion) query = query.eq('deal_motion', q.filters.dealMotion);
      if (q.filters.forecastCategory)
        query = query.eq('forecast_category', q.filters.forecastCategory);

      const searchOr = buildSearchOr(DEAL_LIST_SPEC, q.search);
      if (searchOr) query = query.or(searchOr);

      const { data: deals, error, count } = await query;

      if (error) {
        console.error('Error fetching deals:', error);
        return createCorsResponse(
          { error: 'Failed to fetch deals', details: error.message },
          500,
          req,
        );
      }

      const stageNames = buildStageNameMap(stages);
      return createCorsResponse(
        {
          data: (deals || []).map((deal: any) => toDealResponse(deal, stageNames)),
          total: count || 0,
          page: q.page,
          limit: q.limit,
        },
        200,
        req,
      );
    }

    // GET /deals/:id - Get single deal
    // An unknown sub-resource answers 404 rather than the parent record.
    // PA-020's rule: falling through to the row is what makes the NEXT missing
    // branch invisible - a component mapping over an object renders an empty
    // list and reports nothing, so the gap reads as "no data yet". Non-GET
    // methods already reach the terminal refusal below.
    if (req.method === 'GET' && dealId && subResource) {
      return createCorsResponse({ error: `Unknown deal sub-resource: ${subResource}` }, 404, req);
    }

    if (req.method === 'GET' && dealId) {
      // Select deal without FK joins to avoid schema cache errors
      const { data: deal, error } = await admin
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching deal:', error);
        return createCorsResponse({ error: 'Deal not found' }, 404, req);
      }

      const stageNames = buildStageNameMap(await loadStages(admin, tenantId));

      // WF-C-09: the contract this deal became. Read by contract_id when the
      // deal carries the back-link, and by deal_id otherwise - the two sides are
      // written together but a back-fill can leave one of them behind, and a
      // detail page that shows nothing because only one direction was populated
      // is the kind of gap nobody reports. Best-effort: a deal that has no
      // contract is the normal case and must not 500 here.
      let contract = null;
      try {
        const linked = deal.contract_id
          ? await admin
              .from('contracts')
              .select(
                'id, contract_number, status, start_date, end_date, acquisition_type, lease_id',
              )
              .eq('id', deal.contract_id)
              .eq('tenant_id', tenantId)
              .maybeSingle()
          : await admin
              .from('contracts')
              .select(
                'id, contract_number, status, start_date, end_date, acquisition_type, lease_id',
              )
              .eq('deal_id', dealId)
              .eq('tenant_id', tenantId)
              .limit(1)
              .maybeSingle();
        contract = linked?.data ?? null;
      } catch (err) {
        console.error('Error loading the deal contract:', err);
      }

      // WF-C-05: the lease, when the deal was paid for on somebody else's paper.
      // Read through the contract's lease_id rather than by proposal, because a
      // contract is what a lease attaches to and one deal can produce only one.
      // Best-effort for the same reason the contract read is.
      let lease = null;
      try {
        if (contract?.lease_id) {
          const { data } = await admin
            .from('leases')
            .select(
              'id, lease_number, lease_name, status, lease_type, monthly_payment, term, total_amount, start_date, end_date, first_payment_date, lessor_name',
            )
            .eq('id', contract.lease_id)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          lease = data ?? null;
        }
      } catch (err) {
        console.error('Error loading the deal lease:', err);
      }

      // COP-B11: contact coverage. The score treats single-threading as a risk
      // and could not read it, because a deal carries one primary contact and
      // the committee lives in crm_associations. Counted in both directions,
      // because an association is written from whichever side made the link.
      // Best-effort: a failure here costs one signal, not the page.
      let contactCount: number | null = null;
      try {
        const { data: contactLinks } = await admin
          .from('crm_associations')
          .select('source_type, source_id, target_type, target_id')
          .eq('tenant_id', tenantId)
          .or(
            `and(source_type.eq.deal,source_id.eq.${dealId},target_type.eq.contact),` +
              `and(target_type.eq.deal,target_id.eq.${dealId},source_type.eq.contact)`,
          );
        const linked = new Set(
          (contactLinks ?? []).map((l: Record<string, any>) =>
            l.source_type === 'contact' ? l.source_id : l.target_id,
          ),
        );
        // The primary contact is a person on the deal whether or not anybody
        // associated them. Counted only when no association carries the deal,
        // so a committee that already includes them is not inflated by one.
        if (linked.size === 0 && (deal.primary_contact_email || deal.primary_contact_phone)) {
          contactCount = 1;
        } else {
          contactCount = linked.size;
        }
      } catch (err) {
        console.error('Error counting deal contacts:', err);
      }

      // COP-B11's last planned signal, now that COP-B02 has given a quote a
      // deal to belong to. The deal's most recent LIVE quote - a rejected or
      // superseded one is not what the deal is being sold at, and scoring the
      // margin of a quote nobody is considering would be worse than scoring
      // none. Best-effort, and tolerant of the unapplied migration.
      let quoteMarginPct: number | null = null;
      let quoteDiscountPct: number | null = null;
      try {
        const { data: quote, error: quoteError } = await admin
          .from('proposals')
          .select('total_margin_percentage, discount_percentage, status, created_at')
          .eq('tenant_id', tenantId)
          .eq('deal_id', dealId)
          .not('status', 'in', '("rejected","expired","superseded")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!quoteError && quote) {
          const margin = Number((quote as Record<string, any>).total_margin_percentage);
          const discount = Number((quote as Record<string, any>).discount_percentage);
          quoteMarginPct = Number.isFinite(margin) ? margin : null;
          quoteDiscountPct = Number.isFinite(discount) ? discount : null;
        }
      } catch (err) {
        console.error('Error reading the deal quote margin:', err);
      }

      return createCorsResponse(
        {
          ...toDealResponse(deal, stageNames),
          contract,
          lease,
          contactCount,
          quoteMarginPct,
          quoteDiscountPct,
        },
        200,
        req,
      );
    }

    // POST /deals - Create deal
    //
    // PROD-008b: `!dealId` is load-bearing. Without it this matched ANY POST
    // under the prefix, so POST /deals/<uuid> or /deals/<uuid>/<anything> the
    // function has no branch for fell through to here and CREATED A NEW DEAL
    // instead of answering 405. Same shape as the activities bulk-delete that
    // inserted a row; on `deals` it manufactures pipeline.
    if (req.method === 'POST' && !dealId) {
      const body = await req.json();

      // COP-M01: this used to insert business_record_id, deal_name, deal_value,
      // stage, next_step and created_by — six columns `deals` does not have —
      // while omitting stage_id and created_by_id, which are NOT NULL. Creating
      // a deal from the CRM page could not succeed in dev or production.
      const title = body.title || body.dealName || body.deal_name;
      if (!title) {
        return createCorsResponse({ error: 'title is required' }, 400, req);
      }

      const stages = await loadStages(admin, tenantId);
      const stageId = resolveStageId(stages, body.stageId || body.stage_id || body.stage);
      if (!stageId) {
        return createCorsResponse(
          {
            error:
              'No pipeline stages are configured for this tenant, so a deal cannot be created yet.',
            code: 'NO_DEAL_STAGES',
          },
          400,
          req,
        );
      }

      const amount = body.amount ?? body.value ?? body.dealValue ?? body.deal_value ?? 0;

      const dealData: Record<string, any> = {
        tenant_id: tenantId,
        title,
        description: body.description || null,
        amount,
        stage_id: stageId,
        probability: body.probability ?? 10,
        expected_close_date: body.expectedCloseDate || body.expected_close_date || null,
        owner_id: body.ownerId || body.owner_id || user.id,
        customer_id: body.customerId || body.customer_id || null,
        // WF-S-03. `leadId` is accepted because that is the key LeadDeals has
        // always sent. `companyId` is NOT: LeadDetail computes it as
        // `lead.companyId || lead.id` and business_records has no company_id
        // column, so it is only ever the lead's own id wearing another name -
        // reading it as a second identifier would make a coincidence look like
        // a relationship.
        source_business_record_id:
          body.sourceBusinessRecordId ||
          body.source_business_record_id ||
          body.businessRecordId ||
          body.business_record_id ||
          body.leadId ||
          body.lead_id ||
          null,
        company_name: body.companyName || body.company_name || null,
        priority: body.priority || 'medium',
        source: body.source || null,
        deal_type: body.dealType || body.deal_type || null,
        primary_contact_name: body.primaryContactName || body.primary_contact_name || null,
        primary_contact_email: body.primaryContactEmail || body.primary_contact_email || null,
        primary_contact_phone: body.primaryContactPhone || body.primary_contact_phone || null,
        notes: body.notes || null,
        // COP-M04. `??` not `||`, because 0 is a real answer for a volume or a
        // buyout exposure and `||` would write null over it.
        deal_motion: body.dealMotion ?? body.deal_motion ?? null,
        forecast_category: body.forecastCategory ?? body.forecast_category ?? null,
        incumbent_vendor: body.incumbentVendor ?? body.incumbent_vendor ?? null,
        lease_buyout_exposure: body.leaseBuyoutExposure ?? body.lease_buyout_exposure ?? null,
        trade_in_value: body.tradeInValue ?? body.trade_in_value ?? null,
        current_monthly_volume_bw:
          body.currentMonthlyVolumeBw ?? body.current_monthly_volume_bw ?? null,
        current_monthly_volume_color:
          body.currentMonthlyVolumeColor ?? body.current_monthly_volume_color ?? null,
        target_cpc_black: body.targetCpcBlack ?? body.target_cpc_black ?? null,
        target_cpc_color: body.targetCpcColor ?? body.target_cpc_color ?? null,
        replaces_contract_id: body.replacesContractId ?? body.replaces_contract_id ?? null,
        created_by_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (body.customFields || body.custom_fields) {
        dealData.custom_fields = body.customFields || body.custom_fields;
      }

      const { data: deal, error } = await admin.from('deals').insert(dealData).select().single();

      if (error) {
        console.error('Error creating deal:', error);
        return createCorsResponse({ error: 'Failed to create deal', details: error }, 500, req);
      }

      const stageNames = buildStageNameMap(stages);
      return createCorsResponse(toDealResponse(deal, stageNames), 201, req);
    }

    // PATCH /deals/:id - Update deal
    if ((req.method === 'PATCH' || req.method === 'PUT') && dealId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Same correction as the bulk map: every value is a real column. The old
      // map wrote deal_name, deal_value, stage, next_step and closed_date, so an
      // edit that touched the deal's name, amount or stage failed.
      const fieldMap: Record<string, string> = BULK_FIELD_MAP;

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      // A stage slug has to become a stage_id; an id passes straight through.
      const requestedStage = body.stageId ?? body.stage_id ?? body.stage;
      if (requestedStage !== undefined && requestedStage !== null && requestedStage !== '') {
        const resolved = resolveStageId(await loadStages(admin, tenantId), String(requestedStage));
        if (resolved) updateData.stage_id = resolved;
      }

      const { data: deal, error } = await admin
        .from('deals')
        .update(updateData)
        .eq('id', dealId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating deal:', error);
        return createCorsResponse({ error: 'Failed to update deal' }, 500, req);
      }

      // CRMX-008a: the deal.stage_changed trigger seam, DIRECT-API PATH ONLY.
      //
      // It used to live only in server/routes-deals.ts, under a prefix this
      // edge function is proxied for, so it ran on neither host and no workflow
      // ever enrolled on a stage change. Dedupe by deal + new stage so a
      // repeated PUT does not enrol twice; Safe so automation can never fail
      // the update.
      //
      // WF-C-01: NO CLIENT REACHES THIS BRANCH. It fires only when a caller
      // sends stage_id to PATCH /api/deals/:id, and nothing in any client tree
      // does - the Kanban board and the deal page both post to
      // POST /api/pipeline-config/deals/:id/move, which is where the UI's stage
      // changes actually happen and which now dispatches the same event with the
      // same `stage:<deal>:<stage>` dedupe key. Kept, not deleted, because an
      // API client patching stage_id directly is a legitimate path and should
      // still trigger automation; the dedupe key is what stops the two from
      // enrolling one move twice.
      if (updateData.stage_id) {
        await dispatchWorkflowEventSafe(
          admin,
          tenantId,
          'deal.stage_changed',
          {
            dealId: deal.id,
            recordId: deal.id,
            stageId: deal.stage_id ?? updateData.stage_id,
            status: deal.status,
            amount: deal.amount,
          },
          { dedupeKey: `stage:${deal.id}:${updateData.stage_id}`, initiatedBy: user.id },
        );
      }

      // COP-M06: a renewal deal closing is the renewal's outcome. Tracked on
      // renewal_auto_quotes, which the rep no longer visits now that the draft
      // lands on the board, so the deal has to carry the answer back. No-ops
      // for any deal that is not a renewal.
      if (updateData.status) {
        await syncRenewalOutcomeFromDeal(admin, tenantId, deal);
      }

      return createCorsResponse(deal, 200, req);
    }

    // DELETE /deals/:id - Delete deal
    if (req.method === 'DELETE' && dealId) {
      const { error } = await admin
        .from('deals')
        .delete()
        .eq('id', dealId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting deal:', error);
        return createCorsResponse({ error: 'Failed to delete deal' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Deal deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in deals function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
