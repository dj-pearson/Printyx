import { sql } from 'drizzle-orm';
import {
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  pgEnum,
  uuid,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enhanced ticket status enum with more granular statuses
export const enhancedTicketStatusEnum = pgEnum('enhanced_ticket_status', [
  'new',                    // Just created, not assigned
  'assigned',               // Assigned to technician
  'scheduled',              // Scheduled for service
  'en_route',               // Technician heading to location
  'on_site',                // Technician checked in at location
  'in_progress',            // Working on issue
  'parts_needed',           // Waiting for parts
  'customer_approval',      // Waiting for customer approval
  'testing',                // Testing solution
  'completed',              // Issue resolved
  'follow_up_required',     // Needs follow-up visit
  'cancelled',              // Cancelled
  'escalated'               // Escalated to higher level
]);

// Ticket priority enum
export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low', 'medium', 'high', 'urgent', 'emergency'
]);

// Issue category enum
export const issueCategoryEnum = pgEnum('issue_category', [
  'paper_jam', 'print_quality', 'connectivity', 'hardware_failure', 
  'software_issue', 'toner_cartridge', 'maintenance', 'installation',
  'training', 'other'
]);

// Contact method for phone-in tickets
export const contactMethodEnum = pgEnum('contact_method', [
  'phone', 'email', 'portal', 'chat', 'walk_in'
]);

