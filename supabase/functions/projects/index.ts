// Projects edge function.
//
// Paths (the function-name segment is stripped before this handler runs, so the
// id is at parts[0]):
//   GET    /                 ?status &customerId &handoffId &contractId
//   GET    /:id              -> project + tasks + the equipment serials it covers
//   POST   /
//   PUT|PATCH /:id
//   DELETE /:id
//
// AUDIT-037 / AUDIT-039. projects has estimated_hours, actual_hours and budget,
// and NOT project_manager, estimated_budget, actual_budget or tags. Migration
// 0000 created task-schema.ts's shape; migration 0002 CONVERTED the table to
// schema.ts's, adding the first three and dropping the other four along with
// color, template, workflow, custom_fields and contract_id. So all four names
// this handler used were 42703s and shared/drizzle-schema.ts resolves the
// collision correctly.
//
// I briefly concluded the opposite from migration 0000 alone and filed
// AUDIT-039 on it. check:declared-cols disagreed, because it replays the whole
// journal, and it was right. Read the chain, not the first file that mentions
// the table.
//
// budget is numeric(10,2) in DOLLARS, so the old "store in cents" multiply is
// gone with the column name it belonged to.
//
// WF-P-07: this is the surviving project model. contract_id came BACK in
// migration 0080, alongside handoff_id, project_type and milestones, because
// implementation_projects - the other model, which had all four - had no caller
// anywhere and was dropped. docs/WF-P-07-project-model-decision.md.
//
// The id used to be read as `pathParts[pathParts.length - 1]`, which is the LAST
// segment: /projects/:id/equipment would have come out as the id 'equipment'.
// normalizePath + parts[0] is the idiom, and it is what makes a sub-resource
// possible at all.
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  defaultMilestonesFor,
  mapProject,
  projectRow,
  projectTypeForHandoff,
  serialsForProject,
  taskCounts,
} from './_project-scope.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const { parts } = normalizePath(url.pathname, 'projects');
  const projectId = parts[0] ?? null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse({ error: 'Missing or invalid Authorization header' }, 401, req);
    }

    const jwt = authHeader.replace('Bearer ', '');

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: 'Unauthorized', details: userError?.message }, 401, req);
    }

    const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
    let tenantId = (meta.tenantId as string) || (meta.tenant_id as string);

    const admin = createSupabaseServiceClient();

    if (!tenantId) {
      const { data: userData, error: userQueryError } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userQueryError || !userData?.tenant_id) {
        console.error('No tenant ID in app_metadata or database for user:', user.id);
        return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
      }

      tenantId = userData.tenant_id;
    }

    switch (req.method) {
      case 'GET': {
        if (projectId) {
          const { data: project, error } = await admin
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (error || !project) {
            return createCorsResponse({ error: 'Project not found' }, 404, req);
          }

          // The project's own work. WF-P-08 gave tasks a project_id filter; this
          // is the same set the assignee sees on their own list.
          const { data: tasks } = await admin
            .from('tasks')
            .select('id, title, status, priority, assigned_to, due_date, completion_percentage')
            .eq('project_id', projectId)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

          const taskRows = tasks ?? [];
          const { serials, unbacked } = await projectEquipment(
            admin,
            tenantId,
            project.contract_id,
          );

          return createCorsResponse(
            {
              ...mapProject(project, taskCounts(taskRows)),
              tasks: taskRows,
              equipment: serials,
              unbacked,
            },
            200,
            req,
          );
        }

        let query = admin.from('projects').select('*').eq('tenant_id', tenantId);
        const filters: Array<[column: string, camel: string]> = [
          ['status', 'status'],
          ['customer_id', 'customerId'],
          ['handoff_id', 'handoffId'],
          ['contract_id', 'contractId'],
          ['project_type', 'projectType'],
        ];
        for (const [column, camel] of filters) {
          const value = url.searchParams.get(camel) ?? url.searchParams.get(column);
          if (value) query = query.eq(column, value);
        }

        const { data: projects, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching projects:', error);
          return createCorsResponse({ error: 'Failed to fetch projects' }, 500, req);
        }

        const projectIds = (projects ?? []).map((p: { id: string }) => p.id);
        const { data: allTasks } = await admin
          .from('tasks')
          .select('project_id, status')
          .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
          .eq('tenant_id', tenantId);

        const transformed = (projects ?? []).map((project: Record<string, unknown>) => {
          const own = (allTasks ?? []).filter(
            (t: { project_id?: string | null }) => t.project_id === project.id,
          );
          return mapProject(project as never, taskCounts(own));
        });

        return createCorsResponse(transformed, 200, req);
      }

      case 'POST': {
        const body = await req.json();

        if (!body?.name) {
          return createCorsResponse({ error: 'Project name is required' }, 400, req);
        }

        const row = projectRow(body);
        row.tenant_id = tenantId;
        row.created_by = user.id;

        // Created from a handoff: take the type from the handoff and start it
        // with the checklist for that type, rather than an empty project the
        // coordinator has to invent phases for.
        if (!row.project_type && row.handoff_id) {
          const { data: handoff } = await admin
            .from('sales_handoff_checklists')
            .select('handoff_type, customer_id, contract_id')
            .eq('id', row.handoff_id)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          row.project_type = projectTypeForHandoff(handoff?.handoff_type);
          if (!row.customer_id && handoff?.customer_id) row.customer_id = handoff.customer_id;
          if (!row.contract_id && handoff?.contract_id) row.contract_id = handoff.contract_id;
        }
        if (!row.milestones && row.project_type) {
          row.milestones = defaultMilestonesFor(String(row.project_type));
        }

        const { data: newProject, error } = await admin
          .from('projects')
          .insert(row)
          .select()
          .single();

        if (error) {
          console.error('Error creating project:', error);
          return createCorsResponse({ error: 'Failed to create project' }, 500, req);
        }

        return createCorsResponse(
          mapProject(newProject, { taskCount: 0, completedTaskCount: 0 }),
          201,
          req,
        );
      }

      case 'PUT':
      case 'PATCH': {
        if (!projectId) {
          return createCorsResponse({ error: 'Project ID required' }, 400, req);
        }

        const body = await req.json();
        const updateData = projectRow(body, { partial: true });
        updateData.updated_at = new Date().toISOString();

        const { data: updatedProject, error } = await admin
          .from('projects')
          .update(updateData)
          .eq('id', projectId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error updating project:', error);
          return createCorsResponse({ error: 'Failed to update project' }, 500, req);
        }
        if (!updatedProject) return createCorsResponse({ error: 'Project not found' }, 404, req);

        return createCorsResponse(
          mapProject(updatedProject, { taskCount: 0, completedTaskCount: 0 }),
          200,
          req,
        );
      }

      case 'DELETE': {
        if (!projectId) {
          return createCorsResponse({ error: 'Project ID required' }, 400, req);
        }

        const { error } = await admin
          .from('projects')
          .delete()
          .eq('id', projectId)
          .eq('tenant_id', tenantId);

        if (error) {
          console.error('Error deleting project:', error);
          return createCorsResponse({ error: 'Failed to delete project' }, 500, req);
        }

        return createCorsResponse({ success: true }, 200, req);
      }

      default:
        return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }
  } catch (error) {
    console.error('Projects function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

/** projects.contract_id -> purchase_orders -> equipment. See _project-scope.ts. */
async function projectEquipment(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  contractId: string | null | undefined,
) {
  if (!contractId)
    return serialsForProject({ contract_id: null }, { purchaseOrders: [], equipment: [] });

  const { data: orders } = await admin
    .from('purchase_orders')
    .select('id, po_number, source_contract_id')
    .eq('tenant_id', tenantId)
    .eq('source_contract_id', contractId);

  const orderIds = (orders ?? []).map((po: { id: string }) => po.id);
  const { data: equipment } = orderIds.length
    ? await admin
        .from('equipment')
        .select(
          'id, serial_number, model_number, manufacturer, equipment_status, customer_id, install_date, purchase_order_id',
        )
        .eq('tenant_id', tenantId)
        .in('purchase_order_id', orderIds)
    : { data: [] };

  return serialsForProject(
    { contract_id: contractId },
    { purchaseOrders: orders ?? [], equipment: equipment ?? [] },
  );
}
