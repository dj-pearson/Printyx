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
  phone: varchar('phone', { length: 20 }), // E.164 format for SMS notifications
  
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

// Service Request Status History
export const customerServiceRequestStatusHistory = pgTable('customer_service_request_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  serviceRequestId: uuid('service_request_id').references(() => customerServiceRequests.id).notNull(),
  
  // Status change details
  previousStatus: serviceRequestStatusEnum('previous_status'),
  newStatus: serviceRequestStatusEnum('new_status').notNull(),
  changeReason: text('change_reason'),
  customerVisibleNotes: text('customer_visible_notes'),
  internalNotes: text('internal_notes'),
  
  // Changed by
  changedByType: varchar('changed_by_type', { length: 50 }).notNull(), // customer, dealer_user, system, technician
  changedById: uuid('changed_by_id'), // References users table or portal access
  changedByName: varchar('changed_by_name', { length: 255 }).notNull(),
  
  // Expected completion (if status indicates progress)
  estimatedCompletionDate: timestamp('estimated_completion_date'),
  actualCompletionDate: timestamp('actual_completion_date'),
  
  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantIdx: index('status_history_tenant_idx').on(table.tenantId),
  serviceRequestIdx: index('status_history_request_idx').on(table.serviceRequestId),
  statusIdx: index('status_history_status_idx').on(table.newStatus),
  timelineIdx: index('status_history_timeline_idx').on(table.serviceRequestId, table.createdAt),
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
  statusHistory: many(customerServiceRequestStatusHistory),
}));

