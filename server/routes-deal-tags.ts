/**
 * Deal Tags & Board Card Config API Routes
 * CRUD endpoints for deal tags, tag assignments, and board card configuration.
 * Part of CRM-004: Configurable deal cards with admin card setup and deal tags.
 */
import type { Express, Request, Response } from 'express';
import { eq, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { dealTags, dealTagAssignments, boardCardConfigs } from '@shared/schema';

const log = createModuleLogger('routes-deal-tags');

export function registerDealTagRoutes(app: Express) {
  // ═════════════════════ Deal Tags CRUD ═════════════════════════════

  // GET /api/deal-tags - List all tags for tenant
  app.get('/api/deal-tags', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const tags = await db
        .select()
        .from(dealTags)
        .where(eq(dealTags.tenantId, tenantId))
        .orderBy(asc(dealTags.name));

      res.json(tags);
    } catch (error: any) {
      log.error('Failed to fetch deal tags:', error);
      res.status(500).json({ message: 'Failed to fetch deal tags' });
    }
  });

  // POST /api/deal-tags - Create tag
  app.post('/api/deal-tags', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const schema = z.object({
        name: z.string().min(1).max(100),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
        description: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const [created] = await db
        .insert(dealTags)
        .values({ tenantId, ...parsed.data })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      log.error('Failed to create deal tag:', error);
      res.status(500).json({ message: 'Failed to create deal tag' });
    }
  });

  // PUT /api/deal-tags/:id - Update tag
  app.put('/api/deal-tags/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const [updated] = await db
        .update(dealTags)
        .set(parsed.data)
        .where(and(eq(dealTags.id, req.params.id), eq(dealTags.tenantId, tenantId)))
        .returning();

      if (!updated) return res.status(404).json({ message: 'Tag not found' });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update deal tag:', error);
      res.status(500).json({ message: 'Failed to update deal tag' });
    }
  });

  // DELETE /api/deal-tags/:id - Delete tag
  app.delete('/api/deal-tags/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      // Delete assignments first
      await db.delete(dealTagAssignments).where(eq(dealTagAssignments.tagId, req.params.id));
      // Delete tag
      await db.delete(dealTags).where(and(eq(dealTags.id, req.params.id), eq(dealTags.tenantId, tenantId)));

      res.json({ message: 'Tag deleted' });
    } catch (error: any) {
      log.error('Failed to delete deal tag:', error);
      res.status(500).json({ message: 'Failed to delete deal tag' });
    }
  });

  // ═════════════════════ Tag Assignments ════════════════════════════

  // GET /api/deals/:dealId/tags - Get tags for a deal
  app.get('/api/deals/:dealId/tags', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const assignments = await db
        .select({
          id: dealTagAssignments.id,
          dealId: dealTagAssignments.dealId,
          tagId: dealTagAssignments.tagId,
          assignedBy: dealTagAssignments.assignedBy,
          assignedAt: dealTagAssignments.assignedAt,
          tagName: dealTags.name,
          tagColor: dealTags.color,
        })
        .from(dealTagAssignments)
        .innerJoin(dealTags, eq(dealTagAssignments.tagId, dealTags.id))
        .where(eq(dealTagAssignments.dealId, req.params.dealId));

      res.json(assignments);
    } catch (error: any) {
      log.error('Failed to fetch deal tags:', error);
      res.status(500).json({ message: 'Failed to fetch deal tags' });
    }
  });

  // POST /api/deals/:dealId/tags - Assign tag to deal
  app.post('/api/deals/:dealId/tags', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ tagId: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'tagId is required' });
      }

      const [assignment] = await db
        .insert(dealTagAssignments)
        .values({
          dealId: req.params.dealId,
          tagId: parsed.data.tagId,
          assignedBy: userId ?? null,
        })
        .returning();

      res.status(201).json(assignment);
    } catch (error: any) {
      log.error('Failed to assign deal tag:', error);
      res.status(500).json({ message: 'Failed to assign tag' });
    }
  });

  // DELETE /api/deals/:dealId/tags/:tagId - Remove tag from deal
  app.delete('/api/deals/:dealId/tags/:tagId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      await db
        .delete(dealTagAssignments)
        .where(
          and(
            eq(dealTagAssignments.dealId, req.params.dealId),
            eq(dealTagAssignments.tagId, req.params.tagId),
          ),
        );

      res.json({ message: 'Tag removed' });
    } catch (error: any) {
      log.error('Failed to remove deal tag:', error);
      res.status(500).json({ message: 'Failed to remove tag' });
    }
  });

  // ═════════════════════ Board Card Config ══════════════════════════

  // GET /api/board-card-config - Get card config
  app.get('/api/board-card-config', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const { pipelineId, viewId } = req.query;

      // Priority: user-specific > view-specific > pipeline-default > tenant-default
      const configs = await db
        .select()
        .from(boardCardConfigs)
        .where(eq(boardCardConfigs.tenantId, tenantId))
        .orderBy(desc(boardCardConfigs.createdAt));

      // Find best match
      const userViewConfig = configs.find(
        (c) => c.userId === userId && c.viewId === viewId && c.pipelineId === pipelineId,
      );
      const viewConfig = configs.find(
        (c) => !c.userId && c.viewId === viewId && c.pipelineId === pipelineId,
      );
      const pipelineConfig = configs.find(
        (c) => !c.userId && !c.viewId && c.pipelineId === pipelineId,
      );
      const defaultConfig = configs.find((c) => !c.userId && !c.viewId && !c.pipelineId);

      res.json(userViewConfig || viewConfig || pipelineConfig || defaultConfig || null);
    } catch (error: any) {
      log.error('Failed to fetch board card config:', error);
      res.status(500).json({ message: 'Failed to fetch board card config' });
    }
  });

  // POST /api/board-card-config - Create/update card config
  app.post('/api/board-card-config', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const schema = z.object({
        pipelineId: z.string().optional(),
        viewId: z.string().optional(),
        applyForEveryone: z.boolean().default(false),
        cardFields: z.array(z.object({
          field: z.string(),
          label: z.string(),
          position: z.number(),
          format: z.string().optional(),
        })).optional(),
        tagDisplayEnabled: z.boolean().optional(),
        maxFieldsShown: z.number().min(1).max(10).optional(),
        cardStyle: z.enum(['compact', 'standard', 'detailed']).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
      }

      const { applyForEveryone, ...data } = parsed.data;

      const [created] = await db
        .insert(boardCardConfigs)
        .values({
          tenantId,
          userId: applyForEveryone ? null : (userId ?? null),
          pipelineId: data.pipelineId ?? null,
          viewId: data.viewId ?? null,
          cardFields: (data.cardFields ?? null) as any,
          tagDisplayEnabled: data.tagDisplayEnabled,
          maxFieldsShown: data.maxFieldsShown,
          cardStyle: data.cardStyle,
        })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      log.error('Failed to create board card config:', error);
      res.status(500).json({ message: 'Failed to create board card config' });
    }
  });

  // PUT /api/board-card-config/:id - Update card config
  app.put('/api/board-card-config/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (req.body.cardFields !== undefined) updateData.cardFields = req.body.cardFields;
      if (req.body.tagDisplayEnabled !== undefined) updateData.tagDisplayEnabled = req.body.tagDisplayEnabled;
      if (req.body.maxFieldsShown !== undefined) updateData.maxFieldsShown = req.body.maxFieldsShown;
      if (req.body.cardStyle !== undefined) updateData.cardStyle = req.body.cardStyle;

      const [updated] = await db
        .update(boardCardConfigs)
        .set(updateData)
        .where(and(eq(boardCardConfigs.id, req.params.id), eq(boardCardConfigs.tenantId, tenantId)))
        .returning();

      if (!updated) return res.status(404).json({ message: 'Config not found' });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update board card config:', error);
      res.status(500).json({ message: 'Failed to update board card config' });
    }
  });

  log.info('✅ Deal Tags & Board Card Config routes registered');
}
