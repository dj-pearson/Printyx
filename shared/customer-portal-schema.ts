import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Customer Portal Enums
export const customerPortalStatusEnum = pgEnum('customer_portal_status', [
  'active',
  'inactive',
  'suspended',
  'pending_activation'
]);

export const serviceRequestStatusEnum = pgEnum('service_request_status', [
  'submitted',
  'acknowledged', 
  'assigned',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled'
]);

export const serviceRequestPriorityEnum = pgEnum('service_request_priority', [
  'low',
  'normal',
  'high',
  'urgent',
  'emergency'
]);

export const serviceRequestTypeEnum = pgEnum('service_request_type', [
  'maintenance',
  'repair',
  'installation',
  'training',
  'supplies',
  'technical_support',
  'other'
]);

export const supplyOrderStatusEnum = pgEnum('supply_order_status', [
  'draft',
  'submitted',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_paid'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'credit_card',
  'ach',
  'wire_transfer',
  'check',
  'auto_pay'
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'service_update',
  'invoice_ready',
  'payment_due',
  'supply_low',
  'maintenance_reminder',
  'system_alert'
]);

export const meterSubmissionMethodEnum = pgEnum('meter_submission_method', [
  'manual_entry',
  'photo_upload',
  'email',
  'automated'
]);

// Customer Portal Access Management
export const customerPortalAccess = pgTable('customer_portal_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(), // Dealer's tenant ID
  customerId: uuid('customer_id').notNull(), // References customers table
  
  // Access credentials
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  
  // Account status
  status: customerPortalStatusEnum('status').default('pending_activation').notNull(),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  
  // Password reset
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  
  // Session management
  lastLoginAt: timestamp('last_login_at'),
  sessionToken: varchar('session_token', { length: 255 }),
  sessionExpires: timestamp('session_expires'),
  
  // Access permissions
  permissions: jsonb('permissions').default({
    'canViewInvoices': true,
    'canSubmitServiceRequests': true,
    'canOrderSupplies': true,
    'canSubmitMeterReadings': true,
    'canViewServiceHistory': true,
    'canMakePayments': true
  }).notNull(),
  
  // Settings
  preferences: jsonb('preferences').default({
    'emailNotifications': true,
    'smsNotifications': false,
    'language': 'en',
    'timezone': 'America/New_York'
  }).notNull(),
  
  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
  createdBy: uuid('created_by'), // Staff member who created the access
}, (table) => ({
  tenantCustomerIdx: index('tenant_customer_idx').on(table.tenantId, table.customerId),
  statusIdx: index('portal_status_idx').on(table.status),
  emailIdx: index('portal_email_idx').on(table.email),
  usernameIdx: index('portal_username_idx').on(table.username),
}));

// Service Request System
export const customerServiceRequests = pgTable('customer_service_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  customerPortalUserId: uuid('customer_portal_user_id').notNull().references(() => customerPortalAccess.id),
  
  // Request details
  requestNumber: varchar('request_number', { length: 50 }).notNull().unique(), // AUTO-generated
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  type: serviceRequestTypeEnum('type').notNull(),
  priority: serviceRequestPriorityEnum('priority').default('normal').notNull(),
  status: serviceRequestStatusEnum('status').default('submitted').notNull(),
  
  // Equipment information
  equipmentId: uuid('equipment_id'), // References equipment table
  equipmentSerialNumber: varchar('equipment_serial_number', { length: 100 }),
  equipmentModel: varchar('equipment_model', { length: 100 }),
  equipmentLocation: varchar('equipment_location', { length: 255 }),
  
  // Contact information
  contactName: varchar('contact_name', { length: 100 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 20 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  
  // Scheduling
  preferredDate: timestamp('preferred_date'),
  preferredTime: varchar('preferred_time', { length: 50 }),
  urgencyNotes: text('urgency_notes'),
  
  // Assignment and tracking
  assignedTechnicianId: uuid('assigned_technician_id'), // References technicians table
  serviceTicketId: uuid('service_ticket_id'), // Links to internal service ticket
  estimatedCompletionDate: timestamp('estimated_completion_date'),
  actualCompletionDate: timestamp('actual_completion_date'),
  
  // Communication
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  resolutionNotes: text('resolution_notes'),
  
  // Attachments
  attachments: jsonb('attachments').default([]).notNull(), // Array of attachment objects
  
  // Ratings and feedback
  customerRating: integer('customer_rating'), // 1-5 stars
  customerFeedback: text('customer_feedback'),
  
  // Metadata
  submittedAt: timestamp('submitted_at').default(sql`now()`).notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantCustomerIdx: index('tenant_customer_service_idx').on(table.tenantId, table.customerId),
  statusIdx: index('service_request_status_idx').on(table.status),
  priorityIdx: index('service_request_priority_idx').on(table.priority),
  typeIdx: index('service_request_type_idx').on(table.type),
  submittedDateIdx: index('service_request_submitted_idx').on(table.submittedAt),
  requestNumberIdx: index('service_request_number_idx').on(table.requestNumber),
}));

