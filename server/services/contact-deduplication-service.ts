/**
 * Contact Deduplication Service
 * Handles detection, scoring, and merging of duplicate contacts
 */

import { db } from '../db';
import { eq, and, desc, sql, or, ne, inArray, gte, lte } from 'drizzle-orm';
import {
  duplicateDetectionRules,
  duplicateMatches,
  contactMergeHistory,
  duplicateScanJobs,
  insertDuplicateDetectionRuleSchema,
  insertDuplicateMatchSchema,
  insertContactMergeHistorySchema,
  insertDuplicateScanJobSchema,
  type DuplicateDetectionRule,
  type InsertDuplicateDetectionRule,
  type DuplicateMatch,
  type InsertDuplicateMatch,
  type ContactMergeHistory,
  type DuplicateScanJob,
} from '../../shared/gdpr-core-schema';
import { businessRecords, enhancedContacts } from '../../shared/schema';
import { logAuditEvent } from '../security-compliance';
import crypto from 'crypto';

// ============= STRING SIMILARITY UTILITIES =============

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Normalize string for comparison (remove special chars, extra spaces)
 */
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize email for comparison
 */
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [local, domain] = email.toLowerCase().split('@');
  // Remove dots from local part (common in gmail)
  const normalizedLocal = local?.replace(/\./g, '') || '';
  // Remove plus addressing
  const withoutPlus = normalizedLocal.split('+')[0];
  return domain ? `${withoutPlus}@${domain}` : withoutPlus;
}

/**
 * Normalize phone number (remove all non-digits)
 */
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Simple phonetic encoding (Soundex-like)
 */
function phoneticEncode(str: string): string {
  if (!str) return '';
  const s = str.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';

  const codes: Record<string, string> = {
    b: '1',
    f: '1',
    p: '1',
    v: '1',
    c: '2',
    g: '2',
    j: '2',
    k: '2',
    q: '2',
    s: '2',
    x: '2',
    z: '2',
    d: '3',
    t: '3',
    l: '4',
    m: '5',
    n: '5',
    r: '6',
  };

  let result = s[0].toUpperCase();
  let lastCode = codes[s[0]] || '0';

  for (let i = 1; i < s.length && result.length < 4; i++) {
    const code = codes[s[i]] || '0';
    if (code !== '0' && code !== lastCode) {
      result += code;
      lastCode = code;
    } else if (!'aeiouyhw'.includes(s[i])) {
      lastCode = code;
    }
  }

  return result.padEnd(4, '0');
}

// ============= DEDUPLICATION SERVICE =============

export class ContactDeduplicationService {
  // ============= DUPLICATE DETECTION RULES =============

  /**
   * Create a duplicate detection rule
   */
  async createRule(
    tenantId: string,
    data: Omit<InsertDuplicateDetectionRule, 'tenantId'>,
    createdBy?: string,
  ): Promise<DuplicateDetectionRule> {
    const [rule] = await db
      .insert(duplicateDetectionRules)
      .values({
        ...data,
        tenantId,
        createdBy,
      })
      .returning();

    return rule;
  }

  /**
   * Get rule by ID
   */
  async getRule(tenantId: string, ruleId: string): Promise<DuplicateDetectionRule | null> {
    return (
      (await db.query.duplicateDetectionRules.findFirst({
        where: and(
          eq(duplicateDetectionRules.id, ruleId),
          eq(duplicateDetectionRules.tenantId, tenantId),
        ),
      })) || null
    );
  }

  /**
   * List active rules for entity type
   */
  async listRules(tenantId: string, entityType?: string): Promise<DuplicateDetectionRule[]> {
    const conditions = [
      eq(duplicateDetectionRules.tenantId, tenantId),
      eq(duplicateDetectionRules.isActive, true),
    ];

    if (entityType) {
      conditions.push(eq(duplicateDetectionRules.entityType, entityType));
    }

    return await db.query.duplicateDetectionRules.findMany({
      where: and(...conditions),
      orderBy: [desc(duplicateDetectionRules.createdAt)],
    });
  }

