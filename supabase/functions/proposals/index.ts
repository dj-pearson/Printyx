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
 *   PDF export (2) — STUBBED:
 *     GET    /proposals/:id/export/pdf            — 501 until pdf-lib port (Phase 4 leases pattern)
 *     GET    /proposals/:id/export/manager-pdf    — same
 *
 * Deferred to follow-ups:
 *   - upsertDealForProposal / createContractFromProposal (CRM sync on status='sent'/'accepted').
 *     The Express version runs these best-effort after status PATCH; edge version
 *     logs the intent but doesn't execute — tracked as its own follow-up issue.
 *   - PDF generation — requires the `pdf-lib` via esm.sh pattern from the
 *     Phase 4 leases PRD. Separate follow-up.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

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

async function recalculateProposalTotals(
  db: SB,
  proposalId: string,
  tenantId: string,
): Promise<void> {
  const { data: items } = await db
    .from('proposal_line_items')
    .select('total_price')
    .eq('proposal_id', proposalId)
    .eq('tenant_id', tenantId);

  const subtotal = (items ?? []).reduce(
    (sum: number, item: { total_price?: string | number | null }) =>
      sum + parseFloat(String(item.total_price ?? '0')),
    0,
  );

  const { data: proposal } = await db
    .from('proposals')
    .select('discount_amount, tax_amount')
    .eq('id', proposalId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!proposal) return;

  const discount = parseFloat(String(proposal.discount_amount ?? '0'));
  const tax = parseFloat(String(proposal.tax_amount ?? '0'));
  const totalAmount = subtotal - discount + tax;

  await db
    .from('proposals')
    .update({
      subtotal: String(subtotal),
      total_amount: String(totalAmount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', proposalId)
    .eq('tenant_id', tenantId);
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

serve(async (req) => {
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
        const rows = lineItems.map((item: Record<string, unknown>, index: number) => ({
          ...item,
          tenant_id: ctx.tenantId,
          proposal_id: (proposal as { id: string }).id,
          line_number: (item.lineNumber as number | undefined) || index + 1,
          item_type: item.itemType || 'equipment',
        }));
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

        const rows = lineItemsToUpdate.map((item: Record<string, unknown>, index: number) => ({
          ...item,
          tenant_id: ctx.tenantId,
          proposal_id: id,
          line_number: (item.lineNumber as number | undefined) || index + 1,
          item_type: item.itemType || 'equipment',
        }));
        const insertItems = await db.from('proposal_line_items').insert(rows);
        if (insertItems.error) {
          log.warn(
            { requestId, err: insertItems.error },
            'Proposal updated but line-item replace failed',
          );
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

      // CRM/Contract sync (deferred): Express calls upsertDealForProposal and
      // createContractFromProposal on status='sent'/'accepted'. Those depend
      // on 4+ tables and business logic worth its own port. Flagged for
      // follow-up — mirrors the check-approval stub pattern from deal-desk.
      if (status === 'sent' || status === 'accepted') {
        log.info(
          { requestId, proposalId: id, status },
          'CRM/contract sync skipped — follow-up task',
        );
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

      const insertRow = {
        ...body,
        tenant_id: ctx.tenantId,
        proposal_id: proposalId,
        line_number: nextLineNumber,
        item_type: body.itemType || body.item_type || 'equipment',
      };

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
    // PDF export — STUBBED
    // =========================================================================

    const pdfMatch = path.match(/^\/([^/]+)\/export\/(pdf|manager-pdf)$/);
    if (pdfMatch && method === 'GET') {
      return errorResponse(501, 'PDF export is not yet implemented on the edge function.', req, {
        code: 'NOT_IMPLEMENTED',
        details: {
          reason:
            'Express used puppeteer + handlebars (Node-only). Edge port requires the pdf-lib via esm.sh pattern from Phase 4 leases PRD.',
          followUp: 'Tracked as a post-migration task',
        },
        requestId,
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
});
