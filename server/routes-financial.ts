import { Router, type Express } from 'express';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { storage } from './storage';
import { AuthenticationError, AuthorizationError } from './lib/api-errors';

const router = Router();

/**
 * GET /api/chart-of-accounts
 * Get chart of accounts for the current tenant
 */
router.get('/api/chart-of-accounts', async (req: any, res, next) => {
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
router.post('/api/chart-of-accounts', async (req: any, res, next) => {
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
 * ALL /api/journal-entries
 * Journal entries management (temporarily disabled; storage methods not implemented)
 * Returns 501 Not Implemented
 */
router.all(['/api/journal-entries', '/api/journal-entries/:id'], (_req, res) => {
  res.status(501).json({ message: 'Journal entries API not implemented' });
});

export function registerFinancialRoutes(app: Express) {
  app.use(router);
}

export default router;
