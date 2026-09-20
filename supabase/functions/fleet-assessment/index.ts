// Fleet assessment / TCO builder (COP-B05).
//
// Endpoints (the dispatcher strips the function-name segment first):
//   GET    /preview?dealId=      cost the current fleet without saving anything
//   POST   /                     compute, snapshot, attach to the deal
//   GET    /?dealId=             the deal's saved assessments
//   GET    /:id                  one snapshot
//   DELETE /:id
//
// `preview` BRANCHES BEFORE parts[0] IS READ AS AN ID (the SUPA-024 shape,
// where a real endpoint dies inside a generic :id branch and answers 404).
//
// THE SNAPSHOT IS THE RECORD. POST stores the computed result rather than the
// inputs, because an assessment is a document a rep put in front of a customer
// on a date - recomputing it after a meter lands or a contract is re-rated
// would silently change what was presented, and their copy would stop matching
// ours.
//
// Every number comes from shared/fleet-assessment.ts, which refuses to guess: a
// machine with no meters or no rate is a gap, and a total built over one says
// it is a floor. Nothing here fills those in.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { startOfUtcDay } from '../_shared/date-months.ts';
import { ROLE_LEVEL, RbacError, requireRoleLevel } from '../_shared/rbac.ts';
import type { AuthContext } from '../_shared/auth.ts';
import {
  assessCurrentFleet,
  compareFleets,
  modelProposedFleet,
  type AssessmentContract,
  type AssessmentReading,
  type AssessmentTier,
  type ProposedMachine,
} from '../../../shared/fleet-assessment.ts';

type Row = Record<string, any>;

