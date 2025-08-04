/**
 * Unified form validation schemas and utilities
 * Addresses inconsistent validation patterns across the application
 */

import { z } from "zod";

// ============= COMMON FIELD VALIDATIONS =============

// Common string validations
export const requiredString = (fieldName: string, minLength = 1) =>
  z.string().min(minLength, `${fieldName} is required`);

export const optionalString = (maxLength?: number) =>
  maxLength ? z.string().max(maxLength).optional() : z.string().optional();

export const email = z.string().email("Please enter a valid email address");

export const phoneNumber = z.string()
  .regex(/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number")
  .optional()
  .or(z.literal(""));

export const currency = z.string()
  .regex(/^\d+(\.\d{1,2})?$/, "Please enter a valid amount (e.g., 123.45)")
  .transform(val => val ? parseFloat(val) : 0);

export const positiveNumber = z.number().min(0, "Must be a positive number");

export const percentage = z.number().min(0).max(100, "Must be between 0 and 100");

export const url = z.string().url("Please enter a valid URL").optional().or(z.literal(""));

export const dateString = z.string().min(1, "Date is required");

export const optionalDateString = z.string().optional();

// ============= BUSINESS DOMAIN VALIDATIONS =============

// Customer/Lead validations
export const companyName = requiredString("Company name", 2);
export const contactName = requiredString("Contact name", 2);
export const address = requiredString("Address", 5);
export const city = requiredString("City", 2);
export const state = requiredString("State", 2);
export const zipCode = z.string()
  .regex(/^\d{5}(-\d{4})?$/, "Please enter a valid ZIP code")
  .min(1, "ZIP code is required");

// Service ticket validations
export const ticketTitle = requiredString("Issue title", 3);
export const ticketDescription = requiredString("Issue description", 10);
export const priority = z.enum(["low", "medium", "high", "urgent"], {
  errorMap: () => ({ message: "Please select a priority level" })
});
export const ticketStatus = z.enum(["open", "in_progress", "resolved", "closed"], {
  errorMap: () => ({ message: "Please select a valid status" })
});

// Product/Inventory validations
export const productName = requiredString("Product name", 2);
export const sku = requiredString("SKU", 3);
export const price = z.number().min(0.01, "Price must be greater than $0.00");
export const stockQuantity = z.number().int().min(0, "Stock quantity cannot be negative");
export const reorderPoint = z.number().int().min(0, "Reorder point cannot be negative");

// Financial validations
export const invoiceNumber = requiredString("Invoice number", 3);
export const amount = z.number().min(0.01, "Amount must be greater than $0.00");
export const taxRate = z.number().min(0).max(1, "Tax rate must be between 0 and 1");

// ============= COMPREHENSIVE FORM SCHEMAS =============

// Demo Scheduling Schema
export const demoSchedulingSchema = z.object({
  customerId: requiredString("Customer"),
  scheduledDate: dateString,
  duration: z.number().int().min(30, "Duration must be at least 30 minutes"),
  equipmentModels: z.string().optional(),
  proposalAmount: z.number().optional(),
  notes: optionalString(500),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled"]).default("scheduled"),
});

// Commission Management Schema
export const commissionPlanSchema = z.object({
  planName: requiredString("Plan name", 3),
  planType: z.enum(["flat_rate", "percentage", "tiered", "bonus"]),
  baseRate: z.number().min(0, "Base rate cannot be negative"),
  effectiveDate: dateString,
  endDate: optionalDateString,
  isActive: z.boolean().default(true),
  description: optionalString(1000),
});

export const commissionCalculationSchema = z.object({
  calculationPeriod: z.object({
    startDate: dateString,
    endDate: dateString,
  }),
  salesRepId: requiredString("Sales representative"),
  planId: requiredString("Commission plan"),
  includeBonus: z.boolean().default(false),
  adjustments: z.array(z.object({
    type: z.enum(["addition", "deduction"]),
    amount: amount,
    reason: requiredString("Adjustment reason", 5),
  })).optional(),
});

// Document Management Schema
export const documentUploadSchema = z.object({
  fileName: requiredString("File name", 3),
  category: z.enum([
    "contracts", 
    "service-docs", 
    "financial", 
    "compliance", 
    "training"
  ], {
    errorMap: () => ({ message: "Please select a document category" })
  }),
  tags: z.string().optional(),
  description: optionalString(500),
  confidentialityLevel: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
  retentionPeriod: z.number().int().min(1, "Retention period must be at least 1 year").optional(),
});

// Workflow Creation Schema
export const workflowCreationSchema = z.object({
  workflowName: requiredString("Workflow name", 3),
  category: z.enum([
    "customer", 
    "service", 
    "finance", 
    "equipment"
  ], {
    errorMap: () => ({ message: "Please select a workflow category" })
  }),
  description: requiredString("Description", 10),
  triggerConditions: z.array(z.object({
    field: requiredString("Field"),
    operator: z.enum(["equals", "contains", "greater_than", "less_than"]),
    value: requiredString("Value"),
  })).min(1, "At least one trigger condition is required"),
  actions: z.array(z.object({
    type: z.enum(["email", "task", "update_field", "notification"]),
    configuration: z.record(z.any()),
  })).min(1, "At least one action is required"),
  isActive: z.boolean().default(true),
});

// Purchase Order Schema
export const purchaseOrderSchema = z.object({
  poNumber: requiredString("PO Number", 3),
  vendorId: requiredString("Vendor"),
  orderDate: dateString,
  expectedDeliveryDate: optionalDateString,
  billingAddress: requiredString("Billing address", 10),
  shippingAddress: requiredString("Shipping address", 10),
  terms: optionalString(200),
  notes: optionalString(500),
  items: z.array(z.object({
    itemId: requiredString("Item"),
    description: requiredString("Description", 3),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    unitPrice: price,
    totalPrice: z.number().min(0, "Total price cannot be negative"),
  })).min(1, "At least one item is required"),
  subtotal: z.number().min(0, "Subtotal cannot be negative"),
  taxAmount: z.number().min(0, "Tax amount cannot be negative"),
  totalAmount: z.number().min(0, "Total amount cannot be negative"),
});

// Enhanced Business Record Schema
export const businessRecordSchema = z.object({
  recordType: z.enum(["lead", "customer"], {
    errorMap: () => ({ message: "Please select record type" })
  }),
  companyName,
  primaryContactName: contactName,
  primaryContactEmail: email,
  primaryContactPhone: phoneNumber,
  address,
  city,
  state,
  zipCode,
  website: url,
  industry: optionalString(50),
  estimatedDealValue: z.number().min(0, "Deal value cannot be negative").optional(),
  salesStage: z.enum([
    "new", "contacted", "qualified", "proposal_sent", 
    "negotiation", "closed_won", "closed_lost"
  ]).optional(),
  leadSource: z.enum([
    "website", "referral", "cold_call", "email_campaign", 
    "trade_show", "social_media", "other"
  ]).optional(),
  status: z.enum(["active", "inactive", "churned", "competitor_switch", "non_payment"]).default("active"),
  notes: optionalString(1000),
  customFields: z.record(z.any()).optional(),
});

// Service Ticket Schema
export const serviceTicketSchema = z.object({
  customerId: requiredString("Customer"),
  equipmentId: optionalString(),
  issueDescription: ticketDescription,
  priority,
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  category: z.enum([
    "maintenance", "repair", "installation", "training", 
    "consultation", "emergency", "warranty"
  ]),
  scheduledDate: optionalDateString,
  estimatedDuration: z.number().int().min(15, "Duration must be at least 15 minutes").optional(),
  assignedTechnicianId: optionalString(),
  customerNotes: optionalString(500),
  internalNotes: optionalString(500),
  photos: z.array(z.string()).optional(),
  parts: z.array(z.object({
    partNumber: requiredString("Part number"),
    description: requiredString("Part description"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    cost: z.number().min(0, "Cost cannot be negative").optional(),
  })).optional(),
});

// ============= VALIDATION UTILITIES =============

export type ValidationSchema = z.ZodSchema<any>;

export const createFormDefaults = <T extends Record<string, any>>(schema: z.ZodSchema<T>): Partial<T> => {
  try {
    return schema.parse({});
  } catch {
    return {};
  }
};

export const getFieldError = (fieldName: string, errors: any): string | undefined => {
  const fieldError = errors[fieldName];
  if (fieldError?.message) return fieldError.message;
  if (typeof fieldError === "string") return fieldError;
  return undefined;
};

export const validateField = <T>(schema: z.ZodSchema<T>, value: any): { isValid: boolean; error?: string } => {
  try {
    schema.parse(value);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0]?.message };
    }
    return { isValid: false, error: "Validation failed" };
  }
};

// Helper for real-time validation
export const createRealTimeValidator = <T>(schema: z.ZodSchema<T>) => {
  return (value: any) => {
    const result = validateField(schema, value);
    return result.error;
  };
};

// ============= ERROR MESSAGE CONSTANTS =============

export const VALIDATION_MESSAGES = {
  REQUIRED: "This field is required",
  INVALID_EMAIL: "Please enter a valid email address",
  INVALID_PHONE: "Please enter a valid phone number",
  INVALID_URL: "Please enter a valid URL",
  INVALID_DATE: "Please enter a valid date",
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters`,
  MAX_LENGTH: (max: number) => `Must be no more than ${max} characters`,
  POSITIVE_NUMBER: "Must be a positive number",
  INVALID_CURRENCY: "Please enter a valid amount (e.g., 123.45)",
  SELECT_OPTION: "Please select an option",
  AT_LEAST_ONE: "At least one item is required",
} as const;

export default {
  // Schemas
  demoSchedulingSchema,
  commissionPlanSchema,
  commissionCalculationSchema,
  documentUploadSchema,
  workflowCreationSchema,
  purchaseOrderSchema,
  businessRecordSchema,
  serviceTicketSchema,
  
  // Field validators
  requiredString,
  optionalString,
  email,
  phoneNumber,
  currency,
  url,
  
  // Utilities
  createFormDefaults,
  getFieldError,
  validateField,
  createRealTimeValidator,
  
  // Constants
  VALIDATION_MESSAGES,
};