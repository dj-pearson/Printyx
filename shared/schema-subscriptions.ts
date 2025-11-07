import { pgTable, varchar, text, timestamp, boolean, integer, decimal, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants, users } from './schema';

/**
 * COMPREHENSIVE SUBSCRIPTION SYSTEM SCHEMA
 *
 * This schema covers:
 * - Subscription plans and features
 * - Trial management
 * - Usage tracking and limits
 * - Billing and payment
 * - Discounts and promotions
 * - Admin controls
 */

// ============================================================================
// SUBSCRIPTION PLANS & FEATURES
// ============================================================================

export const subscriptionPlans = pgTable('subscription_plans', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 50 }).notNull().unique(), // Starter, Professional, Enterprise
  slug: varchar('slug', { length: 50 }).notNull().unique(), // starter, professional, enterprise
  description: text('description'),

  // Pricing
  monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).notNull(),
  annualPrice: decimal('annual_price', { precision: 10, scale: 2 }).notNull(),
  annualDiscount: integer('annual_discount').default(0), // Percentage discount for annual billing

  // Limits
  maxUsers: integer('max_users').notNull(), // -1 for unlimited
  maxStorage: integer('max_storage').notNull(), // in GB, -1 for unlimited
  maxApiCalls: integer('max_api_calls').notNull(), // per month, -1 for unlimited
  maxLocations: integer('max_locations').notNull(), // -1 for unlimited
  maxBusinessRecords: integer('max_business_records').notNull(), // CRM records, -1 for unlimited

  // Trial settings
  trialEnabled: boolean('trial_enabled').default(true),
  trialDays: integer('trial_days').default(14),
  trialRequiresPayment: boolean('trial_requires_payment').default(false),

  // Features (JSON array of feature slugs)
  features: jsonb('features').notNull().default(sql`'[]'::jsonb`),

  // Display settings
  displayOrder: integer('display_order').default(0),
  isPopular: boolean('is_popular').default(false),
  isVisible: boolean('is_visible').default(true),
  isActive: boolean('is_active').default(true),

  // Metadata
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const subscriptionFeatures = pgTable('subscription_features', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  category: varchar('category', { length: 50 }), // CRM, Inventory, Service, Analytics, etc.
  isCore: boolean('is_core').default(false), // Core features vs add-ons
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// TENANT SUBSCRIPTIONS
// ============================================================================

export const tenantSubscriptions = pgTable('tenant_subscriptions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  planId: varchar('plan_id').notNull().references(() => subscriptionPlans.id),

  // Subscription status
  status: varchar('status', { length: 20 }).notNull().default('active'),
  // Statuses: active, trialing, past_due, canceled, incomplete, incomplete_expired, paused

  // Billing cycle
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull(), // monthly, annual
  billingInterval: integer('billing_interval').default(1), // e.g., every 2 months

  // Dates
  startDate: timestamp('start_date').notNull().defaultNow(),
  currentPeriodStart: timestamp('current_period_start').notNull().defaultNow(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAt: timestamp('cancel_at'), // Scheduled cancellation
  canceledAt: timestamp('canceled_at'), // When cancellation was requested
  endedAt: timestamp('ended_at'), // When subscription actually ended

  // Trial information
  isTrialing: boolean('is_trialing').default(false),
  trialStartDate: timestamp('trial_start_date'),
  trialEndDate: timestamp('trial_end_date'),

  // Pricing
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD'),

  // Discounts
  discountId: varchar('discount_id'), // references discounts.id
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  discountPercent: integer('discount_percent').default(0),

  // Free/Custom subscriptions (admin overrides)
  isFree: boolean('is_free').default(false), // Admin granted free subscription
  customPricing: boolean('custom_pricing').default(false), // Custom enterprise pricing
  customLimits: jsonb('custom_limits').default(sql`'{}'::jsonb`), // Override plan limits

  // Payment integration
  stripeCustomerId: varchar('stripe_customer_id'),
  stripeSubscriptionId: varchar('stripe_subscription_id'),
  stripePaymentIntentId: varchar('stripe_payment_intent_id'),

  // Usage-based billing
  usageBasedBilling: boolean('usage_based_billing').default(false),
  overageCharges: decimal('overage_charges', { precision: 10, scale: 2 }).default('0'),

  // Metadata
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  notes: text('notes'), // Admin notes

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('tenant_subscriptions_tenant_id_idx').on(table.tenantId),
  statusIdx: index('tenant_subscriptions_status_idx').on(table.status),
  stripeSubscriptionIdx: index('tenant_subscriptions_stripe_subscription_id_idx').on(table.stripeSubscriptionId),
}));

