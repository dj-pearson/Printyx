/**
 * Contacts Routes Module
 * Handles all contact-related endpoints including:
 * - /api/contacts/* - General contacts CRUD
 * - /api/company-contacts/* - Company-specific contacts
 * - /api/companies/:id/contacts - Nested company contacts
 *
 * Phase 3 Routes Refactor - Migrated from routes.ts
 */

import type { Express } from 'express';
import { storage } from './storage';
import { isAuthenticated } from './replitAuth';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { insertCompanyContactSchema } from '@shared/schema';

export function registerContactsRoutes(app: Express) {
  // Apply authentication to all contacts routes
  app.use('/api/contacts', isAuthenticated);
  app.use('/api/company-contacts', isAuthenticated);

  // ============================================
  // Company Contacts API routes
  // ============================================

  // GET /api/company-contacts - fetch all contacts, optionally filtered by companyId
  app.get('/api/company-contacts', resolveTenant, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const companyId = String((req.query as any)?.companyId || '');

      if (companyId) {
        // Fetch contacts for specific company
        const contacts = await storage.getCompanyContacts(companyId, tenantId);
        res.json(contacts);
      } else {
        // Fetch all contacts
        const contacts = await storage.getAllCompanyContacts(tenantId);
        res.json(contacts);
      }
    } catch (error) {
      console.error('Error fetching company contacts:', error);
      res.status(500).json({ error: 'Failed to fetch company contacts' });
    }
  });

  // GET /api/company-contacts/:companyId - Legacy endpoint for backward compatibility
  app.get('/api/company-contacts/:companyId', resolveTenant, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);
      const { companyId } = req.params;

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const contacts = await storage.getCompanyContacts(companyId, tenantId);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching company contacts:', error);
      res.status(500).json({ error: 'Failed to fetch company contacts' });
    }
  });

  // POST /api/company-contacts - Create new company contact
  app.post('/api/company-contacts', resolveTenant, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      // Validate using Zod schema
      const contactData = insertCompanyContactSchema.parse({
        ...req.body,
        tenantId,
        ownerId: req.body.ownerId || user.id,
      });

      const contact = await storage.createCompanyContact(contactData);
      res.status(201).json(contact);
    } catch (error: any) {
      console.error('Error creating company contact:', error);
      if (error.name === 'ZodError') {
        console.error('Validation errors:', error.errors);
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create company contact', details: error.message });
      }
    }
  });

  // PUT /api/company-contacts/:id - Update company contact
  app.put('/api/company-contacts/:id', resolveTenant, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);
      const { id } = req.params;

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const contact = await storage.updateCompanyContact(id, req.body, tenantId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      res.json(contact);
    } catch (error) {
      console.error('Error updating company contact:', error);
      res.status(500).json({ error: 'Failed to update company contact' });
    }
  });

  // DELETE /api/company-contacts/:id - Delete company contact
  app.delete('/api/company-contacts/:id', resolveTenant, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);
      const { id } = req.params;

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const result = await storage.deleteCompanyContact(id, tenantId);
      if (!result) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting company contact:', error);
      res.status(500).json({ error: 'Failed to delete company contact' });
    }
  });

  // ============================================
  // General Contacts API routes
  // ============================================

  // GET /api/contacts - List contacts with filtering and pagination
  app.get('/api/contacts', resolveTenant, async (req: TenantRequest, res) => {
    try {
      const user = req.user as any;
      const tenantId = req.tenant_id || user.tenant_id;

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get query parameters
      const {
        search = '',
        contactOwner = '',
        createDate = '',
        lastActivityDate = '',
        leadStatus = '',
        view = 'all',
        sortBy = 'lastActivityDate',
        sortOrder = 'desc',
        page = '1',
        limit = '25',
      } = req.query as any;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Build filters based on role and view
      let filters: any = { tenantId };

      // Role-based access control
      if (user.role === 'salesperson') {
        filters.ownerId = user.id; // Salespeople only see their own contacts
      }

      // Apply view filter
      if (view === 'my') {
        filters.ownerId = user.id;
      } else if (view === 'unassigned') {
        filters.ownerId = null;
      }

      // Apply other filters
      if (contactOwner) {
        const ownerUser = await storage.getUserByName(contactOwner);
        if (ownerUser) {
          filters.ownerId = ownerUser.id;
        }
      }

      if (leadStatus) {
        filters.leadStatus = leadStatus;
      }

      // Date filters
      const now = new Date();
      if (createDate) {
        switch (createDate) {
          case 'today':
            filters.created_at = {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            };
            break;
          case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            filters.created_at = {
              gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            };
            break;
          case 'last7days':
            const last7Days = new Date(now);
            last7Days.setDate(last7Days.getDate() - 7);
            filters.created_at = { gte: last7Days };
            break;
          case 'last30days':
            const last30Days = new Date(now);
            last30Days.setDate(last30Days.getDate() - 30);
            filters.created_at = { gte: last30Days };
            break;
        }
      }

      if (lastActivityDate) {
        switch (lastActivityDate) {
          case 'today':
            filters.lastContactDate = {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            };
            break;
          case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            filters.lastContactDate = {
              gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            };
            break;
          case 'last7days':
            const last7Days = new Date(now);
            last7Days.setDate(last7Days.getDate() - 7);
            filters.lastContactDate = { gte: last7Days };
            break;
          case 'last30days':
            const last30Days = new Date(now);
            last30Days.setDate(last30Days.getDate() - 30);
            filters.lastContactDate = { gte: last30Days };
            break;
          case 'never':
            filters.lastContactDate = null;
            break;
        }
      }

      const contacts = await storage.getContacts({
        filters,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        offset,
        limit: limitNum,
      });

      const total = await storage.getContactsCount({
        filters,
        search: search as string,
      });

      res.json({
        contacts,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  // POST /api/contacts - Create new contact
  app.post('/api/contacts', resolveTenant, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      // Validate using Zod schema
      const contactData = insertCompanyContactSchema.parse({
        ...req.body,
        tenantId,
        ownerId: req.body.ownerId || user.id,
      });

      const contact = await storage.createCompanyContact(contactData);
      res.status(201).json(contact);
    } catch (error: any) {
      console.error('Error creating contact:', error);
      res.status(500).json({ error: 'Failed to create contact', details: error.message });
    }
  });

  // GET /api/contacts/:id - Get single contact
  app.get('/api/contacts/:id', resolveTenant, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);
      const { id } = req.params;

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const contact = await storage.getContactById(id);

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Check tenant access
      if (contact.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Role-based access control
      if (user.role === 'salesperson' && contact.ownerId !== user.id) {
        return res.status(403).json({
          error: 'Access denied - you can only view your own contacts',
        });
      }

      res.json(contact);
    } catch (error) {
      console.error('Error fetching contact:', error);
      res.status(500).json({ error: 'Failed to fetch contact' });
    }
  });

  // PUT /api/contacts/:id - Update contact
  app.put('/api/contacts/:id', resolveTenant, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);
      const { id } = req.params;

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const contact = await storage.getContactById(id);

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Check tenant access
      if (contact.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Role-based access control
      if (user.role === 'salesperson' && contact.ownerId !== user.id) {
        return res.status(403).json({
          error: 'Access denied - you can only edit your own contacts',
        });
      }

      const updatedContact = await storage.updateContact(id, req.body);
      res.json(updatedContact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  // DELETE /api/contacts/:id - Delete contact
  app.delete('/api/contacts/:id', resolveTenant, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenant_id || getTenantId(req);
      const { id } = req.params;

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const contact = await storage.getContactById(id);

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Check tenant access
      if (contact.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Role-based access control
      if (user.role === 'salesperson' && contact.ownerId !== user.id) {
        return res.status(403).json({
          error: 'Access denied - you can only delete your own contacts',
        });
      }

      await storage.deleteContact(id, tenantId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  // ============================================
  // Company nested contacts routes
  // ============================================

  // GET /api/companies/:companyId/contacts - Get contacts for a company
  app.get('/api/companies/:companyId/contacts', resolveTenant, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user?.tenant_id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const contacts = await storage.getContactsByCompany(companyId, user.tenant_id);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching company contacts:', error);
      res.status(500).json({ message: 'Failed to fetch contacts' });
    }
  });

  // PUT /api/contacts/:contactId - Update contact (alternate path)
  app.put('/api/contacts/:contactId', resolveTenant, async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const contactData = req.body;

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user?.tenant_id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedContact = await storage.updateContact(contactId, {
        ...contactData,
        tenantId: user.tenant_id,
        updatedAt: new Date(),
      });

      res.json(updatedContact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({ message: 'Failed to update contact' });
    }
  });

  // DELETE /api/contacts/:contactId - Delete contact (alternate path)
  app.delete('/api/contacts/:contactId', resolveTenant, async (req: any, res) => {
    try {
      const { contactId } = req.params;

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user?.tenant_id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteContact(contactId, user.tenant_id);
      res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ message: 'Failed to delete contact' });
    }
  });
}

export default { registerContactsRoutes };
