// QuickBooks Integration Schema Extensions
import { sql } from 'drizzle-orm';
import {
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// QuickBooks Vendors table for QuickBooks vendor/supplier integration
export const qbVendors = pgTable("qb_vendors", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(), // For multi-tenancy
  
  // Core vendor information
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  printOnCheckName: varchar("print_on_check_name", { length: 255 }),
  isActive: boolean("is_active").default(true),
  
  // QuickBooks specific fields
  externalVendorId: varchar("external_vendor_id"), // QuickBooks vendor ID
  vendorTypeId: varchar("vendor_type_id"),
  taxId: varchar("tax_id"),
  accountNumber: varchar("account_number"),
  is1099Vendor: boolean("is_1099_vendor").default(false),
  currencyId: varchar("currency_id"),
  apAccountId: varchar("ap_account_id"),
  paymentTermsId: varchar("payment_terms_id"),
  
  // Financial information
  currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).default('0.00'),
  openBalanceDate: timestamp("open_balance_date"),
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }),
  
  // Contact information (stored as JSON for flexibility)
  primaryPhoneJson: jsonb("primary_phone_json"),
  alternatePhoneJson: jsonb("alternate_phone_json"),
  mobilePhoneJson: jsonb("mobile_phone_json"),
  faxJson: jsonb("fax_json"),
  primaryEmailJson: jsonb("primary_email_json"),
  websiteJson: jsonb("website_json"),
  billingAddressJson: jsonb("billing_address_json"),
  
  // Notes and metadata
  vendorNotes: text("vendor_notes"),
  
  // QuickBooks sync fields
  qbDomain: varchar("qb_domain"),
  isSparse: boolean("is_sparse").default(false),
  syncToken: varchar("sync_token"),
  metadataJson: jsonb("metadata_json"),
  
  // System fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// GL Accounts table for QuickBooks chart of accounts integration
export const glAccounts = pgTable("gl_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Core account information
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accountNumber: varchar("account_number", { length: 50 }),
  accountDescription: text("account_description"),
  fullyQualifiedName: varchar("fully_qualified_name", { length: 500 }),
  isActive: boolean("is_active").default(true),
  
  // Account hierarchy
  isSubAccount: boolean("is_sub_account").default(false),
  parentAccountId: varchar("parent_account_id"), // Self-referencing for hierarchy
  
  // Account classification
  accountClassification: varchar("account_classification", { length: 50 }), // Asset, Equity, Expense, Liability, Revenue
  accountType: varchar("account_type", { length: 100 }),
  accountSubType: varchar("account_sub_type", { length: 100 }),
  
  // Banking information
  bankAccountNumber: varchar("bank_account_number"),
  routingNumber: varchar("routing_number"),
  
  // Balance information
  openingBalance: decimal("opening_balance", { precision: 15, scale: 2 }).default('0.00'),
  openingBalanceDate: timestamp("opening_balance_date"),
  currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).default('0.00'),
  currentBalanceWithSubAccounts: decimal("current_balance_with_sub_accounts", { precision: 15, scale: 2 }).default('0.00'),
  
  // Tax and currency
  currencyId: varchar("currency_id"),
  taxCodeId: varchar("tax_code_id"),
  accountAlias: varchar("account_alias"),
  isTaxAccount: boolean("is_tax_account").default(false),
  
  // QuickBooks specific fields
  externalAccountId: varchar("external_account_id"),
  qbDomain: varchar("qb_domain"),
  isSparse: boolean("is_sparse").default(false),
  syncToken: varchar("sync_token"),
  metadataJson: jsonb("metadata_json"),
  
  // System fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Terms table for QuickBooks terms integration
export const paymentTerms = pgTable("payment_terms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Core term information
  termName: varchar("term_name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  termType: varchar("term_type", { length: 50 }), // Standard, DateDriven
  
  // Payment terms details
  dueDays: integer("due_days"),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 4 }),
  discountDays: integer("discount_days"),
  dayOfMonthDue: integer("day_of_month_due"),
  dueNextMonthDays: integer("due_next_month_days"),
  discountDayOfMonth: integer("discount_day_of_month"),
  
  // QuickBooks specific fields
  externalTermId: varchar("external_term_id"),
  qbDomain: varchar("qb_domain"),
  isSparse: boolean("is_sparse").default(false),
  syncToken: varchar("sync_token"),
  metadataJson: jsonb("metadata_json"),
  
  // System fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Methods table for QuickBooks payment method integration
