/**
 * Territory Management API Routes
 * Endpoints for sales territory assignment and management
 */

import { Router, type Response } from 'express';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { requireRole } from './rbac-middleware';
import { enhanceUserContext } from './middleware/rbac-route-helper';
import { auditLogMiddleware } from './security-compliance';

// Services
import { territoryManagementService, TERRITORY_TYPES } from './services/territory-management-service';

const router = Router();

// Apply security middleware to all routes
router.use(resolveTenant);
router.use(requireTenant);
router.use(enhanceUserContext);

// ============================================================================
// TERRITORY ENDPOINTS
// ============================================================================

/**
 * Get territory type definitions
 */
router.get('/types',
  async (req: TenantRequest, res: Response) => {
    res.json({ territoryTypes: TERRITORY_TYPES });
  }
);

/**
 * Create territory
 */
router.post('/',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('CREATE_TERRITORY', 'sales_territories', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const territory = await territoryManagementService.createTerritory(
        req.tenantId!,
        req.body
      );

      res.status(201).json({
        message: 'Territory created successfully',
        territory,
      });
    } catch (error) {
      console.error('Error creating territory:', error);
      res.status(500).json({ message: 'Failed to create territory' });
    }
  }
);

/**
 * List territories
 */
router.get('/',
  requireRole(['admin', 'manager', 'sales_rep']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit, type, ownerId, isActive, search } = req.query;
      const result = await territoryManagementService.listTerritories(req.tenantId!, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        type: type as string,
        ownerId: ownerId as string,
        isActive: isActive ? isActive === 'true' : undefined,
        search: search as string,
      });

      res.json(result);
    } catch (error) {
      console.error('Error listing territories:', error);
      res.status(500).json({ message: 'Failed to list territories' });
    }
  }
);

/**
 * Get territory by ID
 */
router.get('/:id',
  requireRole(['admin', 'manager', 'sales_rep']),
  async (req: TenantRequest, res: Response) => {
    try {
      const territory = await territoryManagementService.getTerritory(
        req.tenantId!,
        req.params.id
      );

      if (!territory) {
        return res.status(404).json({ message: 'Territory not found' });
      }

      res.json(territory);
    } catch (error) {
      console.error('Error fetching territory:', error);
      res.status(500).json({ message: 'Failed to fetch territory' });
    }
  }
);

/**
 * Update territory
 */
router.put('/:id',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('UPDATE_TERRITORY', 'sales_territories', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const territory = await territoryManagementService.updateTerritory(
        req.tenantId!,
        req.params.id,
        req.body,
        req.user!.id
      );

      res.json({
        message: 'Territory updated successfully',
        territory,
      });
    } catch (error) {
      console.error('Error updating territory:', error);
      res.status(500).json({ message: 'Failed to update territory' });
    }
  }
);

/**
 * Delete territory
 */
router.delete('/:id',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('DELETE_TERRITORY', 'sales_territories', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      await territoryManagementService.deleteTerritory(
        req.tenantId!,
        req.params.id,
        req.user!.id
      );

      res.json({ message: 'Territory deleted successfully' });
    } catch (error) {
      console.error('Error deleting territory:', error);
      res.status(500).json({ message: 'Failed to delete territory' });
    }
  }
);

/**
 * Find matching territory for lead data
 */
router.post('/match',
  requireRole(['admin', 'manager', 'sales_rep']),
  async (req: TenantRequest, res: Response) => {
    try {
      const territory = await territoryManagementService.findMatchingTerritory(
        req.tenantId!,
        req.body
      );

      res.json({ territory });
    } catch (error) {
      console.error('Error finding matching territory:', error);
      res.status(500).json({ message: 'Failed to find matching territory' });
    }
  }
);

/**
 * Assign lead to territory
 */
router.post('/:id/assign-lead',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('ASSIGN_LEAD_TERRITORY', 'sales_territories', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const { leadId } = req.body;

      await territoryManagementService.assignLeadToTerritory(
        req.tenantId!,
        leadId,
        req.params.id,
        req.user!.id
      );

      res.json({ message: 'Lead assigned to territory successfully' });
    } catch (error) {
      console.error('Error assigning lead to territory:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to assign lead' });
    }
  }
);

// ============================================================================
// ASSIGNMENT RULES ENDPOINTS
// ============================================================================

/**
 * Create assignment rule
 */
router.post('/rules',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('CREATE_ASSIGNMENT_RULE', 'lead_assignment_rules', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const rule = await territoryManagementService.createAssignmentRule(
        req.tenantId!,
        req.body,
        req.user!.id
      );

      res.status(201).json({
        message: 'Assignment rule created successfully',
        rule,
      });
    } catch (error) {
      console.error('Error creating assignment rule:', error);
      res.status(500).json({ message: 'Failed to create assignment rule' });
    }
  }
);

/**
 * List assignment rules
 */
router.get('/rules',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit, isActive } = req.query;
      const result = await territoryManagementService.listAssignmentRules(req.tenantId!, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        isActive: isActive ? isActive === 'true' : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error('Error listing assignment rules:', error);
      res.status(500).json({ message: 'Failed to list assignment rules' });
    }
  }
);

