/**
 * Approval Workflow Service
 * Intelligent routing and automation for deal desk approvals
 */
import { db } from '../db';
import { eq, and, or, gte, lte, desc } from 'drizzle-orm';
import {
  approvalRules,
  approvalRequests,
  approvalComments,
  approvalDelegations,
  users,
  roles,
  type ApprovalRule,
  type ApprovalRequest,
  type InsertApprovalRequest,
} from '@shared/schema';

interface ApprovalCheckContext {
  dealId?: string;
  quoteId?: string;
  discountPercentage?: number;
  discountAmount?: number;
  margin?: number;
  dealValue?: number;
  totalContractValue?: number;
  paymentTermsDays?: number;
  customFields?: Record<string, any>;
}

interface ApprovalChainMember {
  level: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  decision?: 'approve' | 'reject' | 'request_changes';
  comments?: string;
  decidedAt?: string;
  delegatedTo?: string;
}

export class ApprovalWorkflowService {
  /**
   * Check if approval is required based on context
   */
  static async checkApprovalRequired(
    tenantId: string,
    context: ApprovalCheckContext
  ): Promise<{ required: boolean; matchedRules: ApprovalRule[] }> {
    // Get active approval rules for tenant
    const activeRules = await db
      .select()
      .from(approvalRules)
      .where(and(
        eq(approvalRules.tenantId, tenantId),
        eq(approvalRules.isActive, true)
      ))
      .orderBy(desc(approvalRules.priority), desc(approvalRules.order));

    const matchedRules: ApprovalRule[] = [];

    for (const rule of activeRules) {
      const matches = this.evaluateRule(rule, context);
      if (matches) {
        matchedRules.push(rule);
      }
    }

    return {
      required: matchedRules.length > 0,
      matchedRules,
    };
  }

  /**
   * Evaluate a single rule against context
   */
  private static evaluateRule(rule: ApprovalRule, context: ApprovalCheckContext): boolean {
    const { thresholdType, thresholdValue, comparisonOperator, conditions } = rule;

    // Get the value to compare based on threshold type
    let contextValue: number | undefined;

    switch (thresholdType) {
      case 'discount_percentage':
        contextValue = context.discountPercentage;
        break;
      case 'discount_amount':
        contextValue = context.discountAmount;
        break;
      case 'margin_below':
        contextValue = context.margin;
        break;
      case 'deal_value':
        contextValue = context.dealValue;
        break;
      case 'total_contract_value':
        contextValue = context.totalContractValue;
        break;
      case 'payment_terms_days':
        contextValue = context.paymentTermsDays;
        break;
      default:
        contextValue = undefined;
    }

    if (contextValue === undefined) {
      return false;
    }

    // Evaluate threshold comparison
    const thresholdMet = this.evaluateComparison(
      contextValue,
      Number(thresholdValue),
      comparisonOperator
    );

    if (!thresholdMet) {
      return false;
    }

    // Evaluate additional conditions if present
    if (conditions && conditions.length > 0) {
      return this.evaluateConditions(conditions, context);
    }

    return true;
  }

