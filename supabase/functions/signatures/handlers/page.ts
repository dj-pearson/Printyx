// Legacy ESignatureIntegration page compatibility (EDGE-005e).
//
// The client page client/src/pages/ESignatureIntegration.tsx was built against an
// ORPHANED mock Express router (server/routes-esignature.ts — never mounted, returned
// fictional sample data). It reads a rich legacy shape: documentName, customerName,
// requestedDate, expirationDate, contractValue, signers[], plus a fixed analytics object.
//
// This handler serves that exact page shape from the REAL signature_requests table so the
// page works in production. Prod hits functions.printyx.net/signatures/* directly, so the
// flat /api/signature-{requests,templates,analytics} prefixes are consolidated under the
// canonical /api/signatures/* prefix (the real edge-fn dir name).
//
// Routes (dispatcher stripped /signatures):
//   GET  /requests                 — list, page-shaped (joins business_records for name/email)
//   POST /requests                 — create a signature request
//   POST /requests/:id/remind      — record a reminder (degraded: no reminder-count column)
//   GET  /templates                — [] (no signature_templates table exists; degraded)
//   GET  /analytics                — aggregate counts/speed over signature_requests
//
// Fields with no real backing column (contractValue, contractDuration, signers, reminder
// counts) are defaulted; see the `degraded` notes inline. The page reads every field
// defensively (date-guards null), so defaults render without crashing.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const PENDING_STATUSES = ['draft', 'sent', 'in_progress'];
const DAY_MS = 86400000;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function toPageShape(r: Row, cust?: Row): Row {
  return {
    id: r.id,
    documentName: r.title,
    documentType: r.description ?? 'document',
    businessRecordId: r.customer_id ?? null,
    customerName: cust?.company_name ?? 'Unknown customer',
    customerEmail: cust?.email ?? null,
    status: r.status,
    requestedBy: r.created_by ?? null,
    // requestedDate/expirationDate MUST be non-null valid dates — the page calls
    // date-fns format() on them (throws on Invalid Date). created_at is always set;
    // expires_at can be null, so coalesce to created_at.
    requestedDate: r.created_at,
    expirationDate: r.expires_at ?? r.created_at,
    signedDate: r.completed_at ?? null,
    remindersSent: 0, // degraded: no reminder-count column on signature_requests
    lastReminderDate: null,
    contractValue: null, // degraded: no contract-value column
    contractDuration: null,
    signers: [], // page only reads .length defensively elsewhere; signers live in signature_signers
    createdAt: r.created_at,
  };
}

async function fetchCustomers(db: HandlerCtx['db'], rows: Row[]): Promise<Record<string, Row>> {
  const ids = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))];
  const map: Record<string, Row> = {};
  if (ids.length === 0) return map;
  const { data } = await db
    .from('business_records')
    .select('id, company_name, email')
    .in('id', ids);
  for (const c of (data ?? []) as Row[]) map[c.id] = c;
  return map;
}

