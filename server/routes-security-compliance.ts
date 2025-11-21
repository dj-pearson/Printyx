/**
 * Security & Compliance API Routes
 * Endpoints for audit logs, GDPR requests, data access tracking, and security management
 */

import { Router, type Request, type Response } from 'express';
import { eq, desc, and, gte, lte, like, or, sql } from 'drizzle-orm';
import { db } from './db';
import { 
  auditLogs, 
  dataAccessLogs, 
  gdprRequests, 
  securitySessions, 
  complianceSettings,
  insertGdprRequestSchema,
  insertComplianceSettingsSchema 
} from '../shared/security-schema';
import { 
  createGDPRRequest, 
  processDataSubjectAccess, 
  logAuditEvent,
  auditLogMiddleware,
  dataAccessLogMiddleware,
  sessionTimeoutMiddleware,
  sanitizeForAudit,
  maskSensitiveData 
} from './security-compliance';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { requireRole } from './rbac-middleware';

const router = Router();

// Apply security middleware to all routes
router.use(resolveTenant);
router.use(requireTenant);
router.use(sessionTimeoutMiddleware());

// ============= AUDIT LOGS ENDPOINTS =============

// Get audit logs with filtering and pagination
router.get('/audit-logs', 
  requireRole(['admin', 'compliance_officer']),
  auditLogMiddleware('VIEW_AUDIT_LOGS', 'audit_logs', 'high', 'security'),
  async (req: TenantRequest, res) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        startDate, 
        endDate, 
        userId, 
        action, 
        resource, 
        severity,
        category 
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const conditions = [eq(auditLogs.tenantId, req.tenantId!)];

      if (startDate) {
        conditions.push(gte(auditLogs.timestamp, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(auditLogs.timestamp, new Date(endDate as string)));
      }
      if (userId) {
        conditions.push(eq(auditLogs.userId, userId as string));
      }
      if (action) {
        conditions.push(like(auditLogs.action, `%${action}%`));
      }
      if (resource) {
        conditions.push(eq(auditLogs.resource, resource as string));
      }
      if (severity) {
        conditions.push(eq(auditLogs.severity, severity as any));
      }
      if (category) {
        conditions.push(eq(auditLogs.category, category as any));
      }

      const whereClause = and(...conditions);

      const [logs, [{ count }]] = await Promise.all([
        db.select()
          .from(auditLogs)
          .where(whereClause)
          .orderBy(desc(auditLogs.timestamp))
          .limit(Number(limit))
          .offset(offset),
        db.select({ count: sql`count(*)` })
          .from(auditLogs)
          .where(whereClause)
      ]);

      // Mask sensitive data in audit logs for display
      const maskedLogs = logs.map(log => ({
        ...log,
        oldValues: log.oldValues ? sanitizeForAudit(log.oldValues) : null,
        newValues: log.newValues ? sanitizeForAudit(log.newValues) : null,
      }));

      res.json({
        logs: maskedLogs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(count),
          totalPages: Math.ceil(Number(count) / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
  }
);

// Get audit statistics
router.get('/audit-logs/stats',
  requireRole(['admin', 'compliance_officer']),
  async (req: TenantRequest, res) => {
    try {
      const { days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));

      const stats = await db
        .select({
          category: auditLogs.category,
          severity: auditLogs.severity,
          count: sql`count(*)`
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, req.tenantId!),
            gte(auditLogs.timestamp, startDate)
          )
        )
        .groupBy(auditLogs.category, auditLogs.severity);

      res.json({ stats });
    } catch (error) {
      console.error('Error fetching audit stats:', error);
      res.status(500).json({ message: 'Failed to fetch audit statistics' });
    }
  }
);

// ============= DATA ACCESS LOGS ENDPOINTS =============

// Get data access logs
router.get('/data-access-logs',
  requireRole(['admin', 'compliance_officer']),
  dataAccessLogMiddleware('data_access_logs', 'confidential'),
  async (req: TenantRequest, res) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        startDate, 
        endDate, 
        userId, 
        resource,
        accessType,
        classification 
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const conditions = [eq(dataAccessLogs.tenantId, req.tenantId!)];

      if (startDate) {
        conditions.push(gte(dataAccessLogs.accessedAt, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(dataAccessLogs.accessedAt, new Date(endDate as string)));
      }
      if (userId) {
        conditions.push(eq(dataAccessLogs.userId, userId as string));
      }
      if (resource) {
        conditions.push(eq(dataAccessLogs.resource, resource as string));
      }
      if (accessType) {
        conditions.push(eq(dataAccessLogs.accessType, accessType as any));
      }
      if (classification) {
        conditions.push(eq(dataAccessLogs.dataClassification, classification as any));
      }

      const whereClause = and(...conditions);

      const [logs, [{ count }]] = await Promise.all([
        db.select()
          .from(dataAccessLogs)
          .where(whereClause)
          .orderBy(desc(dataAccessLogs.accessedAt))
          .limit(Number(limit))
          .offset(offset),
        db.select({ count: sql`count(*)` })
          .from(dataAccessLogs)
          .where(whereClause)
      ]);

      res.json({
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(count),
          totalPages: Math.ceil(Number(count) / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Error fetching data access logs:', error);
      res.status(500).json({ message: 'Failed to fetch data access logs' });
    }
  }
);

// ============= GDPR REQUESTS ENDPOINTS =============

// Get GDPR requests
router.get('/gdpr-requests',
  requireRole(['admin', 'compliance_officer', 'legal']),
  auditLogMiddleware('VIEW_GDPR_REQUESTS', 'gdpr_requests', 'medium', 'data_access'),
  async (req: TenantRequest, res) => {
    try {
      const { page = 1, limit = 25, status, type } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const conditions = [eq(gdprRequests.tenantId, req.tenantId!)];

      if (status) {
        conditions.push(eq(gdprRequests.status, status as any));
      }
      if (type) {
        conditions.push(eq(gdprRequests.type, type as any));
      }

      const whereClause = and(...conditions);

      const [requests, [{ count }]] = await Promise.all([
        db.select()
          .from(gdprRequests)
          .where(whereClause)
          .orderBy(desc(gdprRequests.createdAt))
          .limit(Number(limit))
          .offset(offset),
        db.select({ count: sql`count(*)` })
          .from(gdprRequests)
          .where(whereClause)
      ]);

      res.json({
        requests,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(count),
          totalPages: Math.ceil(Number(count) / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Error fetching GDPR requests:', error);
      res.status(500).json({ message: 'Failed to fetch GDPR requests' });
    }
  }
);

// Create GDPR request
router.post('/gdpr-requests',
  requireRole(['admin', 'compliance_officer', 'legal', 'manager']),
  auditLogMiddleware('CREATE_GDPR_REQUEST', 'gdpr_requests', 'high', 'data_access'),
  async (req: TenantRequest, res) => {
    try {
      const requestData = insertGdprRequestSchema.parse({
        ...req.body,
        tenantId: req.tenantId,
        requestorId: req.user!.id,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      });

      const requestId = await createGDPRRequest(requestData);

      res.status(201).json({ 
        message: 'GDPR request created successfully',
        requestId 
      });
    } catch (error) {
      console.error('Error creating GDPR request:', error);
      res.status(500).json({ message: 'Failed to create GDPR request' });
    }
  }
);

// Process data subject access request
router.post('/gdpr-requests/:id/process-access',
  requireRole(['admin', 'compliance_officer']),
  auditLogMiddleware('PROCESS_GDPR_ACCESS', 'gdpr_requests', 'high', 'data_access'),
  async (req: TenantRequest, res) => {
    try {
      const requestId = req.params.id;
      
      // Get the request details
      const request = await db.query.gdprRequests.findFirst({
        where: and(
          eq(gdprRequests.id, requestId),
          eq(gdprRequests.tenantId, req.tenantId!)
        )
      });

      if (!request) {
        return res.status(404).json({ message: 'GDPR request not found' });
      }

      if (request.type !== 'access') {
        return res.status(400).json({ message: 'Not a data access request' });
      }

      // Process the access request
      const personalData = await processDataSubjectAccess(req.tenantId!, request.subjectId);

      // Update request status
      await db.update(gdprRequests)
        .set({
          status: 'completed',
          completionDate: new Date(),
          responseData: personalData,
          responseFormat: 'json',
          responseSize: JSON.stringify(personalData).length,
          updatedAt: new Date(),
        })
        .where(eq(gdprRequests.id, requestId));

      res.json({
        message: 'Data access request processed successfully',
        data: sanitizeForAudit(personalData),
      });
    } catch (error) {
      console.error('Error processing GDPR access request:', error);
      res.status(500).json({ message: 'Failed to process data access request' });
    }
  }
);

// ============= SECURITY SESSIONS ENDPOINTS =============

// Get active sessions
router.get('/security-sessions',
  requireRole(['admin', 'security_officer']),
  async (req: TenantRequest, res) => {
    try {
      const { page = 1, limit = 25, userId } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const conditions = [
        eq(securitySessions.tenantId, req.tenantId!),
        eq(securitySessions.isActive, true)
      ];

      if (userId) {
        conditions.push(eq(securitySessions.userId, userId as string));
      }

      const whereClause = and(...conditions);

      const [sessions, [{ count }]] = await Promise.all([
        db.select()
          .from(securitySessions)
          .where(whereClause)
          .orderBy(desc(securitySessions.lastActivity))
          .limit(Number(limit))
          .offset(offset),
        db.select({ count: sql`count(*)` })
          .from(securitySessions)
          .where(whereClause)
      ]);

      res.json({
        sessions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(count),
          totalPages: Math.ceil(Number(count) / Number(limit)),
        },
      });
    } catch (error) {
      console.error('Error fetching security sessions:', error);
      res.status(500).json({ message: 'Failed to fetch security sessions' });
    }
  }
);

// Terminate session
router.post('/security-sessions/:sessionId/terminate',
  requireRole(['admin', 'security_officer']),
  auditLogMiddleware('TERMINATE_SESSION', 'security_sessions', 'medium', 'security'),
  async (req: TenantRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { reason = 'admin' } = req.body;

      await db.update(securitySessions)
        .set({
          isActive: false,
          terminatedAt: new Date(),
          terminationReason: reason,
          terminatedBy: req.user!.id,
        })
        .where(
          and(
            eq(securitySessions.sessionId, sessionId),
            eq(securitySessions.tenantId, req.tenantId!)
          )
        );

      res.json({ message: 'Session terminated successfully' });
    } catch (error) {
      console.error('Error terminating session:', error);
      res.status(500).json({ message: 'Failed to terminate session' });
    }
  }
);

// ============= COMPLIANCE SETTINGS ENDPOINTS =============

// Get compliance settings
router.get('/compliance-settings',
  requireRole(['admin', 'compliance_officer']),
  async (req: TenantRequest, res) => {
    try {
      const settings = await db.query.complianceSettings.findFirst({
        where: eq(complianceSettings.tenantId, req.tenantId!)
      });

      if (!settings) {
        // Return default settings if none exist
        return res.json({
          gdprEnabled: true,
          gdprResponseDays: 30,
          sessionTimeoutMinutes: 30,
          sessionWarningMinutes: 25,
          encryptSensitiveFields: true,
          maskDataInLogs: true,
          // ... other defaults
        });
      }

      res.json(settings);
    } catch (error) {
      console.error('Error fetching compliance settings:', error);
      res.status(500).json({ message: 'Failed to fetch compliance settings' });
    }
  }
);

// Update compliance settings
router.put('/compliance-settings',
  requireRole(['admin', 'compliance_officer']),
  auditLogMiddleware('UPDATE_COMPLIANCE_SETTINGS', 'compliance_settings', 'high', 'system'),
  async (req: TenantRequest, res) => {
    try {
      const settingsData = insertComplianceSettingsSchema.parse({
        ...req.body,
        tenantId: req.tenantId,
      });

      // Check if settings exist
      const existingSettings = await db.query.complianceSettings.findFirst({
        where: eq(complianceSettings.tenantId, req.tenantId!)
      });

      if (existingSettings) {
        await db.update(complianceSettings)
          .set({ ...settingsData, updatedAt: new Date() })
          .where(eq(complianceSettings.tenantId, req.tenantId!));
      } else {
        await db.insert(complianceSettings).values(settingsData);
      }

      res.json({ message: 'Compliance settings updated successfully' });
    } catch (error) {
      console.error('Error updating compliance settings:', error);
      res.status(500).json({ message: 'Failed to update compliance settings' });
    }
  }
);

// ============= SECURITY DASHBOARD ENDPOINTS =============

// Get security dashboard data
router.get('/security-dashboard',
  requireRole(['admin', 'security_officer', 'compliance_officer']),
  async (req: TenantRequest, res) => {
    try {
      const { days = 7 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));

      const [
        auditStats,
        accessStats,
        sessionStats,
        gdprStats,
        securityAlerts
      ] = await Promise.all([
        // Audit log statistics
        db.select({
          category: auditLogs.category,
          count: sql`count(*)`
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, req.tenantId!),
            gte(auditLogs.timestamp, startDate)
          )
        )
        .groupBy(auditLogs.category),

        // Data access statistics
        db.select({
          accessType: dataAccessLogs.accessType,
          count: sql`count(*)`
        })
        .from(dataAccessLogs)
        .where(
          and(
            eq(dataAccessLogs.tenantId, req.tenantId!),
            gte(dataAccessLogs.accessedAt, startDate)
          )
        )
        .groupBy(dataAccessLogs.accessType),

        // Active sessions count
        db.select({ count: sql`count(*)` })
          .from(securitySessions)
          .where(
            and(
              eq(securitySessions.tenantId, req.tenantId!),
              eq(securitySessions.isActive, true)
            )
          ),

        // GDPR requests statistics
        db.select({
          status: gdprRequests.status,
          count: sql`count(*)`
        })
        .from(gdprRequests)
        .where(eq(gdprRequests.tenantId, req.tenantId!))
        .groupBy(gdprRequests.status),

        // Security alerts (suspicious activities)
        db.select()
          .from(dataAccessLogs)
          .where(
            and(
              eq(dataAccessLogs.tenantId, req.tenantId!),
              eq(dataAccessLogs.suspiciousActivity, true),
              gte(dataAccessLogs.accessedAt, startDate)
            )
          )
          .limit(10)
      ]);

      res.json({
        auditStats,
        accessStats,
        activeSessions: sessionStats[0]?.count || 0,
        gdprStats,
        securityAlerts,
        timeRange: `${days} days`,
      });
    } catch (error) {
      console.error('Error fetching security dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch security dashboard data' });
    }
  }
);

export default router;