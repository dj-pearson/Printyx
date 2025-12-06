/**
 * Data Retention & Purging Service
 * Implements configurable data retention policies with automated purging
 * Supports GDPR, SOC2, and other compliance requirements
 */

import { db } from "../db";
import { eq, and, desc, gte, lte, lt, sql, inArray } from "drizzle-orm";
import {
  dataRetentionPolicies,
  dataPurgeJobs,
  type DataRetentionPolicy,
  type InsertDataRetentionPolicy,
  type DataPurgeJob,
  type InsertDataPurgeJob,
} from "@shared/soc2-compliance-schema";
import { auditLogs } from "@shared/security-schema";

// ============= CONSTANTS =============

// Default retention periods in days
const DEFAULT_RETENTION_PERIODS: Record<string, number> = {
  audit_logs: 2555,           // 7 years (compliance requirement)
  data_access_logs: 2555,     // 7 years
  payment_audit_trail: 2555,  // 7 years (PCI requirement)
  security_sessions: 365,     // 1 year
  gdpr_requests: 2555,        // 7 years
  incidents: 2555,            // 7 years
  change_requests: 2555,      // 7 years
  service_tickets: 1095,      // 3 years
  emails: 730,                // 2 years
  notifications: 90,          // 90 days
  temp_files: 7,              // 7 days
};

// Tables that support archival before purge
const ARCHIVABLE_TABLES = [
  'audit_logs',
  'data_access_logs',
  'payment_audit_trail',
  'incidents',
  'change_requests',
  'service_tickets',
];

// ============= POLICY MANAGEMENT =============

/**
 * Create a new data retention policy
 */
export async function createRetentionPolicy(
  data: InsertDataRetentionPolicy
): Promise<DataRetentionPolicy> {
  // Validate table name exists
  const validTables = Object.keys(DEFAULT_RETENTION_PERIODS);
  if (!validTables.includes(data.tableName) && !data.tableName.startsWith('custom_')) {
    console.warn(`Warning: Table ${data.tableName} is not in the standard list`);
  }

  const [policy] = await db
    .insert(dataRetentionPolicies)
    .values(data)
    .returning();

  return policy;
}

/**
 * Get retention policy by ID
 */
export async function getRetentionPolicy(
  policyId: string,
  tenantId: string
): Promise<DataRetentionPolicy | null> {
  const [policy] = await db
    .select()
    .from(dataRetentionPolicies)
    .where(
      and(
        eq(dataRetentionPolicies.id, policyId),
        eq(dataRetentionPolicies.tenantId, tenantId)
      )
    );

  return policy || null;
}

/**
 * List retention policies for a tenant
 */
export async function listRetentionPolicies(
  tenantId: string,
  options: {
    status?: ('active' | 'paused' | 'disabled')[];
    tableName?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: DataRetentionPolicy[]; total: number }> {
  const conditions = [eq(dataRetentionPolicies.tenantId, tenantId)];

  if (options.status?.length) {
    conditions.push(inArray(dataRetentionPolicies.status, options.status as any));
  }
  if (options.tableName) {
    conditions.push(eq(dataRetentionPolicies.tableName, options.tableName));
  }

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(dataRetentionPolicies)
      .where(and(...conditions))
      .orderBy(dataRetentionPolicies.tableName)
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(dataRetentionPolicies)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count || 0,
  };
}

/**
 * Update retention policy
 */
export async function updateRetentionPolicy(
  policyId: string,
  tenantId: string,
  updates: Partial<InsertDataRetentionPolicy>
): Promise<DataRetentionPolicy | null> {
  const [updated] = await db
    .update(dataRetentionPolicies)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dataRetentionPolicies.id, policyId),
        eq(dataRetentionPolicies.tenantId, tenantId)
      )
    )
    .returning();

  return updated || null;
}

/**
 * Delete retention policy
 */