export const customerServiceRequestStatusHistoryRelations = relations(customerServiceRequestStatusHistory, ({ one }) => ({
  serviceRequest: one(customerServiceRequests, {
    fields: [customerServiceRequestStatusHistory.serviceRequestId],
    references: [customerServiceRequests.id],
  }),
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

// Maintenance Scheduling Enums
export const maintenanceTypeEnum = pgEnum('maintenance_type', [
  'routine_maintenance',
  'preventive_maintenance', 
  'deep_cleaning',
  'firmware_update',
  'parts_replacement',
  'calibration',
  'inspection'
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rescheduled'
]);

// Satisfaction Rating System Enums
export const satisfactionSurveyTypeEnum = pgEnum('satisfaction_survey_type', [
  'service_request_completion',
  'maintenance_appointment',
  'supply_delivery',
  'technical_support',
  'general_experience',
  'annual_review'
]);

export const satisfactionQuestionTypeEnum = pgEnum('satisfaction_question_type', [
  'rating_scale', // 1-5 or 1-10 scale
  'yes_no',
  'multiple_choice',
  'text_short',
  'text_long',
  'nps_score' // Net Promoter Score 0-10
]);

export const satisfactionResponseStatusEnum = pgEnum('satisfaction_response_status', [
  'invited',
  'started',
  'completed',
  'expired',
  'skipped'
]);

// Customer Maintenance Appointments
export const customerMaintenanceAppointments = pgTable("customer_maintenance_appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  portalUserId: varchar("portal_user_id").references(() => customerPortalAccess.id),
  
  // Equipment information
  equipmentId: varchar("equipment_id"),
  equipmentName: varchar("equipment_name"),
  equipmentMake: varchar("equipment_make"),
  equipmentModel: varchar("equipment_model"),
  equipmentSerial: varchar("equipment_serial"),
  equipmentLocation: varchar("equipment_location"),
  
  // Appointment details
  maintenanceType: maintenanceTypeEnum("maintenance_type").notNull(),
  appointmentDate: timestamp("appointment_date").notNull(),
  appointmentTime: varchar("appointment_time").notNull(), // HH:MM format
  duration: integer("duration").notNull().default(60), // minutes
  timeZone: varchar("time_zone").default("America/New_York"),
  
  // Assignment
  assignedTechnicianId: varchar("assigned_technician_id"),
  technicianName: varchar("technician_name"),
  
  // Status and confirmation
  status: appointmentStatusEnum("status").notNull().default('requested'),
  confirmationCode: varchar("confirmation_code"),
  confirmedAt: timestamp("confirmed_at"),
  
  // Service details
  description: text("description"),
  serviceNotes: text("service_notes"),
  specialInstructions: text("special_instructions"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  
  // Customer contact preferences
  contactMethod: varchar("contact_method").default('email'), // email, phone, text
  customerPhone: varchar("customer_phone"),
  customerEmail: varchar("customer_email"),
  
  // Rescheduling tracking
  originalDate: timestamp("original_date"),
  rescheduleCount: integer("reschedule_count").default(0),
  rescheduleReason: text("reschedule_reason"),
  
  // Integration with service requests
  serviceRequestId: varchar("service_request_id"),
  serviceTicketId: varchar("service_ticket_id"),
  
  // Notifications
  reminderSent: boolean("reminder_sent").default(false),
  reminderSentAt: timestamp("reminder_sent_at"),
  confirmationSent: boolean("confirmation_sent").default(false),
  
  // Completion tracking
  completedAt: timestamp("completed_at"),
  customerSatisfactionRating: integer("customer_satisfaction_rating"), // 1-5
  customerFeedback: text("customer_feedback"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comprehensive Customer Satisfaction Rating System

// Survey Templates - Different questionnaires for different service types
export const customerSatisfactionSurveyTemplates = pgTable('customer_satisfaction_survey_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  
  // Template details
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  surveyType: satisfactionSurveyTypeEnum('survey_type').notNull(),
  
  // Configuration
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(), // Default template for this survey type
  
  // Timing settings
  sendDelayHours: integer('send_delay_hours').default(24).notNull(), // Hours after service completion
  reminderDelayHours: integer('reminder_delay_hours').default(72).notNull(),
  expiryDays: integer('expiry_days').default(14).notNull(),
  
  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
  createdBy: uuid('created_by'), // Staff member who created
}, (table) => ({
  tenantTypeIdx: index('survey_template_tenant_type_idx').on(table.tenantId, table.surveyType),
  activeIdx: index('survey_template_active_idx').on(table.isActive),
}));

// Survey Questions - Individual questions within templates
export const customerSatisfactionSurveyQuestions = pgTable('customer_satisfaction_survey_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => customerSatisfactionSurveyTemplates.id, { onDelete: 'cascade' }),
  
  // Question details
  questionText: text('question_text').notNull(),
  questionType: satisfactionQuestionTypeEnum('question_type').notNull(),
  isRequired: boolean('is_required').default(false).notNull(),
  orderIndex: integer('order_index').notNull(),
  
  // Question configuration
  ratingScale: jsonb('rating_scale').default({
    min: 1,
    max: 5,
    labels: ['Very Poor', 'Poor', 'Fair', 'Good', 'Excellent']
  }), // For rating_scale questions
  multipleChoiceOptions: jsonb('multiple_choice_options').default([]), // For multiple_choice questions
  
  // Conditional logic
  dependsOnQuestion: uuid('depends_on_question'), // References another question ID
  showCondition: jsonb('show_condition'), // Condition to show this question
  
  // Analytics
  category: varchar('category', { length: 100 }), // service_quality, timeliness, communication, etc.
  weight: decimal('weight', { precision: 3, scale: 2 }).default('1.00'), // Weight for overall score calculation
  
  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  templateOrderIdx: index('survey_question_template_order_idx').on(table.templateId, table.orderIndex),
  categoryIdx: index('survey_question_category_idx').on(table.category),
}));

// Customer Satisfaction Surveys - Individual survey instances sent to customers
export const customerSatisfactionSurveys = pgTable('customer_satisfaction_surveys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  customerPortalUserId: uuid('customer_portal_user_id').references(() => customerPortalAccess.id),
  templateId: uuid('template_id').notNull().references(() => customerSatisfactionSurveyTemplates.id),
  
  // Survey details
  surveyType: satisfactionSurveyTypeEnum('survey_type').notNull(),
  status: satisfactionResponseStatusEnum('status').default('invited').notNull(),
  
  // Related service records
  relatedServiceRequestId: uuid('related_service_request_id').references(() => customerServiceRequests.id),
  relatedMaintenanceAppointmentId: uuid('related_maintenance_appointment_id').references(() => customerMaintenanceAppointments.id),
  relatedSupplyOrderId: uuid('related_supply_order_id').references(() => customerSupplyOrders.id),
  relatedPaymentId: uuid('related_payment_id').references(() => customerPayments.id),
  
  // Survey lifecycle
  invitationSentAt: timestamp('invitation_sent_at'),
  firstViewedAt: timestamp('first_viewed_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  expiresAt: timestamp('expires_at'),
  
  // Reminders
  reminderSentAt: timestamp('reminder_sent_at'),
  reminderCount: integer('reminder_count').default(0).notNull(),
  
  // Survey access
  accessToken: varchar('access_token', { length: 255 }).notNull().unique(), // Secure token for anonymous access
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  // Calculated scores (computed after completion)
  overallScore: decimal('overall_score', { precision: 4, scale: 2 }), // Weighted average
  npsScore: integer('nps_score'), // Net Promoter Score if applicable
  
  // Metadata
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantCustomerIdx: index('survey_tenant_customer_idx').on(table.tenantId, table.customerId),
  statusIdx: index('survey_status_idx').on(table.status),
  typeIdx: index('survey_type_idx').on(table.surveyType),
  completedDateIdx: index('survey_completed_idx').on(table.completedAt),
  accessTokenIdx: index('survey_access_token_idx').on(table.accessToken),
}));

// Survey Responses - Individual answers to questions
export const customerSatisfactionSurveyResponses = pgTable('customer_satisfaction_survey_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyId: uuid('survey_id').notNull().references(() => customerSatisfactionSurveys.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => customerSatisfactionSurveyQuestions.id),
  
  // Response data
  ratingValue: integer('rating_value'), // For rating_scale and nps_score questions
  textValue: text('text_value'), // For text questions
  selectedOptions: jsonb('selected_options').default([]), // For multiple_choice questions
  booleanValue: boolean('boolean_value'), // For yes_no questions
  
  // Response metadata
  timeSpentSeconds: integer('time_spent_seconds'), // Time spent on this question
  responseOrder: integer('response_order'), // Order in which questions were answered
  
  // Metadata
  answeredAt: timestamp('answered_at').default(sql`now()`).notNull(),
}, (table) => ({
  surveyQuestionIdx: index('survey_response_survey_question_idx').on(table.surveyId, table.questionId),
  ratingIdx: index('survey_response_rating_idx').on(table.ratingValue),
}));

// Satisfaction Analytics - Computed metrics and trends
export const customerSatisfactionAnalytics = pgTable('customer_satisfaction_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  
  // Analytics period
  periodType: varchar('period_type', { length: 20 }).notNull(), // daily, weekly, monthly, quarterly
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Satisfaction metrics
  totalSurveysSent: integer('total_surveys_sent').default(0).notNull(),
  totalSurveysCompleted: integer('total_surveys_completed').default(0).notNull(),
  responseRate: decimal('response_rate', { precision: 5, scale: 2 }).default('0.00'), // Percentage
  
  // Score breakdowns by service type
  serviceRequestScores: jsonb('service_request_scores').default({}),
  maintenanceScores: jsonb('maintenance_scores').default({}),
  supplyOrderScores: jsonb('supply_order_scores').default({}),
  
  // Overall metrics
  averageOverallScore: decimal('average_overall_score', { precision: 4, scale: 2 }),
  averageNpsScore: decimal('average_nps_score', { precision: 4, scale: 2 }),
  
  // Category breakdowns
  serviceQualityScore: decimal('service_quality_score', { precision: 4, scale: 2 }),
  timelinessScore: decimal('timeliness_score', { precision: 4, scale: 2 }),
  communicationScore: decimal('communication_score', { precision: 4, scale: 2 }),
  valueScore: decimal('value_score', { precision: 4, scale: 2 }),
  
  // Trends
  scoreChange: decimal('score_change', { precision: 4, scale: 2 }), // Change from previous period
  responseRateChange: decimal('response_rate_change', { precision: 5, scale: 2 }),
  
  // Metadata
  calculatedAt: timestamp('calculated_at').default(sql`now()`).notNull(),
  lastUpdated: timestamp('last_updated').default(sql`now()`).notNull(),
}, (table) => ({
  tenantPeriodIdx: index('analytics_tenant_period_idx').on(table.tenantId, table.periodType, table.periodStart),
  periodIdx: index('analytics_period_idx').on(table.periodStart, table.periodEnd),
}));

