// Deal Desk Copilot Edge Function (US-SUPER-008).
//
// Advisory, non-blocking sidebar on the quote (proposal) edit page. The quote IS
// a proposal — `quoteId` is `proposals.id`. Every per-quote endpoint resolves the
// proposal by id+tenant first (404 if missing); the customer is
// `proposals.business_record_id`.
//
// Ported from the Express routes (server/routes-deal-desk-copilot.ts) so the
// feature works in production, where the frontend calls the edge function
// directly. Drizzle queries are translated to the Supabase service client.
//
// Routes (the dispatcher strips the leading function-name segment; we also strip
// an optional leading `deal-desk-copilot` defensively):
//   GET /settings                      — getOrCreate per-tenant GP floor
//   PUT /settings                      — { gpFloorPct?: 0..100 }
//   GET /:quoteId/snapshot             — fast Postgres-only account snapshot
//   GET /:quoteId/similar-deals        — top-5 closed-won comps (memoized 1h)
//   GET /:quoteId/margin               — live GP$/GP% vs floor
//   GET /:quoteId/objections           — Claude objections + deterministic fallback
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { generateCompletion } from '../_shared/anthropic.ts';

type SB = ReturnType<typeof createSupabaseServiceClient>;

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

const CLOSED_TICKET_STATUSES = new Set(['completed', 'closed', 'resolved', 'cancelled']);

// ---------------------------------------------------------------------------
// Settings (per-tenant GP floor)
// ---------------------------------------------------------------------------

