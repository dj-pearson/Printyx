import { pgTable, varchar, text, timestamp, decimal, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== Technician Mileage Records ====================
export const technicianMileage = pgTable(
  "technician_mileage",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id").notNull(),
    technicianId: varchar("technician_id").notNull(),

    // Date tracking
    date: timestamp("date").notNull(),
    weekNumber: integer("week_number"),
    monthNumber: integer("month_number"),
    year: integer("year"),

    // Mileage data
    startOdometer: decimal("start_odometer", { precision: 10, scale: 1 }),
    endOdometer: decimal("end_odometer", { precision: 10, scale: 1 }),
    totalMiles: decimal("total_miles", { precision: 10, scale: 2 }).notNull(),

    // GPS-calculated distance (for verification)
    gpsCalculatedMiles: decimal("gps_calculated_miles", { precision: 10, scale: 2 }),

    // Mileage classification
    businessMiles: decimal("business_miles", { precision: 10, scale: 2 }).notNull().default("0"),
    personalMiles: decimal("personal_miles", { precision: 10, scale: 2 }).default("0"),
    commuteMiles: decimal("commute_miles", { precision: 10, scale: 2 }).default("0"),

    // Trip details
    numberOfTrips: integer("number_of_trips").default(0),
    numberOfStops: integer("number_of_stops").default(0),

    // Route information
    routeIds: jsonb("route_ids"), // [routeId1, routeId2, ...]
    ticketIds: jsonb("ticket_ids"), // [ticketId1, ticketId2, ...]

    // Start/End locations
    startLocation: jsonb("start_location"), // { lat, lng, address }
    endLocation: jsonb("end_location"), // { lat, lng, address }

    // Reimbursement
    reimbursementRate: decimal("reimbursement_rate", { precision: 6, scale: 4 }), // $/mile
    reimbursementAmount: decimal("reimbursement_amount", { precision: 10, scale: 2 }),
    reimbursementStatus: varchar("reimbursement_status").default("pending"), // pending, approved, paid, rejected

    // Fuel tracking
    fuelPurchased: decimal("fuel_purchased", { precision: 6, scale: 3 }), // gallons
    fuelCost: decimal("fuel_cost", { precision: 8, scale: 2 }),
    fuelReceiptAttached: boolean("fuel_receipt_attached").default(false),

    // Vehicle info
    vehicleId: varchar("vehicle_id"),
    vehiclePlateNumber: varchar("vehicle_plate_number"),

    // Verification
    verificationMethod: varchar("verification_method").default("gps"), // manual, gps, odometer, mixed
    isVerified: boolean("is_verified").default(false),
    verifiedBy: varchar("verified_by"),
    verifiedAt: timestamp("verified_at"),

    // Notes
    notes: text("notes"),
    adjustmentReason: text("adjustment_reason"), // If miles were adjusted

    // Metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index("technician_mileage_tenant_id_idx").on(table.tenantId),
    technicianIdIdx: index("technician_mileage_technician_id_idx").on(table.tenantId, table.technicianId),
    dateIdx: index("technician_mileage_date_idx").on(table.tenantId, table.date),
    yearMonthIdx: index("technician_mileage_year_month_idx").on(table.tenantId, table.year, table.monthNumber),
    statusIdx: index("technician_mileage_status_idx").on(table.tenantId, table.reimbursementStatus),
  })
);

export const insertTechnicianMileageSchema = createInsertSchema(technicianMileage).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTechnicianMileage = z.infer<typeof insertTechnicianMileageSchema>;
export type TechnicianMileage = typeof technicianMileage.$inferSelect;