// Customer Meter Reading Submissions
export const customerMeterSubmissions = pgTable('customer_meter_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  customerPortalUserId: uuid('customer_portal_user_id').notNull().references(() => customerPortalAccess.id),
  
  // Equipment information
  equipmentId: uuid('equipment_id').notNull(), // References equipment table
  equipmentSerialNumber: varchar('equipment_serial_number', { length: 100 }).notNull(),
  
  // Meter readings
  totalImpressions: integer('total_impressions'),
  blackWhiteImpressions: integer('black_white_impressions'),
  colorImpressions: integer('color_impressions'),
  largeFormatImpressions: integer('large_format_impressions'),
  scanImpressions: integer('scan_impressions'),
  faxImpressions: integer('fax_impressions'),
  
  // Submission details
  submissionMethod: meterSubmissionMethodEnum('submission_method').notNull(),
  readingDate: timestamp('reading_date').notNull(),
  submissionDate: timestamp('submission_date').default(sql`now()`).notNull(),
  
  // Photo evidence (if applicable)
  photoUrls: jsonb('photo_urls').default([]).notNull(), // Array of photo URLs
  
  // Validation and processing
  isValidated: boolean('is_validated').default(false).notNull(),
  validatedBy: uuid('validated_by'), // Staff member who validated
  validatedAt: timestamp('validated_at'),
  validationNotes: text('validation_notes'),
  
  // Integration with billing
  isBilled: boolean('is_billed').default(false).notNull(),
  billingDate: timestamp('billing_date'),
  invoiceId: uuid('invoice_id'), // References invoice table
  
  // Notes
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
}, (table) => ({
  tenantCustomerIdx: index('tenant_customer_meter_idx').on(table.tenantId, table.customerId),
  equipmentIdx: index('meter_equipment_idx').on(table.equipmentId),
  readingDateIdx: index('meter_reading_date_idx').on(table.readingDate),
  submissionDateIdx: index('meter_submission_date_idx').on(table.submissionDate),
  validationIdx: index('meter_validation_idx').on(table.isValidated),
}));

// Supply Orders
export const customerSupplyOrders = pgTable('customer_supply_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  customerPortalUserId: uuid('customer_portal_user_id').notNull().references(() => customerPortalAccess.id),
  
  // Order details
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(), // AUTO-generated
  status: supplyOrderStatusEnum('status').default('draft').notNull(),
  
  // Delivery information
  deliveryAddress: jsonb('delivery_address').notNull(), // Address object
  deliveryInstructions: text('delivery_instructions'),
  requestedDeliveryDate: timestamp('requested_delivery_date'),
  actualDeliveryDate: timestamp('actual_delivery_date'),
  
  // Order totals
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).default('0.00').notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).default('0.00').notNull(),
  shipping: decimal('shipping', { precision: 10, scale: 2 }).default('0.00').notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).default('0.00').notNull(),
  
  // Payment and billing
  isContractCovered: boolean('is_contract_covered').default(false).notNull(),
  contractId: uuid('contract_id'), // References contract table
  purchaseOrderNumber: varchar('purchase_order_number', { length: 100 }),
  
  // Fulfillment
  trackingNumber: varchar('tracking_number', { length: 100 }),
  carrier: varchar('carrier', { length: 50 }),
  shippedAt: timestamp('shipped_at'),
  
  // Notes
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  
  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  submittedAt: timestamp('submitted_at'),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantCustomerIdx: index('tenant_customer_supply_idx').on(table.tenantId, table.customerId),
  statusIdx: index('supply_order_status_idx').on(table.status),
  orderNumberIdx: index('supply_order_number_idx').on(table.orderNumber),
  submittedDateIdx: index('supply_order_submitted_idx').on(table.submittedAt),
}));

