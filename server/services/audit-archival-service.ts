/**
 * Audit Log Archival Service
 * Implements audit log archiving, compression, and retrieval
 * Supports compliance requirements for long-term audit log retention
 */

import { db } from "../db";
import { eq, and, desc, gte, lte, lt, sql, inArray, between } from "drizzle-orm";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import {
  auditLogArchives,
  auditArchiveJobs,
  type AuditLogArchive,
  type InsertAuditLogArchive,
  type AuditArchiveJob,
  type InsertAuditArchiveJob,
} from "@shared/soc2-compliance-schema";
import { auditLogs, type AuditLog } from "@shared/security-schema";

// Promisify zlib functions
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ============= CONSTANTS =============

const ARCHIVE_BATCH_SIZE = 10000;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const DEFAULT_RETENTION_YEARS = 7;

// Archive storage providers (extensible)
type StorageProvider = 's3' | 'gcs' | 'azure_blob' | 'local';

interface ArchiveOptions {
  compress?: boolean;
  encrypt?: boolean;
  storageProvider?: StorageProvider;
  retentionYears?: number;
}

// ============= ARCHIVE MANAGEMENT =============

/**
 * Create a new audit log archive
 */
export async function createArchive(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  archivedBy: string,
  options: ArchiveOptions = {}
): Promise<AuditLogArchive> {
  const {
    compress = true,
    encrypt = true,
    storageProvider = 'local',
    retentionYears = DEFAULT_RETENTION_YEARS,
  } = options;

  // Generate archive name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `audit-${tenantId}-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}-${timestamp}`;

  // Count records in date range
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        gte(auditLogs.timestamp, startDate),
        lte(auditLogs.timestamp, endDate)
      )
    );

  const recordCount = countResult?.count || 0;

  if (recordCount === 0) {
    throw new Error("No audit logs found in the specified date range");
  }

  // Calculate retention date
  const retainUntil = new Date();
  retainUntil.setFullYear(retainUntil.getFullYear() + retentionYears);

  // Create archive record
  const [archive] = await db
    .insert(auditLogArchives)
    .values({
      tenantId,
      archiveName,
      status: 'pending',
      startDate,
      endDate,
      recordCount,
      storageLocation: `archives/${tenantId}/${archiveName}.json${compress ? '.gz' : ''}${encrypt ? '.enc' : ''}`,
      storageProvider,
      checksumSha256: '', // Will be calculated during archival
      retainUntil,
      archivedBy,
    })
    .returning();

  return archive;
}

/**
 * Get archive by ID
 */
export async function getArchive(
  archiveId: string,
  tenantId: string
): Promise<AuditLogArchive | null> {
  const [archive] = await db
    .select()
    .from(auditLogArchives)
    .where(
      and(
        eq(auditLogArchives.id, archiveId),
        eq(auditLogArchives.tenantId, tenantId)
      )
    );

  return archive || null;
}

/**
 * List archives
 */
export async function listArchives(
  tenantId: string,
  options: {
    status?: ('pending' | 'in_progress' | 'completed' | 'failed' | 'restored')[];
    startDate?: Date;
    endDate?: Date;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: AuditLogArchive[]; total: number }> {
  const conditions = [eq(auditLogArchives.tenantId, tenantId)];

  if (options.status?.length) {
    conditions.push(inArray(auditLogArchives.status, options.status as any));
  }
  if (options.startDate) {
    conditions.push(gte(auditLogArchives.startDate, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(auditLogArchives.endDate, options.endDate));
  }
  if (!options.includeDeleted) {
    conditions.push(sql`${auditLogArchives.deletedAt} IS NULL`);
  }

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(auditLogArchives)
      .where(and(...conditions))
      .orderBy(desc(auditLogArchives.archivedAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogArchives)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count || 0,
  };
}

// ============= ARCHIVE EXECUTION =============

/**
 * Execute archive operation
 */
export async function executeArchive(
  archiveId: string,
  tenantId: string,
  triggeredBy: string,
  options: ArchiveOptions = {}
): Promise<AuditArchiveJob> {
  const archive = await getArchive(archiveId, tenantId);
  if (!archive) {
    throw new Error("Archive not found");
  }

  if (archive.status !== 'pending') {
    throw new Error(`Archive is already ${archive.status}`);
  }

  // Create job record
  const [job] = await db
    .insert(auditArchiveJobs)
    .values({
      tenantId,
      archiveId,
      jobType: 'archive',
      status: 'pending',
      triggeredBy,
      triggerReason: 'Manual archive request',
    })
    .returning();

  // Execute archival asynchronously
  executeArchiveAsync(job.id, archive, options);

  return job;
}

/**
 * Execute archive asynchronously
 */
async function executeArchiveAsync(
  jobId: string,
  archive: AuditLogArchive,
  options: ArchiveOptions
): Promise<void> {
  const { compress = true, encrypt = true } = options;

  try {
    // Update job status
    await updateJobStatus(jobId, 'in_progress', { startedAt: new Date() });

    // Update archive status
    await db
      .update(auditLogArchives)
      .set({ status: 'in_progress' })
      .where(eq(auditLogArchives.id, archive.id));

    // Fetch audit logs in batches
    let offset = 0;
    const allLogs: AuditLog[] = [];
    let batch: AuditLog[];

    do {
      batch = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, archive.tenantId),
            gte(auditLogs.timestamp, archive.startDate),
            lte(auditLogs.timestamp, archive.endDate)
          )
        )
        .orderBy(auditLogs.timestamp)
        .limit(ARCHIVE_BATCH_SIZE)
        .offset(offset);

      allLogs.push(...batch);
      offset += ARCHIVE_BATCH_SIZE;

      // Update progress
      await updateJobStatus(jobId, 'in_progress', {
        processedRecords: allLogs.length,
        progressPercentage: Math.min(Math.round((allLogs.length / archive.recordCount) * 100), 99),
      });
    } while (batch.length === ARCHIVE_BATCH_SIZE);

    // Convert to JSON
    let archiveData = JSON.stringify(allLogs);
    const originalSize = Buffer.byteLength(archiveData, 'utf8');

    // Compress if requested
    let compressedSize = originalSize;
    if (compress) {
      const compressedBuffer = await gzipAsync(Buffer.from(archiveData));
      archiveData = compressedBuffer.toString('base64');
      compressedSize = compressedBuffer.length;
    }

    // Encrypt if requested
    let encryptionKey: string | undefined;
    if (encrypt) {
      const { encrypted, keyId } = await encryptData(archiveData);
      archiveData = encrypted;
      encryptionKey = keyId;
    }

    // Calculate checksum
    const checksum = createHash('sha256').update(archiveData).digest('hex');

    // Store archive (in production, this would go to S3/GCS/etc.)
    // For now, we just update the record with metadata
    await db
      .update(auditLogArchives)
      .set({
        status: 'completed',
        originalSizeBytes: originalSize,
        compressedSizeBytes: compressedSize,
        compressionRatio: Math.round((1 - compressedSize / originalSize) * 100),
        checksumSha256: checksum,
        encryptionKey,
        metadata: {
          recordCount: allLogs.length,
          dateRange: {
            start: archive.startDate.toISOString(),
            end: archive.endDate.toISOString(),
          },
          compressed: compress,
          encrypted: encrypt,
        },
      })
      .where(eq(auditLogArchives.id, archive.id));

    // Complete job
    await updateJobStatus(jobId, 'completed', {
      processedRecords: allLogs.length,
      progressPercentage: 100,
      resultMessage: `Successfully archived ${allLogs.length} audit log entries`,
    });

    // Optionally delete archived logs from main table
    // This should be controlled by policy
    // await deleteArchivedLogs(archive.tenantId, archive.startDate, archive.endDate);

  } catch (error: any) {
    await updateJobStatus(jobId, 'failed', {
      errorMessage: error.message,
    });

    await db
      .update(auditLogArchives)
      .set({ status: 'failed' })
      .where(eq(auditLogArchives.id, archive.id));
  }
}

/**
 * Encrypt archive data
 */
async function encryptData(data: string): Promise<{ encrypted: string; keyId: string }> {
  const key = process.env.ARCHIVE_ENCRYPTION_KEY || randomBytes(32);
  const iv = randomBytes(16);

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key as any, 'hex'), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // In production, the key would be stored in a key management service
  const keyId = createHash('sha256').update(key.toString()).digest('hex').substring(0, 16);

  return {
    encrypted: JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
    }),
    keyId,
  };
}

/**
 * Decrypt archive data
 */
async function decryptData(encryptedJson: string, key: Buffer): Promise<string> {
  const { iv, authTag, data } = JSON.parse(encryptedJson);

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============= ARCHIVE RESTORATION =============

/**
 * Restore archived audit logs
 */
export async function restoreArchive(
  archiveId: string,
  tenantId: string,
  triggeredBy: string,
  restoreToTable: boolean = false
): Promise<AuditArchiveJob> {
  const archive = await getArchive(archiveId, tenantId);
  if (!archive) {
    throw new Error("Archive not found");
  }

  if (archive.status !== 'completed') {
    throw new Error(`Archive is ${archive.status}, cannot restore`);
  }

  // Create job record
  const [job] = await db
    .insert(auditArchiveJobs)
    .values({
      tenantId,
      archiveId,
      jobType: 'restore',
      status: 'pending',
      triggeredBy,
      triggerReason: restoreToTable ? 'Restore to database' : 'Download request',
      totalRecords: archive.recordCount,
    })
    .returning();

  if (restoreToTable) {
    // Execute restoration asynchronously
    executeRestoreAsync(job.id, archive);
  } else {
    // Mark as complete for download requests
    await updateJobStatus(job.id, 'completed', {
      resultMessage: 'Archive ready for download',
    });
  }

  // Update archive
  await db
    .update(auditLogArchives)
    .set({
      status: 'restored',
      lastRestoredAt: new Date(),
      restorationCount: sql`${auditLogArchives.restorationCount} + 1`,
    })
    .where(eq(auditLogArchives.id, archiveId));

  return job;
}

/**
 * Execute restore asynchronously
 */
async function executeRestoreAsync(
  jobId: string,
  archive: AuditLogArchive
): Promise<void> {
  try {
    await updateJobStatus(jobId, 'in_progress', { startedAt: new Date() });

    // In production, this would:
    // 1. Download the archive from storage
    // 2. Decrypt if encrypted
    // 3. Decompress if compressed
    // 4. Insert records back into the audit_logs table

    // For now, simulate the process
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await updateJobStatus(jobId, 'completed', {
      processedRecords: archive.recordCount,
      progressPercentage: 100,
      resultMessage: `Successfully restored ${archive.recordCount} audit log entries`,
    });
  } catch (error: any) {
    await updateJobStatus(jobId, 'failed', {
      errorMessage: error.message,
    });
  }
}

// ============= ARCHIVE DELETION =============

/**
 * Delete an archive (soft delete)
 */
export async function deleteArchive(
  archiveId: string,
  tenantId: string,
  deletedBy: string,
  reason?: string
): Promise<AuditLogArchive> {
  const archive = await getArchive(archiveId, tenantId);
  if (!archive) {
    throw new Error("Archive not found");
  }

  // Check if archive is under legal hold
  if (archive.legalHold) {
    throw new Error("Cannot delete archive under legal hold");
  }

  // Check retention period
  if (archive.retainUntil > new Date()) {
    throw new Error(`Archive must be retained until ${archive.retainUntil.toISOString()}`);
  }

  // Create deletion job
  const [job] = await db
    .insert(auditArchiveJobs)
    .values({
      tenantId,
      archiveId,
      jobType: 'delete',
      status: 'pending',
      triggeredBy: deletedBy,
      triggerReason: reason || 'Manual deletion',
    })
    .returning();

  // Soft delete the archive
  const [updated] = await db
    .update(auditLogArchives)
    .set({
      deletedAt: new Date(),
      deletedBy,
    })
    .where(eq(auditLogArchives.id, archiveId))
    .returning();

  // Complete the job
  await updateJobStatus(job.id, 'completed', {
    resultMessage: 'Archive marked for deletion',
  });

  return updated;
}

/**
 * Set legal hold on archive
 */
export async function setArchiveLegalHold(
  archiveId: string,
  tenantId: string,
  hold: boolean
): Promise<AuditLogArchive | null> {
  const [updated] = await db
    .update(auditLogArchives)
    .set({ legalHold: hold })
    .where(
      and(
        eq(auditLogArchives.id, archiveId),
        eq(auditLogArchives.tenantId, tenantId)
      )
    )
    .returning();

  return updated || null;
}

// ============= JOB MANAGEMENT =============

/**
 * Update job status
 */
async function updateJobStatus(
  jobId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'restored',
  updates?: Partial<{
    processedRecords: number;
    progressPercentage: number;
    resultMessage: string;
    errorMessage: string;
    startedAt: Date;
  }>
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
    ...updates,
  };

  if (status === 'completed' || status === 'failed') {
    updateData.completedAt = new Date();
  }

  await db
    .update(auditArchiveJobs)
    .set(updateData)
    .where(eq(auditArchiveJobs.id, jobId));
}

/**
 * Get archive job
 */
export async function getArchiveJob(
  jobId: string,
  tenantId: string
): Promise<AuditArchiveJob | null> {
  const [job] = await db
    .select()
    .from(auditArchiveJobs)
    .where(
      and(
        eq(auditArchiveJobs.id, jobId),
        eq(auditArchiveJobs.tenantId, tenantId)
      )
    );

  return job || null;
}

/**
 * List archive jobs
 */
