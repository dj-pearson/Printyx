/**
 * Equipment Disposal API Routes
 *
 * Provides endpoints for managing equipment disposal workflows with:
 * - Disposal record creation
 * - Vendor management
 * - Compliance tracking
 * - Certificate of destruction
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from './db';
import { equipmentDisposal, equipmentLifecycle } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// Helper to get user ID from request (supports Supabase JWT and session)
const getUserId = (req: Request): string | undefined => {
  const reqAny = req as any;
  return (
    reqAny.user?.id ||
    reqAny.user?.claims?.sub ||
    reqAny.session?.user_id ||
    reqAny.session?.user?.id
  );
};

// Request type with tenant context
interface TenantRequest extends Request {
  tenantId?: string;
  session: any;
}

// Validation schema
const createDisposalSchema = z.object({
  equipmentId: z.string().uuid(),
  disposalType: z.enum(['recycling', 'e_waste', 'donation', 'resale', 'destruction']),
  disposalVendor: z.string().min(2),
  disposalDate: z.string(),
  estimatedCost: z.number().min(0).optional(),
  dataWipedConfirmation: z.boolean().refine((val) => val === true),
  certificateOfDestruction: z.string().optional(),
  environmentalCompliance: z.boolean(),
  notes: z.string().optional(),
  dataWipeMethod: z.string().min(1),
  dataWipeVerifiedBy: z.string().optional(),
  dataWipeStandard: z.string().optional(),
  vendorContactName: z.string().optional(),
  vendorContactEmail: z.string().email().optional().or(z.literal('')),
  vendorContactPhone: z.string().optional(),
});

type CreateDisposalInput = z.infer<typeof createDisposalSchema>;

// ===================================================================
// DISPOSAL MANAGEMENT
// ===================================================================

/**
 * POST /api/equipment-disposal
 * Create a disposal record for equipment
 */
router.post('/api/equipment-disposal', async (req: TenantRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const tenantId = req.tenant_id;

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

    // Validate request body
    const validationResult = createDisposalSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid disposal data',
        errors: validationResult.error.errors,
      });
    }

    const data = validationResult.data;

    // Verify equipment exists and belongs to tenant
    const [equipment] = await db
      .select()
      .from(equipmentLifecycle)
      .where(
        and(
          eq(equipmentLifecycle.equipmentId, data.equipmentId),
          eq(equipmentLifecycle.tenant_id, tenantId),
        ),
      );

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found or access denied',
      });
    }

    // Check if equipment is in retired stage
    if (equipment.currentStage !== 'retired') {
      return res.status(400).json({
        success: false,
        message: 'Equipment must be in retired stage before disposal',
        currentStage: equipment.currentStage,
      });
    }

    // Create disposal record
    const [disposal] = await db
      .insert(equipmentDisposal)
      .values({
        tenantId,
        equipmentId: data.equipmentId,
        disposalType: data.disposalType,
        disposalVendor: data.disposalVendor,
        disposalDate: new Date(data.disposalDate),
        estimatedCost: data.estimatedCost ? data.estimatedCost.toString() : null,
        dataWipedConfirmation: data.dataWipedConfirmation,
        certificateOfDestruction: data.certificateOfDestruction || null,
        environmentalCompliance: data.environmentalCompliance,
        notes: data.notes || null,
        disposalStatus: 'scheduled',
        initiatedBy: userId,
        initiatedAt: new Date(),
        metadata: {
          dataWipeMethod: data.dataWipeMethod,
          dataWipeVerifiedBy: data.dataWipeVerifiedBy,
          dataWipeStandard: data.dataWipeStandard,
          vendorContactName: data.vendorContactName,
          vendorContactEmail: data.vendorContactEmail,
          vendorContactPhone: data.vendorContactPhone,
        },
      })
      .returning();

    return res.json({
      success: true,
      message: 'Disposal record created successfully',
      data: disposal,
    });
  } catch (error: any) {
    console.error('Create disposal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

/**
 * GET /api/equipment-disposal
 * Get all disposal records for tenant
 */
router.get('/api/equipment-disposal', async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context required',
      });
    }

    const { status, equipmentId } = req.query;

    let query = db
      .select()
      .from(equipmentDisposal)
      .where(eq(equipmentDisposal.tenant_id, tenantId));

    // Apply filters
    if (status && typeof status === 'string') {
      query = query.where(eq(equipmentDisposal.disposalStatus, status as any));
    }

    if (equipmentId && typeof equipmentId === 'string') {
      query = query.where(eq(equipmentDisposal.equipmentId, equipmentId));
    }

    const disposals = await query.orderBy(desc(equipmentDisposal.initiatedAt));

    return res.json({
      success: true,
      data: disposals,
    });
  } catch (error: any) {
    console.error('Get disposals error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

/**
 * GET /api/equipment-disposal/:disposalId
 * Get specific disposal record
 */
router.get('/api/equipment-disposal/:disposalId', async (req: TenantRequest, res: Response) => {
  try {
    const { disposalId } = req.params;
    const tenantId = req.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context required',
      });
    }

    const [disposal] = await db
      .select()
      .from(equipmentDisposal)
      .where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenant_id, tenantId)));

    if (!disposal) {
      return res.status(404).json({
        success: false,
        message: 'Disposal record not found',
      });
    }

    return res.json({
      success: true,
      data: disposal,
    });
  } catch (error: any) {
    console.error('Get disposal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/equipment-disposal/:disposalId/status
 * Update disposal status
 */
router.patch(
  '/api/equipment-disposal/:disposalId/status',
  async (req: TenantRequest, res: Response) => {
    try {
      const { disposalId } = req.params;
      const { status, completedDate, actualCost, certificateUrl } = req.body;
      const tenantId = req.tenant_id;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required',
        });
      }

      // Validate status
      const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value',
        });
      }

      const updateData: any = {
        disposalStatus: status,
      };

      if (completedDate) {
        updateData.completedDate = new Date(completedDate);
      }

      if (actualCost !== undefined) {
        updateData.actualCost = actualCost.toString();
      }

      if (certificateUrl) {
        updateData.certificateOfDestruction = certificateUrl;
      }

      const [updated] = await db
        .update(equipmentDisposal)
        .set(updateData)
        .where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenant_id, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Disposal record not found',
        });
      }

      return res.json({
        success: true,
        message: 'Disposal status updated successfully',
        data: updated,
      });
    } catch (error: any) {
      console.error('Update disposal status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  },
);

/**
 * DELETE /api/equipment-disposal/:disposalId
 * Cancel/delete disposal record (only if not completed)
 */
router.delete('/api/equipment-disposal/:disposalId', async (req: TenantRequest, res: Response) => {
  try {
    const { disposalId } = req.params;
    const tenantId = req.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context required',
      });
    }

    // Check if disposal exists and is not completed
    const [disposal] = await db
      .select()
      .from(equipmentDisposal)
      .where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenant_id, tenantId)));

    if (!disposal) {
      return res.status(404).json({
        success: false,
        message: 'Disposal record not found',
      });
    }

    if (disposal.disposalStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete completed disposal records',
      });
    }

    await db
      .delete(equipmentDisposal)
      .where(and(eq(equipmentDisposal.id, disposalId), eq(equipmentDisposal.tenant_id, tenantId)));

    return res.json({
      success: true,
      message: 'Disposal record deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete disposal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

export default router;