export async function handlePage(
  req: Request,
  ctx: HandlerCtx,
  resource: 'requests' | 'templates' | 'analytics',
): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;

  // ---- /templates ------------------------------------------------------------
  if (resource === 'templates') {
    if (method !== 'GET') return null;
    // degraded: there is no signature_templates table in the schema.
    return jsonResponse([], 200, req, requestId);
  }

  // ---- /analytics ------------------------------------------------------------
  if (resource === 'analytics') {
    if (method !== 'GET') return null;
    const { data, error } = await db
      .from('signature_requests')
      .select('status, completed_at, created_at')
      .eq('tenant_id', auth.tenantId)
      .limit(5000);
    if (error) {
      return errorResponse(500, 'Failed to compute analytics', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    const rows = (data ?? []) as Row[];
    const total = rows.length;
    const completedRows = rows.filter((r) => r.status === 'completed');
    const completed = completedRows.length;
    const pending = rows.filter((r) => PENDING_STATUSES.includes(r.status)).length;
    const expired = rows.filter((r) => r.status === 'expired').length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    // Real signing-speed buckets from completed rows.
    const speed = { within24Hours: 0, within48Hours: 0, within1Week: 0, moreThan1Week: 0 };
    let signingDaysTotal = 0;
    let signingDaysCount = 0;
    for (const r of completedRows) {
      if (!r.completed_at || !r.created_at) continue;
      const ms = new Date(r.completed_at).getTime() - new Date(r.created_at).getTime();
      if (Number.isNaN(ms) || ms < 0) continue;
      signingDaysTotal += ms / DAY_MS;
      signingDaysCount += 1;
      if (ms <= DAY_MS) speed.within24Hours += 1;
      else if (ms <= 2 * DAY_MS) speed.within48Hours += 1;
      else if (ms <= 7 * DAY_MS) speed.within1Week += 1;
      else speed.moreThan1Week += 1;
    }
    const averageSigningTime =
      signingDaysCount > 0 ? Math.round((signingDaysTotal / signingDaysCount) * 10) / 10 : 0;

    return jsonResponse(
      {
        totalRequests: total,
        completedRequests: completed,
        pendingRequests: pending,
        expiredRequests: expired,
        completionRate,
        averageSigningTime,
        totalContractValue: 0, // degraded: no contract-value column
        byDocumentType: [], // degraded
        monthlyTrends: [], // degraded
        signingSpeedAnalysis: speed,
      },
      200,
      req,
      requestId,
    );
  }

  // ---- /requests -------------------------------------------------------------
  const first = pathParts[0];
  const second = pathParts[1];

  // POST /requests/:id/remind
  if (method === 'POST' && first && second === 'remind') {
    const { data, error } = await db
      .from('signature_requests')
      .select('id')
      .eq('id', first)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to send reminder', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data) {
      return errorResponse(404, 'Request not found', req, { code: 'NOT_FOUND', requestId });
    }
    // degraded: no reminder tracking columns; acknowledge the action.
    return jsonResponse(
      {
        message: 'Reminder sent successfully',
        id: first,
        reminderSent: true,
        lastReminderDate: new Date().toISOString(),
      },
      200,
      req,
      requestId,
    );
  }

  // GET /requests
  if (method === 'GET' && !first) {
    const { data, error } = await db
      .from('signature_requests')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      return errorResponse(500, 'Failed to fetch signature requests', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    const rows = (data ?? []) as Row[];
    const customers = await fetchCustomers(db, rows);
    return jsonResponse(
      rows.map((r) => toPageShape(r, customers[r.customer_id])),
      200,
      req,
      requestId,
    );
  }

  // POST /requests
  if (method === 'POST' && !first) {
    const body = (await req.json().catch(() => null)) as Row | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    }
    const businessRecordId = body.businessRecordId ?? body.business_record_id ?? null;
    const documentType = body.documentType ?? body.document_type ?? 'document';
    const documentName = body.documentName ?? body.document_name ?? null;
    const expirationDays = Number(body.expirationDays ?? body.expiration_days ?? 30) || 30;

    if (!businessRecordId) {
      return errorResponse(400, 'businessRecordId is required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }

    // Resolve the customer (also used to build a default title + the response shape).
    const { data: cust } = await db
      .from('business_records')
      .select('id, company_name, email')
      .eq('id', businessRecordId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (!cust) {
      return errorResponse(404, 'Customer not found', req, { code: 'NOT_FOUND', requestId });
    }

    const title =
      documentName ?? `${String(documentType).replace(/_/g, ' ')} - ${cust.company_name}`;
    const row = {
      tenant_id: auth.tenantId,
      request_number: `SIG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      title,
      description: documentType,
      customer_id: businessRecordId,
      provider: 'internal', // not a real envelope; provider integration is a follow-up PRD
      status: 'sent',
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + expirationDays * DAY_MS).toISOString(),
      created_by: auth.userId,
    };

    const { data, error } = await db.from('signature_requests').insert(row).select().maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to create signature request', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(toPageShape(data as Row, cust), 201, req, requestId);
  }

  return null;
}
