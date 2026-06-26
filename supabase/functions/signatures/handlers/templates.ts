// Signature templates — read-only.
//
// Path (dispatcher stripped /signatures + resolved the `templates` resource):
//   GET  /   → list of reusable signature templates
//
// Replaces the frontend's /api/signature-templates call, which had NO backend
// on either Express or the edge function before EDGE-005e (it 404'd in prod).
//
// There is no signature_templates table in shared/schema.ts or any migration
// yet — only signature_requests / signature_signers / signature_documents
// exist. Until a template-library PRD adds the table, this returns an empty
// list (an honest, error-free response). ESignatureIntegration.tsx renders an
// empty Templates tab gracefully (`templates = []` default). A 200 + [] is a
// strict improvement over the previous production 404.

import { jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export function handleTemplates(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, requestId } = ctx;

  // Only the collection root: GET /
  if (method !== 'GET' || pathParts[0]) return Promise.resolve(null);

  return Promise.resolve(jsonResponse([], 200, req, requestId));
}
