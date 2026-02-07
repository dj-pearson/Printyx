import type { Express } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-lead-assignment');

import {
  salesTerritories,
  leadAssignmentRules,
  repCapacity,
  leadAssignmentHistory,
  leadAssignmentQueue,
  type InsertSalesTerritory,
  type InsertLeadAssignmentRule,
  type InsertRepCapacity,
  type InsertLeadAssignmentHistory,
  type InsertLeadAssignmentQueue,
} from '@shared/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';

export function registerLeadAssignmentRoutes(app: Express) {
  // ==================== Sales Territories ====================

  // Get all territories for tenant
  app.get('/api/sales-territories', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const territories = await db.query.salesTerritories.findMany({
        where: eq(salesTerritories.tenantId, tenantId),
        orderBy: [desc(salesTerritories.isActive), asc(salesTerritories.territoryName)],
      });

      res.json(territories);
    } catch (error) {
      log.error('Error fetching sales territories:', error);
      res.status(500).json({ error: 'Failed to fetch sales territories' });
    }
  });

  // Get single territory
  app.get('/api/sales-territories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const territory = await db.query.salesTerritories.findFirst({
        where: and(eq(salesTerritories.id, id), eq(salesTerritories.tenantId, tenantId)),
      });

      if (!territory) {
        return res.status(404).json({ error: 'Territory not found' });
      }

      res.json(territory);
    } catch (error) {
      log.error('Error fetching territory:', error);
      res.status(500).json({ error: 'Failed to fetch territory' });
    }
  });

  // Create territory
  app.post('/api/sales-territories', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const territoryData: InsertSalesTerritory = {
        ...req.body,
        tenantId,
      };

      const [newTerritory] = await db.insert(salesTerritories).values(territoryData).returning();

      res.status(201).json(newTerritory);
    } catch (error) {
      log.error('Error creating territory:', error);
      res.status(500).json({ error: 'Failed to create territory' });
    }
  });

  // Update territory
  app.put('/api/sales-territories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [updated] = await db
        .update(salesTerritories)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(salesTerritories.id, id), eq(salesTerritories.tenantId, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Territory not found' });
      }

      res.json(updated);
    } catch (error) {
      log.error('Error updating territory:', error);
      res.status(500).json({ error: 'Failed to update territory' });
    }
  });

  // Delete territory
  app.delete('/api/sales-territories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [deleted] = await db
        .delete(salesTerritories)
        .where(and(eq(salesTerritories.id, id), eq(salesTerritories.tenantId, tenantId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Territory not found' });
      }

      res.json({ success: true, deleted });
    } catch (error) {
      log.error('Error deleting territory:', error);
      res.status(500).json({ error: 'Failed to delete territory' });
    }
  });

  // ==================== Lead Assignment Rules ====================

  // Get all assignment rules
  app.get('/api/lead-assignment-rules', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const rules = await db.query.leadAssignmentRules.findMany({
        where: eq(leadAssignmentRules.tenantId, tenantId),
        orderBy: [desc(leadAssignmentRules.priority), asc(leadAssignmentRules.ruleName)],
      });

      res.json(rules);
    } catch (error) {
      log.error('Error fetching assignment rules:', error);
      res.status(500).json({ error: 'Failed to fetch assignment rules' });
    }
  });

  // Get single rule
  app.get('/api/lead-assignment-rules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const rule = await db.query.leadAssignmentRules.findFirst({
        where: and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenantId, tenantId)),
      });

      if (!rule) {
        return res.status(404).json({ error: 'Assignment rule not found' });
      }

      res.json(rule);
    } catch (error) {
      log.error('Error fetching assignment rule:', error);
      res.status(500).json({ error: 'Failed to fetch assignment rule' });
    }
  });

  // Create assignment rule
  app.post('/api/lead-assignment-rules', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const ruleData: InsertLeadAssignmentRule = {
        ...req.body,
        tenantId,
      };

      const [newRule] = await db.insert(leadAssignmentRules).values(ruleData).returning();

      res.status(201).json(newRule);
    } catch (error) {
      log.error('Error creating assignment rule:', error);
      res.status(500).json({ error: 'Failed to create assignment rule' });
    }
  });

  // Update assignment rule
  app.put('/api/lead-assignment-rules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [updated] = await db
        .update(leadAssignmentRules)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenantId, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Assignment rule not found' });
      }

      res.json(updated);
    } catch (error) {
      log.error('Error updating assignment rule:', error);
      res.status(500).json({ error: 'Failed to update assignment rule' });
    }
  });

  // Delete assignment rule
  app.delete('/api/lead-assignment-rules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [deleted] = await db
        .delete(leadAssignmentRules)
        .where(and(eq(leadAssignmentRules.id, id), eq(leadAssignmentRules.tenantId, tenantId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Assignment rule not found' });
      }

      res.json({ success: true, deleted });
    } catch (error) {
      log.error('Error deleting assignment rule:', error);
      res.status(500).json({ error: 'Failed to delete assignment rule' });
    }
  });

  // ==================== Rep Capacity ====================

  // Get rep capacity by user ID
  app.get('/api/rep-capacity/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const capacity = await db.query.repCapacity.findFirst({
        where: and(eq(repCapacity.userId, userId), eq(repCapacity.tenantId, tenantId)),
      });

      if (!capacity) {
        return res.status(404).json({ error: 'Rep capacity not found' });
      }

      res.json(capacity);
    } catch (error) {
      log.error('Error fetching rep capacity:', error);
      res.status(500).json({ error: 'Failed to fetch rep capacity' });
    }
  });

  // Get all rep capacities for tenant
  app.get('/api/rep-capacity', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const capacities = await db.query.repCapacity.findMany({
        where: eq(repCapacity.tenantId, tenantId),
        orderBy: [desc(repCapacity.isAvailable), asc(repCapacity.userId)],
      });

      res.json(capacities);
    } catch (error) {
      log.error('Error fetching rep capacities:', error);
      res.status(500).json({ error: 'Failed to fetch rep capacities' });
    }
  });

  // Create or update rep capacity
  app.post('/api/rep-capacity', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const capacityData: InsertRepCapacity = {
        ...req.body,
        tenantId,
      };

      // Check if capacity already exists
      const existing = await db.query.repCapacity.findFirst({
        where: and(eq(repCapacity.userId, capacityData.userId), eq(repCapacity.tenantId, tenantId)),
      });

      if (existing) {
        // Update existing
        const [updated] = await db
          .update(repCapacity)
          .set({ ...req.body, updatedAt: new Date() })
          .where(eq(repCapacity.id, existing.id))
          .returning();
        return res.json(updated);
      } else {
        // Create new
        const [newCapacity] = await db.insert(repCapacity).values(capacityData).returning();
        return res.status(201).json(newCapacity);
      }
    } catch (error) {
      log.error('Error saving rep capacity:', error);
      res.status(500).json({ error: 'Failed to save rep capacity' });
    }
  });

  // Update rep availability
  app.patch('/api/rep-capacity/:userId/availability', async (req, res) => {
    try {
      const { userId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const { isAvailable, unavailableReason, unavailableUntil } = req.body;

      const [updated] = await db
        .update(repCapacity)
        .set({
          isAvailable,
          unavailableReason,
          unavailableUntil,
          updatedAt: new Date(),
        })
        .where(and(eq(repCapacity.userId, userId), eq(repCapacity.tenantId, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Rep capacity not found' });
      }

      res.json(updated);
    } catch (error) {
      log.error('Error updating rep availability:', error);
      res.status(500).json({ error: 'Failed to update rep availability' });
    }
  });

  // ==================== Lead Assignment History ====================

  // Get assignment history for a lead
  app.get('/api/lead-assignment-history/:leadId', async (req, res) => {
    try {
      const { leadId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const history = await db.query.leadAssignmentHistory.findMany({
        where: and(
          eq(leadAssignmentHistory.leadId, leadId),
          eq(leadAssignmentHistory.tenantId, tenantId),
        ),
        orderBy: [desc(leadAssignmentHistory.assignedAt)],
      });

      res.json(history);
    } catch (error) {
      log.error('Error fetching assignment history:', error);
      res.status(500).json({ error: 'Failed to fetch assignment history' });
    }
  });

  // Get assignments for a user
  app.get('/api/user-assignments/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const assignments = await db.query.leadAssignmentHistory.findMany({
        where: and(
          eq(leadAssignmentHistory.assignedTo, userId),
          eq(leadAssignmentHistory.tenantId, tenantId),
        ),
        orderBy: [desc(leadAssignmentHistory.assignedAt)],
        limit: 100,
      });

      res.json(assignments);
    } catch (error) {
      log.error('Error fetching user assignments:', error);
      res.status(500).json({ error: 'Failed to fetch user assignments' });
    }
  });

  // Record assignment
  app.post('/api/lead-assignment-history', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const assignmentData: InsertLeadAssignmentHistory = {
        ...req.body,
        tenantId,
      };

      const [newAssignment] = await db
        .insert(leadAssignmentHistory)
        .values(assignmentData)
        .returning();

      res.status(201).json(newAssignment);
    } catch (error) {
      log.error('Error recording assignment:', error);
      res.status(500).json({ error: 'Failed to record assignment' });
    }
  });

  // ==================== Lead Assignment Queue ====================

  // Get queued assignments
  app.get('/api/lead-assignment-queue', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { status } = req.query;

      let query = db.query.leadAssignmentQueue.findMany({
        where: eq(leadAssignmentQueue.tenantId, tenantId),
        orderBy: [desc(leadAssignmentQueue.priority), asc(leadAssignmentQueue.scheduleFor)],
      });

      if (status) {
        query = db.query.leadAssignmentQueue.findMany({
          where: and(
            eq(leadAssignmentQueue.tenantId, tenantId),
            eq(leadAssignmentQueue.status, status as string),
          ),
          orderBy: [desc(leadAssignmentQueue.priority), asc(leadAssignmentQueue.scheduleFor)],
        });
      }

      const queue = await query;
      res.json(queue);
    } catch (error) {
      log.error('Error fetching assignment queue:', error);
      res.status(500).json({ error: 'Failed to fetch assignment queue' });
    }
  });

  // Add to assignment queue
  app.post('/api/lead-assignment-queue', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const queueData: InsertLeadAssignmentQueue = {
        ...req.body,
        tenantId,
      };

      const [newQueueItem] = await db.insert(leadAssignmentQueue).values(queueData).returning();

      res.status(201).json(newQueueItem);
    } catch (error) {
      log.error('Error adding to assignment queue:', error);
      res.status(500).json({ error: 'Failed to add to assignment queue' });
    }
  });

  // Process assignment from queue
  app.post('/api/lead-assignment-queue/:id/process', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [processed] = await db
        .update(leadAssignmentQueue)
        .set({
          status: 'processing',
          processedAt: new Date(),
        })
        .where(and(eq(leadAssignmentQueue.id, id), eq(leadAssignmentQueue.tenantId, tenantId)))
        .returning();

      if (!processed) {
        return res.status(404).json({ error: 'Queue item not found' });
      }

      // Here you would trigger the actual assignment logic
      // For now, we'll just mark it as processed

      res.json(processed);
    } catch (error) {
      log.error('Error processing assignment:', error);
      res.status(500).json({ error: 'Failed to process assignment' });
    }
  });

  // ==================== Lead Assignment Engine ====================

  // Assign lead based on rules
  app.post('/api/assign-lead', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const { leadId, leadData, assignedBy } = req.body;

      // Get active assignment rules ordered by priority
      const rules = await db.query.leadAssignmentRules.findMany({
        where: and(
          eq(leadAssignmentRules.tenantId, tenantId),
          eq(leadAssignmentRules.isActive, true),
        ),
        orderBy: [desc(leadAssignmentRules.priority)],
      });

      // Find matching rule
      let matchedRule = null;
      for (const rule of rules) {
        if (matchesRule(leadData, rule)) {
          matchedRule = rule;
          break;
        }
      }

      if (!matchedRule) {
        return res.status(400).json({ error: 'No matching assignment rule found' });
      }

      let assignedTo = null;

      // Determine assignment based on rule type
      switch (matchedRule.assignmentType) {
        case 'round_robin':
          if (matchedRule.roundRobinConfig) {
            const config = matchedRule.roundRobinConfig as any;
            assignedTo = config.userIds[config.currentIndex % config.userIds.length];

            // Update round robin index
            await db
              .update(leadAssignmentRules)
              .set({
                roundRobinConfig: {
                  ...config,
                  currentIndex: config.currentIndex + 1,
                },
              })
              .where(eq(leadAssignmentRules.id, matchedRule.id));
          }
          break;

        case 'territory':
          if (matchedRule.territoryId) {
            const territory = await db.query.salesTerritories.findFirst({
              where: eq(salesTerritories.id, matchedRule.territoryId),
            });
            assignedTo = territory?.ownerId;
          }
          break;

        default:
          assignedTo = matchedRule.assignToUserId;
      }

      if (!assignedTo) {
        return res.status(400).json({ error: 'Could not determine assignment target' });
      }

      // Record assignment
      const [assignment] = await db
        .insert(leadAssignmentHistory)
        .values({
          tenantId,
          leadId,
          assignedTo,
          assignmentReason: matchedRule.assignmentType,
          ruleId: matchedRule.id,
          assignedBy: assignedBy || 'system',
        })
        .returning();

      // Update rule stats
      await db
        .update(leadAssignmentRules)
        .set({
          assignmentsCount: sql`${leadAssignmentRules.assignmentsCount} + 1`,
          lastAssignedAt: new Date(),
        })
        .where(eq(leadAssignmentRules.id, matchedRule.id));

      res.json({
        success: true,
        assignment,
        assignedTo,
        ruleUsed: matchedRule.ruleName,
      });
    } catch (error) {
      log.error('Error assigning lead:', error);
      res.status(500).json({ error: 'Failed to assign lead' });
    }
  });
}

