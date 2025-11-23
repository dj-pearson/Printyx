import { pgTable, text, integer, boolean, timestamp, jsonb, decimal, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Auto-Supply Replenishment Schema
 *
 * Automated toner and supplies ordering system that uses AI to:
 * - Monitor supply levels across all equipment
 * - Predict when supplies will run out based on usage patterns
 * - Automatically order supplies before depletion
 * - Optimize order timing and quantities
 * - Reduce emergency orders and downtime
 */

export const supplyReplenishmentStatusEnum = pgEnum('supply_replenishment_status', [
  'monitoring',           // Actively tracking supply levels
  'predicted_low',        // AI predicts will be low soon
  'low',                  // Below threshold, order triggered
  'order_placed',         // Order automatically created
  'order_confirmed',      // Order confirmed with supplier
  'in_transit',           // Supply shipment in transit
  'delivered',            // Delivered to customer
  'installed',            // Technician installed the supply
  'cancelled'             // Order cancelled
]);

export const supplyTypeEnum = pgEnum('supply_type', [
  'toner_black',
  'toner_cyan',
  'toner_magenta',
  'toner_yellow',
  'drum',
  'fuser',
  'transfer_belt',
  'waste_toner_bottle',
  'staples',
  'paper'
]);

export const orderPriorityEnum = pgEnum('order_priority', [
  'low',              // 30+ days remaining
  'medium',           // 15-30 days remaining
  'high',             // 7-14 days remaining
  'urgent',           // <7 days remaining
  'critical'          // <3 days or depleted
]);

/**
 * Supply Monitoring Table
 * Tracks supply levels for all equipment with AI-powered predictions
 */
export const supplyMonitoring = pgTable('supply_monitoring', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull(),

  // Equipment Reference
  equipmentId: integer('equipment_id').notNull(),
  serialNumber: text('serial_number').notNull(),
  model: text('model').notNull(),
  location: text('location'),

  // Supply Details
  supplyType: supplyTypeEnum('supply_type').notNull(),
  supplyName: text('supply_name').notNull(),              // e.g., "Black Toner TN-221BK"
  partNumber: text('part_number'),                        // Manufacturer part number
  currentLevel: integer('current_level').notNull(),       // Current level (0-100%)
  capacityPages: integer('capacity_pages'),               // Total page capacity

  // Usage Analytics
  dailyUsageAverage: decimal('daily_usage_average', { precision: 10, scale: 2 }), // Pages per day
  weeklyUsageAverage: decimal('weekly_usage_average', { precision: 10, scale: 2 }),
  monthlyUsageAverage: decimal('monthly_usage_average', { precision: 10, scale: 2 }),
  usageTrend: text('usage_trend'),                        // 'increasing', 'stable', 'decreasing'

  // AI Predictions
  predictedDepletionDate: timestamp('predicted_depletion_date'),
  daysUntilDepletion: integer('days_until_depletion'),
  confidenceScore: integer('confidence_score'),           // 0-100 confidence in prediction
  aiAnalysis: jsonb('ai_analysis'),                       // Detailed AI analysis from Claude

  // Ordering Configuration
  reorderThreshold: integer('reorder_threshold').default(20),  // Reorder at 20% remaining
  reorderQuantity: integer('reorder_quantity').default(1),
  autoOrderEnabled: boolean('auto_order_enabled').default(true),

  // Status & Alerts
  status: supplyReplenishmentStatusEnum('status').default('monitoring'),
  priority: orderPriorityEnum('priority').default('low'),
  alertSent: boolean('alert_sent').default(false),
  alertSentAt: timestamp('alert_sent_at'),

  // Last Update
  lastCheckedAt: timestamp('last_checked_at').notNull().defaultNow(),
  lastOrderedAt: timestamp('last_ordered_at'),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

/**
 * Auto Supply Orders Table
 * Tracks automatically generated supply orders
 */
export const autoSupplyOrders = pgTable('auto_supply_orders', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull(),

  // Reference
  supplyMonitoringId: integer('supply_monitoring_id').notNull(),
  equipmentId: integer('equipment_id').notNull(),
  serialNumber: text('serial_number').notNull(),

  // Order Details
  orderNumber: text('order_number').notNull().unique(),   // AUTO-{timestamp}-{random}
  supplyType: supplyTypeEnum('supply_type').notNull(),
  supplyName: text('supply_name').notNull(),
  partNumber: text('part_number'),
  quantity: integer('quantity').notNull().default(1),

  // Supplier Information
  supplierId: integer('supplier_id'),
  supplierName: text('supplier_name'),
  supplierOrderId: text('supplier_order_id'),             // External order ID

  // Pricing
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }),
  shippingCost: decimal('shipping_cost', { precision: 10, scale: 2 }),

  // Timing
  orderDate: timestamp('order_date').notNull().defaultNow(),
  estimatedDeliveryDate: timestamp('estimated_delivery_date'),
  actualDeliveryDate: timestamp('actual_delivery_date'),
  installationDate: timestamp('installation_date'),

  // Status
  status: supplyReplenishmentStatusEnum('status').default('order_placed'),
  priority: orderPriorityEnum('priority').default('medium'),

  // Automation Details
  triggeredBy: text('triggered_by').default('ai_prediction'),  // 'ai_prediction', 'threshold', 'manual'
  preventedEmergency: boolean('prevented_emergency').default(false),
  customerNotified: boolean('customer_notified').default(false),
  customerNotifiedAt: timestamp('customer_notified_at'),

  // Tracking
  trackingNumber: text('tracking_number'),
  trackingUrl: text('tracking_url'),
  carrier: text('carrier'),

  // Notes
  notes: text('notes'),
  cancellationReason: text('cancellation_reason'),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

/**
 * Supply Usage History Table
 * Historical tracking for AI learning and pattern analysis
 */
export const supplyUsageHistory = pgTable('supply_usage_history', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull(),

  // Reference
  supplyMonitoringId: integer('supply_monitoring_id').notNull(),
  equipmentId: integer('equipment_id').notNull(),
  serialNumber: text('serial_number').notNull(),

  // Supply Info
  supplyType: supplyTypeEnum('supply_type').notNull(),
  supplyName: text('supply_name').notNull(),

  // Usage Data
  dateRecorded: timestamp('date_recorded').notNull().defaultNow(),
  levelPercentage: integer('level_percentage').notNull(),  // Level at time of recording
  pagesRemaining: integer('pages_remaining'),
  pagesPrinted: integer('pages_printed'),                  // Total pages on device
  pagesSinceLastReading: integer('pages_since_last_reading'),

  // Context
  dayOfWeek: integer('day_of_week'),                       // 0-6 (Sunday-Saturday)
  monthOfYear: integer('month_of_year'),                   // 1-12
  isWeekend: boolean('is_weekend').default(false),
  isHoliday: boolean('is_holiday').default(false),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow()
});

