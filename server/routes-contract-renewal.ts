import { Router, type Request, Response, NextFunction } from 'express';
import { db } from './db';
import { eq, and, desc } from 'drizzle-orm';
import { contractRenewalTracking, renewalProposals } from '@shared/schema';
import * as renewalService from './services/contract-renewal-service';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-contract-renewal');

// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

const router = Router();

/**
 * Contract Renewal Autopilot Routes
 *
 * Automated contract renewal and churn prevention endpoints
 */

// Middleware to check tenant
function requireTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = (req as any).tenantId || (req.session as any)?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }
  (req as any).tenantId = tenantId;
  next();
}

router.use(requireTenant);
// Apply RBAC context to all contract renewal routes
router.use(enhanceUserContext);

/**
 * GET /api/contract-renewal/dashboard
 * Get dashboard metrics and overview - requires customer view permission
 */
router.get(
  '/dashboard',
  requirePermission([PERMISSIONS.SALES.CUSTOMER.VIEW_OWN, PERMISSIONS.SALES.CUSTOMER.VIEW_TEAM]),
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const metrics = await renewalService.getDashboardMetrics(tenantId);
      res.json(metrics);
    } catch (error) {
      log.error('Error fetching dashboard metrics:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * GET /api/contract-renewal/contracts
 * Get all contracts being tracked for renewal
 */
router.get('/contracts', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status, risk } = req.query;

    const contracts = await db.query.contractRenewalTracking.findMany({
      where: eq(contractRenewalTracking.tenantId, tenantId),
      orderBy: [contractRenewalTracking.daysUntilExpiration],
      limit: 100,
    });

    res.json(contracts);
  } catch (error) {
    log.error('Error fetching contracts:', error);
    res.status(500).json({
      error: 'Failed to fetch contracts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contract-renewal/expiring
 * Get contracts expiring within specified days
 */
router.get('/expiring', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const days = parseInt(req.query.days as string) || 90;
    const contracts = await renewalService.getExpiringContracts(tenantId, days);
    res.json(contracts);
  } catch (error) {
    log.error('Error fetching expiring contracts:', error);
    res.status(500).json({
      error: 'Failed to fetch expiring contracts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contract-renewal/at-risk
 * Get contracts at high risk of churn
 */
router.get('/at-risk', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const contracts = await renewalService.getContractsAtRisk(tenantId);
    res.json(contracts);
  } catch (error) {
    log.error('Error fetching at-risk contracts:', error);
    res.status(500).json({
      error: 'Failed to fetch at-risk contracts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/contract-renewal/analyze/:contractTrackingId
 * Analyze a single contract and predict renewal likelihood
 */
router.post('/analyze/:contractTrackingId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const contractTrackingId = parseInt(req.params.contractTrackingId);

    if (isNaN(contractTrackingId)) {
      return res.status(400).json({ error: 'Invalid contract tracking ID' });
    }

    const analysis = await renewalService.analyzeContractRenewal(tenantId, contractTrackingId);
    res.json(analysis);
  } catch (error) {
    log.error('Error analyzing contract:', error);
    res.status(500).json({
      error: 'Failed to analyze contract',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/contract-renewal/analyze-all
 * Batch analyze all expiring contracts
 */
router.post('/analyze-all', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const results = await renewalService.analyzeExpiringContracts(tenantId);
    res.json(results);
  } catch (error) {
    log.error('Error analyzing contracts:', error);
    res.status(500).json({
      error: 'Failed to analyze contracts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/contract-renewal/generate-proposal/:contractTrackingId
 * Generate renewal proposal with AI-optimized pricing
 */
router.post('/generate-proposal/:contractTrackingId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const contractTrackingId = parseInt(req.params.contractTrackingId);

    if (isNaN(contractTrackingId)) {
      return res.status(400).json({ error: 'Invalid contract tracking ID' });
    }

    // First analyze
    const analysis = await renewalService.analyzeContractRenewal(tenantId, contractTrackingId);

    // Generate pricing recommendations
    const recommendations = await renewalService.generateRenewalProposal(
      tenantId,
      contractTrackingId,
      analysis,
    );

    // Create proposal
    const proposal = await renewalService.createRenewalProposal(
      tenantId,
      contractTrackingId,
      analysis,
      recommendations,
    );

    res.json(proposal);
  } catch (error) {
    log.error('Error generating proposal:', error);
    res.status(500).json({
      error: 'Failed to generate proposal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contract-renewal/proposals
 * Get all renewal proposals
 */
router.get('/proposals', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status } = req.query;

    const proposals = await db.query.renewalProposals.findMany({
      where: eq(renewalProposals.tenantId, tenantId),
      orderBy: [desc(renewalProposals.proposalDate)],
      limit: 100,
    });

    res.json(proposals);
  } catch (error) {
    log.error('Error fetching proposals:', error);
    res.status(500).json({
      error: 'Failed to fetch proposals',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contract-renewal/proposals/:proposalId
 * Get specific proposal details
 */
router.get('/proposals/:proposalId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const proposalId = parseInt(req.params.proposalId);

    if (isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }

    const proposal = await db.query.renewalProposals.findFirst({
      where: and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenantId, tenantId)),
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(proposal);
  } catch (error) {
    log.error('Error fetching proposal:', error);
    res.status(500).json({
      error: 'Failed to fetch proposal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/contract-renewal/proposals/:proposalId/status
 * Update proposal status (e.g., send, accept, reject)
 */
router.patch('/proposals/:proposalId/status', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const proposalId = parseInt(req.params.proposalId);
    const { status, customerResponse, responseDate, rejectionReason } = req.body;

    if (isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    if (status) updates.status = status;
    if (customerResponse) updates.customerResponse = customerResponse;
    if (responseDate) updates.responseDate = new Date(responseDate);
    if (rejectionReason) updates.rejectionReason = rejectionReason;

    // Special handling for status changes
    if (status === 'sent' && !updates.sentAt) {
      updates.sentAt = new Date();
    }
    if (status === 'accepted') {
      updates.acceptedAt = new Date();
    }

    const [updatedProposal] = await db
      .update(renewalProposals)
      .set(updates)
      .where(and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenantId, tenantId)))
      .returning();

    if (!updatedProposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(updatedProposal);
  } catch (error) {
    log.error('Error updating proposal status:', error);
    res.status(500).json({
      error: 'Failed to update proposal status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contract-renewal/contract/:contractTrackingId
 * Get detailed contract information with proposals
 */
router.get('/contract/:contractTrackingId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const contractTrackingId = parseInt(req.params.contractTrackingId);

    if (isNaN(contractTrackingId)) {
      return res.status(400).json({ error: 'Invalid contract tracking ID' });
    }

    const contract = await db.query.contractRenewalTracking.findFirst({
      where: and(
        eq(contractRenewalTracking.id, contractTrackingId),
        eq(contractRenewalTracking.tenantId, tenantId),
      ),
      with: {
        proposals: {
          orderBy: [desc(renewalProposals.proposalDate)],
        },
        communications: {
          orderBy: [desc((c: any) => c.sentAt)],
          limit: 20,
        },
      },
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json(contract);
  } catch (error) {
    log.error('Error fetching contract details:', error);
    res.status(500).json({
      error: 'Failed to fetch contract details',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/contract-renewal/contract/:contractTrackingId
 * Update contract tracking information
 */
router.patch('/contract/:contractTrackingId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const contractTrackingId = parseInt(req.params.contractTrackingId);
    const updates = req.body;

    if (isNaN(contractTrackingId)) {
      return res.status(400).json({ error: 'Invalid contract tracking ID' });
    }

    const [updatedContract] = await db
      .update(contractRenewalTracking)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contractRenewalTracking.id, contractTrackingId),
          eq(contractRenewalTracking.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updatedContract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json(updatedContract);
  } catch (error) {
    log.error('Error updating contract:', error);
    res.status(500).json({
      error: 'Failed to update contract',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contract-renewal/rules
 * Get renewal automation rules
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const rules = await renewalService.getRenewalAutomationRules(tenantId);
    res.json(rules);
  } catch (error) {
    log.error('Error fetching rules:', error);
    res.status(500).json({
      error: 'Failed to fetch rules',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/contract-renewal/rules
 * Update renewal automation rules
 */
router.put('/rules', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const updates = req.body;
    const rules = await renewalService.updateRenewalAutomationRules(tenantId, updates);
    res.json(rules);
  } catch (error) {
    log.error('Error updating rules:', error);
    res.status(500).json({
      error: 'Failed to update rules',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/contract-renewal/proposals/:proposalId/send
 * Send proposal to customer
 */
router.post('/proposals/:proposalId/send', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const proposalId = parseInt(req.params.proposalId);
    const { sendVia = 'email' } = req.body;

    if (isNaN(proposalId)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }

    const [proposal] = await db
      .update(renewalProposals)
      .set({
        status: 'sent',
        sentAt: new Date(),
        sentVia,
        updatedAt: new Date(),
      })
      .where(and(eq(renewalProposals.id, proposalId), eq(renewalProposals.tenantId, tenantId)))
      .returning();

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Update contract tracking
    await db
      .update(contractRenewalTracking)
      .set({
        status: 'renewal_proposed',
        proposalSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contractRenewalTracking.id, proposal.contractRenewalTrackingId),
          eq(contractRenewalTracking.tenantId, tenantId),
        ),
      );

    res.json(proposal);
  } catch (error) {
    log.error('Error sending proposal:', error);
    res.status(500).json({
      error: 'Failed to send proposal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
