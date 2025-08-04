/**
 * Demo Scheduling Database Schema
 * Replaces mock data with proper database tables
 */

import { pgTable, varchar, timestamp, integer, decimal, boolean, text, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Demo Scheduling Status Enums
export const demoStatusEnum = ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'] as const;
export const demoTypeEnum = ['equipment', 'software', 'service', 'consultation'] as const;
export const demoLocationEnum = ['customer_site', 'dealer_showroom', 'virtual'] as const;
export const confirmationStatusEnum = ['pending', 'confirmed', 'declined'] as const;

// Demo Scheduling Table
export const demoSchedules = pgTable("demo_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Business Record Reference
  businessRecordId: varchar("business_record_id").notNull(), // Links to business_records table
  customerName: varchar("customer_name").notNull(),
  contactPerson: varchar("contact_person").notNull(),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  
  // Demo Details
  demoType: varchar("demo_type").notNull(), // equipment, software, service, consultation
  demoTitle: varchar("demo_title"),
  demoDescription: text("demo_description"),
  demoObjectives: text("demo_objectives"),
  
  // Scheduling Information
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: varchar("scheduled_time").notNull(), // Time in HH:MM format
  duration: integer("duration").notNull().default(60), // Duration in minutes
  timeZone: varchar("time_zone").default("America/New_York"),
  
  // Location Details
  demoLocation: varchar("demo_location").notNull(), // customer_site, dealer_showroom, virtual
  customerAddress: text("customer_address"), // For customer_site demos
  showroomLocation: varchar("showroom_location"), // For dealer_showroom demos
  virtualMeetingLink: varchar("virtual_meeting_link"), // For virtual demos
  virtualMeetingId: varchar("virtual_meeting_id"),
  virtualPlatform: varchar("virtual_platform"), // zoom, teams, etc.
  
  // Equipment and Products
  equipmentModels: jsonb("equipment_models").$type<string[]>().default([]),
  productCategories: jsonb("product_categories").$type<string[]>().default([]),
  softwareFeatures: jsonb("software_features").$type<string[]>().default([]),
  
  // Assignment and Ownership
  assignedSalesRep: varchar("assigned_sales_rep").notNull(),
  assignedTechnician: varchar("assigned_technician"), // For technical demos
  backupSalesRep: varchar("backup_sales_rep"),
  
  // Status and Confirmation
  status: varchar("status").notNull().default('scheduled'), // scheduled, confirmed, completed, cancelled, rescheduled
  confirmationStatus: varchar("confirmation_status").default('pending'), // pending, confirmed, declined
  confirmationDate: timestamp("confirmation_date"),
  confirmationMethod: varchar("confirmation_method"), // email, phone, text
  
  // Preparation and Requirements
  preparationCompleted: boolean("preparation_completed").default(false),
  preparationNotes: text("preparation_notes"),
  specialRequirements: text("special_requirements"),
  equipmentToTransport: jsonb("equipment_to_transport").$type<string[]>().default([]),
  materialsNeeded: jsonb("materials_needed").$type<string[]>().default([]),
  
  // Proposal and Financial
  proposalAmount: decimal("proposal_amount", { precision: 10, scale: 2 }),
  proposalId: varchar("proposal_id"), // Links to proposals/quotes
  expectedCloseDate: timestamp("expected_close_date"),
  probability: integer("probability").default(50), // 0-100%
  
  // Follow-up and Results
  demoCompleted: boolean("demo_completed").default(false),
  customerFeedback: text("customer_feedback"),
  customerSatisfaction: integer("customer_satisfaction"), // 1-5 rating
  followUpRequired: boolean("follow_up_required").default(true),
  followUpDate: timestamp("follow_up_date"),
  followUpMethod: varchar("follow_up_method"),
  nextSteps: text("next_steps"),
  
  // Outcome Tracking
  resultingProposal: varchar("resulting_proposal_id"),
  resultingSale: varchar("resulting_sale_id"),
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }),
  conversionDate: timestamp("conversion_date"),
  lostReason: varchar("lost_reason"),
  competitorInformation: text("competitor_information"),
  
  // Rescheduling History
  originalScheduledDate: timestamp("original_scheduled_date"),
  rescheduleCount: integer("reschedule_count").default(0),
  rescheduleReason: varchar("reschedule_reason"),
  rescheduleHistory: jsonb("reschedule_history").$type<Array<{
    from: string;
    to: string;
    reason: string;
    date: string;
  }>>().default([]),
  
  // Communication History
  remindersSent: integer("reminders_sent").default(0),
  lastReminderDate: timestamp("last_reminder_date"),
  communicationHistory: jsonb("communication_history").$type<Array<{
    type: string;
    date: string;
    method: string;
    subject: string;
    response: string;
  }>>().default([]),
  
  // Internal Notes and Tracking
  internalNotes: text("internal_notes"),
  salesNotes: text("sales_notes"),
  technicianNotes: text("technician_notes"),
  
  // System Tracking
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Demo Equipment Requirements
export const demoEquipmentRequirements = pgTable("demo_equipment_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  demoId: varchar("demo_id").notNull(), // References demo_schedules.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Equipment Details
  equipmentType: varchar("equipment_type").notNull(),
  manufacturer: varchar("manufacturer"),
  model: varchar("model").notNull(),
  serialNumber: varchar("serial_number"),
  
  // Configuration
  requiredFeatures: jsonb("required_features").$type<string[]>().default([]),
  specialConfiguration: text("special_configuration"),
  accessoriesNeeded: jsonb("accessories_needed").$type<string[]>().default([]),
  
  // Logistics
  transportRequired: boolean("transport_required").default(false),
  setupTime: integer("setup_time").default(30), // Minutes
  teardownTime: integer("teardown_time").default(15), // Minutes
  
  // Availability
  isAvailable: boolean("is_available").default(true),
  currentLocation: varchar("current_location"),
  availableFrom: timestamp("available_from"),
  availableUntil: timestamp("available_until"),
  
  // Status
  status: varchar("status").default('required'), // required, reserved, delivered, returned
  reservedBy: varchar("reserved_by"),
  reservedAt: timestamp("reserved_at"),
  
  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Demo Outcomes and Results
export const demoOutcomes = pgTable("demo_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  demoId: varchar("demo_id").notNull(), // References demo_schedules.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Outcome Details
  overallOutcome: varchar("overall_outcome").notNull(), // positive, neutral, negative
  customerInterestLevel: varchar("customer_interest_level"), // high, medium, low
  decisionTimeframe: varchar("decision_timeframe"), // immediate, 30_days, 60_days, 90_days, longer
  budgetConfirmed: boolean("budget_confirmed").default(false),
  decisionMakerPresent: boolean("decision_maker_present").default(false),
  
  // Specific Feedback
  featuresOfInterest: jsonb("features_of_interest").$type<string[]>().default([]),
  concerns: jsonb("concerns").$type<string[]>().default([]),
  competitiveSituation: text("competitive_situation"),
  priceExpectations: text("price_expectations"),
  
  // Ratings (1-5 scale)
  productFitRating: integer("product_fit_rating"),
  priceValueRating: integer("price_value_rating"),
  serviceRating: integer("service_rating"),
  overallSatisfaction: integer("overall_satisfaction"),
  
  // Next Steps
  immediateNextSteps: text("immediate_next_steps"),
  proposalRequested: boolean("proposal_requested").default(false),
  proposalDeadline: timestamp("proposal_deadline"),
  additionalInfoNeeded: text("additional_info_needed"),
  
  // Follow-up Planning
  nextMeetingScheduled: boolean("next_meeting_scheduled").default(false),
  nextMeetingDate: timestamp("next_meeting_date"),
  nextMeetingType: varchar("next_meeting_type"), // demo, proposal, negotiation
  stakeholdersToInvolve: jsonb("stakeholders_to_involve").$type<string[]>().default([]),
  
  // Internal Assessment
  probabilityAssessment: integer("probability_assessment"), // 0-100%
  expectedCloseDate: timestamp("expected_close_date"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  confidence: varchar("confidence"), // low, medium, high
  
  // Tracking
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas for Validation
export const insertDemoScheduleSchema = createInsertSchema(demoSchedules);
export const insertDemoEquipmentRequirementSchema = createInsertSchema(demoEquipmentRequirements);
export const insertDemoOutcomeSchema = createInsertSchema(demoOutcomes);

// Types
export type DemoSchedule = typeof demoSchedules.$inferSelect;
export type InsertDemoSchedule = typeof demoSchedules.$inferInsert;
export type DemoEquipmentRequirement = typeof demoEquipmentRequirements.$inferSelect;
export type InsertDemoEquipmentRequirement = typeof demoEquipmentRequirements.$inferInsert;
export type DemoOutcome = typeof demoOutcomes.$inferSelect;
export type InsertDemoOutcome = typeof demoOutcomes.$inferInsert;