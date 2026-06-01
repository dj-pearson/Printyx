/**
 * Task Workflow Routes (TWF-###)
 *
 * Human-centric, customizable workflows for the Tasks module:
 *  - Build steps manually, or by uploading an image / CSV / XLSX that is parsed
 *    into a draft the creator confirms before saving.
 *  - Run a workflow stage-by-stage; completing a stage notifies the next
 *    stage's assignees (email + in-app) with a deep link.
 *  - The owner (creator) has full PM control and can delegate it via
 *    projectManagerId; PMs can advance or regress (send back for revisions).
 *  - Save as a one-off instance or as a reusable template.
 *
 * Auth: isAuthenticated + tenant scoping on every route. Management actions
 * (advance / regress / delete / reassign PM) additionally require the caller to
 * be the workflow owner, the assigned PM, or a platform admin.
 */
import type { Express } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getUserId, getTenantId, isPlatformAdmin } from './utils/auth-helpers';
import {
  taskWorkflows,
  taskWorkflowSteps,
  taskWorkflowEvents,
  type TaskWorkflow,
} from '@shared/schema';
import {
  startWorkflow,
  completeStep,
  reopenStep,
  advanceWorkflow,
  regressWorkflow,
  getWorkflowWithSteps,
  recordEvent,
} from './services/task-workflow/engine';
import { parseUploadToDraft } from './services/task-workflow/parser';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-task-workflows');

// In-memory upload (we need the buffer to parse). 15MB cap; csv/xlsx/images only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype?.startsWith('image/') ||
      /\.(csv|xlsx?|png|jpe?g|webp|gif)$/i.test(file.originalname || '');
    if (ok) cb(null, true);
    else cb(new Error('Unsupported file type. Upload a CSV, Excel, or image file.'));
  },
});

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const stepInputSchema = z.object({
  title: z.string().min(1).max(512),
  details: z.string().max(10000).optional().nullable(),
  stageIndex: z.number().int().min(0).default(0),
  orderIndex: z.number().int().min(0).default(0),
  assigneeUserId: z.string().optional().nullable(),
  assigneeName: z.string().max(255).optional().nullable(),
  assigneeEmail: z.string().email().max(320).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  isTemplate: z.boolean().default(false),
  templateId: z.string().optional().nullable(),
  projectManagerId: z.string().optional().nullable(),
  sourceType: z.enum(['manual', 'image', 'csv', 'xlsx', 'template']).default('manual'),
  sourceFileName: z.string().max(512).optional().nullable(),
  settings: z.record(z.any()).optional(),
  steps: z.array(stepInputSchema).default([]),
  startNow: z.boolean().default(false),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional().nullable(),
  projectManagerId: z.string().optional().nullable(),
  settings: z.record(z.any()).optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived', 'cancelled']).optional(),
});

const updateStepSchema = stepInputSchema.partial();

