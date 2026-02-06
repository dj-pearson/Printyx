import Stripe from 'stripe';
import { db } from '../db';
import { tenants, tenantSubscriptions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('stripe-service');

/**
 * STRIPE PAYMENT SERVICE
 *
 * Handles all Stripe integration including customer creation,
 * payment methods, subscriptions, and webhook processing.
 */

// Initialize Stripe with API key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  log.warn(
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

export interface CreateCheckoutSessionParams {
  tenantId: string;
  priceId: string;
  billingCycle: 'monthly' | 'annual';
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  trialDays?: number;
  discountCode?: string;
  metadata?: Record<string, string>;
}

export interface CreatePortalSessionParams {
  stripeCustomerId: string;
  returnUrl: string;
}

export interface CreateOneTimeCheckoutParams {
  tenantId: string;
  priceId: string;
  quantity?: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
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

    log.info(`✅ Created Stripe customer ${customer.id} for tenant ${tenantId}`);
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

    log.info(`✅ Added payment method ${paymentMethodId} to customer ${stripeCustomerId}`);
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
    log.info(`✅ Removed payment method ${paymentMethodId}`);
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

    log.info(`✅ Created Stripe subscription ${subscription.id} for customer ${stripeCustomerId}`);
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
    log.info(`📨 Received Stripe webhook: ${event.type}`);

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
        log.info(`⚠️  Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Webhook handler: Subscription created
   */
  private static async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const tenantId = subscription.metadata.tenantId;

    if (!tenantId) {
      log.error('❌ No tenantId in subscription metadata');
      return;
    }

    log.info(`✅ Subscription created for tenant ${tenantId}`);
    // Additional logic can be added here
  }

  /**
   * Webhook handler: Subscription updated
   */
  private static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata.tenantId;

    if (!tenantId) {
      log.error('❌ No tenantId in subscription metadata');
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

    log.info(`✅ Subscription updated for tenant ${tenantId}: status=${subscription.status}`);
  }

  /**
   * Webhook handler: Subscription deleted
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata.tenantId;

    if (!tenantId) {
      log.error('❌ No tenantId in subscription metadata');
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

    log.info(`✅ Subscription deleted for tenant ${tenantId}`);
  }

  /**
   * Webhook handler: Invoice paid
   */
  private static async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    log.info(`✅ Invoice paid for customer ${customerId}: ${invoice.id}`);
    // Additional logic: send receipt email, update billing status, etc.
  }

  /**
   * Webhook handler: Invoice payment failed
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    log.info(`❌ Invoice payment failed for customer ${customerId}: ${invoice.id}`);
    // Additional logic: send failure notification, update status, etc.
  }

  /**
   * Webhook handler: Payment method attached
   */
  private static async handlePaymentMethodAttached(
    paymentMethod: Stripe.PaymentMethod,
  ): Promise<void> {
    log.info(`✅ Payment method attached: ${paymentMethod.id}`);
  }

  /**
   * Webhook handler: Payment method detached
   */
  private static async handlePaymentMethodDetached(
    paymentMethod: Stripe.PaymentMethod,
  ): Promise<void> {
    log.info(`✅ Payment method detached: ${paymentMethod.id}`);
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

  /**
   * Create a Stripe Checkout Session for subscription purchase
   * This is the primary method for new subscription purchases
   */
  static async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<Stripe.Checkout.Session> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const {
      tenantId,
      priceId,
      billingCycle,
      successUrl,
      cancelUrl,
      customerEmail,
      trialDays = 0,
      discountCode,
      metadata = {},
    } = params;

    // Get or create Stripe customer
    const stripeCustomerId = await this.getOrCreateCustomer(tenantId, customerEmail);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        tenantId,
        billingCycle,
        ...metadata,
      },
      subscription_data: {
        metadata: {
          tenantId,
          billingCycle,
        },
      },
      // Security: Require billing address for compliance
      billing_address_collection: 'required',
      // Allow promotion codes
      allow_promotion_codes: true,
      // Automatic tax calculation (if enabled in Stripe dashboard)
      automatic_tax: { enabled: false },
    };

    // Add customer email if not already a customer
    if (customerEmail && !stripeCustomerId) {
      sessionParams.customer_email = customerEmail;
    }

    // Add trial period if specified
    if (trialDays > 0) {
      sessionParams.subscription_data!.trial_period_days = trialDays;
    }

    // Add discount code if provided
    if (discountCode) {
      sessionParams.discounts = [{ coupon: discountCode }];
      // Remove allow_promotion_codes when using discounts
      delete sessionParams.allow_promotion_codes;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    log.info(`✅ Created checkout session ${session.id} for tenant ${tenantId} (${billingCycle})`);

    return session;
  }

  /**
   * Create a Stripe Checkout Session for one-time purchase (add-ons)
   */
  static async createOneTimeCheckoutSession(
    params: CreateOneTimeCheckoutParams,
  ): Promise<Stripe.Checkout.Session> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const {
      tenantId,
      priceId,
      quantity = 1,
      successUrl,
      cancelUrl,
      customerEmail,
      metadata = {},
    } = params;

    // Get or create Stripe customer
    const stripeCustomerId = await this.getOrCreateCustomer(tenantId, customerEmail);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        tenantId,
        type: 'one_time_purchase',
        ...metadata,
      },
      payment_intent_data: {
        metadata: {
          tenantId,
          type: 'one_time_purchase',
        },
      },
      billing_address_collection: 'required',
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    log.info(`✅ Created one-time checkout session ${session.id} for tenant ${tenantId}`);

    return session;
  }

  /**
   * Create a Stripe Customer Portal session for self-service billing management
   */
  static async createPortalSession(
    params: CreatePortalSessionParams,
  ): Promise<Stripe.BillingPortal.Session> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const { stripeCustomerId, returnUrl } = params;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    log.info(`✅ Created customer portal session for customer ${stripeCustomerId}`);

    return session;
  }

  /**
   * Create a Customer Portal session using tenant ID
   */
  static async createPortalSessionForTenant(
    tenantId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    // Get Stripe customer ID from tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const tenantMetadata = (tenant.metadata as any) || {};
    if (!tenantMetadata.stripeCustomerId) {
      throw new Error('No Stripe customer ID for this tenant');
    }

    return this.createPortalSession({
      stripeCustomerId: tenantMetadata.stripeCustomerId,
      returnUrl,
    });
  }

  /**
   * Retrieve a checkout session
   */
  static async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'payment_intent', 'customer'],
    });
  }

  /**
   * Get subscription details
   */
  static async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'latest_invoice'],
    });
  }

  /**
   * Get customer details
   */
  static async retrieveCustomer(customerId: string): Promise<Stripe.Customer> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      throw new Error('Customer has been deleted');
    }
    return customer as Stripe.Customer;
  }

  /**
   * Apply a coupon to an existing subscription
   */
  static async applyCouponToSubscription(
    subscriptionId: string,
    couponId: string,
  ): Promise<Stripe.Subscription> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    return await stripe.subscriptions.update(subscriptionId, {
      coupon: couponId,
    });
  }

  /**
   * Preview upcoming invoice (useful for showing upgrade/downgrade costs)
   */
  static async previewInvoice(
    stripeCustomerId: string,
    subscriptionId: string,
    newPriceId: string,
  ): Promise<Stripe.Invoice> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return await stripe.invoices.retrieveUpcoming({
      customer: stripeCustomerId,
      subscription: subscriptionId,
      subscription_items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
    });
  }

  /**
   * Create a Setup Intent for collecting payment method without immediate charge
   */
  static async createSetupIntent(
    stripeCustomerId: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.SetupIntent> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    return await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: metadata || {},
    });
  }

  /**
   * Verify webhook signature and return event
   * This is the secure way to process webhooks
   */
  static verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Enhanced webhook handler with checkout session support
   */
  static async handleWebhookEventEnhanced(event: Stripe.Event): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    log.info(`📨 Processing Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        // Checkout session completed (new purchase)
        case 'checkout.session.completed':
          return await this.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
          );

        // Checkout session expired
        case 'checkout.session.expired':
          return await this.handleCheckoutSessionExpired(
            event.data.object as Stripe.Checkout.Session,
          );

        // Subscription events
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          return { success: true, message: 'Subscription created' };

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          return { success: true, message: 'Subscription updated' };

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          return { success: true, message: 'Subscription deleted' };

        case 'customer.subscription.trial_will_end':
          return await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);

        // Invoice events
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          return { success: true, message: 'Invoice paid' };

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          return { success: true, message: 'Invoice payment failed handled' };

        case 'invoice.upcoming':
          return await this.handleInvoiceUpcoming(event.data.object as Stripe.Invoice);

        // Payment method events
        case 'payment_method.attached':
          await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
          return { success: true, message: 'Payment method attached' };

        case 'payment_method.detached':
          await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
          return { success: true, message: 'Payment method detached' };

        // Payment intent events (for one-time purchases)
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);

        case 'payment_intent.payment_failed':
          return await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);

        default:
          log.info(`⚠️  Unhandled webhook event type: ${event.type}`);
          return { success: true, message: `Unhandled event type: ${event.type}` };
      }
    } catch (error) {
      log.error(`❌ Error handling webhook ${event.type}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle checkout session completed - activate subscription
   */
  private static async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const tenantId = session.metadata?.tenantId;

    if (!tenantId) {
      log.error('❌ No tenantId in checkout session metadata');
      return { success: false, message: 'No tenantId in session metadata' };
    }

    log.info(`✅ Checkout completed for tenant ${tenantId}`);

    // Handle subscription checkout
    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

      // Update tenant subscription in database
      await db
        .update(tenantSubscriptions)
        .set({
          stripeSubscriptionId: subscriptionId,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(tenantSubscriptions.tenantId, tenantId));

      return {
        success: true,
        message: 'Subscription activated',
        data: { subscriptionId },
      };
    }

    // Handle one-time payment checkout
    if (session.mode === 'payment' && session.payment_intent) {
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent.id;

      return {
        success: true,
        message: 'One-time payment completed',
        data: { paymentIntentId },
      };
    }

    return { success: true, message: 'Checkout session handled' };
  }

  /**
   * Handle checkout session expired
   */
  private static async handleCheckoutSessionExpired(
    session: Stripe.Checkout.Session,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = session.metadata?.tenantId;
    log.info(`⚠️  Checkout session expired for tenant ${tenantId || 'unknown'}`);

    return { success: true, message: 'Checkout session expired' };
  }

  /**
   * Handle trial ending notification
   */
  private static async handleTrialWillEnd(
    subscription: Stripe.Subscription,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = subscription.metadata.tenantId;

    if (!tenantId) {
      log.error('❌ No tenantId in subscription metadata');
      return { success: false, message: 'No tenantId in metadata' };
    }

    log.info(`⚠️  Trial will end for tenant ${tenantId}`);

    // TODO: Send trial ending notification email

    return { success: true, message: 'Trial ending notification processed' };
  }

  /**
   * Handle upcoming invoice notification
   */
  private static async handleInvoiceUpcoming(
    invoice: Stripe.Invoice,
  ): Promise<{ success: boolean; message: string }> {
    const customerId = invoice.customer as string;
    log.info(`📬 Upcoming invoice for customer ${customerId}`);

    // TODO: Send upcoming invoice notification

    return { success: true, message: 'Upcoming invoice notification processed' };
  }

  /**
   * Handle successful payment intent (one-time purchases)
   */
  private static async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const tenantId = paymentIntent.metadata?.tenantId;
    const purchaseType = paymentIntent.metadata?.type;

    log.info(`✅ Payment succeeded for tenant ${tenantId || 'unknown'}: ${paymentIntent.id}`);

    if (purchaseType === 'one_time_purchase') {
      // Handle add-on purchase activation
      // TODO: Activate the purchased add-on for the tenant
    }

    return {
      success: true,
      message: 'Payment succeeded',
      data: { paymentIntentId: paymentIntent.id },
    };
  }

  /**
   * Handle failed payment intent
   */
  private static async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = paymentIntent.metadata?.tenantId;

    log.info(`❌ Payment failed for tenant ${tenantId || 'unknown'}: ${paymentIntent.id}`);

    // TODO: Send payment failed notification

    return { success: true, message: 'Payment failure handled' };
  }
}
