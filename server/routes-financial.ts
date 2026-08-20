import { Router, type Express, type Request } from 'express';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { storage } from './storage';
import { AuthenticationError, AuthorizationError } from './lib/api-errors';

const router = Router();

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

// ── journal-entries: RETIRED (PROD-008) ─────────────────────────────────────
//
// The five /api/journal-entries handlers that lived here (GET list, GET /:id,
// POST, PATCH /:id, DELETE /:id) are gone. registerEdgeFunctionProxy runs at
// routes-registry.ts:345, before registerFinancialRoutes at :674, and now
// forwards the whole /api/journal-entries prefix to
// supabase/functions/journal-entries - which is what production has always hit
// directly. Keeping a second implementation here is what made this domain
// both-divergent: dev and prod ran different code, and the edge copy was the
// broken one nobody was testing.
//
// The PA-045 validation rules those handlers carried are not lost. They live in
// supabase/functions/_shared/journal-entry-contract.ts, and
// server/tests/unit/journal-entry-contract-parity.test.ts re-declares the zod
// schema verbatim and asserts the two agree over a fixture matrix.
//
// /api/chart-of-accounts above is NOT proxied and still runs here.

export function registerFinancialRoutes(app: Express) {
  app.use(router);
}

export default router;
