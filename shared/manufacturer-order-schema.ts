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
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums
export const manufacturerTypeEnum = pgEnum('manufacturer_type', [
  'canon',
  'xerox',
  'hp',
  'ricoh',
  'konica_minolta',
  'sharp',
  'brother',
  'epson',
  'kyocera',
  'lexmark',
  'other',
]);

export const connectionStatusEnum = pgEnum('manufacturer_connection_status', [
  'active',
  'inactive',
  'suspended',
  'error',
]);

export const orderStatusEnum = pgEnum('manufacturer_order_status', [
  'draft',
  'pending_approval',
  'approved',
  'submitted',
  'acknowledged',
  'processing',
  'shipped',
  'partially_shipped',
  'delivered',
  'cancelled',
  'rejected',
  'error',
]);

export const orderMethodEnum = pgEnum('order_method', ['api', 'edi', 'email', 'portal', 'manual']);

export const shipmentStatusEnum = pgEnum('shipment_status', [
  'pending',
  'picked',
  'packed',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'delayed',
  'returned',
  'cancelled',
]);

export const exceptionSeverityEnum = pgEnum('exception_severity', [
  'info',
  'warning',
  'error',
  'critical',
]);

export const exceptionTypeEnum = pgEnum('exception_type', [
  'connection_failed',
  'authentication_failed',
  'validation_error',
  'product_not_found',
  'insufficient_inventory',
  'price_mismatch',
  'order_rejected',
  'shipment_delayed',
  'delivery_failed',
  'timeout',
  'unknown',
]);

// Table: manufacturer_connections
// Stores dealer's manufacturer API credentials and connection settings
export const manufacturerConnections = pgTable(
  'manufacturer_connections',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    manufacturerType: manufacturerTypeEnum('manufacturer_type').notNull(),
    manufacturerName: varchar('manufacturer_name', { length: 255 }).notNull(),
    connectionStatus: connectionStatusEnum('connection_status').notNull().default('inactive'),

    // API Configuration
    apiEndpoint: text('api_endpoint'),
    apiKey: text('api_key'),
    apiSecret: text('api_secret'),
    clientId: text('client_id'),
    clientSecret: text('client_secret'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),

    // EDI Configuration
    ediEnabled: boolean('edi_enabled').default(false),
    ediInterchangeId: varchar('edi_interchange_id', { length: 100 }),
    ediQualifier: varchar('edi_qualifier', { length: 10 }),

    // Connection Settings
    orderMethod: orderMethodEnum('order_method').notNull().default('api'),
    autoSubmitEnabled: boolean('auto_submit_enabled').default(false),
    sandboxMode: boolean('sandbox_mode').default(true),
    webhookUrl: text('webhook_url'),
    webhookSecret: text('webhook_secret'),

    // Account Information
    dealerAccountNumber: varchar('dealer_account_number', { length: 100 }),
    dealerAccountName: varchar('dealer_account_name', { length: 255 }),
    shippingAccountNumber: varchar('shipping_account_number', { length: 100 }),

    // Health & Monitoring
    lastConnectionTest: timestamp('last_connection_test', {
      withTimezone: true,
    }),
    lastSuccessfulOrder: timestamp('last_successful_order', {
      withTimezone: true,
    }),
    lastError: text('last_error'),
    consecutiveFailures: integer('consecutive_failures').default(0),

    // Configuration
    defaultShipToAddressId: varchar('default_ship_to_address_id'),
    configurationOptions: jsonb('configuration_options'),
    customFields: jsonb('custom_fields'),

    // Metadata
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdBy: varchar('created_by'),
    updatedBy: varchar('updated_by'),
  },
  (table) => ({
    tenantIdx: index('manufacturer_connections_tenant_idx').on(table.tenantId),
    tenantManufacturerIdx: index('manufacturer_connections_tenant_manufacturer_idx').on(
      table.tenantId,
      table.manufacturerType,
    ),
    tenantStatusIdx: index('manufacturer_connections_tenant_status_idx').on(
      table.tenantId,
      table.connectionStatus,
    ),
    manufacturerTypeIdx: index('manufacturer_connections_manufacturer_type_idx').on(
      table.manufacturerType,
    ),
    statusIdx: index('manufacturer_connections_status_idx').on(table.connectionStatus),
  }),
);

