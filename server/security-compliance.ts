/**
 * Comprehensive Security & Compliance Implementation
 * Addresses: audit logging, data access logging, encryption, GDPR compliance, session management
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { auditLogs, dataAccessLogs, encryptedFields, gdprRequests, securitySessions } from '../shared/security-schema';
import { eq } from 'drizzle-orm';
import { TenantRequest } from './middleware/tenancy';

// ============= ENCRYPTION UTILITIES =============

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encryptSensitiveData(text: string): EncryptedData {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY);
  cipher.setAAD(Buffer.from('additional-auth-data'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

export function decryptSensitiveData(encryptedData: EncryptedData): string {
  const decipher = crypto.createDecipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY);
  decipher.setAAD(Buffer.from('additional-auth-data'));
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ============= AUDIT LOGGING MIDDLEWARE =============

export interface AuditLogEntry {
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security';
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      sessionId: entry.sessionId,
      severity: entry.severity,
      category: entry.category,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break application flow
  }
}

export function auditLogMiddleware(action: string, resource: string, severity: AuditLogEntry['severity'] = 'medium', category: AuditLogEntry['category'] = 'data_access') {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const startTime = Date.now();

    // Capture request data
    const requestData = {
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    };

    // Override response to capture response data
    res.send = function(data) {
      const responseTime = Date.now() - startTime;
      
      // Log the audit event
      if (req.tenantId && req.user?.id) {
        logAuditEvent({
          tenantId: req.tenantId,
          userId: req.user.id,
          action: `${req.method} ${action}`,
          resource,
          resourceId: req.params.id,
          newValues: req.method !== 'GET' ? req.body : undefined,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          sessionId: req.sessionID,
          severity,
          category,
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

// ============= DATA ACCESS LOGGING =============

export interface DataAccessEntry {
  tenantId: string;
  userId: string;
  resource: string;
  resourceId?: string;
  accessType: 'read' | 'write' | 'delete' | 'export';
  query?: string;
  resultCount?: number;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
}

export async function logDataAccess(entry: DataAccessEntry): Promise<void> {
  try {
    await db.insert(dataAccessLogs).values({
      id: crypto.randomUUID(),
      tenantId: entry.tenantId,
      userId: entry.userId,
      resource: entry.resource,
      resourceId: entry.resourceId,
      accessType: entry.accessType,
      query: entry.query,
      resultCount: entry.resultCount,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      sessionId: entry.sessionId,
      dataClassification: entry.dataClassification,
      accessedAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to log data access:', error);
  }
}

export function dataAccessLogMiddleware(resource: string, classification: DataAccessEntry['dataClassification'] = 'internal') {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    if (req.tenantId && req.user?.id) {
      const accessType: DataAccessEntry['accessType'] = 
        req.method === 'GET' ? 'read' :
        req.method === 'DELETE' ? 'delete' : 'write';

      await logDataAccess({
        tenantId: req.tenantId,
        userId: req.user.id,
        resource,
        resourceId: req.params.id,
        accessType,
        query: JSON.stringify(req.query),
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.sessionID,
        dataClassification: classification,
      });
    }
    next();
  };
}

// ============= GDPR COMPLIANCE =============

export interface GDPRRequest {
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restrict_processing' | 'object_processing';
  tenantId: string;
  subjectId: string; // User or customer ID
  subjectEmail: string;
  requestorId: string; // Who made the request
  description: string;
  legalBasis?: string;
  processingPurpose?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  dueDate: Date;
  completionDate?: Date;
  rejectionReason?: string;
  dataCategories: string[];
  affectedSystems: string[];
}

export async function createGDPRRequest(request: Omit<GDPRRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const requestId = crypto.randomUUID();
  
  await db.insert(gdprRequests).values({
    id: requestId,
    type: request.type,
    tenantId: request.tenantId,
    subjectId: request.subjectId,
    subjectEmail: request.subjectEmail,
    requestorId: request.requestorId,
    description: request.description,
    legalBasis: request.legalBasis,
    processingPurpose: request.processingPurpose,
    status: request.status,
    dueDate: request.dueDate,
    completionDate: request.completionDate,
    rejectionReason: request.rejectionReason,
    dataCategories: request.dataCategories,
    affectedSystems: request.affectedSystems,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Log the GDPR request creation
  await logAuditEvent({
    tenantId: request.tenantId,
    userId: request.requestorId,
    action: 'CREATE_GDPR_REQUEST',
    resource: 'gdpr_requests',
    resourceId: requestId,
    newValues: request,
    ipAddress: 'system',
    userAgent: 'system',
    sessionId: 'system',
    severity: 'high',
    category: 'data_access',
  });

  return requestId;
}

export async function processDataSubjectAccess(tenantId: string, subjectId: string): Promise<any> {
  // Collect all personal data across the system
  const personalData = {
    user: await db.query.users.findFirst({ where: (users, { eq, and }) => and(eq(users.tenantId, tenantId), eq(users.id, subjectId)) }),
    businessRecords: await db.query.businessRecords.findMany({ where: (records, { eq, and }) => and(eq(records.tenantId, tenantId), eq(records.primaryContactEmail, subjectId)) }),
    serviceTickets: await db.query.serviceTickets.findMany({ where: (tickets, { eq, and }) => and(eq(tickets.tenantId, tenantId), eq(tickets.customerId, subjectId)) }),
    auditLogs: await db.query.auditLogs.findMany({ where: (logs, { eq, and }) => and(eq(logs.tenantId, tenantId), eq(logs.userId, subjectId)) }),
    // Add other relevant tables
  };

  return personalData;
}

export async function processDataSubjectErasure(tenantId: string, subjectId: string): Promise<void> {
  // Implement data erasure while maintaining referential integrity
  // This should be carefully implemented based on business requirements
  console.warn('Data erasure requested for subject:', subjectId);
  // Implementation would go here based on specific requirements
}

// ============= SESSION TIMEOUT HANDLING =============

export interface SecuritySession {
  sessionId: string;
  userId: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  timeoutWarningShown: boolean;
}

const SESSION_TIMEOUT_MINUTES = 30;
const SESSION_WARNING_MINUTES = 25;

export async function createSecuritySession(userId: string, tenantId: string, sessionId: string, ipAddress: string, userAgent: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000);

  await db.insert(securitySessions).values({
    id: crypto.randomUUID(),
    sessionId,
    userId,
    tenantId,
    ipAddress,
    userAgent,
    createdAt: now,
    lastActivity: now,
    expiresAt,
    isActive: true,
    timeoutWarningShown: false,
  });
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000);

  await db.update(securitySessions)
    .set({
      lastActivity: now,
      expiresAt,
      timeoutWarningShown: false,
    })
    .where(eq(securitySessions.sessionId, sessionId));
}

export async function checkSessionTimeout(sessionId: string): Promise<{ valid: boolean; showWarning: boolean }> {
  const session = await db.query.securitySessions.findFirst({
    where: (sessions, { eq, and }) => and(eq(sessions.sessionId, sessionId), eq(sessions.isActive, true))
  });

  if (!session) {
    return { valid: false, showWarning: false };
  }

  const now = new Date();
  const warningTime = new Date(session.expiresAt.getTime() - SESSION_WARNING_MINUTES * 60 * 1000);

  if (now >= session.expiresAt) {
    // Session expired
    await db.update(securitySessions)
      .set({ isActive: false })
      .where(eq(securitySessions.sessionId, sessionId));
    
    return { valid: false, showWarning: false };
  }

  if (now >= warningTime && !session.timeoutWarningShown) {
    // Show warning
    await db.update(securitySessions)
      .set({ timeoutWarningShown: true })
      .where(eq(securitySessions.sessionId, sessionId));
    
    return { valid: true, showWarning: true };
  }

  return { valid: true, showWarning: false };
}

export function sessionTimeoutMiddleware() {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    if (req.sessionID && req.user?.id) {
      const sessionCheck = await checkSessionTimeout(req.sessionID);
      
      if (!sessionCheck.valid) {
        return res.status(401).json({ 
          error: 'Session expired', 
          code: 'SESSION_EXPIRED',
          redirectTo: '/login' 
        });
      }

      if (sessionCheck.showWarning) {
        res.setHeader('X-Session-Warning', 'true');
        res.setHeader('X-Session-Expires', new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000).toISOString());
      }

      // Update session activity
      await updateSessionActivity(req.sessionID);
    }
    
    next();
  };
}

// ============= SECURITY UTILITIES =============

export function sanitizeForAudit(data: any): any {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  // Remove sensitive fields from audit logs
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'credit_card', 'ssn', 'tax_id'];
  
  function recursiveSanitize(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const result: any = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = recursiveSanitize(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  return recursiveSanitize(sanitized);
}

export function maskSensitiveData(value: string, type: 'email' | 'phone' | 'ssn' | 'credit_card' = 'email'): string {
  if (!value) return value;
  
  switch (type) {
    case 'email':
      const [local, domain] = value.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    case 'phone':
      return value.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2');
    case 'ssn':
      return value.replace(/(\d{3})\d{2}(\d{4})/, '$1**$2');
    case 'credit_card':
      return value.replace(/(\d{4})\d{8}(\d{4})/, '$1********$2');
    default:
      return '***';
  }
}

// ============= EXPORTS =============

export default {
  // Encryption
  encryptSensitiveData,
  decryptSensitiveData,
  
  // Audit Logging
  logAuditEvent,
  auditLogMiddleware,
  
  // Data Access Logging
  logDataAccess,
  dataAccessLogMiddleware,
  
  // GDPR Compliance
  createGDPRRequest,
  processDataSubjectAccess,
  processDataSubjectErasure,
  
  // Session Management
  createSecuritySession,
  updateSessionActivity,
  checkSessionTimeout,
  sessionTimeoutMiddleware,
  
  // Utilities
  sanitizeForAudit,
  maskSensitiveData,
};