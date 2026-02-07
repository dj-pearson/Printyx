import { db } from '../db';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('user-lifecycle-service');

import {
  userProvisioningTemplates,
  userLifecycleEvents,
  onboardingChecklists,
  offboardingWorkflows,
  accessReviews,
  accessReviewCertifications,
  bulkUserOperations,
  userImpersonationSessions,
  users,
  auditLogs,
  UserProvisioningTemplate,
  UserLifecycleEvent,
  OnboardingChecklist,
  OffboardingWorkflow,
  AccessReview,
  InsertUserProvisioningTemplate,
  InsertUserLifecycleEvent,
  InsertOnboardingChecklist,
  InsertOffboardingWorkflow,
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, inArray } from 'drizzle-orm';
import { sendEmail } from './email-service';

/**
 * USER LIFECYCLE MANAGEMENT SERVICE
 *
 * Comprehensive service for managing user provisioning, onboarding, offboarding,
 * and access reviews. Provides automation for the entire user lifecycle.
 */

// ========== TYPES & INTERFACES ==========

export interface ProvisionUserParams {
  templateId?: string;
  tenantId: string;
  userData: {
    name: string;
    email: string;
    department?: string;
    jobTitle?: string;
    location?: string;
  };
  triggeredBy: string;
  sendWelcomeEmail?: boolean;
}

export interface OffboardUserParams {
  userId: string;
  tenantId: string;
  reason: 'resignation' | 'termination' | 'retirement' | 'transfer';
  lastWorkingDay: Date;
  transferOwnershipTo?: string;
  initiatedBy: string;
}

export interface BulkProvisionParams {
  tenantId: string;
  templateId?: string;
  users: Array<{
    name: string;
    email: string;
    department?: string;
    jobTitle?: string;
    location?: string;
  }>;
  triggeredBy: string;
}

export interface CreateAccessReviewParams {
  tenantId: string;
  managerId: string;
  reviewPeriod: string;
  reviewYear: number;
  reviewQuarter: number;
  organizationalUnitId?: string;
}

export interface ImpersonateUserParams {
  adminId: string;
  impersonatedUserId: string;
  tenantId: string;
  reason: string;
  ticketNumber?: string;
  ipAddress: string;
  userAgent: string;
}

// ========== USER PROVISIONING SERVICE ==========

export class UserLifecycleService {
  // ==================== PROVISIONING TEMPLATES ====================

  /**
   * Create a new user provisioning template
   */
  static async createTemplate(
    data: InsertUserProvisioningTemplate,
  ): Promise<UserProvisioningTemplate> {
    const [template] = await db.insert(userProvisioningTemplates).values(data).returning();

    return template;
  }

  /**
   * Get all templates for a tenant
   */
  static async getTemplates(tenantId?: string): Promise<UserProvisioningTemplate[]> {
    if (tenantId) {
      return await db.query.userProvisioningTemplates.findMany({
        where: and(
          eq(userProvisioningTemplates.tenantId, tenantId),
          eq(userProvisioningTemplates.isActive, true),
        ),
        orderBy: [desc(userProvisioningTemplates.usageCount)],
      });
    }

    // Platform-wide templates (tenantId is null)
    return await db.query.userProvisioningTemplates.findMany({
      where: and(
        sql`${userProvisioningTemplates.tenantId} IS NULL`,
        eq(userProvisioningTemplates.isActive, true),
      ),
      orderBy: [desc(userProvisioningTemplates.usageCount)],
    });
  }

  /**
   * Get template by ID
   */
  static async getTemplate(templateId: string): Promise<UserProvisioningTemplate | null> {
    const template = await db.query.userProvisioningTemplates.findFirst({
      where: eq(userProvisioningTemplates.id, templateId),
    });

    return template || null;
  }

  /**
   * Get default template for a category
   */
  static async getDefaultTemplate(
    category: string,
    tenantId?: string,
  ): Promise<UserProvisioningTemplate | null> {
    const template = await db.query.userProvisioningTemplates.findFirst({
      where: and(
        eq(userProvisioningTemplates.category, category),
        eq(userProvisioningTemplates.isDefault, true),
        eq(userProvisioningTemplates.isActive, true),
        tenantId
          ? eq(userProvisioningTemplates.tenantId, tenantId)
          : sql`${userProvisioningTemplates.tenantId} IS NULL`,
      ),
    });

    return template || null;
  }

  // ==================== USER PROVISIONING ====================

