// /billing/adjustments — manual billing adjustments (EDGE-002a).
//
// Ported from server/routes-billing-core.ts (raw SQL against the
// `billing_adjustments` DRIFT table — see _context.ts schema audit). The
// legacy Express GET was self-broken: it referenced camelCase identifiers
// (ba.requestedBy / ba.tenantId / ba.createdAt) that Postgres folds to
// lowercase, mismatching the snake_case columns its own INSERT used. This
// port uses snake_case consistently and resolves the requester/approver
// display names with a second tenant-scoped users query instead of a JOIN.
//
//   GET  /billing/adjustments → row[] + requested_by_name/approved_by_name
//                               ([] when table missing)
//   POST /billing/adjustments → 201 row (503 when table missing)

import { createCorsResponse } from '../../_shared/cors.ts';
import { type BillingCtx, isMissingTableError } from './_context.ts';

const TABLE = 'billing_adjustments';

export async function handleAdjustments(ctx: BillingCtx): Promise<Response | null> {
  const { req, admin, tenantId, user } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) {
        console.error(`${TABLE} table missing — returning empty list (drift table)`);
        return createCorsResponse([], 200, req);
      }
      console.error('Error fetching billing adjustments:', error);
      return createCorsResponse({ error: 'Failed to fetch billing adjustments' }, 500, req);
    }

    const adjustments = data || [];

    // Resolve display names for requested_by / approved_by.
    const userIds = [
      ...new Set(
        adjustments
          .flatMap((a: Record<string, unknown>) => [a.requested_by, a.approved_by])
          .filter(Boolean)
          .map(String),
      ),
    ];

    const nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await admin
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', tenantId)
        .in('id', userIds);
      for (const u of users || []) {
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || u.id;
        nameById.set(String(u.id), name);
      }
    }

    const enriched = adjustments.map((a: Record<string, unknown>) => ({
      ...a,
      requested_by_name: a.requested_by ? (nameById.get(String(a.requested_by)) ?? null) : null,
      approved_by_name: a.approved_by ? (nameById.get(String(a.approved_by)) ?? null) : null,
    }));

    return createCorsResponse(enriched, 200, req);
  }

  if (req.method === 'POST') {
    const body = await req.json();

    if (!body.adjustment_type || !body.adjustment_reason || body.amount == null) {
      return createCorsResponse(
        { error: 'adjustment_type, adjustment_reason, and amount are required' },
        400,
        req,
      );
    }

    const row = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      adjustment_type: body.adjustment_type,
      adjustment_reason: body.adjustment_reason,
      amount: body.amount,
      description: body.description ?? null,
      invoice_id: body.invoice_id ?? null,
      business_record_id: body.business_record_id ?? null,
      requested_by: user.id,
    };

    const { data, error } = await admin.from(TABLE).insert(row).select().single();
    if (error) {
      if (isMissingTableError(error)) {
        return createCorsResponse(
          {
            error: 'Billing adjustments storage is not provisioned',
            degraded: { reason: `${TABLE} table missing in this environment` },
          },
          503,
          req,
        );
      }
      console.error('Error creating billing adjustment:', error);
      return createCorsResponse({ error: 'Failed to create billing adjustment' }, 500, req);
    }
    return createCorsResponse(data, 201, req);
  }

  return null;
}
