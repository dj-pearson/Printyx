/**
 * Web Forms admin API (CRMX-011).
 *
 * Tenant-scoped CRUD for form definitions plus a read view of captured
 * submissions. The PUBLIC capture endpoint (unauthenticated) lives in the
 * `public-forms` edge function; submissions are turned into leads by
 * server/services/web-form-processor.ts.
 */
import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { webForms, webFormSubmissions, insertWebFormSchema } from '@shared/schema';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { parseListLimit } from './lib/pagination';

const log = createModuleLogger('routes-web-forms');
const router = Router();

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'form'
  );
}

// GET /api/web-forms — list forms for the tenant
router.get('/api/web-forms', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
    const forms = await db
      .select()
      .from(webForms)
      .where(eq(webForms.tenantId, tenantId))
      .orderBy(desc(webForms.updatedAt));
    res.json(forms);
  } catch (error) {
    log.error('Error listing web forms:', error);
    res.status(500).json({ message: 'Failed to list web forms' });
  }
});

// POST /api/web-forms — create a form
router.post('/api/web-forms', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    if (!tenantId || !userId)
      return res.status(400).json({ message: 'Tenant ID and User ID are required' });

    const parsed = insertWebFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors });
    }

    const slug = `${slugify(parsed.data.name)}-${randomBytes(3).toString('hex')}`;
    const publicToken = randomBytes(24).toString('hex');

    const [form] = await db
      .insert(webForms)
      .values({
        ...parsed.data,
        slug,
        tenantId,
        publicToken,
        createdBy: userId,
      })
      .returning();
    res.status(201).json(form);
  } catch (error) {
    log.error('Error creating web form:', error);
    res.status(500).json({ message: 'Failed to create web form' });
  }
});

// GET /api/web-forms/:id — get a form
router.get('/api/web-forms/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
    const [form] = await db
      .select()
      .from(webForms)
      .where(and(eq(webForms.id, req.params.id), eq(webForms.tenantId, tenantId)))
      .limit(1);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    res.json(form);
  } catch (error) {
    log.error('Error fetching web form:', error);
    res.status(500).json({ message: 'Failed to fetch web form' });
  }
});

// PUT /api/web-forms/:id — update a form
router.put('/api/web-forms/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

    const [existing] = await db
      .select()
      .from(webForms)
      .where(and(eq(webForms.id, req.params.id), eq(webForms.tenantId, tenantId)))
      .limit(1);
    if (!existing) return res.status(404).json({ message: 'Form not found' });

    const parsed = insertWebFormSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors });
    }

    const [updated] = await db
      .update(webForms)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(webForms.id, req.params.id), eq(webForms.tenantId, tenantId)))
      .returning();
    res.json(updated);
  } catch (error) {
    log.error('Error updating web form:', error);
    res.status(500).json({ message: 'Failed to update web form' });
  }
});

// DELETE /api/web-forms/:id — delete a form
router.delete('/api/web-forms/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
    const deleted = await db
      .delete(webForms)
      .where(and(eq(webForms.id, req.params.id), eq(webForms.tenantId, tenantId)))
      .returning({ id: webForms.id });
    if (deleted.length === 0) return res.status(404).json({ message: 'Form not found' });
    res.json({ success: true });
  } catch (error) {
    log.error('Error deleting web form:', error);
    res.status(500).json({ message: 'Failed to delete web form' });
  }
});

// GET /api/web-forms/:id/submissions — list submissions for a form
router.get('/api/web-forms/:id/submissions', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
    const limit = parseListLimit(req.query.limit, { def: 100 });
    if (limit === null) return res.status(400).json({ message: 'Invalid limit parameter' });

    const submissions = await db
      .select()
      .from(webFormSubmissions)
      .where(
        and(
          eq(webFormSubmissions.formId, req.params.id),
          eq(webFormSubmissions.tenantId, tenantId),
        ),
      )
      .orderBy(desc(webFormSubmissions.createdAt))
      .limit(limit);
    res.json(submissions);
  } catch (error) {
    log.error('Error listing form submissions:', error);
    res.status(500).json({ message: 'Failed to list submissions' });
  }
});

export default router;