/**
 * Get assignment rule by ID
 */
router.get('/rules/:id',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const rule = await territoryManagementService.getAssignmentRule(
        req.tenantId!,
        req.params.id
      );

      if (!rule) {
        return res.status(404).json({ message: 'Assignment rule not found' });
      }

      res.json(rule);
    } catch (error) {
      console.error('Error fetching assignment rule:', error);
      res.status(500).json({ message: 'Failed to fetch assignment rule' });
    }
  }
);

/**
 * Update assignment rule
 */
router.put('/rules/:id',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('UPDATE_ASSIGNMENT_RULE', 'lead_assignment_rules', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const rule = await territoryManagementService.updateAssignmentRule(
        req.tenantId!,
        req.params.id,
        req.body
      );

      res.json({
        message: 'Assignment rule updated successfully',
        rule,
      });
    } catch (error) {
      console.error('Error updating assignment rule:', error);
      res.status(500).json({ message: 'Failed to update assignment rule' });
    }
  }
);

/**
 * Delete assignment rule
 */
router.delete('/rules/:id',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('DELETE_ASSIGNMENT_RULE', 'lead_assignment_rules', 'medium', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      await territoryManagementService.deleteAssignmentRule(
        req.tenantId!,
        req.params.id
      );

      res.json({ message: 'Assignment rule deleted successfully' });
    } catch (error) {
      console.error('Error deleting assignment rule:', error);
      res.status(500).json({ message: 'Failed to delete assignment rule' });
    }
  }
);

// ============================================================================
// REP CAPACITY ENDPOINTS
// ============================================================================

/**
 * Get rep capacity
 */
router.get('/capacity/:userId',
  requireRole(['admin', 'manager', 'sales_rep']),
  async (req: TenantRequest, res: Response) => {
    try {
      const capacity = await territoryManagementService.getOrCreateRepCapacity(
        req.tenantId!,
        req.params.userId
      );

      res.json(capacity);
    } catch (error) {
      console.error('Error fetching rep capacity:', error);
      res.status(500).json({ message: 'Failed to fetch rep capacity' });
    }
  }
);

/**
 * Update rep capacity
 */
router.put('/capacity/:userId',
  requireRole(['admin', 'manager']),
  auditLogMiddleware('UPDATE_REP_CAPACITY', 'rep_capacity', 'low', 'data_modification'),
  async (req: TenantRequest, res: Response) => {
    try {
      const capacity = await territoryManagementService.updateRepCapacity(
        req.tenantId!,
        req.params.userId,
        req.body
      );

      res.json({
        message: 'Rep capacity updated successfully',
        capacity,
      });
    } catch (error) {
      console.error('Error updating rep capacity:', error);
      res.status(500).json({ message: 'Failed to update rep capacity' });
    }
  }
);

/**
 * List rep capacities
 */
router.get('/capacity',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit, isAvailable } = req.query;
      const result = await territoryManagementService.listRepCapacities(req.tenantId!, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        isAvailable: isAvailable ? isAvailable === 'true' : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error('Error listing rep capacities:', error);
      res.status(500).json({ message: 'Failed to list rep capacities' });
    }
  }
);

/**
 * Get available rep with lowest load
 */
router.post('/capacity/available',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { skills, territoryId } = req.body;
      const rep = await territoryManagementService.getAvailableRep(
        req.tenantId!,
        skills,
        territoryId
      );

      res.json({ rep });
    } catch (error) {
      console.error('Error finding available rep:', error);
      res.status(500).json({ message: 'Failed to find available rep' });
    }
  }
);

// ============================================================================
// ASSIGNMENT HISTORY ENDPOINTS
// ============================================================================

/**
 * Get assignment history for a lead
 */
router.get('/history/lead/:leadId',
  requireRole(['admin', 'manager', 'sales_rep']),
  async (req: TenantRequest, res: Response) => {
    try {
      const history = await territoryManagementService.getLeadAssignmentHistory(
        req.tenantId!,
        req.params.leadId
      );

      res.json({ history });
    } catch (error) {
      console.error('Error fetching lead assignment history:', error);
      res.status(500).json({ message: 'Failed to fetch assignment history' });
    }
  }
);

/**
 * Get assignment history for a rep
 */
router.get('/history/rep/:userId',
  requireRole(['admin', 'manager', 'sales_rep']),
  async (req: TenantRequest, res: Response) => {
    try {
      const { page, limit } = req.query;
      const result = await territoryManagementService.getRepAssignmentHistory(
        req.tenantId!,
        req.params.userId,
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
        }
      );

      res.json(result);
    } catch (error) {
      console.error('Error fetching rep assignment history:', error);
      res.status(500).json({ message: 'Failed to fetch assignment history' });
    }
  }
);

// ============================================================================
// STATISTICS ENDPOINT
// ============================================================================

/**
 * Get territory management statistics
 */
router.get('/stats',
  requireRole(['admin', 'manager']),
  async (req: TenantRequest, res: Response) => {
    try {
      const stats = await territoryManagementService.getStats(req.tenantId!);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching territory stats:', error);
      res.status(500).json({ message: 'Failed to fetch territory statistics' });
    }
  }
);

export default router;
