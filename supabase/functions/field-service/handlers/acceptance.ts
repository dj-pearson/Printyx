// GET /field-service/acceptance?customerId=... | ?equipmentId=... (WF-L-07)
//
// What was signed, for whom, and against which checklist - in ONE request.
//
// The alternative was the customer detail page fetching a customer's
// installations and then a signature list per installation, which is the
// one-query-per-row shape PERF-NPLUS1-002 spent a story on. service_signatures
// has no customer column (it hangs off an installation or a ticket), so the
// join has to happen somewhere; here is the only place it happens once.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import { fetchInBatches } from '../../_shared/batch-fetch.ts';
import type { HandlerCtx } from '../_context.ts';
import { dbErr } from '../_crud.ts';

export async function handleAcceptance(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, url } = ctx;
  if (method !== 'GET') return null;

  const customerId = url.searchParams.get('customerId');
  const equipmentId = url.searchParams.get('equipmentId');
  if (!customerId && !equipmentId) {
    return errorResponse(400, 'customerId or equipmentId is required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  // Each branch is written out whole rather than built up in a variable:
  // check:phantom-columns resolves a column literal against the table its call
  // chain is on, and a reassigned query loses it (WF-L-06 learned that the hard
  // way, on a false positive indistinguishable from a real one).
  const { data: installations, error } = customerId
    ? await db
        .from('installations')
        .select(
          'id, installation_number, customer_id, equipment_id, serial_number, model_number, status, completed_date, installation_address',
        )
        .eq('tenant_id', auth.tenantId)
        .eq('customer_id', customerId)
        .order('scheduled_date', { ascending: false })
        .limit(100)
    : await db
        .from('installations')
        .select(
          'id, installation_number, customer_id, equipment_id, serial_number, model_number, status, completed_date, installation_address',
        )
        .eq('tenant_id', auth.tenantId)
        .eq('equipment_id', equipmentId)
        .order('scheduled_date', { ascending: false })
        .limit(100);

  if (error) return dbErr(req, requestId, 'Failed to load installations', error);

  const ids = (installations ?? []).map((i: Record<string, unknown>) => String(i.id));
  if (ids.length === 0) return jsonResponse([], 200, req, requestId);

  const [signatures, checklists] = await Promise.all([
    fetchInBatches<Record<string, unknown>>(ids, 'installation_id', () =>
      db
        .from('service_signatures')
        .select(
          'id, installation_id, signature_type, signer_name, signer_title, signer_email, signature_data_url, signed_at, agreement_text, consent_given',
        )
        .eq('tenant_id', auth.tenantId),
    ),
    fetchInBatches<Record<string, unknown>>(ids, 'installation_id', () =>
      db
        .from('installation_checklists')
        .select('id, installation_id, item_name, category, is_required, passed, notes, item_order')
        .eq('tenant_id', auth.tenantId),
    ),
  ]);

  const group = <T extends Record<string, unknown>>(rows: T[]) => {
    const out = new Map<string, T[]>();
    for (const row of rows) {
      const key = String(row.installation_id ?? '');
      const bucket = out.get(key);
      if (bucket) bucket.push(row);
      else out.set(key, [row]);
    }
    return out;
  };

  const signaturesBy = group(signatures);
  const checklistBy = group(checklists);

  return jsonResponse(
    (installations ?? []).map((installation: Record<string, unknown>) => {
      const key = String(installation.id);
      const items = (checklistBy.get(key) ?? []).sort(
        (a, b) => Number(a.item_order ?? 0) - Number(b.item_order ?? 0),
      );
      return {
        installation,
        signatures: signaturesBy.get(key) ?? [],
        checklist: items,
        // Answered, not "completed": an item nobody touched is null, and
        // counting it as a pass would make the summary a claim rather than a
        // count (WF-L-07).
        checklistAnswered: items.filter((i) => i.passed !== null && i.passed !== undefined).length,
        checklistTotal: items.length,
      };
    }),
    200,
    req,
    requestId,
  );
}