// ============================================================================
// USAGE TRACKING
// ============================================================================

export const usageMetrics = pgTable('usage_metrics', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Period tracking
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),

  // Usage counts
  activeUsers: integer('active_users').default(0),
  totalUsers: integer('total_users').default(0),
  storageUsedMb: integer('storage_used_mb').default(0), // Storage in MB
  apiCalls: integer('api_calls').default(0),
  activeLocations: integer('active_locations').default(0),
  businessRecords: integer('business_records').default(0), // Total CRM records

  // Feature usage
  featureUsage: jsonb('feature_usage').default(sql`'{}'::jsonb`), // Track specific feature usage

  // Overage tracking
  isOverLimit: boolean('is_over_limit').default(false),
  overageDetails: jsonb('overage_details').default(sql`'{}'::jsonb`),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('usage_metrics_tenant_id_idx').on(table.tenantId),
  periodIdx: index('usage_metrics_period_idx').on(table.periodStart, table.periodEnd),
}));

// Daily usage snapshots for detailed tracking
export const dailyUsageSnapshots = pgTable('daily_usage_snapshots', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  date: timestamp('date').notNull(),

  activeUsers: integer('active_users').default(0),
  apiCalls: integer('api_calls').default(0),
  storageUsedMb: integer('storage_used_mb').default(0),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenantDateIdx: unique('daily_usage_tenant_date_idx').on(table.tenantId, table.date),
  tenantIdIdx: index('daily_usage_tenant_id_idx').on(table.tenantId),
  dateIdx: index('daily_usage_date_idx').on(table.date),
}));

// ============================================================================
// BILLING & PAYMENTS
// ============================================================================

export const billingHistory = pgTable('billing_history', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  subscriptionId: varchar('subscription_id').references(() => tenantSubscriptions.id),

  // Invoice details
  invoiceNumber: varchar('invoice_number', { length: 50 }).unique(),
  invoiceDate: timestamp('invoice_date').notNull().defaultNow(),
  dueDate: timestamp('due_date').notNull(),
  paidDate: timestamp('paid_date'),

  // Amounts
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).default('0'),
  discount: decimal('discount', { precision: 10, scale: 2 }).default('0'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 10, scale: 2 }).default('0'),
  amountDue: decimal('amount_due', { precision: 10, scale: 2 }).notNull(),

  // Currency
  currency: varchar('currency', { length: 3 }).default('USD'),

  // Status
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // Statuses: pending, paid, failed, refunded, partially_refunded, voided

  // Payment details
  paymentMethod: varchar('payment_method', { length: 50 }), // card, bank_transfer, etc.
  stripeInvoiceId: varchar('stripe_invoice_id'),
  stripePaymentIntentId: varchar('stripe_payment_intent_id'),

  // Billing address
  billingEmail: varchar('billing_email'),
  billingAddress: jsonb('billing_address').default(sql`'{}'::jsonb`),

  // Line items
  lineItems: jsonb('line_items').notNull().default(sql`'[]'::jsonb`),

  // Notes
  notes: text('notes'),
  internalNotes: text('internal_notes'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('billing_history_tenant_id_idx').on(table.tenantId),
  statusIdx: index('billing_history_status_idx').on(table.status),
  invoiceDateIdx: index('billing_history_invoice_date_idx').on(table.invoiceDate),
}));

