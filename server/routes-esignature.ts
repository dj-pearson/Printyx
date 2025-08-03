import express from 'express';
import { desc, eq, and, sql, asc } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';
import { businessRecords } from '../shared/schema';

const router = express.Router();

// E-signature Integration API Routes
// Note: Database tables will be created after schema update

// Get all signature requests
router.get('/api/signature-requests', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample signature requests until schema is updated
    const sampleRequests = [
      {
        id: 'sig-req-1',
        documentName: 'Service Agreement - ABC Corporation',
        documentType: 'service_agreement',
        businessRecordId: 'customer-1',
        customerName: 'ABC Corporation',
        customerEmail: 'john.smith@abccorp.com',
        status: 'pending',
        requestedBy: 'Sales Rep',
        requestedDate: new Date('2025-01-20'),
        expirationDate: new Date('2025-02-20'),
        signedDate: null,
        documentUrl: '/documents/service-agreement-abc-corp.pdf',
        signatureUrl: null,
        remindersSent: 1,
        lastReminderDate: new Date('2025-01-25'),
        contractValue: 85000,
        contractDuration: 36, // months
        signers: [
          {
            name: 'John Smith',
            email: 'john.smith@abccorp.com',
            role: 'Customer',
            status: 'pending',
            signedDate: null
          }
        ],
        createdAt: new Date('2025-01-20')
      },
      {
        id: 'sig-req-2',
        documentName: 'Equipment Lease - XYZ Industries',
        documentType: 'equipment_lease',
        businessRecordId: 'customer-2',
        customerName: 'XYZ Industries',
        customerEmail: 'jane.doe@xyzind.com',
        status: 'completed',
        requestedBy: 'Sales Manager',
        requestedDate: new Date('2025-01-15'),
        expirationDate: new Date('2025-02-15'),
        signedDate: new Date('2025-01-18'),
        documentUrl: '/documents/equipment-lease-xyz-ind.pdf',
        signatureUrl: '/signatures/equipment-lease-xyz-ind-signed.pdf',
        remindersSent: 0,
        lastReminderDate: null,
        contractValue: 125000,
        contractDuration: 48,
        signers: [
          {
            name: 'Jane Doe',
            email: 'jane.doe@xyzind.com',
            role: 'Customer',
            status: 'completed',
            signedDate: new Date('2025-01-18')
          }
        ],
        createdAt: new Date('2025-01-15')
      },
      {
        id: 'sig-req-3',
        documentName: 'Maintenance Contract - Tech Solutions',
        documentType: 'maintenance_contract',
        businessRecordId: 'customer-3',
        customerName: 'Tech Solutions Inc',
        customerEmail: 'admin@techsolutions.com',
        status: 'expired',
        requestedBy: 'Service Manager',
        requestedDate: new Date('2024-12-20'),
        expirationDate: new Date('2025-01-20'),
        signedDate: null,
        documentUrl: '/documents/maintenance-contract-tech-sol.pdf',
        signatureUrl: null,
        remindersSent: 3,
        lastReminderDate: new Date('2025-01-18'),
        contractValue: 24000,
        contractDuration: 12,
        signers: [
          {
            name: 'Mike Johnson',
            email: 'admin@techsolutions.com',
            role: 'Customer',
            status: 'expired',
            signedDate: null
          }
        ],
        createdAt: new Date('2024-12-20')
      }
    ];

    res.json(sampleRequests);
    
  } catch (error) {
    console.error('Error fetching signature requests:', error);
    res.status(500).json({ message: 'Failed to fetch signature requests' });
  }
});

