/**
 * Approval Workflow Service
 * Intelligent routing and automation for deal desk approvals
 */
import { db } from '../db';
import { eq, and, or, gte, lte, desc, inArray } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('approval-workflow-service');

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

import { sendEmail } from './email-service';

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
    context: ApprovalCheckContext,
  ): Promise<{ required: boolean; matchedRules: ApprovalRule[] }> {
    // Get active approval rules for tenant
    const activeRules = await db
      .select()
      .from(approvalRules)
      .where(and(eq(approvalRules.tenantId, tenantId), eq(approvalRules.isActive, true)))
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
      comparisonOperator,
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
    conditions: Array<{
      field: string;
      operator: string;
      value: any;
      logicalOperator?: 'AND' | 'OR';
    }>,
    context: ApprovalCheckContext,
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
    context: ApprovalCheckContext,
  ): boolean {
    const contextValue =
      (context as any)[condition.field] || context.customFields?.[condition.field];

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
    matchedRules: ApprovalRule[],
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
            .where(and(eq(users.tenantId, tenantId), eq(users.roleId, approver.roleId)))
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
      .where(
        and(
          eq(approvalDelegations.tenantId, tenantId),
          eq(approvalDelegations.delegatorId, delegatorId),
          eq(approvalDelegations.isActive, true),
          lte(approvalDelegations.startDate, now),
          gte(approvalDelegations.endDate, now),
        ),
      )
      .limit(1);

    return delegation;
  }

  /**
   * Create approval request
   */
  static async createApprovalRequest(
    requestData: InsertApprovalRequest,
    matchedRules: ApprovalRule[],
  ): Promise<ApprovalRequest> {
    // Build approval chain
    const approvalChain = await this.buildApprovalChain(requestData.tenantId, matchedRules);

    // Calculate SLA deadline (use strictest SLA from matched rules)
    const minSlaHours = Math.min(...matchedRules.map((r) => r.slaHours || 24));
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + minSlaHours);

    // Create activity log entry
    const activityLog = [
      {
        timestamp: new Date().toISOString(),
        actor: requestData.requestedBy,
        action: 'created',
        details: 'Approval request created',
        metadata: {
          matchedRules: matchedRules.map((r) => r.id),
        },
      },
    ];

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
    comments?: string,
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
        (m: ApprovalChainMember) => m.status === 'approved' || m.status === 'skipped',
      );

      if (allApproved) {
        newStatus = 'approved';
        finalDecision = 'approved';
        finalDecisionBy = approverId;
        finalDecisionAt = new Date();
      } else {
        // Move to next level
        const nextLevel = Math.min(
          ...updatedChain
            .filter((m: ApprovalChainMember) => m.status === 'pending')
            .map((m: ApprovalChainMember) => m.level),
        );

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
      .where(
        and(
          or(eq(approvalRequests.status, 'pending'), eq(approvalRequests.status, 'in_review')),
          lte(approvalRequests.slaDeadline, now),
          eq(approvalRequests.slaBreached, false),
        ),
      );

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
  private static async notifyApprovers(
    request: ApprovalRequest,
    level: number,
    isReminder: boolean = false,
  ): Promise<void> {
    const approversAtLevel = request.approvalChain.filter(
      (m: ApprovalChainMember) => m.level === level && m.status === 'pending',
    );

    log.info(
      `Notifying ${approversAtLevel.length} approvers for request ${request.id}${isReminder ? ' (reminder)' : ''}`,
    );

    // Look up approver emails from users table
    const approverIds = approversAtLevel.map((a) => a.approverId);
    if (approverIds.length === 0) return;

    const approverUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, approverIds));

    const approverEmailMap = new Map(approverUsers.map((u) => [u.id, u.email]));

    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
    const approvalUrl = `${baseUrl}/deal-desk/approvals/${request.id}`;
    const requestTypePretty = (request.requestType || 'approval').replace(/_/g, ' ');
    const requesterName = request.requestedByName || 'A team member';
    const reminderPrefix = isReminder ? 'Reminder: ' : '';

    for (const approver of approversAtLevel) {
      const email = approverEmailMap.get(approver.approverId);
      if (!email) {
        log.warn(`No email found for approver ${approver.approverId} (${approver.approverName})`);
        continue;
      }

      const subject = `${reminderPrefix}Approval Required: ${requestTypePretty} from ${requesterName}`;

      try {
        await sendEmail({
          to: email,
          subject,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
                .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
                .detail-label { font-weight: 600; color: #6b7280; min-width: 140px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">${isReminder ? 'Reminder: ' : ''}Approval Required</h1>
                  <p style="margin: 8px 0 0 0; opacity: 0.9;">${requestTypePretty}</p>
                </div>
                <div class="content">
                  <p>Hello ${approver.approverName},</p>

                  <p>${isReminder ? 'This is a reminder that an approval request is still awaiting your review.' : 'A new approval request requires your review.'}</p>

                  <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 12px 0;">Request Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280; width: 140px;">Title</td>
                        <td style="padding: 6px 0;">${request.requestTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Type</td>
                        <td style="padding: 6px 0;">${requestTypePretty}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Requested By</td>
                        <td style="padding: 6px 0;">${requesterName}</td>
                      </tr>
                      ${
                        request.dealValue
                          ? `
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Deal Value</td>
                        <td style="padding: 6px 0;">$${Number(request.dealValue).toLocaleString()}</td>
                      </tr>`
                          : ''
                      }
                      ${
                        request.discountPercentage
                          ? `
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Discount</td>
                        <td style="padding: 6px 0;">${request.discountPercentage}%</td>
                      </tr>`
                          : ''
                      }
                      ${
                        request.proposedMargin
                          ? `
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Proposed Margin</td>
                        <td style="padding: 6px 0;">${request.proposedMargin}%</td>
                      </tr>`
                          : ''
                      }
                    </table>
                  </div>

                  ${
                    request.businessJustification
                      ? `
                  <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin: 0 0 8px 0; color: #1e40af;">Business Justification</h4>
                    <p style="margin: 0;">${request.businessJustification}</p>
                  </div>`
                      : ''
                  }

                  <p style="text-align: center;">
                    <a href="${approvalUrl}" class="button">Review &amp; Decide</a>
                  </p>

                  <p style="font-size: 13px; color: #6b7280;">Or copy and paste this link: <a href="${approvalUrl}" style="color: #2563eb;">${approvalUrl}</a></p>

                  ${
                    request.slaDeadline
                      ? `
                  <p style="font-size: 13px; color: #dc2626; font-weight: 600;">SLA Deadline: ${new Date(request.slaDeadline).toLocaleString()}</p>`
                      : ''
                  }
                </div>
                <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Printyx. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `${isReminder ? 'Reminder: ' : ''}Approval Required: ${requestTypePretty} from ${requesterName}

Hello ${approver.approverName},

${isReminder ? 'This is a reminder that an approval request is still awaiting your review.' : 'A new approval request requires your review.'}

REQUEST DETAILS:
- Title: ${request.requestTitle}
- Type: ${requestTypePretty}
- Requested By: ${requesterName}${request.dealValue ? `\n- Deal Value: $${Number(request.dealValue).toLocaleString()}` : ''}${request.discountPercentage ? `\n- Discount: ${request.discountPercentage}%` : ''}

${request.businessJustification ? `Business Justification: ${request.businessJustification}\n` : ''}
Review and decide: ${approvalUrl}
${request.slaDeadline ? `\nSLA Deadline: ${new Date(request.slaDeadline).toLocaleString()}` : ''}

(c) ${new Date().getFullYear()} Printyx`,
        });

        log.info(`  - Sent approval email to ${approver.approverName} (${email})`);
      } catch (error) {
        log.error(`Failed to send approval email to ${approver.approverName} (${email}):`, error);
      }
    }
  }

  /**
   * Notify requester and stakeholders of outcome
   */
  private static async notifyOutcome(request: ApprovalRequest): Promise<void> {
    log.info(
      `Approval request ${request.id} ${request.finalDecision}: notifying ${request.requestedBy}`,
    );

    // Look up requester email
    const [requester] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, request.requestedBy))
      .limit(1);

    if (!requester?.email) {
      log.warn(`No email found for requester ${request.requestedBy}`);
      return;
    }

    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
    const requestUrl = `${baseUrl}/deal-desk/approvals/${request.id}`;
    const requestTypePretty = (request.requestType || 'approval').replace(/_/g, ' ');
    const isApproved = request.finalDecision === 'approved';
    const decisionLabel = isApproved ? 'Approved' : 'Denied';
    const requesterName =
      request.requestedByName ||
      `${requester.firstName || ''} ${requester.lastName || ''}`.trim() ||
      'there';

    // Find the approver who made the final decision
    const finalApprover = request.approvalChain.find(
      (m: ApprovalChainMember) => m.approverId === request.finalDecisionBy,
    );
    const approverName = finalApprover?.approverName || 'An approver';
    const decisionComments = request.finalDecisionComments || finalApprover?.comments || '';

    const subject = `Approval ${decisionLabel}: ${requestTypePretty}`;

    try {
      await sendEmail({
        to: requester.email,
        subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, ${isApproved ? '#059669 0%, #10b981' : '#dc2626 0%, #ef4444'} 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
              .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">${isApproved ? 'Approved' : 'Denied'}</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9;">Your ${requestTypePretty} request</p>
              </div>
              <div class="content">
                <p>Hello ${requesterName},</p>

                <p>Your approval request <strong>${request.requestTitle}</strong> has been <strong style="color: ${isApproved ? '#059669' : '#dc2626'};">${decisionLabel.toLowerCase()}</strong> by ${approverName}.</p>

                <div style="background: ${isApproved ? '#f0fdf4' : '#fef2f2'}; padding: 16px; border-radius: 8px; border-left: 4px solid ${isApproved ? '#22c55e' : '#ef4444'}; margin: 20px 0;">
                  <h3 style="margin: 0 0 8px 0; color: ${isApproved ? '#166534' : '#991b1b'};">Decision: ${decisionLabel}</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #6b7280; width: 140px;">Decided By</td>
                      <td style="padding: 4px 0;">${approverName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #6b7280;">Decision Date</td>
                      <td style="padding: 4px 0;">${request.finalDecisionAt ? new Date(request.finalDecisionAt).toLocaleString() : new Date().toLocaleString()}</td>
                    </tr>
                    ${
                      decisionComments
                        ? `
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #6b7280; vertical-align: top;">Comments</td>
                      <td style="padding: 4px 0;">${decisionComments}</td>
                    </tr>`
                        : ''
                    }
                  </table>
                </div>

                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="margin: 0 0 8px 0;">Request Summary</h4>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #6b7280; width: 140px;">Type</td>
                      <td style="padding: 4px 0;">${requestTypePretty}</td>
                    </tr>
                    ${
                      request.dealValue
                        ? `
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #6b7280;">Deal Value</td>
                      <td style="padding: 4px 0;">$${Number(request.dealValue).toLocaleString()}</td>
                    </tr>`
                        : ''
                    }
                    ${
                      request.discountPercentage
                        ? `
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; color: #6b7280;">Discount</td>
                      <td style="padding: 4px 0;">${request.discountPercentage}%</td>
                    </tr>`
                        : ''
                    }
                  </table>
                </div>

                <p style="text-align: center;">
                  <a href="${requestUrl}" class="button">View Full Details</a>
                </p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Printyx. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Approval ${decisionLabel}: ${requestTypePretty}

Hello ${requesterName},

Your approval request "${request.requestTitle}" has been ${decisionLabel.toLowerCase()} by ${approverName}.

DECISION DETAILS:
- Decision: ${decisionLabel}
- Decided By: ${approverName}
- Date: ${request.finalDecisionAt ? new Date(request.finalDecisionAt).toLocaleString() : new Date().toLocaleString()}${decisionComments ? `\n- Comments: ${decisionComments}` : ''}

REQUEST SUMMARY:
- Type: ${requestTypePretty}${request.dealValue ? `\n- Deal Value: $${Number(request.dealValue).toLocaleString()}` : ''}${request.discountPercentage ? `\n- Discount: ${request.discountPercentage}%` : ''}

View full details: ${requestUrl}

(c) ${new Date().getFullYear()} Printyx`,
      });

      log.info(`  - Sent outcome email to ${requesterName} (${requester.email})`);
    } catch (error) {
      log.error(`Failed to send outcome email to ${requesterName} (${requester.email}):`, error);
    }
  }

  /**
   * Notify about SLA escalation
   */
  private static async notifyEscalation(request: ApprovalRequest): Promise<void> {
    log.info(`SLA breached for request ${request.id}: escalating to management`);

    // Find management-level users (level >= 4 = manager+) in the same tenant
    const managers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(users.tenantId, request.tenantId), gte(roles.level, 4)));

    if (managers.length === 0) {
      log.warn(
        `No management-level users found for tenant ${request.tenantId} to escalate request ${request.id}`,
      );
      return;
    }

    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
    const approvalUrl = `${baseUrl}/deal-desk/approvals/${request.id}`;
    const requestTypePretty = (request.requestType || 'approval').replace(/_/g, ' ');
    const requesterName = request.requestedByName || 'A team member';

    // Calculate time elapsed since submission
    const submittedAt = new Date(request.submittedAt);
    const now = new Date();
    const hoursElapsed = Math.round((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
    const daysElapsed = Math.floor(hoursElapsed / 24);
    const remainingHours = hoursElapsed % 24;
    const timeElapsedStr =
      daysElapsed > 0
        ? `${daysElapsed} day${daysElapsed !== 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`
        : `${hoursElapsed} hour${hoursElapsed !== 1 ? 's' : ''}`;

    // Identify pending approvers who have not acted
    const pendingApprovers = request.approvalChain
      .filter((m: ApprovalChainMember) => m.status === 'pending')
      .map((m: ApprovalChainMember) => `${m.approverName} (${m.approverRole})`)
      .join(', ');

    const subject = `Approval Escalation: ${requestTypePretty} - SLA Breached`;

    for (const manager of managers) {
      if (!manager.email) continue;

      const managerName =
        `${manager.firstName || ''} ${manager.lastName || ''}`.trim() || 'Manager';

      try {
        await sendEmail({
          to: manager.email,
          subject,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
                .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">SLA Escalation</h1>
                  <p style="margin: 8px 0 0 0; opacity: 0.9;">Approval request requires immediate attention</p>
                </div>
                <div class="content">
                  <p>Hello ${managerName},</p>

                  <p>An approval request has breached its SLA deadline and requires immediate management attention.</p>

                  <div style="background: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
                    <h3 style="margin: 0 0 8px 0; color: #991b1b;">Escalation Reason: SLA Deadline Exceeded</h3>
                    <p style="margin: 0; color: #7f1d1d;">This request has been pending for <strong>${timeElapsedStr}</strong> without resolution.</p>
                  </div>

                  <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 12px 0;">Request Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280; width: 160px;">Title</td>
                        <td style="padding: 6px 0;">${request.requestTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Type</td>
                        <td style="padding: 6px 0;">${requestTypePretty}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Requested By</td>
                        <td style="padding: 6px 0;">${requesterName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Submitted</td>
                        <td style="padding: 6px 0;">${submittedAt.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">SLA Deadline</td>
                        <td style="padding: 6px 0; color: #dc2626; font-weight: 600;">${request.slaDeadline ? new Date(request.slaDeadline).toLocaleString() : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Time Elapsed</td>
                        <td style="padding: 6px 0; color: #dc2626; font-weight: 600;">${timeElapsedStr}</td>
                      </tr>
                      ${
                        request.dealValue
                          ? `
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Deal Value</td>
                        <td style="padding: 6px 0;">$${Number(request.dealValue).toLocaleString()}</td>
                      </tr>`
                          : ''
                      }
                      ${
                        request.discountPercentage
                          ? `
                      <tr>
                        <td style="padding: 6px 0; font-weight: 600; color: #6b7280;">Discount</td>
                        <td style="padding: 6px 0;">${request.discountPercentage}%</td>
                      </tr>`
                          : ''
                      }
                    </table>
                  </div>

                  ${
                    pendingApprovers
                      ? `
                  <div style="background: #fff7ed; padding: 16px; border-radius: 8px; border-left: 4px solid #f97316; margin: 20px 0;">
                    <h4 style="margin: 0 0 8px 0; color: #9a3412;">Pending Approvers</h4>
                    <p style="margin: 0;">${pendingApprovers}</p>
                  </div>`
                      : ''
                  }

                  ${
                    request.businessJustification
                      ? `
                  <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin: 0 0 8px 0; color: #1e40af;">Business Justification</h4>
                    <p style="margin: 0;">${request.businessJustification}</p>
                  </div>`
                      : ''
                  }

                  <p style="text-align: center;">
                    <a href="${approvalUrl}" class="button">Review &amp; Take Action</a>
                  </p>

                  <p style="font-size: 13px; color: #6b7280;">Or copy and paste this link: <a href="${approvalUrl}" style="color: #2563eb;">${approvalUrl}</a></p>
                </div>
                <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Printyx. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Approval Escalation: ${requestTypePretty} - SLA Breached

Hello ${managerName},

An approval request has breached its SLA deadline and requires immediate management attention.

ESCALATION REASON: SLA Deadline Exceeded
This request has been pending for ${timeElapsedStr} without resolution.

REQUEST DETAILS:
- Title: ${request.requestTitle}
- Type: ${requestTypePretty}
- Requested By: ${requesterName}
- Submitted: ${submittedAt.toLocaleString()}
- SLA Deadline: ${request.slaDeadline ? new Date(request.slaDeadline).toLocaleString() : 'N/A'}
- Time Elapsed: ${timeElapsedStr}${request.dealValue ? `\n- Deal Value: $${Number(request.dealValue).toLocaleString()}` : ''}${request.discountPercentage ? `\n- Discount: ${request.discountPercentage}%` : ''}

${pendingApprovers ? `PENDING APPROVERS: ${pendingApprovers}\n` : ''}${request.businessJustification ? `BUSINESS JUSTIFICATION: ${request.businessJustification}\n` : ''}
Review and take action: ${approvalUrl}

(c) ${new Date().getFullYear()} Printyx`,
        });

        log.info(`  - Sent escalation email to ${managerName} (${manager.email})`);
      } catch (error) {
        log.error(`Failed to send escalation email to ${managerName} (${manager.email}):`, error);
      }
    }

    // Update the request with escalation info
    const managerIds = managers.map((m) => m.id).filter(Boolean);
    if (managerIds.length > 0) {
      await db
        .update(approvalRequests)
        .set({
          escalatedTo: managerIds[0],
          updatedAt: new Date(),
        })
        .where(eq(approvalRequests.id, request.id));
    }
  }

  /**
   * Get pending approvals for a user
   */
  static async getPendingApprovalsForUser(
    tenantId: string,
    userId: string,
  ): Promise<ApprovalRequest[]> {
    const allRequests = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.tenantId, tenantId),
          or(eq(approvalRequests.status, 'pending'), eq(approvalRequests.status, 'in_review')),
        ),
      );

    // Filter to requests where user is a pending approver
    return allRequests.filter((request) =>
      request.approvalChain.some(
        (m: ApprovalChainMember) => m.approverId === userId && m.status === 'pending',
      ),
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
    isInternal: boolean = false,
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

  /**
   * Check for approvals pending > 24 hours and send reminder emails.
   * Intended to be called periodically (e.g., via CRON job).
   */
  static async checkPendingReminders(): Promise<void> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Find requests that are still pending/in_review and were submitted more than 24 hours ago
    const staleRequests = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          or(eq(approvalRequests.status, 'pending'), eq(approvalRequests.status, 'in_review')),
          lte(approvalRequests.submittedAt, twentyFourHoursAgo),
        ),
      );

    if (staleRequests.length === 0) {
      log.info('No pending approval reminders to send');
      return;
    }

    log.info(
      `Found ${staleRequests.length} approval request(s) pending > 24 hours, sending reminders`,
    );

    for (const request of staleRequests) {
      const currentLevel = request.currentApprovalLevel || 1;

      // Only send reminders if there are still pending approvers at the current level
      const hasPendingAtLevel = request.approvalChain.some(
        (m: ApprovalChainMember) => m.level === currentLevel && m.status === 'pending',
      );

      if (!hasPendingAtLevel) continue;

      try {
        await this.notifyApprovers(request, currentLevel, true);
        log.info(`  - Sent reminder for request ${request.id} (level ${currentLevel})`);
      } catch (error) {
        log.error(`Failed to send reminder for request ${request.id}:`, error);
      }
    }
  }
}
