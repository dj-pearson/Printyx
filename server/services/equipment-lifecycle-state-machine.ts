import { db } from "../db/index";
import { eq, desc, and } from "drizzle-orm";
import {
  equipmentLifecycle,
  equipmentLifecycleTransitions,
  lifecycleTransitionRules,
  type EquipmentLifecycle,
  type InsertEquipmentLifecycleTransition,
} from "@shared/schema";

// Valid lifecycle stages
export const LIFECYCLE_STAGES = {
  ORDERED: 'ordered',
  RECEIVED: 'received',
  STAGED: 'staged',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  INSTALLED: 'installed',
  ACTIVE: 'active',
  MAINTENANCE: 'maintenance',
  RETIRED: 'retired',
  DISPOSED: 'disposed',
  TRADED_IN: 'traded_in',
} as const;

export type LifecycleStage = typeof LIFECYCLE_STAGES[keyof typeof LIFECYCLE_STAGES];

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  passed: ValidationCheck[];
  failed: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message?: string;
}

// Transition result interface
export interface TransitionResult {
  success: boolean;
  transition?: any;
  newStage: string;
  error?: string;
}

// Transition history item
export interface TransitionHistoryItem {
  id: string;
  fromStage: string | null;
  toStage: string;
  transitionType: string;
  triggeredBy: string | null;
  triggeredAt: Date;
  reason?: string | null;
  status: string;
  validationsPassed?: any;
  validationsFailed?: any;
}

/**
 * Equipment Lifecycle State Machine
 *
 * Manages equipment transitions through lifecycle stages with:
 * - Validation enforcement
 * - Transition history tracking
 * - Automatic action triggers
 * - Rollback capabilities
 */
export class EquipmentLifecycleStateMachine {

  /**
   * Define valid transitions between stages
   * This enforces business rules about which stage transitions are allowed
   */
  private static VALID_TRANSITIONS: Record<string, string[]> = {
    [LIFECYCLE_STAGES.ORDERED]: [LIFECYCLE_STAGES.RECEIVED, LIFECYCLE_STAGES.RETIRED],
    [LIFECYCLE_STAGES.RECEIVED]: [LIFECYCLE_STAGES.STAGED, LIFECYCLE_STAGES.RETIRED],
    [LIFECYCLE_STAGES.STAGED]: [LIFECYCLE_STAGES.IN_TRANSIT, LIFECYCLE_STAGES.RETIRED],
    [LIFECYCLE_STAGES.IN_TRANSIT]: [LIFECYCLE_STAGES.DELIVERED, LIFECYCLE_STAGES.STAGED], // Can return to staged
    [LIFECYCLE_STAGES.DELIVERED]: [LIFECYCLE_STAGES.INSTALLED, LIFECYCLE_STAGES.RETIRED],
    [LIFECYCLE_STAGES.INSTALLED]: [LIFECYCLE_STAGES.ACTIVE, LIFECYCLE_STAGES.RETIRED],
    [LIFECYCLE_STAGES.ACTIVE]: [LIFECYCLE_STAGES.MAINTENANCE, LIFECYCLE_STAGES.RETIRED],
    [LIFECYCLE_STAGES.MAINTENANCE]: [LIFECYCLE_STAGES.ACTIVE, LIFECYCLE_STAGES.RETIRED],
    [LIFECYCLE_STAGES.RETIRED]: [LIFECYCLE_STAGES.DISPOSED, LIFECYCLE_STAGES.TRADED_IN],
    [LIFECYCLE_STAGES.DISPOSED]: [], // Terminal state
    [LIFECYCLE_STAGES.TRADED_IN]: [], // Terminal state
  };

