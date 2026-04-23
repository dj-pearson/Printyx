// Service signatures — on-site tech sign-off (separate from e-signature domain).
// Simple CRUD — service_signatures table.

import type { HandlerCtx } from '../_context.ts';
import { crud } from '../_crud.ts';

export async function handleSignatures(req: Request, ctx: HandlerCtx) {
  return crud(req, ctx, {
    table: 'service_signatures',
    defaultOrder: { column: 'created_at', ascending: false },
    queryFilters: [
      { param: 'ticketId', column: 'ticket_id' },
      { param: 'customerId', column: 'customer_id' },
    ],
    stamps: { tenantId: true },
    updateStamps: { updatedAt: true },
    mapRow: (b) => {
      const src = (c: string, s: string) => b[c] ?? b[s];
      const set = (col: string, camel: string, snake: string, r: Record<string, unknown>) => {
        const v = src(camel, snake);
        if (v !== undefined) r[col] = v;
      };
      const r: Record<string, unknown> = {};
      set('ticket_id', 'ticketId', 'ticket_id', r);
      set('customer_id', 'customerId', 'customer_id', r);
      set('technician_id', 'technicianId', 'technician_id', r);
      set('installation_id', 'installationId', 'installation_id', r);
      set('signer_name', 'signerName', 'signer_name', r);
      set('signer_email', 'signerEmail', 'signer_email', r);
      set('signer_role', 'signerRole', 'signer_role', r);
      set('signature_image_url', 'signatureImageUrl', 'signature_image_url', r);
      set('signature_data', 'signatureData', 'signature_data', r);
      set('signed_at', 'signedAt', 'signed_at', r);
      set('document_type', 'documentType', 'document_type', r);
      if (b.notes !== undefined) r.notes = b.notes;
      return r;
    },
  });
}
