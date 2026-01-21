import {
  pgTable,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Technician Locations (Current Position) ====================
export const technicianLocations = pgTable(
  'technician_locations',
  {
    id: varchar('id').primaryKey().default('gen_random_uuid()'),
    tenantId: varchar('tenant_id').notNull(),
    technicianId: varchar('technician_id').notNull(),

    // Location data
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    accuracy: decimal('accuracy', { precision: 6, scale: 2 }), // meters
    altitude: decimal('altitude', { precision: 8, scale: 2 }), // meters
    heading: decimal('heading', { precision: 5, scale: 2 }), // degrees (0-360)
    speed: decimal('speed', { precision: 6, scale: 2 }), // meters/second

    // Status
    status: varchar('status').notNull().default('active'), // active, offline, idle, on_break
    isMoving: boolean('is_moving').default(false),
    batteryLevel: integer('battery_level'), // 0-100

    // Current assignment
    currentTicketId: varchar('current_ticket_id'),
    currentCustomerId: varchar('current_customer_id'),

    // Address (reverse geocoded)
    address: text('address'),
    city: varchar('city'),
    state: varchar('state'),
    zipCode: varchar('zip_code'),

    // Metadata
    deviceId: varchar('device_id'),
    appVersion: varchar('app_version'),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('technician_locations_tenant_id_idx').on(table.tenantId),
    technicianIdIdx: index('technician_locations_technician_id_idx').on(
      table.tenantId,
      table.technicianId,
    ),
    statusIdx: index('technician_locations_status_idx').on(table.tenantId, table.status),
    ticketIdIdx: index('technician_locations_ticket_id_idx').on(
      table.tenantId,
      table.currentTicketId,
    ),
    timestampIdx: index('technician_locations_timestamp_idx').on(table.tenantId, table.timestamp),
  }),
);

export const insertTechnicianLocationSchema = createInsertSchema(technicianLocations).omit({
  id: true,
  updatedAt: true,
});
export type InsertTechnicianLocation = z.infer<typeof insertTechnicianLocationSchema>;
export type TechnicianLocation = typeof technicianLocations.$inferSelect;

// ==================== Location History (Historical Tracking) ====================
export const locationHistory = pgTable(
  'location_history',
  {
    id: varchar('id').primaryKey().default('gen_random_uuid()'),
    tenantId: varchar('tenant_id').notNull(),
    technicianId: varchar('technician_id').notNull(),

    // Location data
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    accuracy: decimal('accuracy', { precision: 6, scale: 2 }),
    altitude: decimal('altitude', { precision: 8, scale: 2 }),
    heading: decimal('heading', { precision: 5, scale: 2 }),
    speed: decimal('speed', { precision: 6, scale: 2 }),

    // Context
    ticketId: varchar('ticket_id'),
    customerId: varchar('customer_id'),
    activityType: varchar('activity_type'), // traveling, on_site, returning, idle

    // Distance tracking
    distanceFromPrevious: decimal('distance_from_previous', { precision: 10, scale: 2 }), // meters
    distanceFromTicket: decimal('distance_from_ticket', { precision: 10, scale: 2 }), // meters

    // Metadata
    deviceId: varchar('device_id'),
    batteryLevel: integer('battery_level'),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('location_history_tenant_id_idx').on(table.tenantId),
    technicianIdIdx: index('location_history_technician_id_idx').on(
      table.tenantId,
      table.technicianId,
    ),
    ticketIdIdx: index('location_history_ticket_id_idx').on(table.tenantId, table.ticketId),
    timestampIdx: index('location_history_timestamp_idx').on(table.tenantId, table.timestamp),
    activityTypeIdx: index('location_history_activity_type_idx').on(
      table.tenantId,
      table.activityType,
    ),
  }),
);

export const insertLocationHistorySchema = createInsertSchema(locationHistory).omit({
  id: true,
  createdAt: true,
});
export type InsertLocationHistory = z.infer<typeof insertLocationHistorySchema>;
export type LocationHistory = typeof locationHistory.$inferSelect;

// ==================== Route Assignments ====================
export const routeAssignments = pgTable(
  'route_assignments',
  {
    id: varchar('id').primaryKey().default('gen_random_uuid()'),
    tenantId: varchar('tenant_id').notNull(),
    technicianId: varchar('technician_id').notNull(),

    // Route details
    routeName: varchar('route_name').notNull(),
    routeDate: timestamp('route_date').notNull(),
    routeStatus: varchar('route_status').notNull().default('assigned'), // assigned, in_progress, completed, cancelled

    // Route waypoints (ordered list of tickets/locations)
    waypoints: jsonb('waypoints').notNull(), // [{ ticketId, address, lat, lng, sequence, estimatedArrival, status }]
    totalStops: integer('total_stops').notNull(),
    completedStops: integer('completed_stops').default(0),

    // Route optimization
    optimizedRoute: boolean('optimized_route').default(false),
    optimizationAlgorithm: varchar('optimization_algorithm'), // manual, distance, time, priority

    // Distance and time estimates
    totalDistance: decimal('total_distance', { precision: 10, scale: 2 }), // meters
    estimatedDuration: integer('estimated_duration'), // minutes
    actualDuration: integer('actual_duration'), // minutes

    // Start/End tracking
    routeStartTime: timestamp('route_start_time'),
    routeEndTime: timestamp('route_end_time'),
    startLocation: jsonb('start_location'), // { lat, lng, address }
    endLocation: jsonb('end_location'), // { lat, lng, address }

    // Metadata
    notes: text('notes'),
    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('route_assignments_tenant_id_idx').on(table.tenantId),
    technicianIdIdx: index('route_assignments_technician_id_idx').on(
      table.tenantId,
      table.technicianId,
    ),
    routeDateIdx: index('route_assignments_route_date_idx').on(table.tenantId, table.routeDate),
    statusIdx: index('route_assignments_status_idx').on(table.tenantId, table.routeStatus),
  }),
);

