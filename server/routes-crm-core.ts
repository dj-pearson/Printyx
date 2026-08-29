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
import { storage } from './storage';
import { insertLeadSchema, insertLeadContactSchema } from '@shared/schema';
import { BusinessRecordsTransformer } from './data-field-mapping';
import { cacheControl, etag } from './middleware/cache-middleware';
import { enforceUsageLimits } from './middleware/subscription';
import { getUserId, getTenantId } from './utils/auth-helpers';

// Multer for CSV import

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

  // POST /api/business-records/import DELETED (QUALITY-002). It was shadowed by
  // the /api/business-records proxy, and its only caller,
  // client/src/components/leads/LeadsImport.tsx, was an ORPHAN with no importer
  // anywhere - so no user could reach it from either end. The capability is not
  // lost: /import is routed to CSVImportWizard, which drives the /api/import
  // subsystem (supabase/functions/import/), and that handles business_records
  // and leads directly. LeadsImport.tsx is deleted with it.
  //
  // docs/shadowed-express-baseline.json used to annotate this entry as a "LIVE
  // BROKEN FEATURE". That was wrong twice over: the caller was unreachable, and
  // a working replacement already shipped.
}
