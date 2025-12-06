/**
 * Payment Audit Trail Service
 * Implements PCI DSS compliance requirements for payment action tracking
 * All payment-related actions are logged for audit and compliance purposes
 */

import { db } from "../db";
import { eq, and, desc, gte, lte, inArray, sql, or } from "drizzle-orm";
import Stripe from "stripe";
import {
  paymentAuditTrail,
  paymentMethodChanges,
  type PaymentAuditTrail,
  type InsertPaymentAuditTrail,
  type PaymentMethodChange,
  type InsertPaymentMethodChange,
} from "@shared/soc2-compliance-schema";

// ============= TYPES =============

type PaymentAction =
  | 'payment_intent_created'
  | 'payment_intent_succeeded'
  | 'payment_intent_failed'
  | 'payment_intent_cancelled'
  | 'payment_method_attached'
  | 'payment_method_detached'
  | 'payment_method_updated'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'subscription_renewed'
  | 'invoice_created'
  | 'invoice_paid'
  | 'invoice_failed'
  | 'invoice_voided'
  | 'refund_initiated'
  | 'refund_completed'
  | 'refund_failed'
  | 'dispute_created'
  | 'dispute_won'
  | 'dispute_lost'
  | 'chargeback_received'
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted';

interface PaymentContext {
  tenantId: string;
  userId?: string;
  customerId?: string;
  invoiceId?: string;
  ipAddress: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

interface PaymentAuditEntry {
  action: PaymentAction;
  status: 'success' | 'failure' | 'pending';
  stripePaymentIntentId?: string;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  amount?: number;
  currency?: string;
  cardLast4?: string;
  cardBrand?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  errorCode?: string;
  errorMessage?: string;
  declineCode?: string;
  riskLevel?: string;
  riskScore?: number;
  metadata?: Record<string, any>;
  stripeEventId?: string;
  webhookReceived?: boolean;
}

// ============= AUDIT LOGGING =============

/**
 * Log a payment action to the audit trail
 */
export async function logPaymentAction(
  context: PaymentContext,
  entry: PaymentAuditEntry
): Promise<PaymentAuditTrail> {
  const [auditEntry] = await db
    .insert(paymentAuditTrail)
    .values({
      tenantId: context.tenantId,
      userId: context.userId,
      customerId: context.customerId,
      invoiceId: context.invoiceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      requestId: context.requestId,
      ...entry,
      action: entry.action as any,
      processedAt: new Date(),
    })
    .returning();

  return auditEntry;
}

/**
 * Log payment intent creation
 */
export async function logPaymentIntentCreated(
  context: PaymentContext,
  paymentIntent: Stripe.PaymentIntent
): Promise<PaymentAuditTrail> {
  return logPaymentAction(context, {
    action: 'payment_intent_created',
    status: 'pending',
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: paymentIntent.customer as string,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    metadata: paymentIntent.metadata,
  });
}

/**
 * Log successful payment
 */
export async function logPaymentSucceeded(
  context: PaymentContext,
  paymentIntent: Stripe.PaymentIntent,
  paymentMethod?: Stripe.PaymentMethod
): Promise<PaymentAuditTrail> {
  const cardDetails = paymentMethod?.card;

  return logPaymentAction(context, {
    action: 'payment_intent_succeeded',
    status: 'success',
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: paymentIntent.customer as string,
    stripePaymentMethodId: paymentIntent.payment_method as string,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    cardLast4: cardDetails?.last4,
    cardBrand: cardDetails?.brand,
    cardExpMonth: cardDetails?.exp_month,
    cardExpYear: cardDetails?.exp_year,
    metadata: paymentIntent.metadata,
  });
}

/**
 * Log failed payment
 */
export async function logPaymentFailed(
  context: PaymentContext,
  paymentIntent: Stripe.PaymentIntent,
  error?: Stripe.StripeError
): Promise<PaymentAuditTrail> {
  return logPaymentAction(context, {
    action: 'payment_intent_failed',
    status: 'failure',
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: paymentIntent.customer as string,
    stripePaymentMethodId: paymentIntent.payment_method as string,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    errorCode: error?.code,
    errorMessage: error?.message,
    declineCode: (paymentIntent.last_payment_error as any)?.decline_code,
    metadata: paymentIntent.metadata,
  });
}

/**
 * Log subscription creation
 */
export async function logSubscriptionCreated(
  context: PaymentContext,
  subscription: Stripe.Subscription
): Promise<PaymentAuditTrail> {
  return logPaymentAction(context, {
    action: 'subscription_created',
    status: 'success',
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    amount: subscription.items.data[0]?.price?.unit_amount || 0,
    currency: subscription.currency,
    metadata: subscription.metadata,
  });
}

/**
 * Log subscription update
 */
export async function logSubscriptionUpdated(
  context: PaymentContext,
  subscription: Stripe.Subscription,
  previousAttributes?: Record<string, any>
): Promise<PaymentAuditTrail> {
  return logPaymentAction(context, {
    action: 'subscription_updated',
    status: 'success',
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    metadata: {
      ...subscription.metadata,
      previousAttributes,
    },
  });
}

/**
 * Log subscription cancellation
 */
export async function logSubscriptionCancelled(
  context: PaymentContext,
  subscription: Stripe.Subscription,
  reason?: string
): Promise<PaymentAuditTrail> {
  return logPaymentAction(context, {
    action: 'subscription_cancelled',
    status: 'success',
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    metadata: {
      ...subscription.metadata,
      cancellationReason: reason,
      cancelAt: subscription.cancel_at,
      canceledAt: subscription.canceled_at,
    },
  });
}

/**
 * Log invoice events
 */
export async function logInvoiceEvent(
  context: PaymentContext,
  invoice: Stripe.Invoice,
  action: 'invoice_created' | 'invoice_paid' | 'invoice_failed' | 'invoice_voided'
): Promise<PaymentAuditTrail> {
  return logPaymentAction(context, {
    action,
    status: action === 'invoice_failed' ? 'failure' : 'success',
    stripeInvoiceId: invoice.id,
    stripeCustomerId: invoice.customer as string,
    stripeSubscriptionId: invoice.subscription as string,
    amount: invoice.amount_due,
    currency: invoice.currency,
    metadata: invoice.metadata,
  });
}

/**
 * Log refund events
 */
export async function logRefundEvent(
  context: PaymentContext,
  refund: Stripe.Refund,
  action: 'refund_initiated' | 'refund_completed' | 'refund_failed'
): Promise<PaymentAuditTrail> {
  return logPaymentAction(context, {
    action,
    status: action === 'refund_failed' ? 'failure' : 'success',
    stripePaymentIntentId: refund.payment_intent as string,
    amount: refund.amount,
    currency: refund.currency,
    metadata: {
      refundId: refund.id,
      reason: refund.reason,
      status: refund.status,
    },
  });
}

/**
 * Log dispute events
 */
export async function logDisputeEvent(
  context: PaymentContext,
  dispute: Stripe.Dispute,
  action: 'dispute_created' | 'dispute_won' | 'dispute_lost' | 'chargeback_received'
): Promise<PaymentAuditTrail> {
  return logPaymentAction(context, {
    action,
    status: action === 'dispute_lost' ? 'failure' : (action === 'dispute_won' ? 'success' : 'pending'),
    stripePaymentIntentId: dispute.payment_intent as string,
    amount: dispute.amount,
    currency: dispute.currency,
    metadata: {
      disputeId: dispute.id,
      reason: dispute.reason,
      status: dispute.status,
    },
  });
}

// ============= PAYMENT METHOD TRACKING =============

/**
 * Log payment method addition
 */
export async function logPaymentMethodAdded(
  context: PaymentContext,
  paymentMethod: Stripe.PaymentMethod,
  isDefault: boolean
): Promise<PaymentMethodChange> {
  const [change] = await db
    .insert(paymentMethodChanges)
    .values({
      tenantId: context.tenantId,
      userId: context.userId!,
      stripeCustomerId: paymentMethod.customer as string,
      stripePaymentMethodId: paymentMethod.id,
      changeType: 'added',
      newDefault: isDefault,
      cardLast4: paymentMethod.card?.last4,
      cardBrand: paymentMethod.card?.brand,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    })
    .returning();

  // Also log to main audit trail
  await logPaymentAction(context, {
    action: 'payment_method_attached',
    status: 'success',
    stripeCustomerId: paymentMethod.customer as string,
    stripePaymentMethodId: paymentMethod.id,
    cardLast4: paymentMethod.card?.last4,
    cardBrand: paymentMethod.card?.brand,
    cardExpMonth: paymentMethod.card?.exp_month,
    cardExpYear: paymentMethod.card?.exp_year,
  });

  return change;
}

/**
 * Log payment method removal
 */
export async function logPaymentMethodRemoved(
  context: PaymentContext,
  paymentMethodId: string,
  stripeCustomerId: string,
  cardLast4?: string,
  cardBrand?: string,
  wasDefault?: boolean,
  reason?: string
): Promise<PaymentMethodChange> {
  const [change] = await db
    .insert(paymentMethodChanges)
    .values({
      tenantId: context.tenantId,
      userId: context.userId!,
      stripeCustomerId,
      stripePaymentMethodId: paymentMethodId,
      changeType: 'removed',
      previousDefault: wasDefault,
      cardLast4,
      cardBrand,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      reason,
    })
    .returning();

  // Also log to main audit trail
  await logPaymentAction(context, {
    action: 'payment_method_detached',
    status: 'success',
    stripeCustomerId,
    stripePaymentMethodId: paymentMethodId,
    cardLast4,
    cardBrand,
    metadata: { reason },
  });

  return change;
}

/**
 * Log payment method set as default
 */
export async function logPaymentMethodSetDefault(
  context: PaymentContext,
  paymentMethod: Stripe.PaymentMethod,
  previousDefaultId?: string
): Promise<PaymentMethodChange> {
  const [change] = await db
    .insert(paymentMethodChanges)
    .values({
      tenantId: context.tenantId,
      userId: context.userId!,
      stripeCustomerId: paymentMethod.customer as string,
      stripePaymentMethodId: paymentMethod.id,
      changeType: 'set_default',
      previousDefault: false,
      newDefault: true,
      cardLast4: paymentMethod.card?.last4,
      cardBrand: paymentMethod.card?.brand,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    })
    .returning();

  await logPaymentAction(context, {
    action: 'payment_method_updated',
    status: 'success',
    stripeCustomerId: paymentMethod.customer as string,
    stripePaymentMethodId: paymentMethod.id,
    cardLast4: paymentMethod.card?.last4,
    cardBrand: paymentMethod.card?.brand,
    metadata: { setAsDefault: true, previousDefaultId },
  });

  return change;
}

// ============= WEBHOOK EVENT LOGGING =============

/**
 * Log Stripe webhook event
 */
export async function logWebhookEvent(
  tenantId: string,
  event: Stripe.Event
): Promise<PaymentAuditTrail | null> {
  const context: PaymentContext = {
    tenantId,
    ipAddress: '0.0.0.0', // Webhook events don't have user IP
  };

  let action: PaymentAction | null = null;
  let status: 'success' | 'failure' | 'pending' = 'success';
  let stripePaymentIntentId: string | undefined;
  let stripeSubscriptionId: string | undefined;
  let stripeInvoiceId: string | undefined;
  let stripeCustomerId: string | undefined;
  let amount: number | undefined;
  let currency: string | undefined;

  // Map Stripe event types to our actions
  switch (event.type) {
    case 'payment_intent.succeeded':
      action = 'payment_intent_succeeded';
      const piSucceeded = event.data.object as Stripe.PaymentIntent;
      stripePaymentIntentId = piSucceeded.id;
      stripeCustomerId = piSucceeded.customer as string;
      amount = piSucceeded.amount;
      currency = piSucceeded.currency;
      break;

    case 'payment_intent.payment_failed':
      action = 'payment_intent_failed';
      status = 'failure';
      const piFailed = event.data.object as Stripe.PaymentIntent;
      stripePaymentIntentId = piFailed.id;
      stripeCustomerId = piFailed.customer as string;
      amount = piFailed.amount;
      currency = piFailed.currency;
      break;

    case 'customer.subscription.created':
      action = 'subscription_created';
      const subCreated = event.data.object as Stripe.Subscription;
      stripeSubscriptionId = subCreated.id;
      stripeCustomerId = subCreated.customer as string;
      break;

    case 'customer.subscription.updated':
      action = 'subscription_updated';
      const subUpdated = event.data.object as Stripe.Subscription;
      stripeSubscriptionId = subUpdated.id;
      stripeCustomerId = subUpdated.customer as string;
      break;

    case 'customer.subscription.deleted':
      action = 'subscription_cancelled';
      const subDeleted = event.data.object as Stripe.Subscription;
      stripeSubscriptionId = subDeleted.id;
      stripeCustomerId = subDeleted.customer as string;
      break;

    case 'invoice.paid':
      action = 'invoice_paid';
      const invPaid = event.data.object as Stripe.Invoice;
      stripeInvoiceId = invPaid.id;
      stripeCustomerId = invPaid.customer as string;
      stripeSubscriptionId = invPaid.subscription as string;
      amount = invPaid.amount_paid;
      currency = invPaid.currency;
      break;

    case 'invoice.payment_failed':
      action = 'invoice_failed';
      status = 'failure';
      const invFailed = event.data.object as Stripe.Invoice;
      stripeInvoiceId = invFailed.id;
      stripeCustomerId = invFailed.customer as string;
      stripeSubscriptionId = invFailed.subscription as string;
      amount = invFailed.amount_due;
      currency = invFailed.currency;
      break;

    case 'charge.dispute.created':
      action = 'dispute_created';
      status = 'pending';
      const disputeCreated = event.data.object as Stripe.Dispute;
      stripePaymentIntentId = disputeCreated.payment_intent as string;
      amount = disputeCreated.amount;
      currency = disputeCreated.currency;
      break;

    case 'charge.dispute.closed':
      const disputeClosed = event.data.object as Stripe.Dispute;
      action = disputeClosed.status === 'won' ? 'dispute_won' : 'dispute_lost';
      status = disputeClosed.status === 'won' ? 'success' : 'failure';
      stripePaymentIntentId = disputeClosed.payment_intent as string;
      amount = disputeClosed.amount;
      currency = disputeClosed.currency;
      break;

    case 'charge.refunded':
      action = 'refund_completed';
      const chargeRefunded = event.data.object as Stripe.Charge;
      stripePaymentIntentId = chargeRefunded.payment_intent as string;
      stripeCustomerId = chargeRefunded.customer as string;
      amount = chargeRefunded.amount_refunded;
      currency = chargeRefunded.currency;
      break;

    default:
      // Unhandled event type - don't log
      return null;
  }

  if (!action) return null;

  return logPaymentAction(context, {
    action,
    status,
    stripePaymentIntentId,
    stripeSubscriptionId,
    stripeInvoiceId,
    stripeCustomerId,
    amount,
    currency,
    stripeEventId: event.id,
    webhookReceived: true,
    metadata: {
      eventType: event.type,
      eventCreated: event.created,
      livemode: event.livemode,
    },
  });
}

// ============= QUERY & REPORTING =============

/**
 * Get payment audit trail with filters
 */
export async function getPaymentAuditTrail(
  tenantId: string,
  options: {
    actions?: PaymentAction[];
    status?: ('success' | 'failure' | 'pending')[];
    stripeCustomerId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: PaymentAuditTrail[]; total: number }> {
  const conditions = [eq(paymentAuditTrail.tenantId, tenantId)];

  if (options.actions?.length) {
    conditions.push(inArray(paymentAuditTrail.action, options.actions as any));
  }
  if (options.status?.length) {
    conditions.push(inArray(paymentAuditTrail.status, options.status));
  }
  if (options.stripeCustomerId) {
    conditions.push(eq(paymentAuditTrail.stripeCustomerId, options.stripeCustomerId));
  }
  if (options.userId) {
    conditions.push(eq(paymentAuditTrail.userId, options.userId));
  }
  if (options.startDate) {
    conditions.push(gte(paymentAuditTrail.timestamp, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(paymentAuditTrail.timestamp, options.endDate));
  }

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(paymentAuditTrail)
      .where(and(...conditions))
      .orderBy(desc(paymentAuditTrail.timestamp))
      .limit(options.limit || 100)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(paymentAuditTrail)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get payment method change history
 */
export async function getPaymentMethodHistory(
  tenantId: string,
  options: {
    userId?: string;
    stripeCustomerId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: PaymentMethodChange[]; total: number }> {
  const conditions = [eq(paymentMethodChanges.tenantId, tenantId)];

  if (options.userId) {
    conditions.push(eq(paymentMethodChanges.userId, options.userId));
  }
  if (options.stripeCustomerId) {
    conditions.push(eq(paymentMethodChanges.stripeCustomerId, options.stripeCustomerId));
  }
  if (options.startDate) {
    conditions.push(gte(paymentMethodChanges.timestamp, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(paymentMethodChanges.timestamp, options.endDate));
  }

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(paymentMethodChanges)
      .where(and(...conditions))
      .orderBy(desc(paymentMethodChanges.timestamp))
      .limit(options.limit || 100)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(paymentMethodChanges)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get payment metrics for compliance reporting
 */
export async function getPaymentMetrics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
  totalAmount: number;
  refundedAmount: number;
  disputeCount: number;
  chargebackCount: number;
  byAction: Record<string, number>;
}> {
  const entries = await db
    .select()
    .from(paymentAuditTrail)
    .where(
      and(
        eq(paymentAuditTrail.tenantId, tenantId),
        gte(paymentAuditTrail.timestamp, startDate),
        lte(paymentAuditTrail.timestamp, endDate)
      )
    );

  let totalTransactions = 0;
  let successfulTransactions = 0;
  let failedTransactions = 0;
  let totalAmount = 0;
  let refundedAmount = 0;
  let disputeCount = 0;
  let chargebackCount = 0;
  const byAction: Record<string, number> = {};

  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;

    // Count payment transactions
    if (['payment_intent_succeeded', 'payment_intent_failed'].includes(entry.action)) {
      totalTransactions++;
      if (entry.status === 'success') {
        successfulTransactions++;
        totalAmount += entry.amount || 0;
      } else if (entry.status === 'failure') {
        failedTransactions++;
      }
    }

    // Track refunds
    if (entry.action === 'refund_completed') {
      refundedAmount += entry.amount || 0;
    }

    // Track disputes
    if (entry.action === 'dispute_created') {
      disputeCount++;
    }

    // Track chargebacks
    if (entry.action === 'chargeback_received') {
      chargebackCount++;
    }
  }

  return {
    totalTransactions,
    successfulTransactions,
    failedTransactions,
    successRate: totalTransactions > 0
      ? Math.round((successfulTransactions / totalTransactions) * 100 * 100) / 100
      : 0,
    totalAmount,
    refundedAmount,
    disputeCount,
    chargebackCount,
    byAction,
  };
}

/**
 * Check for suspicious payment activity
 */
export async function checkSuspiciousActivity(
  tenantId: string,
  userId: string,
  timeWindowMinutes: number = 60
): Promise<{
  suspicious: boolean;
  reasons: string[];
  recentFailures: number;
  recentPaymentMethodChanges: number;
}> {
  const windowStart = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  const reasons: string[] = [];

  // Check recent failed payments
  const [failedPayments] = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentAuditTrail)
    .where(
      and(
        eq(paymentAuditTrail.tenantId, tenantId),
        eq(paymentAuditTrail.userId, userId),
        eq(paymentAuditTrail.status, 'failure'),
        gte(paymentAuditTrail.timestamp, windowStart)
      )
    );

  const recentFailures = failedPayments?.count || 0;
  if (recentFailures >= 3) {
    reasons.push(`${recentFailures} failed payment attempts in the last ${timeWindowMinutes} minutes`);
  }

  // Check payment method changes
  const [methodChanges] = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentMethodChanges)
    .where(
      and(
        eq(paymentMethodChanges.tenantId, tenantId),
        eq(paymentMethodChanges.userId, userId),
        gte(paymentMethodChanges.timestamp, windowStart)
      )
    );

  const recentPaymentMethodChanges = methodChanges?.count || 0;
  if (recentPaymentMethodChanges >= 5) {
    reasons.push(`${recentPaymentMethodChanges} payment method changes in the last ${timeWindowMinutes} minutes`);
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
    recentFailures,
    recentPaymentMethodChanges,
  };
}

export default {
  logPaymentAction,
  logPaymentIntentCreated,
  logPaymentSucceeded,
  logPaymentFailed,
  logSubscriptionCreated,
  logSubscriptionUpdated,
  logSubscriptionCancelled,
  logInvoiceEvent,
  logRefundEvent,
  logDisputeEvent,
  logPaymentMethodAdded,
  logPaymentMethodRemoved,
  logPaymentMethodSetDefault,
  logWebhookEvent,
  getPaymentAuditTrail,
  getPaymentMethodHistory,
  getPaymentMetrics,
  checkSuspiciousActivity,
};