// Table: manufacturer_orders
// Tracks orders submitted to manufacturers
export const manufacturerOrders = pgTable(
  'manufacturer_orders',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    connectionId: varchar('connection_id')
      .notNull()
      .references(() => manufacturerConnections.id, { onDelete: 'restrict' }),
    purchaseOrderId: varchar('purchase_order_id'),

    // Order Identification
    orderNumber: varchar('order_number', { length: 100 }).notNull(),
    manufacturerOrderNumber: varchar('manufacturer_order_number', { length: 100 }),
    referenceNumber: varchar('reference_number', { length: 100 }),

    // Order Details
    orderStatus: orderStatusEnum('order_status').notNull().default('draft'),
    orderMethod: orderMethodEnum('order_method').notNull(),
    orderDate: timestamp('order_date', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),

    // Financial
    subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0'),
    shippingCost: decimal('shipping_cost', { precision: 12, scale: 2 }).default('0'),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    currency: varchar('currency', { length: 3 }).default('USD'),

    // Shipping Information
    shipToName: varchar('ship_to_name', { length: 255 }),
    shipToAddress: text('ship_to_address'),
    shipToCity: varchar('ship_to_city', { length: 100 }),
    shipToState: varchar('ship_to_state', { length: 50 }),
    shipToZip: varchar('ship_to_zip', { length: 20 }),
    shipToCountry: varchar('ship_to_country', { length: 100 }),
    shippingMethod: varchar('shipping_method', { length: 100 }),
    requestedDeliveryDate: timestamp('requested_delivery_date', { withTimezone: true }),
    estimatedDeliveryDate: timestamp('estimated_delivery_date', { withTimezone: true }),

    // Contact Information
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 50 }),

    // Tracking
    trackingNumbers: jsonb('tracking_numbers'),
    carrierInfo: jsonb('carrier_info'),
    shipmentCount: integer('shipment_count').default(0),

    // Fulfillment Status
    totalQuantityOrdered: integer('total_quantity_ordered').default(0),
    totalQuantityShipped: integer('total_quantity_shipped').default(0),
    totalQuantityDelivered: integer('total_quantity_delivered').default(0),
    totalQuantityCancelled: integer('total_quantity_cancelled').default(0),

    // Automation & Integration
    autoSubmitted: boolean('auto_submitted').default(false),
    retryCount: integer('retry_count').default(0),
    lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),

    // API Response Data
    submissionPayload: jsonb('submission_payload'),
    submissionResponse: jsonb('submission_response'),
    lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),

    // Additional Data
    specialInstructions: text('special_instructions'),
    internalNotes: text('internal_notes'),
    customFields: jsonb('custom_fields'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdBy: varchar('created_by'),
    updatedBy: varchar('updated_by'),
  },
  (table) => ({
    tenantIdx: index('manufacturer_orders_tenant_idx').on(table.tenantId),
    tenantOrderNumberIdx: index('manufacturer_orders_tenant_order_number_idx').on(
      table.tenantId,
      table.orderNumber,
    ),
    tenantStatusIdx: index('manufacturer_orders_tenant_status_idx').on(
      table.tenantId,
      table.orderStatus,
    ),
    tenantConnectionIdx: index('manufacturer_orders_tenant_connection_idx').on(
      table.tenantId,
      table.connectionId,
    ),
    tenantOrderDateIdx: index('manufacturer_orders_tenant_order_date_idx').on(
      table.tenantId,
      table.orderDate,
    ),
    connectionIdx: index('manufacturer_orders_connection_idx').on(table.connectionId),
    statusIdx: index('manufacturer_orders_status_idx').on(table.orderStatus),
    orderNumberIdx: index('manufacturer_orders_order_number_idx').on(table.orderNumber),
    poIdx: index('manufacturer_orders_po_idx').on(table.purchaseOrderId),
  }),
);