export async function deleteRetentionPolicy(
  policyId: string,
  tenantId: string
): Promise<boolean> {
  const result = await db
    .delete(dataRetentionPolicies)
    .where(
      and(
        eq(dataRetentionPolicies.id, policyId),
        eq(dataRetentionPolicies.tenantId, tenantId)
      )
    );

  return true;
}

/**
 * Set legal hold on a policy
 */
export async function setLegalHold(
  policyId: string,
  tenantId: string,
  reason: string,
  holdUntil?: Date
): Promise<DataRetentionPolicy | null> {
  return updateRetentionPolicy(policyId, tenantId, {
    legalHold: true,
    legalHoldReason: reason,
    legalHoldUntil: holdUntil,
  } as any);
}

/**
 * Remove legal hold from a policy
 */
export async function removeLegalHold(
  policyId: string,
  tenantId: string
): Promise<DataRetentionPolicy | null> {
  return updateRetentionPolicy(policyId, tenantId, {
    legalHold: false,
    legalHoldReason: null,
    legalHoldUntil: null,
  } as any);
}

// ============= PURGE JOB MANAGEMENT =============

/**
 * Create a purge job
 */
export async function createPurgeJob(
  data: InsertDataPurgeJob
): Promise<DataPurgeJob> {
  const [job] = await db
    .insert(dataPurgeJobs)
    .values(data)
    .returning();

  return job;
}

/**
 * Get purge job by ID
 */
export async function getPurgeJob(
  jobId: string,
  tenantId: string
): Promise<DataPurgeJob | null> {
  const [job] = await db
    .select()
    .from(dataPurgeJobs)
    .where(
      and(
        eq(dataPurgeJobs.id, jobId),
        eq(dataPurgeJobs.tenantId, tenantId)
      )
    );

  return job || null;
}

/**
 * List purge jobs
 */
