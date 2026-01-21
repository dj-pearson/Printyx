# Real-Time Service GPS Tracking System

## Overview

The Real-Time Service GPS Tracking System provides comprehensive location monitoring and route management for field service technicians. It enables dispatchers to track technician locations in real-time, optimize routes, monitor deviations, calculate accurate ETAs, and manage geofenced areas for automated alerts.

## System Architecture

### Database Schema

**7 tables with 34 composite indexes for real-time query performance:**

1. **technician_locations** - Current real-time location of technicians
   - Primary tracking table for active technician positions
   - Updates every 30-60 seconds from mobile devices
   - Stores GPS coordinates, movement status, battery level, current assignment

2. **location_history** - Historical tracking breadcrumbs
   - Immutable record of all location updates
   - Used for distance calculations, activity timelines, route playback
   - Retention: 90 days of detailed history

3. **route_assignments** - Routes assigned to technicians
   - Multi-stop service routes with waypoints
   - Route optimization (time-based or distance-based)
   - Progress tracking (completed vs pending stops)

4. **route_deviations** - Detected route deviations
   - Automated detection of delays, off-route travel, unplanned stops
   - Severity levels (low, medium, high, critical)
   - Acknowledgment and resolution workflow

5. **eta_calculations** - ETA calculations for service tickets
   - Traffic-adjusted arrival time predictions
   - Confidence scoring and accuracy tracking
   - Historical comparison for continuous improvement

6. **geofences** - Geofenced areas
   - Customer sites, service territories, depots, restricted zones
   - Circular (radius-based) and polygon (boundary-based) geofences
   - Entry/exit/dwell triggers for automated alerts

7. **geofence_events** - Geofence entry/exit/dwell events
   - Immutable record of all geofence crossings
   - Dwell time calculations for time-on-site tracking
   - Linked to tickets and routes for context

### Storage Layer

**46 storage methods** across IStorage interface:

#### Technician Locations (8 methods)

- `getTechnicianLocation(technicianId)` - Get current location for a technician
- `updateTechnicianLocation(technicianId, data)` - Update current location (called by mobile app)
- `createTechnicianLocation(data)` - Initialize location tracking for technician
- `deleteTechnicianLocation(technicianId)` - Remove location tracking
- `getAllTechnicianLocations(tenantId)` - Get all technician locations for dispatch view
- `getTechniciansByStatus(tenantId, status)` - Filter by status (active/offline/idle)
- `getTechniciansNearLocation(tenantId, lat, lng, radiusMeters)` - Find nearby technicians for dispatching
- `getTechnicianLocationHistory(technicianId, startDate, endDate)` - Get tracking history

#### Location History (5 methods)

- `createLocationHistory(data)` - Record location snapshot (automated)
- `getLocationHistory(technicianId, filters)` - Query history with filtering
- `getActivityTimeline(technicianId, ticketId)` - Get activity timeline for specific ticket
- `calculateDistanceTraveled(technicianId, startDate, endDate)` - Calculate total distance
- `bulkCreateLocationHistory(data[])` - Batch insert for performance

#### Route Assignments (8 methods)

- `getRouteAssignments(tenantId, filters)` - List routes with filtering
- `getRouteAssignment(routeId)` - Get specific route with all waypoints
- `createRouteAssignment(data)` - Create new route with optimization
- `updateRouteAssignment(routeId, tenantId, data)` - Update route waypoints/settings
- `deleteRouteAssignment(routeId, tenantId)` - Delete route
- `startRoute(routeId, tenantId)` - Mark route as started (status transition)
- `completeRoute(routeId, tenantId)` - Mark route as completed
- `updateRouteProgress(routeId, tenantId, stopData)` - Update completed stops in real-time

#### Route Deviations (7 methods)

- `getRouteDeviations(tenantId, filters)` - List deviations with filtering
- `getRouteDeviation(deviationId)` - Get specific deviation details
- `createRouteDeviation(data)` - Create deviation record (automated detection)
- `getUnresolvedDeviations(tenantId, filters)` - Get unresolved deviations requiring action
- `acknowledgeDeviation(deviationId, tenantId, userId)` - Acknowledge deviation (dispatcher action)
- `resolveDeviation(deviationId, tenantId, userId, notes)` - Resolve deviation with notes
- `updateRouteDeviation(deviationId, tenantId, data)` - Update deviation details

#### ETA Calculations (7 methods)