// ==================== Mileage Reimbursement Rates ====================
export const mileageReimbursementRates = pgTable(
  "mileage_reimbursement_rates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id").notNull(),

    // Rate details
    rateName: varchar("rate_name").notNull(),
    rateDescription: text("rate_description"),
    rateType: varchar("rate_type").notNull(), // irs_standard, company_standard, custom

    // Rate value
    ratePerMile: decimal("rate_per_mile", { precision: 6, scale: 4 }).notNull(),
    currency: varchar("currency").default("USD"),

    // Effective dates
    effectiveStartDate: timestamp("effective_start_date").notNull(),
    effectiveEndDate: timestamp("effective_end_date"),

    // Applicability
    appliesToAllTechnicians: boolean("applies_to_all_technicians").default(true),
    applicableTechnicianIds: jsonb("applicable_technician_ids"), // [techId1, techId2, ...]
    applicableVehicleTypes: jsonb("applicable_vehicle_types"), // ['personal', 'company', 'rental']

    // Limits
    maxDailyMiles: decimal("max_daily_miles", { precision: 8, scale: 2 }),
    maxMonthlyMiles: decimal("max_monthly_miles", { precision: 10, scale: 2 }),
    maxAnnualMiles: decimal("max_annual_miles", { precision: 12, scale: 2 }),

    // Status
    isActive: boolean("is_active").default(true),

    // Metadata
    createdBy: varchar("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index("mileage_rates_tenant_id_idx").on(table.tenantId),
    activeIdx: index("mileage_rates_active_idx").on(table.tenantId, table.isActive),
    effectiveIdx: index("mileage_rates_effective_idx").on(table.tenantId, table.effectiveStartDate),
  })
);

export const insertMileageReimbursementRateSchema = createInsertSchema(mileageReimbursementRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMileageReimbursementRate = z.infer<typeof insertMileageReimbursementRateSchema>;
export type MileageReimbursementRate = typeof mileageReimbursementRates.$inferSelect;

// ==================== Mileage Reports (Summary Reports) ====================
export const mileageReports = pgTable(
  "mileage_reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id").notNull(),

    // Report details
    reportNumber: varchar("report_number").unique().notNull(),
    reportType: varchar("report_type").notNull(), // weekly, monthly, quarterly, annual, custom

    // Period
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // Technician (optional - null for company-wide reports)
    technicianId: varchar("technician_id"),

    // Summary data
    totalMiles: decimal("total_miles", { precision: 12, scale: 2 }).notNull(),
    businessMiles: decimal("business_miles", { precision: 12, scale: 2 }).notNull(),
    personalMiles: decimal("personal_miles", { precision: 12, scale: 2 }),
    commuteMiles: decimal("commute_miles", { precision: 12, scale: 2 }),

    // Reimbursement summary
    totalReimbursement: decimal("total_reimbursement", { precision: 12, scale: 2 }),
    averageRatePerMile: decimal("average_rate_per_mile", { precision: 6, scale: 4 }),

    // Trip statistics
    totalTrips: integer("total_trips"),
    totalServiceCalls: integer("total_service_calls"),
    averageMilesPerTrip: decimal("average_miles_per_trip", { precision: 8, scale: 2 }),
    averageMilesPerDay: decimal("average_miles_per_day", { precision: 8, scale: 2 }),

    // Fuel summary (if tracked)
    totalFuelGallons: decimal("total_fuel_gallons", { precision: 10, scale: 3 }),
    totalFuelCost: decimal("total_fuel_cost", { precision: 10, scale: 2 }),
    averageMpg: decimal("average_mpg", { precision: 6, scale: 2 }),
    costPerMile: decimal("cost_per_mile", { precision: 6, scale: 4 }),

    // Daily breakdown
    dailyBreakdown: jsonb("daily_breakdown"), // [{ date, miles, trips, reimbursement }, ...]

    // Status
    reportStatus: varchar("report_status").default("draft"), // draft, submitted, approved, rejected, paid
    submittedAt: timestamp("submitted_at"),
    submittedBy: varchar("submitted_by"),
    approvedAt: timestamp("approved_at"),
    approvedBy: varchar("approved_by"),
    rejectionReason: text("rejection_reason"),

    // Payment info
    paymentDate: timestamp("payment_date"),
    paymentReference: varchar("payment_reference"),
    paymentMethod: varchar("payment_method"), // payroll, check, direct_deposit, expense_report

    // Export tracking
    exportedToPayroll: boolean("exported_to_payroll").default(false),
    exportedAt: timestamp("exported_at"),
    exportFormat: varchar("export_format"), // csv, pdf, quickbooks, adp

    // Metadata
    notes: text("notes"),
    createdBy: varchar("created_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index("mileage_reports_tenant_id_idx").on(table.tenantId),
    technicianIdIdx: index("mileage_reports_technician_id_idx").on(table.tenantId, table.technicianId),
    periodIdx: index("mileage_reports_period_idx").on(table.tenantId, table.periodStart, table.periodEnd),
    statusIdx: index("mileage_reports_status_idx").on(table.tenantId, table.reportStatus),
    reportNumIdx: index("mileage_reports_num_idx").on(table.tenantId, table.reportNumber),
  })
);