async function getOrCreateSettings(
  admin: SB,
  tenantId: string,
): Promise<{ tenant_id: string; gp_floor_pct: number; updated_by_user_id: string | null }> {
  const existing = await admin
    .from('deal_desk_copilot_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existing.data) return existing.data;

  // Insert the default row; tolerate a race (another request created it first).
  const inserted = await admin
    .from('deal_desk_copilot_settings')
    .insert({ tenant_id: tenantId })
    .select()
    .maybeSingle();
  if (inserted.data) return inserted.data;

  const after = await admin
    .from('deal_desk_copilot_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  // Fall back to an in-memory default if the table is unavailable.
  return after.data ?? { tenant_id: tenantId, gp_floor_pct: 30, updated_by_user_id: null };
}

/** Resolve a proposal by id+tenant. Returns null if missing (caller 404s). */
async function resolveProposal(admin: SB, tenantId: string, quoteId: string) {
  const { data } = await admin
    .from('proposals')
    .select('*')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Similar-deals memo cache (module-level, 1-hour TTL, per isolate)
// ---------------------------------------------------------------------------

interface SimilarDealsResult {
  closeRate: number | null;
  avgDiscount: number | null;
  avgDealSize: number | null;
  cohortSize: number;
  deals: Array<{
    id: string;
    proposalNumber: string;
    totalAmount: number;
    discountPercentage: number;
    updatedAt: string | null;
  }>;
  matching: {
    territory: string | null;
    proposalType: string | null;
    sizeBandLow: number;
    sizeBandHigh: number;
    headcountMatch: 'stub';
    machineClassMatch: 'stub';
  };
}

const similarDealsCache = new Map<string, { value: SimilarDealsResult; expires: number }>();
const SIMILAR_DEALS_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleSnapshot(admin: SB, tenantId: string, quoteId: string, req: Request) {
  const proposal = await resolveProposal(admin, tenantId, quoteId);
  if (!proposal) return createCorsResponse({ message: 'Quote not found' }, 404, req);
  const customerId = proposal.business_record_id;

  // Open service tickets: count + by-priority.
  const tickets = await admin
    .from('service_tickets')
    .select('priority,status')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId);
  const open = (tickets.data ?? []).filter(
    (t: Record<string, unknown>) =>
      !CLOSED_TICKET_STATUSES.has(String(t.status ?? '').toLowerCase()),
  );
  const byPriority: Record<string, number> = {};
  for (const t of open) {
    const p = String((t as Record<string, unknown>).priority ?? 'unknown').toLowerCase();
    byPriority[p] = (byPriority[p] ?? 0) + 1;
  }

  // AR aging buckets (positive balances only).
  const invoiceRows = await admin
    .from('invoices')
    .select('balance_due,due_date')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId);
  const now = Date.now();
  const arAging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  for (const inv of invoiceRows.data ?? []) {
    const bal = num((inv as Record<string, unknown>).balance_due);
    if (bal <= 0) continue;
    const dueRaw = (inv as Record<string, unknown>).due_date;
    const due = dueRaw ? new Date(dueRaw as string).getTime() : now;
    const daysPastDue = Math.floor((now - due) / 86_400_000);
    if (daysPastDue <= 0) arAging.current += bal;
    else if (daysPastDue <= 30) arAging.d1_30 += bal;
    else if (daysPastDue <= 60) arAging.d31_60 += bal;
    else if (daysPastDue <= 90) arAging.d61_90 += bal;
    else arAging.d90_plus += bal;
  }
  const arTotal =
    arAging.current + arAging.d1_30 + arAging.d31_60 + arAging.d61_90 + arAging.d90_plus;
  const arPastDue = arAging.d1_30 + arAging.d31_60 + arAging.d61_90 + arAging.d90_plus;

  // Last 3 quote outcomes (this customer's OTHER proposals).
  const lastQuotes = await admin
    .from('proposals')
    .select('proposal_number,status,total_amount,updated_at')
    .eq('tenant_id', tenantId)
    .eq('business_record_id', customerId)
    .neq('id', proposal.id)
    .order('updated_at', { ascending: false })
    .limit(3);

  // Latest churn score for the customer.
  const churn = await admin
    .from('customer_churn_scores')
    .select('score,band')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return createCorsResponse(
    {
      customerId,
      openTickets: { total: open.length, byPriority },
      arAging: { ...arAging, total: arTotal, pastDue: arPastDue },
      lastQuotes: (lastQuotes.data ?? []).map((q: Record<string, unknown>) => ({
        proposalNumber: q.proposal_number,
        status: q.status,
        totalAmount: num(q.total_amount),
        updatedAt: q.updated_at,
      })),
      churn: churn.data ? { score: num(churn.data.score), band: churn.data.band } : null,
    },
    200,
    req,
  );
}

async function handleSimilarDeals(admin: SB, tenantId: string, quoteId: string, req: Request) {
  const proposal = await resolveProposal(admin, tenantId, quoteId);
  if (!proposal) return createCorsResponse({ message: 'Quote not found' }, 404, req);
  const customerId = proposal.business_record_id;

  const customer = await admin
    .from('business_records')
    .select('territory')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const territory = customer.data?.territory ?? null;
  const proposalType = proposal.proposal_type ?? null;
  const thisSize = num(proposal.total_amount) || num(proposal.subtotal);
  const sizeBandLow = thisSize * 0.5;
  const sizeBandHigh = thisSize > 0 ? thisSize * 1.5 : Number.POSITIVE_INFINITY;
  const sizeBandKey =
    thisSize > 0 ? `${Math.round(sizeBandLow)}-${Math.round(sizeBandHigh)}` : 'any';

  const cacheKey = `${tenantId}:${territory ?? '-'}:${sizeBandKey}:${proposalType ?? '-'}`;
  const cached = similarDealsCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return createCorsResponse(cached.value, 200, req);
  }

  let candidateQuery = admin
    .from('proposals')
    .select(
      'id,proposal_number,status,total_amount,discount_percentage,updated_at,business_record_id',
    )
    .eq('tenant_id', tenantId);
  if (proposalType) candidateQuery = candidateQuery.eq('proposal_type', proposalType);
  const candidates = await candidateQuery.limit(2000);
  const candidateRows = (candidates.data ?? []) as Array<Record<string, unknown>>;

  // Resolve territories for the candidate customers (best-effort region match).
  let territoryMatchIds: Set<string> | null = null;
  if (territory) {
    const custIds = Array.from(new Set(candidateRows.map((c) => c.business_record_id as string)));
    const custRows = custIds.length
      ? await admin
          .from('business_records')
          .select('id,territory')
          .eq('tenant_id', tenantId)
          .in('id', custIds)
      : { data: [] as Array<Record<string, unknown>> };
    territoryMatchIds = new Set(
      (custRows.data ?? [])
        .filter((r: Record<string, unknown>) => r.territory === territory)
        .map((r: Record<string, unknown>) => r.id as string),
    );
  }

  const cohort = candidateRows.filter((c) => {
    if (territoryMatchIds && !territoryMatchIds.has(c.business_record_id as string)) return false;
    const amt = num(c.total_amount);
    if (thisSize > 0 && (amt < sizeBandLow || amt > sizeBandHigh)) return false;
    return true;
  });

  const accepted = cohort.filter((c) => c.status === 'accepted');
  const decided = cohort.filter((c) =>
    ['accepted', 'rejected', 'expired'].includes(String(c.status ?? '')),
  );
  const closeRate =
    decided.length > 0 ? Math.round((accepted.length / decided.length) * 1000) / 10 : null;
  const avgDiscount =
    cohort.length > 0
      ? Math.round(
          (cohort.reduce((a, c) => a + num(c.discount_percentage), 0) / cohort.length) * 10,
        ) / 10
      : null;
  const avgDealSize =
    cohort.length > 0
      ? Math.round(cohort.reduce((a, c) => a + num(c.total_amount), 0) / cohort.length)
      : null;

  const topDeals = [...accepted]
    .sort((a, b) => num(b.total_amount) - num(a.total_amount))
    .slice(0, 5)
    .map((d) => ({
      id: d.id as string,
      proposalNumber: d.proposal_number as string,
      totalAmount: num(d.total_amount),
      discountPercentage: num(d.discount_percentage),
      updatedAt: (d.updated_at as string) ?? null,
    }));

  const result: SimilarDealsResult = {
    closeRate,
    avgDiscount,
    avgDealSize,
    cohortSize: cohort.length,
    deals: topDeals,
    matching: {
      territory,
      proposalType,
      sizeBandLow,
      sizeBandHigh: Number.isFinite(sizeBandHigh) ? sizeBandHigh : 0,
      headcountMatch: 'stub',
      machineClassMatch: 'stub',
    },
  };

  similarDealsCache.set(cacheKey, { value: result, expires: Date.now() + SIMILAR_DEALS_TTL_MS });
  return createCorsResponse(result, 200, req);
}

