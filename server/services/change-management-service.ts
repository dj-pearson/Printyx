/**
 * Change Management Service
 * Implements SOC2 Change Management control requirements
 * Handles change request lifecycle, approvals, and audit trail
 */

import { db } from '../db';
import { eq, and, desc, gte, lte, inArray, sql, or } from 'drizzle-orm';
import {
  changeRequests,
  changeApprovals,
  changeHistory,
  type ChangeRequest,
  type InsertChangeRequest,
  type ChangeApproval,
  type InsertChangeApproval,
} from '@shared/soc2-compliance-schema';

// ============= CONSTANTS =============

const CHANGE_NUMBER_PREFIX = 'CHG';

// Risk level to approval requirements mapping
const APPROVAL_REQUIREMENTS: Record<string, { levels: number; roles: string[] }> = {
  low: { levels: 1, roles: ['manager', 'admin'] },
  medium: { levels: 1, roles: ['manager', 'admin', 'platform_admin'] },
  high: { levels: 2, roles: ['admin', 'platform_admin'] },
  critical: { levels: 3, roles: ['admin', 'platform_admin', 'executive'] },
};

// Emergency change auto-approval window (hours)
const EMERGENCY_AUTO_APPROVAL_WINDOW = 24;

// ============= CHANGE REQUEST MANAGEMENT =============

/**
 * Generate unique change number
 */
async function generateChangeNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');

  // Get count of changes this month
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(changeRequests)
    .where(
      sql`EXTRACT(YEAR FROM ${changeRequests.createdAt}) = ${year}
          AND EXTRACT(MONTH FROM ${changeRequests.createdAt}) = ${month + 1}`,
    );

  const sequence = String((result[0]?.count || 0) + 1).padStart(4, '0');
  return `${CHANGE_NUMBER_PREFIX}-${year}${month}-${sequence}`;
}

/**
 * Create a new change request
 */
export async function createChangeRequest(
  data: Omit<InsertChangeRequest, 'changeNumber'>,
  actorId: string,
  actorName: string,
): Promise<ChangeRequest> {
  const changeNumber = await generateChangeNumber();

  const [changeRequest] = await db
    .insert(changeRequests)
    .values({
      ...data,
      changeNumber,
      status: 'draft',
    })
    .returning();

  // Log creation in history
  await logChangeHistory(
    changeRequest.id,
    actorId,
    actorName,
    'created',
    null,
    null,
    JSON.stringify({
      title: changeRequest.title,
      type: changeRequest.type,
      riskLevel: changeRequest.riskLevel,
    }),
  );

  return changeRequest;
}

/**
 * Get change request by ID
 */
export async function getChangeRequest(
  changeRequestId: string,
  tenantId: string,
): Promise<ChangeRequest | null> {
  const [changeRequest] = await db
    .select()
    .from(changeRequests)
    .where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.tenantId, tenantId)));

  return changeRequest || null;
}

/**
 * List change requests with filters
 */