  /**
   * Define validation requirements for each transition
   */
  private static VALIDATIONS: Record<string, Record<string, string[]>> = {
    [LIFECYCLE_STAGES.RECEIVED]: {
      [LIFECYCLE_STAGES.STAGED]: [
        'quality_control_passed',
        'serial_number_verified',
        'photo_documentation',
      ],
    },
    [LIFECYCLE_STAGES.STAGED]: {
      [LIFECYCLE_STAGES.IN_TRANSIT]: [
        'delivery_scheduled',
        'driver_assigned',
        'customer_notified',
      ],
    },
    [LIFECYCLE_STAGES.IN_TRANSIT]: {
      [LIFECYCLE_STAGES.DELIVERED]: [
        'delivery_signature_collected',
        'equipment_condition_verified',
      ],
    },
    [LIFECYCLE_STAGES.DELIVERED]: {
      [LIFECYCLE_STAGES.INSTALLED]: [
        'delivery_signature',
        'equipment_unpacked',
        'site_inspection_passed',
      ],
    },
    [LIFECYCLE_STAGES.INSTALLED]: {
      [LIFECYCLE_STAGES.ACTIVE]: [
        'installation_completed',
        'configuration_backed_up',
        'customer_trained',
        'acceptance_signed',
      ],
    },
    [LIFECYCLE_STAGES.ACTIVE]: {
      [LIFECYCLE_STAGES.RETIRED]: [
        'maintenance_history_reviewed',
        'customer_notification_sent',
        'replacement_planned',
      ],
    },
    [LIFECYCLE_STAGES.RETIRED]: {
      [LIFECYCLE_STAGES.DISPOSED]: [
        'data_wiped_confirmed',
        'disposal_vendor_selected',
        'certificate_of_destruction',
      ],
      [LIFECYCLE_STAGES.TRADED_IN]: [
        'trade_in_evaluation_completed',
        'trade_in_credit_approved',
        'customer_acceptance',
      ],
    },
  };

  /**
   * Check if a transition is valid
   */
  static canTransition(fromStage: string, toStage: string): boolean {
    const allowedTransitions = this.VALID_TRANSITIONS[fromStage];
    return allowedTransitions?.includes(toStage) ?? false;
  }

  /**
   * Run validations for a specific equipment transition
   */
  private static async runValidations(
    equipmentId: string,
    requiredValidations: string[]
  ): Promise<ValidationCheck[]> {
    // This would integrate with actual validation logic
    // For now, return mock validation results

    const results: ValidationCheck[] = [];

    for (const validation of requiredValidations) {
      // In a real implementation, this would check actual conditions
      // For example:
      // - Check if delivery signature exists
      // - Verify quality control checks completed
      // - Confirm documentation uploaded

      results.push({
        name: validation,
        passed: true, // Mock: assume all pass for now
        message: `${validation} verified`,
      });
    }

    return results;
  }

  /**
   * Validate all requirements for a transition
   */
  static async validateTransition(
    equipmentId: string,
    fromStage: string,
    toStage: string
  ): Promise<ValidationResult> {
    const requiredValidations = this.VALIDATIONS[fromStage]?.[toStage] || [];

    if (requiredValidations.length === 0) {
      return {
        isValid: true,
        passed: [],
        failed: [],
      };
    }

    const validationResults = await this.runValidations(equipmentId, requiredValidations);

    return {
      isValid: validationResults.every(v => v.passed),
      passed: validationResults.filter(v => v.passed),
      failed: validationResults.filter(v => !v.passed),
    };
  }

