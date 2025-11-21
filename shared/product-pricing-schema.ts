import { pgTable, varchar, decimal, boolean, timestamp, text, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Product Pricing Schema - Three-Tier Pricing Model
 *
 * Tier 1: Dealer Cost - Hard cost to the dealer (fluctuates with supplier pricing)
 * Tier 2: Rep Cost - Dealer Cost + Company Markup (default 13%, covers operating expenses)
 * Tier 3: Customer Price - Final price set by sales rep (subject to approval rules)
 *
 * Visibility by Role:
 * - Managers/Admins/Platform: See all three tiers
 * - Sales Reps: See only Rep Cost and Customer Price
 * - Customers: See only Customer Price
 */

// Pricing approval status enum
export const pricingApprovalStatusEnum = pgEnum('pricing_approval_status', [
  'pending',
  'approved',
  'rejected',
  'auto_approved'
]);

// Markup type enum - determines how rep cost is calculated
export const markupTypeEnum = pgEnum('markup_type', [
  'percentage', // Percentage markup (e.g., 13%)
  'fixed_amount', // Fixed dollar amount
  'custom' // Custom calculation per product
]);

// Company Pricing Settings - Tenant-level pricing controls
export const companyPricingSettings = pgTable('company_pricing_settings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull().unique(),

  // Default Markup Settings
  defaultMarkupType: markupTypeEnum('default_markup_type').default('percentage'),
  defaultMarkupPercentage: decimal('default_markup_percentage', { precision: 5, scale: 2 }).default('13.00'), // 13%
  defaultMarkupAmount: decimal('default_markup_amount', { precision: 10, scale: 2 }),

  // Per-Category Markup Overrides (JSONB for flexibility)
  // Example: { "MFP": 13.5, "Production": 15.0, "Software": 20.0 }
  categoryMarkupOverrides: jsonb('category_markup_overrides'),

  // Sales Rep Permissions
  allowRepPriceEdit: boolean('allow_rep_price_edit').default(true), // Can reps edit customer price?
  requireApprovalForPriceEdit: boolean('require_approval_for_price_edit').default(false), // Require approval?
  requireApprovalAboveThreshold: boolean('require_approval_above_threshold').default(true), // Require approval for discounts above threshold?

  // Pricing Thresholds
  maxDiscountPercentage: decimal('max_discount_percentage', { precision: 5, scale: 2 }).default('20.00'), // Max discount from rep cost before approval
  minMarginPercentage: decimal('min_margin_percentage', { precision: 5, scale: 2 }).default('5.00'), // Minimum margin required (from dealer cost)
  autoApprovalThreshold: decimal('auto_approval_threshold', { precision: 5, scale: 2 }).default('10.00'), // Auto-approve if discount <= this %

  // Visibility Settings
  showDealerCostToReps: boolean('show_dealer_cost_to_reps').default(false), // Should reps see dealer cost?
  showMarginToReps: boolean('show_margin_to_reps').default(true), // Should reps see margin %?

  // Notification Settings
  notifyOnPriceChange: boolean('notify_on_price_change').default(true),
  notifyManagersOnApproval: boolean('notify_managers_on_approval').default(true),

  // Audit
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Enhanced Product Pricing - Replaces and extends existing productPricing table
export const enhancedProductPricing = pgTable('enhanced_product_pricing', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),

  // Product Reference
  productId: varchar('product_id').notNull(), // References productModels.id or productAccessories.id
  productType: varchar('product_type').notNull(), // "model", "accessory", "service", "software"

  // Pricing Tier (for products with multiple tiers like new, upgrade, lexmark)
  pricingTier: varchar('pricing_tier'), // "new", "upgrade", "lexmark", "standard", null

  // Three-Tier Pricing Structure
  // Tier 1: Dealer Cost (what the dealer pays to acquire/source the product)
  dealerCost: decimal('dealer_cost', { precision: 12, scale: 2 }).notNull(),
  dealerCostNotes: text('dealer_cost_notes'), // Notes about cost changes, supplier info

  // Tier 2: Rep Cost (what the sales rep sees as their "cost")
  // Calculated as: dealerCost * (1 + markupPercentage/100) OR dealerCost + markupAmount
  useCustomMarkup: boolean('use_custom_markup').default(false), // Override company default?
  markupType: markupTypeEnum('markup_type'), // Null = use company default
  markupPercentage: decimal('markup_percentage', { precision: 5, scale: 2 }), // Null = use company default
  markupAmount: decimal('markup_amount', { precision: 10, scale: 2 }), // For fixed amount markup
  repCost: decimal('rep_cost', { precision: 12, scale: 2 }).notNull(), // Calculated or set manually

  // Tier 3: Customer Price (MSRP/Suggested Retail)
  suggestedRetailPrice: decimal('suggested_retail_price', { precision: 12, scale: 2 }), // MSRP
  minimumSalePrice: decimal('minimum_sale_price', { precision: 12, scale: 2 }), // Floor price (cannot go below)

  // Price Validation
  isActive: boolean('is_active').default(true),
  effectiveDate: timestamp('effective_date').defaultNow(),
  expirationDate: timestamp('expiration_date'),

  // Cost Change Tracking
  lastCostUpdate: timestamp('last_cost_update'),
  lastCostUpdateBy: varchar('last_cost_update_by'), // User who updated dealer cost
  costChangeReason: text('cost_change_reason'), // Why did the cost change?

  // Tracking
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Product Models Enhanced - Extended pricing fields for backward compatibility and transitions
// These fields will be migrated to enhancedProductPricing table over time
export const productModelPricingExtension = {
  // New pricing fields for each tier
  newDealerCost: decimal('new_dealer_cost', { precision: 10, scale: 2 }),
  newRepMarkupPercentage: decimal('new_rep_markup_percentage', { precision: 5, scale: 2 }),
  newRepCost: decimal('new_rep_cost', { precision: 10, scale: 2 }), // Calculated: newDealerCost * (1 + markup%)

  upgradeDealerCost: decimal('upgrade_dealer_cost', { precision: 10, scale: 2 }),
  upgradeRepMarkupPercentage: decimal('upgrade_rep_markup_percentage', { precision: 5, scale: 2 }),
  upgradeRepCost: decimal('upgrade_rep_cost', { precision: 10, scale: 2 }),

  lexmarkDealerCost: decimal('lexmark_dealer_cost', { precision: 10, scale: 2 }),
  lexmarkRepMarkupPercentage: decimal('lexmark_rep_markup_percentage', { precision: 5, scale: 2 }),
  lexmarkRepCost: decimal('lexmark_rep_cost', { precision: 10, scale: 2 }),
};

// Product Accessories Enhanced - Same extension for accessories
export const productAccessoryPricingExtension = {
  // Standard tier
  standardDealerCost: decimal('standard_dealer_cost', { precision: 10, scale: 2 }),
  standardRepMarkupPercentage: decimal('standard_rep_markup_percentage', { precision: 5, scale: 2 }),
  standardRepCost: decimal('standard_rep_cost', { precision: 10, scale: 2 }),

  // New tier
  newDealerCost: decimal('new_dealer_cost', { precision: 10, scale: 2 }),
  newRepMarkupPercentage: decimal('new_rep_markup_percentage', { precision: 5, scale: 2 }),
  newRepCost: decimal('new_rep_cost', { precision: 10, scale: 2 }),

  // Upgrade tier
  upgradeDealerCost: decimal('upgrade_dealer_cost', { precision: 10, scale: 2 }),
  upgradeRepMarkupPercentage: decimal('upgrade_rep_markup_percentage', { precision: 5, scale: 2 }),
  upgradeRepCost: decimal('upgrade_rep_cost', { precision: 10, scale: 2 }),
};

// Quote Pricing with Approval Workflow
export const enhancedQuotePricing = pgTable('enhanced_quote_pricing', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),

  // Quote Reference
  leadId: varchar('lead_id'),
  customerId: varchar('customer_id'),
  quoteNumber: varchar('quote_number').notNull().unique(),
  quoteVersion: varchar('quote_version').default('1.0'), // Track quote versions

  // Pricing Summary - All three tiers
  totalDealerCost: decimal('total_dealer_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  totalRepCost: decimal('total_rep_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  totalCustomerPrice: decimal('total_customer_price', { precision: 12, scale: 2 }).notNull().default('0'),

  // Margin Calculations
  totalMarginAmount: decimal('total_margin_amount', { precision: 12, scale: 2 }).notNull().default('0'), // customerPrice - dealerCost
  totalMarginPercentage: decimal('total_margin_percentage', { precision: 5, scale: 2 }).default('0'), // (margin / dealerCost) * 100
  totalRepMarginAmount: decimal('total_rep_margin_amount', { precision: 12, scale: 2 }).default('0'), // customerPrice - repCost
  totalRepMarginPercentage: decimal('total_rep_margin_percentage', { precision: 5, scale: 2 }).default('0'),

  // Discount Applied
  totalDiscountAmount: decimal('total_discount_amount', { precision: 12, scale: 2 }).default('0'),
  totalDiscountPercentage: decimal('total_discount_percentage', { precision: 5, scale: 2 }).default('0'),

  // Approval Workflow
  requiresApproval: boolean('requires_approval').default(false), // Does this quote need approval?
  approvalReason: text('approval_reason'), // Why does it need approval?
  approvalStatus: pricingApprovalStatusEnum('approval_status').default('pending'),
  approvedBy: varchar('approved_by'), // User ID who approved
  approvedDate: timestamp('approved_date'),
  approvalNotes: text('approval_notes'),
  rejectionReason: text('rejection_reason'),

  // Quote Status
  status: varchar('status').notNull().default('draft'), // draft, pending_approval, approved, sent, accepted, rejected, expired
  validUntil: timestamp('valid_until'),

  // Sales Rep
  createdBy: varchar('created_by').notNull(), // Sales rep who created the quote
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  sentDate: timestamp('sent_date'),
});

// Quote Line Items with Three-Tier Pricing
export const enhancedQuotePricingLineItems = pgTable('enhanced_quote_pricing_line_items', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),

  // References
  quotePricingId: varchar('quote_pricing_id').notNull(), // References enhancedQuotePricing.id
  productId: varchar('product_id').notNull(),
  productType: varchar('product_type').notNull(), // "model", "accessory", etc.
  pricingTier: varchar('pricing_tier'), // "new", "upgrade", etc.
  lineNumber: varchar('line_number').notNull(),

  // Product Details
  productName: varchar('product_name').notNull(),
  productCode: varchar('product_code'),
  productDescription: text('product_description'),

  // Quantity
  quantity: varchar('quantity').notNull().default('1'),

  // Three-Tier Unit Pricing
  unitDealerCost: decimal('unit_dealer_cost', { precision: 12, scale: 2 }).notNull(),
  unitRepCost: decimal('unit_rep_cost', { precision: 12, scale: 2 }).notNull(),
  unitCustomerPrice: decimal('unit_customer_price', { precision: 12, scale: 2 }).notNull(),

  // Line Item Totals
  totalDealerCost: decimal('total_dealer_cost', { precision: 12, scale: 2 }).notNull(),
  totalRepCost: decimal('total_rep_cost', { precision: 12, scale: 2 }).notNull(),
  totalCustomerPrice: decimal('total_customer_price', { precision: 12, scale: 2 }).notNull(),

  // Margin Calculations (per line item)
  lineMarginAmount: decimal('line_margin_amount', { precision: 12, scale: 2 }).notNull(), // totalCustomerPrice - totalDealerCost
  lineMarginPercentage: decimal('line_margin_percentage', { precision: 5, scale: 2 }).notNull(),
  lineRepMarginAmount: decimal('line_rep_margin_amount', { precision: 12, scale: 2 }), // totalCustomerPrice - totalRepCost
  lineRepMarginPercentage: decimal('line_rep_margin_percentage', { precision: 5, scale: 2 }),

  // Discount Information
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).default('0'),
  discountReason: text('discount_reason'),

  // Pricing Override Flags
  isPriceOverridden: boolean('is_price_overridden').default(false), // Did rep override the price?
  originalRepCost: decimal('original_rep_cost', { precision: 12, scale: 2 }), // Original rep cost before override
  overrideReason: text('override_reason'),
  overrideApprovedBy: varchar('override_approved_by'),

  // Notes
  notes: text('notes'),

  // Tracking
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Price Change Approval Requests - Track pricing approval workflow
export const priceChangeApprovals = pgTable('price_change_approvals', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),

  // Request Details
  requestType: varchar('request_type').notNull(), // "quote", "product_pricing", "line_item"
  referenceId: varchar('reference_id').notNull(), // ID of quote, product, or line item

  // Requestor Information
  requestedBy: varchar('requested_by').notNull(), // Sales rep requesting approval
  requestedDate: timestamp('requested_date').defaultNow(),
  requestReason: text('request_reason').notNull(),

  // Pricing Details
  originalPrice: decimal('original_price', { precision: 12, scale: 2 }),
  requestedPrice: decimal('requested_price', { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }),

  // Margin Impact
  originalMarginPercentage: decimal('original_margin_percentage', { precision: 5, scale: 2 }),
  newMarginPercentage: decimal('new_margin_percentage', { precision: 5, scale: 2 }),

  // Approval Status
  status: pricingApprovalStatusEnum('status').default('pending'),
  approvedBy: varchar('approved_by'),
  approvedDate: timestamp('approved_date'),
  approvalNotes: text('approval_notes'),
  rejectionReason: text('rejection_reason'),

  // Escalation
  escalatedTo: varchar('escalated_to'), // Manager ID if escalated
  escalatedDate: timestamp('escalated_date'),
  escalationReason: text('escalation_reason'),

  // Tracking
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Sales Manager Report - Margin Analysis
// This view would be generated via API endpoint for managers/admins only
export const marginAnalysisReport = {
  // Quote level
  quoteNumber: z.string(),
  salesRep: z.string(),
  customer: z.string(),
  quoteDate: z.date(),
  quoteStatus: z.string(),

  // Financial summary
  totalDealerCost: z.number(),
  totalRepCost: z.number(),
  totalCustomerPrice: z.number(),
  totalMargin: z.number(),
  marginPercentage: z.number(),

  // Line items with margin breakdown
  lineItems: z.array(z.object({
    productName: z.string(),
    quantity: z.number(),
    unitDealerCost: z.number(),
    unitRepCost: z.number(),
    unitCustomerPrice: z.number(),
    lineMargin: z.number(),
    lineMarginPercentage: z.number(),
  })),
};