  /**
   * Update rule
   */
  async updateRule(
    tenantId: string,
    ruleId: string,
    updates: Partial<InsertDuplicateDetectionRule>,
  ): Promise<DuplicateDetectionRule> {
    const [updated] = await db
      .update(duplicateDetectionRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(eq(duplicateDetectionRules.id, ruleId), eq(duplicateDetectionRules.tenantId, tenantId)),
      )
      .returning();

    return updated;
  }

  // ============= DUPLICATE DETECTION =============

  /**
   * Find duplicates for a specific record
   */
  async findDuplicatesForRecord(
    tenantId: string,
    entityType: string,
    record: Record<string, any>,
    ruleId?: string,
  ): Promise<
    Array<{
      recordId: string;
      score: number;
      matchedFields: Array<{
        fieldName: string;
        primaryValue: string | null;
        secondaryValue: string | null;
        similarity: number;
        matchType: string;
      }>;
      confidence: 'high' | 'medium' | 'low';
    }>
  > {
    // Get applicable rules
    const rules = ruleId
      ? [await this.getRule(tenantId, ruleId)]
      : await this.listRules(tenantId, entityType);

    const validRules = rules.filter((r): r is DuplicateDetectionRule => r !== null);
    if (validRules.length === 0) {
      return [];
    }

    // Get potential matches from database
    const candidates = await this.getCandidateRecords(tenantId, entityType, record);
    const duplicates: Array<{
      recordId: string;
      score: number;
      matchedFields: Array<{
        fieldName: string;
        primaryValue: string | null;
        secondaryValue: string | null;
        similarity: number;
        matchType: string;
      }>;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    for (const candidate of candidates) {
      // Skip comparing record to itself
      if (candidate.id === record.id) continue;

      // Score against each rule and take the highest
      let bestScore = 0;
      let bestMatchedFields: any[] = [];
      let bestRule: DuplicateDetectionRule | null = null;

      for (const rule of validRules) {
        const { score, matchedFields } = this.scoreMatch(record, candidate, rule);
        if (score > bestScore) {
          bestScore = score;
          bestMatchedFields = matchedFields;
          bestRule = rule;
        }
      }

      if (bestRule && bestScore >= (bestRule.minimumScore || 80)) {
        duplicates.push({
          recordId: candidate.id,
          score: bestScore,
          matchedFields: bestMatchedFields,
          confidence: bestScore >= 95 ? 'high' : bestScore >= 85 ? 'medium' : 'low',
        });
      }
    }

    return duplicates.sort((a, b) => b.score - a.score);
  }

  /**
   * Get candidate records for comparison
   */
  private async getCandidateRecords(
    tenantId: string,
    entityType: string,
    record: Record<string, any>,
  ): Promise<Record<string, any>[]> {
    // For now, we'll do a simple fetch. In production, this should be optimized
    // with blocking/indexing strategies for large datasets.

    if (
      entityType === 'contact' ||
      entityType === 'company' ||
      entityType === 'lead' ||
      entityType === 'customer'
    ) {
      return await db.query.businessRecords.findMany({
        where: eq(businessRecords.tenantId, tenantId),
        limit: 5000, // Limit for performance
      });
    }

    if (entityType === 'enhanced_contact') {
      return await db.query.enhancedContacts.findMany({
        where: eq(enhancedContacts.tenantId, tenantId),
        limit: 5000,
      });
    }

    return [];
  }

  /**
   * Score match between two records based on rule
   */
  private scoreMatch(
    record1: Record<string, any>,
    record2: Record<string, any>,
    rule: DuplicateDetectionRule,
  ): {
    score: number;
    matchedFields: Array<{
      fieldName: string;
      primaryValue: string | null;
      secondaryValue: string | null;
      similarity: number;
      matchType: string;
    }>;
  } {
    const matchingFields = rule.matchingFields as Array<{
      fieldName: string;
      weight: number;
      matchType: 'exact' | 'fuzzy' | 'phonetic' | 'normalized';
      caseSensitive?: boolean;
      threshold?: number;
    }>;

    let totalWeight = 0;
    let totalScore = 0;
    const matchedFields: Array<{
      fieldName: string;
      primaryValue: string | null;
      secondaryValue: string | null;
      similarity: number;
      matchType: string;
    }> = [];

    for (const field of matchingFields) {
      const val1 = this.getNestedValue(record1, field.fieldName);
      const val2 = this.getNestedValue(record2, field.fieldName);

      // Skip if both values are empty
      if (!val1 && !val2) continue;

      totalWeight += field.weight;
      let similarity = 0;

      if (val1 && val2) {
        switch (field.matchType) {
          case 'exact':
            similarity = field.caseSensitive
              ? val1 === val2
                ? 100
                : 0
              : val1.toLowerCase() === val2.toLowerCase()
                ? 100
                : 0;
            break;
          case 'fuzzy':
            similarity = calculateSimilarity(val1, val2);
            break;
          case 'phonetic':
            similarity = phoneticEncode(val1) === phoneticEncode(val2) ? 100 : 0;
            break;
          case 'normalized':
            // Apply field-specific normalization
            let norm1 = val1,
              norm2 = val2;
            if (field.fieldName.toLowerCase().includes('email')) {
              norm1 = normalizeEmail(val1);
              norm2 = normalizeEmail(val2);
            } else if (field.fieldName.toLowerCase().includes('phone')) {
              norm1 = normalizePhone(val1);
              norm2 = normalizePhone(val2);
            } else {
              norm1 = normalizeString(val1);
              norm2 = normalizeString(val2);
            }
            similarity = calculateSimilarity(norm1, norm2);
            break;
        }

        // Apply threshold
        if (field.threshold && similarity < field.threshold) {
          similarity = 0;
        }
      }

      totalScore += similarity * field.weight;
      matchedFields.push({
        fieldName: field.fieldName,
        primaryValue: val1 || null,
        secondaryValue: val2 || null,
        similarity,
        matchType: field.matchType,
      });
    }

    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    return {
      score: finalScore,
      matchedFields: matchedFields.filter((f) => f.similarity > 0),
    };
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): string | null {
    const value = path.split('.').reduce((current, key) => current?.[key], obj);
    return value != null ? String(value) : null;
  }

  // ============= DUPLICATE MATCHES MANAGEMENT =============

  /**
   * Create duplicate match record
   */
  async createMatch(
    tenantId: string,
    data: Omit<InsertDuplicateMatch, 'tenantId'>,
  ): Promise<DuplicateMatch> {
    // Check if this pair already exists
    const existing = await db.query.duplicateMatches.findFirst({
      where: and(
        eq(duplicateMatches.tenantId, tenantId),
        or(
          and(
            eq(duplicateMatches.primaryRecordId, data.primaryRecordId),
            eq(duplicateMatches.secondaryRecordId, data.secondaryRecordId),
          ),
          and(
            eq(duplicateMatches.primaryRecordId, data.secondaryRecordId),
            eq(duplicateMatches.secondaryRecordId, data.primaryRecordId),
          ),
        ),
        ne(duplicateMatches.status, 'dismissed'),
        ne(duplicateMatches.status, 'merged'),
      ),
    });

    if (existing) {
      // Update existing match if score is higher
      if (data.matchScore > existing.matchScore) {
        const [updated] = await db
          .update(duplicateMatches)
          .set({
            matchScore: data.matchScore,
            matchedFields: data.matchedFields,
            updatedAt: new Date(),
          })
          .where(eq(duplicateMatches.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }

    const [match] = await db
      .insert(duplicateMatches)
      .values({
        ...data,
        tenantId,
        confidence: data.matchScore >= 95 ? 'high' : data.matchScore >= 85 ? 'medium' : 'low',
      })
      .returning();

    return match;
  }

  /**
   * List duplicate matches
   */
  async listMatches(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      entityType?: string;
      minScore?: number;
    } = {},
  ): Promise<{ matches: DuplicateMatch[]; total: number }> {
    const { page = 1, limit = 25, status, entityType, minScore } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(duplicateMatches.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(duplicateMatches.status, status));
    }
    if (entityType) {
      conditions.push(eq(duplicateMatches.entityType, entityType));
    }
    if (minScore) {
      conditions.push(gte(duplicateMatches.matchScore, minScore));
    }

    const whereClause = and(...conditions);

    const [matches, [{ count }]] = await Promise.all([
      db
        .select()
        .from(duplicateMatches)
        .where(whereClause)
        .orderBy(desc(duplicateMatches.matchScore), desc(duplicateMatches.detectedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)` })
        .from(duplicateMatches)
        .where(whereClause),
    ]);

    return { matches, total: Number(count) };
  }

  /**
   * Resolve match (merge, dismiss, etc.)
   */
  async resolveMatch(
    tenantId: string,
    matchId: string,
    resolution: 'merged' | 'not_duplicate' | 'keep_both',
    resolvedBy: string,
    notes?: string,
  ): Promise<DuplicateMatch> {
    const [updated] = await db
      .update(duplicateMatches)
      .set({
        status: resolution === 'merged' ? 'merged' : 'dismissed',
        resolution,
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: notes,
        updatedAt: new Date(),
      })
      .where(and(eq(duplicateMatches.id, matchId), eq(duplicateMatches.tenantId, tenantId)))
      .returning();

    return updated;
  }

  // ============= MERGE OPERATIONS =============

  /**
   * Merge two records
   */
  async mergeRecords(
    tenantId: string,
    entityType: string,
    survivingRecordId: string,
    mergedRecordId: string,
    fieldResolutions: Array<{
      fieldName: string;
      source: 'surviving' | 'merged' | 'combined' | 'manual';
      value?: any;
    }>,
    mergedBy: string,
    duplicateMatchId?: string,
    mergeReason?: string,
  ): Promise<ContactMergeHistory> {
    // Get both records
    const table = entityType === 'enhanced_contact' ? enhancedContacts : businessRecords;
    const tableRef = entityType === 'enhanced_contact' ? 'enhancedContacts' : 'businessRecords';

    const [survivingRecord, mergedRecord] = await Promise.all([
      (db.query as any)[tableRef].findFirst({
        where: and(eq(table.id, survivingRecordId), eq(table.tenantId, tenantId)),
      }),
      (db.query as any)[tableRef].findFirst({
        where: and(eq(table.id, mergedRecordId), eq(table.tenantId, tenantId)),
      }),
    ]);

    if (!survivingRecord || !mergedRecord) {
      throw new Error('One or both records not found');
    }

    // Prepare field resolutions
    const resolvedFieldResolutions: Array<{
      fieldName: string;
      survivingValue: any;
      mergedValue: any;
      resultValue: any;
      strategy: string;
      source: 'surviving' | 'merged' | 'combined' | 'manual';
    }> = [];

    // Build the update object
    const updates: Record<string, any> = {};

    for (const resolution of fieldResolutions) {
      const survivingValue = this.getNestedValue(survivingRecord, resolution.fieldName);
      const mergedValue = this.getNestedValue(mergedRecord, resolution.fieldName);

      let resultValue: any;

      switch (resolution.source) {
        case 'surviving':
          resultValue = survivingValue;
          break;
        case 'merged':
          resultValue = mergedValue;
          break;
        case 'combined':
          // Combine values (e.g., for arrays or comma-separated strings)
          if (survivingValue && mergedValue) {
            resultValue = `${survivingValue}, ${mergedValue}`;
          } else {
            resultValue = survivingValue || mergedValue;
          }
          break;
        case 'manual':
          resultValue = resolution.value;
          break;
      }

      if (resultValue !== survivingValue) {
        updates[resolution.fieldName] = resultValue;
      }

      resolvedFieldResolutions.push({
        fieldName: resolution.fieldName,
        survivingValue,
        mergedValue,
        resultValue,
        strategy: resolution.source,
        source: resolution.source,
      });
    }

    // Update surviving record if there are changes
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(table).set(updates).where(eq(table.id, survivingRecordId));
    }

    // Get updated surviving record
    const survivingRecordAfter = await (db.query as any)[tableRef].findFirst({
      where: eq(table.id, survivingRecordId),
    });

    // Track related data updates (e.g., re-pointing foreign keys)
    const relatedUpdates: Array<{
      tableName: string;
      recordCount: number;
      fieldUpdated: string;
      oldValue: string;
      newValue: string;
    }> = [];

    // Update foreign key references if this is a business record
    if (entityType !== 'enhanced_contact') {
      // Update enhanced contacts
      const contactsResult = await db
        .update(enhancedContacts)
        .set({ companyId: survivingRecordId, updatedAt: new Date() })
        .where(
          and(
            eq(enhancedContacts.tenantId, tenantId),
            eq(enhancedContacts.companyId, mergedRecordId),
          ),
        );

      if (contactsResult.rowCount && contactsResult.rowCount > 0) {
        relatedUpdates.push({
          tableName: 'enhanced_contacts',
          recordCount: contactsResult.rowCount,
          fieldUpdated: 'companyId',
          oldValue: mergedRecordId,
          newValue: survivingRecordId,
        });
      }
    }

    // Soft delete or mark merged record as merged
    await db
      .update(table)
      .set({
        status: 'merged',
        mergedIntoId: survivingRecordId,
        updatedAt: new Date(),
      } as any)
      .where(eq(table.id, mergedRecordId));

    // Create merge history record
    const [mergeHistory] = await db
      .insert(contactMergeHistory)
      .values({
        tenantId,
        entityType,
        survivingRecordId,
        mergedRecordId,
        duplicateMatchId,
        survivingRecordBefore: survivingRecord,
        survivingRecordAfter,
        mergedRecordSnapshot: mergedRecord,
        fieldResolutions: resolvedFieldResolutions,
        relatedUpdates,
        mergeType: 'manual',
        mergeReason,
        canRollback: true,
        mergedBy,
      })
      .returning();

    // Update duplicate match if exists
    if (duplicateMatchId) {
      await db
        .update(duplicateMatches)
        .set({
          status: 'merged',
          resolution: 'merged',
          resolvedBy: mergedBy,
          resolvedAt: new Date(),
          mergedRecordId: survivingRecordId,
          updatedAt: new Date(),
        })
        .where(eq(duplicateMatches.id, duplicateMatchId));
    }

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId: mergedBy,
      action: 'MERGE_RECORDS',
      resource: entityType,
      resourceId: survivingRecordId,
      oldValues: { mergedFrom: mergedRecordId },
      newValues: { fieldResolutions: resolvedFieldResolutions.length },
      ipAddress: 'system',
      userAgent: 'system',
      sessionId: 'system',
      severity: 'high',
      category: 'data_modification',
    });

    return mergeHistory;
  }

  /**
   * Rollback a merge operation
   */
  async rollbackMerge(
    tenantId: string,
    mergeHistoryId: string,
    rolledBackBy: string,
    reason?: string,
  ): Promise<void> {
    const history = await db.query.contactMergeHistory.findFirst({
      where: and(
        eq(contactMergeHistory.id, mergeHistoryId),
        eq(contactMergeHistory.tenantId, tenantId),
      ),
    });

    if (!history) {
      throw new Error('Merge history not found');
    }

    if (!history.canRollback) {
      throw new Error('This merge cannot be rolled back');
    }

    if (history.rolledBackAt) {
      throw new Error('This merge has already been rolled back');
    }

    const table = history.entityType === 'enhanced_contact' ? enhancedContacts : businessRecords;

    // Restore surviving record to previous state
    if (history.survivingRecordBefore) {
      await db
        .update(table)
        .set(history.survivingRecordBefore as any)
        .where(eq(table.id, history.survivingRecordId));
    }

    // Restore merged record
    if (history.mergedRecordSnapshot) {
      const snapshot = history.mergedRecordSnapshot as Record<string, any>;
      // Remove status that was set during merge
      delete snapshot.status;
      delete snapshot.mergedIntoId;

      // Re-activate the merged record
      await db
        .update(table)
        .set({
          ...snapshot,
          status: 'active',
          updatedAt: new Date(),
        } as any)
        .where(eq(table.id, history.mergedRecordId));
    }

    // Restore related updates
    if (history.relatedUpdates) {
      const relatedUpdates = history.relatedUpdates as Array<{
        tableName: string;
        recordCount: number;
        fieldUpdated: string;
        oldValue: string;
        newValue: string;
      }>;

      for (const update of relatedUpdates) {
        if (update.tableName === 'enhanced_contacts') {
          await db
            .update(enhancedContacts)
            .set({ companyId: update.oldValue, updatedAt: new Date() })
            .where(
              and(
                eq(enhancedContacts.tenantId, tenantId),
                eq(enhancedContacts.companyId, update.newValue),
              ),
            );
        }
      }
    }

    // Mark history as rolled back
    await db
      .update(contactMergeHistory)
      .set({
        canRollback: false,
        rolledBackAt: new Date(),
        rolledBackBy,
        rollbackReason: reason,
      })
      .where(eq(contactMergeHistory.id, mergeHistoryId));

    // Log audit event
    await logAuditEvent({
      tenantId,
      userId: rolledBackBy,
      action: 'ROLLBACK_MERGE',
      resource: history.entityType,
      resourceId: history.survivingRecordId,
      oldValues: { mergeHistoryId },
      newValues: { reason },
      ipAddress: 'system',
      userAgent: 'system',
      sessionId: 'system',
      severity: 'high',
      category: 'data_modification',
    });
  }

  /**
   * Get merge history for a record
   */
  async getMergeHistory(tenantId: string, recordId: string): Promise<ContactMergeHistory[]> {
    return await db.query.contactMergeHistory.findMany({
      where: and(
        eq(contactMergeHistory.tenantId, tenantId),
        or(
          eq(contactMergeHistory.survivingRecordId, recordId),
          eq(contactMergeHistory.mergedRecordId, recordId),
        ),
      ),
      orderBy: [desc(contactMergeHistory.mergedAt)],
    });
  }

  // ============= SCAN JOBS =============

  /**
   * Create a duplicate scan job
   */
  async createScanJob(
    tenantId: string,
    data: Omit<InsertDuplicateScanJob, 'tenantId'>,
    triggeredBy?: string,
  ): Promise<DuplicateScanJob> {
    const [job] = await db
      .insert(duplicateScanJobs)
      .values({
        ...data,
        tenantId,
        triggeredBy,
        status: 'pending',
      })
      .returning();

    return job;
  }

  /**
   * Run a duplicate scan job
   */
  async runScanJob(tenantId: string, jobId: string): Promise<void> {
    const job = await db.query.duplicateScanJobs.findFirst({
      where: and(eq(duplicateScanJobs.id, jobId), eq(duplicateScanJobs.tenantId, tenantId)),
    });

    if (!job) {
      throw new Error('Scan job not found');
    }

    // Update status to running
    await db
      .update(duplicateScanJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(duplicateScanJobs.id, jobId));

    try {
      // Get all records of the entity type
      const records = await this.getCandidateRecords(tenantId, job.entityType, {});
      let recordsScanned = 0;
      let duplicatesFound = 0;
      let autoMerged = 0;

      // Compare each pair
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const duplicates = await this.findDuplicatesForRecord(
          tenantId,
          job.entityType,
          record,
          job.ruleId || undefined,
        );

        for (const dup of duplicates) {
          // Skip if we've already processed this pair
          if (dup.recordId < record.id) continue;

          await this.createMatch(tenantId, {
            ruleId: job.ruleId,
            entityType: job.entityType,
            primaryRecordId: record.id,
            secondaryRecordId: dup.recordId,
            matchScore: dup.score,
            matchType: 'fuzzy',
            matchedFields: dup.matchedFields,
            status: 'pending',
            detectedSource: 'scheduled_scan',
          });

          duplicatesFound++;
        }

        recordsScanned++;

        // Update progress every 100 records
        if (recordsScanned % 100 === 0) {
          const progress = Math.round((recordsScanned / records.length) * 100);
          await db
            .update(duplicateScanJobs)
            .set({
              progress,
              recordsScanned,
              duplicatesFound,
              updatedAt: new Date(),
            })
            .where(eq(duplicateScanJobs.id, jobId));
        }
      }

      // Mark as completed
      await db
        .update(duplicateScanJobs)
        .set({
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          recordsScanned,
          duplicatesFound,
          autoMerged,
          updatedAt: new Date(),
        })
        .where(eq(duplicateScanJobs.id, jobId));
    } catch (error) {
      // Mark as failed
      await db
        .update(duplicateScanJobs)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(duplicateScanJobs.id, jobId));

      throw error;
    }
  }

  /**
   * List scan jobs
   */
  async listScanJobs(
    tenantId: string,
    options: { page?: number; limit?: number; status?: string } = {},
  ): Promise<{ jobs: DuplicateScanJob[]; total: number }> {
    const { page = 1, limit = 25, status } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(duplicateScanJobs.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(duplicateScanJobs.status, status));
    }

    const whereClause = and(...conditions);

    const [jobs, [{ count }]] = await Promise.all([
      db
        .select()
        .from(duplicateScanJobs)
        .where(whereClause)
        .orderBy(desc(duplicateScanJobs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)` })
        .from(duplicateScanJobs)
        .where(whereClause),
    ]);

    return { jobs, total: Number(count) };
  }

  /**
   * Get deduplication statistics
   */
  async getStats(tenantId: string): Promise<{
    totalMatches: number;
    pendingMatches: number;
    mergedRecords: number;
    dismissedMatches: number;
    avgMatchScore: number;
    recentScans: DuplicateScanJob[];
  }> {
    const [totalResult, pendingResult, mergedResult, dismissedResult, avgScoreResult, recentScans] =
      await Promise.all([
        db
          .select({ count: sql`count(*)` })
          .from(duplicateMatches)
          .where(eq(duplicateMatches.tenantId, tenantId)),
        db
          .select({ count: sql`count(*)` })
          .from(duplicateMatches)
          .where(
            and(eq(duplicateMatches.tenantId, tenantId), eq(duplicateMatches.status, 'pending')),
          ),
        db
          .select({ count: sql`count(*)` })
          .from(duplicateMatches)
          .where(
            and(eq(duplicateMatches.tenantId, tenantId), eq(duplicateMatches.status, 'merged')),
          ),
        db
          .select({ count: sql`count(*)` })
          .from(duplicateMatches)
          .where(
            and(eq(duplicateMatches.tenantId, tenantId), eq(duplicateMatches.status, 'dismissed')),
          ),
        db
          .select({ avg: sql`avg(${duplicateMatches.matchScore})` })
          .from(duplicateMatches)
          .where(eq(duplicateMatches.tenantId, tenantId)),
        db.query.duplicateScanJobs.findMany({
          where: eq(duplicateScanJobs.tenantId, tenantId),
          orderBy: [desc(duplicateScanJobs.createdAt)],
          limit: 5,
        }),
      ]);

    return {
      totalMatches: Number(totalResult[0]?.count || 0),
      pendingMatches: Number(pendingResult[0]?.count || 0),
      mergedRecords: Number(mergedResult[0]?.count || 0),
      dismissedMatches: Number(dismissedResult[0]?.count || 0),
      avgMatchScore: Number(avgScoreResult[0]?.avg || 0),
      recentScans,
    };
  }
}

export const contactDeduplicationService = new ContactDeduplicationService();
export default contactDeduplicationService;