// Supply Order Items
export const customerSupplyOrderItems = pgTable('customer_supply_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => customerSupplyOrders.id, { onDelete: 'cascade' }),
  
  // Product information
  productId: uuid('product_id').notNull(), // References supplies or products table
  productSku: varchar('product_sku', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  productDescription: text('product_description'),
  
  // Equipment compatibility
  compatibleEquipmentId: uuid('compatible_equipment_id'), // References equipment table
  
  // Ordering details
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  
  // Availability
  inStock: boolean('in_stock').default(true).notNull(),
  estimatedShipDate: timestamp('estimated_ship_date'),
  
  // Notes
  customerNotes: text('customer_notes'),
}, (table) => ({
  orderIdx: index('supply_order_items_order_idx').on(table.orderId),
  productIdx: index('supply_order_items_product_idx').on(table.productId),
}));

// Customer Payments
export const customerPayments = pgTable('customer_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  customerPortalUserId: uuid('customer_portal_user_id').references(() => customerPortalAccess.id),
  
  // Payment details
  paymentNumber: varchar('payment_number', { length: 50 }).notNull().unique(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  status: paymentStatusEnum('status').default('pending').notNull(),
  
  // Invoice information
  invoiceId: uuid('invoice_id'), // References invoice table
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  
  // Payment processing
  transactionId: varchar('transaction_id', { length: 255 }), // External payment processor ID
  processorName: varchar('processor_name', { length: 100 }), // Stripe, PayPal, etc.
  processorResponse: jsonb('processor_response'), // Full response from payment processor
  
  // Payment method details (encrypted)
  paymentMethodDetails: jsonb('payment_method_details'), // Encrypted card/bank details
  
  // Dates
  paymentDate: timestamp('payment_date').default(sql`now()`).notNull(),
  processedAt: timestamp('processed_at'),
  
  // Notes
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  
  // Failed payment handling
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at'),
}, (table) => ({
  tenantCustomerIdx: index('tenant_customer_payment_idx').on(table.tenantId, table.customerId),
  statusIdx: index('payment_status_idx').on(table.status),
  paymentNumberIdx: index('payment_number_idx').on(table.paymentNumber),
  paymentDateIdx: index('payment_date_idx').on(table.paymentDate),
  invoiceIdx: index('payment_invoice_idx').on(table.invoiceId),
}));

// Customer Notifications
export const customerNotifications = pgTable('customer_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  customerPortalUserId: uuid('customer_portal_user_id').references(() => customerPortalAccess.id),
  
  // Notification details
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  
  // Delivery channels
  isEmailSent: boolean('is_email_sent').default(false).notNull(),
  emailSentAt: timestamp('email_sent_at'),
  isSmsCapable: boolean('is_sms_capable').default(false).notNull(),
  isSmsSent: boolean('is_sms_sent').default(false).notNull(),
  smsSentAt: timestamp('sms_sent_at'),
  
  // Portal notification
  isPortalRead: boolean('is_portal_read').default(false).notNull(),
  portalReadAt: timestamp('portal_read_at'),
  
  // Related records
  relatedServiceRequestId: uuid('related_service_request_id').references(() => customerServiceRequests.id),
  relatedInvoiceId: uuid('related_invoice_id'), // References invoice table
  relatedPaymentId: uuid('related_payment_id').references(() => customerPayments.id),
  relatedSupplyOrderId: uuid('related_supply_order_id').references(() => customerSupplyOrders.id),
  
  // Priority and scheduling
  priority: varchar('priority', { length: 20 }).default('normal').notNull(),
  scheduledSendAt: timestamp('scheduled_send_at'),
  expiresAt: timestamp('expires_at'),
  
  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  sentAt: timestamp('sent_at'),
}, (table) => ({
  tenantCustomerIdx: index('tenant_customer_notification_idx').on(table.tenantId, table.customerId),
  typeIdx: index('notification_type_idx').on(table.type),
  createdDateIdx: index('notification_created_idx').on(table.createdAt),
  unreadPortalIdx: index('unread_portal_notifications_idx').on(table.isPortalRead),
}));

// Customer Portal Activity Log
export const customerPortalActivityLog = pgTable('customer_portal_activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  customerPortalUserId: uuid('customer_portal_user_id').references(() => customerPortalAccess.id),
  
  // Activity details
  action: varchar('action', { length: 100 }).notNull(), // login, logout, view_invoice, submit_request, etc.
  description: text('description'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  // Related records
  relatedRecordType: varchar('related_record_type', { length: 50 }), // invoice, service_request, etc.
  relatedRecordId: uuid('related_record_id'),
  
  // Metadata
  timestamp: timestamp('timestamp').default(sql`now()`).notNull(),
}, (table) => ({
  tenantCustomerIdx: index('tenant_customer_activity_idx').on(table.tenantId, table.customerId),
  actionIdx: index('activity_action_idx').on(table.action),
  timestampIdx: index('activity_timestamp_idx').on(table.timestamp),
}));