- `getEtaCalculations(tenantId, filters)` - List ETA calculations
- `getEtaCalculation(etaId)` - Get specific ETA calculation
- `createEtaCalculation(data)` - Create new ETA calculation
- `updateEtaCalculation(etaId, tenantId, data)` - Update ETA (recalculation)
- `getLatestEtaForTicket(ticketId, technicianId)` - Get most recent ETA for ticket
- `updateActualArrival(etaId, tenantId, actualTime)` - Record actual arrival for accuracy tracking
- `getEtaAccuracyMetrics(tenantId, technicianId, startDate, endDate)` - Calculate accuracy metrics

#### Geofences (6 methods)

- `getGeofences(tenantId, filters)` - List geofences with filtering
- `getGeofence(geofenceId)` - Get specific geofence
- `createGeofence(data)` - Create new geofence (Admin/Manager only)
- `updateGeofence(geofenceId, tenantId, data)` - Update geofence
- `deleteGeofence(geofenceId, tenantId)` - Delete geofence
- `checkGeofenceProximity(lat, lng, tenantId)` - Check if location is within any geofence

#### Geofence Events (5 methods)

- `getGeofenceEvents(tenantId, filters)` - List geofence events
- `createGeofenceEvent(data)` - Record geofence event (automated)
- `getGeofenceEvent(geofenceEventId)` - Get specific event
- `getGeofenceEventsForTechnician(technicianId, filters)` - Get events for technician
- `getGeofenceEventsForTicket(ticketId)` - Get events for specific ticket

### API Routes

**35 RESTful endpoints** organized by category:

#### Technician Locations (`/api/gps/technicians`)

```
GET    /api/gps/technicians/locations              Get all active technician locations
GET    /api/gps/technicians/:id/location           Get current location for specific technician
PUT    /api/gps/technicians/:id/location           Update technician location (mobile app)
GET    /api/gps/technicians/status/:status         Get technicians by status
GET    /api/gps/technicians/nearby                 Find nearby technicians
```

#### Location History (`/api/gps/location-history`, `/api/gps/technicians/:id/history`)

```
GET    /api/gps/technicians/:id/history            Get location history for technician
POST   /api/gps/location-history                   Create location history snapshot
GET    /api/gps/tickets/:ticketId/activity-timeline Get activity timeline for ticket
GET    /api/gps/technicians/:id/distance           Calculate distance traveled
```

#### Route Assignments (`/api/gps/routes`)

```
GET    /api/gps/routes                             List all routes with filtering
GET    /api/gps/routes/:id                         Get specific route
POST   /api/gps/routes                             Create new route
PUT    /api/gps/routes/:id                         Update route
DELETE /api/gps/routes/:id                         Delete route
POST   /api/gps/routes/:id/start                   Start a route
POST   /api/gps/routes/:id/complete                Complete a route
PATCH  /api/gps/routes/:id/progress                Update route progress
```

#### Route Deviations (`/api/gps/deviations`)

```
GET    /api/gps/deviations                         List route deviations
GET    /api/gps/deviations/unresolved              Get unresolved deviations
GET    /api/gps/deviations/:id                     Get specific deviation
POST   /api/gps/deviations                         Create deviation record
POST   /api/gps/deviations/:id/acknowledge         Acknowledge deviation
POST   /api/gps/deviations/:id/resolve             Resolve deviation
```

#### ETA Calculations (`/api/gps/etas`)

```
GET    /api/gps/etas                               List ETA calculations
GET    /api/gps/etas/:id                           Get specific ETA
POST   /api/gps/etas                               Create ETA calculation
GET    /api/gps/tickets/:ticketId/eta              Get latest ETA for ticket
PATCH  /api/gps/etas/:id/arrival                   Update actual arrival time
GET    /api/gps/technicians/:id/eta-accuracy       Get ETA accuracy metrics
```

#### Geofences (`/api/gps/geofences`)

```
GET    /api/gps/geofences                          List geofences
GET    /api/gps/geofences/:id                      Get specific geofence
POST   /api/gps/geofences                          Create geofence (Admin/Manager)
PUT    /api/gps/geofences/:id                      Update geofence (Admin/Manager)
DELETE /api/gps/geofences/:id                      Delete geofence (Admin/Manager)
POST   /api/gps/geofences/check                    Check if location is in geofence
```

#### Geofence Events (`/api/gps/geofence-events`)

