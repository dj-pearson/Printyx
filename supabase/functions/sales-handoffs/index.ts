// Sales Handoffs Edge Function
//
// WF-C-06. Every endpoint here queried `sales_handoffs`, a relation named by no
// schema, no migration and no other file in the tree - so all six were a 42P01 in
// production, and the embedded selects named deal_id, implementation_lead_id and
// full_name columns that do not exist either. The real table is
// sales_handoff_checklists (shared/sales-handoff-schema.ts, migration 0000), which
// server/routes-sales-handoff.ts had been serving correctly all along with no
// caller. This function now serves that table and /api/sales-handoffs is proxied,
// so both hosts answer the same shape from one implementation.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  HANDOFF_STATUSES,
  handoffProgress,
  handoffTypeFor,
  normalizeHandoffType,
} from '../_shared/sales-handoff.ts';
import { createHandoff } from '../_shared/handoff-create.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /sales-handoffs, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'sales-handoffs');
    const handoffId = parts[0];
    const action = parts[1];

    // GET /sales-handoffs - List handoffs
    //
    // No embedded select: the previous one joined `deals` on a column this table
    // does not have and read `full_name` off users, which is first_name/last_name.
    // Customer names are batch-resolved instead, the way every other list here
    // does it.
    if (req.method === 'GET' && !handoffId) {
      const status = url.searchParams.get('status');

      let query = admin
        .from('sales_handoff_checklists')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data: handoffs, error } = await query;

      if (error) {
        console.error('Error fetching sales handoffs:', error);
        return createCorsResponse({ error: 'Failed to fetch sales handoffs' }, 500, req);
      }

      const rows = handoffs ?? [];
      const customerIds = [...new Set(rows.map((h: Record<string, unknown>) => h.customer_id))];
      const names = new Map<string, string>();
      if (customerIds.length > 0) {
        const { data: customers } = await admin
          .from('business_records')
          .select('id, company_name')
          .eq('tenant_id', tenantId)
          .in('id', customerIds);
        for (const c of customers ?? []) names.set(String(c.id), String(c.company_name ?? ''));
      }

      // Open-task counts, so the queue can be worked without opening each one.
      const openTasks = new Map<string, number>();
      if (rows.length > 0) {
        const { data: tasks } = await admin
          .from('handoff_tasks')
          .select('handoff_id, status')
          .eq('tenant_id', tenantId)
          .in(
            'handoff_id',
            rows.map((h: Record<string, unknown>) => h.id),
          );
        for (const t of tasks ?? []) {
          if (t.status === 'completed' || t.status === 'skipped') continue;
          const key = String(t.handoff_id);
          openTasks.set(key, (openTasks.get(key) ?? 0) + 1);
        }
      }

      return createCorsResponse(
        rows.map((h: Record<string, unknown>) => ({
          ...h,
          customer_name: names.get(String(h.customer_id)) ?? null,
          open_task_count: openTasks.get(String(h.id)) ?? 0,
        })),
        200,
        req,
      );
    }

    // GET /sales-handoffs/:id - Get single handoff, with its tasks
    if (req.method === 'GET' && handoffId && !action) {
      const { data: handoff, error } = await admin
        .from('sales_handoff_checklists')
        .select('*')
        .eq('id', handoffId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !handoff) {
        return createCorsResponse({ error: 'Sales handoff not found' }, 404, req);
      }

      const [{ data: tasks }, { data: customer }] = await Promise.all([
        admin
          .from('handoff_tasks')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('handoff_id', handoffId)
          .order('due_date', { ascending: true }),
        admin
          .from('business_records')
          .select('id, company_name, primary_contact_name, primary_contact_email, phone')
          .eq('id', handoff.customer_id)
          .eq('tenant_id', tenantId)
          .maybeSingle(),
      ]);

      return createCorsResponse(
        { ...handoff, tasks: tasks ?? [], customer: customer ?? null },
        200,
        req,
      );
    }

    // POST /sales-handoffs - Create handoff, with its tasks
    if (req.method === 'POST' && !handoffId) {
      const body = await req.json();

      const customerId = body.customerId || body.customer_id;
      if (!customerId) {
        return createCorsResponse({ error: 'customerId is required' }, 400, req);
      }
      const handoffType =
        normalizeHandoffType(body.handoffType ?? body.handoff_type) ??
        handoffTypeFor({ dealMotion: body.dealMotion });

      const result = await createHandoff(admin, {
        tenantId,
        customerId,
        contractId: body.contractId ?? body.contract_id ?? null,
        opportunityId: body.opportunityId ?? body.opportunity_id ?? body.dealId ?? null,
        salesRepId: body.salesRepId || body.sales_rep_id || user.id,
        salesRepName: body.salesRepName ?? null,
        handoffType,
        salesNotes: body.notes ?? body.salesNotes ?? null,
        createdBy: user.id,
      });

      if (!result.handoff) {
        return createCorsResponse({ error: 'Failed to create sales handoff' }, 500, req);
      }

      return createCorsResponse({ ...result.handoff, taskCount: result.taskCount }, 201, req);
    }

    // PUT/PATCH /sales-handoffs/:id - Update handoff, including claiming it
    if ((req.method === 'PUT' || req.method === 'PATCH') && handoffId && !action) {
      const body = await req.json();

      // Only the columns this table has. The previous version wrote four that it
      // does not (implementation_lead_id, notes, requirements, timeline).
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const set = (key: string, ...names: string[]) => {
        for (const n of names) {
          if (body[n] !== undefined) {
            patch[key] = body[n];
            return;
          }
        }
      };
      set('status', 'status');
      set('implementation_owner_id', 'implementationOwnerId', 'implementation_owner_id');
      set('csm_id', 'csmId', 'csm_id');
      set('installation_tech_id', 'installationTechId', 'installation_tech_id');
      set('sales_notes', 'salesNotes', 'sales_notes', 'notes');
      set('target_completion_date', 'targetCompletionDate', 'target_completion_date');
      set('ready_for_implementation', 'readyForImplementation', 'ready_for_implementation');

      if (patch.status !== undefined && !HANDOFF_STATUSES.includes(patch.status as never)) {
        return createCorsResponse(
          { error: `status must be one of: ${HANDOFF_STATUSES.join(', ')}` },
          400,
          req,
        );
      }

      const { data: handoff, error } = await admin
        .from('sales_handoff_checklists')
        .update(patch)
        .eq('id', handoffId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update sales handoff' }, 500, req);
      }

      return createCorsResponse(handoff, 200, req);
    }

    // POST /sales-handoffs/:id/complete - Complete handoff
    //
    // A handoff with a required task still open is NOT complete. Marking it so
    // anyway is how an install goes out with no site survey and no billing set
    // up, which is the exact gap this queue exists to close.
    if (req.method === 'POST' && handoffId && action === 'complete') {
      const body = await req.json();

      const { data: tasks } = await admin
        .from('handoff_tasks')
        .select('id, task_name, status, is_required')
        .eq('tenant_id', tenantId)
        .eq('handoff_id', handoffId);

      const outstanding = (tasks ?? []).filter(
        (t: Record<string, unknown>) =>
          t.is_required !== false && t.status !== 'completed' && t.status !== 'skipped',
      );
      if (outstanding.length > 0 && body.force !== true) {
        return createCorsResponse(
          {
            error: 'Required tasks are still open',
            code: 'HANDOFF_TASKS_OUTSTANDING',
            outstanding: outstanding.map((t: Record<string, unknown>) => ({
              id: t.id,
              taskName: t.task_name,
            })),
          },
          409,
          req,
        );
      }

      const progress = handoffProgress(tasks ?? []);
      const { data: handoff, error } = await admin
        .from('sales_handoff_checklists')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_percentage: progress.completionPercentage,
          required_fields_complete: progress.requiredComplete,
          ready_for_implementation: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', handoffId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to complete sales handoff' }, 500, req);
      }

      return createCorsResponse(handoff, 200, req);
    }

    // DELETE /sales-handoffs/:id - Delete handoff
    if (req.method === 'DELETE' && handoffId) {
      await admin
        .from('handoff_tasks')
        .delete()
        .eq('handoff_id', handoffId)
        .eq('tenant_id', tenantId);
      const { error } = await admin
        .from('sales_handoff_checklists')
        .delete()
        .eq('id', handoffId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete sales handoff' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Sales handoff deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in sales-handoffs function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