// Relations
export const customerPortalAccessRelations = relations(customerPortalAccess, ({ many }) => ({
  serviceRequests: many(customerServiceRequests),
  meterSubmissions: many(customerMeterSubmissions),
  supplyOrders: many(customerSupplyOrders),
  payments: many(customerPayments),
  notifications: many(customerNotifications),
  activityLogs: many(customerPortalActivityLog),
}));

export const customerServiceRequestsRelations = relations(customerServiceRequests, ({ one, many }) => ({
  portalUser: one(customerPortalAccess, {
    fields: [customerServiceRequests.customerPortalUserId],
    references: [customerPortalAccess.id],
  }),
  notifications: many(customerNotifications),
}));

export const customerSupplyOrdersRelations = relations(customerSupplyOrders, ({ one, many }) => ({
  portalUser: one(customerPortalAccess, {
    fields: [customerSupplyOrders.customerPortalUserId],
    references: [customerPortalAccess.id],
  }),
  items: many(customerSupplyOrderItems),
  notifications: many(customerNotifications),
}));

export const customerSupplyOrderItemsRelations = relations(customerSupplyOrderItems, ({ one }) => ({
  order: one(customerSupplyOrders, {
    fields: [customerSupplyOrderItems.orderId],
    references: [customerSupplyOrders.id],
  }),
}));

export const customerPaymentsRelations = relations(customerPayments, ({ one, many }) => ({
  portalUser: one(customerPortalAccess, {
    fields: [customerPayments.customerPortalUserId],
    references: [customerPortalAccess.id],
  }),
  notifications: many(customerNotifications),
}));

export const customerNotificationsRelations = relations(customerNotifications, ({ one }) => ({
  portalUser: one(customerPortalAccess, {
    fields: [customerNotifications.customerPortalUserId],
    references: [customerPortalAccess.id],
  }),
  serviceRequest: one(customerServiceRequests, {
    fields: [customerNotifications.relatedServiceRequestId],
    references: [customerServiceRequests.id],
  }),
  payment: one(customerPayments, {
    fields: [customerNotifications.relatedPaymentId],
    references: [customerPayments.id],
  }),
  supplyOrder: one(customerSupplyOrders, {
    fields: [customerNotifications.relatedSupplyOrderId],
    references: [customerSupplyOrders.id],
  }),
}));

// Zod schemas for validation
export const insertCustomerPortalAccessSchema = createInsertSchema(customerPortalAccess);
export const insertCustomerServiceRequestSchema = createInsertSchema(customerServiceRequests);
export const insertCustomerMeterSubmissionSchema = createInsertSchema(customerMeterSubmissions);
export const insertCustomerSupplyOrderSchema = createInsertSchema(customerSupplyOrders);
export const insertCustomerSupplyOrderItemSchema = createInsertSchema(customerSupplyOrderItems);
export const insertCustomerPaymentSchema = createInsertSchema(customerPayments);
export const insertCustomerNotificationSchema = createInsertSchema(customerNotifications);
export const insertCustomerPortalActivityLogSchema = createInsertSchema(customerPortalActivityLog);

// TypeScript types
export type CustomerPortalAccess = typeof customerPortalAccess.$inferSelect;
export type InsertCustomerPortalAccess = typeof customerPortalAccess.$inferInsert;
export type CustomerServiceRequest = typeof customerServiceRequests.$inferSelect;
export type InsertCustomerServiceRequest = typeof customerServiceRequests.$inferInsert;
export type CustomerMeterSubmission = typeof customerMeterSubmissions.$inferSelect;
export type InsertCustomerMeterSubmission = typeof customerMeterSubmissions.$inferInsert;
export type CustomerSupplyOrder = typeof customerSupplyOrders.$inferSelect;
export type InsertCustomerSupplyOrder = typeof customerSupplyOrders.$inferInsert;
export type CustomerSupplyOrderItem = typeof customerSupplyOrderItems.$inferSelect;
export type InsertCustomerSupplyOrderItem = typeof customerSupplyOrderItems.$inferInsert;
export type CustomerPayment = typeof customerPayments.$inferSelect;
export type InsertCustomerPayment = typeof customerPayments.$inferInsert;
export type CustomerNotification = typeof customerNotifications.$inferSelect;
export type InsertCustomerNotification = typeof customerNotifications.$inferInsert;
export type CustomerPortalActivityLog = typeof customerPortalActivityLog.$inferSelect;
export type InsertCustomerPortalActivityLog = typeof customerPortalActivityLog.$inferInsert;