```
GET    /api/gps/geofence-events                    List geofence events
POST   /api/gps/geofence-events                    Create geofence event
GET    /api/gps/technicians/:id/geofence-events    Get events for technician
GET    /api/gps/tickets/:ticketId/geofence-events  Get events for ticket
```

## Key Features

### 1. Real-Time Location Tracking

- **Update Frequency**: 30-60 seconds from mobile devices
- **Accuracy**: GPS coordinates with accuracy radius (meters)
- **Movement Detection**: Automatic detection of moving vs stationary status
- **Battery Monitoring**: Track device battery level for field technician safety
- **Multi-Tenant**: Complete tenant isolation for SaaS deployment

### 2. Route Optimization & Management

- **Route Types**: Single-stop and multi-stop routes
- **Optimization Algorithms**:
  - Time-based: Minimize total travel time
  - Distance-based: Minimize total distance traveled
- **Waypoint Management**: Ordered stops with estimated arrival times
- **Progress Tracking**: Real-time updates as stops are completed
- **Route Replay**: Historical playback of completed routes

### 3. Automated Deviation Detection

- **Deviation Types**:
  - **Delay**: Technician behind schedule at expected location
  - **Off Route**: Technician deviates from planned route
  - **Unplanned Stop**: Technician stops at unexpected location
  - **Missed Stop**: Technician skips a scheduled stop
- **Severity Levels**: Low, Medium, High, Critical
- **Automated Alerts**: Notify dispatchers based on severity
- **Acknowledgment Workflow**: Track dispatcher/manager review

### 4. ETA Calculations

- **Calculation Methods**:
  - Straight-line distance (fallback)
  - Road distance with traffic data (preferred)
  - Historical route analysis (machine learning ready)
- **Traffic Integration**: Real-time traffic condition adjustments
- **Weather Consideration**: Weather impact on travel time
- **Confidence Scoring**: 0-1 scale based on data quality
- **Accuracy Tracking**: Compare estimated vs actual arrival times

### 5. Geofencing

- **Geofence Types**:
  - **Customer Site**: Specific customer locations
  - **Service Area**: Designated service territories
  - **Depot**: Company facilities (office, warehouse)
  - **Restricted Zone**: No-entry areas
- **Trigger Types**:
  - Entry: Alert when technician enters geofence
  - Exit: Alert when technician leaves geofence
  - Dwell: Alert after technician stays X minutes
- **Automated Actions**: Webhook notifications, status updates, alerts

### 6. Analytics & Reporting

- **Distance Traveled**: Calculate total distance per technician/route
- **Time on Site**: Track time spent at each customer location
- **ETA Accuracy**: Measure prediction accuracy over time
- **Deviation Frequency**: Identify patterns requiring intervention
- **Geofence Compliance**: Monitor adherence to service territories

## Integration Points

### Mobile App Integration

The mobile field service app must:

1. **Request Location Permissions**: Get GPS access from the device
2. **Send Location Updates**: PUT `/api/gps/technicians/:id/location` every 30-60 seconds
3. **Track Battery Level**: Include battery percentage in updates
4. **Handle Offline Mode**: Queue updates when offline, sync when online
5. **Detect Movement**: Use device accelerometer to optimize update frequency

### Service Dispatch Integration

The service dispatch system integrates with:

1. **Technician Assignment**: Check nearby technicians when assigning tickets
2. **Route Creation**: Generate optimized routes based on ticket locations
3. **ETA Display**: Show estimated arrival times on tickets
4. **Deviation Alerts**: Notify dispatchers of route issues
5. **Geofence Automation**: Trigger ticket status updates on site arrival/departure

### Notification Integration

Automated notifications for:

1. **Customer Updates**: "Technician is 10 minutes away" SMS/email
2. **Dispatcher Alerts**: Route deviations, geofence violations
3. **Manager Reports**: Daily/weekly summaries of technician activity
4. **Safety Alerts**: Low battery, entering restricted zone

## Security & Privacy

### Authentication

- All endpoints require authenticated session (`req.session?.user`)
- 401 Unauthorized returned for unauthenticated requests
- Tenant ID validated on every request (multi-tenant isolation)

### Authorization

- **Admin/Manager**: Full access to all GPS tracking features
- **Dispatcher**: Read/write access to routes, deviations, ETAs
- **Technician**: Read own location, update own location, view own routes
- **Customer**: No direct access (customer-facing notifications only)

### Data Privacy

- **Retention Policy**: Location history retained for 90 days
- **Opt-Out Support**: Technicians can request location tracking pause (manual override)
- **Anonymization**: Historical data can be anonymized for analytics
- **GDPR Compliance**: Full data export and deletion support