// Table: manufacturer_order_line_items
// Individual items in each order
export const manufacturerOrderLineItems = pgTable(
  'manufacturer_order_line_items',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    orderId: varchar('order_id')
      .notNull()
      .references(() => manufacturerOrders.id, { onDelete: 'cascade' }),

    // Line Item Details
    lineNumber: integer('line_number').notNull(),
    productCode: varchar('product_code', { length: 100 }).notNull(),
    manufacturerPartNumber: varchar('manufacturer_part_number', { length: 100 }),
    description: text('description').notNull(),

    // Quantity & Pricing
    quantityOrdered: integer('quantity_ordered').notNull(),
    quantityShipped: integer('quantity_shipped').default(0),
    quantityDelivered: integer('quantity_delivered').default(0),
    quantityCancelled: integer('quantity_cancelled').default(0),
    quantityBackordered: integer('quantity_backordered').default(0),

    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
    listPrice: decimal('list_price', { precision: 12, scale: 2 }),
    discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
    lineTotal: decimal('line_total', { precision: 12, scale: 2 }).notNull(),

    // Product Information
    uom: varchar('uom', { length: 20 }).default('EA'),
    weight: decimal('weight', { precision: 10, scale: 2 }),
    weightUnit: varchar('weight_unit', { length: 10 }),

    // Delivery
    requestedShipDate: timestamp('requested_ship_date', { withTimezone: true }),
    estimatedShipDate: timestamp('estimated_ship_date', { withTimezone: true }),
    actualShipDate: timestamp('actual_ship_date', { withTimezone: true }),

    // Internal References
    inventoryItemId: varchar('inventory_item_id'),
    productId: varchar('product_id'),

    // Status & Tracking
    lineStatus: varchar('line_status', { length: 50 }).default('pending'),
    backorderDate: timestamp('backorder_date', { withTimezone: true }),

    // Additional Data
    notes: text('notes'),
    customFields: jsonb('custom_fields'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    tenantIdx: index('manufacturer_order_line_items_tenant_idx').on(table.tenantId),
    tenantOrderIdx: index('manufacturer_order_line_items_tenant_order_idx').on(
      table.tenantId,
      table.orderId,
    ),
    orderIdx: index('manufacturer_order_line_items_order_idx').on(table.orderId),
    productCodeIdx: index('manufacturer_order_line_items_product_code_idx').on(table.productCode),
    inventoryItemIdx: index('manufacturer_order_line_items_inventory_item_idx').on(
      table.inventoryItemId,
    ),
  }),
);

// Table: manufacturer_order_confirmations
// Manufacturer confirmations/acknowledgments
export const manufacturerOrderConfirmations = pgTable(
  'manufacturer_order_confirmations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    orderId: varchar('order_id')
      .notNull()
      .references(() => manufacturerOrders.id, { onDelete: 'cascade' }),

    // Confirmation Details
    confirmationNumber: varchar('confirmation_number', { length: 100 }),
    confirmationType: varchar('confirmation_type', { length: 50 }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),

    // Status
    confirmationStatus: varchar('confirmation_status', { length: 50 }).default('received'),

    // Financial
    confirmedAmount: decimal('confirmed_amount', { precision: 12, scale: 2 }),

    // Delivery
    confirmedDeliveryDate: timestamp('confirmed_delivery_date', { withTimezone: true }),

    // Data
    rawConfirmationData: jsonb('raw_confirmation_data'),
    parsedData: jsonb('parsed_data'),

    // Processing
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingErrors: jsonb('processing_errors'),

    // Additional Data
    notes: text('notes'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    tenantIdx: index('manufacturer_order_confirmations_tenant_idx').on(table.tenantId),
    tenantOrderIdx: index('manufacturer_order_confirmations_tenant_order_idx').on(
      table.tenantId,
      table.orderId,
    ),
    orderIdx: index('manufacturer_order_confirmations_order_idx').on(table.orderId),
    confirmedAtIdx: index('manufacturer_order_confirmations_confirmed_at_idx').on(
      table.confirmedAt,
    ),
  }),
);