export const insertMileageReportSchema = createInsertSchema(mileageReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMileageReport = z.infer<typeof insertMileageReportSchema>;
export type MileageReport = typeof mileageReports.$inferSelect;

// ==================== Vehicle Assignments ====================
export const vehicleAssignments = pgTable(
  "vehicle_assignments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id").notNull(),

    // Vehicle details
    vehicleName: varchar("vehicle_name").notNull(),
    vehicleType: varchar("vehicle_type").notNull(), // personal, company, rental, leased
    make: varchar("make"),
    model: varchar("model"),
    year: integer("year"),
    plateNumber: varchar("plate_number"),
    vin: varchar("vin"),

    // Assignment
    assignedToTechnicianId: varchar("assigned_to_technician_id"),
    assignmentStartDate: timestamp("assignment_start_date").notNull(),
    assignmentEndDate: timestamp("assignment_end_date"),

    // Odometer tracking
    currentOdometer: decimal("current_odometer", { precision: 10, scale: 1 }),
    lastOdometerUpdate: timestamp("last_odometer_update"),

    // Fuel efficiency
    estimatedMpg: decimal("estimated_mpg", { precision: 6, scale: 2 }),
    fuelType: varchar("fuel_type"), // gasoline, diesel, hybrid, electric

    // Insurance/Registration
    insuranceProvider: varchar("insurance_provider"),
    insuranceExpiry: timestamp("insurance_expiry"),
    registrationExpiry: timestamp("registration_expiry"),

    // Maintenance
    lastMaintenanceDate: timestamp("last_maintenance_date"),
    nextMaintenanceDue: timestamp("next_maintenance_due"),
    nextMaintenanceMiles: decimal("next_maintenance_miles", { precision: 10, scale: 1 }),

    // Status
    isActive: boolean("is_active").default(true),

    // Metadata
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index("vehicle_assignments_tenant_id_idx").on(table.tenantId),
    technicianIdIdx: index("vehicle_assignments_technician_id_idx").on(table.tenantId, table.assignedToTechnicianId),
    plateIdx: index("vehicle_assignments_plate_idx").on(table.tenantId, table.plateNumber),
    activeIdx: index("vehicle_assignments_active_idx").on(table.tenantId, table.isActive),
  })
);

export const insertVehicleAssignmentSchema = createInsertSchema(vehicleAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertVehicleAssignment = z.infer<typeof insertVehicleAssignmentSchema>;
export type VehicleAssignment = typeof vehicleAssignments.$inferSelect;

// ==================== IRS Mileage Log (For Tax Compliance) ====================
export const irsMileageLogs = pgTable(
  "irs_mileage_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: varchar("tenant_id").notNull(),
    technicianId: varchar("technician_id").notNull(),

    // Trip details (IRS required fields)
    tripDate: timestamp("trip_date").notNull(),
    startLocation: text("start_location").notNull(),
    endLocation: text("end_location").notNull(),
    businessPurpose: text("business_purpose").notNull(),
    milesdriven: decimal("miles_driven", { precision: 8, scale: 2 }).notNull(),

    // Optional IRS fields
    odometerStart: decimal("odometer_start", { precision: 10, scale: 1 }),
    odometerEnd: decimal("odometer_end", { precision: 10, scale: 1 }),
    vehicleUsed: varchar("vehicle_used"),
    tolls: decimal("tolls", { precision: 8, scale: 2 }),
    parking: decimal("parking", { precision: 8, scale: 2 }),

    // Related service call
    ticketId: varchar("ticket_id"),
    customerId: varchar("customer_id"),
    customerName: varchar("customer_name"),

    // Tax year
    taxYear: integer("tax_year").notNull(),

    // Metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index("irs_mileage_logs_tenant_id_idx").on(table.tenantId),
    technicianIdIdx: index("irs_mileage_logs_technician_id_idx").on(table.tenantId, table.technicianId),
    taxYearIdx: index("irs_mileage_logs_tax_year_idx").on(table.tenantId, table.taxYear),
    tripDateIdx: index("irs_mileage_logs_trip_date_idx").on(table.tenantId, table.tripDate),
  })
);

export const insertIrsMileageLogSchema = createInsertSchema(irsMileageLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertIrsMileageLog = z.infer<typeof insertIrsMileageLogSchema>;
export type IrsMileageLog = typeof irsMileageLogs.$inferSelect;