export const insertRouteAssignmentSchema = createInsertSchema(routeAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRouteAssignment = z.infer<typeof insertRouteAssignmentSchema>;
export type RouteAssignment = typeof routeAssignments.$inferSelect;

// ==================== Route Deviations ====================
export const routeDeviations = pgTable(
  'route_deviations',
  {
    id: varchar('id').primaryKey().default('gen_random_uuid()'),
    tenantId: varchar('tenant_id').notNull(),
    routeId: varchar('route_id').notNull(),
    technicianId: varchar('technician_id').notNull(),

    // Deviation details
    deviationType: varchar('deviation_type').notNull(), // off_route, delay, skipped_stop, early_arrival, late_arrival, unplanned_stop
    severity: varchar('severity').notNull(), // low, medium, high, critical

    // Location at deviation
    deviationLocation: jsonb('deviation_location').notNull(), // { lat, lng, address, timestamp }
    intendedLocation: jsonb('intended_location'), // { lat, lng, address, expectedTime }
    deviationDistance: decimal('deviation_distance', { precision: 10, scale: 2 }), // meters off route

    // Time impact
    detectedAt: timestamp('detected_at').notNull().defaultNow(),
    expectedTime: timestamp('expected_time'),
    actualTime: timestamp('actual_time'),
    delayMinutes: integer('delay_minutes'),

    // Context
    affectedTicketId: varchar('affected_ticket_id'),
    reason: text('reason'),
    autoDetected: boolean('auto_detected').default(true),

    // Resolution
    acknowledged: boolean('acknowledged').default(false),
    acknowledgedAt: timestamp('acknowledged_at'),
    acknowledgedBy: varchar('acknowledged_by'),
    resolved: boolean('resolved').default(false),
    resolvedAt: timestamp('resolved_at'),
    resolutionNotes: text('resolution_notes'),

    // Notifications
    notificationSent: boolean('notification_sent').default(false),
    notifiedUsers: jsonb('notified_users'), // [userId1, userId2]

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('route_deviations_tenant_id_idx').on(table.tenantId),
    routeIdIdx: index('route_deviations_route_id_idx').on(table.tenantId, table.routeId),
    technicianIdIdx: index('route_deviations_technician_id_idx').on(
      table.tenantId,
      table.technicianId,
    ),
    typeIdx: index('route_deviations_type_idx').on(table.tenantId, table.deviationType),
    severityIdx: index('route_deviations_severity_idx').on(table.tenantId, table.severity),
    resolvedIdx: index('route_deviations_resolved_idx').on(table.tenantId, table.resolved),
  }),
);

export const insertRouteDeviationSchema = createInsertSchema(routeDeviations).omit({
  id: true,
  createdAt: true,
});
export type InsertRouteDeviation = z.infer<typeof insertRouteDeviationSchema>;
export type RouteDeviation = typeof routeDeviations.$inferSelect;

// ==================== ETA Calculations ====================
export const etaCalculations = pgTable(
  'eta_calculations',
  {
    id: varchar('id').primaryKey().default('gen_random_uuid()'),
    tenantId: varchar('tenant_id').notNull(),
    ticketId: varchar('ticket_id').notNull(),
    technicianId: varchar('technician_id').notNull(),

    // Current position
    currentLatitude: decimal('current_latitude', { precision: 10, scale: 7 }).notNull(),
    currentLongitude: decimal('current_longitude', { precision: 10, scale: 7 }).notNull(),

    // Destination
    destinationLatitude: decimal('destination_latitude', { precision: 10, scale: 7 }).notNull(),
    destinationLongitude: decimal('destination_longitude', { precision: 10, scale: 7 }).notNull(),
    destinationAddress: text('destination_address'),

    // ETA calculation
    estimatedArrivalTime: timestamp('estimated_arrival_time').notNull(),
    calculationMethod: varchar('calculation_method').notNull(), // straight_line, road_distance, traffic_adjusted, historical

    // Distance and duration
    straightLineDistance: decimal('straight_line_distance', { precision: 10, scale: 2 }), // meters
    roadDistance: decimal('road_distance', { precision: 10, scale: 2 }), // meters
    estimatedDuration: integer('estimated_duration').notNull(), // minutes

    // Traffic and conditions
    trafficCondition: varchar('traffic_condition'), // light, moderate, heavy, unknown
    trafficDelayMinutes: integer('traffic_delay_minutes').default(0),
    weatherCondition: varchar('weather_condition'), // clear, rain, snow, unknown

    // Confidence
    confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }), // 0.00 to 1.00

    // Historical accuracy tracking
    actualArrivalTime: timestamp('actual_arrival_time'),
    accuracyMinutes: integer('accuracy_minutes'), // difference between estimated and actual

    // Context
    routeId: varchar('route_id'),
    stopSequence: integer('stop_sequence'),

    // Metadata
    calculatedAt: timestamp('calculated_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'), // ETA becomes stale after this time
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('eta_calculations_tenant_id_idx').on(table.tenantId),
    ticketIdIdx: index('eta_calculations_ticket_id_idx').on(table.tenantId, table.ticketId),
    technicianIdIdx: index('eta_calculations_technician_id_idx').on(
      table.tenantId,
      table.technicianId,
    ),
    routeIdIdx: index('eta_calculations_route_id_idx').on(table.tenantId, table.routeId),
    calculatedAtIdx: index('eta_calculations_calculated_at_idx').on(
      table.tenantId,
      table.calculatedAt,
    ),
  }),
);

