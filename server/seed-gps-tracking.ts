import { storage } from './storage';

async function seedGpsTracking() {
  try {
    console.log('Seeding GPS tracking system...');

    const tenantId = 'demo-tenant';
    const now = new Date();

    // Austin, TX coordinates for our demo
    const austinLat = 30.2672;
    const austinLng = -97.7431;

    // 1. Create current technician locations (5 technicians)
    console.log('Creating technician locations...');

    const tech1Location = await storage.createTechnicianLocation({
      tenantId,
      technicianId: 'tech-001',
      latitude: '30.2872',
      longitude: '-97.7531',
      accuracy: '10.5',
      heading: '45.0',
      speed: '15.5',
      status: 'active',
      isMoving: true,
      batteryLevel: 85,
      currentTicketId: 'ticket-101',
      currentCustomerId: 'customer-201',
      address: '123 Business Park Dr',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      deviceId: 'device-abc123',
      appVersion: '2.5.0',
      timestamp: now,
    });

    const tech2Location = await storage.createTechnicianLocation({
      tenantId,
      technicianId: 'tech-002',
      latitude: '30.3072',
      longitude: '-97.7231',
      accuracy: '8.2',
      heading: '180.0',
      speed: '0.0',
      status: 'active',
      isMoving: false,
      batteryLevel: 92,
      currentTicketId: 'ticket-102',
      currentCustomerId: 'customer-202',
      address: '456 Tech Boulevard',
      city: 'Austin',
      state: 'TX',
      zipCode: '78702',
      deviceId: 'device-def456',
      appVersion: '2.5.0',
      timestamp: now,
    });

    const tech3Location = await storage.createTechnicianLocation({
      tenantId,
      technicianId: 'tech-003',
      latitude: '30.2472',
      longitude: '-97.7631',
      accuracy: '12.0',
      heading: '270.0',
      speed: '20.3',
      status: 'active',
      isMoving: true,
      batteryLevel: 68,
      currentTicketId: 'ticket-103',
      currentCustomerId: 'customer-203',
      address: '789 Innovation Way',
      city: 'Austin',
      state: 'TX',
      zipCode: '78703',
      deviceId: 'device-ghi789',
      appVersion: '2.5.0',
      timestamp: now,
    });

    const tech4Location = await storage.createTechnicianLocation({
      tenantId,
      technicianId: 'tech-004',
      latitude: '30.2672',
      longitude: '-97.7831',
      accuracy: '15.0',
      speed: '0.0',
      status: 'idle',
      isMoving: false,
      batteryLevel: 45,
      address: 'Main Office - 100 Congress Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78704',
      deviceId: 'device-jkl012',
      appVersion: '2.4.5',
      timestamp: now,
    });

    const tech5Location = await storage.createTechnicianLocation({
      tenantId,
      technicianId: 'tech-005',
      latitude: '30.2772',
      longitude: '-97.7331',
      accuracy: '5.0',
      status: 'offline',
      isMoving: false,
      batteryLevel: 12,
      address: 'Last known: 321 Service Lane',
      city: 'Austin',
      state: 'TX',
      zipCode: '78705',
      deviceId: 'device-mno345',
      appVersion: '2.5.0',
      timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
    });

    console.log(`Created ${5} technician locations`);

    // 2. Create location history (tracking breadcrumbs)
    console.log('Creating location history...');

    const historyCount = 20;
    for (let i = 0; i < historyCount; i++) {
      const minutesAgo = i * 5; // Every 5 minutes
      await storage.createLocationHistory({
        tenantId,
        technicianId: 'tech-001',
        latitude: (30.2872 + i * 0.001).toString(),
        longitude: (-97.7531 - i * 0.0005).toString(),
        accuracy: '10.0',
        heading: '45.0',
        speed: '15.0',
        ticketId: 'ticket-101',
        customerId: 'customer-201',
        activityType: i < 15 ? 'traveling' : 'on_site',
        distanceFromPrevious: i === 0 ? '0' : '125.5',
        distanceFromTicket: ((15 - i) * 125.5).toString(),
        deviceId: 'device-abc123',
        batteryLevel: 90 - i,
        timestamp: new Date(now.getTime() - minutesAgo * 60 * 1000),
      });
    }

    console.log(`Created ${historyCount} location history records`);

    // 3. Create route assignments (2 active routes)
    console.log('Creating route assignments...');

    const route1 = await storage.createRouteAssignment({
      tenantId,
      technicianId: 'tech-001',
      routeName: 'North Austin Route - Morning',
      routeDate: now,
      routeStatus: 'in_progress',
      waypoints: [
        {
          sequence: 1,
          ticketId: 'ticket-101',
          address: '123 Business Park Dr, Austin, TX 78701',
          lat: 30.2872,
          lng: -97.7531,
          estimatedArrival: new Date(now.getTime() + 15 * 60 * 1000),
          status: 'in_progress',
        },
        {
          sequence: 2,
          ticketId: 'ticket-104',
          address: '555 Corporate Center, Austin, TX 78701',
          lat: 30.2972,
          lng: -97.7431,
          estimatedArrival: new Date(now.getTime() + 45 * 60 * 1000),
          status: 'pending',
        },
        {
          sequence: 3,
          ticketId: 'ticket-105',
          address: '777 Enterprise Pkwy, Austin, TX 78701',
          lat: 30.3072,
          lng: -97.7331,
          estimatedArrival: new Date(now.getTime() + 90 * 60 * 1000),
          status: 'pending',
        },
      ],
      totalStops: 3,
      completedStops: 0,
      optimizedRoute: true,
      optimizationAlgorithm: 'time',
      totalDistance: '12500.50',
      estimatedDuration: 120,
      routeStartTime: new Date(now.getTime() - 30 * 60 * 1000), // Started 30 min ago
      startLocation: {
        lat: 30.2672,
        lng: -97.7431,
        address: 'Main Office - 100 Congress Ave',
      },
      notes: 'High-priority service calls for major accounts',
      createdBy: 'dispatcher-001',
    });

    const route2 = await storage.createRouteAssignment({
      tenantId,
      technicianId: 'tech-002',
      routeName: 'Downtown Route - Afternoon',
      routeDate: now,
      routeStatus: 'assigned',
      waypoints: [
        {
          sequence: 1,
          ticketId: 'ticket-102',
          address: '456 Tech Boulevard, Austin, TX 78702',
          lat: 30.3072,
          lng: -97.7231,
          estimatedArrival: new Date(now.getTime() + 60 * 60 * 1000),
          status: 'pending',
        },
        {
          sequence: 2,
          ticketId: 'ticket-106',
          address: '888 Innovation Dr, Austin, TX 78702',
          lat: 30.3172,
          lng: -97.7131,
          estimatedArrival: new Date(now.getTime() + 105 * 60 * 1000),
          status: 'pending',
        },
      ],
      totalStops: 2,
      completedStops: 0,
      optimizedRoute: true,
      optimizationAlgorithm: 'distance',
      totalDistance: '8200.25',
      estimatedDuration: 90,
      startLocation: {
        lat: 30.2672,
        lng: -97.7431,
        address: 'Main Office - 100 Congress Ave',
      },
      notes: 'Preventive maintenance calls',
      createdBy: 'dispatcher-001',
    });

    console.log(`Created ${2} route assignments`);

    // 4. Create route deviations (3 deviations)
    console.log('Creating route deviations...');

    const deviation1 = await storage.createRouteDeviation({
      tenantId,
      routeId: route1.id,
      technicianId: 'tech-001',
      deviationType: 'delay',
      severity: 'medium',
      deviationLocation: {
        lat: 30.2872,
        lng: -97.7531,
        address: '123 Business Park Dr',
        timestamp: now,
      },
      intendedLocation: {
        lat: 30.2872,
        lng: -97.7531,
        expectedTime: new Date(now.getTime() - 15 * 60 * 1000), // Expected 15 min ago
      },
      delayMinutes: 15,
      affectedTicketId: 'ticket-101',
      reason: 'Customer requested additional equipment inspection',
      autoDetected: true,
      acknowledged: true,
      acknowledgedAt: new Date(now.getTime() - 5 * 60 * 1000),
      acknowledgedBy: 'dispatcher-001',
      resolved: false,
      notificationSent: true,
      notifiedUsers: ['dispatcher-001', 'manager-001'],
      detectedAt: new Date(now.getTime() - 10 * 60 * 1000),
    });

    const deviation2 = await storage.createRouteDeviation({
      tenantId,
      routeId: route1.id,
      technicianId: 'tech-001',
      deviationType: 'off_route',
      severity: 'low',
      deviationLocation: {
        lat: 30.275,
        lng: -97.76,
        address: 'Supply Store - 200 Service Rd',
        timestamp: new Date(now.getTime() - 45 * 60 * 1000),
      },
      intendedLocation: {
        lat: 30.2872,
        lng: -97.7531,
        expectedTime: new Date(now.getTime() - 30 * 60 * 1000),
      },
      deviationDistance: '2500.0',
      delayMinutes: 10,
      reason: 'Emergency parts pickup for critical repair',
      autoDetected: true,
      acknowledged: true,
      acknowledgedAt: new Date(now.getTime() - 40 * 60 * 1000),
      acknowledgedBy: 'tech-001',
      resolved: true,
      resolvedAt: new Date(now.getTime() - 35 * 60 * 1000),
      resolutionNotes: 'Parts acquired, back on route',
      notificationSent: true,
      notifiedUsers: ['dispatcher-001'],
      detectedAt: new Date(now.getTime() - 45 * 60 * 1000),
    });

    const deviation3 = await storage.createRouteDeviation({
      tenantId,
      routeId: route2.id,
      technicianId: 'tech-002',
      deviationType: 'unplanned_stop',
      severity: 'high',
      deviationLocation: {
        lat: 30.29,
        lng: -97.74,
        address: 'Highway Rest Area',
        timestamp: new Date(now.getTime() - 20 * 60 * 1000),
      },
      delayMinutes: 20,
      reason: 'Vehicle mechanical issue - waiting for roadside assistance',
      autoDetected: true,
      acknowledged: true,
      acknowledgedAt: new Date(now.getTime() - 15 * 60 * 1000),
      acknowledgedBy: 'dispatcher-001',
      resolved: false,
      notificationSent: true,
      notifiedUsers: ['dispatcher-001', 'manager-001', 'fleet-manager-001'],
      detectedAt: new Date(now.getTime() - 20 * 60 * 1000),
    });

    console.log(`Created ${3} route deviations`);

    // 5. Create ETA calculations (5 ETAs)
    console.log('Creating ETA calculations...');

    const eta1 = await storage.createEtaCalculation({
      tenantId,
      ticketId: 'ticket-101',
      technicianId: 'tech-001',
      currentLatitude: '30.2872',
      currentLongitude: '-97.7531',
      destinationLatitude: '30.2872',
      destinationLongitude: '-97.7531',
      destinationAddress: '123 Business Park Dr, Austin, TX 78701',
      estimatedArrivalTime: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes
      calculationMethod: 'traffic_adjusted',
      straightLineDistance: '50.0',
      roadDistance: '75.0',
      estimatedDuration: 5,
      trafficCondition: 'moderate',
      trafficDelayMinutes: 2,
      weatherCondition: 'clear',
      confidenceScore: '0.92',
      routeId: route1.id,
      stopSequence: 1,
      calculatedAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000), // Valid for 10 min
    });

    const eta2 = await storage.createEtaCalculation({
      tenantId,
      ticketId: 'ticket-104',
      technicianId: 'tech-001',
      currentLatitude: '30.2872',
      currentLongitude: '-97.7531',
      destinationLatitude: '30.2972',
      destinationLongitude: '-97.7431',
      destinationAddress: '555 Corporate Center, Austin, TX 78701',
      estimatedArrivalTime: new Date(now.getTime() + 35 * 60 * 1000), // 35 minutes
      calculationMethod: 'traffic_adjusted',
      straightLineDistance: '1250.0',
      roadDistance: '1800.0',
      estimatedDuration: 35,
      trafficCondition: 'light',
      trafficDelayMinutes: 0,
      weatherCondition: 'clear',
      confidenceScore: '0.88',
      routeId: route1.id,
      stopSequence: 2,
      calculatedAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    });

    const eta3 = await storage.createEtaCalculation({
      tenantId,
      ticketId: 'ticket-102',
      technicianId: 'tech-002',
      currentLatitude: '30.2672',
      currentLongitude: '-97.7431',
      destinationLatitude: '30.3072',
      destinationLongitude: '-97.7231',
      destinationAddress: '456 Tech Boulevard, Austin, TX 78702',
      estimatedArrivalTime: new Date(now.getTime() + 55 * 60 * 1000), // 55 minutes
      calculationMethod: 'traffic_adjusted',
      straightLineDistance: '4500.0',
      roadDistance: '6200.0',
      estimatedDuration: 55,
      trafficCondition: 'heavy',
      trafficDelayMinutes: 15,
      weatherCondition: 'rain',
      confidenceScore: '0.75',
      routeId: route2.id,
      stopSequence: 1,
      calculatedAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    });

    // Historical ETA with actual arrival (for accuracy tracking)
    const eta4 = await storage.createEtaCalculation({
      tenantId,
      ticketId: 'ticket-100',
      technicianId: 'tech-001',
      currentLatitude: '30.2672',
      currentLongitude: '-97.7431',
      destinationLatitude: '30.2872',
      destinationLongitude: '-97.7531',
      destinationAddress: 'Historical location',
      estimatedArrivalTime: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
      calculationMethod: 'traffic_adjusted',
      straightLineDistance: '2200.0',
      roadDistance: '3000.0',
      estimatedDuration: 25,
      trafficCondition: 'moderate',
      trafficDelayMinutes: 5,
      weatherCondition: 'clear',
      confidenceScore: '0.85',
      calculatedAt: new Date(now.getTime() - 90 * 60 * 1000),
      actualArrivalTime: new Date(now.getTime() - 62 * 60 * 1000), // 2 min late
      accuracyMinutes: 2,
    });

    console.log(`Created ${4} ETA calculations`);

    // 6. Create geofences (4 geofences)
    console.log('Creating geofences...');

    const geofence1 = await storage.createGeofence({
      tenantId,
      name: 'Customer Site - TechCorp HQ',
      description: 'Main headquarters for TechCorp customer',
      geofenceType: 'customer_site',
      centerLatitude: '30.2872',
      centerLongitude: '-97.7531',
      radiusMeters: '100.0',
      customerId: 'customer-201',
      triggerOnEntry: true,
      triggerOnExit: true,
      triggerOnDwell: true,
      dwellTimeMinutes: 5,
      isActive: true,
      notes: 'High-value customer site with service level agreement',
      createdBy: 'admin-001',
    });

    const geofence2 = await storage.createGeofence({
      tenantId,
      name: 'Service Territory - North Austin',
      description: 'Primary service area for North Austin region',
      geofenceType: 'service_area',
      centerLatitude: '30.3500',
      centerLongitude: '-97.7000',
      radiusMeters: '10000.0', // 10km radius
      triggerOnEntry: false,
      triggerOnExit: true,
      triggerOnDwell: false,
      isActive: true,
      notes: 'Alert if technician leaves service area without authorization',
      createdBy: 'admin-001',
    });

    const geofence3 = await storage.createGeofence({
      tenantId,
      name: 'Main Office Depot',
      description: 'Company headquarters and parts depot',
      geofenceType: 'depot',
      centerLatitude: '30.2672',
      centerLongitude: '-97.7431',
      radiusMeters: '50.0',
      triggerOnEntry: true,
      triggerOnExit: true,
      triggerOnDwell: false,
      isActive: true,
      notes: 'Track technician check-in/check-out times',
      createdBy: 'admin-001',
    });

    const geofence4 = await storage.createGeofence({
      tenantId,
      name: 'Restricted Zone - Airport',
      description: 'Airport restricted area - no service calls',
      geofenceType: 'restricted_zone',
      centerLatitude: '30.1945',
      centerLongitude: '-97.6699',
      radiusMeters: '5000.0',
      triggerOnEntry: true,
      triggerOnExit: false,
      triggerOnDwell: false,
      isActive: true,
      notes: 'Alert immediately if technician enters restricted zone',
      createdBy: 'admin-001',
    });

    console.log(`Created ${4} geofences`);

    // 7. Create geofence events (5 events)
    console.log('Creating geofence events...');

    await storage.createGeofenceEvent({
      tenantId,
      geofenceId: geofence1.id,
      technicianId: 'tech-001',
      eventType: 'entry',
      eventLocation: {
        lat: 30.2872,
        lng: -97.7531,
        timestamp: new Date(now.getTime() - 30 * 60 * 1000),
      },
      ticketId: 'ticket-101',
      routeId: route1.id,
      entryTime: new Date(now.getTime() - 30 * 60 * 1000),
      deviceId: 'device-abc123',
    });

    await storage.createGeofenceEvent({
      tenantId,
      geofenceId: geofence3.id,
      technicianId: 'tech-001',
      eventType: 'exit',
      eventLocation: {
        lat: 30.2672,
        lng: -97.7431,
        timestamp: new Date(now.getTime() - 60 * 60 * 1000),
      },
      routeId: route1.id,
      entryTime: new Date(now.getTime() - 75 * 60 * 1000),
      exitTime: new Date(now.getTime() - 60 * 60 * 1000),
      dwellDuration: 15,
      deviceId: 'device-abc123',
    });

    await storage.createGeofenceEvent({
      tenantId,
      geofenceId: geofence3.id,
      technicianId: 'tech-002',
      eventType: 'entry',
      eventLocation: {
        lat: 30.2672,
        lng: -97.7431,
        timestamp: new Date(now.getTime() - 10 * 60 * 1000),
      },
      routeId: route2.id,
      entryTime: new Date(now.getTime() - 10 * 60 * 1000),
      deviceId: 'device-def456',
    });

    await storage.createGeofenceEvent({
      tenantId,
      geofenceId: geofence1.id,
      technicianId: 'tech-001',
      eventType: 'dwell',
      eventLocation: {
        lat: 30.2872,
        lng: -97.7531,
        timestamp: new Date(now.getTime() - 25 * 60 * 1000),
      },
      ticketId: 'ticket-101',
      routeId: route1.id,
      entryTime: new Date(now.getTime() - 30 * 60 * 1000),
      dwellDuration: 5,
      deviceId: 'device-abc123',
    });

    console.log(`Created ${4} geofence events`);

    console.log('✅ GPS tracking system seeded successfully');
    console.log(`Summary:
  - 5 technician locations (3 active, 1 idle, 1 offline)
  - 20 location history records
  - 2 route assignments (1 in progress, 1 assigned)
  - 3 route deviations (1 resolved, 2 unresolved)
  - 4 ETA calculations (1 with actual arrival tracking)
  - 4 geofences (customer sites, service area, depot, restricted zone)
  - 4 geofence events (entry, exit, dwell)
    `);
  } catch (error) {
    console.error('❌ Error seeding GPS tracking:', error);
    throw error;
  }
}

// Run the seed function if called directly
if (require.main === module) {
  seedGpsTracking()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedGpsTracking };
