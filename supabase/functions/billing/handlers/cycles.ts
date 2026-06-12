// /billing/cycles — billing cycle list + runner (EDGE-002a).
//
// Ported from server/routes-billing-core.ts (raw SQL against the
// `billing_cycles` DRIFT table — see _context.ts schema audit). The legacy
// Express runner inserted hard-coded DEMO invoices; this port instead runs the
// real pending-meter-reading pipeline (handlers/generate-invoices.ts) and
// records the cycle outcome, preserving the legacy response shape.
//
//   GET  /billing/cycles      → row[]  ([] when table missing)
//   POST /billing/cycles/run  → 201 { message, cycle_id, invoices_generated, total_amount }
//                               (503 when the billing_cycles table is missing)

import { createCorsResponse } from '../../_shared/cors.ts';
import { type BillingCtx, isMissingColumnError, isMissingTableError } from './_context.ts';
import { generateInvoicesFromPendingReadings } from './generate-invoices.ts';

const TABLE = 'billing_cycles';

export async function handleCycles(ctx: BillingCtx): Promise<Response | null> {
  const { req, admin, tenantId, user, parts } = ctx;
  const action = parts[1]; // /cycles/run → 'run'

  if (req.method === 'GET' && !action) {
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
      console.error('Error fetching billing cycles:', error);
      return createCorsResponse({ error: 'Failed to fetch billing cycles' }, 500, req);
    }
    return createCorsResponse(data || [], 200, req);
  }

  if (req.method === 'POST' && action === 'run') {
    const now = new Date();
    const cycleRow = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      cycle_name: `Billing Cycle ${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
      cycle_date: now.toISOString().split('T')[0],
      status: 'processing',
      started_at: now.toISOString(),
    };

    const { data: cycle, error: cycleError } = await admin
      .from(TABLE)
      .insert(cycleRow)
      .select()
      .single();

    if (cycleError) {
      if (isMissingTableError(cycleError)) {
        return createCorsResponse(
          {
            error: 'Billing cycles storage is not provisioned',
            degraded: { reason: `${TABLE} table missing in this environment` },
          },
          503,
          req,
        );
      }
      console.error('Error creating billing cycle:', cycleError);
      return createCorsResponse({ error: 'Failed to run billing cycle' }, 500, req);
    }

    let result;
    try {
      result = await generateInvoicesFromPendingReadings(admin, tenantId, user.id);
    } catch (genError) {
      console.error('Billing cycle generation failed:', genError);
      await admin
        .from(TABLE)
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', cycle.id)
        .eq('tenant_id', tenantId);
      return createCorsResponse({ error: 'Failed to run billing cycle' }, 500, req);
    }

    // Record the outcome. The stat columns are part of the drift table and may
    // not all exist — retry with the minimal status update on PGRST204.
    const fullUpdate = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_invoices_generated: result.invoices.length,
      total_amount: result.totalAmount,
    };
    const { error: updateError } = await admin
      .from(TABLE)
      .update(fullUpdate)
      .eq('id', cycle.id)
      .eq('tenant_id', tenantId);
    if (updateError && isMissingColumnError(updateError)) {
      await admin
        .from(TABLE)
        .update({ status: 'completed', completed_at: fullUpdate.completed_at })
        .eq('id', cycle.id)
        .eq('tenant_id', tenantId);
    }

    return createCorsResponse(
      {
        message: 'Billing cycle completed successfully',
        cycle_id: cycle.id,
        invoices_generated: result.invoices.length,
        total_amount: result.totalAmount,
        ...(result.failedReadingIds.length > 0 && { failedReadingIds: result.failedReadingIds }),
      },
      201,
      req,
    );
  }

  return null;
}