export const paymentMethods = pgTable('payment_methods', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Payment method type
  type: varchar('type', { length: 20 }).notNull(), // card, bank_account, paypal

  // Stripe integration
  stripePaymentMethodId: varchar('stripe_payment_method_id'),

  // Card details (last 4 digits, brand, etc.)
  cardBrand: varchar('card_brand', { length: 20 }), // visa, mastercard, amex
  cardLast4: varchar('card_last4', { length: 4 }),
  cardExpMonth: integer('card_exp_month'),
  cardExpYear: integer('card_exp_year'),

  // Bank account details
  bankName: varchar('bank_name', { length: 100 }),
  bankLast4: varchar('bank_last4', { length: 4 }),

  // Status
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),

  // Metadata
  billingDetails: jsonb('billing_details').default(sql`'{}'::jsonb`),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('payment_methods_tenant_id_idx').on(table.tenantId),
}));

// ============================================================================
// DISCOUNTS & PROMOTIONS
// ============================================================================

export const discounts = pgTable('discounts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),

  // Discount details
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),

  // Discount type
  type: varchar('type', { length: 20 }).notNull(), // percent, fixed, free_trial_extension
  percentOff: integer('percent_off'), // e.g., 20 for 20% off
  amountOff: decimal('amount_off', { precision: 10, scale: 2 }), // Fixed amount discount
  trialExtensionDays: integer('trial_extension_days'), // Additional trial days

  // Applicability
  appliesToPlans: jsonb('applies_to_plans').default(sql`'[]'::jsonb`), // Plan IDs, empty = all plans
  billingCycles: jsonb('billing_cycles').default(sql`'["monthly","annual"]'::jsonb`), // Which billing cycles

  // Duration
  duration: varchar('duration', { length: 20 }).notNull(), // once, repeating, forever
  durationMonths: integer('duration_months'), // For repeating discounts

  // Validity
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  maxRedemptions: integer('max_redemptions'), // null = unlimited
  redemptionCount: integer('redemption_count').default(0),

  // Restrictions
  firstTimeOnly: boolean('first_time_only').default(false), // Only for new customers
  minAmount: decimal('min_amount', { precision: 10, scale: 2 }), // Minimum purchase amount

  // Status
  isActive: boolean('is_active').default(true),

  // Metadata
  createdBy: varchar('created_by'), // Admin user ID
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  codeIdx: index('discounts_code_idx').on(table.code),
  isActiveIdx: index('discounts_is_active_idx').on(table.isActive),
}));

export const discountRedemptions = pgTable('discount_redemptions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  discountId: varchar('discount_id').notNull().references(() => discounts.id),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  subscriptionId: varchar('subscription_id').references(() => tenantSubscriptions.id),

  // Redemption details
  redeemedBy: varchar('redeemed_by').references(() => users.id), // User who applied the code
  amountDiscounted: decimal('amount_discounted', { precision: 10, scale: 2 }),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  discountIdIdx: index('discount_redemptions_discount_id_idx').on(table.discountId),
  tenantIdIdx: index('discount_redemptions_tenant_id_idx').on(table.tenantId),
}));

// ============================================================================
// ONBOARDING & TRIAL TRACKING
// ============================================================================

export const onboardingProgress = pgTable('onboarding_progress', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Onboarding flow
  flowType: varchar('flow_type', { length: 50 }).notNull(), // trial, paid, enterprise, free
  currentStep: varchar('current_step', { length: 50 }),
  completedSteps: jsonb('completed_steps').default(sql`'[]'::jsonb`),

  // Progress
  isComplete: boolean('is_complete').default(false),
  completedAt: timestamp('completed_at'),

  // Metadata
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('onboarding_progress_tenant_id_idx').on(table.tenantId),
  userIdIdx: index('onboarding_progress_user_id_idx').on(table.userId),
}));

// ============================================================================
// SUBSCRIPTION EVENTS & AUDIT LOG
// ============================================================================

