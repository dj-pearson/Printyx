import { Router, Request } from 'express';
import { db } from './db';
import { emailMonitorConfig, processedEmails, parsingCorrections } from '@shared/schema';
import { eq, and, desc, gte, lte, count } from 'drizzle-orm';
import { startEmailMonitor, stopEmailMonitor } from './services/email-monitor-service';
import { z } from 'zod';
import {
  encryptCredential,
  decryptCredential,
  safeEncryptCredential,
} from './utils/credentials-encryption';

const router = Router();

// ============================================
// Zod Validation Schemas
// ============================================

const emailConfigSchema = z.object({
  emailAddress: z.string().email('Invalid email address'),
  protocol: z.enum(['imap', 'oauth']).default('imap'),
  host: z.string().min(1).optional(),
  port: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val ? Number(val) : null)),
  username: z.string().optional(),
  password: z.string().optional(),
  tls: z.boolean().optional().default(true),
  enabled: z.boolean().optional().default(true),
  pollInterval: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val ? Number(val) : 60)),
  autoAssignTechnician: z.boolean().optional().default(true),
  sendConfirmationEmail: z.boolean().optional().default(true),
});

const testConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  tls: z.boolean().optional().default(true),
});

const correctionSchema = z.object({
  emailId: z.string().uuid('Invalid email ID'),
  aiParsedData: z.record(z.unknown()),
  correctedData: z.record(z.unknown()),
  correctionReason: z.string().optional(),
});

// Helper to get user ID from request (supports Supabase JWT and session)
const getUserId = (req: Request): string | undefined => {
  const reqAny = req as any;
  return reqAny.user?.id || reqAny.user?.claims?.sub || reqAny.session?.userId;
};

/**
 * GET /api/email-parser/config
 * Get email monitor configuration for current tenant
 */
router.get('/config', async (req: any, res) => {
  try {
    const { tenantId } = req;

    const config = await db.query.emailMonitorConfig.findFirst({
      where: eq(emailMonitorConfig.tenantId, tenantId),
    });

    if (!config) {
      return res.json({
        enabled: false,
        message: 'Email monitoring not configured',
      });
    }

    // Don't send encrypted password to client
    const { encryptedPassword, oauthEncryptedRefreshToken, ...safeConfig } = config;

    res.json(safeConfig);
  } catch (error) {
    console.error('[EmailParserAPI] Error getting config:', error);
    res.status(500).json({ message: 'Failed to get configuration' });
  }
});

/**
 * POST /api/email-parser/config
 * Create or update email monitor configuration
 */
router.post('/config', async (req: any, res) => {
  try {
    const { tenantId } = req;

    // Validate input with Zod
    const validation = emailConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const {
      emailAddress,
      protocol,
      host,
      port,
      username,
      password,
      tls,
      enabled,
      pollInterval,
      autoAssignTechnician,
      sendConfirmationEmail,
    } = validation.data;

    // Additional validation for IMAP protocol
    if (protocol === 'imap' && (!host || !port || !username || !password)) {
      return res.status(400).json({
        message: 'IMAP configuration requires host, port, username, and password',
      });
    }

    // Encrypt password using AES-256-GCM before storing
    const encryptedPassword = password ? encryptCredential(password) : null;

    // Check if config exists
    const existingConfig = await db.query.emailMonitorConfig.findFirst({
      where: eq(emailMonitorConfig.tenantId, tenantId),
    });

    let config;

    if (existingConfig) {
      // Update existing config
      [config] = await db
        .update(emailMonitorConfig)
        .set({
          emailAddress,
          protocol,
          host,
          port,
          username,
          encryptedPassword: encryptedPassword || existingConfig.encryptedPassword,
          tls,
          enabled,
          pollInterval,
          autoAssignTechnician,
          sendConfirmationEmail,
          updatedAt: new Date(),
        })
        .where(eq(emailMonitorConfig.tenantId, tenantId))
        .returning();
    } else {
      // Create new config
      [config] = await db
        .insert(emailMonitorConfig)
        .values({
          tenantId,
          emailAddress,
          protocol,
          host,
          port,
          username,
          encryptedPassword,
          tls,
          enabled,
          pollInterval,
          autoAssignTechnician,
          sendConfirmationEmail,
        })
        .returning();
    }

    // Restart monitor if enabled
    if (config.enabled) {
      await stopEmailMonitor(tenantId); // Stop if running
      await startEmailMonitor(tenantId); // Start with new config
    } else {
      await stopEmailMonitor(tenantId); // Stop if disabled
    }

    // Don't send encrypted password to client
    const { encryptedPassword: _, ...safeConfig } = config;

    res.json({
      message: 'Configuration saved successfully',
      config: safeConfig,
    });
  } catch (error) {
    console.error('[EmailParserAPI] Error saving config:', error);
    res.status(500).json({ message: 'Failed to save configuration' });
  }
});

/**
 * POST /api/email-parser/test-connection
 * Test email server connection
 */
router.post('/test-connection', async (req: any, res) => {
  try {
    // Validate input with Zod
    const validation = testConnectionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { host, port, username, password, tls } = validation.data;

    // In production, this would establish an actual IMAP connection to verify credentials
    // For now, perform basic connectivity check
    try {
      // Attempt DNS resolution as a basic check
      const dns = await import('dns').then((m) => m.promises);
      await dns.lookup(host);

      res.json({
        success: true,
        message: 'Connection parameters validated successfully',
      });
    } catch (dnsError) {
      res.status(400).json({
        success: false,
        message: 'Unable to resolve host',
        error: `Host '${host}' could not be resolved`,
      });
    }
  } catch (error) {
    console.error('[EmailParserAPI] Error testing connection:', error);
    res.status(500).json({
      success: false,
      message: 'Connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/email-parser/processed-emails
 * Get list of processed emails with pagination
 */
router.get('/processed-emails', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string; // success, failed, skipped
    const offset = (page - 1) * limit;

    let whereConditions: any = eq(processedEmails.tenantId, tenantId);

    if (status) {
      whereConditions = and(whereConditions, eq(processedEmails.processingStatus, status));
    }

    const [emails, total] = await Promise.all([
      db.query.processedEmails.findMany({
        where: whereConditions,
        orderBy: [desc(processedEmails.processedAt)],
        limit,
        offset,
      }),
      db
        .select({ count: count() })
        .from(processedEmails)
        .where(whereConditions)
        .then((result) => result[0]?.count || 0),
    ]);

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    console.error('[EmailParserAPI] Error getting processed emails:', error);
    res.status(500).json({ message: 'Failed to get processed emails' });
  }
});

/**
 * GET /api/email-parser/stats
 * Get statistics about email processing
 */
router.get('/stats', async (req: any, res) => {
  try {
    const { tenantId } = req;

    // Get config with stats
    const config = await db.query.emailMonitorConfig.findFirst({
      where: eq(emailMonitorConfig.tenantId, tenantId),
    });

    if (!config) {
      return res.json({
        enabled: false,
        totalProcessed: 0,
        totalTickets: 0,
        successRate: 0,
      });
    }

    // Get processed emails count by status (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = await db
      .select({
        status: processedEmails.processingStatus,
        count: count(),
      })
      .from(processedEmails)
      .where(
        and(
          eq(processedEmails.tenantId, tenantId),
          gte(processedEmails.processedAt, thirtyDaysAgo),
        ),
      )
      .groupBy(processedEmails.processingStatus);

    const statsByStatus = stats.reduce(
      (acc: any, stat: any) => {
        acc[stat.status] = Number(stat.count);
        return acc;
      },
      { success: 0, failed: 0, skipped: 0 },
    );

    const totalProcessed = Object.values(statsByStatus).reduce(
      (sum: number, count: any) => sum + count,
      0,
    );
    const successRate =
      totalProcessed > 0 ? ((statsByStatus.success / totalProcessed) * 100).toFixed(1) : 0;

    res.json({
      enabled: config.enabled,
      lastCheckAt: config.lastCheckAt,
      lastSuccessAt: config.lastSuccessAt,
      lastErrorAt: config.lastErrorAt,
      lastError: config.lastError,
      totalEmailsProcessed: config.totalEmailsProcessed,
      totalTicketsCreated: config.totalTicketsCreated,
      last30Days: {
        total: totalProcessed,
        success: statsByStatus.success,
        failed: statsByStatus.failed,
        skipped: statsByStatus.skipped,
        successRate: `${successRate}%`,
      },
    });
  } catch (error) {
    console.error('[EmailParserAPI] Error getting stats:', error);
    res.status(500).json({ message: 'Failed to get statistics' });
  }
});

/**
 * POST /api/email-parser/corrections
 * Submit a correction to AI parsing
 */
router.post('/corrections', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const userId = getUserId(req);

    // Validate input with Zod
    const validation = correctionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { emailId, aiParsedData, correctedData, correctionReason } = validation.data;

    await db.insert(parsingCorrections).values({
      emailId,
      aiParsedData,
      correctedData,
      correctionReason,
      correctedBy: userId,
    });

    res.json({ message: 'Correction saved successfully' });
  } catch (error) {
    console.error('[EmailParserAPI] Error saving correction:', error);
    res.status(500).json({ message: 'Failed to save correction' });
  }
});

/**
 * POST /api/email-parser/enable
 * Enable email monitoring
 */
router.post('/enable', async (req: any, res) => {
  try {
    const { tenantId } = req;

    await db
      .update(emailMonitorConfig)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(emailMonitorConfig.tenantId, tenantId));

    await startEmailMonitor(tenantId);

    res.json({ message: 'Email monitoring enabled' });
  } catch (error) {
    console.error('[EmailParserAPI] Error enabling monitor:', error);
    res.status(500).json({ message: 'Failed to enable monitoring' });
  }
});

/**
 * POST /api/email-parser/disable
 * Disable email monitoring
 */
router.post('/disable', async (req: any, res) => {
  try {
    const { tenantId } = req;

    await db
      .update(emailMonitorConfig)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(emailMonitorConfig.tenantId, tenantId));

    await stopEmailMonitor(tenantId);

    res.json({ message: 'Email monitoring disabled' });
  } catch (error) {
    console.error('[EmailParserAPI] Error disabling monitor:', error);
    res.status(500).json({ message: 'Failed to disable monitoring' });
  }
});

export default router;