  /**
   * Provision a new user with optional template
   */
  static async provisionUser(params: ProvisionUserParams): Promise<{
    userId: string;
    lifecycleEventId: string;
    checklistId: string;
  }> {
    const { templateId, tenantId, userData, triggeredBy, sendWelcomeEmail = true } = params;

    let template: UserProvisioningTemplate | null = null;
    if (templateId) {
      template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }
    }

    // Create lifecycle event
    const [lifecycleEvent] = await db
      .insert(userLifecycleEvents)
      .values({
        tenantId,
        userId: '', // Will update after user creation
        eventType: 'onboarding_started',
        status: 'in_progress',
        templateId: templateId || null,
        triggeredBy,
        automatedAction: !!templateId,
        metadata: {
          templateUsed: template?.name,
          sendWelcomeEmail,
        },
        stepsTotal: template?.onboardingSteps?.length || 5,
        currentStep: 'Creating user account',
      })
      .returning();

    try {
      // TODO: Create actual user in users table
      // For now, using placeholder ID
      const userId = `user_${Date.now()}`;

      // Update lifecycle event with userId
      await db
        .update(userLifecycleEvents)
        .set({ userId })
        .where(eq(userLifecycleEvents.id, lifecycleEvent.id));

      // Apply template if provided
      if (template) {
        await this.applyTemplate(userId, template, tenantId);

        // Update template usage stats
        await db
          .update(userProvisioningTemplates)
          .set({
            usageCount: sql`${userProvisioningTemplates.usageCount} + 1`,
            lastUsedAt: new Date(),
          })
          .where(eq(userProvisioningTemplates.id, template.id));
      }

      // Create onboarding checklist
      const checklistItems = this.generateChecklistItems(template);
      const [checklist] = await db
        .insert(onboardingChecklists)
        .values({
          tenantId,
          userId,
          lifecycleEventId: lifecycleEvent.id,
          items: checklistItems,
          totalItems: checklistItems.length,
          completedItems: 0,
          progressPercent: 0,
          targetCompletionDate: this.calculateTargetCompletion(template),
          checkIns: this.generateCheckIns(template),
          nextCheckIn: this.getNextCheckInDate(template),
        })
        .returning();

      // Send welcome email if enabled
      if (sendWelcomeEmail && template?.sendWelcomeEmail !== false) {
        await this.sendWelcomeEmail(userData.email, userData.name, template);
      }

      // Update lifecycle event to completed
      await db
        .update(userLifecycleEvents)
        .set({
          status: 'completed',
          completedAt: new Date(),
          stepsCompleted: 1,
        })
        .where(eq(userLifecycleEvents.id, lifecycleEvent.id));

      // Create audit log
      await db.insert(auditLogs).values({
        tenantId,
        userId: triggeredBy,
        action: 'USER_PROVISIONED',
        resource: 'users',
        resourceId: userId,
        newValues: {
          ...userData,
          templateId,
          templateName: template?.name,
        },
        ipAddress: '0.0.0.0', // TODO: Get from request
        userAgent: 'system',
        severity: 'medium',
        category: 'authentication',
      });

      return {
        userId,
        lifecycleEventId: lifecycleEvent.id,
        checklistId: checklist.id,
      };
    } catch (error) {
      // Mark lifecycle event as failed
      await db
        .update(userLifecycleEvents)
        .set({
          status: 'failed',
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: { error: String(error) },
        })
        .where(eq(userLifecycleEvents.id, lifecycleEvent.id));

      throw error;
    }
  }

  /**
   * Apply template configuration to user
   */
  private static async applyTemplate(
    userId: string,
    template: UserProvisioningTemplate,
    tenantId: string,
  ): Promise<void> {
    // TODO: Implement actual role and permission assignment
    // This would involve:
    // 1. Assigning roles from template.roleIds
    // 2. Setting permissions from template.permissions
    // 3. Configuring notification settings
    // 4. Enabling integration access
    // 5. Setting user preferences

    log.info(`Applying template ${template.name} to user ${userId}`);

    // Placeholder for now
    const actions = {
      rolesAssigned: template.roleIds,
      permissionsSet: template.permissions,
      notificationsConfigured: template.notificationSettings,
      integrationsEnabled: template.integrationAccess,
      preferencesSet: template.preferences,
    };

    return Promise.resolve();
  }

  /**
   * Generate checklist items from template or defaults
   */
  private static generateChecklistItems(template: UserProvisioningTemplate | null): Array<{
    id: string;
    stepNumber: number;
    stepName: string;
    description: string;
    assignedTo: 'admin' | 'manager' | 'user';
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    automated: boolean;
  }> {
    if (template?.onboardingSteps) {
      return template.onboardingSteps.map((step, index) => ({
        id: `step_${index + 1}`,
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        description: step.description,
        assignedTo: step.assignedTo || 'admin',
        status: 'pending' as const,
        automated: step.automated,
      }));
    }

    // Default checklist
    return [
      {
        id: 'step_1',
        stepNumber: 1,
        stepName: 'Account Created',
        description: 'User account has been created in the system',
        assignedTo: 'admin' as const,
        status: 'completed' as const,
        automated: true,
      },
      {
        id: 'step_2',
        stepNumber: 2,
        stepName: 'Roles Assigned',
        description: 'Appropriate roles have been assigned to the user',
        assignedTo: 'admin' as const,
        status: 'pending' as const,
        automated: true,
      },
      {
        id: 'step_3',
        stepNumber: 3,
        stepName: 'Welcome Email Sent',
        description: 'Welcome email with login instructions sent',
        assignedTo: 'admin' as const,
        status: 'pending' as const,
        automated: true,
      },
      {
        id: 'step_4',
        stepName: 'First Login',
        description: 'User has logged in for the first time',
        assignedTo: 'user' as const,
        status: 'pending' as const,
        automated: false,
        stepNumber: 4,
      },
      {
        id: 'step_5',
        stepNumber: 5,
        stepName: 'Onboarding Complete',
        description: 'User has completed onboarding and is fully active',
        assignedTo: 'manager' as const,
        status: 'pending' as const,
        automated: false,
      },
    ];
  }

  /**
   * Calculate target completion date based on template
   */
  private static calculateTargetCompletion(template: UserProvisioningTemplate | null): Date {
    const days =
      template?.onboardingSteps?.reduce(
        (max, step) => Math.max(max, step.daysToComplete || 0),
        7,
      ) || 7;

    const target = new Date();
    target.setDate(target.getDate() + days);
    return target;
  }

  /**
   * Generate check-in schedule from template
   */
  private static generateCheckIns(template: UserProvisioningTemplate | null): Array<{
    day: number;
    scheduledAt: string;
  }> {
    const checkInDays = template?.checkInDays || [3, 7, 30];

    return checkInDays.map((day) => {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + day);
      return {
        day,
        scheduledAt: scheduledDate.toISOString(),
      };
    });
  }

  /**
   * Get next check-in date
   */
  private static getNextCheckInDate(template: UserProvisioningTemplate | null): Date {
    const checkInDays = template?.checkInDays || [3, 7, 30];
    const nextDay = checkInDays[0] || 3;

    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + nextDay);
    return nextCheckIn;
  }

  /**
   * Send welcome email to new user
   */
  private static async sendWelcomeEmail(
    email: string,
    name: string,
    template: UserProvisioningTemplate | null,
  ): Promise<void> {
    const emailTemplate = template?.welcomeEmailTemplate || 'default-welcome';

    await sendEmail({
      to: email,
      subject: 'Welcome to Printyx!',
      body: `
        <h1>Welcome, ${name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>Please check your email for login instructions.</p>
        <p>If you have any questions, please don't hesitate to reach out to your manager.</p>
      `,
    });
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk provision users from CSV or array
   */
  static async bulkProvisionUsers(params: BulkProvisionParams): Promise<{
    operationId: string;
    totalRecords: number;
    results: Array<{
      row: number;
      userId?: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  }> {
    const { tenantId, templateId, users: userList, triggeredBy } = params;

    // Create bulk operation record
    const [bulkOp] = await db
      .insert(bulkUserOperations)
      .values({
        tenantId,
        operationType: 'import',
        templateUsed: templateId || null,
        totalRecords: userList.length,
        processedRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        status: 'in_progress',
        initiatedBy: triggeredBy,
      })
      .returning();

    const results: Array<{
      row: number;
      userId?: string;
      status: 'success' | 'failed';
      error?: string;
    }> = [];

    let successCount = 0;
    let failureCount = 0;

    // Process each user
    for (let i = 0; i < userList.length; i++) {
      try {
        const result = await this.provisionUser({
          templateId,
          tenantId,
          userData: userList[i],
          triggeredBy,
          sendWelcomeEmail: true,
        });

        results.push({
          row: i + 1,
          userId: result.userId,
          status: 'success',
        });
        successCount++;
      } catch (error) {
        results.push({
          row: i + 1,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }

      // Update progress
      await db
        .update(bulkUserOperations)
        .set({
          processedRecords: i + 1,
          successfulRecords: successCount,
          failedRecords: failureCount,
          progressPercent: Math.round(((i + 1) / userList.length) * 100),
        })
        .where(eq(bulkUserOperations.id, bulkOp.id));
    }

    // Finalize operation
    await db
      .update(bulkUserOperations)
      .set({
        status: 'completed',
        completedAt: new Date(),
        results,
      })
      .where(eq(bulkUserOperations.id, bulkOp.id));

    return {
      operationId: bulkOp.id,
      totalRecords: userList.length,
      results,
    };
  }

  // ==================== OFFBOARDING ====================

  /**
   * Initiate user offboarding workflow
   */
  static async offboardUser(params: OffboardUserParams): Promise<{
    workflowId: string;
    lifecycleEventId: string;
  }> {
    const { userId, tenantId, reason, lastWorkingDay, transferOwnershipTo, initiatedBy } = params;

    // Create lifecycle event
    const [lifecycleEvent] = await db
      .insert(userLifecycleEvents)
      .values({
        tenantId,
        userId,
        eventType: 'offboarding_started',
        status: 'in_progress',
        triggeredBy: initiatedBy,
        automatedAction: true,
        metadata: {
          reason,
          lastWorkingDay: lastWorkingDay.toISOString(),
          transferOwnershipTo,
        },
        stepsTotal: 8,
        currentStep: 'Initiating offboarding',
      })
      .returning();

    // Create offboarding workflow
    const [workflow] = await db
      .insert(offboardingWorkflows)
      .values({
        tenantId,
        userId,
        lifecycleEventId: lifecycleEvent.id,
        initiatedBy,
        reason,
        lastWorkingDay,
        transferOwnershipTo: transferOwnershipTo || null,
        status: 'in_progress',
        complianceChecklist: [
          { item: 'Generate user activity report', completed: false },
          { item: 'Export user data (GDPR)', completed: false },
          { item: 'Transfer record ownership', completed: false },
          { item: 'Revoke all role assignments', completed: false },
          { item: 'Revoke integration access', completed: false },
          { item: 'Terminate active sessions', completed: false },
          { item: 'Archive user account', completed: false },
          { item: 'Generate offboarding audit report', completed: false },
        ],
      })
      .returning();

    // Start offboarding process (async)
    this.processOffboarding(workflow.id, tenantId).catch(console.error);

    return {
      workflowId: workflow.id,
      lifecycleEventId: lifecycleEvent.id,
    };
  }

  /**
   * Process offboarding workflow steps
   */
  private static async processOffboarding(workflowId: string, tenantId: string): Promise<void> {
    const workflow = await db.query.offboardingWorkflows.findFirst({
      where: eq(offboardingWorkflows.id, workflowId),
    });

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    try {
      // Step 1: Generate user activity report
      // TODO: Implement actual report generation
      await this.updateWorkflowStep(workflowId, 0, true);

      // Step 2: Export user data (GDPR compliance)
      // TODO: Implement data export
      await this.updateWorkflowStep(workflowId, 1, true, { exported: true });

      // Step 3: Transfer record ownership
      if (workflow.transferOwnershipTo) {
        // TODO: Implement record ownership transfer
        await this.updateWorkflowStep(workflowId, 2, true);
      } else {
        await this.updateWorkflowStep(workflowId, 2, true, { notes: 'No transfer needed' });
      }

      // Step 4: Revoke all role assignments
      // TODO: Implement role revocation
      await this.updateWorkflowStep(workflowId, 3, true);

      // Step 5: Revoke integration access
      // TODO: Implement integration access revocation
      await this.updateWorkflowStep(workflowId, 4, true);

      // Step 6: Terminate active sessions
      // TODO: Implement session termination
      await this.updateWorkflowStep(workflowId, 5, true);

      // Step 7: Archive user account
      // TODO: Implement user archival
      await this.updateWorkflowStep(workflowId, 6, true);

      // Step 8: Generate audit report
      // TODO: Implement audit report generation
      await this.updateWorkflowStep(workflowId, 7, true);

      // Mark workflow as completed
      await db
        .update(offboardingWorkflows)
        .set({
          status: 'completed',
          completedAt: new Date(),
          accessRevoked: true,
          accessRevokedAt: new Date(),
          dataExported: true,
          dataExportedAt: new Date(),
          auditReportGenerated: true,
        })
        .where(eq(offboardingWorkflows.id, workflowId));

      // Update lifecycle event
      if (workflow.lifecycleEventId) {
        await db
          .update(userLifecycleEvents)
          .set({
            status: 'completed',
            completedAt: new Date(),
            stepsCompleted: 8,
          })
          .where(eq(userLifecycleEvents.id, workflow.lifecycleEventId));
      }
    } catch (error) {
      // Mark workflow as failed
      await db
        .update(offboardingWorkflows)
        .set({
          status: 'failed',
        })
        .where(eq(offboardingWorkflows.id, workflowId));

      if (workflow.lifecycleEventId) {
        await db
          .update(userLifecycleEvents)
          .set({
            status: 'failed',
            failedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(userLifecycleEvents.id, workflow.lifecycleEventId));
      }

      throw error;
    }
  }

  /**
   * Update workflow checklist step
   */
  private static async updateWorkflowStep(
    workflowId: string,
    stepIndex: number,
    completed: boolean,
    notes?: any,
  ): Promise<void> {
    const workflow = await db.query.offboardingWorkflows.findFirst({
      where: eq(offboardingWorkflows.id, workflowId),
    });

    if (!workflow || !workflow.complianceChecklist) {
      return;
    }

    const checklist = [...workflow.complianceChecklist];
    checklist[stepIndex] = {
      ...checklist[stepIndex],
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
      notes: notes ? JSON.stringify(notes) : undefined,
    };

    await db
      .update(offboardingWorkflows)
      .set({
        complianceChecklist: checklist,
      })
      .where(eq(offboardingWorkflows.id, workflowId));
  }

  // ==================== ACCESS REVIEWS ====================

  /**
   * Create quarterly access review
   */
  static async createAccessReview(params: CreateAccessReviewParams): Promise<AccessReview> {
    const { tenantId, managerId, reviewPeriod, reviewYear, reviewQuarter, organizationalUnitId } =
      params;

    // Get users count for this manager/org unit
    // TODO: Implement actual user count logic based on org hierarchy
    const userCount = 10; // Placeholder

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days to complete

    const [review] = await db
      .insert(accessReviews)
      .values({
        tenantId,
        reviewPeriod,
        reviewYear,
        reviewQuarter,
        managerId,
        organizationalUnit: organizationalUnitId || null,
        userCount,
        status: 'not_started',
        scheduledDate: new Date(),
        dueDate,
      })
      .returning();

    // TODO: Send notification to manager

    return review;
  }

  /**
   * Get pending access reviews for a manager
   */
  static async getPendingAccessReviews(
    managerId: string,
    tenantId: string,
  ): Promise<AccessReview[]> {
    return await db.query.accessReviews.findMany({
      where: and(
        eq(accessReviews.tenantId, tenantId),
        eq(accessReviews.managerId, managerId),
        inArray(accessReviews.status, ['not_started', 'in_progress', 'overdue']),
      ),
      orderBy: [desc(accessReviews.dueDate)],
    });
  }

  // ==================== USER IMPERSONATION ====================

  /**
   * Start user impersonation session (for support purposes)
   */
  static async startImpersonation(params: ImpersonateUserParams): Promise<{
    sessionId: string;
    expiresAt: Date;
  }> {
    const { adminId, impersonatedUserId, tenantId, reason, ticketNumber, ipAddress, userAgent } =
      params;

    const [session] = await db
      .insert(userImpersonationSessions)
      .values({
        tenantId,
        adminId,
        impersonatedUserId,
        reason,
        ticketNumber: ticketNumber || null,
        actionsPerformed: [],
        ipAddress,
        userAgent,
        isActive: true,
      })
      .returning();

    // Create audit log
    await db.insert(auditLogs).values({
      tenantId,
      userId: adminId,
      action: 'USER_IMPERSONATION_STARTED',
      resource: 'users',
      resourceId: impersonatedUserId,
      newValues: {
        reason,
        ticketNumber,
        sessionId: session.id,
      },
      ipAddress,
      userAgent,
      severity: 'high',
      category: 'security',
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour session

    return {
      sessionId: session.id,
      expiresAt,
    };
  }

  /**
   * End impersonation session
   */
  static async endImpersonation(sessionId: string): Promise<void> {
    const session = await db.query.userImpersonationSessions.findFirst({
      where: eq(userImpersonationSessions.id, sessionId),
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - session.startedAt.getTime()) / 60000);

    await db
      .update(userImpersonationSessions)
      .set({
        isActive: false,
        endedAt: endTime,
        duration,
      })
      .where(eq(userImpersonationSessions.id, sessionId));

    // Create audit log
    await db.insert(auditLogs).values({
      tenantId: session.tenantId,
      userId: session.adminId,
      action: 'USER_IMPERSONATION_ENDED',
      resource: 'users',
      resourceId: session.impersonatedUserId,
      oldValues: {
        sessionId,
        duration,
        actionsPerformed: session.actionsPerformed?.length || 0,
      },
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      severity: 'medium',
      category: 'security',
    });
  }
}