// Table: manufacturer_order_shipments
// Shipment tracking information
export const manufacturerOrderShipments = pgTable(
  'manufacturer_order_shipments',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    orderId: varchar('order_id')
      .notNull()
      .references(() => manufacturerOrders.id, { onDelete: 'cascade' }),

    // Shipment Details
    shipmentNumber: varchar('shipment_number', { length: 100 }),
    trackingNumber: varchar('tracking_number', { length: 100 }),
    carrier: varchar('carrier', { length: 100 }),
    carrierService: varchar('carrier_service', { length: 100 }),

    // Status
    shipmentStatus: shipmentStatusEnum('shipment_status').notNull().default('pending'),

    // Dates
    shippedDate: timestamp('shipped_date', { withTimezone: true }),
    estimatedDeliveryDate: timestamp('estimated_delivery_date', { withTimezone: true }),
    actualDeliveryDate: timestamp('actual_delivery_date', { withTimezone: true }),

    // Package Details
    packageCount: integer('package_count').default(1),
    totalWeight: decimal('total_weight', { precision: 10, scale: 2 }),
    weightUnit: varchar('weight_unit', { length: 10 }),

    // Line Items in Shipment
    lineItemsShipped: jsonb('line_items_shipped'),

    // Tracking
    trackingUrl: text('tracking_url'),
    trackingEvents: jsonb('tracking_events'),
    lastTrackingUpdate: timestamp('last_tracking_update', { withTimezone: true }),

    // Delivery Information
    deliveredTo: varchar('delivered_to', { length: 255 }),
    signatureRequired: boolean('signature_required').default(false),
    signatureName: varchar('signature_name', { length: 255 }),
    signatureTimestamp: timestamp('signature_timestamp', { withTimezone: true }),

    // Additional Data
    shippingCost: decimal('shipping_cost', { precision: 12, scale: 2 }),
    insuranceAmount: decimal('insurance_amount', { precision: 12, scale: 2 }),
    specialInstructions: text('special_instructions'),
    notes: text('notes'),
    customFields: jsonb('custom_fields'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    tenantIdx: index('manufacturer_order_shipments_tenant_idx').on(table.tenantId),
    tenantOrderIdx: index('manufacturer_order_shipments_tenant_order_idx').on(
      table.tenantId,
      table.orderId,
    ),
    tenantStatusIdx: index('manufacturer_order_shipments_tenant_status_idx').on(
      table.tenantId,
      table.shipmentStatus,
    ),
    orderIdx: index('manufacturer_order_shipments_order_idx').on(table.orderId),
    trackingNumberIdx: index('manufacturer_order_shipments_tracking_number_idx').on(
      table.trackingNumber,
    ),
    statusIdx: index('manufacturer_order_shipments_status_idx').on(table.shipmentStatus),
    shippedDateIdx: index('manufacturer_order_shipments_shipped_date_idx').on(table.shippedDate),
  }),
);

