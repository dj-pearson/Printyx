/**
 * Deals Routes (Legacy /api/deals/* endpoints)
 *
 * NOTE: This file handles legacy /api/deals/* endpoints.
 * New deals functionality should use /api/deals-management/* (see routes-deals-management.ts)
 * which has enhanced RBAC and hierarchical data scoping.
 *
 * These routes will be deprecated in favor of the deals-management endpoints.
 */

import { Router, type Express } from 'express';
import { storage } from './storage';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { insertDealSchema, insertDealStageSchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/deals/:id
 * Get single deal by ID
 */
router.get('/api/deals/:id', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!tenantId) {
      return res.status(403).json({
        message: 'Tenant context required',
        code: 'NO_TENANT',
      });
    }

    const dealId = req.params.id;
    const deal = await storage.getDeal(dealId, tenantId);

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    res.json(deal);
  } catch (error) {
    console.error('Error fetching deal:', error);
    res.status(500).json({ message: 'Failed to fetch deal' });
  }
});

/**
 * POST /api/deals
 * Create a new deal
 */
router.post('/api/deals', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!tenantId) {
      return res.status(403).json({
        message: 'Tenant context required',
        code: 'NO_TENANT',
      });
    }

    // Get or create default deal stages
    let stages = await storage.getDealStages(tenantId);

    if (stages.length === 0) {
      // Initialize default stages if none exist
      const defaultStages = [
        {
          name: 'Appointment Scheduled',
          color: '#3B82F6',
          sortOrder: 1,
          isClosingStage: false,
          isWonStage: false,
        },
        {
          name: 'Qualified to Buy',
          color: '#8B5CF6',
          sortOrder: 2,
          isClosingStage: false,
          isWonStage: false,
        },
        {
          name: 'Presentation Scheduled',
          color: '#06B6D4',
          sortOrder: 3,
          isClosingStage: false,
          isWonStage: false,
        },
        {
          name: 'Decision Maker Bought-In',
          color: '#F59E0B',
          sortOrder: 4,
          isClosingStage: false,
          isWonStage: false,
        },
        {
          name: 'Contract Sent',
          color: '#EF4444',
          sortOrder: 5,
          isClosingStage: false,
          isWonStage: false,
        },
        {
          name: 'Closed Won',
          color: '#10B981',
          sortOrder: 6,
          isClosingStage: true,
          isWonStage: true,
        },
        {
          name: 'Closed Lost',
          color: '#6B7280',
          sortOrder: 7,
          isClosingStage: true,
          isWonStage: false,
        },
      ];

      for (const stage of defaultStages) {
        await storage.createDealStage({ ...stage, tenantId, isActive: true });
      }

      stages = await storage.getDealStages(tenantId);
    }

    const defaultStageId = stages.length > 0 ? stages[0].id : null;
    if (!defaultStageId) {
      throw new Error('No deal stages available');
    }

    // Build deal data
    const dealData = {
      tenantId,
      ownerId: userId,
      createdById: userId,
      stageId: defaultStageId,
      title: req.body.title,
      description: req.body.description || null,
      amount: req.body.amount || null,
      estimatedMonthlyValue: req.body.estimatedMonthlyValue || null,
      expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null,
      companyName: req.body.companyName || null,
      primaryContactName: req.body.primaryContactName || null,
      primaryContactEmail: req.body.primaryContactEmail || null,
      primaryContactPhone: req.body.primaryContactPhone || null,
      source: req.body.source || null,
      dealType: req.body.dealType || null,
      priority: req.body.priority || 'medium',
      productsInterested: req.body.productsInterested || null,
      probability: 25, // Default probability for new deals
    };

    const deal = await storage.createDeal(dealData);
    res.status(201).json(deal);
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ message: 'Failed to create deal' });
  }
});

/**
 * PUT /api/deals/:id
 * Update an existing deal
 */
router.put('/api/deals/:id', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (!tenantId) {
      return res.status(403).json({
        message: 'Tenant context required',
        code: 'NO_TENANT',
      });
    }

    const dealId = req.params.id;

    // Convert date strings to Date objects
    const updateData = { ...req.body };
    if (updateData.expectedCloseDate && typeof updateData.expectedCloseDate === 'string') {
      updateData.expectedCloseDate = new Date(updateData.expectedCloseDate);
    }

    const deal = await storage.updateDeal(dealId, updateData, tenantId);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    res.json(deal);
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ message: 'Failed to update deal' });
  }
});

/**
 * Register deals routes with Express app
 */
export function registerDealsRoutes(app: Express) {
  app.use(router);
}

export default router;
