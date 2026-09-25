import { db } from '../db';
import { auditLogs, auditCategoryEnum, auditSeverityEnum } from '@shared/security-schema';

type AuditSeverity = (typeof auditSeverityEnum.enumValues)[number];
type AuditCategory = (typeof auditCategoryEnum.enumValues)[number];

/** A category the enum column can hold, or null: filtering on anything else is a 22P02. */
export function asAuditCategory(v: unknown): AuditCategory | null {
  return typeof v === 'string' && (auditCategoryEnum.enumValues as readonly string[]).includes(v)
    ? (v as AuditCategory)
    : null;
}
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
import { Request } from 'express';

const log = createModuleLogger('audit-log-service');

interface LogActionParams {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId: string;
  tenantId: string;
  details?: any;
  req?: Request;
  severity?: AuditSeverity;
  category?: AuditCategory;
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const { action, resourceType, resourceId, userId, tenantId, details, req, severity, category } =
      params;

    const ipAddress = req ? req.ip || req.headers['x-forwarded-for'] || 'unknown' : 'unknown';
    const userAgent = req ? req.headers['user-agent'] || 'unknown' : 'unknown';
    const requestId = req ? (req.headers['x-request-id'] as string | undefined) : undefined;

    await db.insert(auditLogs).values({
      action,
      resource: resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      userId,
      tenantId,
      oldValues: details?.oldValues || null,
      newValues: details?.newValues || null,
      additionalContext: details || null,
      ipAddress: typeof ipAddress === 'string' ? ipAddress : String(ipAddress),
      userAgent,
      requestId: requestId || null,
      severity: severity || 'low',
      category: category || 'data_modification',
    });
  } catch (error) {
    log.error('Failed to write audit log', {
      error,
      params: { action: params.action, resourceType: params.resourceType },
    });
  }
}

export async function logAuthEvent(
  action: string,
  userId: string,
  tenantId: string,
  req: Request,
  details?: any,
): Promise<void> {
  await logAction({
    action,
    resourceType: 'auth',
    userId,
    tenantId,
    req,
    details,
    category: 'authentication',
    severity: action.includes('failure') ? 'high' : 'medium',
  });
}

export async function logAdminAction(
  action: string,
  resourceType: string,
  resourceId: string,
  userId: string,
  tenantId: string,
  req: Request,
  details?: any,
): Promise<void> {
  await logAction({
    action,
    resourceType,
    resourceId,
    userId,
    tenantId,
    req,
    details,
    category: 'authorization',
    severity: 'high',
  });
}

export async function logDeletion(
  resourceType: string,
  resourceId: string,
  userId: string,
  tenantId: string,
  req: Request,
  details?: any,
): Promise<void> {
  await logAction({
    action: 'record_delete',
    resourceType,
    resourceId,
    userId,
    tenantId,
    req,
    details,
    category: 'data_modification',
    severity: 'high',
  });
}

interface QueryAuditLogsParams {
  tenantId: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  action?: string;
  userId?: string;
  category?: string;
}

export async function queryAuditLogs(params: QueryAuditLogsParams) {
  const { tenantId, page = 1, limit = 50, startDate, endDate, action, userId, category } = params;

  const conditions = [eq(auditLogs.tenantId, tenantId)];

  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }

  if (userId) {
    conditions.push(eq(auditLogs.userId, userId));
  }

  // An unknown category would fail the enum cast; it filters nothing instead.
  const knownCategory = asAuditCategory(category);
  if (knownCategory) {
    conditions.push(eq(auditLogs.category, knownCategory));
  }

  if (startDate) {
    conditions.push(gte(auditLogs.timestamp, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(auditLogs.timestamp, new Date(endDate)));
  }

  const whereClause = and(...conditions);

  const [logs, countResult] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count || 0);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
