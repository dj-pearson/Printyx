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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Mobile field service status enum
export const fieldServiceStatusEnum = pgEnum('field_service_status', [
  'scheduled',      // Service appointment scheduled
  'en_route',       // Technician heading to location
  'checked_in',     // Arrived at customer location
  'in_progress',    // Working on service
  'completed',      // Service completed
  'cancelled'       // Service cancelled
]);

// Check-in/Check-out types enum
export const checkInTypeEnum = pgEnum('check_in_type', [
  'arrival',        // Checking in at customer location
  'departure',      // Checking out from customer location
  'break_start',    // Starting break
  'break_end'       // Ending break
]);

// Mobile service sessions - tracks technician check-in/out with GPS
export const mobileServiceSessions = pgTable("mobile_service_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  serviceTicketId: varchar("service_ticket_id").notNull(),
  technicianId: varchar("technician_id").notNull(),
  
  // Location tracking
  checkInLatitude: decimal("check_in_latitude", { precision: 10, scale: 7 }),
  checkInLongitude: decimal("check_in_longitude", { precision: 10, scale: 7 }),
  checkInAddress: text("check_in_address"),
  checkInTimestamp: timestamp("check_in_timestamp"),
  
  checkOutLatitude: decimal("check_out_latitude", { precision: 10, scale: 7 }),
  checkOutLongitude: decimal("check_out_longitude", { precision: 10, scale: 7 }),
  checkOutAddress: text("check_out_address"),
  checkOutTimestamp: timestamp("check_out_timestamp"),
  
  // Time tracking
  totalHours: decimal("total_hours", { precision: 4, scale: 2 }),
  breakHours: decimal("break_hours", { precision: 4, scale: 2 }),
  workingHours: decimal("working_hours", { precision: 4, scale: 2 }),
  
  // Status and notes
  status: fieldServiceStatusEnum("status").default('scheduled'),
  serviceNotes: text("service_notes"),
  customerSignature: text("customer_signature"), // Base64 encoded signature
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Time tracking entries - detailed log of all check-ins/outs
export const timeTrackingEntries = pgTable("time_tracking_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  sessionId: varchar("session_id").notNull().references(() => mobileServiceSessions.id),
  
  // Location data
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  address: text("address"),
  
  // Time tracking
  checkInType: checkInTypeEnum("check_in_type").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Photo documentation for service calls
export const servicePhotos = pgTable("service_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  serviceTicketId: varchar("service_ticket_id").notNull(),
  sessionId: varchar("session_id").references(() => mobileServiceSessions.id),
  
  // Photo metadata
  fileName: varchar("file_name").notNull(),
  originalName: varchar("original_name"),
  mimeType: varchar("mime_type").notNull(),
  fileSize: integer("file_size"),
  objectPath: text("object_path").notNull(), // Path in object storage
  
  // Location where photo was taken
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  address: text("address"),
  
  // Photo categorization
  category: varchar("category"), // 'before', 'during', 'after', 'damage', 'parts', 'completed'
  description: text("description"),
  
  // Metadata
  takenAt: timestamp("taken_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// GPS location history for technicians
export const locationHistory = pgTable("location_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  technicianId: varchar("technician_id").notNull(),
  sessionId: varchar("session_id").references(() => mobileServiceSessions.id),
  
  // Location data
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal("accuracy", { precision: 6, scale: 2 }), // GPS accuracy in meters
  address: text("address"),
  
  // Tracking metadata
  timestamp: timestamp("timestamp").defaultNow(),
  speed: decimal("speed", { precision: 5, scale: 2 }), // Speed in km/h
  heading: integer("heading"), // Direction in degrees (0-360)
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for validation
export const insertMobileServiceSessionSchema = createInsertSchema(mobileServiceSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimeTrackingEntrySchema = createInsertSchema(timeTrackingEntries).omit({
  id: true,
  createdAt: true,
});

export const insertServicePhotoSchema = createInsertSchema(servicePhotos).omit({
  id: true,
  uploadedAt: true,
  createdAt: true,
});

export const insertLocationHistorySchema = createInsertSchema(locationHistory).omit({
  id: true,
  createdAt: true,
});

// TypeScript types
export type MobileServiceSession = typeof mobileServiceSessions.$inferSelect;
export type TimeTrackingEntry = typeof timeTrackingEntries.$inferSelect;
export type ServicePhoto = typeof servicePhotos.$inferSelect;
export type LocationHistory = typeof locationHistory.$inferSelect;

export type InsertMobileServiceSession = z.infer<typeof insertMobileServiceSessionSchema>;
export type InsertTimeTrackingEntry = z.infer<typeof insertTimeTrackingEntrySchema>;
export type InsertServicePhoto = z.infer<typeof insertServicePhotoSchema>;
export type InsertLocationHistory = z.infer<typeof insertLocationHistorySchema>;