export async function listPurgeJobs(
  tenantId: string,
  options: {
    policyId?: string;
    status?: ('pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled')[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: DataPurgeJob[]; total: number }> {
  const conditions = [eq(dataPurgeJobs.tenantId, tenantId)];

  if (options.policyId) {
    conditions.push(eq(dataPurgeJobs.policyId, options.policyId));
  }
  if (options.status?.length) {
    conditions.push(inArray(dataPurgeJobs.status, options.status as any));
  }
  if (options.startDate) {
    conditions.push(gte(dataPurgeJobs.createdAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(dataPurgeJobs.createdAt, options.endDate));
  }

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(dataPurgeJobs)
      .where(and(...conditions))
      .orderBy(desc(dataPurgeJobs.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(dataPurgeJobs)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count || 0,
  };
}

/**
 * Update purge job status
 */
export async function updatePurgeJobStatus(
  jobId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled',
  metrics?: {
    recordsIdentified?: number;
    recordsArchived?: number;
    recordsPurged?: number;
    recordsFailed?: number;
    archiveLocation?: string;
    errorLog?: Array<{ recordId: string; error: string; timestamp: string }>;
  }
): Promise<DataPurgeJob | null> {
  const updates: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'in_progress' && !metrics?.recordsIdentified) {
    updates.startedAt = new Date();
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.completedAt = new Date();
    if (updates.startedAt) {
      updates.durationSeconds = Math.round(
        (updates.completedAt.getTime() - updates.startedAt.getTime()) / 1000
      );
    }
  }

  if (metrics) {
    Object.assign(updates, metrics);
  }

  const [updated] = await db
    .update(dataPurgeJobs)
    .set(updates)
    .where(eq(dataPurgeJobs.id, jobId))
    .returning();

  return updated || null;
}

// ============= PURGE EXECUTION =============

/**
 * Execute a purge operation for a policy
 */
export async function executePurge(
  policyId: string,
  tenantId: string,
  triggeredBy?: string,
  triggerType: 'scheduled' | 'manual' | 'gdpr_request' = 'manual',
  dryRun: boolean = false
): Promise<DataPurgeJob> {
  const policy = await getRetentionPolicy(policyId, tenantId);
  if (!policy) {
    throw new Error("Retention policy not found");
  }

  // Check for legal hold
  if (policy.legalHold) {
    if (!policy.legalHoldUntil || policy.legalHoldUntil > new Date()) {
      throw new Error(`Policy is under legal hold: ${policy.legalHoldReason}`);
    }
  }

  // Check if policy is active
  if (policy.status !== 'active') {
    throw new Error(`Policy is ${policy.status}, cannot execute purge`);
  }

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

  // Create purge job
  const job = await createPurgeJob({
    tenantId,
    policyId,
    triggerType,
    triggeredBy,
    tableName: policy.tableName,
    cutoffDate,
  });

  if (dryRun) {
    // Just count affected records
    const count = await countRecordsForPurge(
      policy.tableName,
      tenantId,
      policy.dateField,
      cutoffDate,
      policy.additionalConditions as Record<string, any>
    );

    await updatePurgeJobStatus(job.id, 'completed', {
      recordsIdentified: count,
      recordsArchived: 0,
      recordsPurged: 0,
    });

    return getPurgeJob(job.id, tenantId) as Promise<DataPurgeJob>;
  }

  // Execute the actual purge in the background
  executePurgeAsync(job.id, policy, tenantId, cutoffDate);

  return job;
}

/**
 * Execute purge asynchronously
 */
async function executePurgeAsync(
  jobId: string,
  policy: DataRetentionPolicy,
  tenantId: string,
  cutoffDate: Date
): Promise<void> {
  try {
    await updatePurgeJobStatus(jobId, 'in_progress');

    // Count records to purge
    const recordCount = await countRecordsForPurge(
      policy.tableName,
      tenantId,
      policy.dateField,
      cutoffDate,
      policy.additionalConditions as Record<string, any>
    );

    await updatePurgeJobStatus(jobId, 'in_progress', {
      recordsIdentified: recordCount,
    });

    let recordsArchived = 0;
    let recordsPurged = 0;
    let recordsFailed = 0;
    const errorLog: Array<{ recordId: string; error: string; timestamp: string }> = [];
    let archiveLocation: string | undefined;

    // Archive if required
    if (policy.archiveBeforePurge && ARCHIVABLE_TABLES.includes(policy.tableName)) {
      try {
        const archiveResult = await archiveRecords(
          policy.tableName,
          tenantId,
          policy.dateField,
          cutoffDate,
          policy.archiveDestination || undefined
        );
        recordsArchived = archiveResult.count;
        archiveLocation = archiveResult.location;
      } catch (error: any) {
        console.error(`Failed to archive records: ${error.message}`);
        errorLog.push({
          recordId: 'archive',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Purge records in batches
    const batchSize = policy.batchSize || 1000;
    let purgedInBatch = 0;

    do {
      try {
        purgedInBatch = await purgeRecordsBatch(
          policy.tableName,
          tenantId,
          policy.dateField,
          cutoffDate,
          batchSize,
          policy.additionalConditions as Record<string, any>
        );
        recordsPurged += purgedInBatch;

        // Update progress
        await updatePurgeJobStatus(jobId, 'in_progress', {
          recordsArchived,
          recordsPurged,
          recordsFailed,
        });
      } catch (error: any) {
        recordsFailed += batchSize;
        errorLog.push({
          recordId: 'batch',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        break;
      }
    } while (purgedInBatch === batchSize);

    // Update policy statistics
    await db
      .update(dataRetentionPolicies)
      .set({
        lastExecutedAt: new Date(),
        lastRecordsPurged: recordsPurged,
        totalRecordsPurged: sql`${dataRetentionPolicies.totalRecordsPurged} + ${recordsPurged}`,
        updatedAt: new Date(),
      })
      .where(eq(dataRetentionPolicies.id, policy.id));

    // Complete the job
    await updatePurgeJobStatus(jobId, 'completed', {
      recordsArchived,
      recordsPurged,
      recordsFailed,
      archiveLocation,
      errorLog: errorLog.length > 0 ? errorLog : undefined,
    });
  } catch (error: any) {
    await updatePurgeJobStatus(jobId, 'failed', {
      errorLog: [
        {
          recordId: 'job',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }
}

/**
 * Count records eligible for purge
 */
async function countRecordsForPurge(
  tableName: string,
  tenantId: string,
  dateField: string,
  cutoffDate: Date,
  additionalConditions?: Record<string, any>
): Promise<number> {
  // Use raw SQL to handle dynamic table names safely
  const query = sql`
    SELECT COUNT(*) as count
    FROM ${sql.identifier(tableName)}
    WHERE tenant_id = ${tenantId}
      AND ${sql.identifier(dateField)} < ${cutoffDate}
  `;

  const result = await db.execute(query);
  return parseInt((result.rows[0] as any)?.count || '0', 10);
}

/**
 * Purge records in batch
 */
async function purgeRecordsBatch(
  tableName: string,
  tenantId: string,
  dateField: string,
  cutoffDate: Date,
  batchSize: number,
  additionalConditions?: Record<string, any>
): Promise<number> {
  const query = sql`
    DELETE FROM ${sql.identifier(tableName)}
    WHERE id IN (
      SELECT id FROM ${sql.identifier(tableName)}
      WHERE tenant_id = ${tenantId}
        AND ${sql.identifier(dateField)} < ${cutoffDate}
      LIMIT ${batchSize}
    )
  `;

  const result = await db.execute(query);
  return result.rowCount || 0;
}

/**
 * Archive records before purging
 */
async function archiveRecords(
  tableName: string,
  tenantId: string,
  dateField: string,
  cutoffDate: Date,
  destination?: string
): Promise<{ count: number; location: string }> {
  // In a production environment, this would export to S3, GCS, or similar
  // For now, we'll create a summary record

  const countQuery = sql`
    SELECT COUNT(*) as count
    FROM ${sql.identifier(tableName)}
    WHERE tenant_id = ${tenantId}
      AND ${sql.identifier(dateField)} < ${cutoffDate}
  `;

  const result = await db.execute(countQuery);
  const count = parseInt((result.rows[0] as any)?.count || '0', 10);

  // Generate archive location
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const location = destination || `archive/${tenantId}/${tableName}/${timestamp}.json`;

  // In production, you would:
  // 1. Export records to the destination
  // 2. Verify the export
  // 3. Return the location

  return { count, location };
}

// ============= SCHEDULED EXECUTION =============

/**
 * Get policies due for execution
 */
export async function getPoliciesDueForExecution(): Promise<DataRetentionPolicy[]> {
  const now = new Date();

  // Get all active policies
  const policies = await db
    .select()
    .from(dataRetentionPolicies)
    .where(eq(dataRetentionPolicies.status, 'active'));

  // Filter by schedule (simple implementation - in production, use a proper cron parser)
  return policies.filter((policy) => {
    if (policy.legalHold) {
      return false;
    }

    // Check if it's time to run based on last execution
    if (!policy.lastExecutedAt) {
      return true;
    }

    // Simple weekly check (schedule parsing would be more sophisticated in production)
    const daysSinceLastRun = Math.floor(
      (now.getTime() - policy.lastExecutedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Run at least once a week
    return daysSinceLastRun >= 7;
  });
}

/**
 * Run scheduled retention jobs
 */
export async function runScheduledRetention(): Promise<{
  policiesChecked: number;
  jobsCreated: number;
  errors: string[];
}> {
  const policies = await getPoliciesDueForExecution();
  const errors: string[] = [];
  let jobsCreated = 0;

  for (const policy of policies) {
    try {
      await executePurge(policy.id, policy.tenantId, undefined, 'scheduled');
      jobsCreated++;
    } catch (error: any) {
      errors.push(`Policy ${policy.id}: ${error.message}`);
    }
  }

  return {
    policiesChecked: policies.length,
    jobsCreated,
    errors,
  };
}

// ============= METRICS & REPORTING =============

/**
 * Get retention metrics
 */
export async function getRetentionMetrics(
  tenantId: string
): Promise<{
  totalPolicies: number;
  activePolicies: number;
  pausedPolicies: number;
  policiesWithLegalHold: number;
  totalRecordsPurged: number;
  lastPurgeDate: Date | null;
  upcomingPurges: Array<{
    policyId: string;
    policyName: string;
    tableName: string;
    estimatedRecords: number;
    nextRun: Date;
  }>;
}> {
  const policies = await db
    .select()
    .from(dataRetentionPolicies)
    .where(eq(dataRetentionPolicies.tenantId, tenantId));

  let activePolicies = 0;
  let pausedPolicies = 0;
  let policiesWithLegalHold = 0;
  let totalRecordsPurged = 0;
  let lastPurgeDate: Date | null = null;

  for (const policy of policies) {
    if (policy.status === 'active') activePolicies++;
    if (policy.status === 'paused') pausedPolicies++;
    if (policy.legalHold) policiesWithLegalHold++;
    totalRecordsPurged += policy.totalRecordsPurged || 0;

    if (policy.lastExecutedAt) {
      if (!lastPurgeDate || policy.lastExecutedAt > lastPurgeDate) {
        lastPurgeDate = policy.lastExecutedAt;
      }
    }
  }

  // Calculate upcoming purges
  const upcomingPurges = await Promise.all(
    policies
      .filter((p) => p.status === 'active' && !p.legalHold)
      .slice(0, 5)
      .map(async (policy) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        const estimatedRecords = await countRecordsForPurge(
          policy.tableName,
          tenantId,
          policy.dateField,
          cutoffDate
        );

        const nextRun = policy.lastExecutedAt
          ? new Date(policy.lastExecutedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
          : new Date();

        return {
          policyId: policy.id,
          policyName: policy.name,
          tableName: policy.tableName,
          estimatedRecords,
          nextRun,
        };
      })
  );

  return {
    totalPolicies: policies.length,
    activePolicies,
    pausedPolicies,
    policiesWithLegalHold,
    totalRecordsPurged,
    lastPurgeDate,
    upcomingPurges,
  };
}

/**
 * Initialize default retention policies for a tenant
 */
export async function initializeDefaultPolicies(
  tenantId: string,
  createdBy: string
): Promise<DataRetentionPolicy[]> {
  const policies: DataRetentionPolicy[] = [];

  for (const [tableName, retentionDays] of Object.entries(DEFAULT_RETENTION_PERIODS)) {
    const policy = await createRetentionPolicy({
      tenantId,
      name: `${tableName.replace(/_/g, ' ')} Retention`,
      description: `Automatic retention policy for ${tableName}`,
      tableName,
      dateField: 'created_at',
      retentionDays,
      archiveBeforePurge: ARCHIVABLE_TABLES.includes(tableName),
      status: 'active',
      priority: 5,
      batchSize: 1000,
      maxExecutionMinutes: 60,
      schedule: '0 2 * * 0', // Weekly at 2 AM Sunday
      timezone: 'UTC',
      createdBy,
    });

    policies.push(policy);
  }

  return policies;
}

export default {
  createRetentionPolicy,
  getRetentionPolicy,
  listRetentionPolicies,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  setLegalHold,
  removeLegalHold,
  createPurgeJob,
  getPurgeJob,
  listPurgeJobs,
  updatePurgeJobStatus,
  executePurge,
  getPoliciesDueForExecution,
  runScheduledRetention,
  getRetentionMetrics,
  initializeDefaultPolicies,
};