const regressSchema = z.object({
  toStageIndex: z.number().int().min(0),
  note: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canManage(workflow: TaskWorkflow, userId: string, req: any): boolean {
  return (
    workflow.ownerId === userId || workflow.projectManagerId === userId || isPlatformAdmin(req)
  );
}

async function loadWorkflow(tenantId: string, id: string): Promise<TaskWorkflow | null> {
  const [wf] = await db
    .select()
    .from(taskWorkflows)
    .where(
      and(
        eq(taskWorkflows.id, id),
        eq(taskWorkflows.tenantId, tenantId),
        sql`${taskWorkflows.deletedAt} is null`,
      ),
    )
    .limit(1);
  return wf || null;
}

async function insertSteps(
  tenantId: string,
  workflowId: string,
  steps: z.infer<typeof stepInputSchema>[],
) {
  if (steps.length === 0) return;
  await db.insert(taskWorkflowSteps).values(
    steps.map((s, i) => ({
      tenantId,
      workflowId,
      title: s.title,
      details: s.details ?? null,
      stageIndex: s.stageIndex ?? i,
      orderIndex: s.orderIndex ?? 0,
      assigneeUserId: s.assigneeUserId ?? null,
      assigneeName: s.assigneeName ?? null,
      assigneeEmail: s.assigneeEmail ?? null,
      dueAt: s.dueAt ?? null,
      status: 'pending' as const,
    })),
  );
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerTaskWorkflowRoutes(app: Express) {
  app.use('/api/task-workflows', isAuthenticated, resolveTenant);

  // -- Parse an uploaded file into a draft (NOT saved) -----------------------
  app.post('/api/task-workflows/parse', upload.single('file'), async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

      const draft = await parseUploadToDraft({
        tenantId,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
      });

      if (draft.steps.length === 0) {
        return res
          .status(422)
          .json({ message: 'No workflow steps could be extracted from this file.', draft });
      }
      res.json(draft);
    } catch (error: any) {
      log.error('Error parsing workflow upload:', error);
      res.status(400).json({ message: error.message || 'Failed to parse file' });
    }
  });

  // -- List workflows (instances and/or templates) ---------------------------
  app.get('/api/task-workflows', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const type = String(req.query?.type || 'instances'); // 'instances' | 'templates' | 'all'
      const mine = String(req.query?.mine || '') === 'true';
      const userId = getUserId(req);

      const conditions = [
        eq(taskWorkflows.tenantId, tenantId),
        sql`${taskWorkflows.deletedAt} is null`,
      ];
      if (type === 'templates') conditions.push(eq(taskWorkflows.isTemplate, true));
      else if (type === 'instances') conditions.push(eq(taskWorkflows.isTemplate, false));
      if (mine && userId) conditions.push(eq(taskWorkflows.ownerId, userId));

      const rows = await db
        .select()
        .from(taskWorkflows)
        .where(and(...conditions))
        .orderBy(desc(taskWorkflows.updatedAt));

      // Attach lightweight step counts
      const ids = rows.map((r) => r.id);
      const counts =
        ids.length > 0
          ? await db
              .select({
                workflowId: taskWorkflowSteps.workflowId,
                total: sql<number>`count(*)::int`,
                completed: sql<number>`count(*) filter (where ${taskWorkflowSteps.status} = 'completed')::int`,
              })
              .from(taskWorkflowSteps)
              .where(
                and(
                  eq(taskWorkflowSteps.tenantId, tenantId),
                  sql`${taskWorkflowSteps.workflowId} = any(${ids})`,
                ),
              )
              .groupBy(taskWorkflowSteps.workflowId)
          : [];
      const countMap = new Map(counts.map((c) => [c.workflowId, c]));

      res.json(
        rows.map((r) => ({
          ...r,
          stepCount: countMap.get(r.id)?.total ?? 0,
          completedStepCount: countMap.get(r.id)?.completed ?? 0,
        })),
      );
    } catch (error: any) {
      log.error('Error listing workflows:', error);
      res.status(500).json({ message: 'Failed to list workflows' });
    }
  });

  // -- Get one workflow with steps + activity log ----------------------------
  app.get('/api/task-workflows/:id', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const data = await getWorkflowWithSteps(tenantId, req.params.id);
      if (!data || data.workflow.deletedAt)
        return res.status(404).json({ message: 'Workflow not found' });

      const events = await db
        .select()
        .from(taskWorkflowEvents)
        .where(
          and(
            eq(taskWorkflowEvents.tenantId, tenantId),
            eq(taskWorkflowEvents.workflowId, req.params.id),
          ),
        )
        .orderBy(desc(taskWorkflowEvents.createdAt))
        .limit(200);

      res.json({ ...data, events });
    } catch (error: any) {
      log.error('Error fetching workflow:', error);
      res.status(500).json({ message: 'Failed to fetch workflow' });
    }
  });

  // -- Create a workflow (instance or template) ------------------------------
  app.post('/api/task-workflows', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const body = createWorkflowSchema.parse(req.body);

      const [wf] = await db
        .insert(taskWorkflows)
        .values({
          tenantId,
          name: body.name,
          description: body.description ?? null,
          status: 'draft',
          isTemplate: body.isTemplate,
          templateId: body.templateId ?? null,
          ownerId: userId,
          projectManagerId: body.projectManagerId ?? null,
          currentStageIndex: 0,
          sourceType: body.sourceType,
          sourceFileName: body.sourceFileName ?? null,
          settings: body.settings ?? {},
          createdBy: userId,
          lastModifiedBy: userId,
        })
        .returning();

      await insertSteps(tenantId, wf.id, body.steps);
      await recordEvent({
        tenantId,
        workflowId: wf.id,
        eventType: 'created',
        actorUserId: userId,
        metadata: { isTemplate: body.isTemplate, stepCount: body.steps.length },
      });

      if (body.startNow && !body.isTemplate) {
        const started = await startWorkflow(tenantId, wf.id, userId);
        return res.status(201).json(started);
      }

      const data = await getWorkflowWithSteps(tenantId, wf.id);
      res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: 'Validation failed', details: error.errors });
      log.error('Error creating workflow:', error);
      res.status(500).json({ message: 'Failed to create workflow' });
    }
  });

  // -- Update workflow metadata ----------------------------------------------
  app.patch('/api/task-workflows/:id', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can edit this workflow' });

      const body = updateWorkflowSchema.parse(req.body);
      await db
        .update(taskWorkflows)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.projectManagerId !== undefined
            ? { projectManagerId: body.projectManagerId }
            : {}),
          ...(body.settings !== undefined ? { settings: body.settings } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          lastModifiedBy: userId,
          updatedAt: new Date(),
        })
        .where(and(eq(taskWorkflows.id, wf.id), eq(taskWorkflows.tenantId, tenantId)));

      const data = await getWorkflowWithSteps(tenantId, wf.id);
      res.json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: 'Validation failed', details: error.errors });
      log.error('Error updating workflow:', error);
      res.status(500).json({ message: 'Failed to update workflow' });
    }
  });

  // -- Soft delete -----------------------------------------------------------
  app.delete('/api/task-workflows/:id', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can delete this workflow' });

      await db
        .update(taskWorkflows)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(taskWorkflows.id, wf.id), eq(taskWorkflows.tenantId, tenantId)));
      res.json({ success: true });
    } catch (error: any) {
      log.error('Error deleting workflow:', error);
      res.status(500).json({ message: 'Failed to delete workflow' });
    }
  });

  // -- Start a draft workflow ------------------------------------------------
  app.post('/api/task-workflows/:id/start', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can start this workflow' });

      const result = await startWorkflow(tenantId, wf.id, userId);
      res.json(result);
    } catch (error: any) {
      log.error('Error starting workflow:', error);
      res.status(400).json({ message: error.message || 'Failed to start workflow' });
    }
  });

  // -- Add a step ------------------------------------------------------------
  app.post('/api/task-workflows/:id/steps', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can edit steps' });

      const body = stepInputSchema.parse(req.body);
      await insertSteps(tenantId, wf.id, [body]);
      const data = await getWorkflowWithSteps(tenantId, wf.id);
      res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: 'Validation failed', details: error.errors });
      log.error('Error adding step:', error);
      res.status(500).json({ message: 'Failed to add step' });
    }
  });

  // -- Replace ALL steps at once (draft only) — used by the builder ----------
  app.put('/api/task-workflows/:id/steps', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can edit steps' });
      if (wf.status !== 'draft')
        return res
          .status(409)
          .json({ message: 'Steps can only be bulk-replaced while the workflow is a draft' });

      const steps = z.array(stepInputSchema).parse(req.body?.steps ?? req.body);

      await db
        .delete(taskWorkflowSteps)
        .where(
          and(eq(taskWorkflowSteps.workflowId, wf.id), eq(taskWorkflowSteps.tenantId, tenantId)),
        );
      await insertSteps(tenantId, wf.id, steps);

      const data = await getWorkflowWithSteps(tenantId, wf.id);
      res.json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: 'Validation failed', details: error.errors });
      log.error('Error replacing steps:', error);
      res.status(500).json({ message: 'Failed to replace steps' });
    }
  });

  // -- Edit a step (title/details/assignee/stage/order/due) ------------------
  app.patch('/api/task-workflows/:id/steps/:stepId', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can edit steps' });

      const body = updateStepSchema.parse(req.body);
      const prev = await db
        .select()
        .from(taskWorkflowSteps)
        .where(
          and(
            eq(taskWorkflowSteps.id, req.params.stepId),
            eq(taskWorkflowSteps.workflowId, wf.id),
            eq(taskWorkflowSteps.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (prev.length === 0) return res.status(404).json({ message: 'Step not found' });

      await db
        .update(taskWorkflowSteps)
        .set({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.details !== undefined ? { details: body.details } : {}),
          ...(body.stageIndex !== undefined ? { stageIndex: body.stageIndex } : {}),
          ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
          ...(body.assigneeUserId !== undefined ? { assigneeUserId: body.assigneeUserId } : {}),
          ...(body.assigneeName !== undefined ? { assigneeName: body.assigneeName } : {}),
          ...(body.assigneeEmail !== undefined ? { assigneeEmail: body.assigneeEmail } : {}),
          ...(body.dueAt !== undefined ? { dueAt: body.dueAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(taskWorkflowSteps.id, req.params.stepId));

      // Record reassignment for the activity log when the assignee changed.
      if (body.assigneeUserId !== undefined && body.assigneeUserId !== prev[0].assigneeUserId) {
        await recordEvent({
          tenantId,
          workflowId: wf.id,
          stepId: req.params.stepId,
          eventType: 'reassigned',
          actorUserId: userId,
          metadata: { from: prev[0].assigneeUserId, to: body.assigneeUserId },
        });
      }

      const data = await getWorkflowWithSteps(tenantId, wf.id);
      res.json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: 'Validation failed', details: error.errors });
      log.error('Error updating step:', error);
      res.status(500).json({ message: 'Failed to update step' });
    }
  });

  // -- Delete a step ---------------------------------------------------------
  app.delete('/api/task-workflows/:id/steps/:stepId', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can edit steps' });

      await db
        .delete(taskWorkflowSteps)
        .where(
          and(
            eq(taskWorkflowSteps.id, req.params.stepId),
            eq(taskWorkflowSteps.workflowId, wf.id),
            eq(taskWorkflowSteps.tenantId, tenantId),
          ),
        );
      const data = await getWorkflowWithSteps(tenantId, wf.id);
      res.json(data);
    } catch (error: any) {
      log.error('Error deleting step:', error);
      res.status(500).json({ message: 'Failed to delete step' });
    }
  });

  // -- Complete a step (anyone assigned, the owner, or the PM) ----------------
  app.post('/api/task-workflows/:id/steps/:stepId/complete', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });

      const [step] = await db
        .select()
        .from(taskWorkflowSteps)
        .where(
          and(
            eq(taskWorkflowSteps.id, req.params.stepId),
            eq(taskWorkflowSteps.workflowId, wf.id),
            eq(taskWorkflowSteps.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!step) return res.status(404).json({ message: 'Step not found' });

      // Assignee of the step, owner, or PM may complete it.
      const allowed = step.assigneeUserId === userId || canManage(wf, userId, req);
      if (!allowed)
        return res
          .status(403)
          .json({ message: 'Only the assignee or a project manager can complete this step' });

      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
      const result = await completeStep(tenantId, wf.id, step.id, userId, note);
      res.json(result);
    } catch (error: any) {
      log.error('Error completing step:', error);
      res.status(400).json({ message: error.message || 'Failed to complete step' });
    }
  });

  // -- Reopen a step (PM control) --------------------------------------------
  app.post('/api/task-workflows/:id/steps/:stepId/reopen', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can reopen a step' });

      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
      const result = await reopenStep(tenantId, wf.id, req.params.stepId, userId, note);
      res.json(result);
    } catch (error: any) {
      log.error('Error reopening step:', error);
      res.status(400).json({ message: error.message || 'Failed to reopen step' });
    }
  });

  // -- Advance past current stage (PM control) -------------------------------
  app.post('/api/task-workflows/:id/advance', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can advance this workflow' });

      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
      const result = await advanceWorkflow(tenantId, wf.id, userId, note);
      res.json(result);
    } catch (error: any) {
      log.error('Error advancing workflow:', error);
      res.status(400).json({ message: error.message || 'Failed to advance workflow' });
    }
  });

  // -- Regress to an earlier stage (PM control) ------------------------------
  app.post('/api/task-workflows/:id/regress', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const wf = await loadWorkflow(tenantId, req.params.id);
      if (!wf) return res.status(404).json({ message: 'Workflow not found' });
      if (!canManage(wf, userId, req))
        return res
          .status(403)
          .json({ message: 'Only the owner or project manager can regress this workflow' });

      const body = regressSchema.parse(req.body);
      const result = await regressWorkflow(tenantId, wf.id, body.toStageIndex, userId, body.note);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: 'Validation failed', details: error.errors });
      log.error('Error regressing workflow:', error);
      res.status(400).json({ message: error.message || 'Failed to regress workflow' });
    }
  });

  // -- Save an existing workflow as a reusable template ----------------------
  app.post('/api/task-workflows/:id/save-as-template', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const source = await getWorkflowWithSteps(tenantId, req.params.id);
      if (!source || source.workflow.deletedAt)
        return res.status(404).json({ message: 'Workflow not found' });

      const name =
        typeof req.body?.name === 'string' && req.body.name.trim()
          ? req.body.name.trim()
          : `${source.workflow.name} (Template)`;

      const [tpl] = await db
        .insert(taskWorkflows)
        .values({
          tenantId,
          name,
          description: source.workflow.description,
          status: 'draft',
          isTemplate: true,
          ownerId: userId,
          projectManagerId: null,
          sourceType: 'template',
          settings: source.workflow.settings ?? {},
          createdBy: userId,
          lastModifiedBy: userId,
        })
        .returning();

      await insertSteps(
        tenantId,
        tpl.id,
        source.steps.map((s) => ({
          title: s.title,
          details: s.details ?? undefined,
          stageIndex: s.stageIndex,
          orderIndex: s.orderIndex,
          assigneeUserId: s.assigneeUserId ?? undefined,
          assigneeName: s.assigneeName ?? undefined,
          assigneeEmail: s.assigneeEmail ?? undefined,
        })),
      );
      await recordEvent({
        tenantId,
        workflowId: tpl.id,
        eventType: 'created',
        actorUserId: userId,
        metadata: { fromWorkflowId: source.workflow.id, asTemplate: true },
      });

      const data = await getWorkflowWithSteps(tenantId, tpl.id);
      res.status(201).json(data);
    } catch (error: any) {
      log.error('Error saving as template:', error);
      res.status(500).json({ message: 'Failed to save as template' });
    }
  });

  // -- Instantiate a new workflow from a template ----------------------------
  app.post('/api/task-workflows/from-template/:templateId', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

      const tpl = await getWorkflowWithSteps(tenantId, req.params.templateId);
      if (!tpl || tpl.workflow.deletedAt || !tpl.workflow.isTemplate)
        return res.status(404).json({ message: 'Template not found' });

      const name =
        typeof req.body?.name === 'string' && req.body.name.trim()
          ? req.body.name.trim()
          : tpl.workflow.name.replace(/\s*\(Template\)\s*$/i, '');
      const projectManagerId =
        typeof req.body?.projectManagerId === 'string' ? req.body.projectManagerId : null;

      const [wf] = await db
        .insert(taskWorkflows)
        .values({
          tenantId,
          name,
          description: tpl.workflow.description,
          status: 'draft',
          isTemplate: false,
          templateId: tpl.workflow.id,
          ownerId: userId,
          projectManagerId,
          sourceType: 'template',
          settings: tpl.workflow.settings ?? {},
          createdBy: userId,
          lastModifiedBy: userId,
        })
        .returning();

      await insertSteps(
        tenantId,
        wf.id,
        tpl.steps.map((s) => ({
          title: s.title,
          details: s.details ?? undefined,
          stageIndex: s.stageIndex,
          orderIndex: s.orderIndex,
          assigneeUserId: s.assigneeUserId ?? undefined,
          assigneeName: s.assigneeName ?? undefined,
          assigneeEmail: s.assigneeEmail ?? undefined,
        })),
      );
      await recordEvent({
        tenantId,
        workflowId: wf.id,
        eventType: 'created',
        actorUserId: userId,
        metadata: { fromTemplateId: tpl.workflow.id },
      });

      const data = await getWorkflowWithSteps(tenantId, wf.id);
      res.status(201).json(data);
    } catch (error: any) {
      log.error('Error instantiating template:', error);
      res.status(500).json({ message: 'Failed to create workflow from template' });
    }
  });

  log.info('Task workflow routes registered');
}
