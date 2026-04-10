/**
 * Disposable Email Domain Admin Routes
 *
 * Platform-admin CRUD for the disposable email blocklist used by the
 * signup flow. Also exposes a public-safe `check` endpoint the frontend
 * Signup page can call to give users immediate feedback.
 *
 * Endpoints (mounted under /api/admin/disposable-emails and /api/auth):
 *  GET    /api/admin/disposable-emails          - list with search / paging
 *  POST   /api/admin/disposable-emails          - add a single domain
 *  POST   /api/admin/disposable-emails/bulk     - bulk add domains
 *  PATCH  /api/admin/disposable-emails/:id      - toggle / edit a domain
 *  DELETE /api/admin/disposable-emails/:id      - remove a domain
 *  POST   /api/admin/disposable-emails/refresh  - invalidate cache
 *  POST   /api/auth/check-disposable-email      - public check (rate-limited)
 */

import type { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { requireAuth } from './replitAuth';
import { getUserId, isPlatformAdmin } from './utils/auth-helpers';
import {
  insertDisposableEmailDomainSchema,
  updateDisposableEmailDomainSchema,
  bulkInsertDisposableEmailDomainsSchema,
} from '@shared/disposable-email-schema';
import {
  addDomain,
  bulkAddDomains,
  deleteDomain,
  getDomainById,
  invalidateDisposableEmailCache,
  isDisposableEmail,
  listDomains,
  updateDomain,
} from './services/disposable-email-service';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-disposable-emails');

function requirePlatformAdmin(req: Request, res: Response): boolean {
  if (!isPlatformAdmin(req)) {
    res.status(403).json({ message: 'Platform admin access required' });
    return false;
  }
  return true;
}

function zodError(res: Response, err: ZodError): Response {
  return res.status(400).json({
    message: 'Invalid request',
    errors: err.errors,
  });
}

// Rate limit the public check endpoint to prevent using it as an oracle
// for bulk domain probing.
const checkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many email checks. Please slow down.' },
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  blocked: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  source: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const checkSchema = z.object({
  email: z.string().min(3).max(320),
});

export function registerDisposableEmailRoutes(app: Express): void {
  // ─── PUBLIC: Signup-time check ────────────────────────────────────────
  /**
   * POST /api/auth/check-disposable-email
   * Public, rate-limited endpoint the Signup form can call to give the user
   * fast feedback before submitting the whole form. Never leaks the full list.
   */
  app.post('/api/auth/check-disposable-email', checkLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = checkSchema.parse(req.body);
      const result = await isDisposableEmail(email);
      return res.json({
        blocked: result.blocked,
        domain: result.domain,
      });
    } catch (err) {
      if (err instanceof ZodError) return zodError(res, err);
      log.error({ err }, 'Failed to check disposable email');
      return res.status(500).json({ message: 'Failed to check email' });
    }
  });

  // ─── ADMIN: list ──────────────────────────────────────────────────────
  app.get(
    '/api/admin/disposable-emails',
    requireAuth,
    async (req: Request, res: Response) => {
      if (!requirePlatformAdmin(req, res)) return;
      try {
        const query = listQuerySchema.parse(req.query);
        const result = await listDomains(query);
        res.json({
          rows: result.rows,
          total: result.total,
          blockedCount: result.blockedCount,
          allowedCount: result.allowedCount,
          limit: query.limit ?? 50,
          offset: query.offset ?? 0,
        });
      } catch (err) {
        if (err instanceof ZodError) return zodError(res, err);
        log.error({ err }, 'Failed to list disposable email domains');
        res.status(500).json({ message: 'Failed to list domains' });
      }
    },
  );

  // ─── ADMIN: add single ────────────────────────────────────────────────
  app.post('/api/admin/disposable-emails', requireAuth, async (req: Request, res: Response) => {
    if (!requirePlatformAdmin(req, res)) return;
    try {
      const body = insertDisposableEmailDomainSchema.parse(req.body);
      const addedBy = getUserId(req) ?? null;
      const row = await addDomain({
        domain: body.domain,
        isBlocked: body.isBlocked ?? true,
        source: (body.source as 'seed' | 'manual' | 'import' | undefined) ?? 'manual',
        notes: body.notes ?? null,
        addedBy,
      });
      log.info({ domain: row.domain, addedBy }, 'Added disposable email domain');
      res.status(201).json(row);
    } catch (err) {
      if (err instanceof ZodError) return zodError(res, err);
      log.error({ err }, 'Failed to add disposable email domain');
      res.status(500).json({ message: 'Failed to add domain' });
    }
  });

  // ─── ADMIN: bulk add ──────────────────────────────────────────────────
  app.post(
    '/api/admin/disposable-emails/bulk',
    requireAuth,
    async (req: Request, res: Response) => {
      if (!requirePlatformAdmin(req, res)) return;
      try {
        const body = bulkInsertDisposableEmailDomainsSchema.parse(req.body);
        const addedBy = getUserId(req) ?? null;
        const result = await bulkAddDomains(body.domains, {
          source: body.source,
          notes: body.notes ?? null,
          addedBy,
        });
        log.info(
          { count: result.total, inserted: result.inserted, updated: result.updated, addedBy },
          'Bulk added disposable email domains',
        );
        res.json(result);
      } catch (err) {
        if (err instanceof ZodError) return zodError(res, err);
        log.error({ err }, 'Failed to bulk add disposable email domains');
        res.status(500).json({ message: 'Failed to bulk add domains' });
      }
    },
  );

  // ─── ADMIN: update (toggle / edit notes) ──────────────────────────────
  app.patch(
    '/api/admin/disposable-emails/:id',
    requireAuth,
    async (req: Request, res: Response) => {
      if (!requirePlatformAdmin(req, res)) return;
      try {
        const id = req.params.id;
        const patch = updateDisposableEmailDomainSchema.parse(req.body);
        const updatedBy = getUserId(req) ?? null;
        const existing = await getDomainById(id);
        if (!existing) {
          return res.status(404).json({ message: 'Domain not found' });
        }
        const row = await updateDomain(id, {
          isBlocked: patch.isBlocked,
          notes: patch.notes,
          updatedBy,
        });
        log.info({ id, patch, updatedBy }, 'Updated disposable email domain');
        res.json(row);
      } catch (err) {
        if (err instanceof ZodError) return zodError(res, err);
        log.error({ err }, 'Failed to update disposable email domain');
        res.status(500).json({ message: 'Failed to update domain' });
      }
    },
  );

  // ─── ADMIN: delete ────────────────────────────────────────────────────
  app.delete(
    '/api/admin/disposable-emails/:id',
    requireAuth,
    async (req: Request, res: Response) => {
      if (!requirePlatformAdmin(req, res)) return;
      try {
        const id = req.params.id;
        const deletedBy = getUserId(req) ?? null;
        const existing = await getDomainById(id);
        if (!existing) {
          return res.status(404).json({ message: 'Domain not found' });
        }
        const removed = await deleteDomain(id);
        if (!removed) {
          return res.status(404).json({ message: 'Domain not found' });
        }
        log.info({ id, domain: existing.domain, deletedBy }, 'Deleted disposable email domain');
        res.status(204).end();
      } catch (err) {
        log.error({ err }, 'Failed to delete disposable email domain');
        res.status(500).json({ message: 'Failed to delete domain' });
      }
    },
  );

  // ─── ADMIN: refresh cache ─────────────────────────────────────────────
  app.post(
    '/api/admin/disposable-emails/refresh',
    requireAuth,
    async (req: Request, res: Response) => {
      if (!requirePlatformAdmin(req, res)) return;
      invalidateDisposableEmailCache();
      res.json({ message: 'Cache invalidated' });
    },
  );
}