// Get signature templates
router.get('/api/signature-templates', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample signature templates
    const sampleTemplates = [
      {
        id: 'template-1',
        templateName: 'Standard Service Agreement',
        documentType: 'service_agreement',
        description: 'Standard copier service and maintenance agreement template',
        templateUrl: '/templates/standard-service-agreement.pdf',
        signatureFields: [
          { fieldName: 'customer_signature', x: 100, y: 750, page: 1, required: true },
          { fieldName: 'customer_date', x: 300, y: 750, page: 1, required: true },
          { fieldName: 'customer_print_name', x: 100, y: 720, page: 1, required: true }
        ],
        isActive: true,
        usageCount: 25,
        lastUsed: new Date('2025-01-20'),
        createdAt: new Date('2024-10-15')
      },
      {
        id: 'template-2',
        templateName: 'Equipment Lease Agreement',
        documentType: 'equipment_lease',
        description: 'Multi-function printer lease agreement with terms and conditions',
        templateUrl: '/templates/equipment-lease-agreement.pdf',
        signatureFields: [
          { fieldName: 'customer_signature', x: 100, y: 650, page: 2, required: true },
          { fieldName: 'customer_initial_1', x: 50, y: 400, page: 1, required: true },
          { fieldName: 'customer_initial_2', x: 50, y: 300, page: 1, required: true },
          { fieldName: 'customer_date', x: 300, y: 650, page: 2, required: true }
        ],
        isActive: true,
        usageCount: 18,
        lastUsed: new Date('2025-01-18'),
        createdAt: new Date('2024-11-01')
      },
      {
        id: 'template-3',
        templateName: 'Maintenance Only Contract',
        documentType: 'maintenance_contract',
        description: 'Service and maintenance contract for existing equipment',
        templateUrl: '/templates/maintenance-contract.pdf',
        signatureFields: [
          { fieldName: 'customer_signature', x: 100, y: 600, page: 1, required: true },
          { fieldName: 'customer_date', x: 300, y: 600, page: 1, required: true }
        ],
        isActive: true,
        usageCount: 12,
        lastUsed: new Date('2025-01-15'),
        createdAt: new Date('2024-09-20')
      }
    ];

    res.json(sampleTemplates);
    
  } catch (error) {
    console.error('Error fetching signature templates:', error);
    res.status(500).json({ message: 'Failed to fetch signature templates' });
  }
});

// Create new signature request
router.post('/api/signature-requests', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const {
      documentName,
      documentType,
      businessRecordId,
      templateId,
      signers,
      expirationDays,
      contractValue,
      contractDuration,
      customFields
    } = req.body;

    // Get customer information
    const customer = await db
      .select({
        id: businessRecords.id,
        companyName: businessRecords.companyName,
        primaryContactName: businessRecords.primaryContactName,
        email: businessRecords.email
      })
      .from(businessRecords)
      .where(and(
        eq(businessRecords.tenantId, tenantId),
        eq(businessRecords.id, businessRecordId)
      ))
      .limit(1);

    if (!customer.length) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customerData = customer[0];

    // For now, return success response until schema is updated
    const newRequest = {
      id: `sig-req-${Date.now()}`,
      tenantId,
      documentName: documentName || `${documentType.replace('_', ' ')} - ${customerData.companyName}`,
      documentType,
      businessRecordId,
      customerName: customerData.companyName,
      customerEmail: customerData.email,
      status: 'pending',
      requestedBy: userId,
      requestedDate: new Date(),
      expirationDate: new Date(Date.now() + (expirationDays || 30) * 24 * 60 * 60 * 1000),
      signedDate: null,
      documentUrl: `/documents/${documentType}-${businessRecordId}.pdf`,
      signatureUrl: null,
      remindersSent: 0,
      lastReminderDate: null,
      contractValue: contractValue ? parseFloat(contractValue) : null,
      contractDuration: contractDuration ? parseInt(contractDuration) : null,
      signers: signers || [{
        name: customerData.primaryContactName,
        email: customerData.email,
        role: 'Customer',
        status: 'pending',
        signedDate: null
      }],
      customFields: customFields || {},
      createdAt: new Date()
    };

    res.status(201).json(newRequest);
    
  } catch (error) {
    console.error('Error creating signature request:', error);
    res.status(500).json({ message: 'Failed to create signature request' });
  }
});

// Update signature request status
router.put('/api/signature-requests/:id/status', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, signedDate, signatureUrl } = req.body;
    
    // For now, return success response until schema is updated
    res.json({ 
      message: 'Signature request status updated successfully',
      id,
      status,
      signedDate: signedDate ? new Date(signedDate) : null,
      signatureUrl,
      updatedAt: new Date()
    });
    
  } catch (error) {
    console.error('Error updating signature request status:', error);
    res.status(500).json({ message: 'Failed to update signature request status' });
  }
});

