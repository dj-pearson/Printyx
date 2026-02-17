/**
 * Saved Views API Routes
 * CRUD endpoints for CRM saved view management.
 * Part of CRM-001: Persistent view management replacing localStorage-based saved filters.
 */
import type { Express, Request, Response } from 'express';
import { eq, and, or, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { savedViews, savedViewPins } from '@shared/schema';

const log = createModuleLogger('routes-saved-views');

// Validation schemas
const filterConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.any(),
  conjunction: z.enum(['AND', 'OR']).optional(),
});

const sortConfigSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});

const columnConfigItemSchema = z.object({
  field: z.string(),
  label: z.string(),
  visible: z.boolean(),
  width: z.number().optional(),
  order: z.number(),
});

const boardConfigSchema = z.object({
  cardFields: z.array(z.object({
    field: z.string(),
    label: z.string(),
    position: z.number(),
    format: z.string().optional(),
  })).optional(),
  columnTotals: z.enum(['sum', 'count', 'weighted', 'average', 'none']).optional(),
  groupBy: z.string().optional(),
});

const validObjectTypes = ['deals', 'leads', 'contacts', 'companies', 'opportunities'] as const;
type CrmObjectType = (typeof validObjectTypes)[number];

const createViewSchema = z.object({
  objectType: z.enum(validObjectTypes),
  name: z.string().min(1).max(255),
  filterDefinition: z.array(filterConditionSchema).nullable().optional(),
  sortConfig: sortConfigSchema.nullable().optional(),
  columnConfig: z.array(columnConfigItemSchema).nullable().optional(),
  boardConfig: boardConfigSchema.nullable().optional(),
  visibility: z.enum(['private', 'team', 'everyone']).default('private'),
  isDefault: z.boolean().default(false),
});

const updateViewSchema = createViewSchema.partial();

