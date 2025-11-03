import { pgTable, varchar, text, timestamp, integer, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Platform-wide Apollo.io contacts cache (shared across all tenants)
// This table stores all Apollo.io contacts ever retrieved to minimize API calls
export const centralizedApolloContacts = pgTable("centralized_apollo_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apolloId: varchar("apollo_id").notNull().unique(), // Apollo.io unique identifier
  
  // Person Information
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  name: varchar("name"), // Full name
  title: varchar("title"),
  email: varchar("email"),
  emailStatus: varchar("email_status"), // verified, guessed, unavailable
  linkedinUrl: varchar("linkedin_url"),
  phoneNumbers: jsonb("phone_numbers").$type<string[]>(), // Array of phone numbers
  
  // Company Information
  organizationId: varchar("organization_id"), // Apollo org ID
  organizationName: varchar("organization_name"),
  websiteUrl: varchar("website_url"),
  companyDomain: varchar("company_domain"),
  companySize: varchar("company_size"),
  employeeCount: integer("employee_count"),
  industry: varchar("industry"),
  companyLocation: varchar("company_location"),
  
  // Position Information
  seniority: varchar("seniority"), // owner, founder, c_suite, vp, director, manager, senior, entry
  departments: jsonb("departments").$type<string[]>(), // Array of departments
  functions: jsonb("functions").$type<string[]>(), // Array of job functions
  
  // Enrichment Metadata
  rawData: jsonb("raw_data"), // Full Apollo.io response for future reference
  lastEnrichedAt: timestamp("last_enriched_at").defaultNow(),
  enrichmentVersion: integer("enrichment_version").default(1), // Track data freshness
  accessCount: integer("access_count").default(1), // How many times accessed across all tenants
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Indexes for efficient lookup and deduplication
  idxApolloId: index("idx_centralized_apollo_id").on(table.apolloId),
  idxEmail: index("idx_centralized_email").on(table.email),
  idxOrgName: index("idx_centralized_org_name").on(table.organizationName),
  idxSeniority: index("idx_centralized_seniority").on(table.seniority),
  idxEmailStatus: index("idx_centralized_email_status").on(table.emailStatus),
  idxLastEnriched: index("idx_centralized_last_enriched").on(table.lastEnrichedAt),
}));

// Tenant-specific Apollo.io lead tracking
// Tracks which Apollo contacts each tenant has viewed, added, or imported
export const tenantApolloLeads = pgTable("tenant_apollo_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  apolloContactId: varchar("apollo_contact_id").notNull(), // FK to centralized_apollo_contacts.id
  apolloId: varchar("apollo_id").notNull(), // Apollo.io unique identifier (denormalized for faster queries)
  
  // Tenant Interaction Tracking
  status: varchar("status").notNull().default("discovered"), // discovered, viewed, added_to_crm, rejected
  addedToCrm: boolean("added_to_crm").default(false),
  businessRecordId: varchar("business_record_id"), // FK to business_records if added to CRM
  
  // Discovery Context
  searchQuery: jsonb("search_query"), // The filters used when this lead was discovered
  discoveredVia: varchar("discovered_via").default("apollo_search"), // apollo_search, apollo_enrichment, bulk_import
  
  // User Actions
  viewedAt: timestamp("viewed_at"),
  viewedBy: varchar("viewed_by"), // User ID who viewed
  addedAt: timestamp("added_at"),
  addedBy: varchar("added_by"), // User ID who added to CRM
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: varchar("rejected_by"), // User ID who rejected
  rejectionReason: text("rejection_reason"),
  
  // Notes
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Indexes for tenant-specific queries
  idxTenantId: index("idx_tenant_apollo_tenant_id").on(table.tenantId),
  idxTenantStatus: index("idx_tenant_apollo_status").on(table.tenantId, table.status),
  idxApolloContact: index("idx_tenant_apollo_contact_id").on(table.apolloContactId),
  idxBusinessRecord: index("idx_tenant_business_record_id").on(table.businessRecordId),
  idxAddedToCrm: index("idx_tenant_added_to_crm").on(table.tenantId, table.addedToCrm),
  idxCreatedAt: index("idx_tenant_apollo_created_at").on(table.createdAt),
  // Composite index for finding existing leads before API calls
  idxTenantApollo: index("idx_tenant_apollo_lookup").on(table.tenantId, table.apolloId),
}));

