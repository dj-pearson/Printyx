/**
 * Sales Rep Assignment Management Routes
 *
 * Endpoints for viewing, managing, and manipulating sales rep assignments
 * including territory-based assignment, bulk operations, and history tracking.
 */

import type { Express } from 'express';
import { db } from './db';
import { businessRecords, users } from '@shared/schema';
import { leadAssignmentHistory, salesTerritories } from '@shared/lead-assignment-schema';
import { eq, and, desc, asc, sql, inArray, ilike, or, isNull, count } from 'drizzle-orm';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { z } from 'zod';

export function registerSalesRepAssignmentRoutes(app: Express) {
  // ==================== GET REPS WITH ACCOUNT COUNTS ====================

  app.get('/api/sales-rep-assignments/reps', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      // Get all active users in this tenant (potential sales reps)
      const tenantUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          teamId: users.teamId,
          profileImageUrl: users.profileImageUrl,
        })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

      // Get account counts per rep
      const accountCounts = await db
        .select({
          repId: businessRecords.ownerId,
          count: count(),
        })
        .from(businessRecords)
        .where(
          and(eq(businessRecords.tenantId, tenantId), sql`${businessRecords.ownerId} IS NOT NULL`),
        )
        .groupBy(businessRecords.ownerId);

      const countMap = new Map(accountCounts.map((r) => [r.repId, Number(r.count)]));

      // Get unassigned count
      const [unassignedResult] = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(and(eq(businessRecords.tenantId, tenantId), isNull(businessRecords.ownerId)));

      // Get territories per rep
      const territories = await db
        .select({
          ownerId: salesTerritories.ownerId,
          territoryName: salesTerritories.territoryName,
          territoryId: salesTerritories.id,
        })
        .from(salesTerritories)
        .where(and(eq(salesTerritories.tenantId, tenantId), eq(salesTerritories.isActive, true)));

      const territoryMap = new Map<string, Array<{ id: string; name: string }>>();
      for (const t of territories) {
        if (t.ownerId) {
          const existing = territoryMap.get(t.ownerId) || [];
          existing.push({ id: t.territoryId, name: t.territoryName });
          territoryMap.set(t.ownerId, existing);
        }
      }

      const reps = tenantUsers.map((user) => ({
        ...user,
        accountCount: countMap.get(user.id) || 0,
        territories: territoryMap.get(user.id) || [],
      }));

      const totalAccounts =
        accountCounts.reduce((sum, r) => sum + Number(r.count), 0) + Number(unassignedResult.count);

      res.json({
        reps,
        summary: {
          totalReps: tenantUsers.length,
          totalAccounts,
          unassignedCount: Number(unassignedResult.count),
          avgPerRep: tenantUsers.length > 0 ? Math.round(totalAccounts / tenantUsers.length) : 0,
        },
      });
    } catch (error) {
      console.error('Error fetching sales reps:', error);
      res.status(500).json({ message: 'Failed to fetch sales reps' });
    }
  });

  // ==================== GET ACCOUNTS FOR A SPECIFIC REP ====================

  app.get('/api/sales-rep-assignments/reps/:repId/accounts', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      const { repId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = (page - 1) * limit;

      const whereCondition = and(
        eq(businessRecords.tenantId, tenantId),
        eq(businessRecords.ownerId, repId),
      );

      const [totalResult] = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(whereCondition);

      const accounts = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          recordType: businessRecords.recordType,
          status: businessRecords.status,
          phone: businessRecords.phone,
          billingCity: businessRecords.billingCity,
          billingState: businessRecords.billingState,
          billingPostalCode: businessRecords.billingPostalCode,
          territory: businessRecords.territory,
          ownerId: businessRecords.ownerId,
          assignedSalesRep: businessRecords.assignedSalesRep,
          estimatedAmount: businessRecords.estimatedAmount,
          createdAt: businessRecords.createdAt,
        })
        .from(businessRecords)
        .where(whereCondition)
        .orderBy(asc(businessRecords.companyName))
        .limit(limit)
        .offset(offset);

      res.json({
        accounts,
        pagination: {
          page,
          limit,
          total: Number(totalResult.count),
          totalPages: Math.ceil(Number(totalResult.count) / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching rep accounts:', error);
      res.status(500).json({ message: 'Failed to fetch rep accounts' });
    }
  });

  // ==================== GET ALL ACCOUNTS WITH ASSIGNMENT INFO ====================

  app.get('/api/sales-rep-assignments/accounts', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      const repFilter = req.query.repId as string;
      const statusFilter = req.query.status as string;
      const assignedOnly = req.query.assigned === 'true';
      const unassignedOnly = req.query.unassigned === 'true';

      const conditions = [eq(businessRecords.tenantId, tenantId)];

      if (repFilter) {
        conditions.push(eq(businessRecords.ownerId, repFilter));
      }
      if (statusFilter) {
        conditions.push(eq(businessRecords.status, statusFilter));
      }
      if (assignedOnly) {
        conditions.push(sql`${businessRecords.ownerId} IS NOT NULL`);
      }
      if (unassignedOnly) {
        conditions.push(isNull(businessRecords.ownerId));
      }

      const accounts = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          recordType: businessRecords.recordType,
          status: businessRecords.status,
          billingCity: businessRecords.billingCity,
          billingState: businessRecords.billingState,
          billingPostalCode: businessRecords.billingPostalCode,
          territory: businessRecords.territory,
          ownerId: businessRecords.ownerId,
          assignedSalesRep: businessRecords.assignedSalesRep,
        })
        .from(businessRecords)
        .where(and(...conditions))
        .orderBy(asc(businessRecords.companyName))
        .limit(2000);

      res.json(accounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ message: 'Failed to fetch accounts' });
    }
  });

  // ==================== GET UNASSIGNED ACCOUNTS ====================

  app.get('/api/sales-rep-assignments/unassigned', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = (page - 1) * limit;

      const whereCondition = and(
        eq(businessRecords.tenantId, tenantId),
        isNull(businessRecords.ownerId),
      );

      const [totalResult] = await db
        .select({ count: count() })
        .from(businessRecords)
        .where(whereCondition);

      const accounts = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          recordType: businessRecords.recordType,
          status: businessRecords.status,
          phone: businessRecords.phone,
          billingCity: businessRecords.billingCity,
          billingState: businessRecords.billingState,
          billingPostalCode: businessRecords.billingPostalCode,
          territory: businessRecords.territory,
          createdAt: businessRecords.createdAt,
        })
        .from(businessRecords)
        .where(whereCondition)
        .orderBy(desc(businessRecords.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({
        accounts,
        pagination: {
          page,
          limit,
          total: Number(totalResult.count),
          totalPages: Math.ceil(Number(totalResult.count) / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching unassigned accounts:', error);
      res.status(500).json({ message: 'Failed to fetch unassigned accounts' });
    }
  });

  // ==================== ZIP CODE SUMMARY ====================

  app.get('/api/sales-rep-assignments/zip-summary', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      const zipSummary = await db
        .select({
          zip: businessRecords.billingPostalCode,
          count: count(),
        })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            sql`${businessRecords.billingPostalCode} IS NOT NULL AND ${businessRecords.billingPostalCode} != ''`,
          ),
        )
        .groupBy(businessRecords.billingPostalCode)
        .orderBy(desc(count()));

      res.json(zipSummary);
    } catch (error) {
      console.error('Error fetching zip summary:', error);
      res.status(500).json({ message: 'Failed to fetch zip summary' });
    }
  });

  // ==================== ASSIGNMENT HISTORY ====================

  app.get('/api/sales-rep-assignments/history', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = (page - 1) * limit;
      const repFilter = req.query.repId as string;

      const conditions = [eq(leadAssignmentHistory.tenantId, tenantId)];
      if (repFilter) {
        conditions.push(
          or(
            eq(leadAssignmentHistory.assignedFrom, repFilter),
            eq(leadAssignmentHistory.assignedTo, repFilter),
          )!,
        );
      }

      const [totalResult] = await db
        .select({ count: count() })
        .from(leadAssignmentHistory)
        .where(and(...conditions));

      const history = await db
        .select()
        .from(leadAssignmentHistory)
        .where(and(...conditions))
        .orderBy(desc(leadAssignmentHistory.assignedAt))
        .limit(limit)
        .offset(offset);

      // Enrich with user and account names
      const userIds = new Set<string>();
      const accountIds = new Set<string>();
      for (const h of history) {
        if (h.assignedFrom) userIds.add(h.assignedFrom);
        if (h.assignedTo) userIds.add(h.assignedTo);
        if (h.assignedBy) userIds.add(h.assignedBy);
        if (h.leadId) accountIds.add(h.leadId);
      }

      const userList =
        userIds.size > 0
          ? await db
              .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
              .from(users)
              .where(inArray(users.id, Array.from(userIds)))
          : [];
      const userMap = new Map(
        userList.map((u) => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim()]),
      );

      const accountList =
        accountIds.size > 0
          ? await db
              .select({ id: businessRecords.id, companyName: businessRecords.companyName })
              .from(businessRecords)
              .where(inArray(businessRecords.id, Array.from(accountIds)))
          : [];
      const accountMap = new Map(accountList.map((a) => [a.id, a.companyName]));

      const enrichedHistory = history.map((h) => ({
        ...h,
        assignedFromName: h.assignedFrom ? userMap.get(h.assignedFrom) || 'Unknown' : null,
        assignedToName: userMap.get(h.assignedTo) || 'Unknown',
        assignedByName: h.assignedBy ? userMap.get(h.assignedBy) || 'System' : 'System',
        accountName: accountMap.get(h.leadId) || 'Unknown',
      }));

      res.json({
        history: enrichedHistory,
        pagination: {
          page,
          limit,
          total: Number(totalResult.count),
          totalPages: Math.ceil(Number(totalResult.count) / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching assignment history:', error);
      res.status(500).json({ message: 'Failed to fetch assignment history' });
    }
  });

  // ==================== ASSIGN / REASSIGN SINGLE ACCOUNT ====================

  const assignSchema = z.object({
    accountId: z.string().min(1),
    newRepId: z.string().min(1),
    reason: z.string().optional(),
  });

  app.post('/api/sales-rep-assignments/assign', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      }

      const { accountId, newRepId, reason } = parsed.data;

      // Get current account
      const account = await db.query.businessRecords.findFirst({
        where: and(eq(businessRecords.id, accountId), eq(businessRecords.tenantId, tenantId)),
      });

      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }

      const previousOwnerId = account.ownerId;

      // Update the account
      await db
        .update(businessRecords)
        .set({
          ownerId: newRepId,
          assignedSalesRep: newRepId,
          updatedAt: new Date(),
        })
        .where(and(eq(businessRecords.id, accountId), eq(businessRecords.tenantId, tenantId)));

      // Write history
      await db.insert(leadAssignmentHistory).values({
        tenantId,
        leadId: accountId,
        assignedFrom: previousOwnerId || undefined,
        assignedTo: newRepId,
        assignmentReason: reason || 'manual_override',
        assignedBy: userId || 'system',
        assignmentNotes: reason || null,
      });

      res.json({ success: true, accountId, newRepId, previousRepId: previousOwnerId });
    } catch (error) {
      console.error('Error assigning account:', error);
      res.status(500).json({ message: 'Failed to assign account' });
    }
  });

  // ==================== BULK ASSIGN ====================

  const bulkAssignSchema = z.object({
    accountIds: z.array(z.string().min(1)).min(1),
    newRepId: z.string().min(1),
    reason: z.string().optional(),
  });

  app.post('/api/sales-rep-assignments/bulk-assign', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      const parsed = bulkAssignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      }

      const { accountIds, newRepId, reason } = parsed.data;

      // Get current accounts
      const accounts = await db
        .select({ id: businessRecords.id, ownerId: businessRecords.ownerId })
        .from(businessRecords)
        .where(
          and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, accountIds)),
        );

      // Bulk update
      await db
        .update(businessRecords)
        .set({
          ownerId: newRepId,
          assignedSalesRep: newRepId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(businessRecords.tenantId, tenantId), inArray(businessRecords.id, accountIds)),
        );

      // Write history for each
      const historyEntries = accounts.map((account) => ({
        tenantId,
        leadId: account.id,
        assignedFrom: account.ownerId || undefined,
        assignedTo: newRepId,
        assignmentReason: reason || 'bulk_reassignment',
        assignedBy: userId || 'system',
        assignmentNotes: reason || `Bulk reassignment of ${accountIds.length} accounts`,
      }));

      if (historyEntries.length > 0) {
        await db.insert(leadAssignmentHistory).values(historyEntries);
      }

      res.json({ success: true, assignedCount: accounts.length, newRepId });
    } catch (error) {
      console.error('Error bulk assigning accounts:', error);
      res.status(500).json({ message: 'Failed to bulk assign accounts' });
    }
  });

  // ==================== ASSIGN BY AREA ====================

  const assignByAreaSchema = z.object({
    repId: z.string().min(1),
    method: z.enum(['zip', 'state', 'city']),
    values: z.array(z.string().min(1)).min(1),
    onlyUnassigned: z.boolean().default(true),
  });

  app.post('/api/sales-rep-assignments/assign-by-area', requireAuth, async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      const parsed = assignByAreaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request', errors: parsed.error.errors });
      }

      const { repId, method, values, onlyUnassigned } = parsed.data;

      // Build area condition
      let areaCondition;
      switch (method) {
        case 'zip':
          areaCondition = inArray(businessRecords.billingPostalCode, values);
          break;
        case 'state':
          areaCondition = inArray(businessRecords.billingState, values);
          break;
        case 'city':
          areaCondition = or(...values.map((v) => ilike(businessRecords.billingCity, v)));
          break;
      }

      const conditions = [eq(businessRecords.tenantId, tenantId), areaCondition!];

      if (onlyUnassigned) {
        conditions.push(isNull(businessRecords.ownerId));
      }

      // Preview: get count
      if (req.query.preview === 'true') {
        const [result] = await db
          .select({ count: count() })
          .from(businessRecords)
          .where(and(...conditions));

        return res.json({ previewCount: Number(result.count) });
      }

      // Get affected accounts for history
      const affectedAccounts = await db
        .select({ id: businessRecords.id, ownerId: businessRecords.ownerId })
        .from(businessRecords)
        .where(and(...conditions));

      // Execute assignment
      await db
        .update(businessRecords)
        .set({
          ownerId: repId,
          assignedSalesRep: repId,
          updatedAt: new Date(),
        })
        .where(and(...conditions));

      // Write history
      const historyEntries = affectedAccounts.map((account) => ({
        tenantId,
        leadId: account.id,
        assignedFrom: account.ownerId || undefined,
        assignedTo: repId,
        assignmentReason: 'territory_change',
        assignedBy: userId || 'system',
        assignmentNotes: `Area assignment by ${method}: ${values.join(', ')}`,
      }));

      if (historyEntries.length > 0) {
        await db.insert(leadAssignmentHistory).values(historyEntries);
      }

      res.json({
        success: true,
        assignedCount: affectedAccounts.length,
        repId,
        method,
        values,
      });
    } catch (error) {
      console.error('Error assigning by area:', error);
      res.status(500).json({ message: 'Failed to assign by area' });
    }
  });
}
