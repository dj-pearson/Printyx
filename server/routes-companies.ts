/**
 * Companies Routes Module
 * Handles all company management endpoints:
 * - /api/companies/* - Company CRUD operations
 *
 * Phase 3 Routes Refactor - Migrated from routes.ts
 */

import type { Express } from 'express';
import { isAuthenticated } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId } from './utils/auth-helpers';
import { validate } from './middleware/enhanced-validation';
import { companyDuplicateCheckSchema } from './lib/crm-validation';
import { matchesSearch } from './lib/crm-list-query';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-companies');

export function registerCompaniesRoutes(app: Express) {
  // Apply authentication to all companies routes
  app.use('/api/companies', isAuthenticated);

  // ============================================
  // Company Management API routes
  // ============================================

  // GET /api/companies - List all companies with optional search
  // ── /api/companies: PARTLY RETIRED (PROD-008b) ────────────────────────────
  //
  // Seven handlers lived here and are gone: GET list, GET /:id, POST, PUT /:id,
  // DELETE /:id, GET /duplicates/scan and POST /merge. /api/companies is in
  // crmProxies and the proxy registers first, so none ran in dev; production
  // never reaches Express. The companies edge function covers all seven - PUT
  // was added there as an alias for PATCH, because this file registered PUT and
  // the edge function had only PATCH.
  //
  // STILL HERE: GET /duplicates/details and POST /check-duplicate have no edge
  // counterpart. Neither has a frontend caller, but deleting them removes
  // capability rather than a duplicate, so they stay bannered and baselined.

  // GET /api/companies/:id - Get single company by ID

  // POST /api/companies - Create new company

  // PUT /api/companies/:id - Update company

  // DELETE /api/companies/:id - Delete company

  // ============================================
  // Company Deduplication API routes
  // ============================================

  // GET /api/companies/duplicates/scan - Scan for duplicate companies

  // GET /api/companies/duplicates/details - Get details for specific company IDs
  app.get('/api/companies/duplicates/details', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || getTenantId(req);
      const ids = req.query.ids as string;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      if (!ids) {
        return res.status(400).json({ message: 'Company IDs are required (comma-separated)' });
      }

      const companyIds = ids.split(',').map((id: string) => id.trim());

      const { getDuplicateGroupDetails } = await import('./services/company-deduplication-service');
      const details = await getDuplicateGroupDetails(tenantId, companyIds);

      res.json(details);
    } catch (error) {
      log.error('Error fetching duplicate details:', error);
      res.status(500).json({ message: 'Failed to fetch duplicate details' });
    }
  });

  // POST /api/companies/merge - Merge duplicate companies

  // POST /api/companies/check-duplicate - Check if a company would be a duplicate
  app.post(
    '/api/companies/check-duplicate',
    resolveTenant,
    validate({ body: companyDuplicateCheckSchema }),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || getTenantId(req);

        if (!tenantId) {
          return res.status(400).json({ message: 'Tenant ID is required' });
        }

        const { businessName, billingCity, billingState } = req.body;

        if (!businessName) {
          return res.status(400).json({ message: 'Business name is required' });
        }

        const { findExistingCompany } = await import('./services/company-deduplication-service');
        const existing = await findExistingCompany(
          tenantId,
          businessName,
          billingCity,
          billingState,
        );

        if (existing) {
          res.json({
            isDuplicate: true,
            existingCompany: {
              id: existing.id,
              businessName: existing.businessName,
              billingCity: existing.billingCity,
              billingState: existing.billingState,
              phone: existing.phone,
            },
          });
        } else {
          res.json({ isDuplicate: false });
        }
      } catch (error) {
        log.error('Error checking for duplicate:', error);
        res.status(500).json({ message: 'Failed to check for duplicate' });
      }
    },
  );
}

export default { registerCompaniesRoutes };
