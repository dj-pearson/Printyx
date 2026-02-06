import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('seed-signature-data');

import {
  integrationCredentials,
  signatureRequests,
  signatureSigners,
  signatureDocuments,
  signatureAuditLogs,
} from '@shared/schema';

async function seedSignatureData() {
  log.info('Starting e-signature data seeding...');

  try {
    // Get the first tenant for testing
    const tenants = await db.query.tenants.findMany({ limit: 1 });
    if (tenants.length === 0) {
      log.error('No tenants found. Please seed tenants first.');
      return;
    }
    const tenantId = tenants[0].id;
    log.info(`Using tenant: ${tenantId}`);

    // Get some customers for testing
    const customers = await db.query.businessRecords.findMany({
      where: (records, { eq }) => eq(records.tenantId, tenantId),
      limit: 3,
    });

    if (customers.length === 0) {
      log.error('No customers found. Please seed business records first.');
      return;
    }

    // ============================================================================
    // 1. CREATE INTEGRATION CREDENTIALS
    // ============================================================================
    log.info('\n1. Creating integration credentials...');

    const docusignCred = await db
      .insert(integrationCredentials)
      .values({
        tenantId,
        provider: 'docusign',
        integrationName: 'DocuSign Production',
        status: 'active',
        apiKey: 'demo_api_key_12345',
        accountId: 'acc_67890',
        sandboxMode: false,
        config: {
          baseUrl: 'https://www.docusign.net/restapi',
          apiVersion: 'v2.1',
        },
        healthStatus: 'healthy',
        lastHealthCheck: new Date(),
      })
      .returning();

    const adobeSignCred = await db
      .insert(integrationCredentials)
      .values({
        tenantId,
        provider: 'adobe_sign',
        integrationName: 'Adobe Sign Development',
        status: 'active',
        apiKey: 'demo_adobe_key_54321',
        accessToken: 'demo_access_token',
        refreshToken: 'demo_refresh_token',
        tokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        sandboxMode: true,
        config: {
          baseUrl: 'https://api.na1.adobesign.com/api/rest/v6',
        },
        healthStatus: 'healthy',
        lastHealthCheck: new Date(),
      })
      .returning();

    const hellosignCred = await db
      .insert(integrationCredentials)
      .values({
        tenantId,
        provider: 'hellosign',
        integrationName: 'HelloSign Testing',
        status: 'inactive',
        apiKey: 'demo_hellosign_key',
        sandboxMode: true,
        config: {
          baseUrl: 'https://api.hellosign.com/v3',
        },
        healthStatus: 'unknown',
      })
      .returning();

    log.info(
      `  ✓ Created ${docusignCred.length + adobeSignCred.length + hellosignCred.length} integration credentials`,
    );

    // ============================================================================
    // 2. CREATE SIGNATURE REQUESTS
    // ============================================================================
    log.info('\n2. Creating signature requests...');

    // Request 1: Active - Awaiting signatures
    const request1 = await db
      .insert(signatureRequests)
      .values({
        tenantId,
        requestNumber: 'SIG-2025-001',
        title: 'Lease Agreement - Canon MFP',
        description: '3-year equipment lease agreement for Canon imageRUNNER ADVANCE DX C5870i',
        customerId: customers[0].id,
        leaseId: null, // Will be linked once created
        provider: 'docusign',
        integrationId: docusignCred[0].id,
        externalId: 'env_docusign_abc123',
        status: 'sent',
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        expiresAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000), // 27 days from now
        emailSubject: 'Please sign your equipment lease agreement',
        emailMessage:
          'Thank you for choosing our copier services. Please review and sign your lease agreement.',
        reminderEnabled: true,
        reminderDays: 3,
        sequentialSigning: false,
        totalSigners: 2,
        signersCompleted: 1,
        totalDocuments: 2,
      })
      .returning();

    // Request 2: Completed
    const request2 = await db
      .insert(signatureRequests)
      .values({
        tenantId,
        requestNumber: 'SIG-2025-002',
        title: 'Service Contract - Annual Maintenance',
        description: 'Annual maintenance and service contract',
        customerId: customers[1].id,
        contractId: null,
        provider: 'docusign',
        integrationId: docusignCred[0].id,
        externalId: 'env_docusign_xyz789',
        status: 'completed',
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        expiresAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
        emailSubject: 'Service Contract - Your Signature Required',
        emailMessage: 'Please review and sign your annual service contract.',
        reminderEnabled: true,
        reminderDays: 3,
        sequentialSigning: false,
        totalSigners: 1,
        signersCompleted: 1,
        totalDocuments: 1,
      })
      .returning();

    // Request 3: Draft - Not yet sent
    const request3 = await db
      .insert(signatureRequests)
      .values({
        tenantId,
        requestNumber: 'SIG-2025-003',
        title: 'Equipment Purchase Agreement',
        description: 'Purchase agreement for Ricoh IM C6000',
        customerId: customers[2].id,
        provider: 'adobe_sign',
        integrationId: adobeSignCred[0].id,
        status: 'draft',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        emailSubject: 'Purchase Agreement - Signature Needed',
        emailMessage: 'Please review and sign the equipment purchase agreement.',
        reminderEnabled: true,
        reminderDays: 5,
        sequentialSigning: true,
        totalSigners: 3,
        signersCompleted: 0,
        totalDocuments: 1,
      })
      .returning();

    // Request 4: Expiring soon
    const request4 = await db
      .insert(signatureRequests)
      .values({
        tenantId,
        requestNumber: 'SIG-2025-004',
        title: 'Service Level Agreement - Premium Support',
        description: 'SLA for 24/7 premium support services',
        customerId: customers[0].id,
        provider: 'docusign',
        integrationId: docusignCred[0].id,
        externalId: 'env_docusign_def456',
        status: 'sent',
        sentAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Expires in 5 days
        emailSubject: 'Service Level Agreement - Urgent Signature Required',
        emailMessage: 'This document will expire soon. Please sign at your earliest convenience.',
        reminderEnabled: true,
        reminderDays: 2,
        sequentialSigning: false,
        totalSigners: 2,
        signersCompleted: 0,
        totalDocuments: 1,
      })
      .returning();

    // Request 5: Declined
    const request5 = await db
      .insert(signatureRequests)
      .values({
        tenantId,
        requestNumber: 'SIG-2025-005',
        title: 'Equipment Upgrade Proposal',
        description: 'Proposal to upgrade existing equipment',
        customerId: customers[1].id,
        provider: 'docusign',
        integrationId: docusignCred[0].id,
        externalId: 'env_docusign_ghi789',
        status: 'declined',
        sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        emailSubject: 'Equipment Upgrade Proposal',
        emailMessage: 'Please review our proposed equipment upgrade plan.',
        reminderEnabled: true,
        reminderDays: 3,
        sequentialSigning: false,
        totalSigners: 1,
        signersCompleted: 0,
        totalDocuments: 1,
        declinedReason: 'Customer decided to extend current lease instead of upgrading',
      })
      .returning();

    log.info(`  ✓ Created 5 signature requests`);

    // ============================================================================
    // 3. CREATE SIGNATURE SIGNERS
    // ============================================================================
    log.info('\n3. Creating signature signers...');

    const signers = [];

    // Signers for Request 1 (2 signers, 1 completed)
    signers.push(
      ...(await db
        .insert(signatureSigners)
        .values([
          {
            tenantId,
            requestId: request1[0].id,
            signerOrder: 1,
            signerType: 'signer',
            name: 'John Smith',
            email: 'john.smith@acmecorp.com',
            status: 'signed',
            sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            viewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            signatureMethod: 'drawn',
            ipAddress: '192.168.1.100',
          },
          {
            tenantId,
            requestId: request1[0].id,
            signerOrder: 2,
            signerType: 'signer',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@acmecorp.com',
            status: 'viewed',
            sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            viewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            ipAddress: '192.168.1.101',
          },
        ])
        .returning()),
    );

    // Signers for Request 2 (1 signer, completed)
    signers.push(
      ...(await db
        .insert(signatureSigners)
        .values([
          {
            tenantId,
            requestId: request2[0].id,
            signerOrder: 1,
            signerType: 'signer',
            name: 'Michael Brown',
            email: 'mbrown@techstart.io',
            status: 'signed',
            sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            viewedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
            signedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            signatureMethod: 'typed',
            ipAddress: '10.0.1.50',
          },
        ])
        .returning()),
    );

    // Signers for Request 3 (3 signers, draft so not sent yet)
    signers.push(
      ...(await db
        .insert(signatureSigners)
        .values([
          {
            tenantId,
            requestId: request3[0].id,
            signerOrder: 1,
            signerType: 'signer',
            name: 'David Lee',
            email: 'dlee@globalprint.com',
            status: 'pending',
          },
          {
            tenantId,
            requestId: request3[0].id,
            signerOrder: 2,
            signerType: 'approver',
            name: 'Jennifer Martinez',
            email: 'jmartinez@globalprint.com',
            status: 'pending',
          },
          {
            tenantId,
            requestId: request3[0].id,
            signerOrder: 3,
            signerType: 'signer',
            name: 'Robert Chen',
            email: 'rchen@globalprint.com',
            status: 'pending',
          },
        ])
        .returning()),
    );

    // Signers for Request 4 (2 signers, sent but not viewed yet)
    signers.push(
      ...(await db
        .insert(signatureSigners)
        .values([
          {
            tenantId,
            requestId: request4[0].id,
            signerOrder: 1,
            signerType: 'signer',
            name: 'Lisa Anderson',
            email: 'landerson@premiumco.biz',
            status: 'sent',
            sentAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request4[0].id,
            signerOrder: 2,
            signerType: 'signer',
            name: 'Thomas Wilson',
            email: 'twilson@premiumco.biz',
            status: 'sent',
            sentAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          },
        ])
        .returning()),
    );

    // Signers for Request 5 (1 signer, declined)
    signers.push(
      ...(await db
        .insert(signatureSigners)
        .values([
          {
            tenantId,
            requestId: request5[0].id,
            signerOrder: 1,
            signerType: 'signer',
            name: 'Patricia Davis',
            email: 'pdavis@techstart.io',
            status: 'declined',
            sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            viewedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
            declinedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
            declineReason: 'Prefer to extend current lease instead',
            ipAddress: '10.0.1.51',
          },
        ])
        .returning()),
    );

    log.info(`  ✓ Created ${signers.length} signature signers`);

    // ============================================================================
    // 4. CREATE SIGNATURE DOCUMENTS
    // ============================================================================
    log.info('\n4. Creating signature documents...');

    const documents = [];

    // Documents for Request 1 (2 documents)
    documents.push(
      ...(await db
        .insert(signatureDocuments)
        .values([
          {
            tenantId,
            requestId: request1[0].id,
            documentOrder: 1,
            documentName: 'Lease Agreement - Canon MFP.pdf',
            documentType: 'pdf',
            originalFileUrl: 'https://storage.example.com/docs/lease-canon-original.pdf',
            fileSize: 245678,
            status: 'pending',
            totalFields: 6,
            completedFields: 3,
          },
          {
            tenantId,
            requestId: request1[0].id,
            documentOrder: 2,
            documentName: 'Service Terms and Conditions.pdf',
            documentType: 'pdf',
            originalFileUrl: 'https://storage.example.com/docs/service-terms-original.pdf',
            fileSize: 128934,
            status: 'pending',
            totalFields: 2,
            completedFields: 1,
          },
        ])
        .returning()),
    );

    // Documents for Request 2 (1 document, completed)
    documents.push(
      ...(await db
        .insert(signatureDocuments)
        .values([
          {
            tenantId,
            requestId: request2[0].id,
            documentOrder: 1,
            documentName: 'Annual Maintenance Contract.pdf',
            documentType: 'pdf',
            originalFileUrl: 'https://storage.example.com/docs/maintenance-contract-original.pdf',
            signedFileUrl: 'https://storage.example.com/docs/maintenance-contract-signed.pdf',
            certificateUrl: 'https://storage.example.com/docs/maintenance-contract-certificate.pdf',
            fileSize: 189234,
            status: 'completed',
            totalFields: 4,
            completedFields: 4,
          },
        ])
        .returning()),
    );

    // Documents for Request 3 (1 document, draft)
    documents.push(
      ...(await db
        .insert(signatureDocuments)
        .values([
          {
            tenantId,
            requestId: request3[0].id,
            documentOrder: 1,
            documentName: 'Equipment Purchase Agreement - Ricoh.pdf',
            documentType: 'pdf',
            originalFileUrl: 'https://storage.example.com/docs/purchase-ricoh-original.pdf',
            fileSize: 312456,
            status: 'pending',
            totalFields: 8,
            completedFields: 0,
          },
        ])
        .returning()),
    );

    // Documents for Request 4 (1 document)
    documents.push(
      ...(await db
        .insert(signatureDocuments)
        .values([
          {
            tenantId,
            requestId: request4[0].id,
            documentOrder: 1,
            documentName: 'Premium Support SLA.pdf',
            documentType: 'pdf',
            originalFileUrl: 'https://storage.example.com/docs/premium-sla-original.pdf',
            fileSize: 156789,
            status: 'pending',
            totalFields: 5,
            completedFields: 0,
          },
        ])
        .returning()),
    );

    // Documents for Request 5 (1 document, declined)
    documents.push(
      ...(await db
        .insert(signatureDocuments)
        .values([
          {
            tenantId,
            requestId: request5[0].id,
            documentOrder: 1,
            documentName: 'Equipment Upgrade Proposal.pdf',
            documentType: 'pdf',
            originalFileUrl: 'https://storage.example.com/docs/upgrade-proposal-original.pdf',
            fileSize: 278901,
            status: 'pending',
            totalFields: 3,
            completedFields: 0,
          },
        ])
        .returning()),
    );

    log.info(`  ✓ Created ${documents.length} signature documents`);

    // ============================================================================
    // 5. CREATE SIGNATURE AUDIT LOGS
    // ============================================================================
    log.info('\n5. Creating signature audit logs...');

    const auditLogs = [];

    // Audit logs for Request 1
    auditLogs.push(
      ...(await db
        .insert(signatureAuditLogs)
        .values([
          {
            tenantId,
            requestId: request1[0].id,
            eventType: 'request_created',
            eventDescription: 'Signature request created',
            actorType: 'user',
            actorName: 'Admin User',
            actorEmail: 'admin@printyx.com',
            ipAddress: '192.168.1.1',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request1[0].id,
            eventType: 'sent',
            eventDescription: 'Signature request sent to signers',
            actorType: 'user',
            actorName: 'Admin User',
            actorEmail: 'admin@printyx.com',
            ipAddress: '192.168.1.1',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request1[0].id,
            signerId: signers[0].id,
            eventType: 'viewed',
            eventDescription: 'Document viewed by John Smith',
            actorType: 'signer',
            actorName: 'John Smith',
            actorEmail: 'john.smith@acmecorp.com',
            ipAddress: '192.168.1.100',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request1[0].id,
            signerId: signers[0].id,
            eventType: 'signed',
            eventDescription: 'Document signed by John Smith',
            actorType: 'signer',
            actorName: 'John Smith',
            actorEmail: 'john.smith@acmecorp.com',
            ipAddress: '192.168.1.100',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request1[0].id,
            signerId: signers[1].id,
            eventType: 'viewed',
            eventDescription: 'Document viewed by Sarah Johnson',
            actorType: 'signer',
            actorName: 'Sarah Johnson',
            actorEmail: 'sarah.johnson@acmecorp.com',
            ipAddress: '192.168.1.101',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request1[0].id,
            eventType: 'reminder_sent',
            eventDescription: 'Reminder sent to Sarah Johnson',
            actorType: 'system',
            actorName: 'System',
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          },
        ])
        .returning()),
    );

    // Audit logs for Request 2 (Completed)
    auditLogs.push(
      ...(await db
        .insert(signatureAuditLogs)
        .values([
          {
            tenantId,
            requestId: request2[0].id,
            eventType: 'request_created',
            eventDescription: 'Signature request created',
            actorType: 'user',
            actorName: 'Admin User',
            actorEmail: 'admin@printyx.com',
            ipAddress: '192.168.1.1',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request2[0].id,
            eventType: 'sent',
            eventDescription: 'Signature request sent to signers',
            actorType: 'user',
            actorName: 'Admin User',
            actorEmail: 'admin@printyx.com',
            ipAddress: '192.168.1.1',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request2[0].id,
            signerId: signers[2].id,
            eventType: 'viewed',
            eventDescription: 'Document viewed by Michael Brown',
            actorType: 'signer',
            actorName: 'Michael Brown',
            actorEmail: 'mbrown@techstart.io',
            ipAddress: '10.0.1.50',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request2[0].id,
            signerId: signers[2].id,
            eventType: 'signed',
            eventDescription: 'Document signed by Michael Brown',
            actorType: 'signer',
            actorName: 'Michael Brown',
            actorEmail: 'mbrown@techstart.io',
            ipAddress: '10.0.1.50',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request2[0].id,
            eventType: 'completed',
            eventDescription: 'All signers have completed signing',
            actorType: 'system',
            actorName: 'System',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
        ])
        .returning()),
    );

    // Audit logs for Request 5 (Declined)
    auditLogs.push(
      ...(await db
        .insert(signatureAuditLogs)
        .values([
          {
            tenantId,
            requestId: request5[0].id,
            eventType: 'request_created',
            eventDescription: 'Signature request created',
            actorType: 'user',
            actorName: 'Admin User',
            actorEmail: 'admin@printyx.com',
            ipAddress: '192.168.1.1',
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request5[0].id,
            eventType: 'sent',
            eventDescription: 'Signature request sent to signers',
            actorType: 'user',
            actorName: 'Admin User',
            actorEmail: 'admin@printyx.com',
            ipAddress: '192.168.1.1',
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request5[0].id,
            signerId: signers[signers.length - 1].id,
            eventType: 'viewed',
            eventDescription: 'Document viewed by Patricia Davis',
            actorType: 'signer',
            actorName: 'Patricia Davis',
            actorEmail: 'pdavis@techstart.io',
            ipAddress: '10.0.1.51',
            createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
          },
          {
            tenantId,
            requestId: request5[0].id,
            signerId: signers[signers.length - 1].id,
            eventType: 'declined',
            eventDescription: 'Document declined by Patricia Davis',
            actorType: 'signer',
            actorName: 'Patricia Davis',
            actorEmail: 'pdavis@techstart.io',
            ipAddress: '10.0.1.51',
            createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
          },
        ])
        .returning()),
    );

    log.info(`  ✓ Created ${auditLogs.length} audit log entries`);

    // ============================================================================
    // SUMMARY
    // ============================================================================
    log.info('\n✅ E-Signature data seeding completed successfully!');
    log.info('\nSummary:');
    log.info(`  - Integration Credentials: 3 (DocuSign, Adobe Sign, HelloSign)`);
    log.info(`  - Signature Requests: 5 (draft, sent, completed, declined, expiring soon)`);
    log.info(`  - Signature Signers: ${signers.length}`);
    log.info(`  - Signature Documents: ${documents.length}`);
    log.info(`  - Audit Log Entries: ${auditLogs.length}`);
    log.info('\n🎉 Ready for testing!');
  } catch (error) {
    log.error('Error seeding e-signature data:', error);
    throw error;
  }
}

export { seedSignatureData };

// Run the seed function if executed directly
seedSignatureData()
  .then(() => {
    log.info('\nSeeding complete. Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    log.error('\nSeeding failed:', error);
    process.exit(1);
  });