  /**
   * Evaluate comparison operator
   */
  private static evaluateComparison(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
      case '=':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Evaluate complex conditions with AND/OR logic
   */
  private static evaluateConditions(
    conditions: Array<{ field: string; operator: string; value: any; logicalOperator?: 'AND' | 'OR' }>,
    context: ApprovalCheckContext
  ): boolean {
    let result = true;
    let currentLogicalOperator: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const conditionMet = this.evaluateSingleCondition(condition, context);

      if (currentLogicalOperator === 'AND') {
        result = result && conditionMet;
      } else {
        result = result || conditionMet;
      }

      currentLogicalOperator = condition.logicalOperator || 'AND';
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private static evaluateSingleCondition(
    condition: { field: string; operator: string; value: any },
    context: ApprovalCheckContext
  ): boolean {
    const contextValue = (context as any)[condition.field] || context.customFields?.[condition.field];

    if (contextValue === undefined) {
      return false;
    }

    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'not_equals':
        return contextValue !== condition.value;
      case 'contains':
        return String(contextValue).includes(String(condition.value));
      case 'in_list':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'greater_than':
        return Number(contextValue) > Number(condition.value);
      case 'less_than':
        return Number(contextValue) < Number(condition.value);
      default:
        return false;
    }
  }

  /**
   * Build approval chain from matched rules
   */
  static async buildApprovalChain(
    tenantId: string,
    matchedRules: ApprovalRule[]
  ): Promise<ApprovalChainMember[]> {
    const approvalChain: ApprovalChainMember[] = [];
    const seenApprovers = new Set<string>();

    // Combine approvers from all matched rules
    for (const rule of matchedRules) {
      if (!rule.approvers || rule.approvers.length === 0) continue;

      for (const approver of rule.approvers) {
        const approverId = approver.userId || `role:${approver.roleId}`;

        // Skip duplicates unless multiple rules require different levels
        if (seenApprovers.has(approverId)) continue;

        seenApprovers.add(approverId);

        // Resolve actual user if role-based
        let resolvedUserId = approver.userId;
        let resolvedUserName = approver.userName || '';
        let resolvedRole = approver.roleName || '';

        if (approver.roleId && !approver.userId) {
          // Find users with this role
          const usersWithRole = await db
            .select({
              userId: users.id,
              userName: users.firstName,
              userLastName: users.lastName,
              roleName: roles.name,
            })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(and(
              eq(users.tenantId, tenantId),
              eq(users.roleId, approver.roleId)
            ))
            .limit(1);

          if (usersWithRole.length > 0) {
            const user = usersWithRole[0];
            resolvedUserId = user.userId;
            resolvedUserName = `${user.userName} ${user.userLastName}`;
            resolvedRole = user.roleName || '';
          }
        }

        if (!resolvedUserId) continue;

        // Check for active delegations
        const delegation = await this.getActiveDelegation(tenantId, resolvedUserId);

        approvalChain.push({
          level: approver.level,
          approverId: delegation ? delegation.delegateId : resolvedUserId,
          approverName: resolvedUserName,
          approverRole: resolvedRole,
          status: 'pending',
          delegatedTo: delegation ? delegation.delegateId : undefined,
        });
      }
    }

    // Sort by level
    approvalChain.sort((a, b) => a.level - b.level);

    return approvalChain;
  }

  /**
   * Check for active delegation
   */
  private static async getActiveDelegation(tenantId: string, delegatorId: string) {
    const now = new Date();

    const [delegation] = await db
      .select()
      .from(approvalDelegations)
      .where(and(
        eq(approvalDelegations.tenantId, tenantId),
        eq(approvalDelegations.delegatorId, delegatorId),
        eq(approvalDelegations.isActive, true),
        lte(approvalDelegations.startDate, now),
        gte(approvalDelegations.endDate, now)
      ))
      .limit(1);

    return delegation;
  }

  /**
   * Create approval request
   */
  static async createApprovalRequest(
    requestData: InsertApprovalRequest,
    matchedRules: ApprovalRule[]
  ): Promise<ApprovalRequest> {
    // Build approval chain
    const approvalChain = await this.buildApprovalChain(
      requestData.tenantId,
      matchedRules
    );

    // Calculate SLA deadline (use strictest SLA from matched rules)
    const minSlaHours = Math.min(...matchedRules.map(r => r.slaHours || 24));
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + minSlaHours);

    // Create activity log entry
    const activityLog = [{
      timestamp: new Date().toISOString(),
      actor: requestData.requestedBy,
      action: 'created',
      details: 'Approval request created',
      metadata: {
        matchedRules: matchedRules.map(r => r.id),
      },
    }];

    const [approvalRequest] = await db
      .insert(approvalRequests)
      .values({
        ...requestData,
        approvalChain,
        slaDeadline,
        activityLog,
        currentApprovalLevel: 1,
      })
      .returning();

    // Send notifications to first level approvers
    await this.notifyApprovers(approvalRequest, 1);

    return approvalRequest;
  }