// Enhanced phone-in ticket creation table
export const phoneInTickets = pgTable("phone_in_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  
  // Caller information
  callerName: varchar("caller_name").notNull(),
  callerPhone: varchar("caller_phone").notNull(),
  callerEmail: varchar("caller_email"),
  callerRole: varchar("caller_role"), // "primary contact", "admin", "user", etc.
  
  // Customer/Location info
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name").notNull(),
  locationAddress: text("location_address").notNull(),
  locationBuilding: varchar("location_building"),
  locationFloor: varchar("location_floor"),
  locationRoom: varchar("location_room"),
  
  // Equipment information
  equipmentId: varchar("equipment_id"),
  equipmentBrand: varchar("equipment_brand"),
  equipmentModel: varchar("equipment_model"),
  equipmentSerial: varchar("equipment_serial"),
  
  // Issue details
  issueCategory: issueCategoryEnum("issue_category").notNull(),
  issueDescription: text("issue_description").notNull(),
  urgencyLevel: ticketPriorityEnum("urgency_level").notNull(),
  
  // Troubleshooting already attempted
  troubleshootingAttempted: text("troubleshooting_attempted"),
  errorCodes: jsonb("error_codes").$type<string[]>().default([]),
  
  // Business impact
  businessImpact: text("business_impact"),
  affectedUsers: integer("affected_users"),
  
  // Service preferences
  preferredServiceTime: varchar("preferred_service_time"), // "morning", "afternoon", "asap", etc.
  contactMethod: contactMethodEnum("contact_method").notNull(),
  specialInstructions: text("special_instructions"),
  
  // Call handling
  handledBy: varchar("handled_by").notNull(), // User who took the call
  callDuration: integer("call_duration_minutes"),
  
  // Conversion to service ticket
  convertedToTicketId: varchar("converted_to_ticket_id"),
  convertedAt: timestamp("converted_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced technician check-in with ticket workflow
export const technicianTicketSessions = pgTable("technician_ticket_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  serviceTicketId: varchar("service_ticket_id").notNull(),
  technicianId: varchar("technician_id").notNull(),
  
  // Location verification
  expectedLatitude: decimal("expected_latitude", { precision: 10, scale: 7 }),
  expectedLongitude: decimal("expected_longitude", { precision: 10, scale: 7 }),
  actualLatitude: decimal("actual_latitude", { precision: 10, scale: 7 }),
  actualLongitude: decimal("actual_longitude", { precision: 10, scale: 7 }),
  locationVerified: boolean("location_verified").default(false),
  distanceFromExpected: decimal("distance_from_expected", { precision: 8, scale: 2 }), // meters
  
  // Check-in details
  checkInTimestamp: timestamp("check_in_timestamp").defaultNow(),
  checkInAddress: text("check_in_address"),
  checkInNotes: text("check_in_notes"),
  
  // Guided workflow status
  workflowStep: varchar("workflow_step").default('initial_assessment'), 
  // Steps: initial_assessment, diagnosis, customer_approval, work_execution, testing, completion
  
  // Quick assessments
  initialAssessment: text("initial_assessment"),
  diagnosisNotes: text("diagnosis_notes"),
  customerApprovalNeeded: boolean("customer_approval_needed").default(false),
  customerApprovalReceived: boolean("customer_approval_received").default(false),
  
  // Work details
  workPerformed: text("work_performed"),
  partsUsedIds: jsonb("parts_used_ids").$type<string[]>().default([]),
  partsRequestedIds: jsonb("parts_requested_ids").$type<string[]>().default([]),
  
  // Completion
  issueResolved: boolean("issue_resolved").default(false),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpReason: text("follow_up_reason"),
  
  // Time tracking
  checkOutTimestamp: timestamp("check_out_timestamp"),
  totalDuration: integer("total_duration_minutes"),
  billableHours: decimal("billable_hours", { precision: 4, scale: 2 }),
  
  // Customer interaction
  customerPresent: boolean("customer_present").default(false),
  customerSignature: text("customer_signature"),
  customerSatisfactionRating: integer("customer_satisfaction_rating"), // 1-5
  customerFeedback: text("customer_feedback"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quick parts requests during active tickets
export const ticketPartsRequests = pgTable("ticket_parts_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  serviceTicketId: varchar("service_ticket_id").notNull(),
  sessionId: varchar("session_id").references(() => technicianTicketSessions.id),
  technicianId: varchar("technician_id").notNull(),
  
  // Parts details
  partNumber: varchar("part_number").notNull(),
  partDescription: varchar("part_description").notNull(),
  quantityNeeded: integer("quantity_needed").notNull(),
  
  // Request details
  urgency: ticketPriorityEnum("urgency").notNull(),
  justification: text("justification"),
  
  // Approval workflow
  requiresApproval: boolean("requires_approval").default(false),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectedReason: text("rejected_reason"),
  
  // Fulfillment
  status: varchar("status").default('requested'), // requested, approved, ordered, delivered, installed
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  vendorId: varchar("vendor_id"),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Technician workflow steps tracking
export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  sessionId: varchar("session_id").references(() => technicianTicketSessions.id).notNull(),
  
  stepName: varchar("step_name").notNull(), // initial_assessment, diagnosis, etc.
  stepStarted: timestamp("step_started").defaultNow(),
  stepCompleted: timestamp("step_completed"),
  stepData: jsonb("step_data"), // Store step-specific data
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const phoneInTicketsRelations = relations(phoneInTickets, ({ one }) => ({
  // Add relations to customers, users, etc. when needed
}));

export const technicianTicketSessionsRelations = relations(technicianTicketSessions, ({ many, one }) => ({
  partsRequests: many(ticketPartsRequests),
  workflowSteps: many(workflowSteps),
}));

export const ticketPartsRequestsRelations = relations(ticketPartsRequests, ({ one }) => ({
  session: one(technicianTicketSessions, {
    fields: [ticketPartsRequests.sessionId],
    references: [technicianTicketSessions.id],
  }),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  session: one(technicianTicketSessions, {
    fields: [workflowSteps.sessionId],
    references: [technicianTicketSessions.id],
  }),
}));

// Insert schemas
export const insertPhoneInTicketSchema = createInsertSchema(phoneInTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTechnicianTicketSessionSchema = createInsertSchema(technicianTicketSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTicketPartsRequestSchema = createInsertSchema(ticketPartsRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
  createdAt: true,
});

// Types
export type PhoneInTicket = typeof phoneInTickets.$inferSelect;
export type TechnicianTicketSession = typeof technicianTicketSessions.$inferSelect;
export type TicketPartsRequest = typeof ticketPartsRequests.$inferSelect;
export type WorkflowStep = typeof workflowSteps.$inferSelect;

export type InsertPhoneInTicket = z.infer<typeof insertPhoneInTicketSchema>;
export type InsertTechnicianTicketSession = z.infer<typeof insertTechnicianTicketSessionSchema>;
export type InsertTicketPartsRequest = z.infer<typeof insertTicketPartsRequestSchema>;
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;