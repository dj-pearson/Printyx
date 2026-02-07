import { db } from './db';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('seed-field-service-data');

import {
  installations,
  serviceSignatures,
  installationChecklists,
  servicePhotos,
} from '@shared/schema';

async function seedFieldServiceData() {
  log.info('Starting field service data seeding...');

  try {
    // Get the first tenant for testing
    const tenants = await db.query.tenants.findMany({ limit: 1 });
    if (tenants.length === 0) {
      log.error('No tenants found. Please seed tenants first.');
      return;
    }
    const tenantId = tenants[0].id;
    log.info(`Using tenant: ${tenantId}`);

    // Clean up existing field service data for this tenant
    log.info('Cleaning up existing field service data...');
    await db.delete(servicePhotos).where(eq(servicePhotos.tenantId, tenantId));
    await db.delete(installationChecklists).where(eq(installationChecklists.tenantId, tenantId));
    await db.delete(serviceSignatures).where(eq(serviceSignatures.tenantId, tenantId));
    await db.delete(installations).where(eq(installations.tenantId, tenantId));
    log.info('✓ Cleanup complete');

    // Get some customers for testing
    const customers = await db.query.businessRecords.findMany({
      where: (records, { eq }) => eq(records.tenantId, tenantId),
      limit: 3,
    });

    if (customers.length === 0) {
      log.error('No customers found. Please seed business records first.');
      return;
    }

    // Equipment is optional for field service testing
    const equipment: any[] = [];

    // Get some technicians for testing
    const technicians = await db.query.technicians.findMany({
      where: (tech, { eq }) => eq(tech.tenantId, tenantId),
      limit: 3,
    });

    // Get some service tickets for testing
    const serviceTickets = await db.query.serviceTickets.findMany({
      where: (tickets, { eq }) => eq(tickets.tenantId, tenantId),
      limit: 3,
    });

    // Get a user for created_by/captured_by
    const users = await db.query.users.findMany({
      where: (u, { eq }) => eq(u.tenantId, tenantId),
      limit: 1,
    });

    if (users.length === 0) {
      log.error('No users found. Please seed users first.');
      return;
    }
    const userId = users[0].id;

    // ============================================================================
    // SEED INSTALLATIONS
    // ============================================================================

    log.info('Seeding installations...');

    const installationData = [
      {
        tenantId,
        installationNumber: 'INST-2024-001',
        installationType: 'new_equipment',
        customerId: customers[0].id,
        equipmentId: equipment.length > 0 ? equipment[0].id : null,
        serviceTicketId: serviceTickets.length > 0 ? serviceTickets[0].id : null,
        scheduledDate: new Date('2024-01-15T09:00:00'),
        completedDate: new Date('2024-01-15T11:30:00'),
        estimatedDuration: 150,
        assignedTechnicianId: technicians.length > 0 ? technicians[0].id : null,
        assistingTechnicianIds: technicians.length > 1 ? [technicians[1].id] : [],
        installationAddress: '123 Main St, Suite 100, New York, NY 10001',
        gpsLatitude: 40.7128,
        gpsLongitude: -74.006,
        status: 'completed',
        serialNumber: 'MX-B455W-001234',
        modelNumber: 'MX-B455W',
        networkConfigured: true,
        driversInstalled: true,
        userTrainingCompleted: true,
        installationNotes:
          'Standard installation completed successfully. Network printing configured for entire office.',
        technicianNotes: 'Customer requested additional training for scan-to-email feature.',
        customerName: customers[0].name,
        customerEmail: customers[0].email || 'contact@example.com',
        customerPhone: customers[0].phone || '555-0100',
        createdBy: userId,
      },
      {
        tenantId,
        installationNumber: 'INST-2024-002',
        installationType: 'replacement',
        customerId: customers[1] ? customers[1].id : customers[0].id,
        equipmentId: equipment.length > 1 ? equipment[1].id : null,
        serviceTicketId: serviceTickets.length > 1 ? serviceTickets[1].id : null,
        scheduledDate: new Date('2024-01-20T14:00:00'),
        estimatedDuration: 180,
        assignedTechnicianId:
          technicians.length > 1
            ? technicians[1].id
            : technicians.length > 0
              ? technicians[0].id
              : null,
        assistingTechnicianIds: [],
        installationAddress: '456 Business Blvd, Floor 3, Los Angeles, CA 90001',
        gpsLatitude: 34.0522,
        gpsLongitude: -118.2437,
        status: 'in_progress',
        serialNumber: 'MX-M905-005678',
        modelNumber: 'MX-M905',
        networkConfigured: true,
        driversInstalled: false,
        userTrainingCompleted: false,
        installationNotes: 'Replacing older model with high-volume copier.',
        technicianNotes: 'Waiting for customer IT team to approve network settings.',
        customerName: customers[1] ? customers[1].name : customers[0].name,
        customerEmail: customers[1]
          ? customers[1].email || 'info@business.com'
          : 'info@business.com',
        customerPhone: customers[1] ? customers[1].phone || '555-0200' : '555-0200',
        createdBy: userId,
      },
      {
        tenantId,
        installationNumber: 'INST-2024-003',
        installationType: 'upgrade',
        customerId: customers[2] ? customers[2].id : customers[0].id,
        equipmentId: equipment.length > 2 ? equipment[2].id : null,
        scheduledDate: new Date('2024-01-25T10:00:00'),
        estimatedDuration: 120,
        assignedTechnicianId:
          technicians.length > 2
            ? technicians[2].id
            : technicians.length > 0
              ? technicians[0].id
              : null,
        assistingTechnicianIds: [],
        installationAddress: '789 Corporate Dr, Chicago, IL 60601',
        gpsLatitude: 41.8781,
        gpsLongitude: -87.6298,
        status: 'scheduled',
        modelNumber: 'MX-C407',
        networkConfigured: false,
        driversInstalled: false,
        userTrainingCompleted: false,
        installationNotes: 'Firmware upgrade and feature expansion.',
        customerName: customers[2] ? customers[2].name : customers[0].name,
        customerEmail: customers[2] ? customers[2].email || 'admin@corp.com' : 'admin@corp.com',
        customerPhone: customers[2] ? customers[2].phone || '555-0300' : '555-0300',
        createdBy: userId,
      },
    ];

    const createdInstallations = await db
      .insert(installations)
      .values(installationData)
      .returning();

    log.info(`✓ Created ${createdInstallations.length} installations`);

    // ============================================================================
    // SEED SERVICE SIGNATURES
    // ============================================================================

    log.info('Seeding service signatures...');

    const signatureData = [
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 0 ? serviceTickets[0].id : null,
        installationId: createdInstallations[0].id,
        signatureType: 'completion',
        signerName: 'John Smith',
        signerTitle: 'Office Manager',
        signerEmail: 'john.smith@example.com',
        signerPhone: '555-1001',
        signatureDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureMethod: 'touchscreen',
        gpsLatitude: 40.7128,
        gpsLongitude: -74.006,
        locationAddress: '123 Main St, Suite 100, New York, NY 10001',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceInfo: {
          platform: 'iOS',
          deviceType: 'tablet',
          screenSize: '2048x2732',
        },
        signedAt: new Date('2024-01-15T11:25:00'),
        capturedBy: userId,
        agreementText:
          'I confirm that the installation has been completed to my satisfaction and all equipment is functioning properly.',
        consentGiven: true,
        verified: true,
        verifiedBy: userId,
        verifiedAt: new Date('2024-01-15T11:26:00'),
      },
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 0 ? serviceTickets[0].id : null,
        installationId: createdInstallations[0].id,
        signatureType: 'service_agreement',
        signerName: 'John Smith',
        signerTitle: 'Office Manager',
        signerEmail: 'john.smith@example.com',
        signatureDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureMethod: 'stylus',
        gpsLatitude: 40.7128,
        gpsLongitude: -74.006,
        locationAddress: '123 Main St, Suite 100, New York, NY 10001',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceInfo: {
          platform: 'iOS',
          deviceType: 'tablet',
          screenSize: '2048x2732',
        },
        signedAt: new Date('2024-01-15T09:05:00'),
        capturedBy: userId,
        agreementText:
          'I authorize the installation work to proceed and accept responsibility for providing necessary access and resources.',
        consentGiven: true,
        verified: false,
      },
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 1 ? serviceTickets[1].id : null,
        installationId: createdInstallations[1].id,
        signatureType: 'work_authorization',
        signerName: 'Sarah Johnson',
        signerTitle: 'IT Director',
        signerEmail: 'sarah.j@business.com',
        signerPhone: '555-2002',
        signatureDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureMethod: 'finger',
        gpsLatitude: 34.0522,
        gpsLongitude: -118.2437,
        locationAddress: '456 Business Blvd, Floor 3, Los Angeles, CA 90001',
        ipAddress: '10.20.30.40',
        userAgent: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Mobile Safari/537.36',
        deviceInfo: {
          platform: 'Android',
          deviceType: 'tablet',
          screenSize: '2560x1600',
        },
        signedAt: new Date('2024-01-20T14:10:00'),
        capturedBy: userId,
        agreementText:
          'I authorize the replacement work and acknowledge that the old equipment will be removed.',
        consentGiven: true,
        verified: false,
      },
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 0 ? serviceTickets[0].id : null,
        signatureType: 'work_order_approval',
        signerName: 'Mike Davis',
        signerTitle: 'Facilities Manager',
        signerEmail: 'mdavis@company.com',
        signatureDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signatureMethod: 'touchscreen',
        gpsLatitude: 40.7589,
        gpsLongitude: -73.9851,
        locationAddress: '321 Office Park, New York, NY 10017',
        ipAddress: '172.16.0.50',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceInfo: {
          platform: 'iOS',
          deviceType: 'tablet',
          screenSize: '2048x2732',
        },
        signedAt: new Date('2024-01-18T15:30:00'),
        capturedBy: userId,
        agreementText: 'I approve the service work order and confirm authorization to proceed.',
        consentGiven: true,
        verified: true,
        verifiedBy: userId,
        verifiedAt: new Date('2024-01-18T15:31:00'),
      },
    ];

    const createdSignatures = await db.insert(serviceSignatures).values(signatureData).returning();

    log.info(`✓ Created ${createdSignatures.length} service signatures`);

    // ============================================================================
    // SEED INSTALLATION CHECKLISTS
    // ============================================================================

    log.info('Seeding installation checklists...');

    const checklistData = [
      // Checklists for Installation 1 (completed)
      {
        tenantId,
        installationId: createdInstallations[0].id,
        itemOrder: 1,
        category: 'pre_installation',
        itemName: 'Verify equipment model and serial number',
        itemDescription: 'Confirm that delivered equipment matches order specifications',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-15T09:10:00'),
        completedBy: userId,
        notes: 'Model MX-B455W confirmed, serial matches purchase order',
        requiresPhoto: true,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[0].id,
        itemOrder: 2,
        category: 'pre_installation',
        itemName: 'Check installation site clearance',
        itemDescription: 'Ensure adequate space and access for equipment',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-15T09:15:00'),
        completedBy: userId,
        notes: '3x3 meter space verified, electrical outlet within 2 meters',
        requiresPhoto: false,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[0].id,
        itemOrder: 3,
        category: 'installation',
        itemName: 'Physical equipment setup',
        itemDescription: 'Unpack, position, and level the equipment at installation site',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-15T09:45:00'),
        completedBy: userId,
        notes: 'Equipment positioned and leveled using built-in leveling feet',
        requiresPhoto: true,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[0].id,
        itemOrder: 4,
        category: 'installation',
        itemName: 'Network configuration',
        itemDescription: 'Configure IP address and network connectivity',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-15T10:15:00'),
        completedBy: userId,
        notes: 'Static IP 192.168.1.150 assigned, network test successful',
        expectedValue: 'Network connectivity test: PASS',
        actualValue: 'Network connectivity test: PASS',
        passed: true,
        requiresPhoto: false,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[0].id,
        itemOrder: 5,
        category: 'testing',
        itemName: 'Print test page',
        itemDescription: 'Verify print quality and functionality',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-15T10:30:00'),
        completedBy: userId,
        notes: 'Test page printed successfully, excellent quality',
        expectedValue: 'Print quality: Good',
        actualValue: 'Print quality: Excellent',
        passed: true,
        requiresPhoto: true,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[0].id,
        itemOrder: 6,
        category: 'testing',
        itemName: 'Scan functionality test',
        itemDescription: 'Test scan-to-email and scan-to-folder features',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-15T10:45:00'),
        completedBy: userId,
        notes: 'Scan-to-email configured and tested successfully',
        requiresPhoto: false,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[0].id,
        itemOrder: 7,
        category: 'training',
        itemName: 'Customer training - basic operations',
        itemDescription: 'Train customer on copy, print, and scan operations',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-15T11:15:00'),
        completedBy: userId,
        notes: 'Office manager and 2 staff members trained on basic operations',
        requiresPhoto: false,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[0].id,
        itemOrder: 8,
        category: 'completion',
        itemName: 'Customer acceptance signature',
        itemDescription: 'Obtain customer signature confirming installation',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-15T11:25:00'),
        completedBy: userId,
        notes: 'Signature obtained from John Smith, Office Manager',
        requiresPhoto: false,
        requiresSignature: true,
      },

      // Checklists for Installation 2 (in progress)
      {
        tenantId,
        installationId: createdInstallations[1].id,
        itemOrder: 1,
        category: 'pre_installation',
        itemName: 'Equipment removal - old copier',
        itemDescription: 'Disconnect and remove existing equipment',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-20T14:15:00'),
        completedBy: userId,
        notes: 'Old MX-M654 disconnected and staged for removal',
        requiresPhoto: true,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[1].id,
        itemOrder: 2,
        category: 'pre_installation',
        itemName: 'Site preparation',
        itemDescription: 'Clean area and prepare for new equipment',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-20T14:30:00'),
        completedBy: userId,
        notes: 'Area cleaned, electrical connections verified',
        requiresPhoto: false,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[1].id,
        itemOrder: 3,
        category: 'installation',
        itemName: 'Physical equipment setup',
        itemDescription: 'Position and level new equipment',
        isCompleted: true,
        isRequired: true,
        completedAt: new Date('2024-01-20T15:00:00'),
        completedBy: userId,
        notes: 'MX-M905 positioned and leveled',
        requiresPhoto: true,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[1].id,
        itemOrder: 4,
        category: 'installation',
        itemName: 'Network configuration',
        itemDescription: 'Configure network settings',
        isCompleted: false,
        isRequired: true,
        notes: 'Awaiting IT approval for network settings',
        requiresPhoto: false,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[1].id,
        itemOrder: 5,
        category: 'testing',
        itemName: 'Print test',
        itemDescription: 'Verify print functionality',
        isCompleted: false,
        isRequired: true,
        requiresPhoto: true,
        requiresSignature: false,
      },

      // Checklists for Installation 3 (scheduled - not started)
      {
        tenantId,
        installationId: createdInstallations[2].id,
        itemOrder: 1,
        category: 'pre_installation',
        itemName: 'Backup current settings',
        itemDescription: 'Document and backup existing equipment configuration',
        isCompleted: false,
        isRequired: true,
        requiresPhoto: false,
        requiresSignature: false,
      },
      {
        tenantId,
        installationId: createdInstallations[2].id,
        itemOrder: 2,
        category: 'installation',
        itemName: 'Firmware upgrade',
        itemDescription: 'Install latest firmware version',
        isCompleted: false,
        isRequired: true,
        requiresPhoto: false,
        requiresSignature: false,
      },
    ];

    const createdChecklists = await db
      .insert(installationChecklists)
      .values(checklistData)
      .returning();

    log.info(`✓ Created ${createdChecklists.length} installation checklist items`);

    // ============================================================================
    // SEED SERVICE PHOTOS
    // ============================================================================

    log.info('Seeding service photos...');

    const photoData = [
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 0 ? serviceTickets[0].id : 'unknown',
        fileName: 'inst-001-serial-photo.jpg',
        originalName: 'IMG_0234.jpg',
        mimeType: 'image/jpeg',
        fileSize: 2048576,
        objectPath: 'public/service-photos/inst-001-serial-photo.jpg',
        latitude: '40.7128000',
        longitude: '-74.0060000',
        address: '123 Main St, Suite 100, New York, NY 10001',
        category: 'completed',
        description: 'Equipment serial number verification - MX-B455W-001234',
      },
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 0 ? serviceTickets[0].id : 'unknown',
        fileName: 'inst-001-setup-complete.jpg',
        originalName: 'IMG_0247.jpg',
        mimeType: 'image/jpeg',
        fileSize: 3145728,
        objectPath: 'public/service-photos/inst-001-setup-complete.jpg',
        latitude: '40.7128000',
        longitude: '-74.0060000',
        address: '123 Main St, Suite 100, New York, NY 10001',
        category: 'completed',
        description: 'Installation completed - equipment positioned and leveled',
      },
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 0 ? serviceTickets[0].id : 'unknown',
        fileName: 'inst-001-test-page.jpg',
        originalName: 'IMG_0251.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1572864,
        objectPath: 'public/service-photos/inst-001-test-page.jpg',
        latitude: '40.7128000',
        longitude: '-74.0060000',
        address: '123 Main St, Suite 100, New York, NY 10001',
        category: 'completed',
        description: 'Print quality test page - excellent results',
      },
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 1 ? serviceTickets[1].id : 'unknown',
        fileName: 'inst-002-old-equipment.jpg',
        originalName: 'IMG_1453.jpg',
        mimeType: 'image/jpeg',
        fileSize: 2621440,
        objectPath: 'public/service-photos/inst-002-old-equipment.jpg',
        latitude: '34.0522000',
        longitude: '-118.2437000',
        address: '456 Business Blvd, Floor 3, Los Angeles, CA 90001',
        category: 'before',
        description: 'Old equipment before removal - MX-M654',
      },
      {
        tenantId,
        serviceTicketId: serviceTickets.length > 1 ? serviceTickets[1].id : 'unknown',
        fileName: 'inst-002-new-equipment.jpg',
        originalName: 'IMG_1472.jpg',
        mimeType: 'image/jpeg',
        fileSize: 2883584,
        objectPath: 'public/service-photos/inst-002-new-equipment.jpg',
        latitude: '34.0522000',
        longitude: '-118.2437000',
        address: '456 Business Blvd, Floor 3, Los Angeles, CA 90001',
        category: 'during',
        description: 'New equipment positioned - MX-M905',
      },
    ];

    const createdPhotos = await db.insert(servicePhotos).values(photoData).returning();

    log.info(`✓ Created ${createdPhotos.length} service photos`);

    // ============================================================================
    // SUMMARY
    // ============================================================================

    log.info('\n=== Field Service Data Seeding Complete ===');
    log.info(`Installations: ${createdInstallations.length}`);
    log.info(`Service Signatures: ${createdSignatures.length}`);
    log.info(`Installation Checklist Items: ${createdChecklists.length}`);
    log.info(`Service Photos: ${createdPhotos.length}`);
    log.info('===========================================\n');
  } catch (error) {
    log.error('Error seeding field service data:', error);
    throw error;
  }
}

seedFieldServiceData()
  .then(() => {
    log.info('Field service data seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    log.error('Failed to seed field service data:', error);
    process.exit(1);
  });
