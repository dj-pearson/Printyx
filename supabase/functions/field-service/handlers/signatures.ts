// Service signatures - on-site sign-off (separate from the e-signature domain).
//
// WF-L-07: EVERY WRITE HERE NAMED COLUMNS service_signatures DOES NOT HAVE.
// The map sent ticket_id, customer_id, technician_id, signer_role,
// signature_image_url, signature_data and document_type. The real columns are
// service_ticket_id, signer_title, signature_data_url and signature_type; there
// is no customer or technician column at all - the person who captured it is
// captured_by, and the customer is reached through the installation or the
// ticket. So a POST was a 42703 and the two query filters a 42703 on GET.
//
// check:phantom-cols could not see any of it: this handler passes its table and
// column names to _crud.ts as an OPTIONS OBJECT, and that guard resolves a
// literal against the table its CALL CHAIN is on. A generic CRUD helper has no
// chain to read. Worth knowing before trusting a clean run over this directory.
//
// Five columns are NOT NULL - signature_type, signer_name, signature_data_url,
// signature_method, signed_at - plus captured_by, which the handler supplies.
// They are checked here so the caller gets a 400 naming the field rather than a
// 23502 it has to decode.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { crud, dbErr } from '../_crud.ts';
import { acceptanceRequirements } from '../../_shared/acceptance.ts';

/** What the signature is FOR. delivery and installation are WF-L-06's two events. */
export const SIGNATURE_TYPES = [
  'delivery',
  'installation',
  'service',
  'training',
  'acceptance',
] as const;

export async function handleSignatures(req: Request, ctx: HandlerCtx) {
  // POST is handled here rather than through crud() because acceptance is not a
  // plain insert: it has required fields worth naming, a GPS and user-agent
  // record that belongs to the act of signing, and a response that tells the
  // caller which lifecycle requirements the signature satisfies.
  if (ctx.method === 'POST' && !ctx.pathParts[0]) {
    return createSignature(req, ctx);
  }

  return crud(req, ctx, {
    table: 'service_signatures',
    defaultOrder: { column: 'signed_at', ascending: false },
    queryFilters: [
      { param: 'ticketId', column: 'service_ticket_id' },
      { param: 'installationId', column: 'installation_id' },
      { param: 'signatureType', column: 'signature_type' },
    ],
    stamps: { tenantId: true },
    updateStamps: { updatedAt: true },
    mapRow,
  });
}

function mapRow(b: Record<string, unknown>): Record<string, unknown> {
  const src = (camel: string, snake: string) => b[camel] ?? b[snake];
  const r: Record<string, unknown> = {};
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('service_ticket_id', 'serviceTicketId', 'service_ticket_id');
  set('installation_id', 'installationId', 'installation_id');
  set('signature_type', 'signatureType', 'signature_type');
  set('signer_name', 'signerName', 'signer_name');
  set('signer_title', 'signerTitle', 'signer_title');
  set('signer_email', 'signerEmail', 'signer_email');
  set('signer_phone', 'signerPhone', 'signer_phone');
  set('signature_data_url', 'signatureDataUrl', 'signature_data_url');
  set('signature_method', 'signatureMethod', 'signature_method');
  set('gps_latitude', 'gpsLatitude', 'gps_latitude');
  set('gps_longitude', 'gpsLongitude', 'gps_longitude');
  set('location_address', 'locationAddress', 'location_address');
  set('agreement_text', 'agreementText', 'agreement_text');
  set('consent_given', 'consentGiven', 'consent_given');
  set('signed_at', 'signedAt', 'signed_at');
  return r;
}

async function createSignature(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });

  const row = mapRow(body);
  row.tenant_id = auth.tenantId;
  row.captured_by = auth.userId;
  row.signed_at ??= new Date().toISOString();
  row.signature_method ??= 'drawn';
  // The browser sends these; they are part of what a signature IS as evidence,
  // not decoration. user_agent is read from the request rather than the body so
  // a caller cannot claim a different one.
  row.user_agent = req.headers.get('user-agent') ?? null;

  const missing = ['signature_type', 'signer_name', 'signature_data_url'].filter((c) => !row[c]);
  if (missing.length > 0) {
    return errorResponse(400, `Missing required field(s): ${missing.join(', ')}`, req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  if (!SIGNATURE_TYPES.includes(String(row.signature_type) as never)) {
    return errorResponse(400, `signature_type must be one of ${SIGNATURE_TYPES.join(', ')}`, req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  // A signature has to be OF something. Without a ticket or an installation it
  // is a picture with a name on it, and nothing can ever find it again.
  if (!row.service_ticket_id && !row.installation_id) {
    return errorResponse(400, 'service_ticket_id or installation_id is required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  const { data, error } = await db.from('service_signatures').insert(row).select().maybeSingle();
  if (error) return dbErr(req, requestId, 'Failed to record the signature', error);

  // The evidence side of WF-L-13, matching WF-L-05 and WF-L-06: the transition
  // endpoint does not check its requirements yet, so what this owes is a
  // durable record that says which ones it meets.
  return jsonResponse(
    { ...data, satisfiesRequirements: acceptanceRequirements(data) },
    201,
    req,
    requestId,
  );
}
