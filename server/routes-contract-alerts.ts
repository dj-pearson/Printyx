import express from 'express';
import { desc, eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { contracts, serviceContracts, businessRecords } from '../shared/schema';
import { renewalOpportunities, churnPredictions } from '../shared/customer-success-schema';
import { contractRenewalWorkflow } from './services/contract-renewal-workflow';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-contract-alerts');

// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

import { getUserId, getTenantId } from './utils/auth-helpers';
const router = express.Router();

// NOTE: Do NOT apply enhanceUserContext globally here because this router is registered
// without a path prefix (app.use(contractAlertsRoutes)), so it would run on ALL requests
// including non-API routes like /login, blocking Vite from serving the frontend.
// Each route already has requirePermission which handles RBAC properly.

// Get contract expiration alerts for the alert bell and renewal management - requires customer view permission
router.get(
  '/api/alerts/contract-expirations',

  requirePermission([PERMISSIONS.SALES.CUSTOMER.VIEW_OWN, PERMISSIONS.SALES.CUSTOMER.VIEW_TEAM]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { daysAhead = 180 } = req.query; // Default to 180 days ahead

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Missing tenant context',
        });
      }

      // Get service contracts expiring in the specified timeframe
      const expiringServiceContracts = await db
        .select({
          contractId: serviceContracts.id,
          contractNumber: serviceContracts.contractNumber,
          customerId: serviceContracts.customerId,
          customerName: businessRecords.companyName,
          startDate: serviceContracts.startDate,
          endDate: serviceContracts.endDate,
          daysUntilExpiration:
            sql`DATE_PART('day', ${serviceContracts.endDate}::timestamp - NOW())`.as('days'),
          monthlyValue: serviceContracts.monthlyBaseRate,
          annualValue: sql`COALESCE(${serviceContracts.monthlyBaseRate}, 0) * 12`.as('annualValue'),
          contractType: serviceContracts.contractType,
          status: serviceContracts.contractStatus,
          includesToner: serviceContracts.includesToner,
          includesParts: serviceContracts.includesParts,
          includesLabor: serviceContracts.includesLabor,
        })
        .from(serviceContracts)
        .leftJoin(businessRecords, eq(serviceContracts.customerId, businessRecords.id))
        .where(
          and(
            eq(serviceContracts.tenantId, tenantId),
            eq(serviceContracts.contractStatus, 'active'),
            lte(
              serviceContracts.endDate,
              sql`NOW() + INTERVAL '${sql.raw(String(daysAhead))} days'`,
            ),
            gte(serviceContracts.endDate, sql`NOW()`),
          ),
        )
        .orderBy(asc(serviceContracts.endDate));

      // Get general contracts expiring
      const expiringContracts = await db
        .select({
          contractId: contracts.id,
          contractNumber: contracts.contractNumber,
          customerId: contracts.customerId,
          customerName: businessRecords.companyName,
          startDate: contracts.startDate,
          endDate: contracts.endDate,
          daysUntilExpiration: sql`DATE_PART('day', ${contracts.endDate}::timestamp - NOW())`.as(
            'days',
          ),
          monthlyValue: sql`0`.as('monthlyValue'), // contracts table doesn't have monthly value
          annualValue: sql`0`.as('annualValue'),
          contractType: contracts.contractType,
          status: contracts.status,
        })
        .from(contracts)
        .leftJoin(businessRecords, eq(contracts.customerId, businessRecords.id))
        .where(
          and(
            eq(contracts.tenantId, tenantId),
            eq(contracts.status, 'active'),
            lte(contracts.endDate, sql`NOW() + INTERVAL '${sql.raw(String(daysAhead))} days'`),
            gte(contracts.endDate, sql`NOW()`),
          ),
        )
        .orderBy(asc(contracts.endDate));

      // Combine both contract types
      const allExpiringContracts = [
        ...expiringServiceContracts.map((c) => ({
          ...c,
          contractSource: 'service_contract',
        })),
        ...expiringContracts.map((c) => ({
          ...c,
          contractSource: 'general_contract',
          includesToner: null,
          includesParts: null,
          includesLabor: null,
        })),
      ].sort(
        (a, b) =>
          parseFloat(String(a.daysUntilExpiration)) - parseFloat(String(b.daysUntilExpiration)),
      );

      // Categorize by urgency
      const critical = allExpiringContracts.filter(
        (c) => parseFloat(String(c.daysUntilExpiration)) <= 30,
      );
      const high = allExpiringContracts.filter((c) => {
        const days = parseFloat(String(c.daysUntilExpiration));
        return days > 30 && days <= 90;
      });
      const medium = allExpiringContracts.filter((c) => {
        const days = parseFloat(String(c.daysUntilExpiration));
        return days > 90 && days <= 180;
      });

      // Calculate total value at risk
      const totalValueAtRisk = allExpiringContracts.reduce((sum, c) => {
        const annualValue = parseFloat(String(c.annualValue)) || 0;
        return sum + annualValue;
      }, 0);

      // Count contracts without renewal activity
      const actionRequired = allExpiringContracts.length; // Simplified - in production, check for renewal_opportunities records

      const response = {
        success: true,
        summary: {
          totalExpiring: allExpiringContracts.length,
          critical: critical.length,
          high: high.length,
          medium: medium.length,
          totalValueAtRisk: totalValueAtRisk.toFixed(2),
          actionRequired,
        },
        contracts: {
          critical,
          high,
          medium,
          all: allExpiringContracts,
        },
      };

      res.json(response);
    } catch (error) {
      log.error('Error fetching contract expiration alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch contract expiration alerts',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// Get detailed renewal opportunity for a specific contract
router.get('/api/alerts/contract-expirations/:contractId', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { contractId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing tenant context',
      });
    }

    // Try service contracts first
    const [serviceContract] = await db
      .select({
        contractId: serviceContracts.id,
        contractNumber: serviceContracts.contractNumber,
        customerId: serviceContracts.customerId,
        customerName: businessRecords.companyName,
        customerEmail: businessRecords.primaryContactEmail,
        customerPhone: businessRecords.primaryContactPhone,
        startDate: serviceContracts.startDate,
        endDate: serviceContracts.endDate,
        daysUntilExpiration:
          sql`DATE_PART('day', ${serviceContracts.endDate}::timestamp - NOW())`.as('days'),
        monthlyValue: serviceContracts.monthlyBaseRate,
        annualValue: sql`COALESCE(${serviceContracts.monthlyBaseRate}, 0) * 12`.as('annualValue'),
        contractType: serviceContracts.contractType,
        status: serviceContracts.contractStatus,
        includesToner: serviceContracts.includesToner,
        includesParts: serviceContracts.includesParts,
        includesLabor: serviceContracts.includesLabor,
        includedPages: serviceContracts.includedPages,
        overageRate: serviceContracts.overageRate,
        autoRenewal: serviceContracts.autoRenewal,
        billingCycle: serviceContracts.billingCycle,
      })
      .from(serviceContracts)
      .leftJoin(businessRecords, eq(serviceContracts.customerId, businessRecords.id))
      .where(and(eq(serviceContracts.id, contractId), eq(serviceContracts.tenantId, tenantId)))
      .limit(1);

    if (!serviceContract) {
      // Try general contracts
      const [generalContract] = await db
        .select({
          contractId: contracts.id,
          contractNumber: contracts.contractNumber,
          customerId: contracts.customerId,
          customerName: businessRecords.companyName,
          customerEmail: businessRecords.primaryContactEmail,
          customerPhone: businessRecords.primaryContactPhone,
          startDate: contracts.startDate,
          endDate: contracts.endDate,
          daysUntilExpiration: sql`DATE_PART('day', ${contracts.endDate}::timestamp - NOW())`.as(
            'days',
          ),
          contractType: contracts.contractType,
          status: contracts.status,
        })
        .from(contracts)
        .leftJoin(businessRecords, eq(contracts.customerId, businessRecords.id))
        .where(and(eq(contracts.id, contractId), eq(contracts.tenantId, tenantId)))
        .limit(1);

      if (!generalContract) {
        return res.status(404).json({
          success: false,
          message: 'Contract not found',
        });
      }

      return res.json({
        success: true,
        contract: generalContract,
        contractSource: 'general_contract',
      });
    }

    res.json({
      success: true,
      contract: serviceContract,
      contractSource: 'service_contract',
    });
  } catch (error) {
    log.error('Error fetching contract details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract details',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create a renewal opportunity from an expiring contract alert
router.post(
  '/api/alerts/contract-expirations/:contractId/create-renewal',
  async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { contractId } = req.params;
      const userId = req.user?.id || req.user?.claims?.sub;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Missing tenant context',
        });
      }

      // Get contract details
      const [contract] = await db
        .select({
          id: serviceContracts.id,
          customerId: serviceContracts.customerId,
          contractNumber: serviceContracts.contractNumber,
          endDate: serviceContracts.endDate,
          monthlyBaseRate: serviceContracts.monthlyBaseRate,
        })
        .from(serviceContracts)
        .where(and(eq(serviceContracts.id, contractId), eq(serviceContracts.tenantId, tenantId)))
        .limit(1);

      if (!contract) {
        return res.status(404).json({
          success: false,
          message: 'Contract not found',
        });
      }

      // Check if renewal opportunity already exists
      const existingRenewal = await db
        .select()
        .from(renewalOpportunities)
        .where(
          and(
            eq(renewalOpportunities.contractId, contractId),
            eq(renewalOpportunities.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (existingRenewal.length > 0) {
        return res.json({
          success: true,
          message: 'Renewal opportunity already exists',
          renewalOpportunity: existingRenewal[0],
        });
      }

      // Calculate days until renewal
      const daysUntilRenewal = Math.floor(
        (new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      // Determine renewal risk based on days remaining
      let renewalRisk: 'very_low' | 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (daysUntilRenewal <= 30) {
        renewalRisk = 'critical';
      } else if (daysUntilRenewal <= 90) {
        renewalRisk = 'high';
      }

      // Create renewal opportunity
      const [renewalOpportunity] = await db
        .insert(renewalOpportunities)
        .values({
          tenantId,
          customerId: contract.customerId,
          contractId: contract.id,
          renewalType: 'standard_renewal',
          renewalStatus: 'upcoming',
          renewalProbability: '0.5', // 50% default
          contractEndDate: contract.endDate,
          daysUntilRenewal,
          currentMrr: contract.monthlyBaseRate || '0',
          projectedMrr: contract.monthlyBaseRate || '0',
          renewalRisk,
          createdBy: userId,
        })
        .returning();

      res.json({
        success: true,
        message: 'Renewal opportunity created successfully',
        renewalOpportunity,
      });
    } catch (error) {
      log.error('Error creating renewal opportunity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create renewal opportunity',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * RENEWAL WORKFLOW AUTOMATION
 * Trigger automated renewal workflows at contract milestones
 */
router.post('/api/alerts/renewal-workflow/process', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing tenant context',
      });
    }

    // Process renewal milestones for this tenant
    const processedContracts = await contractRenewalWorkflow.processRenewalMilestones(tenantId);

    res.json({
      success: true,
      message: `Processed ${processedContracts.length} contracts`,
      processed: processedContracts,
      summary: {
        totalProcessed: processedContracts.length,
        tasksCreated: processedContracts.reduce((sum, c) => sum + c.tasksCreated, 0),
        notificationsSent: processedContracts.filter((c) => c.notificationsSent).length,
        totalValue: processedContracts.reduce((sum, c) => sum + c.annualValue, 0),
      },
    });
  } catch (error) {
    log.error('[RENEWAL WORKFLOW] Error processing workflows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process renewal workflows',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get renewal workflow summary
 * Shows contracts at each milestone
 */
router.get('/api/alerts/renewal-workflow/summary', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing tenant context',
      });
    }

    const summary = await contractRenewalWorkflow.getRenewalWorkflowSummary(tenantId);

    res.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    log.error('[RENEWAL WORKFLOW] Error getting summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get renewal workflow summary',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
