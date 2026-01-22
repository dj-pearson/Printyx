/**
 * Companies Routes Module
 * Handles all company management endpoints:
 * - /api/companies/* - Company CRUD operations
 *
 * Phase 3 Routes Refactor - Migrated from routes.ts
 */

import type { Express } from 'express';
import { storage } from './storage';
import { isAuthenticated } from './replitAuth';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { insertCompanySchema } from '@shared/schema';

export function registerCompaniesRoutes(app: Express) {
  // Apply authentication to all companies routes
  app.use('/api/companies', isAuthenticated);

  // ============================================
  // Company Management API routes
  // ============================================

  // GET /api/companies - List all companies with optional search
  app.get('/api/companies', resolveTenant, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const search = String((req.query as any)?.search || '');

      const allCompanies = await storage.getCompanies(tenantId);
      const companies = search
        ? allCompanies.filter((c: any) =>
            (c.businessName || '').toLowerCase().includes(search.toLowerCase()),
          )
        : allCompanies;
      res.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ message: 'Failed to fetch companies' });
    }
  });

  // GET /api/companies/:id - Get single company by ID
  app.get('/api/companies/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const company = await storage.getCompany(id, tenantId);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }
      res.json(company);
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).json({ message: 'Failed to fetch company' });
    }
  });

  // POST /api/companies - Create new company
  app.post('/api/companies', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const validatedData = insertCompanySchema.parse({
        ...req.body,
        tenantId: tenantId,
      });

      const company = await storage.createCompany(validatedData as any);
      res.status(201).json(company);
    } catch (error: any) {
      console.error('Error creating company:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create company' });
      }
    }
  });

  // PUT /api/companies/:id - Update company
  app.put('/api/companies/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Clean up undefined fields
      const safeUpdate = { ...req.body } as any;
      if (safeUpdate.department === undefined) delete safeUpdate.department;

      const updatedCompany = await storage.updateCompany(id, safeUpdate, tenantId);
      if (!updatedCompany) {
        return res.status(404).json({ message: 'Company not found' });
      }
      res.json(updatedCompany);
    } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).json({ message: 'Failed to update company' });
    }
  });

  // DELETE /api/companies/:id - Delete company
  app.delete('/api/companies/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const deleted = await storage.deleteCompany(id, tenantId);
      if (!deleted) {
        return res.status(404).json({ message: 'Company not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting company:', error);
      res.status(500).json({ message: 'Failed to delete company' });
    }
  });

  // ============================================
  // Company Deduplication API routes
  // ============================================

  // GET /api/companies/duplicates/scan - Scan for duplicate companies
  app.get('/api/companies/duplicates/scan', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Dynamically import to avoid circular dependencies
      const { findDuplicateGroups } = await import('./services/company-deduplication-service');
      const summary = await findDuplicateGroups(tenantId);

      res.json(summary);
    } catch (error) {
      console.error('Error scanning for duplicates:', error);
      res.status(500).json({ message: 'Failed to scan for duplicates' });
    }
  });

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
      console.error('Error fetching duplicate details:', error);
      res.status(500).json({ message: 'Failed to fetch duplicate details' });
    }
  });

  // POST /api/companies/merge - Merge duplicate companies
  app.post('/api/companies/merge', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || getTenantId(req);
      const userId = getUserId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const { survivorId, duplicateIds } = req.body;

      if (!survivorId) {
        return res.status(400).json({ message: 'Survivor company ID is required' });
      }

      if (!duplicateIds || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
        return res.status(400).json({ message: 'Duplicate company IDs are required (array)' });
      }

      // Prevent merging survivor into itself
      if (duplicateIds.includes(survivorId)) {
        return res.status(400).json({ message: 'Survivor ID cannot be in the duplicate IDs list' });
      }

      const { mergeCompanies } = await import('./services/company-deduplication-service');
      const result = await mergeCompanies(survivorId, duplicateIds, tenantId, userId);

      if (!result.success) {
        return res.status(500).json({
          message: 'Merge failed',
          error: result.error,
        });
      }

      res.json({
        success: true,
        survivorId: result.survivorId,
        mergedCount: result.mergedCompanyIds.length,
        contactsMoved: result.contactsMoved,
        activitiesMoved: result.activitiesMoved,
        enhancedContactsMoved: result.enhancedContactsMoved,
      });
    } catch (error) {
      console.error('Error merging companies:', error);
      res.status(500).json({ message: 'Failed to merge companies' });
    }
  });

  // POST /api/companies/check-duplicate - Check if a company would be a duplicate
  app.post('/api/companies/check-duplicate', resolveTenant, async (req: any, res) => {
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
      const existing = await findExistingCompany(tenantId, businessName, billingCity, billingState);

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
      console.error('Error checking for duplicate:', error);
      res.status(500).json({ message: 'Failed to check for duplicate' });
    }
  });
}

export default { registerCompaniesRoutes };
