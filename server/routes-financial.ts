import { Router, type Express, type Request } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { storage } from './storage';
import { db } from './db';
import { journalEntries } from '@shared/journal-entries-schema';
import { AuthenticationError, AuthorizationError } from './lib/api-errors';

const router = Router();

// PA-045: journal-entry payload. Debits must equal credits (balanced GL entry).
const journalEntryFields = z.object({
  entryNumber: z.string().min(1, 'Entry number is required'),
  description: z.string().min(1, 'Description is required'),
  entryDate: z.string().min(1, 'Entry date is required'),
  reference: z.string().optional(),
  totalDebit: z.coerce.number().min(0),
  totalCredit: z.coerce.number().min(0),
  status: z.string().default('draft'),
});
const journalEntryInput = journalEntryFields.refine(
  (d) => Math.abs(d.totalDebit - d.totalCredit) < 0.005,
  { message: 'Total debits must equal total credits', path: ['totalCredit'] },
);

/**
 * GET /api/chart-of-accounts
 * Get chart of accounts for the current tenant
 */
router.get('/api/chart-of-accounts', async (req: Request, res, next) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      throw new AuthenticationError();
    }
    if (!tenantId) {
      throw new AuthorizationError('Tenant context required');
    }

    const accounts = await storage.getChartOfAccounts(tenantId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chart-of-accounts
 * Create a new chart of accounts entry
 */
router.post('/api/chart-of-accounts', async (req: Request, res, next) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      throw new AuthenticationError();
    }
    if (!tenantId) {
      throw new AuthorizationError('Tenant context required');
    }

    const accountData = { ...req.body, tenantId };
    const newAccount = await storage.createChartOfAccount(accountData);
    res.status(201).json(newAccount);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/journal-entries — list the tenant's journal entries (PA-045).
 */
router.get('/api/journal-entries', async (req: Request, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) throw new AuthorizationError('Tenant context required');
    const entries = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.tenantId, tenantId))
      .orderBy(desc(journalEntries.createdAt));
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/journal-entries/:id — fetch one (tenant-scoped).
 */
router.get('/api/journal-entries/:id', async (req: Request, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) throw new AuthorizationError('Tenant context required');
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.tenantId, tenantId)))
      .limit(1);
    if (!entry) return res.status(404).json({ message: 'Journal entry not found' });
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/journal-entries — create a balanced journal entry (tenant + creator
 * are injected server-side; debits must equal credits).
 */
router.post('/api/journal-entries', async (req: Request, res, next) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);
    if (!userId) throw new AuthenticationError();
    if (!tenantId) throw new AuthorizationError('Tenant context required');

    const parsed = journalEntryInput.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid journal entry', errors: parsed.error.flatten().fieldErrors });
    }

    const [created] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        entryNumber: parsed.data.entryNumber,
        description: parsed.data.description,
        entryDate: parsed.data.entryDate,
        reference: parsed.data.reference,
        totalDebit: String(parsed.data.totalDebit),
        totalCredit: String(parsed.data.totalCredit),
        status: parsed.data.status,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/journal-entries/:id — update a journal entry (tenant-scoped).
 */
router.patch('/api/journal-entries/:id', async (req: Request, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) throw new AuthorizationError('Tenant context required');

    const parsed = journalEntryFields.partial().safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid journal entry', errors: parsed.error.flatten().fieldErrors });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ['entryNumber', 'description', 'entryDate', 'reference', 'status'] as const) {
      if (parsed.data[k] !== undefined) patch[k] = parsed.data[k];
    }
    if (parsed.data.totalDebit !== undefined) patch.totalDebit = String(parsed.data.totalDebit);
    if (parsed.data.totalCredit !== undefined) patch.totalCredit = String(parsed.data.totalCredit);

    const [updated] = await db
      .update(journalEntries)
      .set(patch)
      .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.tenantId, tenantId)))
      .returning();

    if (!updated) return res.status(404).json({ message: 'Journal entry not found' });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/journal-entries/:id — delete a journal entry (tenant-scoped).
 */
router.delete('/api/journal-entries/:id', async (req: Request, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) throw new AuthorizationError('Tenant context required');
    const [deleted] = await db
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, req.params.id), eq(journalEntries.tenantId, tenantId)))
      .returning();
    if (!deleted) return res.status(404).json({ message: 'Journal entry not found' });
    res.json({ message: 'Journal entry deleted' });
  } catch (error) {
    next(error);
  }
});

export function registerFinancialRoutes(app: Express) {
  app.use(router);
}

export default router;
