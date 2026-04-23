/**
 * Signatures edge function.
 *
 * Replaces server/routes/signature-routes.ts (31 endpoints).
 *
 * Scope note (per PRD §1): this port **preserves Express's stub behavior** for
 * actual provider integration (DocuSign / Adobe Sign / HelloSign). The CRUD
 * layer for signature_requests / signers / documents / audit logs is real; the
 * send-to-provider and webhook-ingest paths are intentionally stubbed until a
 * follow-up PRD wires a real provider.
 *
 * URL prefixes:
 *   /signatures/integration-credentials/*        → handlers/credentials.ts
 *   /signatures/signature-requests/*             → handlers/requests.ts
 *   /signatures/signature-signers/*              → handlers/signers.ts
 *   /signatures/signature-documents/*            → handlers/documents.ts
 *   /signatures/customers/:customerId/signature-requests
 *   /signatures/webhooks/{docusign,adobe-sign,hellosign}  → handlers/webhooks.ts  (PUBLIC)
 *
 * One-time SQL:
 *   \i drizzle/rls/signatures-tables.sql
 *   \i drizzle/rls/signatures.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleCredentials } from './handlers/credentials.ts';
import { handleRequests } from './handlers/requests.ts';
import { handleSigners } from './handlers/signers.ts';
import { handleDocuments } from './handlers/documents.ts';
import { handleAudit } from './handlers/audit.ts';
import { handleSignatureWebhook } from './handlers/webhooks.ts';

const log = createLogger('signatures');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/signatures/, '')
      .replace(/\/$/, '') || '/'
  );
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();
  const sub = stripPrefix(url.pathname);

  try {
    const parts = sub.split('/').filter(Boolean);
    const first = parts[0];

    // PUBLIC webhook endpoints — MUST run before requireAuth.
    if (first === 'webhooks' && parts[1]) {
      if (method !== 'POST') {
        return errorResponse(405, 'Method not allowed', req, {
          code: 'METHOD_NOT_ALLOWED',
          requestId,
        });
      }
      return await handleSignatureWebhook(req, parts[1], requestId);
    }

    const auth = await requireAuth(req);
    const db = getDb();
    const ctx = { auth, db, requestId, pathParts: parts.slice(1), method, url };

    let result: Response | null = null;
    switch (first) {
      case 'integration-credentials':
        result = await handleCredentials(req, ctx);
        break;
      case 'signature-requests':
        // Audit logs for a request: /signature-requests/:id/audit-logs → audit handler
        if (parts[2] === 'audit-logs') {
          result = await handleAudit(req, {
            ...ctx,
            pathParts: ['by-request', parts[1]],
          });
        } else {
          result = await handleRequests(req, ctx);
        }
        break;
      case 'signature-signers':
        // Audit logs for a signer: /signature-signers/:id/audit-logs → audit handler
        if (parts[2] === 'audit-logs') {
          result = await handleAudit(req, {
            ...ctx,
            pathParts: ['by-signer', parts[1]],
          });
        } else {
          result = await handleSigners(req, ctx);
        }
        break;
      case 'signature-documents':
        result = await handleDocuments(req, ctx);
        break;
      case 'customers': {
        // /customers/:customerId/signature-requests forward
        const customerId = parts[1];
        if (parts[2] === 'signature-requests' && customerId) {
          result = await handleRequests(req, {
            ...ctx,
            pathParts: ['by-customer', customerId],
          });
        } else {
          result = null;
        }
        break;
      }
      default:
        result = null;
    }

    if (!result) {
      return errorResponse(404, 'Not found', req, {
        code: 'NOT_FOUND',
        details: { path: url.pathname, method },
        requestId,
      });
    }
    return result;
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
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}
