import type { Express } from "express";
import { db } from './db';
import {
  contractRenewals,
  renewalActivities,
  renewalPlaybooks,
  expansionOpportunities,
  type InsertContractRenewal,
  type InsertRenewalActivity,
  type InsertRenewalPlaybook,
  type InsertExpansionOpportunity,
} from "@shared/schema";
import { eq, and, desc, asc, sql, lt, gte, lte, or } from "drizzle-orm";

export function registerRenewalManagementRoutes(app: Express) {
  // ==================== Contract Renewals ====================

  // Get all renewals
  app.get("/api/contract-renewals", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const { status, riskLevel, ownerId, daysUntilRenewal } = req.query;

      let conditions = [eq(contractRenewals.tenantId, tenantId)];

      if (status) {
        conditions.push(eq(contractRenewals.renewalStatus, status as string));
      }
      if (riskLevel) {
        conditions.push(eq(contractRenewals.renewalRiskLevel, riskLevel as string));
      }
      if (ownerId) {
        conditions.push(eq(contractRenewals.renewalOwnerId, ownerId as string));
      }
      if (daysUntilRenewal) {
        const days = parseInt(daysUntilRenewal as string);
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);
        conditions.push(lte(contractRenewals.contractEndDate, targetDate));
        conditions.push(gte(contractRenewals.contractEndDate, new Date()));
      }

      const renewals = await db.query.contractRenewals.findMany({
        where: and(...conditions),
        orderBy: [asc(contractRenewals.contractEndDate)],
      });

      res.json(renewals);
    } catch (error) {
      console.error("Error fetching renewals:", error);
      res.status(500).json({ error: "Failed to fetch renewals" });
    }
  });

  // Get single renewal
  app.get("/api/contract-renewals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const renewal = await db.query.contractRenewals.findFirst({
        where: and(
          eq(contractRenewals.id, id),
          eq(contractRenewals.tenantId, tenantId)
        ),
      });

      if (!renewal) {
        return res.status(404).json({ error: "Renewal not found" });
      }

      // Get activities
      const activities = await db.query.renewalActivities.findMany({
        where: eq(renewalActivities.renewalId, id),
        orderBy: [desc(renewalActivities.activityDate)],
      });

      res.json({ ...renewal, activities });
    } catch (error) {
      console.error("Error fetching renewal:", error);
      res.status(500).json({ error: "Failed to fetch renewal" });
    }
  });

  // Create renewal
  app.post("/api/contract-renewals", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const renewalData: InsertContractRenewal = {
        ...req.body,
        tenantId,
      };

      // Calculate risk score if not provided
      if (!renewalData.renewalRiskScore) {
        renewalData.renewalRiskScore = calculateRenewalRiskScore(renewalData);
        renewalData.renewalRiskLevel = getRiskLevel(renewalData.renewalRiskScore);
      }

      const [newRenewal] = await db.insert(contractRenewals)
        .values(renewalData)
        .returning();

      res.status(201).json(newRenewal);
    } catch (error) {
      console.error("Error creating renewal:", error);
      res.status(500).json({ error: "Failed to create renewal" });
    }
  });

  // Update renewal
  app.put("/api/contract-renewals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [updated] = await db.update(contractRenewals)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(
          eq(contractRenewals.id, id),
          eq(contractRenewals.tenantId, tenantId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Renewal not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating renewal:", error);
      res.status(500).json({ error: "Failed to update renewal" });
    }
  });

  // Mark renewal as won
  app.post("/api/contract-renewals/:id/won", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const { renewalWonReason, proposedMrr, proposedArr, proposedContractValue } = req.body;

      const [updated] = await db.update(contractRenewals)
        .set({
          renewalStatus: 'won',
          renewalClosedDate: new Date(),
          renewalWonReason,
          proposedMrr,
          proposedArr,
          proposedContractValue,
          updatedAt: new Date(),
        })
        .where(and(
          eq(contractRenewals.id, id),
          eq(contractRenewals.tenantId, tenantId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Renewal not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error marking renewal as won:", error);
      res.status(500).json({ error: "Failed to mark renewal as won" });
    }
  });

  // Mark renewal as lost
  app.post("/api/contract-renewals/:id/lost", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const { renewalLostReason, churnedToCompetitor } = req.body;

      const [updated] = await db.update(contractRenewals)
        .set({
          renewalStatus: 'lost',
          renewalClosedDate: new Date(),
          renewalLostReason,
          churnedToCompetitor,
          updatedAt: new Date(),
        })
        .where(and(
          eq(contractRenewals.id, id),
          eq(contractRenewals.tenantId, tenantId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Renewal not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error marking renewal as lost:", error);
      res.status(500).json({ error: "Failed to mark renewal as lost" });
    }
  });

  // Get renewals needing attention (upcoming + at risk)
  app.get("/api/contract-renewals/alerts/attention-needed", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      // Get renewals in next 90 days or high risk
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      const renewalsNeedingAttention = await db.query.contractRenewals.findMany({
        where: and(
          eq(contractRenewals.tenantId, tenantId),
          eq(contractRenewals.renewalStatus, 'pending'),
          or(
            lte(contractRenewals.contractEndDate, ninetyDaysFromNow),
            eq(contractRenewals.renewalRiskLevel, 'high'),
            eq(contractRenewals.renewalRiskLevel, 'critical')
          )
        ),
        orderBy: [asc(contractRenewals.contractEndDate)],
      });

      res.json(renewalsNeedingAttention);
    } catch (error) {
      console.error("Error fetching renewals needing attention:", error);
      res.status(500).json({ error: "Failed to fetch renewals needing attention" });
    }
  });

  // Recalculate renewal risk
  app.post("/api/contract-renewals/:id/recalculate-risk", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const renewal = await db.query.contractRenewals.findFirst({
        where: and(
          eq(contractRenewals.id, id),
          eq(contractRenewals.tenantId, tenantId)
        ),
      });

      if (!renewal) {
        return res.status(404).json({ error: "Renewal not found" });
      }

      const renewalRiskScore = calculateRenewalRiskScore(renewal);
      const renewalRiskLevel = getRiskLevel(renewalRiskScore);

      const [updated] = await db.update(contractRenewals)
        .set({
          renewalRiskScore,
          renewalRiskLevel,
          updatedAt: new Date(),
        })
        .where(eq(contractRenewals.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error recalculating risk:", error);
      res.status(500).json({ error: "Failed to recalculate risk" });
    }
  });

  // ==================== Renewal Activities ====================

  // Get activities for renewal
  app.get("/api/renewal-activities", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { renewalId } = req.query;

      if (!renewalId) {
        return res.status(400).json({ error: "Renewal ID required" });
      }

      const activities = await db.query.renewalActivities.findMany({
        where: and(
          eq(renewalActivities.renewalId, renewalId as string),
          eq(renewalActivities.tenantId, tenantId)
        ),
        orderBy: [desc(renewalActivities.activityDate)],
      });

      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // Create renewal activity
  app.post("/api/renewal-activities", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const activityData: InsertRenewalActivity = {
        ...req.body,
        tenantId,
      };

      const [newActivity] = await db.insert(renewalActivities)
        .values(activityData)
        .returning();

      // Update renewal's last contact date
      await db.update(contractRenewals)
        .set({
          lastContactDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contractRenewals.id, activityData.renewalId));

      res.status(201).json(newActivity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  // ==================== Renewal Playbooks ====================

  // Get playbooks
  app.get("/api/renewal-playbooks", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const playbooks = await db.query.renewalPlaybooks.findMany({
        where: eq(renewalPlaybooks.tenantId, tenantId),
        orderBy: [desc(renewalPlaybooks.isDefault), desc(renewalPlaybooks.successRate)],
      });

      res.json(playbooks);
    } catch (error) {
      console.error("Error fetching playbooks:", error);
      res.status(500).json({ error: "Failed to fetch playbooks" });
    }
  });

  // Create playbook
  app.post("/api/renewal-playbooks", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const playbookData: InsertRenewalPlaybook = {
        ...req.body,
        tenantId,
      };

      const [newPlaybook] = await db.insert(renewalPlaybooks)
        .values(playbookData)
        .returning();

      res.status(201).json(newPlaybook);
    } catch (error) {
      console.error("Error creating playbook:", error);
      res.status(500).json({ error: "Failed to create playbook" });
    }
  });

  // Update playbook
  app.put("/api/renewal-playbooks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [updated] = await db.update(renewalPlaybooks)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(
          eq(renewalPlaybooks.id, id),
          eq(renewalPlaybooks.tenantId, tenantId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Playbook not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating playbook:", error);
      res.status(500).json({ error: "Failed to update playbook" });
    }
  });

  // Get recommended playbook for renewal
  app.get("/api/renewal-playbooks/recommend/:renewalId", async (req, res) => {
    try {
      const { renewalId } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const renewal = await db.query.contractRenewals.findFirst({
        where: and(
          eq(contractRenewals.id, renewalId),
          eq(contractRenewals.tenantId, tenantId)
        ),
      });

      if (!renewal) {
        return res.status(404).json({ error: "Renewal not found" });
      }

      // Get all active playbooks
      const playbooks = await db.query.renewalPlaybooks.findMany({
        where: and(
          eq(renewalPlaybooks.tenantId, tenantId),
          eq(renewalPlaybooks.isActive, true)
        ),
      });

      // Find matching playbook based on trigger conditions
      const matchingPlaybook = playbooks.find(playbook => {
        const conditions = playbook.triggerConditions as any;
        if (!conditions) return false;

        // Calculate days until renewal
        const daysUntilRenewal = Math.ceil(
          (new Date(renewal.contractEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        // Check conditions
        if (conditions.daysBeforeRenewal && daysUntilRenewal > conditions.daysBeforeRenewal) {
          return false;
        }
        if (conditions.contractValueMin && Number(renewal.currentContractValue) < conditions.contractValueMin) {
          return false;
        }
        if (conditions.contractValueMax && Number(renewal.currentContractValue) > conditions.contractValueMax) {
          return false;
        }
        if (conditions.riskLevel && !conditions.riskLevel.includes(renewal.renewalRiskLevel)) {
          return false;
        }

        return true;
      });

      res.json(matchingPlaybook || null);
    } catch (error) {
      console.error("Error recommending playbook:", error);
      res.status(500).json({ error: "Failed to recommend playbook" });
    }
  });

  // ==================== Expansion Opportunities ====================

  // Get expansion opportunities
  app.get("/api/expansion-opportunities", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const { customerId, status, ownerId } = req.query;

      let conditions = [eq(expansionOpportunities.tenantId, tenantId)];

      if (customerId) {
        conditions.push(eq(expansionOpportunities.customerId, customerId as string));
      }
      if (status) {
        conditions.push(eq(expansionOpportunities.status, status as string));
      }
      if (ownerId) {
        conditions.push(eq(expansionOpportunities.ownerId, ownerId as string));
      }

      const opportunities = await db.query.expansionOpportunities.findMany({
        where: and(...conditions),
        orderBy: [desc(expansionOpportunities.identifiedAt)],
      });

      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching expansion opportunities:", error);
      res.status(500).json({ error: "Failed to fetch expansion opportunities" });
    }
  });

  // Create expansion opportunity
  app.post("/api/expansion-opportunities", async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID required" });
      }

      const opportunityData: InsertExpansionOpportunity = {
        ...req.body,
        tenantId,
      };

      const [newOpportunity] = await db.insert(expansionOpportunities)
        .values(opportunityData)
        .returning();

      res.status(201).json(newOpportunity);
    } catch (error) {
      console.error("Error creating expansion opportunity:", error);
      res.status(500).json({ error: "Failed to create expansion opportunity" });
    }
  });

  // Update expansion opportunity
  app.put("/api/expansion-opportunities/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      const [updated] = await db.update(expansionOpportunities)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(
          eq(expansionOpportunities.id, id),
          eq(expansionOpportunities.tenantId, tenantId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating expansion opportunity:", error);
      res.status(500).json({ error: "Failed to update expansion opportunity" });
    }
  });

  // Mark expansion opportunity as won
  app.post("/api/expansion-opportunities/:id/won", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const { actualRevenue, outcomeNotes } = req.body;

      const [updated] = await db.update(expansionOpportunities)
        .set({
          status: 'won',
          closedAt: new Date(),
          actualRevenue,
          outcomeNotes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(expansionOpportunities.id, id),
          eq(expansionOpportunities.tenantId, tenantId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Opportunity not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error marking opportunity as won:", error);
      res.status(500).json({ error: "Failed to mark opportunity as won" });
    }
  });
}

// Helper functions

function calculateRenewalRiskScore(renewal: any): number {
  let riskScore = 50; // Base score

  // Factor in churn probability
  if (renewal.churnProbability) {
    riskScore += Number(renewal.churnProbability) * 50;
  }

  // Factor in payment health
  if (renewal.overdueInvoicesCount && renewal.overdueInvoicesCount > 0) {
    riskScore += Math.min(renewal.overdueInvoicesCount * 10, 30);
  }

  // Factor in engagement
  if (renewal.daysSinceLastService) {
    if (renewal.daysSinceLastService > 180) {
      riskScore += 20;
    } else if (renewal.daysSinceLastService > 90) {
      riskScore += 10;
    }
  }

  // Factor in open tickets
  if (renewal.openTicketsCount && renewal.openTicketsCount > 3) {
    riskScore += Math.min(renewal.openTicketsCount * 5, 20);
  }

  // Cap at 100
  return Math.min(Math.round(riskScore), 100);
}

function getRiskLevel(riskScore: number): string {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 40) return 'medium';
  return 'low';
}