export function registerSavedViewsRoutes(app: Express) {
  // ─── GET /api/saved-views ─────────────────────────────────────────
  // List views the user can access: own private + team + everyone + system defaults
  app.get('/api/saved-views', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const objectType = req.query.objectType as string | undefined;
      if (!objectType) {
        return res.status(400).json({ message: 'objectType query parameter is required' });
      }

      if (!validObjectTypes.includes(objectType as CrmObjectType)) {
        return res.status(400).json({ message: `Invalid objectType. Must be one of: ${validObjectTypes.join(', ')}` });
      }

      // Get views: user's own + team + everyone visibility, scoped to tenant + objectType
      const views = await db
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.tenantId, tenantId),
            eq(savedViews.objectType, objectType as CrmObjectType),
            or(
              eq(savedViews.userId, userId),
              eq(savedViews.visibility, 'team'),
              eq(savedViews.visibility, 'everyone'),
            ),
          ),
        )
        .orderBy(desc(savedViews.isDefault), desc(savedViews.isSystemView), asc(savedViews.name));

      // Get user's pinned views for ordering
      const pins = await db
        .select()
        .from(savedViewPins)
        .where(eq(savedViewPins.userId, userId))
        .orderBy(asc(savedViewPins.sortOrder));

      const pinnedViewIds = new Set(pins.map((p) => p.viewId));

      const result = views.map((view) => ({
        ...view,
        isPinned: pinnedViewIds.has(view.id),
        pinSortOrder: pins.find((p) => p.viewId === view.id)?.sortOrder ?? null,
      }));

      res.json(result);
    } catch (error: any) {
      log.error('Failed to fetch saved views:', error);
      res.status(500).json({ message: 'Failed to fetch saved views' });
    }
  });

  // ─── GET /api/saved-views/:id ─────────────────────────────────────
  app.get('/api/saved-views/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const [view] = await db
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.id, req.params.id),
            eq(savedViews.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!view) {
        return res.status(404).json({ message: 'View not found' });
      }

      // Check access: own view, or team/everyone visibility
      if (view.userId !== userId && view.visibility === 'private') {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(view);
    } catch (error: any) {
      log.error('Failed to fetch saved view:', error);
      res.status(500).json({ message: 'Failed to fetch saved view' });
    }
  });

  // ─── POST /api/saved-views ────────────────────────────────────────
  app.post('/api/saved-views', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const parsed = createViewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const [created] = await db
        .insert(savedViews)
        .values({
          tenantId,
          userId,
          objectType: parsed.data.objectType,
          name: parsed.data.name,
          filterDefinition: (parsed.data.filterDefinition ?? null) as any,
          sortConfig: (parsed.data.sortConfig ?? null) as any,
          columnConfig: (parsed.data.columnConfig ?? null) as any,
          boardConfig: (parsed.data.boardConfig ?? null) as any,
          visibility: parsed.data.visibility,
          isDefault: parsed.data.isDefault,
        })
        .returning();

      log.info(`Saved view created: ${created.id} by user ${userId}`);
      res.status(201).json(created);
    } catch (error: any) {
      log.error('Failed to create saved view:', error);
      res.status(500).json({ message: 'Failed to create saved view' });
    }
  });

  // ─── PUT /api/saved-views/:id ─────────────────────────────────────
  app.put('/api/saved-views/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Fetch existing view
      const [existing] = await db
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.id, req.params.id),
            eq(savedViews.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: 'View not found' });
      }

      // Only owner or admin can update
      const reqAny = req as any;
      const isAdmin = reqAny.user?.roleLevel >= 7 || reqAny.supabaseUser?.roleLevel >= 7;
      if (existing.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: 'Only the view owner or an admin can update this view' });
      }

      const parsed = updateViewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      // Build update object with only provided fields
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
      if (parsed.data.objectType !== undefined) updateData.objectType = parsed.data.objectType;
      if (parsed.data.filterDefinition !== undefined) updateData.filterDefinition = parsed.data.filterDefinition;
      if (parsed.data.sortConfig !== undefined) updateData.sortConfig = parsed.data.sortConfig;
      if (parsed.data.columnConfig !== undefined) updateData.columnConfig = parsed.data.columnConfig;
      if (parsed.data.boardConfig !== undefined) updateData.boardConfig = parsed.data.boardConfig;
      if (parsed.data.visibility !== undefined) updateData.visibility = parsed.data.visibility;
      if (parsed.data.isDefault !== undefined) updateData.isDefault = parsed.data.isDefault;

      const [updated] = await db
        .update(savedViews)
        .set(updateData)
        .where(eq(savedViews.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update saved view:', error);
      res.status(500).json({ message: 'Failed to update saved view' });
    }
  });

  // ─── DELETE /api/saved-views/:id ──────────────────────────────────
  app.delete('/api/saved-views/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const [existing] = await db
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.id, req.params.id),
            eq(savedViews.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: 'View not found' });
      }

      // Cannot delete system defaults
      if (existing.isSystemView) {
        return res.status(403).json({ message: 'Cannot delete system default views' });
      }

      // Only owner or admin can delete
      const reqAny = req as any;
      const isAdmin = reqAny.user?.roleLevel >= 7 || reqAny.supabaseUser?.roleLevel >= 7;
      if (existing.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: 'Only the view owner or an admin can delete this view' });
      }

      // Delete associated pins first
      await db
        .delete(savedViewPins)
        .where(eq(savedViewPins.viewId, req.params.id));

      // Delete the view
      await db
        .delete(savedViews)
        .where(eq(savedViews.id, req.params.id));

      log.info(`Saved view deleted: ${req.params.id} by user ${userId}`);
      res.json({ message: 'View deleted successfully' });
    } catch (error: any) {
      log.error('Failed to delete saved view:', error);
      res.status(500).json({ message: 'Failed to delete saved view' });
    }
  });

  // ─── POST /api/saved-views/:id/clone ──────────────────────────────
  app.post('/api/saved-views/:id/clone', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const [source] = await db
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.id, req.params.id),
            eq(savedViews.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!source) {
        return res.status(404).json({ message: 'View not found' });
      }

      // Check access
      if (source.userId !== userId && source.visibility === 'private') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const cloneName = req.body.name || `${source.name} (Copy)`;

      const [cloned] = await db
        .insert(savedViews)
        .values({
          tenantId,
          userId,
          objectType: source.objectType,
          name: cloneName,
          filterDefinition: source.filterDefinition,
          sortConfig: source.sortConfig,
          columnConfig: source.columnConfig,
          boardConfig: source.boardConfig,
          visibility: 'private',
          isDefault: false,
          isSystemView: false,
        })
        .returning();

      log.info(`Saved view cloned: ${source.id} -> ${cloned.id} by user ${userId}`);
      res.status(201).json(cloned);
    } catch (error: any) {
      log.error('Failed to clone saved view:', error);
      res.status(500).json({ message: 'Failed to clone saved view' });
    }
  });

  // ─── PUT /api/saved-views/:id/pin ─────────────────────────────────
  app.put('/api/saved-views/:id/pin', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const viewId = req.params.id;

      // Check if already pinned
      const [existingPin] = await db
        .select()
        .from(savedViewPins)
        .where(
          and(
            eq(savedViewPins.userId, userId),
            eq(savedViewPins.viewId, viewId),
          ),
        )
        .limit(1);

      if (existingPin) {
        return res.json({ message: 'View already pinned', pin: existingPin });
      }

      // Get max sort order for this user
      const [maxOrder] = await db
        .select({ maxSort: sql<number>`COALESCE(MAX(${savedViewPins.sortOrder}), 0)` })
        .from(savedViewPins)
        .where(eq(savedViewPins.userId, userId));

      const [pin] = await db
        .insert(savedViewPins)
        .values({
          userId,
          viewId,
          sortOrder: (maxOrder?.maxSort ?? 0) + 1,
        })
        .returning();

      res.json(pin);
    } catch (error: any) {
      log.error('Failed to pin saved view:', error);
      res.status(500).json({ message: 'Failed to pin view' });
    }
  });

  // ─── PUT /api/saved-views/:id/unpin ───────────────────────────────
  app.put('/api/saved-views/:id/unpin', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      await db
        .delete(savedViewPins)
        .where(
          and(
            eq(savedViewPins.userId, userId),
            eq(savedViewPins.viewId, req.params.id),
          ),
        );

      res.json({ message: 'View unpinned successfully' });
    } catch (error: any) {
      log.error('Failed to unpin saved view:', error);
      res.status(500).json({ message: 'Failed to unpin view' });
    }
  });

  // ─── PUT /api/saved-views/pins/reorder ────────────────────────────
  app.put('/api/saved-views/pins/reorder', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const reorderSchema = z.object({
        pinOrder: z.array(z.object({
          viewId: z.string(),
          sortOrder: z.number(),
        })),
      });

      const parsed = reorderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      // Update each pin's sort order
      for (const item of parsed.data.pinOrder) {
        await db
          .update(savedViewPins)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(savedViewPins.userId, userId),
              eq(savedViewPins.viewId, item.viewId),
            ),
          );
      }

      res.json({ message: 'Pin order updated' });
    } catch (error: any) {
      log.error('Failed to reorder pins:', error);
      res.status(500).json({ message: 'Failed to reorder pins' });
    }
  });

  log.info('✅ Saved Views routes registered');
}
