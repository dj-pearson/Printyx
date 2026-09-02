import type { Express, Request, Response } from 'express';
import { db } from './db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { equipment, projects, purchaseOrders, tasks } from '@shared/schema';
// Auth helpers for Supabase JWT + session fallback
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
// CR-023: the documented error shape, { message, code, details, requestId }.
import { badRequest, notFound, serverError } from './lib/error-response';
// WF-P-07: the shape of a project row and what it covers is decided in ONE
// place, the edge function's pure module, so dev and production cannot disagree
// about it. The module imports nothing, which is what makes this importable
// from Node at all.
import {
  defaultMilestonesFor,
  mapProject,
  projectRow,
  projectTypeForHandoff,
  serialsForProject,
  taskCounts,
} from '../supabase/functions/projects/_project-scope';
import { salesHandoffChecklists } from '@shared/schema';

const log = createModuleLogger('routes-tasks');

// Task management routes using real database data
export function registerTaskRoutes(app: Express) {
  // ── /api/tasks: RETIRED (PROD-008b) ───────────────────────────────────────
  //
  // GET /api/tasks, GET /api/tasks/stats, POST /api/tasks and PUT
  // /api/tasks/:id used to live here. /api/tasks is in crmProxies, and
  // registerEdgeFunctionProxy runs before this file, so none of them ran in
  // dev; production never reaches Express at all. The tasks edge function owns
  // the surface.
  //
  // /api/projects below is NOT proxied and still runs here, so these handlers
  // are what dev sees while supabase/functions/projects is what production
  // sees. WF-P-07 made the two agree field for field by sharing _project-scope.
  // A bare crmProxies entry for /api/projects is NOT the fix:
  // /api/projects/:id/create-template (routes-templates) sits under the same
  // prefix and the proxy forwards a whole prefix, so it would take that off
  // Express with nothing serving it.
  //
  // GET /api/projects/:id below is registered BEFORE routes-templates and what
  // was routes-enhanced-tasks, so it would have shadowed their literal
  // sub-paths. /api/projects/enhanced was deleted with its router rather than
  // routed around: it read seven columns migration 0002 dropped, so it was a
  // 42703 in dev and a 404 in production, and nothing called it.
  // /api/projects/:id/create-template has three segments and is unaffected.

  // Get projects
  app.get('/api/projects', async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return badRequest(res, 'Tenant ID required', { code: 'TENANT_REQUIRED' });

      const conditions = [eq(projects.tenantId, tenantId)];
      const filters: Array<[column: keyof typeof projects.$inferSelect, ...string[]]> = [
        ['status', 'status'],
        ['customerId', 'customerId', 'customer_id'],
        ['handoffId', 'handoffId', 'handoff_id'],
        ['contractId', 'contractId', 'contract_id'],
        ['projectType', 'projectType', 'project_type'],
      ];
      for (const [column, ...params] of filters) {
        const value = params.map((p) => req.query[p]).find((v) => typeof v === 'string' && v);
        if (value) conditions.push(eq(projects[column] as never, value as never));
      }

      const rows = await db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt));

      const ids = rows.map((r) => r.id);
      const projectTasks = ids.length
        ? await db
            .select({ projectId: tasks.projectId, status: tasks.status })
            .from(tasks)
            .where(and(eq(tasks.tenantId, tenantId), inArray(tasks.projectId, ids)))
        : [];

      res.json(
        rows.map((row) =>
          mapProject(toSnake(row), taskCounts(projectTasks.filter((t) => t.projectId === row.id))),
        ),
      );
    } catch (error) {
      log.error('Error fetching projects:', error);
      serverError(res, 'Failed to fetch projects');
    }
  });

  // One project, with its tasks and the equipment serials it covers.
  app.get('/api/projects/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return badRequest(res, 'Tenant ID required', { code: 'TENANT_REQUIRED' });

      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, req.params.id), eq(projects.tenantId, tenantId)));
      if (!project) return notFound(res, 'Project not found');

      const projectTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.tenantId, tenantId), eq(tasks.projectId, project.id)))
        .orderBy(desc(tasks.createdAt));

      const orders = project.contractId
        ? await db
            .select()
            .from(purchaseOrders)
            .where(
              and(
                eq(purchaseOrders.tenantId, tenantId),
                eq(purchaseOrders.sourceContractId, project.contractId),
              ),
            )
        : [];
      const units = orders.length
        ? await db
            .select()
            .from(equipment)
            .where(
              and(
                eq(equipment.tenantId, tenantId),
                inArray(
                  equipment.purchaseOrderId,
                  orders.map((o) => o.id),
                ),
              ),
            )
        : [];

      const { serials, unbacked } = serialsForProject(
        { contract_id: project.contractId },
        {
          purchaseOrders: orders.map((o) => ({
            id: o.id,
            po_number: o.poNumber,
            source_contract_id: o.sourceContractId,
          })),
          equipment: units.map((u) => ({
            id: u.id,
            serial_number: u.serialNumber,
            model_number: u.modelNumber,
            manufacturer: u.manufacturer,
            equipment_status: u.equipmentStatus,
            customer_id: u.customerId,
            install_date: u.installDate ? u.installDate.toISOString() : null,
            purchase_order_id: u.purchaseOrderId,
          })),
        },
      );

      res.json({
        ...mapProject(toSnake(project), taskCounts(projectTasks)),
        tasks: projectTasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assigned_to: t.assignedTo,
          due_date: t.dueDate,
          completion_percentage: t.completionPercentage,
        })),
        equipment: serials,
        unbacked,
      });
    } catch (error) {
      log.error('Error fetching project:', error);
      serverError(res, 'Failed to fetch project');
    }
  });

  // Create new project
  app.post('/api/projects', async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return badRequest(res, 'Tenant ID required', { code: 'TENANT_REQUIRED' });
      const userId = getUserId(req);
      if (!userId) return badRequest(res, 'User ID required', { code: 'USER_REQUIRED' });
      if (!req.body?.name) {
        return badRequest(res, 'Project name is required', { code: 'VALIDATION_ERROR' });
      }

      const row = projectRow(req.body) as Record<string, unknown>;

      // Same defaults the edge function applies, from the same module.
      if (!row.project_type && row.handoff_id) {
        const [handoff] = await db
          .select()
          .from(salesHandoffChecklists)
          .where(
            and(
              eq(salesHandoffChecklists.id, String(row.handoff_id)),
              eq(salesHandoffChecklists.tenantId, tenantId),
            ),
          );
        row.project_type = projectTypeForHandoff(handoff?.handoffType);
        if (!row.customer_id && handoff?.customerId) row.customer_id = handoff.customerId;
        if (!row.contract_id && handoff?.contractId) row.contract_id = handoff.contractId;
      }
      if (!row.milestones && row.project_type) {
        row.milestones = defaultMilestonesFor(String(row.project_type));
      }

      const [project] = await db
        .insert(projects)
        .values({
          tenantId,
          createdBy: userId,
          name: String(row.name),
          description: (row.description as string) ?? null,
          status: (row.status as string) ?? 'planning',
          customerId: (row.customer_id as string) ?? null,
          contractId: (row.contract_id as string) ?? null,
          handoffId: (row.handoff_id as string) ?? null,
          projectType: (row.project_type as string) ?? null,
          milestones: (row.milestones as never) ?? null,
          startDate: toDate(row.start_date),
          endDate: toDate(row.end_date),
          estimatedHours: (row.estimated_hours as number) ?? null,
          budget: row.budget === null || row.budget === undefined ? null : String(row.budget),
        })
        .returning();

      res.status(201).json(mapProject(toSnake(project), { taskCount: 0, completedTaskCount: 0 }));
    } catch (error) {
      log.error('Error creating project:', error);
      serverError(res, 'Failed to create project');
    }
  });
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Drizzle answers camelCase; mapProject takes the PostgREST row shape. */
function toSnake(row: typeof projects.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    customer_id: row.customerId,
    contract_id: row.contractId,
    handoff_id: row.handoffId,
    project_type: row.projectType,
    milestones: row.milestones,
    start_date: row.startDate ? row.startDate.toISOString() : null,
    end_date: row.endDate ? row.endDate.toISOString() : null,
    budget: row.budget,
    estimated_hours: row.estimatedHours,
    actual_hours: row.actualHours,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
  };
}
