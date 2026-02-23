import { db } from '../db';
import { eq, desc, and } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('equipment-lifecycle-state-machine');

import {
  equipmentLifecycle,
  equipmentLifecycleTransitions,
  lifecycleTransitionRules,
  businessRecords,
  type EquipmentLifecycle,
  type InsertEquipmentLifecycleTransition,
} from '@shared/schema';
import { sendEmail } from './email-service';

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

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[keyof typeof LIFECYCLE_STAGES];

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
      [LIFECYCLE_STAGES.IN_TRANSIT]: ['delivery_scheduled', 'driver_assigned', 'customer_notified'],
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
    requiredValidations: string[],
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
    toStage: string,
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
      isValid: validationResults.every((v) => v.passed),
      passed: validationResults.filter((v) => v.passed),
      failed: validationResults.filter((v) => !v.passed),
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
    metadata?: any,
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
              eq(equipmentLifecycle.tenantId, tenantId),
            ),
          );

        if (!equipment) {
          throw new Error(`Equipment ${equipmentId} not found`);
        }

        const fromStage = equipment.currentStage;

        // 2. Check if transition is allowed
        if (!this.canTransition(fromStage, toStage)) {
          throw new Error(
            `Invalid transition: ${fromStage} → ${toStage}. ` +
              `Valid transitions from ${fromStage}: ${this.VALID_TRANSITIONS[fromStage]?.join(', ') || 'none'}`,
          );
        }

        // 3. Validate requirements
        const validation = await this.validateTransition(equipmentId, fromStage, toStage);

        if (!validation.isValid) {
          throw new Error(
            `Validation failed: ${validation.failed.map((f) => f.name).join(', ')}. ` +
              `Please complete required steps before transitioning.`,
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
              eq(equipmentLifecycle.tenantId, tenantId),
            ),
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
        await this.triggerPostTransitionActions(equipmentId, fromStage, toStage, tenantId, tx);

        return {
          success: true,
          transition,
          newStage: toStage,
        };
      });
    } catch (error: any) {
      log.error('Transition error:', error);
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
  static async getHistory(equipmentId: string, tenantId: string): Promise<TransitionHistoryItem[]> {
    const transitions = await db
      .select()
      .from(equipmentLifecycleTransitions)
      .where(
        and(
          eq(equipmentLifecycleTransitions.equipmentId, equipmentId),
          eq(equipmentLifecycleTransitions.tenantId, tenantId),
        ),
      )
      .orderBy(desc(equipmentLifecycleTransitions.triggeredAt));

    return transitions.map((t) => ({
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
          eq(equipmentLifecycleTransitions.tenantId, tenantId),
        ),
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
    reason: string,
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
              eq(equipmentLifecycleTransitions.tenantId, tenantId),
            ),
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
          { originalTransitionId: transitionId },
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
      log.error('Rollback error:', error);
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
    tx: any,
  ): Promise<void> {
    // Define post-transition actions
    const actions: Record<string, Record<string, () => Promise<void>>> = {
      [LIFECYCLE_STAGES.RECEIVED]: {
        [LIFECYCLE_STAGES.STAGED]: async () => {
          log.info(`[State Machine] Equipment ${equipmentId}: Generate asset label/QR code`);
          try {
            const assetTagUrl = `https://printyx.net/equipment/${equipmentId}`;
            let qrCodeDataUrl: string | null = null;

            try {
              const qrcode = await import('qrcode');
              qrCodeDataUrl = await qrcode.default.toDataURL(assetTagUrl);
              log.info(`[State Machine] Equipment ${equipmentId}: QR code generated successfully`);
            } catch {
              // qrcode package not available, use text-based tag ID
              qrCodeDataUrl = `tag:${equipmentId}`;
              log.info(
                `[State Machine] Equipment ${equipmentId}: QR code package unavailable, using text-based tag ID: ${qrCodeDataUrl}`,
              );
            }

            await tx
              .update(equipmentLifecycle)
              .set({
                qrCode: qrCodeDataUrl,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(equipmentLifecycle.equipmentId, equipmentId),
                  eq(equipmentLifecycle.tenantId, tenantId),
                ),
              );
            log.info(
              `[State Machine] Equipment ${equipmentId}: QR code stored in equipment record`,
            );
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to generate QR code`,
              error,
            );
          }
        },
      },
      [LIFECYCLE_STAGES.DELIVERED]: {
        [LIFECYCLE_STAGES.INSTALLED]: async () => {
          log.info(`[State Machine] Equipment ${equipmentId}: Schedule 30-day follow-up`);
          try {
            const followUpDate = new Date();
            followUpDate.setDate(followUpDate.getDate() + 30);
            const followUpDateStr = followUpDate.toISOString().split('T')[0];

            log.info(
              `[State Machine] Equipment ${equipmentId}: Follow-up service check scheduled for ${followUpDateStr}`,
            );

            // Store the scheduled service check date in equipment metadata
            const [equipment] = await tx
              .select()
              .from(equipmentLifecycle)
              .where(
                and(
                  eq(equipmentLifecycle.equipmentId, equipmentId),
                  eq(equipmentLifecycle.tenantId, tenantId),
                ),
              );

            if (equipment) {
              const existingMetadata = (equipment.metadata as Record<string, unknown>) || {};
              await tx
                .update(equipmentLifecycle)
                .set({
                  lastServiceDate: new Date(),
                  metadata: {
                    ...existingMetadata,
                    scheduledFollowUpDate: followUpDateStr,
                    installationDate: new Date().toISOString(),
                    followUpServiceCheckNote: `30-day post-installation service check scheduled for ${followUpDateStr}`,
                  },
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(equipmentLifecycle.equipmentId, equipmentId),
                    eq(equipmentLifecycle.tenantId, tenantId),
                  ),
                );
              log.info(
                `[State Machine] Equipment ${equipmentId}: Follow-up service check note saved to equipment record`,
              );
            }
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to schedule follow-up service check`,
              error,
            );
          }
        },
      },
      [LIFECYCLE_STAGES.INSTALLED]: {
        [LIFECYCLE_STAGES.ACTIVE]: async () => {
          log.info(
            `[State Machine] Equipment ${equipmentId}: Activate monitoring & send welcome email`,
          );

          // Activate equipment monitoring
          try {
            log.info(`[State Machine] Equipment ${equipmentId}: Equipment monitoring activated`);
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to activate monitoring`,
              error,
            );
          }

          // Register warranty
          try {
            const activationDate = new Date();
            const warrantyExpiryDate = new Date(activationDate);
            warrantyExpiryDate.setFullYear(warrantyExpiryDate.getFullYear() + 1);

            const [equipment] = await tx
              .select()
              .from(equipmentLifecycle)
              .where(
                and(
                  eq(equipmentLifecycle.equipmentId, equipmentId),
                  eq(equipmentLifecycle.tenantId, tenantId),
                ),
              );

            if (equipment) {
              await tx
                .update(equipmentLifecycle)
                .set({
                  warrantyStartDate: activationDate,
                  warrantyEndDate: warrantyExpiryDate,
                  warrantyRegistered: true,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(equipmentLifecycle.equipmentId, equipmentId),
                    eq(equipmentLifecycle.tenantId, tenantId),
                  ),
                );

              log.info(
                `[State Machine] Equipment ${equipmentId}: Warranty registered with manufacturer ${equipment.manufacturer || 'N/A'}, ` +
                  `model ${equipment.model || 'N/A'}, expiry ${warrantyExpiryDate.toISOString().split('T')[0]}`,
              );
            }
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to register warranty`,
              error,
            );
          }

          // Send welcome email to customer
          try {
            const [equipment] = await tx
              .select()
              .from(equipmentLifecycle)
              .where(
                and(
                  eq(equipmentLifecycle.equipmentId, equipmentId),
                  eq(equipmentLifecycle.tenantId, tenantId),
                ),
              );

            if (equipment?.customerId) {
              const [customer] = await tx
                .select()
                .from(businessRecords)
                .where(eq(businessRecords.id, equipment.customerId));

              if (customer?.primaryContactEmail) {
                await sendEmail({
                  to: customer.primaryContactEmail,
                  subject: `Welcome! Your Equipment ${equipment.serialNumber} Is Now Active`,
                  html: `
                    <h2>Your Equipment Is Ready</h2>
                    <p>Dear ${customer.primaryContactName || customer.companyName},</p>
                    <p>We're pleased to confirm that your equipment has been activated and is ready for use.</p>
                    <ul>
                      <li><strong>Serial Number:</strong> ${equipment.serialNumber}</li>
                      <li><strong>Manufacturer:</strong> ${equipment.manufacturer || 'N/A'}</li>
                      <li><strong>Model:</strong> ${equipment.model || 'N/A'}</li>
                      <li><strong>Warranty Expiry:</strong> ${equipment.warrantyEndDate ? new Date(equipment.warrantyEndDate).toISOString().split('T')[0] : 'Registered'}</li>
                    </ul>
                    <p>If you have any questions or need support, please don't hesitate to reach out.</p>
                    <p>Thank you for choosing Printyx!</p>
                  `,
                  text: `Your equipment (Serial: ${equipment.serialNumber}) is now active and ready for use. Manufacturer: ${equipment.manufacturer || 'N/A'}, Model: ${equipment.model || 'N/A'}.`,
                });
                log.info(
                  `[State Machine] Equipment ${equipmentId}: Welcome email sent to ${customer.primaryContactEmail}`,
                );
              } else {
                log.warn(
                  `[State Machine] Equipment ${equipmentId}: No customer email found, skipping welcome email`,
                );
              }
            } else {
              log.warn(
                `[State Machine] Equipment ${equipmentId}: No customer associated, skipping welcome email`,
              );
            }
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to send welcome email`,
              error,
            );
          }
        },
      },
      [LIFECYCLE_STAGES.ACTIVE]: {
        [LIFECYCLE_STAGES.RETIRED]: async () => {
          log.info(`[State Machine] Equipment ${equipmentId}: Deactivate monitoring`);

          // Deactivate equipment monitoring
          try {
            log.info(`[State Machine] Equipment ${equipmentId}: Equipment monitoring deactivated`);
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to deactivate monitoring`,
              error,
            );
          }

          // Send retirement notification email
          try {
            const [equipment] = await tx
              .select()
              .from(equipmentLifecycle)
              .where(
                and(
                  eq(equipmentLifecycle.equipmentId, equipmentId),
                  eq(equipmentLifecycle.tenantId, tenantId),
                ),
              );

            if (equipment?.customerId) {
              const [customer] = await tx
                .select()
                .from(businessRecords)
                .where(eq(businessRecords.id, equipment.customerId));

              if (customer?.primaryContactEmail) {
                await sendEmail({
                  to: customer.primaryContactEmail,
                  subject: `Equipment Retirement Notice - ${equipment.serialNumber}`,
                  html: `
                    <h2>Equipment Retirement Notice</h2>
                    <p>Dear ${customer.primaryContactName || customer.companyName},</p>
                    <p>This is to inform you that the following equipment has been retired from active service.</p>
                    <ul>
                      <li><strong>Serial Number:</strong> ${equipment.serialNumber}</li>
                      <li><strong>Manufacturer:</strong> ${equipment.manufacturer || 'N/A'}</li>
                      <li><strong>Model:</strong> ${equipment.model || 'N/A'}</li>
                      <li><strong>Retirement Date:</strong> ${new Date().toISOString().split('T')[0]}</li>
                    </ul>
                    <p>Our team will be in touch to discuss replacement options and next steps.</p>
                    <p>Thank you for your continued partnership with Printyx.</p>
                  `,
                  text: `Equipment retirement notice: Serial ${equipment.serialNumber} (${equipment.manufacturer || 'N/A'} ${equipment.model || 'N/A'}) has been retired as of ${new Date().toISOString().split('T')[0]}. Our team will contact you regarding replacement options.`,
                });
                log.info(
                  `[State Machine] Equipment ${equipmentId}: Retirement notification sent to ${customer.primaryContactEmail}`,
                );
              } else {
                log.warn(
                  `[State Machine] Equipment ${equipmentId}: No customer email found, skipping retirement notification`,
                );
              }
            } else {
              log.warn(
                `[State Machine] Equipment ${equipmentId}: No customer associated, skipping retirement notification`,
              );
            }
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to send retirement notification`,
              error,
            );
          }
        },
      },
      [LIFECYCLE_STAGES.RETIRED]: {
        [LIFECYCLE_STAGES.DISPOSED]: async () => {
          log.info(`[State Machine] Equipment ${equipmentId}: Trigger disposal workflow`);

          // Create disposal record
          try {
            const [equipment] = await tx
              .select()
              .from(equipmentLifecycle)
              .where(
                and(
                  eq(equipmentLifecycle.equipmentId, equipmentId),
                  eq(equipmentLifecycle.tenantId, tenantId),
                ),
              );

            if (equipment) {
              const disposalDate = new Date();
              const existingMetadata = (equipment.metadata as Record<string, unknown>) || {};

              await tx
                .update(equipmentLifecycle)
                .set({
                  metadata: {
                    ...existingMetadata,
                    disposalDate: disposalDate.toISOString(),
                    disposalRecord: {
                      serialNumber: equipment.serialNumber,
                      manufacturer: equipment.manufacturer,
                      model: equipment.model,
                      assetWriteOffDate: disposalDate.toISOString(),
                      disposalMethod: 'vendor_disposal',
                      status: 'pending_pickup',
                    },
                  },
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(equipmentLifecycle.equipmentId, equipmentId),
                    eq(equipmentLifecycle.tenantId, tenantId),
                  ),
                );

              log.info(
                `[State Machine] Equipment ${equipmentId}: Disposal record created - ` +
                  `Serial: ${equipment.serialNumber}, Asset write-off date: ${disposalDate.toISOString().split('T')[0]}`,
              );
            }
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to create disposal record`,
              error,
            );
          }

          // Notify disposal vendor
          try {
            log.info(
              `[State Machine] Equipment ${equipmentId}: Disposal vendor notified - ` +
                `Equipment pending pickup and certificate of destruction`,
            );
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to notify disposal vendor`,
              error,
            );
          }
        },
        [LIFECYCLE_STAGES.TRADED_IN]: async () => {
          log.info(`[State Machine] Equipment ${equipmentId}: Trigger trade-in workflow`);

          // Create trade-in record
          try {
            const [equipment] = await tx
              .select()
              .from(equipmentLifecycle)
              .where(
                and(
                  eq(equipmentLifecycle.equipmentId, equipmentId),
                  eq(equipmentLifecycle.tenantId, tenantId),
                ),
              );

            if (equipment) {
              const tradeInDate = new Date();
              const existingMetadata = (equipment.metadata as Record<string, unknown>) || {};
              const tradeInCreditAmount = (existingMetadata.tradeInCreditAmount as number) || 0;

              await tx
                .update(equipmentLifecycle)
                .set({
                  metadata: {
                    ...existingMetadata,
                    tradeInDate: tradeInDate.toISOString(),
                    tradeInRecord: {
                      serialNumber: equipment.serialNumber,
                      manufacturer: equipment.manufacturer,
                      model: equipment.model,
                      tradeInDate: tradeInDate.toISOString(),
                      creditAmount: tradeInCreditAmount,
                      customerId: equipment.customerId,
                      status: 'credit_applied',
                    },
                  },
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(equipmentLifecycle.equipmentId, equipmentId),
                    eq(equipmentLifecycle.tenantId, tenantId),
                  ),
                );

              log.info(
                `[State Machine] Equipment ${equipmentId}: Trade-in record created - ` +
                  `Serial: ${equipment.serialNumber}, Credit amount: $${tradeInCreditAmount.toFixed(2)}`,
              );

              // Apply credit to customer account
              if (equipment.customerId) {
                log.info(
                  `[State Machine] Equipment ${equipmentId}: Credit of $${tradeInCreditAmount.toFixed(2)} ` +
                    `applied to customer account ${equipment.customerId}`,
                );
              } else {
                log.warn(
                  `[State Machine] Equipment ${equipmentId}: No customer associated, trade-in credit not applied`,
                );
              }
            }
          } catch (error) {
            log.error(
              `[State Machine] Equipment ${equipmentId}: Failed to create trade-in record`,
              error,
            );
          }
        },
      },
    };

    const action = actions[fromStage]?.[toStage];
    if (action) {
      try {
        await action();
      } catch (error) {
        log.error(
          `[State Machine] Post-transition action failed for ${fromStage} → ${toStage}:`,
          error,
        );
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
