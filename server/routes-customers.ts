/**
 * Customer Routes
 * Handles customer creation and management endpoints
 *
 * NOTE: Most customer routes use the unified business-records system.
 * This file contains legacy customer-specific endpoints.
 */

import { Router, type Express } from 'express';
import { storage } from './storage';
import { insertCustomerSchema } from '@shared/schema';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { AuthenticationError, AuthorizationError } from './lib/api-errors';

const router = Router();

/**
 * POST /api/customers
 * Create a new customer record
 *
 * Auth: Requires authentication (handled by global middleware)
 * Tenant: Requires tenant context
 */
router.post('/api/customers', async (req: any, res, next) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!tenantId) {
      throw new AuthorizationError('Tenant context required');
    }

    if (!userId) {
      throw new AuthenticationError();
    }

    // Validate and parse request body (ZodError caught by global error handler)
    const validatedData = insertCustomerSchema.parse({
      ...req.body,
      tenantId: tenantId,
      createdBy: userId,
      recordType: 'customer', // Ensure it's created as a customer, not a lead
      // Convert string fields to appropriate types
      probability: req.body.probability ? parseFloat(req.body.probability) : null,
      estimatedDealValue: req.body.estimatedDealValue
        ? parseFloat(req.body.estimatedDealValue)
        : null,
    });

    // Create customer via storage layer
    const customer = await storage.createCustomer(validatedData);

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

/**
 * Register customer routes with Express app
 */
export function registerCustomerRoutes(app: Express) {
  app.use(router);
}

export default router;