/** 13 months, so a full twelve-month window always has a prior reading to measure from. */
const READING_WINDOW_DAYS = 400;

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
    if (userError || !user) return createCorsResponse({ error: 'Unauthorized' }, 401, req);

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'fleet-assessment');
    const resource = parts[0];

    /** The account whose fleet this is, resolved from the deal when one is given. */
    const resolveCustomer = async (
      dealId: string | null,
      customerIdParam: string | null,
    ): Promise<{ customerId: string | null; deal: Row | null }> => {
      if (dealId) {
        const { data } = await admin
          .from('deals')
          .select('id, customer_id, company_name, title')
          .eq('id', dealId)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        return {
          customerId: (data as Row)?.customer_id ?? customerIdParam,
          deal: (data as Row) ?? null,
        };
      }
      return { customerId: customerIdParam, deal: null };
    };

    /** Everything the engine needs, read once. */
    const gather = async (customerId: string) => {
      const since = startOfUtcDay(
        new Date(Date.now() - READING_WINDOW_DAYS * 86_400_000),
      ).toISOString();

      const equipment = await fetchAllRows<Row>(() =>
        admin
          .from('equipment')
          .select(
            'id, customer_id, serial_number, model_number, is_color_capable, equipment_status',
          )
          .eq('tenant_id', tenantId)
          .eq('customer_id', customerId),
      );

      const equipmentIds = (equipment ?? []).map((e) => String(e.id));
      const readings =
        equipmentIds.length > 0
          ? await fetchAllRows<Row>(() =>
              admin
                .from('meter_readings')
                .select(
                  'equipment_id, reading_date, bw_meter_reading, color_meter_reading, black_copies, color_copies',
                )
                .eq('tenant_id', tenantId)
                .in('equipment_id', equipmentIds.slice(0, 1000))
                // reading_date is a CALENDAR DATE stored at midnight, so the
                // bound is snapped to a day (DATE-LOCAL-002).
                .gte('reading_date', since),
            )
          : [];

      const { data: contractRows } = await admin
        .from('contracts')
        .select('id, monthly_base, black_rate, color_rate, status, start_date, end_date')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .order('start_date', { ascending: false });

      // The active one, else the most recent. An expired contract still states
      // the rates the customer has been paying, which is the honest baseline.
      const rows = (contractRows ?? []) as Row[];
      const contractRow = rows.find((c) => c.status === 'active') ?? rows[0] ?? null;

      const tierRows = contractRow
        ? await fetchAllRows<Row>(() =>
            admin
              .from('contract_tiered_rates')
              .select(
                'contract_id, tier_name, color_type, minimum_volume, maximum_volume, rate, sort_order',
              )
              .eq('tenant_id', tenantId)
              .eq('contract_id', contractRow.id),
          )
        : [];

      const contract: AssessmentContract | null = contractRow
        ? {
            id: String(contractRow.id),
            monthlyBase: contractRow.monthly_base,
            blackRate: contractRow.black_rate,
            colorRate: contractRow.color_rate,
            status: contractRow.status,
          }
        : null;

      const tiers: AssessmentTier[] = (tierRows ?? []).map((t) => ({
        contractId: String(t.contract_id),
        tierName: t.tier_name ?? null,
        colorType: String(t.color_type ?? ''),
        minimumVolume: t.minimum_volume,
        maximumVolume: t.maximum_volume,
        rate: t.rate,
        sortOrder: t.sort_order,
      }));

      const assessmentReadings: AssessmentReading[] = (readings ?? []).map((r) => ({
        equipmentId: String(r.equipment_id),
        readingDate: r.reading_date,
        bwMeterReading: r.bw_meter_reading,
        colorMeterReading: r.color_meter_reading,
        blackCopies: r.black_copies,
        colorCopies: r.color_copies,
      }));

      return {
        current: assessCurrentFleet({
          equipment: (equipment ?? []).map((e) => ({
            id: String(e.id),
            serialNumber: e.serial_number ?? null,
            modelName: e.model_number ?? null,
            isColorCapable: e.is_color_capable ?? null,
            customerId: e.customer_id ?? null,
          })),
          readings: assessmentReadings,
          contract,
          tiers,
        }),
        contractId: contract?.id ?? null,
      };
    };

    // ─── GET /preview ────────────────────────────────────────────────
    if (resource === 'preview' && req.method === 'GET') {
      const { customerId } = await resolveCustomer(
        url.searchParams.get('dealId'),
        url.searchParams.get('customerId'),
      );
      if (!customerId) {
        return createCorsResponse(
          {
            error: 'This deal has no account on it, so there is no fleet to assess.',
            code: 'NO_CUSTOMER',
          },
          400,
          req,
        );
      }
      const { current, contractId } = await gather(customerId);
      return createCorsResponse({ customerId, contractId, current }, 200, req);
    }

    // ─── POST / ──────────────────────────────────────────────────────
    if (req.method === 'POST' && !resource) {
      const body = (await req.json().catch(() => ({}))) as Row;
      const dealId = body.dealId ? String(body.dealId) : null;
      const { customerId, deal } = await resolveCustomer(dealId, body.customerId ?? null);
      if (!customerId) {
        return createCorsResponse(
          { error: 'An account is required to assess a fleet', code: 'NO_CUSTOMER' },
          400,
          req,
        );
      }

      const termMonths = Math.max(1, Math.round(Number(body.termMonths) || 36));
      const proposedFleet: ProposedMachine[] = Array.isArray(body.proposedFleet)
        ? body.proposedFleet.map((m: Row) => ({
            modelName: String(m.modelName ?? ''),
            quantity: Number(m.quantity) || 0,
            monthlyBase: m.monthlyBase ?? null,
            blackRate: m.blackRate ?? null,
            colorRate: m.colorRate ?? null,
          }))
        : [];

      const { current } = await gather(customerId);
      const proposed = modelProposedFleet(
        proposedFleet,
        current.monthlyBlackVolume,
        current.monthlyColorVolume,
      );
      const comparison = compareFleets(current, proposed, termMonths);

      const { data: saved, error } = await admin
        .from('fleet_assessments')
        .insert({
          tenant_id: tenantId,
          deal_id: dealId,
          customer_id: customerId,
          name: body.name ? String(body.name).slice(0, 200) : null,
          term_months: termMonths,
          current_state: current,
          proposed_fleet: proposedFleet,
          proposed_state: proposed,
          comparison,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      // AC5: on the deal's timeline. Best-effort - an assessment that saved
      // must not be reported as failed because a timeline row did not write.
      if (dealId) {
        const saving =
          comparison.monthlyDelta == null
            ? 'no priced proposal yet'
            : `${comparison.monthlyDelta >= 0 ? 'saves' : 'costs'} $${Math.abs(
                comparison.monthlyDelta,
              ).toFixed(2)}/month`;
        const { error: activityError } = await admin.from('deal_activities').insert({
          tenant_id: tenantId,
          deal_id: dealId,
          type: 'note',
          subject: `Fleet assessment: ${saving}`,
          description: current.partial
            ? `${current.measuredMachines} of ${current.totalMachines} machines could be costed, so the current-state figure is a floor.`
            : `${current.totalMachines} machines costed from meters and contracted rates.`,
          user_id: user.id,
        });
        if (activityError) {
          console.error('[FLEET-ASSESSMENT] timeline write failed:', activityError.message);
        }
      }

      return createCorsResponse(
        {
          id: (saved as Row).id,
          customerId,
          dealTitle: deal?.title ?? null,
          current,
          proposed,
          comparison,
          termMonths,
        },
        201,
        req,
      );
    }

    // ─── GET /:id ────────────────────────────────────────────────────
    if (req.method === 'GET' && resource) {
      const { data, error } = await admin
        .from('fleet_assessments')
        .select('*')
        .eq('id', resource)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return createCorsResponse({ error: 'Assessment not found' }, 404, req);
      return createCorsResponse(toResponse(data as Row), 200, req);
    }

    // ─── DELETE /:id ─────────────────────────────────────────────────
    //
    // BUILDING an assessment is a rep's own work and is open to any tenant
    // member - a TCO a rep cannot run is the spreadsheet this story replaces.
    // DELETING one is not: a snapshot is a document that was put in front of a
    // customer, and removing the record of what was said that day is a manager
    // act. A LEVEL check, not a permission code (SEC-EDGE-002).
    if (req.method === 'DELETE' && resource) {
      const authCtx: AuthContext = {
        userId: user.id,
        tenantId,
        email: user.email,
        jwt: jwt ?? '',
        supabaseUser: user,
      };
      try {
        requireRoleLevel(authCtx, ROLE_LEVEL.MANAGER);
      } catch (err) {
        if (err instanceof RbacError) {
          return createCorsResponse(
            {
              error: 'Deleting a saved fleet assessment requires a manager role',
              code: 'INSUFFICIENT_ROLE',
              details: err.details,
            },
            403,
            req,
          );
        }
        throw err;
      }
      const { error } = await admin
        .from('fleet_assessments')
        .delete()
        .eq('id', resource)
        .eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
      return createCorsResponse({ success: true, id: resource }, 200, req);
    }

    // ─── GET / ───────────────────────────────────────────────────────
    if (req.method === 'GET' && !resource) {
      let query = admin
        .from('fleet_assessments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);
      const dealId = url.searchParams.get('dealId');
      const customerId = url.searchParams.get('customerId');
      if (dealId) query = query.eq('deal_id', dealId);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return createCorsResponse(
        { data: (data ?? []).map((r) => toResponse(r as Row)), total: (data ?? []).length },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[FLEET-ASSESSMENT] error:', error);
    return createCorsResponse(
      { error: 'Request failed', message: (error as Error).message },
      500,
      req,
    );
  }
}

function toResponse(row: Row) {
  return {
    id: row.id,
    dealId: row.deal_id,
    customerId: row.customer_id,
    name: row.name,
    termMonths: row.term_months,
    current: row.current_state,
    proposedFleet: row.proposed_fleet ?? [],
    proposed: row.proposed_state,
    comparison: row.comparison,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