// Technician Availability Slots (for scheduling logic)
export const technicianAvailabilitySlots = pgTable("technician_availability_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  technicianId: varchar("technician_id").notNull(),
  technicianName: varchar("technician_name"),
  
  // Time slot
  date: timestamp("date").notNull(),
  startTime: varchar("start_time").notNull(), // HH:MM format
  endTime: varchar("end_time").notNull(), // HH:MM format
  duration: integer("duration").notNull(), // minutes
  
  // Availability status
  isAvailable: boolean("is_available").default(true),
  isBlocked: boolean("is_blocked").default(false),
  blockReason: varchar("block_reason"),
  
  // Appointment assignment
  appointmentId: varchar("appointment_id").references(() => customerMaintenanceAppointments.id),
  appointmentType: varchar("appointment_type"), // maintenance, service, demo
  
  // Location and travel
  serviceArea: varchar("service_area"),
  maxTravelDistance: integer("max_travel_distance"), // miles
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for maintenance scheduling
export const customerMaintenanceAppointmentsRelations = relations(customerMaintenanceAppointments, ({ one }) => ({
  portalUser: one(customerPortalAccess, {
    fields: [customerMaintenanceAppointments.portalUserId],
    references: [customerPortalAccess.id],
  }),
}));

export const technicianAvailabilitySlotsRelations = relations(technicianAvailabilitySlots, ({ one }) => ({
  appointment: one(customerMaintenanceAppointments, {
    fields: [technicianAvailabilitySlots.appointmentId],
    references: [customerMaintenanceAppointments.id],
  }),
}));

// Zod schemas for validation
export const insertCustomerPortalAccessSchema = createInsertSchema(customerPortalAccess);
export const insertCustomerServiceRequestSchema = createInsertSchema(customerServiceRequests);
export const insertCustomerServiceRequestStatusHistorySchema = createInsertSchema(customerServiceRequestStatusHistory);
export const insertCustomerMeterSubmissionSchema = createInsertSchema(customerMeterSubmissions);
export const insertCustomerSupplyOrderSchema = createInsertSchema(customerSupplyOrders);
export const insertCustomerSupplyOrderItemSchema = createInsertSchema(customerSupplyOrderItems);
export const insertCustomerPaymentSchema = createInsertSchema(customerPayments);
export const insertCustomerNotificationSchema = createInsertSchema(customerNotifications);
export const insertCustomerPortalActivityLogSchema = createInsertSchema(customerPortalActivityLog);
export const insertCustomerMaintenanceAppointmentSchema = createInsertSchema(customerMaintenanceAppointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTechnicianAvailabilitySlotSchema = createInsertSchema(technicianAvailabilitySlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Maintenance Scheduling Request Schemas
export const maintenanceSchedulingRequestSchema = z.object({
  equipmentId: z.string().optional(),
  maintenanceType: z.enum(['routine_maintenance', 'preventive_maintenance', 'deep_cleaning', 'firmware_update', 'parts_replacement', 'calibration', 'inspection']),
  appointmentDate: z.string(),
  appointmentTime: z.string(),
  duration: z.number().min(30).max(480).default(60),
  description: z.string().optional(),
  specialInstructions: z.string().optional(),
  contactMethod: z.enum(['email', 'phone', 'text']).default('email'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
});

export const availabilityRequestSchema = z.object({
  date: z.string(),
  duration: z.number().min(30).max(480).default(60),
  serviceArea: z.string().optional(),
  equipmentId: z.string().optional(),
});

export const rescheduleAppointmentSchema = z.object({
  appointmentId: z.string(),
  newDate: z.string(),
  newTime: z.string(),
  reason: z.string().optional(),
});

// TypeScript types
export type CustomerPortalAccess = typeof customerPortalAccess.$inferSelect;
export type InsertCustomerPortalAccess = typeof customerPortalAccess.$inferInsert;
export type CustomerServiceRequest = typeof customerServiceRequests.$inferSelect;
export type InsertCustomerServiceRequest = typeof customerServiceRequests.$inferInsert;
export type CustomerServiceRequestStatusHistory = typeof customerServiceRequestStatusHistory.$inferSelect;
export type InsertCustomerServiceRequestStatusHistory = typeof customerServiceRequestStatusHistory.$inferInsert;
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
export type CustomerMaintenanceAppointment = typeof customerMaintenanceAppointments.$inferSelect;
export type InsertCustomerMaintenanceAppointment = typeof customerMaintenanceAppointments.$inferInsert;
export type TechnicianAvailabilitySlot = typeof technicianAvailabilitySlots.$inferSelect;
export type InsertTechnicianAvailabilitySlot = typeof technicianAvailabilitySlots.$inferInsert;

// Maintenance Scheduling Request Types
export type MaintenanceSchedulingRequest = z.infer<typeof maintenanceSchedulingRequestSchema>;
export type AvailabilityRequest = z.infer<typeof availabilityRequestSchema>;
export type RescheduleAppointmentRequest = z.infer<typeof rescheduleAppointmentSchema>;

// Equipment Health Validation Schemas
export const equipmentHealthStatusEnum = pgEnum('equipment_health_status', [
  'excellent',
  'good', 
  'warning',
  'critical',
  'offline'
]);

export const healthMetricSchema = z.object({
  tonerLevels: z.array(z.object({
    color: z.string(),
    level: z.number().min(0).max(100),
    status: z.string()
  })),
  paperLevels: z.number().min(0).max(100),
  drumLifeRemaining: z.number().min(0).max(100),
  fuserLifeRemaining: z.number().min(0).max(100),
  temperature: z.number(),
  humidity: z.number().min(0).max(100),
  errorCount: z.number().min(0),
  jamRate: z.number().min(0)
});

export const recentActivitySchema = z.object({
  date: z.string(),
  type: z.enum(['print', 'scan', 'copy', 'fax']),
  count: z.number().min(0)
});

export const alertSchema = z.object({
  id: z.string(),
  type: z.enum(['warning', 'critical', 'info']),
  message: z.string(),
  timestamp: z.string(),
  resolved: z.boolean()
});

export const connectionStatusSchema = z.object({
  isOnline: z.boolean(),
  lastSeen: z.string(),
  signalStrength: z.number().min(0).max(100),
  ipAddress: z.string().ip()
});

export const equipmentHealthSchema = z.object({
  id: z.string().uuid(),
  equipmentName: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  location: z.string().min(1),
  overallHealthScore: z.number().min(0).max(100),
  status: z.enum(['excellent', 'good', 'warning', 'critical', 'offline']),
  lastServiceDate: z.string(),
  nextServiceDue: z.string(),
  totalPrintCount: z.number().min(0),
  monthlyAverage: z.number().min(0),
  predictedMaintenanceDate: z.string(),
  healthMetrics: healthMetricSchema,
  recentActivity: z.array(recentActivitySchema),
  alerts: z.array(alertSchema),
  connectionStatus: connectionStatusSchema
});

// Equipment Health API Request/Response Schemas
export const equipmentHealthRequestSchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  equipmentIds: z.array(z.string().uuid()).optional(),
  includeAlerts: z.boolean().default(true),
  includeMetrics: z.boolean().default(true)
});

export const equipmentHealthResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(equipmentHealthSchema),
  meta: z.object({
    totalCount: z.number(),
    timeRange: z.string(),
    lastUpdated: z.string()
  }).optional()
});