export async function listChangeRequests(
  tenantId: string,
  options: {
    status?: string[];
    type?: string[];
    riskLevel?: string[];
    requesterId?: string;
    assigneeId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ data: ChangeRequest[]; total: number }> {
  const conditions = [eq(changeRequests.tenantId, tenantId)];

  if (options.status?.length) {
    conditions.push(inArray(changeRequests.status, options.status as any));
  }
  if (options.type?.length) {
    conditions.push(inArray(changeRequests.type, options.type as any));
  }
  if (options.riskLevel?.length) {
    conditions.push(inArray(changeRequests.riskLevel, options.riskLevel as any));
  }
  if (options.requesterId) {
    conditions.push(eq(changeRequests.requesterId, options.requesterId));
  }
  if (options.assigneeId) {
    conditions.push(eq(changeRequests.assigneeId, options.assigneeId));
  }
  if (options.startDate) {
    conditions.push(gte(changeRequests.createdAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(changeRequests.createdAt, options.endDate));
  }

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(changeRequests)
      .where(and(...conditions))
      .orderBy(desc(changeRequests.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(changeRequests)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count || 0,
  };
}

/**
 * Update change request
 */
export async function updateChangeRequest(
  changeRequestId: string,
  tenantId: string,
  updates: Partial<InsertChangeRequest>,
  actorId: string,
  actorName: string,
): Promise<ChangeRequest | null> {
  // Get current state for history
  const current = await getChangeRequest(changeRequestId, tenantId);
  if (!current) return null;

  // Cannot update closed changes
  if (['completed', 'cancelled', 'rolled_back'].includes(current.status)) {
    throw new Error('Cannot update a closed change request');
  }

  const [updated] = await db
    .update(changeRequests)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.tenantId, tenantId)))
    .returning();

  // Log each changed field
  for (const [key, newValue] of Object.entries(updates)) {
    const oldValue = (current as any)[key];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      await logChangeHistory(
        changeRequestId,
        actorId,
        actorName,
        'updated',
        key,
        JSON.stringify(oldValue),
        JSON.stringify(newValue),
      );
    }
  }

  return updated || null;
}

/**
 * Submit change request for approval
 */
export async function submitForApproval(
  changeRequestId: string,
  tenantId: string,
  actorId: string,
  actorName: string,
): Promise<ChangeRequest> {
  const current = await getChangeRequest(changeRequestId, tenantId);
  if (!current) {
    throw new Error('Change request not found');
  }

  if (current.status !== 'draft') {
    throw new Error('Only draft changes can be submitted for approval');
  }

  // Validate required fields
  if (!current.rollbackPlan) {
    throw new Error('Rollback plan is required before submission');
  }
  if (!current.businessJustification) {
    throw new Error('Business justification is required');
  }

  // Create approval requests based on risk level
  const approvalConfig = APPROVAL_REQUIREMENTS[current.riskLevel];
  for (let level = 1; level <= approvalConfig.levels; level++) {
    await createApprovalRequest(changeRequestId, level);
  }

  // Update status
  const [updated] = await db
    .update(changeRequests)
    .set({
      status: current.type === 'standard' ? 'approved' : 'pending_approval',
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, changeRequestId))
    .returning();

  await logChangeHistory(
    changeRequestId,
    actorId,
    actorName,
    'submitted_for_approval',
    'status',
    'draft',
    updated.status,
  );

  return updated;
}

/**
 * Create approval request for a change
 */
