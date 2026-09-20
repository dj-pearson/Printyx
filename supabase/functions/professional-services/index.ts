/**
 * Professional Services Edge Function.
 *
 * TWO DOMAINS SHARED THIS PREFIX AND THE WRONG ONE ANSWERED (AUDIT-031's
 * shape). Every caller of /api/professional-services wants the PRODUCT
 * CATALOGUE - ProfessionalServices.tsx lists and creates catalogue rows, and
 * the quote builder's ProductTypeSelector fills its "Installation, training,
 * consulting" picker from it - and Express serves exactly that, off the real
 * `professional_services` table. This function served PROJECTS instead, off
 * `professional_services_projects` and `project_tasks`, neither of which exists
 * in any Drizzle schema or migration.
 *
 * `/api/professional-services` is not proxied, so dev ran Express and worked
 * while production ran this and did not - and the list branch SWALLOWED the
 * missing-table error and answered `[]` at 200, so the failure looked like a
 * dealer who had not configured any professional services. A rep could not add
 * installation or training to a quote and nothing said why.
 *
 * The sharpest statement of it: POST /import already wrote the REAL catalogue
 * table (the shared spec in shared/catalog-import.ts names
 * `professional_services`), so one function imported a CSV successfully and
 * then listed nothing.
 *
 * The catalogue now owns `/`, `/:id` and `/import`. The project half is kept
 * under `/projects` - it is real code over tables somebody may yet create - and
 * answers 503 rather than swallowing, because a request that will work once the
 * relation exists is not an outage and is certainly not an empty list.
 */
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { importCatalogCsv, readUploadedCsv } from '../_shared/catalog-import-runner.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { normalizePath } from '../_shared/path.ts';
import { denyWithoutPermission } from '../_shared/rbac.ts';
import { isMissingTableError } from '../_shared/postgrest-errors.ts';

/**
 * The fourth of the catalogue family, gated like product-models,
 * software-products and managed-services (SEC-EDGE-001). Reads stay open
 * because the quote builder needs the picker on a surface with no minLevel.
 */
const WRITE_PERMISSION = 'operations.inventory.manage';

/** Segments that name something other than a catalogue product id. */
const RESERVED_SEGMENTS = new Set(['import', 'projects']);

/**
 * Only the catalogue columns a caller may set. Mirrors `professional_services`
 * in shared/schema.ts; `tenant_id`, `id` and the timestamps are the server's.
 */
function cataloguePatch(body: Record<string, any>): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const set = (column: string, ...candidates: unknown[]) => {
    const value = candidates.find((v) => v !== undefined);
    if (value !== undefined) patch[column] = value;
  };
  set('product_code', body.productCode, body.product_code);
  set('product_name', body.productName, body.product_name);
  set('category', body.category);
  set('accessory_type', body.accessoryType, body.accessory_type);
  set('description', body.description);
  set('summary', body.summary);
  set('note', body.note);
  set('ea_notes', body.eaNotes, body.ea_notes);
  set('related_products', body.relatedProducts, body.related_products);
  set('is_active', body.isActive, body.is_active);
  set('available_for_all', body.availableForAll, body.available_for_all);
  set('repost_edit', body.repostEdit, body.repost_edit);
  set('sales_rep_credit', body.salesRepCredit, body.sales_rep_credit);
  set('funding', body.funding);
  set('lease', body.lease);
  set('payment_type', body.paymentType, body.payment_type);
  set('msrp', body.msrp);
  set('new_active', body.newActive, body.new_active);
  set('new_rep_price', body.newRepPrice, body.new_rep_price);
  set('upgrade_active', body.upgradeActive, body.upgrade_active);
  set('upgrade_rep_price', body.upgradeRepPrice, body.upgrade_rep_price);
  set('lexmark_active', body.lexmarkActive, body.lexmark_active);
  set('lexmark_rep_price', body.lexmarkRepPrice, body.lexmark_rep_price);
  set('graphic_active', body.graphicActive, body.graphic_active);
  set('graphic_rep_price', body.graphicRepPrice, body.graphic_rep_price);
  set('manufacturer', body.manufacturer);
  set('manufacturer_product_code', body.manufacturerProductCode, body.manufacturer_product_code);
  set('model', body.model);
  set('units', body.units);
  set('environment', body.environment);
  set('color_mode', body.colorMode, body.color_mode);
  set('ea_item_number', body.eaItemNumber, body.ea_item_number);
  set('price_book_id', body.priceBookId, body.price_book_id);
  set('temp_key', body.tempKey, body.temp_key);
  return patch;
}

