/**
 * CSV Import Schema
 *
 * Comprehensive schema for CSV import functionality including:
 * - Import job tracking
 * - Duplicate detection and resolution
 * - AI-powered column mapping and data refinement
 * - Template definitions for all importable entities
 */

import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { pgEnum } from "drizzle-orm/pg-core";

// ============= ENUMS =============

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "validating",
  "awaiting_review",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const duplicateResolutionEnum = pgEnum("duplicate_resolution", [
  "skip",
  "merge",
  "create_new",
  "pending",
]);

export const importEntityTypeEnum = pgEnum("import_entity_type", [
  "business_records",
  "contacts",
  "products",
  "inventory",
  "equipment",
  "opportunities",
  "service_tickets",
  "invoices",
  "contracts",
]);

// ============= IMPORT JOBS TABLE =============

export const csvImportJobs = pgTable("csv_import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),

  // Import Configuration
  entityType: importEntityTypeEnum("entity_type").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size_bytes"),
  status: importStatusEnum("status").default("pending").notNull(),

  // AI Enhancement
  useAiRefinement: boolean("use_ai_refinement").default(false),
  aiMappingConfidence: integer("ai_mapping_confidence"), // 0-100
  aiProcessingCost: integer("ai_processing_cost"), // in tokens

  // Column Mapping
  originalHeaders: jsonb("original_headers").$type<string[]>(),
  columnMappings: jsonb("column_mappings").$type<ColumnMapping[]>(),
  unmappedColumns: jsonb("unmapped_columns").$type<string[]>(),

  // Validation & Processing Stats
  totalRows: integer("total_rows").default(0),
  validRows: integer("valid_rows").default(0),
  invalidRows: integer("invalid_rows").default(0),
  importedRows: integer("imported_rows").default(0),
  skippedRows: integer("skipped_rows").default(0),
  mergedRows: integer("merged_rows").default(0),

  // Duplicate Handling
  duplicatesDetected: integer("duplicates_detected").default(0),
  duplicatesResolved: integer("duplicates_resolved").default(0),
  duplicateStrategy: varchar("duplicate_strategy", { length: 50 }).default("prompt"), // 'skip_all', 'merge_all', 'create_all', 'prompt'

  // Error Tracking
  validationErrors: jsonb("validation_errors").$type<ValidationError[]>(),
  importErrors: jsonb("import_errors").$type<ImportError[]>(),

  // Raw Data (stored temporarily for review)
  rawData: jsonb("raw_data").$type<Record<string, any>[]>(),
  transformedData: jsonb("transformed_data").$type<Record<string, any>[]>(),

  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= DUPLICATE RECORDS TABLE =============

export const csvImportDuplicates = pgTable("csv_import_duplicates", {
  id: uuid("id").primaryKey().defaultRandom(),
  importJobId: uuid("import_job_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),

  // Row Information
  rowNumber: integer("row_number").notNull(),
  rowData: jsonb("row_data").$type<Record<string, any>>().notNull(),

  // Match Information
  existingRecordId: uuid("existing_record_id"),
  existingRecordData: jsonb("existing_record_data").$type<Record<string, any>>(),
  matchingFields: jsonb("matching_fields").$type<MatchingField[]>(),
  matchScore: integer("match_score"), // 0-100, how confident the match is

  // Resolution
  resolution: duplicateResolutionEnum("resolution").default("pending"),
  resolvedBy: uuid("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  mergeStrategy: jsonb("merge_strategy").$type<MergeStrategy>(), // Which fields to keep from which source

  // Result
  resultRecordId: uuid("result_record_id"), // The final record ID after resolution

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============= IMPORT TEMPLATES TABLE =============

export const csvImportTemplates = pgTable("csv_import_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"), // null = system templates

  // Template Info
  entityType: importEntityTypeEnum("entity_type").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),

  // Column Definitions
  columns: jsonb("columns").$type<TemplateColumn[]>().notNull(),

  // Sample Data
  sampleData: jsonb("sample_data").$type<Record<string, any>[]>(),

  // Validation Rules
  validationRules: jsonb("validation_rules").$type<ValidationRule[]>(),

  // Duplicate Detection Config
  duplicateDetectionFields: jsonb("duplicate_detection_fields").$type<string[]>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= TYPE DEFINITIONS =============

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number; // 0-100
  dataType: "string" | "number" | "boolean" | "date" | "email" | "phone" | "currency" | "url";
  transformation?: string; // Optional transformation to apply
  isRequired: boolean;
  aiSuggested: boolean;
  userConfirmed: boolean;
}

export interface ValidationError {
  rowNumber: number;
  column: string;
  value: any;
  errorType: "required" | "format" | "type" | "range" | "unique" | "reference";
  message: string;
  suggestion?: string;
}

export interface ImportError {
  rowNumber: number;
  errorType: string;
  message: string;
  details?: Record<string, any>;
}

export interface MatchingField {
  fieldName: string;
  importValue: any;
  existingValue: any;
  matchType: "exact" | "fuzzy" | "normalized";
  similarity: number; // 0-100
}

export interface MergeStrategy {
  // For each field, specify which source to use
  fieldSources: {
    [fieldName: string]: "import" | "existing" | "combine";
  };
  // For 'combine', specify how to combine
  combineRules?: {
    [fieldName: string]: "concat" | "newer" | "older" | "longer" | "custom";
  };
}

export interface TemplateColumn {
  name: string;
  dbField: string;
  type: "string" | "number" | "boolean" | "date" | "email" | "phone" | "currency" | "url";
  required: boolean;
  description: string;
  example: string;
  aliases?: string[]; // Alternative column names that map to this field
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface ValidationRule {
  field: string;
  rule: string; // 'required', 'email', 'phone', 'date', 'number', 'unique', 'exists', 'custom'
  params?: Record<string, any>;
  message: string;
}

// ============= ZOD SCHEMAS =============

export const insertCsvImportJobSchema = createInsertSchema(csvImportJobs);
export const selectCsvImportJobSchema = createSelectSchema(csvImportJobs);

export const insertCsvImportDuplicateSchema = createInsertSchema(csvImportDuplicates);
export const selectCsvImportDuplicateSchema = createSelectSchema(csvImportDuplicates);

export const insertCsvImportTemplateSchema = createInsertSchema(csvImportTemplates);
export const selectCsvImportTemplateSchema = createSelectSchema(csvImportTemplates);

// ============= API REQUEST/RESPONSE SCHEMAS =============

export const startImportRequestSchema = z.object({
  entityType: z.enum([
    "business_records",
    "contacts",
    "products",
    "inventory",
    "equipment",
    "opportunities",
    "service_tickets",
    "invoices",
    "contracts",
  ]),
  useAiRefinement: z.boolean().optional().default(false),
  duplicateStrategy: z.enum(["skip_all", "merge_all", "create_all", "prompt"]).optional().default("prompt"),
});

export const columnMappingRequestSchema = z.object({
  importJobId: z.string().uuid(),
  mappings: z.array(z.object({
    sourceColumn: z.string(),
    targetField: z.string(),
    confirmed: z.boolean().default(true),
  })),
});

export const duplicateResolutionRequestSchema = z.object({
  importJobId: z.string().uuid(),
  resolutions: z.array(z.object({
    duplicateId: z.string().uuid(),
    resolution: z.enum(["skip", "merge", "create_new"]),
    mergeStrategy: z.object({
      fieldSources: z.record(z.enum(["import", "existing", "combine"])),
      combineRules: z.record(z.enum(["concat", "newer", "older", "longer", "custom"])).optional(),
    }).optional(),
  })),
});

export const importProgressSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["pending", "validating", "awaiting_review", "processing", "completed", "failed", "cancelled"]),
  progress: z.number().min(0).max(100),
  totalRows: z.number(),
  processedRows: z.number(),
  validRows: z.number(),
  invalidRows: z.number(),
  duplicatesDetected: z.number(),
  duplicatesResolved: z.number(),
  errors: z.array(z.object({
    rowNumber: z.number(),
    message: z.string(),
  })).optional(),
});

// ============= ENTITY TEMPLATE DEFINITIONS =============

export const ENTITY_TEMPLATES: Record<string, TemplateColumn[]> = {
  business_records: [
    { name: "Company Name", dbField: "companyName", type: "string", required: true, description: "Business or organization name", example: "Acme Corporation", aliases: ["company", "business_name", "name", "organization"] },
    { name: "Record Type", dbField: "recordType", type: "string", required: true, description: "Type of record: lead or customer", example: "customer", aliases: ["type"], validation: { enum: ["lead", "customer"] } },
    { name: "Status", dbField: "status", type: "string", required: false, description: "Current status", example: "active", aliases: ["record_status"] },
    { name: "Industry", dbField: "industry", type: "string", required: false, description: "Business industry", example: "Healthcare", aliases: ["business_industry", "sector"] },
    { name: "Website", dbField: "website", type: "url", required: false, description: "Company website", example: "https://www.example.com", aliases: ["url", "web"] },
    { name: "Phone", dbField: "phone", type: "phone", required: false, description: "Primary phone number", example: "(555) 123-4567", aliases: ["telephone", "phone_number", "main_phone"] },
    { name: "Email", dbField: "email", type: "email", required: false, description: "Primary email address", example: "contact@example.com", aliases: ["contact_email", "primary_email"] },
    { name: "Address", dbField: "address", type: "string", required: false, description: "Street address", example: "123 Main Street", aliases: ["street", "street_address", "address_line_1"] },
    { name: "City", dbField: "city", type: "string", required: false, description: "City", example: "New York", aliases: ["town"] },
    { name: "State", dbField: "state", type: "string", required: false, description: "State or province", example: "NY", aliases: ["province", "region"] },
    { name: "Zip Code", dbField: "zipCode", type: "string", required: false, description: "Postal/ZIP code", example: "10001", aliases: ["postal_code", "zip", "postcode"] },
    { name: "Country", dbField: "country", type: "string", required: false, description: "Country", example: "USA", aliases: ["nation"] },
    { name: "Lead Source", dbField: "leadSource", type: "string", required: false, description: "How the lead was acquired", example: "Website", aliases: ["source", "acquisition_source"] },
    { name: "Annual Revenue", dbField: "annualRevenue", type: "currency", required: false, description: "Annual revenue", example: "1000000", aliases: ["revenue", "yearly_revenue"] },
    { name: "Employee Count", dbField: "employeeCount", type: "number", required: false, description: "Number of employees", example: "50", aliases: ["employees", "headcount", "staff_count"] },
    { name: "Primary Contact Name", dbField: "primaryContactName", type: "string", required: false, description: "Main contact person", example: "John Smith", aliases: ["contact_name", "main_contact"] },
    { name: "Primary Contact Email", dbField: "primaryContactEmail", type: "email", required: false, description: "Main contact email", example: "john@example.com", aliases: ["contact_email"] },
    { name: "Primary Contact Phone", dbField: "primaryContactPhone", type: "phone", required: false, description: "Main contact phone", example: "(555) 987-6543", aliases: ["contact_phone"] },
    { name: "Notes", dbField: "notes", type: "string", required: false, description: "Additional notes", example: "VIP customer", aliases: ["comments", "description"] },
    { name: "External ID", dbField: "externalCustomerId", type: "string", required: false, description: "ID from external system", example: "CUST-12345", aliases: ["external_customer_id", "legacy_id", "old_id"] },
  ],

  contacts: [
    { name: "First Name", dbField: "firstName", type: "string", required: true, description: "Contact's first name", example: "John", aliases: ["first", "fname", "given_name"] },
    { name: "Last Name", dbField: "lastName", type: "string", required: true, description: "Contact's last name", example: "Smith", aliases: ["last", "lname", "surname", "family_name"] },
    { name: "Email", dbField: "email", type: "email", required: false, description: "Email address", example: "john.smith@example.com", aliases: ["email_address", "e-mail"] },
    { name: "Phone", dbField: "phone", type: "phone", required: false, description: "Phone number", example: "(555) 123-4567", aliases: ["telephone", "phone_number", "mobile"] },
    { name: "Mobile", dbField: "mobile", type: "phone", required: false, description: "Mobile phone", example: "(555) 987-6543", aliases: ["cell", "cell_phone", "mobile_phone"] },
    { name: "Title", dbField: "title", type: "string", required: false, description: "Job title", example: "Sales Manager", aliases: ["job_title", "position", "role"] },
    { name: "Department", dbField: "department", type: "string", required: false, description: "Department", example: "Sales", aliases: ["dept", "division"] },
    { name: "Company Name", dbField: "companyName", type: "string", required: false, description: "Associated company (for linking)", example: "Acme Corp", aliases: ["company", "organization"] },
    { name: "LinkedIn", dbField: "linkedinUrl", type: "url", required: false, description: "LinkedIn profile URL", example: "https://linkedin.com/in/johnsmith", aliases: ["linkedin", "linkedin_profile"] },
    { name: "Is Primary", dbField: "isPrimary", type: "boolean", required: false, description: "Is this the primary contact?", example: "true", aliases: ["primary", "main_contact"] },
    { name: "Is Decision Maker", dbField: "isDecisionMaker", type: "boolean", required: false, description: "Is this a decision maker?", example: "false", aliases: ["decision_maker", "dm"] },
    { name: "Notes", dbField: "notes", type: "string", required: false, description: "Additional notes", example: "Prefers email contact", aliases: ["comments"] },
  ],

  products: [
    { name: "Product Name", dbField: "productName", type: "string", required: true, description: "Product name", example: "Canon imageRUNNER 2525", aliases: ["name", "title", "product"] },
    { name: "SKU", dbField: "sku", type: "string", required: false, description: "Stock keeping unit", example: "CAN-IR2525", aliases: ["product_code", "code", "part_number"] },
    { name: "Category", dbField: "category", type: "string", required: false, description: "Product category", example: "Copiers", aliases: ["product_category", "type"] },
    { name: "Manufacturer", dbField: "manufacturer", type: "string", required: false, description: "Manufacturer/brand", example: "Canon", aliases: ["brand", "make", "vendor"] },
    { name: "Model", dbField: "model", type: "string", required: false, description: "Model number", example: "IR2525", aliases: ["model_number", "model_no"] },
    { name: "Description", dbField: "description", type: "string", required: false, description: "Product description", example: "25 PPM B&W copier", aliases: ["desc", "product_description"] },
    { name: "List Price", dbField: "listPrice", type: "currency", required: false, description: "List/MSRP price", example: "5999.99", aliases: ["price", "msrp", "retail_price"] },
    { name: "Cost", dbField: "cost", type: "currency", required: false, description: "Cost/wholesale price", example: "3500.00", aliases: ["wholesale_price", "unit_cost"] },
    { name: "Speed (PPM)", dbField: "speedPpm", type: "number", required: false, description: "Pages per minute", example: "25", aliases: ["ppm", "speed"] },
    { name: "Color Capable", dbField: "colorCapable", type: "boolean", required: false, description: "Supports color printing", example: "false", aliases: ["color", "is_color"] },
    { name: "Is Active", dbField: "isActive", type: "boolean", required: false, description: "Product is available", example: "true", aliases: ["active", "available"] },
  ],

  inventory: [
    { name: "Part Number", dbField: "partNumber", type: "string", required: true, description: "Part/SKU number", example: "TN-321K", aliases: ["part", "sku", "part_no", "item_number"] },
    { name: "Name", dbField: "name", type: "string", required: true, description: "Item name", example: "Black Toner TN-321K", aliases: ["item_name", "description", "title"] },
    { name: "Category", dbField: "category", type: "string", required: false, description: "Item category", example: "Toner", aliases: ["item_category", "type"] },
    { name: "Manufacturer", dbField: "manufacturer", type: "string", required: false, description: "Manufacturer", example: "Konica Minolta", aliases: ["brand", "make", "vendor"] },
    { name: "Manufacturer Part #", dbField: "manufacturerPartNumber", type: "string", required: false, description: "OEM part number", example: "A33K130", aliases: ["oem_part", "mfr_part", "oem_number"] },
    { name: "Quantity On Hand", dbField: "quantityOnHand", type: "number", required: false, description: "Current stock quantity", example: "25", aliases: ["qty", "quantity", "stock", "on_hand"] },
    { name: "Reorder Point", dbField: "reorderPoint", type: "number", required: false, description: "Minimum stock level", example: "10", aliases: ["min_quantity", "reorder_level", "minimum"] },
    { name: "Reorder Quantity", dbField: "reorderQuantity", type: "number", required: false, description: "Quantity to reorder", example: "50", aliases: ["order_quantity"] },
    { name: "Unit Cost", dbField: "unitCost", type: "currency", required: false, description: "Cost per unit", example: "45.00", aliases: ["cost", "purchase_price"] },
    { name: "Unit Price", dbField: "unitPrice", type: "currency", required: false, description: "Selling price per unit", example: "89.99", aliases: ["price", "sell_price"] },
    { name: "Location", dbField: "location", type: "string", required: false, description: "Warehouse location", example: "Shelf A-12", aliases: ["bin", "bin_location", "warehouse_location"] },
    { name: "Supplier", dbField: "supplier", type: "string", required: false, description: "Preferred supplier", example: "Tech Distributors", aliases: ["vendor", "supplier_name"] },
  ],

  equipment: [
    { name: "Serial Number", dbField: "serialNumber", type: "string", required: true, description: "Equipment serial number", example: "ABC123456789", aliases: ["serial", "sn", "serial_no"] },
    { name: "Model", dbField: "model", type: "string", required: false, description: "Equipment model", example: "imageRUNNER 2525", aliases: ["model_number", "model_name"] },
    { name: "Manufacturer", dbField: "manufacturer", type: "string", required: false, description: "Equipment manufacturer", example: "Canon", aliases: ["make", "brand"] },
    { name: "Customer Name", dbField: "customerName", type: "string", required: false, description: "Customer (for linking)", example: "Acme Corp", aliases: ["customer", "company", "account"] },
    { name: "Location", dbField: "location", type: "string", required: false, description: "Physical location", example: "2nd Floor Copy Room", aliases: ["site", "placement"] },
    { name: "Install Date", dbField: "installDate", type: "date", required: false, description: "Installation date", example: "2024-01-15", aliases: ["installed", "installation_date", "setup_date"] },
    { name: "Contract End Date", dbField: "contractEndDate", type: "date", required: false, description: "Contract expiration", example: "2027-01-15", aliases: ["contract_end", "lease_end", "expiration"] },
    { name: "IP Address", dbField: "ipAddress", type: "string", required: false, description: "Network IP address", example: "192.168.1.100", aliases: ["ip", "network_address"] },
    { name: "Asset Tag", dbField: "assetTag", type: "string", required: false, description: "Asset tag/ID", example: "ASSET-00123", aliases: ["asset", "asset_id", "tag"] },
    { name: "Status", dbField: "status", type: "string", required: false, description: "Equipment status", example: "active", aliases: ["equipment_status", "state"], validation: { enum: ["active", "inactive", "maintenance", "retired"] } },
    { name: "Last Meter Read", dbField: "lastMeterRead", type: "number", required: false, description: "Latest meter reading", example: "125000", aliases: ["meter", "meter_reading", "total_copies"] },
    { name: "Notes", dbField: "notes", type: "string", required: false, description: "Additional notes", example: "High volume location", aliases: ["comments"] },
  ],

  opportunities: [
    { name: "Name", dbField: "name", type: "string", required: true, description: "Opportunity name", example: "Acme Corp - Fleet Replacement", aliases: ["opportunity_name", "deal_name", "title"] },
    { name: "Customer Name", dbField: "customerName", type: "string", required: false, description: "Customer (for linking)", example: "Acme Corp", aliases: ["customer", "company", "account"] },
    { name: "Stage", dbField: "stage", type: "string", required: false, description: "Sales stage", example: "Proposal", aliases: ["sales_stage", "status"], validation: { enum: ["Discovery", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"] } },
    { name: "Amount", dbField: "amount", type: "currency", required: false, description: "Deal value", example: "50000", aliases: ["value", "deal_value", "total"] },
    { name: "Probability", dbField: "probability", type: "number", required: false, description: "Win probability %", example: "75", aliases: ["win_probability", "chance"], validation: { min: 0, max: 100 } },
    { name: "Expected Close Date", dbField: "expectedCloseDate", type: "date", required: false, description: "Expected close date", example: "2024-06-30", aliases: ["close_date", "expected_close"] },
    { name: "Product", dbField: "product", type: "string", required: false, description: "Primary product", example: "Canon imageRUNNER 4525", aliases: ["product_name", "primary_product"] },
    { name: "Quantity", dbField: "quantity", type: "number", required: false, description: "Number of units", example: "5", aliases: ["qty", "units"] },
    { name: "Notes", dbField: "notes", type: "string", required: false, description: "Additional notes", example: "Replacing competitor equipment", aliases: ["description", "comments"] },
  ],

  service_tickets: [
    { name: "Subject", dbField: "subject", type: "string", required: true, description: "Ticket subject/title", example: "Copier paper jam error", aliases: ["title", "summary", "issue"] },
    { name: "Customer Name", dbField: "customerName", type: "string", required: false, description: "Customer (for linking)", example: "Acme Corp", aliases: ["customer", "company", "account"] },
    { name: "Serial Number", dbField: "serialNumber", type: "string", required: false, description: "Equipment serial (for linking)", example: "ABC123456789", aliases: ["serial", "equipment_serial"] },
    { name: "Priority", dbField: "priority", type: "string", required: false, description: "Ticket priority", example: "high", aliases: ["urgency"], validation: { enum: ["low", "medium", "high", "critical"] } },
    { name: "Status", dbField: "status", type: "string", required: false, description: "Ticket status", example: "open", aliases: ["ticket_status", "state"], validation: { enum: ["open", "in_progress", "pending", "resolved", "closed"] } },
    { name: "Description", dbField: "description", type: "string", required: false, description: "Detailed description", example: "Customer reports frequent paper jams in tray 2", aliases: ["details", "body"] },
    { name: "Contact Name", dbField: "contactName", type: "string", required: false, description: "Requester name", example: "Jane Doe", aliases: ["requester", "reported_by"] },
    { name: "Contact Phone", dbField: "contactPhone", type: "phone", required: false, description: "Requester phone", example: "(555) 123-4567", aliases: ["phone"] },
    { name: "Contact Email", dbField: "contactEmail", type: "email", required: false, description: "Requester email", example: "jane@acme.com", aliases: ["email"] },
    { name: "Created Date", dbField: "createdDate", type: "date", required: false, description: "When ticket was created", example: "2024-03-15", aliases: ["created", "opened_date"] },
  ],
};

// ============= DUPLICATE DETECTION FIELDS =============

export const DUPLICATE_DETECTION_CONFIG: Record<string, {
  primaryFields: string[];
  secondaryFields: string[];
  fuzzyMatchFields: string[];
  matchThreshold: number;
}> = {
  business_records: {
    primaryFields: ["companyName", "externalCustomerId"],
    secondaryFields: ["email", "phone", "website"],
    fuzzyMatchFields: ["companyName"],
    matchThreshold: 80,
  },
  contacts: {
    primaryFields: ["email"],
    secondaryFields: ["firstName", "lastName", "phone"],
    fuzzyMatchFields: ["firstName", "lastName"],
    matchThreshold: 85,
  },
  products: {
    primaryFields: ["sku"],
    secondaryFields: ["productName", "manufacturer", "model"],
    fuzzyMatchFields: ["productName"],
    matchThreshold: 90,
  },
  inventory: {
    primaryFields: ["partNumber", "manufacturerPartNumber"],
    secondaryFields: ["name"],
    fuzzyMatchFields: ["name"],
    matchThreshold: 90,
  },
  equipment: {
    primaryFields: ["serialNumber"],
    secondaryFields: ["assetTag"],
    fuzzyMatchFields: [],
    matchThreshold: 100,
  },
  opportunities: {
    primaryFields: [],
    secondaryFields: ["name", "customerName"],
    fuzzyMatchFields: ["name"],
    matchThreshold: 85,
  },
  service_tickets: {
    primaryFields: [],
    secondaryFields: ["subject", "customerName", "serialNumber"],
    fuzzyMatchFields: ["subject"],
    matchThreshold: 80,
  },
};

// ============= TYPE EXPORTS =============

export type CsvImportJob = typeof csvImportJobs.$inferSelect;
export type NewCsvImportJob = typeof csvImportJobs.$inferInsert;
export type CsvImportDuplicate = typeof csvImportDuplicates.$inferSelect;
export type NewCsvImportDuplicate = typeof csvImportDuplicates.$inferInsert;
export type CsvImportTemplate = typeof csvImportTemplates.$inferSelect;
export type NewCsvImportTemplate = typeof csvImportTemplates.$inferInsert;