export const subscriptionEvents = pgTable('subscription_events', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  subscriptionId: varchar('subscription_id').references(() => tenantSubscriptions.id),

  // Event details
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // Event types: created, trial_started, trial_ending_soon, trial_expired,
  //              upgraded, downgraded, canceled, reactivated, payment_succeeded,
  //              payment_failed, usage_exceeded, discount_applied

  // Context
  userId: varchar('user_id').references(() => users.id), // User who triggered the event
  fromPlan: varchar('from_plan'), // For upgrades/downgrades
  toPlan: varchar('to_plan'),

  // Event data
  data: jsonb('data').default(sql`'{}'::jsonb`),

  // Notification status
  notificationSent: boolean('notification_sent').default(false),
  notificationSentAt: timestamp('notification_sent_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('subscription_events_tenant_id_idx').on(table.tenantId),
  subscriptionIdIdx: index('subscription_events_subscription_id_idx').on(table.subscriptionId),
  eventTypeIdx: index('subscription_events_event_type_idx').on(table.eventType),
  createdAtIdx: index('subscription_events_created_at_idx').on(table.createdAt),
}));

// ============================================================================
// NOTIFICATIONS QUEUE
// ============================================================================

export const subscriptionNotifications = pgTable('subscription_notifications', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').references(() => users.id),

  // Notification details
  type: varchar('type', { length: 50 }).notNull(),
  // Types: trial_expiring, trial_expired, payment_failed, usage_limit_warning,
  //        usage_limit_exceeded, upgrade_available, discount_available

  priority: varchar('priority', { length: 20 }).default('normal'), // low, normal, high, urgent

  // Content
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  actionUrl: varchar('action_url'),
  actionText: varchar('action_text', { length: 50 }),

  // Delivery
  channels: jsonb('channels').default(sql`'["in_app"]'::jsonb`), // in_app, email, sms
  sentAt: timestamp('sent_at'),
  readAt: timestamp('read_at'),
  dismissedAt: timestamp('dismissed_at'),

  // Status
  status: varchar('status', { length: 20 }).default('pending'), // pending, sent, read, dismissed, failed

  // Retry logic
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  nextRetryAt: timestamp('next_retry_at'),

  // Metadata
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdIdx: index('subscription_notifications_tenant_id_idx').on(table.tenantId),
  userIdIdx: index('subscription_notifications_user_id_idx').on(table.userId),
  statusIdx: index('subscription_notifications_status_idx').on(table.status),
  typeIdx: index('subscription_notifications_type_idx').on(table.type),
}));

// ============================================================================
// EXPORTS
// ============================================================================

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type SubscriptionFeature = typeof subscriptionFeatures.$inferSelect;
export type NewSubscriptionFeature = typeof subscriptionFeatures.$inferInsert;

export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
export type NewTenantSubscription = typeof tenantSubscriptions.$inferInsert;

export type UsageMetric = typeof usageMetrics.$inferSelect;
export type NewUsageMetric = typeof usageMetrics.$inferInsert;

export type DailyUsageSnapshot = typeof dailyUsageSnapshots.$inferSelect;
export type NewDailyUsageSnapshot = typeof dailyUsageSnapshots.$inferInsert;

export type BillingHistory = typeof billingHistory.$inferSelect;
export type NewBillingHistory = typeof billingHistory.$inferInsert;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;

export type Discount = typeof discounts.$inferSelect;
export type NewDiscount = typeof discounts.$inferInsert;

export type DiscountRedemption = typeof discountRedemptions.$inferSelect;
export type NewDiscountRedemption = typeof discountRedemptions.$inferInsert;

export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type NewOnboardingProgress = typeof onboardingProgress.$inferInsert;

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type NewSubscriptionEvent = typeof subscriptionEvents.$inferInsert;

export type SubscriptionNotification = typeof subscriptionNotifications.$inferSelect;
export type NewSubscriptionNotification = typeof subscriptionNotifications.$inferInsert;
