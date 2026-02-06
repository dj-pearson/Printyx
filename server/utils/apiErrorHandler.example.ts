/**
 * API Error Handler Usage Examples
 *
 * This file demonstrates how to use the standardized error handling utilities
 * across all API routes for consistent error responses.
 */

import { Request, Response } from 'express';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('apiErrorHandler.example');

import {
  handleApiError,
  sendSuccess,
  ApiErrorHandlers,
  asyncHandler,
  validateRequiredFields,
  ErrorCodes,
} from './apiErrorHandler';

// =============================================================================
// EXAMPLE 1: Basic error handling
// =============================================================================

export async function getCustomerById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, parseInt(id)),
    });

    if (!customer) {
      return ApiErrorHandlers.notFound(res, 'Customer');
    }

    return sendSuccess(res, customer, 'Customer retrieved successfully');
  } catch (error) {
    return handleApiError(res, error, 'retrieve customer');
  }
}

// =============================================================================
// EXAMPLE 2: Using async handler wrapper (recommended)
// =============================================================================

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone } = req.body;

  // Validate required fields
  if (!validateRequiredFields(req.body, ['name', 'email'], res)) {
    return; // validateRequiredFields already sent error response
  }

  // Check for duplicate
  const existing = await db.query.customers.findFirst({
    where: eq(customers.email, email),
  });

  if (existing) {
    return ApiErrorHandlers.conflict(res, 'Customer with this email');
  }

  const newCustomer = await db
    .insert(customers)
    .values({
      name,
      email,
      phone,
    })
    .returning();

  return sendSuccess(res, newCustomer[0], 'Customer created successfully', 201);
});

// =============================================================================
// EXAMPLE 3: Database operation with specific error handling
// =============================================================================

export async function updateCustomer(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await db
      .update(customers)
      .set(updates)
      .where(eq(customers.id, parseInt(id)))
      .returning();

    if (!result.length) {
      return ApiErrorHandlers.notFound(res, 'Customer');
    }

    return sendSuccess(res, result[0], 'Customer updated successfully');
  } catch (error) {
    // Specific database error handling
    return ApiErrorHandlers.database(res, 'update customer', error);
  }
}

// =============================================================================
// EXAMPLE 4: External service integration
// =============================================================================

export async function syncWithQuickBooks(req: Request, res: Response) {
  try {
    const { customerId } = req.params;

    // Call external API
    const response = await fetch(`https://api.quickbooks.com/v3/customer/${customerId}`);

    if (!response.ok) {
      return ApiErrorHandlers.externalService(
        res,
        'QuickBooks',
        new Error(`QuickBooks API returned ${response.status}`),
      );
    }

    const data = await response.json();
    return sendSuccess(res, data, 'QuickBooks sync completed');
  } catch (error) {
    return ApiErrorHandlers.externalService(res, 'QuickBooks', error);
  }
}

// =============================================================================
// EXAMPLE 5: Authentication/Authorization
// =============================================================================

export async function getProtectedResource(req: Request, res: Response) {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return ApiErrorHandlers.unauthorized(res, 'Authentication required');
    }

    // Check permissions
    if (!req.user.permissions.includes('admin')) {
      return ApiErrorHandlers.forbidden(res, 'Admin access required');
    }

    const data = await fetchProtectedData();
    return sendSuccess(res, data);
  } catch (error) {
    return handleApiError(res, error, 'access protected resource');
  }
}

// =============================================================================
// EXAMPLE 6: Custom validation with detailed error
// =============================================================================

export async function createInvoice(req: Request, res: Response) {
  try {
    const { customerId, items, total } = req.body;

    // Custom validation
    if (!items || items.length === 0) {
      return ApiErrorHandlers.validation(res, 'Invoice must contain at least one item');
    }

    if (total <= 0) {
      return ApiErrorHandlers.validation(res, 'Invoice total must be greater than zero');
    }

    // Calculate actual total
    const calculatedTotal = items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.price,
      0,
    );

    if (Math.abs(calculatedTotal - total) > 0.01) {
      return handleApiError(
        res,
        new Error(`Total mismatch: expected ${calculatedTotal}, got ${total}`),
        'validate invoice total',
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const invoice = await createInvoiceInDb({ customerId, items, total });
    return sendSuccess(res, invoice, 'Invoice created successfully', 201);
  } catch (error) {
    return handleApiError(res, error, 'create invoice');
  }
}

// =============================================================================
// EXAMPLE 7: Using in Express routes
// =============================================================================

import { Router } from 'express';

const router = Router();

// Method 1: Direct usage
router.get('/customers/:id', getCustomerById);

// Method 2: With async handler (recommended for all async routes)
router.post('/customers', createCustomer);
router.put('/customers/:id', asyncHandler(updateCustomer));

// Method 3: Inline with async handler
router.delete(
  '/customers/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await db
      .delete(customers)
      .where(eq(customers.id, parseInt(id)))
      .returning();

    if (!result.length) {
      return ApiErrorHandlers.notFound(res, 'Customer');
    }

    return sendSuccess(res, { deleted: true }, 'Customer deleted successfully');
  }),
);

export default router;

// =============================================================================
// BEFORE AND AFTER COMPARISON
// =============================================================================

// ❌ BEFORE (inconsistent, unclear):
/*
export async function oldGetCustomer(req: Request, res: Response) {
  try {
    const customer = await findCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Not found' });
    }
    return res.json(customer);
  } catch (error) {
    log.error('Error:', error);
    return res.status(500).json({ message: 'Failed to get customer' });
  }
}
*/

// ✅ AFTER (consistent, clear, trackable):
/*
export const newGetCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await findCustomer(req.params.id);

  if (!customer) {
    return ApiErrorHandlers.notFound(res, 'Customer');
  }

  return sendSuccess(res, customer, 'Customer retrieved successfully');
});
*/

// Response format:
// {
//   "success": false,
//   "message": "Failed to find Customer",
//   "error": "Customer not found",
//   "errorCode": "RES_001",
//   "timestamp": "2025-11-09T10:30:45.123Z"
// }