/** Only the project columns a caller may set, never a spread of the body. */
function projectPatch(body: Record<string, any>): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const set = (column: string, ...candidates: unknown[]) => {
    const value = candidates.find((v) => v !== undefined);
    if (value !== undefined) patch[column] = value;
  };
  set('customer_id', body.customerId, body.customer_id);
  set('project_name', body.projectName, body.project_name);
  set('project_type', body.projectType, body.project_type);
  set('description', body.description);
  set('status', body.status);
  set('start_date', body.startDate, body.start_date);
  set('target_end_date', body.targetEndDate, body.target_end_date);
  set('budget_hours', body.budgetHours, body.budget_hours);
  set('budget_amount', body.budgetAmount, body.budget_amount);
  set('hourly_rate', body.hourlyRate, body.hourly_rate);
  set('project_manager_id', body.projectManagerId, body.project_manager_id);
  return patch;
}

function projectsUnavailable(req: Request, feature: string) {
  return createCorsResponse(
    {
      error: `${feature} is not available`,
      code: 'RELATION_MISSING',
      message:
        'professional_services_projects and project_tasks exist in no schema or migration. The professional-services CATALOGUE on this prefix works; the project tracker was never built.',
    },
    503,
    req,
  );
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
    // /professional-services, making this correct either way.
    const { parts: pathParts } = normalizePath(url.pathname, 'professional-services');
    const segment = pathParts[0];

    // After the path parse so no write branch precedes it, before any branch
    // reads a body.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const denied = await denyWithoutPermission(admin, user, WRITE_PERMISSION);
      if (denied) return createCorsResponse(denied, 403, req);
    }

    // ====================================================================
    // POST /professional-services/import - bulk CSV import
    //
    // PROD-014: this existed only on Express, so catalog import 404'd in
    // production. The spec, the CSV parser and the row validation are shared
    // with the client and Express, so the same file imports identically on
    // either backend. It must precede the generic POST create branch, or the
    // upload is treated as a single product. Reads the path segment directly
    // rather than the id variable below, which is declared after this point —
    // naming it here is a temporal-dead-zone ReferenceError at runtime that no
    // bundler flags.
    // ====================================================================
    if (req.method === 'POST' && pathParts[0] === 'import') {
      const csvText = await readUploadedCsv(req);
      if (!csvText) {
        return createCorsResponse({ message: 'No file uploaded' }, 400, req);
      }
      const outcome = await importCatalogCsv(admin, 'professional-services', tenantId, csvText);
      return createCorsResponse(outcome, 200, req);
    }
    /**
     * The PROJECT half, moved under /projects. It had no caller on either host
     * under any path - the page and the quote builder only ever wanted the
     * catalogue - so nothing loses a route, and the catalogue gets the bare
     * prefix its callers have been asking for all along.
     */
    const isProjects = segment === 'projects';
    const projectId = isProjects ? pathParts[1] : undefined;
    const subResource = isProjects ? pathParts[2] : undefined;

    // GET /professional-services - List projects
    const serviceId = segment && !RESERVED_SEGMENTS.has(segment) ? segment : null;

    // ====================================================================
    // THE CATALOGUE. Everything that calls this prefix wants these four
    // branches, and until now production answered them from a table that does
    // not exist. Columns come from `professional_services` (shared/schema.ts),
    // which is what Express, the CSV import spec and the page all use.
    // ====================================================================
    if (req.method === 'GET' && !segment) {
      const { data, error } = await admin
        .from('professional_services')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('product_name', { ascending: true });

      if (error) {
        console.error('Error fetching professional services:', error);
        return createCorsResponse({ error: 'Failed to fetch professional services' }, 500, req);
      }
      return createCorsResponse(data ?? [], 200, req);
    }

    if (req.method === 'GET' && serviceId) {
      const { data, error } = await admin
        .from('professional_services')
        .select('*')
        .eq('id', serviceId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching professional service:', error);
        return createCorsResponse({ error: 'Failed to fetch professional service' }, 500, req);
      }
      if (!data) return createCorsResponse({ error: 'Professional service not found' }, 404, req);
      return createCorsResponse(data, 200, req);
    }

    if (req.method === 'POST' && !segment) {
      const body = await req.json().catch(() => ({}));

      // product_code and product_name are NOT NULL. The form collects both, so
      // a missing one is a 400 rather than a 23502 the page cannot read.
      const productCode = body.productCode ?? body.product_code;
      const productName = body.productName ?? body.product_name;
      if (!productCode || !productName) {
        return createCorsResponse({ error: 'productCode and productName are required' }, 400, req);
      }

      const { data, error } = await admin
        .from('professional_services')
        .insert({
          tenant_id: tenantId,
          ...cataloguePatch(body),
          product_code: productCode,
          product_name: productName,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error creating professional service:', error);
        return createCorsResponse(
          { error: 'Failed to create professional service', message: error.message },
          500,
          req,
        );
      }
      return createCorsResponse(data, 201, req);
    }

    if ((req.method === 'PATCH' || req.method === 'PUT') && serviceId) {
      const body = await req.json().catch(() => ({}));
      const patch = cataloguePatch(body);
      if (Object.keys(patch).length === 1) {
        // Only updated_at. A 200 that bumped the timestamp and reported success
        // would be COP-M01's silent no-op.
        return createCorsResponse(
          { error: 'No updatable fields in the request body', code: 'EMPTY_PATCH' },
          400,
          req,
        );
      }

      const { data, error } = await admin
        .from('professional_services')
        .update(patch)
        .eq('id', serviceId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating professional service:', error);
        return createCorsResponse(
          { error: 'Failed to update professional service', message: error.message },
          500,
          req,
        );
      }
      if (!data) return createCorsResponse({ error: 'Professional service not found' }, 404, req);
      return createCorsResponse(data, 200, req);
    }

    if (req.method === 'DELETE' && serviceId) {
      // The tenant filter is the authorization, not the id (SEC-TENANT-005),
      // and `select` so a miss is a 404 rather than a silent success.
      const { data: removed, error } = await admin
        .from('professional_services')
        .delete()
        .eq('id', serviceId)
        .eq('tenant_id', tenantId)
        .select('id');

      if (error) {
        console.error('Error deleting professional service:', error);
        return createCorsResponse(
          { error: 'Failed to delete professional service', message: error.message },
          500,
          req,
        );
      }
      if (!removed || removed.length === 0) {
        return createCorsResponse({ error: 'Professional service not found' }, 404, req);
      }
      return createCorsResponse({ success: true, id: serviceId }, 200, req);
    }

    if (req.method === 'GET' && isProjects && !projectId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      // QUOTE-011: opt-in pagination. professional_services_projects is an ad-hoc
      // table with no fixed schema, so search + pagination are applied in-memory
      // (volume is low) rather than via a risky PostgREST .or() on unknown columns.
      const pageParam = url.searchParams.get('page');
      const paginate = pageParam !== null;

      // Check if table exists by attempting query
      const { data: projects, error } = await admin
        .from('professional_services_projects')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        // An empty array is a measurement - "this dealer runs no projects" -
        // and the table does not exist, so it was never true. 503 says the
        // request is well formed and will work once the relation is created.
        if (isMissingTableError(error)) return projectsUnavailable(req, 'The project tracker');
        console.error('Error fetching professional services projects:', error);
        return createCorsResponse({ error: 'Failed to fetch projects' }, 500, req);
      }

      let result = projects || [];
      if (status) result = result.filter((p: any) => p.status === status);
      if (customerId) result = result.filter((p: any) => p.customer_id === customerId);
      if (search) {
        result = result.filter((p: any) =>
          Object.values(p).some((v) => typeof v === 'string' && v.toLowerCase().includes(search)),
        );
      }

      if (paginate) {
        const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        const limit = Math.min(
          Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50),
          200,
        );
        const total = result.length;
        const from = (page - 1) * limit;
        return createCorsResponse(
          { data: result.slice(from, from + limit), pagination: { page, limit, total } },
          200,
          req,
        );
      }

      return createCorsResponse(result, 200, req);
    }

    // GET /professional-services/active - Get active projects
    if (req.method === 'GET' && isProjects && projectId === 'active') {
      // The error was discarded here too, so a table that does not exist
      // answered 200 with an empty list - "no active projects" as a
      // measurement of a tracker that was never built.
      const { data: projects, error } = await admin
        .from('professional_services_projects')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['planning', 'in_progress', 'on_hold'])
        .order('start_date', { ascending: true });

      if (error) {
        if (isMissingTableError(error)) return projectsUnavailable(req, 'The project tracker');
        console.error('Error fetching active projects:', error);
        return createCorsResponse({ error: 'Failed to fetch active projects' }, 500, req);
      }

      return createCorsResponse(projects || [], 200, req);
    }

    // GET /professional-services/:id - Get single project
    if (req.method === 'GET' && isProjects && projectId && !subResource) {
      const { data: project, error } = await admin
        .from('professional_services_projects')
        .select('*')
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (isMissingTableError(error)) return projectsUnavailable(req, 'The project tracker');
        return createCorsResponse({ error: 'Project not found' }, 404, req);
      }

      // Get project tasks
      const { data: tasks } = await admin
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });

      // Get time entries.
      //
      // time_entries has no project_id — it attaches to a TASK (task_id) — so
      // filtering by project 42703'd and this list was always empty. The tasks
      // fetched just above already carry the project's task ids, so the link is
      // resolved from those rather than with another query.
      const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
      const { data: timeEntries } = taskIds.length
        ? await admin
            .from('time_entries')
            .select('*')
            .in('task_id', taskIds)
            .order('entry_date', { ascending: false })
        : { data: [] };

      return createCorsResponse(
        { ...project, tasks: tasks || [], timeEntries: timeEntries || [] },
        200,
        req,
      );
    }

    // POST /professional-services - Create project
    if (req.method === 'POST' && isProjects && !projectId) {
      const body = await req.json();

      const projectData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        project_name: body.projectName || body.project_name,
        project_type: body.projectType || body.project_type || 'implementation',
        description: body.description,
        status: body.status || 'planning',
        start_date: body.startDate || body.start_date,
        target_end_date: body.targetEndDate || body.target_end_date,
        budget_hours: body.budgetHours || body.budget_hours,
        budget_amount: body.budgetAmount || body.budget_amount,
        hourly_rate: body.hourlyRate || body.hourly_rate,
        project_manager_id: body.projectManagerId || body.project_manager_id,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: project, error } = await admin
        .from('professional_services_projects')
        .insert(projectData)
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        if (isMissingTableError(error)) return projectsUnavailable(req, 'The project tracker');
        return createCorsResponse({ error: 'Failed to create project' }, 500, req);
      }

      return createCorsResponse(project, 201, req);
    }

    // PUT /professional-services/:id - Update project
    if (req.method === 'PUT' && isProjects && projectId && !subResource) {
      const body = await req.json();

      const { data: project, error } = await admin
        .from('professional_services_projects')
        // An explicit map, not `{ ...body }`: a spread lets the caller name
        // every column, tenant_id and id included, and the tenant filter
        // decides WHICH row is written, not what goes into it (COP-M01).
        .update(projectPatch(body))
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) return projectsUnavailable(req, 'The project tracker');
        return createCorsResponse({ error: 'Failed to update project' }, 500, req);
      }

      return createCorsResponse(project, 200, req);
    }

    // POST /professional-services/:id/tasks - Add task
    if (req.method === 'POST' && isProjects && projectId && subResource === 'tasks') {
      const body = await req.json();

      const { data: task, error } = await admin
        .from('project_tasks')
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          task_name: body.taskName || body.task_name,
          description: body.description,
          assigned_to: body.assignedTo || body.assigned_to,
          status: body.status || 'pending',
          estimated_hours: body.estimatedHours || body.estimated_hours,
          due_date: body.dueDate || body.due_date,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) return projectsUnavailable(req, 'Project tasks');
        return createCorsResponse({ error: 'Failed to create task' }, 500, req);
      }

      return createCorsResponse(task, 201, req);
    }

    // POST /professional-services/:id/time - Log time
    if (req.method === 'POST' && isProjects && projectId && subResource === 'time') {
      const body = await req.json();

      // project_id and billable are not columns on time_entries, so every log
      // was a 42703. An entry reaches its project through its task, which makes
      // taskId required rather than optional — without it there is nothing
      // tying the hours to this project.
      const taskId = body.taskId || body.task_id;
      if (!taskId) {
        return createCorsResponse(
          {
            error: 'taskId is required to log time',
            code: 'TIME_ENTRY_NEEDS_TASK',
            details:
              'time_entries attaches to a task (task_id), not directly to a project. Create or ' +
              'pick a task on this project first.',
          },
          400,
          req,
        );
      }

      const { data: timeEntry, error } = await admin
        .from('time_entries')
        .insert({
          tenant_id: tenantId,
          task_id: taskId,
          user_id: user.id,
          hours: body.hours,
          description: body.description,
          entry_date: body.entryDate || body.entry_date || new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) return projectsUnavailable(req, 'Project time tracking');
        return createCorsResponse({ error: 'Failed to log time' }, 500, req);
      }

      return createCorsResponse(
        body.billable !== undefined
          ? {
              ...timeEntry,
              unpersisted: ['billable: time_entries has no billable column'],
            }
          : timeEntry,
        201,
        req,
      );
    }

    // DELETE /professional-services/:id - Delete project
    if (req.method === 'DELETE' && isProjects && projectId) {
      const { error } = await admin
        .from('professional_services_projects')
        .delete()
        .eq('id', projectId)
        .eq('tenant_id', tenantId);

      if (error) {
        if (isMissingTableError(error)) return projectsUnavailable(req, 'The project tracker');
        return createCorsResponse({ error: 'Failed to delete project' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Project deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in professional-services function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
