import type { Express } from 'express';
import { storage } from './storage';
import { isAuthenticated } from './replitAuth';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { BusinessRecordsTransformer } from './data-field-mapping';
import {
  generateCompanyDisplayId,
  generateUniqueUrlSlug,
  updateBusinessRecordWithIdentifiers,
} from './utils/company-id-generator';
import { cacheControl, etag, varyByTenant } from './middleware/cache-middleware';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  hasPermission,
  getQueryBuilder,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';
// Lead Intelligence - Auto-scoring and enrichment
import { leadIntelligenceService } from './services/lead-intelligence-service';

export function registerBusinessRecordRoutes(app: Express) {
  // Apply authentication and RBAC context to all business records routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/business-records', isAuthenticated, enhanceUserContext);

  // Unified Business Records API - supports entire lead-to-customer lifecycle

  // Get all business records with filtering - requires lead/customer view permission
  app.get(
    '/api/business-records',
    resolveTenant,
    requireTenant,
    requirePermission([
      PERMISSIONS.SALES.LEAD.VIEW_OWN,
      PERMISSIONS.SALES.LEAD.VIEW_TEAM,
      PERMISSIONS.SALES.LEAD.VIEW_LOCATION,
      PERMISSIONS.SALES.CUSTOMER.VIEW_OWN,
      PERMISSIONS.SALES.CUSTOMER.VIEW_TEAM,
    ]),
    varyByTenant(),
    cacheControl(180), // Cache for 3 minutes
    etag(),
    async (req: AuthenticatedRequest & TenantRequest, res) => {
      try {
        const tenantId = req.tenantId!;
        const { recordType, status, search, limit } = req.query;

        const records = await storage.getBusinessRecords(
          tenantId,
          recordType as string,
          status as string,
          search as string,
          limit ? parseInt(limit as string) : undefined,
        );
        // Transform database fields to frontend format
        const transformedRecords = records.map((record) =>
          BusinessRecordsTransformer.toFrontend(record),
        );
        res.json(transformedRecords);
      } catch (error) {
        console.error('Error fetching business records:', error);
        res.status(500).json({ message: 'Failed to fetch business records' });
      }
    },
  );

  // Get specific business record by ID or URL slug
  app.get(
    '/api/business-records/:identifier',
    resolveTenant,
    requireTenant,
    varyByTenant(),
    cacheControl(300), // Cache for 5 minutes
    etag(),
    async (req: TenantRequest, res) => {
      try {
        const tenantId = req.tenantId!;
        const { identifier } = req.params;

        let record;

        // Check if identifier is a URL slug (contains dashes and ends with display ID)
        const isSlug =
          identifier.includes('-') && identifier.length > 20 && /\d{8}$/.test(identifier);

        if (isSlug) {
          // Look up by URL slug using direct database query
          record = await storage.getBusinessRecordBySlug(identifier, tenantId);
        } else {
          // Look up by ID using existing method
          record = await storage.getBusinessRecord(identifier, tenantId);
        }

        if (!record) {
          return res.status(404).json({ message: 'Business record not found' });
        }

        // Transform database fields to frontend format
        const transformedRecord = BusinessRecordsTransformer.toFrontend(record);
        res.json(transformedRecord);
      } catch (error) {
        console.error('Error fetching business record:', error);
        res.status(500).json({ message: 'Failed to fetch business record' });
      }
    },
  );

  // Create new business record (can be lead or customer)
  app.post(
    '/api/business-records',
    resolveTenant,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        // Get userId from authenticated user (supports both Supabase JWT and session auth)
        const userId =
          (req as any).user?.id || (req as any).user?.claims?.sub || (req as any).session?.userId;
        const tenantId = req.tenantId!;

        if (!userId) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        // Transform frontend data to database format
        const frontendData = req.body;
        console.log('[DEBUG] Frontend data received:', JSON.stringify(frontendData, null, 2));
        const dbData = BusinessRecordsTransformer.toDb(frontendData);
        console.log('[DEBUG] Transformed db data:', JSON.stringify(dbData, null, 2));

        // Normalize record type and status
        const recordType = BusinessRecordsTransformer.normalizeRecordType(
          frontendData.recordType || 'lead',
        );
        const status = BusinessRecordsTransformer.normalizeStatus(
          frontendData.status || 'new',
          recordType,
        );

        // Generate company display ID and URL slug
        const companyDisplayId = await generateCompanyDisplayId(tenantId);
        const urlSlug = await generateUniqueUrlSlug(
          recordType,
          frontendData.companyName || 'Unnamed Company',
          companyDisplayId,
          tenantId,
        );

        const recordData = {
          ...dbData,
          tenantId: tenantId,
          createdBy: userId,
          recordType: recordType,
          status: status,
          companyName: frontendData.companyName, // Ensure company name is properly set
          companyDisplayId: companyDisplayId,
          urlSlug: urlSlug,
        };
        console.log('[DEBUG] Final record data with IDs:', JSON.stringify(recordData, null, 2));

        const newRecord = await storage.createBusinessRecord(recordData);

        // Auto-process lead for scoring and enrichment (non-blocking)
        if (recordType === 'lead') {
          leadIntelligenceService
            .processNewLead(newRecord.id, tenantId, userId)
            .then((result) => {
              console.log(
                `[Lead Intelligence] Auto-processed lead ${newRecord.id}: score=${result.score.totalScore}, tier=${result.score.leadTier}`,
              );
            })
            .catch((error) => {
              console.error(
                `[Lead Intelligence] Failed to auto-process lead ${newRecord.id}:`,
                error,
              );
            });
        }

        // Transform response back to frontend format
        const transformedNewRecord = BusinessRecordsTransformer.toFrontend(newRecord);
        res.status(201).json(transformedNewRecord);
      } catch (error) {
        console.error('Error creating business record:', error);
        res.status(500).json({ message: 'Failed to create business record' });
      }
    },
  );

  // Update business record
  app.put(
    '/api/business-records/:id',
    resolveTenant,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        // Get userId from authenticated user (supports both Supabase JWT and session auth)
        const userId =
          (req as any).user?.id || (req as any).user?.claims?.sub || (req as any).session?.userId;
        const tenantId = req.tenantId!;
        const { id } = req.params;

        if (!userId) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const frontendData = req.body as Record<string, any>;
        console.log(
          '[DEBUG] UPDATE - Frontend data received:',
          JSON.stringify(frontendData, null, 2),
        );

        // Whitelist of updatable fields aligned with Drizzle schema camelCase properties
        const allowedKeys = [
          // Record lifecycle
          'recordType',
          'status',
          'priority',
          // Company
          'companyName',
          'accountNumber',
          'accountType',
          'website',
          'industry',
          'companySize',
          'employeeCount',
          'annualRevenue',
          'customerRating',
          'parentAccountId',
          'customerPriority',
          'slaLevel',
          'isActive',
          'upsellOpportunity',
          'accountNotes',
          // Primary contact
          'primaryContactName',
          'primaryContactEmail',
          'primaryContactPhone',
          'primaryContactTitle',
          // Billing contact
          'billingContactName',
          'billingContactEmail',
          'billingContactPhone',
          // Address
          'addressLine1',
          'addressLine2',
          'city',
          'state',
          'postalCode',
          'country',
          // Billing address
          'billingAddressLine1',
          'billingAddressLine2',
          'billingCity',
          'billingState',
          'billingPostalCode',
          // Communication
          'phone',
          'fax',
          'preferredContactMethod',
          // Lead pipeline
          'leadSource',
          'estimatedAmount',
          'probability',
          'closeDate',
          'salesStage',
          'interestLevel',
          // Assignment
          'ownerId',
          'assignedSalesRep',
          'territory',
          'accountManagerId',
          'leadScore',
          // Customer specific
          'customerNumber',
          'customerSince',
          'customerUntil',
          'churnReason',
          'reactivationDate',
          'churnedDate',
          'competitorName',
          // Financial
          'creditLimit',
          'paymentTerms',
          'billingTerms',
          'taxExempt',
          'taxId',
          'customerTier',
          // Service
          'preferredTechnician',
          'lastServiceDate',
          'nextScheduledService',
          // Billing status
          'lastInvoiceDate',
          'lastPaymentDate',
          'currentBalance',
          // Meter reading
          'lastMeterReadingDate',
          'nextMeterReadingDate',
          // Activity tracking
          'lastContactDate',
          'nextFollowUpDate',
          // External systems
          'externalCustomerId',
          'externalSystemId',
          'externalSalesforceId',
          'externalLeadId',
          'migrationStatus',
          'lastSyncDate',
          'externalData',
          // Notes
          'notes',
        ];

        const updates: Record<string, any> = {};
        for (const key of allowedKeys) {
          if (Object.prototype.hasOwnProperty.call(frontendData, key)) {
            // Convert date strings to Date objects for timestamp fields
            if (key === 'customerSince' && frontendData[key]) {
              updates[key] = new Date(frontendData[key]);
            } else {
              updates[key] = frontendData[key];
            }
          }
        }

        // Normalize record type/status and handle lead->customer conversion metadata
        if (frontendData.recordType) {
          const normalizedType = BusinessRecordsTransformer.normalizeRecordType(
            frontendData.recordType,
          );
          const normalizedStatus = BusinessRecordsTransformer.normalizeStatus(
            frontendData.status || 'active',
            normalizedType,
          );
          updates.recordType = normalizedType;
          updates.status = normalizedStatus;
          if (
            normalizedType === 'customer' &&
            !updates.customerSince &&
            !frontendData.customerSince
          ) {
            updates.customerSince = new Date();
            updates.convertedBy = userId || 'system';
          }
        }

        console.log(
          '[DEBUG] UPDATE - Allowed updates after normalization:',
          JSON.stringify(updates, null, 2),
        );

        const updatedRecord = await storage.updateBusinessRecord(id, tenantId, updates);
        if (!updatedRecord) {
          return res.status(404).json({ message: 'Business record not found' });
        }

        // Transform response back to frontend format
        const transformedRecord = BusinessRecordsTransformer.toFrontend(updatedRecord);
        res.json(transformedRecord);
      } catch (error) {
        console.error('Error updating business record:', error);
        res.status(500).json({ message: 'Failed to update business record' });
      }
    },
  );

  // Lead-specific endpoints (filtered views)
  app.get('/api/leads', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const leads = await storage.getLeads(tenantId);
      res.json(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ message: 'Failed to fetch leads' });
    }
  });

  app.post('/api/leads', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;

      const leadData = {
        ...req.body,
        tenantId,
        createdBy: userId,
      };

      const newLead = await storage.createLead(leadData);

      // Auto-process lead for scoring and enrichment (non-blocking)
      leadIntelligenceService
        .processNewLead(newLead.id, tenantId, userId)
        .then((result) => {
          console.log(
            `[Lead Intelligence] Auto-processed lead ${newLead.id}: score=${result.score.totalScore}, tier=${result.score.leadTier}`,
          );
        })
        .catch((error) => {
          console.error(`[Lead Intelligence] Failed to auto-process lead ${newLead.id}:`, error);
        });

      res.status(201).json(newLead);
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({ message: 'Failed to create lead' });
    }
  });

  // Customer-specific endpoints (filtered views)
  app.get('/api/customers', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { includeInactive } = req.query;

      const customers = await storage.getCustomers(tenantId, includeInactive === 'true');
      res.json(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ message: 'Failed to fetch customers' });
    }
  });

  app.get('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;

      const customer = await storage.getCustomer(id, tenantId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json(customer);
    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({ message: 'Failed to fetch customer' });
    }
  });

  // Former customers for reporting
  app.get('/api/former-customers', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;

      const formerCustomers = await storage.getFormerCustomers(tenantId);
      res.json(formerCustomers);
    } catch (error) {
      console.error('Error fetching former customers:', error);
      res.status(500).json({ message: 'Failed to fetch former customers' });
    }
  });

  // Lead to Customer Conversion - ZERO data duplication
  app.post('/api/leads/:id/convert', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;

      const convertedCustomer = await storage.convertLeadToCustomer(id, tenantId, userId);
      if (!convertedCustomer) {
        return res.status(404).json({ message: 'Lead not found or already converted' });
      }

      res.json({
        message: 'Lead successfully converted to customer',
        customer: convertedCustomer,
      });
    } catch (error) {
      console.error('Error converting lead to customer:', error);
      res.status(500).json({ message: 'Failed to convert lead to customer' });
    }
  });

  // Customer Lifecycle Management
  app.post('/api/customers/:id/deactivate', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: 'Deactivation reason is required' });
      }

      const deactivatedCustomer = await storage.deactivateCustomer(id, tenantId, userId, reason);
      if (!deactivatedCustomer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json({
        message: 'Customer successfully deactivated',
        customer: deactivatedCustomer,
      });
    } catch (error) {
      console.error('Error deactivating customer:', error);
      res.status(500).json({ message: 'Failed to deactivate customer' });
    }
  });

  app.post('/api/customers/:id/mark-non-payment', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;

      const customer = await storage.markCustomerNonPayment(id, tenantId, userId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json({
        message: 'Customer marked as non-payment',
        customer,
      });
    } catch (error) {
      console.error('Error marking customer non-payment:', error);
      res.status(500).json({ message: 'Failed to mark customer non-payment' });
    }
  });

  app.post('/api/customers/:id/reactivate', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;

      const reactivatedCustomer = await storage.reactivateCustomer(id, tenantId, userId);
      if (!reactivatedCustomer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json({
        message: 'Customer successfully reactivated',
        customer: reactivatedCustomer,
      });
    } catch (error) {
      console.error('Error reactivating customer:', error);
      res.status(500).json({ message: 'Failed to reactivate customer' });
    }
  });

  // Get contacts for a business record
  app.get(
    '/api/business-records/:id/contacts',
    resolveTenant,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const tenantId = req.tenantId!;
        const { id } = req.params;

        const contacts = await storage.getBusinessRecordContacts(id, tenantId);
        res.json(contacts);
      } catch (error) {
        console.error('Error fetching business record contacts:', error);
        res.status(500).json({ message: 'Failed to fetch contacts' });
      }
    },
  );

  // Create new contact for a business record
  app.post(
    '/api/business-records/:id/contacts',
    resolveTenant,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        // Get userId from authenticated user (supports both Supabase JWT and session auth)
        const userId =
          (req as any).user?.id || (req as any).user?.claims?.sub || (req as any).session?.userId;
        const tenantId = req.tenantId!;
        const { id } = req.params;

        if (!userId) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const contactData = {
          ...req.body,
          tenantId,
          businessRecordId: id,
          createdBy: userId,
        };

        const newContact = await storage.createBusinessRecordContact(contactData);
        res.status(201).json(newContact);
      } catch (error) {
        console.error('Error creating business record contact:', error);
        res.status(500).json({ message: 'Failed to create contact' });
      }
    },
  );

  // Business Record Activities - Unified activity system
  app.get('/api/business-records/:id/activities', async (req: any, res) => {
    try {
      const tenantId =
        req.user?.tenantId || process.env.DEMO_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000';
      const { id } = req.params;

      const activities = await storage.getBusinessRecordActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching business record activities:', error);
      res.status(500).json({ message: 'Failed to fetch activities' });
    }
  });

  app.post('/api/business-records/:id/activities', async (req: any, res) => {
    try {
      const tenantId =
        req.user?.tenantId || process.env.DEMO_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000';
      const userId = req.user?.id || 'system';
      const { id } = req.params;

      const activityData = {
        ...req.body,
        tenantId,
        businessRecordId: id,
        createdBy: userId,
      };

      const newActivity = await storage.createBusinessRecordActivity(activityData);
      res.status(201).json(newActivity);
    } catch (error) {
      console.error('Error creating business record activity:', error);
      res.status(500).json({ message: 'Failed to create activity' });
    }
  });

  // Backward compatibility for lead activities
  app.get('/api/leads/:id/activities', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;

      const activities = await storage.getLeadActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching lead activities:', error);
      res.status(500).json({ message: 'Failed to fetch lead activities' });
    }
  });

  // Backward compatibility for customer activities
  app.get('/api/customers/:id/activities', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;

      const activities = await storage.getCustomerActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching customer activities:', error);
      res.status(500).json({ message: 'Failed to fetch customer activities' });
    }
  });

  /**
   * GET /api/business-records/:id/contacts
   * Get contacts associated with a business record
   */
  app.get('/api/business-records/:id/contacts', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // First, get the business record to get the company name
      const businessRecord = await storage.getBusinessRecord(id, tenantId);
      if (!businessRecord) {
        return res.status(404).json({ message: 'Business record not found' });
      }

      // Get contacts by company name from enhanced_contacts table
      const contacts = await storage.getContactsByCompanyName(businessRecord.companyName, tenantId);
      res.json(contacts || []);
    } catch (error) {
      console.error('Error fetching business record contacts:', error);
      res.status(500).json({ message: 'Failed to fetch contacts' });
    }
  });

  /**
   * GET /api/business-records/:id
   * Get a single business record by ID or slug
   * Supports both database IDs and URL-friendly slugs
   */
  app.get('/api/business-records/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Try to get by URL slug first, then by ID
      let record;
      const isSlug = id.includes('-') && id.length >= 20 && /\d{8}$/.test(id);

      if (isSlug) {
        record = await storage.getBusinessRecordBySlug(id, tenantId);
      } else {
        record = await storage.getBusinessRecord(id, tenantId);
      }

      if (!record) {
        return res.status(404).json({ message: 'Business record not found' });
      }

      // Transform database fields to frontend format
      const transformedRecord = BusinessRecordsTransformer.toFrontend(record);
      res.json(transformedRecord);
    } catch (error) {
      console.error('Error fetching business record:', error);
      res.status(500).json({ message: 'Failed to fetch business record' });
    }
  });

  /**
   * Helper function to generate customer numbers
   * Format: CUST-000001, CUST-000002, etc.
   */
  async function generateCustomerNumber(tenantId: string): Promise<string> {
    const { db } = await import('./db');
    const { businessRecords } = await import('../shared/schema');
    const { sql, and, eq } = await import('drizzle-orm');

    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessRecords)
      .where(
        and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
      );

    const customerCount = count[0]?.count || 0;
    return `CUST-${String(customerCount + 1).padStart(6, '0')}`;
  }

  /**
   * POST /api/business-records/:id/convert-to-customer
   * Convert a lead to a customer
   * - Updates recordType to 'customer'
   * - Generates customer number
   * - Creates conversion activity
   * - Optionally creates initial service contract
   */
  app.post('/api/business-records/:id/convert-to-customer', async (req: any, res) => {
    try {
      const { tenantId, id: userId } = req.user;
      const { id } = req.params;
      const { customerNumber, serviceAddress, billingAddress } = req.body;

      // Get the lead record
      const lead = await storage.getBusinessRecord(id, tenantId);
      if (!lead || lead.recordType !== 'lead') {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Generate customer number if not provided
      const generatedCustomerNumber = customerNumber || (await generateCustomerNumber(tenantId));

      // Update the record to customer status
      const updatedRecord = await storage.updateBusinessRecord(id, tenantId, {
        recordType: 'customer',
        status: 'active',
        customerNumber: generatedCustomerNumber,
        customerSince: new Date(),
        convertedBy: userId,
        serviceAddress: serviceAddress || (lead as any).address,
        billingAddress: billingAddress || (lead as any).address,
        probability: 100,
      });

      // Create customer conversion activity
      await storage.createBusinessRecordActivity({
        tenantId,
        businessRecordId: id,
        activityType: 'conversion',
        title: 'Lead Converted to Customer',
        description: `Lead successfully converted to customer with number ${generatedCustomerNumber}`,
        userId,
        activityDate: new Date(),
      });

      // Auto-create initial service contract if applicable
      if (lead.estimatedAmount && lead.estimatedAmount > 0) {
        await storage.createContract({
          tenantId,
          customerId: id,
          contractNumber: `CONTRACT-${generatedCustomerNumber}-${Date.now()}`,
          status: 'pending',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          monthlyBase: String((lead.estimatedAmount / 12).toFixed(2)),
          blackRate: null,
          colorRate: null,
        } as any);
      }

      res.json(updatedRecord);
    } catch (error) {
      console.error('Error converting lead to customer:', error);
      res.status(500).json({ message: 'Failed to convert lead to customer' });
    }
  });

  /**
   * PATCH /api/business-records/:id/lifecycle
   * Update the lifecycle status of a business record
   * - Handles churned/deactivated customers
   * - Auto-expires contracts on churn
   * - Creates lifecycle change activity
   */
  app.patch('/api/business-records/:id/lifecycle', async (req: any, res) => {
    try {
      const { tenantId, id: userId } = req.user;
      const { id } = req.params;
      const { status, reason, notes } = req.body;

      const updates: any = { leadStatus: status };

      // Handle customer deactivation scenarios
      if (status === 'churned' || status === 'competitor_switch' || status === 'non_payment') {
        const { db } = await import('./db');
        const { contracts } = await import('../shared/schema');
        const { and, eq } = await import('drizzle-orm');

        updates.customerUntil = new Date();
        updates.churnReason = reason;
        updates.deactivatedBy = userId;

        // Auto-expire contracts
        await db
          .update(contracts)
          .set({
            status: 'cancelled',
            endDate: new Date(),
          })
          .where(
            and(
              eq(contracts.customerId, id),
              eq(contracts.tenantId, tenantId),
              eq(contracts.status, 'active'),
            ),
          );
      }

      const updatedRecord = await storage.updateBusinessRecord(id, updates, tenantId);

      // Log lifecycle change activity
      await storage.createBusinessRecordActivity({
        tenantId,
        businessRecordId: id,
        activityType: 'status_change',
        title: `Status Changed to ${status}`,
        description:
          notes ||
          `Business record status updated to ${status}${reason ? ` due to ${reason}` : ''}`,
        userId,
        activityDate: new Date(),
      });

      res.json(updatedRecord);
    } catch (error) {
      console.error('Error updating business record lifecycle:', error);
      res.status(500).json({ message: 'Failed to update business record lifecycle' });
    }
  });
}
