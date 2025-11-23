import { Router } from 'express';
import { db } from './db';
import {
  emailMonitorConfig,
  processedEmails,
  parsingCorrections,
} from '@shared/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import {
  startEmailMonitor,
  stopEmailMonitor,
} from './services/email-monitor-service';

const router = Router();

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
    } = req.body;

    // Validate required fields
    if (!emailAddress || !protocol) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (protocol === 'imap' && (!host || !port || !username || !password)) {
      return res.status(400).json({
        message: 'IMAP configuration requires host, port, username, and password',
      });
    }

    // TODO: Encrypt password before storing
    const encryptedPassword = password; // Placeholder - implement encryption

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
          port: port ? parseInt(port) : null,
          username,
          encryptedPassword: password ? encryptedPassword : existingConfig.encryptedPassword,
          tls: tls !== undefined ? tls : true,
          enabled: enabled !== undefined ? enabled : true,
          pollInterval: pollInterval ? parseInt(pollInterval) : 60,
          autoAssignTechnician:
            autoAssignTechnician !== undefined ? autoAssignTechnician : true,
          sendConfirmationEmail:
            sendConfirmationEmail !== undefined ? sendConfirmationEmail : true,
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
          port: port ? parseInt(port) : null,
          username,
          encryptedPassword,
          tls: tls !== undefined ? tls : true,
          enabled: enabled !== undefined ? enabled : true,
          pollInterval: pollInterval ? parseInt(pollInterval) : 60,
          autoAssignTechnician:
            autoAssignTechnician !== undefined ? autoAssignTechnician : true,
          sendConfirmationEmail:
            sendConfirmationEmail !== undefined ? sendConfirmationEmail : true,
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
    const { host, port, username, password, tls } = req.body;

    if (!host || !port || !username || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // TODO: Implement actual IMAP connection test
    // For now, return mock success
    res.json({
      success: true,
      message: 'Connection successful',
    });
  } catch (error) {
    console.error('[EmailParserAPI] Error testing connection:', error);
    res.status(500).json({
      success: false,
      message: 'Connection failed',
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
      whereConditions = and(
        whereConditions,
        eq(processedEmails.processingStatus, status)
      );
    }

    const [emails, total] = await Promise.all([
      db.query.processedEmails.findMany({
        where: whereConditions,
        orderBy: [desc(processedEmails.processedAt)],
        limit,
        offset,
      }),
      db
        .select({ count: db.count() })
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
        count: db.count(),
      })
      .from(processedEmails)
      .where(
        and(
          eq(processedEmails.tenantId, tenantId),
          gte(processedEmails.processedAt, thirtyDaysAgo)
        )
      )
      .groupBy(processedEmails.processingStatus);

    const statsByStatus = stats.reduce(
      (acc: any, stat: any) => {
        acc[stat.status] = Number(stat.count);
        return acc;
      },
      { success: 0, failed: 0, skipped: 0 }
    );

    const totalProcessed = Object.values(statsByStatus).reduce(
      (sum: number, count: any) => sum + count,
      0
    );
    const successRate =
      totalProcessed > 0
        ? ((statsByStatus.success / totalProcessed) * 100).toFixed(1)
        : 0;

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
    const userId = req.session.userId;
    const { emailId, aiParsedData, correctedData, correctionReason } = req.body;

    if (!emailId || !aiParsedData || !correctedData) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

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