export const scheduleMaintenanceRequestSchema = z.object({
  equipmentId: z.string().uuid(),
  preferredDate: z.string(),
  maintenanceType: z.enum(['routine', 'preventive', 'repair', 'upgrade']),
  notes: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).default('medium')
});

export type EquipmentHealth = z.infer<typeof equipmentHealthSchema>;
export type EquipmentHealthRequest = z.infer<typeof equipmentHealthRequestSchema>;
export type EquipmentHealthResponse = z.infer<typeof equipmentHealthResponseSchema>;
export type ScheduleMaintenanceRequest = z.infer<typeof scheduleMaintenanceRequestSchema>;

// =====================================================================
// USAGE ANALYTICS SCHEMAS
// =====================================================================

// Usage Analytics Data Types
export const usageTypeEnum = pgEnum('usage_type', [
  'total',
  'black_white',
  'color', 
  'large_format',
  'scan',
  'fax'
]);

export const periodTypeEnum = pgEnum('period_type', [
  'daily',
  'weekly', 
  'monthly',
  'quarterly',
  'yearly'
]);

// Usage trend data point
export const usageTrendSchema = z.object({
  date: z.string(),
  period: z.string(),
  totalImpressions: z.number().min(0),
  blackWhiteImpressions: z.number().min(0),
  colorImpressions: z.number().min(0),
  largeFormatImpressions: z.number().min(0),
  scanImpressions: z.number().min(0),
  faxImpressions: z.number().min(0),
  costEstimate: z.number().min(0),
  efficiency: z.number().min(0)
});

