import { pgTable, varchar, text, decimal, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Quote/Proposal Management System - Phase 1 Priority Implementation

// Proposal Templates for consistent branding and standardization
export const proposalTemplates = pgTable("proposal_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Template Details
  templateName: varchar("template_name").notNull(),
  templateType: varchar("template_type").notNull(), // equipment_lease, service_contract, maintenance_agreement, etc.
  description: text("description"),
  
  // Template Content
  headerContent: jsonb("header_content").$type<{
    companyLogo?: string;
    letterhead?: string;
    contactInfo?: string;
  }>(),
  
  coverPageTemplate: text("cover_page_template"), // HTML template
  executiveSummaryTemplate: text("executive_summary_template"),
  proposalBodyTemplate: text("proposal_body_template"),
  termsAndConditionsTemplate: text("terms_conditions_template"),
  footerTemplate: text("footer_template"),
  
  // Styling and Branding
  brandingColors: jsonb("branding_colors").$type<{
    primary?: string;
    secondary?: string;
    accent?: string;
  }>(),
  fontSettings: jsonb("font_settings").$type<{
    headerFont?: string;
    bodyFont?: string;
    fontSize?: number;
  }>(),
  
  // Template Settings
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  createdBy: varchar("created_by").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Equipment Packages - Pre-configured equipment bundles
export const equipmentPackages = pgTable("equipment_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Package Details
  packageName: varchar("package_name").notNull(),
  packageCode: varchar("package_code"), // Internal reference
  category: varchar("category"), // office_solution, production_solution, managed_print, etc.
  description: text("description"),
  
  // Package Configuration
  equipment: jsonb("equipment").$type<Array<{
    modelId: string;
    quantity: number;
    unitPrice: number;
    description?: string;
    isOptional?: boolean;
  }>>(),
  
  accessories: jsonb("accessories").$type<Array<{
    accessoryId: string;
    quantity: number;
    unitPrice: number;
    description?: string;
    isOptional?: boolean;
  }>>(),
  
  services: jsonb("services").$type<Array<{
    serviceId: string;
    description: string;
    monthlyPrice?: number;
    oneTimePrice?: number;
    duration?: number; // months
    isOptional?: boolean;
  }>>(),
  
  // Pricing
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  totalRetailPrice: decimal("total_retail_price", { precision: 10, scale: 2 }),
  recommendedSellingPrice: decimal("recommended_selling_price", { precision: 10, scale: 2 }),
  
  // Package Settings
  isActive: boolean("is_active").default(true),
  allowCustomization: boolean("allow_customization").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposals - Main proposal/quote entity
export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Proposal Identification
  proposalNumber: varchar("proposal_number").notNull().unique(),
  version: integer("version").default(1),
  title: varchar("title").notNull(),
  
  // Customer Information
  businessRecordId: varchar("business_record_id").notNull(), // Links to leads/customers
  contactId: varchar("contact_id"), // Primary contact for this proposal
  
  // Proposal Details
  templateId: varchar("template_id"), // Reference to proposal template
  proposalType: varchar("proposal_type").notNull(), // quote, proposal, contract
  status: varchar("status").notNull().default("draft"), // draft, sent, viewed, accepted, rejected, expired
  
  // Proposal Content
  executiveSummary: text("executive_summary"),
  customerNeeds: text("customer_needs"), // Identified requirements
  proposedSolution: text("proposed_solution"),
  implementationPlan: text("implementation_plan"),
  
  // Equipment and Services
  equipmentPackageId: varchar("equipment_package_id"), // Pre-configured package
  customEquipment: jsonb("custom_equipment").$type<Array<{
    type: 'equipment' | 'accessory' | 'service' | 'supply';
    itemId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    margin?: number;
    notes?: string;
  }>>(),
  
  // Pricing Summary
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  
  // Contract Terms
  paymentTerms: varchar("payment_terms"), // net_30, net_60, upfront, financing
  deliveryTerms: varchar("delivery_terms"),
  warrantyTerms: text("warranty_terms"),
  serviceTerms: text("service_terms"),
  
  // Proposal Lifecycle
  validUntil: timestamp("valid_until"), // Expiration date
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  
  // E-Signature Integration
  eSignatureRequired: boolean("e_signature_required").default(false),
  eSignatureProvider: varchar("e_signature_provider"), // docusign, adobe_sign, etc.
  eSignatureDocumentId: varchar("e_signature_document_id"),
  eSignatureStatus: varchar("e_signature_status"), // pending, signed, declined
  
  // Tracking and Analytics
  openCount: integer("open_count").default(0), // How many times opened
  lastOpenedAt: timestamp("last_opened_at"),
  timeSpentViewing: integer("time_spent_viewing").default(0), // seconds
  
  // Management
  createdBy: varchar("created_by").notNull(),
  assignedTo: varchar("assigned_to"), // Sales rep responsible
  teamId: varchar("team_id"), // For team visibility
  
  // Notes and Internal Comments
  internalNotes: text("internal_notes"),
  customerFeedback: text("customer_feedback"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Line Items - Detailed breakdown of proposed items
export const proposalLineItems = pgTable("proposal_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  proposalId: varchar("proposal_id").notNull(),
  
  // Line Item Details
  lineNumber: integer("line_number").notNull(), // Order in proposal
  itemType: varchar("item_type").notNull(), // equipment, accessory, service, supply, labor
  
  // Product/Service Reference
  productId: varchar("product_id"), // Reference to product tables
  productCode: varchar("product_code"),
  productName: varchar("product_name").notNull(),
  description: text("description"),
  
  // Quantities and Pricing
  quantity: integer("quantity").notNull().default(1),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }), // Dealer cost
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  
  // Discounts and Margins
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  margin: decimal("margin", { precision: 5, scale: 2 }), // Profit margin percentage
  
  // Service-Specific Fields
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency"), // monthly, quarterly, annually
  recurringDuration: integer("recurring_duration"), // number of billing cycles
  
  // Terms and Conditions
  leadTime: integer("lead_time"), // Days to delivery/implementation
  warrantyPeriod: integer("warranty_period"), // Months
  serviceLevel: varchar("service_level"), // standard, premium, basic
  
  // Customization Options
  isOptional: boolean("is_optional").default(false),
  isCustomizable: boolean("is_customizable").default(false),
  configurationOptions: jsonb("configuration_options").$type<Record<string, any>>(),
  
  // Alternative Options
  alternativeOptions: jsonb("alternative_options").$type<Array<{
    description: string;
    unitPrice: number;
    notes?: string;
  }>>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Comments and Collaboration
export const proposalComments = pgTable("proposal_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  proposalId: varchar("proposal_id").notNull(),
  
  // Comment Details
  commentType: varchar("comment_type").notNull(), // internal, customer_feedback, revision_request
  content: text("content").notNull(),
  
  // Author Information
  authorId: varchar("author_id").notNull(),
  authorName: varchar("author_name").notNull(),
  authorRole: varchar("author_role"), // sales_rep, manager, customer
  
  // Thread Management
  parentCommentId: varchar("parent_comment_id"), // For threaded comments
  isResolved: boolean("is_resolved").default(false),
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
  }>>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Analytics and Tracking
export const proposalAnalytics = pgTable("proposal_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  proposalId: varchar("proposal_id").notNull(),
  
  // Analytics Event
  eventType: varchar("event_type").notNull(), // opened, downloaded, shared, section_viewed
  eventDetails: jsonb("event_details").$type<{
    sectionViewed?: string;
    timeSpent?: number;
    deviceType?: string;
    ipAddress?: string;
    userAgent?: string;
  }>(),
  
  // Visitor Information
  visitorId: varchar("visitor_id"), // Anonymous visitor tracking
  customerUserId: varchar("customer_user_id"), // If logged in customer
  
  // Timing
  sessionId: varchar("session_id"),
  timestamp: timestamp("timestamp").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Proposal Approval Workflow
export const proposalApprovals = pgTable("proposal_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  proposalId: varchar("proposal_id").notNull(),
  
  // Approval Details
  approvalLevel: integer("approval_level").notNull(), // 1, 2, 3 for multi-level approvals
  approvalType: varchar("approval_type").notNull(), // pricing, terms, special_conditions
  requiredRole: varchar("required_role").notNull(), // manager, director, vp
  
  // Approval Status
  status: varchar("status").notNull().default("pending"), // pending, approved, rejected, escalated
  approverId: varchar("approver_id"),
  approverName: varchar("approver_name"),
  
  // Approval Details
  approvalNotes: text("approval_notes"),
  conditions: text("conditions"), // Any conditions for approval
  
  // Timing
  requestedAt: timestamp("requested_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type InsertProposalTemplate = typeof proposalTemplates.$inferInsert;
export type EquipmentPackage = typeof equipmentPackages.$inferSelect;
export type InsertEquipmentPackage = typeof equipmentPackages.$inferInsert;
export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;
export type ProposalLineItem = typeof proposalLineItems.$inferSelect;
export type InsertProposalLineItem = typeof proposalLineItems.$inferInsert;
export type ProposalComment = typeof proposalComments.$inferSelect;
export type InsertProposalComment = typeof proposalComments.$inferInsert;
export type ProposalAnalytics = typeof proposalAnalytics.$inferSelect;
export type InsertProposalAnalytics = typeof proposalAnalytics.$inferInsert;
export type ProposalApproval = typeof proposalApprovals.$inferSelect;
export type InsertProposalApproval = typeof proposalApprovals.$inferInsert;

// Zod schemas for validation
export const insertProposalTemplateSchema = createInsertSchema(proposalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentPackageSchema = createInsertSchema(equipmentPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalLineItemSchema = createInsertSchema(proposalLineItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalCommentSchema = createInsertSchema(proposalComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalAnalyticsSchema = createInsertSchema(proposalAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertProposalApprovalSchema = createInsertSchema(proposalApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});