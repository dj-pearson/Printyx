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
import { enforceUsageLimits } from './middleware/subscription';
import { getUserId, getTenantId } from './utils/auth-helpers';
import {
  ACTIVITY_FIELDS_WITHOUT_COLUMNS,
  buildActivityInsert,
  presentActivity,
} from '@shared/lead-activity-write';

// Multer for CSV import

export function registerCrmCoreRoutes(app: Express) {
  // GET /api/customers and GET /api/customers/:id were removed here (PA-021).
  // /api/customers is a crmProxies prefix now, so both were shadowed, and
  // production had never reached them: supabase/functions/customers/ serves
  // both, reading `companies` rather than `business_records`. Which of those
  // two is canonical for the record is COP-B00's question, not this file's.

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

  // Both handlers go through @shared/lead-activity-write, which
  // supabase/functions/leads/ imports too (PROD-008). They used to disagree in
  // the two ways a dev/prod split usually does NOT show up: production had no
  // edge branch at all, and this POST spread the request body straight into
  // Drizzle - so `type`, the name the iOS quick-log sends, was dropped as a
  // non-column and `activity_type` (NOT NULL) arrived null. 23502, reproduced
  // on Postgres 16.
  app.get('/api/leads/:id/activities', async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const activities = await storage.getLeadActivities(id, tenantId);
      res.json((activities ?? []).map((row: Record<string, unknown>) => presentActivity(row)));
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
      const plan = buildActivityInsert(req.body ?? {}, {
        tenantId,
        businessRecordId: id,
        createdBy: getUserId(req) || 'system',
      });
      if (!plan.fields) {
        return res.status(400).json({
          message: plan.error?.message ?? 'Invalid activity',
          code: plan.error?.code ?? 'ACTIVITY_INVALID',
          ignoredFields: plan.ignoredFields,
          refusedFields: plan.refusedFields,
        });
      }
      const activity = await storage.createBusinessRecordActivity(plan.fields);
      res.status(201).json({
        ...presentActivity(activity),
        ignoredFields: plan.ignoredFields,
        refusedFields: plan.refusedFields,
        unbacked: plan.ignoredFields.some((f) =>
          (ACTIVITY_FIELDS_WITHOUT_COLUMNS as readonly string[]).includes(f),
        )
          ? [
              'business_record_activities has no location columns, so latitude, longitude and accuracy are not stored',
            ]
          : [],
      });
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
