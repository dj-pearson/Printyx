/**
 * CRM Core Routes
 *
 * Consolidated leads, customers, and business records routes
 * extracted from routes.ts monolith.
 *
 * Covers:
 * - GET/POST /api/customers, /api/customers/:id
 * - GET/POST/PUT /api/leads, /api/leads/:id
 * - POST /api/leads/:id/convert
 * - GET/POST /api/leads/:id/activities
 * - GET/POST /api/leads/:id/contacts
 * - GET /api/leads/:id/related-records
 * - POST /api/business-records/import
 */

import type { Express } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { storage } from './storage';
import { insertLeadSchema, insertLeadContactSchema } from '@shared/schema';
import { BusinessRecordsTransformer } from './data-field-mapping';
import { cacheControl, etag } from './middleware/cache-middleware';
import { enforceUsageLimits } from './middleware/subscription';
import { getUserId, getTenantId } from './utils/auth-helpers';

// Multer for CSV import
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(buffer.toString());
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

export function registerCrmCoreRoutes(app: Express) {
  // ─── Customer List & Detail ──────────────────────────────────────

  app.get('/api/customers', cacheControl(180), etag(), async (req: any, res, next) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const customers = await storage.getBusinessRecords(tenantId, 'customer');
      const transformedCustomers = customers.map((customer) =>
        BusinessRecordsTransformer.toFrontend(customer),
      );
      res.json(transformedCustomers);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/customers/:id', cacheControl(300), etag(), async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      let customer;
      const isSlug = id.includes('-') && id.length >= 20 && /\d{8}$/.test(id);

      if (isSlug) {
        customer = await storage.getBusinessRecordBySlug(id, tenantId);
      } else {
        customer = await storage.getBusinessRecord(id, tenantId);
      }

      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const transformedCustomer = BusinessRecordsTransformer.toFrontend(customer);
      res.json(transformedCustomer);
    } catch (error) {
      next(error);
    }
  });

  // ─── Lead List & Detail ──────────────────────────────────────────

  app.get('/api/leads', async (req: any, res, next) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const leads = await storage.getBusinessRecords(tenantId, 'lead');
      const transformedLeads = leads.map((lead) => BusinessRecordsTransformer.toFrontend(lead));
      res.json(transformedLeads);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/leads/:id', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      let lead;
      const isSlug = id.includes('-') && id.length >= 20 && /\d{8}$/.test(id);

      if (isSlug) {
        lead = await storage.getBusinessRecordBySlug(id, tenantId);
      } else {
        lead = await storage.getBusinessRecord(id, tenantId);
      }

      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      const transformedLead = BusinessRecordsTransformer.toFrontend(lead);
      res.json(transformedLead);
    } catch (error) {
      next(error);
    }
  });

  // ─── Lead Mutations ──────────────────────────────────────────────

  app.post('/api/leads', enforceUsageLimits, async (req: any, res, next) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const validatedData = insertLeadSchema.parse({
        ...req.body,
        tenantId: tenantId,
        createdBy: getUserId(req) || 'system',
      });
      const lead = await storage.createLead(validatedData);
      res.json(lead);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/leads/:id', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const updatedLead = await storage.updateLead(id, req.body, tenantId);
      if (!updatedLead) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      res.json(updatedLead);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/leads/:id/convert', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const customer = await storage.convertLeadToCustomer(id, tenantId, getUserId(req) as string);
      res.json(customer);
    } catch (error) {
      next(error);
    }
  });

  // ─── Lead Activities ─────────────────────────────────────────────

  app.get('/api/leads/:id/activities', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const activities = await storage.getLeadActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/leads/:id/activities', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const activityData = {
        ...req.body,
        leadId: id,
        tenantId,
        createdBy: getUserId(req) || 'system',
      };
      const activity = await storage.createLeadActivity(activityData);
      res.json(activity);
    } catch (error) {
      next(error);
    }
  });

  // ─── Lead Contacts ───────────────────────────────────────────────

  app.get('/api/leads/:id/contacts', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const contacts = await storage.getLeadContacts(id, tenantId);
      res.json(contacts);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/leads/:id/contacts', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const contactData = insertLeadContactSchema.parse({
        ...req.body,
        leadId: id,
        tenantId,
      });
      const contact = await storage.createLeadContact(contactData);
      res.json(contact);
    } catch (error) {
      next(error);
    }
  });

  // ─── Lead Related Records ────────────────────────────────────────

  app.get('/api/leads/:id/related-records', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const records = await storage.getLeadRelatedRecords(id, tenantId);
      res.json(records);
    } catch (error) {
      next(error);
    }
  });

  // ─── Business Records CSV Import ─────────────────────────────────

  app.post('/api/business-records/import', enforceUsageLimits, upload.single('file'), async (req: any, res, next) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const csvData = await parseCSV(req.file.buffer);

      let imported = 0;
      let skipped = 0;
      let duplicates = 0;
      const errors: string[] = [];

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];

        if (!row.companyName || !row.companyName.trim()) {
          skipped++;
          continue;
        }

        try {
          const existing = await storage.getBusinessRecords({
            tenantId,
            search: row.companyName.trim(),
          });

          if (
            existing.some(
              (record: any) =>
                record.companyName.toLowerCase() === row.companyName.toLowerCase().trim(),
            )
          ) {
            duplicates++;
            continue;
          }

          const businessRecordData = {
            tenantId,
            recordType: 'lead',
            status: 'new',
            companyName: row.companyName.trim(),
            primaryContactName: row.primaryContactName || '',
            primaryContactEmail: row.primaryContactEmail || '',
            primaryContactPhone: row.primaryContactPhone || '',
            primaryContactTitle: row.primaryContactTitle || '',
            website: row.website || '',
            industry: row.industry || '',
            employeeCount: row.employeeCount ? parseInt(row.employeeCount) : null,
            annualRevenue: row.annualRevenue ? parseFloat(row.annualRevenue) : null,
            addressLine1: row.addressLine1 || '',
            addressLine2: row.addressLine2 || '',
            city: row.city || '',
            state: row.state || '',
            postalCode: row.postalCode || '',
            country: row.country || 'US',
            phone: row.phone || row.primaryContactPhone || '',
            fax: row.fax || '',
            leadSource: row.leadSource || 'import',
            estimatedAmount: row.estimatedAmount ? parseFloat(row.estimatedAmount) : null,
            probability: row.probability ? parseInt(row.probability) : 50,
            salesStage: row.salesStage || 'new',
            interestLevel: row.interestLevel || 'medium',
            priority: row.priority || 'medium',
            territory: row.territory || '',
            notes: row.notes || '',
            assignedSalesRep:
              row.assignedSalesRep === 'current_user'
                ? getUserId(req)
                : row.assignedSalesRep || getUserId(req),
            ownerId:
              row.assignedSalesRep === 'current_user'
                ? getUserId(req)
                : row.assignedSalesRep || getUserId(req),
            createdBy: getUserId(req),
          };

          await storage.createBusinessRecord(businessRecordData);
          imported++;
        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message}`);
          skipped++;
        }
      }

      res.json({
        success: true,
        imported,
        skipped,
        duplicates,
        errors,
        message: `Successfully imported ${imported} leads. ${skipped > 0 ? `${skipped} rows skipped.` : ''} ${duplicates > 0 ? `${duplicates} duplicates found.` : ''}`,
      });
    } catch (error) {
      next(error);
    }
  });
}
