import { Router, type Express } from 'express';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { storage } from './storage';

const router = Router();

/**
 * GET /api/chart-of-accounts
 * Get chart of accounts for the current tenant
 */
router.get('/api/chart-of-accounts', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const accounts = await storage.getChartOfAccounts(tenantId);
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching chart of accounts:', error);
    res.status(500).json({ message: 'Failed to fetch chart of accounts' });
  }
});

/**
 * POST /api/chart-of-accounts
 * Create a new chart of accounts entry
 */
router.post('/api/chart-of-accounts', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const accountData = { ...req.body, tenantId };
    const newAccount = await storage.createChartOfAccount(accountData);
    res.status(201).json(newAccount);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ message: 'Failed to create account' });
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
