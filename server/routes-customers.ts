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

const router = Router();

/**
 * POST /api/customers
 * Create a new customer record
 *
 * Auth: Requires authentication (handled by global middleware)
 * Tenant: Requires tenant context
 */
router.post('/api/customers', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(403).json({
        message: 'Tenant context required',
        code: 'NO_TENANT',
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate and parse request body
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
    console.error('Error creating customer:', error);

    // Handle validation errors from Zod
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        message: 'Invalid customer data',
        errors: error.message,
      });
    }

    res.status(500).json({ message: 'Failed to create customer' });
  }
});

/**
 * Register customer routes with Express app
 */
export function registerCustomerRoutes(app: Express) {
  app.use(router);
}

export default router;