async function createApprovalRequest(
  changeRequestId: string,
  approvalLevel: number,
): Promise<void> {
  await db.insert(changeApprovals).values({
    changeRequestId,
    approverId: '00000000-0000-0000-0000-000000000000', // Placeholder, will be assigned
    approverName: 'Pending Assignment',
    approverRole: 'pending',
    decision: 'pending',
    approvalLevel,
    isRequired: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
}

// ============= APPROVAL MANAGEMENT =============

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovals(
  approverId: string,
  tenantId: string,
): Promise<Array<ChangeApproval & { changeRequest: ChangeRequest }>> {
  const approvals = await db
    .select()
    .from(changeApprovals)
    .innerJoin(changeRequests, eq(changeApprovals.changeRequestId, changeRequests.id))
    .where(
      and(
        eq(changeApprovals.approverId, approverId),
        eq(changeApprovals.decision, 'pending'),
        eq(changeRequests.tenantId, tenantId),
        eq(changeRequests.status, 'pending_approval'),
      ),
    );

  return approvals.map((row) => ({
    ...row.change_approvals,
    changeRequest: row.change_requests,
  }));
}

/**
 * Approve a change request
 */
export async function approveChange(
  approvalId: string,
  approverId: string,
  approverName: string,
  approverRole: string,
  comments?: string,
  conditions?: string,
): Promise<ChangeApproval> {
  const [approval] = await db
    .update(changeApprovals)
    .set({
      approverId,
      approverName,
      approverRole,
      decision: 'approved',
      comments,
      conditions,
      decidedAt: new Date(),
    })
    .where(eq(changeApprovals.id, approvalId))
    .returning();

  if (!approval) {
    throw new Error('Approval not found');
  }

  // Check if all required approvals are complete
  await checkAllApprovals(approval.changeRequestId);

  // Log to change history
  await logChangeHistory(
    approval.changeRequestId,
    approverId,
    approverName,
    'approved',
    null,
    null,
    JSON.stringify({ level: approval.approvalLevel, comments, conditions }),
  );

  return approval;
}

/**
 * Reject a change request
 */
export async function rejectChange(
  approvalId: string,
  approverId: string,
  approverName: string,
  approverRole: string,
  reason: string,
): Promise<ChangeApproval> {
  const [approval] = await db
    .update(changeApprovals)
    .set({
      approverId,
      approverName,
      approverRole,
      decision: 'rejected',
      comments: reason,
      decidedAt: new Date(),
    })
    .where(eq(changeApprovals.id, approvalId))
    .returning();

  if (!approval) {
    throw new Error('Approval not found');
  }

  // Update change request status
  await db
    .update(changeRequests)
    .set({
      status: 'draft', // Return to draft for revision
      rejectedBy: approverId,
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, approval.changeRequestId));

  await logChangeHistory(
    approval.changeRequestId,
    approverId,
    approverName,
    'rejected',
    'status',
    'pending_approval',
    'draft',
  );

  return approval;
}

/**
 * Check if all required approvals are complete
 */
async function checkAllApprovals(changeRequestId: string): Promise<void> {
  const approvals = await db
    .select()
    .from(changeApprovals)
    .where(
      and(
        eq(changeApprovals.changeRequestId, changeRequestId),
        eq(changeApprovals.isRequired, true),
      ),
    );

  const allApproved = approvals.every((a) => a.decision === 'approved');

  if (allApproved && approvals.length > 0) {
    await db
      .update(changeRequests)
      .set({
        status: 'approved',
        approvedBy: approvals.map((a) => ({
          userId: a.approverId,
          userName: a.approverName,
          role: a.approverRole,
          approvedAt: a.decidedAt?.toISOString() || new Date().toISOString(),
          comments: a.comments || undefined,
        })),
        updatedAt: new Date(),
      })
      .where(eq(changeRequests.id, changeRequestId));
  }
}

// ============= IMPLEMENTATION TRACKING =============

/**
 * Start implementing a change
 */
export async function startImplementation(
  changeRequestId: string,
  tenantId: string,
  actorId: string,
  actorName: string,
): Promise<ChangeRequest> {
  const current = await getChangeRequest(changeRequestId, tenantId);
  if (!current) {
    throw new Error('Change request not found');
  }

  if (current.status !== 'approved') {
    throw new Error('Only approved changes can be implemented');
  }

  const [updated] = await db
    .update(changeRequests)
    .set({
      status: 'in_progress',
      actualStartDate: new Date(),
      assigneeId: actorId,
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, changeRequestId))
    .returning();

  await logChangeHistory(
    changeRequestId,
    actorId,
    actorName,
    'implementation_started',
    'status',
    'approved',
    'in_progress',
  );

  return updated;
}

/**
 * Complete a change implementation
 */
export async function completeImplementation(
  changeRequestId: string,
  tenantId: string,
  actorId: string,
  actorName: string,
  implementationNotes: string,
  verificationNotes: string,
): Promise<ChangeRequest> {
  const current = await getChangeRequest(changeRequestId, tenantId);
  if (!current) {
    throw new Error('Change request not found');
  }

  if (current.status !== 'in_progress') {
    throw new Error('Only in-progress changes can be completed');
  }

  const [updated] = await db
    .update(changeRequests)
    .set({
      status: 'completed',
      actualEndDate: new Date(),
      implementationNotes,
      verificationNotes,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, changeRequestId))
    .returning();

  await logChangeHistory(
    changeRequestId,
    actorId,
    actorName,
    'implementation_completed',
    'status',
    'in_progress',
    'completed',
  );

  return updated;
}

/**
 * Mark implementation as failed
 */
export async function failImplementation(
  changeRequestId: string,
  tenantId: string,
  actorId: string,
  actorName: string,
  failureReason: string,
): Promise<ChangeRequest> {
  const current = await getChangeRequest(changeRequestId, tenantId);
  if (!current) {
    throw new Error('Change request not found');
  }

  if (current.status !== 'in_progress') {
    throw new Error('Only in-progress changes can be marked as failed');
  }

  const [updated] = await db
    .update(changeRequests)
    .set({
      status: 'failed',
      failureReason,
      actualEndDate: new Date(),
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, changeRequestId))
    .returning();

  await logChangeHistory(
    changeRequestId,
    actorId,
    actorName,
    'implementation_failed',
    'status',
    'in_progress',
    'failed',
  );

  return updated;
}

/**
 * Rollback a change
 */
export async function rollbackChange(
  changeRequestId: string,
  tenantId: string,
  actorId: string,
  actorName: string,
  rollbackNotes: string,
): Promise<ChangeRequest> {
  const current = await getChangeRequest(changeRequestId, tenantId);
  if (!current) {
    throw new Error('Change request not found');
  }

  if (!['in_progress', 'completed', 'failed'].includes(current.status)) {
    throw new Error('Change cannot be rolled back from current status');
  }

  const [updated] = await db
    .update(changeRequests)
    .set({
      status: 'rolled_back',
      rollbackNotes,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, changeRequestId))
    .returning();

  await logChangeHistory(
    changeRequestId,
    actorId,
    actorName,
    'rolled_back',
    'status',
    current.status,
    'rolled_back',
  );

  return updated;
}

/**
 * Cancel a change request
 */
export async function cancelChange(
  changeRequestId: string,
  tenantId: string,
  actorId: string,
  actorName: string,
  reason: string,
): Promise<ChangeRequest> {
  const current = await getChangeRequest(changeRequestId, tenantId);
  if (!current) {
    throw new Error('Change request not found');
  }

  if (['completed', 'cancelled', 'rolled_back'].includes(current.status)) {
    throw new Error('Change cannot be cancelled from current status');
  }

  const [updated] = await db
    .update(changeRequests)
    .set({
      status: 'cancelled',
      rejectionReason: reason,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(changeRequests.id, changeRequestId))
    .returning();

  await logChangeHistory(
    changeRequestId,
    actorId,
    actorName,
    'cancelled',
    'status',
    current.status,
    'cancelled',
  );

  return updated;
}

// ============= HISTORY & AUDIT =============

/**
 * Log change history entry
 */
async function logChangeHistory(
  changeRequestId: string,
  actorId: string,
  actorName: string,
  action: string,
  fieldName: string | null,
  oldValue: string | null,
  newValue: string | null,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await db.insert(changeHistory).values({
    changeRequestId,
    actorId,
    actorName,
    action,
    fieldName,
    oldValue,
    newValue,
    ipAddress,
    userAgent,
  });
}

/**
 * Get change history
 */
export async function getChangeHistory(
  changeRequestId: string,
  tenantId: string,
): Promise<Array<typeof changeHistory.$inferSelect>> {
  const change = await getChangeRequest(changeRequestId, tenantId);
  if (!change) {
    throw new Error('Change request not found');
  }

  return db
    .select()
    .from(changeHistory)
    .where(eq(changeHistory.changeRequestId, changeRequestId))
    .orderBy(desc(changeHistory.timestamp));
}

/**
 * Get change approvals
 */
export async function getChangeApprovals(changeRequestId: string): Promise<ChangeApproval[]> {
  return db
    .select()
    .from(changeApprovals)
    .where(eq(changeApprovals.changeRequestId, changeRequestId))
    .orderBy(changeApprovals.approvalLevel);
}

// ============= METRICS & REPORTING =============

/**
 * Get change management metrics
 */
export async function getChangeMetrics(
  tenantId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  totalChanges: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byRiskLevel: Record<string, number>;
  successRate: number;
  averageApprovalTime: number;
  averageImplementationTime: number;
}> {
  const changes = await db
    .select()
    .from(changeRequests)
    .where(
      and(
        eq(changeRequests.tenantId, tenantId),
        gte(changeRequests.createdAt, startDate),
        lte(changeRequests.createdAt, endDate),
      ),
    );

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byRiskLevel: Record<string, number> = {};
  let completedCount = 0;
  let failedCount = 0;
  let totalApprovalTime = 0;
  let approvalTimeCount = 0;
  let totalImplementationTime = 0;
  let implementationTimeCount = 0;

  for (const change of changes) {
    byStatus[change.status] = (byStatus[change.status] || 0) + 1;
    byType[change.type] = (byType[change.type] || 0) + 1;
    byRiskLevel[change.riskLevel] = (byRiskLevel[change.riskLevel] || 0) + 1;

    if (change.status === 'completed') completedCount++;
    if (change.status === 'failed') failedCount++;

    // Calculate approval time
    if (change.submittedAt && change.approvedBy) {
      const approvalTime =
        new Date(change.actualStartDate || change.updatedAt).getTime() -
        change.submittedAt.getTime();
      totalApprovalTime += approvalTime;
      approvalTimeCount++;
    }

    // Calculate implementation time
    if (change.actualStartDate && change.actualEndDate) {
      const implTime = change.actualEndDate.getTime() - change.actualStartDate.getTime();
      totalImplementationTime += implTime;
      implementationTimeCount++;
    }
  }

  const successRate =
    completedCount + failedCount > 0 ? (completedCount / (completedCount + failedCount)) * 100 : 0;

  return {
    totalChanges: changes.length,
    byStatus,
    byType,
    byRiskLevel,
    successRate: Math.round(successRate * 100) / 100,
    averageApprovalTime:
      approvalTimeCount > 0
        ? Math.round(totalApprovalTime / approvalTimeCount / 3600000) // Hours
        : 0,
    averageImplementationTime:
      implementationTimeCount > 0
        ? Math.round(totalImplementationTime / implementationTimeCount / 3600000) // Hours
        : 0,
  };
}

// ============= EMERGENCY CHANGES =============

/**
 * Create emergency change (bypasses normal approval for urgent fixes)
 */
export async function createEmergencyChange(
  data: Omit<InsertChangeRequest, 'changeNumber' | 'type'>,
  actorId: string,
  actorName: string,
  justification: string,
): Promise<ChangeRequest> {
  const changeNumber = await generateChangeNumber();

  const [changeRequest] = await db
    .insert(changeRequests)
    .values({
      ...data,
      changeNumber,
      type: 'emergency',
      status: 'approved', // Auto-approved for emergency
      businessJustification: `EMERGENCY: ${justification}\n\n${data.businessJustification}`,
      approvedBy: [
        {
          userId: actorId,
          userName: actorName,
          role: 'emergency_approver',
          approvedAt: new Date().toISOString(),
          comments: 'Emergency change auto-approved',
        },
      ],
      submittedAt: new Date(),
    })
    .returning();

  await logChangeHistory(
    changeRequest.id,
    actorId,
    actorName,
    'emergency_change_created',
    null,
    null,
    JSON.stringify({ justification, title: changeRequest.title }),
  );

  return changeRequest;
}

export default {
  createChangeRequest,
  getChangeRequest,
  listChangeRequests,
  updateChangeRequest,
  submitForApproval,
  getPendingApprovals,
  approveChange,
  rejectChange,
  startImplementation,
  completeImplementation,
  failImplementation,
  rollbackChange,
  cancelChange,
  getChangeHistory,
  getChangeApprovals,
  getChangeMetrics,
  createEmergencyChange,
};
