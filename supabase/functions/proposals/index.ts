/**
 * Proposals edge function.
 *
 * Replaces server/routes-proposals.ts (1,778 lines). Endpoints:
 *
 *   Templates (3):
 *     GET    /proposals/proposal-templates
 *     POST   /proposals/proposal-templates
 *     PUT    /proposals/proposal-templates/:id
 *
 *   Equipment packages (2):
 *     GET    /proposals/equipment-packages
 *     POST   /proposals/equipment-packages
 *
 *   Proposals core (7):
 *     GET    /proposals                           — list with status/filter/aging
 *     GET    /proposals/new                       — blank template for new-proposal form
 *     GET    /proposals/:id                       — detail + lineItems
 *     POST   /proposals                           — create (auto proposal_number + optional line items)
 *     PUT    /proposals/:id                       — full update (may replace line items)
 *     PATCH  /proposals/:id                       — partial update
 *     DELETE /proposals/:id
 *     PATCH  /proposals/:id/status                — status transition + timestamps + analytics
 *     POST   /proposals/:id/track-view            — analytics
 *
 *   Line items (3):
 *     POST   /proposals/:proposalId/line-items
 *     PUT    /proposals/:proposalId/line-items/:lineItemId
 *     DELETE /proposals/:proposalId/line-items/:lineItemId
 *
 *   Sub-resource reads (already in v1):
 *     GET    /proposals/:id/line-items
 *     GET    /proposals/:id/sections
 *     GET    /proposals/:id/comments
 *     GET    /proposals/:id/analytics
 *     POST   /proposals/:id/comments
 *
 *   PDF export (2):
 *     GET    /proposals/:id/export/pdf            — consumer-facing (_pdf.ts)
 *     GET    /proposals/:id/export/manager-pdf    — includes cost + margin; manager-only
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { renderProposalPDF } from './_pdf.ts';

const log = createLogger('proposals');

function stripPrefix(path: string): string {
  return path.replace(/^\/+/, '/').replace(/^\/proposals/, '') || '/';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type SB = any;

async function generateProposalNumber(db: SB, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;

  const { data } = await db
    .from('proposals')
    .select('proposal_number')
    .eq('tenant_id', tenantId)
    .like('proposal_number', `${prefix}%`)
    .order('proposal_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let next = 1;
  if (data?.proposal_number) {
    const current = parseInt(String(data.proposal_number).replace(prefix, ''), 10);
    if (!isNaN(current)) next = current + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

// Real columns on proposal_line_items (snake_case). Anything else is dropped so a
// stray camelCase key or a UI-only field can never fail the whole insert.
const LINE_ITEM_COLUMNS = [
  'line_number',
  'item_type',
  'product_id',
  'product_code',
  'product_name',
  'description',
  'quantity',
  'unit_cost',
  'unit_price',
  'total_price',
  'discount',
  'margin',
  'notes',
  'is_recurring',
  'recurring_frequency',
  'recurring_duration',
  'lead_time',
  'warranty_period',
  'service_level',
  'is_optional',
  'is_customizable',
  'configuration_options',
  'alternative_options',
];

// camelCase (what the UI sends) → snake_case column. `productType` is the UI's
// name for item_type.
const LINE_ITEM_FIELD_MAP: Record<string, string> = {
  lineNumber: 'line_number',
  itemType: 'item_type',
  productType: 'item_type',
  productId: 'product_id',
  productCode: 'product_code',
  productName: 'product_name',
  unitCost: 'unit_cost',
  unitPrice: 'unit_price',
  totalPrice: 'total_price',
  isRecurring: 'is_recurring',
  recurringFrequency: 'recurring_frequency',
  recurringDuration: 'recurring_duration',
  leadTime: 'lead_time',
  warrantyPeriod: 'warranty_period',
  serviceLevel: 'service_level',
  isOptional: 'is_optional',
  isCustomizable: 'is_customizable',
  configurationOptions: 'configuration_options',
  alternativeOptions: 'alternative_options',
};

// Normalize an inbound line item (camelCase OR snake_case) into a clean insert row.
// Computes total_price and margin when the caller omits them so cost/margin are
// always authoritative server-side.
function normalizeLineItem(
  raw: Record<string, unknown>,
  tenantId: string,
  proposalId: string,
  index: number,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  // Pass 1: snake_case columns as-is (snake wins).
  for (const col of LINE_ITEM_COLUMNS) {
    if (raw[col] !== undefined) row[col] = raw[col];
  }
  // Pass 2: camelCase fallbacks.
  for (const [camel, col] of Object.entries(LINE_ITEM_FIELD_MAP)) {
    if (raw[camel] !== undefined && row[col] === undefined) row[col] = raw[camel];
  }

  row.tenant_id = tenantId;
  row.proposal_id = proposalId;
  row.line_number = toNum(row.line_number) || index + 1;
  row.item_type = row.item_type || 'equipment';
  row.product_name = row.product_name || 'Item';

  const qty = toNum(row.quantity) || 1;
  row.quantity = qty;
  const unitPrice = toNum(row.unit_price);
  row.unit_price = unitPrice;
  row.unit_cost = toNum(row.unit_cost);
  row.total_price = toNum(row.total_price) || unitPrice * qty;
  if (row.margin === undefined || row.margin === null || row.margin === '') {
    row.margin =
      unitPrice > 0
        ? Number((((unitPrice - toNum(row.unit_cost)) / unitPrice) * 100).toFixed(2))
        : 0;
  }
  return row;
}

async function recalculateProposalTotals(
  db: SB,
  proposalId: string,
  tenantId: string,
): Promise<void> {
  const { data: items } = await db
    .from('proposal_line_items')
    .select('total_price, unit_cost, quantity')
    .eq('proposal_id', proposalId)
    .eq('tenant_id', tenantId);

  let subtotal = 0;
  let totalCost = 0;
  for (const item of items ?? []) {
    subtotal += toNum(item.total_price);
    totalCost += toNum(item.unit_cost) * (toNum(item.quantity) || 1);
  }

  const { data: proposal } = await db
    .from('proposals')
    .select('discount_amount, tax_amount')
    .eq('id', proposalId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!proposal) return;

  const discount = toNum(proposal.discount_amount);
  const tax = toNum(proposal.tax_amount);
  const totalAmount = subtotal - discount + tax;
  // Gross-profit margin on pre-tax revenue (matches PricingCalculator + _pdf.ts).
  const revenue = subtotal - discount;
  const marginPct = revenue > 0 ? Number((((revenue - totalCost) / revenue) * 100).toFixed(2)) : 0;

  await db
    .from('proposals')
    .update({
      subtotal: String(subtotal),
      total_amount: String(totalAmount),
      total_dealer_cost: String(totalCost),
      total_margin_percentage: String(marginPct),
      updated_at: new Date().toISOString(),
    })
    .eq('id', proposalId)
    .eq('tenant_id', tenantId);
}

// ─── Deal / Contract sync (ported from deleted routes-proposals.ts) ────────────
//
// Fires on PATCH /proposals/:id/status when status='sent' or 'accepted'.
// Best-effort: the caller swallows thrown errors so a sync failure never blocks
// the status update.

async function getStageIdByName(
  db: SB,
  tenantId: string,
  stageName: string,
): Promise<string | null> {
  const { data } = await db
    .from('deal_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', stageName)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function getFirstStageId(db: SB, tenantId: string): Promise<string | null> {
  const { data } = await db
    .from('deal_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function getWonStageId(db: SB, tenantId: string): Promise<string | null> {
  const { data } = await db
    .from('deal_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_won_stage', true)
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id;
  const byName = await getStageIdByName(db, tenantId, 'Closed Won');
  if (byName) return byName;
  return await getFirstStageId(db, tenantId);
}

async function getProposalSentStageId(db: SB, tenantId: string): Promise<string | null> {
  // "Presentation Scheduled" is a safe mid-pipeline fallback.
  for (const name of ['Contract Sent', 'Proposal Sent', 'Presentation Scheduled']) {
    const id = await getStageIdByName(db, tenantId, name);
    if (id) return id;
  }
  return await getFirstStageId(db, tenantId);
}

async function upsertDealForProposal(
  db: SB,
  proposal: any,
  userId: string,
  tenantId: string,
  options?: { forceWon?: boolean },
): Promise<string | null> {
  const { data: customer } = await db
    .from('business_records')
    .select('id, company_name')
    .eq('id', proposal.business_record_id)
    .maybeSingle();

  const title = `${proposal.title} (${proposal.proposal_number})`;

  const { data: existing } = await db
    .from('deals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('title', title)
    .limit(1)
    .maybeSingle();

  const stageId = options?.forceWon
    ? await getWonStageId(db, tenantId)
    : await getProposalSentStageId(db, tenantId);

  if (!stageId) {
    // No stages configured → can't satisfy the NOT NULL constraint. Abort
    // quietly (matches deleted Express behavior).
    return existing?.id ?? null;
  }

  const numericTotal =
    proposal.total_amount !== null && proposal.total_amount !== undefined
      ? Number(proposal.total_amount)
      : null;
  const amount = numericTotal !== null ? String(numericTotal) : null;

  if (existing?.id) {
    await db
      .from('deals')
      .update({
        stage_id: stageId,
        amount,
        probability: options?.forceWon ? 100 : 70,
        status: options?.forceWon ? 'won' : 'open',
        actual_close_date: options?.forceWon ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId);
    return existing.id;
  }

  const { data: created } = await db
    .from('deals')
    .insert({
      tenant_id: tenantId,
      title,
      description: proposal.executive_summary ?? null,
      amount,
      owner_id: userId,
      customer_id: proposal.business_record_id ?? null,
      company_name: customer?.company_name ?? null,
      stage_id: stageId,
      probability: options?.forceWon ? 100 : 70,
      expected_close_date: proposal.valid_until ?? null,
      status: options?.forceWon ? 'won' : 'open',
      created_by_id: userId,
    })
    .select('id')
    .maybeSingle();

  return created?.id ?? null;
}

async function generateContractNumber(db: SB, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CT-${year}-`;
  const { data } = await db
    .from('contracts')
    .select('contract_number')
    .eq('tenant_id', tenantId)
    .like('contract_number', `${prefix}%`)
    .order('contract_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let next = 1;
  if (data?.contract_number) {
    const n = parseInt(String(data.contract_number).replace(prefix, ''), 10);
    if (!isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

async function createContractFromProposal(
  db: SB,
  proposal: any,
  tenantId: string,
): Promise<string | null> {
  // Deleted Express code wrote fields (contract_type, auto_renewal,
  // billing_frequency, assigned_salesperson_id, notes) that don't exist in the
  // actual contracts table (verified against migration 0000). We only insert
  // the columns that exist.
  const contractNumber = await generateContractNumber(db, tenantId);
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 36); // default 36-month term

  const { data: created } = await db
    .from('contracts')
    .insert({
      tenant_id: tenantId,
      customer_id: proposal.business_record_id,
      contract_number: contractNumber,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: 'active',
    })
    .select('id')
    .maybeSingle();

  return created?.id ?? null;
}

// Field map for PATCH/PUT proposal update — matches Express
const PROPOSAL_FIELD_MAP: Record<string, string> = {
  title: 'title',
  status: 'status',
  proposalType: 'proposal_type',
  businessRecordId: 'business_record_id',
  contactId: 'contact_id',
  templateId: 'template_id',
  subtotal: 'subtotal',
  discountAmount: 'discount_amount',
  discountPercentage: 'discount_percentage',
  taxAmount: 'tax_amount',
  totalAmount: 'total_amount',
  validUntil: 'valid_until',
  paymentTerms: 'payment_terms',
  internalNotes: 'internal_notes',
  notes: 'internal_notes',
  version: 'version',
  estimatedStartDate: 'estimated_start_date',
  estimatedEndDate: 'estimated_end_date',
  executiveSummary: 'executive_summary',
  assignedTo: 'assigned_to',
};

function buildProposalUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [camelKey, snakeKey] of Object.entries(PROPOSAL_FIELD_MAP)) {
    if (body[camelKey] !== undefined) {
      out[snakeKey] = body[camelKey];
    } else if (body[snakeKey] !== undefined) {
      out[snakeKey] = body[snakeKey];
    }
  }
  return out;
}

export default async function handler(req: Request) {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = generateRequestId();
  const startedAt = Date.now();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = stripPrefix(url.pathname);

  log.info({ requestId, method, path }, 'request_received');

  try {
    const ctx = await requireAuth(req);
    const db = getDb();

    // =========================================================================
    // PROPOSAL TEMPLATES
    // =========================================================================

    if (path === '/proposal-templates' && method === 'GET') {
      const { data, error } = await db
        .from('proposal_templates')
        .select('*')
        .eq('tenant_id', ctx.tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return errorResponse(500, 'Failed to fetch proposal templates', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    if (path === '/proposal-templates' && method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const { data, error } = await db
        .from('proposal_templates')
        .insert({
          ...body,
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !data) {
        return errorResponse(500, 'Failed to create proposal template', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data, 201, req, requestId);
    }

    const templateUpdate = path.match(/^\/proposal-templates\/([^/]+)$/);
    if (templateUpdate && method === 'PUT') {
      const id = templateUpdate[1];
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }
      const { updatedAt: _drop, ...rest } = body;

      const { data, error } = await db
        .from('proposal_templates')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .select()
        .maybeSingle();

      if (error) {
        return errorResponse(500, 'Failed to update proposal template', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      if (!data) {
        return errorResponse(404, 'Template not found', req, { code: 'NOT_FOUND', requestId });
      }
      return jsonResponse(data, 200, req, requestId);
    }

    // =========================================================================
    // EQUIPMENT PACKAGES
    // =========================================================================

    if (path === '/equipment-packages' && method === 'GET') {
      const { data, error } = await db
        .from('equipment_packages')
        .select('*')
        .eq('tenant_id', ctx.tenantId)
        .order('package_name', { ascending: true });

      if (error) {
        return errorResponse(500, 'Failed to fetch equipment packages', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    if (path === '/equipment-packages' && method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const { data, error } = await db
        .from('equipment_packages')
        .insert({
          ...body,
          tenant_id: ctx.tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !data) {
        return errorResponse(500, 'Failed to create equipment package', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data, 201, req, requestId);
    }

    // =========================================================================
    // PROPOSALS CORE
    // =========================================================================

    // GET /proposals - list (with aging filter, status, business record)
    if (path === '/' && method === 'GET') {
      const status = url.searchParams.get('status');
      const businessRecordId = url.searchParams.get('businessRecordId');
      const filter = url.searchParams.get('filter');
      const days = url.searchParams.get('days');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = db
        .from('proposals')
        .select('*', { count: 'exact' })
        .eq('tenant_id', ctx.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (businessRecordId) query = query.eq('business_record_id', businessRecordId);
      if (search) {
        query = query.or(`title.ilike.%${search}%,proposal_number.ilike.%${search}%`);
      }
      if (filter === 'aging' && days) {
        const n = parseInt(days, 10);
        if (!isNaN(n) && n > 0) {
          const cutoff = new Date(Date.now() - n * 86400000).toISOString();
          query = query.lt('created_at', cutoff);
        }
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(500, 'Failed to fetch proposals', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // GET /proposals/new - blank form template
    if (path === '/new' && method === 'GET') {
      return jsonResponse(
        {
          id: 'new',
          tenantId: ctx.tenantId,
          proposalNumber: '',
          version: 1,
          title: '',
          businessRecordId: null,
          proposalType: 'quote',
          status: 'draft',
          totalAmount: '0',
          validUntil: null,
          sentAt: null,
          viewedAt: null,
          acceptedAt: null,
          createdBy: ctx.userId,
          assignedTo: ctx.userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customerName: null,
          customerEmail: null,
          customerPhone: null,
          customerAddress: null,
          lineItems: [],
          comments: [],
        },
        200,
        req,
        requestId,
      );
    }

    // POST /proposals - create (with optional line items + auto-number)
    if (path === '/' && method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const proposalNumber =
        body.proposalNumber ||
        body.proposal_number ||
        (await generateProposalNumber(db, ctx.tenantId));

      const { data: proposal, error } = await db
        .from('proposals')
        .insert({
          tenant_id: ctx.tenantId,
          proposal_number: proposalNumber,
          title: body.title,
          status: body.status || 'draft',
          proposal_type: body.proposalType || body.proposal_type || 'quote',
          business_record_id: body.businessRecordId || body.business_record_id || null,
          contact_id: body.contactId || body.contact_id || null,
          template_id: body.templateId || body.template_id || null,
          subtotal: body.subtotal ?? 0,
          discount_amount: body.discountAmount || body.discount_amount || 0,
          discount_percentage: body.discountPercentage || body.discount_percentage || 0,
          tax_amount: body.taxAmount || body.tax_amount || 0,
          total_amount: body.totalAmount || body.total_amount || 0,
          valid_until: body.validUntil || body.valid_until || null,
          payment_terms: body.paymentTerms || body.payment_terms || null,
          internal_notes: body.notes || body.internalNotes || body.internal_notes || null,
          assigned_to: body.assignedTo || body.assigned_to || ctx.userId,
          created_by: ctx.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !proposal) {
        return errorResponse(500, 'Failed to create proposal', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }

      // Optional inline line items
      const lineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
      if (lineItems.length > 0) {
        const rows = lineItems.map((item: Record<string, unknown>, index: number) =>
          normalizeLineItem(item, ctx.tenantId, (proposal as { id: string }).id, index),
        );
        const insertItems = await db.from('proposal_line_items').insert(rows);
        if (insertItems.error) {
          log.warn(
            { requestId, err: insertItems.error },
            'Proposal created but line-item insert failed',
          );
        } else {
          await recalculateProposalTotals(db, (proposal as { id: string }).id, ctx.tenantId);
        }
      }

      return jsonResponse(proposal, 201, req, requestId);
    }

    // Match /:id for GET/PUT/PATCH/DELETE — and /:id/sub for sub-resources below
    const idMatch = path.match(/^\/([^/]+)$/);
    const subMatch = path.match(/^\/([^/]+)\/([^/]+)$/);
    const nestedMatch = path.match(/^\/([^/]+)\/([^/]+)\/([^/]+)$/);

    // GET /proposals/:id - detail + lineItems
    if (idMatch && method === 'GET') {
      const id = idMatch[1];
      const proposal = await db
        .from('proposals')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .limit(1)
        .maybeSingle();

      if (proposal.error) {
        return errorResponse(500, 'Failed to fetch proposal', req, {
          code: 'DB_ERROR',
          details: proposal.error,
          requestId,
        });
      }
      if (!proposal.data) {
        return errorResponse(404, 'Proposal not found', req, { code: 'NOT_FOUND', requestId });
      }

      const items = await db
        .from('proposal_line_items')
        .select('*')
        .eq('proposal_id', id)
        .eq('tenant_id', ctx.tenantId)
        .order('line_number', { ascending: true });

      return jsonResponse({ ...proposal.data, lineItems: items.data ?? [] }, 200, req, requestId);
    }

    // PUT/PATCH /proposals/:id
    if (idMatch && (method === 'PUT' || method === 'PATCH')) {
      const id = idMatch[1];
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const { lineItems: lineItemsToUpdate, ..._rest } = body;
      const updateData = buildProposalUpdate(body);

      const { data: proposal, error } = await db
        .from('proposals')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .select()
        .maybeSingle();

      if (error) {
        return errorResponse(500, 'Failed to update proposal', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      if (!proposal) {
        return errorResponse(404, 'Proposal not found', req, { code: 'NOT_FOUND', requestId });
      }

      // Replace line items if provided — matches Express PUT/PATCH semantics
      if (Array.isArray(lineItemsToUpdate) && lineItemsToUpdate.length > 0) {
        await db
          .from('proposal_line_items')
          .delete()
          .eq('proposal_id', id)
          .eq('tenant_id', ctx.tenantId);

        const rows = lineItemsToUpdate.map((item: Record<string, unknown>, index: number) =>
          normalizeLineItem(item, ctx.tenantId, id, index),
        );
        const insertItems = await db.from('proposal_line_items').insert(rows);
        if (insertItems.error) {
          log.warn(
            { requestId, err: insertItems.error },
            'Proposal updated but line-item replace failed',
          );
        } else {
          await recalculateProposalTotals(db, id, ctx.tenantId);
        }
      }

      return jsonResponse(proposal, 200, req, requestId);
    }

    // DELETE /proposals/:id
    if (idMatch && method === 'DELETE') {
      const id = idMatch[1];
      const { error } = await db
        .from('proposals')
        .delete()
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId);
      if (error) {
        return errorResponse(500, 'Failed to delete proposal', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse({ success: true, message: 'Proposal deleted' }, 200, req, requestId);
    }

    // =========================================================================
    // PROPOSAL SUB-RESOURCES (GET list)
    // =========================================================================

    if (subMatch && method === 'GET') {
      const [, proposalId, sub] = subMatch;

      if (sub === 'line-items') {
        const { data, error } = await db
          .from('proposal_line_items')
          .select('*')
          .eq('proposal_id', proposalId)
          .eq('tenant_id', ctx.tenantId)
          .order('line_number', { ascending: true });
        if (error) {
          return errorResponse(500, 'Failed to fetch line items', req, {
            code: 'DB_ERROR',
            details: error,
            requestId,
          });
        }
        return jsonResponse(data ?? [], 200, req, requestId);
      }

      if (sub === 'sections') {
        const { data, error } = await db
          .from('proposal_sections')
          .select('*')
          .eq('proposal_id', proposalId)
          .eq('tenant_id', ctx.tenantId)
          .order('order_index', { ascending: true });
        if (error) {
          return errorResponse(500, 'Failed to fetch sections', req, {
            code: 'DB_ERROR',
            details: error,
            requestId,
          });
        }
        return jsonResponse(data ?? [], 200, req, requestId);
      }

      if (sub === 'comments') {
        const { data, error } = await db
          .from('proposal_comments')
          .select('*')
          .eq('proposal_id', proposalId)
          .eq('tenant_id', ctx.tenantId)
          .order('created_at', { ascending: false });
        if (error) {
          return errorResponse(500, 'Failed to fetch comments', req, {
            code: 'DB_ERROR',
            details: error,
            requestId,
          });
        }
        return jsonResponse(data ?? [], 200, req, requestId);
      }

      if (sub === 'analytics') {
        const { data, error } = await db
          .from('proposal_analytics')
          .select('*')
          .eq('proposal_id', proposalId)
          .eq('tenant_id', ctx.tenantId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) {
          return errorResponse(500, 'Failed to fetch analytics', req, {
            code: 'DB_ERROR',
            details: error,
            requestId,
          });
        }
        return jsonResponse(data ?? [], 200, req, requestId);
      }
    }

    // =========================================================================
    // /:id/status, /:id/track-view, /:proposalId/line-items (POST)
    // =========================================================================

    // PATCH /proposals/:id/status
    if (subMatch && method === 'PATCH' && subMatch[2] === 'status') {
      const id = subMatch[1];
      const body = await req.json().catch(() => null);
      if (!body?.status) {
        return errorResponse(400, 'status is required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }
      const status = String(body.status);
      const nowIso = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        status,
        updated_at: nowIso,
      };
      if (status === 'sent') updateData.sent_at = nowIso;
      if (status === 'viewed') updateData.viewed_at = nowIso;
      if (status === 'accepted') updateData.accepted_at = nowIso;
      if (status === 'rejected') updateData.rejected_at = nowIso;

      const { data: proposal, error } = await db
        .from('proposals')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .select()
        .maybeSingle();

      if (error) {
        return errorResponse(500, 'Failed to update proposal status', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      if (!proposal) {
        return errorResponse(404, 'Proposal not found', req, { code: 'NOT_FOUND', requestId });
      }

      // Sales Pipeline + Contracts sync — best-effort, same semantics as the
      // deleted Express routes-proposals.ts: errors here do NOT fail the
      // status update. See upsertDealForProposal / createContractFromProposal
      // below.
      if (status === 'sent') {
        try {
          await upsertDealForProposal(db, proposal, ctx.userId, ctx.tenantId);
        } catch (syncError) {
          log.warn({ requestId, err: syncError }, 'Deal upsert failed (status=sent)');
        }
      }
      if (status === 'accepted') {
        try {
          await upsertDealForProposal(db, proposal, ctx.userId, ctx.tenantId, { forceWon: true });
        } catch (syncError) {
          log.warn({ requestId, err: syncError }, 'Deal upsert failed (status=accepted)');
        }
        try {
          await createContractFromProposal(db, proposal, ctx.tenantId);
        } catch (syncError) {
          log.warn({ requestId, err: syncError }, 'Contract create failed (status=accepted)');
        }
      }

      // Best-effort analytics event
      const analyticsInsert = await db.from('proposal_analytics').insert({
        tenant_id: ctx.tenantId,
        proposal_id: id,
        event_type: `status_${status}`,
        event_details: {
          previousStatus: body.previousStatus,
          newStatus: status,
        },
      });
      if (analyticsInsert.error) {
        log.warn({ requestId, err: analyticsInsert.error }, 'Analytics insert failed');
      }

      return jsonResponse(proposal, 200, req, requestId);
    }

    // POST /proposals/:id/track-view
    if (subMatch && method === 'POST' && subMatch[2] === 'track-view') {
      const id = subMatch[1];
      // Increment open_count atomically via rpc or select-then-update. Use rpc
      // pattern: fetch current, then set. Race conditions are acceptable for
      // analytics counters.
      const current = await db
        .from('proposals')
        .select('open_count')
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle();

      const openCount = ((current.data?.open_count as number | null) ?? 0) + 1;
      const nowIso = new Date().toISOString();
      await db
        .from('proposals')
        .update({ open_count: openCount, last_opened_at: nowIso, updated_at: nowIso })
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId);

      await db.from('proposal_analytics').insert({
        tenant_id: ctx.tenantId,
        proposal_id: id,
        event_type: 'opened',
        event_details: {
          userAgent: req.headers.get('user-agent') ?? null,
          timestamp: nowIso,
        },
      });

      return jsonResponse({ success: true, openCount }, 200, req, requestId);
    }

    // POST /proposals/:proposalId/line-items
    if (subMatch && method === 'POST' && subMatch[2] === 'line-items') {
      const proposalId = subMatch[1];
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      // Compute next line_number
      const existing = await db
        .from('proposal_line_items')
        .select('line_number')
        .eq('proposal_id', proposalId)
        .eq('tenant_id', ctx.tenantId)
        .order('line_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextLineNumber = ((existing.data?.line_number as number | null) ?? 0) + 1;

      const insertRow = normalizeLineItem(body, ctx.tenantId, proposalId, nextLineNumber - 1);
      insertRow.line_number = nextLineNumber;

      const { data, error } = await db
        .from('proposal_line_items')
        .insert(insertRow)
        .select()
        .single();

      if (error || !data) {
        return errorResponse(500, 'Failed to add line item', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }

      await recalculateProposalTotals(db, proposalId, ctx.tenantId);
      return jsonResponse(data, 201, req, requestId);
    }

    // POST /proposals/:proposalId/comments
    if (subMatch && method === 'POST' && subMatch[2] === 'comments') {
      const proposalId = subMatch[1];
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const { data, error } = await db
        .from('proposal_comments')
        .insert({
          tenant_id: ctx.tenantId,
          proposal_id: proposalId,
          user_id: ctx.userId,
          author_id: ctx.userId,
          author_name: ctx.email ?? null,
          comment: body.comment || body.commentText,
          is_internal: body.isInternal ?? body.is_internal ?? false,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !data) {
        return errorResponse(500, 'Failed to create comment', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      return jsonResponse(data, 201, req, requestId);
    }

    // =========================================================================
    // /:proposalId/line-items/:lineItemId  (PUT + DELETE)
    // =========================================================================

    if (nestedMatch && nestedMatch[2] === 'line-items' && method === 'PUT') {
      const [, proposalId, , lineItemId] = nestedMatch;
      const body = await req.json().catch(() => null);
      if (!body) {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const { data, error } = await db
        .from('proposal_line_items')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', lineItemId)
        .eq('proposal_id', proposalId)
        .eq('tenant_id', ctx.tenantId)
        .select()
        .maybeSingle();

      if (error) {
        return errorResponse(500, 'Failed to update line item', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      if (!data) {
        return errorResponse(404, 'Line item not found', req, {
          code: 'NOT_FOUND',
          requestId,
        });
      }

      await recalculateProposalTotals(db, proposalId, ctx.tenantId);
      return jsonResponse(data, 200, req, requestId);
    }

    if (nestedMatch && nestedMatch[2] === 'line-items' && method === 'DELETE') {
      const [, proposalId, , lineItemId] = nestedMatch;
      const { error, count } = await db
        .from('proposal_line_items')
        .delete({ count: 'exact' })
        .eq('id', lineItemId)
        .eq('proposal_id', proposalId)
        .eq('tenant_id', ctx.tenantId);

      if (error) {
        return errorResponse(500, 'Failed to delete line item', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }
      if (!count) {
        return errorResponse(404, 'Line item not found', req, {
          code: 'NOT_FOUND',
          requestId,
        });
      }

      await recalculateProposalTotals(db, proposalId, ctx.tenantId);
      return jsonResponse({ success: true }, 200, req, requestId);
    }

    // =========================================================================
    // PDF export (pdf-lib via esm.sh — see _pdf.ts)
    // =========================================================================

    const pdfMatch = path.match(/^\/([^/]+)\/export\/(pdf|manager-pdf)$/);
    if (pdfMatch && method === 'GET') {
      const id = pdfMatch[1];
      const isManager = pdfMatch[2] === 'manager-pdf';

      // Manager-PDF requires manager-level access. Mirror the Express role
      // check: default-allow unless the user's role matches a sales-only
      // pattern.
      if (isManager) {
        const rawRole = String(
          (ctx.supabaseUser as any)?.app_metadata?.role ??
            (ctx.supabaseUser as any)?.user_metadata?.role ??
            '',
        ).toLowerCase();
        const salesOnlyRoles = ['sales_rep', 'salesperson', 'sales'];
        const isSalesOnly = salesOnlyRoles.some((r) => rawRole === r || rawRole.endsWith(r));
        if (isSalesOnly) {
          return errorResponse(403, 'Manager-level access required', req, {
            code: 'FORBIDDEN',
            requestId,
          });
        }
      }

      const { data: proposal, error: pErr } = await db
        .from('proposals')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle();
      if (pErr) {
        return errorResponse(500, 'Failed to load proposal', req, {
          code: 'DB_ERROR',
          details: pErr,
          requestId,
        });
      }
      if (!proposal) {
        return errorResponse(404, 'Proposal not found', req, { code: 'NOT_FOUND', requestId });
      }

      const { data: lineItems } = await db
        .from('proposal_line_items')
        .select('*')
        .eq('proposal_id', id)
        .eq('tenant_id', ctx.tenantId)
        .order('line_number', { ascending: true });

      let company: any = null;
      if (proposal.business_record_id) {
        const r = await db
          .from('business_records')
          .select('company_name, email, phone, first_name, last_name')
          .eq('id', proposal.business_record_id)
          .eq('tenant_id', ctx.tenantId)
          .maybeSingle();
        company = r.data;
      }

      let contact: any = null;
      if (proposal.contact_id) {
        const r = await db
          .from('company_contacts')
          .select('first_name, last_name')
          .eq('id', proposal.contact_id)
          .eq('tenant_id', ctx.tenantId)
          .maybeSingle();
        contact = r.data;
      }

      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await renderProposalPDF({
          proposal,
          lineItems: lineItems ?? [],
          company,
          contact,
          isManager,
        });
      } catch (renderErr) {
        log.error({ requestId, err: String(renderErr) }, 'pdf_render_failed');
        return errorResponse(500, 'Failed to render PDF', req, {
          code: 'PDF_RENDER_ERROR',
          requestId,
        });
      }

      const filename = `Quote-${proposal.proposal_number}${isManager ? '-manager' : ''}.pdf`;
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(pdfBytes.byteLength),
          'X-Request-ID': requestId,
        },
      });
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path, method },
      requestId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info({ requestId, path, method, durationMs: Date.now() - startedAt }, 'request_complete');
  }
}
