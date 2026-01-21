import type { Express, Request, Response } from 'express';
import { db } from './db';
import {
  pipelineTemplates,
  pipelineStages,
  stageTransitions,
  dealStageHistory,
  pipelineAutomationLogs,
} from '../shared/pipeline-configuration-schema';
import { deals } from '../shared/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

// Middleware type for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    name: string;
  };
}

const isAuthenticated = (req: Request, res: Response, next: Function) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

/**
 * Register Pipeline Configuration API Routes
 *
 * These routes provide comprehensive pipeline management capabilities:
 * - Pipeline template CRUD operations
 * - Stage management with automation triggers
 * - Stage transition rules
 * - Deal stage history tracking
 * - Pipeline cloning for quick setup
 */
export function registerPipelineConfigurationRoutes(app: Express) {
  // ============================================================================
  // PIPELINE TEMPLATES
  // ============================================================================

  /**
   * GET /api/pipeline-config/templates
   * List all pipeline templates for tenant
   */
  app.get(
    '/api/pipeline-config/templates',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const templates = await db
          .select()
          .from(pipelineTemplates)
          .where(eq(pipelineTemplates.tenantId, user.tenantId))
          .orderBy(desc(pipelineTemplates.isDefault), asc(pipelineTemplates.name));

        res.json(templates);
      } catch (error) {
        console.error('Error fetching pipeline templates:', error);
        res.status(500).json({ message: 'Failed to fetch pipeline templates' });
      }
    },
  );

  /**
   * GET /api/pipeline-config/templates/:id
   * Get single pipeline template with stages
   */
  app.get(
    '/api/pipeline-config/templates/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { id } = req.params;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const template = await db
          .select()
          .from(pipelineTemplates)
          .where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenantId, user.tenantId)))
          .limit(1);

        if (template.length === 0) {
          return res.status(404).json({ message: 'Pipeline template not found' });
        }

        // Get stages for this template
        const stages = await db
          .select()
          .from(pipelineStages)
          .where(eq(pipelineStages.pipelineTemplateId, id))
          .orderBy(asc(pipelineStages.order));

        res.json({
          ...template[0],
          stages,
        });
      } catch (error) {
        console.error('Error fetching pipeline template:', error);
        res.status(500).json({ message: 'Failed to fetch pipeline template' });
      }
    },
  );

  /**
   * POST /api/pipeline-config/templates
   * Create new pipeline template
   */
  app.post(
    '/api/pipeline-config/templates',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const {
          name,
          description,
          pipelineType,
          isDefault,
          stages, // Array of stage definitions
        } = req.body;

        // Validation
        if (!name || !pipelineType) {
          return res.status(400).json({ message: 'Name and pipeline type are required' });
        }

        if (!stages || !Array.isArray(stages) || stages.length === 0) {
          return res.status(400).json({ message: 'At least one stage is required' });
        }

        // Start transaction
        await db.transaction(async (tx) => {
          // If setting as default, unset other defaults
          if (isDefault) {
            await tx
              .update(pipelineTemplates)
              .set({ isDefault: false })
              .where(
                and(
                  eq(pipelineTemplates.tenantId, user.tenantId),
                  eq(pipelineTemplates.pipelineType, pipelineType),
                ),
              );
          }

          // Create template
          const [template] = await tx
            .insert(pipelineTemplates)
            .values({
              tenantId: user.tenantId,
              name,
              description,
              pipelineType,
              isDefault: isDefault || false,
              isActive: true,
            })
            .returning();

          // Create stages
          const stageData = stages.map((stage: any, index: number) => ({
            tenantId: user.tenantId,
            pipelineTemplateId: template.id,
            name: stage.name,
            displayName: stage.displayName || stage.name,
            description: stage.description,
            order: stage.order ?? index,
            color: stage.color || '#64748b',
            icon: stage.icon,
            stageType: stage.stageType || 'open',
            isFinalStage: stage.isFinalStage || false,
            automationTriggers: stage.automationTriggers || [],
            requiredFields: stage.requiredFields || [],
            slaEnabled: stage.slaEnabled || false,
            slaDays: stage.slaDays,
            defaultProbability: stage.defaultProbability || 50,
            allowedTransitions: stage.allowedTransitions || [],
          }));

          const createdStages = await tx.insert(pipelineStages).values(stageData).returning();

          res.status(201).json({
            ...template,
            stages: createdStages,
          });
        });
      } catch (error) {
        console.error('Error creating pipeline template:', error);
        res.status(500).json({ message: 'Failed to create pipeline template' });
      }
    },
  );

  /**
   * PUT /api/pipeline-config/templates/:id
   * Update pipeline template
   */
  app.put(
    '/api/pipeline-config/templates/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { id } = req.params;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const { name, description, isDefault, isActive } = req.body;

        // Verify ownership
        const existing = await db
          .select()
          .from(pipelineTemplates)
          .where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenantId, user.tenantId)))
          .limit(1);

        if (existing.length === 0) {
          return res.status(404).json({ message: 'Pipeline template not found' });
        }

        // If setting as default, unset others
        if (isDefault && !existing[0].isDefault) {
          await db
            .update(pipelineTemplates)
            .set({ isDefault: false })
            .where(
              and(
                eq(pipelineTemplates.tenantId, user.tenantId),
                eq(pipelineTemplates.pipelineType, existing[0].pipelineType),
              ),
            );
        }

        const [updated] = await db
          .update(pipelineTemplates)
          .set({
            name,
            description,
            isDefault,
            isActive,
            updatedAt: new Date(),
          })
          .where(eq(pipelineTemplates.id, id))
          .returning();

        res.json(updated);
      } catch (error) {
        console.error('Error updating pipeline template:', error);
        res.status(500).json({ message: 'Failed to update pipeline template' });
      }
    },
  );

  /**
   * DELETE /api/pipeline-config/templates/:id
   * Delete pipeline template (soft delete by deactivating)
   */
  app.delete(
    '/api/pipeline-config/templates/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { id } = req.params;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        // Check if template has deals using it
        const dealsCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(deals)
          .where(and(eq(deals.tenantId, user.tenantId), eq(deals.pipelineTemplateId, id)));

        if (dealsCount[0].count > 0) {
          return res.status(400).json({
            message: `Cannot delete template with ${dealsCount[0].count} active deals. Deactivate instead.`,
          });
        }

        await db
          .update(pipelineTemplates)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenantId, user.tenantId)));

        res.json({ message: 'Pipeline template deactivated successfully' });
      } catch (error) {
        console.error('Error deleting pipeline template:', error);
        res.status(500).json({ message: 'Failed to delete pipeline template' });
      }
    },
  );

  /**
   * POST /api/pipeline-config/templates/:id/clone
   * Clone existing pipeline template
   */
  app.post(
    '/api/pipeline-config/templates/:id/clone',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { id } = req.params;
        const { name } = req.body;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        if (!name) {
          return res.status(400).json({ message: 'New template name is required' });
        }

        await db.transaction(async (tx) => {
          // Get original template
          const [original] = await tx
            .select()
            .from(pipelineTemplates)
            .where(and(eq(pipelineTemplates.id, id), eq(pipelineTemplates.tenantId, user.tenantId)))
            .limit(1);

          if (!original) {
            throw new Error('Template not found');
          }

          // Create cloned template
          const [cloned] = await tx
            .insert(pipelineTemplates)
            .values({
              tenantId: user.tenantId,
              name,
              description: `Cloned from ${original.name}`,
              pipelineType: original.pipelineType,
              isDefault: false,
              isActive: true,
            })
            .returning();

          // Get original stages
          const originalStages = await tx
            .select()
            .from(pipelineStages)
            .where(eq(pipelineStages.pipelineTemplateId, id))
            .orderBy(asc(pipelineStages.order));

          // Clone stages
          const clonedStageData = originalStages.map((stage) => ({
            tenantId: user.tenantId,
            pipelineTemplateId: cloned.id,
            name: stage.name,
            displayName: stage.displayName,
            description: stage.description,
            order: stage.order,
            color: stage.color,
            icon: stage.icon,
            stageType: stage.stageType,
            isFinalStage: stage.isFinalStage,
            automationTriggers: stage.automationTriggers,
            requiredFields: stage.requiredFields,
            slaEnabled: stage.slaEnabled,
            slaDays: stage.slaDays,
            defaultProbability: stage.defaultProbability,
            allowedTransitions: stage.allowedTransitions,
          }));

          const clonedStages = await tx.insert(pipelineStages).values(clonedStageData).returning();

          res.status(201).json({
            ...cloned,
            stages: clonedStages,
          });
        });
      } catch (error) {
        console.error('Error cloning pipeline template:', error);
        res.status(500).json({ message: 'Failed to clone pipeline template' });
      }
    },
  );

  // ============================================================================
  // PIPELINE STAGES
  // ============================================================================

  /**
   * GET /api/pipeline-config/stages/:templateId
   * Get all stages for a template
   */
  app.get(
    '/api/pipeline-config/stages/:templateId',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { templateId } = req.params;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const stages = await db
          .select()
          .from(pipelineStages)
          .where(
            and(
              eq(pipelineStages.pipelineTemplateId, templateId),
              eq(pipelineStages.tenantId, user.tenantId),
            ),
          )
          .orderBy(asc(pipelineStages.order));

        res.json(stages);
      } catch (error) {
        console.error('Error fetching pipeline stages:', error);
        res.status(500).json({ message: 'Failed to fetch pipeline stages' });
      }
    },
  );

  /**
   * POST /api/pipeline-config/stages
   * Create new stage
   */
  app.post('/api/pipeline-config/stages', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as AuthenticatedRequest;
      if (!user) return res.status(401).json({ message: 'Unauthorized' });

      const stageData = {
        tenantId: user.tenantId,
        ...req.body,
      };

      const [stage] = await db.insert(pipelineStages).values(stageData).returning();

      res.status(201).json(stage);
    } catch (error) {
      console.error('Error creating pipeline stage:', error);
      res.status(500).json({ message: 'Failed to create pipeline stage' });
    }
  });

  /**
   * PUT /api/pipeline-config/stages/:id
   * Update stage
   */
  app.put(
    '/api/pipeline-config/stages/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { id } = req.params;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const [updated] = await db
          .update(pipelineStages)
          .set({
            ...req.body,
            updatedAt: new Date(),
          })
          .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, user.tenantId)))
          .returning();

        if (!updated) {
          return res.status(404).json({ message: 'Stage not found' });
        }

        res.json(updated);
      } catch (error) {
        console.error('Error updating pipeline stage:', error);
        res.status(500).json({ message: 'Failed to update pipeline stage' });
      }
    },
  );

  /**
   * PUT /api/pipeline-config/stages/reorder
   * Reorder stages
   */
  app.put(
    '/api/pipeline-config/stages/reorder',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { stages } = req.body; // Array of { id, order }
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        if (!Array.isArray(stages)) {
          return res.status(400).json({ message: 'Stages array is required' });
        }

        await db.transaction(async (tx) => {
          for (const stage of stages) {
            await tx
              .update(pipelineStages)
              .set({ order: stage.order, updatedAt: new Date() })
              .where(
                and(eq(pipelineStages.id, stage.id), eq(pipelineStages.tenantId, user.tenantId)),
              );
          }
        });

        res.json({ message: 'Stages reordered successfully' });
      } catch (error) {
        console.error('Error reordering stages:', error);
        res.status(500).json({ message: 'Failed to reorder stages' });
      }
    },
  );

  /**
   * DELETE /api/pipeline-config/stages/:id
   * Delete stage
   */
  app.delete(
    '/api/pipeline-config/stages/:id',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { id } = req.params;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        // Check if stage has deals
        const dealsCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(deals)
          .where(and(eq(deals.tenantId, user.tenantId), eq(deals.currentStageId, id)));

        if (dealsCount[0].count > 0) {
          return res.status(400).json({
            message: `Cannot delete stage with ${dealsCount[0].count} deals in it`,
          });
        }

        await db
          .delete(pipelineStages)
          .where(and(eq(pipelineStages.id, id), eq(pipelineStages.tenantId, user.tenantId)));

        res.json({ message: 'Stage deleted successfully' });
      } catch (error) {
        console.error('Error deleting pipeline stage:', error);
        res.status(500).json({ message: 'Failed to delete pipeline stage' });
      }
    },
  );

  // ============================================================================
  // DEAL STAGE TRANSITIONS
  // ============================================================================

  /**
   * POST /api/pipeline-config/deals/:dealId/transition
   * Transition deal to new stage with automation
   */
  app.post(
    '/api/pipeline-config/deals/:dealId/transition',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { dealId } = req.params;
        const { toStageId, notes } = req.body;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        await db.transaction(async (tx) => {
          // Get current deal
          const [deal] = await tx
            .select()
            .from(deals)
            .where(and(eq(deals.id, dealId), eq(deals.tenantId, user.tenantId)))
            .limit(1);

          if (!deal) {
            throw new Error('Deal not found');
          }

          const fromStageId = deal.currentStageId;

          // Get stages
          const [fromStage] = fromStageId
            ? await tx
                .select()
                .from(pipelineStages)
                .where(eq(pipelineStages.id, fromStageId))
                .limit(1)
            : [null];

          const [toStage] = await tx
            .select()
            .from(pipelineStages)
            .where(eq(pipelineStages.id, toStageId))
            .limit(1);

          if (!toStage) {
            throw new Error('Target stage not found');
          }

          // Record stage history
          await tx.insert(dealStageHistory).values({
            tenantId: user.tenantId,
            dealId,
            fromStageId,
            fromStageName: fromStage?.displayName,
            toStageId,
            toStageName: toStage.displayName,
            transitionedById: user.id,
            transitionedByName: user.name,
            notes,
            durationDays: fromStage
              ? Math.floor(
                  (new Date().getTime() - new Date(deal.updatedAt || deal.createdAt).getTime()) /
                    (1000 * 60 * 60 * 24),
                )
              : 0,
          });

          // Update deal
          await tx
            .update(deals)
            .set({
              currentStageId: toStageId,
              stage: toStage.name,
              probability: toStage.defaultProbability,
              updatedAt: new Date(),
            })
            .where(eq(deals.id, dealId));

          // Execute automation triggers
          if (toStage.automationTriggers && Array.isArray(toStage.automationTriggers)) {
            for (const trigger of toStage.automationTriggers) {
              if (trigger.triggerType === 'on_enter' && trigger.isActive) {
                // Log automation execution
                await tx.insert(pipelineAutomationLogs).values({
                  tenantId: user.tenantId,
                  dealId,
                  stageId: toStageId,
                  triggerType: trigger.triggerType,
                  actionType: trigger.actionType,
                  actionConfig: trigger.actionConfig,
                  status: 'pending',
                  triggeredById: user.id,
                });

                // TODO: Execute actual automation actions
                // This would integrate with email service, task service, etc.
              }
            }
          }

          // Check SLA for new stage
          if (toStage.slaEnabled && toStage.slaDays) {
            const slaDeadline = new Date();
            slaDeadline.setDate(slaDeadline.getDate() + toStage.slaDays);

            await tx.update(deals).set({ slaDeadline }).where(eq(deals.id, dealId));
          }
        });

        res.json({ message: 'Deal transitioned successfully' });
      } catch (error) {
        console.error('Error transitioning deal:', error);
        res.status(500).json({ message: 'Failed to transition deal' });
      }
    },
  );

  /**
   * GET /api/pipeline-config/deals/:dealId/history
   * Get stage history for a deal
   */
  app.get(
    '/api/pipeline-config/deals/:dealId/history',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { dealId } = req.params;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const history = await db
          .select()
          .from(dealStageHistory)
          .where(
            and(eq(dealStageHistory.dealId, dealId), eq(dealStageHistory.tenantId, user.tenantId)),
          )
          .orderBy(desc(dealStageHistory.transitionedAt));

        res.json(history);
      } catch (error) {
        console.error('Error fetching deal history:', error);
        res.status(500).json({ message: 'Failed to fetch deal history' });
      }
    },
  );

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  /**
   * GET /api/pipeline-config/analytics/conversion
   * Get stage conversion analytics
   */
  app.get(
    '/api/pipeline-config/analytics/conversion',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        const { templateId } = req.query;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        // Get stage-to-stage conversion rates
        const conversionData = await db
          .select({
            fromStageId: dealStageHistory.fromStageId,
            fromStageName: dealStageHistory.fromStageName,
            toStageId: dealStageHistory.toStageId,
            toStageName: dealStageHistory.toStageName,
            count: sql<number>`count(*)`,
            avgDuration: sql<number>`avg(${dealStageHistory.durationDays})`,
          })
          .from(dealStageHistory)
          .where(eq(dealStageHistory.tenantId, user.tenantId))
          .groupBy(
            dealStageHistory.fromStageId,
            dealStageHistory.fromStageName,
            dealStageHistory.toStageId,
            dealStageHistory.toStageName,
          );

        res.json(conversionData);
      } catch (error) {
        console.error('Error fetching conversion analytics:', error);
        res.status(500).json({ message: 'Failed to fetch conversion analytics' });
      }
    },
  );

  /**
   * GET /api/pipeline-config/analytics/velocity
   * Get pipeline velocity metrics
   */
  app.get(
    '/api/pipeline-config/analytics/velocity',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { user } = req as AuthenticatedRequest;
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        // Average time in each stage
        const velocityData = await db
          .select({
            stageId: dealStageHistory.toStageId,
            stageName: dealStageHistory.toStageName,
            avgDays: sql<number>`avg(${dealStageHistory.durationDays})`,
            minDays: sql<number>`min(${dealStageHistory.durationDays})`,
            maxDays: sql<number>`max(${dealStageHistory.durationDays})`,
            count: sql<number>`count(*)`,
          })
          .from(dealStageHistory)
          .where(eq(dealStageHistory.tenantId, user.tenantId))
          .groupBy(dealStageHistory.toStageId, dealStageHistory.toStageName);

        res.json(velocityData);
      } catch (error) {
        console.error('Error fetching velocity analytics:', error);
        res.status(500).json({ message: 'Failed to fetch velocity analytics' });
      }
    },
  );

  console.log('✅ Pipeline Configuration routes registered');
}
