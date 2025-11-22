import Stripe from 'stripe';
import { db } from '../db';
import { tenants, tenantSubscriptions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * STRIPE PAYMENT SERVICE
 *
 * Handles all Stripe integration including customer creation,
 * payment methods, subscriptions, and webhook processing.
 */

// Initialize Stripe with API key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn(
    '⚠️  STRIPE_SECRET_KEY not found in environment. Stripe integration will be in test mode.',
  );
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    })
  : null;

export interface CreateCustomerParams {
  tenantId: string;
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface AddPaymentMethodParams {
  stripeCustomerId: string;
  paymentMethodId: string;
  setAsDefault?: boolean;
}

export interface CreateSubscriptionParams {
  stripeCustomerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export class StripeService {
  /**
   * Check if Stripe is configured
   */
  static isConfigured(): boolean {
    return !!stripe;
  }

  /**
   * Create a Stripe customer for a tenant
   */
  static async createCustomer(params: CreateCustomerParams): Promise<string> {
    if (!stripe) {
      throw new Error(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
      );
    }

    const { tenantId, email, name, phone, metadata = {} } = params;

    // Check if customer already exists
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: name || tenant.name,
      phone,
      metadata: {
        tenantId,
        ...metadata,
      },
    });

    // Update tenant with Stripe customer ID
    await db
      .update(tenants)
      .set({
        metadata: {
          ...((tenant.metadata as any) || {}),
          stripeCustomerId: customer.id,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    console.log(`✅ Created Stripe customer ${customer.id} for tenant ${tenantId}`);
    return customer.id;
  }

  /**
   * Get or create Stripe customer for tenant
   */
  static async getOrCreateCustomer(tenantId: string, userEmail?: string): Promise<string> {
    // Check if customer already exists
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const tenantMetadata = (tenant.metadata as any) || {};
    if (tenantMetadata.stripeCustomerId) {
      return tenantMetadata.stripeCustomerId;
    }

    // Get admin user email if not provided
    let email = userEmail;
    if (!email) {
      const adminUser = await db.query.users.findFirst({
        where: eq(users.tenantId, tenantId),
      });
      email = adminUser?.email || `tenant-${tenantId}@printyx.com`;
    }

    // Create new customer
    return await this.createCustomer({
      tenantId,
      email,
      name: tenant.name,
    });
  }

  /**
   * Attach payment method to customer
   */
  static async addPaymentMethod(params: AddPaymentMethodParams): Promise<Stripe.PaymentMethod> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const { stripeCustomerId, paymentMethodId, setAsDefault = true } = params;

    // Attach payment method to customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    // Set as default if requested
    if (setAsDefault) {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    console.log(`✅ Added payment method ${paymentMethodId} to customer ${stripeCustomerId}`);
    return paymentMethod;
  }

  /**
   * Remove payment method
   */
  static async removePaymentMethod(paymentMethodId: string): Promise<void> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    console.log(`✅ Removed payment method ${paymentMethodId}`);
  }

  /**
   * List payment methods for customer
   */
  static async listPaymentMethods(stripeCustomerId: string): Promise<Stripe.PaymentMethod[]> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    return paymentMethods.data;
  }

  /**
   * Create a subscription in Stripe
   */
  static async createSubscription(params: CreateSubscriptionParams): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const { stripeCustomerId, priceId, trialDays = 0, metadata = {} } = params;

    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    };

    // Add trial if specified
    if (trialDays > 0) {
      subscriptionParams.trial_period_days = trialDays;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    console.log(
      `✅ Created Stripe subscription ${subscription.id} for customer ${stripeCustomerId}`,
    );
    return subscription;
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    immediate: boolean = false,
  ): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    if (immediate) {
      return await stripe.subscriptions.cancel(subscriptionId);
    } else {
      // Cancel at period end
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * Update subscription
   */
  static async updateSubscription(
    subscriptionId: string,
    priceId: string,
  ): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
    });
  }

  /**
   * Create a payment intent for one-time payment
   */
  static async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const params: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: metadata || {},
    };

    if (customerId) {
      params.customer = customerId;
    }

    return await stripe.paymentIntents.create(params);
  }

  /**
   * Retrieve a payment intent
   */
  static async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    return await stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * List invoices for customer
   */
  static async listInvoices(
    stripeCustomerId: string,
    limit: number = 12,
  ): Promise<Stripe.Invoice[]> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit,
    });

    return invoices.data;
  }

  /**
   * Retrieve an invoice
   */
  static async retrieveInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    return await stripe.invoices.retrieve(invoiceId);
  }

  /**
   * Construct webhook event from request
   */
  static constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    console.log(`📨 Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.detached':
        await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log(`⚠️  Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Webhook handler: Subscription created
   */
  private static async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const tenantId = subscription.metadata.tenantId;

    if (!tenantId) {
      console.error('❌ No tenantId in subscription metadata');
      return;
    }

    console.log(`✅ Subscription created for tenant ${tenantId}`);
    // Additional logic can be added here
  }

  /**
   * Webhook handler: Subscription updated
   */
  private static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata.tenantId;

    if (!tenantId) {
      console.error('❌ No tenantId in subscription metadata');
      return;
    }

    // Update subscription status in database
    await db
      .update(tenantSubscriptions)
      .set({
        status: this.mapStripeStatus(subscription.status),
        updatedAt: new Date(),
      })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    console.log(`✅ Subscription updated for tenant ${tenantId}: status=${subscription.status}`);
  }

  /**
   * Webhook handler: Subscription deleted
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata.tenantId;

    if (!tenantId) {
      console.error('❌ No tenantId in subscription metadata');
      return;
    }

    await db
      .update(tenantSubscriptions)
      .set({
        status: 'canceled',
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    console.log(`✅ Subscription deleted for tenant ${tenantId}`);
  }

  /**
   * Webhook handler: Invoice paid
   */
  private static async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    console.log(`✅ Invoice paid for customer ${customerId}: ${invoice.id}`);
    // Additional logic: send receipt email, update billing status, etc.
  }

  /**
   * Webhook handler: Invoice payment failed
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    console.log(`❌ Invoice payment failed for customer ${customerId}: ${invoice.id}`);
    // Additional logic: send failure notification, update status, etc.
  }

  /**
   * Webhook handler: Payment method attached
   */
  private static async handlePaymentMethodAttached(
    paymentMethod: Stripe.PaymentMethod,
  ): Promise<void> {
    console.log(`✅ Payment method attached: ${paymentMethod.id}`);
  }

  /**
   * Webhook handler: Payment method detached
   */
  private static async handlePaymentMethodDetached(
    paymentMethod: Stripe.PaymentMethod,
  ): Promise<void> {
    console.log(`✅ Payment method detached: ${paymentMethod.id}`);
  }

  /**
   * Map Stripe subscription status to our internal status
   */
  private static mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
    const statusMap: Record<string, string> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'unpaid',
      incomplete: 'incomplete',
      incomplete_expired: 'incomplete_expired',
    };

    return statusMap[stripeStatus] || 'unknown';
  }

  /**
   * Get Stripe publishable key (for frontend)
   */
  static getPublishableKey(): string {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error('STRIPE_PUBLISHABLE_KEY not configured');
    }
    return publishableKey;
  }
}