// Zod Schemas for Validation
export const insertCompanyPricingSettingsSchema = createInsertSchema(companyPricingSettings);
export const insertEnhancedProductPricingSchema = createInsertSchema(enhancedProductPricing);
export const insertEnhancedQuotePricingSchema = createInsertSchema(enhancedQuotePricing);
export const insertEnhancedQuotePricingLineItemsSchema = createInsertSchema(enhancedQuotePricingLineItems);
export const insertPriceChangeApprovalSchema = createInsertSchema(priceChangeApprovals);

// TypeScript Types
export type CompanyPricingSettings = typeof companyPricingSettings.$inferSelect;
export type InsertCompanyPricingSettings = typeof companyPricingSettings.$inferInsert;

export type EnhancedProductPricing = typeof enhancedProductPricing.$inferSelect;
export type InsertEnhancedProductPricing = typeof enhancedProductPricing.$inferInsert;

export type EnhancedQuotePricing = typeof enhancedQuotePricing.$inferSelect;
export type InsertEnhancedQuotePricing = typeof enhancedQuotePricing.$inferInsert;

export type EnhancedQuotePricingLineItem = typeof enhancedQuotePricingLineItems.$inferSelect;
export type InsertEnhancedQuotePricingLineItem = typeof enhancedQuotePricingLineItems.$inferInsert;

export type PriceChangeApproval = typeof priceChangeApprovals.$inferSelect;
export type InsertPriceChangeApproval = typeof priceChangeApprovals.$inferInsert;

export type MarginAnalysisReport = z.infer<typeof marginAnalysisReport>;
