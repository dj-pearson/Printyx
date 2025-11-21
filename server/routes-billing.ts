import { Router } from 'express';
import { db } from './db';
import {
  subscriptionPaymentMethods,
  billingHistory,
  tenantSubscriptions,
  tenants,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { StripeService, stripe } from './services/stripe-service';

/**
 * BILLING ROUTES
 *
 * API endpoints for managing payment methods, invoices, and billing information.
 */

const router = Router();

// Billing address schema
const billingAddressSchema = z.object({
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default("US"),
});

// Middleware to ensure tenant context
const requireTenantContext = (req: any, res: any, next: any) => {
  if (!req.tenantId && !req.user?.tenantId) {
    return res.status(401).json({ error: 'No tenant context' });
  }
  req.tenantId = req.tenantId || req.user?.tenantId;
  next();
};

// ============================================================================
// PAYMENT METHODS
// ============================================================================

/**
 * GET /api/billing/payment-methods
 * List all payment methods for the tenant
 */
router.get('/payment-methods', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    const paymentMethods = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(eq(subscriptionPaymentMethods.tenantId, tenantId))
      .orderBy(desc(subscriptionPaymentMethods.isDefault), desc(subscriptionPaymentMethods.createdAt));

    res.json(paymentMethods);
  } catch (error) {
    console.error('Failed to fetch payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * POST /api/billing/payment-methods
 * Add a new payment method via Stripe
 */
router.post('/payment-methods', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { paymentMethodId, billingDetails } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    if (!StripeService.isConfigured()) {
      return res.status(501).json({
        error: 'Stripe is not configured',
        message: 'Please set STRIPE_SECRET_KEY environment variable',
      });
    }

    // Get or create Stripe customer for tenant
    const stripeCustomerId = await StripeService.getOrCreateCustomer(tenantId);

    // Attach payment method to customer
    const paymentMethod = await StripeService.addPaymentMethod({
      stripeCustomerId,
      paymentMethodId,
      setAsDefault: true,
    });

    // Check if this is the first payment method
    const existingMethods = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(eq(subscriptionPaymentMethods.tenantId, tenantId));

    const isFirst = existingMethods.length === 0;

    // Store payment method in database
    const [newPaymentMethod] = await db
      .insert(subscriptionPaymentMethods)
      .values({
        tenantId,
        provider: 'stripe',
        stripePaymentMethodId: paymentMethod.id,
        cardBrand: paymentMethod.card?.brand || '',
        cardLast4: paymentMethod.card?.last4 || '',
        cardExpMonth: paymentMethod.card?.exp_month || 0,
        cardExpYear: paymentMethod.card?.exp_year || 0,
        isDefault: isFirst,
        billingDetails: billingDetails || paymentMethod.billing_details,
      })
      .returning();

    res.json({
      message: 'Payment method added successfully',
      paymentMethod: newPaymentMethod,
    });
  } catch (error: any) {
    console.error('Failed to add payment method:', error);
    res.status(500).json({
      error: 'Failed to add payment method',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/billing/payment-methods/:id
 * Remove a payment method
 */
router.delete('/payment-methods/:id', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const paymentMethodId = req.params.id;

    // Verify payment method belongs to tenant
    const [paymentMethod] = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(
        and(
          eq(subscriptionPaymentMethods.id, paymentMethodId),
          eq(subscriptionPaymentMethods.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Don't allow deleting the default payment method if it's the only one
    if (paymentMethod.isDefault) {
      const allMethods = await db
        .select()
        .from(subscriptionPaymentMethods)
        .where(eq(subscriptionPaymentMethods.tenantId, tenantId));

      if (allMethods.length === 1) {
        return res.status(400).json({
          error: 'Cannot delete the only payment method',
          message: 'Add another payment method before deleting this one',
        });
      }
    }

    // Remove from Stripe if configured
    if (StripeService.isConfigured() && paymentMethod.stripePaymentMethodId) {
      try {
        await StripeService.removePaymentMethod(paymentMethod.stripePaymentMethodId);
      } catch (error) {
        console.error('Failed to remove from Stripe:', error);
        // Continue with database deletion even if Stripe fails
      }
    }

    // Delete the payment method from database
    await db
      .delete(subscriptionPaymentMethods)
      .where(eq(subscriptionPaymentMethods.id, paymentMethodId));

    // If it was the default, set another one as default
    if (paymentMethod.isDefault) {
      const [nextMethod] = await db
        .select()
        .from(subscriptionPaymentMethods)
        .where(eq(subscriptionPaymentMethods.tenantId, tenantId))
        .limit(1);

      if (nextMethod) {
        await db
          .update(subscriptionPaymentMethods)
          .set({ isDefault: true })
          .where(eq(subscriptionPaymentMethods.id, nextMethod.id));
      }
    }

    res.json({ message: 'Payment method deleted successfully' });
  } catch (error) {
    console.error('Failed to delete payment method:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// ============================================================================
// INVOICES
// ============================================================================

/**
 * GET /api/billing/invoices
 * List all invoices for the tenant
 */
router.get('/invoices', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    const invoices = await db
      .select()
      .from(billingHistory)
      .where(eq(billingHistory.tenantId, tenantId))
      .orderBy(desc(billingHistory.invoiceDate));

    res.json(invoices);
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/billing/invoices/:id/pdf
 * Download invoice PDF
 */
router.get('/invoices/:id/pdf', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const invoiceId = req.params.id;

    // Verify invoice belongs to tenant
    const [invoice] = await db
      .select()
      .from(billingHistory)
      .where(
        and(
          eq(billingHistory.id, invoiceId),
          eq(billingHistory.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // For now, return a placeholder message
    // This will be implemented when PDF generation is added
    res.status(501).json({
      error: 'PDF download not yet implemented',
      message: 'Invoice PDF generation will be added in a future update',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
      },
    });
  } catch (error) {
    console.error('Failed to download invoice:', error);
    res.status(500).json({ error: 'Failed to download invoice' });
  }
});

// ============================================================================
// BILLING INFORMATION
// ============================================================================

/**
 * GET /api/billing/info
 * Get billing address and information
 */
router.get('/info', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    // Get the tenant's subscription to find billing details
    const [subscription] = await db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .limit(1);

    if (!subscription) {
      return res.json(null);
    }

    // Get default payment method for billing details
    const [paymentMethod] = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(
        and(
          eq(subscriptionPaymentMethods.tenantId, tenantId),
          eq(subscriptionPaymentMethods.isDefault, true)
        )
      )
      .limit(1);

    const billingDetails = paymentMethod?.billingDetails as any;

    res.json(billingDetails || null);
  } catch (error) {
    console.error('Failed to fetch billing info:', error);
    res.status(500).json({ error: 'Failed to fetch billing info' });
  }
});

/**
 * PUT /api/billing/address
 * Update billing address
 */
router.put('/address', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const addressData = billingAddressSchema.parse(req.body);

    // Update the default payment method's billing details
    const [paymentMethod] = await db
      .select()
      .from(subscriptionPaymentMethods)
      .where(
        and(
          eq(subscriptionPaymentMethods.tenantId, tenantId),
          eq(subscriptionPaymentMethods.isDefault, true)
        )
      )
      .limit(1);

    if (!paymentMethod) {
      return res.status(404).json({
        error: 'No default payment method found',
        message: 'Add a payment method before updating billing address',
      });
    }

    await db
      .update(subscriptionPaymentMethods)
      .set({
        billingDetails: addressData,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPaymentMethods.id, paymentMethod.id));

    res.json({
      message: 'Billing address updated successfully',
      billingDetails: addressData,
    });
  } catch (error) {
    console.error('Failed to update billing address:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid billing address data',
        details: error.errors,
      });
    }
    res.status(500).json({ error: 'Failed to update billing address' });
  }
});

// ============================================================================
// STRIPE INTEGRATION
// ============================================================================

/**
 * GET /api/billing/stripe/config
 * Get Stripe publishable key for frontend
 */
router.get('/stripe/config', (req: any, res) => {
  try {
    if (!StripeService.isConfigured()) {
      return res.status(501).json({
        error: 'Stripe not configured',
        configured: false,
      });
    }

    const publishableKey = StripeService.getPublishableKey();
    res.json({
      publishableKey,
      configured: true,
    });
  } catch (error: any) {
    console.error('Failed to get Stripe config:', error);
    res.status(500).json({
      error: 'Failed to get Stripe configuration',
      message: error.message,
    });
  }
});

/**
 * POST /api/billing/stripe/setup-intent
 * Create a setup intent for adding payment methods
 */
router.post('/stripe/setup-intent', requireTenantContext, async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    if (!StripeService.isConfigured() || !stripe) {
      return res.status(501).json({
        error: 'Stripe not configured',
      });
    }

    // Get or create Stripe customer
    const stripeCustomerId = await StripeService.getOrCreateCustomer(tenantId);

    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: {
        tenantId,
      },
    });

    res.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Failed to create setup intent:', error);
    res.status(500).json({
      error: 'Failed to create setup intent',
      message: error.message,
    });
  }
});

/**
 * POST /api/billing/stripe/webhooks
 * Handle Stripe webhook events
 */
router.post('/stripe/webhooks', async (req: any, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Verify and construct event
    const event = StripeService.constructWebhookEvent(
      req.body,
      signature,
      webhookSecret
    );

    // Handle the event
    await StripeService.handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({
      error: 'Webhook processing failed',
      message: error.message,
    });
  }
});

export default router;