// Equipment usage summary
export const equipmentUsageSummarySchema = z.object({
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  serialNumber: z.string(),
  totalImpressions: z.number().min(0),
  monthlyAverage: z.number().min(0),
  utilizationRate: z.number().min(0).max(100),
  costPerPage: z.number().min(0),
  efficiency: z.number().min(0).max(100),
  lastReading: z.string(),
  trendDirection: z.enum(['up', 'down', 'stable'])
});

// Usage analytics metrics
export const usageAnalyticsMetricsSchema = z.object({
  totalVolume: z.number().min(0),
  averageDaily: z.number().min(0),
  averageMonthly: z.number().min(0),
  colorRatio: z.number().min(0).max(100),
  peakDay: z.string(),
  peakVolume: z.number().min(0),
  totalCost: z.number().min(0),
  costPerPage: z.number().min(0),
  efficiencyScore: z.number().min(0).max(100),
  carbonFootprint: z.number().min(0),
  paperSaved: z.number().min(0)
});

// Cost breakdown
export const costBreakdownSchema = z.object({
  blackWhiteCost: z.number().min(0),
  colorCost: z.number().min(0),
  largeFormatCost: z.number().min(0),
  scanCost: z.number().min(0),
  maintenanceCost: z.number().min(0),
  supplyCost: z.number().min(0),
  totalCost: z.number().min(0)
});