async function handleMargin(admin: SB, tenantId: string, quoteId: string, req: Request) {
  const proposal = await resolveProposal(admin, tenantId, quoteId);
  if (!proposal) return createCorsResponse({ message: 'Quote not found' }, 404, req);

  const revenue = num(proposal.total_amount) || num(proposal.subtotal);

  const lines = await admin
    .from('proposal_line_items')
    .select('unit_cost,quantity')
    .eq('tenant_id', tenantId)
    .eq('proposal_id', proposal.id);
  const cost = (lines.data ?? []).reduce(
    (a: number, l: Record<string, unknown>) => a + num(l.unit_cost) * (num(l.quantity) || 1),
    0,
  );

  const grossProfit = revenue - cost;
  const gpPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;

  const settings = await getOrCreateSettings(admin, tenantId);
  const gpFloorPct = num(settings.gp_floor_pct) || 30;
  const belowFloor = revenue > 0 && gpPercent < gpFloorPct;

  return createCorsResponse(
    {
      revenue,
      cost,
      grossProfit,
      gpPercent,
      gpFloorPct,
      belowFloor,
      financingNote: 'STUB: financing/lease terms are not yet modeled into cost or GP.',
      serviceCostNote:
        'STUB: cost = parts/line unitCost only; projected service/labor cost not yet modeled.',
    },
    200,
    req,
  );
}

