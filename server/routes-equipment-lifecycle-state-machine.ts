/**
 * Equipment Lifecycle State Machine API Routes
 *
 * Provides endpoints for managing equipment lifecycle transitions with:
 * - Validation enforcement
 * - Transition history tracking
 * - Rollback capabilities
 * - Available transitions lookup
 */

import { Router, Request, Response } from 'express';
import { EquipmentLifecycleStateMachine } from './services/equipment-lifecycle-state-machine';
import { z } from 'zod';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-equipment-lifecycle-state-machine');

const router = Router();

// Helper to get user ID from request (supports Supabase JWT and session)
const getUserId = (req: Request): string | undefined => {
  const reqAny = req as any;
  return (
    reqAny.user?.id ||
    reqAny.user?.claims?.sub ||
    reqAny.session?.userId ||
    reqAny.session?.user?.id
  );
};

// Request type with tenant context
interface TenantRequest extends Request {
  tenantId?: string;
  session: any;
}

// ===================================================================
// TRANSITION MANAGEMENT
// ===================================================================

/**
 * POST /api/equipment-lifecycle/:equipmentId/transition
 * Execute a lifecycle stage transition
 *
 * Body: {
 *   toStage: string,
 *   reason?: string,
 *   metadata?: any
 * }
 */
router.post(
  '/api/equipment-lifecycle/:equipmentId/transition',
  async (req: TenantRequest, res: Response) => {
    try {
      const { equipmentId } = req.params;
      const { toStage, reason, metadata } = req.body;
      const userId = getUserId(req);
      const tenantId = req.tenantId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required',
        });
      }

      if (!toStage) {
        return res.status(400).json({
          success: false,
          message: 'toStage is required',
        });
      }

      // Execute transition
      const result = await EquipmentLifecycleStateMachine.transition(
        equipmentId,
        toStage,
        userId,
        tenantId,
        reason,
        metadata,
      );

      if (result.success) {
        return res.json({
          success: true,
          message: `Equipment transitioned to ${result.newStage}`,
          data: result,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: result.error || 'Transition failed',
          data: result,
        });
      }
    } catch (error: any) {
      log.error('Transition endpoint error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/equipment-lifecycle/:equipmentId/transitions
 * Get transition history for equipment
 */
router.get(
  '/api/equipment-lifecycle/:equipmentId/transitions',
  async (req: TenantRequest, res: Response) => {
    try {
      const { equipmentId } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required',
        });
      }

      const history = await EquipmentLifecycleStateMachine.getHistory(equipmentId, tenantId);

      return res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      log.error('Get history endpoint error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  },
);

// ===================================================================
// VALIDATION & CHECKING
// ===================================================================

/**
 * GET /api/equipment-lifecycle/:equipmentId/can-transition/:toStage
 * Check if transition is allowed and get validation requirements
 */
router.get(
  '/api/equipment-lifecycle/:equipmentId/can-transition/:toStage',
  async (req: TenantRequest, res: Response) => {
    try {
      const { equipmentId, toStage } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required',
        });
      }

      // Get current equipment state
      const { db } = await import('./db/index');
      const { equipmentLifecycle } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [equipment] = await db
        .select()
        .from(equipmentLifecycle)
        .where(
          and(
            eq(equipmentLifecycle.equipmentId, equipmentId),
            eq(equipmentLifecycle.tenantId, tenantId),
          ),
        );

      if (!equipment) {
        return res.status(404).json({
          success: false,
          message: 'Equipment not found',
        });
      }

      const currentStage = equipment.currentStage;

      // Check if transition is allowed
      const canTransition = EquipmentLifecycleStateMachine.canTransition(currentStage, toStage);

      // Get validation requirements
      const validationRequirements = EquipmentLifecycleStateMachine.getValidationRequirements(
        currentStage,
        toStage,
      );

      // Run validations
      const validation = await EquipmentLifecycleStateMachine.validateTransition(
        equipmentId,
        currentStage,
        toStage,
      );

      return res.json({
        success: true,
        data: {
          canTransition,
          currentStage,
          targetStage: toStage,
          validationRequirements,
          validation,
          message: canTransition
            ? validation.isValid
              ? 'Transition allowed'
              : `Validation required: ${validation.failed.map((f) => f.name).join(', ')}`
            : 'Transition not allowed from current stage',
        },
      });
    } catch (error: any) {
      log.error('Can transition endpoint error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/equipment-lifecycle/:equipmentId/available-transitions
 * Get list of available transitions from current stage
 */
router.get(
  '/api/equipment-lifecycle/:equipmentId/available-transitions',
  async (req: TenantRequest, res: Response) => {
    try {
      const { equipmentId } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required',
        });
      }

      // Get current equipment state
      const { db } = await import('./db/index');
      const { equipmentLifecycle } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [equipment] = await db
        .select()
        .from(equipmentLifecycle)
        .where(
          and(
            eq(equipmentLifecycle.equipmentId, equipmentId),
            eq(equipmentLifecycle.tenantId, tenantId),
          ),
        );

      if (!equipment) {
        return res.status(404).json({
          success: false,
          message: 'Equipment not found',
        });
      }

      const currentStage = equipment.currentStage;
      const availableTransitions =
        EquipmentLifecycleStateMachine.getAvailableTransitions(currentStage);

      // Get validation requirements for each available transition
      const transitionsWithValidations = availableTransitions.map((toStage) => ({
        toStage,
        validationRequirements: EquipmentLifecycleStateMachine.getValidationRequirements(
          currentStage,
          toStage,
        ),
      }));

      return res.json({
        success: true,
        data: {
          currentStage,
          availableTransitions: transitionsWithValidations,
        },
      });
    } catch (error: any) {
      log.error('Available transitions endpoint error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  },
);

// ===================================================================
// ROLLBACK
// ===================================================================

/**
 * POST /api/equipment-lifecycle/transitions/:transitionId/rollback
 * Rollback a transition
 *
 * Body: {
 *   reason: string
 * }
 */
router.post(
  '/api/equipment-lifecycle/transitions/:transitionId/rollback',
  async (req: TenantRequest, res: Response) => {
    try {
      const { transitionId } = req.params;
      const { reason } = req.body;
      const userId = getUserId(req);
      const tenantId = req.tenantId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required',
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rollback reason is required',
        });
      }

      // Check if rollback is allowed
      const canRollback = await EquipmentLifecycleStateMachine.canRollback(transitionId, tenantId);

      if (!canRollback) {
        return res.status(400).json({
          success: false,
          message: 'Rollback not allowed (transition too old or already rolled back)',
        });
      }

      // Execute rollback
      const result = await EquipmentLifecycleStateMachine.rollback(
        transitionId,
        userId,
        tenantId,
        reason,
      );

      if (result.success) {
        return res.json({
          success: true,
          message: 'Transition rolled back successfully',
          data: result,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: result.error || 'Rollback failed',
          data: result,
        });
      }
    } catch (error: any) {
      log.error('Rollback endpoint error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/equipment-lifecycle/transitions/:transitionId/can-rollback
 * Check if a transition can be rolled back
 */
router.get(
  '/api/equipment-lifecycle/transitions/:transitionId/can-rollback',
  async (req: TenantRequest, res: Response) => {
    try {
      const { transitionId } = req.params;
      const tenantId = req.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required',
        });
      }

      const canRollback = await EquipmentLifecycleStateMachine.canRollback(transitionId, tenantId);

      return res.json({
        success: true,
        data: {
          canRollback,
          message: canRollback
            ? 'Rollback allowed'
            : 'Rollback not allowed (transition too old or already rolled back)',
        },
      });
    } catch (error: any) {
      log.error('Can rollback endpoint error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  },
);

// ===================================================================
// LIFECYCLE STAGES INFO
// ===================================================================

/**
 * GET /api/equipment-lifecycle/stages
 * Get list of all lifecycle stages
 */
router.get('/api/equipment-lifecycle/stages', async (req: TenantRequest, res: Response) => {
  try {
    const { LIFECYCLE_STAGES } = EquipmentLifecycleStateMachine;

    const stages = Object.entries(LIFECYCLE_STAGES).map(([key, value]) => ({
      key,
      value,
      name: value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    }));

    return res.json({
      success: true,
      data: stages,
    });
  } catch (error: any) {
    log.error('Get stages endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

export default router;