// Helper function to check if lead matches rule criteria
function matchesRule(leadData: any, rule: any): boolean {
  const criteria = rule.criteria;

  // Check lead source
  if (criteria.leadSource && criteria.leadSource.length > 0) {
    if (!criteria.leadSource.includes(leadData.source)) {
      return false;
    }
  }

  // Check lead score
  if (criteria.leadScore) {
    if (criteria.leadScore.min && leadData.score < criteria.leadScore.min) {
      return false;
    }
    if (criteria.leadScore.max && leadData.score > criteria.leadScore.max) {
      return false;
    }
  }

  // Check industry
  if (criteria.industry && criteria.industry.length > 0) {
    if (!criteria.industry.includes(leadData.industry)) {
      return false;
    }
  }

  // Check company size
  if (criteria.companySize) {
    if (criteria.companySize.min && leadData.companySize < criteria.companySize.min) {
      return false;
    }
    if (criteria.companySize.max && leadData.companySize > criteria.companySize.max) {
      return false;
    }
  }

  // Check deal size
  if (criteria.dealSize) {
    if (criteria.dealSize.min && leadData.dealSize < criteria.dealSize.min) {
      return false;
    }
    if (criteria.dealSize.max && leadData.dealSize > criteria.dealSize.max) {
      return false;
    }
  }

  // Check geography
  if (criteria.geography) {
    if (criteria.geography.states && criteria.geography.states.length > 0) {
      if (!criteria.geography.states.includes(leadData.state)) {
        return false;
      }
    }
    if (criteria.geography.countries && criteria.geography.countries.length > 0) {
      if (!criteria.geography.countries.includes(leadData.country)) {
        return false;
      }
    }
  }

  // Check product interest
  if (criteria.productInterest && criteria.productInterest.length > 0) {
    if (
      !leadData.productInterest ||
      !criteria.productInterest.some((p: string) => leadData.productInterest.includes(p))
    ) {
      return false;
    }
  }

  return true;
}