async function handleObjections(admin: SB, tenantId: string, quoteId: string, req: Request) {
  const proposal = await resolveProposal(admin, tenantId, quoteId);
  if (!proposal) return createCorsResponse({ message: 'Quote not found' }, 404, req);
  const customerId = proposal.business_record_id;

  const [customer, tickets, invoiceRows, lineRows, lastQuotes] = await Promise.all([
    admin
      .from('business_records')
      .select('company_name,industry,territory')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('service_tickets')
      .select('status,priority')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId),
    admin
      .from('invoices')
      .select('balance_due,due_date')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId),
    admin
      .from('proposal_line_items')
      .select('product_name,unit_cost,quantity')
      .eq('tenant_id', tenantId)
      .eq('proposal_id', proposal.id),
    admin
      .from('proposals')
      .select('status,valid_until')
      .eq('tenant_id', tenantId)
      .eq('business_record_id', customerId)
      .neq('id', proposal.id)
      .order('updated_at', { ascending: false })
      .limit(3),
  ]);

  const openTickets = (tickets.data ?? []).filter(
    (t: Record<string, unknown>) =>
      !CLOSED_TICKET_STATUSES.has(String(t.status ?? '').toLowerCase()),
  ).length;

  const now = Date.now();
  let pastDue = 0;
  for (const inv of invoiceRows.data ?? []) {
    const bal = num((inv as Record<string, unknown>).balance_due);
    if (bal <= 0) continue;
    const dueRaw = (inv as Record<string, unknown>).due_date;
    const due = dueRaw ? new Date(dueRaw as string).getTime() : now;
    if (due < now) pastDue += bal;
  }

  const lines = (lineRows.data ?? []) as Array<Record<string, unknown>>;
  const revenue = num(proposal.total_amount) || num(proposal.subtotal);
  const cost = lines.reduce((a, l) => a + num(l.unit_cost) * (num(l.quantity) || 1), 0);
  const gpPercent = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
  const settings = await getOrCreateSettings(admin, tenantId);
  const gpFloorPct = num(settings.gp_floor_pct) || 30;
  const belowFloor = revenue > 0 && gpPercent < gpFloorPct;

  const hasExpiredPrior = (lastQuotes.data ?? []).some((q: Record<string, unknown>) => {
    if (q.status === 'expired') return true;
    return q.valid_until ? new Date(q.valid_until as string).getTime() < now : false;
  });

  // Deterministic fallback derived from real signals.
  const fallback: Array<{ objection: string; response: string }> = [];
  if (openTickets > 0) {
    fallback.push({
      objection: `Concern about current service responsiveness (${openTickets} open ticket${openTickets === 1 ? '' : 's'}).`,
      response:
        'Acknowledge the open tickets, share the resolution plan/SLA, and tie the proposal to improved service coverage.',
    });
  }
  if (pastDue > 0) {
    fallback.push({
      objection: `Budget / payment-terms hesitation (about $${Math.round(pastDue).toLocaleString()} past due on the account).`,
      response:
        'Offer flexible payment terms or a payment plan, and confirm AR is current before close to de-risk the deal.',
    });
  }
  if (belowFloor) {
    fallback.push({
      objection: 'Price pushback / request for a deeper discount.',
      response:
        'Reinforce total value and TCO; the margin is already below floor, so anchor on outcomes rather than cutting price further.',
    });
  }
  if (hasExpiredPrior) {
    fallback.push({
      objection: 'Timing — a prior quote already expired without a decision.',
      response:
        'Surface what changed since the last quote and add a clear, time-bound incentive to drive a decision now.',
    });
  }
  fallback.push({
    objection: 'Evaluating competing vendors / staying with the incumbent.',
    response:
      'Differentiate on local service, response times, and bundled value; offer references and a side-by-side comparison.',
  });
  if (fallback.length < 3) {
    fallback.push({
      objection: 'Need to involve additional stakeholders before deciding.',
      response:
        'Offer to present to the broader buying committee and provide an executive summary tailored to each role.',
    });
  }
  const deterministic = fallback.slice(0, 5);

  // Try Claude; fall back deterministically on any failure (incl. no API key).
  try {
    const lineSummary = lines
      .slice(0, 20)
      .map((l) => `- ${l.product_name ?? 'item'} x${num(l.quantity) || 1}`)
      .join('\n');
    const prompt =
      `You are a deal-desk advisor for a copier/MFP dealer. Predict the buyer's likely ` +
      `objections to this quote and give a concise suggested rep response for each.\n\n` +
      `Customer: ${customer.data?.company_name ?? 'Unknown'} (industry: ${customer.data?.industry ?? 'n/a'}, territory: ${customer.data?.territory ?? 'n/a'}).\n` +
      `Open service tickets: ${openTickets}. Past-due AR: $${Math.round(pastDue)}.\n` +
      `Quote total: $${Math.round(revenue)}; gross margin: ${gpPercent.toFixed(1)}% (floor ${gpFloorPct}%${belowFloor ? ', BELOW floor' : ''}).\n` +
      `Prior expired quote: ${hasExpiredPrior ? 'yes' : 'no'}.\n` +
      `Quote line items:\n${lineSummary || '- (none)'}\n\n` +
      `Return ONLY a JSON array of 3-5 objects, each {"objection": string, "response": string}. No prose.`;

    const text = await generateCompletion({
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (x: unknown) =>
            x &&
            typeof (x as Record<string, unknown>).objection === 'string' &&
            typeof (x as Record<string, unknown>).response === 'string',
        )
      ) {
        return createCorsResponse(
          {
            objections: parsed
              .slice(0, 5)
              .map((x: Record<string, unknown>) => ({
                objection: x.objection,
                response: x.response,
              })),
            source: 'ai',
          },
          200,
          req,
        );
      }
    }
  } catch (aiError) {
    console.warn('Objections AI failed; using fallback:', (aiError as Error)?.message);
  }

  return createCorsResponse({ objections: deterministic, source: 'fallback' }, 200, req);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

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
    } = await supabase.auth.getUser(jwt ?? undefined);
    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    let parts = url.pathname.split('/').filter(Boolean);
    // Defensive: strip an optional leading `deal-desk-copilot` segment so the fn
    // works whether or not the dispatcher already removed the function name.
    if (parts[0] === 'deal-desk-copilot') parts = parts.slice(1);

    const first = parts[0]; // 'settings' | quoteId
    const action = parts[1]; // 'snapshot' | 'similar-deals' | 'margin' | 'objections'

    // -------- SETTINGS (must be matched before /:quoteId/*) --------
    if (first === 'settings' && !action) {
      if (req.method === 'GET') {
        return createCorsResponse(await getOrCreateSettings(admin, tenantId), 200, req);
      }
      if (req.method === 'PUT') {
        const body = await req.json().catch(() => ({}));
        const raw = body?.gpFloorPct ?? body?.gp_floor_pct;
        if (raw !== undefined) {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            return createCorsResponse({ message: 'gpFloorPct must be 0..100' }, 400, req);
          }
          await getOrCreateSettings(admin, tenantId); // ensure row exists
          const { data, error } = await admin
            .from('deal_desk_copilot_settings')
            .update({
              gp_floor_pct: n,
              updated_by_user_id: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId)
            .select()
            .maybeSingle();
          if (error) return createCorsResponse({ message: 'Failed to update settings' }, 500, req);
          return createCorsResponse(data, 200, req);
        }
        return createCorsResponse(await getOrCreateSettings(admin, tenantId), 200, req);
      }
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // -------- PER-QUOTE endpoints --------
    if (first && action && req.method === 'GET') {
      switch (action) {
        case 'snapshot':
          return await handleSnapshot(admin, tenantId, first, req);
        case 'similar-deals':
          return await handleSimilarDeals(admin, tenantId, first, req);
        case 'margin':
          return await handleMargin(admin, tenantId, first, req);
        case 'objections':
          return await handleObjections(admin, tenantId, first, req);
      }
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('deal-desk-copilot error:', (error as Error)?.message);
    return createCorsResponse(
      { error: 'Internal error', message: (error as Error)?.message },
      500,
      req,
    );
  }
}
