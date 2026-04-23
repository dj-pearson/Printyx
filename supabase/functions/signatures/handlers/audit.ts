// Signature audit logs — read-only.
//
// Paths (dispatcher routes here with pathParts=['by-request', id] or
// ['by-signer', id]):
//   GET  via /signatures/signature-requests/:requestId/audit-logs
//   GET  via /signatures/signature-signers/:signerId/audit-logs

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleAudit(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const scope = pathParts[0];
  const id = pathParts[1];

  if (method !== 'GET' || !id) return null;

  let q = db.from('signature_audit_logs').select('*').eq('tenant_id', auth.tenantId);
  if (scope === 'by-request') q = q.eq('request_id', id);
  else if (scope === 'by-signer') q = q.eq('signer_id', id);
  else return null;

  q = q.order('created_at', { ascending: false }).limit(500);
  const { data, error } = await q;
  if (error) {
    return errorResponse(500, 'Failed to fetch audit logs', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  return jsonResponse(data ?? [], 200, req, requestId);
}
