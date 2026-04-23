// Provider webhook stubs — PUBLIC endpoints, no JWT.
//
// Paths:
//   POST /signatures/webhooks/docusign
//   POST /signatures/webhooks/adobe-sign
//   POST /signatures/webhooks/hellosign
//
// Port note (per PRD §1 and §4): Express handlers are stubs that log the
// payload and return 200 without processing it. This edge port preserves the
// stub semantics *and* now records the inbound payload as a signature_audit_log
// entry so we have forensic evidence when a real provider integration lands.
//
// Signature verification is intentionally deferred to the follow-up PRD — at
// that point, each branch below will verify using the provider-specific method:
//   - DocuSign:    HMAC-SHA256 on X-DocuSign-Signature-1 header w/ Connect secret
//   - Adobe Sign:  OAuth token in body + webhook secret
//   - HelloSign:   SHA256 HMAC of request body with API key
// See docs for each provider.

import { getDb } from '../../_shared/db.ts';
import { createLogger } from '../../_shared/logger.ts';

const log = createLogger('signatures/webhooks');

const SUPPORTED = new Set(['docusign', 'adobe-sign', 'hellosign']);

export async function handleSignatureWebhook(
  req: Request,
  provider: string,
  requestId: string,
): Promise<Response> {
  if (!SUPPORTED.has(provider)) {
    return jsonBody({ error: `Unknown provider: ${provider}` }, 404, requestId);
  }

  let rawBody = '';
  let parsed: unknown = null;
  try {
    rawBody = await req.text();
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // Some providers send form-encoded — leave parsed=null, keep rawBody.
  }

  log.info(
    {
      requestId,
      provider,
      bodyPreview: rawBody.slice(0, 512),
      bodyLength: rawBody.length,
    },
    'signature_webhook_received_stub',
  );

  // Forensic breadcrumb — even without real processing, the call is traceable.
  // Provider-specific event routing goes here when integration lands.
  try {
    const db = getDb();
    // We don't have a tenant in this flow. Tenant is encoded in custom args or
    // the envelope ID once real wiring exists; for now log against a sentinel
    // so it's easy to find later.
    await db.from('signature_audit_logs').insert({
      tenant_id: 'webhook-pending-wiring',
      event_type: `webhook_received_${provider.replace('-', '_')}`,
      event_description: `Stub webhook received from ${provider}. Not processed until provider integration is wired.`,
      external_event_id: extractExternalEventId(parsed),
      metadata: { provider, body_preview: rawBody.slice(0, 2000), parsed: parsed ?? undefined },
    });
  } catch (err) {
    log.warn({ requestId, err: String(err), provider }, 'audit_insert_failed');
  }

  return jsonBody(
    {
      received: true,
      provider,
      stub: true,
      message:
        'Webhook received and logged. Real provider event processing is deferred to a follow-up PRD.',
    },
    200,
    requestId,
  );
}

function extractExternalEventId(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  // DocuSign Connect: envelopeId or envelopeStatus.envelopeId
  if (typeof obj.envelopeId === 'string') return obj.envelopeId;
  if (
    typeof obj.envelopeStatus === 'object' &&
    obj.envelopeStatus !== null &&
    typeof (obj.envelopeStatus as Record<string, unknown>).envelopeId === 'string'
  ) {
    return (obj.envelopeStatus as Record<string, string>).envelopeId;
  }
  // Adobe Sign: agreement.id
  if (
    typeof obj.agreement === 'object' &&
    obj.agreement !== null &&
    typeof (obj.agreement as Record<string, unknown>).id === 'string'
  ) {
    return (obj.agreement as Record<string, string>).id;
  }
  // HelloSign (Dropbox Sign): signature_request.signature_request_id
  if (
    typeof obj.signature_request === 'object' &&
    obj.signature_request !== null &&
    typeof (obj.signature_request as Record<string, unknown>).signature_request_id === 'string'
  ) {
    return (obj.signature_request as Record<string, string>).signature_request_id;
  }
  return null;
}

function jsonBody(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
  });
}