// Table: manufacturer_order_exceptions
// Errors, rejections, and exceptions
export const manufacturerOrderExceptions = pgTable(
  'manufacturer_order_exceptions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    orderId: varchar('order_id').references(() => manufacturerOrders.id, {
      onDelete: 'cascade',
    }),
    connectionId: varchar('connection_id').references(() => manufacturerConnections.id, {
      onDelete: 'set null',
    }),

    // Exception Details
    exceptionType: exceptionTypeEnum('exception_type').notNull(),
    severity: exceptionSeverityEnum('severity').notNull().default('error'),
    exceptionMessage: text('exception_message').notNull(),
    exceptionCode: varchar('exception_code', { length: 50 }),

    // Context
    context: varchar('context', { length: 100 }),
    affectedLineItems: jsonb('affected_line_items'),

    // Error Details
    errorDetails: jsonb('error_details'),
    stackTrace: text('stack_trace'),
    requestPayload: jsonb('request_payload'),
    responsePayload: jsonb('response_payload'),

    // Resolution
    resolved: boolean('resolved').default(false),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: varchar('resolved_by'),
    resolutionNotes: text('resolution_notes'),

    // Retry Information
    retryable: boolean('retryable').default(true),
    retryCount: integer('retry_count').default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

    // Notification
    notificationSent: boolean('notification_sent').default(false),
    notifiedUsers: jsonb('notified_users'),

    // Additional Data
    customFields: jsonb('custom_fields'),

    // Metadata
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    tenantIdx: index('manufacturer_order_exceptions_tenant_idx').on(table.tenantId),
    tenantOrderIdx: index('manufacturer_order_exceptions_tenant_order_idx').on(
      table.tenantId,
      table.orderId,
    ),
    tenantSeverityIdx: index('manufacturer_order_exceptions_tenant_severity_idx').on(
      table.tenantId,
      table.severity,
    ),
    tenantResolvedIdx: index('manufacturer_order_exceptions_tenant_resolved_idx').on(
      table.tenantId,
      table.resolved,
    ),
    tenantOccurredAtIdx: index('manufacturer_order_exceptions_tenant_occurred_at_idx').on(
      table.tenantId,
      table.occurredAt,
    ),
    orderIdx: index('manufacturer_order_exceptions_order_idx').on(table.orderId),
    connectionIdx: index('manufacturer_order_exceptions_connection_idx').on(table.connectionId),
    severityIdx: index('manufacturer_order_exceptions_severity_idx').on(table.severity),
    resolvedIdx: index('manufacturer_order_exceptions_resolved_idx').on(table.resolved),
  }),
);

// Insert Schemas
export const insertManufacturerConnectionSchema = createInsertSchema(manufacturerConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertManufacturerOrderSchema = createInsertSchema(manufacturerOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertManufacturerOrderLineItemSchema = createInsertSchema(
  manufacturerOrderLineItems,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertManufacturerOrderConfirmationSchema = createInsertSchema(
  manufacturerOrderConfirmations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertManufacturerOrderShipmentSchema = createInsertSchema(
  manufacturerOrderShipments,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertManufacturerOrderExceptionSchema = createInsertSchema(
  manufacturerOrderExceptions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type ManufacturerConnection = typeof manufacturerConnections.$inferSelect;
export type InsertManufacturerConnection = z.infer<typeof insertManufacturerConnectionSchema>;

export type ManufacturerOrder = typeof manufacturerOrders.$inferSelect;
export type InsertManufacturerOrder = z.infer<typeof insertManufacturerOrderSchema>;

export type ManufacturerOrderLineItem = typeof manufacturerOrderLineItems.$inferSelect;
export type InsertManufacturerOrderLineItem = z.infer<typeof insertManufacturerOrderLineItemSchema>;

export type ManufacturerOrderConfirmation = typeof manufacturerOrderConfirmations.$inferSelect;
export type InsertManufacturerOrderConfirmation = z.infer<
  typeof insertManufacturerOrderConfirmationSchema
>;

export type ManufacturerOrderShipment = typeof manufacturerOrderShipments.$inferSelect;
export type InsertManufacturerOrderShipment = z.infer<typeof insertManufacturerOrderShipmentSchema>;

export type ManufacturerOrderException = typeof manufacturerOrderExceptions.$inferSelect;
export type InsertManufacturerOrderException = z.infer<
  typeof insertManufacturerOrderExceptionSchema
>;