/**
 * Supply Replenishment Rules Table
 * Tenant-specific automation rules and preferences
 */
export const supplyReplenishmentRules = pgTable('supply_replenishment_rules', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull().unique(),

  // Global Settings
  autoOrderEnabled: boolean('auto_order_enabled').default(true),
  requireApproval: boolean('require_approval').default(false),
  approvalThreshold: decimal('approval_threshold', { precision: 10, scale: 2 }).default('500.00'), // Dollar amount

  // Default Thresholds
  defaultReorderThreshold: integer('default_reorder_threshold').default(20),  // 20%
  urgentThreshold: integer('urgent_threshold').default(10),                   // 10%
  criticalThreshold: integer('critical_threshold').default(5),                // 5%

  // Lead Times (days)
  defaultLeadTime: integer('default_lead_time').default(3),
  bufferDays: integer('buffer_days').default(7),           // Safety buffer for predictions

  // Supplier Preferences
  preferredSupplierId: integer('preferred_supplier_id'),
  alternateSupplierIds: jsonb('alternate_supplier_ids'),   // Array of supplier IDs

  // Notifications
  notifyOnOrderPlaced: boolean('notify_on_order_placed').default(true),
  notifyOnDelivery: boolean('notify_on_delivery').default(true),
  notifyCustomers: boolean('notify_customers').default(true),
  notificationEmail: text('notification_email'),
  notificationPhone: text('notification_phone'),

  // Business Rules
  orderDaysOfWeek: jsonb('order_days_of_week').default('[1,2,3,4,5]'),  // Mon-Fri
  noOrderHolidays: boolean('no_order_holidays').default(true),
  consolidateOrders: boolean('consolidate_orders').default(true),        // Batch orders from same customer
  consolidationWindow: integer('consolidation_window').default(24),      // Hours

  // AI Configuration
  aiPredictionEnabled: boolean('ai_prediction_enabled').default(true),
  minimumConfidenceScore: integer('minimum_confidence_score').default(70),  // 70%
  usageHistoryDays: integer('usage_history_days').default(90),              // 90 days of history for AI

  // Cost Controls
  maxOrderValue: decimal('max_order_value', { precision: 10, scale: 2 }),
  monthlyBudget: decimal('monthly_budget', { precision: 10, scale: 2 }),
  currentMonthSpend: decimal('current_month_spend', { precision: 10, scale: 2 }).default('0.00'),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

/**
 * Supply Replenishment Analytics Table
 * Performance tracking and ROI metrics
 */
export const supplyReplenishmentAnalytics = pgTable('supply_replenishment_analytics', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull(),

  // Time Period
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  periodType: text('period_type').notNull(),              // 'daily', 'weekly', 'monthly'

  // Order Metrics
  totalOrders: integer('total_orders').default(0),
  autoOrders: integer('auto_orders').default(0),
  manualOrders: integer('manual_orders').default(0),
  emergencyOrdersPrevented: integer('emergency_orders_prevented').default(0),

  // Financial Metrics
  totalSpend: decimal('total_spend', { precision: 10, scale: 2 }).default('0.00'),
  emergencyCostSavings: decimal('emergency_cost_savings', { precision: 10, scale: 2 }).default('0.00'),
  bulkDiscountSavings: decimal('bulk_discount_savings', { precision: 10, scale: 2 }).default('0.00'),

  // Performance Metrics
  averageLeadTime: decimal('average_lead_time', { precision: 10, scale: 2 }),        // Days
  onTimeDeliveryRate: decimal('on_time_delivery_rate', { precision: 5, scale: 2 }), // Percentage
  predictionAccuracy: decimal('prediction_accuracy', { precision: 5, scale: 2 }),   // Percentage
  stockoutsPrevented: integer('stockouts_prevented').default(0),
  downtimeHoursPrevented: decimal('downtime_hours_prevented', { precision: 10, scale: 2 }).default('0.00'),

  // Customer Impact
  customerSatisfactionScore: decimal('customer_satisfaction_score', { precision: 5, scale: 2 }),
  complaintsReceived: integer('complaints_received').default(0),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Relations
export const supplyMonitoringRelations = relations(supplyMonitoring, ({ many }) => ({
  orders: many(autoSupplyOrders),
  usageHistory: many(supplyUsageHistory)
}));

export const autoSupplyOrdersRelations = relations(autoSupplyOrders, ({ one }) => ({
  supplyMonitoring: one(supplyMonitoring, {
    fields: [autoSupplyOrders.supplyMonitoringId],
    references: [supplyMonitoring.id]
  })
}));

export const supplyUsageHistoryRelations = relations(supplyUsageHistory, ({ one }) => ({
  supplyMonitoring: one(supplyMonitoring, {
    fields: [supplyUsageHistory.supplyMonitoringId],
    references: [supplyMonitoring.id]
  })
}));