// Peak usage analysis
export const peakUsageAnalysisSchema = z.object({
  hourlyPeaks: z.array(z.object({
    hour: z.number().min(0).max(23),
    averageVolume: z.number().min(0)
  })),
  dailyPeaks: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    averageVolume: z.number().min(0)
  })),
  monthlyPeaks: z.array(z.object({
    month: z.number().min(1).max(12),
    averageVolume: z.number().min(0)
  }))
});

// Usage comparison data
export const usageComparisonSchema = z.object({
  current: usageAnalyticsMetricsSchema,
  previous: usageAnalyticsMetricsSchema,
  industry: usageAnalyticsMetricsSchema.optional(),
  percentageChange: z.number(),
  trendDirection: z.enum(['up', 'down', 'stable'])
});

// Main usage analytics schema
export const usageAnalyticsSchema = z.object({
  timeRange: z.string(),
  lastUpdated: z.string(),
  metrics: usageAnalyticsMetricsSchema,
  trends: z.array(usageTrendSchema),
  equipmentUsage: z.array(equipmentUsageSummarySchema),
  costBreakdown: costBreakdownSchema,
  peakUsage: peakUsageAnalysisSchema,
  comparison: usageComparisonSchema,
  recommendations: z.array(z.object({
    type: z.enum(['cost_saving', 'efficiency', 'environmental', 'maintenance']),
    title: z.string(),
    description: z.string(),
    impact: z.enum(['low', 'medium', 'high']),
    effort: z.enum(['low', 'medium', 'high'])
  }))
});

