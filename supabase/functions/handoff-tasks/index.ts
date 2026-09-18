// Handoff Tasks Edge Function
// Handles tasks associated with sales handoffs
//
// AUDIT-037: this was written against a shape handoff_tasks does not have.
// `title`, `assignee_id`, `priority` and `created_by` are not columns - the real
// ones are task_name and assigned_to, and neither priority nor a creator is
// recorded at all - so create and update wrote 42703, and the two embedded
// selects (`handoff:handoff_id`, `assignee:assignee_id`) could never resolve
// because handoff_tasks declares no foreign keys for PostgREST to follow.
//
// Only one call site survived that: SalesHandoffs.tsx sends PUT /:id with
// { status } alone, and JSON.stringify drops the undefined siblings before the
// request leaves. Everything else on this function was a 500 waiting for a
// caller.
//
// PRIORITY AND CREATED_BY ARE REPORTED, NOT DROPPED. The table records urgency
// as is_required / is_blocking / due_date; a second, quieter answer to the same
// question is not an improvement, so a caller that sends `priority` is told the
// field was not persisted rather than left to assume it was.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { fetchInBatches } from '../_shared/batch-fetch.ts';

/** Fields a caller may send that handoff_tasks has nowhere to put. */
const UNPERSISTED_FIELDS = ['priority', 'createdBy'] as const;

function unpersisted(body: Record<string, unknown>): string[] {
  return UNPERSISTED_FIELDS.filter((f) => body[f] !== undefined);
}

/**
 * Resolve assignee names in one read.
 *
 * handoff_tasks declares no foreign key, so PostgREST cannot embed the user -
 * and `users` has first_name/last_name, NOT the full_name the embed asked for.
 */
// deno-lint-ignore no-explicit-any
async function withAssignees(admin: any, tenantId: string, rows: any[]) {
  const ids = rows.map((r) => String(r.assigned_to ?? '')).filter(Boolean);
  if (ids.length === 0) return rows;
  const users = await fetchInBatches<Record<string, unknown>>(ids, 'id', () =>
    admin.from('users').select('id, first_name, last_name, email').eq('tenant_id', tenantId),
  );
  const byId = new Map(users.map((u) => [String(u.id), u]));
  return rows.map((row) => {
    const user = byId.get(String(row.assigned_to ?? ''));
    return {
      ...row,
      assignee: user
        ? {
            id: user.id,
            name: [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
            email: user.email ?? null,
          }
        : null,
    };
  });
}

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /handoff-tasks, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'handoff-tasks');
    const taskId = parts[0];
    const action = parts[1];

    // GET /handoff-tasks - List handoff tasks
    if (req.method === 'GET' && !taskId) {
      const handoffId = url.searchParams.get('handoffId');
      const status = url.searchParams.get('status');
      const assigneeId = url.searchParams.get('assigneeId');

      let query = admin
        .from('handoff_tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true });

      if (handoffId) query = query.eq('handoff_id', handoffId);
      if (status) query = query.eq('status', status);
      if (assigneeId) query = query.eq('assigned_to', assigneeId);

      const { data: tasks, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch handoff tasks' }, 500, req);
      }

      return createCorsResponse(await withAssignees(admin, tenantId, tasks || []), 200, req);
    }

    // GET /handoff-tasks/:id - Get single task
    if (req.method === 'GET' && taskId && !action) {
      const { data: task, error } = await admin
        .from('handoff_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Handoff task not found' }, 404, req);
      }

      const [withAssignee] = await withAssignees(admin, tenantId, [task]);
      return createCorsResponse(withAssignee, 200, req);
    }

    // POST /handoff-tasks - Create task
    if (req.method === 'POST' && !taskId) {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('handoff_tasks')
        .insert({
          tenant_id: tenantId,
          handoff_id: body.handoffId || body.handoff_id,
          task_name: body.taskName || body.task_name || body.title,
          description: body.description,
          assigned_to: body.assignedTo || body.assigned_to || body.assigneeId,
          assigned_to_role: body.assignedToRole || body.assigned_to_role,
          due_date: body.dueDate || body.due_date,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create handoff task' }, 500, req);
      }

      const skipped = unpersisted(body);
      return createCorsResponse(
        skipped.length > 0 ? { ...task, unpersisted: skipped } : task,
        201,
        req,
      );
    }

    // PUT /handoff-tasks/:id - Update task
    if (req.method === 'PUT' && taskId && !action) {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('handoff_tasks')
        .update({
          task_name: body.taskName || body.task_name || body.title,
          description: body.description,
          assigned_to: body.assignedTo || body.assigned_to || body.assigneeId,
          assigned_to_role: body.assignedToRole || body.assigned_to_role,
          due_date: body.dueDate || body.due_date,
          status: body.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update handoff task' }, 500, req);
      }

      const skipped = unpersisted(body);
      return createCorsResponse(
        skipped.length > 0 ? { ...task, unpersisted: skipped } : task,
        200,
        req,
      );
    }

    // POST /handoff-tasks/:id/complete - Complete task
    if (req.method === 'POST' && taskId && action === 'complete') {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('handoff_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          completion_notes: body.notes || body.completion_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to complete handoff task' }, 500, req);
      }

      return createCorsResponse(task, 200, req);
    }

    // DELETE /handoff-tasks/:id - Delete task
    if (req.method === 'DELETE' && taskId) {
      const { error } = await admin
        .from('handoff_tasks')
        .delete()
        .eq('id', taskId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete handoff task' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Handoff task deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in handoff-tasks function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