// Apollo.io search result cache
// Caches search results to minimize API calls for identical searches
export const apolloSearchCache = pgTable("apollo_search_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  searchHash: varchar("search_hash").notNull().unique(), // MD5 hash of search filters
  
  // Search Parameters
  searchFilters: jsonb("search_filters").notNull(), // The exact filter object used
  
  // Results
  resultCount: integer("result_count").default(0),
  totalAvailable: integer("total_available").default(0), // Total matches from Apollo
  apolloIds: jsonb("apollo_ids").$type<string[]>(), // Array of Apollo IDs returned
  
  // Cache Metadata
  expiresAt: timestamp("expires_at").notNull(), // When this cache entry expires
  hitCount: integer("hit_count").default(1), // How many times this search was reused
  
  // API Usage Tracking
  apiCreditsUsed: integer("api_credits_used").default(1),
  
  createdAt: timestamp("created_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
}, (table) => ({
  idxSearchHash: index("idx_apollo_search_hash").on(table.searchHash),
  idxExpiresAt: index("idx_apollo_search_expires").on(table.expiresAt),
  idxCreatedAt: index("idx_apollo_search_created_at").on(table.createdAt),
}));

// Apollo.io API usage tracking
// Track API calls and credit consumption for monitoring and alerting
export const apolloApiUsage = pgTable("apollo_api_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"), // null for platform-level calls
  
  // API Call Details
  endpoint: varchar("endpoint").notNull(), // search, enrichment, bulk_enrichment
  method: varchar("method").notNull(), // GET, POST
  requestParams: jsonb("request_params"),
  
  // Response Details
  statusCode: integer("status_code"),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  
  // Credit Tracking
  creditsUsed: integer("credits_used").default(1),
  
  // Performance
  responseTimeMs: integer("response_time_ms"),
  
  // Rate Limiting
  rateLimitRemaining: integer("rate_limit_remaining"),
  rateLimitReset: timestamp("rate_limit_reset"),
  
  createdAt: timestamp("created_at").defaultNow(),
  userId: varchar("user_id"), // User who triggered the API call
}, (table) => ({
  idxTenantId: index("idx_apollo_usage_tenant_id").on(table.tenantId),
  idxEndpoint: index("idx_apollo_usage_endpoint").on(table.endpoint),
  idxCreatedAt: index("idx_apollo_usage_created_at").on(table.createdAt),
  idxSuccess: index("idx_apollo_usage_success").on(table.success),
  idxTenantDate: index("idx_apollo_usage_tenant_date").on(table.tenantId, table.createdAt),
}));

// Zod Schemas for validation
export const insertCentralizedApolloContactSchema = createInsertSchema(centralizedApolloContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantApolloLeadSchema = createInsertSchema(tenantApolloLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApolloSearchCacheSchema = createInsertSchema(apolloSearchCache).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
});

export const insertApolloApiUsageSchema = createInsertSchema(apolloApiUsage).omit({
  id: true,
  createdAt: true,
});

// Types
export type CentralizedApolloContact = typeof centralizedApolloContacts.$inferSelect;
export type InsertCentralizedApolloContact = z.infer<typeof insertCentralizedApolloContactSchema>;

export type TenantApolloLead = typeof tenantApolloLeads.$inferSelect;
export type InsertTenantApolloLead = z.infer<typeof insertTenantApolloLeadSchema>;

export type ApolloSearchCache = typeof apolloSearchCache.$inferSelect;
export type InsertApolloSearchCache = z.infer<typeof insertApolloSearchCacheSchema>;

export type ApolloApiUsage = typeof apolloApiUsage.$inferSelect;
export type InsertApolloApiUsage = z.infer<typeof insertApolloApiUsageSchema>;