// Usage Analytics API Request/Response Schemas
export const usageAnalyticsRequestSchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '6m', '1y']).default('30d'),
  equipmentIds: z.array(z.string().uuid()).optional(),
  includeComparison: z.boolean().default(true),
  includeCosts: z.boolean().default(true),
  includeRecommendations: z.boolean().default(true),
  periodType: z.enum(['daily', 'weekly', 'monthly']).default('daily')
});

export const usageAnalyticsResponseSchema = z.object({
  success: z.boolean(),
  data: usageAnalyticsSchema,
  meta: z.object({
    totalReadings: z.number(),
    timeRange: z.string(),
    lastUpdated: z.string(),
    equipmentCount: z.number()
  })
});

// Equipment usage detail request
export const equipmentUsageDetailRequestSchema = z.object({
  equipmentId: z.string().uuid(),
  timeRange: z.enum(['7d', '30d', '90d', '6m', '1y']).default('30d'),
  includeHourlyBreakdown: z.boolean().default(false),
  includeCostAnalysis: z.boolean().default(true)
});

export type UsageTrend = z.infer<typeof usageTrendSchema>;
export type EquipmentUsageSummary = z.infer<typeof equipmentUsageSummarySchema>;
export type UsageAnalyticsMetrics = z.infer<typeof usageAnalyticsMetricsSchema>;
export type UsageAnalytics = z.infer<typeof usageAnalyticsSchema>;
export type UsageAnalyticsRequest = z.infer<typeof usageAnalyticsRequestSchema>;
export type UsageAnalyticsResponse = z.infer<typeof usageAnalyticsResponseSchema>;
export type EquipmentUsageDetailRequest = z.infer<typeof equipmentUsageDetailRequestSchema>;

// Service request status update schema  
export const updateServiceRequestStatusSchema = z.object({
  newStatus: z.enum(['submitted', 'acknowledged', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled']),
  changeReason: z.string().optional(),
  customerVisibleNotes: z.string().optional(), 
  internalNotes: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  actualCompletionDate: z.string().optional(),
  changedByName: z.string().min(1)
});

export type UpdateServiceRequestStatusRequest = z.infer<typeof updateServiceRequestStatusSchema>;

// Satisfaction Rating System Zod Schemas
export const insertCustomerSatisfactionSurveyTemplateSchema = createInsertSchema(customerSatisfactionSurveyTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSatisfactionSurveyQuestionSchema = createInsertSchema(customerSatisfactionSurveyQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSatisfactionSurveySchema = createInsertSchema(customerSatisfactionSurveys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  accessToken: true,
  overallScore: true,
  npsScore: true,
});

export const insertCustomerSatisfactionSurveyResponseSchema = createInsertSchema(customerSatisfactionSurveyResponses).omit({
  id: true,
  answeredAt: true,
});

export const insertCustomerSatisfactionAnalyticsSchema = createInsertSchema(customerSatisfactionAnalytics).omit({
  id: true,
  calculatedAt: true,
  lastUpdated: true,
});

// Satisfaction Rating System TypeScript Types
export type CustomerSatisfactionSurveyTemplate = typeof customerSatisfactionSurveyTemplates.$inferSelect;
export type CustomerSatisfactionSurveyQuestion = typeof customerSatisfactionSurveyQuestions.$inferSelect;
export type CustomerSatisfactionSurvey = typeof customerSatisfactionSurveys.$inferSelect;
export type CustomerSatisfactionSurveyResponse = typeof customerSatisfactionSurveyResponses.$inferSelect;
export type CustomerSatisfactionAnalytics = typeof customerSatisfactionAnalytics.$inferSelect;

export type InsertCustomerSatisfactionSurveyTemplate = z.infer<typeof insertCustomerSatisfactionSurveyTemplateSchema>;
export type InsertCustomerSatisfactionSurveyQuestion = z.infer<typeof insertCustomerSatisfactionSurveyQuestionSchema>;
export type InsertCustomerSatisfactionSurvey = z.infer<typeof insertCustomerSatisfactionSurveySchema>;
export type InsertCustomerSatisfactionSurveyResponse = z.infer<typeof insertCustomerSatisfactionSurveyResponseSchema>;
export type InsertCustomerSatisfactionAnalytics = z.infer<typeof insertCustomerSatisfactionAnalyticsSchema>;