export const insertEtaCalculationSchema = createInsertSchema(etaCalculations).omit({
  id: true,
  createdAt: true,
});
export type InsertEtaCalculation = z.infer<typeof insertEtaCalculationSchema>;
export type EtaCalculation = typeof etaCalculations.$inferSelect;

// ==================== Geofences ====================
export const geofences = pgTable(
  'geofences',
  {
    id: varchar('id').primaryKey().default('gen_random_uuid()'),
    tenantId: varchar('tenant_id').notNull(),

    // Geofence details
    name: varchar('name').notNull(),
    description: text('description'),
    geofenceType: varchar('geofence_type').notNull(), // customer_site, service_area, restricted_zone, depot

    // Location (center point for circular geofences)
    centerLatitude: decimal('center_latitude', { precision: 10, scale: 7 }).notNull(),
    centerLongitude: decimal('center_longitude', { precision: 10, scale: 7 }).notNull(),
    radiusMeters: decimal('radius_meters', { precision: 10, scale: 2 }), // for circular geofences

    // Polygon geofences (for complex shapes)
    polygonCoordinates: jsonb('polygon_coordinates'), // [{ lat, lng }, ...]

    // Associated entities
    customerId: varchar('customer_id'),
    locationId: varchar('location_id'),

    // Trigger settings
    triggerOnEntry: boolean('trigger_on_entry').default(true),
    triggerOnExit: boolean('trigger_on_exit').default(true),
    triggerOnDwell: boolean('trigger_on_dwell').default(false),
    dwellTimeMinutes: integer('dwell_time_minutes'), // time to trigger dwell event

    // Status
    isActive: boolean('is_active').default(true),

    // Metadata
    notes: text('notes'),
    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('geofences_tenant_id_idx').on(table.tenantId),
    typeIdx: index('geofences_type_idx').on(table.tenantId, table.geofenceType),
    customerIdIdx: index('geofences_customer_id_idx').on(table.tenantId, table.customerId),
    activeIdx: index('geofences_active_idx').on(table.tenantId, table.isActive),
  }),
);

export const insertGeofenceSchema = createInsertSchema(geofences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGeofence = z.infer<typeof insertGeofenceSchema>;
export type Geofence = typeof geofences.$inferSelect;

// ==================== Geofence Events ====================
export const geofenceEvents = pgTable(
  'geofence_events',
  {
    id: varchar('id').primaryKey().default('gen_random_uuid()'),
    tenantId: varchar('tenant_id').notNull(),
    geofenceId: varchar('geofence_id').notNull(),
    technicianId: varchar('technician_id').notNull(),

    // Event details
    eventType: varchar('event_type').notNull(), // entry, exit, dwell
    eventLocation: jsonb('event_location').notNull(), // { lat, lng, timestamp }

    // Context
    ticketId: varchar('ticket_id'),
    routeId: varchar('route_id'),

    // Duration tracking (for exit events)
    entryTime: timestamp('entry_time'),
    exitTime: timestamp('exit_time'),
    dwellDuration: integer('dwell_duration'), // minutes

    // Metadata
    deviceId: varchar('device_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('geofence_events_tenant_id_idx').on(table.tenantId),
    geofenceIdIdx: index('geofence_events_geofence_id_idx').on(table.tenantId, table.geofenceId),
    technicianIdIdx: index('geofence_events_technician_id_idx').on(
      table.tenantId,
      table.technicianId,
    ),
    ticketIdIdx: index('geofence_events_ticket_id_idx').on(table.tenantId, table.ticketId),
    eventTypeIdx: index('geofence_events_event_type_idx').on(table.tenantId, table.eventType),
  }),
);

export const insertGeofenceEventSchema = createInsertSchema(geofenceEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertGeofenceEvent = z.infer<typeof insertGeofenceEventSchema>;
export type GeofenceEvent = typeof geofenceEvents.$inferSelect;