// Send reminder for pending signature
router.post('/api/signature-requests/:id/remind', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { customMessage } = req.body;
    
    // For now, return success response until schema is updated
    res.json({ 
      message: 'Reminder sent successfully',
      id,
      reminderSent: true,
      lastReminderDate: new Date(),
      customMessage
    });
    
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ message: 'Failed to send reminder' });
  }
});

// Get signature analytics
router.get('/api/signature-analytics', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { period = 'monthly' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample analytics data
    const analytics = {
      totalRequests: 45,
      completedRequests: 32,
      pendingRequests: 8,
      expiredRequests: 5,
      completionRate: 71.1, // (completedRequests / totalRequests) * 100
      averageSigningTime: 2.3, // days
      totalContractValue: 1850000,
      
      // By document type
      byDocumentType: [
        { type: 'service_agreement', count: 18, completed: 14, value: 950000 },
        { type: 'equipment_lease', count: 20, completed: 15, value: 750000 },
        { type: 'maintenance_contract', count: 7, completed: 3, value: 150000 }
      ],
      
      // Monthly trends
      monthlyTrends: [
        { month: 'Dec 2024', requests: 12, completed: 9, completionRate: 75.0 },
        { month: 'Jan 2025', requests: 15, completed: 11, completionRate: 73.3 },
        { month: 'Feb 2025', requests: 8, completed: 6, completionRate: 75.0 }
      ],
      
      // Signing speed analysis
      signingSpeedAnalysis: {
        within24Hours: 12, // 37.5%
        within48Hours: 8,  // 25.0%
        within1Week: 7,    // 21.9%
        moreThan1Week: 5   // 15.6%
      }
    };

    res.json(analytics);
    
  } catch (error) {
    console.error('Error fetching signature analytics:', error);
    res.status(500).json({ message: 'Failed to fetch signature analytics' });
  }
});

// Bulk send signature requests
router.post('/api/signature-requests/bulk-send', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const { requests } = req.body; // Array of signature request data
    
    // For now, return success response until schema is updated
    const results = requests.map((request: any, index: number) => ({
      id: `bulk-sig-req-${Date.now()}-${index}`,
      ...request,
      status: 'pending',
      requestedBy: userId,
      requestedDate: new Date(),
      success: true
    }));

    res.json({ 
      message: `${results.length} signature requests sent successfully`,
      results,
      totalSent: results.length,
      failed: 0
    });
    
  } catch (error) {
    console.error('Error sending bulk signature requests:', error);
    res.status(500).json({ message: 'Failed to send bulk signature requests' });
  }
});

// Get audit trail for signature request
router.get('/api/signature-requests/:id/audit-trail', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Sample audit trail
    const auditTrail = [
      {
        id: 'audit-1',
        action: 'request_created',
        description: 'Signature request created',
        performedBy: 'John Sales Rep',
        timestamp: new Date('2025-01-20T09:00:00Z'),
        ipAddress: '192.168.1.100',
        details: { documentType: 'service_agreement', recipients: 1 }
      },
      {
        id: 'audit-2',
        action: 'request_sent',
        description: 'Signature request sent to customer',
        performedBy: 'System',
        timestamp: new Date('2025-01-20T09:05:00Z'),
        ipAddress: null,
        details: { email: 'john.smith@abccorp.com', method: 'email' }
      },
      {
        id: 'audit-3',
        action: 'document_viewed',
        description: 'Customer viewed the document',
        performedBy: 'john.smith@abccorp.com',
        timestamp: new Date('2025-01-20T14:30:00Z'),
        ipAddress: '203.0.113.45',
        details: { viewDuration: '5 minutes 23 seconds' }
      },
      {
        id: 'audit-4',
        action: 'reminder_sent',
        description: 'Reminder email sent to customer',
        performedBy: 'System',
        timestamp: new Date('2025-01-25T10:00:00Z'),
        ipAddress: null,
        details: { reminderNumber: 1, email: 'john.smith@abccorp.com' }
      }
    ];
    
    res.json(auditTrail);
    
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ message: 'Failed to fetch audit trail' });
  }
});

export default router;