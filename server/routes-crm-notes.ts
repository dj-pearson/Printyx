/**
 * CRM Notes + Associations API (CRMX-006)
 *
 *   GET    /api/crm/notes?parentType=&parentId=   — notes for a record (pinned first)
 *   POST   /api/crm/notes                          — create a note
 *   PATCH  /api/crm/notes/:id                       — edit body / pin
 *   DELETE /api/crm/notes/:id                       — delete
 *   GET    /api/crm/associations?type=&id=          — links where record is source or target
 *   POST   /api/crm/associations                    — create a link
 *   DELETE /api/crm/associations/:id                — remove a link
 */
import type { Express, Request, Response } from 'express';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import {
  crmNotes,
  crmAssociations,
  insertCrmNoteSchema,
  updateCrmNoteSchema,
  insertCrmAssociationSchema,
  CRM_RECORD_TYPES,
} from '@shared/schema';

const log = createModuleLogger('routes-crm-notes');

export function registerCrmNotesRoutes(app: Express) {
  // ─── Notes ──────────────────────────────────────────────────────────
  app.get('/api/crm/notes', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parentType = req.query.parentType as string | undefined;
      const parentId = req.query.parentId as string | undefined;
      if (!parentType || !parentId) {
        return res.status(400).json({ message: 'parentType and parentId are required' });
      }
      if (!(CRM_RECORD_TYPES as readonly string[]).includes(parentType)) {
        return res.status(400).json({ message: 'Invalid parentType' });
      }

      const rows = await db
        .select()
        .from(crmNotes)
        .where(
          and(
            eq(crmNotes.tenantId, tenantId),
            eq(crmNotes.parentType, parentType),
            eq(crmNotes.parentId, parentId),
          ),
        )
        .orderBy(desc(crmNotes.isPinned), desc(crmNotes.createdAt));

      res.json({ data: rows, total: rows.length });
    } catch (error: any) {
      log.error('Failed to list notes:', error);
      res.status(500).json({ message: 'Failed to list notes', error: error?.message });
    }
  });

  app.post('/api/crm/notes', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = insertCrmNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid note', details: parsed.error.flatten() });
      }

      const [created] = await db
        .insert(crmNotes)
        .values({ ...parsed.data, tenantId, authorId: userId ?? null })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      log.error('Failed to create note:', error);
      res.status(500).json({ message: 'Failed to create note', error: error?.message });
    }
  });

  app.patch('/api/crm/notes/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = updateCrmNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid update', details: parsed.error.flatten() });
      }

      const [updated] = await db
        .update(crmNotes)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(crmNotes.id, req.params.id), eq(crmNotes.tenantId, tenantId)))
        .returning();

      if (!updated) return res.status(404).json({ message: 'Note not found' });
      res.json(updated);
    } catch (error: any) {
      log.error('Failed to update note:', error);
      res.status(500).json({ message: 'Failed to update note', error: error?.message });
    }
  });

  app.delete('/api/crm/notes/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const [deleted] = await db
        .delete(crmNotes)
        .where(and(eq(crmNotes.id, req.params.id), eq(crmNotes.tenantId, tenantId)))
        .returning();

      if (!deleted) return res.status(404).json({ message: 'Note not found' });
      res.json({ success: true });
    } catch (error: any) {
      log.error('Failed to delete note:', error);
      res.status(500).json({ message: 'Failed to delete note', error: error?.message });
    }
  });

  // ─── Associations ───────────────────────────────────────────────────
  app.get('/api/crm/associations', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const type = req.query.type as string | undefined;
      const id = req.query.id as string | undefined;
      if (!type || !id) return res.status(400).json({ message: 'type and id are required' });

      const rows = await db
        .select()
        .from(crmAssociations)
        .where(
          and(
            eq(crmAssociations.tenantId, tenantId),
            or(
              and(eq(crmAssociations.sourceType, type), eq(crmAssociations.sourceId, id)),
              and(eq(crmAssociations.targetType, type), eq(crmAssociations.targetId, id)),
            ),
          ),
        )
        .orderBy(desc(crmAssociations.createdAt));

      res.json({ data: rows, total: rows.length });
    } catch (error: any) {
      log.error('Failed to list associations:', error);
      res.status(500).json({ message: 'Failed to list associations', error: error?.message });
    }
  });

  app.post('/api/crm/associations', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const parsed = insertCrmAssociationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: 'Invalid association', details: parsed.error.flatten() });
      }

      const [created] = await db
        .insert(crmAssociations)
        .values({
          ...parsed.data,
          relation: parsed.data.relation ?? 'related',
          tenantId,
          createdBy: userId ?? null,
        })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'This association already exists' });
      }
      log.error('Failed to create association:', error);
      res.status(500).json({ message: 'Failed to create association', error: error?.message });
    }
  });

  app.delete('/api/crm/associations/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });

      const [deleted] = await db
        .delete(crmAssociations)
        .where(and(eq(crmAssociations.id, req.params.id), eq(crmAssociations.tenantId, tenantId)))
        .returning();

      if (!deleted) return res.status(404).json({ message: 'Association not found' });
      res.json({ success: true });
    } catch (error: any) {
      log.error('Failed to delete association:', error);
      res.status(500).json({ message: 'Failed to delete association', error: error?.message });
    }
  });
}