## Performance Considerations

### Database Optimization

- **Composite Indexes**: 34 indexes for multi-tenant queries
- **Partitioning**: Location history can be partitioned by date for large datasets
- **Archival**: Historical data older than 90 days moved to cold storage

### Real-Time Updates

- **Polling**: Frontend polls `/api/gps/technicians/locations` every 10-30 seconds
- **WebSocket**: Real-time broadcasting deferred (Vite WebSocket conflict)
- **Rate Limiting**: Mobile apps throttled to max 2 updates/minute per technician

### Caching Strategy

- **Technician Locations**: Cache for 30 seconds (highly dynamic)
- **Routes**: Cache for 5 minutes (moderate change frequency)
- **Geofences**: Cache for 1 hour (rarely change)
- **ETA Calculations**: No cache (always fresh calculations)

## Seed Data

Comprehensive seed data includes:

- 5 technician locations (3 active, 1 idle, 1 offline)
- 20 location history records showing realistic movement patterns
- 2 route assignments (1 in progress, 1 assigned)
- 3 route deviations (delays, off-route, unplanned stops)
- 4 ETA calculations with traffic adjustments
- 4 geofences (customer site, service area, depot, restricted zone)
- 4 geofence events (entry, exit, dwell)

## Future Enhancements

### Phase 2 Features

1. **WebSocket Real-Time Broadcasting**: Live location updates to dispatch dashboard
2. **Machine Learning ETAs**: Train models on historical data for improved accuracy
3. **Predictive Routing**: Suggest optimal routes based on historical patterns
4. **Traffic Integration**: Real-time traffic API integration (Google Maps, Waze)
5. **Weather Integration**: Automated weather impact on ETAs
6. **Geofence Automation**: Advanced triggers (status updates, notifications, workflow automation)

### Advanced Analytics

1. **Technician Performance Scoring**: On-time arrival rate, distance efficiency
2. **Route Optimization AI**: Continuous learning from completed routes
3. **Customer Wait Time Predictions**: Historical analysis per customer/location
4. **Territory Optimization**: Recommend service territory boundaries based on activity

### Mobile Enhancements

1. **Turn-by-Turn Navigation**: In-app navigation to next stop
2. **Offline Route Access**: Download routes for offline areas
3. **Photo Geotagging**: Attach GPS coordinates to field service photos
4. **Voice Commands**: Hands-free route updates while driving

## Technical Implementation Notes

### Haversine Distance Calculation

Used for calculating distance between GPS coordinates:

```typescript
function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

### Geofence Proximity Detection

Checks if a point is within a circular geofence:

```typescript
function checkCircularGeofence(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  const distance = calculateHaversineDistance(pointLat, pointLng, centerLat, centerLng);
  return distance <= radiusMeters;
}
```

### Route Deviation Detection Logic

Automated detection runs on location updates:

```typescript
// Pseudo-code for deviation detection
if (distanceFromRoute > DEVIATION_THRESHOLD_METERS) {
  createDeviation({ type: 'off_route', severity: 'medium' });
}

if (delayMinutes > DELAY_THRESHOLD_MINUTES) {
  createDeviation({ type: 'delay', severity: calculateSeverity(delayMinutes) });
}

if (isUnplannedStop(location) && dwellTime > STOP_THRESHOLD_MINUTES) {
  createDeviation({ type: 'unplanned_stop', severity: 'low' });
}
```

## Support & Maintenance

### Monitoring

- **Location Update Frequency**: Alert if no updates for 10+ minutes (active technician)
- **Battery Levels**: Alert if technician battery < 15%
- **Deviation Rates**: Monitor unresolved deviation count
- **API Performance**: Track p95 latency for location endpoints

### Troubleshooting

**Common Issues:**

1. **No location updates**: Check mobile app permissions, internet connectivity
2. **Inaccurate ETAs**: Verify traffic data integration, check historical accuracy
3. **Missed geofence events**: Review geofence radius, check location update frequency
4. **Route optimization fails**: Validate waypoint coordinates, check algorithm selection

### Data Cleanup

- **Daily**: Archive location history > 90 days
- **Weekly**: Purge expired ETA calculations
- **Monthly**: Remove resolved deviations > 30 days old

---

**Version**: 1.0  
**Last Updated**: November 1, 2025  
**Maintained By**: Printyx Platform Team