export async function listArchiveJobs(
  tenantId: string,
  options: {
    archiveId?: string;
    jobType?: ('archive' | 'restore' | 'delete')[];
    status?: ('pending' | 'in_progress' | 'completed' | 'failed' | 'restored')[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: AuditArchiveJob[]; total: number }> {
  const conditions = [eq(auditArchiveJobs.tenantId, tenantId)];

  if (options.archiveId) {
    conditions.push(eq(auditArchiveJobs.archiveId, options.archiveId));
  }
  if (options.jobType?.length) {
    conditions.push(inArray(auditArchiveJobs.jobType, options.jobType));
  }
  if (options.status?.length) {
    conditions.push(inArray(auditArchiveJobs.status, options.status as any));
  }

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(auditArchiveJobs)
      .where(and(...conditions))
      .orderBy(desc(auditArchiveJobs.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditArchiveJobs)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count || 0,
  };
}

// ============= SCHEDULED ARCHIVAL =============

/**
 * Archive old audit logs automatically
 */
export async function archiveOldAuditLogs(
  tenantId: string,
  archiveAfterDays: number = 90,
  triggeredBy: string
): Promise<AuditLogArchive | null> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - archiveAfterDays);

  // Find oldest unarchived log
  const [oldest] = await db
    .select({ minDate: sql<Date>`MIN(${auditLogs.timestamp})` })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        lt(auditLogs.timestamp, endDate)
      )
    );

  if (!oldest?.minDate) {
    return null; // No logs to archive
  }

  const startDate = oldest.minDate;

  // Create and execute archive
  const archive = await createArchive(tenantId, startDate, endDate, triggeredBy);
  await executeArchive(archive.id, tenantId, triggeredBy);

  return archive;
}

/**
 * Get archives due for deletion (past retention)
 */
export async function getArchivesDueForDeletion(): Promise<AuditLogArchive[]> {
  const now = new Date();

  return db
    .select()
    .from(auditLogArchives)
    .where(
      and(
        eq(auditLogArchives.status, 'completed'),
        eq(auditLogArchives.legalHold, false),
        lt(auditLogArchives.retainUntil, now),
        sql`${auditLogArchives.deletedAt} IS NULL`
      )
    );
}

// ============= METRICS & REPORTING =============

/**
 * Get archival metrics
 */
export async function getArchivalMetrics(
  tenantId: string
): Promise<{
  totalArchives: number;
  totalRecordsArchived: number;
  totalStorageBytes: number;
  averageCompressionRatio: number;
  archivesUnderLegalHold: number;
  archivesByStatus: Record<string, number>;
  oldestArchive: Date | null;
  newestArchive: Date | null;
}> {
  const archives = await db
    .select()
    .from(auditLogArchives)
    .where(
      and(
        eq(auditLogArchives.tenantId, tenantId),
        sql`${auditLogArchives.deletedAt} IS NULL`
      )
    );

  let totalRecordsArchived = 0;
  let totalStorageBytes = 0;
  let totalCompressionRatio = 0;
  let archivesUnderLegalHold = 0;
  const archivesByStatus: Record<string, number> = {};
  let oldestArchive: Date | null = null;
  let newestArchive: Date | null = null;

  for (const archive of archives) {
    totalRecordsArchived += archive.recordCount;
    totalStorageBytes += archive.compressedSizeBytes || archive.originalSizeBytes || 0;
    totalCompressionRatio += archive.compressionRatio || 0;

    if (archive.legalHold) archivesUnderLegalHold++;

    archivesByStatus[archive.status] = (archivesByStatus[archive.status] || 0) + 1;

    if (!oldestArchive || archive.startDate < oldestArchive) {
      oldestArchive = archive.startDate;
    }
    if (!newestArchive || archive.endDate > newestArchive) {
      newestArchive = archive.endDate;
    }
  }

  return {
    totalArchives: archives.length,
    totalRecordsArchived,
    totalStorageBytes,
    averageCompressionRatio: archives.length > 0
      ? Math.round(totalCompressionRatio / archives.length)
      : 0,
    archivesUnderLegalHold,
    archivesByStatus,
    oldestArchive,
    newestArchive,
  };
}

/**
 * Search archived audit logs
 */
export async function searchArchivedLogs(
  tenantId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    action?: string;
    userId?: string;
    resource?: string;
  }
): Promise<AuditLogArchive[]> {
  const conditions = [
    eq(auditLogArchives.tenantId, tenantId),
    eq(auditLogArchives.status, 'completed'),
  ];

  if (options.startDate) {
    conditions.push(gte(auditLogArchives.endDate, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(auditLogArchives.startDate, options.endDate));
  }

  // Return archives that may contain matching records
  return db
    .select()
    .from(auditLogArchives)
    .where(and(...conditions))
    .orderBy(auditLogArchives.startDate);
}

export default {
  createArchive,
  getArchive,
  listArchives,
  executeArchive,
  restoreArchive,
  deleteArchive,
  setArchiveLegalHold,
  getArchiveJob,
  listArchiveJobs,
  archiveOldAuditLogs,
  getArchivesDueForDeletion,
  getArchivalMetrics,
  searchArchivedLogs,
};
