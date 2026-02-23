import Stripe from 'stripe';
import { db } from '../db';
import { tenants, tenantSubscriptions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
import { sendEmail } from './email-service';
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

    // Resolve tenant admin email from subscription customer or database
    let recipientEmail: string | undefined;
    let tenantName = 'your organization';
    try {
      const customerId = subscription.customer as string;
      if (stripe && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && (customer as Stripe.Customer).email) {
          recipientEmail = (customer as Stripe.Customer).email!;
        }
      }
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });
      if (tenant?.name) {
        tenantName = tenant.name;
      }
      if (!recipientEmail) {
        const adminUser = await db.query.users.findFirst({
          where: eq(users.tenantId, tenantId),
        });
        if (adminUser?.email) {
          recipientEmail = adminUser.email;
        }
      }
    } catch (err) {
      log.error('Failed to resolve tenant admin email for trial ending notification', err);
    }

    if (recipientEmail) {
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
      const trialEndDate = trialEnd
        ? trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'in 3 days';
      const planName =
        subscription.items.data[0]?.price?.product &&
        typeof subscription.items.data[0].price.product === 'object' &&
        'name' in subscription.items.data[0].price.product
          ? (subscription.items.data[0].price.product as Stripe.Product).name
          : 'Printyx';
      const upgradeUrl = `${process.env.PUBLIC_URL || 'http://localhost:5000'}/settings/subscription`;

      try {
        await sendEmail({
          to: recipientEmail,
          subject: 'Your Printyx trial ends in 3 days',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">Trial Ending Soon</h1>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                  <p>Hello,</p>
                  <p>Your <strong>${planName}</strong> trial for <strong>${tenantName}</strong> is ending <strong>${trialEndDate}</strong>.</p>
                  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                    <strong style="color: #92400e;">Don't lose access!</strong>
                    <p style="margin: 8px 0 0 0; color: #78350f;">Add a payment method now to continue using Printyx without any interruption. All your data, settings, and configurations will be preserved.</p>
                  </div>
                  <p style="text-align: center;">
                    <a href="${upgradeUrl}" style="display: inline-block; padding: 14px 28px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Upgrade Now</a>
                  </p>
                  <p style="color: #6b7280; font-size: 14px;">If you have any questions about our plans or pricing, just reply to this email. We're here to help.</p>
                </div>
                <div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
                  <p style="margin: 0;">&copy; ${new Date().getFullYear()} Printyx. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Your Printyx trial ends ${trialEndDate}. Upgrade now to keep access to your ${planName} plan: ${upgradeUrl}`,
        });
        log.info(
          `Trial ending notification email sent to ${recipientEmail} for tenant ${tenantId}`,
        );
      } catch (emailErr) {
        log.error(`Failed to send trial ending notification email to ${recipientEmail}`, emailErr);
      }
    } else {
      log.warn(`No email address found for tenant ${tenantId} - trial ending notification skipped`);
    }

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

    // Resolve recipient email and tenant info
    let recipientEmail: string | undefined;
    let tenantName = 'your organization';
    try {
      if (stripe && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && (customer as Stripe.Customer).email) {
          recipientEmail = (customer as Stripe.Customer).email!;
        }
        // Try to get tenant name from customer metadata
        if (!customer.deleted && (customer as Stripe.Customer).metadata?.tenantId) {
          const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, (customer as Stripe.Customer).metadata.tenantId),
          });
          if (tenant?.name) {
            tenantName = tenant.name;
          }
        }
      }
      // Fallback: use invoice customer_email
      if (!recipientEmail && invoice.customer_email) {
        recipientEmail = invoice.customer_email;
      }
    } catch (err) {
      log.error('Failed to resolve recipient email for upcoming invoice notification', err);
    }

    if (recipientEmail) {
      const amountDue =
        invoice.amount_due != null ? `$${(invoice.amount_due / 100).toFixed(2)}` : 'N/A';
      const currency = (invoice.currency || 'usd').toUpperCase();
      const dueDate = invoice.due_date
        ? new Date(invoice.due_date * 1000).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : invoice.period_end
          ? new Date(invoice.period_end * 1000).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : 'upcoming';

      // Build line items summary
      const lineItems = (invoice.lines?.data || [])
        .slice(0, 10)
        .map((item) => {
          const description = item.description || item.price?.nickname || 'Line item';
          const itemAmount = item.amount != null ? `$${(item.amount / 100).toFixed(2)}` : '';
          return `<tr><td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${description}</td><td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">${itemAmount}</td></tr>`;
        })
        .join('');

      const billingUrl = `${process.env.PUBLIC_URL || 'http://localhost:5000'}/settings/subscription`;

      try {
        await sendEmail({
          to: recipientEmail,
          subject: `Upcoming Invoice - ${amountDue} ${currency}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">Upcoming Invoice</h1>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                  <p>Hello,</p>
                  <p>You have an upcoming invoice for <strong>${tenantName}</strong>. Here are the details:</p>
                  <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Amount Due</td>
                        <td style="padding: 8px 0; text-align: right; font-size: 20px; font-weight: 700; color: #111827;">${amountDue} ${currency}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Due Date</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${dueDate}</td>
                      </tr>
                    </table>
                  </div>
                  ${
                    lineItems
                      ? `
                  <h3 style="margin-bottom: 8px;">Line Items</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    ${lineItems}
                  </table>
                  `
                      : ''
                  }
                  <p style="text-align: center; margin-top: 24px;">
                    <a href="${billingUrl}" style="display: inline-block; padding: 14px 28px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Billing Details</a>
                  </p>
                  <p style="color: #6b7280; font-size: 14px;">This invoice will be charged to your default payment method on file. If you need to update your payment method, visit your billing settings.</p>
                </div>
                <div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
                  <p style="margin: 0;">&copy; ${new Date().getFullYear()} Printyx. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Upcoming Invoice for ${tenantName}: ${amountDue} ${currency} due ${dueDate}. View billing details: ${billingUrl}`,
        });
        log.info(
          `Upcoming invoice notification email sent to ${recipientEmail} for customer ${customerId}, amount: ${amountDue}`,
        );
      } catch (emailErr) {
        log.error(
          `Failed to send upcoming invoice notification email to ${recipientEmail}`,
          emailErr,
        );
      }
    } else {
      log.warn(
        `No email address found for customer ${customerId} - upcoming invoice notification skipped`,
      );
    }

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

    if (purchaseType === 'one_time_purchase' && tenantId) {
      // Activate the purchased add-on for the tenant
      const addOnName =
        paymentIntent.metadata?.addOnName || paymentIntent.metadata?.productName || 'Add-on';
      const addOnId = paymentIntent.metadata?.addOnId || paymentIntent.metadata?.priceId || '';

      try {
        // Store add-on activation in tenant metadata
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, tenantId),
        });

        if (tenant) {
          const tenantMeta = (tenant.metadata as any) || {};
          const activeAddOns = tenantMeta.activeAddOns || [];
          activeAddOns.push({
            id: addOnId,
            name: addOnName,
            activatedAt: new Date().toISOString(),
            paymentIntentId: paymentIntent.id,
          });

          await db
            .update(tenants)
            .set({
              metadata: {
                ...tenantMeta,
                activeAddOns,
              },
              updatedAt: new Date(),
            })
            .where(eq(tenants.id, tenantId));

          log.info(
            `Add-on "${addOnName}" activated for tenant ${tenantId} (paymentIntent: ${paymentIntent.id})`,
          );
        }
      } catch (activationErr) {
        log.error(`Failed to activate add-on for tenant ${tenantId}`, activationErr);
      }

      // Send confirmation email
      let recipientEmail: string | undefined;
      try {
        const customerId = paymentIntent.customer as string | undefined;
        if (stripe && customerId) {
          const customer = await stripe.customers.retrieve(customerId);
          if (!customer.deleted && (customer as Stripe.Customer).email) {
            recipientEmail = (customer as Stripe.Customer).email!;
          }
        }
        if (!recipientEmail) {
          const adminUser = await db.query.users.findFirst({
            where: eq(users.tenantId, tenantId),
          });
          if (adminUser?.email) {
            recipientEmail = adminUser.email;
          }
        }
      } catch (err) {
        log.error('Failed to resolve email for add-on confirmation', err);
      }

      if (recipientEmail) {
        const amountPaid =
          paymentIntent.amount != null ? `$${(paymentIntent.amount / 100).toFixed(2)}` : '';
        const dashboardUrl = `${process.env.PUBLIC_URL || 'http://localhost:5000'}/settings/subscription`;

        try {
          await sendEmail({
            to: recipientEmail,
            subject: `Add-on Activated: ${addOnName}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">Add-on Activated</h1>
                  </div>
                  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                    <p>Hello,</p>
                    <p>Great news! Your add-on has been successfully activated.</p>
                    <div style="background: #ecfdf5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                      <h2 style="margin: 0 0 8px 0; color: #065f46;">${addOnName}</h2>
                      ${amountPaid ? `<p style="margin: 0; color: #047857; font-size: 18px; font-weight: 600;">${amountPaid} paid</p>` : ''}
                    </div>
                    <p>This feature is now available in your account and ready to use immediately.</p>
                    <p style="text-align: center; margin-top: 24px;">
                      <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Your Subscription</a>
                    </p>
                  </div>
                  <div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
                    <p style="margin: 0;">&copy; ${new Date().getFullYear()} Printyx. All rights reserved.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
            text: `Add-on Activated: ${addOnName}${amountPaid ? ` (${amountPaid} paid)` : ''}. This feature is now available in your account. View your subscription: ${dashboardUrl}`,
          });
          log.info(
            `Add-on activation confirmation email sent to ${recipientEmail} for tenant ${tenantId}`,
          );
        } catch (emailErr) {
          log.error(`Failed to send add-on activation email to ${recipientEmail}`, emailErr);
        }
      }
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

    // Resolve recipient email
    let recipientEmail: string | undefined;
    let tenantName = 'your organization';
    try {
      const customerId = paymentIntent.customer as string | undefined;
      if (stripe && customerId) {
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && (customer as Stripe.Customer).email) {
          recipientEmail = (customer as Stripe.Customer).email!;
        }
        if (!customer.deleted && (customer as Stripe.Customer).metadata?.tenantId) {
          const tenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, (customer as Stripe.Customer).metadata.tenantId),
          });
          if (tenant?.name) {
            tenantName = tenant.name;
          }
        }
      }
      if (!recipientEmail && tenantId) {
        const adminUser = await db.query.users.findFirst({
          where: eq(users.tenantId, tenantId),
        });
        if (adminUser?.email) {
          recipientEmail = adminUser.email;
        }
      }
    } catch (err) {
      log.error('Failed to resolve email for payment failed notification', err);
    }

    if (recipientEmail) {
      const failedAmount =
        paymentIntent.amount != null ? `$${(paymentIntent.amount / 100).toFixed(2)}` : 'N/A';
      const currency = (paymentIntent.currency || 'usd').toUpperCase();
      const failureMessage =
        paymentIntent.last_payment_error?.message || 'Your payment could not be processed.';
      const failureCode = paymentIntent.last_payment_error?.code || 'unknown';
      const billingUrl = `${process.env.PUBLIC_URL || 'http://localhost:5000'}/settings/subscription`;

      try {
        await sendEmail({
          to: recipientEmail,
          subject: `Payment Failed - ${failedAmount} ${currency}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">Payment Failed</h1>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                  <p>Hello,</p>
                  <p>We were unable to process a payment for <strong>${tenantName}</strong>.</p>
                  <div style="background: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Amount</td>
                        <td style="padding: 8px 0; text-align: right; font-size: 20px; font-weight: 700; color: #dc2626;">${failedAmount} ${currency}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Reason</td>
                        <td style="padding: 8px 0; text-align: right; color: #991b1b;">${failureMessage}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Error Code</td>
                        <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #6b7280;">${failureCode}</td>
                      </tr>
                    </table>
                  </div>
                  <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                    <strong style="color: #92400e;">What happens next?</strong>
                    <p style="margin: 8px 0 0 0; color: #78350f;">We will automatically retry the payment in a few days. To avoid any service interruption, please update your payment method as soon as possible.</p>
                  </div>
                  <p style="text-align: center; margin-top: 24px;">
                    <a href="${billingUrl}" style="display: inline-block; padding: 14px 28px; background: #dc2626; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Update Payment Method</a>
                  </p>
                  <p style="color: #6b7280; font-size: 14px;">If you believe this is an error or need assistance, please reply to this email or contact our support team.</p>
                </div>
                <div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
                  <p style="margin: 0;">&copy; ${new Date().getFullYear()} Printyx. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Payment Failed for ${tenantName}: ${failedAmount} ${currency}. Reason: ${failureMessage}. We will retry automatically, but please update your payment method to avoid service interruption: ${billingUrl}`,
        });
        log.info(
          `Payment failed notification email sent to ${recipientEmail} for tenant ${tenantId || 'unknown'}, amount: ${failedAmount}, reason: ${failureCode}`,
        );
      } catch (emailErr) {
        log.error(
          `Failed to send payment failed notification email to ${recipientEmail}`,
          emailErr,
        );
      }
    } else {
      log.warn(
        `No email address found for payment intent ${paymentIntent.id} - payment failed notification skipped`,
      );
    }

    return { success: true, message: 'Payment failure handled' };
  }
}