  /**
   * Process approval decision
   */
  static async processDecision(
    requestId: string,
    approverId: string,
    decision: 'approve' | 'reject' | 'request_changes',
    comments?: string
  ): Promise<ApprovalRequest> {
    const [request] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId));

    if (!request) {
      throw new Error('Approval request not found');
    }

    // Update approval chain
    const updatedChain = request.approvalChain.map((member: ApprovalChainMember) => {
      if (member.approverId === approverId && member.status === 'pending') {
        return {
          ...member,
          status: decision === 'approve' ? 'approved' : 'rejected',
          decision,
          comments,
          decidedAt: new Date().toISOString(),
        };
      }
      return member;
    });

    // Add to activity log
    const activityLog = [
      ...(request.activityLog || []),
      {
        timestamp: new Date().toISOString(),
        actor: approverId,
        action: decision,
        details: comments || `Request ${decision}ed`,
      },
    ];

    // Determine new status
    let newStatus = request.status;
    let finalDecision: string | null = null;
    let finalDecisionBy: string | null = null;
    let finalDecisionAt: Date | null = null;

    if (decision === 'reject') {
      // Immediate rejection
      newStatus = 'rejected';
      finalDecision = 'rejected';
      finalDecisionBy = approverId;
      finalDecisionAt = new Date();
    } else if (decision === 'approve') {
      // Check if all required approvers have approved
      const allApproved = updatedChain.every(
        (m: ApprovalChainMember) => m.status === 'approved' || m.status === 'skipped'
      );

      if (allApproved) {
        newStatus = 'approved';
        finalDecision = 'approved';
        finalDecisionBy = approverId;
        finalDecisionAt = new Date();
      } else {
        // Move to next level
        const nextLevel = Math.min(...updatedChain
          .filter((m: ApprovalChainMember) => m.status === 'pending')
          .map((m: ApprovalChainMember) => m.level));

        newStatus = 'in_review';

        // Notify next level approvers
        const updated = await db
          .update(approvalRequests)
          .set({
            approvalChain: updatedChain,
            status: newStatus,
            currentApprovalLevel: nextLevel,
            activityLog,
            updatedAt: new Date(),
          })
          .where(eq(approvalRequests.id, requestId))
          .returning();

        await this.notifyApprovers(updated[0], nextLevel);
        return updated[0];
      }
    }

    // Update request
    const [updatedRequest] = await db
      .update(approvalRequests)
      .set({
        approvalChain: updatedChain,
        status: newStatus,
        finalDecision,
        finalDecisionBy,
        finalDecisionAt,
        completedAt: finalDecisionAt,
        activityLog,
        updatedAt: new Date(),
      })
      .where(eq(approvalRequests.id, requestId))
      .returning();

    // Send final notifications
    if (finalDecision) {
      await this.notifyOutcome(updatedRequest);
    }

    return updatedRequest;
  }

  /**
   * Check for SLA breaches and escalate
   */
  static async checkSLAAndEscalate(): Promise<void> {
    const now = new Date();

    // Find requests past SLA deadline
    const overdueRequests = await db
      .select()
      .from(approvalRequests)
      .where(and(
        or(
          eq(approvalRequests.status, 'pending'),
          eq(approvalRequests.status, 'in_review')
        ),
        lte(approvalRequests.slaDeadline, now),
        eq(approvalRequests.slaBreached, false)
      ));

    for (const request of overdueRequests) {
      // Mark as breached
      await db
        .update(approvalRequests)
        .set({
          slaBreached: true,
          escalatedAt: now,
          updatedAt: now,
        })
        .where(eq(approvalRequests.id, request.id));

      // Send escalation notifications
      await this.notifyEscalation(request);
    }
  }

  /**
   * Send notifications to approvers at specific level
   */
  private static async notifyApprovers(request: ApprovalRequest, level: number): Promise<void> {
    const approversAtLevel = request.approvalChain.filter(
      (m: ApprovalChainMember) => m.level === level && m.status === 'pending'
    );

    // TODO: Integrate with email/notification service
    console.log(`Notifying ${approversAtLevel.length} approvers for request ${request.id}`);

    for (const approver of approversAtLevel) {
      // Send email/push notification
      console.log(`  - ${approver.approverName} (${approver.approverId})`);
    }
  }

  /**
   * Notify requester and stakeholders of outcome
   */
  private static async notifyOutcome(request: ApprovalRequest): Promise<void> {
    // TODO: Integrate with email/notification service
    console.log(`Approval request ${request.id} ${request.finalDecision}: notifying ${request.requestedBy}`);
  }

  /**
   * Notify about SLA escalation
   */
  private static async notifyEscalation(request: ApprovalRequest): Promise<void> {
    // TODO: Integrate with email/notification service
    console.log(`SLA breached for request ${request.id}: escalating`);
  }

  /**
   * Get pending approvals for a user
   */
  static async getPendingApprovalsForUser(
    tenantId: string,
    userId: string
  ): Promise<ApprovalRequest[]> {
    const allRequests = await db
      .select()
      .from(approvalRequests)
      .where(and(
        eq(approvalRequests.tenantId, tenantId),
        or(
          eq(approvalRequests.status, 'pending'),
          eq(approvalRequests.status, 'in_review')
        )
      ));

    // Filter to requests where user is a pending approver
    return allRequests.filter(request =>
      request.approvalChain.some((m: ApprovalChainMember) =>
        m.approverId === userId && m.status === 'pending'
      )
    );
  }

  /**
   * Add comment to approval request
   */
  static async addComment(
    requestId: string,
    authorId: string,
    authorName: string,
    commentText: string,
    isInternal: boolean = false
  ): Promise<void> {
    await db.insert(approvalComments).values({
      tenantId: '', // Will be set by route handler
      approvalRequestId: requestId,
      commentText,
      authorId,
      authorName,
      isInternal,
    });
  }
}
