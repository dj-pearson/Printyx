/**
 * Miscellaneous Stub Routes
 *
 * Placeholder routes for features that need implementation.
 * These prevent frontend errors while features are being developed.
 */

import { Router, type Express } from 'express';
import { requireAuth } from './replitAuth';
import { getTenantId } from './utils/auth-helpers';
import { AuthenticationError } from './lib/api-errors';

// NOTE: The /api/customer-access and /api/bug-reports stub routers were removed
// in EDGE-005g. They only ever returned hardcoded zeros (never functional), the
// customer-access frontend page was deleted, and nothing in the frontend called
// /api/bug-reports (the error boundary logs locally via mobileLogger). Only the
// service-analytics stub remains because ServiceHub + role dashboards consume it.

// Service Analytics Routes
const serviceAnalyticsRouter = Router();

serviceAnalyticsRouter.get('/', requireAuth, async (req: any, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      throw new AuthenticationError();
    }

    // TODO: Implement actual service analytics
    res.json({
      overview: {
        totalTickets: 0,
        openTickets: 0,
        closedTickets: 0,
        avgResolutionTime: 0,
        customerSatisfaction: 0,
      },
      trends: [],
      technicians: [],
      categories: [],
    });
  } catch (error) {
    next(error);
  }
});

serviceAnalyticsRouter.get('/trends', requireAuth, async (req: any, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      throw new AuthenticationError();
    }

    res.json({
      period: req.query.period || 'month',
      data: [],
    });
  } catch (error) {
    next(error);
  }
});

// Export registration function
export function registerMiscStubRoutes(app: Express) {
  app.use('/api/service-analytics', serviceAnalyticsRouter);
}

export { serviceAnalyticsRouter };