  /**
   * Execute a lifecycle stage transition
   *
   * @param equipmentId - UUID of equipment
   * @param toStage - Target lifecycle stage
   * @param userId - UUID of user initiating transition
   * @param reason - Optional reason for transition
   * @param metadata - Optional transition-specific data
   * @returns TransitionResult
   */
  static async transition(
    equipmentId: string,
    toStage: string,
    userId: string,
    tenantId: string,
    reason?: string,
    metadata?: any
  ): Promise<TransitionResult> {
    try {
      return await db.transaction(async (tx) => {
        // 1. Get current equipment state
        const [equipment] = await tx
          .select()
          .from(equipmentLifecycle)
          .where(
            and(
              eq(equipmentLifecycle.equipmentId, equipmentId),
              eq(equipmentLifecycle.tenantId, tenantId)
            )
          );

        if (!equipment) {
          throw new Error(`Equipment ${equipmentId} not found`);
        }

        const fromStage = equipment.currentStage;

        // 2. Check if transition is allowed
        if (!this.canTransition(fromStage, toStage)) {
          throw new Error(
            `Invalid transition: ${fromStage} → ${toStage}. ` +
            `Valid transitions from ${fromStage}: ${this.VALID_TRANSITIONS[fromStage]?.join(', ') || 'none'}`
          );
        }

        // 3. Validate requirements
        const validation = await this.validateTransition(equipmentId, fromStage, toStage);

        if (!validation.isValid) {
          throw new Error(
            `Validation failed: ${validation.failed.map(f => f.name).join(', ')}. ` +
            `Please complete required steps before transitioning.`
          );
        }

        // 4. Update equipment stage
        await tx
          .update(equipmentLifecycle)
          .set({
            currentStage: toStage,
            metadata: {
              ...(equipment.metadata as any),
              lastTransitionAt: new Date().toISOString(),
              lastTransitionBy: userId,
            },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(equipmentLifecycle.equipmentId, equipmentId),
              eq(equipmentLifecycle.tenantId, tenantId)
            )
          );

        // 5. Record transition
        const [transition] = await tx
          .insert(equipmentLifecycleTransitions)
          .values({
            tenantId,
            equipmentId,
            fromStage,
            toStage,
            transitionType: 'manual',
            triggeredBy: userId,
            triggeredAt: new Date(),
            reason,
            metadata,
            validationsPassed: validation.passed,
            validationsFailed: validation.failed,
            status: 'completed',
          })
          .returning();

        // 6. Trigger post-transition actions
        await this.triggerPostTransitionActions(
          equipmentId,
          fromStage,
          toStage,
          tenantId,
          tx
        );

        return {
          success: true,
          transition,
          newStage: toStage,
        };
      });
    } catch (error: any) {
      console.error('Transition error:', error);
      return {
        success: false,
        newStage: toStage,
        error: error.message,
      };
    }
  }

  /**
   * Get transition history for equipment
   */
  static async getHistory(
    equipmentId: string,
    tenantId: string
  ): Promise<TransitionHistoryItem[]> {
    const transitions = await db
      .select()
      .from(equipmentLifecycleTransitions)
      .where(
        and(
          eq(equipmentLifecycleTransitions.equipmentId, equipmentId),
          eq(equipmentLifecycleTransitions.tenantId, tenantId)
        )
      )
      .orderBy(desc(equipmentLifecycleTransitions.triggeredAt));

    return transitions.map(t => ({
      id: t.id,
      fromStage: t.fromStage,
      toStage: t.toStage,
      transitionType: t.transitionType,
      triggeredBy: t.triggeredBy,
      triggeredAt: t.triggeredAt!,
      reason: t.reason,
      status: t.status,
      validationsPassed: t.validationsPassed,
      validationsFailed: t.validationsFailed,
    }));
  }

  /**
   * Check if rollback is allowed
   */
  static async canRollback(transitionId: string, tenantId: string): Promise<boolean> {
    const [transition] = await db
      .select()
      .from(equipmentLifecycleTransitions)
      .where(
        and(
          eq(equipmentLifecycleTransitions.id, transitionId),
          eq(equipmentLifecycleTransitions.tenantId, tenantId)
        )
      );

    if (!transition) return false;

    // Check if already rolled back
    if (transition.isRollback) return false;

    // Check time limit (24 hours default)
    const hoursSinceTransition =
      (Date.now() - transition.triggeredAt!.getTime()) / (1000 * 60 * 60);

    if (hoursSinceTransition > 24) return false;

    // Check if transition type allows rollback
    return transition.transitionType !== 'automatic';
  }