export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Core payment method information
  paymentMethodName: varchar("payment_method_name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  paymentMethodType: varchar("payment_method_type", { length: 50 }), // CREDIT_CARD, NON_CREDIT_CARD
  
  // QuickBooks specific fields
  externalPaymentMethodId: varchar("external_payment_method_id"),
  qbDomain: varchar("qb_domain"),
  isSparse: boolean("is_sparse").default(false),
  syncToken: varchar("sync_token"),
  metadataJson: jsonb("metadata_json"),
  
  // System fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// QuickBooks Integration Status table to track sync status
export const quickbooksIntegrations = pgTable("quickbooks_integrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // QuickBooks connection information
  qbCompanyId: varchar("qb_company_id").notNull(),
  qbCompanyName: varchar("qb_company_name"),
  connectionStatus: varchar("connection_status", { length: 50 }).default('connected'), // connected, disconnected, expired
  
  // OAuth tokens (encrypted in production)
  accessTokenHash: text("access_token_hash"), // Store hash only for security
  refreshTokenHash: text("refresh_token_hash"), 
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Sync tracking
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: varchar("last_sync_status", { length: 50 }), // success, error, partial
  syncErrors: jsonb("sync_errors"),
  
  // Entity sync status
  customersSyncedAt: timestamp("customers_synced_at"),
  vendorsSyncedAt: timestamp("vendors_synced_at"),
  itemsSyncedAt: timestamp("items_synced_at"),
  invoicesSyncedAt: timestamp("invoices_synced_at"),
  accountsSyncedAt: timestamp("accounts_synced_at"),
  
  // System fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vendor Bills table for QuickBooks bill integration
export const vendorBills = pgTable("vendor_bills", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Core bill information
  billNumber: varchar("bill_number", { length: 100 }),
  transactionDate: timestamp("transaction_date").notNull(),
  dueDate: timestamp("due_date"),
  
  // Vendor and account references
  vendorId: varchar("vendor_id"), // References vendors table
  apAccountId: varchar("ap_account_id"), // References gl_accounts table
  
  // Financial information
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  balanceDue: decimal("balance_due", { precision: 15, scale: 2 }).notNull(),
  
  // Additional details
  departmentId: varchar("department_id"),
  currencyId: varchar("currency_id"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }),
  privateNote: text("private_note"),
  memo: text("memo"),
  
  // Structured data as JSON
  lineItemsJson: jsonb("line_items_json"), // Bill line items
  linkedTransactionsJson: jsonb("linked_transactions_json"),
  remitToAddressJson: jsonb("remit_to_address_json"),
  taxDetailJson: jsonb("tax_detail_json"),
  
  // Payment and tax information
  paymentTermsId: varchar("payment_terms_id"),
  globalTaxCalculation: varchar("global_tax_calculation"),
  transactionLocationType: varchar("transaction_location_type"),
  classId: varchar("class_id"),
  salesTermsId: varchar("sales_terms_id"),
  recurringDataId: varchar("recurring_data_id"),
  
  // QuickBooks specific fields
  externalBillId: varchar("external_bill_id"),
  qbDomain: varchar("qb_domain"),
  syncToken: varchar("sync_token"),
  metadataJson: jsonb("metadata_json"),
  
  // System fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas for validation
export const insertQbVendorSchema = createInsertSchema(qbVendors);
export const insertGlAccountSchema = createInsertSchema(glAccounts);
export const insertPaymentTermSchema = createInsertSchema(paymentTerms);
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods);
export const insertQuickbooksIntegrationSchema = createInsertSchema(quickbooksIntegrations);
export const insertVendorBillSchema = createInsertSchema(vendorBills);

// Type exports
export type QbVendor = typeof qbVendors.$inferSelect;
export type InsertQbVendor = z.infer<typeof insertQbVendorSchema>;

export type GlAccount = typeof glAccounts.$inferSelect;
export type InsertGlAccount = z.infer<typeof insertGlAccountSchema>;

export type PaymentTerm = typeof paymentTerms.$inferSelect;
export type InsertPaymentTerm = z.infer<typeof insertPaymentTermSchema>;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;

export type QuickbooksIntegration = typeof quickbooksIntegrations.$inferSelect;
export type InsertQuickbooksIntegration = z.infer<typeof insertQuickbooksIntegrationSchema>;

export type VendorBill = typeof vendorBills.$inferSelect;
export type InsertVendorBill = z.infer<typeof insertVendorBillSchema>;