  /**
   * Rollback a transition
   */
  static async rollback(
    transitionId: string,
    userId: string,
    tenantId: string,
    reason: string
  ): Promise<TransitionResult> {
    try {
      return await db.transaction(async (tx) => {
        // Get the original transition
        const [originalTransition] = await tx
          .select()
          .from(equipmentLifecycleTransitions)
          .where(
            and(
              eq(equipmentLifecycleTransitions.id, transitionId),
              eq(equipmentLifecycleTransitions.tenantId, tenantId)
            )
          );

        if (!originalTransition) {
          throw new Error('Transition not found');
        }

        if (!originalTransition.fromStage) {
          throw new Error('Cannot rollback initial transition');
        }

        // Create rollback transition
        const result = await this.transition(
          originalTransition.equipmentId,
          originalTransition.fromStage,
          userId,
          tenantId,
          `Rollback: ${reason}`,
          { originalTransitionId: transitionId }
        );

        if (result.success) {
          // Mark original as rolled back
          await tx
            .update(equipmentLifecycleTransitions)
            .set({
              isRollback: true,
              rollbackReason: reason,
              status: 'rolled_back',
            })
            .where(eq(equipmentLifecycleTransitions.id, transitionId));
        }

        return result;
      });
    } catch (error: any) {
      console.error('Rollback error:', error);
      return {
        success: false,
        newStage: '',
        error: error.message,
      };
    }
  }

  /**
   * Trigger automated actions after successful transition
   */
  private static async triggerPostTransitionActions(
    equipmentId: string,
    fromStage: string,
    toStage: string,
    tenantId: string,
    tx: any
  ): Promise<void> {
    // Define post-transition actions
    const actions: Record<string, Record<string, () => Promise<void>>> = {
      [LIFECYCLE_STAGES.RECEIVED]: {
        [LIFECYCLE_STAGES.STAGED]: async () => {
          console.log(`[State Machine] Equipment ${equipmentId}: Generate asset label/QR code`);
          // TODO: Integrate with QR code generation service
        },
      },
      [LIFECYCLE_STAGES.DELIVERED]: {
        [LIFECYCLE_STAGES.INSTALLED]: async () => {
          console.log(`[State Machine] Equipment ${equipmentId}: Schedule 30-day follow-up`);
          // TODO: Schedule follow-up service check
        },
      },
      [LIFECYCLE_STAGES.INSTALLED]: {
        [LIFECYCLE_STAGES.ACTIVE]: async () => {
          console.log(`[State Machine] Equipment ${equipmentId}: Activate monitoring & send welcome email`);
          // TODO: Activate equipment monitoring
          // TODO: Register warranty
          // TODO: Send welcome email to customer
        },
      },
      [LIFECYCLE_STAGES.ACTIVE]: {
        [LIFECYCLE_STAGES.RETIRED]: async () => {
          console.log(`[State Machine] Equipment ${equipmentId}: Deactivate monitoring`);
          // TODO: Deactivate equipment monitoring
          // TODO: Send retirement notification
        },
      },
      [LIFECYCLE_STAGES.RETIRED]: {
        [LIFECYCLE_STAGES.DISPOSED]: async () => {
          console.log(`[State Machine] Equipment ${equipmentId}: Trigger disposal workflow`);
          // TODO: Create disposal record
          // TODO: Notify disposal vendor
        },
        [LIFECYCLE_STAGES.TRADED_IN]: async () => {
          console.log(`[State Machine] Equipment ${equipmentId}: Trigger trade-in workflow`);
          // TODO: Create trade-in record
          // TODO: Apply credit to customer account
        },
      },
    };

    const action = actions[fromStage]?.[toStage];
    if (action) {
      try {
        await action();
      } catch (error) {
        console.error(`[State Machine] Post-transition action failed for ${fromStage} → ${toStage}:`, error);
        // Don't throw - transition should still succeed even if post-action fails
      }
    }
  }

  /**
   * Get available next stages for equipment
   */
  static getAvailableTransitions(currentStage: string): string[] {
    return this.VALID_TRANSITIONS[currentStage] || [];
  }

  /**
   * Get validation requirements for a transition
   */
  static getValidationRequirements(fromStage: string, toStage: string): string[] {
    return this.VALIDATIONS[fromStage]?.[toStage] || [];
  }
}
